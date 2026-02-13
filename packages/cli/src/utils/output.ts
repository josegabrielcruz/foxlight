// ============================================================
// @foxlight/cli — Output utilities
//
// Styled terminal output with consistent formatting across
// all CLI commands.
// ============================================================

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
} as const;

function color(text: string, ...codes: (keyof typeof COLORS)[]): string {
  const prefix = codes.map((c) => COLORS[c]).join('');
  return `${prefix}${text}${COLORS.reset}`;
}

export const ui = {
  /** Print the Foxlight banner / header. */
  banner(): void {
    console.log('');
    console.log(color('  🦊 Foxlight', 'bold', 'cyan'));
    console.log(color('  Front-End Intelligence Platform', 'dim'));
    console.log('');
  },

  /** Print a section header. */
  heading(text: string): void {
    console.log(color(`\n  ${text}`, 'bold'));
    console.log(color('  ' + '─'.repeat(48), 'dim'));
  },

  /** Print an info line. */
  info(label: string, value: string): void {
    console.log(`  ${color(label, 'dim')} ${value}`);
  },

  /** Print a success message. */
  success(text: string): void {
    console.log(`  ${color('✓', 'green')} ${text}`);
  },

  /** Print a warning message. */
  warn(text: string): void {
    console.log(`  ${color('⚠', 'yellow')} ${text}`);
  },

  /** Print an error message. */
  error(text: string): void {
    console.log(`  ${color('✗', 'red')} ${text}`);
  },

  /** Print a table row. */
  row(columns: string[], widths: number[]): void {
    const formatted = columns.map((col, i) => col.padEnd(widths[i] ?? 20));
    console.log(`  ${formatted.join('  ')}`);
  },

  /** Print a table header. */
  tableHeader(columns: string[], widths: number[]): void {
    const formatted = columns.map((col, i) =>
      color(col.padEnd(widths[i] ?? 20), 'dim', 'bold'),
    );
    console.log(`  ${formatted.join('  ')}`);
  },

  /** Print a component health score with color coding. */
  healthScore(score: number): string {
    if (score >= 80) return color(`${score}`, 'green', 'bold');
    if (score >= 50) return color(`${score}`, 'yellow', 'bold');
    return color(`${score}`, 'red', 'bold');
  },

  /** Print a size delta with color. */
  sizeDelta(delta: number): string {
    if (delta > 0) return color(`+${delta}`, 'red');
    if (delta < 0) return color(`${delta}`, 'green');
    return color('0', 'dim');
  },

  /** Print a spinner/progress message. */
  progress(text: string): void {
    process.stdout.write(`  ${color('◌', 'cyan')} ${text}...`);
  },

  /** Clear the progress line and replace with a result. */
  progressDone(text: string): void {
    process.stdout.write(`\r  ${color('●', 'cyan')} ${text}\n`);
  },

  /** Blank line. */
  gap(): void {
    console.log('');
  },
};
