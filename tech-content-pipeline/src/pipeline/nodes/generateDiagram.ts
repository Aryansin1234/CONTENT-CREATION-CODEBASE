import OpenAI from "openai";
import { PipelineState } from "../state";
import { uploadToSupabase } from "../../storage/supabase";
import { renderMermaidWithPuppeteer } from "../../generators/mermaid-puppeteer";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateDiagramNode(
  state: typeof PipelineState.State
): Promise<Partial<typeof PipelineState.State>> {
  const { structuredContent } = state;
  if (!structuredContent?.diagramNeeded) return {};

  console.log("[generateDiagram] Generating Mermaid diagram...");

  // Step 1: GPT-4o generates the Mermaid code
  const mermaidResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `Generate a valid Mermaid diagram for a tech social post.
Rules:
- Use flowchart TD or sequenceDiagram based on the content
- Maximum 12 nodes (must be readable on mobile)
- Use clear, concise labels without jargon
- Return ONLY the raw Mermaid code — no markdown fences, no explanation`,
      },
      {
        role: "user",
        content: `Diagram topic: ${structuredContent.diagramDescription}
Key points: ${structuredContent.keyPoints.join(", ")}`,
      },
    ],
  });

  const mermaidCode = mermaidResponse.choices[0].message.content!.trim();
  console.log("[generateDiagram] Rendering with Puppeteer...");

  // Step 2: Render PNG + PDF via Puppeteer
  const { pngBuffer, pdfBuffer } = await renderMermaidWithPuppeteer(mermaidCode);

  // Step 3: Upload both to Supabase
  const timestamp = Date.now();
  const [imageUrl, pdfUrl] = await Promise.all([
    uploadToSupabase(pngBuffer, `diagrams/${timestamp}.png`, "image/png"),
    uploadToSupabase(pdfBuffer, `pdfs/${timestamp}.pdf`, "application/pdf"),
  ]);

  console.log(`[generateDiagram] Uploaded: ${imageUrl}`);
  return { mermaidCode, imageUrl, pdfUrl };
}
