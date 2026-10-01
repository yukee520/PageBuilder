import Sound from 'react-native-sound';

Sound.setCategory('Playback', true);

export type SoundInstance = Sound | null;

export interface PlaybackCallbacks {
  onFinish: () => void;
  onError: (message: string) => void;
}

export function playUrl(
  url: string,
  callbacks: PlaybackCallbacks,
): SoundInstance {
  if (!url) {
    callbacks.onError('No URL provided.');
    return null;
  }

  let sound: Sound | null = null;
  try {
    sound = new Sound(url, undefined, error => {
      if (error) {
        callbacks.onError('Could not load audio.');
        return;
      }
      if (!sound) return;
      sound.play(success => {
        if (success) {
          callbacks.onFinish();
        } else {
          callbacks.onError('Playback failed.');
        }
      });
    });
  } catch {
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