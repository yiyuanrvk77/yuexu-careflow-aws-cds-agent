# 提交检查清单

## 硬性要求

- [ ] 已部署到真实 AWS 账号；
- [ ] 演示中发生真实 AWS CDS 发送或接收；
- [ ] AgentCore 或真实 LLM Agent 执行推理；
- [ ] Agent 调用业务工具并改变预约状态；
- [ ] GitHub/GitLab 仓库包含可检测的开源许可证；
- [ ] README 包含部署和测试说明；
- [ ] 系统架构图；
- [ ] 英文项目介绍；
- [ ] 约三分钟 Demo 视频；
- [ ] 评委测试方式；
- [ ] Devpost 填写 ACE Opportunity ID；
- [ ] ACE 活动代码为 `AWS CDS Agentic AI Hackathon -Sept. 2026`。

## AWS 证据

- [ ] AgentCore Runtime 部署成功；
- [ ] AgentCore Memory 部署成功；
- [ ] DynamoDB 包含演示预约和时段；
- [ ] 真实 CDS 消息成功收发；
- [ ] 响应包含 AWS Provider Message ID；
- [ ] CloudWatch 包含 Lambda 日志；
- [ ] AgentCore Observability 包含工具调用；
- [ ] 预约 version 发生变化；
- [ ] 原时段释放并生成候补机会。

## Demo 视频

- [ ] 前 20 秒说明问题和目标用户；
- [ ] 出现真实 CDS 消息；
- [ ] 展示 AgentCore 工具调用；
- [ ] Agent 要求客户明确确认；
- [ ] 展示业务系统状态变化；
- [ ] 客户实际收到 CDS 结果；
- [ ] 说明架构和商业价值。

## 仓库安全

- [ ] 未提交 `.env`、手机号、Token、账号 ID 或 AWS 凭证；
- [ ] `agentcore/aws-targets.json` 不包含敏感信息；
- [ ] 截图不暴露客户 PII 或密钥；
- [ ] README 清楚区分本地模拟与 AWS 正式部署。
