#!/usr/bin/env node
// Installs the kit from this folder into a project folder, without overwriting what the project owns.
//
//   node tools/install.mjs plan   <project> [--level 1|2|3] [--manual-skills] [--packs <name>[,<name>]...|none]
//   node tools/install.mjs apply  <project> [--level 1|2|3] [--manual-skills] [--packs ...] [--overwrite <path>]...
//   node tools/install.mjs remove <project>
//
// Levels:  1 review agents   2 + guards (hooks, settings entries)   3 + the workflow (skills, templates, rules)
// --manual-skills   new-feature and bugfix run only when typed (disable-model-invocation)
// --packs           the packs (packs/<name>/) the project has after this run, at any level; replaces the
//                   recorded list. "none" takes every pack away. Not given: the recorded list, or none.
//                   A pack whose pack.json names "needs" is only installed together with those packs.
// --overwrite       replace a file reported as "modified" or "collision"; repeat per path
//
// What was installed is recorded in <project>/.claude/spec-driven.install.json. On a later run,
// a file is replaced only when the project has not changed it since; plan and apply end by listing
// every kit file kept because the project changed it ("kept, differs from kit <version>: <path>"). This script never touches
// CLAUDE.md or .claude/spec-driven.json, and never runs git. A pack's scripts land in the project's scripts/ folder, and
// the local .NET tools a pack needs are pinned in .config/dotnet-tools.json next to the project's own (kit 2.6.4).

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exclusions, kitPacks, missingNeeds, packFiles, packTools } from './packs.mjs';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = '.claude/spec-driven.install.json';
/** The project's local .NET tool manifest (kit 2.6.4: a pack's scripts may need a tool there). */
const TOOLS = '.config/dotnet-tools.json';
const SETTINGS = '.claude/settings.json';
const FRAGMENT = '.claude/templates/settings-fragment.json';
const MANUAL_SKILLS = ['.claude/skills/new-feature/SKILL.md', '.claude/skills/bugfix/SKILL.md'];

// Kit folders per level. The setup skill and tools/ stay in the kit folder. The hooks are kept
// under hooks/ in the kit (the kit's own .claude/hooks/ is not read) and land in .claude/hooks/.
const LAYERS = [
  { level: 1, dir: '.claude/agents' },
  { level: 2, dir: 'hooks', target: '.claude/hooks' },
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
      const source = path.slice(KIT.length + 1).split('\\').join('/');
      const rel = layer.target ? `${layer.target}/${source.slice(layer.dir.length + 1)}` : source;
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
 * remove     installed earlier, no longer part of the install (level or packs), unchanged since
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
    rows.push({ status: sha(text(target)) === hash ? 'remove' : 'modified', path: rel, note: 'no longer part of the install' });
  }
  return rows;
}

const isGuardEntry = (entry) => JSON.stringify(entry).includes('guard.mjs');
/** A permission rule on git commit or git push: with it in deny, the guard cannot ask the user. */
const isCommitOrPush = (rule) => /\bgit (commit|push)\b/.test(rule);

/** Drops empty permission lists and an empty permissions block, so a project without rules shows none. */
function tidyPermissions(settings) {
  const permissions = settings.permissions;
  if (!permissions) return;
  for (const key of Object.keys(permissions)) {
    if (Array.isArray(permissions[key]) && permissions[key].length === 0) delete permissions[key];
  }
  if (Object.keys(permissions).length === 0) delete settings.permissions;
}

/**
 * Adds the guard next to the project's own hooks. Permission rules the fragment ships are added
 * once and recorded in the manifest; rules an earlier kit added and this kit no longer ships (the
 * static ask on commit and push of 2.1.0 to 2.3.0, replaced by the guard's own answer) are taken
 * away again. The project's own rules are never touched.
 */
