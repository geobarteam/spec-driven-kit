// Integration tests of the installer: a copy of the kit, run as a child process against a temporary project folder.
// Kit 3.0.0: the sample pack is dotnet-shared; a pack that needs another and a pack the kit retired are planted in a
// copy of the kit.

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { br5Violations, frontmatterList, references } from '../tools/pack-checks.mjs';
import { packFiles, readPack } from '../tools/packs.mjs';
import { RECORD, cleanup, install, kitCopy, project, record, sha, tree } from './helpers.mjs';

const RULES = '.claude/rules/spec-driven.md';
const TEMPLATE = '.claude/templates/project-settings.md';
/** The rule of the dotnet-shared pack, and its script. */
const RULE = '.claude/rules/testing-for-agents.md';
const SCRIPT = 'scripts/mutation-check.mjs';
const PACK_RULE = 'packs/dotnet-shared/rules/testing-for-agents.md';
const OWN_TEXT = "# The project's own testing rule\n";
/** The installer's output rows as { path: action }, e.g. { '.claude/rules/x.md': 'collision, skipped' }. */
const rows = (stdout) =>
  Object.fromEntries(stdout.split(/\r?\n/).flatMap((line) => {
    const match = /^([a-z]+(?:, [a-z]+)?)\s+((?:\.claude|scripts)\/\S+)/.exec(line);
    return match ? [[match[2], match[1]]] : [];
  }));
const read = (dir, rel) => readFileSync(join(dir, rel), 'utf8');
const write = (dir, rel, content) => {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), content);
};
const append = (dir, rel, line) => writeFileSync(join(dir, rel), read(dir, rel) + line);
/** Plants a pack in a kit copy: one path-scoped rule, the given needs. */
const plantPack = (kit, name, needs = []) => {
  write(kit, `packs/${name}/pack.json`, JSON.stringify({ name, description: `the ${name} pack`, needs, rules: [name] }));
  write(kit, `packs/${name}/rules/${name}.md`, `---\npaths:\n  - "src/**"\n---\n# ${name}\n`);
};

describe('packs: install, record, keep', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('AC-1: on a 2.1.0 project at level 3 without packs, apply changes the kit texts, adds nothing, removes the retired files, records 3.0.0 and no pack', () => {
    const dir = project('project-2.1.0');
    assert.equal(record(dir).kitVersion, '2.1.0', 'the fixture is a 2.1.0 install');
    const before = tree(dir);
    const run = install(kit, 'apply', dir);
    assert.equal(run.status, 0, run.output);
    const after = tree(dir);
    const changed = Object.keys(after).filter((p) => p in before && before[p] !== after[p] && p !== RECORD);
    const added = Object.keys(after).filter((p) => !(p in before));
    const removed = Object.keys(before).filter((p) => !(p in after));
    const expected = [
      RULES, TEMPLATE, '.claude/skills/bugfix/SKILL.md', '.claude/skills/build-slice/SKILL.md', '.claude/skills/investigate/SKILL.md',
      '.claude/skills/write-spec/SKILL.md', '.claude/skills/amend-spec/SKILL.md', '.claude/skills/new-feature/SKILL.md',
      '.claude/agents/spec-critic.md', '.claude/agents/spec-reviewer.md', '.claude/templates/spec-template.md',
      '.claude/hooks/guard.mjs', '.claude/hooks/verify.mjs', '.claude/templates/settings-fragment.json', '.claude/settings.json',
    ];
    assert.deepEqual(changed.sort(), expected.sort(), 'files changed by the update');
    assert.deepEqual(added, [], 'files added by the update');
    assert.deepEqual(removed.sort(), ['.claude/agents/slice-verifier.md', '.claude/templates/slice-recap-template.md'], 'files removed by the update');
    assert.equal(record(dir).kitVersion, '3.0.0');
    assert.deepEqual(record(dir).packs, []);
  });

  for (const level of [1, 3]) {
    test(`AC-2: apply --packs dotnet-shared at level ${level} installs the rule and the script, records the pack with a hash per file and names it`, () => {
      const dir = project();
      const run = install(kit, 'apply', dir, '--level', String(level), '--packs', 'dotnet-shared');
      assert.equal(run.status, 0, run.output);
      const rec = record(dir);
      assert.deepEqual(rec.packs, ['dotnet-shared']);
      assert.equal(rec.level, level);
      const expected = packFiles(kit, ['dotnet-shared']);
      assert.deepEqual(Object.keys(expected).sort(), [RULE, SCRIPT].sort());
      for (const [rel, content] of Object.entries(expected)) {
        assert.equal(sha(read(dir, rel)), sha(content), `${rel} differs from the kit's copy`);
        assert.equal(rec.files[rel], sha(content), `${rel} not recorded with its hash`);
      }
      assert.match(run.stdout, new RegExp(`level ${level}.*dotnet-shared`), 'the output names the pack next to the level');
      if (level === 1) assert.ok(!existsSync(join(dir, '.claude/skills')), 'level 1 installs no skills');
    });
  }

  test('AC-3: after an install with dotnet-shared, apply without --packs keeps the pack and reports its files as same', () => {
    const dir = project();
    assert.equal(install(kit, 'apply', dir, '--packs', 'dotnet-shared').status, 0);
    const run = install(kit, 'apply', dir);
    assert.equal(run.status, 0, run.output);
    assert.deepEqual(record(dir).packs, ['dotnet-shared']);
    assert.equal(rows(run.stdout)[RULE], 'same', run.stdout);
    assert.equal(rows(run.stdout)[SCRIPT], 'same', run.stdout);
  });

  test('AC-4: an unknown pack gives BR-1 with the kit\'s pack names, writes nothing and exits non-zero', () => {
    const dir = project();
    const run = install(kit, 'apply', dir, '--packs', 'bogus');
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /install: unknown pack bogus; the kit has: dotnet-shared$/m);
    assert.deepEqual(tree(dir), {}, 'something was written');
  });

  for (const [label, args] of [
    ['empty', ['--packs']],
    ['an empty value', ['--packs', '']],
    ['none with a name', ['--packs', 'none,dotnet-shared']],
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
      for (const rel of [RULE, SCRIPT]) assert.ok(!existsSync(join(dir, rel)), `${rel} installed without --packs`);
      assert.deepEqual(record(dir).packs, []);
    });
  }

  test('AC-6: every installed pack file passes the pack checks: path-scoped rules, resolved references, no secret', () => {
    const dir = project('project-2.1.0');
    assert.equal(install(kit, 'apply', dir, '--packs', 'dotnet-shared').status, 0);
    const known = new Set([...readPack(kit, 'dotnet-shared').agents, ...readPack(kit, 'dotnet-shared').skills]);
    for (const rel of [RULE, SCRIPT]) {
      const text = read(dir, rel);
      assert.deepEqual(br5Violations(text), [], `BR-5 violated in ${rel}`);
      assert.deepEqual(references(text).filter((ref) => !known.has(ref.name)), [], `BR-4 violated in ${rel}`);
    }
    assert.ok(frontmatterList(read(dir, RULE), 'paths').length > 0, 'the rule has no paths scope');
  });
});

