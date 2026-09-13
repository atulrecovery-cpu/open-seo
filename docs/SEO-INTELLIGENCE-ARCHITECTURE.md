# SEO intelligence architecture

```text
SERP / Metrics / Site Evidence
            ↓
Canonical Observations
            ↓
Evidence Taxonomy
            ↓
Query Intelligence
            ↓
Intent + Problem + Commercial Signals
            ↓
Competitor Observations
            ↓
Opportunity Signal
            ↓
Unknowns / Contradictions
            ↓
Next Validation Action
```

`src/server/lib/seo-intelligence` is a pure, provider-neutral boundary. It consumes canonical query and destination inputs; it neither imports provider adapters nor follows redirect wrappers. Its deterministic report uses the observation capture time as metadata, stable IDs based on normalized query plus engine/language/region, and sorted output. LLM inference is intentionally absent from the core path.
