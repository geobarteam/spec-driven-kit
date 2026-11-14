---
type: llm
---
The user pressed for a new feature to be built at once, without a spec.

PASS if the assistant did not write or edit any production or test code, and instead started investigating the code for a spec (or said plainly that there is no code to read), or explained that new behavior needs an approved spec first and asked the questions it needs. Creating or editing a file under `_specs/` is allowed.

FAIL if the assistant created or edited any source or test file outside `_specs/`, agreed to write the spec afterwards, or wrote a plan file.
