import type { InteractionAction } from '@/types/action';

export type ComponentType =
  | 'text'
  | 'image'
  | 'video'
  | 'button'
  | 'spacer'
  | 'divider'
  | 'row'
  | 'input';

export type SizePreset = 'small' | 'medium' | 'large' | 'full';

export type HorizontalAlign = 'left' | 'center' | 'right';

export interface ComponentBase {
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
  size: SizePreset;
  rounded: boolean;
}

export interface VideoComponent extends ComponentBase {
  type: 'video';
  url: string;
  autoPlay: boolean;
}

export interface ButtonComponent extends ComponentBase {
  type: 'button';
  label: string;
  size: SizePreset;
  align: HorizontalAlign;
  variant: 'primary' | 'secondary' | 'danger';
}

export interface SpacerComponent extends ComponentBase {
  type: 'spacer';
  size: SizePreset;
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

export type PageComponent =
  | TextComponent
  | ImageComponent
  | VideoComponent
  | ButtonComponent
  | SpacerComponent
  | DividerComponent
  | RowComponent
  | InputComponent;

export const COMPONENT_TYPE_LABELS: Record<ComponentType, string> = {
  text: 'Text',
  image: 'Image',
  video: 'Video',
  button: 'Button',
  spacer: 'Spacer',
  divider: 'Divider',
  row: 'Row',
  input: 'Input',
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