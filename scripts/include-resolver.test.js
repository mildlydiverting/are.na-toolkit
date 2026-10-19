import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveIncludes, stripModuleSyntax } from './include-resolver.js';

let root, srcDir;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'include-'));
  srcDir = path.join(root, 'tool', 'src');
  mkdirSync(srcDir, { recursive: true });
  mkdirSync(path.join(root, 'shared'), { recursive: true });
  writeFileSync(path.join(root, 'shared', 'a.css'), 'a{}');
  writeFileSync(path.join(root, 'shared', 'bad.js'), 'x = "</script>"');
  writeFileSync(path.join(srcDir, 'app.js'), 'run();');
  writeFileSync(path.join(srcDir, 'mod.js'), "import { a } from './a.js';\nexport function f() { return a; }\n");
  writeFileSync(path.join(srcDir, 'frag.html'), '<p>hi</p>');
});

const opts = () => ({ srcDir, repoRoot: root });

describe('resolveIncludes', () => {
  it('wraps shared/ css in <style>', () => {
    expect(resolveIncludes('<!-- @include shared/a.css -->', opts())).toBe('<style>\na{}\n</style>');
  });

  it('wraps ./ js in <script>', () => {
    expect(resolveIncludes('  <!-- @include ./app.js -->', opts())).toBe('<script>\nrun();\n</script>');
  });

  it('strips module syntax from inlined js', () => {
    expect(resolveIncludes('<!-- @include ./mod.js -->', opts())).toBe('<script>\nfunction f() { return a; }\n\n</script>');
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

  it('leaves ordinary comments alone', () => {
    expect(resolveIncludes('<!-- mount here -->', opts())).toBe('<!-- mount here -->');
  });
});

describe('stripModuleSyntax', () => {
  it('drops export from declarations', () => {
    const src = 'export function a() {}\nexport async function b() {}\nexport const c = 1;\nexport class D {}\n';
    expect(stripModuleSyntax(src)).toBe('function a() {}\nasync function b() {}\nconst c = 1;\nclass D {}\n');
  });

  it('removes single-line and multi-line imports', () => {
    const src = "import { a } from './a.js';\nimport {\n  b,\n  c,\n} from '../b.js';\nimport './side.js';\nuse(a, b, c);\n";
    expect(stripModuleSyntax(src)).toBe('use(a, b, c);\n');
  });

  it('removes export lists', () => {
    expect(stripModuleSyntax('const a = 1;\nexport { a };\n')).toBe('const a = 1;\n');
  });

  it('refuses export default', () => {
    expect(() => stripModuleSyntax('export default function () {}')).toThrow(/export default/);
  });

  it('leaves the word "export" inside code alone', () => {
    const src = 'const exportName = "x";\n  // export this\n';
    expect(stripModuleSyntax(src)).toBe(src);
  });
});
