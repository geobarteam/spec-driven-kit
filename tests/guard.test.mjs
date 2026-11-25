// Tests of the guard hook (.claude/hooks/guard.mjs), installed by a copy of the kit into a temporary
// project with a git repository, and fed tool calls on stdin the way Claude Code does.
// Unattended: kit 2.4.0, commit and push in jobs (ZYGGY_JOB) and the review agents' report channel.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { cleanup, install, kitCopy, project } from './helpers.mjs';

const GUARD = '.claude/hooks/guard.mjs';
const git = (dir, args) => execFileSync('git', ['-c', 'user.name=kit', '-c', 'user.email=kit@example.org', ...args], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** A project at level 2 with its config and a git repository on the given branch. */
function guardProject(kit, { branch = 'feature/x', protectedBranches = ['main'] } = {}) {
  const dir = project();
  const run = install(kit, 'apply', dir, '--level', '2');
  assert.equal(run.status, 0, run.output);
  const config = { specsDir: '_specs', protectedBranches, allowOnProtected: ['_specs/', '.claude/', 'CLAUDE.md'], verify: { shell: null, failPattern: null, commands: [] } };
  writeFileSync(join(dir, '.claude/spec-driven.json'), JSON.stringify(config, null, 2));
  git(dir, ['init', '-q', '-b', branch]);
  git(dir, ['commit', '-q', '--allow-empty', '-m', 'init']);
  return dir;
}

/** Runs the installed guard with a tool call on stdin, attended (no ZYGGY_JOB) or as a job. */
function guard(dir, input, { job = false } = {}) {
  const env = { ...process.env };
  delete env.ZYGGY_JOB;
  if (job) env.ZYGGY_JOB = '01TESTJOB';
  const run = spawnSync(process.execPath, [join(dir, GUARD)], { input: JSON.stringify(input), encoding: 'utf8', env });
  let decision = null;
  if (run.stdout.trim()) decision = JSON.parse(run.stdout).hookSpecificOutput?.permissionDecision ?? null;
  return { status: run.status, stdout: run.stdout, stderr: run.stderr, decision };
}

const bash = (command, agent) => ({ tool_name: 'Bash', tool_input: { command }, ...(agent ? { agent_type: agent } : {}) });
const pwsh = (command) => ({ tool_name: 'PowerShell', tool_input: { command } });
const write = (file_path, agent) => ({ tool_name: 'Write', tool_input: { file_path, content: 'x' }, ...(agent ? { agent_type: agent } : {}) });
const edit = (file_path, agent) => ({ tool_name: 'Edit', tool_input: { file_path, old_string: 'a', new_string: 'b' }, ...(agent ? { agent_type: agent } : {}) });

describe('slice test: a job commits on its branch without a prompt; an attended session is asked; protected branches, force-push and tag deletion are refused in both', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('slice test (AC-J1, AC-J2, AC-J3, AC-J4): git commit on a feature branch asks when attended and passes in a job; on main it is refused in both; git push --force and git tag -d are refused in both', () => {
    const feature = guardProject(kit);
    const attended = guard(feature, bash('git commit -m "feat: x"'));
    assert.equal(attended.status, 0, attended.stderr);
    assert.equal(attended.decision, 'ask', attended.stdout);

    const job = guard(feature, bash('git commit -m "feat: x"'), { job: true });
    assert.equal(job.status, 0, job.stderr);
    assert.equal(job.stdout.trim(), '', 'a job is not asked');

    const main = guardProject(kit, { branch: 'main' });
    for (const mode of [{ job: false }, { job: true }]) {
      const refused = guard(main, bash('git commit -m "feat: x"'), mode);
      assert.equal(refused.status, 2, `commit on main not refused (job: ${mode.job})`);
      assert.match(refused.stderr, /protected branch/);
      const force = guard(feature, bash('git push --force origin feature/x'), mode);
      assert.equal(force.status, 2, `force-push not refused (job: ${mode.job})`);
      const tag = guard(feature, bash('git tag -d v1.0.0'), mode);
      assert.equal(tag.status, 2, `tag deletion not refused (job: ${mode.job})`);
    }
  });
});

