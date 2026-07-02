import fs from "fs";
import path from "path";

// Fonts are loaded from disk once per process and reused for every PDF.
let regularFont: Buffer | null | undefined;
let boldFont: Buffer | null | undefined;

function loadFont(fileName: string): Buffer | null {
  const fontPath = path.join(process.cwd(), "public", "fonts", fileName);
  try {
    return fs.readFileSync(fontPath);
  } catch {
    console.error(`PDF font not found: ${fontPath} — falling back to Helvetica without diacritics.`);
    return null;
  }
}

export interface PdfTextHelpers {
  /** True when the bundled Roboto font (full Slovak diacritics support) is available */
  hasCustomFont: boolean;
  /** Switch the document to the bold font face */
  useBold: () => void;
  /** Switch the document back to the regular font face */
  useRegular: () => void;
  /**
   * Prepares text for rendering. With the bundled font, text is returned
   * unchanged (diacritics preserved). Without it, diacritics are stripped so
   * PDFKit's built-in Helvetica does not crash on unsupported characters.
   */
  t: (s: string | null | undefined) => string;
}

/**
 * Registers the bundled Roboto fonts on a PDFKit document and returns text helpers.
 */
export function setupPdfFonts(doc: PDFKit.PDFDocument): PdfTextHelpers {
  if (regularFont === undefined) regularFont = loadFont("Roboto-Regular.ttf");
  if (boldFont === undefined) boldFont = loadFont("Roboto-Bold.ttf");

  if (regularFont) {
    doc.registerFont("Body", regularFont);
    doc.font("Body");
  }
  if (boldFont) {
    doc.registerFont("Body-Bold", boldFont);
  }

  const hasCustomFont = !!regularFont;

  const COMBINING_MARKS = /[̀-ͯ]/g;
  const stripUnsupported = (s: string): string =>
    s.normalize("NFD")
      .replace(COMBINING_MARKS, "")
      .replace(/ł/g, "l").replace(/Ł/g, "L")
      .replace(/—/g, "-")
      .replace(/·/g, ".");

  return {
    hasCustomFont,
    useBold: () => {
      if (boldFont) doc.font("Body-Bold");
    },
    useRegular: () => {
      if (regularFont) doc.font("Body");
    },
    t: (s) => {
      if (!s) return "";
      return hasCustomFont ? s : stripUnsupported(s);
    }
  };
}
