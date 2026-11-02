import { bump, getDb } from './client';
import type {
  EditionSummary, LinkItem, ParsedEdition, ParsedRelease, ReleaseItem, Volume,
} from '../types';

const now = () => Date.now();
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const SUMMARY_SQL = `
SELECT e.id, e.name, w.title AS work_title, e.publisher_id, e.publisher, e.format, e.size,
  w.genre, e.status, e.status_jp, e.origin_lang, e.total_jp, e.followed, e.total_es,
  (SELECT group_concat(a.name, ', ') FROM (SELECT DISTINCT a.name FROM work_authors wa JOIN authors a ON a.id = wa.author_id WHERE wa.work_id = w.id) a) AS authors,
  (SELECT cover_url FROM volumes v WHERE v.is_pack = 0 AND v.edition_id = e.id ORDER BY v.number LIMIT 1) AS cover_url,
  (SELECT COUNT(*) FROM volumes v WHERE v.is_pack = 0 AND v.phase = 0 AND v.edition_id = e.id) AS vol_count,
  (SELECT COUNT(*) FROM volumes v JOIN user_volume_state s ON s.volume_id = v.id WHERE v.is_pack = 0 AND v.edition_id = e.id AND s.owned = 1) AS owned_count,
  (SELECT COUNT(*) FROM volumes v JOIN user_volume_state s ON s.volume_id = v.id WHERE v.is_pack = 0 AND v.edition_id = e.id AND s.read = 1) AS read_count,
  (SELECT CASE WHEN e.followed = 1 THEN COUNT(*) ELSE 0 END FROM volumes v LEFT JOIN user_volume_state s ON s.volume_id = v.id WHERE v.is_pack = 0 AND v.phase IN (0,1) AND v.edition_id = e.id AND COALESCE(s.owned,0) = 0) AS wish_count,
  (SELECT CASE WHEN e.followed = 1 THEN COALESCE(SUM(v.price),0) ELSE 0 END FROM volumes v LEFT JOIN user_volume_state s ON s.volume_id = v.id WHERE v.is_pack = 0 AND v.phase IN (0,1) AND v.edition_id = e.id AND COALESCE(s.owned,0) = 0) AS wish_price,
  (SELECT COALESCE(SUM(v.price),0) FROM volumes v JOIN user_volume_state s ON s.volume_id = v.id WHERE v.is_pack = 0 AND v.edition_id = e.id AND s.owned = 1) AS price_owned,
  (SELECT COALESCE(MAX(s.updated_at),0) FROM volumes v JOIN user_volume_state s ON s.volume_id = v.id WHERE v.is_pack = 0 AND v.edition_id = e.id AND s.owned = 1) AS last_added,
  (SELECT MIN(v.number) FROM volumes v JOIN user_volume_state s ON s.volume_id = v.id WHERE v.is_pack = 0 AND v.edition_id = e.id AND s.owned = 1 AND s.read = 0) AS next_unread
FROM editions e JOIN works w ON w.id = e.work_id`;

export async function listEditions(where = ''): Promise<EditionSummary[]> {
  const db = await getDb();
  return db.getAllAsync<EditionSummary>(`${SUMMARY_SQL} ${where} ORDER BY w.title COLLATE NOCASE`);
}

export async function getEdition(id: number): Promise<EditionSummary | null> {
  const db = await getDb();
  return db.getFirstAsync<EditionSummary>(`${SUMMARY_SQL} WHERE e.id = ?`, id);
}

export async function getEditionMeta(id: number) {
  const db = await getDb();
  return db.getFirstAsync<{
    id: number; work_id: number; reading_dir: string | null; total_jp: number | null;
    synopsis: string | null; original_title: string | null; scraped_at: number;
  }>(
    `SELECT e.id, e.work_id, e.reading_dir, e.total_jp, e.scraped_at, w.synopsis, w.original_title
     FROM editions e JOIN works w ON w.id = e.work_id WHERE e.id = ?`, id);
}

