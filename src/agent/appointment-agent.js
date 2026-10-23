import { DomainError } from "../domain/appointment-store.js";
import { formatDateLabel, formatDateShort, relativeDateKey } from "../lib/time.js";

const CHANNEL_LABELS = {
  whatsapp: "WhatsApp",
  rcs: "RCS",
  sms: "SMS",
  email: "Email"
};

const PART_LABELS = {
  morning: "上午",
  afternoon: "下午",
  evening: "晚上"
};

const INTENT_PATTERNS = {
  reschedule: /改约|改期|换时间|调整时间|改到|换到|没空|不能来|reschedule|change.*time/i,
  cancel: /取消预约|取消掉|不去了|cancel/i,
  waitlist: /候补|排队|等空位|waitlist/i,
  status: /预约|几点|什么时候|到店|查一下|查询|appointment/i,
  human: /人工|真人|店员|前台|客服|human/i,
  acceptWaitlist: /接受候补|确认候补|要这个时段|accept.*waitlist/i,
  declineWaitlist: /放弃候补|不需要候补|不用了|decline.*waitlist/i
};

function extractDayOffset(text) {
  const directTarget = text.match(/(?:改到|换到|约到|安排到|targeting)\s*(今天|明天|后天|大后天)/i);
  const candidates = text.match(/今天|明天|后天|大后天/gi) || [];
  const target = directTarget?.[1] || candidates.at(-1);
  if (!target) return null;
  return { 今天: 0, 明天: 1, 后天: 2, 大后天: 3 }[target] ?? null;
}

function extractPartOfDay(text) {
  const parts = text.match(/上午|早上|下午|晚上|早晨/gi) || [];
  const part = parts.at(-1);
  if (!part) return "any";
  if (/上午|早上|早晨/.test(part)) return "morning";
  if (/下午/.test(part)) return "afternoon";
  return "evening";
}

function slotCode(index) {
  return String.fromCharCode(65 + index);
}

export class AppointmentAgent {
  constructor(store) {
    this.store = store;
    this.contexts = new Map();
  }

  reset() {
    this.contexts.clear();
  }

  getContext(customerId) {
    if (!this.contexts.has(customerId)) {
      this.contexts.set(customerId, {
        mode: "idle",
        slots: [],
        appointmentId: null,
        pendingAction: null,
        lastIntent: null
      });
    }
    return this.contexts.get(customerId);
  }

  trace(conversationId, name, title, detail, status = "success") {
    return this.store.addEvent({
      type: "tool",
      title,
      detail,
      status,
      conversationId,
      metadata: { tool: name }
    });
  }

  sendReply({ conversation, channel, text, quickReplies = [], kind = "text", traceId = null }) {
    return this.store.addMessage(conversation.id, {
      direction: "agent",
      channel,
      text,
      quickReplies,
      kind,
      traceId,
      status: channel === "email" ? "sent" : "delivered"
    });
  }

  result(conversation, extras = {}) {
    return {
      conversationId: conversation.id,
      snapshot: this.store.getBootstrap({ activeConversationId: conversation.id }),
      ...extras
    };
  }

