# AWS 生产架构

## 目标

把本地原型升级为可多租户部署的预约运营 Agent，同时保持三个边界：

1. CDS 只负责渠道消息收发。
2. AgentCore 只负责推理、上下文和工具编排。
3. 预约事实、时段锁、同意记录和消息 Outbox 由业务核心持有。

AgentCore Memory 不能成为预约状态的唯一来源。

本文同时描述目标架构和比赛 MVP 的实现边界。当前 CDK 已实现 SMS/RCS/WhatsApp 入站、四类出站、DynamoDB、AgentCore Runtime/Memory 和评委接口；EventBridge Scheduler、自动候补邀约、人工接管工具与 SES 入站属于后续阶段，未在当前提交中启用。

```text
WhatsApp / RCS / SMS / Email
             │
    SNS / SES Receipt Rule
             ↓
          SQS + DLQ
             ↓
  Channel Normalizer (Lambda)
             ↓
   Conversation Control Plane
   ├─ DynamoDB: conversations / messages
   ├─ DynamoDB: slot holds / outbox / idempotency
   ├─ S3: raw payloads and documents
   └─ Step Functions: long-running compensation
             ↓
  Bedrock AgentCore Runtime
   ├─ AgentCore Memory
   ├─ AgentCore Gateway
   ├─ AgentCore Identity
   ├─ AgentCore Policy
   └─ Bedrock Guardrails
             ↓
  Booking system / PMS / calendar
             ↓
          Outbox worker
             ↓
  EUM / EUM Social / SES send APIs

EventBridge Scheduler → reminders / waitlist offers / hold expiry
Front-desk console   → human takeover / audit / escalation
```

## 渠道接入

### WhatsApp

- 客户入站消息写入 WABA Event Destination 的 Amazon SNS。
- SNS 订阅 SQS，由 Lambda 拉取并标准化。
- 出站调用 `SendWhatsAppMessage`。
- 客户主动消息会打开 24 小时客服窗口；窗口外只使用已批准模板。
- 所有发送目标必须先校验 Opt-in。

### RCS

- 在 AWS RCS Agent 上配置 Two-way Messaging Destination。
- 入站消息进入 SNS；SQS 用于削峰和重试。
- 出站使用 `SendRcsMessage` 或适合富消息的 EUM 发送接口。
- 演示阶段使用测试 Agent 和已接受邀请的测试设备。
- 生产上线需要按目标国家完成 RCS for Business 注册。

### SMS

- 使用支持双向消息的长号码或号码池。
- 入站消息进入 SNS。
- 出站调用 `SendTextMessage`。
- 入站消息不保证顺序，Conversation Hub 需要使用供应商时间戳和会话版本串行处理。

### Email

- 出站使用 SES v2 `SendEmail`，配置 SPF、DKIM 和 DMARC。
- 当前比赛 MVP 只实现出站邮件，避免 CDK 覆盖客户已有的 SES Receipt Rule Set。
- 后续入站版本将使用 SES Receipt Rule 存入 S3，并通过 SNS/SQS 触发处理。
- 后续使用 `Message-ID`、`In-Reply-To` 和 `References` 维护邮件线程。
- 敏感文件不直接进入模型，使用受控下载链接或对象引用。

## Conversation Control Plane

推荐 DynamoDB 单表设计：

| 实体 | 分区键 | 排序键 | 说明 |
|---|---|---|---|
| Conversation | `TENANT#<id>` | `CONV#<id>` | 客户会话与最后渠道 |
| Message | `CONV#<id>` | `MSG#<timestamp>#<id>` | 消息审计 |
| ChannelIdentity | `IDENTITY#<hash>` | `CUSTOMER#<id>` | 手机或邮箱映射 |
| AppointmentRef | `CUSTOMER#<id>` | `APPOINTMENT#<id>` | 外部预约引用 |
| SlotHold | `SLOT#<id>` | `HOLD` | 条件写入和 TTL |
| Outbox | `TENANT#<id>` | `OUTBOX#<timestamp>#<id>` | 发送重试 |
| Idempotency | `IDEMPOTENCY#<key>` | `RESULT` | 重复请求保护 |
| Consent | `CUSTOMER#<id>` | `CHANNEL#<id>` | 渠道授权与退订 |

关键约束：

- 客户命中后的会话按 `customer_id` 关联，不按渠道拆成独立上下文。
- `hold_slot` 使用 DynamoDB 条件更新，过期时间使用 TTL 与业务时间双重检查。
- 预约系统调用必须携带幂等键。
- 业务状态变更与 Outbox 写入尽量使用 DynamoDB Transaction。
- 外部预约系统超时后进入待确认状态，由补偿任务查询真实结果，不能直接重试产生冲突。

## AgentCore Runtime 接口

建议 Runtime 接收稳定 ID，而不是接收整个数据库对象：

```json
{
  "tenantId": "tenant_001",
  "customerId": "cus_001",
  "conversationId": "conv_cus_001",
  "channel": "rcs",
  "message": "确认改约",
  "timezone": "Asia/Shanghai"
}
```

Runtime 返回结构化结果：

```json
{
  "reply": "改约成功...",
  "intent": "reschedule",
  "confidence": 0.97,
  "toolCalls": [
    {
      "name": "reschedule_appointment",
      "arguments": {
        "appointmentId": "apt_1002",
        "slotId": "slot_20261025_1000"
      },
      "status": "succeeded"
    }
  ],
  "requiresHuman": false,
  "handoffSummary": null
}
```

当前 `src/agent/appointment-agent.js` 是该接口的本地实现。生产接入时可以增加远程 AgentCore provider，由它调用 AgentCore Runtime，同时保留相同的结构化结果协议。

## 推荐工具

- `get_appointment_context`
- `search_available_slots`
- `hold_appointment_slot`
- `reschedule_appointment`
- `cancel_appointment`
- `join_waitlist`

后续工具：

- `offer_waitlist_slot`
- `send_preparation_instructions`
- `handoff_to_staff`

AgentCore Gateway 将预约系统和 CRM API 包装为 MCP 工具。AgentCore Policy 用于限制时间修改、退款、临床信息和高风险动作；身份认证由 AgentCore Identity 对接企业 IdP 或预约系统 OAuth。

## 部署顺序

1. 单门店、单预约类型、Mock 预约系统。
2. RCS 测试 Agent + SMS，实现真实双向链路。
3. SES 发件域名与确认函。
4. WhatsApp WABA、模板和测试号码。
5. 接入真实预约系统或 Google/Microsoft Calendar。
6. 上线 DynamoDB、SQS、CloudWatch 和人工坐席。
7. 引入 AgentCore Runtime、Memory、Gateway 和 Policy。
8. 完成多门店、多租户、模板管理、计费和 SLA。

## 安全与合规

- 不讨论诊断、检查结果和用药建议，只处理预约行政事务。
- 预约修改前验证客户身份；高敏感操作要求一次性验证码或人工处理。
- 日志中的手机号、邮箱和消息内容分级脱敏。
- 原始事件进入 S3 时启用 SSE-KMS 和生命周期策略。
- 每个租户使用独立 KMS 上下文或数据密钥策略。
- 客户撤回同意后停止非必要触达，并保留审计记录。
- 使用 Bedrock Guardrails、AgentCore Policy 和工具级 IAM 最小权限。
