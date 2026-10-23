# 技术审查问题与修复记录

## 已修复

### 严重：SNS Topic Policy 相互覆盖

原实现为同一 Topic 创建了独立的 HTTPS Policy 和 CDS 发布 Policy。CloudFormation 中同一 Topic 的多个 Policy 资源可能互相覆盖。

现在通过 `Topic.addToResourcePolicy` 合并语句。合成结果已校验：每个 Topic 只有一个 Policy，同时包含 HTTPS 限制和 CDS 发布权限。

### 严重：入站消息重复处理

SNS/SQS 重投可能重复调用 Agent 或重复发送。Lambda 现在使用渠道、发送方和 Provider Message ID 创建七天幂等记录。

已完成的消息再次投递时只返回已有结果，不重复调用 Agent。卡在 processing 状态的记录可以在五分钟后接管。

### 严重：跨渠道身份割裂

原实现使用原始手机号或邮箱生成 AgentCore Session。现在先通过 DynamoDB Identity Mapping 解析统一 `customerId`，再生成 Session、Actor、会话存储和客户级锁。

### 高：并发消息竞争

增加客户级 DynamoDB 会话锁。锁有效期为 90 秒，释放时必须匹配 Owner，防止不同渠道并发修改同一个客户的预约。

### 高：时间字符串不可比较

种子数据原来使用 `+08:00`，运行时使用 UTC `Z`。DynamoDB 只按字符串比较，跨日边界可能出错。

现在 `startsAt` 统一存 UTC ISO 时间，同时保留本地 `date` 和 `time` 用于查询与客户回复。

### 高：改约可以绕过有效 Hold

改约事务现在要求新时段处于 `held` 状态、由同一客户持有，并且 `holdExpiresAt > now`。

### 高：评委接口超时

同步评委入口从 API Gateway 改为 Lambda Function URL，函数超时为 90 秒，避免 AgentCore 冷启动加工具调用超过 30 秒。

### 中：种子数据不是幂等

预约排序键原来包含随机 UUID，重复执行会创建多个有效预约。现在使用确定性预约 ID。

### 中：PII 暴露

- 原始手机号和邮箱不再放入模型提示词；
- 幂等和消息记录保存身份哈希，不保存原始发送方字段；
- 消息设置 90 天 DynamoDB TTL。

### 中：确认逻辑不完整

工具层现在拒绝“不确认”等否定表达，并支持 `yes`、`okay`、`好的`等明确短确认。

## 上线前仍需完成

- 在真实 AWS 账号部署；
- 真实收发 SMS、RCS、WhatsApp 或 SES；
- 验证 CDS 服务主体可以向目标 SNS Topic 发布；
- 在 AWS CodeBuild 构建 ARM64 容器；
- 按需增加 SES 入站 Receipt Rule；
- 增加自动候补邀约、人工接管和 EventBridge 提醒；
- 增加多租户隔离和客户预约系统连接器；
- 比赛结束后关闭或更换公开 Function URL。

## 当前范围限制

- 单租户、单门店；
- 当前演示服务类型只有 `dental-cleaning`；
- SMS/RCS/WhatsApp 入站，邮件仅出站；
- 不提供临床决策；
- 本地运营台未部署到 AWS，不是正式运营后台。
