/* =========================================================================
   CONECTOR MICROSOFT GRAPH — Comercial Express
   -------------------------------------------------------------------------
   Este panel puede alojarse en CUALQUIER lugar (GitHub Pages, etc.) porque
   ya no depende de la sesión ambiente de SharePoint. En vez de eso, usa
   inicio de sesión real de Microsoft (MSAL.js) con tu correo institucional
   y llama a Microsoft Graph — la API oficial y soportada para leer sitios,
   listas y archivos de SharePoint desde fuera del propio sitio.

   REQUISITO ÚNICO (lo hace un administrador, una sola vez):
   registrar una app en Azure AD / Entra ID. Ver instrucciones completas
   en el mensaje de despliegue — resumen:
     1. portal.azure.com (o entra.microsoft.com) > App registrations > New
     2. Tipo de cuenta: solo este directorio (single-tenant)
     3. Redirect URI tipo "Single-page application (SPA)": la URL exacta
        donde vas a alojar este panel (ej. GitHub Pages)
     4. Copiar "Application (client) ID" y "Directory (tenant) ID" abajo
     5. API permissions > Microsoft Graph > Delegated > agregar:
        Sites.Read.All, Files.Read.All, User.Read > "Grant admin consent"

   CÓMO CONFIGURAR ESTE ARCHIVO:
     Completa GRAPH_CONFIG más abajo con esos IDs y con los nombres de tus
     listas / ruta del archivo de ventas. Todo lo demás (login, tokens,
     llamadas a la API) ya está resuelto.
   ========================================================================= */

const GRAPH_CONFIG = {
  clientId: '',   // <-- Application (client) ID de la app registrada en Azure AD
  tenantId: '',   // <-- Directory (tenant) ID
  siteHostname: 'clcomercialexpress.sharepoint.com',
  sitePath: '/sites/BIBLIOTECA_CEX',
  listas: {
    sucursales: 'Sucursales',
    dotacion: 'Dotación Vigente',
    indicadores: 'Indicadores',
    metas: 'Metas y Cuotas',
  },
  // Ruta del archivo de ventas DENTRO de la biblioteca de documentos
  // (relativa a la raíz del sitio, sin barra inicial). Ejemplo:
  // 'APP/files (3)/reporte_bsale.xlsx'
  archivoVentasPath: '',
  scopes: ['Sites.Read.All', 'Files.Read.All', 'User.Read'],
};

const MAPEO_CAMPOS = {
  sucursales: { nombreBsale: 'Title', ciudad: 'Ciudad', tipo: 'Tipo', activa: 'Activa', orden: 'Orden' },
  dotacion: { nombre: 'Title', sucursal: 'Sucursal', activo: 'Activo' },
  indicadores: { key: 'Title', activo: 'Activo', label: 'Nombre', corto: 'Corto', orden: 'Orden' },
  metas: { key: 'IndicadorKey', meta: 'MetaMensual', cuotaDia: 'CuotaDia' },
};

let SP_STATUS = { sucursales: null, dotacion: null, indicadores: null, metas: null, archivo: null };
let msalInstance = null;
let SITE_ID_CACHE = null;

function spConfigured() {
  return !!(GRAPH_CONFIG.clientId && GRAPH_CONFIG.tenantId);
}

/* ---------------------------- autenticación (MSAL) ---------------------------- */

function spInitMsal() {
  if (msalInstance) return msalInstance;
  if (typeof msal === 'undefined') throw new Error('No cargó la librería MSAL (revisa el <script> en el HTML).');
  msalInstance = new msal.PublicClientApplication({
    auth: {
      clientId: GRAPH_CONFIG.clientId,
      authority: `https://login.microsoftonline.com/${GRAPH_CONFIG.tenantId}`,
      redirectUri: window.location.origin + window.location.pathname,
    },
    cache: { cacheLocation: 'localStorage' },
  });
  return msalInstance;
}

function spCuentaActiva() {
  if (!msalInstance) return null;
  return msalInstance.getActiveAccount();
}

async function spIniciarSesion() {
  if (!spConfigured()) throw new Error('Falta completar clientId / tenantId en GRAPH_CONFIG (sharepoint.js).');
  const app = spInitMsal();
  const result = await app.loginPopup({ scopes: GRAPH_CONFIG.scopes });
  app.setActiveAccount(result.account);
  return result.account;
}

