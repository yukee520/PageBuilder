import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import type { PageComponent, SizePreset } from '../../src/types/component';
import type { Page } from '../../src/types/project';
import {
  MUSIC_DEBUG,
  pauseSound,
  playUrl,
  probeUrl,
  stopSound,
  type SoundInstance,
} from './MusicPlayer';
import { resolveRuntimeUri } from './assetResolver';

export interface RuntimeRendererProps {
  page: Page;
  variables: Record<string, string>;
  hiddenComponentIds: Record<string, boolean>;
  onComponentPress: (component: PageComponent) => void;
  onInputChange: (componentId: string, value: string) => void;
  canvasBackgroundColor?: string;
}

const CANVAS_ASPECT = 360 / 800;
const CANVAS_REFERENCE_WIDTH = 360;

interface CanvasLayout {
  scale: number;
  offsetX: number;
  offsetY: number;
  canvasWidth: number;
  canvasHeight: number;
}

function computeLayout(screenW: number, screenH: number): CanvasLayout {
  const screenAspect = screenW / screenH;
  let canvasWidth: number;
  let canvasHeight: number;

  if (screenAspect > CANVAS_ASPECT) {
    canvasHeight = screenH;
    canvasWidth = canvasHeight * CANVAS_ASPECT;
  } else {
    canvasWidth = screenW;
    canvasHeight = canvasWidth / CANVAS_ASPECT;
  }

  const offsetX = (screenW - canvasWidth) / 2;
  const offsetY = (screenH - canvasHeight) / 2;
  const scale = canvasWidth / CANVAS_REFERENCE_WIDTH;

  return { scale, offsetX, offsetY, canvasWidth, canvasHeight };
}

function fontSizeFor(size: SizePreset): number {
  switch (size) {
    case 'small':
      return 13;
    case 'medium':
      return 16;
    case 'large':
      return 22;
    case 'full':
      return 28;
    default:
      return 16;
  }
}

interface RenderContext {
  scale: number;
  onComponentPress: (component: PageComponent) => void;
  onInputChange: (componentId: string, value: string) => void;
  variables: Record<string, string>;
}

function renderComponent(
  component: PageComponent,
  ctx: RenderContext,
): React.ReactElement | null {
  const { scale } = ctx;

  switch (component.type) {
    case 'text': {
      const textInner = (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: 2,
          }}
        >
          <Text
            style={{
              fontSize: fontSizeFor(component.fontSize) * scale,
              lineHeight: fontSizeFor(component.fontSize) * scale * 1.35,
              textAlign: component.align,
              fontWeight: component.bold ? '700' : '400',
              color: component.color ?? '#0F172A',
            }}
          >
            {component.content || ' '}
          </Text>
        </View>
      );

      if (component.actions.length > 0) {
        return (
          <Pressable
            onPress={() => ctx.onComponentPress(component)}
            style={{ flex: 1 }}
          >
            {textInner}
          </Pressable>
        );
      }
      return textInner;
    }

    case 'image': {
      const radius = component.rounded ? 12 * scale : 0;
      const mode = component.backgroundMode ? 'cover' : 'contain';
      const finalUri = component.uri ? resolveRuntimeUri(component.uri) : '';

      const imageInner = finalUri ? (
        <Image
          source={{ uri: finalUri }}
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            borderRadius: radius,
          }}
          resizeMode={mode}
        />
      ) : (
        <View
          style={{
            flex: 1,
            backgroundColor: '#E2E8F0',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius,
          }}
        >
          <Text style={{ color: '#64748B', fontSize: 11 * scale }}>
            No image
          </Text>
        </View>
      );

      if (component.actions.length > 0) {
        return (
          <Pressable
            onPress={() => ctx.onComponentPress(component)}
            style={{ flex: 1 }}
            accessibilityRole="button"
          >
            {imageInner}
          </Pressable>
        );
      }
      return imageInner;
    }

    case 'video': {
      const finalUrl = component.url ? resolveRuntimeUri(component.url) : '';
      return (
        <Pressable
          onPress={() => ctx.onComponentPress(component)}
          style={{
            flex: 1,
            backgroundColor: '#000000',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 12 * scale,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 40 * scale }}>▶</Text>
          <Text
            style={{
              color: '#E2E8F0',
              fontSize: 11 * scale,
              marginTop: 4,
              paddingHorizontal: 8,
              textAlign: 'center',
            }}
            numberOfLines={2}
          >
            {finalUrl || 'Video'}
          </Text>
        </Pressable>
      );
    }

    case 'button':
      return (
        <Pressable
          onPress={() => ctx.onComponentPress(component)}
          style={{
            flex: 1,
            backgroundColor:
              component.variant === 'primary'
                ? '#2563EB'
                : component.variant === 'danger'
                ? '#EF4444'
                : '#64748B',
            borderRadius: 10 * scale,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 12 * scale,
          }}
          accessibilityRole="button"
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: 15 * scale,
              fontWeight: '600',
              textAlign: 'center',
            }}
            numberOfLines={1}
          >
            {component.label || 'Button'}
          </Text>
        </Pressable>
      );

    case 'spacer':
      return (
        <View
          style={{
            flex: 1,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: '#E2E8F0',
            borderRadius: 6 * scale,
          }}
        />
      );

    case 'divider': {
      const thickness =
        component.thickness === 'thin'
          ? 1
          : component.thickness === 'medium'
          ? 2
          : 4;
      const h = Math.max(thickness * scale, thickness);
      return (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View
            style={{
              height: h,
              backgroundColor: '#E2E8F0',
              width: '100%',
              borderRadius: h / 2,
            }}
          />
        </View>
      );
    }

    case 'input':
      return (
        <TextInput
          value={ctx.variables[component.variableKey] ?? ''}
          onChangeText={value => ctx.onInputChange(component.id, value)}
          placeholder={component.placeholder || 'Enter text'}
          placeholderTextColor="#94A3B8"
          style={{
            flex: 1,
            backgroundColor: '#FFFFFF',
            borderColor: '#E2E8F0',
            borderWidth: 1,
            borderRadius: 10 * scale,
            paddingHorizontal: 10 * scale,
            color: '#0F172A',
            fontSize: 15 * scale,
          }}
        />
      );

    case 'row': {
      const gap =
        component.gap === 'small' ? 6 : component.gap === 'large' ? 20 : 12;
      if (component.children.length === 0) {
        return (
          <View
            style={{
              flex: 1,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: '#E2E8F0',
              borderRadius: 10 * scale,
            }}
          />
        );
      }
      return (
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            gap: gap * scale,
          }}
        >
          {component.children.map(child => (
            <View
              key={child.id}
              style={{
                flex: Math.max(child.width, 0.1),
                opacity: child.visible ? 1 : 0.3,
              }}
            >
              <View style={{ flex: 1 }}>
                {renderComponent(child, ctx)}
              </View>
            </View>
          ))}
        </View>
      );
    }

    case 'music':
      return <MusicListRenderer component={component} scale={scale} />;

    default:
      return null;
  }
}

