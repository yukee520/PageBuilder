import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Video, { type VideoRef } from 'react-native-video';
import { release, subscribe, takeOver } from './audioBus';

export const BGM_DEBUG = false;

function log(...args: unknown[]): void {
  if (BGM_DEBUG) {
    // eslint-disable-next-line no-console
    console.log('[BgmPlayer]', ...args);
  }
}

export interface BgmPlayerProps {
  pageId: string;
  enabled: boolean;
  url: string | undefined;
  loop: boolean;
  accessToken?: string;
}

interface VideoErrorEvent {
  error?: {
    errorString?: string;
    errorCode?: number;
  };
}

const BGM_OWNER_ID = 'bgm';

export function BgmPlayer({
  pageId,
  enabled,
  url,
  loop,
  accessToken,
}: BgmPlayerProps): React.ReactElement | null {
  const videoRef = useRef<VideoRef>(null);
  const [paused, setPaused] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const lastUrlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const urlChanged = lastUrlRef.current !== url;
    lastUrlRef.current = url;
    if (urlChanged) {
      setPaused(false);
      setLastError(null);
      if (enabled && url) {
        takeOver(BGM_OWNER_ID);
      } else {
        release(BGM_OWNER_ID);
      }
    }
    log('page changed', { pageId, url: url?.slice(0, 100), urlChanged });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, url, enabled]);

  // Subscribe to the audio bus: when a music list takes over, pause BGM.
  useEffect(() => {
    const unsubscribe = subscribe(BGM_OWNER_ID, () => {
      log('taken over by another audio source; pausing');
      setPaused(true);
    });
    return unsubscribe;
  }, []);

  // Release ownership on unmount.
  useEffect(() => {
    return () => {
      release(BGM_OWNER_ID);
    };
  }, []);

  const handleToggle = useCallback((): void => {
    setPaused(prev => {
      const next = !prev;
      if (next) {
        // About to pause → release ownership so music can play.
        release(BGM_OWNER_ID);
      } else {
        // About to resume → claim ownership (pauses music if active).
        takeOver(BGM_OWNER_ID);
      }
      return next;
    });
  }, []);

  const handleError = useCallback((event: VideoErrorEvent): void => {
    const message = event?.error?.errorString ?? 'Playback failed.';
    const code = event?.error?.errorCode;
    log('playback error', { message, code });
    setLastError(`${message}${code !== undefined ? ` (${code})` : ''}`);
    release(BGM_OWNER_ID);
  }, []);

  const handleLoad = useCallback((): void => {
    log('loaded');
  }, []);

  if (!enabled || !url) {
    return null;
  }

  const source = {
    uri: url,
    headers: accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.raw',
        }
      : {
          Accept: 'application/vnd.github.raw',
        },
  };

  return (
    <>
      <Video
        ref={videoRef}
        source={source}
        paused={paused}
        repeat={loop}
        onError={handleError}
        onLoad={handleLoad}
        style={{ width: 0, height: 0, position: 'absolute' }}
        playInBackground={false}
        playWhenInactive={false}
        ignoreSilentSwitch="ignore"
      />

      <Pressable
        onPress={handleToggle}
        style={{
          position: 'absolute',
          right: 16,
          bottom: 24,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: 'rgba(37, 99, 235, 0.9)',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
          elevation: 6,
        }}
        accessibilityRole="button"
        accessibilityLabel={paused ? 'Play background music' : 'Pause background music'}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>
          {paused ? '▶' : '❚❚'}
        </Text>
        {lastError && BGM_DEBUG ? (
          <View
            style={{
              position: 'absolute',
              bottom: -28,
              right: 0,
              backgroundColor: '#0F172A',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
              maxWidth: 240,
            }}
          >
            <Text
              style={{ color: '#FCA5A5', fontSize: 8 }}
              numberOfLines={2}
            >
              {lastError}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </>
  );
}