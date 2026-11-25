# Spec-driven kit for Claude Code

A way of working with Claude Code in which the spec, with its Scaffold of files and wiring per slice, is the planning document, approved once; every slice is an increment you can test, starts on your go, is built outer test first and is verified against its acceptance criteria before you check it and accept it; and nobody grades their own work: a reviewer without context checks the whole feature against the spec.

This is the owner's private edition of the kit, for private projects. Its process, rules, skills, agents, hooks, templates, scripts, installer and tests follow the upstream harness packs at the same version (see `CHANGELOG.md`); everything that only fitted one organisation's platform is left out: its deployment, monitoring and cluster agents, its server and feed addresses, and its benchmark reports. Values that differ per project, such as the SonarQube server or the package feed, are asked by the setup and kept in the project's own settings.

## Install

The kit is never copied into a project by hand. It stays in a folder of its own next to the project, and a setup session started in that folder installs it. The project is not touched until the setup has looked at what is already there and you have decided what the kit takes over.

```
work/
  spec-driven-kit/     this repository: the setup folder
  my-project/          the project to set up
```

1. Put the kit next to the project (clone or copy this repository).
2. Start Claude Code in the kit folder, with access to the project: `claude --add-dir ../my-project`.
3. Run `/setup ../my-project` and stay in the conversation. Claude surveys the project, shows what it would add, asks what the kit should take over and which packs to add, installs, and commits nothing.
4. Review the diff in the project folder and commit it.
5. Start Claude Code in the project folder and run `/new-feature <name and a sentence of context>`.

Requirements: git and Node.js. The installer, the hooks and the verification runner are Node.js scripts.

**Update.** Pull the newer kit and run `/setup ../my-project` again. Kit files the project has not changed are replaced; files the project changed, and the project's own files, are reported and left alone. The level, the options and the packs chosen at the install are remembered. Update with the same or a newer kit: an older one does not know the packs and plans their files as `remove`. An update from a kit before 2.4.0 also takes the eight `permissions.ask` entries for commit and push out of `.claude/settings.json` that the earlier kit added: the guard asks now (see Unattended jobs). See `CHANGELOG.md` for what each version changes.

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

In `.claude/settings.json` the installer only adds the guard, next to the project's own hooks. It removes and reorders nothing of the project's own; the only thing it ever takes away is what an earlier kit added itself.

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
| 2. Guards | `.claude/hooks/`, the settings entries, `.claude/spec-driven.json` | The guards, among them the guard's confirmation on commit and push in attended sessions |
| 3. The workflow | `.claude/skills/`, `.claude/templates/`, `.claude/rules/spec-driven.md` | Claude's default behavior: the Spec Gate applies to every request, and plan mode is no longer used; the only plan is the spec's Scaffold, from which each build session builds its slice |

At level 3 you can choose **manual skills**: `new-feature` and `bugfix` then run only when typed, and never start on their own because a request looks like a feature or a bug. That is the setting for a trial.

Take one real feature through all six phases on a branch before deciding that the kit owns planning for the whole project.

### Packs

A pack is a named, optional set of agents, skills and rules for a kind of project, kept in the kit under `packs/<name>/` and installed into the project's `.claude/agents/`, `.claude/skills/` and `.claude/rules/`. Packs belong to no level: one can be added at level 1 as well as at level 3. The setup shows the packs with one line each and recommends the ones that fit the project; `pack.json` in each pack folder holds its description and names its agents, skills and rules.

