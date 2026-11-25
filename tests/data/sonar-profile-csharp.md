# SonarQube C# quality profile — active rules

Source for the coding guideline of the `dotnet-shared` pack, and test data of the kit's guideline tests. Read from a SonarQube server with its Web API, read-only, on 2026-11-19.

| Item | Value |
|---|---|
| Profile | An organisation's default C# profile; inherits from the built-in **Sonar way** |
| Used by | The reference solutions the guidelines were drawn from |
| Read on | 2026-11-19 |
| Profile rules last updated on the server | 2026-02-24 |
| Active rules | **331** = the 321 of Sonar way, none removed, no severity changed, plus 10 added: S1109, S1226, S1858, S2302, S2327, S2931, S2952, S4000, S4005, S4457 |
| By type | Code smell 216, Bug 79, Security hotspot 22, Vulnerability 14 |
| By severity | Blocker 31, Critical 64, Major 142, Minor 92, Info 2 |

## Active rules by analyzer

| Analyzer | Repository | Active rules in the profile |
|---|---|---|
| Sonar C# rules | `csharpsquid` | 331 |
| StyleCop SA rules | — | 0 |
| .NET CA rules | — | 0 |
| MSTest rules | — | 0 |
| Others | — | 0 |

The profile holds Sonar C# rules only. The StyleCop (SA), .NET (CA, IDE) and MSTest rules that also appear on the server's issue pages are **not** profile rules: they are raised by the analyzers each project references in its build (packages, `.editorconfig`, `Directory.Build.props`) and imported by the scanner as external issues. Their severity is set in the project, not on the server. The guideline treats them in the spec, section "Coding guidelines".

Severity is the rule's severity as the server reports it in the profile search (the legacy Blocker…Info scale).

## Sonar C# rules (`csharpsquid`) — 331

