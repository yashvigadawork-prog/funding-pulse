CREATE TABLE "app_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"outlet" text,
	"title" text,
	"published_at" timestamp with time zone,
	"text_hash" text,
	"text" text,
	"kind" text DEFAULT 'article' NOT NULL,
	"via" text,
	"extracted" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tag" text NOT NULL,
	"sector" text NOT NULL,
	"domain" text,
	"description" text,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"match_requires_context" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"stage_last_seen" text,
	"last_round_text" text,
	"investors_reported" text[],
	"reason_on_radar" text,
	"priority" text,
	"added_on" text,
	"evidence_url" text,
	"evidence_note" text,
	"confidence" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config_edit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_investors" (
	"deal_id" integer NOT NULL,
	"investor_id" integer NOT NULL,
	"role" text DEFAULT 'participant' NOT NULL,
	CONSTRAINT "deal_investors_deal_id_investor_id_pk" PRIMARY KEY("deal_id","investor_id")
);
--> statement-breakpoint
CREATE TABLE "deal_sources" (
	"deal_id" integer NOT NULL,
	"article_id" integer NOT NULL,
	CONSTRAINT "deal_sources_deal_id_article_id_pk" PRIMARY KEY("deal_id","article_id")
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"company_id" text,
	"match_tag" text,
	"match_reason" text,
	"needs_review" boolean DEFAULT false NOT NULL,
	"stage" text,
	"amount_usd" double precision,
	"amount_inr" double precision,
	"amount_min_usd" double precision,
	"amount_max_usd" double precision,
	"amount_text" text,
	"sector" text,
	"announced_on" date,
	"week_start" date,
	"confidence" text DEFAULT 'medium' NOT NULL,
	"summary" text,
	"domain" text,
	"founders" jsonb,
	"dedupe_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digests" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_start" date NOT NULL,
	"kpis" jsonb NOT NULL,
	"highlights" jsonb NOT NULL,
	"patterns" jsonb NOT NULL,
	"analysis" jsonb NOT NULL,
	"actions" jsonb NOT NULL,
	"emailed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "digests_week_start_unique" UNIQUE("week_start")
);
--> statement-breakpoint
CREATE TABLE "founder_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_start" date NOT NULL,
	"company" text NOT NULL,
	"founder" text,
	"linkedin_url" text,
	"email" text,
	"found_flags" jsonb,
	"drafts" jsonb
);
--> statement-breakpoint
CREATE TABLE "fund_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"profile" jsonb NOT NULL,
	"mandate" jsonb NOT NULL,
	"taxonomy" jsonb NOT NULL,
	"sender_profile" jsonb NOT NULL,
	"digest_settings" jsonb NOT NULL,
	"sources" jsonb NOT NULL,
	"search_chain" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"first_seen" date,
	CONSTRAINT "investors_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "investors_of_interest" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"note" text,
	CONSTRAINT "investors_of_interest_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "locks" (
	"name" text PRIMARY KEY NOT NULL,
	"run_id" text,
	"locked_until" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"step" text NOT NULL,
	"status" text NOT NULL,
	"kind" text DEFAULT 'refresh' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"message" text,
	"counts" jsonb
);
--> statement-breakpoint
CREATE TABLE "search_cache" (
	"query_hash" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"results" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sent_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient" text NOT NULL,
	"type" text NOT NULL,
	"subject" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "stakeholders" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"type" text NOT NULL,
	"email" text NOT NULL,
	"demo" boolean DEFAULT false NOT NULL,
	CONSTRAINT "stakeholders_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "deal_investors" ADD CONSTRAINT "deal_investors_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_investors" ADD CONSTRAINT "deal_investors_investor_id_investors_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_sources" ADD CONSTRAINT "deal_sources_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_sources" ADD CONSTRAINT "deal_sources_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_processed_idx" ON "articles" USING btree ("processed");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_name_lower_uq" ON "companies" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "companies_tag_idx" ON "companies" USING btree ("tag");--> statement-breakpoint
CREATE INDEX "deals_week_idx" ON "deals" USING btree ("week_start");--> statement-breakpoint
CREATE INDEX "deals_company_idx" ON "deals" USING btree (lower("company_name"));--> statement-breakpoint
CREATE INDEX "runs_run_idx" ON "runs" USING btree ("run_id");