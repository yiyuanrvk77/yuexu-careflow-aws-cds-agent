export type Channel = "sms" | "rcs" | "whatsapp" | "email";

export interface CustomerProfile {
  customerId: string;
  name: string;
  phone: string;
  email: string;
  preferredChannel?: Channel;
}

export interface Appointment {
  id: string;
  pk: string;
  sk: string;
  customerId: string;
  slotId: string;
  serviceType: string;
  serviceName: string;
  date: string;
  time: string;
  startsAt: string;
  status: "confirmed" | "pending" | "cancelled";
  version: number;
}

export interface Slot {
  pk: string;
  sk: string;
  slotId: string;
  gsi1pk: string;
  gsi1sk: string;
  date: string;
  time: string;
  startsAt: string;
  partOfDay: "morning" | "afternoon";
  serviceType: string;
  status: "available" | "held" | "reserved";
  heldBy?: string;
  holdExpiresAt?: string;
  reservedBy?: string;
}
