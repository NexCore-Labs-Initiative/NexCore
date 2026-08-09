--
-- PostgreSQL database dump
--

-- \restrict cMZI3HHdcmeXQoZyIqKccSdPOl4JYYQnEoWcTQLBKuy71FjbqzD7VRSQ3yedRNF

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- The linked production project installs pgvector in public. Schema-filtered
-- dumps preserve references to public.vector but omit the extension command.
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

--
-- Name: private; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";

--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: is_current_user_admin(); Type: FUNCTION; Schema: private; Owner: postgres
--

CREATE OR REPLACE FUNCTION "private"."is_current_user_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.users
    where id = (select auth.uid()) and is_admin is true
  );
$$;


ALTER FUNCTION "private"."is_current_user_admin"() OWNER TO "postgres";

--
-- Name: allocate_project_public_id(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."allocate_project_public_id"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
declare
  v bigint;
begin
  update public.project_counter
  set next_val = next_val + 1
  where id = 1
  returning next_val - 1 into v;

  return 'Proj-' || v::text;
end;
$$;


ALTER FUNCTION "public"."allocate_project_public_id"() OWNER TO "postgres";

--
-- Name: check_email_authorization(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."check_email_authorization"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  user_email TEXT;
  is_allowed BOOLEAN := FALSE;
BEGIN
  -- Get the email from the new user record
  user_email := LOWER(TRIM(NEW.email));

  -- Check if email is from allowed SQU domains
  IF user_email LIKE '%@squ.edu.om' OR user_email LIKE '%@student.squ.edu.om' THEN
    is_allowed := TRUE;
  END IF;

  -- If not from allowed domain, check if in approved_users table
  IF NOT is_allowed THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.approved_users
      WHERE LOWER(email) = user_email
    ) INTO is_allowed;
  END IF;

  -- If not allowed, prevent the user creation/sign-in
  IF NOT is_allowed THEN
    RAISE EXCEPTION 'Email domain not authorized. Only SQU emails or pre-approved users can sign in.'
      USING HINT = 'Contact an administrator for access.';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_email_authorization"() OWNER TO "postgres";

--
-- Name: consume_ai_chat_use(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."consume_ai_chat_use"("max_uses" integer DEFAULT 10) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id  UUID;
  v_used     INT;
  v_remaining INT;
BEGIN
  -- Get the calling user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Count today's uses
  SELECT COUNT(*) INTO v_used
  FROM public.ai_chat_usage
  WHERE user_id = v_user_id
    AND used_at >= (now() AT TIME ZONE 'UTC')::DATE;

  IF v_used >= max_uses THEN
    RAISE EXCEPTION 'AI chat daily limit reached';
  END IF;

  -- Record this use
  INSERT INTO public.ai_chat_usage (user_id) VALUES (v_user_id);

  v_remaining := max_uses - v_used - 1;
  RETURN jsonb_build_object('used', v_used + 1, 'remaining', v_remaining, 'max', max_uses);
END;
$$;


ALTER FUNCTION "public"."consume_ai_chat_use"("max_uses" integer) OWNER TO "postgres";

--
-- Name: consume_ai_use(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."consume_ai_use"("max_uses" integer DEFAULT 3) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  d date := (now() at time zone 'utc')::date;
  new_used int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.ai_usage_daily (user_id, day, used)
  values (auth.uid(), d, 0)
  on conflict (user_id, day) do nothing;

  update public.ai_usage_daily
  set used = used + 1,
      updated_at = now()
  where user_id = auth.uid()
    and day = d
    and used < max_uses
  returning used into new_used;

  if new_used is null then
    raise exception 'AI daily limit reached';
  end if;

  return new_used;
end;
$$;


ALTER FUNCTION "public"."consume_ai_use"("max_uses" integer) OWNER TO "postgres";

--
-- Name: get_ai_chat_usage(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_ai_chat_usage"("max_uses" integer DEFAULT 10) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id UUID;
  v_used    INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COUNT(*) INTO v_used
  FROM public.ai_chat_usage
  WHERE user_id = v_user_id
    AND used_at >= (now() AT TIME ZONE 'UTC')::DATE;

  RETURN jsonb_build_object(
    'used', v_used,
    'remaining', GREATEST(0, max_uses - v_used),
    'max', max_uses
  );
END;
$$;


ALTER FUNCTION "public"."get_ai_chat_usage"("max_uses" integer) OWNER TO "postgres";

--
-- Name: get_my_admin_status(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_my_admin_status"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SELECT is_admin INTO result
  FROM public.users
  WHERE id = auth.uid();
  RETURN COALESCE(result, false);
END;
$$;


ALTER FUNCTION "public"."get_my_admin_status"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: features; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."features" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "votes_count" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'Asia/Muscat'::"text") NOT NULL,
    "is_approved" boolean,
    "submitter_email" "text",
    "submitter_name" "text",
    "is_anonymous" boolean DEFAULT false NOT NULL,
    CONSTRAINT "features_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'in_progress'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."features" OWNER TO "postgres";

--
-- Name: get_pending_suggestions(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."get_pending_suggestions"() RETURNS SETOF "public"."features"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  admin_check BOOLEAN;
BEGIN
  SELECT is_admin INTO admin_check
  FROM public.users
  WHERE id = auth.uid();

  IF NOT COALESCE(admin_check, false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
    SELECT * FROM public.features
    WHERE is_approved IS NULL
    ORDER BY created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_pending_suggestions"() OWNER TO "postgres";

--
-- Name: hook_allow_only_squ_domains("jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."hook_allow_only_squ_domains"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  user_email TEXT;
  is_allowed BOOLEAN := FALSE;
BEGIN
  -- Extract email from the hook event payload
  user_email := LOWER(TRIM(event->>'email'));

  -- Check if email is from allowed SQU domains
  IF user_email LIKE '%@squ.edu.om' OR user_email LIKE '%@student.squ.edu.om' THEN
    is_allowed := TRUE;
  END IF;

  -- If not from SQU domain, check approved_users table
  IF NOT is_allowed THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.approved_users
      WHERE LOWER(email) = user_email
    ) INTO is_allowed;
  END IF;

  -- Allow or deny
  IF is_allowed THEN
    RETURN jsonb_build_object('decision', 'continue');
  ELSE
    RETURN jsonb_build_object(
      'decision', 'reject',
      'message', 'Access restricted. Only SQU emails or pre-approved users can sign in.'
    );
  END IF;

END;
$$;


ALTER FUNCTION "public"."hook_allow_only_squ_domains"("event" "jsonb") OWNER TO "postgres";

--
-- Name: moderate_suggestion("uuid", boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."moderate_suggestion"("p_feature_id" "uuid", "p_approve" boolean) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  admin_check BOOLEAN;
BEGIN
  -- Only admins can call this
  SELECT is_admin INTO admin_check
  FROM public.users WHERE id = auth.uid();

  IF NOT COALESCE(admin_check, false) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.features
    SET is_approved = p_approve
  WHERE id = p_feature_id;

  RETURN json_build_object('id', p_feature_id, 'approved', p_approve);
END;
$$;


ALTER FUNCTION "public"."moderate_suggestion"("p_feature_id" "uuid", "p_approve" boolean) OWNER TO "postgres";

--
-- Name: projects_before_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."projects_before_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.public_id is null then
    new.public_id := public.allocate_project_public_id();
  end if;

  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."projects_before_insert"() OWNER TO "postgres";

--
-- Name: search_knowledge("public"."vector", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."search_knowledge"("query_embedding" "public"."vector", "match_count" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "title" "text", "content" "text", "source" "text", "distance" double precision)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT
    id,
    title,
    content,
    source,
    (embedding <=> query_embedding)::FLOAT AS distance
  FROM public.ai_knowledge
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding ASC
  LIMIT match_count;
$$;


ALTER FUNCTION "public"."search_knowledge"("query_embedding" "public"."vector", "match_count" integer) OWNER TO "postgres";

--
-- Name: set_initiatives_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_initiatives_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_initiatives_updated_at"() OWNER TO "postgres";

--
-- Name: set_users_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."set_users_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_users_updated_at"() OWNER TO "postgres";

--
-- Name: submit_anon_suggestion("text", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."submit_anon_suggestion"("p_title" "text", "p_description" "text", "p_submitter_email" "text" DEFAULT NULL::"text", "p_submitter_name" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  clean_title text := trim(coalesce(p_title, ''));
  clean_description text := trim(coalesce(p_description, ''));
  clean_email text := lower(trim(coalesce(p_submitter_email, '')));
  clean_name text := trim(coalesce(p_submitter_name, ''));
  new_id uuid;
begin
  if length(clean_title) < 3 or length(clean_title) > 120 then
    raise exception 'Invalid title' using errcode = '22023';
  end if;
  if length(clean_description) > 2000 or length(clean_name) > 100 or length(clean_email) > 254 then
    raise exception 'Suggestion fields are too long' using errcode = '22023';
  end if;
  if clean_email <> '' and clean_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid email' using errcode = '22023';
  end if;

  insert into public.features(
    title, description, status, submitter_email, submitter_name,
    is_anonymous, is_approved, created_by
  ) values (
    clean_title, clean_description, 'planned', nullif(clean_email, ''),
    nullif(clean_name, ''), true, null, null
  ) returning id into new_id;
  return json_build_object('id', new_id, 'status', 'pending');
end;
$_$;


ALTER FUNCTION "public"."submit_anon_suggestion"("p_title" "text", "p_description" "text", "p_submitter_email" "text", "p_submitter_name" "text") OWNER TO "postgres";

--
-- Name: toggle_anon_vote("uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."toggle_anon_vote"("p_feature_id" "uuid", "p_fingerprint" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  normalized_fingerprint text := trim(coalesce(p_fingerprint, ''));
  already_voted boolean;
  new_count integer;
begin
  if length(normalized_fingerprint) < 32 or length(normalized_fingerprint) > 128
     or normalized_fingerprint !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Invalid fingerprint' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.features
    where id = p_feature_id and is_approved is true
  ) then
    raise exception 'Feature not found' using errcode = 'P0002';
  end if;

  select exists(
    select 1 from public.anon_votes
    where feature_id = p_feature_id and fingerprint = normalized_fingerprint
  ) into already_voted;

  if already_voted then
    delete from public.anon_votes
      where feature_id = p_feature_id and fingerprint = normalized_fingerprint;
    update public.features set votes_count = greatest(0, votes_count - 1)
      where id = p_feature_id returning votes_count into new_count;
  else
    insert into public.anon_votes(feature_id, fingerprint)
      values (p_feature_id, normalized_fingerprint);
    update public.features set votes_count = votes_count + 1
      where id = p_feature_id returning votes_count into new_count;
  end if;

  return json_build_object('voted', not already_voted, 'votes_count', new_count);
end;
$_$;


ALTER FUNCTION "public"."toggle_anon_vote"("p_feature_id" "uuid", "p_fingerprint" "text") OWNER TO "postgres";

--
-- Name: toggle_feature_vote("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."toggle_feature_vote"("p_feature_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := (select auth.uid());
  existing_vote uuid;
  new_count integer;
  voted boolean;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.features
    where id = p_feature_id and is_approved is true
  ) then
    raise exception 'Feature not found' using errcode = 'P0002';
  end if;

  select id into existing_vote
  from public.feature_votes
  where feature_id = p_feature_id and user_id = caller_id
  for update;

  if existing_vote is not null then
    delete from public.feature_votes where id = existing_vote;
    update public.features
      set votes_count = greatest(0, votes_count - 1)
      where id = p_feature_id
      returning votes_count into new_count;
    voted := false;
  else
    insert into public.feature_votes (user_id, feature_id)
      values (caller_id, p_feature_id);
    update public.features
      set votes_count = votes_count + 1
      where id = p_feature_id
      returning votes_count into new_count;
    voted := true;
  end if;

  return json_build_object('votes_count', new_count, 'voted', voted);
end;
$$;


ALTER FUNCTION "public"."toggle_feature_vote"("p_feature_id" "uuid") OWNER TO "postgres";

--
-- Name: update_approved_users_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_approved_users_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_approved_users_updated_at"() OWNER TO "postgres";

--
-- Name: teams_sign_up_form; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."teams_sign_up_form" (
    "id" bigint NOT NULL,
    "project_name" "text",
    "leader_name" "text",
    "leader_email" "text",
    "idea" "text",
    "website_confirmation" boolean,
    "website_url" "text",
    "plan_type" "text",
    "submitted_time" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'Asia/Muscat'::"text")
);


ALTER TABLE "public"."teams_sign_up_form" OWNER TO "postgres";

--
-- Name: Teams Sign-up Form_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE "public"."teams_sign_up_form" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."Teams Sign-up Form_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: admin_activity_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."admin_activity_log" (
    "id" bigint NOT NULL,
    "admin_email" "text" NOT NULL,
    "action" "text" NOT NULL,
    "action_type" "text" NOT NULL,
    "target_email" "text",
    "details" "text",
    "count" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "admin_activity_log_action_type_check" CHECK (("action_type" = ANY (ARRAY['user_add'::"text", 'user_remove'::"text", 'admin_add'::"text", 'admin_remove'::"text", 'bulk'::"text", 'access'::"text"])))
);


ALTER TABLE "public"."admin_activity_log" OWNER TO "postgres";

--
-- Name: TABLE "admin_activity_log"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."admin_activity_log" IS 'Stores audit trail of all admin panel activities';


--
-- Name: COLUMN "admin_activity_log"."admin_email"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."admin_activity_log"."admin_email" IS 'Email of the admin who performed the action';


--
-- Name: COLUMN "admin_activity_log"."action"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."admin_activity_log"."action" IS 'Human-readable description of the action';


--
-- Name: COLUMN "admin_activity_log"."action_type"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."admin_activity_log"."action_type" IS 'Type of action: user_add, user_remove, admin_add, admin_remove, bulk, access';


--
-- Name: COLUMN "admin_activity_log"."target_email"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."admin_activity_log"."target_email" IS 'Email address affected by the action (if applicable)';


--
-- Name: COLUMN "admin_activity_log"."details"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."admin_activity_log"."details" IS 'Additional details about the action';


--
-- Name: COLUMN "admin_activity_log"."count"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."admin_activity_log"."count" IS 'Number of items affected (for bulk actions)';


--
-- Name: COLUMN "admin_activity_log"."created_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."admin_activity_log"."created_at" IS 'Timestamp when the action occurred';


--
-- Name: admin_activity_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS "public"."admin_activity_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."admin_activity_log_id_seq" OWNER TO "postgres";

--
-- Name: admin_activity_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."admin_activity_log_id_seq" OWNED BY "public"."admin_activity_log"."id";


--
-- Name: admins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."admins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "added_by" "text",
    "added_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text"
);


ALTER TABLE "public"."admins" OWNER TO "postgres";

--
-- Name: TABLE "admins"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."admins" IS 'Platform administrators who can manage approved users';


--
-- Name: ai_chat_usage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ai_chat_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "used_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'Asia/Muscat'::"text")
);


ALTER TABLE "public"."ai_chat_usage" OWNER TO "postgres";

--
-- Name: ai_knowledge; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ai_knowledge" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "source" "text" NOT NULL,
    "embedding" "public"."vector"(768),
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'Asia/Muscat'::"text"),
    CONSTRAINT "ai_knowledge_source_check" CHECK (("source" = ANY (ARRAY['nexcore'::"text", 'squ'::"text", 'project'::"text"])))
);


ALTER TABLE "public"."ai_knowledge" OWNER TO "postgres";

--
-- Name: ai_usage_daily; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."ai_usage_daily" (
    "user_id" "uuid" NOT NULL,
    "day" "date" NOT NULL,
    "used" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'Asia/Muscat'::"text") NOT NULL,
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'Asia/Muscat'::"text") NOT NULL
);


ALTER TABLE "public"."ai_usage_daily" OWNER TO "postgres";

--
-- Name: anon_votes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."anon_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feature_id" "uuid" NOT NULL,
    "fingerprint" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'Asia/Muscat'::"text") NOT NULL
);


