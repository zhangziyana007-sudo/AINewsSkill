#!/usr/bin/env node
/**
 * generate.mjs — AI 新闻结构化生成器
 *
 * 调用 DeepSeek API → 输出 data.json
 * 可选接收搜索结果作为上下文（--context=search-results.json）
 *
 * 环境变量：
 *   DEEPSEEK_API_KEY  — DeepSeek API 密钥（必需）
 *   AI_BASE_URL       — 自定义 API 地址（默认 https://api.deepseek.com）
 *   AI_MODEL          — 模型名称（默认 deepseek-chat）
 *
 * 用法：
 *   node scripts/generate.mjs --output=output/ai-daily-0520/data.json
 *   node scripts/generate.mjs --output=output/ai-daily-0520/data.json --context=output/ai-daily-0520/search-results.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';

// ── 配置 ─────────────────────────────────────
const API_KEY = process.env.DEEPSEEK_API_KEY || process.env.AI_API_KEY;
const BASE_URL = process.env.AI_BASE_URL || 'https://api.deepseek.com';
const MODEL = process.env.AI_MODEL || 'deepseek-chat';

if (!API_KEY) {
  console.error('❌ 缺少 API 密钥，请设置环境变量：');
  console.error('   export DEEPSEEK_API_KEY="sk-xxx"');
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

const outputPath = resolve(args.output || './output/data.json');
const contextPath = args.context ? resolve(args.context) : null;

// 加载搜索上下文（如果提供）
let searchContext = '';
if (contextPath && existsSync(contextPath)) {
  const searchData = JSON.parse(readFileSync(contextPath, 'utf-8'));
  const items = (searchData.results || []).slice(0, 15);
  searchContext = items.map((r, i) => `[${i + 1}] ${r.title}\n    ${r.content?.slice(0, 200) || ''}\n    来源: ${r.url}`).join('\n\n');
  console.log(`📰 已加载 ${items.length} 条搜索结果作为上下文\n`);
}

console.log(`🤖 调用 ${MODEL} 生成今日AI早报...\n`);

// ── 构建 Prompt ─────────────────────────────────────
const today = new Date();
const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
const issueStr = `#${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

const systemPrompt = `你是一位资深AI大模型行业分析师，负责制作"每日AI大模型早报（Top 10）"小红书图文。

## 推送要求
- 条数：必须精确输出10条，不能多也不能少
- 筛选：仅保留影响力最大、确定性高的核心动态，剔除传闻和琐碎更新

## 内容偏好
- 核心关注：国内外主流AI公司的大模型版本更新与API/订阅价格变动
- 重点监控厂商：
  - 国际：OpenAI (GPT系列)、Google (Gemini系列)、Microsoft (Copilot)、Anthropic (Claude系列)、Meta (Llama系列)、xAI (Grok系列)
  - 国内：DeepSeek、智谱AI (GLM)、月之暗面 (Kimi)、阿里巴巴 (通义千问)、百度 (文心一言)、字节跳动 (豆包)、腾讯 (混元)、小米 (MiMo)

## 信息卡片格式（每条新闻固定结构）
- title：【厂商】+ 核心动作（不超过20字）
  例：【Google】发布 Gemini 3.5 Flash 并调整API价格
- keyFact：用一句话或数据点陈述最核心的变化
  例：新模型推理速度提升4倍，API成本较前代降低50%；新增$100/月套餐。
- impact：简短评语，点明该事件对行业、竞争对手、开发者或用户的潜在影响
  例：价格战加剧，中小模型厂商压力增大；为高并发应用提供了高性价比选择。
- category / source：填写新闻实际来源网站名（如 TechCrunch、量子位、36氪、The Verge 等，≤6字）

## 输出要求
严格输出以下JSON格式（不要输出markdown代码块，不要输出其他任何内容）：

{
  "date": "${dateStr}",
  "issue": "${issueStr}",
  "pages": [
    {
      "type": "cover",
      "title": ["${dateStr}", "AI早报"],
      "subtitle": "三个关键词 · 用中间点分隔",
      "previews": [
        {"rank": 1, "title": "【厂商】核心动作", "source": "来源", "icon": "zap"},
        {"rank": 2, "title": "【厂商】核心动作", "source": "来源", "icon": "cpu"},
        {"rank": 3, "title": "【厂商】核心动作", "source": "来源", "icon": "rocket"},
        {"rank": 4, "title": "【厂商】核心动作", "source": "来源", "icon": "brain"}
      ]
    },
    {
      "type": "news",
      "items": [
        {"title": "【厂商】核心动作", "keyFact": "关键事实一句话", "impact": "影响分析一句话", "category": "来源", "icon": "zap"},
        {"title": "【厂商】核心动作", "keyFact": "关键事实一句话", "impact": "影响分析一句话", "category": "来源", "icon": "cpu"},
        {"title": "【厂商】核心动作", "keyFact": "关键事实一句话", "impact": "影响分析一句话", "category": "来源", "icon": "rocket"},
        {"title": "【厂商】核心动作", "keyFact": "关键事实一句话", "impact": "影响分析一句话", "category": "来源", "icon": "brain"},
        {"title": "【厂商】核心动作", "keyFact": "关键事实一句话", "impact": "影响分析一句话", "category": "来源", "icon": "sparkles"}
      ]
    },
    {
      "type": "news",
      "items": [
        {"title": "【厂商】核心动作", "keyFact": "关键事实一句话", "impact": "影响分析一句话", "category": "来源", "icon": "globe"},
        {"title": "【厂商】核心动作", "keyFact": "关键事实一句话", "impact": "影响分析一句话", "category": "来源", "icon": "code"},
        {"title": "【厂商】核心动作", "keyFact": "关键事实一句话", "impact": "影响分析一句话", "category": "来源", "icon": "robot"},
        {"title": "【厂商】核心动作", "keyFact": "关键事实一句话", "impact": "影响分析一句话", "category": "来源", "icon": "zap"},
        {"title": "【厂商】核心动作", "keyFact": "关键事实一句话", "impact": "影响分析一句话", "category": "来源", "icon": "cpu"}
      ]
    },
    {
      "type": "ending",
      "slogan": "AI大模型早报 · 每日精选Top 10",
      "cta": "关注获取每日推送",
      "meta": "数据来源：公开报道与行业资讯"
    }
  ]
}

关键约束：
- previews 固定4条（封面展示的前4条摘要）
- news 第1页5条 + 第2页5条 = 必须总共10条
- icon 可选：zap, cpu, robot, code, sparkles, globe, rocket, brain
- 如果素材中AI大模型新闻不足10条，可包含AI应用、AI芯片、AI融资、AI政策等相关动态补足
- title 不超过20字，keyFact 不超过50字，impact 不超过30字`;

const userPrompt = searchContext
  ? `以下是今日（${dateStr}）通过联网搜索获取的AI行业新闻素材：\n\n${searchContext}\n\n请基于以上素材，精选最重要的10条，生成今日AI早报。严格输出 system prompt 中定义的JSON格式。`
  : `请根据你所知道的最新AI大模型行业动态，生成今日（${dateStr}）的AI早报Top 10。要求输出严格符合 system prompt 中定义的JSON格式。`;

// ── 调用 API ─────────────────────────────────────
async function callAI() {
  const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API 请求失败 (${response.status}): ${errText}`);
  }

  const result = await response.json();
  return result.choices[0].message.content;
}

try {
  const aiOutput = await callAI();

  // 提取 JSON（AI 可能包裹在 ```json ... ``` 中）
  let jsonStr = aiOutput;
  const jsonMatch = aiOutput.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  // 验证 JSON 格式
  const data = JSON.parse(jsonStr);

  // 基本校验
  if (!data.pages || !Array.isArray(data.pages)) {
    throw new Error('JSON 格式错误：缺少 pages 数组');
  }
  const cover = data.pages.find(p => p.type === 'cover');
  if (!cover || !cover.previews) {
    throw new Error('JSON 格式错误：缺少 cover 页面或 previews');
  }

  // 写入文件
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');

  const newsCount = data.pages
    .filter(p => p.type === 'news')
    .reduce((sum, p) => sum + (p.items?.length || 0), 0);

  console.log(`✅ 生成完成！`);
  console.log(`   精选新闻: ${newsCount} 条`);
  console.log(`   封面预览: ${cover.previews.length} 条`);
  console.log(`   输出文件: ${outputPath}`);
} catch (err) {
  console.error(`❌ 生成失败: ${err.message}`);
  process.exit(1);
}
