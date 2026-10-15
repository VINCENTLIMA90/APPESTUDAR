import { createHash } from 'node:crypto';
const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
export function extractMaterials(html, source) {
  const materials = new Map();
  for (const match of html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = new URL(decode(match[1]), source.url);
      if (url.hostname !== 'examenes.cervantes.es' || !['http:', 'https:'].includes(url.protocol) || !/\.(pdf|zip|mp3)$/i.test(url.pathname)) continue;
      url.protocol = 'https:'; url.hash = ''; url.username = ''; url.password = '';
      const title = decode(match[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
      if (source.id !== 'ccse' && !/a2/i.test(decodeURIComponent(url.pathname) + ' ' + title)) continue;
      materials.set(url.href, { title: title || decodeURIComponent(url.pathname.split('/').at(-1)), url: url.href });
    } catch { /* Ignore invalid document links without following arbitrary destinations. */ }
  }
  return [...materials.values()].sort((a, b) => a.url.localeCompare(b.url));
}
export function materialFingerprint(materials) { return createHash('sha256').update(JSON.stringify(materials)).digest('hex'); }
