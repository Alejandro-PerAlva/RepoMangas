import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '../../src/db/useQuery';
import * as repo from '../../src/db/repo';
import { ensurePublisher } from '../../src/services/scraper';
import { Cover, Empty } from '../../src/components/ui';
import { C } from '../../src/theme';

export default function PublisherScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const { data: items } = useQuery(() => repo.listPublisherEditions(id), [id], []);
  const { data: pub } = useQuery(
    async () => (await repo.listEditions(`WHERE e.publisher_id = ${Number(id)}`))[0]?.publisher ?? null, [id], null as string | null);
  useEffect(() => { ensurePublisher(id).catch(() => setErr(true)).finally(() => setLoading(false)); }, [id]);
  const list = useMemo(() => items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase())), [items, q]);
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: pub ?? 'Editorial' }} />
      <TextInput value={q} onChangeText={setQ} placeholder="Filtrar catálogo…" placeholderTextColor={C.dim}
        style={{ color: C.text, backgroundColor: C.card, margin: 12, padding: 12, borderRadius: 12 }} />
      <FlashList
        data={list}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/edition/${item.id}`)}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, marginHorizontal: 12, marginVertical: 3, padding: 10, borderRadius: 10 }}>
            {item.cover_url ? <Cover uri={item.cover_url} style={{ width: 28, height: 40, marginRight: 10 }} /> : null}
            <Text style={{ color: C.text, flex: 1 }}>{item.name}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Empty text={loading ? 'Cargando catálogo…' : err ? 'Sin conexión' : 'Sin series'} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}
