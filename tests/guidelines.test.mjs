// Tests of _specs/Guidelines/spec.md. Integration: the installer of a copy of the kit, run as a
// child process against a fixture project. Unit: the pack sources and the core texts as data.

import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { br10Violations, br11Violations, br12Violations, guidelineParagraphs, guidelineRole, profileKeys, sectionTable, sonarKeys } from '../tools/guideline-checks.mjs';
import { frontmatterList } from '../tools/pack-checks.mjs';
import { exclusions, kitPacks, missingNeeds, packSources, readPack } from '../tools/packs.mjs';
import { KIT, RECORD, cleanup, install, kitCopy, project, record, tree } from './helpers.mjs';

const RULES = '.claude/rules/spec-driven.md';
const TEMPLATE = '.claude/templates/project-settings.md';
const TESTS = '.claude/rules/tests.md';
const AGENT_TESTS = '.claude/rules/testing-for-agents.md';
const CODING = '.claude/rules/coding.md';
const CODING_SOURCE = 'packs/dotnet-shared/rules/coding.md';
const PROFILE = 'tests/data/sonar-profile-csharp.md';
const BR9 = 'code-analysis: <key> is not an accepted suppression; the finding is reported, not suppressed';
/** The guidelines of § Guideline sets: name, role (BR-8) and paths. Slice 1 built the two testing ones, slice 2 coding. */
const GUIDELINES = {
  coding: { role: 'coding', paths: ['src/**/*.cs', 'src/**/*.razor'] },
  tests: { role: 'testing', paths: ['src/Test/**', 'src/**/*Tests/**'] },
  'testing-for-agents': { role: 'testing', paths: ['src/Test/**'] },
  'architecture-shared': { role: 'architecture', paths: ['src/Core/**', 'src/Contracts/**', 'src/Host/**', 'src/Presentation/**'] },
  'architecture-blazor-server': { role: 'architecture', paths: ['src/Host/Web/**', 'src/Host/BFF/**', 'src/Host/Api/**', 'src/Host/Worker/**', 'src/Presentation/**', 'src/Core/Infrastructure/**'] },
  'architecture-blazor-wasm': { role: 'architecture', paths: ['src/Host/Cfe/**', 'src/Host/Wasm/**', 'src/Host/Worker/**', 'src/Presentation/**', 'src/Infrastructure/**'] },
};
/**
 * The core texts that read a guideline from slice 1 on (§ Where used). The third, slice-verifier, is
 * retired by kit 2.5.0 (_specs/KitLean/spec.md BR-10): the kit no longer ships it, the fixtures still have it.
 */
const SLICE1_CORE = ['.claude/skills/build-slice/SKILL.md', '.claude/skills/bugfix/SKILL.md'];
const RETIRED_VERIFIER = '.claude/agents/slice-verifier.md';
/**
 * The core texts that read a guideline from slice 4 on, with the roles § Where used gives each and
 * what each must say it does with them (AC-7, AC-15).
 */
const SLICE4_CORE = {
  '.claude/skills/investigate/SKILL.md': { roles: ['architecture', 'testing'], does: [/Findings/, /dependency rules?/, /changes the size/, /level/] },
  '.claude/skills/write-spec/SKILL.md': { roles: ['architecture', 'testing'], does: [/diagram/, /open question/, /level/, /wiring/] },
  '.claude/agents/spec-critic.md': { roles: ['architecture', 'testing'], does: [/checks? 3/i, /blocking/, /quot/] },
  '.claude/agents/spec-reviewer.md': { roles: ['architecture', 'testing', 'coding'], does: [/steps? 3/i, /step 6/i, /Sonar/, /known deviation/] },
  '.claude/skills/amend-spec/SKILL.md': { roles: ['architecture', 'testing'], does: [/diagram/, /check/, /write-spec/] },
};
const CORE_TEXTS = [...SLICE1_CORE, ...Object.keys(SLICE4_CORE)];
const BR2_SHARED = /install: pack dotnet-library needs pack dotnet-shared; add it to --packs/;

const read = (dir, rel) => readFileSync(join(dir, rel), 'utf8');
const rows = (stdout) =>
  Object.fromEntries(stdout.split(/\r?\n/).flatMap((line) => {
    const match = /^([a-z]+(?:, [a-z]+)?)\s+(\.claude\/\S+)/.exec(line);
    return match ? [[match[2], match[1]]] : [];
  }));
const ruleSources = () => kitPacks(KIT).flatMap((pack) =>
  packSources(KIT, pack).filter((s) => s.target.startsWith('.claude/rules/')).map((s) => ({ pack, name: s.target.slice(14, -3), ...s })));
const guidelineSources = () => ruleSources().filter((s) => s.name in GUIDELINES);
/** The names a core text's Guidelines paragraph must not hold (BR-12): the packs and the guideline files. */
const forbiddenNames = () => ({ packs: kitPacks(KIT), files: Object.keys(GUIDELINES) });

