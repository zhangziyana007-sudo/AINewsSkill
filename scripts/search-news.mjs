#!/usr/bin/env node
/**
 * search-news.mjs — 拉取 AI 新闻素材（主：AI HOT；备：Tavily）
 *
 * 主源：AI HOT REST API
 *   - 端点 https://aihot.virxact.com/api/public/items?mode=all&category=ai-models&since=<ISO>
 *   - 默认 24h 窗口，不足 25 条自动回退 48h
 *   - 无需 Token（必须带 User-Agent）
 *
 * 备源：Tavily 搜索 API（仅当 AI HOT 失败时启用）
 *   - 需要 TAVILY_API_KEY
 *
 * 环境变量：
 *   AIHOT_BASE        — AI HOT 接入地址（默认 https://aihot.virxact.com）
 *   AIHOT_CATEGORY    — 分类（默认 ai-models）
 *   AIHOT_SINCE_HOURS — 主时间窗（默认 24 小时）
 *   AIHOT_MIN_COUNT   — 不足该数量时自动回退 48h（默认 25）
 *   AIHOT_USER_AGENT  — UA（默认 AINewsSkill/1.0）
 *   TAVILY_API_KEY    — 备源密钥（缺失则不启用兜底）
 *
 * 用法：
 *   node scripts/search-news.mjs --output=output/ai-daily-0520/search-results.json
 *
 * 输出 JSON 格式（与下游 generate.mjs 兼容）：
 *   { searchDate, source, queries, totalResults,
 *     results: [{title, url, content, score, source, publishedAt, category}...] }
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

// ── 参数解析 ─────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, v] = a.slice(2).split('=');
      return [k, v || 'true'];
    })
);

const outputPath = resolve(args.output || './output/search-results.json');

// ── AI HOT 配置 ──────────────────────────────────
const AIHOT_BASE = process.env.AIHOT_BASE || 'https://aihot.virxact.com';
const AIHOT_CATEGORY = process.env.AIHOT_CATEGORY || 'ai-models';
const AIHOT_SINCE_HOURS = Number(process.env.AIHOT_SINCE_HOURS || 24);
const AIHOT_MIN_COUNT = Number(process.env.AIHOT_MIN_COUNT || 25);
const AIHOT_UA = process.env.AIHOT_USER_AGENT || 'AINewsSkill/1.0';

function isoNHoursAgo(hours) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

async function fetchAiHot(sinceHours) {
  const sinceIso = isoNHoursAgo(sinceHours);
  const url = `${AIHOT_BASE}/api/public/items?mode=all&category=${encodeURIComponent(AIHOT_CATEGORY)}&since=${encodeURIComponent(sinceIso)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': AIHOT_UA,
      'Accept': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`AI HOT API ${res.status}: ${await res.text().catch(() => '')}`);
  }
  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  // 统一映射成 generate.mjs 期望的格式
  return items.map((it, idx) => ({
    title: it.title || it.title_en || '',
    url: it.url || '',
    content: it.summary || '',
    score: 1 - idx / Math.max(items.length, 1), // 按返回顺序近似为得分
    source: it.source || '',
    publishedAt: it.publishedAt || '',
    category: it.category || AIHOT_CATEGORY,
  }));
}

// ── Tavily 兜底 ──────────────────────────────────
const TAVILY_QUERIES = [
  'AI大模型 最新新闻 今日',
  'OpenAI Google Anthropic latest AI news today',
];

async function tavilySearch(query) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error('未配置 TAVILY_API_KEY，无法启用 Tavily 兜底');
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: 'basic',
      max_results: 10,
      include_answer: false,
      include_raw_content: false,
    }),
  });
  if (!res.ok) throw new Error(`Tavily API ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json();
}

async function fetchTavilyAll() {
  const all = [];
  for (const q of TAVILY_QUERIES) {
    try {
      const data = await tavilySearch(q);
      const rs = (data.results || []).map(r => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score,
        source: '',
        publishedAt: '',
        category: '',
      }));
      all.push(...rs);
      console.log(`   [Tavily] "${q}" → ${rs.length} 条`);
    } catch (err) {
      console.warn(`   [Tavily] ⚠️ ${q} 失败: ${err.message}`);
    }
  }
  return all;
}

// ── 主流程 ───────────────────────────────────────
console.log('🔍 拉取今日 AI 新闻素材...\n');

let results = [];
let sourceUsed = 'aihot';
let queries = [];

try {
  console.log(`   [AI HOT] mode=all category=${AIHOT_CATEGORY} since=${AIHOT_SINCE_HOURS}h`);
  results = await fetchAiHot(AIHOT_SINCE_HOURS);
  console.log(`   → ${results.length} 条`);

  if (results.length < AIHOT_MIN_COUNT) {
    console.log(`   ⚠️ 不足 ${AIHOT_MIN_COUNT} 条，回退 48h 窗口`);
    const wider = await fetchAiHot(48);
    if (wider.length > results.length) {
      results = wider;
      console.log(`   → 扩展后 ${results.length} 条`);
    }
  }
  queries = [`AI HOT mode=all&category=${AIHOT_CATEGORY}&since=${AIHOT_SINCE_HOURS}h`];
} catch (err) {
  console.warn(`   ❌ AI HOT 失败: ${err.message}`);
  console.log(`   🔁 尝试 Tavily 兜底...`);
  try {
    results = await fetchTavilyAll();
    sourceUsed = 'tavily';
    queries = TAVILY_QUERIES;
  } catch (err2) {
    console.error(`   ❌ Tavily 也失败: ${err2.message}`);
  }
}

if (results.length === 0) {
  console.error('\n❌ 所有信源都失败或无数据，已退出');
  process.exit(1);
}

// 去重（按 URL）
const seen = new Set();
const deduped = results.filter(r => {
  if (!r.url || seen.has(r.url)) return false;
  seen.add(r.url);
  return true;
});

// 排序：AI HOT 已经按时间排好，保持；Tavily 按 score
if (sourceUsed === 'tavily') {
  deduped.sort((a, b) => (b.score || 0) - (a.score || 0));
}

// 写入文件
const output = {
  searchDate: new Date().toISOString().slice(0, 10),
  source: sourceUsed,
  queries,
  totalResults: deduped.length,
  results: deduped,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

console.log(`\n✅ 拉取完成（信源: ${sourceUsed}）！共 ${deduped.length} 条去重结果`);
console.log(`   输出: ${outputPath}`);