describe("a project's own files and its edits to pack files survive install, update and removal", () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test("AC-8: the project's own file at a pack path is collision, skipped and unchanged; with --overwrite it is replaced and recorded", () => {
    const dir = project();
    write(dir, RULE, OWN_TEXT);
    const run = install(kit, 'apply', dir, '--level', '1', '--packs', 'dotnet-shared');
    assert.equal(run.status, 0, run.output);
    assert.equal(sha(read(dir, RULE)), sha(OWN_TEXT), "the project's own file was replaced");
    assert.equal(rows(run.stdout)[RULE], 'collision, skipped', run.stdout);
    assert.equal(record(dir).files[RULE], undefined, 'a skipped file was recorded');
    assert.match(run.stdout, /1 file\(s\) skipped/);

    const kitText = packFiles(kit, ['dotnet-shared'])[RULE];
    const force = install(kit, 'apply', dir, '--overwrite', RULE);
    assert.equal(force.status, 0, force.output);
    assert.equal(rows(force.stdout)[RULE], 'collision, overwritten', force.stdout);
    assert.equal(sha(read(dir, RULE)), sha(kitText), "the file is not the kit's copy");
    assert.equal(record(dir).files[RULE], sha(kitText), 'the replaced file is not recorded');
  });

  test("AC-9: a pack file changed in the project is modified, skipped when the kit's pack changes, and the unchanged pack file is replaced", () => {
    const changingKit = kitCopy();
    const dir = project();
    assert.equal(install(changingKit, 'apply', dir, '--level', '1', '--packs', 'dotnet-shared').status, 0);
    append(dir, RULE, "\n<!-- the project's edit -->\n");
    const edited = read(dir, RULE);
    append(changingKit, PACK_RULE, '\n<!-- changed in the kit -->\n');
    append(changingKit, `packs/dotnet-shared/${SCRIPT}`, '\n// changed in the kit\n');

    const run = install(changingKit, 'apply', dir);
    assert.equal(run.status, 0, run.output);
    assert.equal(sha(read(dir, RULE)), sha(edited), "the project's edit was lost");
    assert.equal(rows(run.stdout)[RULE], 'modified, skipped', run.stdout);
    assert.match(run.stdout, new RegExp(`kept, differs from kit 3\\.0\\.0: ${RULE.replace(/\./g, '\\.')}`));
    assert.equal(rows(run.stdout)[SCRIPT], 'update', run.stdout);
    assert.equal(sha(read(dir, SCRIPT)), sha(read(changingKit, `packs/dotnet-shared/${SCRIPT}`)), 'the unchanged pack file was not replaced');
  });

  test('AC-10: apply --packs none removes the unchanged pack files, keeps and lists the changed ones, and records no pack', () => {
    const dir = project();
    assert.equal(install(kit, 'apply', dir, '--level', '1', '--packs', 'dotnet-shared').status, 0);
    append(dir, RULE, "\n<!-- the project's edit -->\n");
    const edited = read(dir, RULE);

    const run = install(kit, 'apply', dir, '--packs', 'none');
    assert.equal(run.status, 0, run.output);
    assert.ok(!existsSync(join(dir, SCRIPT)), 'the unchanged pack file was not removed');
    assert.equal(rows(run.stdout)[SCRIPT], 'remove', run.stdout);
    assert.equal(sha(read(dir, RULE)), sha(edited), 'the edited pack file was replaced');
    assert.equal(rows(run.stdout)[RULE], 'modified, skipped', run.stdout);
    assert.match(run.stdout, /packs: none/);
    assert.deepEqual(record(dir).packs, []);
    assert.ok(existsSync(join(dir, '.claude/agents/spec-reviewer.md')), "the kit's own files stay");
  });

  test('AC-10: the command remove removes the unchanged pack files and keeps the changed ones', () => {
    const dir = project();
    assert.equal(install(kit, 'apply', dir, '--level', '1', '--packs', 'dotnet-shared').status, 0);
    append(dir, RULE, "\n<!-- the project's edit -->\n");
    const edited = read(dir, RULE);

    const run = install(kit, 'remove', dir);
    assert.equal(run.status, 0, run.output);
    assert.ok(!existsSync(join(dir, SCRIPT)), 'the unchanged pack file was not removed');
    assert.equal(rows(run.stdout)[SCRIPT], 'removed', run.stdout);
    assert.equal(sha(read(dir, RULE)), sha(edited), 'the edited pack file was replaced');
    assert.equal(rows(run.stdout)[RULE], 'kept', run.stdout);
    assert.equal(record(dir), null, 'the record was not removed');
    assert.ok(!existsSync(join(dir, '.claude/agents/spec-reviewer.md')), "the kit's own files are removed too");
  });
});

