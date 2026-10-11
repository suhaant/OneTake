import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';

export type Clip = 'sky' | 'bubbles' | 'island';

/**
 * Four-second cuts from the reference footage, slowed to 0.6x, cropped to portrait and silent, with
 * the wrap-around crossfade baked into the file so the native loop is seamless.
 */
const CLIPS: Record<Clip, number> = {
  sky: require('../../assets/video/sky.mp4'),
  bubbles: require('../../assets/video/bubbles.mp4'),
  island: require('../../assets/video/island.mp4'),
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
