CREATE TABLE "keyword_research_run_observations" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"canonical_observation_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_request_id" text,
	"raw_artifact_ref" text NOT NULL,
	"artifact_sha256" text NOT NULL,
	"acquired_at" text NOT NULL,
	"market" text NOT NULL,
	"language" text NOT NULL,
	"demand_state" text NOT NULL,
	"canonical_observation_json" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keyword_research_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"normalized_query" text NOT NULL,
	"market" text NOT NULL,
	"language" text NOT NULL,
	"provider" text NOT NULL,
	"status" text NOT NULL,
	"failure_code" text,
	"failure_artifact_ref" text,
	"failure_artifact_sha256" text,
	"created_at" text NOT NULL,
	"completed_at" text
);
--> statement-breakpoint
ALTER TABLE "keyword_research_run_observations" ADD CONSTRAINT "keyword_research_run_observations_run_id_keyword_research_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."keyword_research_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_research_runs" ADD CONSTRAINT "keyword_research_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "keyword_research_run_observations_run_observation_idx" ON "keyword_research_run_observations" USING btree ("run_id","canonical_observation_id");--> statement-breakpoint
CREATE INDEX "keyword_research_run_observations_run_idx" ON "keyword_research_run_observations" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "keyword_research_runs_project_created_idx" ON "keyword_research_runs" USING btree ("project_id","created_at");