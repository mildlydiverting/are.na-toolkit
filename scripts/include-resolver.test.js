import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveIncludes } from './include-resolver.js';

let root, srcDir;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'include-'));
  srcDir = path.join(root, 'tool', 'src');
  mkdirSync(srcDir, { recursive: true });
  mkdirSync(path.join(root, 'shared'), { recursive: true });
  writeFileSync(path.join(root, 'shared', 'a.css'), 'a{}');
  writeFileSync(path.join(root, 'shared', 'bad.js'), 'x = "</script>"');
  writeFileSync(path.join(srcDir, 'app.js'), 'run();');
  writeFileSync(path.join(srcDir, 'frag.html'), '<p>hi</p>');
});

const opts = () => ({ srcDir, repoRoot: root, outDir: path.join(root, 'tool', 'dist') });

describe('resolveIncludes', () => {
  it('wraps shared/ css in <style>', () => {
    expect(resolveIncludes('<!-- @include shared/a.css -->', opts())).toBe('<style>\na{}\n</style>');
  });

  it('wraps ./ js in <script>', () => {
    expect(resolveIncludes('  <!-- @include ./app.js -->', opts())).toBe('<script>\nrun();\n</script>');
  });

  it('inlines html raw', () => {
    expect(resolveIncludes('<!-- @include ./frag.html -->', opts())).toBe('<p>hi</p>');
  });

  it('ignores whitespace around the comment', () => {
    expect(resolveIncludes('<!--   @include   ./frag.html   -->', opts())).toBe('<p>hi</p>');
  });

  it('errors on a missing file, naming the path', () => {
    expect(() => resolveIncludes('<!-- @include ./nope.js -->', opts())).toThrow(/nope\.js/);
  });

  it('errors if inlined js contains a closing script tag', () => {
    expect(() => resolveIncludes('<!-- @include shared/bad.js -->', opts())).toThrow(/<\/script/);
  });

  it('dev mode links css and js with relative paths', () => {
    const out = resolveIncludes('<!-- @include shared/a.css -->\n<!-- @include ./app.js -->', { ...opts(), dev: true });
    expect(out).toBe('<link rel="stylesheet" href="../../shared/a.css">\n<script src="../src/app.js"></script>');
  });

  it('leaves ordinary comments alone', () => {
    expect(resolveIncludes('<!-- mount here -->', opts())).toBe('<!-- mount here -->');
  });
});
