import React, { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import type { Page } from '@/types/project';
import type { PageComponent } from '@/types/component';
import ComponentRenderer from '@/components/ComponentRenderer';
import DraggableComponent from '@/components/DraggableComponent';
import { computeCanvasLayout, type CanvasLayout } from '@/utils/canvas';

export interface PageViewRendererProps {
  page: Page;
  editable?: boolean;
  selectedComponentId?: string | null;
  onSelectComponent?: (id: string | null) => void;
  onComponentPress?: (component: PageComponent) => void;
  onComponentChange?: (
    id: string,
    next: { x: number; y: number; width: number; height: number },
  ) => void;
  onRequestEdit?: (id: string) => void;
  onInputChange?: (componentId: string, value: string) => void;
  inputValues?: Record<string, string>;
  hiddenComponentIds?: Record<string, boolean>;
  canvasBackgroundColor?: string;
}

export default function PageViewRenderer({
  page,
  editable = false,
  selectedComponentId = null,
  onSelectComponent,
  onComponentPress,
  onComponentChange,
  onRequestEdit,
  onInputChange,
  inputValues,
  hiddenComponentIds,
  canvasBackgroundColor,
}: PageViewRendererProps): React.ReactElement {
  const [containerSize, setContainerSize] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });

  const layout: CanvasLayout | null = useMemo(() => {
    if (containerSize.width === 0 || containerSize.height === 0) return null;
    return computeCanvasLayout(containerSize.width, containerSize.height);
  }, [containerSize]);

  const handleLayout = (e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== containerSize.width || height !== containerSize.height) {
      setContainerSize({ width, height });
    }
  };

  const sortedComponents = useMemo(() => {
    return [...page.components].sort((a, b) => a.zIndex - b.zIndex);
  }, [page.components]);

  return (
    <View
      onLayout={handleLayout}
      style={{ flex: 1, overflow: 'visible' }}
    >
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
              if (hiddenComponentIds?.[component.id]) return null;

              const content = (
                <ComponentRenderer
                  component={component}
                  scale={layout.scale}
                  onPress={
                    !editable && onComponentPress
                      ? () => onComponentPress(component)
                      : undefined
                  }
                  onInputChange={
                    onInputChange
                      ? value => onInputChange(component.id, value)
                      : undefined
                  }
                  inputValue={
                    component.type === 'input'
                      ? inputValues?.[component.variableKey]
                      : undefined
                  }
                  editable={!editable}
                />
              );

              if (editable) {
                return (
                  <DraggableComponent
                    key={component.id}
                    component={component}
                    layout={layout}
                    selected={selectedComponentId === component.id}
                    editable={editable}
                    onSelect={id => onSelectComponent?.(id)}
                    onChange={(id, next) => onComponentChange?.(id, next)}
                    onChangeEnd={(id, next) => onComponentChange?.(id, next)}
                    onRequestEdit={id => onRequestEdit?.(id)}
                  >
                    {content}
                  </DraggableComponent>
                );
              }

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
                  {content}
                </View>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}