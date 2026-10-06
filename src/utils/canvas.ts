/**
 * Canvas is a full-bleed layout. All positions/sizes are stored as
 * fractions (0..1) of the available area.
 *
 * Earlier versions locked the canvas to a 360:800 aspect ratio and
 * letterboxed the excess. That produced visible gaps on phones whose
 * screen shape differed from the reference. The canvas now stretches to
 * fill whatever space it is given, so the design uses every pixel.
 *
 * `scale` is derived from the smaller dimension relative to the reference
 * (360 x 800) so that text, borders, and corner radii stay proportional
 * and readable on both narrow phones and wide tablets.
 */

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
  const canvasWidth = screenWidth;
  const canvasHeight = screenHeight;

  // Scale by the smaller of the two normalized dimensions so text and
  // borders don't blow up on high-density or very wide screens.
  const scale = Math.min(
    canvasWidth / CANVAS_REFERENCE_WIDTH,
    canvasHeight / CANVAS_REFERENCE_HEIGHT,
  );

  return {
    screenWidth,
    screenHeight,
    scale,
    canvasWidth,
    canvasHeight,
    offsetX: 0,
    offsetY: 0,
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