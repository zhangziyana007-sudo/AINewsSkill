---
name: ai-news-daily
version: 8.0.0
description: 每日 AI 大模型新闻早报 · 小红书图文自动化（DeepSeek + AI HOT + Playwright + 飞书 + REST API）
tags: [ai, news, xiaohongshu, daily, deepseek, automation]
entrypoint: bin/ainews.mjs
---

# AI 大模型新闻早报 · 工作流 Skill

把"每日 AI 大模型行业动态"自动加工成小红书 3:4 图文，并支持飞书推送和对外 REST API。

## 工作流总览（6 个环节）

```
⓪ fetch    ─► search-results.json   （AI HOT 抓取真实新闻，Tavily 兜底）
   │
① generate ─► data.json              （DeepSeek 结构化为图文 JSON）
   │
② render   ─► pages/page*.html       （HTML 渲染，自动分页）
   │
③ shot     ─► images/page*.png       （Playwright 截图 3:4 PNG）
   │
④ feishu   ─► 飞书群通知              （可选，需 FEISHU_WEBHOOK_URL）
   │
⑤ publish  ─► output/api/latest.json （对外 REST API 数据）
```

**规则**：每个环节对应一条 `ainews` CLI 命令；可独立执行也可一键串联。

---

## 智能体使用引导

### 场景 A：用户说"做今天的 AI 早报" / "出一期 AI 早报" / "更新 API"

→ 一键全流程：

```bash
ainews run
```

`run` 会按顺序自动执行 ⓪→⑤。已有 `data.json` 时跳过 ① 阶段（加 `--force` 强制重生）。

---

### 场景 B：用户要求"只重新出图" / "改了样式重新渲染"

数据已存在，只重跑视觉环节：

```bash
ainews render          # ② 重新生成 HTML
ainews shot            # ③ 重新截图
```

---

### 场景 C：用户要求"只发飞书" / "推到群里"

```bash
ainews feishu                              # 用今天的项目
ainews feishu --project=ai-daily-0523      # 指定历史项目
```

---

### 场景 D：用户要求"启动 API 服务" / "对外提供接口"

```bash
ainews serve           # 默认 0.0.0.0:8787
# GET /api/latest 返回最新一期早报 JSON
```

---

### 场景 E：分步调试（任一环节失败时排查）

按顺序单独执行，定位问题环节：

```bash
ainews fetch           # ⓪ 抓素材，看 search-results.json
ainews generate        # ① 生成 data.json，看 AI 输出是否合规
ainews render          # ② 看 pages/*.html 是否符合预期
ainews shot            # ③ 看 images/*.png 是否正确
ainews publish         # ⑤ 看 output/api/latest.json
```

---

## CLI 命令清单

| 命令 | 环节 | 输入 | 输出 | 必需环境变量 |
|------|------|------|------|--------------|
| `ainews fetch` | ⓪ 抓取素材 | — | `output/<项目>/search-results.json` | （AI HOT 免费；可选 `TAVILY_API_KEY` 作兜底） |
| `ainews generate` | ① AI 生成 | `search-results.json` | `output/<项目>/data.json` | `DEEPSEEK_API_KEY` |
| `ainews render` | ② 渲染 HTML | `data.json` | `output/<项目>/pages/*.html` | — |
| `ainews shot` | ③ 截图 PNG | `pages/*.html` | `output/<项目>/images/*.png` | Playwright 已装 |
| `ainews feishu` | ④ 飞书推送 | `output/<项目>/` | 群通知 | `FEISHU_WEBHOOK_URL` |
| `ainews publish` | ⑤ 发布 API | `output/<项目>/` | `output/api/latest.json` | — |
| `ainews run` | 编排 ⓪→⑤ | — | 全套产物 | 同上叠加 |
| `ainews serve` | HTTP 服务 | `output/api/` | `:8787/api/latest` | — |
| `ainews help` | 帮助 | — | — | — |

**通用选项**：`--project=NAME` 切换项目目录、`--input/--output` 覆盖路径、`--force` 强制重生。

---

## 项目目录结构

每次运行产物归集到独立项目目录（默认 `ai-daily-MMDD`）：

```
output/
  ai-daily-0523/
    search-results.json    ⓪ 原始素材
    data.json              ① 结构化图文数据
    pages/                 ② HTML 页面
      page1.html ... pageN.html
    images/                ③ 小红书 3:4 PNG
      page1.png ... pageN.png
  api/
    latest.json            ⑤ 对外 API 最新数据
```

---

## 必备环境变量

```bash
# 必需
export DEEPSEEK_API_KEY="sk-xxxxxxxx"

# 可选
export AI_BASE_URL="https://api.deepseek.com/v1"
export AI_MODEL="deepseek-v4-pro"
export AI_TARGET_COUNT=20

export TAVILY_API_KEY="tvly-xxx"          # fetch 兜底
export AIHOT_CATEGORY="ai-models"
export AIHOT_SINCE_HOURS=24

export FEISHU_WEBHOOK_URL="https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
export FEISHU_APP_ID="cli_xxx"            # 用于上传图片（可选）
export FEISHU_APP_SECRET="xxx"
```

---

## 视觉设计要点（用户调整样式时参考）

- **3:4 比例**：900×1200 @2x，全屏黑底 + 荧光绿点缀
- **科技感字体**：标题用 Orbitron（英文/数字）+ 创客贴金刚体（中文）
- **正文字体**：Noto Sans CJK Black + JetBrains Mono
- **背景**：60px 主网格（rgba(0,255,136,0.08)) + 15px 细分网格，双层立体感
- **新闻卡片**：18px 圆角 + 4 层阴影（外阴影 + 绿色光环 + 内嵌高光），间距 22px
- **状态点**：右上角 14px 荧光绿圆点 + 三层光晕

样式定义在 `templates/ai-daily/styles.css`，分页阈值在 `scripts/render.mjs`（MAX_HEIGHT_FIRST/CONT、CARD_HEIGHT_RICH、GAP）。

---

## 错误处理建议

| 错误 | 处理 |
|------|------|
| `❌ 缺少 API 密钥` | 提示用户 `export DEEPSEEK_API_KEY=...` |
| `⚠️ 素材拉取失败` | `run` 会容错继续走，但应提醒用户内容可能不是最新 |
| `❌ 找不到数据文件` | 提示先执行上一环节（generate / render） |
| 飞书未配置 | `run` 自动跳过 ④，无需报错 |
| Playwright 浏览器缺失 | `npx playwright install chromium` |

---

## 不要做的事

- ❌ 不要直接调用 `scripts/*.mjs`，统一走 `ainews <cmd>` CLI
- ❌ 不要在 `run` 全流程里跳步（顺序依赖严格）
- ❌ 不要把 `data.json` 手工编辑后又 `--force` 覆盖（会丢失）
- ❌ 不要在 `serve` 运行时同时跑 `publish`（会写入冲突）
