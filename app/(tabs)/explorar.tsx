import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '../../src/db/useQuery';
import * as repo from '../../src/db/repo';
import { ensureAuthor, ensurePublisher, search, type SearchResult } from '../../src/services/scraper';
import { EditionRow } from '../../src/components/EditionRow';
import { FilterBar } from '../../src/components/FilterBar';
import { Empty, SectionTitle } from '../../src/components/ui';
import { C } from '../../src/theme';
import { DEFAULT_FILTERS, applyFilters, type Filters } from '../../src/lib/filters';
import type { EditionSummary, LinkItem } from '../../src/types';

type Row =
  | { k: string; kind: 'title'; text: string }
  | { k: string; kind: 'edition'; ed: EditionSummary }
  | { k: string; kind: 'remote' | 'author' | 'publisher'; item: LinkItem };

export default function Explorar() {
  const params = useLocalSearchParams<{ format?: string; genre?: string; status?: string }>();
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [remote, setRemote] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [authorHits, setAuthorHits] = useState<LinkItem[]>([]);
  const [authorBusy, setAuthorBusy] = useState(false);
  const authorIds = useRef(new Map<string, number>());
  const authorTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { data: all } = useQuery(() => repo.listEditions(), [], []);
  const { data: pubs } = useQuery(repo.listPublishers, [], []);
  const { data: auths } = useQuery(repo.listAuthors, [], []);

  const pubId = useMemo(() => pubs.find((p) => p.name === filters.publisher)?.id ?? all.find((e) => e.publisher === filters.publisher)?.publisher_id ?? null, [pubs, all, filters.publisher]);
  const authId = useMemo(() => (filters.author ? auths.find((a) => a.name === filters.author)?.id ?? authorIds.current.get(filters.author) ?? null : null), [auths, filters.author, authorHits]);

  // remote lists for the selected publisher / author (cached in SQLite)
  const [listBusy, setListBusy] = useState(false);
  useEffect(() => {
    if (!pubId || !filters.publisher) return;
    setListBusy(true);
    ensurePublisher(pubId).catch(() => setErr('Sin conexión: catálogo de la editorial incompleto')).finally(() => setListBusy(false));
  }, [pubId, filters.publisher]);
  useEffect(() => {
    if (!authId || !filters.author) return;
    setListBusy(true);
    ensureAuthor(authId).catch(() => setErr('Sin conexión: obras del autor incompletas')).finally(() => setListBusy(false));
  }, [authId, filters.author]);
  const { data: pubItems } = useQuery(() => (pubId && filters.publisher ? repo.listPublisherEditions(pubId) : Promise.resolve([] as LinkItem[])), [pubId, filters.publisher], [] as LinkItem[]);
  const { data: authItems } = useQuery(() => (authId && filters.author ? repo.listAuthorEditions(authId) : Promise.resolve([] as LinkItem[])), [authId, filters.author], [] as LinkItem[]);

  useEffect(() => {
    setFilters((f) => ({ ...f, format: params.format ?? null, genre: params.genre ?? null, status: params.status ?? null }));
  }, [params.format, params.genre, params.status]);

  useEffect(() => {
    if (q.trim().length < 2) { setRemote(null); return; }
    setBusy(true);
    const t = setTimeout(() => {
      search(q.trim()).then((r) => { setRemote(r); setErr(null); }).catch(() => setErr('Sin conexión: mostrando solo resultados locales'))
        .finally(() => setBusy(false));
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const onSearchAuthors = useCallback((t: string) => {
    clearTimeout(authorTimer.current);
    if (t.trim().length < 2) { setAuthorHits([]); return; }
    setAuthorBusy(true);
    authorTimer.current = setTimeout(() => {
      search(t.trim()).then((r) => {
        r.authors.forEach((a) => authorIds.current.set(a.name, a.id));
        setAuthorHits(r.authors);
      }).catch(() => {}).finally(() => setAuthorBusy(false));
    }, 350);
  }, []);

  const filtered = useMemo(() => applyFilters(all, { ...filters, state: 'all' }, q), [all, filters, q]);
  const hasLocalOnlyFilter = !!(filters.format || filters.status || filters.genre);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const t = q.trim().toLowerCase();
    if (t.length >= 2 && !filters.publisher) {
      const hits = pubs.filter((p) => p.name.toLowerCase().includes(t)).slice(0, 5);
      if (hits.length) {
        out.push({ k: 'tp', kind: 'title', text: 'Editoriales' });
        hits.forEach((p) => out.push({ k: 'p' + p.id, kind: 'publisher', item: { id: p.id, name: p.name, cover_url: null } }));
      }
    }
    if (!filters.author && remote?.authors.length) {
      out.push({ k: 'ta', kind: 'title', text: 'Autores' });
      remote.authors.slice(0, 6).forEach((a) => out.push({ k: 'a' + a.id, kind: 'author', item: a }));
    }
    if (filtered.length) {
      out.push({ k: 'tl', kind: 'title', text: q || filters.publisher || filters.author ? 'En tu dispositivo' : 'Catálogo local' });
      filtered.forEach((e) => out.push({ k: 'e' + e.id, kind: 'edition', ed: e }));
    }
    if (!hasLocalOnlyFilter) {
      const localIds = new Set(all.map((e) => e.id));
      let eds: LinkItem[] = [];
      if (filters.publisher && filters.author) {
        const ids = new Set(authItems.map((i) => i.id));
        eds = pubItems.filter((i) => ids.has(i.id));
      } else if (filters.publisher) eds = pubItems;
      else if (filters.author) eds = authItems;
      else eds = remote?.editions ?? [];
      if (t && (filters.publisher || filters.author)) eds = eds.filter((e) => e.name.toLowerCase().includes(t));
      eds = eds.filter((e) => !localIds.has(e.id));
      if (eds.length) {
        out.push({ k: 'tr', kind: 'title', text: 'Listado Manga' });
        eds.forEach((e) => out.push({ k: 'r' + e.id, kind: 'remote', item: e }));
      }
    }
    return out;
  }, [filtered, remote, all, q, pubs, pubItems, authItems, filters, hasLocalOnlyFilter]);

  const pick = (r: Row) => {
    if (r.kind === 'publisher') { setQ(''); setFilters((f) => ({ ...f, publisher: r.item.name })); }
    else if (r.kind === 'author') { authorIds.current.set(r.item.name, r.item.id); setQ(''); setFilters((f) => ({ ...f, author: r.item.name })); }
    else if (r.kind === 'remote') router.push(`/edition/${r.item.id}`);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', margin: 12, marginBottom: 4, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12 }}>
        <TextInput
          value={q} onChangeText={setQ} placeholder="Título, autor o editorial…" placeholderTextColor={C.dim}
          style={{ flex: 1, color: C.text, paddingVertical: 12, fontSize: 15 }} autoCorrect={false}
        />
        {(busy || listBusy) && <ActivityIndicator color={C.accent} />}
      </View>
      <FilterBar
        filters={filters} onChange={setFilters} source={all} showState={false}
        publishers={pubs.map((p) => p.name)}
        authors={auths.map((a) => a.name).concat(authorHits.map((a) => a.name))}
        onSearchAuthors={onSearchAuthors} authorLoading={authorBusy}
      />
      {err && <Text style={{ color: C.amber, marginHorizontal: 12, fontSize: 12 }}>{err}</Text>}
      {hasLocalOnlyFilter && <Text style={{ color: C.dim, marginHorizontal: 12, fontSize: 11 }}>Formato, estado y género filtran solo series ya descargadas.</Text>}
      <FlashList
        data={rows}
        keyExtractor={(r) => r.k}
        getItemType={(r) => r.kind}
        renderItem={({ item: r }) => {
          if (r.kind === 'title') return <SectionTitle>{r.text}</SectionTitle>;
          if (r.kind === 'edition') return <EditionRow e={r.ed} />;
          return (
            <Pressable onPress={() => pick(r)} style={{ backgroundColor: C.card, marginHorizontal: 12, marginVertical: 3, padding: 14, borderRadius: 10 }}>
              <Text style={{ color: C.text, fontWeight: '600' }}>{r.item.name}</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Empty text={busy || listBusy ? 'Buscando…' : q.length >= 2 || filters.publisher || filters.author ? 'Sin resultados' : 'Busca por título, autor o editorial, o usa los filtros'} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}
