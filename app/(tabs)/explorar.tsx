import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '../../src/db/useQuery';
import * as repo from '../../src/db/repo';
import { search, type SearchResult } from '../../src/services/scraper';
import { EditionRow } from '../../src/components/EditionRow';
import { FilterBar } from '../../src/components/FilterBar';
import { Empty, SectionTitle } from '../../src/components/ui';
import { C } from '../../src/theme';
import { DEFAULT_FILTERS, applyFilters, type Filters } from '../../src/lib/filters';
import type { LinkItem } from '../../src/types';

type Row = { k: string; kind: 'title' | 'edition' | 'remote' | 'author' | 'empty'; text?: string; ed?: any; item?: LinkItem };

export default function Explorar() {
  const params = useLocalSearchParams<{ format?: string; genre?: string; status?: string }>();
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [remote, setRemote] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { data: all } = useQuery(() => repo.listEditions(), [], []);

  useEffect(() => {
    setFilters((f) => ({ ...f, format: params.format ?? null, genre: params.genre ?? null, status: params.status ?? null }));
  }, [params.format, params.genre, params.status]);

  useEffect(() => {
    if (q.trim().length < 2) { setRemote(null); setErr(null); return; }
    setBusy(true);
    const t = setTimeout(() => {
      search(q.trim()).then((r) => { setRemote(r); setErr(null); }).catch(() => setErr('Sin conexión: mostrando solo resultados locales'))
        .finally(() => setBusy(false));
    }, 450);
    return () => clearTimeout(t);
  }, [q]);

  const local = useMemo(() => applyFilters(all, { ...filters, state: 'all' }, q), [all, filters, q]);
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (local.length) {
      out.push({ k: 'tl', kind: 'title', text: q ? 'En tu dispositivo' : 'Catálogo local' });
      local.forEach((e) => out.push({ k: 'e' + e.id, kind: 'edition', ed: e }));
    }
    const localIds = new Set(all.map((e) => e.id));
    const eds = (remote?.editions ?? []).filter((e) => !localIds.has(e.id));
    if (eds.length) {
      out.push({ k: 'tr', kind: 'title', text: 'Listado Manga' });
      eds.forEach((e) => out.push({ k: 'r' + e.id, kind: 'remote', item: e }));
    }
    if (remote?.authors.length) {
      out.push({ k: 'ta', kind: 'title', text: 'Autores' });
      remote.authors.forEach((a) => out.push({ k: 'a' + a.id, kind: 'author', item: a }));
    }
    return out;
  }, [local, remote, all, q]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', margin: 12, marginBottom: 0, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12 }}>
        <TextInput
          value={q} onChangeText={setQ} placeholder="Buscar serie o autor…" placeholderTextColor={C.dim}
          style={{ flex: 1, color: C.text, paddingVertical: 12, fontSize: 15 }} autoCorrect={false}
        />
        {busy && <ActivityIndicator color={C.accent} />}
      </View>
      <FilterBar filters={filters} onChange={setFilters} source={all} showState={false} />
      {err && <Text style={{ color: C.amber, marginHorizontal: 12, marginTop: 6, fontSize: 12 }}>{err}</Text>}
      <FlashList
        data={rows}
        keyExtractor={(r) => r.k}
        getItemType={(r) => r.kind}
        renderItem={({ item: r }) => {
          if (r.kind === 'title') return <SectionTitle>{r.text}</SectionTitle>;
          if (r.kind === 'edition') return <EditionRow e={r.ed} />;
          const go = () => router.push(r.kind === 'author' ? `/author/${r.item!.id}` : `/edition/${r.item!.id}`);
          return (
            <Pressable onPress={go} style={{ backgroundColor: C.card, marginHorizontal: 12, marginVertical: 3, padding: 14, borderRadius: 10 }}>
              <Text style={{ color: C.text, fontWeight: '600' }}>{r.item!.name}</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Empty text={q.length >= 2 ? (busy ? 'Buscando…' : 'Sin resultados') : 'Escribe para buscar en Listado Manga'} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}
