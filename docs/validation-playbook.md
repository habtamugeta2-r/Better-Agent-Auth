# Developer and founder validation playbook

Goal: decide whether an app-owned execution-time authorization wrapper solves a repeated problem, not whether people are excited about agents in general.

## Phase 0 — define the bet

**Target:** TypeScript developer on a team shipping an agent with access to tenant data or consequential tools.

**Pain hypothesis:** authorization and attribution are scattered across tool handlers; teams have no consistent way to evaluate a proposed action against trusted human/tenant/resource context at execution time.

**Solution hypothesis:** a small in-process wrapper plus app-owned policy/event sink integrates faster and fits better than a gateway, general policy engine, or ad hoc checks.

**Falsifier:** developers only need ordinary backend authorization, or primarily demand credential brokerage, a gateway, SSO/policy administration, or an immutable hosted audit product.

## Phase 1 — interviews (days 1–3)

Recruit 5–8 developers who have an agent in a real application or are actively shipping one. Do not recruit only friends or people who have never integrated an agent.

### Ask for evidence, not predictions

1. “Show me the code path from model tool proposal to database/API side effect.”
2. “Where is the authenticated user and tenant attached to a background run?”
3. “What is the most consequential action this agent can take?”
4. “Show me a real authorization check and the test around it.”
5. “What could bypass that check?”
6. “What happened the last time a tool used the wrong tenant, scope, or permission?”
7. “What did you evaluate or reject? What was the blocking issue: deployment, DX, policy semantics, cost, or framework support?”
8. “Would an in-process library fit, or do you need a gateway/control plane? Why?”
9. “Can you point to a project and an owner who can try a prototype this week?”

Avoid “Would you use/buy this?” Ask for a pilot, a code review, integration time, and permission to return with a patch.

### Record consistently

For each interview, note (with permission): team/app context; framework and runtime; tool lifecycle; auth/tenant source; existing checks; bypass paths; highest-risk action; workaround and time spent; preferred enforcement/deployment boundary; alternatives tried; next concrete step. Do not collect production secrets or customer data.

## Phase 2 — test the smallest artifact (week 1)

Give an interviewee a runnable example and a copy-paste integration. Ask them to install and wire it into their own action without pairing. Observe confusion silently; do not rescue immediately.

Measure:

- Time to first denied action and first allowed action.
- Whether trusted principal context is obvious and cannot accidentally come from tool input.
- Whether they can express resource/tenant policy without introducing a new policy language.
- Whether the wrapped function is actually the execution point.
- Whether event sink behavior and side-effect retry semantics are understood.
- What they remove, wrap, or work around.

**Target:** a developer unfamiliar with the code completes a minimal integration in under 15 minutes. If not, simplify the API before adding adapters.

## Phase 3 — adapter choice (week 2)

Do not pre-select MCP or a framework based on press. Aggregate interview evidence. Pick the one execution interface requested by the most pilot teams and likely to stay stable. Keep the core action wrapper independent so adapter churn stays outside policy semantics.

## Go/no-go criteria

Proceed to a public v0.x when all are true:

- At least 3 interviewees show a real current workaround, production blocker, or concrete security concern.
- At least 2 integrate the prototype into an existing app without a live call.
- At least 1 returns with a second use case, code contribution, or asks to keep using it.
- The teams share a common enough enforcement point for one maintained adapter.
- No unresolved critical issue exists around trusting principal context, bypasses, event leaks, or retry behavior.

After launch, a stronger signal is three independent apps using it and at least two still using it after a month. Track app-level protected actions and integration quality, not just downloads or GitHub stars.

## Pivot or stop signals

- Most teams already have a simple, tested authorization path and no agent-specific gap.
- Interest is mostly “AI is growing” or broad fear without a current reproducible use case.
- Every pilot asks for a hosted gateway/control plane or enterprise governance before trying the library.
- Needed identity/delegation context cannot be safely obtained in the target architecture.
- Teams cannot ensure side effects pass through the wrapper, so the offered security property is misleading.

If credential access to third-party SaaS dominates, assess connected-account authorization/credential brokering. If cross-client interception dominates, scope an MCP/tool gateway with its distinct uptime, protocol, and operations requirements.

## Solo-founder delivery plan (2–4 focused weeks)

- **Days 1–3:** interviews, code-path sketches, competitor comparison by deployment boundary.
- **Week 1:** typed wrapper, fail-closed policy behavior, event interface, unit tests, runnable example.
- **Week 2:** one adapter selected by evidence, short integration guide, security limitations review.
- **Weeks 3–4:** 3–5 real-app pilots, fix onboarding friction, publish 0.x only if go criteria are met.

This is a validation schedule for a focused library, not a promise to ship secure universal agent IAM in a month.

## First-party references for landscape verification

Check live product documentation and versioned protocol pages immediately before publishing comparisons. Start with the source index in [product thesis](product-thesis.md). Record access date, exact feature, supported deployment, and which enforcement paths are covered; do not infer library demand from acquisitions, funding, or broad market-size forecasts.
