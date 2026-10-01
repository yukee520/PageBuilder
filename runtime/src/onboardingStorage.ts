import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OnboardingProgress {
  onboardingCompleted: boolean;
  lastOnboardingPageId: string | null;
  completedAt: number | null;
}

export const DEFAULT_PROGRESS: OnboardingProgress = {
  onboardingCompleted: false,
  lastOnboardingPageId: null,
  completedAt: null,
};

function keyFor(projectId: string): string {
  return `@pagebuilder/onboarding/${projectId}`;
}

export async function loadProgress(
  projectId: string,
): Promise<OnboardingProgress> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(projectId));
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(raw) as Partial<OnboardingProgress>;
    return {
      onboardingCompleted: Boolean(parsed.onboardingCompleted),
      lastOnboardingPageId:
        typeof parsed.lastOnboardingPageId === 'string'
          ? parsed.lastOnboardingPageId
          : null,
      completedAt:
        typeof parsed.completedAt === 'number' ? parsed.completedAt : null,
    };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export async function saveProgress(
  projectId: string,
  progress: OnboardingProgress,
): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(projectId), JSON.stringify(progress));
  } catch {
    // best-effort; UI keeps working in-memory
  }
}

export async function clearProgress(projectId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(projectId));
  } catch {
    // ignore
  }
}