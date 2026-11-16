// Opening a PDF on this device (a bill that came by email, say): pdf.js draws page 1, and page 2 under it when there
// is one, into one picture for the conversation, and takes out the PDF's own text. When the PDF has real text, that
// text is used instead of reading the picture: it is exact. pdf.js, its worker and its font and image data are served
// from WeKnow's own site (vite.config.ts copies them from npm), never a CDN, and load only when a PDF is chosen.
// Nothing here leaves the page.

/** A PDF with at least this many letters and digits in its text layer is read from its text; fewer, from its picture. */
export const TEXT_MIN = 40;
/** Pages drawn into the picture, and pages whose text is taken out. */
const DRAW_PAGES = 2;
const TEXT_PAGES = 4;
/** The width each page is drawn at, in pixels: sharp enough to read small print. */
const DRAW_WIDTH = 1400;

export interface PdfPaper {
  /** Page 1 (and page 2 under it), as one picture. */
  image: Blob;
  /** The PDF's own text, one printed line per text line. Empty for a scanned PDF. */
  text: string;
  /** True when `text` holds real words (TEXT_MIN or more letters and digits): read the text, not the picture. */
  hasText: boolean;
  pages: number;
}

export class PdfError extends Error {
  readonly reason: 'locked' | 'broken';
  constructor(reason: 'locked' | 'broken', message: string) {
    super(message);
    this.name = 'PdfError';
    this.reason = reason;
  }
}

/** One piece of text as pdf.js gives it: the string and where it is printed (transform[4], [5]: x and baseline y). */
export interface TextPiece {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
}

/**
 * Put pdf.js text pieces back into printed lines: pieces whose baselines are within half a letter's height are one
 * line, read left to right; a wide gap between two pieces becomes two spaces (two columns stay apart).
 */
export function linesOf(pieces: TextPiece[]): string[] {
  const items = pieces
    .filter((p) => p.str && p.str.trim())
    .map((p) => ({ s: p.str, x: p.transform[4] ?? 0, y: p.transform[5] ?? 0, w: p.width ?? 0, h: Math.abs(p.height || p.transform[3] || 10) }))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: Array<{ y: number; h: number; items: typeof items }> = [];
  for (const it of items) {
    const row = rows.find((r) => Math.abs(r.y - it.y) <= Math.max(2, Math.min(r.h, it.h) * 0.5));
    if (row) row.items.push(it);
    else rows.push({ y: it.y, h: it.h, items: [it] });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows
    .map((r) => {
      const xs = r.items.sort((a, b) => a.x - b.x);
      let out = '';
      let end = -Infinity;
      for (const it of xs) {
        const gap = it.x - end;
        if (out) out += gap > it.h * 1.5 ? '  ' : gap > it.h * 0.15 ? ' ' : '';
        out += it.s;
        end = it.x + (it.w || it.s.length * it.h * 0.5);
      }
      return out.replace(/[ \t]{3,}/g, '  ').trim();
    })
    .filter(Boolean);
}

/** Does this text hold real words (not a scan with a few stray marks)? */
export const hasRealText = (text: string) => (text.match(/[A-Za-z0-9]/g)?.length ?? 0) >= TEXT_MIN;

/** Is this file a PDF (by its type, or by its name when the type is missing)? */
export const isPdf = (f: { type?: string; name?: string }) => f.type === 'application/pdf' || (!f.type && /\.pdf$/i.test(f.name ?? ''));

const asset = (path: string) => new URL(`${import.meta.env.BASE_URL}pdfjs/${path}`, location.href).href;

type PdfJs = typeof import('pdfjs-dist');
let lib: Promise<PdfJs> | null = null;
function pdfjs(): Promise<PdfJs> {
  lib ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([m, w]) => {
    m.GlobalWorkerOptions.workerSrc = w.default;
    return m;
  });
  lib.catch(() => (lib = null));
  return lib;
}

/** Open a PDF on this device: the picture of its first pages and its own text. */
export async function openPdf(file: Blob): Promise<PdfPaper> {
  const m = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = m.getDocument({ data, standardFontDataUrl: asset('standard_fonts/'), wasmUrl: asset('wasm/') });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch (e) {
    const name = (e as Error)?.name ?? '';
    void task.destroy();
    throw new PdfError(name === 'PasswordException' ? 'locked' : 'broken', String((e as Error)?.message ?? e));
  }
  try {
    const pages = doc.numPages;
    const lines: string[] = [];
    for (let p = 1; p <= Math.min(pages, TEXT_PAGES); p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      lines.push(...linesOf(tc.items.filter((i) => 'str' in i) as TextPiece[]));
    }
    const drawn: HTMLCanvasElement[] = [];
    for (let p = 1; p <= Math.min(pages, DRAW_PAGES); p++) {
      const page = await doc.getPage(p);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(4, DRAW_WIDTH / base.width) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport, background: '#ffffff' }).promise;
      drawn.push(canvas);
    }
    const text = lines.join('\n');
    return { image: await stack(drawn), text, hasText: hasRealText(text), pages };
  } finally {
    void task.destroy();
  }
}

/** The drawn pages, one under the other with a thin grey gap, as one picture. */
async function stack(pages: HTMLCanvasElement[]): Promise<Blob> {
  const gap = pages.length > 1 ? 24 : 0;
  const w = Math.max(...pages.map((c) => c.width));
  const h = pages.reduce((n, c) => n + c.height, 0) + gap * (pages.length - 1);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  if (!ctx) throw new PdfError('broken', 'no canvas');
  ctx.fillStyle = '#d9dde3';
  ctx.fillRect(0, 0, w, h);
  let y = 0;
  for (const c of pages) {
    ctx.drawImage(c, Math.round((w - c.width) / 2), y);
    y += c.height + gap;
  }
  return new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new PdfError('broken', 'could not draw the pages'))), 'image/jpeg', 0.92));
}
