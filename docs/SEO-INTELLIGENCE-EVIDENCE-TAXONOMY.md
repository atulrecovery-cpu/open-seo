# SEO intelligence evidence taxonomy

Every intelligence item preserves an evidence reference containing its ID, category, source observation ID, and capture ID. Categories are `USER_PROVIDED`, `SEARCH_OBSERVED`, `PROVIDER_METRIC`, `SITE_OBSERVED`, `COMPETITOR_OBSERVED`, `MODEL_INFERRED`, `DERIVED`, and `UNKNOWN`.

`MODEL_INFERRED` is structurally distinct and is never emitted by the deterministic pipeline. Derived signals retain links to their input evidence; multiple records with one `captureId` are one lineage, not independent confirmations.
