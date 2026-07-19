/***********************************************************************
 AUROSANAX ERP DEMO
 Archivo: diagnosticos.js
 Módulo: Diagnósticos e integración clínica por atención
 Versión: 1.5.0 FASE 1 - motor universal de redacción clínica premium
 Fecha: 2026-07-19
 -----------------------------------------------------------------------
 OBJETIVO
 - Leer los diagnósticos ya registrados desde Examen Físico.
 - Trabajar exclusivamente por id_atencion.
 - Consultar el detalle clínico y protocolos existentes en Apps Script.
 - Integrar información visible de la atención sin modificar otros módulos.
 - Mostrar sugerencias para revisión médica.
 - Aplicar al Plan únicamente por acción expresa del usuario.

 REGLAS DE SEGURIDAD
 - NO elimina ni modifica funciones de examenfisico.js.
 - NO sobrescribe plan.js, atenciones.js, ginecologia.js u obstetricia.js.
 - NO prescribe ni guarda automáticamente.
 - NO aplica protocolos automáticamente.
 - Si falta un módulo, continúa funcionando con degradación segura.
 - Cada atención conserva su estado independiente.
 - FASE 1: mejora exclusiva de redacción, interpretación y agrupación clínica.
 - La adaptación avanzada por especialidad y el conector IA quedan para FASE 2.
************************************************************************/

