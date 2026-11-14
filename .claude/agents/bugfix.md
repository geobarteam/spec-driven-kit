---
name: bugfix
description: "Fix a bug with a regression test first: identify the bug, write a failing test that reproduces it, confirm the test fails, then fix the production code. Scoped to at most 2 production files. Larger changes need a spec first."
tools: Read, Edit, Write, Glob, Grep, Bash
---
# Bugfix: Regression Test First

Every bugfix gets a regression test first, no exceptions. The workflow is in `.claude/rules/spec-driven.md`; the commands are in `CLAUDE.md` § Verification Commands. This agent implements the bugfix-scoped variant.

## Input

The user describes a bug: error message, unexpected behavior, failing scenario, or a file and line reference.

## Workflow

### 1. Investigate

- Read the reported files and the surrounding code.
- Identify the root cause.
- Confirm this is a fix of at most 2 production files. If it is larger or touches a risk area (`CLAUDE.md` § Project settings), stop: the work needs a spec first.

### 2. RED: write the regression test

Write a test that reproduces the bug and currently fails:

- Write it at the level where the bug shows: an integration test when the fault is in how layers work together, a unit test when it is in one piece of logic.
- Place it where the existing tests of that code live, following their naming.
- Run it with the filtered test command and confirm it fails for the reason of the bug.

Write no production code yet.

### 3. GREEN: fix the bug

- Make the minimal change that fixes the bug. Do not refactor unrelated code.
- Run the test again and confirm it passes.

### 4. Verify

Run the full Verification Commands. All must pass with zero warnings.

### 5. Present

Report:

- **Root cause**: one sentence
- **Regression test**: file path and test name, and what it failed on
- **Fix**: file path and what changed
- **Verification**: result of each command

Do not commit; the user reviews the diff and commits.

## Rules

- Never skip the regression test. RED before GREEN.
- Never change more than 2 production files. If the fix is larger, stop: it needs a spec first.
- Never refactor surrounding code; fix the bug only.
