export default async function handler(req, res) {
  try {
    const { nombre, apellidos, sexo } = req.body;

    const url =
      "https://intranet.rfen.es/FormularioAjaxProcesar?" +
      "x_nombre=" + encodeURIComponent(nombre) +
      "&x_apellidos=" + encodeURIComponent(apellidos) +
      "&x_genero=" + sexo +
      "&buscar=1";

    const rfenResponse = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://intranet.rfen.es/buscarPersonas"
      }
    });

    const html = await rfenResponse.text();

    // Aquí luego parsearemos el HTML
    res.status(200).json({
      success: true,
      html: html
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
