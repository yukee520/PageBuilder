import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Video, { type VideoRef } from 'react-native-video';

/**
 * Set to true to log BGM lifecycle events to logcat (Android).
 * Flip to false before shipping a clean build to end users.
 */
export const BGM_DEBUG = false;

function log(...args: unknown[]): void {
  if (BGM_DEBUG) {
    // eslint-disable-next-line no-console
    console.log('[BgmPlayer]', ...args);
  }
}

export interface BgmPlayerProps {
  /**
   * Stable identifier for the current page. When this changes, the player
   * tears down the previous audio and (if the new page has BGM configured)
   * starts the new one.
   */
  pageId: string;
  /**
   * Whether the current page has BGM enabled. If false, the player renders
   * nothing and stops any active audio.
   */
  enabled: boolean;
  /**
   * The audio URL for the current page. Can be a public https:// URL, or
   * an api.github.com contents URL for a private repo.
   */
  url: string | undefined;
  /**
   * Whether to loop the track when it ends.
   */
  loop: boolean;
  /**
   * Optional project-level GitHub Personal Access Token. When present,
   * it's sent as `Authorization: Bearer <token>` on every request.
   * Required for private-repo URLs.
   */
  accessToken?: string;
}

interface VideoErrorEvent {
  error?: {
    errorString?: string;
    errorCode?: number;
  };
}

/**
 * Floating background-music control. Renders a small pill in the
 * bottom-right corner of the screen with a play/pause toggle.
 *
 * Behavior:
 *   - When `enabled` is true and `url` is set, the track autoplays.
 *   - When the page changes (`pageId` changes), the previous audio stops.
 *   - If the same URL is reused across pages, the audio is NOT restarted —
 *     the user's play/pause state persists.
 *   - When `enabled` is false or `url` is empty, the player renders
 *     nothing.
 */
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

  // When the URL changes, reset the paused state so a new track starts
  // playing. When only the page changes but the URL is the same, keep
  // the current play/pause state — the audio shouldn't restart.
  useEffect(() => {
    const urlChanged = lastUrlRef.current !== url;
    lastUrlRef.current = url;
    if (urlChanged) {
      setPaused(false);
      setLastError(null);
    }
    log('page changed', { pageId, url: url?.slice(0, 100), urlChanged });
  }, [pageId, url]);

  const handleToggle = useCallback((): void => {
    setPaused(p => !p);
  }, []);

  const handleError = useCallback((event: VideoErrorEvent): void => {
    const message = event?.error?.errorString ?? 'Playback failed.';
    const code = event?.error?.errorCode;
    log('playback error', { message, code });
    setLastError(
      `${message}${code !== undefined ? ` (${code})` : ''}`,
    );
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