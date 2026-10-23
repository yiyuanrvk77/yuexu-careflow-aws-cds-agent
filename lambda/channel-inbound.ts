import { createHash, randomUUID } from "node:crypto";
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand
} from "@aws-sdk/client-bedrock-agentcore";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import {
  PinpointSMSVoiceV2Client,
  SendRcsMessageCommand,
  SendTextMessageCommand
} from "@aws-sdk/client-pinpoint-sms-voice-v2";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import {
  SocialMessagingClient,
  SendWhatsAppMessageCommand
} from "@aws-sdk/client-socialmessaging";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
  SQSBatchResponse,
  SQSEvent
} from "aws-lambda";

type Channel = "sms" | "rcs" | "whatsapp" | "email";

interface NormalizedMessage {
  channel: Channel;
  from: string;
  text: string;
  externalMessageId: string;
  receivedAt: string;
  raw: unknown;
}

interface ReplyResult {
  provider: string;
  messageId: string;
  delivered: boolean;
  channel: Channel;
}

const tableName = requireEnv("APPOINTMENT_TABLE");
const runtimeArn = requireEnv("AGENT_RUNTIME_ARN");
const region = process.env.AWS_REGION || "us-east-1";

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
  marshallOptions: { removeUndefinedValues: true }
});
const agentCoreClient = new BedrockAgentCoreClient({ region });
const smsClient = new PinpointSMSVoiceV2Client({ region });
const socialClient = new SocialMessagingClient({ region });
const sesClient = new SESv2Client({ region });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizeIdentity(value: string): string {
  return value.trim().toLowerCase().replace(/[\s()-]/g, "");
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function findFirst(value: unknown, keys: string[]): unknown {
  const queue: unknown[] = [value];
  const seen = new Set<unknown>();
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    const record = current as Record<string, unknown>;
    for (const key of keys) {
      if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
        return record[key];
      }
    }
    for (const child of Object.values(record)) {
      if (child && typeof child === "object") queue.push(child);
    }
  }
  return undefined;
}

function normalizeChannel(value: string): Channel {
  const channel = value.toLowerCase();
  if (channel.includes("whatsapp")) return "whatsapp";
  if (channel.includes("rcs")) return "rcs";
  if (channel.includes("email") || channel.includes("ses")) return "email";
  return "sms";
}

function normalizePayload(payload: unknown, channel: Channel): NormalizedMessage {
  const body = parseJson(payload);
  const whatsappMessages = channel === "whatsapp" ? findFirst(body, ["messages"]) : undefined;
  const whatsappMessage = Array.isArray(whatsappMessages) ? whatsappMessages[0] : undefined;
  const fromValue = whatsappMessage?.from ?? findFirst(body, [
    "from",
    "From",
    "source",
    "Source",
    "senderId",
    "SenderId",
    "originationNumber",
    "OriginationNumber",
    "sourceNumber",
    "SourceNumber",
    "OriginationPhoneNumber"
  ]);
  const textValue =
    whatsappMessage?.text?.body ??
    whatsappMessage?.button?.text ??
    whatsappMessage?.interactive?.button_reply?.title ??
    whatsappMessage?.interactive?.list_reply?.title ??
    findFirst(body, ["text", "Text", "messageBody", "MessageBody", "body", "Body"]);
  const messageIdValue =
    whatsappMessage?.id ??
    findFirst(body, [
      "messageId",
      "MessageId",
      "inboundMessageId",
      "InboundMessageId",
      "id",
      "Id"
    ]);
  const timestampValue =
    whatsappMessage?.timestamp ??
    findFirst(body, ["timestamp", "Timestamp", "createdAt", "CreatedAt"]);

  if (typeof fromValue !== "string" || !fromValue) {
    throw new Error(`Could not determine sender for ${channel} message`);
  }
  if (typeof textValue !== "string" || !textValue.trim()) {
    throw new Error(`Could not determine text for ${channel} message`);
  }

  return {
    channel,
    from: fromValue,
    text: textValue.trim(),
    externalMessageId:
      typeof messageIdValue === "string" ? messageIdValue : `external-${randomUUID()}`,
    receivedAt:
      typeof timestampValue === "string" || typeof timestampValue === "number"
        ? new Date(
            String(timestampValue).length === 10
              ? Number(timestampValue) * 1000
              : timestampValue
          ).toISOString()
        : new Date().toISOString(),
    raw: body
  };
}

