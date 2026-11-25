---
paths:
  - "src/Host/Web/**"
  - "src/Host/BFF/**"
  - "src/Host/Api/**"
  - "src/Host/Worker/**"
  - "src/Presentation/**"
  - "src/Core/Infrastructure/**"
---
<!-- guideline: architecture -->
# Architecture of a Blazor Server solution

Applies when code is placed, moved or judged in a Blazor Server solution on the organisation's 3-tier layout (WFE, BFF, Worker). This guideline states only what Blazor Server adds or changes to the shared architecture rules: the shared architecture guideline holds the layers, the dependency rules, naming, dependency injection, data access, error handling, messaging, logging and configuration every solution shares, and it applies unchanged; nothing of it is repeated here. It loads when a file under `src/Host/Web/`, `src/Host/BFF/`, `src/Host/Api/`, `src/Host/Worker/`, `src/Presentation/` or `src/Core/Infrastructure/` is opened, and the spec-driven workflow's skills and agents read it by its first line: the builder before it states where each new piece goes, the reviewer when it looks for a forbidden dependency or a broken authentication rule.

How to use it:

- **Before writing code**, name the host and the layer each new piece belongs to in the terms of the What runs where and Layers statements, and check every new project reference against the Dependencies tables here and in the shared guideline. A piece that needs a forbidden dependency stops the slice: amend the spec or ask; do not build around the rule.
- **When judging a diff**, report a new forbidden dependency, a token handled in Presentation, or a user taken from anywhere but the user headers in the BFF, as a finding with the statement it breaks. The known deviation recorded under Dependencies allowed is not reported again; a new reference of the same kind is.
- Every statement carries its source key; the keys are listed under Sources.
- Names such as `AddCoreOpenIdConnect` or `AddCoreHttpServiceClient` stand for the extension methods of the solution's core configuration package; read them as the names the project's own package uses.

## Statements

