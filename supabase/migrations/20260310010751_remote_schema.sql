drop extension if exists "pg_net";


  create table "public"."interviews" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "customer_company" text not null,
    "product_name" text not null,
    "category" text default 'Time Savings'::text,
    "status" text default 'draft'::text,
    "share_token" text default encode(extensions.gen_random_bytes(12), 'base64url'::text),
    "extraction_state" jsonb default '{"facts": {}, "quotes": [], "metrics": [], "question_count": 0}'::jsonb,
    "draft_content" text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."interviews" enable row level security;


  create table "public"."messages" (
    "id" uuid not null default gen_random_uuid(),
    "interview_id" uuid,
    "role" text not null,
    "content" text not null,
    "created_at" timestamp with time zone default now(),
    "audio_url" text,
    "audio_path" text
      );


alter table "public"."messages" enable row level security;

CREATE INDEX idx_interviews_share_token ON public.interviews USING btree (share_token);

CREATE INDEX idx_interviews_user_id ON public.interviews USING btree (user_id);

CREATE INDEX idx_messages_interview_id ON public.messages USING btree (interview_id);

CREATE UNIQUE INDEX interviews_pkey ON public.interviews USING btree (id);

CREATE UNIQUE INDEX interviews_share_token_key ON public.interviews USING btree (share_token);

CREATE UNIQUE INDEX messages_pkey ON public.messages USING btree (id);

alter table "public"."interviews" add constraint "interviews_pkey" PRIMARY KEY using index "interviews_pkey";

alter table "public"."messages" add constraint "messages_pkey" PRIMARY KEY using index "messages_pkey";

alter table "public"."interviews" add constraint "interviews_share_token_key" UNIQUE using index "interviews_share_token_key";

alter table "public"."interviews" add constraint "interviews_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."interviews" validate constraint "interviews_user_id_fkey";

alter table "public"."messages" add constraint "messages_interview_id_fkey" FOREIGN KEY (interview_id) REFERENCES public.interviews(id) ON DELETE CASCADE not valid;

alter table "public"."messages" validate constraint "messages_interview_id_fkey";

alter table "public"."messages" add constraint "messages_role_check" CHECK ((role = ANY (ARRAY['assistant'::text, 'user'::text]))) not valid;

alter table "public"."messages" validate constraint "messages_role_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

grant delete on table "public"."interviews" to "anon";

grant insert on table "public"."interviews" to "anon";

grant references on table "public"."interviews" to "anon";

grant select on table "public"."interviews" to "anon";

grant trigger on table "public"."interviews" to "anon";

grant truncate on table "public"."interviews" to "anon";

grant update on table "public"."interviews" to "anon";

grant delete on table "public"."interviews" to "authenticated";

grant insert on table "public"."interviews" to "authenticated";

grant references on table "public"."interviews" to "authenticated";

grant select on table "public"."interviews" to "authenticated";

grant trigger on table "public"."interviews" to "authenticated";

grant truncate on table "public"."interviews" to "authenticated";

grant update on table "public"."interviews" to "authenticated";

grant delete on table "public"."interviews" to "service_role";

grant insert on table "public"."interviews" to "service_role";

grant references on table "public"."interviews" to "service_role";

grant select on table "public"."interviews" to "service_role";

grant trigger on table "public"."interviews" to "service_role";

grant truncate on table "public"."interviews" to "service_role";

grant update on table "public"."interviews" to "service_role";

grant delete on table "public"."messages" to "anon";

grant insert on table "public"."messages" to "anon";

grant references on table "public"."messages" to "anon";

grant select on table "public"."messages" to "anon";

grant trigger on table "public"."messages" to "anon";

grant truncate on table "public"."messages" to "anon";

grant update on table "public"."messages" to "anon";

grant delete on table "public"."messages" to "authenticated";

grant insert on table "public"."messages" to "authenticated";

grant references on table "public"."messages" to "authenticated";

grant select on table "public"."messages" to "authenticated";

grant trigger on table "public"."messages" to "authenticated";

grant truncate on table "public"."messages" to "authenticated";

grant update on table "public"."messages" to "authenticated";

grant delete on table "public"."messages" to "service_role";

grant insert on table "public"."messages" to "service_role";

grant references on table "public"."messages" to "service_role";

grant select on table "public"."messages" to "service_role";

grant trigger on table "public"."messages" to "service_role";

grant truncate on table "public"."messages" to "service_role";

grant update on table "public"."messages" to "service_role";


  create policy "Anyone can view by share_token"
  on "public"."interviews"
  as permissive
  for select
  to public
using ((share_token IS NOT NULL));



  create policy "Service role can update any"
  on "public"."interviews"
  as permissive
  for update
  to public
using (true);



  create policy "Users can delete own interviews"
  on "public"."interviews"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can insert own interviews"
  on "public"."interviews"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update own interviews"
  on "public"."interviews"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view own interviews"
  on "public"."interviews"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Anyone can insert messages"
  on "public"."messages"
  as permissive
  for insert
  to public
with check (true);



  create policy "Anyone can view messages"
  on "public"."messages"
  as permissive
  for select
  to public
using (true);



