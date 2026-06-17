# Changelog

## v3.0.0 - 16 June 2026

### The Multilingual Intelligence Breakthrough

A major bilingual launch for NexCore Labs with full Arabic localization, NexCore Intelligence, stronger international SEO, new subscription touchpoints, and cleaner platform foundations.

#### New Features

- Launched a complete **Arabic experience** under `/ar/`, covering the homepage, hub, dashboard, project pages, account flows, legal pages, pricing pages, releases, and support content.
- Rebranded AI Chat into **NexCore Intelligence (NCI)** with a dedicated `intelligence.html` experience and refreshed navigation across English and Arabic pages.
- Added a new **newsletter subscription** flow powered by Supabase, including unsubscribe support and Arabic unsubscribe coverage.
- Added one-click **Bookmark** support in the contact area with mobile-aware behavior for easier return visits.
- Added **Generate Project Card** on project pages so visitors can preview a polished project card and download it as a PDF.

#### Improvements

- Improved international SEO with `hreflang` coverage, localized metadata, Arabic social previews, and clean English/Arabic route rewrites.
- Refined Arabic UI direction, typography, logo alignment, line-height, and language switching for a smoother bilingual experience.
- Updated Arabic hub project cards with localized category chips and links that keep visitors inside the Arabic project experience.
- Updated the official contact surface with the NexCore Labs phone number and refreshed team information.
- Refreshed the NexCore Labs brand design with an enhanced Core mark, updated wordmark assets, and a dedicated app icon for installable experiences.
- Replaced separate authenticated menu rows with a compact `navUser` toolbar that keeps the avatar/name beside Dashboard, Admin, Account, and Logout icons.
- Improved the dropdown menu by replacing the Hub icon with static Core dots and moving the premium-styled NexCore Intelligence link between Access the Core and search.

#### Fixes

- Expanded service-worker precaching and clean-route support so localized pages and release assets are available more reliably after deployment.
- Fixed contact form submissions so successful messages redirect to NexCore's own **Thanks** pages instead of the hosted Web3Forms success URL.
- Removed the experimental release automation layer so release content can be maintained manually while the workflow is redesigned later.

### Developer Notes

#### Technical Changes

- Created the localized Arabic page set and aligned route handling, metadata, navigation, and shared runtime-generated UI across English and Arabic.
- Updated NexCore Intelligence backend and frontend paths, including Gemini Flash configuration and the renamed intelligence route.
- Bumped website version surfaces to `v3.0.0`, including package metadata, runtime version, release asset query strings, and the pre-publish service-worker cache version.
- Updated the PWA manifest and service-worker precache list so the enhanced brand icon set is used by installed apps and cached clients.
- Added a localized project-card export module that builds the preview card client-side and lazily loads PDF capture libraries only when users request a download.
- Centralized authenticated navigation in the shared auth UI generator with stable action IDs and CSS coverage for both production and readable style bundles.

#### Database Changes

- Added newsletter subscription handling backed by Supabase while keeping unsubscribe flows available for localized users.

#### API Updates

- Updated AI API behavior around the Gemini Flash model path and retained model discovery support through the models endpoint.

#### Internal Improvements

- Enabled Dependabot and refreshed npm package versions for stronger maintenance and security hygiene.
- Removed release automation workflows and scripts so the codebase stays simpler while a future release process is reconsidered.

---

## v2.9.1 - 25 May 2026

### Control Panel and Payments

Admin panel refinements, payment workflow enhancements, and SQU community support.

#### New Features

- New **Proof of Payment review modal** with iframe preview for admins to verify, approve, or reject receipts directly in the platform.
- New **Free Access notification** for SQU email domain users during email validation to welcome the university community.

#### Improvements

- **Admin Control Panel** completely revamped with modernized stat cards, improved responsiveness, and a new quick search input.
- **Modal system** re-engineered with smoother transitions, enhanced confirmation flow, and trigger-based animations.
- Subscription filtering now handles `pending_verification` states; order approval process returns detailed success statuses.
- PayPal integration updated with detailed **fee calculation** function showing exact expected USD amounts.
- **Pricing page** enhanced with animated price updates, detailed fee breakdown, and improved badge responsiveness.
- Global navigation now includes the Pricing page with a dedicated badge for better visibility.
- **Copy Bill ID** functionality improved with better user feedback and status messages.

#### Fixes

