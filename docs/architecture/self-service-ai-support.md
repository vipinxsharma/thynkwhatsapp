# Self-Service and AI Support Architecture

## Product requirement

thynkWISE Messaging Cloud must operate as a self-service SaaS product. A customer should be able to create an account, create or join a workspace, connect WhatsApp through Meta Embedded Signup, configure messaging, subscribe, and resolve routine issues without manual provisioning by the thynkWISE team.

Support must be available through in-product chat and email. An AI assistant can diagnose and resolve supported issues, but it must act within the authenticated customer's workspace and permissions.

## Non-negotiable boundaries

- Identity, workspace, role, billing state, WABA, and phone-number ownership are determined on the server. The browser cannot choose a tenant identifier.
- Every record, event, support case, knowledge retrieval, and AI tool invocation is tenant-scoped.
- Sensitive tokens and personal data are redacted from model prompts, logs, email, and analytics.
- The AI can only run approved, typed tools. Destructive, financial, compliance-sensitive, or Meta-account ownership actions require explicit confirmation and, where necessary, human escalation.
- All AI actions produce an audit record containing the actor, tenant, case, tool, inputs after redaction, result, and timestamp.
- Tool calls are idempotent or protected by idempotency keys so retries cannot duplicate messages, campaigns, charges, or account changes.
- Low-confidence, policy-blocked, repeated-failure, security, billing, and account-restriction cases are escalated with the diagnostic context already collected.

## Support flow

1. Receive a chat message or inbound support email and authenticate or safely identify the customer.
2. Attach the interaction to a tenant-scoped case.
3. Classify the request and retrieve only that tenant's data plus approved product knowledge.
4. Explain the diagnosis and, when permitted, run a safe remediation tool.
5. Verify the outcome from the source system instead of treating a submitted request as success.
6. Mark the case resolved, request customer input, or escalate it to a human queue.

Suggested case states are `received`, `triaged`, `awaiting_customer`, `auto_resolved`, `escalated`, and `closed`.

## Delivery sequence

1. Security foundation: signed identity, server-derived tenant context, role checks, tenant isolation, and authenticated event streams.
2. Durable self-service identity: signup, email verification, workspace creation, invitations, password recovery, session revocation, and audit logs.
3. Self-service commercial onboarding: plans, trials, subscription state, usage limits, and billing recovery.
4. Meta onboarding: Embedded Signup with durable WABA and phone-number ownership mapping plus webhook routing by WABA.
5. Support case system: chat and email ingestion, knowledge base, SLA state, and human escalation.
6. AI resolution: tenant-safe retrieval, approved diagnostic/remediation tools, confidence gates, confirmation gates, and outcome verification.

The application must not be described as production-ready until each gate has separate evidence for code, deployment, provider acceptance, received events, and live customer behavior.
