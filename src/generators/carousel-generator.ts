import PDFDocument from "pdfkit";
import type { StructuredContent } from "../pipeline/state";

export async function generateLinkedInCarousel(content: StructuredContent): Promise<Buffer> {
  const doc = new PDFDocument({ size: [1080, 1080], margin: 0 });
  const buffers: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => buffers.push(chunk));

  const W = 1080;
  const H = 1080;
  const INDIGO = "#6366f1";
  const DARK = "#0f172a";
  const SLATE = "#1e293b";
  const WHITE = "#ffffff";
  const MUTED = "#94a3b8";

  function slide(drawContent: () => void): void {
    drawContent();
    doc.addPage({ size: [W, H], margin: 0 });
  }

  // Slide 1 — Cover
  slide(() => {
    doc.rect(0, 0, W, H).fill(DARK);
    doc.rect(0, H - 8, W, 8).fill(INDIGO);
    doc.fillColor(INDIGO).font("Helvetica-Bold").fontSize(28).text("THREAD", 60, 80);
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(52)
      .text(content.title, 60, 140, { width: W - 120, lineGap: 8 });
    doc.fillColor(MUTED).font("Helvetica").fontSize(24)
      .text(content.hook, 60, 420, { width: W - 120, lineGap: 6 });
    doc.fillColor(MUTED).fontSize(20).text(`For: ${content.targetAudience}`, 60, H - 100);
    doc.fillColor(INDIGO).text("Swipe →", W - 160, H - 100);
  });

  // Slides 2..N-1 — Key points
  content.keyPoints.slice(0, 6).forEach((point, i) => {
    slide(() => {
      doc.rect(0, 0, W, H).fill(DARK);
      doc.rect(0, 0, 8, H).fill(INDIGO);
      // Slide number
      doc.fillColor(INDIGO).font("Helvetica-Bold").fontSize(100)
        .text(String(i + 1), 60, 60, { width: 100 });
      // Point text
      doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(36)
        .text(point, 60, 220, { width: W - 120, lineGap: 10 });
      doc.fillColor(MUTED).fontSize(18).text("Swipe →", W - 160, H - 100);
    });
  });

  // Final slide — CTA
  doc.rect(0, 0, W, H).fill(SLATE);
  doc.rect(0, 0, W, 8).fill(INDIGO);
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(48)
    .text("Save this for later", 60, 300, { width: W - 120, align: "center" });
  doc.fillColor(MUTED).font("Helvetica").fontSize(28)
    .text("Follow for more tech insights like this", 60, 420, { width: W - 120, align: "center" });
  if (content.techStack.length > 0) {
    doc.fillColor(INDIGO).fontSize(20)
      .text(content.techStack.join(" • "), 60, 560, { width: W - 120, align: "center" });
  }

  doc.end();
  await new Promise<void>((resolve) => doc.on("end", resolve));
  return Buffer.concat(buffers);
}
