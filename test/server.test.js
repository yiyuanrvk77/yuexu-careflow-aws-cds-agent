import test from "node:test";
import assert from "node:assert/strict";
import { createDemoServer } from "../src/server.js";

test("HTTP demo serves the UI and supports a message round-trip", async (t) => {
  const server = createDemoServer({ now: new Date("2026-10-23T09:00:00+08:00") });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const page = await fetch(baseUrl);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /约序 CareFlow/);

  const bootstrap = await fetch(`${baseUrl}/api/bootstrap`).then((response) => response.json());
  assert.equal(bootstrap.product.name, "约序");
  assert.equal(bootstrap.conversations.length >= 4, true);

  const messageResponse = await fetch(`${baseUrl}/api/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      channel: "whatsapp",
      identifier: "+8613800000001",
      text: "我想改约"
    })
  });
  assert.equal(messageResponse.status, 200);
  const messagePayload = await messageResponse.json();
  assert.equal(messagePayload.snapshot.activeConversation.messages.at(-1).kind, "slot_options");
});
