/**
 * Minimal, dependency-free PDF 1.4 writer.
 *
 * The app ships as a single self-contained HTML file, so pulling in a heavyweight PDF
 * library would inflate every load. This module emits a valid PDF (page tree, standard
 * Type1 fonts, content streams, correct xref table and trailer) with a small flowing-text
 * layout engine on top: headings, paragraphs, bullets, key/value tables, data tables,
 * rules, page breaks, and running headers/footers with "Page N of M".
 *
 * Output is Latin-1/WinAnsi safe — non-representable characters are transliterated.
 */

const PAGE_W = 595.28; // A4 portrait
const PAGE_H = 841.89;
const MARGIN_X = 42;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 54;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

export type PdfFontName = 'regular' | 'bold' | 'mono';
export type PdfColor = [number, number, number]; // 0..1

export const COLORS = {
  black: [0, 0, 0] as PdfColor,
  ink: [0.09, 0.13, 0.19] as PdfColor,
  slate: [0.36, 0.42, 0.5] as PdfColor,
  muted: [0.55, 0.6, 0.66] as PdfColor,
  rule: [0.82, 0.85, 0.89] as PdfColor,
  panelBg: [0.965, 0.975, 0.985] as PdfColor,
  headBg: [0.91, 0.94, 0.97] as PdfColor,
  cyan: [0.02, 0.55, 0.72] as PdfColor,
  green: [0.05, 0.55, 0.32] as PdfColor,
  amber: [0.72, 0.45, 0.02] as PdfColor,
  red: [0.72, 0.13, 0.13] as PdfColor,
  white: [1, 1, 1] as PdfColor,
};

/* ------------------------- Helvetica/Bold/Courier widths ------------------------- */
/* Standard AFM widths, per 1000 units, for ASCII 32..126. */

const W_REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const W_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

function widthOf(ch: string, font: PdfFontName): number {
  if (font === 'mono') return 600;
  const code = ch.charCodeAt(0);
  const table = font === 'bold' ? W_BOLD : W_REGULAR;
  if (code < 32 || code > 126) return font === 'bold' ? 556 : 500;
  return table[code - 32] ?? 500;
}

export function textWidth(text: string, size: number, font: PdfFontName): number {
  let w = 0;
  for (const ch of text) w += widthOf(ch, font);
  return (w * size) / 1000;
}

/* ------------------------------- text sanitation ------------------------------- */

const TRANSLITERATE: Record<string, string> = {
  '—': '-', '–': '-', '−': '-', '•': '-', '·': '-', '✓': '[x]', '✗': '[ ]',
  '“': '"', '”': '"', '‘': "'", '’': "'", '…': '...', '→': '->', '←': '<-',
  '≥': '>=', '≤': '<=', '±': '+/-', '×': 'x', '÷': '/', '€': 'EUR', '£': 'GBP',
  '▪': '-', '◦': '-', '★': '*', '☆': '*', '⚠': '[!]', '●': '-',
};