| Key | Name | Type | Severity |
|---|---|---|---|
| S1006 | Method overrides should not change parameter defaults | Code smell | Critical |
| S101 | Types should be named in PascalCase | Code smell | Minor |
| S1048 | Finalizers should not throw exceptions | Bug | Blocker |
| S1066 | Mergeable "if" statements should be combined | Code smell | Major |
| S107 | Methods should not have too many parameters | Code smell | Major |
| S1075 | URIs should not be hardcoded | Code smell | Minor |
| S108 | Nested blocks of code should not be left empty | Code smell | Major |
| S110 | Inheritance tree of classes should not be too deep | Code smell | Major |
| S1104 | Fields should not have public accessibility | Code smell | Minor |
| S1109 | A close curly brace should be located at the beginning of a line | Code smell | Minor |
| S1110 | Redundant pairs of parentheses should be removed | Code smell | Major |
| S1116 | Empty statements should be removed | Code smell | Minor |
| S1117 | Local variables should not shadow class fields or properties | Code smell | Major |
| S1118 | Utility classes should not have public constructors | Code smell | Major |
| S112 | General or reserved exceptions should never be thrown | Code smell | Major |
| S1121 | Assignments should not be made from within sub-expressions | Code smell | Major |
| S1123 | "Obsolete" attributes should include explanations | Code smell | Major |
| S1125 | Boolean literals should not be redundant | Code smell | Minor |
| S1133 | Deprecated code should be removed | Code smell | Info |
| S1134 | Track uses of "FIXME" tags | Code smell | Major |
| S1135 | Track uses of "TODO" tags | Code smell | Info |
| S1144 | Unused private types or members should be removed | Code smell | Major |
| S1155 | "Any()" should be used to test for emptiness | Code smell | Minor |
| S1163 | Exceptions should not be thrown in finally blocks | Code smell | Critical |
| S1168 | Empty arrays and collections should be returned instead of null | Code smell | Major |
| S1172 | Unused method parameters should be removed | Code smell | Major |
| S1185 | Overriding members should do more than simply call the same member in the base class | Code smell | Minor |
| S1186 | Methods should not be empty | Code smell | Critical |
| S1192 | String literals should not be duplicated | Code smell | Minor |
| S1199 | Nested code blocks should not be used | Code smell | Minor |
| S1206 | "Equals(Object)" and "GetHashCode()" should be overridden in pairs | Bug | Minor |
| S1210 | "Equals" and the comparison operators should be overridden when implementing "IComparable" | Code smell | Minor |
| S1215 | "GC.Collect" should not be called | Code smell | Critical |
| S1226 | Method parameters, caught exceptions and foreach variables' initial values should not be ignored | Bug | Minor |
| S1244 | Floating point numbers should not be tested for equality | Bug | Major |
| S125 | Sections of code should not be commented out | Code smell | Major |
| S1264 | A "while" loop should be used instead of a "for" loop | Code smell | Minor |
| S127 | "for" loop stop conditions should be invariant | Code smell | Major |
| S1313 | Using hardcoded IP addresses is security-sensitive | Security hotspot | Major |
| S1450 | Private fields only used as local variables in methods should become local variables | Code smell | Minor |
| S1479 | "switch" statements with many "case" clauses should have only one statement | Code smell | Major |
| S1481 | Unused local variables should be removed | Code smell | Minor |
| S1607 | Tests should not be ignored | Code smell | Major |
| S1643 | Strings should not be concatenated using '+' in a loop | Code smell | Minor |
| S1656 | Variables should not be self-assigned | Bug | Major |
| S1694 | An abstract class should have both abstract and concrete methods | Code smell | Minor |
| S1696 | NullReferenceException should not be caught | Code smell | Major |
| S1699 | Constructors should only call non-overridable methods | Code smell | Critical |
| S1751 | Loops with at most one iteration should be refactored | Bug | Major |
| S1764 | Identical expressions should not be used on both sides of operators | Bug | Major |
| S1848 | Objects should not be created to be dropped immediately without being used | Bug | Major |
| S1854 | Unused assignments should be removed | Code smell | Major |
| S1858 | "ToString()" calls should not be redundant | Code smell | Minor |
| S1862 | Related "if/else if" statements should not have the same condition | Bug | Major |
| S1871 | Two branches in a conditional structure should not have exactly the same implementation | Code smell | Major |
| S1905 | Redundant casts should not be used | Code smell | Minor |
| S1939 | Inheritance list should not be redundant | Code smell | Minor |
| S1940 | Boolean checks should not be inverted | Code smell | Minor |
| S1944 | Invalid casts should be avoided | Code smell | Critical |
| S1994 | "for" loop increment clauses should modify the loops' counters | Code smell | Critical |
| S2068 | Hard-coded credentials are security-sensitive | Security hotspot | Blocker |
| S2077 | Formatting SQL queries is security-sensitive | Security hotspot | Major |
| S2092 | Creating cookies without the "secure" flag is security-sensitive | Security hotspot | Minor |
| S2094 | Classes should not be empty | Code smell | Minor |
| S2114 | Collections should not be passed as arguments to their own methods | Bug | Major |
| S2115 | A secure password should be used when connecting to a database | Vulnerability | Blocker |
| S2123 | Values should not be uselessly incremented | Bug | Major |
| S2139 | Exceptions should be either logged or rethrown but not both | Code smell | Major |
| S2166 | Classes named like "Exception" should extend "Exception" or a subclass | Code smell | Major |
| S2178 | Short-circuit logic should be used in boolean contexts | Code smell | Blocker |
| S2183 | Integral numbers should not be shifted by zero or more than their number of bits-1 | Bug | Minor |
| S2184 | Results of integer division should not be assigned to floating point variables | Bug | Minor |
| S2187 | Test classes should contain at least one test case | Code smell | Blocker |
| S2190 | Loops and recursions should not be infinite | Bug | Blocker |
| S2198 | Unnecessary mathematical comparisons should not be made | Code smell | Critical |
| S2201 | Methods without side effects should not have their return values ignored | Bug | Major |
| S2219 | Runtime type checking should be simplified | Code smell | Minor |
| S2223 | Non-constant static fields should not be visible | Code smell | Critical |
| S2225 | "ToString()" method should not return null | Bug | Major |
| S2234 | Arguments should be passed in the same order as the method parameters | Code smell | Major |
| S2245 | Using pseudorandom number generators (PRNGs) is security-sensitive | Security hotspot | Critical |
| S2251 | A "for" loop update clause should move the counter in the right direction | Bug | Major |
| S2252 | For-loop conditions should be true at least once | Bug | Major |
| S2257 | Using non-standard cryptographic algorithms is security-sensitive | Security hotspot | Critical |
| S2275 | Composite format strings should not lead to unexpected behavior at runtime | Bug | Blocker |
| S2290 | Field-like events should not be virtual | Code smell | Critical |
| S2291 | Overflow checking should not be disabled for "Enumerable.Sum" | Code smell | Critical |
| S2292 | Trivial properties should be auto-implemented | Code smell | Minor |
| S2302 | "nameof" should be used | Code smell | Critical |
| S2306 | "async" and "await" should not be used as identifiers | Code smell | Blocker |
| S2325 | Methods and properties that don't access instance data should be static | Code smell | Minor |
| S2326 | Unused type parameters should be removed | Code smell | Major |
| S2327 | "try" statements with identical "catch" and/or "finally" blocks should be merged | Code smell | Major |
| S2328 | "GetHashCode" should not reference mutable fields | Bug | Minor |
| S2342 | Enumeration types should comply with a naming convention | Code smell | Minor |
| S2344 | Enumeration type names should not have "Flags" or "Enum" suffixes | Code smell | Minor |
| S2345 | Flags enumerations should explicitly initialize all their members | Bug | Minor |
| S2346 | Flags enumerations zero-value members should be named "None" | Code smell | Critical |
| S2365 | Properties should not make collection or array copies | Code smell | Critical |
| S2368 | Public methods should not have multidimensional array parameters | Code smell | Blocker |
| S2372 | Exceptions should not be thrown from property getters | Code smell | Major |
| S2376 | Write-only properties should not be used | Code smell | Major |
| S2386 | Mutable fields should not be "public static" | Code smell | Minor |
| S2436 | Types and methods should not have too many generic parameters | Code smell | Major |
| S2437 | Unnecessary bit operations should not be performed | Code smell | Blocker |
| S2445 | Blocks should be synchronized on read-only fields | Bug | Major |
| S2479 | Whitespace and control characters in string literals should be explicit | Code smell | Critical |
| S2486 | Generic exceptions should not be ignored | Code smell | Minor |
| S2551 | Shared resources should not be used for locking | Bug | Critical |
| S2612 | Setting loose file permissions is security-sensitive | Security hotspot | Major |
| S2629 | Logging templates should be constant | Code smell | Major |
| S2674 | The length returned from a stream read should be checked | Bug | Minor |
| S2681 | Multiline blocks should be enclosed in curly braces | Code smell | Major |
| S2688 | "NaN" should not be used in comparisons | Bug | Major |
| S2692 | "IndexOf" checks should not be for positive numbers | Code smell | Critical |
| S2696 | Instance members should not write to "static" fields | Code smell | Critical |
| S2699 | Tests should include assertions | Code smell | Blocker |
| S2701 | Literal boolean values should not be used in assertions | Code smell | Critical |
| S2737 | "catch" clauses should do more than rethrow | Code smell | Minor |
| S2743 | Static fields should not be used in generic types | Code smell | Major |
| S2755 | XML parsers should not be vulnerable to XXE attacks | Vulnerability | Blocker |
| S2757 | Non-existent operators like "=+" should not be used | Bug | Major |
| S2761 | Doubled prefix operators "!!" and "~~" should not be used | Bug | Major |
| S2857 | SQL keywords should be delimited by whitespace | Bug | Blocker |
| S2925 | "Thread.Sleep" should not be used in tests | Code smell | Major |
| S2930 | "IDisposables" should be disposed | Bug | Blocker |
| S2931 | Classes with "IDisposable" members should implement "IDisposable" | Bug | Blocker |
| S2933 | Fields that are only assigned in the constructor should be "readonly" | Code smell | Major |
| S2934 | Property assignments should not be made for "readonly" fields not constrained to reference types | Bug | Minor |
| S2952 | Classes should "Dispose" of members from the classes' own "Dispose" methods | Bug | Critical |
| S2953 | Methods named "Dispose" should implement "IDisposable.Dispose" | Code smell | Blocker |
| S2955 | Generic parameters not constrained to reference types should not be compared to "null" | Bug | Minor |
| S2970 | Assertions should be complete | Code smell | Blocker |
| S2971 | LINQ expressions should be simplified | Code smell | Major |
| S2995 | "Object.ReferenceEquals" should not be used for value types | Bug | Major |
| S2996 | "ThreadStatic" fields should not be initialized | Bug | Major |
| S2997 | "IDisposables" created in a "using" statement should not be returned | Bug | Major |
| S3005 | "ThreadStatic" should not be used on non-static fields | Bug | Major |
| S3010 | Static fields should not be updated in constructors | Code smell | Major |
| S3011 | Reflection should not be used to increase accessibility of classes, methods, or fields | Code smell | Major |
| S3060 | "is" should not be used with "this" | Code smell | Blocker |
| S3063 | "StringBuilder" data should be used | Code smell | Major |
| S3168 | "async" methods should not return "void" | Bug | Major |
| S3169 | Multiple "OrderBy" calls should not be used | Code smell | Major |
| S3172 | Delegates should not be subtracted | Bug | Major |
| S3217 | "Explicit" conversions of "foreach" loops should not be used | Code smell | Critical |
| S3218 | Inner class members should not shadow outer class "static" or type members | Code smell | Critical |
| S3220 | Method calls should not resolve ambiguously to overloads with "params" | Code smell | Minor |
| S3236 | Caller information arguments should not be provided explicitly | Code smell | Minor |
| S3237 | "value" contextual keyword should be used | Code smell | Blocker |
| S3241 | Methods should not return values that are never used | Code smell | Minor |
| S3244 | Anonymous delegates should not be used to unsubscribe from Events | Bug | Major |
| S3246 | Generic type parameters should be co/contravariant when possible | Code smell | Major |
| S3247 | Duplicate casts should not be made | Code smell | Minor |
| S3249 | Classes directly extending "object" should not call "base" in "GetHashCode" or "Equals" | Bug | Major |
| S3251 | Implementations should be provided for "partial" methods | Code smell | Minor |
| S3256 | "string.IsNullOrEmpty" should be used | Code smell | Minor |
| S3260 | Non-derived "private" classes and records should be "sealed" | Code smell | Minor |
| S3261 | Namespaces should not be empty | Code smell | Minor |
| S3262 | "params" should be used on overrides | Code smell | Major |
| S3263 | Static fields should appear in the order they must be initialized | Bug | Major |
| S3264 | Events should be invoked | Code smell | Major |
| S3265 | Non-flags enums should not be used in bitwise operations | Code smell | Critical |
| S3267 | Loops should be simplified with "LINQ" expressions | Code smell | Minor |
| S3330 | Creating cookies without the "HttpOnly" flag is security-sensitive | Security hotspot | Minor |
| S3343 | Caller information parameters should come at the end of the parameter list | Bug | Major |
| S3346 | Expressions used in "Debug.Assert" should not produce side effects | Bug | Major |
| S3358 | Ternary operators should not be nested | Code smell | Major |
| S3363 | Date and time should not be used as a type for primary keys | Bug | Minor |
| S3376 | Attribute, EventArgs, and Exception type names should end with the type being extended | Code smell | Minor |
| S3397 | "base.Equals" should not be used to check for reference equality in "Equals" if "base" is not "object" | Bug | Minor |
| S3398 | "private" methods called only by inner classes should be moved to those classes | Code smell | Minor |
| S3400 | Methods should not return constants | Code smell | Minor |
| S3415 | Assertion arguments should be passed in the correct order | Code smell | Major |
| S3427 | Method overloads with default parameter values should not overlap | Code smell | Blocker |
| S3431 | "[ExpectedException]" should not be used | Code smell | Major |
| S3433 | Test method signatures should be correct | Code smell | Blocker |
| S3440 | Variables should not be checked against the values they're about to be assigned | Code smell | Minor |
| S3442 | "abstract" classes should not have "public" constructors | Code smell | Major |
| S3443 | Type should not be examined on "System.Type" instances | Code smell | Blocker |
| S3444 | Interfaces should not simply inherit from base interfaces with colliding members | Code smell | Minor |
| S3445 | Exceptions should not be explicitly rethrown | Code smell | Major |
| S3447 | "[Optional]" should not be used on "ref" or "out" parameters | Code smell | Critical |
| S3449 | Right operands of shift operators should be integers | Bug | Critical |
| S3450 | Parameters with "[DefaultParameterValue]" attributes should also be marked "[Optional]" | Code smell | Minor |
| S3451 | "[DefaultValue]" should not be used when "[DefaultParameterValue]" is meant | Code smell | Critical |
| S3453 | Classes should not have only "private" constructors | Bug | Major |
| S3456 | "string.ToCharArray()" and "`ReadOnlySpan<T>`.ToArray()" should not be called redundantly | Bug | Minor |
| S3457 | Composite format strings should be used correctly | Code smell | Major |
| S3458 | Empty "case" clauses that fall through to the "default" should be omitted | Code smell | Minor |
| S3459 | Unassigned members should be removed | Code smell | Minor |
| S3464 | Type inheritance should not be recursive | Bug | Blocker |
| S3466 | Optional parameters should be passed to "base" calls | Bug | Major |
| S3597 | "ServiceContract" and "OperationContract" attributes should be used together | Code smell | Major |
| S3598 | One-way "OperationContract" methods should have "void" return type | Bug | Major |
| S3600 | "params" should not be introduced on overrides | Code smell | Critical |
| S3603 | Methods with "Pure" attribute should return a value | Bug | Major |
| S3604 | Member initializer values should not be redundant | Code smell | Minor |
| S3610 | Nullable type comparison should not be redundant | Bug | Major |
| S3626 | Jump statements should not be redundant | Code smell | Minor |
| S3776 | Cognitive Complexity of methods should not be too high | Code smell | Critical |
| S3869 | "SafeHandle.DangerousGetHandle" should not be called | Bug | Blocker |
| S3871 | Exception types should be "public" | Code smell | Critical |
| S3875 | "operator==" should not be overloaded on reference types | Code smell | Blocker |
| S3877 | Exceptions should not be thrown from unexpected methods | Code smell | Blocker |
| S3878 | Arrays should not be created for params parameters | Code smell | Minor |
| S3881 | "IDisposable" should be implemented correctly | Code smell | Major |
| S3885 | "Assembly.Load" should be used | Code smell | Major |
| S3887 | Mutable, non-private fields should not be "readonly" | Bug | Minor |
| S3889 | "Thread.Resume" and "Thread.Suspend" should not be used | Bug | Blocker |
| S3897 | Classes that provide "`Equals(<T>)`" should implement "`IEquatable<T>`" | Code smell | Minor |
| S3903 | Types should be defined in named namespaces | Bug | Major |
| S3904 | Assemblies should have version information | Code smell | Critical |
| S3923 | All branches in a conditional structure should not have exactly the same implementation | Bug | Major |
| S3925 | "ISerializable" should be implemented correctly | Code smell | Major |
| S3926 | Deserialization methods should be provided for "OptionalField" members | Bug | Major |
| S3927 | Serialization event handlers should be implemented correctly | Bug | Major |
| S3928 | Parameter names used into ArgumentException constructors should match an existing one | Code smell | Major |
| S3963 | "static" fields should be initialized inline | Code smell | Minor |
| S3971 | "GC.SuppressFinalize" should not be called | Code smell | Major |
| S3972 | Conditionals should start on new lines | Code smell | Critical |
| S3973 | A conditionally executed single line should be denoted by indentation | Code smell | Critical |
| S3981 | Collection sizes and array length comparisons should make sense | Bug | Major |
| S3984 | Exceptions should not be created without being thrown | Bug | Major |
| S3993 | Custom attributes should be marked with "System.AttributeUsageAttribute" | Code smell | Major |
| S3998 | Threads should not lock on objects with weak identity | Code smell | Critical |
| S4000 | Pointers to unmanaged memory should not be visible | Code smell | Critical |
| S4005 | "System.Uri" arguments should be used instead of strings | Code smell | Major |
| S4015 | Inherited member visibility should not be decreased | Code smell | Critical |
| S4019 | Base class methods should not be hidden | Code smell | Critical |
| S4035 | Classes implementing "`IEquatable<T>`" should be sealed | Code smell | Major |
| S4036 | Searching OS commands in PATH is security-sensitive | Security hotspot | Minor |
| S4050 | Operators should be overloaded consistently | Code smell | Major |
| S4052 | Types should not extend outdated base types | Code smell | Minor |
| S4061 | "params" should be used instead of "varargs" | Code smell | Minor |
| S4070 | Non-flags enums should not be marked with "FlagsAttribute" | Code smell | Major |
| S4136 | Method overloads should be grouped together | Code smell | Minor |
| S4143 | Collection elements should not be replaced unconditionally | Bug | Major |
| S4144 | Methods should not have identical implementations | Code smell | Major |
| S4159 | Classes should implement their "ExportAttribute" interfaces | Bug | Blocker |
| S4200 | Native methods should be wrapped | Code smell | Major |
| S4201 | Null checks should not be combined with "is" operator checks | Code smell | Minor |
| S4210 | Windows Forms entry points should be marked with STAThread | Bug | Major |
| S4211 | Members should not have conflicting transparency annotations | Vulnerability | Major |
| S4220 | Events should have proper arguments | Code smell | Major |
| S4260 | "ConstructorArgument" parameters should exist in constructors | Bug | Major |
| S4275 | Getters and setters should access the expected fields | Bug | Critical |
| S4277 | "Shared" parts should not be created with "new" | Bug | Critical |
| S4423 | Weak SSL/TLS protocols should not be used | Vulnerability | Critical |
| S4426 | Cryptographic keys should be robust | Vulnerability | Critical |
| S4428 | "PartCreationPolicyAttribute" should be used with "ExportAttribute" | Bug | Major |
| S4433 | LDAP connections should be authenticated | Vulnerability | Critical |
| S4456 | Parameter validation in yielding methods should be wrapped | Code smell | Major |
| S4457 | Parameter validation in "async"/"await" methods should be wrapped | Code smell | Major |
| S4487 | Unread "private" fields should be removed | Code smell | Critical |
| S4502 | Disabling CSRF protections is security-sensitive | Security hotspot | Critical |
| S4507 | Delivering code in production with debug features activated is security-sensitive | Security hotspot | Minor |
| S4524 | "default" clauses should be first or last | Code smell | Critical |
| S4545 | "DebuggerDisplayAttribute" strings should reference existing members | Code smell | Major |
| S4581 | "new Guid()" should not be used | Code smell | Major |
| S4583 | Calls to delegate's method "BeginInvoke" should be paired with calls to "EndInvoke" | Bug | Critical |
| S4586 | Non-async "`Task/Task<T>`" methods should not return null | Bug | Critical |
| S4635 | Start index should be used instead of calling Substring | Code smell | Critical |
| S4663 | Comments should not be empty | Code smell | Minor |
| S4790 | Using weak hashing algorithms is security-sensitive | Security hotspot | Critical |
| S4830 | Server certificates should be verified during SSL/TLS connections | Vulnerability | Critical |
| S5034 | "ValueTask" should be consumed correctly | Code smell | Critical |
| S5042 | Expanding archive files without controlling resource consumption is security-sensitive | Security hotspot | Critical |
| S5122 | Having a permissive Cross-Origin Resource Sharing policy is security-sensitive | Security hotspot | Minor |
| S5332 | Using clear-text protocols is security-sensitive | Security hotspot | Critical |
| S5344 | Passwords should not be stored in plaintext or with a fast hashing algorithm | Vulnerability | Critical |
| S5443 | Using publicly writable directories is security-sensitive | Security hotspot | Critical |
| S5445 | Insecure temporary file creation methods should not be used | Vulnerability | Critical |
| S5542 | Encryption algorithms should be used with secure mode and padding scheme | Vulnerability | Critical |
| S5547 | Cipher algorithms should be robust | Vulnerability | Critical |
| S5659 | JWT should be signed and verified with strong cipher algorithms | Vulnerability | Critical |
| S5693 | Allowing requests with excessive content length is security-sensitive | Security hotspot | Major |
| S5753 | Disabling ASP.NET "Request Validation" feature is security-sensitive | Security hotspot | Major |
| S5766 | Creating Serializable objects without data validation checks is security-sensitive | Security hotspot | Major |
| S5856 | Regular expressions should be syntactically valid | Bug | Critical |
| S6377 | XML signatures should be validated securely | Vulnerability | Major |
| S6418 | Hard-coded secrets are security-sensitive | Security hotspot | Blocker |
| S6419 | Azure Functions should be stateless | Code smell | Major |
| S6420 | Client instances should not be recreated on each Azure Function invocation | Code smell | Major |
| S6422 | Calls to "async" methods should not be blocking in Azure Functions | Code smell | Blocker |
| S6424 | Interfaces for durable entities should satisfy the restrictions | Code smell | Blocker |
| S6444 | Not specifying a timeout for regular expressions is security-sensitive | Security hotspot | Major |
| S6561 | Avoid using "DateTime.Now" for benchmarking or timing operations | Code smell | Major |
| S6562 | Always set the "DateTimeKind" when creating new "DateTime" instances | Code smell | Major |
| S6575 | Use "TimeZoneInfo.FindSystemTimeZoneById" without converting the timezones with "TimezoneConverter" | Code smell | Major |
| S6580 | Use a format provider when parsing date and time | Code smell | Major |
| S6588 | Use the "UnixEpoch" field instead of creating "DateTime" instances that point to the beginning of the Unix epoch | Code smell | Minor |
| S6607 | The collection should be filtered before sorting by using "Where" before "OrderBy" | Code smell | Minor |
| S6608 | Prefer indexing instead of "Enumerable" methods on types implementing "IList" | Code smell | Minor |
| S6609 | "Min/Max" properties of "Set" types should be used instead of the "Enumerable" extension methods | Code smell | Minor |
| S6610 | "StartsWith" and "EndsWith" overloads that take a "char" should be used instead of the ones that take a "string" | Code smell | Minor |
| S6612 | The lambda parameter should be used instead of capturing arguments in "ConcurrentDictionary" methods | Code smell | Minor |
| S6613 | "First" and "Last" properties of "LinkedList" should be used instead of the "First()" and "Last()" extension methods | Code smell | Minor |
| S6617 | "Contains" should be used instead of "Any" for simple equality checks | Code smell | Minor |
| S6618 | "string.Create" should be used instead of "FormattableString" | Code smell | Minor |
| S6640 | Using unsafe code blocks is security-sensitive | Security hotspot | Major |
| S6664 | The code block contains too many logging calls | Code smell | Minor |
| S6667 | Logging in a catch clause should pass the caught exception as a parameter. | Code smell | Minor |
| S6668 | Logging arguments should be passed to the correct parameter | Code smell | Minor |
| S6669 | Logger field or property name should comply with a naming convention | Code smell | Minor |
| S6670 | "Trace.Write" and "Trace.WriteLine" should not be used | Code smell | Minor |
| S6672 | Generic logger injection should match enclosing type | Code smell | Minor |
| S6673 | Log message template placeholders should be in the right order | Code smell | Major |
| S6674 | Log message template should be syntactically correct | Bug | Critical |
| S6675 | "Trace.WriteLineIf" should not be used with "TraceSwitch" levels | Code smell | Minor |
| S6677 | Message template placeholders should be unique | Bug | Major |
| S6678 | Use PascalCase for named placeholders | Code smell | Minor |
| S6797 | Blazor query parameter type should be supported | Bug | Major |
| S6798 | [JSInvokable] attribute should only be used on public methods | Bug | Major |
| S6800 | Component parameter type should match the route parameter type constraint | Bug | Major |
| S6930 | Backslash should be avoided in route templates | Bug | Major |
| S6931 | ASP.NET controller actions should not have a route template starting with "/" | Code smell | Major |
| S6932 | Use model binding instead of reading raw request data | Code smell | Major |
| S6934 | A Route attribute should be added to the controller when a route template is specified at the action level | Code smell | Major |
| S6960 | Controllers should not have mixed responsibilities | Code smell | Major |
| S6961 | API Controllers should derive from ControllerBase instead of Controller | Code smell | Major |
| S6962 | You should pool HTTP connections with HttpClientFactory | Code smell | Major |
| S6964 | Value type property used as input in a controller action should be nullable, required or annotated with the JsonRequiredAttribute to avoid under-posting. | Code smell | Major |
| S6965 | REST API actions should be annotated with an HTTP verb attribute | Code smell | Major |
| S6966 | Awaitable method should be used | Code smell | Major |
| S6967 | ModelState.IsValid should be called in controller actions | Code smell | Critical |
| S6968 | Actions that return a value should be annotated with ProducesResponseTypeAttribute containing the return type | Code smell | Major |
| S7039 | Content Security Policies should be restrictive | Vulnerability | Major |
| S818 | Literal suffixes should be upper case | Code smell | Minor |
| S907 | "goto" statement should not be used | Code smell | Major |
| S927 | Parameter names should match base declaration and other partial definitions | Code smell | Critical |
