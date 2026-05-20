#!/usr/bin/env node
/**
 * ainews — 每日AI大模型早报 · 小红书图文自动化 CLI
 *
 * 命令：
 *   ainews generate [--output=PATH]             AI 生成结构化 JSON
 *   ainews render --input=<json> [--project=X]  渲染 JSON → HTML → PNG
 *   ainews run [--project=X]                    全流程（AI生成 → render）
 *   ainews help                                 显示帮助
 */

import { resolve, join, dirname } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
      return [k, v || true];
    })
);

// ── 命令路由 ─────────────────────────────────────
switch (command) {
  case 'generate':
    await cmdGenerate();
    break;
  case 'render':
    await cmdRender();
    break;
  case 'run':
    await cmdRun();
    break;
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    showHelp();
    break;
  default:
    console.error(`❌ 未知命令: ${command}\n`);
    showHelp();
    process.exit(1);
}

// ── 命令实现 ─────────────────────────────────────

async function cmdGenerate() {
  const output = flags.output || join(ROOT, 'output', 'data.json');

  console.log('🤖 AI 生成结构化数据...');
  execSync(`node ${join(SCRIPTS, 'generate.mjs')} --output=${output}`, {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

async function cmdRender() {
  const input = flags.input;
  if (!input) {
    console.error('❌ 必须指定 --input=<json路径>');
    console.error('   例: ainews render --input=./output/ai-daily-0521/data.json');
    process.exit(1);
  }

  const inputPath = resolve(input);
  if (!existsSync(inputPath)) {
    console.error(`❌ 文件不存在: ${inputPath}`);
    process.exit(1);
  }

  // 从 JSON 中提取 topic 或使用参数
  const data = JSON.parse(readFileSync(inputPath, 'utf-8'));
  const project = flags.project || data.topic || `ai-daily-${todayStr()}`;

  console.log('🎨 渲染出图...');
  console.log(`   数据: ${inputPath}`);
  console.log(`   项目: ${project}\n`);

  execSync(`node ${join(SCRIPTS, 'pipeline.mjs')} --input=${inputPath} --project=${project}`, {
    cwd: ROOT,
    stdio: 'inherit',
  });

  const outputDir = join(ROOT, 'output', project, 'images');
  console.log(`\n✅ 图片已生成: ${outputDir}`);
}

async function cmdRun() {
  const project = flags.project || `ai-daily-${todayStr()}`;
  const dataJson = join(ROOT, 'output', project, 'data.json');

  console.log('🚀 AI 早报全流程启动');
  console.log('═══════════════════════════════════════\n');

  // 阶段 1：AI 结构化生成
  console.log('── 阶段① AI 生成 ──────────────────────');
  if (existsSync(dataJson) && !flags['force']) {
    console.log(`✅ 发现已有 JSON: ${dataJson}`);
  } else {
    if (!process.env.DEEPSEEK_API_KEY && !process.env.AI_API_KEY) {
      console.error('❌ 缺少 API 密钥，请设置环境变量：');
      console.error('   export DEEPSEEK_API_KEY="sk-xxx"');
      process.exit(1);
    }
    execSync(`node ${join(SCRIPTS, 'generate.mjs')} --output=${dataJson}`, {
      cwd: ROOT,
      stdio: 'inherit',
    });
    console.log('');
  }

  // 阶段 2：渲染
  console.log('\n── 阶段② 渲染出图 ─────────────────────');
  execSync(`node ${join(SCRIPTS, 'pipeline.mjs')} --input=${dataJson} --project=${project}`, {
    cwd: ROOT,
    stdio: 'inherit',
  });

  const outputDir = join(ROOT, 'output', project, 'images');
  console.log(`\n✅ 全流程完成！图片: ${outputDir}`);
}

function showHelp() {
  console.log(`
ainews — 每日AI大模型早报 · 小红书图文自动化 CLI

命令:
  ainews generate [选项]     AI 生成结构化 JSON（基于模型知识）
  ainews render --input=X    渲染 JSON → HTML → PNG
  ainews run [选项]           全流程（AI生成 → render）
  ainews help                显示本帮助

generate 选项:
  --output=PATH              输出 JSON 路径

render 选项:
  --input=PATH               JSON 数据文件路径（必需）
  --project=NAME             项目名（默认从 JSON 读取）

run 选项:
  --project=NAME             项目名（默认 ai-daily-MMDD）
  --force                    强制重新生成 JSON（即使已存在）

环境变量:
  DEEPSEEK_API_KEY           DeepSeek API 密钥（必需）
  AI_BASE_URL                自定义 API 地址（默认 https://api.deepseek.com）
  AI_MODEL                   模型名称（默认 deepseek-chat）

示例:
  ainews generate --output=./output/ai-daily-0521/data.json
  ainews render --input=./output/ai-daily-0521/data.json
  ainews run                 # 一键全流程
`);
}

function todayStr() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
