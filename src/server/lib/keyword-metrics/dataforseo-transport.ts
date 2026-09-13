import { dataforseoPostResponse } from "@/server/lib/dataforseo/core";
import { languageMappings, marketMappings, type CanonicalKeywordMetricRequest } from "@/server/lib/keyword-metrics/types";
export interface KeywordMetricRawTransport { execute(request: CanonicalKeywordMetricRequest): Promise<Response>; }
/** Exact-byte transport; body remains unconsumed for immutable evidence capture. */
export const dataForSeoKeywordMetricTransport: KeywordMetricRawTransport = { execute(request) { return dataforseoPostResponse("/v3/keywords_data/google_ads/search_volume/live", [{ keywords: request.queries, location_code: marketMappings[request.market].code, language_code: languageMappings[request.language] }]); } };