ALTER TABLE "public"."anon_votes" OWNER TO "postgres";

--
-- Name: approved_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."approved_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "approved_by" "text",
    "reason" "text",
    "approved_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."approved_users" OWNER TO "postgres";

--
-- Name: TABLE "approved_users"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."approved_users" IS 'Whitelist of approved non-SQU email addresses for platform access';


--
-- Name: email_subscribers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."email_subscribers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "unsubscribed_at" timestamp with time zone
);


ALTER TABLE "public"."email_subscribers" OWNER TO "postgres";

--
-- Name: feature_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."feature_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feature_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."feature_comments" OWNER TO "postgres";

--
-- Name: feature_votes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."feature_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "feature_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'Asia/Muscat'::"text") NOT NULL
);


ALTER TABLE "public"."feature_votes" OWNER TO "postgres";

--
-- Name: initiatives; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."initiatives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "status" "text" NOT NULL,
    "categories" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "featured" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "visibility" "text" DEFAULT 'draft'::"text" NOT NULL,
    "title" "jsonb" NOT NULL,
    "mission" "jsonb" NOT NULL,
    "summary" "jsonb" NOT NULL,
    "overview" "jsonb" NOT NULL,
    "highlights" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "image" "jsonb",
    "primary_link" "jsonb",
    "launched_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "initiatives_categories_check" CHECK (("cardinality"("categories") > 0)),
    CONSTRAINT "initiatives_highlights_check" CHECK (("jsonb_typeof"("highlights") = 'array'::"text")),
    CONSTRAINT "initiatives_mission_check" CHECK ((("mission" ? 'en'::"text") AND ("mission" ? 'ar'::"text"))),
    CONSTRAINT "initiatives_overview_check" CHECK ((("overview" ? 'en'::"text") AND ("overview" ? 'ar'::"text"))),
    CONSTRAINT "initiatives_slug_check" CHECK (("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::"text")),
    CONSTRAINT "initiatives_status_check" CHECK (("status" = ANY (ARRAY['launched'::"text", 'active'::"text", 'in-development'::"text", 'incubation'::"text", 'concept'::"text"]))),
    CONSTRAINT "initiatives_summary_check" CHECK ((("summary" ? 'en'::"text") AND ("summary" ? 'ar'::"text"))),
    CONSTRAINT "initiatives_title_check" CHECK ((("title" ? 'en'::"text") AND ("title" ? 'ar'::"text"))),
    CONSTRAINT "initiatives_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'draft'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."initiatives" OWNER TO "postgres";

--
-- Name: TABLE "initiatives"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."initiatives" IS 'Bilingual public catalogue for launched and emerging NexCore Labs initiatives.';


--
-- Name: moderation_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."moderation_logs" (
    "id" bigint NOT NULL,
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "status" "text" NOT NULL,
    "categories" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "confidence" real,
    "reason" "text",
    "provider" "text" DEFAULT 'gemini'::"text" NOT NULL,
    "model" "text",
    "input_hash" "text",
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'Asia/Muscat'::"text") NOT NULL
);


ALTER TABLE "public"."moderation_logs" OWNER TO "postgres";

--
-- Name: moderation_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS "public"."moderation_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."moderation_logs_id_seq" OWNER TO "postgres";

--
-- Name: moderation_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."moderation_logs_id_seq" OWNED BY "public"."moderation_logs"."id";


--
-- Name: page_visits_daily; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."page_visits_daily" (
    "day" "date" NOT NULL,
    "page_path" "text" NOT NULL,
    "visits" bigint DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'Asia/Muscat'::"text") NOT NULL
);


