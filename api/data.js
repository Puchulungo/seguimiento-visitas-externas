const { list } = require("@vercel/blob");

module.exports = async (req, res) => {
  try {
    const { blobs } = await list({ prefix: "data/seguimiento.json" });
    if (!blobs.length) {
      res.status(200).json({ generado: null, n_visitas: 0, asesores: [], visitas: [] });
      return;
    }
    const r = await fetch(blobs[0].url);
    const json = await r.json();
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(json);
  } catch (err) {
    res.status(500).json({ error: String((err && err.message) || err) });
  }
};