- Corrected critical UI bug where "Delete" and "Cancel" button actions were swapped in the project deletion modal.
- Removed WhatsApp payment integration in favor of more streamlined support contact information.
- Standardized stylesheet links across `index.html` and `pricing.html` to ensure unified visual experience.

### Developer Notes

#### Technical Changes

- Control Panel UI completely refactored with modernized stat cards and responsive design improvements.
- Modal system re-engineered with `is-open/is-closing` states and enhanced trigger-based animations.
- Receipt exports now include status messages and automatic PDF downloads for verified receipts.
- Stylesheet standardization applied across multiple pages for consistent visual experience.

#### API Updates

- Implemented detailed **PayPal fee calculation** function for accurate USD amount display.
- Updated subscription filtering logic to handle `pending_verification` states.
- Enhanced order approval process to return detailed success statuses.

#### Internal Improvements

- Updated `nodemailer` dependency to version 8.0.8.
- Updated `package.json` to reflect version 2.9.1.
- Updated PayPal support links to the new NexCore Labs PayPal account.

---

## v2.9.0 - 9 May 2026

### Subscriptions and Monetization

Monetization framework, AI upgrades, and UX enhancements.

#### New Features

- New **Pricing page** with tiered subscription plans, beta banners, and a billing FAQ category.
- New **Order Confirmation page** with professional print styles and signed receipt URLs.
- Animated **menu hint** for first-time visitors to improve platform discoverability.

#### Improvements

- AI endpoint now supports both chat and assist modes more robustly.
- Priority Review feature dynamically locks/unlocks based on your selected payment method.
- Simplified sign-in flow — streamlined email validation without OTP or organisation detection.
- Updated metadata across multiple pages for better SEO and platform inclusivity.

#### Fixes

- Improved user removal process and permission error handling in the admin panel.
- GA4 User-ID tracking integrated for accurate cross-device analytics.

### Developer Notes

#### Technical Changes

- New `pricing.html` with tiered plan UI and billing FAQ category.
- New `order-confirmation.html` with print-friendly receipt styles.
- Project QR code removed.

#### Database Changes

- Removed `admin_activity_log` schema from the database directory.

#### API Updates

- New `api/paypal-capture.js` — PayPal order capture with automated email confirmation.
- New `api/bank-transfer.js` — bank transfer endpoint with reference instructions.
- New `api/submit-subscription.js` — subscription order submission with duplicate order checks.
- New `api/receipt-url.js` — server-side signed receipt URL generation.
- Enhanced `api/ai.js` to support both chat and assist functionalities.

#### Internal Improvements

- GA4 User-ID tracking integrated for cross-device behaviour analysis.
- Admin panel permission error handling improvements.

---

## v2.8.0 - 18 April 2026

### Arabic, Administration, and Embeds

Arabic/RTL support, admin panel, project embed system, and AI assistant refinements.

#### New Features

- Full **Arabic language support** with RTL layout, proper typography, and directional styling across all pages.
- New **Embed System** — generate a code snippet directly from any project page to display it on an external website.
- New **Admin Panel** for managing platform users, access control, and system settings.

#### Improvements

- AI assistant now responds more naturally and accurately in Arabic.
- AI responses are better formatted and more concise with an improved word-limit policy.
- Sign-in call-to-actions and modals added for AI features to guide new users through onboarding.

#### Fixes

- Corrected service worker precache references that could cause stale asset loads.
- Updated PayPal link titles for consistent accessibility labeling.
- Improved error logging for email authorization checks to make debugging easier.

### Developer Notes

#### Technical Changes

- Added `assets/css/arabic.css` with Tajawal font and RTL overrides applied site-wide.
- New `embed.html` page with embed code generation, customization options, and live preview.
- New `admin-users.html` interface for user and permission management.
- Database-driven Approved Users whitelist controls access to specific platform features.

#### Database Changes

- Added `admin_activity_log` table to audit all administrative actions.
- Approved Users system persisted in the database for reliable access control.

#### Internal Improvements

- Removed obsolete `ai_knowledge_cleanup.sql` and outdated documentation files.
- Added deployment checklist and approved-users implementation guide.

---

## v2.7.0 - 11 April 2026

### RAG AI Assistant

RAG-powered AI chat, floating assistant access, usage tracking, and broader interface polish.

#### New Features

- Launched a new **AI chat assistant** with context-aware answers powered by project knowledge.
- Added a dedicated **AI Chat** page and a floating chat widget for faster access across the site.
- Conversations now persist during a session, so your chat context stays available while you browse.

