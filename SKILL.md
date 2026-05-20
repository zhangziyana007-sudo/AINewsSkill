# AI 日报 · 小红书图文自动化 Skill

> 版本 3.1 — 完整端到端工作流：新闻获取 → AI 结构化 → 渲染出图

---

## 概述

本 Skill 指导 AI 将新闻素材转化为小红书图文帖（3:4 竖版 PNG）。整个流程分为 **3 个阶段**，AI 参与第 1 和第 2 阶段，脚本自动完成第 3 阶段。

**最终产出**：黑底终端风格 + 荧光绿强调色 + Orbitron/得意黑科技字体 = 多张 1800×2400px PNG 图片。

---

## 完整工作流（AI 必读）

```
┌──────────────────────────────────────────────────────┐
│  阶段 1：获取新闻素材（脚本辅助）                       │
│  node scripts/fetch-news.mjs --limit=10              │
│  → 输出 output/raw-news.md（Markdown 格式新闻列表）    │
├──────────────────────────────────────────────────────┤
│  阶段 2：AI 结构化处理（你的核心任务）                   │
│  阅读素材 → 输出 output/{topic}/data.json             │
├──────────────────────────────────────────────────────┤
│  阶段 3：渲染出图（脚本自动）                          │
│  node scripts/pipeline.mjs --input=./output/{topic}/data.json --project={topic}  │
│  → 输出 output/{topic}/images/*.png                  │
└──────────────────────────────────────────────────────┘
```

---

## 阶段 1：获取新闻素材

### 自动获取（推荐）

```bash
cd /home/ts/AINewsSkill
node scripts/fetch-news.mjs --limit=10 --output=./output/raw-news.md
```

**支持的新闻源（7个）**：
- 中文：36氪、机器之心、量子位、InfoQ
- 英文：TechCrunch AI、The Verge AI、Ars Technica AI

脚本自动聚合去重，输出 Markdown 文件作为 AI 输入素材。

### 手动提供

用户也可直接提供：
- 一段文字新闻
- 多条新闻摘要
- 文章链接内容
- 口述的关键信息

---

## 阶段 2：AI 结构化处理（核心任务）

### 你的角色

你是 AI 日报的内容编辑。**唯一任务**：阅读素材 → 输出结构化 JSON 数据文件。

你**不需要**写 HTML、CSS 或任何渲染代码。

### 输出路径

```
/home/ts/AINewsSkill/output/{topic}/data.json
```

`{topic}` 命名规范：`ai-daily-MMDD`（如 `ai-daily-0521`）

### JSON 完整格式

```json
{
  "topic": "ai-daily-0521",
  "date": "2025.05.21",
  "issue": "#202505",
  "pages": [
    {
      "type": "cover",
      "title": ["2025.05.21", "AI日报"],
      "subtitle": "一句话总结，≤ 20 字",
      "previews": [
        { "rank": 1, "title": "新闻标题摘要", "source": "来源", "icon": "brain" }
      ]
    },
    {
      "type": "news",
      "items": [
        {
          "rank": 1,
          "category": "分类标签",
          "title": "新闻标题（≤15字）",
          "summary": "一句话摘要描述（≤40字）",
          "points": ["要点一（≤20字）", "要点二（≤20字）"]
        }
      ]
    },
    {
      "type": "ending",
      "slogan": "结束语",
      "cta": "行动号召",
      "meta": ""
    }
  ]
}
```

### 字段规则

#### 封面 (cover)

| 字段 | 说明 | 约束 |
|------|------|------|
| `title[0]` | 日期 | 格式 `YYYY.MM.DD`，Orbitron 科技字体渲染 |
| `title[1]` | 栏目名 | 固定 `"AI日报"`，得意黑字体渲染 |
| `subtitle` | 副标题 | ≤ 20 字 |
| `previews` | 新闻预览 | **必须包含全部新闻**，与 news items 一一对应 |

**previews 子字段**：

| 字段 | 约束 |
|------|------|
| `rank` | 整数，从 1 开始 |
| `title` | ≤ 18 字 |
| `source` | ≤ 6 字 |
| `icon` | `brain`/`code`/`sparkles`/`monitor`/`smartphone`/`zap`/`globe`/`cpu`/`robot`/`rocket`/`star` |

#### 新闻页 (news)

