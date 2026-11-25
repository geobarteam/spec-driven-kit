---
paths:
  - "src/Core/**"
  - "src/Contracts/**"
  - "src/Host/**"
  - "src/Presentation/**"
---
<!-- guideline: architecture -->
# Architecture shared by every solution on the organisation's layered layout

Applies when code is placed, moved or judged in a solution on the organisation's layered layout (Domain, Application, Persistence, Contracts, Presentation, hosts), whatever its hosting model. It loads when a file under `src/Core/`, `src/Contracts/`, `src/Host/` or `src/Presentation/` is opened, and the spec-driven workflow's skills and agents read it by its first line: the builder before it states where each new piece goes, the reviewer when it looks for a forbidden dependency. A Blazor guideline, when the project has one, states only what its hosting model adds or changes; everything below holds for both hosting models unless that guideline says otherwise.

How to use it:

- **Before writing code**, name the layer each new piece belongs to in the terms of the Layers statements, and check every new project reference and `using` against the two Dependencies tables. A piece that needs a forbidden dependency stops the slice: amend the spec or ask; do not build around the rule.
- **When judging a diff**, report a new forbidden dependency as a finding with the statement it breaks. An existing reference that the project's own guideline records as a known deviation is not reported again.
- Every statement carries its source key; the keys are listed under Sources.

## Statements

| Area | Statement | Source |
|---|---|---|
| Layers | `Core/Domain` holds entities and value objects in plain C#, with no framework dependency | CI-S, CI-W, DOM |
| Layers | `Core/Application` holds commands, queries, their handlers and the repository interfaces; it is where business rules run | CI-S, CI-W, APP |
| Layers | `Core/Persistence` holds the EF Core `DbContext`, the repositories and the entity configurations | CI-S, CI-W, PERS |
| Layers | `Contracts` holds the record DTOs and the NServiceBus events and messages shared between hosts | CI-S, CI-W, NSB |
| Layers | `Presentation` is a Razor class library: pages, view models, models, feature services and the typed HTTP clients | CI-S, CI-W |
| Layers | `Database` is a SQL Server database project; its schema is deployed by the user with Schema Compare, never by the application | CI-S, CI-W |
| Dependencies allowed | Domain references nothing. Application references Domain and Contracts. Persistence references Application and Domain. Contracts reference nothing | CI-S, CI-W, code |
| Dependencies allowed | `Test.Common` references no production project | CI-S, code |
| Dependencies forbidden | Application never references Infrastructure, Persistence or a host | CI-S, CI-W |
| Dependencies forbidden | Contracts never reference Core or a host | CI-S, CI-W |
| Dependencies forbidden | No circular reference between projects; no host references another host except to serve its files, where the hosting model's guideline allows it | CI-S, CI-W |
| Dependencies forbidden | EF Core is used in Persistence only: no `DbContext`, `DbSet` or EF Core package outside it | CI-S, CI-W, PERS |
| Project structure | A feature lives under `Functionalities/<Feature>/` in Domain and Application, with `Commands/<Action>/` and `Queries/<Action>/` in Application | APP, DOM |
| Project structure | One entity per file; repositories in `Repositories/`; entity configurations in `EntityTypeConfigurations/` | DOM, PERS |
| Project structure | DTOs in `Contracts/<Feature>/`, events in `Contracts/<Feature>/Events/`, messages in `Contracts/<Feature>/Messages/` | NSB |
| Naming | `<Entity><Action>Command`, `<Entity><Action>Handler`, `I<Entity><Action>Query`, `I<Entity>Repository`, `<Entity>Dto` (a record), `<Entity>Controller`, `<Feature>ViewModel` | CI-S, CI-W |
| Naming | `<Entity><PastTenseVerb>Event` (a record), `<Entity>Message` (a class); private fields `_camelCase`; routes in kebab-case | CI-S, CI-W |
| Dependency injection | Services are registered only through one `*Module` class per layer, with Scrutor scanning by name suffix; never `services.Add…<T>()` in `Program.cs` for an application service | CI-S, CI-W |
| Dependency injection | Every registered service has an `I<Name>` interface and is injected through it | CI-S, CI-W |
| Dependency injection | Lifetimes: a `Query` and a `Handler` are scoped (ApplicationModule); a `Repository` is scoped (PersistenceModule) | CI-S, CI-W |
| Data access | Every read query uses `AsNoTracking()`; related data is loaded with `Include` or `AutoInclude`, never one query per row (no N+1) | PERS, CI-S, CI-W |
| Data access | Mapping is configured through `IEntityTypeConfiguration<T>`, never through attributes on an entity; repositories derive from `BaseRepository<T>` | PERS, DOM |
| Data access | A schema change is a SQL file in `Database/Tables/`, never an EF Core migration | PERS, CI-S, CI-W |
| Error handling | A business error is returned as `Result<T>.Failure(message)`, never thrown | CI-S, CI-W, APP |
| Error handling | An unexpected exception is logged with `LogError(ex, …)` and rethrown | CI-S, CI-W, APP |
| Error handling | A controller maps `IsSuccess` to `Ok` and a failure to `BadRequest(result.Error)` | CI-S, CI-W, BFF |
| Error handling | In a message handler, a known error is logged as a warning and swallowed; an unknown one is logged and rethrown, so NServiceBus retries it | NSB |
| Messaging | Application publishes through `IMessagingService`, never through `IMessageSession` | NSB |
| Messaging | Events are immutable records, messages are mutable classes; a handler implements `IHandleMessages<T>` | NSB |
| Logging | Log through `ILogger<T>` of the enclosing type with structured placeholders, never interpolated text; the solution's core configuration package owns Serilog and OpenTelemetry, so application code holds no logging configuration | CI-S, CI-W, LOG |
| Logging | Levels: `Debug` for flow detail and validation rejections; `Information` for business milestones; `Warning` for a degraded but handled situation; `Error` for a failed user operation, with the exception as the first argument; `Critical` for an application that cannot work | LOG |
| Logging | Never log personal data: no user name, INS or NISS number, e-mail address, phone number, postal address, dossier file name or form content. Log a non-identifying correlate (an internal id) instead. Log state transitions, never every turn of a polling loop | LOG, CI-S, CI-W |
| Configuration | Settings layer as `appsettings.json`, then `.Development`, then `.UnitTest`, then `.UnitTest.Development` (ignored by source control), then environment variables; there is no `appsettings.TST` or `appsettings.PRD` | CI-S, CI-W |
| Configuration | The `Application` settings block names the business system, subsystem, type and environment; no secret in a committed settings file | CI-S, CI-W |
| Configuration | Every host has `protected Program() {}`, so the integration tests can start it | CI-S, CI-W |
| Configuration | The analyzer configuration in `Directory.Build.props` is fixed; a project does not change it to get a build through | CI-S, CI-W |

