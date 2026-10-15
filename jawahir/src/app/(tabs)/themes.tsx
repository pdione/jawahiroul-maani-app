import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { themes } from '@/lib/content';
import { fonts, useColors } from '@/lib/theme';

export default function Themes() {
  const c = useColors();
  return (
    <Screen title="Thèmes" subtitle="Parcourez le livre par sujet">
      <FlatList
        data={themes}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 10, paddingTop: 4 }}
        ListHeaderComponent={
          <Text style={[styles.note, { color: c.muted }]}>
            Chaque thème rassemble les passages du livre qui en traitent, dans l’ordre de lecture. L’index est établi
            automatiquement à partir du texte.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/theme/${item.id}`)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: pressed ? c.card : c.surface, borderColor: c.border },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: c.text, fontFamily: fonts.serif }]}>{item.title}</Text>
              <Text style={[styles.desc, { color: c.muted }]}>{item.description}</Text>
            </View>
            <View style={styles.right}>
              <Text style={[styles.count, { color: c.accent }]}>{item.count}</Text>
              <Text style={[styles.countLabel, { color: c.muted }]}>passages</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.muted} />
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 13, lineHeight: 18, marginBottom: 8, marginHorizontal: 4 },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: { fontSize: 17, fontWeight: '700' },
  desc: { fontSize: 13.5, lineHeight: 18, marginTop: 3 },
  right: { alignItems: 'center', minWidth: 56 },
  count: { fontSize: 20, fontWeight: '700' },
  countLabel: { fontSize: 11 },
});
