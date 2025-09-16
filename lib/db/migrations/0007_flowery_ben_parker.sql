ALTER TABLE "Chat" ADD COLUMN "lastContext" jsonb;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Note" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"tags" text[],
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp,
	CONSTRAINT "Note_id_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
