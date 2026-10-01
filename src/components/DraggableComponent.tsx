import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { PageComponent } from '@/types/component';
import {
  MIN_COMPONENT_HEIGHT_FRAC,
  MIN_COMPONENT_WIDTH_FRAC,
  clampFractionBox,
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

const HANDLE_SIZE = 26;

interface BoxSnapshot {
  x: number;
  y: number;
  width: number;
  height: number;
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

  const componentRef = useRef<PageComponent>(component);
  componentRef.current = component;

  const layoutRef = useRef<CanvasLayout>(layout);
  layoutRef.current = layout;

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

  const isGesturingRef = useRef<boolean>(false);

  const [live, setLive] = useState<BoxSnapshot>({
    x: component.x,
    y: component.y,
    width: component.width,
    height: component.height,
  });

  useEffect(() => {
    if (isGesturingRef.current) return;
    setLive(prev => {
      const next = {
        x: component.x,
        y: component.y,
        width: component.width,
        height: component.height,
      };
      if (
        prev.x === next.x &&
        prev.y === next.y &&
        prev.width === next.width &&
        prev.height === next.height
      ) {
        return prev;
      }
      return next;
    });
  }, [component.x, component.y, component.width, component.height]);

  const handleDragBegin = useCallback((): void => {
    if (!editableRef.current) return;
    onSelectRef.current(componentRef.current.id);
    dragBaseRef.current = {
      x: componentRef.current.x,
      y: componentRef.current.y,
      width: componentRef.current.width,
      height: componentRef.current.height,
    };
    isGesturingRef.current = true;
    setDbg('DRAG START');
  }, []);

  const handleDragUpdate = useCallback((dxPx: number, dyPx: number): void => {
    const l = layoutRef.current;
    const base = dragBaseRef.current;
    const dxFrac = dxPx / l.canvasWidth;
    const dyFrac = dyPx / l.canvasHeight;

    const next = clampFractionBox(
      base.x + dxFrac,
      base.y + dyFrac,
      base.width,
      base.height,
    );
    setLive(next);
    setDbg(`DRAG x=${(next.x * 100).toFixed(0)}%`);
    onChangeRef.current(componentRef.current.id, next);
  }, []);

  const handleDragEnd = useCallback((): void => {
    isGesturingRef.current = false;
    const current = { ...dragBaseRef.current };
    setDbg('DRAG END');
    onChangeEndRef.current?.(componentRef.current.id, current);
  }, []);

  const handleResizeBegin = useCallback((): void => {
    if (!editableRef.current) return;
    onSelectRef.current(componentRef.current.id);
    resizeBaseRef.current = {
      x: componentRef.current.x,
      y: componentRef.current.y,
      width: componentRef.current.width,
      height: componentRef.current.height,
    };
    isGesturingRef.current = true;
    setDbg('RESIZE START');
  }, []);

  const handleResizeUpdate = useCallback(
    (corner: ResizeCorner, dxPx: number, dyPx: number): void => {
      const l = layoutRef.current;
      const base = resizeBaseRef.current;
      const dxFrac = dxPx / l.canvasWidth;
      const dyFrac = dyPx / l.canvasHeight;

      let nx = base.x;
      let ny = base.y;
      let nw = base.width;
      let nh = base.height;

      if (corner === 'tl') {
        nx = base.x + dxFrac;
        ny = base.y + dyFrac;
        nw = base.width - dxFrac;
        nh = base.height - dyFrac;
      } else if (corner === 'tr') {
        ny = base.y + dyFrac;
        nw = base.width + dxFrac;
        nh = base.height - dyFrac;
      } else if (corner === 'bl') {
        nx = base.x + dxFrac;
        nw = base.width - dxFrac;
        nh = base.height + dyFrac;
      } else {
        nw = base.width + dxFrac;
        nh = base.height + dyFrac;
      }

      if (nw < MIN_COMPONENT_WIDTH_FRAC) {
        if (corner === 'tl' || corner === 'bl') {
          nx = base.x + (base.width - MIN_COMPONENT_WIDTH_FRAC);
        }
        nw = MIN_COMPONENT_WIDTH_FRAC;
      }
      if (nh < MIN_COMPONENT_HEIGHT_FRAC) {
        if (corner === 'tl' || corner === 'tr') {
          ny = base.y + (base.height - MIN_COMPONENT_HEIGHT_FRAC);
        }
        nh = MIN_COMPONENT_HEIGHT_FRAC;
      }

      const next = { x: nx, y: ny, width: nw, height: nh };
      setLive(next);
      setDbg(`RESIZE w=${(nw * 100).toFixed(0)}% h=${(nh * 100).toFixed(0)}%`);
      onChangeRef.current(componentRef.current.id, next);
    },
    [],
  );

  const handleResizeEnd = useCallback((): void => {
    isGesturingRef.current = false;
    const current = { ...resizeBaseRef.current };
    setDbg('RESIZE END');
    onChangeEndRef.current?.(componentRef.current.id, current);
  }, []);

  const dragGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(2)
        .onBegin(() => {
          if (!editableRef.current) return;
          runOnJS(handleDragBegin)();
        })
        .onUpdate(event => {
          if (!editableRef.current) return;
          runOnJS(handleDragUpdate)(event.translationX, event.translationY);
        })
        .onEnd(() => {
          if (!editableRef.current) return;
          runOnJS(handleDragEnd)();
        }),
    [handleDragBegin, handleDragUpdate, handleDragEnd],
  );

  const tlGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(2)
        .onBegin(() => {
          if (!editableRef.current) return;
          runOnJS(handleResizeBegin)();
        })
        .onUpdate(event => {
          if (!editableRef.current) return;
          runOnJS(handleResizeUpdate)(
            'tl',
            event.translationX,
            event.translationY,
          );
        })
        .onEnd(() => {
          if (!editableRef.current) return;
          runOnJS(handleResizeEnd)();
        }),
    [handleResizeBegin, handleResizeUpdate, handleResizeEnd],
  );

  const trGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(2)
        .onBegin(() => {
          if (!editableRef.current) return;
          runOnJS(handleResizeBegin)();
        })
        .onUpdate(event => {
          if (!editableRef.current) return;
          runOnJS(handleResizeUpdate)(
            'tr',
            event.translationX,
            event.translationY,
          );
        })
        .onEnd(() => {
          if (!editableRef.current) return;
          runOnJS(handleResizeEnd)();
        }),
    [handleResizeBegin, handleResizeUpdate, handleResizeEnd],
  );

  const blGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(2)
        .onBegin(() => {
          if (!editableRef.current) return;
          runOnJS(handleResizeBegin)();
        })
        .onUpdate(event => {
          if (!editableRef.current) return;
          runOnJS(handleResizeUpdate)(
            'bl',
            event.translationX,
            event.translationY,
          );
        })
        .onEnd(() => {
          if (!editableRef.current) return;
          runOnJS(handleResizeEnd)();
        }),
    [handleResizeBegin, handleResizeUpdate, handleResizeEnd],
  );

  const brGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(2)
        .onBegin(() => {
          if (!editableRef.current) return;
          runOnJS(handleResizeBegin)();
        })
        .onUpdate(event => {
          if (!editableRef.current) return;
          runOnJS(handleResizeUpdate)(
            'br',
            event.translationX,
            event.translationY,
          );
        })
        .onEnd(() => {
          if (!editableRef.current) return;
          runOnJS(handleResizeEnd)();
        }),
    [handleResizeBegin, handleResizeUpdate, handleResizeEnd],
  );

  const left = live.x * layout.canvasWidth;
  const top = live.y * layout.canvasHeight;
  const width = Math.max(live.width * layout.canvasWidth, 8);
  const height = Math.max(live.height * layout.canvasHeight, 8);

  const handleLongPress = useCallback((): void => {
    if (!editableRef.current) return;
    onSelectRef.current(componentRef.current.id);
    onRequestEditRef.current?.(componentRef.current.id);
  }, []);

  const handleTap = useCallback((): void => {
    if (!editableRef.current) return;
    onSelectRef.current(componentRef.current.id);
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
<Text style={{ color: '#0F0', fontSize: 9 }}>
  store: w={(component.width * 100).toFixed(0)}% h=
  {(component.height * 100).toFixed(0)}%
</Text>
<Text style={{ color: '#FF0', fontSize: 9 }}>
  live:  w={(live.width * 100).toFixed(0)}% h=
  {(live.height * 100).toFixed(0)}%
</Text>
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