<!--
Fragment for the project's CLAUDE.md. The setup skill fills it in and merges it there.
The workflow itself is in .claude/rules/spec-driven.md and is not repeated in CLAUDE.md.
-->

## Project settings

The development workflow is in `.claude/rules/spec-driven.md`. The skills and agents read the values below.

<!-- One of the two lines below, as agreed during setup; remove both when the project has no other workflow. -->
In this repository that workflow leads. Do not use <the competing skills, by name> to plan or build here, also when their own instructions say they are mandatory.
<Or: the spec-driven workflow applies to <scope, e.g. features started with /new-feature>; everything else follows <the existing workflow, where it is described>.>

- **Reference feature**: `<the feature whose structure new features mirror>` <!-- or: none yet; the first feature built becomes the reference -->
- **Risk areas** (a human go before code): <auth, personal data, database schema, shared contracts, public API routes and DTOs, file storage>
- **Specs folder**: `_specs/`
- **Protected branches** (never build on them): `<main>`
- **Spec branch**: `<feature/<short-name>>` from `<base branch>`; one per spec, created by Claude when the spec starts, merged through a pull request
- **Commit format**: `<type>(<scope>): <desc>`

### Test levels

- **Integration test**: <what it goes through in this project, e.g. an HTTP call against the hosted API with a real database in a container; a browser test for pages>
- **UI test** (stub slices): <how a page is tested on a stubbed service, e.g. a component test or a browser test with the API faked; how the stub is switched on for a human check> <!-- or: no user interface -->
- **Unit test**: <what it covers and what it replaces with fakes>
- **Human check**: <how the user starts the application and where it answers, e.g. the run command and the local URL>
- **Browser tool**: <what Claude uses to open a page and take a screenshot when it runs a human check, e.g. the Playwright MCP server> <!-- or: none; Claude reports page checks as not carried out -->
- **Criterion ids on tests**: <how a test carries `AC-<n>`, e.g. a trait or category, a tag, or the test name>

### Verification Commands

The commands are in `.claude/spec-driven.json` under `verify.commands`, in the order build, unit tests, UI tests, integration tests, format or lint check that changes nothing. That file is the only place they are listed; a hook reads it too. Run all of them after any change to source code:

```
node .claude/hooks/verify.mjs
```

- Not established yet: <the levels that have no command yet, or: none>
- Single test or class: `<test command with a filter>`
- A step that changes no source file (docs, specs) does not need this gate; run that step's own check instead.
- After a dependency or analyzer change, run a clean build for the proof: an incremental build can hide warnings.
