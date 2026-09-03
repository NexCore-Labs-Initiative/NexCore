alter table public.docs_feedback_responses
  drop constraint if exists docs_feedback_responses_page_key_check;

alter table public.docs_feedback_responses
  add constraint docs_feedback_responses_page_key_check
  check (page_key in ('how-to-use', 'faq'));
