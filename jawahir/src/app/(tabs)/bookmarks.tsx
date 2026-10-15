import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { unitMeta } from '@/lib/content';
import { actions, useStore } from '@/lib/store';
import { fonts, useColors } from '@/lib/theme';

export default function Bookmarks() {
  const c = useColors();
  const bookmarks = useStore((s) => s.bookmarks);

  return (
    <Screen title="Signets" subtitle={bookmarks.length ? `${bookmarks.length} passage(s) enregistré(s)` : undefined}>
      {bookmarks.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="bookmark-outline" size={42} color={c.muted} />
          <Text style={[styles.emptyTitle, { color: c.text, fontFamily: fonts.serif }]}>Aucun signet</Text>
          <Text style={{ color: c.muted, textAlign: 'center', lineHeight: 20 }}>
            Dans le lecteur, touchez l’icône de signet pour garder l’endroit où vous en êtes.
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookmarks}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
          renderItem={({ item }) => {
            const m = unitMeta(item.unit);
            return (
              <Pressable
                onPress={() => router.push(`/lire/${item.unit}?block=${item.block}`)}
                style={({ pressed }) => [styles.card, { backgroundColor: pressed ? c.card : c.surface, borderColor: c.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.accent, fontSize: 12.5, fontWeight: '700', marginBottom: 4 }} numberOfLines={1}>
                    {m ? `${m.groupTitle.split(' — ')[0]} · ${m.title}` : item.unit} — p. {item.pg}
                  </Text>
                  <Text numberOfLines={3} style={{ color: c.text, fontSize: 15, lineHeight: 22, fontFamily: fonts.serif }}>
                    {item.excerpt}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 12, marginTop: 6 }}>
                    Ajouté le {new Date(item.at).toLocaleDateString('fr-FR')}
                  </Text>
                </View>
                <Pressable onPress={() => actions.removeBookmark(item.id)} hitSlop={12} accessibilityLabel="Supprimer le signet">
                  <Ionicons name="trash-outline" size={20} color={c.muted} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingHorizontal: 40, marginTop: 70, gap: 10 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  card: { padding: 14, borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
});
