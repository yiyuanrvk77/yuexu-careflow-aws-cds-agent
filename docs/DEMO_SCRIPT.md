# 三分钟演示脚本

## 0:00–0:20 业务问题

预约制门店仍需要人工处理改约、取消、候补和提醒。客户分散在短信、RCS、WhatsApp 和邮件中，前台需要不断切换系统。爽约会造成预约收入和人员时间损失。

## 0:20–0:40 AWS CDS 触发器

使用测试手机向配置的 SMS 号码或 RCS Agent 发送：

```text
请把我明天15点的预约改到后天上午10点
```

打开 CloudWatch，展示 SNS/SQS 入站事件进入 Lambda。

强调：这是实际 CDS 消息，不是网页模拟。

## 0:40–1:10 Agent 决策与工具调用

打开 AgentCore Observability，展示：

- `get_appointment_context`
- `find_available_slots`

说明 Agent 使用 Bedrock 模型推理，但预约事实来自 DynamoDB，不是模型编造。

## 1:10–1:35 明确确认

Agent 向客户提供具体时段并要求确认。客户回复：

```text
确认改到后天上午10点
```

Agent 调用：

- `hold_appointment_slot`
- `reschedule_appointment`

展示 DynamoDB 事务和预约版本从 `1` 更新为 `2`。

## 1:35–2:05 AWS CDS 输出

展示测试手机或邮箱实际收到确认消息，并展示 AWS Provider Message ID。

根据实际演示渠道说明：

- SMS/RCS：AWS End User Messaging；
- WhatsApp：AWS End User Messaging Social；
- 邮件：Amazon SES。

## 2:05–2:30 候补价值

展示原 15:00 时段恢复为可用，并生成候补机会。说明门店可以用候补客户填补取消时段，而不是直接损失预约收入。

## 2:30–2:50 架构说明

展示 `docs/architecture.svg`。

概括：

- AWS CDS 是通信层；
- AgentCore Runtime 承载 Agent 和 Memory；
- Strands 工具与 DynamoDB 事务保证业务执行；
- Lambda、SNS 和 SQS 提供可靠的入站处理。

## 2:50–3:00 商业价值

首期试点衡量前台节省工时、改约完成时间、爽约率和候补转化率。该架构可以复用于汽车售后、体检、美容、宠物医院和教育预约。
