// Tests of kit 2.5.0, "lean", to 2.6.5 (_specs/KitLean/spec.md), and of 3.0.0, the generic .NET harness. Unit: the kit's texts as data.
// Slice 1: the spec stage checks against the code and runs the critic only on request.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { KIT, RECORD, cleanup, install, kitCopy, project, record, sha, tree } from './helpers.mjs';

const read = (rel) => readFileSync(join(KIT, rel), 'utf8');
const skill = (name) => read(`.claude/skills/${name}/SKILL.md`);

/** The text of the level-2 section with the given heading, up to the next level-2 heading. */
function section(text, heading) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `## ${heading}`);
  assert.notEqual(start, -1, `no section "## ${heading}"`);
  const end = lines.findIndex((line, i) => i > start && /^## /.test(line));
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n');
}

/** The self-check of write-spec: step 1 of "Before presenting", up to step 2. */
function selfCheck() {
  const before = section(skill('write-spec'), 'Before presenting');
  const start = before.search(/^1\. /m);
  const end = before.search(/^2\. /m);
  assert.ok(start !== -1 && end > start, 'Before presenting has no numbered self-check');
  return before.slice(start, end);
}

describe('KitLean slice 1: the spec stage checks against the code and runs the critic only on request', () => {
  test('slice test (AC-1): write-spec\'s self-check holds the code-grounded checklist of BR-1', () => {
    const check = selfCheck();
    // 2.5.3 (D15): the registrations are checked in the spec's Scaffold table, not in architecture.md.
    assert.match(check, /new service or dependency[^\n]*DI registration[^\n]*Scaffold table/i, 'no point on DI registrations in the Scaffold table');
    assert.match(check, /type, route, setting or file[^\n]*exists in the code[^\n]*marked new/i, 'no point on names that exist in the code or are marked new');
    const culture = check.split(/\r?\n/).find((line) => /culture and locale/i.test(line));
    assert.ok(culture, 'no point on culture and locale');
    for (const term of [/number/i, /date/i, /separator/i, /encoding/i, /output is formatted/i]) assert.match(culture, term, `the culture point does not name ${term}`);
  });

  for (const name of ['new-feature', 'write-spec', 'amend-spec']) {
    test(`slice test (AC-2): ${name} starts spec-critic only on the user's request, for one pass, and records a missing report in Status`, () => {
      const text = skill(name);
      const critic = text.split(/\r?\n/).filter((line) => line.includes('spec-critic'));
      assert.ok(critic.length > 0, `${name} does not name spec-critic`);
      for (const line of critic) assert.match(line, /only when the user asks|on the user's request/i, `${name} starts the critic without the user's request: ${line.trim()}`);
      assert.match(text, /one pass/i, `${name} does not limit the critic to one pass`);
      assert.match(text, /no report[^\n]*Status|Status[^\n]*no report/i, `${name} does not record a missing report in Status`);
    });
  }

  test('AC-2: write-spec\'s Status line no longer says the critic always ran', () => {
    assert.doesNotMatch(skill('write-spec'), /spec written, critic run\. Not approved/);
  });
});

// Slice 2: spec and architecture scaffolding are approved together.
// 2.5.3 (D15, AC-29 replaces AC-3): the Scaffold section of the spec replaces architecture.md and its template;
// one approval of spec.md. These tests keep their place and check the Scaffold.

const ARCHITECTURE_TEMPLATE = '.claude/templates/architecture-template.md';
const RULES_FILE = '.claude/rules/spec-driven.md';
const JOINT = /approved together|together, once|joint approval|approval of both|spec and (its )?architecture/i;

describe('KitLean slice 2: spec and architecture scaffolding are approved together (2.5.3: the Scaffold in the spec, one approval)', () => {
  test('slice test (AC-3, now AC-29): the architecture template is gone; the spec template\'s Scaffold asks per slice for the files to create, modify or delete and for DI registrations and wiring, with no steps and no code', () => {
    assert.ok(!existsSync(join(KIT, ARCHITECTURE_TEMPLATE)), 'the kit still ships the architecture template');
    const scaffold = section(read('.claude/templates/spec-template.md'), 'Scaffold');
    assert.match(scaffold, /per slice/i, 'the Scaffold is not organised per slice');
    assert.match(scaffold, /^\| File \| Change \| What changes and why \|/m, 'the Scaffold has no table of files, change and why');
    assert.match(scaffold, /create, modify or delete/i, 'the Scaffold does not name create, modify or delete');
    assert.match(scaffold, /DI registrations and wiring/i, 'the Scaffold has no line for DI registrations and wiring');
    assert.match(scaffold, /no steps/i, 'the Scaffold does not forbid steps');
    assert.match(scaffold, /no code/i, 'the Scaffold does not forbid code');
    assert.doesNotMatch(scaffold, /```/, 'the Scaffold has a code block');
  });

  test('slice test (AC-3, now AC-29): write-spec writes the Scaffold and asks for one approval of the spec', () => {
    const text = skill('write-spec');
    assert.match(section(text, 'Writing'), /^### The Scaffold/m, 'write-spec does not write the Scaffold');
    const before = section(text, 'Before presenting');
    assert.match(before, /Scaffold/, 'Before presenting does not present the Scaffold');
    assert.match(before, /one approval of the spec/i, 'write-spec does not ask for one approval of the spec');
    assert.match(before, /spec approved by the user/, 'write-spec does not record "spec approved by the user" in Status');
    assert.doesNotMatch(text, JOINT, 'write-spec still asks a joint approval of spec and architecture');
    assert.doesNotMatch(text, /only planning document/i, 'write-spec still calls the spec the only planning document');
  });

  test('slice test (AC-3, now AC-29): amend-spec updates the Scaffold with the spec and asks for one approval', () => {
    const text = skill('amend-spec');
    assert.match(text, /Scaffold/, 'amend-spec does not update the Scaffold');
    assert.match(text, /one approval/i, 'amend-spec does not ask for one approval');
    assert.doesNotMatch(text, JOINT, 'amend-spec still approves spec and architecture together');
  });

  test('slice test (AC-3, now AC-29): the rules name the Scaffold and one approval of the spec, and list no architecture template', () => {
    const rules = read(RULES_FILE);
    assert.doesNotMatch(rules, /only planning document/i, 'the rules still say the spec is the only planning document');
    assert.match(rules, /Scaffold/, 'the rules do not name the Scaffold');
    assert.match(rules, /one approval/i, 'the rules do not approve the spec once');
    assert.doesNotMatch(rules, JOINT, 'the rules still approve spec and architecture together');
    const tooling = section(rules, 'Tooling');
    // 2.5.7 (BR-40, AC-43): the slice-plan template is gone; the rules list the spec and recap templates.
    // 2.6.0 (BR-61, AC-63): the recap template is gone too; the rules list the spec template only.
    assert.match(tooling, /`\.claude\/templates\/spec-template\.md`/, 'the rules do not list spec-template');
    assert.doesNotMatch(tooling, /slice-recap-template/, 'the rules still list the slice-recap template');
    assert.doesNotMatch(tooling, /slice-plan-template/, 'the rules still list the slice-plan template');
    assert.doesNotMatch(tooling, /architecture-template/, 'the rules still list the architecture template');
  });

  test('AC-2 (aligned with slice 1): the rules start spec-critic only on the user\'s request, for one pass', () => {
    const rules = read(RULES_FILE);
    const critic = rules.split(/\r?\n/).filter((line) => line.includes('spec-critic'));
    assert.ok(critic.length > 0, 'the rules do not name spec-critic');
    for (const line of critic) {
      assert.match(line, /only when the user asks|on the user's request/i, `the rules start the critic without the user's request: ${line.trim()}`);
      assert.match(line, /one pass/i, `the rules do not limit the critic to one pass: ${line.trim()}`);
    }
  });
});

// Slice 3: a build session starts a slice on the owner's go, plans it and builds it outer test first.

const SLICE_PLAN_TEMPLATE = '.claude/templates/slice-plan-template.md';
const SPEC_TEMPLATE = '.claude/templates/spec-template.md';
const SETTINGS_TEMPLATE = '.claude/templates/project-settings.md';

/** Index of the first match of each pattern in text, asserting each is found. */
function positions(text, patterns) {
  return patterns.map((pattern) => {
    const at = text.search(pattern);
    assert.notEqual(at, -1, `not found: ${pattern}`);
    return at;
  });
}

describe('KitLean slice 3: a build session starts a slice on the owner\'s go, plans it and builds it outer test first', () => {
  // 2.6.0 (BR-58, AC-61): build-slice is at most 45 lines without sections for the go, the todo list or the build loop;
  // the go before every slice stays in the rules (spec phase), build-slice builds only the slice the user gave the go for.
  test('slice test (AC-4, 2.6.0: AC-61): build-slice builds only the slice the user gave the go for and stops for the go on the next; the rules keep the go before every slice', () => {
    const text = skill('build-slice');
    assert.match(text, /approved slice[^\n]*the user gave the go for/i, 'build-slice does not build only the slice the user gave the go for');
    assert.match(text, /stop: the user checks the slice and gives the go for the next/i, 'build-slice may start the next slice by itself');
    assert.doesNotMatch(text, /For the others, continue/, 'build-slice still continues without a go on a slice not marked ⚠️');
    assert.match(section(read(RULES_FILE), 'Slices'), /every slice, ⚠️ or not, starts only on the user's go/i, 'the rules do not wait for the go on every slice');
  });

  // 2.5.7 (BR-40, AC-43): the slice plan's ordered steps live in the session's todo list; no plan file, no template.
  // 2.6.0 (BR-58, AC-61): no todo-list step either; build-slice works from the Scaffold rows and writes no slice plan file.
  test('slice test (AC-4, now AC-43, 2.6.0: AC-61): build-slice builds from the slice\'s Scaffold rows, writes no slice plan file and waits for no approval of steps', () => {
    const text = skill('build-slice');
    assert.match(text, /using its Scaffold rows/, 'build-slice does not build from the Scaffold rows');
    assert.match(text, /no slice plan file/i, 'build-slice may write a plan file');
    assert.doesNotMatch(text, /wait[^\n]*approv/i, 'build-slice waits for an approval of steps');
    const [go, scaffold, test1] = positions(text, [/the user gave the go for/i, /Scaffold rows/, /^## Test-driven/m]);
    assert.ok(go < test1 && scaffold < test1, 'the go and the Scaffold rows do not come before the build');
  });

  test('slice test (AC-4, now AC-43, 2.6.0: AC-61): build-slice puts the integration test before the unit tests; the kit ships no slice-plan template', () => {
    assert.ok(!existsSync(join(KIT, SLICE_PLAN_TEMPLATE)), 'the kit still ships the slice-plan template');
    const text = section(skill('build-slice'), 'Test-driven without exception');
    const [outer, unit] = positions(text, [/Integration test first/i, /unit test/i]);
    assert.ok(outer < unit, 'the integration test does not come before the unit tests');
    assert.match(skill('build-slice'), /guidelines apply to every line/i, 'build-slice does not apply the guidelines (the pack rules among them) to every line');
    assert.doesNotMatch(skill('build-slice'), /```/, 'build-slice has a code block');
  });

  test('slice test (AC-4, now AC-43, 2.6.0: AC-62): the rules say every slice, ⚠️ or not, starts only on the user\'s go and a build session never starts the next slice by itself; how a slice is built is build-slice\'s', () => {
    const rules = read(RULES_FILE);
    const stops = section(rules, 'Where Claude stops');
    assert.match(stops, /every slice, ⚠️ or not[^\n]*go/i, 'the rules do not stop before every slice for the go');
    assert.doesNotMatch(stops, /before building a slice marked ⚠️/, 'the rules still stop only before a slice marked ⚠️');
    assert.match(rules, /never starts the next slice by itself/i, 'the rules let a build session start the next slice by itself');
    assert.match(rules, /How a slice is built is `build-slice`'s/, 'the rules do not leave the build to build-slice');
    assert.doesNotMatch(rules, /todo list/i, 'the rules still carry the build\'s todo list');
    assert.doesNotMatch(rules, /`slice-<n>-plan\.md`/, 'the rules still name the slice plan file');
    assert.doesNotMatch(section(rules, 'Tooling'), /slice-plan-template/, 'the rules still list the slice-plan template');
  });

  test('slice test (AC-5, 2.6.0: AC-61): build-slice orders the integration test seen failing for the right reason, then unit red, green, refactor until the integration test is green', () => {
    const building = section(skill('build-slice'), 'Test-driven without exception');
    const [outer, failing, red, green, refactor, done] = positions(building, [
      /Integration test first/i, /seen failing for the right reason: the behavior is missing/i, /unit test seen failing/i, /smallest code to pass/i, /\brefactor\b/i, /until the integration test is green/i,
    ]);
    assert.ok(outer < failing && failing < red && red < green && green < refactor, 'the steps are not in the order integration test seen failing, red, green, refactor');
    assert.ok(refactor < done, 'red, green, refactor is not repeated until the integration test is green');
    assert.match(building, /Integration test project/, 'build-slice does not put the integration test in the Integration test project');
    assert.match(building, /not the harness or the setup/i, 'build-slice does not reject a failure of the harness or the setup');
    assert.doesNotMatch(skill('build-slice'), /slice test/i, 'build-slice still names the slice test');
  });

  test('slice test (AC-5): the Project settings template has an "Outer test" line with a page or component example and an API example', () => {
    const line = read(SETTINGS_TEMPLATE).split(/\r?\n/).find((l) => l.startsWith('- **Outer test**'));
    assert.ok(line, 'no "Outer test" line under Test levels');
    assert.match(line, /page|component/i, 'the Outer test line has no page or component example');
    assert.match(line, /\bAPI\b/, 'the Outer test line has no API example');
  });

  test('slice test (AC-5): the spec template\'s slices table has an "Outer test" column and no "Slice test" column', () => {
    const template = read(SPEC_TEMPLATE);
    const header = section(template, 'Slices').split(/\r?\n/).find((l) => l.startsWith('| # |'));
    assert.ok(header, 'the Slices section has no table');
    assert.match(header, /\| Outer test \|/, 'no "Outer test" column');
    assert.doesNotMatch(template, /slice test/i, 'the spec template still names a slice test');
  });

  test('AC-5: the rules and write-spec name the outer test, not the slice test', () => {
    assert.doesNotMatch(read(RULES_FILE), /slice test/i, 'the rules still name the slice test');
    assert.match(read(RULES_FILE), /outer test/i, 'the rules do not name the outer test');
    assert.doesNotMatch(skill('write-spec'), /slice test/i, 'write-spec still names the slice test');
  });

  test('AC-3 (now AC-29), AC-4: new-feature says write-spec produces spec.md with its Scaffold for one approval, and each slice starts only on the user\'s go', () => {
    const text = skill('new-feature');
    assert.match(text, /`spec\.md`[^\n]*Scaffold[^\n]*one approval/i, 'new-feature does not name spec.md with its Scaffold and one approval');
    assert.doesNotMatch(text, JOINT, 'new-feature still asks a joint approval of spec and architecture');
    assert.match(text, /each slice[^\n]*only on the user's go|only on the user's go[^\n]*each slice/i, 'new-feature does not start each slice only on the user\'s go');
  });
});

// Slice 4: a build session ends verified with an AC-to-test recap, stops for the owner's check and commits only on request.

const RECAP_TEMPLATE = '.claude/templates/slice-recap-template.md';

/** The text without the level-2 section with the given heading, when it is there. */
function without(text, heading) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `## ${heading}`);
  if (start === -1) return text;
  const end = lines.findIndex((line, i) => i > start && /^## /.test(line));
  return [...lines.slice(0, start), ...(end === -1 ? [] : lines.slice(end))].join('\n');
}

/** Every kit text a user or Claude reads: the rules, the skills, the agents, the templates and the README. */
function kitTexts() {
  const files = ['README.md', RULES_FILE];
  for (const [folder, pick] of [['.claude/skills', (name) => `${name}/SKILL.md`], ['.claude/agents', (name) => name], ['.claude/templates', (name) => name]]) {
    for (const entry of readdirSync(join(KIT, folder), { withFileTypes: true })) {
      if (folder === '.claude/skills' ? entry.isDirectory() : entry.name.endsWith('.md')) files.push(`${folder}/${pick(entry.name)}`);
    }
  }
  return files;
}

describe('KitLean slice 4: a build session ends verified with an AC-to-test recap, stops for the owner\'s check and commits only on request', () => {
  // 2.6.0 (BR-58, BR-61, AC-61, AC-63): no recap file and no recap template; the record is the build's final answer,
  // after the slice gate: per criterion its test and the failure seen when it was red, what differs, how to try it.
  test('slice test (AC-6, 2.6.0: AC-61): build-slice ends with the slice gate green, then the record: every acceptance criterion against its test, how the user tries it, then stop', () => {
    const text = skill('build-slice');
    const [gate, table, tryIt, stop] = positions(text, [
      /`node \.claude\/hooks\/verify\.mjs --slice[^\n]*until it is green/i, /one line per acceptance criterion: the test that proves it/i, /how the user tries it/i, /Then stop/,
    ]);
    assert.ok(gate < table && table < tryIt && tryIt < stop, 'the end is not in the order gate green, criteria against tests, how to try it, stop');
    assert.match(text, /Quote its last line/i, 'build-slice does not quote the gate\'s verdict');
    assert.doesNotMatch(text, /verifier/i, 'build-slice still carries a verifier\'s verdict');
  });

  test('slice test (AC-6, 2.6.0: AC-63): the kit ships no recap template; the record lists every criterion with its test and the failure seen red, no Verifier and no Proof rows', () => {
    assert.ok(!existsSync(join(KIT, RECAP_TEMPLATE)), 'the kit still ships the recap template');
    const record = section(skill('build-slice'), 'The record is the final answer');
    assert.match(record, /one line per acceptance criterion: the test that proves it and the failure message seen when that test was red/i, 'the record does not tie each criterion to its test');
    assert.match(record, /how the user tries it: the steps/i, 'the record has no Try-it steps');
    assert.doesNotMatch(record, /verifier|Proof/i, 'the record still has a Verifier or Proof row');
    assert.doesNotMatch(record, /slice test/i, 'the record still names the slice test');
  });

  // 2.6.4 (D22, BR-81): the mechanical mutation check (Stryker.NET) is the slice's proof; deliberate breaks by hand stay out.
  test('slice test (AC-6, 2.6.4: AC-85): build-slice\'s own build has no deliberate breaks', () => {
    const own = without(skill('build-slice'), 'Independent checks');
    assert.doesNotMatch(own, /on purpose|deliberate|assert(ing)? the opposite/i, 'build-slice still breaks the behavior on purpose');
    // 2.6.0 (AC-63): the recap template is gone; no installed template asks for deliberate breaks.
    for (const name of readdirSync(join(KIT, '.claude/templates'))) {
      assert.doesNotMatch(read(`.claude/templates/${name}`), /on purpose|deliberate/i, `${name} asks for deliberate breaks`);
    }
  });

  test('slice test (AC-7): the rules and build-slice say the user checks each slice and accepts it', () => {
    assert.match(section(read(RULES_FILE), 'Where Claude stops'), /user checks (the|each) slice and accepts it/i, 'the rules do not stop for the user\'s check and acceptance');
    assert.match(section(read(RULES_FILE), 'Commit and push'), /user checks (the|each) slice and accepts it/i, 'the rules do not say the user accepts the slice');
    // 2.6.0 (AC-61): build-slice stops for the user's check; the acceptance is the rules' and new-feature's.
    assert.match(skill('build-slice'), /stop: the user checks the slice/i, 'build-slice does not leave the check to the user');
    assert.match(skill('new-feature'), /accepts it/i, 'new-feature does not leave the acceptance to the user');
  });

  test('slice test (AC-7): build-slice does not run the human check itself and does not mark a slice accepted', () => {
    const text = skill('build-slice');
    assert.doesNotMatch(text, /run the human check yourself/i, 'build-slice still runs the human check itself');
    // 2.6.0 (AC-61): the human check is the user's (how the user tries it); build-slice makes no spec edits, so it cannot mark a slice.
    assert.match(text, /how the user tries it/i, 'build-slice does not hand the human check to the user');
    assert.match(text, /no spec edits/i, 'build-slice may edit the spec, and so mark a slice accepted');
    assert.doesNotMatch(text, /"accepted"|"built"/, 'build-slice sets a slice state');
    assert.match(section(read(RULES_FILE), 'Where Claude stops'), /does not run the human check in the user's place and does not mark a slice accepted/i, 'the rules let Claude run the human check or accept a slice');
    assert.doesNotMatch(read(SPEC_TEMPLATE), /accepted \(committed\)/, 'the spec template still ties the accepted state to a commit');
  });

  test('slice test (AC-8): the rules and build-slice commit only on the user\'s request and otherwise report the work as uncommitted', () => {
    const rules = section(read(RULES_FILE), 'Commit and push');
    assert.match(rules, /only when the user (explicitly )?asks/i, 'the rules do not commit only on request');
    assert.match(rules, /uncommitted/i, 'the rules do not say the work stays uncommitted otherwise');
    // 2.6.0 (AC-61): build-slice's last line; reporting uncommitted work is the rules' Commit and push.
    assert.match(skill('build-slice'), /commit only when the user asks/i, 'build-slice does not commit only on request');
    assert.match(rules, /uncommitted[^\n]*Claude says so/i, 'the rules do not report the work as uncommitted');
  });

  test('slice test (AC-8): no kit text mentions batch mode', () => {
    for (const rel of kitTexts()) assert.doesNotMatch(read(rel), /batch mode/i, `${rel} still mentions batch mode`);
  });
});

// Slice 5: the final review runs spec-reviewer and security-review once; slice-verifier is gone.

const VERIFIER = '.claude/agents/slice-verifier.md';
// 2.5.3 (D15, AC-29): only the slice-plan template was new; the architecture template is no longer installed.
// 2.5.7 (BR-40, AC-43): the slice-plan template is gone too, so an update from 2.1.0 adds no template.
const RETIRED_TEMPLATES = ['.claude/templates/slice-plan-template.md', '.claude/templates/architecture-template.md'];

/** The lines of text that name the security-review skill. */
const securityLines = (text) => text.split(/\r?\n/).filter((line) => line.includes('security-review'));

describe('KitLean slice 5: the final review runs spec-reviewer and security-review once; slice-verifier is gone', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('slice test (AC-10): an update from 2.1.0 removes slice-verifier.md, touches no other agent file and installs neither the architecture template (2.5.3) nor the slice-plan template (2.5.7)', () => {
    const dir = project('project-2.1.0');
    assert.ok(existsSync(join(dir, VERIFIER)), 'the 2.1.0 fixture has slice-verifier.md');
    const agentsBefore = readdirSync(join(dir, '.claude/agents')).sort();
    const before = tree(dir);
    const run = install(kit, 'apply', dir);
    assert.equal(run.status, 0, run.output);
    assert.ok(!existsSync(join(dir, VERIFIER)), 'slice-verifier.md is still in the project');
    assert.match(run.stdout, /^remove\s+\.claude\/agents\/slice-verifier\.md/m, 'the output does not report slice-verifier.md as removed');
    assert.ok(!(VERIFIER in record(dir).files), 'slice-verifier.md is still recorded');
    assert.deepEqual(readdirSync(join(dir, '.claude/agents')).sort(), agentsBefore.filter((name) => name !== 'slice-verifier.md'), 'another agent file was added or removed');
    const after = tree(dir);
    // 2.6.0 (BR-61, AC-63): the unchanged recap template of 2.1.0 goes too.
    assert.deepEqual(Object.keys(before).filter((p) => !(p in after)).sort(), [RECAP_TEMPLATE, VERIFIER].sort(), 'files removed by the update');
    for (const rel of RETIRED_TEMPLATES) assert.ok(!(rel in after), `the update installed ${rel}`);
    assert.deepEqual(Object.keys(after).filter((p) => !(p in before)), [], 'the update added a file');
  });

  test('AC-10: the kit ships no slice-verifier agent and no kit text names slice-verifier', () => {
    assert.ok(!existsSync(join(KIT, VERIFIER)), 'the kit still has slice-verifier.md');
    for (const rel of [...kitTexts(), '.claude-plugin/plugin.json', '.gitignore']) {
      assert.doesNotMatch(read(rel), /slice-verifier/, `${rel} still names slice-verifier`);
    }
  });

  // 2.6.0 (BR-60, AC-62): the final review moved from build-slice to new-feature's Review step.
  test('slice test (AC-9, 2.6.0: AC-62): new-feature starts security-review once, in the final review with spec-reviewer, over the whole diff, when a slice is ⚠️, and never per slice; build-slice runs none', () => {
    const text = skill('build-slice');
    const final = step(section(skill('new-feature'), 'Workflow'), 'Review');
    assert.match(final, /`spec-reviewer`/, 'the final review does not start spec-reviewer');
    assert.match(final, /`security-review`/, 'the final review does not run security-review');
    const line = securityLines(final).join('\n');
    assert.match(line, /once/i, 'security-review is not run once');
    assert.match(line, /whole diff/i, 'security-review does not run over the whole diff');
    assert.match(line, /⚠️/, 'security-review is not tied to a ⚠️ slice');
    assert.match(line, /never per slice/i, 'new-feature does not say security-review never runs per slice');
    assert.deepEqual(securityLines(text), [], 'build-slice runs security-review');
    assert.doesNotMatch(text, /^## Independent checks/m, 'build-slice still has its per-slice independent checks');
  });

  test('slice test (AC-9): the rules start security-review once in the final review with spec-reviewer over the whole diff when a slice is ⚠️, and never per slice', () => {
    const rules = read(RULES_FILE);
    const lines = securityLines(rules);
    assert.ok(lines.length > 0, 'the rules do not name security-review');
    for (const line of lines) {
      assert.match(line, /`spec-reviewer`/, `security-review is not run with spec-reviewer: ${line.trim()}`);
      assert.match(line, /once/i, `security-review is not run once: ${line.trim()}`);
    }
    const review = rules.split(/\r?\n/).find((line) => line.startsWith('| 6. Review'));
    assert.ok(review, 'the rules have no Review phase');
    assert.match(review, /`security-review`/, 'the Review phase does not run security-review');
    assert.match(review, /whole diff|full diff/i, 'the Review phase is not over the whole diff');
    assert.match(review, /⚠️/, 'the Review phase does not tie security-review to a ⚠️ slice');
    assert.match(review, /never per slice/i, 'the rules do not say security-review never runs per slice');
  });

  test('AC-9: the per-slice record holds no security review (2.5.3, AC-32: security-review only in the final review)', () => {
    // 2.5.7 (BR-42): the recap template has no Proof section any more; no part of it holds a security review.
    // 2.6.0 (AC-63): the recap template is gone; build-slice's record is what a slice reports.
    assert.ok(!existsSync(join(KIT, RECAP_TEMPLATE)), 'the kit still ships the recap template');
    const record = section(skill('build-slice'), 'The record is the final answer');
    assert.doesNotMatch(record, /security review|security-review/i, 'the record has a per-slice security review');
  });
});

// Slice 6: the kit ships as 2.5.0 without turn budgets, gate and guard untouched.

// The kit's current version: 2.5.0 from slice 6, moved to 2.5.1 by slice 8, to 2.5.2 by slice 9, to 2.5.3 by slice 11
// to 2.5.4 by slice 12, to 2.5.5 by slice 13, to 2.5.6 by slice 14, to 2.5.7 by slice 15, to 2.5.8 by slice 16, to 2.5.9 by slice 17, to 2.5.10 by slice 18, to 2.5.11 by slice 19, to 2.6.0 by slice 20, to 2.6.1 by slice 21, to 2.6.2 by slice 22, to 2.6.3 by slice 23, to 2.6.4 by slice 24 and to 2.6.5 by slice 25 (as the installer, guidelines and unattended tests move).
const VERSION = '3.0.0'; // 3.0.0: the generic .NET harness
/** 3.0.0: the server-based analysis the kit no longer ships, spelled in parts so that a grep of the kit for its name stays clean. */
const SERVER_ANALYSIS = new RegExp(['So', 'nar'].join(''), 'i');
/**
 * sha (CRLF read as LF, as tree() does) of the files at c9feecb, the 2.4.0 kit this spec starts from.
 * D13 (amended AC-12): hooks/verify.mjs left this list; what changed in it is checked by AC-24 (slice 10).
 * 2.5.3 (AC-33): guard.mjs equals this hash once its removed slice-verifier entry is put back; the guard tests
 * lost their slice-verifier assertions with it, and are pinned at their 2.5.3 content.
 */
const AT_C9FEECB = {
  'hooks/guard.mjs': 'b57ebff499899a1ff91553de3fc707e3dc8a4f1dcd669f60e7b7740b2caccb09',
};
const GUARD_ENTRY_253 = "const REVIEW_AGENTS = ['spec-critic', 'spec-reviewer'];";
const GUARD_ENTRY_C9FEECB = "const REVIEW_AGENTS = ['spec-critic', 'slice-verifier', 'spec-reviewer'];";
const GUARD_TESTS_253 = { 'tests/guard.test.mjs': 'd51678679f533a6941a666d8609665be19f3e507bfc9ea5e21040aef551e3497' };

describe('KitLean slice 6: the kit ships as 2.5.0 without turn budgets, gate and guard untouched', () => {
  test('slice test (AC-11): no kit text states a turn budget, a turn limit or turn counting, nor a break marker or check-slice', () => {
    const banned = /turn[- ]?budget|turn[- ]?limit|turn[- ]?count|counting turns|max(imum)?[- ]turns|turns? (left|remaining|used)|break[- ]marker|check-slice/i;
    for (const rel of kitTexts()) assert.doesNotMatch(read(rel), banned, `${rel} states a turn budget, a break marker or check-slice`);
  });

  // 2.6.1 (D19, BR-63, BR-68, AC-71): guard.mjs gains the state-file refusal and loses the word recap, so the c9feecb
  // hash no longer holds; the guard is pinned at 2.6.1 (HOOKS_PINNED) and its earlier decisions by the unchanged guard tests.
  test('slice test (AC-12, amended with D13, by AC-33 in 2.5.3 and by AC-71 in 2.6.1): guard.mjs lists only the two review agents; the guard tests are pinned', () => {
    const guard = read('hooks/guard.mjs');
    assert.ok(guard.includes(GUARD_ENTRY_253), 'guard.mjs does not list spec-critic and spec-reviewer as its only review agents');
    assert.doesNotMatch(guard, /slice-verifier/, 'guard.mjs still names slice-verifier');
    assert.ok(AT_C9FEECB['hooks/guard.mjs'] && GUARD_ENTRY_C9FEECB, 'the c9feecb pin is kept as history');
    for (const [rel, hash] of Object.entries(GUARD_TESTS_253)) assert.equal(sha(read(rel)), hash, `${rel} changed`);
  });

  test('slice test (AC-13): the rules file comment and plugin.json carry the kit\'s version (2.5.0, now 2.5.1)', () => {
    assert.equal(read(RULES_FILE).split(/\r?\n/)[0], `<!-- spec-driven-kit ${VERSION} -->`, `the rules file is not ${VERSION}`);
    assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, VERSION, `plugin.json is not ${VERSION}`);
  });

  test('slice test (AC-13): CHANGELOG.md has a 2.5.0 entry, above 2.4.0, saying what changed', () => {
    const changelog = read('CHANGELOG.md');
    const [lean, unattended] = positions(changelog, [/^## 2\.5\.0 /m, /^## 2\.4\.0 /m]);
    assert.ok(lean < unattended, 'the 2.5.0 entry is not the newest');
    const entry = changelog.slice(lean, unattended);
    for (const term of [/architecture\.md`/, /together, once|one (joint )?approval/i, /slice-<n>-plan\.md`/, /go/i, /outer test/i, /red, green, refactor/i,
      /AC-to-test table/i, /accepts?/i, /only when the user asks|on request/i, /batch mode/i, /`spec-critic`[^\n]*only when the user asks|only when the user asks[^\n]*`spec-critic`/i,
      /`security-review`[^\n]*once/i, /`slice-verifier`[^\n]*(retired|removed)|(retired|removed)[^\n]*`slice-verifier`/i, /`verify\.mjs`[^\n]*`guard\.mjs`[^\n]*unchanged/i]) {
      assert.match(entry, term, `the 2.5.0 entry does not say ${term}`);
    }
  });

  test('slice test (AC-13): the README describes the 2.5.0 process', () => {
    const readme = read('README.md');
    const workflow = section(readme, 'The workflow');
    // 2.5.3 (D15): spec.md with its Scaffold, one approval (was spec.md and architecture.md, approved together).
    for (const term of [/`spec\.md`[^\n]*Scaffold/, /one approval/i, /`spec-critic`[^\n]*only when the user asks/i,
      // 2.5.7 (BR-40): the todo list, not `slice-<n>-plan.md`. 2.6.0 (BR-58): the Scaffold rows, no slice plan file, the
      // integration test first, unit tests seen failing, the record with each criterion's test and its red failure.
      /every slice, ⚠️ or not[^\n]*go|go for (each|every) slice/i, /never starts the next slice by itself/i, /Scaffold rows/i, /no slice plan file/i,
      /integration test first/i, /unit test seen failing, the smallest code to pass, refactor/i, /`node \.claude\/hooks\/verify\.mjs`|gate green/i, /one line per acceptance criterion with the test/i, /how the user tries it/i,
      /user checks (the|each) slice and accepts it/i, /commits? only when the user asks/i, /uncommitted/i,
      /`spec-reviewer`/, /`security-review`[^\n]*once[^\n]*whole diff|`security-review`[^\n]*whole diff[^\n]*once/i, /never per slice/i]) {
      assert.match(workflow, term, `The workflow does not say ${term}`);
    }
    const [plan, outer, gate, check, review] = positions(workflow, [/Scaffold rows/i, /integration test first/i, /one line per acceptance criterion/i, /user checks (the|each) slice and accepts it/i, /`spec-reviewer`/]);
    assert.ok(plan < outer && outer < gate && gate < check && check < review, 'The workflow is not in the order Scaffold rows, integration test, verification, the user\'s check, final review');
  });

  test('AC-13: the README no longer describes the 2.4.0 process', () => {
    const readme = read('README.md');
    assert.doesNotMatch(readme, /only planning document/i, 'the README still calls the spec the only planning document');
    assert.doesNotMatch(readme, /slice test/i, 'the README still names the slice test');
    assert.doesNotMatch(readme, /tries to break|break each slice/i, 'the README still has a second agent break each slice');
    assert.doesNotMatch(readme, /plan files are no longer used|^- \*\*No plan file\.\*\*/im, 'the README still forbids every plan file');
    assert.doesNotMatch(readme, /a critic without context reads it first/i, 'the README still runs the critic on every spec');
    assert.match(readme, /Scaffold/);
  });
});

// Slice 8: kit 2.5.1 (amended 2026-11-23 on the owner's request, after the 2.5.0 benchmark build).

const NO_BREAK = /never modifies, comments out or breaks production code to see a test fail/i;
const RED_ONLY = /seen failing only before the behavior exists/i;
const PROOF_ORDER = /tests written first and seen red[^\n]*gate green[^\n]*AC-to-test table/i;
const NO_LOOP = /no[^\n]*loops?[^\n]*catch|no[^\n]*catch[^\n]*loops?/i;
const STOP_AT_TABLE = /once the gate is green and the table is written[^\n]*recap[^\n]*stop/i;

// 2.5.3 (D14, AC-28): a slice is one increment the user can test; its size is no count of criteria.
const INCREMENT = /one increment the user can test[^\n]*a functionality or an API call/i;
const SIZE = /size follows from that, not from a count of criteria/i;
// 2.5.7 (BR-40): the steps live in each slice's todo list (was: plan).
const PLAN_STEPS = /fine-grained steps live in each slice's todo list/i;
const SAME_SLICE = /security or personal-data criterion goes in the same slice as the functionality it protects/i;
const COUNTED = /1 to 3 acceptance criteria|3 to 5 acceptance criteria|as fine as the steps of a plan|more than 3|more than 5|safety is never a reason for a bigger slice|safe order|before the first slice that exposes/i;
// 2.5.3 (D17, AC-31): at least one integration test of the slice's behavior, and only the unit tests the change needs.
const AT_LEAST = /at least one integration test that tests the behavior of the slice/i;
const UNIT_NEEDS = /only the unit tests the change needs[^\n]*new logic[^\n]*each rule the spec names/i;
const DATA_ROWS = /data-row cases count as tests/i;
const NO_HELPER = /no tests of helper edge cases that no criterion or named rule asks for/i;
const ONE_PER_AC = /one outer test per acceptance criterion/i;

describe('KitLean slice 8: kit 2.5.1, the build stops at the gate and the table, slices of 3 to 5 ACs, one outer test per AC', () => {
  // 2.6.0 (BR-58, AC-61): the proof is the record (each criterion's test with the failure seen when it was red), the gate
  // green, and the stop with no reviewing agent per slice; build-slice has no Building or Recap and stop sections.
  test('outer test (AC-15, 2.6.0: AC-61): build-slice never breaks production code to see a test fail and stops once the gate is green and the record is given', () => {
    const text = skill('build-slice');
    for (const term of [NO_BREAK, RED_ONLY, /failure message seen when that test was red/i, /no reviewing agent per slice/i]) assert.match(text, term, `build-slice does not say ${term}`);
    assert.match(section(text, 'Test-driven without exception'), NO_BREAK, 'the test-driven section does not forbid breaking production code');
    const [gate, record, stop] = positions(text, [/until it is green/i, /^## The record is the final answer/m, /Then stop/]);
    assert.ok(gate < record && record < stop, 'build-slice does not stop once the gate is green and the record is given');
  });

  // 2.6.0 (BR-59, AC-62): the rules carry no build-phase paragraph; the no-break rule is build-slice's alone.
  test('AC-15 (2.6.0: AC-62): the rules leave the no-break rule to build-slice: no Proof section, no build-phase wording', () => {
    const rules = read(RULES_FILE);
    const build = rules.split(/\r?\n/).find((line) => line.startsWith('| 4. Build'));
    assert.ok(build, 'the rules have no Build phase');
    assert.match(build, /`build-slice`/, 'the Build phase does not name build-slice');
    assert.doesNotMatch(rules, /^## Proof/m, 'the rules still have the build\'s Proof section');
    for (const term of [NO_BREAK, RED_ONLY, PROOF_ORDER, /no mutation checks/i, /no deliberate breaks/i, NO_LOOP, STOP_AT_TABLE]) {
      assert.doesNotMatch(rules, term, `the rules still say ${term}`);
    }
  });

  // 2.5.7 (BR-40, AC-43): the slice-plan template is gone; build-slice's todo-list step carries its no-break line, in
  // the words the AC-6 test allows in build-slice (no "mutation"). 2.6.0 (AC-61): no todo-list step; the line stands alone.
  test('AC-15: build-slice says the build never breaks production code to see a test fail', () => {
    const text = skill('build-slice');
    assert.doesNotMatch(text, /todo list/i, 'build-slice still has a todo-list step');
    assert.match(text, NO_BREAK, 'build-slice does not forbid breaking production code');
    assert.match(text, RED_ONLY, 'build-slice does not see a test fail only before the behavior exists');
  });

  // AC-16 (3 to 5) was superseded by AC-19 (1 to 3, 2.5.2), and AC-19 by AC-28 (2.5.3, D14): these tests keep their
  // place and check that a slice is one user-testable increment whose size is no count of criteria.
  test('outer test (AC-16, now AC-28): write-spec cuts a slice as one increment the user can test, its size not a count of criteria', () => {
    const cutting = skill('write-spec').split('### Cutting the slices')[1] ?? '';
    // 2.6.1 (BR-68, AC-70): no todo list; the build works from the slice's Scaffold rows (PLAN_STEPS is gone).
    for (const term of [INCREMENT, SIZE, /`build-slice` builds it from the slice's Scaffold rows/]) assert.match(cutting, term, `write-spec's Cutting the slices does not say ${term}`);
    assert.doesNotMatch(cutting, PLAN_STEPS, 'write-spec still names the todo list');
    assert.match(selfCheck(), INCREMENT, 'the self-check has no point on the slice as a user-testable increment');
    assert.doesNotMatch(skill('write-spec'), COUNTED, 'write-spec still sizes a slice by a count of criteria');
  });

  test('AC-16, now AC-28: the spec template cuts a slice as one increment the user can test, its size not a count of criteria', () => {
    const slices = section(read(SPEC_TEMPLATE), 'Slices');
    // 2.6.1 (BR-68, AC-70): no todo list; build-slice builds the slice from its Scaffold rows (PLAN_STEPS is gone).
    for (const term of [INCREMENT, SIZE, /`build-slice` builds it from the slice's Scaffold rows/]) assert.match(slices, term, `the spec template's Slices does not say ${term}`);
    assert.doesNotMatch(slices, PLAN_STEPS, 'the spec template still names the todo list');
    assert.doesNotMatch(read(SPEC_TEMPLATE), COUNTED, 'the spec template still sizes a slice by a count of criteria');
  });

  // AC-17 (one outer test per AC) is replaced by AC-31 (2.5.3, D17): these tests keep their place and check D17.
  // 2.6.0 (BR-58, AC-61): the slice's integration test of its behavior, and a unit test for each rule or calculation.
  test('outer test (AC-17, now AC-31, 2.6.0: AC-61): build-slice asks the slice\'s integration test of its behavior and a unit test for each rule or calculation', () => {
    const building = section(skill('build-slice'), 'Test-driven without exception');
    for (const term of [/the slice's integration test of its behavior/i, /for each rule or calculation, a unit test/i]) assert.match(building, term, `build-slice does not say ${term}`);
    assert.doesNotMatch(skill('build-slice'), ONE_PER_AC, 'build-slice still asks one outer test per acceptance criterion');
  });

  test('AC-17, now AC-31: the Project settings template asks at least one integration test of the slice\'s behavior and only the unit tests the change needs', () => {
    const text = read(SETTINGS_TEMPLATE);
    const lines = text.split(/\r?\n/);
    const outer = lines.find((l) => l.startsWith('- **Outer test**'));
    const unit = lines.find((l) => l.startsWith('- **Unit test**'));
    assert.match(outer, AT_LEAST, 'the Outer test line does not ask at least one integration test of the slice\'s behavior');
    for (const term of [UNIT_NEEDS, DATA_ROWS, NO_HELPER]) assert.match(unit, term, `the Unit test line does not say ${term}`);
    assert.doesNotMatch(text, ONE_PER_AC, 'the Project settings template still asks one outer test per acceptance criterion');
  });

  test('outer test (AC-18): the rules and plugin.json carry the kit\'s version (2.5.1, now 2.5.2); CHANGELOG has a 2.5.1 entry above 2.5.0 naming the three changes and the benchmark reason', () => {
    assert.equal(read(RULES_FILE).split(/\r?\n/)[0], `<!-- spec-driven-kit ${VERSION} -->`, `the rules file is not ${VERSION}`);
    assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, VERSION, `plugin.json is not ${VERSION}`);
    const changelog = read('CHANGELOG.md');
    const [patch, lean] = positions(changelog, [/^## 2\.5\.1 /m, /^## 2\.5\.0 /m]);
    assert.ok(patch < lean, 'the 2.5.1 entry is not the newest');
    const entry = changelog.slice(patch, lean);
    for (const term of [NO_BREAK, /3 to 5 acceptance criteria/i, /one outer test per acceptance criterion/i, /benchmark/i, /11 deliberate breaks/i, /5\.13 USD/, /3\.57/]) {
      assert.match(entry, term, `the 2.5.1 entry does not say ${term}`);
    }
  });
});

// Slice 9: kit 2.5.2 (amended 2026-11-23 on the owner's decisions D9-D12, after the 2.5.1 benchmark spec).

const FINE = /as fine as the steps of a plan/i;
const NO_SAFETY_SIZE = /safety is never a reason for a bigger slice/i;
const SAFE_ORDER = /security or personal-data criterion[^\n]*before the first slice that exposes the feature to a user/i;
const INTEGRATION_OUTER = /every slice's outer test is an integration test[^\n]*at least one per slice/i;
const NOT_MOCKED = /mocked view models? do(es)? not count/i;
const E2E = /end-to-end browser test[^\n]*optional[^\n]*at most once per feature[^\n]*final review/i;
const FULL_RULE = /never weakens? a security rule for readability or convenience[^\n]*full standard rule[^\n]*readability another way/i;
const EVERY_CASE = /outer test of a security criterion covers every case the rule names[^\n]*dangerous variant of each/i;
const SETUP = '.claude/skills/setup/SKILL.md';

/** Asserts that text has a line naming EVERY_CASE with the CSV-injection example of D12. */
function everyCase(text, where) {
  const line = text.split(/\r?\n/).find((l) => EVERY_CASE.test(l));
  assert.ok(line, `${where} does not say the outer test of a security criterion covers every case with a dangerous variant`);
  for (const term of ['`=`', '`+`', '`-`', '`@`', 'tab', 'CR', 'malicious']) assert.ok(line.includes(term), `${where}'s CSV example does not name ${term}`);
}

describe('KitLean slice 9: kit 2.5.2, slices of 1 to 3 ACs in a safe order, every outer test an integration test, security rules in full', () => {
  // AC-19 (D9) and AC-20 (D10) are replaced by AC-28 (2.5.3, D14): these tests keep their place and check D14.
  test('outer test (AC-19, now AC-28): write-spec, the spec template and spec-critic no longer size slices as fine as plan steps, by 1 to 3 criteria or for safety', () => {
    for (const [rel, body] of [['write-spec', skill('write-spec')], ['the spec template', read(SPEC_TEMPLATE)], ['spec-critic', read('.claude/agents/spec-critic.md')], ['the rules', read(RULES_FILE)]]) {
      for (const term of [FINE, NO_SAFETY_SIZE, /1 to 3 acceptance criteria|3 to 5 acceptance criteria|more than 5|fewer than 3/i]) assert.doesNotMatch(body, term, `${rel} still says ${term}`);
    }
  });

  test('outer test (AC-20, now AC-28): a security or personal-data criterion goes in the same slice as the functionality it protects, in write-spec, its self-check and the spec template; no safe order', () => {
    const cutting = skill('write-spec').split('### Cutting the slices')[1] ?? '';
    assert.match(cutting, SAME_SLICE, 'write-spec does not put a security criterion in the slice of the functionality it protects');
    assert.match(selfCheck(), SAME_SLICE, 'the self-check does not check that a security criterion is in the slice of its functionality');
    assert.match(section(read(SPEC_TEMPLATE), 'Slices'), SAME_SLICE, 'the spec template does not put a security criterion in the slice of its functionality');
    for (const [rel, body] of [['write-spec', skill('write-spec')], ['the spec template', read(SPEC_TEMPLATE)], ['spec-critic', read('.claude/agents/spec-critic.md')], ['the rules', read(RULES_FILE)]]) {
      assert.doesNotMatch(body, SAFE_ORDER, `${rel} still builds a security criterion before the exposing slice`);
      assert.doesNotMatch(body, /safe order/i, `${rel} still names the safe order`);
    }
  });

  // 2.5.7 (BR-40): the slice-plan template is gone; build-slice's Building carries the rule for the todo list too.
  // 2.6.0 (BR-58, AC-61): build-slice states the level by what is real and what is faked, and never the UI test project.
  test('outer test (AC-21): build-slice, write-spec and the rules make every slice\'s outer test an integration test, at least one per slice; mocked view models do not count', () => {
    const building = section(skill('build-slice'), 'Test-driven without exception');
    // 2.6.5 (BR-87): the clock and auth join the faked edges.
    for (const term of [/Integration test first/, /real DI container, real view model and services; only the browser edge, the clock, auth and the backend client faked; never in the UI test project/i]) {
      assert.match(building, term, `build-slice does not say ${term}`);
    }
    assert.doesNotMatch(skill('build-slice'), /a UI test of the page on its stubbed service/i, 'build-slice still lets a stub slice\'s outer test be a UI test');
    assert.match(skill('write-spec'), INTEGRATION_OUTER, 'write-spec does not make the outer test an integration test');
    assert.doesNotMatch(skill('write-spec'), /a UI test of the page on its stubbed service/i, 'write-spec still lets a stub slice\'s outer test be a UI test');
    const slices = section(read(RULES_FILE), 'Slices');
    for (const term of [INTEGRATION_OUTER, NOT_MOCKED, E2E]) assert.match(slices, term, `the rules' Slices does not say ${term}`);
  });

  test('AC-21: the spec template\'s Outer test column is an integration test in its description and in every example row', () => {
    const slices = section(read(SPEC_TEMPLATE), 'Slices');
    const line = slices.split(/\r?\n/).find((l) => l.startsWith('- **Outer test**'));
    assert.ok(line, 'the spec template has no Outer test line');
    for (const term of [INTEGRATION_OUTER, NOT_MOCKED]) assert.match(line, term, `the Outer test line does not say ${term}`);
    const rows = slices.split(/\r?\n/).filter((l) => /^\| \d+ \|/.test(l));
    assert.ok(rows.length > 0, 'the spec template has no example rows');
    for (const row of rows) assert.match(row.split('|')[4], /^\s*<Integration test/, `an example row's outer test is not an integration test: ${row}`);
  });

  test('AC-21: the Project settings template defines the integration test with the Presentation and the API examples, and the end-to-end test is optional', () => {
    const lines = read(SETTINGS_TEMPLATE).split(/\r?\n/);
    const integration = lines.find((l) => l.startsWith('- **Integration test**'));
    assert.ok(integration, 'no Integration test line');
    assert.match(integration, /browser-only feature[^\n]*Presentation integration test[^\n]*real DI container[^\n]*real view model[^\n]*real services[^\n]*fakes only the browser edge \(file download, JS interop\), the clock, auth and the backend client/i, 'the Integration test line has no Presentation example');
    assert.match(integration, /endpoint[^\n]*API integration test against the real backend host/i, 'the Integration test line has no API example');
    assert.match(integration, NOT_MOCKED, 'the Integration test line lets a mocked view model count');
    assert.match(lines.find((l) => l.startsWith('- **Outer test**')), /an integration test[^\n]*at least one per slice/i, 'the Outer test line does not make it an integration test');
    assert.match(lines.join('\n'), E2E, 'the template does not make the end-to-end browser test optional, once per feature, in the final review');
  });

  test('outer test (AC-22): write-spec never weakens a security rule; write-spec, the spec template and build-slice cover every case of a security rule with a dangerous variant', () => {
    assert.match(skill('write-spec'), FULL_RULE, 'write-spec may weaken a security rule');
    everyCase(skill('write-spec'), 'write-spec');
    everyCase(read(SPEC_TEMPLATE), 'the spec template');
    // 2.6.0 (AC-61): build-slice tests security criteria like any other, every case the rule names (the spec lists them).
    assert.match(skill('build-slice'), /Security and personal-data criteria are tested like any other: every case the rule names/, 'build-slice does not test every case of a security rule');
  });

  test('AC-22: setup\'s update tells the user to align a break-on-purpose test rule with the no-break rule and leaves project-owned rules alone', () => {
    const check = section(read(SETUP), '1. Check the project folder');
    const update = check.split(/\r?\n/).find((l) => /\*\*update\*\*/.test(l));
    assert.ok(update, 'setup has no update bullet');
    assert.match(update, /break-on-purpose[^\n]*align[^\n]*no-break rule|align[^\n]*break-on-purpose[^\n]*no-break rule/i, 'the update does not tell the user to align a break-on-purpose rule');
    assert.match(update, /installer does not edit project-owned rules/i, 'the update does not say the installer leaves project-owned rules alone');
  });

  test('outer test (AC-23): the rules and plugin.json carry the kit\'s version (2.5.2, now 2.5.3); CHANGELOG has a 2.5.2 entry above 2.5.1 naming D9-D12, the benchmark reason and the upgrade note', () => {
    assert.equal(read(RULES_FILE).split(/\r?\n/)[0], `<!-- spec-driven-kit ${VERSION} -->`, `the rules file is not ${VERSION}`);
    assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, VERSION, `plugin.json is not ${VERSION}`);
    const changelog = read('CHANGELOG.md');
    const [newest, patch] = positions(changelog, [/^## 2\.5\.2 /m, /^## 2\.5\.1 /m]);
    assert.ok(newest < patch, 'the 2.5.2 entry is not the newest');
    const entry = changelog.slice(newest, patch);
    for (const term of [/D9/, /D10/, /D11/, /D12/, /1 to 3 acceptance criteria/i, SAFE_ORDER, /integration test/i, NOT_MOCKED, /security rule/i,
      /2 slices/, /6 criteria/, /54/, /-2\+3\+cmd/, /`verify\.mjs` and `guard\.mjs` are unchanged/]) {
      assert.match(entry, term, `the 2.5.2 entry does not say ${term}`);
    }
    const notes = entry.split(/^### Upgrade notes/m)[1];
    assert.ok(notes, 'the 2.5.2 entry has no upgrade notes');
    assert.match(notes, /break-on-purpose[^\n]*T-4|T-4[^\n]*break-on-purpose/i, 'the upgrade notes do not name the break-on-purpose rule');
    assert.match(notes, /installer does not edit project-owned rules/i, 'the upgrade notes do not say the installer leaves the rule alone');
  });
});

// Slice 10: two gates (amended 2026-11-23 with the owner's decision D13). Integration: the installed verify.mjs and
// the unchanged guard.mjs in a temporary git project whose Verification Commands are node scripts.

const VERIFY = '.claude/hooks/verify.mjs';
const SLICE_GATE = /`node \.claude\/hooks\/verify\.mjs --slice <[^`]+`/;
const FEATURE_GATE = /`node \.claude\/hooks\/verify\.mjs --feature`/;
const STEP = [
  "import { appendFileSync, existsSync, mkdirSync } from 'node:fs';",
  'const [name, ...args] = process.argv.slice(2);',
  "mkdirSync('artifacts', { recursive: true });",
  "appendFileSync('artifacts/log.txt', JSON.stringify([name, ...args]) + '\\n');",
  "if (name === 'it' && existsSync('artifacts/broken')) process.exit(1);",
  "if (args.some((a) => a.includes('Broken'))) process.exit(1);",
  // 2.5.8 (BR-47): a filter that matches no test, as `dotnet test` reports it (exit 0), and a project's own message.
  "if (args.some((a) => a.includes('Missing'))) console.log('No test matches the given testcase filter in App.Integration.dll');",
  "if (args.some((a) => a.includes('Quiet'))) console.log('Nothing to run here');",
].join('\n');
const STEPS = ['build', 'unit', 'ui', 'it', 'format'].map((name) => `node step.mjs ${name}`);
// 3.0.0: the fifth step is the project's format check (verify.format); the slice gate leaves it out.
const FORMAT = 'step\\.mjs format';
const INTEGRATION = { command: 'node step.mjs it', filter: '--only {tests}', test: '{name}', separator: ',' };
const sliceGit = (dir, args) => execFileSync('git', ['-c', 'user.name=kit', '-c', 'user.email=kit@example.org', ...args], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** A level-2 project on a feature branch whose five Verification Commands log their arguments to artifacts/log.txt. */
function gateProject(kit, integration = INTEGRATION) {
  const dir = project();
  const run = install(kit, 'apply', dir, '--level', '2');
  assert.equal(run.status, 0, run.output);
  const config = { specsDir: '_specs', protectedBranches: ['main'], allowOnProtected: ['_specs/', '.claude/', 'CLAUDE.md'], verify: { shell: null, failPattern: null, commands: STEPS, format: FORMAT, ...(integration ? { integration } : {}) } };
  writeFileSync(join(dir, '.claude/spec-driven.json'), JSON.stringify(config, null, 2));
  writeFileSync(join(dir, 'step.mjs'), STEP);
  writeFileSync(join(dir, '.gitignore'), 'artifacts/\n.claude/spec-driven.state.json\n');
  sliceGit(dir, ['init', '-q', '-b', 'feature/x']);
  sliceGit(dir, ['add', '-A']);
  sliceGit(dir, ['commit', '-q', '-m', 'init']);
  return dir;
}

function verify(dir, ...args) {
  const run = spawnSync(process.execPath, [join(dir, VERIFY), ...args], { cwd: dir, encoding: 'utf8' });
  return { status: run.status, output: `${run.stdout ?? ''}${run.stderr ?? ''}` };
}

/** The commands that ran since the last call, as [name, ...args], and the log emptied. */
function ran(dir) {
  const file = join(dir, 'artifacts/log.txt');
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  writeFileSync(file, '');
  return lines;
}

const stateOf = (dir) => JSON.parse(readFileSync(join(dir, '.claude/spec-driven.state.json'), 'utf8'));

/** The installed, unchanged guard, asked about writing a slice recap. */
function recapWrite(dir) {
  const input = { tool_name: 'Write', tool_input: { file_path: join(dir, '_specs/Export/slice-1.md'), content: 'recap' } };
  const env = { ...process.env };
  delete env.ZYGGY_JOB;
  const run = spawnSync(process.execPath, [join(dir, '.claude/hooks/guard.mjs')], { input: JSON.stringify(input), encoding: 'utf8', env });
  return { status: run.status, stderr: run.stderr };
}

describe('KitLean slice 10: two gates (D13), the slice gate per slice and the feature gate in the final review', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('outer test (AC-24): --slice runs every Verification Command but the format check, and the integration command only for the named tests, and says so', () => {
    const dir = gateProject(kit);
    const run = verify(dir, '--slice', 'ExportTests.AC1_Csv', 'ExportTests.AC2_Guard');
    assert.equal(run.status, 0, run.output);
    assert.deepEqual(ran(dir), [['build'], ['unit'], ['ui'], ['it', '--only', 'ExportTests.AC1_Csv,ExportTests.AC2_Guard']], 'the slice gate did not run the unit and UI commands in full and the integration command filtered, without the format check');
    assert.match(run.output, /SKIP {2}node step\.mjs format[^\n]*final review/, 'the slice gate does not say it left the format check to the final review');
    assert.match(run.output, /slice gate/i, 'the output does not name the slice gate');
    assert.match(run.output, /ExportTests\.AC1_Csv[^\n]*ExportTests\.AC2_Guard/, 'the output does not name the integration tests it included');
    const state = stateOf(dir);
    assert.equal(state.gate, 'slice', 'the state does not record the slice gate');
    assert.deepEqual(state.integrationTests, ['ExportTests.AC1_Csv', 'ExportTests.AC2_Guard'], 'the state does not record the integration tests');
    assert.ok(state.verifiedFingerprint, 'a green slice gate does not record the verified tree');
  });

  test('AC-24: no argument and --feature run every command unfiltered, as before; so does runVerify(root, config) as the guard calls it', async () => {
    const dir = gateProject(kit);
    for (const args of [[], ['--feature']]) {
      const run = verify(dir, ...args);
      assert.equal(run.status, 0, run.output);
      assert.deepEqual(ran(dir), [['build'], ['unit'], ['ui'], ['it'], ['format']], `${args.join(' ') || 'no argument'} did not run every command unfiltered`);
      assert.match(run.output, /feature gate/i, `${args.join(' ') || 'no argument'} does not name the feature gate`);
      assert.equal(stateOf(dir).gate, 'feature');
    }
    const { runVerify, gateCommands } = await import(pathToFileURL(join(dir, VERIFY)).href);
    const config = JSON.parse(readFileSync(join(dir, '.claude/spec-driven.json'), 'utf8'));
    assert.deepEqual(gateCommands(config).commands, STEPS, 'the default gate is not every command');
    assert.equal(runVerify(dir, config).ok, true);
    assert.deepEqual(ran(dir), [['build'], ['unit'], ['ui'], ['it'], ['format']], 'runVerify(root, config) does not run every command unfiltered');
  });

  test('AC-24: the dotnet filter of verify.integration on test names', async () => {
    const { gateCommands } = await import(pathToFileURL(join(KIT, 'hooks/verify.mjs')).href);
    const commands = ['dotnet build App.sln', 'dotnet test src/Test/Unit/App.Unit.csproj', 'dotnet test src/Test/UI/App.UI.csproj', 'dotnet test src/Test/Integration/App.Integration.csproj', 'dotnet format App.sln --verify-no-changes'];
    const config = { verify: { commands, integration: { command: commands[3], filter: '--filter "{tests}"', test: 'FullyQualifiedName~{name}', separator: '|' } } };
    const slice = gateCommands(config, { mode: 'slice', tests: ['ExportTests.AC1_Csv', 'ExportTests.AC2_Guard'] });
    assert.deepEqual(slice.commands, [...commands.slice(0, 3), `${commands[3]} --filter "FullyQualifiedName~ExportTests.AC1_Csv|FullyQualifiedName~ExportTests.AC2_Guard"`]);
    assert.deepEqual(gateCommands(config, { mode: 'feature' }).commands, commands);
  });

  // 3.0.0: the format check runs once per feature, in the final review, like the analyzers; never in the slice gate.
  test('AC-24: the slice gate never runs the format check, with or without verify.integration and without verify.format; the feature gate does', async () => {
    const { gateCommands } = await import(pathToFileURL(join(KIT, 'hooks/verify.mjs')).href);
    const format = 'dotnet format App.sln --verify-no-changes';
    const commands = ['dotnet build App.sln', 'dotnet test src/Test/Unit/App.Unit.csproj', 'dotnet test src/Test/Integration/App.Integration.csproj', format];
    const integration = { command: commands[2], filter: '--filter "{tests}"', test: 'FullyQualifiedName~{name}', separator: '|' };
    for (const verify of [{ commands, integration }, { commands }]) {
      const slice = gateCommands({ verify }, { mode: 'slice', tests: ['ExportTests'] });
      assert.ok(!slice.commands.some((c) => /dotnet\s+format/.test(c)), `the slice gate runs the format check: ${slice.commands.join(' ; ')}`);
      assert.deepEqual(slice.skipped, [format], 'the slice gate does not report the format check it left out');
      assert.ok(gateCommands({ verify }).commands.includes(format), 'the feature gate no longer runs the format check');
    }
    const prettier = { commands: ['npm run build', 'npx prettier --check .'], format: 'prettier --check' };
    assert.deepEqual(gateCommands({ verify: prettier }, { mode: 'slice', tests: ['ExportTests'] }).commands, ['npm run build'], 'verify.format does not name the format check');
  });

  test('AC-24: the rules, build-slice, the Project settings, T-10 and the README say the slice gate runs no format check', () => {
    for (const rel of ['.claude/rules/spec-driven.md', '.claude/skills/build-slice/SKILL.md', '.claude/templates/project-settings.md', 'packs/dotnet-shared/rules/testing-for-agents.md', 'README.md']) {
      const text = read(rel);
      assert.match(text, /no format check/i, `${rel} does not say the slice gate runs no format check`);
      assert.doesNotMatch(text, /integration tests(?: written in the slice)?, (?:and )?the format check/i, `${rel} still lists the format check in the slice gate`);
    }
  });

  test('AC-24: without verify.integration the slice gate runs every command and says so', () => {
    const dir = gateProject(kit, null);
    const run = verify(dir, '--slice', 'ExportTests.AC1_Csv');
    assert.equal(run.status, 0, run.output);
    assert.deepEqual(ran(dir), [['build'], ['unit'], ['ui'], ['it']], 'without verify.integration the slice gate ran the format check or not every other command');
    assert.match(run.output, /verify\.integration/, 'the output does not say the integration command is not configured');
  });

  test('AC-24: --slice without a test name, a name with shell characters, or an integration command not in the list stops with exit 1 before any command runs', () => {
    const dir = gateProject(kit);
    for (const args of [['--slice'], ['--slice', 'A&calc'], ['--slice', 'A|B'], ['--slice', 'A;rm'], ['--bogus']]) {
      const run = verify(dir, ...args);
      assert.equal(run.status, 1, `${args.join(' ')} was accepted: ${run.output}`);
      assert.deepEqual(ran(dir), [], `${args.join(' ')} ran a command`);
    }
    const wrong = gateProject(kit, { ...INTEGRATION, command: 'node step.mjs integration' });
    const run = verify(wrong, '--slice', 'A');
    assert.equal(run.status, 1, run.output);
    assert.match(run.output, /verify\.integration/);
    assert.deepEqual(ran(wrong), []);
  });

  test('outer test (AC-24): after a red slice gate the unchanged guard refuses the recap, also when an earlier run was green on the same tree; after a green slice gate it lets the recap pass without running the suite', () => {
    const dir = gateProject(kit);
    assert.equal(verify(dir).status, 0);
    writeFileSync(join(dir, 'artifacts/broken'), '');
    ran(dir);
    const red = verify(dir, '--slice', 'ExportTests.AC1_Csv');
    assert.equal(red.status, 1, red.output);
    assert.equal(stateOf(dir).verifiedFingerprint, undefined, 'a red slice gate leaves the earlier verified tree in the state');
    const refused = recapWrite(dir);
    assert.equal(refused.status, 2, `the guard let the recap pass after a red slice gate: ${refused.stderr}`);

    const green = gateProject(kit);
    assert.equal(verify(green, '--slice', 'ExportTests.AC1_Csv').status, 0);
    ran(green);
    const passed = recapWrite(green);
    assert.equal(passed.status, 0, passed.stderr);
    assert.deepEqual(ran(green), [], 'the guard ran the suite again after a green slice gate');
  });

  // 2.6.0 (BR-58 to BR-60, AC-61, AC-62): build-slice ends on the slice gate; the rules' Gates define both gates;
  // new-feature runs the feature gate in the final review before spec-reviewer.
  test('AC-25: build-slice ends a slice on the slice gate with the slice\'s integration test class and runs no feature gate; new-feature runs it once in the final review before spec-reviewer', () => {
    const text = skill('build-slice');
    assert.match(text, SLICE_GATE, 'build-slice does not end the slice on the slice gate');
    assert.match(text, /--slice <IntegrationTestClass>/, 'build-slice does not give the slice gate the slice\'s integration test class');
    assert.doesNotMatch(text, FEATURE_GATE, 'build-slice runs the feature gate per slice');
    const final = step(section(skill('new-feature'), 'Workflow'), 'Review');
    const [gate, reviewer] = positions(final, [FEATURE_GATE, /`spec-reviewer`/]);
    assert.ok(gate < reviewer, 'the feature gate does not run before spec-reviewer');
    assert.match(final, /feature gate[^\n]*every Verification Command and every integration test/i, 'the final review does not say what the feature gate runs');
  });

  test('AC-25: the rules name the slice gate in Build, the feature gate in Review, and both in Gates', () => {
    const rules = read(RULES_FILE);
    const lines = rules.split(/\r?\n/);
    assert.match(lines.find((l) => l.startsWith('| 4. Build')), /slice gate/i, 'the Build phase does not name the slice gate');
    assert.match(lines.find((l) => l.startsWith('| 6. Review')), /feature gate/i, 'the Review phase does not name the feature gate');
    const gates = section(rules, 'Gates');
    assert.match(gates, /slice gate[^\n]*all unit tests[^\n]*UI tests[^\n]*only that slice's integration tests/i, 'the rules\' Gates do not define the slice gate');
    assert.match(gates, /feature gate[^\n]*every Verification Command[^\n]*final review/i, 'the rules\' Gates do not define the feature gate');
  });

  // 2.5.7 (BR-40, BR-42): the todo list names the slice gate's integration tests; the recap's gate row is in its Gate result.
  // 2.6.0 (BR-58, AC-61): no todo list and no recap; the gate command names the integration test class and its last line is quoted.
  test('AC-25: build-slice names the gate and its integration test class, and quotes the gate\'s last line in its answer', () => {
    const gate = section(skill('build-slice'), 'Verification is the gate');
    assert.match(gate, /`node \.claude\/hooks\/verify\.mjs --slice <IntegrationTestClass>`/, 'build-slice does not name the slice gate with its integration test class');
    assert.match(gate, /Quote its last line/i, 'build-slice does not quote the gate\'s result');
    assert.match(gate, /zero tests is red/i, 'build-slice does not treat a filter that matches zero tests as red');
  });

  test('AC-25: Project settings, spec-reviewer and setup describe the two gates and verify.integration', () => {
    const settings = read(SETTINGS_TEMPLATE).split('### Verification Commands')[1] ?? '';
    for (const term of [SLICE_GATE, FEATURE_GATE, /`verify\.integration`/, /slice gate/i, /feature gate/i]) assert.match(settings, term, `Project settings' Verification Commands do not say ${term}`);
    assert.match(read('.claude/agents/spec-reviewer.md'), /feature gate[^\n]*`node \.claude\/hooks\/verify\.mjs --feature`/i, 'spec-reviewer does not run the feature gate');
    assert.match(section(read(SETUP), '7. Establish the Verification Commands'), /`verify\.integration`[^\n]*command[^\n]*filter/i, 'setup does not fill in verify.integration');
  });

  test('outer test (AC-26): the dotnet-shared pack\'s T-4 is the kit\'s no-break rule and no point of testing-for-agents asks for a break on purpose', () => {
    const text = read('packs/dotnet-shared/rules/testing-for-agents.md');
    const t4 = text.split(/\r?\n/).find((l) => l.startsWith('| T-4 |'));
    assert.ok(t4, 'testing-for-agents has no T-4');
    for (const term of [NO_BREAK, /tests? written first[^\n]*seen red[^\n]*before the behavior exists/i, /then the (slice )?gate/i, /no deliberate breaks/i]) assert.match(t4, term, `T-4 does not say ${term}`);
    assert.doesNotMatch(text, /\*\*Break on purpose|breaking the behavior on purpose|break-on-purpose table|verifier repeats it/i, 'testing-for-agents still asks for a break on purpose');
  });

  test('outer test (AC-27): CHANGELOG 2.5.2 names D13 and the two gates; the README names them; the version is the kit\'s (2.5.2, now 2.5.3)', () => {
    const changelog = read('CHANGELOG.md');
    const [newest, patch] = positions(changelog, [/^## 2\.5\.2 /m, /^## 2\.5\.1 /m]);
    const entry = changelog.slice(newest, patch);
    for (const term of [/D13/, /slice gate/i, /feature gate/i, /`--slice`/, /`verify\.integration`/, /UI tests[^\n]*slice gate/i, /`guard\.mjs`[^\n]*(unchanged|byte-identical)/, /T-4/]) {
      assert.match(entry.split(/^### Upgrade notes/m)[0], term, `the 2.5.2 entry does not say ${term}`);
    }
    const workflow = section(read('README.md'), 'The workflow');
    assert.match(workflow, /slice gate/i, 'the README does not name the slice gate');
    assert.match(workflow, /feature gate/i, 'the README does not name the feature gate');
    assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, VERSION);
  });
});

// Slice 11: kit 2.5.3 (amended 2026-11-23 with the owner's decisions D14-D17). Text tests on the kit's texts; an
// installer integration test of the update that removes the architecture template; the guard's clean-up.

const SCAFFOLD_TABLE = /Scaffold table/;
const FINAL_REVIEW = [/feature gate/i, /`spec-reviewer`/, /`security-review`[^\n]*once/i, /end-to-end browser test[^\n]*optional[^\n]*once per feature|optional[^\n]*end-to-end browser test[^\n]*once per feature/i];
/** The 2.5.2 architecture template as a 2.5.2 install left it in a project, recorded as the kit's. */
const TEMPLATE_252 = '# Architecture: <Feature Name>\n\nThe target architecture of the feature, per layer. No steps, no code.\n';

describe('KitLean slice 11: kit 2.5.3, a slice is a user-testable increment, the Scaffold, stubs first, at least one integration test per slice', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('outer test (AC-28): the rules define a slice as one increment the user can test, size not a count of criteria, a security criterion with the functionality it protects, the steps in the plan', () => {
    const slices = section(read(RULES_FILE), 'Slices');
    // 2.6.0 (BR-59, AC-62): the fine-grained steps are build-slice's; the always-loaded rules no longer place them.
    for (const term of [INCREMENT, SIZE, SAME_SLICE]) assert.match(slices, term, `the rules' Slices does not say ${term}`);
    assert.match(read(RULES_FILE), /How a slice is built is `build-slice`'s/, 'the rules do not leave the steps to build-slice');
    for (const [rel, body] of [['the rules', read(RULES_FILE)], ['write-spec', skill('write-spec')], ['the spec template', read(SPEC_TEMPLATE)], ['spec-critic', read('.claude/agents/spec-critic.md')]]) {
      assert.doesNotMatch(body, COUNTED, `${rel} still sizes or orders slices by D9 or D10`);
    }
    assert.match(section(read(SPEC_TEMPLATE), 'Slices'), SAME_SLICE, 'the spec template does not put a security criterion with its functionality');
    assert.match(read('.claude/agents/spec-critic.md'), INCREMENT, 'spec-critic does not check that a slice is a user-testable increment');
  });

  test('outer test (AC-29): no kit text names architecture.md or the architecture template; the spec template has the What happens diagram and no How it is built diagram', () => {
    assert.ok(!existsSync(join(KIT, ARCHITECTURE_TEMPLATE)), 'the kit still ships the architecture template');
    for (const rel of kitTexts()) assert.doesNotMatch(read(rel), /architecture\.md|architecture-template/, `${rel} still names architecture.md or its template`);
    const template = read(SPEC_TEMPLATE);
    assert.match(section(template, 'Diagrams'), /^### What happens/m, 'the spec template lost the What happens diagram');
    assert.doesNotMatch(template, /^### How it is built/m, 'the spec template still has the How it is built diagram');
    const [slices, scaffold] = positions(template, [/^## Slices/m, /^## Scaffold/m]);
    assert.ok(slices < scaffold, 'the Scaffold does not follow the Slices');
    assert.match(section(template, 'Scaffold'), /^### Slice 1/m, 'the Scaffold is not cut per slice');
  });

  test('AC-29: write-spec\'s code-grounded self-check points the registrations, the names and the culture at the Scaffold table', () => {
    const lines = selfCheck().split(/\r?\n/);
    for (const [what, pattern] of [['registrations', /DI registration/], ['names', /type, route, setting or file/], ['culture', /culture and locale/i]]) {
      const line = lines.find((l) => pattern.test(l));
      assert.ok(line, `the self-check has no point on ${what}`);
      assert.match(line, SCAFFOLD_TABLE, `the self-check's point on ${what} does not name the Scaffold table`);
    }
    assert.match(section(skill('write-spec'), 'Writing').split('### The Scaffold')[1] ?? '', /create, modify or delete[^\n]*what changes and why[^\n]*DI registrations and wiring/i, 'write-spec does not say what the Scaffold holds');
  });

  test('outer test (AC-29): an update of a 2.5.2 install removes the unchanged architecture template and leaves the specs\' architecture.md files alone', () => {
    const dir = project();
    assert.equal(install(kit, 'apply', dir).status, 0);
    writeFileSync(join(dir, ARCHITECTURE_TEMPLATE), TEMPLATE_252);
    const recorded = record(dir);
    recorded.files[ARCHITECTURE_TEMPLATE] = sha(TEMPLATE_252);
    recorded.kitVersion = '2.5.2';
    writeFileSync(join(dir, RECORD), JSON.stringify(recorded, null, 2));
    mkdirSync(join(dir, '_specs/Export'), { recursive: true });
    writeFileSync(join(dir, '_specs/Export/architecture.md'), '# Architecture: Export\n');
    const before = tree(dir);
    const run = install(kit, 'apply', dir);
    assert.equal(run.status, 0, run.output);
    assert.ok(!existsSync(join(dir, ARCHITECTURE_TEMPLATE)), 'the architecture template is still in the project');
    assert.match(run.stdout, /^remove\s+\.claude\/templates\/architecture-template\.md/m, 'the output does not report the architecture template as removed');
    assert.ok(!(ARCHITECTURE_TEMPLATE in record(dir).files), 'the architecture template is still recorded');
    const after = tree(dir);
    assert.deepEqual(Object.keys(before).filter((p) => !(p in after)), [ARCHITECTURE_TEMPLATE], 'the update removed other files');
    assert.equal(after['_specs/Export/architecture.md'], before['_specs/Export/architecture.md'], 'the update touched a spec\'s architecture.md');
  });

  // 2.5.7 (BR-40, AC-43): the steps live in the todo list; the slice-plan template is gone.
  // 2.5.8 (BR-46, AC-49): the integration test class comes first and is seen red; the stubs follow it.
  // 2.6.0 (BR-58, AC-61): no todo list; build-slice's first step writes the integration test, adds only the stubs the
  // Scaffold rows name so it compiles, and sees it fail for the missing behavior; then unit red, smallest code, refactor.
  test('outer test (AC-30, now AC-49, 2.6.0: AC-61): build-slice works from the slice\'s Scaffold rows: the integration test first, the stubs the rows name so it compiles, seen failing, then red, green, refactor', () => {
    const text = section(skill('build-slice'), 'Test-driven without exception');
    assert.match(text, /stubs the Scaffold rows name so it compiles/i, 'build-slice does not take the stubs from the slice\'s Scaffold rows');
    assert.match(text, /Integration test first[^\n]*stubs the Scaffold rows name[^\n]*seen failing for the right reason/i, 'build-slice does not start with the integration test, then the stubs, seen failing');
  });

  test('AC-30, now AC-49 (2.6.0: AC-61): build-slice orders the integration test, then the stubs, then red, green, refactor', () => {
    const text = section(skill('build-slice'), 'Test-driven without exception');
    const [first, stubs, green, refactor] = positions(text, [/integration test/i, /stubs/i, /smallest code to pass/, /\brefactor\b/]);
    assert.ok(first < stubs && stubs < green && green < refactor, 'the steps are not in the order integration test, stubs, red, green, refactor');
    assert.match(skill('build-slice'), /Scaffold rows/, 'the build does not work from the slice\'s Scaffold rows');
  });

  test('outer test (AC-31): build-slice and the spec template\'s Outer test line ask at least one integration test of the slice\'s behavior; only the unit tests the change needs', () => {
    // 2.6.0 (AC-61): build-slice asks the slice's integration test of its behavior and a unit test per rule or calculation.
    const building = section(skill('build-slice'), 'Test-driven without exception');
    for (const term of [/the slice's integration test of its behavior/i, /for each rule or calculation, a unit test/i]) assert.match(building, term, `build-slice does not say ${term}`);
    const outer = section(read(SPEC_TEMPLATE), 'Slices').split(/\r?\n/).find((l) => l.startsWith('- **Outer test**'));
    assert.match(outer, AT_LEAST, 'the spec template\'s Outer test line does not ask at least one integration test of the slice\'s behavior');
    for (const rel of [SPEC_TEMPLATE, RULES_FILE]) assert.doesNotMatch(read(rel), ONE_PER_AC, `${rel} still asks one outer test per acceptance criterion`);
    assert.doesNotMatch(skill('build-slice'), ONE_PER_AC, 'build-slice still asks one outer test per acceptance criterion');
  });

  // 2.5.7 (BR-42, AC-45): the recap holds only its four parts, so the final review is stated by the rules and build-slice.
  test('outer test (AC-32): the rules and build-slice say the final review runs the feature gate, spec-reviewer and security-review once, and an optional end-to-end browser test once per feature; the recap template does not repeat it', () => {
    const review = read(RULES_FILE).split(/\r?\n/).find((line) => line.startsWith('| 6. Review'));
    // 2.6.0 (BR-60, AC-62): the final review moved from build-slice to new-feature's Review step; the recap template is gone.
    const texts = [['the rules\' Review phase', review], ['new-feature\'s Review', step(section(skill('new-feature'), 'Workflow'), 'Review')]];
    for (const [where, text] of texts) for (const term of FINAL_REVIEW) assert.match(text, term, `${where} does not say ${term}`);
    assert.ok(!existsSync(join(KIT, RECAP_TEMPLATE)), 'the recap template is still shipped');
    assert.doesNotMatch(skill('build-slice'), /final review|`spec-reviewer`/i, 'build-slice still repeats the final review');
  });

  test('outer test (AC-33): the installed guard judges slice-verifier like any session and still limits spec-critic and spec-reviewer', () => {
    const dir = gateProject(kit, null);
    const env = { ...process.env };
    delete env.ZYGGY_JOB;
    const call = (input) => spawnSync(process.execPath, [join(dir, '.claude/hooks/guard.mjs')], { input: JSON.stringify(input), encoding: 'utf8', env });
    const bashAs = (command, agent) => ({ tool_name: 'Bash', tool_input: { command }, agent_type: agent });
    const editAs = (file, agent) => ({ tool_name: 'Edit', tool_input: { file_path: join(dir, file), old_string: 'a', new_string: 'b' }, agent_type: agent });
    for (const command of ['git add .', 'git stash', 'git checkout -- src']) {
      const run = call(bashAs(command, 'slice-verifier'));
      assert.equal(run.status, 0, `slice-verifier: ${command} refused: ${run.stderr}`);
      for (const agent of ['spec-critic', 'spec-reviewer']) {
        const refused = call(bashAs(command, agent));
        assert.equal(refused.status, 2, `${agent}: ${command} not refused`);
        assert.match(refused.stderr, new RegExp(`the ${agent} agent reviews`));
      }
    }
    const commit = call(bashAs('git commit -m "x"', 'slice-verifier'));
    assert.equal(commit.status, 0, commit.stderr);
    assert.equal(JSON.parse(commit.stdout).hookSpecificOutput.permissionDecision, 'ask', 'a commit by slice-verifier is not asked like the main session\'s');
    const spec = call(editAs('_specs/Export/spec.md', 'slice-verifier'));
    assert.equal(spec.status, 0, `slice-verifier may not edit a spec on a feature branch: ${spec.stderr}`);
  });

  test('outer test (AC-34): the rules and plugin.json carry the kit\'s version (2.5.3, now 2.5.4); CHANGELOG has a 2.5.3 entry above 2.5.2 naming D14-D17, the guard clean-up and the upgrade notes', () => {
    assert.equal(read(RULES_FILE).split(/\r?\n/)[0], `<!-- spec-driven-kit ${VERSION} -->`, `the rules file is not ${VERSION}`);
    assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, VERSION, `plugin.json is not ${VERSION}`);
    const changelog = read('CHANGELOG.md');
    const [newest, previous] = positions(changelog, [/^## 2\.5\.3 /m, /^## 2\.5\.2 /m]);
    assert.ok(newest < previous, 'the 2.5.3 entry is not the newest');
    const entry = changelog.slice(newest, previous);
    const [body, notes] = entry.split(/^### Upgrade notes/m);
    for (const term of [/D14/, /D15/, /D16/, /D17/, /Scaffold/, /stubs/i, /at least one integration test/i, /`slice-verifier`[^\n]*`guard\.mjs`|`guard\.mjs`[^\n]*`slice-verifier`/]) {
      assert.match(body, term, `the 2.5.3 entry does not say ${term}`);
    }
    assert.ok(notes, 'the 2.5.3 entry has no upgrade notes');
    assert.match(notes, /test rule[^\n]*break[^\n]*align|align[^\n]*test rule[^\n]*break/i, 'the upgrade notes do not tell the user to align a test rule that asks for break checks');
    assert.match(notes, /`architecture-template\.md`[^\n]*remove/i, 'the upgrade notes do not say the update removes the architecture template');
    assert.match(notes, /`architecture\.md`[^\n]*(left alone|leaves|kept)/i, 'the upgrade notes do not say existing architecture.md files are left alone');
  });

  test('AC-34: the README\'s workflow names the user-testable increment, the Scaffold, the slice plan with stubs first, the two gates and the final review', () => {
    const workflow = section(read('README.md'), 'The workflow');
    // 2.5.8 (BR-46): the integration test class first, then the stubs (was: stubs first).
    // 2.6.0 (BR-58): the README says the integration test first, as build-slice does; the stubs are build-slice's detail.
    for (const term of [INCREMENT, /Scaffold/, /integration test first/i, /slice gate/i, /feature gate/i, /final review/i, /end-to-end browser test[^\n]*optional|optional[^\n]*end-to-end browser test/i]) {
      assert.match(workflow, term, `The workflow does not say ${term}`);
    }
  });
});

// Slice 12: kit 2.5.4 (amended 2026-11-23, BR-32, AC-35): diagrams render. A 2.5.3 spec's sequence diagram did not
// render: its message label `UTF-8 BOM, ";", quoted, formula guard` holds a `;`, which ends a Mermaid statement.

/** Lines of a Mermaid block that hold no label: comments, styling (colours such as `fill:#f9f`), clicks, rect colours. */
const NOT_A_LABEL = /^(%%|classDef\b|class\b|style\b|linkStyle\b|click\b|rect\b)/;
/** Mermaid entity codes, the allowed way to write a `;`, `#` or `"` in a label. */
const ENTITY = /#(?:\d+|[A-Za-z]+);/g;

/**
 * The label problems of a Mermaid block: per line that holds labels (messages, notes, participant aliases, node and
 * edge labels), a raw `;` or `#` or an odd number of `"`, once the entity codes are taken out. A trailing `;` that
 * ends a statement is not a label character.
 */
function mermaidLabelProblems(block) {
  const problems = [];
  for (const raw of block.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || NOT_A_LABEL.test(line)) continue;
    const bare = line.replace(ENTITY, '').replace(/;\s*$/, '');
    if (bare.includes(';')) problems.push(`raw ";" in: ${line}`);
    if (bare.includes('#')) problems.push(`raw "#" in: ${line}`);
    if ((bare.match(/"/g) ?? []).length % 2 === 1) problems.push(`unbalanced quotes in: ${line}`);
  }
  return problems;
}

/** Every Markdown file the kit ships: the rules, skills, agents and templates, the packs, the README and the CHANGELOG. */
function shippedMarkdown() {
  const files = ['README.md', 'CHANGELOG.md'];
  const walk = (folder) => {
    for (const entry of readdirSync(join(KIT, folder), { withFileTypes: true })) {
      const rel = `${folder}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (entry.name.endsWith('.md')) files.push(rel);
    }
  };
  walk('.claude');
  walk('packs');
  return files;
}

/** The bodies of the ```mermaid blocks of a Markdown text. */
const mermaidBlocks = (text) => [...text.matchAll(/^```mermaid\r?\n([\s\S]*?)^```/gm)].map((m) => m[1]);

const LABEL_RULE = [/`;`/, /`#`/, /unbalanced quotes/i, /semicolon/i, /`#59;`/, /`#quot;`/, /labels? short|short labels?/i];

describe('KitLean slice 12: kit 2.5.4, diagrams render', () => {
  test('AC-35: the label scan flags the 2.5.3 incident\'s label and an odd quote, and passes entity codes and classDef colours', () => {
    assert.ok(mermaidLabelProblems('sequenceDiagram\n    Page->>Csv: UTF-8 BOM, ";", quoted, formula guard\n').some((p) => p.startsWith('raw ";"')), 'the incident\'s label is not flagged');
    assert.ok(mermaidLabelProblems('flowchart TD\n    A[Issue #12] --> B\n').some((p) => p.startsWith('raw "#"')), 'a raw # is not flagged');
    assert.ok(mermaidLabelProblems('flowchart TD\n    A["say "hi"] --> B\n').some((p) => p.startsWith('unbalanced')), 'an odd quote is not flagged');
    assert.deepEqual(mermaidLabelProblems('sequenceDiagram\n    Page->>Csv: UTF-8 BOM, #quot;#59;#quot; separator, quoted, formula guard\n    Page->>Csv: semicolon separator\n'), [], 'entity codes or words are flagged');
    assert.deepEqual(mermaidLabelProblems('flowchart TD\n    A["a, b"] --> B;\n    classDef hot fill:#f9f,stroke:#333;\n    style B fill:#bbf\n    %% a comment; with #\n'), [], 'a quoted label, a statement end, colours or a comment are flagged');
  });

  test('outer test (AC-35): every Mermaid block the kit ships has labels without a raw ";" or "#" and with balanced quotes', () => {
    let blocks = 0;
    for (const rel of shippedMarkdown()) {
      for (const block of mermaidBlocks(read(rel))) {
        blocks += 1;
        assert.deepEqual(mermaidLabelProblems(block), [], `${rel} ships a Mermaid diagram that may not render`);
      }
    }
    // 2.5.7 (BR-42): the recap template lost its diagram; the spec template holds one.
    assert.ok(blocks >= 1, `the scan found only ${blocks} Mermaid blocks; the spec template holds one`);
    assert.equal(mermaidBlocks(read(SPEC_TEMPLATE)).length, 1, 'the spec template has no What happens diagram to scan');
  });

  test('outer test (AC-35): write-spec\'s diagram bullet and the spec template state the label rule', () => {
    const bullet = section(skill('write-spec'), 'Writing').split(/\r?\n/).find((l) => l.startsWith('- **The What happens diagram**'));
    assert.ok(bullet, 'write-spec has no What happens diagram bullet');
    for (const term of LABEL_RULE) assert.match(bullet, term, `write-spec's diagram bullet does not say ${term}`);
    const diagrams = section(read(SPEC_TEMPLATE), 'Diagrams');
    for (const term of LABEL_RULE) assert.match(diagrams, term, `the spec template's Diagrams does not say ${term}`);
  });

  test('AC-35: write-spec\'s self-check has the line "every diagram renders (labels follow the rule above)"', () => {
    assert.match(selfCheck(), /^\s*- every diagram renders \(labels follow the rule above\)/m, 'the self-check does not check that every diagram renders');
  });

  test('outer test (AC-35): the rules and plugin.json carry the kit\'s version (2.5.4, now 2.5.5); CHANGELOG has a 2.5.4 entry above 2.5.3 naming the incident and the label rule', () => {
    assert.equal(read(RULES_FILE).split(/\r?\n/)[0], `<!-- spec-driven-kit ${VERSION} -->`, `the rules file is not ${VERSION}`);
    assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, VERSION, `plugin.json is not ${VERSION}`);
    const changelog = read('CHANGELOG.md');
    const [newest, previous] = positions(changelog, [/^## 2\.5\.4 /m, /^## 2\.5\.3 /m]);
    assert.ok(newest < previous, 'the 2.5.4 entry is not the newest');
    const entry = changelog.slice(newest, previous);
    for (const term of [/Parse error/i, /BR-32/, /`#59;`/, /`#quot;`/, /every diagram renders/i, /`verify\.mjs` and `guard\.mjs` are unchanged/]) {
      assert.match(entry, term, `the 2.5.4 entry does not say ${term}`);
    }
  });
});

// Slice 13: kit 2.5.5 (amended 2026-11-23, BR-33 to BR-35, AC-36 to AC-38): code analysis in the final review.
// 3.0.0: the analysis is the built-in .NET analysis, with no server.

/** sha (CRLF read as LF) of the two hooks at 6ba02be (kit 2.5.4); 2.5.5 changes neither. */
const AT_6BA02BE = {
  'hooks/verify.mjs': '08b7f4982e42e73f633bde127e0208a222216f22e9018c0a79ca41fee02bb620',
  'hooks/guard.mjs': '1589948c4cff2b5576430100e82ee6468fabbffccde185c99f5159614ea53534',
};
/**
 * 2.5.8 (BR-47, AC-50): verify.mjs gains the zero-tests check of the slice gate, so its pin moves to 2.5.8; what changed
 * is checked by the AC-50 tests. guard.mjs stays as at 6ba02be. The hash tests of slices 13 to 15 use these pins.
 * 2.5.9 (BR-49, AC-52): verify.mjs changes what it prints (the output diet), so its pin moves to 2.5.9 (was
 * 7fec677855717576753df5e284ceac7d78be1a5641c80cc3cd93207fc7365ec5 at 2.5.8); what it runs, its exit codes, its state and
 * what the guard uses are checked by the AC-52 tests. guard.mjs still as at 6ba02be.
 * 2.6.1 (D19, BR-63 to BR-68, AC-71): verify.mjs gains the red record, --start, --run and the red check, guard.mjs the
 * state-file refusal and loses the word recap; both pins move to 2.6.1 (was 913dc60a... and 1589948c... at 2.6.0); what
 * changed is checked by the slice 21 tests, the earlier behavior by the tests of slices 10, 16 and 17 and tests/guard.test.mjs.
 * 2.6.2 (D20, BR-70 to BR-74, AC-76): verify.mjs records reds by full test name from TRX, assertion failures only, in the
 * committed _specs/<Feature>/red-record.json; guard.mjs refuses edits of that file; both pins move to 2.6.2 (were
 * e8fd512a... and c5b1023d... at 2.6.1); what changed is checked by the slice 22 tests.
 * 2.6.4 (D22, BR-83, AC-88): the red check is removed: verify.mjs is the 2.6.0 runner again (its comments name the slice
 * file and the mutation check), guard.mjs loses guard 5; both pins move to 2.6.4 (were 4c1c57cb... and aef458ef... at
 * 2.6.2); what changed is checked by the AC-87 test, the earlier behavior by the tests of slices 10, 16, 17 and 21.
 * 3.0.0: the slice gate leaves out the format check (verify.format, by default any `dotnet format` command); verify.mjs's
 * pin moves to 3.0.0 (was f024dd3f... at 2.6.4); what changed is checked by the slice 10 tests. guard.mjs unchanged.
 */
const HOOKS_PINNED = {
  'hooks/verify.mjs': 'f88ea24ace8029a4efcf26c143009cc8b956ca763925f50ef9743d0da19b0bbb',
  'hooks/guard.mjs': '719793735ebe075940f2be65ab06695510e546f7db349b6f1e7781991077cc5c',
};
const assertHooksPinned = () => {
  for (const [rel, hash] of Object.entries(HOOKS_PINNED)) assert.equal(sha(read(rel)), hash, `${rel} changed since it was pinned`);
};

/** The first line of text that matches the pattern, asserting there is one. */
function lineOf(text, pattern, what) {
  const line = text.split(/\r?\n/).find((l) => pattern.test(l));
  assert.ok(line, `no line for ${what}`);
  return line;
}

/** Asserts that the patterns occur in text in the given order. */
function inOrder(text, patterns, what) {
  const at = positions(text, patterns);
  for (let i = 1; i < at.length; i += 1) assert.ok(at[i - 1] < at[i], `${what}: ${patterns[i - 1]} does not come before ${patterns[i]}`);
}

/** The text of a numbered step that starts with **<name>**, up to the next numbered step or the end. */
function step(text, name) {
  const start = text.search(new RegExp(`^\\d+\\. \\*\\*${name}`, 'm'));
  assert.notEqual(start, -1, `no step "${name}"`);
  const rest = text.slice(start + 1);
  const next = rest.search(/^\d+\. \*\*/m);
  return next === -1 ? text.slice(start) : text.slice(start, start + 1 + next);
}

const FINAL_REVIEW_ORDER = [/feature gate/i, /code analysis/i, /`spec-reviewer`/, /`security-review`/];

describe('KitLean slice 13: kit 2.5.5, code analysis', () => {
  // 2.6.0 (BR-58, AC-61): build-slice states no warnings rule of its own: the guidelines (the coding rule among them)
  // apply to every line, and the slice gate, which fails on warnings, runs until green. The rule stays in Project settings.
  test('outer test (AC-36, 2.6.0: AC-61): build-slice applies the guidelines to every line and fixes what the slice gate reports until it is green; Project settings keep the no-new-warning rule', () => {
    const text = skill('build-slice');
    assert.match(text, /guidelines apply to every line/i, 'build-slice does not apply the guidelines to every line');
    assert.match(section(text, 'Verification is the gate'), /until it is green, fixing what it reports/i, 'build-slice does not fix what the gate reports');
    const warnings = lineOf(read(SETTINGS_TEMPLATE), /^- \*\*Warnings in the build\*\*/, 'the Warnings in the build line');
    assert.match(warnings, /every slice leaves no new warning in the files it touched/i, 'Project settings lost the no-new-warning rule');
  });

  // 3.0.0: the analysis is the built-in .NET analysis in the build, with no server.
  test('AC-36 (3.0.0): the rules no longer carry the warnings rule; the Project settings declare the built-in .NET analysis, no server, and never silence a rule', () => {
    assert.ok(!existsSync(join(KIT, RECAP_TEMPLATE)), 'the recap template is still shipped');
    assert.doesNotMatch(read(RULES_FILE), /no new warning in the files the slice touched/i, 'the rules still carry the build\'s warnings rule');
    const settings = read(SETTINGS_TEMPLATE);
    const analysis = lineOf(settings, /^- \*\*Analysis\*\*/, 'the Analysis line');
    for (const term of [/`EnableNETAnalyzers`/, /`AnalysisLevel`/, /`EnforceCodeStyleInBuild`/, /`\.editorconfig`/, /`TreatWarningsAsErrors` where the project chooses it/, /`dotnet format --verify-no-changes`/, /no server/i]) {
      assert.match(analysis, term, `the Analysis line does not say ${term}`);
    }
    const warnings = lineOf(settings, /^- \*\*Warnings in the build\*\*/, 'the Warnings in the build line');
    assert.match(warnings, /never switched off/i, 'the Warnings line allows silencing a rule');
  });

  // 2.6.0 (BR-60, AC-62): the final review is new-feature's Review step, its parts as bullets in the same order.
  test('outer test (AC-37): new-feature\'s final review runs the code analysis after the feature gate and before spec-reviewer, fixes, gates again, and keeps code and tokens where they are', () => {
    const last = step(section(skill('new-feature'), 'Workflow'), 'Review');
    inOrder(last, [/^\s+- the feature gate/m, /^\s+- the code analysis/m, /^\s+- the `spec-reviewer` agent/m], 'new-feature\'s Review');
    const analysis = lineOf(last, /^\s+- the code analysis/, 'the code analysis bullet');
    for (const term of [/\*\*Analysis\*\*/, /\*\*Fix analysis\*\*/, /changed code/i, /feature gate again/i, /never by weakening, disabling or suppressing a rule/i,
      /`artifacts\/<FeatureName>-analysis\.md`/, /final review report/i, /no (code )?analysis is declared[^\n]*skip/i, /cannot run[^\n]*why/i,
      /built-in analyzers/i, /`dotnet format --verify-no-changes`/]) {
      assert.match(analysis, term, `new-feature's code analysis does not say ${term}`);
    }
  });

  test('AC-37: the Project settings template has the Analysis and Fix analysis lines; spec-reviewer reports the unfixed findings for the owner', () => {
    const settings = read(SETTINGS_TEMPLATE);
    const analysis = lineOf(settings, /^- \*\*Analysis\*\*/, 'the Analysis line');
    for (const term of [/final review/i, /runs on the machine only and sends no code anywhere/i]) assert.match(analysis, term, `the Analysis line does not say ${term}`);
    const fix = lineOf(settings, /^- \*\*Fix analysis\*\*/, 'the Fix analysis line');
    assert.match(fix, /`dotnet format`/, 'the Fix analysis line does not name dotnet format');
    const reviewer = read('.claude/agents/spec-reviewer.md');
    assert.match(reviewer, /`artifacts\/<FeatureName>-analysis\.md`/, 'spec-reviewer does not read the code analysis findings');
    assert.match(section(reviewer, 'Report'), /code analysis[^\n]*(could not fix|not fixed)[^\n]*owner/i, 'spec-reviewer\'s report does not list the unfixed findings for the owner');
  });

  // 2.5.7 (BR-42): the recap template no longer carries the final review line; the other texts keep it.
  test('outer test (AC-38): the rules, build-slice and the README name the final review alike: feature gate, code analysis, spec-reviewer, security-review', () => {
    const rules = read(RULES_FILE);
    inOrder(lineOf(rules, /^\| 6\. Review/, 'the rules\' Review phase'), FINAL_REVIEW_ORDER, 'the rules\' Review phase');
    // 2.6.0 (BR-59, BR-60, AC-62): the rules' Proof became Gates; the final review is new-feature's Review step.
    inOrder(lineOf(section(rules, 'Gates'), /Two gates/, 'the rules\' Gates'), [/feature gate/i, /code analysis/i, /`spec-reviewer`/], 'the rules\' Gates');
    inOrder(step(section(skill('new-feature'), 'Workflow'), 'Review'), FINAL_REVIEW_ORDER, 'new-feature\'s Review');
    inOrder(lineOf(read('README.md'), /^\| Review \| The final review/, 'the README\'s Review row of the workflow'), FINAL_REVIEW_ORDER, 'the README\'s Review row');
  });

  test('outer test (AC-38): the rules and plugin.json carry the kit\'s version (2.5.5, now 2.5.6); CHANGELOG has a 2.5.5 entry above 2.5.4; verify.mjs and guard.mjs hash as at 6ba02be', () => {
    assert.equal(read(RULES_FILE).split(/\r?\n/)[0], `<!-- spec-driven-kit ${VERSION} -->`, `the rules file is not ${VERSION}`);
    assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, VERSION, `plugin.json is not ${VERSION}`);
    const changelog = read('CHANGELOG.md');
    const [newest, previous] = positions(changelog, [/^## 2\.5\.5 /m, /^## 2\.5\.4 /m]);
    assert.ok(newest < previous, 'the 2.5.5 entry is not the newest');
    const entry = changelog.slice(newest, previous);
    for (const term of [/BR-33/, /BR-34/, /\*\*Analysis\*\*/, /\*\*Fix analysis\*\*/, /3\.0\.0/]) {
      assert.match(entry, term, `the 2.5.5 entry does not say ${term}`);
    }
    assertHooksPinned(); // 2.5.8 (BR-47): verify.mjs pinned at 2.5.8, guard.mjs at 6ba02be.
  });
});

// Slice 14: kit 2.5.6 (amended 2026-11-23, BR-36 to BR-39, AC-39 to AC-42): the pack rules applied by path and named
// in review. The per-slice analysis it also added is gone since 2.6.0, the server analysis since 3.0.0.

/** The pack-checks module, loaded per test so that a missing export fails that test and not the whole file. */
const packChecks = () => import(pathToFileURL(join(KIT, 'tools/pack-checks.mjs')).href);
/** The pack rule files installed in a project, as { name, text }, for the declared rules of the packs. */
function installedPackRules(dir, packs) {
  const declared = packs.flatMap((pack) => JSON.parse(read(`packs/${pack}/pack.json`)).rules ?? []);
  return declared.map((name) => {
    const rel = `.claude/rules/${name}.md`;
    assert.ok(existsSync(join(dir, rel)), `${rel} is not installed`);
    return { name, text: readFileSync(join(dir, rel), 'utf8') };
  });
}
const ALL_PACKS = [['dotnet-shared']];

describe('KitLean slice 14: kit 2.5.6, pack rules applied by path', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('AC-39: the scope check flags an unscoped pack rule no text names, and the glob match follows the rule\'s paths', async () => {
    const { globMatches, rulesCovering, unscopedRules } = await packChecks();
    assert.equal(typeof unscopedRules, 'function', 'pack-checks has no unscopedRules');
    const scoped = { name: 'tests', text: '---\npaths:\n  - "src/Test/**"\n---\n# Tests\n' };
    const bare = { name: 'naming', text: '# Naming\n\nNo frontmatter.\n' };
    const empty = { name: 'logging', text: '---\ndescription: x\n---\n# Logging\n' };
    assert.deepEqual(unscopedRules([scoped, bare, empty], ['Read `.claude/rules/tests.md`.']), ['naming', 'logging'], 'an unscoped rule that no text names is not flagged');
    assert.deepEqual(unscopedRules([scoped, bare], ['Read `.claude/rules/naming.md` for every file.']), [], 'an unscoped rule that build-slice names is flagged');
    for (const [glob, file, expected] of [['src/Test/**', 'src/Test/Unit/A.Tests/ATests.cs', true], ['src/Test/**', 'src/Core/A.cs', false],
      ['src/**/*Tests/**', 'src/Lib/Lib.Tests/LibTests.cs', true], ['src/**/*.cs', 'src/A.cs', true], ['src/**/*.cs', 'src/Core/Domain/A.razor', false],
      ['**/*.csproj', 'A.csproj', true], ['**/*.csproj', 'src/Core/Core.csproj', true], ['src/Host/**', 'src/HostX/a.cs', false]]) {
      assert.equal(globMatches(glob, file), expected, `${glob} against ${file}`);
    }
    assert.deepEqual(rulesCovering('src/Test/Unit/A.Tests/ATests.cs', [scoped, bare]), ['tests']);
  });

  test('outer test (AC-39): installed with every pack, each pack rule is path-scoped or named by build-slice, and the scopes cover what the rules cover', async () => {
    const { rulesCovering, unscopedRules } = await packChecks();
    for (const packs of ALL_PACKS) {
      const dir = project();
      const run = install(kit, 'apply', dir, '--packs', packs.join(','));
      assert.equal(run.status, 0, run.output);
      const rules = installedPackRules(dir, packs);
      const buildSlice = readFileSync(join(dir, '.claude/skills/build-slice/SKILL.md'), 'utf8');
      assert.deepEqual(unscopedRules(rules, [buildSlice]), [], `installed with ${packs}: a pack rule loads for no file and is named nowhere`);
      const testFile = rulesCovering('src/Test/Unit/Feature.Tests/ExportTests.cs', rules);
      assert.ok(testFile.includes('testing-for-agents'), `installed with ${packs}: testing-for-agents does not cover a test file (${testFile})`);
      const domainFile = rulesCovering('src/Core/Domain/Export.cs', rules);
      assert.ok(!domainFile.includes('testing-for-agents'), `installed with ${packs}: testing-for-agents covers a domain file`);
    }
  });

  // 2.5.7 (BR-40, BR-42): the pack rules per file are in the todo list; the recap names a deviation only.
  // 2.6.0 (BR-58, AC-61): build-slice says once that the guidelines, the project's rules under .claude/rules/ (the
  // installed pack rules among them), apply to every line; no todo list and no recap; spec-reviewer still checks them.
  test('AC-39: build-slice applies the project\'s rules, the pack rules among them, to every line and records what differs; spec-reviewer checks the pack rules', () => {
    const text = skill('build-slice');
    assert.match(text, /guidelines apply to every line: the project's rules under `\.claude\/rules\/`/i, 'build-slice does not apply the project\'s rules to every line');
    assert.match(section(text, 'The record is the final answer'), /anything that differs from the spec/i, 'the record does not name what differs');
    assert.ok(!existsSync(join(KIT, RECAP_TEMPLATE)), 'the recap template is still shipped');
    const reviewer = section(read('.claude/agents/spec-reviewer.md'), 'What to do');
    assert.match(reviewer, /pack rules[^\n]*`paths`[^\n]*match/i, 'spec-reviewer does not check the diff against the pack rules whose paths match');
  });

  // 2.5.7 (BR-41, AC-44): the separate loop is gone; Refactor reads the Analyzer warnings filter on the slice gate's own build output.
  // 2.6.0 (BR-58, AC-61): build-slice has no analysis step of any kind; the slice gate's own run, fixed until green, is it.
  test('outer test (AC-40, now AC-44, 2.6.0: AC-61): build-slice runs no separate analysis build: it fixes what the slice gate reports until it is green', () => {
    const text = skill('build-slice');
    assert.doesNotMatch(text, /^\d+\. \*\*Code analysis/m, 'build-slice still has a Code analysis step');
    assert.doesNotMatch(text, /Analyzer warnings|filtered build/i, 'build-slice still runs a filtered analysis build');
    assert.match(section(text, 'Verification is the gate'), /until it is green, fixing what it reports/i, 'build-slice does not fix what the gate reports');
  });

  test('AC-40, now AC-44 (3.0.0: no Analyzer warnings filter): the Project settings name the formatter, the recap template is gone and the rules\' Build phase names no loop', () => {
    const settings = read(SETTINGS_TEMPLATE);
    assert.doesNotMatch(settings, /\*\*Analyzer warnings\*\*/, 'the Project settings still carry the Analyzer warnings filter');
    assert.match(lineOf(settings, /^- \*\*Formatter\*\*/, 'the Formatter line'), /`dotnet format/, 'the Formatter line does not name dotnet format');
    assert.ok(!existsSync(join(KIT, RECAP_TEMPLATE)), 'the recap template is still shipped');
    assert.doesNotMatch(lineOf(read(RULES_FILE), /^\| 4\. Build/, 'the rules\' Build phase'), /code.analysis loop/i, 'the rules\' Build phase still names the loop');
  });

  // 2.6.0 (BR-58, BR-60, AC-61, AC-62): the per-slice server analysis is retired; the project's Analysis runs once, in the
  // final review in new-feature, quality gate included, and names what is missing when it cannot run.
  // 2.6.1 (D19, BR-67, AC-69, the owner's correction of 2026-11-24): the analysis stays once per feature, in the final
  // review, as in 2.6.0.
  test('outer test (AC-41, 2.6.0: AC-61, AC-62, 2.6.1: AC-69): no per-slice analysis in build-slice; new-feature\'s final review runs the Analysis once with the quality gate and names what is missing', () => {
    for (const term of [SERVER_ANALYSIS, /\*\*Analysis\*\*|code analysis/i]) assert.doesNotMatch(skill('build-slice'), term, 'build-slice still runs a per-slice analysis');
    const analysis = lineOf(step(section(skill('new-feature'), 'Workflow'), 'Review'), /^\s+- the code analysis/, 'the code analysis bullet');
    for (const term of [/\*\*Analysis\*\*/, /\*\*Fix analysis\*\*/, /feature gate again/i, /cannot run, say what is missing and why/i, /no code analysis declared/i]) {
      assert.match(analysis, term, `new-feature's code analysis does not say ${term}`);
    }
  });

  test('AC-41 (2.6.0: AC-62, 2.6.1: AC-69): the rules have no per-slice analysis stop; the Analysis line runs once per feature, in the final review, and names what it needs', () => {
    assert.doesNotMatch(section(read(RULES_FILE), 'Where Claude stops'), SERVER_ANALYSIS, 'the rules still stop on a missing slice analysis');
    const analysis = lineOf(read(SETTINGS_TEMPLATE), /^- \*\*Analysis\*\*/, 'the Analysis line');
    for (const term of [/run once per feature, in the final review/i, /no server/i]) assert.match(analysis, term, `the Analysis line does not say ${term}`);
    assert.doesNotMatch(analysis, /once per slice|slice gate|slice stops/i, 'the Analysis line still runs per slice');
    assert.ok(!existsSync(join(KIT, RECAP_TEMPLATE)), 'the recap template is still shipped');
  });

  // 2.5.7 (BR-41, BR-44): the README's Build row names the gate's own build output, no loop; the version moves to 2.5.7.
  // 2.6.0 (BR-58, BR-62): the README's Build row applies the guidelines to every line; its Verify and check row runs no analysis per slice.
  // 2.6.1 (BR-67, AC-69, the owner's correction of 2026-11-24): the README's Verify and check row says the analysis runs
  // once per feature, in the final review, never per slice.
  test('outer test (AC-42): the rules name no per-slice analysis; the README applies the guidelines and runs no analysis per slice; the version is the kit\'s; CHANGELOG 2.5.6 with upgrade notes; hooks pinned', () => {
    const rules = read(RULES_FILE);
    assert.doesNotMatch(rules, /once per slice/i, 'the rules still name a per-slice analysis');
    const readme = read('README.md');
    const build = lineOf(readme, /^\| Build \|/, 'the README\'s Build row');
    assert.match(build, /guidelines apply to every line/i, 'the README\'s Build row does not apply the guidelines');
    const verifyRow = lineOf(readme, /^\| Verify and check \|/, 'the README\'s Verify and check row');
    for (const term of [SERVER_ANALYSIS, /once for the slice|once per slice/i]) assert.doesNotMatch(verifyRow, term, 'the README\'s Verify row still names a per-slice analysis');
    assert.match(verifyRow, /code analysis[^\n]*once per feature[^\n]*final review/i, 'the README\'s Verify row does not say the analysis runs once per feature, in the final review');
    assert.equal(rules.split(/\r?\n/)[0], `<!-- spec-driven-kit ${VERSION} -->`, `the rules file is not ${VERSION}`);
    assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, VERSION, `plugin.json is not ${VERSION}`);
    const changelog = read('CHANGELOG.md');
    const [newest, previous] = positions(changelog, [/^## 2\.5\.6 /m, /^## 2\.5\.5 /m]);
    assert.ok(newest < previous, 'the 2.5.6 entry is not the newest');
    const entry = changelog.slice(newest, previous);
    for (const term of [/BR-36/, /`paths:`/, /`globMatches`/, /3\.0\.0/]) {
      assert.match(entry, term, `the 2.5.6 entry does not say ${term}`);
    }
    assertHooksPinned(); // 2.5.8 (BR-47): verify.mjs pinned at 2.5.8, guard.mjs at 6ba02be.
  });
});

// Slice 15: kit 2.5.7 (amended 2026-11-23, BR-40 to BR-44, AC-43 to AC-47): adopted experiment 1 of the owner's harness
// experiments (the owner's benchmark: 5.57 to 4.78 USD, 149 to 121 turns, quality held). No slice-plan file, no separate
// analysis build, a recap that does not repeat the spec, no leftover verifier.

const TODO_LIST = /todo list/i;
/** Names of the retired slice plan: the file, its template, and the plan as a document. */
const SLICE_PLAN_NAMES = /slice-<n>-plan\.md|slice-plan-template|slice plan\b|slice's plan\b|each slice plan/i;
/** The 2.5.6 slice-plan template as a 2.5.6 install left it in a project, recorded as the kit's. */
const PLAN_TEMPLATE_256 = '# Slice <n> plan: <slice name>\n\nWritten by build-slice after the user\'s go for this slice.\n';
const TESTING_FOR_AGENTS = 'packs/dotnet-shared/rules/testing-for-agents.md';

/** Every Markdown file of the packs (rules, agents, skills), relative to the kit. */
function packFiles() {
  return readdirSync(join(KIT, 'packs'), { recursive: true })
    .map((rel) => `packs/${String(rel).replaceAll('\\', '/')}`)
    .filter((rel) => rel.endsWith('.md'));
}

describe('KitLean slice 15: kit 2.5.7, adopted experiment 1', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('outer test (AC-43): an update of a 2.5.6 install removes the unchanged slice-plan template, nothing else, and leaves the specs\' plan files alone', () => {
    const dir = project();
    assert.equal(install(kit, 'apply', dir).status, 0);
    writeFileSync(join(dir, SLICE_PLAN_TEMPLATE), PLAN_TEMPLATE_256);
    const recorded = record(dir);
    recorded.files[SLICE_PLAN_TEMPLATE] = sha(PLAN_TEMPLATE_256);
    recorded.kitVersion = '2.5.6';
    writeFileSync(join(dir, RECORD), JSON.stringify(recorded, null, 2));
    mkdirSync(join(dir, '_specs/Export'), { recursive: true });
    writeFileSync(join(dir, '_specs/Export/slice-1-plan.md'), '# Slice 1 plan: Export\n');
    const before = tree(dir);
    const run = install(kit, 'apply', dir);
    assert.equal(run.status, 0, run.output);
    assert.ok(!existsSync(join(dir, SLICE_PLAN_TEMPLATE)), 'the slice-plan template is still in the project');
    assert.match(run.stdout, /^remove\s+\.claude\/templates\/slice-plan-template\.md/m, 'the output does not report the slice-plan template as removed');
    assert.ok(!(SLICE_PLAN_TEMPLATE in record(dir).files), 'the slice-plan template is still recorded');
    const after = tree(dir);
    assert.deepEqual(Object.keys(before).filter((p) => !(p in after)), [SLICE_PLAN_TEMPLATE], 'the update removed other files');
    assert.equal(after['_specs/Export/slice-1-plan.md'], before['_specs/Export/slice-1-plan.md'], 'the update touched a spec\'s plan file');
  });

  test('AC-43: the kit ships no slice-plan template and no kit text names the slice plan, its file or its template', () => {
    assert.ok(!existsSync(join(KIT, SLICE_PLAN_TEMPLATE)), 'the kit still ships the slice-plan template');
    // 2.6.0 (BR-58): build-slice and the README say "no slice plan file", which forbids the plan and is allowed.
    for (const rel of kitTexts()) assert.doesNotMatch(read(rel).replace(/no slice plan file/gi, ''), SLICE_PLAN_NAMES, `${rel} still names the slice plan`);
  });

  // 2.6.0 (BR-58, AC-61): no todo-list step; build-slice works from the Scaffold rows, writes no slice plan file and
  // waits for no approval: the user's go for the slice is all it waits for.
  test('outer test (AC-43, 2.6.0: AC-61): after the go build-slice works from the slice\'s Scaffold rows, the integration test first, writes no plan file and waits for no approval', () => {
    const text = skill('build-slice');
    for (const term of [/Scaffold rows/, /no slice plan file/i, /verify\.mjs --slice/, /guidelines apply to every line/i, NO_BREAK]) assert.match(text, term, `build-slice does not say ${term}`);
    assert.doesNotMatch(text, /TodoWrite|wait[^\n]*approv/i, 'build-slice still has a todo-list step or waits for an approval');
    inOrder(text, [/the user gave the go for/i, /Integration test first/i, /stubs/i, /smallest code/i, /verify\.mjs --slice/], 'build-slice');
  });

  // 2.6.1 (BR-68, AC-70): write-spec and the spec template lose their todo-list leftovers too.
  test('AC-43 (2.6.0: AC-62, 2.6.1: AC-70): the rules, new-feature, the README, build-slice, write-spec and the spec template no longer name the build\'s todo list; spec-reviewer is unchanged', () => {
    const template = read(SPEC_TEMPLATE);
    for (const [where, text] of [['the rules', read(RULES_FILE)], ['new-feature', skill('new-feature')], ['the README\'s workflow', section(read('README.md'), 'The workflow')], ['build-slice', skill('build-slice')],
      ['write-spec', skill('write-spec')], ['the spec template\'s Slices', section(template, 'Slices')], ['the spec template\'s Scaffold', section(template, 'Scaffold')]]) {
      assert.doesNotMatch(text, TODO_LIST, `${where} still names the build's todo list`);
    }
    assert.match(section(template, 'Scaffold'), /Scaffold rows|slice's rows/i, 'the spec template\'s Scaffold no longer says the build works from the rows');
    assert.match(section(read('.claude/agents/spec-reviewer.md'), 'What to do'), /pack rules[^\n]*`paths`[^\n]*match/i, 'spec-reviewer no longer checks the pack rules whose paths match');
  });

  test('outer test (AC-44, 2.6.0: AC-61): build-slice runs no separate analysis build: it fixes what the slice gate reports and runs it again until green', () => {
    const text = skill('build-slice');
    assert.doesNotMatch(text, /^\d+\. \*\*Code analysis/m, 'build-slice still has a Code analysis step before the gate');
    assert.doesNotMatch(text, /code.analysis loop|filtered build|build filtered/i, 'build-slice still runs a filtered build loop');
    assert.match(section(text, 'Verification is the gate'), /until it is green, fixing what it reports/i, 'build-slice does not fix what the gate reports and run it again');
  });

  // 3.0.0: the Analyzer warnings filter is gone with the server analysis; the slice gate's output is read as it is.
  test('AC-44: the Formatter fixes a failed format check, and the rules name no loop', () => {
    const settings = read(SETTINGS_TEMPLATE);
    const formatter = lineOf(settings, /^- \*\*Formatter\*\*/, 'the Formatter line');
    assert.match(formatter, /format check/i, 'the Formatter line does not fix a failed format check');
    assert.doesNotMatch(formatter, /loop/i, 'the Formatter line still runs in a loop');
    const rules = read(RULES_FILE);
    assert.doesNotMatch(rules, /code.analysis loop/i, 'the rules still name an analysis loop');
    // 2.6.0 (BR-59, AC-62): the rules' Build phase leaves the warnings to build-slice and the slice gate.
    assert.match(lineOf(rules, /^\| 4\. Build/, 'the rules\' Build phase'), /slice gate green/i, 'the rules\' Build phase does not end on the slice gate');
  });

  // 2.6.0 (BR-58, BR-61, AC-61, AC-63): the recap template is gone; the record, the build's final answer, holds only the
  // criteria against their tests with the failure seen red, what differs from the spec, and how the user tries it.
  test('outer test (AC-45, 2.6.0: AC-63): no recap template; the record holds only the criteria with their tests, what differs from the spec and how to try it, and no diagram', () => {
    assert.ok(!existsSync(join(KIT, RECAP_TEMPLATE)), 'the recap template is still shipped');
    const record = section(skill('build-slice'), 'The record is the final answer');
    // 2.6.1 (BR-65, BR-66, AC-69): the record also quotes the gate's red line and lists the regression guards; no code
    // analysis per slice (BR-67 as corrected by the owner on 2026-11-24). 2.6.3 (BR-77): the test list follows the criteria.
    // 2.6.4 (BR-81, BR-83): the regression guards give way to the mutation check's score line and survivors.
    assert.deepEqual(record.split(/\r?\n/).filter((l) => /^- /.test(l)).map((l) => l.split(/[:;]/)[0]),
      ['- one line per acceptance criterion', '- the test list (R-1)', '- the slice gate\'s last line, quoted', '- the mutation check\'s score line, and each survivor with its classification and why', '- anything that differs from the spec (an existing test changed, and why)', '- how the user tries it'], 'the record\'s parts');
    assert.doesNotMatch(record, /```/, 'the record has a diagram');
    assert.match(record, /no file/i, 'the record is written to a file');
  });

  // 2.6.1 (BR-68, AC-70): T-11 names the build's record, no recap.
  test('AC-45 (2.6.0: AC-61, 2.6.1: AC-70): the record does not repeat the spec and gives the failure seen red per criterion; T-11 of the pack names the record', () => {
    const record = section(skill('build-slice'), 'The record is the final answer');
    assert.doesNotMatch(record, /What you can do now|How it is built|What to review|\*\*Proof\*\*|Scaffold rows/i, 'the record repeats the spec');
    assert.match(record, /failure message seen when that test was red/i, 'the record does not give the failure seen red');
    const t11 = lineOf(read(TESTING_FOR_AGENTS), /^\| T-11 \|/, 'T-11');
    assert.match(t11, /conversation[^\n]*first run|first run[^\n]*conversation/i, 'T-11 does not put the first failures in the conversation');
    assert.match(t11, /the record[^\n]*final answer|final answer[^\n]*the record/i, 'T-11 does not name the build\'s record');
    assert.doesNotMatch(t11, /recap/i, 'T-11 still names the recap');
  });

  test('outer test (AC-46): no kit text and no pack file names a verifier', () => {
    const files = [...kitTexts(), ...packFiles()];
    assert.ok(files.some((rel) => rel.startsWith('packs/') && rel.includes('/rules/')), 'no pack rule was scanned');
    for (const rel of files) assert.doesNotMatch(read(rel), /verifier|agents? that verif/i, `${rel} still names a verifier`);
  });

  // 2.5.8 (BR-48): the version moves on; the 2.5.7 entry stays.
  test('outer test (AC-47): 2.5.7 (now 2.5.8) in the rules and plugin.json; CHANGELOG 2.5.7 with the benchmark figures; the README consistent; hooks pinned', () => {
    const rules = read(RULES_FILE);
    assert.equal(rules.split(/\r?\n/)[0], `<!-- spec-driven-kit ${VERSION} -->`, `the rules file is not ${VERSION}`);
    assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, VERSION, `plugin.json is not ${VERSION}`);
    const changelog = read('CHANGELOG.md');
    const [newest, previous] = positions(changelog, [/^## 2\.5\.7 /m, /^## 2\.5\.6 /m]);
    assert.ok(newest < previous, 'the 2.5.7 entry is not the newest');
    const entry = changelog.slice(newest, previous);
    for (const term of [/experiment 1/i, /5\.57/, /4\.78 USD/, /14 %/, /149/, /121 turns/, /11\/11 ACs/, /4\/5/, /BR-40/, /BR-41/, /BR-42/, /BR-43/, /### Upgrade notes/,
      /`slice-plan-template\.md`[^\n]*remov/i, /`slice-<n>-plan\.md`[^\n]*(left alone|leaves|kept)/i, /`verify\.mjs` and `guard\.mjs` are unchanged/]) {
      assert.match(entry, term, `the 2.5.7 entry does not say ${term}`);
    }
    // 2.6.0 (BR-58, BR-62): the README's Build row names the Scaffold rows and no slice plan file; its Verify and check
    // row names the record (each criterion's test with its red failure, what differs, how to try it) and the gate's last line.
    const readme = read('README.md');
    const build = lineOf(readme, /^\| Build \|/, 'the README\'s Build row');
    assert.match(build, /Scaffold rows[^\n]*no slice plan file|no slice plan file[^\n]*Scaffold rows/i, 'the README\'s Build row does not build from the Scaffold rows without a plan file');
    assert.doesNotMatch(readme, /code.analysis loop/i, 'the README still names the analysis loop');
    const verify = lineOf(readme, /^\| Verify and check \|/, 'the README\'s Verify and check row');
    for (const term of [/one line per acceptance criterion with the test/i, /differs from the spec/i, /how the user tries it/i, /last line quoted/i]) assert.match(verify, term, `the README's Verify row does not say ${term}`);
    assertHooksPinned(); // 2.5.8 (BR-47): verify.mjs pinned at 2.5.8, guard.mjs at 6ba02be.
  });
});

// Slice 16: kit 2.5.8 (amended 2026-11-24, BR-45 to BR-48, AC-48 to AC-51): adopted experiments 4 and 5 of the owner's
// harness experiments (the owner's benchmark: 4.77 USD against 4.78, 101 turns instead of 121, quality held, a real
// integration test filtered by the slice gate). Test economy, the integration test class first, zero tests is red.

const ONE_CLASS = /one outer integration test class per slice[^\n]*criteria end to end/i;
const BRANCHING_ONLY = /unit tests? only for branching logic the outer test cannot reach cheaply/i;
const ONE_ROW_PER_CASE = /one data-driven test with one row per case the spec names/i;
const NO_PASS_THROUGH = /no tests of pass-through code, registrations, resource keys or helpers the outer test covers/i;
const SEVERAL_PER_TEST = /several criteria (may )?point at one test/i;
const ZERO_TESTS_NOT_DONE = /filter (that )?match(es|ing) zero tests[^\n]*not done/i;
const SUITE_IN_FINAL_REVIEW = /full integration suite runs only in the final review/i;

describe('KitLean slice 16: kit 2.5.8, adopted experiments 4-5', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('outer test (AC-48): build-slice asks one integration test class per slice, unit tests only for unreachable branching logic as one data-driven test, nothing for pass-through code, and several criteria per test', () => {
    // 2.6.0 (BR-58, AC-61): build-slice's economy is the slice's one integration test of its behavior, a unit test for
    // each rule or calculation (the branching logic), nothing else; the record ties each criterion to the test that proves it.
    const building = section(skill('build-slice'), 'Test-driven without exception');
    for (const term of [/the slice's integration test of its behavior/i, /for each rule or calculation, a unit test/i, /every case the rule names/i]) {
      assert.match(building, term, `build-slice does not say ${term}`);
    }
    assert.doesNotMatch(building, /for each (method|class|helper)|every (method|class|helper)/i, 'build-slice asks tests of pass-through code');
    assert.match(section(skill('build-slice'), 'The record is the final answer'), /one line per acceptance criterion: the test that proves it/i, 'the record does not tie each criterion to its test');
    assert.ok(!existsSync(join(KIT, RECAP_TEMPLATE)), 'the recap template is still shipped');
  });

  // 2.6.1 (BR-68, AC-70): the Project settings' Outer test and Unit test lines state 2.6.0's test rules, not the 2.5.8
  // economy; T-13 of the pack keeps it (the packs are changed only where they name the recap).
  test('AC-48 (2.6.1: AC-70): the Project settings\' Outer test and Unit test lines state build-slice\'s test rules, no 2.5.8 economy; testing-for-agents T-13 keeps it; the rules no longer carry it (2.6.0: AC-62)', () => {
    const slices = section(read(RULES_FILE), 'Slices');
    for (const term of [/one outer integration test class[^\n]*end to end/i, BRANCHING_ONLY, NO_PASS_THROUGH]) assert.doesNotMatch(slices, term, `the rules' Slices still say ${term}`);
    const settings = read(SETTINGS_TEMPLATE);
    const outer = lineOf(settings, /^- \*\*Outer test\*\*/, 'the Outer test line');
    for (const term of [/Integration test project/, /only the stubs it needs to compile/i, /seen failing for the right reason/i]) assert.match(outer, term, `the Outer test line does not say ${term}`);
    assert.doesNotMatch(outer, /one outer integration test class per slice|before any stub/i, 'the Outer test line still states the 2.5.8 economy');
    const unit = lineOf(settings, /^- \*\*Unit test\*\*/, 'the Unit test line');
    assert.match(unit, /for each rule or calculation[^\n]*unit test seen failing/i, 'the Unit test line does not ask a unit test seen failing per rule or calculation');
    for (const term of [BRANCHING_ONLY, /one data-driven test[^\n]*one row per case/i, /pass-through/i]) assert.doesNotMatch(unit, term, `the Unit test line still says ${term}`);
    const t13 = lineOf(read(TESTING_FOR_AGENTS), /^\| T-13 \|/, 'T-13');
    for (const term of [/one outer integration test class/i, /several AC ids/i, /data-driven/i, /pass-through/i, /seen red once/i]) assert.match(t13, term, `T-13 does not say ${term}`);
  });

  // 2.6.0 (BR-58, AC-61): the integration test first, in the Integration test project, with only the stubs it needs to
  // compile, seen failing before any production code or unit test; a page test only for rendering, seen red too.
  test('outer test (AC-49, 2.6.0: AC-61): build-slice writes the slice\'s integration test first, in the Integration test project, seen failing before any production code or unit test; a page test only for rendering', () => {
    const building = section(skill('build-slice'), 'Test-driven without exception');
    const first = step(building, 'Integration test first');
    for (const term of [/Integration test project/, /never in the UI test project/i, /only the stubs/i, /seen failing for the right reason/i]) assert.match(first, term, `build-slice's first step does not say ${term}`);
    inOrder(building, [/Integration test first/i, /stubs/i, /unit test seen failing/i, /smallest code/i, /refactor/i], 'build-slice\'s test-driven steps');
    assert.match(building, /page test for rendering/i, 'build-slice does not limit the page test to rendering');
    assert.doesNotMatch(building, /page test[^\n]*(counts as|instead of) the[^\n]*integration test/i, 'build-slice lets a page test count as the slice\'s integration test');
  });

  test('AC-49: the Project settings name the integration test location and the shared presentation test host; the rules leave the order to build-slice (2.6.0: AC-62) and the README puts the integration test first', () => {
    const location = lineOf(read(SETTINGS_TEMPLATE), /^- \*\*Integration test location\*\*/, 'the Integration test location line');
    for (const term of [/shared presentation test host/i, /first slice that needs it/i, /wires the container the way the app's entry point does/i, /API integration test/i]) {
      assert.match(location, term, `the Integration test location line does not say ${term}`);
    }
    assert.match(lineOf(read(RULES_FILE), /^\| 4\. Build/, 'the rules\' Build phase'), /test-driven/i, 'the rules\' Build phase is not test-driven');
    assert.match(lineOf(read('README.md'), /^\| Build \|/, 'the README\'s Build row'), /integration test first/i, 'the README\'s Build row does not put the integration test first');
  });

  test('outer test (AC-50): a slice gate whose filter matches zero tests is red, says so, stops there and leaves no verified tree, so the unchanged guard does not trust it and runs every command itself before a recap', () => {
    const dir = gateProject(kit);
    const run = verify(dir, '--slice', 'ExportTests.Missing');
    assert.equal(run.status, 1, `a slice gate on zero tests passed: ${run.output}`);
    assert.match(run.output, /zero tests/i, 'the output does not say the filter matched zero tests');
    assert.deepEqual(ran(dir), [['build'], ['unit'], ['ui'], ['it', '--only', 'ExportTests.Missing']], 'the gate did not stop at the integration command');
    assert.equal(stateOf(dir).verifiedFingerprint, undefined, 'a slice gate on zero tests left a verified tree');
    recapWrite(dir);
    assert.deepEqual(ran(dir), [['build'], ['unit'], ['ui'], ['it'], ['format']], 'the guard took the zero-tests slice gate as verified instead of running every command');
  });

  test('AC-50: the project\'s verify.integration.noTests pattern is honoured; a filter that runs tests and the feature gate pass as before', () => {
    const own = gateProject(kit, { ...INTEGRATION, noTests: 'Nothing to run' });
    assert.equal(verify(own, '--slice', 'ExportTests.Quiet').status, 1, 'the project\'s noTests pattern is not honoured');
    ran(own);
    assert.equal(verify(own, '--slice', 'ExportTests.AC1_Csv').status, 0, 'a filter that runs tests is red');
    const plain = gateProject(kit);
    assert.equal(verify(plain, '--slice', 'ExportTests.Quiet').status, 0, 'a message no pattern names fails the gate');
    assert.equal(verify(plain).status, 0, 'the feature gate is red');
  });

  test('AC-50: build-slice, the rules\' Proof and the Project settings take the slice\'s integration test class for --slice, treat zero tests as not done and leave the full suite to the final review', () => {
    // 2.6.0 (BR-58, BR-59): build-slice's gate section names the class and treats zero tests as red; the rules' Proof became Gates.
    const gate = section(skill('build-slice'), 'Verification is the gate');
    for (const term of [/--slice <IntegrationTestClass>`/, /a filter that matches zero tests is red/i]) assert.match(gate, term, `build-slice's gate does not say ${term}`);
    const proof = section(read(RULES_FILE), 'Gates');
    for (const term of [ZERO_TESTS_NOT_DONE, SUITE_IN_FINAL_REVIEW]) assert.match(proof, term, `the rules' Gates do not say ${term}`);
    const settings = read(SETTINGS_TEMPLATE).split('### Verification Commands')[1] ?? '';
    for (const term of [ZERO_TESTS_NOT_DONE, /`verify\.integration\.noTests`/]) assert.match(settings, term, `the Project settings' Verification Commands do not say ${term}`);
  });

  // 2.5.9 (BR-52): the version moves on; the 2.5.8 entry stays, above 2.5.7.
  test('outer test (AC-51): 2.5.8 (now 2.5.9) in the rules and plugin.json; CHANGELOG 2.5.8 with the figures and upgrade notes; guard.mjs unchanged, verify.mjs pinned', () => {
    assert.equal(read(RULES_FILE).split(/\r?\n/)[0], `<!-- spec-driven-kit ${VERSION} -->`, `the rules file is not ${VERSION}`);
    assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, VERSION, `plugin.json is not ${VERSION}`);
    const changelog = read('CHANGELOG.md');
    const [newest, previous] = positions(changelog, [/^## 2\.5\.8 /m, /^## 2\.5\.7 /m]);
    assert.ok(newest < previous, 'the 2.5.8 entry is not above 2.5.7');
    const entry = changelog.slice(newest, previous);
    const [body, notes] = entry.split(/^### Upgrade notes/m);
    for (const term of [/experiments 4 and 5/i, /4\.77 USD/, /4\.78/, /101 turns/, /121/, /11\/11 ACs/, /4\/5/, /real integration test/i, /BR-45/, /BR-46/, /BR-47/,
      /`verify\.mjs`[^\n]*zero-tests check/i, /`guard\.mjs` is unchanged/]) {
      assert.match(body, term, `the 2.5.8 entry does not say ${term}`);
    }
    assert.ok(notes, 'the 2.5.8 entry has no upgrade notes');
    for (const term of [/\*\*Integration test location\*\*/, /presentation test host/i, /`verify\.integration\.noTests`/]) assert.match(notes, term, `the upgrade notes do not say ${term}`);
    assertHooksPinned();
  });
});

// Slice 17: kit 2.5.9 (amended 2026-11-24, BR-49 to BR-52, AC-52 to AC-55): adopted experiment 7 of the owner's
// harness experiments (the owner's benchmark: 4.77 to 4.11 USD, re-read context 9.5 M to 6.9 M tokens, quality held).
// Output diet, reading diet, every test seen red first. Integration: the installed verify.mjs and the unchanged guard.

/** A command script: passing commands print noise; the integration command, with red.flag committed, prints noise, two
 * failed tests in the `dotnet test` (VSTest) form, then 100 more lines, and exits 1. */
const NOISY = [
  "import { existsSync } from 'node:fs';",
  'const [name] = process.argv.slice(2);',
  "const say = (prefix, n) => { for (let i = 1; i <= n; i += 1) console.log(`${prefix}-${i}`); };",
  "if (name !== 'it' || !existsSync('red.flag')) { say(`${name.toUpperCase()}-NOISE`, 50); process.exit(0); }",
  "say('IT-HEAD', 10);",
  "console.log('  Failed ExportTests.AC1_Csv [12 ms]');",
  "console.log('  Error Message:');",
  "console.log('   Assert.AreEqual failed. Expected:<1>. Actual:<2>.');",
  "console.log('  Stack Trace:');",
  "console.log('     at ExportTests.AC1_Csv() in ExportTests.cs:line 10');",
  "console.log('  Failed ExportTests.AC2_Guard [3 ms]');",
  "console.log('  Error Message:');",
  "console.log('   Assert.IsTrue failed. The guard let =1+1 through.');",
  "say('IT-TAIL', 100);",
  'process.exit(1);',
].join('\n');
const NOISY_STEPS = ['build', 'unit', 'it', 'format'].map((name) => `node noisy.mjs ${name}`);

/** A gate project whose commands are NOISY_STEPS; red: the integration command fails. */
function noisyProject(kit, red) {
  const dir = gateProject(kit, null);
  const file = join(dir, '.claude/spec-driven.json');
  const config = JSON.parse(readFileSync(file, 'utf8'));
  config.verify.commands = NOISY_STEPS;
  writeFileSync(file, JSON.stringify(config, null, 2));
  writeFileSync(join(dir, 'noisy.mjs'), NOISY);
  if (red) writeFileSync(join(dir, 'red.flag'), 'red\n');
  sliceGit(dir, ['add', '-A']);
  sliceGit(dir, ['commit', '-q', '-m', 'noisy']);
  return dir;
}

const QUIET_BUILD = /`dotnet build -v q -nologo`/;
const QUIET_TESTS = /--no-ansi --progress off --show-stdout Failed --show-stderr Failed/;
const STILL_LISTS = /still list(s)? (the )?warnings, errors and failing tests/i;
const PAGE_TEST_RED = /(component or page|page or component) tests?[^\n]*before (its|their) code[^\n]*seen red/i;

describe('KitLean slice 17: kit 2.5.9, adopted experiment 7', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('outer test (AC-52): a red gate prints one line per command, the failing tests with their first assertion line, at most 30 lines of output and the verdict; exit code and state as before; the guard still gets the last 40 lines', () => {
    const dir = noisyProject(kit, true);
    const run = verify(dir);
    assert.equal(run.status, 1, run.output);
    const lines = run.output.trimEnd().split(/\r?\n/);
    assert.equal(lines.filter((l) => /^PASS\s/.test(l)).length, 2, `not one PASS line per passing command:\n${run.output}`);
    assert.equal(lines.filter((l) => /^FAIL\s/.test(l)).length, 1, `not one FAIL line:\n${run.output}`);
    assert.doesNotMatch(run.output, /NOISE/, 'the output of a passing command is printed');
    assert.match(run.output, /ExportTests\.AC1_Csv[^\n]*\n?[^\n]*Assert\.AreEqual failed\. Expected:<1>\. Actual:<2>\./, 'the first failing test and its assertion line are not listed');
    assert.match(run.output, /ExportTests\.AC2_Guard[^\n]*\n?[^\n]*Assert\.IsTrue failed\. The guard let =1\+1 through\./, 'the second failing test and its assertion line are not listed');
    assert.doesNotMatch(run.output, /Stack Trace|IT-HEAD/, 'more than the assertion line and the excerpt is printed');
    const excerpt = lines.filter((l) => /^IT-TAIL-\d+$/.test(l));
    assert.ok(excerpt.length > 0 && excerpt.length <= 30, `the excerpt is not 1 to 30 lines: ${excerpt.length}`);
    assert.equal(excerpt.at(-1), 'IT-TAIL-100', 'the excerpt does not end with the command\'s last line');
    assert.match(lines.at(-1), /^Verification red: feature gate/, `the last line is not the verdict: ${lines.at(-1)}`);
    assert.ok(lines.length <= 3 + 1 + 2 * 2 + 30 + 2, `the output is longer than the diet allows: ${lines.length} lines`);
    const state = stateOf(dir);
    assert.equal(state.failed, 'node noisy.mjs it', 'the state does not record the failed command');
    assert.equal(state.verifiedFingerprint, undefined, 'a red gate left a verified tree');
    const refused = recapWrite(dir);
    assert.equal(refused.status, 2, `the guard let the recap pass: ${refused.stderr}`);
    assert.match(refused.stderr, /IT-TAIL-61\b/, 'the guard no longer gets the last 40 lines of the failing command');
    assert.doesNotMatch(refused.stderr, /IT-TAIL-60\b/, 'the guard gets more than the last 40 lines');
  });

  test('AC-52: --verbose prints every command\'s full output; a green gate prints only its PASS lines and the verdict, exits 0 and records the verified tree', () => {
    const red = noisyProject(kit, true);
    const verbose = verify(red, '--verbose');
    assert.equal(verbose.status, 1, verbose.output);
    for (const line of ['BUILD-NOISE-1', 'UNIT-NOISE-50', 'IT-HEAD-1', 'Stack Trace:', 'IT-TAIL-1', 'IT-TAIL-100']) assert.match(verbose.output, new RegExp(`^\\s*${line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'), `--verbose does not print ${line}`);
    assert.equal(verify(red, '--slice', 'ExportTests', '--verbose').status, 1, '--verbose after --slice is not accepted');
    const green = noisyProject(kit, false);
    const run = verify(green);
    assert.equal(run.status, 0, run.output);
    assert.doesNotMatch(run.output, /NOISE/, 'a green gate prints the commands\' output');
    const lines = run.output.trimEnd().split(/\r?\n/);
    assert.equal(lines.filter((l) => /^PASS\s/.test(l)).length, NOISY_STEPS.length, 'not one PASS line per command');
    assert.match(lines.at(-1), /^Verification green: feature gate/, 'the last line is not the verdict');
    assert.ok(stateOf(green).verifiedFingerprint, 'a green gate does not record the verified tree');
  });

  test('AC-52: the failing tests are read from the forms of dotnet test, the Microsoft testing platform, Jest, pytest and node\'s TAP output', async () => {
    const { failingTests } = await import(pathToFileURL(join(KIT, 'hooks/verify.mjs')).href);
    const rows = [
      ['dotnet test (VSTest)', '  Failed ExportTests.AC1_Csv [12 ms]\n  Error Message:\n   Assert.AreEqual failed. Expected:<1>. Actual:<2>.\n  Stack Trace:\n     at X', [['ExportTests.AC1_Csv', 'Assert.AreEqual failed. Expected:<1>. Actual:<2>.']]],
      ['Microsoft testing platform', 'failed ExportTests.AC2_Guard (8ms)\n  Assert.IsTrue failed. Expected true.\n    at ExportTests.AC2_Guard()', [['ExportTests.AC2_Guard', 'Assert.IsTrue failed. Expected true.']]],
      ['Jest', '  ● Export › writes a CSV\n\n    expect(received).toBe(expected) // Object.is equality\n\n    Expected: 1', [['Export › writes a CSV', 'expect(received).toBe(expected) // Object.is equality']]],
      ['pytest', 'FAILED tests/test_export.py::test_csv - AssertionError: assert 1 == 2\n==== 1 failed in 0.1s ====', [['tests/test_export.py::test_csv', 'AssertionError: assert 1 == 2']]],
      ['node TAP', "not ok 3 - writes a CSV\n  ---\n  duration_ms: 1.2\n  failureType: 'testCodeFailure'\n  error: 'Expected values to be strictly equal:'\n  ...", [['writes a CSV', "error: 'Expected values to be strictly equal:'"]]],
      ['a passing run', 'Passed!  - Failed:     0, Passed:    12, Skipped:     0, Total:    12', []],
    ];
    for (const [form, output, expected] of rows) {
      assert.deepEqual(failingTests(output).map((t) => [t.name, t.assertion]), expected, `the ${form} form is not read`);
    }
  });

  test('AC-52: the Project settings template and build-slice ask for quiet commands that still list warnings, errors and failing tests; build-slice names --verbose', () => {
    const settings = read(SETTINGS_TEMPLATE).split('### Verification Commands')[1] ?? '';
    for (const term of [QUIET_BUILD, QUIET_TESTS, STILL_LISTS, /output only for failed tests/i]) assert.match(settings, term, `the Project settings' Verification Commands do not say ${term}`);
    // 2.6.0 (BR-58, AC-61): build-slice says it in one line (quiet build and test commands); the gate's output format and
    // `--verbose` are the Project settings' and verify.mjs's, unchanged.
    const text = skill('build-slice');
    assert.match(text, /use quiet build and test commands/i, 'build-slice does not ask for quiet commands');
    assert.match(text, /Quote its last line/i, 'build-slice does not read the gate\'s verdict line');
    assert.match(settings, /`--verbose`/, 'the Project settings do not name --verbose');
  });

  // 2.6.0 (BR-58, AC-61): one line in build-slice: read each file once, located with Grep or Glob first, the range needed.
  test('outer test (AC-53, 2.6.0: AC-61): build-slice reads each file once, located with Grep or Glob first, only the range it needs', () => {
    const text = skill('build-slice');
    for (const term of [/Read each file once/i, /Grep or Glob first/i, /the range you need/i]) assert.match(text, term, `build-slice does not say ${term}`);
    assert.doesNotMatch(text, /\b(cat|type|Get-Content) /, 'build-slice prints files through the shell');
  });

  test('outer test (AC-54): a page test is written before its code and seen red, in build-slice and the Project settings\' UI test line; the rules leave it to build-slice (2.6.0: AC-62)', () => {
    assert.match(skill('build-slice'), /page test[^\n]*before its code and seen red/i, 'build-slice does not see a page test red first');
    assert.doesNotMatch(section(read(RULES_FILE), 'Slices'), PAGE_TEST_RED, 'the rules\' Slices still carry the build\'s page-test rule');
    assert.match(lineOf(read(SETTINGS_TEMPLATE), /^- \*\*UI test\*\*/, 'the UI test line'), PAGE_TEST_RED, 'the UI test line does not see a page test red first');
  });

  test('outer test (AC-55): 2.5.9 (now 2.5.10) in the rules and plugin.json; CHANGELOG 2.5.9 with the figures, experiment 6 and upgrade notes; the README consistent; guard.mjs unchanged, verify.mjs pinned', () => {
    // 2.5.10 (BR-54): the version moves on; the 2.5.9 entry stays, above 2.5.8.
    assert.equal(read(RULES_FILE).split(/\r?\n/)[0], `<!-- spec-driven-kit ${VERSION} -->`, `the rules file is not ${VERSION}`);
    assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, VERSION, `plugin.json is not ${VERSION}`);
    const changelog = read('CHANGELOG.md');
    const [newest, previous] = positions(changelog, [/^## 2\.5\.9 /m, /^## 2\.5\.8 /m]);
    assert.ok(newest < previous, 'the 2.5.9 entry is not above 2.5.8');
    const [body, notes] = changelog.slice(newest, previous).split(/^### Upgrade notes/m);
    for (const term of [/experiment 7/i, /4\.77/, /4\.11 USD/, /14 %/, /9\.5 M/, /6\.9 M/, /27 %/, /11\/11 ACs/, /4\/5/, /real integration test/i, /experiment 6/i, /55 %/, /1 %/,
      /BR-49/, /BR-50/, /BR-51/, /`verify\.mjs`[^\n]*only (in )?(its|what it prints)/i, /`guard\.mjs` is unchanged/]) {
      assert.match(body, term, `the 2.5.9 entry does not say ${term}`);
    }
    assert.ok(notes, 'the 2.5.9 entry has no upgrade notes');
    for (const term of [/`verify\.commands`/, QUIET_BUILD, /`--verbose`/]) assert.match(notes, term, `the upgrade notes do not say ${term}`);
    const readme = read('README.md');
    for (const term of [/one line per command/i, /`--verbose`/, /Grep or Glob first/i, /re-read/i]) assert.match(readme, term, `the README does not say ${term}`);
    assertHooksPinned();
  });
});

// Slice 18: kit 2.5.10 (amended 2026-11-24, BR-53 and BR-54, AC-56 and AC-57): one statement on slice review. The
// owner's harness experiments of 2026-11-24 found two benchmark builds from the same base diverging on whether a
// slice-verifier ran after the slice gate (4.11 against 5.62 USD, the sub-agent's report lost). Decision (D13, D6-D7):
// after the slice gate no agent reviews a slice; a slice review agent left by an older kit runs only on the user's request.

const NO_SLICE_REVIEW = /after the slice gate no agent reviews the slice/i;
const ON_REQUEST_ONLY = /only when the user asks for it, never by the build on its own/i;
/** A text that tells the build to have an agent review a slice: the retired agent's name, or a verifier at all. */
const SLICE_REVIEW_AGENT = /slice-verifier|\bverifier\b/i;

/** Every installed text file under the project's .claude/, as relative paths. */
function installedTexts(dir) {
  return Object.keys(tree(dir)).filter((rel) => rel.startsWith('.claude/') && /\.(md|mjs|json)$/.test(rel) && rel !== RECORD);
}

describe('KitLean slice 18: kit 2.5.10, one statement on slice review', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  // 3.0.0: the 2.2.0 fixtures of the removed packs are gone; the 2.1.0 fixture carries the same contradiction.
  test('outer test (AC-56): no installed text, after an install or an update from 2.1.0, tells the build to run a slice verifier; the installed rules, build-slice and new-feature say no agent reviews a slice after the slice gate', () => {
    const fresh = project();
    assert.equal(install(kit, 'apply', fresh).status, 0);
    const updated = project('project-2.1.0');
    assert.match(readFileSync(join(updated, RULES_FILE), 'utf8'), /`slice-verifier` checks each slice/, 'the 2.1.0 fixture no longer carries the contradiction');
    const run = install(kit, 'apply', updated, '--packs', 'dotnet-shared');
    assert.equal(run.status, 0, run.output);
    for (const dir of [fresh, updated]) {
      for (const rel of installedTexts(dir)) assert.doesNotMatch(readFileSync(join(dir, rel), 'utf8'), SLICE_REVIEW_AGENT, `${rel} still names a slice verifier`);
      // 2.6.0 (BR-58, AC-61): build-slice says it in its own words, "no reviewing agent per slice".
      for (const rel of [RULES_FILE, '.claude/skills/new-feature/SKILL.md']) {
        const text = readFileSync(join(dir, rel), 'utf8');
        assert.match(text, NO_SLICE_REVIEW, `the installed ${rel} does not say that no agent reviews a slice after the slice gate`);
        assert.match(text, ON_REQUEST_ONLY, `the installed ${rel} does not run a slice review agent only on the user's request`);
      }
      assert.match(readFileSync(join(dir, '.claude/skills/build-slice/SKILL.md'), 'utf8'), /no reviewing agent per slice/i, 'the installed build-slice may have a slice reviewed by an agent');
    }
  });

  test('AC-56: the rules (Check, Gates, Tooling), build-slice, new-feature and the README say the same thing', () => {
    const rules = read(RULES_FILE);
    // 2.6.0 (BR-59): the Verify and approve row became the Check row, the Proof section became Gates.
    assert.match(lineOf(rules, /^\| 5\. Check/, 'the Check row'), NO_SLICE_REVIEW, 'the rules\' Check row does not say it');
    for (const name of ['Gates', 'Tooling']) {
      const part = section(rules, name);
      assert.match(part, NO_SLICE_REVIEW, `the rules' ${name} does not say it`);
      assert.match(part, ON_REQUEST_ONLY, `the rules' ${name} does not say it`);
    }
    assert.match(skill('build-slice'), /no reviewing agent per slice/i, 'build-slice may have a slice reviewed by an agent');
    for (const term of [NO_SLICE_REVIEW, ON_REQUEST_ONLY]) assert.match(skill('new-feature'), term, `new-feature does not say ${term}`);
    const readme = read('README.md');
    assert.match(lineOf(readme, /^\| Verify and check/, 'the README\'s Verify and check row'), NO_SLICE_REVIEW, 'the README\'s Verify and check row does not say it');
    assert.match(readme, ON_REQUEST_ONLY, 'the README does not run a slice review agent only on the user\'s request');
    for (const rel of kitTexts()) assert.doesNotMatch(read(rel), SLICE_REVIEW_AGENT, `${rel} names a slice verifier`);
  });

  test('outer test (AC-57): 2.5.10 in the rules and plugin.json; CHANGELOG 2.5.10 above 2.5.9 with the evidence and an upgrade note; guard.mjs unchanged, verify.mjs pinned', () => {
    // 2.5.11 (BR-57): the version moves on; the 2.5.10 entry stays, above 2.5.9.
    assert.equal(read(RULES_FILE).split(/\r?\n/)[0], `<!-- spec-driven-kit ${VERSION} -->`, `the rules file is not ${VERSION}`);
    assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, VERSION, `plugin.json is not ${VERSION}`);
    const changelog = read('CHANGELOG.md');
    const [newest, previous] = positions(changelog, [/^## 2\.5\.10 /m, /^## 2\.5\.9 /m]);
    assert.ok(newest < previous, 'the 2.5.10 entry is not above 2.5.9');
    const [body, notes] = changelog.slice(newest, previous).split(/^### Upgrade notes/m);
    for (const term of [/4\.11 USD/, /5\.62 USD/, /report[^\n]*lost/i, /slice gate/i, /BR-53/, /BR-54/, /`guard\.mjs`[^\n]*unchanged/, /`verify\.mjs`[^\n]*unchanged/]) {
      assert.match(body, term, `the 2.5.10 entry does not say ${term}`);
    }
    assert.ok(notes, 'the 2.5.10 entry has no upgrade notes');
    assert.match(notes, /`slice-verifier`/, 'the upgrade notes do not name the agent a project may still have');
    assert.match(notes, /modified|changed copy|own copy/i, 'the upgrade notes do not say a changed copy is kept by the update');
    assertHooksPinned();
  });
});

// Slice 19: kit 2.5.11 (amended 2026-11-24, BR-55 to BR-57, AC-58 to AC-60): an experiment base kept kit 2.2.0 texts
// through several updates without anyone being told, and two builds from it differed by 37 % in cost. The installer
// now lists, after plan and after apply, every kit file it keeps because the project changed it; the kit's own stale
// .claude/hooks/guard.mjs copy, never installed and used by nothing, is gone.

const KEPT = (rel) => `kept, differs from kit ${VERSION}: ${rel}`;
const NO_KEPT = 'no kept file differs from the kit';
const keptLines = (stdout) => stdout.split(/\r?\n/).filter((line) => line.startsWith('kept, differs from kit '));
const PROJECT_EDIT = "\n<!-- the project's edit -->\n";

describe('KitLean slice 19: kit 2.5.11, the installer lists kept files that differ from the kit', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('outer test (AC-58): plan and apply list exactly the two changed kit files, not the collision nor the overwritten file, with a closing count; plan writes nothing, apply keeps both; exit 0', () => {
    const dir = project();
    assert.equal(install(kit, 'apply', dir).status, 0);
    const changed = ['.claude/skills/build-slice/SKILL.md', RULES_FILE];
    const overwritten = '.claude/skills/new-feature/SKILL.md';
    const collision = '.claude/rules/testing-for-agents.md';
    for (const rel of [...changed, overwritten]) writeFileSync(join(dir, rel), readFileSync(join(dir, rel), 'utf8') + PROJECT_EDIT);
    writeFileSync(join(dir, collision), "# The project's own testing rule\n");
    const edited = Object.fromEntries(changed.map((rel) => [rel, sha(readFileSync(join(dir, rel), 'utf8'))]));
    const args = ['--packs', 'dotnet-shared', '--overwrite', overwritten];

    const before = tree(dir);
    const plan = install(kit, 'plan', dir, ...args);
    assert.equal(plan.status, 0, plan.output);
    assert.deepEqual(tree(dir), before, 'plan wrote something');
    const apply = install(kit, 'apply', dir, ...args);
    assert.equal(apply.status, 0, apply.output);

    for (const [name, run] of [['plan', plan], ['apply', apply]]) {
      assert.deepEqual(keptLines(run.stdout).sort(), changed.map(KEPT).sort(), `${name} does not list exactly the two changed kit files:\n${run.stdout}`);
      assert.match(run.stdout, new RegExp(`^2 kept file\\(s\\) differ from kit ${VERSION.replace(/\./g, '\\.')}\\b.*kit folder.*--overwrite <path>`, 'm'), `${name} has no closing line with the count:\n${run.stdout}`);
      assert.ok(!run.stdout.includes(NO_KEPT), `${name} says no kept file differs`);
    }
    for (const rel of changed) assert.equal(sha(readFileSync(join(dir, rel), 'utf8')), edited[rel], `apply replaced ${rel}`);
    assert.equal(sha(readFileSync(join(dir, overwritten), 'utf8')), sha(readFileSync(join(kit, overwritten), 'utf8')), 'the overwritten file is not the kit\'s copy');
  });

  test('AC-58: a project whose kit files are all the kit\'s prints "no kept file differs from the kit" once after plan and once after apply', () => {
    const dir = project();
    for (const command of ['apply', 'plan', 'apply']) {
      const run = install(kit, command, dir);
      assert.equal(run.status, 0, run.output);
      assert.equal(run.stdout.split(/\r?\n/).filter((line) => line === NO_KEPT).length, 1, `${command} does not print the line once:\n${run.stdout}`);
      assert.deepEqual(keptLines(run.stdout), [], `${command} lists a kept file`);
    }
  });

  test('AC-59: the kit has no .claude/hooks/guard.mjs of its own; a level 2 install still installs the guard from hooks/', () => {
    assert.ok(!existsSync(join(KIT, '.claude/hooks/guard.mjs')), 'the kit still has its stale .claude/hooks/guard.mjs');
    const dir = project();
    const run = install(kit, 'apply', dir, '--level', '2');
    assert.equal(run.status, 0, run.output);
    assert.equal(sha(readFileSync(join(dir, '.claude/hooks/guard.mjs'), 'utf8')), sha(read('hooks/guard.mjs')), 'the installed guard is not hooks/guard.mjs');
  });

  test('outer test (AC-60): 2.5.11 (now 2.6.0) in the rules and plugin.json; CHANGELOG 2.5.11 above 2.5.10 with the reason and an upgrade note; both hooks pinned', () => {
    // 2.6.0 (BR-62): the version moves on; the 2.5.11 entry stays, above 2.5.10.
    assert.equal(read(RULES_FILE).split(/\r?\n/)[0], `<!-- spec-driven-kit ${VERSION} -->`, `the rules file is not ${VERSION}`);
    assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, VERSION, `plugin.json is not ${VERSION}`);
    const changelog = read('CHANGELOG.md');
    const [newest, previous] = positions(changelog, [/^## 2\.5\.11 /m, /^## 2\.5\.10 /m]);
    assert.ok(newest < previous, 'the 2.5.11 entry is not above 2.5.10');
    const [body, notes] = changelog.slice(newest, previous).split(/^### Upgrade notes/m);
    for (const term of [/2\.2\.0/, /37 %/, /`kept, differs from kit/, /`no kept file differs from the kit`/, /`--overwrite/, /BR-55/, /BR-56/,
      /`\.claude\/hooks\/guard\.mjs`[^\n]*(removed|deleted)/i, /`hooks\/`[^\n]*unchanged/]) {
      assert.match(body, term, `the 2.5.11 entry does not say ${term}`);
    }
    assert.ok(notes, 'the 2.5.11 entry has no upgrade notes');
    assert.match(notes, /`--overwrite/, 'the upgrade notes do not say how to take the kit version');
    assertHooksPinned();
  });
});

// Slice 20: kit 2.6.0, slim build (amended 2026-11-24, D18, BR-58 to BR-62, AC-61 to AC-65). On the benchmark project,
// slice 1 of the CSV export: full kit 2.5.9 4.29 USD, 11/11, 10/10 breaks caught; a minimal harness with the approved
// spec 3.96 USD, 10/11, 10/10; the same without a spec 5/11, 8/10. The spec phase carries the quality; the build
// phase is slimmed: build-slice of at most 45 lines, the build phase out of the always-loaded rules, no recap file.

/** The spec-phase texts 2.6.0 leaves exactly as they were at e590932 (kit 2.5.11). */
const SPEC_PHASE_PINNED = {
  '.claude/skills/investigate/SKILL.md': 'a45435ceca53f2e34fb581bc0176e163c967e8f31aaaef316d153a63b16523eb',
  '.claude/skills/write-spec/SKILL.md': 'e71d0a20bd9165ddb5fe74a494663479817fdfbdd48b36af5fa76355d5855499',
  '.claude/agents/spec-critic.md': '4a568176c928a8c8c1fcbd09509f4765ea06d2f166610a8dd69cb23cd78ccef8',
};
/** 2.6.1 (BR-68): write-spec's two todo-list sentences, as [now, at e590932]. */
const WRITE_SPEC_LEFTOVERS = [
  ["No steps and no code: the build works from each slice's rows.", "No steps and no code: the build derives each slice's steps, in its todo list, from that slice's rows."],
  ["`build-slice` builds it from the slice's Scaffold rows.", "the fine-grained steps live in each slice's todo list, which `build-slice` derives from the slice's Scaffold rows."],
];
const RULES_SPEC_PHASE_PINNED = {
  'Spec Gate': '2e828da84b431b3d86a0204d47014dd2b6d547f763e29ecf258c29bf5b5f0e7d',
  'The spec': '4b3a5aec162796e373fb0b60bc0aa92cbc9d06eab566dfaee44c5f8496e2cc54',
};
const SPEC_PHASE_ROWS_PINNED = '1d492e73b3df0f7d84efe32ae3fbf52f07953d592f4dda06b7e3de0ba1b26fd1';
/** The 2.5.11 recap template as an install left it in a project, recorded as the kit's. */
const RECAP_TEMPLATE_2511 = '# <Feature Name>, slice <n>: <slice name>\n\n## Differs from the spec\n';
const RECAP_NAMES = /slice-recap-template|slice-<n>\.md|the recap\b|a recap\b|slice recaps?\b/i;

describe('KitLean slice 20: kit 2.6.0, slim build', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('outer test (AC-61): build-slice has at most 45 lines and says only the slim build: the approved slice and its Scaffold rows, the guidelines, test-driven without exception, the gate, the record', () => {
    const text = skill('build-slice');
    assert.ok(text.split(/\r?\n/).length <= 45, `build-slice has ${text.split(/\r?\n/).length} lines`);
    for (const term of [/approved slice of `_specs\/<Feature>\/spec\.md`/, /Scaffold rows/, /guidelines apply to every line/i,
      /test-driven without exception/i, /Integration test project/, /real DI container/, /real view model and services/, /browser edge(, the clock, auth)? and (the )?backend client/,
      /never in the UI test project/i, /seen failing for the right reason/i, /rule or calculation/i, /smallest code/i,
      /page test[^\n]*red/i, /existing test is never changed or weakened unless the spec's criteria require it/i, /which and why/i,
      /security and personal-data criteria are tested like any other/i, /never (modif|break)[^\n]*production code/i,
      /read each file once/i, /quiet build and test commands/i, /`node \.claude\/hooks\/verify\.mjs --slice <IntegrationTestClass>`/, /until (it is )?green/i, /last line/i,
      /final answer/i, /one line per acceptance criterion/i, /failure message/i, /differs from the spec/i, /how the user tries it/i,
      /commit only when the user asks/i, /no slice plan file, no recap file, no spec edits, no reviewing agent per slice/i]) {
      assert.match(text, term, `build-slice does not say ${term}`);
    }
    inOrder(text, [/integration test/i, /unit test/i, /smallest code/i, /refactor/i, /verify\.mjs --slice/, /final answer/i], 'build-slice\'s order');
    // 2.6.1 (BR-67, AC-69, the owner's correction of 2026-11-24): no code analysis per slice, so a server analysis stays banned.
    for (const term of [/TodoWrite/, /slice-recap-template/, /slice-<n>\.md/, SERVER_ANALYSIS, /\*\*Analysis\*\*/, /spec-reviewer/, /security-review/, /--feature/]) {
      assert.doesNotMatch(text, term, `build-slice still says ${term}`);
    }
  });

  test('AC-62: the always-loaded rules keep the spec phase, the gates and the commit rule, say the build in at most 3 phase lines and carry no build-phase paragraph', () => {
    const rules = read(RULES_FILE);
    for (const [heading, hash] of Object.entries(RULES_SPEC_PHASE_PINNED)) assert.equal(sha(section(rules, heading)), hash, `the rules' ${heading} changed`);
    const lines = rules.split(/\r?\n/);
    assert.equal(sha(lines.filter((l) => /^\| [123]\. /.test(l)).join('\n')), SPEC_PHASE_ROWS_PINNED, 'the spec-phase rows of the phases table changed');
    const build = lines.filter((l) => /^\| \d\. /.test(l) && /build-slice|build|slice gate/i.test(l) && !/^\| [123]\. /.test(l) && !/Review/.test(l));
    assert.ok(build.length >= 1 && build.length <= 3, `the phases table says the build in ${build.length} lines`);
    for (const term of [/Test economy/i, /TodoWrite|todo list/i, /stubs that make/i, /no new warning/i, /pack rules apply by path/i, /once per slice/i,
      /Integration test location|integration test location/, /mutation checks/i, /Every line of production code answers a failing test/i, SERVER_ANALYSIS]) {
      assert.doesNotMatch(rules, term, `the rules still carry the build phase: ${term}`);
    }
    const gates = section(rules, 'Gates');
    for (const term of [/slice gate/i, /`--slice <IntegrationTestClass>`|`--slice/, /zero tests/i, /feature gate/i, /`--feature`/, /final review/i]) assert.match(gates, term, `the rules' Gates do not say ${term}`);
    assert.match(section(rules, 'Commit and push'), /only when the user explicitly asks/i, 'the commit rule is gone');
    assert.match(rules, /`build-slice`/, 'the rules do not name build-slice');
  });

  test('AC-62: new-feature holds the final review: the feature gate, the code analysis, spec-reviewer and security-review once, an optional end-to-end test, then shipped', () => {
    const review = step(section(skill('new-feature'), 'Workflow'), 'Review');
    inOrder(review, [/`node \.claude\/hooks\/verify\.mjs --feature`/, /code analysis/i, /`spec-reviewer`/, /`security-review`/], 'new-feature\'s final review');
    for (const term of [/once/i, /never per slice/i, /Analysis/, /Fix analysis/, /no code analysis declared/i, /artifacts\/<FeatureName>-analysis\.md/, /end-to-end browser test[^\n]*optional|optional[^\n]*end-to-end/i, /shipped/]) {
      assert.match(review, term, `new-feature's Review does not say ${term}`);
    }
  });

  test('outer test (AC-63): an update of a 2.5.11 install removes the unchanged slice-recap template, nothing else, and leaves the specs\' slice files alone', () => {
    const dir = project();
    assert.equal(install(kit, 'apply', dir).status, 0);
    writeFileSync(join(dir, RECAP_TEMPLATE), RECAP_TEMPLATE_2511);
    const recorded = record(dir);
    recorded.files[RECAP_TEMPLATE] = sha(RECAP_TEMPLATE_2511);
    recorded.kitVersion = '2.5.11';
    writeFileSync(join(dir, RECORD), JSON.stringify(recorded, null, 2));
    mkdirSync(join(dir, '_specs/Export'), { recursive: true });
    writeFileSync(join(dir, '_specs/Export/slice-1.md'), '# Export, slice 1\n');
    writeFileSync(join(dir, '_specs/Export/slice-1-plan.md'), '# Slice 1 plan: Export\n');
    const before = tree(dir);
    const run = install(kit, 'apply', dir);
    assert.equal(run.status, 0, run.output);
    assert.ok(!existsSync(join(dir, RECAP_TEMPLATE)), 'the slice-recap template is still in the project');
    assert.match(run.stdout, /^remove\s+\.claude\/templates\/slice-recap-template\.md/m, 'the output does not report the slice-recap template as removed');
    assert.ok(!(RECAP_TEMPLATE in record(dir).files), 'the slice-recap template is still recorded');
    const after = tree(dir);
    assert.deepEqual(Object.keys(before).filter((p) => !(p in after)), [RECAP_TEMPLATE], 'the update removed other files');
    for (const rel of ['_specs/Export/slice-1.md', '_specs/Export/slice-1-plan.md']) assert.equal(after[rel], before[rel], `the update touched ${rel}`);
  });

  test('AC-63: the kit ships neither the slice-plan nor the slice-recap template, and no kit text names either, a recap file or the recap', () => {
    for (const rel of [SLICE_PLAN_TEMPLATE, RECAP_TEMPLATE]) assert.ok(!existsSync(join(KIT, rel)), `the kit still ships ${rel}`);
    for (const rel of kitTexts()) {
      const text = read(rel).replace(/no slice plan file/gi, ''); // "no slice plan file" forbids the plan
      assert.doesNotMatch(text, SLICE_PLAN_NAMES, `${rel} still names the slice plan`);
      assert.doesNotMatch(text, RECAP_NAMES, `${rel} still names the recap`);
    }
  });

  // 2.6.1 (BR-69): the version moves on; the 2.6.0 entry stays, above 2.5.11.
  test('outer test (AC-64): 2.6.0 (now 2.6.1) in the rules and plugin.json; CHANGELOG 2.6.0 above 2.5.11 with the figures and an upgrade note; the README\'s process names the slim build and its record', () => {
    assert.equal(read(RULES_FILE).split(/\r?\n/)[0], `<!-- spec-driven-kit ${VERSION} -->`, `the rules file is not ${VERSION}`);
    assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, VERSION, `plugin.json is not ${VERSION}`);
    const changelog = read('CHANGELOG.md');
    const [newest, previous] = positions(changelog, [/^## 2\.6\.0 /m, /^## 2\.5\.11 /m]);
    assert.ok(newest < previous, 'the 2.6.0 entry is not above 2.5.11');
    const [body, notes] = changelog.slice(newest, previous).split(/^### Upgrade notes/m);
    for (const term of [/4\.29 USD/, /3\.96 USD/, /11\/11/, /10\/11/, /5\/11/, /8\/10/, /10\/10/, /D18/, /BR-58/, /BR-62/, /45 lines/,
      /`slice-recap-template\.md`/, /`hooks\/`[^\n]*unchanged/]) {
      assert.match(body, term, `the 2.6.0 entry does not say ${term}`);
    }
    assert.ok(notes, 'the 2.6.0 entry has no upgrade notes');
    assert.match(notes, /removes the unchanged[^\n]*slice-recap-template\.md`/i, 'the upgrade notes do not say the template is removed');
    assert.match(notes, /slice-<n>\.md[^\n]*left alone|left alone[^\n]*slice-<n>\.md/i, 'the upgrade notes do not leave the existing slice files alone');
    const readme = read('README.md');
    for (const term of [/at most 45 lines/i, /failure message/i, /final answer/i, /2\.6\.0/]) assert.match(readme, term, `the README does not say ${term}`);
    assertHooksPinned();
  });

  // 2.6.1 (BR-68, AC-70): write-spec loses its todo-list leftovers, so its e590932 pin no longer holds; with those two
  // sentences put back as they were, it hashes as at e590932 again (nothing else of the spec phase changed).
  test('AC-65 (2.6.1: AC-70): the spec phase is unchanged: investigate and spec-critic as at 2.5.11, write-spec but for its todo-list leftovers; amend-spec and the spec template only lose the recap', () => {
    for (const [rel, hash] of Object.entries(SPEC_PHASE_PINNED)) {
      const text = rel.endsWith('write-spec/SKILL.md') ? WRITE_SPEC_LEFTOVERS.reduce((t, [now, was]) => t.replace(now, was), read(rel)) : read(rel);
      assert.equal(sha(text), hash, `${rel} changed`);
    }
    for (const rel of ['.claude/skills/amend-spec/SKILL.md', SPEC_TEMPLATE]) {
      assert.doesNotMatch(read(rel), RECAP_NAMES, `${rel} still names the recap`);
      assert.match(read(rel), /Scaffold/, `${rel} lost its Scaffold`);
    }
    assert.match(read(SPEC_TEMPLATE), /accepted \(checked and accepted by the user; never set by the build\)/, 'the spec template\'s slice states changed');
  });
});

// Slice 21: kit 2.6.1 (amended 2026-11-24, D19, BR-63 to BR-69, AC-66 to AC-71). The 2.6.0 benchmark build met 11/11
// criteria, caught 10/10 breaks, 0 weak tests, 4.33 USD (2.5.9: 4.29), but its final answer did not give the failure seen
// for each test while it was red: the red check becomes mechanical; 2.6.0 leftovers. Code analysis stays once per
// feature, in the final review (the owner's correction of 2026-11-24 undid its per-slice return).

/**
 * A test command script: logs its arguments; `unit` reports every row of fail.txt in the `dotnet test` console form
 * and (2.6.2) as a TRX file under TestResults/, as `dotnet test --logger trx` writes it. A row is a test name
 * (`Ns.Class.Method` with its data row, failing on an assertion) or `className|method|testName|outcome|message`;
 * the row NOTRX writes no TRX file and BUILD-ERROR prints a compile error and runs no test.
 */
const CS = String.raw`import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
mkdirSync('artifacts', { recursive: true });
appendFileSync('artifacts/log.txt', JSON.stringify(args) + '\n');
const lines = existsSync('fail.txt') ? readFileSync('fail.txt', 'utf8').split('\n').filter(Boolean) : [];
if (args[0] !== 'unit' || lines.length === 0) { console.log('Passed!'); process.exit(0); }
if (lines.includes('BUILD-ERROR')) { console.log("src/App/Export.cs(3,5): error CS0246: The type or namespace name 'Exporter' could not be found"); console.log('Build FAILED.'); process.exit(1); }
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rows = lines.filter((l) => l !== 'NOTRX').map((line, i) => {
  const parts = line.split('|');
  if (parts.length >= 3) return { id: 'id' + i, className: parts[0], method: parts[1], testName: parts[2], outcome: parts[3] || 'Failed', message: parts[4] || 'Assert.Equal() Failure: ' + parts[2] + ' has no behavior yet' };
  const base = line.split(/[ (]/)[0];
  const dot = base.lastIndexOf('.');
  return { id: 'id' + i, className: base.slice(0, dot), method: base.slice(dot + 1), testName: line, outcome: 'Failed', message: 'Assert.Equal() Failure: ' + line + ' has no behavior yet' };
});
for (const r of rows) if (r.outcome === 'Failed') { console.log('  Failed ' + r.testName + ' [1 ms]'); console.log('  Error Message:'); console.log('   ' + r.message); }
if (!lines.includes('NOTRX')) {
  mkdirSync('TestResults', { recursive: true });
  const results = rows.map((r) => '<UnitTestResult testId="' + r.id + '" testName="' + esc(r.testName) + '" outcome="' + r.outcome + '"><Output><ErrorInfo><Message>' + esc(r.message) + '</Message></ErrorInfo></Output></UnitTestResult>').join('\n');
  const defs = rows.map((r) => '<UnitTest name="' + esc(r.testName) + '" id="' + r.id + '"><TestMethod codeBase="App.Tests.dll" className="' + r.className + '" name="' + r.method + '" /></UnitTest>').join('\n');
  writeFileSync('TestResults/run-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.trx', '<?xml version="1.0" encoding="utf-8"?>\n<TestRun xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010">\n<Results>\n' + results + '\n</Results>\n<TestDefinitions>\n' + defs + '\n</TestDefinitions>\n</TestRun>\n');
}
process.exit(rows.some((r) => r.outcome === 'Failed') ? 1 : 0);`;
const CS_STEPS = ['build', 'unit', 'it'].map((name) => `node cs.mjs ${name}`);
const EXPORT_CS = 'src/Test/ExportTests.cs';
const EXPORT_BASE = 'namespace App.Tests;\n\npublic class ExportTests\n{\n    [Fact]\n    public void Existing_header()\n    {\n        Assert.True(true);\n    }\n}\n';
/** The slice's change to ExportTests.cs: the existing test modified, an xUnit Fact and a Theory with two rows added. */
const EXPORT_SLICE = [
  'namespace App.Tests;', '', 'public class ExportTests', '{',
  '    [Fact]', '    public void Existing_header()', '    {', '        Assert.True(1 == 1);', '    }', '',
  '    [Fact]', '    [Trait("AC", "1")]', '    public async Task AC1_Csv()', '    {', '        await Task.CompletedTask;', '    }', '',
  '    [Theory]', '    [InlineData(1)]', '    [InlineData(2)]', '    public void AC2_Guard(int value)', '    {', '        Assert.True(value > 0);', '    }',
  '}', '',
].join('\n');
/** A new, untracked file: an NUnit TestCase method with two rows, a commented-out test and an MSTest TestMethod. */
const GUARD_CS = 'src/Test/Guards/GuardTests.cs';
const GUARD_NEW = [
  'namespace App.Tests.Guards;', '', 'public class GuardTests', '{',
  '    [TestCase("=")]', '    [TestCase("+")]', '    public void AC3_Rows(string value) { }', '',
  '    // [Fact]', '    // public void Commented_out() { }', '}', '',
  '[TestClass]', 'public class MsTests', '{', '    [TestMethod]', '    public void AC4_Ms() { }', '}', '',
].join('\n');
/** A gate project whose Verification Commands are CS_STEPS, with ExportTests.cs and the spec of feature Export committed. */
function csProject(kit, verifyExtra = {}) {
  const dir = gateProject(kit, null);
  const file = join(dir, '.claude/spec-driven.json');
  const config = JSON.parse(readFileSync(file, 'utf8'));
  config.verify = { ...config.verify, commands: CS_STEPS, integration: { command: 'node cs.mjs it', filter: '--only {tests}' }, ...verifyExtra };
  writeFileSync(file, JSON.stringify(config, null, 2));
  writeFileSync(join(dir, 'cs.mjs'), CS);
  writeFileSync(join(dir, '.gitignore'), 'artifacts/\n.claude/spec-driven.state.json\nTestResults/\n');
  put(dir, '_specs/Export/spec.md', '# Spec: Export\n');
  mkdirSync(join(dir, 'src/Test'), { recursive: true });
  writeFileSync(join(dir, EXPORT_CS), EXPORT_BASE);
  sliceGit(dir, ['add', '-A']);
  sliceGit(dir, ['commit', '-q', '-m', 'base']);
  return dir;
}

/** Writes a file under the project, creating its folder. */
function put(dir, rel, text) {
  mkdirSync(join(dir, rel, '..'), { recursive: true });
  writeFileSync(join(dir, rel), text);
}

const lastLine = (output) => output.trimEnd().split(/\r?\n/).at(-1);

describe('KitLean slice 21: kit 2.6.1, the mechanical red check, code analysis once per feature', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  // 2.6.4 (D22, BR-83): the red check of 2.6.1 and 2.6.2 is removed and its tests (AC-66 to AC-68) with it; what 2.6.1
  // kept stands: code analysis once per feature (AC-69), the leftovers (AC-70), the CHANGELOG entry (AC-71).
  // AC-69 as corrected by the owner on 2026-11-24: no code analysis per slice; it runs once per feature, in the final review.
  test('AC-69 (2.6.4: without the red check): build-slice quotes the gate\'s last line and runs no code analysis; at most 45 lines', () => {
    const text = skill('build-slice');
    assert.ok(text.split(/\r?\n/).length <= 45, `build-slice has ${text.split(/\r?\n/).length} lines`);
    inOrder(text, [/Integration test first/i, /--slice <IntegrationTestClass>/], 'build-slice\'s tests and gate');
    assert.match(section(text, 'Verification is the gate'), /quote its last line/i, 'build-slice does not quote the gate\'s last line');
    for (const term of [/code analysis/i, /\*\*Analysis\*\*/, /\*\*Fix analysis\*\*/, SERVER_ANALYSIS]) assert.doesNotMatch(text, term, `build-slice still runs a per-slice analysis: ${term}`);
  });

  test('AC-69: the Project settings run the Analysis once per feature, in the final review; the rules\' phases and the README say it', () => {
    const settings = read(SETTINGS_TEMPLATE);
    const analysis = lineOf(settings, /^- \*\*Analysis\*\*/, 'the Analysis line');
    assert.match(analysis, /once per feature, in the final review[^\n]*never per slice/i, 'the Analysis line does not run once per feature, in the final review, never per slice');
    assert.doesNotMatch(analysis, /once per slice|each slice's record|the slice stops/i, 'the Analysis line still runs per slice');
    const fix = lineOf(settings, /^- \*\*Fix analysis\*\*/, 'the Fix analysis line');
    assert.match(fix, /the final review fixes them/i, 'the Fix analysis line does not fall back to the final review');
    assert.doesNotMatch(fix, /build-slice/, 'the Fix analysis line still falls back to build-slice');
    assert.match(lineOf(read(RULES_FILE), /^\| 6\. Review/, 'the rules\' Review phase'), /code analysis[^\n]*once per feature, never per slice/i, 'the rules\' Review phase does not run the analysis once per feature');
    const verifyRow = lineOf(read('README.md'), /^\| Verify and check \|/, 'the README\'s Verify and check row');
    assert.match(verifyRow, /code analysis[^\n]*once per feature[^\n]*final review/i, 'the README\'s Verify and check row does not run the analysis once per feature');
    assert.doesNotMatch(verifyRow, /once for the slice|once per slice/i, 'the README\'s Verify and check row still runs the analysis per slice');
  });

  test('outer test (AC-70): no file of hooks/ or the packs names the recap; the guard still refuses a slice file while verification fails', () => {
    const files = ['hooks/guard.mjs', 'hooks/verify.mjs'];
    const walk = (folder) => {
      for (const entry of readdirSync(join(KIT, folder), { withFileTypes: true })) {
        const rel = `${folder}/${entry.name}`;
        if (entry.isDirectory()) walk(rel);
        else files.push(rel);
      }
    };
    walk('packs');
    for (const rel of files) assert.doesNotMatch(read(rel), /recap/i, `${rel} still names the recap`);
    const dir = gateProject(kit);
    mkdirSync(join(dir, 'artifacts'), { recursive: true });
    writeFileSync(join(dir, 'artifacts/broken'), '');
    assert.equal(recapWrite(dir).status, 2, 'the guard no longer refuses a slice file while verification fails');
  });

  test('AC-70: the Project settings\' Outer test and Unit test lines state build-slice\'s test rules; write-spec and the spec template name no todo list', () => {
    const settings = read(SETTINGS_TEMPLATE);
    const outer = lineOf(settings, /^- \*\*Outer test\*\*/, 'the Outer test line');
    for (const term of [/integration test first/i, /Integration test project/, /only the stubs it needs to compile/i, /seen failing for the right reason/i]) assert.match(outer, term, `the Outer test line does not say ${term}`);
    assert.doesNotMatch(outer, /one outer integration test class per slice|own test method only when/i, 'the Outer test line still states the 2.5.8 economy');
    const unit = lineOf(settings, /^- \*\*Unit test\*\*/, 'the Unit test line');
    assert.match(unit, /for each rule or calculation[^\n]*unit test seen failing/i, 'the Unit test line does not ask a unit test seen failing per rule or calculation');
    assert.doesNotMatch(unit, /branching logic the outer test cannot reach cheaply|pass-through/i, 'the Unit test line still states the 2.5.8 economy');
    for (const [where, text] of [['write-spec', skill('write-spec')], ['the spec template', read(SPEC_TEMPLATE)]]) assert.doesNotMatch(text, /todo list/i, `${where} still names the todo list`);
  });

  // 2.6.2 (BR-74): the version moves on; the 2.6.1 entry stays, above 2.6.0; the hooks are pinned at the current version.
  test('outer test (AC-71): 2.6.1 (now 2.6.2) in the rules and plugin.json; CHANGELOG 2.6.1 above 2.6.0 with the evidence, the changes and upgrade notes; both hooks pinned', () => {
    assert.equal(read(RULES_FILE).split(/\r?\n/)[0], `<!-- spec-driven-kit ${VERSION} -->`, `the rules file is not ${VERSION}`);
    assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, VERSION, `plugin.json is not ${VERSION}`);
    const changelog = read('CHANGELOG.md');
    const [newest, previous] = positions(changelog, [/^## 2\.6\.1 /m, /^## 2\.6\.0 /m]);
    assert.ok(newest < previous, 'the 2.6.1 entry is not above 2.6.0');
    const [body, notes] = changelog.slice(newest, previous).split(/^### Upgrade notes/m);
    for (const term of [/4\.33 USD/, /4\.29/, /11\/11/, /10\/10/, /D19/, /BR-63/, /BR-68/, /`redRecord`/, /`--start`/, /`--run/, /`\/\/ RegressionGuard: <[^>]+>`/,
      /red seen for n of n new tests/i, /once per feature/i, /owner's correction of 2026-11-24/i]) {
      assert.match(body, term, `the 2.6.1 entry does not say ${term}`);
    }
    assert.doesNotMatch(body, /once per slice again|analysis per slice/i, 'the 2.6.1 entry still brings the analysis per slice back');
    assert.doesNotMatch(changelog.slice(newest).split(/\r?\n/)[0], /analysis per slice/i, 'the 2.6.1 heading still names the analysis per slice');
    assert.ok(notes, 'the 2.6.1 entry has no upgrade notes');
    for (const term of [/`\.claude\/spec-driven\.state\.json`/, /RegressionGuard/, /`--run/, /`verify\.testCommands`/, /`verify\.baseBranch`/]) {
      assert.match(notes, term, `the upgrade notes do not say ${term}`);
    }
    assert.doesNotMatch(notes, /once per slice/i, 'the upgrade notes still run the Analysis per slice');
    assertHooksPinned();
  });
});

// Slice 22: kit 2.6.2 (D20). Its red check by full test name, its committed red record and their tests (AC-72 to AC-75) are
// removed in 2.6.4 (D22, BR-83); the CHANGELOG entry stays as history (AC-76).

describe('KitLean slice 22: kit 2.6.2, the red check by full test name, assertion failures only, a committed record', () => {
  // 2.6.3 (BR-78): the version moves on; the 2.6.2 entry stays, above 2.6.1; the hooks stay pinned.
  test('outer test (AC-76): 2.6.2 (now 2.6.3) in the rules and plugin.json; CHANGELOG 2.6.2 above 2.6.1 with the defects, the changes and upgrade notes; both hooks pinned at 2.6.2', () => {
    assert.equal(read(RULES_FILE).split(/\r?\n/)[0], `<!-- spec-driven-kit ${VERSION} -->`, `the rules file is not ${VERSION}`);
    assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, VERSION, `plugin.json is not ${VERSION}`);
    const changelog = read('CHANGELOG.md');
    const [newest, previous] = positions(changelog, [/^## 2\.6\.2 /m, /^## 2\.6\.1 /m]);
    assert.ok(newest < previous, 'the 2.6.2 entry is not above 2.6.1');
    const [body, notes] = changelog.slice(newest, previous).split(/^### Upgrade notes/m);
    for (const term of [/D20/, /BR-70/, /BR-74/, /RegressionGuard/, /data row/i, /fully qualified/i, /assertion/i, /`_specs\/<Feature>\/red-record\.json`/, /--logger trx/]) {
      assert.match(body, term, `the 2.6.2 entry does not say ${term}`);
    }
    assert.ok(notes, 'the 2.6.2 entry has no upgrade notes');
    for (const term of [/`--start <FeatureName>`/, /--logger trx/, /`TestResults\/`/, /red-record\.json/, /`redRecord`/]) assert.match(notes, term, `the upgrade notes do not say ${term}`);
    assertHooksPinned();
  });
});

// Slice 23: kit 2.6.3 (the owner's go of 2026-11-25, D21, BR-75 to BR-78, AC-77 to AC-80). Efficient-testing rules R-1
// to R-7 get one home, the testing guideline for agents of dotnet-shared; the other testing texts point to it; build-slice's
// record carries the slice's test list (R-1). The red check and both hooks are unchanged.

/** Each efficient-testing rule with the points it must keep (the owner's text of 2026-11-25). */
const EFFICIENT_RULES = {
  'R-1': [/earns its place/i, /test list/i, /acceptance criterion/i, /plausible bug/i, /AC-5: formula guard dropped for '\+'/, /deleted, not kept/i],
  'R-2': [/constant, literal or resource value/i, /getters, setters, records, DTOs/i, /DI registration or configuration/i, /framework or third-party/i,
    /expected value computed by the code under test/i, /mock it configured itself/i, /feature removed/i, /repeats a case/i],
  'R-3': [/cheapest level/i, /pure logic/i, /distinct case or branch/i, /bUnit/, /enabled or disabled|enabled\/disabled/i, /MarkupMatches/, /role|text/i,
    /never brittle full-markup/i, /at least one per slice/i, /real DI container/i, /never builds its own input/i, /main path/i, /at most one failure or edge/i, /unit-level variants/i],
  'R-4': [/outcomes?/i, /bytes, state, file names, log content/i, /rendered output/i, /system boundary/i, /backend client/i, /browser download/i, /only when the call is the behavio/i],
  'R-5': [/public surface/i, /prefer public APIs/i, /inner class/i, /too rich/i],
  'R-6': [/fewest tests/i, /merged/i, /parameteri[sz]e/i, /at least one test that would fail/i, /name the test/i],
  'R-7': [/line coverage is not the goal/i, /plausible bug/i],
};
const SOURCES = [/Google Testing Blog/, /change-detector/i, /Khorikov/, /four pillars/i, /Kent C\. Dodds/, /mostly integration/i, /Microsoft Learn/, /mutation testing/i, /bUnit docs/, /semantic markup comparison/i];
/** Phrases that only the rules' home may hold. */
const HOME_ONLY = [/MarkupMatches/, /Khorikov/, /change-detector/i, /line coverage is not the goal/i, /never brittle full-markup/i, /expected value computed by the code under test/i];

describe('KitLean slice 23: kit 2.6.3, efficient-testing rules with one home and the slice\'s test list', () => {
  test('outer test (AC-77): the testing guideline for agents holds R-1 to R-7, each once, with every point and the sources line', () => {
    const text = read(TESTING_FOR_AGENTS);
    const rules = section(text, 'Efficient tests');
    for (const [id, terms] of Object.entries(EFFICIENT_RULES)) {
      const rows = text.split(/\r?\n/).filter((l) => l.startsWith(`| ${id} |`));
      assert.equal(rows.length, 1, `${id} is not stated exactly once`);
      assert.ok(rules.includes(rows[0]), `${id} is not in the Efficient tests section`);
      for (const term of terms) assert.match(rows[0], term, `${id} does not say ${term}`);
    }
    const sources = lineOf(rules, /^Sources:/, 'the sources line');
    for (const term of SOURCES) assert.match(sources, term, `the sources line does not name ${term}`);
  });

  // 3.0.0: the test conventions and the Blazor architecture rules are removed with their packs.
  test('AC-78: no other kit text or pack file restates the rules; T-6, T-13 and build-slice point to them', () => {
    const others = [...kitTexts(), ...readdirSync(join(KIT, 'packs'), { recursive: true }).map((p) => `packs/${String(p).replace(/\\/g, '/')}`)
      .filter((p) => p.endsWith('.md') && p !== TESTING_FOR_AGENTS)];
    for (const rel of others) for (const phrase of HOME_ONLY) assert.doesNotMatch(read(rel), phrase, `${rel} restates an efficient-testing rule (${phrase})`);
    for (const rel of others) assert.doesNotMatch(read(rel), /^\| R-\d \|/m, `${rel} holds a rule row R-n`);
    const pointer = /R-1 to R-7/;
    assert.match(skill('build-slice'), pointer, 'build-slice does not point to R-1 to R-7');
    const t6 = lineOf(read(TESTING_FOR_AGENTS), /^\| T-6 \|/, 'T-6');
    assert.match(t6, /R-4/, 'T-6 does not point to R-4');
    assert.doesNotMatch(t6, /Times\.Once/, 'T-6 still allows a call verification beside any outcome, against R-4');
    const t13 = lineOf(read(TESTING_FOR_AGENTS), /^\| T-13 \|/, 'T-13');
    assert.match(t13, pointer, 'T-13 does not point to R-1 to R-7');
    assert.doesNotMatch(t13, /resource keys|cannot reach cheaply/i, 'T-13 still restates what R-2 and R-3 say');
  });

  test('outer test (AC-79): build-slice\'s record carries the test list (test name -> AC -> bug it catches) and deletes a test without a line; one real integration test per slice stays', () => {
    const text = skill('build-slice');
    assert.ok(text.split(/\r?\n/).length <= 45, `build-slice has ${text.split(/\r?\n/).length} lines`);
    const record = section(text, 'The record is the final answer');
    const list = lineOf(record, /test list/i, 'the test list');
    for (const term of [/each new test/i, /acceptance criterion|AC/, /bug it catches/i, /R-1/]) assert.match(list, term, `the test list does not say ${term}`);
    assert.match(text, /without (?:a|its) line[^\n]*deleted|deleted[^\n]*without (?:a|its) line/i, 'build-slice does not delete a test that has no line in the test list');
    assert.match(section(text, 'Test-driven without exception'), /Integration test first/, 'build-slice lost the integration test first');
    assert.match(section(read(TESTING_FOR_AGENTS), 'Efficient tests'), /Integration: at least one per slice/i, 'R-3 does not keep one real integration test per slice');
  });

  // 2.6.4 (BR-84): the version moves on; the 2.6.3 entry stays, above 2.6.2; the hooks are pinned at the current version.
  test('outer test (AC-80): 2.6.3 (now 2.6.4) in the rules, plugin.json and the recorded versions; CHANGELOG 2.6.3 above 2.6.2; both hooks pinned', () => {
    assert.equal(read(RULES_FILE).split(/\r?\n/)[0], `<!-- spec-driven-kit ${VERSION} -->`, `the rules file is not ${VERSION}`);
    assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, VERSION, `plugin.json is not ${VERSION}`);
    const changelog = read('CHANGELOG.md');
    const [newest, previous] = positions(changelog, [/^## 2\.6\.3 /m, /^## 2\.6\.2 /m]);
    assert.ok(newest < previous, 'the 2.6.3 entry is not above 2.6.2');
    const body = changelog.slice(newest, previous);
    for (const term of [/D21/, /BR-75/, /BR-78/, /R-1/, /R-7/, /test list/i, /testing guideline/i, /red check[^\n]*unchanged|unchanged[^\n]*red check/i]) assert.match(body, term, `the 2.6.3 entry does not say ${term}`);
    assert.match(read('README.md'), /R-1 to R-7/, 'the README does not name the efficient-testing rules');
    assertHooksPinned();
  });
});

// Slice 24: kit 2.6.4 (the owner's decision of 2026-11-25, D22, BR-79 to BR-84, AC-81 to AC-87). A mutation check
// (Stryker.NET on the slice's changed production files) becomes the slice's proof that its tests can fail; its evidence
// is committed with the slice; the mechanical red check of 2.6.1 and 2.6.2 is removed.

const MUTATION_SCRIPT = 'packs/dotnet-shared/scripts/mutation-check.mjs';
/** A fake dotnet: logs { cwd, args }; `tool restore` fails with FAKE_RESTORE_FAILS; `tool run dotnet-stryker` copies FAKE_REPORT. */
const FAKE_DOTNET = String.raw`import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const args = process.argv.slice(2);
appendFileSync(process.env.FAKE_DOTNET_LOG, JSON.stringify({ cwd: process.cwd(), args }) + '\n');
if (args[0] === 'tool' && args[1] === 'restore') process.exit(process.env.FAKE_RESTORE_FAILS ? 1 : 0);
if (args[0] === 'tool' && args[1] === 'run' && args[2] === 'dotnet-stryker') {
  const out = args[args.indexOf('--output') + 1];
  mkdirSync(join(out, 'reports'), { recursive: true });
  writeFileSync(join(out, 'reports', 'mutation-report.json'), readFileSync(process.env.FAKE_REPORT, 'utf8'));
  writeFileSync(join(out, 'reports', 'mutation-report.html'), '<html></html>');
  process.exit(0);
}
process.exit(1);
`;
const TOOLS_JSON = JSON.stringify({ version: 1, isRoot: true, tools: { 'dotnet-stryker': { version: '5.1.0', commands: ['dotnet-stryker'], rollForward: false } } }, null, 2);
const MUTATION_SETTINGS = ['# App', '', '## Project settings', '', '- **Specs folder**: `_specs/`', '', '### Pack values', '',
  '- **Test projects**: `src/Test/App.Tests/App.Tests.csproj`, `src/Test/App.Integration.Tests/App.Integration.Tests.csproj`',
  '- **Mutation threshold**: `80`', ''].join('\n');

/** A git project on branch feature/export with the Export spec, two test projects and src/App/Export.cs committed as the base. */
function mutationProject() {
  const dir = project();
  put(dir, 'CLAUDE.md', MUTATION_SETTINGS);
  put(dir, '.config/dotnet-tools.json', TOOLS_JSON);
  put(dir, '.gitignore', 'artifacts/\n');
  put(dir, '_specs/Export/spec.md', '# Spec: Export\n\n## Status\n\n- branch `feature/export` from `main`\n');
  put(dir, 'src/App/App.csproj', '<Project Sdk="Microsoft.NET.Sdk" />\n');
  put(dir, 'src/App/Export.cs', 'namespace App;\n\npublic static class Export\n{\n}\n');
  put(dir, 'src/Test/App.Tests/App.Tests.csproj', '<Project Sdk="Microsoft.NET.Sdk" />\n');
  put(dir, 'src/Test/App.Integration.Tests/App.Integration.Tests.csproj', '<Project Sdk="Microsoft.NET.Sdk" />\n');
  put(dir, 'tools/dotnet.mjs', FAKE_DOTNET);
  sliceGit(dir, ['init', '-q', '-b', 'feature/export']);
  sliceGit(dir, ['add', '-A']);
  sliceGit(dir, ['commit', '-q', '-m', 'base']);
  const base = sliceGit(dir, ['rev-parse', 'HEAD']).trim();
  // The slice: production code, markup-only and code-carrying Razor, generated code, a resource file and a test.
  put(dir, 'src/App/Export.cs', 'namespace App;\n\npublic static class Export\n{\n    public static string Csv(int n) => n > 0 ? "a" : "b";\n}\n');
  put(dir, 'src/App/Guard.cs', 'namespace App;\n\npublic static class Guard\n{\n    public static bool Formula(string s) => s.StartsWith("=");\n}\n');
  put(dir, 'src/App/Pages/Export.razor', '<h1>Export</h1>\n<p>Download the list.</p>\n');
  put(dir, 'src/App/Pages/Counter.razor', '<button @onclick="Add">+</button>\n\n@code {\n    private int count;\n    private void Add() => count++;\n}\n');
  put(dir, 'src/App/Generated.g.cs', '// <auto-generated/>\nnamespace App;\n');
  put(dir, 'src/App/Strings.Designer.cs', 'namespace App;\n');
  put(dir, 'src/App/Strings.resx', '<root />\n');
  put(dir, 'src/App/obj/Debug/App.AssemblyInfo.cs', 'namespace App;\n');
  put(dir, 'src/Test/App.Tests/ExportTests.cs', 'namespace App.Tests;\n\npublic class ExportTests { }\n');
  put(dir, 'docs/notes.cs', 'namespace Docs;\n');
  return { dir, base };
}

/** A Stryker.NET JSON report (mutation-testing-elements schema) with one mutant per status given. */
function strykerReport(dir, statuses) {
  const mutants = statuses.map(([status, line, mutatorName], i) => ({ id: String(i + 1), mutatorName, replacement: 'x', status, location: { start: { line, column: 5 }, end: { line, column: 9 } } }));
  return JSON.stringify({ schemaVersion: '2', thresholds: { high: 80, low: 60 }, files: { [join(dir, 'src/App/Export.cs')]: { language: 'cs', source: '', mutants } } });
}

/** Runs the installed mutation check of the project with the fake dotnet; the report the fake Stryker writes is given. */
function mutationCheck(dir, report, args, env = {}) {
  writeFileSync(join(dir, 'report.json'), report);
  const log = join(dir, 'dotnet-log.txt');
  writeFileSync(log, '');
  const run = spawnSync(process.execPath, [join(dir, 'scripts/mutation-check.mjs'), ...args], {
    cwd: dir, encoding: 'utf8',
    env: { ...process.env, MUTATION_CHECK_DOTNET: join(dir, 'tools/dotnet.mjs'), FAKE_DOTNET_LOG: log, FAKE_REPORT: join(dir, 'report.json'), ...env },
  });
  const calls = readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return { status: run.status, output: `${run.stdout ?? ''}${run.stderr ?? ''}`, calls };
}

function withScript(dir) {
  put(dir, 'scripts/mutation-check.mjs', read(MUTATION_SCRIPT));
}

const SURVIVING = [['Killed', 5, 'Conditional (true) mutation'], ['Killed', 5, 'String mutation'], ['Timeout', 5, 'Equality mutation'], ['Survived', 5, 'Equality mutation'], ['Survived', 5, 'Conditional (false) mutation']];

describe('KitLean slice 24: kit 2.6.4, the mutation check gate, the red check removed', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('outer test (AC-81): the mutation check mutates only the slice\'s changed production files with Stryker.NET (MTP runner, every test project), writes the report under artifacts/mutation/<slice>/, prints the score line and each survivor, and is red below the threshold', () => {
    const { dir, base } = mutationProject();
    withScript(dir);
    const run = mutationCheck(dir, strykerReport(dir, SURVIVING), ['--slice', 'slice-1', '--base', base]);
    assert.equal(run.status, 1, `a score of 60 % below the threshold 80 passed: ${run.output}`);
    assert.deepEqual(run.calls[0].args, ['tool', 'restore'], 'the tool is not restored first');
    const stryker = run.calls.filter((c) => c.args[2] === 'dotnet-stryker');
    assert.equal(stryker.length, 1, `Stryker did not run once for the one production project: ${JSON.stringify(run.calls)}`);
    const { args, cwd } = stryker[0];
    assert.deepEqual(args.slice(0, 3), ['tool', 'run', 'dotnet-stryker']);
    assert.ok(args.join(' ').includes('-t mtp'), `Stryker does not run on the MTP runner: ${args.join(' ')}`);
    const values = (flag) => args.flatMap((a, i) => (a === flag ? [args[i + 1]] : []));
    // 2.6.5 (BR-85): a changed file carries its changed lines as a span after the file part (AC-89).
    assert.deepEqual(values('--mutate').map((v) => v.replace(/\{\d+\.\.\d+\}$/, '')).sort(), ['Export.cs', 'Guard.cs', 'Pages/Counter.razor'], 'not exactly the changed production files are mutated');
    assert.equal(values('--test-project').length, 2, 'not every test project of the project settings is given');
    for (const tp of values('--test-project')) assert.ok(existsSync(join(cwd, tp)), `${tp} is not a test project path from the project's folder`);
    assert.equal(realPath(cwd), realPath(join(dir, 'src/App')), 'Stryker does not run in the production project\'s folder');
    assert.ok(existsSync(join(dir, 'artifacts/mutation/slice-1')), 'no report under artifacts/mutation/slice-1/');
    assert.ok(readdirSync(join(dir, 'artifacts/mutation/slice-1'), { recursive: true }).some((p) => String(p).endsWith('mutation-report.json')), 'the JSON report is not kept');
    assert.match(run.output, /^mutation: score 60% \(killed 2, survived 2, no coverage 0, timeout 1\)$/m, `no score line: ${run.output}`);
    assert.match(run.output, /src\/App\/Export\.cs:5 Equality mutation/, 'a survivor is not listed as file:line mutator');
    assert.match(run.output, /src\/App\/Export\.cs:5 Conditional \(false\) mutation/, 'the second survivor is not listed');
  });

  test('AC-81: green at or above the threshold without a mutant lacking coverage; red on any mutant without coverage; the threshold comes from the project settings', () => {
    const { dir, base } = mutationProject();
    withScript(dir);
    const green = mutationCheck(dir, strykerReport(dir, [['Killed', 5, 'A'], ['Killed', 5, 'B'], ['Killed', 5, 'C'], ['Killed', 5, 'D'], ['Survived', 5, 'E']]), ['--slice', 's1', '--base', base]);
    assert.equal(green.status, 0, green.output);
    assert.match(green.output, /mutation: score 80% \(killed 4, survived 1, no coverage 0, timeout 0\)/);
    const uncovered = mutationCheck(dir, strykerReport(dir, [...Array(9).fill(['Killed', 5, 'A']), ['NoCoverage', 5, 'Block removal mutation']]), ['--slice', 's1', '--base', base]);
    assert.equal(uncovered.status, 1, `a mutant without coverage passed: ${uncovered.output}`);
    assert.match(uncovered.output, /src\/App\/Export\.cs:5 Block removal mutation/, 'the mutant without coverage is not listed');
    put(dir, 'CLAUDE.md', MUTATION_SETTINGS.replace('`80`', '`90`'));
    const strict = mutationCheck(dir, strykerReport(dir, [['Killed', 5, 'A'], ['Killed', 5, 'B'], ['Killed', 5, 'C'], ['Killed', 5, 'D'], ['Survived', 5, 'E']]), ['--slice', 's1', '--base', base]);
    assert.equal(strict.status, 1, 'the project settings\' threshold is not read');
    put(dir, 'CLAUDE.md', MUTATION_SETTINGS.replace(/^- \*\*Mutation threshold\*\*.*$/m, ''));
    assert.equal(mutationCheck(dir, strykerReport(dir, [['Killed', 5, 'A'], ['Killed', 5, 'B'], ['Killed', 5, 'C'], ['Killed', 5, 'D'], ['Survived', 5, 'E']]), ['--slice', 's1', '--base', base]).status, 0, 'the default threshold is not 80');
  });

  test('AC-81: --files replaces the changed files; without a production file the check says so and runs no Stryker', () => {
    const { dir, base } = mutationProject();
    withScript(dir);
    const one = mutationCheck(dir, strykerReport(dir, [['Killed', 5, 'A']]), ['--slice', 's1', '--base', base, '--files', 'src/App/Guard.cs']);
    assert.equal(one.status, 0, one.output);
    const args = one.calls.find((c) => c.args[2] === 'dotnet-stryker').args;
    assert.deepEqual(args.flatMap((a, i) => (a === '--mutate' ? [args[i + 1]] : [])), ['Guard.cs']);
    const none = mutationCheck(dir, strykerReport(dir, []), ['--slice', 's1', '--base', base, '--files', 'src/Test/App.Tests/ExportTests.cs', 'src/App/Pages/Export.razor']);
    assert.equal(none.status, 0, none.output);
    assert.match(none.output, /no production file/i, 'the check does not say there was nothing to mutate');
    assert.ok(!none.calls.some((c) => c.args[2] === 'dotnet-stryker'), 'Stryker ran without a production file');
  });

  test('AC-82: when dotnet-stryker cannot be restored, or the tool manifest lacks it, the check fails with the restore message and its own exit code, never skipping', () => {
    const { dir, base } = mutationProject();
    withScript(dir);
    const failed = mutationCheck(dir, strykerReport(dir, [['Killed', 5, 'A']]), ['--slice', 's1', '--base', base], { FAKE_RESTORE_FAILS: '1' });
    assert.equal(failed.status, 3, `a tool that cannot be restored is not exit code 3: ${failed.output}`);
    assert.match(failed.output, /dotnet-stryker not available: run dotnet tool restore \(the tool comes from nuget\.org\), see README/);
    put(dir, '.config/dotnet-tools.json', JSON.stringify({ version: 1, isRoot: true, tools: {} }));
    const missing = mutationCheck(dir, strykerReport(dir, [['Killed', 5, 'A']]), ['--slice', 's1', '--base', base]);
    assert.equal(missing.status, 3, missing.output);
    assert.match(missing.output, /dotnet-stryker not available/);
    const usage = mutationCheck(dir, '{}', ['--base', base]);
    assert.ok(usage.status !== 0 && usage.status !== 3, 'a missing --slice is not a usage error');
  });

  test('outer test (AC-83): the check writes _specs/<Feature>/mutation-<slice>.md, not ignored: the score line, the files mutated and each survivor with its classification; a classification written there is kept on the next run', () => {
    const { dir, base } = mutationProject();
    withScript(dir);
    mutationCheck(dir, strykerReport(dir, SURVIVING), ['--slice', 'slice-1', '--base', base]);
    const file = join(dir, '_specs/Export/mutation-slice-1.md');
    assert.ok(existsSync(file), 'no committed evidence file in the feature\'s folder');
    const text = readFileSync(file, 'utf8');
    assert.match(text, /^mutation: score 60% \(killed 2, survived 2, no coverage 0, timeout 1\)$/m, 'the evidence lacks the score line');
    for (const f of ['src/App/Export.cs', 'src/App/Guard.cs', 'src/App/Pages/Counter.razor']) assert.ok(text.includes(f), `the evidence does not list ${f} as mutated`);
    assert.ok(!text.includes('Export.razor') && !text.includes('Generated.g.cs'), 'the evidence lists a file that was not mutated');
    const row = lineOf(text, /Export\.cs:5 Equality mutation/, 'the survivor row');
    assert.match(row, /unclassified/, 'a new survivor is not marked unclassified');
    assert.match(sliceGit(dir, ['status', '--porcelain', '--', '_specs/Export/mutation-slice-1.md']), /^\?\? /, 'the evidence is ignored by git');
    writeFileSync(file, text.replace(row, row.replace(/unclassified \|[^|]*\|$/, 'equivalent | x == 0 never reaches this branch: the guard above returns first |')));
    mutationCheck(dir, strykerReport(dir, SURVIVING), ['--slice', 'slice-1', '--base', base]);
    assert.match(readFileSync(file, 'utf8'), /Export\.cs:5 Equality mutation[^\n]*equivalent[^\n]*guard above returns first/, 'the classification was lost on the next run');
  });

  test('AC-81: the file filter keeps src/ production C# and code-carrying Razor; not tests, generated code, markup-only Razor or resources', async () => {
    const { productionFiles } = await import(pathToFileURL(join(KIT, MUTATION_SCRIPT)).href);
    const texts = { 'src/App/Pages/Export.razor': '<h1>Export</h1>', 'src/App/Pages/Counter.razor': '@code { int n; }', 'src/App/Pages/Fn.razor': '@functions { int n; }', 'src/App/Auto.cs': '// <auto-generated />\nclass A {}' };
    const kept = productionFiles(['src/App/Export.cs', 'src/App/Pages/Export.razor', 'src/App/Pages/Counter.razor', 'src/App/Pages/Fn.razor', 'src/App/Generated.g.cs',
      'src/App/X.g.i.cs', 'src/App/Strings.Designer.cs', 'src/App/Strings.resx', 'src/App/appsettings.json', 'src/App/obj/Debug/A.cs', 'src/App/bin/B.cs', 'src/App/Auto.cs',
      'src/Test/App.Tests/ExportTests.cs', 'src/App.Tests/T.cs', 'src/App.IntegrationTests/T.cs', 'tests/T.cs', 'docs/notes.cs', 'src/App/wwwroot/site.css'], (f) => texts[f] ?? 'class C {}');
    assert.deepEqual(kept, ['src/App/Export.cs', 'src/App/Pages/Counter.razor', 'src/App/Pages/Fn.razor']);
  });

  test('outer test (AC-84): the installer puts the script into the project\'s scripts/ folder and pins dotnet-stryker 5.1.0 in .config/dotnet-tools.json next to the project\'s own tools; plan writes nothing; remove takes both away', () => {
    const dir = project();
    put(dir, '.config/dotnet-tools.json', JSON.stringify({ version: 1, isRoot: true, tools: { 'dotnet-ef': { version: '8.0.0', commands: ['dotnet-ef'], rollForward: false } } }, null, 2));
    const plan = install(kit, 'plan', dir, '--level', '3', '--packs', 'dotnet-shared');
    assert.equal(plan.status, 0, plan.output);
    assert.ok(!existsSync(join(dir, 'scripts')), 'plan wrote the script');
    assert.ok(!readFileSync(join(dir, '.config/dotnet-tools.json'), 'utf8').includes('dotnet-stryker'), 'plan wrote the tool');
    assert.match(plan.output, /dotnet-stryker 5\.1\.0/, 'plan does not say it adds the tool');
    const run = install(kit, 'apply', dir, '--level', '3', '--packs', 'dotnet-shared');
    assert.equal(run.status, 0, run.output);
    assert.equal(readFileSync(join(dir, 'scripts/mutation-check.mjs'), 'utf8'), read(MUTATION_SCRIPT), 'the script is not in the project\'s scripts/ folder');
    assert.ok(!existsSync(join(dir, '.claude/hooks/mutation-check.mjs')) && !existsSync(join(dir, '.claude/scripts')), 'the script landed under .claude');
    const tools = JSON.parse(readFileSync(join(dir, '.config/dotnet-tools.json'), 'utf8')).tools;
    assert.deepEqual(tools['dotnet-stryker'], { version: '5.1.0', commands: ['dotnet-stryker'], rollForward: false }, 'dotnet-stryker is not pinned at 5.1.0');
    assert.equal(tools['dotnet-ef'].version, '8.0.0', 'the project\'s own tool was changed');
    assert.ok('scripts/mutation-check.mjs' in record(dir).files, 'the script is not recorded');
    const again = install(kit, 'apply', dir);
    assert.equal(again.status, 0, again.output);
    assert.equal(Object.keys(JSON.parse(readFileSync(join(dir, '.config/dotnet-tools.json'), 'utf8')).tools).length, 2, 'an update added the tool twice');
    const removed = install(kit, 'remove', dir);
    assert.equal(removed.status, 0, removed.output);
    assert.ok(!existsSync(join(dir, 'scripts/mutation-check.mjs')), 'remove left the script');
    assert.deepEqual(Object.keys(JSON.parse(readFileSync(join(dir, '.config/dotnet-tools.json'), 'utf8')).tools), ['dotnet-ef'], 'remove did not take only the kit\'s tool away');
    const bare = project();
    assert.equal(install(kit, 'apply', bare, '--level', '1', '--packs', 'dotnet-shared').status, 0);
    assert.equal(JSON.parse(readFileSync(join(bare, '.config/dotnet-tools.json'), 'utf8')).tools['dotnet-stryker'].version, '5.1.0', 'a project without a tool manifest gets none');
    const other = project();
    assert.equal(install(kit, 'apply', other, '--level', '1').status, 0);
    assert.ok(!existsSync(join(other, '.config/dotnet-tools.json')), 'an install without the pack wrote a tool manifest');
  });

  test('AC-85: build-slice runs the mutation check after the slice gate and states the classification rule; the record and the commit carry the evidence; see each new test fail first and R-1 to R-7 stay; at most 45 lines', () => {
    const text = skill('build-slice');
    assert.ok(text.split(/\r?\n/).length <= 45, `build-slice has ${text.split(/\r?\n/).length} lines`);
    inOrder(text, [/--slice <IntegrationTestClass>/, /`node scripts\/mutation-check\.mjs --slice <[^>]+> --base <[^>]+>`/], 'build-slice\'s slice gate, then the mutation check');
    for (const term of [/'?equivalent'? only if no test could ever observe/i, /same output, state and side effects for every input/i, /untested or 'out of scope' is not equivalent/i,
      /add or strengthen a test \(seen red first\)/i, /'accepted'/, /reviewer/i, /never weaken code or delete a line to raise the score/i, /mutation-<[^>]+>\.md/]) {
      assert.match(text, term, `build-slice does not say ${term}`);
    }
    assert.match(section(text, 'The record is the final answer'), /mutation/i, 'the record does not carry the mutation line');
    assert.match(text, /commit[^\n]*mutation-<[^>]+>\.md|mutation-<[^>]+>\.md[^\n]*commit/i, 'build-slice does not commit the evidence with the slice');
    assert.match(section(text, 'Test-driven without exception'), /seen failing/i, 'build-slice lost "see each new test fail first"');
    assert.match(text, /R-1 to R-7/, 'build-slice does not point to R-1 to R-7');
    const reviewer = read('.claude/agents/spec-reviewer.md');
    assert.match(reviewer, /mutation-<[^>]+>\.md/, 'spec-reviewer does not check the committed mutation evidence');
    assert.match(reviewer, /equivalent[^\n]*accepted|accepted[^\n]*equivalent/i, 'spec-reviewer does not check the classifications');
    const t4 = lineOf(read(TESTING_FOR_AGENTS), /^\| T-4 \|/, 'T-4');
    assert.doesNotMatch(t4, /no mutation checks/i, 'T-4 still forbids the mutation check');
    assert.match(t4, /mutation check/i, 'T-4 does not name the mutation check as the proof');
  });

  test('AC-86 (3.0.0: nuget.org, no feed): the Project settings carry the Mutation threshold (default 80) and the Test projects for dotnet-shared; the README says dotnet-stryker comes from nuget.org and how to check it', () => {
    const settings = read(SETTINGS_TEMPLATE);
    assert.match(lineOf(settings, /^- \*\*Mutation threshold\*\*/, 'the Mutation threshold line'), /80[^\n]*<!-- pack dotnet-shared/, 'the Mutation threshold line has no default 80 for dotnet-shared');
    assert.match(lineOf(settings, /^- \*\*Test projects\*\*/, 'the Test projects line'), /<!-- pack dotnet-shared/, 'the Test projects line is not dotnet-shared\'s');
    const readme = read('README.md');
    assert.match(readme, /Stryker\.NET/, 'the README does not name Stryker.NET');
    assert.match(readme, /The tool comes from nuget\.org/, 'the README does not say dotnet-stryker comes from nuget.org');
    assert.match(readme, /`dotnet tool restore`/, 'the README does not say how to check it');
    assert.match(readme, /5\.1\.0/, 'the README does not give the pinned version');
  });

  test('outer test (AC-87): the red check is gone: verify.mjs refuses --start and --run, its slice gate ends without "red seen", the guard and the kit texts name no red record, TRX logger or RegressionGuard', () => {
    const dir = csProject(kit);
    for (const args of [['--start', 'Export'], ['--run', 'node cs.mjs unit']]) {
      const run = verify(dir, ...args);
      assert.equal(run.status, 1, `${args[0]} is still accepted: ${run.output}`);
      assert.match(run.output, /^Usage:/m, `${args[0]} is not a usage error`);
    }
    put(dir, 'src/Test/NewTests.cs', 'namespace App.Tests;\n\npublic class NewTests\n{\n    [Fact]\n    public void AC1_New() { }\n}\n');
    const green = verify(dir, '--slice', 'ExportTests');
    assert.equal(green.status, 0, green.output);
    assert.match(lastLine(green.output), /^Verification green: slice gate \(integration tests: ExportTests\)\.$/, `the green line changed: ${lastLine(green.output)}`);
    assert.ok(!existsSync(join(dir, '_specs/Export/red-record.json')), 'a red record was written');
    for (const rel of ['hooks/verify.mjs', 'hooks/guard.mjs']) {
      assert.doesNotMatch(read(rel), /red.record|RegressionGuard|trx|--start|--run|sliceStart/i, `${rel} still holds the red check`);
    }
    const texts = [...kitTexts(), ...readdirSync(join(KIT, 'packs'), { recursive: true }).map((p) => `packs/${String(p).replace(/\\/g, '/')}`).filter((p) => p.endsWith('.md'))];
    for (const rel of texts) {
      assert.doesNotMatch(read(rel), /red-record\.json|RegressionGuard|--logger trx|verify\.mjs --run|verify\.mjs --start|red seen for/, `${rel} still describes the red check`);
    }
  });

  // 2.6.5 (BR-89): the version moves on; the 2.6.4 entry stays, above 2.6.3.
  test('outer test (AC-88): 2.6.4 (now 2.6.5) in the rules, plugin.json and the recorded versions; CHANGELOG 2.6.4 above 2.6.3 with upgrade notes, D22 and the exp16 evidence; both hooks pinned', () => {
    assert.equal(read(RULES_FILE).split(/\r?\n/)[0], `<!-- spec-driven-kit ${VERSION} -->`, `the rules file is not ${VERSION}`);
    assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, VERSION, `plugin.json is not ${VERSION}`);
    const changelog = read('CHANGELOG.md');
    const [newest, previous] = positions(changelog, [/^## 2\.6\.4 /m, /^## 2\.6\.3 /m]);
    assert.ok(newest < previous, 'the 2.6.4 entry is not above 2.6.3');
    const [body, notes] = changelog.slice(newest, previous).split(/^### Upgrade notes/m);
    for (const term of [/D22/, /exp16/, /Stryker\.NET/, /mutation-check\.mjs/, /mutation-<slice>\.md/, /equivalent/, /red check[^\n]*removed|removed[^\n]*red check/i]) assert.match(body, term, `the 2.6.4 entry does not say ${term}`);
    assert.ok(notes, 'the 2.6.4 entry has no upgrade notes');
    for (const term of [/red-record\.json/, /RegressionGuard/, /--logger trx/, /dotnet tool restore/, /Mutation threshold/, /Test projects/, /feed/i]) assert.match(notes, term, `the upgrade notes do not say ${term}`);
    // The kit does not carry the design spec (_specs/KitLean); the CHANGELOG records D22 and exp16.
    assertHooksPinned();
  });
});

// Slice 25: kit 2.6.5 (the owner's decision of 2026-11-25, D23, BR-85 to BR-89, AC-89 to AC-93), from the benchmark
// exp17 (Opus) and exp18 (Sonnet): the mutation check mutates the slice's changed lines only and scores only mutants on
// them; survivors outside the slice are never a reason for a test; the outer test enters through the page; build-slice
// is recommended on Sonnet 5.5.

const SLICE_DIFF = [
  'diff --git a/src/App/Export.cs b/src/App/Export.cs',
  'index 1111111..2222222 100644',
  '--- a/src/App/Export.cs',
  '+++ b/src/App/Export.cs',
  '@@ -4,0 +5,2 @@ public static class Export',
  '+    public static string Csv(int n) => n > 0 ? "a" : "b";',
  '+++ b/not/a/header.cs',
  '@@ -10 +12 @@ public static class Export',
  '-        return 1;',
  '+        return 2;',
  '@@ -20,3 +22,0 @@ public static class Export',
  '-        a();',
  '-        b();',
  '-        c();',
  'diff --git a/src/App/New.cs b/src/App/New.cs',
  'new file mode 100644',
  'index 0000000..3333333',
  '--- /dev/null',
  '+++ b/src/App/New.cs',
  '@@ -0,0 +1,3 @@',
  '+namespace App;',
  '+',
  '+public class New { }',
  'diff --git a/src/App/Old.cs b/src/App/Old.cs',
  'deleted file mode 100644',
  'index 4444444..0000000',
  '--- a/src/App/Old.cs',
  '+++ /dev/null',
  '@@ -1,2 +0,0 @@',
  '-namespace App;',
  '-public class Old { }',
  ''].join('\n');

describe('KitLean slice 25: kit 2.6.5, mutate the changed lines only, the outer test through the page', () => {
  const mutationModule = () => import(pathToFileURL(join(KIT, MUTATION_SCRIPT)).href);

  test('AC-89: the changed line ranges of a git diff -U0: added or modified lines only, per file; deletion-only hunks and deleted files have none', async () => {
    const { changedRanges } = await mutationModule();
    const ranges = changedRanges(SLICE_DIFF);
    assert.deepEqual(Object.fromEntries(ranges), { 'src/App/Export.cs': [[5, 6], [12, 12]], 'src/App/New.cs': [[1, 3]] });
  });

  test('AC-89: line ranges become Stryker.NET mutate spans of character indices (BOM left out, CRLF counted), one --mutate pattern per range', async () => {
    const { characterSpans, mutatePatterns } = await mutationModule();
    const text = '﻿l1\r\nline2\r\n\r\nl4';
    assert.deepEqual(characterSpans(text, [[2, 2], [3, 4]]), [[4, 9], [11, 15]]);
    assert.deepEqual(characterSpans(text, [[4, 9]]), [[13, 15]], 'a range past the last line is not cut at the end of the file');
    assert.deepEqual(mutatePatterns('Pages/Export.cs', text, [[1, 1], [4, 4]]), ['Pages/Export.cs{0..2}', 'Pages/Export.cs{13..15}']);
    assert.deepEqual(mutatePatterns('Guard.cs', text, null), ['Guard.cs'], 'a whole new file is not mutated whole');
  });

  test('AC-89: the report filter keeps only the mutants whose location intersects a changed range; the others are outside the slice', async () => {
    const { sliceMutants } = await mutationModule();
    const at = (file, line, endLine = line) => ({ file, line, endLine, mutator: 'm', status: 'Survived' });
    const ranges = new Map([['src/App/Export.cs', [[5, 6], [12, 12]]], ['src/App/Guard.cs', null]]);
    const mutants = [at('src/App/Export.cs', 5), at('src/App/Export.cs', 3), at('src/App/Export.cs', 2, 5), at('src/App/Export.cs', 7, 11),
      at('src/App/Export.cs', 12), at('src/App/Guard.cs', 40), at('src/App/Other.cs', 5)];
    const { inside, outside } = sliceMutants(mutants, ranges);
    assert.deepEqual(inside.map((m) => `${m.file}:${m.line}`), ['src/App/Export.cs:5', 'src/App/Export.cs:2', 'src/App/Export.cs:12', 'src/App/Guard.cs:40']);
    assert.deepEqual(outside.map((m) => `${m.file}:${m.line}`), ['src/App/Export.cs:3', 'src/App/Export.cs:7', 'src/App/Other.cs:5']);
  });

  test('outer test (AC-89): Stryker.NET mutates only the changed lines of a changed file (a new file whole); the score, the list and the evidence count only mutants on them, the rest on one line "outside the slice"', () => {
    const { dir, base } = mutationProject();
    withScript(dir);
    const report = strykerReport(dir, [['Killed', 5, 'A'], ['Killed', 5, 'B'], ['Killed', 5, 'C'], ['Killed', 5, 'D'], ['Survived', 5, 'In slice mutation'],
      ['Survived', 3, 'Old code mutation'], ['NoCoverage', 1, 'Old block mutation']]);
    const run = mutationCheck(dir, report, ['--slice', 'slice-1', '--base', base]);
    assert.equal(run.status, 0, `mutants outside the slice's changed lines were scored: ${run.output}`);
    const args = run.calls.find((c) => c.args[2] === 'dotnet-stryker').args;
    const text = readFileSync(join(dir, 'src/App/Export.cs'), 'utf8');
    const start = text.indexOf('    public static string Csv');
    const end = text.indexOf('\n', start);
    assert.deepEqual(args.flatMap((a, i) => (a === '--mutate' ? [args[i + 1]] : [])).sort(), [`Export.cs{${start}..${end}}`, 'Guard.cs', 'Pages/Counter.razor'],
      'not the changed lines of Export.cs and the whole new files');
    assert.match(run.output, /^mutation: score 80% \(killed 4, survived 1, no coverage 0, timeout 0\)$/m, run.output);
    assert.match(run.output, /^outside the slice: 2 \(not scored\)$/m, 'the mutants outside the slice are not counted on one line');
    assert.match(run.output, /Export\.cs:5 In slice mutation/);
    assert.doesNotMatch(run.output, /Old code mutation|Old block mutation/, 'a mutant outside the slice is listed');
    const evidence = readFileSync(join(dir, '_specs/Export/mutation-slice-1.md'), 'utf8');
    assert.match(evidence, /^outside the slice: 2 \(not scored\)$/m, 'the evidence does not count the mutants outside the slice');
    assert.doesNotMatch(evidence, /Old code mutation|Old block mutation/, 'the evidence lists a mutant outside the slice');
    assert.match(lineOf(evidence, /src\/App\/Export\.cs/, 'the Export.cs line'), /lines? 5\b/, 'the evidence does not name the changed lines mutated');
  });

  test('AC-90: build-slice and the testing guideline: a survivor outside the slice\'s changed lines is never a reason for a test; tests of existing behaviour are out of scope unless the spec asks; R-1 to R-7 pointed to; build-slice at most 45 lines', () => {
    const text = skill('build-slice');
    assert.ok(text.split(/\r?\n/).length <= 45, `build-slice has ${text.split(/\r?\n/).length} lines`);
    const guideline = read(TESTING_FOR_AGENTS);
    for (const [name, body] of [['build-slice', text], ['the testing guideline', guideline]]) {
      assert.match(body, /changed lines/i, `${name} does not say the check mutates the changed lines`);
      assert.match(body, /outside the slice[^\n]*never a reason to add (a )?tests?|never a reason to add (a )?tests?[^\n]*outside the slice/i, `${name} lets a survivor outside the slice ask for a test`);
      assert.match(body, /existing behaviou?r[^\n]*out of scope unless the spec asks/i, `${name} does not put tests of existing behaviour out of scope`);
      assert.match(body, /R-1 to R-7/, `${name} does not point to R-1 to R-7`);
    }
  });

  test('outer test (AC-91): the outer integration test enters through the page or component the user uses, never through the view model, on the real Presentation DI container; a stub slice\'s test is that same integration test, not a separate bUnit test', () => {
    const PAGE = /through the page or component the user uses/i;
    const NOT_VM = /not through the view model|never through the view model/i;
    const FAKED = /browser edge( \([^)]*\))?, (the )?clock, auth and (the )?backend client/i;
    const STUB = /stub slice[^\n]*(same|this|the) (Presentation )?integration test[^\n]*stub as the faked backend client[^\n]*not a (separate )?bUnit test/i;
    const slices = section(read(RULES_FILE), 'Slices');
    for (const term of [PAGE, NOT_VM, FAKED, /grid rows, sort(ing)?,? (and )?paging/i]) assert.match(slices, term, `the rules' Slices does not say ${term}`);
    const building = section(skill('build-slice'), 'Test-driven without exception');
    for (const term of [PAGE, NOT_VM, FAKED, STUB]) assert.match(building, term, `build-slice does not say ${term}`);
    const lines = read(SETTINGS_TEMPLATE).split(/\r?\n/);
    const integration = lines.find((l) => l.startsWith('- **Integration test**'));
    for (const term of [PAGE, NOT_VM, FAKED]) assert.match(integration, term, `the Integration test line does not say ${term}`);
    assert.match(lines.find((l) => l.startsWith('- **UI test**')), STUB, 'the UI test line still makes a stub slice\'s test a bUnit test');
    const guideline = read(TESTING_FOR_AGENTS);
    assert.doesNotMatch(guideline, /a UI test on the stubbed service for a stub slice/i, 'the order still makes a stub slice\'s test a UI test');
    assert.match(section(guideline, 'The order'), STUB, 'the order does not make a stub slice\'s test the Presentation integration test');
    const r3 = lineOf(guideline, /^\| R-3 \|/, 'R-3');
    assert.doesNotMatch(r3, /the page or the view model/i, 'R-3 still lets the integration test enter through the view model');
    for (const term of [PAGE, NOT_VM]) assert.match(r3, term, `R-3 does not say ${term}`);
  });

  test('AC-92: the README and the Project settings template recommend Sonnet 5.5 for build-slice (exp18: same quality floor at 3.22 against 5.78 USD); spec writing and review stay on the stronger model', () => {
    const readme = read('README.md');
    assert.match(readme, /build-slice[^\n]*Sonnet 5\.5|Sonnet 5\.5[^\n]*build-slice/, 'the README does not recommend Sonnet 5.5 for build-slice');
    assert.match(readme, /3\.22[^\n]*5\.78/, 'the README does not give the exp18 cost');
    assert.match(readme, /spec writing and (the )?review[^\n]*stronger model/i, 'the README does not keep spec writing and review on the stronger model');
    const model = lineOf(read(SETTINGS_TEMPLATE), /^- \*\*Models?\*\*/, 'the Model line');
    for (const term of [/build-slice/, /Sonnet 5\.5/, /spec writing/i, /review/i, /stronger model/i, /Opus 5\.5/]) assert.match(model, term, `the Model line does not say ${term}`);
  });

  test('outer test (AC-93): 2.6.5 in the rules, plugin.json and the recorded versions; CHANGELOG 2.6.5 above 2.6.4 with upgrade notes, D23, exp17 and exp18; both hooks pinned', () => {
    assert.equal(read(RULES_FILE).split(/\r?\n/)[0], `<!-- spec-driven-kit ${VERSION} -->`, `the rules file is not ${VERSION}`);
    assert.equal(JSON.parse(read('.claude-plugin/plugin.json')).version, VERSION, `plugin.json is not ${VERSION}`);
    const changelog = read('CHANGELOG.md');
    const [newest, previous] = positions(changelog, [/^## 2\.6\.5 /m, /^## 2\.6\.4 /m]);
    assert.ok(newest < previous, 'the 2.6.5 entry is not above 2.6.4');
    const [body, notes] = changelog.slice(newest, previous).split(/^### Upgrade notes/m);
    for (const term of [/D23/, /exp17/, /exp18/, /changed lines/i, /outside the slice: n \(not scored\)/, /page or component/i, /stub slice/i, /Sonnet 5\.5/, /R-1 to R-7/]) {
      assert.match(body, term, `the 2.6.5 entry does not say ${term}`);
    }
    assert.ok(notes, 'the 2.6.5 entry has no upgrade notes');
    for (const term of [/\/setup/, /mutation-<slice>\.md|mutation-<n>\.md/, /view model/i]) assert.match(notes, term, `the upgrade notes do not say ${term}`);
    // The kit does not carry the design spec (_specs/KitLean); the CHANGELOG records D23, exp17 and exp18.
    assertHooksPinned();
  });
});

// Kit 3.0.0: a generic .NET harness. The removed names are spelled in parts so that this file passes its own scan.
const REMOVED_NAMES = [['so', 'nar'], ['code', '-analysis'], ['nuget', '-packaging'], ['fix', '-violations'], ['ri', 'ziv'], ['in', 'ami'], ['ni', 'hdi'],
  ['findmy', 'doctor'], ['sm', 'als'], ['dev', '.azure'], ['visualstudio', '.com'], ['t', 'fs']].map((parts) => parts.join(''));
/** Every file of the kit folder except git's own data, relative, with forward slashes. */
function kitTree() {
  return readdirSync(KIT, { recursive: true }).map((p) => String(p).replace(/\\/g, '/'))
    .filter((p) => !p.startsWith('.git/') && p !== '.git' && !p.startsWith('node_modules/') && !p.startsWith('artifacts/'));
}

describe('kit 3.0.0: a generic .NET harness', () => {
  test('no file of the kit, by name or content, names a removed pack item, the removed server analysis or an organisation', () => {
    const files = kitTree();
    for (const name of REMOVED_NAMES) {
      const pattern = new RegExp(name.replace(/[.\-]/g, '\\$&'), 'i');
      assert.deepEqual(files.filter((p) => pattern.test(p)), [], `a file name holds ${name}`);
      const hits = files.filter((p) => { try { return pattern.test(readFileSync(join(KIT, p), 'utf8')); } catch { return false; } });
      assert.deepEqual(hits, [], `files that name ${name}`);
    }
  });

  test('the kit has only the dotnet-shared pack; no turn budget, no home-made red check, no sub-agent per build or test command', () => {
    assert.deepEqual(readdirSync(join(KIT, 'packs')), ['dotnet-shared']);
    const texts = kitTexts().map(read).join('\n');
    assert.doesNotMatch(texts, /turn budget|turn limit/i, 'a kit text states a turn budget');
    assert.doesNotMatch(read('hooks/verify.mjs'), /redRecord|red-record|--start|RegressionGuard/, 'verify.mjs still holds the red check');
    assert.doesNotMatch(skill('build-slice'), /sub-?agent[^\n]*(build|test) command|(build|test) command[^\n]*sub-?agent/i, 'build-slice runs a sub-agent per command');
  });
});

/** A path with its symbolic links resolved, so a temporary folder compares equal on every platform. */
function realPath(path) {
  return realpathSync(path);
}
