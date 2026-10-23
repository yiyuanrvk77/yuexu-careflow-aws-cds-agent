# AWS 部署说明

## 总体结构

部署包含三个构建部分：

1. `app/agent`：ARM64 AgentCore Runtime 容器；
2. `lambda`：Node.js 22 渠道编排函数；
3. `agentcore/cdk`：AgentCore CLI 项目中的 AWS CDK Stack。

CDK 会创建 DynamoDB 表、SNS Topic、SQS 和死信队列、Lambda、Function URL、AgentCore Runtime、AgentCore Memory、IAM、ECR 和 CodeBuild。

## 环境变量

```powershell
$env:AWS_REGION="us-east-1"
$env:AWS_PROFILE="your-aws-profile"
$env:BEDROCK_MODEL_ID="amazon.nova-pro-v1:0"
$env:BUSINESS_TIMEZONE="Asia/Shanghai"
```

至少配置一个真实 CDS 发送身份：

```powershell
$env:EUM_SMS_ORIGINATION_IDENTITY="phone-number-id-... 或 +1555..."
$env:EUM_RCS_ORIGINATION_IDENTITY="rcs-a1b2c3d4"
$env:WHATSAPP_PHONE_NUMBER_ID="phone-number-id-..."
$env:WHATSAPP_META_API_VERSION="v23.0"
$env:SES_FROM_ADDRESS="appointments@example.com"
```

保护评委入口：

```powershell
$env:DEMO_API_TOKEN="<长随机 Token>"
$env:ALLOWED_TEST_NUMBERS="+15551234567"
$env:SEND_CHANNEL_MESSAGES="true"
```

只做基础设施部署时可以设置为 `false`，但该模式不能作为最终比赛证据。

## 安装

```powershell
npm.cmd install
npm.cmd --prefix app/agent install
npm.cmd --prefix lambda install
npm.cmd --prefix agentcore/cdk install
npm.cmd install --global @aws/agentcore
```

## 本地构建校验

```powershell
npm.cmd --prefix app/agent run build
npm.cmd --prefix lambda run build
npm.cmd --prefix agentcore/cdk run build
node --test
agentcore build
node scripts/verify-aws-build.mjs
```

CloudFormation 应包含：

- `AWS::BedrockAgentCore::Runtime`
- `AWS::BedrockAgentCore::Memory`
- `AWS::DynamoDB::Table`
- `AWS::SQS::Queue`
- `AWS::SNS::Topic`
- `AWS::Lambda::Function`
- `AWS::Lambda::Url`
- `AWS::ECR::Repository`
- `AWS::CodeBuild::Project`

## 部署

```powershell
agentcore deploy
agentcore status --json
```

首次部署会自动创建 `agentcore/aws-targets.json` 的默认目标。

在 CloudFormation Stack 的 **输出** 页签中读取 `JudgeApiUrl`、`AppointmentTableName` 和三个 SNS Topic ARN。`agentcore status` 主要用于查看 AgentCore 资源，不保证显示全部自定义输出。

## 初始化数据

```powershell
$env:APPOINTMENT_TABLE="<AppointmentTableName 输出>"
$env:DEMO_PHONE="+15551234567"
$env:DEMO_EMAIL="verified@example.com"
node scripts/seed-demo.mjs
```

种子脚本支持重复运行，不会重复创建有效预约。当前日期转换要求 `Asia/Shanghai`。

## 配置短信双向消息

1. 打开 AWS End User Messaging SMS 控制台；
2. 选择双向号码或号码池；
3. 将 Two-way Messaging Destination 设置为 `InboundSmsTopicArn`；
4. 确认服务可以将事件发布到该 SNS Topic。

## 配置 RCS 测试 Agent

1. 创建 RCS Agent 和 Testing Registration；
2. 在 Android 测试设备接受邀请；
3. 将 Two-way Messaging Destination 设置为 `InboundRcsTopicArn`；
4. 将 RCS Agent 标识配置为 `EUM_RCS_ORIGINATION_IDENTITY`。

## 配置 WhatsApp

1. 关联 WABA 和 Phone Number；
2. 将 Message and Event Destination 指向 `InboundWhatsAppTopicArn`；
3. 配置 `WHATSAPP_PHONE_NUMBER_ID`；
4. 确认客户已 Opt-in；
5. 客服窗口外使用已批准模板。

## 配置 SES

1. 验证发件域名或邮箱；
2. 配置 SPF、DKIM 和 DMARC；
3. SES Sandbox 中需验证所有收件人，或申请生产权限；
4. 配置 `SES_FROM_ADDRESS`。

## 端到端测试

```powershell
$body = @{
  channel = "sms"
  from = "+15551234567"
  text = "请查询我的下一次预约"
  messageId = "deployment-test-001"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "<JudgeApiUrl>" `
  -Method Post `
  -Headers @{ "x-demo-token" = $env:DEMO_API_TOKEN } `
  -ContentType "application/json" `
  -Body $body
```

结果必须包含：

- AgentCore 回复；
- `delivery.delivered = true`；
- 真实 AWS Provider 名称；
- 非空 Provider Message ID。

随后发送真实 CDS 入站消息，验证：

```text
CDS → SNS → SQS → Lambda → AgentCore → CDS
```

## 故障排查

### AgentCore Runtime 无法启动

- 确认镜像为 ARM64；
- 确认服务监听 `0.0.0.0:8080`；
- 检查 CodeBuild 和 ECR 镜像构建；
- 检查 Runtime 日志和 `/ping`。

### CDS 返回 AccessDenied

- 确认 Lambda IAM 权限；
- 确认发送身份与部署区域一致；
- 检查号码、RCS Agent 或 WABA 的状态。

### 没有入站消息

- 确认 CDS Event Destination 指向正确 SNS Topic；
- 检查 SNS Topic Policy 和 SQS；
- 检查死信队列。

### 找不到客户

- 入站发送方必须与 DynamoDB 中的手机号或邮箱身份映射一致；
- 手机号使用 E.164 格式。

### 改约冲突

- Hold 可能已超过五分钟；
- 时段可能被其他客户占用；
- Agent 应重新查询并请客户重新选择。
