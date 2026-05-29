---
title: "CLI Usage"
description: 'Install and use the <code>rustume</code> command-line tool for parsing, rendering, and validation.'
category: cli
order: 10
---

The `rustume` CLI exposes the same core engine as the [web app](/docs/contributing/web-app/) and
[REST API](/docs/api/overview/) — parse external formats, validate schema, render PDFs, and generate
PNG previews — without a browser.

## Installation

**From a release binary** — download the appropriate archive from [GitHub
Releases](https://github.com/lgtm-hq/Rustume/releases) for your platform (Linux, macOS, Windows).

### From source

```bash
git clone https://github.com/lgtm-hq/Rustume.git
cd Rustume
cargo install --path crates/cli

```

Verify:

```bash
rustume --version
rustume --help

```

## Global flags

| Flag | Description |
| --- | --- |
| `-d`, `--debug` | Enable debug logging via `tracing` (`RUST_LOG=rustume=debug`) |
| `-h`, `--help` | Show help |
| `-V`, `--version` | Print version |

## Subcommands

| Command | Purpose |
| --- | --- |
| `parse` | Convert [JSON Resume](https://jsonresume.org/), LinkedIn, [Reactive Resume](https://rxresu.me/) (`rrv3`), or [Rustume](/) JSON |
| `render` | Generate a PDF from [Rustume](/) JSON |
| `preview` | Generate a PNG preview of a specific page |
| `templates` | List available [Typst](https://typst.app/) templates |
| `validate` | Check resume data against the schema |
| `init` | Create a new empty (or sample) resume JSON |

## Common workflows

### Convert and render in one pipeline

```bash
rustume parse linkedin.zip -o resume.json
rustume validate resume.json
rustume render resume.json -t onyx -o resume.pdf

```

#### Use stdin/stdout

```bash
cat resume.json | rustume validate -
rustume parse resume.json | rustume render - -o out.pdf

```

#### Quick sample resume

```bash
rustume init --sample -o sample.json
rustume preview sample.json -o preview.png

```

## Exit codes

The CLI exits `0` on success and `1` on error. Validation failures print field-level errors to
stderr.

## See also

- [Command reference](/docs/cli/commands/) for every flag and option
- [Import formats](/docs/getting-started/import-formats/) for parser details
- [API overview](/docs/api/overview/) for HTTP equivalents
