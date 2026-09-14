# OpenSERP runtime validation

## Identity and runtime

- Repository: `https://github.com/karust/openserp.git` (verified by `origin` remote)
- Branch / commit: `main` / `29c7b0fbe09640160efcfc1f1e04e60e0fbe60e9`
- Runtime: official Docker image `karust/openserp:latest`, `serve -a 0.0.0.0 -p 7000`
- Local endpoint: `http://127.0.0.1:7000`; health: HTTP 200
- Health reported Go `go1.24.6` and all six engines ready.

## Bounded primary search

One external Google search was executed:

```text
GET /google/search?text=best%20accounting%20software%20for%20small%20business&lang=EN&region=US&limit=10&start=0&features=true
```

It returned HTTP 200, eight `organic` result objects, `rank` 1–8, `position.absolute` 1–8, title, URL, snippet, domain, engine `google`, an `ai_summary` feature, pagination `{page: 1, has_more: false, next_start: 10}`, response `meta.request_id` and `meta.requested_at`. Request provenance is in [metadata evidence](./evidence/openserp-google-accounting-2026-09-13.metadata.json).

### Runtime quality observation

The returned organic rows have Google redirect URLs (`https://www.google.com/goto?...`) and `domain: google.com`. Therefore the OpenSERP envelope is source/runtime-verified, but this particular Google execution did not provide destination URL/domain fidelity. A future adapter must either use a verified redirect-resolution policy or reject these rows for domain rank matching; it must not claim `google.com` is the organic target.

## Failure validation

`GET /not-an-engine/search?text=x` returned HTTP 404 JSON:

```json
{"error":"not_found","code":404,"request_id":"01a09b54-4bc9-72eb-bf09-1f9eb1ba7039","message":"Cannot GET /not-an-engine/search"}
```

This confirms a machine-readable HTTP error envelope for an invalid route. No blocking/CAPTCHA test was attempted.

## Raw evidence boundary

OpenSERP returns the complete JSON envelope directly to the caller, so OpenSEO can capture raw bytes before any adapter normalization. The application—not OpenSERP—must store the immutable artifact, redacted request, status/headers, SHA-256 and parser version. A cache-only local replay produced SHA-256 `0cc8d711e0f7781101dead2b31cc895dd4e33974b1af64b46767a555a24eeba3`; dynamic replay request metadata means each cached response needs its own hash.
