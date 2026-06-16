import { PipelineState } from "../state";
import { TelegramApprovalGate } from "../../approval/telegram-bot";

const gate = new TelegramApprovalGate();

export async function approvalGateNode(
  state: typeof PipelineState.State
): Promise<Partial<typeof PipelineState.State>> {
  const { captions, imageUrl, currentArticle, carouselUrl, quoteCardUrl, videoScript } = state;
  if (!captions || !currentArticle) return {};

  console.log("[approvalGate] Sending to Telegram for review...");

  const decision = await gate.requestApproval({
    id: currentArticle.urlHash,
    article: currentArticle,
    captions,
    imageUrl: imageUrl!,
    carouselUrl: carouselUrl ?? undefined,
    quoteCardUrl: quoteCardUrl ?? undefined,
    videoScript: videoScript ?? undefined,
  });

  console.log(`[approvalGate] Decision: ${decision.status}, scheduleDelay: ${decision.scheduleDelay ?? 0}ms`);

  return {
    approvalStatus: decision.status,
    approvalEdits: decision.edits ?? null,
    scheduleDelay: decision.scheduleDelay ?? 0,
  };
}