export async function getEditionAuthors(editionId: number) {
  const db = await getDb();
  return db.getAllAsync<{ id: number; name: string }>(
    `SELECT DISTINCT a.id, a.name FROM editions e JOIN work_authors wa ON wa.work_id = e.work_id
     JOIN authors a ON a.id = wa.author_id WHERE e.id = ?`, editionId);
}

export async function listVolumes(editionId: number): Promise<Volume[]> {
  const db = await getDb();
  return db.getAllAsync<Volume>(
    `SELECT v.*, COALESCE(s.owned,0) owned, COALESCE(s.wishlisted,0) wishlisted,
            COALESCE(s.read,0) read, s.tag
     FROM volumes v LEFT JOIN user_volume_state s ON s.volume_id = v.id
     WHERE v.edition_id = ? ORDER BY v.is_pack, v.number`, editionId);
}

/** Deseos = tomos en tienda o en preparación de las colecciones marcadas como deseo (los no editados no entran). */
export const WISH_FROM = `FROM volumes v JOIN editions e ON e.id = v.edition_id LEFT JOIN user_volume_state s ON s.volume_id = v.id
  WHERE e.followed = 1 AND v.is_pack = 0 AND v.phase IN (0,1) AND COALESCE(s.owned,0) = 0`;
export async function listWishlist(): Promise<(Volume & { edition_name: string })[]> {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT v.*, 0 AS owned, 1 AS wishlisted, COALESCE(s.read,0) AS read, s.tag, e.name AS edition_name
     ${WISH_FROM} ORDER BY v.release_date IS NULL, v.release_date, e.name, v.number`);
}

/** A volume can only be owned/read once it is on sale. */
const outSql = () => `v.phase = 0 AND (v.release_date IS NULL OR v.release_date <= '${todayISO()}')`;

export async function saveEdition(p: ParsedEdition): Promise<number[]> {
  const db = await getDb();
  const newVolumeIds: number[] = [];
  const key = p.work_title.trim().toLowerCase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO works (key, title, original_title, genre, synopsis) VALUES (?,?,?,?,?)
       ON CONFLICT(key) DO UPDATE SET original_title = COALESCE(excluded.original_title, original_title),
         genre = COALESCE(excluded.genre, genre), synopsis = COALESCE(excluded.synopsis, synopsis)`,
      key, p.work_title, p.original_title, p.genre, p.synopsis);
    const w = await db.getFirstAsync<{ id: number }>('SELECT id FROM works WHERE key = ?', key);
    const workId = w!.id;
    if (p.publisher_id && p.publisher) await db.runAsync('INSERT OR REPLACE INTO publishers (id, name) VALUES (?,?)', p.publisher_id, p.publisher);
    for (const a of p.authors) {
      await db.runAsync('INSERT OR REPLACE INTO authors (id, name) VALUES (?,?)', a.id, a.name);
      await db.runAsync('INSERT OR IGNORE INTO work_authors (work_id, author_id, role) VALUES (?,?,?)', workId, a.id, a.role);
    }
    await db.runAsync(
      `INSERT INTO editions (id, work_id, name, publisher_id, publisher, format, size, reading_dir, status, total_jp, total_es, status_jp, origin_lang, scraped_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET work_id=excluded.work_id, name=excluded.name, publisher_id=excluded.publisher_id,
         publisher=excluded.publisher, format=excluded.format, size=excluded.size, reading_dir=excluded.reading_dir,
         status=excluded.status, total_jp=excluded.total_jp, total_es=excluded.total_es, status_jp=excluded.status_jp,
         origin_lang=excluded.origin_lang, scraped_at=excluded.scraped_at`,
      p.id, workId, p.name, p.publisher_id, p.publisher, p.format, p.size, p.reading_dir, p.status, p.total_jp, p.total_es, p.status_jp, p.origin_lang, now());
    const known = new Set(
      (await db.getAllAsync<{ number: number }>('SELECT number FROM volumes WHERE edition_id = ?', p.id)).map((r) => r.number));
    for (const v of p.volumes) {
      const r = await db.runAsync(
        `INSERT INTO volumes (edition_id, number, title, release_date, price, pages, cover_url, is_pack, phase)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON CONFLICT(edition_id, number) DO UPDATE SET title=excluded.title, release_date=excluded.release_date,
           price=excluded.price, pages=excluded.pages, cover_url=excluded.cover_url, is_pack=excluded.is_pack, phase=excluded.phase`,
        p.id, v.number, v.title, v.release_date, v.price, v.pages, v.cover_url, v.is_pack, v.phase);
      if (!known.has(v.number) && !v.is_pack && v.phase === 0) newVolumeIds.push(r.lastInsertRowId);
    }
  });
  bump();
  return newVolumeIds;
}

