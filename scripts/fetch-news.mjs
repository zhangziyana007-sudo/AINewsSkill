#!/usr/bin/env node
/**
 * AI 新闻自动获取脚本
 * 从多个 RSS 源抓取最新 AI 相关新闻
 * 零依赖，使用 Node.js 原生 fetch
 *
 * 用法：
 *   node scripts/fetch-news.mjs
 *   node scripts/fetch-news.mjs --limit=20
 *   node scripts/fetch-news.mjs --output=./output/raw-news.md
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// ────────────────────────────────────────────
// RSS 源配置
// ────────────────────────────────────────────
// 关键词聚焦：AI大模型 + AI工具
const AI_KEYWORDS_ZH = [
  '大模型', 'LLM', 'GPT', 'Claude', 'Gemini', 'Qwen', '通义', '文心', '豆包',
  'Agent', '智能体', 'Copilot', 'ChatGPT', 'AI助手', 'AI工具',
  'OpenAI', 'Anthropic', 'Google AI', 'DeepSeek', '零一万物', '月之暗面', 'Kimi',
  '阶跃', 'MiniMax', '百川', '智谱',
  'Transformer', '推理', '微调', 'RAG', '向量', 'token',
  'Sora', 'Midjourney', 'Stable Diffusion', 'AI生成', 'AIGC',
  'AI编程', 'AI代码', 'Cursor', 'Windsurf', 'Devin',
  '具身智能', '人形机器人', '算力', '芯片', 'GPU', 'NVIDIA', '英伟达',
];
const AI_KEYWORDS_EN = [
  'LLM', 'GPT', 'Claude', 'Gemini', 'large language model',
  'AI agent', 'AI tool', 'Copilot', 'ChatGPT',
  'OpenAI', 'Anthropic', 'DeepSeek',
  'transformer', 'fine-tuning', 'RAG', 'inference',
  'Sora', 'Midjourney', 'AI coding', 'Cursor',
  'humanoid robot', 'embodied AI', 'NVIDIA', 'GPU',
  'generative AI', 'foundation model', 'multimodal',
];

const RSS_SOURCES = [
  // 中文源
  {
    name: '36氪快讯',
    url: 'https://rsshub.ktachibana.party/36kr/newsflashes',
    lang: 'zh',
    keywords: AI_KEYWORDS_ZH,
  },
  {
    name: '雷峰网AI',
    url: 'https://rsshub.ktachibana.party/leiphone/category/ai',
    lang: 'zh',
    keywords: AI_KEYWORDS_ZH,
  },
  {
    name: 'IT之家AI',
    url: 'https://rsshub.ktachibana.party/ithome/tag/AI',
    lang: 'zh',
    keywords: AI_KEYWORDS_ZH,
  },
  {
    name: 'AI前线',
    url: 'https://rsshub.ktachibana.party/infoq/recommend',
    lang: 'zh',
    keywords: AI_KEYWORDS_ZH,
  },
  // 英文源
  {
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    lang: 'en',
    keywords: AI_KEYWORDS_EN,
  },
  {
    name: 'The Verge AI',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    lang: 'en',
    keywords: AI_KEYWORDS_EN,
  },
  {
    name: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/technology-lab',
    lang: 'en',
    keywords: AI_KEYWORDS_EN,
  },
];

// RSSHub 镜像（按可用性排序，失败时自动切换下一个）
const RSSHUB_MIRRORS = [
  'https://rsshub.ktachibana.party',
  'https://hub.slarker.me',
  'https://rsshub.app',
  'https://rsshub.rssforever.com',
];

// ────────────────────────────────────────────
// 参数解析
// ────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, v] = a.slice(2).split('=');
      return [k, v || 'true'];
    })
);

const LIMIT = parseInt(args.limit || '10', 10);
const OUTPUT_PATH = args.output || `./output/raw-news-${formatDate(new Date())}.md`;
const TIMEOUT_MS = 6000;

// ────────────────────────────────────────────
// 工具函数
// ────────────────────────────────────────────
function formatDate(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function stripHtml(html) {
  if (!html) return '';
  // 先解码 HTML 实体（处理双重编码的情况）
  let text = html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  // 再清除所有 HTML 标签
  text = text
    .replace(/<img[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

function extractItems(xml) {
  const items = [];
  // 匹配 <item> 或 <entry>（Atom 格式）
  const itemRegex = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const title = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || '';
    // 支持 description / summary / content / content:encoded
    const desc = block.match(/<(?:description|summary|content:encoded|content)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary|content:encoded|content)>/i)?.[1]?.trim() || '';
    const link = block.match(/<link[^>]*href="([^"]+)"/i)?.[1]
      || block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() || '';
    const pubDate = block.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/i)?.[1]?.trim() || '';

    if (title) {
      items.push({
        title: stripHtml(title),
        description: stripHtml(desc).slice(0, 300),
        link: link.trim(),
        date: pubDate ? new Date(pubDate) : null,
      });
    }
  }
  return items;
}

function matchesKeywords(text, keywords) {
  if (!keywords) return true;
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k.toLowerCase()));
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AINewsSkill/1.0 (RSS Reader)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ────────────────────────────────────────────
// 主流程
// ────────────────────────────────────────────
async function fetchSource(source) {
  const urls = [source.url];

  // 如果是 RSSHub 源，添加所有镜像作为备选
  const rsshubDomain = RSSHUB_MIRRORS.find(m => source.url.includes(new URL(m).hostname));
  if (rsshubDomain) {
    const path = source.url.replace(rsshubDomain, '');
    for (const mirror of RSSHUB_MIRRORS) {
      if (mirror !== rsshubDomain) {
        urls.push(mirror + path);
      }
    }
  }

  for (const url of urls) {
    try {
      const xml = await fetchWithTimeout(url, TIMEOUT_MS);
      const items = extractItems(xml);

      // 按关键词过滤
      const filtered = items.filter(item =>
        matchesKeywords(item.title + ' ' + item.description, source.keywords)
      );

      return {
        source: source.name,
        lang: source.lang,
        items: filtered,
      };
    } catch (err) {
      // 尝试下一个镜像
      continue;
    }
  }

  console.warn(`  ⚠ ${source.name}：所有源均失败`);
  return { source: source.name, lang: source.lang, items: [] };
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  AI 新闻获取工具');
  console.log('═══════════════════════════════════════\n');

  // 并行抓取所有源
  console.log(`▶ 正在抓取 ${RSS_SOURCES.length} 个 RSS 源...\n`);
  const results = await Promise.all(RSS_SOURCES.map(fetchSource));

  // 汇总
  let allItems = [];
  for (const r of results) {
    const count = r.items.length;
    const icon = count > 0 ? '✓' : '✗';
    console.log(`  ${icon} ${r.source}：${count} 条`);
    allItems.push(...r.items.map(item => ({ ...item, source: r.source, lang: r.lang })));
  }

  // 去重（按标题相似度）
  const seen = new Set();
  allItems = allItems.filter(item => {
    const key = item.title.slice(0, 20).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 按时间排序（最新在前）
  allItems.sort((a, b) => {
    if (a.date && b.date) return b.date - a.date;
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  });

  // 只取前 N 条
  const topItems = allItems.slice(0, LIMIT);

  console.log(`\n📊 共获取 ${allItems.length} 条，精选 ${topItems.length} 条\n`);

  // 输出为 Markdown 格式（作为 AI 输入素材）
  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

  let md = `# AI 新闻素材 — ${dateStr}\n\n`;
  md += `> 自动获取于 ${today.toLocaleString('zh-CN')}，共 ${topItems.length} 条\n\n`;
  md += `---\n\n`;

  topItems.forEach((item, i) => {
    md += `## ${i + 1}. ${item.title}\n\n`;
    if (item.description) {
      md += `${item.description}\n\n`;
    }
    md += `- 来源：${item.source}\n`;
    if (item.link) md += `- 链接：${item.link}\n`;
    if (item.date) md += `- 时间：${item.date.toLocaleDateString('zh-CN')}\n`;
    md += `\n---\n\n`;
  });

  // 保存文件
  const outputDir = dirname(OUTPUT_PATH);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(OUTPUT_PATH, md, 'utf-8');

  console.log(`✅ 素材已保存: ${OUTPUT_PATH}`);
  console.log(`\n💡 下一步：将此文件内容交给 AI（使用 xhs-ai-daily skill）生成 data.json`);
  console.log(`   示例：hermes chat "根据以下素材生成AI日报" --skill xhs-ai-daily --file ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error('❌ 获取失败:', err.message);
  process.exit(1);
});
