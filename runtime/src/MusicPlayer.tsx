import Sound from 'react-native-sound';

Sound.setCategory('Playback', true);

/**
 * Set this to true when diagnosing music playback inside a generated APK.
 * The runtime logs the URL, load result, and playback outcome to logcat
 * (Android) via console.log. No effect on UI.
 *
 * Flip to false before shipping a "clean" build to end users.
 */
export const MUSIC_DEBUG = false;

function log(...args: unknown[]): void {
  if (MUSIC_DEBUG) {
    // eslint-disable-next-line no-console
    console.log('[MusicPlayer]', ...args);
  }
}

export type SoundInstance = Sound | null;

export interface PlaybackCallbacks {
  onFinish: () => void;
  onError: (message: string) => void;
}

/**
 * Load and start playing a URL. Returns the Sound instance (or null on
 * immediate failure). Callbacks fire when the sound finishes or errors.
 *
 * Note: react-native-sound requires a URL that serves raw audio bytes.
 * For private GitHub repos, use the API URL with a token — this file is
 * scheduled to be rewritten around react-native-video in Phase 2 so that
 * per-request auth headers work.
 */
export function playUrl(
  url: string,
  callbacks: PlaybackCallbacks,
): SoundInstance {
  if (!url) {
    log('playUrl called with empty URL');
    callbacks.onError('No URL provided.');
    return null;
  }

  log('load start', { url: url.slice(0, 120) });

  let sound: Sound | null = null;
  try {
    sound = new Sound(url, undefined, error => {
      if (error) {
        log('load failed', {
          url: url.slice(0, 120),
          message: error.message,
          code: error.code,
        });
        callbacks.onError(
          `Could not load audio (${error.code || 'unknown'}).`,
        );
        return;
      }
      log('load ok', {
        durationSec: sound?.getDuration?.() ?? null,
      });
      if (!sound) return;
      sound.play(success => {
        if (success) {
          log('playback finished');
          callbacks.onFinish();
        } else {
          log('playback failed');
          callbacks.onError('Playback failed.');
        }
      });
    });
  } catch (err) {
    log('throw during Sound ctor', err);
    callbacks.onError('Could not create audio player.');
    return null;
  }

  return sound;
}

export function stopSound(sound: SoundInstance): void {
  if (!sound) return;
  try {
    sound.stop(() => {
      sound?.release();
    });
  } catch {
    try {
      sound.release();
    } catch {
      // best-effort
    }
  }
}

export function pauseSound(sound: SoundInstance): void {
  if (!sound) return;
  try {
    sound.pause();
  } catch {
    // ignore
  }
}

/**
 * Non-playing probe used by the diagnostics overlay in RuntimeRenderer.
 * Resolves with the load outcome so the UI can show "this URL loads" vs
 * "this URL 404s". Does not start playback, and releases the Sound as
 * soon as the load callback fires.
 */
export function probeUrl(
  url: string,
): Promise<{ ok: boolean; message?: string; durationSec?: number }> {
  return new Promise(resolve => {
    if (!url) {
      resolve({ ok: false, message: 'no url' });
      return;
    }

    let done = false;
    const finish = (result: {
      ok: boolean;
      message?: string;
      durationSec?: number;
    }): void => {
      if (done) return;
      done = true;
      resolve(result);
    };

    try {
      const s = new Sound(url, undefined, error => {
        if (error) {
          finish({ ok: false, message: error.message || 'load failed' });
          try {
            s.release();
          } catch {
            /* ignore */
          }
          return;
        }
        finish({ ok: true, durationSec: s.getDuration?.() ?? undefined });
        try {
          s.release();
        } catch {
          /* ignore */
        }
      });
    } catch (err) {
      finish({
        ok: false,
        message: err instanceof Error ? err.message : 'ctor threw',
      });
    }
  });
}