(function(){
  'use strict';

  if(
    window.auroDiagnosticosModuloCargado &&
    window.auroDiagnosticos &&
    typeof window.auroDiagnosticos.inicializar === 'function'
  ){
    console.warn('AUROSANAX DIAGNÓSTICOS: el módulo completo ya estaba cargado.');
    window.auroDiagnosticos.inicializar();
    return;
  }

  /* Recuperación ante una carga anterior incompleta o interrumpida. */
  window.auroDiagnosticosModuloCargado = false;

  const MODULO = 'AUROSANAX DIAGNÓSTICOS';
  const VERSION = '1.5.0-fase1';

  const state = window.auroDiagnosticosState = window.auroDiagnosticosState || {
    atencionActual: '',
    diagnosticos: [],
    detalleExamen: null,
    historia: null,
    especialidades: {},
    protocolos: [],
    protocoloSeleccionado: null,
    resumenClinico: '',
    analisisClinico: '',
    conducta: '',
    cache: {},
    cargando: false,
    inicializado: false,
    ultimaActualizacion: '',
    modoEdicion: false,
    cambiosPendientes: false,
    guardadoTemporalConfirmado: false,
    ultimaEdicionLocal: ''
  };

  const IDS_PANEL_CANDIDATOS = [
    'hc_diagnosticos',
    'hc_diagnostico',
    'diagnosticos',
    'diagnostico',
    'panelDiagnosticos',
    'tabDiagnosticos',
    'hcDiagnosticosPanel'
  ];

  const IDS_PLAN = {
    planTratamiento: ['hcPlanTratamiento','hcPlanTerapeutico','hcPlan'],
    indicaciones: ['hcIndicacionesPaciente','hcIndicaciones','hcRecomendaciones'],
    control: ['hcProximoControl','hcControl','hcSeguimiento'],
    observaciones: ['hcObservacionesPlan','hcObservaciones']
  };

  function texto(valor){
    return String(valor === null || valor === undefined ? '' : valor).trim();
  }

  function normalizar(valor){
    return texto(valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/\s+/g,' ')
      .trim();
  }

  function escapeHtml(valor){
    return String(valor || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function clonar(valor, fallback){
    try{
      return JSON.parse(JSON.stringify(valor));
    }catch(e){
      return fallback;
    }
  }

  function arraySeguro(valor){
    if(Array.isArray(valor)) return valor;
    if(valor && Array.isArray(valor.data)) return valor.data;
    if(valor && Array.isArray(valor.registros)) return valor.registros;
    if(valor && Array.isArray(valor.resultado)) return valor.resultado;
    return [];
  }

  function parseJsonSeguro(valor, fallback){
    if(Array.isArray(valor) || (valor && typeof valor === 'object')) return valor;
    const raw = texto(valor);
    if(!raw) return fallback;
    try{
      return JSON.parse(raw);
    }catch(e){
      return fallback;
    }
  }

  function apiUrl(){
    try{
      if(typeof API_URL !== 'undefined' && API_URL) return texto(API_URL);
    }catch(e){}
    if(window.API_URL) return texto(window.API_URL);
    const input = document.getElementById('appsScriptUrl');
    return input ? texto(input.value) : '';
  }

  async function getJSON(accion, parametros){
    const API = apiUrl();
    if(!API) throw new Error('API_URL no está definida.');

    const query = new URLSearchParams({accion: accion});
    Object.keys(parametros || {}).forEach(k => {
      const v = parametros[k];
      if(v !== undefined && v !== null && texto(v)){
        query.append(k, v);
      }
    });

    const respuesta = await fetch(API + '?' + query.toString() + '&_=' + Date.now(), {
      method: 'GET',
      cache: 'no-store'
    });

    if(!respuesta.ok){
      throw new Error('Error HTTP ' + respuesta.status + ' al ejecutar ' + accion);
    }

    return await respuesta.json();
  }

  function getValue(id){
    try{
      if(typeof window.getValueIfExists === 'function'){
        return texto(window.getValueIfExists(id));
      }
    }catch(e){}
    const el = document.getElementById(id);
    return el ? texto(el.value) : '';
  }

  function setValue(id, valor, anexar){
    const el = document.getElementById(id);
    if(!el) return false;

    const nuevo = texto(valor);
    if(!nuevo) return false;

    if(anexar && texto(el.value)){
      const actual = texto(el.value);
      if(!normalizar(actual).includes(normalizar(nuevo))){
        el.value = actual + '\n' + nuevo;
      }
    }else{
      el.value = nuevo;
    }

    el.dispatchEvent(new Event('input', {bubbles:true}));
    el.dispatchEvent(new Event('change', {bubbles:true}));
    return true;
  }

  function setPrimerCampo(ids, valor, anexar){
    for(const id of ids || []){
      if(document.getElementById(id)){
        return setValue(id, valor, anexar);
      }
    }
    return false;
  }

  function atencionActiva(){
    try{
      if(typeof window.getAtencionActiva === 'function'){
        const a = window.getAtencionActiva();
        if(a && a.id_atencion) return a;
      }
    }catch(e){}

    try{
      if(window.atencionesState && window.atencionesState.atencionActual){
        return window.atencionesState.atencionActual;
      }
    }catch(e){}

    /* Respaldo real usado por Atenciones/Plan/Examen Físico. */
    try{
      const id = texto(
        window.examenFisicoState?.atencionActual ||
        window.planState?.atencionActual ||
        state.atencionActual
      );
      if(id){
        const raw = localStorage.getItem('aurosanax_atenciones_local_v1');
        const lista = raw ? JSON.parse(raw) : [];
        if(Array.isArray(lista)){
          const encontrada = lista.find(a => texto(a?.id_atencion) === id);
          if(encontrada) return encontrada;
        }
      }
    }catch(e){}

    return null;
  }

  function idAtencionActiva(){
    try{
      if(typeof window.getIdAtencionActiva === 'function'){
        const id = texto(window.getIdAtencionActiva());
        if(id) return id;
      }
    }catch(e){}

    const a = atencionActiva();
    if(a && a.id_atencion) return texto(a.id_atencion);

    return texto(
      window.examenFisicoState?.atencionActual ||
      window.planState?.atencionActual ||
      state.atencionActual
    );
  }

  function idPacienteActual(){
    const a = atencionActiva() || {};
    return texto(
      a.id_paciente ||
      document.getElementById('hcPacienteSelect')?.value ||
      window.activePatientId ||
      window.historiaActual?.id_paciente ||
      window.currentHistoria?.id_paciente
    );
  }

  function diagnosticosLocales(){
    let lista = [];

    try{
      if(Array.isArray(window.hcDiagnosticosSeleccionados)){
        lista = clonar(window.hcDiagnosticosSeleccionados, []);
      }
    }catch(e){}

    return lista.map((d, i) => ({
      id_diagnostico: texto(d.id_diagnostico),
      codigo_cie10: texto(d.codigo_cie10 || d.codigo || d.cie10).replace(/\./g,'').toUpperCase(),
      descripcion: texto(d.descripcion || d.nombre),
      principal: d.principal === true || normalizar(d.principal) === 'si' || i === 0,
      tipo_diagnostico: texto(d.tipo_diagnostico || d.tipo || 'Presuntivo'),
      estado: texto(d.estado || 'Activo'),
      origen: 'Examen Físico'
    })).filter(d => d.codigo_cie10 || d.descripcion);
  }

  function normalizarDiagnosticosServidor(data){
    return arraySeguro(data).map((d, i) => ({
      id_diagnostico: texto(d.id_diagnostico),
      id_atencion: texto(d.id_atencion),
      id_examen: texto(d.id_examen),
      codigo_cie10: texto(d.codigo_cie10 || d.codigo || d.cie10).replace(/\./g,'').toUpperCase(),
      descripcion: texto(d.descripcion || d.nombre || d.diagnostico),
      principal: d.principal === true || normalizar(d.principal) === 'si' || normalizar(d.principal) === 'true',
      tipo_diagnostico: texto(d.tipo_diagnostico || d.tipo || 'Presuntivo'),
      estado: texto(d.estado || 'Activo'),
      observaciones: texto(d.observaciones),
      origen: 'Google Sheets'
    })).filter(d => {
      const activo = !d.estado || ['activo','activa','si','true'].includes(normalizar(d.estado));
      return activo && (d.codigo_cie10 || d.descripcion);
    }).map((d, i, arr) => {
      if(!arr.some(x => x.principal) && i === 0) d.principal = true;
      return d;
    });
  }

  function fusionarDiagnosticos(servidor, locales){
    const salida = [];
    const claves = new Set();

    [...(servidor || []), ...(locales || [])].forEach(d => {
      const clave = normalizar((d.codigo_cie10 || '') + '|' + (d.descripcion || ''));
      if(!clave || claves.has(clave)) return;
      claves.add(clave);
      salida.push(d);
    });

    if(salida.length && !salida.some(d => d.principal)){
      salida[0].principal = true;
    }

    return salida;
  }

  function buscarPanelExistente(){
    for(const id of IDS_PANEL_CANDIDATOS){
      const el = document.getElementById(id);
      if(el) return el;
    }

    const candidatos = Array.from(document.querySelectorAll(
      '.tab-pane, .clinical-panel, .clinical-section, section, [role="tabpanel"]'
    ));

    return candidatos.find(el => {
      const titulo = el.querySelector('h1,h2,h3,h4,.clinical-title,.clinical-subtitle,.section-title');
      return titulo && normalizar(titulo.textContent).includes('diagnost');
    }) || null;
  }

  function asegurarPanel(){
    let panel = buscarPanelExistente();
    if(panel) return panel;

    const examen = document.getElementById('hc_examen');
    if(!examen || !examen.parentNode) return null;

    panel = document.createElement('section');
    panel.id = 'hc_diagnosticos';
    panel.className = 'clinical-panel tab-pane';
    panel.dataset.auroCreado = '1';
    panel.style.display = 'none';
    examen.parentNode.insertBefore(panel, examen.nextSibling);
    return panel;
  }

  function instalarEstilos(){
    if(document.getElementById('auroDiagnosticosStyles')) return;

    const style = document.createElement('style');
    style.id = 'auroDiagnosticosStyles';
    style.textContent = `
      #auroDiagnosticosApp{font-family:inherit;color:#263238}
      #auroDiagnosticosApp *{box-sizing:border-box}
      .auro-dx-shell{display:grid;gap:14px}
      .auro-dx-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:16px;border:1px solid #dbe6e8;border-radius:16px;background:linear-gradient(135deg,#ffffff,#f5fbfb)}
      .auro-dx-head h3{margin:0;font-size:20px}
      .auro-dx-head p{margin:5px 0 0;color:#62767b;font-size:13px}
      .auro-dx-status{font-size:12px;padding:7px 10px;border-radius:999px;background:#edf7f7;color:#28626a;white-space:nowrap;max-width:100%;overflow-wrap:anywhere}
      .auro-dx-toolbar{display:flex;flex-wrap:wrap;gap:8px}
      .auro-dx-btn{border:0;border-radius:10px;padding:9px 13px;font-weight:700;cursor:pointer;background:#eef4f5;color:#29474b}
      .auro-dx-btn.primary{background:#1d6670;color:#fff}
      .auro-dx-btn.success{background:#287c57;color:#fff}
      .auro-dx-btn:disabled{opacity:.55;cursor:not-allowed}
      .auro-dx-grid{display:grid;grid-template-columns:minmax(280px,.9fr) minmax(360px,1.4fr);gap:14px}
      .auro-dx-card{border:1px solid #dce7e9;border-radius:16px;background:#fff;overflow:hidden}
      .auro-dx-card-head{padding:12px 14px;border-bottom:1px solid #e4edef;background:#f8fbfb;font-weight:800}
      .auro-dx-card-body{padding:14px}
      .auro-dx-empty{padding:20px;text-align:center;color:#76888c;border:1px dashed #ccd9dc;border-radius:12px}
      .auro-dx-item{padding:11px;border:1px solid #dfe9eb;border-radius:12px;margin-bottom:8px}
      .auro-dx-item:last-child{margin-bottom:0}
      .auro-dx-item-main{display:flex;gap:8px;align-items:flex-start}
      .auro-dx-code{font-weight:900;color:#1d6670;min-width:54px}
      .auro-dx-name{font-weight:700;line-height:1.35}
      .auro-dx-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}
      .auro-dx-tag{font-size:10px;padding:4px 7px;border-radius:999px;background:#edf4f5;color:#52676b}
      .auro-dx-tag.principal{background:#dff3ea;color:#256146}
      .auro-dx-textarea{width:100%;min-height:112px;resize:vertical;border:1px solid #cedbdd;border-radius:12px;padding:11px;font:inherit;line-height:1.45}
      .auro-dx-section{margin-top:12px}
      .auro-dx-section:first-child{margin-top:0}
      .auro-dx-label{display:block;font-weight:800;font-size:12px;margin-bottom:6px;color:#42575b}
      .auro-dx-protocolo{border:1px solid #dce7e9;border-radius:13px;padding:12px;margin-bottom:10px}
      .auro-dx-protocolo.selected{border-color:#1d6670;box-shadow:0 0 0 2px rgba(29,102,112,.09)}
      .auro-dx-protocolo h5{margin:0 0 5px;font-size:14px}
      .auro-dx-protocolo small{color:#718287}
      .auro-dx-list{margin:7px 0 0;padding-left:18px}
      .auro-dx-warning{padding:10px 12px;border-radius:12px;background:#fff8e7;color:#77591c;font-size:12px}
      .auro-dx-error{padding:10px 12px;border-radius:12px;background:#fff0f0;color:#8a3030;font-size:12px}
      .auro-dx-ok{padding:10px 12px;border-radius:12px;background:#eaf8f0;color:#286043;font-size:12px}
      .auro-dx-source{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .auro-dx-source-item{padding:11px;border-radius:12px;border:1px solid #e2e8f0;background:#f8fafc;font-size:12px}
      .auro-dx-source-item.available{border-color:#bbf7d0;background:#f0fdf4}
      .auro-dx-source-item.missing{border-color:#e2e8f0;background:#f8fafc}
      .auro-dx-source-state{display:flex;align-items:center;gap:6px;margin-top:4px;font-weight:800}
      .auro-dx-source-item.available .auro-dx-source-state{color:#166534}
      .auro-dx-source-item.missing .auro-dx-source-state{color:#64748b}
      .auro-dx-card-help{font-size:12px;color:#64748b;font-weight:500;margin-top:3px}
      .auro-dx-field-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:6px}
      .auro-dx-field-actions{display:flex;gap:6px;flex-wrap:wrap}
      .auro-dx-mini-btn{border:1px solid #dbe5e7;background:#fff;color:#42575b;border-radius:9px;padding:5px 8px;font-size:11px;font-weight:800;cursor:pointer}
      .auro-dx-mini-btn:hover{background:#f2f7f8}
      .auro-dx-guide{display:none;padding:10px 12px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:12px;line-height:1.4}
      #auroDiagnosticosApp.guide-on .auro-dx-guide{display:block}
      .auro-dx-modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.58);display:none;align-items:center;justify-content:center;padding:18px;z-index:99999}
      .auro-dx-modal-backdrop.show{display:flex}
      .auro-dx-modal{width:min(980px,100%);max-height:90vh;background:#fff;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden}
      .auro-dx-modal-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px 18px;border-bottom:1px solid #e5e7eb}
      .auro-dx-modal-head h4{margin:0;font-size:18px}
      .auro-dx-modal-body{padding:18px;overflow:auto}
      .auro-dx-modal-body textarea{width:100%;min-height:52vh;resize:vertical;border:1px solid #cbd5e1;border-radius:14px;padding:14px;font:inherit;line-height:1.5}
      .auro-dx-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:13px 18px;border-top:1px solid #e5e7eb}
      @media(max-width:900px){.auro-dx-grid{grid-template-columns:1fr}.auro-dx-source{grid-template-columns:1fr}.auro-dx-head{flex-direction:column}.auro-dx-field-head{align-items:flex-start;flex-direction:column}}

      @media(max-width:600px){
        html,body{
          max-width:100%;
          overflow-x:hidden;
        }
        #hc_diagnostico,
        #auroDiagnosticosMount,
        #auroDiagnosticosApp,
        .auro-dx-shell{
          width:100%!important;
          max-width:100%!important;
          min-width:0!important;
          overflow-x:hidden!important;
        }
        .auro-dx-shell{gap:10px}
        .auro-dx-head{
          display:block;
          padding:12px;
          border-radius:14px;
        }
        .auro-dx-head h3{
          font-size:18px;
          line-height:1.25;
        }
        .auro-dx-head p{
          font-size:12px;
          line-height:1.4;
          overflow-wrap:anywhere;
        }
        .auro-dx-status{
          display:block;
          width:100%;
          max-width:100%;
          margin-top:10px;
          white-space:normal;
          overflow-wrap:anywhere;
          line-height:1.35;
          text-align:left;
          border-radius:12px;
        }
        .auro-dx-toolbar{
          display:grid;
          grid-template-columns:1fr;
          gap:8px;
          width:100%;
        }
        .auro-dx-btn{
          width:100%;
          min-width:0;
          min-height:46px;
          padding:10px 12px;
          font-size:15px;
          white-space:normal;
          line-height:1.25;
          text-align:center;
        }
        .auro-dx-grid{
          grid-template-columns:1fr!important;
          gap:10px;
        }
        .auro-dx-card{
          width:100%;
          min-width:0;
          border-radius:14px;
        }
        .auro-dx-card-head{
          padding:11px 12px;
          font-size:14px;
          line-height:1.35;
          overflow-wrap:anywhere;
        }
        .auro-dx-card-help{
          font-size:11px;
          line-height:1.35;
        }
        .auro-dx-card-body{
          padding:11px;
          min-width:0;
        }
        .auro-dx-item{
          padding:10px;
          min-width:0;
        }
        .auro-dx-item-main{
          display:grid;
          grid-template-columns:auto minmax(0,1fr);
          gap:8px;
        }
        .auro-dx-code{min-width:0}
        .auro-dx-name{
          min-width:0;
          overflow-wrap:anywhere;
        }
        .auro-dx-field-head{
          display:block;
          margin-bottom:8px;
        }
        .auro-dx-field-actions{
          display:grid;
          grid-template-columns:1fr 1fr;
          width:100%;
          margin-top:7px;
        }
        .auro-dx-mini-btn{
          width:100%;
          min-height:40px;
          font-size:12px;
        }
        .auro-dx-textarea,
        .auro-dx-modal-body textarea{
          width:100%;
          min-width:0;
          max-width:100%;
          font-size:16px!important;
          line-height:1.45;
        }
        .auro-dx-textarea{min-height:140px}
        .auro-dx-source{
          grid-template-columns:1fr!important;
          gap:7px;
        }
        .auro-dx-source-item{padding:10px}
        .auro-dx-source-state{
          align-items:flex-start;
          line-height:1.35;
        }
        .auro-dx-protocolo{
          padding:10px;
          overflow-wrap:anywhere;
        }
        .auro-dx-protocolo > div:first-child{
          display:block!important;
        }
        .auro-dx-protocolo [data-seleccionar-protocolo]{
          width:100%;
          margin-top:9px;
        }
        .auro-dx-list{
          padding-left:20px;
          overflow-wrap:anywhere;
        }
        .auro-dx-warning,
        .auro-dx-guide,
        .auro-dx-error,
        .auro-dx-ok{
          font-size:12px;
          line-height:1.45;
          overflow-wrap:anywhere;
        }
        .auro-dx-modal-backdrop{
          padding:0;
          align-items:flex-end;
        }
        .auro-dx-modal{
          width:100%;
          max-width:100%;
          max-height:94dvh;
          border-radius:18px 18px 0 0;
        }
        .auro-dx-modal-head{
          padding:12px;
          align-items:flex-start;
        }
        .auro-dx-modal-head h4{
          font-size:17px;
          line-height:1.3;
        }
        .auro-dx-modal-body{padding:12px}
        .auro-dx-modal-body textarea{min-height:56dvh}
        .auro-dx-modal-foot{
          display:grid;
          grid-template-columns:1fr;
          padding:10px 12px calc(10px + env(safe-area-inset-bottom));
        }
        .auro-dx-modal-foot .auro-dx-btn{width:100%}
      }
    `;
    document.head.appendChild(style);
  }

  function appHTML(){
    return `
      <div class="auro-dx-shell">
        <div class="auro-dx-head">
          <div>
            <h3><i class="bi bi-clipboard2-pulse"></i> Diagnósticos</h3>
            <p>Reúne la información de la consulta, genera un análisis clínico editable y permite transferir un protocolo al Plan.</p>
          </div>
          <div class="auro-dx-status" id="auroDxStatus">Sin atención activa</div>
        </div>

        <div class="auro-dx-toolbar">
          <button type="button" class="auro-dx-btn primary" id="auroDxActualizar" title="Vuelve a leer los datos guardados de esta atención">
            <i class="bi bi-arrow-repeat"></i> Sincronizar datos
          </button>
          <button type="button" class="auro-dx-btn" id="auroDxGenerar" title="Construye el resumen, análisis y conducta con los datos disponibles">
            <i class="bi bi-stars"></i> Generar integración clínica
          </button>
          <button type="button" class="auro-dx-btn" id="auroDxEditar" disabled title="Habilita la revisión y edición médica de la integración">
            <i class="bi bi-pencil-square"></i> Editar integración
          </button>
          <button type="button" class="auro-dx-btn" id="auroDxGuardar" disabled title="Confirma los cambios únicamente en el estado temporal de esta atención">
            <i class="bi bi-save2"></i> Guardar temporalmente
          </button>
          <button type="button" class="auro-dx-btn success" id="auroDxAplicarPlan" disabled title="Transfiere el protocolo seleccionado al módulo Plan">
            <i class="bi bi-check2-circle"></i> Aplicar protocolo al Plan
          </button>
          <button type="button" class="auro-dx-btn" id="auroDxGuia" aria-pressed="false">
            <i class="bi bi-question-circle"></i> Activar guía
          </button>
        </div>

        <div class="auro-dx-guide">
          <b>Flujo recomendado:</b> sincronice los datos, genere la integración clínica, revise o edite los textos y, finalmente, aplique el protocolo seleccionado al Plan.
        </div>

        <div id="auroDxMensaje"></div>

        <div class="auro-dx-grid">
          <div class="auro-dx-card">
            <div class="auro-dx-card-head">
              Diagnósticos de la atención
              <div class="auro-dx-card-help">Provienen del Examen físico y están vinculados a la consulta activa.</div>
            </div>
            <div class="auro-dx-card-body" id="auroDxLista"></div>
          </div>

          <div class="auro-dx-card">
            <div class="auro-dx-card-head">
              Integración clínica
              <div class="auro-dx-card-help">La integración se genera en modo protegido. Presione “Editar integración” para revisión médica. El guardado disponible es temporal y no modifica Google Sheets.</div>
              <div class="auro-dx-card-help" id="auroDxEdicionEstado">Sin integración generada.</div>
            </div>
            <div class="auro-dx-card-body">
              <div class="auro-dx-section">
                <div class="auro-dx-field-head">
                  <label class="auro-dx-label" for="auroDxResumen">Resumen clínico integrado</label>
                  <div class="auro-dx-field-actions">
                    <button type="button" class="auro-dx-mini-btn" data-copy-field="auroDxResumen"><i class="bi bi-clipboard"></i> Copiar</button>
                    <button type="button" class="auro-dx-mini-btn" data-expand-field="auroDxResumen" data-title="Resumen clínico integrado"><i class="bi bi-arrows-fullscreen"></i> Ampliar</button>
                  </div>
                </div>
                <div class="auro-dx-guide">Describe de forma objetiva los datos relevantes de la consulta: motivo, antecedentes, hallazgos y diagnósticos.</div>
                <textarea id="auroDxResumen" class="auro-dx-textarea" readonly placeholder="Se generará a partir de los datos clínicos disponibles de esta atención."></textarea>
              </div>

              <div class="auro-dx-section">
                <div class="auro-dx-field-head">
                  <label class="auro-dx-label" for="auroDxAnalisis">Análisis / impresión clínica</label>
                  <div class="auro-dx-field-actions">
                    <button type="button" class="auro-dx-mini-btn" data-copy-field="auroDxAnalisis"><i class="bi bi-clipboard"></i> Copiar</button>
                    <button type="button" class="auro-dx-mini-btn" data-expand-field="auroDxAnalisis" data-title="Análisis / impresión clínica"><i class="bi bi-arrows-fullscreen"></i> Ampliar</button>
                  </div>
                </div>
                <div class="auro-dx-guide">Expresa la interpretación clínica del profesional, la coherencia diagnóstica y los aspectos que deben confirmarse.</div>
                <textarea id="auroDxAnalisis" class="auro-dx-textarea" readonly placeholder="Interpretación clínica editable por el profesional."></textarea>
              </div>

              <div class="auro-dx-section">
                <div class="auro-dx-field-head">
                  <label class="auro-dx-label" for="auroDxConducta">Conducta sugerida</label>
                  <div class="auro-dx-field-actions">
                    <button type="button" class="auro-dx-mini-btn" data-copy-field="auroDxConducta"><i class="bi bi-clipboard"></i> Copiar</button>
                    <button type="button" class="auro-dx-mini-btn" data-expand-field="auroDxConducta" data-title="Conducta sugerida"><i class="bi bi-arrows-fullscreen"></i> Ampliar</button>
                  </div>
                </div>
                <div class="auro-dx-guide">Resume las acciones propuestas a partir del protocolo seleccionado. Debe revisarse antes de enviarla al Plan.</div>
                <textarea id="auroDxConducta" class="auro-dx-textarea" readonly placeholder="Conducta editable antes de transferir al Plan."></textarea>
              </div>
            </div>
          </div>
        </div>

        <div class="auro-dx-card">
          <div class="auro-dx-card-head">
            Protocolos clínicos disponibles
            <div class="auro-dx-card-help">Son plantillas de apoyo vinculadas al CIE-10. No se aplican automáticamente.</div>
          </div>
          <div class="auro-dx-card-body" id="auroDxProtocolos">
            <div class="auro-dx-empty">Seleccione una atención con diagnósticos para consultar protocolos.</div>
          </div>
        </div>

        <div class="auro-dx-card">
          <div class="auro-dx-card-head">
            Información utilizada para el análisis clínico
            <div class="auro-dx-card-help">Indica qué módulos tienen datos vinculados a esta atención. “No registrado” no significa error.</div>
          </div>
          <div class="auro-dx-card-body">
            <div class="auro-dx-source" id="auroDxFuentes"></div>
          </div>
        </div>

        <div class="auro-dx-warning">
          Las sugerencias no sustituyen el criterio médico. Revise indicaciones, contraindicaciones, alergias,
          embarazo, lactancia, función renal/hepática, interacciones y contexto clínico antes de aplicar al Plan.
        </div>

        <div class="auro-dx-modal-backdrop" id="auroDxModal" aria-hidden="true">
          <div class="auro-dx-modal" role="dialog" aria-modal="true" aria-labelledby="auroDxModalTitle">
            <div class="auro-dx-modal-head">
              <h4 id="auroDxModalTitle">Texto clínico</h4>
              <button type="button" class="auro-dx-mini-btn" id="auroDxModalCerrar"><i class="bi bi-x-lg"></i> Cerrar</button>
            </div>
            <div class="auro-dx-modal-body">
              <textarea id="auroDxModalTexto"></textarea>
            </div>
            <div class="auro-dx-modal-foot">
              <button type="button" class="auro-dx-btn" id="auroDxModalCopiar"><i class="bi bi-clipboard"></i> Copiar</button>
              <button type="button" class="auro-dx-btn primary" id="auroDxModalAplicar"><i class="bi bi-check2"></i> Aplicar cambios</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function asegurarApp(){
    instalarEstilos();

    const panel = document.getElementById('hc_diagnostico') || asegurarPanel();
    if(!panel){
      console.error(MODULO + ': no existe #hc_diagnostico.');
      return null;
    }

    /*
      MONTAJE DETERMINISTA:
      Diagnósticos se pinta exclusivamente dentro de #auroDiagnosticosMount.
      El punto de montaje se crea si el index todavía no lo contiene.
    */
    let mount = document.getElementById('auroDiagnosticosMount');
    if(!mount){
      mount = document.createElement('div');
      mount.id = 'auroDiagnosticosMount';
      panel.appendChild(mount);
    }

    mount.style.display = 'block';
    mount.style.width = '100%';
    mount.style.minHeight = '220px';

    let app = document.getElementById('auroDiagnosticosApp');
    if(!app){
      app = document.createElement('div');
      app.id = 'auroDiagnosticosApp';
    }

    if(app.parentElement !== mount){
      mount.replaceChildren(app);
    }

    /*
      Siempre reconstruye la estructura si está vacía o incompleta.
      Esto corrige el caso observado: pestaña activa pero panel en blanco.
    */
    if(
      !app.querySelector('#auroDxStatus') ||
      !app.querySelector('#auroDxLista') ||
      !app.querySelector('#auroDxResumen')
    ){
      app.innerHTML = appHTML();
      delete app.dataset.eventosInstalados;
    }

    app.style.display = 'block';
    app.style.visibility = 'visible';
    app.style.opacity = '1';
    app.style.width = '100%';

    if(app.dataset.eventosInstalados !== '1'){
      app.querySelector('#auroDxActualizar')?.addEventListener('click', () => cargarAtencionActual(true));
      app.querySelector('#auroDxGenerar')?.addEventListener('click', generarIntegracion);
      app.querySelector('#auroDxEditar')?.addEventListener('click', alternarEdicionClinica);
      app.querySelector('#auroDxGuardar')?.addEventListener('click', guardarIntegracionTemporal);
      app.querySelector('#auroDxAplicarPlan')?.addEventListener('click', aplicarAlPlan);
      app.querySelector('#auroDxGuia')?.addEventListener('click', alternarGuia);

      app.querySelectorAll('[data-copy-field]').forEach(btn => {
        btn.addEventListener('click', () => copiarCampo(btn.dataset.copyField));
      });

      app.querySelectorAll('[data-expand-field]').forEach(btn => {
        btn.addEventListener('click', () => abrirCampoAmpliado(btn.dataset.expandField, btn.dataset.title));
      });

      app.querySelector('#auroDxModalCerrar')?.addEventListener('click', cerrarCampoAmpliado);
      app.querySelector('#auroDxModalAplicar')?.addEventListener('click', aplicarCampoAmpliado);
      app.querySelector('#auroDxModalCopiar')?.addEventListener('click', () => copiarCampo('auroDxModalTexto'));
      app.querySelector('#auroDxModal')?.addEventListener('click', e => {
        if(e.target?.id === 'auroDxModal') cerrarCampoAmpliado();
      });

      ['auroDxResumen','auroDxAnalisis','auroDxConducta'].forEach(id => {
        app.querySelector('#' + id)?.addEventListener('input', () => {
          state.cambiosPendientes = true;
          state.guardadoTemporalConfirmado = false;
          state.ultimaEdicionLocal = new Date().toISOString();
          guardarEstadoTemporal();
          actualizarEstadoEdicion();
        });
      });

      app.dataset.eventosInstalados = '1';
    }

    return app;
  }

  function mensaje(tipo, contenido){
    const box = document.getElementById('auroDxMensaje');
    if(!box) return;
    if(!contenido){
      box.innerHTML = '';
      return;
    }
    const clase = tipo === 'error' ? 'auro-dx-error' : tipo === 'ok' ? 'auro-dx-ok' : 'auro-dx-warning';
    box.innerHTML = `<div class="${clase}">${escapeHtml(contenido)}</div>`;
  }

  function status(contenido){
    const el = document.getElementById('auroDxStatus');
    if(el) el.textContent = contenido;
  }

  function renderDiagnosticos(){
    const box = document.getElementById('auroDxLista');
    if(!box) return;

    if(!state.diagnosticos.length){
      box.innerHTML = '<div class="auro-dx-empty">No existen diagnósticos registrados para esta atención.</div>';
      return;
    }

    const ordenados = [...state.diagnosticos].sort((a,b) => Number(b.principal) - Number(a.principal));
    box.innerHTML = ordenados.map(d => `
      <div class="auro-dx-item">
        <div class="auro-dx-item-main">
          <div class="auro-dx-code">${escapeHtml(d.codigo_cie10 || 'S/C')}</div>
          <div class="auro-dx-name">${escapeHtml(d.descripcion || 'Sin descripción')}</div>
        </div>
        <div class="auro-dx-tags">
          ${d.principal ? '<span class="auro-dx-tag principal">Principal</span>' : '<span class="auro-dx-tag">Secundario</span>'}
          <span class="auro-dx-tag">${escapeHtml(d.tipo_diagnostico || 'Presuntivo')}</span>
          <span class="auro-dx-tag">${escapeHtml(d.origen || '')}</span>
        </div>
      </div>
    `).join('');
  }

  function protocoloLista(valor){
    const parsed = parseJsonSeguro(valor, []);
    if(Array.isArray(parsed)) return parsed;
    if(parsed && typeof parsed === 'object'){
      return Object.keys(parsed).map(k => {
        const v = parsed[k];
        return typeof v === 'string' ? v : k + ': ' + JSON.stringify(v);
      });
    }
    const raw = texto(valor);
    if(!raw) return [];
    return raw.split(/\r?\n|\s*\|\|\s*|;/).map(texto).filter(Boolean);
  }

  function normalizarProtocolo(raw, diagnostico){
    raw = raw || {};
    return {
      id_protocolo: texto(raw.id_protocolo || raw.id),
      codigo_cie10: texto(raw.codigo_cie10 || raw.cie10 || diagnostico?.codigo_cie10).replace(/\./g,'').toUpperCase(),
      diagnostico: texto(raw.diagnostico || raw.descripcion_diagnostico || diagnostico?.descripcion),
      nombre: texto(raw.nombre_protocolo || raw.titulo || raw.nombre || 'Protocolo clínico'),
      especialidad: texto(raw.especialidad || 'General'),
      version: texto(raw.version_protocolo || raw.version),
      medicamentos: protocoloLista(raw.medicamentos_json || raw.medicamentos),
      ordenes: protocoloLista(raw.ordenes_json || raw.ordenes || raw.laboratorios_json),
      imagenes: protocoloLista(raw.imagenes_json || raw.imagenes),
      indicaciones: protocoloLista(raw.indicaciones_json || raw.indicaciones),
      controles: protocoloLista(raw.controles_json || raw.controles || raw.seguimiento),
      procedimientos: protocoloLista(raw.procedimientos_json || raw.procedimientos),
      alertas: protocoloLista(raw.alertas_json || raw.alertas),
      conducta: texto(raw.conducta || raw.conducta_sugerida),
      fuente: texto(raw.fuente || raw.referencia),
      raw: raw
    };
  }

  function renderProtocolos(){
    const box = document.getElementById('auroDxProtocolos');
    const btn = document.getElementById('auroDxAplicarPlan');
    if(!box) return;

    if(!state.protocolos.length){
      box.innerHTML = '<div class="auro-dx-empty">No se encontraron protocolos activos para los diagnósticos de esta atención.</div>';
      if(btn) btn.disabled = true;
      return;
    }

    box.innerHTML = state.protocolos.map((p, index) => {
      const seleccionado = state.protocoloSeleccionado === index;
      const secciones = [
        ['Medicamentos', p.medicamentos],
        ['Órdenes', p.ordenes],
        ['Imágenes', p.imagenes],
        ['Procedimientos', p.procedimientos],
        ['Indicaciones', p.indicaciones],
        ['Controles', p.controles],
        ['Alertas', p.alertas]
      ].filter(x => x[1] && x[1].length);

      return `
        <div class="auro-dx-protocolo ${seleccionado ? 'selected' : ''}" data-protocolo-index="${index}">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
            <div>
              <h5>${escapeHtml(p.nombre)}</h5>
              <small>${escapeHtml(p.codigo_cie10)} · ${escapeHtml(p.especialidad)} ${p.version ? '· v' + escapeHtml(p.version) : ''}</small>
            </div>
            <button type="button" class="auro-dx-btn ${seleccionado ? 'primary' : ''}" data-seleccionar-protocolo="${index}">
              ${seleccionado ? 'Seleccionado' : 'Seleccionar'}
            </button>
          </div>
          ${p.conducta ? `<p style="margin:9px 0 0">${escapeHtml(p.conducta)}</p>` : ''}
          ${secciones.map(([titulo, lista]) => `
            <div style="margin-top:9px">
              <b style="font-size:12px">${escapeHtml(titulo)}</b>
              <ul class="auro-dx-list">${lista.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
            </div>
          `).join('')}
        </div>
      `;
    }).join('');

    box.querySelectorAll('[data-seleccionar-protocolo]').forEach(btnSel => {
      btnSel.addEventListener('click', () => {
        state.protocoloSeleccionado = Number(btnSel.dataset.seleccionarProtocolo);
        const p = state.protocolos[state.protocoloSeleccionado];
        if(p && p.conducta){
          const campo = document.getElementById('auroDxConducta');
          if(campo && !texto(campo.value)) campo.value = p.conducta;
        }
        renderProtocolos();
        guardarEstadoTemporal();
      });
    });

    if(btn) btn.disabled = state.protocoloSeleccionado === null;
  }

  function fuenteTieneDatos(obj){
    if(!obj) return false;
    if(Array.isArray(obj)) return obj.length > 0;
    if(typeof obj !== 'object') return !!texto(obj);
    return Object.keys(obj).some(k => {
      const v = obj[k];
      return Array.isArray(v) ? v.length : (typeof v === 'object' ? fuenteTieneDatos(v) : !!texto(v));
    });
  }

  function renderFuentes(){
    const box = document.getElementById('auroDxFuentes');
    if(!box) return;

    const fuentes = [
      ['Atención actual', atencionActiva()],
      ['Historia clínica', state.historia],
      ['Examen físico general', state.detalleExamen?.examen],
      ['Revisión por sistemas', state.detalleExamen?.sistemas],
      ['Examen regional', state.detalleExamen?.regionales],
      ['Ginecología', state.especialidades.ginecologia],
      ['Obstetricia', state.especialidades.obstetricia],
      ['Estética', state.especialidades.estetica]
    ];

    box.innerHTML = fuentes.map(([nombre, valor]) => {
      const disponible = fuenteTieneDatos(valor);
      return `
        <div class="auro-dx-source-item ${disponible ? 'available' : 'missing'}">
          <b>${escapeHtml(nombre)}</b>
          <div class="auro-dx-source-state">
            <i class="bi ${disponible ? 'bi-check-circle-fill' : 'bi-dash-circle'}"></i>
            ${disponible ? 'Disponible para el análisis' : 'No registrado en esta atención'}
          </div>
        </div>
      `;
    }).join('');
  }

  const CLAVES_TECNICAS = new Set([
    'id','id_atencion','id_paciente','id_historia','id_medico','id_cita',
    'id_ginecologia','id_obstetricia','id_estetica','id_examen',
    'estado','estado_registro','creado_en','actualizado_en','fecha_creacion',
    'fecha_actualizacion','creado_por','actualizado_por','usuario','version'
  ]);

  function etiquetaClinica(clave){
    return texto(clave)
      .replace(/_/g,' ')
      .replace(/\b\w/g, letra => letra.toUpperCase());
  }

  function quitarPrefijoSerializado(valor){
    return texto(valor)
      .replace(/^\s*AUROSANAX_[A-Z0-9_]+_V\d+::\s*/i,'')
      .trim();
  }

  function valorClinicoPlano(valor, profundidad){
    profundidad = profundidad || 0;
    if(profundidad > 6 || valor === null || valor === undefined) return '';

    if(typeof valor === 'string'){
      const limpio = quitarPrefijoSerializado(valor);
      if(!limpio || limpio === '{}' || limpio === '[]' || /^(null|undefined|nan)$/i.test(limpio)) return '';

      /*
        CORRECCIÓN 1.4.2:
        Algunos módulos guardan objetos serializados con el prefijo
        AUROSANAX_...:: antes del JSON. En la versión anterior se intentaba
        interpretar el JSON antes de retirar ese prefijo, por lo que el
        contenido completo terminaba visible en el resumen.
      */
      const parseado = parseJsonSeguro(limpio, null);
      if(parseado && typeof parseado === 'object'){
        return valorClinicoPlano(parseado, profundidad + 1);
      }

      if(pareceFechaTecnica(limpio)) return '';
      return limpio;
    }

    if(typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : '';
    if(typeof valor === 'boolean') return valor ? 'Sí' : 'No';

    if(Array.isArray(valor)){
      const items = valor
        .map(item => valorClinicoPlano(item, profundidad + 1))
        .filter(Boolean);

      return [...new Set(items.map(texto))].join('; ');
    }

    if(typeof valor === 'object'){
      const partes = [];
      const vistos = new Set();

      Object.entries(valor).forEach(([clave, dato]) => {
        if(claveTecnicaOAdministrativa(clave)) return;

        const plano = valorClinicoPlano(dato, profundidad + 1);
        if(!plano) return;

        const parte = etiquetaClinica(clave) + ': ' + plano;
        const firma = normalizar(parte);
        if(vistos.has(firma)) return;

        vistos.add(firma);
        partes.push(parte);
      });

      return partes.join('; ');
    }

    return '';
  }

  function resumenObjeto(obj, exclusiones){
    if(!obj || typeof obj !== 'object') return '';

    const omitir = new Set([
      ...Array.from(CLAVES_TECNICAS),
      ...(exclusiones || []).map(normalizar)
    ]);

    const partes = [];
    Object.entries(obj).forEach(([clave, valor]) => {
      if(omitir.has(normalizar(clave))) return;
      const plano = valorClinicoPlano(valor, 0);
      if(!plano) return;
      partes.push(etiquetaClinica(clave) + ': ' + plano);
    });

    return partes.join(' | ');
  }

  async function copiarCampo(id){
    const campo = document.getElementById(id);
    const contenido = texto(campo?.value);
    if(!contenido){
      mensaje('aviso','No hay contenido para copiar.');
      return;
    }

    try{
      await navigator.clipboard.writeText(contenido);
      mensaje('ok','Texto copiado al portapapeles.');
    }catch(error){
      campo.focus();
      campo.select();
      document.execCommand('copy');
      mensaje('ok','Texto copiado al portapapeles.');
    }
  }

  let campoModalActivo = '';

  function abrirCampoAmpliado(id, titulo){
    const campo = document.getElementById(id);
    const modal = document.getElementById('auroDxModal');
    const modalTexto = document.getElementById('auroDxModalTexto');
    if(!campo || !modal || !modalTexto) return;

    campoModalActivo = id;
    document.getElementById('auroDxModalTitle').textContent = titulo || 'Texto clínico';
    modalTexto.value = campo.value || '';
    modalTexto.readOnly = !state.modoEdicion;
    const btnAplicar = document.getElementById('auroDxModalAplicar');
    if(btnAplicar) btnAplicar.disabled = !state.modoEdicion;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
    setTimeout(() => modalTexto.focus(), 30);
  }

  function cerrarCampoAmpliado(){
    const modal = document.getElementById('auroDxModal');
    if(!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    campoModalActivo = '';
  }

  function aplicarCampoAmpliado(){
    if(!state.modoEdicion){
      mensaje('aviso','Active “Editar integración” antes de modificar el texto.');
      return;
    }
    if(!campoModalActivo) return cerrarCampoAmpliado();
    const origen = document.getElementById(campoModalActivo);
    const modalTexto = document.getElementById('auroDxModalTexto');
    if(origen && modalTexto){
      origen.value = modalTexto.value;
      origen.dispatchEvent(new Event('input',{bubbles:true}));
    }
    cerrarCampoAmpliado();
    mensaje('ok','Cambios aplicados al texto clínico.');
  }

  function alternarGuia(){
    const app = document.getElementById('auroDiagnosticosApp');
    const btn = document.getElementById('auroDxGuia');
    if(!app || !btn) return;
    const activa = !app.classList.contains('guide-on');
    app.classList.toggle('guide-on', activa);
    btn.setAttribute('aria-pressed', activa ? 'true' : 'false');
    btn.innerHTML = activa
      ? '<i class="bi bi-question-circle-fill"></i> Ocultar guía'
      : '<i class="bi bi-question-circle"></i> Activar guía';
  }

  function tieneIntegracionClinica(){
    return ['auroDxResumen','auroDxAnalisis','auroDxConducta']
      .some(id => texto(document.getElementById(id)?.value));
  }

  function formatearFechaLocal(valor){
    const raw = texto(valor);
    if(!raw) return '';
    const fecha = new Date(raw);
    if(Number.isNaN(fecha.getTime())) return '';
    try{
      return fecha.toLocaleString('es-EC', {
        year:'numeric', month:'2-digit', day:'2-digit',
        hour:'2-digit', minute:'2-digit'
      });
    }catch(e){
      return fecha.toLocaleString();
    }
  }

  function actualizarEstadoEdicion(){
    const hayIntegracion = tieneIntegracionClinica();
    const btnEditar = document.getElementById('auroDxEditar');
    const btnGuardar = document.getElementById('auroDxGuardar');
    const estado = document.getElementById('auroDxEdicionEstado');

    ['auroDxResumen','auroDxAnalisis','auroDxConducta'].forEach(id => {
      const campo = document.getElementById(id);
      if(campo) campo.readOnly = !state.modoEdicion;
    });

    if(btnEditar){
      btnEditar.disabled = !hayIntegracion;
      btnEditar.innerHTML = state.modoEdicion
        ? '<i class="bi bi-lock"></i> Finalizar edición'
        : '<i class="bi bi-pencil-square"></i> Editar integración';
    }
    if(btnGuardar) btnGuardar.disabled = !hayIntegracion || !state.cambiosPendientes;

    if(!estado) return;
    if(!hayIntegracion) estado.textContent = 'Sin integración generada.';
    else if(state.modoEdicion && state.cambiosPendientes) estado.textContent = 'En edición · Cambios pendientes de confirmación temporal.';
    else if(state.modoEdicion) estado.textContent = 'Edición médica habilitada.';
    else if(state.guardadoTemporalConfirmado){
      const fecha = formatearFechaLocal(state.ultimaEdicionLocal);
      estado.textContent = 'Guardado temporal confirmado' + (fecha ? ' · ' + fecha : '') + '. No enviado a Google Sheets.';
    }else if(state.cambiosPendientes) estado.textContent = 'Cambios pendientes de confirmación temporal.';
    else estado.textContent = 'Integración generada en modo protegido.';
  }

  function alternarEdicionClinica(){
    if(!tieneIntegracionClinica()){
      mensaje('aviso','Primero genere la integración clínica.');
      return;
    }
    state.modoEdicion = !state.modoEdicion;
    actualizarEstadoEdicion();
    if(state.modoEdicion){
      document.getElementById('auroDxResumen')?.focus();
      mensaje('aviso','Edición médica habilitada. Revise los textos y confirme con “Guardar temporalmente”.');
    }else{
      mensaje('ok','Edición finalizada. Los textos quedaron protegidos contra cambios accidentales.');
    }
  }

  function guardarIntegracionTemporal(){
    if(!state.atencionActual || !tieneIntegracionClinica()){
      mensaje('error','No existe una integración clínica para guardar temporalmente.');
      return;
    }
    state.cambiosPendientes = false;
    state.guardadoTemporalConfirmado = true;
    state.ultimaEdicionLocal = new Date().toISOString();
    state.modoEdicion = false;
    guardarEstadoTemporal();
    actualizarEstadoEdicion();
    mensaje('ok','Integración confirmada temporalmente para esta atención. No se modificó Google Sheets ni la base de datos.');
  }

  function claveTecnicaOAdministrativa(clave){
    const k = normalizar(clave);
    if(!k) return true;
    if(CLAVES_TECNICAS.has(k)) return true;

    /*
      Se excluyen solamente identificadores, metadatos y datos administrativos.
      No se modifican los objetos originales ni su almacenamiento.
    */
    return /(^id\b|\bid$|_id\b|\bid_|\bjson\b|timestamp|fecha creacion|fecha actualizacion|hora atencion|creado|actualizado|usuario|version|token|uuid|hash|accion|success|mensaje sistema|numero consulta|numero atencion|numero historia|tipo atencion|modalidad atencion|nombre paciente|nombres paciente|apellidos paciente|paciente nombre|^paciente$|documento paciente|cedula|correo|email|telefono|direccion|estado civil|responsable|acompanante|profesional|medico tratante|sede|sucursal)/.test(k);
  }

  function pareceFechaTecnica(valor){
    const v = texto(valor);
    if(!v) return false;
    if(/^1899-12-3[01]t/i.test(v)) return true;
    return /^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}(\.\d+)?z?$/i.test(v);
  }

  function limpiarTextoClinico(valor){
    if(valor === null || valor === undefined) return '';

    /*
      Acepta tanto texto simple como objetos serializados.
      Esta función solo transforma una copia para presentación; nunca escribe
      ni modifica la información recibida desde otros módulos.
    */
    if(typeof valor === 'object'){
      return valorClinicoPlano(valor, 0);
    }

    let v = quitarPrefijoSerializado(valor);
    if(!v || v === '{}' || v === '[]' || /^(null|undefined|nan)$/i.test(v)) return '';
    if(pareceFechaTecnica(v)) return '';

    const parseado = parseJsonSeguro(v, null);
    if(parseado && typeof parseado === 'object'){
      return valorClinicoPlano(parseado, 0);
    }

    v = v
      .replace(/AUROSANAX_[A-Z0-9_]+_V\d+::/gi,'')
      .replace(/[{}\[\]"]/g, caracter => caracter)
      .replace(/\s+/g,' ')
      .replace(/\s*\|\s*/g,' · ')
      .replace(/\s*;\s*/g,'; ')
      .trim();

    /*
      Protección final: si todavía parece JSON crudo, no se muestra.
      Es preferible omitir un valor técnico antes que exponerlo al médico.
    */
    if((v.startsWith('{') && v.endsWith('}')) || (v.startsWith('[') && v.endsWith(']'))){
      return '';
    }

    return v;
  }

  /*
    MOTOR CLÍNICO UNIVERSAL – FASE 1
    --------------------------------
    Convierte objetos heterogéneos de los distintos módulos en narrativa
    clínica legible. Opera únicamente sobre copias para presentación y no
    modifica la estructura, persistencia ni sincronización del ERP.
  */

  const DICCIONARIO_CLINICO = {
    leucorrea: 'leucorrea',
    flujo_vaginal: 'flujo vaginal',
    secrecion_vaginal: 'secreción vaginal',
    prurito: 'prurito',
    prurito_vulvar: 'prurito vulvar',
    prurito_vaginal: 'prurito vaginal',
    ardor: 'sensación de ardor',
    ardor_vaginal: 'ardor vaginal',
    disuria: 'disuria',
    polaquiuria: 'polaquiuria',
    urgencia_miccional: 'urgencia miccional',
    dolor_pelvico: 'dolor pélvico',
    dolor_abdominal: 'dolor abdominal',
    dispareunia: 'dispareunia',
    sangrado: 'sangrado',
    sangrado_vaginal: 'sangrado vaginal',
    fiebre: 'fiebre',
    nauseas: 'náuseas',
    vomitos: 'vómitos',
    cefalea: 'cefalea',
    mareo: 'mareo',
    edema: 'edema',
    tos: 'tos',
    disnea: 'disnea',
    dolor_toracico: 'dolor torácico',
    palpitaciones: 'palpitaciones',
    estreñimiento: 'estreñimiento',
    diarrea: 'diarrea',
    alergias: 'alergias conocidas',
    alergia: 'alergias conocidas',
    antecedente_htA: 'hipertensión arterial',
    hipertension: 'hipertensión arterial',
    diabetes: 'diabetes mellitus'
  };

  function claveClinicaLegible(clave){
    const k = normalizar(clave).replace(/\s+/g,'_');
    if(DICCIONARIO_CLINICO[k]) return DICCIONARIO_CLINICO[k];
    return texto(clave)
      .replace(/_/g,' ')
      .replace(/\bhta\b/gi,'hipertensión arterial')
      .replace(/\bdm\b/gi,'diabetes mellitus')
      .replace(/\bfur\b/gi,'fecha de última menstruación')
      .replace(/\bfpp\b/gi,'fecha probable de parto')
      .replace(/\bfcf\b/gi,'frecuencia cardíaca fetal')
      .replace(/\bimc\b/gi,'índice de masa corporal')
      .toLowerCase()
      .trim();
  }

  function esAfirmativoClinico(valor){
    if(valor === true || valor === 1) return true;
    const v = normalizar(valor);
    return ['si','sí','true','positivo','positiva','presente','presenta','activo','activa','1','x'].includes(v);
  }

  function esNegativoClinico(valor){
    if(valor === false || valor === 0) return true;
    const v = normalizar(valor);
    return ['no','false','negativo','negativa','ausente','niega','0'].includes(v);
  }

  function esValorVacioClinico(valor){
    if(valor === null || valor === undefined) return true;
    if(Array.isArray(valor)) return valor.length === 0;
    if(typeof valor === 'object') return Object.keys(valor).length === 0;
    const v = normalizar(valor);
    return !v || ['null','undefined','nan','no aplica','n/a','sin dato','no registrado'].includes(v);
  }

  function singularizarEtiquetaClinica(valor){
    return texto(valor)
      .replace(/^antecedentes?\s+/i,'')
      .replace(/^presencia de\s+/i,'')
      .replace(/^tiene\s+/i,'')
      .trim();
  }

  function unirListaNatural(items){
    const lista = [...new Set((items || []).map(texto).filter(Boolean))];
    if(!lista.length) return '';
    if(lista.length === 1) return lista[0];
    if(lista.length === 2) return lista[0] + ' y ' + lista[1];
    return lista.slice(0,-1).join(', ') + ' y ' + lista[lista.length - 1];
  }

  function cerrarOracion(valor){
    const v = texto(valor).replace(/\s+/g,' ').trim();
    if(!v) return '';
    return /[.!?]$/.test(v) ? v : v + '.';
  }

  function limpiarPuntuacionClinica(valor){
    return texto(valor)
      .replace(/\s+/g,' ')
      .replace(/\s+([,.;:])/g,'$1')
      .replace(/([,;:])([^\s])/g,'$1 $2')
      .replace(/\.{2,}/g,'.')
      .trim();
  }

  function extraerElementosClinicos(obj, maximo, profundidad){
    profundidad = profundidad || 0;
    if(!obj || typeof obj !== 'object' || profundidad > 5) return [];

    const salida = [];
    const limite = maximo || 12;

    Object.entries(obj).forEach(([clave, valor]) => {
      if(salida.length >= limite || claveTecnicaOAdministrativa(clave) || esValorVacioClinico(valor)) return;

      const etiqueta = singularizarEtiquetaClinica(claveClinicaLegible(clave));

      if(esAfirmativoClinico(valor)){
        salida.push({tipo:'positivo', etiqueta, valor:'', clave});
        return;
      }

      if(esNegativoClinico(valor)){
        salida.push({tipo:'negativo', etiqueta, valor:'', clave});
        return;
      }

      if(Array.isArray(valor)){
        const lista = valor
          .map(item => typeof item === 'object'
            ? limpiarTextoClinico(valorClinicoPlano(item, profundidad + 1))
            : limpiarTextoClinico(item))
          .filter(Boolean);
        if(lista.length){
          salida.push({tipo:'dato', etiqueta, valor:unirListaNatural(lista), clave});
        }
        return;
      }

      if(typeof valor === 'object'){
        const hijos = extraerElementosClinicos(valor, limite - salida.length, profundidad + 1);
        if(hijos.length){
          hijos.forEach(hijo => salida.push(hijo));
        }
        return;
      }

      const plano = limpiarTextoClinico(valor);
      if(plano){
        salida.push({tipo:'dato', etiqueta, valor:plano, clave});
      }
    });

    return salida.slice(0, limite);
  }

  function narrarElementosClinicos(obj, opciones){
    opciones = opciones || {};
    const elementos = extraerElementosClinicos(obj, opciones.maximo || 12, 0);
    if(!elementos.length) return '';

    const positivos = elementos.filter(x => x.tipo === 'positivo').map(x => x.etiqueta);
    const negativos = elementos.filter(x => x.tipo === 'negativo').map(x => x.etiqueta);
    const datos = elementos.filter(x => x.tipo === 'dato');

    const frases = [];

    if(positivos.length){
      const inicio = opciones.inicioPositivo || 'Se documenta';
      frases.push(inicio + ' ' + unirListaNatural(positivos));
    }

    if(negativos.length){
      const negacion = 'sin ' + unirListaNatural(negativos);
      if(frases.length){
        frases[frases.length - 1] += ', ' + negacion;
      }else{
        frases.push('No se documenta ' + unirListaNatural(negativos));
      }
    }

    datos.forEach(item => {
      const etiqueta = item.etiqueta;
      const valor = item.valor;
      if(!etiqueta || !valor) return;

      const k = normalizar(item.clave);
      if(/tiempo|evolucion|duracion/.test(k)){
        frases.push('El cuadro presenta una evolución de ' + valor);
      }else if(/tratamiento|medicacion|farmaco/.test(k)){
        frases.push('Se encuentra en tratamiento con ' + valor);
      }else if(/fecha de ultima menstruacion|fur/.test(normalizar(etiqueta))){
        frases.push('La fecha de última menstruación registrada es ' + valor);
      }else if(/edad gestacional/.test(normalizar(etiqueta))){
        frases.push('La edad gestacional corresponde a ' + valor);
      }else{
        frases.push('Se registra ' + etiqueta + ' de ' + valor);
      }
    });

    return frases.map(cerrarOracion).join(' ');
  }

  function narrarAntecedentes(historia){
    historia = historia || {};
    const grupos = [
      ['antecedentes_personales','antecedentes_patologicos'],
      ['antecedentes_quirurgicos'],
      ['antecedentes_familiares'],
      ['alergias','alergia'],
      ['medicacion_actual','medicamentos_actuales','tratamiento_actual']
    ];

    const partes = [];

    grupos.forEach((claves, indice) => {
      const valores = [];
      claves.forEach(clave => {
        const valor = limpiarTextoClinico(valorClinicoPlano(historia[clave],0));
        if(valor) valores.push(valor);
      });
      const unido = unirListaNatural(valores);
      if(!unido) return;

      if(indice === 0) partes.push('Como antecedentes personales relevantes refiere ' + unido);
      if(indice === 1) partes.push('Presenta antecedente quirúrgico de ' + unido);
      if(indice === 2) partes.push('En los antecedentes familiares se registra ' + unido);
      if(indice === 3) partes.push('Se consignan alergias a ' + unido);
      if(indice === 4) partes.push('Mantiene tratamiento habitual con ' + unido);
    });

    return partes.map(cerrarOracion).join(' ');
  }

  function narrarSignosVitales(ex){
    ex = ex || {};
    const datos = [];

    const pa = limpiarTextoClinico(ex.presion_arterial || ex.tension_arterial);
    const fc = limpiarTextoClinico(ex.frecuencia_cardiaca || ex.pulso);
    const fr = limpiarTextoClinico(ex.frecuencia_respiratoria);
    const temp = limpiarTextoClinico(ex.temperatura);
    const sat = limpiarTextoClinico(ex.saturacion || ex.saturacion_oxigeno);
    const peso = limpiarTextoClinico(ex.peso_kg || ex.peso);
    const talla = limpiarTextoClinico(ex.talla_cm || ex.talla);
    const imc = limpiarTextoClinico(ex.imc);

    if(pa) datos.push('presión arterial de ' + pa);
    if(fc) datos.push('frecuencia cardíaca de ' + fc + ' lpm');
    if(fr) datos.push('frecuencia respiratoria de ' + fr + ' rpm');
    if(temp) datos.push('temperatura de ' + temp + ' °C');
    if(sat) datos.push('saturación de oxígeno de ' + sat + '%');
    if(peso) datos.push('peso de ' + peso + ' kg');
    if(talla) datos.push('talla de ' + talla + (/\bcm\b/i.test(talla) ? '' : ' cm'));
    if(imc) datos.push('índice de masa corporal de ' + imc);

    if(!datos.length) return '';
    return cerrarOracion('En la valoración se registran ' + unirListaNatural(datos));
  }

  function narrarDiagnosticos(){
    const principal = state.diagnosticos.find(d => d.principal) || state.diagnosticos[0];
    const secundarios = state.diagnosticos.filter(d => d !== principal);
    const partes = [];

    if(principal){
      const nombre = [principal.codigo_cie10, principal.descripcion].filter(Boolean).join(' - ');
      partes.push(
        'Como diagnóstico principal se registra ' + nombre +
        (principal.tipo_diagnostico ? ', de carácter ' + principal.tipo_diagnostico.toLowerCase() : '')
      );
    }

    if(secundarios.length){
      partes.push(
        'Se asocian ' +
        unirListaNatural(secundarios.map(d => [d.codigo_cie10,d.descripcion].filter(Boolean).join(' - ')))
      );
    }

    return partes.map(cerrarOracion).join(' ');
  }

  function resumenClinicoDeObjeto(obj, maximo){
    /*
      Se conserva la firma pública por compatibilidad interna, pero ahora
      devuelve frases clínicas y no listas "Campo: valor".
    */
    const narrativa = narrarElementosClinicos(obj, {maximo:maximo || 8});
    return narrativa ? [narrativa] : [];
  }

  function construirResumenClinico(){
    const a = atencionActiva() || {};
    const h = state.historia || {};
    const detalle = state.detalleExamen || {};
    const ex = detalle.examen || {};
    const parrafos = [];
    const vistos = new Set();

    function agregar(contenido){
      const limpio = limpiarPuntuacionClinica(contenido);
      if(!limpio) return;
      const firma = normalizar(limpio);
      if(!firma || vistos.has(firma)) return;
      vistos.add(firma);
      parrafos.push(cerrarOracion(limpio));
    }

    const motivo = limpiarTextoClinico(
      a.motivo_consulta ||
      h.motivo_consulta ||
      getValue('hcMotivoConsulta') ||
      getValue('hcMotivo')
    );

    const enfermedad = limpiarTextoClinico(
      h.enfermedad_actual ||
      h.anamnesis ||
      a.enfermedad_actual ||
      getValue('hcEnfermedadActual') ||
      getValue('hcAnamnesis')
    );

    if(motivo && enfermedad){
      agregar('Consulta por ' + motivo.replace(/[.\s]+$/,'') + '. En la anamnesis se describe ' + enfermedad);
    }else if(motivo){
      agregar('Consulta por ' + motivo);
    }else if(enfermedad){
      agregar('En la anamnesis se describe ' + enfermedad);
    }

    agregar(narrarAntecedentes(h));
    agregar(narrarSignosVitales(ex));

    const examenDirecto = limpiarTextoClinico(ex.examen_fisico || ex.hallazgos || ex.observaciones);
    if(examenDirecto){
      agregar('Al examen físico se documenta ' + examenDirecto);
    }

    const sistemas = narrarElementosClinicos(detalle.sistemas, {
      maximo:10,
      inicioPositivo:'En la revisión por sistemas se identifica'
    });
    if(sistemas) agregar(sistemas);

    const regionales = narrarElementosClinicos(detalle.regionales, {
      maximo:10,
      inicioPositivo:'En el examen regional se evidencia'
    });
    if(regionales) agregar(regionales);

    const gine = narrarElementosClinicos(state.especialidades.ginecologia, {
      maximo:14,
      inicioPositivo:'En la valoración ginecológica se documenta'
    });
    if(gine) agregar(gine);

    const obst = narrarElementosClinicos(state.especialidades.obstetricia, {
      maximo:14,
      inicioPositivo:'En la valoración obstétrica se registra'
    });
    if(obst) agregar(obst);

    const est = narrarElementosClinicos(state.especialidades.estetica, {
      maximo:10,
      inicioPositivo:'En la valoración estética y funcional se observa'
    });
    if(est) agregar(est);

    agregar(narrarDiagnosticos());

    return parrafos.join('\n\n');
  }

  function construirAnalisis(){
    const principal = state.diagnosticos.find(d => d.principal) || state.diagnosticos[0];
    const secundarios = state.diagnosticos.filter(d => d !== principal);
    const a = atencionActiva() || {};
    const h = state.historia || {};
    const ex = state.detalleExamen?.examen || {};

    const motivo = limpiarTextoClinico(
      a.motivo_consulta ||
      h.motivo_consulta ||
      getValue('hcMotivoConsulta') ||
      getValue('hcMotivo')
    );

    const enfermedad = limpiarTextoClinico(
      h.enfermedad_actual ||
      h.anamnesis ||
      getValue('hcEnfermedadActual') ||
      getValue('hcAnamnesis')
    );

    const hallazgo = limpiarTextoClinico(ex.examen_fisico || ex.hallazgos || ex.observaciones);
    const parrafos = [];

    if(principal){
      const dx = [principal.codigo_cie10, principal.descripcion].filter(Boolean).join(' - ');
      const tipo = normalizar(principal.tipo_diagnostico || 'presuntivo');

      let frase = 'La integración de la información disponible orienta principalmente a ' + dx;
      if(tipo) frase += ', registrado como diagnóstico ' + tipo;
      frase += '.';

      const bases = [];
      if(motivo) bases.push('el motivo de consulta');
      if(enfermedad) bases.push('la evolución clínica referida');
      if(hallazgo) bases.push('los hallazgos del examen físico');

      if(bases.length){
        frase += ' Esta impresión debe correlacionarse con ' + unirListaNatural(bases) + '.';
      }

      parrafos.push(frase);
    }

    if(secundarios.length){
      parrafos.push(
        'Los diagnósticos asociados —' +
        secundarios.map(d => [d.codigo_cie10,d.descripcion].filter(Boolean).join(' - ')).join('; ') +
        '— deben considerarse al individualizar el abordaje y el seguimiento.'
      );
    }

    const faltantes = [];
    if(!motivo) faltantes.push('motivo de consulta');
    if(!enfermedad) faltantes.push('enfermedad actual');
    if(!hallazgo) faltantes.push('hallazgos del examen físico');
    if(!state.historia) faltantes.push('historia clínica vinculada');

    if(faltantes.length){
      parrafos.push(
        'La interpretación se encuentra limitada por información pendiente o no disponible en ' +
        unirListaNatural(faltantes) +
        '; conviene verificarla antes de cerrar la impresión clínica.'
      );
    }

    if(state.protocolos.length){
      parrafos.push(
        'Se dispone de ' + state.protocolos.length +
        ' protocolo(s) de apoyo relacionado(s) con los diagnósticos registrados. Su contenido es orientativo y requiere validación e individualización médica.'
      );
    }else{
      parrafos.push(
        'No se encontró un protocolo activo específico para esta atención; la conducta deberá definirse según el contexto clínico, los diagnósticos diferenciales y los resultados complementarios.'
      );
    }

    parrafos.push(
      'Antes de establecer el plan definitivo deben verificarse gravedad, comorbilidades, alergias, embarazo o lactancia cuando corresponda, función renal y hepática, interacciones farmacológicas y signos de alarma.'
    );

    return parrafos.map(cerrarOracion).join('\n\n');
  }

  function construirConducta(){
    const p = state.protocoloSeleccionado !== null ? state.protocolos[state.protocoloSeleccionado] : null;
    if(!p){
      return [
        'Estudios: definir exámenes complementarios según hallazgos clínicos y diagnósticos diferenciales.',
        'Tratamiento: individualizar de acuerdo con diagnóstico confirmado, antecedentes, alergias y contraindicaciones.',
        'Educación: explicar evolución esperada, adherencia y medidas generales pertinentes.',
        'Seguimiento: establecer control según respuesta clínica y resultados.',
        'Signos de alarma: indicar consulta inmediata ante deterioro clínico o síntomas de alarma relacionados con el cuadro.'
      ].join('\n');
    }
    const partes = [];
    const estudios = [...(p.ordenes || []), ...(p.imagenes || []), ...(p.procedimientos || [])].map(limpiarTextoClinico).filter(Boolean);
    const tratamiento = (p.medicamentos || []).map(limpiarTextoClinico).filter(Boolean);
    const indicaciones = (p.indicaciones || []).map(limpiarTextoClinico).filter(Boolean);
    const controles = (p.controles || []).map(limpiarTextoClinico).filter(Boolean);
    const alertas = (p.alertas || []).map(limpiarTextoClinico).filter(Boolean);
    if(limpiarTextoClinico(p.conducta)) partes.push('Conducta general: ' + limpiarTextoClinico(p.conducta) + '.');
    if(estudios.length) partes.push('Estudios/procedimientos sugeridos: ' + estudios.join('; ') + '.');
    if(tratamiento.length) partes.push('Tratamiento propuesto para revisión: ' + tratamiento.join('; ') + '.');
    if(indicaciones.length) partes.push('Educación e indicaciones: ' + indicaciones.join('; ') + '.');
    if(controles.length) partes.push('Seguimiento: ' + controles.join('; ') + '.');
    if(alertas.length) partes.push('Signos de alarma/precauciones: ' + alertas.join('; ') + '.');
    partes.push('Validar toda la conducta con criterio médico antes de transferirla al Plan.');
    return partes.join('\n');
  }

  function generarIntegracion(){
    if(!state.atencionActual){
      mensaje('error','No existe una atención activa.');
      return;
    }

    if(!state.diagnosticos.length){
      mensaje('error','No existen diagnósticos registrados para integrar.');
      return;
    }

    const campos = ['auroDxResumen','auroDxAnalisis','auroDxConducta']
      .map(id => document.getElementById(id))
      .filter(Boolean);

    const hayContenido = campos.some(campo => texto(campo.value));
    if(hayContenido){
      const continuar = window.confirm(
        'Ya existe contenido en la integración clínica.\\n\\n' +
        'Al generar nuevamente se reemplazarán los textos actuales.\\n\\n' +
        '¿Desea continuar?'
      );
      if(!continuar) return;
    }

    mensaje('aviso','Generando integración clínica con la información disponible…');

    state.resumenClinico = construirResumenClinico();
    state.analisisClinico = construirAnalisis();
    state.conducta = construirConducta();

    const r = document.getElementById('auroDxResumen');
    const a = document.getElementById('auroDxAnalisis');
    const c = document.getElementById('auroDxConducta');
    if(r) r.value = state.resumenClinico;
    if(a) a.value = state.analisisClinico;
    if(c) c.value = state.conducta;

    state.modoEdicion = false;
    state.cambiosPendientes = true;
    state.guardadoTemporalConfirmado = false;
    state.ultimaEdicionLocal = new Date().toISOString();
    guardarEstadoTemporal();
    actualizarEstadoEdicion();
    mensaje('ok','Integración clínica generada en modo protegido. Presione “Editar integración” para revisión médica.');
  }

  async function consultarDetalleExamen(idAtencion){
    try{
      const data = await getJSON('listarDetalleExamenFisicoPorAtencion', {id_atencion:idAtencion});
      if(data && data.success === false) return null;
      return data || null;
    }catch(e){
      console.warn(MODULO + ': no se pudo consultar detalle del examen.', e);
      return null;
    }
  }

  async function consultarDiagnosticos(idAtencion){
    try{
      const data = await getJSON('listarDiagnosticosPorAtencion', {id_atencion:idAtencion});
      return normalizarDiagnosticosServidor(data);
    }catch(e){
      console.warn(MODULO + ': no se pudieron consultar diagnósticos.', e);
      return [];
    }
  }

  async function consultarHistoria(idPaciente, idAtencion){
    try{
      const data = await getJSON('listarHistoriasClinicas');
      const lista = arraySeguro(data);
      const porAtencion = lista.find(x => texto(x.id_atencion) === idAtencion);
      if(porAtencion) return porAtencion;

      const paciente = lista.filter(x => texto(x.id_paciente) === idPaciente);
      paciente.sort((a,b) => new Date(b.fecha_atencion || b.fecha || 0) - new Date(a.fecha_atencion || a.fecha || 0));
      return paciente[0] || null;
    }catch(e){
      return window.historiaActual || window.currentHistoria || null;
    }
  }

  async function consultarEspecialidad(accion, idAtencion){
    try{
      const data = await getJSON(accion);
      return arraySeguro(data).find(x => texto(x.id_atencion) === idAtencion) || null;
    }catch(e){
      return null;
    }
  }

  async function consultarProtocolos(){
    const resultados = [];
    for(const dx of state.diagnosticos){
      if(!dx.codigo_cie10) continue;
      try{
        const data = await getJSON('buscarProtocolosPorCie10', {
          codigo_cie10: dx.codigo_cie10
        });
        const lista = arraySeguro(data);
        lista.forEach(p => resultados.push(normalizarProtocolo(p, dx)));
      }catch(e){
        try{
          const unico = await getJSON('buscarProtocoloPorCie10', {
            codigo_cie10: dx.codigo_cie10
          });
          if(unico && unico.success !== false){
            const lista = arraySeguro(unico);
            if(lista.length) lista.forEach(p => resultados.push(normalizarProtocolo(p, dx)));
            else if(unico.id_protocolo || unico.codigo_cie10 || unico.nombre_protocolo){
              resultados.push(normalizarProtocolo(unico, dx));
            }
          }
        }catch(error){}
      }
    }

    const vistos = new Set();
    return resultados.filter(p => {
      const clave = normalizar((p.id_protocolo || '') + '|' + p.codigo_cie10 + '|' + p.nombre);
      if(vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    });
  }

  function guardarEstadoTemporal(){
    const id = texto(state.atencionActual);
    if(!id) return;

    state.resumenClinico = texto(document.getElementById('auroDxResumen')?.value);
    state.analisisClinico = texto(document.getElementById('auroDxAnalisis')?.value);
    state.conducta = texto(document.getElementById('auroDxConducta')?.value);

    state.cache[id] = {
      resumenClinico: state.resumenClinico,
      analisisClinico: state.analisisClinico,
      conducta: state.conducta,
      protocoloSeleccionado: state.protocoloSeleccionado,
      ultimaActualizacion: new Date().toISOString(),
      modoEdicion: state.modoEdicion,
      cambiosPendientes: state.cambiosPendientes,
      guardadoTemporalConfirmado: state.guardadoTemporalConfirmado,
      ultimaEdicionLocal: state.ultimaEdicionLocal
    };
  }

  function restaurarEstadoTemporal(id){
    const cache = state.cache[id];
    if(!cache) return;

    state.resumenClinico = texto(cache.resumenClinico);
    state.analisisClinico = texto(cache.analisisClinico);
    state.conducta = texto(cache.conducta);
    state.protocoloSeleccionado = Number.isInteger(cache.protocoloSeleccionado) ? cache.protocoloSeleccionado : null;
    state.modoEdicion = cache.modoEdicion === true;
    state.cambiosPendientes = cache.cambiosPendientes === true;
    state.guardadoTemporalConfirmado = cache.guardadoTemporalConfirmado === true;
    state.ultimaEdicionLocal = texto(cache.ultimaEdicionLocal || cache.ultimaActualizacion);

    const r = document.getElementById('auroDxResumen');
    const a = document.getElementById('auroDxAnalisis');
    const c = document.getElementById('auroDxConducta');
    if(r) r.value = state.resumenClinico;
    if(a) a.value = state.analisisClinico;
    if(c) c.value = state.conducta;
    actualizarEstadoEdicion();
  }

  function limpiarVisual(){
    state.diagnosticos = [];
    state.detalleExamen = null;
    state.historia = null;
    state.especialidades = {};
    state.protocolos = [];
    state.protocoloSeleccionado = null;
    state.resumenClinico = '';
    state.analisisClinico = '';
    state.conducta = '';
    state.modoEdicion = false;
    state.cambiosPendientes = false;
    state.guardadoTemporalConfirmado = false;
    state.ultimaEdicionLocal = '';

    ['auroDxResumen','auroDxAnalisis','auroDxConducta'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = '';
    });

    renderDiagnosticos();
    renderProtocolos();
    renderFuentes();
    const btn = document.getElementById('auroDxAplicarPlan');
    if(btn) btn.disabled = true;
    actualizarEstadoEdicion();
  }

  async function cargarAtencion(idAtencion, forzar){
    asegurarApp();

    idAtencion = texto(idAtencion || idAtencionActiva());
    if(!idAtencion){
      state.atencionActual = '';
      limpiarVisual();
      status('Sin atención activa');
      mensaje('','');
      return null;
    }

    if(state.cargando) return null;
    if(!forzar && state.atencionActual === idAtencion && state.diagnosticos.length){
      return state;
    }

    if(state.atencionActual && state.atencionActual !== idAtencion){
      guardarEstadoTemporal();
    }

    state.cargando = true;
    state.atencionActual = idAtencion;
    status('Cargando atención ' + idAtencion + '…');
    mensaje('','');
    limpiarVisual();
    state.atencionActual = idAtencion;

    try{
      const idPaciente = idPacienteActual();

      const [
        dxServidor,
        detalle,
        historia,
        ginecologia,
        obstetricia,
        estetica
      ] = await Promise.all([
        consultarDiagnosticos(idAtencion),
        consultarDetalleExamen(idAtencion),
        consultarHistoria(idPaciente, idAtencion),
        consultarEspecialidad('listarGinecologia', idAtencion),
        consultarEspecialidad('listarObstetricia', idAtencion),
        consultarEspecialidad('listarEstetica', idAtencion)
      ]);

      if(state.atencionActual !== idAtencion) return null;

      state.detalleExamen = detalle;
      state.historia = historia;
      state.especialidades = {ginecologia, obstetricia, estetica};
      state.diagnosticos = fusionarDiagnosticos(
        dxServidor.length ? dxServidor : normalizarDiagnosticosServidor(detalle?.diagnosticos),
        diagnosticosLocales()
      );

      state.protocolos = await consultarProtocolos();
      if(state.atencionActual !== idAtencion) return null;

      if(state.protocolos.length === 1){
        state.protocoloSeleccionado = 0;
      }

      renderDiagnosticos();
      renderProtocolos();
      renderFuentes();
      restaurarEstadoTemporal(idAtencion);
      actualizarEstadoEdicion();

      state.ultimaActualizacion = new Date().toISOString();
      const atencion = atencionActiva() || {};
      const numeroConsulta = texto(atencion.numero_consulta || atencion.numero_atencion || atencion.numero);
      status(
        (numeroConsulta ? 'Consulta #' + numeroConsulta + ' · ' : '') +
        'Atención ' + idAtencion + ' · ' + state.diagnosticos.length + ' diagnóstico(s)'
      );

      if(!state.diagnosticos.length){
        mensaje('aviso','La atención está activa, pero todavía no tiene diagnósticos guardados.');
      }else{
        mensaje('ok','Información clínica sincronizada correctamente.');
      }

      return state;
    }catch(error){
      console.error(MODULO + ': error cargando atención.', error);
      mensaje('error','No se pudo completar la sincronización: ' + error.message);
      status('Error de sincronización');
      return null;
    }finally{
      state.cargando = false;
    }
  }

  async function cargarAtencionActual(forzar){
    return cargarAtencion(idAtencionActiva(), !!forzar);
  }

  function agregarMedicamentosAlPlan(items){
    if(!items || !items.length) return 0;
    const destino = Array.isArray(window.medicamentosPlanSeleccionados)
      ? window.medicamentosPlanSeleccionados
      : Array.isArray(window.medicamentosSeleccionados)
        ? window.medicamentosSeleccionados
        : null;

    if(!destino) return 0;
    let total = 0;

    items.forEach(item => {
      const nombre = typeof item === 'string' ? item : texto(item.nombre || item.medicamento);
      if(!nombre) return;
      if(destino.some(x => normalizar(x.nombre || x.medicamento || x) === normalizar(nombre))) return;

      destino.push(typeof item === 'object' ? Object.assign({}, item) : {
        nombre,
        dosis:'',
        via:'',
        frecuencia:'',
        duracion:'',
        indicaciones:'',
        origen:'Protocolo Diagnósticos'
      });
      total++;
    });

    try{
      if(typeof window.renderMedicamentosPlanTabla === 'function') window.renderMedicamentosPlanTabla();
    }catch(e){}
    return total;
  }

  function categoriaOrden(nombre){
    const n = normalizar(nombre);
    if(/eco|radiograf|tomograf|resonancia|mamograf|doppler|imagen/.test(n)) return 'IMÁGENES';
    if(/biops|citolog|papanic|patolog/.test(n)) return 'PATOLOGÍA';
    if(/hemograma|glucosa|orina|cultivo|perfil|hormona|serolog|laboratorio/.test(n)) return 'LABORATORIO';
    return 'OTROS';
  }

  function agregarOrdenesAlPlan(items){
    if(!items || !items.length) return 0;
    const destino = Array.isArray(window.ordenesMedicasPlanSeleccionadas)
      ? window.ordenesMedicasPlanSeleccionadas
      : Array.isArray(window.ordenesMedicasSeleccionadas)
        ? window.ordenesMedicasSeleccionadas
        : null;

    if(!destino) return 0;
    let total = 0;

    items.forEach(item => {
      const nombre = typeof item === 'string' ? item : texto(item.nombre || item.orden);
      if(!nombre) return;
      if(destino.some(x => normalizar(x.nombre || x.orden || x) === normalizar(nombre))) return;

      destino.push(typeof item === 'object' ? Object.assign({}, item) : {
        categoria: categoriaOrden(nombre),
        nombre,
        observacion:'Sugerido desde módulo Diagnósticos'
      });
      total++;
    });

    try{
      if(typeof window.renderOrdenesMedicasTabla === 'function') window.renderOrdenesMedicasTabla();
    }catch(e){}
    return total;
  }

  function aplicarAlPlan(){
    if(state.cambiosPendientes){
      const continuarPendiente = window.confirm('La integración tiene cambios pendientes de confirmación temporal.\n\nPuede aplicarlos al Plan, pero se recomienda guardarlos temporalmente primero.\n\n¿Desea continuar?');
      if(!continuarPendiente) return;
    }
    const p = state.protocoloSeleccionado !== null ? state.protocolos[state.protocoloSeleccionado] : null;
    if(!p){
      mensaje('error','Seleccione un protocolo antes de aplicarlo al Plan.');
      return;
    }

    const confirmar = window.confirm(
      'Se transferirán las sugerencias seleccionadas al Plan clínico de la atención ' +
      state.atencionActual +
      '.\n\nRevise y edite el Plan antes de guardarlo.\n\n¿Desea continuar?'
    );
    if(!confirmar) return;

    const medicamentos = agregarMedicamentosAlPlan(p.medicamentos);
    const ordenes = agregarOrdenesAlPlan([...(p.ordenes || []), ...(p.imagenes || []), ...(p.procedimientos || [])]);

    const resumen = texto(document.getElementById('auroDxResumen')?.value);
    const analisis = texto(document.getElementById('auroDxAnalisis')?.value);
    const conducta = texto(document.getElementById('auroDxConducta')?.value) || construirConducta();

    const planTexto = [
      analisis ? 'ANÁLISIS CLÍNICO:\n' + analisis : '',
      conducta ? 'CONDUCTA:\n' + conducta : ''
    ].filter(Boolean).join('\n\n');

    const indicaciones = (p.indicaciones || []).join('\n');
    const controles = (p.controles || []).join('\n');

    const aplicados = {
      plan: setPrimerCampo(IDS_PLAN.planTratamiento, planTexto, true),
      indicaciones: setPrimerCampo(IDS_PLAN.indicaciones, indicaciones, true),
      control: setPrimerCampo(IDS_PLAN.control, controles, true),
      observaciones: setPrimerCampo(IDS_PLAN.observaciones, resumen ? 'Resumen clínico integrado:\n' + resumen : '', true)
    };

    try{
      if(typeof window.sincronizarPlanConReceta === 'function') window.sincronizarPlanConReceta();
      if(typeof window.guardarPlanTemporal === 'function') window.guardarPlanTemporal();
    }catch(e){}

    try{
      document.dispatchEvent(new CustomEvent('aurosanax:diagnostico-aplicado-plan', {
        detail: {
          id_atencion: state.atencionActual,
          protocolo: clonar(p, {}),
          medicamentos_agregados: medicamentos,
          ordenes_agregadas: ordenes
        }
      }));
    }catch(e){}

    const algunaCaja = Object.values(aplicados).some(Boolean);
    mensaje('ok',
      'Protocolo transferido al Plan. Medicamentos agregados: ' + medicamentos +
      '. Órdenes agregadas: ' + ordenes +
      (algunaCaja ? '.' : '. El Plan no expuso campos de texto compatibles; revise las tablas del Plan.')
    );

    guardarEstadoTemporal();
  }

  function cambiarPorAtencion(idAtencion){
    idAtencion = texto(idAtencion);
    if(!idAtencion) return;
    return cargarAtencion(idAtencion, true);
  }

  function instalarEventos(){
    if(window.__auroDiagnosticosEventosInstalados) return;
    window.__auroDiagnosticosEventosInstalados = true;

    ['aurosanax:atencion-iniciada','aurosanax:atencion-seleccionada','aurosanax:atencion-actualizada'].forEach(nombre => {
      const receptor = e => {
        const id = texto(
          e?.detail?.id_atencion ||
          e?.detail?.atencion?.id_atencion ||
          idAtencionActiva()
        );
        if(id) cambiarPorAtencion(id);
      };

      /*
        ATENCIONES emite estos CustomEvent con window.dispatchEvent().
        La versión anterior escuchaba únicamente document y nunca recibía
        el cambio de consulta. Se escucha window y document por compatibilidad.
      */
      window.addEventListener(nombre, receptor);
      document.addEventListener(nombre, receptor);
    });

    document.addEventListener('aurosanax:diagnosticos-actualizados', () => {
      cargarAtencionActual(true);
    });

    document.addEventListener('click', e => {
      const btn = e.target?.closest?.('button,a,[role="tab"]');
      if(!btn) return;
      const label = normalizar(btn.textContent || btn.getAttribute('aria-label') || btn.title);
      const target = normalizar(btn.dataset?.target || btn.getAttribute('href') || '');
      if(label.includes('diagnost') || target.includes('diagnost')){
        setTimeout(() => cargarAtencionActual(false), 50);
      }
    }, true);

    window.addEventListener('beforeunload', guardarEstadoTemporal);
  }

  function inicializar(){
    /*
      AUROSANAX FIX 1.1.0:
      Asegurar siempre el montaje. Antes, si la primera inicialización ocurría
      cuando el panel todavía no existía, state.inicializado quedaba en true
      y la interfaz nunca volvía a construirse.
    */
    const app = asegurarApp();
    instalarEventos();

    if(!app){
      state.inicializado = false;
      setTimeout(inicializar, 250);
      return;
    }

    state.inicializado = true;

    const id = idAtencionActiva();
    if(id){
      cargarAtencion(id, false);
    }else{
      status('Sin atención activa');
      renderDiagnosticos();
      renderProtocolos();
      renderFuentes();
      mensaje('aviso','Seleccione o inicie una consulta para cargar la información diagnóstica.');
    }

    console.log(MODULO + ' v' + VERSION + ' cargado correctamente.');
  }

  window.auroDiagnosticos = {
    version: VERSION,
    state,
    inicializar,
    cargar: cargarAtencion,
    cargarActual: cargarAtencionActual,
    cambiarPorAtencion,
    actualizar: () => cargarAtencionActual(true),
    generarIntegracion,
    alternarEdicionClinica,
    guardarIntegracionTemporal,
    aplicarAlPlan,
    limpiar: limpiarVisual,
    obtenerDiagnosticos: () => clonar(state.diagnosticos, []),
    obtenerProtocolos: () => clonar(state.protocolos, []),
    obtenerEstado: () => clonar(state, {}),
    montarInterfaz: asegurarApp,
    copiarCampo,
    abrirCampoAmpliado,
    alternarGuia
  };

  window.cambiarDiagnosticosPorAtencion = cambiarPorAtencion;
  window.auroCargarDiagnosticosPorAtencion = cargarAtencion;
  window.auroActualizarDiagnosticos = () => cargarAtencionActual(true);
  window.auroGenerarIntegracionDiagnostica = generarIntegracion;
  window.auroAplicarDiagnosticoAlPlan = aplicarAlPlan;

  window.auroDiagnosticosModuloCargado = true;

  function arrancarDiagnosticos(){
    try{
      asegurarApp();
      inicializar();
    }catch(error){
      console.error(MODULO + ': fallo de arranque.', error);
      setTimeout(arrancarDiagnosticos, 300);
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', arrancarDiagnosticos, {once:true});
  }else{
    arrancarDiagnosticos();
  }

  /* Segundo intento después de terminar de cargar todos los scripts externos. */
  window.addEventListener('load', () => {
    setTimeout(() => {
      try{
        asegurarApp();
        inicializar();
      }catch(error){
        console.error(MODULO + ': fallo en segundo montaje.', error);
      }
    }, 120);
  }, {once:true});
})();
