/* =====================================================
   AUROSANAX ERP - MÓDULO RECETAS
   Archivo: recetas.js
   Versión: 2.2 diagnóstico CIE-10 persistente por atención
   Función: vista previa profesional + PDF + historial local filtrado por paciente + paginación + acciones verticales + refresco estable
            + edición independiente de recetas + vínculo con atenciones.
            + guardado JSON + impresión premium compacta + edición responsive + hora local Ecuador + edición limpia sin duplicidades.
   Importante:
   - No modifica Plan automáticamente desde Recetas.
   - Mantiene sincronización Plan → Receta.
   - No modifica pacientes, agenda, dashboard, antecedentes ni examen físico.
===================================================== */

(function(){
  'use strict';

  const STORAGE_KEY = 'aurosanax_recetas_emitidas_v1';
  let recetaEditandoId = null;
  let recetasPaginaActual = 1;
  const RECETAS_POR_PAGINA = 5;
  let recetasHistorialVisible = true;
  let recetaAccionesAbiertaId = '';
  let recetaGuardando = false;
  let recetaEstadoVisual = '';
  let recetaEstadoTimer = null;
  let recetaBloqueoPostGuardadoHasta = 0;
  let recetaAtencionActualId = '';
  let recetaNuevaForzada = false;
  let recetaPlanAtencionId = '';
  let recetasSheetsCargadas = false;
  let recetasSheetsCargando = false;
  const recetaDiagnosticosPorAtencionCache = new Map();
  let recetaMedicosActivos = [];
  let recetaMedicosCargados = false;
  let recetaMedicosCargando = null;

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

  function fechaHoraVisual(){
    const d = new Date();
    return d.toLocaleString('es-EC', {
      timeZone:'America/Guayaquil',
      year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'
    });
  }

  function fechaHoraEcuadorISO(){
    const d = new Date();
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone:'America/Guayaquil',
      year:'numeric',
      month:'2-digit',
      day:'2-digit',
      hour:'2-digit',
      minute:'2-digit',
      second:'2-digit',
      hour12:false
    }).formatToParts(d).reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
    return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}:${partes.second}-05:00`;
  }

  function normalizarMedicamentoRecetaObjeto(m){
    m = m || {};
    return {
      med: m.med || m.medicamento || m.nombre || '',
      pres: m.pres || m.presentacion || '',
      via: m.via || '',
      cantidad: m.cantidad || '',
      frec: m.frec || m.frecuencia || '',
      dur: m.dur || m.duracion || '',
      ind: m.ind || m.indicaciones || '',
      continuo: m.continuo || 'No'
    };
  }

  function medicamentoRecetaEsJSON(valor){
    const txt = String(valor || '').trim();
    if(!txt) return false;
    if(!(txt.startsWith('[') || txt.startsWith('{'))) return false;
    try{
      JSON.parse(txt);
      return true;
    }catch(e){
      return false;
    }
  }

  function recetaListaTextoDesdeValor(valor){
    const txt = String(valor || '').trim();
    if(!txt) return [];

    if(txt.startsWith('[') || txt.startsWith('{')){
      try{
        let data = JSON.parse(txt);
        if(!Array.isArray(data)) data = [data];

        return data
          .map(item => {
            if(typeof item === 'string') return item;
            if(item && typeof item === 'object'){
              return item.texto || item.descripcion || item.indicacion || item.recomendacion || '';
            }
            return '';
          })
          .map(x => String(x || '').trim())
          .filter(Boolean);
      }catch(e){}
    }

    return txt
      .split(/\r?\n+/)
      .map(x => String(x || '').replace(/^[•\-]\s*/, '').trim())
      .filter(Boolean);
  }

  function recetaClaveLinea(valor){
    return String(valor || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function recetaDeduplicarLineas(valor){
    const vistas = new Set();
    const salida = [];

    recetaListaTextoDesdeValor(valor).forEach(linea => {
      const limpia = String(linea || '').trim();
      const clave = recetaClaveLinea(limpia);
      if(!limpia || !clave || vistas.has(clave)) return;
      vistas.add(clave);
      salida.push(limpia);
    });

    return salida;
  }

  function recetaListaParaGuardarJSON(valor){
    const lista = recetaDeduplicarLineas(valor);
    return lista.length ? JSON.stringify(lista) : '';
  }

  function recetaListaParaFormulario(valor){
    return recetaDeduplicarLineas(valor).join('\n');
  }

  function medicamentoRecetaJSONATexto(valor){
    const txt = String(valor || '').trim();
    if(!txt) return '';

    if(!medicamentoRecetaEsJSON(txt)){
      return txt;
    }

    try{
      let data = JSON.parse(txt);
      if(!Array.isArray(data)) data = [data];

      return data.map((item, i) => {
        if(typeof item === 'string'){
          return `${i + 1}. ${item}`;
        }

        if(item && item.texto){
          const limpio = String(item.texto || '').trim();
          return /^\d+\./.test(limpio) ? limpio : `${i + 1}. ${limpio}`;
        }

        const m = normalizarMedicamentoRecetaObjeto(item || {});
        const linea = [
          `${i + 1}. ${m.med || ''}`,
          m.pres || '',
          m.via || '',
          m.cantidad ? `Cantidad: ${m.cantidad}` : '',
          m.frec || '',
          m.dur ? `por ${m.dur}` : '',
          m.ind || ''
        ].filter(Boolean).join(' - ');

        return m.continuo === 'Sí'
          ? linea + ' - Tratamiento continuo'
          : linea;
      }).filter(Boolean).join('\n');

    }catch(e){
      return txt;
    }
  }


  /* =====================================================
     RECETA PREMIUM COMPACTA
     - No cambia guardado JSON.
     - Solo convierte datos para vista previa/PDF y mejora UI de edición.
  ===================================================== */

  function recetaMedicamentosALista(valor){
    const txt = String(valor || '').trim();
    if(!txt) return [];

    if(medicamentoRecetaEsJSON(txt)){
      try{
        let data = JSON.parse(txt);
        if(!Array.isArray(data)) data = [data];
        return data.map(item => {
          if(typeof item === 'string') return { texto: item };
          if(item && item.texto) return { texto: String(item.texto || '').trim() };
          return normalizarMedicamentoRecetaObjeto(item || {});
        }).filter(x => (x.texto || x.med || '').trim());
      }catch(e){
        return [];
      }
    }

    return txt.split(/\n+/)
      .map(x => x.replace(/^\s*\d+\.\s*/, '').trim())
      .filter(Boolean)
      .map(x => ({ texto: x }));
  }

  function recetaNormalizarPlano(txt){
    return String(txt || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function recetaTituloMedicamentoPremium(m){
    if(m.texto) return safe(m.texto.replace(/^\s*\d+\.\s*/, '').trim());

    const med = String(m.med || '').trim();
    const pres = String(m.pres || '').trim();
    if(!pres) return safe(med);

    const nMed = recetaNormalizarPlano(med);
    const nPres = recetaNormalizarPlano(pres);

    // Evita duplicados como "Clotrimazol óvulo vaginal óvulo vaginal".
    if(nMed && nPres && nMed.includes(nPres)) return safe(med);

    return safe([med, pres].filter(Boolean).join(' '));
  }


  function recetaTituloMedicamentoPlano(m){
    if(m.texto) return String(m.texto || '').replace(/^\s*\d+\.\s*/, '').trim();

    const med = String(m.med || '').trim();
    const pres = String(m.pres || '').trim();
    if(!pres) return med;

    const nMed = recetaNormalizarPlano(med);
    const nPres = recetaNormalizarPlano(pres);

    // Evita duplicados como "Clotrimazol óvulo vaginal óvulo vaginal".
    if(nMed && nPres && nMed.includes(nPres)) return med;

    return [med, pres].filter(Boolean).join(' ');
  }

  function recetaMedicamentoTextoAObjeto(linea){
    const original = String(linea || '').replace(/^\s*\d+\.\s*/, '').trim();
    if(!original) return null;

    const partes = original.split(' - ').map(x => x.trim()).filter(Boolean);

    if(partes.length < 3){
      return { texto: original };
    }

    return {
      med: partes[0] || '',
      pres: partes[1] || '',
      via: partes[2] || '',
      cantidad: /^Cantidad:/i.test(partes[3] || '') ? (partes[3] || '').replace(/^Cantidad:\s*/i, '') : '',
      frec: /^Cantidad:/i.test(partes[3] || '') ? (partes[4] || '') : (partes[3] || ''),
      dur: (partes.find(x => /^por\s+/i.test(x)) || '').replace(/^por\s+/i, ''),
      ind: partes.filter(x => !/^Cantidad:/i.test(x) && !/^por\s+/i.test(x)).slice(/^Cantidad:/i.test(partes[3] || '') ? 5 : 4).join(' - '),
      continuo: /tratamiento\s+continuo/i.test(original) ? 'Sí' : 'No'
    };
  }

  function recetaMedicamentosListaEdicion(valor){
    const medsPlan = recetaMedicamentosPlanActualesSeguros();

    if(medsPlan.length){
      return medsPlan;
    }

    return recetaMedicamentosALista(valor).map(item => {
      if(item && item.texto){
        return recetaMedicamentoTextoAObjeto(item.texto) || item;
      }
      return normalizarMedicamentoRecetaObjeto(item || {});
    }).filter(x => (x.texto || x.med || '').trim());
  }

  function recetaMedicamentosEdicionTexto(valor){
    const lista = recetaMedicamentosListaEdicion(valor);
    if(!lista.length) return String(valor || '').trim();

    return lista.map((item, i) => {
      if(item.texto){
        return `${i + 1}. ${String(item.texto || '').replace(/^\s*\d+\.\s*/, '').trim()}`;
      }

      const m = normalizarMedicamentoRecetaObjeto(item);
      const lineas = [];
      lineas.push(`${i + 1}. ${recetaTituloMedicamentoPlano(m)}`.trim());

      const detalle = [
        m.via ? `Vía: ${m.via}` : '',
        m.cantidad ? `Cantidad: ${m.cantidad}` : '',
        m.frec ? `Frecuencia: ${m.frec}` : '',
        m.dur ? `Duración: ${m.dur}` : '',
        m.continuo === 'Sí' ? 'Tratamiento continuo' : ''
      ].filter(Boolean).join(' · ');

      if(detalle) lineas.push(`   ${detalle}`);
      if(m.ind) lineas.push(`   Indicaciones: ${m.ind}`);

      return lineas.join('\n');
    }).join('\n\n');
  }

  function auroRecetaNormalizarMedicamentosEdicionSiSeguro(){
    const campo = el('recMedicamento');
    if(!campo) return;

    const actual = campo.value || '';
    const nuevo = recetaMedicamentosEdicionTexto(actual);

    if(nuevo && nuevo !== actual){
      campo.value = nuevo;
    }
  }

  function auroRecetaCodigoNormalizado(codigo){
    return String(codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function auroRecetaDiagnosticoGenerico(txt){
    const n = recetaNormalizarPlano(txt);

    if(!n) return true;

    const exactos = new Set([
      'diagnostico principal',
      'diagnostico',
      'motivo de receta',
      'sin diagnostico',
      'diagnostico clinico',
      'diagnostico clinico relacionado',
      'diagnostico relacionado'
    ]);

    if(exactos.has(n)) return true;

    return (
      n.startsWith('diagnostico clinico relacionado') ||
      n.startsWith('diagnostico clinico') ||
      n === 'clinico'
    );
  }

  function auroRecetaBuscarDiagnosticoActivoPorCIE(cie){
    const cieNorm = auroRecetaCodigoNormalizado(cie);
    if(!cieNorm) return '';

    const posiblesBodies = [
      document.getElementById('hcDxSeleccionadosBody'),
      document.getElementById('hcDiagnosticosSeleccionadosBody'),
      document.getElementById('hcDiagnosticosPreviosBody')
    ].filter(Boolean);

    for(const body of posiblesBodies){
      const filas = Array.from(body.querySelectorAll('tr'));
      for(const tr of filas){
        const txtFila = String(tr.innerText || '').replace(/\s+/g, ' ').trim();
        if(!txtFila) continue;
        if(!txtFila.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(cieNorm)) continue;

        const celdas = Array.from(tr.querySelectorAll('td')).map(td => String(td.innerText || '').trim()).filter(Boolean);
        const nombre = celdas.find(c => {
          const cn = auroRecetaCodigoNormalizado(c);
          return cn !== cieNorm && !/^principal|presuntivo|definitivo|accion|agregar$/i.test(c);
        });

        if(nombre && !auroRecetaDiagnosticoGenerico(nombre)){
          return `${cie} - ${nombre.replace(/^\s*[-–]\s*/, '')}`;
        }

        return txtFila;
      }
    }

    return '';
  }

  function auroRecetaBuscarDiagnosticoPersistido(cie){
    const cieNorm = auroRecetaCodigoNormalizado(cie);
    const idAtencion = obtenerIdAtencionActivaSeguro();
    const paciente = obtenerPacienteActivoSeguro();
    const idPaciente = String(paciente?.id_paciente || paciente?.id || '').trim();

    const fuentes = [
      window.hcDiagnosticosSeleccionados,
      window.diagnosticos,
      window.diagnosticosClinicos,
      window.examenFisicoState?.diagnosticos
    ].filter(Array.isArray);

    for(const lista of fuentes){
      const encontrados = lista.filter(dx => {
        const codigo = auroRecetaCodigoNormalizado(
          dx.codigo_cie10 || dx.diagnostico_cie10 || dx.cie10 || dx.codigo || ''
        );
        const coincideAtencion = !idAtencion || !dx.id_atencion ||
          String(dx.id_atencion) === String(idAtencion);
        const coincidePaciente = !idPaciente || !dx.id_paciente ||
          String(dx.id_paciente) === String(idPaciente);
        return codigo === cieNorm && coincideAtencion && coincidePaciente;
      });

      const principal = encontrados.find(dx =>
        String(dx.principal || '').toUpperCase() === 'SI'
      ) || encontrados[0];

      const descripcion = String(
        principal?.descripcion ||
        principal?.diagnostico ||
        principal?.nombre ||
        ''
      ).trim();

      if(descripcion && !auroRecetaDiagnosticoGenerico(descripcion)){
        return cie ? `${cie} - ${descripcion}` : descripcion;
      }
    }

    return '';
  }

  function auroRecetaObtenerDiagnosticoAutomatico(){
    const cie = val('recCie10') || val('hcCie10Principal');
    const dxDOM = auroRecetaBuscarDiagnosticoActivoPorCIE(cie);
    if(dxDOM && !auroRecetaDiagnosticoGenerico(dxDOM)) return dxDOM;

    const dxPersistido = auroRecetaBuscarDiagnosticoPersistido(cie);
    if(dxPersistido && !auroRecetaDiagnosticoGenerico(dxPersistido)){
      return dxPersistido;
    }

    const dx = val('hcDiagnosticoPrincipal') || val('hcDiagnosticoResumen') || val('hcDiagnosticoTexto') || '';
    if(dx && !auroRecetaDiagnosticoGenerico(dx)){
      const cieNorm = auroRecetaCodigoNormalizado(cie);
      const dxNorm = auroRecetaCodigoNormalizado(dx);
      return cie && !dxNorm.includes(cieNorm) ? `${cie} - ${dx}` : dx;
    }

    /*
      No fabricar una descripción clínica.
      Si todavía no existe una descripción real, se devuelve vacío para que
      el flujo asíncrono la consulte por id_atencion en diagnósticos.
    */
    return '';
  }

  function auroRecetaAutocompletarDiagnosticoSiVacio(){
    if(!val('recCie10') && val('hcCie10Principal')){
      setVal('recCie10', val('hcCie10Principal'));
    }

    const actual = val('recDiagnostico');
    if(actual && !auroRecetaDiagnosticoGenerico(actual)) return;

    const dx = auroRecetaObtenerDiagnosticoAutomatico();
    if(dx) setVal('recDiagnostico', dx);
  }

  function recetaMedicamentosPremiumHTML(valor){
    const lista = recetaMedicamentosALista(valor);
    if(!lista.length){
      const texto = medicamentoRecetaJSONATexto(valor);
      return texto ? nl2br(texto) : 'Sin medicamentos registrados.';
    }

    return '<div class="auro-rx-list">' + lista.map((item, i) => {
      if(item.texto){
        return '<div class="auro-rx-item compacto">' +
          '<div class="auro-rx-title"><span class="auro-rx-num">' + (i + 1) + '</span><b>' + safe(item.texto.replace(/^\s*\d+\.\s*/, '')) + '</b></div>' +
        '</div>';
      }

      const m = normalizarMedicamentoRecetaObjeto(item);
      const detalle = [
        m.via ? '<span><b>Vía:</b> ' + safe(m.via) + '</span>' : '',
        m.frec ? '<span><b>Frecuencia:</b> ' + safe(m.frec) + '</span>' : '',
        m.dur ? '<span><b>Duración:</b> ' + safe(m.dur) + '</span>' : '',
        m.cantidad ? '<span><b>Cantidad:</b> ' + safe(m.cantidad) + '</span>' : ''
      ].filter(Boolean).join('');

      return '<div class="auro-rx-item">' +
        '<div class="auro-rx-title"><span class="auro-rx-num">' + (i + 1) + '</span><b>' + recetaTituloMedicamentoPremium(m) + '</b>' + (m.continuo === 'Sí' ? '<em>Continuo</em>' : '') + '</div>' +
        (detalle ? '<div class="auro-rx-meta">' + detalle + '</div>' : '') +
        (m.ind ? '<div class="auro-rx-ind"><b>Indicaciones:</b> ' + safe(m.ind) + '</div>' : '') +
      '</div>';
    }).join('') + '</div>';
  }

  function recetaBloqueTextoPremium(texto, vacio){
    const partes = recetaDeduplicarLineas(texto);
    if(!partes.length){
      return '<div class="auro-empty-note">' + safe(vacio || '—') + '</div>';
    }
    if(partes.length === 1){
      return '<div class="auro-text-premium">' + safe(partes[0]) + '</div>';
    }
    return '<div class="auro-text-premium"><ul>' +
      partes.map(x => '<li>' + safe(x) + '</li>').join('') +
      '</ul></div>';
  }

  function instalarEstilosEdicionRecetaPremium(){
    if(document.getElementById('auro-receta-edicion-premium-style')) return;
    const style = document.createElement('style');
    style.id = 'auro-receta-edicion-premium-style';
    style.textContent = `
      #recetas .cardx{border-radius:20px!important;box-shadow:0 14px 36px rgba(15,23,42,.07)!important;}
      #recetas label,.receta-label{font-weight:850!important;color:#374151!important;letter-spacing:.01em;}
      #recMedicamento,#recIndicaciones,#recRecomendaciones{
        border:1px solid #ead5e2!important;
        border-radius:16px!important;
        background:linear-gradient(135deg,#ffffff,#fff8fc)!important;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 6px 18px rgba(139,30,90,.045)!important;
        color:#111827!important;
        font-size:13.5px!important;
        line-height:1.45!important;
        padding:12px 14px!important;
        resize:vertical!important;
      }
      #recMedicamento{min-height:150px!important;font-family:Arial,system-ui,sans-serif!important;}
      #recIndicaciones{min-height:92px!important;}
      #recRecomendaciones{min-height:82px!important;background:linear-gradient(135deg,#ffffff,#f8fafc)!important;}
      #recMedicamento:focus,#recIndicaciones:focus,#recRecomendaciones:focus{
        border-color:#c23b83!important;
        box-shadow:0 0 0 3px rgba(194,59,131,.12),0 8px 22px rgba(139,30,90,.08)!important;
        outline:none!important;
      }
      #recetas .form-control,#recetas .form-select{
        border-radius:14px!important;
      }
      #recetas label[for="recMedicamento"],#recetas label[for="recIndicaciones"],#recetas label[for="recRecomendaciones"]{display:flex;align-items:center;gap:7px;margin-bottom:7px!important;color:#5a1740!important;}
      #recetas label[for="recMedicamento"]:before,#recetas label[for="recIndicaciones"]:before,#recetas label[for="recRecomendaciones"]:before{content:"";width:7px;height:7px;border-radius:50%;background:#c23b83;box-shadow:0 0 0 4px #fdf2f8;flex:0 0 auto;}
      #recetaPreview{border-radius:22px!important;}
      @media(max-width:760px){
        #recetas .cardx{padding:14px!important;border-radius:18px!important;}
        #recetas .section-head{gap:10px!important;}
        #recetas .section-head h4{font-size:20px!important;line-height:1.08!important;}
        #recetas .row.g-3{row-gap:10px!important;}
        #recMedicamento,#recIndicaciones,#recRecomendaciones{
          font-size:13px!important;
          padding:11px 12px!important;
          border-radius:15px!important;
        }
        #recMedicamento{min-height:132px!important;}
        #recIndicaciones{min-height:82px!important;}
        #recRecomendaciones{min-height:76px!important;}
        #recetas button{min-height:42px!important;white-space:normal!important;}
      }
    `;
    document.head.appendChild(style);
  }

  function recetaMedicamentosPlanActualesSeguros(){
    const idAtencionActual = obtenerIdAtencionActivaSeguro();
    const idAtencionPlan = String(window.planState?.atencionActual || recetaPlanAtencionId || '').trim();

    if(!idAtencionActual || !idAtencionPlan || idAtencionActual !== idAtencionPlan){
      return [];
    }

    const meds = Array.isArray(window.medicamentosPlanSeleccionados)
      ? window.medicamentosPlanSeleccionados
      : [];

    return meds
      .map(normalizarMedicamentoRecetaObjeto)
      .filter(m => String(m.med || m.texto || '').trim());
  }

  function recetaPlanPerteneceAtencionActiva(){
    const idAtencionActual = String(obtenerIdAtencionActivaSeguro() || '').trim();
    const idAtencionPlan = String(window.planState?.atencionActual || recetaPlanAtencionId || '').trim();
    return !!(idAtencionActual && idAtencionPlan && idAtencionActual === idAtencionPlan);
  }

  function recetaTieneMedicamentosReales(valor){
    return recetaMedicamentosALista(valor).some(item => {
      if(item && item.texto){
        return String(item.texto || '').replace(/^\s*\d+\.\s*/, '').trim();
      }
      const m = normalizarMedicamentoRecetaObjeto(item || {});
      return String(m.med || '').trim();
    });
  }

  function limpiarFormularioRecetaPorCambioAtencion(){
    recetaEditandoId = null;
    recetaNuevaForzada = false;
    recetaEstadoVisual = '';
    recetaBloqueoPostGuardadoHasta = 0;
    if(recetaEstadoTimer){ clearTimeout(recetaEstadoTimer); recetaEstadoTimer = null; }

    setVal('recFecha', fechaHoyReceta());
    setVal('recEstado', 'Emitida');
    setVal('recCie10', '');
    setVal('recDiagnostico', '');
    setVal('recMedicamento', '');
    setVal('recIndicaciones', '');
    setVal('recRecomendaciones', '');

    /* No se borran arrays del Plan: únicamente se corta la reutilización
       de datos hasta que el Plan corresponda a la nueva atención. */
    recetaPlanAtencionId = String(window.planState?.atencionActual || '').trim();
    actualizarBotonGuardarReceta();

    const box = el('recetaPreview');
    if(box){
      box.innerHTML = '<div class="text-muted text-center py-4">Nueva consulta activa. La receta quedó limpia y solo cargará medicamentos cuando el Plan corresponda a esta atención.</div>';
    }

    cargarMedicosActivosReceta(false).then(function(){
      sincronizarMedicoRecetaDesdeAtencion();
    });
  }

  function medicamentoRecetaParaGuardarJSON(textoFormulario){
    const actual = String(textoFormulario || '').trim();

    if(medicamentoRecetaEsJSON(actual)){
      return actual;
    }

    const medsPlan = recetaMedicamentosPlanActualesSeguros();

    if(medsPlan.length){
      return JSON.stringify(medsPlan);
    }

    if(!actual) return '';

    const bloques = actual.split(/\n\s*\n+/).map(x => x.trim()).filter(Boolean);
    const lineas = bloques.length > 1 ? bloques : actual.split(/\n+/).map(x => x.trim()).filter(Boolean);

    return JSON.stringify(lineas.map(x => ({
      texto: x.replace(/^\s*\d+\.\s*/, '').replace(/\n\s*/g, ' · ')
    })));
  }

  function fechaVisual(fecha){
    if(!fecha) return '';
    const s = String(fecha);
    if(/^\d{4}-\d{2}-\d{2}/.test(s)){
      const p = s.slice(0,10).split('-');
      return `${p[2]}/${p[1]}/${p[0]}`;
    }
    return s;
  }

  function recetaIdMedicoRegistro(m){
    return String(m?.id_medico || m?.id || m?.codigo || '').trim();
  }

  function recetaNombreMedicoRegistro(m){
    return String(
      m?.nombre_completo ||
      m?.nombre ||
      ((m?.nombres || '') + ' ' + (m?.apellidos || ''))
    ).replace(/\s+/g,' ').trim();
  }

  async function cargarMedicosActivosReceta(forzar){
    if(recetaMedicosCargados && !forzar) return recetaMedicosActivos;
    if(recetaMedicosCargando) return recetaMedicosCargando;

    recetaMedicosCargando = (async function(){
      try{
        if(typeof API_URL === 'undefined' || !API_URL){
          throw new Error('API_URL no está definida.');
        }

        const res = await fetch(API_URL + '?accion=listarMedicosActivos&_=' + Date.now());
        if(!res.ok) throw new Error('Error HTTP ' + res.status);

        const data = await res.json();
        recetaMedicosActivos = Array.isArray(data)
          ? data
          : (Array.isArray(data?.data) ? data.data : []);

        recetaMedicosActivos = recetaMedicosActivos.filter(function(m){
          return !!recetaIdMedicoRegistro(m);
        });

        recetaMedicosCargados = true;
        return recetaMedicosActivos;
      }catch(error){
        recetaMedicosActivos = [];
        recetaMedicosCargados = false;
        console.warn('AUROSANAX RECETAS: no se pudieron cargar médicos activos.', error);
        return [];
      }finally{
        recetaMedicosCargando = null;
      }
    })();

    return recetaMedicosCargando;
  }

  function obtenerMedicoDesdeAtencionActiva(){
    try{
      const atencion = obtenerAtencionActivaSegura();
      if(!atencion) return { id_medico:'', nombre:'', registro:null };

      const idMedico = String(atencion.id_medico || atencion.medico_id || '').trim();
      if(!idMedico) return { id_medico:'', nombre:'', registro:null };

      const listas = [
        recetaMedicosActivos,
        window.medicos,
        window.medicosActivos,
        window.listaMedicos,
        window.configuracionMedicos,
        window.medicosConfiguracion
      ].filter(Array.isArray);

      let encontrado = null;
      for(const lista of listas){
        encontrado = lista.find(function(m){
          return recetaIdMedicoRegistro(m) === idMedico;
        }) || null;
        if(encontrado) break;
      }

      return {
        id_medico: idMedico,
        nombre: recetaNombreMedicoRegistro(encontrado),
        registro: encontrado || null
      };
    }catch(error){
      console.warn('AUROSANAX RECETAS: no se pudo resolver médico de la atención.', error);
      return { id_medico:'', nombre:'', registro:null };
    }
  }

  function sincronizarMedicoRecetaDesdeAtencion(){
    const medico = obtenerMedicoDesdeAtencionActiva();
    if(medico.nombre){
      setVal('recMedico', medico.nombre);
    }
    return medico;
  }

  function obtenerNombreMedicoReal(){
    const desdeAtencion = obtenerMedicoDesdeAtencionActiva();
    if(desdeAtencion.nombre) return desdeAtencion.nombre;
    const campo = val('recMedico');
    if(campo) return campo;
    return 'Profesional tratante';
  }

  function obtenerIdMedicoReal(){
    try{
      const desdeAtencion = obtenerMedicoDesdeAtencionActiva();
      if(desdeAtencion.id_medico) return desdeAtencion.id_medico;

      if(typeof window.idMedicoActual === 'string' && window.idMedicoActual.trim()){
        return window.idMedicoActual.trim();
      }

      if(typeof window.getMedicoActivo === 'function'){
        const m = window.getMedicoActivo();
        const id = recetaIdMedicoRegistro(m);
        if(id) return id;
      }

      return '';
    }catch(error){
      console.warn('AUROSANAX RECETAS: no se pudo obtener id_medico real.', error);
      return '';
    }
  }

  function obtenerCodigoCortoMedico(idMedicoOpcional){
    try{
      const idMedico = String(idMedicoOpcional || obtenerIdMedicoReal() || '').trim();
      const partes = idMedico.split('-').filter(Boolean);
      const ultimo = partes.length ? partes[partes.length - 1] : idMedico;
      const limpio = String(ultimo || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

      return limpio || 'SINMEDICO';

    }catch(e){
      return 'SINMEDICO';
    }
  }

  function crearIdReceta(idMedicoOpcional){
    const d = new Date();

    const fecha =
      d.getFullYear() +
      String(d.getMonth() + 1).padStart(2,'0') +
      String(d.getDate()).padStart(2,'0');

    const hora =
      String(d.getHours()).padStart(2,'0') +
      String(d.getMinutes()).padStart(2,'0') +
      String(d.getSeconds()).padStart(2,'0');

    const codigoMedico = obtenerCodigoCortoMedico(idMedicoOpcional);
    const control = String(Math.floor(Math.random() * 90) + 10);

    return 'REC-' + fecha + '-' + hora + '-' + codigoMedico + '-' + control;
  }

  function obtenerPacienteActivoSeguro(){
    try{ if(typeof getPacienteActivo === 'function') return getPacienteActivo(); }catch(e){}
    return null;
  }

  function coincideConPacienteActivo(receta){
    const paciente = obtenerPacienteActivoSeguro();
    if(!paciente) return false;

    const idPaciente = String(paciente.id_paciente || paciente.id || '').trim();
    const cedulaPaciente = String(paciente.cedula || paciente.numero_documento || paciente.documento || '').replace(/\D/g,'');
    const nombrePaciente = String(paciente.nombre || ((paciente.nombres || '') + ' ' + (paciente.apellidos || '')))
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');

    const idRecetaPaciente = String(receta.id_paciente || '').trim();
    const cedulaReceta = String(receta.paciente_cedula || receta.cedula || receta.numero_documento || '').replace(/\D/g,'');
    const nombreReceta = String(receta.paciente_nombre || receta.paciente || receta.nombre || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');

    return (
      (idPaciente && idRecetaPaciente && idPaciente === idRecetaPaciente) ||
      (cedulaPaciente && cedulaReceta && cedulaPaciente === cedulaReceta) ||
      (nombrePaciente && nombreReceta && nombrePaciente === nombreReceta)
    );
  }


  function obtenerAtencionActivaSegura(){
    try{
      if(typeof window.getAtencionActiva === 'function'){
        const a = window.getAtencionActiva();
        if(a && (a.id_atencion || a.id)) return a;
      }
    }catch(e){
      console.warn('No se pudo obtener la atención activa.', e);
    }
    return null;
  }

  function obtenerIdAtencionActivaSeguro(){
    try{
      const atencion = obtenerAtencionActivaSegura();
      if(atencion){
        return String(atencion.id_atencion || atencion.id || '').trim();
      }

      if(typeof window.getIdAtencionActiva === 'function'){
        return String(window.getIdAtencionActiva() || '').trim();
      }

      return String(
        window.planState?.atencionActual ||
        window.examenFisicoState?.atencionActual ||
        ''
      ).trim();
    }catch(e){
      console.warn('No se pudo obtener id_atencion activo.', e);
      return '';
    }
  }

  async function auroRecetaConsultarDiagnosticosAtencion(idAtencion){
    idAtencion = String(idAtencion || '').trim();
    if(!idAtencion) return [];

    if(recetaDiagnosticosPorAtencionCache.has(idAtencion)){
      return recetaDiagnosticosPorAtencionCache.get(idAtencion);
    }

    if(typeof API_URL === 'undefined' || !API_URL) return [];

    try{
      const url = API_URL +
        '?accion=listarDiagnosticosPorAtencion&id_atencion=' +
        encodeURIComponent(idAtencion) +
        '&_=' + Date.now();

      const res = await fetch(url);
      const data = await res.json();
      const lista = Array.isArray(data)
        ? data
        : (Array.isArray(data?.data) ? data.data : []);

      recetaDiagnosticosPorAtencionCache.set(idAtencion, lista);
      return lista;
    }catch(error){
      console.warn('AUROSANAX RECETAS: no se pudieron consultar diagnósticos de la atención.', error);
      return [];
    }
  }

  function auroRecetaObtenerDiagnosticoEstructurado(lista, cie){
    const cieNorm = auroRecetaCodigoNormalizado(cie);
    const items = Array.isArray(lista) ? lista : [];

    const coincidentes = items.filter(dx => {
      const codigo = auroRecetaCodigoNormalizado(
        dx.codigo_cie10 || dx.diagnostico_cie10 || dx.cie10 || dx.codigo || ''
      );
      return !cieNorm || codigo === cieNorm;
    });

    const principal =
      coincidentes.find(dx => String(dx.principal || '').toUpperCase() === 'SI') ||
      coincidentes[0] ||
      items.find(dx => String(dx.principal || '').toUpperCase() === 'SI') ||
      items[0];

    if(!principal) return null;

    const codigo = String(
      principal.codigo_cie10 ||
      principal.diagnostico_cie10 ||
      principal.cie10 ||
      principal.codigo ||
      cie ||
      ''
    ).trim();

    const descripcion = String(
      principal.descripcion ||
      principal.diagnostico ||
      principal.nombre ||
      principal.detalle ||
      ''
    ).trim();

    if(!codigo || !auroRecetaCodigoNormalizado(codigo)) return null;
    if(!descripcion || auroRecetaDiagnosticoGenerico(descripcion)) return null;

    const codigoNorm = auroRecetaCodigoNormalizado(codigo);
    const descripcionNorm = auroRecetaCodigoNormalizado(descripcion);
    const texto = codigo && !descripcionNorm.includes(codigoNorm)
      ? `${codigo} - ${descripcion}`
      : descripcion;

    return { codigo, descripcion, texto, registro: principal };
  }

  function auroRecetaElegirDiagnosticoEstructurado(lista, cie){
    const diagnostico = auroRecetaObtenerDiagnosticoEstructurado(lista, cie);
    return diagnostico ? diagnostico.texto : '';
  }

  async function auroRecetaResolverDiagnosticoEstructurado(){
    const idAtencion = obtenerIdAtencionActivaSeguro();
    const cie = val('recCie10') || val('hcCie10Principal');

    if(!idAtencion) return auroRecetaObtenerDiagnosticoAutomatico();

    const lista = await auroRecetaConsultarDiagnosticosAtencion(idAtencion);
    const estructurado = auroRecetaObtenerDiagnosticoEstructurado(lista, cie);

    if(estructurado){
      setVal('recCie10', estructurado.codigo);
      setVal('recDiagnostico', estructurado.texto);
      return estructurado.texto;
    }

    const fallback = auroRecetaObtenerDiagnosticoAutomatico();
    if(fallback) setVal('recDiagnostico', fallback);
    return fallback;
  }

  async function auroRecetaResolverDiagnosticoPorRecetaGuardada(receta){
    receta = receta || {};

    const actual = String(
      receta.diagnostico ||
      receta.motivo ||
      ''
    ).trim();

    if(actual && !auroRecetaDiagnosticoGenerico(actual)){
      return actual;
    }

    const idAtencion = String(receta.id_atencion || '').trim();
    const cie = String(
      receta.diagnostico_cie10 ||
      receta.cie10 ||
      ''
    ).trim();

    if(!idAtencion){
      return '';
    }

    const lista = await auroRecetaConsultarDiagnosticosAtencion(idAtencion);
    const real = auroRecetaElegirDiagnosticoEstructurado(lista, cie);

    if(real){
      receta.diagnostico = real;

      /*
        Actualiza únicamente el respaldo local de esa misma receta.
        No cambia id_atencion, medicamentos, Plan ni Google Sheets.
      */
      const almacenadas = leerRecetasStorage();
      const indice = almacenadas.findIndex(x =>
        String(x.id_receta || '') === String(receta.id_receta || '')
      );

      if(indice >= 0){
        almacenadas[indice] = {
          ...almacenadas[indice],
          diagnostico: real
        };
        guardarRecetasStorage(almacenadas);
      }
    }

    return real || '';
  }

  function obtenerIdHistoriaActivaSeguro(idPaciente){
    const pacienteId = String(idPaciente || '').trim();

    try{
      const atencion = obtenerAtencionActivaSegura();
      const historiaAtencion = String(atencion?.id_historia || '').trim();
      const pacienteAtencion = String(atencion?.id_paciente || '').trim();

      if(
        historiaAtencion &&
        (!pacienteId || !pacienteAtencion || pacienteId === pacienteAtencion)
      ){
        return historiaAtencion;
      }

      const candidatos = [
        window.auroHistoriaSeleccionadaId,
        window.editingHistoryId,
        window.historiaActual?.id_historia,
        window.currentHistoria?.id_historia
      ];

      for(const valor of candidatos){
        const id = String(valor || '').trim();
        if(id) return id;
      }
    }catch(e){
      console.warn('No se pudo obtener id_historia activo.', e);
    }

    return '';
  }

  async function enviarRecetaGoogleSheets(receta){
    try{
      if(!receta) return { success:false, message:'No hay receta para enviar' };

      if(typeof API_URL === 'undefined' || !API_URL){
        return { success:false, message:'API_URL no está definida' };
      }

      const data = {
        id_receta: receta.id_receta || '',
        id_paciente: receta.id_paciente || '',
        id_historia: receta.id_historia || '',
        id_medico: receta.id_medico || obtenerIdMedicoReal() || '',
        fecha_receta: receta.fecha_receta || fechaHoyReceta(),
        diagnostico_cie10: receta.diagnostico_cie10 || '',
        diagnostico: receta.diagnostico || '',
        medicamento: receta.medicamento || '',
        presentacion: receta.presentacion || '',
        dosis: receta.dosis || '',
        via: receta.via || '',
        frecuencia: receta.frecuencia || '',
        duracion: receta.duracion || '',
        cantidad: receta.cantidad || '',
        indicaciones: recetaListaParaGuardarJSON(receta.indicaciones || ''),
        recomendaciones: recetaListaParaGuardarJSON(receta.recomendaciones || ''),
        id_documento: receta.id_documento || '',
        estado: receta.estado || 'Emitida',
        creado_en: receta.creado_en || fechaHoraEcuadorISO(),
        actualizado_en: fechaHoraEcuadorISO(),
        id_atencion: receta.id_atencion || obtenerIdAtencionActivaSeguro() || '',
        forzar_nueva_receta: receta.forzar_nueva_receta || 'NO'
      };

      await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          accion: 'guardarReceta',
          data: data
        })
      });

      return { success:true, message:'Receta enviada a Google Sheets' };

    }catch(error){
      console.error('Error enviando receta a Google Sheets:', error);
      return { success:false, message:error.message };
    }
  }


  function obtenerHistoriasPaciente(idPaciente){
    try{
      if(!Array.isArray(window.historiasClinicas)) return [];
      return window.historiasClinicas.filter(h => String(h.id_paciente || h.paciente_id || '') === String(idPaciente || ''));
    }catch(e){ return []; }
  }

  function obtenerUltimaHistoriaPaciente(idPaciente){
    const hs = obtenerHistoriasPaciente(idPaciente);
    if(!hs.length) return null;
    return hs.slice().sort((a,b) => {
      const fa = String(a.actualizado_en || a.fecha_atencion || a.fecha || '');
      const fb = String(b.actualizado_en || b.fecha_atencion || b.fecha || '');
      return fb.localeCompare(fa);
    })[0];
  }

  function leerRecetasStorage(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(e){
      console.warn('No se pudo leer historial local de recetas.', e);
      return [];
    }
  }

  function guardarRecetasStorage(arr){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(arr) ? arr : [])); }
    catch(e){ console.warn('No se pudo guardar historial local de recetas.', e); }
  }

  function normalizarRecetaGuardada(r){
    r = r || {};
    return {
      id_receta: r.id_receta || r.id || '',
      id_paciente: r.id_paciente || r.paciente_id || '',
      id_historia: r.id_historia || '',
      id_atencion: r.id_atencion || '',
      id_medico: r.id_medico || obtenerIdMedicoReal(),
      codigo_medico: r.codigo_medico || obtenerCodigoCortoMedico(r.id_medico || obtenerIdMedicoReal()),
      paciente_nombre: r.paciente_nombre || r.paciente || r.nombre || '',
      paciente_cedula: r.paciente_cedula || r.cedula || r.numero_documento || '',
      paciente_telefono: r.paciente_telefono || r.telefono || r.whatsapp || '',
      fecha_receta: r.fecha_receta || r.fecha || fechaHoyReceta(),
      medico: r.medico || r.nombre_medico || obtenerNombreMedicoReal(),
      diagnostico_cie10: r.diagnostico_cie10 || r.cie10 || '',
      diagnostico: auroRecetaDiagnosticoGenerico(r.diagnostico || r.motivo || '')
        ? ''
        : (r.diagnostico || r.motivo || ''),
      medicamento: r.medicamento || r.medicamentos || '',
      presentacion: r.presentacion || '',
      dosis: r.dosis || '',
      via: r.via || '',
      frecuencia: r.frecuencia || '',
      duracion: r.duracion || '',
      cantidad: r.cantidad || '',
      indicaciones: recetaListaParaGuardarJSON(r.indicaciones || ''),
      recomendaciones: recetaListaParaGuardarJSON(r.recomendaciones || r.observaciones || ''),
      id_documento: r.id_documento || '',
      estado: r.estado || 'Emitida',
      creado_en: r.creado_en || '',
      actualizado_en: r.actualizado_en || ''
    };
  }

  function recetaTiempoSincronizacion(r){
    r = r || {};
    const valor = String(
      r.actualizado_en ||
      r.creado_en ||
      r.fecha_receta ||
      ''
    ).trim();

    if(!valor) return 0;

    const directo = Date.parse(valor);
    if(Number.isFinite(directo)) return directo;

    /*
      Respaldo para textos históricos tipo:
      yyyy-MM-dd HH:mm:ss / yyyy-MM-ddTHH:mm:ss
      Se comparan como una marca numérica estable, sin convertir zona horaria.
    */
    const m = valor.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
    if(m){
      return Number(
        m[1] + m[2] + m[3] +
        m[4] + m[5] + (m[6] || '00')
      );
    }

    const soloFecha = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(soloFecha){
      return Number(soloFecha[1] + soloFecha[2] + soloFecha[3] + '000000');
    }

    return 0;
  }

  function mezclarRecetasLocalesYSheets(remotas){
    const mapa = new Map();

    /*
      FIX QUIRÚRGICO DE SINCRONIZACIÓN:
      - La versión más reciente gana por actualizado_en/creado_en.
      - Google Sheets ya no reemplaza automáticamente una copia local
        recién guardada con una respuesta remota todavía atrasada.
      - No cambia IDs, anti-duplicidad, guardado ni estructura de recetas.
    */
    leerRecetasStorage().forEach(item => {
      const r = normalizarRecetaGuardada(item);
      if(r.id_receta){
        mapa.set(String(r.id_receta), r);
      }
    });

    (Array.isArray(remotas) ? remotas : []).forEach(item => {
      const remota = normalizarRecetaGuardada(item);
      if(!remota.id_receta) return;

      const id = String(remota.id_receta);
      const local = mapa.get(id);

      if(!local){
        mapa.set(id, remota);
        return;
      }

      const tiempoLocal = recetaTiempoSincronizacion(local);
      const tiempoRemoto = recetaTiempoSincronizacion(remota);

      if(tiempoRemoto > tiempoLocal){
        mapa.set(id, Object.assign({}, local, remota));
      }else{
        mapa.set(id, Object.assign({}, remota, local));
      }
    });

    const mezcladas = Array.from(mapa.values()).sort((a,b) =>
      recetaTiempoSincronizacion(b) - recetaTiempoSincronizacion(a)
    );

    guardarRecetasStorage(mezcladas);
    return mezcladas;
  }

  async function cargarRecetasDesdeSheets(forzar){
    try{
      if(recetasSheetsCargando) return leerRecetasStorage();
      if(recetasSheetsCargadas && !forzar) return leerRecetasStorage();

      if(typeof API_URL === 'undefined' || !API_URL){
        return leerRecetasStorage();
      }

      recetasSheetsCargando = true;

      const res = await fetch(API_URL + '?accion=listarRecetas&_=' + Date.now());
      const data = await res.json();
      const remotas = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);

      const mezcladas = mezclarRecetasLocalesYSheets(remotas);
      recetasSheetsCargadas = true;
      recetasSheetsCargando = false;

      return mezcladas;

    }catch(error){
      recetasSheetsCargando = false;
      console.warn('No se pudieron cargar recetas desde Google Sheets.', error);
      return leerRecetasStorage();
    }
  }

  function mostrarMensajeReceta(texto, tipo){

    function pintarEstadoEn(contenedorId, insertador){
      let box = el(contenedorId);

      if(!box){
        box = document.createElement('div');
        box.id = contenedorId;
        box.className = 'auro-save-status';
        insertador(box);
      }

      box.className = 'auro-save-status ' + (tipo === 'ok' ? 'ok' : '');
      box.innerHTML = texto;
      box.style.display = 'block';
    }

    const seccionRecetas = el('recetas');
    if(seccionRecetas){
      pintarEstadoEn('recetaEstadoBox', function(box){
        const card = seccionRecetas.querySelector('.cardx');
        const row = seccionRecetas.querySelector('.row.g-3');
        if(card && row) card.insertBefore(box, row);
        else card?.prepend(box);
      });
    }
  }

  function marcarEstadoRecetaGuardadaVisual(esActualizacion){
    recetaEstadoVisual = esActualizacion ? 'actualizada' : 'guardada';
    recetaBloqueoPostGuardadoHasta = Date.now() + 2800;

    if(recetaEstadoTimer){
      clearTimeout(recetaEstadoTimer);
    }

    actualizarBotonGuardarReceta();

    recetaEstadoTimer = setTimeout(function(){
      recetaEstadoVisual = '';
      recetaBloqueoPostGuardadoHasta = 0;
      actualizarBotonGuardarReceta();
    }, 2800);
  }

  function obtenerBotonesGuardarReceta(){
    const botones = [];

    function agregar(btn){
      if(btn && !botones.includes(btn)){
        botones.push(btn);
      }
    }

    agregar(el('btnGuardarRecetaERP'));

    document.querySelectorAll('[data-auro-receta-save-btn="1"]').forEach(agregar);
    document.querySelectorAll('button[onclick*="guardarRecetaERP"], a[onclick*="guardarRecetaERP"]').forEach(agregar);

    document.querySelectorAll('button, a').forEach(btn => {
      const txt = String(btn.textContent || '').trim().toLowerCase();
      if(
        txt.includes('guardar receta') ||
        txt.includes('actualizar receta') ||
        txt.includes('guardando') ||
        txt.includes('receta guardada') ||
        txt.includes('receta actualizada')
      ){
        agregar(btn);
      }
    });

    return botones;
  }

  function actualizarBotonGuardarReceta(){
    const botones = obtenerBotonesGuardarReceta();

    botones.forEach((btn, i) => {
      if(!btn.id && i === 0){
        btn.id = 'btnGuardarRecetaERP';
      }

      btn.setAttribute('data-auro-receta-save-btn','1');

      if(recetaGuardando){
        btn.disabled = true;
        btn.setAttribute('aria-busy','true');
        btn.style.opacity = '0.65';
        btn.style.cursor = 'not-allowed';
        btn.style.pointerEvents = 'none';
        btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Guardando receta...';
        return;
      }

      if(recetaEstadoVisual){
        btn.disabled = true;
        btn.removeAttribute('aria-busy');
        btn.style.opacity = '1';
        btn.style.cursor = 'not-allowed';
        btn.style.pointerEvents = 'none';
        btn.innerHTML = recetaEstadoVisual === 'actualizada'
          ? '<i class="bi bi-check-circle me-1"></i> Receta actualizada ✓'
          : '<i class="bi bi-check-circle me-1"></i> Receta guardada ✓';
        return;
      }

      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.style.pointerEvents = '';

      btn.innerHTML = recetaEditandoId
        ? '<i class="bi bi-save me-1"></i> Actualizar receta'
        : '<i class="bi bi-save me-1"></i> Guardar receta';
    });
  }

  function buscarRecetaActivaPorAtencion(idAtencion){
    const id = String(idAtencion || '').trim();
    if(!id) return null;

    return leerRecetasStorage()
      .filter(r =>
        String(r.id_atencion || '').trim() === id &&
        !String(r.estado || '').toLowerCase().includes('anulada')
      )
      .sort((a,b) =>
        String(b.actualizado_en || b.creado_en || b.fecha_receta || '')
          .localeCompare(String(a.actualizado_en || a.creado_en || a.fecha_receta || ''))
      )[0] || null;
  }

  function limpiarFormularioReceta(){
    recetaEditandoId = null;
    recetaNuevaForzada = true;
    recetaAtencionActualId = String(obtenerIdAtencionActivaSeguro() || '').trim();
    recetaPlanAtencionId = String(window.planState?.atencionActual || '').trim();
    recetaEstadoVisual = '';
    recetaBloqueoPostGuardadoHasta = 0;
    if(recetaEstadoTimer){ clearTimeout(recetaEstadoTimer); recetaEstadoTimer = null; }
    setVal('recFecha', fechaHoyReceta());
    sincronizarMedicoRecetaDesdeAtencion();
    setVal('recCie10', '');
    setVal('recEstado', 'Emitida');
    setVal('recDiagnostico', '');
    setVal('recMedicamento', '');
    setVal('recIndicaciones', '');
    setVal('recRecomendaciones', '');
    actualizarBotonGuardarReceta();
    mostrarMensajeReceta('<i class="bi bi-info-circle me-1"></i> Nueva receta. Puede escribir o cargar datos desde Plan.', '');
    vistaPreviaReceta();
  }

  function limpiarEstadoRecetaNuevaDespuesDeGuardar(){
    recetaEditandoId = null;
    recetaNuevaForzada = false;
    recetaAtencionActualId = obtenerIdAtencionActivaSeguro() || '';

    setVal('recDiagnostico', '');
    setVal('recMedicamento', '');
    setVal('recIndicaciones', '');
    setVal('recRecomendaciones', '');

    actualizarBotonGuardarReceta();

    const box = el('recetaPreview');
    if(box){
      box.innerHTML = `<div class="text-muted text-center py-4">Receta guardada correctamente. Para una nueva atención, agregue medicamentos nuevos desde el Plan o presione <b>Nueva receta</b>.</div>`;
    }
  }

  function verificarCambioAtencionReceta(){
    const actual = String(obtenerIdAtencionActivaSeguro() || '').trim();

    if(recetaAtencionActualId && actual && recetaAtencionActualId !== actual){
      limpiarFormularioRecetaPorCambioAtencion();
    }

    recetaAtencionActualId = actual;
    recetaPlanAtencionId = String(window.planState?.atencionActual || '').trim();
  }

  window.obtenerDatosReceta = function(){
    const paciente = obtenerPacienteActivoSeguro();
    const idPaciente = String(paciente?.id_paciente || paciente?.id || '').trim();
    const idHistoriaActiva = obtenerIdHistoriaActivaSeguro(idPaciente);
    const ultimaHistoria = !idHistoriaActiva && paciente
      ? obtenerUltimaHistoriaPaciente(idPaciente)
      : null;

    return {
      id_receta: recetaEditandoId || '',
      id_paciente: idPaciente,
      id_historia: idHistoriaActiva || ultimaHistoria?.id_historia || ultimaHistoria?.id || '',
      id_atencion: obtenerIdAtencionActivaSeguro(),
      paciente: paciente || {},
      fecha: val('recFecha') || fechaHoyReceta(),
      medico: obtenerNombreMedicoReal(),
      id_medico: obtenerIdMedicoReal(),
      codigo_medico: obtenerCodigoCortoMedico(),
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
    box.innerHTML = `<div class="text-muted text-center py-4">Vista previa de receta pendiente. Complete los campos y presione <b>Vista previa</b> o <b>PDF / imprimir</b>.</div>`;

    const nota = seccion.querySelector('.clinical-note.mt-3');
    if(nota && nota.parentNode) nota.parentNode.insertBefore(box, nota.nextSibling);
    else seccion.querySelector('.cardx')?.appendChild(box);
    return box;
  }

  function auroRecetaBuscarPacientePorReceta(r){
    try{
      const activo = obtenerPacienteActivoSeguro();
      const idRecetaPaciente = String(r?.id_paciente || r?.paciente?.id_paciente || r?.paciente?.id || '').trim();
      const cedulaReceta = String(r?.paciente_cedula || r?.cedula || r?.paciente?.cedula || '').replace(/\D/g,'');
      const nombreReceta = String(r?.paciente_nombre || r?.paciente?.nombre || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g,'')
        .replace(/\s+/g,' ');

      if(activo){
        const idActivo = String(activo.id_paciente || activo.id || '').trim();
        const cedulaActiva = String(activo.cedula || activo.numero_documento || activo.documento || '').replace(/\D/g,'');
        const nombreActivo = String(activo.nombre || ((activo.nombres || '') + ' ' + (activo.apellidos || '')))
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g,'')
          .replace(/\s+/g,' ');

        if(
          (idRecetaPaciente && idActivo && idRecetaPaciente === idActivo) ||
          (cedulaReceta && cedulaActiva && cedulaReceta === cedulaActiva) ||
          (nombreReceta && nombreActivo && nombreReceta === nombreActivo)
        ){
          return activo;
        }
      }

      if(Array.isArray(window.patients)){
        return window.patients.find(p => {
          const id = String(p.id_paciente || p.id || '').trim();
          const cedula = String(p.cedula || p.numero_documento || p.documento || '').replace(/\D/g,'');
          const nombre = String(p.nombre || ((p.nombres || '') + ' ' + (p.apellidos || '')))
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g,'')
            .replace(/\s+/g,' ');

          return (
            (idRecetaPaciente && id && idRecetaPaciente === id) ||
            (cedulaReceta && cedula && cedulaReceta === cedula) ||
            (nombreReceta && nombre && nombreReceta === nombre)
          );
        }) || null;
      }

      return null;
    }catch(e){
      return null;
    }
  }


  /* =====================================================
     AUROSANAX RECETAS 3.4 - CÉDULA Y EDAD EN ENCABEZADO
     Intervención quirúrgica:
     - Calcula edad cumplida desde fecha_nacimiento si no viene informada.
     - Formatea la edad como "N años".
     - Amplía únicamente los alias de identificación del paciente.
     - No modifica diseño A4, medicamentos, Plan, guardado ni backend.
  ===================================================== */
  function auroRecetaCalcularEdadCumplida(fechaNacimiento){
    const raw = String(fechaNacimiento || '').trim();
    if(!raw) return '';

    let anio, mes, dia;

    let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m){
      anio = Number(m[1]);
      mes = Number(m[2]);
      dia = Number(m[3]);
    }else{
      m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if(!m) return '';
      dia = Number(m[1]);
      mes = Number(m[2]);
      anio = Number(m[3]);
    }

    if(!anio || !mes || !dia) return '';

    const hoyPartes = new Intl.DateTimeFormat('en-CA', {
      timeZone:'America/Guayaquil',
      year:'numeric',
      month:'2-digit',
      day:'2-digit'
    }).formatToParts(new Date()).reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});

    const hoyAnio = Number(hoyPartes.year);
    const hoyMes = Number(hoyPartes.month);
    const hoyDia = Number(hoyPartes.day);

    let edad = hoyAnio - anio;
    if(hoyMes < mes || (hoyMes === mes && hoyDia < dia)) edad -= 1;

    return edad >= 0 && edad <= 130 ? String(edad) : '';
  }

  function auroRecetaFormatearEdad(valor, fechaNacimiento){
    let edad = String(valor ?? '').trim();

    if(!edad){
      edad = auroRecetaCalcularEdadCumplida(fechaNacimiento);
    }

    const numero = edad.match(/\d{1,3}/)?.[0] || '';
    if(!numero) return '—';

    return `${numero} años`;
  }

  function auroRecetaCompletarPacienteParaImpresion(r){
    const pBase = (r && r.paciente) ? r.paciente : {};
    const pEncontrado = auroRecetaBuscarPacientePorReceta(r) || {};

    const nombreCompletoEncontrado = pEncontrado.nombre || ((pEncontrado.nombres || '') + ' ' + (pEncontrado.apellidos || '')).trim();

    const p = Object.assign({}, pEncontrado, pBase);

    p.nombre = pBase.nombre || r?.paciente_nombre || nombreCompletoEncontrado || 'Paciente no seleccionado';
    p.cedula =
      pBase.cedula ||
      pBase.numero_documento ||
      pBase.documento ||
      pBase.identificacion ||
      pBase.numero_identificacion ||
      r?.paciente_cedula ||
      r?.cedula ||
      r?.numero_documento ||
      r?.identificacion ||
      pEncontrado.cedula ||
      pEncontrado.numero_documento ||
      pEncontrado.documento ||
      pEncontrado.identificacion ||
      pEncontrado.numero_identificacion ||
      '—';

    p.telefono = pBase.telefono || pBase.whatsapp || r?.paciente_telefono || pEncontrado.telefono || pEncontrado.whatsapp || '—';
    p.whatsapp = p.telefono;
    p.id_paciente = pBase.id_paciente || pBase.id || r?.id_paciente || pEncontrado.id_paciente || pEncontrado.id || '—';

    p.fecha_nacimiento =
      pBase.fecha_nacimiento ||
      pBase.fechaNacimiento ||
      pBase.nacimiento ||
      r?.paciente_fecha_nacimiento ||
      r?.fecha_nacimiento ||
      pEncontrado.fecha_nacimiento ||
      pEncontrado.fechaNacimiento ||
      pEncontrado.nacimiento ||
      '';

    p.edad = auroRecetaFormatearEdad(
      pBase.edad || r?.paciente_edad || pEncontrado.edad || '',
      p.fecha_nacimiento
    );

    return p;
  }

  function auroRecetaConfigInstitucional(){
    const candidatos = [
      window.auroConfiguracionCentro,
      window.configuracionCentro,
      window.configCentro,
      window.CONFIG_CENTRO,
      window.configuracionInstitucional
    ];

    let cfg = candidatos.find(x => x && typeof x === 'object' && !Array.isArray(x)) || {};
    if(cfg.datos && typeof cfg.datos === 'object') cfg = cfg.datos;

    return {
      nombre: String(cfg.nombre_clinica || cfg.nombre_centro || cfg.nombre_comercial || cfg.razon_social || '').trim(),
      subtitulo: String(cfg.subtitulo_clinica || cfg.descripcion_clinica || cfg.eslogan_clinica || '').trim(),
      direccion: String(cfg.direccion_clinica || cfg.direccion || '').trim(),
      ciudad: String(cfg.ciudad_clinica || cfg.ciudad || '').trim(),
      provincia: String(cfg.provincia_clinica || cfg.provincia || '').trim(),
      pais: String(cfg.pais_clinica || cfg.pais || 'Ecuador').trim(),
      telefono: String(cfg.telefono_clinica || cfg.whatsapp_clinica || cfg.telefono || cfg.whatsapp || '').trim(),
      email: String(cfg.email_clinica || cfg.correo_clinica || cfg.email || cfg.correo || '').trim(),
      web: String(cfg.sitio_web_clinica || cfg.web_clinica || cfg.web || '').trim(),
      logo: String(cfg.logo_url || cfg.logo_drive_url || cfg.logo || '').trim(),
      mostrarLogo: String(cfg.mostrar_logo_receta ?? cfg.mostrar_logo ?? 'SI').trim().toUpperCase() !== 'NO'
    };
  }

  function auroRecetaMedicoEmisor(r){
    r = r || {};

    const idReceta = String(r.id_medico || '').trim();
    const idDetectado = String(obtenerIdMedicoReal() || '').trim();
    const idBuscado = idReceta || idDetectado;
    const nombreGuardado = String(r.medico || r.nombre_medico || val('recMedico') || '').trim();

    function normalizarNombreMedico(valor){
      return String(valor || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(dra|dr|doctora|doctor|medica|medico|especialista)\b\.?/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function idMedicoDe(m){
      return String(m?.id_medico || m?.id || m?.codigo || '').trim();
    }

    function nombreMedicoDe(m){
      return String(
        m?.nombre_completo ||
        m?.nombre ||
        ((m?.nombres || '') + ' ' + (m?.apellidos || ''))
      ).trim();
    }

    const listas = [];

    function agregarLista(lista){
      if(Array.isArray(lista) && !listas.includes(lista)) listas.push(lista);
    }

    agregarLista(recetaMedicosActivos);
    agregarLista(window.medicos);
    agregarLista(window.medicosActivos);
    agregarLista(window.listaMedicos);
    agregarLista(window.configuracionMedicos);
    agregarLista(window.medicosConfiguracion);

    try{ if(typeof medicos !== 'undefined') agregarLista(medicos); }catch(e){}
    try{ if(typeof medicosActivos !== 'undefined') agregarLista(medicosActivos); }catch(e){}
    try{ if(typeof listaMedicos !== 'undefined') agregarLista(listaMedicos); }catch(e){}

    const medicosDisponibles = [];
    const clavesVistas = new Set();

    listas.forEach(lista => {
      lista.forEach(m => {
        if(!m || typeof m !== 'object') return;
        const clave = idMedicoDe(m) || normalizarNombreMedico(nombreMedicoDe(m));
        if(!clave || clavesVistas.has(clave)) return;
        clavesVistas.add(clave);
        medicosDisponibles.push(m);
      });
    });

    let encontrado = null;

    /* 1. Búsqueda oficial y prioritaria por id_medico. */
    if(idBuscado){
      encontrado = medicosDisponibles.find(m => idMedicoDe(m) === idBuscado) || null;
    }

    /* 2. Si el ID falla, búsqueda tolerante por nombre almacenado. */
    if(!encontrado && nombreGuardado){
      const nombreBuscado = normalizarNombreMedico(nombreGuardado);

      if(nombreBuscado){
        encontrado = medicosDisponibles.find(m => {
          const nombreLista = normalizarNombreMedico(nombreMedicoDe(m));
          if(!nombreLista) return false;

          return (
            nombreLista === nombreBuscado ||
            nombreLista.includes(nombreBuscado) ||
            nombreBuscado.includes(nombreLista)
          );
        }) || null;
      }
    }

    const nombreEncontrado = nombreMedicoDe(encontrado);
    const idEncontrado = idMedicoDe(encontrado);

    return {
      id_medico: idEncontrado || idBuscado,
      nombre: nombreEncontrado || nombreGuardado || 'Profesional tratante',
      especialidad: String(
        encontrado?.especialidad_principal ||
        encontrado?.especialidad ||
        encontrado?.especialidad_medica ||
        ''
      ).trim(),
      registro_msp: String(
        encontrado?.registro_msp ||
        encontrado?.msp ||
        encontrado?.registro_profesional ||
        ''
      ).trim(),
      registro_senescyt: String(
        encontrado?.registro_senescyt ||
        encontrado?.senescyt ||
        ''
      ).trim(),
      telefono: String(encontrado?.telefono || encontrado?.whatsapp || '').trim(),
      email: String(encontrado?.email || encontrado?.correo || '').trim()
    };
  }

  function auroRecetaViaCompleta(via){
    const raw = String(via || '').trim();
    const key = raw.toUpperCase().replace(/[.\s_-]/g,'');
    const mapa = {
      VO:'Vía oral', ORAL:'Vía oral',
      IM:'Vía intramuscular', INTRAMUSCULAR:'Vía intramuscular',
      IV:'Vía intravenosa', INTRAVENOSA:'Vía intravenosa',
      SC:'Vía subcutánea', SUBCUTANEA:'Vía subcutánea', SUBCUTÁNEA:'Vía subcutánea',
      SL:'Vía sublingual', SUBLINGUAL:'Vía sublingual',
      TOPICA:'Vía tópica', TÓPICA:'Vía tópica',
      VAGINAL:'Vía vaginal', RECTAL:'Vía rectal',
      OFTALMICA:'Vía oftálmica', OFTÁLMICA:'Vía oftálmica',
      OTICA:'Vía ótica', ÓTICA:'Vía ótica',
      INHALATORIA:'Vía inhalatoria', NASAL:'Vía nasal'
    };
    return mapa[key] || raw;
  }

  /*
     AUROSANAX RECETAS 2.5 - FASES 1 Y 2
     Tabla institucional compacta para vista previa/PDF.
     Intervención exclusivamente visual:
     - No cambia el JSON, el formulario, Plan, guardado ni Google Sheets.
     - Conserva compatibilidad con medicamentos estructurados y texto histórico.
  */
  function auroRecetaIndicacionesTabla(m){
    const partes = [
      m.via ? auroRecetaViaCompleta(m.via) : '',
      m.frec || '',
      m.dur ? 'durante ' + m.dur : '',
      m.ind || '',
      String(m.continuo || '').toLowerCase() === 'sí' ? 'Tratamiento continuo' : ''
    ].map(x => String(x || '').trim()).filter(Boolean);

    return [...new Set(partes)].join(' · ');
  }

  function auroRecetaMedicamentosPacienteHTML(valor){
    const txt = String(valor || '').trim();
    if(!txt){
      return '<div class="auro-empty-note">Sin medicamentos registrados.</div>';
    }

    let lista = recetaMedicamentosALista(txt);
    if(!lista.length){
      const respaldo = medicamentoRecetaJSONATexto(txt);
      lista = respaldo
        ? respaldo.split(/\n+/).map(x => ({texto:String(x || '').trim()})).filter(x => x.texto)
        : [];
    }

    if(!lista.length){
      return '<div class="auro-empty-note">Sin medicamentos registrados.</div>';
    }

    const filas = lista.map((item, index) => {
      let m;

      if(item && item.texto){
        const interpretado = recetaMedicamentoTextoAObjeto(item.texto);
        m = interpretado && !interpretado.texto
          ? normalizarMedicamentoRecetaObjeto(interpretado)
          : {
              med: String(item.texto || '').replace(/^\s*\d+\.\s*/, '').trim(),
              pres: '',
              cantidad: '',
              via: '',
              frec: '',
              dur: '',
              ind: '',
              continuo: 'No'
            };
      }else{
        m = normalizarMedicamentoRecetaObjeto(item || {});
      }

      const nombre = String(m.med || 'Medicamento').trim();
      const presentacion = String(m.pres || '').trim();
      const cantidad = String(m.cantidad || '').trim();
      const indicaciones = auroRecetaIndicacionesTabla(m);

      return `
        <tr>
          <td class="auro-rx-col-num">${index + 1}</td>
          <td class="auro-rx-col-med"><strong>${safe(nombre)}</strong></td>
          <td class="auro-rx-col-pres">${presentacion ? safe(presentacion) : '<span class="auro-rx-vacio">—</span>'}</td>
          <td class="auro-rx-col-cant">${cantidad ? safe(cantidad) : '<span class="auro-rx-vacio">—</span>'}</td>
          <td class="auro-rx-col-ind">${indicaciones ? safe(indicaciones) : '<span class="auro-rx-vacio">—</span>'}</td>
        </tr>`;
    }).join('');

    return `
      <div class="auro-rx-table-wrap">
        <table class="auro-rx-table" aria-label="Tratamiento prescrito">
          <colgroup>
            <col class="auro-rx-w-num">
            <col class="auro-rx-w-med">
            <col class="auro-rx-w-pres">
            <col class="auro-rx-w-cant">
            <col class="auro-rx-w-ind">
          </colgroup>
          <thead>
            <tr>
              <th scope="col">N.º</th>
              <th scope="col">Medicamento</th>
              <th scope="col">Presentación / concentración</th>
              <th scope="col">Cantidad</th>
              <th scope="col">Indicaciones</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>`;
  }

  function construirHTMLReceta(r, modo){
    r = r || {};
    modo = modo === 'administrativo' ? 'administrativo' : 'paciente';
    const esAdministrativo = modo === 'administrativo';
    const p = auroRecetaCompletarPacienteParaImpresion(r);
    const cfg = auroRecetaConfigInstitucional();
    const medico = auroRecetaMedicoEmisor(r);

    const nombre = p.nombre || 'Paciente no seleccionado';
    const cedula = p.cedula || '—';
    const edad = p.edad || '—';
    const telefono = p.telefono || p.whatsapp || '—';
    const idPaciente = p.id_paciente || p.id || '—';
    const idReceta = r.id_receta || '—';
    const idAtencion = r.id_atencion || '—';
    const idMedico = medico.id_medico || '—';
    const centro = cfg.nombre || 'AUROSANAX';
    const estadoClass = String(r.estado).toLowerCase().includes('anulada') ? 'badge-danger' : 'badge-ok';
    const ubicacion = [cfg.direccion, cfg.ciudad, cfg.provincia, cfg.pais].filter(Boolean).join(' · ');
    const contacto = [cfg.telefono, cfg.email, cfg.web].filter(Boolean).join(' · ');
    const registros = [
      medico.registro_msp ? `Registro MSP/ACESS: ${medico.registro_msp}` : '',
      medico.registro_senescyt ? `Registro SENESCYT: ${medico.registro_senescyt}` : ''
    ].filter(Boolean);

    const logo = cfg.mostrarLogo && cfg.logo
      ? `<img class="auro-receta-logo" src="${safe(cfg.logo)}" alt="Logo institucional" onerror="this.style.display='none';this.parentElement.classList.add('sin-logo');">`
      : '';

    const datosPaciente = esAdministrativo
      ? `
          <div><span>Paciente</span><b>${safe(nombre)}</b></div><div><span>Cédula</span><b>${safe(cedula)}</b></div>
          <div><span>Edad</span><b>${safe(edad)}</b></div><div><span>WhatsApp</span><b>${safe(telefono)}</b></div>
          <div><span>ID paciente</span><b>${safe(idPaciente)}</b></div><div><span>ID atención</span><b>${safe(idAtencion)}</b></div>
          <div><span>ID receta</span><b>${safe(idReceta)}</b></div><div><span>ID médico</span><b>${safe(idMedico)}</b></div>
          <div><span>CIE-10</span><b>${safe(r.cie10 || '—')}</b></div><div><span>Estado</span><b>${safe(r.estado || 'Emitida')}</b></div>
          <div style="grid-column:1/-1"><span>Diagnóstico</span><b>${safe(r.diagnostico || '—')}</b></div>`
      : `
          <div class="auro-rx-dato auro-rx-paciente"><span>Paciente</span><b>${safe(nombre)}</b></div>
          <div class="auro-rx-dato auro-rx-cedula"><span>Cédula</span><b>${safe(cedula)}</b></div>
          <div class="auro-rx-dato auro-rx-edad"><span>Edad</span><b>${safe(edad)}</b></div>
          <div class="auro-rx-dato auro-rx-fecha"><span>Fecha de emisión</span><b>${safe(fechaVisual(r.fecha))}</b></div>
          <div class="auro-rx-dato auro-rx-numero"><span>N.º de receta</span><b>${safe(idReceta === '—' ? '—' : idReceta)}</b></div>
          <div class="auro-rx-dato auro-rx-diagnostico"><span>Diagnóstico</span><b>${safe(r.diagnostico || '—')}</b></div>`;

    return `
      <div class="auro-receta-documento ${esAdministrativo ? 'modo-administrativo' : 'modo-paciente'}">
        <style>
          .auro-receta-documento{font-family:Arial,system-ui,sans-serif;color:#111827;line-height:1.32;max-width:900px;margin:auto;background:#fff;font-size:12.5px;}
          .auro-receta-header{border-bottom:3px solid #8b1e5a;padding:0 0 11px;margin-bottom:10px;display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;}
          .auro-receta-logo-wrap{width:76px;height:76px;display:grid;place-items:center;border:1px solid #ead5e2;border-radius:16px;background:#fff;overflow:hidden}.auro-receta-logo-wrap:empty,.auro-receta-logo-wrap.sin-logo{display:none}.auro-receta-logo{max-width:100%;max-height:100%;object-fit:contain;display:block}
          .auro-receta-brand h2{margin:0;color:#8b1e5a;font-weight:950;letter-spacing:.04em;font-size:22px;line-height:1.05}.auro-receta-brand small{color:#6b7280;font-weight:750;font-size:11px;line-height:1.3;display:block;margin-top:3px}
          .auro-receta-title{text-align:right;color:#111827;min-width:180px}.auro-receta-title b{display:block;font-size:18px;letter-spacing:.04em}.auro-receta-title small{display:block;color:#6b7280;font-size:10.5px;margin-top:2px}
          .auro-receta-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;background:#fff7fb;border:1px solid #fbcfe8;border-radius:16px;padding:9px;margin-bottom:10px}.auro-receta-grid div{font-size:11.5px;border:1px solid #f1e4ec;background:#fff;border-radius:10px;padding:5px 7px;min-width:0}.auro-receta-grid span{display:block;color:#8b1e5a;font-weight:850;font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:1px}.auro-receta-grid b{display:block;color:#111827;font-size:12px;line-height:1.2;overflow-wrap:anywhere;word-break:normal}
          .modo-paciente .auro-receta-grid{grid-template-columns:minmax(0,1.55fr) minmax(0,1fr) minmax(0,.72fr) minmax(0,1fr) minmax(0,1.35fr) minmax(0,1.9fr);align-items:stretch}
          .modo-paciente .auro-receta-grid .auro-rx-dato{display:flex;flex-direction:column;justify-content:flex-start;min-height:52px}
          .modo-paciente .auro-receta-grid .auro-rx-paciente b,
          .modo-paciente .auro-receta-grid .auro-rx-diagnostico b{white-space:normal;overflow-wrap:anywhere}
          .auro-receta-section{margin-top:9px;break-inside:avoid}.auro-receta-section h4{margin:0 0 6px;color:#7a174f;font-size:13px;border-bottom:1px solid #f3d4e8;padding-bottom:5px;font-weight:950}.auro-receta-box{border:1px solid #e9d5e3;border-radius:16px;padding:10px 11px;white-space:normal;word-break:break-word;background:#fff;box-shadow:0 4px 14px rgba(139,30,90,.035)}
          .auro-rx-table-wrap{width:100%;overflow-x:auto;border:1px solid #d9dde3;border-radius:10px;background:#fff}.auro-rx-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10.8px;line-height:1.25}.auro-rx-table th{background:#edf3f6;color:#263238;border-right:1px solid #cfd8dc;border-bottom:1px solid #bfc8cd;padding:6px 5px;text-align:center;font-size:9.2px;font-weight:950;text-transform:uppercase;letter-spacing:.025em}.auro-rx-table th:last-child{border-right:0}.auro-rx-table td{border-right:1px solid #dfe5e8;border-bottom:1px solid #dfe5e8;padding:6px 6px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}.auro-rx-table tr:last-child td{border-bottom:0}.auro-rx-table td:last-child{border-right:0}.auro-rx-col-num{text-align:center;font-weight:900;color:#7a174f}.auro-rx-col-med strong{font-size:11.2px;color:#111827}.auro-rx-col-cant{text-align:center;font-weight:850}.auro-rx-col-ind{color:#334155}.auro-rx-vacio{color:#94a3b8}.auro-rx-w-num{width:5%}.auro-rx-w-med{width:20%}.auro-rx-w-pres{width:23%}.auro-rx-w-cant{width:10%}.auro-rx-w-ind{width:42%}
          .auro-text-premium{color:#1f2937;background:#f8fafc;border:1px solid #eef2f7;border-radius:12px;padding:7px 9px;font-size:12px;line-height:1.35}.auro-empty-note{color:#64748b;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:7px 9px;font-size:12px}
          .auro-receta-footer{display:grid;grid-template-columns:1.2fr .8fr;gap:18px;margin-top:24px;align-items:end}.auro-centro-contacto{font-size:10.5px;color:#475569;line-height:1.45}.auro-firma{text-align:center;padding-top:20px;font-size:11px}.auro-linea{border-top:1px solid #111827;margin-bottom:5px}.badge-auro{display:inline-block;border-radius:999px;padding:4px 9px;font-size:10.5px;font-weight:900;margin-top:3px}.badge-ok{background:#dcfce7;color:#166534}.badge-danger{background:#fee2e2;color:#991b1b}
          .auro-admin-alert{border:1px solid #bfdbfe;background:#eff6ff;color:#1e3a8a;border-radius:12px;padding:7px 9px;margin-bottom:9px;font-weight:800;font-size:11px}
          @page{size:A4;margin:10mm}@media print{.no-print{display:none!important}.auro-receta-documento{max-width:none;font-size:11.4px;line-height:1.25}.auro-receta-header,.auro-receta-box,.auro-rx-table-wrap,.auro-rx-table tr{break-inside:avoid;page-break-inside:avoid}.auro-receta-grid{gap:4px;padding:6px}.auro-receta-grid div{padding:4px 6px}.auro-rx-table{font-size:9.4px}.auro-rx-table th{font-size:8.3px;padding:4px}.auro-rx-table td{padding:4px 5px}.auro-rx-col-med strong{font-size:9.8px}.auro-receta-footer{margin-top:18px}.auro-admin-alert{display:none}}
          @media(max-width:700px){
            .auro-receta-header{grid-template-columns:auto 1fr}
            .auro-receta-title{grid-column:1/-1;text-align:left}
            .auro-receta-grid{grid-template-columns:1fr 1fr}
            .modo-paciente .auro-receta-grid{grid-template-columns:1fr 1fr}
            .modo-paciente .auro-rx-paciente,
            .modo-paciente .auro-rx-diagnostico{grid-column:1/-1}
            .auro-receta-footer{grid-template-columns:1fr}
            .auro-rx-table-wrap{overflow-x:auto}
            .auro-rx-table{min-width:720px}
          }
        </style>
        ${esAdministrativo ? '<div class="auro-admin-alert">Vista administrativa interna: contiene identificadores y datos de auditoría. No entregar al paciente.</div>' : ''}
        <div class="auro-receta-header">
          <div class="auro-receta-logo-wrap">${logo}</div>
          <div class="auro-receta-brand"><h2>${safe(centro)}</h2>${cfg.subtitulo ? `<small>${safe(cfg.subtitulo)}</small>` : ''}${medico.especialidad ? `<small>${safe(medico.especialidad)}</small>` : ''}</div>
          <div class="auro-receta-title"><b>RECETA MÉDICA</b>${esAdministrativo ? `<span class="badge-auro ${estadoClass}">${safe(r.estado || 'Emitida')}</span>` : ''}</div>
        </div>
        <div class="auro-receta-grid">${datosPaciente}</div>
        <div class="auro-receta-section"><h4>Tratamiento prescrito</h4><div class="auro-receta-box">${auroRecetaMedicamentosPacienteHTML(r.medicamento)}</div></div>
        ${esAdministrativo && r.indicaciones ? `<div class="auro-receta-section"><h4>Indicaciones para el paciente</h4><div class="auro-receta-box">${recetaBloqueTextoPremium(r.indicaciones, '—')}</div></div>` : ''}
        ${esAdministrativo && r.recomendaciones ? `<div class="auro-receta-section"><h4>Observaciones internas / recomendaciones</h4><div class="auro-receta-box">${recetaBloqueTextoPremium(r.recomendaciones, '—')}</div></div>` : ''}
        <div class="auro-receta-footer">
          <div class="auro-centro-contacto">${ubicacion ? `<div>${safe(ubicacion)}</div>` : ''}${contacto ? `<div>${safe(contacto)}</div>` : ''}${esAdministrativo ? `<div style="margin-top:5px;color:#64748b">ID receta: ${safe(idReceta)} · ID atención: ${safe(idAtencion)} · ID médico: ${safe(idMedico)}</div>` : ''}</div>
          <div class="auro-firma"><div class="auro-linea"></div><b>${safe(medico.nombre)}</b>${medico.especialidad ? `<br><span>${safe(medico.especialidad)}</span>` : ''}${registros.map(x=>`<br><span>${safe(x)}</span>`).join('')}<br><span>Firma y sello</span></div>
        </div>
      </div>`;
  }


  /*
     AUROSANAX RECETAS 2.7 - ORIGINAL / COPIA A4 FINAL
     Intervención exclusivamente visual para la impresión del paciente.
     No modifica guardado, JSON, Plan, historial, Google Sheets,
     Apps Script, IDs, eventos ni sincronizaciones.
  */
  function construirHTMLRecetaPacienteDobleA4(r){
    const original = construirHTMLReceta(r, 'paciente');
    const copia = construirHTMLReceta(r, 'paciente');

    return `
      <div class="auro-hoja-a4-doble">
        <section class="auro-media-receta auro-media-original">
          <div class="auro-ejemplar-contenido">${original}</div>
          <div class="auro-ejemplar-etiqueta"><span>ORIGINAL</span></div>
        </section>

        <section class="auro-media-receta auro-media-copia">
          <div class="auro-ejemplar-contenido">${copia}</div>
          <div class="auro-ejemplar-etiqueta"><span>COPIA</span></div>
        </section>
      </div>

      <style>
        html,body{
          margin:0!important;
          padding:0!important;
          background:#fff!important;
        }

        body{
          width:100%;
          min-height:100%;
          overflow-x:hidden;
        }

        .auro-hoja-a4-doble{
          width:100%;
          max-width:194mm;
          margin:0 auto;
          background:#fff;
          box-sizing:border-box;
        }

        .auro-media-receta{
          position:relative;
          height:140mm;
          min-height:140mm;
          max-height:140mm;
          padding:2mm 0 8mm;
          overflow:hidden;
          box-sizing:border-box;
          background:#fff;
        }

        .auro-media-original{
          padding-top:2mm;
        }

        .auro-media-copia{
          border-top:1px dashed #8b8f97;
          margin-top:4mm;
          padding-top:4mm;
        }

        .auro-ejemplar-contenido{
          width:100%;
          height:100%;
          overflow:hidden;
        }

        .auro-media-receta .auro-receta-documento{
          width:100%!important;
          max-width:none!important;
          height:100%!important;
          min-height:0!important;
          margin:0!important;
          padding:0!important;
          box-sizing:border-box!important;
          display:flex!important;
          flex-direction:column!important;
          font-size:13px!important;
          line-height:1.10!important;
          overflow:hidden!important;
        }

        .auro-media-receta .auro-receta-header{
          grid-template-columns:auto 1fr auto!important;
          gap:8px!important;
          padding:0 0 5px!important;
          margin:0 0 5px!important;
          border-bottom-width:2px!important;
          flex:0 0 auto!important;
        }

        .auro-media-receta .auro-receta-logo-wrap{
          width:46px!important;
          height:46px!important;
          border-radius:9px!important;
        }

        .auro-media-receta .auro-receta-brand h2{
          font-size:19.3px!important;
          line-height:1.04!important;
        }

        .auro-media-receta .auro-receta-brand small{
          font-size:11.5px!important;
          line-height:1.10!important;
          margin-top:1px!important;
        }

        .auro-media-receta .auro-receta-title{
          min-width:125px!important;
        }

        .auro-media-receta .auro-receta-title b{
          font-size:17.1px!important;
          line-height:1.04!important;
        }

        .auro-media-receta .auro-receta-title small{
          font-size:11.4px!important;
          margin-top:2px!important;
        }

        .auro-media-receta .auro-receta-grid{
          grid-template-columns:minmax(0,1.55fr) minmax(0,1fr) minmax(0,.72fr) minmax(0,1fr) minmax(0,1.35fr) minmax(0,1.9fr)!important;
          gap:3px!important;
          padding:4px!important;
          margin:0 0 5px!important;
          border-radius:8px!important;
          flex:0 0 auto!important;
        }

        .auro-media-receta .auro-receta-grid div{
          padding:3px 4px!important;
          border-radius:5px!important;
          font-size:11.6px!important;
        }

        .auro-media-receta .auro-receta-grid span{
          font-size:10px!important;
          line-height:1.08!important;
          margin-bottom:1px!important;
        }

        .auro-media-receta .auro-receta-grid b{
          font-size:11.9px!important;
          line-height:1.10!important;
        }

        .auro-media-receta .auro-receta-section{
          margin-top:4px!important;
          flex:0 0 auto!important;
        }

        .auro-media-receta .auro-receta-section h4{
          margin:0 0 3px!important;
          padding-bottom:2px!important;
          font-size:12.8px!important;
          line-height:1.10!important;
        }

        .auro-media-receta .auro-receta-box{
          padding:4px!important;
          border-radius:7px!important;
          box-shadow:none!important;
          overflow:hidden!important;
        }

        .auro-media-receta .auro-rx-table-wrap{
          width:100%!important;
          overflow:hidden!important;
          border-radius:5px!important;
        }

        .auro-media-receta .auro-rx-table{
          width:100%!important;
          table-layout:fixed!important;
          font-size:10.6px!important;
          line-height:1.10!important;
        }

        .auro-media-receta .auro-rx-table th{
          font-size:9.4px!important;
          padding:2px 2px!important;
          line-height:1.08!important;
          letter-spacing:0!important;
        }

        .auro-media-receta .auro-rx-table td{
          padding:2px 3px!important;
          line-height:1.10!important;
          overflow-wrap:anywhere!important;
          word-break:normal!important;
        }

        .auro-media-receta .auro-rx-col-med strong{
          font-size:10.8px!important;
          line-height:1.10!important;
        }

        .auro-media-receta .auro-rx-w-num{width:5%!important}
        .auro-media-receta .auro-rx-w-med{width:21%!important}
        .auro-media-receta .auro-rx-w-pres{width:23%!important}
        .auro-media-receta .auro-rx-w-cant{width:9%!important}
        .auro-media-receta .auro-rx-w-ind{width:42%!important}

        .auro-media-receta .auro-receta-footer{
          margin-top:auto!important;
          padding-top:5px!important;
          gap:12px!important;
          grid-template-columns:1.1fr .9fr!important;
          align-items:start!important;
          flex:0 0 auto!important;
        }

        .auro-media-receta .auro-centro-contacto{
          font-size:10.4px!important;
          line-height:1.10!important;
          align-self:start!important;
        }

        .auro-media-receta .auro-firma{
          padding-top:0!important;
          font-size:10.8px!important;
          line-height:1.10!important;
          align-self:start!important;
        }

        .auro-media-receta .auro-linea{
          margin-bottom:3px!important;
        }

        .auro-ejemplar-etiqueta{
          position:absolute;
          left:0;
          right:0;
          bottom:0;
          height:6mm;
          display:flex;
          align-items:center;
          justify-content:center;
          color:#4b5563;
          font-family:Arial,system-ui,sans-serif;
          font-size:11.3px;
          font-weight:900;
          letter-spacing:.08em;
        }

        .auro-ejemplar-etiqueta:before,
        .auro-ejemplar-etiqueta:after{
          content:"";
          flex:1;
          height:1px;
          background:#9ca3af;
        }

        .auro-ejemplar-etiqueta span{
          padding:0 9px;
          white-space:nowrap;
        }

        @page{
          size:A4 portrait;
          margin:6mm 8mm;
        }

        @media print{
          html,body{
            width:210mm!important;
            height:297mm!important;
            overflow:hidden!important;
            -webkit-print-color-adjust:exact!important;
            print-color-adjust:exact!important;
          }

          .auro-hoja-a4-doble{
            width:194mm!important;
            height:285mm!important;
            max-width:194mm!important;
            margin:0 auto!important;
            overflow:hidden!important;
            page-break-after:avoid!important;
            break-after:avoid-page!important;
          }

          html.auro-ios .auro-hoja-a4-doble{
            height:266mm!important;
          }

          html.auro-ios .auro-media-receta{
            height:131.5mm!important;
            min-height:131.5mm!important;
            max-height:131.5mm!important;
          }

          html.auro-ios .auro-media-copia{
            margin-top:3mm!important;
            padding-top:3mm!important;
          }

          .auro-media-receta{
            page-break-inside:avoid!important;
            break-inside:avoid!important;
          }
        }
      </style>`;
  }

  /*
     AUROSANAX RECETAS 3.1 - DATOS ESTRUCTURADOS PARA REPRESENTACIÓN
     Corrige el flujo PDF llamado desde Plan/impresion.js.
     Cuando se trata de la receta activa aún no emitida, usa directamente
     medicamentosPlanSeleccionados como JSON estructurado.
     Las recetas ya guardadas conservan su propio contenido histórico.
  */
  function auroRecetaPrepararDatosParaRepresentacion(datos){
    const r = Object.assign({}, datos || {});
    const idReceta = String(r.id_receta || '').trim();

    /*
      Un PDF solicitado desde Plan llega por impresion.js como recetaOpcional,
      aunque todavía no sea una receta guardada. Por eso no se puede decidir
      únicamente con recetaOpcional: se distingue por ausencia de id_receta.
    */
    if(!idReceta && recetaPlanPerteneceAtencionActiva()){
      const medicamentosEstructurados = recetaMedicamentosPlanActualesSeguros();

      if(medicamentosEstructurados.length){
        r.medicamento = JSON.stringify(medicamentosEstructurados);
      }
    }

    return r;
  }

  window.vistaPreviaReceta = function(){
    verificarCambioAtencionReceta();
    sincronizarMedicoRecetaDesdeAtencion();
    if(el('recFecha') && !val('recFecha')) setVal('recFecha', fechaHoyReceta());
    if(!recetaEditandoId && recetaPlanPerteneceAtencionActiva() && typeof sincronizarPlanConReceta === 'function') sincronizarPlanConReceta();
    auroRecetaAutocompletarDiagnosticoSiVacio();
    auroRecetaNormalizarMedicamentosEdicionSiSeguro();
    const box = asegurarVistaPreviaReceta();
    const r = auroRecetaPrepararDatosParaRepresentacion(
      window.obtenerDatosReceta()
    );
    if(!r.paciente || !r.paciente.nombre){
      if(box) box.innerHTML = `<div class="sheet-note"><i class="bi bi-exclamation-triangle me-1"></i> Primero seleccione o abra un paciente desde Pacientes o Historia Clínica.</div>`;
      return r;
    }
    if(box) box.innerHTML = construirHTMLReceta(r, 'paciente');
    return r;
  };

  function auroGenerarPDFRecetaUnificada(recetaOpcional){
    if(!recetaOpcional){
      verificarCambioAtencionReceta();
      sincronizarMedicoRecetaDesdeAtencion();
    }
    if(el('recFecha') && !val('recFecha')) setVal('recFecha', fechaHoyReceta());
    if(!recetaOpcional && !recetaEditandoId && recetaPlanPerteneceAtencionActiva() && typeof sincronizarPlanConReceta === 'function') sincronizarPlanConReceta();
    if(!recetaOpcional){
      auroRecetaAutocompletarDiagnosticoSiVacio();
      auroRecetaNormalizarMedicamentosEdicionSiSeguro();
    }

    const r = auroRecetaPrepararDatosParaRepresentacion(
      recetaOpcional || window.obtenerDatosReceta()
    );

    if(!r.paciente || !r.paciente.nombre){
      alert('Seleccione primero un paciente para generar la receta.');
      if(typeof showScreen === 'function') showScreen('pacientes');
      return;
    }

    const html = construirHTMLRecetaPacienteDobleA4(r);
    const ventana = window.open('', '_blank');

    if(!ventana){
      alert('El navegador bloqueó la vista previa. Permita ventanas emergentes para este sitio.');
      return;
    }

    ventana.document.write(`<!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Vista previa de receta AUROSANAX</title>
        <script>
          (function(){
            var esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            if(esIOS) document.documentElement.classList.add('auro-ios');
          })();
        <\/script>
        <style>
          html,body{
            margin:0;
            padding:0;
            background:#dfe3e8;
            font-family:Arial,system-ui,sans-serif;
          }

          .auro-preview-toolbar{
            position:sticky;
            top:0;
            z-index:9999;
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:12px;
            padding:12px 18px;
            background:#ffffff;
            border-bottom:1px solid #d1d5db;
            box-shadow:0 3px 14px rgba(15,23,42,.14);
          }

          .auro-preview-toolbar strong{
            color:#7a174f;
            font-size:15px;
          }

          .auro-preview-actions{
            display:flex;
            gap:8px;
            flex-wrap:wrap;
            align-items:center;
          }

          .auro-preview-zoom{
            display:flex;
            align-items:center;
            gap:6px;
            padding:4px 6px;
            border:1px solid #d1d5db;
            border-radius:10px;
            background:#f8fafc;
          }

          .auro-preview-zoom button{
            width:34px;
            height:34px;
            border:1px solid #cbd5e1;
            border-radius:8px;
            background:#ffffff;
            color:#374151;
            font-size:18px;
            font-weight:900;
            cursor:pointer;
          }

          .auro-preview-zoom button:hover{
            background:#fff7fb;
            color:#8b1e5a;
            border-color:#e7b8d2;
          }

          .auro-preview-zoom span{
            min-width:52px;
            text-align:center;
            color:#374151;
            font-size:12px;
            font-weight:900;
          }

          .auro-preview-fit{
            width:auto!important;
            padding:0 10px!important;
            font-size:12px!important;
          }

          .auro-preview-btn{
            border:0;
            border-radius:10px;
            padding:9px 14px;
            font-weight:850;
            cursor:pointer;
            background:#8b1e5a;
            color:#ffffff;
          }

          .auro-preview-btn.secondary{
            background:#ffffff;
            color:#374151;
            border:1px solid #cbd5e1;
          }

          .auro-preview-stage{
            min-height:calc(100vh - 62px);
            padding:20px;
            box-sizing:border-box;
            display:flex;
            justify-content:center;
            align-items:flex-start;
            overflow:auto;
          }

          .auro-preview-sheet{
            width:210mm;
            min-height:297mm;
            background:#ffffff;
            box-shadow:0 18px 42px rgba(15,23,42,.24);
            transform-origin:top center;
            transform:scale(1.15);
            margin-bottom:44mm;
          }

          .auro-preview-sheet .auro-hoja-a4-doble{
            width:194mm!important;
            max-width:194mm!important;
            margin:6mm 8mm!important;
          }

          @media(max-width:980px){
            .auro-preview-sheet{
              transform:scale(.82);
              margin-bottom:-53mm;
            }
          }

          @media(max-width:760px){
            .auro-preview-toolbar{
              align-items:stretch;
              flex-direction:column;
              gap:9px;
              padding:10px;
            }

            .auro-preview-actions{
              display:grid;
              grid-template-columns:1fr;
              width:100%;
              gap:7px;
            }

            .auro-preview-zoom{
              width:100%;
              justify-content:center;
              box-sizing:border-box;
            }

            .auro-preview-btn{
              width:100%;
              min-height:42px;
            }

            .auro-preview-stage{
              justify-content:center;
              padding:8px 4px 18px;
              overflow-x:hidden;
            }

            .auro-preview-sheet{
              transform-origin:top center;
              margin-left:auto;
              margin-right:auto;
            }
          }

          @media print{
            html,body{
              background:#ffffff!important;
            }

            .auro-preview-toolbar{
              display:none!important;
            }

            .auro-preview-stage{
              display:block!important;
              min-height:0!important;
              padding:0!important;
              overflow:visible!important;
            }

            .auro-preview-sheet{
              width:auto!important;
              min-height:0!important;
              margin:0!important;
              box-shadow:none!important;
              transform:none!important;
            }
          }
        </style>
      </head>
      <body>
        <div class="auro-preview-toolbar">
          <strong>Vista previa A4 vertical · Original y copia</strong>
          <div class="auro-preview-actions">
            <div class="auro-preview-zoom" aria-label="Controles de zoom">
              <button type="button" onclick="auroCambiarZoom(-10)" title="Disminuir zoom">−</button>
              <span id="auroZoomValor">115%</span>
              <button type="button" onclick="auroCambiarZoom(10)" title="Aumentar zoom">+</button>
              <button type="button" class="auro-preview-fit" onclick="auroAjustarZoom()" title="Ajustar a la ventana">Ajustar</button>
            </div>
            <button type="button" class="auro-preview-btn" onclick="window.print()">Imprimir / Guardar PDF</button>
            <button type="button" class="auro-preview-btn secondary" onclick="window.close()">Cerrar</button>
          </div>
        </div>

        <main class="auro-preview-stage">
          <div class="auro-preview-sheet" id="auroPreviewSheet">${html}</div>
        </main>

        <script>
          (function(){
            let auroZoomActual = 115;
            const auroZoomMinimo = 30;
            const auroZoomMaximo = 180;

            function auroAplicarZoom(){
              const hoja = document.getElementById('auroPreviewSheet');
              const etiqueta = document.getElementById('auroZoomValor');
              if(!hoja) return;

              hoja.style.transform = 'scale(' + (auroZoomActual / 100) + ')';

              const diferencia = auroZoomActual - 100;
              hoja.style.marginBottom = diferencia
                ? (diferencia * 2.97) + 'mm'
                : '0';

              if(etiqueta){
                etiqueta.textContent = auroZoomActual + '%';
              }
            }

            window.auroCambiarZoom = function(cambio){
              auroZoomActual = Math.max(
                auroZoomMinimo,
                Math.min(auroZoomMaximo, auroZoomActual + Number(cambio || 0))
              );
              auroAplicarZoom();
            };

            window.auroAjustarZoom = function(){
              const margenHorizontal = window.innerWidth <= 760 ? 12 : 44;
              const anchoDisponible = Math.max(240, window.innerWidth - margenHorizontal);
              const anchoHoja = 794;
              const calculado = Math.floor((anchoDisponible / anchoHoja) * 100);

              auroZoomActual = Math.max(
                auroZoomMinimo,
                Math.min(115, calculado)
              );

              auroAplicarZoom();
            };

            window.addEventListener('resize', function(){
              if(window.innerWidth <= 980){
                window.auroAjustarZoom();
              }
            });

            if(window.innerWidth <= 980){
              window.auroAjustarZoom();
            }else{
              auroAplicarZoom();
            }
          })();
        <\/script>
      </body>
      </html>`);

    ventana.document.close();
    ventana.focus();
  }

  /*
     AUROSANAX RECETAS 3.0 - MOTOR ÚNICO DE VISTA / IMPRESIÓN / PDF
     - Plan, Recetas e Historial usan la misma función interna.
     - La delegación segura apunta directamente al motor interno.
     - Evita recursión o sobrescritura por impresion.js.
     - No modifica botones, IDs, eventos, guardado, Plan ni sincronización.
  */
  function auroInstalarMotorPDFRecetaUnificado(){
    /*
      impresion.js envía obtenerDatosReceta() como argumento. El motor vuelve
      a preparar esos datos para recuperar el arreglo estructurado del Plan
      antes de construir la tabla.
    */
    window.__auroRecetasConstruirPDFSeguro = function(datos){
      return auroGenerarPDFRecetaUnificada(
        auroRecetaPrepararDatosParaRepresentacion(datos)
      );
    };

    window.generarPDFReceta = auroGenerarPDFRecetaUnificada;
  }

  auroInstalarMotorPDFRecetaUnificado();

  function recetaDesdeFormulario(medicoAtencion){
    auroRecetaAutocompletarDiagnosticoSiVacio();
    auroRecetaNormalizarMedicamentosEdicionSiSeguro();
    const r = window.obtenerDatosReceta();
    const paciente = auroRecetaCompletarPacienteParaImpresion(r);
    return {
      id_receta: recetaEditandoId || crearIdReceta(medicoAtencion?.id_medico),
      id_paciente: r.id_paciente || paciente.id_paciente || paciente.id || '',
      id_historia: r.id_historia || '',
      id_atencion: r.id_atencion || obtenerIdAtencionActivaSeguro() || '',
      id_medico: r.id_medico || obtenerIdMedicoReal(),
      codigo_medico: r.codigo_medico || obtenerCodigoCortoMedico(r.id_medico || obtenerIdMedicoReal()),
      paciente_nombre: paciente.nombre || '',
      paciente_cedula: paciente.cedula || '',
      paciente_telefono: paciente.telefono || paciente.whatsapp || '',
      paciente_edad: paciente.edad || '',
      fecha_receta: r.fecha || fechaHoyReceta(), medico: medicoAtencion?.nombre || r.medico || obtenerNombreMedicoReal(), diagnostico_cie10: r.cie10 || '', diagnostico: r.diagnostico || '',
      medicamento: medicamentoRecetaParaGuardarJSON(r.medicamento), presentacion: '', dosis: '', via: '', frecuencia: '', duracion: '', cantidad: '',
      indicaciones: recetaListaParaGuardarJSON(r.indicaciones || ''),
      recomendaciones: recetaListaParaGuardarJSON(r.recomendaciones || ''),
      id_documento: '',
      estado: r.estado || 'Emitida',
      forzar_nueva_receta: recetaNuevaForzada ? 'SI' : 'NO',
      creado_en: '', actualizado_en: fechaHoraEcuadorISO()
    };
  }

  function cargarRecetaEnFormulario(receta){
    if(!receta) return;
    recetaNuevaForzada = false;
    recetaEditandoId = receta.id_receta || receta.id || '';
    recetaAtencionActualId = receta.id_atencion || obtenerIdAtencionActivaSeguro() || '';
    setVal('recFecha', receta.fecha_receta || receta.fecha || fechaHoyReceta());
    setVal('recMedico', receta.medico || obtenerNombreMedicoReal());
    setVal('recCie10', receta.diagnostico_cie10 || receta.cie10 || '');
    setVal('recEstado', receta.estado || 'Emitida');
    setVal('recDiagnostico', receta.diagnostico || receta.motivo || '');
    setVal('recMedicamento', recetaMedicamentosEdicionTexto(receta.medicamento || receta.medicamentos || ''));
    setVal('recIndicaciones', recetaListaParaFormulario(receta.indicaciones || ''));
    setVal('recRecomendaciones', recetaListaParaFormulario(receta.recomendaciones || receta.observaciones || ''));
    if(!receta.id_atencion) receta.id_atencion = obtenerIdAtencionActivaSeguro();
    actualizarBotonGuardarReceta();
    mostrarMensajeReceta('<i class="bi bi-pencil-square me-1"></i> Editando receta. Los cambios se aplican solo a Recetas y no modifican el Plan de la historia clínica.', '');
    vistaPreviaReceta();
  }

  window.guardarRecetaERP = async function(){
    if(recetaGuardando){
      mostrarMensajeReceta('<i class="bi bi-hourglass-split me-1"></i> La receta ya se está guardando. Espere unos segundos para evitar duplicados.', '');
      actualizarBotonGuardarReceta();
      return;
    }

    if(Date.now() < recetaBloqueoPostGuardadoHasta){
      mostrarMensajeReceta('<i class="bi bi-check-circle me-1"></i> La receta ya fue guardada. Espere unos segundos antes de volver a presionar.', 'ok');
      actualizarBotonGuardarReceta();
      return;
    }

    verificarCambioAtencionReceta();

    let estabaEditando = false;

    recetaGuardando = true;
    actualizarBotonGuardarReceta();

    try{
      await auroRecetaResolverDiagnosticoEstructurado();
      await cargarMedicosActivosReceta(false);

      const idAtencionGuardar = String(obtenerIdAtencionActivaSeguro() || '').trim();
      if(!idAtencionGuardar){
        alert('No existe una consulta activa. Abra o seleccione una atención antes de guardar la receta.');
        return;
      }

      /*
        CORRECCIÓN QUIRÚRGICA:
        - Si la atención ya tiene una receta activa, se reutiliza su id_receta.
        - Solo el botón “Nueva receta” permite crear otra receta intencional.
        - No modifica Plan, Atenciones, medicamentos, diagnóstico ni PDF.
      */
      if(!recetaEditandoId && !recetaNuevaForzada){
        await cargarRecetasDesdeSheets(true);
        const existenteAtencion = buscarRecetaActivaPorAtencion(idAtencionGuardar);
        if(existenteAtencion && existenteAtencion.id_receta){
          recetaEditandoId = String(existenteAtencion.id_receta);
        }
      }

      estabaEditando = !!recetaEditandoId;

      const atencionMedico = obtenerMedicoDesdeAtencionActiva();
      if(!atencionMedico.id_medico){
        alert('La atención activa no tiene un médico asignado. Abra nuevamente la consulta correcta antes de guardar la receta.');
        return;
      }

      const r = recetaDesdeFormulario(atencionMedico);

      if(!r.id_paciente || !r.paciente_nombre){
        alert('Seleccione primero un paciente para guardar la receta.');
        if(typeof showScreen === 'function') showScreen('pacientes');
        return;
      }

      if(!r.id_atencion){
        r.id_atencion = String(obtenerIdAtencionActivaSeguro() || '').trim();
      }

      if(!r.id_atencion){
        alert('No existe una consulta activa. Abra o seleccione una atención antes de guardar la receta.');
        return;
      }

      r.id_medico = atencionMedico.id_medico;
      r.codigo_medico = obtenerCodigoCortoMedico(atencionMedico.id_medico);
      r.medico = atencionMedico.nombre || obtenerNombreMedicoReal();
      if(atencionMedico.nombre) setVal('recMedico', atencionMedico.nombre);

      const idAtencionPlan = String(window.planState?.atencionActual || '').trim();
      if(idAtencionPlan && idAtencionPlan !== r.id_atencion){
        alert('El Plan cargado pertenece a otra consulta. Abra nuevamente la consulta correcta antes de guardar.');
        return;
      }

      if(recetaAtencionActualId && recetaAtencionActualId !== r.id_atencion){
        alert('La receta pertenece a un contexto de consulta anterior. Se bloqueó el guardado.');
        return;
      }

      if(!recetaTieneMedicamentosReales(r.medicamento)){
        alert('No hay medicamentos reales en la receta. Agregue al menos uno antes de guardar.');
        return;
      }

      if(!r.id_historia){
        r.id_historia = obtenerIdHistoriaActivaSeguro(r.id_paciente);
      }

      if(!r.diagnostico || auroRecetaDiagnosticoGenerico(r.diagnostico) || !r.diagnostico_cie10){
        r.diagnostico = await auroRecetaResolverDiagnosticoEstructurado();
        r.diagnostico_cie10 = val('recCie10');
      }

      if(!r.diagnostico || auroRecetaDiagnosticoGenerico(r.diagnostico)){
        alert('No se pudo identificar la descripción del diagnóstico de esta consulta. Actualice el diagnóstico estructurado antes de guardar la receta.');
        return;
      }

      if(!auroRecetaCodigoNormalizado(r.diagnostico_cie10)){
        alert('No se pudo identificar el código CIE-10 principal de esta consulta. Actualice el diagnóstico estructurado antes de guardar la receta.');
        return;
      }

      recetaAtencionActualId = r.id_atencion || recetaAtencionActualId || '';

      const lista = leerRecetasStorage();
      const ahoraGuardado = fechaHoraEcuadorISO();
      let idx = lista.findIndex(x =>
        String(x.id_receta || '').trim() === String(r.id_receta || '').trim()
      );

      /*
        AUROSANAX FIX QUIRÚRGICO - CREADO_EN / ACTUALIZADO_EN
        - Una receta NUEVA siempre recibe creado_en y actualizado_en nuevos.
        - Una ACTUALIZACIÓN conserva creado_en únicamente si coinciden
          id_receta e id_atencion con el registro realmente existente.
        - Nunca se hereda creado_en de otra receta, atención o consulta.
      */
      const registroExistente = idx >= 0 ? lista[idx] : null;
      const mismaReceta = !!(
        estabaEditando &&
        registroExistente &&
        String(registroExistente.id_receta || '').trim() === String(r.id_receta || '').trim() &&
        String(registroExistente.id_atencion || '').trim() === String(r.id_atencion || '').trim()
      );

      if(mismaReceta){
        r.creado_en = String(registroExistente.creado_en || '').trim() || ahoraGuardado;
        r.actualizado_en = ahoraGuardado;
        lista[idx] = {...registroExistente, ...r};
      }else{
        /* Cualquier inconsistencia de edición se trata como receta nueva segura. */
        if(!r.id_receta || idx >= 0 || estabaEditando){
          r.id_receta = crearIdReceta(atencionMedico.id_medico);
        }
        r.creado_en = ahoraGuardado;
        r.actualizado_en = ahoraGuardado;
        r.forzar_nueva_receta = 'SI';
        estabaEditando = false;
        lista.unshift(r);
      }

      guardarRecetasStorage(lista);
      recetasHistorialVisible = true;
      recetaAccionesAbiertaId = '';

      mostrarMensajeReceta('<i class="bi bi-hourglass-split me-1"></i> Guardando receta y enviando a Google Sheets...', '');

      const resultado = await enviarRecetaGoogleSheets(r);

      /*
        FIX QUIRÚRGICO:
        No recargar inmediatamente desde Google Sheets después del POST.
        El envío usa mode:'no-cors' y puede terminar antes de que la hoja
        publique la versión actualizada. La recarga inmediata era la tercera
        escritura tardía que devolvía la hora anterior al localStorage.
        Se conserva y renderiza la copia local recién guardada.
      */
      recetasPaginaActual = 1;
      renderHistorialRecetas();

      if(resultado && resultado.success){
        mostrarMensajeReceta(`<i class="bi bi-check-circle me-1"></i> Receta ${estabaEditando ? 'actualizada' : 'guardada'} correctamente. Ya fue asociada a la consulta activa.`, 'ok');
      }else{
        mostrarMensajeReceta(`<i class="bi bi-exclamation-triangle me-1"></i> Receta guardada localmente, pero no se pudo enviar a Google Sheets.`, '');
        alert('Receta guardada localmente, pero no se pudo enviar a Google Sheets.');
      }

      recetaNuevaForzada = false;

      if(!estabaEditando){
        limpiarEstadoRecetaNuevaDespuesDeGuardar();
      }else{
        recetaEditandoId = r.id_receta;
        vistaPreviaReceta();
      }

      if(resultado && resultado.success){
        marcarEstadoRecetaGuardadaVisual(estabaEditando);
      }else{
        actualizarBotonGuardarReceta();
      }

    }catch(error){
      console.error('Error guardando receta:', error);
      mostrarMensajeReceta('<i class="bi bi-exclamation-triangle me-1"></i> Error al guardar receta. Intente nuevamente.', '');
      alert('Error al guardar receta: ' + (error && error.message ? error.message : error));
    }finally{
      recetaGuardando = false;
      actualizarBotonGuardarReceta();
    }
  };


  function consultaPorIdAtencion(idAtencion){
    try{
      if(!idAtencion) return '—';
      const raw = localStorage.getItem('aurosanax_atenciones_local_v1');
      const arr = raw ? JSON.parse(raw) : [];
      if(!Array.isArray(arr)) return '—';
      const a = arr.find(x => String(x.id_atencion || '') === String(idAtencion || ''));
      return a && a.numero_consulta ? '#' + a.numero_consulta : '—';
    }catch(e){
      return '—';
    }
  }

  function recortarTexto(valor, max){
    const txt = String(valor || '').replace(/\s+/g, ' ').trim();
    if(!txt) return '—';
    return txt.length > max ? txt.slice(0, max) + '...' : txt;
  }

  function toggleAccionesReceta(id){
    recetaAccionesAbiertaId = (String(recetaAccionesAbiertaId) === String(id)) ? '' : String(id);
    renderHistorialRecetas();
  }

  function obtenerRecetasPacienteActivo(){
    const paciente = obtenerPacienteActivoSeguro();
    const mostrarTodas = el('recMostrarTodas')?.checked === true;
    const q = val('recHistorialBuscar').toLowerCase();
    const fecha = val('recHistorialFecha');

    return leerRecetasStorage()
      .filter(r => mostrarTodas || (paciente && coincideConPacienteActivo(r)))
      .filter(r => !fecha || String(r.fecha_receta || '').slice(0,10) === fecha)
      .filter(r => !q || [r.paciente_nombre,r.paciente_cedula,r.fecha_receta,r.diagnostico_cie10,r.diagnostico,r.medicamento,r.estado,r.id_atencion].join(' ').toLowerCase().includes(q))
      .sort((a,b) => String(b.actualizado_en || b.creado_en || b.fecha_receta || '').localeCompare(String(a.actualizado_en || a.creado_en || a.fecha_receta || '')));
  }

  function asegurarHistorialRecetas(){
    const seccion = el('recetas'); if(!seccion) return null;
    let box = el('recetasHistorialBox'); if(box) return box;

    box = document.createElement('div');
    box.id = 'recetasHistorialBox';
    box.className = 'cardx p-4 bg-white mt-4';
    box.innerHTML = `
      <div class="section-head">
        <div>
          <h4 class="fw-bold mb-1">Recetas emitidas</h4>
          <p class="text-muted mb-1">Historial local del paciente activo. Puede ver, editar o reimprimir.</p>
          <div class="small text-muted" id="recetasContador">Total recetas encontradas: 0</div>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <button type="button" class="btn-soft" id="btnToggleRecetasHistorial"><i class="bi bi-eye-slash me-1"></i> Ocultar recetas</button>
          <button type="button" class="btn-soft" id="btnNuevaRecetaERP"><i class="bi bi-plus-circle me-1"></i> Nueva receta</button>
        </div>
      </div>

      <div class="row g-2 mb-3" id="recetasFiltrosBox">
        <div class="col-md-5">
          <input id="recHistorialBuscar" class="form-control" placeholder="Buscar por medicamento, diagnóstico, CIE-10 o paciente">
        </div>
        <div class="col-md-3">
          <input id="recHistorialFecha" type="date" class="form-control">
        </div>
        <div class="col-md-2">
          <button type="button" class="btn-soft w-100" id="btnLimpiarFiltroRecetas">Limpiar</button>
        </div>
        <div class="col-md-2 d-flex align-items-center">
          <label class="small text-muted mb-0">
            <input type="checkbox" id="recMostrarTodas" class="me-1"> Mostrar todas
          </label>
        </div>
      </div>

      <style>
        @media (max-width: 768px){
          #recetasHistorialBox{padding:14px!important;}
          #recetasHistorialBox .table-responsive{display:none!important;}
          #recetasHistorialMobile{display:block!important;}
          #recetasHistorialBox .section-head{display:grid!important;grid-template-columns:1fr auto;gap:10px;align-items:start;}
          #recetasHistorialBox .section-head h4{font-size:22px!important;line-height:1.05;}
          #recetasHistorialBox .section-head .d-flex{display:grid!important;grid-template-columns:1fr;gap:8px;}
          #recetasHistorialBox .section-head button{min-width:130px;white-space:normal;}
          #recetasFiltrosBox > div{width:100%!important;}
          .auro-receta-mobile-card{border:1px solid #e5e7eb;border-radius:16px;padding:12px;margin-bottom:10px;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.06);}
          .auro-receta-mobile-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:8px;}
          .auro-receta-mobile-head b{font-size:14px;}
          .auro-receta-mobile-card .small{font-size:12px;line-height:1.35;}
          .auro-receta-mobile-card .btn-action{width:100%;margin-top:8px;}
        }
        @media (min-width: 769px){
          #recetasHistorialMobile{display:none!important;}
        }
      </style>

      <div id="recetasHistorialContenido">
        <div class="table-responsive">
          <table class="table table-modern align-middle">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>ID receta</th>
                <th>Consulta</th>
                <th>Paciente</th>
                <th>CIE-10</th>
                <th>Medicamento</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="recetasHistorialBody">
              <tr><td colspan="8" class="text-center text-muted py-4">Sin recetas emitidas.</td></tr>
            </tbody>
          </table>
        </div>
        <div id="recetasHistorialMobile" style="display:none;"></div>
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-2" id="recetasPaginacionBox">
          <button type="button" class="btn-soft" id="btnRecetasAnterior">Anterior</button>
          <div class="small text-muted fw-bold" id="recetasPaginaInfo">Página 1 de 1</div>
          <button type="button" class="btn-soft" id="btnRecetasSiguiente">Siguiente</button>
        </div>
      </div>
    `;

    const preview = asegurarVistaPreviaReceta();
    if(preview && preview.parentNode) preview.parentNode.insertBefore(box, preview);
    else seccion.querySelector('.cardx')?.appendChild(box);

    setTimeout(() => {
      el('btnNuevaRecetaERP')?.addEventListener('click', limpiarFormularioReceta);

      el('btnToggleRecetasHistorial')?.addEventListener('click', function(){
        recetasHistorialVisible = !recetasHistorialVisible;
        renderHistorialRecetas();
      });

      el('btnLimpiarFiltroRecetas')?.addEventListener('click', function(){
        setVal('recHistorialBuscar', '');
        setVal('recHistorialFecha', '');
        recetasPaginaActual = 1;
        renderHistorialRecetas();
      });

      el('recHistorialBuscar')?.addEventListener('input', function(){
        recetasPaginaActual = 1;
        renderHistorialRecetas();
      });

      el('recHistorialFecha')?.addEventListener('change', function(){
        recetasPaginaActual = 1;
        renderHistorialRecetas();
      });

      el('recMostrarTodas')?.addEventListener('change', function(){
        recetasPaginaActual = 1;
        renderHistorialRecetas();
      });

      el('btnRecetasAnterior')?.addEventListener('click', function(){
        if(recetasPaginaActual > 1){
          recetasPaginaActual--;
          cargarRecetasDesdeSheets(false).then(renderHistorialRecetas);
        }
      });

      el('btnRecetasSiguiente')?.addEventListener('click', function(){
        const total = obtenerRecetasPacienteActivo().length;
        const totalPaginas = Math.max(1, Math.ceil(total / RECETAS_POR_PAGINA));
        if(recetasPaginaActual < totalPaginas){
          recetasPaginaActual++;
          actualizarBotonGuardarReceta();
          renderHistorialRecetas();
        }
      });
    }, 0);

    return box;
  }

  window.renderHistorialRecetas = function(){
    asegurarHistorialRecetas();

    const body = el('recetasHistorialBody');
    const contador = el('recetasContador');
    const contenido = el('recetasHistorialContenido');
    const filtros = el('recetasFiltrosBox');
    const btnToggle = el('btnToggleRecetasHistorial');
    const pagInfo = el('recetasPaginaInfo');
    const mobile = el('recetasHistorialMobile');
    const btnAnt = el('btnRecetasAnterior');
    const btnSig = el('btnRecetasSiguiente');

    if(!body) return;

    const recetas = obtenerRecetasPacienteActivo();

    if(!recetas.length && !recetasSheetsCargadas && !recetasSheetsCargando){
      if(contador) contador.textContent = 'Cargando recetas desde Google Sheets...';
      cargarRecetasDesdeSheets(false).then(function(){
        renderHistorialRecetas();
      });
      return;
    }

    if(contador){
      contador.textContent = 'Total recetas encontradas: ' + recetas.length;
    }

    if(btnToggle){
      btnToggle.innerHTML = recetasHistorialVisible
        ? '<i class="bi bi-eye-slash me-1"></i> Ocultar recetas'
        : '<i class="bi bi-eye me-1"></i> Mostrar recetas';
    }

    if(filtros) filtros.style.display = recetasHistorialVisible ? '' : 'none';
    if(contenido) contenido.style.display = recetasHistorialVisible ? '' : 'none';

    if(!recetasHistorialVisible){
      return;
    }

    const totalPaginas = Math.max(1, Math.ceil(recetas.length / RECETAS_POR_PAGINA));
    if(recetasPaginaActual > totalPaginas) recetasPaginaActual = totalPaginas;
    if(recetasPaginaActual < 1) recetasPaginaActual = 1;

    const inicio = (recetasPaginaActual - 1) * RECETAS_POR_PAGINA;
    const pagina = recetas.slice(inicio, inicio + RECETAS_POR_PAGINA);

    if(pagInfo) pagInfo.textContent = 'Página ' + recetasPaginaActual + ' de ' + totalPaginas;
    if(btnAnt) btnAnt.disabled = recetasPaginaActual <= 1;
    if(btnSig) btnSig.disabled = recetasPaginaActual >= totalPaginas;

    if(!pagina.length){
      body.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Sin recetas emitidas para este paciente activo.</td></tr>';
      if(mobile) mobile.innerHTML = '<div class="text-muted small py-3">Sin recetas emitidas para este paciente activo.</div>';
      return;
    }

    body.innerHTML = pagina.map(r => {
      const idRaw = String(r.id_receta || '');
      const id = safe(idRaw);
      const menuId = safe(idRaw.replace(/[^a-zA-Z0-9_-]/g, '_'));
      const meds = recortarTexto(medicamentoRecetaJSONATexto(r.medicamento || ''), 95);
      const consulta = consultaPorIdAtencion(r.id_atencion || '');
      const abierto = String(recetaAccionesAbiertaId) === String(menuId);

      const fila = `<tr>
        <td><b>${safe(fechaVisual(r.fecha_receta))}</b></td>
        <td><small class="text-muted">${safe(idRaw || '—')}</small></td>
        <td><span class="badge-auro badge-blue">${safe(consulta)}</span></td>
        <td>${safe(r.paciente_nombre || '—')}<br><small class="text-muted">${safe(r.paciente_cedula || '')}</small></td>
        <td>${safe(r.diagnostico_cie10 || '—')}</td>
        <td>${safe(meds)}</td>
        <td><span class="badge-auro ${String(r.estado).toLowerCase().includes('anulada') ? 'badge-danger' : 'badge-ok'}">${safe(r.estado || 'Emitida')}</span></td>
        <td>
          <button type="button" class="btn-action primary" onclick="toggleAccionesReceta('${menuId}')">Acciones ▾</button>
        </td>
      </tr>`;

      const detalle = abierto ? `<tr class="receta-acciones-row">
        <td colspan="8">
          <div class="cardx p-3 bg-white mt-1 mb-2" style="border-left:4px solid #8b1e5a;">
            <div class="fw-bold mb-2">Acciones de receta</div>
            <div class="d-flex flex-column gap-2" style="max-width:220px;">
              <button type="button" class="btn-action soft text-start" onclick="verRecetaEmitida('${id}')">👁 Vista administrativa</button>
              <button type="button" class="btn-action soft text-start" onclick="editarRecetaEmitida('${id}')">✏ Editar receta</button>
              <button type="button" class="btn-action success text-start" onclick="pdfRecetaEmitida('${id}')">📄 Vista paciente / imprimir</button>
            </div>
          </div>
        </td>
      </tr>` : '';

      return fila + detalle;
    }).join('');

    if(mobile){
      const esMovil = (
        window.innerWidth <= 900 ||
        (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) ||
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
      );

      const tablaWrap = body.closest('.table-responsive');
      if(tablaWrap){
        tablaWrap.style.display = esMovil ? 'none' : '';
      }

      mobile.style.display = esMovil ? 'block' : 'none';
      mobile.style.width = '100%';
      mobile.style.clear = 'both';

      mobile.innerHTML = pagina.map(r => {
        const idRaw = String(r.id_receta || '');
        const idSeguro = safe(idRaw);
        const meds = recortarTexto(medicamentoRecetaJSONATexto(r.medicamento || ''), 140);
        const consulta = consultaPorIdAtencion(r.id_atencion || '');
        const estadoClase = String(r.estado || '').toLowerCase().includes('anulada') ? 'badge-danger' : 'badge-ok';

        return '<div class="auro-receta-mobile-card" style="display:block;border:1px solid #e5e7eb;border-radius:16px;padding:12px;margin:10px 0;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.06);">' +
          '<div class="auro-receta-mobile-head" style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:8px;">' +
            '<div><b>' + safe(fechaVisual(r.fecha_receta)) + '</b><br><small class="text-muted">' + idSeguro + '</small></div>' +
            '<span class="badge-auro ' + estadoClase + '">' + safe(r.estado || 'Emitida') + '</span>' +
          '</div>' +
          '<div class="small"><b>Consulta:</b> ' + safe(consulta) + '</div>' +
          '<div class="small"><b>Paciente:</b> ' + safe(r.paciente_nombre || '—') + (r.paciente_cedula ? '<br><span class="text-muted">' + safe(r.paciente_cedula) + '</span>' : '') + '</div>' +
          '<div class="small"><b>CIE-10:</b> ' + safe(r.diagnostico_cie10 || '—') + '</div>' +
          '<div class="small"><b>Medicamento:</b> ' + safe(meds) + '</div>' +
          '<div class="d-grid gap-2 mt-2">' +
            '<button type="button" class="btn-action soft" onclick="verRecetaEmitida(\'' + idSeguro + '\')">👁 Vista administrativa</button>' +
            '<button type="button" class="btn-action soft" onclick="editarRecetaEmitida(\'' + idSeguro + '\')">✏ Editar receta</button>' +
            '<button type="button" class="btn-action success" onclick="pdfRecetaEmitida(\'' + idSeguro + '\')">📄 Vista paciente / imprimir</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }
  };

  function buscarRecetaPorId(id){ return leerRecetasStorage().find(r => String(r.id_receta) === String(id)); }
  function recetaGuardadaAFormatoPreview(r){
    const pacienteCompleto = auroRecetaCompletarPacienteParaImpresion({
      id_paciente: r.id_paciente,
      paciente_nombre: r.paciente_nombre,
      paciente_cedula: r.paciente_cedula,
      paciente_telefono: r.paciente_telefono,
      paciente_edad: r.paciente_edad,
      paciente: {
        id_paciente: r.id_paciente,
        nombre: r.paciente_nombre,
        cedula: r.paciente_cedula,
        telefono: r.paciente_telefono,
        edad: r.paciente_edad
      }
    });

    return {
      id_receta:r.id_receta,
      id_atencion:r.id_atencion,
      id_medico:r.id_medico || obtenerIdMedicoReal(),
      codigo_medico:r.codigo_medico || obtenerCodigoCortoMedico(r.id_medico || obtenerIdMedicoReal()),
      paciente: pacienteCompleto,
      fecha:r.fecha_receta,
      medico:r.medico || obtenerNombreMedicoReal(),
      cie10:r.diagnostico_cie10,
      estado:r.estado,
      diagnostico: auroRecetaDiagnosticoGenerico(r.diagnostico)
        ? ''
        : r.diagnostico,
      medicamento:r.medicamento,
      indicaciones:r.indicaciones,
      recomendaciones:r.recomendaciones
    };
  }

  window.toggleAccionesReceta = toggleAccionesReceta;

  window.verRecetaEmitida = async function(id){
    const r = buscarRecetaPorId(id);
    if(!r) return alert('No se encontró la receta.');

    await auroRecetaResolverDiagnosticoPorRecetaGuardada(r);

    const box = asegurarVistaPreviaReceta();
    if(box) box.innerHTML = construirHTMLReceta(recetaGuardadaAFormatoPreview(r), 'administrativo');

    mostrarMensajeReceta(
      '<i class="bi bi-eye me-1"></i> Receta cargada en vista previa en modo lectura.',
      ''
    );
  };

  window.editarRecetaEmitida = async function(id){
    const r = buscarRecetaPorId(id);
    if(!r) return alert('No se encontró la receta.');

    await auroRecetaResolverDiagnosticoPorRecetaGuardada(r);
    cargarRecetaEnFormulario(r);

    window.scrollTo({
      top: el('recetas')?.offsetTop || 0,
      behavior:'smooth'
    });
  };

  window.pdfRecetaEmitida = async function(id){
    const r = buscarRecetaPorId(id);
    if(!r) return alert('No se encontró la receta.');

    await auroRecetaResolverDiagnosticoPorRecetaGuardada(r);
    window.generarPDFReceta(recetaGuardadaAFormatoPreview(r));
  };

  function agregarBotonVistaPrevia(){
    const seccion = el('recetas'); if(!seccion) return;
    const actions = seccion.querySelector('.section-head .d-flex');
    if(actions && !el('btnVistaPreviaReceta')){
      const btn = document.createElement('button'); btn.id = 'btnVistaPreviaReceta'; btn.type = 'button'; btn.className = 'btn-soft'; btn.innerHTML = '<i class="bi bi-eye me-1"></i> Vista previa'; btn.onclick = window.vistaPreviaReceta; actions.insertBefore(btn, actions.firstChild);
    }
  }


  function refrescarRecetasAlEntrar(){
    setTimeout(function(){
      try{
        if(el('recetas') && el('recetas').classList.contains('active')){
          verificarCambioAtencionReceta();
          sincronizarMedicoRecetaDesdeAtencion();
          asegurarHistorialRecetas();
          recetasPaginaActual = 1;
          renderHistorialRecetas();
        }
      }catch(e){}
    }, 250);
  }

  function envolverRecetasFuncion(nombre, despues){
    const original = window[nombre];
    if(typeof original !== 'function' || original.__auroRecetasWrapped) return;

    const nueva = function(){
      const r = original.apply(this, arguments);
      setTimeout(despues, 250);
      return r;
    };

    nueva.__auroRecetasWrapped = true;
    window[nombre] = nueva;
  }

  function manejarCambioAtencionReceta(evento){
    const idEvento = String(
      evento?.detail?.id_atencion ||
      evento?.detail?.atencion?.id_atencion ||
      obtenerIdAtencionActivaSeguro() ||
      ''
    ).trim();

    if(!idEvento) return;

    if(recetaAtencionActualId && recetaAtencionActualId !== idEvento){
      limpiarFormularioRecetaPorCambioAtencion();
      recetaDiagnosticosPorAtencionCache.delete(idEvento);
    }

    recetaAtencionActualId = idEvento;
    recetaPlanAtencionId = String(window.planState?.atencionActual || '').trim();
  }

  function inicializarRecetas(){
    recetaAtencionActualId = String(obtenerIdAtencionActivaSeguro() || '').trim();
    recetaPlanAtencionId = String(window.planState?.atencionActual || '').trim();
    instalarEstilosEdicionRecetaPremium();
    cargarMedicosActivosReceta(false).then(function(){
      sincronizarMedicoRecetaDesdeAtencion();
      if(el('recetaPreview')) vistaPreviaReceta();
    });
    if(el('recFecha') && !val('recFecha')) setVal('recFecha', fechaHoyReceta());
    setTimeout(function(){
      auroRecetaAutocompletarDiagnosticoSiVacio();
      auroRecetaNormalizarMedicamentosEdicionSiSeguro();
    }, 250);
    agregarBotonVistaPrevia();
    asegurarVistaPreviaReceta();
    asegurarHistorialRecetas();
    actualizarBotonGuardarReceta();
    renderHistorialRecetas();
    cargarRecetasDesdeSheets(false).then(renderHistorialRecetas);

    envolverRecetasFuncion('showScreen', refrescarRecetasAlEntrar);
    envolverRecetasFuncion('seleccionarPacienteHistoria', refrescarRecetasAlEntrar);
    envolverRecetasFuncion('actualizarTarjetaPacienteHistoria', refrescarRecetasAlEntrar);

    mostrarMensajeReceta('<i class="bi bi-info-circle me-1"></i> Recetas funciona independiente del Plan. Si edita aquí, no se modifica la historia clínica original.', '');
  }

  ['aurosanax:atencion-iniciada','aurosanax:atencion-seleccionada','aurosanax:atencion-actualizada'].forEach(function(nombre){
    window.addEventListener(nombre, manejarCambioAtencionReceta);
    document.addEventListener(nombre, manejarCambioAtencionReceta);
  });

  document.addEventListener('DOMContentLoaded', function(){
    auroInstalarMotorPDFRecetaUnificado();
    inicializarRecetas();
  });

  window.addEventListener('load', function(){
    /*
      Última reafirmación después del orden completo de scripts.
      Si impresion.js cargó después, su puente seguirá delegando al motor seguro;
      si cargó antes, recetas.js conserva directamente la función global.
    */
    if(
      window.generarPDFReceta !== auroGenerarPDFRecetaUnificada &&
      window.generarPDFReceta !== window.__auroRecetasConstruirPDFSeguro
    ){
      window.generarPDFReceta = auroGenerarPDFRecetaUnificada;
    }
    window.__auroRecetasConstruirPDFSeguro = function(datos){
      return auroGenerarPDFRecetaUnificada(
        auroRecetaPrepararDatosParaRepresentacion(datos)
      );
    };
  });
  document.addEventListener('input', function(e){ const ids = ['recFecha','recMedico','recCie10','recDiagnostico','recMedicamento','recIndicaciones','recRecomendaciones']; if(ids.includes(e.target?.id || '') && el('recetaPreview')){ clearTimeout(window.__auroRecetaPreviewTimer); window.__auroRecetaPreviewTimer = setTimeout(window.vistaPreviaReceta, 250); } });
  document.addEventListener('change', function(e){ const ids = ['recFecha','recEstado']; if(ids.includes(e.target?.id || '') && el('recetaPreview')) window.vistaPreviaReceta(); });

  window.cargarRecetasDesdeSheets = cargarRecetasDesdeSheets;
  window.refrescarRecetasDesdeSheets = function(){
    recetaDiagnosticosPorAtencionCache.clear();
    return cargarRecetasDesdeSheets(true).then(function(){
      renderHistorialRecetas();
      actualizarBotonGuardarReceta();
      return leerRecetasStorage();
    });
  };
  window.__recetasAurosanaxDebug = function(){ return {version:'2.4 contexto de atención y médico reforzado', totalLocal: leerRecetasStorage().length, sheetsCargadas: recetasSheetsCargadas, sheetsCargando: recetasSheetsCargando, recetaEditandoId, recetaNuevaForzada, recetaGuardando, recetaAtencionActualId, pacienteActivo: obtenerPacienteActivoSeguro()?.nombre || '', codigoMedico: obtenerCodigoCortoMedico(), idMedico: obtenerIdMedicoReal(), storageKey: STORAGE_KEY}; };
})();

/* =====================================================
   AUROSANAX RECETAS 1.9
   - Mantiene compatibilidad con recetas antiguas en texto
   - Guarda indicaciones/recomendaciones como arrays JSON sin duplicados
   - Lee arrays JSON para formulario, historial y PDF
   - Prioriza id_atencion e id_historia de la consulta activa
   - Autocompleta descripción diagnóstica sin reemplazar datos válidos
   - Google Sheets tiene prioridad sobre localStorage
===================================================== */

/* =====================================================
   AUROSANAX RECETAS 2.0 - CONTEXTO SEGURO
   - Limpia formulario al cambiar de consulta
   - No reutiliza medicamentos de otra atención
   - Bloquea guardado sin id_atencion
   - Bloquea Plan perteneciente a otra consulta
   - Bloquea recetas sin medicamentos reales
===================================================== */

/* =====================================================
   AUROSANAX RECETAS 2.1 - DIAGNÓSTICO ESTRUCTURADO
   - Consulta listarDiagnosticosPorAtencion
   - Prioriza diagnóstico principal de la atención activa
   - Conserva código CIE-10 y descripción
   - Bloquea guardado si la descripción no puede resolverse
===================================================== */

/* =====================================================
   AUROSANAX RECETAS 2.2 - DIAGNÓSTICO REAL
   - No acepta “Diagnóstico clínico” como descripción válida
   - No fabrica diagnósticos genéricos
   - Ver / Editar / PDF recuperan la descripción por id_atencion
   - Conserva intacta la separación de Plan y Recetas por consulta
   - No modifica Apps Script, Atenciones ni JSON de medicamentos
===================================================== */

/* =====================================================
   AUROSANAX RECETAS 2.3 - MÉDICO DE LA ATENCIÓN
   - Lee id_medico directamente desde window.getAtencionActiva()
   - Consulta listarMedicosActivos para resolver nombre y registros
   - Sincroniza formulario, vista previa, PDF y guardado
   - Bloquea guardado si la atención no tiene médico
   - Elimina Aurora e ID 397 como fallback automático
===================================================== */

/* =====================================================
   AUROSANAX RECETAS 2.4 - CORRECCIÓN QUIRÚRGICA DUPLICIDAD
   - Reutiliza la receta activa de la misma id_atencion.
   - “Nueva receta” es la única acción que fuerza otra receta.
   - Conserva edición por id_receta, Plan → Receta, PDF e historial.
   - Agrega respaldo de intención al Apps Script con forzar_nueva_receta.
===================================================== */

/* =====================================================
   AUROSANAX RECETAS 2.5 - IMPRESIÓN TABULADA FASES 1 Y 2
   - Cambia únicamente la representación visual del tratamiento.
   - Columnas: medicamento, presentación/concentración, cantidad e indicaciones.
   - Conserva vista previa/PDF, JSON, Plan, guardado, historial y atención.
===================================================== */

/* =====================================================
   AUROSANAX RECETAS 2.6 - FASES 3 Y 4
   - Vista administrativa: conserva Indicaciones para el paciente.
   - Vista paciente / imprimir: no renderiza ese bloque.
   - Mantiene la tabla institucional de medicamentos.
   - No modifica guardado, JSON, Plan, Google Sheets, historial ni sincronización.
===================================================== */

/* =====================================================
   AUROSANAX RECETAS 2.7 - ORIGINAL / COPIA A4 FINAL
   - Duplica únicamente la impresión para paciente.
   - Original arriba y copia abajo, en una sola hoja A4.
   - Corrige ancho, corte lateral, espacios y posición de firma.
   - Cierra la ventana temporal al imprimir, guardar PDF o cancelar.
   - No modifica guardado, JSON, Plan, historial, Google Sheets,
     Apps Script, IDs, eventos ni sincronización.
===================================================== */

/* =====================================================
   AUROSANAX RECETAS 2.8 - VISTA PREVIA GRANDE
   - Vista paciente / imprimir abre primero una vista A4 ampliada.
   - La vista incluye únicamente Imprimir / Guardar PDF y Cerrar.
   - Ya no abre automáticamente el cuadro de impresión.
   - Conserva Original arriba y Copia abajo.
   - No modifica guardado, JSON, Plan, historial, Google Sheets,
     Apps Script, IDs, eventos, listeners ni sincronización.
===================================================== */

/* =====================================================
   AUROSANAX RECETAS 2.9 - ZOOM COMPLETO EN VISTA PREVIA
   - Abre por defecto al 115 %.
   - Agrega controles internos para aumentar, disminuir y ajustar.
   - Mantiene disponible el zoom propio del navegador.
   - La impresión permanece en A4 vertical sin aplicar el zoom visual.
   - No modifica guardado, JSON, Plan, historial, Google Sheets,
     Apps Script, IDs, eventos, listeners ni sincronización.
===================================================== */

/* =====================================================
   AUROSANAX RECETAS 3.0 - MOTOR PDF UNIFICADO
   - El botón PDF de Plan y el botón PDF de Recetas usan el mismo motor.
   - Vista paciente, recetas emitidas e impresión reutilizan la plantilla A4.
   - Original arriba, Copia abajo y controles de zoom sin cambios.
   - El puente __auroRecetasConstruirPDFSeguro llama directamente al motor
     interno y evita ciclos con impresion.js.
   - No modifica Plan, index, botones, IDs, eventos, listeners, guardado,
     JSON, historial, Google Sheets, Apps Script ni sincronización.
===================================================== */

/* =====================================================
   AUROSANAX RECETAS 3.1 - SOLUCIÓN FINAL PDF DESDE PLAN
   - Corrige el caso real: impresion.js pasa obtenerDatosReceta() como
     recetaOpcional, aunque la receta todavía no tenga id_receta.
   - Si no existe id_receta y el Plan pertenece a la atención activa,
     usa medicamentosPlanSeleccionados directamente como JSON estructurado.
   - Una fila por medicamento.
   - Columnas: medicamento, presentación/concentración, cantidad e indicaciones.
   - Vía, frecuencia, duración, observaciones y continuo permanecen agrupados.
   - Las recetas históricas con id_receta no son sustituidas por el Plan activo.
   - No modifica Plan, impresion.js, guardado, JSON persistido, Google Sheets,
     Apps Script, IDs, botones, eventos, listeners ni sincronización.
===================================================== */

/* =====================================================
   AUROSANAX RECETAS 3.2 - AJUSTE FINAL DE IMPRESIÓN
   - Aumenta proporcionalmente la tipografía de Original y Copia.
   - Conserva jerarquías: títulos, encabezados, tabla, firma y pie.
   - Agrega separación central real para facilitar el corte de la hoja.
   - Reequilibra verticalmente ambos ejemplares dentro del A4.
   - Mantiene una sola hoja A4 vertical.
   - No modifica medicamentos, columnas, datos, Plan, guardado, JSON,
     historial, Google Sheets, Apps Script, IDs, botones, eventos,
     listeners, PDF ni sincronización.
===================================================== */

/* =====================================================
   AUROSANAX RECETAS 3.3 - LETRA IMPRESA MÁS GRANDE
   - Aumenta aproximadamente 2 a 3 puntos la tipografía de Original y Copia.
   - Conserva centrado, márgenes, tabla, firma, corte central y una sola hoja A4.
   - Ajusta mínimamente interlineado y rellenos para evitar desbordes.
   - No modifica lógica, medicamentos, Plan, guardado, JSON, historial,
     Google Sheets, Apps Script, IDs, botones, eventos ni sincronización.
===================================================== */

/* =====================================================
   AUROSANAX RECETAS 3.4 - CÉDULA + EDAD EN ENCABEZADO
   - Muestra la cédula debajo del nombre del paciente sin cambiar
     la cuadrícula de 4 columnas ni los espacios del formato A4.
   - Muestra edad como "N años".
   - Si edad no existe, la calcula desde fecha_nacimiento con zona Ecuador.
   - No modifica medicamentos, diagnóstico, Plan, guardado, JSON,
     historial, Google Sheets, Apps Script, IDs, botones ni eventos.
===================================================== */

/* =====================================================
   AUROSANAX RECETAS 3.5 DEFINITIVA - ENCABEZADO PROFESIONAL
   - Seis tarjetas independientes: Paciente, Cédula, Edad,
     Fecha de emisión, N.º de receta y Diagnóstico.
   - Se elimina la tarjeta CIE-10 del encabezado del paciente
     para evitar duplicar el código ya incluido en Diagnóstico.
   - Se elimina el nombre del médico del encabezado superior;
     permanece en la firma inferior.
   - Se elimina la fecha duplicada bajo "RECETA MÉDICA".
   - Mantiene original/copia A4, medicamentos, firma, guardado,
     Plan, Google Sheets, Apps Script, IDs y eventos.
   - Responsive: escritorio, Android, iPhone y iPad.
===================================================== */
