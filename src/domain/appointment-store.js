import {
  addDays,
  dateKey,
  formatDateShort,
  isoForDateTime,
  relativeDateKey,
  slotIdFor,
  startOfDay
} from "../lib/time.js";

export class DomainError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status;
  }
}

const SLOT_TIMES = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];
const CHANNEL_LABELS = {
  whatsapp: "WhatsApp",
  rcs: "RCS",
  sms: "SMS",
  email: "Email"
};

function normalizeIdentity(value) {
  return String(value || "").trim().toLowerCase();
}

export class AppointmentStore {
  constructor({ now = new Date(), tenant = "澄心口腔 · 静安店" } = {}) {
    this.now = new Date(now);
    this.tenant = tenant;
    this.reset();
  }

  reset() {
    this.slots = new Map();
    this.appointments = new Map();
    this.customers = new Map();
    this.conversations = new Map();
    this.messages = [];
    this.waitlist = [];
    this.opportunities = [];
    this.events = [];
    this.idempotency = new Map();
    this.automationBaseline = 28;
    this.sequence = 1000;

    this.#seedCustomers();
    this.#seedSlots();
    this.#seedAppointments();
    this.#seedWaitlist();
    this.#seedConversations();
    this.addEvent({
      type: "system",
      title: "演示数据已加载",
      detail: "单门店 · 未来 7 天 · 4 个渠道",
      status: "success"
    });
  }