ALTER TABLE "public"."page_visits_daily" OWNER TO "postgres";

--
-- Name: project_counter; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."project_counter" (
    "id" integer DEFAULT 1 NOT NULL,
    "next_val" bigint NOT NULL
);


ALTER TABLE "public"."project_counter" OWNER TO "postgres";

--
-- Name: project_moderation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."project_moderation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "moderation_status" "text" DEFAULT 'pending'::"text",
    "flagged_reason" "text",
    "ai_score" numeric,
    "created_at" timestamp without time zone DEFAULT ("now"() AT TIME ZONE 'Asia/Muscat'::"text")
);


ALTER TABLE "public"."project_moderation" OWNER TO "postgres";

--
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "public_id" "text",
    "slug" "text",
    "name" "text",
    "card_description" "text",
    "website" "text",
    "x_url" "text",
    "github_url" "text",
    "linkedin_url" "text",
    "published" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'Asia/Muscat'::"text") NOT NULL,
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'Asia/Muscat'::"text") NOT NULL,
    "instagram_url" "text",
    "image_url" "text",
    "page_description" "text",
    "moderation_status" "text" DEFAULT 'unmoderated'::"text" NOT NULL,
    "moderation_reason" "text",
    "last_moderated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'Asia/Muscat'::"text"),
    "last_moderation_version" integer DEFAULT 1 NOT NULL,
    "creator_name" "text",
    "creator_avatar_url" "text",
    "category" "text",
    "scan_code_version" "text" DEFAULT 'NXC1'::"text" NOT NULL,
    "scan_code_issued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "projects_category_check" CHECK ((("category" IS NULL) OR ("category" = ANY (ARRAY['technology'::"text", 'business'::"text", 'education'::"text", 'finance'::"text", 'healthcare'::"text", 'environment'::"text", 'agriculture'::"text", 'food'::"text", 'travel'::"text", 'transportation'::"text", 'real-estate'::"text", 'media-entertainment'::"text", 'art-design'::"text", 'sports-fitness'::"text", 'community'::"text", 'lifestyle'::"text"]))))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";

