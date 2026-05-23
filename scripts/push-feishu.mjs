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

// 没有任何凭证才报错：APP_ID + WEBHOOK 至少有一个
if (!WEBHOOK_URL && !(APP_ID && APP_SECRET)) {
  console.error('❌ 缺少飞书凭证');
  console.error('   方案A: 设置 FEISHU_WEBHOOK_URL（自定义机器人，单群推送）');
  console.error('   方案B: 设置 FEISHU_APP_ID + FEISHU_APP_SECRET（应用机器人，自动推送所在全部群）');
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

// ── 构造富文本消息体（公共）──────────────────────────
function buildPostContent(summary, imageKeys) {
  const content = [
    [{ tag: 'text', text: `📰 ${data.date} AI早报 Top ${summary.count}\n${summary.subtitle}\n\n` }],
    ...summary.lines.map(line => [{ tag: 'text', text: line + '\n' }]),
    [{ tag: 'text', text: '\n' }],
    ...imageKeys.map(key => [{ tag: 'img', image_key: key }]),
  ];
  return { post: { zh_cn: { title: `🤖 ${data.date} AI大模型早报`, content } } };
}

// ── 发送富文本消息到 webhook（单群）─────────────────────
async function sendWithImages(summary, imageKeys) {
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msg_type: 'post', content: buildPostContent(summary, imageKeys) }),
  });
  return await res.json();
}

// ── 飞书 API：列出机器人所在全部群 ────────────────────
async function listBotChats(token) {
  const chats = [];
  let pageToken = '';
  do {
    const url = `https://open.feishu.cn/open-apis/im/v1/chats?page_size=100${pageToken ? `&page_token=${pageToken}` : ''}`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    const json = await res.json();
    if (json.code !== 0) throw new Error(`列群失败: ${json.msg}（需要 im:chat:readonly 权限并发布版本）`);
    chats.push(...(json.data?.items || []));
    pageToken = json.data?.has_more ? json.data.page_token : '';
  } while (pageToken);
  return chats;
}

// ── 飞书 API：以应用身份发消息到指定 chat_id ──────────
async function sendMessageToChat(token, chatId, msgType, content) {
  const res = await fetch(
    'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id',
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: msgType,
        content: JSON.stringify(content),
      }),
    },
  );
  return await res.json();
}

// ── 群发：所有机器人所在群 ─────────────────────────────
async function broadcastToAllChats(token, summary, imageKeys) {
  const chats = await listBotChats(token);
  if (chats.length === 0) {
    console.log('⚠️  机器人未加入任何群，请先把机器人拉进群');
    return false;
  }
  console.log(`📡 机器人所在群：${chats.length} 个`);
  // IM API 的 post 消息 content 不包 post: 层（webhook 才需要）
  const wh = buildPostContent(summary, imageKeys);
  const postContent = wh.post; // { zh_cn: { title, content } }
  let ok = 0;
  let fail = 0;
  for (const chat of chats) {
    const name = chat.name || chat.chat_id;
    try {
      const r = await sendMessageToChat(token, chat.chat_id, 'post', postContent);
      if (r.code === 0) {
        console.log(`  ✅ ${name}`);
        ok++;
      } else {
        console.log(`  ❌ ${name}: [${r.code}] ${r.msg}`);
        fail++;
      }
    } catch (err) {
      console.log(`  ❌ ${name}: ${err.message}`);
      fail++;
    }
  }
  console.log(`\n📊 推送结果：成功 ${ok} / 失败 ${fail} / 总计 ${chats.length}`);
  return ok > 0;
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

// ── 上传图片到 freeimage.host 免费图床（备份方案，需 FREEIMAGE_API_KEY）──
async function uploadToImgHost(imagePath) {
  const apiKey = process.env.FREEIMAGE_API_KEY;
  if (!apiKey) throw new Error('未配置 FREEIMAGE_API_KEY，无法使用免费图床方案');
  const imageData = readFileSync(imagePath);
  const blob = new Blob([imageData], { type: 'image/png' });
  const form = new FormData();
  form.append('source', blob, imagePath.split('/').pop());
  form.append('type', 'file');
  form.append('action', 'upload');

  const res = await fetch(`https://freeimage.host/api/1/upload?key=${apiKey}`, {
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

  // 策略 1：有飞书应用凭证 → 上传图片 + 自动群发到机器人所在所有群
  // 同时如果配置了 WEBHOOK_URL，也用 webhook 推一次（覆盖 webhook 绑定的那个群）
  let appSucceeded = false;
  let webhookKeys = null;
  if (APP_ID && APP_SECRET) {
    console.log('🔑 检测到飞书应用凭证，启用「自动群发到所有群」模式...');
    try {
      const token = await getTenantToken();
      const imageKeys = [];
      for (const imgPath of imageFiles) {
        const key = await uploadImage(token, imgPath);
        console.log(`  ✅ 上传 ${imgPath.split('/').pop()} → ${key}`);
        imageKeys.push(key);
      }
      webhookKeys = imageKeys; // 上传成功的 image_key 可复用给 webhook
      appSucceeded = await broadcastToAllChats(token, summary, imageKeys);
      if (appSucceeded) console.log('✅ 应用机器人群发完成');
    } catch (err) {
      console.log(`  ⚠️  应用机器人模式失败: ${err.message}`);
    }
  }

  // 策略 1b（并行）：如果配置了 WEBHOOK_URL，独立推一次 webhook 绑定的群
  // 因为应用机器人列出的群和 webhook 绑定的群通常是不同的
  if (WEBHOOK_URL) {
    console.log('\n📮 同时推送 webhook 绑定的群...');
    try {
      if (webhookKeys && webhookKeys.length > 0) {
        // 复用应用机器人已上传的 image_key
        const r = await sendWithImages(summary, webhookKeys);
        if (r.code === 0 || r.StatusCode === 0) {
          console.log('  ✅ webhook 群推送成功');
          return; // 全部完成
        }
        console.log(`  ⚠️  webhook 推送失败: ${JSON.stringify(r)}`);
      } else {
        // 没有应用凭证或上传失败，独立走完整 webhook 流程（图床方式）
      }
    } catch (err) {
      console.log(`  ⚠️  webhook 推送异常: ${err.message}`);
    }
  }

  // 如果应用机器人已成功且没有 webhook 配置，到此就够了
  if (appSucceeded && !WEBHOOK_URL) return;
  // 应用机器人已成功（即使 webhook 失败也算整体成功）
  if (appSucceeded) return;

  // 以下是 webhook 完整降级流程（仅当应用机器人没配置或没成功时走）
  if (!WEBHOOK_URL) {
    console.error('\n❌ 应用机器人模式失败且未配置 FEISHU_WEBHOOK_URL，无法降级');
    process.exit(1);
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
