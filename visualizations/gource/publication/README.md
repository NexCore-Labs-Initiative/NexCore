# NexCore Labs publication edit

This directory defines the non-destructive publication pass over the archival Gource master. It does not regenerate Git activity and does not modify the NexCore Labs application.

## Source preservation

- Source: `visualizations/gource/output/nexcore-labs-development-history.mp4`
- Required source SHA-256: `5F22DAE9E74AE13D3F05EACCF6E836C2A4A0443F5AF62A6C7117493B845E8FEF`
- Brand asset: `assets/images/nexcore-word.webp` (used as supplied; scaled only)
- Official website: `https://nexcorelabs.vercel.app`
- Output: `visualizations/gource/output/nexcore-labs-development-history-publication.mp4`

The render script refuses to proceed if the source hash is different and verifies it again after rendering.

## Editorial timeline

`timeline.json` records every source interval, playback factor, output boundary, milestone caption, evidence basis, and intro/outro timing. Busy passages run at 82.5% speed; quiet passages run at 125%. Normal-speed bridge segments keep the changes restrained and avoid optical-flow artifacts around filenames and particles.

The final edit is approximately 140.5 seconds. Captions are independent three-second editorial overlays timed to the retimed publication timeline. v1.0 is supported by `CHANGELOG.md` but has no Git tag; all later displayed releases are backed by the corresponding repository tags and changelog entries.

`filter-complex.txt` is the exact FFmpeg filter graph. It provides:

- a 5.5-second restrained title reveal over the existing visualization;
- the existing NexCore Labs wordmark without redesign;
- ten milestone overlays with 300 ms fades and safe margins;
- a restrained full-width footer in the exact Gource background colour that suppresses conflicting archival captions and restores the original history label verbatim;
- the requested modest segment retiming;
- a closing card over the master's final frozen section;
- a final 500 ms fade to black.

## Audio

No licensed or owned soundtrack was found in the repository. The publication MP4 therefore contains a silent 48 kHz stereo AAC placeholder track, making it easy to replace in an editor without changing the video timeline.

Suggested soundtrack: instrumental modern technology/space ambience, subtle cinematic build, minimal percussion, no vocals, roughly 2:20.5 long. During music editing, retain 3–6 dB of mix headroom; for final web delivery, a practical target is about -16 LUFS integrated with peaks no higher than -1 dBTP.

## Regenerate

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\gource-nexcore-publication.ps1 -Mode Final
```

The script records the exact FFmpeg command and a JSON validation manifest beside the output, decodes the complete render, generates representative review frames under `publication/review/`, and preserves the archival source.

A quick full-timeline proof encode is also available:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\gource-nexcore-publication.ps1 -Mode Preview
```