describe('Guidelines slice 1: a builder follows the testing guideline and the verifier checks it', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('slice test: a 2.2.0 project with operations gets no guideline on apply; with operations,dotnet-shared the two testing rules are installed with their role line; a 2.2.0 library project sees tests as update, and as modified, skipped when edited', () => {
    const ops = project('project-2.2.0-operations');
    const plain = install(kit, 'apply', ops);
    assert.equal(plain.status, 0, plain.output);
    for (const rel of [TESTS, AGENT_TESTS]) assert.ok(!existsSync(join(ops, rel)), `${rel} installed without dotnet-shared`);

    const shared = install(kit, 'apply', ops, '--packs', 'operations,dotnet-shared');
    assert.equal(shared.status, 0, shared.output);
    assert.equal(guidelineRole(read(ops, TESTS)), 'testing');
    assert.equal(guidelineRole(read(ops, AGENT_TESTS)), 'testing');

    const lib = project('project-2.2.0-library');
    const update = install(kit, 'apply', lib, '--packs', 'operations,dotnet-shared,dotnet-library');
    assert.equal(update.status, 0, update.output);
    assert.equal(rows(update.stdout)[TESTS], 'update', update.stdout);

    const edited = project('project-2.2.0-library');
    writeFileSync(join(edited, TESTS), `${read(edited, TESTS)}\n- The project's own line.\n`);
    const kept = install(kit, 'apply', edited, '--packs', 'operations,dotnet-shared,dotnet-library');
    assert.equal(kept.status, 0, kept.output);
    assert.equal(rows(kept.stdout)[TESTS], 'modified, skipped', kept.stdout);
    assert.match(read(edited, TESTS), /The project's own line\./);
  });

  test('AC-1: on a 2.2.0 project with operations, apply without --packs adds no guideline, changes only the core texts that read a guideline, the rules file and the template, and records 2.3.0', () => {
    const dir = project('project-2.2.0-operations');
    assert.equal(record(dir).kitVersion, '2.2.0', 'the fixture is a 2.2.0 install');
    const before = tree(dir);
    const run = install(kit, 'apply', dir);
    assert.equal(run.status, 0, run.output);
    const after = tree(dir);
    const changed = Object.keys(after).filter((p) => p in before && before[p] !== after[p] && p !== RECORD);
    // sonar-review is a text of § Where used too: it gains its Guidelines paragraph in slice 2.
    // Unattended (2.4.0): the guard and the runner, the settings fragment without its ask rules, and settings.json losing them.
    const unattended = ['.claude/hooks/guard.mjs', '.claude/hooks/verify.mjs', '.claude/templates/settings-fragment.json', '.claude/settings.json'];
    // Lean (2.5.0) slice 1: new-feature starts the critic only on request; slice 3: the spec template's "Outer test" column;
    // slice 4: the recap template's AC-to-test table, without a Verifier row.
    // Lean 2.6.0 (BR-61): the recap template is no longer changed but removed (see below).
    const lean = ['.claude/skills/new-feature/SKILL.md', '.claude/templates/spec-template.md'];
    assert.deepEqual(changed.sort(), [RULES, TEMPLATE, ...CORE_TEXTS, '.claude/agents/sonar-review.md', ...unattended, ...lean].sort(), 'files changed by the update');
    // Lean (2.5.0) slice 3: the slice-plan template was added (slice 2's architecture template is gone in 2.5.3, D15);
    // 2.5.7 (BR-40) drops the slice-plan template, so the update adds nothing; still no guideline.
    assert.deepEqual(Object.keys(after).filter((p) => !(p in before)), [], 'files added by the update');
    // Lean (2.5.0) slice 5: the retired slice-verifier is removed; 2.6.0 (BR-61): the unchanged recap template too, and nothing else.
    assert.deepEqual(Object.keys(before).filter((p) => !(p in after)).sort(), ['.claude/templates/slice-recap-template.md', RETIRED_VERIFIER].sort(), 'files removed by the update');
    // Lean (2.5.0) slice 6: the version; slice 8 moves it to 2.5.1, slice 9 to 2.5.2, slice 11 to 2.5.3, slice 12 to 2.5.4, slice 13 to 2.5.5, slice 14 to 2.5.6, slice 15 to 2.5.7, slice 16 to 2.5.8, slice 17 to 2.5.9, slice 18 to 2.5.10, slice 19 to 2.5.11, slice 20 to 2.6.0.
    assert.equal(record(dir).kitVersion, '2.6.5'); // KitLean 2.6.5 (BR-89)
    assert.deepEqual(record(dir).packs, ['operations']);
  });

  test('AC-2: apply --packs operations,dotnet-shared installs tests and testing-for-agents with the paths of § Guideline sets, each starting with its role line', () => {
    const dir = project();
    const run = install(kit, 'apply', dir, '--packs', 'operations,dotnet-shared');
    assert.equal(run.status, 0, run.output);
    for (const [rel, name] of [[TESTS, 'tests'], [AGENT_TESTS, 'testing-for-agents']]) {
      assert.ok(existsSync(join(dir, rel)), `${rel} not installed`);
      assert.deepEqual(frontmatterList(read(dir, rel), 'paths'), GUIDELINES[name].paths, `${rel} has another path filter`);
      assert.equal(guidelineRole(read(dir, rel)), GUIDELINES[name].role, `${rel} has another role line`);
    }
    assert.deepEqual(record(dir).packs, ['operations', 'dotnet-shared']);
  });

  test('AC-3 (BR-2): --packs operations,dotnet-library is refused with the message naming dotnet-shared, and nothing is written', () => {
    const dir = project();
    const run = install(kit, 'apply', dir, '--packs', 'operations,dotnet-library');
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, BR2_SHARED);
    assert.deepEqual(tree(dir), {}, 'something was written');
  });

  test('AC-4: on a 2.2.0 library project, apply --packs operations,dotnet-shared,dotnet-library reports tests as update at its old path and records it under the new pack list', () => {
    const dir = project('project-2.2.0-library');
    const run = install(kit, 'apply', dir, '--packs', 'operations,dotnet-shared,dotnet-library');
    assert.equal(run.status, 0, run.output);
    assert.equal(rows(run.stdout)[TESTS], 'update', run.stdout);
    assert.equal(guidelineRole(read(dir, TESTS)), 'testing', 'the kit\'s new tests rule replaced the old one');
    assert.deepEqual(record(dir).packs, ['operations', 'dotnet-shared', 'dotnet-library']);
  });

  test('AC-4: with the 2.2.0 tests rule edited in the project, it is modified, skipped and keeps the edit', () => {
    const dir = project('project-2.2.0-library');
    const edited = `${read(dir, TESTS)}\n- The project's own line.\n`;
    writeFileSync(join(dir, TESTS), edited);
    const run = install(kit, 'apply', dir, '--packs', 'operations,dotnet-shared,dotnet-library');
    assert.equal(run.status, 0, run.output);
    assert.equal(rows(run.stdout)[TESTS], 'modified, skipped', run.stdout);
    assert.equal(read(dir, TESTS), edited);
  });

  test('AC-7: the core texts of the 2.1.0 fixture have no Guidelines paragraph', () => {
    const dir = project('project-2.1.0');
    for (const rel of [...CORE_TEXTS, RETIRED_VERIFIER]) assert.deepEqual(guidelineParagraphs(read(dir, rel)), [], `${rel} of 2.1.0 has a Guidelines paragraph`);
  });
});

