# AINewsSkill — 每日AI大模型早报

> 联网搜索 → DeepSeek V3 结构化生成 → 渲染截图，一键产出小红书图文。

## 项目介绍

AINewsSkill 是一个自动化 AI 新闻早报生成工具，每天自动抓取全球 AI 行业最新动态，通过大模型筛选整理为 Top 10 新闻摘要，并渲染为精美的小红书图文卡片。

**核心特点：**
- 🔍 **联网搜索** — 通过 Tavily API 自动获取当日真实 AI 新闻
- 🤖 **AI 结构化** — DeepSeek V3 精选 10 条新闻并输出标准 JSON
- 🎨 **自动渲染** — 固定模板 + Playwright 截图，视觉效果一致
- 📱 **小红书适配** — 3:4 竖版高清图（1800×2400px），开箱即发
- 💰 **极低成本** — 每次不到 3 分钱，月更不到 1 块钱

**工作流程：**

```
Tavily 搜索今日新闻 → DeepSeek V3 结构化生成 → HTML 模板渲染 → Playwright 截图输出 PNG
```

## 快速开始

```bash
git clone https://github.com/zhangziyana007-sudo/AINewsSkill.git
cd AINewsSkill && npm install && npx playwright install chromium && npm link

# 配置密钥
export DEEPSEEK_API_KEY="sk-xxx"       # 必需 — DeepSeek V3 (deepseek-chat)
export TAVILY_API_KEY="tvly-xxx"       # 可选 — 有则联网搜索真实新闻

# 运行
ainews run --force
```

## API 配置

### DeepSeek（必需）

| 项目 | 说明 |
|------|------|
| 注册地址 | [platform.deepseek.com](https://platform.deepseek.com/) |
| 密钥格式 | `sk-xxxxxxxxxxxxxxxx` |
| 使用模型 | `deepseek-chat`（DeepSeek V3） |
| 单次费用 | ≈ ¥0.025（6500 tokens） |

### Tavily 搜索（可选，推荐）

| 项目 | 说明 |
|------|------|
| 注册地址 | [tavily.com](https://tavily.com/) |
| 密钥格式 | `tvly-xxxxxxxx` |
| 免费额度 | 1000 次/月（日更仅用 60 次） |
| 作用 | 自动搜索当日真实 AI 新闻作为生成上下文 |

### 持久化配置

```bash
# 写入 ~/.zshrc 或 ~/.bashrc
echo 'export DEEPSEEK_API_KEY="sk-你的密钥"' >> ~/.zshrc
echo 'export TAVILY_API_KEY="tvly-你的密钥"' >> ~/.zshrc
source ~/.zshrc
```

> ⚠️ 也可创建项目根目录 `.env` 文件（已被 .gitignore 排除，不会泄露）。

## 命令

```bash
ainews run [--force] [--project=NAME]   # 全流程：搜索→生成→渲染→截图
ainews generate [--output=PATH]         # 仅生成 data.json
ainews render [--input=PATH]            # 仅渲染+截图
ainews help                             # 帮助
```

**两种模式**：有 `TAVILY_API_KEY` → 联网搜索真实新闻；无 → 基于模型知识生成。

## 产出

- 3 张 PNG：封面 + 新闻×2 + 结尾
- 尺寸：1800×2400px @2x（小红书 3:4）
- 路径：`output/ai-daily-MMDD/images/`

## 费用

每次运行 ≈ **¥0.025**，月更 30 天 ≈ **¥0.75**。Tavily 免费额度内无额外费用。

## 环境变量

| 变量 | 必需 | 默认值 |
|------|------|--------|
| `DEEPSEEK_API_KEY` | ✅ | — |
| `TAVILY_API_KEY` | 可选 | —（无则跳过搜索） |
| `AI_MODEL` | ❌ | `deepseek-chat` |
| `AI_BASE_URL` | ❌ | `https://api.deepseek.com` |
