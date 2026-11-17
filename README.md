# Spec-driven kit for Claude Code

A way of working with Claude Code in which the spec is the only planning document, every slice is proven by a test written first, and nobody grades their own work: a second agent without context tries to break each slice's checks before you are asked to accept it.

## Install

The kit is never copied into a project by hand. It stays in a folder of its own next to the project, and a setup session started in that folder installs it. The project is not touched until the setup has looked at what is already there and you have decided what the kit takes over.

```
work/
  spec-driven-kit/     this repository: the setup folder
  my-project/          the project to set up
```

1. Put the kit next to the project (clone or copy this repository).
2. Start Claude Code in the kit folder, with access to the project: `claude --add-dir ../my-project`.
3. Run `/setup ../my-project` and stay in the conversation. Claude surveys the project, shows what it would add, asks what the kit should take over, installs, and commits nothing.
4. Review the diff in the project folder and commit it.
5. Start Claude Code in the project folder and run `/new-feature <name and a sentence of context>`.

Requirements: git and Node.js. The installer, the hooks and the verification runner are Node.js scripts.

**Update.** Pull the newer kit and run `/setup ../my-project` again. Kit files the project has not changed are replaced; files the project changed, and the project's own files, are reported and left alone. The level and options chosen at the install are remembered.

**Remove.** From the kit folder: `node tools/install.mjs remove ../my-project`. It deletes the kit files the project has not changed and takes the kit's entries out of `.claude/settings.json`. `CLAUDE.md` § Project settings, `.claude/spec-driven.json` and the specs folder are left for you.

## Fitting into a project that already has a harness

The setup fits the kit into the Claude Code setup the project has. It does not replace it. Three principles carry that.

### Look before anything is copied

The setup reads the project's `CLAUDE.md`, `.claude/` folder and settings, and runs the installer's plan, which writes nothing. Every kit file gets one of these states:

| State | Meaning | What the installer does |
|---|---|---|
| add | Not in the project yet | Copies it |
| same | Already identical | Nothing |
| update | Installed by the kit earlier, unchanged since | Replaces it |
| modified | Installed by the kit earlier, then changed in the project | Skips it, unless you say otherwise |
| collision | The project's own file at the same path, such as its own `bugfix` skill | Skips it, unless you say otherwise |

In `.claude/settings.json` the installer only adds: the guard next to the project's own hooks, and the confirmation on commit and push. It removes and reorders nothing.

### Each concern has one owner

The setup lists what the project already has per concern and asks you to decide: the existing piece stays, the kit takes over, or the kit plugs into it.

| Concern | What the project may already have | Usual decision |
|---|---|---|
| Planning | Plan mode, plan files, a spec or PRD folder, a planning plugin | One owner only. Two planning workflows in one session make Claude unpredictable |
| Test-first procedure | A TDD skill or rule | The kit's inside `build-slice` and `bugfix`; the existing one elsewhere |
| Review | Reviewer agents, `/code-review`, CI checks | Keep both. The kit's agents check against the spec, which the others do not |
| Verification | `npm run verify`, `make check`, pre-commit hooks | Plug in: the project's own command becomes the kit's verification command |
| Commit and branch policy | Permissions in settings, git hooks, branch protection | Keep the project's; the kit adds its entries |

The decision on planning is written into the project's `CLAUDE.md`, because that file is what decides between two workflows: either the kit's workflow leads, or it applies to a stated scope (for example, features started with `/new-feature`) and the existing workflow covers the rest.

### The kit goes in by level

Each level works without the next one. Stop at the level that gives you what you need, and run the setup again later to go further.

| Level | What is installed | What changes in the project |
|---|---|---|
| 1. Review agents | `.claude/agents/` | Nothing, until you ask for one. They need a document with numbered acceptance criteria to check against |
| 2. Guards | `.claude/hooks/`, the settings entries, `.claude/spec-driven.json` | The three guards and the confirmation on commit and push |
| 3. The workflow | `.claude/skills/`, `.claude/templates/`, `.claude/rules/spec-driven.md` | Claude's default behavior: the Spec Gate applies to every request, and plan mode and plan files are no longer used |

At level 3 you can choose **manual skills**: `new-feature` and `bugfix` then run only when typed, and never start on their own because a request looks like a feature or a bug. That is the setting for a trial.

Take one real feature through all six phases on a branch before deciding that the kit owns planning for the whole project.

### Limits

- **The specs folder is `_specs/`.** The hooks read `specsDir` from `.claude/spec-driven.json`, but the skills and agents name `_specs/` in their text. A project with its own specs folder keeps both.
- **The skills refer to the rules file**, so they are installed together: there is no level with skills and without rules.
- **The setup session does not see the project's own skills as loaded skills.** It reads them from the project's `.claude/` folder. Plugins enabled only for the project are found through its settings file.

## The workflow

