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

const OWNED = `WHERE EXISTS (SELECT 1 FROM volumes v JOIN user_volume_state s ON s.volume_id = v.id WHERE v.edition_id = e.id AND s.owned = 1)`;

export default function Collection() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const { data: all } = useQuery(() => repo.listEditions(OWNED), [], []);
  const list = useMemo(() => applyFilters(all, filters), [all, filters]);

  const header = (
    <View>
      <FilterBar filters={filters} onChange={setFilters} source={all} />
    </View>
  );

  return (
    <FlashList
      data={list}
      keyExtractor={(e) => String(e.id)}
      renderItem={({ item }) => <EditionRow e={item} />}
      ListHeaderComponent={header}
      ListEmptyComponent={<Empty text="Tu colección está vacía. Busca una serie en Explorar y marca los tomos que tengas." />}
      contentContainerStyle={{ paddingBottom: 24 }}
    />
  );
}
