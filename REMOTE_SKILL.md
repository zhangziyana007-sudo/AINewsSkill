---
name: AI 大模型早报（远程模式）
description: 通过 HTTP 拉取已发布的每日 AI 大模型新闻早报与小红书图文素材，无需本地部署
version: 1.0
mode: remote
---

# AI 大模型早报 · 远程 Skill 模式

**零部署**：你（AI Agent）只需要这一个文件，所有数据通过 HTTP 拉取，**不需要 clone 仓库、不需要装 Node、不需要 API 密钥**。

后端每天北京时间 8:30 自动跑 GitHub Actions，生成数据 + 7 张图 + 小红书图文素材并提交到仓库。

## 资源地址

```
基础：https://raw.githubusercontent.com/zhangziyana007-sudo/AINewsSkill/main
```

| 资源 | URL | 用途 |
|---|---|---|
| **今日早报数据** | `${BASE}/output/api/latest.json` | 包含 20 条新闻摘要 + 图片 URL + 小红书素材链接 |
| **历史索引** | `${BASE}/output/api/history.json` | 全部历史日期列表 |
| **指定某天** | `${BASE}/output/api/2026-05-23.json` | 按日期归档 |
| **小红书完整素材包** | `latest.json.xhsPackageUrl` 字段 | 一键复制：标题+正文+话题 |
| **图片** | `latest.json.imageUrls[]` | 7 张 1080×1440 PNG（GitHub Release 托管，不占仓库体积），直接拿来用 |
| **原始数据** | `latest.json.dataUrl` 字段 | 完整 data.json，含分页结构 |

> **图片存储说明**：图片不在 git 仓库里，而是托管在 GitHub Release（tag 名 `daily-YYYY-MM-DD`），保留最近 30 天。**你不需要关心 URL 来源，直接用 `latest.json.imageUrls[]` 即可。**

## latest.json 字段说明

```jsonc
{
  "version": "1.0",
  "date": "2026.05.23",
  "generatedAt": "2026-05-23T00:30:00.000Z",
  "title": ["2026.05.23", "AI 大模型新闻早报"],
  "subtitle": "旗舰模型发布·浏览器智能体·API速度竞速",
  "items": [
    {
      "title": "【阿里】发布Qwen3.7-Max旗舰模型",
      "keyFact": "100万token上下文，35小时自主任务调用工具过千次。",
      "impact": "Agent能力跃迁，企业级应用场景拓展。",
      "category": "model",
      "icon": "🤖"
    }
    // ... 20 条
  ],
  "totalItems": 20,
  "imageUrls": [
    "https://github.com/.../releases/download/daily-2026-05-23/page1.png",
    "https://github.com/.../releases/download/daily-2026-05-23/page2.png"
    // ... 7 张，GitHub Release 托管
  ],
  "releaseTag": "daily-2026-05-23",
  "releaseUrl": "https://github.com/zhangziyana007-sudo/AINewsSkill/releases/tag/daily-2026-05-23",
  "xhsPackageUrl": "https://raw.githubusercontent.com/.../xhs-package.txt",
  "xhsPackageMdUrl": "https://raw.githubusercontent.com/.../xhs-package.md",
  "dataUrl": "https://raw.githubusercontent.com/.../data.json"
}
```

## AI 使用示例

### 场景 1：用户问"今天有什么 AI 新闻"

```
GET https://raw.githubusercontent.com/zhangziyana007-sudo/AINewsSkill/main/output/api/latest.json
→ 拿 items 数组，挑 5-10 条用 keyFact 总结给用户
→ 附上 imageUrls[0] 让用户看封面
```

### 场景 2：用户说"帮我发小红书"

```
GET latest.json
→ 取 xhsPackageUrl
GET <xhsPackageUrl>
→ 拿到完整文案（标题+正文+15个话题标签）
→ 直接交给用户，告诉用户 imageUrls 里的 7 张图全部上传到小红书
```

### 场景 3：用户问"5月20日那期是什么"

```
GET https://raw.githubusercontent.com/zhangziyana007-sudo/AINewsSkill/main/output/api/2026-05-20.json
```

### 场景 4：用户问"最近几期新闻趋势"

```
GET https://raw.githubusercontent.com/zhangziyana007-sudo/AINewsSkill/main/output/api/history.json
→ 拿到日期列表
→ 并行 GET 多个日期 JSON 做趋势对比
```

## 不要做的事

- ❌ 不要尝试 `git clone` 或 `npm install`
- ❌ 不要尝试调用 DeepSeek API 自己生成（这个 skill 不暴露 API 密钥）
- ❌ 不要修改 raw URL 的路径结构（已固定）
- ❌ 不要假设数据格式以外的字段存在

## ⚠️ 内容合规提示（必读）

本 skill 提供的所有文本（`items`、`xhs-package.txt` 等）均由 **DeepSeek 大模型基于第三方 RSS 数据生成**，可能存在：
- 事实性错误、夸大表述、过时信息
- AI 生成内容（部分平台要求标注 AIGC）
- 第三方版权内容（厂商名、产品名、报道引用）

**直接发布到任何公开平台前，必须**：
1. 由用户**人工审阅一遍**核心数据点
2. 按所在平台规定**标注 AIGC**（小红书/抖音/B站等都要求）
3. 不要承诺产品功能 / 投资建议 / 医疗法律建议
4. 不要伪造为权威媒体或厂商官方信息

AI 在向用户输出文案时，**应明确告知用户这是 AI 生成内容，需要人工审核**。

## 高级模式：主动触发新一期

如果用户希望"立即生成最新一期"（不等明天 8:30 cron），需要用户提供 GitHub PAT（具备 `actions: write` 权限）：

```bash
curl -X POST \
  -H "Authorization: Bearer <USER_GITHUB_PAT>" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/zhangziyana007-sudo/AINewsSkill/actions/workflows/daily.yml/dispatches" \
  -d '{"ref":"main"}'
# 等约 5 分钟后重新 GET latest.json，会拿到新数据
```

⚠️ 必须由**用户主动提供** PAT，AI 不能假设或硬编码任何 token。

## 数据更新频率

- **自动**：GitHub Actions cron 每天北京时间 8:30 跑一次
- **手动**：用户用 workflow_dispatch 触发
- **延迟**：GH Actions cron 实际有 30-90 分钟延迟，所以早上 9:00-10:00 之间数据一般已就绪

## 故障排查

| 现象 | 可能原因 | 处理 |
|---|---|---|
| 404 | 当天 workflow 还没跑完 | 等到 9:30 后重试 |
| `imageUrls` 是空数组 | 当天图片渲染失败 | 用 `subtitle` + `items` 文本展示 |
| 内容跟今日实际新闻有出入 | cron 抓取窗口前 24 小时 | 这是预期，不是 bug |

---

仓库：https://github.com/zhangziyana007-sudo/AINewsSkill  
本地 CLI 模式：见 [SKILL.md](SKILL.md) 和 [README.md](README.md)
