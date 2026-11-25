// Integration tests of the installer: a copy of the kit, run as a child process against a
// temporary project folder. Spec: the upstream _specs/HarnessPacks/spec.md (not carried by the private edition).
// The private edition's operations pack holds two generic agents, sonar-review and git; the platform agents are gone.

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { br3Violations, br5Violations, frontmatterField, frontmatterList, frontmatterName, packValueLabels, references, templatePackValues } from '../tools/pack-checks.mjs';
import { packFiles, readPack } from '../tools/packs.mjs';
import { KIT, RECORD, cleanup, install, kitCopy, project, record, sha, tree } from './helpers.mjs';

const RULES = '.claude/rules/spec-driven.md';
const TEMPLATE = '.claude/templates/project-settings.md';
/** The two agents of the operations pack: AGENT is the one a project may already have, OTHER the second pack file. */
const AGENT = '.claude/agents/sonar-review.md';
const REFERENCE = '.claude/agents/git.md';
const OPERATIONS_AGENTS = [AGENT, REFERENCE];
const PACK_AGENTS = 'packs/operations/agents';
/** The rules of § Packs with their path filters (AC-16). */
const LIBRARY_RULES = {
  '.claude/rules/public-api.md': ['src/**/*.cs'],
  '.claude/rules/nuget-packaging.md': ['**/*.csproj'],
};
/** The agent, the skills and the rules of the dotnet-library pack (AC-16). */
const LIBRARY_FILES = ['.claude/agents/code-analysis.md', '.claude/skills/add-public-api/SKILL.md', '.claude/skills/fix-violations/SKILL.md', ...Object.keys(LIBRARY_RULES)];
/** The rules of dotnet-shared (Guidelines § Guideline sets): `tests` moved there from dotnet-library, `coding` (slice 2). */
const SHARED_FILES = ['.claude/rules/architecture-shared.md', '.claude/rules/coding.md', '.claude/rules/tests.md', '.claude/rules/testing-for-agents.md',
  'scripts/mutation-check.mjs']; // KitLean 2.6.4 (BR-82): the mutation check lands in the project's scripts/ folder
const BR2 = /install: pack dotnet-library needs pack (operations|dotnet-shared); add it to --packs/;
const LIBRARY_PACKS = 'operations,dotnet-shared,dotnet-library';
const OWN_TEXT = "# The project's own Sonar review\n";
const operationsFiles = () => Object.keys(packFiles(KIT, ['operations']));
/** The installer's output rows as { path: action }, e.g. { '.claude/agents/x.md': 'collision, skipped' }. */
const rows = (stdout) =>
  Object.fromEntries(stdout.split(/\r?\n/).flatMap((line) => {
    const match = /^([a-z]+(?:, [a-z]+)?)\s+(\.claude\/\S+)/.exec(line);
    return match ? [[match[2], match[1]]] : [];
  }));
const read = (dir, rel) => readFileSync(join(dir, rel), 'utf8');
const write = (dir, rel, content) => {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), content);
};
const append = (dir, rel, line) => writeFileSync(join(dir, rel), read(dir, rel) + line);

