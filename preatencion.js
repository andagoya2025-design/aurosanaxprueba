/* ==========================================================
   AUROSANAX · PREATENCIÓN 1.0
   Archivo: preatencion.js
   Alcance aislado:
   - Captura datos ANTES de existir id_atencion.
   - Signos vitales y antecedentes referidos por id_paciente.
   - Seguridad por permisos existentes de seguridad.js.
   - NO crea atención, historia, diagnóstico, plan ni receta.
   - El backend vincula el registro pendiente cuando nace id_atencion.
   ========================================================== */
(function(){
  'use strict';

  const seguridad = window.AUROSANAX_SEGURIDAD;
  if(!seguridad) return;

  function tiene(clave){
    return typeof seguridad.tienePermiso === 'function' && seguridad.tienePermiso(clave);
  }

  function tienePreatencion(){
    return ['preconsulta','preconsulta_datos_administrativos','preconsulta_signos_vitales','preconsulta_antecedentes_referidos'].some(tiene);
  }

  function apiUrl(){
    return seguridad.configuracion && seguridad.configuracion.apiUrl
      ? seguridad.configuracion.apiUrl
      : '';
  }

  async function get(accion, params){
    const q = new URLSearchParams({accion:accion,t:String(Date.now())});
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
    const s = String(v || '').trim().replace(',','.');
    return s === '' ? '' : s;
  }

  function inyectar(){
    if(!tienePreatencion() || document.getElementById('preatencion')) return;

    const menu = document.querySelector('.sidebar .menu');
    if(menu){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.screen = 'preatencion';
      btn.dataset.permisoCualquiera = 'preconsulta,preconsulta_datos_administrativos,preconsulta_signos_vitales,preconsulta_antecedentes_referidos';
      btn.innerHTML = '<i class="bi bi-clipboard2-pulse"></i> Preatención';
      btn.onclick = function(){ window.showScreen && window.showScreen('preatencion', btn); };
      const configBtn = menu.querySelector('[data-permiso-cualquiera*="configuracion"]');
      if(configBtn) menu.insertBefore(btn, configBtn); else menu.appendChild(btn);
    }

    const main = document.querySelector('.main');
    if(!main) return;
    const section = document.createElement('section');
    section.className = 'screen';
    section.id = 'preatencion';
    section.innerHTML = `
      <div class="cardx p-4">
        <div class="section-head">
          <div>
            <h4><i class="bi bi-clipboard2-pulse me-2"></i>Preatención</h4>
            <p>Registro previo. No inicia una atención clínica.</p>
          </div>
          <button type="button" class="btn-line" id="preBtnActualizar"><i class="bi bi-arrow-clockwise me-1"></i> Actualizar</button>
        </div>

        <div class="mini-note mb-3"><i class="bi bi-shield-check me-1"></i>
          Los datos quedan pendientes por paciente. Cuando el médico inicia la atención, el sistema los vincula al nuevo <b>id_atencion</b> sin crear otra atención.
        </div>

        <div class="row g-3">
          <div class="col-md-8">
            <label class="form-label">Paciente *</label>
            <select id="prePaciente" class="form-select"><option value="">Cargando pacientes…</option></select>
          </div>
          <div class="col-md-4 d-flex align-items-end">
            <div id="preEstado" class="w-100 text-muted small fw-bold">Seleccione un paciente.</div>
          </div>
        </div>

        <div id="preSignos" class="mt-4" style="display:none">
          <h5 class="fw-bold mb-3">Signos vitales</h5>
          <div class="row g-3">
            <div class="col-md-3"><label class="form-label">Peso (kg)</label><input id="prePeso" class="form-control" inputmode="decimal"></div>
            <div class="col-md-3"><label class="form-label">Talla (cm)</label><input id="preTalla" class="form-control" inputmode="decimal"></div>
            <div class="col-md-3"><label class="form-label">PA sistólica</label><input id="prePAS" class="form-control" inputmode="numeric"></div>
            <div class="col-md-3"><label class="form-label">PA diastólica</label><input id="prePAD" class="form-control" inputmode="numeric"></div>
            <div class="col-md-3"><label class="form-label">Frecuencia cardiaca (lpm)</label><input id="preFC" class="form-control" inputmode="numeric"></div>
            <div class="col-md-3"><label class="form-label">Frecuencia respiratoria (rpm)</label><input id="preFR" class="form-control" inputmode="numeric"></div>
            <div class="col-md-3"><label class="form-label">Temperatura (°C)</label><input id="preTemp" class="form-control" inputmode="decimal"></div>
            <div class="col-md-3"><label class="form-label">Saturación O₂ (%)</label><input id="preSat" class="form-control" inputmode="numeric"></div>
          </div>
        </div>

        <div id="preAntecedentes" class="mt-4" style="display:none">
          <h5 class="fw-bold mb-2">Antecedentes referidos</h5>
          <p class="text-muted small">Información referida por el paciente antes de la consulta. No sustituye la validación médica.</p>
          <textarea id="preAntecedentesTexto" class="form-control" rows="5" placeholder="Registre únicamente lo referido por el paciente."></textarea>
        </div>

        <div class="d-flex justify-content-end mt-4">
          <button type="button" id="preGuardar" class="btn-auro"><i class="bi bi-save me-1"></i> Guardar preatención</button>
        </div>
      </div>`;
    main.appendChild(section);

    document.getElementById('preSignos').style.display = tiene('preconsulta_signos_vitales') || tiene('preconsulta') ? '' : 'none';
    document.getElementById('preAntecedentes').style.display = tiene('preconsulta_antecedentes_referidos') || tiene('preconsulta') ? '' : 'none';
    document.getElementById('prePaciente').addEventListener('change', cargarPendientePaciente);
    document.getElementById('preBtnActualizar').addEventListener('click', cargarPacientes);
    document.getElementById('preGuardar').addEventListener('click', guardar);
    cargarPacientes();

    const activaVisible = document.querySelector('.screen.active');
    const activaAutorizada = activaVisible && activaVisible.id !== 'dashboard';
    if(!activaAutorizada && typeof window.showScreen === 'function'){
      const boton = document.querySelector('.menu button[data-screen="preatencion"]');
      window.showScreen('preatencion', boton || null);
    }
  }

  function set(id,v){ const el=document.getElementById(id); if(el) el.value=v || ''; }
  function val(id){ return String(document.getElementById(id)?.value || '').trim(); }

  function limpiar(){
    ['prePeso','preTalla','prePAS','prePAD','preFC','preFR','preTemp','preSat','preAntecedentesTexto'].forEach(id => set(id,''));
  }

  async function cargarPacientes(){
    const sel = document.getElementById('prePaciente');
    if(!sel) return;
    const actual = sel.value;
    try{
      const lista = await get('listarPacientes');
      sel.innerHTML = '<option value="">Seleccione paciente</option>' + (Array.isArray(lista) ? lista : []).map(p => {
        const nombre = ((p.nombres || '') + ' ' + (p.apellidos || '')).trim();
        return '<option value="'+esc(p.id_paciente || '')+'">'+esc(nombre)+' · '+esc(p.numero_documento || '')+'</option>';
      }).join('');
      if(actual && [...sel.options].some(o => o.value === actual)) sel.value = actual;
    }catch(e){
      sel.innerHTML = '<option value="">Error cargando pacientes</option>';
    }
  }

  async function cargarPendientePaciente(){
    limpiar();
    const idPaciente = val('prePaciente');
    const estado = document.getElementById('preEstado');
    if(!idPaciente){ estado.textContent='Seleccione un paciente.'; return; }
    estado.textContent='Buscando preatención pendiente…';
    try{
      const r = await get('buscarPreatencionPendientePorPaciente',{id_paciente:idPaciente});
      if(!r || !r.id_preatencion){ estado.textContent='Sin preatención pendiente. Puede registrar ahora.'; return; }
      set('prePeso',r.peso_kg); set('preTalla',r.talla_cm);
      const pa = String(r.presion_arterial || '').match(/^(\d{2,3})\/(\d{2,3})$/);
      set('prePAS',pa ? pa[1] : ''); set('prePAD',pa ? pa[2] : '');
      set('preFC',r.frecuencia_cardiaca); set('preFR',r.frecuencia_respiratoria); set('preTemp',r.temperatura); set('preSat',r.saturacion);
      set('preAntecedentesTexto',r.antecedentes_referidos);
      estado.textContent='Preatención pendiente recuperada. Puede actualizarla.';
    }catch(e){ estado.textContent='No se pudo consultar la preatención.'; }
  }

  async function guardar(){
    const idPaciente = val('prePaciente');
    if(!idPaciente){ alert('Seleccione un paciente.'); return; }
    if(!tienePreatencion()){ alert('Su usuario no tiene permiso de Preatención.'); return; }
    const pas = val('prePAS').replace(/\D/g,'');
    const pad = val('prePAD').replace(/\D/g,'');
    if((pas && !pad) || (!pas && pad)){ alert('Complete presión sistólica y diastólica.'); return; }

    const usuario = typeof seguridad.obtenerUsuario === 'function' ? (seguridad.obtenerUsuario() || {}) : {};
    const data = {
      id_paciente:idPaciente,
      peso_kg:numero(val('prePeso')),
      talla_cm:numero(val('preTalla')),
      presion_arterial:pas && pad ? pas + '/' + pad : '',
      frecuencia_cardiaca:numero(val('preFC')),
      frecuencia_respiratoria:numero(val('preFR')),
      temperatura:numero(val('preTemp')),
      saturacion:numero(val('preSat')),
      antecedentes_referidos:val('preAntecedentesTexto'),
      creado_por:usuario.usuario || usuario.nombre_completo || 'Secretaría',
      token:typeof seguridad.obtenerToken === 'function' ? seguridad.obtenerToken() : ''
    };

    const btn=document.getElementById('preGuardar'); btn.disabled=true;
    try{
      const r=await post('guardarPreatencion',data);
      if(!r || r.success===false) throw new Error(r?.message || 'No se pudo guardar.');
      document.getElementById('preEstado').textContent='Preatención guardada y pendiente de vinculación con la próxima atención.';
      alert('Preatención guardada correctamente.');
    }catch(e){ alert(e.message || 'No se pudo guardar la preatención.'); }
    finally{ btn.disabled=false; }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inyectar, {once:true});
  else setTimeout(inyectar,0);
})();
