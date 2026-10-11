import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';

export type Clip = 'sky' | 'bubbles' | 'island' | 'grass';

/**
 * Short portrait loops, silent, with the wrap-around crossfade baked in so the native loop is seamless
 * (scripts/loop-clip.sh). island is the Gemini still from assets/art animated by Veo; grass is the
 * delivered grass_sky_vertical clip; sky and bubbles are cuts from the reference footage.
 */
const CLIPS: Record<Clip, number> = {
  sky: require('../../assets/video/sky.mp4'),
  bubbles: require('../../assets/video/bubbles.mp4'),
  island: require('../../assets/video/island.mp4'),
  // the delivered grass_sky_vertical clip: lawn, bubbles and clouds, 5 s loop
  grass: require('../../assets/video/grass.mp4'),
};

function prime(p: VideoPlayer) {
  p.muted = true;
  p.loop = true;
}

/** Full-bleed looping footage behind a screen. Plays only while the screen is focused. */
export default function VideoBackdrop({ clip, opacity = 1 }: { clip: Clip; opacity?: number }) {
  const player = useVideoPlayer(CLIPS[clip], prime);
  const ref = useRef(player);
  const focused = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ref.current = player;
    const sub = player.addListener('statusChange', ({ status }) => status === 'readyToPlay' && setReady(true));
    return () => sub.remove();
  }, [player]);

  const play = useCallback(() => {
    try {
      ref.current.play();
    } catch {
      // not ready yet, or the browser wants a gesture first; the gradient underneath stays visible
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      play();
      return () => {
        focused.current = false;
        try {
          ref.current.pause();
        } catch {
          // released
        }
      };
    }, [play]),
  );

  useEffect(() => {
    if (ready && focused.current) play();
  }, [ready, play]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
    </View>
  );
}
