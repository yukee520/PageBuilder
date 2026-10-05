import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Video, { type VideoRef } from 'react-native-video';
import { release, subscribe, takeOver } from './audioBus';

export const MUSIC_DEBUG = false;

function log(...args: unknown[]): void {
  if (MUSIC_DEBUG) {
    // eslint-disable-next-line no-console
    console.log('[MusicPlayer]', ...args);
  }
}

export interface MusicTrackLike {
  id: string;
  title: string;
  artist: string;
  url: string;
}

export interface MusicListRendererProps {
  tracks: MusicTrackLike[];
  showArtist: boolean;
  autoplay: boolean;
  accessToken?: string;
  scale: number;
  /**
   * Unique ID for this music component on the page. Used by the audio bus
   * to coordinate with BGM (one owner plays at a time).
   */
  componentId: string;
}

interface VideoErrorEvent {
  error?: {
    errorString?: string;
    errorCode?: number;
    errorException?: string;
  };
}

export function MusicListRenderer({
  tracks,
  showArtist,
  autoplay,
  accessToken,
  scale,
  componentId,
}: MusicListRendererProps): React.ReactElement {
  const videoRef = useRef<VideoRef>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [paused, setPaused] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [boxHeight, setBoxHeight] = useState<number>(0);
  const currentIndexRef = useRef<number>(-1);

  const ownerId = `music:${componentId}`;

  const stopCurrent = useCallback((): void => {
    currentIndexRef.current = -1;
    setPlayingId(null);
    setPaused(false);
    release(ownerId);
  }, [ownerId]);

  const playIndex = useCallback(
    (index: number): void => {
      const track = tracks[index];
      if (!track || !track.url) {
        stopCurrent();
        return;
      }
      currentIndexRef.current = index;
      setPlayingId(track.id);
      setPaused(false);
      setLastError(null);
      takeOver(ownerId);
      log('play', {
        index,
        title: track.title,
        url: track.url.slice(0, 100),
      });
    },
    [ownerId, stopCurrent, tracks],
  );

  const handleEnd = useCallback((): void => {
    const next = currentIndexRef.current + 1;
    if (next < tracks.length) {
      playIndex(next);
    } else {
      playIndex(0);
    }
  }, [playIndex, tracks.length]);

  const handleVideoError = useCallback(
    (event: VideoErrorEvent): void => {
      const message = event?.error?.errorString ?? 'Playback failed.';
      const code = event?.error?.errorCode;
      log('playback error', { message, code });
      const track = tracks[currentIndexRef.current];
      setLastError(
        `${track?.title || 'Track'}: ${message}${
          code !== undefined ? ` (${code})` : ''
        }`,
      );
      setPlayingId(null);
      setPaused(false);
      release(ownerId);
    },
    [ownerId, tracks],
  );

  const handleLoad = useCallback((): void => {
    const track = tracks[currentIndexRef.current];
    log('loaded', track?.title);
  }, [tracks]);

  // Subscribe to the audio bus: when BGM (or another music component)
  // takes over, pause this one.
  useEffect(() => {
    const unsubscribe = subscribe(ownerId, () => {
      log('taken over by another audio source; pausing');
      if (playingId !== null) {
        setPaused(true);
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  // Release ownership on unmount.
  useEffect(() => {
    return () => {
      release(ownerId);
    };
  }, [ownerId]);

  // Autoplay first track once on mount.
  useEffect(() => {
    if (autoplay && tracks.length > 0 && playingId === null) {
      playIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTrackPress = useCallback(
    (trackId: string): void => {
      const index = tracks.findIndex(t => t.id === trackId);
      if (index < 0) return;

      if (playingId === trackId) {
        // Same track: toggle pause/resume.
        if (paused) {
          takeOver(ownerId);
          setPaused(false);
        } else {
          setPaused(true);
          release(ownerId);
        }
        return;
      }
      playIndex(index);
    },
    [ownerId, paused, playIndex, playingId, tracks],
  );

  if (tracks.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: '#E2E8F0',
          borderRadius: 10 * scale,
          backgroundColor: '#FFFFFF',
        }}
      >
        <Text style={{ color: '#64748B', fontSize: 11 * scale }}>
          No tracks
        </Text>
      </View>
    );
  }

  const currentTrack =
    currentIndexRef.current >= 0 ? tracks[currentIndexRef.current] : null;

  const source = currentTrack
    ? {
        uri: currentTrack.url,
        headers: accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github.raw',
            }
          : {
              Accept: 'application/vnd.github.raw',
            },
      }
    : undefined;

  const rowHeightPx = 44 * scale;
  const tooShort = boxHeight > 0 && boxHeight < rowHeightPx;

  return (
    <View
      onLayout={e => setBoxHeight(e.nativeEvent.layout.height)}
      style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        borderRadius: 10 * scale,
        overflow: 'hidden',
      }}
    >
      {source ? (
        <Video
          ref={videoRef}
          source={source}
          paused={paused}
          onEnd={handleEnd}
          onError={handleVideoError}
          onLoad={handleLoad}
          style={{ width: 0, height: 0, position: 'absolute' }}
          repeat={false}
          playInBackground={false}
          playWhenInactive={false}
          ignoreSilentSwitch="ignore"
        />
      ) : null}

      {MUSIC_DEBUG ? (
        <View
          style={{
            backgroundColor: '#0F172A',
            paddingHorizontal: 6,
            paddingVertical: 4,
          }}
        >
          <Text
            style={{ color: '#F8FAFC', fontSize: 9, fontFamily: 'monospace' }}
            numberOfLines={4}
          >
            {`music debug · tracks=${tracks.length} · box=${
              boxHeight > 0 ? boxHeight.toFixed(0) : '?'
            }px · row=${rowHeightPx.toFixed(
              0,
            )}px${tooShort ? ' · TOO SHORT' : ''}${
              currentTrack ? ` · playing=${currentTrack.title}` : ''
            }${lastError ? `\nerror: ${lastError}` : ''}`}
          </Text>
        </View>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {tracks.map((track, index) => {
          const isPlaying = playingId === track.id;
          const isPaused = isPlaying && paused;
          return (
            <Pressable
              key={track.id}
              onPress={() => handleTrackPress(track.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 10 * scale,
                paddingVertical: 9 * scale,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: '#E2E8F0',
                backgroundColor: isPlaying ? '#E0EDFF' : 'transparent',
              }}
              accessibilityRole="button"
            >
              <View
                style={{
                  width: 26 * scale,
                  height: 26 * scale,
                  borderRadius: 13 * scale,
                  backgroundColor: isPlaying ? '#2563EB' : '#E2E8F0',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10 * scale,
                }}
              >
                <Text
                  style={{
                    color: isPlaying ? '#FFFFFF' : '#0F172A',
                    fontSize: 11 * scale,
                    fontWeight: '700',
                  }}
                >
                  {isPaused ? '▶' : isPlaying ? '❚❚' : '▶'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: '#0F172A',
                    fontSize: 13 * scale,
                    fontWeight: '600',
                  }}
                  numberOfLines={1}
                >
                  {track.title || 'Untitled'}
                </Text>
                {showArtist && track.artist ? (
                  <Text
                    style={{
                      color: '#64748B',
                      fontSize: 11 * scale,
                      marginTop: 1 * scale,
                    }}
                    numberOfLines={1}
                  >
                    {track.artist}
                  </Text>
                ) : null}
              </View>
              {isPlaying ? (
                <Text style={{ color: '#2563EB', fontSize: 14 * scale }}>
                  ♪
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}