describe('slice 1: a team lead installs a pack through the setup session, and a project without packs gets none', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('slice test: apply on a 2.1.0 project adds no pack file; apply --packs operations adds sonar-review and git and records the pack; a second apply keeps it', () => {
    const dir = project('project-2.1.0');
    const before = tree(dir);
    assert.equal(install(kit, 'apply', dir).status, 0);
    for (const file of OPERATIONS_AGENTS) assert.ok(!existsSync(join(dir, file)), `${file} was installed without --packs`);
    // Lean (2.5.0) slices 2 and 3: the kit's architecture and slice-plan templates were added; 2.5.3 (D15) dropped the
    // architecture template and 2.5.7 (BR-40) the slice-plan template, so nothing is added; no pack file.
    assert.deepEqual(Object.keys(tree(dir)).filter((p) => !(p in before)), [], 'files added without --packs');

    const first = install(kit, 'apply', dir, '--packs', 'operations');
    assert.equal(first.status, 0, first.output);
    for (const file of OPERATIONS_AGENTS) assert.ok(existsSync(join(dir, file)), `${file} missing after --packs operations`);
    assert.deepEqual(record(dir).packs, ['operations']);

    const second = install(kit, 'apply', dir);
    assert.equal(second.status, 0, second.output);
    assert.deepEqual(record(dir).packs, ['operations']);
    for (const file of OPERATIONS_AGENTS) assert.ok(existsSync(join(dir, file)), `${file} gone after the second apply`);
  });

  test('AC-1: on a 2.1.0 project at level 3 without packs, apply changes only the rules file, the template and the core texts that read a guideline, adds nothing, records the kit version and no pack', () => {
    const dir = project('project-2.1.0');
    assert.equal(record(dir).kitVersion, '2.1.0', 'the fixture is a 2.1.0 install');
    const before = tree(dir);
    const run = install(kit, 'apply', dir);
    assert.equal(run.status, 0, run.output);
    const after = tree(dir);
    const changed = Object.keys(after).filter((p) => p in before && before[p] !== after[p] && p !== RECORD);
    const added = Object.keys(after).filter((p) => !(p in before));
    const removed = Object.keys(before).filter((p) => !(p in after));
    const coreTexts = [
      '.claude/skills/bugfix/SKILL.md', '.claude/skills/build-slice/SKILL.md',
      '.claude/skills/investigate/SKILL.md', '.claude/skills/write-spec/SKILL.md', '.claude/skills/amend-spec/SKILL.md',
      '.claude/agents/spec-critic.md', '.claude/agents/spec-reviewer.md',
    ];
    // Unattended (2.4.0): the guard and the runner, the settings fragment without its ask rules, and settings.json losing them.
    const unattended = ['.claude/hooks/guard.mjs', '.claude/hooks/verify.mjs', '.claude/templates/settings-fragment.json', '.claude/settings.json'];
    // Lean (2.5.0) slice 1: new-feature starts the critic only on request; slice 3: the spec template's "Outer test" column;
    // slice 4: the recap template's AC-to-test table, without a Verifier row.
    // Lean 2.6.0 (BR-61): the recap template is no longer changed but removed (see below).
    const lean = ['.claude/skills/new-feature/SKILL.md', '.claude/templates/spec-template.md'];
    assert.deepEqual(changed.sort(), [RULES, TEMPLATE, ...coreTexts, ...unattended, ...lean].sort(), 'files changed by the update (§ Version: the rules file, the Project settings template and, from Guidelines slices 1 and 4, the core texts with a Guidelines paragraph; from 2.4.0 the hooks and the settings; from 2.5.0 new-feature and the spec template)');
    // Lean (2.5.0) slice 3: the slice-plan template (slice 2's architecture template is gone again in 2.5.3, D15);
    // 2.5.7 (BR-40) drops the slice-plan template as well, so the update adds nothing.
    assert.deepEqual(added, [], 'files added by the update');
    // Lean (2.5.0) slice 5: the retired slice-verifier is removed; 2.6.0 (BR-61): the unchanged recap template too, and nothing else.
    assert.deepEqual(removed.sort(), ['.claude/agents/slice-verifier.md', '.claude/templates/slice-recap-template.md'], 'files removed by the update');
    // Lean (2.5.0) slice 6: the version; slice 8 moves it to 2.5.1, slice 9 to 2.5.2, slice 11 to 2.5.3, slice 12 to 2.5.4, slice 13 to 2.5.5, slice 14 to 2.5.6, slice 15 to 2.5.7, slice 16 to 2.5.8, slice 17 to 2.5.9, slice 18 to 2.5.10, slice 19 to 2.5.11, slice 20 to 2.6.0.
    assert.equal(record(dir).kitVersion, '2.6.5'); // KitLean 2.6.5 (BR-89)
    assert.deepEqual(record(dir).packs, []);
  });

  for (const level of [1, 3]) {
    test(`AC-2: apply --packs operations at level ${level} installs the pack's files, records the pack with a hash per file, and names the pack in the output`, () => {
      const dir = project();
      const run = install(kit, 'apply', dir, '--level', String(level), '--packs', 'operations');
      assert.equal(run.status, 0, run.output);
      const rec = record(dir);
      assert.deepEqual(rec.packs, ['operations']);
      assert.equal(rec.level, level);
      const expected = packFiles(kit, ['operations']);
      assert.ok(Object.keys(expected).length >= 2, 'the operations pack has files');
      for (const [rel, content] of Object.entries(expected)) {
        assert.ok(existsSync(join(dir, rel)), `${rel} not installed`);
        assert.equal(sha(readFileSync(join(dir, rel), 'utf8')), sha(content), `${rel} differs from the kit's copy`);
        assert.equal(rec.files[rel], sha(content), `${rel} not recorded with its hash`);
      }
      assert.match(run.stdout, new RegExp(`level ${level}.*operations`), 'the output names the pack next to the level');
      if (level === 1) assert.ok(!existsSync(join(dir, '.claude/skills')), 'level 1 installs no skills');
    });
  }

  test('AC-3: after an install with operations, apply without --packs keeps the pack recorded and reports its files as same', () => {
    const dir = project();
    assert.equal(install(kit, 'apply', dir, '--packs', 'operations').status, 0);
    const run = install(kit, 'apply', dir);
    assert.equal(run.status, 0, run.output);
    assert.deepEqual(record(dir).packs, ['operations']);
    const reported = rows(run.stdout);
    for (const rel of operationsFiles()) assert.equal(reported[rel], 'same', `${rel} is not reported as same:\n${run.stdout}`);
    assert.match(run.stdout, /operations/, 'the output names the pack');
  });

  test('AC-4: an unknown pack gives BR-1 with the kit\'s pack names, writes nothing and exits non-zero', () => {
    const dir = project();
    const run = install(kit, 'apply', dir, '--packs', 'bogus');
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /install: unknown pack bogus; the kit has: blazor-server, blazor-wasm, dotnet-library, dotnet-shared, operations/);
    assert.deepEqual(tree(dir), {}, 'something was written');
  });

  for (const [label, args] of [
    ['empty', ['--packs']],
    ['an empty value', ['--packs', '']],
    ['none with a name', ['--packs', 'none,operations']],
  ]) {
    test(`AC-4: --packs ${label} gives BR-6, writes nothing and exits non-zero`, () => {
      const dir = project();
      const run = install(kit, 'apply', dir, ...args);
      assert.notEqual(run.status, 0);
      assert.match(run.stderr, /install: --packs takes pack names, or none/);
      assert.deepEqual(tree(dir), {}, 'something was written');
    });
  }

  for (const level of [1, 2, 3]) {
    test(`AC-5: apply at level ${level} without --packs installs no pack file`, () => {
      const dir = project();
      const run = install(kit, 'apply', dir, '--level', String(level));
      assert.equal(run.status, 0, run.output);
      for (const rel of operationsFiles()) assert.ok(!existsSync(join(dir, rel)), `${rel} installed without --packs`);
      assert.deepEqual(record(dir).packs, []);
    });
  }
});

