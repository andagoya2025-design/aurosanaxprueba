    /* ============================================================
     AUROSANAX — ESTÉTICA FUNCIONAL V2.4.1
     ARCHIVO PROPIETARIO: estetica.js
     MODULARIZACIÓN ANTIRREGRESIVA
     ------------------------------------------------------------
     - Conserva endpoints: listarEstetica / guardarEstetica / editarEstetica.
     - Conserva tabla: estetica_funcional.
     - Conserva AUROSANAX_ESTETICA_V1::{JSON}.
     - NO crea columnas ni modifica backend/Sheets/Drive/Historia.
     - id_atencion se persiste en registros nuevos y gobierna la resolución exacta.
     - Cero POST sin cambios reales.
     - Relectura autoritativa después de guardar.
     - Guard A→B contra respuestas tardías.
     - Anti doble carga/guardado.
    ============================================================ */
    (function auroEsteticaV23(){
    'use strict';

    const VERSION='2.4.1-ux-editor-ampliado';
    const PREFIJO='AUROSANAX_ESTETICA_V1::';

    if(window.__auroEsteticaV241Instalada){
      console.warn('AUROSANAX ESTÉTICA V2.4.1: segunda instalación omitida.');
      return;
    }
    window.__auroEsteticaV241Instalada=true;

    const CAMPOS=Object.freeze({
     area:'hcEsteticaArea',
     procedimiento:'hcEsteticaProcedimiento',
     sesion:'hcEsteticaSesion',
     consentimiento:'hcEsteticaConsentimiento',
     facial:'hcEsteticaEvalFacial',
     corporal:'hcEsteticaEvalCorporal',
     intima:'hcEsteticaEvalIntima',
     evolucion:'hcEsteticaEvolucion'
    });

    const estado={
     version:VERSION,id_estetica:'',id_historia:'',id_paciente:'',
     id_atencion:'',fecha_atencion:'',registro:null,firma_baseline:'',
     dirty:false,cargado:false,loading:false,saving:false,
     loadSeq:0,saveSeq:0,epoch:0,ultimoError:''
    };
    window.auroEsteticaState=estado;

    function texto(v){return String(v==null?'':v).trim();}
    function valor(id){return texto(document.getElementById(id)?.value||'');}
    function setValor(id,v){const e=document.getElementById(id);if(e)e.value=v==null?'':String(v);}
    function api(){
     const u=texto(window.API_URL||(typeof API_URL!=='undefined'?API_URL:''));
     if(!u)throw new Error('API_URL no disponible.');
     return u;
    }
    function contexto(){
     let a=null;
     try{if(typeof window.getAtencionActiva==='function')a=window.getAtencionActiva()||null;}catch(e){}
     let ia=texto(a?.id_atencion||'');
     try{if(!ia&&typeof window.getIdAtencionActiva==='function')ia=texto(window.getIdAtencionActiva());}catch(e){}
     let ih=texto(window.auroHistoriaSeleccionadaId||a?.id_historia||'');
     try{if(!ih&&typeof editingHistoryId!=='undefined')ih=texto(editingHistoryId);}catch(e){}
     return {
      atencion:a,id_atencion:ia,
      id_paciente:texto(document.getElementById('hcPacienteSelect')?.value||a?.id_paciente||''),
      id_historia:ih,id_medico:texto(a?.id_medico||''),
      numero_consulta:texto(a?.numero_consulta||''),
      nombre_paciente:texto(a?.nombre_paciente||''),
      nombre_medico:texto(a?.nombre_medico||''),
      fecha_atencion:texto(a?.fecha_atencion||a?.fecha||'')
     };
    }
    function fechaClave(v){
     const r=texto(v);if(!r)return'';
     let m=r.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return`${m[1]}-${m[2]}-${m[3]}`;
     m=r.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
     if(m)return`${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
     const d=new Date(r);if(isNaN(d.getTime()))return'';
     return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
    }
    function hoy(){return fechaClave(new Date().toISOString());}
    function clave(c){return [texto(c.id_paciente),texto(c.id_historia),texto(c.id_atencion),fechaClave(c.fecha_atencion)].join('|');}
    function panel(){
     return {area:valorAreaUX(),procedimiento:valor(CAMPOS.procedimiento),
     sesion:valor(CAMPOS.sesion),consentimiento:valor(CAMPOS.consentimiento),
     facial:valor(CAMPOS.facial),corporal:valor(CAMPOS.corporal),
     intima:valor(CAMPOS.intima),evolucion:valor(CAMPOS.evolucion)};
    }
    function firma(o){
     o=o||{};return JSON.stringify({
      area:texto(o.area),procedimiento:texto(o.procedimiento),sesion:texto(o.sesion),
      consentimiento:texto(o.consentimiento),facial:texto(o.facial),
      corporal:texto(o.corporal),intima:texto(o.intima),evolucion:texto(o.evolucion)
     });
    }
    function parseEval(v){
     const raw=texto(v);if(!raw)return{};
     let j=raw;
     if(raw.startsWith(PREFIJO))j=raw.slice(PREFIJO.length);
     else{const i=raw.indexOf('{'),f=raw.lastIndexOf('}');if(i>=0&&f>i)j=raw.slice(i,f+1);else return{evolucion:raw};}
     try{const o=JSON.parse(j);return o&&typeof o==='object'?o:{};}catch(e){return{evolucion:raw};}
    }
    function limpiar(){
     setAreaUX('Facial');setValor(CAMPOS.procedimiento,'');
     setValor(CAMPOS.sesion,'');setValor(CAMPOS.consentimiento,'Pendiente');
     setValor(CAMPOS.facial,'');setValor(CAMPOS.corporal,'');
     setValor(CAMPOS.intima,'');setValor(CAMPOS.evolucion,'');
     actualizarAreaLibreUX();actualizarProcedimientosUX();
    }
    function aplicar(r){
     limpiar();if(!r)return;
     const e=parseEval(r.evaluacion_clinica);
     setAreaUX(texto(r.zona_tratamiento)||'Facial');
     setValor(CAMPOS.procedimiento,r.procedimiento_sugerido||'');
     setValor(CAMPOS.sesion,r.plan_sesiones||'');
     setValor(CAMPOS.consentimiento,e.consentimiento||'Pendiente');
     setValor(CAMPOS.facial,e.facial||'');setValor(CAMPOS.corporal,e.corporal||'');
     setValor(CAMPOS.intima,e.intima||'');setValor(CAMPOS.evolucion,e.evolucion||'');
     actualizarAreaLibreUX();actualizarProcedimientosUX();
    }
    function lista(j){
     if(Array.isArray(j))return j;
     if(Array.isArray(j?.data))return j.data;
     if(Array.isArray(j?.resultado))return j.resultado;
     return[];
    }
    async function listar(){
     const r=await fetch(api()+'?accion=listarEstetica&_='+Date.now(),{cache:'no-store'});
     if(!r.ok)throw new Error('No se pudo consultar Estética. HTTP '+r.status);
     const j=await r.json();if(j&&j.success===false)throw new Error(j.message||'No se pudo consultar Estética.');
     return lista(j);
    }
    function tiempo(r){
     const x=r?.actualizado_en||r?.creado_en||r?.fecha_atencion||'';
     const t=x?new Date(x).getTime():0;return isNaN(t)?0:t;
    }
    function resolver(ls,c){
     const ia=texto(c.id_atencion);
     if(!ia)return null;
     let x=(ls||[]).filter(r=>
      texto(r.id_historia)===texto(c.id_historia)&&
      texto(r.id_paciente)===texto(c.id_paciente)&&
      texto(r.estado||'Activo').toLowerCase()!=='anulado'&&
      texto(r.id_atencion)===ia
     );
     if(!x.length)return null;
     x.sort((a,b)=>tiempo(b)-tiempo(a));
     return x[0]||null;
    }
    function baseline(r,c){
     estado.id_estetica=texto(r?.id_estetica||'');estado.id_historia=texto(c.id_historia);
     estado.id_paciente=texto(c.id_paciente);estado.id_atencion=texto(c.id_atencion);
     estado.fecha_atencion=texto(c.fecha_atencion);estado.registro=r||null;
     estado.firma_baseline=firma(panel());estado.dirty=false;estado.cargado=true;
    }
    function coincide(c){
     return estado.cargado&&texto(estado.id_historia)===texto(c.id_historia)&&
     texto(estado.id_paciente)===texto(c.id_paciente)&&
     texto(estado.id_atencion)===texto(c.id_atencion)&&
     fechaClave(estado.fecha_atencion)===fechaClave(c.fecha_atencion);
    }
    function invalidar(motivo){
     estado.epoch++;estado.loadSeq++;estado.id_estetica='';estado.id_historia='';
     estado.id_paciente='';estado.id_atencion='';estado.fecha_atencion='';
     estado.registro=null;estado.firma_baseline='';estado.dirty=false;
     estado.cargado=false;estado.loading=false;
     console.log('AUROSANAX ESTÉTICA V2: contexto invalidado'+(motivo?' · '+motivo:''));
    }
    async function cargar(op){
     const opt=op||{},c=contexto(),k=clave(c);
     if(!opt.forzar&&!estado.loading&&coincide(c))return estado.registro;
     /* V2.2: barrera visual inmediata. Si cambió la atención/paciente/historia,
        ningún dato del contexto anterior puede permanecer mientras llega la lectura. */
     if(!coincide(c)){
      invalidar('cambio de contexto detectado al cargar');
      limpiar();
     }
     const ep=estado.epoch,seq=++estado.loadSeq;
     if(!c.id_historia||!c.id_paciente||!c.id_atencion){baseline(null,c);return null;}
     estado.loading=true;estado.ultimoError='';
     try{
      const ls=await listar(),actual=contexto();
      if(seq!==estado.loadSeq||ep!==estado.epoch||k!==clave(actual))return null;
      const r=resolver(ls,actual);aplicar(r);baseline(r,actual);
      try{window.dispatchEvent(new CustomEvent('aurosanax:estetica-cargada',{detail:{
       id_estetica:estado.id_estetica,id_atencion:estado.id_atencion,
       id_paciente:estado.id_paciente,id_historia:estado.id_historia,version:VERSION
      }}));}catch(e){}
      return r;
     }catch(e){
      if(seq===estado.loadSeq&&ep===estado.epoch&&k===clave(contexto())){
       estado.ultimoError=texto(e?.message||e);console.warn('AUROSANAX ESTÉTICA V2: error de carga.',e);
      }
      return null;
     }finally{if(seq===estado.loadSeq)estado.loading=false;}
    }
    function payload(c){
     const p=panel();
     return {
      id_estetica:estado.id_estetica||undefined,id_historia:c.id_historia,
      id_paciente:c.id_paciente,id_medico:c.id_medico,
      id_atencion:c.id_atencion,numero_consulta:c.numero_consulta||'',
      nombre_paciente:c.nombre_paciente||'',nombre_medico:c.nombre_medico||'',
      fecha_atencion:fechaClave(c.fecha_atencion)||hoy(),
      zona_tratamiento:p.area,
      evaluacion_clinica:PREFIJO+JSON.stringify({
       consentimiento:p.consentimiento,facial:p.facial,corporal:p.corporal,
       intima:p.intima,evolucion:p.evolucion
      }),
      procedimiento_sugerido:p.procedimiento,plan_sesiones:p.sesion,estado:'Activo'
     };
    }
    function cambio(c){return !coincide(c)||firma(panel())!==estado.firma_baseline;}
    function mostrar(msg,tipo){
     if(typeof window.auroHistoriaMostrarEstado==='function')window.auroHistoriaMostrarEstado(msg,tipo||'');
    }
    function resumen(){
     try{if(typeof window.auroHistoriaAtencionResumen==='function')return window.auroHistoriaAtencionResumen()||{consulta:'activa'};}catch(e){}
     return{consulta:'activa'};
    }
    async function post(accion,data){
     const r=await fetch(api(),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
     body:JSON.stringify({accion:accion,data:data})});
     if(!r.ok)throw new Error('No se pudo guardar Estética. HTTP '+r.status);
     const j=await r.json();if(j&&j.success===false)throw new Error(j.message||'No se pudo guardar Estética.');
     return j;
    }
    async function guardar(){
     if(estado.saving)return{success:false,en_curso:true,message:'Guardado de Estética ya en curso.'};
     let c=contexto();
     if(!c.id_historia||!c.id_paciente){alert('Seleccione una historia clínica válida antes de guardar Estética.');return{success:false};}
     if(!c.id_atencion){alert('Seleccione una consulta activa antes de guardar Estética.');return{success:false};}
     if(!coincide(c)){await cargar({forzar:true});c=contexto();if(!coincide(c))return{success:false,contexto_cambio:true};}
     if(!estado.dirty||!cambio(c)){
      estado.dirty=false;const a=resumen();
      mostrar('Estética · Consulta '+(a.consulta||'activa')+' · Sin cambios reales. No se realizó ninguna escritura.','ok');
      try{if(typeof window.auroHistoriaRefrescarEstadoConsultaActiva==='function')await window.auroHistoriaRefrescarEstadoConsultaActiva('hc_estetica');}catch(e){}
      return{success:true,sin_cambios:true,id_estetica:estado.id_estetica||''};
     }
     const k=clave(c),ep=estado.epoch,seq=++estado.saveSeq,d=payload(c);
     const accion=estado.id_estetica?'editarEstetica':'guardarEstetica';
     estado.saving=true;estado.ultimoError='';
     const a=resumen();mostrar('Guardando Estética · Consulta '+(a.consulta||'activa')+'…','saving');
     try{
      const j=await post(accion,d);
      if(seq!==estado.saveSeq||ep!==estado.epoch||k!==clave(contexto()))
       return Object.assign({},j||{},{success:true,contexto_cambio:true,visual_descartada:true});
      estado.cargado=false;await cargar({forzar:true});
      if(k!==clave(contexto()))return Object.assign({},j||{},{success:true,contexto_cambio:true});
      try{if(typeof window.auroHistoriaRefrescarEstadoConsultaActiva==='function')await window.auroHistoriaRefrescarEstadoConsultaActiva('hc_estetica');}catch(e){}
      try{window.dispatchEvent(new CustomEvent('aurosanax:estetica-guardada',{detail:{
       id_estetica:estado.id_estetica,id_atencion:estado.id_atencion,
       id_paciente:estado.id_paciente,id_historia:estado.id_historia,version:VERSION
      }}));}catch(e){}
      return j;
     }catch(e){
      estado.ultimoError=texto(e?.message||e);
      if(k===clave(contexto()))mostrar('Estética · No se pudo guardar. '+estado.ultimoError,'error');
      console.error('AUROSANAX ESTÉTICA V2: error de guardado.',e);
      return{success:false,message:estado.ultimoError};
     }finally{if(seq===estado.saveSeq)estado.saving=false;}
    }
    async function estadoReal(idAtencion){
     const c=contexto();
     if(texto(idAtencion)!==texto(c.id_atencion))return{existe:false,fecha:'',fuente:'estetica_contexto_distinto'};
     if(!coincide(c))await cargar({forzar:true});
     if(texto(idAtencion)!==texto(contexto().id_atencion))return{existe:false,fecha:'',fuente:'estetica_contexto_cambio'};
     const r=estado.registro;
     if(!r||!texto(r.id_estetica))return{existe:false,fecha:'',fuente:'estetica_funcional'};
     return{existe:true,fecha:texto(r.actualizado_en||r.creado_en||r.fecha_atencion||''),fuente:'estetica_funcional'};
    }
    function alCambiarAtencion(){
     invalidar('evento atención seleccionada');
     limpiar();
     const c=contexto();
     if(c.id_atencion&&c.id_paciente&&c.id_historia){
      Promise.resolve(cargar({forzar:true})).catch(e=>
       console.warn('AUROSANAX ESTÉTICA V2.4.1: recarga de atención falló.',e)
      );
     }else{
      baseline(null,c);
     }
    }


    /* ============================================================
       V2.4.1 — UX DE LLENADO HÍBRIDO
       ------------------------------------------------------------
       Capa exclusivamente visual/aditiva:
       - Sugerencias por área sin cerrar la escritura médica.
       - "Otra área" con texto libre.
       - Procedimiento y sesión siguen siendo inputs libres.
       - Datalist solo sugiere; nunca obliga.
       - Botones Limpiar por campo.
       - No altera endpoints, payload, resolver, identidad ni backend.
    ============================================================ */
    const AREAS_BASE=Object.freeze(['Facial','Corporal','Íntima','Capilar']);
    const SUGERENCIAS_PROCEDIMIENTO=Object.freeze({
     'Facial':[
      'Limpieza facial','Hidratación facial','Rejuvenecimiento facial',
      'Hollywood Peel','Láser CO₂ facial','Peeling facial',
      'Bioestimulación facial','Ácido hialurónico'
     ],
     'Corporal':[
      'Rejuvenecimiento corporal','Bioestimulación corporal',
      'Tratamiento de flacidez','Tratamiento de estrías',
      'Tratamiento de cicatrices','Depilación láser',
      'Hidratación corporal','Protocolo despigmentante corporal'
     ],
     'Íntima':[
      'Aclaramiento íntimo','Limpieza íntima','Hidratación íntima',
      'Rejuvenecimiento íntimo','Tensado vaginal',
      'Láser CO₂ íntimo','Tratamiento de incontinencia urinaria',
      'Labioplastia','Tratamiento de verrugas con CO₂'
     ],
     'Capilar':[
      'Evaluación capilar','Bioestimulación capilar',
      'Terapia regenerativa capilar','Hidratación capilar',
      'Protocolo para caída capilar'
     ]
    });
    const SUGERENCIAS_SESION=Object.freeze([
     '1 sesión','2 sesiones','3 sesiones','4 sesiones','5 sesiones','6 sesiones',
     'Según evolución','Sesiones según respuesta clínica','Reevaluar en próxima consulta'
    ]);

    function uxId(s){return 'auroEsteticaUX_'+s;}
    function areaSelect(){return document.getElementById(CAMPOS.area);}
    function areaLibre(){return document.getElementById(uxId('areaLibre'));}
    function valorAreaUX(){
     const s=areaSelect();if(!s)return'';
     const v=texto(s.value);
     return v==='__OTRA__'?texto(areaLibre()?.value||''):v;
    }
    function setAreaUX(v){
     const s=areaSelect();if(!s)return;
     const x=texto(v)||'Facial';
     if(AREAS_BASE.includes(x)){s.value=x;if(areaLibre())areaLibre().value='';}
     else{s.value='__OTRA__';if(areaLibre())areaLibre().value=x;}
     actualizarAreaLibreUX();actualizarProcedimientosUX();
    }
    function marcarDirtyUX(){
     estado.dirty=true;
     try{document.getElementById('hc_estetica')?.dispatchEvent(new Event('input',{bubbles:true}));}catch(e){}
    }
    function crearDatalist(id,items){
     let d=document.getElementById(id);
     if(!d){d=document.createElement('datalist');d.id=id;document.body.appendChild(d);}
     d.innerHTML='';
     (items||[]).forEach(x=>{const o=document.createElement('option');o.value=x;d.appendChild(o);});
     return d;
    }
    function actualizarProcedimientosUX(){
     const area=valorAreaUX();
     const items=SUGERENCIAS_PROCEDIMIENTO[area]||[];
     crearDatalist(uxId('procedimientos'),items);
     const e=document.getElementById(CAMPOS.procedimiento);
     if(e)e.setAttribute('list',uxId('procedimientos'));
    }
    function actualizarAreaLibreUX(){
     const w=document.getElementById(uxId('areaLibreWrap'));
     if(!w)return;
     const otra=texto(areaSelect()?.value)==='__OTRA__';
     w.style.display=otra?'block':'none';
    }
    function botonLimpiarUX(target,fn){
     const b=document.createElement('button');
     b.type='button';b.className='btn btn-sm btn-outline-secondary';
     b.textContent='Limpiar';
     b.style.cssText='padding:.18rem .55rem;font-size:.78rem;line-height:1.25;';
     b.addEventListener('click',()=>{fn();marcarDirtyUX();});
     target.appendChild(b);
    }
    function accionesDebajoUX(el,fn){
     if(!el||document.getElementById(uxId('acciones_'+el.id)))return;
     const a=document.createElement('div');a.id=uxId('acciones_'+el.id);
     a.style.cssText='display:flex;gap:.4rem;align-items:center;margin-top:.35rem;flex-wrap:wrap;';
     botonLimpiarUX(a,fn);
     el.insertAdjacentElement('afterend',a);
    }

    /* ============================================================
       V2.4.1 — EDITOR AMPLIADO PARA TEXTO CLÍNICO
       ------------------------------------------------------------
       Capa UX únicamente. No altera payload, JSON, resolver,
       id_atencion, endpoints, baseline ni persistencia.
    ============================================================ */
    function asegurarEditorAmpliadoUX(){
     if(document.getElementById(uxId('modalAmpliado')))return;
     const overlay=document.createElement('div');
     overlay.id=uxId('modalAmpliado');
     overlay.style.cssText='display:none;position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.38);align-items:center;justify-content:center;padding:18px;';
     overlay.innerHTML=`
      <div role="dialog" aria-modal="true" style="width:min(760px,96vw);max-height:92vh;background:#fff;border-radius:16px;box-shadow:0 18px 60px rgba(0,0,0,.28);padding:18px;display:flex;flex-direction:column;gap:12px;">
       <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <strong id="${uxId('modalTitulo')}" style="font-size:1.05rem;">Editor ampliado</strong>
        <button type="button" id="${uxId('modalCerrar')}" aria-label="Cerrar" style="border:1px solid #d7dce2;background:#fff;border-radius:9px;width:36px;height:36px;font-size:20px;line-height:1;">×</button>
       </div>
       <textarea id="${uxId('modalTexto')}" style="width:100%;min-height:330px;max-height:62vh;resize:vertical;border:2px solid #9fd8ee;border-radius:12px;padding:12px;font:inherit;line-height:1.45;outline:none;" placeholder="Escriba aquí..."></textarea>
       <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <span id="${uxId('modalContador')}" style="font-size:.82rem;color:#667085;">0 caracteres</span>
        <button type="button" id="${uxId('modalListo')}" class="btn btn-primary">Listo</button>
       </div>
      </div>`;
     document.body.appendChild(overlay);

     const ta=document.getElementById(uxId('modalTexto'));
     const contador=document.getElementById(uxId('modalContador'));
     const cerrar=document.getElementById(uxId('modalCerrar'));
     const listo=document.getElementById(uxId('modalListo'));
     const actualizar=()=>{contador.textContent=`${ta.value.length} caracteres`;};
     ta.addEventListener('input',actualizar);

     const cerrarSinAplicar=()=>{overlay.style.display='none';overlay.dataset.target='';};
     cerrar.addEventListener('click',cerrarSinAplicar);
     overlay.addEventListener('click',e=>{if(e.target===overlay)cerrarSinAplicar();});
     document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&overlay.style.display==='flex')cerrarSinAplicar();
     });
     listo.addEventListener('click',()=>{
      const id=overlay.dataset.target||'';
      const campo=document.getElementById(id);
      if(campo){
       campo.value=ta.value;
       campo.dispatchEvent(new Event('input',{bubbles:true}));
       campo.dispatchEvent(new Event('change',{bubbles:true}));
       marcarDirtyUX();
      }
      cerrarSinAplicar();
     });
    }

    function abrirEditorAmpliadoUX(id,titulo){
     asegurarEditorAmpliadoUX();
     const campo=document.getElementById(id);if(!campo)return;
     const overlay=document.getElementById(uxId('modalAmpliado'));
     const ta=document.getElementById(uxId('modalTexto'));
     const t=document.getElementById(uxId('modalTitulo'));
     const contador=document.getElementById(uxId('modalContador'));
     overlay.dataset.target=id;
     t.textContent=titulo||'Editor ampliado';
     ta.value=campo.value||'';
     contador.textContent=`${ta.value.length} caracteres`;
     overlay.style.display='flex';
     setTimeout(()=>{ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);},0);
    }

    function agregarAmpliarUX(el,titulo){
     if(!el)return;
     const acciones=document.getElementById(uxId('acciones_'+el.id));
     if(!acciones||acciones.querySelector('[data-auro-ampliar="1"]'))return;
     const b=document.createElement('button');
     b.type='button';b.className='btn btn-sm btn-outline-secondary';
     b.dataset.auroAmpliar='1';
     b.textContent='↗ Ampliar';
     b.title='Abrir un editor amplio sin modificar el tamaño del campo';
     b.style.cssText='padding:.18rem .55rem;font-size:.78rem;line-height:1.25;';
     b.addEventListener('click',()=>abrirEditorAmpliadoUX(el.id,titulo));
     acciones.appendChild(b);
    }

    function instalarEditoresAmpliadosUX(){
     asegurarEditorAmpliadoUX();
     [
      [CAMPOS.facial,'Evaluación facial'],
      [CAMPOS.corporal,'Evaluación corporal'],
      [CAMPOS.intima,'Evaluación íntima'],
      [CAMPOS.evolucion,'Evolución']
     ].forEach(([id,titulo])=>{
      const e=document.getElementById(id);
      if(e)agregarAmpliarUX(e,titulo);
     });
    }

    function instalarUX(){
     const p=document.getElementById('hc_estetica');if(!p||p.dataset.auroEsteticaUXV24==='1')return;
     p.dataset.auroEsteticaUXV24='1';

     const area=areaSelect();
     if(area){
      if(!Array.from(area.options).some(o=>o.value==='__OTRA__')){
       const o=document.createElement('option');o.value='__OTRA__';o.textContent='Otra área…';area.appendChild(o);
      }
      const wrap=document.createElement('div');wrap.id=uxId('areaLibreWrap');
      wrap.style.cssText='display:none;margin-top:.4rem;';
      const inp=document.createElement('input');inp.id=uxId('areaLibre');inp.className='form-control';
      inp.placeholder='Escriba otra área';inp.autocomplete='off';
      inp.addEventListener('input',()=>{actualizarProcedimientosUX();marcarDirtyUX();});
      wrap.appendChild(inp);
      const acciones=document.createElement('div');acciones.style.cssText='margin-top:.35rem;';
      botonLimpiarUX(acciones,()=>{inp.value='';inp.focus();});
      wrap.appendChild(acciones);
      area.insertAdjacentElement('afterend',wrap);
      area.addEventListener('change',()=>{actualizarAreaLibreUX();actualizarProcedimientosUX();});
      accionesDebajoUX(area,()=>{setAreaUX('Facial');});
     }

     const proc=document.getElementById(CAMPOS.procedimiento);
     if(proc){
      proc.placeholder='Seleccione una sugerencia o escriba libremente';
      proc.autocomplete='off';actualizarProcedimientosUX();
      accionesDebajoUX(proc,()=>{proc.value='';proc.focus();});
     }

     const ses=document.getElementById(CAMPOS.sesion);
     if(ses){
      ses.placeholder='Ej. 3 sesiones o escriba libremente';
      ses.autocomplete='off';ses.setAttribute('list',uxId('sesiones'));
      crearDatalist(uxId('sesiones'),SUGERENCIAS_SESION);
      accionesDebajoUX(ses,()=>{ses.value='';ses.focus();});
     }

     const con=document.getElementById(CAMPOS.consentimiento);
     if(con){
      if(!Array.from(con.options).some(o=>o.value==='')){
       const o=document.createElement('option');o.value='';o.textContent='— Seleccionar —';con.insertBefore(o,con.firstChild);
      }
      accionesDebajoUX(con,()=>{con.value='';con.focus();});
     }

     [CAMPOS.facial,CAMPOS.corporal,CAMPOS.intima,CAMPOS.evolucion].forEach(id=>{
      const e=document.getElementById(id);if(e)accionesDebajoUX(e,()=>{e.value='';e.focus();});
     });

     actualizarAreaLibreUX();actualizarProcedimientosUX();
     instalarEditoresAmpliadosUX();
    }

    function instalar(){
     instalarUX();
     const p=document.getElementById('hc_estetica');
     if(p&&p.dataset.auroEsteticaDirtyV2!=='1'){
      p.dataset.auroEsteticaDirtyV2='1';
      const dirty=e=>{if(e?.isTrusted===true)estado.dirty=true;};
      p.addEventListener('input',dirty,true);p.addEventListener('change',dirty,true);
     }
     const s=document.getElementById('hcPacienteSelect');
     if(s&&s.dataset.auroEsteticaPacienteV2!=='1'){
      s.dataset.auroEsteticaPacienteV2='1';
      s.addEventListener('change',()=>{invalidar('cambio de paciente');limpiar();});
     }
     if(window.__auroEsteticaEventosV241!=='1'){
      window.__auroEsteticaEventosV241='1';
      window.addEventListener('aurosanax:atencion-seleccionada',alCambiarAtencion);
      window.addEventListener('aurosanax:atencion-limpiada',alCambiarAtencion);
      window.addEventListener('aurosanax:atencion-finalizada',alCambiarAtencion);
     }
    }
    function debug(){
     const c=contexto();return{
      instalado:true,version:VERSION,propietario:'estetica.js',
      id_estetica:estado.id_estetica,id_historia:estado.id_historia,
      id_paciente:estado.id_paciente,id_atencion:estado.id_atencion,
      cargado:estado.cargado,loading:estado.loading,saving:estado.saving,
      dirty:estado.dirty,contexto_coincide:coincide(c),cambio_real:cambio(c),
      tiene_registro:!!estado.registro,actualizado_en:estado.registro?.actualizado_en||'',
      ultimo_error:estado.ultimoError,
      persistencia:'V2.4.1: conserva identidad estricta V2.3 por id_atencion; UX híbrida aditiva; sin fallback por fecha'
     };
    }

    /* API pública compatible con Index V1 + API agrupada V2. */
    window.auroEsteticaCargarContextoActual=cargar;
    window.auroGuardarEsteticaFuncionalERP=guardar;
    window.auroEsteticaEstadoRealActual=estadoReal;
    window.auroEsteticaDebugV1=debug;
    window.auroEstetica=Object.freeze({
     version:VERSION,inicializar:instalar,cargarContextoActual:cargar,
     guardar:guardar,estadoReal:estadoReal,invalidarContexto:invalidar,debug:debug
    });

    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',instalar,{once:true});
    else instalar();

    console.log('AUROSANAX ESTÉTICA V2.4.1 instalada · UX híbrida aditiva · identidad estricta por atención conservada.');
    })();
