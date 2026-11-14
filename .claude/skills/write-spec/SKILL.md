---
name: write-spec
description: "Use after the investigate skill, when a new feature, a risk-area change or work that spans sessions needs a spec before any code. Interviews the user from the investigation's questions, then completes _specs/<FeatureName>/spec.md: behavior, two diagrams, acceptance criteria with their checks, and ordered vertical slices. Writes no code."
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
- **Diagrams**, in Mermaid, at component level, never at file or class level:
  - *What happens*: the flow the user or the calling system goes through, with the outcome at each step.
  - *How it is built*: the components involved and how data moves between them. Mark new and changed components, and put on each arrow the slice that adds it. A component that no slice adds and that does not exist today is a gap in the slices.
- **Acceptance criteria** are numbered and each names its check: a test at a stated level, an API call and its response, or a page action and its result. "Code review" is not a check. Ask of each check: would it fail if the behavior were broken? The tests that prove a criterion will carry its id, so keep the ids stable once the spec is approved.
- **Slices**: one row each, named by what the user or the system can do afterwards, ⚠️ on those that touch a risk area, with the acceptance criteria the slice satisfies, its two checks and the state "todo":
  - the **slice test**, written as a scenario with its expected outcome: an integration test through the real entry point, or for a stub slice a UI test of the page on its stubbed service, at the levels `CLAUDE.md` § Project settings defines;
  - the **human check**, written as steps the user can carry out, or "none" with the reason. A stub slice always has one: being tried by the user is its purpose.
- **Leave out** file lists, class and test method names, line numbers and code. State a contract only when the contract is the requirement.

### Cutting the slices

- Slice by behavior, never by layer: "create entity, add repository, build controller, create page" leaves nothing observable until the last step.
- Cut each UI behavior into a **stub** slice (the page, form or component with its real interaction on fake data, for the user to try and judge before any backend exists) and the **wire** slice that follows it (API, logic and persistence from top to bottom; the stub is removed). Finish the stub and the wire of one behavior before the next.
- Do not cut a UI change that leaves the user nothing to judge (a column, a label, a field on an existing form): make it one slice with an integration test, and write "single slice: nothing to judge on a stub" in its row. When in doubt, ask the user whether they want to see it first.
- A slice that needs two scenarios with different outcomes for the user is two slices. A slice too large to prove in one session is split into smaller behaviors.
- Work that no slice test can prove (a doc edit, a rename, a helper) is not a slice: fold it into the slice whose behavior it supports.
- Order the slices so that the first one gives the user something to see as early as possible. No slice depends on a later one.
- In a project with no working code yet, slice 1 is the walking skeleton: the thinnest path from the entry point to persistence, together with the test harness that proves it.

## Before presenting

1. Check the spec yourself and fix what fails:
   - every acceptance criterion has a check that someone can run and that would fail if the behavior were broken;
   - every acceptance criterion belongs to a slice, and every slice appears in the architecture diagram;
   - both diagrams agree with Behavior;
   - every risk area the feature touches is marked ⚠️ in Constraints and on its slice;
   - no file list, test name or line number crept in.
2. Start the `spec-critic` agent with the path of the spec and nothing from this conversation. Fix what it reports. Where you disagree with a finding, keep it for the summary; where a finding needs an answer only the user has, add it to Open questions.
3. Add to Status: "<date>: spec written, critic run. Not approved."

Then summarise in a few lines: the goal, the slices with what the user will see after each, the risk areas, the open questions, and any critic finding you did not follow, with the reason. Tell the user to open the spec in a Markdown preview to see the diagrams, and ask for approval or changes.

Mention batch mode once, as an option and not as a recommendation: slices not marked ⚠️ are then built, verified and committed by Claude back to back, and the user reviews them together at the end. The default is one slice, one review, one commit by the user.

When the user approves, add "<date>: approved by the user" to Status, and "<date>: batch mode on" if they asked for it. The build starts in a fresh session with the `build-slice` skill.