describe("slice 2: a project's own files and its edits to pack files survive install, update and removal", () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test("slice test: a project's own sonar-review is collision, skipped; an edited pack file survives a changed kit; --packs none removes only unchanged pack files", () => {
    const changingKit = kitCopy();
    const dir = project('project-2.1.0');
    write(dir, AGENT, OWN_TEXT);

    const first = install(changingKit, 'apply', dir, '--packs', 'operations');
    assert.equal(first.status, 0, first.output);
    assert.equal(sha(read(dir, AGENT)), sha(OWN_TEXT), "the project's own file was replaced");
    assert.equal(rows(first.stdout)[AGENT], 'collision, skipped', first.stdout);
    assert.ok(!(AGENT in record(dir).files), 'a skipped file was recorded');
    assert.equal(rows(first.stdout)[REFERENCE], 'add', first.stdout);
    assert.deepEqual(record(dir).packs, ['operations']);

    // The team lead replaces it, edits the reference file, and the kit's agent changes before the next update.
    const replaced = install(changingKit, 'apply', dir, '--overwrite', AGENT);
    assert.equal(replaced.status, 0, replaced.output);
    assert.equal(rows(replaced.stdout)[AGENT], 'collision, overwritten', replaced.stdout);
    append(dir, REFERENCE, "\n<!-- the project's note -->\n");
    const edited = read(dir, REFERENCE);
    append(changingKit, `${PACK_AGENTS}/sonar-review.md`, '\n<!-- changed in the kit -->\n');

    const update = install(changingKit, 'apply', dir);
    assert.equal(update.status, 0, update.output);
    assert.equal(sha(read(dir, REFERENCE)), sha(edited), "the project's edit was lost");
    assert.equal(rows(update.stdout)[REFERENCE], 'modified, skipped', update.stdout);
    assert.equal(rows(update.stdout)[AGENT], 'update', update.stdout);
    assert.equal(sha(read(dir, AGENT)), sha(read(changingKit, `${PACK_AGENTS}/sonar-review.md`)), 'the unchanged pack file was not replaced');

    const none = install(changingKit, 'apply', dir, '--packs', 'none');
    assert.equal(none.status, 0, none.output);
    assert.ok(!existsSync(join(dir, AGENT)), 'the unchanged pack file was not removed');
    assert.ok(existsSync(join(dir, REFERENCE)), 'the edited pack file was removed');
    assert.equal(sha(read(dir, REFERENCE)), sha(edited), 'the edited pack file was replaced');
    assert.equal(rows(none.stdout)[REFERENCE], 'modified, skipped', none.stdout);
    assert.deepEqual(record(dir).packs, []);
    assert.ok(existsSync(join(dir, RULES)), "the kit's own files stay");
  });

  test("AC-8: the project's own file at a pack path is collision, skipped and unchanged; with --overwrite for that path it is replaced and recorded", () => {
    const dir = project();
    write(dir, AGENT, OWN_TEXT);
    const run = install(kit, 'apply', dir, '--level', '1', '--packs', 'operations');
    assert.equal(run.status, 0, run.output);
    assert.equal(sha(read(dir, AGENT)), sha(OWN_TEXT), "the project's own file was replaced");
    assert.equal(rows(run.stdout)[AGENT], 'collision, skipped', run.stdout);
    assert.equal(record(dir).files[AGENT], undefined, 'a skipped file was recorded');
    assert.match(run.stdout, /1 file\(s\) skipped/);

    const kitText = packFiles(kit, ['operations'])[AGENT];
    const force = install(kit, 'apply', dir, '--overwrite', AGENT);
    assert.equal(force.status, 0, force.output);
    assert.equal(rows(force.stdout)[AGENT], 'collision, overwritten', force.stdout);
    assert.equal(sha(read(dir, AGENT)), sha(kitText), "the file is not the kit's copy");
    assert.equal(record(dir).files[AGENT], sha(kitText), 'the replaced file is not recorded');
    assert.deepEqual(record(dir).packs, ['operations']);
  });

  test("AC-9: a pack file changed in the project is modified, skipped when the kit's pack changes, and the unchanged pack files are replaced", () => {
    const changingKit = kitCopy();
    const dir = project();
    const first = install(changingKit, 'apply', dir, '--level', '1', '--packs', 'operations');
    assert.equal(first.status, 0, first.output);
    append(dir, AGENT, "\n<!-- the project's edit -->\n");
    const edited = read(dir, AGENT);
    for (const file of ['sonar-review.md', 'git.md']) {
      append(changingKit, `${PACK_AGENTS}/${file}`, '\n<!-- changed in the kit -->\n');
    }

    const run = install(changingKit, 'apply', dir);
    assert.equal(run.status, 0, run.output);
    assert.equal(sha(read(dir, AGENT)), sha(edited), "the project's edit was lost");
    assert.equal(rows(run.stdout)[AGENT], 'modified, skipped', run.stdout);
    assert.equal(rows(run.stdout)[REFERENCE], 'update', run.stdout);
    const newReference = read(changingKit, `${PACK_AGENTS}/git.md`);
    assert.equal(sha(read(dir, REFERENCE)), sha(newReference), 'the unchanged pack file was not replaced');
    assert.equal(record(dir).files[REFERENCE], sha(newReference), 'the replaced file is not recorded with its new hash');
    assert.deepEqual(record(dir).packs, ['operations']);
  });

  test('AC-10: apply --packs none removes the unchanged pack files, keeps and lists the changed ones, and records no pack', () => {
    const dir = project();
    assert.equal(install(kit, 'apply', dir, '--level', '1', '--packs', 'operations').status, 0);
    append(dir, REFERENCE, "\n<!-- the project's edit -->\n");
    const edited = read(dir, REFERENCE);

    const run = install(kit, 'apply', dir, '--packs', 'none');
    assert.equal(run.status, 0, run.output);
    assert.ok(!existsSync(join(dir, AGENT)), 'the unchanged pack file was not removed');
    assert.equal(rows(run.stdout)[AGENT], 'remove', run.stdout);
    assert.ok(existsSync(join(dir, REFERENCE)), 'the edited pack file was removed');
    assert.equal(sha(read(dir, REFERENCE)), sha(edited), 'the edited pack file was replaced');
    assert.equal(rows(run.stdout)[REFERENCE], 'modified, skipped', run.stdout);
    assert.match(run.stdout, /1 file\(s\) skipped/, 'the kept file is not listed');
    assert.match(run.stdout, /packs: none/);
    const rec = record(dir);
    assert.deepEqual(rec.packs, []);
    assert.ok(!(AGENT in rec.files), 'the removed file is still recorded');
    assert.ok(existsSync(join(dir, '.claude/agents/spec-reviewer.md')), "the kit's own files stay");
  });

  test('AC-10: the command remove removes the unchanged pack files and keeps the changed ones', () => {
    const dir = project();
    assert.equal(install(kit, 'apply', dir, '--level', '1', '--packs', 'operations').status, 0);
    append(dir, REFERENCE, "\n<!-- the project's edit -->\n");
    const edited = read(dir, REFERENCE);

    const run = install(kit, 'remove', dir);
    assert.equal(run.status, 0, run.output);
    assert.ok(!existsSync(join(dir, AGENT)), 'the unchanged pack file was not removed');
    assert.equal(rows(run.stdout)[AGENT], 'removed', run.stdout);
    assert.ok(existsSync(join(dir, REFERENCE)), 'the edited pack file was removed');
    assert.equal(sha(read(dir, REFERENCE)), sha(edited), 'the edited pack file was replaced');
    assert.equal(rows(run.stdout)[REFERENCE], 'kept', run.stdout);
    assert.equal(record(dir), null, 'the record was not removed');
    assert.ok(!existsSync(join(dir, '.claude/agents/spec-reviewer.md')), "the kit's own files are removed too");
  });
});

