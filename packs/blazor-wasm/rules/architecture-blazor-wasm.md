---
paths:
  - "src/Host/Cfe/**"
  - "src/Host/Wasm/**"
  - "src/Host/Worker/**"
  - "src/Presentation/**"
  - "src/Infrastructure/**"
---
<!-- guideline: architecture -->
# Architecture of a Blazor WebAssembly solution

Applies when code is placed, moved or judged in a Blazor WebAssembly solution with a Cfe host (Cfe, Wasm client, Worker). This guideline states only what Blazor WebAssembly adds or changes to the shared architecture rules: the shared architecture guideline holds the layers, the dependency rules, naming, dependency injection, data access, error handling, messaging, the logging levels, the ban on personal data in a log, and configuration every solution shares, and it applies unchanged; nothing of it is repeated here. It loads when a file under `src/Host/Cfe/`, `src/Host/Wasm/`, `src/Host/Worker/`, `src/Presentation/` or `src/Infrastructure/` is opened, and the spec-driven workflow's skills and agents read it by its first line: the builder before it states where each new piece goes, the reviewer when it looks for a forbidden dependency, a token in the browser or a missing antiforgery check.

How to use it:

- **Before writing code**, name the host and the layer each new piece belongs to in the terms of the What runs where and Layers statements, and check every new project reference against the Dependencies tables here and in the shared guideline. Code that ends up in the browser is public: a piece that would need a secret, a token or a server-only package there stops the slice; amend the spec or ask.
- **When judging a diff**, report a new forbidden dependency, a token or secret in the Wasm client or in Presentation, a state-changing action without the antiforgery filter, or an `HttpClient` or delegating handler of one's own, as a finding with the statement it breaks.
- Names such as `AddCoreOpenIdConnect` or `AddCoreWasmRefitClient<T>()` stand for the extension methods of the solution's core configuration package; read them as the names the project's own package uses.
- Where the template and the reference solution differ, this guideline follows the reference solution as it is built and says so in the statement.
- Every statement carries its source key; the keys are listed under Sources.

## Statements

