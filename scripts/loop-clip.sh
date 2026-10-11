#!/bin/sh
# Turns a clip into a short seamless portrait loop for VideoBackdrop.
# Usage: scripts/loop-clip.sh in.mp4 out.mp4 [loop seconds=4] [speed=0.6] [start offset seconds=0]
# ZOOM=0.8 keeps the bottom-centre 80% of the frame, so the foreground (grass, water) fills more of the screen.
# FADE=1.5 sets the crossfade length in output seconds.
# PINGPONG=1 plays the first T seconds forward then backward instead: a 2T loop with no dissolve at all,
# good for slow drifting clouds and swaying grass that read the same in either direction.
# Slows the footage, crops to 9:16 at 540x960, then dissolves the tail back into the head: the loop body is
# source[fade..T+fade] and its last `fade` seconds crossfade into source[0..fade], so the final frame matches
# the first one and the native loop has no seam. Silent, faststart.
set -e
in="$1"; out="$2"; T="${3:-4}"; speed="${4:-0.6}"; ss="${5:-0}"; Z="${ZOOM:-1}"
fade="${FADE:-1.5}"
pts=$(python3 -c "print(1/$speed)")
off=$(python3 -c "print($T-$fade)")
end=$(python3 -c "print($T+$fade)")
base="[0:v]setpts=${pts}*PTS,minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir,\
crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',crop=iw*${Z}:ih*${Z}:(iw-ow)/2:ih-oh,scale=540:960"
if [ -n "$PINGPONG" ]; then
  graph="${base},trim=0:${T},setpts=PTS-STARTPTS,split[f][r];[r]reverse[rv];[f][rv]concat=n=2:v=1:a=0[v]"
else
  graph="${base},split[a][b];\
[a]trim=${fade}:${end},setpts=PTS-STARTPTS[body];\
[b]trim=0:${fade},setpts=PTS-STARTPTS[head];\
[body][head]xfade=transition=fade:duration=${fade}:offset=${off},trim=0:${T},setpts=PTS-STARTPTS[v]"
fi
ffmpeg -y -loglevel error -ss "$ss" -i "$in" -an -filter_complex "$graph" \
  -map "[v]" -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -movflags +faststart "$out"
ls -la "$out"