--
-- Name: subscription_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."subscription_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bill_id" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "user_email" "text" NOT NULL,
    "whatsapp_number" "text",
    "selected_features" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "total_omr" numeric(10,3) DEFAULT 0 NOT NULL,
    "total_usd" numeric(10,2) DEFAULT 0 NOT NULL,
    "payment_method" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "admin_notes" "text",
    "paypal_order_id" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "activated_at" timestamp with time zone,
    "receipt_url" "text",
    "bank_transaction_ref" "text",
    "transfer_date" "date",
    "organization" "text",
    "pricing_policy_version" "text",
    "pricing_policy_accepted_at" timestamp with time zone,
    CONSTRAINT "subscription_orders_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['whatsapp'::"text", 'paypal'::"text", 'bank_transfer'::"text"]))),
    CONSTRAINT "subscription_orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'rejected'::"text", 'cancelled'::"text", 'pending_verification'::"text"])))
);


ALTER TABLE "public"."subscription_orders" OWNER TO "postgres";

--
-- Name: COLUMN "subscription_orders"."pricing_policy_version"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."subscription_orders"."pricing_policy_version" IS 'Version of the Pricing & Billing Policy accepted when the order was placed.';


--
-- Name: COLUMN "subscription_orders"."pricing_policy_accepted_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."subscription_orders"."pricing_policy_accepted_at" IS 'Server timestamp recording when the customer accepted the pricing policy.';


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'Asia/Muscat'::"text") NOT NULL,
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'Asia/Muscat'::"text") NOT NULL,
    "contact_email" "text",
    "phone_number" "text",
    "is_admin" boolean DEFAULT false NOT NULL,
    CONSTRAINT "contact_email_format" CHECK ((("contact_email" IS NULL) OR ("contact_email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::"text"))),
    CONSTRAINT "users_phone_number_length_check" CHECK ((("phone_number" IS NULL) OR (("char_length"(TRIM(BOTH FROM "phone_number")) >= 6) AND ("char_length"(TRIM(BOTH FROM "phone_number")) <= 20))))
);


ALTER TABLE "public"."users" OWNER TO "postgres";

--
-- Name: COLUMN "users"."is_admin"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."users"."is_admin" IS 'Grants admin privileges: status management on features, etc.';


--
-- Name: user_public_profiles; Type: VIEW; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW "public"."user_public_profiles" WITH ("security_invoker"='true') AS
 SELECT "id",
    "name",
    "avatar_url"
   FROM "public"."users";


ALTER VIEW "public"."user_public_profiles" OWNER TO "postgres";

--
-- Name: admin_activity_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_activity_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."admin_activity_log_id_seq"'::"regclass");


--
-- Name: moderation_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."moderation_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."moderation_logs_id_seq"'::"regclass");


--
-- Name: email_subscribers Email Subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."email_subscribers"
    ADD CONSTRAINT "Email Subscribers_pkey" PRIMARY KEY ("id");


--
-- Name: teams_sign_up_form Teams Sign-up Form_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."teams_sign_up_form"
    ADD CONSTRAINT "Teams Sign-up Form_id_key" UNIQUE ("id");


--
-- Name: teams_sign_up_form Teams Sign-up Form_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."teams_sign_up_form"
    ADD CONSTRAINT "Teams Sign-up Form_pkey" PRIMARY KEY ("id");


--
-- Name: admin_activity_log admin_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_activity_log"
    ADD CONSTRAINT "admin_activity_log_pkey" PRIMARY KEY ("id");


--
-- Name: admins admins_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admins"
    ADD CONSTRAINT "admins_email_key" UNIQUE ("email");


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admins"
    ADD CONSTRAINT "admins_pkey" PRIMARY KEY ("id");


--
-- Name: ai_chat_usage ai_chat_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_chat_usage"
    ADD CONSTRAINT "ai_chat_usage_pkey" PRIMARY KEY ("id");


--
-- Name: ai_knowledge ai_knowledge_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_knowledge"
    ADD CONSTRAINT "ai_knowledge_pkey" PRIMARY KEY ("id");


--
-- Name: ai_usage_daily ai_usage_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_usage_daily"
    ADD CONSTRAINT "ai_usage_daily_pkey" PRIMARY KEY ("user_id", "day");


--
-- Name: anon_votes anon_votes_feature_id_fingerprint_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."anon_votes"
    ADD CONSTRAINT "anon_votes_feature_id_fingerprint_key" UNIQUE ("feature_id", "fingerprint");


--
-- Name: anon_votes anon_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."anon_votes"
    ADD CONSTRAINT "anon_votes_pkey" PRIMARY KEY ("id");


--
-- Name: approved_users approved_users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."approved_users"
    ADD CONSTRAINT "approved_users_email_key" UNIQUE ("email");


--
-- Name: approved_users approved_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."approved_users"
    ADD CONSTRAINT "approved_users_pkey" PRIMARY KEY ("id");


--
-- Name: feature_comments feature_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."feature_comments"
    ADD CONSTRAINT "feature_comments_pkey" PRIMARY KEY ("id");


--
-- Name: feature_votes feature_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."feature_votes"
    ADD CONSTRAINT "feature_votes_pkey" PRIMARY KEY ("id");


--
-- Name: feature_votes feature_votes_user_id_feature_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."feature_votes"
    ADD CONSTRAINT "feature_votes_user_id_feature_id_key" UNIQUE ("user_id", "feature_id");


--
-- Name: features features_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."features"
    ADD CONSTRAINT "features_pkey" PRIMARY KEY ("id");


--
-- Name: initiatives initiatives_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."initiatives"
    ADD CONSTRAINT "initiatives_pkey" PRIMARY KEY ("id");


--
-- Name: initiatives initiatives_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."initiatives"
    ADD CONSTRAINT "initiatives_slug_key" UNIQUE ("slug");


--
-- Name: moderation_logs moderation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."moderation_logs"
    ADD CONSTRAINT "moderation_logs_pkey" PRIMARY KEY ("id");


--
-- Name: page_visits_daily page_visits_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."page_visits_daily"
    ADD CONSTRAINT "page_visits_daily_pkey" PRIMARY KEY ("day", "page_path");


--
-- Name: project_counter project_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."project_counter"
    ADD CONSTRAINT "project_counter_pkey" PRIMARY KEY ("id");


--
-- Name: project_moderation project_moderation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."project_moderation"
    ADD CONSTRAINT "project_moderation_pkey" PRIMARY KEY ("id");


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");


--
-- Name: projects projects_public_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_public_id_key" UNIQUE ("public_id");


--
-- Name: projects projects_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_slug_key" UNIQUE ("slug");


--
-- Name: subscription_orders subscription_orders_bill_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."subscription_orders"
    ADD CONSTRAINT "subscription_orders_bill_id_key" UNIQUE ("bill_id");


--
-- Name: subscription_orders subscription_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."subscription_orders"
    ADD CONSTRAINT "subscription_orders_pkey" PRIMARY KEY ("id");


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");


--
-- Name: ai_chat_usage_user_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ai_chat_usage_user_date_idx" ON "public"."ai_chat_usage" USING "btree" ("user_id", "used_at");


--
-- Name: ai_knowledge_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ai_knowledge_created_at_idx" ON "public"."ai_knowledge" USING "btree" ("created_at" DESC);


--
-- Name: ai_knowledge_embedding_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ai_knowledge_embedding_idx" ON "public"."ai_knowledge" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');


--
-- Name: ai_knowledge_source_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ai_knowledge_source_idx" ON "public"."ai_knowledge" USING "btree" ("source");


--
-- Name: ai_knowledge_unique_logical_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ai_knowledge_unique_logical_idx" ON "public"."ai_knowledge" USING "btree" ("lower"(TRIM(BOTH FROM "source")), "md5"("lower"(TRIM(BOTH FROM "title"))), "md5"("lower"(TRIM(BOTH FROM "content"))));


--
-- Name: email_subscribers_email_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "email_subscribers_email_unique" ON "public"."email_subscribers" USING "btree" ("lower"("email"));


--
-- Name: idx_admin_activity_log_action_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_activity_log_action_type" ON "public"."admin_activity_log" USING "btree" ("action_type");


--
-- Name: idx_admin_activity_log_admin_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_activity_log_admin_email" ON "public"."admin_activity_log" USING "btree" ("admin_email");


--
-- Name: idx_admin_activity_log_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_activity_log_created_at" ON "public"."admin_activity_log" USING "btree" ("created_at" DESC);


--
-- Name: idx_admin_activity_log_target_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_activity_log_target_email" ON "public"."admin_activity_log" USING "btree" ("target_email");


--
-- Name: idx_admins_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admins_email" ON "public"."admins" USING "btree" ("email");


--
-- Name: idx_approved_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_approved_users_email" ON "public"."approved_users" USING "btree" ("email");


--
-- Name: idx_feature_comments_feature; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_feature_comments_feature" ON "public"."feature_comments" USING "btree" ("feature_id");


--
-- Name: idx_feature_votes_feature; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_feature_votes_feature" ON "public"."feature_votes" USING "btree" ("feature_id");


--
-- Name: idx_feature_votes_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_feature_votes_user" ON "public"."feature_votes" USING "btree" ("user_id");


--
-- Name: idx_features_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_features_status" ON "public"."features" USING "btree" ("status");


--
-- Name: idx_features_votes; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_features_votes" ON "public"."features" USING "btree" ("votes_count" DESC);


--
-- Name: idx_orders_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_orders_organization" ON "public"."subscription_orders" USING "btree" ("organization") WHERE ("organization" IS NOT NULL);


--
-- Name: idx_sub_orders_bill_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_sub_orders_bill_id" ON "public"."subscription_orders" USING "btree" ("bill_id");


--
-- Name: idx_sub_orders_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_sub_orders_created_at" ON "public"."subscription_orders" USING "btree" ("created_at" DESC);


--
-- Name: idx_sub_orders_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_sub_orders_email" ON "public"."subscription_orders" USING "btree" ("user_email");


--
-- Name: idx_sub_orders_payment_method; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_sub_orders_payment_method" ON "public"."subscription_orders" USING "btree" ("payment_method");


--
-- Name: idx_sub_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_sub_orders_status" ON "public"."subscription_orders" USING "btree" ("status");


--
-- Name: initiatives_categories_gin_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "initiatives_categories_gin_idx" ON "public"."initiatives" USING "gin" ("categories");


--
-- Name: initiatives_public_sort_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "initiatives_public_sort_idx" ON "public"."initiatives" USING "btree" ("visibility", "featured" DESC, "sort_order", "updated_at" DESC);


--
-- Name: moderation_logs_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "moderation_logs_created_at_idx" ON "public"."moderation_logs" USING "btree" ("created_at");


--
-- Name: moderation_logs_project_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "moderation_logs_project_id_idx" ON "public"."moderation_logs" USING "btree" ("project_id");


--
-- Name: moderation_logs_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "moderation_logs_user_id_idx" ON "public"."moderation_logs" USING "btree" ("user_id");


--
-- Name: one_project_per_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "one_project_per_user" ON "public"."projects" USING "btree" ("owner_user_id");


--
-- Name: initiatives initiatives_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "initiatives_set_updated_at" BEFORE UPDATE ON "public"."initiatives" FOR EACH ROW EXECUTE FUNCTION "public"."set_initiatives_updated_at"();


--
-- Name: projects trg_projects_before_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_projects_before_insert" BEFORE INSERT ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."projects_before_insert"();


--
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_users_updated_at"();


--
-- Name: approved_users update_approved_users_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "update_approved_users_timestamp" BEFORE UPDATE ON "public"."approved_users" FOR EACH ROW EXECUTE FUNCTION "public"."update_approved_users_updated_at"();


--
-- Name: ai_chat_usage ai_chat_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."ai_chat_usage"
    ADD CONSTRAINT "ai_chat_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: anon_votes anon_votes_feature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."anon_votes"
    ADD CONSTRAINT "anon_votes_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE CASCADE;


--
-- Name: feature_comments feature_comments_feature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."feature_comments"
    ADD CONSTRAINT "feature_comments_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE CASCADE;


--
-- Name: feature_comments feature_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."feature_comments"
    ADD CONSTRAINT "feature_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: feature_votes feature_votes_feature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."feature_votes"
    ADD CONSTRAINT "feature_votes_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE CASCADE;


--
-- Name: feature_votes feature_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."feature_votes"
    ADD CONSTRAINT "feature_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: features features_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."features"
    ADD CONSTRAINT "features_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: initiatives initiatives_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."initiatives"
    ADD CONSTRAINT "initiatives_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: initiatives initiatives_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."initiatives"
    ADD CONSTRAINT "initiatives_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: project_moderation project_moderation_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."project_moderation"
    ADD CONSTRAINT "project_moderation_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;


--
-- Name: projects projects_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: users users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: features Admins can delete all features; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete all features" ON "public"."features" FOR DELETE USING (("auth"."role"() = 'service_role'::"text"));


--
-- Name: admin_activity_log Admins can delete old activity logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete old activity logs" ON "public"."admin_activity_log" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."email" = ("auth"."jwt"() ->> 'email'::"text")))));


--
-- Name: admin_activity_log Admins can insert activity logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert activity logs" ON "public"."admin_activity_log" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."email" = ("auth"."jwt"() ->> 'email'::"text")))));


--
-- Name: admin_activity_log Admins can view activity logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view activity logs" ON "public"."admin_activity_log" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."email" = ("auth"."jwt"() ->> 'email'::"text")))));


--
-- Name: teams_sign_up_form Allow public inserts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public inserts" ON "public"."teams_sign_up_form" FOR INSERT TO "anon" WITH CHECK (true);


--
-- Name: anon_votes Anyone can insert anon vote; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can insert anon vote" ON "public"."anon_votes" FOR INSERT WITH CHECK (true);


--
-- Name: feature_comments Anyone can read comments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anyone can read comments" ON "public"."feature_comments" FOR SELECT USING (true);


--
-- Name: feature_comments Authenticated users can comment; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can comment" ON "public"."feature_comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));


