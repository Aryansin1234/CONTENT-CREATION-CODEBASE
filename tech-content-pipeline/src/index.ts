import "dotenv/config";
import cron from "node-cron";
import { buildPipeline } from "./pipeline/graph";

const pipeline = buildPipeline();

async function runPipeline(): Promise<void> {
  console.log(`\n[${new Date().toISOString()}] ===== Pipeline run started =====`);

  try {
    const result = await pipeline.invoke({});
    console.log(`[${new Date().toISOString()}] Pipeline complete. Posts: ${result.postResults?.length ?? 0}`);
  } catch (err) {
    console.error("[pipeline] Fatal error:", err);
  }

  console.log(`[${new Date().toISOString()}] ===== Pipeline run finished =====\n`);
}

const cronExpression = process.env.PIPELINE_CRON || "0 8,12,17 * * *";
cron.schedule(cronExpression, runPipeline);
console.log(`[scheduler] Pipeline scheduled: ${cronExpression}`);

if (process.argv.includes("--now")) {
  runPipeline();
}
