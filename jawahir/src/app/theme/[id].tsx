import { useMemo, useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatPages, getTheme, Passage, unitMeta } from '@/lib/content';
import { fonts, useColors } from '@/lib/theme';

type Sort = 'book' | 'score';

export default function ThemeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const theme = useMemo(() => getTheme(String(id)), [id]);
  const [sort, setSort] = useState<Sort>('book');

  const data = useMemo(() => {
    if (!theme) return [];
    const list = [...theme.passages];
    if (sort === 'score') list.sort((a, b) => b.score - a.score);
    return list;
  }, [theme, sort]);
  const maxScore = useMemo(() => Math.max(1, ...(theme?.passages.map((p) => p.score) ?? [1])), [theme]);

  if (!theme) return null;

  const terms: { key: Sort; label: string }[] = [
    { key: 'book', label: 'Ordre du livre' },
    { key: 'score', label: 'Plus pertinents' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ title: '' }} />
      <FlashList
        data={data}
        keyExtractor={(p: Passage) => `${p.unit}:${p.block}`}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={{ paddingBottom: 12 }}>
            <Text style={[styles.h1, { color: c.text, fontFamily: fonts.serif }]}>{theme.title}</Text>
            <Text style={[styles.desc, { color: c.muted }]}>{theme.description}</Text>
            <View style={styles.seg}>
              {terms.map((t) => (
                <Pressable
                  key={t.key}
                  onPress={() => setSort(t.key)}
                  style={[
                    styles.chip,
                    { borderColor: c.border, backgroundColor: sort === t.key ? c.accent : c.surface },
                  ]}
                >
                  <Text style={{ color: sort === t.key ? c.onAccent : c.text, fontSize: 13, fontWeight: '600' }}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }: { item: Passage }) => {
          const meta = unitMeta(item.unit);
          return (
            <Pressable
              onPress={() => router.push(`/lire/${item.unit}?block=${item.block}`)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: pressed ? c.card : c.surface, borderColor: c.border },
              ]}
            >
              <View style={styles.cardHead}>
                <Text style={[styles.where, { color: c.accent }]} numberOfLines={1}>
                  {meta ? `${meta.groupTitle.split(' — ')[0]} · ${meta.title}` : item.unit}
                </Text>
                <Text style={[styles.pages, { color: c.muted }]}>{formatPages(item.pages)}</Text>
              </View>
              <Text style={[styles.excerpt, { color: c.text, fontFamily: fonts.serif }]} numberOfLines={4}>
                {item.excerpt}
              </Text>
              <View style={[styles.meter, { backgroundColor: c.card }]}>
                <View
                  style={{
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: c.accent,
                    width: `${Math.max(6, Math.round((item.score / maxScore) * 100))}%`,
                  }}
                />
              </View>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: '700', marginTop: 4 },
  desc: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  seg: { flexDirection: 'row', gap: 8, marginTop: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  card: { padding: 14, borderRadius: 14, borderWidth: 1 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  where: { fontSize: 12.5, fontWeight: '700', flex: 1 },
  pages: { fontSize: 12.5 },
  excerpt: { fontSize: 15.5, lineHeight: 23 },
  meter: { height: 3, borderRadius: 2, marginTop: 10, overflow: 'hidden' },
});
