const handlePickVideo = useCallback(async (): Promise<void> => {
  const result = await pickVideo();
  if (!result) return;
  patch({ url: result.uri } as Partial<VideoComponent>);
  Toast.show({
    type: 'success',
    text1: 'Video added',
    text2:
      result.size > 0
        ? `${(result.size / (1024 * 1024)).toFixed(1)} MB — bundled locally`
        : 'Bundled locally',
  });
}, [patch, pickVideo]);