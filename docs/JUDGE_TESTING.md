# 评委测试指南

## 推荐测试方式

使用 CloudFormation 输出中的 `JudgeApiUrl`。该地址是 Lambda Function URL，不是 API Gateway 路径。

请求字段：

- `channel`：`sms`、`rcs`、`whatsapp` 或 `email`；
- `from`：已加入测试白名单的手机号或邮箱；
- `text`：客户请求；
- `messageId`：可选，建议传入稳定 ID，便于安全重试。

请求头：

```text
x-demo-token: <部署时配置的 DEMO_API_TOKEN>
```

测试身份还必须出现在 `ALLOWED_TEST_NUMBERS` 中。`SEND_CHANNEL_MESSAGES` 必须为 `true`，否则接口会返回 503，不会生成虚假的成功结果。

## 测试一：查询预约

```json
{
  "channel": "sms",
  "from": "+15551234567",
  "text": "请查询我的下一次预约",
  "messageId": "judge-query-001"
}
```

预期结果：

- AgentCore 调用 `get_appointment_context`；
- 返回种子数据中的预约；
- AWS CDS 返回非空 Message ID；
- 测试手机实际收到短信。

## 测试二：改约

第一条请求：

```json
{
  "channel": "sms",
  "from": "+15551234567",
  "text": "请把明天的预约改到后天上午10点",
  "messageId": "judge-reschedule-001"
}
```

Agent 应查询预约和可用时段，并要求客户明确确认。

第二条请求：

```json
{
  "channel": "sms",
  "from": "+15551234567",
  "text": "确认改到后天上午10点",
  "messageId": "judge-reschedule-002"
}
```

成功证据：

1. Agent 明确回复改约成功；
2. CDS 返回真实 Provider Message ID；
3. DynamoDB 预约 `version` 增加；
4. 新时段状态为 `reserved`；
5. 原时段重新变为 `available`；
6. 创建 `WAITLIST_OPPORTUNITY`；
7. AgentCore Observability 显示工具调用；
8. CloudWatch 显示 Lambda 和 AWS Provider 记录。

## 测试三：真实 CDS 入站

使用已注册测试手机向配置的 SMS 号码或 RCS Agent 发送：

```text
请查询我的下一次预约
```

该消息应依次进入：

```text
AWS CDS → SNS → SQS → Lambda → AgentCore Runtime → AWS CDS
```

## 证据清单

- 手机实际收到消息的录屏；
- CloudWatch 中的入站事件和 AgentCore Runtime ARN；
- AgentCore Trace 中的预约工具调用；
- CDS Provider Message ID；
- DynamoDB 改约前后的预约记录；
- Function URL 的 HTTPS 返回结果。

本地内存演示不能作为 AWS 部署证据。

## 错误处理

- 未配置 Token 时返回 503；
- Token 错误时返回 401；
- 发送身份不在白名单时返回 403；
- CDS 配置错误时不会返回 `delivered=true`；
- SQS 消费失败会重试，五次后进入死信队列；
- 时段冲突会让 Agent 重新查询可用时间。
