const app = document.getElementById("app");
const toastRegion = document.getElementById("toast-region");

const ICONS = {
  inbox:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="M4 13h4l2 3h4l2-3h4"/></svg>',
  grid:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  users:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  plug:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a6 6 0 0 1-12 0V8z"/></svg>',
  search:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  bell:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>',
  pin:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  chevron:
    '<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 9 5 5 5-5"/></svg>',
  filter:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/></svg>',
  phone:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2.1z"/></svg>',
  send:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
  lock:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  calendar:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  spark:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 1.5 4.2L18 9l-4.5 1.8L12 15l-1.5-4.2L6 9l4.5-1.8z"/><path d="m19 16 .7 1.8L22 18.5l-2.3.7L19 21l-.7-1.8-2.3-.7 2.3-.7z"/></svg>',
  refresh:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
  arrow:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
  mail:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>'
};

const CHANNEL_NAMES = {
  whatsapp: "WhatsApp",
  rcs: "RCS",
  sms: "SMS",
  email: "Email"
};

const CHANNEL_CODES = {
  whatsapp: "W",
  rcs: "R",
  sms: "S",
  email: "M"
};

const AVATAR_CLASSES = ["jade", "sand", "blue", "rose", "violet"];
const VIEWS = ["inbox", "overview", "waitlist", "integrations"];