| Area | Statement | Source |
|---|---|---|
| What runs where | Three deployable hosts and one optional: the WFE (`Host/Web`, Blazor Server, the only host the browser talks to), the BFF (`Host/BFF`, Web API, NServiceBus endpoint, Hangfire dashboard, EF Core), the Worker (`Host/Worker`, NServiceBus handlers and Hangfire recurring jobs, no dashboard), and an optional secondary API (`Host/Api`) the BFF calls through a typed client | CI-S, CL-S, code |
| What runs where | The browser holds a SignalR circuit to the WFE; UI state lives in server memory, per circuit. The WFE never opens a database connection and never hosts NServiceBus | CI-S, code |
| Layers | `Core/Infrastructure` holds the messaging service and the clients of external services; it exists in Blazor Server solutions only | CI-S, code |
| Dependencies allowed | Infrastructure references Application and Domain. Presentation references Contracts, and Application for its interfaces only. `Host.Bff` references Core, Contracts and Presentation. `Host.Wfe` references `Presentation` and `Contracts`. `Host.Worker` references Persistence and Infrastructure. `Test.Unit` references Core and Contracts; `Test.Bff` references `Host.Bff`; `Test.UI` references Presentation | CI-S |
| Dependencies allowed | This matrix is the rule. The reference solution's WFE also references `Core.Infrastructure`: a known deviation, left as it is. A reviewer reports a new reference of that kind (a new WFE reference outside the matrix), never the existing one | CI-S, code |
| Dependencies forbidden | Presentation never references Persistence or a host | CI-S |
| Dependencies forbidden | A view model never holds a typed HTTP (Refit) client; it holds the feature service, which holds the client | CI-S, PRES |
| Project structure | Presentation per feature: `Pages/`, `ViewModels/`, `Models/`, `Dialogs/`, `Services/` (the reference solution names the last one `ServiceClients/`) | PRES, CL-S |
| Project structure | Refit interfaces in `Presentation/Shared/ServiceClients/Bff/Clients/`; BFF controllers in `Host/BFF/Controllers/`, in versioned folders `V1`, `V2` when the API is versioned | CL-S, BFF, code |
| Project structure | NServiceBus handlers in `Host/BFF/NServiceBusHandlers/` and `Host/Worker/Handlers/`; recurring jobs in `Host/Worker/BackgroundRecurringTask/` | CL-S, code |
| Dependency injection | A `Service` and a `Handler` of Infrastructure are scoped (InfrastructureModule); a `ViewModel` and a `ServiceClient` are transient (PresentationModule), registered by the WFE's `Program.cs` through the module | CI-S, code |
| State | A view model is transient, owns `IsBusy` and its data, and is initialised by its page in `OnInitializedAsync` through `InitializeAsync(IErrorComponent)` | PRES, CI-S |
| State | The `IsBusy` guard refuses re-entry: it is set before the `await` and cleared in `finally`; an exception goes to `errorComponent.ProcessError(ex)` | PRES |
| State | A MudBlazor dialog is opened through `IDialogService`, and the list reloads when the dialog is not cancelled; UI strings come from `IStringLocalizer<Translations>` | PRES, CI-S |
| Data access | The BFF, the Worker and the secondary API open the database; the WFE does not | code |
| Authentication | The WFE signs the user in with OIDC through `AddCoreOpenIdConnect` and knows the user (claims through `AuthenticationStateProvider` or `HttpContext.User`) | CI-S, code |
| Authentication | The BFF and the secondary API validate a JWT through `AddCoreOAuth`; the token's identity is the WFE application (client credentials), not the user | CI-S, CL-S, code |
| Authentication | The WFE calls the BFF as a trusted subsystem through `AddCoreHttpServiceClient`, which obtains and attaches the token, with Refit on top. Presentation never reads, stores or forwards a token: no token in a view model, a feature service, a page or a delegating handler of its own | CI-S, CL-S, code |
| Authentication | The end user travels in `X-User-*` headers set by the user-context delegating handler of the WFE; headers of that name coming from the browser are stripped by the WFE | CI-S, CL-S, code |
| Authentication | The BFF reads the user through `IUserContextAccessor`, only after the JWT is validated, and never takes the user from `HttpContext.User` | CI-S, CL-S, code |
| Authentication | `EnableAuthentication: false` stands only in `appsettings.UnitTest.json`; the Hangfire dashboard is served by the BFF and forwarded by the WFE as a trusted-subsystem proxy | CI-S, code |
| Error handling | A typed HTTP call in a feature service catches `ApiException` and converts it with `ConvertApiExceptionToResult<T>()`, so the view model receives a `Result<T>` | CI-S, CL-S, code |
| Error handling | Every Refit method takes the `apiVersion` parameter and a `CancellationToken` | CI-S, CL-S |
| Controllers | A BFF controller has `[ApiController]` and `[Route("api/[controller]")]`, `[ProducesResponseType]` on every action and a `CancellationToken` as the last parameter of every action | BFF |
| Controllers | An action that publishes carries `[RequiresTransactionalSession]`; reads are audited with `IAuditLogger.LogMessageAsync`, writes with `LogActionAsync` | BFF |
| Messaging | NServiceBus runs in the BFF (publisher and handlers) and in the Worker (subscriber) | CI-S, code |
| Messaging | Hangfire storage is shared SQL: the Worker processes the jobs, the BFF shows the dashboard | CI-S, code |
| Tests | `Test/Unit` holds the unit tests of handlers, queries, view models and services; `Test/UI` the bUnit tests of a page on a mocked view model or a stubbed feature service; `Test/Common` the shared test helpers | CL-S, code |
| Tests | The slice-level integration test calls a BFF controller over HTTP through `CustomWebApplicationFactory` on SQLite in-memory, and is written as an MSTest class with `[TestCategory("Integration")]`. The Reqnroll feature files of the reference solution's `Test/Bff` are the older practice and are not the model for a new test | CL-S, code |

## Anti-patterns

Each one breaks a statement above; the statement is what a finding quotes.

| Do not | Instead |
|---|---|
| Open a database connection or host NServiceBus in the WFE | Call the BFF through its typed client; publish from the BFF |
| Inject a Refit client into a view model | Inject the feature service; it holds the client and converts `ApiException` |
| Read, store or attach a token in Presentation | Let `AddCoreHttpServiceClient` obtain and attach it |
| Take the user from `HttpContext.User` in the BFF | Read it through `IUserContextAccessor` from the user headers |
| Add a WFE project reference outside the matrix | Move the dependency behind a BFF endpoint or an interface in Application |
| Write a new integration test as a Reqnroll scenario | An MSTest class with `[TestCategory("Integration")]` |

## Sources

The texts each statement was extracted from, read-only. Where the sources disagree, the spec of this guideline records the decision: the dependency matrix is the rule and the WFE's reference to `Core.Infrastructure` a known deviation; the Refit pattern comes from the reference solution, because the template's own Refit instruction describes the other hosting model; integration tests are MSTest.

| Key | Base text |
|---|---|
| `CI-S` | The Blazor Server 3-tier template's main instructions: hosts, dependency matrix, DI table, authentication, Refit, view model lifecycle, Hangfire |
| `BFF` | The template's BFF controller instructions |
| `PRES` | The template's presentation instructions (view model lifecycle, dialogs, localisation) |
| `CL-S` | The Blazor Server reference solution's own project instructions: its feature layout, the user-context handler, the BFF client configuration and its test projects |
| `code` | The Blazor Server reference solution's project files, `Program.cs` files and BFF client configuration, read for their references and registrations |
