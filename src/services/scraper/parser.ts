import { parseDocument } from 'htmlparser2';
import { findAll, getAttributeValue, getChildren, textContent } from 'domutils';
import type { AnyNode, Element } from 'domhandler';
import type { LinkItem, ParsedEdition, ParsedRelease, ParsedVolume, PubStatus } from '../../types';

export const BASE = 'https://www.listadomanga.es';

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const isEl = (n: AnyNode): n is Element => n.type === 'tag' || n.type === 'script' || n.type === 'style';
const hasClass = (e: Element, c: string) => (e.attribs.class ?? '').split(/\s+/).includes(c);
const clean = (s: string) => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const text = (n: AnyNode | AnyNode[]) => clean(textContent(n as AnyNode));
const idFrom = (href: string | undefined, re: RegExp) => {
  const m = href?.match(re);
  return m ? parseInt(m[1], 10) : null;
};
const pad = (n: number) => String(n).padStart(2, '0');

/** "Octubre 2002" | "15 Octubre 2002" | "Lunes, 2 Noviembre 2026" -> ISO date */
export function parseSpanishDate(s: string): string | null {
  const m = s.toLowerCase().match(/(?:(\d{1,2})\s+(?:de\s+)?)?([a-záéíóú]+)\s+(?:de\s+)?(\d{4})/);
  if (!m) return null;
  const mo = MONTHS[m[2]];
  if (!mo) return null;
  return `${m[3]}-${pad(mo)}-${pad(m[1] ? parseInt(m[1], 10) : 1)}`;
}

function parseStatus(s: string): PubStatus {
  const t = s.toLowerCase();
  if (t.includes('cancel')) return 'Cancelada';
  if (t.includes('paus') || t.includes('suspend') || t.includes('parad')) return 'Pausada';
  if (t.includes('complet') || t.includes('finaliz')) return 'Finalizada';
  if (t.includes('abiert') || t.includes('curso') || t.includes('public')) return 'En curso';
  return 'Desconocido';
}

/** Splits a td's children into segments separated by <br>. */
function segments(td: Element): AnyNode[][] {
  const segs: AnyNode[][] = [[]];
  for (const c of getChildren(td)) {
    if (isEl(c) && c.name === 'br') segs.push([]);
    else segs[segs.length - 1].push(c);
  }
  return segs;
}

