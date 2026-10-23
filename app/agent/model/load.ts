import { BedrockModel } from "@strands-agents/sdk/models/bedrock";

export async function loadModel(): Promise<BedrockModel> {
  return new BedrockModel({
    modelId: process.env.BEDROCK_MODEL_ID || "amazon.nova-pro-v1:0"
  });
}
