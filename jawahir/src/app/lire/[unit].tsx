import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RichText } from '@/components/RichText';
import {
  Block,
  blockForPage,
  Note,
  formatPages,
  getUnit,
  neighbour,
  TOTAL_PAGES,
  unitForPage,
  unitMeta,
} from '@/lib/content';
import { actions, Settings, ThemeName, useStore } from '@/lib/store';
import { stripMarkup, queryTerms } from '@/lib/text';
import { fonts, Palette, useColors } from '@/lib/theme';

type Row =
  | { kind: 'block'; b: Block; index: number; showPage: boolean }
  | { kind: 'notesHead'; index: number; count: number }
  | { kind: 'note'; index: number; k: number; note: Note; showPage: boolean };

export default function Reader() {
  const params = useLocalSearchParams<{ unit: string; block?: string; q?: string }>();
  const unitId = String(params.unit);
  const unit = useMemo(() => getUnit(unitId), [unitId]);
  const meta = unitMeta(unitId);
  const c = useColors();
  const insets = useSafeAreaInsets();
  const settings = useStore((s) => s.settings);
  const bookmarks = useStore((s) => s.bookmarks);
  const savedBlock = useStore((s) => s.progress[unitId]?.block);

  const start = useMemo(() => {
    const n = params.block !== undefined ? parseInt(String(params.block), 10) : savedBlock ?? 0;
    return Number.isFinite(n) && unit ? Math.min(Math.max(0, n), unit.blocks.length - 1) : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, params.block]);
  const terms = useMemo(() => (params.q ? queryTerms(String(params.q)) : []), [params.q]);

  const rows: Row[] = useMemo(() => {
    if (!unit) return [];
    const out: Row[] = unit.blocks.map((b, index) => ({
      kind: 'block' as const,
      b,
      index,
      showPage: index === 0 || unit.blocks[index - 1].pg !== b.pg,
    }));
    if (unit.notes.length) {
      const base = unit.blocks.length;
      out.push({ kind: 'notesHead', index: base, count: unit.notes.length });
      unit.notes.forEach((note, k) =>
        out.push({ kind: 'note', index: base + 1 + k, k, note, showPage: k === 0 || unit.notes[k - 1].pg !== note.pg }),
      );
    }
    return out;
  }, [unit]);
  const notesStart = unit ? unit.blocks.length : 0;

  const listRef = useRef<FlashListRef<Row>>(null);
  const [cur, setCur] = useState({ index: start, pg: unit?.blocks[start]?.pg ?? 0 });
  const curRef = useRef(cur);
  const lastSave = useRef(0);
  const [sheet, setSheet] = useState<null | 'plan' | 'display'>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.keepAwake) return;
    let cancelled = false;
    const ready = activateKeepAwakeAsync('reader').catch(() => {});
    return () => {
      cancelled = true;
      ready.then(() => {
        try {
          Promise.resolve(deactivateKeepAwake('reader')).catch(() => {});
        } catch {
          // ignore
        }
      });
      void cancelled;
    };
  }, [settings.keepAwake]);

  // remember the position right away when opening
  useEffect(() => {
    if (unit) actions.setPosition(unitId, start, unit.blocks[start]?.pg ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const onViewable = useCallback(
    ({ viewableItems }: { viewableItems: { index: number | null; item: Row }[] }) => {
      const first = viewableItems.find((v) => v.index !== null);
      if (!first || first.index === null) return;
      const it = first.item;
      const next = { index: first.index, pg: it.kind === 'block' ? it.b.pg : it.kind === 'note' ? it.note.pg : (unit?.pages[1] ?? 0) };
      curRef.current = next;
      setCur(next);
      const now = Date.now();
      if (now - lastSave.current > 800) {
        lastSave.current = now;
        actions.setPosition(unitId, Math.min(next.index, (unit?.blocks.length ?? 1) - 1), next.pg);
      }
    },
    [unitId, unit],
  );

  // flush the last position when leaving
  useEffect(
    () => () => {
      const p = curRef.current;
      if (p) actions.setPosition(unitId, Math.min(p.index, (getUnit(unitId)?.blocks.length ?? 1) - 1), p.pg);
    },
    [unitId],
  );

  const [positioned, setPositioned] = useState(false);
  const [flash, setFlash] = useState<number | null>(null);
  useEffect(() => {
    if (flash === null) return;
    const t = setTimeout(() => setFlash(null), 2400);
    return () => clearTimeout(t);
  }, [flash]);

  /** Scrolls to a row (block or note) and briefly highlights it. */
  const goRow = useCallback((index: number) => {
    listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0.12 });
    setFlash(index);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      if (item.kind === 'notesHead') return <NotesHead count={item.count} c={c} s={settings} />;
      if (item.kind === 'note')
        return (
          <NoteRow
            row={item}
            s={settings}
            c={c}
            flash={flash === item.index}
            onBack={item.note.ref !== null ? () => goRow(item.note.ref as number) : undefined}
          />
        );
      return (
        <BlockView
          row={item}
          s={settings}
          c={c}
          terms={terms}
          flash={flash === item.index}
          onNote={(k) => goRow(notesStart + 1 + k)}
        />
      );
    },
    [settings, c, terms, flash, goRow, notesStart],
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const jump = (index: number) => {
    setSheet(null);
    setTimeout(() => listRef.current?.scrollToIndex({ index, animated: false }), 60);
  };

  const goToPage = (page: number) => {
    if (!unit) return;
    const target = unitForPage(page);
    setSheet(null);
    if (!target) {
      setToast(`Page ${page} introuvable (1–${TOTAL_PAGES})`);
      return;
    }
    if (target.id === unitId) {
      setTimeout(() => listRef.current?.scrollToIndex({ index: blockForPage(unit, page), animated: false }), 60);
    } else {
      const u = getUnit(target.id);
      router.replace(`/lire/${target.id}?block=${u ? blockForPage(u, page) : 0}`);
    }
  };

  const bookmarked = bookmarks.find((b) => b.unit === unitId && b.block === Math.min(cur.index, (unit?.blocks.length ?? 1) - 1));
  const toggleBookmark = () => {
    if (!unit) return;
    if (bookmarked) {
      actions.removeBookmark(bookmarked.id);
      setToast('Signet retiré');
      return;
    }
    let i = Math.min(cur.index, unit.blocks.length - 1);
    while (i < unit.blocks.length - 1 && !(unit.blocks[i].t === 'p' || unit.blocks[i].t === 'q')) i++;
    const excerpt = stripMarkup(unit.blocks[i].x).slice(0, 200);
    actions.addBookmark({ unit: unitId, block: Math.min(cur.index, unit.blocks.length - 1), pg: cur.pg, excerpt });
    setToast('Signet ajouté');
  };

  if (!unit || !meta) return null;

  const pct = Math.min(100, Math.round(((cur.index + 1) / unit.blocks.length) * 100));
  const next = neighbour(unitId, 1);
  const prev = neighbour(unitId, -1);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 4, backgroundColor: c.bg, borderColor: c.border }]}>
        <Pressable onPress={goBack} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Retour">
          <Ionicons name="chevron-back" size={26} color={c.accent} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.hTitle, { color: c.text }]} numberOfLines={1}>
            {meta.groupTitle.split(' — ')[0]} · {meta.title}
          </Text>
          <Text style={[styles.hSub, { color: c.muted }]}>
            Page {cur.pg} / {TOTAL_PAGES} · {pct} %
          </Text>
        </View>
        <Pressable onPress={toggleBookmark} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Signet">
          <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={22} color={c.accent} />
        </Pressable>
        <Pressable onPress={() => setSheet('plan')} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Plan">
          <Ionicons name="list" size={24} color={c.accent} />
        </Pressable>
        <Pressable onPress={() => setSheet('display')} hitSlop={8} style={styles.iconBtn} accessibilityLabel="Affichage">
          <Ionicons name="text" size={24} color={c.accent} />
        </Pressable>
      </View>
      <View style={{ height: 2, backgroundColor: c.card }}>
        <View style={{ height: 2, width: `${pct}%`, backgroundColor: c.accent }} />
      </View>

      <FlashList
        ref={listRef}
        data={rows}
        extraData={`${settings.fontSize}${settings.serif}${settings.showPages}${c.name}${params.q ?? ''}${flash}`}
        keyExtractor={(r: Row) => String(r.index)}
        renderItem={renderItem}
        onLoad={() => {
          if (start <= 0) return setPositioned(true);
          listRef.current?.scrollToIndex({ index: start, animated: false });
          setTimeout(() => {
            listRef.current?.scrollToIndex({ index: start, animated: false });
            setPositioned(true);
          }, 120);
        }}
        style={{ opacity: positioned ? 1 : 0 }}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 10, minimumViewTime: 150 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 24 }}
        ListFooterComponent={
          <View style={{ marginTop: 28, gap: 10 }}>
            <Text style={[styles.end, { color: c.muted }]}>— Fin de « {meta.title} » —</Text>
            {next ? (
              <Pressable
                onPress={() => router.replace(`/lire/${next.id}?block=0`)}
                style={[styles.nav, { backgroundColor: c.accent }]}
              >
                <Text style={{ color: c.onAccent, fontWeight: '700', fontSize: 15 }} numberOfLines={2}>
                  Suivant : {next.groupTitle.split(' — ')[0]} · {next.title}
                </Text>
                <Ionicons name="arrow-forward" size={20} color={c.onAccent} />
              </Pressable>
            ) : null}
            {prev ? (
              <Pressable
                onPress={() => router.replace(`/lire/${prev.id}?block=0`)}
                style={[styles.nav, { backgroundColor: c.card }]}
              >
                <Ionicons name="arrow-back" size={20} color={c.text} />
                <Text style={{ color: c.text, fontWeight: '600', fontSize: 14, flex: 1 }} numberOfLines={2}>
                  Précédent : {prev.groupTitle.split(' — ')[0]} · {prev.title}
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
      />

      {toast ? (
        <View pointerEvents="none" style={[styles.toast, { backgroundColor: c.text, bottom: insets.bottom + 28 }]}>
          <Text style={{ color: c.bg, fontWeight: '600' }}>{toast}</Text>
        </View>
      ) : null}

      <PlanSheet
        visible={sheet === 'plan'}
        onClose={() => setSheet(null)}
        plan={unit.plan}
        pages={unit.pages}
        c={c}
        onJump={jump}
        onPage={goToPage}
        currentIndex={cur.index}
        notesCount={unit.notes.length}
        notesIndex={notesStart}
      />
      <DisplaySheet visible={sheet === 'display'} onClose={() => setSheet(null)} c={c} s={settings} />
    </View>
  );
}

const BlockView = memo(function BlockView({
  row,
  s,
  c,
  terms,
  flash,
  onNote,
}: {
  row: Extract<Row, { kind: 'block' }>;
  s: Settings;
  c: Palette;
  terms: string[];
  flash: boolean;
  onNote: (k: number) => void;
}) {
  const { b } = row;
  const family = s.serif ? fonts.serif : fonts.sans;
  const fs = s.fontSize;
  const marker = s.showPages && row.showPage ? (
    <View style={styles.pageMark}>
      <View style={[styles.pageLine, { backgroundColor: c.border }]} />
      <Text style={[styles.pageText, { color: c.muted }]}>p. {b.pg}</Text>
    </View>
  ) : null;

  let body: React.ReactNode;
  switch (b.t) {
    case 'h1':
      body = (
        <RichText
          text={b.x}
          onNote={onNote}
          linkColor={c.accent}
          style={{
            fontFamily: family,
            fontSize: fs * 1.35,
            lineHeight: fs * 1.75,
            fontWeight: '700',
            color: c.accent,
            textAlign: 'center',
            marginTop: 18,
            marginBottom: 12,
          }}
        />
      );
      break;
    case 'h2':
      body = (
        <RichText
          text={b.x}
          onNote={onNote}
          linkColor={c.accent}
          style={{
            fontFamily: family,
            fontSize: fs * 1.12,
            lineHeight: fs * 1.55,
            fontWeight: '700',
            color: c.text,
            marginTop: 16,
            marginBottom: 8,
          }}
        />
      );
      break;
    case 'h3':
      body = (
        <RichText
          text={b.x}
          onNote={onNote}
          linkColor={c.accent}
          style={{
            fontFamily: family,
            fontSize: fs * 1.03,
            lineHeight: fs * 1.5,
            fontWeight: '700',
            fontStyle: 'italic',
            color: c.text,
            marginTop: 12,
            marginBottom: 6,
          }}
        />
      );
      break;
    case 'q':
      body = (
        <View style={[styles.quote, { borderColor: c.accent }]}>
          <RichText
            text={b.x}
            terms={terms}
            highlightColor={c.highlight}
            onNote={onNote}
            linkColor={c.accent}
            linkSize={fs * 1.1}
            style={{ fontFamily: family, fontSize: fs * 0.97, lineHeight: fs * 1.55, color: c.text }}
          />
        </View>
      );
      break;
    default:
      body = (
        <RichText
          text={b.x}
          terms={terms}
          highlightColor={c.highlight}
          onNote={onNote}
          linkColor={c.accent}
          linkSize={fs * 1.1}
          style={{ fontFamily: family, fontSize: fs, lineHeight: fs * 1.62, color: c.text, marginBottom: 12 }}
        />
      );
  }
  return (
    <View style={flash ? { backgroundColor: c.accentSoft, borderRadius: 8, marginHorizontal: -8, paddingHorizontal: 8 } : undefined}>
      {marker}
      {body}
    </View>
  );
});

function NotesHead({ count, c, s }: { count: number; c: Palette; s: Settings }) {
  return (
    <View style={{ marginTop: 28, marginBottom: 6 }}>
      <View style={[styles.notesRule, { backgroundColor: c.accent }]} />
      <Text
        style={{
          color: c.accent,
          fontFamily: s.serif ? fonts.serif : fonts.sans,
          fontSize: s.fontSize * 1.2,
          fontWeight: '700',
          marginTop: 10,
        }}
      >
        Notes de bas de page
      </Text>
      <Text style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>
        {count} note{count > 1 ? 's' : ''} · touchez le numéro pour revenir au texte
      </Text>
    </View>
  );
}

function NoteRow({
  row,
  s,
  c,
  flash,
  onBack,
}: {
  row: Extract<Row, { kind: 'note' }>;
  s: Settings;
  c: Palette;
  flash: boolean;
  onBack?: () => void;
}) {
  const { note } = row;
  const fs = Math.max(14, s.fontSize * 0.88);
  return (
    <View>
      {row.showPage ? (
        <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 14, marginBottom: 6 }}>
          PAGE {note.pg}
        </Text>
      ) : null}
      <View
        style={[
          styles.noteRow,
          flash && { backgroundColor: c.accentSoft },
          { borderColor: flash ? c.accent : 'transparent' },
        ]}
      >
        <Pressable
          onPress={onBack}
          disabled={!onBack}
          hitSlop={8}
          style={[styles.noteBadge, { backgroundColor: onBack ? c.accentSoft : c.card }]}
          accessibilityLabel={onBack ? `Retour à l'appel de la note ${note.n ?? ''}` : 'Note'}
        >
          <Text style={{ color: onBack ? c.accent : c.muted, fontWeight: '700', fontSize: 13 }}>
            {note.n !== null ? note.n : '•'}
          </Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: c.text,
              fontFamily: s.serif ? fonts.serif : fonts.sans,
              fontSize: fs,
              lineHeight: fs * 1.5,
            }}
          >
            {note.x}
          </Text>
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={8}>
              <Text style={{ color: c.accent, fontSize: 12.5, fontWeight: '600', marginTop: 4 }}>↩ Retour au texte</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function Sheet({
  visible,
  onClose,
  title,
  c,
  children,
  tall,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  c: Palette;
  children: React.ReactNode;
  tall?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: c.surface,
              paddingBottom: insets.bottom + 12,
              maxHeight: tall ? 560 : undefined,
              borderColor: c.border,
            },
          ]}
        >
          <View style={[styles.grab, { backgroundColor: c.border }]} />
          <View style={styles.sheetHead}>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '700', fontFamily: fonts.serif }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={{ color: c.accent, fontWeight: '700', fontSize: 15 }}>Fermer</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PlanSheet({
  visible,
  onClose,
  plan,
  pages,
  c,
  onJump,
  onPage,
  currentIndex,
  notesCount,
  notesIndex,
}: {
  visible: boolean;
  onClose: () => void;
  plan: { i: number; t: string; x: string; pg: number }[];
  pages: [number, number];
  c: Palette;
  onJump: (index: number) => void;
  onPage: (page: number) => void;
  currentIndex: number;
  notesCount: number;
  notesIndex: number;
}) {
  const [page, setPage] = useState('');
  const submit = () => {
    const n = parseInt(page, 10);
    if (Number.isFinite(n)) onPage(n);
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Aller à…" c={c} tall>
      <View style={styles.goto}>
        <TextInput
          value={page}
          onChangeText={setPage}
          keyboardType="number-pad"
          placeholder="Numéro de page"
          placeholderTextColor={c.muted}
          returnKeyType="go"
          onSubmitEditing={submit}
          style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.bg }]}
        />
        <Pressable onPress={submit} style={[styles.goBtn, { backgroundColor: c.accent }]}>
          <Text style={{ color: c.onAccent, fontWeight: '700' }}>OK</Text>
        </Pressable>
      </View>
      <Text style={{ color: c.muted, fontSize: 12.5, marginTop: 6 }}>
        Cette section : pages {pages[0]}–{pages[1]} · livre entier : 1–{TOTAL_PAGES}
      </Text>
      <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginTop: 12, marginBottom: 4 }}>
        PLAN DE CETTE SECTION
      </Text>
      {notesCount > 0 ? (
        <Pressable
          onPress={() => onJump(notesIndex)}
          style={({ pressed }) => [styles.notesLink, { backgroundColor: pressed ? c.accentSoft : c.card }]}
        >
          <Text style={{ color: c.text, fontWeight: '600', fontSize: 15 }}>Notes de bas de page</Text>
          <Text style={{ color: c.muted, fontSize: 13 }}>{notesCount} notes ›</Text>
        </Pressable>
      ) : null}
      {plan.length === 0 ? (
        <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20, paddingVertical: 8 }}>
          Cette section est un texte continu, sans sous-titres. Utilisez le numéro de page pour naviguer.
        </Text>
      ) : (
        <FlatList
          data={plan}
          keyExtractor={(p) => String(p.i)}
          style={{ flexGrow: 0 }}
          renderItem={({ item }) => {
            const active = item.i <= currentIndex && !plan.some((p) => p.i > item.i && p.i <= currentIndex);
            return (
              <Pressable
                onPress={() => onJump(item.i)}
                style={({ pressed }) => [
                  styles.planRow,
                  {
                    paddingLeft: item.t === 'h3' ? 24 : item.t === 'h2' ? 10 : 0,
                    backgroundColor: pressed || active ? c.accentSoft : 'transparent',
                  },
                ]}
              >
                <Text
                  style={{
                    flex: 1,
                    color: c.text,
                    fontSize: 15,
                    fontWeight: item.t === 'h3' ? '400' : '600',
                    fontFamily: fonts.serif,
                  }}
                  numberOfLines={3}
                >
                  {stripMarkup(item.x)}
                </Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>{formatPages([item.pg, item.pg])}</Text>
              </Pressable>
            );
          }}
        />
      )}
    </Sheet>
  );
}

