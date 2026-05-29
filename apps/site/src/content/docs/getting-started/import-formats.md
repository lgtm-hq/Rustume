---
title: "Import Formats"
description: 'Import resumes from <a href="https://jsonresume.org/">JSON Resume</a>, <a href="https://www.linkedin.com/">LinkedIn</a> exports, and <a href="https://rxresu.me/">Reactive Resume</a> via <code>rustume parse</code>.'
category: getting-started
order: 30
---

[Rustume](/) normalizes external resume formats into its unified schema. The parser crate handles
three import sources plus native [Rustume](/) JSON.

## Supported formats

| Format | CLI `--format` | API `format` | Input type |
| --- | --- | --- | --- |
| [JSON Resume](https://jsonresume.org/) | `json-resume` | `json-resume` | JSON file |
| [LinkedIn](https://www.linkedin.com/) export | `linkedin` | `linkedin` | ZIP (base64 in API) |
| [Reactive Resume](https://rxresu.me/) | `rrv3` | `rrv3` | JSON file |
| Native [Rustume](/) | `rustume` | `rustume` | JSON file |

The CLI auto-detects format from file extension and content when `--format` is omitted.

## JSON Resume

[JSON Resume](https://jsonresume.org/) is an open standard with a well-defined schema. [Rustume](/)
maps `basics.label` to `basics.headline` and converts all standard sections (work, education,
skills, projects, etc.).

```bash
rustume parse resume.json --format json-resume -o rustume.json

```

Via the API:

```bash
curl -X POST http://localhost:3000/api/parse \
  -H 'Content-Type: application/json' \
  -d '{"format":"json-resume","data":"{\"basics\":{\"name\":\"Jane Doe\",\"label\":\"Engineer\"}}"}'

```

Partial data is accepted — missing sections become empty arrays.

## LinkedIn data export

Export your data from [LinkedIn](https://www.linkedin.com/): **Settings → Data Privacy → Get a copy
of your data → Want something in particular? → Resumes**. Download the ZIP archive.

The parser reads these CSV files from the ZIP:

- `Profile.csv` — name, headline, summary, location
- `Positions.csv` — work experience
- `Education.csv` — education history
- `Skills.csv`, `Languages.csv`, `Certifications.csv`, `Projects.csv`
- `Email Addresses.csv` — primary email

```bash
rustume parse linkedin-export.zip --format linkedin -o rustume.json

```

For the API, base64-encode the ZIP and set `"base64": true`:

```json
{
  "format": "linkedin",
  "data": "<base64-encoded-zip>",
  "base64": true
}

```

## Reactive Resume

If you are migrating from [Reactive Resume](https://rxresu.me/), export your resume JSON. Reactive
Resume files contain `sections`, `metadata`, and a `public` field — [Rustume](/) detects this
signature automatically.

```bash
rustume parse reactive-resume.json --format rrv3 -o rustume.json

```

Section mappings preserve experience, education, skills, profiles, and custom sections where
possible.

## After import

1. Open the converted JSON in the web editor or validate with `rustume validate rustume.json`
2. Choose a [template](/docs/getting-started/templates/) — imported resumes default to `rhyhorn`
3. Export PDF with `rustume render rustume.json -o resume.pdf`

On [Rustume Cloud](/docs/cloud/getting-started/), use **Import from local** after sign-in to upload
[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) resumes to your account.
