import { MemoryManager } from "@strands-agents/sdk";
import { createAgentCoreMemoryStores } from "bedrock-agentcore/experimental/memory/strands";

const memoryId = process.env.MEMORY_AGENTMEMORY_ID;
const memoryManagerCache = new Map<string, MemoryManager>();

export function getOrCreateMemoryManager(sessionId: string, actorId: string): MemoryManager | null {
  if (!memoryId) return null;

  const key = `${actorId}:${sessionId}`;
  const cached = memoryManagerCache.get(key);
  if (cached) return cached;

  const stores = createAgentCoreMemoryStores({
    memoryId,
    actorId,
    sessionId,
    namespaces: [
      { namespace: "/users/{actorId}/facts" },
      { namespace: "/users/{actorId}/preferences" },
      { namespace: "/episodes/{actorId}/{sessionId}" },
      { namespace: "/summaries/{actorId}/{sessionId}" }
    ],
    extraction: true
  });

  const manager = new MemoryManager({ stores });
  if (memoryManagerCache.size >= 200) {
    const oldestKey = memoryManagerCache.keys().next().value;
    if (oldestKey) memoryManagerCache.delete(oldestKey);
  }
  memoryManagerCache.set(key, manager);
  return manager;
}
