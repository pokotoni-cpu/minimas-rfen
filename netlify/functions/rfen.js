const https = require('https');

function httpRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function parseAthletes(html) {
  // Busca enlaces del tipo ConsultarHistorial?d=...&e=...
  const regex = /ConsultarHistorial\?d=([^&"]+)&e=([^"&\s]+)/g;
  const results = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    results.push({ d: decodeURIComponent(match[1].replace(/\+/g, ' ')), e: match[2] });
  }
  return results;
}

function parseMarks(html) {
  const marks = [];
  // Busca filas de tabla con marcas
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[1];
    const cells = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
    }
    if (cells.length >= 9 && cells[0].match(/\d{2}\/\d{2}\/\d{4}/)) {
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
  return marks;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { nombre, apellidos, sexo } = JSON.parse(event.body || '{}');
    if (!nombre || !apellidos) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan nombre y apellidos' }) };
    }

    const postData = new URLSearchParams({ nombre, apellidos, sexo: sexo || 'Masculino' }).toString();

    // Paso 1: buscar persona
    const searchRes = await httpRequest({
      hostname: 'intranet.rfen.es',
      path: '/buscarPersonas',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0'
      }
    }, postData);

    // Puede haber redirect
    let html = searchRes.body;
    if (searchRes.status === 302 || searchRes.status === 301) {
      const location = searchRes.headers.location;
      if (location) {
        const redirectRes = await httpRequest({
          hostname: 'intranet.rfen.es',
          path: location,
          method: 'GET',
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        html = redirectRes.body;
      }
    }

    const athletes = parseAthletes(html);
    if (!athletes.length) {
      // Intentar también en la respuesta directa si hay hash en la URL
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Nadador no encontrado' }) };
    }

    const { d, e } = athletes[0];

    // Paso 2: obtener historial
    const historialRes = await httpRequest({
      hostname: 'intranet.rfen.es',
      path: `/ConsultarHistorial?d=${encodeURIComponent(d)}&e=${e}`,
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const marks = parseMarks(historialRes.body);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ nombre: d, marks })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
