import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useQuery } from '../../src/db/useQuery';
import * as repo from '../../src/db/repo';
import { syncAll } from '../../src/services/scraper';
import { Btn, ProgressBar } from '../../src/components/ui';
import { C } from '../../src/theme';
import { eur } from '../../src/lib/filters';

const Stat = ({ label, value }: { label: string; value: string }) => (
  <View style={{ flex: 1, backgroundColor: C.card, padding: 14, borderRadius: 12, margin: 4, minWidth: '45%' }}>
    <Text style={{ color: C.dim, fontSize: 12 }}>{label}</Text>
    <Text style={{ color: C.text, fontSize: 22, fontWeight: '800', marginTop: 4 }}>{value}</Text>
  </View>
);

export default function Perfil() {
  const { data: st } = useQuery(repo.getStats, [], {
    owned: 0, read: 0, value: 0, started: 0, completed: 0, wishNow: 0, wishMonth: 0, wishLater: 0, wishCount: 0,
  });
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null);

  const full = async () => {
    setProg({ done: 0, total: 1 });
    try {
      const failed = await syncAll((done, total) => setProg({ done, total }));
      Alert.alert('Catálogo actualizado', failed ? `${failed} series no se pudieron actualizar.` : 'Todo al día.');
    } catch (e) { Alert.alert('Error', String(e)); }
    setProg(null);
  };

  const exportDb = async () => {
    try {
      const f = new File(Paths.cache, `repomangas-backup-${repo.todayISO()}.json`);
      if (f.exists) f.delete();
      f.create();
      f.write(await repo.exportAll());
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri, { mimeType: 'application/json' });
      else Alert.alert('Copia creada', f.uri);
    } catch (e) { Alert.alert('Error al exportar', String(e)); }
  };

  const importDb = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/*'], copyToCacheDirectory: true });
      if (r.canceled) return;
      const json = await new File(r.assets[0].uri).text();
      Alert.alert('Importar copia', 'Esto reemplazará todos tus datos actuales.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Importar', style: 'destructive', onPress: () => repo.importAll(json).then(() => Alert.alert('Importado')).catch((e) => Alert.alert('Error', String(e.message ?? e))) },
      ]);
    } catch (e) { Alert.alert('Error al importar', String(e)); }
  };

  const clearImages = async () => {
    await Image.clearDiskCache();
    await Image.clearMemoryCache();
    Alert.alert('Caché de imágenes limpiada');
  };

  const pct = st.owned ? Math.round((st.read / st.owned) * 100) : 0;
  return (
    <ScrollView contentContainerStyle={{ padding: 8, paddingBottom: 40 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        <Stat label="Tomos en posesión" value={String(st.owned)} />
        <Stat label="Valor de la colección" value={eur(st.value)} />
        <Stat label="Series empezadas" value={String(st.started)} />
        <Stat label="Series completadas" value={String(st.completed)} />
      </View>
      <View style={{ backgroundColor: C.card, padding: 14, borderRadius: 12, margin: 4 }}>
        <Text style={{ color: C.dim, fontSize: 12 }}>Lectura (leídos / tenidos)</Text>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: '800', marginVertical: 4 }}>{pct}% · {st.read}/{st.owned}</Text>
        <ProgressBar value={st.owned ? st.read / st.owned : 0} color={C.green} />
      </View>
      <View style={{ backgroundColor: C.card, padding: 14, borderRadius: 12, margin: 4 }}>
        <Text style={{ color: C.text, fontWeight: '800', fontSize: 16 }}>Presupuesto de la lista de deseos</Text>
        <Text style={{ color: C.dim, marginTop: 6 }}>{st.wishCount} tomos</Text>
        <Text style={{ color: C.green, marginTop: 6 }}>Ya a la venta: {eur(st.wishNow)}</Text>
        <Text style={{ color: C.amber, marginTop: 2 }}>Sale este mes: {eur(st.wishMonth)}</Text>
        <Text style={{ color: C.dim, marginTop: 2 }}>Más adelante / sin fecha: {eur(st.wishLater)}</Text>
        <Text style={{ color: C.text, marginTop: 6, fontWeight: '700' }}>Total: {eur(st.wishNow + st.wishMonth + st.wishLater)}</Text>
      </View>
      <View style={{ margin: 4, marginTop: 14, gap: 8 }}>
        <Text style={{ color: C.text, fontWeight: '800', fontSize: 16 }}>Gestión de datos</Text>
        {prog && (
          <View>
            <ProgressBar value={prog.total ? prog.done / prog.total : 0} />
            <Text style={{ color: C.dim, fontSize: 12, marginTop: 4 }}>{prog.done}/{prog.total} series</Text>
          </View>
        )}
        <Btn label="Sincronización completa / Actualizar catálogo" icon="sync" kind="primary" onPress={full} />
        <Btn label="Exportar copia (JSON)" icon="download" onPress={exportDb} />
        <Btn label="Importar copia (JSON)" icon="push" onPress={importDb} />
        <Btn label="Limpiar caché de imágenes" icon="trash" onPress={clearImages} />
      </View>
    </ScrollView>
  );
}
