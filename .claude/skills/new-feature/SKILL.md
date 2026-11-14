---
name: new-feature
description: "Take a new feature from a request to working slices: investigate the code, interview the user, write the spec, then build the approved spec slice by slice. Use when the user asks for a new feature or new behavior."
argument-hint: "Feature name plus any initial context, e.g. 'Subscriptions - user views and creates subscriptions'"
---

# New Feature

A new feature goes from a request to working slices. The workflow is defined in `.claude/rules/spec-driven.md`; this file only orders the hand-offs.

## Input

A feature name and, optionally, user stories or acceptance criteria. If `_specs/<FeatureName>/spec.md` already exists, read it and its Status first and continue from the phase it shows.

## Workflow

1. **Investigate**: use the `investigate` skill. It reads the code and what the request depends on, and writes the findings and the questions they raise into `_specs/<FeatureName>/spec.md`. No code.
2. **Interview and specify**: use the `write-spec` skill. It interviews the user round by round from those questions, writes the rest of the spec with its two diagrams and its slices, and stops for approval. No code.
3. **Build**: once the spec is approved, start a fresh session (`/clear` or a new conversation) and use the `build-slice` skill for the next slice. It writes the slice test first (an integration test, or a UI test for a stub slice), builds with a unit test before each piece of logic, proves the slice, writes the recap, and stops. It does not commit unless the user asks for it.
4. **Approve and repeat**: the user reads the recap, tries the slice, reviews the diff and commits. Then the next slice is built, again in a fresh session.
5. **Review**: after the last slice, the `spec-reviewer` agent compares the full diff with the spec and reports each acceptance criterion as met or not met. The user reviews that report, then pushes.

Phases 1 and 2 run in one conversation, because the interview builds on the findings. Phase 3 does not continue in it: the spec, not the conversation, has to carry the context.