## Anti-patterns

Each one breaks a statement above; the statement is what a finding quotes.

| Do not | Instead |
|---|---|
| Throw an exception for a business rule | Return `Result<T>.Failure` |
| Register an application service in `Program.cs` | Let the layer's `*Module` register it by suffix |
| Reference Persistence or EF Core from Application | Declare a repository interface in Application and implement it in Persistence |
| Change the schema with an EF Core migration | Add a SQL file in `Database/Tables/` |
| Publish through `IMessageSession` from a handler in Application | Publish through `IMessagingService` |
| Write a log message with interpolation or personal data | A constant template, PascalCase placeholders, a non-identifying id |

## Sources

The texts each statement was extracted from, read-only. Where the sources disagree, the spec of this guideline records the decision.

| Key | Base text |
|---|---|
| `CI-S` | The Blazor Server 3-tier template's main instructions: structure, dependency matrix, DI table, naming table, `Result<T>`, configuration layering, anti-patterns |
| `CI-W` | The Blazor WebAssembly 3-tier template's main instructions; its shared parts are word for word those of `CI-S` |
| `APP` | The template's application-layer instructions |
| `BFF` | The template's BFF controller instructions |
| `DOM` | The shared domain-entity instructions |
| `PERS` | The shared persistence-layer instructions |
| `NSB` | The shared NServiceBus instructions |
| `LOG` | The WebAssembly template's logging instructions: the level semantics and the personal-data ban, applied to every host |
| `code` | The project files of the two reference solutions, read for their references |
