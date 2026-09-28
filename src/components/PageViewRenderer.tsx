import React, { useCallback } from 'react';
import { View } from 'react-native';
import type { Page } from '@/types/project';
import type { PageComponent } from '@/types/component';
import ComponentRenderer from '@/components/ComponentRenderer';

export interface PageViewRendererProps {
  page: Page;
  onComponentPress?: (component: PageComponent) => void;
  onInputChange?: (componentId: string, value: string) => void;
  inputValues?: Record<string, string>;
  hiddenComponentIds?: Record<string, boolean>;
  editable?: boolean;
  contentPadding?: number;
}

export default function PageViewRenderer({
  page,
  onComponentPress,
  onInputChange,
  inputValues,
  hiddenComponentIds,
  editable = false,
  contentPadding = 16,
}: PageViewRendererProps): React.ReactElement {
  const handleInputChange = useCallback(
    (componentId: string, value: string): void => {
      onInputChange?.(componentId, value);
    },
    [onInputChange],
  );

  return (
    <View className="w-full" style={{ paddingHorizontal: contentPadding }}>
      {page.components.map(component => {
        if (hiddenComponentIds?.[component.id]) return null;
        return (
          <View key={component.id} className="mb-4">
            <ComponentRenderer
              component={component}
              onPress={
                onComponentPress
                  ? () => onComponentPress(component)
                  : undefined
              }
              onInputChange={
                onInputChange
                  ? value => handleInputChange(component.id, value)
                  : undefined
              }
              inputValue={
                component.type === 'input'
                  ? inputValues?.[component.variableKey]
                  : undefined
              }
              editable={editable}
            />
          </View>
        );
      })}
    </View>
  );
}