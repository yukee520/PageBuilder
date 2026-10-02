
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import ScreenHeader from '@/components/ScreenHeader';
import Card from '@/components/Card';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTheme } from '@/hooks/useTheme';
import { validateToken, GithubApiError } from '@/api/github';
import { sanitizeRepoName } from '@/utils/format';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();

  const githubToken = useSettingsStore(s => s.githubToken);
  const defaultRepoName = useSettingsStore(s => s.defaultRepoName);
  const makeRepoPrivate = useSettingsStore(s => s.makeRepoPrivate);
  const templateOwner = useSettingsStore(s => s.templateOwner);
  const templateRepo = useSettingsStore(s => s.templateRepo);
  const hydrated = useSettingsStore(s => s.hydrated);
  const hydrate = useSettingsStore(s => s.hydrate);
  const setGithubToken = useSettingsStore(s => s.setGithubToken);
  const setDefaultRepoName = useSettingsStore(s => s.setDefaultRepoName);
  const setMakeRepoPrivate = useSettingsStore(s => s.setMakeRepoPrivate);
  const clearGithubToken = useSettingsStore(s => s.clearGithubToken);

  const [tokenDraft, setTokenDraft] = useState<string>('');
  const [repoDraft, setRepoDraft] = useState<string>('');
  const [verifying, setVerifying] = useState<boolean>(false);

  useEffect(() => {
    if (!hydrated) {
      void hydrate();
    }
  }, [hydrated, hydrate]);

  useEffect(() => {
    setTokenDraft(githubToken);
  }, [githubToken]);

  useEffect(() => {
    setRepoDraft(defaultRepoName);
  }, [defaultRepoName]);

  const handleVerifyToken = useCallback(async (): Promise<void> => {
    const token = tokenDraft.trim();
    if (!token) {
      Toast.show({ type: 'error', text1: 'Please paste a GitHub token first' });
      return;
    }
    setVerifying(true);
    try {
      const user = await validateToken(token);
      setGithubToken(token);
      Toast.show({
        type: 'success',
        text1: 'GitHub connected',
        text2: `Signed in as ${user.login}`,
      });
    } catch (err) {
      const msg =
        err instanceof GithubApiError
          ? err.message
          : 'Could not verify this token.';
      Toast.show({ type: 'error', text1: 'Token invalid', text2: msg });
    } finally {
      setVerifying(false);
    }
  }, [setGithubToken, tokenDraft]);

  const handleSaveRepo = useCallback((): void => {
    const sanitized = sanitizeRepoName(repoDraft);
    if (!sanitized) {
      Toast.show({ type: 'error', text1: 'Repository name cannot be empty' });
      return;
    }
    setDefaultRepoName(sanitized);
    setRepoDraft(sanitized);
    Toast.show({ type: 'success', text1: 'Saved' });
  }, [repoDraft, setDefaultRepoName]);

  const handleDisconnect = useCallback((): void => {
    Alert.alert(
      'Disconnect GitHub?',
      'You will need to add the token again to build APKs.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            void clearGithubToken();
            setTokenDraft('');
            Toast.show({ type: 'success', text1: 'GitHub disconnected' });
          },
        },
      ],
    );
  }, [clearGithubToken]);

  const openGithubTokenPage = useCallback((): void => {
    Linking.openURL(
      'https://github.com/settings/tokens/new?scopes=repo,workflow&description=PageBuilder',
    ).catch(() => {
      Alert.alert('Could not open GitHub in your browser.');
    });
  }, []);

  const openTemplateRepo = useCallback((): void => {
    Linking.openURL(`https://github.com/${templateOwner}/${templateRepo}`).catch(
      () => {
        Alert.alert('Could not open GitHub in your browser.');
      },
    );
  }, [templateOwner, templateRepo]);

  return (
    <SafeAreaView
      className="flex-1 bg-background dark:bg-dark-background"
      edges={['top', 'left', 'right']}
    >
      <ScreenHeader title="Settings" subtitle="GitHub & preferences" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Card className="mb-4">
          <View className="flex-row items-center mb-3">
            <View className="w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/20 items-center justify-center mr-3">
              <Ionicons name="logo-github" size={20} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-text dark:text-dark-text">
                GitHub Account
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                A Personal Access Token with repo & workflow scopes.
              </Text>
            </View>
          </View>

          <Input
            label="Personal Access Token"
            value={tokenDraft}
            onChangeText={setTokenDraft}
            placeholder="ghp_..."
            autoCapitalize="none"
            secureTextEntry
            containerClassName="mb-2"
          />

          <Pressable
            onPress={openGithubTokenPage}
            className="self-start mb-3"
            accessibilityRole="link"
          >
            <Text className="text-xs font-semibold text-primary">
              Create a new token on GitHub →
            </Text>
          </Pressable>

          <View className="flex-row">
            <View className="flex-1">
              <Button
                label={githubToken ? 'Update token' : 'Connect'}
                icon="checkmark-circle-outline"
                onPress={() => {
                  void handleVerifyToken();
                }}
                loading={verifying}
                fullWidth
              />
            </View>
            {githubToken ? (
              <>
                <View className="w-2" />
                <Button
                  label="Disconnect"
                  variant="danger"
                  icon="log-out-outline"
                  onPress={handleDisconnect}
                />
              </>
            ) : null}
          </View>
        </Card>

        <Card className="mb-4">
          <View className="flex-row items-center mb-3">
            <View className="w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/20 items-center justify-center mr-3">
              <Ionicons
                name="git-branch-outline"
                size={20}
                color={colors.primary}
              />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-text dark:text-dark-text">
                Build Target
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                APKs are generated from a repository created from the template.
              </Text>
            </View>
          </View>

          <Input
            label="Default repository name"
            value={repoDraft}
            onChangeText={setRepoDraft}
            placeholder="my-app-001"
            autoCapitalize="none"
            hint="Lowercase letters, numbers, dashes and underscores only."
            containerClassName="mb-3"
          />

          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1 pr-3">
              <Text className="text-sm text-text dark:text-dark-text">
                Private repository
              </Text>
              <Text className="text-xs text-muted dark:text-dark-muted mt-0.5">
                Recommended. Anyone can still download the APK from the release.
              </Text>
            </View>
            <Switch
              value={makeRepoPrivate}
              onValueChange={setMakeRepoPrivate}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>

          <Button
            label="Save"
            icon="save-outline"
            onPress={handleSaveRepo}
            variant="secondary"
            fullWidth
          />
        </Card>

        <Card className="mb-4">
          <Text className="text-base font-semibold text-text dark:text-dark-text mb-2">
            Template Repository
          </Text>
          <Text className="text-xs text-muted dark:text-dark-muted mb-3">
            The APK runtime is generated from this repository. Change only if you
            forked the template.
          </Text>
          <Pressable
            onPress={openTemplateRepo}
            className="flex-row items-center py-2"
            accessibilityRole="link"
          >
            <Ionicons name="link-outline" size={16} color={colors.primary} />
            <Text className="text-sm text-primary font-semibold ml-2">
              {templateOwner}/{templateRepo}
            </Text>
          </Pressable>
        </Card>

        <Card className="mb-4">
          <View className="flex-row items-center mb-2">
            <View className="w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary/20 items-center justify-center mr-3">
              <Ionicons
                name="hammer-outline"
                size={18}
                color={colors.primary}
              />
            </View>
            <Text className="text-base font-semibold text-text dark:text-dark-text">
              Building an APK
            </Text>
          </View>
          <Text className="text-xs text-muted dark:text-dark-muted leading-5 mb-3">
            Open a project in the editor, then tap the hammer icon in the
            top-right corner to build an APK for that project.
          </Text>
          <View className="bg-background dark:bg-dark-background rounded-xl p-3 flex-row items-center">
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text className="text-xs text-muted dark:text-dark-muted ml-2 flex-1">
              If you don't have a project open, open one from the Projects tab
              first.
            </Text>
          </View>
        </Card>

        <Card>
          <Text className="text-base font-semibold text-text dark:text-dark-text mb-2">
            About
          </Text>
          <Text className="text-xs text-muted dark:text-dark-muted">
            PageBuilder turns your visual pages into an installable Android app.
            Built with React Native.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}