/** Removes a downloaded edition (and orphaned work/author links) unless the user keeps it: owned, wishlisted, read or followed. */
export async function purgeEditionIfUnused(id: number) {
  const db = await getDb();
  const keep = await db.getFirstAsync<{ n: number }>(
    `SELECT (SELECT followed FROM editions WHERE id = ?1) +
       (SELECT COUNT(*) FROM volumes v JOIN user_volume_state s ON s.volume_id = v.id
        WHERE v.edition_id = ?1 AND (s.owned = 1 OR s.read = 1)) AS n`, id);
  if (!keep || keep.n > 0) return;
  await db.withTransactionAsync(() => purgeIds(db, [id]));
  bump();
}

/** Startup cleanup: drop every downloaded edition the user does not keep. */
export async function purgeUnusedEditions() {
  const db = await getDb();
  const ids = (await db.getAllAsync<{ id: number }>(
    `SELECT e.id FROM editions e WHERE e.followed = 0 AND NOT EXISTS (
       SELECT 1 FROM volumes v JOIN user_volume_state s ON s.volume_id = v.id
       WHERE v.edition_id = e.id AND (s.owned = 1 OR s.read = 1))`)).map((r) => r.id);
  if (!ids.length) return;
  await db.withTransactionAsync(() => purgeIds(db, ids));
  bump();
}

async function purgeIds(db: Awaited<ReturnType<typeof getDb>>, ids: number[]) {
  const list = ids.map(Number).join(',');
  await db.execAsync(`
    DELETE FROM user_volume_state WHERE volume_id IN (SELECT id FROM volumes WHERE edition_id IN (${list}));
    DELETE FROM volumes WHERE edition_id IN (${list});
    DELETE FROM editions WHERE id IN (${list});
    DELETE FROM works WHERE id NOT IN (SELECT work_id FROM editions);
    DELETE FROM work_authors WHERE work_id NOT IN (SELECT id FROM works);`);
}

export async function editionIsCached(id: number): Promise<boolean> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) n FROM editions WHERE id = ? AND scraped_at > 0', id);
  return !!r && r.n > 0;
}

// ---------- user state ----------
async function ensureState(volumeId: number) {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR IGNORE INTO user_volume_state (volume_id, updated_at) VALUES (?, ?)', volumeId, now());
}

export async function setVolumeFlag(volumeId: number, flag: 'owned' | 'read', value: boolean) {
  const db = await getDb();
  if (value) {
    const ok = await db.getFirstAsync<{ id: number }>(`SELECT v.id FROM volumes v WHERE v.id = ? AND ${outSql()}`, volumeId);
    if (!ok) return; // aún no ha salido a tienda
  }
  await ensureState(volumeId);
  const extra = flag === 'owned' && !value ? ', read = 0' : flag === 'read' && value ? ', owned = 1' : '';
  await db.runAsync(
    `UPDATE user_volume_state SET ${flag} = ?, updated_at = ?${extra} WHERE volume_id = ?`,
    value ? 1 : 0, now(), volumeId);
  bump();
}

export async function ownedAndReadUpTo(editionId: number, n: number) {
  const db = await getDb();
  const vols = await db.getAllAsync<{ id: number }>(`SELECT v.id FROM volumes v WHERE ${outSql()} AND v.is_pack = 0 AND v.edition_id = ? AND v.number <= ?`, editionId, n);
  await db.withTransactionAsync(async () => {
    for (const v of vols) {
      await ensureState(v.id);
      await db.runAsync('UPDATE user_volume_state SET owned=1, read=1, updated_at=? WHERE volume_id=?', now(), v.id);
    }
  });
  bump();
}