  async handleMessage({ channel = "whatsapp", identifier, text }) {
    const cleanText = String(text || "").trim();
    if (!cleanText) {
      throw new DomainError("EMPTY_MESSAGE", "请输入消息内容");
    }

    const customer = this.store.findCustomerByIdentity(identifier);
    if (!customer) {
      throw new DomainError("CUSTOMER_NOT_FOUND", "未找到匹配的客户，请检查手机号或邮箱", 404);
    }

    if (!customer.consent?.[channel]) {
      throw new DomainError("CHANNEL_NOT_CONSENTED", "客户未授权在该渠道沟通", 403);
    }

    const conversation = this.store.getOrCreateConversation(customer.id, channel);
    this.store.addMessage(conversation.id, {
      direction: "customer",
      channel,
      text: cleanText,
      status: "read"
    });
    const context = this.getContext(customer.id);
    const traceId = this.store.addEvent({
      type: "agent",
      title: `收到 ${CHANNEL_LABELS[channel] || channel} 消息`,
      detail: cleanText.length > 46 ? `${cleanText.slice(0, 46)}...` : cleanText,
      conversationId: conversation.id
    }).id;

    if (INTENT_PATTERNS.acceptWaitlist.test(cleanText)) {
      const opportunity = this.store.opportunities.find(
        (item) => item.status === "offered" && item.candidateId === customer.id
      );
      if (!opportunity) {
        this.sendReply({
          conversation,
          channel,
          text: "当前没有为您保留的候补时段。您可以继续排队，我会在有空位时第一时间通知您。",
          quickReplies: [{ label: "加入候补", value: "加入候补" }],
          traceId
        });
        return this.result(conversation);
      }
      const accepted = this.store.acceptWaitlistSlot(opportunity.id, customer.id);
      this.trace(
        conversation.id,
        "accept_waitlist_slot",
        "候补时段已确认",
        `${formatDateShort(accepted.slot.dateKey, this.store.now)} ${accepted.slot.time}`,
        "success"
      );
      this.sendReply({
        conversation,
        channel,
        text: `候补预约已确认：${formatDateShort(
          accepted.slot.dateKey,
          this.store.now
        )} ${accepted.slot.time} 洁牙护理。确认函已同步发送到您的邮箱。`,
        kind: "success",
        traceId
      });
      context.mode = "idle";
      return this.result(conversation);
    }

    if (INTENT_PATTERNS.declineWaitlist.test(cleanText)) {
      const opportunity = this.store.opportunities.find(
        (item) => item.status === "offered" && item.candidateId === customer.id
      );
      if (opportunity) {
        opportunity.status = "open";
        opportunity.candidateId = null;
        const entry = this.store.waitlist.find(
          (item) => item.customerId === customer.id && item.status === "offered"
        );
        if (entry) entry.status = "waiting";
      }
      this.sendReply({
        conversation,
        channel,
        text: "已为您放弃本次候补时段，您仍在候补队列中。",
        traceId
      });
      return this.result(conversation);
    }

    if (INTENT_PATTERNS.human.test(cleanText)) {
      conversation.status = "human";
      this.trace(conversation.id, "handoff_to_staff", "已转人工", "对话上下文与客户身份已同步", "success");
      this.sendReply({
        conversation,
        channel,
        text: "已将您的会话和预约上下文转给前台同事，请稍候。您无需重复描述问题。",
        kind: "handoff",
        traceId
      });
      context.mode = "human";
      return this.result(conversation);
    }

    if (context.mode === "awaiting_reschedule_confirmation") {
      if (/确认|改吧|可以|是的|确定|确认改约/.test(cleanText)) {
        return this.confirmReschedule({ conversation, customer, channel, context, traceId });
      }
      if (/取消|不用|算了|暂不/.test(cleanText)) {
        if (context.pendingAction?.slotId) {
          this.store.releaseHold(context.pendingAction.slotId, customer.id);
        }
        context.mode = "idle";
        context.pendingAction = null;
        this.sendReply({
          conversation,
          channel,
          text: "已取消本次改约，原预约保持不变。",
          quickReplies: [
            { label: "重新选时间", value: "改约" },
            { label: "查看预约", value: "查看预约" }
          ],
          traceId
        });
        return this.result(conversation);
      }
    }

    if (context.mode === "awaiting_cancel_confirmation") {
      if (/确认|取消吧|是的|确定/.test(cleanText) && INTENT_PATTERNS.cancel.test(cleanText)) {
        return this.confirmCancel({ conversation, customer, channel, context, traceId });
      }
      if (/不取消|保留|不用了|算了/.test(cleanText)) {
        context.mode = "idle";
        context.pendingAction = null;
        this.sendReply({
          conversation,
          channel,
          text: "好的，原预约继续保留。",
          traceId
        });
        return this.result(conversation);
      }
    }

    if (context.mode === "awaiting_slot_choice") {
      const choice = cleanText.match(/(?:选择时段|时段|选择)?\s*([A-C1-3])/i);
      if (choice) {
        const token = choice[1].toUpperCase();
        const index = /^[A-C]$/.test(token)
          ? token.charCodeAt(0) - 65
          : Number(token) === 3
            ? 2
            : Number(token) - 1;
        return this.chooseSlot({ conversation, customer, channel, context, index, traceId });
      }
    }

    if (INTENT_PATTERNS.reschedule.test(cleanText)) {
      return this.startReschedule({ conversation, customer, channel, context, text: cleanText, traceId });
    }

    if (INTENT_PATTERNS.cancel.test(cleanText)) {
      const appointment = this.store.getUpcomingAppointments(customer.id)[0];
      if (!appointment) {
        this.sendReply({
          conversation,
          channel,
          text: "当前没有可取消的有效预约。",
          quickReplies: [{ label: "加入候补", value: "加入候补" }],
          traceId
        });
        return this.result(conversation);
      }
      const slot = this.store.slots.get(appointment.slotId);
      context.mode = "awaiting_cancel_confirmation";
      context.pendingAction = { type: "cancel", appointmentId: appointment.id };
      this.trace(conversation.id, "get_upcoming_appointments", "查询有效预约", `${formatDateShort(
        slot.dateKey,
        this.store.now
      )} ${slot.time}`, "success");
      this.sendReply({
        conversation,
        channel,
        text: `您当前预约是 ${formatDateLabel(slot.dateKey, this.store.now)} ${
          slot.time
        } 洁牙护理。取消后该时段会进入候补队列，确认取消吗？`,
        quickReplies: [
          { label: "确认取消预约", value: "确认取消预约" },
          { label: "保留预约", value: "不取消" }
        ],
        kind: "confirmation",
        traceId
      });
      return this.result(conversation);
    }

    if (INTENT_PATTERNS.waitlist.test(cleanText)) {
      const entry = this.store.addWaitlistEntry(customer.id, "svc_cleaning", extractPartOfDay(cleanText));
      this.trace(conversation.id, "join_waitlist", "已加入候补", `优先级 ${entry.priority}`, "success");
      this.sendReply({
        conversation,
        channel,
        text: "已为您加入洁牙候补队列。出现合适空位时，我会通过您偏好的渠道联系您。",
        kind: "success",
        traceId
      });
      return this.result(conversation);
    }

    if (INTENT_PATTERNS.status.test(cleanText)) {
      const appointment = this.store.getUpcomingAppointments(customer.id)[0];
      if (!appointment) {
        this.sendReply({
          conversation,
          channel,
          text: "您目前没有即将到来的预约。可以加入候补，或联系前台安排新时间。",
          quickReplies: [
            { label: "加入候补", value: "加入候补" },
            { label: "联系前台", value: "转人工" }
          ],
          traceId
        });
        return this.result(conversation);
      }
      const slot = this.store.slots.get(appointment.slotId);
      (this.trace(conversation.id, "get_upcoming_appointments", "查询预约", `${formatDateShort(
        slot.dateKey,
        this.store.now
      )} ${slot.time}`, "success"));
      this.sendReply({
        conversation,
        channel,
        text: `您的下一次预约是 ${formatDateLabel(slot.dateKey, this.store.now)} ${
          slot.time
        } · 洁牙护理。需要我帮您改约吗？`,
        quickReplies: [
          { label: "改约", value: "我想改约" },
          { label: "取消预约", value: "取消预约" }
        ],
        traceId
      });
      return this.result(conversation);
    }

    this.sendReply({
      conversation,
      channel,
      text: "我可以帮您查询预约、改约、取消或加入候补。您想办理哪一项？",
      quickReplies: [
        { label: "查看我的预约", value: "查看预约" },
        { label: "我想改约", value: "我想改约" },
        { label: "加入候补", value: "加入候补" },
        { label: "联系前台", value: "转人工" }
      ],
      traceId
    });
    return this.result(conversation);
  }

