# NexCore Labs Gource visualization

This folder contains the presentation preset and release captions for the NexCore Labs development-history video. Generated logs, previews, MP4 files, command records, and metadata stay under the ignored `cache/` and `output/` folders so they remain separate from production website assets.

The default render uses the canonical `origin/main` history. This avoids duplicating divergent branch activity or presenting unmerged work as part of the public release history.

## Regenerate

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\gource-nexcore.ps1 -Mode Preview
powershell -ExecutionPolicy Bypass -File .\scripts\gource-nexcore.ps1 -Mode Final
```

The final output is `visualizations/gource/output/nexcore-labs-development-history.mp4`. The script also writes the exact Gource-to-FFmpeg pipeline and machine-readable render metadata beside the MP4.

Use `-Ref HEAD` or another explicit Git ref only when you intentionally want that branch represented. The script always regenerates the custom Gource log from real commits and never reads uncommitted files.

## Tooling

The script resolves tools from `PATH`, then checks the common user-local locations used by the official Windows Gource archive and WinGet's FFmpeg package.

```powershell
winget install --id acaudwell.Gource --exact
winget install --id Gyan.FFmpeg.Essentials --exact --scope user
```

The video is a silent H.264 master (`yuv420p`, BT.709, fast-start enabled) so a licensed soundtrack or narration can be added later without re-running Gource.
