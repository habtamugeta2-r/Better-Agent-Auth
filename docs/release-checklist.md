# Pre-release checklist

The package is a prototype. Do not publish a version merely because the build passes. Complete the checks relevant to the intended release and clearly label experimental behavior.

## Package and API

- [ ] Confirm the `agent-action-guard` npm package name is available/controlled and repository URL is correct.
- [ ] Review `package.json` version, license, supported Node versions, entry points, and `files` allowlist.
- [ ] Run `npm ci`, `npm run typecheck`, `npm test`, `npm run demo`, and `npm pack --dry-run`.
- [ ] Install the generated tarball into a clean throwaway TypeScript app and verify both runtime import and declarations.
- [ ] Confirm no `.env`, credentials, generated demo data, or unintended files are included in the tarball.
- [ ] Keep public API changes semver-compatible after the first stable release; until then document breaking changes.

## Security and reliability

- [ ] Review the threat model and ensure no identity source is taken from tool arguments or model output.
- [ ] Test policy timeout/error, malformed input/principal/resource, deny, approval-required, handler failure, and audit sink failure paths.
- [ ] Verify that a failed success-event write is surfaced as potentially already executed and that the consumer has an idempotency/state-check strategy.
- [ ] Verify downstream resource access re-checks tenant/ownership and least privilege; a wrapper is not the only line of defense.
- [ ] Verify event data minimization, sink access, retention, and failure policy in the pilot app.
- [ ] Avoid describing telemetry as tamper-proof, complete, immutable, or compliance evidence.

## Product validation

- [ ] At least 3 target developers demonstrated a current workaround or production blocker.
- [ ] At least 2 integrated without a live pairing session.
- [ ] At least 1 returned with a second use case, code contribution, or intent to keep using it.
- [ ] A developer unfamiliar with the code can complete the core integration in 15 minutes or less.
- [ ] The initial adapter (if any) follows repeated pilot demand, not assumptions about framework popularity.

## Publishing

- [ ] Check npm package ownership, provenance settings, and trusted publishing configuration.
- [ ] Review dependency/license notices and generated source maps/declarations.
- [ ] Publish a pre-release tag for pilot feedback before claiming stable production readiness.
- [ ] Attach release notes describing limitations, migration notes, and tested Node versions.
- [ ] Tag the release from the intended branch after review; never publish credentials or long-lived tokens from local config.
