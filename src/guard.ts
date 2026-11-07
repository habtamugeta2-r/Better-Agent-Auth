import type {
  ActionContext,
  ActionDefinition,
  ActionOutcome,
  ActionResource,
  AgentPrincipal,
  AuthorizationResult,
  DecisionEvent,
  EventSink,
  ExecutionEvent,
  GuardEvent,
  GuardOptions,
} from "./types.js";

let fallbackId = 0;

/** Indicates that the audit sink failed. Check actionExecuted before retrying writes. */
export class AuditSinkError extends Error {
  readonly actionExecuted: boolean;
  readonly correlationId: string;

  constructor(cause: unknown, correlationId: string, actionExecuted: boolean) {
    super(
      actionExecuted
        ? "The action completed, but its final audit event could not be written. Do not blindly retry."
        : "The audit event could not be written; the protected action was not executed.",
      { cause },
    );
    this.name = "AuditSinkError";
    this.correlationId = correlationId;
    this.actionExecuted = actionExecuted;
  }
}

function defaultId(): string {
  fallbackId += 1;
  return `aag_${Date.now().toString(36)}_${fallbackId.toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function safePrincipal(principal: unknown): DecisionEvent["principal"] {
  if (!validPrincipal(principal)) return { agentId: "unknown", runId: "unknown" };
  return {
    ...(principal.userId === undefined ? {} : { userId: principal.userId }),
    agentId: principal.agentId,
    ...(principal.tenantId === undefined ? {} : { tenantId: principal.tenantId }),
    runId: principal.runId,
  };
}

function validResource(resource: unknown): resource is ActionResource {
  if (!resource || typeof resource !== "object") return false;
  const candidate = resource as Record<string, unknown>;
  return typeof candidate.type === "string" && candidate.type.length > 0 &&
    typeof candidate.id === "string" && candidate.id.length > 0;
}

function validPrincipal(principal: unknown): principal is AgentPrincipal {
  if (!principal || typeof principal !== "object") return false;
  const candidate = principal as Record<string, unknown>;
  return typeof candidate.agentId === "string" && candidate.agentId.length > 0 &&
    typeof candidate.runId === "string" && candidate.runId.length > 0 &&
    (candidate.userId === undefined || typeof candidate.userId === "string") &&
    (candidate.tenantId === undefined || typeof candidate.tenantId === "string");
}

function validResult(value: unknown): value is AuthorizationResult {
  if (!value || typeof value !== "object") return false;
  const effect = (value as Record<string, unknown>).effect;
  return effect === "allow" || effect === "deny" || effect === "require_approval";
}

function safeReasonCode(value: unknown, fallback: string): string {
  return typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,80}$/.test(value) ? value : fallback;
}

export function createGuard<P extends AgentPrincipal = AgentPrincipal>(options: GuardOptions<P>) {
  const id = options.createId ?? defaultId;
  const sink: EventSink = options.events ?? (() => undefined);
  const auditFailure = options.auditFailure ?? "fail-closed";

  async function emit(event: GuardEvent, correlationId: string, actionExecuted: boolean): Promise<void> {
    try {
      await sink(event);
    } catch (cause) {
      if (auditFailure === "fail-closed") {
        throw new AuditSinkError(cause, correlationId, actionExecuted);
      }
    }
  }

  function decisionEvent(
    context: ActionContext<P>,
    action: string,
    effect: DecisionEvent["effect"],
    code: string,
    resource?: ActionResource,
  ): DecisionEvent {
    return {
      type: "authorization.decision",
      eventId: id(),
      occurredAt: new Date().toISOString(),
      correlationId: context.correlationId ?? id(),
      principal: safePrincipal(context.principal),
      action,
      ...(resource === undefined ? {} : { resource }),
      effect,
      code,
      ...(options.policyVersion === undefined ? {} : { policyVersion: options.policyVersion }),
    };
  }

  function executionEvent(
    type: ExecutionEvent["type"],
    context: ActionContext<P>,
    action: string,
    resource: ActionResource,
    durationMs?: number,
  ): ExecutionEvent {
    return {
      type,
      eventId: id(),
      occurredAt: new Date().toISOString(),
      correlationId: context.correlationId ?? id(),
      principal: safePrincipal(context.principal),
      action,
      resource,
      ...(durationMs === undefined ? {} : { durationMs }),
    };
  }

  return {
    action<I, O>(definition: ActionDefinition<I, P>, handler: (input: I, context: ActionContext<P> & { action: string; resource: ActionResource }) => O | Promise<O>) {
      if (!definition.name || typeof definition.name !== "string") {
        throw new TypeError("Action name must be a non-empty string");
      }

      return async (input: I, context: ActionContext<P>): Promise<ActionOutcome<Awaited<O>>> => {
        const correlationId = context?.correlationId ?? id();
        const normalizedContext = { ...context, correlationId } as ActionContext<P>;
        const deny = async (code: string, resource?: ActionResource): Promise<ActionOutcome<Awaited<O>>> => {
          await emit(decisionEvent(normalizedContext, definition.name, "deny", code, resource), correlationId, false);
          return { effect: "deny", code, action: definition.name, ...(resource ? { resource } : {}), correlationId };
        };

        if (!context || !validPrincipal(context.principal)) return deny("invalid_principal");
        const trustedContext = {
          ...normalizedContext,
          // Snapshot and freeze top-level identity attributes for this invocation.
          principal: Object.freeze({ ...context.principal }) as P,
        };

        let resource: ActionResource;
        try {
          resource = await definition.resource(input, trustedContext);
        } catch {
          return deny("resource_resolution_failed");
        }
        if (!validResource(resource)) return deny("invalid_resource");
        // Keep the policy, event sink, and handler from sharing a mutable resource object.
        resource = Object.freeze({ type: resource.type, id: resource.id });

        let result: AuthorizationResult;
        try {
          result = await options.authorize({
            principal: trustedContext.principal,
            action: definition.name,
            resource,
            input,
            correlationId,
          });
        } catch {
          return deny("policy_error", resource);
        }
        if (!validResult(result)) return deny("invalid_policy_result", resource);

        const fallbackCode = result.effect === "allow" ? "allowed" : result.effect === "deny" ? "not_granted" : "approval_required";
        const code = safeReasonCode(result.code, fallbackCode);
        await emit(decisionEvent(trustedContext, definition.name, result.effect, code, resource), correlationId, false);

        if (result.effect === "deny") {
          return { effect: "deny", code, action: definition.name, resource, correlationId };
        }
        if (result.effect === "require_approval") {
          return { effect: "require_approval", code, action: definition.name, resource, correlationId };
        }

        await emit(executionEvent("action.started", trustedContext, definition.name, resource), correlationId, false);
        const startedAt = Date.now();
        try {
          const handlerContext = { ...trustedContext, action: definition.name, resource };
          const value = await handler(input, handlerContext);
          await emit(executionEvent("action.succeeded", trustedContext, definition.name, resource, Date.now() - startedAt), correlationId, true);
          return { effect: "allow", value: value as Awaited<O>, action: definition.name, resource, correlationId };
        } catch (error) {
          if (!(error instanceof AuditSinkError)) {
            try {
              await emit(executionEvent("action.failed", trustedContext, definition.name, resource, Date.now() - startedAt), correlationId, true);
            } catch {
              // Preserve the business handler's original error; never obscure its failure with telemetry failure.
            }
          }
          throw error;
        }
      };
    },
  };
}