  startReschedule({ conversation, customer, channel, context, text, traceId }) {
    const appointment = this.store.getUpcomingAppointments(customer.id)[0];
    if (!appointment) {
      this.sendReply({
        conversation,
        channel,
        text: "您目前没有可以改约的有效预约。可以加入候补，或联系前台安排新预约。",
        quickReplies: [
          { label: "加入候补", value: "加入候补" },
          { label: "联系前台", value: "转人工" }
        ],
        traceId
      });
      return this.result(conversation);
    }

    const currentSlot = this.store.slots.get(appointment.slotId);
    this.trace(
      conversation.id,
      "get_upcoming_appointments",
      "验证预约",
      `${formatDateShort(currentSlot.dateKey, this.store.now)} ${currentSlot.time}`,
      "success"
    );

    const dayOffset = extractDayOffset(text);
    const partOfDay = extractPartOfDay(text);
    const slots = this.store.findAvailableSlots({ dayOffset, partOfDay, limit: 3 });
    if (!slots.length) {
      this.sendReply({
        conversation,
        channel,
        text: "这个时间附近暂时没有可用时段，我可以帮您加入候补，或转给前台查询更多时间。",
        quickReplies: [
          { label: "加入候补", value: "加入候补" },
          { label: "联系前台", value: "转人工" }
        ],
        traceId
      });
      return this.result(conversation);
    }

    this.trace(
      conversation.id,
      "search_available_slots",
      "查询可用时段",
      `${slots.length} 个候选时段 · ${partOfDay === "any" ? "不限时段" : PART_LABELS[partOfDay]}`,
      "success"
    );
    context.mode = "awaiting_slot_choice";
    context.slots = slots.map((slot) => slot.id);
    context.appointmentId = appointment.id;
    context.pendingAction = null;
    context.lastIntent = "reschedule";

    const targetCopy =
      dayOffset === null
        ? "接下来几天"
        : `${formatDateLabel(relativeDateKey(this.store.now, dayOffset), this.store.now)}${
            partOfDay === "any" ? "" : PART_LABELS[partOfDay]
          }`;
    this.sendReply({
      conversation,
      channel,
      text: `已找到您 ${formatDateLabel(currentSlot.dateKey, this.store.now)} ${
        currentSlot.time
      } 的洁牙预约。${targetCopy}有以下可约时间，请选择：`,
      kind: "slot_options",
      quickReplies: slots.map((slot, index) => ({
        label: `${slotCode(index)} · ${formatDateShort(slot.dateKey, this.store.now)} ${slot.time}`,
        value: `选择时段 ${slotCode(index)}`
      })),
      traceId
    });
    return this.result(conversation);
  }