describe('slice 3: the agents that handle a token keep it out of the conversation', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('slice test: apply --packs operations installs sonar-review and git; the BR-5 check passes on them and fails on a planted "paste your token" line and a planted PAT as a command argument (AC-11)', () => {
    const dir = project('project-2.1.0');
    const run = install(kit, 'apply', dir, '--packs', 'operations');
    assert.equal(run.status, 0, run.output);
    const expected = packFiles(kit, ['operations']);
    for (const rel of OPERATIONS_AGENTS) {
      assert.ok(existsSync(join(dir, rel)), `${rel} not installed`);
      assert.equal(sha(read(dir, rel)), sha(expected[rel]), `${rel} differs from the kit's copy`);
      assert.deepEqual(br5Violations(read(dir, rel)), [], `BR-5 violated in ${rel}`);
    }

    const guide = '.claude/agents/sonar-review.md';
    const lines = read(dir, guide).split(/\r?\n/).length;
    append(dir, guide, '\nPlease paste your token here.\n');
    assert.deepEqual(br5Violations(read(dir, guide)), [{ line: lines + 1, pattern: 'paste your' }]);
    append(dir, guide, 'az devops login --pat <your-pat>\n');
    assert.deepEqual(br5Violations(read(dir, guide)).map((v) => v.pattern), ['paste your', 'option with a token placeholder']);
  });
});