| Pack | For |
|---|---|
| `operations` | Any repository analysed on a SonarQube server or worked on with a GitFlow-style branching model: the Sonar review (server URL and project key from the project's settings) and the git guide |
| `dotnet-shared` | Every C# repository: the coding, testing and shared architecture guidelines as rules, and the mutation check (Stryker.NET) as a script. Needs `operations` |
| `dotnet-library` | .NET libraries and NuGet packages: the public API and NuGet packaging as rules, the `add-public-api` how-to, the `fix-violations` lookup and the `code-analysis` agent. Needs `operations` and `dotnet-shared`: its code analysis hands over to the Sonar review |
| `blazor-server`, `blazor-wasm` | The architecture guideline of a Blazor Server or a Blazor WebAssembly solution, on top of `dotnet-shared`; one of the two |

A pack may need a value per project: the `operations` pack needs the project's SonarQube server URL and Sonar project key; `dotnet-library` needs the solution name, the namespace root and the unit-test command. The setup asks these values, proposes what it finds, and writes them in the project's `CLAUDE.md` § Project settings under `### Pack values`, where the pack's agents, skills and rules read them by the line's label; an item that misses its line says which one and stops. A pack that needs another is only installed together with it.

A pack may also hold scripts, installed into the project's own `scripts/` folder, and pin the local .NET tools they need in `.config/dotnet-tools.json` (`dotnetTools` in `pack.json`; the installer adds a missing tool, leaves a tool the project already pins at its version and says so, and takes away on removal only what it added). The `dotnet-shared` pack holds the mutation check, below.

#### The mutation check (dotnet-shared, since 2.6.4)

`scripts/mutation-check.mjs` runs Stryker.NET, the local tool `dotnet-stryker` pinned at 5.1.0, on the production files a slice changed (see The workflow). Stryker.NET needs the package feed to carry `dotnet-stryker`, or nuget.org to be reachable: the tool is restored from nuget.org by default, or from whatever feed the project's own `nuget.config` and tool manifest name; a project whose `nuget.config` points only at a private feed needs that feed to carry the package, through an upstream source to nuget.org or by pushing the package to it. To check it, run `dotnet tool restore` in the project folder: it must say that `dotnet-stryker` (5.1.0) was restored; then `dotnet tool run dotnet-stryker --version` answers. When the feed does not carry it, the check stops with "dotnet-stryker not available: the package feed must carry it, see README" and exit code 3: it never skips silently. The project settings name the test projects (Pack values **Test projects**) and the threshold (**Mutation threshold**, default 80).

Pack files follow the same rules as the kit's own: a file the project already has at a pack path is a `collision` and stays unless you say otherwise, and a pack file the project changed is `modified` and kept. The installer records the packs; `--packs <name>[,<name>]...` on a later run replaces the list, and `--packs none` takes every pack away, removing the unchanged files and listing the changed ones; `node tools/install.mjs remove <project>` does the same for pack files as for the kit's own. A project set up before packs existed has none until you add one.

### Limits

- **The specs folder is `_specs/`.** The hooks read `specsDir` from `.claude/spec-driven.json`, but the skills and agents name `_specs/` in their text. A project with its own specs folder keeps both.
- **The skills refer to the rules file**, so they are installed together: there is no level with skills and without rules.
- **The setup session does not see the project's own skills as loaded skills.** It reads them from the project's `.claude/` folder. Plugins enabled only for the project are found through its settings file.

## The workflow

| Phase | In short | Who decides |
|---|---|---|
| Investigate | Read the code and what the request depends on; record verified findings and questions | Claude |
| Interview | Ask the user, round by round, until nothing has to be assumed | The user answers |
| Specify | `spec.md`: behavior, the What happens diagram, acceptance criteria each with its check, vertical slices, and the Scaffold: per slice the files to create, modify or delete, one line each on what changes and why, plus one line for DI registrations and wiring, no steps and no code. A slice is one increment the user can test: a functionality or an API call; its size follows from that, not from a count of criteria, and a security or personal-data criterion goes in the same slice as the functionality it protects. The spec is checked against the code and gets one approval. `spec-critic` reads the spec only when the user asks, one pass | The user approves the spec in one approval |
| Build | Every slice, ⚠️ or not, starts only on the user's go, one slice per fresh session; a build session never starts the next slice by itself. `build-slice` (at most 45 lines, since 2.6.0) builds exactly the approved slice from its Scaffold rows; the guidelines apply to every line; test-driven without exception: the slice's integration test first in the Integration test project, entering through the page or component the user uses, not through the view model (since 2.6.5; real DI container, real view model and services, only the browser edge, the clock, auth and the backend client faked, never in the UI test project; a stub slice's test is the same test with the stub as the backend client), seen failing for the right reason; for each rule or calculation a unit test seen failing, the smallest code to pass, refactor; a page test seen red too; an existing test is never changed or weakened unless the spec's criteria require it; security and personal-data criteria tested like any other; each file read once, quiet commands. No slice plan file, no recap file, no spec edits, no reviewing agent per slice | The user gives the go for each slice |
| Verify and check | Slice gate green: `node .claude/hooks/verify.mjs --slice <IntegrationTestClass>`, run until green (the build, all unit tests, the UI tests, only the slice's integration tests, the format check; a filter that matches zero tests is red; the full integration suite runs only in the final review), its last line quoted. Then, with the dotnet-shared pack, the mutation check (since 2.6.4, replacing the red check of 2.6.1 and 2.6.2): `node scripts/mutation-check.mjs --slice <n> --base <commit>` runs Stryker.NET on the lines the slice added or modified in its production files (since 2.6.5; mutants outside them are counted as `outside the slice: n (not scored)` and are never a reason to add a test) and is red below the project's Mutation threshold (default 80) or with a mutant without coverage; its evidence, `_specs/<FeatureName>/mutation-<n>.md`, holds the score line, the files mutated and each survivor classified ('equivalent' only when no test could ever observe the change, else 'accepted' for the reviewer), and is committed with the slice. Each new test is still seen failing first. No code analysis per slice: the project's code analysis runs once per feature, in the final review. The record is the build's final answer, no file: one line per acceptance criterion with the test that proves it and the failure message seen when that test was red (test-first visible without commits), what differs from the spec, how the user tries it. After the slice gate no agent reviews the slice. Claude does not run the human check and never marks a slice accepted: the user checks the slice and accepts it. Claude commits only when the user asks; otherwise the work stays uncommitted and Claude says so | The user checks the slice and accepts it, and commits when they want |
| Review | The final review, once after the last slice, run by `new-feature`: the feature gate (`node .claude/hooks/verify.mjs --feature`: every Verification Command, every integration test) green, then the code analysis the project declares in Project settings (**Analysis**, for example a `sonar-review` agent or the SonarScanner, and **Fix analysis**, for example `code-analysis` or `fix-violations`): its findings on the changed code are fixed and the feature gate runs again, the ones it cannot fix go into the report for you, and without a declared analysis the step is skipped and said so; the analysis never sends code anywhere the project's own settings do not, and the kit never stores a token. Then `spec-reviewer`, without context, checks each acceptance criterion against the whole diff; when a slice is ⚠️, `security-review` runs once with it over the whole diff, never per slice; an end-to-end browser test is optional, once per feature | The user pushes |

**Models (recommended since 2.6.5).** Run `build-slice` on Sonnet 5.5: in the owner's benchmark exp18 it met the same quality floor as Opus did in exp17, at 3.22 against 5.78 USD. Spec writing and the review (`investigate`, `write-spec`, `amend-spec`, `spec-critic`, `spec-reviewer`, the final review) stay on the stronger model, Opus 5.5. The Project settings carry the line **Models**.

Per feature, `_specs/<FeatureName>/` holds `spec.md` (its Scaffold included, one approval). A build writes no file of its own next to it; files a project's earlier builds wrote there are left alone.

## What is in the kit

Installed in the project:

```
.claude/rules/spec-driven.md               The workflow: gate, definitions, stops (always loaded)
.claude/skills/new-feature/                Orders the phases
.claude/skills/investigate/                Phase 1
.claude/skills/write-spec/                 Phases 2 and 3
.claude/skills/build-slice/                Phase 4: one slice, test-driven, at most 45 lines
.claude/skills/amend-spec/                 Changes an approved spec
.claude/skills/bugfix/                     One- or two-file fixes, regression test first
.claude/agents/spec-critic.md              Reads the spec before you do
.claude/agents/spec-reviewer.md            Checks the whole feature against the spec
.claude/hooks/guard.mjs                    The guards (PreToolUse hook); its source is hooks/guard.mjs in the kit
.claude/hooks/verify.mjs                   Runs the project's verification commands; source hooks/verify.mjs
.claude/templates/                         Spec (with its Scaffold), project settings, settings and config fragments
```

Staying in the kit folder:

```
.claude/skills/setup/                      The setup session
hooks/                                     The sources of the two hooks above
packs/<name>/                              The packs: pack.json and the agents, skills and rules of each
tools/install.mjs                          Copies, updates and removes the kit's files; records what it installed
tests/, evals/, .claude-plugin/            Tests of the kit itself
CHANGELOG.md                               What each version changes
```

Written in the project by the setup: `CLAUDE.md` § Project settings, `.claude/spec-driven.json` (branches and verification commands), `.claude/spec-driven.install.json` (what was installed), the entries in `.claude/settings.json`, `artifacts/` and `.claude/spec-driven.state.json` in `.gitignore`, and `_specs/` (with each slice's committed `mutation-<n>.md`). With the dotnet-shared pack the installer also puts `scripts/mutation-check.mjs` into the project and pins `dotnet-stryker` 5.1.0 in `.config/dotnet-tools.json`, next to the project's own tools.

## What is enforced, and what is not

Enforced by a hook, whatever Claude decides:

- no edit outside `.claude/` and `CLAUDE.md` on a protected branch, and no spec file there: every spec is written on a branch of its own, which Claude creates when the spec starts;
- no `_specs/<Feature>/slice-*.md` file while the verification commands fail (exit code, or the warning pattern you configure; since 2.6.0 the build writes no such file, so this only guards older builds);
- no git command that changes files, history or branches inside the two review agents, and no file but its own report from either;
- commit and push: in an attended session the guard asks for your confirmation; on a protected branch (your list, and always `main`, `master`, `dev`, `release/*`) they are refused; a force-push and a tag deletion are refused always.

Instructions only, checked afterwards by the agents and by you: the spec is approved before code is written, each slice starts on the user's go, the outer test is written first and seen failing, the next slice starts on a clean tree. No hook can tell which spec an edit belongs to, so these stay with the build's record (each criterion's test with the failure seen when it was red), the final review and your review of the diff.

## Unattended jobs

The kit also runs without a developer at the keyboard, for example as a Zyggy bus job, which sets the environment variable `ZYGGY_JOB`. Two things change then, and nothing else:

- **Commit and push are not put to a user who is not there.** The confirmation came from static `permissions.ask` rules before 2.4.0, which a non-interactive session can only refuse. Now the guard decides: attended, it answers `ask`; in a job it says nothing and the job's own permissions decide. Protected branches, force-push and tag deletion are refused in both.
- **The review agents hand back through a file.** `spec-critic` and `spec-reviewer` write their full report to `artifacts/<FeatureName>-...-report.md` (ignored by git) and answer with one line, the verdict and the path; the skill that started them reads the file and copies what matters into its answer or the spec. The guard allows a review agent that one write, on any branch.

Every documented test command uses forward slashes (`src/Test/Unit/X.Tests/bin/Debug/net8.0/X.Tests.exe`), which Git Bash, PowerShell and the jobs all run; a kit test refuses a backslash path in the kit's texts, and the setup writes the project's commands the same way.

## Why the workflow is built this way

- **A short Scaffold, and no plan file.** In the project this kit comes from, whole-feature plans were three to five times longer than their specs, froze 50 to 100 file references each, went stale, and 13 of 18 were never executed. The spec states what must be true; its Scaffold states per slice only the files that change, why, and the wiring, which catches a missing registration before the build; the build session works from its Scaffold rows and the current code once its go is given. A plan file per slice and a summary file that repeated the spec cost turns without adding quality (kit 2.5.7, see `CHANGELOG.md`).
- **The spec carries the quality; the build stays slim.** On the owner's benchmark (slice 1 of a CSV export) the full 2.5.9 kit cost 4.29 USD and met 11/11 criteria; a minimal build harness with the same approved spec cost 3.96 USD and met 10/11; without a spec it met 5/11. So since 2.6.0 the spec phase is unchanged and `build-slice` is at most 45 lines: test-driven without exception, the slice gate, and a record as its final answer that gives each criterion's test with the failure message seen when it was red, which makes test-first visible without a commit per step (kit 2.6.0, see `CHANGELOG.md`).
- **One integration test class first, few unit tests.** Written before any stub, the slice's integration test class decides what the slice needs; unit tests cover only the branching logic it cannot reach cheaply. On the owner's benchmark this cut the build from 121 to 101 turns at the same cost and quality, and gave the slice gate a real integration test to filter to (kit 2.5.8, see `CHANGELOG.md`).
- **Every test earns its place.** The efficient-testing rules R-1 to R-7 have one home, the `dotnet-shared` pack's testing guideline for agents (§ Efficient tests); the other testing texts and `build-slice` point to it. Each new test gets a line in the slice's test list in the build's record: the test, the criterion it protects and the plausible bug it catches; a test without one is deleted. One real integration test per slice stays (kit 2.6.3, see `CHANGELOG.md`).
- **The tests must be able to fail, and the proof is mechanical.** A mutation check (Stryker.NET on the slice's changed production files) replaced the red check of 2.6.1 and 2.6.2 in 2.6.4: in the owner's benchmark (exp16) it gave the best test quality of the series, and the owner accepts its added cost. Its evidence is committed with each slice, and the final reviewer judges each survivor's classification.
- **A small context: quiet output, targeted reading.** A build session's context grows from what it reads and the output it gets back, not from its instructions (cutting those by 55 % changed the context 1 %). So the Verification Commands are quiet and still list warnings, errors and failing tests (`dotnet build -v q -nologo`, test executables that show output only for failed tests); `verify.mjs` prints one line per command and, for a failing one, the failing tests with their first assertion line and at most 30 lines (`--verbose` for everything); `build-slice` locates with Grep or Glob first, reads only the needed range of a large file, does not re-read a file that did not change and never prints whole files through the shell. Every test is seen red first, page tests included. On the owner's benchmark this cut the build from 4.77 to 4.11 USD and the re-read context by 27 % at the same quality (kit 2.5.9, see `CHANGELOG.md`).
- **Investigation before the interview.** Questions asked before reading the code are questions the code could have answered, and a spec built on unverified statements about the code is wrong from the first line.
- **A slice is proven from its first minute.** The outer test is written before the code. For a wire slice it goes end to end, so a mismatch between contracts, queries and what the page expects shows up at once and not at the end of a layer-by-layer build.
- **UI first, on a stub.** A page on fake data is a vertical slice of the UI: the user can use it and judge it. Changing a page before its backend exists costs little. Where there is nothing to judge, the stub is skipped.
- **A check must be able to fail.** In the trial run, a reviewer without context found a test that passed on any 401 and proved nothing. Hence a test is seen failing for the missing behavior before its code is written, and the final reviewer asks of every check whether it would fail if the behavior were broken.
- **The builder does not grade its own work.** The critic and the reviewer get the spec and the code, never the conversation in which they were made.
- **One review, of the whole feature.** A slice is verified by the slice gate and by your check; after the slice gate no agent reviews the slice, and `spec-reviewer` reviews the whole feature once. Two benchmark builds from the same base diverged on a per-slice review agent: the one that ran it cost 5.62 USD instead of 4.11 and lost the sub-agent's report (kit 2.5.10, see `CHANGELOG.md`). A slice review agent left in a project by an older kit runs only when the user asks for it, never by the build on its own.
- **One branch per spec.** The spec and its slices share one branch, created by Claude when the spec starts, with the approved spec as its first commit. A draft pull request then shows the work in progress, and the review diff is exactly that spec's work. Claude may create and switch branches; it still commits only on request.
- **Rules without exceptions are hooks.** An instruction can be skipped under pressure; a hook cannot.
- **A diagram is for the person who approves.** A picture of what happens lets the user judge in a minute what would take much longer from prose and a diff; the Scaffold shows how it is built, file by file.
- **The user accepts each slice.** The user checks a slice with its Try-it steps and accepts it; Claude does not commit on its own initiative, only when asked, and otherwise leaves the work uncommitted and says so.
- **A fresh session per slice.** The spec, not the conversation, has to carry the context; building in a new session tests exactly that.
- **Installed from the outside.** A kit that is copied into a project and then looks around has already overwritten what it should have found. The setup runs next to the project, so it can look first.

## Testing the kit itself

The installer and the packs have no model in them and are tested with Node's built-in test runner, from the kit folder:

```
node --test "tests/*.test.mjs"
```

Two levels. **Integration**: the installer runs as a child process from a copy of the kit in a temporary folder, against a temporary project folder built from a fixture; its exit code, output and resulting files are checked. `tests/fixtures/project-2.1.0/` is a project installed by kit 2.1.0 at level 3, kept as it was so that updates from that version stay tested; do not regenerate it with a newer kit. The guard is tested the same way (`tests/guard.test.mjs`): installed into a temporary project with a git repository and fed tool calls on stdin, attended and with `ZYGGY_JOB` set. **Unit**: one function, or the pack sources and the kit's texts as data: no pack item may hold a leftover of the tool it was ported from, every `@<name>` in a pack item must name an agent or skill its pack or a pack it needs declares, no pack item may ask for a secret in the conversation, print one, store one from a literal or put one on a command line, and no text may document a test command with a backslash path. Test names carry the id of the acceptance criterion they prove (`AC-3`).

`evals/` holds scenarios that check whether the skills fire and hold under pressure, in the format of `claude plugin eval`; `.claude-plugin/plugin.json` exists only to make this repository a valid target for it. Run from the kit folder:

```
claude plugin eval .
```

The scenarios run Claude and cost tokens. The guard of a real project is checked by piping a tool call into its `guard.mjs` (step 9 of the setup), and the installer against a real project with `node tools/install.mjs plan <project>`, which writes nothing.
