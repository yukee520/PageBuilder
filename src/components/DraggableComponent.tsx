import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  onRequestEdit?: (id: string) => void;
  children: React.ReactNode;
}

const HANDLE_SIZE = 28;
const EDGE_OVERSHOOT = 12;

interface BoxSnapshot {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragAnchor {
  componentXAtGrant: number;
  componentYAtGrant: number;
  fingerXAtGrant: number;
  fingerYAtGrant: number;
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

  useEffect(() => {
    snapshotRef.current = {
      x: component.x,
      y: component.y,
      width: component.width,
      height: component.height,
    };
  }, [component.x, component.y, component.width, component.height]);

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

  const dragAnchorRef = useRef<DragAnchor | null>(null);
  const resizeAnchorRef = useRef<DragAnchor | null>(null);

  const makeDragResponder = useCallback(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => editableRef.current,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (
          _e: GestureResponderEvent,
          g: PanResponderGestureState,
        ) => editableRef.current && (Math.abs(g.dx) > 1 || Math.abs(g.dy) > 1),
        onMoveShouldSetPanResponderCapture: (
          _e: GestureResponderEvent,
          g: PanResponderGestureState,
        ) => editableRef.current && (Math.abs(g.dx) > 1 || Math.abs(g.dy) > 1),
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          const c = componentIdRef.current;
          onSelectRef.current(c);
          grantTimeRef.current = Date.now();
          movedRef.current = false;

          const s = snapshotRef.current;
          dragAnchorRef.current = {
            componentXAtGrant: s.x,
            componentYAtGrant: s.y,
            fingerXAtGrant: e.nativeEvent.pageX,
            fingerYAtGrant: e.nativeEvent.pageY,
          };
          setDbg(`GRANT ${c.slice(-4)}`);
        },
        onPanResponderMove: (
          e: GestureResponderEvent,
          g: PanResponderGestureState,
        ) => {
          setDbg(`MOVE dx=${Math.round(g.dx)} dy=${Math.round(g.dy)}`);
          if (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3) {
            movedRef.current = true;
          }

          const anchor = dragAnchorRef.current;
          if (!anchor) return;

          const s = snapshotRef.current;
          const scale = layoutRef.current.scale;
          const fingerX = e.nativeEvent.pageX;
          const fingerY = e.nativeEvent.pageY;
          const dvx = (fingerX - anchor.fingerXAtGrant) / scale;
          const dvy = (fingerY - anchor.fingerYAtGrant) / scale;

          const next = clampBox(
            anchor.componentXAtGrant + dvx,
            anchor.componentYAtGrant + dvy,
            s.width,
            s.height,
          );
          onChangeRef.current(componentIdRef.current, next);
        },
        onPanResponderRelease: () => {
          const duration = Date.now() - grantTimeRef.current;
          setDbg(`RELEASE dur=${duration} moved=${movedRef.current}`);
          dragAnchorRef.current = null;
          if (!movedRef.current && duration < 400) {
            onSelectRef.current(componentIdRef.current);
          }
        },
        onPanResponderTerminate: () => {
          setDbg('TERMINATED');
          movedRef.current = false;
          dragAnchorRef.current = null;
        },
      }),
    [],
  );

  const makeResizeResponder = useCallback(
    (corner: ResizeCorner) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => editableRef.current,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (
          _e: GestureResponderEvent,
          g: PanResponderGestureState,
        ) => editableRef.current && (Math.abs(g.dx) > 1 || Math.abs(g.dy) > 1),
        onMoveShouldSetPanResponderCapture: (
          _e: GestureResponderEvent,
          g: PanResponderGestureState,
        ) => editableRef.current && (Math.abs(g.dx) > 1 || Math.abs(g.dy) > 1),
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          onSelectRef.current(componentIdRef.current);
          grantTimeRef.current = Date.now();
          movedRef.current = false;
          resizeAnchorRef.current = {
            componentXAtGrant: snapshotRef.current.x,
            componentYAtGrant: snapshotRef.current.y,
            fingerXAtGrant: e.nativeEvent.pageX,
            fingerYAtGrant: e.nativeEvent.pageY,
          };
          setDbg(`RESIZE ${corner}`);
        },
        onPanResponderMove: (
          e: GestureResponderEvent,
          g: PanResponderGestureState,
        ) => {
          const anchor = resizeAnchorRef.current;
          if (!anchor) return;

          movedRef.current = true;

          const s = snapshotRef.current;
          const scale = layoutRef.current.scale;
          const dvx = (e.nativeEvent.pageX - anchor.fingerXAtGrant) / scale;
          const dvy = (e.nativeEvent.pageY - anchor.fingerYAtGrant) / scale;

          let nx = anchor.componentXAtGrant;
          let ny = anchor.componentYAtGrant;
          let nw = s.width;
          let nh = s.height;

          if (corner === 'tl') {
            nx = anchor.componentXAtGrant + dvx;
            ny = anchor.componentYAtGrant + dvy;
            nw = s.width - dvx;
            nh = s.height - dvy;
          } else if (corner === 'tr') {
            ny = anchor.componentYAtGrant + dvy;
            nw = s.width + dvx;
            nh = s.height - dvy;
          } else if (corner === 'bl') {
            nx = anchor.componentXAtGrant + dvx;
            nw = s.width - dvx;
            nh = s.height + dvy;
          } else {
            nw = s.width + dvx;
            nh = s.height + dvy;
          }

          if (nw < MIN_COMPONENT_WIDTH) {
            if (corner === 'tl' || corner === 'bl') {
              nx = anchor.componentXAtGrant + (s.width - MIN_COMPONENT_WIDTH);
            }
            nw = MIN_COMPONENT_WIDTH;
          }
          if (nh < MIN_COMPONENT_HEIGHT) {
            if (corner === 'tl' || corner === 'tr') {
              ny = anchor.componentYAtGrant + (s.height - MIN_COMPONENT_HEIGHT);
            }
            nh = MIN_COMPONENT_HEIGHT;
          }

          onChangeRef.current(componentIdRef.current, {
            x: nx,
            y: ny,
            width: nw,
            height: nh,
          });
        },
        onPanResponderRelease: () => {
          resizeAnchorRef.current = null;
          setDbg('RESIZE END');
        },
        onPanResponderTerminate: () => {
          resizeAnchorRef.current = null;
        },
      }),
    [],
  );

  const dragResponder = useMemo(() => makeDragResponder(), [makeDragResponder]);
  const tlResponder = useMemo(
    () => makeResizeResponder('tl'),
    [makeResizeResponder],
  );
  const trResponder = useMemo(
    () => makeResizeResponder('tr'),
    [makeResizeResponder],
  );
  const blResponder = useMemo(
    () => makeResizeResponder('bl'),
    [makeResizeResponder],
  );
  const brResponder = useMemo(
    () => makeResizeResponder('br'),
    [makeResizeResponder],
  );

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

      <View
        {...(editable ? dragResponder.panHandlers : {})}
        style={{ flex: 1 }}
        pointerEvents={editable ? 'auto' : 'box-none'}
      >
        <Pressable
          onPress={editable ? handleTap : undefined}
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
            hitSlop={{ top: 12, left: 12, bottom: 12, right: 12 }}
          />
          <View
            {...trResponder.panHandlers}
            style={handleStyle('tr')}
            hitSlop={{ top: 12, left: 12, bottom: 12, right: 12 }}
          />
          <View
            {...blResponder.panHandlers}
            style={handleStyle('bl')}
            hitSlop={{ top: 12, left: 12, bottom: 12, right: 12 }}
          />
          <View
            {...brResponder.panHandlers}
            style={handleStyle('br')}
            hitSlop={{ top: 12, left: 12, bottom: 12, right: 12 }}
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