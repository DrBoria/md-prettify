import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Guard test: the IDE-agnostic apps (backend, and any future frontend) must
 * never import an IDE SDK (`vscode`, `webstorm`, ...). Only the adapter
 * packages (packages/vscode-extension, packages/webstorm-extension) may import
 * an IDE module. This test walks every TypeScript source file under `apps/`
 * and fails if any of them references an IDE module.
 *
 * The test is location-independent: it walks up from its own compiled location
 * until it finds the repo root (a directory holding both `apps` and
 * `pnpm-workspace.yaml`), so it works whether it is compiled under the backend
 * or under an adapter package's out/.
 */

const findRepoRoot = (start: string): string | null => {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (
      fs.existsSync(path.join(dir, 'apps')) &&
      fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
};

const walkTs = (dir: string, out: string[]): void => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'out' || entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTs(p, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
  }
};

// An import/require of an IDE module. Catches every form of pulling in the
// `vscode` or `webstorm` SDK by name (default, namespace, or require).
const IDE_IMPORT = /\b(?:import\b[\s\S]*?from\s*|require\s*\(\s*)["'](vscode|webstorm)["']/;

const repoRoot = findRepoRoot(__dirname);

suite('no IDE imports in apps', () => {
  test('repo root is resolvable', () => {
    assert.ok(repoRoot, `could not resolve repo root from ${__dirname}`);
  });

  test('apps/** never imports an IDE module', () => {
    if (!repoRoot) return;
    const files: string[] = [];
    walkTs(path.join(repoRoot, 'apps'), files);
    assert.ok(files.length > 0, 'found at least one apps source file');

    const offenders: string[] = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      if (IDE_IMPORT.test(src)) {
        offenders.push(path.relative(repoRoot, file));
      }
    }
    assert.deepStrictEqual(
      offenders,
      [],
      `apps must not import an IDE module; offenders: ${offenders.join(', ')}`,
    );
  });
});