describe('AC-J1: commit and push in an attended session are answered with ask, never blocked and never silently allowed', () => {
  let kit;
  let dir;
  before(() => { kit = kitCopy(); dir = guardProject(kit); });
  after(cleanup);

  for (const command of [
    'git commit -m "feat: x"',
    'git commit',
    'git push',
    'git push origin feature/x',
    'git push -u origin HEAD',
    'git -C . commit -m "with a global option"',
    'git -c core.autocrlf=false commit -m "with a config option"',
    'git add -A && git commit -m "chained"',
    'git commit -m "feat: x" -m "a body that mentions git push --force in prose"',
  ]) {
    test(`AC-J1: ${command} -> ask`, () => {
      const run = guard(dir, bash(command));
      assert.equal(run.status, 0, run.stderr);
      assert.equal(run.decision, 'ask', run.stdout);
      assert.match(run.stdout, /permissionDecisionReason/);
    });
  }

  test('AC-J1: a commit message in a heredoc that mentions a force-push is still only asked', () => {
    const command = "git commit -F - <<'EOF'\nfeat: guard\n\nRefuse git push --force and git tag -d always.\nEOF";
    const run = guard(dir, bash(command));
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.decision, 'ask', run.stdout);
  });

  test('AC-J1: the PowerShell tool is treated like Bash', () => {
    const run = guard(dir, pwsh('git commit -m "feat: x"'));
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.decision, 'ask', run.stdout);
  });

  test('AC-J1: a git command that changes nothing, and a command without git, pass without a word', () => {
    for (const command of ['git status --porcelain', 'git log --oneline -5', 'git diff HEAD', 'git fetch origin', 'git switch -c feature/y origin/main', 'node .claude/hooks/verify.mjs', 'echo "git commit" > notes.txt']) {
      const run = guard(dir, bash(command));
      assert.equal(run.status, 0, `${command}: ${run.stderr}`);
      assert.equal(run.stdout.trim(), '', `${command} produced a decision`);
    }
  });
});

describe('AC-J2: with ZYGGY_JOB set, commit and push pass without a prompt', () => {
  let kit;
  let dir;
  before(() => { kit = kitCopy(); dir = guardProject(kit); });
  after(cleanup);

  for (const command of ['git commit -m "feat: x"', 'git push', 'git push origin feature/x', 'git push -u origin HEAD']) {
    test(`AC-J2: ${command} -> pass`, () => {
      const run = guard(dir, bash(command), { job: true });
      assert.equal(run.status, 0, run.stderr);
      assert.equal(run.stdout.trim(), '', run.stdout);
    });
  }
});

describe('AC-J3: on a protected branch, commit and push are refused attended and in a job', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  for (const branch of ['main', 'master', 'dev', 'release/1.4']) {
    test(`AC-J3: on ${branch} (not in the project's list), git commit and git push are refused`, () => {
      const dir = guardProject(kit, { branch, protectedBranches: ['main'] });
      for (const mode of [{ job: false }, { job: true }]) {
        for (const command of ['git commit -m "x"', 'git push', 'git push origin HEAD']) {
          const run = guard(dir, bash(command), mode);
          assert.equal(run.status, 2, `${command} on ${branch} not refused (job: ${mode.job})`);
          assert.match(run.stderr, /protected branch/);
        }
      }
    });
  }

  test("AC-J3: a branch of the project's own list (develop, hotfix/*) is protected too", () => {
    for (const branch of ['develop', 'hotfix/2.0.1']) {
      const dir = guardProject(kit, { branch, protectedBranches: ['main', 'develop', 'hotfix/*'] });
      const run = guard(dir, bash('git commit -m "x"'), { job: true });
      assert.equal(run.status, 2, `${branch} not refused`);
    }
  });

  test('AC-J3: a push that names a protected branch from a feature branch is refused; a push of the feature branch is not', () => {
    const dir = guardProject(kit);
    for (const command of ['git push origin HEAD:main', 'git push origin main', 'git push origin feature/x:dev', 'git push origin feature/x:refs/heads/release/2.0']) {
      const run = guard(dir, bash(command), { job: true });
      assert.equal(run.status, 2, `${command} not refused`);
      assert.match(run.stderr, /protected branch/);
    }
    const own = guard(dir, bash('git push origin feature/x'), { job: true });
    assert.equal(own.status, 0, own.stderr);
  });

  test('AC-J3: a feature branch whose name starts like a protected one is not protected', () => {
    for (const branch of ['main-fix', 'dev-tools', 'development']) {
      const dir = guardProject(kit, { branch });
      const run = guard(dir, bash('git commit -m "x"'), { job: true });
      assert.equal(run.status, 0, `${branch} refused: ${run.stderr}`);
    }
  });
});

