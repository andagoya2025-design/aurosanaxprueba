/****************************************************************
 AUROSANAX ERP DEMO
 Archivo: cie10-inteligente.js
 Módulo: Inteligencia clínica asistida por CIE-10
 Versión corregida: 2026-07-07 alias cierre compatible
 ---------------------------------------------------------------
 OBJETIVO:
 - Conectar el diagnóstico CIE-10 seleccionado con:
   catalogo_diagnosticos
   protocolos_clinicos
 - Consultar Apps Script sin romper el flujo actual.
 - Mostrar sugerencias clínicas si existe protocolo.
 - NO aplicar automáticamente medicamentos, órdenes ni indicaciones.
 - NO modificar Examen Físico, Plan Clínico ni Recetas por sí solo.
 - Mantener compatibilidad: si este archivo falla o no carga,
   Examen Físico debe seguir funcionando igual.

 REQUIERE APPS SCRIPT:
 - buscarProtocoloPorCie10
 - listarCatalogoDiagnosticos
 - listarProtocolosClinicos

 USO ESPERADO DESDE examenfisico.js:
 Después de agregar un diagnóstico CIE-10, llamar de forma segura:

 if (typeof window.auroCie10InteligenteBuscarProtocolo === 'function') {
   window.auroCie10InteligenteBuscarProtocolo(codigo, nombre);
 }
****************************************************************/

