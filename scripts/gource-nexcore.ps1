[CmdletBinding()]
param(
    [ValidateSet("Preview", "Final", "LogOnly")]
    [string]$Mode = "Final",

    [string]$Ref = "origin/main",

    [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$visualizationRoot = Join-Path $repoRoot "visualizations\gource"
$configPath = Join-Path $visualizationRoot "nexcore.gource.conf"
$captionPath = Join-Path $visualizationRoot "captions.txt"
$cacheRoot = Join-Path $visualizationRoot "cache"
$outputRoot = Join-Path $visualizationRoot "output"

function Resolve-Gource {
    $command = Get-Command "gource" -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $portableRoot = Join-Path $env:LOCALAPPDATA "Programs\Gource"
    if (Test-Path -LiteralPath $portableRoot) {
        $portable = Get-ChildItem -LiteralPath $portableRoot -Filter "gource.exe" -File -Recurse |
            Sort-Object FullName -Descending |
            Select-Object -First 1
        if ($portable) {
            return $portable.FullName
        }
    }

    throw "Gource was not found. Install acaudwell.Gource with winget or unpack the official Windows build under %LOCALAPPDATA%\Programs\Gource."
}

function Resolve-FFmpeg {
    $command = Get-Command "ffmpeg" -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $wingetRoot = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
    if (Test-Path -LiteralPath $wingetRoot) {
        $winget = Get-ChildItem -LiteralPath $wingetRoot -Filter "ffmpeg.exe" -File -Recurse |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
        if ($winget) {
            return $winget.FullName
        }
    }

    throw "FFmpeg was not found. Install Gyan.FFmpeg.Essentials with winget."
}

function Quote-CmdArgument {
    param([Parameter(Mandatory)][string]$Value)
    return '"' + $Value.Replace('"', '\"') + '"'
}

if (-not (Test-Path -LiteralPath $configPath)) {
    throw "Missing Gource configuration: $configPath"
}

if (-not (Test-Path -LiteralPath $captionPath)) {
    throw "Missing Gource captions: $captionPath"
}

New-Item -ItemType Directory -Path $cacheRoot, $outputRoot -Force | Out-Null

$git = Get-Command "git" -ErrorAction Stop
$safeRepoRoot = $repoRoot.Replace("\", "/")
$gitPrefix = @("-c", "safe.directory=$safeRepoRoot", "-C", $repoRoot)
$refOutput = @(& $git.Source @gitPrefix rev-parse --verify "$Ref^{commit}" 2>&1)
$refExitCode = $LASTEXITCODE
$refCommit = $refOutput | Select-Object -First 1
if ($refExitCode -ne 0 -or -not $refCommit) {
    throw "Git ref '$Ref' could not be resolved to a commit."
}

$safeRefName = ($Ref -replace '[^A-Za-z0-9._-]', '-')
$logPath = Join-Path $cacheRoot "nexcore-$safeRefName.log"
$gourceExe = Resolve-Gource

Write-Host "Exporting the real Git history from $Ref ($refCommit)..."
& $gourceExe --git-branch $Ref --output-custom-log $logPath $repoRoot
if ($LASTEXITCODE -ne 0) {
    throw "Gource could not export the Git history (exit code $LASTEXITCODE)."
}

$logLines = @(Get-Content -LiteralPath $logPath)
if ($logLines.Count -eq 0) {
    throw "The exported Gource log is empty."
}

Write-Host "Exported $($logLines.Count) file events to $logPath"
if ($Mode -eq "LogOnly") {
    return
}

$ffmpegExe = Resolve-FFmpeg
$ffprobeExe = Join-Path (Split-Path -Parent $ffmpegExe) "ffprobe.exe"
if (-not (Test-Path -LiteralPath $ffprobeExe)) {
    throw "ffprobe.exe was not found beside FFmpeg at $ffprobeExe"
}

$isPreview = $Mode -eq "Preview"
$width = if ($isPreview) { 1280 } else { 1920 }
$height = if ($isPreview) { 720 } else { 1080 }
$fps = if ($isPreview) { 30 } else { 60 }

if (-not $OutputPath) {
    $fileName = if ($isPreview) {
        "nexcore-labs-development-history-preview.mp4"
    } else {
        "nexcore-labs-development-history.mp4"
    }
    $OutputPath = Join-Path $outputRoot $fileName
}

$OutputPath = [IO.Path]::GetFullPath($OutputPath)
if ([IO.Path]::GetExtension($OutputPath) -ne ".mp4") {
    throw "OutputPath must end in .mp4."
}
New-Item -ItemType Directory -Path (Split-Path -Parent $OutputPath) -Force | Out-Null

$gourceArguments = @(
    "--load-config", $configPath,
    "-$($width)x$height",
    "--caption-file", $captionPath,
    "--output-framerate", $fps,
    "--output-ppm-stream", "-",
    $logPath
)

$ffmpegArguments = @(
    "-y",
    "-loglevel", "warning",
    "-framerate", $fps,
    "-f", "image2pipe",
    "-vcodec", "ppm",
    "-i", "-",
    "-an",
    "-c:v", "libx264",
    "-preset", $(if ($isPreview) { "veryfast" } else { "slow" }),
    "-tune", "animation",
    "-crf", $(if ($isPreview) { "23" } else { "18" }),
    "-profile:v", "high",
    "-level:v", "4.2",
    "-pix_fmt", "yuv420p",
    "-colorspace", "bt709",
    "-color_primaries", "bt709",
    "-color_trc", "bt709",
    "-g", ($fps * 2),
    "-movflags", "+faststart",
    $OutputPath
)

$gourceCommand = (Quote-CmdArgument $gourceExe) + " " + (($gourceArguments | ForEach-Object { Quote-CmdArgument ([string]$_) }) -join " ")
$ffmpegCommand = (Quote-CmdArgument $ffmpegExe) + " " + (($ffmpegArguments | ForEach-Object { Quote-CmdArgument ([string]$_) }) -join " ")
$pipelineCommand = "$gourceCommand | $ffmpegCommand"

$commandPath = [IO.Path]::ChangeExtension($OutputPath, ".command.txt")
$metadataPath = [IO.Path]::ChangeExtension($OutputPath, ".metadata.json")
Set-Content -LiteralPath $commandPath -Value $pipelineCommand -Encoding UTF8

Write-Host "Rendering $Mode master at ${width}x${height}, ${fps} fps..."
Write-Host "Exact pipeline:"
Write-Host $pipelineCommand

& $env:ComSpec /d /s /c $pipelineCommand
if ($LASTEXITCODE -ne 0) {
    throw "The Gource/FFmpeg render failed (exit code $LASTEXITCODE)."
}

$probeJson = & $ffprobeExe -v error -show_entries "format=duration,size,bit_rate" -show_entries "stream=codec_name,width,height,r_frame_rate,pix_fmt" -of json $OutputPath
if ($LASTEXITCODE -ne 0) {
    throw "ffprobe could not validate the rendered MP4."
}
$probe = $probeJson | ConvertFrom-Json

$firstParts = $logLines[0] -split '\|', 5
$lastParts = $logLines[-1] -split '\|', 5
$metadata = [ordered]@{
    generatedAt = (Get-Date).ToString("o")
    repository = $repoRoot
    gitRef = $Ref
    gitCommit = [string]$refCommit
    gourceLog = $logPath
    gourceEvents = $logLines.Count
    firstEventUtc = [DateTimeOffset]::FromUnixTimeSeconds([int64]$firstParts[0]).ToString("o")
    lastEventUtc = [DateTimeOffset]::FromUnixTimeSeconds([int64]$lastParts[0]).ToString("o")
    mode = $Mode
    output = $OutputPath
    command = $pipelineCommand
    probe = $probe
}
$metadata | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $metadataPath -Encoding UTF8

Write-Host "Render complete: $OutputPath"
Write-Host "Command record: $commandPath"
Write-Host "Render metadata: $metadataPath"