--
-- Name: features Authenticated users can insert features; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can insert features" ON "public"."features" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));


--
-- Name: projects Authenticated users can view published projects; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can view published projects" ON "public"."projects" FOR SELECT TO "authenticated" USING (("published" = true));


--
-- Name: feature_votes Members can read own votes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Members can read own votes" ON "public"."feature_votes" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));


--
-- Name: anon_votes No direct reads on anon_votes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "No direct reads on anon_votes" ON "public"."anon_votes" FOR SELECT USING (false);


--
-- Name: features Owners can update their features; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners can update their features" ON "public"."features" FOR UPDATE USING (("auth"."uid"() = "created_by"));


--
-- Name: projects Public can view published projects; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can view published projects" ON "public"."projects" FOR SELECT TO "anon" USING (("published" = true));


--
-- Name: initiatives Public initiatives are readable; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public initiatives are readable" ON "public"."initiatives" FOR SELECT TO "authenticated", "anon" USING (("visibility" = 'public'::"text"));


--
-- Name: features Public reads approved features; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public reads approved features" ON "public"."features" FOR SELECT USING (("is_approved" = true));


--
-- Name: feature_comments Users can delete own comments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own comments" ON "public"."feature_comments" FOR DELETE USING (("auth"."uid"() = "user_id"));


