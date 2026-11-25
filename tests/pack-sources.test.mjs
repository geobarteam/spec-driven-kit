// Unit tests over the pack sources as data, and over the check functions with planted examples.
// Kit 3.0.0: one pack, dotnet-shared (the testing guideline for agents and the mutation check).

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, test } from 'node:test';
import { br5Violations, frontmatterField, frontmatterList, frontmatterName, packValueLabels, references, templatePackValues } from '../tools/pack-checks.mjs';
import { kitPacks, missingNeeds, packSources, readPack } from '../tools/packs.mjs';
import { KIT } from './helpers.mjs';

const packs = kitPacks(KIT);
const sources = packs.flatMap((pack) => packSources(KIT, pack).map((source) => ({ pack, ...source })));
const TEMPLATE = join(KIT, '.claude/templates/project-settings.md');
/** The agents and skills an item of the pack may refer to (BR-4): its pack's and those of the packs it needs. */
const knownNames = (pack) => {
  const declared = readPack(KIT, pack);
  return new Set([pack, ...declared.needs].flatMap((name) => { const p = readPack(KIT, name); return [...p.agents, ...p.skills]; }));
};

describe('pack layout', () => {
  test('3.0.0: the kit has one pack, dotnet-shared, with the testing guideline for agents and the mutation check, needing no other pack', () => {
    assert.deepEqual(packs, ['dotnet-shared']);
    const shared = readPack(KIT, 'dotnet-shared');
    assert.deepEqual(shared.rules, ['testing-for-agents']);
    assert.deepEqual(shared.scripts, ['mutation-check.mjs']);
    assert.deepEqual(shared.agents, []);
    assert.deepEqual(shared.skills, []);
    assert.deepEqual(shared.needs, []);
    assert.deepEqual(shared.dotnetTools, { 'dotnet-stryker': '5.1.0' });
  });

  test('BR-2: missingNeeds names no missing pack for the kit\'s packs, alone or together', () => {
    assert.deepEqual(missingNeeds(KIT, ['dotnet-shared']), []);
    assert.deepEqual(missingNeeds(KIT, []), []);
  });

  test('frontmatterList reads a list field in its block and inline forms', () => {
    assert.deepEqual(frontmatterList('---\npaths:\n  - "src/**/*.cs"\n  - \'**/*.csproj\'\n---\nbody', 'paths'), ['src/**/*.cs', '**/*.csproj']);
    assert.deepEqual(frontmatterList('---\npaths: ["src/Test/**"]\nname: x\n---\nbody', 'paths'), ['src/Test/**']);
    assert.deepEqual(frontmatterList('---\nname: x\n---\nbody', 'paths'), []);
    assert.equal(frontmatterList('# no frontmatter\n', 'paths'), null);
  });

  test('AC-13: every agent, skill, rule and script a pack declares has its file', () => {
    const targets = new Set(sources.map((s) => s.target));
    for (const pack of packs) {
      const declared = readPack(KIT, pack);
      for (const agent of declared.agents) assert.ok(targets.has(`.claude/agents/${agent}.md`), `pack ${pack} declares agent ${agent} without a file`);
      for (const skill of declared.skills) assert.ok(targets.has(`.claude/skills/${skill}/SKILL.md`), `pack ${pack} declares skill ${skill} without a file`);
      for (const rule of declared.rules) assert.ok(targets.has(`.claude/rules/${rule}.md`), `pack ${pack} declares rule ${rule} without a file`);
      for (const script of declared.scripts) assert.ok(targets.has(`scripts/${script}`), `pack ${pack} declares script ${script} without a file`);
    }
  });

  test('AC-5: no pack file lies under the kit\'s .claude folder, and no kit file stands at a pack file\'s target', () => {
    assert.ok(sources.length >= 2, 'there are pack sources');
    for (const source of sources) {
      assert.ok(!source.rel.startsWith('.claude/'), `${source.rel} lies under the kit's .claude folder`);
      const scriptsTarget = source.rel.split('/')[2] === 'scripts';
      assert.ok(source.target.startsWith(scriptsTarget ? 'scripts/' : '.claude/'), `${source.rel} does not land where its kind belongs`);
      assert.ok(!existsSync(join(KIT, source.target)), `the kit has its own file at ${source.target}`);
    }
  });

  test('every pack rule is path-scoped', () => {
    for (const source of sources.filter((s) => s.target.startsWith('.claude/rules/'))) {
      assert.ok((frontmatterList(source.text, 'paths') ?? []).length > 0, `${source.rel} has no paths scope`);
    }
  });
});

