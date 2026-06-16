import { StateGraph, END } from "@langchain/langgraph";
import { PipelineState } from "./state";
import { ingestNode } from "./nodes/ingest";
import { deduplicateNode } from "./nodes/deduplicate";
import { classifyNode } from "./nodes/classify";
import { structureNode } from "./nodes/structure";
import { visualRouterNode } from "./nodes/visualRouter";
import { generateDiagramNode } from "./nodes/generateDiagram";
import { generateImageNode } from "./nodes/generateImage";
import { generateVideoScriptNode } from "./nodes/generateVideoScript";
import { generateCaptionsNode } from "./nodes/generateCaptions";
import { generateOriginalAngleNode } from "./nodes/generateOriginalAngle";
import { approvalGateNode } from "./nodes/approvalGate";
import { applyEditsNode } from "./nodes/applyEdits";
import { postContentNode } from "./nodes/postContent";
import { analyticsNode } from "./nodes/analytics";

export function buildPipeline() {
  const graph = new StateGraph(PipelineState)

    .addNode("ingest", ingestNode)
    .addNode("deduplicate", deduplicateNode)
    .addNode("classify", classifyNode)
    .addNode("structure", structureNode)
    .addNode("generateVideoScript", generateVideoScriptNode)
    .addNode("visualRouter", visualRouterNode)
    .addNode("generateDiagram", generateDiagramNode)
    .addNode("generateImage", generateImageNode)
    .addNode("generateCaptions", generateCaptionsNode)
    .addNode("generateOriginalAngle", generateOriginalAngleNode)
    .addNode("approvalGate", approvalGateNode)
    .addNode("applyEdits", applyEditsNode)
    .addNode("postContent", postContentNode)
    .addNode("analytics", analyticsNode)

    .addEdge("__start__", "ingest")
    .addEdge("ingest", "deduplicate")
    .addEdge("deduplicate", "classify")
    .addEdge("classify", "structure")

    // Video script runs in parallel with visual generation for eligible content types
    .addConditionalEdges("structure", routeAfterStructure, {
      video_and_visual: "generateVideoScript",
      visual_only: "visualRouter",
    })

    .addEdge("generateVideoScript", "visualRouter")

    .addConditionalEdges("visualRouter", routeVisuals, {
      diagram: "generateDiagram",
      image: "generateImage",
    })

    .addEdge("generateDiagram", "generateCaptions")
    .addEdge("generateImage", "generateCaptions")
    .addEdge("generateCaptions", "generateOriginalAngle")
    .addEdge("generateOriginalAngle", "approvalGate")

    .addConditionalEdges("approvalGate", routeApproval, {
      approved: "postContent",
      edit_requested: "applyEdits",
      rejected: END,
    })

    .addEdge("applyEdits", "approvalGate")
    .addEdge("postContent", "analytics")
    .addEdge("analytics", END);

  return graph.compile();
}

function routeAfterStructure(
  state: typeof PipelineState.State
): "video_and_visual" | "visual_only" {
  const videoTypes = ["tutorial", "tool_spotlight"];
  return videoTypes.includes(state.contentType ?? "") ? "video_and_visual" : "visual_only";
}

function routeVisuals(state: typeof PipelineState.State): "diagram" | "image" {
  return state.structuredContent?.diagramNeeded ? "diagram" : "image";
}

function routeApproval(
  state: typeof PipelineState.State
): "approved" | "edit_requested" | "rejected" {
  if (state.approvalStatus === "approved") return "approved";
  if (state.approvalStatus === "edit_requested") return "edit_requested";
  return "rejected";
}
