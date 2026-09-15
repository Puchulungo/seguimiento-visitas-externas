// Catálogo de formularios eVisit -> campos canónicos (puerto JS del catalogo_formularios.py
// original). Mismo criterio: primer campo cuyo "match" calce gana, salvo que su "exclude"
// también calce (para evitar colisiones como "quien te atendio" dentro de la pregunta del
// nombre de contacto).

function stripAccents(s) {
  if (s === null || s === undefined) return "";
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function norm(s) {
  return stripAccents(s).toLowerCase().trim();
}

const CAMPOS_COMUNES = [
  { key: "selfie_contacto", label: "Selfie con el contacto", kind: "foto", match: ["selfie"] },
  { key: "foto_fachada", label: "Foto de fachada", kind: "foto", match: ["fachad"] },
  { key: "nombre_contacto", label: "Nombre de quien atendió", kind: "texto", match: ["nombre y apellido"] },
  { key: "atencion", label: "Quién te atendió", kind: "seleccion", match: ["quien te atendio", "quien te atendió"], exclude: ["nombre", "apellido"] },
  { key: "cargo_contacto", label: "Cargo", kind: "seleccion", match: ["cargo"] },
  { key: "telefono_contacto", label: "Teléfono de contacto", kind: "texto", match: ["telefono", "teléfono"] },
  { key: "ubicacion", label: "Ubicación", kind: "ubicacion", match: ["ubicac"] },
  { key: "referidos", label: "Referidos", kind: "texto", match: ["conoce a alguien", "referidos"] },
];

const CAMPOS_PROSPECCION = [...CAMPOS_COMUNES,
  { key: "otros_rucs", label: "Otros RUCs / razones sociales", kind: "texto", match: ["rucs", "razon social", "razones sociales", "ruc/razon"] },
  { key: "rubro", label: "Rubro del cliente", kind: "seleccion", match: ["rubro"] },
  { key: "ruta_zona", label: "Ruta o zona donde opera", kind: "texto", match: ["ruta", "zona donde opera"] },
  { key: "plan_compra", label: "¿Plan de compra concreto?", kind: "seleccion", match: ["plan de compra"] },
  { key: "tipo_unidad", label: "Tipo de unidad que busca", kind: "seleccion", match: ["tipo de unidad"] },
  { key: "cantidad_unidades", label: "Cantidad de unidades", kind: "texto", match: ["cantidad de unidades"] },
  { key: "para_cuando", label: "¿Para cuándo?", kind: "texto", match: ["para cuando", "para cuándo"] },
  { key: "tipo_carga", label: "Tipo de carga que transporta", kind: "multiseleccion", match: ["tipo de carga"] },
  { key: "comentario", label: "Comentario libre", kind: "texto", match: ["comentario"] },
];

const CAMPOS_FIDELIZACION = [...CAMPOS_COMUNES,
  { key: "motivo_visita", label: "Motivo de la visita", kind: "seleccion", match: ["motivo de la visita"] },
  { key: "detecto_nuevo", label: "¿Detectó algo nuevo?", kind: "seleccion", match: ["detectaste algo nuevo"] },
  { key: "que_detecto", label: "¿Qué detectó?", kind: "texto", match: ["que detectaste"] },
  { key: "comentario", label: "Comentario libre", kind: "texto", match: ["comentario"] },
];

const CAMPOS_SEGUIMIENTO = [...CAMPOS_COMUNES,
  { key: "unidad_vendiendo", label: "Unidad(es) que le está vendiendo", kind: "texto", match: ["vendiendo"] },
  { key: "cantidad_unidades", label: "Cantidad de unidades", kind: "texto", match: ["cantidad de unidades"] },
  { key: "etapa_proyecto", label: "Etapa del proyecto", kind: "seleccion", match: ["etapa se encuentra", "etapa"] },
  { key: "competencia", label: "Estado frente a la competencia", kind: "seleccion", match: ["competencia"] },
  { key: "tiempo_decision", label: "¿Para cuándo estima decidir?", kind: "seleccion", match: ["estima decidir"] },
  { key: "medio_pago", label: "Medio de pago", kind: "seleccion", match: ["medio de pago"] },
  { key: "entidad_financiera", label: "Entidad financiera", kind: "texto", match: ["entidad financiera", "entidad bancaria"] },
  { key: "comentario", label: "Comentario libre", kind: "texto", match: ["comentario"] },
];

const CAMPOS_VENTAS_LEGADO = [
  { key: "foto_fachada", label: "Foto de fachada", kind: "foto", match: ["fachad"] },
  { key: "contacto_texto", label: "Contacto (nombre y teléfono, texto libre)", kind: "texto", match: ["nombre de contacto"] },
  { key: "comentario", label: "Comentario de la visita", kind: "texto", match: ["comentario"] },
  { key: "ubicacion", label: "Ubicación", kind: "ubicacion", match: ["ubicac"] },
  { key: "foto_extra", label: "Foto extra", kind: "foto", match: ["foto extra"] },
  { key: "firma", label: "Firma", kind: "foto", match: ["firma"] },
];

const CATALOGO = {
  "FORMULARIO VENTAS": CAMPOS_VENTAS_LEGADO,
  "FORMULARIO PROSPECCION": CAMPOS_PROSPECCION,
  "FORMULARIO FIDELIZACION": CAMPOS_FIDELIZACION,
  "FORMULARIO SEGUIMIENTO": CAMPOS_SEGUIMIENTO,
};

function matchCampo(formulario, pregunta) {
  const campos = CATALOGO[formulario];
  if (!campos) return null;
  const p = norm(pregunta);
  for (const campo of campos) {
    const excluye = (campo.exclude || []).some((kw) => p.includes(kw));
    if (excluye) continue;
    if (campo.match.some((kw) => p.includes(kw))) return campo;
  }
  return null;
}

module.exports = { CATALOGO, matchCampo, norm };