describe('Guidelines § Guideline sets: the packs', () => {
  test('dotnet-shared holds tests and testing-for-agents and needs operations; dotnet-library needs operations and dotnet-shared and no longer holds tests', () => {
    const shared = readPack(KIT, 'dotnet-shared');
    assert.deepEqual([...shared.rules].sort(), ['architecture-shared', 'coding', 'testing-for-agents', 'tests']);
    assert.deepEqual(shared.needs, ['operations']);
    assert.match(shared.recommend, /\.csproj/);
    const library = readPack(KIT, 'dotnet-library');
    assert.deepEqual([...library.needs].sort(), ['dotnet-shared', 'operations']);
    assert.ok(!library.rules.includes('tests'), 'dotnet-library still declares tests');
    assert.ok(!existsSync(join(KIT, 'packs/dotnet-library/rules/tests.md')), 'dotnet-library still has a tests file');
  });

  test('BR-2: dotnet-library without dotnet-shared is named as missing it', () => {
    assert.deepEqual(missingNeeds(KIT, ['operations', 'dotnet-library']), [{ pack: 'dotnet-library', needs: 'dotnet-shared' }]);
    assert.deepEqual(missingNeeds(KIT, ['operations', 'dotnet-shared', 'dotnet-library']), []);
  });
});

describe('BR-8: every guideline starts with its role line, and no other pack rule carries one', () => {
  test('AC-2: each guideline of the packs carries the role of § Guideline sets; every other pack rule carries none', () => {
    const rules = ruleSources();
    assert.ok(rules.some((s) => s.name === 'tests') && rules.some((s) => s.name === 'testing-for-agents'), 'the two testing guidelines are pack rules');
    for (const source of rules) {
      const expected = GUIDELINES[source.name]?.role ?? null;
      assert.equal(guidelineRole(source.text), expected, `${source.rel}: role ${guidelineRole(source.text)}, expected ${expected}`);
    }
  });

  test('AC-2: each guideline of the packs has the paths of § Guideline sets', () => {
    for (const source of guidelineSources().filter((s) => GUIDELINES[s.name].paths)) {
      assert.deepEqual(frontmatterList(source.text, 'paths'), GUIDELINES[source.name].paths, `${source.rel} has another path filter`);
    }
  });

  test('AC-2: a planted guideline without the line and a planted other rule with the line are found', () => {
    assert.equal(guidelineRole('---\npaths:\n  - "src/Test/**"\n---\n# Test Conventions\n'), null);
    assert.equal(guidelineRole('---\npaths:\n  - "src/**/*.cs"\n---\n<!-- guideline: testing -->\n# Public API\n'), 'testing');
    assert.equal(guidelineRole('<!-- guideline: architecture -->\n# No frontmatter\n'), 'architecture');
    assert.equal(guidelineRole('---\npaths: []\n---\n# Title\n<!-- guideline: coding -->\n'), null, 'the line counts only as the first line of the body');
    assert.equal(guidelineRole('---\npaths: []\n---\n<!-- guideline: style -->\n'), null, 'an unknown role is no role');
  });
});

describe('BR-10: no guideline holds a template token, a personal name, a national number, an e-mail address, a host name, a URL or an id', () => {
  test('AC-5: no guideline of the packs holds a pattern of BR-10', () => {
    for (const source of guidelineSources()) assert.deepEqual(br10Violations(source.text), [], `BR-10 violated in ${source.rel}`);
  });

  for (const [planted, pattern] of [
    ['The root is {{NamespaceRoot}}.', 'token'],
    ['new Doctor { Name = "Dr. Smith" }', 'personal name'],
    ['The NISS 85.07.30-033.28 is a sample.', 'national number'],
    ['Seed 85073003328 as the INS.', 'national number'],
    ['Mail the team at team.lead@example.org.', 'e-mail address'],
    ['The server sonar.example.be answers.', 'host name'],
    ['Call 10.12.0.4 for the API.', 'host name'],
    ['See https://example.org/docs for more.', 'URL'],
    ['Subscription 3f2504e0-4f89-11d3-9a0c-0305e82c3301.', 'id'],
  ]) {
    test(`AC-5: a planted ${pattern} fails: ${planted}`, () => {
      assert.deepEqual(br10Violations(planted).map((v) => v.pattern), [pattern]);
    });
  }

  test('AC-5: namespaces, file names, relative routes, versions and test names pass', () => {
    for (const line of [
      'Use `Microsoft.Extensions.TimeProvider.Testing` and `System.IO`.',
      'Settings go in `appsettings.UnitTest.json`; tests in `GetDoctorsQueryTests.cs`.',
      'var response = await _client.GetAsync("/api/doctor");',
      'MSTest v4, .NET 8, kit 2.3.0, `Execute_WhenNameDuplicated_ReturnsError`.',
      'new DateTimeOffset(2026, 3, 13, 10, 0, 0, TimeSpan.Zero)',
    ]) assert.deepEqual(br10Violations(line), [], line);
  });
});

describe('BR-12: each core text that reads a guideline has one Guidelines paragraph naming roles only', () => {
  test('AC-7: build-slice and bugfix each have exactly one Guidelines paragraph, naming roles only; slice-verifier is retired (KitLean AC-10)', () => {
    assert.ok(!existsSync(join(KIT, RETIRED_VERIFIER)), 'the kit still ships slice-verifier');
    for (const rel of SLICE1_CORE) {
      const paragraphs = guidelineParagraphs(read(KIT, rel));
      assert.equal(paragraphs.length, 1, `${rel} has ${paragraphs.length} Guidelines paragraphs`);
      assert.deepEqual(br12Violations(paragraphs[0], forbiddenNames()), [], `BR-12 violated in ${rel}`);
      assert.match(paragraphs[0], /\btesting\b/, `${rel} does not name the testing role`);
    }
  });

  test('AC-7: a planted pack name, a guideline file name and a hyphenated guideline name in a paragraph are found', () => {
    const names = forbiddenNames();
    assert.deepEqual(br12Violations('Read the rules of the dotnet-shared pack.', names).map((v) => v.name), ['dotnet-shared']);
    assert.deepEqual(br12Violations('Read `.claude/rules/tests.md` first.', names).map((v) => v.name), ['tests.md']);
    assert.deepEqual(br12Violations('Follow testing-for-agents.', names).map((v) => v.name), ['testing-for-agents']);
    assert.deepEqual(br12Violations('Read `tests` before the slice test.', names).map((v) => v.name), ['tests']);
    assert.deepEqual(br12Violations('Find the testing guideline under `.claude/rules/` by its first line; the tests it governs.', names), []);
  });

  test('AC-7: guidelineParagraphs takes the body under each "## Guidelines" heading up to the next heading', () => {
    assert.deepEqual(guidelineParagraphs('# T\n\n## Guidelines\n\nRead the testing guideline.\n\n## Next\n\nOther.\n'), ['Read the testing guideline.']);
    assert.deepEqual(guidelineParagraphs('# T\n## Guidelines\nA.\n## Guidelines\nB.\n').length, 2);
    assert.deepEqual(guidelineParagraphs('# T\n\nNo such section; the guidelines are elsewhere.\n'), []);
  });
});

