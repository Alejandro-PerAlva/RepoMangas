import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useQuery } from '../../src/db/useQuery';
import * as repo from '../../src/db/repo';
import { syncNovedades } from '../../src/services/scraper';
import { markRelease, tap } from '../../src/lib/actions';
import { Chip, Cover, Empty } from '../../src/components/ui';
import { C } from '../../src/theme';
import { fmtDate } from '../../src/lib/filters';
import type { ReleaseItem } from '../../src/types';

type Row = { k: string; header?: string; r?: ReleaseItem };
type When = 'all' | 'shop' | 'soon';

export default function Novedades() {
  const [tab, setTab] = useState<'mine' | 'all'>('mine');
  const [when, setWhen] = useState<When>('all');
  const [refreshing, setRefreshing] = useState(false);
  const { data: rel } = useQuery(repo.listReleases, [], []);
  const today = repo.todayISO();

  const rows = useMemo<Row[]>(() => {
    let l = rel.filter((r) => (tab === 'all' ? true : r.mine === 1));
    if (when === 'shop') l = l.filter((r) => r.date <= today);
    if (when === 'soon') l = l.filter((r) => r.date > today);
    const out: Row[] = [];
    if (tab === 'all') {
      const by = new Map<string, ReleaseItem[]>();
      l.forEach((r) => by.set(r.publisher, [...(by.get(r.publisher) ?? []), r]));
      [...by.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es')).forEach(([p, items]) => {
        out.push({ k: 'h' + p, header: p });
        items.sort((a, b) => a.date.localeCompare(b.date)).forEach((r) => out.push({ k: 'r' + r.id, r }));
      });
    } else {
      let last = '';
      l.forEach((r) => {
        if (r.date !== last) { out.push({ k: 'd' + r.date, header: fmtDate(r.date) }); last = r.date; }
        out.push({ k: 'r' + r.id, r });
      });
    }
    return out;
  }, [rel, tab, when, today]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await syncNovedades().catch(() => Alert.alert('Sin conexión', 'No se pudieron actualizar las novedades.'));
    setRefreshing(false);
  }, []);

  const mark = (r: ReleaseItem, f: 'owned' | 'wishlisted') => {
    tap();
    markRelease(r, f).catch((e) => Alert.alert('Error', String(e.message ?? e)));
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', padding: 12, paddingBottom: 0 }}>
        <Chip label="De mis series" active={tab === 'mine'} onPress={() => setTab('mine')} />
        <Chip label="Todas las novedades" active={tab === 'all'} onPress={() => setTab('all')} />
      </View>
      <View style={{ flexDirection: 'row', paddingHorizontal: 12 }}>
        <Chip label="Todo" active={when === 'all'} onPress={() => setWhen('all')} />
        <Chip label="Ya en tiendas" icon="storefront" active={when === 'shop'} onPress={() => setWhen('shop')} />
        <Chip label="Próximamente" icon="time" active={when === 'soon'} onPress={() => setWhen('soon')} />
      </View>
      <FlashList
        data={rows}
        keyExtractor={(r) => r.k}
        getItemType={(r) => (r.header ? 'h' : 'r')}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.accent} />}
        ListEmptyComponent={<Empty text={tab === 'mine' ? 'Aún no hay novedades de tus series. Marca tomos como "Tengo" o "Quiero" para seguirlas.' : 'Sin novedades. Desliza para actualizar.'} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => {
          if (item.header) return <Text style={{ color: C.accent, fontWeight: '800', fontSize: 15, padding: 12, paddingBottom: 4 }}>{item.header}</Text>;
          const r = item.r!;
          const past = r.date <= today;
          return (
            <Pressable onPress={() => router.push(`/edition/${r.edition_id}`)}
              style={{ flexDirection: 'row', backgroundColor: C.card, marginHorizontal: 12, marginVertical: 4, padding: 10, borderRadius: 12, alignItems: 'center' }}>
              <Cover uri={r.cover_url} style={{ width: 50, height: 72 }} />
              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <Text style={{ color: C.text, fontWeight: '700' }} numberOfLines={2}>{r.title}</Text>
                <Text style={{ color: past ? C.green : C.amber, fontSize: 12, marginTop: 4 }}>
                  {fmtDate(r.date)} · {past ? 'Ya en tiendas' : 'Próximamente'}
                </Text>
                {tab === 'mine' && <Text style={{ color: C.dim, fontSize: 12 }}>{r.publisher}</Text>}
              </View>
              <View style={{ gap: 6 }}>
                <Chip label={r.wishlisted ? 'Quiero ✓' : 'Quiero'} color={C.amber} active={!!r.wishlisted} onPress={() => mark(r, 'wishlisted')} />
                <Chip label={r.owned ? 'Tengo ✓' : 'Tengo'} active={!!r.owned} onPress={() => mark(r, 'owned')} />
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
