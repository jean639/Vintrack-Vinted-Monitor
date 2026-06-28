# OpenAPI Contracts

Vintrack documents stable service-to-service contracts in this directory.

## Vinted Service

- Spec: [`vinted-service.yaml`](./vinted-service.yaml)
- Scope: internal `apps/vinted-service` HTTP API used by the control center and browser extension.
- Auth: most routes require the internal `X-User-ID` header. Browser completion routes use one-time sync codes or link tokens instead.
- Pass-through payloads: routes that proxy Vinted responses use generic object schemas because their upstream shape can change without Vintrack code changes.

CI validates the spec with Redocly CLI.
