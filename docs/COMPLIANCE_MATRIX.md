# 赛题合规交叉核验

核验日期：2026-10-23

## 总体结论

当前状态是：**技术工程可构建，比赛交付未完成。**

代码已经包含 AWS CDK、AgentCore Runtime、Bedrock Agent、业务工具和真实 CDS SDK 调用，并通过 CloudFormation 合成。以下关键证据仍然缺失：

- AWS 实际部署；
- 真实 CDS 收发；
- 真实 Bedrock Agent 工具执行；
- GitHub/GitLab 仓库；
- 三分钟 Demo 视频；
- ACE Opportunity ID。

因此当前不能提交为最终参赛作品。

## 核心要求

| 赛题要求 | 当前状态 | 证据 | 结论 |
|---|---|---|---|
| AWS Partner 资格 | 未知 | 仓库中无 APN 资格证明 | **提交前必须确认** |
| 项目在比赛提交期内新创建 | 基本满足 | 项目在当前比赛周期内建立 | 保留创建时间证据 |
| 部署在 AWS | 未完成 | `agentcore/aws-targets.json` 为空，没有部署输出 | **不满足** |
| 真实集成至少一个 CDS | 代码满足，运行未验证 | Lambda 调用 SMS、RCS、WhatsApp、SES SDK | **代码通过，证据缺失** |
| Agentic AI 推理 | 代码满足，运行未验证 | AgentCore Runtime + Strands + Bedrock + 工具 | **代码通过，证据缺失** |
| Agent 调用工具执行业务 | 代码满足，运行未验证 | DynamoDB 查询、Hold、改约、取消、候补 | **代码通过，证据缺失** |
| 商业价值 | 方案满足，数据缺失 | 预约改约、爽约、候补和前台工时 | 需要真实试点或清晰 ROI |

## AWS CDS 运行路径

当前代码中的路径：

```text
AWS CDS 入站
→ SNS Topic
→ SQS + DLQ
→ Lambda
→ AgentCore Runtime
→ Strands + Bedrock
→ DynamoDB 业务工具
→ Lambda
→ AWS CDS 出站
```

| 检查项 | 状态 |
|---|---|
| `SendTextMessageCommand` | 已实现 |
| `SendRcsMessageCommand` | 已实现 |
| `SendWhatsAppMessageCommand` | 已实现 |
| SES v2 `SendEmailCommand` | 已实现 |
| AgentCore `InvokeAgentRuntimeCommand` | 已实现 |
| CDS 入站 SNS/SQS | 已实现 |
| CDS Provider Message ID 返回 | 已实现 |
| 真实 Message ID | 未采集 |
| CloudWatch 入站记录 | 未采集 |
| AgentCore Trace | 未采集 |

## Agentic AI 能力

| 检查项 | 状态 |
|---|---|
| AgentCore Runtime | 已实现并通过 CDK 合成 |
| AgentCore Memory | 已实现并通过 CDK 合成 |
| Bedrock 模型调用 | 代码已实现 |
| 真实模型调用 | 未验证 |
| Strands 工具选择 | 已实现 |
| 真实工具 Trace | 未采集 |
| 多轮状态 | DynamoDB + AgentCore Session |
| 明确确认 | 系统提示词 + 工具层校验 |
| 并发保护 | Hold + DynamoDB 事务 + 会话锁 |
| 入站幂等 | 已实现 |

## 最终提交材料

| 提交材料 | 当前状态 | 说明 |
|---|---|---|
| 可运行的 AWS 部署方案 | 部分满足 | 可合成但未部署 |
| GitHub/GitLab 仓库 | 不满足 | 当前目录不是 Git 仓库 |
| 运行说明 | 已满足 | README 和 DEPLOYMENT |
| AWS CDS 实际调用代码 | 已满足 | 四类 CDS SDK 调用 |
| 系统架构图 | 已满足 | 中文 SVG/PNG |
| 英文项目介绍 | 已有初稿 | 需要补充真实部署结果 |
| 约三分钟 Demo 视频 | 不满足 | 没有录屏文件 |
| 评委测试方式 | 部分满足 | 文档完整，但 URL/Token 未部署 |
| ACE Opportunity ID | 不满足 | 尚未创建或填写 |
| 开源许可证 | 已满足 | MIT |

## 需要立即补齐的顺序

1. 确认参赛主体是 AWS Partner Network 注册伙伴。
2. 配置 AWS Profile、目标区域和 Bedrock 模型权限。
3. 选择一个最快可用的 CDS 渠道：
   - RCS 测试 Agent：通常最快；
   - 双向短信号码；
   - WhatsApp WABA 视审核时间决定是否作为补充。
4. 运行 `agentcore deploy`。
5. 执行 `scripts/seed-demo.mjs`。
6. 发送真实 CDS 入站消息并完成改约。
7. 采集 CloudWatch、AgentCore Trace、DynamoDB 和 CDS Message ID。
8. 录制三分钟视频。
9. 初始化 Git 仓库并推送到 GitHub/GitLab。
10. 创建 ACE Opportunity，并回填 Opportunity ID。
11. 用真实结果更新英文项目介绍。

## 建议的降风险策略

不要为了展示多渠道而同时卡在四个渠道的注册上。

比赛只要求至少一个 CDS 服务，推荐：

- 主演示：RCS 测试 Agent 或双向 SMS；
- 结果凭证：SES 确认邮件；
- WhatsApp 完成 WABA 后再加入；
- 不把 SES 入站、自动候补邀约和人工接管作为比赛阻塞项。

## 最终判断

- 技术方案：**可进入真实部署阶段**；
- 代码合规：**核心调用路径基本满足**；
- 比赛提交：**尚未满足**；
- 当前最大风险：**没有真实 AWS/CDS 证据，而不是缺少代码。**