export type BulkAction = 'ownAll' | 'readOwned' | 'clear';
export async function bulkAction(editionId: number, action: BulkAction) {
  const db = await getDb();
  const ids = `(SELECT v.id FROM volumes v WHERE v.edition_id = ${Number(editionId)} AND ${action === 'ownAll' ? outSql() + ' AND v.is_pack = 0' : '1'})`;
  const vols = await db.getAllAsync<{ id: number }>(`SELECT id FROM ${ids}`);
  await db.withTransactionAsync(async () => {
    for (const v of vols) await ensureState(v.id);
    const t = now();
    if (action === 'ownAll')
      await db.runAsync(`UPDATE user_volume_state SET owned=1, updated_at=? WHERE volume_id IN ${ids}`, t);
    else if (action === 'readOwned')
      await db.runAsync(`UPDATE user_volume_state SET read=1, updated_at=? WHERE owned=1 AND volume_id IN ${ids}`, t);
    else
      await db.runAsync(`UPDATE user_volume_state SET owned=0, wishlisted=0, read=0, tag=NULL, updated_at=? WHERE volume_id IN ${ids}`, t);
  });
  bump();
}

export async function setFollowed(editionId: number, followed: boolean) {
  const db = await getDb();
  await db.runAsync('UPDATE editions SET followed = ? WHERE id = ?', followed ? 1 : 0, editionId);
  bump();
}

// ---------- releases ----------
export async function replaceReleases(items: ParsedRelease[], monthPrefixes: string[]) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const m of monthPrefixes) await db.runAsync('DELETE FROM releases WHERE date LIKE ?', `${m}%`);
    for (const r of items)
      await db.runAsync(
        'INSERT OR IGNORE INTO releases (edition_id, title, number, date, publisher, cover_url) VALUES (?,?,?,?,?,?)',
        r.edition_id, r.title, r.number, r.date, r.publisher, r.cover_url);
    for (const r of items)
      if (r.publisher_id) await db.runAsync('INSERT OR IGNORE INTO publishers (id, name) VALUES (?,?)', r.publisher_id, r.publisher);
  });
  bump();
}

export async function listReleases(): Promise<ReleaseItem[]> {
  const db = await getDb();
  return db.getAllAsync<ReleaseItem>(
    `SELECT r.*,
       COALESCE((SELECT s.owned FROM volumes v JOIN user_volume_state s ON s.volume_id = v.id
                 WHERE v.edition_id = r.edition_id AND v.number = r.number), 0) AS owned,
       CASE WHEN EXISTS (SELECT 1 FROM editions e WHERE e.id = r.edition_id AND (e.followed = 1 OR EXISTS
              (SELECT 1 FROM volumes v JOIN user_volume_state s ON s.volume_id = v.id
               WHERE v.edition_id = e.id AND s.owned = 1))) THEN 1 ELSE 0 END AS mine
     FROM releases r ORDER BY r.date, r.publisher, r.title`);
}

export async function editionsToTrack(editionIds: number[]): Promise<number[]> {
  if (!editionIds.length) return [];
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: number }>(
    `SELECT e.id FROM editions e WHERE e.id IN (${editionIds.map(Number).join(',')}) AND (e.followed = 1 OR EXISTS
      (SELECT 1 FROM volumes v JOIN user_volume_state s ON s.volume_id = v.id WHERE v.edition_id = e.id AND s.owned = 1))`);
  return rows.map((r) => r.id);
}

