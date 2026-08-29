/* ============================================================================
   AUROSANAX CLINICAL ERP
   Archivo: informe_historico.js
   Módulo: Informe Clínico Histórico / Resumen longitudinal de atenciones
   Versión: 1.0.0
   Fecha: 2026-08-28
   ---------------------------------------------------------------------------
   PRINCIPIOS DE DISEÑO / ANTIRREGRESIÓN
   - SOLO LECTURA. Este archivo NO ejecuta POST, PUT, PATCH ni DELETE.
   - NO modifica imprimirHistoriaClinica() ni el Informe de atención estable.
   - NO cambia la atención activa, no navega entre consultas y no dispara autosaves.
   - La fuente maestra de cada consulta es id_atencion.
   - Datos longitudinales se mantienen separados de datos por atención.
   - No se renderizan títulos, cajas ni espacios de módulos sin información útil.
   - Vista previa e impresión usan el MISMO HTML documental.
   - Los datos persistentes del backend tienen prioridad sobre respaldos locales.
   - Los módulos sin vínculo inequívoco a id_atencion se muestran como asociados,
     nunca se fuerzan dentro de una consulta.
============================================================================ */
(function(){
  'use strict';

  if(window.auroInformeHistorico?.version){
    console.warn('AUROSANAX INFORME HISTÓRICO: el módulo ya estaba cargado.');
    return;
  }

  const VERSION = '1.0.0';
  const MODULO = 'AUROSANAX INFORME HISTÓRICO';
  const MAX_CONCURRENCIA = 5;
  const INVALIDOS = new Set([
    '', '-', '—', 'no registrado', 'sin registrar', 'sin información',
    'sin informacion', 'sin dato', 'sin datos', 'no valorado',
    'no aplica', 'n/a', 'na', 'undefined', 'null', '[object object]',
    'seleccione', 'seleccione...', 'pendiente'
  ]);

  const state = {
    token: 0,
    cargando: false,
    idPaciente: '',
    datos: null,
    htmlDocumento: '',
    advertencias: [],
    errores: []
  };

  /* ========================================================================
     UTILIDADES BÁSICAS
  ======================================================================== */
  const txt = v => String(v === null || v === undefined ? '' : v).trim();

  function norm(v){
    return txt(v)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/\s+/g,' ')
      .trim();
  }

  function esc(v){
    return String(v ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function arr(v){
    if(Array.isArray(v)) return v;
    if(!v || typeof v !== 'object') return [];
    const candidatos = [v.data, v.registros, v.resultado, v.items, v.lista];
    return candidatos.find(Array.isArray) || [];
  }

  function obj(v){
    if(!v) return null;
    if(Array.isArray(v)) return v[0] || null;
    if(typeof v !== 'object') return null;
    if(v.data && !Array.isArray(v.data) && typeof v.data === 'object') return v.data;
    if(v.registro && typeof v.registro === 'object') return v.registro;
    if(v.resultado && !Array.isArray(v.resultado) && typeof v.resultado === 'object') return v.resultado;
    return v;
  }

  function parseJSON(v, fallback=null){
    if(v && typeof v === 'object') return v;
    const raw = txt(v);
    if(!raw) return fallback;

    const candidatos = [raw];
    const idxObj = raw.indexOf('{');
    const idxArr = raw.indexOf('[');
    const idx = [idxObj, idxArr].filter(x=>x>=0).sort((a,b)=>a-b)[0];
    if(Number.isInteger(idx) && idx > 0) candidatos.push(raw.slice(idx));

    for(const c of candidatos){
      try{ return JSON.parse(c); }catch(_e){}
    }
    return fallback;
  }

  function valorUtil(v){
    if(v === null || v === undefined) return false;
    if(typeof v === 'boolean') return v === true;
    if(typeof v === 'number') return Number.isFinite(v);
    if(Array.isArray(v)) return v.some(valorUtil);
    if(typeof v === 'object') return Object.values(v).some(valorUtil);
    const n = norm(v);
    return !!n && !INVALIDOS.has(n);
  }

  function primer(){
    for(const v of arguments){
      if(valorUtil(v)) return v;
    }
    return '';
  }

  function nombreCompleto(o){
    o = o || {};
    return txt(
      o.nombre_completo || o.nombre_paciente || o.paciente_nombre || o.nombre ||
      [o.nombres || o.nombre1, o.apellidos || [o.apellido_paterno,o.apellido_materno].filter(Boolean).join(' ')].filter(Boolean).join(' ')
    ).replace(/\s+/g,' ').trim();
  }

  function humanizar(k){
    const mapa = {
      fum:'FUM', fpp:'FPP', fcf:'FCF', imc:'IMC', cie10:'CIE-10',
      id_atencion:'ID atención', id_historia:'ID historia', id_paciente:'ID paciente',
      presion_arterial:'Presión arterial', frecuencia_cardiaca:'Frecuencia cardíaca',
      frecuencia_respiratoria:'Frecuencia respiratoria', saturacion:'Saturación',
      temperatura:'Temperatura', peso_kg:'Peso', talla_cm:'Talla',
      edad_gestacional_semanas:'Edad gestacional (semanas)',
      edad_gestacional_dias:'Edad gestacional (días)',
      frecuencia_cardiaca_fetal:'Frecuencia cardíaca fetal',
      altura_uterina:'Altura uterina', riesgo_obstetrico:'Riesgo obstétrico',
      movimientos_fetales:'Movimientos fetales', actividad_uterina:'Actividad uterina',
      estado_membranas:'Estado de membranas', hallazgos_relevantes:'Hallazgos relevantes',
      tipo_embarazo:'Tipo de embarazo', numero_fetos:'Número de fetos',
      situacion_fetal:'Situación fetal', presentacion_fetal:'Presentación fetal', posicion_fetal:'Posición fetal',
      motivo_consulta:'Motivo de consulta', enfermedad_actual:'Enfermedad actual',
      plan_tratamiento:'Plan terapéutico', indicaciones_paciente:'Indicaciones',
      proximo_control:'Próximo control', observaciones:'Observaciones',
      medicamento:'Medicamento', presentacion:'Presentación', via:'Vía', cantidad:'Cantidad',
      frecuencia:'Frecuencia', duracion:'Duración', indicaciones:'Indicaciones',
      nombre_documento:'Documento', categoria:'Categoría', tipo_documento:'Tipo de documento'
    };
    if(mapa[k]) return mapa[k];
    return txt(k)
      .replace(/^id_/,'')
      .replace(/_json$/,'')
      .replace(/_/g,' ')
      .replace(/\b\w/g,m=>m.toUpperCase());
  }

  function fechaISO(v){
    const raw = txt(v);
    if(!raw) return '';
    let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if(m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    return '';
  }

  function fechaVista(v){
    const iso = fechaISO(v);
    if(!iso) return txt(v);
    const [y,m,d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function horaVista(v){
    const raw = txt(v);
    if(!raw) return '';
    const m = raw.match(/(\d{1,2}):(\d{2})/);
    return m ? `${String(m[1]).padStart(2,'0')}:${m[2]}` : raw;
  }

  function timestampAtencion(a){
    const f = fechaISO(a?.fecha_atencion || a?.fecha_consulta || a?.fecha || a?.creado_en);
    if(!f) return 0;
    const h = horaVista(a?.hora_atencion || a?.hora_consulta || a?.hora) || '00:00';
    const n = new Date(`${f}T${h}:00`).getTime();
    return Number.isFinite(n) ? n : 0;
  }

  function esAtencionClinicaValida(a){
    const e = norm(a?.estado_atencion || a?.estado || a?.estado_consulta);
    return !/(anulad|cancelad|archivad)/.test(e);
  }

  function idPacienteSeleccionado(){
    const select = document.getElementById('hcPacienteSelect');
    const idSelect = txt(select?.value);
    if(idSelect) return idSelect;

    try{
      const p = window.getPacienteActivo?.();
      const id = txt(p?.id_paciente || p?.id);
      if(id) return id;
    }catch(_e){}

    return txt(window.activePatientId || window.historiaActual?.id_paciente || window.currentHistoria?.id_paciente);
  }

  function apiUrl(){
    try{
      if(typeof API_URL !== 'undefined' && API_URL) return txt(API_URL);
    }catch(_e){}
    return txt(
      window.API_URL ||
      window.APP_SCRIPT_URL ||
      document.getElementById('appsScriptUrl')?.value ||
      window.AUROSANAX_SEGURIDAD?.configuracion?.apiUrl ||
      window.AUROSANAX_SEGURIDAD?.config?.apiUrl
    );
  }

  /* ========================================================================
     API: EXCLUSIVAMENTE GET
  ======================================================================== */
  async function get(accion, params={}, opciones={}){
    const base = apiUrl();
    if(!base) throw new Error('API_URL no está definida.');

    const q = new URLSearchParams({accion, _:String(Date.now())});
    Object.entries(params || {}).forEach(([k,v])=>{
      if(v !== undefined && v !== null && txt(v)) q.append(k, String(v));
    });

    try{
      const r = await fetch(base + '?' + q.toString(), {
        method:'GET',
        cache:'no-store',
        redirect:'follow'
      });
      if(!r.ok) throw new Error(`HTTP ${r.status} en ${accion}`);
      return await r.json();
    }catch(error){
      if(opciones.opcional){
        state.advertencias.push(`${accion}: ${error.message}`);
        return opciones.defecto ?? null;
      }
      throw error;
    }
  }

  async function mapLimit(items, limit, worker){
    const salida = new Array(items.length);
    let cursor = 0;
    const n = Math.max(1, Math.min(limit || 1, items.length || 1));

    async function hilo(){
      while(true){
        const i = cursor++;
        if(i >= items.length) return;
        salida[i] = await worker(items[i], i);
      }
    }

    await Promise.all(Array.from({length:n}, hilo));
    return salida;
  }

  /* ========================================================================
     RESOLUCIÓN DE DATOS MAESTROS
  ======================================================================== */
  async function cargarPaciente(idPaciente){
    const listas = [window.patients, window.pacientes, window.listaPacientes, window.pacientesData].filter(Array.isArray);
    for(const lista of listas){
      const p = lista.find(x=>txt(x?.id_paciente || x?.id) === idPaciente);
      if(p) return p;
    }

    const remoto = await get('listarPacientes',{}, {opcional:true, defecto:[]});
    return arr(remoto).find(x=>txt(x?.id_paciente || x?.id) === idPaciente) || null;
  }

  async function cargarHistoriasPaciente(idPaciente){
    const locales = [window.historiasClinicas, window.historias, window.listaHistorias].filter(Array.isArray);
    for(const lista of locales){
      const encontradas = lista.filter(x=>txt(x?.id_paciente) === idPaciente);
      if(encontradas.length) return encontradas;
    }

    const remoto = await get('listarHistoriasClinicas',{}, {opcional:true, defecto:[]});
    return arr(remoto).filter(x=>txt(x?.id_paciente) === idPaciente);
  }

  async function cargarAtencionesPaciente(idPaciente){
    const remoto = await get('listarAtenciones');
    return arr(remoto)
      .filter(a=>txt(a?.id_paciente) === idPaciente)
      .filter(esAtencionClinicaValida)
      .sort((a,b)=>timestampAtencion(a)-timestampAtencion(b));
  }

  async function cargarMedicos(){
    const remoto = await get('listarMedicosActivos',{}, {opcional:true, defecto:[]});
    const remotos = arr(remoto);
    if(remotos.length) return remotos;
    return [window.medicos, window.medicosActivos, window.listaMedicos].find(Array.isArray) || [];
  }

  async function cargarConfiguracion(){
    const remoto = await get('obtenerConfiguracion',{}, {opcional:true, defecto:{}});
    return obj(remoto) || window.auroConfiguracionCentro || window.configuracionCentro || window.configuracionInstitucional || {};
  }

  function historiaConAntecedentes(historias){
    const tiene = h => [
      h?.antecedentes_personales,
      h?.antecedentes_quirurgicos,
      h?.antecedentes_gineco_obstetricos,
      h?.antecedentes_familiares,
      h?.medicacion_actual,
      h?.alergias
    ].some(valorUtil);

    return (historias || [])
      .filter(tiene)
      .sort((a,b)=>{
        const ta = new Date(a?.actualizado_en || a?.fecha_apertura || a?.creado_en || 0).getTime() || 0;
        const tb = new Date(b?.actualizado_en || b?.fecha_apertura || b?.creado_en || 0).getTime() || 0;
        return tb-ta;
      })[0] || historias?.[0] || null;
  }

  /* ========================================================================
     CARGADORES CLÍNICOS POR ATENCIÓN
  ======================================================================== */
  async function cargarModuloAtencion(a){
    const id = txt(a?.id_atencion);
    if(!id) return {atencion:a};

    const [anamnesisR, examenR, diagnosticosR, planR, recomendacionesR, certificadosR, documentosR] = await Promise.all([
      get('buscarAnamnesisPorAtencion',{id_atencion:id},{opcional:true,defecto:null}),
      get('buscarExamenFisicoPorAtencion',{id_atencion:id},{opcional:true,defecto:null}),
      get('listarDiagnosticosPorAtencion',{id_atencion:id},{opcional:true,defecto:[]}),
      get('buscarPlanPorAtencion',{id_atencion:id},{opcional:true,defecto:null}),
      get('buscarRecomendacionPorAtencion',{id_atencion:id},{opcional:true,defecto:null}),
      get('listarCertificadosPorAtencion',{id_atencion:id},{opcional:true,defecto:[]}),
      get('listarDocumentosPorAtencion',{id_atencion:id},{opcional:true,defecto:[]})
    ]);

    return {
      atencion:a,
      anamnesis:obj(anamnesisR),
      examen:obj(examenR),
      diagnosticos:arr(diagnosticosR),
      plan:obj(planR),
      recomendaciones:obj(recomendacionesR),
      certificados:arr(certificadosR),
      documentos:arr(documentosR)
    };
  }

  async function cargarColeccionesGlobales(idPaciente){
    const [recetasR, obstR, gineR, esteticaR, preR, bioR, procR, consR, segR] = await Promise.all([
      get('listarRecetas',{}, {opcional:true,defecto:[]}),
      get('listarObstetricia',{}, {opcional:true,defecto:[]}),
      get('listarGinecologia',{}, {opcional:true,defecto:[]}),
      get('listarEstetica',{}, {opcional:true,defecto:[]}),
      get('listarPreatenciones',{}, {opcional:true,defecto:[]}),
      get('listarBioimpedancia',{}, {opcional:true,defecto:[]}),
      get('listarProcedimientos',{}, {opcional:true,defecto:[]}),
      get('listarConsentimientos',{}, {opcional:true,defecto:[]}),
      get('listarSeguimientos',{}, {opcional:true,defecto:[]})
    ]);

    const soloPaciente = lista => arr(lista).filter(x=>{
      const id = txt(x?.id_paciente || x?.paciente_id);
      return !id || id === idPaciente;
    });

    return {
      recetas:soloPaciente(recetasR),
      obstetricia:soloPaciente(obstR),
      ginecologia:soloPaciente(gineR),
      estetica:soloPaciente(esteticaR),
      preatenciones:soloPaciente(preR),
      bioimpedancia:soloPaciente(bioR),
      procedimientos:soloPaciente(procR),
      consentimientos:soloPaciente(consR),
      seguimientos:soloPaciente(segR)
    };
  }

  function indexarPorAtencion(lista){
    const m = new Map();
    (lista || []).forEach(x=>{
      const id = txt(x?.id_atencion);
      if(!id) return;
      if(!m.has(id)) m.set(id,[]);
      m.get(id).push(x);
    });
    return m;
  }

  function asociarEstetica(atenciones, registros){
    const porFechaAtencion = new Map();
    atenciones.forEach(a=>{
      const f = fechaISO(a?.fecha_atencion || a?.fecha_consulta || a?.fecha);
      if(!f) return;
      if(!porFechaAtencion.has(f)) porFechaAtencion.set(f,[]);
      porFechaAtencion.get(f).push(a);
    });

    const porAtencion = new Map();
    const ambiguos = [];

    (registros || []).forEach(r=>{
      const f = fechaISO(r?.fecha_atencion || r?.fecha || r?.creado_en);
      if(!f){ ambiguos.push(r); return; }
      const candidatas = porFechaAtencion.get(f) || [];
      if(candidatas.length === 1){
        const id = txt(candidatas[0].id_atencion);
        if(!porAtencion.has(id)) porAtencion.set(id,[]);
        porAtencion.get(id).push(r);
      }else{
        ambiguos.push(r);
      }
    });

    return {porAtencion, ambiguos};
  }

  /* ========================================================================
     NORMALIZACIÓN / ESTRUCTURA DOCUMENTAL
  ======================================================================== */
  function medicoDeAtencion(a, medicos){
    const id = txt(a?.id_medico);
    const m = (medicos || []).find(x=>txt(x?.id_medico || x?.id || x?.codigo) === id) || {};
    return {
      id,
      nombre: nombreCompleto(m) || txt(a?.nombre_medico || a?.medico_nombre),
      especialidad: txt(
        m?.especialidad_principal || m?.especialidad || m?.especialidad_medica ||
        a?.especialidad || a?.especialidad_atencion || a?.medico_especialidad
      ),
      registro_msp:txt(m?.registro_msp || m?.msp || m?.registro_profesional),
      registro_senescyt:txt(m?.registro_senescyt || m?.senescyt)
    };
  }

  function normalizarInstitucion(c){
    c = c || {};
    if(c.datos && typeof c.datos === 'object') c = c.datos;
    return {
      nombre:txt(c.nombre_clinica || c.nombre_centro || c.nombre_comercial || c.razon_social) || 'AUROSANAX',
      subtitulo:txt(c.subtitulo_clinica || c.descripcion_clinica || c.eslogan_clinica),
      razon_social:txt(c.razon_social),
      ruc:txt(c.ruc),
      direccion:txt(c.direccion_clinica || c.direccion),
      ciudad:txt(c.ciudad_clinica || c.ciudad) || 'Guayaquil',
      pais:txt(c.pais_clinica || c.pais) || 'Ecuador',
      telefono:txt(c.telefono_clinica || c.whatsapp_clinica || c.telefono || c.whatsapp),
      email:txt(c.email_clinica || c.correo_clinica || c.email || c.correo),
      web:txt(c.sitio_web_clinica || c.web_clinica || c.web),
      logo:txt(c.logo_url || c.logo_drive_url || c.logo),
      color:txt(c.color_principal) || '#8b1e5a'
    };
  }

  function normalizarPaciente(p, historia){
    p = p || {};
    historia = historia || {};
    return {
      id_paciente:txt(p.id_paciente || p.id),
      nombre:nombreCompleto(p) || nombreCompleto(historia),
      documento:txt(p.numero_documento || p.cedula || p.documento || p.identificacion),
      fecha_nacimiento:txt(p.fecha_nacimiento || p.nacimiento),
      edad:txt(p.edad),
      sexo:txt(p.sexo),
      estado_civil:txt(p.estado_civil),
      ocupacion:txt(p.ocupacion),
      telefono:txt(p.telefono || p.whatsapp || p.celular),
      correo:txt(p.correo || p.email),
      direccion:txt(p.direccion),
      seguro:txt(p.seguro_medico || p.seguro),
      tipo_sangre:txt(p.tipo_sangre || p.grupo_sanguineo),
      contacto_emergencia:txt(p.contacto_emergencia),
      telefono_emergencia:txt(p.telefono_emergencia),
      id_historia:txt(historia.id_historia || historia.id),
      fecha_apertura:txt(historia.fecha_apertura || historia.creado_en)
    };
  }

  function normalizarAntecedentes(h){
    h = h || {};
    return [
      ['Antecedentes personales', h.antecedentes_personales],
      ['Antecedentes quirúrgicos', h.antecedentes_quirurgicos],
      ['Alergias', h.alergias],
      ['Antecedentes gineco-obstétricos', h.antecedentes_gineco_obstetricos],
      ['Medicación actual', h.medicacion_actual],
      ['Antecedentes familiares', h.antecedentes_familiares]
    ].filter(([,v])=>valorUtil(v));
  }

  function datosObjetoUtil(o, excluir=[]){
    const no = new Set([
      'id','id_atencion','id_paciente','id_historia','id_medico','id_cita',
      'creado_en','actualizado_en','creado_por','actualizado_por','modulo_version',
      'estado','estado_registro','estado_examen',
      ...excluir
    ]);

    return Object.entries(o || {})
      .filter(([k,v])=>!no.has(k) && valorUtil(v));
  }

  function asociarColecciones(datos, globales){
    const recetas = indexarPorAtencion(globales.recetas);
    const obst = indexarPorAtencion(globales.obstetricia);
    const gine = indexarPorAtencion(globales.ginecologia);
    const pre = indexarPorAtencion(globales.preatenciones);
    const estetica = asociarEstetica(datos.map(x=>x.atencion), globales.estetica);

    datos.forEach(d=>{
      const id = txt(d.atencion?.id_atencion);
      d.recetas = recetas.get(id) || [];
      d.obstetricia = obst.get(id) || [];
      d.ginecologia = gine.get(id) || [];
      d.preatencion = pre.get(id) || [];
      d.estetica = estetica.porAtencion.get(id) || [];
    });

    return {
      ...globales,
      esteticaAmbigua:estetica.ambiguos
    };
  }

  /* ========================================================================
     RENDER DE DATOS GENÉRICOS
  ======================================================================== */
  function contenidoEstructurado(valor, profundidad=0){
    if(profundidad > 4 || !valorUtil(valor)) return '';

    const parsed = typeof valor === 'string' ? parseJSON(valor, null) : valor;

    if(Array.isArray(parsed)){
      const items = parsed.map(v=>contenidoEstructurado(v, profundidad+1)).filter(Boolean);
      return items.length ? `<ul class="aih-list">${items.map(x=>`<li>${x}</li>`).join('')}</ul>` : '';
    }

    if(parsed && typeof parsed === 'object'){
      const filas = Object.entries(parsed)
        .filter(([,v])=>valorUtil(v))
        .map(([k,v])=>{
          if(v && typeof v === 'object'){
            const interno = contenidoEstructurado(v, profundidad+1);
            return interno ? `<div class="aih-kv aih-kv-block"><span>${esc(humanizar(k))}</span><div>${interno}</div></div>` : '';
          }
          return `<div class="aih-kv"><span>${esc(humanizar(k))}</span><b>${esc(v)}</b></div>`;
        })
        .filter(Boolean);
      return filas.length ? `<div class="aih-kv-grid">${filas.join('')}</div>` : '';
    }

    const raw = txt(valor);
    const prefijo = raw.match(/^[A-Z0-9_\-]+::/);
    const limpio = prefijo ? raw.slice(prefijo[0].length) : raw;
    const parseado = parseJSON(limpio, null);
    if(parseado) return contenidoEstructurado(parseado, profundidad+1);

    return esc(limpio).replace(/\n/g,'<br>');
  }

  function bloque(titulo, contenido, clase=''){
    const c = txt(contenido);
    if(!c) return '';
    return `<section class="aih-block ${clase}"><h3>${esc(titulo)}</h3><div class="aih-block-body">${c}</div></section>`;
  }

  function miniDatos(pares){
    const utiles = (pares || []).filter(([,v])=>valorUtil(v));
    if(!utiles.length) return '';
    return `<div class="aih-mini-grid">${utiles.map(([l,v])=>`<div class="aih-mini"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>`;
  }

  function renderAntecedentes(antecedentes){
    const html = (antecedentes || []).map(([titulo,valor])=>{
      const c = contenidoEstructurado(valor);
      return c ? bloque(titulo,c, norm(titulo).includes('alerg') ? 'aih-danger' : '') : '';
    }).filter(Boolean).join('');
    return html ? `<section class="aih-major"><h2>Antecedentes clínicos longitudinales</h2>${html}</section>` : '';
  }

  function renderAnamnesis(r){
    if(!r) return '';
    const partes = [];
    if(valorUtil(r.motivo_consulta)) partes.push(bloque('Motivo de consulta', contenidoEstructurado(r.motivo_consulta)));
    if(valorUtil(r.enfermedad_actual)) partes.push(bloque('Enfermedad actual', contenidoEstructurado(r.enfermedad_actual)));

    const respuestas = parseJSON(r.respuestas_json, null);
    const controles = parseJSON(r.controles_json, null);
    const narrativa = txt(r.narrativa_generada);

    if(valorUtil(narrativa) && norm(narrativa) !== norm(r.enfermedad_actual)){
      partes.push(bloque('Síntesis de anamnesis', contenidoEstructurado(narrativa)));
    }

    const detalle = contenidoEstructurado(respuestas) || contenidoEstructurado(controles);
    if(detalle) partes.push(bloque('Datos complementarios de anamnesis', detalle));
    return partes.join('');
  }

  function renderPreatencion(lista, examen){
    if(!lista?.length) return '';
    if(examen && datosObjetoUtil(examen).some(([k])=>/peso|talla|imc|presion|frecuencia|temperatura|saturacion/.test(norm(k)))) return '';

    const r = lista.slice().sort((a,b)=>txt(b.actualizado_en||b.creado_en).localeCompare(txt(a.actualizado_en||a.creado_en)))[0];
    const vitales = miniDatos([
      ['Peso', primer(r.peso_kg,r.peso)],
      ['Talla', primer(r.talla_cm,r.talla)],
      ['IMC', r.imc],
      ['Presión arterial', primer(r.presion_arterial,r.pa)],
      ['Frecuencia cardíaca', primer(r.frecuencia_cardiaca,r.fc)],
      ['Frecuencia respiratoria', primer(r.frecuencia_respiratoria,r.fr)],
      ['Temperatura', r.temperatura],
      ['Saturación', primer(r.saturacion,r.spo2)]
    ]);
    return vitales ? bloque('Signos vitales registrados en preatención', vitales, 'aih-soft') : '';
  }

  function renderExamen(r){
    if(!r) return '';

    const vitales = miniDatos([
      ['Peso', primer(r.peso_kg,r.peso)],
      ['Talla', primer(r.talla_cm,r.talla)],
      ['IMC', r.imc],
      ['Presión arterial', primer(r.presion_arterial,r.pa)],
      ['Frecuencia cardíaca', primer(r.frecuencia_cardiaca,r.fc)],
      ['Frecuencia respiratoria', primer(r.frecuencia_respiratoria,r.fr)],
      ['Temperatura', r.temperatura],
      ['Saturación', primer(r.saturacion,r.spo2)]
    ]);

    const partes = [];
    if(vitales) partes.push(bloque('Signos vitales',vitales));

    const general = primer(r.examen_fisico, r.examen_general, r.hallazgos_generales, r.observaciones_examen);
    if(valorUtil(general)) partes.push(bloque('Examen físico',contenidoEstructurado(general)));

    const sistemas = primer(r.examenes_sistemas, r.sistemas, r.sistemas_json, r.revision_sistemas_json, r.revision_sistemas);
    if(valorUtil(sistemas)) partes.push(bloque('Examen por sistemas',contenidoEstructurado(sistemas)));

    const regionales = primer(r.examenes_regionales, r.regionales, r.regional_json, r.examen_regional);
    if(valorUtil(regionales)) partes.push(bloque('Examen regional',contenidoEstructurado(regionales)));

    return partes.join('');
  }

  function renderObstetricia(lista){
    if(!lista?.length) return '';
    const r = lista.slice().sort((a,b)=>txt(b.actualizado_en||b.creado_en).localeCompare(txt(a.actualizado_en||a.creado_en)))[0];

    const cab = miniDatos([
      ['FUM', fechaVista(r.fum || r.fur)],
      ['FPP', fechaVista(r.fpp)],
      ['Edad gestacional', [txt(r.edad_gestacional_semanas) ? `${txt(r.edad_gestacional_semanas)} sem` : '', txt(r.edad_gestacional_dias) ? `${txt(r.edad_gestacional_dias)} días` : ''].filter(Boolean).join(' + ')],
      ['Altura uterina', r.altura_uterina],
      ['FCF', r.frecuencia_cardiaca_fetal],
      ['Riesgo obstétrico', r.riesgo_obstetrico],
      ['Próximo control', fechaVista(r.proximo_control)]
    ]);

    const extras = [
      ['Embarazo actual', r.embarazo_actual_json],
      ['Síntomas obstétricos', r.sintomas_obstetricos_json],
      ['Evaluación obstétrica', r.evaluacion_obstetrica_json],
      ['Impresión obstétrica', r.impresion_obstetrica],
      ['Observaciones', r.observaciones]
    ].map(([t,v])=>valorUtil(v) ? bloque(t,contenidoEstructurado(v)) : '').filter(Boolean).join('');

    return (cab || extras) ? `<section class="aih-special"><h3 class="aih-special-title">Evaluación obstétrica</h3>${cab}${extras}</section>` : '';
  }

  function renderGinecologia(lista){
    if(!lista?.length) return '';
    const r = lista.slice().sort((a,b)=>txt(b.actualizado_en||b.creado_en).localeCompare(txt(a.actualizado_en||a.creado_en)))[0];
    const partes = [];
    if(valorUtil(r.fum_actual)) partes.push(miniDatos([['FUM actual',fechaVista(r.fum_actual)]]));
    if(valorUtil(r.motivo_ginecologico)) partes.push(bloque('Motivo ginecológico',contenidoEstructurado(r.motivo_ginecologico)));
    if(valorUtil(r.sintomas_json)) partes.push(bloque('Síntomas ginecológicos',contenidoEstructurado(r.sintomas_json)));
    if(valorUtil(r.examen_ginecologico_json)) partes.push(bloque('Examen ginecológico',contenidoEstructurado(r.examen_ginecologico_json)));
    if(valorUtil(r.estudios_ginecologicos_json)) partes.push(bloque('Estudios ginecológicos',contenidoEstructurado(r.estudios_ginecologicos_json)));
    if(valorUtil(r.impresion_ginecologica)) partes.push(bloque('Impresión ginecológica',contenidoEstructurado(r.impresion_ginecologica)));
    if(valorUtil(r.observaciones)) partes.push(bloque('Observaciones ginecológicas',contenidoEstructurado(r.observaciones)));
    return partes.length ? `<section class="aih-special"><h3 class="aih-special-title">Evaluación ginecológica</h3>${partes.join('')}</section>` : '';
  }

  function renderEstetica(lista){
    if(!lista?.length) return '';
    const r = lista.slice().sort((a,b)=>txt(b.actualizado_en||b.creado_en).localeCompare(txt(a.actualizado_en||a.creado_en)))[0];
    const evalClinica = parseJSON(r.evaluacion_clinica,null) || r.evaluacion_clinica;
    const c = [
      miniDatos([
        ['Área', r.zona_tratamiento],
        ['Procedimiento sugerido', r.procedimiento_sugerido],
        ['Plan de sesiones', r.plan_sesiones]
      ]),
      valorUtil(evalClinica) ? contenidoEstructurado(evalClinica) : ''
    ].filter(Boolean).join('');
    return c ? `<section class="aih-special"><h3 class="aih-special-title">Evaluación estética funcional</h3>${c}</section>` : '';
  }

  function renderDiagnosticos(lista){
    const validos = (lista || []).filter(d=>{
      const e = norm(d?.estado || d?.estado_registro);
      return !/(anulad|eliminad|inactiv)/.test(e) && [d?.codigo_cie10,d?.cie10,d?.codigo,d?.diagnostico,d?.descripcion,d?.nombre].some(valorUtil);
    });
    if(!validos.length) return '';

    return bloque('Diagnósticos de la atención', `<div class="aih-dx-list">${validos.map(d=>{
      const codigo = txt(d.codigo_cie10 || d.cie10 || d.codigo);
      const descripcion = txt(d.diagnostico || d.descripcion || d.nombre || d.nombre_diagnostico);
      const tipo = txt(d.tipo || d.tipo_diagnostico || d.clasificacion);
      return `<div class="aih-dx"><b>${esc([codigo,descripcion].filter(Boolean).join(' — '))}</b>${valorUtil(tipo)?`<small>${esc(tipo)}</small>`:''}</div>`;
    }).join('')}</div>`);
  }

  function renderPlan(p){
    if(!p) return '';
    const partes = [];

    const medicamentos = primer(p.medicamentos_json, p.medicamentos, p.receta_medica, p.receta_medicamentos);
    const ordenes = primer(p.ordenes_json, p.ordenes_medicas, p.examenes_solicitados);
    const interconsulta = primer(p.interconsulta_json, p.interconsulta, p.interconsultas_json);
    const evaluaciones = primer(p.evaluaciones_json, p.evaluaciones);

    if(valorUtil(p.plan_tratamiento || p.plan_terapeutico)) partes.push(bloque('Plan terapéutico',contenidoEstructurado(p.plan_tratamiento || p.plan_terapeutico)));
    if(valorUtil(medicamentos)) partes.push(bloque('Medicamentos indicados en Plan',contenidoEstructurado(medicamentos)));
    if(valorUtil(ordenes)) partes.push(bloque('Órdenes médicas',contenidoEstructurado(ordenes)));
    if(valorUtil(interconsulta)) partes.push(bloque('Interconsulta',contenidoEstructurado(interconsulta)));
    if(valorUtil(evaluaciones)) partes.push(bloque('Evaluaciones',contenidoEstructurado(evaluaciones)));
    if(valorUtil(p.indicaciones_paciente || p.indicaciones)) partes.push(bloque('Indicaciones para el paciente',contenidoEstructurado(p.indicaciones_paciente || p.indicaciones)));

    const control = miniDatos([
      ['Próximo control',fechaVista(p.proximo_control || p.control)],
      ['Estado del plan',p.estado_plan || p.estado_historia]
    ]);
    if(control) partes.push(bloque('Seguimiento del plan',control));

    return partes.join('');
  }

  function parseMedicamentos(v){
    const parsed = parseJSON(v,null);
    if(Array.isArray(parsed)) return parsed;
    if(parsed && typeof parsed === 'object') return [parsed];
    const raw = txt(v);
    if(!raw) return [];
    return raw.split(/\n+/).map(x=>txt(x).replace(/^\s*\d+\.\s*/, '')).filter(valorUtil).map(texto=>({texto}));
  }

  function renderRecetas(lista){
    const validas = (lista || []).filter(r=>{
      const e = norm(r?.estado || r?.estado_receta);
      return !/(anulad|cancelad|eliminad)/.test(e) && valorUtil(r?.medicamento || r?.medicamentos || r?.receta_medica);
    });
    if(!validas.length) return '';

    return validas.map((r,idx)=>{
      const meds = parseMedicamentos(r.medicamento || r.medicamentos || r.receta_medica);
      const cuerpo = meds.map((m,i)=>{
        if(typeof m === 'string') return `<div class="aih-med"><b>${i+1}. ${esc(m)}</b></div>`;
        if(m.texto) return `<div class="aih-med"><b>${i+1}. ${esc(m.texto)}</b></div>`;
        const nombre = txt(m.med || m.medicamento || m.nombre);
        const presentacion = txt(m.pres || m.presentacion);
        const detalle = [
          txt(m.via) ? `Vía: ${txt(m.via)}` : '',
          txt(m.cantidad) ? `Cantidad: ${txt(m.cantidad)}` : '',
          txt(m.frec || m.frecuencia) ? `Frecuencia: ${txt(m.frec || m.frecuencia)}` : '',
          txt(m.dur || m.duracion) ? `Duración: ${txt(m.dur || m.duracion)}` : '',
          txt(m.ind || m.indicaciones) ? `Indicaciones: ${txt(m.ind || m.indicaciones)}` : '',
          norm(m.continuo) === 'si' ? 'Tratamiento continuo' : ''
        ].filter(Boolean).join(' · ');
        return `<div class="aih-med"><b>${i+1}. ${esc([nombre,presentacion].filter(Boolean).join(' '))}</b>${detalle?`<small>${esc(detalle)}</small>`:''}</div>`;
      }).join('');

      const extra = miniDatos([
        ['Fecha de emisión',fechaVista(r.fecha_receta || r.fecha_emision || r.creado_en)],
        ['Profesional',r.nombre_medico || r.medico_nombre]
      ]);
      return bloque(validas.length>1 ? `Receta médica emitida ${idx+1}` : 'Receta médica emitida', `${extra}<div class="aih-med-list">${cuerpo}</div>`);
    }).join('');
  }

  function renderRecomendaciones(r){
    if(!r) return '';
    const detalle = parseJSON(r.detalle_json,null) || {};
    const partes = [];

    const generales = primer(
      detalle.recomendaciones_generales,
      detalle.recomendaciones,
      r.recomendaciones_generales,
      r.recomendaciones,
      r.detalle
    );
    const alertas = primer(detalle.signos_alarma, detalle.alertas, r.signos_alarma);
    const infeccion = primer(detalle.signos_infeccion, detalle.infeccion, r.signos_infeccion);
    const cuidados = primer(detalle.cuidados, detalle.cuidados_generales, detalle.dieta, r.cuidados);
    const seguimiento = primer(detalle.seguimiento, r.seguimiento, r.proximo_control);

    if(valorUtil(generales)) partes.push(bloque('Recomendaciones',contenidoEstructurado(generales)));
    if(valorUtil(cuidados)) partes.push(bloque('Cuidados',contenidoEstructurado(cuidados)));
    if(valorUtil(alertas)) partes.push(bloque('Signos de alarma',contenidoEstructurado(alertas),'aih-danger'));
    if(valorUtil(infeccion)) partes.push(bloque('Signos de posible infección',contenidoEstructurado(infeccion),'aih-danger'));
    if(valorUtil(seguimiento)) partes.push(bloque('Seguimiento recomendado',contenidoEstructurado(seguimiento)));

    if(!partes.length){
      const generic = datosObjetoUtil(r,['detalle_json']);
      if(generic.length) partes.push(bloque('Recomendaciones',contenidoEstructurado(Object.fromEntries(generic))));
    }
    return partes.join('');
  }

  function renderCertificados(lista){
    const validos = (lista || []).filter(r=>!/(anulad|cancelad)/.test(norm(r?.estado)) && valorUtil(r));
    if(!validos.length) return '';
    const items = validos.map(r=>{
      const d = parseJSON(r.detalle_json,{}) || {};
      const titulo = primer(r.tipo_certificado,d.tipo_certificado,r.motivo,'Certificado médico');
      const detalle = [
        fechaVista(r.fecha_emision || r.fecha_certificado || r.creado_en),
        valorUtil(d.dias_reposo || r.dias_reposo) ? `${primer(d.dias_reposo,r.dias_reposo)} día(s) de reposo` : ''
      ].filter(Boolean).join(' · ');
      return `<li><b>${esc(titulo)}</b>${detalle?`<small>${esc(detalle)}</small>`:''}</li>`;
    }).join('');
    return bloque('Documentos emitidos',`<ul class="aih-list aih-doc-list">${items}</ul>`);
  }

  function renderDocumentos(lista){
    const validos = (lista || []).filter(r=>!/(anulad|cancelad)/.test(norm(r?.estado || r?.estado_documento)) && valorUtil(r?.nombre_documento || r?.archivo_nombre || r?.categoria || r?.tipo_documento));
    if(!validos.length) return '';
    const items = validos.map(r=>{
      const nombre = primer(r.nombre_documento,r.archivo_nombre,r.nombre_archivo,r.titulo,r.categoria,'Documento clínico');
      const meta = [primer(r.categoria,r.tipo_documento), fechaVista(r.fecha_documento || r.fecha_atencion || r.creado_en)].filter(valorUtil).join(' · ');
      return `<li><b>${esc(nombre)}</b>${meta?`<small>${esc(meta)}</small>`:''}</li>`;
    }).join('');
    return bloque('Documentos clínicos asociados',`<ul class="aih-list aih-doc-list">${items}</ul>`);
  }

  function renderAtencion(d, numero, medicos){
    const a = d.atencion || {};
    const medico = medicoDeAtencion(a,medicos);
    const fecha = fechaVista(a.fecha_atencion || a.fecha_consulta || a.fecha);
    const hora = horaVista(a.hora_atencion || a.hora_consulta || a.hora);

    const cabecera = miniDatos([
      ['Fecha',fecha],
      ['Hora',hora],
      ['Tipo de atención',a.tipo_atencion || a.tipo],
      ['Especialidad',medico.especialidad],
      ['Profesional',medico.nombre],
      ['Estado',a.estado_atencion || a.estado]
    ]);

    const contenido = [
      renderPreatencion(d.preatencion,d.examen),
      renderAnamnesis(d.anamnesis),
      renderExamen(d.examen),
      renderObstetricia(d.obstetricia),
      renderGinecologia(d.ginecologia),
      renderEstetica(d.estetica),
      renderDiagnosticos(d.diagnosticos),
      renderPlan(d.plan),
      renderRecetas(d.recetas),
      renderRecomendaciones(d.recomendaciones),
      renderCertificados(d.certificados),
      renderDocumentos(d.documentos)
    ].filter(Boolean).join('');

    /* Una atención puede existir aun sin módulos clínicos persistidos. La cabecera
       se conserva porque la atención misma es un registro clínico real. */
    return `<article class="aih-attention">
      <div class="aih-attention-head">
        <div><span class="aih-attention-kicker">Atención N.º ${numero}</span><h2>${esc(fecha || 'Atención clínica')}${hora?` · ${esc(hora)}`:''}</h2></div>
        <span class="aih-attention-id">${esc(txt(a.id_atencion))}</span>
      </div>
      ${cabecera}
      ${contenido || '<div class="aih-attention-empty">Registro de atención sin contenido clínico adicional persistido.</div>'}
    </article>`;
  }

  function renderEvolutivos(globales){
    const secciones = [];

    if(globales.bioimpedancia?.length){
      const filas = globales.bioimpedancia
        .slice()
        .sort((a,b)=>fechaISO(a.fecha||a.fecha_registro||a.creado_en).localeCompare(fechaISO(b.fecha||b.fecha_registro||b.creado_en)))
        .map(r=>{
          const f = fechaVista(r.fecha || r.fecha_registro || r.creado_en);
          const datos = [
            ['Peso',primer(r.peso_kg,r.peso)],['IMC',r.imc],['Grasa',primer(r.porcentaje_grasa,r.grasa_corporal)],
            ['Masa muscular',primer(r.masa_muscular,r.musculo)],['Agua',primer(r.porcentaje_agua,r.agua_corporal)]
          ].filter(([,v])=>valorUtil(v));
          if(!datos.length) return '';
          return `<tr><td>${esc(f)}</td>${datos.map(([,v])=>`<td>${esc(v)}</td>`).join('')}</tr>`;
        }).filter(Boolean);
      if(filas.length){
        secciones.push(`<section class="aih-major"><h2>Evolución corporal / Bioimpedancia</h2><div class="aih-table-wrap"><table class="aih-table"><tbody>${filas.join('')}</tbody></table></div></section>`);
      }
    }

    function resumenAsociados(titulo, lista, campos){
      const validos = (lista || []).filter(valorUtil);
      if(!validos.length) return '';
      const items = validos.map(r=>{
        const nombre = primer(...campos.map(k=>r?.[k]), titulo);
        const meta = [fechaVista(r.fecha || r.fecha_atencion || r.fecha_procedimiento || r.creado_en), r.estado].filter(valorUtil).join(' · ');
        return `<li><b>${esc(nombre)}</b>${meta?`<small>${esc(meta)}</small>`:''}</li>`;
      }).join('');
      return `<section class="aih-major"><h2>${esc(titulo)}</h2><ul class="aih-list aih-doc-list">${items}</ul></section>`;
    }

    const esteticaAmb = resumenAsociados('Registros estéticos no vinculados inequívocamente a una atención',globales.esteticaAmbigua,['procedimiento_sugerido','zona_tratamiento']);
    const proc = resumenAsociados('Procedimientos asociados',globales.procedimientos,['nombre_procedimiento','procedimiento','tipo_procedimiento']);
    const cons = resumenAsociados('Consentimientos asociados',globales.consentimientos,['tipo_consentimiento','nombre_consentimiento','procedimiento']);
    const seg = resumenAsociados('Seguimientos asociados',globales.seguimientos,['tipo_seguimiento','motivo','mensaje']);
    [esteticaAmb,proc,cons,seg].filter(Boolean).forEach(x=>secciones.push(x));

    return secciones.join('');
  }

  /* ========================================================================
     CONSTRUCCIÓN DEL INFORME
  ======================================================================== */
  function construirDocumento(modelo){
    const inst = modelo.institucion;
    const p = modelo.paciente;

    const cabPaciente = miniDatos([
      ['Documento',p.documento],
      ['Fecha de nacimiento',fechaVista(p.fecha_nacimiento)],
      ['Edad',p.edad],
      ['Sexo',p.sexo],
      ['Estado civil',p.estado_civil],
      ['Ocupación',p.ocupacion],
      ['Teléfono / WhatsApp',p.telefono],
      ['Correo',p.correo],
      ['Dirección',p.direccion],
      ['Seguro médico',p.seguro],
      ['Tipo de sangre',p.tipo_sangre],
      ['Contacto de emergencia',p.contacto_emergencia],
      ['Teléfono emergencia',p.telefono_emergencia],
      ['Historia clínica',p.id_historia],
      ['Fecha de apertura',fechaVista(p.fecha_apertura)]
    ]);

    const atencionesHtml = modelo.atenciones.map((d,i)=>renderAtencion(d,i+1,modelo.medicos)).join('');
    const evolutivosHtml = renderEvolutivos(modelo.globales);
    const generado = new Intl.DateTimeFormat('es-EC',{
      timeZone:'America/Guayaquil',
      year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false
    }).format(new Date());

    return `<div class="aih-doc">
      <header class="aih-header">
        <div class="aih-brand">
          ${inst.logo ? `<img src="${esc(inst.logo)}" alt="Logo">` : `<div class="aih-logo-fallback">A</div>`}
          <div><h1>${esc(inst.nombre)}</h1>${valorUtil(inst.subtitulo)?`<p>${esc(inst.subtitulo)}</p>`:''}</div>
        </div>
        <div class="aih-title"><span>Documento clínico confidencial</span><h2>INFORME CLÍNICO HISTÓRICO</h2><p>Resumen longitudinal de atenciones</p></div>
      </header>

      <section class="aih-patient">
        <div class="aih-patient-name"><span>Paciente</span><h2>${esc(p.nombre || 'Paciente')}</h2></div>
        ${cabPaciente}
      </section>

      ${renderAntecedentes(modelo.antecedentes)}

      <section class="aih-major aih-timeline"><h2>Historial de atenciones</h2>${atencionesHtml || '<div class="aih-attention-empty">No existen atenciones clínicas registradas para este paciente.</div>'}</section>
      ${evolutivosHtml}

      <footer class="aih-footer-doc">
        <div><b>${esc(inst.nombre)}</b>${valorUtil(inst.direccion)?`<span>${esc(inst.direccion)}</span>`:''}${valorUtil(inst.telefono)?`<span>${esc(inst.telefono)}</span>`:''}</div>
        <div><span>Generado: ${esc(generado)}</span><span>Atenciones incluidas: ${modelo.atenciones.length}</span><span>Versión documental: HISTORICO_V1</span></div>
      </footer>
    </div>`;
  }

  /* ========================================================================
     VALIDACIÓN DEL MODELO
  ======================================================================== */
  function validarModelo(modelo){
    const ids = modelo.atenciones.map(x=>txt(x.atencion?.id_atencion)).filter(Boolean);
    const unicos = new Set(ids);
    const dx = modelo.atenciones.reduce((n,x)=>n+(x.diagnosticos?.length||0),0);
    const recetas = modelo.atenciones.reduce((n,x)=>n+(x.recetas?.length||0),0);
    const docs = modelo.atenciones.reduce((n,x)=>n+(x.documentos?.length||0),0);
    const obst = modelo.atenciones.reduce((n,x)=>n+(x.obstetricia?.length||0),0);

    const problemas = [];
    if(!modelo.paciente.id_paciente) problemas.push('Falta id_paciente.');
    if(ids.length !== unicos.size) problemas.push('Existen id_atencion duplicados.');
    if(ids.some(x=>!x)) problemas.push('Existe una atención sin id_atencion.');

    return {
      valido:problemas.length===0,
      problemas,
      resumen:{
        atenciones:modelo.atenciones.length,
        ids_unicos:unicos.size,
        diagnosticos:dx,
        recetas,
        documentos:docs,
        obstetricia:obst,
        estetica_ambigua:modelo.globales.esteticaAmbigua?.length || 0,
        advertencias_backend:state.advertencias.length
      }
    };
  }

  /* ========================================================================
     CSS DOCUMENTAL Y PREVIEW
  ======================================================================== */
  function cssDocumento(){
    return `
      :root{--aih-primary:#8b1e5a;--aih-text:#172033;--aih-muted:#64748b;--aih-line:#e5e7eb;--aih-soft:#fff7fb}
      *{box-sizing:border-box}
      body{margin:0;background:#eef1f5;color:var(--aih-text);font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .aih-doc{width:210mm;min-height:297mm;margin:18px auto;background:#fff;padding:13mm 13mm 15mm;box-shadow:0 10px 35px rgba(15,23,42,.12)}
      .aih-header{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start;border-bottom:2px solid var(--aih-primary);padding-bottom:12px;margin-bottom:14px}
      .aih-brand{display:flex;gap:11px;align-items:center}.aih-brand img{width:54px;height:54px;object-fit:contain}.aih-logo-fallback{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:var(--aih-primary);color:#fff;font-weight:900;font-size:24px}
      .aih-brand h1{font-size:18px;margin:0;color:var(--aih-primary)}.aih-brand p{font-size:10px;margin:3px 0 0;color:var(--aih-muted)}
      .aih-title{text-align:right}.aih-title span{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--aih-muted);font-weight:700}.aih-title h2{font-size:17px;margin:4px 0 2px}.aih-title p{margin:0;font-size:10px;color:var(--aih-muted)}
      .aih-patient{border:1px solid #ead7e2;background:linear-gradient(135deg,#fff,#fff9fc);border-radius:14px;padding:12px;margin-bottom:14px}.aih-patient-name span{font-size:9px;text-transform:uppercase;color:var(--aih-muted);font-weight:800}.aih-patient-name h2{font-size:18px;margin:2px 0 9px;color:#111827}
      .aih-major{margin:16px 0}.aih-major>h2{font-size:15px;color:var(--aih-primary);margin:0 0 9px;border-bottom:1px solid #ead7e2;padding-bottom:6px}
      .aih-mini-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.aih-mini{border:1px solid var(--aih-line);border-radius:8px;padding:6px 8px;min-width:0;background:#fff}.aih-mini span{display:block;font-size:8.5px;text-transform:uppercase;color:var(--aih-muted);font-weight:800;margin-bottom:2px}.aih-mini b{font-size:10.5px;line-height:1.3;word-break:break-word}
      .aih-attention{border:1px solid #dce2e8;border-radius:14px;padding:12px;margin:0 0 14px;break-inside:auto;page-break-inside:auto}.aih-attention-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;border-bottom:1px solid #edf0f3;padding-bottom:8px;margin-bottom:8px}.aih-attention-kicker{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:var(--aih-primary);font-weight:900}.aih-attention-head h2{font-size:14px;margin:2px 0 0;color:#111827}.aih-attention-id{font-size:8px;color:#94a3b8;max-width:180px;overflow-wrap:anywhere}
      .aih-block{margin:9px 0;break-inside:auto;page-break-inside:auto}.aih-block h3{font-size:11px;margin:0 0 5px;color:#334155;border-left:3px solid var(--aih-primary);padding-left:6px}.aih-block-body{font-size:10.3px;line-height:1.45;color:#273244}.aih-soft .aih-block-body{background:#f8fafc;padding:8px;border-radius:8px}.aih-danger h3{color:#9f1239;border-left-color:#e11d48}.aih-danger .aih-block-body{background:#fff1f2;padding:8px;border-radius:8px}
      .aih-special{border:1px solid #f0d9e6;background:#fffafd;border-radius:10px;padding:9px;margin:10px 0}.aih-special-title{font-size:11.5px;color:var(--aih-primary);margin:0 0 7px}
      .aih-kv-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.aih-kv{border:1px solid #edf0f3;border-radius:7px;padding:5px 7px}.aih-kv span{display:block;font-size:8.5px;color:var(--aih-muted);font-weight:700;margin-bottom:2px}.aih-kv b{font-size:10px;font-weight:700}.aih-kv-block{grid-column:1/-1}.aih-kv-block>div{margin-top:4px}
      .aih-list{margin:4px 0;padding-left:18px}.aih-list li{font-size:10px;margin:3px 0;line-height:1.35}.aih-doc-list{list-style:none;padding-left:0}.aih-doc-list li{padding:6px 7px;border:1px solid #edf0f3;border-radius:7px;margin:5px 0}.aih-doc-list b{display:block}.aih-doc-list small{display:block;color:var(--aih-muted);margin-top:2px}
      .aih-dx-list,.aih-med-list{display:grid;gap:5px}.aih-dx,.aih-med{border:1px solid #edf0f3;border-radius:7px;padding:6px 8px}.aih-dx b,.aih-med b{display:block;font-size:10.3px}.aih-dx small,.aih-med small{display:block;font-size:9px;color:var(--aih-muted);margin-top:2px;line-height:1.35}
      .aih-attention-empty{font-size:10px;color:var(--aih-muted);padding:8px;border:1px dashed #cbd5e1;border-radius:8px;background:#f8fafc}
      .aih-table-wrap{overflow:hidden;border:1px solid #edf0f3;border-radius:8px}.aih-table{width:100%;border-collapse:collapse;font-size:9.5px}.aih-table td,.aih-table th{padding:6px;border-bottom:1px solid #edf0f3;vertical-align:top}
      .aih-footer-doc{margin-top:18px;padding-top:9px;border-top:1px solid #dce2e8;display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:8.5px;color:var(--aih-muted)}.aih-footer-doc div{display:grid;gap:2px}.aih-footer-doc div:last-child{text-align:right}
      @page{size:A4;margin:10mm}
      @media print{body{background:#fff}.aih-doc{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none}.aih-attention{break-inside:auto;page-break-inside:auto}.aih-attention-head,.aih-mini,.aih-dx,.aih-med,.aih-doc-list li{break-inside:avoid;page-break-inside:avoid}}
    `;
  }

  function instalarPreviewCSS(){
    if(document.getElementById('auroInformeHistoricoPreviewCSS')) return;
    const s = document.createElement('style');
    s.id = 'auroInformeHistoricoPreviewCSS';
    s.textContent = `
      .aih-overlay{position:fixed;inset:0;z-index:2147482000;background:rgba(15,23,42,.62);display:flex;flex-direction:column;padding:18px;backdrop-filter:blur(5px)}
      .aih-preview-shell{width:min(1220px,100%);height:100%;margin:auto;background:#f6f7f9;border-radius:20px;overflow:hidden;display:grid;grid-template-rows:auto auto minmax(0,1fr);box-shadow:0 30px 90px rgba(15,23,42,.35)}
      .aih-preview-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:13px 16px;background:#fff;border-bottom:1px solid #e5e7eb}.aih-preview-head h3{margin:0;font-size:17px;color:#111827}.aih-preview-head small{display:block;color:#64748b;margin-top:2px}.aih-preview-actions{display:flex;gap:8px;flex-wrap:wrap}.aih-preview-actions button{border-radius:11px;padding:8px 12px;font-weight:800;border:1px solid #d8dee6;background:#fff;cursor:pointer}.aih-preview-actions .primary{background:#8b1e5a;color:#fff;border-color:#8b1e5a}
      .aih-validation{padding:9px 16px;background:#fff;border-bottom:1px solid #e5e7eb;display:flex;gap:7px;flex-wrap:wrap}.aih-validation span{font-size:10.5px;border:1px solid #e5e7eb;background:#f8fafc;border-radius:999px;padding:5px 8px;font-weight:750;color:#475569}.aih-validation .warn{background:#fff7ed;border-color:#fed7aa;color:#9a3412}.aih-validation .bad{background:#fff1f2;border-color:#fecdd3;color:#9f1239}
      .aih-preview-body{overflow:auto;padding:8px}.aih-loading{display:grid;place-items:center;height:100%;min-height:320px;color:#64748b}.aih-loading-card{background:#fff;padding:24px 28px;border-radius:18px;box-shadow:0 12px 35px rgba(15,23,42,.12);text-align:center}.aih-spinner{width:34px;height:34px;border:4px solid #f1d9e7;border-top-color:#8b1e5a;border-radius:50%;margin:0 auto 12px;animation:aihspin .75s linear infinite}@keyframes aihspin{to{transform:rotate(360deg)}}
      @media(max-width:760px){.aih-overlay{padding:0}.aih-preview-shell{border-radius:0}.aih-preview-head{align-items:flex-start;flex-direction:column}.aih-preview-actions{width:100%}.aih-preview-actions button{flex:1}.aih-preview-body{padding:0}.aih-preview-body .aih-doc{transform-origin:top left;margin:0;box-shadow:none}.aih-validation{padding:8px 10px}}
    `;
    document.head.appendChild(s);
  }

  function asegurarModal(){
    instalarPreviewCSS();
    let overlay = document.getElementById('auroInformeHistoricoOverlay');
    if(overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'auroInformeHistoricoOverlay';
    overlay.className = 'aih-overlay';
    overlay.style.display = 'none';
    overlay.innerHTML = `
      <div class="aih-preview-shell" role="dialog" aria-modal="true" aria-label="Vista previa del Informe Clínico Histórico">
        <div class="aih-preview-head">
          <div><h3>Informe Clínico Histórico</h3><small>Vista previa · solo lectura</small></div>
          <div class="aih-preview-actions">
            <button type="button" id="aihBtnCerrar">Cerrar</button>
            <button type="button" class="primary" id="aihBtnImprimir">Imprimir / PDF</button>
          </div>
        </div>
        <div class="aih-validation" id="aihValidation"></div>
        <div class="aih-preview-body" id="aihPreviewBody"></div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#aihBtnCerrar')?.addEventListener('click',cerrar);
    overlay.querySelector('#aihBtnImprimir')?.addEventListener('click',imprimir);
    overlay.addEventListener('click',e=>{ if(e.target===overlay) cerrar(); });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape' && overlay.style.display!=='none') cerrar(); });
    return overlay;
  }

  function mostrarCargando(texto='Construyendo informe clínico histórico...'){
    const overlay = asegurarModal();
    overlay.style.display = 'flex';
    const body = document.getElementById('aihPreviewBody');
    const val = document.getElementById('aihValidation');
    if(val) val.innerHTML = '';
    if(body) body.innerHTML = `<div class="aih-loading"><div class="aih-loading-card"><div class="aih-spinner"></div><b>${esc(texto)}</b><div style="margin-top:5px;font-size:12px">Lectura de datos clínicos. No se modifica la historia.</div></div></div>`;
  }

  function renderValidacion(v){
    const el = document.getElementById('aihValidation');
    if(!el) return;
    const r = v.resumen;
    const pills = [
      [`${r.atenciones} atenciones`,false],
      [`${r.ids_unicos} IDs únicos`,false],
      [`${r.diagnosticos} diagnósticos`,false],
      [`${r.recetas} recetas`,false],
      [`${r.documentos} documentos`,false],
      [`${r.obstetricia} registros obstétricos`,false],
      [r.estetica_ambigua ? `${r.estetica_ambigua} estética sin vínculo inequívoco` : '',!!r.estetica_ambigua],
      [r.advertencias_backend ? `${r.advertencias_backend} fuentes opcionales no disponibles` : '',!!r.advertencias_backend]
    ].filter(([t])=>t);

    if(!v.valido) pills.push([v.problemas.join(' · '),'bad']);
    el.innerHTML = pills.map(([t,c])=>`<span class="${c===true?'warn':c==='bad'?'bad':''}">${esc(t)}</span>`).join('');
  }

  function renderPreview(modelo,validacion){
    const body = document.getElementById('aihPreviewBody');
    if(!body) return;
    renderValidacion(validacion);
    body.innerHTML = `<style>${cssDocumento()}</style>${state.htmlDocumento}`;
  }

  function mostrarError(error){
    const overlay = asegurarModal();
    overlay.style.display = 'flex';
    const body = document.getElementById('aihPreviewBody');
    const val = document.getElementById('aihValidation');
    if(val) val.innerHTML = '<span class="bad">No se pudo construir el informe</span>';
    if(body) body.innerHTML = `<div class="aih-loading"><div class="aih-loading-card"><b style="color:#9f1239">${esc(error?.message || error || 'Error desconocido')}</b><div style="margin-top:8px;font-size:12px;color:#64748b">No se realizó ninguna escritura en la historia clínica.</div></div></div>`;
  }

  function cerrar(){
    const overlay = document.getElementById('auroInformeHistoricoOverlay');
    if(overlay) overlay.style.display = 'none';
  }

  function imprimir(){
    if(!state.htmlDocumento){
      alert('Genere primero la vista previa del Informe Clínico Histórico.');
      return;
    }

    const w = window.open('','_blank','noopener,noreferrer');
    if(!w){
      alert('El navegador bloqueó la ventana de impresión. Habilite las ventanas emergentes para este sitio.');
      return;
    }

    w.document.open();
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informe Clínico Histórico</title><style>${cssDocumento()}</style></head><body>${state.htmlDocumento}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300));<\/script></body></html>`);
    w.document.close();
  }

  /* ========================================================================
     ORQUESTADOR PRINCIPAL
  ======================================================================== */
  async function construirModelo(idPaciente, token){
    const [paciente, historias, atenciones, medicos, configuracion, globalesBase] = await Promise.all([
      cargarPaciente(idPaciente),
      cargarHistoriasPaciente(idPaciente),
      cargarAtencionesPaciente(idPaciente),
      cargarMedicos(),
      cargarConfiguracion(),
      cargarColeccionesGlobales(idPaciente)
    ]);

    if(token !== state.token) throw new Error('La generación anterior fue cancelada por un nuevo contexto.');

    const historia = historiaConAntecedentes(historias || []);
    const detalleAtenciones = await mapLimit(atenciones,MAX_CONCURRENCIA,cargarModuloAtencion);

    if(token !== state.token) throw new Error('El paciente cambió durante la generación del informe.');
    if(idPacienteSeleccionado() && idPacienteSeleccionado() !== idPaciente){
      throw new Error('El paciente seleccionado cambió durante la generación. Vuelva a abrir el informe.');
    }

    const globales = asociarColecciones(detalleAtenciones,globalesBase);

    return {
      institucion:normalizarInstitucion(configuracion),
      paciente:normalizarPaciente(paciente,historia),
      historia,
      antecedentes:normalizarAntecedentes(historia),
      medicos,
      atenciones:detalleAtenciones,
      globales
    };
  }

  async function abrir(){
    if(state.cargando) return;

    const idPaciente = idPacienteSeleccionado();
    if(!idPaciente){
      alert('Seleccione primero un paciente en Historia Clínica para generar el Informe Histórico.');
      return;
    }

    const token = ++state.token;
    state.cargando = true;
    state.idPaciente = idPaciente;
    state.datos = null;
    state.htmlDocumento = '';
    state.advertencias = [];
    state.errores = [];
    mostrarCargando();

    try{
      const modelo = await construirModelo(idPaciente,token);
      if(token !== state.token) return;

      const validacion = validarModelo(modelo);
      state.datos = modelo;
      state.htmlDocumento = construirDocumento(modelo);
      renderPreview(modelo,validacion);
    }catch(error){
      console.error(MODULO,error);
      state.errores.push(error?.message || String(error));
      mostrarError(error);
    }finally{
      if(token === state.token) state.cargando = false;
    }
  }

  /* ========================================================================
     INTERFAZ PÚBLICA MÍNIMA
  ======================================================================== */
  window.auroInformeHistorico = Object.freeze({
    version:VERSION,
    abrir,
    imprimir,
    cerrar,
    diagnostico:function(){
      return {
        version:VERSION,
        cargando:state.cargando,
        id_paciente:state.idPaciente,
        tiene_modelo:!!state.datos,
        atenciones:state.datos?.atenciones?.length || 0,
        advertencias:[...state.advertencias],
        errores:[...state.errores]
      };
    }
  });

  console.info(`${MODULO} v${VERSION}: cargado en modo solo lectura.`);
})();
