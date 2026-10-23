import test from "node:test";
import assert from "node:assert/strict";
import { AppointmentStore, DomainError } from "../src/domain/appointment-store.js";

const NOW = new Date("2026-10-23T09:00:00+08:00");

test("rescheduling moves the appointment and releases the old slot", () => {
  const store = new AppointmentStore({ now: NOW });
  const appointment = store.getUpcomingAppointments("cus_001")[0];
  const oldSlotId = appointment.slotId;
  const newSlot = store.findAvailableSlots({ limit: 1 })[0];

  const result = store.rescheduleAppointment(appointment.id, newSlot.id, {
    idempotencyKey: "reschedule-test-1"
  });

  assert.equal(result.appointment.slotId, newSlot.id);
  assert.equal(result.appointment.version, 2);
  assert.equal(store.slots.get(newSlot.id).status, "reserved");
  assert.equal(store.slots.get(oldSlotId).status, "available");
  assert.equal(result.opportunity.status, "open");
});

test("rescheduling is idempotent and cannot increment the version twice", () => {
  const store = new AppointmentStore({ now: NOW });
  const appointment = store.getUpcomingAppointments("cus_001")[0];
  const newSlot = store.findAvailableSlots({ limit: 1 })[0];
  const first = store.rescheduleAppointment(appointment.id, newSlot.id, {
    idempotencyKey: "same-request"
  });
  const second = store.rescheduleAppointment(appointment.id, newSlot.id, {
    idempotencyKey: "same-request"
  });

  assert.equal(first.appointment.version, 2);
  assert.equal(second.appointment.version, 2);
});

test("a held slot cannot be double-booked by another customer", () => {
  const store = new AppointmentStore({ now: NOW });
  const appointment = store.getUpcomingAppointments("cus_001")[0];
  const newSlot = store.findAvailableSlots({ limit: 1 })[0];
  store.holdSlot(newSlot.id, "cus_002", 60_000);

  assert.throws(
    () =>
      store.rescheduleAppointment(appointment.id, newSlot.id, {
        idempotencyKey: "blocked-booking"
      }),
    (error) => error instanceof DomainError && error.code === "SLOT_UNAVAILABLE"
  );
});

test("cancelling an appointment creates a reclaimable waitlist opportunity", () => {
  const store = new AppointmentStore({ now: NOW });
  const appointment = store.getUpcomingAppointments("cus_001")[0];
  const oldSlotId = appointment.slotId;
  const result = store.cancelAppointment(appointment.id, {
    idempotencyKey: "cancel-test"
  });

  assert.equal(result.appointment.status, "cancelled");
  assert.equal(result.releasedSlot.id, oldSlotId);
  assert.equal(store.slots.get(oldSlotId).status, "available");
  assert.equal(store.opportunities[0].status, "open");
});

test("a released slot is offered and accepted by a matching waitlist customer", () => {
  const store = new AppointmentStore({ now: NOW });
  const appointment = store.getUpcomingAppointments("cus_001")[0];
  const cancelled = store.cancelAppointment(appointment.id);
  const offered = store.offerWaitlistSlot(cancelled.opportunity.id);

  assert.equal(offered.candidate.customerId, "cus_007");
  assert.equal(offered.opportunity.status, "offered");
  assert.equal(offered.candidate.status, "offered");

  const accepted = store.acceptWaitlistSlot(cancelled.opportunity.id, "cus_007");
  assert.equal(accepted.appointment.status, "confirmed");
  assert.equal(accepted.slot.status, "reserved");
  assert.equal(accepted.opportunity.status, "filled");
  assert.equal(store.getUpcomingAppointments("cus_007").length, 1);
});