describe('Guidelines slice 4: a spec is written and criticised against the guidelines', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('slice test: on update, investigate, write-spec, spec-critic, spec-reviewer and amend-spec each reach the project with exactly one Guidelines paragraph naming the roles of § Where used and no pack or file; the paragraph with a planted pack name fails BR-12 (AC-7)', () => {
    const dir = project('project-2.2.0-operations');
    const run = install(kit, 'apply', dir);
    assert.equal(run.status, 0, run.output);
    for (const [rel, { roles }] of Object.entries(SLICE4_CORE)) {
      const paragraphs = guidelineParagraphs(read(dir, rel));
      assert.equal(paragraphs.length, 1, `${rel} has ${paragraphs.length} Guidelines paragraphs`);
      assert.deepEqual(br12Violations(paragraphs[0], forbiddenNames()), [], `BR-12 violated in ${rel}`);
      for (const role of roles) assert.match(paragraphs[0], new RegExp(`\\b${role}\\b`), `${rel} does not name the ${role} role`);
      assert.deepEqual(br12Violations(`${paragraphs[0]} Read the rules of the dotnet-shared pack.`, forbiddenNames()).map((v) => v.name), ['dotnet-shared'], `a planted pack name in ${rel} is not found`);
    }
  });

  for (const [rel, { does }] of Object.entries(SLICE4_CORE)) {
    test(`AC-15: ${rel} says where it finds a guideline, at which step it reads it, what it does with it, and that it skips a role no file carries`, () => {
      const [paragraph] = guidelineParagraphs(read(KIT, rel));
      assert.ok(paragraph, `${rel} has no Guidelines paragraph`);
      assert.match(paragraph, /<!-- guideline: <role> -->/, `${rel} does not find guidelines by the role line`);
      assert.match(paragraph, /no file carries a role/i, `${rel} does not say what happens without a guideline`);
      for (const pattern of does) assert.match(paragraph, pattern, `${rel} does not say ${pattern}`);
    });
  }
});

/** The Sonar keys of the guideline's two tables: Rules (keys, intent, fix, by) and Accepted suppressions (key, where, justification). */
const tableKeys = (rows) => rows.flatMap((cells) => sonarKeys(cells[0] ?? ''));
const codingTables = (text) => ({ rules: sectionTable(text, 'Rules'), suppressions: sectionTable(text, 'Accepted suppressions') });

describe('Guidelines slice 2: a builder and the Sonar review share one coding guideline', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('slice test: apply --packs operations,dotnet-shared installs coding with its paths and role line; every Sonar key it holds is an active rule of the profile file, has an intent, and every accepted suppression has a justification (AC-2, AC-10)', () => {
    const dir = project();
    const run = install(kit, 'apply', dir, '--packs', 'operations,dotnet-shared');
    assert.equal(run.status, 0, run.output);
    assert.ok(existsSync(join(dir, CODING)), `${CODING} not installed`);
    const text = read(dir, CODING);
    assert.deepEqual(frontmatterList(text, 'paths'), GUIDELINES.coding.paths, 'coding has another path filter');
    assert.equal(guidelineRole(text), 'coding');
    const profile = profileKeys(read(KIT, PROFILE));
    assert.deepEqual(sonarKeys(text).filter((key) => !profile.has(key)), [], 'keys not in the profile file');
    const { rules, suppressions } = codingTables(text);
    assert.ok(rules.length > 0 && suppressions.length > 0, 'the Rules and Accepted suppressions tables');
    for (const cells of rules) assert.ok(cells[1]?.length > 0, `no intent: ${cells.join(' | ')}`);
    for (const cells of suppressions) assert.ok(sonarKeys(cells[0]).length > 0 && cells[2]?.length > 0, `no key or justification: ${cells.join(' | ')}`);
  });
});

describe('AC-10: every Sonar key of the coding guideline is an active rule of the profile, with an intent; every accepted suppression has a justification', () => {
  const text = () => read(KIT, CODING_SOURCE);
  const profile = () => profileKeys(read(KIT, PROFILE));

  test('AC-10: every S key in the guideline is an active rule of sonar-profile-csharp.md', () => {
    const keys = sonarKeys(text());
    assert.ok(keys.length >= 100, `only ${keys.length} keys`);
    assert.deepEqual(keys.filter((key) => !profile().has(key)), []);
  });

  test('AC-10: a planted key that is not in the profile file is found (S2259, dropped from the first draft)', () => {
    const planted = `${text()}\n| \`S2259\` | no null dereference | check first | by hand |\n`;
    assert.deepEqual(sonarKeys(planted).filter((key) => !profile().has(key)), ['S2259']);
  });

  test('AC-10: every S key stands in the first cell of a Rules or Accepted suppressions row; every Rules row has an intent and a fix', () => {
    const { rules, suppressions } = codingTables(text());
    const listed = new Set([...tableKeys(rules), ...tableKeys(suppressions)]);
    assert.deepEqual(sonarKeys(text()).filter((key) => !listed.has(key)), [], 'keys outside the two tables');
    for (const cells of rules) {
      assert.equal(cells.length, 4, `a Rules row has keys, intent, fix and by: ${cells.join(' | ')}`);
      assert.ok(cells[1].length > 0 && cells[2].length > 0 && /formatter|code-analysis|by hand/.test(cells[3]), `incomplete: ${cells.join(' | ')}`);
    }
  });

  test('AC-10: every accepted suppression names its key and its justification, among them S2325 on a module and S6960 on a CQRS controller', () => {
    const { suppressions } = codingTables(text());
    for (const cells of suppressions) assert.ok(sonarKeys(cells[0]).length > 0 && cells[2]?.length > 0, `no justification: ${cells.join(' | ')}`);
    const keys = tableKeys(suppressions);
    for (const key of ['S2325', 'S6960', 'S1133']) assert.ok(keys.includes(key), `${key} is not an accepted suppression`);
    assert.match(suppressions.find((c) => c[0].includes('S2325'))[2], /need an instance as module/);
  });

  test('AC-10: the guideline tells the builder to run the formatter and read the build\'s analyzer warnings before every commit', () => {
    assert.match(text(), /before every commit/i);
    assert.match(text(), /`dotnet format`/);
    assert.match(text(), /warnings, not only the errors/);
  });

  test('sectionTable reads the body rows of the first table under a "## " heading; profileKeys and sonarKeys read S keys only', () => {
    const doc = '# T\n\n## Rules\n\nText.\n\n| Keys | Intent |\n|---|---|\n| `S1` and `S108` | a \\| b |\n| by intent | c |\n\n| X |\n|---|\n| no |\n\n## Other\n\n| Y |\n|---|\n| z |\n';
    assert.deepEqual(sectionTable(doc, 'Rules'), [['`S1` and `S108`', 'a | b'], ['by intent', 'c']]);
    assert.deepEqual(sectionTable(doc, 'Missing'), []);
    assert.deepEqual(sonarKeys('`S108`, S2325 and S2325; SA1201, SX1309, CA1822, MSTEST0049, S6930–S6968'), ['S108', 'S2325', 'S6930', 'S6968']);
    assert.deepEqual([...profileKeys('| Key | Name |\n|---|---|\n| S101 | Types |\n| S1006 | Overrides |\ntext S2259\n')], ['S101', 'S1006']);
  });
});

