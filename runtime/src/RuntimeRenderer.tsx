import React from 'react';
import {
  Image,
  Pressable,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
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

function alignSelf(
  align: 'left' | 'center' | 'right',
): 'flex-start' | 'center' | 'flex-end' {
  if (align === 'left') return 'flex-start';
  if (align === 'right') return 'flex-end';
  return 'center';
}

function renderComponent(
  component: PageComponent,
  variables: Record<string, string>,
  onComponentPress: (component: PageComponent) => void,
  onInputChange: (componentId: string, value: string) => void,
): React.ReactElement | null {
  if (!component.visible) return null;

  switch (component.type) {
    case 'text':
      return (
        <Text
          style={{
            fontSize: fontSizeFor(component.fontSize),
            textAlign: component.align,
            fontWeight: component.bold ? '700' : '400',
            color: component.color ?? '#0F172A',
          }}
        >
          {component.content || ' '}
        </Text>
      );

    case 'image': {
      const style =
        component.size === 'full'
          ? { width: '100%' as const, aspectRatio: 16 / 9 }
          : {
              width:
                component.size === 'small'
                  ? 120
                  : component.size === 'medium'
                  ? 200
                  : 300,
              aspectRatio: 16 / 9,
            };
      if (!component.uri) {
        return (
          <View
            style={[
              style,
              {
                backgroundColor: '#E2E8F0',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: component.rounded ? 12 : 0,
              },
            ]}
          >
            <Text style={{ color: '#64748B', fontSize: 12 }}>No image</Text>
          </View>
        );
      }
      return (
        <Image
          source={{ uri: component.uri }}
          style={[style, { borderRadius: component.rounded ? 12 : 0 }]}
          resizeMode="cover"
        />
      );
    }

    case 'video':
      return (
        <Pressable
          onPress={() => onComponentPress(component)}
          style={{
            width: '100%',
            aspectRatio: 16 / 9,
            backgroundColor: '#000000',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 12,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 40 }}>▶</Text>
          <Text
            style={{
              color: '#E2E8F0',
              fontSize: 12,
              marginTop: 8,
              paddingHorizontal: 12,
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
          onPress={() => onComponentPress(component)}
          style={{
            backgroundColor:
              component.variant === 'primary'
                ? '#2563EB'
                : component.variant === 'danger'
                ? '#EF4444'
                : '#64748B',
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: 12,
            alignSelf: alignSelf(component.align),
            minWidth: component.size === 'full' ? '100%' : undefined,
          }}
          accessibilityRole="button"
        >
          <Text
            style={{
              color: '#FFFFFF',
              fontSize: fontSizeFor(component.size),
              fontWeight: '600',
              textAlign: 'center',
            }}
          >
            {component.label || 'Button'}
          </Text>
        </Pressable>
      );

    case 'spacer':
      return <View style={{ height: spacerHeight(component.size) }} />;

    case 'divider': {
      const height =
        component.thickness === 'thin'
          ? 1
          : component.thickness === 'medium'
          ? 2
          : 4;
      return (
        <View
          style={{
            height,
            backgroundColor: '#E2E8F0',
            width: '100%',
            borderRadius: height / 2,
          }}
        />
      );
    }

    case 'input':
      return (
        <TextInput
          value={variables[component.variableKey] ?? ''}
          onChangeText={value => onInputChange(component.id, value)}
          placeholder={component.placeholder || 'Enter text'}
          placeholderTextColor="#94A3B8"
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#E2E8F0',
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: '#0F172A',
            fontSize: 16,
          }}
        />
      );

    case 'row': {
      const gap =
        component.gap === 'small' ? 6 : component.gap === 'large' ? 20 : 12;
      return (
        <View style={{ flexDirection: 'row', gap, alignItems: 'center' }}>
          {component.children.map(child => (
            <View key={child.id} style={{ flex: 1 }}>
              {renderComponent(
                child,
                variables,
                onComponentPress,
                onInputChange,
              )}
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
  return (
    <View style={{ width: '100%', paddingHorizontal: 16 }}>
      {page.components.map(component => {
        if (hiddenComponentIds[component.id]) return null;
        return (
          <View key={component.id} style={{ marginBottom: 16 }}>
            {renderComponent(
              component,
              variables,
              onComponentPress,
              onInputChange,
            )}
          </View>
        );
      })}
    </View>
  );
}