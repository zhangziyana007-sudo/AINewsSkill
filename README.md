# AINewsSkill — 每日AI大模型早报（Top 10）

> 一键生成小红书图文：联网搜索 → DeepSeek 结构化生成 → 渲染截图。完全自包含，无外部依赖。

## 架构

```
[Tavily 搜索] → search-results.json → [DeepSeek API] → data.json → [render.mjs] → HTML → [screenshot] → PNG
      ↑                                      ↑                          ↑                      ↑
 联网获取今日新闻                     AI 基于真实新闻            固定 HTML 模板          Playwright 截图
 (可选，有KEY自动启用)                 结构化输出10条           (样式锁死,永不变)        (1800×2400 @2x)
```

## 目录结构

```
AINewsSkill/
├── bin/ainews.mjs          ← CLI 入口（全局命令 ainews）
├── templates/ai-daily/     ← 固定模板（CSS + HTML 骨架）
│   ├── styles.css          ← 共享样式（字体、变量、装饰）
│   ├── cover.html          ← 封面模板
│   ├── cover-cont.html     ← 续页模板
│   └── ending.html         ← 末页模板
├── scripts/
│   ├── search-news.mjs     ← Tavily 联网搜索（自动获取今日新闻）
│   ├── generate.mjs        ← AI生成（DeepSeek API → JSON）
│   ├── render.mjs          ← 渲染器（JSON → HTML）
│   ├── pipeline.mjs        ← 统一入口（渲染 + 截图）
│   └── screenshot.mjs      ← Playwright 截图
├── fonts/                  ← 本地字体（得意黑、Orbitron等）
├── SKILL.md                ← Agent 规格文档（供 Hermes 等 AI 工具调用）
└── output/                 ← 产出目录（已 gitignore）
```

## 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/zhangziyana007-sudo/AINewsSkill.git
cd AINewsSkill

# 2. 安装依赖
npm install && npx playwright install chromium

# 3. 注册全局命令
npm link

# 4. 配置 API 密钥（见下方详细教程）
export DEEPSEEK_API_KEY="sk-xxx"
export TAVILY_API_KEY="tvly-xxx"    # 可选，有则联网搜索真实新闻

# 5. 一键运行
ainews run --force
```

## API 配置教程

### DeepSeek API（必需）

1. 访问 [DeepSeek 开放平台](https://platform.deepseek.com/)
2. 注册/登录账号
3. 进入「API Keys」页面，点击「创建 API Key」
4. 复制生成的密钥（格式：`sk-xxxxxxxxxxxxxxxx`）
5. 设置环境变量：
   ```bash
   export DEEPSEEK_API_KEY="sk-你的密钥"
   ```

> 💡 **费用参考**：每次生成消耗约 6,500 tokens，费用约 ¥0.025（2.5分钱）。每月日更仅需 ¥0.75。

### Tavily 搜索 API（可选，强烈推荐）

配置后可自动联网搜索当日真实 AI 新闻，生成内容更准确、更有时效性。

1. 访问 [Tavily](https://tavily.com/)
2. 注册账号（支持 GitHub / Google 登录）
3. 进入 Dashboard，复制 API Key（格式：`tvly-xxxxxxxx`）
4. 设置环境变量：
   ```bash
   export TAVILY_API_KEY="tvly-你的密钥"
   ```

> 💡 **费用参考**：免费额度 1000 次/月（每次流程用 2 次搜索，每月日更仅消耗 60 次，完全免费）。

### 持久化配置（推荐）

将密钥写入 shell 配置文件，避免每次手动 export：

```bash
# Bash 用户
echo 'export DEEPSEEK_API_KEY="sk-你的密钥"' >> ~/.bashrc
echo 'export TAVILY_API_KEY="tvly-你的密钥"' >> ~/.bashrc
source ~/.bashrc

# Zsh 用户
echo 'export DEEPSEEK_API_KEY="sk-你的密钥"' >> ~/.zshrc
echo 'export TAVILY_API_KEY="tvly-你的密钥"' >> ~/.zshrc
source ~/.zshrc
```

或者在项目根目录创建 `.env` 文件（已被 .gitignore 排除，不会泄露）：

```bash
# .env
DEEPSEEK_API_KEY=sk-你的密钥
TAVILY_API_KEY=tvly-你的密钥
```

> ⚠️ **安全提醒**：`.env` 文件已在 `.gitignore` 中排除，不会被提交到 Git 仓库。请勿将真实密钥硬编码到代码中。

## 使用方式

```bash
# 全流程（推荐）— 自动搜索 → 生成 → 渲染 → 截图
ainews run                          # 正常运行（已有 data.json 时跳过生成）
ainews run --force                  # 强制重新搜索和生成
ainews run --project=ai-daily-0520  # 指定项目名

# 分步执行
ainews generate --output=./output/ai-daily-0520/data.json
ainews generate --context=./output/ai-daily-0520/search-results.json  # 带搜索上下文
ainews render --input=./output/ai-daily-0520/data.json

# 帮助
ainews help
```

### 两种模式

| 模式 | 条件 | 行为 |
|------|------|------|
| **联网模式**（推荐） | 设置了 `TAVILY_API_KEY` | 先搜索真实新闻，再基于搜索结果生成 |
| **离线模式** | 未设置 `TAVILY_API_KEY` | 跳过搜索，直接基于模型知识生成 |

## 产出格式

- 3张图片：封面（4条预览）+ 续页（5+5条新闻）+ 结尾页
- 尺寸：1800×2400px（@2x，适合小红书3:4比例）
- 格式：PNG

## data.json 结构

```json
{
  "date": "2026.05.20",
  "issue": "#20260520",
  "pages": [
    {
      "type": "cover",
      "title": ["2026.05.20", "AI早报"],
      "subtitle": "关键词A · 关键词B · 关键词C",
      "previews": [
        {"rank": 1, "title": "【厂商】核心动作", "source": "来源", "icon": "zap"}
      ]
    },
    {
      "type": "news",
      "items": [
        {"title": "【厂商】核心动作", "keyFact": "关键事实", "impact": "影响分析", "category": "来源", "icon": "zap"}
      ]
    },
    {
      "type": "ending",
      "slogan": "AI大模型早报 · 每日精选Top 10",
      "cta": "关注获取每日推送",
      "meta": "数据来源：AI行业动态"
    }
  ]
}
```

## 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API 密钥 |
| `TAVILY_API_KEY` | 可选 | Tavily 搜索 API 密钥（有则自动联网搜索真实新闻） |
| `AI_BASE_URL` | ❌ | 自定义 API 地址（默认 `https://api.deepseek.com`） |
| `AI_MODEL` | ❌ | 模型名称（默认 `deepseek-chat`） |

## 费用估算

| 项目 | 单次消耗 | 单价 | 费用/次 |
|------|----------|------|---------|
| Tavily 搜索 | 2 次 API 调用 | 免费（1000次/月） | ¥0 |
| DeepSeek 输入 | ~4,500 tokens | ¥2/百万 token | ¥0.009 |
| DeepSeek 输出 | ~2,000 tokens | ¥8/百万 token | ¥0.016 |
| **总计** | **~6,500 tokens** | — | **≈ ¥0.025/次** |

> 每月日更 30 天，总费用约 **¥0.75**（不到一块钱）。

## 设计原则

- **AI 零设计责任**：AI 只输出结构化 JSON，不碰 HTML/CSS
- **100% 确定性渲染**：同一份 JSON 永远输出相同的图片
- **本地字体**：不依赖任何 CDN，字体文件全部本地加载
- **固定装饰**：扫描线、发光球等写死在模板中