describe('AC-11, BR-9: sonar-review, code-analysis and fix-violations read the coding guideline', () => {
  const names = () => forbiddenNames();
  for (const [rel, expected] of [
    ['packs/operations/agents/sonar-review.md', /accepted when justified[\s\S]*keys[^.]*the guideline does not hold/i],
    ['packs/dotnet-library/agents/code-analysis.md', new RegExp(BR9.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))],
    ['packs/dotnet-library/skills/fix-violations/SKILL.md', /`S\*` key[\s\S]*coding guideline/],
  ]) {
    test(`AC-11: ${rel} has one Guidelines paragraph naming the coding role only, and says what it does with it`, () => {
      const paragraphs = guidelineParagraphs(read(KIT, rel));
      assert.equal(paragraphs.length, 1, `${rel} has ${paragraphs.length} Guidelines paragraphs`);
      assert.match(paragraphs[0], /\bcoding\b/);
      assert.deepEqual(br12Violations(paragraphs[0], names()), [], `${rel} names a pack or a file`);
      assert.match(read(KIT, rel), expected);
    });
  }

  test('BR-9: code-analysis no longer adds a suppression merely when instructed', () => {
    assert.doesNotMatch(read(KIT, 'packs/dotnet-library/agents/code-analysis.md'), /unless explicitly instructed/);
  });
});

describe('AC-16: the setup recommends dotnet-shared and writes the Guidelines line', () => {
  test('the setup skill recommends dotnet-shared for a repository with a .csproj, says dotnet-library needs it, and writes the Guidelines line; the template has the line', () => {
    const setup = read(KIT, '.claude/skills/setup/SKILL.md');
    assert.match(setup, /`dotnet-shared`[^.\n]*`\.csproj`/, 'the setup does not recommend dotnet-shared for a .csproj');
    assert.match(setup, /`dotnet-library` needs `operations` and `dotnet-shared`/);
    assert.match(setup, /\*\*Guidelines\*\*/, 'the setup does not write the Guidelines line');
    assert.match(read(KIT, TEMPLATE), /^- \*\*Guidelines\*\*: /m, 'the template has no Guidelines line');
  });
});

const ARCH_SHARED = '.claude/rules/architecture-shared.md';
const ARCH_SHARED_SOURCE = 'packs/dotnet-shared/rules/architecture-shared.md';
const SPEC = 'tests/data/guideline-sources.md';
/** The source keys of the spec's Appendix (BR-11): the line "Source keys used in the architecture tables: …". */
const appendixKeys = () => {
  const match = /^Source keys used in the architecture tables: (.+?), as defined/m.exec(read(KIT, SPEC));
  assert.ok(match, 'the spec has no Appendix key line');
  return match[1].split(/,\s*/);
};

describe('Guidelines slice 3: a builder places code by the shared architecture rules', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('slice test: apply --packs operations,dotnet-shared installs architecture-shared with its paths and role line; every statement carries a source key of the Appendix (AC-2, AC-6)', () => {
    const dir = project();
    const run = install(kit, 'apply', dir, '--packs', 'operations,dotnet-shared');
    assert.equal(run.status, 0, run.output);
    assert.ok(existsSync(join(dir, ARCH_SHARED)), `${ARCH_SHARED} not installed`);
    const text = read(dir, ARCH_SHARED);
    assert.deepEqual(frontmatterList(text, 'paths'), GUIDELINES['architecture-shared'].paths, 'architecture-shared has another path filter');
    assert.equal(guidelineRole(text), 'architecture');
    assert.ok(sectionTable(text, 'Statements').length > 0, 'no Statements table');
    assert.deepEqual(br11Violations(text, appendixKeys()), [], 'BR-11 violated');
    const planted = text.replace(/^## Statements\r?\n\r?\n([^\n]*\n[^\n]*\n)/m, '## Statements\n\n$1| Layers | A planted statement without a source. | |\n');
    assert.deepEqual(br11Violations(planted, appendixKeys()).map((v) => v.problem), ['no source key']);
  });
});