--
-- Name: features Users can delete their own features; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own features" ON "public"."features" FOR DELETE USING (("auth"."uid"() = "created_by"));


--
-- Name: projects Users can manage own projects; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage own projects" ON "public"."projects" TO "authenticated" USING (("owner_user_id" = "auth"."uid"())) WITH CHECK (("owner_user_id" = "auth"."uid"()));


--
-- Name: projects Users can view own projects; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own projects" ON "public"."projects" FOR SELECT TO "authenticated" USING (("owner_user_id" = "auth"."uid"()));


--
-- Name: admin_activity_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."admin_activity_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: admins; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."admins" ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_orders admins_can_read_all_orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admins_can_read_all_orders" ON "public"."subscription_orders" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."email" = ("auth"."jwt"() ->> 'email'::"text")))));


--
-- Name: subscription_orders admins_can_update_orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "admins_can_update_orders" ON "public"."subscription_orders" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admins"
  WHERE ("admins"."email" = ("auth"."jwt"() ->> 'email'::"text"))))) WITH CHECK (true);


--
-- Name: ai_chat_usage; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ai_chat_usage" ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_chat_usage ai_chat_usage_own_rows; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_chat_usage_own_rows" ON "public"."ai_chat_usage" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));


--
-- Name: ai_knowledge; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ai_knowledge" ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_knowledge ai_knowledge_read_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_knowledge_read_authenticated" ON "public"."ai_knowledge" FOR SELECT TO "authenticated" USING (true);


