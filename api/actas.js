// Proxy para los archivos de la FNCV.
// El navegador no puede pedirlos directamente porque fncv.es no manda CORS.
// Solo deja pasar URLs de fncv.es: es un proxy, no una puerta abierta.
//
// Uso: /api/actas?url=https%3A%2F%2Fwww.fncv.es%2Farchivos%2F...pdf
//      /api/actas?url=https%3A%2F%2Fwww.fncv.es%2Fnatacion-ligas   (HTML)

export default async function handler(req, res) {
  const url = req.query && req.query.url;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Falta el parámetro url' });
  }

  let destino;
  try {
    destino = new URL(url);
  } catch (e) {
    return res.status(400).json({ error: 'URL no válida' });
  }

  const permitido =
    (destino.protocol === 'https:' || destino.protocol === 'http:') &&
    /(^|\.)fncv\.es$/i.test(destino.hostname);

  if (!permitido) {
    return res.status(403).json({ error: 'Solo se permiten archivos de fncv.es' });
  }

  try {
    const r = await fetch(destino.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/pdf,text/html,*/*'
      }
    });

    if (!r.ok) {
      return res.status(r.status).json({ error: 'La FNCV devolvió ' + r.status });
    }

    const tipo = r.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await r.arrayBuffer());

    res.setHeader('Content-Type', tipo);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(buffer);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