function normalizeSqsRecord(record: SQSEvent["Records"][number]): NormalizedMessage {
  const outer = parseJson(record.body) as Record<string, unknown>;
  const topicArn = String(outer.TopicArn || "");
  const channel =
    topicArn === process.env.WHATSAPP_TOPIC_ARN
      ? "whatsapp"
      : topicArn === process.env.RCS_TOPIC_ARN
        ? "rcs"
        : "sms";
  const payload = parseJson(outer.Message ?? outer);
  const message = normalizePayload(payload, channel);
  if (message.externalMessageId.startsWith("external-")) {
    message.externalMessageId = `sns-${String(outer.MessageId || record.messageId)}`;
  }
  return message;
}

function sessionIdFor(customerId: string): string {
  return `yuexu-${createHash("sha256").update(customerId).digest("hex")}`;
}

function actorIdFor(customerId: string): string {
  return `customer-${createHash("sha256").update(customerId).digest("hex").slice(0, 24)}`;
}

async function resolveCanonicalCustomerId(identifier: string): Promise<string> {
  const identity = await documentClient.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `IDENTITY#${normalizeIdentity(identifier)}`,
        sk: "PROFILE"
      },
      ConsistentRead: true
    })
  );
  return String(identity.Item?.customerId || normalizeIdentity(identifier));
}

async function invokeAgent(
  message: NormalizedMessage,
  customerId: string
): Promise<string> {
  const response = await agentCoreClient.send(
    new InvokeAgentRuntimeCommand({
      agentRuntimeArn: runtimeArn,
      runtimeSessionId: sessionIdFor(customerId),
      runtimeUserId: actorIdFor(customerId),
      contentType: "application/json",
      accept: "text/event-stream",
      payload: new TextEncoder().encode(
        JSON.stringify({
          prompt: message.text,
          actorId: actorIdFor(customerId),
          customerIdentifier: message.from,
          channel: message.channel,
          timezone: process.env.BUSINESS_TIMEZONE || "Asia/Shanghai"
        })
      )
    })
  );
  if (!response.response) throw new Error("AgentCore returned an empty response stream");
  const raw = await response.response.transformToString();
  if (response.contentType?.includes("application/json")) {
    const parsed = parseJson(raw) as Record<string, unknown>;
    return String(parsed.reply ?? parsed.response ?? parsed.data ?? parsed.output ?? raw);
  }
  if (response.contentType?.includes("text/event-stream")) {
    const chunks = raw
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter((line) => line && line !== "[DONE]")
      .map((line) => {
        const parsed = parseJson(line);
        if (typeof parsed === "string") return parsed;
        if (parsed && typeof parsed === "object") {
          const record = parsed as Record<string, unknown>;
          if (
            record.data !== undefined ||
            record.response !== undefined ||
            record.text !== undefined
          ) {
            return String(record.data ?? record.response ?? record.text ?? "");
          }
        }
        return line;
      });
    const text = chunks.join("").trim();
    if (text) return text;
  }
  const text = raw.trim();
  if (!text) throw new Error("AgentCore returned no text response");
  return text;
}

async function sendCdsReply(message: NormalizedMessage, text: string): Promise<ReplyResult> {
  if (process.env.SEND_CHANNEL_MESSAGES !== "true") {
    return {
      provider: "disabled",
      messageId: "",
      delivered: false,
      channel: message.channel
    };
  }

  if (message.channel === "sms") {
    return sendSms(message.from, text);
  }
  if (message.channel === "rcs") {
    return sendRcs(message.from, text);
  }
  if (message.channel === "whatsapp") {
    return sendWhatsApp(message.from, text);
  }
  return sendEmail(message.from, text);
}

async function sendSms(to: string, text: string): Promise<ReplyResult> {
  const originationIdentity = process.env.EUM_SMS_ORIGINATION_IDENTITY;
  if (!originationIdentity) throw new Error("EUM_SMS_ORIGINATION_IDENTITY is not configured");
  const response = await smsClient.send(
    new SendTextMessageCommand({
      DestinationPhoneNumber: to,
      OriginationIdentity: originationIdentity,
      MessageBody: text,
      MessageType: "TRANSACTIONAL"
    })
  );
  if (!response.MessageId) throw new Error("AWS End User Messaging did not return a message ID");
  return {
    provider: "aws-end-user-messaging-sms",
    messageId: response.MessageId,
    delivered: true,
    channel: "sms"
  };
}

