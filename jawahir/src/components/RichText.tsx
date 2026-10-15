import { memo } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { highlightRanges, parseMarkup } from '@/lib/text';

interface Props {
  text: string;
  style?: StyleProp<TextStyle>;
  terms?: string[];
  highlightColor?: string;
  numberOfLines?: number;
  onNote?: (index: number) => void;
  linkColor?: string;
  linkSize?: number;
}

export const RichText = memo(function RichText({ text, style, terms, highlightColor, numberOfLines, onNote, linkColor, linkSize }: Props) {
  const spans = parseMarkup(text);
  const plain = spans.map((s) => s.s).join('');
  const ranges = terms && terms.length ? highlightRanges(plain, terms) : [];
  const children: React.ReactNode[] = [];
  let off = 0;
  spans.forEach((sp, k) => {
    const st: TextStyle = {};
    if (sp.b) st.fontWeight = '700';
    if (sp.i) st.fontStyle = 'italic';
    const end = off + sp.s.length;
    if (sp.note !== undefined) {
      const idx = sp.note;
      children.push(
        <Text
          key={k}
          onPress={onNote ? () => onNote(idx) : undefined}
          suppressHighlighting={false}
          style={[st, { color: linkColor ?? '#1E6A57', fontWeight: '700', fontSize: linkSize }]}
          accessibilityRole="link"
          accessibilityLabel={`Note ${sp.s}`}
        >
          {`\u2009${sp.s}\u2009`}
        </Text>,
      );
      off = end;
      return;
    }
    if (!ranges.length) {
      children.push(
        <Text key={k} style={st}>
          {sp.s}
        </Text>,
      );
      off = end;
      return;
    }
    let pos = 0;
    let n = 0;
    for (const [a, b] of ranges) {
      if (b <= off || a >= end) continue;
      const s0 = Math.max(a, off) - off;
      const s1 = Math.min(b, end) - off;
      if (s0 > pos)
        children.push(
          <Text key={`${k}-${n++}`} style={st}>
            {sp.s.slice(pos, s0)}
          </Text>,
        );
      children.push(
        <Text key={`${k}-${n++}`} style={[st, { backgroundColor: highlightColor ?? '#FFE08A' }]}>
          {sp.s.slice(s0, s1)}
        </Text>,
      );
      pos = s1;
    }
    if (pos < sp.s.length)
      children.push(
        <Text key={`${k}-${n++}`} style={st}>
          {sp.s.slice(pos)}
        </Text>,
      );
    off = end;
  });
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
});
