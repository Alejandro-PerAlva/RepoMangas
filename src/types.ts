export type PubStatus = 'Abierta' | 'Cerrada' | 'Pausada' | 'Cancelada' | 'Desconocido';

export interface Volume {
  id: number;
  edition_id: number;
  number: number;
  title: string;
  release_date: string | null; // YYYY-MM-DD
  price: number | null;
  pages: number | null;
  cover_url: string | null;
  owned: number;
  wishlisted: number;
  read: number;
  tag: string | null;
  is_pack: number;
  phase: number; // 0 editado · 1 en preparación · 2 no editado
}

export interface EditionSummary {
  id: number;
  name: string;
  work_title: string;
  publisher_id: number | null;
  publisher: string | null;
  format: string | null;
  size: string | null;
  genre: string | null;
  status: PubStatus;
  authors: string | null;
  cover_url: string | null;
  followed: number;
  total_es: number | null;
  total_jp: number | null;
  status_jp: PubStatus | null;
  origin_lang: string | null;
  vol_count: number;
  owned_count: number;
  read_count: number;
  wish_count: number;
  price_owned: number;
  last_added: number;
  next_unread: number | null;
}

export interface ReleaseItem {
  id: number;
  edition_id: number;
  title: string;
  number: number | null;
  date: string;
  publisher: string;
  cover_url: string | null;
  owned: number;
  wishlisted: number;
  mine: number;
}

export interface ParsedVolume {
  number: number;
  title: string;
  release_date: string | null;
  price: number | null;
  pages: number | null;
  cover_url: string | null;
  is_pack: number;
  phase: number;
}

export interface ParsedEdition {
  id: number;
  name: string;
  work_title: string;
  original_title: string | null;
  authors: { id: number; name: string; role: string }[];
  publisher_id: number | null;
  publisher: string | null;
  genre: string | null;
  format: string | null;
  size: string | null;
  reading_dir: string | null;
  total_jp: number | null;
  total_es: number | null;
  status: PubStatus;
  status_jp: PubStatus | null;
  origin_lang: string | null;
  synopsis: string | null;
  volumes: ParsedVolume[];
}

export interface ParsedRelease {
  edition_id: number;
  title: string;
  number: number | null;
  date: string;
  publisher: string;
  publisher_id: number | null;
  cover_url: string | null;
}

export interface LinkItem {
  id: number;
  name: string;
  cover_url: string | null;
}
