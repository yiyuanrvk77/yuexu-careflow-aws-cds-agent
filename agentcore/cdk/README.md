# 约序 AWS CDK Stack

该 CDK 项目基于官方 AgentCore Runtime Construct，并增加：

- DynamoDB 预约、时段、会话、幂等和候补状态；
- SQS 入站队列与死信队列；
- SMS、RCS、WhatsApp 三个 SNS 入站 Topic；
- 调用 AgentCore 和 AWS CDS 的 Lambda 渠道编排函数；
- 受 Token 与号码白名单保护的评委 Function URL；
- 最小权限 IAM 和 CloudWatch/X-Ray。

部署通过仓库根目录的 AgentCore CLI 完成。CDK 合成时需要配置 CDS Origination Identity、AgentCore Runtime 和其他部署参数。
