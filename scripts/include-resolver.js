// Resolves <!-- @include path --> markers in a tool's src/index.html.
// Spec: _claude/toolkit-architecture-plan.md §5, with two changes:
//  - Source .js files are ES modules (so Vitest can import them). When inlined into a
//    classic <script>, `export` keywords and `import … from` lines are stripped; every
//    included file then shares one global scope.
//  - There is no link-the-sources dev mode. `--watch` rebuilds on save instead.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MARKER = /^[ \t]*<!--\s*@include\s+(\S+)\s*-->[ \t]*$/gm;

// "shared/…" resolves from the repo root; anything else from the tool's src/.
export function resolveSource(spec, srcDir, repoRoot = REPO_ROOT) {
  return spec.startsWith('shared/')
    ? path.join(repoRoot, spec)
    : path.resolve(srcDir, spec);
}

function read(file, spec) {
  if (!existsSync(file)) throw new Error(`@include "${spec}" not found (looked for ${file})`);
  return readFileSync(file, 'utf8');
}

// ES module source -> classic-script source.
export function stripModuleSyntax(text, spec = 'script') {
  if (/^export\s+default\b/m.test(text)) {
    throw new Error(`@include "${spec}": "export default" can't be inlined; use a named export`);
  }
  return text
    .replace(/^import\b[\s\S]*?\bfrom\s+['"][^'"]+['"];?[ \t]*\n?/gm, '')
    .replace(/^import\s+['"][^'"]+['"];?[ \t]*\n?/gm, '')
    .replace(/^export\s*\{[^}]*\};?[ \t]*\n?/gm, '')
    .replace(/^export\s+(?=(?:async\s+)?(?:function|class|const|let|var)\b)/gm, '');
}

// Inlined CSS/JS can't contain its own closing tag, or the page breaks.
function assertSafe(text, closing, spec) {
  if (text.toLowerCase().includes(closing)) {
    throw new Error(`@include "${spec}" contains "${closing}" and can't be inlined; escape it as "<\\/${closing.slice(2)}"`);
  }
}

export function resolveIncludes(html, { srcDir, repoRoot = REPO_ROOT } = {}) {
  return html.replace(MARKER, (_, spec) => {
    const file = resolveSource(spec, srcDir, repoRoot);
    const ext = path.extname(spec).toLowerCase();
    const text = read(file, spec);
    if (ext === '.css') {
      assertSafe(text, '</style', spec);
      return `<style>\n${text}\n</style>`;
    }
    if (ext === '.js') {
      const code = stripModuleSyntax(text, spec);
      assertSafe(code, '</script', spec);
      return `<script>\n${code}\n</script>`;
    }
    if (ext === '.html') return text;
    throw new Error(`@include "${spec}": unsupported extension "${ext}"`);
  });
}

// Builds toolDir/src/index.html into toolDir/dist/<name>.html.
// docs: also copy the built file to docs/ (GitHub Pages).
export function buildTool(toolDir, { docs = false, repoRoot = REPO_ROOT } = {}) {
  const name = path.basename(toolDir);
  const srcDir = path.join(toolDir, 'src');
  const outDir = path.join(toolDir, 'dist');
  const outFile = path.join(outDir, `${name}.html`);

  const html = resolveIncludes(read(path.join(srcDir, 'index.html'), 'src/index.html'), { srcDir, repoRoot });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, html);

  if (docs) copyFileSync(outFile, path.join(repoRoot, 'docs', `${name}.html`));
  return outFile;
}

// Entry point for a tool's build.js: node build.js [--docs] [--watch]
export function runCli(toolDir, argv = process.argv.slice(2), repoRoot = REPO_ROOT) {
  const docs = argv.includes('--docs');
  const run = () => {
    try {
      console.log(`Built ${path.relative(repoRoot, buildTool(toolDir, { docs, repoRoot }))}`);
    } catch (err) {
      console.error(err.message);
      if (!argv.includes('--watch')) process.exit(1);
    }
  };
  run();
  if (!argv.includes('--watch')) return;

  let timer;
  const rebuild = () => { clearTimeout(timer); timer = setTimeout(run, 100); };
  for (const dir of [path.join(toolDir, 'src'), path.join(repoRoot, 'shared')]) {
    if (existsSync(dir)) watch(dir, { recursive: true }, rebuild);
  }
  console.log('Watching src/ and shared/ for changes…');
}
