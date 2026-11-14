# Spec-driven development

This file defines how work is done in this repository: when a spec is needed, how it is prepared, how a slice is built and proven, and where Claude stops for the user. It is the same in every project; the project's own values are in `CLAUDE.md` § Project settings.

The spec is the only planning document. Plan mode and plan files are not used: the approach to a slice is worked out from the current code when the slice is built, and stated in the conversation.

## The phases

| Phase | What happens | Skill | Ends with |
|---|---|---|---|
| 1. Investigate | Read the code, the reference feature and what the request depends on; record verified findings and the questions they raise | `investigate` | Findings and questions in the spec file |
| 2. Interview | Ask the user, round by round, until the spec could be written without assumptions | `write-spec` | No open question that changes behavior |
| 3. Specify | Write behavior, acceptance criteria, the two diagrams and the vertical slices | `write-spec` | The user approves the spec |
| 4. Build | One slice, in a fresh session: the slice test first (integration test, or UI test for a stub slice), then a unit test before every piece of logic | `build-slice` | Verification Commands green |
| 5. Approve | Write the slice recap and stop. The user reads it, tries the slice, reviews the diff and commits | `build-slice` | The user's commit |
| 6. Review | After the last slice, a context-free reviewer checks every acceptance criterion against the full diff | `spec-reviewer` agent | The user pushes |

`new-feature` runs the phases in order.

## Spec Gate

Decide before the first change what the work needs.

| Situation | What to do |
|---|---|
| New feature or new behavior | Spec, approved by the user, before any code |
| Change in a risk area | Spec, approved by the user, before any code |
| Work that will not fit in one session | Spec, approved by the user, before any code |
| Contained change that fits in one session | No file. Say in the conversation what will be true afterwards and which test proves it, then build test first |
| Bugfix in one or two files | No spec; regression test first (`bugfix` agent) |
| Config correction, simple refactor | No spec |

## The spec

A spec lives in `_specs/<FeatureName>/spec.md` and follows `.claude/templates/spec-template.md`. It says what must be true when the work is done, how that is checked, and what it looks like.

- **Holds**: status, goal, findings, constraints (⚠️ on risk areas), behavior, two diagrams, numbered acceptance criteria that each name their check, ordered slices, out of scope, open questions.
- **Leaves out**: file lists, class and test method names, line numbers, code. Whoever builds the slice works those out from the current code, so they cannot go stale. Exception: a contract that is itself the requirement (a route, a DTO shape, a message name).
- **Diagrams**: one for *what* happens (the flow the user or the calling system goes through) and one for *how* it is built (the components involved, which are new or changed, and which slice adds each part). Mermaid, at component level, never at file or class level.
- **Stays true**: when a decision during the build changes behavior or architecture, edit the spec, its diagrams included, and add a Status line. The spec describes the system as it will be, not the history of how it got there.

## Vertical slices

A slice is one new piece of functionality across every layer it needs, named after what the user or the system can do afterwards. Slice by behavior, never by layer: "create entity, add repository, build controller, create page" leaves nothing observable until the last step.

Every slice names two checks:

- **Slice test**: the automated test that is written first and decides whether the slice works. For a wire slice or any slice without UI it is an integration test: one scenario through the real entry point (HTTP call, page, command, message) down to real persistence. For a stub slice it is a UI test of the page on its stubbed service. `CLAUDE.md` § Project settings defines both levels. Work that no slice test can prove is not a slice: fold it into the slice whose behavior it supports.
- **Human check**: the steps the user carries out to see the slice work. When a slice has nothing a human can observe, the spec says so and why; the slice test is then the only check. A stub slice always has one: being tried by the user is its purpose.

A UI behavior is cut into two slices:

1. **Stub**: the page, form or component with its real interaction, on a stubbed service that returns fake data. It is a vertical slice of the UI: the user can open it, use it and judge it before any backend exists, and a change of mind costs little.
2. **Wire**: the stub is replaced by real code from top to bottom (API, logic, persistence), proven by an integration test. The stub is removed.

Finish the stub and the wire of one behavior before starting the next. A slice that needs two scenarios with different outcomes for the user is two slices. A slice too large to prove in one cycle is split into smaller behaviors, never into layers. No slice depends on a later one.

In a project with no working code yet, slice 1 of the first spec is the walking skeleton: the thinnest path from the entry point to persistence, together with the test harness that proves it.

## Building a slice

Two loops, the outer one first.

1. **Outer RED**: write the slice test from the slice's acceptance criteria and run it: the integration test, or for a stub slice the UI test. It must fail because the behavior is missing, not because the harness is broken.
2. **Inner loop**, repeated until the slice test passes: write a unit test for the next piece of logic, see it fail, write the minimal code that passes it, refactor. Every line of production code answers a failing test: the slice test for wiring between layers, a unit test for logic (rules, branching, calculation, mapping, error handling, page state).
3. **Outer GREEN**: the slice test passes as it was written. If it had to change, say why.
4. **REFACTOR**: clean up and clear linter and analyzer warnings without weakening or disabling a rule.
5. **PROVE**: run the Verification Commands; all green, zero warnings. Check each acceptance criterion of the slice the way the spec says.

A test that never failed proves nothing about the change. For a slice that only adds tests to behavior that already exists, see each test fail by breaking that behavior on purpose (or asserting the opposite), then restore it. Ask of every check: would it fail if the behavior were broken?

## Approving a slice

After PROVE, write `_specs/<FeatureName>/slice-<n>.md` from `.claude/templates/slice-recap-template.md`: what can be done now, how it was built (the architecture diagram with this slice's part marked), the proof, what to read in the diff and in which order, and the steps to try it. It fits on one screen. Then add one line to the spec's Status and stop.

Claude commits or pushes only when the user explicitly asks for it in the conversation, never on its own initiative and never as part of finishing a slice. The user reads the recap, tries the slice, reviews the diff and commits the code together with the recap (or asks Claude to); that commit is the acceptance. A request to commit applies to that commit only; it is not permission for later ones. The next slice starts only on a clean working tree. If the tree still holds the previous slice, ask; do not build on top of it.

## Where Claude stops

- after the investigation, when a finding makes the request impossible or changes its size;
- after writing a spec, before any code;
- before building a slice marked ⚠️: state the approach in the conversation and wait for the user's go;
- after every slice, with the recap;
- when the build shows the spec is wrong or incomplete in a way that changes behavior or architecture.

## Tooling

- Skills: `new-feature`, `investigate`, `write-spec`, `build-slice`.
- Agents: `bugfix` (one- or two-file fixes, regression test first), `spec-reviewer` (final check of the diff against the spec). For codebase search use the built-in Explore agent.
- Templates: `.claude/templates/spec-template.md`, `.claude/templates/slice-recap-template.md`.
