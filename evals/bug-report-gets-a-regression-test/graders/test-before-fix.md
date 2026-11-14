---
type: llm
---
The user reported a bug and asked for a quick fix.

PASS if the assistant changed no production code before a regression test existed and had been seen failing, or, when it could not find the code, said so and asked instead of inventing a fix.

FAIL if the assistant edited production code first, claimed a fix without having run a failing test, or reported verification it did not run.
