-- ============================================================
-- NexCore AI Knowledge Base — Database Setup
-- Run this in your Supabase SQL editor (in order)
-- ============================================================

-- STEP 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- STEP 2: Create the ai_knowledge table
-- Uses 768 dimensions — matches Gemini text-embedding-004 output
CREATE TABLE IF NOT EXISTS public.ai_knowledge (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  source      TEXT        NOT NULL CHECK (source IN ('nexcore', 'squ', 'project')),
  embedding   vector(768),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- STEP 3: IVFFlat index for fast approximate nearest-neighbor search
CREATE INDEX IF NOT EXISTS ai_knowledge_embedding_idx
  ON public.ai_knowledge
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- STEP 4: Semantic search function (called from the API via RPC)
CREATE OR REPLACE FUNCTION public.search_knowledge(
  query_embedding vector(768),
  match_count     INT DEFAULT 5
)
RETURNS TABLE (
  id       UUID,
  title    TEXT,
  content  TEXT,
  source   TEXT,
  distance FLOAT
)
LANGUAGE SQL STABLE SECURITY DEFINER
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

-- STEP 5: Chat usage tracking table
CREATE TABLE IF NOT EXISTS public.ai_chat_usage (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_chat_usage_user_date_idx
  ON public.ai_chat_usage (user_id, used_at);

-- STEP 6: RPC to atomically check + consume one chat use (returns remaining)
CREATE OR REPLACE FUNCTION public.consume_ai_chat_use(max_uses INT DEFAULT 10)
RETURNS JSONB
LANGUAGE PLPGSQL SECURITY DEFINER
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

-- STEP 7: RPC to get current chat usage without consuming
CREATE OR REPLACE FUNCTION public.get_ai_chat_usage(max_uses INT DEFAULT 10)
RETURNS JSONB
LANGUAGE PLPGSQL STABLE SECURITY DEFINER
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

-- STEP 8: Row Level Security for ai_knowledge
ALTER TABLE public.ai_knowledge ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read knowledge records
DROP POLICY IF EXISTS "ai_knowledge_read_authenticated" ON public.ai_knowledge;
CREATE POLICY "ai_knowledge_read_authenticated"
  ON public.ai_knowledge FOR SELECT
  TO authenticated
  USING (true);

-- Only the service role can write
DROP POLICY IF EXISTS "ai_knowledge_write_service_role" ON public.ai_knowledge;
CREATE POLICY "ai_knowledge_write_service_role"
  ON public.ai_knowledge FOR ALL
  TO service_role
  USING (true);

-- STEP 9: Row Level Security for ai_chat_usage
ALTER TABLE public.ai_chat_usage ENABLE ROW LEVEL SECURITY;

-- Users can only see their own usage
DROP POLICY IF EXISTS "ai_chat_usage_own_rows" ON public.ai_chat_usage;
CREATE POLICY "ai_chat_usage_own_rows"
  ON public.ai_chat_usage FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Grant RPC execute permissions
GRANT EXECUTE ON FUNCTION public.search_knowledge    TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_chat_use TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_chat_usage   TO authenticated;

-- ============================================================
-- STEP 10: Sample knowledge rows
-- NOTE: embedding column is NULL here — run scripts/seed-knowledge.js
--       afterwards to populate embeddings via Gemini API
-- ============================================================

INSERT INTO public.ai_knowledge (title, content, source) VALUES

-- ── NexCore platform ───────────────────────────────────────
(
  'What is NexCore Labs?',
  'NexCore Labs is an innovative online platform built for Sultan Qaboos University (SQU) students and researchers to showcase, share, and collaborate on academic and personal projects. It provides a central hub where students can publish their work, gain visibility, and connect with peers. NexCore is proudly built in Oman and is GDPR-aligned.',
  'nexcore'
),
(
  'NexCore Platform Features',
  'NexCore Labs offers the following key features: project showcasing with rich descriptions and metadata, AI-powered project summaries and page improvements, a smart search and discovery system, user profiles with social media links, a hub for discovering featured projects, contact and collaboration forms, and an admin moderation panel. The platform supports SQU-specific project categories.',
  'nexcore'
),
(
  'How to submit a project on NexCore',
  'To submit a project on NexCore Labs: (1) Create an account or sign in with Google. (2) Go to your Account page. (3) Fill in the project title, description, category, tools used, and optional website URL. (4) Submit the form. Your project will appear in the hub after admin moderation approval. You can also use the AI Assist feature to polish your project description.',
  'nexcore'
),
(
  'NexCore AI Assist Feature',
  'NexCore has an AI Assist feature powered by Google Gemini. It lets users: improve their project page description in different tones (Professional, Shorter, Technical, Inspiring), generate a concise card summary, and get AI project insights. Each user receives 3 AI Assist actions per day. The AI does not invent information; it only restructures and rewrites what you provide.',
  'nexcore'
),
(
  'NexCore supported project categories',
  'NexCore supports many project categories including: Web Development, Mobile Apps, AI & Machine Learning, Data Science, Cybersecurity, IoT & Hardware, Robotics, Game Development, Research Papers, Design & UX, Business & Entrepreneurship, Bioinformatics, Environmental Science, and more. Projects can also be tagged with the specific tools and technologies used.',
  'nexcore'
),
(
  'NexCore privacy, terms, and data policy',
  'NexCore Labs is GDPR-aligned and stores user data securely in Supabase (PostgreSQL). NexCore does not sell user data. Users can request account deletion at any time from the account settings page. Projects remain the intellectual property of the submitting student. Full details are in the Privacy Policy and Terms of Service pages on the platform.',
  'nexcore'
),
(
  'NexCore account and authentication',
  'NexCore uses Supabase Auth for authentication. Users can sign in with Google OAuth or email and password. SQU students are encouraged to use their institutional accounts. Once signed in, users can submit projects, use AI Assist, manage their profile, and view their submissions. Accounts can be fully deleted from the account settings page.',
  'nexcore'
),
(
  'NexCore roadmap and future plans',
  'The NexCore roadmap includes planned features such as: direct student collaboration tools, project ratings and comments, integration with SQU institutional systems, a mobile app, advanced AI-powered discovery and recommendations, and team-based project submissions. The platform is continuously improved based on community feedback.',
  'nexcore'
),

-- ── SQU information ────────────────────────────────────────
(
  'Sultan Qaboos University Overview',
  'Sultan Qaboos University (SQU) is the premier national university of the Sultanate of Oman, founded in 1986 by the late Sultan Qaboos bin Said. Located in Al Khoudh, Muscat, SQU has approximately 18,000 students and offers undergraduate, postgraduate, and doctorate programs across 9 colleges. The university is known for research excellence, particularly in science, engineering, medicine, and technology.',
  'squ'
),
(
  'SQU Colleges and Faculties',
  'Sultan Qaboos University has 9 colleges: (1) College of Agricultural and Marine Sciences, (2) College of Arts and Social Sciences, (3) College of Economics and Political Science, (4) College of Education, (5) College of Engineering, (6) College of Law, (7) College of Medicine and Health Sciences, (8) College of Nursing, (9) College of Science. Each college offers bachelor, master, and PhD programs.',
  'squ'
),
(
  'SQU Admission Requirements',
  'Admission to SQU requires: Omani nationality or GCC residency, completion of the General Education Diploma (Tawjihiyah) or equivalent, a minimum GPA around 80% for most programs. Competitive programs have higher thresholds: Medicine requires 95%+, Engineering 90%+. Applicants may also need to pass the SQU English Proficiency Test (EPT). International students may apply through special admission channels.',
  'squ'
),
(
  'SQU Computer Science and IT Programs',
  'The SQU College of Science offers a Bachelor of Science in Computer Science. The College of Engineering offers B.Eng programs in Computer Engineering and Electrical and Computer Engineering. Core topics include algorithms, data structures, programming, software engineering, AI, machine learning, databases, networking, and cybersecurity. Postgraduate programs are also available in Computer Science and Bioinformatics.',
  'squ'
),
(
  'SQU Research and Innovation',
  'SQU is a research-intensive university with several centers: The Research Council (TRC) funded projects, Environmental & Climate Research Center, Oman Animal & Plant Genetic Resources Center, and the Central Analytical & Applied Research Unit. SQU students and faculty publish regularly in international journals. Notable student innovations include projects now showcased on NexCore Labs.',
  'squ'
),
(
  'SQU Student Life and Clubs',
  'SQU has an active student life with over 50 registered student clubs covering sports, arts, culture, technology, entrepreneurship, and volunteering. The Student Council represents student interests. Annual events include Innovation Day, the Science Fair, and Cultural Week. The campus has sport facilities, a library with extensive digital resources, student accommodation, cafeterias, and a health clinic.',
  'squ'
),
(
  'SQU Graduation Requirements',
  'To graduate from SQU, students must complete the required credit hours (typically 120–160 for undergraduate), maintain a minimum CGPA of 2.0 out of 4.0, and pass all university requirements (Arabic language, English, IT, physical education), college requirements, and major requirements. Many programs also require a final year project or thesis.',
  'squ'
),
(
  'SQU English Proficiency Test (EPT)',
  'The SQU English Proficiency Test (EPT) determines English placement for new students. Students who do not meet the English requirement join the Language Center for an intensive English Preparation (EP) program (EP1–EP3 levels) before entering their college courses. Passing the EPT or completing the EP program is required before enrolling in full college coursework.',
  'squ'
),
(
  'SQU GPA and academic standing',
  'SQU uses a 4.0 GPA scale. Letter grades: A (4.0), A- (3.7), B+ (3.3), B (3.0), B- (2.7), C+ (2.3), C (2.0), C- (1.7), D+ (1.3), D (1.0), F (0.0). Students need a CGPA of at least 2.0 to remain in good standing and to graduate. Academic probation is triggered when CGPA falls below 2.0. Students may repeat failed courses to improve their GPA.',
  'squ'
),

-- ── Sample projects ────────────────────────────────────────
(
  'Smart Campus Navigation App (Sample Project)',
  'A mobile application developed by SQU Computer Science students that uses AR and indoor positioning to help new students navigate the SQU campus. Features include floor plans of all SQU buildings, turn-by-turn directions, room search, QR-code based location anchoring, and offline support. Built with Flutter, Firebase, and AR Foundation. Available on Android.',
  'project'
),
(
  'AI Plant Disease Detector for Omani Crops (Sample Project)',
  'A machine learning project by SQU Agricultural Sciences students that uses a convolutional neural network (CNN) to detect plant diseases from smartphone photos. Trained on 50,000 images of Omani crops (dates, limes, tomatoes). Achieved 94% accuracy. The web interface allows farmers to upload a photo and receive a diagnosis with treatment advice. Built with Python, TensorFlow, and Flask, deployed on Google Cloud.',
  'project'
),
(
  'Omani Sign Language Recognition System (Sample Project)',
  'A real-time computer vision system by SQU students that recognizes Omani Sign Language (OSL) gestures using a webcam. Uses MediaPipe for hand landmark detection and a custom LSTM model for gesture sequence classification. Achieved 91% accuracy on a 30-class dataset covering the OSL alphabet and common phrases. Built to assist the deaf and hard-of-hearing community in Oman.',
  'project'
),
(
  'Smart Water Monitoring IoT System (Sample Project)',
  'An IoT project by SQU Engineering students that monitors water quality in Omani agricultural areas. Sensors measure pH, turbidity, temperature, and dissolved oxygen in real time. Data is sent to a cloud dashboard via LoRa and MQTT. Alerts are triggered when values exceed safe thresholds. Built with Arduino, Raspberry Pi, AWS IoT Core, and a React dashboard.',
  'project'
),
(
  'NexCore Labs Platform Project',
  'NexCore Labs itself is a student project — an online platform for SQU students to showcase academic and personal projects. Built with vanilla HTML, CSS, and JavaScript on the frontend, Supabase (PostgreSQL) for the database and auth, Google Gemini for AI features, and Vercel for serverless deployment. The project was created to give SQU student work a permanent, professional home on the web.',
  'project'
),

-- ── Additional NexCore knowledge (FAQ, how-to, roadmap) ────────────────────
(
  'NexCore Labs FAQ — General Questions',
  'Common questions about NexCore Labs: Who can use it? SQU students and affiliates including research teams, student startups, clubs, and creative projects. When was NexCore founded? September 23, 2025, by a dedicated team of SQU students. How do I get started? Sign up through the Hub by clicking "Access the Core", fill in your project details, and the team responds within 48 hours. How long does it take for a project to go live? Seconds — once submitted and approved by admin moderation. NexCore is 100% led by an Omani team, uniquely focused on SQU student projects, and completely free to use.',
  'nexcore'
),
(
  'NexCore Labs FAQ — Services and Hosting',
  'NexCore services include: project card display, page design and development, SEO optimization, form integration, and ongoing support and maintenance. All project pages are hosted on secure fast servers with 99.9% uptime. Hosting is included at no cost. All pages are fully mobile-optimized and responsive. The team can help optimize project descriptions and messaging. NexCore uses Vercel for hosting and Supabase for data storage.',
  'nexcore'
),
(
  'How to Use NexCore Labs — Getting Started and Submitting a Project',
  'Quick start guide: (1) Visit the Hub at /hub.html to explore existing projects. (2) Click "Access the Core" in the menu and sign in with Google or create an account. (3) Go to your Account page and fill in your project details: title, description, category, tools used, and optional website URL. (4) Submit — your project will appear in the hub after admin moderation approval. Use the AI Assist feature on your project page to polish your description. The platform also supports exporting your project data and managing your account from the Account Settings page.',
  'nexcore'
),
(
  'NexCore Labs Hub — Exploring and Discovering Projects',
  'The NexCore Labs Hub (/hub.html) is the main project exploration center. It displays all published student projects with descriptions, categories, team info, and direct links to project pages. You can search and filter projects by category. Access the Hub via: the navigation menu (click the dots icon), the "Open Hub" button on the homepage, or directly at /hub.html. The hub shows featured projects, newest submissions, and supports AI-powered project discovery.',
  'nexcore'
),
(
  'NexCore Labs Roadmap and Planned Features',
  'Upcoming features on the NexCore roadmap include: direct student collaboration tools, project ratings and comments system, integration with SQU institutional systems, mobile app, advanced AI-powered project discovery and recommendations, team-based project submissions, analytics dashboard for project owners, and a notification system. Users can vote on and suggest features on the Feature Board at /roadmap.html. The platform is continuously updated based on community feedback. Recent updates are tracked on the Releases page at /releases.html.',
  'nexcore'
)

ON CONFLICT DO NOTHING;
