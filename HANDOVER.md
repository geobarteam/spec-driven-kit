# Handover: set up spec-driven development in this repository

**For the person installing the kit.** Copy `HANDOVER.md` and the `.claude/` folder into the root of the repository (the kit brings no `CLAUDE.md` and no `settings.json`, so it overwrites neither). Start Claude Code there and say: *"Read HANDOVER.md and set this project up."* Stay in the conversation: Claude will ask you a few questions and will not commit anything.

The rest of this file is written for Claude.

---

## What you are setting up

A way of working in which the spec is the only planning document. Plan mode and plan files are not used. Each feature goes through six phases:

| Phase | In short | Who decides |
|---|---|---|
| Investigate | Read the code and what the request depends on; record verified findings and questions | Claude |
| Interview | Ask the user, round by round, until nothing has to be assumed | The user answers |
| Specify | Behavior, a diagram of what happens, a diagram of how it is built, acceptance criteria, vertical slices | The user approves |
| Build | One slice per fresh session: the slice test first (an integration test, or a UI test for a stub slice), then a unit test before each piece of logic | Claude; the user at ⚠️ slices |
| Approve | A one-screen recap: what was built, the architecture with the slice marked, what to review, how to try it | The user commits |
| Review | After the last slice, a context-free reviewer checks each acceptance criterion against the diff | The user pushes |

The rules are in `.claude/rules/spec-driven.md`, which Claude Code loads in every session of this repository. Read it now, then the skills, agents and templates it names. They are the same in every project and you do not edit them here. What differs per project goes into `CLAUDE.md` § Project settings, and filling that in correctly is the job of this handover.

```
.claude/rules/spec-driven.md                 The workflow (always loaded)
.claude/templates/project-settings.md        Fragment for CLAUDE.md, filled in by this handover
.claude/templates/spec-template.md           Format of a spec
.claude/templates/slice-recap-template.md    Format of the recap that closes a slice
.claude/skills/new-feature/SKILL.md          Orders the phases
.claude/skills/investigate/SKILL.md          Phase 1
.claude/skills/write-spec/SKILL.md           Phases 2 and 3
.claude/skills/build-slice/SKILL.md          Phases 4 and 5
.claude/agents/spec-reviewer.md              Phase 6
.claude/agents/bugfix.md                     One- or two-file fixes, regression test first
```

## What to do

Work through these steps in order. Change only the files named here. Do not commit, do not push, and do not start on a feature.

### 1. Survey the repository

Find out, by reading and by running read-only commands:

- whether there is working code, or the project is empty or freshly scaffolded;
- the language, framework and build tool, and the commands the project already uses to build, test, lint and format (project files, scripts, CI definitions, README);
- which test levels exist: unit tests, and anything that goes through a real entry point to real persistence (an API host with a database, a browser test);
- how the application is started locally and where it answers;
- the git state: whether it is a repository, the default branch, the other long-lived branches, how recent branches and commits are named;
- whether a `CLAUDE.md`, a `.claude/settings.json`, other `.claude/rules/` files, or a folder of specs or plans already exist, and what they prescribe.

### 2. Ask the user what the repository cannot tell you

Ask in one or two rounds, offering what you found as the default answer:

- **Reference feature**: the existing feature that new features should mirror. In a project without one, the answer is "none yet; the first feature built becomes the reference".
- **Risk areas**: where the user wants to give a go before code is written. Propose a short list from what you saw (authentication, personal data, database schema, public contracts). Warn that a long list marks almost every slice ⚠️ and doubles the stops.
- **Branches**: which are protected, how a feature branch is named and from which base.
- **Commit format**, when the history does not show one.
- **Integration test**: what that level goes through in this project, so that "the slice's integration test" has one meaning. When no such level exists yet, agree what it will be.
- **UI test**, when the project has a user interface: how a page is tested on a stubbed service (a component test, a browser test), and how the stub is switched on so the user can open the page without a backend.
- **Human check**: how the user wants to try a slice (run command, address, test account or seed data).

### 3. Establish the Verification Commands

Run each command you found: build, unit tests, UI tests, integration tests, the format or lint check in its non-modifying form, and one filtered test run. Record the commands that work, exactly as you ran them.

- A command that fails, or passes with warnings, is reported to the user with its output. Do not repair the project as part of the setup unless the user asks.
- A level that does not exist yet (no test project, no integration harness, no linter) is written down as "not established yet". Do not invent a command you have not run.

### 4. Write the project settings