describe('AC-J4: a force-push and a tag deletion are refused always', () => {
  let kit;
  let dir;
  before(() => { kit = kitCopy(); dir = guardProject(kit); });
  after(cleanup);

  for (const command of [
    'git push --force',
    'git push -f origin feature/x',
    'git push --force-with-lease origin feature/x',
    'git push --force-if-includes origin feature/x',
    'git push origin +feature/x',
    'git push origin +HEAD:refs/heads/feature/x',
    'git tag -d v1.0.0',
    'git tag --delete v1.0.0',
    'git push origin --delete v1.0.0',
    'git push -d origin v1.0.0',
    'git push origin :refs/tags/v1.0.0',
    'git push origin :v1.0.0',
    'git -C . push --force',
    'git push --force origin feature/x && echo done',
  ]) {
    for (const mode of [{ job: false }, { job: true }]) {
      test(`AC-J4: ${command} (job: ${mode.job}) -> refused`, () => {
        const run = guard(dir, bash(command), mode);
        assert.equal(run.status, 2, `${command}: ${run.stderr}`);
        assert.match(run.stderr, /force|delet/i);
      });
    }
  }

  test('AC-J4: a tag created, listed or pushed is not a deletion', () => {
    for (const command of ['git tag v1.0.0', 'git tag -a v1.0.0 -m "release"', 'git tag -l', 'git push origin v1.0.0', 'git push --tags']) {
      const run = guard(dir, bash(command), { job: true });
      assert.equal(run.status, 0, `${command} refused: ${run.stderr}`);
    }
  });
});

describe('The review agents keep their limits, and get their report channel under artifacts/', () => {
  let kit;
  before(() => { kit = kitCopy(); });
  after(cleanup);

  test('unchanged: a review agent that runs git commit, push, add or stash is refused, attended and in a job', () => {
    const dir = guardProject(kit);
    // KitLean 2.5.3 (AC-33): slice-verifier is retired and no longer a review agent; the two left keep their limits.
    for (const agent of ['spec-critic', 'spec-reviewer']) {
      for (const command of ['git commit -m "x"', 'git push', 'git add .', 'git stash', 'git checkout -- src']) {
        for (const mode of [{ job: false }, { job: true }]) {
          const run = guard(dir, bash(command, agent), mode);
          assert.equal(run.status, 2, `${agent}: ${command} not refused (job: ${mode.job})`);
          assert.match(run.stderr, new RegExp(`the ${agent} agent reviews`));
        }
      }
    }
  });

  test('AC-R1: each review agent may write its report under artifacts/, on any branch, with or without a job', () => {
    for (const branch of ['feature/x', 'main']) {
      const dir = guardProject(kit, { branch });
      for (const [agent, file] of [
        ['spec-critic', 'artifacts/Subscriptions-critic-report.md'],
        ['spec-reviewer', 'artifacts/Subscriptions-reviewer-report.md'],
      ]) {
        for (const mode of [{ job: false }, { job: true }]) {
          const run = guard(dir, write(join(dir, file), agent), mode);
          assert.equal(run.status, 0, `${agent} on ${branch} may not write ${file} (job: ${mode.job}): ${run.stderr}`);
          assert.equal(run.stdout.trim(), '');
        }
      }
    }
  });

  test('AC-R1: the read-only agents may write nothing else: a source file, a spec, a recap, a file next to artifacts/', () => {
    const dir = guardProject(kit);
    for (const agent of ['spec-critic', 'spec-reviewer']) {
      for (const file of ['src/Feature/Rule.cs', '_specs/Subscriptions/spec.md', '_specs/Subscriptions/slice-1.md', 'artifacts/notes.md', 'artifacts/sub/x-report.md', 'report.md']) {
        const run = guard(dir, write(join(dir, file), agent));
        assert.equal(run.status, 2, `${agent} may write ${file}`);
        assert.match(run.stderr, /artifacts\//);
      }
    }
  });

  test('KitLean 2.5.3 (AC-33): slice-verifier is retired: like any session it edits production code and a spec on a feature branch, and its report under artifacts/ on main is refused like the main session\'s', () => {
    const dir = guardProject(kit);
    const code = guard(dir, edit(join(dir, 'src/Feature/Rule.cs'), 'slice-verifier'));
    assert.equal(code.status, 0, code.stderr);
    const spec = guard(dir, edit(join(dir, '_specs/Subscriptions/spec.md'), 'slice-verifier'));
    assert.equal(spec.status, 0, spec.stderr);
    const add = guard(dir, bash('git add .', 'slice-verifier'));
    assert.equal(add.status, 0, add.stderr);
    const main = guardProject(kit, { branch: 'main' });
    const report = guard(main, write(join(main, 'artifacts/Subscriptions-slice-3-verifier-report.md'), 'slice-verifier'));
    assert.equal(report.status, 2, 'slice-verifier still has a report channel on main');
  });

  test('unchanged: the main session on a protected branch may not edit a source file, nor an artifacts file, nor a spec', () => {
    const dir = guardProject(kit, { branch: 'main' });
    for (const file of ['src/Feature/Rule.cs', 'artifacts/Subscriptions-slice-3-verifier-report.md', '_specs/Subscriptions/spec.md']) {
      const run = guard(dir, edit(join(dir, file)));
      assert.equal(run.status, 2, `${file} allowed on main`);
    }
    const own = guard(dir, edit(join(dir, 'CLAUDE.md')));
    assert.equal(own.status, 0, own.stderr);
  });
});