#### Improvements

- Introduced daily AI usage indicators with remaining quota shown directly in the chat experience.
- Added AI usage visibility inside the account section with clearer section styling and icons.
- Refined floating action button placement, menu spacing, and responsive breakpoints for a cleaner mobile layout.
- Replaced older moderation popups with smoother toast notifications for faster feedback.

#### Fixes

- Improved delete confirmation behavior with clearer prompts and more reliable confirmation logic.
- Strengthened AI error handling so retry flows and quota-exhausted states provide better guidance.

### Developer Notes

#### Technical Changes

- Added `api/ai-chat.js` with Supabase authentication and Gemini 2.5 integration for the new assistant flow.
- Introduced `scripts/seed-knowledge.js` to manage embeddings for the RAG knowledge base.
- Incremented the `service-worker.js` cache version to `v2.7.0` for cleaner asset updates.
- Added `vercel.json` URL rewrites to support cleaner route paths.

#### Internal Improvements

- Session storage now keeps chat history available through the active browser session.
- Account settings labels and confirmation copy were refreshed for better clarity and consistency.

---

## v2.6.0 - 19 March 2026

### Roadmap and Feature Requests

Feature voting roadmap launch, guest suggestion flow, and global UX refinements across core pages.

#### New Features

- Launched the new **Feature Requests & Roadmap** board (`roadmap.html`) to suggest ideas and track implementation progress.
- Added **anonymous suggestion submission** and **guest voting** flows.
- Introduced admin review workflows for pending suggestions and inline comment moderation.

#### Improvements

- Global styling refactor with new `assets/css/style.css` and cleaner nav links across core pages.
- Smoother expand/collapse interactions in FAQ and Releases sections.
- Modal interactions refreshed with blur effects and more polished transitions.
- Navigation menus upgraded with Font Awesome visual cues.

#### Fixes

- Fixed suggestion deletion so it is applied in Supabase (no more delete-only-in-UI behavior after refresh).
- Fixed unstable delete flows that could get stuck, with confirmation modals now closing automatically after successful actions.
- Resolved comment-edit save issues by removing the unstable edit-comment path and keeping the comment flow stable.
- Authentication flow simplified to a dedicated login-only page.

### Developer Notes

#### Technical Changes

- Integrated Vercel Speed Insights and standardized analytics placement across HTML pages.
- Initialized release history data in `assets/data/releases.json`.
- Updated `service-worker.js` cache strategy and precache manifest to avoid stale or missing asset cache entries.
- Added `vercel` package dependency and consolidated UI scripting in core pages.

#### Internal Improvements

- Accessibility polish: added PayPal link titles and normalized analytics snippet placement.
- Cleaned up blank-line noise in account settings files to keep diffs focused.

---

## v2.5.0 - 14 March 2026

### Interface and Performance Refresh

Major UI refresh, releases hub, and performance polish across the platform.

#### New Features

- Brand-new dark theme applied to the Hub and homepage.
- Project details upgraded with stats, social links, QR codes, and creator profiles.
- Dedicated Releases page for tracking platform history.

#### Improvements

- Category chips and filters with richer styling across the explorer experience.
- Polished project category badges and detail layouts for better readability.
- Faster page loads via minified core CSS and JS assets.

#### Fixes

- Removed stray BOM characters and fixed string interpolation glitches.
- Icon updates across the Releases page for consistent visual language.

### Developer Notes

#### Technical Changes

- Custom-styled version dropdown replacing the native select.
- New cookie consent manager and authentication UI components.
- Added `rel="noopener"` on external links for improved security.

#### Internal Improvements

- Added Apple Touch icon and social meta tags for richer sharing.
- Core JS bootstrapping and layout styling refreshed across the site.

---

## v2.4.1 - 7 March 2026

### Stability Update

Fixing known problems and updating the service worker.

#### Fixes

- Fixed known issues reported in the latest release.

### Developer Notes

#### Technical Changes

- Updated `service-worker.js` for better caching stability.

---

## v2.4.0 - 7 March 2026

### Categories and Contact Information

Project categories, contact information, and 16 color-coded category types with hub filtering.

#### New Features

- **Contact Information section** in account settings — set a public email and phone number displayed on your project page.
- **16 project categories** with color-coded badges: Technology, Business, Education, Finance, Healthcare, Environment, and more.
- **Category filtering** on the Hub — browse all published projects by type in one tap.
- **Category stats** section at the bottom of the Hub showing project counts per category.

