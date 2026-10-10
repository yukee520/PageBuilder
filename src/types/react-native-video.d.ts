declare module 'react-native-video' {
  import type { Component } from 'react';
  import type { ViewStyle } from 'react-native';

  export interface VideoRef {
    seek: (time: number) => void;
    pause: () => void;
    resume: () => void;
  }

  export interface VideoSource {
    uri: string;
    headers?: Record<string, string | undefined>;
  }

  export interface VideoProps {
    source: VideoSource;
    style?: ViewStyle | ViewStyle[];
    paused?: boolean;
    repeat?: boolean;
    controls?: boolean;
    muted?: boolean;
    resizeMode?: 'contain' | 'cover' | 'stretch' | 'none';
    onEnd?: () => void;
    onError?: (event: { error?: { errorString?: string; errorCode?: number } }) => void;
    onLoad?: () => void;
    playInBackground?: boolean;
    playWhenInactive?: boolean;
    ignoreSilentSwitch?: 'ignore' | 'inherit' | 'obey';
  }

  const Video: React.ForwardRefExoticComponent<
    VideoProps & React.RefAttributes<VideoRef>
  >;
  export default Video;
}
