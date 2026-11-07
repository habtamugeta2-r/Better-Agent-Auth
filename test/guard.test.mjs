import test from "node:test";
import assert from "node:assert/strict";
import { AuditSinkError, createGuard } from "../dist/index.js";

const principal = { userId: "user_1", agentId: "support-bot", tenantId: "tenant_1", runId: "run_1", claims: { secret: "never-log" } };

const resourceFor = (input) => ({ type: "ticket", id: input.ticketId });

test("allows and executes only after policy approves, emitting safe lifecycle events", async () => {
  const events = [];
  const calls = [];
  const guard = createGuard({
    policyVersion: "v7",
    authorize: async (request) => {
      assert.equal(request.principal.userId, "user_1");
      assert.equal(Object.isFrozen(request.principal), true);
      assert.equal(Object.isFrozen(request.resource), true);
      assert.equal(request.resource.id, "ticket_7");
      return { effect: "allow" };
    },
    events: (event) => events.push(event),
    createId: (() => { let n = 0; return () => `id-${++n}`; })(),
  });
  const read = guard.action({ name: "ticket.read", resource: resourceFor }, async (input, ctx) => {
    calls.push(ctx.action);
    return { subject: "Example" };
  });

  const outcome = await read({ ticketId: "ticket_7", privateText: "do not log" }, { principal, correlationId: "req-9" });
  assert.equal(outcome.effect, "allow");
  assert.deepEqual(outcome.value, { subject: "Example" });
  assert.deepEqual(calls.filter((value) => typeof value === "string"), ["ticket.read"]);
  assert.deepEqual(events.map((event) => event.type), ["authorization.decision", "action.started", "action.succeeded"]);
  assert.equal(events[0].policyVersion, "v7");
  assert.equal(events[0].correlationId, "req-9");
  assert.equal(JSON.stringify(events).includes("privateText"), false);
  assert.equal(JSON.stringify(events).includes("never-log"), false);
});

test("denies by default in policy code and does not execute the protected handler", async () => {
  let executed = false;
  const guard = createGuard({ authorize: () => ({ effect: "deny", code: "not_granted" }) });
  const action = guard.action({ name: "refund.issue", resource: (input) => ({ type: "order", id: input.orderId }) }, () => { executed = true; });
  const outcome = await action({ orderId: "o1" }, { principal });
  assert.equal(outcome.effect, "deny");
  assert.equal(executed, false);
});

test("approval-required is a handoff and never invokes the handler", async () => {
  let executed = false;
  const guard = createGuard({ authorize: () => ({ effect: "require_approval", code: "large_refund" }) });
  const action = guard.action({ name: "refund.issue", resource: (input) => ({ type: "order", id: input.orderId }) }, () => { executed = true; });
  assert.equal((await action({ orderId: "o1" }, { principal })).effect, "require_approval");
  assert.equal(executed, false);
});

test("policy exceptions fail closed with a safe reason code", async () => {
  let executed = false;
  const guard = createGuard({ authorize: () => { throw new Error("contains secret details"); } });
  const action = guard.action({ name: "ticket.read", resource: resourceFor }, () => { executed = true; });
  const result = await action({ ticketId: "t1" }, { principal });
  assert.equal(result.effect, "deny");
  assert.equal(result.code, "policy_error");
  assert.equal(executed, false);
});

test("unsafe reason strings are replaced before they reach outcomes or events", async () => {
  const events = [];
  const guard = createGuard({ authorize: () => ({ effect: "deny", code: "denied for user alice@example.com" }), events: (event) => events.push(event) });
  const action = guard.action({ name: "read", resource: () => ({ type: "record", id: "1" }) }, () => "unsafe");
  const result = await action({}, { principal });
  assert.equal(result.effect, "deny");
  assert.equal(result.code, "not_granted");
  assert.equal(JSON.stringify(events).includes("alice@example.com"), false);
});

test("audit sink failure blocks execution by default and identifies retry safety", async () => {
  let executed = false;
  const guard = createGuard({ authorize: () => ({ effect: "allow" }), events: () => { throw new Error("offline"); } });
  const action = guard.action({ name: "write", resource: () => ({ type: "record", id: "1" }) }, () => { executed = true; });
  await assert.rejects(action({}, { principal }), (error) => {
    assert.ok(error instanceof AuditSinkError);
    assert.equal(error.actionExecuted, false);
    return true;
  });
  assert.equal(executed, false);
});

test("successful side effect followed by audit failure warns against blind retry", async () => {
  let count = 0;
  let eventNo = 0;
  const guard = createGuard({
    authorize: () => ({ effect: "allow" }),
    events: () => { eventNo += 1; if (eventNo === 3) throw new Error("offline after execution"); },
  });
  const action = guard.action({ name: "write", resource: () => ({ type: "record", id: "1" }) }, () => { count += 1; return "done"; });
  await assert.rejects(action({}, { principal }), (error) => {
    assert.ok(error instanceof AuditSinkError);
    assert.equal(error.actionExecuted, true);
    return true;
  });
  assert.equal(count, 1);
});

test("malformed principal is denied without reaching policy or handler", async () => {
  let policyCalled = false;
  const guard = createGuard({ authorize: () => { policyCalled = true; return { effect: "allow" }; } });
  const action = guard.action({ name: "read", resource: () => ({ type: "x", id: "1" }) }, () => "unsafe");
  const outcome = await action({}, { principal: { agentId: "", runId: "" } });
  assert.equal(outcome.effect, "deny");
  assert.equal(outcome.code, "invalid_principal");
  assert.equal(policyCalled, false);
});

test("fail-open audit mode permits action when telemetry is unavailable", async () => {
  const guard = createGuard({ authorize: () => ({ effect: "allow" }), events: () => { throw new Error("offline"); }, auditFailure: "fail-open" });
  const action = guard.action({ name: "read", resource: () => ({ type: "x", id: "1" }) }, () => "ok");
  const result = await action({}, { principal });
  assert.equal(result.effect, "allow");
  assert.equal(result.value, "ok");
});