#### Improvements

- Enhanced tooltip styling with blur effect and shadow for better readability.
- Consistent input field colours and borders across the whole site.
- Task counter on the homepage bumped from 120+ to 360+.
- Data export now includes your contact email and phone number.
- Cleaned up footer links across multiple pages.

### Developer Notes

#### Technical Changes

- New `project-categories.js` module — normalisation, slug aliases, badge rendering, SVG icon map for all 16 categories.
- New `assets/css/project-categories.css` with CSS variables per category and badge component styles.
- Dropdown functionality extracted into reusable `initPortalSelect()` — panels portalled to `document.body` to eliminate z-index stacking issues.
- Cookie icons converted from emoji to inline SVG for consistent cross-platform rendering.

#### Database Changes

- Added `contact_email` and `phone_number` columns to the `users` table.
- Projects now carry a `category` field with normalisation and legacy alias support.

#### Internal Improvements

- Updated `version.js` to `v2.4.0`.
- Added `sql/` to `.gitignore`.
- Removed legacy `cookie-consent.css` — fully migrated to Cookie Manager v2.

---

## v2.3.0 - 7 March 2026

### Creator Profiles and Project Insights

User profiles, AI project insights, creator sections on project pages, QR downloads, and view counters.

#### New Features

- Your display name (full name, username, or email prefix) shown everywhere instead of the raw email address.
- Project pages now feature a **Creator section** with your avatar, name, and public contact links.
- **AI Project Insights** — generate a smart summary on any project page with one click.
- QR codes can now be **downloaded as PNG** directly from project pages.
- View count and creation date badges added to every project page.
- Social sharing buttons for X, LinkedIn, and WhatsApp on all project pages.

#### Improvements

- Navbar now shows your avatar and display name when signed in.
- Project cards on the Hub redesigned with creation date and view count metadata.
- Hub now loads newest projects first (descending order).

### Developer Notes

#### Technical Changes

- Added `getUserDisplayName()` and `getUserAvatar()` helpers across all pages.
- New `project_insights` action in `/api/ai` — returns `{ summary, insights[] }`.
- Owner-check in `project.html` tightened with `.eq('owner_user_id', session.user.id)`.

#### Database Changes

- Added `creator_name` and `creator_avatar_url` to the `projects` table.
- Auto-backfill logic for legacy projects missing creator metadata on next dashboard load.
- User profile sync on login now stores avatar URL in the `users` table.

---

## v2.2.0 - 6 March 2026

### Consent and Moderation

Cookie Consent v2 rollout, moderation UI in dashboard, improved modals, and AI loading animations.

#### Improvements

- Upgraded to **Cookie Consent Manager v2** — granular control over analytics, external media, and AI cookies with a polished modal.
- Redesigned **Delete Account** modal — animated, accessible, with proper focus trapping and ARIA attributes.
- New **Delete Project** confirmation modal — replaces browser `confirm()` dialogs site-wide.
- Dashboard now displays your project's **moderation status** via a colour-coded badge with a reason popup on tap.
- AI generate buttons animate with a shimmer sweep and burst sparkles while loading.
- Footer updated with proper PayPal logo across all pages.

#### Fixes

- Fixed z-index issue with AI style dropdown — panel now portals to `document.body`.
- Removed stale "BETA" badges from account, dashboard, and hub headings.

### Developer Notes

#### Technical Changes

- New `api/moderate-project.js` — rule-based + Gemini-powered moderation, optional `moderation_logs` table, controls publish state.
- `GET /api/ai?usage=1` added — fetch quota stats without consuming an action.
- Cookie HTML removed from all page bodies; injected by `cookies.js` (v2) with granular categories, focus trap, and a11y.

#### Database Changes

- Added `moderation_status`, `moderation_reason`, `last_moderated_at` to `projects`.
- Created `moderation_logs` table for full audit trail of all moderation decisions.

---

## v2.1.0 - 1 March 2026

### AI Assist

AI Assist launched — enhance descriptions, generate card briefs, with 3-action daily limits.

#### New Features

- **AI Assist** in the dashboard — rewrite your page description in Professional, Shorter, Technical, or Inspiring tone.
- **AI Card Brief** generator — derive a concise hub card description from your full page description in one click.
- AI actions are **limited to 3 per day** — your remaining count is always visible in the dashboard.
- **Copy Page Link** button added to the dashboard for instant sharing.
- Slug preview updates live as you type the project name.

