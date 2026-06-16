import sharp from "sharp";
import type { StructuredContent } from "../pipeline/state";

export async function generateQuoteCard(content: StructuredContent): Promise<Buffer> {
  // Extract most quotable sentence from keyPoints
  const quote = content.keyPoints[0] ?? content.hook;

  const W = 1080;
  const H = 1080;

  // Build SVG with dark background + stylised typography
  const lines = wrapText(quote, 38);
  const lineHeight = 68;
  const totalTextHeight = lines.length * lineHeight;
  const startY = (H - totalTextHeight) / 2 - 40;

  const linesSvg = lines
    .map((line, i) =>
      `<text x="540" y="${startY + i * lineHeight}" text-anchor="middle" fill="white" font-family="'Helvetica Neue', sans-serif" font-weight="700" font-size="44">${escapeXml(line)}</text>`
    )
    .join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#grad)"/>
  <!-- Left accent bar -->
  <rect x="60" y="${startY - 40}" width="6" height="${totalTextHeight + 60}" rx="3" fill="#6366f1"/>
  <!-- Quote marks -->
  <text x="80" y="${startY - 10}" fill="#6366f1" font-size="120" opacity="0.3" font-family="Georgia, serif">"</text>
  <!-- Quote text -->
  ${linesSvg}
  <!-- Handle watermark -->
  <text x="${W - 80}" y="${H - 60}" text-anchor="end" fill="#475569" font-family="Helvetica, sans-serif" font-size="24">@aryan</text>
  <!-- Bottom accent -->
  <rect x="60" y="${H - 40}" width="${W - 120}" height="4" rx="2" fill="#6366f1" opacity="0.5"/>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if ((current + " " + word).trim().length > maxCharsPerLine) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
