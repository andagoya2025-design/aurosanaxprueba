/***********************************************************************
 AUROSANAX ERP DEMO
 Archivo: auditoria_clinica.js
 Módulo: Auditoría clínica independiente
 Versión: 1.0.0
 -----------------------------------------------------------------------
 OBJETIVO
 - Consultar en modo SOLO LECTURA la hoja auditoria_clinica.
 - Mantener esta auditoría separada de seguridad.js y de la bitácora
   administrativa de accesos/usuarios.
 - Mostrar cambios de Diagnóstico, Plan clínico y Recetas.
 - Clasificar visualmente la referencia de 24 horas sin modificar ni
   bloquear el flujo clínico existente.
 - Acceso exclusivo para Administrador; el backend vuelve a validar token.
************************************************************************/

(function(){
  'use strict';

  const MODULO = 'AUROSANAX AUDITORÍA CLÍNICA';
  const state = {
    preparado: false,
    cargando: false,
    cargado: false,
    eventos: [],
    filtrados: []
  };

  function texto(valor){
    return String(valor === null || valor === undefined ? '' : valor).trim();
  }

  function normalizar(valor){
    return texto(valor)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .toUpperCase();
  }

  function escapar(valor){
    return String(valor === null || valor === undefined ? '' : valor)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function apiUrl(){
    try{
      if(typeof API_URL !== 'undefined' && API_URL) return texto(API_URL);
    }catch(_e){}
    return texto(window.API_URL || '');
  }

  function seguridad(){
    return window.AUROSANAX_SEGURIDAD || null;
  }

  function usuarioActual(){
    const seg = seguridad();
    if(!seg || typeof seg.obtenerUsuario !== 'function') return {};
    return seg.obtenerUsuario() || {};
  }

  function esAdministrador(){
    const u = usuarioActual();
    return normalizar(u.rol || u.nombre_rol || u.perfil || u.tipo_usuario) === 'ADMINISTRADOR';
  }

  function tokenActual(){
    const seg = seguridad();
    if(!seg || typeof seg.obtenerToken !== 'function') return '';
    return texto(seg.obtenerToken());
  }

  function instalarEstilos(){
    if(document.getElementById('auroAuditoriaClinicaStyles')) return;
    const style = document.createElement('style');
    style.id = 'auroAuditoriaClinicaStyles';
    style.textContent = `
      #securityAuditoriaClinica .auro-audit-badge{
        display:inline-flex;align-items:center;justify-content:center;
        border-radius:999px;padding:6px 9px;font-size:11px;font-weight:900;
        white-space:nowrap;border:1px solid transparent;
      }
      #securityAuditoriaClinica .auro-audit-module{background:#fdf2f8;color:#8b1e5a;border-color:#f4c7dc}
      #securityAuditoriaClinica .auro-audit-action{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe}
      #securityAuditoriaClinica .auro-audit-24-si{background:#dcfce7;color:#166534;border-color:#bbf7d0}
      #securityAuditoriaClinica .auro-audit-24-no{background:#fff1f2;color:#be123c;border-color:#fecdd3}
      #securityAuditoriaClinica .auro-audit-24-open{background:#fef3c7;color:#92400e;border-color:#fde68a}
      #securityAuditoriaClinica .auro-audit-24-na{background:#f1f5f9;color:#475569;border-color:#e2e8f0}
      #securityAuditoriaClinica .auro-audit-person{font-weight:850;color:#111827}
      #securityAuditoriaClinica .auro-audit-sub{font-size:12px;color:#64748b;font-weight:700;margin-top:2px}
      #securityAuditoriaClinica .auro-audit-detail-btn{min-width:38px}
      #securityAuditoriaClinica .auro-audit-mobile-card{border-left:4px solid #c23b83!important}
      .auro-audit-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .auro-audit-detail-box{border:1px solid #e5e7eb;border-radius:16px;padding:12px;background:#f8fafc;min-width:0}
      .auro-audit-detail-box h6{font-weight:900;margin:0 0 8px;color:#334155}
      .auro-audit-detail-box pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.45;max-height:360px;overflow:auto;color:#0f172a}
      .auro-audit-meta{border:1px solid #f1d4e5;background:#fff7fb;border-radius:16px;padding:12px;margin-bottom:12px;font-size:13px;line-height:1.55}
      @media(max-width:720px){.auro-audit-detail-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function setTexto(id, valor){
    const el = document.getElementById(id);
    if(el) el.textContent = valor;
  }

  function setEstado(mensaje, error){
    const el = document.getElementById('audClinEstado');
    if(!el) return;
    el.innerHTML = (error ? '<i class="bi bi-exclamation-triangle me-1"></i>' : '<i class="bi bi-shield-check me-1"></i>') + escapar(mensaje || '');
    el.style.background = error ? '#fff1f2' : '';
    el.style.borderColor = error ? '#fecdd3' : '';
    el.style.color = error ? '#be123c' : '';
  }

  function fechaISO(valor){
    const raw = texto(valor);
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
  }

  function formatearFechaHora(valor){
    const raw = texto(valor);
    if(!raw) return '—';

    const local = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if(local){
      return `${local[3]}/${local[2]}/${local[1]} ${local[4]}:${local[5]}`;
    }

    const fecha = new Date(raw);
    if(isNaN(fecha.getTime())) return raw;

    return new Intl.DateTimeFormat('es-EC', {
      timeZone:'America/Guayaquil',
      year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',hour12:false
    }).format(fecha);
  }

  function nombreModulo(valor){
    const n = normalizar(valor);
    if(n === 'DIAGNOSTICO') return 'Diagnóstico';
    if(n === 'PLAN') return 'Plan clínico';
    if(n === 'RECETA') return 'Receta';
    return texto(valor) || '—';
  }

  function nombreAccion(valor){
    const n = normalizar(valor);
    if(n === 'REGISTRO') return 'Registro';
    if(n === 'EMISION') return 'Emisión';
    if(n === 'CORRECCION') return 'Corrección';
    return texto(valor) || '—';
  }

  function ventanaHTML(evento){
    const v = normalizar(evento && evento.dentro_24h);
    const horas = texto(evento && evento.horas_desde_referencia);

    if(v === 'SI'){
      return `<span class="auro-audit-badge auro-audit-24-si">Dentro de 24 h${horas ? ' · '+escapar(horas)+' h' : ''}</span>`;
    }
    if(v === 'NO'){
      return `<span class="auro-audit-badge auro-audit-24-no">Fuera de 24 h${horas ? ' · '+escapar(horas)+' h' : ''}</span>`;
    }
    if(v === 'ABIERTA'){
      return '<span class="auro-audit-badge auro-audit-24-open">Atención abierta</span>';
    }
    return '<span class="auro-audit-badge auro-audit-24-na">No aplica</span>';
  }

  function actorHTML(evento){
    const medico = texto(evento && evento.nombre_medico);
    const usuario = texto(evento && evento.usuario);
    const rol = texto(evento && evento.rol);
    const principal = medico || usuario || 'Sin actor identificado';
    const secundario = usuario && usuario !== medico
      ? usuario + (rol ? ' · '+rol : '')
      : (rol || '');

    return `<div class="auro-audit-person">${escapar(principal)}</div>${secundario ? `<div class="auro-audit-sub">${escapar(secundario)}</div>` : ''}`;
  }

  function coincideFiltros(evento){
    const desde = texto(document.getElementById('audClinDesde')?.value);
    const hasta = texto(document.getElementById('audClinHasta')?.value);
    const modulo = normalizar(document.getElementById('audClinModulo')?.value);
    const accion = normalizar(document.getElementById('audClinAccion')?.value);
    const q = normalizar(document.getElementById('audClinBuscar')?.value);
    const fecha = fechaISO(evento.fecha_hora || evento.creado_en);

    if(desde && fecha && fecha < desde) return false;
    if(hasta && fecha && fecha > hasta) return false;
    if(modulo && normalizar(evento.modulo) !== modulo) return false;
    if(accion && normalizar(evento.accion) !== accion) return false;

    if(q){
      const bolsa = normalizar([
        evento.id_auditoria,
        evento.id_paciente,
        evento.nombre_paciente,
        evento.id_atencion,
        evento.numero_consulta,
        evento.id_registro,
        evento.id_receta,
        evento.id_plan,
        evento.id_diagnostico,
        evento.codigo_cie10,
        evento.id_medico,
        evento.nombre_medico,
        evento.id_usuario,
        evento.usuario,
        evento.rol,
        evento.modulo,
        evento.accion,
        evento.motivo
      ].join(' '));
      if(!bolsa.includes(q)) return false;
    }
    return true;
  }

  function actualizarResumen(){
    const lista = state.filtrados;
    setTexto('audClinTotal', String(lista.length));
    setTexto('audClinDentro24', String(lista.filter(e => normalizar(e.dentro_24h) === 'SI').length));
    setTexto('audClinFuera24', String(lista.filter(e => normalizar(e.dentro_24h) === 'NO').length));
    setTexto('audClinUltimo', lista.length ? formatearFechaHora(lista[0].fecha_hora || lista[0].creado_en) : '—');
  }

  function render(){
    state.filtrados = state.eventos.filter(coincideFiltros);
    actualizarResumen();

    const body = document.getElementById('audClinBody');
    const mobile = document.getElementById('audClinMobile');

    if(!state.filtrados.length){
      const vacio = '<i class="bi bi-clipboard2-check"></i>No existen eventos clínicos para los filtros seleccionados.';
      if(body) body.innerHTML = `<tr><td colspan="8" class="security-empty">${vacio}</td></tr>`;
      if(mobile) mobile.innerHTML = `<div class="mobile-card security-empty">${vacio}</div>`;
      return;
    }

    if(body){
      body.innerHTML = state.filtrados.map(function(e, index){
        return `
          <tr>
            <td>${escapar(formatearFechaHora(e.fecha_hora || e.creado_en))}</td>
            <td><div class="auro-audit-person">${escapar(e.nombre_paciente || '—')}</div><div class="auro-audit-sub">${escapar(e.id_paciente || '')}</div></td>
            <td>${escapar(e.numero_consulta || '—')}<div class="auro-audit-sub">${escapar(e.id_atencion || '')}</div></td>
            <td><span class="auro-audit-badge auro-audit-module">${escapar(nombreModulo(e.modulo))}</span></td>
            <td><span class="auro-audit-badge auro-audit-action">${escapar(nombreAccion(e.accion))}</span></td>
            <td>${actorHTML(e)}</td>
            <td>${ventanaHTML(e)}</td>
            <td><button type="button" class="btn-line btn-sm auro-audit-detail-btn" onclick="window.auroAuditoriaClinica.verDetalle(${index})" title="Ver detalle"><i class="bi bi-search"></i></button></td>
          </tr>`;
      }).join('');
    }

    if(mobile){
      mobile.innerHTML = state.filtrados.map(function(e, index){
        return `
          <div class="mobile-card auro-audit-mobile-card">
            <b>${escapar(nombreModulo(e.modulo))} · ${escapar(nombreAccion(e.accion))}</b>
            <div class="line"><span>Fecha</span><span>${escapar(formatearFechaHora(e.fecha_hora || e.creado_en))}</span></div>
            <div class="line"><span>Paciente</span><span>${escapar(e.nombre_paciente || '—')}</span></div>
            <div class="line"><span>Consulta</span><span>${escapar(e.numero_consulta || '—')}</span></div>
            <div class="line"><span>Médico / usuario</span><span>${escapar(e.nombre_medico || e.usuario || '—')}</span></div>
            <div class="line"><span>Ventana</span><span>${ventanaHTML(e)}</span></div>
            <button type="button" class="btn-line w-100 mt-2" onclick="window.auroAuditoriaClinica.verDetalle(${index})"><i class="bi bi-search me-1"></i> Ver detalle</button>
          </div>`;
      }).join('');
    }
  }

  function jsonLegible(valor){
    const raw = texto(valor);
    if(!raw) return 'Sin información.';
    try{
      return JSON.stringify(JSON.parse(raw), null, 2);
    }catch(_e){
      return raw;
    }
  }

  function verDetalle(index){
    const e = state.filtrados[Number(index)];
    if(!e) return;

    const modal = document.getElementById('modalConfig');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    if(!modal || !title || !body) return;

    title.textContent = 'Detalle de auditoría clínica';
    body.innerHTML = `
      <div class="auro-audit-meta">
        <b>${escapar(nombreModulo(e.modulo))} · ${escapar(nombreAccion(e.accion))}</b><br>
        Paciente: ${escapar(e.nombre_paciente || '—')} · Consulta: ${escapar(e.numero_consulta || '—')}<br>
        Fecha: ${escapar(formatearFechaHora(e.fecha_hora || e.creado_en))}<br>
        Actor: ${escapar(e.nombre_medico || e.usuario || '—')}<br>
        Motivo: ${escapar(e.motivo || '—')}<br>
        Ventana: ${escapar(e.dentro_24h || 'NO_APLICA')}${texto(e.horas_desde_referencia) ? ' · '+escapar(e.horas_desde_referencia)+' h' : ''}
      </div>
      <div class="auro-audit-detail-grid">
        <div class="auro-audit-detail-box"><h6>Valor anterior</h6><pre>${escapar(jsonLegible(e.valor_anterior))}</pre></div>
        <div class="auro-audit-detail-box"><h6>Valor nuevo</h6><pre>${escapar(jsonLegible(e.valor_nuevo))}</pre></div>
      </div>`;
    modal.classList.add('show');
  }

  async function cargar(forzar){
    if(state.cargando) return;
    if(state.cargado && !forzar){ render(); return; }

    if(!esAdministrador()){
      setEstado('Acceso reservado para Administrador.', true);
      return;
    }

    const API = apiUrl();
    const token = tokenActual();
    if(!API || !token){
      setEstado('No existe una sesión administrativa válida para consultar la auditoría.', true);
      return;
    }

    state.cargando = true;
    setEstado('Cargando auditoría clínica…', false);

    try{
      const q = new URLSearchParams({
        accion:'listarAuditoriaClinicaSegura',
        token:token,
        t:String(Date.now())
      });
      const respuesta = await fetch(API + '?' + q.toString(), {cache:'no-store'});
      if(!respuesta.ok) throw new Error('Error HTTP ' + respuesta.status);
      const resultado = await respuesta.json();

      if(resultado && resultado.success === false){
        throw new Error(resultado.message || 'No se pudo consultar la auditoría clínica.');
      }

      state.eventos = Array.isArray(resultado)
        ? resultado
        : (Array.isArray(resultado && resultado.data) ? resultado.data : []);
      state.cargado = true;
      setEstado('Auditoría clínica cargada. Registro independiente de la bitácora de accesos.', false);
      render();
    }catch(error){
      console.error(MODULO + ':', error);
      state.eventos = [];
      state.cargado = false;
      setEstado(error && error.message ? error.message : 'No se pudo cargar la auditoría clínica.', true);
      render();
    }finally{
      state.cargando = false;
    }
  }

  function limpiarFiltros(){
    ['audClinDesde','audClinHasta','audClinModulo','audClinAccion','audClinBuscar'].forEach(function(id){
      const el = document.getElementById(id);
      if(el) el.value = '';
    });
    render();
  }

  function preparar(){
    if(state.preparado) return;
    state.preparado = true;
    instalarEstilos();

    const tab = document.getElementById('tabAuditoriaClinica');
    if(tab){
      if(!esAdministrador()){
        tab.style.display = 'none';
      }else{
        tab.addEventListener('click', function(){ cargar(false); });
      }
    }

    ['audClinDesde','audClinHasta','audClinModulo','audClinAccion'].forEach(function(id){
      document.getElementById(id)?.addEventListener('change', render);
    });
    document.getElementById('audClinBuscar')?.addEventListener('input', render);
    document.getElementById('audClinRefrescar')?.addEventListener('click', function(){ cargar(true); });
    document.getElementById('audClinLimpiar')?.addEventListener('click', limpiarFiltros);
  }

  window.auroAuditoriaClinica = {
    preparar: preparar,
    cargar: cargar,
    render: render,
    verDetalle: verDetalle,
    limpiarFiltros: limpiarFiltros
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(preparar, 0); });
  }else{
    setTimeout(preparar, 0);
  }
})();
