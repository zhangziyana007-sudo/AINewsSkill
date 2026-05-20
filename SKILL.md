---
name: ai-news-daily
description: AI 日报小红书图文自动化 — RSS获取+AI结构化+渲染截图完整流水线
version: 3.1.0
author: zizaya
license: MIT
platforms: [linux, macos]
prerequisites:
  commands: [node]
  packages: [playwright]
metadata:
  hermes:
    tags: [小红书, XHS, AI日报, 新闻, 自动化, RSS]
    category: social-media
    config:
      project_dir: AINewsSkill 项目根目录路径
---

# AI 日报 · 小红书图文自动化

> 黑底终端风 + 荧光绿强调色 + Orbitron/得意黑科技字体。适合：AI/科技新闻日报。

---

## 使用方式

提供素材（或让脚本自动获取），自动执行：
1. `ainews fetch` → 获取素材到 `output/raw-news.md`
2. AI 结构化处理 → `output/{topic}/data.json`（暂停确认）
3. `ainews render` → 渲染出图到 `output/{topic}/images/*.png`

---

## 阶段① · 获取新闻素材

### 方式 A：CLI 自动获取（推荐）

```bash
ainews fetch --limit=10
```

支持 7 个新闻源：36氪、机器之心、量子位、InfoQ、TechCrunch、The Verge、Ars Technica。
自动聚合去重，输出到 `output/raw-news.md`。

### 方式 B：用户手动提供

接受任意格式：文字新闻、多条摘要、文章内容、口述信息。

---

## 阶段② · AI 结构化（核心任务）

阅读素材 → 输出结构化 JSON 到 `output/{topic}/data.json`。

`{topic}` 命名：`ai-daily-MMDD`（如 `ai-daily-0521`）

### JSON 格式

```json
{
  "topic": "ai-daily-0521",
  "date": "2025.05.21",
  "issue": "#202505",
  "pages": [
    {
      "type": "cover",
      "title": ["2025.05.21", "AI日报"],
      "subtitle": "≤20字总结",
      "previews": [
        { "rank": 1, "title": "≤18字", "source": "≤6字", "icon": "brain" }
      ]
    },
    {
      "type": "news",
      "items": [
        {
          "rank": 1,
          "category": "2-4字标签",
          "title": "≤15字标题",
          "summary": "≤40字摘要",
          "points": ["≤20字要点"]
        }
      ]
    },
    {
      "type": "ending",
      "slogan": "≤20字结束语",
      "cta": "≤10字号召",
      "meta": ""
    }
  ]
}
```

### 字段约束

**封面 cover**：
- `title[0]`：日期 `YYYY.MM.DD`（Orbitron 字体）
- `title[1]`：固定 `"AI日报"`（得意黑字体）
- `previews`：**必须包含全部新闻**，与 news items 一一对应

**新闻 news**：
- `category`：2-4 字（大模型/硬件/融资/开源…）
- `title`：≤ 15 字，动词开头或名词短语
- `summary`：≤ 40 字，一句话讲清"谁做了什么"
- `points`：0-3 条，每条 ≤ 20 字

**可用 icon**：`brain` / `code` / `sparkles` / `monitor` / `smartphone` / `zap` / `globe` / `cpu` / `robot` / `rocket` / `star`

### 数量指南

| 素材量 | 方案 |
|--------|------|
| 3-5 条 | 全部收录，3-4 张图 |
| 6-8 条 | 全部收录，4-5 张图 |
| 9-12 条 | 全部收录，5-6 张图 |
| 12+ 条 | 精选 Top 10 |

---

## 阶段③ · 渲染出图

JSON 确认后执行：

```bash
ainews render --input=./output/{topic}/data.json
```

自动完成：JSON → HTML → PNG（1800×2400px @2x）

产出：`output/{topic}/images/*.png`

---

## 安装

```bash
git clone https://github.com/zhangziyana007-sudo/AINewsSkill.git
cd AINewsSkill
npm install
npx playwright install chromium
npm link   # 注册全局 ainews 命令

# 字体准备（放入 fonts/ 目录）
mkdir -p fonts
# 下载 SmileySans-Oblique.ttf：https://github.com/atelier-anchor/smiley-sans/releases
# 下载 Orbitron-Bold.ttf：https://fonts.google.com/specimen/Orbitron
```

---

## 项目结构

```
AINewsSkill/
├── SKILL.md                    ← 本文件（AI 技能指南）
├── package.json                ← npm 配置 + bin 注册
├── bin/ainews.mjs              ← CLI 入口（ainews 命令）
├── scripts/
│   ├── fetch-news.mjs          ← RSS 新闻获取（7源）
│   ├── render.mjs              ← JSON → HTML
│   ├── pipeline.mjs            ← 渲染+截图管线
│   └── screenshot.mjs          ← HTML → PNG
├── templates/ai-daily/
│   ├── cover.html / news.html / ending.html
│   └── styles.css
├── fonts/                      ← 本地字体（不提交）
└── output/                     ← 产出（不提交）
```

---

## 约束

- ❌ 不输出 HTML/CSS/渲染代码
- ❌ 不讨论排版/字体/颜色
- ❌ 不添加 emoji
- ❌ 标题 ≤ 15 字，摘要 ≤ 40 字，要点 ≤ 20 字
- ❌ 不遗漏任何新闻的封面预览

---

## 完整示例

```json
{
  "topic": "ai-daily-0521",
  "date": "2025.05.21",
  "issue": "#202505",
  "pages": [
    {
      "type": "cover",
      "title": ["2025.05.21", "AI日报"],
      "subtitle": "一分钟速览全球 AI 动态",
      "previews": [
        { "rank": 1, "title": "Karpathy 官宣加入 Anthropic", "source": "Anthropic", "icon": "brain" },
        { "rank": 2, "title": "Google I/O 发布 Gemini 3.5", "source": "Google", "icon": "sparkles" },
        { "rank": 3, "title": "H200 涨价 30% 算力告急", "source": "NVIDIA", "icon": "cpu" }
      ]
    },
    {
      "type": "news",
      "items": [
        {
          "rank": 1,
          "category": "人才",
          "title": "Karpathy 加入 Anthropic",
          "summary": "OpenAI 联合创始人正式宣布加入 Anthropic，震动整个 AI 圈。",
          "points": ["OpenAI 前核心研究员正式官宣", "华尔街看不懂大模型但看得懂人"]
        },
        {
          "rank": 2,
          "category": "Google",
          "title": "I/O 大会发布 Gemini 3.5",
          "summary": "搜索框变身智能体，Agent 产品全线上线，重塑搜索体验。",
          "points": ["搜索框变智能体，重塑 50 亿人上网方式", "Agent 产品全线上线"]
        },
        {
          "rank": 3,
          "category": "算力",
          "title": "硅谷深陷算力荒",
          "summary": "H200 一夜涨价 30%，H100 全球抢购一空，研究员为算力卡离职。",
          "points": ["H200 一夜涨价 30%，H100 抢到缺货", "DeepMind 研究员为算力卡离职创业"]
        }
      ]
    },
    {
      "type": "ending",
      "slogan": "关注 AI Daily · 不错过前沿动态",
      "cta": "点赞 + 关注",
      "meta": ""
    }
  ]
}
```
