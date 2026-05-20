#!/usr/bin/env node
/**
 * ainews — AI 日报小红书图文自动化 CLI
 *
 * 命令：
 *   ainews fetch [--limit=N] [--output=PATH]    获取新闻素材
 *   ainews render --input=<json> [--project=X]  渲染 JSON → HTML → PNG
 *   ainews run [--limit=N] [--project=X]        全流程（fetch + 等待JSON + render）
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
  case 'fetch':
    await cmdFetch();
    break;
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

async function cmdFetch() {
  const limit = flags.limit || 10;
  const output = flags.output || join(ROOT, 'output', 'raw-news.md');

  console.log('📡 获取新闻素材...');
  console.log(`   源数量: 3 | 每源限制: ${limit} 条`);
  console.log(`   输出: ${output}\n`);

  execSync(`node ${join(SCRIPTS, 'fetch-news.mjs')} --limit=${limit} --output=${output}`, {
    cwd: ROOT,
    stdio: 'inherit',
  });

  console.log(`\n✅ 素材已保存到: ${output}`);
}

async function cmdGenerate() {
  const input = flags.input || join(ROOT, 'output', 'raw-news.md');
  const output = flags.output || join(ROOT, 'output', 'data.json');

  console.log('🤖 AI 生成结构化数据...');
  execSync(`node ${join(SCRIPTS, 'generate.mjs')} --input=${input} --output=${output}`, {
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
  const limit = flags.limit || 10;
  const project = flags.project || `ai-daily-${todayStr()}`;
  const outputMd = join(ROOT, 'output', 'raw-news.md');
  const dataJson = join(ROOT, 'output', project, 'data.json');

  console.log('🚀 AI 日报全流程启动');
  console.log('═══════════════════════════════════════\n');

  // 阶段 1：获取新闻
  if (!flags['skip-fetch']) {
    console.log('── 阶段① 获取新闻 ──────────────────────');
    execSync(`node ${join(SCRIPTS, 'fetch-news.mjs')} --limit=${limit} --output=${outputMd}`, {
      cwd: ROOT,
      stdio: 'inherit',
    });
    console.log(`✅ 素材: ${outputMd}\n`);
  }

  // 阶段 2：AI 结构化生成
  console.log('── 阶段② AI 结构化 ─────────────────────');
  if (existsSync(dataJson) && !flags['force']) {
    console.log(`✅ 发现已有 JSON: ${dataJson}`);
  } else {
    if (!process.env.DEEPSEEK_API_KEY && !process.env.AI_API_KEY) {
      console.error('❌ 缺少 API 密钥，请设置环境变量：');
      console.error('   export DEEPSEEK_API_KEY="sk-xxx"');
      process.exit(1);
    }
    execSync(`node ${join(SCRIPTS, 'generate.mjs')} --input=${outputMd} --output=${dataJson}`, {
      cwd: ROOT,
      stdio: 'inherit',
    });
    console.log('');
  }

  // 阶段 3：渲染
  console.log('\n── 阶段③ 渲染出图 ─────────────────────');
  execSync(`node ${join(SCRIPTS, 'pipeline.mjs')} --input=${dataJson} --project=${project}`, {
    cwd: ROOT,
    stdio: 'inherit',
  });

  const outputDir = join(ROOT, 'output', project, 'images');
  console.log(`\n✅ 全流程完成！图片: ${outputDir}`);
}

function showHelp() {
  console.log(`
ainews — AI 日报小红书图文自动化 CLI

命令:
  ainews fetch [选项]         获取新闻素材（RSS聚合）
  ainews generate --input=X  AI 生成结构化 JSON
  ainews render --input=X    渲染 JSON → HTML → PNG
  ainews run [选项]           全流程（fetch → AI生成 → render）
  ainews help                显示本帮助

fetch 选项:
  --limit=N                  每个源获取条数（默认 10）
  --output=PATH              输出文件路径（默认 output/raw-news.md）

generate 选项:
  --input=PATH               素材文件路径（默认 output/raw-news.md）
  --output=PATH              输出 JSON 路径

render 选项:
  --input=PATH               JSON 数据文件路径（必需）
  --project=NAME             项目名（默认从 JSON 读取）

run 选项:
  --limit=N                  每个源获取条数（默认 10）
  --project=NAME             项目名（默认 ai-daily-MMDD）
  --skip-fetch               跳过新闻获取，直接用已有素材
  --force                    强制重新生成 JSON（即使已存在）

环境变量:
  DEEPSEEK_API_KEY           DeepSeek API 密钥（必需）
  AI_BASE_URL                自定义 API 地址（默认 https://api.deepseek.com）
  AI_MODEL                   模型名称（默认 deepseek-chat）

示例:
  ainews fetch --limit=15
  ainews generate --input=./output/raw-news.md --output=./output/ai-daily-0521/data.json
  ainews render --input=./output/ai-daily-0521/data.json
  ainews run                 # 一键全流程
`);
}

function todayStr() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
