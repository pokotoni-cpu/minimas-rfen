export const config = { runtime: 'edge' };

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers });
  }

  try {
    let body = {};
    try { body = await req.json(); } catch(e) {}
    const { nombre, apellidos, sexo } = body;

    if (!nombre || !apellidos) {
      return new Response(JSON.stringify({ error: 'Faltan nombre y apellidos' }), { status: 400, headers });
    }

    const nombreUpper = nombre.toUpperCase().trim();
    const apellidosUpper = apellidos.toUpperCase().trim();
    const genero = sexo === 'Femenino' ? 'F' : 'M';

    const params = new URLSearchParams({
      x_nombre: nombreUpper,
      x_apellidos: apellidosUpper,
      x_genero: genero,
      buscar: '1'
    });

    const searchRes = await fetch(`https://intranet.rfen.es/FormularioAjaxProcesar?${params}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://intranet.rfen.es/buscarPersonas',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9'
      }
    });

    const buffer = await searchRes.arrayBuffer();
    const decoder = new TextDecoder('iso-8859-1');
    const html = decoder.decode(buffer);

    const regex = /ConsultarHistorial\?d=([^&"'\s]+)&(?:amp;)?e=([^"'&\s]+)/;
    const match = regex.exec(html);

    if (!match) {
      return new Response(JSON.stringify({
        error: 'Nadador no encontrado. Comprueba nombre y apellidos.',
        debug_status: searchRes.status,
        debug_preview: html.substring(0, 500)
      }), { status: 404, headers });
    }

    const d = decodeURIComponent(match[1].replace(/\+/g, ' '));
    const e = match[2];

    const histRes = await fetch(`https://intranet.rfen.es/ConsultarHistorial?d=${encodeURIComponent(d)}&e=${e}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://intranet.rfen.es/buscarPersonas'
      }
    });

    const histBuffer = await histRes.arrayBuffer();
    const histHtml = new TextDecoder('iso-8859-1').decode(histBuffer);

    const marks = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(histHtml)) !== null) {
      const row = rowMatch[1];
      const cells = [];
      let cellMatch;
      while ((cellMatch = cellRegex.exec(row)) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
      }
      if (cells.length >= 9 && cells[0].match(/\d{2}\/\d{2}\/\d{4}/)) {
        const esParcial = cells[6] && cells[6].trim() !== '';
        const esRelevo = cells[7] && cells[7].trim() !== '';
        if (!esParcial && !esRelevo) {
          marks.push({
            fecha: cells[0].split(' ')[0],
            lugar: cells[1],
            estilo: cells[2],
            distancia: parseInt(cells[3]),
            crono: cells[4],
            piscina: parseInt(cells[5]),
            resultado: cells[8]
          });
        }
      }
    }

    return new Response(JSON.stringify({ nombre: d, marks }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
