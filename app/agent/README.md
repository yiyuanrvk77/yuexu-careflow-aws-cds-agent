# 约序 AgentCore Runtime

该目录实现 Amazon Bedrock AgentCore HTTP Runtime，使用官方 `bedrock-agentcore` SDK。

Strands Agent 提供以下业务工具：

- 验证入站客户身份；
- 查询未来预约；
- 查询可约时段；
- 锁定五分钟时段；
- 原子改约或取消预约；
- 加入候补。

预约数据保存在 DynamoDB。CDK 会向 Runtime 注入：

- `APPOINTMENT_TABLE`
- `MEMORY_AGENTMEMORY_ID`
- `BEDROCK_MODEL_ID`
- `BUSINESS_TIMEZONE`

构建：

```powershell
npm.cmd install
npm.cmd run build
```

容器监听 `0.0.0.0:8080`，实现 AgentCore 要求的：

- `POST /invocations`
- `GET /ping`
