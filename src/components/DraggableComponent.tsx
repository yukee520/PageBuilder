import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { PageComponent } from '@/types/component';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MIN_COMPONENT_HEIGHT,
  MIN_COMPONENT_WIDTH,
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
  onChangeEnd?: (
    id: string,
    next: { x: number; y: number; width: number; height: number },
  ) => void;
  onRequestEdit?: (id: string) => void;
  children: React.ReactNode;
}

const HANDLE_SIZE = 28;
const EDGE_OVERSHOOT = 200;

interface BoxSnapshot {
  x: number;
  y: number;
  width: number;
  height: number;
}

function clampBox(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  const w = Math.max(MIN_COMPONENT_WIDTH, Math.min(width, CANVAS_WIDTH));
  const h = Math.max(MIN_COMPONENT_HEIGHT, Math.min(height, CANVAS_HEIGHT));
  const minX = -EDGE_OVERSHOOT;
  const minY = -EDGE_OVERSHOOT;
  const maxX = CANVAS_WIDTH - w + EDGE_OVERSHOOT;
  const maxY = CANVAS_HEIGHT - h + EDGE_OVERSHOOT;
  return {
    x: Math.max(minX, Math.min(x, maxX)),
    y: Math.max(minY, Math.min(y, maxY)),
    width: w,
    height: h,
  };
}