  chooseSlot({ conversation, customer, channel, context, index, traceId }) {
    const slotId = context.slots[index];
    if (!slotId) {
      this.sendReply({
        conversation,
        channel,
        text: "没有识别到该选项，请重新选择一个可约时间。",
        quickReplies: context.slots.map((id, itemIndex) => {
          const slot = this.store.slots.get(id);
          return {
            label: `${slotCode(itemIndex)} · ${formatDateShort(slot.dateKey, this.store.now)} ${slot.time}`,
            value: `选择时段 ${slotCode(itemIndex)}`
          };
        }),
        traceId
      });
      return this.result(conversation);
    }

    try {
      const heldSlot = this.store.holdSlot(slotId, customer.id, 5 * 60 * 1000);
      this.trace(
        conversation.id,
        "hold_slot",
        "已锁定候选时段",
        `${formatDateShort(heldSlot.dateKey, this.store.now)} ${heldSlot.time} · 保留 5 分钟`,
        "success"
      );
      context.mode = "awaiting_reschedule_confirmation";
      context.pendingAction = {
        type: "reschedule",
        appointmentId: context.appointmentId,
        slotId
      };
      this.sendReply({
        conversation,
        channel,
        text: `已为您暂时保留 ${formatDateLabel(heldSlot.dateKey, this.store.now)} ${
          heldSlot.time
        }。确认后原预约将被释放，仍需要提交改约吗？`,
        quickReplies: [
          { label: "确认改约", value: "确认改约" },
          { label: "重新选择", value: "改约" }
        ],
        kind: "confirmation",
        traceId
      });
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      this.sendReply({
        conversation,
        channel,
        text: `${error.message}。我可以重新为您查询可用时间。`,
        quickReplies: [{ label: "重新查询", value: "改约" }],
        traceId
      });
      context.mode = "idle";
    }
    return this.result(conversation);
  }