  #nextId(prefix) {
    this.sequence += 1;
    return `${prefix}_${this.sequence}`;
  }

  #seedCustomers() {
    const customers = [
      {
        id: "cus_001",
        name: "张敏",
        initials: "张",
        phone: "+8613800000001",
        email: "min.zhang@example.com",
        preferredChannel: "whatsapp",
        language: "zh-CN",
        tags: ["复诊客户", "高价值"],
        consent: { whatsapp: true, rcs: true, sms: true, email: true }
      },
      {
        id: "cus_002",
        name: "李伟",
        initials: "李",
        phone: "+8613800000002",
        email: "wei.li@example.com",
        preferredChannel: "rcs",
        language: "zh-CN",
        tags: ["洁牙会员"],
        consent: { whatsapp: true, rcs: true, sms: true, email: true }
      },
      {
        id: "cus_003",
        name: "王芳",
        initials: "王",
        phone: "+8613800000003",
        email: "fang.wang@example.com",
        preferredChannel: "sms",
        language: "zh-CN",
        tags: ["家庭会员"],
        consent: { whatsapp: true, rcs: true, sms: true, email: true }
      },
      {
        id: "cus_004",
        name: "陈晨",
        initials: "陈",
        phone: "+8613800000004",
        email: "chen.chen@example.com",
        preferredChannel: "whatsapp",
        language: "zh-CN",
        tags: ["首次到店"],
        consent: { whatsapp: true, rcs: true, sms: true, email: true }
      },
      {
        id: "cus_005",
        name: "刘洋",
        initials: "刘",
        phone: "+8613800000005",
        email: "yang.liu@example.com",
        preferredChannel: "rcs",
        language: "zh-CN",
        tags: ["定期检查"],
        consent: { whatsapp: true, rcs: true, sms: true, email: true }
      },
      {
        id: "cus_006",
        name: "周妍",
        initials: "周",
        phone: "+8613800000006",
        email: "yan.zhou@example.com",
        preferredChannel: "email",
        language: "zh-CN",
        tags: ["术后护理"],
        consent: { whatsapp: true, rcs: true, sms: true, email: true }
      },
      {
        id: "cus_007",
        name: "李雯",
        initials: "李",
        phone: "+8613800000007",
        email: "wen.li@example.com",
        preferredChannel: "whatsapp",
        language: "zh-CN",
        tags: ["候补客户"],
        consent: { whatsapp: true, rcs: true, sms: true, email: true }
      },
      {
        id: "cus_008",
        name: "孙悦",
        initials: "孙",
        phone: "+8613800000008",
        email: "yue.sun@example.com",
        preferredChannel: "sms",
        language: "zh-CN",
        tags: ["候补客户"],
        consent: { whatsapp: true, rcs: true, sms: true, email: true }
      }
    ];

    for (const customer of customers) {
      this.customers.set(customer.id, customer);
    }

    this.serviceTypes = new Map([
      ["svc_cleaning", { id: "svc_cleaning", name: "洁牙护理", durationMinutes: 60 }],
      ["svc_exam", { id: "svc_exam", name: "口腔检查", durationMinutes: 30 }],
      ["svc_followup", { id: "svc_followup", name: "复诊护理", durationMinutes: 30 }]
    ]);
  }

  #seedSlots() {
    const today = startOfDay(this.now);
    for (let offset = 1; offset <= 7; offset += 1) {
      const key = relativeDateKey(this.now, offset);
      for (const time of SLOT_TIMES) {
        const id = slotIdFor(key, time);
        const hour = Number(time.slice(0, 2));
        this.slots.set(id, {
          id,
          dateKey: key,
          time,
          startsAt: isoForDateTime(key, time),
          partOfDay: hour < 12 ? "morning" : "afternoon",
          serviceTypeId: "svc_cleaning",
          status: "available",
          heldBy: null,
          heldUntil: null,
          reservedBy: null
        });
      }
    }

    if (today.getTime() !== this.now.getTime()) {
      this.businessWeekStartsAt = dateKey(addDays(today, 1));
    }
  }

  #seedAppointments() {
    this.#createSeedAppointment("cus_002", 1, "10:00", "svc_exam", "confirmed");
    this.#createSeedAppointment("cus_001", 1, "15:00", "svc_cleaning", "confirmed");
    this.#createSeedAppointment("cus_003", 2, "09:00", "svc_cleaning", "confirmed");
    this.#createSeedAppointment("cus_004", 2, "11:00", "svc_exam", "confirmed");
    this.#createSeedAppointment("cus_005", 3, "14:00", "svc_cleaning", "confirmed");
    this.#createSeedAppointment("cus_006", 4, "10:00", "svc_followup", "confirmed");
    const cancelled = this.#createSeedAppointment("cus_004", 5, "16:00", "svc_cleaning", "confirmed");
    if (cancelled) this.cancelAppointment(cancelled.id);
  }

  #createSeedAppointment(customerId, dayOffset, time, serviceTypeId, status) {
    const key = relativeDateKey(this.now, dayOffset);
    const slotId = slotIdFor(key, time);
    const slot = this.slots.get(slotId);
    if (!slot) return null;

    slot.status = "reserved";
    slot.reservedBy = customerId;
    const appointment = {
      id: this.#nextId("apt"),
      customerId,
      slotId,
      serviceTypeId,
      status,
      channel: this.customers.get(customerId)?.preferredChannel || "sms",
      createdAt: this.now.toISOString(),
      updatedAt: this.now.toISOString(),
      version: 1
    };
    this.appointments.set(appointment.id, appointment);
    return appointment;
  }

  #seedWaitlist() {
    this.waitlist.push(
      {
        id: "wait_001",
        customerId: "cus_007",
        serviceTypeId: "svc_cleaning",
        preferredPart: "afternoon",
        priority: 1,
        status: "waiting",
        createdAt: new Date(this.now.getTime() - 2.2 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "wait_002",
        customerId: "cus_008",
        serviceTypeId: "svc_cleaning",
        preferredPart: "any",
        priority: 2,
        status: "waiting",
        createdAt: new Date(this.now.getTime() - 45 * 60 * 1000).toISOString()
      }
    );
  }

  #seedConversations() {
    const convOne = this.getOrCreateConversation("cus_001", "whatsapp");
    this.addMessage(convOne.id, {
      direction: "agent",
      channel: "whatsapp",
      text: "你好，我是约序预约助理。您可以在这里查询、改约或取消预约。",
      at: new Date(this.now.getTime() - 22 * 60 * 1000).toISOString(),
      status: "delivered"
    });

    const convTwo = this.getOrCreateConversation("cus_007", "whatsapp");
    this.addMessage(convTwo.id, {
      direction: "customer",
      channel: "whatsapp",
      text: "下午的洁牙还有名额吗？有的话帮我留一个。",
      at: new Date(this.now.getTime() - 8 * 60 * 1000).toISOString(),
      status: "read"
    });
    convTwo.unread = 1;

    const convThree = this.getOrCreateConversation("cus_003", "sms");
    this.addMessage(convThree.id, {
      direction: "agent",
      channel: "sms",
      text: "王女士，您的洁牙预约将在后天 09:00 开始，回复“改约”可调整时间。",
      at: new Date(this.now.getTime() - 46 * 60 * 1000).toISOString(),
      status: "delivered"
    });

    const convFour = this.getOrCreateConversation("cus_006", "email");
    this.addMessage(convFour.id, {
      direction: "agent",
      channel: "email",
      text: "复诊护理确认函已发送，请提前 10 分钟到店。",
      at: new Date(this.now.getTime() - 2.3 * 60 * 60 * 1000).toISOString(),
      status: "delivered"
    });
  }

  findCustomerByIdentity(identifier) {
    const normalized = normalizeIdentity(identifier);
    if (!normalized) return null;
    return (
      [...this.customers.values()].find(
        (customer) =>
          normalizeIdentity(customer.phone) === normalized ||
          normalizeIdentity(customer.email) === normalized ||
          normalizeIdentity(customer.name) === normalized
      ) || null
    );
  }

  getCustomer(customerId) {
    return this.customers.get(customerId) || null;
  }

  getOrCreateConversation(customerId, channel = "whatsapp") {
    const existing = [...this.conversations.values()].find(
      (conversation) => conversation.customerId === customerId
    );
    if (existing) {
      if (channel) existing.lastChannel = channel;
      return existing;
    }

    const customer = this.customers.get(customerId);
    if (!customer) throw new DomainError("CUSTOMER_NOT_FOUND", "未找到客户", 404);

    const conversation = {
      id: `conv_${customerId}`,
      customerId,
      lastChannel: channel,
      status: "bot",
      unread: 0,
      createdAt: this.now.toISOString(),
      updatedAt: this.now.toISOString()
    };
    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  getConversationMessages(conversationId) {
    return this.messages
      .filter((message) => message.conversationId === conversationId)
      .sort((a, b) => new Date(a.at) - new Date(b.at));
  }

  addMessage(conversationId, payload) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) throw new DomainError("CONVERSATION_NOT_FOUND", "未找到会话", 404);
    const at = payload.at || new Date().toISOString();
    const message = {
      id: this.#nextId("msg"),
      conversationId,
      direction: payload.direction,
      channel: payload.channel,
      text: String(payload.text || ""),
      kind: payload.kind || "text",
      quickReplies: payload.quickReplies || [],
      traceId: payload.traceId || null,
      status: payload.status || "delivered",
      at
    };
    this.messages.push(message);
    conversation.updatedAt = at;
    conversation.lastChannel = payload.channel || conversation.lastChannel;
    if (payload.direction === "customer") {
      conversation.unread = 0;
    }
    return message;
  }

  addEvent({ type, title, detail, status = "success", conversationId = null, metadata = {} }) {
    const event = {
      id: this.#nextId("evt"),
      type,
      title,
      detail,
      status,
      conversationId,
      metadata,
      at: new Date().toISOString()
    };
    this.events.unshift(event);
    this.events = this.events.slice(0, 100);
    return event;
  }

  getUpcomingAppointments(customerId) {
    return [...this.appointments.values()]
      .filter(
        (appointment) =>
          appointment.customerId === customerId &&
          ["confirmed", "pending"].includes(appointment.status)
      )
      .sort((a, b) => new Date(this.slots.get(a.slotId).startsAt) - new Date(this.slots.get(b.slotId).startsAt));
  }

  purgeExpiredHolds() {
    const now = new Date();
    for (const slot of this.slots.values()) {
      if (slot.status === "held" && slot.heldUntil && new Date(slot.heldUntil) <= now) {
        slot.status = "available";
        slot.heldBy = null;
        slot.heldUntil = null;
      }
    }
  }

  findAvailableSlots({ dayOffset = null, partOfDay = "any", limit = 3 } = {}) {
    this.purgeExpiredHolds();
    const targetKey = dayOffset === null ? null : relativeDateKey(this.now, dayOffset);
    let matches = [...this.slots.values()]
      .filter((slot) => slot.status === "available")
      .filter((slot) => (targetKey ? slot.dateKey === targetKey : true))
      .filter((slot) => (partOfDay !== "any" ? slot.partOfDay === partOfDay : true))
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

    if (matches.length < limit && targetKey) {
      const fallback = [...this.slots.values()]
        .filter((slot) => slot.status === "available")
        .filter((slot) => slot.dateKey !== targetKey)
        .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
      matches = [...matches, ...fallback];
    }

    return matches.slice(0, Math.max(1, limit));
  }

  holdSlot(slotId, customerId, ttlMs = 5 * 60 * 1000) {
    this.purgeExpiredHolds();
    const slot = this.slots.get(slotId);
    if (!slot) throw new DomainError("SLOT_NOT_FOUND", "未找到预约时段", 404);
    if (slot.status === "reserved" && slot.reservedBy === customerId) return slot;
    if (slot.status !== "available") {
      throw new DomainError("SLOT_UNAVAILABLE", "该时段刚刚被占用，请选择其他时间", 409);
    }
    slot.status = "held";
    slot.heldBy = customerId;
    slot.heldUntil = new Date(Date.now() + ttlMs).toISOString();
    return slot;
  }

  releaseHold(slotId, customerId) {
    const slot = this.slots.get(slotId);
    if (!slot) return;
    if (slot.status === "held" && slot.heldBy === customerId) {
      slot.status = "available";
      slot.heldBy = null;
      slot.heldUntil = null;
    }
  }

  rescheduleAppointment(appointmentId, newSlotId, { idempotencyKey } = {}) {
    if (idempotencyKey && this.idempotency.has(idempotencyKey)) {
      return this.idempotency.get(idempotencyKey);
    }

    this.purgeExpiredHolds();
    const appointment = this.appointments.get(appointmentId);
    if (!appointment) throw new DomainError("APPOINTMENT_NOT_FOUND", "未找到预约", 404);
    if (!["confirmed", "pending"].includes(appointment.status)) {
      throw new DomainError("APPOINTMENT_NOT_ACTIVE", "该预约当前不能改约", 409);
    }

    const newSlot = this.slots.get(newSlotId);
    if (!newSlot) throw new DomainError("SLOT_NOT_FOUND", "未找到预约时段", 404);
    const usableForCustomer =
      newSlot.status === "available" ||
      (newSlot.status === "held" && newSlot.heldBy === appointment.customerId);
    if (!usableForCustomer) {
      throw new DomainError("SLOT_UNAVAILABLE", "该时段刚刚被占用，请选择其他时间", 409);
    }
    if (newSlot.id === appointment.slotId) {
      throw new DomainError("SLOT_UNCHANGED", "新旧预约时间相同", 409);
    }

    const oldSlot = this.slots.get(appointment.slotId);
    const oldSlotSnapshot = { ...oldSlot };
    if (oldSlot.status === "reserved" && oldSlot.reservedBy === appointment.customerId) {
      oldSlot.status = "available";
      oldSlot.reservedBy = null;
    }

    newSlot.status = "reserved";
    newSlot.reservedBy = appointment.customerId;
    newSlot.heldBy = null;
    newSlot.heldUntil = null;
    appointment.slotId = newSlot.id;
    appointment.status = "confirmed";
    appointment.updatedAt = new Date().toISOString();
    appointment.version += 1;

    const opportunity = this.releaseSlotToWaitlist(oldSlotSnapshot, appointment.serviceTypeId);
    const result = { appointment, releasedSlot: oldSlotSnapshot, newSlot, opportunity };
    if (idempotencyKey) this.idempotency.set(idempotencyKey, result);

    this.addEvent({
      type: "appointment",
      title: "预约已改期",
      detail: `${this.customers.get(appointment.customerId)?.name || "客户"} · ${formatDateShort(
        newSlot.dateKey,
        this.now
      )} ${newSlot.time}`,
      conversationId: `conv_${appointment.customerId}`,
      metadata: { appointmentId, version: appointment.version }
    });
    return result;
  }

  cancelAppointment(appointmentId, { idempotencyKey } = {}) {
    if (idempotencyKey && this.idempotency.has(idempotencyKey)) {
      return this.idempotency.get(idempotencyKey);
    }

    const appointment = this.appointments.get(appointmentId);
    if (!appointment) throw new DomainError("APPOINTMENT_NOT_FOUND", "未找到预约", 404);
    if (appointment.status === "cancelled") {
      return { appointment, releasedSlot: this.slots.get(appointment.slotId), opportunity: null };
    }

    const slot = this.slots.get(appointment.slotId);
    const releasedSlot = { ...slot };
    if (slot.status === "reserved" && slot.reservedBy === appointment.customerId) {
      slot.status = "available";
      slot.reservedBy = null;
    }
    appointment.status = "cancelled";
    appointment.updatedAt = new Date().toISOString();
    appointment.version += 1;
    const opportunity = this.releaseSlotToWaitlist(releasedSlot, appointment.serviceTypeId);
    const result = { appointment, releasedSlot, opportunity };
    if (idempotencyKey) this.idempotency.set(idempotencyKey, result);
    this.addEvent({
      type: "appointment",
      title: "预约已取消",
      detail: `${this.customers.get(appointment.customerId)?.name || "客户"} · 时段已进入候补队列`,
      conversationId: `conv_${appointment.customerId}`
    });
    return result;
  }

  releaseSlotToWaitlist(slot, serviceTypeId) {
    const opportunity = {
      id: this.#nextId("opp"),
      slotId: slot.id,
      serviceTypeId,
      dateKey: slot.dateKey,
      time: slot.time,
      partOfDay: slot.partOfDay,
      status: "open",
      candidateId: null,
      createdAt: new Date().toISOString()
    };
    this.opportunities.unshift(opportunity);
    this.addEvent({
      type: "waitlist",
      title: "发现可填补时段",
      detail: `${formatDateShort(slot.dateKey, this.now)} ${slot.time} · 等待匹配候补客户`,
      metadata: { opportunityId: opportunity.id }
    });
    return opportunity;
  }

  addWaitlistEntry(customerId, serviceTypeId = "svc_cleaning", preferredPart = "any") {
    const existing = this.waitlist.find(
      (entry) => entry.customerId === customerId && entry.status === "waiting"
    );
    if (existing) return existing;
    const entry = {
      id: this.#nextId("wait"),
      customerId,
      serviceTypeId,
      preferredPart,
      priority: this.waitlist.length + 1,
      status: "waiting",
      createdAt: new Date().toISOString()
    };
    this.waitlist.push(entry);
    return entry;
  }

  offerWaitlistSlot(opportunityId) {
    const opportunity = this.opportunities.find((item) => item.id === opportunityId);
    if (!opportunity) throw new DomainError("OPPORTUNITY_NOT_FOUND", "未找到候补时段", 404);
    if (opportunity.status !== "open") {
      throw new DomainError("OPPORTUNITY_NOT_OPEN", "该候补时段已处理", 409);
    }

    const candidate = this.waitlist
      .filter(
        (entry) =>
          entry.status === "waiting" &&
          entry.serviceTypeId === opportunity.serviceTypeId &&
          (entry.preferredPart === "any" || entry.preferredPart === opportunity.partOfDay)
      )
      .sort((a, b) => a.priority - b.priority)[0];

    if (!candidate) {
      throw new DomainError("NO_WAITLIST_MATCH", "暂时没有匹配的候补客户", 409);
    }

    const customer = this.customers.get(candidate.customerId);
    const conversation = this.getOrCreateConversation(customer.id, customer.preferredChannel);
    const text = `${formatDateShort(opportunity.dateKey, this.now)} ${
      opportunity.time
    } 的洁牙时段刚刚空出，为您保留 15 分钟。回复“接受候补”即可确认。`;
    this.addMessage(conversation.id, {
      direction: "agent",
      channel: customer.preferredChannel,
      text,
      kind: "waitlist_offer",
      quickReplies: [
        { label: "接受候补", value: "接受候补" },
        { label: "本次不需要", value: "放弃候补" }
      ]
    });
    candidate.status = "offered";
    opportunity.status = "offered";
    opportunity.candidateId = candidate.customerId;
    opportunity.offeredAt = new Date().toISOString();
    this.addEvent({
      type: "channel",
      title: "候补邀约已发送",
      detail: `${customer.name} · ${CHANNEL_LABELS[customer.preferredChannel] || customer.preferredChannel}`,
      conversationId: conversation.id,
      metadata: { opportunityId, channel: customer.preferredChannel }
    });

    return { opportunity, candidate, conversation };
  }

  acceptWaitlistSlot(opportunityId, customerId) {
    const opportunity = this.opportunities.find((item) => item.id === opportunityId);
    if (!opportunity) throw new DomainError("OPPORTUNITY_NOT_FOUND", "未找到候补时段", 404);
    if (opportunity.status === "filled" && opportunity.candidateId === customerId) {
      return opportunity;
    }
    if (opportunity.status !== "offered" || opportunity.candidateId !== customerId) {
      throw new DomainError("OPPORTUNITY_NOT_ASSIGNED", "该候补时段未分配给此客户", 409);
    }
    const slot = this.slots.get(opportunity.slotId);
    if (!slot || slot.status !== "available") {
      throw new DomainError("SLOT_UNAVAILABLE", "该时段已被占用", 409);
    }
    slot.status = "reserved";
    slot.reservedBy = customerId;
    const appointment = {
      id: this.#nextId("apt"),
      customerId,
      slotId: slot.id,
      serviceTypeId: opportunity.serviceTypeId,
      status: "confirmed",
      channel: this.customers.get(customerId)?.preferredChannel || "sms",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };
    this.appointments.set(appointment.id, appointment);
    opportunity.status = "filled";
    opportunity.filledAt = new Date().toISOString();
    const entry = this.waitlist.find((item) => item.customerId === customerId && item.status === "offered");
    if (entry) entry.status = "booked";
    this.addEvent({
      type: "appointment",
      title: "候补转化成功",
      detail: `${this.customers.get(customerId)?.name || "客户"} · ${formatDateShort(
        slot.dateKey,
        this.now
      )} ${slot.time}`,
      conversationId: `conv_${customerId}`,
      metadata: { opportunityId }
    });
    return { appointment, opportunity, slot };
  }

  getWaitlistSnapshot() {
    return this.waitlist
      .map((entry) => {
        const customer = this.customers.get(entry.customerId);
        const service = this.serviceTypes.get(entry.serviceTypeId);
        return {
          ...entry,
          customer: customer ? { id: customer.id, name: customer.name, initials: customer.initials } : null,
          service
        };
      })
      .sort((a, b) => {
        const statusRank = { waiting: 0, offered: 1, booked: 2 };
        return (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9) || a.priority - b.priority;
      });
  }

  getOpportunitySnapshot() {
    return this.opportunities.map((opportunity) => ({
      ...opportunity,
      slot: this.slots.get(opportunity.slotId),
      customer: opportunity.candidateId ? this.customers.get(opportunity.candidateId) : null,
      service: this.serviceTypes.get(opportunity.serviceTypeId)
    }));
  }

  getAppointmentSnapshot(customerId = null) {
    return [...this.appointments.values()]
      .filter((appointment) => (customerId ? appointment.customerId === customerId : true))
      .map((appointment) => {
        const slot = this.slots.get(appointment.slotId);
        const customer = this.customers.get(appointment.customerId);
        const service = this.serviceTypes.get(appointment.serviceTypeId);
        return {
          ...appointment,
          slot,
          customer: customer
            ? {
                id: customer.id,
                name: customer.name,
                initials: customer.initials,
                phone: customer.phone,
                email: customer.email
              }
            : null,
          service,
          displayTime: slot ? `${formatDateShort(slot.dateKey, this.now)} ${slot.time}` : ""
        };
      })
      .sort((a, b) => new Date(a.slot?.startsAt || 0) - new Date(b.slot?.startsAt || 0));
  }

  getConversationSnapshot(conversationId) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return null;
    const customer = this.customers.get(conversation.customerId);
    const messages = this.getConversationMessages(conversation.id);
    const lastMessage = messages.at(-1) || null;
    const nextAppointment = this.getUpcomingAppointments(conversation.customerId)[0] || null;
    const slot = nextAppointment ? this.slots.get(nextAppointment.slotId) : null;
    return {
      ...conversation,
      customer,
      messages,
      lastMessage,
      appointmentSummary: nextAppointment
        ? `${formatDateShort(slot.dateKey, this.now)} ${slot.time} · ${
            this.serviceTypes.get(nextAppointment.serviceTypeId)?.name
          }`
        : null
    };
  }

  getConversationList() {
    return [...this.conversations.values()]
      .map((conversation) => this.getConversationSnapshot(conversation.id))
      .filter(Boolean)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  getMetrics() {
    const upcoming = [...this.appointments.values()].filter((appointment) =>
      ["confirmed", "pending"].includes(appointment.status)
    );
    const openOpportunities = this.opportunities.filter((item) =>
      ["open", "offered"].includes(item.status)
    );
    const activeWaitlist = this.waitlist.filter((entry) => ["waiting", "offered"].includes(entry.status));
    const completedActions = this.events.filter(
      (event) => event.type === "appointment" && event.status === "success"
    ).length;
    return {
      upcomingAppointments: upcoming.length,
      activeWaitlist: activeWaitlist.length,
      openOpportunities: openOpportunities.length,
      automationActions: this.automationBaseline + completedActions,
      automationRate: Math.min(92, 68 + completedActions * 2),
      savedMinutes: 146 + completedActions * 11
    };
  }

  getBootstrap({ activeConversationId = "conv_cus_001" } = {}) {
    const conversations = this.getConversationList();
    const activeConversation =
      this.getConversationSnapshot(activeConversationId) || conversations[0] || null;
    return {
      product: {
        name: "约序",
        englishName: "CareFlow",
        tenant: this.tenant,
        environment: "local-demo",
        timezone: "Asia/Shanghai"
      },
      metrics: this.getMetrics(),
      conversations,
      activeConversation,
      appointments: this.getAppointmentSnapshot(),
      waitlist: this.getWaitlistSnapshot(),
      opportunities: this.getOpportunitySnapshot(),
      events: this.events.slice(0, 20),
      integration: {
        mode: "simulation",
        channels: [
          { id: "whatsapp", name: "WhatsApp", configured: true, inbound: "EUM Social · SNS", outbound: "SendWhatsAppMessage" },
          { id: "rcs", name: "RCS", configured: true, inbound: "RCS Agent · SNS", outbound: "SendRcsMessage" },
          { id: "sms", name: "SMS", configured: true, inbound: "Phone pool · SNS", outbound: "SendTextMessage" },
          { id: "email", name: "Email", configured: true, inbound: "SES receipt rule", outbound: "SES SendEmail" }
        ],
        agent: {
          name: "Local agent runtime",
          status: "ready",
          note: "生产工程位于 app/agent，通过 AWS AgentCore Runtime 部署"
        }
      }
    };
  }
}
