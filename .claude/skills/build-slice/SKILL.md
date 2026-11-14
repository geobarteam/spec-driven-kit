---
name: build-slice
description: "Use when implementing a slice of an approved spec (_specs/<FeatureName>/spec.md). Writes the slice test first (an integration test, or a UI test for a stub slice) and sees it fail, builds the slice with a unit test before each piece of logic until the slice test passes, proves it with the verification commands, writes the slice recap, and stops for the user to review and commit."
argument-hint: "The spec and the slice, e.g. 'Subscriptions slice 1' or 'next slice of Subscriptions'"
---

# Build Slice

Build one slice of an approved spec, following `.claude/rules/spec-driven.md` (Building a slice, Approving a slice) and the values in `CLAUDE.md` § Project settings. One slice per session.

## Before changing files

1. **Read the spec**: `_specs/<FeatureName>/spec.md`. Its Status must show it approved; if not, stop and say so. The next slice is the first one in Slices without a "done" line in Status.
2. **Check the working tree**: be on a feature branch, not on a protected branch, and the tree must be clean. If no feature branch exists yet, ask the user to create it or confirm its name. Uncommitted changes of an earlier slice mean the user has not accepted it yet: ask, do not build on top of it.
3. **Read the code the slice touches**, and the reference feature named in the spec's Findings for every layer involved. Path-scoped rules in `.claude/rules/` load as you open those files; follow them.
4. **State the approach** in a few lines in the conversation: the slice test and where it enters the system, the layers the slice passes through, the logic that will get unit tests, anything the spec did not foresee. For a slice marked ⚠️, wait for the user's go. For the others, continue.

If the spec turns out to be wrong or incomplete in a way that changes behavior or architecture, stop and ask; then edit the spec, its diagrams included, so it stays true. Do not build around a gap silently.

## Building

1. **Slice test first.** Write the scenario the slice names, at the level the Project settings define: for a wire slice or a slice without UI, an integration test through the real entry point; for a stub slice, a UI test of the page on its stubbed service. Add only what is needed for it to run (an empty route, a type that compiles). Run it filtered and confirm it fails because the behavior is missing. A failure in the harness, the setup or the test's own code is not that failure: fix it and run again.
2. **Unit test before logic.** Take the next thing the slice test needs. When it is logic (a rule, a branch, a calculation, a mapping, an error path, page state), write its unit test, see it fail for the expected reason, then write the minimal code that passes it. When it is wiring between layers, the slice test is the failing test that asks for it. Repeat until the slice test passes.
3. **Leave the slice test as written.** If it had to change to pass, say what changed and why in the recap.
4. **Refactor** with all tests green, and clear linter and analyzer warnings without weakening or disabling a rule. Mirror the reference feature's structure and naming.
5. **Prove**: run the Verification Commands; all green, zero warnings. Check each acceptance criterion of the slice the way the spec says.
6. **Run the human check yourself** as far as you can: start the application, make the call or open the page, and keep the output. Whatever you could not carry out, say so; do not report it as done.

The two kinds of UI slice:

- **Stub slice**: build the page, form or component with its real interaction and its real state handling, behind the same service interface the wire slice will implement, on a stub that returns fake data. Cover the states the spec names (filled, empty, error, loading). No backend code. Make the stub easy to switch on for the human check and easy to remove.
- **Wire slice**: replace the stub from the API down to persistence, with the integration test first. Remove the stub and its fake data from the production path. The stub slice's UI tests keep passing; when one has to change, the contract moved: say so in the recap.

For a slice that only adds tests to behavior that already exists, see each new test fail by breaking the behavior on purpose or asserting the opposite, then restore it.

## Recap and stop

1. Write `_specs/<FeatureName>/slice-<n>.md` from `.claude/templates/slice-recap-template.md`:
   - **What you can do now**: the behavior added, in the user's words.
   - **How it is built**: the path a request takes, the decisions the spec did not prescribe, and the spec's architecture diagram with this slice's part marked.
   - **Proof**: the slice test and what it failed on first, the unit tests added, the Verification Commands, each acceptance criterion with its evidence.
   - **What to review**: three to seven places in the diff, in reading order, each with what to look for. Start with the slice test; include every part that touches a risk area.
   - **Try it**: the human check as steps that work now, with the commands and addresses of this project. For a stub slice, say that the data is fake, how the stub is switched on, and what the user is asked to judge (layout, wording, interaction).
   Keep it to one screen. The recap helps the user understand and judge the slice; it is not a log of the session.
2. Add one line to the spec's Status: slice, date, proof result, decisions taken.
3. Stop and report in the conversation: what the user can do now, the proof result, the path of the recap (to open in a Markdown preview for the diagram), and the steps to try it.

Do not commit. The user reads the recap, tries the slice, reviews the diff and commits the code with the recap; that commit is the acceptance. Build the next slice only when the user asks for it and the working tree is clean.

## After the last slice

Start the `spec-reviewer` agent. Give it the spec path and the diff range (base branch to HEAD), nothing from this session. Relay its report to the user as it is, with what you would change in response.
