import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import type {
  ButtonComponent,
  DividerComponent,
  ImageComponent,
  InputComponent,
  MusicComponent,
  MusicTrack,
  PageComponent,
  RowComponent,
  SizePreset,
  SpacerComponent,
  TextComponent,
  VideoComponent,
} from '@/types/component';
import { useTheme } from '@/hooks/useTheme';

export interface ComponentRendererProps {
  component: PageComponent;
  scale: number;
  onPress?: (event: GestureResponderEvent) => void;
  onInputChange?: (value: string) => void;
  inputValue?: string;
  editable?: boolean;
  playingTrackId?: string | null;
  onMusicTrackPress?: (track: MusicTrack) => void;
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

function renderText(
  c: TextComponent,
  colors: ReturnType<typeof useTheme>['colors'],
  scale: number,
): React.ReactElement {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 2,
      }}
    >
      <Text
        style={{
          fontSize: fontSizeFor(c.fontSize) * scale,
          lineHeight: fontSizeFor(c.fontSize) * scale * 1.35,
          textAlign: c.align,
          fontWeight: c.bold ? '700' : '400',
          color: c.color ?? colors.text,
        }}
        numberOfLines={0}
      >
        {c.content || ' '}
      </Text>
    </View>
  );
}

function renderImage(
  c: ImageComponent,
  colors: ReturnType<typeof useTheme>['colors'],
  scale: number,
): React.ReactElement {
  const radius = c.rounded ? 12 * scale : 0;
  const mode = c.backgroundMode ? 'cover' : 'contain';

  if (!c.uri) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius,
        }}
      >
        <Ionicons name="image-outline" size={28 * scale} color={colors.muted} />
        <Text style={{ color: colors.muted, fontSize: 11 * scale, marginTop: 4 }}>
          No image
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: c.uri }}
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        borderRadius: radius,
      }}
      resizeMode={mode}
    />
  );
}

function renderVideo(
  c: VideoComponent,
  scale: number,
): React.ReactElement {
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
      <Ionicons name="play-circle" size={48 * scale} color="#FFFFFF" />
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
        {c.url || 'No video URL set'}
      </Text>
    </View>
  );
}

function renderButton(
  c: ButtonComponent,
  colors: ReturnType<typeof useTheme>['colors'],
  scale: number,
  onPress?: (event: GestureResponderEvent) => void,
): React.ReactElement {
  const bg =
    c.variant === 'primary'
      ? colors.primary
      : c.variant === 'danger'
      ? colors.danger
      : colors.secondary;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{
        flex: 1,
        backgroundColor: bg,
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
        {c.label || 'Button'}
      </Text>
    </Pressable>
  );
}

function renderSpacer(
  colors: ReturnType<typeof useTheme>['colors'],
  scale: number,
): React.ReactElement {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: 'dashed',
        borderRadius: 6 * scale,
      }}
    >
      <Text
        style={{
          color: colors.muted,
          fontSize: 10 * scale,
          fontStyle: 'italic',
        }}
      >
        spacer
      </Text>
    </View>
  );
}

function renderDivider(
  c: DividerComponent,
  colors: ReturnType<typeof useTheme>['colors'],
  scale: number,
): React.ReactElement {
  const thickness =
    c.thickness === 'thin' ? 1 : c.thickness === 'medium' ? 2 : 4;
  const h = Math.max(thickness * scale, thickness);
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <View
        style={{
          height: h,
          backgroundColor: colors.border,
          width: '100%',
          borderRadius: h / 2,
        }}
      />
    </View>
  );
}

function renderInput(
  c: InputComponent,
  colors: ReturnType<typeof useTheme>['colors'],
  scale: number,
  value: string | undefined,
  onChange: ((value: string) => void) | undefined,
  editable: boolean,
): React.ReactElement {
  return (
    <TextInput
      value={value ?? ''}
      onChangeText={onChange}
      editable={editable}
      placeholder={c.placeholder || 'Enter text'}
      placeholderTextColor={colors.muted}
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 10 * scale,
        paddingHorizontal: 10 * scale,
        color: colors.text,
        fontSize: 15 * scale,
      }}
    />
  );
}

function renderRow(
  c: RowComponent,
  colors: ReturnType<typeof useTheme>['colors'],
  scale: number,
): React.ReactElement {
  const gap = c.gap === 'small' ? 6 : c.gap === 'large' ? 20 : 12;
  if (c.children.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.border,
          borderRadius: 10 * scale,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 11 * scale }}>
          Empty row
        </Text>
      </View>
    );
  }
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        gap: gap * scale,
        alignItems: 'stretch',
      }}
    >
      {c.children.map(child => (
        <View
          key={child.id}
          style={{
            flex: Math.max(child.width, 0.1),
            opacity: child.visible ? 1 : 0.3,
          }}
        >
          <View style={{ flex: 1 }}>
            <ChildRenderer component={child} scale={scale} colors={colors} />
          </View>
        </View>
      ))}
    </View>
  );
}

