import React from 'react';
import { View, type ViewProps } from 'react-native';

export interface CardProps extends ViewProps {
  className?: string;
  padded?: boolean;
}

export default function Card({
  className,
  padded = true,
  children,
  ...rest
}: CardProps): React.ReactElement {
  return (
    <View
      className={[
        'bg-card dark:bg-dark-card',
        'border border-border dark:border-dark-border',
        'rounded-2xl',
        padded ? 'p-4' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </View>
  );
}