describe('slice 4: every installed operations file passes the pack checks', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('slice test: apply --packs operations; every pack check passes over every installed pack file (AC-6, AC-7, AC-11)', () => {
    const dir = project('project-2.1.0');
    const run = install(kit, 'apply', dir, '--packs', 'operations');
    assert.equal(run.status, 0, run.output);
    const expected = packFiles(kit, ['operations']);

    const pack = readPack(kit, 'operations');
    const known = new Set([...pack.agents, ...pack.skills]);
    const installed = Object.keys(expected).filter((rel) => existsSync(join(dir, rel)));
    assert.equal(installed.length, OPERATIONS_AGENTS.length, 'the pack\'s files are installed');
    for (const rel of installed) {
      const text = read(dir, rel);
      assert.deepEqual(br3Violations(text), [], `BR-3 violated in ${rel}`);
      assert.deepEqual(br5Violations(text), [], `BR-5 violated in ${rel}`);
      const dangling = references(text).filter((ref) => !known.has(ref.name));
      assert.deepEqual(dangling, [], `BR-4 violated in ${rel}`);
      const name = frontmatterName(text);
      if (name !== null) assert.equal(name, rel.replace(/^.*\//, '').replace(/\.md$/, ''), `${rel} has another name in its frontmatter`);
    }
  });
});

describe('slice 5: a team gets the Sonar review and the git guide, with the project\'s Sonar key in Project settings', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('slice test: apply --packs operations installs its two agents; the installed template holds the Sonar server URL and Sonar project key lines marked operations and sonar-review names them (AC-13, AC-14)', () => {
    const dir = project('project-2.1.0');
    const run = install(kit, 'apply', dir, '--packs', 'operations');
    assert.equal(run.status, 0, run.output);
    const expected = packFiles(kit, ['operations']);
    assert.equal(OPERATIONS_AGENTS.length, 2, 'two agents');
    for (const rel of OPERATIONS_AGENTS) {
      assert.ok(existsSync(join(dir, rel)), `${rel} not installed`);
      assert.equal(sha(read(dir, rel)), sha(expected[rel]), `${rel} differs from the kit's copy`);
    }
    const agents = Object.keys(expected).filter((rel) => rel.startsWith('.claude/agents/'));
    assert.deepEqual(agents.sort(), [...OPERATIONS_AGENTS].sort(), 'the pack installs other agent files than its two');

    const template = templatePackValues(read(dir, TEMPLATE));
    assert.deepEqual(template.filter((v) => v.pack === 'operations').map((v) => v.label), ['Sonar server URL', 'Sonar project key'], 'the installed template\'s Pack values lines of the operations pack');
    assert.deepEqual(packValueLabels(read(dir, '.claude/agents/sonar-review.md')), ['Sonar server URL', 'Sonar project key'], 'sonar-review does not name the Sonar lines');
    assert.deepEqual(packValueLabels(read(dir, '.claude/agents/git.md')), [], 'git names a Pack values line');
  });
});

