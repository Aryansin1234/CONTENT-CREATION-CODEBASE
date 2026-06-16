import { PipelineState } from "../state";

export async function visualRouterNode(
  state: typeof PipelineState.State
): Promise<Partial<typeof PipelineState.State>> {
  const route = state.structuredContent?.diagramNeeded ? "diagram" : "image";
  console.log(`[visualRouter] Routing to: ${route}`);
  return {};
}