  confirmReschedule({ conversation, customer, channel, context, traceId }) {
    const pending = context.pendingAction;
    if (!pending?.appointmentId || !pending?.slotId) {
      context.mode = "idle";
      this.sendReply({
        conversation,
        channel,
        text: "本次暂存信息已失效，请重新告诉我需要改到什么时间。",
        quickReplies: [{ label: "重新改约", value: "我想改约" }],
        traceId
      });
      return this.result(conversation);
    }

    try {
      const result = this.store.rescheduleAppointment(pending.appointmentId, pending.slotId, {
        idempotencyKey: `reschedule:${conversation.id}:${pending.appointmentId}:${pending.slotId}`
      });
      const newSlot = result.newSlot;
      this.trace(
        conversation.id,
        "reschedule_appointment",
        "改约已提交",
        `版本 ${result.appointment.version} · 时段已原子锁定`,
        "success"
      );
      this.trace(
        conversation.id,
        "release_slot_to_waitlist",
        "原时段已进入候补",
        `${formatDateShort(result.releasedSlot.dateKey, this.store.now)} ${
          result.releasedSlot.time
        }`,
        "success"
      );
      this.trace(
        conversation.id,
        "send_email_confirmation",
        "确认函已发送",
        `${customer.email} · SES`,
        "success"
      );
      context.mode = "idle";
      context.pendingAction = null;
      context.slots = [];
      this.sendReply({
        conversation,
        channel,
        text: `改约成功。新预约时间为 ${formatDateLabel(newSlot.dateKey, this.store.now)} ${
          newSlot.time
        } · 洁牙护理。确认函已发送到 ${customer.email}，原时段已进入候补队列。`,
        kind: "success",
        quickReplies: [
          { label: "查看预约", value: "查看预约" },
          { label: "联系前台", value: "转人工" }
        ],
        traceId
      });
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      context.mode = "idle";
      context.pendingAction = null;
      this.sendReply({
        conversation,
        channel,
        text: `改约没有完成：${error.message}。请重新告诉我方便的时间。`,
        quickReplies: [{ label: "重新改约", value: "我想改约" }],
        traceId
      });
    }
    return this.result(conversation);
  }

  confirmCancel({ conversation, channel, context, traceId }) {
    const pending = context.pendingAction;
    if (!pending?.appointmentId) {
      context.mode = "idle";
      this.sendReply({
        conversation,
        channel,
        text: "本次取消请求已失效，请重新发起。",
        traceId
      });
      return this.result(conversation);
    }
    const result = this.store.cancelAppointment(pending.appointmentId, {
      idempotencyKey: `cancel:${conversation.id}:${pending.appointmentId}`
    });
    this.trace(
      conversation.id,
      "cancel_appointment",
      "预约已取消",
      `${formatDateShort(result.releasedSlot.dateKey, this.store.now)} ${
        result.releasedSlot.time
      }`,
      "success"
    );
    context.mode = "idle";
    context.pendingAction = null;
    this.sendReply({
      conversation,
      channel,
      text: "预约已取消，原时段已进入候补队列。如需重新预约，可以随时告诉我。",
      kind: "success",
      quickReplies: [
        { label: "加入候补", value: "加入候补" },
        { label: "重新预约", value: "改约" }
      ],
      traceId
    });
    return this.result(conversation);
  }
}