function spCerrarSesion() {
  if (!msalInstance) return;
  const account = spCuentaActiva();
  msalInstance.logoutPopup({ account });
}

async function spObtenerToken() {
  const app = spInitMsal();
  const account = spCuentaActiva();
  if (!account) throw new Error('No hay sesión iniciada — toca "Iniciar sesión con Microsoft" primero.');
  try {
    const res = await app.acquireTokenSilent({ scopes: GRAPH_CONFIG.scopes, account });
    return res.accessToken;
  } catch (e) {
    const res = await app.acquireTokenPopup({ scopes: GRAPH_CONFIG.scopes });
    return res.accessToken;
  }
}

/* ---------------------------- Microsoft Graph ---------------------------- */

async function graphFetch(path) {
  const token = await spObtenerToken();
  const resp = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const texto = await resp.text().catch(() => '');
    throw new Error(`Graph ${path} → HTTP ${resp.status}${texto ? ' — ' + texto.slice(0, 160) : ''}`);
  }
  return resp.json();
}

async function graphResolveSiteId() {
  if (SITE_ID_CACHE) return SITE_ID_CACHE;
  const data = await graphFetch(`/sites/${GRAPH_CONFIG.siteHostname}:${GRAPH_CONFIG.sitePath}`);
  SITE_ID_CACHE = data.id;
  return SITE_ID_CACHE;
}

async function graphFetchListFields(listTitle) {
  const siteId = await graphResolveSiteId();
  const listsData = await graphFetch(`/sites/${siteId}/lists?$filter=${encodeURIComponent(`displayName eq '${listTitle}'`)}`);
  const list = (listsData.value || [])[0];
  if (!list) throw new Error(`Lista "${listTitle}" no encontrada en el sitio.`);
  const colsData = await graphFetch(`/sites/${siteId}/lists/${list.id}/columns?$select=name,displayName,hidden`);
  return (colsData.value || []).filter(c => !c.hidden).map(c => ({ titulo: c.displayName, interno: c.name }));
}

async function graphFetchListItems(listTitle) {
  const siteId = await graphResolveSiteId();
  const listsData = await graphFetch(`/sites/${siteId}/lists?$filter=${encodeURIComponent(`displayName eq '${listTitle}'`)}`);
  const list = (listsData.value || [])[0];
  if (!list) throw new Error(`Lista "${listTitle}" no encontrada en el sitio.`);
  const itemsData = await graphFetch(`/sites/${siteId}/lists/${list.id}/items?expand=fields&$top=999`);
  return (itemsData.value || []).map(it => it.fields || {});
}

