// Builds every tool that has a build.js. Usage: node scripts/build-all.js [--docs]
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO_ROOT } from './include-resolver.js';

const args = process.argv.slice(2);

const tools = readdirSync(REPO_ROOT, { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name.startsWith('arena-'))
  .map(d => path.join(REPO_ROOT, d.name))
  .filter(dir => existsSync(path.join(dir, 'build.js')));

if (!tools.length) console.log('No tools with a build.js yet.');

for (const dir of tools) {
  console.log(`Building ${path.basename(dir)}`);
  const r = spawnSync('node', ['build.js', ...args], { cwd: dir, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