export default function DraggableComponent({
  component,
  layout,
  selected,
  editable,
  onSelect,
  onChange,
  onChangeEnd,
  onRequestEdit,
  children,
}: DraggableComponentProps): React.ReactElement {
  const [dbg, setDbg] = useState<string>('idle');

  const snapshotRef = useRef<BoxSnapshot>({
    x: component.x,
    y: component.y,
    width: component.width,
    height: component.height,
  });

  const dragBaseRef = useRef<BoxSnapshot>({
    x: component.x,
    y: component.y,
    width: component.width,
    height: component.height,
  });

  const resizeBaseRef = useRef<BoxSnapshot>({
    x: component.x,
    y: component.y,
    width: component.width,
    height: component.height,
  });

  useEffect(() => {
    snapshotRef.current = {
      x: component.x,
      y: component.y,
      width: component.width,
      height: component.height,
    };
  }, [component.x, component.y, component.width, component.height]);

  const layoutRef = useRef<CanvasLayout>(layout);
  layoutRef.current = layout;

  const componentIdRef = useRef<string>(component.id);
  componentIdRef.current = component.id;

  const editableRef = useRef<boolean>(editable);
  editableRef.current = editable;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onChangeEndRef = useRef(onChangeEnd);
  onChangeEndRef.current = onChangeEnd;

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const onRequestEditRef = useRef(onRequestEdit);
  onRequestEditRef.current = onRequestEdit;

  const handleDragBegin = useCallback((): void => {
    if (!editableRef.current) return;
    onSelectRef.current(componentIdRef.current);
    dragBaseRef.current = { ...snapshotRef.current };
    setDbg('DRAG START');
  }, []);

  const handleDragUpdate = useCallback(
    (dxPx: number, dyPx: number): void => {
      const scale = layoutRef.current.scale;
      const base = dragBaseRef.current;
      const next = clampBox(
        base.x + dxPx / scale,
        base.y + dyPx / scale,
        base.width,
        base.height,
      );
      setDbg(
        `DRAG dx=${Math.round(dxPx)} dy=${Math.round(dyPx)} x=${Math.round(
          next.x,
        )} y=${Math.round(next.y)}`,
      );
      onChangeRef.current(componentIdRef.current, next);
    },
    [],
  );

  const handleDragEnd = useCallback((): void => {
    const current = {
      ...snapshotRef.current,
    };
    setDbg('DRAG END');
    onChangeEndRef.current?.(componentIdRef.current, current);
  }, []);

  const handleResizeBegin = useCallback((): void => {
    if (!editableRef.current) return;
    onSelectRef.current(componentIdRef.current);
    resizeBaseRef.current = { ...snapshotRef.current };
    setDbg('RESIZE START');
  }, []);

  const handleResizeUpdate = useCallback(
    (corner: ResizeCorner, dxPx: number, dyPx: number): void => {
      const scale = layoutRef.current.scale;
      const base = resizeBaseRef.current;
      const dvx = dxPx / scale;
      const dvy = dyPx / scale;

      let nx = base.x;
      let ny = base.y;
      let nw = base.width;
      let nh = base.height;

      if (corner === 'tl') {
        nx = base.x + dvx;
        ny = base.y + dvy;
        nw = base.width - dvx;
        nh = base.height - dvy;
      } else if (corner === 'tr') {
        ny = base.y + dvy;
        nw = base.width + dvx;
        nh = base.height - dvy;
      } else if (corner === 'bl') {
        nx = base.x + dvx;
        nw = base.width - dvx;
        nh = base.height + dvy;
      } else {
        nw = base.width + dvx;
        nh = base.height + dvy;
      }

      if (nw < MIN_COMPONENT_WIDTH) {
        if (corner === 'tl' || corner === 'bl') {
          nx = base.x + (base.width - MIN_COMPONENT_WIDTH);
        }
        nw = MIN_COMPONENT_WIDTH;
      }
      if (nh < MIN_COMPONENT_HEIGHT) {
        if (corner === 'tl' || corner === 'tr') {
          ny = base.y + (base.height - MIN_COMPONENT_HEIGHT);
        }
        nh = MIN_COMPONENT_HEIGHT;
      }

      const next = {
        x: nx,
        y: ny,
        width: nw,
        height: nh,
      };
      setDbg(
        `RESIZE dx=${Math.round(dxPx)} w=${Math.round(nw)} h=${Math.round(nh)}`,
      );
      onChangeRef.current(componentIdRef.current, next);
    },
    [],
  );

  const handleResizeEnd = useCallback((): void => {
    const current = { ...snapshotRef.current };
    setDbg('RESIZE END');
    onChangeEndRef.current?.(componentIdRef.current, current);
  }, []);

  const makeDragGesture = useCallback(() => {
    return Gesture.Pan()
      .enabled(editable)
      .minDistance(2)
      .onBegin(() => {
        runOnJS(handleDragBegin)();
      })
      .onUpdate(event => {
        runOnJS(handleDragUpdate)(event.translationX, event.translationY);
      })
      .onEnd(() => {
        runOnJS(handleDragEnd)();
      })
      .onFinalize(() => {
        runOnJS(handleDragEnd)();
      });
  }, [editable, handleDragBegin, handleDragUpdate, handleDragEnd]);

  const makeResizeGesture = useCallback(
    (corner: ResizeCorner) => {
      return Gesture.Pan()
        .enabled(editable)
        .minDistance(2)
        .onBegin(() => {
          runOnJS(handleResizeBegin)();
        })
        .onUpdate(event => {
          runOnJS(handleResizeUpdate)(
            corner,
            event.translationX,
            event.translationY,
          );
        })
        .onEnd(() => {
          runOnJS(handleResizeEnd)();
        })
        .onFinalize(() => {
          runOnJS(handleResizeEnd)();
        });
    },
    [editable, handleResizeBegin, handleResizeUpdate, handleResizeEnd],
  );

  const dragGesture = makeDragGesture();
  const tlGesture = makeResizeGesture('tl');
  const trGesture = makeResizeGesture('tr');
  const blGesture = makeResizeGesture('bl');
  const brGesture = makeResizeGesture('br');

  const left = layout.offsetX + component.x * layout.scale;
  const top = layout.offsetY + component.y * layout.scale;
  const width = component.width * layout.scale;
  const height = component.height * layout.scale;

  const handleLongPress = useCallback((): void => {
    if (!editableRef.current) return;
    onSelectRef.current(componentIdRef.current);
    onRequestEditRef.current?.(componentIdRef.current);
  }, []);

  const handleTap = useCallback((): void => {
    if (!editableRef.current) return;
    onSelectRef.current(componentIdRef.current);
  }, []);

  return (
    <View
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        zIndex: component.zIndex,
      }}
      pointerEvents="box-none"
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -22,
          left: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          paddingHorizontal: 4,
          paddingVertical: 1,
          borderRadius: 3,
          zIndex: 9999,
        }}
      >
        <Text style={{ color: '#FFF', fontSize: 9 }}>{dbg}</Text>
      </View>

      {editable ? (
        <GestureDetector gesture={dragGesture}>
          <View style={{ flex: 1 }} collapsable={false}>
            <Pressable
              onPress={handleTap}
              onLongPress={handleLongPress}
              delayLongPress={450}
              style={{ flex: 1 }}
            >
              {children}
            </Pressable>
          </View>
        </GestureDetector>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}

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
          <GestureDetector gesture={tlGesture}>
            <View
              style={handleStyle('tl')}
              hitSlop={{ top: 12, left: 12, bottom: 12, right: 12 }}
              collapsable={false}
            />
          </GestureDetector>
          <GestureDetector gesture={trGesture}>
            <View
              style={handleStyle('tr')}
              hitSlop={{ top: 12, left: 12, bottom: 12, right: 12 }}
              collapsable={false}
            />
          </GestureDetector>
          <GestureDetector gesture={blGesture}>
            <View
              style={handleStyle('bl')}
              hitSlop={{ top: 12, left: 12, bottom: 12, right: 12 }}
              collapsable={false}
            />
          </GestureDetector>
          <GestureDetector gesture={brGesture}>
            <View
              style={handleStyle('br')}
              hitSlop={{ top: 12, left: 12, bottom: 12, right: 12 }}
              collapsable={false}
            />
          </GestureDetector>
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