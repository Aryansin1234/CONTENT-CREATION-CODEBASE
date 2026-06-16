import OpenAI from "openai";
import Replicate from "replicate";
import { PipelineState } from "../state";
import { uploadToSupabase } from "../../storage/supabase";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

const STYLE_MAP: Record<string, string> = {
  news: "photorealistic, dramatic lighting, tech newsroom aesthetic, dark background, neon accents",
  tutorial: "clean infographic style, flat design, dark mode, purple and blue gradients, minimal",
  tool_spotlight: "product showcase, sleek UI screenshot style, gradient background, modern",
  opinion: "bold typography composition, abstract geometric, high contrast, editorial",
  deep_dive: "technical blueprint aesthetic, circuit board details, dark theme, glowing highlights",
};

export async function generateImageNode(
  state: typeof PipelineState.State
): Promise<Partial<typeof PipelineState.State>> {
  const { structuredContent, contentType } = state;
  if (!structuredContent) return {};

  const style = STYLE_MAP[contentType!] || STYLE_MAP.news;
  const prompt = `${structuredContent.imagePrompt}. ${style}. Professional tech social media post. 4K, sharp focus.`;

  console.log("[generateImage] Trying DALL-E 3...");

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
      style: "vivid",
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) throw new Error("DALL-E returned no image URL");
    console.log(`[generateImage] DALL-E success: ${imageUrl}`);
    return { imageUrl };
  } catch (dalleError) {
    console.warn("[generateImage] DALL-E failed, falling back to Replicate SDXL:", (dalleError as Error).message);

    const output = (await replicate.run("stability-ai/sdxl:latest", {
      input: {
        prompt,
        negative_prompt: "blurry, watermark, text overlay, ugly, amateur, low quality",
        width: 1024,
        height: 1024,
        num_outputs: 1,
        scheduler: "DPMSolverMultistep",
        num_inference_steps: 40,
        guidance_scale: 7.5,
      },
    })) as string[];

    const buffer = await fetch(output[0]).then((r) => r.arrayBuffer());
    const imageUrl = await uploadToSupabase(buffer, `images/${Date.now()}.png`, "image/png");

    console.log(`[generateImage] Replicate SDXL success: ${imageUrl}`);
    return { imageUrl };
  }
}
