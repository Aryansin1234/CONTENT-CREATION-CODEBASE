import PDFDocument from "pdfkit";
import { uploadToSupabase } from "../storage/supabase";
import type { StructuredContent } from "../pipeline/state";

export async function generateLearningPDF(
  content: StructuredContent,
  imageBuffer?: Buffer
): Promise<string> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
    info: { Title: content.title, Author: "TechPipeline Bot" },
  });

  const buffers: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => buffers.push(chunk));

  // Header bar
  doc
    .rect(0, 0, doc.page.width, 120)
    .fill("#0f172a")
    .fillColor("#6366f1")
    .font("Helvetica-Bold")
    .fontSize(24)
    .text(content.title, 50, 35, { width: doc.page.width - 100 })
    .fillColor("#94a3b8")
    .fontSize(12)
    .font("Helvetica")
    .text(`For: ${content.targetAudience}`, 50, 90);

  doc.moveDown(4);

  // Hook callout box
  const hookY = doc.y;
  doc
    .fillColor("#1e293b")
    .rect(50, hookY, doc.page.width - 100, 60)
    .fill()
    .fillColor("#e2e8f0")
    .font("Helvetica-Bold")
    .fontSize(13)
    .text(`${content.hook}`, 65, hookY + 12, { width: doc.page.width - 130 });

  doc.moveDown(3);

  // Summary
  doc
    .fillColor("#334155")
    .font("Helvetica")
    .fontSize(12)
    .text(content.summary, { lineGap: 4 });

  doc.moveDown(1.5);

  // Key Takeaways
  doc.fillColor("#6366f1").font("Helvetica-Bold").fontSize(16).text("Key Takeaways");
  doc.moveDown(0.5);

  content.keyPoints.forEach((point, i) => {
    const pointY = doc.y;
    doc
      .fillColor("#1e293b")
      .circle(64, pointY + 6, 9)
      .fill()
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(String(i + 1), 61, pointY - 1)
      .fillColor("#334155")
      .font("Helvetica")
      .fontSize(12)
      .text(point, 82, pointY, { width: doc.page.width - 132, lineGap: 2 });
    doc.moveDown(0.8);
  });

  // Tech stack chips
  if (content.techStack.length > 0) {
    doc.moveDown(1);
    doc.fillColor("#6366f1").font("Helvetica-Bold").fontSize(14).text("Tech Stack");
    doc.moveDown(0.5);

    let x = 50;
    const startY = doc.y;
    content.techStack.forEach((tech) => {
      const chipWidth = doc.widthOfString(tech) + 20;
      doc.rect(x, startY, chipWidth, 22).fill("#1e293b");
      doc.fillColor("#a5b4fc").font("Helvetica").fontSize(11).text(tech, x + 10, startY + 5);
      x += chipWidth + 8;
      if (x > 450) { x = 50; doc.moveDown(2); }
    });
  }

  // Optional diagram page
  if (imageBuffer) {
    doc.addPage();
    doc.fillColor("#6366f1").font("Helvetica-Bold").fontSize(16).text("Architecture Diagram");
    doc.moveDown(1);
    doc.image(imageBuffer, { width: 500, align: "center" });
  }

  doc.end();

  await new Promise<void>((resolve) => doc.on("end", resolve));
  const pdfBuffer = Buffer.concat(buffers);

  const slug = content.title.slice(0, 30).replace(/[^a-z0-9]/gi, "-").toLowerCase();
  return uploadToSupabase(pdfBuffer, `pdfs/${Date.now()}-${slug}.pdf`, "application/pdf");
}
