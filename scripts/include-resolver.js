// Resolves <!-- @include path --> markers in a tool's src/index.html.
// Spec: _claude/toolkit-architecture-plan.md §5.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
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

// Inlined CSS/JS can't contain its own closing tag, or the page breaks.
function assertSafe(text, closing, spec) {
  if (text.toLowerCase().includes(closing)) {
    throw new Error(`@include "${spec}" contains "${closing}" and can't be inlined; escape it as "<\\/${closing.slice(2)}"`);
  }
}

// dev: link to the source files instead of inlining. outDir is where the dev page will be written.
export function resolveIncludes(html, { srcDir, repoRoot = REPO_ROOT, dev = false, outDir } = {}) {
  return html.replace(MARKER, (_, spec) => {
    const file = resolveSource(spec, srcDir, repoRoot);
    const ext = path.extname(spec).toLowerCase();
    if (dev && (ext === '.css' || ext === '.js')) {
      if (!existsSync(file)) throw new Error(`@include "${spec}" not found (looked for ${file})`);
      const href = path.relative(outDir, file).split(path.sep).join('/');
      return ext === '.css'
        ? `<link rel="stylesheet" href="${href}">`
        : `<script src="${href}"></script>`;
    }
    const text = read(file, spec);
    if (ext === '.css') {
      assertSafe(text, '</style', spec);
      return `<style>\n${text}\n</style>`;
    }
    if (ext === '.js') {
      assertSafe(text, '</script', spec);
      return `<script>\n${text}\n</script>`;
    }
    if (ext === '.html') return text;
    throw new Error(`@include "${spec}": unsupported extension "${ext}"`);
  });
}

// Builds toolDir/src/index.html into toolDir/dist/<name>.html (or <name>.dev.html).
// docs: also copy the built file to docs/ (GitHub Pages). Never done for dev builds.
export function buildTool(toolDir, { dev = false, docs = false, repoRoot = REPO_ROOT } = {}) {
  const name = path.basename(toolDir);
  const srcDir = path.join(toolDir, 'src');
  const outDir = path.join(toolDir, 'dist');
  const outFile = path.join(outDir, dev ? `${name}.dev.html` : `${name}.html`);

  const html = resolveIncludes(read(path.join(srcDir, 'index.html'), 'src/index.html'), {
    srcDir, repoRoot, dev, outDir,
  });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, html);

  if (docs && !dev) {
    const docsFile = path.join(repoRoot, 'docs', `${name}.html`);
    copyFileSync(outFile, docsFile);
  }
  return outFile;
}
