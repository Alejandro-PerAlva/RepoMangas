# Mangas

App Android (Expo + React Native + TypeScript) para gestionar tu colección de manga con datos de [Listado Manga](https://www.listadomanga.es).

- Offline-first: SQLite local (`expo-sqlite`), portadas en caché de disco (`expo-image`).
- Scraping bajo demanda: novedades al abrir, series/autores/editoriales al consultarlas. Las fichas se descargan solo al abrirlas y se borran al salir salvo que estén en tu colección, deseos o en deseos.
- Colección con marcado rápido (Tengo / Leído, solo tomos ya publicados; «Deseo» por colección), estado de la serie en España y Japón, novedades por mes y editorial, lista de deseos con presupuesto y copia de seguridad JSON.

## Desarrollo
```
npm install
npx expo start --android
npx tsc --noEmit
```

## APK
`releases/Mangas-arm64.apk` (arm64-v8a). Build local: `npx expo prebuild -p android && cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`.