function mergeSettings(project, manifest, dryRun) {
  const file = join(project, SETTINGS);
  const settings = readJson(file, {});
  const fragment = readJson(join(KIT, FRAGMENT));
  const notes = [];

  const fragmentAsk = fragment.permissions?.ask ?? [];
  const ask = settings.permissions?.ask ?? [];
  const deny = settings.permissions?.deny ?? [];
  const stale = (manifest.addedAsk ?? []).filter((rule) => !fragmentAsk.includes(rule) && ask.includes(rule));
  const addedAsk = fragmentAsk.filter((rule) => !ask.includes(rule));
  const denied = deny.filter((rule) => fragmentAsk.includes(rule) || isCommitOrPush(rule));
  if (stale.length || addedAsk.length) {
    (settings.permissions ??= {}).ask = [...ask.filter((rule) => !stale.includes(rule)), ...addedAsk];
  }
  tidyPermissions(settings);
  if (stale.length) notes.push(`permissions.ask: removed ${stale.length} entries an earlier kit added for commit and push; the guard asks now`);
  if (addedAsk.length) notes.push(`permissions.ask: ${addedAsk.length} entries added`);
  if (denied.length) notes.push(`permissions.deny already blocks: ${denied.join(', ')} (left as it is; the guard cannot ask for a denied command; ask the user)`);

  const existing = (settings.hooks ??= {}).PreToolUse ?? [];
  const addedHooks = existing.some(isGuardEntry) ? [] : fragment.hooks.PreToolUse;
  settings.hooks.PreToolUse = [...existing, ...addedHooks];
  if (addedHooks.length) notes.push(`hooks.PreToolUse: the guard, next to ${existing.length} existing entries`);

  manifest.addedAsk = [...new Set([...(manifest.addedAsk ?? []).filter((rule) => !stale.includes(rule)), ...addedAsk])];
  if (!dryRun && (stale.length || addedAsk.length || addedHooks.length)) writeJson(file, settings);
  return notes.length ? notes : ['settings.json: nothing to add'];
}

function unmergeSettings(project, manifest) {
  const file = join(project, SETTINGS);
  if (!existsSync(file)) return;
  const settings = readJson(file);
  if (settings.permissions?.ask) {
    settings.permissions.ask = settings.permissions.ask.filter((rule) => !(manifest.addedAsk ?? []).includes(rule));
  }
  tidyPermissions(settings);
  if (settings.hooks?.PreToolUse) {
    settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter((entry) => !isGuardEntry(entry));
  }
  writeJson(file, settings);
}

/**
 * Kit 2.6.4: the local .NET tools the packs need (dotnet-stryker for the dotnet-shared mutation check), pinned in the
 * project's .config/dotnet-tools.json next to the project's own tools. A tool the project already lists is left as it
 * is; a tool an earlier run added and no chosen pack needs any more is taken away again, and the file with it when the
 * kit created it and nothing else is left. Recorded in the manifest as addedTools and toolsFileCreated.
 */
function mergeTools(project, wanted, manifest, dryRun) {
  const file = join(project, TOOLS);
  const existed = existsSync(file);
  const manifestTools = readJson(file, { version: 1, isRoot: true, tools: {} });
  manifestTools.tools ??= {};
  const added = { ...(manifest.addedTools ?? {}) };
  const notes = [];
  let changed = false;
  for (const [name, version] of Object.entries(added)) {
    if (name in wanted) continue;
    if (manifestTools.tools[name]?.version === version) {
      delete manifestTools.tools[name];
      changed = true;
      notes.push(`${TOOLS}: ${name} removed (no chosen pack needs it)`);
    }
    delete added[name];
  }
  for (const [name, version] of Object.entries(wanted)) {
    const current = manifestTools.tools[name];
    if (!current) {
      manifestTools.tools[name] = { version, commands: [name], rollForward: false };
      added[name] = version;
      changed = true;
      notes.push(`${TOOLS}: ${name} ${version} added`);
    } else if (current.version !== version && added[name] !== current.version) {
      notes.push(`${TOOLS}: ${name} ${current.version} left as it is (the kit pins ${version}; change it with the user's go)`);
    } else if (current.version !== version) {
      current.version = version;
      added[name] = version;
      changed = true;
      notes.push(`${TOOLS}: ${name} moved to ${version}`);
    }
  }
  const created = manifest.toolsFileCreated || (!existed && changed);
  const empty = Object.keys(manifestTools.tools).length === 0;
  if (!dryRun && changed) {
    if (empty && created) rmSync(file, { force: true });
    else writeJson(file, manifestTools);
  }
  manifest.addedTools = added;
  manifest.toolsFileCreated = Boolean(created && !(empty && changed));
  return notes;
}

/** BR-6: --packs takes pack names, or none; not both and not empty. */
function parsePacks(value) {
  const names = String(value ?? '').split(',').map((name) => name.trim()).filter(Boolean);
  if (!names.length || (names.includes('none') && names.length > 1)) throw new Error('--packs takes pack names, or none');
  return names[0] === 'none' ? [] : [...new Set(names)];
}

/**
 * BR-7: packs that exclude each other are never installed together (checked first, so the message
 * names the conflict even while one of the two packs is not in the kit yet). BR-1: every pack name
 * must be one the kit has. BR-2: a pack that needs another is only installed with it.
 */
function checkPacks(packs) {
  for (const { pack, excludes } of exclusions(KIT, packs)) throw new Error(`packs ${pack} and ${excludes} exclude each other; choose one`);
  const available = kitPacks(KIT);
  for (const name of packs) {
    if (!available.includes(name)) throw new Error(`unknown pack ${name}; the kit has: ${available.join(', ') || 'none'}`);
  }
  for (const { pack, needs } of missingNeeds(KIT, packs)) throw new Error(`pack ${pack} needs pack ${needs}; add it to --packs`);
  return packs;
}

