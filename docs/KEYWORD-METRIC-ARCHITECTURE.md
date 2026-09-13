# Keyword metric architecture

Canonical query → `KeywordMetricProvider` → DataForSEO adapter → raw evidence reference/SHA-256 → canonical `KeywordMetricObservation` → deterministic qualification. The adapter accepts injected acquisition for bounded execution; replay consumes stored canonical observations and never fetches.