describe('AC-6, BR-11: every statement of an architecture guideline carries a source key that resolves to the Appendix', () => {
  const text = () => read(KIT, ARCH_SHARED_SOURCE);

  test('AC-6: architecture-shared has no BR-11 violation and states the shared areas of § Architecture guidelines', () => {
    assert.deepEqual(br11Violations(text(), appendixKeys()), []);
    const areas = new Set(sectionTable(text(), 'Statements').map((cells) => cells[0]));
    for (const area of ['Layers', 'Dependencies allowed', 'Dependencies forbidden', 'Project structure', 'Naming', 'Dependency injection', 'Data access', 'Error handling', 'Messaging', 'Logging', 'Configuration']) {
      assert.ok(areas.has(area), `no ${area} statement`);
    }
  });

  test('AC-6 (Q6): the logging statements hold the level semantics and the ban on personal data; the forwarding specifics are left to the WebAssembly guideline', () => {
    const logging = sectionTable(text(), 'Statements').filter((cells) => cells[0] === 'Logging').map((cells) => cells[1]).join('\n');
    for (const level of ['Debug', 'Information', 'Warning', 'Error', 'Critical']) assert.match(logging, new RegExp(`\`${level}\``));
    assert.match(logging, /personal data/);
    assert.doesNotMatch(text(), /WasmLevel/);
  });

  test('AC-6: the guideline says a Blazor guideline states only what its hosting model adds or changes', () => {
    assert.match(text(), /states only what its hosting model adds or changes/);
  });

  test('AC-6: a planted row without a key, a row with an unknown key and a Sources key outside the Appendix are found', () => {
    const keys = ['CI-S', 'NSB', 'code'];
    const doc = (statements, sources = '| `CI-S` | template |\n| `NSB` | messaging |') =>
      `# T\n\n## Statements\n\n| Area | Statement | Source |\n|---|---|---|\n${statements}\n\n## Sources\n\n| Key | Base text |\n|---|---|\n${sources}\n`;
    assert.deepEqual(br11Violations(doc('| Layers | A. | CI-S, NSB |'), keys), []);
    assert.deepEqual(br11Violations(doc('| Layers | A. |  |'), keys), [{ statement: 'A.', problem: 'no source key' }]);
    assert.deepEqual(br11Violations(doc('| Layers | A. | CI-S, PoC |'), keys), [{ statement: 'A.', key: 'PoC', problem: 'unknown key' }]);
    assert.deepEqual(br11Violations(doc('| Layers | A. | code |'), keys), [{ statement: 'A.', key: 'code', problem: 'unknown key' }], 'a key of the Appendix that the guideline\'s Sources table lacks');
    assert.deepEqual(br11Violations(doc('| Layers | A. | CI-S |', '| `CI-S` | template |\n| `X-1` | other |'), keys), [{ key: 'X-1', problem: 'not in the Appendix' }]);
    assert.deepEqual(br11Violations('# T\n\nNo table.\n', keys), [{ problem: 'no statements' }]);
  });

  test('the Appendix line of the spec yields the fourteen source keys', () => {
    assert.deepEqual(appendixKeys(), ['CI-S', 'APP', 'BFF', 'PRES', 'DOM', 'PERS', 'NSB', 'CL-S', 'CI-W', 'CFE', 'REFIT-W', 'LOG', 'CL-W', 'code']);
  });
});

const ARCH_SERVER = '.claude/rules/architecture-blazor-server.md';
const ARCH_SERVER_SOURCE = 'packs/blazor-server/rules/architecture-blazor-server.md';
const BR7 = /install: packs blazor-server and blazor-wasm exclude each other; choose one/;
const statements = (text) => sectionTable(text, 'Statements');
const statementText = (text, area) => statements(text).filter((cells) => cells[0] === area).map((cells) => cells[1]).join('\n');

describe('Guidelines slice 5: a Blazor Server team installs its architecture guideline', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('slice test: apply --packs operations,dotnet-shared,blazor-server installs architecture-blazor-server with its paths and role line, every statement with a source key of the Appendix; both Blazor packs together are refused with BR-7 and nothing is written (AC-3, AC-12)', () => {
    const dir = project();
    const run = install(kit, 'apply', dir, '--packs', 'operations,dotnet-shared,blazor-server');
    assert.equal(run.status, 0, run.output);
    assert.ok(existsSync(join(dir, ARCH_SERVER)), `${ARCH_SERVER} not installed`);
    const text = read(dir, ARCH_SERVER);
    assert.deepEqual(frontmatterList(text, 'paths'), GUIDELINES['architecture-blazor-server'].paths, 'architecture-blazor-server has another path filter');
    assert.equal(guidelineRole(text), 'architecture');
    assert.deepEqual(br11Violations(text, appendixKeys()), [], 'BR-11 violated');
    assert.deepEqual(record(dir).packs, ['operations', 'dotnet-shared', 'blazor-server']);

    const both = project();
    const refused = install(kit, 'apply', both, '--packs', 'operations,dotnet-shared,blazor-server,blazor-wasm');
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, BR7);
    assert.deepEqual(tree(both), {}, 'something was written');
  });

  test('AC-3 (BR-2): --packs operations,blazor-server is refused with the message naming dotnet-shared, and nothing is written', () => {
    const dir = project();
    const run = install(kit, 'apply', dir, '--packs', 'operations,blazor-server');
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /install: pack blazor-server needs pack dotnet-shared; add it to --packs/);
    assert.deepEqual(tree(dir), {}, 'something was written');
  });
});