describe('slice 6: a library team installs the .NET library pack', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('slice test: --packs dotnet-library alone fails with BR-2 and writes nothing; with operations the rules, skills and agent are installed and each rule has its path filter; the template holds the three Pack values lines and every pack check passes over every installed file (AC-15, AC-16; AC-6, AC-7, AC-11, AC-14 over the new items)', () => {
    const dir = project('project-2.1.0');
    const before = tree(dir);
    const alone = install(kit, 'apply', dir, '--packs', 'dotnet-library');
    assert.notEqual(alone.status, 0, 'dotnet-library without operations was accepted');
    assert.match(alone.stderr, BR2);
    assert.deepEqual(tree(dir), before, 'something was written');

    const run = install(kit, 'apply', dir, '--packs', LIBRARY_PACKS);
    assert.equal(run.status, 0, run.output);
    const expected = packFiles(kit, ['operations', 'dotnet-shared', 'dotnet-library']);
    for (const rel of LIBRARY_FILES) {
      assert.ok(existsSync(join(dir, rel)), `${rel} not installed`);
      assert.equal(sha(read(dir, rel)), sha(expected[rel]), `${rel} differs from the kit's copy`);
    }
    for (const [rel, paths] of Object.entries(LIBRARY_RULES)) {
      assert.deepEqual(frontmatterList(read(dir, rel), 'paths'), paths, `${rel} has another path filter`);
    }
    assert.deepEqual(record(dir).packs, ['operations', 'dotnet-shared', 'dotnet-library']);
    assert.match(run.stdout, /packs: operations, dotnet-shared, dotnet-library/, 'the output names the three packs');

    const template = templatePackValues(read(dir, TEMPLATE));
    assert.deepEqual(template.filter((v) => v.pack === 'dotnet-shared').map((v) => v.label), ['Solution name', 'Namespace root', 'Unit-test command', 'Test projects', 'Mutation threshold'], 'the installed template\'s Pack values lines of the dotnet-shared pack');
    const dotnetFiles = [...LIBRARY_FILES, ...SHARED_FILES];
    const labels = new Set(template.map((v) => v.label));
    for (const rel of dotnetFiles) {
      for (const label of packValueLabels(read(dir, rel))) assert.ok(labels.has(label), `${rel} names the Pack values line "${label}", which the template does not have`);
    }
    const named = new Set(dotnetFiles.flatMap((rel) => packValueLabels(read(dir, rel))));
    assert.deepEqual([...named].sort(), ['Mutation threshold', 'Namespace root', 'Solution name', 'Test projects', 'Unit-test command'], 'the pack items name the five lines');

    const known = new Set(['operations', 'dotnet-shared', 'dotnet-library'].flatMap((name) => { const p = readPack(kit, name); return [...p.agents, ...p.skills]; }));
    const installed = Object.keys(expected).filter((rel) => existsSync(join(dir, rel)));
    assert.equal(installed.length, OPERATIONS_AGENTS.length + dotnetFiles.length, 'every file of the three packs is installed');
    for (const rel of installed) {
      const text = read(dir, rel);
      assert.deepEqual(br3Violations(text), [], `BR-3 violated in ${rel}`);
      assert.deepEqual(br5Violations(text), [], `BR-5 violated in ${rel}`);
      const dangling = references(text).filter((ref) => !known.has(ref.name));
      assert.deepEqual(dangling, [], `BR-4 violated in ${rel}`);
    }
  });

  test('AC-15: --packs dotnet-library on a project without packs gives BR-2, writes nothing and exits non-zero', () => {
    const dir = project();
    const run = install(kit, 'apply', dir, '--level', '1', '--packs', 'dotnet-library');
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, BR2);
    assert.deepEqual(tree(dir), {}, 'something was written');
  });

  test('AC-15: --packs dotnet-library on a project that has both packs gives BR-2 and changes nothing', () => {
    const dir = project();
    assert.equal(install(kit, 'apply', dir, '--level', '1', '--packs', LIBRARY_PACKS).status, 0);
    const before = tree(dir);
    const run = install(kit, 'apply', dir, '--packs', 'dotnet-library');
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, BR2);
    assert.deepEqual(tree(dir), before, 'something was changed');
    assert.deepEqual(record(dir).packs, ['operations', 'dotnet-shared', 'dotnet-library']);
  });

  test("AC-15: --packs operations on a project that has both packs removes dotnet-library's unchanged files and keeps operations", () => {
    const dir = project();
    assert.equal(install(kit, 'apply', dir, '--level', '1', '--packs', LIBRARY_PACKS).status, 0);
    const run = install(kit, 'apply', dir, '--packs', 'operations');
    assert.equal(run.status, 0, run.output);
    const reported = rows(run.stdout);
    for (const rel of LIBRARY_FILES) {
      assert.ok(!existsSync(join(dir, rel)), `${rel} was not removed`);
      assert.equal(reported[rel], 'remove', `${rel} is not reported as remove:\n${run.stdout}`);
    }
    for (const rel of OPERATIONS_AGENTS) assert.ok(existsSync(join(dir, rel)), `${rel} of operations is gone`);
    const rec = record(dir);
    assert.deepEqual(rec.packs, ['operations']);
    for (const rel of LIBRARY_FILES) assert.ok(!(rel in rec.files), `${rel} is still recorded`);
    assert.match(run.stdout, /packs: operations\b/);
  });

  test('AC-16: apply --packs operations,dotnet-shared,dotnet-library at level 3 installs code-analysis, add-public-api, fix-violations and the two rules left in the pack, each rule with the path filter of § Packs', () => {
    const dir = project();
    const run = install(kit, 'apply', dir, '--level', '3', '--packs', LIBRARY_PACKS);
    assert.equal(run.status, 0, run.output);
    const expected = packFiles(kit, ['dotnet-library']);
    assert.deepEqual(Object.keys(expected).sort(), [...LIBRARY_FILES].sort(), 'the pack installs other files than the agent, the two skills and the two rules');
    for (const rel of LIBRARY_FILES) {
      assert.ok(existsSync(join(dir, rel)), `${rel} not installed`);
      assert.equal(rows(run.stdout)[rel], 'add', run.stdout);
      assert.equal(record(dir).files[rel], sha(expected[rel]), `${rel} not recorded with its hash`);
    }
    for (const [rel, paths] of Object.entries(LIBRARY_RULES)) {
      assert.deepEqual(frontmatterList(read(dir, rel), 'paths'), paths, `${rel} has another path filter`);
    }
    assert.ok(existsSync(join(dir, '.claude/skills/build-slice/SKILL.md')), 'level 3 installs the workflow too');
  });
});