describe('BR-4: every @<name> in a pack item names an agent or skill of its pack or of a pack it needs', () => {
  test('AC-7: every reference resolves', () => {
    for (const source of sources) {
      const known = knownNames(source.pack);
      for (const ref of references(source.text)) {
        assert.ok(known.has(ref.name), `${source.rel}:${ref.line} @${ref.name} is not an agent or skill of pack ${source.pack} or of a pack it needs`);
      }
    }
  });

  test('AC-7: a planted dangling reference is found', () => {
    assert.deepEqual(references('Hand over to @nobody when done.'), [{ name: 'nobody', line: 1 }]);
  });

  test('AC-7: a package scope, an e-mail address, a remote with a user and a git revision are not references', () => {
    const text = [
      'npm install @scope/package',
      'mail someone@example.com',
      'https://user@git.example.com/org/repo.git',
      'git show HEAD@{1}',
    ].join('\n');
    assert.deepEqual(references(text), []);
  });

  test('AC-7: a planted display name in the frontmatter is found', () => {
    assert.equal(frontmatterName('---\nname: Some Display Name\ndescription: x\n---\nbody'), 'Some Display Name');
    assert.equal(frontmatterName('# No frontmatter\n'), null);
    for (const source of sources.filter((s) => s.target.startsWith('.claude/agents/') && frontmatterName(s.text) !== null)) {
      assert.equal(frontmatterName(source.text), basename(source.rel, '.md'), `${source.rel} has another name in its frontmatter`);
    }
  });
});

describe('BR-5: no pack item asks for, prints or passes a secret', () => {
  test('AC-11: no pack item holds a pattern of BR-5', () => {
    for (const source of sources) {
      const found = br5Violations(source.text).map((v) => `${source.rel}:${v.line} ${v.pattern}`);
      assert.deepEqual(found, [], `BR-5 violated in ${source.rel}`);
    }
  });

  for (const [planted, pattern] of [
    ['Run the secrets pull command first.', 'secrets pull'],
    ['Please paste your token here.', 'paste your'],
    ['[System.Environment]::SetEnvironmentVariable("GIT_HOST_PAT", "<personal-access-token>", "User")', 'user variable from a literal'],
    ['setx GIT_HOST_PAT abc123', 'user variable from a literal'],
    ['$env:GIT_HOST_PAT = "<pat>"', 'secret variable from a literal'],
    ['$apiKey = \'abc123\'', 'secret variable from a literal'],
    ['export NUGET_API_KEY=abc123', 'secret variable from a literal'],
    ['Write-Host $env:GIT_HOST_PAT', 'secret variable in the output'],
    ['echo "token: $NUGET_TOKEN"', 'secret variable in the output'],
    ['git-host login --pat <personal-access-token>', 'option with a token placeholder'],
    ['some-tool --login=<token>', 'option with a token placeholder'],
    ['curl -u :<your-pat> $url', 'option with a token placeholder'],
    ['psql -p <password>', 'option with a token placeholder'],
  ]) {
    test(`AC-11: a planted ${pattern} fails: ${planted}`, () => {
      const found = br5Violations(`first line\n${planted}`);
      assert.deepEqual(found, [{ line: 2, pattern }]);
    });
  }

  test('AC-11: the sentence "Never ask the user to paste the token into chat" passes', () => {
    assert.deepEqual(br5Violations('Never ask the user to paste the token into chat.'), []);
  });

  test('AC-11: a variable read from the environment or a masked prompt, a path variable and a message naming the variable pass', () => {
    const text = [
      '$env:GIT_HOST_PAT = [System.Environment]::GetEnvironmentVariable("GIT_HOST_PAT", "User")',
      '[System.Environment]::SetEnvironmentVariable("GIT_HOST_PAT", [System.Net.NetworkCredential]::new("", (Read-Host "Git host PAT" -AsSecureString)).Password, "User")',
      'setx GIT_HOST_PAT $pat',
      'throw "Missing environment variable: GIT_HOST_PAT"',
      '$path = "<repository root>"',
      'echo "Set GIT_HOST_PAT first"',
      'git-host bootstrap --token-auth --url $url --password $env:GIT_HOST_PAT',
    ].join('\n');
    assert.deepEqual(br5Violations(text), []);
  });

  test('frontmatterField reads one field of the frontmatter', () => {
    const text = '---\nname: some-agent\ntools: Read, Glob, Grep\n---\nbody';
    assert.equal(frontmatterField(text, 'tools'), 'Read, Glob, Grep');
    assert.equal(frontmatterField(text, 'description'), '');
    assert.equal(frontmatterField('body only', 'tools'), null);
  });
});