const state = {
  view: VIEWS.includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : "inbox",
  snapshot: null,
  activeConversationId: "conv_cus_001",
  channel: "whatsapp",
  busy: false
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

function icon(name) {
  return ICONS[name] || "";
}

function avatarClass(value = "") {
  const total = [...String(value)].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return AVATAR_CLASSES[total % AVATAR_CLASSES.length];
}

function initials(name = "") {
  return String(name).trim().slice(0, 1) || "客";
}

function channelIcon(channel, compact = false) {
  return `<span class="channel-icon ${escapeAttribute(channel)}" ${
    compact ? 'aria-hidden="true"' : `title="${CHANNEL_NAMES[channel] || channel}"`
  }>${CHANNEL_CODES[channel] || "?"}</span>`;
}

function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function relativeTime(value) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时`;
  return `${Math.round(hours / 24)} 天`;
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 3300);
}

function activeConversation() {
  return (
    state.snapshot?.conversations.find(
      (conversation) => conversation.id === state.activeConversationId
    ) ||
    state.snapshot?.activeConversation ||
    null
  );
}

function identifierFor(conversation, channel) {
  if (!conversation?.customer) return "";
  return channel === "email" ? conversation.customer.email : conversation.customer.phone;
}

function metricCard(label, value, unit, foot, tone = "jade") {
  const paths = {
    jade: "M1 15 C5 14, 7 10, 10 11 S15 17, 20 9 S27 5, 31 4",
    sand: "M1 12 C5 14, 7 14, 10 10 S15 7, 20 10 S27 15, 31 8",
    blue: "M1 16 C5 13, 7 15, 10 12 S15 6, 20 9 S27 4, 31 6",
    violet: "M1 14 C5 15, 7 11, 10 12 S15 15, 20 10 S27 7, 31 5"
  };
  return `
    <article class="metric-card">
      <div class="metric-top">
        <span class="metric-label">${escapeHtml(label)}</span>
        <svg class="metric-spark" viewBox="0 0 32 20" aria-hidden="true">
          <path d="${paths[tone]}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="metric-value">${escapeHtml(value)}<span>${escapeHtml(unit)}</span></div>
      <div class="metric-foot">${escapeHtml(foot)}</div>
    </article>
  `;
}

function renderMetrics() {
  const metrics = state.snapshot.metrics;
  return `
    <section class="metrics-grid" aria-label="运营指标">
      ${metricCard("未来 7 天预约", metrics.upcomingAppointments, "个", "较上周同期 +12.4%", "jade")}
      ${metricCard("候补队列", metrics.activeWaitlist, "人", "2 人适合当前空档", "sand")}
      ${metricCard("待填补时段", metrics.openOpportunities, "个", "平均响应 6 分钟", "blue")}
      ${metricCard("自动处理率", metrics.automationRate, "%", `本周节省约 ${metrics.savedMinutes} 分钟`, "violet")}
    </section>
  `;
}

function renderSidebar() {
  const metrics = state.snapshot.metrics;
  return `
    <aside class="sidebar" aria-label="主导航">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">约</div>
        <div class="brand-copy">
          <strong>约序</strong>
          <span>CareFlow Agent</span>
        </div>
      </div>
      <div class="sidebar-label">运营工作台</div>
      <nav class="sidebar-nav">
        <button class="nav-item ${state.view === "inbox" ? "active" : ""}" data-nav="inbox" type="button">
          ${icon("inbox")}
          <span>统一收件箱</span>
          <span class="nav-count">${state.snapshot.conversations.filter((item) => item.unread).length}</span>
        </button>
        <button class="nav-item ${state.view === "overview" ? "active" : ""}" data-nav="overview" type="button">
          ${icon("grid")}
          <span>预约总览</span>
        </button>
        <button class="nav-item ${state.view === "waitlist" ? "active" : ""}" data-nav="waitlist" type="button">
          ${icon("users")}
          <span>候补管理</span>
          <span class="nav-count">${metrics.activeWaitlist}</span>
        </button>
        <button class="nav-item ${state.view === "integrations" ? "active" : ""}" data-nav="integrations" type="button">
          ${icon("plug")}
          <span>渠道与运行时</span>
        </button>
      </nav>
      <div class="sidebar-spacer"></div>
      <div class="runtime-card">
        <div class="runtime-head"><span class="live-dot"></span> Agent 运行正常</div>
        <p>本地业务演示 · 4 个渠道模拟<br />AWS AgentCore 工程已构建</p>
      </div>
    </aside>
  `;
}

function renderTopbar() {
  return `
    <header class="topbar">
      <button class="location-switcher" type="button" data-action="location" aria-label="切换门店">
        <span class="location-icon">${icon("pin")}</span>
        <span>${escapeHtml(state.snapshot.product.tenant)}</span>
        ${icon("chevron")}
      </button>
      <div class="topbar-spacer"></div>
      <span class="demo-pill">演示环境 · 真实业务状态机</span>
      <span class="mode-pill">${escapeHtml(state.snapshot.integration.agent.name)}</span>
      <button class="icon-button" type="button" data-action="reset" aria-label="重置演示数据" title="重置演示数据">
        ${icon("refresh")}
      </button>
      <button class="icon-button" type="button" data-action="notifications" aria-label="通知" title="通知">
        ${icon("bell")}
      </button>
      <div class="user-chip" aria-label="当前用户">
        <span class="avatar jade">沈</span>
        <div>
          <strong>沈然</strong>
          <span>门店运营</span>
        </div>
      </div>
    </header>
  `;
}

function renderPageHeading(eyebrow, title, note) {
  return `
    <div class="page-heading">
      <div class="page-heading-copy">
        <div class="eyebrow">${escapeHtml(eyebrow)}</div>
        <h1>${escapeHtml(title)}</h1>
      </div>
      <p class="heading-note">${escapeHtml(note)}</p>
    </div>
  `;
}

function renderConversationList() {
  const conversations = state.snapshot.conversations;
  return `
    <section class="conversation-panel" aria-label="会话列表">
      <div class="panel-heading">
        <h2>统一收件箱</h2>
        <span class="counter">${conversations.length}</span>
        <button class="conversation-filter" type="button" aria-label="筛选会话" data-action="filter">
          ${icon("filter")}
        </button>
      </div>
      <div class="conversation-list">
        ${conversations
          .map((conversation) => {
            const customer = conversation.customer;
            const last = conversation.lastMessage;
            return `
              <button
                type="button"
                class="conversation-item ${conversation.id === state.activeConversationId ? "active" : ""}"
                data-conversation="${escapeAttribute(conversation.id)}"
                aria-label="打开 ${escapeAttribute(customer?.name || "客户")} 的会话"
              >
                <span class="avatar ${avatarClass(customer?.id)}">${escapeHtml(
                  customer?.initials || initials(customer?.name)
                )}</span>
                <span class="conversation-meta">
                  <strong>${escapeHtml(customer?.name || "客户")}</strong>
                  ${channelIcon(conversation.lastChannel, true)}
                  <span class="conversation-time">${last ? relativeTime(last.at) : ""}</span>
                </span>
                <span>${conversation.unread ? '<span class="unread-dot" aria-label="未读"></span>' : ""}</span>
                <span class="conversation-snippet">${escapeHtml(last?.text || conversation.appointmentSummary || "暂无消息")}</span>
              </button>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderMessages(conversation) {
  const messages = conversation.messages || [];
  if (!messages.length) {
    return `<div class="empty-state"><strong>开始一段预约对话</strong>试试发送“我想改约”。</div>`;
  }
  const lastAgentMessageId = [...messages]
    .reverse()
    .find((message) => message.direction === "agent")?.id;
  return messages
    .map((message) => {
      const isCustomer = message.direction === "customer";
      const quickReplies =
        !isCustomer && message.id === lastAgentMessageId && message.quickReplies?.length
          ? `<div class="quick-replies">${message.quickReplies
              .map(
                (reply) =>
                  `<button type="button" class="quick-reply" data-quick="${escapeAttribute(
                    reply.value
                  )}">${escapeHtml(reply.label)}</button>`
              )
              .join("")}</div>`
          : "";
      return `
        <div class="message-row ${isCustomer ? "customer" : "agent"}">
          ${
            isCustomer
              ? ""
              : `<span class="message-avatar" aria-hidden="true">约</span>`
          }
          <div class="message-stack">
            <div class="message-meta">
              <span>${isCustomer ? "客户" : "约序 Agent"}</span>
              ${channelIcon(message.channel, true)}
              <span>${formatTime(message.at)}</span>
              ${isCustomer ? "" : `<span>· ${message.status === "sent" ? "已提交" : "已送达"}</span>`}
            </div>
            <div class="message-bubble ${escapeAttribute(message.kind || "")}">${escapeHtml(message.text)}</div>
            ${quickReplies}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderStarterPrompts(conversation) {
  const hasCustomerMessage = conversation.messages?.some(
    (message) => message.direction === "customer"
  );
  if (hasCustomerMessage) return "";
  return `
    <div class="starter-prompts">
      <p>选择一个常见任务，立即体验完整业务动作</p>
      <div class="starter-actions">
        <button type="button" class="quick-reply" data-quick="我明天下午没空，能改到后天上午吗？">改约预约</button>
        <button type="button" class="quick-reply" data-quick="查看预约">查看预约</button>
        <button type="button" class="quick-reply" data-quick="加入候补">加入候补</button>
        <button type="button" class="quick-reply" data-quick="转人工">联系前台</button>
      </div>
    </div>
  `;
}

function renderChatPanel(conversation) {
  if (!conversation) {
    return `<section class="chat-panel"><div class="empty-state"><strong>选择一个会话</strong>客户上下文会显示在这里。</div></section>`;
  }
  const customer = conversation.customer;
  const channels = ["whatsapp", "rcs", "sms", "email"];
  return `
    <section class="chat-panel" aria-label="与 ${escapeAttribute(customer?.name || "客户")} 的对话">
      <div class="chat-header">
        <span class="avatar ${avatarClass(customer?.id)}">${escapeHtml(customer?.initials)}</span>
        <div class="chat-person">
          <h2>${escapeHtml(customer?.name || "客户")}</h2>
          <p>${escapeHtml(customer?.phone || "")} · ${
            conversation.status === "human" ? "人工接管中" : "Agent 处理中"
          }</p>
        </div>
        <div class="chat-actions">
          <div class="channel-switcher" role="group" aria-label="模拟入站渠道">
            ${channels
              .map(
                (channel) =>
                  `<button type="button" class="channel-choice ${
                    state.channel === channel ? "active" : ""
                  }" data-channel="${channel}" title="${CHANNEL_NAMES[channel]}" aria-pressed="${
                    state.channel === channel
                  }">${CHANNEL_NAMES[channel].replace("WhatsApp", "WA").replace("Email", "邮件")}</button>`
              )
              .join("")}
          </div>
          <button class="icon-button" type="button" data-action="handoff" aria-label="转人工" title="转人工">
            ${icon("phone")}
          </button>
        </div>
      </div>
      <div class="mobile-conversation-bar">
        <label for="mobile-conversation-select">切换客户</label>
        <select id="mobile-conversation-select" aria-label="切换客户会话">
          ${state.snapshot.conversations
            .map(
              (item) =>
                `<option value="${escapeAttribute(item.id)}" ${
                  item.id === conversation.id ? "selected" : ""
                }>${escapeHtml(item.customer?.name || "客户")} · ${escapeHtml(
                  CHANNEL_NAMES[item.lastChannel]
                )}</option>`
            )
            .join("")}
        </select>
      </div>
      <div class="messages" id="messages" aria-live="polite">
        <div class="date-divider">同一客户上下文 · 可跨渠道继续</div>
        ${renderMessages(conversation)}
        ${renderStarterPrompts(conversation)}
        ${
          state.busy
            ? `<div class="message-row agent"><span class="message-avatar">约</span><div class="message-stack"><div class="message-meta"><span>约序 Agent</span><span>正在处理</span></div><div class="message-bubble"><span class="typing-indicator"><span></span><span></span><span></span></span></div></div></div>`
            : ""
        }
      </div>
      <div class="composer-wrap">
        <form class="composer" id="composer-form">
          <label class="sr-only" for="message-input">发送消息</label>
          <textarea
            id="message-input"
            rows="1"
            maxlength="1000"
            placeholder="以 ${CHANNEL_NAMES[state.channel]} 回复客户..."
            ${state.busy ? "disabled" : ""}
          ></textarea>
          <button class="send-button" type="submit" aria-label="发送消息" ${state.busy ? "disabled" : ""}>
            ${icon("send")}
          </button>
        </form>
        <div class="composer-hint">
          <span>正在模拟 ${CHANNEL_NAMES[state.channel]} 入站 · 切换渠道可验证上下文连续性</span>
          <span><kbd>Enter</kbd> 发送 · <kbd>Shift</kbd> + <kbd>Enter</kbd> 换行</span>
        </div>
      </div>
    </section>
  `;
}

function nextAppointmentFor(conversation) {
  return state.snapshot.appointments.find(
    (appointment) =>
      appointment.customerId === conversation?.customerId &&
      ["confirmed", "pending"].includes(appointment.status)
  );
}

function renderInsightPanel(conversation) {
  const appointment = nextAppointmentFor(conversation);
  const events = state.snapshot.events.slice(0, 6);
  return `
    <aside class="insights-panel" aria-label="客户上下文与执行记录">
      <section class="insight-section">
        <div class="section-label">
          <h3>下一次预约</h3>
          <span>${appointment ? "已确认" : "暂无"}</span>
        </div>
        ${
          appointment
            ? `
          <div class="appointment-card">
            <div class="appointment-kicker"><span></span>${escapeHtml(appointment.displayTime)}</div>
            <div class="appointment-time">${escapeHtml(appointment.slot.time)}</div>
            <p class="appointment-service">${escapeHtml(appointment.service.name)} · ${appointment.service.durationMinutes} 分钟</p>
            <dl class="appointment-meta">
              <div><dt>预约编号</dt><dd>${escapeHtml(appointment.id)}</dd></div>
              <div><dt>沟通渠道</dt><dd>${escapeHtml(CHANNEL_NAMES[appointment.channel])}</dd></div>
              <div><dt>确认状态</dt><dd>已同步</dd></div>
              <div><dt>版本</dt><dd>v${appointment.version}</dd></div>
            </dl>
          </div>
        `
            : `<div class="empty-state"><strong>没有有效预约</strong>可邀请客户加入候补。</div>`
        }
      </section>
      <section class="insight-section">
        <div class="section-label">
          <h3>Agent 执行轨迹</h3>
          <span>实时</span>
        </div>
        <div class="trace-list">
          ${events
            .map(
              (event) => `
                <div class="trace-item ${event.status === "warning" ? "warning" : ""}">
                  <span class="trace-icon">${icon(event.type === "waitlist" ? "users" : "check")}</span>
                  <div class="trace-copy">
                    <div class="trace-title">${escapeHtml(event.title)}<time>${formatTime(event.at)}</time></div>
                    <p class="trace-detail">${escapeHtml(event.detail)}</p>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      </section>
      <section class="insight-section">
        <div class="policy-note">
          <strong>${icon("lock")} 策略保护已开启</strong>
          <p>改约前验证客户身份；时段使用条件写入锁定；确认后提交预约系统并生成幂等记录。</p>
        </div>
      </section>
    </aside>
  `;
}

function renderInbox() {
  const conversation = activeConversation();
  return `
    ${renderPageHeading(
      "Conversation operations",
      "预约运营",
      "客户可以从任一渠道继续同一件事，Agent 在会话中完成真实预约动作。"
    )}
    ${renderMetrics()}
    <div class="inbox-layout">
      ${renderConversationList()}
      ${renderChatPanel(conversation)}
      ${renderInsightPanel(conversation)}
    </div>
  `;
}

function groupAppointmentsByDate() {
  const groups = new Map();
  for (const appointment of state.snapshot.appointments.filter((item) =>
    ["confirmed", "pending"].includes(item.status)
  )) {
    if (!groups.has(appointment.slot.dateKey)) groups.set(appointment.slot.dateKey, []);
    groups.get(appointment.slot.dateKey).push(appointment);
  }
  return [...groups.entries()].slice(0, 5);
}

function formatScheduleDate(key) {
  const date = new Date(`${key}T00:00:00`);
  return {
    strong: new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(
      date
    ),
    span: `${date.getMonth() + 1} / ${date.getDate()}`
  };
}

function renderOverview() {
  const groups = groupAppointmentsByDate();
  const events = state.snapshot.events.filter((event) => event.type !== "tool").slice(0, 8);
  return `
    ${renderPageHeading(
      "Operations overview",
      "预约全局视图",
      "查看未来预约、候补机会和 Agent 自动完成的业务动作。"
    )}
    ${renderMetrics()}
    <div class="two-column-grid">
      <section class="surface-panel">
        <div class="surface-panel-heading">
          <div>
            <h2>接下来 5 天</h2>
            <p>已确认预约按日期汇总</p>
          </div>
          <button class="text-button panel-action" type="button" data-nav="inbox">返回收件箱 ${icon("arrow")}</button>
        </div>
        <div class="schedule-list">
          ${groups
            .map(([key, appointments]) => {
              const date = formatScheduleDate(key);
              return `
                <div class="schedule-day">
                  <div class="schedule-date"><strong>${escapeHtml(date.strong)}</strong><span>${appointments.length} 个预约</span></div>
                  <div class="schedule-items">
                    ${appointments
                      .map(
                        (appointment) => `
                          <div class="schedule-item">
                            <time>${escapeHtml(appointment.slot.time)}</time>
                            <strong>${escapeHtml(appointment.customer.name)}</strong>
                            <span>${escapeHtml(appointment.service.name)} · ${escapeHtml(
                              CHANNEL_NAMES[appointment.channel]
                            )}</span>
                          </div>
                        `
                      )
                      .join("")}
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </section>
      <section class="surface-panel">
        <div class="surface-panel-heading">
          <div>
            <h2>运营动态</h2>
            <p>最近业务事件与渠道动作</p>
          </div>
        </div>
        <div class="activity-list">
          ${events
            .map(
              (event) => `
                <div class="activity-row">
                  <span class="activity-dot">${icon(
                    event.type === "channel" ? "mail" : event.type === "waitlist" ? "users" : "calendar"
                  )}</span>
                  <div><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.detail)}</p></div>
                  <time>${formatTime(event.at)}</time>
                </div>
              `
            )
            .join("")}
        </div>
      </section>
    </div>
  `;
}

function matchingCandidate(opportunity) {
  if (opportunity.customer) return opportunity.customer;
  return state.snapshot.waitlist.find(
    (entry) =>
      entry.status === "waiting" &&
      entry.serviceTypeId === opportunity.serviceTypeId &&
      (entry.preferredPart === "any" || entry.preferredPart === opportunity.partOfDay)
  )?.customer;
}

function renderWaitlist() {
  const opportunities = state.snapshot.opportunities;
  return `
    ${renderPageHeading(
      "Recover every cancelled slot",
      "候补与空档",
      "取消预约后自动生成候补机会，按服务类型、时段偏好和优先级匹配客户。"
    )}
    <div class="waitlist-grid">
      ${
        opportunities.length
          ? opportunities
              .map((opportunity) => {
                const candidate = matchingCandidate(opportunity);
                const statusCopy =
                  opportunity.status === "filled"
                    ? "已转化"
                    : opportunity.status === "offered"
                      ? "等待回复"
                      : "待匹配";
                const statusClass =
                  opportunity.status === "filled" ? "" : opportunity.status === "offered" ? "pending" : "";
                return `
                  <article class="opportunity-card">
                    <div class="opportunity-top">
                      <div class="time-orb">
                        <strong>${escapeHtml(opportunity.time)}</strong>
                        <span>${escapeHtml(opportunity.dateKey.slice(5))}</span>
                      </div>
                      <div class="opportunity-copy">
                        <h3>${escapeHtml(opportunity.service.name)} · 可填补</h3>
                        <p>时段已从未完成预约中释放。条件写入保证只有一位客户能获得。</p>
                      </div>
                      <span class="status-pill ${statusClass}">${statusCopy}</span>
                    </div>
                    ${
                      candidate
                        ? `
                    <div class="candidate-row">
                      <span class="avatar ${avatarClass(candidate.id)}">${escapeHtml(candidate.initials)}</span>
                      <div class="candidate-copy">
                        <strong>${escapeHtml(candidate.name)}</strong>
                        <p>候补优先级匹配 · ${
                          opportunity.partOfDay === "morning" ? "偏好上午" : "偏好下午"
                        }</p>
                      </div>
                      ${
                        opportunity.status === "open"
                          ? `<button class="primary-button" type="button" data-offer="${escapeAttribute(
                              opportunity.id
                            )}">发送邀约</button>`
                          : opportunity.status === "offered"
                            ? `<button class="secondary-button" type="button" data-accept="${escapeAttribute(
                                opportunity.id
                              )}" data-customer="${escapeAttribute(candidate.id)}">模拟接受</button>`
                            : `<span class="status-pill">已确认</span>`
                      }
                    </div>
                  `
                        : `<div class="candidate-row"><div class="candidate-copy"><strong>暂无匹配客户</strong><p>可邀请客户加入候补队列</p></div></div>`
                    }
                  </article>
                `;
              })
              .join("")
          : `<div class="surface-panel"><div class="empty-state"><strong>还没有候补机会</strong>在收件箱中完成一次改约或取消，这里会自动生成。</div></div>`
      }
    </div>
    <section class="surface-panel" style="margin-top: 16px">
      <div class="surface-panel-heading">
        <div><h2>候补队列</h2><p>按优先级与服务时间偏好排序</p></div>
      </div>
      <div style="overflow-x: auto">
        <table class="waitlist-table">
          <thead><tr><th>客户</th><th>服务</th><th>偏好时间</th><th>优先级</th><th>当前状态</th></tr></thead>
          <tbody>
            ${state.snapshot.waitlist
              .map(
                (entry) => `
                  <tr>
                    <td><div class="person-cell"><span class="avatar ${avatarClass(
                      entry.customer?.id
                    )}">${escapeHtml(entry.customer?.initials || "客")}</span><strong>${escapeHtml(
                      entry.customer?.name || "客户"
                    )}</strong></div></td>
                    <td>${escapeHtml(entry.service?.name || "洁牙护理")}</td>
                    <td>${entry.preferredPart === "morning" ? "上午" : entry.preferredPart === "afternoon" ? "下午" : "不限"}</td>
                    <td>P${entry.priority}</td>
                    <td><span class="status-pill ${
                      entry.status === "offered" ? "pending" : entry.status === "booked" ? "" : "closed"
                    }">${entry.status === "offered" ? "邀约中" : entry.status === "booked" ? "已预约" : "候补中"}</span></td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderIntegrations() {
  const integration = state.snapshot.integration;
  return `
    ${renderPageHeading(
      "Runtime and channel readiness",
      "渠道与运行时",
      "当前运行在本地模拟模式。业务核心与 AWS 接入层解耦，可逐项替换为真实服务。"
    )}
    <section class="surface-panel" style="margin-bottom: 16px">
      <div class="surface-panel-heading">
        <span class="runtime-head" style="color: var(--forest)">
          <span class="live-dot"></span>
          <strong>${escapeHtml(integration.agent.name)}</strong>
        </span>
        <span class="status-pill">Ready</span>
        <button class="secondary-button panel-action" type="button" data-action="reset">重置演示数据</button>
      </div>
      <div style="padding: 0 20px 18px; color: var(--ink-soft); font-size: 10px; line-height: 1.7">
        ${escapeHtml(integration.agent.note)}。生产环境使用 AgentCore Runtime 承载多轮推理，Gateway 暴露预约工具，
        Memory 保存偏好摘要；预约事实仍由预约系统和 DynamoDB 管理。
      </div>
    </section>
    <div class="integration-grid">
      ${integration.channels
        .map(
          (channel) => `
            <article class="integration-card">
              <div class="integration-head">
                ${channelIcon(channel.id)}
                <div><h3>${escapeHtml(channel.name)}</h3><p>双向消息通道</p></div>
                <span class="status-pill">模拟中</span>
              </div>
              <div class="integration-paths">
                <div class="integration-path"><span>入站</span><code>${escapeHtml(channel.inbound)}</code></div>
                <div class="integration-path"><span>出站</span><code>${escapeHtml(channel.outbound)}</code></div>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
    <section class="surface-panel" style="margin-top: 16px">
      <div class="surface-panel-heading"><div><h2>上线前检查</h2><p>本地能力边界与下一步 AWS 接入项</p></div></div>
      <div class="activity-list">
        <div class="activity-row"><span class="activity-dot">${icon("check")}</span><div><strong>业务状态机</strong><p>查询、改约、取消、候补与幂等控制已可运行</p></div><span class="status-pill">完成</span></div>
        <div class="activity-row"><span class="activity-dot">${icon("check")}</span><div><strong>统一客户上下文</strong><p>手机号与邮箱映射到同一客户，可跨渠道继续对话</p></div><span class="status-pill">完成</span></div>
        <div class="activity-row"><span class="activity-dot">${icon("plug")}</span><div><strong>AWS CDS 真实发送</strong><p>配置账号、号码、WABA、SES 域名后接入 CDS Provider</p></div><span class="status-pill pending">待配置</span></div>
        <div class="activity-row"><span class="activity-dot">${icon("spark")}</span><div><strong>AgentCore Runtime</strong><p>生产 Runtime、Memory、Bedrock 工具编排和 CDK 已构建</p></div><span class="status-pill">已构建</span></div>
      </div>
    </section>
  `;
}

function renderContent() {
  if (state.view === "overview") return renderOverview();
  if (state.view === "waitlist") return renderWaitlist();
  if (state.view === "integrations") return renderIntegrations();
  return renderInbox();
}

function render() {
  if (!state.snapshot) return;
  app.innerHTML = `
    ${renderSidebar()}
    <main class="main-shell">
      ${renderTopbar()}
      <div class="content">${renderContent()}</div>
    </main>
  `;
  const messages = document.getElementById("messages");
  if (messages) messages.scrollTop = messages.scrollHeight;
}

function mergeSnapshot(snapshot, conversationId) {
  state.snapshot = snapshot;
  if (conversationId) state.activeConversationId = conversationId;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "请求失败");
  }
  return payload;
}

async function loadBootstrap() {
  state.snapshot = await apiRequest("/api/bootstrap");
  state.activeConversationId = state.snapshot.activeConversation?.id || "conv_cus_001";
  state.channel = activeConversation()?.lastChannel || "whatsapp";
  render();
}

async function sendMessage(value) {
  const text = String(value || "").trim();
  const conversation = activeConversation();
  if (!text || !conversation || state.busy) return;
  state.busy = true;
  render();
  try {
    const response = await apiRequest("/api/messages", {
      method: "POST",
      body: JSON.stringify({
        channel: state.channel,
        identifier: identifierFor(conversation, state.channel),
        text
      })
    });
    mergeSnapshot(response.snapshot, response.conversationId);
  } catch (error) {
    showToast(error.message);
  } finally {
    state.busy = false;
    render();
    document.getElementById("message-input")?.focus();
  }
}

async function offerWaitlist(opportunityId) {
  try {
    const response = await apiRequest(`/api/waitlist/${encodeURIComponent(opportunityId)}/offer`, {
      method: "POST",
      body: JSON.stringify({})
    });
    mergeSnapshot(response.snapshot, response.conversationId || state.activeConversationId);
    showToast("候补邀约已发送，等待客户确认");
  } catch (error) {
    showToast(error.message);
  }
  render();
}

async function acceptWaitlist(opportunityId, customerId) {
  try {
    const response = await apiRequest(`/api/waitlist/${encodeURIComponent(opportunityId)}/accept`, {
      method: "POST",
      body: JSON.stringify({ customerId })
    });
    mergeSnapshot(response.snapshot, response.conversationId || state.activeConversationId);
    showToast("候补客户已成功获得时段");
  } catch (error) {
    showToast(error.message);
  }
  render();
}

async function resetDemo() {
  if (!window.confirm("重置所有演示数据？当前改约与会话记录会恢复到初始状态。")) return;
  try {
    const response = await apiRequest("/api/reset", { method: "POST", body: "{}" });
    state.snapshot = response.snapshot;
    state.activeConversationId = "conv_cus_001";
    state.channel = "whatsapp";
    state.view = "inbox";
    showToast("演示数据已重置");
  } catch (error) {
    showToast(error.message);
  }
  render();
}

app.addEventListener("click", (event) => {
  const navButton = event.target.closest("[data-nav]");
  if (navButton) {
    state.view = navButton.dataset.nav;
    window.history.replaceState(null, "", `#${state.view}`);
    render();
    return;
  }

  const conversationButton = event.target.closest("[data-conversation]");
  if (conversationButton) {
    state.activeConversationId = conversationButton.dataset.conversation;
    state.channel = activeConversation()?.lastChannel || "whatsapp";
    render();
    return;
  }

  const channelButton = event.target.closest("[data-channel]");
  if (channelButton) {
    state.channel = channelButton.dataset.channel;
    render();
    document.getElementById("message-input")?.focus();
    return;
  }

  const quickReply = event.target.closest("[data-quick]");
  if (quickReply) {
    sendMessage(quickReply.dataset.quick);
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    const action = actionButton.dataset.action;
    if (action === "reset") resetDemo();
    if (action === "notifications") showToast("没有新的系统通知");
    if (action === "location") showToast("当前演示环境仅配置了静安店");
    if (action === "filter") showToast("收件箱已按最近消息排序");
    if (action === "handoff") sendMessage("转人工");
    return;
  }

  const offerButton = event.target.closest("[data-offer]");
  if (offerButton) {
    offerWaitlist(offerButton.dataset.offer);
    return;
  }

  const acceptButton = event.target.closest("[data-accept]");
  if (acceptButton) {
    acceptWaitlist(acceptButton.dataset.accept, acceptButton.dataset.customer);
  }
});

app.addEventListener("submit", (event) => {
  if (event.target.id !== "composer-form") return;
  event.preventDefault();
  const input = event.target.querySelector("#message-input");
  sendMessage(input.value);
});

app.addEventListener("keydown", (event) => {
  if (event.target.id !== "message-input") return;
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    event.target.closest("form")?.requestSubmit();
  }
});

app.addEventListener("change", (event) => {
  if (event.target.id !== "mobile-conversation-select") return;
  state.activeConversationId = event.target.value;
  state.channel = activeConversation()?.lastChannel || "whatsapp";
  render();
});

app.addEventListener("input", (event) => {
  if (event.target.id !== "message-input") return;
  event.target.style.height = "auto";
  event.target.style.height = `${Math.min(event.target.scrollHeight, 90)}px`;
});

window.addEventListener("hashchange", () => {
  const nextView = window.location.hash.slice(1);
  if (!VIEWS.includes(nextView) || nextView === state.view) return;
  state.view = nextView;
  render();
});

loadBootstrap().catch((error) => {
  app.innerHTML = `<div class="boot-screen"><div class="boot-mark">!</div><p>${escapeHtml(
    error.message
  )}</p><button class="primary-button" type="button" data-action="reload">重新载入</button></div>`;
  app.addEventListener("click", (event) => {
    if (event.target.closest("[data-action='reload']")) window.location.reload();
  });
});
