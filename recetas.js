/* =====================================================
   AUROSANAX ERP - MÓDULO RECETAS
   Archivo: recetas.js
   Versión: 1.0
   Función: vista previa profesional + impresión/PDF seguro
   No modifica Apps Script, Google Sheets, pacientes ni agenda.
===================================================== */

(function(){
  'use strict';

  function el(id){ return document.getElementById(id); }
  function val(id){ return (el(id)?.value || '').trim(); }
  function setVal(id, value){ if(el(id)) el(id).value = value || ''; }
  function safe(text){
    return String(text || '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }
  function nl2br(text){ return safe(text).replace(/\n/g,'<br>'); }

  function fechaHoyReceta(){
    if(typeof fechaHoyISO === 'function') return fechaHoyISO();
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function fechaVisual(fecha){
    if(!fecha) return '';
    const p = String(fecha).slice(0,10).split('-');
    if(p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
    return fecha;
  }

  window.obtenerDatosReceta = function(){
    const paciente = (typeof getPacienteActivo === 'function') ? getPacienteActivo() : null;

    return {
      paciente: paciente || {},
      fecha: val('recFecha') || fechaHoyReceta(),
      medico: val('recMedico') || 'Dra. Aurora Andagoya',
      cie10: val('recCie10'),
      estado: val('recEstado') || 'Emitida',
      diagnostico: val('recDiagnostico'),
      medicamento: val('recMedicamento'),
      indicaciones: val('recIndicaciones'),
      recomendaciones: val('recRecomendaciones')
    };
  };

  function asegurarVistaPreviaReceta(){
    const seccion = el('recetas');
    if(!seccion) return null;

    let box = el('recetaPreview');
    if(box) return box;

    box = document.createElement('div');
    box.id = 'recetaPreview';
    box.className = 'cardx p-4 bg-white mt-4';
    box.innerHTML = `
      <div class="text-muted text-center py-4">
        Vista previa de receta pendiente. Complete los campos y presione <b>Actualizar vista previa</b> o <b>PDF / imprimir</b>.
      </div>`;

    const nota = seccion.querySelector('.clinical-note.mt-3');
    if(nota && nota.parentNode) nota.parentNode.insertBefore(box, nota.nextSibling);
    else seccion.querySelector('.cardx')?.appendChild(box);

    return box;
  }

  function construirHTMLReceta(r){
    const p = r.paciente || {};
    const nombre = p.nombre || 'Paciente no seleccionado';
    const cedula = p.cedula || '—';
    const edad = p.edad || (typeof calcularEdadDesdeFecha === 'function' ? calcularEdadDesdeFecha(p.fecha_nacimiento) : '') || '—';
    const telefono = p.telefono || '—';
    const idPaciente = p.id_paciente || '—';
    const estadoClass = String(r.estado).toLowerCase().includes('anulada') ? 'badge-danger' : 'badge-ok';

    return `
      <div class="auro-receta-documento">
        <style>
          .auro-receta-documento{font-family:Arial,system-ui,sans-serif;color:#111827;line-height:1.45;max-width:900px;margin:auto;background:#fff;}
          .auro-receta-header{border-bottom:3px solid #8b1e5a;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;gap:16px;align-items:flex-start;}
          .auro-receta-brand h2{margin:0;color:#8b1e5a;font-weight:900;letter-spacing:.04em;}
          .auro-receta-brand small{color:#6b7280;font-weight:700;}
          .auro-receta-title{text-align:right;color:#111827;}
          .auro-receta-title b{display:block;font-size:20px;}
          .auro-receta-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 16px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:12px;margin-bottom:16px;}
          .auro-receta-grid div{font-size:13px;}
          .auro-receta-grid span{color:#6b7280;font-weight:700;}
          .auro-receta-section{margin-top:14px;}
          .auro-receta-section h4{margin:0 0 8px;color:#8b1e5a;font-size:15px;border-bottom:1px solid #fbcfe8;padding-bottom:5px;}
          .auro-receta-box{border:1px solid #e5e7eb;border-radius:14px;padding:12px;min-height:54px;white-space:normal;word-break:break-word;}
          .auro-rp{font-size:18px;font-weight:900;color:#111827;margin-bottom:6px;}
          .auro-receta-footer{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:42px;align-items:end;}
          .auro-firma{text-align:center;padding-top:28px;}
          .auro-linea{border-top:1px solid #111827;margin-bottom:6px;}
          .badge-auro{display:inline-block;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:800;}
          .badge-ok{background:#dcfce7;color:#166534;}.badge-danger{background:#fee2e2;color:#991b1b;}
          @media print{.no-print{display:none!important}.auro-receta-documento{max-width:none}.auro-receta-box{break-inside:avoid}.auro-receta-header{break-inside:avoid}}
        </style>

        <div class="auro-receta-header">
          <div class="auro-receta-brand">
            <h2>AUROSANAX</h2>
            <small>Centro Médico Especializado</small><br>
            <small>Innovando salud al cuidado de la mujer</small>
          </div>
          <div class="auro-receta-title">
            <b>RECETA MÉDICA</b>
            <small>Fecha: ${safe(fechaVisual(r.fecha))}</small><br>
            <span class="badge-auro ${estadoClass}">${safe(r.estado)}</span>
          </div>
        </div>

        <div class="auro-receta-grid">
          <div><span>Paciente:</span> ${safe(nombre)}</div>
          <div><span>Cédula:</span> ${safe(cedula)}</div>
          <div><span>Edad:</span> ${safe(edad)}</div>
          <div><span>WhatsApp:</span> ${safe(telefono)}</div>
          <div><span>ID paciente:</span> ${safe(idPaciente)}</div>
          <div><span>Médico:</span> ${safe(r.medico)}</div>
          <div><span>CIE-10:</span> ${safe(r.cie10 || '—')}</div>
          <div><span>Diagnóstico:</span> ${safe(r.diagnostico || '—')}</div>
        </div>

        <div class="auro-receta-section">
          <h4>Prescripción</h4>
          <div class="auro-receta-box">
            <div class="auro-rp">Rp/</div>
            ${nl2br(r.medicamento || 'Sin medicamentos registrados.')}
          </div>
        </div>

        <div class="auro-receta-section">
          <h4>Indicaciones para paciente</h4>
          <div class="auro-receta-box">${nl2br(r.indicaciones || '—')}</div>
        </div>

        ${r.recomendaciones ? `
        <div class="auro-receta-section">
          <h4>Observaciones internas / recomendaciones</h4>
          <div class="auro-receta-box">${nl2br(r.recomendaciones)}</div>
        </div>` : ''}

        <div class="auro-receta-footer">
          <div style="font-size:12px;color:#6b7280;">
            Documento generado desde AUROSANAX Clinical ERP DEMO.<br>
            Esta receta debe ser validada con firma y sello del profesional tratante.
          </div>
          <div class="auro-firma">
            <div class="auro-linea"></div>
            <b>Dra. Aurora Andagoya Murillo</b><br>
            <span>Ginecología y Obstetricia</span><br>
            <span>Firma y sello</span>
          </div>
        </div>
      </div>`;
  }

  window.vistaPreviaReceta = function(){
    if(el('recFecha') && !val('recFecha')) setVal('recFecha', fechaHoyReceta());
    if(typeof sincronizarPlanConReceta === 'function') sincronizarPlanConReceta();

    const box = asegurarVistaPreviaReceta();
    const r = window.obtenerDatosReceta();

    if(!r.paciente || !r.paciente.nombre){
      if(box){
        box.innerHTML = `<div class="sheet-note"><i class="bi bi-exclamation-triangle me-1"></i> Primero seleccione o abra un paciente desde Pacientes o Historia Clínica.</div>`;
      }
      return r;
    }

    if(box) box.innerHTML = construirHTMLReceta(r);
    return r;
  };

  window.generarPDFReceta = function(){
    if(el('recFecha') && !val('recFecha')) setVal('recFecha', fechaHoyReceta());
    if(typeof sincronizarPlanConReceta === 'function') sincronizarPlanConReceta();

    const r = window.obtenerDatosReceta();
    if(!r.paciente || !r.paciente.nombre){
      alert('Seleccione primero un paciente para generar la receta.');
      if(typeof showScreen === 'function') showScreen('pacientes');
      return;
    }

    const html = construirHTMLReceta(r);
    const ventana = window.open('', '_blank');
    if(!ventana){
      alert('El navegador bloqueó la ventana de impresión. Permita ventanas emergentes para este sitio.');
      return;
    }

    ventana.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Receta médica AUROSANAX</title></head><body>${html}</body></html>`);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => ventana.print(), 300);
  };

  function agregarBotonVistaPrevia(){
    const seccion = el('recetas');
    if(!seccion) return;
    const actions = seccion.querySelector('.section-head .d-flex');
    if(actions && !el('btnVistaPreviaReceta')){
      const btn = document.createElement('button');
      btn.id = 'btnVistaPreviaReceta';
      btn.type = 'button';
      btn.className = 'btn-soft';
      btn.innerHTML = '<i class="bi bi-eye me-1"></i> Vista previa';
      btn.onclick = window.vistaPreviaReceta;
      actions.insertBefore(btn, actions.firstChild);
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    if(el('recFecha') && !val('recFecha')) setVal('recFecha', fechaHoyReceta());
    agregarBotonVistaPrevia();
    asegurarVistaPreviaReceta();
  });

  document.addEventListener('input', function(e){
    const ids = ['recFecha','recMedico','recCie10','recDiagnostico','recMedicamento','recIndicaciones','recRecomendaciones'];
    if(ids.includes(e.target?.id || '') && el('recetaPreview')){
      clearTimeout(window.__auroRecetaPreviewTimer);
      window.__auroRecetaPreviewTimer = setTimeout(window.vistaPreviaReceta, 250);
    }
  });

  document.addEventListener('change', function(e){
    const ids = ['recFecha','recEstado'];
    if(ids.includes(e.target?.id || '') && el('recetaPreview')) window.vistaPreviaReceta();
  });

})();