Fill in `.claude/templates/project-settings.md` with the answers and the verified commands, and put the result in `CLAUDE.md`:

- no `CLAUDE.md`: create one with a title line, one or two sentences on what the project is, and the Project settings section;
- an existing `CLAUDE.md`: add the Project settings section and keep everything else. Where it holds instructions that contradict this workflow (plan mode, plan files, a build order by layer, committing without the user), show the user the lines and propose the change; do not remove them unasked.

No placeholder in angle brackets may remain in the section. Leave the template file itself unchanged.

### 5. Guard commit and push

Claude commits and pushes only when the user asks for it in the conversation; it never does so on its own initiative (accepting a slice stays the user's decision). Make sure `.claude/settings.json` asks for confirmation on both, by creating the file or merging these entries into its existing `permissions.ask` list. Do not put them under `permissions.deny`: that blocks the commands even when the user asks for them.

```json
{
  "permissions": {
    "ask": [
      "Bash(git commit)",
      "Bash(git commit *)",
      "Bash(git push)",
      "Bash(git push *)",
      "PowerShell(git commit)",
      "PowerShell(git commit *)",
      "PowerShell(git push)",
      "PowerShell(git push *)"
    ]
  }
}
```

If you are not allowed to write that file, show the user the entries to add. If the existing `permissions.deny` list already holds any of these entries, move them to `permissions.ask` and tell the user.

### 6. Prepare the specs folder

Create `_specs/` (with a `.gitkeep` when it would otherwise be empty). Each feature gets a folder there: `_specs/<FeatureName>/spec.md` and one `slice-<n>.md` recap per accepted slice.

When the project already has specs or plans in another form, list them for the user and leave them where they are. Converting one is a separate piece of work that starts with the `investigate` skill.

### 7. Check the setup

- `/new-feature`, `/investigate`, `/write-spec` and `/build-slice` are available, and the `bugfix` and `spec-reviewer` agents exist. If a skill is not listed, tell the user to restart the session.
- `CLAUDE.md` § Project settings has a value, or an explicit "not established yet", on every line.
- Every command under Verification Commands was run by you in this session.
- Mermaid diagrams can be read where the user reviews specs: the editor's Markdown preview or the repository host. If not, say so; the diagrams are part of every spec and every recap.

### 8. Report and hand back

Tell the user:

- what you wrote and where;
- the Verification Commands and their result today;
- what is not established yet, and what that means for the first spec. When there is no integration test level or no working code, slice 1 of the first spec is the walking skeleton: the thinnest path from the entry point to persistence, with the test harness that proves it;
- anything in the existing instructions that contradicts the workflow and awaits their decision;
- the next step: `/new-feature <name and a sentence of context>`.

Then ask whether to delete this file. It has done its work once the project is set up; the workflow lives in `.claude/rules/spec-driven.md`.

## Why the workflow is built this way

Keep these in mind when a situation is not covered.

- **No plan file.** In the project this kit comes from, plans were three to five times longer than their specs, froze 50 to 100 file references each, went stale, and 13 of 18 were never executed. The spec states what must be true; the files, classes and tests are worked out from the current code when a slice is built.
- **Investigation before the interview.** Questions asked before reading the code are questions the code could have answered, and a spec built on unverified statements about the code is wrong from the first line.
- **A slice is proven from its first minute.** The slice test is written before the code. For a wire slice it goes end to end, so a mismatch between contracts, queries and what the page expects shows up at once and not at the end of a layer-by-layer build.
- **UI first, on a stub.** A page on fake data is a vertical slice of the UI: the user can use it and judge it. Changing a page before its backend exists costs little; changing it afterwards means changing contracts, queries and tests as well. The wire slice that follows replaces the stub and is proven by an integration test.
- **A check must be able to fail.** In the trial run, a reviewer without context found a test that passed on any 401 and proved nothing. Hence the question asked of every check: would it fail if the behavior were broken? For tests added to existing behavior, RED means breaking that behavior on purpose, then restoring it.
- **Diagrams are for the person who approves.** The user accepts a spec and every slice. A picture of what happens and of how it is built lets them judge in a minute what would take much longer from prose and a diff.
- **The commit is the acceptance.** Claude does not commit on its own initiative: the user commits, or asks Claude to commit. A clean working tree tells the next session that the previous slice was accepted.
- **A fresh session per slice.** The spec, not the conversation, has to carry the context; building in a new session tests exactly that.
- **Commit the spec first.** The spec is usually written before the feature branch exists. Advise the user to make it the first commit on that branch, so the approval visibly precedes the code.
