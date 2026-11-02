import * as Haptics from 'expo-haptics';
import { ensureEdition } from '../services/scraper';
import * as repo from '../db/repo';
import type { ReleaseItem } from '../types';

export const tap = () => Haptics.selectionAsync().catch(() => {});
export const thump = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

export async function markRelease(r: ReleaseItem) {
  await ensureEdition(r.edition_id);
  const id = await repo.findVolumeId(r.edition_id, r.number, r.title);
  if (id == null) throw new Error('Tomo no encontrado en la ficha');
  await repo.setVolumeFlag(id, 'owned', !r.owned);
}
