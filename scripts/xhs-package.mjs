#!/usr/bin/env node
/**
 * xhs-package.mjs — 生成「小红书发布素材包」
 *
 * 输入：项目目录（含 data.json + images/）
 * 输出：
 *   xhs-package.md   完整版（标题候选 / 正文 / 话题 / 图片路径）
 *   xhs-package.txt  极简纯文本（一键复制到小豆芽 / 微小宝 / 直接小红书 App）
 *
 * 用法：
 *   node xhs-package.mjs --input=./output/ai-daily-0523
 *   node xhs-package.mjs --input=./output/ai-daily-0523 --topN=8
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

// ── 参数 ─────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? 'true']; })
);
const inputDir = resolve(args.input || './output');
const topN = parseInt(args.topN || '6', 10);

if (!existsSync(join(inputDir, 'data.json'))) {
  console.error(`❌ 找不到 ${inputDir}/data.json`);
  process.exit(1);
}

const data = JSON.parse(readFileSync(join(inputDir, 'data.json'), 'utf-8'));
const imagesDir = join(inputDir, 'images');
const images = existsSync(imagesDir)
  ? readdirSync(imagesDir)
      .filter(f => /^page\d+\.png$/.test(f))
      .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))
      .map(f => join(imagesDir, f))
  : [];

const date = data.date || new Date().toISOString().slice(0, 10);

// data.json 结构：{ pages: [{type:'cover',subtitle,...},{type:'news',items:[...]}] }
const coverPage = (data.pages || []).find(p => p.type === 'cover') || {};
const allItems = (data.pages || [])
  .filter(p => p.type === 'news' && Array.isArray(p.items))
  .flatMap(p => p.items);
const items = allItems.slice(0, topN);
const total = allItems.length;
const subtitle = coverPage.subtitle || '';

// ── 提取关键厂商/关键词 ────────────────────────────
function extractBrands(items) {
  const brands = new Set();
  for (const it of items) {
    const m = it.title?.match(/^【(.+?)】/);
    if (m) brands.add(m[1]);
  }
  return [...brands];
}
const brands = extractBrands(items);

// ── 标题候选（3 个不同风格）───────────────────────
function genTitles() {
  const top3 = brands.slice(0, 3).join(' · ') || 'AI 大模型';
  return [
    `🔥${date} AI日报 | ${top3} 集体上新，速看！`,
    `📰 今日AI圈大事${total > 0 ? `（${total}条）` : ''}：${brands[0] || 'AI'}有大动作`,
    `🤖 ${date} AI早报 · ${subtitle || '一文看懂今日大模型动态'}`,
  ];
}

// ── 正文（小红书风格：emoji + 短句 + 分段 + 互动）─────
function genBody() {
  const lines = [];
  lines.push(`📅 ${date} AI大模型早报 来啦~`);
  lines.push('');
  lines.push(`今日精选 ${total} 条干货，覆盖 ${brands.slice(0, 5).join(' / ') || 'AI 多个领域'} ✨`);
  lines.push('');
  lines.push('🔍 重点摘要：');
  items.slice(0, 5).forEach((it, i) => {
    const cleanTitle = (it.title || '').replace(/^【.+?】/, '').trim();
    lines.push(`${i + 1}. ${cleanTitle}`);
  });
  lines.push('');
  lines.push('💡 完整图文版见图片，建议保存收藏 📌');
  lines.push('');
  lines.push('你最关注哪条？评论区告诉我 👇');
  lines.push('');
  lines.push('—— 关注我，每天 9:30 准时更新 AI 大模型早报 🚀');
  return lines.join('\n');
}

// ── 推荐话题（按厂商动态生成）────────────────────────
function genTags() {
  const base = ['AI', '人工智能', '大模型', 'AI日报', 'AIGC', '科技资讯', 'AI早报', '每日AI', 'AI工具', '程序员'];
  const brandTags = brands.slice(0, 5).map(b => b.toLowerCase().replace(/\s+/g, ''));
  return [...new Set([...brandTags, ...base])].slice(0, 15);
}

const titles = genTitles();
const body = genBody();
const tags = genTags();

// ── 输出 Markdown ────────────────────────────────
const md = `# 📦 小红书发布素材包 — ${date}

> 直接复制粘贴到小豆芽 / 微小宝 / 小红书 App

## ① 标题（选一个）

${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## ② 正文

\`\`\`
${body}
\`\`\`

## ③ 话题标签

${tags.map(t => `#${t}`).join(' ')}

## ④ 图片（共 ${images.length} 张，按顺序上传）

${images.map((p, i) => `${i + 1}. \`${p}\``).join('\n')}

---
*由 AINewsSkill 自动生成 · 数据来源：data.json*
`;

const txt = `${titles[0]}

${body}

${tags.map(t => `#${t}`).join(' ')}
`;

writeFileSync(join(inputDir, 'xhs-package.md'), md);
writeFileSync(join(inputDir, 'xhs-package.txt'), txt);

console.log(`📦 小红书素材包已生成：`);
console.log(`   📝 ${join(inputDir, 'xhs-package.md')}`);
console.log(`   📋 ${join(inputDir, 'xhs-package.txt')}`);
console.log(`   🖼️  ${images.length} 张图片在 ${imagesDir}`);
console.log(`\n💡 提示：标题/正文已生成 3 个候选，话题 ${tags.length} 个，可直接复制到小豆芽/微小宝`);
