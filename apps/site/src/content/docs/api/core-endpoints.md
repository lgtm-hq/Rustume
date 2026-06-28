---
title: "Core Endpoints"
description: '<code>POST /api/parse</code>, <code>POST /api/render/pdf</code>, validate, and template reference.'
category: api
order: 20
---

Core endpoints are available in every deployment — no authentication required.

## Health

```http
GET /health

```

Returns `200` with body `ok`. Used by Docker healthchecks and load balancers.

---

## Templates

```http
GET /api/templates

```

Returns all 12 templates with theme colors:

```json
[
  {
    "id": "rhyhorn",
    "name": "Rhyhorn",
    "theme": {
      "background": "#ffffff",
      "text": "#000000",
      "primary": "#65a30d"
    }
  }
]

```

```http
GET /api/templates/{id}/thumbnail

```

Returns a PNG preview rendered with sample data. Cached for 24 hours (`Cache-Control: public,
max-age=86400`).

---

## Parse

```http
POST /api/parse
Content-Type: application/json

```

Convert external formats to [Rustume](/) JSON.

### Parse request body

```json
{
  "format": "json-resume",
  "data": "{\"basics\":{\"name\":\"Jane Doe\",\"label\":\"Engineer\"}}",
  "base64": false
}

```

| `format` value | Input |
| --- | --- |
| `json-resume` | [JSON Resume](https://jsonresume.org/) string |
| LinkedIn (`linkedin`) | Base64-encoded [LinkedIn](https://www.linkedin.com/) export ZIP (`base64: true`) |
| `rrv3` | [Reactive Resume](https://rxresu.me/) JSON |
| `rustume` | Native [Rustume](/) JSON |

**Response:** `200` with `ResumeData` JSON.

---

## Render PDF

```http
POST /api/render/pdf
Content-Type: application/json

```

### PDF request body

```json
{
  "resume": { "basics": { "name": "Jane Doe" }, "sections": {}, "metadata": {} },
  "template": "onyx"
}

```

`template` is optional — defaults to `metadata.template` or `rhyhorn`.

**Response:** `200` with `Content-Type: application/pdf`. Body starts with `%PDF`.

Validates resume before rendering. Returns
[422](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/422) with validation
details on failure.

---

## Render preview

```http
POST /api/render/preview
Content-Type: application/json

```

### Preview request body

```json
{
  "resume": { ... },
  "template": "azurill",
  "page": 0
}

```

**Response:** `200` PNG image. Header `X-Total-Pages` indicates total page count.

---

## Validate

```http
POST /api/validate
Content-Type: application/json

```

**Request:** Full `ResumeData` JSON body.

### Response

```json
{ "valid": true }

```

Or on failure:

```json
{
  "valid": false,
  "errors": ["basics.email: invalid email format"]
}

```

Always returns `200` — check the `valid` field. Nested field paths use dot notation (e.g.
`sections.experience.items[0].company`).

## Rate limits

Connected deployments apply per-route limits when `RUSTUME_CLOUD=true` and `DATABASE_URL` is
configured. Defaults, route groups, `429` responses, and bulk export caps are documented in [Rate
Limits](/docs/deployment/rate-limits/). Hosted billing does not hide parsing, rendering,
templates, or connected capabilities from self-hosted operators.

## CLI equivalents

| API | CLI |
| --- | --- |
| `POST /api/parse` | `rustume parse` |
| `POST /api/render/pdf` | `rustume render` |
| `POST /api/render/preview` | `rustume preview` |
| `POST /api/validate` | `rustume validate` |
| `GET /api/templates` | `rustume templates` |
