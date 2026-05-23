#!/usr/bin/env node
/**
 * screenshot-xhs.mjs — 小红书 3:4 HTML → PNG 批量截图
 *
 * 用法：
 *   node screenshot-xhs.mjs --input=./pages --output=./output
 *   node screenshot-xhs.mjs --input=./pages/page1.html --output=./output  (单文件)
 *
 * 依赖：playwright (chromium)
 */

import { chromium } from 'playwright';
import { readdir, stat, mkdir, unlink } from 'node:fs/promises';
import { resolve, basename, extname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// ── 参数解析 ─────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v || true];
  })
);

const inputPath = resolve(args.input || './pages');
const outputPath = resolve(args.output || './output');
const scale = parseInt(args.scale || '2', 10); // 默认 2x
const width = parseInt(args.width || '900', 10);
const height = parseInt(args.height || '1200', 10);

// ── 收集 HTML 文件 ─────────────────────────────────
async function collectHtmlFiles(inputPath) {
  const info = await stat(inputPath);
  if (info.isFile() && extname(inputPath) === '.html') {
    return [inputPath];
  }
  if (info.isDirectory()) {
    const entries = await readdir(inputPath);
    return entries
      .filter(f => f.endsWith('.html'))
      .sort((a, b) => {
        const na = parseInt(a.match(/\d+/)?.[0] || '0');
        const nb = parseInt(b.match(/\d+/)?.[0] || '0');
        return na - nb;
      })
      .map(f => join(inputPath, f));
  }
  return [];
}

// ── 截图 ────────────────────────────────────────
async function screenshotPages(files) {
  if (!existsSync(outputPath)) {
    await mkdir(outputPath, { recursive: true });
  }

  // 清理旧的 page*.png，避免上一轮多余截图被混入本轮推送
  const existing = await readdir(outputPath);
  for (const f of existing) {
    if (/^page\d+\.png$/.test(f)) {
      await unlink(join(outputPath, f));
    }
  }

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const context = await browser.newContext({
    viewport: { width, height: height + 80 },  // 额外空间容纳 body padding
    deviceScaleFactor: scale,
  });

  const results = [];

  for (const file of files) {
    const name = basename(file, '.html');
    const outFile = join(outputPath, `${name}.png`);
    const page = await context.newPage();

    try {
      // 加载 HTML（支持本地文件）
      const fileUrl = `file://${resolve(file)}`;
      await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // 先移除 Google Fonts 外部链接，避免 fonts.ready 卡住
      await page.evaluate(() => {
        document.querySelectorAll('link[rel="stylesheet"]').forEach(el => {
          const href = el.getAttribute('href') || '';
          if (href.includes('googleapis') || href.includes('gstatic')) {
            el.remove();
          }
        });
      });

      // 等本地字体真正加载完（含 16MB 文泉驿点阵字、像素字体等大文件）
      try {
        await page.evaluate(async () => {
          if (document.fonts) {
            // 显式触发所有 @font-face 加载
            const all = Array.from(document.fonts);
            await Promise.all(all.map(f => f.status === 'loaded' ? Promise.resolve() : f.load().catch(() => {})));
            await document.fonts.ready;
          }
        });
      } catch (_) { /* fonts.ready 不可用时忽略 */ }
      await page.waitForTimeout(300);

      // 隐藏工具栏（如有）
      await page.evaluate(() => {
        document.querySelectorAll('.toolbar').forEach(el => el.style.display = 'none');
      });

      // 截取 .canvas 元素
      const canvas = await page.$('.canvas');
      if (canvas) {
        const box = await canvas.boundingBox();
        if (box) {
          await page.screenshot({ path: outFile, type: 'png', clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
        } else {
          await page.screenshot({ path: outFile, type: 'png', clip: { x: 0, y: 0, width, height } });
        }
      } else {
        // 无 .canvas 时截取整个视口
        await page.screenshot({ path: outFile, type: 'png', clip: { x: 0, y: 0, width, height } });
      }

      results.push({ file: name, output: outFile, status: 'ok' });
      console.log(`✓ ${name}.png (${scale}x → ${width * scale}×${height * scale})`);
    } catch (err) {
      results.push({ file: name, output: null, status: 'error', error: err.message });
      console.error(`✗ ${name}: ${err.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  return results;
}

// ── 主流程 ────────────────────────────────────────
const files = await collectHtmlFiles(inputPath);

if (files.length === 0) {
  console.error(`No HTML files found in: ${inputPath}`);
  process.exit(1);
}

console.log(`\n📸 小红书截图工具`);
console.log(`   输入：${inputPath} (${files.length} 个文件)`);
console.log(`   输出：${outputPath}`);
console.log(`   尺寸：${width}×${height} @${scale}x → ${width * scale}×${height * scale}px\n`);

const results = await screenshotPages(files);

const ok = results.filter(r => r.status === 'ok').length;
const fail = results.filter(r => r.status === 'error').length;
console.log(`\n完成：${ok} 成功，${fail} 失败`);
if (fail > 0) process.exit(1);
