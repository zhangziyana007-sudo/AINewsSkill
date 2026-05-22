#!/usr/bin/env node
/**
 * 飞书 Webhook 推送 — 将 AI 早报推送到飞书群
 *
 * 环境变量：
 *   FEISHU_WEBHOOK_URL  — 飞书自定义机器人 Webhook 地址（必需）
 *   FEISHU_APP_ID       — 飞书应用 App ID（可选，有则直接上传图片到飞书）
 *   FEISHU_APP_SECRET   — 飞书应用 App Secret（可选，有则直接上传图片到飞书）
 *
 * 图片发送策略：
 *   1. 有 FEISHU_APP_ID → 上传到飞书获取 image_key → 发送内嵌图片
 *   2. 无飞书凭证 → 上传到 freeimage.host 免费图床 → 发送富文本含图片链接
 *   3. 上传失败 → 降级为纯文字摘要
 *
 * 用法：
 *   node scripts/push-feishu.mjs [--input=output/ai-daily-0520]
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

// ── 参数解析 ────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v || 'true']; })
);

const WEBHOOK_URL = process.env.FEISHU_WEBHOOK_URL;
const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;

if (!WEBHOOK_URL) {
  console.error('❌ 缺少 FEISHU_WEBHOOK_URL 环境变量');
  console.error('   在飞书群 → 设置 → 群机器人 → 添加自定义机器人 → 复制 Webhook 地址');
  process.exit(1);
}

// ── 定位输出目录 ────────────────────────────────────
const today = new Date();
const defaultProject = `ai-daily-${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
const inputDir = resolve(args.input || `./output/${defaultProject}`);
const dataPath = join(inputDir, 'data.json');
const imagesDir = join(inputDir, 'images');

if (!existsSync(dataPath)) {
  console.error(`❌ 找不到数据文件: ${dataPath}`);
  console.error('   请先运行: ainews run --force');
  process.exit(1);
}

const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

// ── 提取新闻摘要 ────────────────────────────────────
function extractSummary(data) {
  const newsPages = data.pages.filter(p => p.type === 'news');
  const allItems = newsPages.flatMap(p => p.items || []);
  const lines = allItems.map((item, i) => `${i + 1}. ${item.title}`);
  const subtitle = data.pages.find(p => p.type === 'cover')?.subtitle || '';
  return { subtitle, lines, count: allItems.length };
}

// ── 飞书 API：获取 tenant_access_token ────────────────
async function getTenantToken() {
  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`获取 token 失败: ${json.msg}`);
  return json.tenant_access_token;
}

// ── 飞书 API：上传图片 ────────────────────────────────
async function uploadImage(token, imagePath) {
  const imageData = readFileSync(imagePath);
  const blob = new Blob([imageData], { type: 'image/png' });

  const form = new FormData();
  form.append('image_type', 'message');
  form.append('image', blob, 'page.png');

  const res = await fetch('https://open.feishu.cn/open-apis/im/v1/images', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`上传图片失败: ${json.msg}`);
  return json.data.image_key;
}

// ── 发送富文本消息（带图片）────────────────────────────
async function sendWithImages(summary, imageKeys) {
  const content = [
    [{ tag: 'text', text: `📰 ${data.date} AI早报 Top ${summary.count}\n${summary.subtitle}\n\n` }],
    ...summary.lines.map(line => [{ tag: 'text', text: line + '\n' }]),
    [{ tag: 'text', text: '\n' }],
    ...imageKeys.map(key => [{ tag: 'img', image_key: key }]),
  ];

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msg_type: 'post',
      content: { post: { zh_cn: { title: `🤖 ${data.date} AI大模型早报`, content } } },
    }),
  });
  const json = await res.json();
  return json;
}

// ── 发送纯文字消息（无图片）────────────────────────────
async function sendTextOnly(summary) {
  const text = [
    `🤖 ${data.date} AI大模型早报 Top ${summary.count}`,
    `📌 ${summary.subtitle}`,
    '',
    ...summary.lines,
    '',
    '—— AINewsSkill 自动生成',
  ].join('\n');

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msg_type: 'text', content: { text } }),
  });
  const json = await res.json();
  return json;
}

// ── 上传图片到 freeimage.host 免费图床（无需注册）────────────
async function uploadToImgHost(imagePath) {
  const imageData = readFileSync(imagePath);
  const blob = new Blob([imageData], { type: 'image/png' });
  const form = new FormData();
  form.append('source', blob, imagePath.split('/').pop());
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

// ── 发送富文本消息（含图片链接）─────────────────────────
async function sendWithImageLinks(summary, imageUrls) {
  const content = [
    [{ tag: 'text', text: `📌 ${summary.subtitle}\n\n` }],
    ...summary.lines.map(line => [{ tag: 'text', text: line + '\n' }]),
    [{ tag: 'text', text: '\n📸 早报图片：\n' }],
    ...imageUrls.map((url, i) => [
      { tag: 'a', text: `查看第${i + 1}页`, href: url },
      { tag: 'text', text: '  ' },
    ]),
  ];

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msg_type: 'post',
      content: { post: { zh_cn: { title: `🤖 ${data.date} AI大模型早报`, content } } },
    }),
  });
  return await res.json();
}

// ── 主流程 ───────────────────────────────────────────
async function main() {
  const summary = extractSummary(data);
  console.log(`📤 推送飞书: ${data.date} AI早报（${summary.count} 条）\n`);

  // 自动扫描 images/ 下全部 page*.png（按数字升序）
  const { readdirSync } = await import('node:fs');
  const imageFiles = readdirSync(imagesDir)
    .filter(f => /^page\d+\.png$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]))
    .map(f => join(imagesDir, f))
    .filter(f => existsSync(f));

  console.log(`🖼️  发现 ${imageFiles.length} 张图片待推送`);

  // 策略 1：有飞书应用凭证 → 上传到飞书
  if (APP_ID && APP_SECRET) {
    console.log('🔑 检测到飞书应用凭证，尝试上传图片到飞书...');
    try {
      const token = await getTenantToken();
      const imageKeys = [];
      for (const imgPath of imageFiles) {
        const key = await uploadImage(token, imgPath);
        console.log(`  ✅ ${imgPath.split('/').pop()} → ${key}`);
        imageKeys.push(key);
      }
      const result = await sendWithImages(summary, imageKeys);
      if (result.code === 0 || result.StatusCode === 0) {
        console.log('\n✅ 飞书推送成功（内嵌图片模式）');
        return;
      }
    } catch (err) {
      console.log(`  ⚠️  飞书图片上传失败: ${err.message}`);
      console.log('  ↓ 尝试免费图床方案...\n');
    }
  }

  // 策略 2：上传到免费图床 + 发送链接
  if (imageFiles.length > 0) {
    console.log('🌐 上传图片到 freeimage.host 免费图床...');
    try {
      const imageUrls = [];
      for (const imgPath of imageFiles) {
        const url = await uploadToImgHost(imgPath);
        console.log(`  ✅ ${imgPath.split('/').pop()} → ${url}`);
        imageUrls.push(url);
      }
      const result = await sendWithImageLinks(summary, imageUrls);
      if (result.code === 0 || result.StatusCode === 0) {
        console.log('\n✅ 飞书推送成功（图片链接模式）');
        return;
      }
    } catch (err) {
      console.log(`  ⚠️  图床上传失败: ${err.message}`);
      console.log('  ↓ 降级为纯文字模式...\n');
    }
  }

  // 策略 3：纯文字
  console.log('📝 纯文字模式');
  const result = await sendTextOnly(summary);
  if (result.code === 0 || result.StatusCode === 0) {
    console.log('\n✅ 飞书推送成功（纯文字）');
  } else {
    console.error('\n❌ 推送失败:', JSON.stringify(result));
    process.exit(1);
  }
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
