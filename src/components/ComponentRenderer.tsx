import React, { useMemo } from 'react';
import {
  Image,
  Pressable,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type {
  ButtonComponent,
  DividerComponent,
  ImageComponent,
  InputComponent,
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
  onPress?: (event: GestureResponderEvent) => void;
  onInputChange?: (value: string) => void;
  inputValue?: string;
  editable?: boolean;
}

function sizeToPadding(size: SizePreset): number {
  switch (size) {
    case 'small':
      return 6;
    case 'medium':
      return 12;
    case 'large':
      return 20;
    case 'full':
      return 0;
    default:
      return 12;
  }
}

function spacerHeight(size: SizePreset): number {
  switch (size) {
    case 'small':
      return 8;
    case 'medium':
      return 16;
    case 'large':
      return 32;
    case 'full':
      return 48;
    default:
      return 16;
  }
}

function fontSizeFor(size: SizePreset): number {
  switch (size) {
    case 'small':
      return 12;
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

function widthFor(size: SizePreset, parentWidth: number | null): number | undefined {
  if (size === 'small') return 120;
  if (size === 'medium') return 200;
  if (size === 'large') return 300;
  if (size === 'full' && parentWidth) return parentWidth;
  return undefined;
}

function alignSelf(align: 'left' | 'center' | 'right'): 'flex-start' | 'center' | 'flex-end' {
  if (align === 'left') return 'flex-start';
  if (align === 'right') return 'flex-end';
  return 'center';
}

function renderText(
  c: TextComponent,
  colors: ReturnType<typeof useTheme>['colors'],
): React.ReactElement {
  return (
    <Text
      style={{
        fontSize: fontSizeFor(c.fontSize),
        textAlign: c.align,
        fontWeight: c.bold ? '700' : '400',
        color: c.color ?? colors.text,
      }}
    >
      {c.content || ' '}
    </Text>
  );
}

function renderImage(c: ImageComponent): React.ReactElement {
  const aspect = 16 / 9;
  const style =
    c.size === 'full'
      ? { width: '100%' as const, aspectRatio: aspect }
      : { width: c.size === 'small' ? 120 : c.size === 'medium' ? 200 : 300, aspectRatio: aspect };

  if (!c.uri) {
    return (
      <View
        className="bg-border dark:bg-dark-border items-center justify-center rounded-xl"
        style={style}
      >
        <Ionicons name="image-outline" size={32} color="#94A3B8" />
        <Text className="text-xs text-muted dark:text-dark-muted mt-1">
          No image
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: c.uri }}
      style={[style, { borderRadius: c.rounded ? 12 : 0 }]}
      resizeMode="cover"
    />
  );
}

function renderVideo(
  c: VideoComponent,
  colors: ReturnType<typeof useTheme>['colors'],
): React.ReactElement {
  return (
    <View
      className="bg-black items-center justify-center rounded-xl"
      style={{ width: '100%', aspectRatio: 16 / 9 }}
    >
      <Ionicons name="play-circle" size={48} color="#FFFFFF" />
      <Text
        className="text-xs mt-2 px-3 text-center"
        style={{ color: '#E2E8F0' }}
        numberOfLines={2}
      >
        {c.url ? c.url : 'No video URL set'}
      </Text>
      {c.autoPlay ? (
        <Text
          className="text-[10px] mt-1"
          style={{ color: colors.muted }}
        >
          Autoplay enabled
        </Text>
      ) : null}
    </View>
  );
}

function renderButton(
  c: ButtonComponent,
  colors: ReturnType<typeof useTheme>['colors'],
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
        backgroundColor: bg,
        paddingVertical: sizeToPadding(c.size),
        paddingHorizontal: sizeToPadding(c.size) * 2,
        borderRadius: 12,
        alignSelf: alignSelf(c.align),
        minWidth: c.size === 'full' ? '100%' : undefined,
      }}
      accessibilityRole="button"
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: fontSizeFor(c.size),
          fontWeight: '600',
          textAlign: 'center',
        }}
      >
        {c.label || 'Button'}
      </Text>
    </Pressable>
  );
}

function renderSpacer(c: SpacerComponent): React.ReactElement {
  return <View style={{ height: spacerHeight(c.size) }} />;
}

function renderDivider(
  c: DividerComponent,
  colors: ReturnType<typeof useTheme>['colors'],
): React.ReactElement {
  const height = c.thickness === 'thin' ? 1 : c.thickness === 'medium' ? 2 : 4;
  return (
    <View
      style={{
        height,
        backgroundColor: colors.border,
        width: '100%',
        borderRadius: height / 2,
      }}
    />
  );
}

function renderInput(
  c: InputComponent,
  colors: ReturnType<typeof useTheme>['colors'],
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
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: colors.text,
        fontSize: 16,
      }}
    />
  );
}

export default function ComponentRenderer({
  component,
  onPress,
  onInputChange,
  inputValue,
  editable = false,
}: ComponentRendererProps): React.ReactElement | null {
  const { colors } = useTheme();

  const inner = useMemo((): React.ReactElement | null => {
    switch (component.type) {
      case 'text':
        return renderText(component, colors);
      case 'image':
        return renderImage(component);
      case 'video':
        return renderVideo(component, colors);
      case 'button':
        return renderButton(component, colors, onPress);
      case 'spacer':
        return renderSpacer(component);
      case 'divider':
        return renderDivider(component, colors);
      case 'input':
        return renderInput(component, colors, inputValue, onInputChange, editable);
      case 'row':
        return renderRow(component, colors, onPress, onInputChange, inputValue, editable);
      default:
        return null;
    }
  }, [
    component,
    colors,
    onPress,
    onInputChange,
    inputValue,
    editable,
  ]);

  if (!component.visible) return null;
  if (!inner) return null;

  const isButton = component.type === 'button';
  const isInput = component.type === 'input';
  const interactive = !isButton && !isInput && onPress !== undefined;

  if (interactive) {
    return (
      <Pressable
        onPress={onPress}
        style={{ width: '100%' }}
        accessibilityRole="button"
      >
        {inner}
      </Pressable>
    );
  }

  return inner;
}

function renderRow(
  c: RowComponent,
  colors: ReturnType<typeof useTheme>['colors'],
  onPress: ((event: GestureResponderEvent) => void) | undefined,
  onInputChange: ((value: string) => void) | undefined,
  inputValue: string | undefined,
  editable: boolean,
): React.ReactElement {
  const gap = c.gap === 'small' ? 6 : c.gap === 'large' ? 20 : 12;
  return (
    <View style={{ flexDirection: 'row', gap, alignItems: 'center' }}>
      {c.children.map(child => (
        <View key={child.id} style={{ flex: 1 }}>
          <ComponentRenderer
            component={child}
            onPress={onPress}
            onInputChange={onInputChange}
            inputValue={inputValue}
            editable={editable}
          />
        </View>
      ))}
      {c.children.length === 0 ? (
        <View
          style={{
            flex: 1,
            borderStyle: 'dashed',
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Empty row
          </Text>
        </View>
      ) : null}
    </View>
  );
}