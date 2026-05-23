#!/usr/bin/env node
/**
 * ainews — 每日 AI 大模型早报 · 小红书图文自动化 CLI
 *
 * 编写规则：一个脚本对应一条 CLI 命令，每条命令代表工作流的一个环节。
 *
 * 工作流命令（按顺序执行即可完成全流程）：
 *   ainews fetch    [选项]              ⓪ 拉取新闻素材 → search-results.json
 *   ainews generate [选项]              ① DeepSeek 结构化 → data.json
 *   ainews render   [选项]              ② 渲染 HTML 页面 → pages/*.html
 *   ainews shot     [选项]              ③ Playwright 截图 → images/*.png
 *   ainews feishu   [选项]              ④ 推送到飞书
 *   ainews publish  [选项]              ⑤ 生成对外 API JSON
 *   ainews xhs-pkg  [选项]              ⑥ 生成小红书发布素材包 → xhs-package.md/.txt
 *
 * 编排命令：
 *   ainews run      [选项]              一键串联 ⓪→⑤ 全流程
 *   ainews serve                        启动 HTTP API 服务
 *   ainews help                         显示帮助
 */

import { resolve, join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const SCRIPTS = join(ROOT, 'scripts');

// ── 参数解析 ─────────────────────────────────────
const [command, ...rawArgs] = process.argv.slice(2);
const flags = Object.fromEntries(
  rawArgs
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v === undefined ? true : v];
    })
);

// ── 工具函数 ─────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function projectDir(project) {
  return join(ROOT, 'output', project || `ai-daily-${todayStr()}`);
}

