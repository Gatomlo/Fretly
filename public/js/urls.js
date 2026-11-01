// Forme canonique d'une adresse : sert à repérer les doublons (www, # et ? ignorés, slash final retiré)
export function normalizeUrl(raw) {
  try {
    const u = new URL(raw);
    return `${u.hostname.replace(/^www\./, '').toLowerCase()}${u.pathname.replace(/\/+$/, '')}`;
  } catch { return String(raw).trim().toLowerCase(); }
}

// Extrait les adresses d'un texte collé (une par ligne, ou séparées par espaces / virgules / points-virgules),
// sans doublon ; `skip` = adresses déjà connues à écarter.
export function parseUrls(text, skip = []) {
  const seen = new Set(skip.map(normalizeUrl));
  const out = [];
  for (const m of String(text || '').matchAll(/https?:\/\/[^\s,;<>"'()]+/gi)) {
    const url = m[0].replace(/[.,;:!?]+$/, '');
    const key = normalizeUrl(url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}