const THEMES: { key: ThemeName; label: string }[] = [
  { key: 'auto', label: 'Auto' },
  { key: 'light', label: 'Clair' },
  { key: 'sepia', label: 'Sépia' },
  { key: 'dark', label: 'Sombre' },
];

function DisplaySheet({ visible, onClose, c, s }: { visible: boolean; onClose: () => void; c: Palette; s: Settings }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Affichage" c={c}>
      <View style={styles.setRow}>
        <Text style={[styles.setLabel, { color: c.text }]}>Taille du texte</Text>
        <View style={styles.stepper}>
          <Pressable
            onPress={() => actions.setSettings({ fontSize: Math.max(14, s.fontSize - 1) })}
            style={[styles.stepBtn, { borderColor: c.border, backgroundColor: c.bg }]}
            accessibilityLabel="Réduire le texte"
          >
            <Text style={{ color: c.text, fontSize: 14, fontWeight: '700' }}>A</Text>
          </Pressable>
          <Text style={{ color: c.muted, width: 34, textAlign: 'center' }}>{s.fontSize}</Text>
          <Pressable
            onPress={() => actions.setSettings({ fontSize: Math.min(32, s.fontSize + 1) })}
            style={[styles.stepBtn, { borderColor: c.border, backgroundColor: c.bg }]}
            accessibilityLabel="Agrandir le texte"
          >
            <Text style={{ color: c.text, fontSize: 22, fontWeight: '700' }}>A</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.setRow}>
        <Text style={[styles.setLabel, { color: c.text }]}>Thème</Text>
      </View>
      <View style={styles.themes}>
        {THEMES.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => actions.setSettings({ theme: t.key })}
            style={[
              styles.themeChip,
              { borderColor: s.theme === t.key ? c.accent : c.border, backgroundColor: s.theme === t.key ? c.accentSoft : c.bg },
            ]}
          >
            <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.setRow}>
        <Text style={[styles.setLabel, { color: c.text }]}>Police à empattements</Text>
        <Switch value={s.serif} onValueChange={(v) => actions.setSettings({ serif: v })} trackColor={{ true: c.accent }} />
      </View>
      <View style={styles.setRow}>
        <Text style={[styles.setLabel, { color: c.text }]}>Numéros de page du livre</Text>
        <Switch
          value={s.showPages}
          onValueChange={(v) => actions.setSettings({ showPages: v })}
          trackColor={{ true: c.accent }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingBottom: 6, gap: 2 },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  hTitle: { fontSize: 14.5, fontWeight: '700' },
  hSub: { fontSize: 12, marginTop: 1 },
  pageMark: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 8 },
  pageLine: { flex: 1, height: StyleSheet.hairlineWidth },
  pageText: { fontSize: 11, fontWeight: '600' },
  quote: { borderLeftWidth: 2, paddingLeft: 12, marginLeft: 6, marginBottom: 10 },
  notesRule: { height: 2, width: 48, borderRadius: 1 },
  noteRow: { flexDirection: 'row', gap: 10, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10, borderWidth: 1, marginBottom: 2 },
  noteBadge: { minWidth: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginTop: 1 },
  end: { textAlign: 'center', fontSize: 13, fontStyle: 'italic' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 14, justifyContent: 'space-between' },
  toast: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 8, borderWidth: StyleSheet.hairlineWidth },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 10 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  notesLink: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, marginTop: 10 },
  goto: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  goBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  planRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 11, paddingRight: 6, borderRadius: 8 },
  setRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  setLabel: { fontSize: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: { width: 44, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  themes: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  themeChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
});
