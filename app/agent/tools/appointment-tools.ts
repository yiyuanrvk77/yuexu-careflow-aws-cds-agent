import { tool, type ToolList } from "@strands-agents/sdk";
import { z } from "zod";
import { AppointmentRepository } from "../domain/repository.js";

function json(value: unknown): string {
  return JSON.stringify(value);
}

function hasExplicitConfirmation(message: string): boolean {
  const normalized = message.trim();
  if (/^(不|不要|别|暂不|先不|don['’]?t|do not|no[, ])/i.test(normalized)) {
    return false;
  }
  if (/^(yes|yep|sure|ok|okay|好的|好|对|正确)$/i.test(normalized)) {
    return true;
  }
  return /(确认|确定|同意|可以改|就这么改|yes[, ]+confirm|confirm|go ahead)/i.test(
    normalized
  );
}

export function createAppointmentTools({
  repository,
  customerIdentifier,
  currentMessage
}: {
  repository: AppointmentRepository;
  customerIdentifier: string;
  currentMessage: string;
}): ToolList {
  async function requireCustomer() {
    const customer = await repository.resolveCustomer(customerIdentifier);
    if (!customer) {
      throw new Error("Customer identity could not be verified");
    }
    return customer;
  }

  const getAppointmentContext = tool({
    name: "get_appointment_context",
    description:
      "Verify the current customer and retrieve their upcoming appointments. Use this before every reschedule or cancellation request.",
    inputSchema: z.object({}),
    callback: async () => {
      const customer = await requireCustomer();
      const appointments = await repository.getUpcomingAppointments(customer.customerId);
      return json({
        customer: {
          name: customer.name,
          preferredChannel: customer.preferredChannel
        },
        appointments: appointments.map((appointment) => ({
          id: appointment.id,
          slotId: appointment.slotId,
          serviceType: appointment.serviceType,
          serviceName: appointment.serviceName,
          date: appointment.date,
          time: appointment.time,
          startsAt: appointment.startsAt,
          status: appointment.status,
          version: appointment.version
        }))
      });
    }
  });

  const findAvailableSlots = tool({
    name: "find_available_slots",
    description:
      "Find available appointment times for a YYYY-MM-DD date. Resolve relative dates such as tomorrow before calling this tool.",
    inputSchema: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      partOfDay: z.enum(["morning", "afternoon", "any"]).default("any"),
      serviceType: z.string().default("dental-cleaning")
    }),
    callback: async ({ date, partOfDay, serviceType }) => {
      await requireCustomer();
      const slots = await repository.findSlots({ date, partOfDay, serviceType });
      return json({
        date,
        partOfDay,
        serviceType,
        slots: slots.map((slot) => ({
          slotId: slot.slotId,
          date: slot.date,
          time: slot.time,
          startsAt: slot.startsAt,
          partOfDay: slot.partOfDay,
          serviceType: slot.serviceType,
          status: slot.status
        }))
      });
    }
  });

  const holdSlot = tool({
    name: "hold_appointment_slot",
    description:
      "Temporarily hold an available slot for five minutes after the customer selects it. A hold is not a confirmed reschedule.",
    inputSchema: z.object({ slotId: z.string().min(1) }),
    callback: async ({ slotId }) => {
      const customer = await requireCustomer();
      const slot = await repository.holdSlot(slotId, customer.customerId);
      return json({
        held: true,
        slotId,
        startsAt: slot.startsAt,
        expiresAt: slot.holdExpiresAt
      });
    }
  });

  const rescheduleAppointment = tool({
    name: "reschedule_appointment",
    description:
      "Atomically move an existing appointment to a held slot. Only call after the customer explicitly confirms the exact new time in the current message.",
    inputSchema: z.object({
      appointmentId: z.string().min(1),
      newSlotId: z.string().min(1)
    }),
    callback: async ({ appointmentId, newSlotId }) => {
      if (!hasExplicitConfirmation(currentMessage)) {
        return json({
          success: false,
          reason: "Explicit customer confirmation is required before rescheduling"
        });
      }
      const customer = await requireCustomer();
      const result = await repository.reschedule(
        appointmentId,
        customer.customerId,
        newSlotId
      );
      return json({ success: true, ...result });
    }
  });

  const cancelAppointment = tool({
    name: "cancel_appointment",
    description:
      "Cancel an existing appointment and release the slot. Only call after the customer explicitly confirms cancellation in the current message.",
    inputSchema: z.object({ appointmentId: z.string().min(1) }),
    callback: async ({ appointmentId }) => {
      if (!hasExplicitConfirmation(currentMessage)) {
        return json({
          success: false,
          reason: "Explicit customer confirmation is required before cancellation"
        });
      }
      const customer = await requireCustomer();
      const result = await repository.cancel(appointmentId, customer.customerId);
      return json({ success: true, ...result });
    }
  });

  const joinWaitlist = tool({
    name: "join_waitlist",
    description:
      "Add the verified customer to the appointment waitlist when no suitable slot is available.",
    inputSchema: z.object({
      serviceType: z.string().default("dental-cleaning"),
      preferredPart: z.enum(["morning", "afternoon", "any"]).default("any")
    }),
    callback: async ({ serviceType, preferredPart }) => {
      const customer = await requireCustomer();
      const result = await repository.joinWaitlist(
        customer.customerId,
        serviceType,
        preferredPart
      );
      return json({ success: true, ...result });
    }
  });

  return [
    getAppointmentContext,
    findAvailableSlots,
    holdSlot,
    rescheduleAppointment,
    cancelAppointment,
    joinWaitlist
  ];
}
