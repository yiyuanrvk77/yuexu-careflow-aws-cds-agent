function parseJson(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function findFirst(value, candidateKeys) {
  const queue = [value];
  const visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);
    for (const key of candidateKeys) {
      if (current[key] !== undefined && current[key] !== null && current[key] !== "") {
        return current[key];
      }
    }
    for (const child of Object.values(current)) {
      if (child && typeof child === "object") queue.push(child);
    }
  }
  return null;
}

function normalizeChannel(channel) {
  const value = String(channel || "").toLowerCase();
  if (value.includes("whatsapp") || value === "social") return "whatsapp";
  if (value.includes("rcs")) return "rcs";
  if (value.includes("email") || value === "ses") return "email";
  return "sms";
}

export function normalizeInboundMessage({ channel, payload, metadata = {} }) {
  const body = parseJson(payload);
  const normalizedChannel = normalizeChannel(channel);
  const whatsAppMessages = normalizedChannel === "whatsapp" ? findFirst(body, ["messages"]) : null;
  const whatsAppMessage = Array.isArray(whatsAppMessages) ? whatsAppMessages[0] : null;
  const from =
    whatsAppMessage?.from ||
    findFirst(body, [
      "from",
      "From",
      "senderId",
      "SenderId",
      "source",
      "Source",
      "originationPhoneNumber",
      "OriginationPhoneNumber"
    ]) || "";
  const to =
    findFirst(body, [
      "to",
      "To",
      "destination",
      "Destination",
      "recipientId",
      "RecipientId",
      "destinationPhoneNumber",
      "DestinationPhoneNumber"
    ]) || "";
  const text =
    whatsAppMessage?.text?.body ||
    whatsAppMessage?.button?.text ||
    whatsAppMessage?.interactive?.button_reply?.title ||
    whatsAppMessage?.interactive?.list_reply?.title ||
    findFirst(body, ["text", "Text", "body", "Body", "messageBody", "MessageBody", "content", "Content"]) ||
    "";
  const externalMessageId =
    whatsAppMessage?.id ||
    findFirst(body, ["messageId", "MessageId", "id", "Id", "eventId", "EventId"]) || null;
  const occurredAt =
    whatsAppMessage?.timestamp ||
    findFirst(body, ["timestamp", "Timestamp", "occurredAt", "CreatedAt", "createdAt"]) ||
    new Date().toISOString();

  return {
    schemaVersion: "1.0",
    channel: normalizedChannel,
    from: typeof from === "string" ? from : "",
    to: typeof to === "string" ? to : "",
    text: typeof text === "string" ? text : JSON.stringify(text),
    externalMessageId,
    occurredAt: String(occurredAt),
    metadata: {
      ...metadata,
      rawPayload: body
    }
  };
}

export function normalizeSnsRecord(record, channelHint) {
  if (!record?.Sns) {
    throw new Error("Expected an SNS record");
  }
  const payload = parseJson(record.Sns.Message);
  return normalizeInboundMessage({
    channel: channelHint,
    payload,
    metadata: {
      topicArn: record.Sns.TopicArn,
      snsMessageId: record.Sns.MessageId,
      subject: record.Sns.Subject || null
    }
  });
}

export function normalizeLambdaChannelEvent(event, channelHint) {
  const records = Array.isArray(event?.Records) ? event.Records : [];
  return records
    .filter((record) => record?.Sns)
    .map((record) => normalizeSnsRecord(record, channelHint));
}