| Area | Statement | Source |
|---|---|---|
| What runs where | Two deployable hosts and one optional: the Cfe (`Host/Cfe`, ASP.NET Core: serves the WebAssembly files, exposes the API, is the OIDC confidential client, hosts NServiceBus and the Hangfire dashboard, opens the database), the Wasm client (`Host/Wasm`, the browser entry point) and the Worker (`Host/Worker`, NServiceBus handlers and Hangfire processing). The template does not list the Worker; the reference solution has it | CI-W, code |
| What runs where | The Wasm client runs in the browser and holds no token, no connection string and no secret | CI-W, code |
| What runs where | Everything under `Presentation` and `Contracts` is compiled into the browser: no server-only package, no EF Core, no secret from configuration and nothing that must stay private is referenced from them. `Core/*` never runs in the browser | CI-W, code |
| Layers | Core has no Infrastructure layer. The browser-side infrastructure (cookie handler, authentication state, antiforgery token store) is a responsibility, not a required project: the template names a separate `Infrastructure` project, the reference solution has none and takes these types from the WebAssembly library of the solution's core configuration package, with its own extensions under `Presentation/Shared/ServiceClients/Bff/`. The project is optional | CI-W, code |
| Dependencies allowed | Presentation references Contracts (and the browser-side infrastructure when it is a project). `Host.Wasm` references Presentation and Contracts. `Host.Cfe` references Core, Contracts, Presentation and `Host.Wasm` (to serve it). `Host.Worker` references Contracts, Application and Persistence. `Test.Unit` references Presentation, Contracts and Core; `Test.UI` references Presentation; `Test.Integration` references `Host.Cfe` | CI-W, code |
| Dependencies forbidden | Presentation never references `Core.Application`, Persistence or a host; this is stricter than a server-side hosting model, where Presentation may see Application interfaces | CI-W |
| Dependencies forbidden | The browser-side infrastructure never references Core or a host; `Host.Wasm` never references Core | CI-W |
| Project structure | Cfe controllers in `Host/Cfe/Controllers/`, filters in `Host/Cfe/Filters/`, NServiceBus handlers in `Host/Cfe/Handlers/`; `STS/` holds the local test token server | CI-W, CFE, code |
| Project structure | Refit interfaces in `Presentation/Shared/ServiceClients/Bff/`; feature services in `Presentation/<Feature>/Services/`; models in `Presentation/<Feature>/Models/` | REFIT-W, CI-W |
| Dependency injection | A `ViewModel` and a `Service` are transient (PresentationModule), registered by the Wasm client's `Program.cs` through the module; `CfeModule` composes ApplicationModule and PersistenceModule for the Cfe | CI-W, code |
| Dependency injection | The Refit clients are registered in one place, `AddBffServiceClients()`, called by the Wasm client with the browser's base address: it registers the package's `CookieHandler` and each client through `AddCoreWasmRefitClient<T>()`. The template names a private `AddRefitClientWithCookies<T>()` instead; the reference solution uses the package. Never a Refit registration in `Program.cs` | REFIT-W, code |
| State | UI state lives in the browser and is lost on reload unless a presentation service persists it; a draft persisted in browser storage holds no personal data | CI-W, LOG |
| State | The authentication state comes from the Cfe's user endpoint through the package's authentication state provider, and is anonymous when that call fails; a view model reads it through `AuthenticationStateProvider` | CI-W, code |
| Data access | Only the Cfe and the Worker open the database; the browser reaches data through the Cfe API only | CI-W, code |
| Authentication | The Cfe is the OIDC confidential client (`AddCoreOpenIdConnect`); the browser holds only an `HttpOnly` session cookie | CI-W, CFE, code |
| Authentication | Every call from the Wasm client to the Cfe sends credentials (`credentials: include`) through the cookie handler; the Wasm client never receives, stores or forwards a token; never bypass or replace the cookie handler; never create an `HttpClient` or a delegating handler of one's own | CI-W, REFIT-W, code |
| Authentication | Every controller carries `[Authorize]`; `[AllowAnonymous]` stands only on the user endpoint, the only anonymous API | CFE, code |
| Authentication | Every state-changing action (`POST`, `PUT`, `DELETE`, `PATCH`) carries `[ApiAntiforgery]`, a filter of the Cfe that validates the `X-XSRF-TOKEN` header the cookie handler adds from the antiforgery token store; the user endpoint hands out the token | CFE, REFIT-W, code |
| Error handling | In the Cfe, a failure is logged before `BadRequest`; a successful create returns `Ok()`, not `Created` (the NSwag convention); domain entities are mapped to Contracts DTOs in the controller and never cross the API | CFE |
| Error handling | A feature service maps DTO to model, so a view model never sees a DTO; a Refit failure becomes a user message through the `ApiException` extensions (`GetUserFriendlyMessage`, `RequiresReauthentication` for 401, `TryGetErrorMessage`) and goes to the error component or the snackbar | REFIT-W, code |
| Controllers | A Cfe controller has `[ApiController]`, `[Authorize]`, `[Route("api/[controller]")]`, `[Produces("application/json")]`, `[ProducesResponseType]` on every action and a `CancellationToken` as the last parameter, and holds no business logic | CFE |
| Refit | Every method ends with `CancellationToken cancellationToken = default`; the route equals the Cfe controller's route; `[Body]`, `[Query]`, and `[Multipart]` for uploads; `apiVersion` only when the controller is versioned; the DTO is returned directly | REFIT-W |
| Messaging | The NServiceBus endpoint runs in the Cfe and in the Worker; Hangfire jobs are processed by the Worker, the Cfe serves the dashboard | CI-W, code |
| Messaging | The Cfe skips the NServiceBus endpoint and Hangfire under the `IntegrationTest` environment, so a `WebApplicationFactory` instance starts no bus | code |
| Logging | Browser records are forwarded off the device through the Cfe to the same ingest as the server logs, so a log call in Presentation is a telemetry contract: the shared architecture guideline's levels and its ban on personal data apply to it in full | LOG, code |
| Logging | Forwarding is switched on by the Wasm client when it adds the package (`AddCoreBlazorWasm`) and started after the host is built and before it runs (`StartClientLogForwardingAsync()`); the minimum forwarded level is the Cfe's `WasmLevel` setting, shipped as `Warning`, and the Cfe can switch forwarding off at run time, so neither needs a client rebuild | LOG, code |
| Logging | Library categories are not forwarded; a startup failure before the host is built cannot be and goes to the console only; the shipper is lossy by design and never replaces the audit trail. Never log inside a polling loop: log the state transition | LOG, code |
| Tests | `Test/Unit` holds the unit tests of view models, services and handlers; `Test/UI` the bUnit tests of a page on a mocked view model or service, the stub living in the presentation service and marked `STUB` until the wire slice removes it; `Test/Common` the shared test helpers. Which tests are written, what a page test asserts and how it compares markup, and when a call to the backend client or the browser download is verified: R-1 to R-7 of the shared testing guideline for agents (R-3, R-4), not repeated here | CL-W |
| Tests | The slice-level integration test lives in `Test/Integration` and calls a Cfe controller over HTTP through `CustomWebApplicationFactory` on SQLite in-memory, with a fake authentication scheme and real authorization, marked `[TestCategory("Integration")]`; a state-changing call sends the antiforgery header | CL-W, code |
## Anti-patterns

Each one breaks a statement above; the statement is what a finding quotes.

| Do not | Instead |
|---|---|
| Put a token, a connection string or a secret in the Wasm client, Presentation or its configuration | Keep it in the Cfe; the browser holds only the session cookie |
| Reference `Core.Application` or Persistence from Presentation | Call the Cfe API through the feature service and its Refit client |
| Create an `HttpClient` or a delegating handler of one's own | Register the client in `AddBffServiceClients()` with the package's cookie handler |
| Leave a state-changing action without `[ApiAntiforgery]` | Add the filter; the cookie handler sends the header |
| Return a domain entity from a Cfe controller | Map it to a Contracts DTO in the controller |
| Log a user's identifying data from the browser | Log the non-identifying correlate; the record leaves the device |

## Sources

The texts each statement was extracted from, read-only. Where the template and the reference solution disagree, the reference solution as built leads: it has a Worker, has no separate browser-side infrastructure project, and registers its Refit clients through the package.

| Key | Base text |
|---|---|
| `CI-W` | The Blazor WebAssembly 3-tier template's main instructions: hosts, dependency matrix, DI table, authentication, structure |
| `CFE` | The template's Cfe controller instructions |
| `REFIT-W` | The template's Refit client instructions (cookie handler, antiforgery header, error extensions) |
| `LOG` | The template's logging instructions (forwarding, levels, personal data) |
| `CL-W` | The Blazor WebAssembly reference solution's own project settings, § Test levels |
| `code` | The Blazor WebAssembly reference solution's project files, `Program.cs` files, Refit registration, error extensions and Cfe filters, read for their references and registrations |
