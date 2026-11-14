<!--
Fragment for the project's CLAUDE.md. HANDOVER.md fills it in and merges it there.
The workflow itself is in .claude/rules/spec-driven.md and is not repeated in CLAUDE.md.
-->

## Project settings

The development workflow is in `.claude/rules/spec-driven.md`. The skills and agents read the values below.

- **Reference feature**: `<the feature whose structure new features mirror>` <!-- or: none yet; the first feature built becomes the reference -->
- **Risk areas** (a human go before code): <auth, personal data, database schema, shared contracts, public API routes and DTOs, file storage>
- **Specs folder**: `_specs/`
- **Protected branches** (never build on them): `<main>`
- **Feature branch name**: `<feature/<short-name>>` from `<base branch>`
- **Commit format**: `<type>(<scope>): <desc>`

### Test levels

- **Integration test**: <what it goes through in this project, e.g. an HTTP call against the hosted API with a real database in a container; a browser test for pages>
- **UI test** (stub slices): <how a page is tested on a stubbed service, e.g. a component test or a browser test with the API faked; how the stub is switched on for a human check> <!-- or: no user interface -->
- **Unit test**: <what it covers and what it replaces with fakes>
- **Human check**: <how the user starts the application and where it answers, e.g. the run command and the local URL>

### Verification Commands

Run all of these after any change to source code:

```
<build command>
<unit test command>
<UI test command>
<integration test command>
<format/lint check that changes nothing>
```

- Single test or class: `<test command with a filter>`
- A step that changes no source file (docs, specs) does not need this gate; run that step's own check instead.
- After a dependency or analyzer change, run a clean build for the proof: an incremental build can hide warnings.
