# Architecture

Jev x AI SDK Form Router is a single Next.js application demonstrating context-based routing for project, contact, and issue submissions. Models select from application-defined destinations. Application code decides which model's answer to accept.

See [README.md](README.md) for setup and [AGENTS.md](AGENTS.md) for contribution instructions.

## 1. Project structure

```text
app/
  layout.tsx                 Shared header, typography, metadata, and skip link
  page.tsx                   Redirects / to /projects
  [example]/page.tsx          Server-rendered page for all three examples
  actions.ts                 Shared submission Server Action
  globals.css                Theme and global styles
components/
  router-form.tsx            Form values, samples, submission, and pending state
  routing-result.tsx         Decision, statistics, and disclosures
  ui/                        Shared shadcn/Base UI components
lib/
  examples.ts                Fields, samples, destinations, criteria, RICE levels, and types
  router.ts                  Server validation and model selection policy
  submission.ts              Workflow orchestration
  router.test.ts             Routing policy, RICE scoring, and validation tests
  submission.test.ts         Workflow and error-handling tests
  utils.ts                   Shared class-name utility
.github/hooks/               Ultracite tool hook configuration
```

## 2. System and data flow

```mermaid
flowchart TD
    Browser[Shared form in browser] --> Action[Server Action]
    Registry[Example registry] --> Browser
    Registry --> Workflow[Validate and process submission]
    Action --> Workflow
    Workflow --> Router[Routing policy]
    Router --> Jev[Jev through AI Gateway]
    Jev --> Gate{Valid confidence at least 0.95?}
    Gate -->|Yes| Final[Final destination]
    Gate -->|No, missing metadata, or evaluation error| Fallback[GPT-6 Luna Fast through AI Gateway]
    Fallback -->|Valid destination| Final
    Fallback -->|Failure| Error[Safe error]
    Final --> Result[Routing result: destination, statistics, RICE score]
    Result --> Browser
    Error --> Browser
```

The registry supplies one choice per team/specialty combination. Both models receive the same validated submission, destination criteria, and routing instructions. The fallback receives no Jev answer or statistics.

## 3. Core components

| Component | Responsibility and boundary |
| --- | --- |
| App Router | `/projects`, `/contact`, and `/issues` share `app/[example]/page.tsx`. Unknown examples return 404. The page passes the public example definition to the form. |
| Form and results | `RouterForm` owns transient React state. Editing fields, loading samples, or resetting clears stale results. Submissions disable controls and preserve inputs on failure. Results display provenance, Jev statistics, and timings. |
| Example registry | `lib/examples.ts` provides form constraints, three editable samples per example, ownership rules including overlap and triage guidance, and RICE level definitions for examples that register them. |
| Routing policy | `lib/router.ts` derives Zod field validation, builds the shared model question set, validates destination membership, applies the confidence threshold, and computes RICE results. It imports `server-only`. |
| Submission workflow | `lib/submission.ts` validates the example ID and form fields before invoking routing. The SDK resolves Gateway authentication. `app/actions.ts` is a thin entrypoint. |

### Routing policy

Jev uses AI SDK's `experimental_evaluate` with `typesafe-ai/jev`. The app accepts a registered destination only when `providerMetadata.typesafe.confidence.destination` is a valid number from 0 to 1 and its unrounded value is at least `0.95`.

Low, missing, or invalid confidence, or a failed Jev evaluation, invokes `openai/gpt-6-luna-fast` through `generateText` and `Output.object`. Its schema allows only the current example's destinations. That answer becomes final even if it disagrees with Jev. There is no generated fallback confidence or further review loop.

Selected-option probability and confidence are separate statistics. Available Jev statistics describe Jev's original decision even when the fallback chooses another owner. Jev has a 12-second timeout and the fallback has a 25-second timeout, each with one SDK retry for retryable failures. Timings measure elapsed calls, including retries. A fallback failure returns a routing error.

Examples with registered RICE criteria (currently only Projects) add four `score` questions — reach, impact, confidence, effort — to the same `evaluate` call as the destination `choice` question. `lib/router.ts` interpolates each fractional score against the example's registered level values and multiplies them into a `priority` figure; Jev never returns that figure directly. RICE only reflects Jev's own answers: a Jev evaluation failure leaves `rice` null even though Luna still supplies a fallback destination.

### Result contract

