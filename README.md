# AINewsSkill — 每日AI大模型早报（Top 10）

> 一键生成小红书图文：DeepSeek AI 直接生成结构化数据 → 渲染截图。

## 架构

```
[DeepSeek API] → data.json → [render.mjs] → page*.html → [screenshot] → page*.png
       ↑                          ↑                            ↑
 AI基于模型知识              固定 HTML 模板                 Playwright 截图
 直接生成10条              (样式锁死,永不变)              (1800×2400 @2x)
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
│   ├── generate.mjs        ← AI生成（DeepSeek API → JSON）
│   ├── render.mjs          ← 渲染器（JSON → HTML）
│   ├── pipeline.mjs        ← 统一入口（渲染 + 截图）
│   └── screenshot.mjs      ← Playwright 截图
├── fonts/                  ← 本地字体（得意黑、Orbitron等）
├── SKILL.md                ← 完整规格文档
└── output/                 ← 产出目录
```

## 快速开始

```bash
# 安装
git clone https://github.com/zhangziyana007-sudo/AINewsSkill.git
cd AINewsSkill
npm install && npx playwright install chromium
npm link

# 设置密钥
export DEEPSEEK_API_KEY="sk-xxx"

# 一键运行
ainews run
```

## 使用方式

```bash
# 全流程（推荐）
ainews run                          # AI生成 → 渲染 → 截图
ainews run --force                  # 强制重新生成
ainews run --project=ai-daily-0520  # 指定项目名

# 分步执行
ainews generate --output=./output/ai-daily-0520/data.json
ainews render --input=./output/ai-daily-0520/data.json

# 帮助
ainews help
```

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
| DEEPSEEK_API_KEY | ✅ | DeepSeek API 密钥 |
| AI_BASE_URL | ❌ | 自定义API地址（默认 https://api.deepseek.com） |
| AI_MODEL | ❌ | 模型名称（默认 deepseek-chat） |

## 设计原则

- **AI 零设计责任**：AI 只输出结构化 JSON，不碰 HTML/CSS
- **100% 确定性渲染**：同一份 JSON 永远输出相同的图片
- **本地字体**：不依赖任何 CDN，字体文件全部本地加载
- **固定装饰**：扫描线、发光球等写死在模板中
