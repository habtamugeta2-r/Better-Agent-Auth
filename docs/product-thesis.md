# Product thesis: execution-time authorization for agent actions

**Research and thesis snapshot: 7 November 2026.** This is a product hypothesis based on the supplied market/research brief, not a claim of exhaustive live market diligence. Re-check product features, pricing, and standards versions before using it in investor materials.

## Executive recommendation

Build a small, open-source TypeScript library that makes it straightforward for an application to enforce a user's bounded delegation to an agent **at the exact point a tool or business action executes**. Integrate with the application's existing authentication and policy systems. Do not start by building an identity provider, token service, universal agent gateway, or compliance platform.

### One-liner

> Enforce least-privilege agent actions in your TypeScript app, using your existing auth and database.

### Who has the problem?

A developer shipping a tenant-aware agent in a SaaS product who already has users, backend tools, and an agent framework, but has scattered authorization checks, broad service credentials, or inadequate attribution of human/agent/run context.

### Job to be done

“When a model proposes an action, let my server check whether this agent, for this user and tenant, may do this to this resource now; then record the decision and execution result.”

## Why the wedge is credible—but not proven

The problem is not “agents have no identity.” Most production applications already have user, service, and tenant identity. The gap is often the connection between those authenticated principals and a particular tool invocation or business side effect.

The market is not empty. Identity providers, MCP products/gateways, policy engines, authorization SDKs, and agent frameworks each cover adjacent pieces. The potential opening is a composable, app-owned TypeScript integration that does not demand a new control plane. That is a differentiation hypothesis; test it through real integrations, not competitor-count rhetoric or broad agentic-AI TAM numbers.

Standards work (including NIST's AI Agent Standards Initiative) and OAuth-based authorization conventions around protected MCP servers are context and potential interoperability signals—not a finalized universal agent authorization standard or a purchase mandate. MCP authorization is not a substitute for application authorization over business resources.

## Product principles

1. **Execution is the security boundary.** Hiding a tool from a model is not enforcement. Check immediately before the handler.
2. **Keep identities distinct.** Preserve human, agent, tenant, and run. Do not make an agent impersonate its user.
3. **Use existing auth.** Accept trusted principal context; do not issue sessions or OAuth tokens in the first release.
4. **Fail closed deliberately.** Unknown or failed policy does not grant. Make audit sink failure behavior explicit.
5. **Do not invent a policy language.** Let the application or an existing PDP make resource-aware decisions.
6. **Collect minimal telemetry.** Structured decisions and outcomes; no raw tool arguments or secrets by default.
7. **State bypass limits.** Anything not routed through the wrapper is outside the protection.

## MVP scope

### In

- Generic typed action wrapper.
- Server-supplied principal: user ID (optional for system jobs), agent ID, tenant ID (optional), run ID, optional app claims.
- Resource resolver and app-owned authorization callback.
- `allow`, `deny`, and `require_approval` outcomes; deny by default.
- Decision/start/success/failure events with correlation IDs, policy version, duration, and no raw arguments.
- Pluggable event sink; documented strict/fail-open behavior.
- Tests, security model, quickstart, and tenant-aware support-agent demo.
- One adapter only after interviews identify the most common integration boundary (generic function wrapper is the first integration).

### Explicitly out

OAuth server, agent credential issuance/rotation, token vault, hosted dashboard, new policy language, universal RBAC, persistent approval workflow, cross-framework integration matrix, Stripe billing, anomaly detection, compliance exports/certification, multi-agent delegated token protocol, and hard model-spend stops.

## Competition and positioning

| Category | Examples to investigate | What is usually different from this wedge |
|---|---|---|
| Identity and OAuth | Auth0/Okta, WorkOS, Clerk, application auth systems | Authentication, token exchange, identity lifecycle, or hosted authorization support; integrate rather than replace. |
| Enterprise non-human identity/security | Cyera/Oasis and other NHI security vendors | Enterprise inventory, credential governance, posture, and security operations. |
| MCP gateway/proxy | Permit and agent/tool platforms | Central interception and policy/logging across traffic; powerful but changes deployment and becomes an operations/protocol product. |
| General policy engines | Cerbos, OPA, Cedar, OpenFGA | Policy decision/evaluation primitives; the SDK can call them rather than create a policy language. |
| Agent framework hooks | Vercel AI SDK, LangGraph, MCP SDKs, others | Tool lifecycle APIs and execution integration; adapter choice should follow actual pilot demand. |
| Proposed product | Agent Action Guard | In-process point-of-execution wrapper with app-owned principal, policy, storage, and event sink. |

Do not claim “nobody has built this” or “all alternatives are enterprise-only.” Compare actual deployment, enforcement boundary, policy model, and DX for the target use case. A direct path around a gateway or wrapper bypasses its protection; this limitation belongs in positioning and docs.

## Keep cost, audit, and approval claims small

- A function wrapper can count actions it sees and record usage metadata supplied to it. It cannot reliably guarantee a hard limit on model-provider spend, especially with concurrent/in-flight requests and changing provider prices.
- A customer-owned event row is useful operational telemetry, not automatically immutable, complete, tamper-evident, or compliance evidence. It cannot observe bypassed actions.
- An approval response is not a workflow. A full safe flow needs persistence, approver authorization, expiry, replay protection, exact-intent binding, fresh policy evaluation, and server-side resumption. MVP returns a typed handoff only.

## Startup path and business model

Start OSS and self-hosted. The developer using the agent app is the first user; teams are not yet validated as paying buyers. Possible later paid value—only if pilots request it—includes hosted policy rollout, centrally searchable events, team controls, alerting, and support. This creates a security-sensitive hosted service and direct competition with established platforms, so do not assume SaaS conversion or a $29–99/month tier.

If interviews cluster around connecting agents to third-party SaaS accounts, investigate credential brokering instead. If they want cross-client MCP governance, investigate a gateway. Those are materially different products and operational commitments.

## Evidence discipline / source set to revisit

These are primary or product-owner sources suggested for verification; URLs/features can change. Cite exact page versions and access dates in any external pitch:

- NIST AI Agent Standards Initiative: https://www.nist.gov/artificial-intelligence/ai-agent-standards-initiative
- NIST NCCoE: https://www.nccoe.nist.gov/ (search current publications for agent identity and authorization)
- MCP authorization specification: https://modelcontextprotocol.io/specification/latest/basic/authorization
- Auth0 MCP / Agent Gateway product documentation: https://auth0.com/ai/docs
- WorkOS MCP authentication documentation: https://workos.com/docs
- Permit MCP gateway documentation: https://docs.permit.io/
- Cerbos authorization and policy documentation: https://docs.cerbos.dev/
- Cyera corporate newsroom for acquisition announcements: https://www.cyera.io/press
- Fortune Business Insights market reports (broad market context, not this SDK's TAM): https://www.fortunebusinessinsights.com/

The product decision does not depend on a market forecast or an acquisition. Demand evidence must come from developers showing their current code path, workarounds, and willingness to integrate.