// ---------- author / publisher ----------
export async function saveAuthorEditions(authorId: number, name: string, items: LinkItem[]) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT OR REPLACE INTO authors (id, name) VALUES (?,?)', authorId, name);
    await db.runAsync('DELETE FROM author_editions WHERE author_id = ?', authorId);
    for (const i of items)
      await db.runAsync('INSERT OR REPLACE INTO author_editions (author_id, edition_id, name, cover_url) VALUES (?,?,?,?)',
        authorId, i.id, i.name, i.cover_url);
  });
  bump();
}
export async function listAuthorEditions(authorId: number): Promise<LinkItem[]> {
  const db = await getDb();
  return db.getAllAsync<LinkItem>(
    'SELECT edition_id AS id, name, cover_url FROM author_editions WHERE author_id = ? ORDER BY name COLLATE NOCASE', authorId);
}
export async function getAuthorName(id: number) {
  const db = await getDb();
  return (await db.getFirstAsync<{ name: string }>('SELECT name FROM authors WHERE id = ?', id))?.name ?? null;
}
export async function savePublisherEditions(publisherId: number, items: LinkItem[]) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM publisher_editions WHERE publisher_id = ?', publisherId);
    for (const i of items)
      await db.runAsync('INSERT OR REPLACE INTO publisher_editions (publisher_id, edition_id, name) VALUES (?,?,?)', publisherId, i.id, i.name);
  });
  bump();
}
export async function listPublisherEditions(publisherId: number): Promise<LinkItem[]> {
  const db = await getDb();
  return db.getAllAsync<LinkItem>(
    `SELECT pe.edition_id AS id, pe.name,
       (SELECT cover_url FROM volumes v WHERE v.edition_id = pe.edition_id ORDER BY number LIMIT 1) AS cover_url
     FROM publisher_editions pe WHERE publisher_id = ? ORDER BY pe.name COLLATE NOCASE`, publisherId);
}

// ---------- meta / stats ----------
export async function getMeta(key: string) {
  const db = await getDb();
  return (await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key))?.value ?? null;
}
export async function setMeta(key: string, value: string) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?,?)', key, value);
}

export async function getStats() {
  const db = await getDb();
  const today = todayISO();
  const monthEnd = today.slice(0, 7) + '-31';
  const one = async (sql: string, ...p: (string | number)[]) =>
    (await db.getFirstAsync<{ n: number }>(sql, ...p))?.n ?? 0;
  const owned = await one('SELECT COUNT(*) n FROM user_volume_state s JOIN volumes v ON v.id = s.volume_id WHERE s.owned = 1 AND v.is_pack = 0');
  const read = await one('SELECT COUNT(*) n FROM user_volume_state s JOIN volumes v ON v.id = s.volume_id WHERE s.owned = 1 AND s.read = 1 AND v.is_pack = 0');
  const value = await one('SELECT COALESCE(SUM(v.price),0) n FROM volumes v JOIN user_volume_state s ON s.volume_id = v.id WHERE s.owned = 1');
  const started = await one(`SELECT COUNT(DISTINCT v.edition_id) n FROM volumes v JOIN user_volume_state s ON s.volume_id = v.id WHERE s.owned = 1`);
  const completed = await one(
    `SELECT COUNT(*) n FROM editions e WHERE (SELECT COUNT(*) FROM volumes v WHERE v.is_pack = 0 AND v.edition_id = e.id) > 0
     AND NOT EXISTS (SELECT 1 FROM volumes v LEFT JOIN user_volume_state s ON s.volume_id = v.id
       WHERE v.is_pack = 0 AND v.edition_id = e.id AND COALESCE(s.owned,0) = 0)
     AND (e.total_es IS NULL OR (SELECT COUNT(*) FROM volumes v WHERE v.is_pack = 0 AND v.edition_id = e.id) >= e.total_es)`);
  const wq = WISH_FROM;
  const wishNow = await one(`SELECT COALESCE(SUM(v.price),0) n ${wq} AND v.release_date <= ?`, today);
  const wishMonth = await one(`SELECT COALESCE(SUM(v.price),0) n ${wq} AND v.release_date > ? AND v.release_date <= ?`, today, monthEnd);
  const wishLater = await one(`SELECT COALESCE(SUM(v.price),0) n ${wq} AND (v.release_date IS NULL OR v.release_date > ?)`, monthEnd);
  const wishCount = await one(`SELECT COUNT(*) n ${wq}`);
  return { owned, read, value, started, completed, wishNow, wishMonth, wishLater, wishCount };
}

