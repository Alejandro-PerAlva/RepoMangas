import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Cover, ProgressBar, statusColor } from './ui';
import { C } from '../theme';
import { eur, progress } from '../lib/filters';
import type { EditionSummary } from '../types';

export const EditionRow = memo(function EditionRow({ e, wish }: { e: EditionSummary; wish?: boolean }) {
  const total = Math.max(e.vol_count, e.total_es ?? 0);
  return (
    <Pressable style={s.row} onPress={() => router.push(`/edition/${e.id}`)}>
      <Cover uri={e.cover_url} style={{ width: 54, height: 78 }} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.title} numberOfLines={2}>{e.name}</Text>
        <Text style={s.sub} numberOfLines={1}>{[e.publisher, e.format].filter(Boolean).join(' · ')}</Text>
        <Text style={s.sub} numberOfLines={1}>
          <Text style={{ color: statusColor(e.status), fontWeight: '700' }}>{e.status}</Text>
          {e.total_es ? ` · ${e.total_es} en España` : ''}{e.total_jp ? ` · ${e.total_jp} en ${e.origin_lang === 'japonés' || !e.origin_lang ? 'Japón' : e.origin_lang}` : ''}
        </Text>
        {wish ? (
          <Text style={[s.sub, { color: C.text, fontWeight: '700' }]}>
            Me faltan {e.wish_count} {e.wish_count === 1 ? 'tomo' : 'tomos'} · {eur(e.wish_price)}
          </Text>
        ) : (
        <View style={{ marginTop: 6 }}>
          <ProgressBar value={progress(e)} />
          <Text style={s.sub}>
            {e.owned_count}/{total || '?'} tomos · {e.read_count} leídos{e.followed ? ' · ★ en deseos' : ''}
          </Text>
        </View>
        )}
      </View>
    </Pressable>
  );
});

const s = StyleSheet.create({
  row: { flexDirection: 'row', backgroundColor: C.card, marginHorizontal: 12, marginVertical: 5, padding: 10, borderRadius: 12 },
  title: { color: C.text, fontSize: 15, fontWeight: '700' },
  sub: { color: C.dim, fontSize: 12, marginTop: 3 },
});
