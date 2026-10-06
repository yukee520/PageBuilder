import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Video, { type VideoRef } from 'react-native-video';
import type { PageComponent, SizePreset } from '../../src/types/component';
import type { Page } from '../../src/types/project';
import { MusicListRenderer } from './MusicPlayer';
import { resolveRuntimeUri } from './assetResolver';
import { release, takeOver } from './audioBus';

export interface RuntimeRendererProps {
  page: Page;
  variables: Record<string, string>;
  hiddenComponentIds: Record<string, boolean>;
  onComponentPress: (component: PageComponent) => void;
  onInputChange: (componentId: string, value: string) => void;
  canvasBackgroundColor?: string;
  projectAssetToken?: string;
}

const CANVAS_REFERENCE_WIDTH = 360;
const CANVAS_REFERENCE_HEIGHT = 800;

interface CanvasLayout {
  scale: number;
  offsetX: number;
  offsetY: number;
  canvasWidth: number;
  canvasHeight: number;
}

function computeLayout(screenW: number, screenH: number): CanvasLayout {
  // Full-bleed: the canvas fills the available area. No aspect-ratio
  // letterbox. Positions and sizes are still stored as fractions, so the
  // design stretches to fit any phone or tablet.
  const canvasWidth = screenW;
  const canvasHeight = screenH;
  const offsetX = 0;
  const offsetY = 0;

  // Scale text and borders by the smaller dimension relative to the
  // reference canvas so type stays readable on narrow phones and doesn't
  // blow up on high-density or wide screens.
  const scale = Math.min(
    canvasWidth / CANVAS_REFERENCE_WIDTH,
    canvasHeight / CANVAS_REFERENCE_HEIGHT,
  );

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
  projectAssetToken?: string;
}

/**
 * Autoplay video — plays inline, no controls, coordinates with the audio bus.
 * Owns audio while playing; releases with `resumePrevious: true` on end/error.
 */
function AutoplayVideo({
  component,
  scale,
  accessToken,
}: {
  component: Extract<PageComponent, { type: 'video' }>;
  scale: number;
  accessToken?: string;
}): React.ReactElement {
  const ownerId = `video:${component.id}`;
  const finalUrl = component.url ? resolveRuntimeUri(component.url) : '';

  // Subscribe once. If BGM or music takes over, we don't pause the video
  // (videos are visual; the user isn't going to appreciate a silent playing
  // video). Instead we release ownership so the other source can play.
  // Videos win the takeover contest when they start; if another source
  // starts, the video keeps playing but stops owning the bus.
  useEffect(() => {
    takeOver(ownerId);
    return () => {
      release(ownerId, { resumePrevious: true });
    };
  }, [ownerId]);

  const handleEnd = useCallback((): void => {
    // If not looping, release ownership so BGM can resume.
    if (!component.loop) {
      release(ownerId, { resumePrevious: true });
    }
  }, [component.loop, ownerId]);

  const handleError = useCallback((): void => {
    release(ownerId, { resumePrevious: true });
  }, [ownerId]);

  if (!finalUrl) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#000000',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 12 * scale,
        }}
      >
        <Text style={{ color: '#94A3B8', fontSize: 11 * scale }}>
          No video URL
        </Text>
      </View>
    );
  }

  const source = {
    uri: finalUrl,
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
    <View
      style={{
        flex: 1,
        backgroundColor: '#000000',
        borderRadius: 12 * scale,
        overflow: 'hidden',
      }}
    >
      <Video
        source={source}
        style={{ flex: 1 }}
        resizeMode="contain"
        repeat={component.loop}
        muted={false}
        paused={false}
        controls={false}
        onEnd={handleEnd}
        onError={handleError}
        playInBackground={false}
        playWhenInactive={false}
        ignoreSilentSwitch="ignore"
      />
    </View>
  );
}

/**
 * Manual video — shows a black box with a play icon. Tapping opens a
 * full-screen modal with the video and standard controls.
 */
function ManualVideo({
  component,
  scale,
  accessToken,
}: {
  component: Extract<PageComponent, { type: 'video' }>;
  scale: number;
  accessToken?: string;
}): React.ReactElement {
  const ownerId = `video:${component.id}`;
  const [visible, setVisible] = useState<boolean>(false);
  const finalUrl = component.url ? resolveRuntimeUri(component.url) : '';

  // Take ownership when the modal opens; release with resumePrevious on
  // close, so BGM resumes.
  useEffect(() => {
    if (!visible) return;
    takeOver(ownerId);
    return () => {
      release(ownerId, { resumePrevious: true });
    };
  }, [visible, ownerId]);

  const handleOpen = useCallback((): void => {
    if (!finalUrl) return;
    setVisible(true);
  }, [finalUrl]);

  const handleClose = useCallback((): void => {
    setVisible(false);
  }, []);

  const handleEnd = useCallback((): void => {
    setVisible(false);
  }, []);

  const handleError = useCallback((): void => {
    // Close on error; keep the UX simple. Could surface a toast here.
    setVisible(false);
  }, []);

  const source = finalUrl
    ? {
        uri: finalUrl,
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

  return (
    <>
      <Pressable
        onPress={handleOpen}
        style={{
          flex: 1,
          backgroundColor: '#000000',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 12 * scale,
        }}
        accessibilityRole="button"
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

      <Modal
        visible={visible}
        animationType="fade"
        onRequestClose={handleClose}
        supportedOrientations={['portrait', 'landscape']}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              padding: 12,
            }}
          >
            <Pressable
              onPress={handleClose}
              hitSlop={10}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(255,255,255,0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="Close video"
            >
              <Text style={{ color: '#FFFFFF', fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>

          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {source ? (
              <Video
                source={source}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
                controls
                paused={false}
                repeat={false}
                onEnd={handleEnd}
                onError={handleError}
                playInBackground={false}
                playWhenInactive={false}
                ignoreSilentSwitch="ignore"
              />
            ) : (
              <Text style={{ color: '#94A3B8' }}>No video URL</Text>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
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

    case 'video':
      if (component.autoPlay) {
        return (
          <AutoplayVideo
            component={component}
            scale={scale}
            accessToken={ctx.projectAssetToken}
          />
        );
      }
      return (
        <ManualVideo
          component={component}
          scale={scale}
          accessToken={ctx.projectAssetToken}
        />
      );

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
      return (
        <MusicListRenderer
          tracks={component.tracks}
          showArtist={component.showArtist}
          autoplay={component.autoplay}
          accessToken={ctx.projectAssetToken}
          scale={scale}
          componentId={component.id}
        />
      );

    default:
      return null;
  }
}

export default function RuntimeRenderer({
  page,
  variables,
  hiddenComponentIds,
  onComponentPress,
  onInputChange,
  canvasBackgroundColor,
  projectAssetToken,
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
                    projectAssetToken,
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