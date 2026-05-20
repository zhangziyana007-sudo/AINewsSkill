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
| `FEISHU_WEBHOOK_URL` | 可选 | —（有则自动推送飞书） |
| `FEISHU_APP_ID` | 可选 | —（有则上传图片到飞书） |
| `FEISHU_APP_SECRET` | 可选 | —（配合 APP_ID） |
| `AI_MODEL` | ❌ | `deepseek-chat` |
| `AI_BASE_URL` | ❌ | `https://api.deepseek.com` |

## 飞书推送

配置 `FEISHU_WEBHOOK_URL` 后，`ainews run` 完成会自动推送到飞书群。

### 配置步骤

1. 飞书群 → 设置 → 群机器人 → 添加机器人 → 自定义机器人
2. 复制 Webhook 地址
3. 设置环境变量：
   ```bash
   export FEISHU_WEBHOOK_URL="https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
   ```

### 发送图片（可选）

纯 Webhook 只能发文字摘要。如需发送图片，需额外创建飞书应用：

1. 访问 [飞书开放平台](https://open.feishu.cn/app) → 创建企业自建应用
2. 获取 App ID 和 App Secret
3. 应用权限中添加 `im:resource`（上传图片）
4. 设置环境变量：
   ```bash
   export FEISHU_APP_ID="cli_xxx"
   export FEISHU_APP_SECRET="xxx"
   ```

### 定时任务（cron）

```bash
# 每天早上 8:00 自动运行并推送
crontab -e
# 添加：
0 8 * * * cd /home/ts/AINewsSkill && source ~/.zshrc && ainews run --force >> /tmp/ainews.log 2>&1
```
