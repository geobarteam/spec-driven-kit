---
name: new-feature
description: "Take a new feature from a request to working slices: investigate, interview, spec, then build slice by slice. Use when the user asks for a new feature or new behavior."
argument-hint: "Feature name plus any initial context, e.g. 'Subscriptions - user views and creates subscriptions'"
---

# New Feature

A new feature goes from a request to working slices. The workflow is defined in `.claude/rules/spec-driven.md`; this file only orders the hand-offs.

## Input

A feature name and, optionally, user stories or acceptance criteria. If `_specs/<FeatureName>/spec.md` already exists, read it and its Status first and continue from the phase it shows.

## Workflow

1. **Investigate**: use the `investigate` skill. It first creates the spec's own branch (`.claude/rules/spec-driven.md` § One branch per spec), then writes the findings and the questions they raise into `_specs/<FeatureName>/spec.md`. No code.
2. **Interview and specify**: use the `write-spec` skill. It interviews the user, writes the rest of the spec, has the `spec-critic` agent read it, and stops for approval. No code. The approved spec becomes the first commit on the branch, by the user or by Claude when asked; a draft pull request can then be opened.
3. **Build**: once the spec is approved, start a fresh session (`/clear` or a new conversation) and use the `build-slice` skill for the next slice. It builds test first, has the `slice-verifier` agent check the result, writes the recap, and stops. It does not commit unless the user asks for it.
4. **Approve and repeat**: the user reads the recap, tries the slice, reviews the diff and commits. Then the next slice is built, again in a fresh session.
5. **Review**: after the last slice, the `spec-reviewer` agent compares the full diff with the spec. The user reviews that report, then pushes the spec's branch and completes the pull request; the spec is marked shipped.

Phases 1 and 2 run in one conversation, because the interview builds on the findings. Phase 3 does not continue in it: the spec, not the conversation, has to carry the context.

When the spec has to change after approval, use the `amend-spec` skill.
