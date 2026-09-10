[CmdletBinding()]
param(
    [ValidateSet("Preview", "Final")]
    [string]$Mode = "Final",

    [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$gourceRoot = Join-Path $repoRoot "visualizations\gource"
$publicationRoot = Join-Path $gourceRoot "publication"
$outputRoot = Join-Path $gourceRoot "output"
$reviewRoot = Join-Path $publicationRoot "review"
$masterPath = Join-Path $outputRoot "nexcore-labs-development-history.mp4"
$logoPath = Join-Path $repoRoot "assets\images\nexcore-word.webp"
$filterPath = Join-Path $publicationRoot "filter-complex.txt"
$timelinePath = Join-Path $publicationRoot "timeline.json"
$requiredMasterHash = "5F22DAE9E74AE13D3F05EACCF6E836C2A4A0443F5AF62A6C7117493B845E8FEF"

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

function Quote-PowerShellArgument {
    param([Parameter(Mandatory)][string]$Value)
    return "'" + $Value.Replace("'", "''") + "'"
}

foreach ($requiredPath in @($masterPath, $logoPath, $filterPath, $timelinePath)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Missing required publication asset: $requiredPath"
    }
}

$masterHashBefore = (Get-FileHash -LiteralPath $masterPath -Algorithm SHA256).Hash
if ($masterHashBefore -ne $requiredMasterHash) {
    throw "The archival master hash is $masterHashBefore, not the required $requiredMasterHash. The publication render was stopped."
}

$timeline = Get-Content -LiteralPath $timelinePath -Raw | ConvertFrom-Json
if ($timeline.source.sha256 -ne $requiredMasterHash) {
    throw "timeline.json does not identify the required archival master."
}

$ffmpegExe = Resolve-FFmpeg
$ffprobeExe = Join-Path (Split-Path -Parent $ffmpegExe) "ffprobe.exe"
if (-not (Test-Path -LiteralPath $ffprobeExe)) {
    throw "ffprobe.exe was not found beside FFmpeg at $ffprobeExe"
}

New-Item -ItemType Directory -Path $outputRoot, $reviewRoot -Force | Out-Null

$isPreview = $Mode -eq "Preview"
if (-not $OutputPath) {
    $fileName = if ($isPreview) {
        "nexcore-labs-development-history-publication-preview.mp4"
    } else {
        "nexcore-labs-development-history-publication.mp4"
    }
    $OutputPath = Join-Path $outputRoot $fileName
}

$OutputPath = [IO.Path]::GetFullPath($OutputPath)
if ([IO.Path]::GetExtension($OutputPath) -ne ".mp4") {
    throw "OutputPath must end in .mp4."
}
if ($OutputPath -eq [IO.Path]::GetFullPath($masterPath)) {
    throw "The publication output cannot overwrite the archival master."
}
New-Item -ItemType Directory -Path (Split-Path -Parent $OutputPath) -Force | Out-Null

$ffmpegArguments = @(
    "-y",
    "-hide_banner",
    "-loglevel", $(if ($isPreview) { "warning" } else { "info" }),
    "-i", $masterPath,
    "-loop", "1",
    "-framerate", "60",
    "-i", $logoPath,
    "-f", "lavfi",
    "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
    "-/filter_complex", $filterPath,
    "-map", "[vout]",
    "-map", "2:a:0",
    "-c:v", "libx264",
    "-preset", $(if ($isPreview) { "veryfast" } else { "slow" }),
    "-tune", "animation",
    "-crf", $(if ($isPreview) { "27" } else { "16" }),
    "-profile:v", "high",
    "-level:v", "4.2",
    "-pix_fmt", "yuv420p",
    "-colorspace", "bt709",
    "-color_primaries", "bt709",
    "-color_trc", "bt709",
    "-r", "60",
    "-g", "120",
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "48000",
    "-ac", "2",
    "-max_muxing_queue_size", "4096",
    "-movflags", "+faststart",
    "-shortest",
    $OutputPath
)

$commandPath = [IO.Path]::ChangeExtension($OutputPath, ".command.txt")
$metadataPath = [IO.Path]::ChangeExtension($OutputPath, ".metadata.json")
$exactCommand = "& " + (Quote-PowerShellArgument $ffmpegExe) + " " + (($ffmpegArguments | ForEach-Object { Quote-PowerShellArgument ([string]$_) }) -join " ")
Set-Content -LiteralPath $commandPath -Value $exactCommand -Encoding UTF8

Write-Host "Archival master verified: $masterHashBefore"
Write-Host "Rendering the $Mode publication edit to $OutputPath"
Write-Host "Exact FFmpeg command recorded at $commandPath"

Push-Location $repoRoot
try {
    & $ffmpegExe @ffmpegArguments
    if ($LASTEXITCODE -ne 0) {
        throw "The publication render failed (exit code $LASTEXITCODE)."
    }
}
finally {
    Pop-Location
}

$masterHashAfter = (Get-FileHash -LiteralPath $masterPath -Algorithm SHA256).Hash
if ($masterHashAfter -ne $requiredMasterHash) {
    throw "The archival master changed during rendering. Expected $requiredMasterHash; found $masterHashAfter."
}

$probeJson = & $ffprobeExe -v error -show_entries "format=duration,size,bit_rate" -show_entries "stream=index,codec_type,codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,channels" -of json $OutputPath
if ($LASTEXITCODE -ne 0) {
    throw "ffprobe could not validate the publication MP4."
}
$probe = $probeJson | ConvertFrom-Json
$videoStream = $probe.streams | Where-Object { $_.codec_type -eq "video" } | Select-Object -First 1
$audioStream = $probe.streams | Where-Object { $_.codec_type -eq "audio" } | Select-Object -First 1
if ($videoStream.width -ne 1920 -or $videoStream.height -ne 1080 -or $videoStream.r_frame_rate -ne "60/1") {
    throw "Unexpected publication video format: $($videoStream.width)x$($videoStream.height) at $($videoStream.r_frame_rate)."
}
if (-not $audioStream -or $audioStream.sample_rate -ne "48000" -or $audioStream.channels -ne 2) {
    throw "The silent 48 kHz stereo placeholder track is missing or malformed."
}

Write-Host "Decoding the complete publication MP4..."
& $ffmpegExe -v error -i $OutputPath -map 0 -f null NUL
if ($LASTEXITCODE -ne 0) {
    throw "Full-file decode validation failed (exit code $LASTEXITCODE)."
}

$frameTimes = @(1.5, 4.8, 15.6, 35.5, 57.0, 72.5, 96.5, 102.5, 110.0, 115.2, 129.7, 136.8, 139.2)
$outputStem = [IO.Path]::GetFileNameWithoutExtension($OutputPath)
foreach ($frameTime in $frameTimes) {
    $frameName = "{0}-t{1:000.000}.png" -f $outputStem, $frameTime
    $framePath = Join-Path $reviewRoot $frameName
    & $ffmpegExe -v error -ss ([string]::Format([Globalization.CultureInfo]::InvariantCulture, "{0:0.000}", $frameTime)) -i $OutputPath -frames:v 1 -update 1 -y $framePath
    if ($LASTEXITCODE -ne 0) {
        throw "Frame extraction failed at $frameTime seconds."
    }
}

$blackDetectPath = [IO.Path]::ChangeExtension($OutputPath, ".blackdetect.txt")
$previousErrorActionPreference = $ErrorActionPreference
try {
    # Windows PowerShell can surface FFmpeg's normal stderr diagnostics as
    # NativeCommandError while redirecting them. Capture them without turning
    # a successful scan into a terminating PowerShell error.
    $ErrorActionPreference = "Continue"
    $blackDetectOutput = @(& $ffmpegExe -hide_banner -v info -i $OutputPath -vf "blackdetect=d=0.08:pix_th=0.02" -an -f null NUL 2>&1)
    $blackDetectExitCode = $LASTEXITCODE
}
finally {
    $ErrorActionPreference = $previousErrorActionPreference
}
$blackDetectOutput | Set-Content -LiteralPath $blackDetectPath -Encoding UTF8
if ($blackDetectExitCode -ne 0) {
    throw "Black-frame scan failed (exit code $blackDetectExitCode)."
}

$publicationHash = (Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256).Hash
$metadata = [ordered]@{
    generatedAt = (Get-Date).ToString("o")
    mode = $Mode
    source = [ordered]@{
        path = $masterPath
        sha256Before = $masterHashBefore
        sha256After = $masterHashAfter
        unchanged = $masterHashBefore -eq $masterHashAfter
    }
    output = [ordered]@{
        path = $OutputPath
        sha256 = $publicationHash
        commandRecord = $commandPath
        blackDetectLog = $blackDetectPath
        reviewFrames = $reviewRoot
    }
    timeline = $timelinePath
    filterGraph = $filterPath
    completeDecodePassed = $true
    probe = $probe
}
$metadata | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $metadataPath -Encoding UTF8

Write-Host "Publication render complete: $OutputPath"
Write-Host "Publication SHA-256: $publicationHash"
Write-Host "Archival master unchanged: $masterHashAfter"
Write-Host "Validation metadata: $metadataPath"
Write-Host "Representative frames: $reviewRoot"