async function sendRcs(to: string, text: string): Promise<ReplyResult> {
  const originationIdentity = process.env.EUM_RCS_ORIGINATION_IDENTITY;
  const smsIdentity = process.env.EUM_SMS_ORIGINATION_IDENTITY;
  if (!originationIdentity) {
    if (smsIdentity) return sendSms(to, text);
    throw new Error("EUM_RCS_ORIGINATION_IDENTITY is not configured");
  }

  const response = await smsClient.send(
    new SendRcsMessageCommand({
      DestinationPhoneNumber: to,
      OriginationIdentity: originationIdentity,
      MessageTrafficType: "TRANSACTIONAL",
      RcsMessageContent: {
        Content: {
          TextMessage: { Body: text }
        }
      },
      ...(smsIdentity
        ? {
            FallbackConfiguration: {
              Channel: "SMS",
              MessageBody: text,
              OriginationIdentity: smsIdentity
            }
          }
        : {})
    })
  );
  if (!response.MessageId) throw new Error("AWS End User Messaging RCS did not return a message ID");
  return {
    provider: "aws-end-user-messaging-rcs",
    messageId: response.MessageId,
    delivered: true,
    channel: "rcs"
  };
}

async function sendWhatsApp(to: string, text: string): Promise<ReplyResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const metaApiVersion = process.env.WHATSAPP_META_API_VERSION;
  if (!phoneNumberId || !metaApiVersion) {
    throw new Error("WhatsApp phone number ID or Meta API version is not configured");
  }
  const message = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to.replace(/^\+/, ""),
    type: "text",
    text: {
      preview_url: false,
      body: text
    }
  };
  const response = await socialClient.send(
    new SendWhatsAppMessageCommand({
      originationPhoneNumberId: phoneNumberId,
      metaApiVersion,
      message: new TextEncoder().encode(JSON.stringify(message))
    })
  );
  if (!response.messageId) {
    throw new Error("AWS End User Messaging Social did not return a message ID");
  }
  return {
    provider: "aws-end-user-messaging-social",
    messageId: response.messageId,
    delivered: true,
    channel: "whatsapp"
  };
}

async function sendEmail(to: string, text: string): Promise<ReplyResult> {
  const from = process.env.SES_FROM_ADDRESS;
  if (!from) throw new Error("SES_FROM_ADDRESS is not configured");
  const response = await sesClient.send(
    new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: "Yuexu appointment update", Charset: "UTF-8" },
          Body: { Text: { Data: text, Charset: "UTF-8" } }
        }
      }
    })
  );
  if (!response.MessageId) throw new Error("SES did not return a message ID");
  return {
    provider: "amazon-ses",
    messageId: response.MessageId,
    delivered: true,
    channel: "email"
  };
}

async function storeMessage(
  message: NormalizedMessage,
  customerId: string,
  direction: "inbound" | "outbound",
  text: string,
  providerMessageId = ""
) {
  const time = new Date().toISOString();
  const conversationId = createHash("sha256").update(customerId).digest("hex").slice(0, 24);
  await documentClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        pk: `CONVERSATION#${conversationId}`,
        sk: `MESSAGE#${time}#${randomUUID()}`,
        entityType: "MESSAGE",
        conversationId,
        customerId,
        channel: message.channel,
        direction,
        identityHash: createHash("sha256").update(message.from).digest("hex"),
        text,
        externalMessageId: message.externalMessageId,
        providerMessageId,
        createdAt: time,
        expiresAt: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60
      }
    })
  );
}

function idempotencyKey(message: NormalizedMessage): string {
  return `IDEMPOTENCY#${createHash("sha256")
    .update(`${message.channel}|${message.from}|${message.externalMessageId}`)
    .digest("hex")}`;
}

