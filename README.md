# AINewsSkill · 每日 AI 大模型新闻早报

> 把"今日 AI 大模型行业动态"自动加工成小红书 3:4 图文，支持飞书推送和对外 REST API。
> 适用于 Hermes / OpenClaw / Claude Code 等 Skill 体系，也可独立 CLI 使用。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen)

---

## 📖 项目是做什么的

一条命令产出"今日 AI 大模型早报"小红书图文：

```
AI HOT 抓真实新闻
     ↓
DeepSeek 结构化为 20 条精选
     ↓
HTML + Playwright 渲染成 3:4 PNG（≈6 张）
     ↓
(可选) 飞书群推送 + 对外 REST API
```

**核心特性**：
- 🎯 真实数据源（AI HOT 免费 API）+ DeepSeek 兜底
- 🎨 科技感设计（Orbitron + 创客贴金刚体 + 荧光绿 + 立体卡片）
- 🧩 工作流式 CLI（每个环节独立命令，可分步可一键）
- 🔌 双输出（小红书图片 + JSON API）

---

## ⚡ 5 秒上手

```bash
# 安装
git clone https://github.com/zhangziyana007-sudo/AINewsSkill
cd AINewsSkill
npm install
npx playwright install chromium

# 配置必需密钥
export DEEPSEEK_API_KEY="sk-xxxxxxxx"

# 一键全流程出图
node bin/ainews.mjs run
# 或全局：npm link 后直接 ainews run
```

产物：`output/ai-daily-MMDD/images/page*.png`

---

## 🏗️ 项目架构

### 设计哲学：「一个脚本 = 一个 CLI 命令 = 一个工作流环节」

```
┌──────────────────────────────────────────────────────────────┐
│                     bin/ainews.mjs (CLI 入口)                 │
│  路由 8 条命令到 scripts/* 实现，并提供 run 编排              │
└────────────┬─────────────────────────────────────────────────┘
             │
             ↓
┌────────────────────────────────────────────────────────────────────┐
│                          工作流 6 大环节                            │
├────────────────────────────────────────────────────────────────────┤
│ ⓪ ainews fetch    → scripts/search-news.mjs                       │
│                    AI HOT API + Tavily 兜底                        │
│                    → output/<项目>/search-results.json             │
│                                                                    │
│ ① ainews generate → scripts/generate.mjs                          │
│                    DeepSeek v4-pro 结构化（JSON 输出）             │
│                    → output/<项目>/data.json                       │
│                                                                    │
│ ② ainews render   → scripts/render.mjs                            │
│                    模板填充 + 自动分页                              │
│                    → output/<项目>/pages/page*.html                │
│                                                                    │
│ ③ ainews shot     → scripts/screenshot.mjs                        │
│                    Playwright @2x 截图 3:4                         │
│                    → output/<项目>/images/page*.png                │
│                                                                    │
│ ④ ainews feishu   → scripts/push-feishu.mjs                       │
│                    Webhook 推送（可选）                             │
│                                                                    │
│ ⑤ ainews publish  → scripts/publish-api.mjs                       │
│                    → output/api/latest.json                        │
└────────────────────────────────────────────────────────────────────┘

编排命令：
  ainews run       一键 ⓪→⑤ 全流程
  ainews serve     → scripts/server.mjs (HTTP API)
```

### 目录结构

```
AINewsSkill/
├── bin/
│   └── ainews.mjs              ⭐ CLI 唯一入口，命令分发
├── scripts/                    ⭐ 每个脚本对应一条 CLI 命令
│   ├── search-news.mjs         ⓪ AI HOT 抓取 + Tavily 兜底
│   ├── generate.mjs            ① DeepSeek 结构化
│   ├── render.mjs              ② HTML 渲染 + 分页
│   ├── screenshot.mjs          ③ Playwright 截图
│   ├── push-feishu.mjs         ④ 飞书推送
│   ├── publish-api.mjs         ⑤ 发布 API JSON
│   ├── server.mjs              HTTP API 服务
│   └── pipeline.mjs            （遗留，被 ainews run 替代）
├── templates/
│   └── ai-daily/
│       ├── cover.html          封面页模板
│       ├── cover-cont.html     续页模板
│       └── styles.css          ⭐ 视觉设计核心（改样式看这里）
├── fonts/                      自带字体
│   ├── Orbitron-VariableFont_wght.ttf
│   ├── ChuangKeTieJinGang.otf  （中文科技感）
│   ├── NotoSansSC-Black.otf
│   └── JetBrainsMono-*.ttf
├── output/                     产物根目录（每日一个子目录）
│   ├── ai-daily-MMDD/
│   │   ├── search-results.json
│   │   ├── data.json
│   │   ├── pages/
│   │   └── images/
│   └── api/
│       └── latest.json
├── SKILL.md                    ⭐ 给智能体读的 Skill 文档
├── README.md                   本文件
└── package.json
```

