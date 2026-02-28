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
    const esParcial = cells[6] && cells[6].trim() !== '';
    const esRelevo = cells[7] && cells[7].trim() !== '';
    if (cells.length >= 9 && cells[0].match(/\d{2}\/\d{2}\/\d{4}/) && !esParcial && !esRelevo) {
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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Vercel puede pasar body como string o como objeto
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { body = {}; }
    }
    const { nombre, apellidos, sexo } = body;
    if (!nombre || !apellidos) {
      return res.status(400).json({ error: 'Faltan nombre y apellidos' });
    }

    // RFEN requiere mayúsculas
    const nombreUpper = nombre.toUpperCase().trim();
    const apellidosUpper = apellidos.toUpperCase().trim();
    const postData = new URLSearchParams({ nombre: nombreUpper, apellidos: apellidosUpper, sexo: sexo || 'Masculino' }).toString();

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

    let html = searchRes.body;
    if (searchRes.status === 301 || searchRes.status === 302) {
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
      return res.status(404).json({ error: 'Nadador no encontrado. Comprueba nombre y apellidos.' });
    }

    const { d, e } = athletes[0];

    const historialRes = await httpRequest({
      hostname: 'intranet.rfen.es',
      path: `/ConsultarHistorial?d=${encodeURIComponent(d)}&e=${e}`,
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const marks = parseMarks(historialRes.body);
    return res.status(200).json({ nombre: d, marks });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
