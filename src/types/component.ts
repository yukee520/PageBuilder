import type { InteractionAction } from '@/types/action';

export type ComponentType =
  | 'text'
  | 'image'
  | 'video'
  | 'button'
  | 'spacer'
  | 'divider'
  | 'row'
  | 'input'
  | 'music';

export type SizePreset = 'small' | 'medium' | 'large' | 'full';

export type HorizontalAlign = 'left' | 'center' | 'right';

/**
 * Position and size are stored as FRACTIONS of the canvas (0 to 1).
 * x=0 is left edge, x=1 is right edge, width=1 means full canvas width.
 * Same for y / height relative to canvas height.
 * This makes the design responsive: percentages scale with any screen.
 */
export interface PositionedBox {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
}

export interface ComponentBase extends PositionedBox {
  id: string;
  type: ComponentType;
  actions: InteractionAction[];
  visible: boolean;
}

export interface TextComponent extends ComponentBase {
  type: 'text';
  content: string;
  fontSize: SizePreset;
  align: HorizontalAlign;
  bold: boolean;
  color: string | null;
}

export interface ImageComponent extends ComponentBase {
  type: 'image';
  uri: string;
  rounded: boolean;
  backgroundMode: boolean;
}

export interface VideoComponent extends ComponentBase {
  type: 'video';
  url: string;
  /**
   * When true, the video plays automatically when the page loads, renders
   * inline (no controls, no play button), and pauses BGM for its duration.
   * When false, the component shows a play button; tapping opens a
   * full-screen player with standard controls.
   */
  autoPlay: boolean;
  /**
   * When true, the video restarts from the beginning after it ends.
   * Autoplay videos often loop (decorative backgrounds). Manual videos
   * usually don't (they're content).
   *
   * Only meaningful when `autoPlay` is true. Manual videos always end
   * and close the modal, regardless of this flag.
   */
  loop: boolean;
}

export interface ButtonComponent extends ComponentBase {
  type: 'button';
  label: string;
  variant: 'primary' | 'secondary' | 'danger';
}

export interface SpacerComponent extends ComponentBase {
  type: 'spacer';
}

export interface DividerComponent extends ComponentBase {
  type: 'divider';
  thickness: 'thin' | 'medium' | 'thick';
}

export interface RowComponent extends ComponentBase {
  type: 'row';
  children: PageComponent[];
  gap: SizePreset;
}

export interface InputComponent extends ComponentBase {
  type: 'input';
  placeholder: string;
  variableKey: string;
}

export interface MusicComponent extends ComponentBase {
  type: 'music';
  tracks: MusicTrack[];
  showArtist: boolean;
  autoplay: boolean;
}

export type PageComponent =
  | TextComponent
  | ImageComponent
  | VideoComponent
  | ButtonComponent
  | SpacerComponent
  | DividerComponent
  | RowComponent
  | InputComponent
  | MusicComponent;

export const COMPONENT_TYPE_LABELS: Record<ComponentType, string> = {
  text: 'Text',
  image: 'Image',
  video: 'Video',
  button: 'Button',
  spacer: 'Spacer',
  divider: 'Divider',
  row: 'Row',
  input: 'Input',
  music: 'Music',
};

export const COMPONENT_TYPE_ICONS: Record<ComponentType, string> = {
  text: 'text-outline',
  image: 'image-outline',
  video: 'videocam-outline',
  button: 'radio-button-on-outline',
  spacer: 'resize-outline',
  divider: 'remove-outline',
  row: 'albums-outline',
  input: 'create-outline',
  music: 'musical-notes-outline',
};

export const SIZE_PRESET_LABELS: Record<SizePreset, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  full: 'Full width',
};

export function isTextComponent(c: PageComponent): c is TextComponent {
  return c.type === 'text';
}

export function isImageComponent(c: PageComponent): c is ImageComponent {
  return c.type === 'image';
}

export function isVideoComponent(c: PageComponent): c is VideoComponent {
  return c.type === 'video';
}

export function isButtonComponent(c: PageComponent): c is ButtonComponent {
  return c.type === 'button';
}

export function isSpacerComponent(c: PageComponent): c is SpacerComponent {
  return c.type === 'spacer';
}

export function isDividerComponent(c: PageComponent): c is DividerComponent {
  return c.type === 'divider';
}

export function isRowComponent(c: PageComponent): c is RowComponent {
  return c.type === 'row';
}

export function isInputComponent(c: PageComponent): c is InputComponent {
  return c.type === 'input';
}

export function isMusicComponent(c: PageComponent): c is MusicComponent {
  return c.type === 'music';
}