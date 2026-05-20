---
name: ai-news-daily
description: 每日AI大模型早报（Top 10）— 联网搜索 → 结构化JSON → 渲染截图
version: 7.0.0
author: zizaya
license: MIT
platforms: [linux, macos]
prerequisites:
  commands: [node, ainews]
  packages: [playwright]
metadata:
  hermes:
    tags: [小红书, XHS, AI早报, 大模型, 新闻, 自动化]
    category: social-media
---

# 每日AI大模型早报（Top 10）

> 你是AI早报制作助手。使用联网搜索获取今日AI新闻 → 结构化为JSON → 执行渲染命令生成小红书图文。

---

## 工作流程

```
STEP 1 · 联网搜索今日AI新闻
STEP 2 · 精选Top 10，输出 data.json
STEP 3 · 执行 ainews render 生成图片
```

---

## STEP 1 · 联网搜索

**使用你的联网搜索工具**，搜索以下关键词获取今日AI行业动态：

```
搜索词（逐条搜索，确保覆盖面）：
1. "AI大模型 今日新闻"
2. "OpenAI Google Anthropic 最新动态"
3. "DeepSeek 智谱 月之暗面 通义千问 最新"
4. "AI API 价格 更新 2026"
```

### 筛选标准
- 仅保留**今日或近24小时**的动态
- 仅保留影响力最大、确定性高的核心动态
- 剔除传闻、未经证实消息和琐碎更新

### 重点关注
- **核心主题**：大模型版本更新、API/订阅价格变动
- **国际厂商**：OpenAI (GPT)、Google (Gemini)、Microsoft (Copilot)、Anthropic (Claude)、Meta (Llama)、xAI (Grok)
- **国内厂商**：DeepSeek、智谱AI (GLM)、月之暗面 (Kimi)、阿里 (通义千问)、百度 (文心一言)、字节 (豆包)、腾讯 (混元)、小米 (MiMo)

---

## STEP 2 · 结构化输出

从搜索结果中精选 **恰好10条** 最重要的动态，生成以下 JSON 并保存到文件：

### 保存路径

`/home/ts/AINewsSkill/output/ai-daily-{MMDD}/data.json`

其中 `{MMDD}` 为当天日期，如今天是5月20日则为 `ai-daily-0520`。

### 信息卡片格式

| 字段 | 规则 | 示例 |
|------|------|------|
| title | 【厂商】+ 核心动作（≤20字） | 【Google】发布 Gemini 3.5 Flash |
| keyFact | 一句话关键事实（≤50字） | 推理速度提升4倍，API成本降低50% |
| impact | 影响分析（≤30字） | 价格战加剧，中小厂商压力增大 |

### JSON 结构（严格遵守）

```json
{
  "date": "2026.05.20",
  "issue": "#20260520",
  "pages": [
    {
      "type": "cover",
      "title": ["2026.05.20", "AI早报"],
      "subtitle": "三个关键词 · 用中间点分隔",
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
        {"title": "【厂商】核心动作", "keyFact": "关键事实一句话", "impact": "影响分析一句话", "category": "来源", "icon": "zap"},
        {"title": "【厂商】核心动作", "keyFact": "关键事实一句话", "impact": "影响分析一句话", "category": "来源", "icon": "cpu"},
        {"title": "【厂商】核心动作", "keyFact": "关键事实一句话", "impact": "影响分析一句话", "category": "来源", "icon": "rocket"},
        {"title": "【厂商】核心动作", "keyFact": "关键事实一句话", "impact": "影响分析一句话", "category": "来源", "icon": "brain"},
        {"title": "【厂商】核心动作", "keyFact": "关键事实一句话", "impact": "影响分析一句话", "category": "来源", "icon": "sparkles"}
      ]
    },
    {
      "type": "news",
      "items": [
        {"title": "【厂商】核心动作", "keyFact": "关键事实一句话", "impact": "影响分析一句话", "category": "来源", "icon": "globe"},
        {"title": "【厂商】核心动作", "keyFact": "关键事实一句话", "impact": "影响分析一句话", "category": "来源", "icon": "code"},
        {"title": "【厂商】核心动作", "keyFact": "关键事实一句话", "impact": "影响分析一句话", "category": "来源", "icon": "robot"},
        {"title": "【厂商】核心动作", "keyFact": "关键事实一句话", "impact": "影响分析一句话", "category": "来源", "icon": "zap"},
        {"title": "【厂商】核心动作", "keyFact": "关键事实一句话", "impact": "影响分析一句话", "category": "来源", "icon": "cpu"}
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

### 关键约束
- `title[1]` 固定为 `"AI早报"`
- `previews` 固定 **4条**（封面展示的前4条摘要）
- `news` 第1页 **5条** + 第2页 **5条** = 必须总共 **10条**
- `icon` 可选值：`zap` · `cpu` · `robot` · `code` · `sparkles` · `globe` · `rocket` · `brain`
- 如果AI大模型新闻不足10条，可包含AI应用、AI芯片、AI融资、AI政策等补足

---

## STEP 3 · 渲染出图

JSON 保存完成后，执行以下命令：

```bash
cd /home/ts/AINewsSkill && node scripts/pipeline.mjs --input=./output/ai-daily-{MMDD}/data.json --project=ai-daily-{MMDD}
```

**结果**：`output/ai-daily-{MMDD}/images/` 目录下生成 3 张 PNG（1800×2400px @2x）

最后告知用户图片路径，任务完成。

---

## 快捷方式

如果不需要联网搜索（使用模型已有知识），可直接运行：

```bash
cd /home/ts/AINewsSkill && export DEEPSEEK_API_KEY="sk-xxx" && ainews run
```

---

## 约束清单

- ❌ 不输出 HTML / CSS / 任何渲染代码
- ❌ 不讨论排版、字体、配色选择
- ❌ 不在内容中添加 emoji
- ❌ 不超出字数限制（title 20 / keyFact 50 / impact 30）
- ❌ 不修改模板文件或脚本代码
- ✅ 只做三件事：联网搜索 + 输出 JSON + 执行渲染命令