(function(){
  'use strict';

  const MODULO = 'AUROSANAX CIE10 INTELIGENTE';

  const STATE = {
    ultimoCodigo: '',
    ultimoNombre: '',
    ultimoResultado: null,
    cargando: false
  };

  function apiUrl(){
    try{
      if(typeof API_URL !== 'undefined' && API_URL) return API_URL;
    }catch(e){}

    if(window.API_URL) return window.API_URL;

    const input = document.getElementById('appsScriptUrl');
    if(input && input.value) return input.value.trim();

    return '';
  }

  function limpiarTexto(valor){
    return String(valor === null || valor === undefined ? '' : valor).trim();
  }

  function normalizarCodigoCie10(codigo){
    return limpiarTexto(codigo).toUpperCase();
  }

  function safeHtml(valor){
    return String(valor || '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  function parseJsonSeguro(valor, fallback){
    if(Array.isArray(valor) || (valor && typeof valor === 'object')) return valor;

    const txt = limpiarTexto(valor);
    if(!txt) return fallback;

    try{
      return JSON.parse(txt);
    }catch(e){
      console.warn(MODULO + ': JSON inválido.', e, txt);
      return fallback;
    }
  }

  async function getJSON(accion, params){
    const base = apiUrl();
    if(!base) throw new Error('No se encontró API_URL para consultar Apps Script.');

    const query = new URLSearchParams({ accion });

    Object.keys(params || {}).forEach(k => {
      if(params[k] !== undefined && params[k] !== null){
        query.append(k, params[k]);
      }
    });

    const res = await fetch(base + '?' + query.toString() + '&_=' + Date.now());
    return await res.json();
  }

  function obtenerContenedor(){
    let box = document.getElementById('auroCie10InteligenteBox');
    if(box) return box;

    box = document.createElement('div');
    box.id = 'auroCie10InteligenteBox';
    box.className = 'auro-cie10-inteligente-box';
    box.style.display = 'none';

    const destino =
      document.getElementById('hcDiagnosticosSeleccionadosBox') ||
      document.getElementById('hcDiagnosticosTableBody')?.closest('.cardx') ||
      document.getElementById('hc_diagnosticos') ||
      document.getElementById('hc_examen') ||
      document.querySelector('[data-module-patient="Examen Físico"]')?.parentElement;

    if(destino && destino.parentNode){
      destino.parentNode.insertBefore(box, destino.nextSibling);
    }else{
      const historia = document.getElementById('historia') || document.body;
      historia.appendChild(box);
    }

    instalarEstilos();
    return box;
  }

  function instalarEstilos(){
    if(document.getElementById('auro-cie10-inteligente-style')) return;

    const style = document.createElement('style');
    style.id = 'auro-cie10-inteligente-style';
    style.textContent = `
      .auro-cie10-inteligente-box{
        margin:14px 0;
        border:1px solid #fbcfe8;
        border-radius:20px;
        background:linear-gradient(135deg,#ffffff,#fff7fb);
        box-shadow:0 12px 32px rgba(139,30,90,.08);
        overflow:hidden;
      }
      .auro-cie10-head{
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:12px;
        padding:14px 16px;
        border-bottom:1px solid #fce7f3;
      }
      .auro-cie10-head h5{
        margin:0;
        font-weight:950;
        color:#8b1e5a;
        font-size:16px;
      }
      .auro-cie10-head p{
        margin:4px 0 0;
        color:#64748b;
        font-size:13px;
        font-weight:700;
      }
      .auro-cie10-body{
        padding:14px 16px 16px;
      }
      .auro-cie10-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:12px;
      }
      .auro-cie10-card{
        border:1px solid #f1d4e5;
        border-radius:16px;
        background:#fff;
        padding:12px;
      }
      .auro-cie10-card h6{
        margin:0 0 8px;
        color:#111827;
        font-weight:950;
        font-size:13px;
      }
      .auro-cie10-list{
        margin:0;
        padding-left:18px;
        color:#334155;
        font-size:13px;
        font-weight:650;
      }
      .auro-cie10-list li{ margin-bottom:5px; }
      .auro-cie10-note{
        color:#64748b;
        font-size:13px;
        font-weight:750;
      }
      .auro-cie10-actions{
        display:flex;
        justify-content:flex-end;
        gap:8px;
        flex-wrap:wrap;
        margin-top:12px;
      }
      .auro-cie10-btn{
        border:0;
        border-radius:13px;
        padding:9px 12px;
        font-size:12px;
        font-weight:900;
        cursor:pointer;
      }
      .auro-cie10-btn.primary{
        background:linear-gradient(135deg,#8b1e5a,#c23b83);
        color:#fff;
      }
      .auro-cie10-btn.soft{
        background:#fdf2f8;
        color:#8b1e5a;
        border:1px solid #fbcfe8;
      }
      .auro-cie10-btn.line{
        background:#fff;
        color:#334155;
        border:1px solid #e5e7eb;
      }
      .auro-cie10-badge{
        display:inline-block;
        padding:4px 9px;
        border-radius:999px;
        background:#fdf2f8;
        color:#8b1e5a;
        font-size:12px;
        font-weight:950;
      }
      @media(max-width:760px){
        .auro-cie10-grid{grid-template-columns:1fr;}
        .auro-cie10-head{display:block;}
        .auro-cie10-actions{display:grid;grid-template-columns:1fr;}
        .auro-cie10-btn{width:100%;}
      }
    `;

    document.head.appendChild(style);
  }

  function ocultarPanel(){
    const box = document.getElementById('auroCie10InteligenteBox');
    if(box){
      box.style.display = 'none';
      box.innerHTML = '';
    }
  }

  function mostrarCargando(codigo, nombre){
    const box = obtenerContenedor();
    box.style.display = 'block';
    box.innerHTML = `
      <div class="auro-cie10-head">
        <div>
          <h5><i class="bi bi-stars me-1"></i> Inteligencia clínica CIE-10</h5>
          <p>Buscando protocolo para <b>${safeHtml(codigo)}</b> ${nombre ? '· ' + safeHtml(nombre) : ''}</p>
        </div>
        <span class="auro-cie10-badge">Consultando</span>
      </div>
      <div class="auro-cie10-body">
        <div class="auro-cie10-note">Consultando protocolos clínicos disponibles...</div>
      </div>
    `;
  }

  function mostrarSinProtocolo(codigo, nombre){
    const box = obtenerContenedor();
    box.style.display = 'block';
    box.innerHTML = `
      <div class="auro-cie10-head">
        <div>
          <h5><i class="bi bi-info-circle me-1"></i> Sin protocolo configurado</h5>
          <p><b>${safeHtml(codigo)}</b> ${nombre ? '· ' + safeHtml(nombre) : ''}</p>
        </div>
        <span class="auro-cie10-badge">Sin datos</span>
      </div>
      <div class="auro-cie10-body">
        <div class="auro-cie10-note">
          El diagnóstico fue agregado correctamente. Todavía no existe un protocolo clínico asociado en <b>protocolos_clinicos</b>.
        </div>
        <div class="auro-cie10-actions">
          <button type="button" class="auro-cie10-btn line" onclick="window.auroCie10InteligenteOcultar()">Cerrar</button>
        </div>
      </div>
    `;
  }

  function listaHTML(items, tipo){
    const lista = Array.isArray(items) ? items : [];

    if(!lista.length){
      return '<div class="auro-cie10-note">Sin sugerencias configuradas.</div>';
    }

    return '<ul class="auro-cie10-list">' + lista.map(item => {
      if(typeof item === 'string'){
        return '<li>' + safeHtml(item) + '</li>';
      }

      if(tipo === 'medicamentos'){
        const partes = [
          item.nombre || item.medicamento || item.med,
          item.presentacion || item.pres,
          item.dosis,
          item.via,
          item.frecuencia || item.frec,
          item.duracion || item.dur,
          item.indicaciones || item.ind
        ].filter(Boolean);
        return '<li>' + safeHtml(partes.join(' - ')) + '</li>';
      }

      if(tipo === 'ordenes'){
        const partes = [
          item.orden || item.nombre,
          item.categoria || item.cat,
          item.observacion || item.obs
        ].filter(Boolean);
        return '<li>' + safeHtml(partes.join(' - ')) + '</li>';
      }

      const partes = Object.keys(item || {}).map(k => item[k]).filter(Boolean);
      return '<li>' + safeHtml(partes.join(' - ')) + '</li>';
    }).join('') + '</ul>';
  }

  function normalizarProtocolo(resultado){
    const protocolo = resultado?.protocolo || null;
    const catalogo = resultado?.catalogo || null;

    if(!protocolo) return { catalogo, protocolo:null };

    return {
      catalogo,
      protocolo,
      medicamentos: parseJsonSeguro(protocolo.medicamentos_json, []),
      ordenes: parseJsonSeguro(protocolo.ordenes_json, []),
      indicaciones: parseJsonSeguro(protocolo.indicaciones_json, []),
      alertas: parseJsonSeguro(protocolo.alertas_json, []),
      controles: parseJsonSeguro(protocolo.controles_json, []),
      criterios: parseJsonSeguro(protocolo.criterios_referencia_json, [])
    };
  }

  function mostrarProtocolo(codigo, nombre, resultado){
    const data = normalizarProtocolo(resultado);
    const p = data.protocolo;

    if(!p){
      mostrarSinProtocolo(codigo, nombre);
      return;
    }

    const box = obtenerContenedor();
    box.style.display = 'block';

    box.innerHTML = `
      <div class="auro-cie10-head">
        <div>
          <h5><i class="bi bi-stars me-1"></i> Protocolo clínico sugerido</h5>
          <p>
            <b>${safeHtml(codigo)}</b> ${nombre ? '· ' + safeHtml(nombre) : ''}
            ${p.nombre_protocolo ? '<br><span>' + safeHtml(p.nombre_protocolo) + '</span>' : ''}
          </p>
        </div>
        <span class="auro-cie10-badge">${safeHtml(p.especialidad || 'Protocolo')}</span>
      </div>

      <div class="auro-cie10-body">
        <div class="auro-cie10-note mb-2">
          Estas son sugerencias asistidas. El médico debe revisar, aceptar, modificar o descartar.
        </div>

        <div class="auro-cie10-grid">
          <div class="auro-cie10-card">
            <h6><i class="bi bi-capsule me-1"></i> Medicamentos sugeridos</h6>
            ${listaHTML(data.medicamentos, 'medicamentos')}
          </div>

          <div class="auro-cie10-card">
            <h6><i class="bi bi-file-earmark-medical me-1"></i> Órdenes sugeridas</h6>
            ${listaHTML(data.ordenes, 'ordenes')}
          </div>

          <div class="auro-cie10-card">
            <h6><i class="bi bi-clipboard-check me-1"></i> Indicaciones</h6>
            ${listaHTML(data.indicaciones, 'indicaciones')}
          </div>

          <div class="auro-cie10-card">
            <h6><i class="bi bi-exclamation-triangle me-1"></i> Alertas / controles</h6>
            ${listaHTML([].concat(data.alertas || [], data.controles || [], data.criterios || []), 'alertas')}
          </div>
        </div>

        <div class="auro-cie10-actions">
          <button type="button" class="auro-cie10-btn line" onclick="window.auroCie10InteligenteOcultar()">Cerrar</button>
          <button type="button" class="auro-cie10-btn soft" onclick="window.auroCie10InteligenteCopiarResumen()">Copiar resumen</button>
          <button type="button" class="auro-cie10-btn primary" onclick="window.auroCie10InteligenteAplicarAlPlan()">Aplicar al Plan</button>
        </div>
      </div>
    `;
  }

  function textoResumenProtocolo(){
    const resultado = STATE.ultimoResultado;
    const data = normalizarProtocolo(resultado);

    if(!data.protocolo) return '';

    const partes = [];

    partes.push('Protocolo sugerido para ' + STATE.ultimoCodigo + (STATE.ultimoNombre ? ' - ' + STATE.ultimoNombre : ''));

    if(data.medicamentos?.length){
      partes.push('Medicamentos:');
      data.medicamentos.forEach((m,i) => {
        if(typeof m === 'string'){
          partes.push((i+1) + '. ' + m);
        }else{
          partes.push((i+1) + '. ' + [
            m.nombre || m.medicamento || m.med,
            m.presentacion || m.pres,
            m.dosis,
            m.via,
            m.frecuencia || m.frec,
            m.duracion || m.dur,
            m.indicaciones || m.ind
          ].filter(Boolean).join(' - '));
        }
      });
    }

    if(data.ordenes?.length){
      partes.push('Órdenes:');
      data.ordenes.forEach((o,i) => {
        if(typeof o === 'string'){
          partes.push((i+1) + '. ' + o);
        }else{
          partes.push((i+1) + '. ' + [
            o.orden || o.nombre,
            o.categoria || o.cat,
            o.observacion || o.obs
          ].filter(Boolean).join(' - '));
        }
      });
    }

    if(data.indicaciones?.length){
      partes.push('Indicaciones:');
      data.indicaciones.forEach((x,i) => {
        partes.push((i+1) + '. ' + (typeof x === 'string' ? x : Object.values(x).filter(Boolean).join(' - ')));
      });
    }

    if(data.alertas?.length){
      partes.push('Alertas:');
      data.alertas.forEach((x,i) => {
        partes.push((i+1) + '. ' + (typeof x === 'string' ? x : Object.values(x).filter(Boolean).join(' - ')));
      });
    }

    if(data.controles?.length){
      partes.push('Controles:');
      data.controles.forEach((x,i) => {
        partes.push((i+1) + '. ' + (typeof x === 'string' ? x : Object.values(x).filter(Boolean).join(' - ')));
      });
    }

    return partes.join('\n');
  }

  function aplicarMedicamentosAlPlan(medicamentos){
    if(!Array.isArray(medicamentos) || !medicamentos.length) return 0;

    window.medicamentosPlanSeleccionados = Array.isArray(window.medicamentosPlanSeleccionados)
      ? window.medicamentosPlanSeleccionados
      : [];

    let agregados = 0;

    medicamentos.forEach(m => {
      if(typeof m === 'string'){
        window.medicamentosPlanSeleccionados.push({
          med: m,
          pres: '',
          via: '',
          cantidad: '',
          frec: '',
          dur: '',
          ind: '',
          continuo: 'No'
        });
        agregados++;
        return;
      }

      window.medicamentosPlanSeleccionados.push({
        med: m.nombre || m.medicamento || m.med || '',
        pres: m.presentacion || m.pres || '',
        via: m.via || '',
        cantidad: m.cantidad || '',
        frec: m.frecuencia || m.frec || '',
        dur: m.duracion || m.dur || '',
        ind: m.indicaciones || m.ind || '',
        continuo: m.continuo || 'No'
      });
      agregados++;
    });

    if(typeof window.renderMedicamentosPlanTabla === 'function'){
      window.renderMedicamentosPlanTabla();
    }

    if(typeof window.sincronizarPlanConReceta === 'function'){
      window.sincronizarPlanConReceta();
    }

    return agregados;
  }

  function aplicarOrdenesAlPlan(ordenes){
    if(!Array.isArray(ordenes) || !ordenes.length) return 0;

    window.ordenesMedicasPlanSeleccionadas = Array.isArray(window.ordenesMedicasPlanSeleccionadas)
      ? window.ordenesMedicasPlanSeleccionadas
      : [];

    let agregadas = 0;

    ordenes.forEach(o => {
      if(typeof o === 'string'){
        window.ordenesMedicasPlanSeleccionadas.push({
          orden: o,
          cat: 'OTROS',
          obs: ''
        });
        agregadas++;
        return;
      }

      window.ordenesMedicasPlanSeleccionadas.push({
        orden: o.orden || o.nombre || '',
        cat: o.categoria || o.cat || 'OTROS',
        obs: o.observacion || o.obs || ''
      });
      agregadas++;
    });

    if(typeof window.renderOrdenesMedicasTabla === 'function'){
      window.renderOrdenesMedicasTabla();
    }

    if(typeof window.recopilarOrdenesMedicasPlan === 'function'){
      window.recopilarOrdenesMedicasPlan();
    }

    return agregadas;
  }

  function aplicarIndicacionesAlPlan(indicaciones, controles){
    const lista = []
      .concat(Array.isArray(indicaciones) ? indicaciones : [])
      .concat(Array.isArray(controles) ? controles : []);

    if(!lista.length) return 0;

    const textoNuevo = lista.map(x => {
      if(typeof x === 'string') return x;
      return Object.values(x || {}).filter(Boolean).join(' - ');
    }).filter(Boolean).join('\n');

    if(!textoNuevo) return 0;

    const campo = document.getElementById('hcIndicacionesPaciente');
    if(campo){
      const actual = String(campo.value || '').trim();
      campo.value = actual ? actual + '\n' + textoNuevo : textoNuevo;
    }

    return lista.length;
  }

  window.auroCie10InteligenteBuscarProtocolo = async function(codigo, nombre){
    codigo = normalizarCodigoCie10(codigo);
    nombre = limpiarTexto(nombre);

    if(!codigo) return null;

    STATE.ultimoCodigo = codigo;
    STATE.ultimoNombre = nombre;
    STATE.ultimoResultado = null;
    STATE.cargando = true;

    try{
      mostrarCargando(codigo, nombre);

      const resultado = await getJSON('buscarProtocoloPorCie10', {
        codigo_cie10: codigo
      });

      STATE.ultimoResultado = resultado;
      STATE.cargando = false;

      if(!resultado || resultado.success === false){
        mostrarSinProtocolo(codigo, nombre);
        return resultado || null;
      }

      mostrarProtocolo(codigo, nombre, resultado);
      return resultado;

    }catch(error){
      STATE.cargando = false;
      console.warn(MODULO + ': no se pudo consultar protocolo.', error);

      const box = obtenerContenedor();
      box.style.display = 'block';
      box.innerHTML = `
        <div class="auro-cie10-head">
          <div>
            <h5><i class="bi bi-exclamation-triangle me-1"></i> Inteligencia CIE-10 no disponible</h5>
            <p>El diagnóstico fue agregado, pero no se pudo consultar el protocolo.</p>
          </div>
          <span class="auro-cie10-badge">Sin conexión</span>
        </div>
        <div class="auro-cie10-body">
          <div class="auro-cie10-note">${safeHtml(error.message || error)}</div>
          <div class="auro-cie10-actions">
            <button type="button" class="auro-cie10-btn line" onclick="window.auroCie10InteligenteOcultar()">Cerrar</button>
          </div>
        </div>
      `;

      return null;
    }
  };

  window.auroCie10InteligenteOcultar = function(){
    ocultarPanel();
  };

  /* =====================================================
     COMPATIBILIDAD ERP AUROSANAX
     Alias requerido por pruebas e integración:
     - Cerrar y Ocultar hacen exactamente lo mismo.
     - No modifica Examen Físico, Plan, Recetas ni Apps Script.
     ===================================================== */
  window.auroCie10InteligenteCerrar = window.auroCie10InteligenteOcultar;

  window.auroCie10InteligenteCopiarResumen = async function(){
    const txt = textoResumenProtocolo();

    if(!txt){
      alert('No hay protocolo para copiar.');
      return;
    }

    try{
      await navigator.clipboard.writeText(txt);
      alert('Resumen del protocolo copiado.');
    }catch(e){
      alert(txt);
    }
  };

  window.auroCie10InteligenteAplicarAlPlan = function(){
    const resultado = STATE.ultimoResultado;
    const data = normalizarProtocolo(resultado);

    if(!data.protocolo){
      alert('No hay protocolo para aplicar.');
      return;
    }

    const confirmar = confirm(
      'Esto agregará las sugerencias del protocolo al Plan Clínico.\n\n' +
      'Revise y modifique antes de guardar o emitir receta.\n\n' +
      '¿Desea continuar?'
    );

    if(!confirmar) return;

    const meds = aplicarMedicamentosAlPlan(data.medicamentos);
    const ords = aplicarOrdenesAlPlan(data.ordenes);
    const inds = aplicarIndicacionesAlPlan(data.indicaciones, data.controles);

    if(typeof window.guardarPlanTemporal === 'function'){
      window.guardarPlanTemporal();
    }

    alert(
      'Sugerencias aplicadas al Plan:\n' +
      '- Medicamentos: ' + meds + '\n' +
      '- Órdenes: ' + ords + '\n' +
      '- Indicaciones/controles: ' + inds + '\n\n' +
      'Debe revisar antes de guardar.'
    );
  };

  window.auroCie10InteligenteEstado = function(){
    return JSON.parse(JSON.stringify(STATE));
  };

  console.info(MODULO + ': módulo cargado correctamente.');

})();
