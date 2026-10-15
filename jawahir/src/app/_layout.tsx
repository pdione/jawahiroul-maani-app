import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { hydrate, useStore } from '@/lib/store';
import { useColors } from '@/lib/theme';

export default function RootLayout() {
  const ready = useStore((s) => s.ready);
  const c = useColors();

  useEffect(() => {
    hydrate();
  }, []);

  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  return (
    <>
      <StatusBar style={c.name === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="lire/[unit]" />
        <Stack.Screen
          name="theme/[id]"
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: c.bg },
            headerTintColor: c.accent,
            headerTitleStyle: { color: c.text },
            headerBackTitle: 'Thèmes',
            headerShadowVisible: false,
          }}
        />
      </Stack>
    </>
  );
}