function sanitize(input: string): string {
  let out = '';
  for (const ch of String(input ?? '')) {
    const code = ch.charCodeAt(0);
    if (ch === '\n' || ch === '\r' || ch === '\t') {
      out += ' ';
      continue;
    }
    if (code >= 32 && code <= 126) {
      out += ch;
      continue;
    }
    const mapped = TRANSLITERATE[ch];
    if (mapped) {
      out += mapped;
      continue;
    }
    if (code >= 160 && code <= 255) {
      out += ch; // WinAnsi high range survives Latin-1 encoding
      continue;
    }
    out += '?';
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function rgb(c: PdfColor): string {
  return `${c[0].toFixed(3)} ${c[1].toFixed(3)} ${c[2].toFixed(3)}`;
}

/* --------------------------------- layout types -------------------------------- */

export interface PdfTextOptions {
  size?: number;
  font?: PdfFontName;
  color?: PdfColor;
  /** Right-align to this x (absolute). Mutually exclusive with `width`. */
  align?: 'left' | 'center' | 'right';
  width?: number;
}

export interface PdfTableRow {
  cells: string[];
  bold?: boolean;
  color?: PdfColor;
}

export interface PdfTableOptions {
  headers?: string[];
  /** Relative or absolute widths; normalised to the content width. */
  widths?: number[];
  aligns?: ('left' | 'right' | 'center')[];
  fontSize?: number;
  headerFontSize?: number;
  rowPadding?: number;
  zebra?: boolean;
  headerBg?: PdfColor;
  borderColor?: PdfColor;
}

export interface PdfDocumentMeta {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  /** Rendered top-left of every page. */
  headerLeft?: string;
  /** Rendered top-right of every page. */
  headerRight?: string;
  /** Rendered bottom-left of every page. */
  footerLeft?: string;
  /** Rendered bottom-right of every page (defaults to "Page N of M"). */
  footerRight?: string;
  classification?: string;
}

/**
 * Flowing document builder. Draw in reading order; pages are created automatically.
 */
export class PdfDocument {
  private pages: string[] = [];
  private ops: string[] = [];
  private y = MARGIN_TOP;
  readonly meta: PdfDocumentMeta;

  constructor(meta: PdfDocumentMeta = {}) {
    this.meta = meta;
    this.newPage();
  }

  /* ------------------------------ page management ------------------------------ */

  private newPage(): void {
    if (this.ops.length) this.pages.push(this.ops.join('\n'));
    this.ops = [];
    this.y = MARGIN_TOP;
  }

  get currentPageCount(): number {
    return this.pages.length + (this.ops.length ? 1 : 0);
  }

  get cursorY(): number {
    return this.y;
  }

  get contentWidth(): number {
    return CONTENT_W;
  }

  get leftX(): number {
    return MARGIN_X;
  }

  pageBreak(): void {
    this.newPage();
  }

  private ensure(space: number): void {
    if (this.y + space > PAGE_H - MARGIN_BOTTOM) this.newPage();
  }

  /* --------------------------------- primitives -------------------------------- */

  private push(op: string): void {
    this.ops.push(op);
  }

  private toPdfY(yTop: number): number {
    return PAGE_H - yTop;
  }

  rect(x: number, yTop: number, w: number, h: number, opts: { fill?: PdfColor; stroke?: PdfColor; lineWidth?: number } = {}): void {
    const y = this.toPdfY(yTop + h);
    const parts: string[] = [];
    if (opts.fill) parts.push(`${rgb(opts.fill)} rg`);
    if (opts.stroke) parts.push(`${rgb(opts.stroke)} RG`);
    parts.push(`${(opts.lineWidth ?? 0.6).toFixed(2)} w`);
    parts.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`);
    parts.push(opts.fill && opts.stroke ? 'B' : opts.fill ? 'f' : 'S');
    this.push(parts.join(' '));
  }

  line(x1: number, y1Top: number, x2: number, y2Top: number, opts: { color?: PdfColor; lineWidth?: number; dash?: string } = {}): void {
    const color = opts.color ?? COLORS.rule;
    this.push(
      `${rgb(color)} RG ${(opts.lineWidth ?? 0.6).toFixed(2)} w ${opts.dash ? `[${opts.dash}] 0 d ` : '[] 0 d '}` +
        `${x1.toFixed(2)} ${this.toPdfY(y1Top).toFixed(2)} m ${x2.toFixed(2)} ${this.toPdfY(y2Top).toFixed(2)} l S`
    );
  }

  /** Draw a single line of text at an explicit position (no wrapping, no cursor move). */
  drawTextAt(text: string, x: number, yTop: number, opts: PdfTextOptions = {}): void {
    const size = opts.size ?? 10;
    const font = opts.font ?? 'regular';
    const clean = sanitize(text);
    if (!clean) return;
    let drawX = x;
    const w = textWidth(clean, size, font);
    if (opts.align === 'right') drawX = x - w;
    else if (opts.align === 'center') drawX = x - w / 2;
    const fontRef = font === 'bold' ? '/F2' : font === 'mono' ? '/F3' : '/F1';
    // Baseline sits ~0.22*size above the visual bottom of the box.
    const baseline = this.toPdfY(yTop + size * 0.82);
    this.push(
      `BT ${rgb(opts.color ?? COLORS.ink)} rg ${fontRef} ${size} Tf 1 0 0 1 ${drawX.toFixed(2)} ${baseline.toFixed(2)} Tm (${escapeText(clean)}) Tj ET`
    );
  }

  wrap(text: string, maxWidth: number, size: number, font: PdfFontName): string[] {
    const words = sanitize(text).split(' ').filter(Boolean);
    if (words.length === 0) return [''];
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (textWidth(candidate, size, font) <= maxWidth || !current) {
        // A single word wider than the box is hard-split.
        if (!current && textWidth(word, size, font) > maxWidth) {
          let chunk = '';
          for (const ch of word) {
            if (textWidth(chunk + ch, size, font) > maxWidth) {
              lines.push(chunk);
              chunk = ch;
            } else chunk += ch;
          }
          current = chunk;
        } else {
          current = candidate;
        }
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  /* ------------------------------ flowing content ------------------------------ */

  text(text_: string, opts: PdfTextOptions & { gapBefore?: number; gapAfter?: number } = {}): void {
    const size = opts.size ?? 10;
    const font = opts.font ?? 'regular';
    const leading = size * 1.38;
    const width = opts.width ?? CONTENT_W;
    const lines = this.wrap(text_, width, size, font);
    this.ensure((opts.gapBefore ?? 0) + lines.length * leading + (opts.gapAfter ?? 0));
    this.y += opts.gapBefore ?? 0;
    let x = MARGIN_X;
    if (opts.align === 'right') x = MARGIN_X + width;
    else if (opts.align === 'center') x = MARGIN_X + width / 2;
    for (const l of lines) {
      this.drawTextAt(l, x, this.y, { size, font, color: opts.color, align: opts.align });
      this.y += leading;
    }
    this.y += opts.gapAfter ?? 0;
  }

  spacer(h = 8): void {
    this.ensure(h);
    this.y += h;
  }

  hr(opts: { color?: PdfColor; lineWidth?: number; gap?: number } = {}): void {
    const gap = opts.gap ?? 6;
    this.ensure(gap * 2 + 2);
    this.y += gap;
    this.line(MARGIN_X, this.y, PAGE_W - MARGIN_X, this.y, { color: opts.color ?? COLORS.rule, lineWidth: opts.lineWidth ?? 0.6 });
    this.y += gap;
  }

  heading(text_: string, level: 1 | 2 | 3 = 2, opts: { color?: PdfColor } = {}): void {
    const conf = level === 1 ? { size: 17, gapBefore: 4, gapAfter: 8 } : level === 2 ? { size: 13, gapBefore: 12, gapAfter: 5 } : { size: 11, gapBefore: 8, gapAfter: 3 };
    this.text(text_, {
      size: conf.size,
      font: 'bold',
      color: opts.color ?? (level === 1 ? COLORS.black : COLORS.ink),
      gapBefore: conf.gapBefore,
      gapAfter: conf.gapAfter,
    });
    if (level === 2) {
      this.y -= 3;
      this.line(MARGIN_X, this.y, PAGE_W - MARGIN_X, this.y, { color: COLORS.rule, lineWidth: 0.7 });
      this.y += 6;
    }
  }

  bullets(items: string[], opts: { size?: number; color?: PdfColor } = {}): void {
    const size = opts.size ?? 9.5;
    for (const item of items) {
      const lines = this.wrap(item, CONTENT_W - 14, size, 'regular');
      this.ensure(lines.length * size * 1.38 + 2);
      this.drawTextAt('-', MARGIN_X + 2, this.y, { size, font: 'bold', color: opts.color ?? COLORS.cyan });
      lines.forEach((l, i) => {
        this.drawTextAt(l, MARGIN_X + 14, this.y, { size, color: COLORS.ink });
        if (i < lines.length - 1) this.y += size * 1.38;
      });
      this.y += size * 1.38 + 1.5;
    }
  }

  /** Two-column key/value block. */
  keyValue(rows: [string, string | number | boolean | null | undefined][], opts: { labelWidth?: number; size?: number; zebra?: boolean } = {}): void {
    const size = opts.size ?? 9.5;
    const labelW = opts.labelWidth ?? 165;
    const valueW = CONTENT_W - labelW;
    const rowH = size * 1.38 + 5;
    rows.forEach(([label, value], idx) => {
      const v = value === null || value === undefined || value === '' ? '—' : String(value);
      const valueLines = this.wrap(v, valueW - 8, size, 'regular');
      const h = Math.max(rowH, valueLines.length * size * 1.38 + 5);
      this.ensure(h);
      if (opts.zebra !== false && idx % 2 === 1) {
        this.rect(MARGIN_X, this.y, CONTENT_W, h, { fill: COLORS.panelBg });
      }
      this.drawTextAt(sanitize(label), MARGIN_X + 5, this.y + 3, { size, font: 'bold', color: COLORS.slate });
      valueLines.forEach((l, i) => {
        this.drawTextAt(l, MARGIN_X + labelW + 3, this.y + 3 + i * size * 1.38, { size, color: COLORS.ink });
      });
      this.y += h;
      this.line(MARGIN_X, this.y, PAGE_W - MARGIN_X, this.y, { color: COLORS.rule, lineWidth: 0.35 });
    });
  }

  /** Measure the height a table row will occupy (used for page-break decisions). */
  private rowHeight(cells: string[], widths: number[], fontSize: number, padding: number): number {
    let lines = 1;
    cells.forEach((c, i) => {
      const w = widths[i] ?? CONTENT_W / cells.length;
      const n = this.wrap(c, Math.max(10, w - 8), fontSize, 'regular').length;
      if (n > lines) lines = n;
    });
    return lines * fontSize * 1.35 + padding * 2;
  }

  table(rows: PdfTableRow[], opts: PdfTableOptions = {}): void {
    const fontSize = opts.fontSize ?? 9;
    const headerFontSize = opts.headerFontSize ?? 8.5;
    const padding = opts.rowPadding ?? 4;
    const nCols = opts.headers?.length ?? rows[0]?.cells.length ?? 1;
    const raw = opts.widths && opts.widths.length === nCols ? opts.widths : Array(nCols).fill(1);
    const totalRaw = raw.reduce((a, b) => a + b, 0) || 1;
    const widths = raw.map((w) => (w / totalRaw) * CONTENT_W);
    const border = opts.borderColor ?? COLORS.rule;

    if (opts.headers?.length) {
      const hh = this.rowHeight(opts.headers, widths, headerFontSize, padding);
      this.ensure(hh);
      this.rect(MARGIN_X, this.y, CONTENT_W, hh, { fill: opts.headerBg ?? COLORS.headBg, stroke: border, lineWidth: 0.5 });
      opts.headers.forEach((h, i) => {
        const x = MARGIN_X + widths.slice(0, i).reduce((a, b) => a + b, 0);
        const align = opts.aligns?.[i] ?? 'left';
        const tx = align === 'right' ? x + widths[i] - 4 : align === 'center' ? x + widths[i] / 2 : x + 4;
        const lines = this.wrap(h, Math.max(10, widths[i] - 8), headerFontSize, 'bold');
        lines.forEach((l, li) => {
          this.drawTextAt(l, tx, this.y + padding + li * headerFontSize * 1.3, {
            size: headerFontSize,
            font: 'bold',
            color: COLORS.ink,
            align,
          });
        });
      });
      this.y += hh;
    }

    rows.forEach((row, idx) => {
      const h = this.rowHeight(row.cells, widths, fontSize, padding);
      if (this.y + h > PAGE_H - MARGIN_BOTTOM) {
        this.newPage();
        // Repeat the header on the continuation page.
        if (opts.headers?.length) {
          const hh = this.rowHeight(opts.headers, widths, headerFontSize, padding);
          this.rect(MARGIN_X, this.y, CONTENT_W, hh, { fill: opts.headerBg ?? COLORS.headBg, stroke: border, lineWidth: 0.5 });
          opts.headers.forEach((hd, i) => {
            const x = MARGIN_X + widths.slice(0, i).reduce((a, b) => a + b, 0);
            const align = opts.aligns?.[i] ?? 'left';
            const tx = align === 'right' ? x + widths[i] - 4 : align === 'center' ? x + widths[i] / 2 : x + 4;
            this.drawTextAt(hd, tx, this.y + padding, { size: headerFontSize, font: 'bold', color: COLORS.ink, align });
          });
          this.y += hh;
        }
      }
      if (opts.zebra !== false && idx % 2 === 1) {
        this.rect(MARGIN_X, this.y, CONTENT_W, h, { fill: COLORS.panelBg });
      }
      row.cells.forEach((cell, i) => {
        const x = MARGIN_X + widths.slice(0, i).reduce((a, b) => a + b, 0);
        const align = opts.aligns?.[i] ?? 'left';
        const tx = align === 'right' ? x + widths[i] - 4 : align === 'center' ? x + widths[i] / 2 : x + 4;
        const lines = this.wrap(cell, Math.max(10, widths[i] - 8), fontSize, row.bold ? 'bold' : 'regular');
        lines.forEach((l, li) => {
          this.drawTextAt(l, tx, this.y + padding + li * fontSize * 1.35, {
            size: fontSize,
            font: row.bold ? 'bold' : 'regular',
            color: row.color ?? COLORS.ink,
            align,
          });
        });
        if (i > 0) this.line(x, this.y, x, this.y + h, { color: border, lineWidth: 0.3 });
      });
      this.rect(MARGIN_X, this.y, CONTENT_W, h, { stroke: border, lineWidth: 0.4 });
      this.y += h;
    });
  }

  /** Highlighted callout box. */
  callout(title: string, body: string, opts: { accent?: PdfColor; bg?: PdfColor } = {}): void {
    const accent = opts.accent ?? COLORS.cyan;
    const titleLines = this.wrap(title, CONTENT_W - 24, 11, 'bold');
    const bodyLines = this.wrap(body, CONTENT_W - 24, 9.5, 'regular');
    const h = 14 + titleLines.length * 15 + bodyLines.length * 13.5 + 8;
    this.ensure(h);
    this.rect(MARGIN_X, this.y, CONTENT_W, h, { fill: opts.bg ?? COLORS.panelBg, stroke: COLORS.rule, lineWidth: 0.5 });
    this.rect(MARGIN_X, this.y, 3, h, { fill: accent });
    let ty = this.y + 7;
    titleLines.forEach((l) => {
      this.drawTextAt(l, MARGIN_X + 12, ty, { size: 11, font: 'bold', color: COLORS.ink });
      ty += 15;
    });
    bodyLines.forEach((l) => {
      this.drawTextAt(l, MARGIN_X + 12, ty, { size: 9.5, color: COLORS.slate });
      ty += 13.5;
    });
    this.y += h + 8;
  }

  /* ---------------------------------- build ----------------------------------- */

  private renderChrome(): void {
    const totalPages = this.pages.length + 1;
    this.pages.forEach((content, i) => {
      const chrome: string[] = [];
      const emit = (op: string) => chrome.push(op);
      const headerLeft = this.meta.headerLeft;
      const headerRight = this.meta.headerRight;
      if (headerLeft || headerRight) {
        emit(`0.86 0.89 0.92 RG 0.6 w ${MARGIN_X.toFixed(2)} ${(PAGE_H - 40).toFixed(2)} m ${(PAGE_W - MARGIN_X).toFixed(2)} ${(PAGE_H - 40).toFixed(2)} l S`);
        if (headerLeft) {
          const t = escapeText(sanitize(headerLeft));
          emit(`BT ${rgb(COLORS.slate)} rg /F1 8 Tf 1 0 0 1 ${MARGIN_X} ${(PAGE_H - 32).toFixed(2)} Tm (${t}) Tj ET`);
        }
        if (headerRight) {
          const t = sanitize(headerRight);
          const x = PAGE_W - MARGIN_X - textWidth(t, 8, 'regular');
          emit(`BT ${rgb(COLORS.muted)} rg /F1 8 Tf 1 0 0 1 ${x.toFixed(2)} ${(PAGE_H - 32).toFixed(2)} Tm (${escapeText(t)}) Tj ET`);
        }
      }
      const footerLeft = this.meta.classification ? `${this.meta.classification}  |  ${this.meta.footerLeft ?? ''}` : this.meta.footerLeft;
      const footerRight = this.meta.footerRight ?? `Page ${i + 1} of ${totalPages}`;
      emit(`0.86 0.89 0.92 RG 0.6 w ${MARGIN_X.toFixed(2)} ${MARGIN_BOTTOM - 12} m ${(PAGE_W - MARGIN_X).toFixed(2)} ${MARGIN_BOTTOM - 12} l S`);
      if (footerLeft) {
        emit(`BT ${rgb(COLORS.muted)} rg /F1 7.5 Tf 1 0 0 1 ${MARGIN_X} ${(MARGIN_BOTTOM - 24).toFixed(2)} Tm (${escapeText(sanitize(footerLeft))}) Tj ET`);
      }
      const fx = PAGE_W - MARGIN_X - textWidth(footerRight, 7.5, 'regular');
      emit(`BT ${rgb(COLORS.muted)} rg /F1 7.5 Tf 1 0 0 1 ${fx.toFixed(2)} ${(MARGIN_BOTTOM - 24).toFixed(2)} Tm (${escapeText(sanitize(footerRight))}) Tj ET`);
      this.pages[i] = `${content}\n${chrome.join('\n')}`;
    });
  }

  /** Serialise to raw PDF bytes. */
  toBytes(): Uint8Array {
    if (this.ops.length) {
      this.pages.push(this.ops.join('\n'));
      this.ops = [];
    }
    this.renderChrome();

    const pageCount = this.pages.length;
    const numCatalog = 1;
    const numPages = 2;
    const numFontReg = 3;
    const numFontBold = 4;
    const numFontMono = 5;
    const firstPageObj = 6;
    const numInfo = firstPageObj + pageCount * 2;
    const totalObjects = numInfo + 1;

    const bodies: string[] = [];
    bodies[numCatalog - 1] = `<< /Type /Catalog /Pages ${numPages} 0 R /PageMode /UseNone >>`;
    const kids: number[] = [];
    for (let i = 0; i < pageCount; i++) kids.push(firstPageObj + i * 2);
    bodies[numPages - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${pageCount} >>`;
    bodies[numFontReg - 1] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
    bodies[numFontBold - 1] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;
    bodies[numFontMono - 1] = `<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>`;

    for (let i = 0; i < pageCount; i++) {
      const pageObj = firstPageObj + i * 2;
      const contentObj = pageObj + 1;
      bodies[pageObj - 1] =
        `<< /Type /Page /Parent ${numPages} 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] ` +
        `/Resources << /Font << /F1 ${numFontReg} 0 R /F2 ${numFontBold} 0 R /F3 ${numFontMono} 0 R >> /ProcSet [/PDF /Text] >> ` +
        `/Contents ${contentObj} 0 R >>`;
      const stream = this.pages[i];
      const streamLen = latin1Length(stream);
      bodies[contentObj - 1] = `<< /Length ${streamLen} >>\nstream\n${stream}\nendstream`;
    }

    const now = pdfDate();
    bodies[numInfo - 1] =
      `<< /Title (${escapeText(sanitize(this.meta.title ?? 'IPRS Report'))}) ` +
      `/Author (${escapeText(sanitize(this.meta.author ?? 'IPRS Kenya'))}) ` +
      `/Subject (${escapeText(sanitize(this.meta.subject ?? ''))}) ` +
      `/Keywords (${escapeText(sanitize(this.meta.keywords ?? ''))}) ` +
      `/Creator (${escapeText(sanitize(this.meta.creator ?? 'IPRS Kenya Platform'))}) ` +
      `/Producer (IPRS PdfDocument) /CreationDate (${now}) /ModDate (${now}) >>`;

    // Assemble bytes, recording offsets.
    const parts: string[] = ['%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n'];
    let offset = latin1Length(parts[0]);
    const offsets: number[] = [];
    for (let i = 0; i < totalObjects - 1; i++) {
      const body = bodies[i] ?? '<< >>';
      offsets[i] = offset;
      const chunk = `${i + 1} 0 obj\n${body}\nendobj\n`;
      parts.push(chunk);
      offset += latin1Length(chunk);
    }
    const xrefOffset = offset;
    let xref = `xref\n0 ${totalObjects}\n0000000000 65535 f \n`;
    for (let i = 0; i < totalObjects - 1; i++) {
      xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    xref += `trailer\n<< /Size ${totalObjects} /Root ${numCatalog} 0 R /Info ${numInfo} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    parts.push(xref);

    const full = parts.join('');
    const bytes = new Uint8Array(full.length);
    for (let i = 0; i < full.length; i++) bytes[i] = full.charCodeAt(i) & 0xff;
    return bytes;
  }

  toBlob(): Blob {
    return new Blob([this.toBytes().buffer as ArrayBuffer], { type: 'application/pdf' });
  }
}

function latin1Length(s: string): number {
  // Every char is emitted as a single byte (charCode & 0xff), so length === byte length.
  return s.length;
}

function pdfDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `D:${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}+03'00'`;
}

/* --------------------------- report-specific helpers --------------------------- */

export function severityColor(state: string): PdfColor {
  switch (state) {
    case 'verified':
    case 'success':
    case 'Active':
    case 'Paid':
      return COLORS.green;
    case 'partial':
    case 'warning':
    case 'Degraded':
    case 'Pending':
      return COLORS.amber;
    case 'mismatch':
    case 'not_found':
    case 'error':
    case 'failed':
    case 'Offline':
    case 'Overdue':
      return COLORS.red;
    default:
      return COLORS.slate;
  }
}
