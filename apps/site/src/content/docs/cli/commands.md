---
title: "CLI Commands"
description: 'Reference for <code>parse</code>, <code>render</code>, <code>preview</code>, <code>templates</code>, <code>init</code>, and <code>validate</code> subcommands.'
category: cli
order: 20
---

## `rustume parse`

Convert an external resume format to [Rustume](/) JSON.

```bash
rustume parse <INPUT> [OPTIONS]

```

| Option | Description |
| --- | --- |
| `-f`, `--format` | Input format: `json-resume`, LinkedIn (`linkedin`), `rrv3`, `rustume` (auto-detected if omitted) |
| `-o`, `--output` | Output file (default: stdout) |
| `--pretty` | Pretty-print JSON (default: true) |

### Examples

```bash
rustume parse resume.json --format json-resume -o out.json
rustume parse export.zip -f linkedin -o out.json
rustume parse - < export.zip -f linkedin   # read ZIP from stdin

```

Auto-detection checks file extension (`.zip` → LinkedIn), ZIP magic bytes, and JSON structure
(`basics.label` → [JSON Resume](https://jsonresume.org/), `sections` + `metadata` + `public` →
[Reactive Resume](https://rxresu.me/) / `rrv3`).

---

## `rustume render`

Render [Rustume](/) JSON to PDF.

```bash
rustume render <INPUT> [OPTIONS]

```

| Option | Description |
| --- | --- |
| `-t`, `--template` | Override `metadata.template` and apply matching theme colors |
| `-o`, `--output` | Output PDF path (default: `resume.pdf`) |

Validates the resume before rendering. When `-t` is set, `apply_template` also updates
`metadata.theme` colors to match the template. Returns non-zero on validation or
[Typst](https://typst.app/) errors.

```bash
rustume render resume.json -t leafish -o jane-doe.pdf

```

---

## `rustume preview`

Render a single page as PNG.

```bash
rustume preview <INPUT> [OPTIONS]

```

| Option | Description |
| --- | --- |
| `-p`, `--page` | Page index, 0-based (default: 0) |
| `-t`, `--template` | Override template and apply matching theme colors |
| `-o`, `--output` | Output PNG path (default: `preview.png`) |

```bash
rustume preview resume.json -p 1 -o page-2.png

```

---

## `rustume templates`

List available [Typst](https://typst.app/) templates.

```bash
rustume templates [OPTIONS]

```

| Option | Description |
| --- | --- |
| `-v`, `--verbose` | Show theme colors (background, text, primary) |

Returns all 12 template IDs: `rhyhorn`, `azurill`, `pikachu`, `nosepass`, `bronzor`, `chikorita`,
`ditto`, `gengar`, `glalie`, `kakuna`, `leafish`, `onyx`.

---

## `rustume validate`

Validate resume JSON against the [Rustume](/) schema.

```bash
rustume validate <INPUT>

```

Prints `Valid resume` on success. On failure, lists field paths and validation messages:

```text
Validation errors:
  basics.email: invalid email format

```

Uses the same rules as `POST /api/validate`.

---

## `rustume init`

Create a new resume JSON file.

```bash
rustume init [OPTIONS]

```

| Option | Description |
| --- | --- |
| `-o`, `--output` | Output path (default: stdout) |
| `--sample` | Pre-fill with sample data (Jane Doe, experience, skills) |

```bash
rustume init -o blank.json
rustume init --sample -o starter.json

```
