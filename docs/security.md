# Security model and limitations

## Intended security property

For a call routed through a wrapped action, the guard invokes the application policy immediately before the handler. The handler executes only if policy returns `allow` and (when configured) the decision and start events are accepted by the event sink. Policy exceptions, invalid principal shape, invalid resources, and invalid policy results do not grant access.

That property is intentionally narrow: **a wrapper can enforce only paths that actually use the wrapper**. The package cannot prove that a user authenticated, an agent ID is genuine, a tenant owns a resource, or another route does not bypass it.

## Trust boundaries

### Trusted inputs

- `context.principal` and `correlationId` must be created by trusted server-side application code.
- `agentId` is an app-defined label, not a cryptographic or globally verified agent identity.
- Tenant membership, resource ownership, role/permission state, and delegated scope must be checked by application policy and/or the resource service.
- `resource()` should derive a stable, appropriate identifier from the request. The policy should verify the identifier against trusted records.

### Untrusted inputs

Treat tool arguments, model output, framework metadata, client-supplied IDs, and any proposed approval status as untrusted. The guard passes action input to policy for evaluation, but does not validate your business schema or make its fields trustworthy.

### Side effects and downstream calls

A wrapper cannot constrain the permissions of a broad database/API credential used by the handler. Keep row-level/tenant-scoped authorization in the resource server, use narrow downstream credentials, and avoid alternate unguarded tool routes.

## Failure behavior

- Policy callback throws or returns an invalid effect: deny with `policy_error` / `invalid_policy_result`; the exception itself is not included in an outcome or event.
- Resource resolver throws or yields malformed metadata: deny with a stable generic code.
- Decision/start event sink fails with default `auditFailure: "fail-closed"`: throw `AuditSinkError`, do not invoke handler. With `fail-open`, the event loss is suppressed and execution can continue.
- Success event sink fails after handler return: the side effect may already have completed. The guard throws `AuditSinkError` with `actionExecuted: true`; check operation state/idempotency before retrying.
- Handler throws: its original error is rethrown; a failure event is best effort. It is not evidence that no partial side effect occurred.

Audit policy is a product choice, not a universal answer. A strict sink improves event completeness but makes an audit outage a write outage. A fail-open sink improves availability but can lose events. Applications should instrument and alert on their chosen policy.

## Event privacy

Events include timestamp, correlation ID, user/agent/tenant/run identifiers (when present), action, resource metadata, outcome/reason, policy version, and duration. They intentionally exclude raw arguments, free-form exceptions, and `principal.claims`. Resource IDs can themselves be sensitive: use opaque IDs or transform events before persistence. Apply access controls, retention limits, and data minimization in your sink.

The current default ID generator is a correlation aid, **not a cryptographic token**. Do not use it as an authorization credential or secret.

## Approval is not implemented

`require_approval` prevents the handler from running and returns a handoff outcome. A production approval system must persist an exact intent (principal/delegation, action, resource, normalized arguments or digest), authenticate and authorize the approver, expire and prevent replay, bind approval to the precise intent, re-check policy at execution time, and run the handler server-side. A model response saying “approved” is not user consent.

## Not provided

No OAuth authorization server, credential vault, authentication/session system, policy language, database authorization, MCP gateway, immutable audit log, spend metering, compliance certification, or guarantee against a malicious/compromised application process.

## Reporting a vulnerability

Until a security contact is configured for the repository, report suspected vulnerabilities privately to the repository owner rather than posting exploit details in a public issue. Do not include real customer data or credentials.
