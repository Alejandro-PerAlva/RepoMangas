import { BASE, parseCalendar, parseCollectionLinks, parseEdition } from './parser';
import * as repo from '../../db/repo';
import type { LinkItem } from '../../types';

async function get(path: string, retries = 2): Promise<string> {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(BASE + path, { headers: { Accept: 'text/html' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      if (i >= retries) throw e;
      await new Promise((res) => setTimeout(res, 600 * (i + 1)));
    }
  }
}

/** Scrape + persist one edition. Returns ids of newly discovered volumes. */
export async function scrapeEdition(id: number): Promise<number[]> {
  const parsed = parseEdition(await get(`/coleccion.php?id=${id}`), id);
  if (!parsed) throw new Error('No se pudo leer la ficha');
  return repo.saveEdition(parsed);
}

export async function ensureEdition(id: number, force = false) {
  if (force || !(await repo.editionIsCached(id))) await scrapeEdition(id);
}

export async function ensureAuthor(id: number, force = false): Promise<void> {
  if (!force && (await repo.listAuthorEditions(id)).length) return;
  const { title, items } = parseCollectionLinks(await get(`/autor.php?id=${id}`));
  await repo.saveAuthorEditions(id, title ?? (await repo.getAuthorName(id)) ?? `Autor ${id}`, items);
}

export async function ensurePublisher(id: number, force = false): Promise<void> {
  if (!force && (await repo.listPublisherEditions(id)).length) return;
  await repo.savePublisherEditions(id, parseCollectionLinks(await get(`/editorial.php?id=${id}`)).items);
}

export interface SearchResult { editions: LinkItem[]; authors: LinkItem[] }
export async function search(q: string): Promise<SearchResult> {
  const r = await fetch(`${BASE}/buscar.php?b=${encodeURIComponent(q)}`);
  const j = (await r.json()) as {
    colecciones?: { nombre: string; id: string }[]; autores?: { nombre: string; id: string }[];
  };
  const m = (x: { nombre: string; id: string }): LinkItem => ({ id: parseInt(x.id, 10), name: x.nombre, cover_url: null });
  return { editions: (j.colecciones ?? []).map(m), authors: (j.autores ?? []).map(m) };
}

const NEW_TAG = 'Nuevo lanzamiento';
const pfx = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, '0')}`;

/** Fetch one calendar month (exact release dates) and store it. */
export async function syncMonth(ano: number, mes: number, force = false): Promise<void> {
  const key = `rel_${pfx(ano, mes)}`;
  const d = new Date();
  const isPast = ano * 12 + mes < d.getFullYear() * 12 + d.getMonth() + 1;
  const last = Number(await repo.getMeta(key)) || 0;
  if (!force && last && (isPast || Date.now() - last < 3600_000)) return;
  const releases = parseCalendar(await get(`/calendario.php?mes=${mes}&ano=${ano}`));
  await repo.replaceReleases(releases, [pfx(ano, mes)]);
  await repo.setMeta(key, String(Date.now()));
  if (isPast) return;
  const tracked = await repo.editionsToTrack([...new Set(releases.map((r) => r.edition_id))]);
  for (const eid of tracked) {
    try {
      const fresh = await scrapeEdition(eid);
      if (fresh.length) await repo.wishlistVolumes(fresh, NEW_TAG);
    } catch { /* offline / transient */ }
  }
}

/** App-start sync: current + next month. Applies the auto-wishlist rule. */
export async function syncNovedades(force = false): Promise<void> {
  const d = new Date();
  for (const o of [0, 1]) {
    const x = new Date(d.getFullYear(), d.getMonth() + o, 1);
    await syncMonth(x.getFullYear(), x.getMonth() + 1, force);
  }
  await repo.setMeta('novedades_sync', String(Date.now()));
}

// ---------------- global catalog download (incremental, pausable) ----------------
export interface CatalogState {
  running: boolean;
  paused: boolean;
  phase: 'idle' | 'index' | 'download' | 'done' | 'cancelled' | 'error';
  done: number;
  total: number;
  failed: number;
  label: string;
}
let cat: CatalogState = { running: false, paused: false, phase: 'idle', done: 0, total: 0, failed: 0, label: '' };
let cancelFlag = false;
const catListeners = new Set<() => void>();
const setCat = (p: Partial<CatalogState>) => { cat = { ...cat, ...p }; catListeners.forEach((l) => l()); };
export const catalogSubscribe = (l: () => void) => { catListeners.add(l); return () => catListeners.delete(l); };
export const catalogSnapshot = () => cat;
export const catalogPause = (p: boolean) => setCat({ paused: p });
export const catalogCancel = () => { cancelFlag = true; setCat({ paused: false }); };

const CONCURRENCY = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Downloads every collection of Listado Manga that is not yet stored. `refreshActive` re-scrapes ongoing series too. */
export async function syncCatalog(refreshActive = false): Promise<void> {
  if (cat.running) return;
  cancelFlag = false;
  setCat({ running: true, paused: false, phase: 'index', done: 0, total: 0, failed: 0, label: 'Leyendo índice global de Listado Manga…' });
  try {
    const index = parseCollectionLinks(await get('/lista.php', 3)).items;
    const have = await repo.cachedEditionIds();
    const queue = index.filter((i) => !have.has(i.id)).map((i) => ({ id: i.id, name: i.name }));
    if (refreshActive) {
      const ids = new Set(queue.map((q) => q.id));
      for (const id of await repo.activeEditionIds()) if (!ids.has(id)) queue.push({ id, name: `Actualizando #${id}` });
    }
    setCat({ phase: 'download', total: queue.length, label: queue.length ? '' : 'El catálogo ya está completo' });
    let pub = '';
    const worker = async () => {
      for (;;) {
        while (cat.paused && !cancelFlag) await sleep(300);
        if (cancelFlag) return;
        const item = queue.shift();
        if (!item) return;
        try {
          await scrapeEdition(item.id);
          const e = await repo.getEdition(item.id);
          if (e?.publisher) pub = e.publisher;
          setCat({ done: cat.done + 1, label: `${pub ? pub + ' · ' : ''}${e?.name ?? item.name}` });
        } catch {
          setCat({ done: cat.done + 1, failed: cat.failed + 1 });
        }
        await sleep(120);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setCat({ running: false, phase: cancelFlag ? 'cancelled' : 'done', label: cancelFlag ? 'Cancelado. Lo descargado se ha conservado.' : 'Catálogo completo descargado' });
  } catch (e) {
    setCat({ running: false, phase: 'error', label: 'Error de conexión: ' + String((e as Error).message ?? e) });
  }
}
