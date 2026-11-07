# Agent Action Guard

**Execution-time authorization for agent actions in TypeScript applications.**

Wrap a server-side function so the application can check **which human, agent, tenant, run, action, and resource** are involved immediately before business logic executes. The package uses your existing authentication and policy code; it does not issue credentials, replace your identity provider, or run a hosted control plane.

> Status: early 0.1.0 prototype. The API and security behavior need real-app validation before production use. This is not a certification or a substitute for database authorization.

## Why this exists

Ordinary user authentication does not answer whether a model-proposed action is permitted for this user and tenant on this particular resource. Agent Action Guard provides a small enforcement wrapper and structured decision/execution events. The policy remains yours.

It is deliberately not a universal “agent IAM” product. The wrapper only protects invocations routed through it. Keep authorization checks in the database/resource service too, especially for writes.

## Install and use

After publishing, install with `npm install agent-action-guard`. To try this checkout before publication:

```sh
npm install
npm run build
```

Then import from `./dist/index.js` in a local script, or use the included demo. The public-package example below shows the intended import:

```ts
import { createGuard } from "agent-action-guard";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const guard = createGuard({
  policyVersion: "2026-11-07",
  authorize: async ({ principal, action, resource, input }) => {
    // This callback is application-owned. Treat tool arguments as unknown/untrusted.
    if (!principal.userId || !principal.tenantId || !isRecord(input)) {
      return { effect: "deny", code: "missing_or_invalid_context" };
    }
    if (
      action === "ticket.read" &&
      await canReadTicket(principal.userId, resource.id)
    ) {
      return { effect: "allow" };
    }
    if (action === "refund.issue" && typeof input.amount === "number" && input.amount > 50) {
      return { effect: "require_approval", code: "refund_limit" };
    }
    return { effect: "deny", code: "not_granted" };
  },
  events: async (event) => {
    await applicationAuditLog.write(event);
  },
});

const issueRefund = guard.action(
  {
    name: "refund.issue",
    resource: (input) => ({ type: "order", id: input.orderId }),
  },
  async (input, context) => {
    // Use tenant-scoped queries and least-privilege downstream credentials here too.
    return refunds.create(context.principal.tenantId!, input);
  },
);

// Build this context on the server from authenticated session/job state.
// Never let the model provide principal, tenant, or approval status.
const result = await issueRefund(
  { orderId: "o_123", amount: 25 },
  {
    principal: {
      userId: session.user.id,
      agentId: "support-agent",
      tenantId: session.tenantId,
      runId: currentAgentRun.id,
    },
    correlationId: requestId,
  },
);

if (result.effect === "allow") {
  return result.value;
}
if (result.effect === "require_approval") {
  // Hand off to your existing approval workflow; the guard does not persist or resume it.
  return requestApproval({ action: result.action, resource: result.resource, code: result.code });
}
return { error: "Action not allowed", code: result.code };
```

The policy callback receives the exact input, but the event sink does **not**. Do not use model-supplied fields as proof of user, tenant, ownership, or approval. Derive these from trusted application state and verify resource ownership against your data store.

## API behavior

- `createGuard({ authorize, events?, policyVersion?, auditFailure?, createId? })`
- `guard.action({ name, resource }, handler)` returns an async function yielding a discriminated `ActionOutcome`.
- Policy effects are `allow`, `deny`, and `require_approval`. Missing/throwing/malformed policy decisions fail closed as a denial with a safe reason code.
- The handler runs only after an `allow` decision and decision/start events have been emitted.
- `require_approval` is only a handoff result. It does not store an intent, authenticate an approver, or resume execution.
- `events` receives decision, start, success, and failure metadata. Raw input, principal claims, prompts, tokens, and thrown exception messages are never copied into events. Reason codes are limited to 1–80 ASCII letters, digits, underscore, dot, colon, or hyphen; invalid codes fall back to a generic code.
- `auditFailure` defaults to `fail-closed`. A sink failure before the handler prevents execution and raises `AuditSinkError` (`actionExecuted === false`). A sink failure after the handler completed raises `AuditSinkError` with `actionExecuted === true`; inspect it and do not blindly retry a non-idempotent write. `fail-open` suppresses telemetry failures and permits execution, so choose it consciously.
- Handler exceptions are rethrown. The guard makes a best-effort failure event and does not replace the original error if that event also fails.

## Try locally

```sh
npm install
npm test
npm run demo
```

The demo shows a tenant-aware read, a refund approval handoff, and metadata-only event output. The test suite covers fail-closed policy behavior, approval non-execution, redaction boundaries, and audit sink failure semantics.

## Security boundary

This is an in-process policy enforcement point, not an identity provider, gateway, sandbox, or security guarantee. Any direct call to the handler, downstream service, database, or alternate tool route bypasses this wrapper. For consequential operations:

1. Make the guarded function the only route to the side effect.
2. Re-check tenant/resource authorization in the data or resource service.
3. Use least-privilege credentials downstream.
4. Add idempotency and concurrency controls for writes; a policy decision is not a reservation.
5. Treat approval as a separate server-side workflow bound to exact action/resource/arguments, with expiry, replay protection, and fresh authorization at execution.
6. Pick an event sink and retention policy appropriate to your data. These events are operational telemetry, not tamper-evident evidence or a compliance certification.

See [Security and limitations](docs/security.md), [Product thesis and validation plan](docs/product-thesis.md), [Founder/developer validation playbook](docs/validation-playbook.md), and the [pre-release checklist](docs/release-checklist.md). Contributions and local checks are described in [CONTRIBUTING.md](CONTRIBUTING.md).

## Project direction

The initial bet is an open-source, self-hostable TypeScript authorization wrapper. Before adding framework adapters, a hosted dashboard, credential brokering, cost estimates, or persistent approvals, validate that real teams can integrate this core in under 15 minutes and keep it in production. The name **Agent Action Guard** avoids suggesting an official affiliation with Better Auth; integrations should remain provider-neutral.