describe('Pack values: the labels the pack items read from CLAUDE.md § Project settings', () => {
  const template = templatePackValues(readFileSync(TEMPLATE, 'utf8'));
  const allowed = (pack) => new Set([pack, ...readPack(KIT, pack).needs]);

  test('AC-14: the template holds the Pack values lines of dotnet-shared, Test projects and Mutation threshold, each marked with its pack', () => {
    for (const line of template) {
      assert.ok(packs.includes(line.pack), `template line ${line.line} (${line.label}) is marked with ${line.pack}, which is not a pack of the kit`);
    }
    assert.deepEqual(template.map((v) => [v.pack, v.label]), [['dotnet-shared', 'Test projects'], ['dotnet-shared', 'Mutation threshold']]);
  });

  test('AC-14: every Pack values label a pack item names is a template line marked with the item\'s pack or a pack it needs', () => {
    let named = 0;
    for (const source of sources) {
      for (const label of packValueLabels(source.text)) {
        named += 1;
        const line = template.find((v) => v.label === label);
        assert.ok(line, `${source.rel} names the Pack values line "${label}", which the template does not have`);
        assert.ok(allowed(source.pack).has(line.pack), `${source.rel} (pack ${source.pack}) names "${label}", a line of pack ${line.pack}`);
      }
    }
    assert.ok(named >= 1, 'no pack item names a Pack values line');
  });

  test('AC-14: every Pack values line of the template is named by at least one item of its pack', () => {
    for (const line of template) {
      const items = sources.filter((s) => s.pack === line.pack && packValueLabels(s.text).includes(line.label));
      assert.ok(items.length >= 1, `no item of pack ${line.pack} names the template line "${line.label}"`);
    }
  });

  test('AC-14: a planted unknown label is found and is not a template line', () => {
    const labels = packValueLabels('Read `CLAUDE.md` § Project settings, Pack values, line **Server host**, and stop when it is missing.');
    assert.deepEqual(labels, ['Server host']);
    assert.ok(!template.some((v) => v.label === 'Server host'));
  });

  test('AC-14: packValueLabels takes every bold label after "Pack values" on a line, once, and nothing from other lines', () => {
    const text = [
      'Under `### Pack values`: **Test projects** and **Mutation threshold**.',
      'The **Browser tool** line of Project settings is not a pack value.',
      'When the Pack values line **Test projects** is missing, stop.',
    ].join('\n');
    assert.deepEqual(packValueLabels(text), ['Test projects', 'Mutation threshold']);
  });

  test('AC-14: templatePackValues reads label and pack of each line under the heading, and nothing outside it', () => {
    const text = [
      '## Project settings',
      '- **Reference feature**: x',
      '### Pack values',
      '',
      '<!-- a comment -->',
      '- **Test projects**: `<x>` <!-- pack dotnet-shared: the test projects -->',
      '- **Mutation threshold**: `80` <!-- pack dotnet-shared -->',
      '',
      '### Test levels',
      '- **Integration test**: y <!-- pack bogus -->',
    ].join('\n');
    assert.deepEqual(templatePackValues(text), [
      { label: 'Test projects', pack: 'dotnet-shared', line: 6 },
      { label: 'Mutation threshold', pack: 'dotnet-shared', line: 7 },
    ]);
    assert.deepEqual(templatePackValues('## Project settings\n- **Reference feature**: x\n'), []);
  });
});
