// The kit's packs: named, optional sets of agents, skills, rules and scripts under packs/<name>/.
// A pack folder holds pack.json (name, description, the agents, skills, rules and scripts it declares,
// and the .NET local tools its scripts need) and the folders agents/, skills/ and rules/, which land
// in the project's .claude/ folder under the same names, and scripts/, which lands in the project's
// own scripts/ folder (kit 2.6.4). Nothing under packs/ is read by a session started in the kit folder.
// Shared by the installer and the kit's tests. Nothing here writes a file.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const PACKS_DIR = 'packs';
const KINDS = ['agents', 'skills', 'rules', 'scripts'];
/** Where a kind lands in the project: under .claude/, except the scripts, which the project runs from scripts/. */
const targetDir = (kind) => (kind === 'scripts' ? 'scripts' : `.claude/${kind}`);
const slash = (path) => path.split('\\').join('/');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** The names of the packs the kit has, sorted. */
export function kitPacks(kit) {
  const dir = join(kit, PACKS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => existsSync(join(dir, name, 'pack.json'))).sort();
}

/**
 * The pack's declaration: name, description, recommend, needs (the packs it needs), agents, skills, rules, scripts and
 * dotnetTools ({ package: pinned version }, the local .NET tools the installer adds to .config/dotnet-tools.json).
 */
export function readPack(kit, name) {
  const declared = JSON.parse(readFileSync(join(kit, PACKS_DIR, name, 'pack.json'), 'utf8'));
  return { name, description: '', recommend: '', needs: [], agents: [], skills: [], rules: [], scripts: [], dotnetTools: {}, ...declared };
}

/** The local .NET tools the given packs need, { package: version }. */
export function packTools(kit, names) {
  return Object.assign({}, ...names.map((name) => readPack(kit, name).dotnetTools));
}

/** BR-2: every pack of the list whose needed pack is not in the list, as { pack, needs }. */
export function missingNeeds(kit, packs) {
  return packs.flatMap((pack) =>
    readPack(kit, pack).needs.filter((needs) => !packs.includes(needs)).map((needs) => ({ pack, needs })));
}

/**
 * BR-7: each pair of the list where one pack excludes the other, once, as { pack, excludes }, the
 * two names in alphabetical order whichever pack declares it and whatever the list order, so the
 * message is the one BR-7 states. Only packs the kit has are read, so a list naming an excluded pack the kit
 * does not have yet is still refused for the exclusion; unknown names are left to BR-1.
 */
export function exclusions(kit, packs) {
  const known = new Set(kitPacks(kit));
  const seen = new Set();
  const pairs = [];
  for (const pack of packs.filter((name) => known.has(name))) {
    for (const excludes of readPack(kit, pack).excludes ?? []) {
      const pair = [pack, excludes].sort();
      const key = pair.join('|');
      if (!packs.includes(excludes) || seen.has(key)) continue;
      seen.add(key);
      pairs.push({ pack: pair[0], excludes: pair[1] });
    }
  }
  return pairs;
}

/**
 * The pack's files: { path, rel (source path from the kit folder), target (path in the project),
 * text }.
 */
export function packSources(kit, name) {
  const sources = [];
  for (const kind of KINDS) {
    const dir = join(kit, PACKS_DIR, name, kind);
    if (!existsSync(dir)) continue;
    for (const path of walk(dir)) {
      sources.push({
        path,
        rel: slash(relative(kit, path)),
        target: `${targetDir(kind)}/${slash(relative(dir, path))}`,
        text: readFileSync(path, 'utf8'),
      });
    }
  }
  return sources;
}

/** The files of the given packs as { targetPath: content }, the form the installer plans with. */
export function packFiles(kit, names) {
  const files = {};
  for (const name of names) {
    for (const source of packSources(kit, name)) files[source.target] = source.text;
  }
  return files;
}
