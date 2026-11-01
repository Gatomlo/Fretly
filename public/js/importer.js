// Appels vers le serveur pour l'import de partitions (sources prises en charge, import d'une adresse)
let cache = null;

export async function fetchSources() {
  if (cache) return cache;
  try {
    const res = await fetch('api/import/sources');
    cache = res.ok ? await res.json() : [];
  } catch { cache = []; }
  return cache;
}

// Renvoie la chanson importée { title, artist, key, capo, tempo, body, source }
// En cas d'échec, l'erreur porte `status` (401 = pas connecté, 429 = trop d'imports).
export async function importUrl(url, source) {
  const q = new URLSearchParams({ url });
  if (source) q.set('source', source);
  let res;
  try { res = await fetch(`api/import?${q}`); } catch { throw Object.assign(new Error('Serveur injoignable.'), { status: 0 }); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Import indisponible sur cet hébergement.'), { status: res.status });
  return data;
}
