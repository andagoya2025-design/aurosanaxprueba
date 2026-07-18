/***********************************************************************
 AUROSANAX ERP DEMO
 Archivo: diagnosticos.js
 Módulo: Diagnósticos e integración clínica por atención
 Versión: 1.1.0 corregida - montaje y eventos por atención
 Fecha: 2026-07-18
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
************************************************************************/

(function(){
  'use strict';

  if(window.auroDiagnosticosModuloCargado){
    console.warn('AUROSANAX DIAGNÓSTICOS: el módulo ya estaba cargado.');
    return;
  }

  const MODULO = 'AUROSANAX DIAGNÓSTICOS';
  const VERSION = '1.1.0';

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
    ultimaActualizacion: ''
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
      .auro-dx-status{font-size:12px;padding:7px 10px;border-radius:999px;background:#edf7f7;color:#28626a;white-space:nowrap}
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
      .auro-dx-source div{padding:9px;border-radius:10px;background:#f6f9fa;font-size:12px}
      @media(max-width:900px){.auro-dx-grid{grid-template-columns:1fr}.auro-dx-source{grid-template-columns:1fr}.auro-dx-head{flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function appHTML(){
    return `
      <div class="auro-dx-shell">
        <div class="auro-dx-head">
          <div>
            <h3><i class="bi bi-clipboard2-pulse"></i> Diagnósticos</h3>
            <p>Integración clínica y protocolos asistidos por atención. La decisión final siempre corresponde al profesional.</p>
          </div>
          <div class="auro-dx-status" id="auroDxStatus">Sin atención activa</div>
        </div>

        <div class="auro-dx-toolbar">
          <button type="button" class="auro-dx-btn primary" id="auroDxActualizar">
            <i class="bi bi-arrow-repeat"></i> Actualizar información
          </button>
          <button type="button" class="auro-dx-btn" id="auroDxGenerar">
            <i class="bi bi-stars"></i> Generar integración clínica
          </button>
          <button type="button" class="auro-dx-btn success" id="auroDxAplicarPlan" disabled>
            <i class="bi bi-check2-circle"></i> Aplicar protocolo al Plan
          </button>
        </div>

        <div id="auroDxMensaje"></div>

        <div class="auro-dx-grid">
          <div class="auro-dx-card">
            <div class="auro-dx-card-head">Diagnósticos de la atención</div>
            <div class="auro-dx-card-body" id="auroDxLista"></div>
          </div>

          <div class="auro-dx-card">
            <div class="auro-dx-card-head">Integración clínica</div>
            <div class="auro-dx-card-body">
              <div class="auro-dx-section">
                <label class="auro-dx-label" for="auroDxResumen">Resumen clínico integrado</label>
                <textarea id="auroDxResumen" class="auro-dx-textarea" placeholder="Se generará a partir de los datos disponibles de la atención."></textarea>
              </div>
              <div class="auro-dx-section">
                <label class="auro-dx-label" for="auroDxAnalisis">Análisis / impresión clínica</label>
                <textarea id="auroDxAnalisis" class="auro-dx-textarea" placeholder="Revisión e interpretación clínica editable por el profesional."></textarea>
              </div>
              <div class="auro-dx-section">
                <label class="auro-dx-label" for="auroDxConducta">Conducta sugerida</label>
                <textarea id="auroDxConducta" class="auro-dx-textarea" placeholder="Conducta editable antes de transferir al Plan."></textarea>
              </div>
            </div>
          </div>
        </div>

        <div class="auro-dx-card">
          <div class="auro-dx-card-head">Protocolos clínicos disponibles</div>
          <div class="auro-dx-card-body" id="auroDxProtocolos">
            <div class="auro-dx-empty">Seleccione una atención con diagnósticos para consultar protocolos.</div>
          </div>
        </div>

        <div class="auro-dx-card">
          <div class="auro-dx-card-head">Fuentes clínicas integradas</div>
          <div class="auro-dx-card-body">
            <div class="auro-dx-source" id="auroDxFuentes"></div>
          </div>
        </div>

        <div class="auro-dx-warning">
          Las sugerencias no sustituyen el criterio médico. Revise indicaciones, contraindicaciones, alergias,
          embarazo, lactancia, función renal/hepática, interacciones y contexto clínico antes de aplicar al Plan.
        </div>
      </div>
    `;
  }

  function asegurarApp(){
    instalarEstilos();
    const panel = asegurarPanel();
    if(!panel){
      console.error(MODULO + ': no se encontró el panel hc_diagnostico.');
      return null;
    }

    /*
      AUROSANAX FIX 1.1.0:
      El index corregido dispone de un punto de montaje exclusivo.
      Si no existe, se usa directamente el panel. Nunca se inserta detrás
      de un título ambiguo ni dentro de un contenedor oculto heredado.
    */
    const mount = document.getElementById('auroDiagnosticosMount') || panel;
    let app = document.getElementById('auroDiagnosticosApp');

    if(!app){
      app = document.createElement('div');
      app.id = 'auroDiagnosticosApp';
      app.innerHTML = appHTML();
    }

    /* Reubicar el módulo si una versión anterior lo insertó en otro nodo. */
    if(app.parentElement !== mount){
      mount.appendChild(app);
    }

    /* Evita listeners duplicados aunque inicializar() se invoque varias veces. */
    if(app.dataset.eventosInstalados !== '1'){
      app.querySelector('#auroDxActualizar')?.addEventListener('click', () => cargarAtencionActual(true));
      app.querySelector('#auroDxGenerar')?.addEventListener('click', generarIntegracion);
      app.querySelector('#auroDxAplicarPlan')?.addEventListener('click', aplicarAlPlan);

      ['auroDxResumen','auroDxAnalisis','auroDxConducta'].forEach(id => {
        app.querySelector('#' + id)?.addEventListener('input', guardarEstadoTemporal);
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
      ['Atención activa', atencionActiva()],
      ['Historia clínica', state.historia],
      ['Examen físico', state.detalleExamen?.examen],
      ['Examen por sistemas', state.detalleExamen?.sistemas],
      ['Examen regional', state.detalleExamen?.regionales],
      ['Ginecología', state.especialidades.ginecologia],
      ['Obstetricia', state.especialidades.obstetricia],
      ['Estética', state.especialidades.estetica]
    ];

    box.innerHTML = fuentes.map(([nombre, valor]) => `
      <div><b>${escapeHtml(nombre)}</b><br>${fuenteTieneDatos(valor) ? 'Información disponible' : 'Sin registro para esta atención'}</div>
    `).join('');
  }

  function resumenObjeto(obj, exclusiones){
    if(!obj || typeof obj !== 'object') return '';
    const omitir = new Set(exclusiones || []);
    const partes = [];

    Object.keys(obj).forEach(k => {
      if(omitir.has(k)) return;
      const v = obj[k];
      if(v === null || v === undefined || v === '' || typeof v === 'function') return;
      if(Array.isArray(v)){
        if(v.length) partes.push(k.replace(/_/g,' ') + ': ' + v.map(x => typeof x === 'object' ? JSON.stringify(x) : x).join(', '));
      }else if(typeof v !== 'object'){
        partes.push(k.replace(/_/g,' ') + ': ' + texto(v));
      }
    });

    return partes.join(' | ');
  }

  function construirResumenClinico(){
    const a = atencionActiva() || {};
    const h = state.historia || {};
    const ex = state.detalleExamen?.examen || {};
    const principal = state.diagnosticos.find(d => d.principal) || state.diagnosticos[0];
    const secundarios = state.diagnosticos.filter(d => d !== principal);

    const bloques = [];

    const motivo = texto(
      a.motivo_consulta ||
      h.motivo_consulta ||
      getValue('hcMotivoConsulta') ||
      getValue('hcMotivo')
    );
    if(motivo) bloques.push('Motivo de consulta: ' + motivo + '.');

    const enfermedad = texto(
      h.enfermedad_actual ||
      h.anamnesis ||
      getValue('hcEnfermedadActual') ||
      getValue('hcAnamnesis')
    );
    if(enfermedad) bloques.push('Enfermedad actual/anamnesis: ' + enfermedad + '.');

    const vitales = [
      ex.presion_arterial ? 'PA ' + ex.presion_arterial : '',
      ex.frecuencia_cardiaca ? 'FC ' + ex.frecuencia_cardiaca : '',
      ex.temperatura ? 'T ' + ex.temperatura : '',
      ex.saturacion ? 'SatO₂ ' + ex.saturacion : '',
      ex.peso_kg ? 'peso ' + ex.peso_kg + ' kg' : '',
      ex.imc ? 'IMC ' + ex.imc : ''
    ].filter(Boolean);
    if(vitales.length) bloques.push('Signos vitales: ' + vitales.join(', ') + '.');

    if(texto(ex.examen_fisico)){
      bloques.push('Examen físico: ' + texto(ex.examen_fisico) + '.');
    }

    if(principal){
      bloques.push('Diagnóstico principal: ' + [principal.codigo_cie10, principal.descripcion, '(' + principal.tipo_diagnostico + ')'].filter(Boolean).join(' ') + '.');
    }

    if(secundarios.length){
      bloques.push('Diagnósticos secundarios: ' + secundarios.map(d => [d.codigo_cie10,d.descripcion,'(' + d.tipo_diagnostico + ')'].filter(Boolean).join(' ')).join('; ') + '.');
    }

    const gine = resumenObjeto(state.especialidades.ginecologia, ['id_atencion','id_paciente','id_historia','id_medico','fecha_creacion','fecha_actualizacion']);
    if(gine) bloques.push('Ginecología: ' + gine + '.');

    const obst = resumenObjeto(state.especialidades.obstetricia, ['id_atencion','id_paciente','id_historia','id_medico','fecha_creacion','fecha_actualizacion']);
    if(obst) bloques.push('Obstetricia: ' + obst + '.');

    const est = resumenObjeto(state.especialidades.estetica, ['id_atencion','id_paciente','id_historia','id_medico','fecha_creacion','fecha_actualizacion']);
    if(est) bloques.push('Estética/funcional: ' + est + '.');

    return bloques.join('\n');
  }

  function construirAnalisis(){
    const principal = state.diagnosticos.find(d => d.principal) || state.diagnosticos[0];
    const secundarios = state.diagnosticos.filter(d => d !== principal);
    const lineas = [];

    if(principal){
      lineas.push(
        'Impresión diagnóstica principal: ' +
        [principal.codigo_cie10, principal.descripcion].filter(Boolean).join(' - ') +
        '. Clasificación registrada: ' + (principal.tipo_diagnostico || 'Presuntivo') + '.'
      );
    }

    if(secundarios.length){
      lineas.push(
        'Diagnósticos asociados: ' +
        secundarios.map(d => [d.codigo_cie10,d.descripcion].filter(Boolean).join(' - ')).join('; ') + '.'
      );
    }

    if(state.detalleExamen?.examen?.examen_fisico){
      lineas.push('Los hallazgos del examen físico deben correlacionarse con la anamnesis, antecedentes y estudios complementarios disponibles.');
    }

    if(state.protocolos.length){
      lineas.push('Existen ' + state.protocolos.length + ' protocolo(s) clínico(s) activo(s) disponible(s) para revisión.');
    }else{
      lineas.push('No se encontró un protocolo activo específico; la conducta deberá individualizarse según valoración clínica.');
    }

    lineas.push('Confirmar coherencia diagnóstica, severidad, diagnósticos diferenciales, comorbilidades, alergias, embarazo/lactancia, interacciones y signos de alarma antes de definir conducta.');

    return lineas.join('\n');
  }

  function construirConducta(){
    const p = state.protocoloSeleccionado !== null ? state.protocolos[state.protocoloSeleccionado] : null;
    if(!p){
      return 'Definir conducta individualizada según valoración clínica, evolución, resultados de estudios y criterio del profesional tratante.';
    }

    const partes = [];
    if(p.conducta) partes.push(p.conducta);
    if(p.indicaciones.length) partes.push('Indicaciones: ' + p.indicaciones.join('; ') + '.');
    if(p.controles.length) partes.push('Control/seguimiento: ' + p.controles.join('; ') + '.');
    if(p.alertas.length) partes.push('Alertas a considerar: ' + p.alertas.join('; ') + '.');
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

    state.resumenClinico = construirResumenClinico();
    state.analisisClinico = construirAnalisis();
    state.conducta = construirConducta();

    const r = document.getElementById('auroDxResumen');
    const a = document.getElementById('auroDxAnalisis');
    const c = document.getElementById('auroDxConducta');
    if(r) r.value = state.resumenClinico;
    if(a) a.value = state.analisisClinico;
    if(c) c.value = state.conducta;

    guardarEstadoTemporal();
    mensaje('ok','Integración clínica generada. Revise y edite el contenido antes de aplicarlo al Plan.');
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
      ultimaActualizacion: new Date().toISOString()
    };
  }

  function restaurarEstadoTemporal(id){
    const cache = state.cache[id];
    if(!cache) return;

    state.resumenClinico = texto(cache.resumenClinico);
    state.analisisClinico = texto(cache.analisisClinico);
    state.conducta = texto(cache.conducta);
    state.protocoloSeleccionado = Number.isInteger(cache.protocoloSeleccionado) ? cache.protocoloSeleccionado : null;

    const r = document.getElementById('auroDxResumen');
    const a = document.getElementById('auroDxAnalisis');
    const c = document.getElementById('auroDxConducta');
    if(r) r.value = state.resumenClinico;
    if(a) a.value = state.analisisClinico;
    if(c) c.value = state.conducta;
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

    ['auroDxResumen','auroDxAnalisis','auroDxConducta'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = '';
    });

    renderDiagnosticos();
    renderProtocolos();
    renderFuentes();
    const btn = document.getElementById('auroDxAplicarPlan');
    if(btn) btn.disabled = true;
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

      state.ultimaActualizacion = new Date().toISOString();
      status('Atención ' + idAtencion + ' · ' + state.diagnosticos.length + ' diagnóstico(s)');

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
    aplicarAlPlan,
    limpiar: limpiarVisual,
    obtenerDiagnosticos: () => clonar(state.diagnosticos, []),
    obtenerProtocolos: () => clonar(state.protocolos, []),
    obtenerEstado: () => clonar(state, {})
  };

  window.cambiarDiagnosticosPorAtencion = cambiarPorAtencion;
  window.auroCargarDiagnosticosPorAtencion = cargarAtencion;
  window.auroActualizarDiagnosticos = () => cargarAtencionActual(true);
  window.auroGenerarIntegracionDiagnostica = generarIntegracion;
  window.auroAplicarDiagnosticoAlPlan = aplicarAlPlan;

  window.auroDiagnosticosModuloCargado = true;

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', inicializar);
  }else{
    inicializar();
  }
})();
