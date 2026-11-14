#!/usr/bin/env node
// Installs the kit from this folder into a project folder, without overwriting what the project owns.
//
//   node tools/install.mjs plan   <project> [--level 1|2|3] [--manual-skills]
//   node tools/install.mjs apply  <project> [--level 1|2|3] [--manual-skills] [--overwrite <path>]...
//   node tools/install.mjs remove <project>
//
// Levels:  1 review agents   2 + guards (hooks, settings entries)   3 + the workflow (skills, templates, rules)
// --manual-skills   new-feature and bugfix run only when typed (disable-model-invocation)
// --overwrite       replace a file reported as "modified" or "collision"; repeat per path
//
// What was installed is recorded in <project>/.claude/spec-driven.install.json. On a later run,
// a file is replaced only when the project has not changed it since. This script never touches
// CLAUDE.md or .claude/spec-driven.json, and never runs git.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = '.claude/spec-driven.install.json';
const SETTINGS = '.claude/settings.json';
const FRAGMENT = '.claude/templates/settings-fragment.json';
const MANUAL_SKILLS = ['.claude/skills/new-feature/SKILL.md', '.claude/skills/bugfix/SKILL.md'];

// Kit folders per level. The setup skill and tools/ stay in the kit folder.
const LAYERS = [
  { level: 1, dir: '.claude/agents' },
  { level: 2, dir: '.claude/hooks' },
  { level: 2, file: '.claude/templates/settings-fragment.json' },
  { level: 2, file: '.claude/templates/spec-driven.json' },
  { level: 3, dir: '.claude/skills', skip: (rel) => rel.startsWith('.claude/skills/setup/') },
  { level: 3, dir: '.claude/templates' },
  { level: 3, dir: '.claude/rules' },
];

const text = (file) => readFileSync(file, 'utf8');
const sha = (content) => createHash('sha256').update(content.replace(/\r\n/g, '\n')).digest('hex');
const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(text(file)) : fallback);
const writeJson = (file, value) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function kitVersion() {
  const match = /spec-driven-kit (\d+\.\d+\.\d+)/.exec(text(join(KIT, '.claude/rules/spec-driven.md')));
  return match ? match[1] : 'unknown';
}

/** The kit files of the chosen level, as { relativePath: contentToInstall }. */
function kitFiles(level, manualSkills) {
  const files = {};
  for (const layer of LAYERS.filter((l) => l.level <= level)) {
    const paths = layer.file ? [join(KIT, layer.file)] : walk(join(KIT, layer.dir));
    for (const path of paths) {
      const rel = path.slice(KIT.length + 1).split('\\').join('/');
      if (layer.skip?.(rel)) continue;
      let content = text(path);
      if (manualSkills && MANUAL_SKILLS.includes(rel) && !content.includes('disable-model-invocation')) {
        content = content.replace(/^---\r?\n/, (start) => `${start}disable-model-invocation: true\n`);
      }
      files[rel] = content;
    }
  }
  return files;
}

/**
 * add        not in the project yet
 * same       already identical
 * update     installed by the kit earlier and unchanged since: safe to replace
 * modified   installed by the kit earlier, then changed in the project
 * collision  the project's own file at the same path
 * remove     installed earlier, no longer part of the kit at this level, unchanged since
 */
function plan(project, files, manifest) {
  const rows = [];
  for (const [rel, content] of Object.entries(files)) {
    const target = join(project, rel);
    let status = 'add';
    if (existsSync(target)) {
      const current = sha(text(target));
      if (current === sha(content)) status = 'same';
      else if (manifest.files?.[rel] === current) status = 'update';
      else status = manifest.files?.[rel] ? 'modified' : 'collision';
    }
    rows.push({ status, path: rel });
  }
  for (const [rel, hash] of Object.entries(manifest.files ?? {})) {
    if (rel in files) continue;
    const target = join(project, rel);
    if (!existsSync(target)) continue;
    rows.push({ status: sha(text(target)) === hash ? 'remove' : 'modified', path: rel, note: 'no longer in the kit at this level' });
  }
  return rows;
}

const isGuardEntry = (entry) => JSON.stringify(entry).includes('guard.mjs');

function mergeSettings(project, manifest, dryRun) {
  const file = join(project, SETTINGS);
  const settings = readJson(file, {});
  const fragment = readJson(join(KIT, FRAGMENT));
  const notes = [];

  const ask = (settings.permissions ??= {}).ask ?? [];
  const deny = settings.permissions.deny ?? [];
  const addedAsk = fragment.permissions.ask.filter((rule) => !ask.includes(rule));
  const denied = fragment.permissions.ask.filter((rule) => deny.includes(rule));
  settings.permissions.ask = [...ask, ...addedAsk];
  if (addedAsk.length) notes.push(`permissions.ask: ${addedAsk.length} entries for commit and push`);
  if (denied.length) notes.push(`permissions.deny already blocks: ${denied.join(', ')} (left as it is; ask the user)`);

  const existing = (settings.hooks ??= {}).PreToolUse ?? [];
  const addedHooks = existing.some(isGuardEntry) ? [] : fragment.hooks.PreToolUse;
  settings.hooks.PreToolUse = [...existing, ...addedHooks];
  if (addedHooks.length) notes.push(`hooks.PreToolUse: the guard, next to ${existing.length} existing entries`);

  if (!dryRun && (addedAsk.length || addedHooks.length)) {
    writeJson(file, settings);
    manifest.addedAsk = [...new Set([...(manifest.addedAsk ?? []), ...addedAsk])];
  }
  return notes.length ? notes : ['settings.json: nothing to add'];
}