---

## 🛠️ 常见任务速查

### 用户场景 → 该跑的命令

| 用户想做 | 命令 |
|----------|------|
| 出今天的早报 | `ainews run` |
| 改了样式重新出图 | `ainews render && ainews shot` |
| 只想发飞书 | `ainews feishu --project=ai-daily-0523` |
| 启动对外 API | `ainews serve` |
| 抓素材但不出图 | `ainews fetch` |
| 用历史素材重生 JSON | `ainews generate --force` |
| 看完整命令帮助 | `ainews help` |

### 改样式 / 改设计

- **配色 / 字体 / 卡片样式** → `templates/ai-daily/styles.css`
- **页面布局 / 分页阈值** → `scripts/render.mjs` 顶部常量
  ```js
  const MAX_HEIGHT_FIRST = 800;   // 封面页可用高度
  const MAX_HEIGHT_CONT  = 1070;  // 续页可用高度
  const CARD_HEIGHT_RICH = 250;   // 每张新闻卡片高度
  const GAP              = 22;    // 卡片间距
  ```
- **截图比例 / 分辨率** → `scripts/screenshot.mjs` 顶部 `width / height / scale`
- **HTML 模板结构** → `templates/ai-daily/cover.html` / `cover-cont.html`

### 改 AI 生成逻辑

- **模型 / 条数 / 提示词** → `scripts/generate.mjs`
  ```js
  const MODEL = 'deepseek-v4-pro';
  const TARGET_COUNT = 20;
  // 提示词搜索 buildPrompt
  ```

### 改新闻来源

- **AI HOT 抓取参数** → `scripts/search-news.mjs`（分类、时间窗口）
- **加新的数据源** → 在 `search-news.mjs` 仿照 `fetchFromAIHot` 增加 `fetchFromXxx`，按顺序兜底

---

## 🔐 环境变量

| 变量 | 必需 | 用途 |
|------|------|------|
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API 密钥 |
| `AI_BASE_URL` | ⛔ | 默认 `https://api.deepseek.com/v1` |
| `AI_MODEL` | ⛔ | 默认 `deepseek-v4-pro` |
| `AI_TARGET_COUNT` | ⛔ | 精选条数，默认 20 |
| `TAVILY_API_KEY` | ⛔ | Tavily 兜底搜索（AI HOT 失败时） |
| `AIHOT_CATEGORY` | ⛔ | AI HOT 分类，默认 `ai-models` |
| `AIHOT_SINCE_HOURS` | ⛔ | 时间窗口（小时），默认 24，量少时自动扩到 48 |
| `FEISHU_WEBHOOK_URL` | ⛔ | 飞书自定义机器人 Webhook（推到该 webhook 绑定的单个群） |
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | ⛔ | 飞书应用机器人凭证（启用后自动推到机器人所在的**所有群**） |

`.env` 模板：

```bash
DEEPSEEK_API_KEY=sk-xxxxxxxx
# 两种飞书推送可同时启用，互不冲突：
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx     # 推单群
FEISHU_APP_ID=cli_xxx                                                    # 推机器人所在所有群
FEISHU_APP_SECRET=xxxxxxxx
```

### 飞书多群推送说明

脚本会同时走两条通道（任意一条可独立使用）：

| 通道 | 机器人类型 | 推送范围 | 需要配置 |
|---|---|---|---|
| Webhook | 自定义机器人 | 该 webhook URL 绑定的那个群（1 个）| `FEISHU_WEBHOOK_URL` |
| IM API | 应用机器人 | 机器人被拉进的所有群（多个，自动枚举）| `FEISHU_APP_ID` + `FEISHU_APP_SECRET` |