describe('§ Guideline sets: the blazor-server pack, BR-7', () => {
  test('AC-12: blazor-server holds architecture-blazor-server, needs dotnet-shared, excludes blazor-wasm, and its recommend names the Host/Web folder and the Blazor Server package', () => {
    const pack = readPack(KIT, 'blazor-server');
    assert.deepEqual(pack.rules, ['architecture-blazor-server']);
    assert.deepEqual(pack.needs, ['dotnet-shared']);
    assert.deepEqual(pack.excludes, ['blazor-wasm']);
    assert.deepEqual([pack.agents, pack.skills], [[], []]);
    assert.match(pack.recommend, /Host\/Web/);
    assert.match(pack.recommend, /Blazor Server package of the solution's core configuration library/);
  });

  test('BR-7: exclusions names each excluded pair of the list once, in list order, and nothing for one Blazor pack', () => {
    assert.deepEqual(exclusions(KIT, ['operations', 'dotnet-shared', 'blazor-server', 'blazor-wasm']), [{ pack: 'blazor-server', excludes: 'blazor-wasm' }]);
    assert.deepEqual(exclusions(KIT, ['blazor-wasm', 'blazor-server']), [{ pack: 'blazor-server', excludes: 'blazor-wasm' }]);
    assert.deepEqual(exclusions(KIT, ['operations', 'dotnet-shared', 'blazor-server']), []);
    assert.deepEqual(exclusions(KIT, ['bogus', 'operations']), [], 'an unknown pack is left to BR-1');
  });
});

describe('AC-6, BR-11, AC-14: the Blazor Server guideline states only what its hosting model adds, with a source per statement', () => {
  const text = () => read(KIT, ARCH_SERVER_SOURCE);
  const shared = () => read(KIT, ARCH_SHARED_SOURCE);

  test('AC-6: no BR-11 violation; the areas of § Architecture guidelines — Blazor Server that are not shared are stated', () => {
    assert.deepEqual(br11Violations(text(), appendixKeys()), []);
    const areas = new Set(statements(text()).map((cells) => cells[0]));
    for (const area of ['What runs where', 'Layers', 'Dependencies allowed', 'Dependencies forbidden', 'Project structure', 'Dependency injection', 'State', 'Data access', 'Authentication', 'Error handling', 'Controllers', 'Messaging', 'Tests']) {
      assert.ok(areas.has(area), `no ${area} statement`);
    }
  });

  test('AC-6: the first paragraph says the guideline states only what Blazor Server adds or changes to the shared architecture, and no statement repeats a shared one', () => {
    assert.match(text(), /states only what Blazor Server adds or changes/);
    const sharedStatements = new Set(statements(shared()).map((cells) => cells[1]));
    for (const cells of statements(text())) assert.ok(!sharedStatements.has(cells[1]), `repeats a shared statement: ${cells[1]}`);
  });

  test('Q5: the dependency matrix is the rule; the WFE reference to Core.Infrastructure is a known deviation and only a new one is reported', () => {
    const deps = statementText(text(), 'Dependencies allowed');
    assert.match(deps, /`Host\.Wfe` references `Presentation` and `Contracts`/);
    assert.match(deps, /known deviation/);
    assert.match(deps, /Core\.Infrastructure/);
    assert.match(deps, /new reference/);
  });

  test('Q4, AC-14: the Refit and authentication statements follow the reference solution: client credentials through AddCoreHttpServiceClient, user headers, apiVersion, ConvertApiExceptionToResult; no token read in Presentation', () => {
    const auth = statementText(text(), 'Authentication');
    for (const term of [/AddCoreOpenIdConnect/, /AddCoreOAuth/, /AddCoreHttpServiceClient/, /`X-User-\*`/, /IUserContextAccessor/, /never takes the user from `HttpContext\.User`/, /trusted subsystem/]) assert.match(auth, term);
    assert.match(auth, /Presentation never reads, stores or forwards a token/);
    const errors = statementText(text(), 'Error handling');
    assert.match(errors, /ConvertApiExceptionToResult<T>\(\)/);
    assert.match(errors, /`apiVersion`/);
  });

  test('Q9: slice-level integration tests are MSTest with [TestCategory("Integration")]; the Reqnroll scenarios are the older practice', () => {
    const tests = statementText(text(), 'Tests');
    assert.match(tests, /MSTest/);
    assert.match(tests, /\[TestCategory\("Integration"\)\]/);
    assert.match(tests, /Reqnroll[^.]*older practice/);
  });

  test('Kept apart: the Blazor Server guideline holds no Blazor WebAssembly statement', () => {
    for (const term of [/\bCfe\b/, /Host\/Wasm/, /cookie handler/i, /XSRF/, /antiforgery/i, /WasmLevel/, /credentials: include/, /WebAssembly/]) {
      assert.doesNotMatch(text(), term, `holds ${term}`);
    }
  });
});

describe('AC-16 (Blazor Server): the setup recommends blazor-server from the hosts and refuses both Blazor packs', () => {
  test('the setup skill recommends blazor-server for a Host/Web project or the Blazor Server package, says it needs dotnet-shared, and says the two Blazor packs exclude each other', () => {
    const setup = read(KIT, '.claude/skills/setup/SKILL.md');
    assert.match(setup, /for `blazor-server`: [^;]*`Host\/Web`/);
    assert.match(setup, /`blazor-server` needs `dotnet-shared`/);
    assert.match(setup, /`blazor-server` and `blazor-wasm` exclude each other/);
  });
});

const ARCH_WASM = '.claude/rules/architecture-blazor-wasm.md';
const ARCH_WASM_SOURCE = 'packs/blazor-wasm/rules/architecture-blazor-wasm.md';

describe('Guidelines slice 6: a Blazor WebAssembly team installs its architecture guideline', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('slice test: apply --packs operations,dotnet-shared,blazor-wasm installs architecture-blazor-wasm with its paths and role line, every statement with a source key of the Appendix, and records the pack; both Blazor packs in either order are refused with BR-7 and nothing is written (AC-12, AC-3)', () => {
    const dir = project();
    const run = install(kit, 'apply', dir, '--packs', 'operations,dotnet-shared,blazor-wasm');
    assert.equal(run.status, 0, run.output);
    assert.ok(existsSync(join(dir, ARCH_WASM)), `${ARCH_WASM} not installed`);
    const text = read(dir, ARCH_WASM);
    assert.deepEqual(frontmatterList(text, 'paths'), GUIDELINES['architecture-blazor-wasm'].paths, 'architecture-blazor-wasm has another path filter');
    assert.equal(guidelineRole(text), 'architecture');
    assert.deepEqual(br11Violations(text, appendixKeys()), [], 'BR-11 violated');
    assert.deepEqual(record(dir).packs, ['operations', 'dotnet-shared', 'blazor-wasm']);
    assert.ok(!existsSync(join(dir, ARCH_SERVER)), 'the Blazor Server guideline was installed too');

    for (const list of ['operations,dotnet-shared,blazor-wasm,blazor-server', 'operations,dotnet-shared,blazor-server,blazor-wasm']) {
      const both = project();
      const refused = install(kit, 'apply', both, '--packs', list);
      assert.notEqual(refused.status, 0, list);
      assert.match(refused.stderr, BR7, list);
      assert.deepEqual(tree(both), {}, `something was written for ${list}`);
    }
  });

  test('AC-3 (BR-2): --packs operations,blazor-wasm is refused with the message naming dotnet-shared, and nothing is written', () => {
    const dir = project();
    const run = install(kit, 'apply', dir, '--packs', 'operations,blazor-wasm');
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /install: pack blazor-wasm needs pack dotnet-shared; add it to --packs/);
    assert.deepEqual(tree(dir), {}, 'something was written');
  });
});

