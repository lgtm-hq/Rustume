---
title: "Linting & Formatting"
description: "Use lintro for linting and formatting checks."
category: contributing
order: 20
---

[Rustume](/) uses [lintro](https://github.com/lgtm-hq/py-lintro) for all linting and formatting —
run `uv run lintro chk` to check and `uv run lintro fmt` to auto-fix. Do not run native tools
directly; [lintro](https://github.com/lgtm-hq/py-lintro) orchestrates the same toolchain CI uses.

## Quick commands

```bash
# Check for issues (CI mode — fails on warnings)
uv run lintro chk

# Auto-fix formatting
uv run lintro fmt

# Run tests with coverage reporting
uv run lintro tst

```

Run these from the [Rustume](https://github.com/lgtm-hq/Rustume) repository root where
`pyproject.toml` lives — requires [uv](https://docs.astral.sh/uv/).

## What lintro runs

[lintro](https://github.com/lgtm-hq/py-lintro) auto-detects and runs **28 tools** across the
monorepo (see `uv run lintro tools`):

| Category | Tools |
| --- | --- |
| [Rust](https://www.rust-lang.org/) | [`rustfmt`](https://doc.rust-lang.org/rustfmt/), [`clippy`](https://doc.rust-lang.org/clippy/), [`cargo_audit`](https://github.com/rustsec/rustsec/tree/main/cargo-audit), [`cargo_deny`](https://github.com/EmbarkStudios/cargo-deny) |
| [Python](https://www.python.org/) | [`ruff`](https://docs.astral.sh/ruff/), [`black`](https://black.readthedocs.io/), [`bandit`](https://bandit.readthedocs.io/), [`mypy`](https://mypy-lang.org/), [`pydoclint`](https://jsh9.github.io/pydoclint/), [`pytest`](https://docs.pytest.org/) |
| [TypeScript](https://www.typescriptlang.org/) / [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript) | [`oxlint`](https://oxc.rs/docs/guide/usage/linter), [`oxfmt`](https://oxc.rs/docs/guide/usage/formatter), [`prettier`](https://prettier.io/), [`tsc`](https://www.typescriptlang.org/docs/handbook/compiler-options.html)* |
| [Shell](https://en.wikipedia.org/wiki/Shell_script) | [`shellcheck`](https://www.shellcheck.net/), [`shfmt`](https://github.com/mvdan/sh) |
| Markup / config | [`markdownlint`](https://github.com/DavidAnson/markdownlint), [`yamllint`](https://github.com/adrienverge/yamllint), [`taplo`](https://taplo.tamasfe.dev/), [`prettier`](https://prettier.io/) |
| CI / containers | [`actionlint`](https://github.com/rhysd/actionlint), [`hadolint`](https://github.com/hadolint/hadolint) |
| Security | [`gitleaks`](https://github.com/gitleaks/gitleaks), [`osv_scanner`](https://google.github.io/osv-scanner/), [`semgrep`](https://semgrep.dev/), [`bandit`](https://bandit.readthedocs.io/), [`cargo_audit`](https://github.com/rustsec/rustsec/tree/main/cargo-audit), [`cargo_deny`](https://github.com/EmbarkStudios/cargo-deny) |
| SQL | [`sqlfluff`](https://docs.sqlfluff.com/) |
| Framework checkers† | [`astro-check`](https://docs.astro.build/en/reference/cli-reference/#astro-check), [`svelte-check`](https://github.com/sveltejs/language-tools/tree/master/packages/svelte-check), [`vue-tsc`](https://github.com/vuejs/language-tools/tree/master/packages/tsc) |

\* `tsc` and † `astro-check` are **disabled** in
[`.lintro-config.yaml`](https://github.com/lgtm-hq/Rustume/blob/main/.lintro-config.yaml) for this
repo — the docs site type-checks via `make site-test` instead.

Configuration lives in
[`.lintro-config.yaml`](https://github.com/lgtm-hq/Rustume/blob/main/.lintro-config.yaml). CI runs
the same checks via
[`scripts/ci/lintro/`](https://github.com/lgtm-hq/Rustume/tree/main/scripts/ci/lintro).

## Pre-commit workflow

Before pushing:

```bash
make test
uv run lintro chk

```

Fix formatting issues:

```bash
uv run lintro fmt
uv run lintro chk   # verify clean

```

See [Development setup](/docs/contributing/development/) for `make test`.

## CI integration

Pull requests trigger `ci-lintro-analysis.yml` which:

1. Pulls the [lintro Docker image](https://github.com/lgtm-hq/py-lintro/pkgs/container/py-lintro)
   (or runs locally)
2. Executes `lintro chk` across the workspace
3. Posts results as PR comment on failure

[Conventional Commits](https://www.conventionalcommits.org/) PR titles are enforced separately
(`semantic-pr-title.yml`).

## Makefile alternatives

The [Makefile](https://github.com/lgtm-hq/Rustume/blob/main/Makefile) includes native
[Rust](https://www.rust-lang.org/) /
[JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript) lint targets for quick local
checks:

```bash
make lint    # cargo clippy + bun lint
make fmt     # cargo fmt + bun fmt

```

Prefer `uv run lintro chk/fmt` for parity with CI. Use
[Makefile](https://github.com/lgtm-hq/Rustume/blob/main/Makefile) targets only for fast iteration on
[Rust](https://www.rust-lang.org/)-only changes.

## CI parity

CI runs [lintro](https://github.com/lgtm-hq/py-lintro) in Docker via
[`reusable-quality-lint`](https://github.com/lgtm-hq/lgtm-ci). Match it locally with:

```bash
uv run lintro chk
uv run lintro fmt
```

## Common fixes

**[Clippy](https://doc.rust-lang.org/clippy/) `-D warnings`** — all clippy warnings are errors. Fix
or allow explicitly with justification.

**Import order** — `lintro fmt` handles import sorting in
[TypeScript](https://www.typescriptlang.org/) files.

**Trailing whitespace / final newline** — auto-fixed by `lintro fmt`.

**Conventional commits** — PR titles must follow [Conventional
Commits](https://www.conventionalcommits.org/) format (enforced by CI, not lintro).

## Adding new tools

To add a linter to lintro, follow the [lintro plugin guide](https://github.com/lgtm-hq/py-lintro).
[Rustume](https://github.com/lgtm-hq/Rustume)-specific CI wiring goes in `scripts/ci/`.

## Editor integration

Configure your editor to run `uv run lintro fmt` on save, or use separate formatters that match
[lintro](https://github.com/lgtm-hq/py-lintro) output ([rustfmt](https://doc.rust-lang.org/rustfmt/)
for [Rust](https://www.rust-lang.org/), [Prettier](https://prettier.io/) for
[TypeScript](https://www.typescriptlang.org/)). The source of truth is always `lintro chk` in CI.
