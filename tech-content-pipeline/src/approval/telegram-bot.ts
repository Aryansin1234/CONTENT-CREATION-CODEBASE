import TelegramBot from "node-telegram-bot-api";
import type { RawArticle, PlatformCaptions, ApprovalPayload, ApprovalDecision } from "../pipeline/state";
import { recordRejectionReason } from "../monitoring/source-health";

let botInstance: TelegramBot | null = null;

function getBot(): TelegramBot {
  if (!botInstance) {
    botInstance = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });
  }
  return botInstance;
}

const TIME_SLOT_OPTIONS = [
  { text: "Post now", data: "now" },
  { text: "+2 hours", data: "2h" },
  { text: "+4 hours", data: "4h" },
  { text: "Tomorrow 8am", data: "tmr8" },
  { text: "Custom time", data: "custom" },
];

function resolveDelay(slot: string): number {
  const h = 60 * 60 * 1000;
  switch (slot) {
    case "now":  return 0;
    case "2h":   return 2 * h;
    case "4h":   return 4 * h;
    case "tmr8": {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(8, 0, 0, 0);
      return Math.max(0, tomorrow.getTime() - Date.now());
    }
    default: return 0;
  }
}

export class TelegramApprovalGate {
  private chatId = process.env.TELEGRAM_CHAT_ID!;

  async requestApproval(payload: ApprovalPayload): Promise<ApprovalDecision> {
    const bot = getBot();
    const { captions, imageUrl, article } = payload;

    await bot.sendPhoto(this.chatId, imageUrl, {
      caption: `*New Content for Review*\n\n*Source:* ${article.source}\n*Title:* ${article.title}`,
      parse_mode: "Markdown",
    });

    const preview = [
      `*LinkedIn Preview:*\n${captions.linkedin.slice(0, 400)}...`,
      captions.instagram ? `\n*Instagram:*\n${captions.instagram.slice(0, 200)}` : "",
      captions.twitterThread?.length ? `\n*Tweet 1:*\n${captions.twitterThread[0]}` : "",
    ].join("");

    await bot.sendMessage(this.chatId, preview, { parse_mode: "Markdown" });

    await bot.sendMessage(this.chatId, "What would you like to do?", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Approve & Schedule", callback_data: `approve_${payload.id}` },
            { text: "Reject", callback_data: `reject_${payload.id}` },
          ],
          [
            { text: "Edit LinkedIn", callback_data: `edit_li_${payload.id}` },
            { text: "Edit Instagram", callback_data: `edit_ig_${payload.id}` },
            { text: "Edit Tweet", callback_data: `edit_tw_${payload.id}` },
          ],
        ],
      },
    });

    return new Promise((resolve) => {
      const onCallback = async (query: TelegramBot.CallbackQuery) => {
        const data = query.data!;
        if (!data.endsWith(payload.id)) return;

        bot.removeListener("callback_query", onCallback);
        await bot.answerCallbackQuery(query.id);

        if (data.startsWith("approve")) {
          // Show scheduling options
          await bot.sendMessage(this.chatId, "When should this post go live?", {
            reply_markup: {
              inline_keyboard: [
                TIME_SLOT_OPTIONS.slice(0, 3).map((s) => ({
                  text: s.text,
                  callback_data: `slot_${s.data}_${payload.id}`,
                })),
                TIME_SLOT_OPTIONS.slice(3).map((s) => ({
                  text: s.text,
                  callback_data: `slot_${s.data}_${payload.id}`,
                })),
              ],
            },
          });

          const onSlot = async (slotQuery: TelegramBot.CallbackQuery) => {
            const slotData = slotQuery.data!;
            if (!slotData.startsWith("slot_") || !slotData.endsWith(payload.id)) return;
            bot.removeListener("callback_query", onSlot);
            await bot.answerCallbackQuery(slotQuery.id);

            const slot = slotData.replace(`slot_`, "").replace(`_${payload.id}`, "");

            if (slot === "custom") {
              await bot.sendMessage(this.chatId, "Send a time (e.g. 'tomorrow 9am' or '2026-06-20 10:00'):");
              bot.once("message", (msg) => {
                resolve({ status: "approved", scheduleTime: msg.text!, scheduleDelay: 0 });
              });
            } else {
              const delay = resolveDelay(slot);
              await bot.sendMessage(this.chatId, `Scheduled! Will post ${slot === "now" ? "immediately" : `in ~${slot}`}.`);
              resolve({ status: "approved", scheduleDelay: delay });
            }
          };
          bot.on("callback_query", onSlot);

        } else if (data.startsWith("reject")) {
          await bot.sendMessage(
            this.chatId,
            "Why are you rejecting this?\n1 = Off-brand\n2 = Low quality\n3 = Already covered\n4 = Too promotional\n\nReply with the number:"
          );
          bot.once("message", async (msg) => {
            const code = parseInt(msg.text ?? "0", 10);
            if (code >= 1 && code <= 4) {
              await recordRejectionReason(article.urlHash, code).catch(console.error);
            }
            await bot.sendMessage(this.chatId, "Rejected and recorded.");
            resolve({ status: "rejected" });
          });

        } else if (data.startsWith("edit_")) {
          const platform = data.split("_")[1];
          const platformLabel = platform === "li" ? "LinkedIn" : platform === "ig" ? "Instagram" : "Twitter";
          await bot.sendMessage(this.chatId, `Send me the updated ${platformLabel} caption:`);
          bot.once("message", (msg) => {
            const platformKey = platform === "li" ? "linkedin" : platform === "ig" ? "instagram" : "twitterThread";
            resolve({
              status: "edit_requested",
              edits: { [platformKey]: platform === "tw" ? [msg.text!] : msg.text! },
            });
          });
        }
      };

      bot.on("callback_query", onCallback);
    });
  }

  // Phase 5 — Bulk batch review
  async requestBatchApproval(
    payloads: ApprovalPayload[]
  ): Promise<Map<string, ApprovalDecision>> {
    const bot = getBot();
    const decisions = new Map<string, ApprovalDecision>();

    await bot.sendMessage(
      this.chatId,
      `${payloads.length} articles ready for review.\nReply *all* to approve all, or a number (1–${payloads.length}) to review individually.`,
      { parse_mode: "Markdown" }
    );

    // Send a numbered summary
    const summary = payloads
      .map((p, i) => `${i + 1}. ${p.article.title.slice(0, 60)}`)
      .join("\n");
    await bot.sendMessage(this.chatId, summary);

    return new Promise((resolve) => {
      bot.once("message", async (msg) => {
        const text = msg.text?.trim().toLowerCase() ?? "";

        if (text === "all") {
          payloads.forEach((p) => decisions.set(p.id, { status: "approved", scheduleDelay: 0 }));
          await bot.sendMessage(this.chatId, "All approved! Queuing posts...");
          resolve(decisions);
        } else {
          const idx = parseInt(text, 10) - 1;
          if (idx >= 0 && idx < payloads.length) {
            const decision = await this.requestApproval(payloads[idx]);
            decisions.set(payloads[idx].id, decision);
            // Remaining default to pending (caller handles)
          }
          resolve(decisions);
        }
      });
    });
  }

  stopPolling(): void {
    botInstance?.stopPolling();
    botInstance = null;
  }
}