function unmergeSettings(project, manifest) {
  const file = join(project, SETTINGS);
  if (!existsSync(file)) return;
  const settings = readJson(file);
  if (settings.permissions?.ask) {
    settings.permissions.ask = settings.permissions.ask.filter((rule) => !(manifest.addedAsk ?? []).includes(rule));
  }
  if (settings.hooks?.PreToolUse) {
    settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter((entry) => !isGuardEntry(entry));
  }
  writeJson(file, settings);
}

function parseArgs(argv) {
  const [command, project, ...rest] = argv;
  const options = { level: null, manualSkills: null, overwrite: [] };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--level') options.level = Number(rest[++i]);
    else if (rest[i] === '--manual-skills') options.manualSkills = true;
    else if (rest[i] === '--overwrite') options.overwrite.push(rest[++i].split('\\').join('/'));
    else throw new Error(`unknown option ${rest[i]}`);
  }
  return { command, project, options };
}

function main() {
  const { command, project: projectArg, options } = parseArgs(process.argv.slice(2));
  if (!['plan', 'apply', 'remove'].includes(command) || !projectArg) {
    console.error('usage: node tools/install.mjs plan|apply|remove <project> [--level 1|2|3] [--manual-skills] [--overwrite <path>]');
    process.exit(1);
  }
  const project = resolve(projectArg);
  if (!existsSync(project) || !statSync(project).isDirectory()) throw new Error(`${project} is not a folder`);
  if (project === KIT) throw new Error('the project folder is the kit folder; give the path of the project to set up');

  const manifestFile = join(project, MANIFEST);
  const manifest = readJson(manifestFile, {});

  if (command === 'remove') {
    for (const [rel, hash] of Object.entries(manifest.files ?? {})) {
      const target = join(project, rel);
      if (!existsSync(target)) continue;
      if (sha(text(target)) === hash) {
        rmSync(target);
        for (let dir = dirname(target); dir !== join(project, '.claude') && readdirSync(dir).length === 0; dir = dirname(dir)) {
          rmSync(dir, { recursive: true });
        }
        console.log(`removed    ${rel}`);
      } else {
        console.log(`kept       ${rel}  (changed in the project)`);
      }
    }
    unmergeSettings(project, manifest);
    rmSync(manifestFile, { force: true });
    console.log('Removed the guard and the kit\'s permission entries from .claude/settings.json.');
    console.log('Left for you: CLAUDE.md § Project settings, .claude/spec-driven.json, the specs folder.');
    return;
  }

  // Options not given on an update default to what was chosen at the install.
  const level = options.level ?? manifest.level ?? 3;
  const manualSkills = options.manualSkills ?? manifest.manualSkills ?? false;
  if (![1, 2, 3].includes(level)) throw new Error('--level is 1, 2 or 3');

  const files = kitFiles(level, manualSkills);
  const rows = plan(project, files, manifest);
  const dryRun = command === 'plan';
  const installed = { ...(manifest.files ?? {}) };

  console.log(`kit ${kitVersion()} -> ${project}`);
  console.log(`installed there: ${manifest.kitVersion ?? 'nothing'}; level ${level}${manualSkills ? ', manual skills' : ''}\n`);
  for (const row of rows) {
    const force = options.overwrite.includes(row.path);
    let action = row.status;
    if (row.status === 'add' || row.status === 'update' || (force && row.path in files)) {
      if (!dryRun) {
        mkdirSync(dirname(join(project, row.path)), { recursive: true });
        writeFileSync(join(project, row.path), files[row.path]);
      }
      installed[row.path] = sha(files[row.path]);
      if (force && row.status !== 'add' && row.status !== 'update') action = `${row.status}, overwritten`;
    } else if (row.status === 'same') {
      installed[row.path] = sha(files[row.path]);
    } else if (row.status === 'remove') {
      if (!dryRun) rmSync(join(project, row.path));
      delete installed[row.path];
    } else {
      action = `${row.status}, skipped`;
    }
    console.log(`${action.padEnd(22)} ${row.path}${row.note ? `  (${row.note})` : ''}`);
  }

  console.log('');
  const next = { kitVersion: kitVersion(), level, manualSkills, files: installed, addedAsk: manifest.addedAsk ?? [] };
  if (level >= 2) mergeSettings(project, next, dryRun).forEach((note) => console.log(note));
  if (!dryRun) writeJson(manifestFile, next);

  const skipped = rows.filter((r) => ['modified', 'collision'].includes(r.status) && !options.overwrite.includes(r.path));
  if (skipped.length) {
    console.log(`\n${skipped.length} file(s) skipped. "collision" is the project's own file; "modified" is a kit file the project changed.`);
    console.log('Decide per file with the user: keep the project\'s, or pass --overwrite <path>.');
  }
  console.log(dryRun ? '\nPlan only; nothing was written.' : `\nDone. Recorded in ${MANIFEST}.`);
}

try {
  main();
} catch (error) {
  console.error(`install: ${error.message}`);
  process.exit(1);
}
