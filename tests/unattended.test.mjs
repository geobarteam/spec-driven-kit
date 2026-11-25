// Tests of kit 2.4.0, "unattended": the shipped settings no longer hold the static ask rules for
// commit and push (the guard answers instead), the review agents hand their report back through a
// file under artifacts/, every documented test-executable command uses forward slashes, and the
// version and the changelog say so. Integration: the installer of a copy of the kit against a
// fixture. Unit: the kit's texts as data.

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { backslashPathViolations, frontmatterField } from '../tools/pack-checks.mjs';
import { kitPacks, packSources } from '../tools/packs.mjs';
import { KIT, cleanup, install, kitCopy, project, record } from './helpers.mjs';

const VERSION = '2.4.0';
// The kit's current version (Lean 2.5.0 slice 6): what an update records and what the rules and plugin.json carry.
const KIT_VERSION = '3.0.0';
const SETTINGS = '.claude/settings.json';
const FRAGMENT = '.claude/templates/settings-fragment.json';
const KIT_ASK = [
  'Bash(git commit)', 'Bash(git commit *)', 'Bash(git push)', 'Bash(git push *)',
  'PowerShell(git commit)', 'PowerShell(git commit *)', 'PowerShell(git push)', 'PowerShell(git push *)',
];
const read = (dir, rel) => readFileSync(join(dir, rel), 'utf8');
const json = (dir, rel) => JSON.parse(read(dir, rel));
const isGuard = (entry) => JSON.stringify(entry).includes('guard.mjs');

describe('slice test: a 2.1.0 project updated to this kit loses the static ask rules the kit added, keeps its own permission entries and the guard, and records the version', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('slice test (AC-S1, AC-S2): on update, the eight ask entries of 2.1.0 are removed from settings.json, the project\'s own ask and deny entries and hooks stay, the guard stays, addedAsk is empty and the version is the kit\'s', () => {
    const dir = project('project-2.1.0');
    const before = json(dir, SETTINGS);
    assert.deepEqual(before.permissions.ask, KIT_ASK, 'the fixture holds the eight entries of 2.1.0');
    before.permissions.ask.push('Bash(rm -rf node_modules)');
    before.permissions.deny = ['Bash(curl *)'];
    before.hooks.PreToolUse.push({ matcher: 'Bash', hooks: [{ type: 'command', command: 'node', args: ['own-hook.mjs'] }] });
    writeFileSync(join(dir, SETTINGS), JSON.stringify(before, null, 2) + '\n');

    const run = install(kit, 'apply', dir);
    assert.equal(run.status, 0, run.output);
    const after = json(dir, SETTINGS);
    assert.deepEqual(after.permissions.ask, ['Bash(rm -rf node_modules)'], 'the kit\'s ask entries were not removed, or the project\'s own was');
    assert.deepEqual(after.permissions.deny, ['Bash(curl *)'], 'the project\'s deny entries changed');
    assert.equal(after.hooks.PreToolUse.filter(isGuard).length, 2, 'the guard entries changed');
    assert.ok(after.hooks.PreToolUse.some((entry) => JSON.stringify(entry).includes('own-hook.mjs')), 'the project\'s own hook is gone');
    assert.deepEqual(record(dir).addedAsk, []);
    assert.equal(record(dir).kitVersion, KIT_VERSION);
    assert.match(run.stdout, /permissions\.ask: removed 8 entr/, 'the output does not say what was removed');
  });

  test('AC-S1: a fresh install at level 2 adds the guard and no permission entry', () => {
    const dir = project();
    const run = install(kit, 'apply', dir, '--level', '2');
    assert.equal(run.status, 0, run.output);
    const settings = json(dir, SETTINGS);
    assert.equal(settings.permissions, undefined, 'permissions were written');
    assert.equal(settings.hooks.PreToolUse.filter(isGuard).length, 2);
    assert.deepEqual(record(dir).addedAsk, []);
  });

  test('AC-S1: a project that already asks for commit on its own keeps that entry through install and remove', () => {
    const dir = project();
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(join(dir, SETTINGS), JSON.stringify({ permissions: { ask: ['Bash(git commit *)'] } }) + '\n');
    assert.equal(install(kit, 'apply', dir, '--level', '2').status, 0);
    assert.deepEqual(json(dir, SETTINGS).permissions.ask, ['Bash(git commit *)']);
    assert.equal(install(kit, 'remove', dir).status, 0);
    assert.deepEqual(json(dir, SETTINGS).permissions.ask, ['Bash(git commit *)'], 'remove took the project\'s own entry');
    assert.equal(json(dir, SETTINGS).hooks?.PreToolUse?.some(isGuard) ?? false, false, 'the guard stayed after remove');
  });

  test('AC-S1: on update, the installer warns when permissions.deny blocks commit or push, because the guard cannot ask then', () => {
    const dir = project('project-2.1.0');
    const settings = json(dir, SETTINGS);
    settings.permissions.deny = ['Bash(git push *)'];
    writeFileSync(join(dir, SETTINGS), JSON.stringify(settings, null, 2) + '\n');
    const run = install(kit, 'apply', dir);
    assert.equal(run.status, 0, run.output);
    assert.match(run.stdout, /permissions\.deny already blocks: Bash\(git push \*\)/);
    assert.deepEqual(json(dir, SETTINGS).permissions.deny, ['Bash(git push *)'], 'the project\'s deny entry was changed');
  });
});

