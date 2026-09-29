import React, { useCallback, useRef } from 'react';
import {
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  Pressable,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import type { PageComponent } from '@/types/component';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MIN_COMPONENT_HEIGHT,
  MIN_COMPONENT_WIDTH,
  clampToCanvas,
  type CanvasLayout,
} from '@/utils/canvas';

export type ResizeCorner = 'tl' | 'tr' | 'bl' | 'br';

export interface DraggableComponentProps {
  component: PageComponent;
  layout: CanvasLayout;
  selected: boolean;
  editable: boolean;
  onSelect: (id: string) => void;
  onChange: (
    id: string,
    next: { x: number; y: number; width: number; height: number },
  ) => void;
  onRequestEdit?: (id: string) => void;
  children: React.ReactNode;
}

const HANDLE_SIZE = 22;

export default function DraggableComponent({
  component,
  layout,
  selected,
  editable,
  onSelect,
  onChange,
  onRequestEdit,
  children,
}: DraggableComponentProps): React.ReactElement {
  const startBoxRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>({
    x: component.x,
    y: component.y,
    width: component.width,
    height: component.height,
  });

  const componentRef = useRef<PageComponent>(component);
  componentRef.current = component;

  const commit = useCallback(
    (box: { x: number; y: number; width: number; height: number }): void => {
      onChange(component.id, box);
    },
    [component.id, onChange],
  );

  const buildPanResponder = useCallback(
    (corner?: ResizeCorner) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => editable,
        onMoveShouldSetPanResponder: (
          _e: GestureResponderEvent,
          g: PanResponderGestureState,
        ) => editable && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2),
        onPanResponderGrant: () => {
          startBoxRef.current = {
            x: componentRef.current.x,
            y: componentRef.current.y,
            width: componentRef.current.width,
            height: componentRef.current.height,
          };
        },
        onPanResponderMove: (
          _e: GestureResponderEvent,
          g: PanResponderGestureState,
        ) => {
          const s = startBoxRef.current;
          const dvx = g.dx / layout.scale;
          const dvy = g.dy / layout.scale;

          if (!corner) {
            const next = clampToCanvas(
              s.x + dvx,
              s.y + dvy,
              s.width,
              s.height,
            );
            commit(next);
            return;
          }

          let nx = s.x;
          let ny = s.y;
          let nw = s.width;
          let nh = s.height;

          if (corner === 'tl') {
            nx = s.x + dvx;
            ny = s.y + dvy;
            nw = s.width - dvx;
            nh = s.height - dvy;
          } else if (corner === 'tr') {
            ny = s.y + dvy;
            nw = s.width + dvx;
            nh = s.height - dvy;
          } else if (corner === 'bl') {
            nx = s.x + dvx;
            nw = s.width - dvx;
            nh = s.height + dvy;
          } else {
            nw = s.width + dvx;
            nh = s.height + dvy;
          }

          if (nw < MIN_COMPONENT_WIDTH) {
            if (corner === 'tl' || corner === 'bl') {
              nx = s.x + (s.width - MIN_COMPONENT_WIDTH);
            }
            nw = MIN_COMPONENT_WIDTH;
          }
          if (nh < MIN_COMPONENT_HEIGHT) {
            if (corner === 'tl' || corner === 'tr') {
              ny = s.y + (s.height - MIN_COMPONENT_HEIGHT);
            }
            nh = MIN_COMPONENT_HEIGHT;
          }

          const clamped = clampToCanvas(nx, ny, nw, nh);
          commit(clamped);
        },
      }),
    [commit, editable, layout.scale],
  );

  const dragResponderRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: () => false,
    }),
  );
  dragResponderRef.current = buildPanResponder();

  const tlResponderRef = useRef(dragResponderRef.current);
  const trResponderRef = useRef(dragResponderRef.current);
  const blResponderRef = useRef(dragResponderRef.current);
  const brResponderRef = useRef(dragResponderRef.current);

  tlResponderRef.current = buildPanResponder('tl');
  trResponderRef.current = buildPanResponder('tr');
  blResponderRef.current = buildPanResponder('bl');
  brResponderRef.current = buildPanResponder('br');

  const left = layout.offsetX + component.x * layout.scale;
  const top = layout.offsetY + component.y * layout.scale;
  const width = component.width * layout.scale;
  const height = component.height * layout.scale;

  const handleTouch = useCallback(
    (e: GestureResponderEvent) => {
      e.stopPropagation();
    },
    [],
  );

  const handlePress = useCallback(() => {
    if (!editable) return;
    onSelect(component.id);
  }, [component.id, editable, onSelect]);

  const handleLongPress = useCallback(() => {
    if (!editable) return;
    onSelect(component.id);
    onRequestEdit?.(component.id);
  }, [component.id, editable, onRequestEdit, onSelect]);

  const handleLayout = useCallback((_e: LayoutChangeEvent) => undefined, []);

  return (
    <View
      onLayout={handleLayout}
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        zIndex: component.zIndex,
      }}
      pointerEvents={editable ? 'auto' : 'box-none'}
    >
      <View
        {...(editable ? dragResponderRef.current.panHandlers : {})}
        style={{ flex: 1 }}
      >
        <Pressable
          onPress={handlePress}
          onLongPress={editable ? handleLongPress : undefined}
          delayLongPress={400}
          style={{ flex: 1 }}
        >
          {children}
        </Pressable>
      </View>

      {editable && selected ? (
        <>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: -2,
              top: -2,
              right: -2,
              bottom: -2,
              borderWidth: 2,
              borderColor: '#2563EB',
              borderRadius: 4,
            }}
          />
          <View
            {...tlResponderRef.current.panHandlers}
            onStartShouldSetResponder={handleTouch}
            style={handleStyle('tl')}
          />
          <View
            {...trResponderRef.current.panHandlers}
            onStartShouldSetResponder={handleTouch}
            style={handleStyle('tr')}
          />
          <View
            {...blResponderRef.current.panHandlers}
            onStartShouldSetResponder={handleTouch}
            style={handleStyle('bl')}
          />
          <View
            {...brResponderRef.current.panHandlers}
            onStartShouldSetResponder={handleTouch}
            style={handleStyle('br')}
          />
        </>
      ) : null}
    </View>
  );
}

function handleStyle(corner: ResizeCorner): {
  position: 'absolute';
  width: number;
  height: number;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
} {
  const base = {
    position: 'absolute' as const,
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    backgroundColor: '#FFFFFF',
    borderColor: '#2563EB',
    borderWidth: 2,
    borderRadius: HANDLE_SIZE / 2,
  };

  if (corner === 'tl') {
    return {
      ...base,
      left: -HANDLE_SIZE / 2,
      top: -HANDLE_SIZE / 2,
    };
  }
  if (corner === 'tr') {
    return {
      ...base,
      right: -HANDLE_SIZE / 2,
      top: -HANDLE_SIZE / 2,
    };
  }
  if (corner === 'bl') {
    return {
      ...base,
      left: -HANDLE_SIZE / 2,
      bottom: -HANDLE_SIZE / 2,
    };
  }
  return {
    ...base,
    right: -HANDLE_SIZE / 2,
    bottom: -HANDLE_SIZE / 2,
  };
}