| 字段 | 约束 |
|------|------|
| `rank` | 整数 |
| `category` | 2-4 字（如"大模型""硬件""融资"） |
| `title` | ≤ 15 字 |
| `summary` | ≤ 40 字，一句话概述核心内容 |
| `points` | 0-3 条，每条 ≤ 20 字 |

**分页**：渲染脚本自动分页（每页约 3-5 条），无需手动拆分。

#### 末页 (ending)

| 字段 | 约束 |
|------|------|
| `slogan` | ≤ 20 字 |
| `cta` | ≤ 10 字（如"点赞+关注"） |
| `meta` | 可选，可为空 |

### 内容数量指南

| 素材量 | 推荐 |
|--------|------|
| 3-5 条 | 全部收录，3-4 张图 |
| 6-8 条 | 全部收录，4-5 张图 |
| 9-12 条 | 全部收录，5-6 张图 |
| 12+ 条 | 精选 Top 10 |

### 写作风格

- **标题**：动词开头或名词短语，信息密度高
- **摘要**：一句话讲清"谁做了什么"
- **分类**：2-4 字中文标签
- **要点**：补充细节，事实优先
- **结束语**：简短有力

---

## 阶段 3：渲染出图

AI 完成 JSON 后，运行以下命令：

```bash
cd /home/ts/AINewsSkill
node scripts/pipeline.mjs --input=./output/ai-daily-0521/data.json --project=ai-daily-0521
```

**自动完成**：
1. `render.mjs` — JSON → HTML 页面（封面 + 新闻页 + 末页）
2. `screenshot.mjs` — HTML → PNG 截图（1800×2400px @2x，Playwright）

**产出位置**：`output/{topic}/images/` 目录下所有 PNG 文件。

---

## 一键执行示例（完整流程）

```bash
# 步骤 1：获取新闻
node scripts/fetch-news.mjs --limit=10 --output=./output/raw-news.md

# 步骤 2：AI 阅读 output/raw-news.md 并输出 JSON
#         （由 AI 完成，保存到 output/ai-daily-MMDD/data.json）

# 步骤 3：渲染出图
node scripts/pipeline.mjs --input=./output/ai-daily-0521/data.json --project=ai-daily-0521
```

---

## 前置安装

```bash
# 克隆项目
git clone https://github.com/zhangziyana007-sudo/AINewsSkill.git
cd AINewsSkill

# 安装依赖（仅 Playwright 用于截图）
npm init -y
npm install playwright
npx playwright install chromium

# 字体（放入 fonts/ 目录）
# 需要：SmileySans-Oblique.ttf（得意黑）、Orbitron-Bold.ttf
# 从以下地址下载：
#   得意黑：https://github.com/atelier-anchor/smiley-sans/releases
#   Orbitron：https://fonts.google.com/specimen/Orbitron
mkdir -p fonts
# 将字体文件放入 fonts/ 目录即可
```

---

## 项目结构

```
AINewsSkill/
├── SKILL.md                    ← 你正在读的（AI 工作流指南）
├── README.md                   ← 项目说明文档
├── LICENSE                     ← MIT 开源协议
├── scripts/
│   ├── fetch-news.mjs          ← 新闻获取脚本（7个RSS源）
│   ├── render.mjs              ← JSON → HTML 渲染器
│   ├── pipeline.mjs            ← 一键管线（渲染+截图）
│   └── screenshot.mjs          ← HTML → PNG 截图
├── templates/ai-daily/
│   ├── cover.html              ← 封面模板
│   ├── news.html               ← 新闻页模板
│   ├── ending.html             ← 末页模板
│   └── styles.css              ← 共享样式
├── fonts/                      ← 字体文件（不提交，需本地准备）
└── output/                     ← 产出目录（不提交）
    ├── raw-news.md             ← fetch-news 的输出
    └── {topic}/
        ├── data.json           ← AI 输出的结构化数据
        └── images/*.png        ← 最终图片
```

---

## 禁止事项

- ❌ 不要输出 HTML/CSS/任何渲染代码
- ❌ 不要讨论排版、字体、颜色选择
- ❌ 不要添加 emoji 到新闻内容中
- ❌ 新闻标题不超过 15 字
- ❌ 要点不超过 20 字
- ❌ 摘要不超过 40 字
- ❌ 不要遗漏任何新闻条目的封面预览

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