describe('AC-S1: the shipped settings fragment holds the guard and no permission rule', () => {
  test('the fragment has the two guard entries and no permissions block', () => {
    const fragment = JSON.parse(read(KIT, FRAGMENT));
    assert.equal(fragment.permissions, undefined, 'the fragment still ships permission rules');
    assert.equal(fragment.hooks.PreToolUse.length, 2);
    assert.ok(fragment.hooks.PreToolUse.every(isGuard));
  });
});

describe('AC-R1, AC-R2: the review agents hand back through a file, and the skills read it', () => {
  const agent = (name) => read(KIT, `.claude/agents/${name}.md`);

  // KitLean (2.5.0) BR-10: slice-verifier is retired; the two review agents left hand back through a file.
  test('AC-R1 (KitLean AC-10): slice-verifier is retired, so no agent writes a per-slice verifier report', () => {
    assert.ok(!existsSync(join(KIT, '.claude/agents/slice-verifier.md')), 'the kit still ships slice-verifier');
  });

  for (const [name, report] of [
    ['spec-critic', 'artifacts/<FeatureName>-critic-report.md'],
    ['spec-reviewer', 'artifacts/<FeatureName>-reviewer-report.md'],
  ]) {
    test(`AC-R1: ${name} has the Write tool, writes its report to ${report} and answers with one line`, () => {
      const text = agent(name);
      assert.match(frontmatterField(text, 'tools'), /\bWrite\b/, `${name} has no Write tool`);
      assert.ok(text.includes(report), `${name} does not name ${report}`);
      assert.match(text, /one line/i, `${name} does not say it answers with one line`);
      assert.match(text, /not committed|gitignored|ignored by git/i, `${name} does not say the report is not committed`);
    });
  }

  test('AC-R1: the read-only agents still say they change no other file', () => {
    for (const name of ['spec-critic', 'spec-reviewer']) assert.match(agent(name), /no other file|nothing else|only file you write/i, `${name} no longer limits its writes`);
  });

  // KitLean 2.6.0 (BR-60): the final review, and with it the reviewer's report, moved from build-slice to new-feature.
  test('AC-R2: new-feature reads the reviewer\'s report file and build-slice no verifier\'s (KitLean AC-10, 2.6.0 AC-62); write-spec reads the critic\'s', () => {
    assert.doesNotMatch(read(KIT, '.claude/skills/build-slice/SKILL.md'), /verifier-report/, 'build-slice still reads a verifier report');
    const build = read(KIT, '.claude/skills/new-feature/SKILL.md');
    assert.match(build, /artifacts\/<FeatureName>-reviewer-report\.md/);
    assert.match(build, /[Rr]ead (the|that|its) (report|file)/, 'new-feature does not read the report file');
    const spec = read(KIT, '.claude/skills/write-spec/SKILL.md');
    assert.match(spec, /artifacts\/<FeatureName>-critic-report\.md/);
  });

  test('AC-R2: the setup adds artifacts/ to the project\'s .gitignore, and the kit ignores it too', () => {
    assert.match(read(KIT, '.claude/skills/setup/SKILL.md'), /`artifacts\/`[^\n]*\.gitignore|\.gitignore[^\n]*`artifacts\/`/);
    assert.match(read(KIT, '.gitignore'), /^artifacts\/$/m);
  });

  test('AC-R2: the rules file tells the main session about the report channel and about jobs', () => {
    const rules = read(KIT, '.claude/rules/spec-driven.md');
    assert.match(rules, /artifacts\//);
    assert.match(rules, /ZYGGY_JOB/);
    assert.match(rules, /force-push/i);
  });
});

describe('AC-P1: every documented test-executable command uses forward slashes', () => {
  const kitTexts = () => {
    // KitLean 2.6.0 (BR-61): the slice-recap template is gone, so it is no longer scanned.
    const own = ['README.md', '.claude/rules/spec-driven.md', '.claude/templates/project-settings.md', '.claude/templates/spec-template.md',
      ...['amend-spec', 'bugfix', 'build-slice', 'investigate', 'new-feature', 'setup', 'write-spec'].map((s) => `.claude/skills/${s}/SKILL.md`),
      ...['spec-critic', 'spec-reviewer'].map((a) => `.claude/agents/${a}.md`)];
    const packs = kitPacks(KIT).flatMap((pack) => packSources(KIT, pack).map((s) => s.rel));
    return [...own, ...packs];
  };

  test('AC-P1: no rule, skill, agent, template, pack item or the README holds a backslash path to a test executable', () => {
    for (const rel of kitTexts()) {
      const found = backslashPathViolations(read(KIT, rel)).map((v) => `${rel}:${v.line} ${v.path}`);
      assert.deepEqual(found, [], `backslash path in ${rel}`);
    }
  });

  for (const [planted, path] of [
    ['Run `src\\Test\\Unit\\bin\\Debug\\net8.0\\My.Tests.exe --filter X`.', 'src\\Test\\Unit\\bin\\Debug\\net8.0\\My.Tests.exe'],
    ['dotnet test src\\Test\\Unit\\My.Tests.csproj', 'src\\Test\\Unit\\My.Tests.csproj'],
    ['.\\src\\Test\\run.ps1', '.\\src\\Test\\run.ps1'],
    ['C:\\Repos\\App\\src\\Test\\Unit\\My.Tests.dll', 'C:\\Repos\\App\\src\\Test\\Unit\\My.Tests.dll'],
  ]) {
    test(`AC-P1: a planted backslash path fails: ${planted}`, () => {
      assert.deepEqual(backslashPathViolations(`first line\n${planted}`), [{ line: 2, path }]);
    });
  }

  test('AC-P1: forward slashes, regex escapes, table escapes and a PowerShell pipeline pass', () => {
    for (const line of [
      'Run `src/Test/Unit/bin/Debug/net8.0/My.Tests.exe --filter X`.',
      'dotnet test src/Test/Unit/My.Tests.csproj',
      'Select-String -Pattern ": (warning|error) (SA|SX|CA|CS|MSTEST)\\d+"',
      '| `S1` and `S108` | a \\| b |',
      'const rel = path.split("\\\\").join("/");',
      'the repositories live under one root, e.g. <reposRoot>\\shared\\tools',
    ]) assert.deepEqual(backslashPathViolations(line), [], line);
  });

  test('AC-P1: the Project settings template and the setup say the commands are written with forward slashes', () => {
    assert.match(read(KIT, '.claude/templates/project-settings.md'), /forward slash/i);
    assert.match(read(KIT, '.claude/skills/setup/SKILL.md'), /forward slash/i);
  });
});

describe('AC-V1: the kit is 2.4.0 or later and the changelog says what 2.4.0 changed', () => {
  test('the rules file comment and plugin.json carry the kit\'s version; CHANGELOG.md has the 2.4.0 entry', () => {
    assert.match(read(KIT, '.claude/rules/spec-driven.md').split(/\r?\n/)[0], new RegExp(`spec-driven-kit ${KIT_VERSION.replace(/\./g, '\\.')}`));
    assert.equal(JSON.parse(read(KIT, '.claude-plugin/plugin.json')).version, KIT_VERSION);
    assert.ok(existsSync(join(KIT, 'CHANGELOG.md')), 'no CHANGELOG.md');
    const changelog = read(KIT, 'CHANGELOG.md');
    assert.match(changelog, new RegExp(`^## ${VERSION.replace(/\./g, '\\.')}`, 'm'));
    for (const term of [/ZYGGY_JOB/, /artifacts\//, /forward slash/i, /force-push/i]) assert.match(changelog, term);
  });

  test('the README no longer promises a static confirmation on commit and push, and describes the job behavior', () => {
    const readme = read(KIT, 'README.md');
    assert.doesNotMatch(readme, /the confirmation on commit and push/);
    assert.match(readme, /ZYGGY_JOB/);
    assert.match(readme, /artifacts\//);
  });
});
