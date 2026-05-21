#!/usr/bin/env node
/**
 * AINewsSkill HTTP API 服务
 *
 * 端点:
 *   GET  /api/latest          最新一期数据（含图片URL）
 *   GET  /api/history         历史索引列表
 *   GET  /api/:date           指定日期的数据（如 /api/2026-05-21）
 *   GET  /api/images/:file    图片文件（最新一期）
 *   POST /api/generate        触发生成（需 ?token=xxx 验证）
 *
 * 环境变量:
 *   PORT          监听端口（默认 3721）
 *   API_TOKEN     POST 接口鉴权 token（可选，不设则禁用 POST）
 *
 * 用法:
 *   node scripts/server.mjs
 *   ainews serve
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const API_DIR = join(ROOT, 'output', 'api');
const OUTPUT_DIR = join(ROOT, 'output');
const PORT = parseInt(process.env.PORT || '3721', 10);
const API_TOKEN = process.env.API_TOKEN || '';

// ── MIME 类型 ────────────────────────────────────
const MIME = {
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.html': 'text/html; charset=utf-8',
};

// ── 工具函数 ────────────────────────────────────
function sendJSON(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function sendFile(res, filePath) {
  if (!existsSync(filePath)) {
    sendJSON(res, { error: 'Not found' }, 404);
    return;
  }
  const ext = extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  const data = readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': mime,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=300',
  });
  res.end(data);
}

function getLatestProject() {
  if (!existsSync(OUTPUT_DIR)) return null;
  const dirs = readdirSync(OUTPUT_DIR)
    .filter(d => d.startsWith('ai-daily-') && existsSync(join(OUTPUT_DIR, d, 'data.json')))
    .sort()
    .reverse();
  return dirs[0] || null;
}

// ── 路由处理 ────────────────────────────────────
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // GET /api/latest
  if (path === '/api/latest' && req.method === 'GET') {
    const filePath = join(API_DIR, 'latest.json');
    if (existsSync(filePath)) {
      sendFile(res, filePath);
    } else {
      // 如果没有预生成的 API JSON，尝试直接读取最新 data.json
      const latest = getLatestProject();
      if (latest) {
        sendFile(res, join(OUTPUT_DIR, latest, 'data.json'));
      } else {
        sendJSON(res, { error: '暂无数据，请先运行 ainews run' }, 404);
      }
    }
    return;
  }

  // GET /api/history
  if (path === '/api/history' && req.method === 'GET') {
    const filePath = join(API_DIR, 'history.json');
    if (existsSync(filePath)) {
      sendFile(res, filePath);
    } else {
      // 从 output 目录动态生成
      const dirs = readdirSync(OUTPUT_DIR)
        .filter(d => d.startsWith('ai-daily-') && existsSync(join(OUTPUT_DIR, d, 'data.json')))
        .sort()
        .reverse();
      const history = dirs.map(d => {
        const data = JSON.parse(readFileSync(join(OUTPUT_DIR, d, 'data.json'), 'utf-8'));
        return { date: data.date, project: d };
      });
      sendJSON(res, history);
    }
    return;
  }

  // GET /api/images/:file
  const imagesMatch = path.match(/^\/api\/images\/(.+)$/);
  if (imagesMatch && req.method === 'GET') {
    const fileName = imagesMatch[1];
    // 安全检查：防止路径遍历
    if (fileName.includes('..') || fileName.includes('/')) {
      sendJSON(res, { error: 'Invalid path' }, 400);
      return;
    }
    const latest = getLatestProject();
    if (latest) {
      sendFile(res, join(OUTPUT_DIR, latest, 'images', fileName));
    } else {
      sendJSON(res, { error: 'No images available' }, 404);
    }
    return;
  }

  // GET /api/:date (如 /api/2026-05-21)
  const dateMatch = path.match(/^\/api\/(\d{4}-\d{2}-\d{2})$/);
  if (dateMatch && req.method === 'GET') {
    const filePath = join(API_DIR, `${dateMatch[1]}.json`);
    if (existsSync(filePath)) {
      sendFile(res, filePath);
    } else {
      sendJSON(res, { error: `${dateMatch[1]} 无数据` }, 404);
    }
    return;
  }

  // POST /api/generate
  if (path === '/api/generate' && req.method === 'POST') {
    if (!API_TOKEN) {
      sendJSON(res, { error: '未配置 API_TOKEN，POST 接口已禁用' }, 403);
      return;
    }
    const token = url.searchParams.get('token');
    if (token !== API_TOKEN) {
      sendJSON(res, { error: '无效 token' }, 401);
      return;
    }

    try {
      console.log('🚀 收到生成请求，开始执行...');
      execSync('node bin/ainews.mjs run --force', { cwd: ROOT, timeout: 120000 });
      execSync(`node scripts/publish-api.mjs`, { cwd: ROOT, timeout: 60000 });
      const data = JSON.parse(readFileSync(join(API_DIR, 'latest.json'), 'utf-8'));
      sendJSON(res, { success: true, data });
    } catch (err) {
      sendJSON(res, { error: '生成失败', detail: err.message }, 500);
    }
    return;
  }

  // GET / — API 文档
  if (path === '/' || path === '/api') {
    sendJSON(res, {
      name: 'AINewsSkill API',
      version: '1.0',
      endpoints: {
        'GET /api/latest': '获取最新一期数据（含新闻列表和图片URL）',
        'GET /api/history': '获取历史索引列表',
        'GET /api/:date': '获取指定日期数据（格式: 2026-05-21）',
        'GET /api/images/:file': '获取最新一期的图片文件',
        'POST /api/generate?token=xxx': '触发新一期生成（需配置 API_TOKEN）',
      },
    });
    return;
  }

  // 404
  sendJSON(res, { error: 'Not found' }, 404);
}

// ── 启动服务 ────────────────────────────────────
const server = createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`\n🚀 AINewsSkill API 服务已启动`);
  console.log(`   地址: http://localhost:${PORT}`);
  console.log(`   文档: http://localhost:${PORT}/api`);
  console.log(`\n端点:`);
  console.log(`   GET  /api/latest      最新数据`);
  console.log(`   GET  /api/history     历史列表`);
  console.log(`   GET  /api/images/:f   图片文件`);
  console.log(`   POST /api/generate    触发生成\n`);
});