function parseArgs(argv) {
  const [command, project, ...rest] = argv;
  const options = { level: null, manualSkills: null, packs: null, overwrite: [] };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--level') options.level = Number(rest[++i]);
    else if (rest[i] === '--manual-skills') options.manualSkills = true;
    else if (rest[i] === '--packs') {
      const value = rest[i + 1];
      if (value !== undefined && !value.startsWith('--')) i++;
      options.packs = parsePacks(value?.startsWith('--') ? undefined : value);
    } else if (rest[i] === '--overwrite') options.overwrite.push(rest[++i].split('\\').join('/'));
    else throw new Error(`unknown option ${rest[i]}`);
  }
  return { command, project, options };
}

function main() {
  const { command, project: projectArg, options } = parseArgs(process.argv.slice(2));
  if (!['plan', 'apply', 'remove'].includes(command) || !projectArg) {
    console.error('usage: node tools/install.mjs plan|apply|remove <project> [--level 1|2|3] [--manual-skills] [--packs <name>[,<name>]...|none] [--overwrite <path>]');
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
        for (let dir = dirname(target); dir !== join(project, '.claude') && dir !== project && readdirSync(dir).length === 0; dir = dirname(dir)) {
          rmSync(dir, { recursive: true });
        }
        console.log(`removed    ${rel}`);
      } else {
        console.log(`kept       ${rel}  (changed in the project)`);
      }
    }
    unmergeSettings(project, manifest);
    mergeTools(project, {}, manifest, false).forEach((note) => console.log(note));
    rmSync(manifestFile, { force: true });
    console.log('Removed the guard and any permission entries the kit added from .claude/settings.json.');
    console.log('Left for you: CLAUDE.md § Project settings, .claude/spec-driven.json, the specs folder.');
    return;
  }

  // Options not given on an update default to what was chosen at the install.
  const level = options.level ?? manifest.level ?? 3;
  const manualSkills = options.manualSkills ?? manifest.manualSkills ?? false;
  if (![1, 2, 3].includes(level)) throw new Error('--level is 1, 2 or 3');
  // A project installed before packs existed has none recorded, and gets none.
  const packs = checkPacks(options.packs ?? manifest.packs ?? []);

  const files = { ...kitFiles(level, manualSkills), ...packFiles(KIT, packs) };
  const rows = plan(project, files, manifest);
  const dryRun = command === 'plan';
  const installed = { ...(manifest.files ?? {}) };

  console.log(`kit ${kitVersion()} -> ${project}`);
  console.log(`installed there: ${manifest.kitVersion ?? 'nothing'}; level ${level}${manualSkills ? ', manual skills' : ''}, packs: ${packs.join(', ') || 'none'}\n`);
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
  const next = {
    kitVersion: kitVersion(), level, manualSkills, packs, files: installed, addedAsk: manifest.addedAsk ?? [],
    addedTools: manifest.addedTools ?? {}, toolsFileCreated: manifest.toolsFileCreated ?? false,
  };
  if (level >= 2) mergeSettings(project, next, dryRun).forEach((note) => console.log(note));
  mergeTools(project, packTools(KIT, packs), next, dryRun).forEach((note) => console.log(note));
  if (Object.keys(next.addedTools).length === 0) delete next.addedTools;
  if (!next.toolsFileCreated) delete next.toolsFileCreated;
  if (!dryRun) writeJson(manifestFile, next);

  const skipped = rows.filter((r) => ['modified', 'collision'].includes(r.status) && !options.overwrite.includes(r.path));
  if (skipped.length) {
    console.log(`\n${skipped.length} file(s) skipped. "collision" is the project's own file; "modified" is a kit file the project changed.`);
    console.log('Decide per file with the user: keep the project\'s, or pass --overwrite <path>.');
  }
  // BR-55 (2.5.11): name every kit file kept because the project changed it, so an old kit text is never kept unnoticed.
  const kept = rows.filter((r) => r.status === 'modified' && r.path in files && !options.overwrite.includes(r.path));
  console.log('');
  for (const row of kept) console.log(`kept, differs from kit ${kitVersion()}: ${row.path}`);
  console.log(kept.length
    ? `${kept.length} kept file(s) differ from kit ${kitVersion()}: compare each with its copy in the kit folder, or take the kit version with --overwrite <path>.`
    : 'no kept file differs from the kit');
  console.log(dryRun ? '\nPlan only; nothing was written.' : `\nDone. Recorded in ${MANIFEST}.`);
}

try {
  main();
} catch (error) {
  console.error(`install: ${error.message}`);
  process.exit(1);
}
