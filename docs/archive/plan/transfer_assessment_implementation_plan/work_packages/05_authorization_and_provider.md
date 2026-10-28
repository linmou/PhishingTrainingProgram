# W4/W6: Authorization and Provider Boundary

## Source

Original §10, §9.3-§9.7, §17 W4/W6, and D15-D16.

## Ordered implementation

1. Require a server-derived verified principal and room authorization for every transfer operation.
2. Keep provider credentials and private draft/key/rationale data server-side; return explicit allowlisted DTOs.
3. Add `assessmentAuthorization.integration.test.ts` for missing/forged/cross-room/cross-learner principals, direct table access, private-column access, and legacy-RPC bypasses.
4. Verify provider requests do not receive learner-selected labels for exact grading and do not expose secrets in browser assets, logs, errors, or exports.
5. Exercise the disabled capability path when verifier or provider configuration is absent; it must fail closed without inventing an auth system.

## Completion gate

W4 passes only with a real trusted verifier or an explicitly recorded deployment blocker. Injected test verifiers may test domain behavior but cannot establish production authorization.
