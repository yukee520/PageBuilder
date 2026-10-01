export type ActionType =
  | 'navigate'
  | 'openUrl'
  | 'showAlert'
  | 'playVideo'
  | 'toggleVisibility'
  | 'setVariable'
  | 'goBack'
  | 'nextOnboarding'
  | 'completeOnboarding';

export interface NavigateAction {
  id: string;
  type: 'navigate';
  pageId: string;
}

export interface OpenUrlAction {
  id: string;
  type: 'openUrl';
  url: string;
}

export interface ShowAlertAction {
  id: string;
  type: 'showAlert';
  title: string;
  message: string;
}

export interface PlayVideoAction {
  id: string;
  type: 'playVideo';
  url: string;
}

export interface ToggleVisibilityAction {
  id: string;
  type: 'toggleVisibility';
  targetComponentId: string;
}

export interface SetVariableAction {
  id: string;
  type: 'setVariable';
  key: string;
  value: string;
}

export interface GoBackAction {
  id: string;
  type: 'goBack';
}

export interface NextOnboardingAction {
  id: string;
  type: 'nextOnboarding';
}

export interface CompleteOnboardingAction {
  id: string;
  type: 'completeOnboarding';
}

export type InteractionAction =
  | NavigateAction
  | OpenUrlAction
  | ShowAlertAction
  | PlayVideoAction
  | ToggleVisibilityAction
  | SetVariableAction
  | GoBackAction
  | NextOnboardingAction
  | CompleteOnboardingAction;

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  navigate: 'Go to page',
  openUrl: 'Open web page',
  showAlert: 'Show alert',
  playVideo: 'Play video',
  toggleVisibility: 'Show / hide component',
  setVariable: 'Set variable',
  goBack: 'Go back',
  nextOnboarding: 'Next onboarding page',
  completeOnboarding: 'Skip onboarding',
};

export const ACTION_TYPE_ICONS: Record<ActionType, string> = {
  navigate: 'arrow-forward-circle-outline',
  openUrl: 'globe-outline',
  showAlert: 'alert-circle-outline',
  playVideo: 'play-circle-outline',
  toggleVisibility: 'eye-outline',
  setVariable: 'code-working-outline',
  goBack: 'arrow-back-circle-outline',
  nextOnboarding: 'play-skip-forward-outline',
  completeOnboarding: 'flag-outline',
};

export function isNavigateAction(a: InteractionAction): a is NavigateAction {
  return a.type === 'navigate';
}

export function isOpenUrlAction(a: InteractionAction): a is OpenUrlAction {
  return a.type === 'openUrl';
}

export function isShowAlertAction(a: InteractionAction): a is ShowAlertAction {
  return a.type === 'showAlert';
}

export function isPlayVideoAction(a: InteractionAction): a is PlayVideoAction {
  return a.type === 'playVideo';
}

export function isToggleVisibilityAction(
  a: InteractionAction,
): a is ToggleVisibilityAction {
  return a.type === 'toggleVisibility';
}

export function isSetVariableAction(a: InteractionAction): a is SetVariableAction {
  return a.type === 'setVariable';
}

export function isGoBackAction(a: InteractionAction): a is GoBackAction {
  return a.type === 'goBack';
}

export function isNextOnboardingAction(
  a: InteractionAction,
): a is NextOnboardingAction {
  return a.type === 'nextOnboarding';
}

export function isCompleteOnboardingAction(
  a: InteractionAction,
): a is CompleteOnboardingAction {
  return a.type === 'completeOnboarding';
}