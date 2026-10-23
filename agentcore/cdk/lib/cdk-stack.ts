import { resolve } from "node:path";
import {
  AgentCoreApplication,
  type AgentCoreApplicationProps
} from "@aws/agentcore-cdk";
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps
} from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";

export interface AgentCoreStackProps extends StackProps {
  application: AgentCoreApplicationProps;
}

function addCdsPublishPermission(topic: sns.Topic, principals: string[]) {
  // addToResourcePolicy mutates the Topic's existing policy. Creating another
  // AWS::SNS::TopicPolicy for the same topic would overwrite the HTTPS-only rule.
  topic.addToResourcePolicy(
    new iam.PolicyStatement({
      sid: "AllowCdsEventPublish",
      actions: ["sns:Publish"],
      principals: principals.map((principal) => new iam.ServicePrincipal(principal)),
      resources: [topic.topicArn],
      conditions: {
        StringEquals: {
          "AWS:SourceAccount": Stack.of(topic).account
        }
      }
    })
  );
}

export class AgentCoreStack extends Stack {
  public readonly application: AgentCoreApplication;

  constructor(scope: Construct, id: string, props: AgentCoreStackProps) {
    super(scope, id, props);
    this.application = new AgentCoreApplication(this, "Application", props.application);

    const table = new dynamodb.Table(this, "AppointmentCore", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: "expiresAt",
      removalPolicy: RemovalPolicy.RETAIN
    });
    table.addGlobalSecondaryIndex({
      indexName: "SlotsByDate",
      partitionKey: { name: "gsi1pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "gsi1sk", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });

    const deadLetterQueue = new sqs.Queue(this, "InboundDeadLetterQueue", {
      retentionPeriod: Duration.days(14),
      enforceSSL: true
    });
    const inboundQueue = new sqs.Queue(this, "InboundQueue", {
      visibilityTimeout: Duration.minutes(6),
      retentionPeriod: Duration.days(4),
      enforceSSL: true,
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 5
      }
    });

    const smsTopic = new sns.Topic(this, "InboundSmsTopic", {
      displayName: "Yuexu CDS inbound SMS",
      enforceSSL: true
    });
    const rcsTopic = new sns.Topic(this, "InboundRcsTopic", {
      displayName: "Yuexu CDS inbound RCS",
      enforceSSL: true
    });
    const whatsappTopic = new sns.Topic(this, "InboundWhatsAppTopic", {
      displayName: "Yuexu CDS inbound WhatsApp",
      enforceSSL: true
    });

    addCdsPublishPermission(smsTopic, ["pinpoint.amazonaws.com"]);
    addCdsPublishPermission(rcsTopic, ["pinpoint.amazonaws.com"]);
    addCdsPublishPermission(whatsappTopic, [
      "social-messaging.amazonaws.com"
    ]);

    smsTopic.addSubscription(new subscriptions.SqsSubscription(inboundQueue));
    rcsTopic.addSubscription(new subscriptions.SqsSubscription(inboundQueue));
    whatsappTopic.addSubscription(new subscriptions.SqsSubscription(inboundQueue));

    const appointmentRuntime = this.application.runtime("appointment");
    appointmentRuntime.grantReadWrite(table);
    appointmentRuntime.addEnvironmentVariable("APPOINTMENT_TABLE", table.tableName);
    appointmentRuntime.addEnvironmentVariable(
      "BEDROCK_MODEL_ID",
      process.env.BEDROCK_MODEL_ID || "amazon.nova-pro-v1:0"
    );
    appointmentRuntime.addEnvironmentVariable(
      "BUSINESS_TIMEZONE",
      process.env.BUSINESS_TIMEZONE || "Asia/Shanghai"
    );

    const channelHandler = new lambda.Function(this, "ChannelOrchestrator", {
      code: lambda.Code.fromAsset(resolve(__dirname, "../../../../lambda"), {
        exclude: [
          "**/*.ts",
          "**/*.map",
          "tsconfig.json",
          "test/**",
          ".env",
          ".env.*"
        ]
      }),
      handler: "dist/channel-inbound.handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 1024,
      timeout: Duration.seconds(90),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        APPOINTMENT_TABLE: table.tableName,
        AGENT_RUNTIME_ARN: appointmentRuntime.runtimeArn,
        SEND_CHANNEL_MESSAGES: process.env.SEND_CHANNEL_MESSAGES || "true",
        EUM_SMS_ORIGINATION_IDENTITY:
          process.env.EUM_SMS_ORIGINATION_IDENTITY || "",
        EUM_RCS_ORIGINATION_IDENTITY:
          process.env.EUM_RCS_ORIGINATION_IDENTITY || "",
        WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
        WHATSAPP_META_API_VERSION:
          process.env.WHATSAPP_META_API_VERSION || "",
        SES_FROM_ADDRESS: process.env.SES_FROM_ADDRESS || "",
        ALLOWED_TEST_NUMBERS: process.env.ALLOWED_TEST_NUMBERS || "",
        DEMO_API_TOKEN: process.env.DEMO_API_TOKEN || "",
        SMS_TOPIC_ARN: smsTopic.topicArn,
        RCS_TOPIC_ARN: rcsTopic.topicArn,
        WHATSAPP_TOPIC_ARN: whatsappTopic.topicArn,
        BUSINESS_TIMEZONE: process.env.BUSINESS_TIMEZONE || "Asia/Shanghai"
      }
    });

    table.grantReadWriteData(channelHandler);
    appointmentRuntime.grantInvoke(channelHandler);
    channelHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["sms-voice:SendTextMessage", "sms-voice:SendRcsMessage"],
        resources: ["*"]
      })
    );
    channelHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["social-messaging:SendWhatsAppMessage"],
        resources: ["*"]
      })
    );
    channelHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail"],
        resources: ["*"]
      })
    );

    channelHandler.addEventSource(
      new SqsEventSource(inboundQueue, {
        batchSize: 5,
        reportBatchItemFailures: true
      })
    );

    const judgeUrl = channelHandler.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
        allowedHeaders: ["content-type", "x-demo-token"],
        allowedMethods: [lambda.HttpMethod.POST]
      }
    });

    new CfnOutput(this, "JudgeApiUrl", {
      value: judgeUrl.url,
      description: "Token-protected Lambda Function URL for judge-side message testing"
    });
    new CfnOutput(this, "InboundSmsTopicArn", {
      value: smsTopic.topicArn,
      description: "Configure this SNS topic as the SMS two-way messaging destination"
    });
    new CfnOutput(this, "InboundRcsTopicArn", {
      value: rcsTopic.topicArn,
      description: "Configure this SNS topic as the RCS two-way messaging destination"
    });
    new CfnOutput(this, "InboundWhatsAppTopicArn", {
      value: whatsappTopic.topicArn,
      description: "Configure this SNS topic as the WhatsApp event destination"
    });
    new CfnOutput(this, "AppointmentTableName", {
      value: table.tableName,
      description: "DynamoDB table used by the runtime and seed script"
    });
    new CfnOutput(this, "AgentRuntimeArn", {
      value: appointmentRuntime.runtimeArn,
      description: "AgentCore Runtime ARN"
    });
  }
}
