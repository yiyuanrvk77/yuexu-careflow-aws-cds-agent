import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  PutCommand
} from "@aws-sdk/lib-dynamodb";

const tableName = process.env.APPOINTMENT_TABLE;
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const timezone = process.env.BUSINESS_TIMEZONE || "Asia/Shanghai";
const demoPhone = process.env.DEMO_PHONE || "+15551234567";
const demoEmail = process.env.DEMO_EMAIL || "demo@example.com";
const waitlistPhone = process.env.WAITLIST_PHONE || "+15551234568";

if (!tableName) {
  console.error("APPOINTMENT_TABLE is required. Read it from the CloudFormation output AppointmentTableName.");
  process.exit(1);
}

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
  marshallOptions: { removeUndefinedValues: true }
});

function normalizeIdentity(value) {
  return value.trim().toLowerCase().replace(/[\s()-]/g, "");
}

function dateParts(date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
}

function dateKey(date) {
  const parts = dateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function startsAt(date, time) {
  const key = dateKey(date);
  if (timezone !== "Asia/Shanghai") {
    throw new Error(
      "The demo seed currently supports BUSINESS_TIMEZONE=Asia/Shanghai. Adjust startsAt before targeting another timezone."
    );
  }
  return new Date(`${key}T${time}:00+08:00`).toISOString();
}

function slotId(date, time) {
  return `slot_${dateKey(date).replaceAll("-", "")}_${time.replace(":", "")}`;
}

async function put(item) {
  await client.send(new PutCommand({ TableName: tableName, Item: item }));
}

async function batchWrite(items) {
  for (let start = 0; start < items.length; start += 25) {
    const chunk = items.slice(start, start + 25);
    let pending = chunk.map((item) => ({ PutRequest: { Item: item } }));
    let attempts = 0;
    while (pending.length && attempts < 8) {
      const result = await client.send(
        new BatchWriteCommand({
          RequestItems: { [tableName]: pending }
        })
      );
      pending = result.UnprocessedItems?.[tableName] || [];
      attempts += 1;
      if (pending.length) await new Promise((resolve) => setTimeout(resolve, 150 * attempts));
    }
    if (pending.length) throw new Error("DynamoDB batch write still has unprocessed items");
  }
}

const now = new Date();
const today = new Date(Date.UTC(Number(dateParts(now).year), Number(dateParts(now).month) - 1, Number(dateParts(now).day)));
const customerId = "demo-customer";
const waitlistCustomerId = "waitlist-customer";
const appointmentDate = addDays(today, 1);
const appointmentSlotId = slotId(appointmentDate, "15:00");

await put({
  pk: `CUSTOMER#${customerId}`,
  sk: "PROFILE",
  entityType: "CUSTOMER",
  customerId,
  name: "Alex Chen",
  phone: demoPhone,
  email: demoEmail,
  preferredChannel: "sms",
  createdAt: now.toISOString()
});
await put({
  pk: `IDENTITY#${normalizeIdentity(demoPhone)}`,
  sk: "PROFILE",
  entityType: "IDENTITY",
  customerId,
  channel: "phone",
  createdAt: now.toISOString()
});
await put({
  pk: `IDENTITY#${normalizeIdentity(demoEmail)}`,
  sk: "PROFILE",
  entityType: "IDENTITY",
  customerId,
  channel: "email",
  createdAt: now.toISOString()
});

await put({
  pk: `CUSTOMER#${waitlistCustomerId}`,
  sk: "PROFILE",
  entityType: "CUSTOMER",
  customerId: waitlistCustomerId,
  name: "Morgan Lee",
  phone: waitlistPhone,
  email: "waitlist@example.com",
  preferredChannel: "sms",
  createdAt: now.toISOString()
});
await put({
  pk: `IDENTITY#${normalizeIdentity(waitlistPhone)}`,
  sk: "PROFILE",
  entityType: "IDENTITY",
  customerId: waitlistCustomerId,
  channel: "phone",
  createdAt: now.toISOString()
});

const slots = [];
const times = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];
for (let dayOffset = 1; dayOffset <= 7; dayOffset += 1) {
  const day = addDays(today, dayOffset);
  for (const time of times) {
    const id = slotId(day, time);
    const isCurrentAppointment = id === appointmentSlotId;
    slots.push({
      pk: `SLOT#${id}`,
      sk: "METADATA",
      entityType: "SLOT",
      slotId: id,
      gsi1pk: `SLOT#${dateKey(day)}`,
      gsi1sk: `${time}#${id}`,
      date: dateKey(day),
      time,
      startsAt: startsAt(day, time),
      partOfDay: Number(time.slice(0, 2)) < 12 ? "morning" : "afternoon",
      serviceType: "dental-cleaning",
      status: isCurrentAppointment ? "reserved" : "available",
      ...(isCurrentAppointment ? { reservedBy: customerId } : {}),
      createdAt: now.toISOString()
    });
  }
}
await batchWrite(slots);

await put({
  pk: `CUSTOMER#${customerId}`,
  sk: `APPOINTMENT#${startsAt(appointmentDate, "15:00")}#demo-appointment`,
  entityType: "APPOINTMENT",
  id: "demo-appointment",
  customerId,
  slotId: appointmentSlotId,
  serviceType: "dental-cleaning",
  serviceName: "Dental cleaning",
  date: dateKey(appointmentDate),
  time: "15:00",
  startsAt: startsAt(appointmentDate, "15:00"),
  status: "confirmed",
  version: 1,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString()
});

await put({
  pk: `CUSTOMER#${waitlistCustomerId}`,
  sk: `APPOINTMENT#${startsAt(addDays(today, 4), "10:00")}#waitlist-customer-appointment`,
  entityType: "APPOINTMENT",
  id: "waitlist-customer-appointment",
  customerId: waitlistCustomerId,
  slotId: slotId(addDays(today, 4), "10:00"),
  serviceType: "dental-cleaning",
  serviceName: "Dental cleaning",
  date: dateKey(addDays(today, 4)),
  time: "10:00",
  startsAt: startsAt(addDays(today, 4), "10:00"),
  status: "cancelled",
  version: 1,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString()
});

console.log(
  JSON.stringify(
    {
      tableName,
      region,
      demoPhone,
      demoEmail,
      appointment: {
        appointmentId: "demo-appointment",
        startsAt: startsAt(appointmentDate, "15:00"),
        slotId: appointmentSlotId
      },
      slotsCreated: slots.length
    },
    null,
    2
  )
);
