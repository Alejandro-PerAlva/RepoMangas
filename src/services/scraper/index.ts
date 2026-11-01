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

/** App-start sync: current + next month calendar. Applies the auto-wishlist rule. */
export async function syncNovedades(): Promise<void> {
  const d = new Date();
  const months = [0, 1].map((o) => {
    const x = new Date(d.getFullYear(), d.getMonth() + o, 1);
    return { mes: x.getMonth() + 1, ano: x.getFullYear(), prefix: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}` };
  });
  const pages = await Promise.all(months.map((m) => get(`/calendario.php?mes=${m.mes}&ano=${m.ano}`)));
  const releases = pages.flatMap(parseCalendar);
  await repo.replaceReleases(releases, months.map((m) => m.prefix));
  await repo.setMeta('novedades_sync', String(Date.now()));

  const tracked = await repo.editionsToTrack([...new Set(releases.map((r) => r.edition_id))]);
  for (const eid of tracked) {
    try {
      const fresh = await scrapeEdition(eid);
      if (fresh.length) await repo.wishlistVolumes(fresh, NEW_TAG);
    } catch { /* offline / transient: ignore */ }
  }
}

/** Manual full refresh of every cached edition, with progress. */
export async function syncAll(onProgress: (done: number, total: number) => void): Promise<number> {
  const ids = await repo.allEditionIds();
  let done = 0;
  let failed = 0;
  const queue = [...ids];
  onProgress(0, ids.length);
  const worker = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      try {
        const fresh = await scrapeEdition(id);
        const tracked = await repo.editionsToTrack([id]);
        if (fresh.length && tracked.length) await repo.wishlistVolumes(fresh, NEW_TAG);
      } catch { failed++; }
      onProgress(++done, ids.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  await syncNovedades().catch(() => {});
  return failed;
}
