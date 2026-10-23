import { BedrockAgentCoreApp } from "bedrock-agentcore/runtime";
import { Agent } from "@strands-agents/sdk";
import { z } from "zod";
import { AppointmentRepository } from "./domain/repository.js";
import { createAppointmentTools } from "./tools/appointment-tools.js";
import { loadModel } from "./model/load.js";
import { getOrCreateMemoryManager } from "./memory/memory.js";

const repository = new AppointmentRepository();

const SYSTEM_PROMPT = `
You are Yuexu, an appointment operations agent for a dental clinic.

Your job is to complete administrative appointment tasks, not provide medical advice.
Use tools for every factual business lookup and every state-changing action.
Never claim that a slot is booked, changed, cancelled, or reserved unless a tool result says it succeeded.

Required workflow:
1. Call get_appointment_context before changing an appointment.
2. Resolve all relative dates using the supplied current date and timezone.
3. For rescheduling, first call find_available_slots and present at most three exact options.
4. After the customer selects a slot, call hold_appointment_slot.
5. Do not reschedule or cancel until the customer explicitly confirms in the current message.
6. Call reschedule_appointment only after that confirmation.
7. If a slot is gone, explain the conflict and search again.
8. Never expose another customer's data.
9. Keep replies concise, plain-text, and suitable for SMS or WhatsApp. Avoid Markdown tables.
10. If the request is clinical, urgent, or outside appointment administration, explain that a team member must follow up. Do not claim that a transfer already happened because the Runtime has no handoff tool.
11. Never expose DynamoDB keys, internal customer IDs, or tool implementation details to the customer.

The tool layer derives the verified customer from the inbound channel identity.
Do not ask the customer to provide an internal customerId.
`;

const requestSchema = z.object({
  prompt: z.string().min(1),
  actorId: z.string().min(1),
  customerIdentifier: z.string().min(1),
  channel: z.enum(["sms", "rcs", "whatsapp", "email"]),
  timezone: z.string().default("Asia/Shanghai")
});

const app = new BedrockAgentCoreApp({
  invocationHandler: {
    requestSchema,
    async *process(payload, context) {
      const sessionId = context?.sessionId ?? `session-${payload.actorId}`;
      const model = await loadModel();
      const tools = createAppointmentTools({
        repository,
        customerIdentifier: payload.customerIdentifier,
        currentMessage: payload.prompt
      });
      const memoryManager = getOrCreateMemoryManager(sessionId, payload.actorId);
      const currentDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: payload.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date());
      const currentTime = new Intl.DateTimeFormat("en-GB", {
        timeZone: payload.timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(new Date());
      const agent = new Agent({
        model,
        systemPrompt: SYSTEM_PROMPT,
        tools,
        memoryManager: memoryManager ?? undefined
      });

      const prompt = [
        `Current date and time: ${currentDate} ${currentTime}`,
        `Timezone: ${payload.timezone}`,
        `Inbound channel: ${payload.channel}`,
        `Customer message: ${payload.prompt}`
      ].join("\n");

      try {
        for await (const event of agent.stream(prompt)) {
          if (
            event.type === "modelStreamUpdateEvent" &&
            event.event?.type === "modelContentBlockDeltaEvent" &&
            event.event.delta?.type === "textDelta"
          ) {
            yield { data: event.event.delta.text };
          }
        }
      } finally {
        await memoryManager?.flush();
      }
    }
  }
});

app.run({ port: Number.parseInt(process.env.PORT ?? "8080", 10) });