`SubmissionResult` is a discriminated union: an error with a safe message and optional field errors, or success with the final `RoutingDecision` (destination, deciding model, Jev statistics, timings, and RICE result when applicable).

## 4. Data and persistence

There is no application database, durable submission history, queue, or shared cache. Form values and results live in browser component state and are reset when the example component remounts. The server holds submission data for the duration of the request.

AI Gateway receives validated submission fields for routing and RICE scoring. External services have their own retention behavior, so the absence of application storage does not imply that no external copy exists.

## 5. External integrations

| Integration | Use | Configuration |
| --- | --- | --- |
| Vercel AI Gateway via AI SDK | Jev evaluation (routing and RICE) and independent fallback decision | `AI_GATEWAY_API_KEY` or Vercel OIDC from request context in deployed Functions and `VERCEL_OIDC_TOKEN` locally |

The SDK resolves credentials when it makes a model call. Vercel Functions supply OIDC through request context, so missing environment variables do not establish an authentication failure. Actual authentication failures return a safe error, with local setup instructions only in development. Forms and sample loading remain available without credentials.

## 6. Runtime and infrastructure

The app uses Next.js 16, React 19, TypeScript, and the Node.js server runtime. The shared example page is explicitly dynamic and declares `maxDuration = 60` for hosts that support that setting. Server Actions require a server deployment rather than a static export.

Vercel is supported by the authentication setup documented in the README. There is no checked-in deployment pipeline, infrastructure provisioning, or application monitoring service. `.github/hooks/ultracite.json` configures a tool hook, not a GitHub Actions workflow. Model timings provide request-level diagnostics.

## 7. Trust and security boundaries

- Form data is untrusted. The server validates IDs, required fields, lengths, and email syntax and selects only registered fields before invoking models.
- Submission text is supplied as evidence, with instructions against overriding routing rules. Output validation restricts destination membership but does not guarantee semantic correctness.
- Provider credentials stay in server-only modules. Provider error internals are converted to safe messages before reaching the browser.
- The template has no user authentication, application rate limiter, or durable deduplication. Routing assigns ownership and does not authorize the requested business action.

## 8. Development and verification

Use Node.js 22+ and pnpm. [Getting started](README.md#getting-started) covers cloning, dependencies, credentials, and local development. The experimental AI SDK dependency is pinned in `package.json`.

Vitest tests live beside the server modules. Routing tests inject AI SDK evaluation and language-model mocks and cover confidence boundaries, independent fallback decisions, and RICE score interpolation. Workflow tests inject routing and mock the `server-only` marker. Authentication tests exercise the real Gateway provider with mocked HTTP responses and a synthetic Vercel request context, covering API keys, local OIDC, and deployed OIDC through both models. Mock decisions verify application policy, not real model classification accuracy.

Ultracite configures Oxfmt and Oxlint, including Next.js, React, and shadcn rules. `pnpm validate` runs formatting/lint checks, TypeScript, Knip, and tests. `pnpm build` checks the production bundle. Browser accessibility and layout checks are manual, with no checked-in browser test suite.

## 9. Extension points and current limits

Change fields, samples, criteria, and RICE levels in the registry. Adding an example requires updating `ExampleId`, the registry, the server's example-ID validation, and navigation order.

Keep the current workflow synchronous unless a task explicitly needs background jobs or persistence. Authentication, abuse controls, stack-ranking across submissions (RICE currently scores one submission at a time, with no stored backlog to sort), and model-quality evaluation would require additional design for a production service. These are extension considerations, not committed roadmap features.

## 10. Project identification

- Project: Jev x AI SDK Form Router
- Repository: [vercel-labs/jev-ai-sdk-form-router](https://github.com/vercel-labs/jev-ai-sdk-form-router)
- Last reviewed: 2026-09-28

## 11. Terms

| Term | Meaning here |
| --- | --- |
| Destination | One registered team/specialty pair identified by a stable string ID |
| Triage | A registered owner for unclear, unsupported, or insufficiently specified requests |
| Confidence | TypeSafe metadata used by the application's acceptance threshold |
| Selected probability | Jev's probability for its chosen destination, displayed separately from confidence |
| Fallback | An independent decision from `openai/gpt-6-luna-fast` |
| OIDC | OpenID Connect, used for Vercel-provided Gateway credentials |
| RICE | Reach, Impact, Confidence, Effort — a prioritization score computed from four of Jev's `score` answers |
