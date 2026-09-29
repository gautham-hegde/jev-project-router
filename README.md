# Jev Quickstart: Route & Score Submissions with AI

This is a working example app for testing [Jev](https://vercel.com/i/what-is-jev) — a Vercel AI Gateway model built for structured decisions (pick one option, score on a scale, or answer yes/no) instead of free-form chat text. If you want to see what Jev can do and try it against your own criteria in a few minutes, start here.

It ships with three example forms:

| Form | Route | What Jev decides |
| --- | --- | --- |
| **Project** | `/projects` | Which team should own a project, **and** a RICE priority score (Reach/Impact/Confidence/Effort) |
| Contact | `/contact` | Billing, support, or general inquiries |
| Issue Report | `/issues` | Which engineering team should own a bug report |

The Project form is the best one to start with — it shows both of Jev's answer types (`choice` for routing, `score` for RICE) in a single call.

## 1. What Jev actually does (30 seconds)

Instead of generating text, Jev answers one of three fixed question types:

- **`choice`** — pick exactly one option from a list you define, e.g. which team owns this
- **`score`** — pick a position on an ordered scale you define, e.g. "how much effort: XS / S / M / L / XL"
- **`boolean`** — yes/no with a probability

Because the answer space is constrained, Jev returns a genuine probability distribution over your options — not a self-reported guess. A sharply peaked distribution ("97% Payments") is high confidence; a split one ("55/45") is low confidence. This app uses that confidence number directly: it only trusts Jev's pick at **95%+ confidence**, and falls back to a second, general-purpose model (`openai/gpt-6-luna-fast`) for anything less certain. Nothing is trained on your data — your team descriptions and criteria are just plain-English text, re-read fresh on every submission.

## 2. Prerequisites

- Node.js 22+
- pnpm
- A [Vercel](https://vercel.com) account with **paid credits/billing enabled on AI Gateway** — the free tier cannot call `typesafe-ai/jev` or `openai/gpt-6-luna-fast`. If you skip this, the app still runs and lets you explore the forms, but every submission will fail with an access error. Add a payment method here before continuing: https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dtop-up

## 3. Set up and run

```sh
git clone <this-repo-url>
cd jev-project-router
pnpm install
cp .env.example .env.local
```

Create a [Vercel AI Gateway key](https://vercel.com/d?to=%2F%5Bteam%5D%2F~%2Fai-gateway%2Fapi-keys) and set it in `.env.local`:

```
AI_GATEWAY_API_KEY=your-key-here
```

(Alternative for local dev without a key: `npm install --global vercel && vercel link && vercel env pull .env.local` to use Vercel OIDC instead.)

Start the app:

```sh
pnpm dev
```

Open [localhost:3000](http://localhost:3000) — it redirects to `/projects`.

## 4. Try it

1. Click **Load a sample → Clear request**. This fills in an unambiguous example (adding wallet payments at checkout).
2. Click **Route submission**.
3. You should see a team destination, Jev's confidence %, and a RICE priority score, all within a couple seconds.
4. Click **Routing guide** (top right of the result panel) to see the exact team descriptions Jev is choosing between.
5. Click **Decision details** under the result to see Jev's full probability distribution across every team, plus the raw JSON response.

Try the **Overlapping needs** and **Limited context** samples too — these are written to sometimes push Jev below the 95% confidence bar, so you can watch it hand off to the fallback model and see that noted in the result.

### If a submission fails

If you see an error mentioning `403`, `access`, or `free tier`, it means AI Gateway billing isn't enabled yet — see step 2 above. This is an account-level setting on vercel.com, not a bug in the app or something you need to redeploy.

## 5. Make it yours

Everything about what Jev is deciding lives in [lib/examples.ts](lib/examples.ts) — no other file needs to change for basic customization:

- **Teams**: edit the `destinations` array for an example — each one is `{ id, team, specialty, criteria }`. The `criteria` sentence is literally what Jev reads to decide ownership, so make it specific and non-overlapping between teams. Always keep one triage/catch-all team.
- **Form fields**: edit the `fields` array — these become the actual form inputs and the `state` Jev evaluates against.
- **RICE levels** (Projects example only): edit the `rice` block — four dimensions (`reach`, `impact`, `confidence`, `effort`), each an ordered list of `{ label, value }`. Jev picks a position among your `label`s; the app maps that back to your `value`s and computes `priority = (reach × impact × confidence) / effort` in plain code.

Once you've picked real teams, ask yourself: are the criteria different enough in plain English for a stranger to sort a project between them without more context? If not, Jev will struggle too.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full module map and data flow, and [AGENTS.md](AGENTS.md) for contribution conventions if you're extending this with an AI coding agent.

## 6. Checks

```sh
pnpm fix       # Format and apply lint fixes
pnpm validate  # Lint, type check, Knip, and tests
pnpm build     # Production build
```

Tests mock the model providers and make no external calls — they verify the confidence threshold, fallback logic, RICE math, and validation, not live model accuracy.

## Resources

- [Jev documentation](https://docs.typesafe.ai/introduction)
- [Jev and AI SDK guide](https://vercel.com/kb/guide/typesafe-jev-and-ai-sdk)
- [AI SDK evaluation](https://ai-sdk.dev/docs/ai-sdk-core/evaluation)
