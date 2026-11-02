import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../src/theme';

const icon = (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, size }: { color: any; size: number }) => <Ionicons name={name} color={color} size={size} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerTintColor: C.text,
        sceneStyle: { backgroundColor: C.bg },
        tabBarStyle: { backgroundColor: C.card, borderTopColor: C.border },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.dim,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Mi Colección', tabBarIcon: icon('library') }} />
      <Tabs.Screen name="novedades" options={{ title: 'Novedades', tabBarIcon: icon('sparkles') }} />
      <Tabs.Screen name="explorar" options={{ title: 'Explorar', tabBarIcon: icon('search') }} />
      <Tabs.Screen name="deseos" options={{ title: 'Deseos', tabBarIcon: icon('star') }} />
    </Tabs>
  );
}
