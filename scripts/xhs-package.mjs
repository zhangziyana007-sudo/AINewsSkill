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
 *   node xhs-package.mjs --input=./output/ai-daily-0523 --ai     # 用 DeepSeek 生成更走心的文案
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
const useAI = args.ai === 'true' || args.ai === true;

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

// ── 可选：AI 增强模式 ─────────────────────────────
let aiTitles = null;
let aiBody = null;
if (useAI) {
  const API_KEY = process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY;
  if (!API_KEY) {
    console.error('⚠️  --ai 需要 DEEPSEEK_API_KEY，跳过 AI 增强，使用模板版');
  } else {
    console.log('🤖 调用 DeepSeek 生成更走心的小红书文案...');
    try {
      const ai = await callAI(API_KEY, items, brands, date, subtitle);
      aiTitles = ai.titles;
      aiBody = ai.body;
      console.log(`✅ AI 文案生成成功（${aiTitles.length} 个标题）`);
    } catch (err) {
      console.error(`⚠️  AI 调用失败：${err.message}\n   降级使用模板版`);
    }
  }
}

const finalTitles = aiTitles && aiTitles.length ? aiTitles : titles;
const finalBody = aiBody || body;

// ── 输出 Markdown ────────────────────────────────
const md = `# 📦 小红书发布素材包 — ${date}

> 直接复制粘贴到小豆芽 / 微小宝 / 小红书 App

## ① 标题（选一个）

${finalTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## ② 正文

\`\`\`
${finalBody}
\`\`\`

## ③ 话题标签

${tags.map(t => `#${t}`).join(' ')}

## ④ 图片（共 ${images.length} 张，按顺序上传）

${images.map((p, i) => `${i + 1}. \`${p}\``).join('\n')}

---
*由 AINewsSkill 自动生成 · 数据来源：data.json*
`;

const txt = `${finalTitles[0]}

${finalBody}

${tags.map(t => `#${t}`).join(' ')}
`;

writeFileSync(join(inputDir, 'xhs-package.md'), md);
writeFileSync(join(inputDir, 'xhs-package.txt'), txt);

console.log(`📦 小红书素材包已生成：`);
console.log(`   📝 ${join(inputDir, 'xhs-package.md')}`);
console.log(`   📋 ${join(inputDir, 'xhs-package.txt')}`);
console.log(`   🖼️  ${images.length} 张图片在 ${imagesDir}`);
console.log(`\n💡 提示：标题/正文已生成 ${finalTitles.length} 个候选，话题 ${tags.length} 个，可直接复制到小豆芽/微小宝${useAI && aiTitles ? '（AI 增强版）' : ''}`);

// ── AI 文案生成 ────────────────────────────────────
async function callAI(apiKey, items, brands, date, subtitle) {
  const BASE_URL = process.env.AI_BASE_URL || 'https://api.deepseek.com';
  const MODEL = process.env.AI_MODEL || 'deepseek-v4-pro';

  const newsList = items.map((it, i) =>
    `${i + 1}. ${it.title}\n   要点: ${it.keyFact || ''}\n   影响: ${it.impact || ''}`
  ).join('\n\n');

  const systemPrompt = `你是个真正在小红书发 AI 内容的普通用户（粉丝几千，不是 KOL），不是"博主"也不是营销号。
你写东西像在跟朋友聊天，会有自己的偏见、抱怨、惊讶、吐槽。

🚫 严禁出现这些 AI 味词汇/句式：
- "风向标"、"加速键"、"风口"、"赛道"、"集体上新"、"齐发力"、"上新"、"惊艳"、"打破"、"刷新"
- "三个词概括"、"一句话总结"、"重点关注"、"值得关注"
- "戳你"、"聊聊"、"评论区告诉我"、"哪条最…"
- "AI风向标"、"今日AI"、"AI日报"等模板化标题
- 整齐排比（"x快了、y稳了、z低了"）
- 6 个 emoji 列表的工整结构

✅ 必须有的真人味：
- 至少 1 个个人偏见或私货观点（比如"我用过XX，其实XXX"、"说真的 XXX 比 YYY 香多了"）
- 至少 1 个具体细节而不是宏大叙述（"100万Token" → "能塞下整本《三体》"）
- 1 个意外的小转折（"看起来牛，但…" / "本来以为没什么，结果…"）
- 故意不工整：长句短句混着写，有的段落 1 行有的 4 行
- 偶尔有"说实话"、"诶"、"emmm"、"哈"这种口语词

输出严格 JSON：
{
  "titles": ["标题1", "标题2", "标题3"],
  "body": "正文 200-300字"
}

标题（3 个不同风格，每个 12-20 字）：
① 反直觉/争议型 — 让人想点："xxx这次更新，我居然有点失望"
② 具体细节型 — 用一个反常识数字或人物视角："1.8B 模型塞进 440MB，能装进手机了"
③ 提问/不确定型 — 像朋友问你："今天 AI 圈这事，你们怎么看？" 但要更具体

❌ 不要带日期数字（除非是新闻里的关键数字）
❌ 不要用感叹号、句号结尾
❌ 不要 emoji 在开头

正文规则：
- 第一段 1-2 行就直接说一个具体的事 / 自己的反应（不要"今天AI圈"开场）
- 中间挑 2-3 条新闻深聊（不是全部列出，是挑你"真觉得有意思的"）
- 用 "→" 或 括号 () 或 "—" 补充信息，少用纯 emoji 列表
- 末段：留一个真正想问的问题（不是"哪条戳你"这种万能句）
- emoji 用 2-4 个就行，不要每段都用`;

  const userPrompt = `今天是 ${date}。
关键厂商：${brands.join('、')}
今日 ${items.length} 条新闻：

${newsList}

请按 system 里的要求，**像一个真实小红书用户**写素材。
不要把所有新闻都讲一遍，挑你真觉得最有意思 / 最有讨论价值的 2-3 条深入聊。
其他用一句话带过或者干脆不提。
记住：宁可少写，不要写废话；宁可有立场，不要四平八稳。`;

  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.95,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed.titles) || !parsed.body) {
    throw new Error('AI 返回格式异常');
  }
  return { titles: parsed.titles, body: parsed.body };
}
