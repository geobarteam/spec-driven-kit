// Shared helpers of the kit's tests. The integration tests never run the installer of this folder:
// they copy the kit to a temporary folder and run that copy against a temporary project folder.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NOT_COPIED = new Set(['.git', 'node_modules', 'tests']);
const created = [];

export const sha = (content) => createHash('sha256').update(content.replace(/\r\n/g, '\n')).digest('hex');

export function tempDir(name) {
  const dir = mkdtempSync(join(tmpdir(), `spec-driven-kit-${name}-`));
  created.push(dir);
  return dir;
}

/** A copy of the kit in a temporary folder, without its git data and tests. */
export function kitCopy() {
  const dir = tempDir('kit');
  cpSync(KIT, dir, {
    recursive: true,
    filter: (src) => !NOT_COPIED.has(relative(KIT, src).split(/[\\/]/)[0]),
  });
  return dir;
}

/** A temporary project folder, empty or copied from tests/fixtures/<fixture>. */
export function project(fixture) {
  const dir = tempDir('project');
  if (fixture) cpSync(join(KIT, 'tests/fixtures', fixture), dir, { recursive: true });
  return dir;
}

/** Runs the installer of the given kit folder as a child process. */
export function install(kit, ...args) {
  const run = spawnSync(process.execPath, [join(kit, 'tools/install.mjs'), ...args], { encoding: 'utf8' });
  return { status: run.status, stdout: run.stdout ?? '', stderr: run.stderr ?? '', output: `${run.stdout ?? ''}${run.stderr ?? ''}` };
}

/** Every file under dir as { relativePath: sha }. */
export function tree(dir) {
  const files = {};
  const walk = (folder) => {
    for (const name of readdirSync(folder)) {
      const path = join(folder, name);
      if (statSync(path).isDirectory()) walk(path);
      else files[relative(dir, path).split('\\').join('/')] = sha(readFileSync(path, 'utf8'));
    }
  };
  walk(dir);
  return files;
}

export const RECORD = '.claude/spec-driven.install.json';

export function record(dir) {
  const file = join(dir, RECORD);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

export function cleanup() {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
}
