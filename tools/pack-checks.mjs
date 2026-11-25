// Checks over the text of a pack item and the kit's texts. Pure functions, used by the kit's tests over every pack source.

// BR-4: a reference to an agent or skill is @<name>. Not a reference: a package scope (@scope/…),
// an e-mail address or a remote with a user (word character before the @), a git revision (@{…}).
const REFERENCE = /(?<![\w@])@([A-Za-z0-9_-]+)(?![\w/{-])/g;

/** Every @<name> in the text, as { name, line }. */
export function references(text) {
  const found = [];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const match of line.matchAll(REFERENCE)) found.push({ name: match[1], line: index + 1 });
  });
  return found;
}

// BR-5: no pack item asks for a secret in the conversation, prints one, puts one on a command line
// or stores one from a literal. A "secret variable" is one whose name has a segment TOKEN, PAT,
// SECRET, KEY or PASSWORD (segments split on _, - and camel case, so $path and $keycloakUrl are
// not secret variables). A value is "from a literal or a placeholder" when it does not start with
// $, (, [ or % (a variable, a command's output, a .NET expression, a cmd variable).
const SECRET_SEGMENTS = new Set(['token', 'pat', 'secret', 'key', 'password']);
const LITERAL = String.raw`(?![$(\[%])\S`;
const SECRET_VARIABLE = /\$(?:env:)?([A-Za-z_]\w*)|%([A-Za-z_]\w*)%/g;
const BR5 = [
  { pattern: 'secrets pull', regex: /secrets pull/i },
  { pattern: 'paste your', regex: /\bpaste your\b/i },
  {
    pattern: 'user variable from a literal',
    regex: new RegExp(String.raw`SetEnvironmentVariable\(\s*["'][^"']*["']\s*,\s*${LITERAL}|\bsetx\s+\S+\s+${LITERAL}`, 'i'),
  },
  {
    pattern: 'secret variable from a literal',
    test: (line) => {
      const assigned = /(?:\$(?:env:)?([A-Za-z_]\w*)\s*=\s*|(?:^|\s)(?:export\s+)?([A-Z][A-Z0-9_]*)=)(?![=$(\[%])\S/.exec(line);
      return assigned !== null && isSecretName(assigned[1] ?? assigned[2]);
    },
  },
  {
    pattern: 'secret variable in the output',
    test: (line) => /\b(?:Write-Host|Write-Output|Write-Information|Write-Verbose|Write-Warning|Write-Error|echo|printf?|console\.log)\b/.test(line)
      && [...line.matchAll(SECRET_VARIABLE)].some((match) => isSecretName(match[1] ?? match[2])),
  },
  {
    // The placeholder's words are split like a variable name, so <newPAT> and <your-pat> are
    // placeholders for a token and <secret-name> or <path> are not.
    pattern: 'option with a token placeholder',
    test: (line) => [...line.matchAll(OPTION_PLACEHOLDER)].some((match) => hasSegment(match[1], TOKEN_SEGMENTS)),
  },
];
const OPTION_PLACEHOLDER = /(?:^|\s)-{1,2}[A-Za-z][\w.-]*(?:\s+|=)["']?[^<\s"']{0,40}<([^>]*)>/g;
const TOKEN_SEGMENTS = new Set(['token', 'pat', 'password']);

function hasSegment(name, segments) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[\s_-]+/).some((segment) => segments.has(segment.toLowerCase()));
}

function isSecretName(name) {
  return hasSegment(name, SECRET_SEGMENTS);
}

/** Every line that holds a BR-5 pattern, as { line, pattern }. */
export function br5Violations(text) {
  const found = [];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const { pattern, regex, test } of BR5) {
      if (regex ? regex.test(line) : test(line)) found.push({ line: index + 1, pattern });
    }
  });
  return found;
}

// § Pack values in Project settings: the labels are the contract the items read by. An item names a
// line by writing "Pack values" and the line's label in bold on the same line; the template marks
// each line under its "### Pack values" heading with the pack it belongs to.
const PACK_VALUES = /\bPack values\b/;
const BOLD = /\*\*([^*\n]+)\*\*/g;
const TEMPLATE_LINE = /^- \*\*([^*]+)\*\*:.*<!--\s*pack ([a-z][a-z0-9-]*)\b/;

