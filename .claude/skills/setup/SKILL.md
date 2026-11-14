---
name: setup
description: "Install or update the spec-driven kit in a project folder, from this kit folder: survey the project and its existing Claude Code setup, agree with the user what the kit takes over, copy the kit without overwriting the project's own files, and write the project's settings."
argument-hint: "The path of the project folder, e.g. '../my-project'"
disable-model-invocation: true
---

# Setup

This session runs in the kit folder. The project to set up is another folder, given as the argument; ask for it when it is missing. Nothing of the kit is in the project until step 6, and by then the user has seen what will be added and has decided what the kit takes over.

The kit fits into the harness the project already has. It does not replace it: the project's own skills, agents, hooks, rules and settings stay, unless the user decides otherwise for a named file.

Rules for this skill:

- Change files only in the project folder, and only the ones named here. Change nothing in the kit folder.
- Copy kit files with `node tools/install.mjs`, never by hand: the script records what it installed, so a later update or removal knows which files are the kit's.
- Do not commit, push, or switch branches in the project. Do not start on a feature.
- The skills listed in this session are the kit's and the user's own. The project's skills, agents, hooks and rules are not loaded here: read them from the project's `.claude/` folder.

Read `.claude/rules/spec-driven.md` in the kit folder first, so you know what you are installing.

## 1. Check the project folder

- It exists and is not the kit folder. If Claude Code has no access to it, ask the user to grant it (`/add-dir <path>`).
- Git state: whether it is a repository, the current branch, whether the working tree is clean. Advise a clean tree on a branch of its own, so the install is one diff the user can review and revert. Go on when the user prefers otherwise.
- `.claude/spec-driven.install.json` exists: this is an **update**. Read the kit version, level and options recorded there, tell the user what the new version changes for them, and keep the project's existing answers in steps 3 to 5.

## 2. Survey the project

Find out, by reading and by running read-only commands in the project folder:

- whether there is working code, or the project is empty or freshly scaffolded;
- the language, framework and build tool, and the commands the project already uses to build, test, lint and format (project files, scripts, CI definitions, README);
- which test levels exist: unit tests, and anything that goes through a real entry point to real persistence; and how existing tests are tagged or named;
- how the application is started locally and where it answers;
- the default branch, the other long-lived branches, how recent branches and commits are named;
- whether `node` is available: the hooks and the verification runner need it.

## 3. Survey the existing harness

Read what the project already has for Claude Code, and sort it by concern:

| Concern | Where to look |
|---|---|
| Planning | `CLAUDE.md`, `.claude/rules/`, skills that plan or brainstorm, a folder of specs, plans or PRDs, plugins enabled in `.claude/settings.json` |
| Test-first procedure | A TDD skill or rule |
| Review | Reviewer agents, review skills, CI checks |
| Verification | A script that runs everything (`npm run verify`, `make check`), pre-commit hooks |
| Commit and branch policy | `permissions` and `hooks` in `.claude/settings.json`, git hooks |

Also note the user-level skills and plugins listed in this session that prescribe a planning or building workflow: they will be active in the project too.

Then run the installer's plan, which writes nothing:

```
node tools/install.mjs plan <project>
```

