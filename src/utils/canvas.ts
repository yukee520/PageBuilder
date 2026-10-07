/**
 * Editor canvas: a fixed-aspect virtual screen. All positions/sizes are
 * stored as fractions (0..1) of the canvas. At render time in the editor,
 * we scale the canvas to fit the available space and letterbox the excess
 * with a background color, so the design is always visible in full.
 *
 * The *runtime* (built APK) does NOT use this function. It uses
 * `computeRuntimeLayout` in the runtime's RuntimeRenderer, which stretches
 * the canvas edge-to-edge. This means the design stretches slightly to
 * fit each device — accepted trade-off for a true full-screen app.
 *
 * Aspect ratio chosen: 360:800 (matches common Android phones).
 */

export const CANVAS_ASPECT = 360 / 800;
export const CANVAS_REFERENCE_WIDTH = 360;
export const CANVAS_REFERENCE_HEIGHT = 800;

export const MIN_COMPONENT_WIDTH_FRAC = 0.05;
export const MIN_COMPONENT_HEIGHT_FRAC = 0.02;

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
  const screenAspect = screenWidth / screenHeight;
  let canvasWidth: number;
  let canvasHeight: number;

  if (screenAspect > CANVAS_ASPECT) {
    canvasHeight = screenHeight;
    canvasWidth = canvasHeight * CANVAS_ASPECT;
  } else {
    canvasWidth = screenWidth;
    canvasHeight = canvasWidth / CANVAS_ASPECT;
  }

  const offsetX = (screenWidth - canvasWidth) / 2;
  const offsetY = (screenHeight - canvasHeight) / 2;
  const scale = canvasWidth / CANVAS_REFERENCE_WIDTH;

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

export function fractionToPx(
  layout: CanvasLayout,
  xFrac: number,
  yFrac: number,
  wFrac: number,
  hFrac: number,
): { left: number; top: number; width: number; height: number } {
  return {
    left: layout.offsetX + xFrac * layout.canvasWidth,
    top: layout.offsetY + yFrac * layout.canvasHeight,
    width: wFrac * layout.canvasWidth,
    height: hFrac * layout.canvasHeight,
  };
}

export function clampFractionBox(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  const w = Math.max(MIN_COMPONENT_WIDTH_FRAC, Math.min(width, 1));
  const h = Math.max(MIN_COMPONENT_HEIGHT_FRAC, Math.min(height, 1));
  const minX = -0.5;
  const minY = -0.5;
  const maxX = 1 - w + 0.5;
  const maxY = 1 - h + 0.5;
  return {
    x: Math.max(minX, Math.min(x, maxX)),
    y: Math.max(minY, Math.min(y, maxY)),
    width: w,
    height: h,
  };
}

export const DEFAULT_COMPONENT_SIZE_FRAC: Record<
  string,
  { width: number; height: number }
> = {
  text: { width: 0.65, height: 0.06 },
  image: { width: 0.9, height: 0.25 },
  video: { width: 0.9, height: 0.24 },
  button: { width: 0.4, height: 0.06 },
  input: { width: 0.8, height: 0.06 },
  spacer: { width: 0.6, height: 0.03 },
  divider: { width: 0.8, height: 0.005 },
  row: { width: 0.9, height: 0.12 },
};

export const DEFAULT_DROP_POSITION_FRAC = { x: 0.05, y: 0.05 };