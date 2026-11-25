// Unit tests over the pack sources as data, and over the check functions with planted examples.
// Spec: _specs/HarnessPacks/spec.md, BR-3 and BR-4.

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { br3Violations, br5Violations, frontmatterField, frontmatterList, frontmatterName, packValueLabels, references, templatePackValues } from '../tools/pack-checks.mjs';
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
  test('the kit has the operations, dotnet-shared, dotnet-library, blazor-server and blazor-wasm packs (Guidelines slice 6)', () => {
    assert.deepEqual(packs, ['blazor-server', 'blazor-wasm', 'dotnet-library', 'dotnet-shared', 'operations']);
  });

  test('§ Packs: the dotnet-library pack declares code-analysis, add-public-api, fix-violations and two rules (tests moved to dotnet-shared, Guidelines), and needs operations and dotnet-shared; operations needs nothing', () => {
    const library = readPack(KIT, 'dotnet-library');
    assert.deepEqual(library.agents, ['code-analysis']);
    assert.deepEqual([...library.skills].sort(), ['add-public-api', 'fix-violations']);
    assert.deepEqual([...library.rules].sort(), ['nuget-packaging', 'public-api']);
    assert.deepEqual(library.needs, ['operations', 'dotnet-shared']);
    assert.deepEqual(readPack(KIT, 'operations').needs, []);
  });

  test('AC-16: each rule of the dotnet-library pack has the path filter of § Packs', () => {
    for (const [rule, paths] of [['public-api', ['src/**/*.cs']], ['nuget-packaging', ['**/*.csproj']]]) {
      const source = sources.find((s) => s.target === `.claude/rules/${rule}.md`);
      assert.ok(source, `${rule} is not a pack source`);
      assert.deepEqual(frontmatterList(source.text, 'paths'), paths, `${rule} has another path filter`);
    }
  });

  test('BR-2: missingNeeds names every pack of the list whose needed pack is not in the list', () => {
    assert.deepEqual(missingNeeds(KIT, ['dotnet-library']), [{ pack: 'dotnet-library', needs: 'operations' }, { pack: 'dotnet-library', needs: 'dotnet-shared' }]);
    assert.deepEqual(missingNeeds(KIT, ['operations', 'dotnet-library']), [{ pack: 'dotnet-library', needs: 'dotnet-shared' }]);
    assert.deepEqual(missingNeeds(KIT, ['operations', 'dotnet-shared', 'dotnet-library']), []);
    assert.deepEqual(missingNeeds(KIT, ['dotnet-library', 'dotnet-shared', 'operations']), []);
    assert.deepEqual(missingNeeds(KIT, ['operations']), []);
    assert.deepEqual(missingNeeds(KIT, []), []);
  });

  test('frontmatterList reads a list field in its block and inline forms', () => {
    assert.deepEqual(frontmatterList('---\npaths:\n  - "src/**/*.cs"\n  - \'**/*.csproj\'\n---\nbody', 'paths'), ['src/**/*.cs', '**/*.csproj']);
    assert.deepEqual(frontmatterList('---\npaths: ["src/Test/**"]\nname: x\n---\nbody', 'paths'), ['src/Test/**']);
    assert.deepEqual(frontmatterList('---\nname: x\n---\nbody', 'paths'), []);
    assert.equal(frontmatterList('# no frontmatter\n', 'paths'), null);
  });

  test('AC-13: every agent, skill and rule a pack declares has its file, and the operations pack declares its two generic agents', () => {
    const targets = new Set(sources.map((s) => s.target));
    for (const pack of packs) {
      const declared = readPack(KIT, pack);
      for (const agent of declared.agents) assert.ok(targets.has(`.claude/agents/${agent}.md`), `pack ${pack} declares agent ${agent} without a file`);
      for (const skill of declared.skills) assert.ok(targets.has(`.claude/skills/${skill}/SKILL.md`), `pack ${pack} declares skill ${skill} without a file`);
      for (const rule of declared.rules) assert.ok(targets.has(`.claude/rules/${rule}.md`), `pack ${pack} declares rule ${rule} without a file`);
      for (const script of declared.scripts) assert.ok(targets.has(`scripts/${script}`), `pack ${pack} declares script ${script} without a file`);
    }
    assert.deepEqual([...readPack(KIT, 'operations').agents].sort(), ['git', 'sonar-review']);
  });

  test('AC-5: no pack file lies under the kit\'s .claude folder, and no kit file stands at a pack file\'s target', () => {
    assert.ok(sources.length >= 2, 'there are pack sources');
    for (const source of sources) {
      assert.ok(!source.rel.startsWith('.claude/'), `${source.rel} lies under the kit's .claude folder`);
      // Kit 2.6.4 (KitLean BR-82): a pack's scripts land in the project's own scripts/ folder; everything else under .claude/.
      const scriptsTarget = source.rel.split('/')[2] === 'scripts';
      assert.ok(source.target.startsWith(scriptsTarget ? 'scripts/' : '.claude/'), `${source.rel} does not land where its kind belongs`);
      assert.ok(!existsSync(join(KIT, source.target)), `the kit has its own file at ${source.target}`);
    }
  });
});

