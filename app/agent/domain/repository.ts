import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import type { Appointment, CustomerProfile, Slot } from "./types.js";

const HOLD_MINUTES = 5;

function normalizeIdentity(value: string): string {
  return value.trim().toLowerCase().replace(/[\s()-]/g, "");
}

function slotPk(slotId: string): string {
  return `SLOT#${slotId}`;
}

export class AppointmentRepository {
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClient;

  constructor({ tableName, client }: { tableName?: string; client?: DynamoDBDocumentClient } = {}) {
    const resolvedTable = tableName || process.env.APPOINTMENT_TABLE;
    if (!resolvedTable) throw new Error("APPOINTMENT_TABLE is required");
    this.tableName = resolvedTable;
    this.client =
      client ||
      DynamoDBDocumentClient.from(new DynamoDBClient({}), {
        marshallOptions: { removeUndefinedValues: true }
      });
  }

  async resolveCustomer(identifier: string): Promise<CustomerProfile | null> {
    const identityKey = `IDENTITY#${normalizeIdentity(identifier)}`;
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: identityKey, sk: "PROFILE" },
        ConsistentRead: true
      })
    );
    const customerId = result.Item?.customerId;
    if (!customerId) return null;

    const profile = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `CUSTOMER#${customerId}`, sk: "PROFILE" },
        ConsistentRead: true
      })
    );
    if (!profile.Item) return null;
    return {
      customerId,
      name: String(profile.Item.name || "Customer"),
      phone: String(profile.Item.phone || ""),
      email: String(profile.Item.email || ""),
      preferredChannel: profile.Item.preferredChannel
    };
  }

  async getUpcomingAppointments(customerId: string): Promise<Appointment[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :appointment)",
        ExpressionAttributeNames: { "#pk": "pk", "#sk": "sk" },
        ExpressionAttributeValues: {
          ":pk": `CUSTOMER#${customerId}`,
          ":appointment": "APPOINTMENT#"
        },
        ConsistentRead: true
      })
    );

    return (result.Items || [])
      .filter((item) => item.status === "confirmed" || item.status === "pending")
      .sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)))
      .map((item) => item as Appointment);
  }

  async findSlots({
    date,
    partOfDay = "any",
    serviceType = "dental-cleaning",
    limit = 5
  }: {
    date: string;
    partOfDay?: "morning" | "afternoon" | "any";
    serviceType?: string;
    limit?: number;
  }): Promise<Slot[]> {
    const now = new Date().toISOString();
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "SlotsByDate",
        KeyConditionExpression: "#gsi1pk = :date",
        FilterExpression:
          "(#status = :available OR (#status = :held AND (#heldBy = :empty OR #holdExpiresAt < :now))) AND #startsAt > :now AND #serviceType = :serviceType",
        ExpressionAttributeNames: {
          "#gsi1pk": "gsi1pk",
          "#status": "status",
          "#heldBy": "heldBy",
          "#holdExpiresAt": "holdExpiresAt",
          "#startsAt": "startsAt",
          "#serviceType": "serviceType"
        },
        ExpressionAttributeValues: {
          ":date": `SLOT#${date}`,
          ":available": "available",
          ":held": "held",
          ":empty": "",
          ":now": now,
          ":serviceType": serviceType
        }
      })
    );

    return (result.Items || [])
      .filter((item) => partOfDay === "any" || item.partOfDay === partOfDay)
      .slice(0, Math.max(1, Math.min(limit, 8))) as Slot[];
  }

  async holdSlot(slotId: string, customerId: string): Promise<Slot> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + HOLD_MINUTES * 60_000).toISOString();
    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: slotPk(slotId), sk: "METADATA" },
        UpdateExpression:
          "SET #status = :held, #heldBy = :customer, #holdExpiresAt = :expires, #updatedAt = :now",
        ConditionExpression:
          "attribute_exists(#pk) AND (#status = :available OR (#status = :held AND (#heldBy = :customer OR #holdExpiresAt < :now)))",
        ExpressionAttributeNames: {
          "#pk": "pk",
          "#status": "status",
          "#heldBy": "heldBy",
          "#holdExpiresAt": "holdExpiresAt",
          "#updatedAt": "updatedAt"
        },
        ExpressionAttributeValues: {
          ":available": "available",
          ":held": "held",
          ":customer": customerId,
          ":expires": expiresAt,
          ":now": now.toISOString()
        },
        ReturnValues: "ALL_NEW"
      })
    );
    return result.Attributes as Slot;
  }

  async reschedule(appointmentId: string, customerId: string, newSlotId: string) {
    const appointment = await this.findAppointmentById(customerId, appointmentId);
    if (!appointment) throw new Error("Appointment not found");
    const oldSlotId = appointment.slotId;
    if (oldSlotId === newSlotId) throw new Error("The new time is identical to the current appointment");

    const newSlot = await this.getSlot(newSlotId);
    if (!newSlot) throw new Error("Slot not found");
    if (newSlot.serviceType !== appointment.serviceType) {
      throw new Error("The selected slot belongs to a different service");
    }
    const now = new Date().toISOString();
    const opportunityId = randomUUID();

    await this.client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: this.tableName,
              Key: { pk: slotPk(oldSlotId), sk: "METADATA" },
              UpdateExpression:
                "SET #status = :available, #updatedAt = :now REMOVE #reservedBy, #heldBy, #holdExpiresAt",
              ConditionExpression: "#status = :reserved AND #reservedBy = :customer",
              ExpressionAttributeNames: {
                "#status": "status",
                "#reservedBy": "reservedBy",
                "#heldBy": "heldBy",
                "#holdExpiresAt": "holdExpiresAt",
                "#updatedAt": "updatedAt"
              },
              ExpressionAttributeValues: {
                ":reserved": "reserved",
                ":available": "available",
                ":customer": customerId,
                ":now": now
              }
            }
          },
          {
            Update: {
              TableName: this.tableName,
              Key: { pk: slotPk(newSlotId), sk: "METADATA" },
              UpdateExpression:
                "SET #status = :reserved, #reservedBy = :customer, #updatedAt = :now REMOVE #heldBy, #holdExpiresAt",
              ConditionExpression:
                "#status = :held AND #heldBy = :customer AND #holdExpiresAt > :now",
              ExpressionAttributeNames: {
                "#status": "status",
                "#reservedBy": "reservedBy",
                "#heldBy": "heldBy",
                "#holdExpiresAt": "holdExpiresAt",
                "#updatedAt": "updatedAt"
              },
              ExpressionAttributeValues: {
                ":held": "held",
                ":reserved": "reserved",
                ":customer": customerId,
                ":now": now
              }
            }
          },
          {
            Update: {
              TableName: this.tableName,
              Key: { pk: appointment.pk, sk: appointment.sk },
              UpdateExpression:
                "SET #slotId = :slotId, #startsAt = :startsAt, #status = :confirmed, #updatedAt = :now, #version = if_not_exists(#version, :zero) + :one",
              ConditionExpression:
                "(#status = :confirmed OR #status = :pending) AND #version = :version",
              ExpressionAttributeNames: {
                "#slotId": "slotId",
                "#startsAt": "startsAt",
                "#updatedAt": "updatedAt",
                "#version": "version",
                "#status": "status"
              },
              ExpressionAttributeValues: {
                ":slotId": newSlotId,
                ":startsAt": newSlot.startsAt,
                ":now": now,
                ":zero": 0,
                ":one": 1,
                ":confirmed": "confirmed",
                ":pending": "pending",
                ":version": appointment.version
              }
            }
          },
          {
            Put: {
              TableName: this.tableName,
              Item: {
                pk: "WAITLIST_OPPORTUNITY",
                sk: `${now}#${opportunityId}`,
                id: opportunityId,
                slotId: oldSlotId,
                serviceType: appointment.serviceType,
                status: "open",
                createdAt: now
              },
              ConditionExpression: "attribute_not_exists(#pk)",
              ExpressionAttributeNames: { "#pk": "pk" }
            }
          }
        ]
      })
    );

    return {
      appointmentId,
      previousSlotId: oldSlotId,
      newSlotId,
      startsAt: newSlot.startsAt,
      waitlistOpportunityId: opportunityId
    };
  }

  async cancel(appointmentId: string, customerId: string) {
    const appointment = await this.findAppointmentById(customerId, appointmentId);
    if (!appointment) throw new Error("Appointment not found");
    const now = new Date().toISOString();
    const opportunityId = randomUUID();

    await this.client.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: this.tableName,
              Key: { pk: slotPk(appointment.slotId), sk: "METADATA" },
              UpdateExpression:
                "SET #status = :available, #updatedAt = :now REMOVE #reservedBy, #heldBy, #holdExpiresAt",
              ConditionExpression: "#status = :reserved AND #reservedBy = :customer",
              ExpressionAttributeNames: {
                "#status": "status",
                "#reservedBy": "reservedBy",
                "#heldBy": "heldBy",
                "#holdExpiresAt": "holdExpiresAt",
                "#updatedAt": "updatedAt"
              },
              ExpressionAttributeValues: {
                ":reserved": "reserved",
                ":available": "available",
                ":customer": customerId,
                ":now": now
              }
            }
          },
          {
            Update: {
              TableName: this.tableName,
              Key: { pk: appointment.pk, sk: appointment.sk },
              UpdateExpression:
                "SET #status = :cancelled, #updatedAt = :now, #version = if_not_exists(#version, :zero) + :one",
              ConditionExpression:
                "(#status = :confirmed OR #status = :pending) AND #version = :version",
              ExpressionAttributeNames: {
                "#status": "status",
                "#updatedAt": "updatedAt",
                "#version": "version"
              },
              ExpressionAttributeValues: {
                ":cancelled": "cancelled",
                ":confirmed": "confirmed",
                ":pending": "pending",
                ":now": now,
                ":zero": 0,
                ":one": 1,
                ":version": appointment.version
              }
            }
          },
          {
            Put: {
              TableName: this.tableName,
              Item: {
                pk: "WAITLIST_OPPORTUNITY",
                sk: `${now}#${opportunityId}`,
                id: opportunityId,
                slotId: appointment.slotId,
                serviceType: appointment.serviceType,
                status: "open",
                createdAt: now
              },
              ConditionExpression: "attribute_not_exists(#pk)",
              ExpressionAttributeNames: { "#pk": "pk" }
            }
          }
        ]
      })
    );

    return {
      appointmentId,
      releasedSlotId: appointment.slotId,
      waitlistOpportunityId: opportunityId
    };
  }

  async joinWaitlist(customerId: string, serviceType = "dental-cleaning", preferredPart = "any") {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: "WAITLIST",
          sk: `${serviceType}#${createdAt}#${id}`,
          id,
          customerId,
          serviceType,
          preferredPart,
          status: "waiting",
          createdAt
        }
      })
    );
    return { id, customerId, serviceType, preferredPart, status: "waiting" };
  }

  private async findAppointmentById(customerId: string, appointmentId: string) {
    const appointments = await this.getUpcomingAppointments(customerId);
    return appointments.find((appointment) => appointment.id === appointmentId) || null;
  }

  private async getSlot(slotId: string): Promise<Slot | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: slotPk(slotId), sk: "METADATA" },
        ConsistentRead: true
      })
    );
    return (result.Item as Slot | undefined) || null;
  }
}
