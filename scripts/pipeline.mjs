#!/usr/bin/env node
/**
 * pipeline.mjs — AI Daily 完整流水线
 *
 * 用法：
 *   node pipeline.mjs --input=./data.json [--project=ai-daily-20250520]
 *
 * 流程：data.json → render → screenshot → output/
 */

import { resolve, join, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
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
const projectName = args.project || `ai-daily-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
const projectDir = resolve(ROOT, 'output', projectName);
const pagesDir = join(projectDir, 'pages');
const outputDir = join(projectDir, 'images');

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  AI Daily Pipeline v1.0');
  console.log('═══════════════════════════════════════\n');

  // 确保目录
  await mkdir(pagesDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  // 第一步：渲染 HTML
  console.log('▶ 第一步：渲染 HTML...');
  execSync(
    `node "${join(__dirname, 'render.mjs')}" --input="${inputPath}" --output="${pagesDir}"`,
    { stdio: 'inherit' }
  );

  // 第二步：截图
  console.log('\n▶ 第二步：截图...');
  const screenshotScript = join(__dirname, 'screenshot.mjs');
  execSync(
    `node "${screenshotScript}" --input="${pagesDir}" --output="${outputDir}"`,
    { stdio: 'inherit' }
  );

  console.log('\n═══════════════════════════════════════');
  console.log(`  ✅ 完成！产出目录: ${projectDir}`);
  console.log('═══════════════════════════════════════');
}

main().catch(e => { console.error('❌ 流水线失败:', e.message); process.exit(1); });
