import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import type { PageComponent, SizePreset } from '../../src/types/component';
import type { Page } from '../../src/types/project';

export interface RuntimeRendererProps {
  page: Page;
  variables: Record<string, string>;
  hiddenComponentIds: Record<string, boolean>;
  onComponentPress: (component: PageComponent) => void;
  onInputChange: (componentId: string, value: string) => void;
}

const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 780;

interface CanvasLayout {
  scale: number;
  offsetX: number;
  offsetY: number;
  canvasWidth: number;
  canvasHeight: number;
}

function computeLayout(screenW: number, screenH: number): CanvasLayout {
  const scale = Math.min(screenW / CANVAS_WIDTH, screenH / CANVAS_HEIGHT);
  const canvasWidth = CANVAS_WIDTH * scale;
  const canvasHeight = CANVAS_HEIGHT * scale;
  const offsetX = (screenW - canvasWidth) / 2;
  const offsetY = (screenH - canvasHeight) / 2;
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
    case 'text':
      return (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: 4 * scale,
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

    case 'image': {
      const radius = component.rounded ? 12 * scale : 0;
      if (!component.uri) {
        return (
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
      }
      return (
        <Image
          source={{ uri: component.uri }}
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            borderRadius: radius,
          }}
          resizeMode="cover"
        />
      );
    }

    case 'video':
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
              marginTop: 4 * scale,
              paddingHorizontal: 8 * scale,
              textAlign: 'center',
            }}
            numberOfLines={2}
          >
            {component.url || 'Video'}
          </Text>
        </Pressable>
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
                flex: Math.max(child.width, 1),
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
    <View
      onLayout={handleLayout}
      style={{ flex: 1, overflow: 'hidden' }}
    >
      {layout ? (
        <View
          style={{
            position: 'absolute',
            left: layout.offsetX,
            top: layout.offsetY,
            width: layout.canvasWidth,
            height: layout.canvasHeight,
            overflow: 'hidden',
          }}
        >
          {sortedComponents.map(component => {
            if (!component.visible) return null;
            if (hiddenComponentIds[component.id]) return null;

            const left = component.x * layout.scale;
            const top = component.y * layout.scale;
            const width = component.width * layout.scale;
            const height = component.height * layout.scale;

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
      ) : null}
    </View>
  );
}