--
-- Name: ai_knowledge ai_knowledge_write_service_role; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_knowledge_write_service_role" ON "public"."ai_knowledge" TO "service_role" USING (true);


--
-- Name: ai_usage_daily; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."ai_usage_daily" ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_usage_daily ai_usage_read_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "ai_usage_read_own" ON "public"."ai_usage_daily" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));


--
-- Name: anon_votes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."anon_votes" ENABLE ROW LEVEL SECURITY;

--
-- Name: approved_users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."approved_users" ENABLE ROW LEVEL SECURITY;

--
-- Name: email_subscribers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."email_subscribers" ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."feature_comments" ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_votes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."feature_votes" ENABLE ROW LEVEL SECURITY;

--
-- Name: features; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."features" ENABLE ROW LEVEL SECURITY;

--
-- Name: initiatives; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."initiatives" ENABLE ROW LEVEL SECURITY;

--
-- Name: moderation_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."moderation_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: moderation_logs moderation_logs_read_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "moderation_logs_read_own" ON "public"."moderation_logs" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));


--
-- Name: page_visits_daily; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."page_visits_daily" ENABLE ROW LEVEL SECURITY;

--
-- Name: project_counter; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."project_counter" ENABLE ROW LEVEL SECURITY;

--
-- Name: project_moderation; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."project_moderation" ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;

--
-- Name: projects projects_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "projects_delete_own" ON "public"."projects" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "owner_user_id"));


--
-- Name: projects projects_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "projects_insert_own" ON "public"."projects" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "owner_user_id"));


--
-- Name: projects projects_public_read_published; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "projects_public_read_published" ON "public"."projects" FOR SELECT TO "anon" USING (("published" = true));


--
-- Name: projects projects_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "projects_select_own" ON "public"."projects" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "owner_user_id"));


--
-- Name: projects projects_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "projects_update_own" ON "public"."projects" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "owner_user_id")) WITH CHECK (("auth"."uid"() = "owner_user_id"));


--
-- Name: subscription_orders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."subscription_orders" ENABLE ROW LEVEL SECURITY;

--
-- Name: teams_sign_up_form; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."teams_sign_up_form" ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_orders users_can_read_own_orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "users_can_read_own_orders" ON "public"."subscription_orders" FOR SELECT TO "authenticated" USING (("user_email" = ("auth"."jwt"() ->> 'email'::"text")));


--
-- Name: users users_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "users_insert_own" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));


--
-- Name: users users_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "users_select_own" ON "public"."users" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));


--
-- Name: users users_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "users_update_own" ON "public"."users" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));


--
-- Name: SCHEMA "private"; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA "private" TO "service_role";


--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "supabase_auth_admin";


--
-- Name: FUNCTION "is_current_user_admin"(); Type: ACL; Schema: private; Owner: postgres
--

REVOKE ALL ON FUNCTION "private"."is_current_user_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."is_current_user_admin"() TO "service_role";


--
-- Name: FUNCTION "allocate_project_public_id"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."allocate_project_public_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."allocate_project_public_id"() TO "service_role";


--
-- Name: FUNCTION "check_email_authorization"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."check_email_authorization"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_email_authorization"() TO "service_role";