### Developer Notes

#### Database Changes

- New `ai_usage` table for per-user daily tracking with RLS.
- RPC `consume_ai_use(max_uses)` — atomic daily limit enforcement.
- RPC `get_ai_usage(max_uses)` — returns used/remaining counts.
- Separate `card_description` and `page_description` fields added to `projects` table.

#### API Updates

- New `api/ai.js` — Google Gemini via `@google/genai`, Bearer JWT required, enforces 3-per-day limit via Supabase RPC.
- Supported actions: `improve_page`, `card_summary`, `project_insights`.
- Debug endpoint `api/models.js` for listing available Gemini models (temporary).

#### Internal Improvements

- Added `@google/genai ^1.43.0` to `package.json`.
- Gemini model configurable via `GEMINI_MODEL` env var (default: `models/gemini-2.5-flash`).

---

## v2.0.0 - 10 February 2026

### Platform Graduation

Complete platform rebuild — Supabase auth, user dashboards, project management, dynamic hub.

#### New Features

- Sign in with your **SQU Google account** — no password, no friction.
- New **Dashboard** — create, edit, and publish your project in minutes.
- New **Account Settings** — view your profile, export data, delete your account.
- Projects get **dedicated public pages** with QR codes and social sharing.
- Hub now loads projects **live from the database** — always up-to-date.
- Per-project page visit analytics tracking.
- Trustpilot review widget integrated on the hub.

### Developer Notes

#### Technical Changes

- Integrated `@supabase/supabase-js` for full backend, auth, and database.
- New `assets/js/supabase-client.js` — shared client initialisation across all pages.
- New `assets/js/auth-ui-db.js` — global auth state, navbar injection, avatar support.
- Serverless functions: `api/track-visit.js`, `api/delete-account.js`.
- New `lib/supabaseAdmin.js` for service-role server-side operations.

#### Database Changes

- Migrated from static `data/projects.json` to a live Supabase `projects` table.
- Created `users`, `projects`, `page_visits_daily` tables.
- Row Level Security (RLS) enabled on all user-facing tables.

---

## v1.2.0 - 3 February 2026

### Offline and Privacy

Service Worker rewrite, cookie consent, offline support, and UI polish across all pages.

#### Improvements

- Added **offline support** — previously visited pages remain accessible without internet.
- Introduced the **cookie consent** banner — analytics only load with your explicit permission.
- Leader image replaced with an optimised **WebP photo**.
- Meta tags updated site-wide for better social sharing previews on all platforms.
- Oman badge added and navigation order improved for a more natural flow.

#### Fixes

- Fixed broken image paths in the Service Worker precache list.
- Hardened signup form validation against incomplete or malformed submissions.

### Developer Notes

#### Technical Changes

- Full rewrite of `service-worker.js` — precaching, stale-while-revalidate runtime strategy, navigation preload, and `offline.html` fallback.
- Image cache capped at 60 entries with LRU eviction via recursive `trimCache()`.
- Backdrop blur values reduced for improved performance on low-end devices.
- Full documentation suite added: implementation notes, quick reference, delivery summary, completion checklist.

---

## v1.1.0 - 1 November 2025

### Performance Foundations

Image compression to WebP, a new research page, UI polish, and Git version control introduced.

#### Improvements

- All images compressed and converted to **WebP** — pages load noticeably faster.
- New **research page** added for academic content.
- General UI improvements and visual polish throughout.

### Developer Notes

#### Internal Improvements

- Began using **Git VCS** — all changes tracked from this release onward.
- WebP image compression pipeline established.
- Deleted broken legacy file `mobile-preview.html`.

---

## v1.0.0 - 27 October 2025

### Initial Launch

NexCore Labs went live — the very first version of the platform.

#### New Features

- NexCore Labs website live at **nexcorelabs.vercel.app**.
- Homepage with hero, about, tools, team, and contact sections.
- Project Hub with static project card listings.
- PWA support — installable on mobile and desktop with offline caching.

### Developer Notes

#### Technical Changes

- Pure HTML5 / CSS3 / vanilla JS — zero frameworks, zero dependencies.
- Custom CSS design system with `--dark-base`, `--primary-accent`, glass card components.
- Service Worker with basic precaching strategy.
- Google Analytics 4 with IP anonymisation.
- OpenGraph and Twitter Card meta tags site-wide for rich previews.
- Deployed on Vercel with automatic GitHub CI/CD integration.

---
