import type { BuyerLanguageSliceResult } from "@/server/lib/seo-intelligence/buyer-language";

export type BuyerLanguageRun = BuyerLanguageSliceResult & {
  id: string;
  projectId: string;
  language: string;
  market: string;
  createdAt: string;
  completedAt: string;
};

export type BuyerLanguageRunSummary = Omit<
  BuyerLanguageRun,
  "observations" | "unknowns" | "contradictions" | "admissions"
>;
