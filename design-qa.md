# NexCore Help Center Design QA

## Evidence

- Source visual truth: `C:\Users\aalza\AppData\Local\Temp\codex-clipboard-ea7a5c6c-c1bb-415b-9566-de1b27050735.png`
- English desktop implementation: `C:\Users\aalza\AppData\Local\Temp\nexcore-help-center-desktop-final2.png`
- Arabic desktop implementation: `C:\Users\aalza\AppData\Local\Temp\nexcore-help-center-ar-desktop-final3.png`
- English mobile implementation: `C:\Users\aalza\AppData\Local\Temp\nexcore-help-center-mobile-final.png`
- Desktop viewport: 1527 x 979 at device scale 1.
- Mobile viewport: 390 x 900 at device scale 1.
- State: Help Center landing page, search empty, topic sidebar visible, collection cards visible.

## Findings

- No actionable P0, P1, or P2 differences remain.
- Layout: the page now follows the reference support-center pattern with a light top utility bar, fixed-width topic rail, large serif search heading, compact search input, document-style article rows, and collection cards.
- Styling: the Help Center intentionally uses a warmer, lighter support surface instead of NexCore's dark marketing shell, matching the user's direction that it should feel different from the main site.
- Interaction: `Ctrl+K` and the top search button focus the search field; live search filters article rows and collection cards in English and Arabic.
- Responsive behavior: the mobile viewport has no horizontal overflow and converts the sidebar into horizontal topic chips while keeping the primary article list usable.
- RTL behavior: the Arabic page mirrors the support layout with the topic rail on the right, right-aligned content, Arabic copy, and working Arabic search keywords.

## Primary Interactions Tested

- English page load at `/help-center.html`.
- Arabic page load at `/ar/help-center.html`.
- English search query `pricing` returns the paid-service article and matching collection only.
- Arabic search query `التسعير` returns the paid-service article and matching collection.
- Desktop English, desktop Arabic, and mobile English all report zero horizontal overflow.
- Browser console checked during local visual inspection; no errors were observed.

## Follow-up Polish

- P3: The reference brand text is shorter, so NexCore's title naturally occupies more width. The implemented brand now stays on one line while preserving the support-site identity.

final result: passed
