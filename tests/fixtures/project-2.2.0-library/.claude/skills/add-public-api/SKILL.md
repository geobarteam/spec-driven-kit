---
name: add-public-api
description: "Add a new public type, interface, or method to the library with full test coverage and XML documentation: the conventions and the test-first order for a public type. Use when adding a new public contract, implementation, extension method, or options class to the library's API surface."
argument-hint: "What to add, e.g. 'ITokenValidator interface with ValidateAsync method'"
---

# Add Public API — How-to

How a new public type, interface, or method is added to the library: the conventions, the test-first order, the DI registration and the proof.

**The project's workflow decides whether a spec is needed.** This how-to does not replace it: the Spec Gate of `.claude/rules/spec-driven.md` says whether the addition needs a spec first, and the public API is a risk area where `CLAUDE.md` § Project settings lists it. Use this how-to inside a slice of an approved spec, or for a contained change that the project's workflow allows without a spec. It plans nothing of its own and keeps no checklist: the spec, the slice recap or the conversation does.

## Values from Project settings

Read `CLAUDE.md` § Project settings, Pack values: **Solution name**, **Namespace root** and **Unit-test command**. When one of these lines is missing under `### Pack values`, say which line is missing and stop. The how-to uses them as:

| Value | Used for |
|---|---|
| **Solution name** | The solution file: `<Solution name>.sln`, searched in the repository |
| **Namespace root** | The library's root namespace and project folder: `src/<Namespace root>/`; the test projects `<Namespace root>.Unit.Tests` under `src/Test/Unit/` |
| **Unit-test command** | Runs all unit tests, and with its filter one test |

## Prerequisites

- Know **what** to add: the public type name, its purpose, and its expected API surface.
- Identify a **reference feature** in the codebase — the existing feature whose patterns you will follow: the **Reference feature** line of `CLAUDE.md` § Project settings, or ask the user which existing feature to use. Study it first.

## The order per piece

Test first, one piece at a time: a failing test, the minimal code that passes it, then clean-up. Never batch the pieces, never skip the failing test, never skip the code analysis.

```
1. READ — understand what to add and which reference feature to follow
2. RED — write a failing test FIRST
3. RUN — the Unit-test command with its filter on "<TestMethod>" → confirm FAIL
4. GREEN — write minimal production code to pass
5. RUN — the Unit-test command with its filter on "<TestMethod>" → confirm PASS
6. REFACTOR — clean up, ensure XML docs are complete on all public members
7. CODE ANALYSIS — fix all violations (the @fix-violations skill, or @code-analysis for a full sweep):
   a. dotnet build <the solution file> 2>&1 | Select-String -Pattern ": (warning|error) (SA|SX|CA|CS|MSTEST)\d+" | Sort-Object | Get-Unique
   b. dotnet format <the solution file>
   c. Fix remaining violations manually
   d. Repeat a–c until clean
8. PROVE:
   - dotnet build <the solution file> → zero warnings/errors
   - the Unit-test command → all pass
   - dotnet format <the solution file> --verify-no-changes → exit 0
   Then the project's own Verification Commands, when it has them.
```

---

## Steps

### Step 1 — Define the Contract

Create the public interface or abstract class with full XML documentation.

**Location**: `src/<Namespace root>/Abstractions/` or `src/<Namespace root>/<Feature>/`

```csharp
namespace <Namespace root>.<Feature>;

/// <summary>
/// Describe the contract's purpose.
/// </summary>
public interface I<Name>
{
    /// <summary>
    /// Describe the method.
    /// </summary>
    /// <param name="input">Describe the parameter.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Describe the return value.</returns>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="input"/> is null.</exception>
    Task<Result> ProcessAsync(string input, CancellationToken ct);
}
```

**Rules**:
- `public` only for the intended API surface — everything else `internal`.
- Every public member gets `<summary>`, `<param>`, `<returns>`, `<exception>`.
- `CancellationToken` as the last parameter on every async method.
- Seal classes by default unless designed for inheritance.

**Test**: Verify the contract shape — compilation, nullability, interface members exist.

---

### Step 2 — RED: Write Failing Test

Write a unit test that exercises the new API through its interface.

**Location**: `src/Test/Unit/<Feature>/`

```csharp
namespace <Namespace root>.Test.Unit.<Feature>;

[TestClass]
public sealed class <Name>Tests
{
    [TestMethod]
    public async Task ProcessAsync_ValidInput_ReturnsSuccess()
    {
        // Arrange
        var sut = new <Implementation>(/* dependencies */);

        // Act
        var result = await sut.ProcessAsync("valid-input", CancellationToken.None);

        // Assert
        Assert.IsTrue(result.IsSuccess);
    }
}
```

**Rules**:
- Test method naming: `<Method>_<Scenario>_<Expected>`.
- AAA structure (Arrange/Act/Assert).
- Mock at boundary (interfaces only, Moq). No real external services.
- Run the test → confirm it **fails** (RED).

---

### Step 3 — GREEN: Implement

Write the minimal implementation to make the test pass.

**Location**: `src/<Namespace root>/<Feature>/`

```csharp
namespace <Namespace root>.<Feature>;

/// <summary>
/// Describe the implementation.
/// </summary>
internal sealed class <Name>(/* dependencies */) : I<Name>
{
    /// <inheritdoc />
    public async Task<Result> ProcessAsync(string input, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(input);
        ArgumentException.ThrowIfNullOrWhiteSpace(input);

        // Implementation
        return Result.Success();
    }
}
```

**Rules**:
- `internal sealed` by default — consumers use the interface.
- Guard clauses on all public method parameters.
- Run the test → confirm it **passes** (GREEN).

---

### Step 4 — REFACTOR

- Ensure XML docs are complete on all public members.
- Ensure naming follows the project's conventions (check the reference feature).
- No unnecessary dependencies.

---

### Step 5 — DI Registration

Add the new type to `ServiceCollectionExtensions` if consumers need to resolve it via DI.

**Location**: `src/<Namespace root>/Extensions/ServiceCollectionExtensions.cs`

```csharp
/// <summary>
/// Adds <see cref="I<Name>"/> to the service collection.
/// </summary>
public static IServiceCollection Add<Feature>(
    this IServiceCollection services,
    Action<<Feature>Options>? configure = null)
{
    if (configure is not null)
        services.Configure(configure);

    services.AddSingleton<I<Name>, <Name>>();
    return services;
}
```

**Test**: Integration test verifying DI resolution:

```csharp
[TestMethod]
public void Add<Feature>_RegistersServices()
{
    // Arrange
    var services = new ServiceCollection();

    // Act
    services.Add<Feature>();
    var provider = services.BuildServiceProvider();

    // Assert
    Assert.IsNotNull(provider.GetRequiredService<I<Name>>());
}
```

---

### Step 6 — Options Class (if applicable)

If the feature needs configuration, create an options class:

**Location**: `src/<Namespace root>/<Feature>/<Feature>Options.cs`

```csharp
namespace <Namespace root>.<Feature>;

/// <summary>
/// Configuration options for <see cref="I<Name>"/>.
/// </summary>
public sealed class <Feature>Options
{
    /// <summary>
    /// Gets or sets the description of the option.
    /// </summary>
    public string Setting { get; set; } = "default";
}
```

---

### Step 7 — CODE ANALYSIS + PROOF

1. Fix all SA/CA/CS violations.
2. Run the full proof trilogy: build → test → format, then the project's Verification Commands.
3. Present the results. What happens next (a verifier, a recap, a commit) is the project's workflow, not this how-to.