function renderMusic(
  c: MusicComponent,
  colors: ReturnType<typeof useTheme>['colors'],
  scale: number,
  playingTrackId: string | null | undefined,
  onTrackPress: ((track: MusicTrack) => void) | undefined,
  editable: boolean,
): React.ReactElement {
  if (c.tracks.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.border,
          borderRadius: 10 * scale,
          backgroundColor: colors.card,
        }}
      >
        <Ionicons
          name="musical-notes-outline"
          size={22 * scale}
          color={colors.muted}
        />
        <Text
          style={{
            color: colors.muted,
            fontSize: 11 * scale,
            marginTop: 4 * scale,
          }}
        >
          No tracks yet
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 10 * scale,
        overflow: 'hidden',
      }}
    >
      <ScrollView
        style={{ flex: 1 }}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {c.tracks.map((track, index) => {
          const isPlaying = playingTrackId === track.id;
          return (
            <Pressable
              key={track.id}
              onPress={() => {
                if (editable) return;
                onTrackPress?.(track);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 10 * scale,
                paddingVertical: 9 * scale,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: colors.border,
                backgroundColor: isPlaying ? '#E0EDFF' : 'transparent',
              }}
            >
              <View
                style={{
                  width: 26 * scale,
                  height: 26 * scale,
                  borderRadius: 13 * scale,
                  backgroundColor: isPlaying ? colors.primary : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10 * scale,
                }}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={13 * scale}
                  color={isPlaying ? '#FFFFFF' : colors.text}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 13 * scale,
                    fontWeight: '600',
                  }}
                  numberOfLines={1}
                >
                  {track.title || 'Untitled'}
                </Text>
                {c.showArtist && track.artist ? (
                  <Text
                    style={{
                      color: colors.muted,
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
                <Ionicons
                  name="volume-medium-outline"
                  size={16 * scale}
                  color={colors.primary}
                />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ChildRenderer({
  component,
  scale,
  colors,
}: {
  component: PageComponent;
  scale: number;
  colors: ReturnType<typeof useTheme>['colors'];
}): React.ReactElement | null {
  switch (component.type) {
    case 'text':
      return renderText(component, colors, scale);
    case 'image':
      return renderImage(component, colors, scale);
    case 'button':
      return renderButton(component, colors, scale);
    case 'divider':
      return renderDivider(component, colors, scale);
    case 'spacer':
      return renderSpacer(colors, scale);
    default:
      return null;
  }
}

export default function ComponentRenderer({
  component,
  scale,
  onPress,
  onInputChange,
  inputValue,
  editable = false,
  playingTrackId,
  onMusicTrackPress,
}: ComponentRendererProps): React.ReactElement | null {
  const { colors } = useTheme();

  if (!component.visible && !editable) return null;

  const opacity = component.visible ? 1 : 0.35;

  const inner = (() => {
    switch (component.type) {
      case 'text':
        return renderText(component, colors, scale);
      case 'image':
        return renderImage(component, colors, scale);
      case 'video':
        return renderVideo(component, scale);
      case 'button':
        return renderButton(component, colors, scale, onPress);
      case 'spacer':
        return renderSpacer(colors, scale);
      case 'divider':
        return renderDivider(component, colors, scale);
      case 'input':
        return renderInput(
          component,
          colors,
          scale,
          inputValue,
          onInputChange,
          editable,
        );
      case 'row':
        return renderRow(component, colors, scale);
      case 'music':
        return renderMusic(
          component,
          colors,
          scale,
          playingTrackId,
          onMusicTrackPress,
          editable,
        );
      default:
        return null;
    }
  })();

  if (!inner) return null;

  const isButton = component.type === 'button';
  const isInput = component.type === 'input';
  const isMusic = component.type === 'music';
  const isImageWithActions =
    component.type === 'image' && component.actions.length > 0;
  const isTextWithActions =
    component.type === 'text' && component.actions.length > 0;
  const isVideoWithActions = component.type === 'video';

  const interactive =
    !isButton &&
    !isInput &&
    !isMusic &&
    onPress !== undefined &&
    (isImageWithActions ||
      isTextWithActions ||
      isVideoWithActions ||
      component.type === 'spacer' ||
      component.type === 'divider' ||
      component.type === 'row');

  if (interactive) {
    return (
      <View style={{ flex: 1, opacity }}>
        <Pressable
          onPress={onPress}
          style={{ flex: 1 }}
          accessibilityRole="button"
        >
          {inner}
        </Pressable>
      </View>
    );
  }

  return <View style={{ flex: 1, opacity }}>{inner}</View>;
}