describe('BR-3: no leftover of the Copilot rule-sync tool in a pack item', () => {
  test('AC-6: no pack item holds a pattern of BR-3', () => {
    for (const source of sources) {
      const found = br3Violations(source.text).map((v) => `${source.rel}:${v.line} ${v.pattern}`);
      assert.deepEqual(found, [], `BR-3 violated in ${source.rel}`);
    }
  });

  for (const [planted, pattern] of [
    ['Open {{SolutionName}}.sln first.', 'token'],
    ['Run copilot-sync update when the templates change.', 'copilot-sync'],
    ['Read the solution name from .copilotrc.json.', '.copilotrc'],
    ['Hand over to @planner for the plan.', 'planner'],
    ['Then run build-feature.', 'build-feature'],
    ['Write the plan under _plans/.', '_plans'],
    ['See .github/agents/git.agent.md.', '.github/'],
    ['tools: Read, mcp_playwright_navigate', 'mcp_'],
  ]) {
    test(`AC-6: a planted ${pattern} fails`, () => {
      const found = br3Violations(`first line\n${planted}`);
      assert.deepEqual(found, [{ line: 2, pattern }]);
    });
  }

  test('AC-6: a clean line passes', () => {
    assert.deepEqual(br3Violations('Fetch the schema, then validate the map against it.'), []);
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

  test('AC-7: code-analysis hands over to @sonar-review, an agent of the pack dotnet-library needs, and no operations item refers to a dotnet-library item', () => {
    const codeAnalysis = sources.find((s) => s.target === '.claude/agents/code-analysis.md');
    assert.ok(codeAnalysis, 'code-analysis is not a pack source');
    assert.ok(references(codeAnalysis.text).some((ref) => ref.name === 'sonar-review'), 'code-analysis does not hand over to @sonar-review');
    assert.ok(!readPack(KIT, 'dotnet-library').agents.includes('sonar-review'));
    assert.ok(knownNames('dotnet-library').has('sonar-review'));
    const library = readPack(KIT, 'dotnet-library');
    const libraryNames = new Set([...library.agents, ...library.skills]);
    for (const source of sources.filter((s) => s.pack === 'operations')) {
      for (const ref of references(source.text)) assert.ok(!libraryNames.has(ref.name), `${source.rel}:${ref.line} refers to @${ref.name} of dotnet-library`);
    }
  });

  test('AC-7: every agent file with frontmatter has a name equal to its file name and is a declared agent of its pack', () => {
    const agents = sources.filter((s) => s.target.startsWith('.claude/agents/') && frontmatterName(s.text) !== null);
    assert.ok(agents.length >= 1, 'there is an agent');
    for (const source of agents) {
      const file = basename(source.rel, '.md');
      assert.equal(frontmatterName(source.text), file, `${source.rel} has another name in its frontmatter`);
      assert.ok(readPack(KIT, source.pack).agents.includes(file), `${file} is not a declared agent of pack ${source.pack}`);
    }
  });

  test('AC-7: a planted dangling reference is found', () => {
    assert.deepEqual(references('Hand over to @nobody when done.'), [{ name: 'nobody', line: 1 }]);
    assert.ok(!readPack(KIT, 'operations').agents.includes('nobody'));
  });

  test('AC-7: a package scope, an e-mail address, a remote with a user and a git revision are not references', () => {
    const text = [
      'npm install @scope/package',
      'mail someone@example.com',
      'https://org@git.example.com/org/project/_git/repo',
      'git show HEAD@{1}',
    ].join('\n');
    assert.deepEqual(references(text), []);
  });

  test('AC-7: a planted display name in the frontmatter is found', () => {
    assert.equal(frontmatterName('---\nname: Deploymentmap Guide\ndescription: x\n---\nbody'), 'Deploymentmap Guide');
    assert.equal(frontmatterName('# No frontmatter\n'), null);
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
    ['$env:AZDO_PAT = "<pat>"', 'secret variable from a literal'],
    ['$apiKey = \'abc123\'', 'secret variable from a literal'],
    ['export SONAR_TOKEN=abc123', 'secret variable from a literal'],
    ['Write-Host $env:AZDO_PAT', 'secret variable in the output'],
    ['echo "token: $SONAR_TOKEN"', 'secret variable in the output'],
    ['git-host login --pat <personal-access-token>', 'option with a token placeholder'],
    ['sonar-scanner -Dsonar.login=<token>', 'option with a token placeholder'],
    ['curl -u :<your-pat> $url', 'option with a token placeholder'],
    ['psql -p <password>', 'option with a token placeholder'],
    ['az k8s-configuration flux update -n cluster-config --https-user git --https-key <newPAT>', 'option with a token placeholder'],
  ]) {
    test(`AC-11: a planted ${pattern} fails: ${planted}`, () => {
      const found = br5Violations(`first line\n${planted}`);
      assert.deepEqual(found, [{ line: 2, pattern }]);
    });
  }

  test('AC-11: the sentence "Never ask the user to paste the token into chat" passes', () => {
    assert.deepEqual(br5Violations('Never ask the user to paste the token into chat.'), []);
  });

  test('AC-11: a variable read from the environment, a vault or a masked prompt, a path variable and a message naming the variable pass', () => {
    const text = [
      '$env:AZDO_PAT = [System.Environment]::GetEnvironmentVariable("GIT_HOST_PAT", "User")',
      '[System.Environment]::SetEnvironmentVariable("DYNATRACE_TOKEN_TST", (az keyvault secret show --vault-name <vault> --name <secret-name> --query value -o tsv), "User")',
      '[System.Environment]::SetEnvironmentVariable("GIT_HOST_PAT", [System.Net.NetworkCredential]::new("", (Read-Host "Git host PAT" -AsSecureString)).Password, "User")',
      'setx GIT_HOST_PAT $pat',
      'throw "Missing environment variable: GIT_HOST_PAT"',
      '$path = "<repository root>"',
      'echo "Set GIT_HOST_PAT first"',
      'flux bootstrap git --token-auth --url $url --password $env:FLUX_PAT',
      'az keyvault secret show --vault-name <vault> --name <secret-name> --query value -o tsv',
      'kubectl logs -n $ns <pod> --tail=200 > <path>',
    ].join('\n');
    assert.deepEqual(br5Violations(text), []);
  });

  test('AC-12: each agent that uses a token names its environment variable and how to store it', () => {
    // The private edition's operations pack: sonar-review is the one agent that uses a token.
    for (const [agent, variable] of [
      ['sonar-review', 'SONAR_TOKEN'],
    ]) {
      const source = sources.find((s) => s.target === `.claude/agents/${agent}.md`);
      assert.ok(source, `${agent} is not a pack source`);
      assert.ok(source.text.includes(variable), `${agent} does not name ${variable}`);
      assert.ok(source.text.includes(`SetEnvironmentVariable("${variable}"`), `${agent} does not say how to store ${variable}`);
    }
  });

  test('AC-12: sonar-review never shows the token and reads it from its variable only', () => {
    const text = sources.find((s) => s.target === '.claude/agents/sonar-review.md')?.text ?? '';
    assert.match(text, /Never display or echo the token value/);
    assert.match(text, /\$env:SONAR_TOKEN/);
  });

  test('frontmatterField reads one field of the frontmatter', () => {
    const text = '---\nname: pipeline-debug\ntools: Read, Glob, Grep\n---\nbody';
    assert.equal(frontmatterField(text, 'tools'), 'Read, Glob, Grep');
    assert.equal(frontmatterField(text, 'description'), '');
    assert.equal(frontmatterField('body only', 'tools'), null);
  });
});

describe('Pack values: the labels the pack items read from CLAUDE.md § Project settings', () => {
  // The contract of § Pack values in Project settings: an item names a line by writing "Pack values"
  // and the line's label in bold on the same line; the template marks each line with its pack.
  const template = templatePackValues(readFileSync(TEMPLATE, 'utf8'));
  const allowed = (pack) => new Set([pack, ...readPack(KIT, pack).needs]);

  test('AC-14: the template holds the Pack values lines, each marked with its pack', () => {
    assert.ok(template.length >= 1, 'the template has no Pack values line');
    for (const line of template) {
      assert.ok(packs.includes(line.pack), `template line ${line.line} (${line.label}) is marked with ${line.pack}, which is not a pack of the kit`);
    }
    assert.deepEqual(template.filter((v) => v.pack === 'operations').map((v) => v.label), ['Sonar server URL', 'Sonar project key']);
    // KitLean 2.6.4 (BR-82): the mutation check's two values.
    assert.deepEqual(template.filter((v) => v.pack === 'dotnet-shared').map((v) => v.label), ['Solution name', 'Namespace root', 'Unit-test command', 'Test projects', 'Mutation threshold']);
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
    const labels = packValueLabels('Read `CLAUDE.md` § Project settings, Pack values, line **Sonar host**, and stop when it is missing.');
    assert.deepEqual(labels, ['Sonar host']);
    assert.ok(!template.some((v) => v.label === 'Sonar host'));
  });

  test('AC-14: packValueLabels takes every bold label after "Pack values" on a line, once, and nothing from other lines', () => {
    const text = [
      'Under `### Pack values`: **Solution name**, **Namespace root** and **Unit-test command**.',
      'The **Browser tool** line of Project settings is not a pack value.',
      'When the Pack values line **Solution name** is missing, stop.',
    ].join('\n');
    assert.deepEqual(packValueLabels(text), ['Solution name', 'Namespace root', 'Unit-test command']);
  });

  test('AC-14: templatePackValues reads label and pack of each line under the heading, and nothing outside it', () => {
    const text = [
      '## Project settings',
      '- **Reference feature**: x',
      '### Pack values',
      '',
      '<!-- a comment -->',
      '- **Sonar project key**: `<project name>_<repository name>` <!-- pack operations: the project\'s key on the Sonar server -->',
      '- **Solution name**: `<name>` <!-- pack dotnet-library -->',
      '',
      '### Test levels',
      '- **Integration test**: y <!-- pack bogus -->',
    ].join('\n');
    assert.deepEqual(templatePackValues(text), [
      { label: 'Sonar project key', pack: 'operations', line: 6 },
      { label: 'Solution name', pack: 'dotnet-library', line: 7 },
    ]);
    assert.deepEqual(templatePackValues('## Project settings\n- **Reference feature**: x\n'), []);
  });
});
