---
name: ai-news-daily
description: 每日AI大模型早报 · 小红书图文全自动化（AI生成 → 渲染截图）
version: 6.0.0
author: zizaya
license: MIT
platforms: [linux, macos]
prerequisites:
  commands: [node, ainews]
  packages: [playwright]
  env: [DEEPSEEK_API_KEY]
metadata:
  hermes:
    tags: [小红书, XHS, AI早报, 大模型, 新闻, 自动化, DeepSeek]
    category: social-media
---

# 每日AI大模型早报（Top 10）

> 一键生成：DeepSeek AI 直接生成结构化数据 → 渲染截图。全自动 CLI 驱动。

---

## 一键运行

```bash
export DEEPSEEK_API_KEY="sk-xxx"
ainews run
```

自动完成：AI直接生成10条早报 → 渲染HTML → 截图PNG（1800×2400px）

---

## 工作流总览

```
ainews run
  │
  ├─ STEP 1 · ainews generate（DeepSeek API）
  │  → AI 基于模型知识生成 Top 10 结构化数据
  │  → output/{topic}/data.json
  │
  └─ STEP 2 · ainews render
     → HTML → PNG（1800×2400px @2x）
     → output/{topic}/images/*.png
```

---

## AI 提示词规格

### 筛选标准
- 仅保留影响力最大、确定性高的核心动态
- 核心关注：大模型版本更新、API/订阅价格变动

### 重点监控厂商
- **国际**：OpenAI、Google、Microsoft、Anthropic、Meta、xAI
- **国内**：DeepSeek、智谱AI、月之暗面、阿里、百度、字节、腾讯、小米

### 信息卡片格式（每条固定结构）

| 字段 | 规则 | 示例 |
|------|------|------|
| title | 【厂商】+ 核心动作（≤20字） | 【Google】发布 Gemini 3.5 Flash |
| keyFact | 一句话关键事实（≤50字） | 推理速度提升4倍，API成本降低50% |
| impact | 影响分析（≤30字） | 价格战加剧，中小厂商压力增大 |

---

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
        {"rank": 1, "title": "【厂商】核心动作", "source": "来源", "icon": "zap"},
        {"rank": 2, "title": "【厂商】核心动作", "source": "来源", "icon": "cpu"},
        {"rank": 3, "title": "【厂商】核心动作", "source": "来源", "icon": "rocket"},
        {"rank": 4, "title": "【厂商】核心动作", "source": "来源", "icon": "brain"}
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
      "meta": "数据来源：量子位 / 36氪 / 机器之心"
    }
  ]
}
```

### 分页规则
- cover 固定 4 条 previews
- news 第1页 5 条 + 第2页 5 条 = 共 10 条
- 总输出：3张图（封面 + 续页 + 结尾）

### icon 可选值

`zap` · `cpu` · `robot` · `code` · `sparkles` · `globe` · `rocket` · `brain`

---

## CLI 命令

```bash
# 全流程
ainews run                          # 一键全自动
ainews run --force                  # 强制重新生成JSON
ainews run --project=ai-daily-0520  # 指定项目名

# 分步执行
ainews generate --output=Y          # AI生成JSON
ainews render --input=X              # 渲染出图

# 帮助
ainews help
```

---

## 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| DEEPSEEK_API_KEY | ✅ | DeepSeek API 密钥 |
| AI_BASE_URL | ❌ | 自定义API地址（默认 https://api.deepseek.com） |
| AI_MODEL | ❌ | 模型名称（默认 deepseek-chat） |

---

## 安装

```bash
git clone https://github.com/zhangziyana007-sudo/AINewsSkill.git
cd AINewsSkill
npm install && npx playwright install chromium
npm link  # 注册全局 ainews 命令
export DEEPSEEK_API_KEY="sk-xxx"
```

### 字体（放入 fonts/ 目录）
- 得意黑：https://github.com/atelier-anchor/smiley-sans/releases
- Orbitron：https://fonts.google.com/specimen/Orbitron
- JetBrains Mono：https://www.jetbrains.com/lp/mono/