function runScript(name, extra = '') {
  execSync(`node ${join(SCRIPTS, name)}${extra ? ' ' + extra : ''}`, {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

// ── 命令路由 ─────────────────────────────────────
const COMMANDS = {
  fetch: cmdFetch,
  generate: cmdGenerate,
  render: cmdRender,
  shot: cmdShot,
  feishu: cmdFeishu,
  publish: cmdPublish,
  'xhs-pkg': cmdXhsPkg,
  'xhs-package': cmdXhsPkg,
  run: cmdRun,
  serve: cmdServe,
  help: showHelp,
  '--help': showHelp,
  '-h': showHelp,
};

const handler = COMMANDS[command || 'help'];
if (!handler) {
  console.error(`❌ 未知命令: ${command}\n`);
  showHelp();
  process.exit(1);
}
try {
  await handler();
} catch (err) {
  console.error(`\n❌ 命令执行失败: ${err.message}`);
  process.exit(err.status || 1);
}

// ── ⓪ 拉取新闻素材 ─────────────────────────────────
async function cmdFetch() {
  const project = flags.project || `ai-daily-${todayStr()}`;
  const out = flags.output || join(projectDir(project), 'search-results.json');
  console.log('⓪ 拉取新闻素材 → AI HOT(主) / Tavily(备)');
  runScript('search-news.mjs', `--output=${out}`);
  console.log(`✅ 素材已存盘：${out}`);
}

// ── ① DeepSeek 结构化生成 ───────────────────────────
async function cmdGenerate() {
  const project = flags.project || `ai-daily-${todayStr()}`;
  const dir = projectDir(project);
  const out = flags.output || join(dir, 'data.json');
  const context = flags.context || join(dir, 'search-results.json');
  if (!process.env.DEEPSEEK_API_KEY && !process.env.AI_API_KEY) {
    console.error('❌ 缺少 API 密钥：export DEEPSEEK_API_KEY="sk-xxx"');
    process.exit(1);
  }
  const ctxFlag = existsSync(context) ? ` --context=${context}` : '';
  console.log('① DeepSeek 结构化 → data.json');
  runScript('generate.mjs', `--output=${out}${ctxFlag}`);
  console.log(`✅ 结构化数据：${out}`);
}

// ── ② 渲染 HTML ──────────────────────────────────
async function cmdRender() {
  const project = flags.project || `ai-daily-${todayStr()}`;
  const dir = projectDir(project);
  const input = flags.input || join(dir, 'data.json');
  const out = flags.output || join(dir, 'pages');
  if (!existsSync(input)) {
    console.error(`❌ 找不到数据文件：${input}\n请先 ainews generate`);
    process.exit(1);
  }
  console.log('② 渲染 HTML → pages/');
  runScript('render.mjs', `--input=${input} --output=${out}`);
  console.log(`✅ HTML 页面：${out}`);
}

// ── ③ Playwright 截图 ────────────────────────────
async function cmdShot() {
  const project = flags.project || `ai-daily-${todayStr()}`;
  const dir = projectDir(project);
  const input = flags.input || join(dir, 'pages');
  const out = flags.output || join(dir, 'images');
  if (!existsSync(input)) {
    console.error(`❌ 找不到 HTML 目录：${input}\n请先 ainews render`);
    process.exit(1);
  }
  console.log('③ Playwright 截图 → images/');
  runScript('screenshot.mjs', `--input=${input} --output=${out}`);
  console.log(`✅ PNG 图片：${out}`);
}

// ── ④ 飞书推送 ──────────────────────────────────
async function cmdFeishu() {
  const project = flags.project || `ai-daily-${todayStr()}`;
  const input = flags.input || projectDir(project);
  if (!process.env.FEISHU_WEBHOOK_URL) {
    console.error('❌ 缺少 FEISHU_WEBHOOK_URL，跳过');
    process.exit(1);
  }
  console.log('④ 飞书推送');
  runScript('push-feishu.mjs', `--input=${input}`);
}

// ── ⑤ 发布 API JSON ─────────────────────────────
async function cmdPublish() {
  const project = flags.project || `ai-daily-${todayStr()}`;
  const input = flags.input || projectDir(project);
  console.log('⑤ 发布对外 API JSON');
  runScript('publish-api.mjs', `--input=${input}`);
}
// ── ⑥ 小红书素材包 ──────────────────────────────
async function cmdXhsPkg() {
  const project = flags.project || `ai-daily-${todayStr()}`;
  const input = flags.input || projectDir(project);
  const topN = flags.topN ? ` --topN=${flags.topN}` : '';
  const aiFlag = flags.ai ? ' --ai' : '';
  if (!existsSync(join(input, 'data.json'))) {
    console.error(`❌ 找不到 ${input}/data.json，请先 ainews generate`);
    process.exit(1);
  }
  console.log('⑥ 生成小红书发布素材包' + (flags.ai ? '（AI 增强）' : ''));
  runScript('xhs-package.mjs', `--input=${input}${topN}${aiFlag}`);
}
// ── 编排：一键全流程 ────────────────────────────
async function cmdRun() {
  const project = flags.project || `ai-daily-${todayStr()}`;
  const dir = projectDir(project);
  const dataJson = join(dir, 'data.json');

  console.log('🚀 AI 早报全流程启动');
  console.log('═══════════════════════════════════════\n');

  console.log('── 阶段⓪ 拉取新闻素材 ────────────────────');
  try {
    await cmdFetch();
  } catch (_) {
    console.warn('⚠️ 素材拉取失败，DeepSeek 将基于训练知识自行生成（可能不是最新内容）');
  }
  console.log('');

  console.log('── 阶段① AI 生成 ──────────────────────');
  if (existsSync(dataJson) && !flags.force) {
    console.log(`✅ 发现已有 JSON：${dataJson}（加 --force 强制重生）`);
  } else {
    await cmdGenerate();
  }
  console.log('');

  console.log('── 阶段② 渲染 HTML ─────────────────────');
  await cmdRender();
  console.log('');

  console.log('── 阶段③ 截图出图 ──────────────────────');
  await cmdShot();
  console.log('');
  console.log(`✅ 主流程完成！图片：${join(dir, 'images')}`);

  if (process.env.FEISHU_WEBHOOK_URL) {
    console.log('\n── 阶段④ 飞书推送 ─────────────────────');
    await cmdFeishu();
  }

  console.log('\n── 阶段⑤ 发布 API ─────────────────────');
  await cmdPublish();

  console.log('\n── 阶段⑥ 小红书素材包 ─────────────────');
  await cmdXhsPkg();
}

// ── HTTP 服务 ───────────────────────────────────
function cmdServe() {
  runScript('server.mjs');
}

// ── 帮助 ────────────────────────────────────────
function showHelp() {
  console.log(`
ainews — 每日 AI 大模型早报 · 小红书图文自动化 CLI

工作流命令（每条命令对应一个环节，可独立执行也可串联）：
  ainews fetch     [选项]    ⓪ 拉取新闻素材   → search-results.json
  ainews generate  [选项]    ① DeepSeek 结构化 → data.json
  ainews render    [选项]    ② 渲染 HTML 页面  → pages/*.html
  ainews shot      [选项]    ③ Playwright 截图 → images/*.png
  ainews feishu    [选项]    ④ 推送到飞书
  ainews publish   [选项]    ⑤ 发布对外 API JSON
  ainews xhs-pkg   [选项]    ⑥ 生成小红书发布素材包（标题/正文/话题/图片）

编排命令：
  ainews run       [选项]    一键串联 ⓪→⑤ 全流程
  ainews serve               启动 HTTP API 服务
  ainews help                显示本帮助

通用选项：
  --project=NAME             项目名（默认 ai-daily-MMDD）
  --input=PATH               指定输入路径（覆盖默认）
  --output=PATH              指定输出路径（覆盖默认）
  --force                    run 时强制重新生成已存在的 data.json

环境变量：
  DEEPSEEK_API_KEY           DeepSeek 密钥（generate 必需）
  AI_BASE_URL / AI_MODEL     模型自定义（默认 deepseek-v4-pro）
  TAVILY_API_KEY             Tavily 备用搜索（fetch 主源是 AI HOT，无需 token）
  AIHOT_CATEGORY             AI HOT 分类（默认 ai-models）
  AIHOT_SINCE_HOURS          时间窗口（默认 24h，量少时自动扩到 48h）
  AI_TARGET_COUNT            精选新闻条数（默认 20）
  FEISHU_WEBHOOK_URL         飞书 Webhook（feishu 命令必需）
  FEISHU_APP_ID / FEISHU_APP_SECRET  飞书应用凭证（可选，启用图片上传）

典型用法：
  # 一键全流程
  ainews run

  # 仅重新出图（数据已存在）
  ainews render && ainews shot

  # 只发飞书
  ainews feishu --project=ai-daily-0523

  # 指定项目目录
  ainews run --project=ai-daily-test
`);
}
