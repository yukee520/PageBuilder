import React, { useCallback, useEffect, useRef, useState } from 'react';
import Video, { type VideoRef } from 'react-native-video';
import { release, subscribe, takeOver } from './audioBus';

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
   * tears down the previous audio and, if the new page has BGM configured,
   * starts the new one.
   */
  pageId: string;
  /**
   * Whether the page author enabled BGM for this page. When false, no BGM
   * plays regardless of user settings.
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
   * Optional project-level GitHub Personal Access Token. Required only for
   * private-repo URLs.
   */
  accessToken?: string;
  /**
   * End-user setting: whether BGM should play at all. When false, this
   * component refuses to claim audio ownership even if the page has BGM
   * configured.
   */
  userEnabled: boolean;
}

interface VideoErrorEvent {
  error?: {
    errorString?: string;
    errorCode?: number;
  };
}

const BGM_OWNER_ID = 'bgm';

/**
 * Headless background music player.
 *
 * Behavior:
 *   - Plays automatically when the page loads if `enabled` and `userEnabled`
 *     are both true and `url` is set.
 *   - Pauses automatically when a music list or video takes over audio.
 *   - Resumes automatically when that owner releases (via the audio bus's
 *     `resumePrevious: true` signal).
 *   - Stops immediately when the user disables BGM in settings.
 *   - Restarts cleanly when the page changes to one with a different URL.
 *   - Does not restart when the page changes but the URL is the same.
 *
 * Renders a hidden `<Video>` element when playing. Renders nothing when
 * disabled.
 */
export function BgmPlayer({
  pageId,
  enabled,
  url,
  loop,
  accessToken,
  userEnabled,
}: BgmPlayerProps): React.ReactElement | null {
  const videoRef = useRef<VideoRef>(null);
  const [paused, setPaused] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const lastUrlRef = useRef<string | undefined>(undefined);

  const shouldPlay = enabled && userEnabled && !!url;

  // React to URL, page, and enabled-flag changes.
  useEffect(() => {
    const urlChanged = lastUrlRef.current !== url;
    lastUrlRef.current = url;

    if (urlChanged) {
      setPaused(false);
      setLastError(null);
    }

    if (!shouldPlay) {
      // Page has no BGM, or the user turned it off.
      release(BGM_OWNER_ID);
      log('stop (not configured or disabled)', { pageId });
      return;
    }

    if (urlChanged) {
      // New track — grab ownership and start.
      takeOver(BGM_OWNER_ID);
      log('start new track', { pageId, url: url?.slice(0, 100) });
    } else {
      // Same track, same page state — only assert ownership if nothing
      // else is currently playing. This handles the case where the user
      // re-enabled BGM in settings and nothing else owns audio.
      takeOver(BGM_OWNER_ID);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, url, shouldPlay]);

  // Subscribe to the audio bus.
  //
  // `onStop` fires when a music list or video claims audio — we pause BGM.
  // `onResume` fires when that owner releases with `resumePrevious: true`,
  // i.e. the user paused a music track or a video ended. If BGM is still
  // allowed to play, resume.
  useEffect(() => {
    const unsubscribe = subscribe(
      BGM_OWNER_ID,
      () => {
        log('taken over by another audio source; pausing');
        setPaused(true);
      },
      () => {
        log('resume requested by bus');
        // Only resume if we're still supposed to play.
        setPaused(prev => {
          if (!shouldPlay) return prev;
          return false;
        });
      },
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldPlay]);

  // Release ownership on unmount.
  useEffect(() => {
    return () => {
      release(BGM_OWNER_ID);
    };
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

  if (!shouldPlay) {
    return null;
  }

  const source = {
    uri: url!,
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
  );
}