/* =========================================================================
   Comercial Express — Panel de Ventas
   Fuente única: la tabla plana descargada de Bsale (1 fila = 1 línea vendida).
   Qué se calcula (indicadores.js) y qué sucursales existen (sucursales.js)
   son catálogos de datos, no código. app.js solo renderiza.
   ========================================================================= */

let ROWS = TRANSACCIONES_INICIALES.slice();
let fileName = null;
let fileLoadedAt = null;
let activeTab = 'resumen';
let chartRef = null;

const METAS_STORAGE_KEY = 'cex_metas_v1';
let METAS = loadMetas();

function loadMetas() {
  try {
    const raw = localStorage.getItem(METAS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {};
}
function saveMetas() {
  try { localStorage.setItem(METAS_STORAGE_KEY, JSON.stringify(METAS)); } catch (e) {}
}

/* ---------------------------- formatting ---------------------------- */
function fmt(val, unidad) {
  if (val === null || val === undefined || val === '' || Number.isNaN(Number(val))) return '—';
  const n = Number(val);
  if (unidad === 'pct') return (n * 100).toFixed(1) + '%';
  if (unidad === 'money') return '$' + Math.round(n).toLocaleString('es-CL');
  return Number.isInteger(n) ? n.toLocaleString('es-CL') : n.toLocaleString('es-CL', { maximumFractionDigits: 1 });
}
function statusColor(ratio) {
  if (ratio >= 1) return 'green';
  if (ratio >= 0.7) return 'amber';
  return 'red';
}
function statusHex(cls) {
  return cls === 'green' ? 'var(--pos-fg)' : cls === 'amber' ? 'oklch(42% 0.12 70)' : 'var(--neg-fg)';
}

// Columnas de datos con ancho FIJO e IGUAL (var(--col-metric)) — el texto
// (encabezado abreviado "corto", valores) se adapta a ese ancho, nunca al revés.
function colgroupData(metrics) {
  return metrics.map(() => '<col class="col-data">').join('');
}
function thLabel(m) {
  return `<th class="num" title="${m.label}">${m.corto || m.label}</th>`;
}

/* ---------------------------- nav ---------------------------- */
function buildNav() {
  const nav = document.getElementById('tabNav');
  const ciudades = ciudadesCatalogo();
  const items = [{ id: 'resumen', label: 'Resumen General', count: SUCURSALES.filter(s => s.activa).length }]
    .concat(ciudades.map(c => ({ id: c.id, label: c.label, count: c.sucursales.length })))
    .concat([
      { id: 'metas', label: 'Metas y Cuotas', count: null },
      { id: 'estructura', label: 'Estructura de Datos', count: null },
    ]);
  nav.innerHTML = items.map(it => `
    <button class="tab-btn ${it.id === activeTab ? 'active' : ''}" data-tab="${it.id}">
      <span>${it.label}</span>${it.count !== null ? `<span class="count">${it.count}</span>` : ''}
    </button>`).join('');
  nav.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => { activeTab = btn.dataset.tab; render(); });
  });
}

function buildHeader() {
  const sub = document.getElementById('subHeader');
  const fechas = ROWS.map(r => r.fecha).filter(Boolean);
  const base = fechas.length
    ? `${ROWS.length} líneas de venta cargadas · fechas ${fechas[fechas.length - 1]} a ${fechas[0]}`
    : 'Sin datos cargados';
  const horaCarga = SP_STATUS.archivo || fileLoadedAt;
  const sufijo = horaCarga ? ` · última carga ${horaCarga.toLocaleDateString('es-CL')} ${horaCarga.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} hrs` : '';
  sub.textContent = base + sufijo;
}

