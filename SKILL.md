---
name: ai-news-daily
description: 每日AI大模型早报（Top 10）— 联网搜索 → 结构化JSON → 渲染截图
version: 8.0.0
author: zizaya
license: MIT
platforms: [linux, macos]
prerequisites:
  commands: [node, ainews]
  packages: [playwright]
metadata:
  hermes:
    tags: [小红书, XHS, AI早报, 大模型, 新闻, 自动化]
    category: social-media
---

# 每日AI大模型早报（Top 10）

> 一条命令完成全流程：联网搜索 → AI结构化 → 渲染出图。

---

## 快速执行（推荐）

```bash
cd /home/ts/AINewsSkill && export TAVILY_API_KEY="tvly-xxx" && export DEEPSEEK_API_KEY="sk-xxx" && ainews run --force
```

**全自动流程**：
1. Tavily 联网搜索今日 AI 新闻（自动触发，有 `TAVILY_API_KEY` 即启用）
2. DeepSeek 从搜索结果中精选 Top 10 并结构化为 JSON
3. 渲染 HTML → Playwright 截图 → 3 张 1800×2400px PNG

**结果**：`output/ai-daily-{MMDD}/images/` 下生成 3 张图片，可直接发布小红书。

---

## 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API 密钥 |
| `TAVILY_API_KEY` | 可选 | Tavily 搜索 API 密钥（有则联网搜索真实新闻） |
| `AI_BASE_URL` | 可选 | 自定义 LLM API 地址（默认 https://api.deepseek.com） |
| `AI_MODEL` | 可选 | 模型名（默认 deepseek-chat） |

---

## 分步执行（高级）

### STEP 1 · 联网搜索

```bash
cd /home/ts/AINewsSkill && node scripts/search-news.mjs --output=./output/ai-daily-{MMDD}/search-results.json
```

### STEP 2 · AI 结构化生成

```bash
cd /home/ts/AINewsSkill && node scripts/generate.mjs --output=./output/ai-daily-{MMDD}/data.json --context=./output/ai-daily-{MMDD}/search-results.json
```

### STEP 3 · 渲染出图

```bash
cd /home/ts/AINewsSkill && node scripts/pipeline.mjs --input=./output/ai-daily-{MMDD}/data.json --project=ai-daily-{MMDD}
```

---

## 无联网模式

没有 `TAVILY_API_KEY` 时，pipeline 跳过搜索步骤，直接使用模型知识生成：

```bash
cd /home/ts/AINewsSkill && ainews run --force
```

---

## 约束清单

- ❌ 不输出 HTML / CSS / 任何渲染代码
- ❌ 不讨论排版、字体、配色选择
- ❌ 不在内容中添加 emoji
- ❌ 不修改模板文件或脚本代码
- ✅ 只执行命令，告知用户图片路径