**应用机器人使用步骤**：
1. [飞书开放平台](https://open.feishu.cn/app) 创建“企业自建应用”
2. 「应用功能 → 机器人」启用机器人能力
3. 「权限管理」申请三个权限：
   - `im:chat:readonly`（获取机器人所在群）
   - `im:message:send_as_bot`（以应用身份发消息）
   - `im:resource`（上传图片）
4. 「版本管理与发布」创建版本号并发布（不发布权限不生效）
5. 拿到 App ID + App Secret 填进环境变量
6. 在需要推送的每个群里：群设置 → 群机器人 → 添加机器人 → 搜索并加入该应用机器人

推送后日志会明确显示 `📡 机器人所在群：N 个` 和每群的 ✅/❌ 状态。

---

## 🤖 给智能体用（Skill 模式）

把本项目作为 Skill 注册到 Hermes / OpenClaw / Claude Code：

```bash
ln -s /path/to/AINewsSkill ~/.hermes/skills/ai-news-daily
# 或
cp -r AINewsSkill ~/.claude/skills/
```

智能体读到 `SKILL.md` 后会自动学会：
- 按用户意图选用 `ainews run` 还是分步命令
- 缺密钥时提示用户配置
- 改样式时知道修改 `styles.css` 而不是改脚本

---

## 📦 GitHub Actions 自动化

`.github/workflows/daily.yml` 已配置每日定时任务：
- 北京时间 9:30 自动 `ainews run`
- 产物提交到仓库 `output/`
- 飞书推送结果到群

启用前需要在仓库 Settings → Secrets 配置：`DEEPSEEK_API_KEY`、`FEISHU_WEBHOOK_URL` 等。

---

## ⚠️ 内容合规与安全

**AI 生成内容必须人工审核**：本项目所有文本（新闻摘要、小红书文案）由 DeepSeek 大模型生成，可能含事实错误、夸大表述、过时信息。**直接发布到公开平台前必须人工审阅一遍**，并按平台规定标注 AIGC。

**不要在文案中**：
- 承诺产品功能、给出投资建议、医疗或法律建议
- 伪造为权威媒体或厂商官方信息

**密钥安全**：
- 所有密钥仅通过环境变量 / GitHub Secrets 传入，不要硬编码进任何代码或文档
- `FREEIMAGE_API_KEY` 备份图床功能默认禁用，需主动启用
- `DEEPSEEK_API_KEY`、`FEISHU_APP_SECRET` 一旦泄漏请立即在控制台 revoke 并轮换

**GitHub Token 权限最小化**：远程触发 workflow 使用的 PAT 仅需 `actions: write` + `contents: read` 权限，不要使用 admin 级 token。

---

## 🌐 远程 Skill 模式（零部署）

如果你只想让 AI 调用本项目而不想自己 clone/安装，使用 [REMOTE_SKILL.md](REMOTE_SKILL.md)：
- AI 通过 HTTP 拉取 raw.githubusercontent.com 上的数据/图片/文案
- 无需 Node、Playwright、API 密钥
- 适合 ChatGPT/Claude/智能体接入

---

## 🧰 技术栈

| 模块 | 技术 |
|------|------|
| 运行时 | Node.js ≥18 (ESM) |
| AI 模型 | DeepSeek v4-pro (JSON Output) |
| 新闻源 | AI HOT REST API（免费）+ Tavily 兜底 |
| 截图 | Playwright + Chromium |
| 字体 | Orbitron + 创客贴金刚体 + Noto Sans CJK + JetBrains Mono |
| 推送 | 飞书 Webhook + 应用上传 |

---

## ⚠️ 已知限制 & 常见问题

| 问题 | 解决 |
|------|------|
| `❌ 缺少 API 密钥` | `export DEEPSEEK_API_KEY=...` |
| 飞书图片不显示 | 配置 `FEISHU_APP_ID` + `FEISHU_APP_SECRET` 启用上传 |
| Playwright 报浏览器不存在 | `npx playwright install chromium` |
| 字体不渲染 | 确认 `fonts/` 目录完整（含 OTF/TTF 文件） |
| 分页数量异常 | 调整 `scripts/render.mjs` 顶部 `MAX_HEIGHT_*` 常量 |

---

## 📄 License

MIT © zizaya

---

## 🔗 相关

- DeepSeek API: https://platform.deepseek.com
- AI HOT: https://aihot.virxact.com
- Playwright: https://playwright.dev
- 设计风格参考：linear.app · vercel.com
