// Checks of _specs/Guidelines/spec.md over pack rules and core texts (BR-8, BR-10, BR-12).
// Pure functions, used by the kit's tests.

// BR-8: a guideline's role is the first line of its body, after the frontmatter.
const ROLES = ['coding', 'testing', 'architecture'];
const ROLE_LINE = /^<!--\s*guideline:\s*([a-z]+)\s*-->\s*$/;

/** The role of a guideline (coding, testing, architecture), or null when the text carries no role line. */
export function guidelineRole(text) {
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  const match = ROLE_LINE.exec(body.split(/\r?\n/)[0]);
  return match && ROLES.includes(match[1]) ? match[1] : null;
}

// BR-10: what a guideline never holds. A matched e-mail address or URL is taken out of the line
// before the host check, so one value is reported once, under its own pattern.
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const URL = /\b(?:https?|ftp):\/\/\S+/g;
const BR10 = [
  { pattern: 'token', regex: /\{\{[^}]*\}\}/ },
  { pattern: 'personal name', regex: /\b(?:Dr|Mr|Mrs|Ms|Prof)\.?\s+[A-Z][a-z]+/ },
  { pattern: 'national number', regex: /(?<![\d.-])(?:\d{2}\.\d{2}\.\d{2}-\d{3}\.\d{2}|\d{11})(?![\d-])/ },
  { pattern: 'e-mail address', regex: EMAIL },
  { pattern: 'URL', regex: URL },
  {
    pattern: 'host name',
    regex: /(?<![\w.-])(?:[a-z0-9-]+\.)+(?:be|com|net|org|eu|io|local|internal|intra|corp|lan)(?![\w-])|(?<![\d.])\d{1,3}(?:\.\d{1,3}){3}(?![\d.])/,
  },
  { pattern: 'id', regex: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i },
];

/** Every line that holds a BR-10 pattern, as { line, pattern }. */
export function br10Violations(text) {
  const found = [];
  text.split(/\r?\n/).forEach((original, index) => {
    let line = original;
    for (const { pattern, regex } of BR10) {
      if (new RegExp(regex.source, regex.flags.replace('g', '')).test(line)) {
        found.push({ line: index + 1, pattern });
        if (regex === EMAIL || regex === URL) line = line.replace(regex, ' ');
      }
    }
  });
  return found;
}

// BR-12: a core text's "Guidelines" paragraph is the body under a "## Guidelines" heading.
/** The body under each "## Guidelines" heading, up to the next heading, trimmed. */
export function guidelineParagraphs(text) {
  const paragraphs = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    if (/^#{1,6} /.test(line)) {
      if (current !== null) paragraphs.push(current.join('\n').trim());
      current = /^## Guidelines\s*$/.test(line) ? [] : null;
    } else if (current !== null) current.push(line);
  }
  if (current !== null) paragraphs.push(current.join('\n').trim());
  return paragraphs;
}

// AC-10: the coding guideline's Sonar keys against the profile file.
const SONAR_KEY = /(?<![\w])S\d{3,4}(?!\d)/g;

/** The keys of the profile file: the first cell of each table row that is a Sonar key. */
export function profileKeys(text) {
  return new Set([...text.matchAll(/^\|\s*(S\d{3,4})\s*\|/gm)].map((m) => m[1]));
}

/** Every distinct Sonar rule key (S followed by three or four digits) in a text, in order of appearance. */
export function sonarKeys(text) {
  return [...new Set(text.match(SONAR_KEY) ?? [])];
}

/** The body rows, as trimmed cells, of the first table under the "## <heading>" heading, up to the next "## " heading. */
export function sectionTable(text, heading) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) return [];
  const rows = [];
  for (const line of lines.slice(start + 1)) {
    if (/^## /.test(line)) break;
    if (line.startsWith('|')) rows.push(line);
    else if (rows.length > 0) break;
  }
  return rows.slice(2).map((row) =>
    row.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|')));
}

// BR-11: every statement of an architecture guideline carries its source key, and the keys resolve.
/**
 * The BR-11 violations of an architecture guideline: a row of the "## Statements" table (Area,
 * Statement, Source) whose Source cell is empty or names a key that the guideline's "## Sources"
 * table lacks, and a key of that Sources table that is not one of the spec's Appendix keys.
 * The Source cell holds keys only, separated by commas.
 */
export function br11Violations(text, appendixKeys) {
  const statements = sectionTable(text, 'Statements');
  if (statements.length === 0) return [{ problem: 'no statements' }];
  const sources = sectionTable(text, 'Sources').map((cells) => cells[0].replace(/`/g, ''));
  const found = sources.filter((key) => !appendixKeys.includes(key)).map((key) => ({ key, problem: 'not in the Appendix' }));
  for (const cells of statements) {
    const statement = cells[1];
    const keys = (cells[cells.length - 1] ?? '').split(/\s*,\s*/).filter(Boolean);
    if (keys.length === 0) found.push({ statement, problem: 'no source key' });
    for (const key of keys) if (!sources.includes(key)) found.push({ statement, key, problem: 'unknown key' });
  }
  return found;
}

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Every pack or guideline file a paragraph names (BR-12), as { name }: a pack name or a hyphenated
 * guideline name as a word, a guideline name in backticks, any Markdown file name.
 */
export function br12Violations(paragraph, { packs, files }) {
  const found = [];
  const add = (name) => { if (!found.some((f) => f.name === name)) found.push({ name }); };
  for (const match of paragraph.matchAll(/[\w.-]+\.md\b/g)) add(match[0].split('/').pop());
  for (const name of [...packs, ...files.filter((file) => file.includes('-'))]) {
    if (new RegExp(`(?<![\\w-])${escape(name)}(?![\\w-])`).test(paragraph)) add(name);
  }
  for (const name of files) {
    if (new RegExp(`\`${escape(name)}\``).test(paragraph)) add(name);
  }
  return found;
}
