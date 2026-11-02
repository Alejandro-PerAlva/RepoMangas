import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { C } from '../src/theme';
import { getDb } from '../src/db/client';
import { purgeUnusedEditions } from '../src/db/repo';
import { syncNovedades } from '../src/services/scraper';

export default function RootLayout() {
  useEffect(() => {
    getDb().then(() => purgeUnusedEditions()).then(() => syncNovedades()).catch(() => {});
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.text,
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="edition/[id]" options={{ title: '' }} />
        <Stack.Screen name="author/[id]" options={{ title: 'Autor' }} />
        <Stack.Screen name="publisher/[id]" options={{ title: 'Editorial' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