/** The Pack values labels a pack item names, each once, in order of first appearance. */
export function packValueLabels(text) {
  const labels = [];
  for (const line of text.split(/\r?\n/)) {
    const start = line.search(PACK_VALUES);
    if (start < 0) continue;
    for (const match of line.slice(start).matchAll(BOLD)) {
      if (!labels.includes(match[1])) labels.push(match[1]);
    }
  }
  return labels;
}

/** The Pack values lines of the Project settings template, as { label, pack, line }. */
export function templatePackValues(text) {
  const found = [];
  let inside = false;
  text.split(/\r?\n/).forEach((line, index) => {
    if (/^#{1,3} /.test(line)) inside = /^### Pack values\s*$/.test(line);
    if (!inside) return;
    const match = TEMPLATE_LINE.exec(line);
    if (match) found.push({ label: match[1], pack: match[2], line: index + 1 });
  });
  return found;
}

// Unattended (kit 2.4.0): every documented test-executable command uses forward slashes, which
// Git Bash, PowerShell and the jobs all run. A backslash path is one with `\` between its segments
// that ends in an executable, a library, a script or a project file, or that starts at src\.
const BACKSLASH_PATH = /(?:[A-Za-z]:\\|\.{1,2}\\|\b)[\w.-]+(?:\\[\w.-]+)+\.(?:exe|dll|ps1|cmd|bat|csproj|sln)\b|\bsrc\\[\w.-]+/gi;

/** Every backslash path to a test executable, as { line, path }. */
export function backslashPathViolations(text) {
  const found = [];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const match of line.matchAll(BACKSLASH_PATH)) found.push({ line: index + 1, path: match[0] });
  });
  return found;
}

/** One field of the frontmatter: null without frontmatter, '' when the frontmatter has no such field. */
export function frontmatterField(text, field) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return null;
  const line = match[1].split(/\r?\n/).find((entry) => entry.startsWith(`${field}:`));
  return line ? line.slice(field.length + 1).trim().replace(/^(["'])(.*)\1$/, '$2') : '';
}

/** A list field of the frontmatter (`paths:`): null without frontmatter, [] when the frontmatter has no such field. */
export function frontmatterList(text, field) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return null;
  const lines = match[1].split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`${field}:`));
  if (start < 0) return [];
  const unquote = (value) => value.trim().replace(/^(["'])(.*)\1$/, '$2');
  const inline = lines[start].slice(field.length + 1).trim();
  if (inline) return inline.replace(/^\[|\]$/g, '').split(',').map(unquote).filter(Boolean);
  const items = [];
  for (let i = start + 1; i < lines.length && /^\s+- /.test(lines[i]); i++) items.push(unquote(lines[i].replace(/^\s+- /, '')));
  return items;
}

// Kit 2.5.6 (KitLean BR-36): a pack rule is applied when it loads by path (a `paths:` scope, which Claude Code
// matches against the file read or edited) or when build-slice names it. `**/` is any number of folders, `**` at
// the end anything below, `*` any characters within one folder name, `?` one such character.
const globCache = new Map();

/** Whether a `paths:` glob matches a path relative to the project root (forward slashes). */
export function globMatches(glob, file) {
  if (!globCache.has(glob)) {
    let source = '';
    for (let i = 0; i < glob.length; i += 1) {
      if (glob.startsWith('**/', i)) { source += '(?:.*/)?'; i += 2; }
      else if (glob.startsWith('**', i)) { source += '.*'; i += 1; }
      else if (glob[i] === '*') source += '[^/]*';
      else if (glob[i] === '?') source += '[^/]';
      else source += glob[i].replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
    globCache.set(glob, new RegExp(`^${source}$`));
  }
  return globCache.get(glob).test(file.split('\\').join('/'));
}

/** The names of the rules ({ name, text }) whose `paths` scope covers the file. */
export function rulesCovering(file, rules) {
  return rules.filter((rule) => (frontmatterList(rule.text, 'paths') ?? []).some((glob) => globMatches(glob, file))).map((rule) => rule.name);
}

/** The names of the rules ({ name, text }) without a `paths` scope that none of the texts names as `<name>.md`. */
export function unscopedRules(rules, texts) {
  return rules
    .filter((rule) => (frontmatterList(rule.text, 'paths') ?? []).length === 0)
    .filter((rule) => !texts.some((text) => text.includes(`${rule.name}.md`)))
    .map((rule) => rule.name);
}

/** The name in the frontmatter: null without frontmatter, '' when the frontmatter has no name. */
export function frontmatterName(text) {
  return frontmatterField(text, 'name');
}
