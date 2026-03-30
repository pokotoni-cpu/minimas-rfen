export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {

    const { nombre, apellidos, sexo } = req.body;

    if (!nombre || !apellidos) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    const url =
      "https://intranet.rfen.es/FormularioAjaxProcesar?" +
      "x_nombre=" + encodeURIComponent(nombre) +
      "&x_apellidos=" + encodeURIComponent(apellidos) +
      "&x_genero=" + sexo +
      "&buscar=1";

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://intranet.rfen.es/buscarPersonas"
      }
    });

    const html = await response.text();

    // Buscar filas de nadadores en el HTML
    const swimmers = [];

    const regex = /data-id="(\d+)".*?>(.*?)<\/td>.*?>(.*?)<\/td>/g;

    let match;

    while ((match = regex.exec(html)) !== null) {

      swimmers.push({
        id: match[1],
        nombre: match[2].replace(/<[^>]+>/g, "").trim(),
        club: match[3].replace(/<[^>]+>/g, "").trim()
      });

    }

    return res.status(200).json({
      success: true,
      swimmers
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      error: error.message
    });

  }

}
