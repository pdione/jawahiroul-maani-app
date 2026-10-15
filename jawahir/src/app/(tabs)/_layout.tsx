import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB = (name: string, title: string, icon: IconName, iconActive: IconName) => ({
  name,
  title,
  icon,
  iconActive,
});

const tabs = [
  TAB('index', 'Chapitres', 'book-outline', 'book'),
  TAB('themes', 'Thèmes', 'grid-outline', 'grid'),
  TAB('search', 'Recherche', 'search-outline', 'search'),
  TAB('bookmarks', 'Signets', 'bookmark-outline', 'bookmark'),
  TAB('settings', 'Réglages', 'options-outline', 'options'),
];

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          ...(Platform.OS === 'web' ? { height: 66, paddingBottom: 8, paddingTop: 6 } : {}),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? t.iconActive : t.icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
