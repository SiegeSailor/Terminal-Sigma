---
paths:
  - "source/asker.ts"
  - "source/coach.ts"
  - "source/components/coach-view.tsx"
  - "source/tracing.ts"
---

# Calling AI

The Coach is optional, and a user who never sets it up must never pay for it. [`asker.ts`](../../source/asker.ts) tries the user's accounts in order through `withFallback`, [`coach.ts`](../../source/coach.ts) decides what a model sees, and [`tracing.ts`](../../source/tracing.ts) reports to Langfuse only when both of its keys are set.

## Rules That Must Never Break

Each of these protects the user's keys, data, or start-up time:

- **Ask Only Through `withFallback`**: A new request goes through the same loop, so a limit or an outage moves on to the next account with the same messages
- **Keep Fallback for Resilience**: Never add round-robin or load spreading across accounts of 1 provider; OpenAI's terms forbid circumventing rate limits, and others forbid bypassing protective measures
- **Keep Keys Out of Everything but `config.json`**: Not in `progress.json`, `coach.json`, an event, the footer, a prompt, or a trace's metadata; the shell's keys stay in the shell, and a saved account without a key is dropped unless it is `compatible`, so a shell key never goes to a custom `baseUrl`
- **Keep Notes Out of the Context**: `contextOf` sends the profile's numbers, the targets, the streak, the last 7 days, and today's meals, never the name, the notes, the keys, or the paths
- **Trace Only on Purpose**: A traced request records the prompt and the answer, which include that summary, so Langfuse starts only when the user set both keys, and README says so
- **Never Block on Tracing**: An unreachable Langfuse must not delay an answer; `stopTracing` gives up after 2 seconds and the CLI then exits anyway
- **Honor Esc**: An aborted request stops the loop, sets no cooldown, and a late answer never shows
- **Refuse an Unreadable `coach.json`**: `loadCoach` throws and `saveCoach` validates before writing with mode 600, like `progress.json`
- **Load Providers Lazily**: `asker.ts` and `tracing.ts` import the AI SDK, its providers, Langfuse, and OpenTelemetry only with `import()` inside a request
- **Test with a Fake Asker**: Dashboard tests pass `App` an `asker`; no test may reach a real provider
- **Say It Is Not Medical Advice**: `instructionsOf` limits the Coach to general guidance and points to a professional for medical questions
- **Name No Module After a Package**: A module in `source/` never shares a name with an NPM package, because tsconfig's `baseUrl` resolves the bare name to the file; that is why this module is `asker.ts`, not `ai.ts`

## How Fallback Treats a Failure

| Failure                    | Then                                                              |
| -------------------------- | ----------------------------------------------------------------- |
| 401 or 403                 | The account is skipped for the rest of the run                    |
| Rate limit                 | It waits out its retry-after, Google's per-minute limits included |
| Quota or credit            | It cools for 1 hour                                               |
| Every account cooling down | They are tried anyway, soonest-ready first                        |

## Updating Models and Packages

`defaultModels` in `asker.ts` names 1 starting model per provider; check them again whenever the AI SDK is upgraded. Tracing uses `NodeTracerProvider` from `@opentelemetry/sdk-trace-node` with the Langfuse span processor, and the Langfuse integration is registered once with `registerTelemetry`.
