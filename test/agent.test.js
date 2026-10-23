import test from "node:test";
import assert from "node:assert/strict";
import { AppointmentAgent } from "../src/agent/appointment-agent.js";
import { AppointmentStore } from "../src/domain/appointment-store.js";

const NOW = new Date("2026-10-23T09:00:00+08:00");
const CUSTOMER_PHONE = "+8613800000001";

function setup() {
  const store = new AppointmentStore({ now: NOW });
  const agent = new AppointmentAgent(store);
  return { store, agent };
}

test("agent completes reschedule after explicit confirmation", async () => {
  const { store, agent } = setup();
  const before = store.getUpcomingAppointments("cus_001")[0];
  const oldSlotId = before.slotId;

  const optionsResponse = await agent.handleMessage({
    channel: "whatsapp",
    identifier: CUSTOMER_PHONE,
    text: "我明天下午没空，能改到后天上午吗？"
  });
  const optionsMessage = optionsResponse.snapshot.activeConversation.messages.at(-1);
  assert.equal(optionsMessage.kind, "slot_options");
  assert.equal(optionsMessage.quickReplies.length > 0, true);

  const chosenResponse = await agent.handleMessage({
    channel: "whatsapp",
    identifier: CUSTOMER_PHONE,
    text: "选择时段 A"
  });
  const chosenMessage = chosenResponse.snapshot.activeConversation.messages.at(-1);
  assert.equal(chosenMessage.kind, "confirmation");

  const confirmedResponse = await agent.handleMessage({
    channel: "whatsapp",
    identifier: CUSTOMER_PHONE,
    text: "确认改约"
  });
  const appointment = store.getUpcomingAppointments("cus_001")[0];
  assert.notEqual(appointment.slotId, oldSlotId);
  assert.equal(appointment.version, 2);
  assert.match(confirmedResponse.snapshot.activeConversation.messages.at(-1).text, /改约成功/);
  assert.equal(
    confirmedResponse.snapshot.events.some((event) => event.title === "确认函已发送"),
    true
  );
});

test("conversation context continues when the customer switches channel", async () => {
  const { agent } = setup();
  await agent.handleMessage({
    channel: "whatsapp",
    identifier: CUSTOMER_PHONE,
    text: "我想改约"
  });
  const response = await agent.handleMessage({
    channel: "rcs",
    identifier: CUSTOMER_PHONE,
    text: "查看预约"
  });
  const message = response.snapshot.activeConversation.messages.at(-1);
  assert.equal(message.channel, "rcs");
  assert.match(message.text, /下一次预约/);
});

test("agent hands off to staff without losing the appointment context", async () => {
  const { store, agent } = setup();
  const response = await agent.handleMessage({
    channel: "sms",
    identifier: CUSTOMER_PHONE,
    text: "请帮我转人工"
  });
  assert.equal(response.snapshot.activeConversation.status, "human");
  assert.match(response.snapshot.activeConversation.messages.at(-1).text, /转给前台/);
  assert.equal(
    store.events.some((event) => event.metadata?.tool === "handoff_to_staff"),
    true
  );
});
