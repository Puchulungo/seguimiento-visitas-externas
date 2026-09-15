const formidable = require("formidable");
const fs = require("fs");
const XLSX = require("xlsx");
const { put, list } = require("@vercel/blob");
const { build, merge } = require("./build");

function sheetToRows(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }
  try {
    const form = formidable({ maxFileSize: 50 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);

    const clave = Array.isArray(fields.clave) ? fields.clave[0] : fields.clave;
    if (!process.env.UPLOAD_PASSWORD || clave !== process.env.UPLOAD_PASSWORD) {
      res.status(401).json({ error: "Clave incorrecta" });
      return;
    }

    const fileField = files.excel;
    const file = Array.isArray(fileField) ? fileField[0] : fileField;
    if (!file) {
      res.status(400).json({ error: "No llego ningun archivo (campo 'excel')" });
      return;
    }

    const buf = fs.readFileSync(file.filepath);
    const wb = XLSX.read(buf, { type: "buffer", cellDates: false });

    const visitaRows = sheetToRows(wb, "Visita");
    const estadosRows = sheetToRows(wb, "Estados");
    const formulariosRows = sheetToRows(wb, "Formularios");

    if (!visitaRows.length) {
      res.status(400).json({ error: "El Excel no trae hoja 'Visita' con datos" });
      return;
    }

    const nuevo = build(visitaRows, estadosRows, formulariosRows);

    // Trae lo existente en Blob (si hay) y fusiona por id de visita.
    let existente = { visitas: [] };
    const { blobs } = await list({ prefix: "data/seguimiento.json" });
    if (blobs.length) {
      const r = await fetch(blobs[0].url);
      existente = await r.json();
    }
    const fusionado = merge(nuevo, existente);

    await put("data/seguimiento.json", JSON.stringify(fusionado), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });

    res.status(200).json({
      ok: true,
      visitas_en_este_excel: nuevo.n_visitas,
      visitas_totales_tras_fusionar: fusionado.n_visitas,
    });
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
