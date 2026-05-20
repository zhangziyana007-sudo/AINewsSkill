#!/usr/bin/env node
/**
 * render.mjs — AI Daily 渲染器
 *
 * 读取 JSON 数据文件 → 套用 HTML 模板 → 输出静态 HTML 页面
 *
 * 用法：
 *   node render.mjs --input=./data.json --output=./pages
 *   node render.mjs --input=./data.json --output=./pages --template=ai-daily
 */

import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── 参数解析 ─────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v || true];
  })
);

const inputPath = resolve(args.input || './data.json');
const outputDir = resolve(args.output || './pages');
const templateName = args.template || 'ai-daily';
const templateDir = resolve(ROOT, 'templates', templateName);

// ── 简易模板引擎 ─────────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getNestedValue(obj, path) {
  if (path === '@index') return obj['@index'];
  if (path === '@index1') return obj['@index1'];
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function renderTemplate(html, data) {
  let result = html;
  let safety = 0;

  // 反复处理直到没有模板标签（处理嵌套）
  while (result.includes('{{') && safety++ < 20) {
    let changed = false;

    // 处理最内层 {{#each}} ... {{/each}}（非贪婪，先处理最内层）
    const eachRe = /\{\{#each\s+([\w.@]+)\}\}([\s\S]*?)\{\{\/each\}\}/;
    let match;
    while ((match = eachRe.exec(result)) !== null) {
      const [full, path, body] = match;
      const arr = getNestedValue(data, path);
      let replacement = '';
      if (Array.isArray(arr)) {
        replacement = arr.map((item, index) => {
          const ctx = typeof item === 'object'
            ? { ...data, ...item, '@index': index, '@index1': index + 1 }
            : { ...data, this: item, '@index': index, '@index1': index + 1 };
          return renderTemplate(body, ctx);
        }).join('');
      }
      result = result.slice(0, match.index) + replacement + result.slice(match.index + full.length);
      changed = true;
    }

    // 处理最内层 {{#if}} ... {{/if}}
    const ifRe = /\{\{#if\s+([\w.@]+)\}\}([\s\S]*?)\{\{\/if\}\}/;
    while ((match = ifRe.exec(result)) !== null) {
      const [full, path, body] = match;
      const val = getNestedValue(data, path);
      const replacement = val ? renderTemplate(body, data) : '';
      result = result.slice(0, match.index) + replacement + result.slice(match.index + full.length);
      changed = true;
    }

    // 处理变量 {{this}}
    result = result.replace(/\{\{this\}\}/g, () => {
      const v = data.this ?? data;
      return typeof v === 'string' ? escapeHtml(v) : String(v ?? '');
    });

    // 处理变量 {{@index1}} {{@index}}
    result = result.replace(/\{\{@index1\}\}/g, String(data['@index1'] ?? ''));
    result = result.replace(/\{\{@index\}\}/g, String(data['@index'] ?? ''));

    // 处理普通变量 {{variable}} 和 {{object.property}}
    result = result.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
      const val = getNestedValue(data, path);
      if (val === undefined || val === null) return '';
      if (Array.isArray(val)) return val.length.toString();
      return escapeHtml(String(val));
    });

    if (!changed && !result.match(/\{\{#/)) break;
  }

  return result;
}

// ── 自适应分页逻辑 ───────────────────────────────
// 封面概要模式：封面标题区 ~300px，剩余空间放新闻摘要
// 画布高度 1200px - 状态条70 - 标题区250 - 底部50 = ~830px 可用
// 每个概要卡片高度约 110px（含2行28px标题+来源+padding）
function splitNewsIntoPages(items) {
  const MAX_HEIGHT = 780; // 封面可用高度（留足余量）
  const CARD_HEIGHT = 110; // 概要卡片高度（2行标题+来源）
  const GAP = 8;           // 卡片间距

  const pages = [];
  let current = [];
  let currentHeight = 0;

  for (const item of items) {
    if (current.length > 0 && currentHeight + GAP + CARD_HEIGHT > MAX_HEIGHT) {
      pages.push(current);
      current = [];
      currentHeight = 0;
    }
    current.push(item);
    currentHeight += (current.length > 1 ? GAP : 0) + CARD_HEIGHT;
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

// ── 封面图标 SVG（Lucide 风格）──────────────────
function getCoverIcon(name) {
  const icons = {
    brain: '<svg viewBox="0 0 24 24"><path d="M9.5 2a3.5 3.5 0 0 0-3.2 4.9A3.5 3.5 0 0 0 4 10.5a3.5 3.5 0 0 0 1.8 3.1A3.5 3.5 0 0 0 7 17.5a3.5 3.5 0 0 0 3.5 3.5c.8 0 1.5-.3 2-.7"/><path d="M14.5 2a3.5 3.5 0 0 1 3.2 4.9A3.5 3.5 0 0 1 20 10.5a3.5 3.5 0 0 1-1.8 3.1A3.5 3.5 0 0 1 17 17.5a3.5 3.5 0 0 1-3.5 3.5c-.8 0-1.5-.3-2-.7"/><path d="M12 2v20"/></svg>',
    code: '<svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    sparkles: '<svg viewBox="0 0 24 24"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>',
    monitor: '<svg viewBox="0 0 24 24"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>',
    smartphone: '<svg viewBox="0 0 24 24"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/></svg>',
    zap: '<svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
    cpu: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>',
    robot: '<svg viewBox="0 0 24 24"><rect width="18" height="10" x="3" y="11" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" x2="8" y1="16" y2="16"/><line x1="16" x2="16" y1="16" y2="16"/></svg>',
    rocket: '<svg viewBox="0 0 24 24"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
    star: '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  };
  return icons[name] || icons.zap;
}

// ── 主流程 ───────────────────────────────────────
async function main() {
  // 读取数据
  console.log(`📖 读取数据: ${inputPath}`);
  const rawData = JSON.parse(await readFile(inputPath, 'utf-8'));

  // 读取模板
  const coverTpl = await readFile(join(templateDir, 'cover.html'), 'utf-8');
  const newsTpl = await readFile(join(templateDir, 'news.html'), 'utf-8');
  const endingTpl = await readFile(join(templateDir, 'ending.html'), 'utf-8');

  // 确保输出目录
  await mkdir(outputDir, { recursive: true });

  // 清理旧的 page*.html 文件
  const { readdir: readdirAsync } = await import('node:fs/promises');
  const existing = await readdirAsync(outputDir);
  for (const f of existing) {
    if (/^page\d+\.html$/.test(f)) {
      const { unlink } = await import('node:fs/promises');
      await unlink(join(outputDir, f));
    }
  }

  // 复制 styles.css 到输出目录（修正字体路径为绝对路径）
  let cssContent = await readFile(join(templateDir, 'styles.css'), 'utf-8');
  const fontsDir = resolve(ROOT, 'fonts');
  cssContent = cssContent.replace(/url\('\.\.\/\.\.\/fonts\//g, `url('${fontsDir}/`);
  await writeFile(join(outputDir, 'styles.css'), cssContent, 'utf-8');

  // 解析页面
  const pages = [];
  const newsItems = rawData.pages
    .filter(p => p.type === 'news')
    .flatMap(p => p.items || []);

  // 共享数据
  const shared = {
    date: rawData.date || new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
    dateShort: rawData.date ? rawData.date.slice(0, 7).replace('.', ' ') : new Date().toISOString().slice(0, 7),
    issue: rawData.issue || `#${new Date().toISOString().slice(0, 7).replace('-', '')}`,
    totalPages: 0,
  };

  // 所有新闻合并为统一列表（一句话摘要）
  const coverData = rawData.pages.find(p => p.type === 'cover') || {};
  const allItems = newsItems.map((item, i) => ({
    rank: i + 1,
    title: item.title,
    source: item.category || '',
    icon: item.icon || 'zap',
  }));

  // 总页数：封面页(们) + 末页
  const coverPages = splitNewsIntoPages(allItems);
  const totalPages = coverPages.length + 1;
  shared.totalPages = totalPages;

  // 生成封面页（每页都是封面样式+新闻摘要列表）
  let rankOffset = 0;
  for (let i = 0; i < coverPages.length; i++) {
    const items = coverPages[i].map((item, idx) => ({
      ...item,
      rank: String(rankOffset + idx + 1).padStart(2, '0'),
    }));
    rankOffset += coverPages[i].length;

    const previewCount = items.length;
    const previewsHtml = `<div class="cover-previews" data-count="${previewCount}">
      ${items.map(p => {
      const iconSvg = getCoverIcon(p.icon || 'zap');
      return `<div class="preview-card">
        <div class="preview-rank">${escapeHtml(p.rank)}</div>
        <div class="preview-body">
          <div class="preview-title">${escapeHtml(p.title)}</div>
          <div class="preview-source">${escapeHtml(p.source)}</div>
        </div>
        <div class="preview-icon">${iconSvg}</div>
      </div>`;
    }).join('\n      ')}
    </div>`;

    let coverHtml = renderTemplate(coverTpl, {
      ...shared,
      titleLines: coverData.title || ['AI', '日报'],
      subtitle: coverData.subtitle || '',
      pageNum: i + 1,
    });
    coverHtml = coverHtml.replace(/\s*<div class="cover-previews">\s*%%SLOT_COVER_PREVIEWS%%\s*<\/div>/, previewsHtml);
    pages.push(coverHtml);
  }

  // 末页
  const endingData = rawData.pages.find(p => p.type === 'ending') || {};
  const endingHtml = renderTemplate(endingTpl, {
    ...shared,
    slogan: endingData.slogan || '关注 AI Daily · 不错过每一条前沿动态',
    cta: endingData.cta || '点赞 + 关注',
    meta: endingData.meta || '',
    pageNum: totalPages,
  });
  pages.push(endingHtml);

  // 写入文件
  for (let i = 0; i < pages.length; i++) {
    const filename = `page${i + 1}.html`;
    await writeFile(join(outputDir, filename), pages[i], 'utf-8');
    console.log(`  ✅ ${filename} (${pages[i].length} bytes)`);
  }

  console.log(`\n🎉 渲染完成: ${pages.length} 页 → ${outputDir}`);
  return outputDir;
}

main().catch(e => { console.error('❌ 渲染失败:', e.message); process.exit(1); });
