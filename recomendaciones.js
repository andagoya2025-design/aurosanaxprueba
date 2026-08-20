/***********************************************************************
 AUROSANAX ERP DEMO
 Archivo: recomendaciones.js
 Módulo: Recomendaciones clínicas por atención
 Versión: 1.0.2
 Fecha: 2026-08-12
 -----------------------------------------------------------------------
 ARQUITECTURA
 - Módulo funcional independiente.
 - Una sola fila por id_atencion en la hoja recomendaciones.
 - detalle_json compacto para contenido variable.
 - Contexto clínico derivado desde la atención real.
 - Diagnósticos solo se leen; NO se duplican ni se modifican.
 - Consulta histórica: solo lectura.
 - Atención activa: editable.
 - Responsive: escritorio, tablet, iPhone y Android.
 - No modifica Plan, Recetas, Diagnóstico, Examen Físico ni Historia.
************************************************************************/

(function(){
  'use strict';

  if(window.auroRecomendaciones && window.auroRecomendaciones.version){
    console.warn('AUROSANAX RECOMENDACIONES: módulo ya cargado.');
    return;
  }

  const MODULO = 'AUROSANAX RECOMENDACIONES';
  const VERSION = '1.0.2';
  const JSON_VERSION = 'AUROSANAX_RECOMENDACIONES_JSON_V1';

  const state = {
    idAtencion: '',
    idRecomendacion: '',
    contexto: null,
    diagnosticos: [],
    registro: null,
    cargando: false,
    guardando: false,
    inicializado: false,
    tokenCarga: 0
  };

  const ALERTAS = [
    ['fiebre','Fiebre que no cede'],
    ['dolor','Dolor intenso o que no cede'],
    ['sangrado','Sangrado anormal o abundante'],
    ['dificultad_respiratoria','Dificultad respiratoria'],
    ['vomito','Vómitos persistentes'],
    ['diarrea','Diarrea persistente'],
    ['mareo_desmayo','Mareo intenso o desmayo'],
    ['deterioro_general','Deterioro del estado general']
  ];

  const INFECCION = [
    ['fiebre_infeccion','Fiebre o escalofríos'],
    ['dolor_local','Dolor local en aumento'],
    ['enrojecimiento','Enrojecimiento progresivo'],
    ['inflamacion','Inflamación importante'],
    ['secrecion','Secreción anormal o purulenta'],
    ['mal_olor','Mal olor'],
    ['calor_local','Aumento de calor local']
  ];

  function txt(v){ return String(v === null || v === undefined ? '' : v).trim(); }

  function norm(v){
    return txt(v)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/\s+/g,' ')
      .trim();
  }

  function esc(v){
    return String(v || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function apiUrl(){
    try{
      if(typeof API_URL !== 'undefined' && API_URL) return txt(API_URL);
    }catch(e){}
    return txt(window.API_URL || document.getElementById('appsScriptUrl')?.value);
  }

  async function apiGet(accion, params){
    const base = apiUrl();
    if(!base) throw new Error('API_URL no está definida.');

    const q = new URLSearchParams({accion:accion, _:String(Date.now())});
    Object.keys(params || {}).forEach(k=>{
      const v = params[k];
      if(v !== undefined && v !== null && txt(v)) q.append(k, v);
    });

    const r = await fetch(base + '?' + q.toString(), {
      method:'GET',
      cache:'no-store'
    });

    if(!r.ok) throw new Error('Error HTTP ' + r.status + ' en ' + accion);
    return await r.json();
  }

  async function apiPost(accion, data){
    const base = apiUrl();
    if(!base) throw new Error('API_URL no está definida.');

    const r = await fetch(base, {
      method:'POST',
      body:JSON.stringify({
        accion:accion,
        data:data || {}
      })
    });

    if(!r.ok) throw new Error('Error HTTP ' + r.status + ' en ' + accion);
    return await r.json();
  }

  function atencionActiva(){
    try{
      if(typeof window.getAtencionActiva === 'function'){
        const a = window.getAtencionActiva();
        if(a && txt(a.id_atencion)) return a;
      }
    }catch(e){}

    try{
      if(typeof window.obtenerContextoAtencionActual === 'function'){
        const c = window.obtenerContextoAtencionActual();
        if(c && txt(c.id_atencion)) return c;
      }
    }catch(e){}

    return window.atencionesState?.atencionActual ||
           window.currentAttention ||
           window.atencionActual ||
           null;
  }

  function idAtencionActiva(){
    try{
      if(typeof window.getIdAtencionActiva === 'function'){
        const id = txt(window.getIdAtencionActiva());
        if(id) return id;
      }
    }catch(e){}

    const a = atencionActiva();
    return txt(
      a?.id_atencion ||
      window.planState?.atencionActual ||
      window.examenFisicoState?.atencionActual ||
      window.auroDiagnosticosState?.atencionActual
    );
  }

  function atencionesLocales(){
    try{
      const raw = localStorage.getItem('aurosanax_atenciones_local_v1');
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    }catch(e){
      return [];
    }
  }

  function tiempoAtencion(a){
    const raw = txt(
      a?.fecha_atencion || a?.fecha_consulta || a?.fecha ||
      a?.creado_en || a?.fecha_creacion || a?.actualizado_en
    );
    const n = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(n) ? n : 0;
  }

  function contextoAtencion(){
    const actual = atencionActiva() || {};
    const id = txt(actual.id_atencion || idAtencionActiva());
    if(!id) return {id:'', atencion:{}, editable:false, historica:false, cerrada:false};

    /*
      AUROSANAX FIX QUIRÚRGICO 2026-08-12:
      La autoridad clínica es la atención seleccionada/activa del ERP.
      localStorage se usa únicamente como respaldo descriptivo y NUNCA
      para decidir que una atención abierta es histórica solo porque
      otra fila local tenga fecha o número de consulta superior.
      Este criterio replica el patrón estable del Plan: una atención
      seleccionada es editable mientras no esté explícitamente cerrada.
    */
    const local = atencionesLocales();
    const localRegistro = local.find(a=>txt(a?.id_atencion) === id) || {};
    const registro = Object.assign({}, localRegistro, actual);

    const idPaciente = txt(registro.id_paciente || actual.id_paciente);
    const estado = norm(
      actual.estado_atencion ||
      actual.estado ||
      actual.estado_consulta ||
      registro.estado_atencion ||
      registro.estado ||
      registro.estado_consulta
    );

    /*
      AUROSANAX RECOMENDACIONES 2026-08-12:
      El cierre clínico de la atención NO equivale al cierre documental
      de Recomendaciones. Una atención finalizada/cerrada/completada
      puede todavía requerir emisión o corrección de recomendaciones.

      Solo se bloquean estados que invalidan la atención como documento
      clínico operativo: anulada, cancelada o archivada.
    */
    const finalizada = /(cerrad|finaliz|complet)/.test(estado);
    const bloqueada = /(anulad|cancelad|archivad)/.test(estado);
    const editable = !!id && !bloqueada;

    return {
      id:id,
      atencion:registro,
      idPaciente:idPaciente,
      numeroConsulta:txt(
        actual.numero_consulta ||
        actual.numero_atencion ||
        registro.numero_consulta ||
        registro.numero_atencion
      ),
      estadoAtencion:estado,
      finalizada:finalizada,
      bloqueada:bloqueada,
      editable:editable,
      historica:!!id && bloqueada
    };
  }

  function primerTexto(){
    for(let i=0;i<arguments.length;i++){
      const v=txt(arguments[i]);
      if(v) return v;
    }
    return '';
  }

  function valorCampo(){
    for(let i=0;i<arguments.length;i++){
      const el=document.getElementById(arguments[i]);
      if(!el) continue;

      if(el.tagName === 'SELECT'){
        const opcion=el.options?.[el.selectedIndex];
        const t=txt(opcion?.textContent);
        if(t && !/^seleccione/i.test(t)) return t;
      }

      const v=txt(el.value || el.textContent);
      if(v) return v;
    }
    return '';
  }

  function nombreMedicoDesdeContexto(atencion){
    const a=atencion || {};
    const activa=atencionActiva() || {};

    return primerTexto(
      a.nombre_medico,
      a.medico_nombre,
      a.nombre_profesional,
      a.profesional_nombre,
      a.doctor_nombre,
      activa.nombre_medico,
      activa.medico_nombre,
      activa.nombre_profesional,
      activa.profesional_nombre,
      activa.doctor_nombre,
      window.currentAttention?.nombre_medico,
      window.currentAttention?.medico_nombre,
      window.atencionActual?.nombre_medico,
      window.atencionActual?.medico_nombre,
      valorCampo('hcProfesional','hcMedico','atencionProfesional','atencionMedico'),
      document.querySelector('.doctor-pill strong')?.textContent,
      document.querySelector('.doctor-pill b')?.textContent
    );
  }

  function nombrePacienteDesdeContexto(atencion){
    const a=atencion || {};
    const activa=atencionActiva() || {};

    return primerTexto(
      a.nombre_paciente,
      a.paciente_nombre,
      activa.nombre_paciente,
      activa.paciente_nombre,
      window.currentAttention?.nombre_paciente,
      window.atencionActual?.nombre_paciente,
      valorCampo('hcPacienteNombre','hcNombrePaciente')
    );
  }

  async function enriquecerContextoDesdeServidor(ctx){
    if(!ctx || !ctx.id) return ctx;

    const a=ctx.atencion || {};
    const faltaMedico=!nombreMedicoDesdeContexto(a);
    const faltaPaciente=!nombrePacienteDesdeContexto(a);
    const faltaNumero=!txt(ctx.numeroConsulta);

    if(!faltaMedico && !faltaPaciente && !faltaNumero) return ctx;

    try{
      const data=await apiGet('listarAtenciones');
      const lista=Array.isArray(data)
        ? data
        : (Array.isArray(data?.registros) ? data.registros : []);

      const encontrada=lista.find(item=>txt(item?.id_atencion)===txt(ctx.id));
      if(!encontrada) return ctx;

      ctx.atencion=Object.assign({}, a, encontrada);
      ctx.numeroConsulta=primerTexto(
        encontrada.numero_consulta,
        encontrada.numero_atencion,
        ctx.numeroConsulta
      );
      return ctx;
    }catch(error){
      console.warn(MODULO+': no se pudo enriquecer el contexto descriptivo.',error);
      return ctx;
    }
  }

  function parseDetalle(valor){
    if(valor && typeof valor === 'object') return valor;
    const raw = txt(valor);
    if(!raw) return {};
    try{
      const d = JSON.parse(raw);
      return d && typeof d === 'object' ? d : {};
    }catch(e){
      return {};
    }
  }

  function fechaVisual(valor){
    const raw = txt(valor);
    if(!raw) return '—';
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if(m){
      return `${m[3]}/${m[2]}/${m[1]}${m[4] ? ' · '+m[4]+':'+m[5] : ''}`;
    }
    const d = new Date(raw);
    if(!Number.isNaN(d.getTime())){
      return d.toLocaleString('es-EC',{
        day:'2-digit',month:'2-digit',year:'numeric',
        hour:'2-digit',minute:'2-digit',hour12:false
      });
    }
    return raw;
  }

  function setMsg(texto, tipo){
    const el = document.getElementById('auroRecMensaje');
    if(!el) return;
    el.className = 'auro-rec-msg ' + (tipo || 'info');
    el.innerHTML = texto ? esc(texto) : '';
    el.hidden = !texto;
  }

  function instalarEstilos(){
    if(document.getElementById('auroRecomendacionesStyles')) return;

    const style=document.createElement('style');
    style.id='auroRecomendacionesStyles';
    style.textContent=`
      #auroRecomendacionesApp{width:100%;max-width:1180px;margin:0 auto;color:#1f2937}
      #auroRecomendacionesApp *{box-sizing:border-box}
      .auro-rec-shell{display:grid;gap:16px}
      .auro-rec-hero{border:1px solid #ead7e2;border-radius:22px;background:linear-gradient(135deg,#fff,#fff7fb);box-shadow:0 12px 34px rgba(139,30,90,.07);overflow:hidden}
      .auro-rec-hero-main{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;align-items:center;padding:17px 18px}
      .auro-rec-icon{width:48px;height:48px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(135deg,#8b1e5a,#c23b83);color:#fff;font-size:22px;box-shadow:0 9px 20px rgba(139,30,90,.2)}
      .auro-rec-kicker{font-size:10px;letter-spacing:.08em;font-weight:950;color:#8b1e5a;text-transform:uppercase}
      .auro-rec-title{font-size:20px;font-weight:950;line-height:1.2;margin-top:2px;color:#111827}
      .auro-rec-sub{font-size:12px;color:#64748b;font-weight:700;margin-top:4px;overflow-wrap:anywhere}
      .auro-rec-state{display:inline-flex;align-items:center;gap:7px;border-radius:999px;padding:8px 11px;font-size:11px;font-weight:900;white-space:nowrap}
      .auro-rec-state.edit{background:#dcfce7;color:#166534}
      .auro-rec-state.read{background:#f1f5f9;color:#475569}
      .auro-rec-context{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid #f0e1e9;background:rgba(255,255,255,.72)}
      .auro-rec-context-item{padding:11px 14px;border-right:1px solid #f0e1e9;min-width:0}
      .auro-rec-context-item:last-child{border-right:0}
      .auro-rec-context-item span{display:block;color:#8b7280;font-size:10px;text-transform:uppercase;font-weight:900;letter-spacing:.05em}
      .auro-rec-context-item b{display:block;margin-top:3px;font-size:12px;overflow-wrap:anywhere}
      .auro-rec-card{border:1px solid #e5e7eb;border-radius:20px;background:#fff;overflow:hidden;box-shadow:0 8px 25px rgba(15,23,42,.04)}
      .auro-rec-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:13px 15px;background:#2f1f3a;color:#fff}
      .auro-rec-card-head b{font-size:13px}
      .auro-rec-card-head small{display:block;opacity:.8;font-size:11px;margin-top:2px;line-height:1.35}
      .auro-rec-card-body{padding:15px}
      .auro-rec-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .auro-rec-field label{display:block;font-size:12px;font-weight:850;color:#374151;margin-bottom:6px}
      .auro-rec-field input,.auro-rec-field textarea,.auro-rec-field select{width:100%;border:1px solid #dbe1e8;border-radius:13px;padding:10px 11px;font:inherit;color:#111827;background:#fff}
      .auro-rec-field textarea{min-height:110px;resize:vertical;line-height:1.45}
      .auro-rec-field input:focus,.auro-rec-field textarea:focus,.auro-rec-field select:focus{outline:none;border-color:#c23b83;box-shadow:0 0 0 3px rgba(194,59,131,.12)}
      .auro-rec-check-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .auro-rec-check{display:flex;align-items:flex-start;gap:8px;padding:9px 10px;border:1px solid #edf0f3;border-radius:13px;background:#fff;min-height:44px;font-size:13px;font-weight:650;line-height:1.3}
      .auro-rec-check input{width:17px;height:17px;accent-color:#8b1e5a;flex:0 0 auto;margin-top:1px}
      .auro-rec-dx-list{display:grid;gap:8px}
      .auro-rec-dx{display:grid;grid-template-columns:86px minmax(0,1fr) 96px;gap:10px;align-items:center;padding:10px 11px;border:1px solid #e8edf1;border-radius:13px;background:#f8fafc}
      .auro-rec-dx-code{display:inline-flex;align-items:center;justify-content:center;min-height:30px;padding:5px 8px;border-radius:10px;background:#fff0f7;border:1px solid #f3c7df;font-size:12px;font-weight:950;color:#8b1e5a;text-align:center;white-space:nowrap}
      .auro-rec-dx-name{min-width:0;font-size:13px;font-weight:750;line-height:1.35;overflow-wrap:anywhere}
      .auro-rec-dx-tag{display:inline-flex;align-items:center;justify-content:center;min-height:28px;font-size:10px;font-weight:900;padding:4px 7px;border-radius:999px;background:#fff;border:1px solid #dbe1e8;color:#475569;text-align:center}
      .auro-rec-empty{padding:12px;border:1px dashed #cbd5e1;border-radius:13px;color:#64748b;font-size:12px;text-align:center}
      .auro-rec-actions{display:flex;justify-content:flex-end;gap:9px;flex-wrap:wrap;position:sticky;bottom:10px;z-index:3;padding:12px;border:1px solid #ead7e2;border-radius:18px;background:rgba(255,255,255,.96);backdrop-filter:blur(10px);box-shadow:0 12px 30px rgba(15,23,42,.08)}
      .auro-rec-btn{border:1px solid #e5e7eb;background:#fff;color:#374151;border-radius:13px;padding:10px 13px;font-weight:850;cursor:pointer}
      .auro-rec-btn.primary{border:0;background:linear-gradient(135deg,#8b1e5a,#c23b83);color:#fff}
      .auro-rec-btn:disabled{opacity:.5;cursor:not-allowed}
      .auro-rec-msg{padding:10px 12px;border-radius:13px;font-size:12px;font-weight:750}
      .auro-rec-msg.info{background:#eff6ff;color:#1e3a8a;border:1px solid #bfdbfe}
      .auro-rec-msg.ok{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}
      .auro-rec-msg.error{background:#fff1f2;color:#9f1239;border:1px solid #fecdd3}
      .auro-rec-readonly input,.auro-rec-readonly textarea,.auro-rec-readonly select{background:#f8fafc!important;color:#475569!important}
      @media(max-width:900px){
        .auro-rec-context{grid-template-columns:repeat(2,minmax(0,1fr))}
        .auro-rec-context-item{border-bottom:1px solid #f0e1e9}
        .auro-rec-context-item:nth-child(2n){border-right:0}
      }
      @media(max-width:640px){
        html,body{max-width:100%;overflow-x:hidden}
        #hc_recomendaciones,#auroRecomendacionesMount,#auroRecomendacionesApp{width:100%!important;max-width:100%!important;min-width:0!important;overflow-x:hidden!important}
        .auro-rec-shell{gap:11px}
        .auro-rec-hero{border-radius:17px}
        .auro-rec-hero-main{grid-template-columns:auto minmax(0,1fr);padding:13px;gap:10px}
        .auro-rec-icon{width:42px;height:42px;border-radius:13px}
        .auro-rec-title{font-size:18px}
        .auro-rec-state{grid-column:1/-1;width:100%;justify-content:center;white-space:normal;text-align:center}
        .auro-rec-context{grid-template-columns:1fr}
        .auro-rec-context-item{border-right:0;border-bottom:1px solid #f0e1e9;padding:9px 12px}
        .auro-rec-grid-2,.auro-rec-check-grid{grid-template-columns:1fr}
        .auro-rec-card{border-radius:16px}
        .auro-rec-card-head{padding:11px 12px}
        .auro-rec-card-body{padding:12px}
        .auro-rec-field input,.auro-rec-field textarea,.auro-rec-field select{font-size:16px;min-height:44px}
        .auro-rec-field textarea{min-height:135px}
        .auro-rec-check{min-height:48px;font-size:13px;padding:10px}
        .auro-rec-actions{display:grid;grid-template-columns:1fr;bottom:6px;padding:9px}
        .auro-rec-btn{width:100%;min-height:46px;font-size:14px}
        .auro-rec-dx{grid-template-columns:78px minmax(0,1fr);align-items:start}
        .auro-rec-dx-code{width:78px}
        .auro-rec-dx-tag{grid-column:2;width:max-content;max-width:100%;margin-top:-2px}
      }
    `;
    document.head.appendChild(style);
  }

  function checksHtml(lista, prefijo){
    return lista.map(([key,label])=>`
      <label class="auro-rec-check">
        <input type="checkbox" data-auro-rec-check="${esc(prefijo)}" value="${esc(key)}">
        <span>${esc(label)}</span>
      </label>
    `).join('');
  }

  function appHtml(){
    return `
      <div id="auroRecomendacionesApp">
        <div class="auro-rec-shell">
          <section class="auro-rec-hero">
            <div class="auro-rec-hero-main">
              <div class="auro-rec-icon"><i class="bi bi-heart-pulse"></i></div>
              <div>
                <div class="auro-rec-kicker">Recomendaciones clínicas</div>
                <div class="auro-rec-title" id="auroRecPaciente">Sin atención seleccionada</div>
                <div class="auro-rec-sub" id="auroRecAtencion">Seleccione una atención para trabajar sus recomendaciones.</div>
              </div>
              <div class="auro-rec-state read" id="auroRecEstado"><i class="bi bi-lock"></i> Sin atención</div>
            </div>
            <div class="auro-rec-context">
              <div class="auro-rec-context-item"><span>Consulta</span><b id="auroRecConsulta">—</b></div>
              <div class="auro-rec-context-item"><span>Médico</span><b id="auroRecMedico">—</b></div>
              <div class="auro-rec-context-item"><span>Fecha atención</span><b id="auroRecFecha">—</b></div>
              <div class="auro-rec-context-item"><span>Última actualización</span><b id="auroRecActualizado">—</b></div>
            </div>
          </section>

          <div id="auroRecMensaje" class="auro-rec-msg info" hidden></div>

          <section class="auro-rec-card">
            <div class="auro-rec-card-head">
              <div><b>Diagnósticos de esta atención</b><small>Lectura automática. Recomendaciones no modifica el módulo Diagnóstico.</small></div>
            </div>
            <div class="auro-rec-card-body">
              <div id="auroRecDiagnosticos" class="auro-rec-dx-list">
                <div class="auro-rec-empty">Sin diagnósticos cargados.</div>
              </div>
            </div>
          </section>

          <section class="auro-rec-card">
            <div class="auro-rec-card-head">
              <div><b>Seguimiento</b><small>Próxima revisión y motivo del control.</small></div>
            </div>
            <div class="auro-rec-card-body">
              <div class="auro-rec-grid-2">
                <div class="auro-rec-field">
                  <label for="auroRecProximaCita">Próxima cita / control</label>
                  <input id="auroRecProximaCita" type="date">
                </div>
                <div class="auro-rec-field">
                  <label for="auroRecMotivoControl">Motivo de próxima cita</label>
                  <input id="auroRecMotivoControl" type="text" placeholder="Ej.: control de resultados, revisión, procedimiento...">
                </div>
              </div>
            </div>
          </section>

          <section class="auro-rec-card">
            <div class="auro-rec-card-head">
              <div><b>Signos de alerta</b><small>Marque las opciones aplicables. Use “Otros signos / observaciones” para escribir indicaciones adicionales.</small></div>
            </div>
            <div class="auro-rec-card-body">
              <div class="auro-rec-check-grid">${checksHtml(ALERTAS,'alerta')}</div>
              <div class="auro-rec-field" style="margin-top:12px">
                <label for="auroRecAlertaOtros">Otros signos / observaciones</label>
                <textarea id="auroRecAlertaOtros" placeholder="Otros signos de alarma o aclaraciones específicas."></textarea>
              </div>
            </div>
          </section>

          <section class="auro-rec-card">
            <div class="auro-rec-card-head">
              <div><b>Signos de infección</b><small>Marque las opciones aplicables y escriba aclaraciones libres en el campo de observaciones.</small></div>
            </div>
            <div class="auro-rec-card-body">
              <div class="auro-rec-check-grid">${checksHtml(INFECCION,'infeccion')}</div>
              <div class="auro-rec-field" style="margin-top:12px">
                <label for="auroRecInfeccionOtros">Otros signos / observaciones</label>
                <textarea id="auroRecInfeccionOtros" placeholder="Observaciones relacionadas con infección o cuidados locales."></textarea>
              </div>
            </div>
          </section>

          <section class="auro-rec-card">
            <div class="auro-rec-card-head">
              <div><b>Dieta y cuidados</b><small>Indicaciones dietéticas, actividad, higiene y cuidados domiciliarios.</small></div>
            </div>
            <div class="auro-rec-card-body">
              <div class="auro-rec-field">
                <label for="auroRecDieta">Dieta / cuidados recomendados</label>
                <textarea id="auroRecDieta" placeholder="Ej.: hidratación, dieta, reposo relativo, higiene, cuidados del procedimiento..."></textarea>
              </div>
            </div>
          </section>

          <section class="auro-rec-card">
            <div class="auro-rec-card-head">
              <div><b>Recomendaciones generales</b><small>Texto final entregable al paciente. Debe ser revisado por el profesional.</small></div>
            </div>
            <div class="auro-rec-card-body">
              <div class="auro-rec-field">
                <label for="auroRecGenerales">Recomendaciones para el paciente</label>
                <textarea id="auroRecGenerales" style="min-height:180px" placeholder="Escriba las recomendaciones finales de esta atención."></textarea>
              </div>
            </div>
          </section>

          <div class="auro-rec-actions">
            <button type="button" class="auro-rec-btn" id="auroRecBtnRecargar"><i class="bi bi-arrow-repeat me-1"></i> Recargar</button>
            <button type="button" class="auro-rec-btn" id="auroRecBtnVista"><i class="bi bi-printer me-1"></i> Vista previa / imprimir</button>
            <button type="button" class="auro-rec-btn primary" id="auroRecBtnGuardar"><i class="bi bi-save2 me-1"></i> Guardar recomendaciones</button>
          </div>
        </div>
      </div>
    `;
  }

  function asegurarMount(){
    const mount = document.getElementById('auroRecomendacionesMount');
    if(!mount) return null;
    if(!document.getElementById('auroRecomendacionesApp')){
      mount.innerHTML = appHtml();
    }
    return mount;
  }

  function setText(id, valor){
    const el=document.getElementById(id);
    if(el) el.textContent=valor;
  }

  function setValue(id, valor){
    const el=document.getElementById(id);
    if(el) el.value=valor || '';
  }

  function getValue(id){
    return txt(document.getElementById(id)?.value);
  }

  function checksSeleccionados(tipo){
    return Array.from(document.querySelectorAll(`[data-auro-rec-check="${tipo}"]:checked`))
      .map(el=>txt(el.value))
      .filter(Boolean);
  }

  function aplicarChecks(tipo, valores){
    const set=new Set(Array.isArray(valores) ? valores.map(txt) : []);
    document.querySelectorAll(`[data-auro-rec-check="${tipo}"]`).forEach(el=>{
      el.checked=set.has(txt(el.value));
    });
  }

  function limpiar(){
    state.idRecomendacion='';
    state.registro=null;
    setValue('auroRecProximaCita','');
    setValue('auroRecMotivoControl','');
    setValue('auroRecAlertaOtros','');
    setValue('auroRecInfeccionOtros','');
    setValue('auroRecDieta','');
    setValue('auroRecGenerales','');
    aplicarChecks('alerta',[]);
    aplicarChecks('infeccion',[]);
    setText('auroRecActualizado','Sin guardar aún');
  }

  function renderDiagnosticos(){
    const box=document.getElementById('auroRecDiagnosticos');
    if(!box) return;

    if(!state.diagnosticos.length){
      box.innerHTML='<div class="auro-rec-empty">Sin diagnósticos registrados para esta atención.</div>';
      return;
    }

    box.innerHTML=state.diagnosticos.map((d,i)=>{
      const codigo=txt(d.codigo_cie10 || d.codigo || d.cie10);
      const nombre=txt(d.descripcion || d.nombre || d.diagnostico);
      const principal = d.principal === true || ['si','sí','true','1'].includes(norm(d.principal)) || i===0;
      return `<div class="auro-rec-dx">
        <div class="auro-rec-dx-code">${esc(codigo || '—')}</div>
        <div class="auro-rec-dx-name">${esc(nombre || 'Diagnóstico sin descripción')}</div>
        <div class="auro-rec-dx-tag">${principal ? 'Principal' : esc(txt(d.tipo_diagnostico || d.tipo || 'Asociado'))}</div>
      </div>`;
    }).join('');
  }

  function precargarSeguimientoDesdePlanSiVacio(){
    if(state.idRecomendacion) return false;
    if(getValue('auroRecMotivoControl')) return false;

    const candidatos = [
      'hcProximoControl',
      'hcControl',
      'hcSeguimiento'
    ];

    for(const id of candidatos){
      const el=document.getElementById(id);
      const valor=txt(el?.value || el?.textContent);
      if(!valor) continue;

      setValue('auroRecMotivoControl',valor);
      return true;
    }

    return false;
  }

  function detalleActual(){
    return {
      version:JSON_VERSION,
      seguimiento:{
        proxima_cita:getValue('auroRecProximaCita'),
        motivo:getValue('auroRecMotivoControl')
      },
      signos_alerta:{
        seleccionados:checksSeleccionados('alerta'),
        otros:getValue('auroRecAlertaOtros')
      },
      signos_infeccion:{
        seleccionados:checksSeleccionados('infeccion'),
        otros:getValue('auroRecInfeccionOtros')
      },
      dieta_cuidados:getValue('auroRecDieta'),
      recomendaciones_generales:getValue('auroRecGenerales')
    };
  }

  function tieneContenido(detalle){
    const d=detalle || {};
    return !!(
      txt(d?.seguimiento?.proxima_cita) ||
      txt(d?.seguimiento?.motivo) ||
      (Array.isArray(d?.signos_alerta?.seleccionados) && d.signos_alerta.seleccionados.length) ||
      txt(d?.signos_alerta?.otros) ||
      (Array.isArray(d?.signos_infeccion?.seleccionados) && d.signos_infeccion.seleccionados.length) ||
      txt(d?.signos_infeccion?.otros) ||
      txt(d?.dieta_cuidados) ||
      txt(d?.recomendaciones_generales)
    );
  }

  function aplicarRegistro(registro){
    state.registro=registro || null;
    state.idRecomendacion=txt(registro?.id_recomendacion);

    const d=parseDetalle(registro?.detalle_json);
    setValue('auroRecProximaCita',d?.seguimiento?.proxima_cita);
    setValue('auroRecMotivoControl',d?.seguimiento?.motivo);
    aplicarChecks('alerta',d?.signos_alerta?.seleccionados);
    setValue('auroRecAlertaOtros',d?.signos_alerta?.otros);
    aplicarChecks('infeccion',d?.signos_infeccion?.seleccionados);
    setValue('auroRecInfeccionOtros',d?.signos_infeccion?.otros);
    setValue('auroRecDieta',d?.dieta_cuidados);
    setValue('auroRecGenerales',d?.recomendaciones_generales);

    setText(
      'auroRecActualizado',
      fechaVisual(registro?.actualizado_en || registro?.creado_en)
    );
  }

  function aplicarModo(){
    const ctx=state.contexto || contextoAtencion();
    const editable=ctx.editable === true;
    const app=document.getElementById('auroRecomendacionesApp');
    if(app) app.classList.toggle('auro-rec-readonly',!editable);

    document.querySelectorAll(
      '#auroRecomendacionesApp input,#auroRecomendacionesApp textarea,#auroRecomendacionesApp select'
    ).forEach(el=>{
      el.disabled=!editable;
    });

    const guardar=document.getElementById('auroRecBtnGuardar');
    if(guardar) guardar.disabled=!editable || !ctx.id;

    const estado=document.getElementById('auroRecEstado');
    if(estado){
      estado.className='auro-rec-state ' + (editable ? 'edit' : 'read');

      if(!ctx.id){
        estado.innerHTML='<i class="bi bi-lock"></i> Sin atención';
      }else if(ctx.bloqueada){
        estado.innerHTML='<i class="bi bi-lock"></i> Atención anulada/cancelada · Solo lectura';
      }else if(ctx.finalizada){
        estado.innerHTML='<i class="bi bi-check2-circle"></i> Atención finalizada · Recomendaciones editables';
      }else{
        estado.innerHTML='<i class="bi bi-pencil-square"></i> Atención activa · Editable';
      }
    }
  }

  function renderContexto(){
    const ctx=state.contexto || contextoAtencion();
    const a=ctx.atencion || {};

    setText('auroRecPaciente',nombrePacienteDesdeContexto(a) || 'Paciente de la atención');
    setText('auroRecAtencion',ctx.id ? 'Atención: '+ctx.id : 'Sin atención seleccionada');
    setText('auroRecConsulta',ctx.numeroConsulta ? 'Consulta #'+ctx.numeroConsulta : '—');
    setText('auroRecMedico',nombreMedicoDesdeContexto(a) || '—');
    setText('auroRecFecha',fechaVisual(a.fecha_atencion || a.fecha_consulta || a.creado_en));

    aplicarModo();
  }

  async function cargarDiagnosticos(id){
    try{
      const data=await apiGet('listarDiagnosticosPorAtencion',{id_atencion:id});
      state.diagnosticos=Array.isArray(data) ? data : (Array.isArray(data?.registros) ? data.registros : []);
    }catch(e){
      console.warn(MODULO+': no se pudieron cargar diagnósticos.',e);
      state.diagnosticos=[];
    }
    renderDiagnosticos();
  }

  async function cargar(forzar){
    if(state.cargando) return null;
    let ctx=contextoAtencion();

    state.contexto=ctx;
    renderContexto();

    if(!ctx.id){
      limpiar();
      state.diagnosticos=[];
      renderDiagnosticos();
      setMsg('Seleccione una atención antes de trabajar Recomendaciones.','info');
      return null;
    }

    const token=++state.tokenCarga;
    state.cargando=true;
    setMsg('Cargando recomendaciones de esta atención...','info');

    try{
      const [registro, contextoEnriquecido] = await Promise.all([
        apiGet('buscarRecomendacionPorAtencion',{id_atencion:ctx.id}),
        enriquecerContextoDesdeServidor(ctx),
        cargarDiagnosticos(ctx.id)
      ]).then(resultados => [resultados[0], resultados[1]]);

      if(token !== state.tokenCarga) return null;

      ctx=contextoEnriquecido || ctx;
      state.contexto=ctx;

      limpiar();

      if(registro && registro.id_recomendacion){
        aplicarRegistro(registro);
        setMsg(ctx.editable
          ? 'Recomendaciones cargadas. Puede revisarlas y actualizarlas.'
          : 'Recomendaciones históricas cargadas en modo solo lectura.','ok');
      }else{
        const precargado = ctx.editable
          ? precargarSeguimientoDesdePlanSiVacio()
          : false;

        setMsg(
          ctx.editable
            ? (precargado
                ? 'Esta atención todavía no tiene recomendaciones guardadas. Se precargó el motivo de control disponible en Plan para revisión.'
                : 'Esta atención todavía no tiene recomendaciones guardadas.')
            : 'Esta atención está bloqueada y no tiene recomendaciones registradas.',
          'info'
        );
      }

      state.idAtencion=ctx.id;
      renderContexto();
      return registro || null;
    }catch(e){
      console.error(MODULO+':',e);
      setMsg('No se pudieron cargar las recomendaciones: '+txt(e.message || e),'error');
      return null;
    }finally{
      state.cargando=false;
    }
  }

  function datosGuardar(){
    const ctx=state.contexto || contextoAtencion();
    const a=ctx.atencion || {};
    const detalle=detalleActual();

    return {
      id_recomendacion:state.idRecomendacion || '',
      id_atencion:ctx.id || '',
      id_cita:txt(a.id_cita),
      id_paciente:txt(a.id_paciente),
      id_historia:txt(a.id_historia),
      id_medico:txt(a.id_medico),
      fecha_atencion:a.fecha_atencion || '',
      detalle_json:JSON.stringify(detalle),
      estado:'Activo'
    };
  }

  async function guardar(){
    if(state.guardando) return;

    const ctx=contextoAtencion();
    state.contexto=ctx;

    if(!ctx.id){
      setMsg('No existe una atención activa para guardar recomendaciones.','error');
      return;
    }

    if(!ctx.editable){
      setMsg('La consulta seleccionada es histórica y está protegida contra edición.','error');
      return;
    }

    const detalle=detalleActual();
    if(!tieneContenido(detalle)){
      setMsg('Ingrese al menos una recomendación, seguimiento, signo de alerta o cuidado antes de guardar.','error');
      return;
    }

    const btn=document.getElementById('auroRecBtnGuardar');
    state.guardando=true;
    if(btn){
      btn.disabled=true;
      btn.innerHTML='<i class="bi bi-hourglass-split me-1"></i> Guardando...';
    }

    try{
      const data=datosGuardar();
      const r=await apiPost('guardarRecomendacion',data);

      if(!r || r.success === false){
        throw new Error(txt(r?.message || 'No se pudo guardar Recomendaciones.'));
      }

      state.idRecomendacion=txt(r.id || r.id_recomendacion || data.id_recomendacion);
      setMsg(r.actualizado ? 'Recomendaciones actualizadas correctamente.' : 'Recomendaciones guardadas correctamente.','ok');
      await cargar(true);

      window.dispatchEvent(new CustomEvent('aurosanax:recomendaciones-guardadas',{
        detail:{id_atencion:ctx.id,id_recomendacion:state.idRecomendacion}
      }));
    }catch(e){
      console.error(MODULO+':',e);
      setMsg('No se pudo guardar: '+txt(e.message || e),'error');
    }finally{
      state.guardando=false;
      if(btn){
        const ctxActual=contextoAtencion();
        btn.disabled=!(ctxActual.editable && ctxActual.id);
        btn.innerHTML='<i class="bi bi-save2 me-1"></i> Guardar recomendaciones';
      }
    }
  }

  function vistaPrevia(){
    const ctx=state.contexto || contextoAtencion();
    const a=ctx.atencion || {};
    const d=detalleActual();

    const alertas=ALERTAS.filter(([k])=>(d.signos_alerta.seleccionados || []).includes(k)).map(([,l])=>l);
    const infeccion=INFECCION.filter(([k])=>(d.signos_infeccion.seleccionados || []).includes(k)).map(([,l])=>l);
    const dx=state.diagnosticos.map(x=>{
      const c=txt(x.codigo_cie10 || x.codigo || x.cie10);
      const n=txt(x.descripcion || x.nombre || x.diagnostico);
      return [c,n].filter(Boolean).join(' - ');
    });

    const w=window.open('','_blank','noopener,noreferrer,width=900,height=900');
    if(!w){
      setMsg('El navegador bloqueó la vista previa. Habilite ventanas emergentes para imprimir.','error');
      return;
    }

    const lista = arr => arr.length ? '<ul>'+arr.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>' : '<p>—</p>';
    const bloque = (titulo,contenido)=>`<section><h3>${esc(titulo)}</h3>${contenido}</section>`;

    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Recomendaciones AUROSANAX</title>
      <style>
        body{font-family:Arial,sans-serif;color:#111827;margin:34px;line-height:1.45}
        header{border-bottom:2px solid #8b1e5a;padding-bottom:14px;margin-bottom:18px}
        h1{font-size:22px;margin:0;color:#8b1e5a} h3{font-size:14px;margin:18px 0 6px}
        .meta{display:grid;grid-template-columns:1fr 1fr;gap:7px;font-size:12px;margin-top:10px}
        section{break-inside:avoid} p{white-space:pre-wrap;margin:4px 0} ul{margin:5px 0 0 18px}
        .foot{margin-top:35px;padding-top:12px;border-top:1px solid #d1d5db;font-size:11px;color:#6b7280}
        @media print{button{display:none}body{margin:18mm}}
      </style></head><body>
      <header><h1>Recomendaciones clínicas</h1>
      <div class="meta">
        <div><b>Paciente:</b> ${esc(txt(a.nombre_paciente || '—'))}</div>
        <div><b>Médico:</b> ${esc(txt(a.nombre_medico || '—'))}</div>
        <div><b>Consulta:</b> ${esc(ctx.numeroConsulta || '—')}</div>
        <div><b>Fecha:</b> ${esc(fechaVisual(a.fecha_atencion || a.creado_en))}</div>
      </div></header>
      ${bloque('Diagnósticos',lista(dx))}
      ${bloque('Próxima cita',`<p>${esc(d.seguimiento.proxima_cita || '—')} ${d.seguimiento.motivo ? '· '+esc(d.seguimiento.motivo) : ''}</p>`)}
      ${bloque('Signos de alerta',lista(alertas) + (d.signos_alerta.otros ? '<p>'+esc(d.signos_alerta.otros)+'</p>' : ''))}
      ${bloque('Signos de infección',lista(infeccion) + (d.signos_infeccion.otros ? '<p>'+esc(d.signos_infeccion.otros)+'</p>' : ''))}
      ${bloque('Dieta y cuidados',`<p>${esc(d.dieta_cuidados || '—')}</p>`)}
      ${bloque('Recomendaciones generales',`<p>${esc(d.recomendaciones_generales || '—')}</p>`)}
      <div class="foot">Documento generado desde AUROSANAX ERP. La información corresponde a la atención clínica seleccionada.</div>
      <script>window.onload=function(){setTimeout(function(){window.print();},250)}<\/script>
      </body></html>`);
    w.document.close();
  }

  function enlazar(){
    const guardarBtn=document.getElementById('auroRecBtnGuardar');
    const recargarBtn=document.getElementById('auroRecBtnRecargar');
    const vistaBtn=document.getElementById('auroRecBtnVista');

    if(guardarBtn && guardarBtn.dataset.auroRec!=='1'){
      guardarBtn.dataset.auroRec='1';
      guardarBtn.addEventListener('click',guardar);
    }
    if(recargarBtn && recargarBtn.dataset.auroRec!=='1'){
      recargarBtn.dataset.auroRec='1';
      recargarBtn.addEventListener('click',()=>cargar(true));
    }
    if(vistaBtn && vistaBtn.dataset.auroRec!=='1'){
      vistaBtn.dataset.auroRec='1';
      vistaBtn.addEventListener('click',vistaPrevia);
    }
  }

  async function inicializar(){
    instalarEstilos();
    const mount=asegurarMount();
    if(!mount) return false;
    enlazar();
    state.inicializado=true;
    await cargar(false);
    return true;
  }

  function onAtencionCambio(){
    const id=idAtencionActiva();
    if(id !== state.idAtencion){
      state.tokenCarga++;
      state.idAtencion=id;
      setTimeout(()=>cargar(true),50);
    }else{
      state.contexto=contextoAtencion();
      renderContexto();
    }
  }

  window.addEventListener('aurosanax:atencion-cambiada',onAtencionCambio);
  window.addEventListener('aurosanax:atencion-seleccionada',onAtencionCambio);
  window.addEventListener('aurosanax:atencion-actualizada',onAtencionCambio);
  window.addEventListener('aurosanax:diagnosticos-actualizados',()=>{
    if(state.idAtencion) cargarDiagnosticos(state.idAtencion);
  });

  document.addEventListener('DOMContentLoaded',()=>{
    if(document.getElementById('auroRecomendacionesMount')) inicializar();
  });

  window.auroRecomendaciones={
    version:VERSION,
    inicializar:inicializar,
    cargar:function(){return cargar(true);},
    guardar:guardar,
    vistaPrevia:vistaPrevia,
    estado:state
  };
})();
