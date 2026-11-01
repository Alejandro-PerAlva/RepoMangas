import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Cover, ProgressBar } from './ui';
import { C } from '../theme';
import { progress } from '../lib/filters';
import type { EditionSummary } from '../types';

export const EditionRow = memo(function EditionRow({ e }: { e: EditionSummary }) {
  const total = Math.max(e.vol_count, e.total_es ?? 0);
  return (
    <Pressable style={s.row} onPress={() => router.push(`/edition/${e.id}`)}>
      <Cover uri={e.cover_url} style={{ width: 54, height: 78 }} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.title} numberOfLines={2}>{e.name}</Text>
        <Text style={s.sub} numberOfLines={1}>{[e.publisher, e.format, e.status].filter(Boolean).join(' · ')}</Text>
        <View style={{ marginTop: 8 }}>
          <ProgressBar value={progress(e)} />
          <Text style={s.sub}>
            {e.owned_count}/{total || '?'} tomos · {e.read_count} leídos{e.wish_count ? ` · ${e.wish_count} ★` : ''}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

const s = StyleSheet.create({
  row: { flexDirection: 'row', backgroundColor: C.card, marginHorizontal: 12, marginVertical: 5, padding: 10, borderRadius: 12 },
  title: { color: C.text, fontSize: 15, fontWeight: '700' },
  sub: { color: C.dim, fontSize: 12, marginTop: 3 },
});
