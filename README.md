# RepoMangas

App Android (Expo + React Native + TypeScript) para gestionar tu colección de manga con datos de [Listado Manga](https://www.listadomanga.es).

- Offline-first: SQLite local (`expo-sqlite`), portadas en caché de disco (`expo-image`).
- Scraping bajo demanda: novedades al abrir, series/autores/editoriales al consultarlas, descarga global incremental desde Perfil.
- Colección con marcado rápido (Tengo / Quiero / Leído), packs separados, estado de la serie en España y Japón, novedades por mes y editorial, lista de deseos con presupuesto y copia de seguridad JSON.

## Desarrollo
```
npm install
npx expo start --android
npx tsc --noEmit
```

## APK
`releases/RepoMangas-arm64.apk` (arm64-v8a). Build local: `npx expo prebuild -p android && cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`.
