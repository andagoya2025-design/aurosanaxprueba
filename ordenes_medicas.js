/***********************************************************************
 AUROSANAX ERP
 Archivo: ordenes_medicas.js
 Módulo: Órdenes médicas formales por atención
 Versión: 1.2.0
 Fecha: 2026-09-11
 -----------------------------------------------------------------------
 ALCANCE QUIRÚRGICO / ANTIRREGRESIÓN
 - NO reemplaza Plan: Plan prepara las indicaciones clínicas.
 - Lee las órdenes visibles del Plan únicamente si pertenecen a la atención exacta.
 - Una emisión formal = una fila en ordenes_medicas.
 - Una fila puede contener múltiples ítems dentro de detalle_json.items.
 - Conserva snapshot documental de paciente, historia, médico, centro e ítems.
 - PDF no se almacena: se reconstruye bajo demanda.
 - No modifica Diagnóstico, Atenciones, Recetas, Certificados ni Documentos.
 - No usa polling ni MutationObserver.
 - Falla cerrado si el contexto clínico es ambiguo o no coincide con Plan.
 - Atención finalizada/cerrada puede abrir/imprimir/corregir documento formal;
   anulada/cancelada/archivada queda bloqueada.
 - Fecha clínica: YYYY-MM-DD en America/Guayaquil.
 - creado_en / actualizado_en son responsabilidad del backend.
************************************************************************/
(function(){
'use strict';

if(window.auroOrdenesMedicas?.version) return;

const VERSION='1.2.0';
const JSON_VERSION='AUROSANAX_ORDEN_MEDICA_JSON_V1';

const state={
  idAtencion:'',
  contexto:null,
  ordenesEmitidas:[],
  editandoId:'',
  guardando:false,
  token:0,
  configuracion:{},
  medicos:[],
  paciente:null,
  historia:null,
  montado:false
};

const txt=v=>String(v??'').trim();
const esc=v=>String(v??'')
  .replace(/&/g,'&amp;')
  .replace(/</g,'&lt;')
  .replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;')
  .replace(/'/g,'&#039;');

const norm=v=>txt(v)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .toLowerCase()
  .replace(/\s+/g,' ')
  .trim();

function apiUrl(){
  try{
    if(typeof API_URL!=='undefined'&&API_URL) return txt(API_URL);
  }catch(e){}
  return txt(window.API_URL||document.getElementById('appsScriptUrl')?.value);
}

async function get(accion,p={}){
  const b=apiUrl();
  if(!b) throw Error('API_URL no está definida.');
  const q=new URLSearchParams({accion,_:Date.now()});
  Object.entries(p).forEach(([k,v])=>{ if(txt(v)) q.append(k,txt(v)); });
  const r=await fetch(b+'?'+q.toString(),{cache:'no-store'});
  if(!r.ok) throw Error('HTTP '+r.status);
  return r.json();
}

async function post(accion,data){
  const b=apiUrl();
  if(!b) throw Error('API_URL no está definida.');
  const r=await fetch(b,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({accion,data})
  });
  if(!r.ok) throw Error('HTTP '+r.status);
  return r.json();
}

function arr(x){
  return Array.isArray(x)?x:
    Array.isArray(x?.registros)?x.registros:
    Array.isArray(x?.data)?x.data:[];
}

function parse(v){
  if(v&&typeof v==='object') return v;
  try{return JSON.parse(txt(v)||'{}');}catch(e){return {};}
}

function respuestaOk(r){
  if(r===true) return true;
  if(!r||typeof r!=='object') return false;
  if(r.ok===true||r.success===true||r.exito===true) return true;
  if(txt(r.status).toLowerCase()==='ok') return true;
  return false;
}

function activa(){
  try{
    const a=window.getAtencionActiva?.();
    if(a?.id_atencion) return a;
  }catch(e){}
  try{
    const a=window.obtenerContextoAtencionActual?.();
    if(a?.id_atencion) return a;
  }catch(e){}
  return window.atencionesState?.atencionActual||window.currentAttention||window.atencionActual||null;
}

function idActiva(){
  try{
    const x=txt(window.getIdAtencionActiva?.());
    if(x) return x;
  }catch(e){}
  const a=activa();
  return txt(
    a?.id_atencion||
    window.planState?.atencionActual||
    window.examenFisicoState?.atencionActual||
    window.auroDiagnosticosState?.atencionActual
  );
}

function contexto(){
  const a=activa()||{};
  const id=txt(a.id_atencion||idActiva());
  const estado=norm(a.estado_atencion||a.estado||a.estado_consulta);
  const bloqueada=/(anulad|cancelad|archivad)/.test(estado);

  return {
    id,
    atencion:a,
    estado,
    bloqueada,
    editable:!!id&&!bloqueada,
    numeroConsulta:txt(a.numero_consulta||a.numero_atencion||a.numero),
    idPaciente:txt(a.id_paciente),
    idHistoria:txt(a.id_historia),
    idMedico:txt(a.id_medico),
    fechaAtencion:txt(a.fecha_atencion||a.fecha_consulta),
    horaAtencion:txt(a.hora_atencion||a.hora_consulta)
  };
}

function fechaEcuadorISO(){
  const p=new Intl.DateTimeFormat('en-CA',{
    timeZone:'America/Guayaquil',
    year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date()).reduce((a,x)=>{a[x.type]=x.value;return a;},{});
  return `${p.year}-${p.month}-${p.day}`;
}

function fechaVisual(v){
  const m=txt(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m?`${m[3]}/${m[2]}/${m[1]}`:(txt(v)||'—');
}

function nombreCompleto(obj){
  obj=obj||{};
  return txt(
    obj.nombre_completo||obj.nombre||
    [obj.nombres,obj.apellidos].filter(Boolean).join(' ')
  ).replace(/\s+/g,' ').trim();
}

function resolverPaciente(ctx){
  const a=ctx?.atencion||{};
  const id=txt(ctx?.idPaciente||a.id_paciente);
  try{
    if(typeof window.getPacienteActivo==='function'){
      const p=window.getPacienteActivo();
      if(p){
        const pid=txt(p.id_paciente||p.id);
        if(!id||!pid||pid===id) return p;
      }
    }
  }catch(e){}
  const listas=[window.patients,window.pacientes,window.listaPacientes].filter(Array.isArray);
  for(const lista of listas){
    const p=lista.find(x=>txt(x.id_paciente||x.id)===id);
    if(p) return p;
  }
  return {
    id_paciente:id,
    nombre:a.nombre_paciente||a.paciente_nombre||'',
    numero_documento:a.numero_documento||a.cedula||a.identificacion||'',
    telefono:a.telefono||a.whatsapp||'',
    direccion:a.direccion||''
  };
}

function resolverHistoria(ctx){
  const id=txt(ctx?.idHistoria);
  const listas=[window.historiasClinicas,window.historias,window.listaHistorias].filter(Array.isArray);
  for(const lista of listas){
    const h=lista.find(x=>txt(x.id_historia||x.id)===id);
    if(h) return h;
  }
  try{
    if(window.historiaActual&&txt(window.historiaActual.id_historia||window.historiaActual.id)===id) return window.historiaActual;
  }catch(e){}
  try{
    if(window.currentHistoria&&txt(window.currentHistoria.id_historia||window.currentHistoria.id)===id) return window.currentHistoria;
  }catch(e){}
  return {id_historia:id};
}

function resolverMedico(ctx){
  const a=ctx?.atencion||{};
  const id=txt(ctx?.idMedico||a.id_medico);
  const listas=[state.medicos,window.medicos,window.medicosActivos,window.listaMedicos,window.configuracionMedicos,window.medicosConfiguracion].filter(Array.isArray);
  let m=null;
  for(const lista of listas){
    m=lista.find(x=>txt(x.id_medico||x.id||x.codigo)===id)||null;
    if(m) break;
  }
  return {
    id_medico:id,
    nombre:nombreCompleto(m)||txt(a.nombre_medico||a.medico_nombre)||'Profesional tratante',
    especialidad:txt(m?.especialidad_principal||m?.especialidad||m?.especialidad_medica||a.especialidad||a.medico_especialidad),
    registro_msp:txt(m?.registro_msp||m?.msp||m?.registro_profesional),
    registro_senescyt:txt(m?.registro_senescyt||m?.senescyt),
    email:txt(m?.email||m?.correo),
    telefono:txt(m?.telefono||m?.whatsapp)
  };
}

function configGlobal(){
  const candidatos=[window.auroConfiguracionCentro,window.configuracionCentro,window.configCentro,window.CONFIG_CENTRO,window.configuracionInstitucional];
  let c=candidatos.find(x=>x&&typeof x==='object'&&!Array.isArray(x))||{};
  if(c.datos&&typeof c.datos==='object') c=c.datos;
  return c;
}

function normalizarConfig(c){
  c=c||{};
  if(c.datos&&typeof c.datos==='object') c=c.datos;
  return {
    nombre:txt(c.nombre_clinica||c.nombre_centro||c.nombre_comercial||c.razon_social)||'AUROSANAX',
    subtitulo:txt(c.subtitulo_clinica||c.descripcion_clinica||c.eslogan_clinica),
    razon_social:txt(c.razon_social),
    ruc:txt(c.ruc),
    direccion:txt(c.direccion_clinica||c.direccion),
    ciudad:txt(c.ciudad_clinica||c.ciudad)||'Guayaquil',
    provincia:txt(c.provincia_clinica||c.provincia),
    pais:txt(c.pais_clinica||c.pais)||'Ecuador',
    telefono:txt(c.telefono_clinica||c.whatsapp_clinica||c.telefono||c.whatsapp),
    email:txt(c.email_clinica||c.correo_clinica||c.email||c.correo),
    web:txt(c.sitio_web_clinica||c.web_clinica||c.web),
    logo:txt(c.logo_url||c.logo_drive_url||c.logo),
    colorPrincipal:txt(c.color_principal)||'#8b1e5a'
  };
}

async function cargarAuxiliares(ctx){
  state.paciente=resolverPaciente(ctx);
  state.historia=resolverHistoria(ctx);
  let cfg=normalizarConfig(configGlobal());
  try{
    const remoto=await get('obtenerConfiguracion');
    cfg=normalizarConfig(Object.assign({},configGlobal(),remoto||{}));
  }catch(e){}
  state.configuracion=cfg;
  try{
    state.medicos=arr(await get('listarMedicosActivos'));
  }catch(e){
    state.medicos=[];
  }
}

function itemOrdenNormalizado(o){
  o=o||{};
  return {
    orden:txt(o.orden||o.nombre||o.examen||o.procedimiento),
    cat:txt(o.cat||o.categoria||o.tipo)||'OTROS',
    obs:txt(o.obs||o.observacion||o.observaciones),
    codigo_cie10:txt(o.codigo_cie10||o.cie10||o.codigo),
    diagnostico:txt(o.diagnostico||o.descripcion_diagnostico)
  };
}

function claveItem(o){
  const x=itemOrdenNormalizado(o);
  return [norm(x.orden),norm(x.cat),norm(x.obs),norm(x.codigo_cie10)].join('|');
}

function itemsUnicos(lista){
  const vistos=new Set();
  const out=[];
  (Array.isArray(lista)?lista:[]).forEach(o=>{
    const x=itemOrdenNormalizado(o);
    if(!x.orden) return;
    const k=claveItem(x);
    if(vistos.has(k)) return;
    vistos.add(k);
    out.push(x);
  });
  return out;
}

function contextoPlanSeguro(ctx){
  const id=txt(ctx?.id);
  const idPlan=txt(window.planState?.atencionActual);
  const idRender=txt(window.__auroPlanAtencionRenderizada);

  if(!id) return {ok:false,motivo:'No existe una atención clínica seleccionada.'};
  if(idPlan&&idPlan!==id) return {ok:false,motivo:'El Plan visible pertenece a otra atención.'};
  if(idRender&&idRender!==id) return {ok:false,motivo:'La consulta dibujada en Plan no coincide con la atención seleccionada.'};

  return {ok:true,id};
}

function itemsPlanActual(){
  const ctx=contexto();
  const ver=contextoPlanSeguro(ctx);
  if(!ver.ok) return {ok:false,motivo:ver.motivo,items:[]};
  const lista=Array.isArray(window.ordenesMedicasPlanSeleccionadas)?window.ordenesMedicasPlanSeleccionadas:[];
  return {ok:true,items:itemsUnicos(lista)};
}

function datosDocumentoDesdePlan(){
  const ctx=contexto();
  const ver=contextoPlanSeguro(ctx);
  if(!ver.ok) throw Error(ver.motivo);
  if(ctx.bloqueada) throw Error('La atención está anulada, cancelada o archivada.');

  const plan=itemsPlanActual();
  if(!plan.ok) throw Error(plan.motivo);
  if(!plan.items.length) throw Error('No hay órdenes médicas agregadas en el Plan para esta atención.');

  const paciente=resolverPaciente(ctx);
  const historia=resolverHistoria(ctx);
  const medico=resolverMedico(ctx);
  const centro=state.configuracion?.nombre?state.configuracion:normalizarConfig(configGlobal());

  const nombrePaciente=nombreCompleto(paciente)||txt(ctx.atencion?.nombre_paciente||ctx.atencion?.paciente_nombre);
  const numeroDocumento=txt(paciente?.numero_documento||paciente?.cedula||paciente?.identificacion||ctx.atencion?.numero_documento);

  return {
    id_atencion:ctx.id,
    numero_consulta:ctx.numeroConsulta,
    id_paciente:txt(ctx.idPaciente||paciente?.id_paciente||paciente?.id),
    nombre_paciente:nombrePaciente,
    numero_documento:numeroDocumento,
    id_historia:txt(ctx.idHistoria||historia?.id_historia||historia?.id),
    id_medico:txt(ctx.idMedico||medico.id_medico),
    nombre_medico:medico.nombre,
    especialidad:medico.especialidad,
    fecha_emision:fechaEcuadorISO(),
    detalle_json:{
      version:JSON_VERSION,
      fecha_emision:fechaEcuadorISO(),
      id_atencion:ctx.id,
      numero_consulta:ctx.numeroConsulta,
      items:plan.items,
      observaciones_generales:'',
      paciente:{
        id_paciente:txt(ctx.idPaciente||paciente?.id_paciente||paciente?.id),
        nombre:nombrePaciente,
        numero_documento:numeroDocumento,
        telefono:txt(paciente?.telefono||paciente?.whatsapp),
        direccion:txt(paciente?.direccion)
      },
      historia:{
        id_historia:txt(ctx.idHistoria||historia?.id_historia||historia?.id)
      },
      medico:{
        id_medico:txt(ctx.idMedico||medico.id_medico),
        nombre:medico.nombre,
        especialidad:medico.especialidad,
        registro_msp:medico.registro_msp,
        registro_senescyt:medico.registro_senescyt,
        email:medico.email,
        telefono:medico.telefono
      },
      centro:centro,
      origen:'PLAN_CLINICO'
    },
    estado:'Emitida',
    version:1
  };
}

function datosDocumentoEmitido(reg){
  const d=parse(reg?.detalle_json);
  const items=itemsUnicos(d.items||reg?.items||[]);
  return {
    id_orden:txt(reg?.id_orden),
    id_atencion:txt(reg?.id_atencion||d.id_atencion),
    numero_consulta:txt(reg?.numero_consulta||d.numero_consulta),
    id_paciente:txt(reg?.id_paciente||d.paciente?.id_paciente),
    nombre_paciente:txt(reg?.nombre_paciente||d.paciente?.nombre),
    numero_documento:txt(reg?.numero_documento||d.paciente?.numero_documento),
    id_historia:txt(reg?.id_historia||d.historia?.id_historia),
    id_medico:txt(reg?.id_medico||d.medico?.id_medico),
    nombre_medico:txt(reg?.nombre_medico||d.medico?.nombre),
    especialidad:txt(reg?.especialidad||d.medico?.especialidad),
    fecha_emision:txt(reg?.fecha_emision||d.fecha_emision),
    estado:txt(reg?.estado)||'Emitida',
    version:Number(reg?.version||d.version_documento||1)||1,
    detalle_json:Object.assign({},d,{items})
  };
}

function estadoOrdenEsAnulada(r){
  return /anulad/.test(norm(r?.estado));
}

function estadoOrdenEsReemplazada(r){
  return /reemplaz/.test(norm(r?.estado));
}

function ordenesActivasFormales(){
  return state.ordenesEmitidas
    .filter(r=>!estadoOrdenEsAnulada(r)&&!estadoOrdenEsReemplazada(r))
    .sort((a,b)=>{
      const va=Number(a?.version||0), vb=Number(b?.version||0);
      if(vb!==va) return vb-va;
      return txt(b?.actualizado_en||b?.creado_en||b?.fecha_emision)
        .localeCompare(txt(a?.actualizado_en||a?.creado_en||a?.fecha_emision));
    });
}

function ordenActivaFormal(){
  return ordenesActivasFormales()[0]||null;
}

function solicitarJustificacion(titulo){
  const motivo=window.prompt(
    String(titulo||'Justificación obligatoria')+
    '\n\nEscriba el motivo clínico o administrativo de esta acción:'
  );
  if(motivo===null) return null;
  const limpio=txt(motivo);
  if(limpio.length<3){
    window.alert('La justificación es obligatoria y debe tener al menos 3 caracteres.');
    return null;
  }
  return limpio;
}

function clonarDocumentoEmitido(reg){
  const base=datosDocumentoEmitido(reg);
  const d=parse(base.detalle_json);
  return Object.assign({},base,{
    detalle_json:Object.assign({},d,{
      items:itemsUnicos(d.items||[])
    })
  });
}

function datosCorreccionDesdeDocumento(reg,items,motivo){
  const base=clonarDocumentoEmitido(reg);
  const versionNueva=(Number(base.version)||1)+1;
  const ahora=new Date().toLocaleString('es-EC',{timeZone:'America/Guayaquil',hour12:false});
  const detalle=Object.assign({},base.detalle_json,{
    version:JSON_VERSION,
    version_documento:versionNueva,
    correccion_de:txt(reg.id_orden),
    items:itemsUnicos(items),
    auditoria_correccion:{
      motivo:txt(motivo),
      id_orden_origen:txt(reg.id_orden),
      version_origen:Number(reg.version||1)||1,
      fecha_visual_ecuador:ahora
    }
  });

  return Object.assign({},base,{
    id_orden:txt(reg.id_orden),
    version:versionNueva,
    estado:'Emitida',
    detalle_json:detalle,
    motivo_correccion:txt(motivo)
  });
}

function instalarCSS(){
  if(document.getElementById('auroOrdenMedicaCSS')) return;
  const s=document.createElement('style');
  s.id='auroOrdenMedicaCSS';
  s.textContent=`
#auroOrdenMedicaFormalApp{margin-top:14px;font-family:inherit;color:#1f2937}
#auroOrdenMedicaFormalApp *{box-sizing:border-box}
.aom-shell{border:1px solid #ead7e2;border-radius:16px;background:#fff;padding:14px}
.aom-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.aom-title{font-weight:850;color:#111827;display:flex;align-items:center;gap:8px}
.aom-meta{font-size:12px;color:#6b7280;margin-top:3px}
.aom-primary{border:0;border-radius:12px;background:linear-gradient(135deg,#8b1e5a,#c23b83);color:white;padding:10px 14px;font-weight:800;display:inline-flex;align-items:center;gap:7px}
.aom-primary:disabled{opacity:.55;cursor:not-allowed}
.aom-notice{margin-top:10px;padding:9px 11px;border-radius:11px;font-size:12.5px;background:#f8fafc;border:1px solid #e5e7eb;color:#475569}
.aom-notice.ok{background:#f0fdf4;border-color:#bbf7d0;color:#166534}
.aom-notice.warn{background:#fffbeb;border-color:#fde68a;color:#92400e}
.aom-notice.err{background:#fef2f2;border-color:#fecaca;color:#991b1b}
.aom-history{margin-top:12px;border-top:1px solid #f1f5f9;padding-top:12px}
.aom-history-title{font-size:12px;font-weight:850;text-transform:uppercase;letter-spacing:.04em;color:#64748b;margin-bottom:8px}
.aom-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid #f1f5f9}
.aom-row:last-child{border-bottom:0}
.aom-row-main{min-width:0}
.aom-row-main strong{display:block;font-size:13px;overflow-wrap:anywhere}
.aom-row-main small{display:block;color:#6b7280;margin-top:2px}
.aom-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.aom-btn{border:1px solid #d1d5db;background:#fff;color:#374151;border-radius:10px;padding:6px 9px;font-size:12px;font-weight:750}
.aom-btn:hover{background:#f9fafb}
.aom-btn.danger{border-color:#fecaca;color:#991b1b;background:#fff7f7}
.aom-empty{font-size:12.5px;color:#6b7280;padding:4px 0}
.aom-modal{position:fixed;inset:0;z-index:2147482000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.55)}
.aom-modal-panel{width:min(920px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;border:1px solid #e5e7eb;box-shadow:0 28px 80px rgba(15,23,42,.28);padding:18px}
.aom-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.aom-modal-title{font-size:16px;font-weight:900;color:#111827}
.aom-modal-close{border:1px solid #d1d5db;background:#fff;border-radius:9px;width:34px;height:34px;font-size:20px;line-height:1}
.aom-editor-list{display:grid;gap:10px}
.aom-editor-item{display:grid;grid-template-columns:minmax(0,2fr) minmax(130px,.8fr) minmax(0,1.4fr);gap:8px;padding:10px;border:1px solid #e5e7eb;border-radius:12px;background:#fafafa}
.aom-editor-item input,.aom-editor-item textarea{width:100%;border:1px solid #d1d5db;border-radius:9px;padding:8px;font:inherit}
.aom-editor-item textarea{min-height:42px;resize:vertical}
.aom-editor-remove{grid-column:1/-1;justify-self:end}
.aom-editor-reason{margin-top:14px}
.aom-editor-reason textarea{width:100%;min-height:78px;border:1px solid #d1d5db;border-radius:10px;padding:9px;font:inherit}
.aom-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px;flex-wrap:wrap}
.aom-paper{width:210mm;min-height:297mm;background:#fff;color:#111827;padding:16mm 17mm 18mm;margin:0 auto;font-family:Arial,sans-serif}
.aom-doc-head{display:grid;grid-template-columns:1fr auto;gap:15px;align-items:start;border-bottom:2px solid #8b1e5a;padding-bottom:10px;margin-bottom:18px}
.aom-doc-brand{font-size:22px;font-weight:900;color:#8b1e5a}
.aom-doc-sub{font-size:10.5px;color:#4b5563;line-height:1.45;margin-top:4px}
.aom-doc-title{text-align:center;font-size:20px;font-weight:900;letter-spacing:.06em;margin:13px 0 18px}
.aom-doc-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px 20px;font-size:12px;margin-bottom:18px}
.aom-doc-label{color:#6b7280;font-weight:700}
.aom-doc-table{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:9px}
.aom-doc-table th,.aom-doc-table td{border:1px solid #d1d5db;padding:7px 8px;vertical-align:top}
.aom-doc-table th{background:#f8fafc;text-align:left}
.aom-doc-sign{margin-top:38px;text-align:center;page-break-inside:avoid}
.aom-doc-line{width:72mm;border-top:1px solid #111827;margin:0 auto 7px}
.aom-doc-foot{margin-top:24px;padding-top:8px;border-top:1px solid #e5e7eb;text-align:center;font-size:9.5px;color:#6b7280;line-height:1.4}
@media(max-width:760px){
  .aom-shell{padding:12px}
  .aom-head{align-items:stretch}
  .aom-primary{width:100%;justify-content:center}
  .aom-row{grid-template-columns:1fr}
  .aom-actions{justify-content:flex-start}
}
@media print{.aom-print-toolbar{display:none!important}.aom-paper{box-shadow:none!important;margin:0!important}}
`;
  document.head.appendChild(s);
}

function mountTarget(){
  const body=document.getElementById('hcOrdenesTableBody');
  if(!body) return null;
  return body.closest('.ordenes-medicas-box')||body.parentElement?.parentElement||null;
}

function montar(){
  instalarCSS();
  const target=mountTarget();
  if(!target) return false;
  let app=document.getElementById('auroOrdenMedicaFormalApp');
  if(!app){
    app=document.createElement('div');
    app.id='auroOrdenMedicaFormalApp';
    target.appendChild(app);
  }
  state.montado=true;
  render();
  return true;
}

function estadoPrimario(){
  const ctx=contexto();
  const plan=itemsPlanActual();
  const activas=ordenesActivasFormales();
  const activaFormal=activas[0]||null;

  if(!ctx.id) return {disabled:true,texto:'Emitir Orden Médica',icono:'bi-file-earmark-medical',nota:'Seleccione una atención clínica.'};
  if(ctx.bloqueada) return {disabled:true,texto:'Orden médica bloqueada',icono:'bi-lock',nota:'La atención está anulada, cancelada o archivada.'};
  if(!plan.ok) return {disabled:true,texto:'Emitir Orden Médica',icono:'bi-exclamation-triangle',nota:plan.motivo};

  if(activas.length>1){
    return {
      disabled:true,
      texto:'Revisar órdenes activas',
      icono:'bi-exclamation-triangle',
      nota:`Se detectaron ${activas.length} órdenes formales activas para esta misma atención. No se permitirá otra emisión hasta resolver la duplicidad.`
    };
  }

  if(activaFormal){
    return {
      disabled:false,
      texto:'Ver orden emitida',
      icono:'bi-eye',
      nota:`Ya existe una orden formal activa (${txt(activaFormal.id_orden)} · v${Number(activaFormal.version||1)}). El botón no emitirá otra v1 accidentalmente.`
    };
  }

  if(!plan.items.length) return {disabled:true,texto:'Emitir Orden Médica',icono:'bi-file-earmark-medical',nota:'Agregue al menos una orden en el Plan.'};
  return {disabled:false,texto:'Emitir Orden Médica',icono:'bi-file-earmark-medical-fill',nota:`Se emitirán ${plan.items.length} ${plan.items.length===1?'orden':'órdenes'} de esta atención.`};
}

function render(){
  const app=document.getElementById('auroOrdenMedicaFormalApp');
  if(!app) return;
  const e=estadoPrimario();
  const emitidas=state.ordenesEmitidas.slice().sort((a,b)=>{
    const fecha=txt(b.actualizado_en||b.creado_en||b.fecha_emision).localeCompare(txt(a.actualizado_en||a.creado_en||a.fecha_emision));
    if(fecha!==0) return fecha;
    return (Number(b.version)||0)-(Number(a.version)||0);
  });
  app.innerHTML=`
    <div class="aom-shell">
      <div class="aom-head">
        <div>
          <div class="aom-title"><i class="bi bi-file-earmark-medical"></i> Documento formal de orden médica</div>
          <div class="aom-meta">Una emisión puede contener varias órdenes. Vinculada a la atención exacta.</div>
        </div>
        <button type="button" id="auroOrdenMedicaBtnPrincipal" class="aom-primary" ${e.disabled?'disabled':''}>
          <i class="bi ${esc(e.icono)}"></i> ${esc(e.texto)}
        </button>
      </div>
      <div id="auroOrdenMedicaAviso" class="aom-notice ${e.disabled?'warn':''}">${esc(e.nota)}</div>
      <div class="aom-history">
        <div class="aom-history-title">Órdenes emitidas en esta atención</div>
        ${emitidas.length?emitidas.map(r=>filaHistorial(r)).join(''):'<div class="aom-empty">Todavía no hay órdenes formales emitidas para esta atención.</div>'}
      </div>
    </div>`;

  document.getElementById('auroOrdenMedicaBtnPrincipal')?.addEventListener('click',accionPrincipal);
  app.querySelectorAll('[data-aom-preview]').forEach(b=>b.addEventListener('click',()=>vistaPreviaPorId(b.dataset.aomPreview)));
  app.querySelectorAll('[data-aom-editar]').forEach(b=>b.addEventListener('click',()=>editarFormal(b.dataset.aomEditar)));
  app.querySelectorAll('[data-aom-imprimir]').forEach(b=>b.addEventListener('click',()=>imprimirPorId(b.dataset.aomImprimir)));
  app.querySelectorAll('[data-aom-anular]').forEach(b=>b.addEventListener('click',()=>anular(b.dataset.aomAnular)));
}

function filaHistorial(r){
  const id=txt(r.id_orden);
  const d=parse(r.detalle_json);
  const n=itemsUnicos(d.items||r.items||[]).length;
  const anulada=estadoOrdenEsAnulada(r);
  const reemplazada=estadoOrdenEsReemplazada(r);
  const noEditable=anulada||reemplazada;

  return `<div class="aom-row">
    <div class="aom-row-main">
      <strong>${esc(id||'Orden médica')}</strong>
      <small>${esc(fechaVisual(r.fecha_emision))} · ${n} ${n===1?'ítem':'ítems'} · ${esc(r.estado||'Emitida')}${r.version?` · v${esc(r.version)}`:''}</small>
    </div>
    <div class="aom-actions">
      <button type="button" class="aom-btn" data-aom-preview="${esc(id)}"><i class="bi bi-eye"></i> Vista previa</button>
      ${noEditable?'':`<button type="button" class="aom-btn" data-aom-editar="${esc(id)}"><i class="bi bi-pencil-square"></i> Editar</button>`}
      <button type="button" class="aom-btn" data-aom-imprimir="${esc(id)}"><i class="bi bi-printer"></i> Imprimir</button>
      ${noEditable?'':`<button type="button" class="aom-btn danger" data-aom-anular="${esc(id)}"><i class="bi bi-trash"></i> Eliminar</button>`}
    </div>
  </div>`;
}

function aviso(msg,tipo=''){
  const el=document.getElementById('auroOrdenMedicaAviso');
  if(!el) return;
  el.className='aom-notice'+(tipo?' '+tipo:'');
  el.textContent=msg;
}

function setGuardando(v){
  state.guardando=!!v;
  const b=document.getElementById('auroOrdenMedicaBtnPrincipal');
  if(b){
    b.disabled=!!v;
    if(v) b.innerHTML='<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Guardando...';
  }
}

async function accionPrincipal(){
  if(state.guardando) return;
  const activas=ordenesActivasFormales();
  if(activas.length>1){
    aviso(`Se detectaron ${activas.length} órdenes formales activas para esta atención. No se emitirá otra hasta resolver la duplicidad.`,'err');
    return;
  }
  const activaFormal=activas[0]||null;
  if(activaFormal) return vistaPreviaPorId(activaFormal.id_orden);
  return emitir();
}

async function emitir(){
  const activas=ordenesActivasFormales();
  if(activas.length>1){
    aviso(`Se detectaron ${activas.length} órdenes formales activas para esta atención. Emisión bloqueada para evitar otra duplicidad.`,'err');
    return;
  }

  const existente=activas[0]||null;
  if(existente){
    aviso('Ya existe una orden formal activa para esta atención. Ábrala o edítela; no se emitió otra v1.','warn');
    vistaPreviaPorId(existente.id_orden);
    return;
  }

  let data;
  try{data=datosDocumentoDesdePlan();}
  catch(e){aviso(e.message||'No se pudo preparar la orden.','err');return;}

  if(!confirm(`Se emitirá una orden médica formal con ${data.detalle_json.items.length} ítem(s). ¿Continuar?`)) return;

  setGuardando(true);
  aviso('Emitiendo orden médica...');
  try{
    const r=await post('guardarOrdenMedica',data);
    if(!respuestaOk(r)) throw Error(txt(r?.error||r?.mensaje||r?.message)||'No se pudo guardar la orden.');
    state.editandoId='';
    await cargar();
    aviso('Orden médica emitida correctamente.','ok');
  }catch(e){
    aviso('No se pudo emitir la orden: '+(e.message||e),'err');
  }finally{
    setGuardando(false);
    render();
  }
}

function cerrarEditorFormal(){
  document.getElementById('auroOrdenMedicaEditorModal')?.remove();
  state.editandoId='';
}

function recogerItemsEditorFormal(modal){
  return Array.from(modal.querySelectorAll('[data-aom-editor-item]')).map(fila=>({
    orden:txt(fila.querySelector('[data-campo="orden"]')?.value),
    cat:txt(fila.querySelector('[data-campo="cat"]')?.value)||'OTROS',
    obs:txt(fila.querySelector('[data-campo="obs"]')?.value),
    codigo_cie10:txt(fila.dataset.cie10),
    diagnostico:txt(fila.dataset.diagnostico)
  })).filter(x=>x.orden);
}

function renderItemEditorFormal(item,index){
  return `<div class="aom-editor-item" data-aom-editor-item="1"
               data-cie10="${esc(item.codigo_cie10||'')}"
               data-diagnostico="${esc(item.diagnostico||'')}">
    <input data-campo="orden" value="${esc(item.orden||'')}" aria-label="Examen o procedimiento ${index+1}">
    <input data-campo="cat" value="${esc(item.cat||'OTROS')}" aria-label="Categoría ${index+1}">
    <textarea data-campo="obs" aria-label="Observación ${index+1}">${esc(item.obs||'')}</textarea>
    <button type="button" class="aom-btn danger aom-editor-remove" data-aom-quitar-item="1">
      <i class="bi bi-trash"></i> Quitar ítem
    </button>
  </div>`;
}

function editarFormal(id){
  const reg=state.ordenesEmitidas.find(x=>txt(x.id_orden)===txt(id));
  if(!reg) return;

  const ctx=contexto();
  if(txt(reg.id_atencion)!==txt(ctx.id)){
    aviso('La orden solicitada no pertenece a la atención seleccionada.','err');
    return;
  }
  if(ctx.bloqueada){
    aviso('La atención está anulada, cancelada o archivada. No se permite editar la orden.','err');
    return;
  }
  if(estadoOrdenEsAnulada(reg)||estadoOrdenEsReemplazada(reg)){
    aviso('Esta versión es histórica y no puede editarse.','warn');
    return;
  }

  cerrarEditorFormal();
  state.editandoId=txt(reg.id_orden);

  const data=datosDocumentoEmitido(reg);
  const items=itemsUnicos(data.detalle_json.items||[]);
  const modal=document.createElement('div');
  modal.id='auroOrdenMedicaEditorModal';
  modal.className='aom-modal';
  modal.innerHTML=`
    <div class="aom-modal-panel" role="dialog" aria-modal="true" aria-labelledby="aomEditorTitulo">
      <div class="aom-modal-head">
        <div>
          <div id="aomEditorTitulo" class="aom-modal-title">Editar orden médica emitida</div>
          <div class="aom-meta">${esc(data.id_orden)} · v${esc(data.version)}. La corrección creará una nueva versión y conservará la anterior.</div>
        </div>
        <button type="button" class="aom-modal-close" data-aom-cerrar-editor="1" aria-label="Cerrar">×</button>
      </div>

      <div class="aom-editor-list" id="aomEditorLista">
        ${items.map(renderItemEditorFormal).join('')}
      </div>

      <div class="aom-editor-reason">
        <label><strong>Justificación obligatoria de la corrección</strong></label>
        <textarea id="aomEditorMotivo" placeholder="Ej.: Corrección del procedimiento solicitado"></textarea>
      </div>

      <div class="aom-modal-actions">
        <button type="button" class="aom-btn" data-aom-cancelar-editor="1">Cancelar</button>
        <button type="button" class="aom-primary" data-aom-guardar-editor="1">
          <i class="bi bi-save2"></i> Guardar corrección
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  modal.querySelectorAll('[data-aom-quitar-item]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const filas=modal.querySelectorAll('[data-aom-editor-item]');
      if(filas.length<=1){
        alert('La orden formal debe conservar al menos un ítem.');
        return;
      }
      btn.closest('[data-aom-editor-item]')?.remove();
    });
  });

  modal.querySelector('[data-aom-cerrar-editor]')?.addEventListener('click',cerrarEditorFormal);
  modal.querySelector('[data-aom-cancelar-editor]')?.addEventListener('click',cerrarEditorFormal);
  modal.addEventListener('click',e=>{ if(e.target===modal) cerrarEditorFormal(); });

  modal.querySelector('[data-aom-guardar-editor]')?.addEventListener('click',async()=>{
    const motivo=txt(modal.querySelector('#aomEditorMotivo')?.value);
    if(motivo.length<3){
      alert('La justificación de la corrección es obligatoria.');
      modal.querySelector('#aomEditorMotivo')?.focus();
      return;
    }

    const itemsNuevos=recogerItemsEditorFormal(modal);
    if(!itemsNuevos.length){
      alert('La orden formal debe contener al menos un ítem.');
      return;
    }

    const ctxAhora=contexto();
    if(txt(ctxAhora.id)!==txt(reg.id_atencion)){
      alert('La atención seleccionada cambió. No se guardó la corrección.');
      return;
    }

    if(!confirm('Se creará una nueva versión de esta orden y la versión anterior quedará como reemplazada. ¿Continuar?')) return;

    const dataCorreccion=datosCorreccionDesdeDocumento(reg,itemsNuevos,motivo);
    const guardarBtn=modal.querySelector('[data-aom-guardar-editor]');
    if(guardarBtn) guardarBtn.disabled=true;

    try{
      const r=await post('editarOrdenMedica',dataCorreccion);
      if(!respuestaOk(r)) throw Error(txt(r?.error||r?.mensaje||r?.message)||'No se pudo editar la orden.');
      cerrarEditorFormal();
      await cargar();
      aviso('Corrección guardada. Se creó una nueva versión y se conservó la anterior.','ok');
    }catch(e){
      if(guardarBtn) guardarBtn.disabled=false;
      aviso('No se pudo guardar la corrección: '+(e.message||e),'err');
    }
  });
}

function vistaPreviaPorId(id){
  const reg=state.ordenesEmitidas.find(x=>txt(x.id_orden)===txt(id));
  if(!reg) return;

  const ctx=contexto();
  if(txt(reg.id_atencion)!==txt(ctx.id)){
    aviso('La orden solicitada no pertenece a la atención seleccionada.','err');
    return;
  }

  imprimirDocumento(datosDocumentoEmitido(reg),false);
}

/*
  Compatibilidad antirregresiva:
  - Se conservan los nombres históricos.
  - abrir() ahora SOLO muestra vista previa y nunca modifica Plan.
  - guardarCorreccion() ya no usa el Plan; abre el editor formal controlado.
*/
function abrir(id){
  return vistaPreviaPorId(id);
}

function guardarCorreccion(){
  if(!state.editandoId){
    aviso('Seleccione una orden emitida y use Editar para iniciar una corrección.','warn');
    return;
  }
  return editarFormal(state.editandoId);
}

async function anular(id){
  const reg=state.ordenesEmitidas.find(x=>txt(x.id_orden)===txt(id));
  if(!reg) return;

  const ctx=contexto();
  if(txt(reg.id_atencion)!==txt(ctx.id)){
    aviso('La orden no pertenece a la atención seleccionada.','err');
    return;
  }
  if(ctx.bloqueada){
    aviso('La atención está anulada, cancelada o archivada. No se permite modificar la orden.','err');
    return;
  }
  if(estadoOrdenEsAnulada(reg)||estadoOrdenEsReemplazada(reg)) return;

  const motivo=solicitarJustificacion('ELIMINAR / ANULAR ORDEN MÉDICA');
  if(!motivo) return;

  if(!confirm(`La orden ${id} no se borrará físicamente. Quedará ANULADA y conservará su trazabilidad. ¿Continuar?`)) return;

  const detalle=parse(reg.detalle_json);
  const detalleActualizado=Object.assign({},detalle,{
    auditoria_anulacion:{
      motivo,
      id_orden:txt(reg.id_orden),
      version:Number(reg.version||1)||1,
      fecha_visual_ecuador:new Date().toLocaleString('es-EC',{timeZone:'America/Guayaquil',hour12:false})
    }
  });

  try{
    const r=await post('anularOrdenMedica',{
      id_orden:id,
      id_atencion:ctx.id,
      motivo_anulacion:motivo,
      detalle_json:detalleActualizado
    });
    if(!respuestaOk(r)) throw Error(txt(r?.error||r?.mensaje||r?.message)||'No se pudo anular.');
    if(state.editandoId===id) state.editandoId='';
    await cargar();
    aviso('Orden anulada. El registro histórico y la justificación se conservaron.','ok');
  }catch(e){
    aviso('No se pudo anular la orden: '+(e.message||e),'err');
  }
}

function imprimirPorId(id){
  const reg=state.ordenesEmitidas.find(x=>txt(x.id_orden)===txt(id));
  if(!reg) return;
  imprimirDocumento(datosDocumentoEmitido(reg),true);
}

function docHTML(data){
  const d=data.detalle_json||{};
  const centro=d.centro||state.configuracion||normalizarConfig(configGlobal());
  const medico=d.medico||{};
  const items=itemsUnicos(d.items||[]);
  const ciudad=txt(centro.ciudad)||'Guayaquil';
  const contacto=[centro.direccion,centro.telefono,centro.email,centro.web].map(txt).filter(Boolean).join(' · ');
  const logo=txt(centro.logo);

  return `<article class="aom-paper">
    <header class="aom-doc-head">
      <div>
        <div class="aom-doc-brand">${esc(centro.nombre||'AUROSANAX')}</div>
        <div class="aom-doc-sub">${esc(centro.subtitulo||'')}<br>${esc(centro.razon_social||'')}${centro.ruc?` · RUC ${esc(centro.ruc)}`:''}</div>
      </div>
      ${logo?`<img src="${esc(logo)}" alt="Logo" style="max-width:42mm;max-height:18mm;object-fit:contain">`:''}
    </header>

    <div class="aom-doc-title">ORDEN MÉDICA</div>

    <section class="aom-doc-grid">
      <div><span class="aom-doc-label">Paciente:</span> ${esc(data.nombre_paciente||d.paciente?.nombre||'—')}</div>
      <div><span class="aom-doc-label">Fecha:</span> ${esc(fechaVisual(data.fecha_emision||d.fecha_emision))}</div>
      <div><span class="aom-doc-label">Identificación:</span> ${esc(data.numero_documento||d.paciente?.numero_documento||'—')}</div>
      <div><span class="aom-doc-label">Historia:</span> ${esc(data.id_historia||d.historia?.id_historia||'—')}</div>
      <div><span class="aom-doc-label">Consulta:</span> ${esc(data.numero_consulta||d.numero_consulta||'—')}</div>
      <div><span class="aom-doc-label">Orden:</span> ${esc(data.id_orden||'—')}</div>
    </section>

    <table class="aom-doc-table">
      <thead><tr><th style="width:40px">#</th><th>Examen / procedimiento</th><th style="width:34mm">Categoría</th><th>Observación</th></tr></thead>
      <tbody>${items.map((o,i)=>`<tr><td>${i+1}</td><td><strong>${esc(o.orden)}</strong>${o.codigo_cie10?`<br><small>CIE-10: ${esc(o.codigo_cie10)}${o.diagnostico?` · ${esc(o.diagnostico)}`:''}</small>`:''}</td><td>${esc(o.cat||'OTROS')}</td><td>${esc(o.obs||'')}</td></tr>`).join('')}</tbody>
    </table>

    ${txt(d.observaciones_generales)?`<div style="margin-top:15px;font-size:11.5px"><strong>Observaciones:</strong><br>${esc(d.observaciones_generales)}</div>`:''}

    <section class="aom-doc-sign">
      <div class="aom-doc-line"></div>
      <strong>${esc(data.nombre_medico||medico.nombre||'Profesional tratante')}</strong><br>
      <span style="font-size:11px">${esc(data.especialidad||medico.especialidad||'')}</span>
      ${medico.registro_msp?`<br><span style="font-size:10px">Registro MSP: ${esc(medico.registro_msp)}</span>`:''}
      ${medico.registro_senescyt?`<br><span style="font-size:10px">Registro SENESCYT: ${esc(medico.registro_senescyt)}</span>`:''}
    </section>

    <footer class="aom-doc-foot">
      ${esc(ciudad)}, Ecuador${contacto?` · ${esc(contacto)}`:''}
      ${data.estado?`<br>Estado documental: ${esc(data.estado)}${data.version?` · Versión ${esc(data.version)}`:''}`:''}
    </footer>
  </article>`;
}

function estilosImpresion(){
  return `
  @page{size:A4;margin:0}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#eef2f7;font-family:Arial,sans-serif;color:#111827}
  .aom-print-toolbar{position:sticky;top:0;z-index:10;display:flex;justify-content:center;gap:8px;padding:10px;background:#fff;border-bottom:1px solid #e5e7eb}
  .aom-print-toolbar button{border:0;border-radius:10px;padding:9px 13px;font-weight:700;cursor:pointer}
  .aom-print-toolbar .primary{background:#8b1e5a;color:#fff}.aom-print-toolbar .secondary{background:#f3f4f6;color:#111827}
  .aom-view{padding:18px;overflow:auto}.aom-stage{transform-origin:top left;margin:0 auto}
  ${document.getElementById('auroOrdenMedicaCSS')?.textContent||''}
  @media print{html,body{background:#fff}.aom-print-toolbar{display:none!important}.aom-view{padding:0;overflow:visible}.aom-stage{transform:none!important;width:auto!important;height:auto!important}.aom-paper{margin:0!important}}
  `;
}

function imprimirDocumento(data,autoPrint=false){
  if(!data) return;
  const w=window.open('','_blank');
  if(!w){alert('El navegador bloqueó la ventana de impresión.');return;}
  const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Orden Médica</title><style>${estilosImpresion()}</style></head><body>
    <div class="aom-print-toolbar"><button class="primary" onclick="window.print()">Imprimir / Guardar PDF</button><button class="secondary" onclick="window.close()">Cerrar</button></div>
    <div class="aom-view" id="aomView"><div class="aom-stage" id="aomStage">${docHTML(data)}</div></div>
    <script>(function(){function fit(){var v=document.getElementById('aomView'),s=document.getElementById('aomStage'),p=s&&s.querySelector('.aom-paper');if(!v||!s||!p)return;var mm=p.getBoundingClientRect().width||794;var avail=Math.max(280,v.clientWidth-12);var scale=Math.min(1,avail/mm);s.style.width=mm+'px';s.style.transform='scale('+scale+')';s.style.height=(p.scrollHeight*scale)+'px';}window.addEventListener('load',fit);window.addEventListener('resize',fit);setTimeout(fit,50);})();<\/script>
  </body></html>`;
  w.document.open();w.document.write(html);w.document.close();
  if(autoPrint){
    w.addEventListener('load',()=>setTimeout(()=>w.print(),180),{once:true});
  }
}

async function cargar(){
  const ctx=contexto();
  state.contexto=ctx;
  state.idAtencion=ctx.id;
  state.editandoId='';

  if(!state.montado) montar();
  if(!ctx.id){
    state.ordenesEmitidas=[];
    render();
    return [];
  }

  const token=++state.token;
  try{
    await cargarAuxiliares(ctx);
    const r=await get('listarOrdenesMedicasPorAtencion',{id_atencion:ctx.id});
    if(token!==state.token) return [];
    state.ordenesEmitidas=arr(r).filter(x=>txt(x.id_atencion)===ctx.id);
    const activas=ordenesActivasFormales();
    if(activas.length>1){
      render();
      aviso(`ALERTA: existen ${activas.length} órdenes formales activas en esta atención. Se bloqueó una nueva emisión para proteger la trazabilidad.`,'err');
      return state.ordenesEmitidas;
    }
  }catch(e){
    if(token!==state.token) return [];
    state.ordenesEmitidas=[];
    render();
    aviso('El módulo está listo, pero el backend de órdenes médicas aún no respondió: '+(e.message||e),'warn');
    return [];
  }
  render();
  return state.ordenesEmitidas;
}

function refrescarEstadoLocal(){
  if(!state.montado) montar();
  render();
}

function instalarEventos(){
  if(window.__auroOrdenesMedicasEventos) return;
  window.__auroOrdenesMedicasEventos=true;

  window.addEventListener('aurosanax:plan-cargado',()=>{
    state.editandoId='';
    cargar();
  });
  window.addEventListener('aurosanax:atencion-seleccionada',cargar);
  window.addEventListener('aurosanax:atencion-cambiada',cargar);
  window.addEventListener('aurosanax:consulta-seleccionada',cargar);

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#hc_plan')){
      queueMicrotask(refrescarEstadoLocal);
    }
  });
}

async function inicializar(){
  montar();
  instalarEventos();
  await cargar();
  return true;
}

window.auroOrdenesMedicas={
  version:VERSION,
  jsonVersion:JSON_VERSION,
  estado:state,
  inicializar,
  cargar,
  refrescar:refrescarEstadoLocal,
  obtenerContexto:contexto,
  obtenerItemsPlan:()=>itemsPlanActual(),
  obtenerDatosEmision:()=>datosDocumentoDesdePlan(),
  construirDocumento:docHTML,
  imprimir:data=>imprimirDocumento(data||datosDocumentoDesdePlan(),false)
};

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>inicializar().catch(()=>{}),{once:true});
}else{
  inicializar().catch(()=>{});
}

})();
