export const CANVAS_WIDTH = 360;
export const CANVAS_HEIGHT = 780;

export const MIN_COMPONENT_WIDTH = 40;
export const MIN_COMPONENT_HEIGHT = 24;

export interface CanvasLayout {
  screenWidth: number;
  screenHeight: number;
  scale: number;
  canvasWidth: number;
  canvasHeight: number;
  offsetX: number;
  offsetY: number;
}

export function computeCanvasLayout(
  screenWidth: number,
  screenHeight: number,
): CanvasLayout {
  const scale = Math.min(
    screenWidth / CANVAS_WIDTH,
    screenHeight / CANVAS_HEIGHT,
  );
  const canvasWidth = CANVAS_WIDTH * scale;
  const canvasHeight = CANVAS_HEIGHT * scale;
  const offsetX = (screenWidth - canvasWidth) / 2;
  const offsetY = (screenHeight - canvasHeight) / 2;
  return {
    screenWidth,
    screenHeight,
    scale,
    canvasWidth,
    canvasHeight,
    offsetX,
    offsetY,
  };
}

export function virtualToReal(
  layout: CanvasLayout,
  vx: number,
  vy: number,
  vw: number,
  vh: number,
): { left: number; top: number; width: number; height: number } {
  return {
    left: layout.offsetX + vx * layout.scale,
    top: layout.offsetY + vy * layout.scale,
    width: vw * layout.scale,
    height: vh * layout.scale,
  };
}

export function realDeltaToVirtual(
  layout: CanvasLayout,
  dx: number,
  dy: number,
): { dvx: number; dvy: number } {
  return {
    dvx: dx / layout.scale,
    dvy: dy / layout.scale,
  };
}

export function clampToCanvas(
  vx: number,
  vy: number,
  vw: number,
  vh: number,
): { x: number; y: number; width: number; height: number } {
  const width = Math.max(MIN_COMPONENT_WIDTH, Math.min(vw, CANVAS_WIDTH));
  const height = Math.max(MIN_COMPONENT_HEIGHT, Math.min(vh, CANVAS_HEIGHT));
  const x = Math.max(0, Math.min(vx, CANVAS_WIDTH - width));
  const y = Math.max(0, Math.min(vy, CANVAS_HEIGHT - height));
  return { x, y, width, height };
}

export const DEFAULT_COMPONENT_SIZE: Record<
  string,
  { width: number; height: number }
> = {
  text: { width: 200, height: 40 },
  image: { width: 240, height: 160 },
  video: { width: 260, height: 150 },
  button: { width: 140, height: 44 },
  input: { width: 240, height: 44 },
  spacer: { width: 200, height: 24 },
  divider: { width: 260, height: 4 },
  row: { width: 300, height: 80 },
};