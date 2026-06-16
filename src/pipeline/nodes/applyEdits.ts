import OpenAI from "openai";
import { PipelineState } from "../state";
import type { PlatformCaptions } from "../state";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function applyEditsNode(
  state: typeof PipelineState.State
): Promise<Partial<typeof PipelineState.State>> {
  const { captions, approvalEdits } = state;
  if (!captions || !approvalEdits) return {};

  console.log("[applyEdits] Applying edits...");

  // If approvalEdits is an object with caption fields, merge directly
  if (typeof approvalEdits === "object") {
    const updatedCaptions: PlatformCaptions = { ...captions };
    if (approvalEdits.linkedin) updatedCaptions.linkedin = approvalEdits.linkedin;
    if (approvalEdits.instagram) updatedCaptions.instagram = approvalEdits.instagram;
    if (approvalEdits.twitterThread) updatedCaptions.twitterThread = approvalEdits.twitterThread;
    return { captions: updatedCaptions, approvalStatus: "pending" };
  }

  // If it's a text instruction, use GPT-4o to apply the edit
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Apply the requested edits to the social media captions. Return JSON with the same structure: { linkedin, instagram, twitterThread }",
      },
      {
        role: "user",
        content: `Current captions:\n${JSON.stringify(captions, null, 2)}\n\nRequested changes:\n${approvalEdits}`,
      },
    ],
  });

  const updated = JSON.parse(response.choices[0].message.content!) as PlatformCaptions;
  return { captions: updated, approvalStatus: "pending" };
}
