    /* ============================================================
     AUROSANAX — ESTÉTICA FUNCIONAL V2.3
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

    const VERSION='2.3.0-modular-independiente';
    const PREFIJO='AUROSANAX_ESTETICA_V1::';

    if(window.__auroEsteticaV23Instalada){
      console.warn('AUROSANAX ESTÉTICA V2.3: segunda instalación omitida.');
      return;
    }
    window.__auroEsteticaV23Instalada=true;

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
     return {area:valor(CAMPOS.area),procedimiento:valor(CAMPOS.procedimiento),
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
     setValor(CAMPOS.area,'Facial');setValor(CAMPOS.procedimiento,'');
     setValor(CAMPOS.sesion,'');setValor(CAMPOS.consentimiento,'Pendiente');
     setValor(CAMPOS.facial,'');setValor(CAMPOS.corporal,'');
     setValor(CAMPOS.intima,'');setValor(CAMPOS.evolucion,'');
    }
    function aplicar(r){
     limpiar();if(!r)return;
     const e=parseEval(r.evaluacion_clinica);
     setValor(CAMPOS.area,texto(r.zona_tratamiento)||'Facial');
     setValor(CAMPOS.procedimiento,r.procedimiento_sugerido||'');
     setValor(CAMPOS.sesion,r.plan_sesiones||'');
     setValor(CAMPOS.consentimiento,e.consentimiento||'Pendiente');
     setValor(CAMPOS.facial,e.facial||'');setValor(CAMPOS.corporal,e.corporal||'');
     setValor(CAMPOS.intima,e.intima||'');setValor(CAMPOS.evolucion,e.evolucion||'');
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
       console.warn('AUROSANAX ESTÉTICA V2.3: recarga de atención falló.',e)
      );
     }else{
      baseline(null,c);
     }
    }

    function instalar(){
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
     if(window.__auroEsteticaEventosV23!=='1'){
      window.__auroEsteticaEventosV23='1';
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
      persistencia:'V2.3: identidad estricta por id_atencion; sin fallback por fecha; registros V1 históricos no se modifican'
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

    console.log('AUROSANAX ESTÉTICA V2.3 instalada · módulo independiente · identidad estricta por atención.');
    })();
