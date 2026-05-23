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

  const systemPrompt = `你是一位资深小红书博主，专注 AI 科技领域，粉丝 10W+。
你的文风：真诚、有温度、不假大空、不用过于营销的词。
善用 emoji 但不滥用（每段 1-2 个），多用短句和换行，让阅读节奏轻快。

请输出严格 JSON 格式：
{
  "titles": ["标题1", "标题2", "标题3"],
  "body": "正文内容，250-350字"
}

标题规则：
- 3 个不同风格：① 信息量大爆款型 ② 提问悬念型 ③ 真诚分享型
- 每个 15-22 字，含 1-2 个 emoji，主体在前 emoji 在后
- 包含日期或关键厂商名（提升搜索权重）
- ❌ 不要 "速看"、"必看"、"震惊"、"最强" 等被算法打压的词
- ❌ 不要用感叹号开头

正文规则：
- 第一段：1-2 句钩子，说为什么今天值得看
- 中段：用 emoji 列表点出 3-5 个最值得关注的点，每点 1 行
- 结尾：1 句真诚分享 + 1 句互动引导
- 全文 250-350 字，分 4-6 段，每段 1-3 行
- 用"咱们"、"我"等亲切人称，不要"各位"、"大家好"
- 不要硬广，不要"关注我"在中间，结尾自然引导即可`;

  const userPrompt = `今天是 ${date}，子标题"${subtitle}"。
关键厂商：${brands.join('、')}
今日 ${items.length} 条新闻摘要：

${newsList}

请生成小红书发布素材（标题 3 个 + 正文）。`;

  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
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
