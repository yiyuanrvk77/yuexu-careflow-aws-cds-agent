import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeInboundMessage,
  normalizeLambdaChannelEvent
} from "../src/adapters/normalize-channel-event.js";

test("normalizer maps a WhatsApp Cloud API message to the internal envelope", () => {
  const result = normalizeInboundMessage({
    channel: "whatsapp",
    payload: {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: "wamid.demo",
                    from: "8613800000001",
                    timestamp: "1770000000",
                    text: { body: "我想改约" }
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  });

  assert.equal(result.channel, "whatsapp");
  assert.equal(result.from, "8613800000001");
  assert.equal(result.externalMessageId, "wamid.demo");
  assert.equal(result.text, "我想改约");
});

test("SNS records are unwrapped into normalized channel events", () => {
  const result = normalizeLambdaChannelEvent(
    {
      Records: [
        {
          Sns: {
            MessageId: "sns-1",
            TopicArn: "arn:aws:sns:us-east-1:123456789012:rcs-inbound",
            Message: JSON.stringify({
              from: "+8613800000001",
              to: "rcs-a1b2c3d4",
              messageId: "rcs-msg-1",
              text: "查看预约"
            })
          }
        }
      ]
    },
    "rcs"
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].channel, "rcs");
  assert.equal(result[0].text, "查看预约");
  assert.equal(result[0].metadata.snsMessageId, "sns-1");
});
