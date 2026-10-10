param([string]$InputFile = 'C:\favplace\motion\hero-v1\ae-render\favplace-hero-master.avi')
$ErrorActionPreference = 'Stop'
$motionRoot = $PSScriptRoot
& ffmpeg -hide_banner -y -i $InputFile -an -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -movflags +faststart -color_primaries bt709 -color_trc bt709 -colorspace bt709 (Join-Path $motionRoot 'favplace-hero-v1.mp4')
if ($LASTEXITCODE -ne 0) { throw 'MP4 encoding failed' }
& ffmpeg -hide_banner -y -i $InputFile -an -c:v libvpx-vp9 -b:v 0 -crf 30 -row-mt 1 -pix_fmt yuv420p (Join-Path $motionRoot 'favplace-hero-v1.webm')
if ($LASTEXITCODE -ne 0) { throw 'WebM encoding failed' }
& ffprobe -v error -show_entries 'format=duration,size:stream=codec_name,width,height,r_frame_rate' -of json (Join-Path $motionRoot 'favplace-hero-v1.mp4')
