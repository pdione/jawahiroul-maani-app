import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { actions, ThemeName, useStore } from '@/lib/store';
import { fonts, useColors } from '@/lib/theme';

const THEMES: { key: ThemeName; label: string }[] = [
  { key: 'auto', label: 'Auto' },
  { key: 'light', label: 'Clair' },
  { key: 'sepia', label: 'Sépia' },
  { key: 'dark', label: 'Sombre' },
];

export default function SettingsScreen() {
  const c = useColors();
  const s = useStore((st) => st.settings);

  const reset = () => {
    Alert.alert('Réinitialiser la progression ?', 'Les signets sont conservés.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Réinitialiser', style: 'destructive', onPress: () => actions.resetProgress() },
    ]);
  };

  return (
    <Screen title="Réglages">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 16 }}>
        <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.label, { color: c.text }]}>Thème</Text>
          <View style={styles.row}>
            {THEMES.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => actions.setSettings({ theme: t.key })}
                style={[
                  styles.chip,
                  {
                    borderColor: s.theme === t.key ? c.accent : c.border,
                    backgroundColor: s.theme === t.key ? c.accentSoft : c.bg,
                  },
                ]}
              >
                <Text style={{ color: c.text, fontWeight: '600' }}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={[styles.line, { borderColor: c.border }]}>
            <Text style={[styles.label, { color: c.text }]}>Taille du texte</Text>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => actions.setSettings({ fontSize: Math.max(14, s.fontSize - 1) })}
                style={[styles.step, { borderColor: c.border, backgroundColor: c.bg }]}
                accessibilityLabel="Réduire le texte"
              >
                <Text style={{ color: c.text, fontSize: 14, fontWeight: '700' }}>A</Text>
              </Pressable>
              <Text style={{ color: c.muted, width: 30, textAlign: 'center' }}>{s.fontSize}</Text>
              <Pressable
                onPress={() => actions.setSettings({ fontSize: Math.min(32, s.fontSize + 1) })}
                style={[styles.step, { borderColor: c.border, backgroundColor: c.bg }]}
                accessibilityLabel="Agrandir le texte"
              >
                <Text style={{ color: c.text, fontSize: 22, fontWeight: '700' }}>A</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.sample, { backgroundColor: c.bg, borderColor: c.border }]}>
            <Text
              style={{
                color: c.text,
                fontSize: s.fontSize,
                lineHeight: s.fontSize * 1.62,
                fontFamily: s.serif ? fonts.serif : fonts.sans,
              }}
            >
              Louange à Allah qui a guidé ceux qu’il a sélectionnés parmi ses serviteurs au droit chemin.
            </Text>
          </View>

          <View style={[styles.line, { borderColor: c.border }]}>
            <Text style={[styles.label, { color: c.text }]}>Police à empattements</Text>
            <Switch value={s.serif} onValueChange={(v) => actions.setSettings({ serif: v })} trackColor={{ true: c.accent }} />
          </View>
          <View style={[styles.line, { borderColor: c.border }]}>
            <Text style={[styles.label, { color: c.text }]}>Numéros de page du livre</Text>
            <Switch value={s.showPages} onValueChange={(v) => actions.setSettings({ showPages: v })} trackColor={{ true: c.accent }} />
          </View>
          <View style={[styles.line, { borderColor: c.border }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.label, { color: c.text }]}>Garder l’écran allumé</Text>
              <Text style={{ color: c.muted, fontSize: 12.5, marginTop: 2 }}>Pendant la lecture.</Text>
            </View>
            <Switch value={s.keepAwake} onValueChange={(v) => actions.setSettings({ keepAwake: v })} trackColor={{ true: c.accent }} />
          </View>
        </View>

        <Pressable onPress={reset} style={[styles.group, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={{ color: '#B3402F', fontSize: 16, fontWeight: '600' }}>Réinitialiser la progression de lecture</Text>
        </Pressable>

        <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.label, { color: c.text, fontFamily: fonts.serif }]}>À propos</Text>
          <Text style={[styles.about, { color: c.muted }]}>
            « Perles des significations et exaucement des souhaits » (Jawahir al-Maâni), Tomes I et II, de Sidi Ali
            Harazem Berrada. Texte français : traduction du Pr Ahmed Ibn Abdallah Skiredj, Patrimoine Tidjani.
          </Text>
          <Text style={[styles.about, { color: c.muted }]}>
            Cette application est un lecteur : le texte est intégré, la lecture fonctionne sans connexion. Les numéros
            de page sont ceux de l’édition PDF (557 pages). L’index par thèmes est généré automatiquement à partir du
            texte et peut contenir des passages approximatifs.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 12 },
  label: { fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  step: { width: 44, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sample: { padding: 14, borderRadius: 10, borderWidth: 1 },
  about: { fontSize: 13.5, lineHeight: 20 },
});
