---
paths:
  - "src/**/*.cs"
  - "src/**/*.razor"
---
<!-- guideline: coding -->
# Coding guideline: C# rules for a builder, selected from the organisation's Sonar profile

Applies to every C# and Razor file of the solution. Read by the builder while writing code and before every commit, by the reviewer when it judges a diff, and by the Sonar review and the code-analysis agent. It is a prevention list: what to do so that `@sonar-review` finds nothing new. The quality profile on the Sonar server stays the authority on what fails the quality gate.

Every Sonar key below is an active rule of the organisation's C# quality profile (the profile the guideline was selected from: Sonar way plus 10 rules, all from the Sonar C# analyzer; see the kit's `tests/data/sonar-profile-csharp.md`). The StyleCop (`SA`, `SX`), .NET (`CA`, `IDE`) and MSTest findings on the server are not profile rules: the build raises them and the scanner imports them. Modern C# only: C# 12 and later, .NET 8 and later.

## Before every commit

Avoid layout and ordering issues by running the tools, not by memorising rules. Before every commit, and before a slice's checks are reported:

1. Run `dotnet format` on the solution, on the changed projects at least (whitespace, code style and the analyzers' code fixes).
2. Build the solution and read the warnings, not only the errors. The enabled StyleCop rules warn without failing the build, which is why they reach the server unfixed. A build with new `SA`, `SX`, `CA`, `IDE` or `MSTEST` warnings in the changed files is not finished.
3. Fix by hand only what the formatter left; that is mostly the rules of the table below marked "by hand".

Left to the formatter, named here once so a warning is recognised: layout and spacing (blank lines, braces, spacing, trailing whitespace, line endings, file end, UTF-8 with BOM: SA1000 to SA1028, SA1500 to SA1520, SA1412); using directives, `System` first (SA1208, SA1210, SA1211, SA1216, SA1217; placement not enforced, SA1200 off); element order (SA1201, SA1203, SA1204, SA1214: fields, constructors, properties, methods; static before instance; access order not enforced, SA1202 off); `string.Empty` instead of `""` (SA1122).

Not covered here, still active on the server: rules for technologies these solutions do not use (WCF, MEF, Windows Forms, Azure Functions, binary serialization, code access security, native and unsafe code).

A finding that needs a logic change is reported and fixed through the slice's own tests, not silenced. Never edit `Directory.Build.props`, `.editorconfig` or `stylecop.json` to make a warning go away.

## Rules

One row per rule or group: the keys, the intent, the fix the builder applies, and who can apply it (the formatter, the code-analysis agent, or by hand). A build-analyzer rule without a key here is named by its intent.

| Keys | Intent | Fix | By |
|---|---|---|---|
| — (SA1402) | One type per file, the file named after the type | Write a new file per type from the start | by hand |
| — (SX1309) | Private fields are `_camelCase`; `this.` is not used | Rename at creation; a later rename touches every use | by hand |
| — (SA1603 to SA1648) | XML documentation is optional, but when written it is complete | A non-empty `<summary>`; every parameter, type parameter and return value documented | by hand |
| `S4663` | No empty comment | Remove it or write the comment | code-analysis |
| `S2701` | No literal `true` or `false` as an assertion argument | `Assert.IsTrue(x)`, not `Assert.AreEqual(true, x)` | by hand |
| `S2699` | Every test asserts | Assert the outcome (see the testing guideline) | by hand |
| `S2970` | An assertion is complete | Finish the fluent or chained assertion | by hand |
| `S3415` | Expected first, actual second | Swap the arguments | by hand |
| `S2925` | No `Thread.Sleep` in a test | `TimeProvider` with a fake time, or await the condition | by hand |
| `S3431` | No `[ExpectedException]` | `Assert.ThrowsExactly` (`Assert.ThrowsException` before MSTest 3.8) | by hand |
| `S1607` | No ignored test | Fix the test or delete it; never `[Ignore]` to get green | by hand |
| `S3433`, `S2187` | Correct test signatures; a test class has tests | Public, non-static, `void` or `Task`, no parameters except data rows | by hand |
| — (MSTest analyzers) | The most specific `Assert` method; `Assert` instead of `CollectionAssert` and `StringAssert`; `TestContext.CancellationToken` passed to every async call that takes a token | `AreEqual`, `IsNull`, `Contains`, `HasCount` over `IsTrue(a == b)` | by hand |
| `S1125` | No redundant boolean literal | `if (flag)`, not `if (flag == true)` | code-analysis |
| `S1940` | No inverted boolean check | `a != b`, not `!(a == b)` | code-analysis |
| `S1066` | Merge a nested `if` without `else` | One condition with `&&` | code-analysis |
| `S3358` | No nested ternary | `if` or `switch` expression | by hand |
| `S1871`, `S3923` | Branches differ | Merge identical branches or remove the condition | by hand |
| `S1862`, `S1764` | No repeated condition or operand | Remove the duplicate; check for the intended one | by hand |
| `S2178` | Short-circuit operators in boolean logic | `&&` and `\|\|`, not `&` and `\|` | code-analysis |
| `S3440` | No check against the value about to be assigned | Assign directly | code-analysis |
| `S3168` | No `async void` except event handlers | Return `Task` | by hand |
| `S4457` | Validate parameters before the `async` body | Split into a guard method and an async local function | by hand |
| `S6966` | Await the async overload when one exists | `await ReadAllTextAsync(…)`, not `ReadAllText(…)` in an async method | by hand |
| `S5034` | A `ValueTask` is awaited once | Await it once, or `AsTask()` first | by hand |
| `S4586` | A non-async `Task` method never returns `null` | `Task.CompletedTask` or `Task.FromResult` | by hand |
| `S112` | Do not throw `Exception` or a reserved type | A specific exception, or `Result<T>.Failure` for a business error | by hand |
| `S2139` | Log or rethrow, not both | Log and rethrow only at the boundary that owns the error | by hand |
| `S2737` | A catch that only rethrows is removed | Delete the `try/catch` | code-analysis |
| `S3445` | Rethrow with `throw;` | `throw;`, never `throw ex;` | code-analysis |
| `S3928` | The parameter name of an `ArgumentException` exists | `nameof(parameter)` | code-analysis |
| `S1696` | Do not catch `NullReferenceException` | Check for `null` instead | by hand |
| `S2486` | Do not swallow a generic exception | Log it, rethrow it, or catch a specific type | by hand |
| `S3984` | A created exception is thrown | Add `throw` | by hand |
| `S3877` | No throw from `Equals`, `GetHashCode`, `ToString`, `Dispose` or a static constructor | Return a safe value | by hand |
| `S2930` | Dispose what you create | `using` declaration | by hand |
| `S2931`, `S2952` | A class owning disposables implements `IDisposable` and disposes them | Implement `Dispose` and dispose each field | by hand |
| `S3881` | The dispose pattern is correct | `Dispose(bool)` only when the class is unsealed or has a finalizer | by hand |
| `S2953` | A method named `Dispose` implements `IDisposable` | Implement the interface or rename | by hand |
| `S2997` | Do not return what a `using` disposes | Return the value, not the disposed object | by hand |
| `S6962` | HTTP clients through `IHttpClientFactory` | A typed or Refit client registered in the module | by hand |
| `S2551`, `S2445` | Lock on a private read-only object | `private readonly object _gate = new();` (or `Lock` on .NET 9) | by hand |
| `S1481` | No unused local | Remove it | code-analysis |
| `S1854` | No useless assignment | Remove the assignment | code-analysis |
| `S1172` | No unused parameter | Remove it, unless an interface or override needs it | by hand |
| `S1144`, `S4487` | No unused private member; no unread private field | Remove it | code-analysis |
| `S2326` | No unused type parameter | Remove it | by hand |
| `S1116` | No empty statement | Remove the stray `;` | code-analysis |
| `S108`, `S1186` | No empty block or method | Add a comment saying why it is empty, or remove it | by hand |
| `S125` | No commented-out code | Delete it; history is in git | code-analysis |
| `S1135`, `S1134` | No TODO or FIXME left in a slice | Do it now, or raise it in the build's record | by hand |
| `S3626` | No redundant jump | Remove the final `return;` or `continue;` | code-analysis |
| `S1905`, `S1858`, `S1110` | No redundant cast, `ToString()` on a string, or parentheses | Remove it | code-analysis |
| `S2201` | Use the return value of a side-effect-free call | Assign it, or remove the call | by hand |
| `S3776` | Cognitive complexity of a method at most 15 | Extract methods; early returns | by hand |
| `S107` | At most 7 parameters | Group them in a record | by hand |
| `S1192` | A string literal used three times becomes a constant | `private const string` | by hand |
| `S4144` | No two methods with the same body | Call one from the other | by hand |
| `S1479` | A large `switch` is replaced | A dictionary or polymorphism | by hand |
| `S110` | Inheritance not deeper than 5 | Composition | by hand |
| `S2436` | Few generic parameters | Fewer type parameters (accepted suppression on a designed consumer API) | by hand |
| `S2325` | A member that uses no instance data is `static` | Add `static` (accepted suppression on a `*Module`) | code-analysis |
| `S2933` | Assign-once fields are `readonly` | Add `readonly` | code-analysis |
| `S1118`, `S3453` | A utility class is `static`; no class with only private constructors that is not static | Make the class `static` | by hand |
| `S3442` | No public constructor on an abstract class | `protected` | code-analysis |
| `S1699` | A constructor calls no overridable member | Seal the member or the class | by hand |
| `S2223`, `S1104`, `S2386` | No public mutable or static field | A property, or `static readonly` with an immutable type | by hand |
| `S2696` | Instance members do not write static fields | Make the member `static` or the field instance | by hand |
| `S3260` | A private class nothing derives from is `sealed` | Add `sealed` | code-analysis |
| `S4035` | A class implementing `IEquatable<T>` is sealed | Add `sealed`, or use a `record` | by hand |
| `S3903` | Every type in a named namespace | File-scoped `namespace` | code-analysis |
| `S2292` | Trivial properties are auto-properties | `{ get; set; }` | code-analysis |
| `S1450` | A field used in one method becomes a local | Move it into the method | by hand |
| `S3400` | A method does not return a constant | A `const` or a property | by hand |
| `S1215` | No `GC.Collect()` | Remove it; dispose instead | by hand |
| `S1155` | `Any()` instead of `Count() == 0` | On a type with `Count`, `Length` or `IsEmpty`, use that property | code-analysis |
| `S2302` | `nameof` instead of a member name in a string | `nameof(member)` | code-analysis |
| `S3256` | `string.IsNullOrEmpty` | Replace the comparison | code-analysis |
| `S2971`, `S6617`, `S6607` | A simple LINQ chain: `Contains` for equality, `Where` before `OrderBy` | Simplify the chain | by hand |
| `S6608`, `S6609`, `S6613` | Indexing on an `IList`; the collection's own `Min`, `Max`, `First`, `Last` | Use the indexer or the member | code-analysis |
| `S6610`, `S4635` | `char` overloads of `StartsWith` and `EndsWith`; a start index instead of `Substring` | Use the overload | code-analysis |
| `S3267` | A filtering loop becomes LINQ | `foreach (var x in items.Where(…))` | by hand |
| `S1643` | No string concatenation in a loop | `StringBuilder` or `string.Join` | by hand |
| `S4581` | Never `new Guid()` | `Guid.NewGuid()` or `Guid.Empty` | code-analysis |
| `S3236`, `S3878` | No caller-information arguments; no explicit array for `params` | Remove the argument; pass the items | code-analysis |
| `S6562` | Always set `DateTimeKind` on a new `DateTime` | Prefer `DateTimeOffset` or `TimeProvider` | by hand |
| `S6580` | A format provider when parsing | `CultureInfo.InvariantCulture` | by hand |
| `S6561` | `Stopwatch`, not `DateTime.Now`, to time | `Stopwatch.StartNew()` or `TimeProvider.GetTimestamp()` | by hand |
| `S6588`, `S6575` | `DateTime.UnixEpoch`; `TimeZoneInfo.FindSystemTimeZoneById` directly | Use the member | code-analysis |
| `S2629` | A constant message template | No interpolation or concatenation in a log call | by hand |
| — (.NET logging analyzer) | No costly argument evaluated for a disabled level | `[LoggerMessage]` source generation or an `IsEnabled` guard | by hand |
| `S6678`, `S6673` | PascalCase placeholders, in argument order | `{DoctorId}`, not `{doctorId}` | code-analysis |
| `S6674`, `S6677` | A valid template with unique placeholders | Fix the braces; rename the duplicate | by hand |
| `S6667`, `S6668` | The caught exception as the exception argument; arguments to the right parameter | `LogError(ex, "…")` | by hand |
| `S6672`, `S6669` | `ILogger<T>` of the enclosing type, in a field named `_logger` | Fix the type argument or the name | code-analysis |
| `S6670` | No `Trace.Write` | `ILogger<T>` | by hand |
| `S6664` | Few log calls per block | Log state transitions, not each step (switched off in some projects; kept as advice) | by hand |
| `S2068`, `S6418` | No hard-coded credential or secret | Configuration or the environment; `S6418` silenced per test host for its `appsettings*.json` dummies | by hand |
| `S1075` | No hard-coded URI | Configuration | by hand |
| `S4830` | Verify server certificates | Remove the bypass, or justify (Accepted suppressions) | by hand |
| `S5122` | No permissive CORS | Named origins; a logged opt-in only with a justification | by hand |
| `S5332` | No clear-text protocol where a request is made | `https`; justify a local-only case | by hand |
| `S4507` | No debug feature outside development | Guard with `IsDevelopment()` | by hand |
| `S5693` | Bound the request body size | `[RequestSizeLimit]`, or justify | by hand |
| `S6444` | A timeout on every `Regex` | `RegexOptions` with a `TimeSpan`, or `[GeneratedRegex]` with a timeout | by hand |
| `S2245`, `S4790`, `S5344` | No `Random` for security; no weak hash; no plain-text password | `RandomNumberGenerator`; SHA-256 or better; the identity provider | by hand |
| `S3885` | `Assembly.Load` over `LoadFrom` | Change the call, or justify assembly scanning by path | by hand |
| `S6960` | A controller has one responsibility | Split it (accepted suppression on a CQRS controller) | by hand |
| `S6961`, `S6965` | An API controller derives from `ControllerBase`; every action has an HTTP verb attribute | Fix the base type; add the attribute | by hand |
| `S6968` | An action returning a value declares `ProducesResponseType` | Add the attribute per status code | by hand |
| `S6934`, `S6931` | Route on the controller, no leading `/` on an action route | Move the route; drop the slash | by hand |
| `S6964`, `S6967`, `S6932` | Nullable or required value-type inputs; `ModelState.IsValid` where binding can fail; model binding, not raw request data | Fix the input model | by hand |
| `S6798`, `S6800`, `S6797` | A `[JSInvokable]` method is public; component and query parameter types match the route | Fix the modifier or the type | by hand |

## Accepted suppressions

A rule that contradicts the architecture is suppressed, not obeyed, with the justification below in the attribute. Any other suppression needs the user's own justification in the attribute; the code-analysis agent refuses one outside this table.

| Key | Where | Justification to reuse |
|---|---|---|
| `S2325` | A `*Module` class | "need an instance as module" |
| `S6960` | A CQRS controller (one command or query per action) | "CQRS controller: one handler per action by design" |
| `S5693` | An upload whose size is validated in a `Validate` method | "size validated in Validate" |
| `S4457` | A handler whose guard must run inside the `async` body | "guard must run inside the async body" |
| `S2436` | A designed consumer API | "designed consumer API: the type parameters are the contract" |
| `S5122` | A CORS policy behind a logged opt-in | "permissive CORS only on the logged opt-in" |
| `S4830`, `S5332`, `S4507` | Code reached only under a stated condition | The condition under which the code is reached, named |
| `S3885` | Assembly scanning by path | "assembly scanning by path" |
| `S6667` | A benign, expected exception | "expected exception, logged without the exception object" |
| `S2139` | Where a `GlobalSuppressions` file already carries it | The justification of that file |
| `S1133` | A member kept for consumers | "kept for consumers until the next major version" (switched off in some projects) |
