/* ==========================================================
   AUROSANAX ERP - PRECONSULTA CONFIGURABLE
   Versión: 1.0.0 · 2026-08-18

   OBJETIVO
   - Módulo independiente gobernado por permisos de usuario.
   - No depende del rol SECRETARIA/ENFERMERIA.
   - Puede registrar datos administrativos, signos vitales y
     antecedentes referidos según las casillas de Configuración.
   - Se vincula a la misma id_atencion cuando la atención existe.
   - En el Index médico muestra la preconsulta y permite aplicar
     signos vitales sin escribir Diagnóstico, Plan ni Receta.

   PERMISOS
   - preconsulta
   - preconsulta_datos_administrativos
   - preconsulta_signos_vitales
   - preconsulta_antecedentes_referidos

   CONTRATO BACKEND
   GET:
   - listarPacientesPreconsultaSegura
   - listarCitasPreconsultaSegura
   - buscarAtencionAbiertaPreconsultaSegura
   - buscarPreconsultaSegura
   POST:
   - guardarPreconsultaSegura
   - vincularPreconsultaAtencionSegura
   - validarPreconsultaMedicaSegura
   ========================================================== */
(function(){
  'use strict';

  const MODULO = 'AUROSANAX_PRECONSULTA_1_0_0';
  const PERMISO_BASE = 'preconsulta';
  const PERMISO_ADMIN = 'preconsulta_datos_administrativos';
  const PERMISO_VITALES = 'preconsulta_signos_vitales';
  const PERMISO_ANTECEDENTES = 'preconsulta_antecedentes_referidos';

  const state = {
    montadoOperativo:false,
    montadoMedico:false,
    pacientes:[],
    citas:[],
    idPreconsulta:'',
    idAtencion:'',
    idCita:'',
    idPaciente:'',
    registro:null,
    cargando:false
  };

  function el(id){ return document.getElementById(id); }
  function txt(v){ return String(v === null || v === undefined ? '' : v).trim(); }
  function esc(v){
    return txt(v)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }
  function num(v){
    const n = Number(txt(v).replace(',','.'));
    return Number.isFinite(n) ? n : null;
  }

  function seguridad(){ return window.AUROSANAX_SEGURIDAD || null; }
  function usuario(){
    const s = seguridad();
    return s && typeof s.obtenerUsuario === 'function' ? (s.obtenerUsuario() || {}) : {};
  }
  function token(){
    const s = seguridad();
    return s && typeof s.obtenerToken === 'function' ? txt(s.obtenerToken()) : '';
  }
  function tiene(clave){
    const s = seguridad();
    if(!s || typeof s.tienePermiso !== 'function') return false;
    return s.tienePermiso(clave, usuario()) === true;
  }

  function apiUrl(){
    try{
      if(typeof API_URL !== 'undefined' && API_URL) return txt(API_URL);
    }catch(_e){}
    return txt(window.API_URL || window.APP_SCRIPT_URL || '');
  }

  async function apiGet(accion, params){
    const api = apiUrl();
    if(!api) throw new Error('API_URL no está disponible.');

    const q = new URLSearchParams({accion:accion, t:String(Date.now())});
    q.set('token', token());
    Object.keys(params || {}).forEach(function(k){
      const v = params[k];
      if(v !== undefined && v !== null && txt(v) !== '') q.set(k, v);
    });

    const res = await fetch(api + '?' + q.toString());
    if(!res.ok) throw new Error('Error HTTP ' + res.status);
    const data = await res.json();
    if(data && data.success === false && data.message) throw new Error(data.message);
    return data;
  }

  async function apiPost(accion, data){
    const api = apiUrl();
    if(!api) throw new Error('API_URL no está disponible.');

    const payload = Object.assign({}, data || {}, {
      token: token()
    });

    const res = await fetch(api, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({accion:accion, data:payload})
    });

    if(!res.ok) throw new Error('Error HTTP ' + res.status);
    const r = await res.json();
    if(r && r.success === false && r.message) throw new Error(r.message);
    return r;
  }

  function fechaHoy(){
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth()+1).padStart(2,'0') + '-' +
      String(d.getDate()).padStart(2,'0');
  }

  function nombrePaciente(p){
    return txt([p && p.nombres, p && p.apellidos].filter(Boolean).join(' ')) ||
      txt(p && (p.nombre_paciente || p.nombre)) || 'Paciente';
  }

  function setMsg(mensaje, tipo){
    const box = el('auroPreconsultaMsg');
    if(!box) return;
    box.className = 'auro-preconsulta-msg ' + (tipo || 'info');
    box.textContent = mensaje || '';
  }

  function inyectarEstilos(){
    if(el('auroPreconsultaCSS')) return;
    const st = document.createElement('style');
    st.id = 'auroPreconsultaCSS';
    st.textContent = `
      #preconsulta.auro-preconsulta-screen{display:none}
      #preconsulta.auro-preconsulta-screen.active{display:block}
      .auro-preconsulta-shell{display:grid;gap:14px}
      .auro-preconsulta-head{background:linear-gradient(135deg,#fff,#fff7fb);border:1px solid #f3d5e5;border-radius:22px;padding:16px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
      .auro-preconsulta-head h4{margin:0;font-weight:900;color:#111827}
      .auro-preconsulta-head p{margin:4px 0 0;color:#64748b}
      .auro-preconsulta-badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:6px 10px;background:#fdf2f8;color:#8b1e5a;border:1px solid #fbcfe8;font-weight:850;font-size:12px}
      .auro-preconsulta-card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:16px;box-shadow:0 8px 24px rgba(15,23,42,.045)}
      .auro-preconsulta-card h5{margin:0 0 12px;font-size:16px;font-weight:900;color:#111827}
      .auro-preconsulta-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      .auro-preconsulta-grid.cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
      .auro-preconsulta-grid.cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}
      .auro-preconsulta-field label{display:block;font-size:12px;font-weight:850;color:#475569;margin-bottom:5px}
      .auro-preconsulta-field .form-control,.auro-preconsulta-field .form-select{min-height:42px}
      .auro-preconsulta-readonly{background:#f8fafc!important;color:#475569!important}
      .auro-preconsulta-summary{border:1px solid #f1d4e5;background:#fffafd;border-radius:16px;padding:12px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
      .auro-preconsulta-summary div{min-width:0}
      .auro-preconsulta-summary small{display:block;color:#64748b;font-weight:800;font-size:11px}
      .auro-preconsulta-summary b{display:block;color:#111827;font-size:13px;word-break:break-word}
      .auro-preconsulta-msg{border-radius:14px;padding:10px 12px;font-size:13px;font-weight:750}
      .auro-preconsulta-msg.info{background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af}
      .auro-preconsulta-msg.ok{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534}
      .auro-preconsulta-msg.warn{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412}
      .auro-preconsulta-msg.error{background:#fff1f2;border:1px solid #fecdd3;color:#be123c}
      .auro-preconsulta-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
      .auro-preconsulta-note{font-size:12px;color:#64748b;line-height:1.45;margin-top:8px}
      .auro-preconsulta-hidden{display:none!important}
      .auro-preconsulta-medico{border:1px solid #f1d4e5;background:linear-gradient(135deg,#fff,#fffafd);border-radius:18px;padding:14px;margin:0 0 16px;box-shadow:0 8px 24px rgba(139,30,90,.05)}
      .auro-preconsulta-medico-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px}
      .auro-preconsulta-medico-head b{font-size:15px;color:#7a174f}
      .auro-preconsulta-medico-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
      .auro-preconsulta-medico-item{border:1px solid #eef2f7;background:#fff;border-radius:13px;padding:9px;min-width:0}
      .auro-preconsulta-medico-item small{display:block;color:#64748b;font-size:10px;font-weight:850;text-transform:uppercase}
      .auro-preconsulta-medico-item strong{display:block;color:#111827;font-size:12px;word-break:break-word;margin-top:2px}
      .auro-preconsulta-medico-note{margin-top:10px;border-top:1px solid #f1f5f9;padding-top:10px;color:#475569;font-size:12px;line-height:1.45}
      @media(max-width:980px){
        .auro-preconsulta-grid,.auro-preconsulta-grid.cols-3{grid-template-columns:repeat(2,minmax(0,1fr))}
        .auro-preconsulta-summary,.auro-preconsulta-medico-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      }
      @media(max-width:560px){
        .auro-preconsulta-head{display:block}
        .auro-preconsulta-head .auro-preconsulta-badge{margin-top:10px}
        .auro-preconsulta-grid,.auro-preconsulta-grid.cols-2,.auro-preconsulta-grid.cols-3,.auro-preconsulta-summary,.auro-preconsulta-medico-grid{grid-template-columns:1fr}
        .auro-preconsulta-actions{display:grid;grid-template-columns:1fr}
        .auro-preconsulta-actions button{width:100%}
      }
    `;
    document.head.appendChild(st);
  }

  function htmlOperativo(){
    return `
      <div class="auro-preconsulta-shell">
        <div class="auro-preconsulta-head">
          <div>
            <h4><i class="bi bi-clipboard2-pulse me-2"></i>Preconsulta</h4>
            <p>Registro previo a la valoración médica. Los bloques visibles dependen de los permisos asignados en Configuración.</p>
          </div>
          <span class="auro-preconsulta-badge"><i class="bi bi-shield-check"></i> Configurable por usuario</span>
        </div>

        <div id="auroPreconsultaMsg" class="auro-preconsulta-msg info">Seleccione un paciente para comenzar.</div>

        <div class="auro-preconsulta-card">
          <h5>Paciente y contexto</h5>
          <div class="auro-preconsulta-grid cols-3">
            <div class="auro-preconsulta-field">
              <label>Buscar paciente</label>
              <input id="auroPreconsultaBuscarPaciente" class="form-control" placeholder="Nombre, documento o teléfono">
            </div>
            <div class="auro-preconsulta-field" style="grid-column:span 2">
              <label>Paciente *</label>
              <select id="auroPreconsultaPaciente" class="form-select"><option value="">Cargando pacientes...</option></select>
            </div>
            <div class="auro-preconsulta-field">
              <label>Cita relacionada</label>
              <select id="auroPreconsultaCita" class="form-select"><option value="">Sin cita seleccionada</option></select>
            </div>
            <div class="auro-preconsulta-field">
              <label>Atención clínica</label>
              <input id="auroPreconsultaAtencion" class="form-control auro-preconsulta-readonly" readonly value="Pendiente de vincular">
            </div>
            <div class="auro-preconsulta-field">
              <label>Estado</label>
              <input id="auroPreconsultaEstado" class="form-control auro-preconsulta-readonly" readonly value="Nueva">
            </div>
          </div>
          <div id="auroPreconsultaPacienteResumen" class="auro-preconsulta-summary mt-3" style="display:none"></div>
        </div>

        <div id="auroPreconsultaAdmin" class="auro-preconsulta-card">
          <h5><i class="bi bi-person-lines-fill me-1"></i> Datos administrativos y motivo referido</h5>
          <div class="auro-preconsulta-grid cols-3">
            <div class="auro-preconsulta-field" style="grid-column:1/-1">
              <label>Motivo referido por el paciente</label>
              <input id="auroPreMotivo" class="form-control" placeholder="Ej. Control, dolor pélvico, revisión de exámenes">
            </div>
            <div class="auro-preconsulta-field"><label>Teléfono</label><input id="auroPreTelefono" class="form-control"></div>
            <div class="auro-preconsulta-field"><label>WhatsApp</label><input id="auroPreWhatsapp" class="form-control"></div>
            <div class="auro-preconsulta-field"><label>Correo</label><input id="auroPreEmail" class="form-control" type="email"></div>
            <div class="auro-preconsulta-field" style="grid-column:span 2"><label>Dirección</label><input id="auroPreDireccion" class="form-control"></div>
            <div class="auro-preconsulta-field"><label>Aseguradora</label><input id="auroPreAseguradora" class="form-control"></div>
            <div class="auro-preconsulta-field"><label>N.º póliza</label><input id="auroPrePoliza" class="form-control"></div>
            <div class="auro-preconsulta-field"><label>Contacto de emergencia</label><input id="auroPreContactoEmergencia" class="form-control"></div>
            <div class="auro-preconsulta-field"><label>Teléfono de emergencia</label><input id="auroPreTelefonoEmergencia" class="form-control"></div>
          </div>
        </div>

        <div id="auroPreconsultaVitales" class="auro-preconsulta-card">
          <h5><i class="bi bi-heart-pulse me-1"></i> Signos vitales</h5>
          <div class="auro-preconsulta-grid">
            <div class="auro-preconsulta-field"><label>Peso (kg)</label><input id="auroPrePeso" class="form-control" inputmode="decimal" placeholder="Ej. 60.0"></div>
            <div class="auro-preconsulta-field"><label>Talla (cm)</label><input id="auroPreTalla" class="form-control" inputmode="decimal" placeholder="Ej. 160"></div>
            <div class="auro-preconsulta-field"><label>IMC</label><input id="auroPreIMC" class="form-control auro-preconsulta-readonly" readonly></div>
            <div class="auro-preconsulta-field"><label>Presión arterial</label><div class="d-flex gap-2"><input id="auroPrePAS" class="form-control" inputmode="numeric" maxlength="3" placeholder="120"><input id="auroPrePAD" class="form-control" inputmode="numeric" maxlength="3" placeholder="80"></div></div>
            <div class="auro-preconsulta-field"><label>FC (lpm)</label><input id="auroPreFC" class="form-control" inputmode="numeric" placeholder="80"></div>
            <div class="auro-preconsulta-field"><label>FR (rpm)</label><input id="auroPreFR" class="form-control" inputmode="numeric" placeholder="18"></div>
            <div class="auro-preconsulta-field"><label>Temperatura (°C)</label><input id="auroPreTemp" class="form-control" inputmode="decimal" placeholder="36.5"></div>
            <div class="auro-preconsulta-field"><label>SpO₂ (%)</label><input id="auroPreSpO2" class="form-control" inputmode="numeric" maxlength="3" placeholder="98"></div>
          </div>
          <div class="auro-preconsulta-note">Los signos vitales quedan identificados como tomados en Preconsulta y pendientes de revisión médica.</div>
        </div>

        <div id="auroPreconsultaAntecedentes" class="auro-preconsulta-card">
          <h5><i class="bi bi-journal-medical me-1"></i> Antecedentes referidos</h5>
          <div class="auro-preconsulta-grid cols-2">
            <div class="auro-preconsulta-field"><label>Alergias referidas</label><textarea id="auroPreAlergias" class="form-control" rows="3" placeholder="Registrar únicamente lo referido por el paciente"></textarea></div>
            <div class="auro-preconsulta-field"><label>Medicación actual referida</label><textarea id="auroPreMedicacion" class="form-control" rows="3" placeholder="Medicamento, dosis si la conoce y frecuencia referida"></textarea></div>
          </div>
          <div class="auro-preconsulta-note">No sustituye la validación de antecedentes realizada por el profesional médico.</div>
        </div>

        <div class="auro-preconsulta-card">
          <div class="auro-preconsulta-field">
            <label>Observaciones de preconsulta</label>
            <textarea id="auroPreObservaciones" class="form-control" rows="2" placeholder="Observación operativa o de toma de signos"></textarea>
          </div>
          <div class="auro-preconsulta-actions mt-3">
            <button type="button" class="btn-line" id="auroPreBtnLimpiar"><i class="bi bi-eraser me-1"></i> Nueva / limpiar</button>
            <button type="button" class="btn-auro" id="auroPreBtnGuardar"><i class="bi bi-save me-1"></i> Guardar preconsulta</button>
          </div>
        </div>
      </div>
    `;
  }

  function montarOperativo(){
    if(state.montadoOperativo) return true;
    if(!document.querySelector('.menu') || !document.querySelector('main.main')) return false;
    if(!el('screenTitle')) return false;

    inyectarEstilos();

    let nav = el('auroPreconsultaNav');
    if(!nav){
      nav = document.createElement('button');
      nav.id = 'auroPreconsultaNav';
      nav.type = 'button';
      nav.setAttribute('data-permiso', PERMISO_BASE);
      nav.innerHTML = '<i class="bi bi-clipboard2-pulse"></i> Preconsulta';
      nav.addEventListener('click', function(){ abrirOperativo(nav); });

      const menu = document.querySelector('.menu');
      const pacienteBtn = Array.from(menu.querySelectorAll('button')).find(function(b){
        return String(b.getAttribute('onclick') || '').includes("showScreen('pacientes'");
      });
      if(pacienteBtn && pacienteBtn.parentNode){
        pacienteBtn.insertAdjacentElement('afterend', nav);
      }else{
        menu.appendChild(nav);
      }
    }

    let sec = el('preconsulta');
    if(!sec){
      sec = document.createElement('section');
      sec.id = 'preconsulta';
      sec.className = 'screen auro-preconsulta-screen';
      sec.setAttribute('data-permiso', PERMISO_BASE);
      sec.innerHTML = htmlOperativo();

      const main = document.querySelector('main.main');
      const caja = el('caja');
      if(caja && caja.parentNode === main) main.insertBefore(sec, caja);
      else main.appendChild(sec);
    }

    enlazarOperativo();
    aplicarPermisosBloques();

    nav.style.display = tiene(PERMISO_BASE) ? '' : 'none';
    sec.style.display = tiene(PERMISO_BASE) ? '' : 'none';

    state.montadoOperativo = true;
    return true;
  }

  function aplicarPermisosBloques(){
    const admin = el('auroPreconsultaAdmin');
    const vitales = el('auroPreconsultaVitales');
    const ant = el('auroPreconsultaAntecedentes');

    if(admin) admin.classList.toggle('auro-preconsulta-hidden', !tiene(PERMISO_ADMIN));
    if(vitales) vitales.classList.toggle('auro-preconsulta-hidden', !tiene(PERMISO_VITALES));
    if(ant) ant.classList.toggle('auro-preconsulta-hidden', !tiene(PERMISO_ANTECEDENTES));
  }

  function puedeAbrirOperativo(){ return tiene(PERMISO_BASE); }

  function abrirOperativo(btn){
    if(!puedeAbrirOperativo()){
      alert('Su usuario no tiene permiso para Preconsulta.');
      return false;
    }

    montarOperativo();
    aplicarPermisosBloques();

    if(typeof window.showScreen === 'function'){
      window.showScreen('preconsulta', btn || el('auroPreconsultaNav'));
    }else{
      document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); });
      el('preconsulta')?.classList.add('active');
    }

    if(el('screenTitle')) el('screenTitle').textContent = 'Preconsulta';
    if(el('screenSubtitle')) el('screenSubtitle').textContent = 'Registro previo configurable por usuario y vinculado a la atención clínica.';

    try{
      if(window.location.hash !== '#preconsulta') history.replaceState(null,'','#preconsulta');
    }catch(_e){}

    if(!state.pacientes.length) cargarPacientes().catch(function(e){ setMsg(e.message || e,'error'); });
    return true;
  }

  function enlazarOperativo(){
    const buscar = el('auroPreconsultaBuscarPaciente');
    const select = el('auroPreconsultaPaciente');
    const cita = el('auroPreconsultaCita');
    const guardar = el('auroPreBtnGuardar');
    const limpiar = el('auroPreBtnLimpiar');

    if(buscar && buscar.dataset.auroInit !== '1'){
      buscar.dataset.auroInit = '1';
      buscar.addEventListener('input', renderSelectPacientes);
    }

    if(select && select.dataset.auroInit !== '1'){
      select.dataset.auroInit = '1';
      select.addEventListener('change', function(){
        seleccionarPaciente(select.value).catch(function(e){ setMsg(e.message || e,'error'); });
      });
    }

    if(cita && cita.dataset.auroInit !== '1'){
      cita.dataset.auroInit = '1';
      cita.addEventListener('change', function(){
        state.idCita = txt(cita.value);
        cargarPreconsultaExistente().catch(function(e){ setMsg(e.message || e,'error'); });
      });
    }

    ['auroPrePeso','auroPreTalla'].forEach(function(id){
      const x = el(id);
      if(x && x.dataset.auroInit !== '1'){
        x.dataset.auroInit = '1';
        x.addEventListener('input', calcularIMC);
      }
    });

    if(guardar && guardar.dataset.auroInit !== '1'){
      guardar.dataset.auroInit = '1';
      guardar.addEventListener('click', function(){ guardarPreconsulta().catch(function(e){ setMsg(e.message || e,'error'); }); });
    }

    if(limpiar && limpiar.dataset.auroInit !== '1'){
      limpiar.dataset.auroInit = '1';
      limpiar.addEventListener('click', limpiarFormulario);
    }
  }

  async function cargarPacientes(){
    if(!tiene(PERMISO_BASE)) return [];
    setMsg('Cargando pacientes autorizados para Preconsulta...','info');
    const r = await apiGet('listarPacientesPreconsultaSegura');
    state.pacientes = Array.isArray(r) ? r : (Array.isArray(r && r.data) ? r.data : []);
    renderSelectPacientes();
    setMsg('Seleccione un paciente para comenzar.','info');
    return state.pacientes;
  }

  function renderSelectPacientes(){
    const select = el('auroPreconsultaPaciente');
    if(!select) return;
    const q = txt(el('auroPreconsultaBuscarPaciente')?.value).toLowerCase();
    const actual = txt(select.value || state.idPaciente);

    const filtrados = state.pacientes.filter(function(p){
      if(!q) return true;
      return [p.nombres,p.apellidos,p.numero_documento,p.telefono,p.whatsapp]
        .map(txt).join(' ').toLowerCase().includes(q);
    }).slice(0,250);

    select.innerHTML = '<option value="">Seleccione paciente...</option>' + filtrados.map(function(p){
      const nombre = nombrePaciente(p);
      const doc = txt(p.numero_documento);
      return '<option value="'+esc(p.id_paciente)+'">'+esc(nombre + (doc ? ' · ' + doc : ''))+'</option>';
    }).join('');

    if(actual && filtrados.some(function(p){ return txt(p.id_paciente) === actual; })) select.value = actual;
  }

  function pacienteActual(){
    return state.pacientes.find(function(p){ return txt(p.id_paciente) === txt(state.idPaciente); }) || null;
  }

  function renderPacienteResumen(p){
    const box = el('auroPreconsultaPacienteResumen');
    if(!box) return;
    if(!p){ box.style.display='none'; box.innerHTML=''; return; }

    box.innerHTML = [
      ['Paciente', nombrePaciente(p)],
      ['Documento', txt(p.numero_documento) || '—'],
      ['Sexo', txt(p.sexo) || '—'],
      ['Nacimiento', txt(p.fecha_nacimiento).slice(0,10) || '—']
    ].map(function(par){
      return '<div><small>'+esc(par[0])+'</small><b>'+esc(par[1])+'</b></div>';
    }).join('');
    box.style.display = 'grid';
  }

  function llenarAdministrativosDesdePaciente(p){
    if(!p || !tiene(PERMISO_ADMIN)) return;
    const mapa = {
      auroPreTelefono:p.telefono,
      auroPreWhatsapp:p.whatsapp,
      auroPreEmail:p.email,
      auroPreDireccion:p.direccion,
      auroPreAseguradora:p.aseguradora,
      auroPrePoliza:p.numero_poliza,
      auroPreContactoEmergencia:p.contacto_emergencia,
      auroPreTelefonoEmergencia:p.telefono_emergencia
    };
    Object.keys(mapa).forEach(function(id){ if(el(id)) el(id).value = txt(mapa[id]); });
  }

  async function seleccionarPaciente(idPaciente){
    state.idPaciente = txt(idPaciente);
    state.idPreconsulta = '';
    state.idAtencion = '';
    state.idCita = '';
    state.registro = null;

    limpiarCampos(false);
    const p = pacienteActual();
    renderPacienteResumen(p);
    llenarAdministrativosDesdePaciente(p);

    if(!state.idPaciente){
      setMsg('Seleccione un paciente para comenzar.','info');
      return;
    }

    await Promise.all([
      cargarCitasPaciente(),
      detectarAtencionAbierta()
    ]);

    /* La cita puede resolverse desde la atención mientras el catálogo de citas
       todavía estaba cargando. Se sincroniza el selector una sola vez al terminar
       ambas lecturas para evitar una selección visual desfasada. */
    if(state.idCita && el('auroPreconsultaCita')){
      el('auroPreconsultaCita').value = state.idCita;
    }

    await cargarPreconsultaExistente();
  }

  async function cargarCitasPaciente(){
    const select = el('auroPreconsultaCita');
    if(select) select.innerHTML = '<option value="">Sin cita seleccionada</option>';
    if(!state.idPaciente) return;

    try{
      const r = await apiGet('listarCitasPreconsultaSegura', {id_paciente:state.idPaciente});
      state.citas = Array.isArray(r) ? r : (Array.isArray(r && r.data) ? r.data : []);

      if(select){
        select.innerHTML = '<option value="">Sin cita seleccionada</option>' + state.citas.map(function(c){
          const id = txt(c.id_cita || c.id);
          const fecha = txt(c.fecha_deseada || c.fecha_cita || c.fecha).slice(0,10);
          const hora = txt(c.hora_deseada || c.hora_inicio || c.hora).slice(0,5);
          const medico = txt(c.nombre_medico || c.id_medico);
          return '<option value="'+esc(id)+'">'+esc([fecha,hora,medico].filter(Boolean).join(' · '))+'</option>';
        }).join('');
      }
    }catch(e){
      console.warn(MODULO,'No se pudieron cargar citas del paciente.',e);
      state.citas = [];
    }
  }

  async function detectarAtencionAbierta(){
    if(!state.idPaciente) return;
    try{
      const r = await apiGet('buscarAtencionAbiertaPreconsultaSegura', {id_paciente:state.idPaciente});
      if(r && r.encontrada && r.atencion){
        state.idAtencion = txt(r.atencion.id_atencion);
        if(!state.idCita) state.idCita = txt(r.atencion.id_cita);
        if(el('auroPreconsultaAtencion')) el('auroPreconsultaAtencion').value = state.idAtencion || 'Pendiente de vincular';
        if(state.idCita && el('auroPreconsultaCita')) el('auroPreconsultaCita').value = state.idCita;
      }else{
        if(el('auroPreconsultaAtencion')) el('auroPreconsultaAtencion').value = 'Pendiente de vincular';
      }
    }catch(e){
      console.warn(MODULO,'No se pudo detectar atención abierta.',e);
    }
  }

  async function cargarPreconsultaExistente(){
    if(!state.idPaciente) return null;

    setMsg('Buscando preconsulta de hoy...','info');
    const r = await apiGet('buscarPreconsultaSegura', {
      id_atencion:state.idAtencion,
      id_cita:state.idCita,
      id_paciente:state.idPaciente,
      fecha:fechaHoy()
    });

    const registro = r && r.encontrada ? (r.preconsulta || r.data || null) : null;
    if(registro){
      cargarRegistro(registro);
      setMsg('Preconsulta existente cargada. Puede continuar y guardar los cambios autorizados.','ok');
      return registro;
    }

    state.idPreconsulta = '';
    state.registro = null;
    if(el('auroPreconsultaEstado')) el('auroPreconsultaEstado').value = 'Nueva';
    setMsg('No existe preconsulta de hoy para este paciente. Puede crearla.','info');
    return null;
  }

  function valor(id){ return txt(el(id)?.value); }

  function cargarRegistro(r){
    state.registro = r || null;
    state.idPreconsulta = txt(r && r.id_preconsulta);
    state.idAtencion = txt((r && r.id_atencion) || state.idAtencion);
    state.idCita = txt((r && r.id_cita) || state.idCita);

    if(el('auroPreconsultaAtencion')) el('auroPreconsultaAtencion').value = state.idAtencion || 'Pendiente de vincular';
    if(el('auroPreconsultaCita') && state.idCita) el('auroPreconsultaCita').value = state.idCita;
    if(el('auroPreconsultaEstado')) el('auroPreconsultaEstado').value = txt(r && r.estado) || 'COMPLETADA';

    if(tiene(PERMISO_ADMIN)){
      const m = {
        auroPreMotivo:r.motivo_referido,
        auroPreTelefono:r.telefono,
        auroPreWhatsapp:r.whatsapp,
        auroPreEmail:r.email,
        auroPreDireccion:r.direccion,
        auroPreAseguradora:r.aseguradora,
        auroPrePoliza:r.numero_poliza,
        auroPreContactoEmergencia:r.contacto_emergencia,
        auroPreTelefonoEmergencia:r.telefono_emergencia
      };
      Object.keys(m).forEach(function(id){ if(el(id)) el(id).value = txt(m[id]); });
    }

    if(tiene(PERMISO_VITALES)){
      if(el('auroPrePeso')) el('auroPrePeso').value = txt(r.peso_kg);
      if(el('auroPreTalla')) el('auroPreTalla').value = txt(r.talla_cm);
      if(el('auroPreIMC')) el('auroPreIMC').value = txt(r.imc);
      const pa = txt(r.presion_arterial).match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
      if(el('auroPrePAS')) el('auroPrePAS').value = pa ? pa[1] : '';
      if(el('auroPrePAD')) el('auroPrePAD').value = pa ? pa[2] : '';
      if(el('auroPreFC')) el('auroPreFC').value = txt(r.frecuencia_cardiaca);
      if(el('auroPreFR')) el('auroPreFR').value = txt(r.frecuencia_respiratoria);
      if(el('auroPreTemp')) el('auroPreTemp').value = txt(r.temperatura);
      if(el('auroPreSpO2')) el('auroPreSpO2').value = txt(r.saturacion);
      calcularIMC();
    }

    if(tiene(PERMISO_ANTECEDENTES)){
      if(el('auroPreAlergias')) el('auroPreAlergias').value = txt(r.alergias_referidas);
      if(el('auroPreMedicacion')) el('auroPreMedicacion').value = txt(r.medicacion_referida);
    }

    if(el('auroPreObservaciones')) el('auroPreObservaciones').value = txt(r.observaciones);
  }

  function calcularIMC(){
    const p = num(valor('auroPrePeso'));
    const tcm = num(valor('auroPreTalla'));
    const out = el('auroPreIMC');
    if(!out) return '';
    if(!(p > 0) || !(tcm > 0)){ out.value=''; return ''; }
    const t = tcm / 100;
    const imc = p / (t*t);
    out.value = Number.isFinite(imc) ? imc.toFixed(1) : '';
    return out.value;
  }

  function validarRango(id, etiqueta, min, max, opcional){
    const raw = valor(id);
    if(!raw) return opcional ? null : null;
    const n = num(raw);
    if(n === null || n < min || n > max){
      throw new Error(etiqueta + ' tiene un valor fuera del rango admisible (' + min + '–' + max + ').');
    }
    return n;
  }

  function payloadVitales(){
    if(!tiene(PERMISO_VITALES)) return null;

    const peso = validarRango('auroPrePeso','Peso',1,400,true);
    const talla = validarRango('auroPreTalla','Talla',30,250,true);
    const pas = validarRango('auroPrePAS','Presión sistólica',40,300,true);
    const pad = validarRango('auroPrePAD','Presión diastólica',20,200,true);
    const fc = validarRango('auroPreFC','Frecuencia cardíaca',20,300,true);
    const fr = validarRango('auroPreFR','Frecuencia respiratoria',5,100,true);
    const temp = validarRango('auroPreTemp','Temperatura',30,45,true);
    const spo2 = validarRango('auroPreSpO2','Saturación',40,100,true);

    if((pas === null) !== (pad === null)){
      throw new Error('Ingrese tanto la presión sistólica como la diastólica.');
    }

    return {
      peso_kg:peso === null ? '' : peso,
      talla_cm:talla === null ? '' : talla,
      imc:calcularIMC(),
      presion_arterial:pas !== null && pad !== null ? pas + '/' + pad : '',
      frecuencia_cardiaca:fc === null ? '' : fc,
      frecuencia_respiratoria:fr === null ? '' : fr,
      temperatura:temp === null ? '' : temp,
      saturacion:spo2 === null ? '' : spo2
    };
  }

  function payloadAdmin(){
    if(!tiene(PERMISO_ADMIN)) return null;
    return {
      motivo_referido:valor('auroPreMotivo'),
      telefono:valor('auroPreTelefono'),
      whatsapp:valor('auroPreWhatsapp'),
      email:valor('auroPreEmail'),
      direccion:valor('auroPreDireccion'),
      aseguradora:valor('auroPreAseguradora'),
      numero_poliza:valor('auroPrePoliza'),
      contacto_emergencia:valor('auroPreContactoEmergencia'),
      telefono_emergencia:valor('auroPreTelefonoEmergencia')
    };
  }

  function payloadAntecedentes(){
    if(!tiene(PERMISO_ANTECEDENTES)) return null;
    return {
      alergias_referidas:valor('auroPreAlergias'),
      medicacion_referida:valor('auroPreMedicacion')
    };
  }

  async function guardarPreconsulta(){
    if(state.cargando) return;
    if(!tiene(PERMISO_BASE)) throw new Error('No tiene permiso para Preconsulta.');
    if(!state.idPaciente) throw new Error('Seleccione un paciente.');

    if(!tiene(PERMISO_ADMIN) && !tiene(PERMISO_VITALES) && !tiene(PERMISO_ANTECEDENTES)){
      throw new Error('Su usuario tiene acceso a Preconsulta, pero no tiene ningún bloque de captura habilitado.');
    }

    const btn = el('auroPreBtnGuardar');
    const original = btn ? btn.innerHTML : '';
    state.cargando = true;
    if(btn){ btn.disabled = true; btn.innerHTML = '<i class="bi bi-arrow-clockwise me-1"></i> Guardando...'; }
    setMsg('Guardando preconsulta con trazabilidad de usuario...','info');

    try{
      const payload = {
        id_preconsulta:state.idPreconsulta,
        id_paciente:state.idPaciente,
        id_cita:txt(el('auroPreconsultaCita')?.value || state.idCita),
        id_atencion:state.idAtencion,
        estado:'COMPLETADA',
        observaciones:valor('auroPreObservaciones')
      };

      const admin = payloadAdmin();
      const vitales = payloadVitales();
      const antecedentes = payloadAntecedentes();
      if(admin) payload.datos_administrativos = admin;
      if(vitales) payload.signos_vitales = vitales;
      if(antecedentes) payload.antecedentes_referidos = antecedentes;

      const r = await apiPost('guardarPreconsultaSegura', payload);
      if(!r || r.success !== true) throw new Error((r && r.message) || 'No se pudo guardar la preconsulta.');

      state.idPreconsulta = txt(r.id_preconsulta || r.id);
      state.idAtencion = txt(r.id_atencion || state.idAtencion);
      if(el('auroPreconsultaAtencion')) el('auroPreconsultaAtencion').value = state.idAtencion || 'Pendiente de vincular';
      if(el('auroPreconsultaEstado')) el('auroPreconsultaEstado').value = 'COMPLETADA';
      setMsg('Preconsulta guardada correctamente. La doctora podrá verla al abrir la atención correspondiente.','ok');

      await cargarPreconsultaExistente();
    }finally{
      state.cargando = false;
      if(btn){ btn.disabled = false; btn.innerHTML = original; }
    }
  }

  function limpiarCampos(conservarPaciente){
    const ids = [
      'auroPreMotivo','auroPreTelefono','auroPreWhatsapp','auroPreEmail','auroPreDireccion',
      'auroPreAseguradora','auroPrePoliza','auroPreContactoEmergencia','auroPreTelefonoEmergencia',
      'auroPrePeso','auroPreTalla','auroPreIMC','auroPrePAS','auroPrePAD','auroPreFC','auroPreFR',
      'auroPreTemp','auroPreSpO2','auroPreAlergias','auroPreMedicacion','auroPreObservaciones'
    ];
    ids.forEach(function(id){ if(el(id)) el(id).value=''; });
    if(!conservarPaciente){
      if(el('auroPreconsultaCita')) el('auroPreconsultaCita').innerHTML='<option value="">Sin cita seleccionada</option>';
    }
  }

  function limpiarFormulario(){
    state.idPreconsulta='';
    state.idAtencion='';
    state.idCita='';
    state.registro=null;
    limpiarCampos(true);
    llenarAdministrativosDesdePaciente(pacienteActual());
    if(el('auroPreconsultaAtencion')) el('auroPreconsultaAtencion').value='Pendiente de vincular';
    if(el('auroPreconsultaEstado')) el('auroPreconsultaEstado').value='Nueva';
    setMsg(state.idPaciente ? 'Formulario limpio para una nueva preconsulta del paciente seleccionado.' : 'Seleccione un paciente para comenzar.','info');
  }

  /* ===================== INTEGRACIÓN MÉDICA ===================== */

  function montarMedico(){
    if(state.montadoMedico) return true;
    const panel = el('hc_examen');
    if(!panel) return false;

    inyectarEstilos();

    let box = el('auroPreconsultaMedicoBox');
    if(!box){
      box = document.createElement('div');
      box.id = 'auroPreconsultaMedicoBox';
      box.className = 'auro-preconsulta-medico';
      box.style.display = 'none';

      const titulo = panel.querySelector('.clinical-subtitle');
      if(titulo && titulo.nextSibling) titulo.parentNode.insertBefore(box, titulo.nextSibling);
      else panel.insertBefore(box, panel.firstChild);
    }

    state.montadoMedico = true;
    return true;
  }

  function datoMedico(label, valor){
    if(!txt(valor)) return '';
    return '<div class="auro-preconsulta-medico-item"><small>'+esc(label)+'</small><strong>'+esc(valor)+'</strong></div>';
  }

  function renderMedico(r){
    montarMedico();
    const box = el('auroPreconsultaMedicoBox');
    if(!box) return;

    if(!r){
      box.style.display='none';
      box.innerHTML='';
      return;
    }

    const actor = txt(r.nombre_usuario_registro || r.usuario_registro || r.rol_registro);
    const fecha = [txt(r.fecha_preconsulta), txt(r.hora_preconsulta)].filter(Boolean).join(' ');
    const estado = txt(r.estado || 'COMPLETADA');

    const vitales = [
      datoMedico('Peso', r.peso_kg ? r.peso_kg + ' kg' : ''),
      datoMedico('Talla', r.talla_cm ? r.talla_cm + ' cm' : ''),
      datoMedico('IMC', r.imc),
      datoMedico('PA', r.presion_arterial),
      datoMedico('FC', r.frecuencia_cardiaca ? r.frecuencia_cardiaca + ' lpm' : ''),
      datoMedico('FR', r.frecuencia_respiratoria ? r.frecuencia_respiratoria + ' rpm' : ''),
      datoMedico('Temperatura', r.temperatura ? r.temperatura + ' °C' : ''),
      datoMedico('SpO₂', r.saturacion ? r.saturacion + ' %' : '')
    ].filter(Boolean).join('');

    const referencias = [
      r.motivo_referido ? '<b>Motivo referido:</b> '+esc(r.motivo_referido) : '',
      r.alergias_referidas ? '<b>Alergias referidas:</b> '+esc(r.alergias_referidas) : '',
      r.medicacion_referida ? '<b>Medicación referida:</b> '+esc(r.medicacion_referida) : '',
      r.observaciones ? '<b>Observaciones:</b> '+esc(r.observaciones) : ''
    ].filter(Boolean).join('<br>');

    box.innerHTML =
      '<div class="auro-preconsulta-medico-head">' +
        '<div><b><i class="bi bi-clipboard2-pulse me-1"></i> Preconsulta registrada</b>' +
          '<div class="text-muted small">'+esc([actor,fecha].filter(Boolean).join(' · '))+'</div></div>' +
        '<span class="auro-preconsulta-badge">'+esc(estado)+'</span>' +
      '</div>' +
      (vitales ? '<div class="auro-preconsulta-medico-grid">'+vitales+'</div>' : '<div class="text-muted small">Sin signos vitales registrados.</div>') +
      (referencias ? '<div class="auro-preconsulta-medico-note">'+referencias+'</div>' : '') +
      '<div class="auro-preconsulta-actions mt-3">' +
        '<button type="button" class="btn-soft" id="auroPreBtnAplicarMedico"><i class="bi bi-check2-circle me-1"></i> Validar y aplicar signos vitales</button>' +
      '</div>' +
      '<div class="auro-preconsulta-note">Alergias y medicación permanecen como información referida hasta que el profesional las confirme en Antecedentes.</div>';

    box.style.display='block';

    const btn = el('auroPreBtnAplicarMedico');
    if(btn){
      const permitido = tiene('historia_clinica') || txt(usuario().rol).toUpperCase() === 'ADMINISTRADOR';
      btn.style.display = permitido ? '' : 'none';
      btn.addEventListener('click', function(){ aplicarMedico(r).catch(function(e){ alert(e.message || e); }); }, {once:true});
    }
  }

  function camposVitalesDestinoConDatos(){
    return ['hcPeso','hcTalla','hcPA','hcFC','hcFR','hcTemperatura','hcSaturacion']
      .some(function(id){ return txt(el(id)?.value); });
  }

  function setInput(id, valor){
    const x = el(id);
    if(x && valor !== undefined && valor !== null) x.value = txt(valor);
  }

  async function aplicarMedico(r){
    if(!r) return;
    if(!(tiene('historia_clinica') || txt(usuario().rol).toUpperCase() === 'ADMINISTRADOR')){
      throw new Error('Su usuario no tiene autorización clínica para validar la Preconsulta.');
    }

    if(camposVitalesDestinoConDatos()){
      const ok = confirm('La atención ya contiene uno o más signos vitales. ¿Desea reemplazarlos con los valores registrados en Preconsulta?');
      if(!ok) return;
    }

    setInput('hcPeso', r.peso_kg);
    setInput('hcTalla', r.talla_cm);
    setInput('hcPA', r.presion_arterial);
    setInput('hcFC', r.frecuencia_cardiaca);
    setInput('hcFR', r.frecuencia_respiratoria);
    setInput('hcTemperatura', r.temperatura);
    setInput('hcSaturacion', r.saturacion);

    try{ if(typeof window.auroPASincronizarDesdeCompatibilidad === 'function') window.auroPASincronizarDesdeCompatibilidad(); }catch(_e){}
    try{ if(typeof window.auroPAActualizarPresentacion === 'function') window.auroPAActualizarPresentacion(); }catch(_e){}
    try{ if(typeof window.calcIMC === 'function') window.calcIMC(); }catch(_e){}
    try{ if(typeof window.auroActualizarApoyoSignosVitales === 'function') window.auroActualizarApoyoSignosVitales(); }catch(_e){}

    const idAtencion = txt(r.id_atencion || (typeof window.getIdAtencionActiva === 'function' ? window.getIdAtencionActiva() : ''));
    await apiPost('validarPreconsultaMedicaSegura', {
      id_preconsulta:r.id_preconsulta,
      id_atencion:idAtencion
    });

    const actualizado = Object.assign({}, r, {estado:'VALIDADA'});
    state.registro = actualizado;
    renderMedico(actualizado);
    alert('Signos vitales aplicados al Examen físico. Revise los datos y guarde el Examen físico con el flujo habitual.');
  }

  async function vincularYMostrarAtencion(detalle){
    detalle = detalle || {};
    const idAtencion = txt(detalle.id_atencion);
    const idPaciente = txt(detalle.id_paciente);
    if(!idAtencion || !idPaciente) return;

    try{
      await apiPost('vincularPreconsultaAtencionSegura', {
        id_atencion:idAtencion,
        id_paciente:idPaciente,
        id_cita:txt(detalle.id_cita)
      });
    }catch(e){
      console.warn(MODULO,'No se pudo vincular automáticamente la Preconsulta.',e);
    }

    try{
      const r = await apiGet('buscarPreconsultaSegura', {
        id_atencion:idAtencion,
        id_paciente:idPaciente,
        id_cita:txt(detalle.id_cita)
      });
      renderMedico(r && r.encontrada ? (r.preconsulta || r.data || null) : null);
    }catch(e){
      console.warn(MODULO,'No se pudo cargar la Preconsulta en la atención.',e);
      renderMedico(null);
    }
  }

  function instalarEventosClinicos(){
    window.addEventListener('aurosanax:atencion-seleccionada', function(e){
      vincularYMostrarAtencion((e && e.detail) || {}).catch(function(err){ console.warn(MODULO,err); });
    });
    window.addEventListener('aurosanax:atencion-iniciada', function(e){
      vincularYMostrarAtencion((e && e.detail) || {}).catch(function(err){ console.warn(MODULO,err); });
    });
    window.addEventListener('aurosanax:atencion-limpiada', function(){ renderMedico(null); });
  }

  function init(){
    inyectarEstilos();
    montarOperativo();
    montarMedico();
    instalarEventosClinicos();

    setTimeout(function(){
      aplicarPermisosBloques();
      const nav = el('auroPreconsultaNav');
      if(nav) nav.style.display = tiene(PERMISO_BASE) ? '' : 'none';

      if(window.location.hash === '#preconsulta' && tiene(PERMISO_BASE)){
        abrirOperativo(nav);
      }
    }, 80);
  }

  window.AUROSANAX_PRECONSULTA = Object.freeze({
    version:'1.0.0',
    abrir:abrirOperativo,
    montar:montarOperativo,
    refrescarPermisos:aplicarPermisosBloques,
    cargarPaciente:seleccionarPaciente,
    vincularYMostrarAtencion:vincularYMostrarAtencion,
    estado:state
  });

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();

  console.info(MODULO + ' cargado.');
})();
