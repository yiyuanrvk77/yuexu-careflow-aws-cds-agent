# 约序 CareFlow

面向 2026 AWS CDS Agentic AI Partner Hackathon 的智能预约运营 Agent。

约序不是静态问答机器人。它通过 AWS CDS 接收客户消息，调用 Amazon Bedrock AgentCore Runtime 中的 Strands Agent，理解客户意图，并调用预约工具完成真实业务动作。

当前已实现：

- 从入站渠道身份验证客户，并映射到统一客户 ID；
- 查询客户下一次预约；
- 查询指定日期、时段和服务类型的可约时间；
- 为客户临时锁定一个五分钟有效时段；
- 在客户明确确认后改约或取消；
- 使用 DynamoDB 事务防止重复预约和并发冲突；
- 将释放的时段写入候补机会；
- 通过 AWS End User Messaging SMS/RCS、AWS End User Messaging Social WhatsApp 或 Amazon SES 回复客户。

Amazon Bedrock AgentCore 提供 Runtime 和 Memory；Lambda 负责渠道事件标准化、AgentCore 调用和真实 CDS 发送。

## CDS 支持范围

| 渠道 | 入站 | 出站 | 当前 AWS 配置 |
|---|---|---|---|
| SMS | 双向号码/号码池 → SNS → SQS | `SendTextMessage` | 配置双向消息目标后可用 |
| RCS | RCS Agent → SNS → SQS | `SendRcsMessage`，支持 SMS 兜底 | 配置 RCS 双向目标和测试设备后可用 |
| WhatsApp | WABA Event Destination → SNS → SQS | `SendWhatsAppMessage` | 配置 WABA 和事件目标后可用 |
| 邮件 | 当前 CDK 未创建 SES 入站规则 | SES v2 `SendEmail` | 当前 MVP 仅支持出站 |

CDK 不会自动创建 SES Receipt Rule Set，避免覆盖客户已有的邮件接收规则。邮件入站是后续扩展。

## 已实现内容

- 官方 AgentCore CLI/CDK 项目结构；
- ARM64 Node.js AgentCore Runtime，实现 `/invocations` 和 `/ping`；
- Strands Agent、Bedrock 模型推理和六个预约业务工具；
- AgentCore Memory；
- DynamoDB 预约、时段、锁定、会话和候补状态；
- 改约和取消事务；
- SQS + 死信队列；
- SMS、RCS、WhatsApp 三个独立 SNS 入站 Topic；
- 真实 AWS CDS SDK 发送代码；
- Lambda Function URL 评委测试入口；
- 入站消息幂等、客户级会话锁和失败重试；
- CDK 合成、演示数据脚本和提交文档。

AWS 基础设施已经成功合成。当前工作区没有 AWS 凭证，因此尚未部署到真实 AWS 账号。

## 仓库结构

```text
app/agent/                 AgentCore Runtime 容器与 Strands 工具
agentcore/                 AgentCore 项目和 CDK 基础设施
lambda/                    CDS 入站、AgentCore 调用和 CDS 出站
scripts/seed-demo.mjs      DynamoDB 演示数据
public/                    可选的本地运营台
src/                       本地业务原型与测试
docs/                      中文部署、测试、演示和架构文档
```

## 1. 本地产品演示

本地运营台不依赖 AWS，用于快速验证预约业务状态机。

```powershell
node src/server.js
```

打开 <http://127.0.0.1:3000>。

运行本地测试：

```powershell
node --test
```

本地版本使用内存状态，不代表真实 CDS 发送，也不能作为比赛 AWS 部署证据。

## 2. AWS 前置条件

1. 已加入 AWS Partner Network 的 AWS 账号。
2. 具备 CDK、Bedrock AgentCore、Lambda、DynamoDB、SNS、SQS、IAM、ECR、CodeBuild 和 CloudWatch 权限的 AWS 凭证。
3. Node.js 22 和 Docker。
4. 至少一个真实 CDS 发送身份：
   - 支持双向短信的号码或号码池；或
   - RCS 测试 Agent 和已接受邀请的测试设备。
5. 可选 WhatsApp WABA、Phone Number ID 和 Meta API Version。
6. 可选已验证的 Amazon SES 发件身份。
7. 目标区域已启用 Bedrock 模型，默认使用 `amazon.nova-pro-v1:0`。

安装依赖：

```powershell
npm.cmd install
npm.cmd --prefix app/agent install
npm.cmd --prefix lambda install
npm.cmd --prefix agentcore/cdk install
npm.cmd install --global @aws/agentcore
```

## 3. 配置部署参数

在运行部署的终端中设置：

