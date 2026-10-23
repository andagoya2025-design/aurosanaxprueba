/* =====================================================
   AUROSANAX ERP - MÓDULO ATENCIONES 
   Archivo: atenciones.js
   Versión: 2.4 contexto maestro enriquecido no invasivo + resumen premium + paginación segura
   Mejora quirúrgica: PERF 2.5.2 reutiliza snapshot remoto ya confirmado al iniciar atención.
   Objetivo:
   - Agregar historial de atenciones dentro de Historia Clínica.
   - Permitir iniciar y finalizar atención por paciente.
   - No modifica Agenda, Pacientes, Antecedentes, Plan ni Recetas.
   - Conecta Examen Físico por id_atencion sin cambiar la vista del historial.
   - Guarda localmente y sincroniza con Google Sheets mediante Apps Script.
===================================================== */

(function(){
  'use strict';

  const MODULO = 'AUROSANAX_ATENCIONES_V2_0_MOBILE_CARDS';
  const STORAGE_KEY = 'aurosanax_atenciones_local_v1';

  let atencionActivaId = '';
  /*
    AUROSANAX 2.5.1 - generación de contexto.
    Cada transición clínica real incrementa este valor para invalidar
    callbacks diferidos de una atención anterior.
  */
  let contextoAtencionEpoch = 0;
  let consultasVisible = true;

  /*
    AUROSANAX BLINDAJE TRANSACCIONAL DE INTERFAZ:
    - Evita doble ejecución accidental de Iniciar / Finalizar.
    - Solo vive en memoria; no persiste ni modifica datos clínicos.
    - El backend y la confirmación autoritativa siguen siendo los dueños del estado real.
  */
  let creandoAtencion = false;
  let finalizandoAtencion = false;

  let atencionesSheetsCargadas = false;
  let atencionesSheetsCargando = false;
  let atencionesSheetsPromesa = null;

  /*
    AUROSANAX ATENCIONES — TRANSACCIONES LOCALES PENDIENTES
    Solo protege una atención recién creada mientras se confirma su existencia
    en Google Sheets. Una lectura remota exitosa sigue siendo la autoridad.
  */
  const atencionesPendientesPersistencia = new Set();

  let recetasSheetsCargadas = false;
  let recetasSheetsCargando = false;
  let consultasPaginaActual = 1;
  const CONSULTAS_POR_PAGINA = 10;
  const RECETAS_STORAGE_KEY = 'aurosanax_recetas_emitidas_v1';

  /* Catálogo único de médicos: se consulta desde Configuración mediante Apps Script. */
  let medicosActivosAtenciones = [];
  let medicosActivosCargados = false;
  let medicosActivosCargando = null;

  function $(id){ return document.getElementById(id); }

  function auroEmitirEstadoProcesoAtencion(nombre, detalle){
    try{
      window.dispatchEvent(new CustomEvent(nombre, {
        detail:Object.assign({
          id_paciente:String(idPacienteActivo ? idPacienteActivo() : '').trim(),
          id_atencion:String(atencionActivaId || '').trim()
        }, detalle || {})
      }));
    }catch(error){
      console.warn(MODULO, 'No se pudo emitir estado de proceso de atención.', error);
    }
  }

  function auroActualizarBotonesProcesoAtencion(){
    const btnIniciar = $('btnIniciarAtencion');
    const btnFinalizar = $('btnFinalizarAtencion');

    if(btnIniciar && creandoAtencion){
      btnIniciar.disabled = true;
      btnIniciar.style.opacity = '0.72';
      btnIniciar.style.cursor = 'wait';
      btnIniciar.innerHTML =
        '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> Iniciando…';
    }

    if(btnFinalizar && finalizandoAtencion){
      btnFinalizar.disabled = true;
      btnFinalizar.style.opacity = '0.72';
      btnFinalizar.style.cursor = 'wait';
      btnFinalizar.innerHTML =
        '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> Finalizando…';
    }
  }

  function inyectarEstilosAtenciones(){
    if(document.getElementById('auroAtencionesResponsiveCSS')) return;

    const st = document.createElement('style');
    st.id = 'auroAtencionesResponsiveCSS';
    st.textContent = `
      #auroAtencionesBox .auro-atenciones-actions{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        justify-content:flex-end;
      }

      #auroAtencionesBox .auro-atencion-status{
        border-radius:14px;
        padding:10px 12px;
        margin-top:10px;
        font-size:14px;
      }

      #auroAtencionesBox .auro-atencion-status.abierta{
        background:#dcfce7;
        color:#166534;
        border:1px solid #bbf7d0;
      }

      #auroAtencionesBox .auro-atencion-status.cerrada{
        background:#f1f5f9;
        color:#334155;
        border:1px solid #e2e8f0;
      }

      #auroAtencionesBox .auro-table-mobile-note{
        display:none;
      }

      #auroAtencionesBox .auro-atenciones-mobile{
        display:none;
      }

      #auroAtencionesBox .auro-consulta-card{
        border:1px solid #e5e7eb;
        border-radius:14px;
        padding:12px;
        background:#fff;
        margin-bottom:10px;
      }

      #auroAtencionesBox .auro-consulta-card-head{
        display:flex;
        justify-content:space-between;
        gap:8px;
        align-items:flex-start;
        margin-bottom:8px;
      }


      #auroAtencionesBox .auro-recetas-atencion-mobile{
        display:none;
      }

      #auroAtencionesBox .auro-receta-atencion-mobile-card{
        border:1px solid #e5e7eb;
        border-radius:16px;
        padding:12px;
        margin:10px 0;
        background:#fff;
        box-shadow:0 4px 14px rgba(15,23,42,.06);
      }

      #auroAtencionesBox .auro-receta-atencion-mobile-head{
        display:flex;
        justify-content:space-between;
        gap:8px;
        align-items:flex-start;
        margin-bottom:8px;
      }


      #auroAtencionesBox .auro-atencion-premium-head{
        border:1px solid #fbcfe8;
        background:linear-gradient(135deg,#fff7fb,#ffffff);
        border-radius:18px;
        padding:14px;
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:flex-start;
        box-shadow:0 6px 18px rgba(139,30,90,.06);
      }

      #auroAtencionesBox .auro-atencion-premium-title{
        display:flex;
        gap:10px;
        align-items:flex-start;
      }

      #auroAtencionesBox .auro-atencion-premium-icon{
        width:42px;
        height:42px;
        border-radius:15px;
        display:grid;
        place-items:center;
        background:#fdf2f8;
        color:#8b1e5a;
        border:1px solid #fbcfe8;
        font-weight:900;
        flex:0 0 auto;
      }

      #auroAtencionesBox .auro-atencion-premium-title b{
        font-size:17px;
        color:#111827;
      }

      #auroAtencionesBox .auro-atencion-id{
        color:#6b7280;
        font-size:12px;
        word-break:break-all;
      }

      #auroAtencionesBox .auro-atencion-info-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
        margin-top:10px;
      }

      #auroAtencionesBox .auro-atencion-info-card{
        border:1px solid #e5e7eb;
        border-radius:14px;
        padding:9px 10px;
        background:#fff;
        min-width:0;
        min-height:72px;
        display:flex;
        flex-direction:column;
        justify-content:center;
      }

      #auroAtencionesBox .auro-atencion-info-card span{
        display:block;
        color:#6b7280;
        font-size:11px;
        text-transform:uppercase;
        letter-spacing:.04em;
        font-weight:800;
        margin-bottom:3px;
      }

      #auroAtencionesBox .auro-atencion-info-card b{
        display:block;
        color:#111827;
        font-size:13px;
        word-break:break-word;
      }

      #auroAtencionesBox .auro-receta-resumen-box{
        display:grid;
        gap:5px;
        white-space:normal;
        min-width:220px;
      }

      #auroAtencionesBox .auro-receta-med-principal{
        font-weight:900;
        color:#111827;
        line-height:1.25;
        margin-bottom:1px;
      }

      #auroAtencionesBox .auro-receta-med-esquema{
        color:#475569;
        font-size:12px;
        line-height:1.25;
      }

      #auroAtencionesBox .auro-receta-med-extra{
        display:inline-block;
        width:max-content;
        max-width:100%;
        margin-top:2px;
        border-radius:999px;
        padding:3px 8px;
        background:#fdf2f8;
        color:#8b1e5a;
        border:1px solid #fbcfe8;
        font-size:11px;
        font-weight:900;
      }

      #auroAtencionesBox .auro-recetas-atencion-box{
        border:1px solid #e5e7eb;
        border-radius:18px;
        padding:12px;
        background:#fff;
        box-shadow:0 6px 18px rgba(15,23,42,.04);
      }

      #auroAtencionesBox .auro-recetas-atencion-title{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        flex-wrap:wrap;
        margin-bottom:10px;
      }

      #auroAtencionesBox .auro-recetas-atencion-title b{
        color:#111827;
      }

      #auroAtencionesBox .auro-receta-indicacion-resumen{
        color:#475569;
        font-size:12px;
        line-height:1.3;
        max-width:260px;
        white-space:normal;
        display:-webkit-box;
        -webkit-line-clamp:2;
        -webkit-box-orient:vertical;
        overflow:hidden;
      }

      #auroAtencionesBox .auro-consultas-paginacion{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        flex-wrap:wrap;
        margin-top:10px;
        padding:10px 0 0;
      }

      #auroAtencionesBox .auro-consultas-paginacion .small{
        font-weight:800;
      }


      #auroAtencionesBox .auro-atencion-medico-box{
        display:grid;
        gap:4px;
        line-height:1.22;
        min-width:0;
      }

      #auroAtencionesBox .auro-atencion-medico-nombre{
        display:block;
        color:#111827;
        font-size:13px;
        font-weight:900;
        word-break:break-word;
      }

      #auroAtencionesBox .auro-atencion-medico-id-row{
        display:flex;
        align-items:center;
        gap:6px;
        flex-wrap:wrap;
      }

      #auroAtencionesBox .auro-atencion-medico-id-label{
        display:inline-flex;
        align-items:center;
        border:1px solid #f3d4e8;
        background:#fdf2f8;
        color:#7a174f;
        border-radius:999px;
        padding:2px 7px;
        font-size:9.5px;
        font-weight:900;
        letter-spacing:.04em;
        text-transform:uppercase;
      }

      #auroAtencionesBox .auro-atencion-medico-id{
        display:inline-block;
        font-size:11px;
        font-weight:750;
        color:#475569;
        word-break:break-word;
      }

      .auro-medico-modal{
        position:fixed;
        inset:0;
        z-index:99999;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:18px;
        background:rgba(15,23,42,.58);
      }

      .auro-medico-modal-panel{
        width:min(520px,100%);
        background:#fff;
        border:1px solid #fbcfe8;
        border-radius:22px;
        padding:20px;
        box-shadow:0 28px 80px rgba(15,23,42,.28);
      }

      .auro-medico-modal-panel h5{
        margin:0 0 6px;
        font-weight:900;
      }

      .auro-medico-modal-panel p{
        margin:0 0 14px;
        color:#64748b;
        font-size:14px;
      }

      .auro-medico-modal-actions{
        display:flex;
        justify-content:flex-end;
        gap:8px;
        margin-top:14px;
      }


      /* V2 premium: estilos limitados a las dos tablas; sin cambiar eventos ni datos. */
      #auroAtencionesBox .auro-recetas-atencion-desktop .table-responsive,
      #auroAtencionesBox .auro-atenciones-desktop .table-responsive{overflow-x:hidden;max-width:100%;}
      #auroAtencionesBox .auro-premium-recetas-tabla,
      #auroAtencionesBox .auro-premium-historial-tabla{width:100%;min-width:0!important;max-width:100%;table-layout:fixed;border-collapse:collapse;}
      #auroAtencionesBox .auro-premium-recetas-tabla th,
      #auroAtencionesBox .auro-premium-recetas-tabla td,
      #auroAtencionesBox .auro-premium-historial-tabla th,
      #auroAtencionesBox .auro-premium-historial-tabla td{box-sizing:border-box;min-width:0!important;overflow-wrap:anywhere;word-break:normal;vertical-align:middle;padding:9px 5px;font-size:clamp(10px,.85vw,13px);}
      #auroAtencionesBox .auro-premium-recetas-tabla th,
      #auroAtencionesBox .auro-premium-historial-tabla th{font-weight:800;text-align:center;line-height:1.25;}
      #auroAtencionesBox .auro-premium-recetas-tabla th:nth-child(1){width:13%;}
      #auroAtencionesBox .auro-premium-recetas-tabla th:nth-child(2){width:20%;}
      #auroAtencionesBox .auro-premium-recetas-tabla th:nth-child(3){width:12%;}
      #auroAtencionesBox .auro-premium-recetas-tabla th:nth-child(4){width:29%;}
      #auroAtencionesBox .auro-premium-recetas-tabla th:nth-child(5){width:11%;}
      #auroAtencionesBox .auro-premium-recetas-tabla th:nth-child(6){width:15%;}
      #auroAtencionesBox .auro-premium-historial-tabla th:nth-child(1){width:5%;}
      #auroAtencionesBox .auro-premium-historial-tabla th:nth-child(2){width:18%;}
      #auroAtencionesBox .auro-premium-historial-tabla th:nth-child(3){width:12%;}
      #auroAtencionesBox .auro-premium-historial-tabla th:nth-child(4){width:8%;}
      #auroAtencionesBox .auro-premium-historial-tabla th:nth-child(5){width:12%;}
      #auroAtencionesBox .auro-premium-historial-tabla th:nth-child(6){width:19%;}
      #auroAtencionesBox .auro-premium-historial-tabla th:nth-child(7){width:11%;}
      #auroAtencionesBox .auro-premium-historial-tabla th:nth-child(8){width:15%;}
      #auroAtencionesBox .auro-premium-recetas-tabla td:nth-last-child(-n+2),
      #auroAtencionesBox .auro-premium-historial-tabla td:nth-last-child(-n+2){text-align:center;}
      #auroAtencionesBox .auro-premium-recetas-tabla .btn-action,
      #auroAtencionesBox .auro-premium-historial-tabla .btn-action{width:100%;max-width:100%;white-space:normal;overflow-wrap:anywhere;font-size:clamp(10px,.8vw,12px);padding:6px 3px;}
      #auroAtencionesBox .auro-premium-recetas-tabla .auro-receta-resumen-box{min-width:0;max-width:100%;}
      #auroAtencionesBox .auro-premium-historial-tabla .auro-premium-acciones>div{min-width:0;}
      @media (min-width:769px) and (max-width:1050px){
        #auroAtencionesBox .auro-premium-recetas-tabla th,
        #auroAtencionesBox .auro-premium-recetas-tabla td,
        #auroAtencionesBox .auro-premium-historial-tabla th,
        #auroAtencionesBox .auro-premium-historial-tabla td{font-size:10px;padding:7px 3px;}
      }

      @media (max-width: 768px){
        #auroAtencionesBox{
          padding:12px!important;
        }

        #auroAtencionesBox .auro-atenciones-header{
          flex-direction:column!important;
          align-items:stretch!important;
        }

        #auroAtencionesBox .auro-atenciones-title h5{
          font-size:16px!important;
          margin-bottom:2px!important;
        }

        #auroAtencionesBox .auro-atenciones-title h5 .desktop-title{
          display:none!important;
        }


        #auroAtencionesBox .auro-recetas-atencion-desktop{
          display:block!important;
        }
        #auroAtencionesBox .auro-recetas-atencion-mobile{
          display:none!important;
        }

        #auroAtencionesBox .auro-atenciones-title h5 .mobile-title{
          display:inline!important;
        }

        #auroAtencionesBox .auro-atenciones-actions{
          display:grid!important;
          grid-template-columns:1fr 1fr;
          gap:6px;
          width:100%;
        }

        #auroAtencionesBox .auro-atenciones-actions button{
          width:100%!important;
          font-size:12px!important;
          padding:7px 8px!important;
          white-space:normal!important;
          min-height:38px;
        }

        #auroAtencionesBox #btnFinalizarAtencion{
          grid-column: span 2;
        }

        #auroAtencionesBox .auro-atencion-status{
          font-size:12px!important;
          padding:8px 10px!important;
          line-height:1.35;
        }

        #auroAtencionesBox .auro-atenciones-desktop{
          display:none!important;
        }

        #auroAtencionesBox .auro-atenciones-mobile{
          display:block!important;
        }

        #auroAtencionesBox .auro-consulta-card{
          font-size:12px;
        }

        #auroAtencionesBox .auro-consulta-card .btn-action{
          width:100%;
          margin-top:6px;
        }

        #auroAtencionesBox .auro-table-mobile-note{
          display:none!important;
        }


        #auroAtencionesBox .auro-recetas-atencion-desktop{
          display:none!important;
        }

        #auroAtencionesBox .auro-recetas-atencion-mobile{
          display:block!important;
        }

        #auroAtencionesBox .auro-receta-atencion-mobile-card{
          font-size:12px!important;
        }

        #auroAtencionesBox .auro-receta-atencion-mobile-card .small{
          line-height:1.35;
          word-break:break-word;
        }

        #auroAtencionesBox #auroAtencionActivaBox .row > div{
          font-size:12px;
        }

        #auroAtencionesBox #auroAtencionActivaBox table{
          min-width:650px;
          font-size:12px;
        }

        #auroAtencionesBox .auro-atencion-premium-head{
          padding:12px!important;
          border-radius:16px!important;
          display:grid!important;
          grid-template-columns:1fr!important;
        }

        #auroAtencionesBox .auro-atencion-info-grid{
          grid-template-columns:1fr!important;
          gap:7px!important;
        }

        #auroAtencionesBox .auro-atencion-info-card{
          padding:8px 9px!important;
          min-height:auto!important;
        }

        #auroAtencionesBox .auro-recetas-atencion-box{
          padding:10px!important;
          border-radius:16px!important;
        }

        #auroAtencionesBox .auro-receta-resumen-box{
          min-width:0!important;
          width:100%!important;
        }

        #auroAtencionesBox .auro-consultas-paginacion{
          display:grid!important;
          grid-template-columns:1fr!important;
        }

        #auroAtencionesBox .auro-consultas-paginacion button{
          width:100%!important;
          margin:0!important;
        }

      }

      @media (min-width: 769px){
        #auroAtencionesBox .auro-atenciones-title h5 .mobile-title{
          display:none!important;
        }
        #auroAtencionesBox .auro-atenciones-desktop{
          display:block!important;
        }
        #auroAtencionesBox .auro-atenciones-mobile{
          display:none!important;
        }
      }
    `;
    document.head.appendChild(st);
  }


  function safe(v){
    return String(v || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function fechaHoyISO(){
    if(typeof window.fechaHoyISO === 'function'){
      try{ return window.fechaHoyISO(); }catch(e){}
    }
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function horaActual(){
    const d = new Date();
    return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0');
  }

  function fechaHora(){
    const d = new Date();
    return d.toLocaleString('es-EC', {
      year:'numeric',
      month:'2-digit',
      day:'2-digit',
      hour:'2-digit',
      minute:'2-digit',
      hour12:false
    });
  }

  function fechaVisual(fecha){
    if(!fecha) return '—';
    const s = String(fecha);
    if(/^\d{4}-\d{2}-\d{2}/.test(s)){
      const p = s.slice(0,10).split('-');
      return p[2] + '/' + p[1] + '/' + p[0];
    }
    return s;
  }

  function horaVisualAtencion(hora){
    if(!hora) return '—';
    const s = String(hora);
    if(s.includes('T')){
      const horaCompleta = s.slice(11,19);
      return horaCompleta || '—';
    }
    if(/^\d{1,2}:\d{2}/.test(s)){
      return /^\d{1,2}:\d{2}:\d{2}/.test(s) ? s.slice(0,8) : s.slice(0,5);
    }
    return s;
  }

  function fechaHoraVisualAtencion(valor){
    if(!valor) return '—';

    if(Object.prototype.toString.call(valor) === '[object Date]' && !isNaN(valor)){
      return new Intl.DateTimeFormat('es-EC', {
        timeZone:'America/Guayaquil',
        year:'numeric',
        month:'2-digit',
        day:'2-digit',
        hour:'2-digit',
        minute:'2-digit',
        hourCycle:'h23'
      }).format(valor);
    }

    const s = String(valor).trim();
    if(!s) return '—';

    /*
      Corrección quirúrgica:
      Google Apps Script serializa las fechas reales de Sheets como ISO UTC.
      Solo esos valores con zona horaria se convierten a America/Guayaquil.
      Los textos ya formateados por el ERP se conservan sin reinterpretarlos.
    */
    const esISOConZona =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(s);

    if(esISOConZona){
      const d = new Date(s);
      if(!isNaN(d)){
        return new Intl.DateTimeFormat('es-EC', {
          timeZone:'America/Guayaquil',
          year:'numeric',
          month:'2-digit',
          day:'2-digit',
          hour:'2-digit',
          minute:'2-digit',
          hourCycle:'h23'
        }).format(d);
      }
    }

    return s;
  }

  function leerLocal(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(e){
      console.warn(MODULO, 'No se pudo leer localStorage.', e);
      return [];
    }
  }

  function guardarLocal(arr){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(arr) ? arr : []));
    }catch(e){
      console.warn(MODULO, 'No se pudo guardar localStorage.', e);
    }
  }

  function mezclarAtencionesLocalesYSheets(remotas){
    const remotasNormalizadas = (Array.isArray(remotas) ? remotas : [])
      .map(normalizar)
      .filter(function(a){
        return !!String(a.id_atencion || '').trim();
      });

    const mapa = new Map();

    /*
      AUROSANAX BLINDAJE DE AUTORIDAD REMOTA:
      - Una lectura GET exitosa de Google Sheets gobierna existencia y estado.
      - localStorage es caché, no autoridad.
      - Solo se conserva temporalmente una atención local cuyo id_atencion
        está marcado como creación pendiente de confirmación.
      - Si una atención fue borrada en Sheets y no está pendiente, desaparece
        del caché en el siguiente refresco remoto exitoso.
    */
    remotasNormalizadas.forEach(function(a){
      mapa.set(String(a.id_atencion), a);
    });

    leerLocal().map(normalizar).forEach(function(local){
      const id = String(local.id_atencion || '').trim();
      if(!id || !atencionesPendientesPersistencia.has(id)) return;

      if(!mapa.has(id)){
        mapa.set(id, local);
      }
    });

    const sincronizadas = Array.from(mapa.values()).sort((a,b) => {
      const na = Number(a.numero_consulta || 0);
      const nb = Number(b.numero_consulta || 0);
      if(na !== nb) return nb - na;
      return String(b.fecha_atencion + ' ' + b.hora_atencion)
        .localeCompare(String(a.fecha_atencion + ' ' + a.hora_atencion));
    });

    guardarLocal(sincronizadas);
    return sincronizadas;
  }

  function cargarAtencionesDesdeSheets(forzar){
    if(atencionesSheetsPromesa){
      return atencionesSheetsPromesa;
    }

    if(atencionesSheetsCargadas && !forzar){
      return Promise.resolve(leerLocal());
    }

    if(typeof API_URL === 'undefined' || !API_URL){
      return Promise.resolve(leerLocal());
    }

    atencionesSheetsCargando = true;

    atencionesSheetsPromesa = (async function(){
      try{
        const res = await fetch(
          API_URL + '?accion=listarAtenciones&_=' + Date.now(),
          { method:'GET', cache:'no-store' }
        );

        if(!res.ok){
          throw new Error('Error HTTP ' + res.status);
        }

        const data = await res.json();
        // Solo una lista remota válida puede reemplazar la caché local.
        // Script 65 devuelve un arreglo; se admite {success:true,data:[...]}.
        if(data && !Array.isArray(data) && data.success === false){
          throw new Error(data.message || 'Script 65 devolvió un error al listar atenciones');
        }
        const remotas = Array.isArray(data)
          ? data
          : (data && data.success === true && Array.isArray(data.data) ? data.data : null);
        if(!remotas || remotas.some(a => !a || typeof a !== 'object' || Array.isArray(a))){
          throw new Error('Formato inesperado de listarAtenciones; se conserva la caché local');
        }
        if(remotas.some(a => !String(a.id_atencion || '').trim())){
          throw new Error('La respuesta de listarAtenciones no contiene identificadores válidos');
        }

        const sincronizadas = mezclarAtencionesLocalesYSheets(remotas);
        atencionesSheetsCargadas = true;
        return sincronizadas;

      }catch(error){
        console.warn(
          MODULO,
          'No se pudieron cargar atenciones desde Google Sheets.',
          error
        );
        return leerLocal();

      }finally{
        atencionesSheetsCargando = false;
        atencionesSheetsPromesa = null;
      }
    })();

    return atencionesSheetsPromesa;
  }

  async function obtenerAtencionRemotaPorId(idAtencion){
    try{
      const id = String(idAtencion || '').trim();
      if(!id){
        return {
          success:false,
          atencion:null,
          message:'No se recibió un id_atencion válido para consultar.'
        };
      }

      if(typeof API_URL === 'undefined' || !API_URL){
        return {
          success:false,
          atencion:null,
          message:'API_URL no está definida en index.html'
        };
      }

      const res = await fetch(
        API_URL + '?accion=listarAtenciones&_=' + Date.now(),
        { method:'GET', cache:'no-store' }
      );

      if(!res.ok){
        return {
          success:false,
          atencion:null,
          message:'Error HTTP ' + res.status
        };
      }

      const data = await res.json();
      if(data && !Array.isArray(data) && data.success === false){
        throw new Error(data.message || 'Script 65 devolvió un error al consultar la atención');
      }
      const remotas = Array.isArray(data)
        ? data
        : (data && data.success === true && Array.isArray(data.data) ? data.data : null);
      if(!remotas){
        throw new Error('Formato inesperado de listarAtenciones');
      }

      const atencion = remotas
        .map(normalizar)
        .find(function(item){
          return String(item.id_atencion || '').trim() === id;
        }) || null;

      return {
        success:!!atencion,
        atencion:atencion,
        message:atencion
          ? 'Atención localizada en Google Sheets.'
          : 'La atención no apareció en Google Sheets.'
      };
    }catch(error){
      console.warn(MODULO, 'No se pudo consultar la atención remota.', error);
      return {
        success:false,
        atencion:null,
        message:error.message || String(error)
      };
    }
  }

  /*
    AUROSANAX FIX ANTIRREGRESIVO - CONFIRMACIÓN REMOTA DE ESTADO:
    Verifica una atención directamente contra Google Sheets sin mezclar
    la respuesta con localStorage. Se usa para no confirmar una finalización
    basándose en el estado local del navegador.
  */
  async function verificarEstadoAtencionRemoto(idAtencion, estadoEsperado){
    try{
      const id = String(idAtencion || '').trim();
      const esperado = String(estadoEsperado || '').trim();

      if(!id){
        return { success:false, message:'No se recibió un id_atencion válido para verificar.' };
      }

      if(typeof API_URL === 'undefined' || !API_URL){
        return { success:false, message:'API_URL no está definida en index.html' };
      }

      const res = await fetch(
        API_URL + '?accion=listarAtenciones&_=' + Date.now(),
        { method:'GET', cache:'no-store' }
      );
      const data = await res.json();
      const remotas = Array.isArray(data)
        ? data
        : (Array.isArray(data?.data) ? data.data : []);

      const atencionRemota = remotas
        .map(normalizar)
        .find(function(item){
          return String(item.id_atencion || '').trim() === id;
        });

      if(!atencionRemota){
        return {
          success:false,
          message:'La atención no apareció en la lectura remota de Google Sheets.'
        };
      }

      const estadoRemoto = String(atencionRemota.estado_atencion || '').trim();
      const coincide = estadoRemoto.toLowerCase() === esperado.toLowerCase();

      return {
        success:coincide,
        estado_remoto:estadoRemoto,
        atencion:atencionRemota,
        /*
          AUROSANAX PERF 2.5.2 — SNAPSHOT AUTORITATIVO REUTILIZABLE:
          Esta misma lectura GET ya contiene la lista remota completa usada para
          confirmar el estado. Se devuelve únicamente para que el flujo llamador
          pueda reconstruir el caché sin repetir inmediatamente otro listarAtenciones.
          No convierte caché/localStorage en autoridad y no sobrevive a otra operación.
        */
        atenciones_remotas:remotas,
        message: coincide
          ? 'Estado confirmado en Google Sheets.'
          : 'Google Sheets devolvió un estado distinto al esperado.'
      };

    }catch(error){
      console.warn(MODULO, 'No se pudo confirmar el estado remoto de la atención.', error);
      return { success:false, message:error.message };
    }
  }

  async function enviarAtencionGoogleSheets(atencion, accion){
    try{
      if(!atencion) return { success:false, message:'No hay atención para enviar' };
      if(typeof API_URL === 'undefined' || !API_URL){
        return { success:false, message:'API_URL no está definida en index.html' };
      }

      const accionAtencion = accion === 'editarAtencion'
        ? 'editarAtencion'
        : 'guardarAtencion';

      const idPacienteEnvio = String(
        atencion.id_paciente || idPacienteActivo() || ''
      ).trim();

      const idHistoriaRegistrada = String(atencion.id_historia || '').trim();

      if(
        idHistoriaRegistrada &&
        idPacienteEnvio &&
        auroEstadoPertenenciaHistoria(idHistoriaRegistrada, idPacienteEnvio) === false
      ){
        return {
          success:false,
          message:
            'Se bloqueó el envío: id_historia no corresponde al id_paciente de la atención.'
        };
      }

      /*
        AUROSANAX BLINDAJE id_cita:
        En una edición/finalización, una copia local antigua con id_cita vacío
        no puede borrar un vínculo de cita ya persistido. id_cita sigue siendo
        opcional: si nunca existió, permanece vacío.
      */
      let idCitaEnvio = String(atencion.id_cita || '').trim();

      if(accionAtencion === 'editarAtencion' && !idCitaEnvio){
        const lecturaRemota = await obtenerAtencionRemotaPorId(atencion.id_atencion);
        const idCitaRemota = String(
          lecturaRemota?.atencion?.id_cita || ''
        ).trim();

        if(idCitaRemota){
          idCitaEnvio = idCitaRemota;
        }
      }

      const payload = {
        accion: accionAtencion,
        data: {
          id_atencion: atencion.id_atencion || '',
          numero_consulta: Number(atencion.numero_consulta || siguienteConsulta(atencion.id_paciente || idPacienteActivo()) || 1),
          id_paciente: atencion.id_paciente || '',
          id_cita: idCitaEnvio,
          id_historia: atencion.id_historia || obtenerIdHistoriaActual(atencion.id_paciente) || '',
          id_medico: atencion.id_medico || '',
          fecha_atencion: accionAtencion === 'guardarAtencion' ? (atencion.fecha_atencion || fechaHoyISO()) : (atencion.fecha_atencion ?? ''),
          hora_atencion: accionAtencion === 'guardarAtencion' ? (atencion.hora_atencion || horaActual()) : (atencion.hora_atencion ?? ''),
          tipo_atencion: atencion.tipo_atencion || '',
          estado_atencion: atencion.estado_atencion || 'Abierta',
          creado_por: atencion.creado_por || usuarioActual(),
          creado_en: atencion.creado_en || fechaHora(),
          actualizado_en: atencion.actualizado_en || fechaHora()
        }
      };

      /* En edición/finalización, fecha y hora originales son inmutables.
         La fila maestra en Sheets conserva sus celdas y formatos nativos. */
      if(accionAtencion === 'editarAtencion'){
        delete payload.data.fecha_atencion;
        delete payload.data.hora_atencion;
      }

      const res = await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      return {
        success:true,
        message: accionAtencion === 'editarAtencion'
          ? 'Atención actualizada en Google Sheets'
          : 'Atención guardada en Google Sheets'
      };

    }catch(error){
      console.error(MODULO, 'Error enviando atención a Google Sheets:', error);
      return { success:false, message:error.message };
    }
  }

  function pacienteActivo(){
    try{
      if(typeof window.getPacienteActivo === 'function') return window.getPacienteActivo();
    }catch(e){}
    return null;
  }

  /*
    AUROSANAX MENSAJE QUIRÚRGICO:
    Resuelve únicamente el nombre descriptivo de un paciente ya cargado.
    No modifica selección, IDs, contexto clínico, localStorage ni backend.
  */
  function nombrePacientePorIdAtenciones(idPaciente){
    const id = String(idPaciente || '').trim();
    if(!id) return 'Paciente no identificado';

    try{
      const activo = pacienteActivo();
      if(
        activo &&
        String(activo.id_paciente || activo.id || '').trim() === id
      ){
        const nombreActivo = String(
          activo.nombre_completo ||
          activo.nombre ||
          ((activo.nombres || '') + ' ' + (activo.apellidos || ''))
        ).replace(/\s+/g,' ').trim();

        if(nombreActivo) return nombreActivo;
      }

      /*
        pacientes.js mantiene el catálogo oficial en "patients".
        Se consulta solo en lectura y por coincidencia exacta de id_paciente.
      */
      if(typeof patients !== 'undefined' && Array.isArray(patients)){
        const encontrado = patients.find(function(p){
          return String(p.id_paciente || p.id || '').trim() === id;
        }) || null;

        if(encontrado){
          const nombre = String(
            encontrado.nombre_completo ||
            encontrado.nombre ||
            ((encontrado.nombres || '') + ' ' + (encontrado.apellidos || ''))
          ).replace(/\s+/g,' ').trim();

          if(nombre) return nombre;
        }
      }
    }catch(error){
      console.warn(
        MODULO,
        'No se pudo resolver el nombre del paciente para el aviso de atención abierta.',
        error
      );
    }

    return id;
  }

  function idPacienteActivo(){
    try{
      /*
        AUROSANAX FIX QUIRÚRGICO:
        Dentro de Historia Clínica, el selector visible es la fuente principal.
        Si existe y está vacío, no se reutiliza un paciente residual conservado
        en variables globales de una navegación anterior.
      */
      const sel = $('hcPacienteSelect');
      if(sel){
        const idSeleccionado = String(sel.value || '').trim();
        if(!idSeleccionado) return '';
        return idSeleccionado;
      }

      /*
        Compatibilidad:
        Si el selector de Historia Clínica no existe en la pantalla actual,
        se conservan exactamente las fuentes globales anteriores.
      */
      const p = pacienteActivo();

      if(p && (p.id_paciente || p.id || p.cedula)){
        return String(p.id_paciente || p.id || p.cedula);
      }

      if(window.activePatientId) return String(window.activePatientId);

      if(window.historiaActual &&
         (window.historiaActual.id_paciente || window.historiaActual.paciente_id)){
        return String(window.historiaActual.id_paciente || window.historiaActual.paciente_id);
      }

      if(window.currentHistoria &&
         (window.currentHistoria.id_paciente || window.currentHistoria.paciente_id)){
        return String(window.currentHistoria.id_paciente || window.currentHistoria.paciente_id);
      }

    }catch(e){
      console.warn(MODULO,'Error obteniendo paciente activo',e);
    }

    return '';
  }

  function medicoActual(){
    /*
      No existe médico predeterminado.
      El médico debe venir de Agenda o seleccionarse manualmente.
    */
    return '';
  }

  function nombreCompletoMedico(m){
    m = m || {};
    return String(
      m.nombre_completo ||
      ((m.nombres || m.nombre || '') + ' ' + (m.apellidos || ''))
    ).replace(/\s+/g,' ').trim();
  }

  function idMedicoRegistro(m){
    return String((m || {}).id_medico || (m || {}).id || (m || {}).codigo || '').trim();
  }

  async function cargarMedicosActivosAtenciones(forzar){
    if(medicosActivosCargados && !forzar) return medicosActivosAtenciones;
    if(medicosActivosCargando) return medicosActivosCargando;

    medicosActivosCargando = (async function(){
      try{
        if(typeof API_URL === 'undefined' || !API_URL){
          throw new Error('API_URL no está definida.');
        }

        const res = await fetch(
          API_URL + '?accion=listarMedicosActivos&_=' + Date.now()
        );

        if(!res.ok) throw new Error('Error HTTP ' + res.status);

        const data = await res.json();
        const lista = Array.isArray(data)
          ? data
          : (Array.isArray(data?.data) ? data.data : []);

        medicosActivosAtenciones = lista.filter(function(m){
          const id = idMedicoRegistro(m);
          const estado = normalizarTextoSimple(m.estado || 'Activo');
          return id && (!estado || estado === 'activo');
        });

        medicosActivosCargados = true;
        return medicosActivosAtenciones;
      }catch(error){
        medicosActivosAtenciones = [];
        medicosActivosCargados = false;
        console.warn(MODULO, 'No se pudieron cargar médicos activos.', error);
        return [];
      }finally{
        medicosActivosCargando = null;
      }
    })();

    return medicosActivosCargando;
  }

  function leerCitaSeleccionadaAgenda(){
    try{
      if(window.auroCitaSeleccionadaAgenda &&
         typeof window.auroCitaSeleccionadaAgenda === 'object'){
        return window.auroCitaSeleccionadaAgenda;
      }

      const raw = sessionStorage.getItem('auro_cita_seleccionada_agenda');
      if(raw){
        const cita = JSON.parse(raw);
        if(cita && typeof cita === 'object') return cita;
      }
    }catch(error){
      console.warn(MODULO, 'No se pudo leer la cita seleccionada desde Agenda.', error);
    }

    return null;
  }

  function citaAgendaCorrespondePaciente(cita, idPaciente){
    if(!cita) return false;

    const citaPaciente = String(cita.id_paciente || cita.paciente_id || '').trim();
    if(!citaPaciente) return true;

    return citaPaciente === String(idPaciente || '').trim();
  }

  function limpiarCitaSeleccionadaAgenda(){
    try{
      window.auroCitaSeleccionadaAgenda = null;
      sessionStorage.removeItem('auro_cita_seleccionada_agenda');
    }catch(error){
      console.warn(MODULO, 'No se pudo limpiar la cita seleccionada.', error);
    }
  }

  function seleccionarMedicoManual(lista){
    return new Promise(function(resolve){
      const anteriores = document.querySelectorAll('.auro-medico-modal');
      anteriores.forEach(function(x){ x.remove(); });

      const modal = document.createElement('div');
      modal.className = 'auro-medico-modal';

      const opciones = (Array.isArray(lista) ? lista : []).map(function(m){
        const id = idMedicoRegistro(m);
        const nombre = nombreCompletoMedico(m) || id;
        const especialidad = String(m.especialidad_principal || m.especialidad || '').trim();
        return '<option value="' + safe(id) + '">' +
          safe(nombre + (especialidad ? ' · ' + especialidad : '')) +
        '</option>';
      }).join('');

      modal.innerHTML =
        '<div class="auro-medico-modal-panel" role="dialog" aria-modal="true" aria-labelledby="auroMedicoModalTitulo">' +
          '<h5 id="auroMedicoModalTitulo">Seleccione el médico</h5>' +
          '<p>Esta atención se está iniciando manualmente. Elija el profesional responsable.</p>' +
          '<select id="auroMedicoManualSelect" class="form-select">' +
            '<option value="">Seleccione...</option>' +
            opciones +
          '</select>' +
          '<div class="auro-medico-modal-actions">' +
            '<button type="button" class="btn-line" id="auroCancelarMedico">Cancelar</button>' +
            '<button type="button" class="btn-auro" id="auroAceptarMedico">Continuar</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(modal);

      const cerrar = function(valor){
        modal.remove();
        resolve(valor || null);
      };

      modal.querySelector('#auroCancelarMedico').addEventListener('click', function(){
        cerrar(null);
      });

      modal.querySelector('#auroAceptarMedico').addEventListener('click', function(){
        const id = String(modal.querySelector('#auroMedicoManualSelect').value || '').trim();
        if(!id){
          alert('Seleccione un médico para continuar.');
          return;
        }

        const medico = lista.find(function(m){
          return idMedicoRegistro(m) === id;
        }) || null;

        cerrar(medico);
      });

      modal.addEventListener('click', function(e){
        if(e.target === modal) cerrar(null);
      });
    });
  }

  function usuarioActual(){
    return 'AUROSANAX ERP';
  }

  function idNuevo(){
    const d = new Date();
    const stamp =
      d.getFullYear() +
      String(d.getMonth()+1).padStart(2,'0') +
      String(d.getDate()).padStart(2,'0') +
      String(d.getHours()).padStart(2,'0') +
      String(d.getMinutes()).padStart(2,'0') +
      String(d.getSeconds()).padStart(2,'0');
    return 'ATN-' + stamp + '-' + Math.floor(Math.random()*900+100);
  }

  function normalizar(a){
    return {
      id_atencion: a.id_atencion || idNuevo(),
      numero_consulta: Number(a.numero_consulta || 0),
      id_paciente: a.id_paciente || '',
      id_cita: a.id_cita || '',
      id_historia: a.id_historia || '',
      id_medico: a.id_medico || '',
      fecha_atencion: a.fecha_atencion ?? '',
      hora_atencion: a.hora_atencion ?? '',
      tipo_atencion: a.tipo_atencion || '',
      estado_atencion: a.estado_atencion || 'Abierta',
      creado_por: a.creado_por || usuarioActual(),
      creado_en: a.creado_en || fechaHora(),
      actualizado_en: a.actualizado_en || fechaHora()
    };
  }

  function atencionesPaciente(idPaciente){
    /*
      AUROSANAX FIX:
      Se usa exclusivamente el paciente solicitado.
      No se agregan IDs de otro paciente conservado en memoria.
    */
    const id = String(idPaciente || idPacienteActivo() || '').trim();

    if(!id) return [];

    return leerLocal()
      .map(normalizar)
      .filter(a => String(a.id_paciente || '').trim() === id)
      .sort((a,b) => {
        const na = Number(a.numero_consulta || 0);
        const nb = Number(b.numero_consulta || 0);
        if(na !== nb) return nb - na;
        return String(b.fecha_atencion + ' ' + b.hora_atencion)
          .localeCompare(String(a.fecha_atencion + ' ' + a.hora_atencion));
      });
  }

  function atencionAbierta(idPaciente){
    return atencionesPaciente(idPaciente).find(a => String(a.estado_atencion).toLowerCase() === 'abierta') || null;
  }

  function atencionesAbiertasPaciente(idPaciente){
    return atencionesPaciente(idPaciente).filter(function(a){
      return String(a.estado_atencion || '').toLowerCase() === 'abierta';
    });
  }

  function atencionesAbiertasMedico(idMedico){
    const id = String(idMedico || '').trim();
    if(!id) return [];

    return leerLocal()
      .map(normalizar)
      .filter(function(a){
        return String(a.id_medico || '').trim() === id &&
          String(a.estado_atencion || '').toLowerCase() === 'abierta';
      });
  }

  function atencionAbiertaActiva(idPaciente){
    const id = String(idPaciente || idPacienteActivo() || '').trim();
    if(!id || !atencionActivaId) return null;

    const a = leerLocal().map(normalizar).find(function(item){
      return String(item.id_atencion || '') === String(atencionActivaId || '') &&
        String(item.id_paciente || '').trim() === id &&
        String(item.estado_atencion || '').toLowerCase() === 'abierta';
    });

    return a || null;
  }

  /*
    AUROSANAX BLINDAJE ANTIRREGRESIVO — FINALIZAR POR CONTEXTO EXACTO:
    El botón real Finalizar solo se habilita cuando la atención actualmente
    seleccionada (atencionActivaId) pertenece al paciente visible y está Abierta.
    La existencia de otra atención abierta del mismo paciente NO habilita este botón.
  */
  function auroActualizarBotonFinalizarPorContexto(idPaciente){
    const btnFinalizar = $('btnFinalizarAtencion');
    if(!btnFinalizar) return;

    const id = String(idPaciente || idPacienteActivo() || '').trim();
    const abiertaSeleccionada = id ? atencionAbiertaActiva(id) : null;
    const disponible = !!abiertaSeleccionada;

    if(finalizandoAtencion){
      btnFinalizar.disabled = true;
      btnFinalizar.style.opacity = '0.72';
      btnFinalizar.style.cursor = 'wait';
      btnFinalizar.innerHTML =
        '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> Finalizando…';
      return;
    }

    btnFinalizar.disabled = !disponible;
    btnFinalizar.style.opacity = disponible ? '1' : '0.55';
    btnFinalizar.style.cursor = disponible ? 'pointer' : 'not-allowed';
    btnFinalizar.innerHTML = disponible
      ? '<i class="bi bi-check-circle me-1"></i> Finalizar'
      : '<i class="bi bi-lock me-1"></i> Cerrada ✓';
  }

  function siguienteConsulta(idPaciente){
    return atencionesPaciente(idPaciente).reduce((m,a) => Math.max(m, Number(a.numero_consulta || 0)), 0) + 1;
  }


  function auroIdPacienteHistoria(historia){
    return String(
      historia?.id_paciente ||
      historia?.paciente_id ||
      ''
    ).trim();
  }

  function auroIdHistoriaRegistro(historia){
    return String(
      historia?.id_historia ||
      historia?.id ||
      ''
    ).trim();
  }

  function auroEstadoPertenenciaHistoria(idHistoria, idPaciente){
    idHistoria = String(idHistoria || '').trim();
    idPaciente = String(idPaciente || '').trim();

    if(!idHistoria || !idPaciente) return null;

    const candidatasDirectas = [
      window.historiaActual,
      window.currentHistoria
    ].filter(function(h){
      return h && typeof h === 'object' &&
        auroIdHistoriaRegistro(h) === idHistoria;
    });

    if(candidatasDirectas.length){
      const candidatasConPaciente = candidatasDirectas.filter(function(h){
        return !!auroIdPacienteHistoria(h);
      });

      if(candidatasConPaciente.length){
        return candidatasConPaciente.some(function(h){
          return auroIdPacienteHistoria(h) === idPaciente;
        });
      }
    }

    try{
      if(typeof window.auroHistoriasPacienteOrdenadas === 'function'){
        const historiasPaciente = window.auroHistoriasPacienteOrdenadas(idPaciente);
        if(Array.isArray(historiasPaciente)){
          const existe = historiasPaciente.some(function(h){
            return auroIdHistoriaRegistro(h) === idHistoria;
          });
          if(existe) return true;

          /*
            Si la fuente oficial del paciente está disponible y la historia no
            aparece allí, existe evidencia suficiente para rechazarla.
          */
          if(historiasPaciente.length) return false;
        }
      }
    }catch(error){
      console.warn(MODULO, 'No se pudo validar la historia contra el paciente.', error);
    }

    try{
      if(typeof window.auroHistoriaActualEdicion === 'function'){
        const h = window.auroHistoriaActualEdicion();
        if(h && auroIdHistoriaRegistro(h) === idHistoria){
          return auroIdPacienteHistoria(h) === idPaciente;
        }
      }
    }catch(error){
      console.warn(MODULO, 'No se pudo validar la historia en edición.', error);
    }

    return null;
  }

  function obtenerIdHistoriaActual(idPacienteEsperado){
    try{
      /*
        AUROSANAX BLINDAJE DE CONTEXTO:
        Una historia residual solo puede heredarse al crear/guardar una atención
        si puede demostrarse que pertenece al paciente esperado.
        Ante duda se devuelve vacío; nunca se reutiliza una historia de otro paciente.
      */
      const idPaciente = String(
        idPacienteEsperado || idPacienteActivo() || ''
      ).trim();

      if(!idPaciente) return '';

      const candidatos = [];

      if(window.auroHistoriaSeleccionadaId){
        candidatos.push(String(window.auroHistoriaSeleccionadaId).trim());
      }

      if(window.editingHistoryId){
        candidatos.push(String(window.editingHistoryId).trim());
      }

      if(window.historiaActual){
        candidatos.push(auroIdHistoriaRegistro(window.historiaActual));
      }

      if(window.currentHistoria){
        candidatos.push(auroIdHistoriaRegistro(window.currentHistoria));
      }

      for(const idHistoria of candidatos.filter(Boolean)){
        if(auroEstadoPertenenciaHistoria(idHistoria, idPaciente) === true){
          return idHistoria;
        }
      }
    }catch(e){
      console.warn(MODULO, 'No se pudo obtener id_historia actual.', e);
    }

    return '';
  }

  function normalizarTextoSimple(valor){
    return String(valor || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function obtenerDocumentoPacienteActivo(){
    const p = pacienteActivo();
    return p ? String(p.numero_documento || p.cedula || p.documento || '').replace(/\D/g,'') : '';
  }

  function buscarCitaAtendidaHoy(idPaciente){
    try{
      const citas = Array.isArray(window.citasAgendaWeb) ? window.citasAgendaWeb : [];
      const hoy = fechaHoyISO();
      const p = pacienteActivo();
      const docPaciente = obtenerDocumentoPacienteActivo();
      const nombrePaciente = normalizarTextoSimple(p ? (p.nombre || ((p.nombres || '') + ' ' + (p.apellidos || ''))) : '');

      return citas.find(c => {
        const estado = normalizarTextoSimple(c.estado || c.estado_cita || '');
        const fecha = String(c.fecha_deseada || c.fecha_cita || c.fecha || '').slice(0,10);

        const cid = String(c.id_paciente || c.paciente_id || '').trim();
        const cdoc = String(c.numero_documento || c.cedula || c.documento || '').replace(/\D/g,'');
        const cnombre = normalizarTextoSimple(c.nombre || c.paciente || c.nombre_completo || '');

        const coincidePaciente =
          (cid && String(cid) === String(idPaciente)) ||
          (docPaciente && cdoc && docPaciente === cdoc) ||
          (nombrePaciente && cnombre && nombrePaciente === cnombre);

        return coincidePaciente &&
               fecha === hoy &&
               estado.includes('atendid');
      }) || null;
    }catch(e){
      console.warn(MODULO, 'No se pudo buscar cita atendida de hoy.', e);
      return null;
    }
  }


  /*
    AUROSANAX V30 — BLINDAJE ANTIRREGRESIVO DE CONTEXTO
    ---------------------------------------------------
    Devuelve la atención que gobierna actualmente el contexto visual.
    No activa, no finaliza y no modifica persistencia.
  */
  function auroAtencionActivaRegistro(){
    const id = String(atencionActivaId || '').trim();
    if(!id) return null;

    return leerLocal()
      .map(normalizar)
      .find(function(item){
        return String(item.id_atencion || '').trim() === id;
      }) || null;
  }

  /*
    Limpieza VISUAL selectiva de módulos dependientes de una atención.

    IMPORTANTE:
    - No toca Antecedentes porque pertenecen a Historia Clínica y no a una
      consulta individual.
    - No borra localStorage, Google Sheets ni registros persistidos.
    - Se utiliza únicamente cuando existe una transición clínica REAL:
      atención A -> B, atención -> finalizada/sin atención, cambio real de
      paciente o historia nueva.
  */
  function auroLimpiarCamposContextoAtencion(){
    [
      'hc_anamnesis',
      'hc_examen',
      'hc_gineco',
      'hc_obstetricia',
      'hc_estetica',
      'hc_diagnostico',
      'hc_plan',
      'hc_docs'
    ].forEach(function(panelId){
      const panel = document.getElementById(panelId);
      if(!panel) return;

      panel.querySelectorAll('input, textarea, select').forEach(function(el){
        if(el.type === 'checkbox' || el.type === 'radio'){
          el.checked = false;
          return;
        }

        if(el.tagName === 'SELECT'){
          el.selectedIndex = 0;
          return;
        }

        if(!el.readOnly && !el.disabled){
          el.value = '';
        }
      });

      panel.querySelectorAll('[contenteditable="true"]').forEach(function(el){
        el.innerHTML = '';
      });
    });

    /*
      Se ocultan únicamente cajas de datos previos dependientes del contexto
      de consulta. No se elimina ningún dato persistido.
    */
    [
      'auroExamenFisicoPrevioBox',
      'auroDiagnosticosPreviosBox'
    ].forEach(function(id){
      const box = document.getElementById(id);
      if(box){
        box.style.display = 'none';
        const contenido = box.querySelector(
          '.auro-previos-content, .auro-previos-body, [data-previos-content]'
        );
        if(contenido) contenido.innerHTML = '';
      }
    });
  }


  function auroInvalidarContextoAtencion(opciones){
    opciones = opciones || {};

    const idAnterior = String(
      opciones.idAnterior != null ? opciones.idAnterior : atencionActivaId
    ).trim();

    const idNueva = String(opciones.idNueva || '').trim();
    const idPaciente = String(
      opciones.idPaciente != null ? opciones.idPaciente : idPacienteActivo()
    ).trim();

    contextoAtencionEpoch += 1;
    atencionActivaId = '';

    window.planState = window.planState || { atencionActual:'', cache:{} };
    window.planState.atencionActual = '';

    if(window.examenFisicoState){
      window.examenFisicoState.atencionActual = '';
      window.examenFisicoState.idExamenActual = '';
    }

    if(window.auroDiagnosticosState){
      window.auroDiagnosticosState.atencionActual = '';
      window.auroDiagnosticosState.detalleExamen = null;
      window.auroDiagnosticosState.diagnosticos = [];
      window.auroDiagnosticosState.resumenClinico = '';
      window.auroDiagnosticosState.analisisClinico = '';
      window.auroDiagnosticosState.conducta = '';
    }

    if(opciones.limpiarVisual !== false){
      [
        'auroLimpiarPlanVisualAntesDeCambiarAtencion',
        'auroLimpiarDiagnosticos',
        'auroExamenFisicoLimpiarFormulario',
        'auroHistoriaLimpiarAnamnesisSinAtencionSeleccionada',
        'limpiarFormularioGinecologia',
        'limpiarFormularioObstetricia',
        'limpiarFormularioEstetica',
        'limpiarFormularioDocumentos'
      ].forEach(function(nombre){
        try{
          if(typeof window[nombre] === 'function') window[nombre]();
        }catch(error){
          console.warn('AUROSANAX ATENCIONES: no se pudo ejecutar ' + nombre, error);
        }
      });

      try{
        if(typeof window.cambiarPlanPorAtencion === 'function'){
          window.cambiarPlanPorAtencion('');
        }
      }catch(error){
        console.warn('AUROSANAX ATENCIONES: no se pudo limpiar Plan.', error);
      }

      try{
        if(typeof window.cambiarExamenFisicoPorAtencion === 'function'){
          window.cambiarExamenFisicoPorAtencion('');
        }
      }catch(error){
        console.warn('AUROSANAX ATENCIONES: no se pudo limpiar Examen Físico.', error);
      }

      /*
        Fallback visual antirregresivo:
        si algún módulo no expone limpiador público o todavía no terminó de
        inicializarse, se eliminan únicamente los campos VISUALES dependientes
        de la atención. Antecedentes queda expresamente fuera.
      */
      auroLimpiarCamposContextoAtencion();
    }

    window.dispatchEvent(new CustomEvent('aurosanax:atencion-limpiada', {
      detail:{
        id_paciente:idPaciente,
        id_atencion_anterior:idAnterior,
        id_atencion_nueva:idNueva,
        motivo:String(opciones.motivo || 'cambio_atencion'),
        contexto_epoch:contextoAtencionEpoch
      }
    }));

    return {
      idAnterior,
      idNueva,
      idPaciente,
      epoch:contextoAtencionEpoch
    };
  }

  /* =====================================================
     AUROSANAX - MOTOR ÚNICO DE ACTIVACIÓN DE ATENCIÓN
     Corrección quirúrgica v2.5

     OBJETIVO:
     - Evitar que Plan, Recetas, Diagnóstico o Examen Físico conserven
       visualmente la consulta anterior al crear o abrir una atención.
     - Reutilizar el mismo flujo tanto para "Iniciar" como para "Ver".
     - No elimina datos, no cambia IDs, no modifica Google Sheets.
  ===================================================== */
  function sincronizarContextoAtencion(atencion, opciones){
    opciones = opciones || {};

    const a = normalizar(atencion || {});
    const idAtencion = String(a.id_atencion || '').trim();
    const idPaciente = String(a.id_paciente || '').trim();
    const idPacienteVisible = String(idPacienteActivo() || '').trim();
    const idAnterior = String(atencionActivaId || '').trim();

    if(!idAtencion) return false;

    if(
      idPacienteVisible &&
      idPaciente &&
      idPacienteVisible !== idPaciente
    ){
      console.warn(
        'AUROSANAX ATENCIONES: se bloqueó una atención de otro paciente.',
        { idPacienteVisible, idPaciente, idAtencion }
      );
      return false;
    }

    const idHistoria = String(a.id_historia || '').trim();
    if(
      idHistoria &&
      idPaciente &&
      auroEstadoPertenenciaHistoria(idHistoria, idPaciente) === false
    ){
      console.warn(
        'AUROSANAX ATENCIONES: se bloqueó una historia clínica de otro paciente.',
        { idPaciente, idHistoria, idAtencion }
      );
      alert(
        'La atención seleccionada contiene una historia clínica que no corresponde ' +
        'al paciente activo. Se bloqueó la activación para proteger el contexto clínico.'
      );
      return false;
    }

    /*
      2.5.1:
      Volver a pulsar Ver sobre la MISMA consulta no es una transición clínica.
      Se conserva exactamente la funcionalidad visual sin limpiar ni emitir
      eventos que puedan despertar autosaves de otros módulos.
    */
    if(idAnterior && idAnterior === idAtencion){
      renderDetalleAtencion(a);

      try{
        if(typeof window.auroPlanActualizarMiniStatus === 'function'){
          window.auroPlanActualizarMiniStatus();
        }
      }catch(error){
        console.warn('AUROSANAX ATENCIONES: no se pudo refrescar el estado visual del Plan.', error);
      }

      return true;
    }

    /*
      Transición clínica real A -> B:
      una sola invalidación central comunica la id anterior exacta.
    */
    const transicion = auroInvalidarContextoAtencion({
      idAnterior:idAnterior,
      idNueva:idAtencion,
      idPaciente:idPaciente,
      motivo:String(opciones.motivo || 'cambio_atencion'),
      limpiarVisual:true
    });

    const epoch = transicion.epoch;

    /* Activar inmediatamente la atención nueva como fuente maestra. */
    atencionActivaId = idAtencion;

    window.planState = window.planState || { atencionActual:'', cache:{} };
    window.planState.atencionActual = idAtencion;

    if(window.examenFisicoState){
      window.examenFisicoState.atencionActual = idAtencion;
    }

    if(window.auroDiagnosticosState){
      window.auroDiagnosticosState.atencionActual = idAtencion;
    }

    const detalleEvento = {
      ...a,
      contexto_epoch:epoch,
      id_atencion_anterior:idAnterior
    };

    window.dispatchEvent(new CustomEvent('aurosanax:atencion-seleccionada', {
      detail:detalleEvento
    }));

    if(opciones.emitirIniciada){
      window.dispatchEvent(new CustomEvent('aurosanax:atencion-iniciada', {
        detail:detalleEvento
      }));
    }

    /* Render inmediato: Ver, Iniciar y Vista integral conservan su comportamiento. */
    renderDetalleAtencion(a);

    try{
      if(typeof window.auroPlanActualizarMiniStatus === 'function'){
        window.auroPlanActualizarMiniStatus();
      }
    }catch(error){
      console.warn('AUROSANAX ATENCIONES: no se pudo refrescar el estado visual del Plan.', error);
    }

    setTimeout(function(){
      try{
        if(contextoAtencionEpoch !== epoch) return;
        if(String(atencionActivaId || '') !== idAtencion) return;

        if(typeof window.cambiarPlanPorAtencion === 'function'){
          window.cambiarPlanPorAtencion(idAtencion);
        }

        if(typeof window.cambiarExamenFisicoPorAtencion === 'function'){
          window.cambiarExamenFisicoPorAtencion(idAtencion);
        }
      }catch(error){
        console.warn('AUROSANAX ATENCIONES: error al cargar módulos por atención.', error);
      }
    }, 80);

    setTimeout(function(){
      cargarRecetasDesdeSheetsAtenciones(true).then(function(){
        if(contextoAtencionEpoch !== epoch) return;
        if(String(atencionActivaId || '') !== idAtencion) return;

        const actual = leerLocal().find(function(item){
          return String(item.id_atencion || '') === idAtencion;
        }) || a;

        renderDetalleAtencion(normalizar(actual));
      }).catch(function(error){
        console.warn('AUROSANAX ATENCIONES: no se pudieron refrescar recetas.', error);
      });
    }, 140);

    setTimeout(function(){
      try{
        if(contextoAtencionEpoch !== epoch) return;
        if(String(atencionActivaId || '') !== idAtencion) return;

        if(typeof window.auroPlanActualizarMiniStatus === 'function'){
          window.auroPlanActualizarMiniStatus();
        }
      }catch(error){
        console.warn('AUROSANAX ATENCIONES: no se pudo confirmar el estado visual del Plan.', error);
      }
    }, 220);

    return true;
  }

  async function crearAtencionBase(){
    const p = pacienteActivo();
    const idPaciente = idPacienteActivo();

    if(!p || !idPaciente){
      alert('Seleccione primero un paciente desde Pacientes o Historia Clínica.');
      return null;
    }

    /*
      Prioridad obligatoria:
      1. Cita seleccionada expresamente en Agenda.
      2. Inicio manual con selector de médicos activos.
      Ya no se busca una cita atendida cualquiera ni se asigna Aurora por defecto.
    */
    let cita = leerCitaSeleccionadaAgenda();

    if(cita && !citaAgendaCorrespondePaciente(cita, idPaciente)){
      alert(
        'La cita seleccionada en Agenda pertenece a otro paciente. ' +
        'Se bloqueó el inicio para proteger la historia clínica.'
      );
      return null;
    }

    let idMedico = '';
    let fechaAtencion = fechaHoyISO();
    let horaAtencion = horaActual();
    let idCita = '';

    if(cita){
      idMedico = String(cita.id_medico || cita.medico_id || '').trim();
      idCita = String(cita.id_cita || cita.id || cita.id_cita_web || cita.fila_origen || '').trim();
      fechaAtencion = String(
        cita.fecha_deseada || cita.fecha_cita || cita.fecha || fechaHoyISO()
      ).slice(0,10);
      horaAtencion = String(
        cita.hora_deseada || cita.hora_inicio || cita.hora || horaActual()
      ).trim();

      if(!idMedico){
        alert('La cita seleccionada no tiene un id_medico válido. Revise la cita en Agenda.');
        return null;
      }

      const catalogo = await cargarMedicosActivosAtenciones(false);
      if(catalogo.length){
        const existeActivo = catalogo.some(function(m){
          return idMedicoRegistro(m) === idMedico;
        });

        if(!existeActivo){
          alert(
            'El médico asignado a la cita no aparece como activo en Configuración. ' +
            'Active el médico o corrija la cita antes de iniciar.'
          );
          return null;
        }
      }
    }else{
      const catalogo = await cargarMedicosActivosAtenciones(false);

      if(!catalogo.length){
        alert(
          'No se pudieron cargar médicos activos desde Configuración. ' +
          'Revise Apps Script o la conexión.'
        );
        return null;
      }

      const seleccionado = await seleccionarMedicoManual(catalogo);
      if(!seleccionado) return null;

      idMedico = idMedicoRegistro(seleccionado);
    }

    /*
      AUROSANAX BLINDAJE DE SESIÓN:
      Se refresca primero la fuente persistente para no decidir con una copia
      local antigua. Un mismo médico puede conservar varias atenciones abiertas,
      pero solo una queda activa en pantalla.
    */
    await cargarAtencionesDesdeSheets(true);

    /*
      AUROSANAX REGLA CLÍNICA — UNA SOLA ABIERTA POR PACIENTE:
      El ERP puede conservar varias atenciones abiertas de distintos pacientes,
      incluso para el mismo médico. Lo que se bloquea es una segunda atención
      Abierta para el mismo id_paciente.
    */
    const abiertasPaciente = atencionesAbiertasPaciente(idPaciente);

    if(abiertasPaciente.length){
      const abiertaPaciente = abiertasPaciente
        .slice()
        .sort(function(a,b){
          return Number(b.numero_consulta || 0) - Number(a.numero_consulta || 0);
        })[0];

      alert(
        'Este paciente ya tiene una atención abierta' +
        (abiertaPaciente.numero_consulta
          ? ' (consulta #' + abiertaPaciente.numero_consulta + ')'
          : '') +
        '. Continúe o finalice esa atención antes de iniciar una nueva.'
      );

      return null;
    }

    const abiertasMismoMedico = atencionesAbiertasMedico(idMedico);
    if(abiertasMismoMedico.length){
      const activaMismoMedico = abiertasMismoMedico.find(function(a){
        return String(a.id_atencion || '') === String(atencionActivaId || '');
      }) || abiertasMismoMedico[0];

      /*
        AUROSANAX MENSAJE QUIRÚRGICO:
        En este punto las atenciones abiertas del médico pertenecen a otros
        pacientes, porque el mismo paciente ya fue bloqueado arriba.
      */
      const detalleAbiertas = abiertasMismoMedico.map(function(a){
        const idPacienteAbierto = String(a.id_paciente || '').trim();
        const nombrePacienteAbierto = nombrePacientePorIdAtenciones(idPacienteAbierto);
        const numeroConsulta = Number(a.numero_consulta || 0);
        const idAtencionAbierta = String(a.id_atencion || '').trim() || 'Sin ID';

        return '• Paciente: ' + nombrePacienteAbierto +
          '\n  Consulta: ' + (numeroConsulta ? '#' + numeroConsulta : 'Sin número') +
          '\n  ID atención: ' + idAtencionAbierta;
      }).join('\n\n');

      const continuar = confirm(
        'El médico seleccionado ya tiene ' + abiertasMismoMedico.length +
        ' atención' + (abiertasMismoMedico.length === 1 ? '' : 'es') +
        ' abierta' + (abiertasMismoMedico.length === 1 ? '' : 's') + '.\n\n' +
        detalleAbiertas + '\n\n' +
        'Las atenciones abiertas corresponden a otros pacientes.\n' +
        'Aceptar: mantenerlas abiertas e iniciar esta nueva atención.\n' +
        'Cancelar: no crear otra atención; puede usar Ver o Finalizar.'
      );

      if(!continuar) return null;
    }

    const num = siguienteConsulta(idPaciente);

    const nueva = normalizar({
      id_atencion: idNuevo(),
      numero_consulta: num,
      id_paciente: idPaciente,
      id_cita: idCita,
      id_historia: obtenerIdHistoriaActual(idPaciente),
      id_medico: idMedico,
      fecha_atencion: fechaAtencion,
      hora_atencion: horaAtencion,
      tipo_atencion: num === 1 ? 'Primera vez' : 'Control',
      estado_atencion: 'Abierta',
      creado_por: usuarioActual(),
      creado_en: fechaHora(),
      actualizado_en: fechaHora()
    });

    const lista = leerLocal();
    atencionesPendientesPersistencia.add(String(nueva.id_atencion || '').trim());
    lista.unshift(nueva);
    guardarLocal(lista);

    /*
      AUROSANAX FASE 1 - PERSISTENCIA INMEDIATA DE LA ATENCIÓN:
      La fila principal se crea en Google Sheets al pulsar Iniciar atención,
      con estado Abierta y conservando el mismo id_atencion durante todo el flujo.
      De este modo, Examen físico, Diagnóstico, Plan y Receta nunca trabajan
      contra una atención inexistente en la pestaña atenciones.
    */
    const resultadoInicio = await enviarAtencionGoogleSheets(
      nueva,
      'guardarAtencion'
    );

    if(!resultadoInicio || !resultadoInicio.success){
      const listaRollback = leerLocal().filter(function(item){
        return String(item.id_atencion || '') !== String(nueva.id_atencion || '');
      });
      guardarLocal(listaRollback);
      atencionesPendientesPersistencia.delete(String(nueva.id_atencion || '').trim());
      renderAtencionesPaciente();

      alert(
        'No se pudo crear la atención en Google Sheets. ' +
        'No se activó la consulta para evitar registros clínicos huérfanos. ' +
        'Revise Apps Script o la conexión.'
      );
      return null;
    }

    /*
      El POST usa mode:'no-cors', por lo que el navegador no puede interpretar
      el JSON de respuesta del backend. Se confirma por GET la existencia del
      id_atencion exacto antes de activar contexto clínico.
    */
    const confirmacionInicio = await verificarEstadoAtencionRemoto(
      nueva.id_atencion,
      'Abierta'
    );

    if(!confirmacionInicio || !confirmacionInicio.success){
      const listaRollback = leerLocal().filter(function(item){
        return String(item.id_atencion || '') !== String(nueva.id_atencion || '');
      });

      guardarLocal(listaRollback);
      atencionesPendientesPersistencia.delete(String(nueva.id_atencion || '').trim());

      /*
        Reconstrucción autoritativa del caché después de un rechazo/no confirmación.
        Si la API no responde, cargarAtencionesDesdeSheets conserva el fallback local
        sin inventar persistencia.
      */
      await cargarAtencionesDesdeSheets(true);
      renderAtencionesPaciente();

      alert(
        'La nueva atención no fue confirmada en Google Sheets. ' +
        'No se activó la consulta para evitar una atención fantasma o duplicada.'
      );
      return null;
    }

    const nuevaConfirmada = normalizar(Object.assign(
      {},
      nueva,
      confirmacionInicio.atencion || {}
    ));

    atencionesPendientesPersistencia.delete(String(nueva.id_atencion || '').trim());

    /*
      AUROSANAX PERF 2.5.2 — REUTILIZACIÓN QUIRÚRGICA DE LA MISMA LECTURA:
      verificarEstadoAtencionRemoto() acaba de confirmar este id_atencion mediante
      un GET autoritativo de Google Sheets y conserva en atenciones_remotas el mismo
      snapshot completo. Reutilizarlo aquí evita un segundo listarAtenciones inmediato.

      Blindaje antirregresivo:
      - Google Sheets sigue siendo la autoridad.
      - No se introduce TTL ni caché persistente nuevo.
      - No se elimina cache:'no-store'.
      - No se toca contextoAtencionEpoch ni los controles de paciente/atención.
      - Si por compatibilidad no existe el snapshot, se conserva el GET forzado anterior.
    */
    if(Array.isArray(confirmacionInicio.atenciones_remotas)){
      mezclarAtencionesLocalesYSheets(confirmacionInicio.atenciones_remotas);
      atencionesSheetsCargadas = true;
    }else{
      await cargarAtencionesDesdeSheets(true);
    }

    if(cita){
      limpiarCitaSeleccionadaAgenda();
    }

    /*
      La atención recién creada se activa mediante el mismo motor utilizado
      por el botón Ver. Así ningún módulo conserva el contexto anterior.
    */
    sincronizarContextoAtencion(nuevaConfirmada, {
      motivo:'atencion_creada',
      emitirIniciada:true
    });

    renderAtencionesPaciente();
    return nuevaConfirmada;
  }

  async function crearAtencion(){
    if(creandoAtencion) return null;

    creandoAtencion = true;
    auroActualizarBotonesProcesoAtencion();
    auroEmitirEstadoProcesoAtencion('aurosanax:atencion-iniciando');

    try{
      return await crearAtencionBase();
    }finally{
      creandoAtencion = false;
      auroEmitirEstadoProcesoAtencion('aurosanax:atencion-inicio-fin');

      /*
        No se fuerza un render clínico completo.
        Solo se restaura el estado visual de botones con la fuente actual.
      */
      const btnIniciar = $('btnIniciarAtencion');
      if(btnIniciar){
        btnIniciar.disabled = false;
        btnIniciar.style.opacity = '1';
        btnIniciar.style.cursor = 'pointer';
        btnIniciar.innerHTML = '<i class="bi bi-play-circle me-1"></i> Iniciar';
      }

      auroActualizarBotonesProcesoAtencion();
    }
  }

  async function finalizarAtencionBase(){
    const idPaciente = idPacienteActivo();
    if(!idPaciente){
      alert('Seleccione primero un paciente.');
      return;
    }

    const abiertas = atencionesAbiertasPaciente(idPaciente);
    const abierta = atencionAbiertaActiva(idPaciente);

    /*
      BLINDAJE CRÍTICO:
      Nunca se sustituye silenciosamente la atención seleccionada por otra
      atención abierta del mismo paciente. Para finalizar, el id_atencion
      seleccionado debe ser exactamente una atención Abierta.
    */
    if(!abierta){
      if(abiertas.length){
        alert(
          'La consulta seleccionada no es una atención abierta. ' +
          'Pulse Ver en la atención abierta que desea finalizar y vuelva a intentarlo.'
        );
      }else{
        alert('No hay atención abierta para finalizar.');
      }
      return;
    }

    if(!confirm('¿Finalizar la atención actual? Quedará registrada como consulta histórica.')) return;

    const lista = leerLocal();
    const idx = lista.findIndex(a => String(a.id_atencion) === String(abierta.id_atencion));
    const baseFinalizacion = idx >= 0 ? lista[idx] : abierta;

    const atencionFinalizada = Object.assign({}, baseFinalizacion, {
      numero_consulta: Number(baseFinalizacion.numero_consulta || abierta.numero_consulta || siguienteConsulta(idPaciente) || 1),
      estado_atencion: 'Finalizada',
      actualizado_en: fechaHora()
    });

    const idFinalizada = String(atencionFinalizada?.id_atencion || abierta.id_atencion || '').trim();

    /*
      AUROSANAX FIX ANTIRREGRESIVO:
      No se altera localStorage ni se limpia el contexto clínico antes de que
      Google Sheets confirme que ESTE mismo id_atencion quedó Finalizada.
    */
    const resultado = await enviarAtencionGoogleSheets(atencionFinalizada, 'editarAtencion');

    if(!resultado || !resultado.success){
      alert(
        'No se pudo enviar la finalización a Google Sheets. ' +
        'La atención permanece abierta en este equipo para evitar un cierre falso.'
      );
      return;
    }

    const verificacion = await verificarEstadoAtencionRemoto(
      idFinalizada,
      'Finalizada'
    );

    if(!verificacion || !verificacion.success){
      const estadoRemoto = String(verificacion?.estado_remoto || '').trim();
      alert(
        'La finalización no fue confirmada en la base de datos.' +
        (estadoRemoto ? ' Estado remoto actual: ' + estadoRemoto + '.' : '') +
        ' La atención permanece abierta en este equipo.'
      );
      return;
    }

    const atencionConfirmada = Object.assign(
      {},
      baseFinalizacion,
      verificacion.atencion || atencionFinalizada,
      { estado_atencion:'Finalizada' }
    );

    if(idx >= 0){
      lista[idx] = atencionConfirmada;
    }else{
      lista.unshift(atencionConfirmada);
    }
    guardarLocal(lista);

    auroInvalidarContextoAtencion({
      idAnterior:idFinalizada,
      idNueva:'',
      idPaciente:idPaciente,
      motivo:'atencion_finalizada',
      limpiarVisual:true
    });

    renderAtencionesPaciente();

    auroEmitirEstadoProcesoAtencion('aurosanax:atencion-finalizada', {
      id_paciente:idPaciente,
      id_atencion:idFinalizada,
      estado:'Finalizada',
      confirmado:true
    });

    alert('Atención finalizada y confirmada en Google Sheets.');
  }

  async function finalizarAtencion(){
    if(finalizandoAtencion) return;

    finalizandoAtencion = true;
    auroActualizarBotonesProcesoAtencion();
    auroEmitirEstadoProcesoAtencion('aurosanax:atencion-finalizando');

    try{
      await finalizarAtencionBase();
    }finally{
      finalizandoAtencion = false;
      auroEmitirEstadoProcesoAtencion('aurosanax:atencion-finalizacion-fin');

      /*
        Restauración visual sin alterar el estado clínico.
        Si la atención quedó finalizada, renderAtencionesPaciente() ya habrá
        deshabilitado correctamente el botón real.
      */
      renderAtencionesPaciente();
      auroActualizarBotonesProcesoAtencion();
    }
  }


  async function vincularHistoriaAAtencionActual(idHistoria, idPaciente){
    idHistoria = String(idHistoria || '').trim();
    idPaciente = String(idPaciente || idPacienteActivo() || '').trim();

    if(!idHistoria){
      return {
        success:false,
        message:'No se recibió un id_historia válido.'
      };
    }

    if(!idPaciente){
      return {
        success:false,
        message:'No existe un paciente activo para vincular la historia.'
      };
    }

    const estadoHistoria = auroEstadoPertenenciaHistoria(idHistoria, idPaciente);
    if(estadoHistoria === false){
      return {
        success:false,
        message:'La historia clínica recibida pertenece a otro paciente.'
      };
    }

    const lista = leerLocal().map(normalizar);

    /*
      Prioridad:
      1. Atención activa del mismo paciente.
      2. Atención abierta del mismo paciente.
      3. Última atención sin id_historia del mismo paciente.
      Nunca se toma una atención de otro paciente.
    */
    let idx = lista.findIndex(a =>
      atencionActivaId &&
      String(a.id_atencion || '') === String(atencionActivaId) &&
      String(a.id_paciente || '').trim() === idPaciente
    );

    if(idx < 0){
      const abiertasPaciente = lista
        .map((a, index) => ({a, index}))
        .filter(x =>
          String(x.a.id_paciente || '').trim() === idPaciente &&
          String(x.a.estado_atencion || '').toLowerCase() === 'abierta'
        );

      /*
        Con varias atenciones abiertas del mismo paciente no se adivina cuál
        debe recibir la historia. La selección activa debe decidirlo.
      */
      if(abiertasPaciente.length === 1){
        idx = abiertasPaciente[0].index;
      }else if(abiertasPaciente.length > 1){
        return {
          success:false,
          message:
            'Hay varias atenciones abiertas para este paciente. ' +
            'Seleccione primero la atención correcta antes de vincular la historia.'
        };
      }
    }

    if(idx < 0){
      const candidatas = lista
        .map((a, index) => ({a, index}))
        .filter(x =>
          String(x.a.id_paciente || '').trim() === idPaciente &&
          !String(x.a.id_historia || '').trim()
        )
        .sort((x, y) =>
          String(y.a.actualizado_en || y.a.creado_en || y.a.fecha_atencion || '')
            .localeCompare(
              String(x.a.actualizado_en || x.a.creado_en || x.a.fecha_atencion || '')
            )
        );

      if(candidatas.length){
        idx = candidatas[0].index;
      }
    }

    if(idx < 0){
      return {
        success:false,
        message:'No se encontró una atención del paciente pendiente de vincular.'
      };
    }

    const atencion = lista[idx];

    if(String(atencion.id_paciente || '').trim() !== idPaciente){
      return {
        success:false,
        message:'La atención localizada pertenece a otro paciente.'
      };
    }

    /*
      Si ya tiene otra historia, no se reemplaza silenciosamente.
    */
    const historiaAnterior = String(atencion.id_historia || '').trim();

    if(historiaAnterior && historiaAnterior !== idHistoria){
      return {
        success:false,
        message:
          'La atención ya está vinculada a otra historia clínica. ' +
          'Se bloqueó el cambio automático.'
      };
    }

    const actualizada = normalizar(Object.assign({}, atencion, {
      id_historia: idHistoria,
      actualizado_en: fechaHora()
    }));

    lista[idx] = actualizada;
    guardarLocal(lista);

    atencionActivaId = actualizada.id_atencion;

    window.planState = window.planState || {
      atencionActual:'',
      cache:{}
    };
    window.planState.atencionActual = actualizada.id_atencion;

    if(window.examenFisicoState){
      window.examenFisicoState.atencionActual = actualizada.id_atencion;
    }

    const resultado = await enviarAtencionGoogleSheets(actualizada, 'editarAtencion');

    renderAtencionesPaciente();

    return {
      success: !!(resultado && resultado.success),
      message: resultado?.message || 'Atención vinculada con la historia clínica.',
      id_atencion: actualizada.id_atencion,
      id_historia: idHistoria,
      id_paciente: idPaciente
    };
  }

  function leerRecetasLocales(){
    try{
      const raw = localStorage.getItem(RECETAS_STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(e){
      console.warn(MODULO, 'No se pudo leer recetas locales.', e);
      return [];
    }
  }

  function guardarRecetasLocales(arr){
    try{
      localStorage.setItem(RECETAS_STORAGE_KEY, JSON.stringify(Array.isArray(arr) ? arr : []));
    }catch(e){
      console.warn(MODULO, 'No se pudo guardar recetas locales.', e);
    }
  }

  function normalizarRecetaAtencion(r){
    r = r || {};

    /*
      AUROSANAX FIX QUIRÚRGICO - RECETAS DENTRO DE ATENCIONES
      Se conservan TODOS los campos originales de la receta. Atenciones solo
      completa alias necesarios para su vista, sin eliminar creado_en,
      actualizado_en, recomendaciones ni otros datos administrados por recetas.js.
    */
    return Object.assign({}, r, {
      id_receta: r.id_receta || r.id || '',
      id_paciente: r.id_paciente || r.paciente_id || '',
      id_historia: r.id_historia || '',
      id_atencion: r.id_atencion || '',
      id_medico: r.id_medico || '',
      fecha_receta: r.fecha_receta || r.fecha || '',
      diagnostico_cie10: r.diagnostico_cie10 || r.cie10 || '',
      medicamento: r.medicamento || r.medicamentos || '',
      indicaciones: r.indicaciones || '',
      estado: r.estado || 'Emitida',
      paciente_cedula: r.paciente_cedula || r.cedula || r.numero_documento || '',
      paciente_nombre: r.paciente_nombre || r.paciente || r.nombre || '',
      numero_consulta: r.numero_consulta || r.consulta || '',
      creado_en: r.creado_en || '',
      actualizado_en: r.actualizado_en || ''
    });
  }

  function auroRecetaMarcaTiempoAtenciones(valor){
    if(!valor) return 0;

    if(Object.prototype.toString.call(valor) === '[object Date]' && !isNaN(valor)){
      return valor.getTime();
    }

    const texto = String(valor).trim();
    if(!texto) return 0;

    /* yyyy-MM-dd HH:mm:ss o ISO, con o sin zona. */
    let m = texto.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if(m){
      const directo = Date.parse(texto);
      if(!isNaN(directo)) return directo;
      return new Date(
        Number(m[1]), Number(m[2]) - 1, Number(m[3]),
        Number(m[4]), Number(m[5]), Number(m[6] || 0)
      ).getTime();
    }

    /* dd/MM/yyyy, HH:mm o dd/MM/yyyy HH:mm. */
    m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if(m){
      return new Date(
        Number(m[3]), Number(m[2]) - 1, Number(m[1]),
        Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0)
      ).getTime();
    }

    const parsed = Date.parse(texto);
    return isNaN(parsed) ? 0 : parsed;
  }

  function auroRecetaFusionarVersionesAtenciones(local, remota){
    const l = normalizarRecetaAtencion(local || {});
    const r = normalizarRecetaAtencion(remota || {});

    const fechaLocal = auroRecetaMarcaTiempoAtenciones(
      l.actualizado_en || l.creado_en || l.fecha_receta
    );
    const fechaRemota = auroRecetaMarcaTiempoAtenciones(
      r.actualizado_en || r.creado_en || r.fecha_receta
    );

    /*
      La versión más reciente gobierna. La otra solo completa campos vacíos.
      En empate se conserva la copia local, porque puede ser la recién guardada
      y Google Sheets todavía estar propagando la actualización.
    */
    const principal = fechaRemota > fechaLocal ? r : l;
    const respaldo = fechaRemota > fechaLocal ? l : r;
    const fusionada = Object.assign({}, respaldo, principal);

    Object.keys(respaldo).forEach(function(campo){
      if(
        (fusionada[campo] === '' || fusionada[campo] === null || fusionada[campo] === undefined) &&
        respaldo[campo] !== '' && respaldo[campo] !== null && respaldo[campo] !== undefined
      ){
        fusionada[campo] = respaldo[campo];
      }
    });

    return normalizarRecetaAtencion(fusionada);
  }

  function mezclarRecetasLocalesYSheets(remotas){
    const mapa = new Map();

    /* Primero se registra la copia local completa. */
    leerRecetasLocales().forEach(item => {
      const local = normalizarRecetaAtencion(item);
      if(local.id_receta){
        mapa.set(String(local.id_receta), local);
      }
    });

    /* La copia remota solo reemplaza si realmente es más reciente. */
    (Array.isArray(remotas) ? remotas : []).forEach(item => {
      const remota = normalizarRecetaAtencion(item);
      if(!remota.id_receta) return;

      const clave = String(remota.id_receta);
      const local = mapa.get(clave);
      mapa.set(
        clave,
        local ? auroRecetaFusionarVersionesAtenciones(local, remota) : remota
      );
    });

    const mezcladas = Array.from(mapa.values());
    guardarRecetasLocales(mezcladas);
    return mezcladas;
  }

  async function cargarRecetasDesdeSheetsAtenciones(forzar){
    try{
      if(recetasSheetsCargando) return leerRecetasLocales();
      if(recetasSheetsCargadas && !forzar) return leerRecetasLocales();

      if(typeof API_URL === 'undefined' || !API_URL){
        return leerRecetasLocales();
      }

      recetasSheetsCargando = true;

      const res = await fetch(API_URL + '?accion=listarRecetas&_=' + Date.now());
      const data = await res.json();
      const remotas = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);

      const mezcladas = mezclarRecetasLocalesYSheets(remotas);
      recetasSheetsCargadas = true;
      recetasSheetsCargando = false;

      return mezcladas;

    }catch(error){
      recetasSheetsCargando = false;
      console.warn(MODULO, 'No se pudieron cargar recetas desde Google Sheets para atenciones.', error);
      return leerRecetasLocales();
    }
  }

  function recetasPorAtencion(atencion){
    if(!atencion) return [];

    const idAtencion = String(atencion.id_atencion || '').trim();
    const idHistoria = String(atencion.id_historia || '').trim();
    const idPaciente = String(atencion.id_paciente || idPacienteActivo() || '').trim();
    const fechaAtencion = String(atencion.fecha_atencion || '').slice(0,10);
    const numeroConsulta = String(atencion.numero_consulta || '').replace('#','').trim();

    const recetas = leerRecetasLocales().map(normalizarRecetaAtencion);

    /*
      Regla principal:
      Si la receta tiene id_atencion, solo debe mostrarse en esa atención.
      Esto evita que consulta #1 y consulta #2 muestren la misma receta.
    */
    const exactasPorAtencion = recetas.filter(r => {
      const ridAtencion = String(r.id_atencion || '').trim();
      return idAtencion && ridAtencion && ridAtencion === idAtencion;
    });

    if(exactasPorAtencion.length){
      return exactasPorAtencion.sort((a,b) =>
        String(b.fecha_receta || '').localeCompare(String(a.fecha_receta || ''))
      );
    }

    /*
      Regla secundaria:
      Si la receta trae numero_consulta, se asocia por consulta exacta.
    */
    const exactasPorConsulta = recetas.filter(r => {
      const ridAtencion = String(r.id_atencion || '').trim();
      if(ridAtencion) return false;

      const ridPaciente = String(r.id_paciente || '').trim();
      const ridHistoria = String(r.id_historia || '').trim();
      const rFecha = String(r.fecha_receta || '').slice(0,10);
      const rConsulta = String(r.numero_consulta || r.consulta || '').replace('#','').trim();

      return (
        idPaciente &&
        ridPaciente === idPaciente &&
        fechaAtencion &&
        rFecha === fechaAtencion &&
        numeroConsulta &&
        rConsulta &&
        rConsulta === numeroConsulta &&
        (!idHistoria || !ridHistoria || ridHistoria === idHistoria)
      );
    });

    if(exactasPorConsulta.length){
      return exactasPorConsulta.sort((a,b) =>
        String(b.fecha_receta || '').localeCompare(String(a.fecha_receta || ''))
      );
    }

    /*
      Último respaldo seguro:
      Solo usar paciente + fecha si hay una única atención ese día.
      Si hay varias consultas el mismo día, no se usa porque mezclaría recetas.
    */
    const atencionesMismoDia = atencionesPaciente(idPaciente).filter(a =>
      String(a.fecha_atencion || '').slice(0,10) === fechaAtencion
    );

    if(atencionesMismoDia.length === 1){
      return recetas.filter(r => {
        const ridAtencion = String(r.id_atencion || '').trim();
        if(ridAtencion) return false;

        const ridPaciente = String(r.id_paciente || '').trim();
        const ridHistoria = String(r.id_historia || '').trim();
        const rFecha = String(r.fecha_receta || '').slice(0,10);

        return (
          idPaciente &&
          ridPaciente === idPaciente &&
          fechaAtencion &&
          rFecha === fechaAtencion &&
          (!idHistoria || !ridHistoria || ridHistoria === idHistoria)
        );
      }).sort((a,b) =>
        String(b.fecha_receta || '').localeCompare(String(a.fecha_receta || ''))
      );
    }

    return [];
  }

  function resumenTexto(valor, max){
    const txt = String(valor || '').replace(/\s+/g, ' ').trim();
    if(!txt) return '—';
    return txt.length > max ? txt.slice(0, max) + '...' : txt;
  }

  function auroAtencionMedicamentoEsJSON(valor){
    const txt = String(valor || '').trim();
    if(!txt) return false;
    if(!(txt.startsWith('[') || txt.startsWith('{'))) return false;
    try{
      JSON.parse(txt);
      return true;
    }catch(e){
      return false;
    }
  }

  function auroAtencionNormalizarMedicamento(m){
    m = m || {};
    return {
      med: m.med || m.medicamento || m.nombre || '',
      pres: m.pres || m.presentacion || '',
      via: m.via || '',
      cantidad: m.cantidad || '',
      frec: m.frec || m.frecuencia || '',
      dur: m.dur || m.duracion || '',
      ind: m.ind || m.indicaciones || '',
      continuo: m.continuo || 'No'
    };
  }

  function auroAtencionUnirNombrePresentacion(nombre, presentacion){
    const n = String(nombre || '').trim();
    const p = String(presentacion || '').trim();
    if(!n) return p;
    if(!p) return n;

    const limpiar = x => String(x || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const nn = limpiar(n);
    const pp = limpiar(p);

    if(nn.includes(pp)) return n;
    return n + ' ' + p;
  }

  function auroAtencionMedicamentoTexto(valor, maxItems){
    const txt = String(valor || '').trim();
    if(!txt) return '—';

    if(!auroAtencionMedicamentoEsJSON(txt)){
      return resumenTexto(txt, 180);
    }

    try{
      let data = JSON.parse(txt);
      if(!Array.isArray(data)) data = [data];
      data = data.filter(Boolean);

      if(!data.length) return '—';

      const limite = maxItems || 2;
      const visibles = data.slice(0, limite).map((item, i) => {
        if(typeof item === 'string'){
          return (i + 1) + '. ' + item.replace(/^\s*\d+\.\s*/, '').trim();
        }

        if(item.texto){
          return (i + 1) + '. ' + String(item.texto || '').replace(/^\s*\d+\.\s*/, '').trim();
        }

        const m = auroAtencionNormalizarMedicamento(item);
        const nombre = auroAtencionUnirNombrePresentacion(m.med, m.pres);
        const detalle = [m.via, m.frec, m.dur].filter(Boolean).join(' · ');
        return (i + 1) + '. ' + [nombre, detalle].filter(Boolean).join(' — ');
      }).filter(Boolean);

      const restantes = data.length - visibles.length;
      if(restantes > 0){
        visibles.push('+' + restantes + ' medicamento' + (restantes === 1 ? '' : 's'));
      }

      return visibles.join('\n');
    }catch(e){
      return resumenTexto(txt, 180);
    }
  }


  function auroAtencionMedicamentosArray(valor){
    const txt = String(valor || '').trim();
    if(!txt) return [];

    if(!auroAtencionMedicamentoEsJSON(txt)){
      return txt.split(/\n+/).map(linea => ({texto: linea.replace(/^\s*\d+\.\s*/, '').trim()})).filter(x => x.texto);
    }

    try{
      let data = JSON.parse(txt);
      if(!Array.isArray(data)) data = [data];
      return data.filter(Boolean);
    }catch(e){
      return [];
    }
  }

  function auroAtencionMedicamentoResumenHTML(valor){
    const meds = auroAtencionMedicamentosArray(valor);
    if(!meds.length){
      return '<div class="text-muted small">Sin medicamentos registrados</div>';
    }

    const primero = meds[0];

    if(typeof primero === 'string' || primero.texto){
      const texto = typeof primero === 'string'
        ? primero.replace(/^\s*\d+\.\s*/, '').trim()
        : String(primero.texto || '').replace(/^\s*\d+\.\s*/, '').trim();
      const extra = meds.length > 1 ? '<span class="auro-receta-med-extra">+' + (meds.length - 1) + ' medicamento' + (meds.length - 1 === 1 ? '' : 's') + '</span>' : '';
      return '<div class="auro-receta-resumen-box">' +
        '<div class="auro-receta-med-principal">' + safe(texto || 'Medicamento registrado') + '</div>' +
        extra +
      '</div>';
    }

    const m = auroAtencionNormalizarMedicamento(primero || {});
    const nombre = auroAtencionUnirNombrePresentacion(m.med, m.pres);
    const esquema = [m.via, m.frec, m.dur].filter(Boolean).join(' · ');
    const indicacion = m.ind ? '<div class="auro-receta-med-esquema">' + safe(m.ind) + '</div>' : '';
    const extra = meds.length > 1 ? '<span class="auro-receta-med-extra">+' + (meds.length - 1) + ' medicamento' + (meds.length - 1 === 1 ? '' : 's') + '</span>' : '';

    return '<div class="auro-receta-resumen-box">' +
      '<div class="auro-receta-med-principal">' + safe(nombre || 'Medicamento registrado') + '</div>' +
      (esquema ? '<div class="auro-receta-med-esquema">' + safe(esquema) + '</div>' : '') +
      indicacion +
      extra +
    '</div>';
  }

  function auroAtencionDato(label, valor){
    const v = String(valor || '').trim() || '—';
    return '<div class="auro-atencion-info-card"><span>' + safe(label) + '</span><b>' + safe(v) + '</b></div>';
  }

  function auroAtencionDatoHTML(label, html){
    const h = String(html || '').trim() || '<b>—</b>';
    return '<div class="auro-atencion-info-card"><span>' + safe(label) + '</span>' + h + '</div>';
  }

  function auroAtencionCitaTexto(a){
    const id = String(a?.id_cita || '').trim();
    return id || 'Sin cita vinculada';
  }


  function auroAtencionNormalizarNombre(texto){
    return String(texto || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g,'')
      .replace(/\s+/g,' ');
  }

  function auroAtencionResolverMedico(atencion){
    const raw = String(atencion?.id_medico || '').trim();
    let nombre = '';
    let id = '';

    if(raw && /^MED[-_]/i.test(raw)){
      id = raw;
    }else if(raw){
      nombre = raw;
    }

    try{
      const medicosLista = medicosActivosAtenciones.length
        ? medicosActivosAtenciones
        : (Array.isArray(window.medicos) ? window.medicos : []);
      if(medicosLista.length){
        const rawNorm = auroAtencionNormalizarNombre(raw);
        const encontrado = medicosLista.find(m => {
          const mid = String(m.id_medico || m.id || m.codigo || '').trim();
          const mnombre = String(m.nombre || m.nombres || '').trim();
          const mapellidos = String(m.apellidos || '').trim();
          const completo = String(m.nombre_completo || (mnombre + ' ' + mapellidos)).trim();
          const completoNorm = auroAtencionNormalizarNombre(completo);
          const nombreNorm = auroAtencionNormalizarNombre(mnombre + ' ' + mapellidos);
          return (
            (id && mid && mid === id) ||
            (rawNorm && completoNorm && (completoNorm.includes(rawNorm) || rawNorm.includes(completoNorm))) ||
            (rawNorm && nombreNorm && (nombreNorm.includes(rawNorm) || rawNorm.includes(nombreNorm)))
          );
        });

        if(encontrado){
          id = String(encontrado.id_medico || encontrado.id || encontrado.codigo || id || '').trim();
          const n = String(encontrado.nombre_completo || ((encontrado.nombres || encontrado.nombre || '') + ' ' + (encontrado.apellidos || ''))).trim();
          if(n) nombre = n;
        }
      }
    }catch(e){
      console.warn(MODULO, 'No se pudo resolver médico desde catálogo.', e);
    }

    if(!nombre){
      nombre = raw || '—';
    }

    let especialidad = '';

    try{
      const medicosLista = medicosActivosAtenciones.length
        ? medicosActivosAtenciones
        : (Array.isArray(window.medicos) ? window.medicos : []);

      const encontradoEspecialidad = medicosLista.find(function(m){
        const mid = String(m.id_medico || m.id || m.codigo || '').trim();
        return id && mid && mid === id;
      }) || null;

      if(encontradoEspecialidad){
        especialidad = String(
          encontradoEspecialidad.especialidad_principal ||
          encontradoEspecialidad.especialidad ||
          encontradoEspecialidad.nombre_especialidad ||
          ''
        ).trim();
      }
    }catch(e){
      console.warn(MODULO, 'No se pudo resolver especialidad desde catálogo.', e);
    }

    return {
      nombre: nombre || '—',
      id: id || '—',
      especialidad: especialidad || '—'
    };
  }

  function auroAtencionMedicoHTML(atencion){
    const m = auroAtencionResolverMedico(atencion);
    const idValor = m.id && m.id !== '—' ? safe(m.id) : 'ID no disponible';

    return '<div class="auro-atencion-medico-box">' +
      '<strong class="auro-atencion-medico-nombre">' + safe(m.nombre) + '</strong>' +
      '<div class="small text-muted">' + safe(m.especialidad || '—') + '</div>' +
      '<div class="auro-atencion-medico-id-row">' +
        '<span class="auro-atencion-medico-id-label">ID</span>' +
        '<small class="auro-atencion-medico-id">' + idValor + '</small>' +
      '</div>' +
    '</div>';
  }

  function auroAtencionEspecialidadMedicoHTML(atencion){
    const m = auroAtencionResolverMedico(atencion);
    return '<div class="auro-atencion-medico-box">' +
      '<strong class="auro-atencion-medico-nombre">' + safe(m.especialidad || '—') + '</strong>' +
      '<div class="small text-muted">' + safe(m.nombre || '—') + '</div>' +
    '</div>';
  }

  function auroAtencionVerReceta(idReceta){
    const id = String(idReceta || '').trim();

    if(!id){
      alert('No se encontró el identificador de la receta.');
      return;
    }

    /*
      BLINDAJE VISUAL ADITIVO:
      Prioriza el puente ya existente de Vista Integral. Si por orden de carga
      ese puente todavía no está disponible, usa directamente el MISMO visor
      oficial de recetas. No crea otro motor ni modifica la receta.
    */
    if(
      window.AurosanaxVistaIntegral &&
      typeof window.AurosanaxVistaIntegral.abrirReceta === 'function'
    ){
      window.AurosanaxVistaIntegral.abrirReceta(id);
      return;
    }

    if(typeof window.pdfRecetaEmitida === 'function'){
      try{
        const resultado = window.pdfRecetaEmitida(id);
        if(resultado && typeof resultado.catch === 'function'){
          resultado.catch(function(error){
            console.error(MODULO, 'No se pudo abrir la receta oficial.', error);
          });
        }
        return;
      }catch(error){
        console.error(MODULO, 'No se pudo abrir la receta oficial.', error);
      }
    }

    alert('La vista oficial de Recetas no está disponible en este momento.');
  }

  function ocultarDetalleAtencion(){
    /*
      2.5.1:
      Ocultar es únicamente una acción visual.
      NO invalida la atención clínica activa ni rompe el contexto maestro.
    */
    const box = $('auroAtencionActivaBox');
    if(box){
      box.style.display = 'none';
      box.innerHTML = '';
    }
  }

  function renderDetalleAtencion(a){
    const box = $('auroAtencionActivaBox');
    if(!box || !a) return;

    const recetas = recetasPorAtencion(a);

    let recetasHTML = '';
    if(!recetas.length && !recetasSheetsCargadas && !recetasSheetsCargando){
      cargarRecetasDesdeSheetsAtenciones(false).then(function(){
        const actual = leerLocal().find(x => String(x.id_atencion || '') === String(a.id_atencion || ''));
        if(actual){
          renderDetalleAtencion(normalizar(actual));
        }
      });
    }

    if(recetas.length){
      const filasRecetasDesktop = recetas.map(r => {
        return '<tr>' +
          '<td>' + safe(fechaVisual(r.fecha_receta || r.fecha || '')) + '</td>' +
          '<td>' + safe(r.id_receta || '—') + '</td>' +
          '<td>' + safe(r.diagnostico_cie10 || r.cie10 || '—') + '</td>' +
          '<td>' + auroAtencionMedicamentoResumenHTML(r.medicamento || r.medicamentos || '') + '</td>' +
          '<td><span class="badge-auro badge-ok">' + safe(r.estado || 'Emitida') + '</span></td>' +
          '<td><button type="button" class="btn-action primary" data-receta-ver-id="' + safe(r.id_receta || '') + '"><i class="bi bi-eye me-1"></i> Ver receta</button></td>' +
        '</tr>';
      }).join('');

      const tarjetasRecetasMobile = recetas.map(r => {
        return '<div class="auro-receta-atencion-mobile-card">' +
          '<div class="auro-receta-atencion-mobile-head">' +
            '<div>' +
              '<b>Receta</b><br>' +
              '<small class="text-muted">' + safe(r.id_receta || '—') + '</small>' +
            '</div>' +
            '<span class="badge-auro badge-ok">' + safe(r.estado || 'Emitida') + '</span>' +
          '</div>' +
          '<div class="small"><b>Fecha:</b> ' + safe(fechaVisual(r.fecha_receta || r.fecha || '')) + '</div>' +
          '<div class="small"><b>CIE-10:</b> ' + safe(r.diagnostico_cie10 || r.cie10 || '—') + '</div>' +
          '<div class="small mt-2"><b>Medicamento:</b><br>' + auroAtencionMedicamentoResumenHTML(r.medicamento || r.medicamentos || '') + '</div>' +
          '<div class="small mt-2"><b>Indicaciones:</b><br>' + safe(resumenTexto(r.indicaciones || '', 160)) + '</div>' +
          '<button type="button" class="btn-action primary mt-2" data-receta-ver-id="' + safe(r.id_receta || '') + '"><i class="bi bi-eye me-1"></i> Ver receta</button>' +
        '</div>';
      }).join('');

      recetasHTML =
        '<div class="mt-3 auro-recetas-atencion-box">' +
          '<div class="auro-recetas-atencion-title"><b><i class="bi bi-prescription2 me-1"></i> Recetas asociadas a esta atención</b><span class="badge-auro badge-blue">' + recetas.length + ' receta' + (recetas.length === 1 ? '' : 's') + '</span></div>' +
          '<div class="auro-recetas-atencion-desktop">' +
            '<div class="table-responsive">' +
              '<table class="table table-modern align-middle mb-0 auro-premium-recetas-tabla">' +
                '<thead><tr><th>FECHA</th><th>ID DE RECETA</th><th>CIE-10</th><th>MEDICAMENTO(S)</th><th>ESTADO</th><th>ACCIÓN</th></tr></thead>' +
                '<tbody>' + filasRecetasDesktop + '</tbody>' +
              '</table>' +
            '</div>' +
          '</div>' +
          '<div class="auro-recetas-atencion-mobile">' +
            tarjetasRecetasMobile +
          '</div>' +
        '</div>';
    }else{
      recetasHTML =
        '<div class="sheet-note mt-3">' +
          '<i class="bi bi-info-circle me-1"></i> Esta atención aún no tiene recetas asociadas.' +
        '</div>';
    }

    box.style.display = 'block';
    box.innerHTML =
      '<div class="auro-atencion-premium-head">' +
        '<div class="auro-atencion-premium-title">' +
          '<div class="auro-atencion-premium-icon">#' + safe(a.numero_consulta || '') + '</div>' +
          '<div>' +
            '<b>Consulta #' + safe(a.numero_consulta || '—') + '</b>' +
            '<div class="auro-atencion-id">ID atención: ' + safe(a.id_atencion || '—') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="d-flex gap-2 align-items-center flex-wrap justify-content-end">' +
          '<span class="badge-auro ' + (String(a.estado_atencion).toLowerCase() === 'abierta' ? 'badge-blue' : 'badge-ok') + '">' + safe(a.estado_atencion || '—') + '</span>' +
          '<button type="button" class="btn-action soft" id="btnOcultarDetalleAtencion">Ocultar</button>' +
        '</div>' +
      '</div>' +
      '<div class="auro-atencion-info-grid">' +
        auroAtencionDato('Fecha de atención', fechaVisual(a.fecha_atencion)) +
        auroAtencionDato(String(a.id_cita || '').trim() ? 'Hora programada' : 'Hora de apertura', horaVisualAtencion(a.hora_atencion || '—')) +
        auroAtencionDato('Tipo', a.tipo_atencion || '—') +
        auroAtencionDatoHTML('Médico', auroAtencionMedicoHTML(a)) +
        auroAtencionDato('Especialidad', auroAtencionResolverMedico(a).especialidad || '—') +
        auroAtencionDato('ID historia', a.id_historia || '—') +
        auroAtencionDato('ID cita', auroAtencionCitaTexto(a)) +
        auroAtencionDato('Paciente', a.id_paciente || idPacienteActivo() || '—') +
        auroAtencionDato('Actualizado', fechaHoraVisualAtencion(a.actualizado_en)) +
      '</div>' +
      recetasHTML;

    const btnOcultar = $('btnOcultarDetalleAtencion');
    if(btnOcultar) btnOcultar.addEventListener('click', ocultarDetalleAtencion);

    box.querySelectorAll('[data-receta-ver-id]').forEach(function(btn){
      btn.addEventListener('click', function(){
        auroAtencionVerReceta(this.getAttribute('data-receta-ver-id'));
      });
    });
  }

  function seleccionarAtencion(idAtencion){
    const a = leerLocal().find(function(item){
      return String(item.id_atencion || '') === String(idAtencion || '');
    });

    if(!a){
      alert('No se encontró la atención seleccionada.');
      return;
    }

    const idPacienteVisible = String(idPacienteActivo() || '').trim();
    const idPacienteAtencion = String(a.id_paciente || '').trim();

    if(
      idPacienteVisible &&
      idPacienteAtencion &&
      idPacienteVisible !== idPacienteAtencion
    ){
      alert(
        'La consulta seleccionada pertenece a otro paciente. ' +
        'Se bloqueó la apertura para proteger la historia clínica.'
      );
      atencionActivaId = '';
      renderAtencionesPaciente();
      return;
    }

    sincronizarContextoAtencion(a, {
      motivo:'boton_ver',
      emitirIniciada:false,
      idAnterior:String(atencionActivaId || '').trim()
    });

    /*
      Refresco visual localizado:
      el botón Finalizar refleja inmediatamente la atención recién seleccionada
      sin esperar otro render general.
    */
    auroActualizarBotonFinalizarPorContexto(idPacienteAtencion);
  }

  function asegurarBloque(){
    const historia = $('historia');
    const cardPaciente = $('hcPatientCard');

    if(!historia || !cardPaciente) return null;

    let box = $('auroAtencionesBox');
    if(box) return box;

    box = document.createElement('div');
    box.id = 'auroAtencionesBox';
    box.className = 'cardx p-3 mb-3';
    box.innerHTML =
      '<div class="d-flex justify-content-between align-items-start gap-2 flex-wrap auro-atenciones-header">' +
        '<div class="auro-atenciones-title">' +
          '<h5 class="fw-bold mb-1"><i class="bi bi-journal-medical me-1"></i> <span class="desktop-title">Historial de atenciones</span><span class="mobile-title">Atenciones</span></h5>' +
          '<div class="text-muted small" id="auroAtencionesResumen">Seleccione un paciente para ver sus atenciones.</div>' +
        '</div>' +
        '<div class="auro-atenciones-actions">' +
          '<button type="button" class="btn-soft" id="btnToggleConsultasAtencion"><i class="bi bi-eye-slash me-1"></i> Ocultar consultas</button>' +
          '<button type="button" class="btn-soft" id="btnIniciarAtencion"><i class="bi bi-play-circle me-1"></i> Iniciar</button>' +
          '<button type="button" class="btn-auro" id="btnFinalizarAtencion"><i class="bi bi-check-circle me-1"></i> Finalizar</button>' +
        '</div>' +
      '</div>' +
      '<div id="auroAtencionActivaBox" class="mt-3" style="display:none;"></div>' +
      '<div id="auroAtencionesLista" class="mt-3"></div>';

    cardPaciente.parentNode.insertBefore(box, cardPaciente.nextSibling);

    const btnToggleConsultas = $('btnToggleConsultasAtencion');
    const btnIniciar = $('btnIniciarAtencion');
    const btnFinalizar = $('btnFinalizarAtencion');

    if(btnToggleConsultas) btnToggleConsultas.addEventListener('click', function(){
      consultasVisible = !consultasVisible;
      renderAtencionesPaciente();
    });

    if(btnIniciar) btnIniciar.addEventListener('click', crearAtencion);
    if(btnFinalizar) btnFinalizar.addEventListener('click', finalizarAtencion);

    return box;
  }

  function renderAtencionesPaciente(){
    asegurarBloque();

    const idPaciente = idPacienteActivo();
    const resumen = $('auroAtencionesResumen');
    const lista = $('auroAtencionesLista');
    const activaBox = $('auroAtencionActivaBox');
    const btnToggleConsultas = $('btnToggleConsultasAtencion');
    const btnIniciar = $('btnIniciarAtencion');
    const btnFinalizar = $('btnFinalizarAtencion');

    if(!resumen || !lista) return;

    if(!idPaciente){
      setTimeout(function(){
        const nuevoId = idPacienteActivo();
        if(nuevoId){
          cargarAtencionesDesdeSheets(false).then(renderAtencionesPaciente);
        }
      },300);

      setTimeout(function(){
        const nuevoId = idPacienteActivo();
        if(nuevoId){
          cargarAtencionesDesdeSheets(false).then(renderAtencionesPaciente);
        }
      },1000);

      resumen.textContent = 'Seleccione un paciente para iniciar o revisar atenciones.';
      lista.innerHTML = '<div class="text-muted small">Sin paciente activo.</div>';
      if(activaBox) activaBox.style.display = 'none';
      if(btnToggleConsultas) btnToggleConsultas.disabled = true;
      if(btnIniciar) btnIniciar.disabled = true;
      if(btnFinalizar) btnFinalizar.disabled = true;
      return;
    }

    const arr = atencionesPaciente(idPaciente);
    const abierta = atencionAbiertaActiva(idPaciente) || atencionAbierta(idPaciente);

    if(btnToggleConsultas){
      btnToggleConsultas.disabled = false;
      btnToggleConsultas.innerHTML = consultasVisible
        ? '<i class="bi bi-eye-slash me-1"></i> Ocultar consultas'
        : '<i class="bi bi-eye me-1"></i> Mostrar consultas';
    }


    if(btnIniciar){
      /*
        Puede haber varias atenciones abiertas. Iniciar permanece disponible;
        crearAtencion() exige confirmación explícita cuando el mismo médico
        ya tiene una consulta abierta.

        BLINDAJE UI:
        durante una creación en curso se bloquea únicamente el botón para
        impedir doble clic; no cambia la política clínica existente.
      */
      if(creandoAtencion){
        btnIniciar.disabled = true;
        btnIniciar.style.opacity = '0.72';
        btnIniciar.style.cursor = 'wait';
        btnIniciar.innerHTML =
          '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> Iniciando…';
      }else{
        const tieneAbiertaPaciente = atencionesAbiertasPaciente(idPaciente).length > 0;

        btnIniciar.disabled = tieneAbiertaPaciente;
        btnIniciar.style.opacity = tieneAbiertaPaciente ? '0.55' : '1';
        btnIniciar.style.cursor = tieneAbiertaPaciente ? 'not-allowed' : 'pointer';
        btnIniciar.innerHTML = tieneAbiertaPaciente
          ? '<i class="bi bi-lock me-1"></i> Atención abierta'
          : '<i class="bi bi-play-circle me-1"></i> Iniciar';
      }
    }

    if(btnFinalizar){
      auroActualizarBotonFinalizarPorContexto(idPaciente);
    }

    resumen.textContent = 'Total consultas: ' + arr.length + (arr[0] ? ' · Última: ' + fechaVisual(arr[0].fecha_atencion) : '') + ' · Vista integral activa';

    if(activaBox){
      /*
        AUROSANAX SINCRONIZACIÓN VISUAL ANTIRREGRESIVA:
        La atención seleccionada explícitamente por el usuario gobierna la caja
        de detalle. Un render tardío NO puede sustituirla por otra atención
        abierta del mismo paciente.

        Prioridad:
        1. atencionActivaId exacta del paciente visible.
        2. Si no hay selección activa, mostrar la atención abierta como referencia.
        3. Si no hay selección ni abierta, mostrar estado sin consulta abierta.

        Alcance:
        - Solo presentación.
        - No cambia id_atencion, contexto clínico, localStorage ni backend.
        - No altera Iniciar, Finalizar, Plan, Diagnóstico, Recetas ni Examen Físico.
      */
      const idSeleccionada = String(atencionActivaId || '').trim();

      if(idSeleccionada){
        const seleccionada = arr.find(function(item){
          return String(item.id_atencion || '').trim() === idSeleccionada &&
            String(item.id_paciente || '').trim() === String(idPaciente || '').trim();
        }) || null;

        if(seleccionada){
          renderDetalleAtencion(seleccionada);
        }
        /*
          Si existe id_atencion activo pero todavía no aparece en este render,
          NO se cae a otra atención abierta. Se conserva la caja actual hasta
          que la fuente correspondiente esté disponible.
        */
      }else if(abierta){
        const totalAbiertasPaciente = atencionesAbiertasPaciente(idPaciente).length;
        activaBox.style.display = 'block';
        activaBox.innerHTML =
          '<div class="auro-atencion-status abierta">' +
          '<b>🟢 ABIERTA</b> · Consulta #' + safe(abierta.numero_consulta) +
          (totalAbiertasPaciente > 1 ? ' · ' + safe(totalAbiertasPaciente) + ' abiertas' : '') + '<br>' +
          '<span>' + safe(fechaVisual(abierta.fecha_atencion)) + ' ' + safe(horaVisualAtencion(abierta.hora_atencion || '—')) + '</span>' +
          '</div>';
      }else{
        activaBox.style.display = 'block';
        activaBox.innerHTML =
          '<div class="auro-atencion-status cerrada">' +
          '<b>🔵 FINALIZADA</b> · Sin consulta abierta' +
          '</div>';
      }
    }

    if(!consultasVisible){
      lista.innerHTML = '<div class="sheet-note mt-2"><i class="bi bi-eye-slash me-1"></i> Consultas ocultas. Presione <b>Mostrar consultas</b> para verlas.</div>';
      return;
    }

    if(!arr.length && !atencionesSheetsCargadas && !atencionesSheetsCargando){
      lista.innerHTML = '<div class="text-muted small">Cargando atenciones desde Google Sheets...</div>';
      cargarAtencionesDesdeSheets(false).then(renderAtencionesPaciente);
      return;
    }

    if(!arr.length){
      lista.innerHTML = '<div class="text-muted small">Este paciente aún no tiene atenciones registradas.</div>';
      return;
    }

    const totalPaginas = Math.max(1, Math.ceil(arr.length / CONSULTAS_POR_PAGINA));
    if(consultasPaginaActual > totalPaginas) consultasPaginaActual = totalPaginas;
    if(consultasPaginaActual < 1) consultasPaginaActual = 1;

    const inicioPagina = (consultasPaginaActual - 1) * CONSULTAS_POR_PAGINA;
    const arrPagina = arr.slice(inicioPagina, inicioPagina + CONSULTAS_POR_PAGINA);

    const filasTabla = arrPagina.map(a => {
      const badge = String(a.estado_atencion).toLowerCase() === 'abierta' ? 'badge-blue' : 'badge-ok';
      return '<tr>' +
        '<td><b>#' + safe(a.numero_consulta) + '</b></td>' +
        '<td class="auro-premium-id">' + safe(a.id_atencion || '—') + '</td>' +
        '<td>' + safe(fechaVisual(a.fecha_atencion)) + '</td>' +
        '<td>' + safe(horaVisualAtencion(a.hora_atencion || '—')) + '</td>' +
        '<td>' + safe(a.tipo_atencion || '—') + '</td>' +
        '<td>' + auroAtencionEspecialidadMedicoHTML(a) + '</td>' +
        '<td><span class="badge-auro ' + badge + '">' + safe(a.estado_atencion || '—') + '</span></td>' +
        '<td class="auro-premium-acciones">' +
          '<div style="display:grid;grid-template-columns:1fr;gap:6px">' +
            '<button type="button" class="btn-action primary" data-atencion-id="' + safe(a.id_atencion) + '" style="width:100%">Ver</button>' +
            '<button type="button" class="btn-action soft" data-atencion-integral-id="' + safe(a.id_atencion) + '" style="width:100%;border:1px solid #8b1e5a;background:#fff7fb;color:#8b1e5a;font-weight:900">' +
              '<i class="bi bi-grid-1x2 me-1"></i> Vista integral' +
            '</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    }).join('');

    const tarjetasMovil = arrPagina.map(a => {
      const badge = String(a.estado_atencion).toLowerCase() === 'abierta' ? 'badge-blue' : 'badge-ok';
      return '<div class="auro-consulta-card">' +
        '<div class="auro-consulta-card-head">' +
          '<div><b>Consulta #' + safe(a.numero_consulta) + '</b><br><small class="text-muted">' + safe(fechaVisual(a.fecha_atencion)) + ' · ' + safe(horaVisualAtencion(a.hora_atencion || '—')) + '</small></div>' +
          '<span class="badge-auro ' + badge + '">' + safe(a.estado_atencion || '—') + '</span>' +
        '</div>' +
        '<div class="small"><b>Tipo:</b> ' + safe(a.tipo_atencion || '—') + '</div>' +
        '<div class="small"><b>Especialidad:</b> ' + safe(auroAtencionResolverMedico(a).especialidad || '—') + '</div>' +
        '<div class="small"><b>Médico:</b> ' + safe(auroAtencionResolverMedico(a).nombre || '—') + '</div>' +
        '<div class="small text-muted"><b>ID:</b> ' + safe(a.id_atencion || '—') + '</div>' +
        '<div style="display:grid;grid-template-columns:1fr;gap:7px;margin-top:10px">' +
          '<button type="button" class="btn-action primary" data-atencion-id="' + safe(a.id_atencion) + '" style="width:100%">Ver consulta</button>' +
          '<button type="button" class="btn-action soft" data-atencion-integral-id="' + safe(a.id_atencion) + '" style="width:100%;border:1px solid #8b1e5a;background:#fff7fb;color:#8b1e5a;font-weight:900">' +
            '<i class="bi bi-grid-1x2 me-1"></i> Vista integral' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');

    const paginacionHTML =
      '<div class="auro-consultas-paginacion">' +
        '<button type="button" class="btn-soft" id="btnAtencionesAnterior" ' + (consultasPaginaActual <= 1 ? 'disabled' : '') + '>Anterior</button>' +
        '<div class="small text-muted">Página ' + consultasPaginaActual + ' de ' + totalPaginas + ' · ' + arr.length + ' consulta' + (arr.length === 1 ? '' : 's') + '</div>' +
        '<button type="button" class="btn-soft" id="btnAtencionesSiguiente" ' + (consultasPaginaActual >= totalPaginas ? 'disabled' : '') + '>Siguiente</button>' +
      '</div>';

    lista.innerHTML =
      '<div class="auro-atenciones-desktop">' +
        '<div class="table-responsive">' +
          '<table class="table table-modern align-middle mb-0 auro-premium-historial-tabla">' +
            '<thead><tr><th>#</th><th>ID DE ATENCIÓN</th><th>FECHA DE ATENCIÓN</th><th>HORA</th><th>TIPO</th><th>ESPECIALIDAD / MÉDICO</th><th>ESTADO</th><th>ACCIÓN</th></tr></thead>' +
            '<tbody>' + filasTabla + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +
      '<div class="auro-atenciones-mobile">' + tarjetasMovil + '</div>' +
      paginacionHTML;

    const btnAnt = $('btnAtencionesAnterior');
    const btnSig = $('btnAtencionesSiguiente');

    if(btnAnt){
      btnAnt.addEventListener('click', function(){
        if(consultasPaginaActual > 1){
          consultasPaginaActual--;
          renderAtencionesPaciente();
        }
      });
    }

    if(btnSig){
      btnSig.addEventListener('click', function(){
        consultasPaginaActual++;
        renderAtencionesPaciente();
      });
    }

    lista.querySelectorAll('[data-atencion-id]').forEach(btn => {
      btn.addEventListener('click', function(){
        seleccionarAtencion(this.getAttribute('data-atencion-id'));
      });
    });

    lista.querySelectorAll('[data-atencion-integral-id]').forEach(btn => {
      btn.addEventListener('click', function(){
        const id = this.getAttribute('data-atencion-integral-id');

        if(
          window.AurosanaxVistaIntegral &&
          typeof window.AurosanaxVistaIntegral.abrir === 'function'
        ){
          window.AurosanaxVistaIntegral.abrir(id);
          return;
        }

        alert(
          'La Vista integral no está cargada. ' +
          'Incluya vista_integral_atencion.js después de los módulos clínicos.'
        );
      });
    });
  }

  function iniciarModulo(){
    inyectarEstilosAtenciones();
    asegurarBloque();
    renderAtencionesPaciente();

    cargarAtencionesDesdeSheets(false).then(function(){
      renderAtencionesPaciente();
    });

    cargarRecetasDesdeSheetsAtenciones(false);

    cargarMedicosActivosAtenciones(false).then(function(){
      renderAtencionesPaciente();
    });
  }

  function envolverFuncion(nombre, despues){
    const original = window[nombre];
    if(typeof original !== 'function' || original.__auroAtencionesWrapped) return;

    const nueva = function(){
      const r = original.apply(this, arguments);
      setTimeout(despues, 120);
      return r;
    };

    nueva.__auroAtencionesWrapped = true;
    window[nombre] = nueva;
  }

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(function(){
      iniciarModulo();
      envolverFuncion('showScreen', function(){
        if($('historia') && $('historia').classList.contains('active')) iniciarModulo();
      });
      envolverFuncion('seleccionarPacienteHistoria', function(){
        /*
          AUROSANAX V30 — CAMBIO REAL DE PACIENTE
          ---------------------------------------
          seleccionarPacienteHistoria() también puede ejecutarse durante
          refrescos o reselecciones del MISMO paciente. Esos casos NO son una
          transición clínica y no deben expulsar al profesional de la atención.

          Solo se invalida cuando la atención activa pertenece a un paciente
          distinto del paciente visible, o cuando ya no puede demostrarse que
          el contexto anterior siga perteneciendo al paciente visible.

          No se borra persistencia.
        */
        const atencionAnterior = auroAtencionActivaRegistro();
        const idAtencionAnterior = String(atencionActivaId || '').trim();
        const idPacienteAnterior = String(atencionAnterior?.id_paciente || '').trim();
        const idPacienteNuevo = String(idPacienteActivo() || '').trim();

        const mismoPacienteDemostrado = Boolean(
          idAtencionAnterior &&
          idPacienteAnterior &&
          idPacienteNuevo &&
          idPacienteAnterior === idPacienteNuevo
        );

        consultasPaginaActual = 1;

        if(!mismoPacienteDemostrado && idAtencionAnterior){
          auroInvalidarContextoAtencion({
            idAnterior:idAtencionAnterior,
            idNueva:'',
            idPaciente:idPacienteNuevo,
            motivo:'cambio_paciente_historia',
            limpiarVisual:true
          });

          const box = $('auroAtencionActivaBox');
          if(box){
            box.style.display = 'none';
            box.innerHTML = '';
          }
        }

        /*
          Refresco permitido:
          actualizar el historial no modifica por sí mismo el contexto clínico.
          Si era el mismo paciente, atencionActivaId permanece intacto.
        */
        setTimeout(function(){
          cargarAtencionesDesdeSheets(true).then(renderAtencionesPaciente);
        },100);

        setTimeout(renderAtencionesPaciente,500);
      });

      envolverFuncion('actualizarTarjetaPacienteHistoria', function(){
        setTimeout(function(){ cargarAtencionesDesdeSheets(false).then(renderAtencionesPaciente); },100);
        setTimeout(renderAtencionesPaciente,500);
      });

      envolverFuncion('abrirHistoriaPaciente', function(){
        /*
          CONTRATO INTENCIONAL:
          abrir una Historia Clínica desde su flujo oficial deja la historia
          SIN atención seleccionada hasta que el profesional pulse Ver.
          Por eso esta ruta sí invalida incluso si el paciente coincide.
        */
        const idAtencionAnterior = String(atencionActivaId || '').trim();
        consultasPaginaActual = 1;

        auroInvalidarContextoAtencion({
          idAnterior:idAtencionAnterior,
          idNueva:'',
          idPaciente:String(idPacienteActivo() || '').trim(),
          motivo:'abrir_historia_paciente',
          limpiarVisual:true
        });

        const box = $('auroAtencionActivaBox');
        if(box){
          box.style.display = 'none';
          box.innerHTML = '';
        }

        setTimeout(function(){
          cargarAtencionesDesdeSheets(true).then(renderAtencionesPaciente);
        },300);

        setTimeout(renderAtencionesPaciente,800);
      });
    }, 700);
  });


  /* ==========================================================
     AUROSANAX - REINICIO DE ATENCIÓN PARA HISTORIA NUEVA
     Alcance:
     - Solo se ejecuta al recibir aurosanax:historia-nueva.
     - No elimina atenciones, historias ni datos guardados.
     - No crea ni modifica IDs.
     - Evita que los módulos conserven el id_atencion anterior.
  ========================================================== */

  function auroLimpiarCamposModulosConsultaNueva(){
    [
      'hc_antecedentes',
      'hc_anamnesis',
      'hc_examen',
      'hc_gineco',
      'hc_obstetricia',
      'hc_estetica',
      'hc_diagnostico',
      'hc_plan',
      'hc_docs'
    ].forEach(function(panelId){
      const panel = document.getElementById(panelId);
      if(!panel) return;

      panel.querySelectorAll('input, textarea, select').forEach(function(el){
        if(el.type === 'checkbox' || el.type === 'radio'){
          el.checked = false;
          return;
        }

        if(el.tagName === 'SELECT'){
          el.selectedIndex = 0;
          return;
        }

        if(!el.readOnly && !el.disabled){
          el.value = '';
        }
      });

      panel.querySelectorAll('[contenteditable="true"]').forEach(function(el){
        el.innerHTML = '';
      });
    });

    /* Oculta únicamente cajas visuales de datos previos. */
    [
      'auroAntecedentesPreviosBox',
      'auroExamenFisicoPrevioBox',
      'auroDiagnosticosPreviosBox'
    ].forEach(function(id){
      const box = document.getElementById(id);
      if(box){
        box.style.display = 'none';
        const contenido = box.querySelector(
          '.auro-previos-content, .auro-previos-body, [data-previos-content]'
        );
        if(contenido) contenido.innerHTML = '';
      }
    });
  }

  function auroReiniciarAtencionParaHistoriaNueva(evento){
    const detalle = evento?.detail || {};
    const idPacienteNuevo = String(detalle.id_paciente || '').trim();

    /*
      Reinicio exclusivamente en memoria.
      No se toca localStorage ni Google Sheets.
    */
    const idAtencionAnterior = String(atencionActivaId || '').trim();
    consultasPaginaActual = 1;

    auroInvalidarContextoAtencion({
      idAnterior:idAtencionAnterior,
      idNueva:'',
      idPaciente:idPacienteNuevo,
      motivo:'historia_nueva',
      limpiarVisual:false
    });

    const activaBox = $('auroAtencionActivaBox');
    if(activaBox){
      activaBox.style.display = 'none';
      activaBox.innerHTML = '';
    }

    /*
      Limpieza inmediata y refuerzos posteriores.
      Los refuerzos son necesarios porque algunos módulos terminan de
      renderizarse de forma asíncrona después del cambio de paciente.
    */
    auroLimpiarCamposModulosConsultaNueva();
    setTimeout(auroLimpiarCamposModulosConsultaNueva, 180);
    setTimeout(auroLimpiarCamposModulosConsultaNueva, 650);

    /*
      Se invocan únicamente limpiadores públicos ya existentes.
      Si un módulo no expone función de limpieza, no se altera.
    */
    [
      'auroLimpiarPlanVisualAntesDeCambiarAtencion',
      'auroLimpiarDiagnosticos',
      'auroExamenFisicoLimpiarFormulario',
      'auroHistoriaLimpiarAnamnesisSinAtencionSeleccionada',
      'limpiarFormularioGinecologia',
      'limpiarFormularioObstetricia',
      'limpiarFormularioEstetica',
      'limpiarFormularioDocumentos'
    ].forEach(function(nombre){
      try{
        if(typeof window[nombre] === 'function'){
          window[nombre]();
        }
      }catch(error){
        console.warn(
          'AUROSANAX ATENCIONES: no se pudo ejecutar ' + nombre,
          error
        );
      }
    });

    /*
      Compatibilidad con Plan y Examen Físico:
      un id_atencion vacío representa que todavía no existe consulta nueva.
    */
    try{
      if(typeof window.cambiarPlanPorAtencion === 'function'){
        window.cambiarPlanPorAtencion('');
      }
    }catch(error){
      console.warn('AUROSANAX ATENCIONES: no se pudo reiniciar Plan.', error);
    }

    try{
      if(typeof window.cambiarExamenFisicoPorAtencion === 'function'){
        window.cambiarExamenFisicoPorAtencion('');
      }
    }catch(error){
      console.warn('AUROSANAX ATENCIONES: no se pudo reiniciar Examen Físico.', error);
    }

    setTimeout(function(){
      renderAtencionesPaciente();
    }, 220);
  }

  window.addEventListener(
    'aurosanax:historia-nueva',
    auroReiniciarAtencionParaHistoriaNueva
  );

  window.vincularHistoriaAAtencionActual = vincularHistoriaAAtencionActual;

  window.limpiarCacheAtencionesAurosanax = function(){
    try{
      localStorage.removeItem(STORAGE_KEY);
      atencionActivaId = '';
      atencionesSheetsCargadas = false;
      atencionesSheetsCargando = false;
      atencionesSheetsPromesa = null;
      atencionesPendientesPersistencia.clear();
      consultasPaginaActual = 1;

      return cargarAtencionesDesdeSheets(true).then(function(lista){
        renderAtencionesPaciente();
        return {
          success:true,
          message:'Caché de atenciones reconstruida desde Google Sheets.',
          total:Array.isArray(lista) ? lista.length : 0
        };
      });
    }catch(error){
      return Promise.resolve({
        success:false,
        message:error.message || String(error)
      });
    }
  };

  window.sincronizarAtencionesLocales = async function(){
    const lista = leerLocal();
    if(!lista.length){
      alert('No hay atenciones locales para sincronizar.');
      return;
    }

    let ok = 0;
    let fail = 0;

    for(const item of lista){
      const r = await enviarAtencionGoogleSheets(normalizar(item));
      if(r && r.success) ok++;
      else fail++;
    }

    alert('Sincronización terminada. Enviadas: ' + ok + '. Fallidas: ' + fail + '.');
  };

  window.renderAtencionesPaciente = renderAtencionesPaciente;
  window.cargarAtencionesDesdeSheets = cargarAtencionesDesdeSheets;
  window.cargarRecetasDesdeSheetsAtenciones = cargarRecetasDesdeSheetsAtenciones;
  window.refrescarRecetasAtencionesDesdeSheets = function(){
    return cargarRecetasDesdeSheetsAtenciones(true).then(function(){
      renderAtencionesPaciente();
      return leerRecetasLocales();
    });
  };
  window.refrescarAtencionesDesdeSheets = function(){
    return cargarAtencionesDesdeSheets(true).then(function(){
      renderAtencionesPaciente();
      return leerLocal();
    });
  };

  window.refrescarMedicosAtenciones = function(){
    return cargarMedicosActivosAtenciones(true).then(function(lista){
      renderAtencionesPaciente();
      return lista;
    });
  };
  window.iniciarAtencionActual = crearAtencion;
  window.finalizarAtencionActual = finalizarAtencion;
  window.seleccionarAtencion = seleccionarAtencion;
  window.sincronizarContextoAtencion = sincronizarContextoAtencion;
  window.getAtencionActiva = function(){
    if(!atencionActivaId) return null;
    return leerLocal().find(a => String(a.id_atencion) === String(atencionActivaId)) || null;
  };
  window.getIdAtencionActiva = function(){
    const a = window.getAtencionActiva();
    return a ? a.id_atencion : '';
  };

  window.getContextoAtencionEpoch = function(){
    return contextoAtencionEpoch;
  };


  /* =====================================================
     AUROSANAX - ENRIQUECIMIENTO DE CONTEXTO EN MEMORIA
     Alcance estrictamente aditivo:
     - No modifica la hoja atenciones.
     - No agrega ni mueve columnas.
     - No altera crear, finalizar, guardar ni sincronizar atenciones.
     - Resuelve datos descriptivos desde los catálogos ya cargados.
     - El servicio solicitado es orientativo y nunca bloquea la atención.
  ===================================================== */

  function auroContextoListaMedicos(){
    if(Array.isArray(medicosActivosAtenciones) && medicosActivosAtenciones.length){
      return medicosActivosAtenciones;
    }

    if(Array.isArray(window.medicosAgendaWeb) && window.medicosAgendaWeb.length){
      return window.medicosAgendaWeb;
    }

    if(Array.isArray(window.medicos) && window.medicos.length){
      return window.medicos;
    }

    return [];
  }

  function auroContextoResolverMedico(idMedico){
    const id = String(idMedico || '').trim();
    const lista = auroContextoListaMedicos();

    const encontrado = lista.find(function(m){
      return idMedicoRegistro(m) === id;
    }) || null;

    if(!encontrado){
      return {
        id_medico: id,
        nombre_medico: '',
        especialidad_medico: ''
      };
    }

    return {
      id_medico: id || idMedicoRegistro(encontrado),
      nombre_medico: nombreCompletoMedico(encontrado),
      especialidad_medico: String(
        encontrado.especialidad_principal ||
        encontrado.especialidad ||
        encontrado.nombre_especialidad ||
        ''
      ).trim()
    };
  }

  function auroContextoBuscarCitaPorId(idCita){
    const id = String(idCita || '').trim();
    if(!id) return null;

    const fuentes = [];

    if(Array.isArray(window.citasAgendaWeb)){
      fuentes.push.apply(fuentes, window.citasAgendaWeb);
    }

    const seleccionada = leerCitaSeleccionadaAgenda();
    if(seleccionada && typeof seleccionada === 'object'){
      fuentes.push(seleccionada);
    }

    return fuentes.find(function(cita){
      const cid = String(
        cita?.id_cita ||
        cita?.id ||
        cita?.id_cita_web ||
        cita?.fila_origen ||
        ''
      ).trim();

      return cid === id;
    }) || null;
  }

  function auroContextoListaServicios(){
    const posibles = [
      window.serviciosAgendaWeb,
      window.serviciosActivos,
      window.servicios
    ];

    for(let i = 0; i < posibles.length; i++){
      if(Array.isArray(posibles[i]) && posibles[i].length){
        return posibles[i];
      }
    }

    return [];
  }

  function auroContextoIdServicio(servicio){
    return String(
      servicio?.id_servicio ||
      servicio?.id ||
      servicio?.codigo ||
      ''
    ).trim();
  }

  function auroContextoNombreServicio(servicio){
    return String(
      servicio?.nombre_servicio ||
      servicio?.servicio ||
      servicio?.nombre ||
      ''
    ).trim();
  }

  function auroContextoEspecialidadServicio(servicio){
    return String(
      servicio?.especialidad ||
      servicio?.nombre_especialidad ||
      servicio?.id_especialidad ||
      ''
    ).trim();
  }

  function auroContextoResolverServicioSolicitado(atencion){
    const salida = {
      id_servicio_solicitado: '',
      nombre_servicio_solicitado: '',
      especialidad_servicio_solicitado: '',
      servicio_origen: '',
      servicio_confirmado: false
    };

    const cita = auroContextoBuscarCitaPorId(atencion?.id_cita);
    if(!cita) return salida;

    salida.servicio_origen = 'cita';

    const idServicioCita = String(
      cita.id_servicio ||
      cita.servicio_id ||
      ''
    ).trim();

    const textoServicioCita = String(
      cita.nombre_servicio ||
      cita.servicio ||
      cita.tipo_cita ||
      cita.motivo ||
      ''
    ).trim();

    const listaServicios = auroContextoListaServicios();
    let servicio = null;

    if(idServicioCita){
      servicio = listaServicios.find(function(item){
        return auroContextoIdServicio(item) === idServicioCita;
      }) || null;
    }

    if(!servicio && textoServicioCita){
      const buscado = normalizarTextoSimple(textoServicioCita);

      servicio = listaServicios.find(function(item){
        const nombre = normalizarTextoSimple(auroContextoNombreServicio(item));
        return nombre && (
          nombre === buscado ||
          nombre.includes(buscado) ||
          buscado.includes(nombre)
        );
      }) || null;
    }

    if(servicio){
      salida.id_servicio_solicitado = auroContextoIdServicio(servicio);
      salida.nombre_servicio_solicitado = auroContextoNombreServicio(servicio);
      salida.especialidad_servicio_solicitado = auroContextoEspecialidadServicio(servicio);
      return salida;
    }

    /*
      Tolerancia deliberada:
      Si la cita contiene un texto libre que no coincide con el catálogo,
      se conserva como referencia sin bloquear ni convertirlo en dato confirmado.
    */
    salida.id_servicio_solicitado = idServicioCita;
    salida.nombre_servicio_solicitado = textoServicioCita;
    salida.especialidad_servicio_solicitado = String(
      cita.especialidad ||
      cita.nombre_especialidad ||
      cita.id_especialidad ||
      ''
    ).trim();

    return salida;
  }

  /* =====================================================
     AUROSANAX - CONTEXTO CLÍNICO CENTRAL COMPATIBLE
     Intervención quirúrgica y aditiva.

     OBJETIVO:
     - Entregar a Plan, Recetas, Diagnósticos y Examen Físico
       una referencia única de la atención actualmente seleccionada.
     - Conservar el flujo desde Agenda y el flujo manual sin cita.
     - No reemplazar ni eliminar variables, eventos o funciones existentes.

     REGLA:
     - id_cita es opcional.
     - id_atencion, id_paciente, id_historia e id_medico se informan
       exactamente como están registrados en la atención activa.
  ===================================================== */
  window.obtenerContextoAtencionActual = function(){
    try{
      const atencion = typeof window.getAtencionActiva === 'function'
        ? window.getAtencionActiva()
        : null;

      if(!atencion || !String(atencion.id_atencion || '').trim()){
        return null;
      }

      const idPacienteContexto = String(atencion.id_paciente || '').trim();
      const idPacienteVisible = String(idPacienteActivo() || '').trim();
      const idHistoriaContexto = String(atencion.id_historia || '').trim();

      if(
        idPacienteVisible &&
        idPacienteContexto &&
        idPacienteVisible !== idPacienteContexto
      ){
        return null;
      }

      if(
        idHistoriaContexto &&
        idPacienteContexto &&
        auroEstadoPertenenciaHistoria(idHistoriaContexto, idPacienteContexto) === false
      ){
        return null;
      }

      const medico = auroContextoResolverMedico(atencion.id_medico);
      const servicio = auroContextoResolverServicioSolicitado(atencion);

      const contexto = {
        id_atencion: String(atencion.id_atencion || '').trim(),
        id_paciente: String(atencion.id_paciente || '').trim(),
        id_historia: String(atencion.id_historia || '').trim(),
        id_cita: String(atencion.id_cita || '').trim(),
        id_medico: String(atencion.id_medico || '').trim(),

        /*
          Campos descriptivos calculados en memoria.
          No forman parte del payload de guardarAtencion.
        */
        nombre_medico: String(medico.nombre_medico || '').trim(),
        especialidad_medico: String(medico.especialidad_medico || '').trim(),

        /*
          Servicio solicitado:
          - Es orientativo.
          - Puede provenir de la cita o de texto libre.
          - Nunca bloquea la atención.
          - No se considera servicio confirmado.
        */
        id_servicio_solicitado: String(servicio.id_servicio_solicitado || '').trim(),
        nombre_servicio_solicitado: String(servicio.nombre_servicio_solicitado || '').trim(),
        especialidad_servicio_solicitado: String(servicio.especialidad_servicio_solicitado || '').trim(),
        servicio_origen: String(servicio.servicio_origen || '').trim(),
        servicio_confirmado: Boolean(servicio.servicio_confirmado),

        /*
          Especialidad clínica visible:
          prioriza la del servicio cuando existe; de lo contrario usa
          la especialidad principal configurada del médico.
        */
        especialidad_atencion: String(
          servicio.especialidad_servicio_solicitado ||
          medico.especialidad_medico ||
          ''
        ).trim(),

        numero_consulta: Number(atencion.numero_consulta || 0),
        fecha_atencion: String(atencion.fecha_atencion || '').trim(),
        hora_atencion: String(atencion.hora_atencion || '').trim(),
        tipo_atencion: String(atencion.tipo_atencion || '').trim(),
        estado_atencion: String(atencion.estado_atencion || '').trim(),
        origen_atencion: String(atencion.id_cita || '').trim() ? 'agenda' : 'manual'
      };

      return Object.freeze(contexto);
    }catch(error){
      console.warn(MODULO, 'No se pudo obtener el contexto de la atención actual.', error);
      return null;
    }
  };

  /* Alias descriptivo para integración gradual, sin retirar compatibilidad. */
  window.getContextoAtencionActual = window.obtenerContextoAtencionActual;

  /* Diagnóstico de solo lectura para pruebas controladas. */
  window.validarContextoAtencionActual = function(){
    const contexto = window.obtenerContextoAtencionActual();

    if(!contexto){
      return {
        valido:false,
        motivo:'No existe una atención activa seleccionada.',
        contexto:null,
        faltantes:['id_atencion']
      };
    }

    const requeridos = ['id_atencion','id_paciente','id_historia','id_medico'];
    const faltantes = requeridos.filter(function(campo){
      return !String(contexto[campo] || '').trim();
    });

    return {
      valido:faltantes.length === 0,
      motivo:faltantes.length
        ? 'La atención activa tiene identificadores clínicos pendientes.'
        : 'Contexto clínico válido.',
      contexto:contexto,
      faltantes:faltantes,
      admite_agenda:Boolean(contexto.id_cita),
      admite_atencion_manual:!contexto.id_cita
    };
  };
  window.__recetasPorAtencionDebug = function(idAtencion){
    const a = leerLocal().find(x => String(x.id_atencion) === String(idAtencion));
    return recetasPorAtencion(a ? normalizar(a) : null);
  };

  window.__recetasAtencionActualDebug = function(){
    const a = window.getAtencionActiva ? window.getAtencionActiva() : null;
    return {
      id_atencion_actual: a ? a.id_atencion : '',
      atencion: a,
      recetas_de_esta_atencion: a ? recetasPorAtencion(normalizar(a)) : [],
      total_recetas_locales: leerRecetasLocales().length
    };
  };

  window.__atencionesAurosanaxDebug = function(){
    return {
      modulo: MODULO,
      total: leerLocal().length,
      paciente_activo: idPacienteActivo(),
      sheets_cargadas: atencionesSheetsCargadas,
      sheets_cargando: atencionesSheetsCargando,
      sheets_promesa_activa: Boolean(atencionesSheetsPromesa),
      atenciones_pendientes_persistencia: atencionesPendientesPersistencia.size,
      recetas_sheets_cargadas: recetasSheetsCargadas,
      recetas_sheets_cargando: recetasSheetsCargando,
      recetas_locales: leerRecetasLocales().length,
      medicos_activos_cargados: medicosActivosCargados,
      medicos_activos: medicosActivosAtenciones.length,
      cita_agenda_seleccionada: leerCitaSeleccionadaAgenda(),
      atencion_activa: window.getAtencionActiva(),
      contexto_epoch: contextoAtencionEpoch
    };
  };

})();

/* =====================================================
   AUROSANAX ATENCIONES - CORRECCIÓN DEFINITIVA
   - Aislamiento estricto por id_paciente
   - Google Sheets tiene prioridad sobre localStorage
   - No reutiliza automáticamente historias antiguas
   - Permite vincular id_historia después de crear la atención
   - Bloquea atención de otro paciente
===================================================== */