interface MusicListRendererProps {
  component: Extract<PageComponent, { type: 'music' }>;
  scale: number;
}

interface ProbeResult {
  ok: boolean;
  message?: string;
  durationSec?: number;
}

function MusicListRenderer({
  component,
  scale,
}: MusicListRendererProps): React.ReactElement {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [boxHeight, setBoxHeight] = useState<number>(0);
  const [probes, setProbes] = useState<Record<string, ProbeResult>>({});
  const soundRef = useRef<SoundInstance>(null);
  const currentIndexRef = useRef<number>(-1);

  const stopCurrent = useCallback((): void => {
    if (soundRef.current) {
      stopSound(soundRef.current);
      soundRef.current = null;
    }
    currentIndexRef.current = -1;
    setPlayingId(null);
  }, []);

  const playIndex = useCallback(
    (index: number): void => {
      const track = component.tracks[index];
      if (!track || !track.url) {
        setPlayingId(null);
        return;
      }

      if (soundRef.current) {
        stopSound(soundRef.current);
        soundRef.current = null;
      }

      currentIndexRef.current = index;
      setPlayingId(track.id);
      setLastError(null);

      soundRef.current = playUrl(track.url, {
        onFinish: () => {
          const nextIndex = index + 1;
          if (nextIndex < component.tracks.length) {
            playIndex(nextIndex);
          } else {
            playIndex(0);
          }
        },
        onError: message => {
          soundRef.current = null;
          setPlayingId(null);
          setLastError(`${track.title || 'Track'}: ${message}`);
        },
      });
    },
    [component.tracks],
  );

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        stopSound(soundRef.current);
        soundRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (
      component.autoplay &&
      component.tracks.length > 0 &&
      playingId === null
    ) {
      playIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Diagnostic: probe each track's URL once when the list mounts or the
  // track list changes. This is how we find 404s / encoding failures
  // without having to guess at the runtime side.
  useEffect(() => {
    if (!MUSIC_DEBUG) return;
    let cancelled = false;
    const run = async (): Promise<void> => {
      const results: Record<string, ProbeResult> = {};
      for (const track of component.tracks) {
        if (cancelled) return;
        if (!track.url) {
          results[track.id] = { ok: false, message: 'no url' };
          continue;
        }
        const r = await probeUrl(track.url);
        results[track.id] = r;
      }
      if (!cancelled) setProbes(results);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [component.tracks]);

  const handleTrackPress = useCallback(
    (trackId: string): void => {
      const index = component.tracks.findIndex(t => t.id === trackId);
      if (index < 0) return;

      if (playingId === trackId) {
        if (soundRef.current) {
          pauseSound(soundRef.current);
        }
        setPlayingId(null);
        return;
      }

      if (soundRef.current) {
        stopSound(soundRef.current);
        soundRef.current = null;
      }
      playIndex(index);
    },
    [component.tracks, playIndex, playingId],
  );

  const handleLayout = useCallback((e: LayoutChangeEvent): void => {
    const h = e.nativeEvent.layout.height;
    setBoxHeight(h);
  }, []);

  if (component.tracks.length === 0) {
    return (
      <View
        onLayout={handleLayout}
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

  // Height of a single row in pixels. Used both for the diagnostics
  // banner and (in future phases) for auto-sizing the box.
  const rowHeightPx = 44 * scale;
  const requiredHeightPx = rowHeightPx * Math.min(component.tracks.length, 6);
  const tooShort = boxHeight > 0 && boxHeight < rowHeightPx;

  return (
    <View
      onLayout={handleLayout}
      style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        borderRadius: 10 * scale,
        overflow: 'hidden',
      }}
    >
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
            {`music debug · tracks=${component.tracks.length} · box=${
              boxHeight > 0 ? boxHeight.toFixed(0) : '?'
            }px · row=${rowHeightPx.toFixed(
              0,
            )}px · need=${requiredHeightPx.toFixed(
              0,
            )}px${tooShort ? ' · TOO SHORT' : ''}${
              lastError ? `\nerror: ${lastError}` : ''
            }`}
          </Text>
        </View>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {component.tracks.map((track, index) => {
          const isPlaying = playingId === track.id;
          const probe = probes[track.id];
          const probeColor =
            probe === undefined
              ? '#94A3B8'
              : probe.ok
              ? '#16A34A'
              : '#EF4444';
          const probeLabel =
            probe === undefined
              ? '…'
              : probe.ok
              ? 'OK'
              : probe.message === 'no url'
              ? 'NO URL'
              : 'FAIL';

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
                  {isPlaying ? '❚❚' : '▶'}
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
                {component.showArtist && track.artist ? (
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
              {MUSIC_DEBUG ? (
                <Text
                  style={{
                    color: probeColor,
                    fontSize: 9,
                    fontFamily: 'monospace',
                    marginLeft: 6,
                  }}
                >
                  {probeLabel}
                </Text>
              ) : null}
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

export default function RuntimeRenderer({
  page,
  variables,
  hiddenComponentIds,
  onComponentPress,
  onInputChange,
  canvasBackgroundColor,
}: RuntimeRendererProps): React.ReactElement {
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const layout = useMemo<CanvasLayout | null>(() => {
    if (size.width === 0 || size.height === 0) return null;
    return computeLayout(size.width, size.height);
  }, [size]);

  const handleLayout = (e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) {
      setSize({ width, height });
    }
  };

  const sortedComponents = useMemo(() => {
    return [...page.components].sort((a, b) => a.zIndex - b.zIndex);
  }, [page.components]);

  return (
    <View onLayout={handleLayout} style={{ flex: 1, overflow: 'visible' }}>
      {layout ? (
        <>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: layout.offsetX,
              top: layout.offsetY,
              width: layout.canvasWidth,
              height: layout.canvasHeight,
              backgroundColor: canvasBackgroundColor ?? '#FFFFFF',
            }}
          />

          <View
            style={{
              position: 'absolute',
              left: layout.offsetX,
              top: layout.offsetY,
              width: layout.canvasWidth,
              height: layout.canvasHeight,
              overflow: 'visible',
            }}
          >
            {sortedComponents.map(component => {
              if (!component.visible) return null;
              if (hiddenComponentIds[component.id]) return null;

              const left = component.x * layout.canvasWidth;
              const top = component.y * layout.canvasHeight;
              const width = component.width * layout.canvasWidth;
              const height = component.height * layout.canvasHeight;

              return (
                <View
                  key={component.id}
                  style={{
                    position: 'absolute',
                    left,
                    top,
                    width,
                    height,
                    zIndex: component.zIndex,
                  }}
                >
                  {renderComponent(component, {
                    scale: layout.scale,
                    onComponentPress,
                    onInputChange,
                    variables,
                  })}
                </View>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}