import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { formatPages, groups, readingMinutes, unitMeta, TocUnit } from '@/lib/content';

type TomeFilter = 'all' | 1 | 2;
const TOME_SPLIT = 298; // first page of Tome II
const tomeOf = (u: TocUnit) => (u.pages[0] < TOME_SPLIT ? 1 : 2);
const TOMES = [
  { n: 1 as const, title: 'Tome I', pages: 'p. 3–297' },
  { n: 2 as const, title: 'Tome II', pages: 'p. 298–549' },
];
type Section = { id: string; title: string; tome?: 1 | 2; data: TocUnit[] };
import { useStore } from '@/lib/store';
import { fonts, useColors } from '@/lib/theme';

export default function Chapters() {
  const c = useColors();
  const progress = useStore((s) => s.progress);
  const last = useStore((s) => s.last);
  const lastMeta = last ? unitMeta(last.unit) : undefined;
  const [filter, setFilter] = useState<TomeFilter>('all');

  const sections = useMemo(() => {
    const out: Section[] = [];
    for (const t of TOMES) {
      if (filter !== 'all' && filter !== t.n) continue;
      if (filter === 'all') out.push({ id: `tome${t.n}`, title: t.title, tome: t.n, data: [] });
      for (const g of groups) {
        const data = g.units.filter((u) => tomeOf(u) === t.n);
        if (data.length) out.push({ id: `${g.id}-${t.n}`, title: g.title, data });
      }
    }
    return out;
  }, [filter]);

  const open = (id: string, block = 0) => router.push(`/lire/${id}?block=${block}`);

  const header = (
    <View>
      {lastMeta && last ? (
        <Pressable
          onPress={() => open(last.unit, last.block)}
          style={({ pressed }) => [styles.resume, { backgroundColor: c.accent, opacity: pressed ? 0.9 : 1 }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.resumeLabel, { color: c.onAccent }]}>REPRENDRE LA LECTURE</Text>
            <Text style={[styles.resumeTitle, { color: c.onAccent, fontFamily: fonts.serif }]} numberOfLines={2}>
              {lastMeta.groupTitle.split(' — ')[0]} · {lastMeta.title}
            </Text>
            <Text style={[styles.resumeSub, { color: c.onAccent }]}>Page {last.pg} sur 549</Text>
          </View>
          <Ionicons name="play-circle" size={44} color={c.onAccent} />
        </Pressable>
      ) : null}
      <View style={styles.seg}>
        {([
          { k: 'all', label: 'Tout' },
          { k: 1, label: 'Tome I' },
          { k: 2, label: 'Tome II' },
        ] as { k: TomeFilter; label: string }[]).map((o) => (
          <Pressable
            key={String(o.k)}
            onPress={() => setFilter(o.k)}
            style={[
              styles.segBtn,
              { borderColor: filter === o.k ? c.accent : c.border, backgroundColor: filter === o.k ? c.accent : c.surface },
            ]}
          >
            <Text style={{ color: filter === o.k ? c.onAccent : c.text, fontWeight: '600', fontSize: 14 }}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <Screen title="Jawahir al-Maâni" subtitle="Perles des significations · Tomes I et II">
      <SectionList
        sections={sections}
        keyExtractor={(u) => u.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 32 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) =>
          section.tome ? (
            <View style={[styles.tomeBanner, { borderColor: c.border }]}>
              <Text style={[styles.tomeTitle, { color: c.text, fontFamily: fonts.serif }]}>{section.title}</Text>
              <Text style={{ color: c.muted, fontSize: 13 }}>{TOMES[section.tome - 1].pages}</Text>
            </View>
          ) : (
            <Text style={[styles.group, { color: c.accent }]}>{section.title.toUpperCase()}</Text>
          )
        }
        renderItem={({ item, index, section }) => (
          <UnitRow
            unit={item}
            first={index === 0}
            last={index === section.data.length - 1}
            ratio={ratio(item, progress[item.id]?.block)}
            onPress={() => open(item.id, progress[item.id]?.block ?? 0)}
          />
        )}
      />
    </Screen>
  );
}

function ratio(u: TocUnit, block?: number) {
  if (block === undefined) return 0;
  return Math.min(1, block / Math.max(1, u.blocks - 1));
}

function UnitRow({
  unit,
  first,
  last,
  ratio: r,
  onPress,
}: {
  unit: TocUnit;
  first: boolean;
  last: boolean;
  ratio: number;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? c.card : c.surface,
          borderColor: c.border,
          borderTopLeftRadius: first ? 14 : 0,
          borderTopRightRadius: first ? 14 : 0,
          borderBottomLeftRadius: last ? 14 : 0,
          borderBottomRightRadius: last ? 14 : 0,
          borderBottomWidth: last ? 1 : 0,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: c.text, fontFamily: fonts.serif }]}>{unit.title}</Text>
        <Text style={[styles.rowSub, { color: c.muted }]} numberOfLines={2}>
          {unit.subtitle}
        </Text>
        <Text style={[styles.rowMeta, { color: c.muted }]}>
          {formatPages(unit.pages)} · ~{readingMinutes(unit.words)} min
          {r > 0.02 ? ` · ${Math.round(r * 100)} % lu` : ''}
        </Text>
        {r > 0.02 ? (
          <View style={[styles.bar, { backgroundColor: c.card }]}>
            <View style={[styles.barFill, { backgroundColor: c.accent, width: `${Math.round(r * 100)}%` }]} />
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  resume: {
    marginHorizontal: 16,
    marginBottom: 6,
    padding: 18,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resumeLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, opacity: 0.85 },
  resumeTitle: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  resumeSub: { fontSize: 13, marginTop: 4, opacity: 0.9 },
  seg: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 12 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  tomeBanner: {
    marginHorizontal: 16,
    marginTop: 26,
    paddingBottom: 6,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  tomeTitle: { fontSize: 24, fontWeight: '700' },
  intro: { marginHorizontal: 16, marginBottom: 6, padding: 18, borderRadius: 18 },
  introTitle: { fontSize: 20, fontWeight: '700' },
  introText: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  group: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginTop: 22, marginBottom: 8, marginHorizontal: 20 },
  row: {
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: 1,
  },
  rowTitle: { fontSize: 17, fontWeight: '700' },
  rowSub: { fontSize: 13.5, lineHeight: 18, marginTop: 2 },
  rowMeta: { fontSize: 12, marginTop: 6 },
  bar: { height: 3, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  barFill: { height: 3, borderRadius: 2 },
});
