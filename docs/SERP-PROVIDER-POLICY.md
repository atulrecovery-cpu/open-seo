# SERP provider safety policy

- **Default provider:** DataForSEO. Its code path is unchanged in Phase 1.8.
- **OpenSERP:** experimental adapter only; explicit construction is required and no UI/config selection is exposed.
- **No automatic fallback:** a DataForSEO failure must never silently invoke OpenSERP.
- **Device restriction:** canonical requests specifying desktop or mobile are rejected by OpenSERP with `UNSUPPORTED_CAPABILITY`.
- **Destination identity:** a Google `/goto` wrapper (including a syntactically recoverable-looking `url` parameter) is retained only in raw evidence. The adapter never decodes or follows it; normalized URL/domain are `null`, identity is `WRAPPER_ONLY`, and it **MUST NOT** be used for target-domain rank tracking. Only a direct normalized HTTP(S) provider URL is `VERIFIED_DESTINATION` and eligible for matching.
- **Evidence:** provider bytes are captured before parsing with redacted canonical request metadata, capture time, HTTP status, adapter version and SHA-256. R2 keys are content-addressed and existing evidence is not overwritten.
- **Localization:** OpenSERP localization is `PARTIAL`; country/language mapping requires explicit future policy.
