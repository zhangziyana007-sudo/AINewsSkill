# AINewsSkill — AI 日报自动化流水线

> 场景化固定工作流：AI 只负责提取内容数据，样式/排版/截图全部由脚本确定性完成。

## 架构

```
RSS 源 → [fetch-news.mjs] → 素材.md → [AI 提取] → data.json → [render.mjs] → page*.html → [screenshot] → page*.png
                                            ↑                         ↑                            ↑
                                      SKILL.md 指导            固定 HTML 模板                  Playwright 截图
                                      (只输出 JSON)        (样式锁死,永不变)              (1800×2400 @2x)
```

## 目录结构

```
AINewsSkill/
├── templates/ai-daily/     ← 固定模板（CSS + HTML 骨架）
│   ├── styles.css          ← 共享样式（字体、变量、装饰）
│   ├── cover.html          ← 封面模板
│   ├── news.html           ← 新闻页模板
│   └── ending.html         ← 末页模板
├── scripts/
│   ├── fetch-news.mjs      ← 新闻获取（RSS → Markdown 素材）
│   ├── render.mjs          ← 渲染器（JSON → HTML）
│   ├── pipeline.mjs        ← 统一入口（渲染 + 截图）
│   └── screenshot.mjs      ← → 链接到 VIbeUI 截图脚本
├── skills/xhs-ai-daily/
│   └── SKILL.md            ← Hermes skill（教 AI 输出 JSON）
├── fonts/                  ← → 链接到 XHSVibeUISkill/fonts
└── output/                 ← 产出目录
```

## 使用方式

### 完整流程（推荐）

```bash
cd /home/ts/AINewsSkill

# 第 1 步：自动获取最新 AI 新闻素材
node scripts/fetch-news.mjs --limit=15

# 第 2 步：让 AI 根据素材生成结构化数据（使用 Hermes skill）
hermes chat "根据以下素材生成AI日报" --skill xhs-ai-daily --file ./output/raw-news-YYYYMMDD.md

# 第 3 步：渲染 + 截图
node scripts/pipeline.mjs --input=./output/{topic}/data.json --project={topic}
# 产出 → output/{topic}/images/page*.png
```

### fetch-news.mjs 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--limit=N` | 获取条数上限 | 15 |
| `--output=PATH` | 输出文件路径 | `./output/raw-news-YYYYMMDD.md` |

**数据源**：36氪、机器之心、量子位、InfoQ、TechCrunch、The Verge、Ars Technica（RSSHub + 直连 RSS）

### 方式 B：已有素材直接生成

```bash
# 准备好 data.json 后直接渲染：
node scripts/pipeline.mjs --input=./output/{topic}/data.json --project={topic}
```

### 方式 C：分步执行
```bash
# 1. 渲染
node scripts/render.mjs --input=./data.json --output=./pages

# 2. 截图
node /home/ts/VIbeUI/scripts/screenshot-xhs.mjs --input=./pages --output=./images
```

## data.json 格式

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
        { "rank": 1, "title": "新闻摘要标题", "source": "来源", "icon": "brain" }
      ]
    },
    {
      "type": "news",
      "items": [
        {
          "rank": 1,
          "category": "分类",
          "title": "标题（≤15字）",
          "summary": "一句话摘要（≤40字）",
          "points": ["要点一", "要点二"]
        }
      ]
    },
    {
      "type": "ending",
      "slogan": "结束语",
      "cta": "点赞 + 关注",
      "meta": ""
    }
  ]
}
```

**关键字段说明**：
- `cover.title[0]`：日期（Orbitron 科技字体渲染）
- `cover.title[1]`：固定为 `"AI日报"`（得意黑字体渲染）
- `cover.previews`：必须包含全部新闻条目，封面会展示完整列表
- `news.items[].summary`：新闻摘要，一句话描述核心内容
- `cover.previews[].icon`：可选值 `brain/code/sparkles/monitor/smartphone/zap/globe/cpu/robot/rocket/star`

## 设计原则

- **AI 零设计责任**：AI 只输出结构化文本数据，不碰 HTML/CSS
- **100% 确定性渲染**：同一份 JSON 永远输出相同的 HTML
- **自适应分页**：内容多则自动拆页，少则增大间距
- **本地字体**：不依赖任何 CDN，字体文件全部本地加载
- **固定装饰**：扫描线、发光球、脉冲点等写死在模板中
