# SERP provider safety policy

- **Default provider:** DataForSEO. Its code path is unchanged in Phase 1.8.
- **OpenSERP:** experimental adapter only; explicit construction is required and no UI/config selection is exposed.
- **No automatic fallback:** a DataForSEO failure must never silently invoke OpenSERP.
- **Device restriction:** canonical requests specifying desktop or mobile are rejected by OpenSERP with `UNSUPPORTED_CAPABILITY`.
- **Destination identity:** an OpenSERP Google redirect-wrapper URL/domain is retained as raw evidence but normalized URL/domain are `null` and marked unusable. Such observations **MUST NOT** be used for verified target-domain rank tracking.
- **Evidence:** provider bytes are captured before parsing with redacted canonical request metadata, capture time, HTTP status, adapter version and SHA-256. R2 keys are content-addressed and existing evidence is not overwritten.
- **Localization:** OpenSERP localization is `PARTIAL`; country/language mapping requires explicit future policy.
