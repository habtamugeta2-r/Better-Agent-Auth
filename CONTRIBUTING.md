# Contributing

Thanks for helping improve Agent Action Guard. It is an early security-sensitive library, so small, testable changes with explicit security assumptions are preferred over broad integrations.

## Development

- Node.js 18 or newer
- npm

```sh
npm ci
npm run typecheck
npm test
npm run demo
```

Before opening a pull request, run `git diff --check` as well. Add tests for behavior changes, especially denial paths, audit failure behavior, and event privacy.

## Design constraints

- Do not trust tool/model/client-supplied identity, tenant, ownership, or approval claims.
- Keep the policy check immediately before the handler invocation.
- Do not add raw inputs, tokens, prompts, exception messages, or principal claims to events by default.
- Preserve explicit `AuditSinkError.actionExecuted` semantics; callers need to know whether retrying might repeat a side effect.
- State the limits of any adapter: direct invocation paths can bypass an in-process wrapper.
- Avoid claims of compliance, immutable audit, spend hard-stops, or universal agent identity.
- Keep the core independent of any one auth provider or agent framework. Add an adapter only when a real integration case justifies maintaining it.

For substantial changes, explain: the user problem, the security boundary, failure behavior, compatibility impact, and how a developer can reproduce the change locally.

## Security reports

Do not open a public issue with an exploitable vulnerability. Contact the repository owner privately until a dedicated security reporting address is configured. Never include customer data, credentials, or live tokens in a report.
