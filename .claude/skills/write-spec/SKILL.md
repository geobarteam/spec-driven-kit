---
name: write-spec
description: "Use after the investigate skill, when a new feature, a risk-area change or work that spans sessions needs a spec before any code. Interviews the user round by round from the investigation's questions, then completes _specs/<FeatureName>/spec.md: behavior, the what and how diagrams, acceptance criteria with their checks, and ordered vertical slices (UI behaviors as a stub slice then a wire slice) that each name the test written first and a human check. Writes no code."
argument-hint: "The feature, e.g. 'Subscriptions'"
---

# Write Spec

Complete `_specs/<FeatureName>/spec.md` and stop for the user's approval. The spec is the only planning document (`.claude/rules/spec-driven.md`), so it has to be complete enough that a fresh session can build from it without this conversation.

This skill runs in the main conversation because it needs the user's answers. Change no file other than the spec.

## Before the interview

The spec file must already hold Findings and Open questions from the `investigate` skill. If it does not, run `investigate` first: an interview without findings asks the user what the code could have answered.

## Interview

Ask the user until you could write the spec without a single assumption.

- **Work in rounds.** Ask the questions whose answers decide the shape of the work first (who it is for, what they can do afterwards, which option from the Findings). Let the answers decide the next round. Stop when a new round would only confirm what you know.
- **Ask what only the user knows.** Never ask what the code or the Findings already answer. When the code suggests an answer, propose it and ask for a yes or a correction.
- **Offer choices** where the options are few and known, with the one you recommend first and the reason. Use the question tool for those; use plain questions for open ones.
- **Cover, as far as the feature needs them**: the user and the goal; data (fields, types, required, constraints, relations); the API (endpoints, auth, errors); pages (what the user sees at each step and where they go next); background work and messages; edge cases; what is out of scope; how each requirement will be checked; and what the user wants to see working first.
- **Record as you go.** After each round, move the answers into the spec and remove the questions they close.

Do not fill a gap with an assumption. A question the user cannot answer yet stays under Open questions, and the spec is not ready for approval while one remains that changes behavior.

## Writing

Use the sections of `.claude/templates/spec-template.md`; remove the ones the feature does not need. Diagrams and Slices always stay.

- **Behavior** in the detail the feature needs: rules with their messages, data, API, pages, edge cases.
- **Diagrams**, in Mermaid, at component level:
  - *What happens*: the flow the user or the calling system goes through, with the outcome at each step.
  - *How it is built*: the components involved and how data moves between them. Mark new and changed components, and put on each arrow the slice that adds it. A component that no slice adds and that does not exist today is a gap in the slices.
- **Acceptance criteria** are numbered and each names its check: a test at a stated level, an API call and its response, or a page action and its result. "Code review" is not a check. Ask of each check: would it fail if the behavior were broken?
- **Slices**: one row each, vertical, named by what the user or the system can do afterwards, ⚠️ on those that touch a risk area, with the acceptance criteria the slice satisfies and its two checks:
  - the **slice test**, written as a scenario with its expected outcome: an integration test through the real entry point, or for a stub slice a UI test of the page on its stubbed service, at the levels `CLAUDE.md` § Project settings defines;
  - the **human check**, written as steps the user can carry out, or "none" with the reason.
  Cut each UI behavior into a stub slice (the page with its real interaction on fake data, for the user to try and judge) and the wire slice that follows it (the real backend from top to bottom; the stub is removed). Finish the stub and the wire of one behavior before the next. Order the slices so that the first one gives the user something to see as early as possible. In a project with no working code yet, slice 1 is the walking skeleton and includes the test harness.
- **Leave out** file lists, class and test method names, line numbers and code. State a contract only when the contract is the requirement.

## Before presenting

Check the spec against these points and fix what fails:

1. Every acceptance criterion has a check that someone can run and that would fail if the behavior were broken.
2. Every slice is vertical, names one slice test, depends on no later slice, and has a human check or a stated reason for having none. Every UI behavior has its stub slice directly followed by its wire slice; the stub slice has a UI test and a human check, the wire slice an integration test. Work that no slice test can prove (a doc edit, a rename, a helper) is folded into the slice whose behavior it supports.
3. Every acceptance criterion belongs to a slice, and every slice appears in the architecture diagram.
4. Both diagrams agree with Behavior and are at component level.
5. Every risk area the feature touches is marked ⚠️ in Constraints and on its slice.
6. No file list, test name or line number crept in.
7. Status has the line "<date>: spec written. Not approved."

Then summarise in a few lines: the goal, the slices with what the user will see after each, the risk areas, the open questions. Tell the user to open the spec in a Markdown preview to see the diagrams, and ask for approval or changes. When the user approves, add "<date>: approved by the user" to Status. The build starts in a fresh session with the `build-slice` skill.
