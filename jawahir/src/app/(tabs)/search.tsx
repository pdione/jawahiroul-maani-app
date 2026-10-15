import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { RichText } from '@/components/RichText';
import { Screen } from '@/components/Screen';
import { allUnits, getUnit, unitMeta } from '@/lib/content';
import { fold, indexOfWord, queryTerms, snippet, stripMarkup } from '@/lib/text';
import { fonts, useColors } from '@/lib/theme';

interface Entry {
  u: string;
  i: number;
  pg: number;
  text: string;
  f: string;
}
interface Hit {
  key: string;
  u: string;
  i: number;
  pg: number;
  snip: string;
}

let INDEX: Entry[] | null = null;
function buildIndex() {
  if (INDEX) return INDEX;
  const out: Entry[] = [];
  for (const m of allUnits) {
    const u = getUnit(m.id);
    if (!u) continue;
    u.blocks.forEach((b, i) => {
      if (b.t === 'fn') return;
      const text = stripMarkup(b.x);
      out.push({ u: m.id, i, pg: b.pg, text, f: fold(text) });
    });
  }
  INDEX = out;
  return out;
}

const SUGGESTIONS = ['dhikr', 'Salat al-Fatih', 'pôle', 'paradis', 'disciple', 'miséricorde', 'sceau des saints', 'Fès'];
const MAX = 150;

export default function Search() {
  const c = useColors();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [ready, setReady] = useState(INDEX !== null);

  useEffect(() => {
    if (INDEX) return;
    const t = setTimeout(() => {
      buildIndex();
      setReady(true);
    }, 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 280);
    return () => clearTimeout(t);
  }, [q]);

  const terms = useMemo(() => queryTerms(debounced), [debounced]);

  const { hits, total } = useMemo(() => {
    if (!ready || !INDEX || terms.length === 0) return { hits: [] as Hit[], total: 0 };
    const out: Hit[] = [];
    let n = 0;
    for (const e of INDEX) {
      if (terms.every((t) => indexOfWord(e.f, t) >= 0)) {
        n++;
        if (out.length < MAX) out.push({ key: `${e.u}:${e.i}`, u: e.u, i: e.i, pg: e.pg, snip: snippet(e.text, terms) });
      }
    }
    return { hits: out, total: n };
  }, [ready, terms]);

  const open = (h: Hit) => {
    Keyboard.dismiss();
    router.push(`/lire/${h.u}?block=${h.i}&q=${encodeURIComponent(debounced)}`);
  };

  return (
    <Screen title="Recherche" subtitle="Dans tout le livre, sans tenir compte des accents">
      <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Ionicons name="search" size={18} color={c.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Un mot, une expression…"
          placeholderTextColor={c.muted}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={[styles.input, { color: c.text }]}
        />
        {q ? (
          <Pressable onPress={() => setQ('')} hitSlop={10} accessibilityLabel="Effacer">
            <Ionicons name="close-circle" size={20} color={c.muted} />
          </Pressable>
        ) : null}
      </View>

      {!ready ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
          <Text style={{ color: c.muted, marginTop: 10 }}>Préparation de l’index…</Text>
        </View>
      ) : terms.length === 0 ? (
        <View style={styles.tips}>
          <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}>
            Plusieurs mots : tous doivent figurer dans le même paragraphe (début de mot). Essayez :
          </Text>
          <View style={styles.chips}>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => setQ(s)}
                style={[styles.chip, { borderColor: c.border, backgroundColor: c.surface }]}
              >
                <Text style={{ color: c.text, fontSize: 14 }}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlashList
          data={hits}
          keyExtractor={(h: Hit) => h.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          ListHeaderComponent={
            <Text style={{ color: c.muted, fontSize: 13, marginBottom: 8, marginLeft: 4 }}>
              {total === 0
                ? 'Aucun résultat.'
                : total > MAX
                  ? `${total} paragraphes — les ${MAX} premiers sont affichés. Affinez la recherche.`
                  : `${total} paragraphe${total > 1 ? 's' : ''}`}
            </Text>
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }: { item: Hit }) => {
            const m = unitMeta(item.u);
            return (
              <Pressable
                onPress={() => open(item)}
                style={({ pressed }) => [styles.card, { backgroundColor: pressed ? c.card : c.surface, borderColor: c.border }]}
              >
                <Text style={{ color: c.accent, fontSize: 12.5, fontWeight: '700', marginBottom: 4 }} numberOfLines={1}>
                  {m ? `${m.groupTitle.split(' — ')[0]} · ${m.title}` : item.u} — p. {item.pg}
                </Text>
                <RichText
                  text={item.snip}
                  terms={terms}
                  highlightColor={c.highlight}
                  style={{ color: c.text, fontSize: 15, lineHeight: 22, fontFamily: fonts.serif }}
                />
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 16 },
  center: { alignItems: 'center', marginTop: 40 },
  tips: { paddingHorizontal: 20, gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  card: { padding: 14, borderRadius: 12, borderWidth: 1 },
});
