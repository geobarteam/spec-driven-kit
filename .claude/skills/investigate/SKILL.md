---
name: investigate
description: "Use before a spec is written, or when the user asks to analyse a request or check whether it is feasible. Reads the reference feature, the code the request touches and what it depends on, and writes verified findings, the options that fit the code and the questions for the interview into _specs/<FeatureName>/spec.md. Writes no code."
argument-hint: "The feature or change, e.g. 'Subscriptions - user views and creates subscriptions'"
---

# Investigate

Find out what is true today, before anyone decides what to build. The result is the Findings section of `_specs/<FeatureName>/spec.md` and a list of questions for the interview. Change no file other than that one.

## Before reading

Look for an existing spec with the same subject under `_specs/`. If one exists, read it and its Status, and ask whether the request updates it or is new work. Do not overwrite work in progress.

## What to read

1. **The reference feature** (`CLAUDE.md` § Project settings) across the layers the request touches. Use another feature when the user names one or when one is clearly closer, and say which and why. For technical work the reference may be a library's source or documentation.
2. **The code the request changes**: the entry points, the logic behind them, the data they use, and their tests. Note what the existing tests cover and at which level.
3. **What the request depends on**: the schema when data is involved, the API and its contracts when an API changes, the page and its state when the UI changes, the package documentation when a library capability is used. When a claim can be checked by running something (a build, a test, a query, a small script), run it.
4. **Risk areas** (`CLAUDE.md` § Project settings) the request touches.

In a large codebase, use the Explore agent to locate code, then read the files that matter yourself. A finding rests on what you read or ran, not on a summary.

In a project with no code yet, the investigation covers the requirements the user gave, the chosen stack and its documentation, and any reference implementation elsewhere; say plainly that nothing exists to read.

## What to write

Create `_specs/<FeatureName>/spec.md` from `.claude/templates/spec-template.md` and fill in only:

- **Status**: "<date>: investigation done. Spec not written."
- **Goal**: as far as the request states it.
- **Findings**: what exists today, what the request depends on, the risk areas touched, and the options that fit the code. Each finding says how it is known (the file read, the command run). Something you could not verify is not a finding; it is a question.
- **Open questions**: everything the request and the code do not answer, ordered so that the questions whose answer changes the size or shape of the work come first.

Leave the other sections as they are in the template.

## Report

Tell the user, in a few lines: what exists today that the feature builds on, what turned out to be different from what the request assumes, the options with the one you recommend, and how many questions remain for the interview.

Stop there when a finding makes the request impossible as stated or changes its size by much; the user decides how to go on. Otherwise continue with the `write-spec` skill in the same conversation.