async function claimInboundMessage(message: NormalizedMessage): Promise<{
  duplicate: boolean;
  pk: string;
  result?: Record<string, unknown>;
}> {
  const pk = idempotencyKey(message);
  const now = new Date();
  try {
    await documentClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          pk,
          sk: "INBOUND",
          entityType: "IDEMPOTENCY",
          status: "processing",
          channel: message.channel,
          identityHash: createHash("sha256").update(message.from).digest("hex"),
          externalMessageId: message.externalMessageId,
          startedAt: now.toISOString(),
          expiresAt: Math.floor(now.getTime() / 1000) + 7 * 24 * 60 * 60
        },
        ConditionExpression: "attribute_not_exists(#pk)",
        ExpressionAttributeNames: { "#pk": "pk" }
      })
    );
    return { duplicate: false, pk };
  } catch (error) {
    const name =
      error && typeof error === "object" && "name" in error
        ? String((error as { name?: unknown }).name)
        : "";
    if (name !== "ConditionalCheckFailedException") throw error;

    const existing = await documentClient.send(
      new GetCommand({
        TableName: tableName,
        Key: { pk, sk: "INBOUND" },
        ConsistentRead: true
      })
    );
    if (existing.Item?.status === "completed") {
      return {
        duplicate: true,
        pk,
        result: existing.Item.result as Record<string, unknown> | undefined
      };
    }
    const startedAt = existing.Item?.startedAt
      ? new Date(String(existing.Item.startedAt))
      : new Date(0);
    const staleAfterMs = 5 * 60 * 1000;
    if (
      existing.Item?.status === "processing" &&
      Date.now() - startedAt.getTime() > staleAfterMs
    ) {
      try {
        await documentClient.send(
          new UpdateCommand({
            TableName: tableName,
            Key: { pk, sk: "INBOUND" },
            UpdateExpression:
              "SET #status = :processing, #startedAt = :now, #takenOverAt = :now ADD #attempts :one",
            ConditionExpression: "#status = :processing AND #startedAt = :oldStartedAt",
            ExpressionAttributeNames: {
              "#status": "status",
              "#startedAt": "startedAt",
              "#takenOverAt": "takenOverAt",
              "#attempts": "attempts"
            },
            ExpressionAttributeValues: {
              ":processing": "processing",
              ":now": now.toISOString(),
              ":oldStartedAt": String(existing.Item.startedAt),
              ":one": 1
            }
          })
        );
        return { duplicate: false, pk };
      } catch (takeoverError) {
        const takeoverName =
          takeoverError && typeof takeoverError === "object" && "name" in takeoverError
            ? String((takeoverError as { name?: unknown }).name)
            : "";
        if (takeoverName !== "ConditionalCheckFailedException") throw takeoverError;
      }
    }
    throw new Error("Duplicate inbound message is already being processed");
  }
}

async function completeInboundMessage(pk: string, result: Record<string, unknown>) {
  await documentClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { pk, sk: "INBOUND" },
      UpdateExpression:
        "SET #status = :completed, #result = :result, #completedAt = :now",
      ConditionExpression: "#status = :processing",
      ExpressionAttributeNames: {
        "#status": "status",
        "#result": "result",
        "#completedAt": "completedAt"
      },
      ExpressionAttributeValues: {
        ":completed": "completed",
        ":processing": "processing",
        ":result": result,
        ":now": new Date().toISOString()
      }
    })
  );
}

async function releaseInboundClaim(pk: string) {
  try {
    await documentClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { pk, sk: "INBOUND" },
        ConditionExpression: "#status = :processing",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":processing": "processing" }
      })
    );
  } catch (error) {
    const name =
      error && typeof error === "object" && "name" in error
        ? String((error as { name?: unknown }).name)
        : "";
    if (name !== "ConditionalCheckFailedException") {
      console.error("Failed to release inbound claim; stale takeover will apply later", error);
    }
  }
}

async function acquireConversationLock(customerId: string): Promise<{
  pk: string;
  owner: string;
}> {
  const pk = `CONVERSATION_LOCK#${createHash("sha256")
    .update(customerId)
    .digest("hex")}`;
  const owner = randomUUID();
  const now = new Date();
  try {
    await documentClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          pk,
          sk: "LOCK",
          entityType: "CONVERSATION_LOCK",
          owner,
          acquiredAt: now.toISOString(),
          expiresAt: Math.floor(now.getTime() / 1000) + 90
        },
        ConditionExpression: "attribute_not_exists(#pk) OR #expiresAt < :now",
        ExpressionAttributeNames: {
          "#pk": "pk",
          "#expiresAt": "expiresAt"
        },
        ExpressionAttributeValues: {
          ":now": Math.floor(now.getTime() / 1000)
        }
      })
    );
    return { pk, owner };
  } catch (error) {
    const name =
      error && typeof error === "object" && "name" in error
        ? String((error as { name?: unknown }).name)
        : "";
    if (name === "ConditionalCheckFailedException") {
      throw new Error("Another message in this conversation is already being processed");
    }
    throw error;
  }
}

async function releaseConversationLock(lock: { pk: string; owner: string }) {
  try {
    await documentClient.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { pk: lock.pk, sk: "LOCK" },
        ConditionExpression: "#owner = :owner",
        ExpressionAttributeNames: { "#owner": "owner" },
        ExpressionAttributeValues: { ":owner": lock.owner }
      })
    );
  } catch (error) {
    const name =
      error && typeof error === "object" && "name" in error
        ? String((error as { name?: unknown }).name)
        : "";
    if (name !== "ConditionalCheckFailedException") {
      console.error("Failed to release conversation lock; it will expire by TTL", error);
    }
  }
}

