/* =========================================================================
   CATÁLOGO MAESTRO DE SUCURSALES
   -------------------------------------------------------------------------
   El ORDEN de este arreglo es el orden fijo en que se muestran las
   sucursales en todo el panel (tabla de Resumen y pestañas por ciudad).
   No se ordenan alfabéticamente ni por venta — siempre en este orden.

   Si una sucursal no aparece en el archivo cargado (no tuvo ventas al
   momento del reporte), igual se muestra en la tabla con todos los
   indicadores en cero — nunca se oculta una fila.

   nombreBsale   -> texto EXACTO como viene en la columna "Sucursal" del
                    archivo de Bsale (tildes incluidas). Es la llave que
                    conecta el catálogo con los datos.
   nombreVisible -> como se muestra en el panel.
   ciudad        -> agrupa sucursales en la misma pestaña (se muestran
                    apiladas verticalmente, una debajo de otra).
   tipo          -> "Centro" | "Mall" (libre, solo informativo).
   activa        -> true/false. Dar de baja una sucursal = false, nunca
                    se borra la fila (se conserva el historial).
   ========================================================================= */

const SUCURSALES = [
  { nombreBsale: 'Curicó Camilo Henríquez', nombreVisible: 'Curicó Camilo Henríquez', ciudad: 'Curicó',      tipo: 'Centro', activa: true },
  { nombreBsale: 'Mall Center Curicó',      nombreVisible: 'Mall Center Curicó',      ciudad: 'Curicó',      tipo: 'Mall',   activa: true },
  { nombreBsale: 'Talca Mall',              nombreVisible: 'Talca Mall',              ciudad: 'Talca',       tipo: 'Mall',   activa: true },
  { nombreBsale: 'Talca Centro',            nombreVisible: 'Talca Centro',            ciudad: 'Talca',       tipo: 'Centro', activa: true },
  { nombreBsale: 'Linares Independencia',   nombreVisible: 'Linares Independencia',   ciudad: 'Linares',     tipo: 'Centro', activa: true },
  { nombreBsale: 'Chillán El Roble',        nombreVisible: 'Chillán El Roble',        ciudad: 'Chillán',     tipo: 'Centro', activa: true },
  { nombreBsale: 'Mall Arauco Chillán',     nombreVisible: 'Mall Arauco Chillán',     ciudad: 'Chillán',     tipo: 'Mall',   activa: true },
  { nombreBsale: 'Los Ángeles Lautaro',     nombreVisible: 'Los Ángeles Lautaro',     ciudad: 'Los Ángeles', tipo: 'Centro', activa: true },
  { nombreBsale: 'Mall Plaza Los Ángeles',  nombreVisible: 'Mall Plaza Los Ángeles',  ciudad: 'Los Ángeles', tipo: 'Mall',   activa: true },
];

// Etiqueta de la fila de total general (no es una sucursal real del catálogo,
// es la suma de todas las activas). Se muestra siempre al final de la tabla
// de Resumen General.
const TOTAL_LABEL = 'COMERCIAL EXPRESS';

/* =========================================================================
   DOTACIÓN VIGENTE
   -------------------------------------------------------------------------
   Lista de vendedores activos por sucursal. Vacía por defecto — se llena
   al sincronizar con la lista "Dotación Vigente" de SharePoint (ver
   sharepoint.js). Mientras esté vacía, las tablas de vendedores muestran
   solo a quienes tienen ventas en el archivo cargado (comportamiento
   actual). Una vez sincronizada, se usa para mostrar TAMBIÉN a los
   vendedores activos sin ventas registradas (fila en cero), igual que ya
   se hace con las sucursales.
   Forma de cada registro: { nombre: 'JUAN PÉREZ', sucursal: 'Talca Mall' }
   (el campo "sucursal" debe calzar con nombreBsale del catálogo SUCURSALES)
   ========================================================================= */
const DOTACION_VIGENTE = [];
