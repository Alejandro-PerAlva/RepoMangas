import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '../../src/db/useQuery';
import * as repo from '../../src/db/repo';
import { ensureEdition, ensureAuthor, scrapeEdition } from '../../src/services/scraper';
import { VolumeTile } from '../../src/components/VolumeTile';
import { VolumeSheet } from '../../src/components/VolumeSheet';
import { Btn, Chip, Cover, ProgressBar, SectionTitle, StatusPill } from '../../src/components/ui';
import { C } from '../../src/theme';
import { isOut, progress } from '../../src/lib/filters';
import { thump, tap } from '../../src/lib/actions';
import type { Volume } from '../../src/types';

export default function EditionScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const [sel, setSel] = useState<Volume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [fullSyn, setFullSyn] = useState(false);

  const { data: ed } = useQuery(() => repo.getEdition(id), [id], null);
  const { data: meta } = useQuery(() => repo.getEditionMeta(id), [id], null);
  const { data: allVols } = useQuery(() => repo.listVolumes(id), [id], [] as Volume[]);
  const regular = useMemo(() => allVols.filter((v) => !v.is_pack), [allVols]);
  const edited = useMemo(() => regular.filter((v) => v.phase === 0), [regular]);
  const preparing = useMemo(() => regular.filter((v) => v.phase === 1), [regular]);
  const unreleased = useMemo(() => regular.filter((v) => v.phase === 2), [regular]);
  const dead = useRef(false);
  const packs = useMemo(() => allVols.filter((v) => v.is_pack), [allVols]);
  const { data: authors } = useQuery(() => repo.getEditionAuthors(id), [id], []);
  const firstAuthor = authors[0]?.id;
  const { data: more } = useQuery(
    async () => (firstAuthor ? (await repo.listAuthorEditions(firstAuthor)).filter((m) => m.id !== id) : []),
    [firstAuthor, id], []);

  const load = useCallback(async (force = false) => {
    setLoading(true); setError(null);
    try {
      await ensureEdition(id, force);
      if (dead.current) { repo.purgeEditionIfUnused(id); return; }
      // refresh ongoing series in the background when the stored data is older than 3 days
      const m = await repo.getEditionMeta(id);
      if (!force && m && Date.now() - m.scraped_at > 3 * 86400_000) scrapeEdition(id).catch(() => {});
    } catch { setError('No se pudo cargar. Comprueba tu conexión.'); }
    setLoading(false);
  }, [id]);
  useEffect(() => {
    dead.current = false;
    load();
    // al salir, la ficha descargada se borra salvo que esté en colección, deseos o seguida
    return () => { dead.current = true; repo.purgeEditionIfUnused(id).catch(() => {}); };
  }, [load, id]);
  useEffect(() => { if (firstAuthor) ensureAuthor(firstAuthor).catch(() => {}); }, [firstAuthor]);

  const onPress = useCallback((v: Volume) => { tap(); setSel(v); }, []);
  const onLong = useCallback((v: Volume) => { if (!isOut(v, repo.todayISO())) return; thump(); repo.setVolumeFlag(v.id, 'owned', !v.owned); }, []);

  type Row = { k: string; t: 'title' | 'grid' | 'empty'; text?: string; items?: Volume[] };
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const add = (key: string, label: string, list: Volume[]) => {
      if (!list.length) return;
      out.push({ k: key, t: 'title', text: `${label} (${list.length})` });
      for (let i = 0; i < list.length; i += 3) out.push({ k: `${key}${i}`, t: 'grid', items: list.slice(i, i + 3) });
    };
    add('e', 'Números editados', edited);
    add('p', 'Números en preparación', preparing);
    add('u', 'Números no editados', unreleased);
    return out;
  }, [edited, preparing, unreleased]);

  const bulk = (a: repo.BulkAction) => { tap(); setMenu(false); repo.bulkAction(id, a); };

  const header = ed ? (
    <View style={{ padding: 12 }}>
      <View style={{ flexDirection: 'row' }}>
        <Cover uri={ed.cover_url} style={{ width: 90, height: 130 }} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: C.text, fontSize: 18, fontWeight: '800' }}>{ed.name}</Text>
          <Text style={{ color: C.dim, marginTop: 4 }}>
            {ed.owned_count}/{ed.vol_count} tomos · {ed.read_count} leídos
          </Text>
          <View style={{ marginTop: 8 }}><ProgressBar value={progress(ed)} /></View>
          {meta?.original_title ? <Text style={{ color: C.dim, fontSize: 12, marginTop: 6 }} numberOfLines={2}>{meta.original_title}</Text> : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        <StatusPill region="España" status={ed.status} count={ed.total_es} />
        <StatusPill region={ed.origin_lang && ed.origin_lang !== 'japonés' ? ed.origin_lang : 'Japón'} status={ed.status_jp} count={ed.total_jp} />
      </View>
      {preparing.length + unreleased.length > 0 ? (
        <Text style={{ color: C.dim, fontSize: 12, marginTop: 6 }}>
          {edited.length} editados{preparing.length ? ` · ${preparing.length} en preparación` : ''}{unreleased.length ? ` · ${unreleased.length} sin editar` : ''}
        </Text>
      ) : ed.total_jp && ed.total_es && ed.total_jp === ed.total_es ? (
        <Text style={{ color: C.dim, fontSize: 12, marginTop: 6 }}>Edición al día con el original.</Text>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12, rowGap: 6 }}>
        {authors.map((a) => <Chip key={a.id} icon="person" label={a.name} onPress={() => router.push(`/author/${a.id}`)} />)}
        {ed.publisher_id && ed.publisher ? <Chip icon="business" label={ed.publisher} onPress={() => router.push(`/publisher/${ed.publisher_id}`)} /> : null}
        {ed.format ? <Chip icon="book" label={`${ed.format}${ed.size ? ` ${ed.size}` : ''}`} /> : null}
        {ed.genre ? <Chip icon="pricetag" label={ed.genre} /> : null}
        {meta?.reading_dir ? <Chip icon="arrow-forward" label={`Lectura ${meta.reading_dir.toLowerCase()}`} /> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <Btn label={ed.followed ? 'En deseos ✓' : 'Deseo'} icon="star" kind={ed.followed ? 'amber' : 'default'}
          onPress={() => { tap(); repo.setFollowed(id, !ed.followed); }} style={{ flex: 1 }} />
        <Btn label="Acciones" icon="flash" onPress={() => setMenu((m) => !m)} style={{ flex: 1 }} />
      </View>
      {menu && (
        <View style={{ backgroundColor: C.card, borderRadius: 10, padding: 8, marginTop: 8, gap: 6 }}>
          <Btn label="Marcar como tenidos los ya publicados" icon="library" onPress={() => bulk('ownAll')} />
          <Btn label="Marcar leídos todos los que tengo" icon="checkmark-done" onPress={() => bulk('readOwned')} />
          <Btn label="Borrar mi progreso de esta serie" icon="trash" kind="danger"
            onPress={() => Alert.alert('¿Borrar progreso?', ed.name, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Borrar', style: 'destructive', onPress: () => bulk('clear') }])} />
        </View>
      )}
      {meta?.synopsis ? (
        <Pressable onPress={() => setFullSyn((v) => !v)}>
          <Text style={{ color: C.dim, marginTop: 12, lineHeight: 20 }} numberOfLines={fullSyn ? undefined : 4}>{meta.synopsis}</Text>
          <Text style={{ color: C.accent, fontSize: 12, marginTop: 2 }}>{fullSyn ? 'Ver menos' : 'Ver más'}</Text>
        </Pressable>
      ) : null}
      <Text style={{ color: C.dim, fontSize: 11, marginTop: 10 }}>Toca para detalles · mantén pulsado para alternar "Tengo" (solo tomos ya publicados)"</Text>
    </View>
  ) : null;

  const footer = (
    <View>
      {packs.length > 0 && (
        <View>
          <SectionTitle>Packs y Cofres Especiales</SectionTitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 2 }}>
            {packs.map((v) => (
              <View key={v.id} style={{ width: '33.33%' }}>
                <VolumeTile v={v} onPress={onPress} onLongPress={onLong} />
              </View>
            ))}
          </View>
        </View>
      )}
      {more.length > 0 && (
    <View>
      <SectionTitle>Más obras de este autor</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
        {more.map((m) => (
          <Pressable key={m.id} onPress={() => router.push(`/edition/${m.id}`)} style={{ width: 96, marginRight: 10 }}>
            <Cover uri={m.cover_url} style={{ width: 96, height: 138 }} />
            <Text style={{ color: C.text, fontSize: 11, marginTop: 4 }} numberOfLines={2}>{m.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ height: 30 }} />
    </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: ed?.work_title ?? 'Serie' }} />
      <FlashList
        data={rows}
        keyExtractor={(r) => r.k}
        getItemType={(r) => r.t}
        renderItem={({ item: r }) => r.t === 'title' ? <SectionTitle>{r.text}</SectionTitle> : (
          <View style={{ flexDirection: 'row' }}>
            {[0, 1, 2].map((i) => {
              const v = r.items?.[i];
              return <View key={i} style={{ flex: 1 }}>{v ? <VolumeTile v={v} onPress={onPress} onLongPress={onLong} /> : null}</View>;
            })}
          </View>
        )}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', padding: 30 }}>
            <Text style={{ color: error ? C.red : C.dim, textAlign: 'center', marginBottom: 12 }}>
              {loading ? 'Cargando ficha…' : error ?? 'Esta edición no tiene tomos publicados todavía.'}
            </Text>
            {error && !loading ? <Btn label="Reintentar" icon="refresh" onPress={() => load(true)} /> : null}
          </View>}
        refreshing={loading}
        onRefresh={() => load(true)}
        contentContainerStyle={{ paddingHorizontal: 7 }}
      />
      <VolumeSheet volume={sel ? allVols.find((v) => v.id === sel.id) ?? sel : null} onClose={() => setSel(null)} />
    </View>
  );
}
