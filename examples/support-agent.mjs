import { createGuard } from "../dist/index.js";

const audit = [];
// Demo stand-in for an ownership query. Real apps should query their database.
const ticketTenantById = new Map([["t_123", "tenant_demo"]]);
const guard = createGuard({
  policyVersion: "demo-1",
  events: (event) => audit.push(event),
  authorize: async ({ principal, action, resource, input }) => {
    // In a real app, use trusted session data and database ownership checks here.
    if (!principal.userId || !principal.tenantId) return { effect: "deny", code: "missing_principal" };
    if (action === "ticket.read" && ticketTenantById.get(resource.id) === principal.tenantId) {
      return { effect: "allow" };
    }
    if (action === "refund.issue" && input.amount <= 50) return { effect: "allow" };
    if (action === "refund.issue") return { effect: "require_approval", code: "refund_limit" };
    return { effect: "deny", code: "not_granted" };
  },
});

const readTicket = guard.action(
  { name: "ticket.read", resource: (input) => ({ type: "ticket", id: input.ticketId }) },
  async (input, context) => ({ ticketId: input.ticketId, tenantId: context.principal.tenantId, status: "open" }),
);

const issueRefund = guard.action(
  { name: "refund.issue", resource: (input) => ({ type: "order", id: input.orderId }) },
  async (input, context) => ({ refundId: "r_demo", tenantId: context.principal.tenantId, amount: input.amount }),
);

const context = { principal: { userId: "u_demo", agentId: "support-agent", tenantId: "tenant_demo", runId: "run_demo" } };
console.log("Allowed ticket read:", await readTicket({ ticketId: "t_123" }, context));
console.log("Approval handoff:", await issueRefund({ orderId: "o_123", amount: 125 }, context));
console.log("Audit events (metadata only):", audit.map(({ type, action, effect, code }) => ({ type, action, effect, code })));
