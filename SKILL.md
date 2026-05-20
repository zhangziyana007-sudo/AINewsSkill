---
name: ai-news-daily
description: AI 日报小红书图文自动化 — 从新闻获取到出图的完整工作流
version: 4.0.0
author: zizaya
license: MIT
platforms: [linux, macos]
prerequisites:
  commands: [node, ainews]
  packages: [playwright]
metadata:
  hermes:
    tags: [小红书, XHS, AI日报, 新闻, 自动化, RSS]
    category: social-media
---

# AI 日报 · 小红书图文工作流

> 接收素材或自动获取 → AI 结构化 → 自动渲染出图。全程 CLI 驱动。

---

## 工作流总览

```
用户触发
  │
  ▼
┌─────────────────────────────────────────────┐
│ STEP 1 · 执行 ainews fetch                  │
│ → 自动获取7源RSS新闻 → output/raw-news.md   │
└─────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────┐
│ STEP 2 · 阅读素材，输出 JSON                 │
│ → 读取 output/raw-news.md                   │
│ → 提取+结构化                                │
│ → 写入 output/{topic}/data.json             │
│ → ⏸ 暂停，展示给用户确认                     │
└─────────────────────────────────────────────┘
  │ 用户确认
  ▼
┌─────────────────────────────────────────────┐
│ STEP 3 · 执行 ainews render                  │
│ → JSON → HTML → PNG（1800×2400px）           │
│ → output/{topic}/images/*.png               │
└─────────────────────────────────────────────┘
  │
  ▼
完成 · 告知用户图片位置
```

---

## STEP 1 · 获取素材

**执行命令：**
```bash
ainews fetch --limit=10
```

**结果**：`output/raw-news.md`（Markdown 格式新闻列表）

**新闻源**：36氪 · 机器之心 · 量子位 · InfoQ · TechCrunch · The Verge · Ars Technica

> 如用户已提供素材（文字/链接/文件），跳过此步，直接进入 STEP 2。

---

## STEP 2 · 结构化（AI 核心任务）

### 动作

1. 读取 `output/raw-news.md`（或用户提供的素材）
2. 筛选 AI 相关的重要新闻
3. 按下方格式输出 JSON
4. 保存到 `output/ai-daily-{MMDD}/data.json`
5. **暂停**，将 JSON 摘要展示给用户确认

### topic 命名

`ai-daily-MMDD`，如今天是 5月21日 → `ai-daily-0521`

### JSON 结构

```json
{
  "topic": "ai-daily-0521",
  "date": "2025.05.21",
  "issue": "#202505",
  "pages": [
    { "type": "cover", ... },
    { "type": "news", ... },
    { "type": "ending", ... }
  ]
}
```

### cover 页（必须 1 个）

```json
{
  "type": "cover",
  "title": ["2025.05.21", "AI日报"],
  "subtitle": "一句话主题（≤20字）",
  "previews": [
    { "rank": 1, "title": "新闻简述（≤18字）", "source": "来源（≤6字）", "icon": "brain" }
  ]
}
```

规则：
- `title[0]` 固定为当天日期 `YYYY.MM.DD`
- `title[1]` 固定为 `"AI日报"`
- `previews` **必须覆盖全部新闻**，数量 = news items 总数

### news 页（至少 1 个）

```json
{
  "type": "news",
  "items": [
    {
      "rank": 1,
      "category": "标签（2-4字）",
      "title": "标题（≤15字）",
      "summary": "摘要（≤40字）",
      "points": ["要点（≤20字）", "要点（≤20字）"]
    }
  ]
}
```

规则：
- 所有新闻放在一个 `news` 页中，脚本自动分页
- `category`：大模型 / 硬件 / 融资 / 开源 / 应用 / 人才 / 政策…
- `points`：0-3 条补充要点

### ending 页（必须 1 个）

```json
{
  "type": "ending",
  "slogan": "结束语（≤20字）",
  "cta": "号召（≤10字）",
  "meta": ""
}
```

### icon 可选值

`brain` · `code` · `sparkles` · `monitor` · `smartphone` · `zap` · `globe` · `cpu` · `robot` · `rocket` · `star`

### 写作规范

| 元素 | 风格 |
|------|------|
| 标题 | 动词开头 / 名词短语，信息密度高 |
| 摘要 | 一句话讲清"谁做了什么" |
| 要点 | 补充关键数字或细节 |
| 分类 | 统一 2-4 字中文 |

### 数量对照

| 素材条数 | 处理方式 |
|---------|---------|
| ≤12 | 全部收录 |
| >12 | 精选 Top 10，按重要性排序 |

---

## STEP 3 · 渲染出图

**用户确认 JSON 后执行：**
```bash
ainews render --input=./output/ai-daily-0521/data.json
```

**结果**：`output/ai-daily-0521/images/` 目录下生成多张 PNG（1800×2400px @2x）

**最后**：告知用户图片路径，任务完成。

---

## 快捷模式

如果用户说"做今天的AI日报"且无特殊要求，可用一键命令：
```bash
ainews run
```
该命令会自动执行 STEP 1，然后提示需要 AI 完成 STEP 2 的 JSON。

---

## 约束清单

- ❌ 不输出 HTML / CSS / 任何渲染代码
- ❌ 不讨论排版、字体、配色选择
- ❌ 不在内容中添加 emoji
- ❌ 不超出字数限制（标题15/摘要40/要点20/source6）
- ❌ 不遗漏任何新闻的封面 preview
- ❌ 不修改模板文件或脚本代码
- ✅ 只做两件事：执行 CLI 命令 + 输出 JSON

---

## 完整 JSON 示例

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
        { "rank": 1, "title": "Karpathy 加入 Anthropic", "source": "Anthropic", "icon": "brain" },
        { "rank": 2, "title": "I/O 大会发布 Gemini 3.5", "source": "Google", "icon": "sparkles" },
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
          "summary": "OpenAI 联合创始人正式宣布加入 Anthropic，震动 AI 圈。",
          "points": ["前 OpenAI 核心成员正式官宣", "市场解读为 Anthropic 重大利好"]
        },
        {
          "rank": 2,
          "category": "大模型",
          "title": "I/O 大会发布 Gemini 3.5",
          "summary": "搜索框变身智能体，Agent 产品全线上线。",
          "points": ["重塑 50 亿人上网方式", "端侧模型首次集成到搜索"]
        },
        {
          "rank": 3,
          "category": "算力",
          "title": "硅谷深陷算力荒",
          "summary": "H200 一夜涨价 30%，研究员为拿到算力卡选择离职创业。",
          "points": ["H100 全球抢购一空", "多家实验室被迫推迟训练计划"]
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

---

## 安装（首次使用）

```bash
git clone https://github.com/zhangziyana007-sudo/AINewsSkill.git
cd AINewsSkill
npm install && npx playwright install chromium
npm link  # 注册全局 ainews 命令

# 字体（放入 fonts/ 目录）
# 得意黑：https://github.com/atelier-anchor/smiley-sans/releases
# Orbitron：https://fonts.google.com/specimen/Orbitron
```
