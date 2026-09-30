import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  Text,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import type { PageComponent } from '@/types/component';
import {
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

  const componentIdRef = useRef<string>(component.id);
  componentIdRef.current = component.id;

  const layoutRef = useRef<CanvasLayout>(layout);
  layoutRef.current = layout;

  const editableRef = useRef<boolean>(editable);
  editableRef.current = editable;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const onRequestEditRef = useRef(onRequestEdit);
  onRequestEditRef.current = onRequestEdit;

  const grantTimeRef = useRef<number>(0);
  const movedRef = useRef<boolean>(false);

  const makeResponder = useCallback(
    (corner: ResizeCorner | null) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => editableRef.current,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (
          _e: GestureResponderEvent,
          g: PanResponderGestureState,
        ) => editableRef.current && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2),
        onMoveShouldSetPanResponderCapture: (
          _e: GestureResponderEvent,
          g: PanResponderGestureState,
        ) => editableRef.current && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2),
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          const c = componentIdRef.current;
          onSelectRef.current(c);
          grantTimeRef.current = Date.now();
          movedRef.current = false;
          setDbg(`GRANT ${c.slice(-4)}`);
        },
        onPanResponderMove: (
          _e: GestureResponderEvent,
          g: PanResponderGestureState,
        ) => {
          setDbg(`MOVE dx=${Math.round(g.dx)} dy=${Math.round(g.dy)}`);
          if (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3) {
            movedRef.current = true;
          }

          const s = snapshotRef.current;
          const scale = layoutRef.current.scale;
          const dvx = g.dx / scale;
          const dvy = g.dy / scale;

          if (!corner) {
            const next = clampToCanvas(s.x + dvx, s.y + dvy, s.width, s.height);
            onChangeRef.current(componentIdRef.current, next);
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
          onChangeRef.current(componentIdRef.current, clamped);
        },
        onPanResponderRelease: () => {
          const duration = Date.now() - grantTimeRef.current;
          setDbg(`RELEASE dur=${duration} moved=${movedRef.current}`);
          if (!movedRef.current && duration < 400) {
            onSelectRef.current(componentIdRef.current);
          }
        },
        onPanResponderTerminate: () => {
          setDbg('TERMINATED');
          movedRef.current = false;
        },
      }),
    [],
  );

  const dragResponder = useMemo(() => makeResponder(null), [makeResponder]);
  const tlResponder = useMemo(() => makeResponder('tl'), [makeResponder]);
  const trResponder = useMemo(() => makeResponder('tr'), [makeResponder]);
  const blResponder = useMemo(() => makeResponder('bl'), [makeResponder]);
  const brResponder = useMemo(() => makeResponder('br'), [makeResponder]);

  React.useEffect(() => {
    snapshotRef.current = {
      x: component.x,
      y: component.y,
      width: component.width,
      height: component.height,
    };
  }, [component.x, component.y, component.width, component.height]);

  const left = layout.offsetX + component.x * layout.scale;
  const top = layout.offsetY + component.y * layout.scale;
  const width = component.width * layout.scale;
  const height = component.height * layout.scale;

  const handleLongPress = useCallback((): void => {
    if (!editableRef.current) return;
    onSelectRef.current(componentIdRef.current);
    onRequestEditRef.current?.(componentIdRef.current);
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
      pointerEvents={editable ? 'box-none' : 'box-none'}
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

      <View
        {...(editable ? dragResponder.panHandlers : {})}
        style={{ flex: 1 }}
        pointerEvents={editable ? 'auto' : 'box-none'}
      >
        <Pressable
          onLongPress={editable ? handleLongPress : undefined}
          delayLongPress={450}
          style={{ flex: 1 }}
          pointerEvents={editable ? 'auto' : 'box-none'}
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
            {...tlResponder.panHandlers}
            style={handleStyle('tl')}
            hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}
          />
          <View
            {...trResponder.panHandlers}
            style={handleStyle('tr')}
            hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}
          />
          <View
            {...blResponder.panHandlers}
            style={handleStyle('bl')}
            hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}
          />
          <View
            {...brResponder.panHandlers}
            style={handleStyle('br')}
            hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}
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