async function processMessage(message: NormalizedMessage) {
  const claim = await claimInboundMessage(message);
  if (claim.duplicate) {
    return {
      requestId: message.externalMessageId,
      duplicate: true,
      ...(claim.result || {})
    };
  }

  let lock: { pk: string; owner: string } | undefined;
  try {
    const canonicalCustomerId = await resolveCanonicalCustomerId(message.from);
    lock = await acquireConversationLock(canonicalCustomerId);

    await storeMessage(message, canonicalCustomerId, "inbound", message.text);
    const reply = await invokeAgent(message, canonicalCustomerId);
    const delivery = await sendCdsReply(message, reply);
    await storeMessage(message, canonicalCustomerId, "outbound", reply, delivery.messageId);
    const result = {
      requestId: message.externalMessageId,
      reply,
      delivery,
      awsRuntime: {
        region,
        agentRuntimeArn: runtimeArn
      }
    };
    await completeInboundMessage(claim.pk, result);
    return result;
  } catch (error) {
    await releaseInboundClaim(claim.pk);
    throw error;
  } finally {
    if (lock) await releaseConversationLock(lock);
  }
}

async function handleApi(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const expectedToken = process.env.DEMO_API_TOKEN;
  const suppliedToken =
    event.headers?.["x-demo-token"] || event.headers?.["X-Demo-Token"] || "";
  if (!expectedToken) {
    return response(503, {
      error: "DEMO_API_TOKEN must be configured before using the test endpoint"
    });
  }
  if (suppliedToken !== expectedToken) {
    return response(401, { error: "Invalid demo token" });
  }
  if (process.env.SEND_CHANNEL_MESSAGES !== "true") {
    return response(503, {
      error: "SEND_CHANNEL_MESSAGES must be true for the judge endpoint"
    });
  }

  try {
    const body = JSON.parse(event.body || "{}") as {
      channel?: string;
      from?: string;
      text?: string;
      messageId?: string;
    };
    if (
      typeof body.channel !== "string" ||
      typeof body.from !== "string" ||
      typeof body.text !== "string" ||
      !body.channel ||
      !body.from ||
      !body.text
    ) {
      return response(400, { error: "channel, from, and text are required" });
    }
    if (!["sms", "rcs", "whatsapp", "email"].includes(body.channel.toLowerCase())) {
      return response(400, { error: "Unsupported channel" });
    }
    if (body.text.length > 2_000) {
      return response(413, { error: "text must be 2000 characters or fewer" });
    }
    const allowed = (process.env.ALLOWED_TEST_NUMBERS || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!allowed.length) {
      return response(503, {
        error: "ALLOWED_TEST_NUMBERS must contain at least one approved test identity"
      });
    }
    if (!allowed.includes(body.from)) {
      return response(403, {
        error: "This test endpoint only sends to configured ALLOWED_TEST_NUMBERS"
      });
    }
    const message = normalizePayload(
      {
        from: body.from,
        text: body.text,
        messageId:
          typeof body.messageId === "string" && body.messageId
            ? body.messageId
            : `api-${randomUUID()}`
      },
      normalizeChannel(body.channel)
    );
    return response(200, await processMessage(message));
  } catch (error) {
    console.error("HTTP invocation failed", error);
    return response(500, {
      error: error instanceof Error ? error.message : "Unknown invocation error"
    });
  }
}

function response(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type,x-demo-token",
      "access-control-allow-methods": "OPTIONS,POST"
    },
    body: JSON.stringify(body)
  };
}

function isHttpEvent(event: unknown): event is APIGatewayProxyEventV2 {
  return Boolean(
    event &&
      typeof event === "object" &&
      "requestContext" in event &&
      "version" in event
  );
}

export async function handler(
  event: SQSEvent | APIGatewayProxyEventV2,
  _context: Context
): Promise<SQSBatchResponse | APIGatewayProxyResultV2> {
  if (isHttpEvent(event)) return handleApi(event);

  const failures: SQSBatchResponse["batchItemFailures"] = [];
  for (const record of event.Records) {
    try {
      const message = normalizeSqsRecord(record);
      await processMessage(message);
    } catch (error) {
      console.error("SQS message failed", {
        messageId: record.messageId,
        error: error instanceof Error ? error.stack : String(error)
      });
      failures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures: failures };
}
