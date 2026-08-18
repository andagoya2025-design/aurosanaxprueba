/* ==========================================================
   AUROSANAX ERP · PREATENCIÓN 2.0
   Archivo funcional aislado para Secretaría.

   - NO inicia atención.
   - NO crea Historia Clínica.
   - NO crea Examen físico.
   - Permite seleccionar cita existente de forma OPCIONAL.
   - Guarda una preatención pendiente por paciente + cita/contexto.
   - Signos vitales completos equivalentes al bloque del Index.
   - Antecedentes referidos permanecen como información no validada.
   ========================================================== */
(function(){
  'use strict';

  const seguridad = window.AUROSANAX_SEGURIDAD;
  let pacientesCache = [];
  let citasCache = [];

  function tiene(clave){
    return !!(seguridad && typeof seguridad.tienePermiso === 'function' && seguridad.tienePermiso(clave));
  }
  function tienePreatencion(){
    return ['preconsulta','preconsulta_datos_administrativos','preconsulta_signos_vitales','preconsulta_antecedentes_referidos'].some(tiene);
  }
  function apiUrl(){
    return (seguridad && seguridad.config && seguridad.config.apiUrl) ||
      (typeof API_URL !== 'undefined' ? API_URL : '');
  }
  async function get(accion, params){
    const q = new URLSearchParams({accion:accion,_:String(Date.now())});
    Object.entries(params || {}).forEach(([k,v]) => {
      if(v !== undefined && v !== null) q.append(k,String(v));
    });
    const r = await fetch(apiUrl() + '?' + q.toString(), {cache:'no-store'});
    if(!r.ok) throw new Error('Error HTTP ' + r.status);
    return await r.json();
  }
  async function post(accion, data){
    const r = await fetch(apiUrl(), {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({accion:accion,data:data || {}})
    });
    if(!r.ok) throw new Error('Error HTTP ' + r.status);
    return await r.json();
  }
  function esc(v){
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  function numero(v){
    const s=String(v || '').trim().replace(',','.');
    return s === '' ? '' : s;
  }
  function val(id){ return String(document.getElementById(id)?.value || '').trim(); }
  function set(id,v){ const el=document.getElementById(id); if(el) el.value=(v ?? ''); }
  function nombrePaciente(p){ return [p?.nombres,p?.apellidos].filter(Boolean).join(' ').trim() || p?.nombre_paciente || 'Paciente'; }
  function nombreMedico(id){
    const c=citasCache.find(x => String(x.id_medico || '')===String(id || ''));
    return c?.nombre_medico || id || '';
  }
  function fechaVista(v){
    const s=String(v || '').substring(0,10); const p=s.split('-');
    return p.length===3 ? p[2]+'/'+p[1]+'/'+p[0] : s;
  }

  function inyectar(){
    if(!tienePreatencion() || document.getElementById('preatencion')) return;

    const menu=document.querySelector('.sidebar .menu');
    if(menu){
      const btn=document.createElement('button');
      btn.type='button';
      btn.dataset.screen='preatencion';
      btn.dataset.permisoCualquiera='preconsulta,preconsulta_datos_administrativos,preconsulta_signos_vitales,preconsulta_antecedentes_referidos';
      btn.innerHTML='<i class="bi bi-clipboard2-pulse"></i> Preatención';
      btn.onclick=function(){ window.showScreen && window.showScreen('preatencion',btn); };
      const configBtn=menu.querySelector('[data-permiso-cualquiera*="configuracion"]');
      if(configBtn) menu.insertBefore(btn,configBtn); else menu.appendChild(btn);
    }

    const main=document.querySelector('.main');
    if(!main) return;
    const section=document.createElement('section');
    section.className='screen'; section.id='preatencion';
    section.innerHTML=`
      <div class="cardx p-4">
        <div class="section-head">
          <div><h4><i class="bi bi-clipboard2-pulse me-2"></i>Preatención</h4><p>Registro previo. No inicia una atención clínica.</p></div>
          <button type="button" class="btn-line" id="preBtnActualizar"><i class="bi bi-arrow-clockwise me-1"></i> Actualizar</button>
        </div>
        <div class="mini-note mb-3"><i class="bi bi-shield-check me-1"></i>
          Puede trabajar con una cita existente o sin cita. La vinculación al <b>id_atencion</b> ocurre únicamente cuando el médico inicia la atención.
        </div>

        <div class="row g-3">
          <div class="col-md-6"><label class="form-label">Paciente *</label><select id="prePaciente" class="form-select"><option value="">Cargando pacientes…</option></select></div>
          <div class="col-md-6"><label class="form-label">Cita relacionada <span class="text-muted">(opcional)</span></label><select id="preCita" class="form-select"><option value="">Sin cita / atención espontánea</option></select></div>
          <div class="col-12"><div id="preContexto" class="small text-muted fw-bold">Seleccione un paciente.</div></div>
        </div>

        <div id="preSignos" class="mt-4" style="display:none">
          <h5 class="fw-bold mb-3">Signos vitales y antropometría</h5>
          <div class="row g-3">
            <div class="col-6 col-md-2"><label class="form-label">Peso (kg)</label><input id="prePeso" class="form-control" inputmode="decimal"></div>
            <div class="col-6 col-md-2"><label class="form-label">Talla (cm)</label><input id="preTalla" class="form-control" inputmode="decimal"></div>
            <div class="col-6 col-md-2"><label class="form-label">IMC</label><input id="preIMC" class="form-control" readonly></div>
            <div class="col-6 col-md-2"><label class="form-label">PA sistólica</label><input id="prePAS" class="form-control" inputmode="numeric" maxlength="3"></div>
            <div class="col-6 col-md-2"><label class="form-label">PA diastólica</label><input id="prePAD" class="form-control" inputmode="numeric" maxlength="3"></div>
            <div class="col-6 col-md-2"><label class="form-label">FC (lpm)</label><input id="preFC" class="form-control" inputmode="numeric"></div>
            <div class="col-6 col-md-2"><label class="form-label">FR (rpm)</label><input id="preFR" class="form-control" inputmode="numeric"></div>
            <div class="col-6 col-md-2"><label class="form-label">Temperatura (°C)</label><input id="preTemp" class="form-control" inputmode="decimal"></div>
            <div class="col-6 col-md-2"><label class="form-label">Saturación O₂ (%)</label><input id="preSat" class="form-control" inputmode="numeric"></div>
            <div class="col-6 col-md-2"><label class="form-label">Perímetro cadera (cm)</label><input id="preCadera" class="form-control" inputmode="decimal"></div>
            <div class="col-6 col-md-2"><label class="form-label">Grasa corporal (%)</label><input id="preGrasa" class="form-control" inputmode="decimal"></div>
            <div class="col-6 col-md-2"><label class="form-label">Masa muscular (kg)</label><input id="preMasa" class="form-control" inputmode="decimal"></div>
            <div class="col-6 col-md-2"><label class="form-label">Perímetro cefálico (cm)</label><input id="preCefalico" class="form-control" inputmode="decimal"></div>
            <div class="col-6 col-md-2"><label class="form-label">Perímetro torácico (cm)</label><input id="preToracico" class="form-control" inputmode="decimal"></div>
            <div class="col-6 col-md-2"><label class="form-label">Perímetro abdominal (cm)</label><input id="preAbdominal" class="form-control" inputmode="decimal"></div>
          </div>
        </div>

        <div id="preAntecedentes" class="mt-4" style="display:none">
          <h5 class="fw-bold mb-2">Antecedentes referidos</h5>
          <p class="text-muted small">Información referida por el paciente. No sustituye la validación médica ni modifica los antecedentes oficiales.</p>
          <textarea id="preAntecedentesTexto" class="form-control" rows="5" placeholder="Registre únicamente lo referido por el paciente."></textarea>
        </div>

        <div class="d-flex justify-content-end mt-4"><button type="button" id="preGuardar" class="btn-auro"><i class="bi bi-save me-1"></i> Guardar preatención</button></div>
      </div>`;
    main.appendChild(section);

    document.getElementById('preSignos').style.display=(tiene('preconsulta_signos_vitales')||tiene('preconsulta'))?'':'none';
    document.getElementById('preAntecedentes').style.display=(tiene('preconsulta_antecedentes_referidos')||tiene('preconsulta'))?'':'none';
    document.getElementById('prePaciente').addEventListener('change',async()=>{ await cargarCitasPaciente(); await cargarPendiente(); });
    document.getElementById('preCita').addEventListener('change',cargarPendiente);
    document.getElementById('preBtnActualizar').addEventListener('click',cargarTodo);
    document.getElementById('preGuardar').addEventListener('click',guardar);
    ['prePeso','preTalla'].forEach(id=>document.getElementById(id)?.addEventListener('input',calcIMC));
    cargarTodo();
  }

  function calcIMC(){
    const p=parseFloat(numero(val('prePeso'))), t=parseFloat(numero(val('preTalla')));
    set('preIMC',p>0&&t>0?(p/((t/100)*(t/100))).toFixed(1):'');
  }

  function limpiar(){
    ['prePeso','preTalla','preIMC','prePAS','prePAD','preFC','preFR','preTemp','preSat','preCadera','preGrasa','preMasa','preCefalico','preToracico','preAbdominal','preAntecedentesTexto'].forEach(id=>set(id,''));
  }

  async function cargarTodo(){
    await Promise.all([cargarPacientes(),cargarCitas()]);
    await cargarCitasPaciente();
    await cargarPendiente();
  }

  async function cargarPacientes(){
    const sel=document.getElementById('prePaciente'); if(!sel) return;
    const actual=sel.value;
    try{
      const lista=await get('listarPacientes'); pacientesCache=Array.isArray(lista)?lista:[];
      sel.innerHTML='<option value="">Seleccione paciente</option>'+pacientesCache.map(p=>'<option value="'+esc(p.id_paciente||'')+'">'+esc(nombrePaciente(p))+' · '+esc(p.numero_documento||'')+'</option>').join('');
      if(actual&&[...sel.options].some(o=>o.value===actual)) sel.value=actual;
    }catch(e){ sel.innerHTML='<option value="">Error cargando pacientes</option>'; }
  }

  async function cargarCitas(){
    try{ const lista=await get('listarCitas'); citasCache=Array.isArray(lista)?lista:[]; }
    catch(e){ citasCache=[]; }
  }

  async function cargarCitasPaciente(){
    const sel=document.getElementById('preCita'); if(!sel) return;
    const idPaciente=val('prePaciente'); const actual=sel.value;
    const relacionadas=citasCache.filter(c=>String(c.id_paciente||'')===idPaciente && !/anulad/i.test(String(c.estado_cita||'')))
      .sort((a,b)=>String(b.fecha_cita||'').localeCompare(String(a.fecha_cita||'')));
    sel.innerHTML='<option value="">Sin cita / atención espontánea</option>'+relacionadas.map(c=>{
      const texto=[fechaVista(c.fecha_cita||c.fecha),c.hora_inicio||'',c.tipo_cita||c.motivo||'',c.nombre_medico||c.id_medico||''].filter(Boolean).join(' · ');
      return '<option value="'+esc(c.id_cita||'')+'">'+esc(texto)+'</option>';
    }).join('');
    if(actual&&[...sel.options].some(o=>o.value===actual)) sel.value=actual;
    actualizarContexto();
  }

  function actualizarContexto(){
    const box=document.getElementById('preContexto'); if(!box) return;
    const p=pacientesCache.find(x=>String(x.id_paciente||'')===val('prePaciente'));
    const c=citasCache.find(x=>String(x.id_cita||'')===val('preCita'));
    if(!p){ box.textContent='Seleccione un paciente.'; return; }
    box.textContent=c
      ? ('Paciente: '+nombrePaciente(p)+' · Cita: '+(c.id_cita||'')+' · Médico: '+(c.nombre_medico||c.id_medico||'—'))
      : ('Paciente: '+nombrePaciente(p)+' · Sin cita seleccionada.');
  }

  async function cargarPendiente(){
    limpiar(); actualizarContexto();
    const idPaciente=val('prePaciente'), idCita=val('preCita');
    const estado=document.getElementById('preContexto');
    if(!idPaciente) return;
    try{
      const r=await get('buscarPreatencionPendientePorPaciente',{id_paciente:idPaciente,id_cita:idCita,contexto_exacto:'SI'});
      if(!r||!r.id_preatencion) return;
      set('prePeso',r.peso_kg); set('preTalla',r.talla_cm); set('preIMC',r.imc);
      const pa=String(r.presion_arterial||'').match(/^(\d{2,3})\/(\d{2,3})$/); set('prePAS',pa?pa[1]:''); set('prePAD',pa?pa[2]:'');
      set('preFC',r.frecuencia_cardiaca); set('preFR',r.frecuencia_respiratoria); set('preTemp',r.temperatura); set('preSat',r.saturacion);
      set('preCadera',r.perimetro_cadera); set('preGrasa',r.porcentaje_grasa); set('preMasa',r.masa_muscular);
      set('preCefalico',r.perimetro_cefalico); set('preToracico',r.perimetro_toracico); set('preAbdominal',r.perimetro_abdominal);
      set('preAntecedentesTexto',r.antecedentes_referidos);
      if(estado) estado.textContent += ' · Preatención pendiente recuperada.';
    }catch(e){ console.warn('AUROSANAX PREATENCIÓN: no se pudo recuperar pendiente',e); }
  }

  async function guardar(){
    const idPaciente=val('prePaciente'), idCita=val('preCita');
    if(!idPaciente){ alert('Seleccione un paciente.'); return; }
    if(!tienePreatencion()){ alert('Su usuario no tiene permiso de Preatención.'); return; }
    const pas=val('prePAS').replace(/\D/g,''), pad=val('prePAD').replace(/\D/g,'');
    if((pas&&!pad)||(!pas&&pad)){ alert('Complete presión sistólica y diastólica.'); return; }
    const usuario=typeof seguridad?.obtenerUsuario==='function'?(seguridad.obtenerUsuario()||{}):{};
    const cita=citasCache.find(x=>String(x.id_cita||'')===idCita)||{};
    const data={
      id_paciente:idPaciente,id_cita:idCita,id_medico:cita.id_medico||'',
      peso_kg:numero(val('prePeso')),talla_cm:numero(val('preTalla')),
      presion_arterial:pas&&pad?pas+'/'+pad:'',frecuencia_cardiaca:numero(val('preFC')),frecuencia_respiratoria:numero(val('preFR')),
      temperatura:numero(val('preTemp')),saturacion:numero(val('preSat')),
      perimetro_cadera:numero(val('preCadera')),porcentaje_grasa:numero(val('preGrasa')),masa_muscular:numero(val('preMasa')),
      perimetro_cefalico:numero(val('preCefalico')),perimetro_toracico:numero(val('preToracico')),perimetro_abdominal:numero(val('preAbdominal')),
      antecedentes_referidos:val('preAntecedentesTexto'),creado_por:usuario.usuario||usuario.nombre_completo||'Secretaría',
      token:typeof seguridad?.obtenerToken==='function'?seguridad.obtenerToken():''
    };
    const btn=document.getElementById('preGuardar'); if(btn) btn.disabled=true;
    try{
      const r=await post('guardarPreatencion',data); if(!r||r.success===false) throw new Error(r?.message||'No se pudo guardar.');
      alert('Preatención guardada correctamente.'); await cargarPendiente();
    }catch(e){ alert(e.message||'No se pudo guardar la preatención.'); }
    finally{ if(btn) btn.disabled=false; }
  }

  async function abrirDesdeCita(idCita){
    if(!document.getElementById('preatencion')) inyectar();
    if(!citasCache.length) await cargarCitas();
    const cita=citasCache.find(c=>String(c.id_cita||'')===String(idCita||''));
    if(!cita){ alert('No se encontró la cita. Actualice Agenda e intente nuevamente.'); return; }
    if(!cita.id_paciente){
      alert('La cita todavía no está vinculada a un paciente. Cree o vincule primero el paciente desde Pacientes.');
      return;
    }
    if(!pacientesCache.length) await cargarPacientes();
    set('prePaciente',cita.id_paciente); await cargarCitasPaciente(); set('preCita',cita.id_cita); await cargarPendiente();
    const btn=document.querySelector('.menu button[data-screen="preatencion"]');
    if(typeof window.showScreen==='function') window.showScreen('preatencion',btn||null);
  }

  window.AUROSANAX_PREATENCION={abrirDesdeCita,cargarTodo};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',inyectar,{once:true});
  else setTimeout(inyectar,0);
})();
