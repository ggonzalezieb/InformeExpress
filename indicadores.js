/* =========================================================================
   CATÁLOGO MAESTRO DE INDICADORES
   -------------------------------------------------------------------------
   key = el KEY_INTERNO oficial de la empresa (INDICADOR_KEY). El ORDEN de
   este arreglo (campo "orden") es el orden fijo de columnas en el panel.

   CÓMO AGREGAR UN INDICADOR NUEVO: copia un bloque, define su key oficial,
   condiciones y orden, activo:true.
   CÓMO QUITARLO del panel sin perder la definición: activo:false.

   OPERADORES EN "condiciones": eq (default) | in | contains
   INDICADOR DERIVADO (modo:"derivada"): se calcula numerador/denominador
   sobre otros indicadores ya agregados.
   neto:true en un indicador modo:"monto" -> se calcula neto (÷1.19,
   el monto de Bsale viene con IVA incluido). Omitirlo deja el bruto.
   corto: etiqueta abreviada para el encabezado de columna de ancho fijo
   en las matrices (el nombre completo se usa en tooltips y en la
   pestaña Estructura de Datos).

   CAMPOS DE CADA FILA DE VENTA: fecha, vendedor, cliente, producto,
   cantidad, segmento, sucursal, plataforma, monto, tipo
   ========================================================================= */

const INDICADORES = [
  {
    key: 'MOVIL_PERSONA', label: 'Móvil Persona', corto: 'Móvil Pers.', categoria: 'Móvil', unidad: 'int', modo: 'cantidad',
    condiciones: [{ campo: 'tipo', valor: 'MOVIL' }, { campo: 'segmento', valor: 'PERSONA' }],
    activo: true, orden: 10,
  },
  {
    key: 'FIBRA_SOLICITUD', label: 'Fibra Solicitud', corto: 'Fibra Sol.', categoria: 'Fibra', unidad: 'int', modo: 'cantidad',
    condiciones: [{ campo: 'tipo', valor: 'HOGAR FIBRA' }],
    activo: true, orden: 20,
  },
  {
    key: 'VOZ_PORTADO', label: 'Voz Portado', corto: 'Voz Port.', categoria: 'Móvil', unidad: 'int', modo: 'cantidad',
    condiciones: [
      { campo: 'tipo', valor: 'MOVIL' }, { campo: 'segmento', valor: 'PERSONA' },
      { campo: 'producto', valor: 'VOZ PORTADO' },
    ],
    activo: true, orden: 30,
  },
  {
    key: 'VOZ_SS', label: 'Voz SS', corto: 'Voz SS', categoria: 'Móvil', unidad: 'int', modo: 'cantidad',
    condiciones: [
      { campo: 'tipo', valor: 'MOVIL' }, { campo: 'segmento', valor: 'PERSONA' },
      { campo: 'producto', operador: 'in', valor: ['VOZ NUEVO', 'VOZ PORTADO', 'VOZ SEG LINEA'] },
    ],
    activo: true, orden: 40,
  },
  {
    key: 'PCT_MIX_PORTA', label: '% Mix Porta', corto: '%Mix Porta', categoria: 'Móvil', unidad: 'pct', modo: 'derivada',
    formula: { numerador: 'VOZ_PORTADO', denominador: 'MOVIL_PERSONA' },
    activo: true, orden: 50,
  },
  {
    // SUPUESTO a confirmar: % de ventas "voz" (nuevo+portado+seg línea)
    // sobre el total móvil persona. Si la definición real es otra, se
    // ajusta solo esta fórmula.
    key: 'PCT_MIX_VOZ', label: '% Mix Voz', corto: '%Mix Voz', categoria: 'Móvil', unidad: 'pct', modo: 'derivada',
    formula: { numerador: 'VOZ_SS', denominador: 'MOVIL_PERSONA' },
    activo: true, orden: 60,
  },
  {
    key: 'MONTO_TOTAL_EQUIPOS', label: 'Monto Total Equipos', corto: '$ Equipos', categoria: 'Equipo', unidad: 'money', modo: 'monto',
    condiciones: [{ campo: 'tipo', valor: 'EQUIPO' }],
    neto: true, activo: true, orden: 70,
  },
  {
    key: 'MONTO_TOTAL_ACCESORIOS', label: 'Monto Total Accesorios', corto: '$ Accesorios', categoria: 'Accesorio', unidad: 'money', modo: 'monto',
    condiciones: [{ campo: 'tipo', valor: 'ACCESORIO' }],
    neto: true, activo: true, orden: 80,
  },
  {
    key: 'MOVIL_EMPRESA', label: 'Móvil Empresa', corto: 'Móvil Emp.', categoria: 'Móvil', unidad: 'int', modo: 'cantidad',
    condiciones: [{ campo: 'tipo', valor: 'MOVIL' }, { campo: 'segmento', valor: 'EMPRESA' }],
    activo: true, orden: 90,
  },
  {
    key: 'FIJO_EMPRESA_INGRESO', label: 'Fijo Empresa Ingreso', corto: 'Fijo Emp.', categoria: 'Fibra', unidad: 'int', modo: 'cantidad',
    condiciones: [{ campo: 'tipo', valor: 'HOGAR EMPRESA' }],
    activo: true, orden: 100,
  },

  /* -------------------------------------------------------------------
     Indicadores fuera del set oficial actual. Quedan definidos y
     desactivados — no se pierden, solo no se muestran como columna.
     ------------------------------------------------------------------- */
  {
    key: 'Q_EQUIPO', label: 'Q Equipo', categoria: 'Equipo', unidad: 'int', modo: 'cantidad',
    condiciones: [{ campo: 'tipo', valor: 'EQUIPO' }],
    activo: false, orden: 200,
  },
  {
    key: 'HIDROGEL', label: 'Láminas Hidrogel', categoria: 'Accesorio', unidad: 'int', modo: 'cantidad',
    condiciones: [{ campo: 'tipo', valor: 'ACCESORIO' }, { campo: 'producto', operador: 'contains', valor: 'HIDROGEL' }],
    activo: false, orden: 210,
  },
  {
    key: 'SEGUROS', label: 'Seguros', categoria: 'Seguro', unidad: 'int', modo: 'cantidad',
    condiciones: [{ campo: 'tipo', valor: 'SEGURO' }],
    activo: false, orden: 220,
  },
  {
    key: 'PICK_UP', label: 'Venta Pick Up', categoria: 'Otros', unidad: 'int', modo: 'cantidad',
    condiciones: [{ campo: 'tipo', valor: 'PICK UP' }],
    activo: false, orden: 230,
  },
  {
    key: 'DELIVERY', label: 'Venta Delivery', categoria: 'Otros', unidad: 'int', modo: 'cantidad',
    condiciones: [{ campo: 'tipo', valor: 'DELIVERY' }],
    activo: false, orden: 240,
  },
  {
    key: 'VENTA_SIM', label: 'Venta / Cambio Sim', categoria: 'Otros', unidad: 'int', modo: 'cantidad',
    condiciones: [{ campo: 'tipo', valor: 'VENTA SIM' }],
    activo: false, orden: 250,
  },
  {
    key: 'POSTVENTA', label: 'Postventa', categoria: 'Otros', unidad: 'int', modo: 'cantidad',
    condiciones: [{ campo: 'tipo', valor: 'POSTVENTA' }],
    activo: false, orden: 260,
  },
];
