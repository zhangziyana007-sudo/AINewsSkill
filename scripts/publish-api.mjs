#!/usr/bin/env node
/**
 * 生成静态 JSON API — 将最新产出发布为可供外部消费的 JSON
 *
 * 输出:
 *   output/api/latest.json   — 最新一期完整数据（含图片URL）
 *   output/api/history.json  — 历史列表索引
 *   output/api/<date>.json   — 各期归档
 *
 * 用法:
 *   node scripts/publish-api.mjs --input=output/ai-daily-0521
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const API_DIR = join(ROOT, 'output', 'api');

// ── 参数解析 ────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v || 'true']; })
);

const today = new Date();
const defaultProject = `ai-daily-${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
const inputDir = resolve(args.input || `./output/${defaultProject}`);
const dataPath = join(inputDir, 'data.json');
const imagesDir = join(inputDir, 'images');

if (!existsSync(dataPath)) {
  console.error(`❌ 找不到数据文件: ${dataPath}`);
  process.exit(1);
}

// ── 上传图片到 freeimage.host ────────────────────
async function uploadImage(imagePath) {
  const imageData = readFileSync(imagePath);
  const blob = new Blob([imageData], { type: 'image/png' });
  const form = new FormData();
  form.append('source', blob, basename(imagePath));
  form.append('type', 'file');
  form.append('action', 'upload');

  const res = await fetch('https://freeimage.host/api/1/upload?key=6d207e02198a847aa98d0a2a901485a5', {
    method: 'POST',
    body: form,
  });
  const json = await res.json();
  if (json.status_code === 200 && json.image?.url) {
    return json.image.url;
  }
  throw new Error(json.error?.message || '上传失败');
}

// ── 主流程 ───────────────────────────────────────
async function main() {
  mkdirSync(API_DIR, { recursive: true });

  const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
  console.log(`📦 生成 API JSON: ${data.date}`);

  // 上传图片获取 URL
  const imageFiles = ['page1.png', 'page2.png', 'page3.png']
    .map(f => join(imagesDir, f))
    .filter(f => existsSync(f));

  let imageUrls = [];
  if (imageFiles.length > 0) {
    console.log('🌐 上传图片获取公开 URL...');
    for (const imgPath of imageFiles) {
      try {
        const url = await uploadImage(imgPath);
        console.log(`  ✅ ${basename(imgPath)} → ${url}`);
        imageUrls.push(url);
      } catch (err) {
        console.log(`  ⚠️  ${basename(imgPath)} 上传失败: ${err.message}`);
      }
    }
  }

  // 构建 API 数据
  const apiData = {
    version: '1.0',
    date: data.date,
    generatedAt: new Date().toISOString(),
    title: data.pages?.find(p => p.type === 'cover')?.title || `${data.date} AI早报`,
    subtitle: data.pages?.find(p => p.type === 'cover')?.subtitle || '',
    items: data.pages?.filter(p => p.type === 'news').flatMap(p => p.items || []) || [],
    imageUrls,
    totalItems: 0,
  };
  apiData.totalItems = apiData.items.length;

  // 写入 latest.json
  const latestPath = join(API_DIR, 'latest.json');
  writeFileSync(latestPath, JSON.stringify(apiData, null, 2));
  console.log(`\n📄 latest.json → ${latestPath}`);

  // 写入日期归档
  const dateKey = data.date?.replace(/\./g, '-') || defaultProject;
  const archivePath = join(API_DIR, `${dateKey}.json`);
  writeFileSync(archivePath, JSON.stringify(apiData, null, 2));
  console.log(`📄 ${dateKey}.json → ${archivePath}`);

  // 更新 history.json
  const historyPath = join(API_DIR, 'history.json');
  let history = [];
  if (existsSync(historyPath)) {
    history = JSON.parse(readFileSync(historyPath, 'utf-8'));
  }

  // 去重并插入到顶部
  history = history.filter(h => h.date !== data.date);
  history.unshift({
    date: data.date,
    title: apiData.title,
    totalItems: apiData.totalItems,
    imageCount: imageUrls.length,
    generatedAt: apiData.generatedAt,
    file: `${dateKey}.json`,
  });

  // 只保留最近 30 天
  history = history.slice(0, 30);
  writeFileSync(historyPath, JSON.stringify(history, null, 2));
  console.log(`📄 history.json → ${historyPath} (${history.length} 条记录)`);

  console.log('\n✅ API JSON 发布完成');
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
