/* =========================================================================
   MOTOR DE REGLAS — no contiene lógica de negocio.
   Lee INDICADORES (indicadores.js) y SUCURSALES (sucursales.js) y sabe
   interpretarlos. Toda decisión de "qué es cada indicador" o "qué
   sucursales existen" vive en esos dos catálogos, no acá.
   ========================================================================= */

function metricasActivas() {
  return INDICADORES.filter(m => m.activo && m.modo !== 'derivada')
    .sort((a, b) => a.orden - b.orden);
}
function metricasDerivadasActivas() {
  return INDICADORES.filter(m => m.activo && m.modo === 'derivada')
    .sort((a, b) => a.orden - b.orden);
}
function allMetrics() {
  return INDICADORES.filter(m => m.activo).sort((a, b) => a.orden - b.orden);
}

function cumpleCondicion(row, cond) {
  const val = row[cond.campo];
  const op = cond.operador || 'eq';
  if (op === 'in') return Array.isArray(cond.valor) && cond.valor.includes(val);
  if (op === 'contains') return typeof val === 'string' && val.toUpperCase().includes(String(cond.valor).toUpperCase());
  return val === cond.valor;
}
function cumpleTodas(row, condiciones) {
  return (condiciones || []).every(c => cumpleCondicion(row, c));
}

/* ---------------------------- motor de agregación ---------------------------- */

function emptyAgg() {
  const a = {};
  metricasActivas().forEach(m => { a[m.key] = 0; });
  return a;
}

const IVA_FACTOR = 1.19;

function addRow(agg, row) {
  metricasActivas().forEach(m => {
    if (!cumpleTodas(row, m.condiciones)) return;
    if (m.modo === 'cantidad') agg[m.key] += Number(row.cantidad) || 0;
    else if (m.modo === 'monto') {
      const bruto = Number(row.monto) || 0;
      agg[m.key] += m.neto ? bruto / IVA_FACTOR : bruto;
    }
  });
}

function finalizeAgg(agg) {
  metricasDerivadasActivas().forEach(m => {
    const num = agg[m.formula.numerador] || 0;
    const den = agg[m.formula.denominador] || 0;
    agg[m.key] = den ? num / den : 0;
  });
  return agg;
}

function aggregateBy(rows, keyFn) {
  const map = new Map();
  rows.forEach(row => {
    const key = keyFn(row);
    if (!key) return;
    if (!map.has(key)) map.set(key, emptyAgg());
    addRow(map.get(key), row);
  });
  map.forEach(agg => finalizeAgg(agg));
  return map;
}

function totalAgg(rows) {
  const agg = emptyAgg();
  rows.forEach(row => addRow(agg, row));
  return finalizeAgg(agg);
}

/* ---------------------------- gobierno de datos ---------------------------- */

// Filas cuyo "tipo" no calza con NINGÚN indicador activo (aviso temprano
// de que Bsale trajo una categoría nueva que todavía no está en el catálogo)
function filasSinCategorizar(rows) {
  const activos = metricasActivas();
  return rows.filter(row => !activos.some(m => cumpleTodas(row, m.condiciones)));
}

// Sucursales presentes en el archivo que no están en el catálogo SUCURSALES
function sucursalesNoCatalogadas(rows) {
  const catalogadas = new Set(SUCURSALES.map(s => s.nombreBsale));
  const enArchivo = new Set(rows.map(r => r.sucursal).filter(Boolean));
  return Array.from(enArchivo).filter(s => !catalogadas.has(s));
}

// Sucursales del catálogo marcadas inactivas pero que igual traen datos
function sucursalesInactivasConDatos(rows) {
  const inactivas = new Set(SUCURSALES.filter(s => !s.activa).map(s => s.nombreBsale));
  const enArchivo = new Set(rows.map(r => r.sucursal).filter(Boolean));
  return Array.from(enArchivo).filter(s => inactivas.has(s));
}

function ciudadesCatalogo() {
  const orden = [];
  const seen = new Set();
  SUCURSALES.filter(s => s.activa).forEach(s => {
    if (!seen.has(s.ciudad)) { seen.add(s.ciudad); orden.push(s.ciudad); }
  });
  return orden.map(ciudad => ({
    id: ciudad.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ''),
    label: ciudad,
    sucursales: SUCURSALES.filter(s => s.activa && s.ciudad === ciudad).map(s => s.nombreBsale),
  }));
}