It reports each kit file as `add`, `same`, `update`, `modified` (a kit file the project changed) or `collision` (the project's own file at the same path), and what it would add to `.claude/settings.json`.

## 4. Agree with the user what the kit takes over

Present what you found, then ask, with your recommendation first:

- **Level.** How much of the kit to install:
  1. the review agents only: nothing changes until one is asked for;
  2. plus the guards: hooks and the confirmation on commit and push, next to the project's own hooks;
  3. plus the workflow: skills, templates and the rules file. This changes Claude's default behavior in the project: the Spec Gate applies to every request, and plan mode and plan files are no longer used.
  Recommend 3 for a project without a planning workflow of its own, and 1 or 2 as a first step for a project that has one.
- **Each concern, one owner.** For every concern of step 3 where the project has something: the existing piece stays, the kit takes over, or the kit plugs into it. Planning cannot be shared: two planning workflows in one session make Claude unpredictable. Verification is best plugged in: the project's own command becomes the kit's verification command.
- **Manual skills** (level 3): whether `new-feature` and `bugfix` may start on their own when a request matches, or run only when typed (`--manual-skills`). Recommend manual while the kit does not own planning for the whole project.
- **Each skipped file.** For every `collision` and `modified` row: keep the project's file (default), or replace it (`--overwrite <path>`). When the project keeps its own file where the kit expects one, say what that means, for example that the kit's `bugfix` skill is absent and the project's is used.
- **Scope**, when the existing planning workflow stays for part of the work: where the kit's workflow applies. It is written into `CLAUDE.md` in step 8.

At levels 1 and 2, skip in the next steps what belongs to a higher level, and say so in the report.

## 5. Ask what the project cannot tell you

Ask in one or two rounds, offering what you found as the default answer:

- **Reference feature**: the existing feature that new features should mirror. In a project without one: "none yet; the first feature built becomes the reference".
- **Risk areas**: where the user wants to give a go before code is written. Propose a short list from what you saw (authentication, personal data, database schema, public contracts). Warn that a long list marks almost every slice ⚠️ and doubles the stops.
- **Branches**: which are protected, how a feature branch is named and from which base.
- **Commit format**, when the history does not show one.
- **Integration test**: what that level goes through in this project, so that "the slice's integration test" has one meaning. When no such level exists yet, agree what it will be.
- **UI test**, when the project has a user interface: how a page is tested on a stubbed service, and how the stub is switched on so the user can open the page without a backend.
- **Human check**: how the user wants to try a slice (run command, address, test account or seed data), and which browser tool Claude may use to try it first.
- **Criterion ids on tests**: how a test carries `AC-<n>`. Propose the mechanism the test framework already has (a trait or category, a tag, a marker), and the test name where it has none.

## 6. Install

Run the installer with what was agreed:

```
node tools/install.mjs apply <project> --level <n> [--manual-skills] [--overwrite <path>]...
```

It copies the kit files of that level, skips the project's own files, merges the guard and the commit and push entries into `.claude/settings.json` (level 2 and up) without removing anything, and records the result in `.claude/spec-driven.install.json`. Show the user its output.

When it reports that `permissions.deny` already blocks commit or push: that blocks the commands even when the user asks for them. Show the user the entries and move them to `permissions.ask` only on their say.

## 7. Establish the Verification Commands

Run, in the project folder, each command you found: build, unit tests, UI tests, integration tests, the format or lint check in its non-modifying form, and one filtered test run. Prefer the project's own command that runs everything, when it has one.

- A command that fails, or passes with warnings, is reported to the user with its output. Do not repair the project as part of the setup unless the user asks.
- A level that does not exist yet is written down as "not established yet". Do not invent a command you have not run.

Copy the project's `.claude/templates/spec-driven.json` to `.claude/spec-driven.json` (level 2 and up; on an update, keep the existing file) and fill it in:

- `specsDir`, `protectedBranches`;
- `allowOnProtected`: what may be edited on a protected branch. Keep the defaults (specs, `.claude/`, `CLAUDE.md`); add a path only when the user asks for it;
- `verify.commands`: the commands that work, in the order build, unit, UI, integration, lint;
- `verify.shell`: `null` runs the commands in the system's default shell (`cmd.exe` on Windows, `sh` elsewhere). Set `"pwsh"`, `"powershell"` or `"bash"` when the commands need that shell;
- `verify.failPattern`: a regular expression that makes a passing command fail when its output matches, for tools that report warnings with exit code 0 (for example `warning [A-Z]+[0-9]+`). `null` when the build already fails on warnings.

Then run `node <project>/.claude/hooks/verify.mjs`. It must be green, with every command passing through the runner and not only when typed by hand. If it is not, fix the configuration, not the project.

Add `.claude/spec-driven.state.json` to the project's `.gitignore`: the runner keeps there which state of the tree it last saw green.

## 8. Write the project settings

Fill in the kit's `.claude/templates/project-settings.md` with the answers, and put the result in the project's `CLAUDE.md`:

- no `CLAUDE.md`: create one with a title line, one or two sentences on what the project is, and the Project settings section;
- an existing `CLAUDE.md`: add the Project settings section and keep everything else. Where it holds instructions that contradict what was agreed in step 4, show the user the lines and propose the change; do not remove them unasked.

Write the outcome of step 4 into that section, in the place the template marks:

- the kit owns planning for the whole project: the line that this workflow leads, naming the competing skills;
- the kit owns part of it: the scope, for example "The spec-driven workflow applies to features started with `/new-feature`; everything else follows the workflow above." The project's own `CLAUDE.md` is what decides between the two, so the line has to be there.

No placeholder in angle brackets may remain in the section.

At level 3, create the specs folder (`_specs/`, with a `.gitkeep` when it would otherwise be empty). When the project already has specs or plans in another form, list them for the user and leave them where they are.

## 9. Check the setup

- `node tools/install.mjs plan <project>` reports no `add` or `update` row for the chosen level.
- `CLAUDE.md` § Project settings has a value, or an explicit "not established yet", on every line.
- `node <project>/.claude/hooks/verify.mjs` was green in this session (level 2 and up).
- The guard answers (level 2 and up). With the project on a protected branch, this prints a refusal and exits with code 2:
  `echo '{"tool_name":"Edit","tool_input":{"file_path":"src/x"}}' | node <project>/.claude/hooks/guard.mjs`
- The project's own hooks and permission entries are still in `.claude/settings.json`.
- Mermaid diagrams can be read where the user reviews specs: the editor's Markdown preview or the repository host. If not, say so.

## 10. Report and hand back

Tell the user:

- what was installed at which level, what was skipped and why, and what you wrote yourself (`CLAUDE.md`, `.claude/spec-driven.json`, `.gitignore`);
- who owns each concern now;
- the Verification Commands and their result today, and what is not established yet. When there is no integration test level or no working code, slice 1 of the first spec is the walking skeleton;
- anything in the existing instructions that awaits their decision;
- how to review it: the diff in the project folder. Nothing was committed;
- how to undo it: `node tools/install.mjs remove <project>` from this folder removes the kit's files and settings entries, and leaves `CLAUDE.md`, `.claude/spec-driven.json` and the specs folder for the user to delete;
- the next step: start Claude Code in the project folder, where the guards load with the new session, and run `/new-feature <name and a sentence of context>` on one feature first. Advise making the approved spec the first commit on the feature branch.
