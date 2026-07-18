/* ============================================================
   AUROSANAX CLINICAL ERP DEMO
   MÓDULO: OBSTETRICIA
   Archivo: obstetricia.js
   Versión: 1.0.1 - 2026-07-18 · corrección quirúrgica de antecedentes obstétricos
   Un registro por id_atencion. Compatible con 30 columnas.
============================================================ */
(function(){
'use strict';
const MODULO='AUROSANAX_OBSTETRICIA_V1';
const STORAGE_KEY='aurosanax_obstetricia_local_v1';
const VERSION='20260718_obstetricia_v1_0_1_antecedentes';
let registroActual=null,cargando=false,guardando=false,ultimoIdAtencion='',contextoSeleccionado=null;
const $=id=>document.getElementById(id), txt=v=>String(v??'').trim(), now=()=>new Date().toISOString();
function fechaHoy(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function horaActual(){const d=new Date();return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
function idTemporal(){return `OBS-${Date.now()}-${Math.floor(Math.random()*1000)}`}
function parseJSON(v,d={}){if(v==null||v==='')return d;if(typeof v==='object')return v;try{return JSON.parse(v)}catch(e){console.warn(MODULO,'JSON inválido',e);return d}}
function esc(v){return txt(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
function getValue(id){const e=$(id);if(!e)return '';return e.type==='checkbox'?!!e.checked:txt(e.value)}
function setValue(id,v){const e=$(id);if(!e)return;if(e.type==='checkbox')e.checked=!!v;else e.value=v==null?'':v}
function setText(id,v,x='—'){const e=$(id);if(e)e.textContent=txt(v)||x}
function usuarioActual(){try{if(typeof window.obtenerUsuarioActual==='function'){const u=window.obtenerUsuarioActual();return txt(u?.nombre||u?.nombre_completo||u?.usuario||u?.email||u)}const u=window.usuarioActualERP||window.usuarioActual||window.currentUser||{};return txt(u.nombre||u.nombre_completo||u.usuario||u.email)||'AUROSANAX ERP'}catch(_){return 'AUROSANAX ERP'}}
function leerAtenciones(){for(const k of ['aurosanax_atenciones_local_v1','aurosanax_atenciones','atenciones']){try{const a=JSON.parse(localStorage.getItem(k)||'[]');if(Array.isArray(a)&&a.length)return a}catch(_){}}return []}
function normalizarDetalle(d){if(!d||typeof d!=='object')return null;const c=d.atencion||d.data||d.registro||d;const id=txt(c?.id_atencion||c?.id||d.id_atencion||d.id);return id?{...c,id_atencion:id}:null}
function idAtencionDOM(){for(const s of ['[data-id-atencion].active','[data-id-atencion][aria-selected="true"]','[data-id-atencion].selected','#idAtencionActiva','#atencionActivaId','#hcIdAtencion','[name="id_atencion"]']){const e=document.querySelector(s);if(!e)continue;const id=txt(e.dataset?.idAtencion||e.value||e.getAttribute('data-id-atencion'));if(id)return id}return ''}
function resolverAtencion(){if(contextoSeleccionado?.id_atencion)return contextoSeleccionado;for(const o of [window.atencionActiva,window.atencionActual,window.currentAtencion,window.AURO_ATENCION_ACTIVA])if(o&&typeof o==='object'&&txt(o.id_atencion||o.id))return o;try{if(typeof window.getAtencionActiva==='function'){const a=window.getAtencionActiva();if(a&&txt(a.id_atencion||a.id))return a}}catch(_){}const id=[window.atencionActivaId,window.idAtencionActiva,window.currentAtencionId,sessionStorage.getItem('aurosanax_id_atencion_activa'),sessionStorage.getItem('aurosanax_id_atencion_seleccionada'),localStorage.getItem('aurosanax_id_atencion_activa'),localStorage.getItem('aurosanax_id_atencion_seleccionada'),localStorage.getItem('id_atencion_activa'),idAtencionDOM()].map(txt).find(Boolean)||'';if(id)return leerAtenciones().find(a=>txt(a.id_atencion||a.id)===id)||{id_atencion:id};return leerAtenciones().find(a=>['abierta','en atención','en atencion','activa'].includes(txt(a.estado_atencion||a.estado).toLowerCase()))||null}
function resolverPaciente(a){for(const o of [window.pacienteActivo,window.pacienteActual,window.currentPatient,window.selectedPatient,window.AURO_PACIENTE_ACTIVO])if(o&&typeof o==='object'&&txt(o.id_paciente||o.id))return o;try{if(typeof window.getPacienteActivo==='function'){const p=window.getPacienteActivo();if(p)return p}}catch(_){}const id=txt(a?.id_paciente||window.idPacienteActivo||window.activePatientId||sessionStorage.getItem('aurosanax_id_paciente_activo')||localStorage.getItem('aurosanax_id_paciente_activo')||localStorage.getItem('selectedPatientId'));for(const l of [window.pacientes,window.pacientesData,window.listaPacientes]){if(!Array.isArray(l))continue;const p=l.find(x=>txt(x.id_paciente||x.id)===id);if(p)return p}return id?{id_paciente:id}:null}
function resolverMedico(a){const id=txt(a?.id_medico||window.idMedicoActual||window.medicoActual?.id_medico||window.usuarioActualERP?.id_medico);let nombre=txt(a?.nombre_medico||a?.medico_nombre||window.medicoActual?.nombre_completo||window.medicoActual?.nombre);for(const l of [window.medicos,window.medicosActivos,window.listaMedicos]){if(!Array.isArray(l))continue;const m=l.find(x=>txt(x.id_medico||x.id||x.codigo)===id);if(m){nombre=nombre||txt(m.nombre_completo||`${txt(m.nombres||m.nombre)} ${txt(m.apellidos)}`.trim());break}}return{id_medico:id,nombre_medico:nombre}}
function contextoActual(){const a=resolverAtencion(),p=resolverPaciente(a),m=resolverMedico(a);return{atencion:a,paciente:p,id_atencion:txt(a?.id_atencion||a?.id),numero_consulta:a?.numero_consulta||a?.consulta||'',id_paciente:txt(a?.id_paciente||p?.id_paciente||p?.id),nombre_paciente:txt(p?.nombre_completo||`${txt(p?.nombres||p?.nombre)} ${txt(p?.apellidos)}`.trim()||a?.nombre_paciente||a?.paciente_nombre),id_historia:txt(a?.id_historia||window.idHistoriaActual||window.auroHistoriaSeleccionadaId||window.historiaActiva?.id_historia||window.historiaActual?.id_historia||window.currentHistoria?.id_historia||p?.id_historia||sessionStorage.getItem('aurosanax_id_historia_activa')||localStorage.getItem('aurosanax_id_historia_activa')),id_medico:m.id_medico,nombre_medico:m.nombre_medico,fecha_atencion:txt(a?.fecha_atencion||a?.fecha)||fechaHoy(),hora_atencion:txt(a?.hora_atencion||a?.hora)||horaActual(),tipo_atencion:txt(a?.tipo_atencion)}}
function normalizar(r={}){return{id_obstetricia:txt(r.id_obstetricia||r.id),id_atencion:txt(r.id_atencion),numero_consulta:r.numero_consulta||'',id_paciente:txt(r.id_paciente),nombre_paciente:txt(r.nombre_paciente||r.paciente_nombre),id_historia:txt(r.id_historia),id_medico:txt(r.id_medico),nombre_medico:txt(r.nombre_medico||r.medico_nombre),fecha_atencion:txt(r.fecha_atencion||r.fecha),hora_atencion:txt(r.hora_atencion||r.hora),tipo_atencion:txt(r.tipo_atencion),fum:txt(r.fum||r.fur),fpp:txt(r.fpp),edad_gestacional_semanas:txt(r.edad_gestacional_semanas),edad_gestacional_dias:txt(r.edad_gestacional_dias),peso_materno:txt(r.peso_materno),presion_arterial:txt(r.presion_arterial),altura_uterina:txt(r.altura_uterina),frecuencia_cardiaca_fetal:txt(r.frecuencia_cardiaca_fetal),riesgo_obstetrico:txt(r.riesgo_obstetrico),proximo_control:txt(r.proximo_control),embarazo_actual_json:parseJSON(r.embarazo_actual_json,{}),sintomas_obstetricos_json:parseJSON(r.sintomas_obstetricos_json,{}),evaluacion_obstetrica_json:parseJSON(r.evaluacion_obstetrica_json,{}),impresion_obstetrica:txt(r.impresion_obstetrica),observaciones:txt(r.observaciones),estado_registro:txt(r.estado_registro||r.estado||'Activo'),creado_en:r.creado_en||'',actualizado_en:r.actualizado_en||'',creado_por:txt(r.creado_por)}}
function leerLocales(){try{const a=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(a)?a.map(normalizar):[]}catch(_){return []}}
function guardarLocales(a){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(a||[]))}catch(e){console.warn(MODULO,e)}}
function actualizarLocal(r){const a=leerLocales(),i=a.findIndex(x=>(txt(r.id_obstetricia)&&txt(x.id_obstetricia)===txt(r.id_obstetricia))||(txt(r.id_atencion)&&txt(x.id_atencion)===txt(r.id_atencion)));if(i>=0)a[i]=normalizar(r);else a.push(normalizar(r));guardarLocales(a)}
async function listarRemotos(){if(typeof window.API_URL==='undefined'||!txt(window.API_URL))return[];const r=await fetch(`${window.API_URL}?accion=listarObstetricia&_=${Date.now()}`);if(!r.ok)throw new Error(`HTTP ${r.status}`);const d=await r.json();return Array.isArray(d)?d:(Array.isArray(d?.data)?d.data:[])}
async function enviarRemoto(r,editar){if(typeof window.API_URL==='undefined'||!txt(window.API_URL))throw new Error('API_URL no está definida');await fetch(window.API_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({accion:editar?'editarObstetricia':'guardarObstetricia',data:r})})}
function notificar(m,t='success'){if(typeof window.mostrarToast==='function')return window.mostrarToast(m,t);if(typeof window.showToast==='function')return window.showToast(m,t);const b=$('obsEstadoModulo');if(!b)return;b.className=`obs-status ${t}`;b.textContent=m;b.style.display='block';clearTimeout(b._timer);b._timer=setTimeout(()=>b.style.display='none',4500)}
function check(id,l){return `<label class="obs-check"><input id="${id}" type="checkbox"><span>${esc(l)}</span></label>`}
function estilos(){if($('auroObstetriciaCSS'))return;const s=document.createElement('style');s.id='auroObstetriciaCSS';s.textContent=`#obstetricia .obs-shell{display:grid;gap:16px}#obstetricia .obs-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:14px;border-bottom:1px solid #e5e7eb}#obstetricia .obs-head h4{margin:0;font-weight:900}#obstetricia .obs-head p{margin:4px 0 0;color:#6b7280}#obstetricia .obs-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}#obstetricia .obs-actions-block{display:grid;gap:7px;justify-items:end}#obstetricia .obs-context{border:1px solid #fbcfe8;background:linear-gradient(135deg,#fff7fb,#fff);border-radius:20px;padding:14px}#obstetricia .obs-context-grid,#obstetricia .obs-read-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}#obstetricia .obs-context-item{border:1px solid #e5e7eb;background:#fff;border-radius:14px;padding:10px;min-width:0}#obstetricia .obs-context-item small{display:block;color:#6b7280;text-transform:uppercase;font-size:10px;font-weight:850}#obstetricia .obs-context-item b{font-size:13px;word-break:break-word}#obstetricia .obs-panel{border:1px solid #e5e7eb;border-radius:20px;padding:16px;background:#fff}#obstetricia .obs-panel-title{font-weight:900;margin-bottom:12px;display:flex;align-items:center;gap:8px}#obstetricia .obs-panel-title i{color:#8b1e5a}#obstetricia .obs-read{border:1px dashed #cbd5e1;background:#f8fafc;border-radius:14px;padding:10px}#obstetricia .obs-read small{display:block;color:#64748b;font-weight:800;font-size:11px}#obstetricia .obs-read b{font-size:13px}#obstetricia .obs-check-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}#obstetricia .obs-check{border:1px solid #e5e7eb;border-radius:14px;padding:9px 10px;display:flex;align-items:center;gap:8px;background:#fff}#obstetricia .obs-check input{width:17px;height:17px;accent-color:#8b1e5a}#obstetricia .obs-status{display:none;border-radius:14px;padding:11px 12px;font-weight:700}#obstetricia .obs-status.success{background:#dcfce7;color:#166534}#obstetricia .obs-status.error{background:#fee2e2;color:#991b1b}#obstetricia .obs-status.info{background:#dbeafe;color:#1e40af}#obstetricia .obs-alert{display:none;border-radius:14px;padding:11px 12px;background:#fff7ed;color:#9a3412}#obstetricia .obs-alert.show{display:block}#obstetricia .obs-record-state{font-size:12px;color:#475569;font-weight:750;text-align:right}#obstetricia .obs-footer{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}#obstetricia .obs-footer-actions{display:flex;gap:8px;flex-wrap:wrap}@media(max-width:760px){#obstetricia .obs-head{display:block}#obstetricia .obs-actions-block{justify-items:start;margin-top:12px}#obstetricia .obs-context-grid,#obstetricia .obs-read-grid{grid-template-columns:1fr}#obstetricia .obs-check-grid{grid-template-columns:repeat(2,1fr)}#obstetricia .obs-record-state{text-align:left}}`;document.head.appendChild(s)}
function renderizar(){const sec=$('obstetricia');if(!sec){console.warn(MODULO,'No existe #obstetricia');return false}estilos();sec.innerHTML=`<div class="cardx p-4 obs-shell"><div class="obs-head"><div><h4><i class="bi bi-heart-pulse me-2"></i>Obstetricia</h4><p>Registro por atención. Diagnóstico, Plan y documentos se gestionan aparte.</p></div><div class="obs-actions-block"><div class="obs-actions"><button type="button" class="btn-soft" id="obsBtnRecargar"><i class="bi bi-arrow-clockwise me-1"></i>Recargar</button><button type="button" class="btn-auro" id="obsBtnGuardar"><i class="bi bi-save me-1"></i>Guardar Obstetricia</button></div><div id="obsEstadoRegistroSuperior" class="obs-record-state">Consulta — · Sin registro de Obstetricia</div></div></div><div class="module-patient-card" data-module-patient="Obstetricia"></div><div id="obsAlertaAtencion" class="obs-alert"><i class="bi bi-exclamation-triangle me-1"></i>Debe seleccionar paciente e iniciar una atención.</div><div class="obs-context"><div class="obs-context-grid"><div class="obs-context-item"><small>Paciente</small><b id="obsCtxPaciente">—</b></div><div class="obs-context-item"><small>Atención</small><b id="obsCtxAtencion">—</b></div><div class="obs-context-item"><small>Consulta</small><b id="obsCtxConsulta">—</b></div><div class="obs-context-item"><small>Médico</small><b id="obsCtxMedico">—</b></div></div></div><div id="obsEstadoModulo" class="obs-status"></div>
<div class="obs-panel"><div class="obs-panel-title"><i class="bi bi-clock-history"></i>Antecedentes obstétricos — solo lectura</div><div class="obs-read-grid"><div class="obs-read"><small>Gestas</small><b id="obsAntGestas">—</b></div><div class="obs-read"><small>Partos</small><b id="obsAntPartos">—</b></div><div class="obs-read"><small>Cesáreas</small><b id="obsAntCesareas">—</b></div><div class="obs-read"><small>Abortos</small><b id="obsAntAbortos">—</b></div><div class="obs-read"><small>Ectópicos</small><b id="obsAntEctopicos">—</b></div><div class="obs-read"><small>Mortinatos</small><b id="obsAntMortinatos">—</b></div><div class="obs-read"><small>Hijos vivos</small><b id="obsAntVivos">—</b></div><div class="obs-read"><small>Complicaciones</small><b id="obsAntComplicaciones">—</b></div></div></div>
<div class="obs-panel"><div class="obs-panel-title"><i class="bi bi-calendar-heart"></i>Embarazo actual</div><div class="row g-3"><div class="col-md-3"><label class="form-label fw-bold">FUM</label><input id="obsFum" type="date" class="form-control"></div><div class="col-md-3"><label class="form-label fw-bold">FPP</label><input id="obsFpp" type="date" class="form-control"></div><div class="col-md-2"><label class="form-label fw-bold">EG semanas</label><input id="obsEgSemanas" type="number" min="0" max="45" class="form-control"></div><div class="col-md-2"><label class="form-label fw-bold">EG días</label><input id="obsEgDias" type="number" min="0" max="6" class="form-control"></div><div class="col-md-2"><label class="form-label fw-bold">Tipo atención</label><select id="obsTipoAtencion" class="form-select"><option value="">Seleccionar</option><option>Primera consulta</option><option>Control prenatal</option><option>Urgencia obstétrica</option><option>Seguimiento</option><option>Teleconsulta</option></select></div><div class="col-md-3"><label class="form-label fw-bold">Peso materno (kg)</label><input id="obsPesoMaterno" type="number" step="0.1" class="form-control"></div><div class="col-md-3"><label class="form-label fw-bold">Presión arterial</label><input id="obsPresionArterial" placeholder="110/70" class="form-control"></div><div class="col-md-3"><label class="form-label fw-bold">Altura uterina (cm)</label><input id="obsAlturaUterina" type="number" step="0.1" class="form-control"></div><div class="col-md-3"><label class="form-label fw-bold">FCF (lpm)</label><input id="obsFcf" type="number" class="form-control"></div><div class="col-md-3"><label class="form-label fw-bold">Embarazo</label><select id="obsTipoEmbarazo" class="form-select"><option value="">No registrado</option><option>Único</option><option>Múltiple</option></select></div><div class="col-md-2"><label class="form-label fw-bold">Número de fetos</label><input id="obsNumeroFetos" type="number" min="1" class="form-control"></div><div class="col-md-3"><label class="form-label fw-bold">Situación fetal</label><select id="obsSituacionFetal" class="form-select"><option value="">No registrada</option><option>Longitudinal</option><option>Transversa</option><option>Oblicua</option></select></div><div class="col-md-2"><label class="form-label fw-bold">Presentación</label><select id="obsPresentacionFetal" class="form-select"><option value="">No registrada</option><option>Cefálica</option><option>Podálica</option><option>Hombro</option></select></div><div class="col-md-2"><label class="form-label fw-bold">Posición fetal</label><input id="obsPosicionFetal" class="form-control"></div></div></div>
<div class="obs-panel"><div class="obs-panel-title"><i class="bi bi-activity"></i>Síntomas obstétricos</div><div class="obs-check-grid mb-3">${check('obsSintSangrado','Sangrado vaginal')}${check('obsSintPerdidaLiquido','Pérdida de líquido')}${check('obsSintDolorPelvico','Dolor pélvico')}${check('obsSintContracciones','Contracciones')}${check('obsSintCefalea','Cefalea')}${check('obsSintFosfenos','Fosfenos')}${check('obsSintTinnitus','Tinnitus')}${check('obsSintEpigastralgia','Epigastralgia')}${check('obsSintDisuria','Disuria')}</div><div class="row g-3"><div class="col-md-6"><label class="form-label fw-bold">Otros síntomas</label><input id="obsSintOtros" class="form-control"></div><div class="col-md-6"><label class="form-label fw-bold">Descripción y evolución</label><textarea id="obsSintDescripcion" rows="2" class="form-control"></textarea></div></div></div>
<div class="obs-panel"><div class="obs-panel-title"><i class="bi bi-clipboard2-pulse"></i>Evaluación obstétrica</div><div class="row g-3"><div class="col-md-3"><label class="form-label fw-bold">Movimientos fetales</label><select id="obsMovimientosFetales" class="form-select"><option value="">No registrado</option><option>Presentes</option><option>Disminuidos</option><option>Ausentes</option><option>No aplica</option></select></div><div class="col-md-3"><label class="form-label fw-bold">Actividad uterina</label><select id="obsActividadUterina" class="form-select"><option value="">No registrada</option><option>Ausente</option><option>Irregular</option><option>Regular</option></select></div><div class="col-md-3"><label class="form-label fw-bold">Edema</label><select id="obsEdema" class="form-select"><option value="">No registrado</option><option>Ausente</option><option>Leve</option><option>Moderado</option><option>Severo</option></select></div><div class="col-md-3"><label class="form-label fw-bold">Membranas</label><select id="obsEstadoMembranas" class="form-select"><option value="">No registrado</option><option>Íntegras</option><option>Rotas</option><option>No evaluado</option></select></div><div class="col-md-12"><label class="form-label fw-bold">Hallazgos relevantes</label><textarea id="obsHallazgos" rows="3" class="form-control"></textarea></div></div></div>
<div class="obs-panel"><div class="obs-panel-title"><i class="bi bi-shield-check"></i>Clasificación y seguimiento</div><div class="row g-3"><div class="col-md-4"><label class="form-label fw-bold">Riesgo obstétrico</label><select id="obsRiesgoObstetrico" class="form-select"><option value="">No clasificado</option><option>Bajo</option><option>Moderado</option><option>Alto</option><option>Muy alto</option></select></div><div class="col-md-4"><label class="form-label fw-bold">Próximo control</label><input id="obsProximoControl" type="date" class="form-control"></div><div class="col-md-12"><label class="form-label fw-bold">Impresión obstétrica</label><textarea id="obsImpresion" rows="3" class="form-control" placeholder="El CIE-10 se registra en Diagnósticos."></textarea></div><div class="col-md-12"><label class="form-label fw-bold">Observaciones</label><textarea id="obsObservaciones" rows="3" class="form-control"></textarea></div></div></div><div class="obs-footer"><div id="obsEstadoRegistroInferior" class="obs-record-state">Consulta — · Sin registro de Obstetricia</div><div class="obs-footer-actions"><button type="button" class="btn-soft" id="obsBtnRecargarInferior"><i class="bi bi-arrow-clockwise me-1"></i>Recargar</button><button type="button" class="btn-auro" id="obsBtnGuardarInferior"><i class="bi bi-save me-1"></i>Guardar Obstetricia</button></div></div></div>`;$('obsBtnGuardar')?.addEventListener('click',guardar);$('obsBtnGuardarInferior')?.addEventListener('click',guardar);const rec=()=>{if(confirm('¿Restablecer la información guardada de esta consulta?'))cargar(true)};$('obsBtnRecargar')?.addEventListener('click',rec);$('obsBtnRecargarInferior')?.addEventListener('click',rec);$('obsFum')?.addEventListener('change',calcularFum);actualizarEstado();return true}
function calcularFum(){const v=getValue('obsFum');if(!v)return;const f=new Date(`${v}T12:00:00`);if(Number.isNaN(f.getTime()))return;const p=new Date(f);p.setDate(p.getDate()+280);setValue('obsFpp',p.toISOString().slice(0,10));const h=new Date();h.setHours(12,0,0,0);const d=Math.floor((h-f)/86400000);if(d>=0&&d<=315){setValue('obsEgSemanas',Math.floor(d/7));setValue('obsEgDias',d%7)}}
function historiaLocal(c){const hs=[window.historiaActiva,window.historiaActual,window.currentHistoria,window.AURO_HISTORIA_ACTIVA].filter(Boolean);for(const h of hs)if((c.id_historia&&txt(h.id_historia||h.id)===c.id_historia)||(!c.id_historia&&c.id_paciente&&txt(h.id_paciente)===c.id_paciente))return h;for(const l of [window.historiasClinicas,window.historias,window.listaHistoriasClinicas,window.historiasData]){if(!Array.isArray(l))continue;const h=l.find(x=>(c.id_historia&&txt(x.id_historia||x.id)===c.id_historia)||(!c.id_historia&&c.id_paciente&&txt(x.id_paciente)===c.id_paciente));if(h)return h}return null}
const ANT_GINECO_OBS_MARKER='AUROSANAX_ANT_GINECO_OBS_V1::';

function fechaHistoriaAntecedentes(h){
  const raw=h?.actualizado_en||h?.fecha_registro||h?.fecha_apertura||h?.creado_en||h?.fecha||'';
  const n=raw?new Date(raw).getTime():0;
  return Number.isFinite(n)?n:0
}

function historiaTieneAntecedentesObstetricos(h){
  return !!txt(
    h?.antecedentes_gineco_obstetricos_json||
    h?.antecedentes_obstetricos_json||
    h?.antecedentes_gineco_obstetricos||
    h?.antecedentes_obstetricos
  )
}

function buscarHistoriaAntecedentes(lista,c){
  if(!Array.isArray(lista)||!lista.length)return null;
  const idHistoria=txt(c?.id_historia),idPaciente=txt(c?.id_paciente);

  if(idHistoria){
    const exacta=lista.find(h=>txt(h?.id_historia||h?.id)===idHistoria);
    if(exacta)return exacta
  }

  if(!idPaciente)return null;

  return lista
    .filter(h=>txt(h?.id_paciente)===idPaciente)
    .sort((a,b)=>{
      const conDatos=Number(historiaTieneAntecedentesObstetricos(b))-Number(historiaTieneAntecedentesObstetricos(a));
      return conDatos||fechaHistoriaAntecedentes(b)-fechaHistoriaAntecedentes(a)
    })[0]||null
}

function leerHistoriasAntecedentesLocales(){
  const salida=[];
  for(const k of [
    'aurosanax_historias_clinicas_local_v1',
    'aurosanax_historias_clinicas',
    'historias_clinicas',
    'historiasClinicas'
  ]){
    try{
      const v=JSON.parse(localStorage.getItem(k)||'[]');
      if(Array.isArray(v))salida.push(...v);
      else if(Array.isArray(v?.data))salida.push(...v.data)
    }catch(_){}
  }
  return salida
}

async function resolverHistoriaAntecedentes(c){
  const globales=[
    window.historiaActiva,
    window.historiaActual,
    window.currentHistoria,
    window.AURO_HISTORIA_ACTIVA
  ].filter(h=>h&&typeof h==='object');

  let h=buscarHistoriaAntecedentes(globales,c);
  if(h)return h;

  const listas=[
    window.historiasClinicas,
    window.historias,
    window.listaHistoriasClinicas,
    window.historiasData
  ];

  try{
    if(typeof historiasClinicas!=='undefined'&&Array.isArray(historiasClinicas)){
      listas.push(historiasClinicas)
    }
  }catch(_){}

  for(const lista of listas){
    h=buscarHistoriaAntecedentes(lista,c);
    if(h)break
  }

  if(!h)h=buscarHistoriaAntecedentes(leerHistoriasAntecedentesLocales(),c);

  if(!h&&typeof window.API_URL!=='undefined'&&txt(window.API_URL)){
    try{
      const r=await fetch(`${window.API_URL}?accion=listarHistoriasClinicas&_=${Date.now()}`);
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const d=await r.json();
      const remotas=Array.isArray(d)?d:(Array.isArray(d?.data)?d.data:[]);
      h=buscarHistoriaAntecedentes(remotas,c);
      if(remotas.length)window.historiasClinicas=remotas
    }catch(e){
      console.warn(MODULO,'No se pudo consultar la historia para antecedentes obstétricos.',e)
    }
  }

  if(h){
    window.historiaActiva=h;
    window.historiaActual=h;
    window.currentHistoria=h;
    const id=txt(h.id_historia||h.id);
    if(id){
      window.idHistoriaActual=id;
      try{sessionStorage.setItem('aurosanax_id_historia_activa',id)}catch(_){}
    }
  }

  return h||{}
}

function parsearAntecedentesGinecoObstetricos(v){
  if(!v)return {};
  if(typeof v==='object')return v;

  const s=txt(v);
  if(!s)return {};

  if(s.startsWith(ANT_GINECO_OBS_MARKER)){
    return parseJSON(s.substring(ANT_GINECO_OBS_MARKER.length),{})
  }

  const directo=parseJSON(s,null);
  if(directo&&typeof directo==='object')return directo;

  const i=s.indexOf('{'),f=s.lastIndexOf('}');
  if(i>=0&&f>i)return parseJSON(s.substring(i,f+1),{});

  return {}
}

function valorAntecedenteObstetrico(v){
  if(v==null)return '';
  if(typeof v!=='object')return txt(v);
  return txt(
    v.detalle??
    v.valor??
    v.resultado??
    v.descripcion??
    v.observacion??
    v.observaciones??
    v.texto
  )
}

function obstetricoPorClave(lista,claves){
  if(!Array.isArray(lista))return {};
  const permitidas=claves.map(x=>txt(x).toLowerCase());
  return lista.find(item=>{
    const k=txt(item?.key||item?.clave||item?.nombre).toLowerCase();
    return permitidas.includes(k)
  })||{}
}

function antecedentesObstetricosDesdeHistoria(h){
  h=h||{};
  const raw=
    h.antecedentes_gineco_obstetricos_json||
    h.antecedentes_obstetricos_json||
    h.antecedentes_gineco_obstetricos||
    h.antecedentes_obstetricos||
    {};

  const data=parsearAntecedentesGinecoObstetricos(raw);
  const oObjeto=(!Array.isArray(data.obstetricos)&&(data.obstetricos||data.obstetricia))||
    (!Array.isArray(data.obstetricia)&&data.obstetricia)||
    {};
  const oLista=Array.isArray(data.obstetricos)
    ?data.obstetricos
    :(Array.isArray(data.obstetricia)?data.obstetricia:[]);

  const porClave=(...claves)=>valorAntecedenteObstetrico(obstetricoPorClave(oLista,claves));
  const leer=(...valores)=>{
    for(const v of valores){
      const r=valorAntecedenteObstetrico(v);
      if(r)return r
    }
    return ''
  };

  return{
    gestas:leer(oObjeto.gestas,oObjeto.gesta,oObjeto.Gesta,porClave('Gesta','Gestas'),h.gestas,h.gesta),
    partos:leer(oObjeto.partos,oObjeto.parto,oObjeto.Partos,porClave('Partos','Parto'),h.partos),
    cesareas:leer(oObjeto.cesareas,oObjeto.cesáreas,oObjeto.cesarea,oObjeto.Cesareas,porClave('Cesareas','Cesáreas','Cesarea','Cesárea'),h.cesareas),
    abortos:leer(oObjeto.abortos,oObjeto.aborto,oObjeto.Abortos,porClave('Abortos','Aborto'),h.abortos),
    ectopicos:leer(oObjeto.ectopicos,oObjeto.ectópicos,oObjeto.Ectopicos,porClave('Ectopicos','Ectópicos','Ectopico','Ectópico'),h.ectopicos),
    mortinatos:leer(
      oObjeto.mortinatos,oObjeto.hijos_muertos,oObjeto.hijosMuertos,oObjeto.HijosMuertos,
      porClave('Mortinatos','Mortinato','HijosMuertos','Hijos muertos'),h.mortinatos,h.hijos_muertos
    ),
    vivos:leer(
      oObjeto.hijos_vivos,oObjeto.hijosVivos,oObjeto.vivos,oObjeto.HijosVivos,
      porClave('HijosVivos','Hijos vivos','Vivos'),h.hijos_vivos
    ),
    complicaciones:leer(
      oObjeto.complicaciones_previas,oObjeto.complicaciones,oObjeto.otros,oObjeto.Otros,
      porClave('Complicaciones','ComplicacionesPrevias','Otros'),h.complicaciones_obstetricas
    )
  }
}

async function cargarAntecedentes(c){
  const h=await resolverHistoriaAntecedentes(c||contextoActual());
  const a=antecedentesObstetricosDesdeHistoria(h);

  setText('obsAntGestas',a.gestas);
  setText('obsAntPartos',a.partos);
  setText('obsAntCesareas',a.cesareas);
  setText('obsAntAbortos',a.abortos);
  setText('obsAntEctopicos',a.ectopicos);
  setText('obsAntMortinatos',a.mortinatos);
  setText('obsAntVivos',a.vivos);
  setText('obsAntComplicaciones',a.complicaciones)
}
function pintarContexto(c){setText('obsCtxPaciente',c.nombre_paciente||c.id_paciente);setText('obsCtxAtencion',c.id_atencion);setText('obsCtxConsulta',c.numero_consulta?`N.º ${c.numero_consulta}`:'');setText('obsCtxMedico',c.nombre_medico||c.id_medico);$('obsAlertaAtencion')?.classList.toggle('show',!c.id_atencion||!c.id_paciente)}
function fechaHora(v){if(!v)return'—';const f=new Date(v);return Number.isNaN(f.getTime())?txt(v):f.toLocaleString('es-EC',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})}
function actualizarEstado(){const c=contextoActual(),existe=!!txt(registroActual?.id_obstetricia),texto=existe?'Actualizar Obstetricia':'Guardar Obstetricia',ico=existe?'bi-arrow-repeat':'bi-save';[$('obsBtnGuardar'),$('obsBtnGuardarInferior')].filter(Boolean).forEach(b=>{if(!guardando)b.innerHTML=`<i class="bi ${ico} me-1"></i>${texto}`});const q=c.numero_consulta?`Consulta N.º ${c.numero_consulta}`:'Consulta —',u=registroActual?.actualizado_en||registroActual?.creado_en||'',html=existe?`<strong>${esc(q)}</strong> · Obstetricia guardada<br>Última actualización: ${esc(fechaHora(u))}`:`<strong>${esc(q)}</strong> · Sin registro de Obstetricia`;[$('obsEstadoRegistroSuperior'),$('obsEstadoRegistroInferior')].filter(Boolean).forEach(e=>e.innerHTML=html)}
function embarazo(){return{embarazo_multiple:getValue('obsTipoEmbarazo')==='Múltiple',tipo_embarazo:getValue('obsTipoEmbarazo'),numero_fetos:getValue('obsNumeroFetos'),situacion_fetal:getValue('obsSituacionFetal'),presentacion_fetal:getValue('obsPresentacionFetal'),posicion_fetal:getValue('obsPosicionFetal')}}
function sintomas(){return{sangrado_vaginal:getValue('obsSintSangrado'),perdida_liquido:getValue('obsSintPerdidaLiquido'),dolor_pelvico:getValue('obsSintDolorPelvico'),contracciones:getValue('obsSintContracciones'),cefalea:getValue('obsSintCefalea'),fosfenos:getValue('obsSintFosfenos'),tinnitus:getValue('obsSintTinnitus'),epigastralgia:getValue('obsSintEpigastralgia'),disuria:getValue('obsSintDisuria'),otros:getValue('obsSintOtros'),descripcion:getValue('obsSintDescripcion')}}
function evaluacion(){return{movimientos_fetales:getValue('obsMovimientosFetales'),actividad_uterina:getValue('obsActividadUterina'),edema:getValue('obsEdema'),estado_membranas:getValue('obsEstadoMembranas'),hallazgos_relevantes:getValue('obsHallazgos')}}
function construir(){const c=contextoActual(),e=registroActual||{};return{id_obstetricia:txt(e.id_obstetricia)||idTemporal(),id_atencion:c.id_atencion,numero_consulta:c.numero_consulta,id_paciente:c.id_paciente,nombre_paciente:c.nombre_paciente,id_historia:c.id_historia,id_medico:c.id_medico,nombre_medico:c.nombre_medico,fecha_atencion:c.fecha_atencion,hora_atencion:c.hora_atencion,tipo_atencion:getValue('obsTipoAtencion')||c.tipo_atencion,fum:getValue('obsFum'),fpp:getValue('obsFpp'),edad_gestacional_semanas:getValue('obsEgSemanas'),edad_gestacional_dias:getValue('obsEgDias'),peso_materno:getValue('obsPesoMaterno'),presion_arterial:getValue('obsPresionArterial'),altura_uterina:getValue('obsAlturaUterina'),frecuencia_cardiaca_fetal:getValue('obsFcf'),riesgo_obstetrico:getValue('obsRiesgoObstetrico'),proximo_control:getValue('obsProximoControl'),embarazo_actual_json:JSON.stringify(embarazo()),sintomas_obstetricos_json:JSON.stringify(sintomas()),evaluacion_obstetrica_json:JSON.stringify(evaluacion()),impresion_obstetrica:getValue('obsImpresion'),observaciones:getValue('obsObservaciones'),estado_registro:txt(e.estado_registro)||'Activo',creado_en:e.creado_en||now(),actualizado_en:now(),creado_por:txt(e.creado_por)||usuarioActual()}}
function limpiar(){registroActual=null;['obsFum','obsFpp','obsEgSemanas','obsEgDias','obsPesoMaterno','obsPresionArterial','obsAlturaUterina','obsFcf','obsTipoEmbarazo','obsNumeroFetos','obsSituacionFetal','obsPresentacionFetal','obsPosicionFetal','obsSintOtros','obsSintDescripcion','obsMovimientosFetales','obsActividadUterina','obsEdema','obsEstadoMembranas','obsHallazgos','obsRiesgoObstetrico','obsProximoControl','obsImpresion','obsObservaciones'].forEach(id=>setValue(id,''));['obsSintSangrado','obsSintPerdidaLiquido','obsSintDolorPelvico','obsSintContracciones','obsSintCefalea','obsSintFosfenos','obsSintTinnitus','obsSintEpigastralgia','obsSintDisuria'].forEach(id=>setValue(id,false));setValue('obsTipoAtencion',contextoActual().tipo_atencion||'');actualizarEstado()}
function cargarRegistro(x){const r=normalizar(x);registroActual=r;setValue('obsTipoAtencion',r.tipo_atencion);setValue('obsFum',r.fum);setValue('obsFpp',r.fpp);setValue('obsEgSemanas',r.edad_gestacional_semanas);setValue('obsEgDias',r.edad_gestacional_dias);setValue('obsPesoMaterno',r.peso_materno);setValue('obsPresionArterial',r.presion_arterial);setValue('obsAlturaUterina',r.altura_uterina);setValue('obsFcf',r.frecuencia_cardiaca_fetal);setValue('obsRiesgoObstetrico',r.riesgo_obstetrico);setValue('obsProximoControl',r.proximo_control);const e=r.embarazo_actual_json||{};setValue('obsTipoEmbarazo',e.tipo_embarazo||(e.embarazo_multiple?'Múltiple':''));setValue('obsNumeroFetos',e.numero_fetos);setValue('obsSituacionFetal',e.situacion_fetal);setValue('obsPresentacionFetal',e.presentacion_fetal);setValue('obsPosicionFetal',e.posicion_fetal);const s=r.sintomas_obstetricos_json||{};for(const [id,k] of [['obsSintSangrado','sangrado_vaginal'],['obsSintPerdidaLiquido','perdida_liquido'],['obsSintDolorPelvico','dolor_pelvico'],['obsSintContracciones','contracciones'],['obsSintCefalea','cefalea'],['obsSintFosfenos','fosfenos'],['obsSintTinnitus','tinnitus'],['obsSintEpigastralgia','epigastralgia'],['obsSintDisuria','disuria']])setValue(id,s[k]);setValue('obsSintOtros',s.otros);setValue('obsSintDescripcion',s.descripcion);const v=r.evaluacion_obstetrica_json||{};setValue('obsMovimientosFetales',v.movimientos_fetales);setValue('obsActividadUterina',v.actividad_uterina);setValue('obsEdema',v.edema);setValue('obsEstadoMembranas',v.estado_membranas);setValue('obsHallazgos',v.hallazgos_relevantes);setValue('obsImpresion',r.impresion_obstetrica);setValue('obsObservaciones',r.observaciones);actualizarEstado()}
async function guardar(){if(guardando)return;const r=construir(),err=[];if(!r.id_atencion)err.push('No existe atención activa.');if(!r.id_paciente)err.push('No existe paciente seleccionada.');if(err.length)return notificar(err.join(' '),'error');guardando=true;const bs=[$('obsBtnGuardar'),$('obsBtnGuardarInferior')].filter(Boolean);bs.forEach(b=>{b.disabled=true;b.innerHTML='<span class="spinner-border spinner-border-sm me-1"></span>Guardando...'});try{const editar=!!txt(registroActual?.id_obstetricia);actualizarLocal(r);await enviarRemoto(r,editar);registroActual=normalizar(r);actualizarEstado();notificar(editar?'Obstetricia actualizada correctamente.':'Obstetricia guardada correctamente.','success')}catch(e){console.error(MODULO,e);notificar(`Guardado local. Falló sincronización: ${e.message}`,'error')}finally{guardando=false;bs.forEach(b=>b.disabled=false);actualizarEstado()}}
async function cargar(forzar=false){if(cargando)return;cargando=true;try{const c=contextoActual();pintarContexto(c);await cargarAntecedentes(c);if(!c.id_atencion||!c.id_paciente){limpiar();ultimoIdAtencion='';return}if(!forzar&&ultimoIdAtencion===c.id_atencion&&registroActual)return;ultimoIdAtencion=c.id_atencion;let lista=[];try{const rem=(await listarRemotos()).map(normalizar),m=new Map();leerLocales().forEach(r=>m.set(txt(r.id_obstetricia)||`ATN:${txt(r.id_atencion)}`,r));rem.forEach(r=>m.set(txt(r.id_obstetricia)||`ATN:${txt(r.id_atencion)}`,r));lista=Array.from(m.values());guardarLocales(lista)}catch(e){console.warn(MODULO,'Respaldo local',e);lista=leerLocales()}const e=lista.filter(r=>txt(r.id_atencion)===c.id_atencion).sort((a,b)=>txt(b.actualizado_en||b.creado_en).localeCompare(txt(a.actualizado_en||a.creado_en)));if(e[0]){cargarRegistro(e[0]);notificar('Registro obstétrico cargado.','info')}else{limpiar();setValue('obsTipoAtencion',c.tipo_atencion)}}finally{cargando=false}}
function interceptar(){const o=window.showScreen;if(typeof o!=='function'||o.__obsInterceptado)return;function w(id){const r=o.apply(this,arguments);if(id==='obstetricia')setTimeout(()=>cargar(true),60);return r}w.__obsInterceptado=true;window.showScreen=w}
function evento(ev){const d=normalizarDetalle(ev?.detail);if(d){contextoSeleccionado=d;try{sessionStorage.setItem('aurosanax_id_atencion_seleccionada',d.id_atencion)}catch(_){}}ultimoIdAtencion='';limpiar();setTimeout(()=>cargar(true),80)}
function inicializar(){if(!renderizar())return;interceptar();['aurosanax:atencion-activa','aurosanax:atencion-seleccionada','aurosanax:atencion-iniciada','aurosanax:paciente-seleccionado','aurosanax:historia-cargada'].forEach(n=>window.addEventListener(n,evento));setInterval(()=>{const a=resolverAtencion(),id=txt(a?.id_atencion||a?.id);if(id!==ultimoIdAtencion){contextoSeleccionado=a||contextoSeleccionado;cargar(true)}},1500);cargar(true);console.info(`${MODULO} cargado. ${VERSION}`)}
window.AurosanaxObstetricia={version:VERSION,inicializar,cargar,guardar,limpiar,obtenerRegistroActual:()=>registroActual?{...registroActual}:null,obtenerContexto:contextoActual};window.inicializarObstetricia=inicializar;window.cargarObstetriciaPorAtencion=cargar;window.guardarObstetriciaERP=guardar;window.limpiarObstetriciaERP=limpiar;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inicializar);else inicializar();
})();
