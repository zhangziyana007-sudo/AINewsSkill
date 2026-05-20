#!/usr/bin/env node
/**
 * search-news.mjs — 使用 Tavily API 搜索今日 AI 新闻
 *
 * 环境变量：
 *   TAVILY_API_KEY — Tavily 搜索 API 密钥（必需）
 *
 * 用法：
 *   node scripts/search-news.mjs --output=output/ai-daily-0520/search-results.json
 *
 * 输出 JSON 格式：
 *   { "query": "...", "results": [{title, url, content, score}...] }
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const API_KEY = process.env.TAVILY_API_KEY;
if (!API_KEY) {
  console.error('❌ 缺少 TAVILY_API_KEY 环境变量');
  console.error('   export TAVILY_API_KEY="tvly-xxx"');
  process.exit(1);
}

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

// ── 搜索关键词 ─────────────────────────────────────
const QUERIES = [
  'AI大模型 最新新闻 今日',
  'OpenAI Google Anthropic latest AI news today',
];

// ── Tavily 搜索 ─────────────────────────────────────
async function tavilySearch(query) {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: API_KEY,
      query,
      search_depth: 'basic',
      max_results: 10,
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Tavily API 错误 (${response.status}): ${errText}`);
  }

  return response.json();
}

// ── 执行搜索 ─────────────────────────────────────
console.log('🔍 联网搜索今日AI新闻...\n');

const allResults = [];

for (const query of QUERIES) {
  console.log(`   搜索: "${query}"`);
  try {
    const data = await tavilySearch(query);
    const results = (data.results || []).map(r => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
    }));
    allResults.push(...results);
    console.log(`   → 获取 ${results.length} 条结果`);
  } catch (err) {
    console.warn(`   ⚠️ 搜索失败: ${err.message}`);
  }
}

// 去重（按 URL）
const seen = new Set();
const dedupedResults = allResults.filter(r => {
  if (seen.has(r.url)) return false;
  seen.add(r.url);
  return true;
});

// 按 score 排序
dedupedResults.sort((a, b) => (b.score || 0) - (a.score || 0));

// 写入文件
const output = {
  searchDate: new Date().toISOString().slice(0, 10),
  queries: QUERIES,
  totalResults: dedupedResults.length,
  results: dedupedResults,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

console.log(`\n✅ 搜索完成！共 ${dedupedResults.length} 条去重结果`);
console.log(`   输出: ${outputPath}`);
