#!/bin/sh
# Shrinks the generated stills to phone size: 1080x1920 JPEG, ~250 KB each.
set -e
cd "$(dirname "$0")/.."
for f in assets/art/*.png; do
  out="${f%.png}.jpg"
  ffmpeg -y -loglevel error -i "$f" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" -q:v 4 "$out"
  rm "$f"
  ls -la "$out"
done
