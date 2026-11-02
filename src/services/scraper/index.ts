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
      await scrapeEdition(eid);
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
