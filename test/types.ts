import { createGuard, type AgentPrincipal } from "../src/index.js";

interface AppPrincipal extends AgentPrincipal {
  environment: "dev" | "prod";
}

interface RefundInput {
  orderId: string;
  amount: number;
}

const guard = createGuard<AppPrincipal>({
  authorize: ({ principal, action, resource, input }) => {
    if (principal.environment === "prod" && action === "refund.issue" && resource.type === "order") {
      if (typeof input === "object" && input !== null && "amount" in input && typeof input.amount === "number" && input.amount > 100) {
        return { effect: "require_approval", code: "high_value" } as const;
      }
    }
    return { effect: "allow" } as const;
  },
});

const issueRefund = guard.action<RefundInput, { id: string }>(
  { name: "refund.issue", resource: (input) => ({ type: "order", id: input.orderId }) },
  async (input, context) => ({ id: `${context.principal.tenantId}:${input.orderId}:${input.amount}` }),
);

void issueRefund;
