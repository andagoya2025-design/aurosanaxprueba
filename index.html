/* =====================================================
   AUROSANAX ERP - CIE10 INTELIGENTE
   Archivo: cie10-inteligente.js
   Versión: 1.1 corregida
   Corrección:
   - Expone correctamente window.auroCie10InteligenteCerrar.
   - Mantiene búsqueda de protocolo.
   - Mantiene panel inteligente.
   - No modifica Examen Físico, Plan, Recetas, Pacientes ni Apps Script.
   ===================================================== */

(function(){
  'use strict';

  const MODULO = 'AUROSANAX CIE10 INTELIGENTE';
  let protocoloActual = null;
  let diagnosticoActual = null;
  let panelCreado = false;

  function el(id){
    return document.getElementById(id);
  }

  function safe(text){
    return String(text ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  function apiUrl(){
    try{
      if(typeof API_URL !== 'undefined' && API_URL) return API_URL;
      if(window.API_URL) return window.API_URL;
      if(window.APP_SCRIPT_URL) return window.APP_SCRIPT_URL;
      if(typeof window.auroApiUrlGlobal === 'function') return window.auroApiUrlGlobal();
    }catch(e){}
    return '';
  }

  async function apiGet(accion, params){
    const base = apiUrl();
    if(!base){
      throw new Error('API_URL no está definida.');
    }

    const query = new URLSearchParams({ accion: accion });
    Object.keys(params || {}).forEach(k => {
      if(params[k] !== undefined && params[k] !== null){
        query.append(k, params[k]);
      }
    });

    const res = await fetch(base + '?' + query.toString());
    const txt = await res.text();

    try{
      return JSON.parse(txt);
    }catch(e){
      return txt;
    }
  }

  function asegurarEstilos(){
    if(el('auroCie10InteligenteStyles')) return;

    const style = document.createElement('style');
    style.id = 'auroCie10InteligenteStyles';
    style.textContent = `
      .auro-cie10-panel{
        position:fixed;
        top:0;
        right:0;
        width:min(430px,92vw);
        height:100vh;
        background:#ffffff;
        border-left:1px solid #f1d4e5;
        box-shadow:-18px 0 55px rgba(15,23,42,.18);
        z-index:9998;
        transform:translateX(110%);
        transition:.25s ease;
        display:flex;
        flex-direction:column;
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .auro-cie10-panel.show{ transform:translateX(0); }

      .auro-cie10-head{
        background:
          radial-gradient(circle at top right, rgba(255,255,255,.22), transparent 30%),
          linear-gradient(135deg,#7a174f,#c23b83);
        color:#fff;
        padding:18px 18px 16px;
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:flex-start;
      }

      .auro-cie10-head h4{
        margin:0;
        font-size:18px;
        font-weight:950;
        line-height:1.15;
      }

      .auro-cie10-head p{
        margin:5px 0 0;
        font-size:12px;
        opacity:.88;
        font-weight:700;
      }

      .auro-cie10-close{
        border:0;
        background:rgba(255,255,255,.17);
        color:#fff;
        width:36px;
        height:36px;
        border-radius:12px;
        font-size:18px;
        font-weight:900;
        cursor:pointer;
      }

      .auro-cie10-body{
        padding:16px;
        overflow:auto;
        flex:1;
        background:linear-gradient(180deg,#fff,#fffafd);
      }

      .auro-cie10-status{
        border:1px solid #dbeafe;
        background:#eff6ff;
        color:#1d4ed8;
        border-radius:16px;
        padding:12px 14px;
        font-size:13px;
        font-weight:800;
        margin-bottom:12px;
      }

      .auro-cie10-status.ok{
        border-color:#bbf7d0;
        background:#dcfce7;
        color:#166534;
      }

      .auro-cie10-status.warn{
        border-color:#fed7aa;
        background:#fff7ed;
        color:#9a3412;
      }

      .auro-cie10-status.error{
        border-color:#fecdd3;
        background:#fff1f2;
        color:#be123c;
      }

      .auro-cie10-card{
        background:#fff;
        border:1px solid #f1d4e5;
        border-radius:18px;
        padding:14px;
        margin-bottom:12px;
        box-shadow:0 12px 28px rgba(139,30,90,.06);
      }

      .auro-cie10-card h5{
        margin:0 0 8px;
        font-size:14px;
        color:#8b1e5a;
        font-weight:950;
        text-transform:uppercase;
        letter-spacing:.045em;
      }

      .auro-cie10-dx{
        font-size:15px;
        color:#111827;
        font-weight:900;
        line-height:1.35;
      }

      .auro-cie10-muted{
        color:#64748b;
        font-size:12px;
        font-weight:700;
        line-height:1.45;
      }

      .auro-cie10-list{
        display:grid;
        gap:8px;
        margin-top:8px;
      }

      .auro-cie10-item{
        border:1px solid #f1f5f9;
        background:#f8fafc;
        border-radius:14px;
        padding:10px;
        color:#334155;
        font-size:13px;
        font-weight:750;
        line-height:1.4;
      }

      .auro-cie10-item b{
        color:#111827;
        font-weight:950;
      }

      .auro-cie10-footer{
        padding:12px 16px;
        background:#fff;
        border-top:1px solid #f1d4e5;
        display:flex;
        gap:10px;
        justify-content:flex-end;
      }

      .auro-cie10-btn{
        border:0;
        border-radius:14px;
        padding:10px 13px;
        font-weight:900;
        font-size:13px;
        cursor:pointer;
      }

      .auro-cie10-btn.primary{
        background:linear-gradient(135deg,#8b1e5a,#c23b83);
        color:#fff;
        box-shadow:0 12px 25px rgba(139,30,90,.22);
      }

      .auro-cie10-btn.line{
        background:#fff;
        color:#334155;
        border:1px solid #e5e7eb;
      }

      .auro-cie10-btn:disabled{
        opacity:.55;
        cursor:not-allowed;
      }

      .auro-cie10-backdrop{
        display:none;
        position:fixed;
        inset:0;
        background:rgba(15,23,42,.32);
        z-index:9997;
      }

      .auro-cie10-backdrop.show{ display:block; }

      @media(max-width:760px){
        .auro-cie10-panel{
          top:auto;
          bottom:0;
          right:0;
          left:0;
          width:100%;
          height:min(82vh,720px);
          border-left:0;
          border-top:1px solid #f1d4e5;
          border-radius:24px 24px 0 0;
          transform:translateY(110%);
          box-shadow:0 -18px 55px rgba(15,23,42,.2);
        }

        .auro-cie10-panel.show{ transform:translateY(0); }

        .auro-cie10-head{
          border-radius:24px 24px 0 0;
          padding:16px;
        }

        .auro-cie10-head h4{ font-size:17px; }

        .auro-cie10-footer{
          position:sticky;
          bottom:0;
          display:grid;
          grid-template-columns:1fr;
        }

        .auro-cie10-btn{
          width:100%;
          min-height:44px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function cerrarPanel(){
    const panel = el('auroCie10Panel');
    const backdrop = el('auroCie10Backdrop');

    if(panel) panel.classList.remove('show');
    if(backdrop) backdrop.classList.remove('show');
  }

  function asegurarPanel(){
    asegurarEstilos();

    if(panelCreado && el('auroCie10Panel')) return el('auroCie10Panel');

    const backdrop = document.createElement('div');
    backdrop.id = 'auroCie10Backdrop';
    backdrop.className = 'auro-cie10-backdrop';
    backdrop.addEventListener('click', cerrarPanel);

    const panel = document.createElement('aside');
    panel.id = 'auroCie10Panel';
    panel.className = 'auro-cie10-panel';
    panel.setAttribute('aria-live','polite');

    panel.innerHTML = `
      <div class="auro-cie10-head">
        <div>
          <h4>Asistente clínico CIE-10</h4>
          <p>Protocolos y sugerencias clínicas para apoyo médico.</p>
        </div>
        <button type="button" class="auro-cie10-close" onclick="window.auroCie10InteligenteCerrar()">×</button>
      </div>
      <div class="auro-cie10-body" id="auroCie10PanelBody">
        <div class="auro-cie10-status">Seleccione un diagnóstico CIE-10 para consultar sugerencias.</div>
      </div>
      <div class="auro-cie10-footer">
        <button type="button" class="auro-cie10-btn line" onclick="window.auroCie10InteligenteCerrar()">Cerrar</button>
        <button type="button" class="auro-cie10-btn primary" id="auroCie10BtnAplicar" onclick="window.auroCie10InteligenteAplicarAlPlan()" disabled>Aplicar al Plan</button>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    panelCreado = true;

    return panel;
  }

  function abrirPanel(){
    const panel = asegurarPanel();
    const backdrop = el('auroCie10Backdrop');

    requestAnimationFrame(() => {
      panel.classList.add('show');
      if(backdrop) backdrop.classList.add('show');
    });
  }

  function setBody(html){
    asegurarPanel();
    const body = el('auroCie10PanelBody');
    if(body) body.innerHTML = html;
  }

  function setAplicarActivo(activo){
    const btn = el('auroCie10BtnAplicar');
    if(btn) btn.disabled = !activo;
  }

  function parseJsonSeguro(valor){
    if(!valor) return [];
    if(Array.isArray(valor)) return valor;
    if(typeof valor === 'object') return [valor];

    try{
      const parsed = JSON.parse(String(valor));
      if(Array.isArray(parsed)) return parsed;
      if(parsed && typeof parsed === 'object') return [parsed];
      return [];
    }catch(e){
      return [{ texto: String(valor) }];
    }
  }

  function itemTexto(item){
    if(item === null || item === undefined) return '';
    if(typeof item === 'string') return safe(item);

    if(typeof item === 'object'){
      const partes = [];

      if(item.nombre) partes.push('<b>' + safe(item.nombre) + '</b>');
      if(item.descripcion) partes.push(safe(item.descripcion));
      if(item.dosis) partes.push('Dosis: ' + safe(item.dosis));
      if(item.via) partes.push('Vía: ' + safe(item.via));
      if(item.frecuencia) partes.push('Frecuencia: ' + safe(item.frecuencia));
      if(item.duracion) partes.push('Duración: ' + safe(item.duracion));
      if(item.cantidad) partes.push('Cantidad: ' + safe(item.cantidad));
      if(item.indicacion) partes.push(safe(item.indicacion));
      if(item.texto) partes.push(safe(item.texto));

      if(partes.length) return partes.join('<br>');
      return safe(JSON.stringify(item));
    }

    return safe(String(item));
  }

  function renderLista(titulo, lista){
    const arr = parseJsonSeguro(lista);

    if(!arr.length) return '';

    return `
      <div class="auro-cie10-card">
        <h5>${safe(titulo)}</h5>
        <div class="auro-cie10-list">
          ${arr.map(item => `<div class="auro-cie10-item">${itemTexto(item)}</div>`).join('')}
        </div>
      </div>
    `;
  }

  function renderSinProtocolo(codigo, nombre){
    setAplicarActivo(false);

    setBody(`
      <div class="auro-cie10-status warn">
        No se encontró protocolo configurado para este diagnóstico.
      </div>

      <div class="auro-cie10-card">
        <h5>Diagnóstico seleccionado</h5>
        <div class="auro-cie10-dx">${safe(codigo)} · ${safe(nombre || '')}</div>
        <div class="auro-cie10-muted">
          El diagnóstico fue agregado normalmente al Examen Físico.
          No se aplicó ningún cambio al Plan Clínico.
        </div>
      </div>
    `);
  }

  function renderConProtocolo(codigo, nombre, respuesta){
    const protocolo = respuesta?.protocolo || (Array.isArray(respuesta?.protocolos) ? respuesta.protocolos[0] : null);
    const catalogo = respuesta?.catalogo || null;

    protocoloActual = protocolo || null;
    diagnosticoActual = {
      codigo_cie10: codigo,
      descripcion: nombre || catalogo?.descripcion || protocolo?.nombre_protocolo || ''
    };

    if(!protocoloActual){
      renderSinProtocolo(codigo, nombre);
      return;
    }

    setAplicarActivo(true);

    setBody(`
      <div class="auro-cie10-status ok">
        Protocolo clínico encontrado. Revise antes de aplicar.
      </div>

      <div class="auro-cie10-card">
        <h5>Diagnóstico seleccionado</h5>
        <div class="auro-cie10-dx">${safe(codigo)} · ${safe(diagnosticoActual.descripcion)}</div>
        <div class="auro-cie10-muted">
          ${safe(protocolo.nombre_protocolo || 'Protocolo clínico asociado')}
          ${protocolo.version_protocolo ? ' · Versión ' + safe(protocolo.version_protocolo) : ''}
        </div>
      </div>

      ${renderLista('Medicamentos sugeridos', protocolo.medicamentos_json)}
      ${renderLista('Órdenes sugeridas', protocolo.ordenes_json)}
      ${renderLista('Indicaciones al paciente', protocolo.indicaciones_json)}
      ${renderLista('Alertas clínicas', protocolo.alertas_json)}
      ${renderLista('Controles sugeridos', protocolo.controles_json)}
      ${renderLista('Criterios de referencia', protocolo.criterios_referencia_json)}

      <div class="auro-cie10-card">
        <h5>Nota de seguridad</h5>
        <div class="auro-cie10-muted">
          Estas sugerencias son apoyo clínico. El médico tratante debe revisar, modificar o descartar antes de aplicar al Plan.
        </div>
      </div>
    `);
  }

  async function buscarProtocolo(codigo, nombre){
    const codigoLimpio = String(codigo || '').trim();

    if(!codigoLimpio){
      console.warn(MODULO, 'No se recibió código CIE-10.');
      return null;
    }

    diagnosticoActual = {
      codigo_cie10: codigoLimpio,
      descripcion: nombre || ''
    };
    protocoloActual = null;

    abrirPanel();
    setAplicarActivo(false);

    setBody(`
      <div class="auro-cie10-status">
        Consultando protocolo clínico para <b>${safe(codigoLimpio)}</b>...
      </div>
    `);

    try{
      const respuesta = await apiGet('buscarProtocoloPorCie10', {
        codigo_cie10: codigoLimpio
      });

      if(!respuesta || respuesta.success === false){
        throw new Error(respuesta?.message || 'No se pudo consultar el protocolo.');
      }

      if(!respuesta.encontrado){
        renderSinProtocolo(codigoLimpio, nombre);
        return respuesta;
      }

      renderConProtocolo(codigoLimpio, nombre, respuesta);
      return respuesta;

    }catch(error){
      console.error(MODULO, error);
      setAplicarActivo(false);

      setBody(`
        <div class="auro-cie10-status error">
          No se pudo consultar el protocolo CIE-10.
        </div>
        <div class="auro-cie10-card">
          <h5>Diagnóstico seleccionado</h5>
          <div class="auro-cie10-dx">${safe(codigoLimpio)} · ${safe(nombre || '')}</div>
          <div class="auro-cie10-muted">
            El diagnóstico fue agregado normalmente. El error solo afecta al asistente inteligente.
          </div>
        </div>
      `);

      return null;
    }
  }

  function aplicarAlPlan(){
    if(!protocoloActual){
      alert('No hay protocolo disponible para aplicar.');
      return;
    }

    console.log(MODULO, 'Protocolo listo para aplicar al Plan:', {
      diagnostico: diagnosticoActual,
      protocolo: protocoloActual
    });

    alert('Protocolo listo. La aplicación automática al Plan se activará en la siguiente etapa, con autorización.');
  }

  /* =====================================================
     EXPORTACIÓN GLOBAL SEGURA
     Estas funciones son las que verifica la consola.
     ===================================================== */
  window.auroCie10InteligenteBuscarProtocolo = buscarProtocolo;
  window.auroCie10InteligenteCerrar = cerrarPanel;
  window.auroCie10InteligenteAplicarAlPlan = aplicarAlPlan;

  /* Alias defensivos por si alguna prueba antigua usa otro nombre */
  window.auroCie10InteligenteClose = cerrarPanel;
  window.auroCie10InteligenteAbrir = abrirPanel;

  console.info(MODULO + ': módulo cargado correctamente.');

})();
