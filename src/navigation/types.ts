
import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Projects: undefined;
  Preview: { projectId: string } | undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Editor: { projectId: string };
  ComponentEdit: {
    projectId: string;
    pageId: string;
    componentId: string;
  };
  ActionEdit: {
    projectId: string;
    pageId: string;
    componentId: string;
    actionId: string;
  };
  Preview: { projectId: string };
  ProjectSettings: { projectId: string };
  Build: { projectId: string };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
