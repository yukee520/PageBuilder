import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  clearRuntimeSettings,
  DEFAULT_RUNTIME_SETTINGS,
  loadRuntimeSettings,
  saveRuntimeSettings,
  type RuntimeSettings,
} from './runtimeSettings';

export interface RuntimeSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Identifies the current project so settings are namespaced per app.
   * Usually `project.id`.
   */
  projectId: string;
  /**
   * Project name, shown as the sheet's subtitle for context.
   */
  projectName: string;
  /**
   * App version, shown in the footer. Usually `project.version`.
   */
  appVersion: string;
  /**
   * Called whenever a setting changes, so the caller (App.tsx) can react
   * immediately — e.g. stop BGM when the user turns it off.
   */
  onSettingsChanged?: (settings: RuntimeSettings) => void;
}

/**
 * A slide-up sheet with end-user settings for a generated APK.
 *
 * Current contents:
 *   - Background music On / Off toggle
 *   - Reset settings button
 *   - App info (name + version)
 *
 * All settings persist via AsyncStorage in `runtimeSettings.ts`.
 */
export function RuntimeSettingsSheet({
  visible,
  onClose,
  projectId,
  projectName,
  appVersion,
  onSettingsChanged,
}: RuntimeSettingsSheetProps): React.ReactElement {
  const [settings, setSettings] = useState<RuntimeSettings>(
    DEFAULT_RUNTIME_SETTINGS,
  );
  const [loading, setLoading] = useState<boolean>(true);

  // Load persisted settings whenever the sheet is opened.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const loaded = await loadRuntimeSettings(projectId);
      if (cancelled) return;
      setSettings(loaded);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, projectId]);

  const updateSettings = useCallback(
    (patch: Partial<RuntimeSettings>): void => {
      setSettings(prev => {
        const next = { ...prev, ...patch };
        void saveRuntimeSettings(projectId, next);
        onSettingsChanged?.(next);
        return next;
      });
    },
    [onSettingsChanged, projectId],
  );

  const handleToggleBgm = useCallback(
    (value: boolean): void => {
      updateSettings({ bgmEnabled: value });
    },
    [updateSettings],
  );

  const handleReset = useCallback((): void => {
    void clearRuntimeSettings(projectId).then(() => {
      setSettings(DEFAULT_RUNTIME_SETTINGS);
      onSettingsChanged?.(DEFAULT_RUNTIME_SETTINGS);
    });
  }, [onSettingsChanged, projectId]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable onPress={() => undefined}>
          <SafeAreaView
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#CBD5E1',
                alignSelf: 'center',
                marginTop: 10,
                marginBottom: 6,
              }}
            />

            <View
              style={{
                paddingHorizontal: 20,
                paddingTop: 6,
                paddingBottom: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: '#0F172A',
                  }}
                >
                  Settings
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#64748B',
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {projectName}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                style={{ padding: 6 }}
                accessibilityRole="button"
                accessibilityLabel="Close settings"
              >
                <Text style={{ fontSize: 18, color: '#64748B' }}>✕</Text>
              </Pressable>
            </View>

            {loading ? (
              <View
                style={{
                  paddingVertical: 40,
                  alignItems: 'center',
                }}
              >
                <ActivityIndicator color="#2563EB" />
              </View>
            ) : (
              <ScrollView
                style={{ maxHeight: 400 }}
                contentContainerStyle={{
                  paddingHorizontal: 20,
                  paddingBottom: 24,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: '#E2E8F0',
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: '#0F172A',
                      }}
                    >
                      Background music
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: '#64748B',
                        marginTop: 2,
                      }}
                    >
                      Turn off to silence page background music. Music lists
                      and videos are not affected.
                    </Text>
                  </View>
                  <Switch
                    value={settings.bgmEnabled}
                    onValueChange={handleToggleBgm}
                    trackColor={{ false: '#E2E8F0', true: '#2563EB' }}
                  />
                </View>

                <Pressable
                  onPress={handleReset}
                  style={{
                    marginTop: 16,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    alignItems: 'center',
                  }}
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: '#64748B',
                    }}
                  >
                    Reset settings
                  </Text>
                </Pressable>

                <View style={{ marginTop: 24, alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                    {projectName} · v{appVersion}
                  </Text>
                </View>
              </ScrollView>
            )}
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}