import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Cover } from './ui';
import { C } from '../theme';
import type { Volume } from '../types';

export const VolumeTile = memo(function VolumeTile({ v, onPress, onLongPress }: {
  v: Volume; onPress: (v: Volume) => void; onLongPress: (v: Volume) => void;
}) {
  const dim = !v.owned;
  return (
    <Pressable onPress={() => onPress(v)} onLongPress={() => onLongPress(v)} delayLongPress={350} style={s.wrap}>
      <View style={[s.frame, null]}>
        <Cover uri={v.cover_url} style={s.img} dim={dim} />
        {v.owned ? <View style={s.owned}><Ionicons name="library" size={11} color="#fff" /></View> : null}
        {v.read ? <View style={s.read}><Ionicons name="checkmark" size={13} color="#111" /></View> : null}
        {v.phase === 1 ? <View style={s.tag}><Text style={s.tagT}>PRÓXIMO</Text></View> : null}
      </View>
      <Text style={[s.num, dim && { opacity: 0.5 }]} numberOfLines={v.is_pack ? 2 : 1}>{v.is_pack ? v.title : `#${v.number}`}</Text>
    </Pressable>
  );
});

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 5 },
  frame: { aspectRatio: 0.68, borderRadius: 8, overflow: 'hidden', borderWidth: 0, borderColor: 'transparent' },
  img: { width: '100%', height: '100%', borderRadius: 0 },
  owned: { position: 'absolute', left: 4, bottom: 4, backgroundColor: C.accent, borderRadius: 8, padding: 3 },
  read: { position: 'absolute', right: 4, top: 4, backgroundColor: C.green, borderRadius: 9, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  wish: { position: 'absolute', left: 4, top: 4, backgroundColor: C.amber, borderRadius: 9, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  tag: { position: 'absolute', right: 0, bottom: 0, backgroundColor: C.amber, paddingHorizontal: 5, paddingVertical: 1 },
  tagT: { fontSize: 9, fontWeight: '800', color: '#111' },
  num: { color: C.dim, fontSize: 11, textAlign: 'center', marginTop: 3 },
});
