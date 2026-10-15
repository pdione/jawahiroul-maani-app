import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, useColors } from '@/lib/theme';

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  right?: ReactNode;
}

/** Page frame with a large title, used by the tab screens. */
export function Screen({ title, subtitle, children, right }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top + 8 }]}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.text, fontFamily: fonts.serif }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: c.muted }]}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-end' },
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, marginTop: 2 },
});
