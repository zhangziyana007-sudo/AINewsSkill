#!/usr/bin/env node
/**
 * generate.mjs — AI 新闻结构化生成器
 *
 * 读取 raw-news.md → 调用 DeepSeek API → 输出 data.json
 *
 * 环境变量：
 *   DEEPSEEK_API_KEY  — DeepSeek API 密钥（必需）
 *   AI_BASE_URL       — 自定义 API 地址（默认 https://api.deepseek.com）
 *   AI_MODEL          — 模型名称（默认 deepseek-chat）
 *
 * 用法：
 *   node scripts/generate.mjs --input=output/raw-news.md --output=output/ai-daily-0520/data.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

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

const inputPath = resolve(args.input || './output/raw-news.md');
const outputPath = resolve(args.output || './output/data.json');

// ── 读取素材 ─────────────────────────────────────
let rawNews;
try {
  rawNews = readFileSync(inputPath, 'utf-8');
} catch (e) {
  console.error(`❌ 无法读取素材文件: ${inputPath}`);
  process.exit(1);
}

console.log(`📖 读取素材: ${inputPath}`);
console.log(`🤖 调用 ${MODEL} 生成结构化数据...\n`);

// ── 构建 Prompt ─────────────────────────────────────
const today = new Date();
const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
const issueStr = `#${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

const systemPrompt = `你是一位资深AI大模型行业分析师，负责制作"每日AI大模型早报"小红书图文。

## 筛选标准
- 仅保留影响力最大、确定性高的核心动态，剔除传闻和琐碎更新
- 核心关注：国内外主流AI公司的大模型版本更新与API/订阅价格变动
- 重点监控厂商：
  - 国际：OpenAI (GPT系列)、Google (Gemini系列)、Microsoft (Copilot)、Anthropic (Claude系列)、Meta (Llama系列)、xAI (Grok系列)
  - 国内：DeepSeek、智谱AI (GLM)、月之暗面 (Kimi)、阿里巴巴 (通义千问)、百度 (文心一言)、字节跳动 (豆包)、腾讯 (混元)、小米 (MiMo)

## 每条新闻格式
- title：【厂商】+ 核心动作（不超过25字）
- keyFact：一句话或数据点陈述最核心的变化
- impact：简短评语，点明对行业/开发者/用户的潜在影响

## 输出要求
从素材中精选10条最重要的动态，严格输出以下JSON格式（不要输出其他任何内容）：

{
  "date": "${dateStr}",
  "issue": "${issueStr}",
  "pages": [
    {
      "type": "cover",
      "title": ["${dateStr}", "AI日报"],
      "subtitle": "三个关键词概括 · 用中间点分隔",
      "previews": [
        {"rank": 1, "title": "【厂商】核心动作", "source": "来源", "icon": "zap"},
        {"rank": 2, "title": "【厂商】核心动作", "source": "来源", "icon": "cpu"}
      ]
    },
    {
      "type": "news",
      "items": [
        {
          "title": "【厂商】核心动作",
          "keyFact": "一句话关键事实",
          "impact": "一句话影响分析",
          "category": "来源",
          "icon": "zap"
        }
      ]
    },
    {
      "type": "ending",
      "slogan": "让 AI 赋能每一天",
      "cta": "关注获取每日推送",
      "meta": "AI Daily · 每日精选"
    }
  ]
}

注意：
- previews 放封面上展示的精简标题（最多显示5条）
- news items 每页最多4条（因为每条有3行内容），超过4条请分成多个 news 页面
- icon 可选：zap, cpu, robot, code, sparkles, globe, rocket, brain
- 如果素材中没有足够的AI大模型相关新闻，可以包含AI应用、AI芯片、AI融资等相关动态补足10条`;

const userPrompt = `以下是今天获取的AI新闻素材，请精选6-10条最有价值的，生成结构化JSON：

${rawNews}`;

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