export async function allEditionIds(): Promise<number[]> {
  const db = await getDb();
  return (await db.getAllAsync<{ id: number }>('SELECT id FROM editions')).map((r) => r.id);
}

// ---------- backup ----------
const TABLES = ['publishers', 'works', 'authors', 'work_authors', 'editions', 'volumes', 'user_volume_state',
  'releases', 'author_editions', 'publisher_editions', 'meta'];

export async function exportAll(): Promise<string> {
  const db = await getDb();
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) out[t] = await db.getAllAsync(`SELECT * FROM ${t}`);
  return JSON.stringify({ app: 'repomangas', version: 1, exported_at: now(), tables: out });
}

export async function importAll(json: string) {
  const data = JSON.parse(json);
  if (data?.app !== 'repomangas' || !data.tables) throw new Error('Copia de seguridad no válida');
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const t of [...TABLES].reverse()) await db.runAsync(`DELETE FROM ${t}`);
    for (const t of TABLES) {
      const rows = (data.tables[t] ?? []) as Record<string, string | number | null>[];
      for (const r of rows) {
        const cols = Object.keys(r);
        if (!cols.length || !cols.every((c) => /^[a-z_]+$/.test(c))) continue;
        await db.runAsync(
          `INSERT OR REPLACE INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
          ...cols.map((c) => r[c]));
      }
    }
  });
  bump();
}

export async function listContinue(): Promise<{ edition_id: number; name: string; number: number; volume_id: number; cover_url: string | null }[]> {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT v.edition_id, e.name, v.number, v.id AS volume_id, v.cover_url
     FROM volumes v JOIN editions e ON e.id = v.edition_id JOIN user_volume_state s ON s.volume_id = v.id
     WHERE s.owned = 1 AND s.read = 0 AND v.is_pack = 0
       AND v.number = (SELECT MIN(v2.number) FROM volumes v2 JOIN user_volume_state s2 ON s2.volume_id = v2.id
                       WHERE v2.is_pack = 0 AND v2.edition_id = v.edition_id AND s2.owned = 1 AND s2.read = 0)
     ORDER BY s.updated_at DESC`);
}

export async function findVolumeId(editionId: number, number: number | null, title: string): Promise<number | null> {
  const db = await getDb();
  let r = number != null
    ? await db.getFirstAsync<{ id: number }>('SELECT id FROM volumes WHERE is_pack = 0 AND edition_id = ? AND number = ?', editionId, number)
    : await db.getFirstAsync<{ id: number }>('SELECT id FROM volumes WHERE edition_id = ? AND title = ?', editionId, title);
  if (!r && number == null) r = await db.getFirstAsync<{ id: number }>('SELECT id FROM volumes WHERE edition_id = ? ORDER BY number DESC', editionId);
  return r?.id ?? null;
}

export async function listPublishers(): Promise<{ id: number; name: string }[]> {
  const db = await getDb();
  return db.getAllAsync('SELECT id, name FROM publishers ORDER BY name COLLATE NOCASE');
}
export async function listAuthors(): Promise<{ id: number; name: string }[]> {
  const db = await getDb();
  return db.getAllAsync('SELECT id, name FROM authors ORDER BY name COLLATE NOCASE');
}
/** ids of editions whose detail is already stored locally */
export async function cachedEditionIds(): Promise<Set<number>> {
  const db = await getDb();
  return new Set((await db.getAllAsync<{ id: number }>('SELECT id FROM editions WHERE scraped_at > 0')).map((r) => r.id));
}
export async function activeEditionIds(): Promise<number[]> {
  const db = await getDb();
  return (await db.getAllAsync<{ id: number }>("SELECT id FROM editions WHERE status IN ('Abierta','Desconocido')")).map((r) => r.id);
}
export async function savePublisher(id: number, name: string) {
  const db = await getDb();
  await db.runAsync('INSERT OR IGNORE INTO publishers (id, name) VALUES (?,?)', id, name);
}