describe('packs that need another, and packs the kit no longer has', () => {
  after(cleanup);

  test('AC-15: a pack that needs another is refused alone (BR-2), writes nothing, and installs with it', () => {
    const kit = kitCopy();
    plantPack(kit, 'extra', ['dotnet-shared']);
    const dir = project();
    const alone = install(kit, 'apply', dir, '--level', '1', '--packs', 'extra');
    assert.notEqual(alone.status, 0);
    assert.match(alone.stderr, /install: pack extra needs pack dotnet-shared; add it to --packs/);
    assert.deepEqual(tree(dir), {}, 'something was written');
    const both = install(kit, 'apply', dir, '--level', '1', '--packs', 'dotnet-shared,extra');
    assert.equal(both.status, 0, both.output);
    assert.deepEqual(record(dir).packs, ['dotnet-shared', 'extra']);
  });

  test('3.0.0: an update of a project that recorded a pack the kit no longer has drops the pack, removes its unchanged files and keeps its changed ones', () => {
    const kit = kitCopy();
    plantPack(kit, 'retired-one');
    plantPack(kit, 'retired-two');
    const dir = project('project-2.1.0');
    assert.equal(install(kit, 'apply', dir, '--packs', 'dotnet-shared,retired-one,retired-two').status, 0);
    append(dir, '.claude/rules/retired-two.md', "\n<!-- the project's edit -->\n");
    rmSync(join(kit, 'packs/retired-one'), { recursive: true });
    rmSync(join(kit, 'packs/retired-two'), { recursive: true });

    const run = install(kit, 'apply', dir);
    assert.equal(run.status, 0, run.output);
    assert.match(run.stdout, /pack retired-one is no longer in kit 3\.0\.0: dropped/);
    assert.match(run.stdout, /pack retired-two is no longer in kit 3\.0\.0: dropped/);
    assert.ok(!existsSync(join(dir, '.claude/rules/retired-one.md')), 'the unchanged file of a retired pack was not removed');
    assert.equal(rows(run.stdout)['.claude/rules/retired-one.md'], 'remove', run.stdout);
    assert.ok(existsSync(join(dir, '.claude/rules/retired-two.md')), 'the changed file of a retired pack was removed');
    assert.equal(rows(run.stdout)['.claude/rules/retired-two.md'], 'modified, skipped', run.stdout);
    assert.deepEqual(record(dir).packs, ['dotnet-shared']);
    assert.ok(existsSync(join(dir, RULE)), 'the kept pack lost its file');
  });

  test('3.0.0: naming a pack the kit no longer has on --packs is still refused as unknown', () => {
    const kit = kitCopy();
    const dir = project();
    const run = install(kit, 'apply', dir, '--packs', 'operations');
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /install: unknown pack operations; the kit has: dotnet-shared/);
  });
});