| Phase | In short | Who decides |
|---|---|---|
| Investigate | Read the code and what the request depends on; record verified findings and questions | Claude |
| Interview | Ask the user, round by round, until nothing has to be assumed | The user answers |
| Specify | Behavior, two diagrams, acceptance criteria, vertical slices; a critic without context reads it first | The user approves |
| Build | One slice per fresh session: the slice test first, then a unit test before each piece of logic | Claude; the user at ⚠️ slices |
| Verify and approve | A verifier without context breaks the behavior to see each check fail; then a one-screen recap | The user commits |
| Review | After the last slice, a reviewer without context checks each acceptance criterion against the diff | The user pushes |

## What is in the kit

Installed in the project:

```
.claude/rules/spec-driven.md               The workflow: gate, definitions, stops (always loaded)
.claude/skills/new-feature/                Orders the phases
.claude/skills/investigate/                Phase 1
.claude/skills/write-spec/                 Phases 2 and 3
.claude/skills/build-slice/                Phases 4 and 5
.claude/skills/amend-spec/                 Changes an approved spec
.claude/skills/bugfix/                     One- or two-file fixes, regression test first
.claude/agents/spec-critic.md              Reads the spec before you do
.claude/agents/slice-verifier.md           Tries to break one slice's checks
.claude/agents/spec-reviewer.md            Checks the whole feature against the spec
.claude/hooks/guard.mjs                    The guards (PreToolUse hook)
.claude/hooks/verify.mjs                   Runs the project's verification commands
.claude/templates/                         Spec, slice recap, project settings, settings and config fragments
```

Staying in the kit folder:

```
.claude/skills/setup/                      The setup session
tools/install.mjs                          Copies, updates and removes the kit's files; records what it installed
evals/, .claude-plugin/                    Tests of the kit itself
```

Written in the project by the setup: `CLAUDE.md` § Project settings, `.claude/spec-driven.json` (branches and verification commands), `.claude/spec-driven.install.json` (what was installed), the entries in `.claude/settings.json`, and `_specs/`.

## What is enforced, and what is not

Enforced by a hook, whatever Claude decides:

- no edit outside `.claude/` and `CLAUDE.md` on a protected branch, and no spec file there: every spec is written on a branch of its own, which Claude creates when the spec starts;
- no slice recap while the verification commands fail (exit code, or the warning pattern you configure);
- no git command that changes files, history or branches inside the three review agents;
- commit and push ask for your confirmation.

Instructions only, checked afterwards by the agents and by you: the spec is approved before code is written, the slice test is written first and seen failing, the next slice starts on a clean tree. No hook can tell which spec an edit belongs to, so these stay with the verifier, the recap and your review of the diff.

## Why the workflow is built this way

- **No plan file.** In the project this kit comes from, plans were three to five times longer than their specs, froze 50 to 100 file references each, went stale, and 13 of 18 were never executed. The spec states what must be true; the files, classes and tests are worked out from the current code when a slice is built.
- **Investigation before the interview.** Questions asked before reading the code are questions the code could have answered, and a spec built on unverified statements about the code is wrong from the first line.
- **A slice is proven from its first minute.** The slice test is written before the code. For a wire slice it goes end to end, so a mismatch between contracts, queries and what the page expects shows up at once and not at the end of a layer-by-layer build.
- **UI first, on a stub.** A page on fake data is a vertical slice of the UI: the user can use it and judge it. Changing a page before its backend exists costs little. Where there is nothing to judge, the stub is skipped.
- **A check must be able to fail.** In the trial run, a reviewer without context found a test that passed on any 401 and proved nothing. Hence the verifier: it breaks the behavior on purpose and reports every check that stays green.
- **The builder does not grade its own work.** The critic, the verifier and the reviewer get the spec and the code, never the conversation in which they were made.
- **One branch per spec.** The spec, its slices and recaps share one branch, created by Claude when the spec starts, with the approved spec as its first commit. A draft pull request then shows the work in progress, and the review diff is exactly that spec's work. Claude may create and switch branches; it still commits only on request.
- **Rules without exceptions are hooks.** An instruction can be skipped under pressure; a hook cannot.
- **Diagrams are for the person who approves.** A picture of what happens and of how it is built lets the user judge in a minute what would take much longer from prose and a diff.
- **The commit is the acceptance.** Claude does not commit on its own initiative. A clean working tree tells the next session that the previous slice was accepted. Batch mode is the one exception, and the user switches it on per spec.
- **A fresh session per slice.** The spec and the recaps, not the conversation, have to carry the context; building in a new session tests exactly that.
- **Installed from the outside.** A kit that is copied into a project and then looks around has already overwritten what it should have found. The setup runs next to the project, so it can look first.

## Testing the kit itself

`evals/` holds scenarios that check whether the skills fire and hold under pressure, in the format of `claude plugin eval`; `.claude-plugin/plugin.json` exists only to make this repository a valid target for it. Run from the kit folder:

```
claude plugin eval .
```

The scenarios run Claude and cost tokens. The hooks and the installer have no model in them: the guard is tested by piping a tool call into `guard.mjs` (step 9 of the setup), the installer with `node tools/install.mjs plan <project>`, which writes nothing.
