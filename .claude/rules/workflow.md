---
paths:
  - ".github/actions/**/action.yml"
  - ".github/workflows/*.yml"
  - "release.config.mjs"
---

# Writing a Workflow

One workflow does one task, a single job with a single outcome. When a second outcome appears, it becomes a second file:

| Workflow                                                       | Trigger                                        | Task                                                                     |
| -------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| [`main-release.yml`](../../.github/workflows/main-release.yml) | `push: Verify` succeeds on `main`              | Run Semantic Release: version, tag, GitHub release, and NPM publish      |
| [`push-verify.yml`](../../.github/workflows/push-verify.yml)   | Any push that touches source, config, or locks | Lint the commit messages, then run `npm test`, the same gate as the hook |

Renaming a workflow breaks the table above, the `workflows:` trigger of `main-release.yml`, and the badges in [`README.md`](../../README.md); update all 3 in the same commit. Confirm the file parses before finishing:

```shell
node -e "console.log(require('js-yaml').load(require('fs').readFileSync('.github/workflows/<file>.yml','utf8')).name)"
```

## Releasing

Publishing is chained behind verification rather than repeating it. `main-release.yml` listens for `workflow_run` of `push: Verify` and checks out `workflow_run.head_sha`, the commit that passed, never the newest one. When `main` has moved on in the meantime, Semantic Release skips the run, and the newer commit's own verification releases it. A push that touches none of the `paths:` in `push-verify.yml`, such as a README edit, therefore never releases.

There is deliberately no `workflow_dispatch`: a manual trigger would skip the gate. A failed release is re-run from its run page.

[`release.config.mjs`](../../release.config.mjs) commits the bumped `package.json` and `package-lock.json` back to `main` as `chore(release): <version> [skip ci]`, and `prepack` builds before `npm publish`. The publish carries provenance, which needs `id-token: write`:

- **Secret `NPM_ACCESS_TOKEN`**: A granular NPM token with read and write access that bypasses 2FA. NPM caps these at 90 days, so an expired one is the first suspect when a release fails with 401 or 404
- **Trusted Publishing**: Once the package exists on NPM, adding `SiegeSailor/Terminal-Sigma` and `main-release.yml` as a trusted publisher on `https://www.npmjs.com/package/@siegesailor/terminal-sigma/access` lets the secret be deleted without changing the workflow

## Naming

A run is identifiable from its title alone, with no trailing period on any field:

| Field       | Format                                  | Example                                |
| ----------- | --------------------------------------- | -------------------------------------- |
| Filename    | `<branch\|trigger>-<context>.yml`       | `push-verify.yml`                      |
| `name`      | `<branch\|trigger>: <detailed context>` | `push: Verify`                         |
| `run-name`  | `<name>` plus what identifies the run   | `push: Verify <ref>@<sha> by @<actor>` |
| Job `name`  | Title Case, what the job produces       | `Version and Publish Release`          |
| Step `name` | Sentence case, imperative               | `Install dependencies`                 |

A `run-name` is fixed before the first step runs, so a value resolved mid-run, such as the released version, goes to `$GITHUB_STEP_SUMMARY` instead.

## What Every Workflow Carries

These hold for every file in `.github/workflows/`:

- The schema comment on line 1: `# yaml-language-server: $schema=https://json.schemastore.org/github-workflow.json`
- A `concurrency.group` named after the workflow, with `cancel-in-progress: true` only where a superseded run is worthless, never on a release
- The narrowest `permissions` the job needs, which is `contents: read` unless it writes
- `Setup workspace` from [`.github/actions/setup-workspace`](../../.github/actions/setup-workspace/action.yml) directly after `Checkout`, never its own `actions/setup-node`, so Node.js is pinned only in `.nvmrc`
- Actions pinned to a major, e.g. `actions/checkout@v7`
- A `timeout-minutes` on every job
