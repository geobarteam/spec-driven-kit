<!-- spec-driven-kit 2.0.0 -->
# Spec-driven development

This file defines how work is done in this repository: when a spec is needed, what a spec and a slice are, and where Claude stops for the user. The procedures are in the skills and are not repeated here. The project's own values are in `CLAUDE.md` § Project settings.

The spec is the only planning document. Plan mode and plan files are not used: the approach to a slice is worked out from the current code when the slice is built, and stated in the conversation.

**Precedence.** In this repository this file outranks any plugin or user-level skill that prescribes another planning workflow (brainstorm-then-plan, plan files, building from a task list). Use such a skill only for what this workflow does not cover, such as debugging technique.

## The phases

| Phase | What happens | Skill or agent | Ends with |
|---|---|---|---|
| 1. Investigate | Read the code and what the request depends on; record verified findings and questions | `investigate` | Findings and questions in the spec file |
| 2. Interview | Ask the user, round by round, until the spec could be written without assumptions | `write-spec` | No open question that changes behavior |
| 3. Specify | Behavior, acceptance criteria, two diagrams, vertical slices; a context-free critic reads it before the user does | `write-spec`, `spec-critic` | The user approves the spec |
| 4. Build | One slice in a fresh session: the slice test first, then a unit test before every piece of logic | `build-slice` | Verification green |
| 5. Verify and approve | A context-free verifier tries to break the slice's checks; then the recap, and stop | `slice-verifier`, `build-slice` | The user's commit |
| 6. Review | After the last slice, a context-free reviewer checks every acceptance criterion against the full diff | `spec-reviewer` | The user pushes |

`new-feature` runs the phases in order. `amend-spec` changes an approved spec. `bugfix` handles small fixes.

## Spec Gate

Decide before the first change what the work needs.

| Situation | What to do |
|---|---|
| New feature or new behavior | Spec, approved by the user, before any code |
| Change in a risk area | Spec, approved by the user, before any code |
| Work that will not fit in one session | Spec, approved by the user, before any code |
| Contained change that fits in one session | No file. Say in the conversation what will be true afterwards and which test proves it, then build test first |
| Bugfix in one or two files | No spec; regression test first (`bugfix` skill) |
| Config correction, simple refactor | No spec |

## The spec

A spec lives in `_specs/<FeatureName>/spec.md` and follows `.claude/templates/spec-template.md`. It says what must be true when the work is done, how that is checked, and what it looks like.

- **Leaves out** file lists, class and test method names, line numbers and code, so it cannot go stale. Exception: a contract that is itself the requirement (a route, a DTO shape, a message name).
- **Stays true during the build.** When a decision changes behavior or architecture, the spec is changed first, through `amend-spec`, with the user's approval.
- **Is history once shipped.** After the final review the spec is marked shipped. From then on the code is the truth; a later investigation verifies a shipped spec against the code before relying on it.

## Slices

A slice is one new piece of functionality across every layer it needs, named after what the user or the system can do afterwards. Slice by behavior, never by layer. No slice depends on a later one.

- Every slice names a **slice test**, written first (an integration test through the real entry point; for a stub slice a UI test of the page on its stubbed service), and a **human check**, or the reason there is none.
- A UI behavior is cut into a **stub** slice (the page on fake data, for the user to try and judge) directly followed by its **wire** slice (the real backend from top to bottom; the stub is removed). Exception: a UI change with nothing for the user to judge (a column, a label, a field on an existing form) is one slice with an integration test, and the spec says so.
- Every test that proves an acceptance criterion carries the criterion's id (`AC-3`) in its name or in a trait, tag or comment, so the check can be found without guessing.

## Proof

- Every line of production code answers a failing test: the slice test for wiring between layers, a unit test for logic.
- A test that never failed proves nothing. Ask of every check: would it fail if the behavior were broken?
- The builder does not grade its own work. `slice-verifier` checks each slice, `spec-reviewer` the whole feature, and neither is given the builder's account.

## Commit and push

Claude commits or pushes only when the user explicitly asks for it in the conversation. A request to commit applies to that commit only. The user's commit of a slice, together with its recap, is the acceptance; the next slice starts only on a clean working tree.

One exception, **batch mode**: when the spec's Status holds the line "batch mode on", written at the user's request, Claude commits each verified slice that is not marked ⚠️ on the feature branch and goes on to the next (see `build-slice`). Batch mode never pushes.

## Where Claude stops

- after the investigation, when a finding makes the request impossible or changes its size;
- after writing a spec, before any code;
- before building a slice marked ⚠️: state the approach in the conversation and wait for the user's go;
- after every slice, with the recap (in batch mode: after the last slice, at a ⚠️ slice, or when the verifier reports a failure);
- when the build shows the spec is wrong or incomplete in a way that changes behavior or architecture.

## Tooling

- Skills: `new-feature`, `investigate`, `write-spec`, `build-slice`, `amend-spec`, `bugfix`.
- Agents: `spec-critic` (the spec, before approval), `slice-verifier` (one slice, before its recap), `spec-reviewer` (the full diff, after the last slice). For codebase search use the built-in Explore agent.
- Hooks (`.claude/hooks/`, configured in `.claude/spec-driven.json` when the kit was set up): no source edits on a protected branch, no slice recap while verification fails, no file-changing git commands inside the review agents.
- Templates: `.claude/templates/spec-template.md`, `.claude/templates/slice-recap-template.md`.
