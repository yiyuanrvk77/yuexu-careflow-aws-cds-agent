import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const templatePath = resolve(
  "agentcore",
  "cdk",
  "cdk.out",
  "AgentCore-YuexuCareFlow.template.json"
);
const template = JSON.parse(await readFile(templatePath, "utf8"));
const resources = Object.values(template.Resources || {});
const types = new Set(resources.map((resource) => resource.Type));

const requiredTypes = [
  "AWS::BedrockAgentCore::Runtime",
  "AWS::BedrockAgentCore::Memory",
  "AWS::DynamoDB::Table",
  "AWS::Lambda::Function",
  "AWS::SQS::Queue",
  "AWS::SNS::Topic",
  "AWS::Lambda::Url",
  "AWS::ECR::Repository",
  "AWS::CodeBuild::Project"
];

const missing = requiredTypes.filter((type) => !types.has(type));
if (missing.length) {
  console.error(`Missing CloudFormation resources: ${missing.join(", ")}`);
  process.exit(1);
}

const outputs = template.Outputs || {};
for (const output of [
  "JudgeApiUrl",
  "InboundSmsTopicArn",
  "InboundRcsTopicArn",
  "InboundWhatsAppTopicArn",
  "AppointmentTableName"
]) {
  if (!outputs[output]) {
    console.error(`Missing CloudFormation output: ${output}`);
    process.exit(1);
  }
}

const runtime = resources.find((resource) => resource.Type === "AWS::BedrockAgentCore::Runtime");
if (!runtime) process.exit(1);

const topicPolicies = resources.filter(
  (resource) => resource.Type === "AWS::SNS::TopicPolicy"
);
if (topicPolicies.length !== 3) {
  console.error(
    `Expected one merged SNS TopicPolicy per channel, found ${topicPolicies.length}`
  );
  process.exit(1);
}
for (const policy of topicPolicies) {
  const sids = (policy.Properties.PolicyDocument.Statement || []).map(
    (statement) => statement.Sid
  );
  if (
    !sids.includes("AllowPublishThroughSSLOnly") ||
    !sids.includes("AllowCdsEventPublish")
  ) {
    console.error(`SNS TopicPolicy is missing required statements: ${sids.join(", ")}`);
    process.exit(1);
  }
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      templatePath,
      resources: resources.length,
      topicPolicies: topicPolicies.length,
      agentRuntimeBuild: runtime.Properties?.AgentRuntimeArtifact ? "configured" : "missing",
      requiredOutputs: Object.keys(outputs).filter((name) =>
        [
          "JudgeApiUrl",
          "InboundSmsTopicArn",
          "InboundRcsTopicArn",
          "InboundWhatsAppTopicArn",
          "AppointmentTableName"
        ].includes(name)
      )
    },
    null,
    2
  )
);
