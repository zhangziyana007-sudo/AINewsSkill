#!/usr/bin/env node
/**
 * 清理老的 daily-* GitHub Release
 *
 * 保留最近 N 天（默认 30 天），删除更早的 release + tag。
 *
 * 用法：
 *   GH_TOKEN=xxx GITHUB_REPOSITORY=owner/repo node scripts/cleanup-releases.mjs [--keep=30] [--dry-run]
 *
 * GitHub Actions 中由 GITHUB_TOKEN secret 自动注入。
 */

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? 'true']; }),
);
const KEEP = parseInt(args.keep || '30', 10);
const DRY_RUN = args['dry-run'] === 'true';
const REPO = process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

if (!REPO || !TOKEN) {
  console.error('❌ 需要 GITHUB_REPOSITORY 和 GH_TOKEN（或 GITHUB_TOKEN）环境变量');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function listReleases() {
  const all = [];
  let page = 1;
  while (true) {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`, { headers });
    if (!res.ok) throw new Error(`列 release 失败 ${res.status}: ${await res.text()}`);
    const list = await res.json();
    if (list.length === 0) break;
    all.push(...list);
    if (list.length < 100) break;
    page++;
  }
  return all;
}

async function deleteRelease(id) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/${id}`, { method: 'DELETE', headers });
  if (!res.ok && res.status !== 204) throw new Error(`删 release ${id} 失败: ${res.status}`);
}

async function deleteTag(tag) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/git/refs/tags/${tag}`, { method: 'DELETE', headers });
  if (!res.ok && res.status !== 204 && res.status !== 422) throw new Error(`删 tag ${tag} 失败: ${res.status}`);
}

async function main() {
  console.log(`🧹 清理 ${REPO} 的 daily-* release（保留最近 ${KEEP} 个，${DRY_RUN ? 'dry-run 不实际删除' : '执行删除'}）`);
  const all = await listReleases();
  // 仅 daily-YYYY-MM-DD 格式
  const dailies = all
    .filter(r => /^daily-\d{4}-\d{2}-\d{2}$/.test(r.tag_name))
    .sort((a, b) => b.tag_name.localeCompare(a.tag_name)); // 倒序：新的在前

  console.log(`📦 总共发现 daily-* release：${dailies.length} 个`);
  const toKeep = dailies.slice(0, KEEP);
  const toDelete = dailies.slice(KEEP);

  if (toDelete.length === 0) {
    console.log(`✅ 没有需要清理的 release`);
    return;
  }

  console.log(`🗑️  待清理：${toDelete.length} 个（最老的 ${toDelete[toDelete.length - 1].tag_name} → ${toDelete[0].tag_name}）`);
  for (const r of toDelete) {
    if (DRY_RUN) {
      console.log(`  [dry-run] 将删除 ${r.tag_name}`);
      continue;
    }
    try {
      await deleteRelease(r.id);
      await deleteTag(r.tag_name);
      console.log(`  ✅ 已删除 ${r.tag_name}`);
    } catch (err) {
      console.log(`  ❌ ${r.tag_name}: ${err.message}`);
    }
  }
  console.log(`\n✅ 完成。保留：${toKeep.length}，清理：${toDelete.length}`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
