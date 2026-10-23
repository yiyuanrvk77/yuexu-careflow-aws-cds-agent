# Yuexu CareFlow: Agentic Appointment Operations on AWS CDS

This file is retained for the final Devpost submission. The primary working
documentation is now written in Chinese.

Yuexu is an Agentic AI appointment operations assistant built with AWS
Communication Developer Services and Amazon Bedrock AgentCore. It receives
customer messages through AWS CDS, verifies the customer identity, reasons over
the requested appointment action, calls business tools, and sends the result
back through a real AWS communication channel.

The MVP supports inbound SMS, RCS, and WhatsApp, and outbound SMS, RCS,
WhatsApp, and email. The Agent can retrieve an appointment, search available
slots, place a temporary hold, reschedule or cancel an appointment after
explicit confirmation, and create a waitlist opportunity when a slot is
released.

Customer identity mapping, conversation state, idempotency, and concurrency
control are persisted in Amazon DynamoDB. AgentCore Runtime hosts the Strands
Agent and Memory, while a Lambda channel orchestrator normalizes SQS events,
invokes the Runtime, and calls the AWS CDS SDK.

The solution is designed for appointment-based service businesses such as
dental clinics, diagnostic centers, auto service, beauty, and veterinary
providers. The initial business targets are reduced staff handling time,
reduced appointment no-shows, faster rescheduling, and recovered appointment
capacity.