async function graphFetchFileBytes(relativePath) {
  const siteId = await graphResolveSiteId();
  const token = await spObtenerToken();
  const path = relativePath.split('/').map(encodeURIComponent).join('/');
  const resp = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${path}:/content`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`Archivo de ventas → HTTP ${resp.status} (¿ruta correcta?)`);
  const modified = resp.headers.get('Last-Modified');
  const buf = await resp.arrayBuffer();
  return { buf, modified };
}

/* ---------------------------- diagnóstico ---------------------------- */

async function spDiagnostico() {
  if (!spConfigured()) {
    return { ok: false, mensaje: 'Falta completar clientId / tenantId en GRAPH_CONFIG (sharepoint.js).' };
  }
  if (!spCuentaActiva()) {
    return { ok: false, mensaje: 'No hay sesión iniciada — toca "Iniciar sesión con Microsoft" primero.' };
  }
  const resultado = {};
  for (const [clave, listTitle] of Object.entries(GRAPH_CONFIG.listas)) {
    try {
      const campos = await graphFetchListFields(listTitle);
      resultado[clave] = { ok: true, lista: listTitle, columnas: campos };
    } catch (err) {
      resultado[clave] = { ok: false, lista: listTitle, error: err.message };
    }
  }
  return { ok: true, listas: resultado };
}

/* ---------------------------- sincronización ---------------------------- */

function leerCampo(item, mapeo, campo, fallback) {
  const v = item[mapeo[campo]];
  return v !== undefined && v !== null ? v : fallback;
}

async function spSincronizarSucursales() {
  const items = await graphFetchListItems(GRAPH_CONFIG.listas.sucursales);
  const m = MAPEO_CAMPOS.sucursales;
  const nuevas = items
    .map(it => ({
      nombreBsale: leerCampo(it, m, 'nombreBsale', ''),
      nombreVisible: leerCampo(it, m, 'nombreBsale', ''),
      ciudad: leerCampo(it, m, 'ciudad', 'Sin ciudad'),
      tipo: leerCampo(it, m, 'tipo', ''),
      activa: !!leerCampo(it, m, 'activa', true),
      orden: Number(leerCampo(it, m, 'orden', 999)),
    }))
    .filter(s => s.nombreBsale)
    .sort((a, b) => a.orden - b.orden);
  if (nuevas.length) {
    SUCURSALES.length = 0;
    nuevas.forEach(s => SUCURSALES.push(s));
  }
  SP_STATUS.sucursales = new Date();
  return nuevas.length;
}

async function spSincronizarDotacion() {
  const items = await graphFetchListItems(GRAPH_CONFIG.listas.dotacion);
  const m = MAPEO_CAMPOS.dotacion;
  DOTACION_VIGENTE.length = 0;
  items.forEach(it => {
    if (!leerCampo(it, m, 'activo', true)) return;
    DOTACION_VIGENTE.push({ nombre: leerCampo(it, m, 'nombre', ''), sucursal: leerCampo(it, m, 'sucursal', '') });
  });
  SP_STATUS.dotacion = new Date();
  return DOTACION_VIGENTE.length;
}

async function spSincronizarIndicadores() {
  const items = await graphFetchListItems(GRAPH_CONFIG.listas.indicadores);
  const m = MAPEO_CAMPOS.indicadores;
  let actualizados = 0;
  items.forEach(it => {
    const key = leerCampo(it, m, 'key', null);
    const ind = key && INDICADORES.find(i => i.key === key);
    if (!ind) return;
    ind.activo = !!leerCampo(it, m, 'activo', ind.activo);
    ind.orden = Number(leerCampo(it, m, 'orden', ind.orden));
    const corto = leerCampo(it, m, 'corto', null);
    if (corto) ind.corto = corto;
    actualizados++;
  });
  SP_STATUS.indicadores = new Date();
  return actualizados;
}

async function spSincronizarMetas() {
  const items = await graphFetchListItems(GRAPH_CONFIG.listas.metas);
  const m = MAPEO_CAMPOS.metas;
  let actualizados = 0;
  items.forEach(it => {
    const key = leerCampo(it, m, 'key', null);
    if (!key) return;
    METAS[key] = {
      meta: Number(leerCampo(it, m, 'meta', 0)) || 0,
      cuotaDia: Number(leerCampo(it, m, 'cuotaDia', 0)) || 0,
    };
    actualizados++;
  });
  saveMetas();
  SP_STATUS.metas = new Date();
  return actualizados;
}

async function spSincronizarArchivoVentas() {
  if (!GRAPH_CONFIG.archivoVentasPath) return 0;
  const { buf, modified } = await graphFetchFileBytes(GRAPH_CONFIG.archivoVentasPath);
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  ROWS = parseArchivoPlano(wb);
  fileName = 'SharePoint: ' + GRAPH_CONFIG.archivoVentasPath.split('/').pop();
  SP_STATUS.archivo = modified ? new Date(modified) : new Date();
  return ROWS.length;
}

async function spSincronizarTodo(onProgress) {
  const pasos = [
    ['Sucursales', spSincronizarSucursales],
    ['Dotación', spSincronizarDotacion],
    ['Indicadores', spSincronizarIndicadores],
    ['Metas', spSincronizarMetas],
    ['Archivo de ventas', spSincronizarArchivoVentas],
  ];
  const resultados = [];
  for (const [nombre, fn] of pasos) {
    try {
      const n = await fn();
      resultados.push({ nombre, ok: true, detalle: `${n} registro(s)` });
    } catch (err) {
      resultados.push({ nombre, ok: false, detalle: err.message });
    }
    if (onProgress) onProgress(resultados.slice());
  }
  return resultados;
}