/* ---------------------------- avisos de gobierno de datos ---------------------------- */
function renderAvisos() {
  const sinCat = filasSinCategorizar(ROWS);
  const noCatalogadas = sucursalesNoCatalogadas(ROWS);
  const inactivasConDatos = sucursalesInactivasConDatos(ROWS);
  if (!sinCat.length && !noCatalogadas.length && !inactivasConDatos.length) return '';

  let items = '';
  if (noCatalogadas.length) {
    items += `<li><b>${noCatalogadas.length} sucursal(es) sin catalogar:</b> ${noCatalogadas.join(', ')} — agrégalas en <code>sucursales.js</code> o revisa si cambió el nombre en Bsale.</li>`;
  }
  if (inactivasConDatos.length) {
    items += `<li><b>Sucursales inactivas con ventas:</b> ${inactivasConDatos.join(', ')} — están marcadas <code>activa: false</code> pero el archivo trae datos suyos.</li>`;
  }
  if (sinCat.length) {
    const tipos = Array.from(new Set(sinCat.map(r => r.tipo)));
    items += `<li><b>${sinCat.length} línea(s) sin indicador asociado</b>, tipo(s): ${tipos.join(', ')} — revisa la pestaña <b>Estructura de Datos</b> para activarlos si corresponde.</li>`;
  }
  return `<div class="panel" style="border-left:4px solid oklch(68% 0.14 75);background:oklch(97% 0.03 75);">
    <h2 style="color:oklch(42% 0.12 70);">⚠ Aviso de estructura</h2>
    <ul style="margin:10px 0 0;padding-left:18px;font-size:12.5px;line-height:1.8;">${items}</ul>
  </div>`;
}

/* ---------------------------- RESUMEN GENERAL ---------------------------- */
function renderResumen(container) {
  const metrics = allMetrics();
  const total = totalAgg(ROWS);

  let kpiHtml = '<div class="kpi-grid">';
  metrics.forEach(m => {
    const val = total[m.key] ?? 0;
    const goal = METAS[m.key] ? METAS[m.key].cuotaDia : 0;
    const ratio = goal ? (val / goal) : null;
    const cls = ratio !== null ? statusColor(ratio) : 'amber';
    const pct = ratio !== null ? Math.min(ratio * 100, 100) : 0;
    kpiHtml += `
      <div class="kpi-card">
        <div class="label">${m.label}</div>
        <div class="value">${fmt(val, m.unidad)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${statusHex(cls)}"></div></div>
        <div class="kpi-foot">
          <span>Cuota día: ${goal ? fmt(goal, m.unidad) : 's/d'}</span>
          <span class="pill ${cls}">${ratio !== null ? Math.round(ratio * 100) + '%' : 's/d'}</span>
        </div>
      </div>`;
  });
  kpiHtml += '</div>';

  const sucAgg = aggregateBy(ROWS, r => r.sucursal);
  const sucsFijas = SUCURSALES.filter(s => s.activa); // orden fijo del catálogo, siempre todas

  let tableHtml = `
    <div class="panel">
      <h2>Avance por sucursal</h2>
      <div class="accent-rule"></div>
      <div style="overflow-x:auto">
      <table class="grid-table">
        <colgroup>
          <col class="col-name">
          ${colgroupData(metrics)}
        </colgroup>
        <thead><tr>
          <th>Sucursal</th>
          ${metrics.map(m => thLabel(m)).join('')}
        </tr></thead>
        <tbody>
          ${sucsFijas.map(s => {
            const agg = sucAgg.get(s.nombreBsale) || finalizeAgg(emptyAgg());
            return `<tr>
              <td>${s.nombreVisible}</td>
              ${metrics.map(m => `<td class="num">${fmt(agg[m.key], m.unidad)}</td>`).join('')}
            </tr>`;
          }).join('')}
          <tr class="total-row">
            <td>${TOTAL_LABEL}</td>
            ${metrics.map(m => `<td class="num">${fmt(total[m.key], m.unidad)}</td>`).join('')}
          </tr>
        </tbody>
      </table>
      </div>
    </div>`;

  const hasMetas = Object.values(METAS).some(v => v.meta > 0);
  let chartHtml = '';
  if (hasMetas) {
    chartHtml = `
      <div class="panel">
        <h2>Cumplimiento vs meta mensual <span class="tag">% avance</span></h2>
        <div class="accent-rule"></div>
        <div class="chart-wrap"><canvas id="metricChart"></canvas></div>
      </div>`;
  } else {
    chartHtml = `
      <div class="panel">
        <h2>Cumplimiento vs meta mensual</h2>
        <div class="empty">Aún no definiste metas. Ve a la pestaña <b>Metas y Cuotas</b> para cargarlas.</div>
      </div>`;
  }

  container.innerHTML = renderAvisos() + kpiHtml + chartHtml + tableHtml;

  if (hasMetas) {
    const ctx = document.getElementById('metricChart');
    if (chartRef) chartRef.destroy();
    const labels = metrics.map(m => m.label);
    const pcts = metrics.map(m => {
      const g = METAS[m.key] ? METAS[m.key].meta : 0;
      const v = total[m.key];
      if (!g) return 0;
      return Math.round((v / g) * 1000) / 10;
    });
    chartRef = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ data: pcts, backgroundColor: pcts.map(p => p >= 100 ? '#3FBF7F' : p >= 60 ? '#E8A93A' : '#E15B5B'), borderRadius: 5, maxBarThickness: 42 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => v + '%' }, grid: { color: '#EEF2F7' } },
          x: { grid: { display: false } }
        }
      }
    });
  }
}

