---
name: secure-api-builder
description: >-
  Creates, modifies, or refactors backend API routes, Node.js server code, and
  Next.js serverless functions with security-first design. Use when working on
  API endpoints, FormData handlers, Sharp pipelines, or /api/process routes.
disable-model-invocation: true
---

# Secure API Endpoint Builder

## Objective

Develop backend logic that balances immediate functionality with generic flexibility, while ensuring zero data leaks or vulnerabilities.

## Execution Workflow

1. **Context Assessment**: Review existing endpoints or schemas inside `<CODE_REVIEW>` tags.
2. **Security Verification**: Audit for injection, broken auth, rate-limiting, and input sanitization inside `<SECURITY_REVIEW>` tags.
3. **Architecture Planning**: Map data flow inside `<PLANNING>` tags. Keep tools minimal.
4. **Iterative Implementation**: Write code in discrete phases with a verification test after each phase.

## Operational Standards

- Use explicit, semantic HTTP status codes (400 for bad input, 500 for server errors).
- Validate file types and payload shape before processing.
- Never log secrets, file contents, or PII.
- Highlight hosting, monitoring, and error-handling implications.

## Image Studio Checklist

When touching `src/app/api/process/route.ts` or `src/lib/sharpPipeline.ts`:

- [ ] Validate `image` is a `File` with supported MIME/extension
- [ ] Parse `ops` via `mergeImageOps` (not shallow merge)
- [ ] Validate `format` is one of `png | jpg | webp`
- [ ] Parse optional `maxSizeKb` as a positive integer
- [ ] Handle optional `cutout` only when portrait mode is enabled
- [ ] Return correct `Content-Type` and `Cache-Control: no-store`
- [ ] Catch errors and return JSON `{ error: "..." }` — never leak stack traces

## Example

User asks: "Add a watermark option to the export API."

```
<CODE_REVIEW>
Review route.ts FormData parsing and sharpPipeline.ts encode path.
</CODE_REVIEW>

<SECURITY_REVIEW>
Watermark text must be sanitized (no HTML/script injection in SVG).
File size and format validation unchanged.
</SECURITY_REVIEW>

<PLANNING>
1. Add watermark field to ImageOps
2. Apply in sharpPipeline after effects, before encodeFinal
3. Test with curl POST to /api/process
</PLANNING>
```

Verification:

```bash
curl -s -o /dev/null -w "%{http_code}" -F "image=@test.jpg" -F 'ops={}' -F "format=png" http://localhost:3000/api/process
```
