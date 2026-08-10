# Living Release Beacon Design QA

## Evidence

- Source visual truth: `C:\Users\aalza\.codex\generated_images\019fea67-e67b-7531-94f4-e89dc851c405\exec-317af607-dc11-476f-b8f1-4fb8ddd4277c.png`
- Desktop implementation: `C:\Users\aalza\AppData\Local\Temp\nexcore-release-beacon-desktop-open.png`
- Arabic implementation: `C:\Users\aalza\AppData\Local\Temp\nexcore-release-beacon-arabic-final.png`
- Mobile implementation: `C:\Users\aalza\AppData\Local\Temp\nexcore-release-beacon-mobile-final.png`
- Full-view comparison: `C:\Users\aalza\AppData\Local\Temp\nexcore-release-beacon-comparison.png`
- Focused component comparison: `C:\Users\aalza\AppData\Local\Temp\nexcore-release-beacon-focused-comparison.png`
- Desktop viewport and CSS size: 1280 x 720 at device scale 1.
- Mobile viewport and CSS size: 320 x 700 at device scale 1.
- Source pixels: 1672 x 941, normalized to 1280 x 720 for the full-view comparison.
- Implementation pixels: 1280 x 720 for the desktop comparison.
- State: first promoted release, popover open, dark theme, signed-out visitor.

## Findings

- No actionable P0, P1, or P2 differences remain.
- Fonts and typography: Inter/Tajawal, weights, line heights, hierarchy, and wrapping retain the source's compact dark-product character. Live visitor copy is intentionally more specific than the concept copy.
- Spacing and layout rhythm: the beacon remains adjacent to the wordmark and the popover keeps the selected compact width, padding, separators, CTA hierarchy, radii, and restrained elevation.
- Colors and visual tokens: the implementation uses NexCore's existing navy, cyan, muted-text, border, and glass tokens with sufficient contrast.
- Image and icon fidelity: no new raster artwork is required. Existing branding is preserved and the selected UI symbols use the site's existing Font Awesome library rather than custom drawings.
- Copy and content: version, title, benefit, three highlights, CTA, close, and dismiss states are complete in English and Arabic.
- Responsive and accessibility: the 320px state stays within the viewport, Arabic remains within the desktop viewport, keyboard focus returns to the beacon, and reduced motion removes pulse/reveal animation.

## Comparison History

1. Initial comparison found two P2 issues: the Arabic panel opened beyond the left viewport edge, and the mobile pulse crowded the `Labs` wordmark.
2. The RTL anchor was corrected to the physical left side of the header beacon, the small-screen wordmark and beacon dimensions were tightened, and the mobile pulse radius was reduced.
3. Post-fix screenshots confirm that English desktop, Arabic desktop, and 320px mobile states are contained and retain the selected hierarchy. Focused comparison confirms the popover proportions, typography, divider, highlights, CTA, and dismiss treatment.

## Primary Interactions Tested

- Automatic first open without focus theft.
- Close, outside click, Escape, and beacon reopen.
- Persistent dismiss and explore behavior.
- A later promoted release appears despite an older dismissed version.
- English/Arabic release anchors and excluded private/release routes.
- Browser console checked during local visual inspection; no beacon-related errors were observed.

## Follow-up Polish

- P3: The implementation uses uniform check icons for the three highlights while the concept used three different category icons. This keeps future announcement content editorially flexible and visually quieter.

final result: passed