/* ---------------------------- CITY tabs ---------------------------- */
function renderCity(container, ciudad) {
  const metrics = allMetrics();
  const sucs = ciudad.sucursales; // ya vienen en orden fijo del catálogo, siempre todas
  const cityRows = ROWS.filter(r => sucs.includes(r.sucursal));
  const cityTotal = totalAgg(cityRows);

  let kpiHtml = '<div class="kpi-grid">';
  metrics.forEach(m => {
    kpiHtml += `<div class="kpi-card"><div class="label">${m.label}</div><div class="value">${fmt(cityTotal[m.key], m.unidad)}</div></div>`;
  });
  kpiHtml += '</div>';

  // Sucursales de la misma ciudad, siempre apiladas verticalmente (una debajo de otra)
  let storesHtml = '<div class="store-grid">';
  sucs.forEach(s => {
    const storeRows = ROWS.filter(r => r.sucursal === s);
    const vendAgg = aggregateBy(storeRows, r => r.vendedor);

    // Si la Dotación Vigente está sincronizada, se listan TODOS los
    // vendedores activos asignados a esta sucursal (en cero si no vendieron).
    // Si no está sincronizada, se listan solo quienes tienen ventas (como antes).
    const dotacionSucursal = DOTACION_VIGENTE.filter(d => d.sucursal === s);
    let nombresVendedores;
    if (dotacionSucursal.length) {
      nombresVendedores = dotacionSucursal.map(d => d.nombre);
      // por si alguien vendió sin figurar en la dotación (recién ingresado, etc.)
      vendAgg.forEach((_, nombre) => { if (!nombresVendedores.includes(nombre)) nombresVendedores.push(nombre); });
    } else {
      nombresVendedores = Array.from(vendAgg.keys());
    }

    if (nombresVendedores.length === 0) {
      storesHtml += `<div class="branch-card">
        <div class="branch-head"><span>${s}</span><span class="tag">0 vendedores</span></div>
        <div class="empty">Sin ventas registradas en este archivo.</div>
      </div>`;
      return;
    }
    const vendedores = nombresVendedores.sort((a, b) => ((vendAgg.get(b) || {})[metrics[0].key] || 0) - ((vendAgg.get(a) || {})[metrics[0].key] || 0));
    storesHtml += `<div class="branch-card">
      <div class="branch-head"><span>${s}</span><span class="tag">${vendedores.length} vendedores</span></div>
      <div style="overflow-x:auto"><table class="grid-table">
        <colgroup><col class="col-name">${colgroupData(metrics)}</colgroup>
        <thead><tr><th>Vendedor</th>${metrics.map(m => thLabel(m)).join('')}</tr></thead>
        <tbody>
          ${vendedores.map(v => {
            const agg = vendAgg.get(v) || finalizeAgg(emptyAgg());
            return `<tr>
            <td>${v}</td>
            ${metrics.map(m => `<td class="num">${fmt(agg[m.key], m.unidad)}</td>`).join('')}</tr>`;
          }).join('')}
          <tr class="total-row">
            <td>TOTAL</td>
            ${metrics.map(m => `<td class="num">${fmt(totalAgg(storeRows)[m.key], m.unidad)}</td>`).join('')}
          </tr>
        </tbody>
      </table></div>
    </div>`;
  });
  storesHtml += '</div>';

  container.innerHTML = kpiHtml + storesHtml;
}

