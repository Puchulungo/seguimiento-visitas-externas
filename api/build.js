// Logica principal: de las 3 hojas del export eVisit (ya leidas a arrays de objetos con
// XLSX.utils.sheet_to_json) arma el mismo JSON que producia build_seguimiento.py.
const { CATALOGO, matchCampo } = require("./catalogo");

const RESULTADO_BUCKET = {
  "VISITA ÉXITO": "exito",
  "VISITA TERMINADA": "terminada",
  "VISITA FRACASO": "fracaso",
  "VISITA SIN EXITO": "fracaso",
  "CANCELADO EN RUTA": "fracaso",
  "EN CAMINO": "en_curso",
  "ARRIBO CLIENTE": "en_curso",
  "VISITA INICIADA": "en_curso",
  "REPROGRAMAR": "en_curso",
  "REAGENDADO": "en_curso",
  "NUEVO REAGENDADO": "en_curso",
};

function rowKey(row, cols) {
  return cols.map((c) => (row[c] === undefined || row[c] === null ? "" : String(row[c]))).join("");
}

function dedupeFullRow(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const k = JSON.stringify(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

function excelDateToStr(val, withTime) {
  if (val === undefined || val === null || val === "") return null;
  let d;
  if (typeof val === "number") {
    // fecha serial de Excel
    d = new Date(Math.round((val - 25569) * 86400 * 1000));
  } else {
    d = new Date(val);
  }
  if (isNaN(d.getTime())) return typeof val === "string" ? val : null;
  const pad = (n) => String(n).padStart(2, "0");
  const datePart = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  if (!withTime) return datePart;
  return `${datePart} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function cleanVal(x) {
  if (x === undefined || x === null) return null;
  if (typeof x === "number" && isNaN(x)) return null;
  if (typeof x === "string" && x.trim() === "") return null;
  return x;
}

function parseUbicacion(respuesta) {
  if (!respuesta || typeof respuesta !== "string") return { texto: respuesta || null, lat: null, lng: null };
  const m = respuesta.trim().match(/\(([-\d.]+),\s*([-\d.]+)\)\s*$/);
  if (m) {
    const texto = respuesta.slice(0, m.index).trim();
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { texto, lat, lng };
  }
  return { texto: respuesta, lat: null, lng: null };
}

function build(visitaRows, estadosRows, formulariosRows) {
  const visitas0 = dedupeFullRow(visitaRows);
  const estados0 = dedupeFullRow(estadosRows);
  const formularios0 = dedupeFullRow(
    formulariosRows.map((r) => ({ ...r, __key: rowKey(r, ["Código Visita", "Pregunta", "Respuesta"]) }))
  );
  // dedup formularios por (codigo,pregunta,respuesta)
  const seenF = new Set();
  const formularios = [];
  for (const r of formularios0) {
    if (seenF.has(r.__key)) continue;
    seenF.add(r.__key);
    const { __key, ...rest } = r;
    formularios.push(rest);
  }

  const formsByCode = {};
  for (const f of formularios) {
    const code = f["Código Visita"];
    (formsByCode[code] = formsByCode[code] || []).push(f);
  }

  const estadosByCode = {};
  for (const e of estados0) {
    const code = e["Código Visita"];
    (estadosByCode[code] = estadosByCode[code] || []).push(e);
  }

  const visitas = [];
  for (const row of visitas0) {
    const code = row["Código Visita"];
    const fsub = formsByCode[code] || [];
    const formularioPrincipal = fsub.length ? fsub[0]["Formulario"] : null;

    const campos = {};
    const campoDefs = CATALOGO[formularioPrincipal] || [];
    for (const cd of campoDefs) {
      if (campos[cd.key]) continue;
      campos[cd.key] = { label: cd.label, kind: cd.kind, respuesta: null };
    }

    const sinMapear = [];
    for (const frow of fsub) {
      const formulario = cleanVal(frow["Formulario"]);
      const pregunta = cleanVal(frow["Pregunta"]);
      const respuesta = cleanVal(frow["Respuesta"]);
      const campoDef = matchCampo(formulario, pregunta);
      if (!campoDef) {
        sinMapear.push({ pregunta, respuesta, formulario });
        continue;
      }
      const key = campoDef.key;
      let valor = respuesta;
      if (campoDef.kind === "ubicacion") valor = parseUbicacion(respuesta);
      const existing = campos[key];
      const existingVacio = !existing || existing.respuesta === null || existing.respuesta === "" ;
      if (!existingVacio) continue;
      campos[key] = { label: campoDef.label, kind: campoDef.kind, respuesta: valor };
    }

    const esub = (estadosByCode[code] || []).slice().sort((a, b) => {
      const da = new Date(a["Fecha Estado"]);
      const db = new Date(b["Fecha Estado"]);
      return da - db;
    });
    const timeline = esub.map((erow) => ({
      estado: erow["Estado"],
      fecha: excelDateToStr(erow["Fecha Estado"], true),
      lat: cleanVal(erow["Latitud"]) !== null ? Number(erow["Latitud"]) : null,
      lng: cleanVal(erow["Longitud"]) !== null ? Number(erow["Longitud"]) : null,
    }));

    const ultimoEstado = cleanVal(row["Último Estado"]);
    const resultado = RESULTADO_BUCKET[ultimoEstado] || "sin_dato";

    visitas.push({
      id: code,
      asesor: row["Usuario"],
      cliente: row["Cliente"],
      documento: cleanVal(row["Documento"]) !== null ? String(row["Documento"]).trim() : null,
      tipo_documento: cleanVal(row["TipoDocumento"]) !== null ? String(row["TipoDocumento"]).trim().toUpperCase() : null,
      contacto_registrado: cleanVal(row["Contacto"]),
      direccion_registrada: cleanVal(row["Dirección"]),
      fecha: excelDateToStr(row["Fecha"], false),
      tipo_visita: row["Tipo Visita"],
      formulario: formularioPrincipal,
      estado_final: ultimoEstado,
      resultado,
      duracion: cleanVal(row["Tiempo visita (HH:mm:ss)"]),
      fec_creacion: excelDateToStr(row["Fec. Creación"], true),
      fec_primer_estado: excelDateToStr(row["Fec. Primer Estado"], true),
      campos,
      campos_sin_mapear: sinMapear,
      timeline,
    });
  }

  const asesores = [...new Set(visitas.map((v) => v.asesor).filter(Boolean))].sort();
  return {
    generado: new Date().toISOString().slice(0, 19).replace("T", " "),
    n_visitas: visitas.length,
    asesores,
    visitas,
  };
}

function merge(nuevo, existente) {
  const byId = {};
  for (const v of existente.visitas || []) byId[v.id] = v;
  for (const v of nuevo.visitas) byId[v.id] = v; // el nuevo gana en conflicto
  const visitas = Object.values(byId);
  const asesores = [...new Set(visitas.map((v) => v.asesor).filter(Boolean))].sort();
  return {
    generado: nuevo.generado,
    n_visitas: visitas.length,
    asesores,
    visitas,
  };
}

module.exports = { build, merge };