--
-- Name: FUNCTION "consume_ai_chat_use"("max_uses" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."consume_ai_chat_use"("max_uses" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_ai_chat_use"("max_uses" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_ai_chat_use"("max_uses" integer) TO "service_role";


--
-- Name: FUNCTION "consume_ai_use"("max_uses" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."consume_ai_use"("max_uses" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_ai_use"("max_uses" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_ai_use"("max_uses" integer) TO "service_role";


--
-- Name: FUNCTION "get_ai_chat_usage"("max_uses" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."get_ai_chat_usage"("max_uses" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_ai_chat_usage"("max_uses" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ai_chat_usage"("max_uses" integer) TO "service_role";


--
-- Name: FUNCTION "get_my_admin_status"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."get_my_admin_status"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_admin_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_admin_status"() TO "service_role";


--
-- Name: TABLE "features"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."features" TO "anon";
GRANT ALL ON TABLE "public"."features" TO "authenticated";
GRANT ALL ON TABLE "public"."features" TO "service_role";


--
-- Name: FUNCTION "get_pending_suggestions"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."get_pending_suggestions"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_pending_suggestions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_suggestions"() TO "service_role";


--
-- Name: FUNCTION "hook_allow_only_squ_domains"("event" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."hook_allow_only_squ_domains"("event" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hook_allow_only_squ_domains"("event" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."hook_allow_only_squ_domains"("event" "jsonb") TO "supabase_auth_admin";


--
-- Name: FUNCTION "moderate_suggestion"("p_feature_id" "uuid", "p_approve" boolean); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."moderate_suggestion"("p_feature_id" "uuid", "p_approve" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."moderate_suggestion"("p_feature_id" "uuid", "p_approve" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."moderate_suggestion"("p_feature_id" "uuid", "p_approve" boolean) TO "service_role";


--
-- Name: FUNCTION "projects_before_insert"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."projects_before_insert"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."projects_before_insert"() TO "service_role";


--
-- Name: FUNCTION "search_knowledge"("query_embedding" "public"."vector", "match_count" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."search_knowledge"("query_embedding" "public"."vector", "match_count" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_knowledge"("query_embedding" "public"."vector", "match_count" integer) TO "service_role";


--
-- Name: FUNCTION "set_initiatives_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."set_initiatives_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_initiatives_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_initiatives_updated_at"() TO "service_role";


--
-- Name: FUNCTION "set_users_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."set_users_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_users_updated_at"() TO "service_role";


--
-- Name: FUNCTION "submit_anon_suggestion"("p_title" "text", "p_description" "text", "p_submitter_email" "text", "p_submitter_name" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."submit_anon_suggestion"("p_title" "text", "p_description" "text", "p_submitter_email" "text", "p_submitter_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_anon_suggestion"("p_title" "text", "p_description" "text", "p_submitter_email" "text", "p_submitter_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_anon_suggestion"("p_title" "text", "p_description" "text", "p_submitter_email" "text", "p_submitter_name" "text") TO "service_role";


--
-- Name: FUNCTION "toggle_anon_vote"("p_feature_id" "uuid", "p_fingerprint" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."toggle_anon_vote"("p_feature_id" "uuid", "p_fingerprint" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."toggle_anon_vote"("p_feature_id" "uuid", "p_fingerprint" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_anon_vote"("p_feature_id" "uuid", "p_fingerprint" "text") TO "service_role";


--
-- Name: FUNCTION "toggle_feature_vote"("p_feature_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."toggle_feature_vote"("p_feature_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."toggle_feature_vote"("p_feature_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_feature_vote"("p_feature_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "update_approved_users_updated_at"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."update_approved_users_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_approved_users_updated_at"() TO "service_role";


--
-- Name: TABLE "teams_sign_up_form"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."teams_sign_up_form" TO "anon";
GRANT ALL ON TABLE "public"."teams_sign_up_form" TO "authenticated";
GRANT ALL ON TABLE "public"."teams_sign_up_form" TO "service_role";


--
-- Name: SEQUENCE "Teams Sign-up Form_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."Teams Sign-up Form_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Teams Sign-up Form_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Teams Sign-up Form_id_seq" TO "service_role";


--
-- Name: TABLE "admin_activity_log"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."admin_activity_log" TO "anon";
GRANT ALL ON TABLE "public"."admin_activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_activity_log" TO "service_role";


--
-- Name: SEQUENCE "admin_activity_log_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."admin_activity_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."admin_activity_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."admin_activity_log_id_seq" TO "service_role";


--
-- Name: TABLE "admins"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."admins" TO "service_role";


--
-- Name: TABLE "ai_chat_usage"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ai_chat_usage" TO "anon";
GRANT ALL ON TABLE "public"."ai_chat_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_chat_usage" TO "service_role";


--
-- Name: TABLE "ai_knowledge"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ai_knowledge" TO "anon";
GRANT ALL ON TABLE "public"."ai_knowledge" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_knowledge" TO "service_role";


--
-- Name: TABLE "ai_usage_daily"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."ai_usage_daily" TO "anon";
GRANT ALL ON TABLE "public"."ai_usage_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_usage_daily" TO "service_role";


--
-- Name: TABLE "anon_votes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."anon_votes" TO "anon";
GRANT ALL ON TABLE "public"."anon_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."anon_votes" TO "service_role";


--
-- Name: TABLE "approved_users"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."approved_users" TO "service_role";


--
-- Name: TABLE "email_subscribers"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."email_subscribers" TO "service_role";


--
-- Name: TABLE "feature_comments"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."feature_comments" TO "anon";
GRANT ALL ON TABLE "public"."feature_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_comments" TO "service_role";


--
-- Name: TABLE "feature_votes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."feature_votes" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."feature_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_votes" TO "service_role";


--
-- Name: TABLE "initiatives"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."initiatives" TO "anon";
GRANT ALL ON TABLE "public"."initiatives" TO "authenticated";
GRANT ALL ON TABLE "public"."initiatives" TO "service_role";


--
-- Name: TABLE "moderation_logs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."moderation_logs" TO "anon";
GRANT ALL ON TABLE "public"."moderation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."moderation_logs" TO "service_role";


--
-- Name: SEQUENCE "moderation_logs_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."moderation_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."moderation_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."moderation_logs_id_seq" TO "service_role";


--
-- Name: TABLE "page_visits_daily"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."page_visits_daily" TO "service_role";


--
-- Name: TABLE "project_counter"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."project_counter" TO "service_role";


--
-- Name: TABLE "project_moderation"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."project_moderation" TO "service_role";


--
-- Name: TABLE "projects"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";


--
-- Name: TABLE "subscription_orders"; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."subscription_orders" TO "anon";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."subscription_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_orders" TO "service_role";


--
-- Name: TABLE "users"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";


--
-- Name: TABLE "user_public_profiles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."user_public_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_public_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_public_profiles" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- PostgreSQL database dump complete
--

-- \unrestrict cMZI3HHdcmeXQoZyIqKccSdPOl4JYYQnEoWcTQLBKuy71FjbqzD7VRSQ3yedRNF
