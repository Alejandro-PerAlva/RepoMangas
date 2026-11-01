import React, { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '../../src/db/useQuery';
import * as repo from '../../src/db/repo';
import { ensureAuthor } from '../../src/services/scraper';
import { Cover, Empty } from '../../src/components/ui';
import { C } from '../../src/theme';

export default function AuthorScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const { data: items } = useQuery(() => repo.listAuthorEditions(id), [id], []);
  const { data: name } = useQuery(() => repo.getAuthorName(id), [id], null as string | null);
  useEffect(() => { ensureAuthor(id).catch(() => setErr(true)).finally(() => setLoading(false)); }, [id]);
  return (
    <>
      <Stack.Screen options={{ title: name ?? 'Autor' }} />
      <FlashList
        data={items}
        numColumns={3}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/edition/${item.id}`)} style={{ flex: 1, padding: 5 }}>
            <Cover uri={item.cover_url} style={{ width: '100%', aspectRatio: 0.68 }} />
            <Text style={{ color: C.text, fontSize: 11, marginTop: 4 }} numberOfLines={2}>{item.name}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Empty text={loading ? 'Cargando obras…' : err ? 'Sin conexión' : 'Sin obras'} />}
        contentContainerStyle={{ padding: 7 }}
      />
    </>
  );
}
