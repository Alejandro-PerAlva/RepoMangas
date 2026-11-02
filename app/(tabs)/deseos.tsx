import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useQuery } from '../../src/db/useQuery';
import * as repo from '../../src/db/repo';
import { Chip, Cover, Empty } from '../../src/components/ui';
import { C } from '../../src/theme';
import { eur, fmtDate } from '../../src/lib/filters';
import { tap } from '../../src/lib/actions';

export default function Deseos() {
  const { data } = useQuery(repo.listWishlist, [], []);
  const today = repo.todayISO();
  const rows = useMemo(() => {
    const shop = data.filter((v) => v.release_date && v.release_date <= today);
    const soon = data.filter((v) => !v.release_date || v.release_date > today);
    const sum = (a: typeof data) => a.reduce((t, v) => t + (v.price ?? 0), 0);
    return [
      ...(shop.length ? [{ k: 'h1', h: `Ya a la venta · ${shop.length} · ${eur(sum(shop))}` }, ...shop.map((v) => ({ k: 'v' + v.id, v }))] : []),
      ...(soon.length ? [{ k: 'h2', h: `Próximamente / sin fecha · ${soon.length} · ${eur(sum(soon))}` }, ...soon.map((v) => ({ k: 'v' + v.id, v }))] : []),
    ] as { k: string; h?: string; v?: (typeof data)[number] }[];
  }, [data, today]);
  return (
    <FlashList
      data={rows}
      keyExtractor={(r) => r.k}
      getItemType={(r) => (r.h ? 'h' : 'v')}
      ListEmptyComponent={<Empty text="Tu lista de deseos está vacía. Marca tomos con ★ Quiero desde una serie o desde Novedades." />}
      ListHeaderComponent={data.length ? (
        <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', padding: 12 }}>
          Presupuesto total: {eur(data.reduce((t, v) => t + (v.price ?? 0), 0))}
        </Text>) : null}
      contentContainerStyle={{ paddingBottom: 24 }}
      renderItem={({ item }) => {
        if (item.h) return <Text style={{ color: C.accent, fontWeight: '800', padding: 12, paddingBottom: 4 }}>{item.h}</Text>;
        const v = item.v!;
        return (
          <Pressable onPress={() => router.push(`/edition/${v.edition_id}`)}
            style={{ flexDirection: 'row', backgroundColor: C.card, marginHorizontal: 12, marginVertical: 4, padding: 10, borderRadius: 12, alignItems: 'center' }}>
            <Cover uri={v.cover_url} style={{ width: 46, height: 66 }} />
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={{ color: C.text, fontWeight: '700' }} numberOfLines={2}>{v.title}</Text>
              <Text style={{ color: C.dim, fontSize: 11 }} numberOfLines={1}>{v.edition_name}</Text>
              <Text style={{ color: C.dim, fontSize: 12, marginTop: 3 }}>{fmtDate(v.release_date)} · {v.price != null ? eur(v.price) : 'n/d'}</Text>
              {v.tag ? <Text style={{ color: C.amber, fontSize: 11, fontWeight: '700', marginTop: 2 }}>{v.tag}</Text> : null}
            </View>
            <View style={{ gap: 6 }}>
              <Chip label="Tengo" icon="library" onPress={() => { tap(); repo.setVolumeFlag(v.id, 'owned', true); }} />
              <Chip label="Quitar" icon="close" onPress={() => { tap(); repo.setVolumeFlag(v.id, 'wishlisted', false); }} />
            </View>
          </Pressable>
        );
      }}
    />
  );
}
