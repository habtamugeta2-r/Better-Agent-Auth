export interface AgentPrincipal {
  /** Authenticated human who delegated the action. Omit for system-initiated work. */
  userId?: string;
  /** Application-owned agent/runtime identity; not a globally verified identity. */
  agentId: string;
  /** Tenant or workspace derived by trusted server code. */
  tenantId?: string;
  /** Correlates actions with one agent run. */
  runId: string;
  /** Optional app-specific, non-secret attributes. Never copied to emitted events. */
  claims?: Readonly<Record<string, unknown>>;
}

export interface ActionResource {
  type: string;
  /** Prefer opaque identifiers. This value is emitted to the event sink. */
  id: string;
}

export interface ActionContext<P extends AgentPrincipal = AgentPrincipal> {
  /** Must be constructed from trusted server-side authentication/session state. */
  principal: P;
  /** Optional app-generated ID linking this action to request and provider logs. */
  correlationId?: string;
}

export interface AuthorizationRequest<P extends AgentPrincipal, I> {
  principal: P;
  action: string;
  resource: ActionResource;
  input: I;
  correlationId?: string;
}

export type PolicyEffect = "allow" | "deny" | "require_approval";

export interface AuthorizationResult {
  effect: PolicyEffect;
  /** Stable, non-sensitive code suitable for application logic and event records. */
  code?: string;
}

export type PolicyInput<P extends AgentPrincipal, I> = AuthorizationRequest<P, I>;

export interface ActionDefinition<I, P extends AgentPrincipal> {
  name: string;
  resource: (input: I, context: ActionContext<P>) => ActionResource | Promise<ActionResource>;
}

export interface ActionHandler<I, O, P extends AgentPrincipal> {
  (input: I, context: ActionContext<P> & { action: string; resource: ActionResource }): O | Promise<O>;
}

export type ActionOutcome<O> =
  | { effect: "allow"; value: O; action: string; resource: ActionResource; correlationId: string }
  | { effect: "deny"; code: string; action: string; resource?: ActionResource; correlationId: string }
  | { effect: "require_approval"; code: string; action: string; resource: ActionResource; correlationId: string };

export interface DecisionEvent {
  type: "authorization.decision";
  eventId: string;
  occurredAt: string;
  correlationId: string;
  principal: { userId?: string; agentId: string; tenantId?: string; runId: string };
  action: string;
  resource?: ActionResource;
  effect: PolicyEffect;
  code: string;
  policyVersion?: string;
}

export interface ExecutionEvent {
  type: "action.started" | "action.succeeded" | "action.failed";
  eventId: string;
  occurredAt: string;
  correlationId: string;
  principal: { userId?: string; agentId: string; tenantId?: string; runId: string };
  action: string;
  resource: ActionResource;
  durationMs?: number;
}

export type GuardEvent = DecisionEvent | ExecutionEvent;
export type EventSink = (event: GuardEvent) => void | Promise<void>;

export interface GuardOptions<P extends AgentPrincipal> {
  authorize: (request: AuthorizationRequest<P, unknown>) => AuthorizationResult | Promise<AuthorizationResult>;
  /** Events contain identity/action metadata only, never raw input, claims, or exceptions. */
  events?: EventSink;
  /** Version string supplied by the app; useful when policies are deployed independently. */
  policyVersion?: string;
  /** Default is fail-closed: sink failures before execution prevent the protected handler. */
  auditFailure?: "fail-closed" | "fail-open";
  /** Optional ID source for tests or app-wide correlation. Must return a unique-enough value. */
  createId?: () => string;
}