```powershell
$env:AWS_REGION="us-east-1"
$env:AWS_PROFILE="your-profile"

$env:BEDROCK_MODEL_ID="amazon.nova-pro-v1:0"
$env:BUSINESS_TIMEZONE="Asia/Shanghai"

$env:EUM_SMS_ORIGINATION_IDENTITY="phone-number-id 或号码"
$env:EUM_RCS_ORIGINATION_IDENTITY="rcs-agent-id 或 ARN"

$env:WHATSAPP_PHONE_NUMBER_ID="phone-number-id-..."
$env:WHATSAPP_META_API_VERSION="v23.0"
$env:SES_FROM_ADDRESS="appointments@example.com"

$env:DEMO_API_TOKEN="长随机 Token"
$env:ALLOWED_TEST_NUMBERS="+15551234567"
$env:SEND_CHANNEL_MESSAGES="true"
```

首次部署时，AgentCore CLI 会根据当前 AWS 账号和区域创建默认部署目标。

## 4. 构建与部署

```powershell
npm.cmd --prefix app/agent run build
npm.cmd --prefix lambda run build
npm.cmd --prefix agentcore/cdk run build
agentcore build
agentcore deploy
```

查看部署资源：

```powershell
agentcore status --json
```

在 CloudFormation 控制台打开生成的 Stack，进入 **输出** 页签，记录：

- `JudgeApiUrl`
- `AppointmentTableName`
- `InboundSmsTopicArn`
- `InboundRcsTopicArn`
- `InboundWhatsAppTopicArn`
- AgentCore Runtime ARN 和 Memory ID

## 5. 初始化演示数据

使用 `AppointmentTableName` 输出：

```powershell
$env:APPOINTMENT_TABLE="<CloudFormation 输出>"
$env:DEMO_PHONE="+15551234567"
$env:DEMO_EMAIL="verified@example.com"
node scripts/seed-demo.mjs
```

脚本会创建：

- 一个已映射到手机号和邮箱的演示客户；
- 明天 15:00 的有效洁牙预约；
- 未来七天的可约时段；
- 一个用于候补场景的第二客户。

当前种子脚本要求 `BUSINESS_TIMEZONE=Asia/Shanghai`。切换国家或时区前需要修改时间转换逻辑。

## 6. 配置 CDS 入站

### 短信

1. 打开 AWS End User Messaging SMS 控制台。
2. 选择支持双向短信的号码或号码池。
3. 将双向消息目标设置为 `InboundSmsTopicArn`。
4. 确认 End User Messaging 可以发布到该 SNS Topic。

### RCS

1. 创建或打开 RCS 测试 Agent。
2. 在测试 Android 设备上接受 Tester Invitation。
3. 将 RCS Two-way Messaging Destination 设置为 `InboundRcsTopicArn`。
4. 将 `EUM_RCS_ORIGINATION_IDENTITY` 设置为 RCS Agent ID 或 ARN。

### WhatsApp

1. 关联 WABA 和 WhatsApp Phone Number。
2. 将 Message and Event Destination 设置为 `InboundWhatsAppTopicArn`。
3. 配置 `WHATSAPP_PHONE_NUMBER_ID` 和 Meta API Version。
4. 客户必须先 Opt-in；客服窗口外只使用已批准模板。

## 7. 评委测试

评委入口是受 Token 和白名单保护的 Lambda Function URL。每次测试会真实调用 AgentCore 并执行 CDS 发送。

```powershell
$body = @{
  channel = "sms"
  from = "+15551234567"
  text = "请把我明天15点的预约改到后天10点"
  messageId = "judge-test-001"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "<JudgeApiUrl>" `
  -Method Post `
  -Headers @{ "x-demo-token" = $env:DEMO_API_TOKEN } `
  -ContentType "application/json" `
  -Body $body
```

成功响应必须包含：

- AgentCore 返回的回复；
- `delivery.delivered = true`；
- `delivery.provider` 为真实 AWS CDS Provider；
- 非空的 AWS Provider Message ID。

详细步骤见 [评委测试](docs/JUDGE_TESTING.md)。

## 8. 提交材料

- [中文项目介绍](docs/PROJECT_DESCRIPTION_ZH.md)
- [英文项目介绍，后续 Devpost 使用](docs/PROJECT_DESCRIPTION_EN.md)
- [三分钟 Demo 脚本](docs/DEMO_SCRIPT.md)
- [部署与 CDS 配置](docs/DEPLOYMENT.md)
- [评委测试与证据](docs/JUDGE_TESTING.md)
- [技术架构](docs/AWS_ARCHITECTURE.md)
- [架构图](docs/architecture.svg)
- [审查问题与剩余风险](docs/REVIEW_FINDINGS.md)
- [赛题合规交叉核验](docs/COMPLIANCE_MATRIX.md)
- [提交检查清单](docs/SUBMISSION_CHECKLIST.md)

## 必须采集的比赛证据

- CloudWatch 中的真实 CDS 入站事件；
- AWS CDS 返回的真实 Message ID；
- AgentCore Runtime 调用记录和工具执行轨迹；
- DynamoDB 预约 `version` 从 `1` 更新为 `2`；
- 原时段重新变为可用，并生成候补机会；
- 客户手机或邮箱实际收到消息。

最终提交还需要 AWS Partner Central ACE Opportunity ID，并填写活动代码：

```text
AWS CDS Agentic AI Hackathon -Sept. 2026
```
