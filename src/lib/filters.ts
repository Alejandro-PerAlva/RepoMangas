import type { EditionSummary } from '../types';

export type CollState = 'all' | 'gaps' | 'uptodate' | 'complete' | 'unread';
export type SortKey = 'alpha' | 'progress' | 'recent' | 'price';

export interface Filters {
  state: CollState;
  publisher: string | null;
  author: string | null;
  genre: string | null;
  format: string | null;
  status: string | null;
  sort: SortKey;
}
export const DEFAULT_FILTERS: Filters = {
  state: 'all', publisher: null, author: null, genre: null, format: null, status: null, sort: 'alpha',
};

export const STATE_LABELS: Record<CollState, string> = {
  all: 'Todas', gaps: 'Incompletas con huecos', uptodate: 'Al día', complete: 'Completas', unread: 'Pendientes de leer',
};
export const SORT_LABELS: Record<SortKey, string> = {
  alpha: 'A-Z', progress: 'Progreso', recent: 'Últimos añadidos', price: 'Precio',
};

const total = (e: EditionSummary) => Math.max(e.vol_count, e.total_es ?? 0);
export const isComplete = (e: EditionSummary) =>
  e.vol_count > 0 && e.owned_count >= e.vol_count && (e.status === 'Finalizada' || e.owned_count >= total(e));
const hasGaps = (e: EditionSummary) => e.owned_count > 0 && e.owned_count < e.vol_count;
const upToDate = (e: EditionSummary) => e.owned_count > 0 && e.owned_count >= e.vol_count && !isComplete(e);
export const progress = (e: EditionSummary) => (total(e) ? e.owned_count / total(e) : 0);

export function applyFilters(list: EditionSummary[], f: Filters, q = ''): EditionSummary[] {
  const s = q.trim().toLowerCase();
  const out = list.filter((e) => {
    if (s && !(e.name.toLowerCase().includes(s) || (e.authors ?? '').toLowerCase().includes(s) || (e.publisher ?? '').toLowerCase().includes(s))) return false;
    if (f.publisher && e.publisher !== f.publisher) return false;
    if (f.author && !(e.authors ?? '').includes(f.author)) return false;
    if (f.genre && e.genre !== f.genre) return false;
    if (f.format && e.format !== f.format) return false;
    if (f.status && e.status !== f.status) return false;
    switch (f.state) {
      case 'gaps': return hasGaps(e);
      case 'uptodate': return upToDate(e);
      case 'complete': return isComplete(e);
      case 'unread': return e.owned_count > e.read_count;
    }
    return true;
  });
  const cmp: Record<SortKey, (a: EditionSummary, b: EditionSummary) => number> = {
    alpha: (a, b) => a.work_title.localeCompare(b.work_title, 'es'),
    progress: (a, b) => progress(b) - progress(a),
    recent: (a, b) => b.last_added - a.last_added,
    price: (a, b) => b.price_owned - a.price_owned,
  };
  return out.sort(cmp[f.sort]);
}

export function distinct(list: EditionSummary[]) {
  const set = (fn: (e: EditionSummary) => string | null | undefined) =>
    [...new Set(list.map(fn).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'es'));
  return {
    publisher: set((e) => e.publisher),
    author: [...new Set(list.flatMap((e) => (e.authors ?? '').split(', ')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    genre: set((e) => e.genre),
    format: set((e) => e.format),
    status: set((e) => e.status),
  };
}

export const eur = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha';