/* ---------------------------- METAS tab ---------------------------- */
function renderMetas(container) {
  const metrics = metricasActivas(); // metas no aplican a derivadas (ej. % mix porta)
  container.innerHTML = `
    <div class="panel">
      <h2>Metas y cuotas por métrica</h2>
      <div class="accent-rule"></div>
      <p style="font-size:12.5px;color:var(--text-muted);margin-top:-8px;margin-bottom:16px;">
        Se guardan en este navegador y se usan en el Resumen General para calcular % de cumplimiento.
      </p>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px;">
        <thead><tr style="border-bottom:1px solid var(--border-strong);">
          <th style="text-align:left;padding:8px 10px;font-family:var(--font-display);font-size:10.5px;text-transform:uppercase;color:var(--text-muted);">Métrica</th>
          <th style="text-align:center;padding:8px 10px;font-family:var(--font-display);font-size:10.5px;text-transform:uppercase;color:var(--text-muted);">Meta mensual</th>
          <th style="text-align:center;padding:8px 10px;font-family:var(--font-display);font-size:10.5px;text-transform:uppercase;color:var(--text-muted);">Cuota al día</th>
        </tr></thead>
        <tbody>
          ${metrics.map(m => `<tr style="border-bottom:1px solid var(--border-faint);">
            <td style="padding:7px 10px;font-weight:600;color:var(--text-strong);">${m.label}</td>
            <td style="padding:7px 10px;text-align:center;"><input type="number" step="any" data-metric="${m.key}" data-field="meta" value="${METAS[m.key] ? METAS[m.key].meta : 0}" style="width:110px;text-align:center;padding:5px 7px;border:1px solid var(--border-strong);border-radius:8px;font-family:var(--font-body);"></td>
            <td style="padding:7px 10px;text-align:center;"><input type="number" step="any" data-metric="${m.key}" data-field="cuotaDia" value="${METAS[m.key] ? METAS[m.key].cuotaDia : 0}" style="width:110px;text-align:center;padding:5px 7px;border:1px solid var(--border-strong);border-radius:8px;font-family:var(--font-body);"></td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`;
  container.querySelectorAll('input[data-metric]').forEach(inp => {
    inp.addEventListener('change', () => {
      const k = inp.dataset.metric, f = inp.dataset.field;
      if (!METAS[k]) METAS[k] = { meta: 0, cuotaDia: 0 };
      METAS[k][f] = Number(inp.value) || 0;
      saveMetas();
    });
  });
}

/* ---------------------------- ESTRUCTURA DE DATOS tab ---------------------------- */
function condTexto(cond) {
  if (cond.operador === 'in') return `${cond.campo} en [${cond.valor.join(', ')}]`;
  if (cond.operador === 'contains') return `${cond.campo} contiene "${cond.valor}"`;
  return `${cond.campo} = ${cond.valor}`;
}

function renderEstructura(container) {
  const thStyle = 'text-align:left;padding:8px 10px;font-family:var(--font-display);font-size:10.5px;text-transform:uppercase;color:var(--text-muted);border-bottom:1px solid var(--border-strong);';
  const tdStyle = 'padding:7px 10px;border-bottom:1px solid var(--border-faint);';
  const indicadorRows = INDICADORES.slice().sort((a, b) => a.orden - b.orden).map(m => `
    <tr style="${m.activo ? '' : 'opacity:.4;'}">
      <td style="${tdStyle}font-weight:600;color:var(--text-strong);">${m.label}</td>
      <td style="${tdStyle}"><code>${m.key}</code></td>
      <td style="${tdStyle}">${m.categoria}</td>
      <td style="${tdStyle}">${m.unidad}</td>
      <td style="${tdStyle}font-size:11.5px;">${m.modo === 'derivada' ? `= ${m.formula.numerador} / ${m.formula.denominador}` : (m.condiciones || []).map(condTexto).join(' Y ')}${m.neto ? ' <span style="color:var(--brand-600);font-weight:700;">· NETO ÷1.19</span>' : ''}</td>
      <td style="${tdStyle}">${m.activo ? '<span class="pill green">ACTIVO</span>' : '<span class="pill red">INACTIVO</span>'}</td>
    </tr>`).join('');

  const sucursalRows = SUCURSALES.map(s => `
    <tr style="${s.activa ? '' : 'opacity:.4;'}">
      <td style="${tdStyle}font-weight:600;color:var(--text-strong);">${s.nombreVisible}</td>
      <td style="${tdStyle}">${s.ciudad}</td>
      <td style="${tdStyle}">${s.tipo}</td>
      <td style="${tdStyle}">${s.activa ? '<span class="pill green">ACTIVA</span>' : '<span class="pill red">INACTIVA</span>'}</td>
    </tr>`).join('');

  container.innerHTML = `
    <div class="panel">
      <h2>Catálogo de indicadores <span class="tag">indicadores.js</span></h2>
      <div class="accent-rule"></div>
      <p style="font-size:12.5px;color:var(--text-muted);margin-top:-8px;margin-bottom:16px;">
        Agregar, quitar o modificar un indicador es editar este archivo — no hay lógica de programación que tocar.
        Los indicadores en gris están definidos pero desactivados.
      </p>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px;">
        <thead><tr><th style="${thStyle}">Nombre</th><th style="${thStyle}">Clave</th><th style="${thStyle}">Categoría</th><th style="${thStyle}">Unidad</th><th style="${thStyle}">Regla</th><th style="${thStyle}">Estado</th></tr></thead>
        <tbody>${indicadorRows}</tbody>
      </table></div>
    </div>
    <div class="panel">
      <h2>Catálogo de sucursales <span class="tag">sucursales.js</span></h2>
      <div class="accent-rule"></div>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px;">
        <thead><tr><th style="${thStyle}">Sucursal</th><th style="${thStyle}">Ciudad</th><th style="${thStyle}">Tipo</th><th style="${thStyle}">Estado</th></tr></thead>
        <tbody>${sucursalRows}</tbody>
      </table></div>
    </div>`;
}

/* ---------------------------- dispatcher ---------------------------- */
function render() {
  buildNav();
  buildHeader();
  const container = document.getElementById('tabContent');
  if (activeTab === 'resumen') renderResumen(container);
  else if (activeTab === 'metas') renderMetas(container);
  else if (activeTab === 'estructura') renderEstructura(container);
  else {
    const ciudad = ciudadesCatalogo().find(c => c.id === activeTab);
    renderCity(container, ciudad);
  }
}

/* =========================================================================
   CARGA DE ARCHIVO — lee la tabla plana tal cual se descarga de Bsale
   ========================================================================= */

const COL_MAP = {
  'Fecha Documento': 'fecha',
  'Vendedor': 'vendedor',
  'Codigo cliente': 'cliente',
  'Código cliente': 'cliente',
  'Producto / Servicio + Variante': 'producto',
  'Cantidad': 'cantidad',
  'SEGMENTO': 'segmento',
  'Sucursal': 'sucursal',
  'PLATAFORMA': 'plataforma',
  'Suma de Subtotal Bruto': 'monto',
  'Tipo de Producto / Servicio': 'tipo',
};

function parseArchivoPlano(wb) {
  const sheetName = wb.SheetNames[0];
  const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: null });
  if (matrix.length < 2) throw new Error('El archivo no tiene filas de datos.');
  const header = matrix[0];
  const idx = {};
  header.forEach((h, i) => {
    const key = COL_MAP[typeof h === 'string' ? h.trim() : h];
    if (key) idx[key] = i;
  });
  const required = ['vendedor', 'sucursal', 'tipo'];
  const missing = required.filter(k => idx[k] === undefined);
  if (missing.length) throw new Error('Faltan columnas esperadas: ' + missing.join(', '));

  const rows = [];
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row || !row[idx.vendedor]) continue;
    rows.push({
      fecha: idx.fecha !== undefined ? row[idx.fecha] : null,
      vendedor: row[idx.vendedor],
      cliente: idx.cliente !== undefined ? row[idx.cliente] : null,
      producto: idx.producto !== undefined ? row[idx.producto] : null,
      cantidad: idx.cantidad !== undefined ? (Number(row[idx.cantidad]) || 0) : 0,
      segmento: idx.segmento !== undefined ? row[idx.segmento] : null,
      sucursal: row[idx.sucursal],
      plataforma: idx.plataforma !== undefined ? row[idx.plataforma] : null,
      monto: idx.monto !== undefined ? (Number(row[idx.monto]) || 0) : 0,
      tipo: row[idx.tipo],
    });
  }
  return rows;
}

document.getElementById('fileInput').addEventListener('change', async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: false });
    ROWS = parseArchivoPlano(wb);
    fileName = file.name;
    fileLoadedAt = new Date();
    updateLoadMeta();
    activeTab = 'resumen';
    render();
  } catch (err) {
    console.error(err);
    alert('No se pudo leer el archivo: ' + err.message);
  }
});

/* --- Sincronización con SharePoint (listas + archivo) ---
   Ver sharepoint.js para la configuración (siteUrl, nombres de lista).
   Solo funciona si este panel está abierto DESDE tu sitio SharePoint
   (misma sesión = misma autenticación). Ver comentario al inicio de
   sharepoint.js para el detalle. */

function actualizarUISesion() {
  const cuenta = spCuentaActiva();
  const loginBtn = document.getElementById('spLoginBtn');
  const acctSpan = document.getElementById('spAccount');
  const syncBtn = document.getElementById('spSyncBtn');
  const diagBtn = document.getElementById('spDiagBtn');
  if (cuenta) {
    loginBtn.textContent = 'Cerrar sesión';
    acctSpan.textContent = cuenta.username;
    syncBtn.disabled = false;
    diagBtn.disabled = false;
  } else {
    loginBtn.textContent = 'Iniciar sesión con Microsoft';
    acctSpan.textContent = '';
    syncBtn.disabled = true;
    diagBtn.disabled = true;
  }
}

document.getElementById('spLoginBtn').addEventListener('click', async () => {
  const statusBox = document.getElementById('spStatus');
  if (!spConfigured()) {
    statusBox.innerHTML = '<span style="color:var(--neg-fg);">Falta completar clientId / tenantId en <code>GRAPH_CONFIG</code> (sharepoint.js).</span>';
    return;
  }
  try {
    if (spCuentaActiva()) {
      await spCerrarSesion();
    } else {
      await spIniciarSesion();
    }
    actualizarUISesion();
    statusBox.textContent = '';
  } catch (err) {
    console.error(err);
    statusBox.innerHTML = `<span style="color:var(--neg-fg);">No se pudo iniciar sesión: ${err.message}</span>`;
  }
});

document.getElementById('spSyncBtn').addEventListener('click', async () => {
  const btn = document.getElementById('spSyncBtn');
  const statusBox = document.getElementById('spStatus');
  if (!spCuentaActiva()) {
    statusBox.innerHTML = '<span style="color:var(--neg-fg);">Inicia sesión con Microsoft primero.</span>';
    return;
  }
  const original = btn.textContent;
  btn.textContent = 'Sincronizando…';
  btn.disabled = true;
  const pintar = (resultados) => {
    statusBox.innerHTML = resultados.map(r =>
      `<div>${r.ok ? '✓' : '✕'} <b>${r.nombre}:</b> ${r.detalle}</div>`
    ).join('');
  };
  try {
    const resultados = await spSincronizarTodo(pintar);
    pintar(resultados);
    activeTab = 'resumen';
    render();
  } catch (err) {
    console.error(err);
    statusBox.innerHTML = `<span style="color:var(--neg-fg);">Error inesperado: ${err.message}</span>`;
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
});

document.getElementById('spDiagBtn').addEventListener('click', async () => {
  const statusBox = document.getElementById('spStatus');
  if (!spCuentaActiva()) {
    statusBox.innerHTML = '<span style="color:var(--neg-fg);">Inicia sesión con Microsoft primero.</span>';
    return;
  }
  statusBox.textContent = 'Diagnosticando…';
  const diag = await spDiagnostico();
  if (!diag.ok) {
    statusBox.innerHTML = `<span style="color:var(--neg-fg);">${diag.mensaje}</span>`;
    return;
  }
  statusBox.innerHTML = Object.entries(diag.listas).map(([clave, r]) => {
    if (!r.ok) return `<div>✕ <b>${r.lista}:</b> ${r.error}</div>`;
    return `<div>✓ <b>${r.lista}</b> — columnas: ${r.columnas.map(c => c.interno).join(', ')}</div>`;
  }).join('');
});

function updateLoadMeta() {
  const box = document.getElementById('loadMeta');
  box.innerHTML = fileName
    ? `Archivo cargado: <b>${fileName}</b> · ${ROWS.length} líneas de venta.`
    : 'Mostrando datos de referencia incluidos en el panel. Carga el archivo descargado de Bsale para actualizar.';
}

// Al cargar la página, si ya había una sesión de Microsoft guardada
// (localStorage), se restaura sola sin pedir login de nuevo.
async function restaurarSesionSiExiste() {
  if (!spConfigured()) return;
  try {
    const app = await spInitMsal();
    const cuentas = app.getAllAccounts();
    if (cuentas.length) app.setActiveAccount(cuentas[0]);
  } catch (e) { console.warn('MSAL no disponible todavía:', e.message); }
  actualizarUISesion();
}

updateLoadMeta();
restaurarSesionSiExiste();
render();
