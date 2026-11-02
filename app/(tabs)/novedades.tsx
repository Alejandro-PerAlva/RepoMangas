import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useQuery } from '../../src/db/useQuery';
import * as repo from '../../src/db/repo';
import { syncMonth } from '../../src/services/scraper';
import { markRelease, tap } from '../../src/lib/actions';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native';
import { Chip, Cover, Empty, PickerModal } from '../../src/components/ui';
import { C } from '../../src/theme';
import { fmtDate } from '../../src/lib/filters';
import type { ReleaseItem } from '../../src/types';

type Row = { k: string; header?: string; r?: ReleaseItem };
type When = 'all' | 'shop' | 'soon';
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const key = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;
const label = (k: string) => `${MONTH_NAMES[parseInt(k.slice(5), 10) - 1]} ${k.slice(0, 4)}`;

export default function Novedades() {
  const [tab, setTab] = useState<'mine' | 'all'>('mine');
  const [when, setWhen] = useState<When>('all');
  const [refreshing, setRefreshing] = useState(false);
  const now = new Date();
  const [ym, setYm] = useState(key(now.getFullYear(), now.getMonth() + 1));
  const [pub, setPub] = useState<string | null>(null);
  const [pickMonth, setPickMonth] = useState(false);
  const [pickPub, setPickPub] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const shift = (d: number) => {
    const t = new Date(+ym.slice(0, 4), +ym.slice(5) - 1 + d, 1);
    setYm(key(t.getFullYear(), t.getMonth() + 1)); setPub(null);
  };
  const months = useMemo(() => Array.from({ length: 49 }, (_, i) => {
    const t = new Date(now.getFullYear(), now.getMonth() + 12 - i, 1);
    const k = key(t.getFullYear(), t.getMonth() + 1);
    return { key: k, label: label(k) };
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const load = useCallback(async (force = false) => {
    setLoading(true); setError(false);
    try { await syncMonth(+ym.slice(0, 4), +ym.slice(5), force); } catch { setError(true); }
    setLoading(false);
  }, [ym]);
  useEffect(() => { load(); }, [load]);
  const { data: rel } = useQuery(repo.listReleases, [], []);
  const today = repo.todayISO();

  const rows = useMemo<Row[]>(() => {
    let l = rel.filter((r) => r.date.startsWith(ym) && (tab === 'all' ? true : r.mine === 1) && (!pub || r.publisher === pub));
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
  }, [rel, tab, when, today, ym, pub]);
  const pubOpts = useMemo(() => [...new Set(rel.filter((r) => r.date.startsWith(ym)).map((r) => r.publisher))].sort((a, b) => a.localeCompare(b, 'es')).map((p) => ({ key: p, label: p })), [rel, ym]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  const mark = (r: ReleaseItem) => {
    tap();
    markRelease(r).catch((e) => Alert.alert('Error', String(e.message ?? e)));
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingTop: 8 }}>
        <Pressable onPress={() => shift(-1)} hitSlop={10} style={{ padding: 8 }}><Ionicons name="chevron-back" size={24} color={C.text} /></Pressable>
        <Pressable onPress={() => setPickMonth(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: C.text, fontSize: 18, fontWeight: '800' }}>{label(ym)}</Text>
          <Ionicons name="caret-down" size={14} color={C.dim} style={{ marginLeft: 6 }} />
          {loading && <ActivityIndicator color={C.accent} style={{ marginLeft: 8 }} />}
        </Pressable>
        <Pressable onPress={() => shift(1)} hitSlop={10} style={{ padding: 8 }}><Ionicons name="chevron-forward" size={24} color={C.text} /></Pressable>
      </View>
      <View style={{ flexDirection: 'row', padding: 12, paddingBottom: 6 }}>
        <Chip label="De mis series" active={tab === 'mine'} onPress={() => setTab('mine')} />
        <Chip label="Todas las novedades" active={tab === 'all'} onPress={() => setTab('all')} />
      </View>
      <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 6, flexWrap: 'wrap', rowGap: 6 }}>
        <Chip label={pub ? `Editorial: ${pub}` : 'Editorial'} icon="business" active={!!pub} onPress={() => setPickPub(true)} />
        <Chip label="Todo" active={when === 'all'} onPress={() => setWhen('all')} />
        <Chip label="Ya en tiendas" icon="storefront" active={when === 'shop'} onPress={() => setWhen('shop')} />
        <Chip label="Próximamente" icon="time" active={when === 'soon'} onPress={() => setWhen('soon')} />
      </View>
      {error && <Text style={{ color: C.amber, marginHorizontal: 12, fontSize: 12 }}>Sin conexión: mostrando lo guardado de este mes.</Text>}
      <PickerModal visible={pickMonth} title="Mes y año" options={months} selected={ym} allLabel={null}
        onSelect={(k) => { if (k) { setYm(k); setPub(null); } }} onClose={() => setPickMonth(false)} />
      <PickerModal visible={pickPub} title="Editorial" options={pubOpts} selected={pub} searchable
        onSelect={setPub} onClose={() => setPickPub(false)} />
      <FlashList
        data={rows}
        keyExtractor={(r) => r.k}
        getItemType={(r) => (r.header ? 'h' : 'r')}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.accent} />}
        ListEmptyComponent={<Empty text={tab === 'mine' ? 'Aún no hay novedades de tus series. Marca tomos como "Tengo" o añade una colección a Deseos.' : 'Sin novedades. Desliza para actualizar.'} />}
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
                {past ? <Chip label={r.owned ? 'Tengo ✓' : 'Tengo'} active={!!r.owned} onPress={() => mark(r)} /> : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