export function parseEdition(html: string, id: number): ParsedEdition | null {
  const doc = parseDocument(html);
  const h1 = findAll((e) => e.name === 'h1', doc.children).find((h) => text(h) !== '' && !text(h).startsWith('Calendario'));
  if (!h1) return null;
  const name = text(h1);
  const work_title = name.replace(/\s*\(.*$/, '').trim() || name;

  // info cell = td.izq that contains h1
  const info = findAll((e) => e.name === 'td' && hasClass(e, 'izq'), doc.children).find(
    (td) => findAll((e) => e === h1, [td]).length > 0);
  const fields: Record<string, { text: string; links: { href: string; text: string }[] }> = {};
  if (info) {
    let cur: string | null = null;
    for (const c of getChildren(info)) {
      if (isEl(c) && c.name === 'b') {
        cur = text(c).replace(/:$/, '');
        fields[cur] = { text: '', links: [] };
      } else if (isEl(c) && c.name === 'br') cur = null;
      else if (cur) {
        fields[cur].text += (isEl(c) ? textContent(c) : (c as { data?: string }).data ?? '');
        if (isEl(c) && c.name === 'a' && c.attribs.href) fields[cur].links.push({ href: c.attribs.href, text: text(c) });
      }
    }
  }
  const f = (k: string) => {
    const key = Object.keys(fields).find((x) => x.toLowerCase().startsWith(k.toLowerCase()));
    return key ? { ...fields[key], text: clean(fields[key].text) } : null;
  };

  const authors: ParsedEdition['authors'] = [];
  for (const role of ['Guion', 'Dibujo', 'Autor']) {
    f(role)?.links.forEach((l) => {
      const aid = idFrom(l.href, /autor\.php\?id=(\d+)/);
      if (aid && !authors.some((a) => a.id === aid && a.role === role)) authors.push({ id: aid, name: l.text, role });
    });
  }
  const pub = f('Editorial espa');
  const pubLink = pub?.links.find((l) => /editorial\.php/.test(l.href));
  const col = f('Colecci');
  const fmt = f('Formato');
  const sizeM = fmt?.text.match(/\((\d+\s*x\s*\d+)\)/);
  const jp = f('Números en japon')?.text.match(/\d+/);
  const esF = f('Números en castellano') ?? f('Números en catal') ?? f('Números en');
  const es = esF?.text.match(/\d+/);

  const volumes: ParsedVolume[] = [];
  type Sec = 'regular' | 'pack' | 'skip';
  let sec: Sec = 'skip';
  const used = new Set<number>();
  const nodes = findAll(
    (e) => e.name === 'h2' || (e.name === 'td' && hasClass(e, 'cen') &&
      findAll((x) => x.name === 'img' && hasClass(x, 'portada'), getChildren(e)).length > 0), doc.children);
  let idx = 0;
  for (const td of nodes) {
    if (td.name === 'h2') {
      const h = text(td).toLowerCase();
      if (h.startsWith('n\u00fameros editados') || h.startsWith('n\u00fameros en preparaci')) {
        sec = /\((ediciones especiales|packs?|portadas alternativas)/.test(h) ? 'pack' : 'regular';
      } else sec = 'skip';
      continue;
    }
    if (sec === 'skip') continue;
    const img = findAll((x) => x.name === 'img' && hasClass(x, 'portada'), getChildren(td))[0];
    const lines = segments(td).map((sg) => clean(sg.map((n) => textContent(n)).join(''))).filter(Boolean);
    let title = lines[0] ?? (img.attribs.alt ?? '');
    const num = (title + ' ' + (img.attribs.alt ?? '')).match(/n[\u00ba\u00b0o]\s*(\d+)/i);
    let pages: number | null = null;
    let price: number | null = null;
    let date: string | null = null;
    const extra: string[] = [];
    for (const l of lines.slice(1)) {
      const pm = l.match(/(\d+)\s*p[a\u00e1]g/i);
      const pr = l.match(/([\d.]+,\d{1,2}|\d+)\s*\u20ac/);
      if (pm) pages = parseInt(pm[1], 10);
      else if (pr) price = parseFloat(pr[1].replace(/\./g, '').replace(',', '.'));
      else if (parseSpanishDate(l)) date = parseSpanishDate(l);
      else extra.push(l);
    }
    const isPack = sec === 'pack' || /\b(pack|cofre|estuche|box\s?set|pack de inicio)\b/i.test(title + ' ' + extra.join(' '));
    let number: number;
    if (isPack) {
      if (extra.length) title = `${title} \u2013 ${extra.join(' ')}`;
      number = 1000 + (hash(title + (img.attribs.src ?? '')) % 900000);
      while (used.has(number)) number++;
    } else number = num ? parseInt(num[1], 10) : ++idx;
    if (!isPack) idx = Math.max(idx, number);
    used.add(number);
    volumes.push({ number, title, release_date: date, price, pages, cover_url: img.attribs.src ?? null, is_pack: isPack ? 1 : 0 });
  }

  const synH = findAll((e) => e.name === 'h2' && text(e).startsWith('Sinopsis de'), doc.children)[0];
  const synText = synH?.parent ? text((synH.parent as Element).children.filter((c) => c !== synH)).trim() : '';

  return {
    id, name, work_title,
    original_title: f('Título original')?.text ?? null,
    authors,
    publisher_id: pubLink ? idFrom(pubLink.href, /id=(\d+)/) : null,
    publisher: pub ? (pubLink?.text ?? pub.text) : null,
    genre: col ? (col.links[0]?.text ?? col.text) : null,
    format: fmt ? fmt.text.replace(/\s*\(.*$/, '').trim().split(/\s+/).slice(0, 1).join(' ') || null : null,
    size: sizeM ? sizeM[1].replace(/\s/g, '') : null,
    reading_dir: f('Sentido')?.text ?? null,
    total_jp: jp ? parseInt(jp[0], 10) : null,
    total_es: es ? parseInt(es[0], 10) : null,
    status: esF ? parseStatus(esF.text) : 'Desconocido',
    synopsis: synText || null,
    volumes: dedupe(volumes),
  };
}

function hash(str: string): number {
  let h = 7;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function dedupe(v: ParsedVolume[]): ParsedVolume[] {
  const seen = new Set<number>();
  return v.filter((x) => (seen.has(x.number) ? false : (seen.add(x.number), true)));
}

/** calendario.php?mes=&ano= -> exact release dates grouped by publisher */
export function parseCalendar(html: string): ParsedRelease[] {
  const doc = parseDocument(html);
  const nodes = findAll(
    (e) => e.name === 'h2' || (e.name === 'div' && hasClass(e, 'rotulo')) || e.name === 'a', doc.children);
  const out: ParsedRelease[] = [];
  let publisher = '';
  let publisherId: number | null = null;
  let date: string | null = null;
  for (const n of nodes) {
    if (n.name === 'h2') {
      publisher = text(n);
      const pa = findAll((x) => x.name === 'a', getChildren(n))[0];
      publisherId = idFrom(pa?.attribs.href, /editorial=(\d+)/);
    }
    else if (n.name === 'div') {
      const t = text(n);
      if (/\d{1,2}\s+\p{L}+\s+\d{4}/u.test(t)) date = parseSpanishDate(t);
    } else if (date) {
      const eid = idFrom(n.attribs.href, /^\/coleccion\.php\?id=(\d+)/);
      const img = findAll((x) => x.name === 'img', getChildren(n))[0];
      if (eid && img) {
        const title = clean(img.attribs.alt ?? '');
        const num = title.match(/n[º°o]\s*(\d+)\s*$/i);
        out.push({ edition_id: eid, title, number: num ? parseInt(num[1], 10) : null, date, publisher, publisher_id: publisherId, cover_url: img.attribs.src ?? null });
      }
    }
  }
  return out;
}

/** autor.php / editorial.php -> list of editions */
export function parseCollectionLinks(html: string): { title: string | null; items: LinkItem[] } {
  const doc = parseDocument(html);
  const h1 = findAll((e) => e.name === 'h1', doc.children).map(text).find((t) => t && !t.startsWith('Calendario')) ?? null;
  const items = new Map<number, LinkItem>();
  for (const a of findAll((e) => e.name === 'a', doc.children)) {
    const eid = idFrom(a.attribs.href, /^\/coleccion\.php\?id=(\d+)/);
    if (!eid) continue;
    const img = findAll((x) => x.name === 'img', getChildren(a))[0];
    const name = clean(text(a) || img?.attribs.alt || '');
    const prev = items.get(eid);
    if (!prev || (!prev.cover_url && img)) items.set(eid, { id: eid, name: name || prev?.name || '', cover_url: img?.attribs.src ?? prev?.cover_url ?? null });
  }
  return { title: h1, items: [...items.values()].filter((i) => i.name) };
}

export { getAttributeValue };