describe('§ Guideline sets: the blazor-wasm pack, BR-7 both ways, BR-12 over both Blazor packs', () => {
  test('AC-12: blazor-wasm holds architecture-blazor-wasm, needs dotnet-shared, excludes blazor-server, and its recommend names the Host/Wasm and Host/Cfe folders', () => {
    const pack = readPack(KIT, 'blazor-wasm');
    assert.deepEqual(pack.rules, ['architecture-blazor-wasm']);
    assert.deepEqual(pack.needs, ['dotnet-shared']);
    assert.deepEqual(pack.excludes, ['blazor-server']);
    assert.deepEqual([pack.agents, pack.skills], [[], []]);
    assert.match(pack.recommend, /Host\/Wasm/);
    assert.match(pack.recommend, /Host\/Cfe/);
  });

  test('BR-7: with both Blazor packs declaring the exclusion, exclusions names the pair once, in the order of the BR-7 message, whatever the list order', () => {
    const pair = [{ pack: 'blazor-server', excludes: 'blazor-wasm' }];
    assert.deepEqual(exclusions(KIT, ['operations', 'dotnet-shared', 'blazor-wasm', 'blazor-server']), pair);
    assert.deepEqual(exclusions(KIT, ['blazor-server', 'blazor-wasm']), pair);
    assert.deepEqual(exclusions(KIT, ['operations', 'dotnet-shared', 'blazor-wasm']), []);
  });

  test('BR-12 (gap of slice 4 closed): a core Guidelines paragraph naming blazor-server, blazor-wasm or either Blazor guideline file is found', () => {
    const names = forbiddenNames();
    assert.deepEqual(br12Violations('Read the rules of the blazor-wasm pack.', names).map((v) => v.name), ['blazor-wasm']);
    assert.deepEqual(br12Violations('Read the rules of the blazor-server pack.', names).map((v) => v.name), ['blazor-server']);
    assert.deepEqual(br12Violations('Follow architecture-blazor-wasm.', names).map((v) => v.name), ['architecture-blazor-wasm']);
    assert.ok(br12Violations('Read `.claude/rules/architecture-blazor-wasm.md`.', names).some((v) => v.name === 'architecture-blazor-wasm.md'));
    for (const rel of CORE_TEXTS) {
      for (const paragraph of guidelineParagraphs(read(KIT, rel))) assert.deepEqual(br12Violations(paragraph, names), [], `BR-12 violated in ${rel}`);
    }
  });
});

describe('AC-6, BR-11, AC-13: the Blazor WebAssembly guideline states only what its hosting model adds, with a source per statement', () => {
  const text = () => read(KIT, ARCH_WASM_SOURCE);
  const shared = () => read(KIT, ARCH_SHARED_SOURCE);

  test('AC-6: no BR-11 violation; the areas of § Architecture guidelines — Blazor WebAssembly are stated', () => {
    assert.deepEqual(br11Violations(text(), appendixKeys()), []);
    const areas = new Set(statements(text()).map((cells) => cells[0]));
    for (const area of ['What runs where', 'Layers', 'Dependencies allowed', 'Dependencies forbidden', 'Project structure', 'Dependency injection', 'State', 'Data access', 'Authentication', 'Error handling', 'Controllers', 'Refit', 'Messaging', 'Logging', 'Tests']) {
      assert.ok(areas.has(area), `no ${area} statement`);
    }
  });

  test('AC-6: the first paragraph says the guideline states only what Blazor WebAssembly adds or changes, and no statement repeats a shared one', () => {
    assert.match(text(), /states only what Blazor WebAssembly adds or changes/);
    const sharedStatements = new Set(statements(shared()).map((cells) => cells[1]));
    for (const cells of statements(text())) assert.ok(!sharedStatements.has(cells[1]), `repeats a shared statement: ${cells[1]}`);
  });

  test('AC-13: the browser holds no token or secret; Presentation never references Application, Persistence or a host; every state-changing action carries the antiforgery filter', () => {
    assert.match(statementText(text(), 'What runs where'), /holds no token, no connection string and no secret/);
    assert.match(statementText(text(), 'Dependencies forbidden'), /Presentation never references `Core\.Application`, Persistence or a host/);
    const auth = statementText(text(), 'Authentication');
    for (const term of [/AddCoreOpenIdConnect/, /`HttpOnly`/, /\[ApiAntiforgery\]/, /`X-XSRF-TOKEN`/, /never receives, stores or forwards a token/, /\[AllowAnonymous\]/]) assert.match(auth, term);
  });

  test('C-4: where the template and the reference solution differ, the solution as built leads: the WASM-side infrastructure project is optional, the Worker exists, the Refit clients are registered through the package', () => {
    assert.match(statementText(text(), 'Layers'), /optional/);
    assert.match(statementText(text(), 'What runs where'), /`Host\/Worker`/);
    const di = statementText(text(), 'Dependency injection');
    assert.match(di, /AddBffServiceClients\(\)/);
    assert.match(di, /AddCoreWasmRefitClient<T>\(\)/);
    assert.match(di, /`CookieHandler`/);
  });

  test('Q6: the logging statements hold the forwarding specifics; the level semantics and the personal-data ban stay in the shared guideline', () => {
    const logging = statementText(text(), 'Logging');
    for (const term of [/forwarded/, /through the Cfe/, /`WasmLevel`/, /StartClientLogForwardingAsync\(\)/, /audit trail/, /shared architecture guideline/]) assert.match(logging, term);
    for (const level of ['Information', 'Critical']) assert.doesNotMatch(logging, new RegExp(`\`${level}\``), `repeats the level semantics (${level})`);
  });

  test('Tests: Test/Integration through CustomWebApplicationFactory under the IntegrationTest environment, with the antiforgery header on a state-changing call', () => {
    const tests = statementText(text(), 'Tests');
    for (const term of [/`Test\/Integration`/, /CustomWebApplicationFactory/, /\[TestCategory\("Integration"\)\]/, /antiforgery header/, /`STUB`/]) assert.match(tests, term);
    assert.match(statementText(text(), 'Messaging'), /`IntegrationTest`/);
  });

  test('Kept apart: the WebAssembly guideline holds no Blazor Server statement, and the Blazor Server guideline none of WebAssembly', () => {
    for (const term of [/\bWFE\b/, /Host\/Web\b/, /Host\/BFF/, /SignalR circuit/, /AddCoreHttpServiceClient/, /X-User-/, /IUserContextAccessor/, /Reqnroll/, /Core\/Infrastructure/, /Blazor Server/]) {
      assert.doesNotMatch(text(), term, `holds ${term}`);
    }
    assert.doesNotMatch(read(KIT, ARCH_SERVER_SOURCE), /WebAssembly|\bCfe\b|WasmLevel/);
  });
});

describe('AC-16 (Blazor WebAssembly): the setup recommends blazor-wasm from the hosts and lists the overlapping rule copies', () => {
  test('the setup skill recommends blazor-wasm for a Host/Wasm or Host/Cfe project, says it needs dotnet-shared, and lists synced Copilot rule copies under .claude/rules/ with other names, removing nothing', () => {
    const setup = read(KIT, '.claude/skills/setup/SKILL.md');
    assert.match(setup, /for `blazor-wasm`: [^;]*`Host\/Wasm`[^;]*`Host\/Cfe`/);
    assert.match(setup, /`blazor-wasm` needs `dotnet-shared`/);
    assert.match(setup, /synced Copilot rule copies under `\.claude\/rules\/` with other names[^.]*list[^.]*remove nothing/);
  });
});
