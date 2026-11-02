import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cover, Btn } from './ui';
import { C } from '../theme';
import { eur, fmtDate, isOut } from '../lib/filters';
import * as repo from '../db/repo';
import { tap } from '../lib/actions';
import type { Volume } from '../types';

export function VolumeSheet({ volume, onClose }: { volume: Volume | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  if (!volume) return null;
  const out = isOut(volume, repo.todayISO());
  const toggle = (f: 'owned' | 'read') => {
    tap();
    repo.setVolumeFlag(volume.id, f, !volume[f]);
    onClose();
  };
  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.sheet, { paddingBottom: 16 + insets.bottom }]}>
        <View style={s.grip} />
        <View style={{ flexDirection: 'row' }}>
          <Cover uri={volume.cover_url} style={{ width: 90, height: 132 }} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.title} numberOfLines={4}>{volume.title}</Text>
            <Text style={s.meta}>{fmtDate(volume.release_date)}</Text>
            <Text style={s.meta}>{volume.price != null ? eur(volume.price) : 'Precio n/d'}</Text>
            <Text style={s.meta}>{volume.pages ? `${volume.pages} páginas` : 'Páginas n/d'}</Text>
            {!out ? <Text style={[s.meta, { color: C.amber }]}>{volume.phase === 2 ? 'Aún no editado' : 'Aún no ha salido a tienda'}</Text> : null}
          </View>
        </View>
        {out ? <View style={s.row}>
          <Btn label={volume.owned ? 'Lo tengo ✓' : 'Tengo'} kind={volume.owned ? 'primary' : 'default'} icon="library" onPress={() => toggle('owned')} style={s.flex} />
          <Btn label={volume.read ? 'Leído ✓' : 'Leído'} kind={volume.read ? 'green' : 'default'} icon="checkmark-circle" onPress={() => toggle('read')} style={s.flex} />
        </View> : <Text style={{ color: C.dim, marginTop: 16 }}>Podrás marcarlo como «Tengo» o «Leído» cuando salga a la venta.</Text>}
        {out && !volume.is_pack && <Btn
          label={`Tengo y leído hasta el #${volume.number}`} icon="flash"
          onPress={() => { tap(); repo.ownedAndReadUpTo(volume.edition_id, volume.number); onClose(); }}
          style={{ marginTop: 8 }}
        />}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000A' },
  sheet: { backgroundColor: C.card, padding: 16, paddingBottom: 28, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 14 },
  title: { color: C.text, fontSize: 17, fontWeight: '800', marginBottom: 6 },
  meta: { color: C.dim, fontSize: 14, marginTop: 2 },
  row: { flexDirection: 'row', gap: 8, marginTop: 16 },
  flex: { flex: 1 },
});
