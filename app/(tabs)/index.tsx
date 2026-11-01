import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useQuery } from '../../src/db/useQuery';
import * as repo from '../../src/db/repo';
import { EditionRow } from '../../src/components/EditionRow';
import { FilterBar } from '../../src/components/FilterBar';
import { Cover, Empty } from '../../src/components/ui';
import { C } from '../../src/theme';
import { DEFAULT_FILTERS, applyFilters } from '../../src/lib/filters';

const OWNED_OR_FOLLOWED = `WHERE e.followed = 1 OR EXISTS (SELECT 1 FROM volumes v JOIN user_volume_state s ON s.volume_id = v.id WHERE v.edition_id = e.id AND s.owned = 1)`;

export default function Collection() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const { data: all } = useQuery(() => repo.listEditions(OWNED_OR_FOLLOWED), [], []);
  const { data: cont } = useQuery(repo.listContinue, [], []);
  const list = useMemo(() => applyFilters(all, filters), [all, filters]);

  const header = (
    <View>
      {cont.length > 0 && (
        <View>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '800', margin: 12, marginBottom: 6 }}>Continuar leyendo</Text>
          <FlashList
            horizontal data={cont} keyExtractor={(i) => String(i.volume_id)} showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable onPress={() => router.push(`/edition/${item.edition_id}`)} style={{ width: 92, marginLeft: 12 }}>
                <Cover uri={item.cover_url} style={{ width: 92, height: 132 }} />
                <Text style={{ color: C.text, fontSize: 11, marginTop: 4 }} numberOfLines={1}>{item.name}</Text>
                <Text style={{ color: C.accent, fontSize: 12, fontWeight: '700' }}>Tomo #{item.number}</Text>
              </Pressable>
            )}
            style={{ height: 180 }}
          />
        </View>
      )}
      <FilterBar filters={filters} onChange={setFilters} source={all} />
    </View>
  );

  return (
    <FlashList
      data={list}
      keyExtractor={(e) => String(e.id)}
      renderItem={({ item }) => <EditionRow e={item} />}
      ListHeaderComponent={header}
      ListEmptyComponent={<Empty text="Tu colección está vacía. Busca una serie en Explorar y marca tus tomos." />}
      contentContainerStyle={{ paddingBottom: 24 }}
    />
  );
}
