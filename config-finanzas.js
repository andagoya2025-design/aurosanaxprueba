/* ==========================================================
   AUROSANAX ERP DEMO - CONFIG FINANZAS JS
   Versión: 2026-08-11
   Fase 3 - Archivo independiente

   OBJETIVO:
   - Administrar únicamente configuración financiera.
   - Usar apiGet() / apiPost() existentes en configuracion.html.
   - Usar exclusivamente endpoints financieros del mismo Code.gs.
   - No guardar ni modificar datos clínicos.
   - No tocar config-centro.js ni seguridad.js.
   - No guardar automáticamente al abrir/cambiar pestaña.

   REQUISITOS HTML FUTUROS:
   Parámetros:
   - cfgFinMoneda
   - cfgFinMetaMensual
   - cfgFinHorasFacturables
   - cfgFinMargenMinimo
   - finanzasConfigMsg
   - btnGuardarConfigFinanzas

   Gastos fijos:
   - finGastoNombre
   - finGastoCategoria
   - finGastoValor
   - finGastoPeriodicidad
   - finGastoValorMensual
   - finGastoFechaInicio
   - finGastoFechaFin
   - finGastoObservaciones
   - finGastosTbody
   - finanzasGastosMsg
   - btnGuardarGastoFinanzas
   ========================================================== */

(function(){
  'use strict';

  const AURO_FIN_CONFIG_KEYS = Object.freeze({
    moneda: 'moneda',
    meta_mensual: 'meta_mensual',
    horas_facturables_mes: 'horas_facturables_mes',
    margen_minimo: 'margen_minimo'
  });

  let auroFinanzasConfigCargada = false;
  let auroFinanzasGastosCargados = false;
  let auroFinanzasGastos = [];

  function finEl(id){
    return document.getElementById(id);
  }

  function finTexto(valor){
    return String(valor === null || valor === undefined ? '' : valor).trim();
  }

  function finEscape(valor){
    return finTexto(valor).replace(/[&<>"']/g, function(c){
      return ({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#039;'
      })[c];
    });
  }

  function finNumero(valor){
    const txt = finTexto(valor).replace(',', '.');
    if(!txt) return 0;
    const n = Number(txt);
    return Number.isFinite(n) ? n : 0;
  }

  function finNumeroOpcional(valor){
    const txt = finTexto(valor);
    if(!txt) return '';
    const n = Number(txt.replace(',', '.'));
    return Number.isFinite(n) ? n : '';
  }

  function finSetMsg(id, mensaje, tipo){
    const el = finEl(id);
    if(!el) return;

    const clases = {
      ok: 'text-success',
      error: 'text-danger',
      info: 'text-muted'
    };

    el.className = clases[tipo] || clases.info;
    el.textContent = mensaje || '';
  }

  function finSetBoton(id, bloqueado, texto){
    const btn = finEl(id);
    if(!btn) return;

    if(!btn.dataset.auroTextoOriginal){
      btn.dataset.auroTextoOriginal = btn.innerHTML;
    }

    btn.disabled = !!bloqueado;
    btn.innerHTML = bloqueado
      ? '<i class="bi bi-arrow-clockwise me-1"></i>' + finEscape(texto || 'Procesando...')
      : btn.dataset.auroTextoOriginal;
  }

  function finValorConfig(config, clave, respaldo){
    if(config && Object.prototype.hasOwnProperty.call(config, clave)){
      const valor = config[clave];
      if(valor !== null && valor !== undefined && valor !== '') return valor;
    }
    return respaldo;
  }

  function finAsignarValor(id, valor){
    const el = finEl(id);
    if(el) el.value = valor === null || valor === undefined ? '' : valor;
  }

  function finValidarApi(){
    if(typeof window.apiGet !== 'function' || typeof window.apiPost !== 'function'){
      throw new Error('Configuración no tiene disponibles apiGet/apiPost.');
    }
  }

  async function cargarConfiguracionFinanzas(forzar){
    if(auroFinanzasConfigCargada && !forzar) return;

    finValidarApi();
    finSetMsg('finanzasConfigMsg', 'Cargando configuración financiera...', 'info');

    try{
      const config = await window.apiGet('obtenerConfiguracionFinanciera');
      const datos = config && typeof config === 'object' && !Array.isArray(config) ? config : {};

      finAsignarValor('cfgFinMoneda',
        finValorConfig(datos, AURO_FIN_CONFIG_KEYS.moneda, 'USD'));

      finAsignarValor('cfgFinMetaMensual',
        finValorConfig(datos, AURO_FIN_CONFIG_KEYS.meta_mensual, ''));

      finAsignarValor('cfgFinHorasFacturables',
        finValorConfig(datos, AURO_FIN_CONFIG_KEYS.horas_facturables_mes, ''));

      finAsignarValor('cfgFinMargenMinimo',
        finValorConfig(datos, AURO_FIN_CONFIG_KEYS.margen_minimo, ''));

      auroFinanzasConfigCargada = true;
      finSetMsg('finanzasConfigMsg', 'Configuración financiera cargada.', 'ok');
    }catch(e){
      console.error('AUROSANAX Finanzas - cargar configuración:', e);
      finSetMsg('finanzasConfigMsg',
        'No se pudo cargar la configuración financiera: ' + finTexto(e.message || e),
        'error');
    }
  }

  async function guardarClaveFinanciera(clave, valor, descripcion, tipoDato){
    const respuesta = await window.apiPost('guardarConfiguracionFinanciera', {
      clave: clave,
      valor: valor,
      descripcion: descripcion || '',
      tipo_dato: tipoDato || 'texto',
      estado: 'Activo'
    });

    if(!respuesta || respuesta.success !== true){
      throw new Error((respuesta && respuesta.message) || ('No se pudo guardar ' + clave));
    }

    return respuesta;
  }

  async function guardarConfiguracionFinanzas(){
    finValidarApi();

    const moneda = finTexto(finEl('cfgFinMoneda')?.value || 'USD').toUpperCase();
    const meta = finNumeroOpcional(finEl('cfgFinMetaMensual')?.value);
    const horas = finNumeroOpcional(finEl('cfgFinHorasFacturables')?.value);
    const margen = finNumeroOpcional(finEl('cfgFinMargenMinimo')?.value);

    if(!moneda){
      alert('Seleccione o ingrese la moneda.');
      return;
    }
    if(meta !== '' && meta < 0){
      alert('La meta mensual no puede ser negativa.');
      return;
    }
    if(horas !== '' && horas < 0){
      alert('Las horas facturables no pueden ser negativas.');
      return;
    }
    if(margen !== '' && (margen < 0 || margen > 100)){
      alert('El margen mínimo debe estar entre 0 y 100.');
      return;
    }

    finSetBoton('btnGuardarConfigFinanzas', true, 'Guardando...');
    finSetMsg('finanzasConfigMsg', 'Guardando parámetros financieros...', 'info');

    try{
      /* Guardados independientes por clave.
         No se llama ningún guardador clínico ni institucional. */
      await guardarClaveFinanciera(
        AURO_FIN_CONFIG_KEYS.moneda,
        moneda,
        'Moneda principal del módulo financiero',
        'texto'
      );

      await guardarClaveFinanciera(
        AURO_FIN_CONFIG_KEYS.meta_mensual,
        meta,
        'Meta mensual de ingresos',
        'numero'
      );

      await guardarClaveFinanciera(
        AURO_FIN_CONFIG_KEYS.horas_facturables_mes,
        horas,
        'Horas facturables estimadas por mes',
        'numero'
      );

      await guardarClaveFinanciera(
        AURO_FIN_CONFIG_KEYS.margen_minimo,
        margen,
        'Margen mínimo objetivo en porcentaje',
        'numero'
      );

      auroFinanzasConfigCargada = false;
      await cargarConfiguracionFinanzas(true);

      finSetMsg('finanzasConfigMsg', 'Configuración financiera guardada correctamente.', 'ok');
    }catch(e){
      console.error('AUROSANAX Finanzas - guardar configuración:', e);
      finSetMsg('finanzasConfigMsg',
        'Error guardando configuración financiera: ' + finTexto(e.message || e),
        'error');
      alert('Error al guardar Finanzas: ' + finTexto(e.message || e));
    }finally{
      finSetBoton('btnGuardarConfigFinanzas', false);
    }
  }

  function finPeriodicidadMensual(valor, periodicidad){
    const v = finNumero(valor);
    const p = finTexto(periodicidad).toLowerCase();

    if(!v) return 0;
    if(p === 'mensual') return v;
    if(p === 'semanal') return Math.round((v * 52 / 12) * 100) / 100;
    if(p === 'quincenal') return Math.round((v * 24 / 12) * 100) / 100;
    if(p === 'trimestral') return Math.round((v / 3) * 100) / 100;
    if(p === 'semestral') return Math.round((v / 6) * 100) / 100;
    if(p === 'anual') return Math.round((v / 12) * 100) / 100;

    return v;
  }

  function actualizarProrrateoGastoFinanzas(){
    const valor = finNumero(finEl('finGastoValor')?.value);
    const periodicidad = finTexto(finEl('finGastoPeriodicidad')?.value);
    const mensual = finPeriodicidadMensual(valor, periodicidad);

    const input = finEl('finGastoValorMensual');
    if(input) input.value = mensual ? mensual.toFixed(2) : '';
  }

  async function cargarGastosFijosFinanzas(forzar){
    if(auroFinanzasGastosCargados && !forzar){
      renderGastosFijosFinanzas();
      return;
    }

    finValidarApi();
    finSetMsg('finanzasGastosMsg', 'Cargando gastos fijos...', 'info');

    try{
      const datos = await window.apiGet('listarGastosFijosFinancieros');
      auroFinanzasGastos = Array.isArray(datos) ? datos : [];
      auroFinanzasGastosCargados = true;
      renderGastosFijosFinanzas();
      finSetMsg('finanzasGastosMsg', 'Gastos fijos cargados.', 'ok');
    }catch(e){
      console.error('AUROSANAX Finanzas - cargar gastos:', e);
      auroFinanzasGastos = [];
      renderGastosFijosFinanzas();
      finSetMsg('finanzasGastosMsg',
        'No se pudieron cargar los gastos fijos: ' + finTexto(e.message || e),
        'error');
    }
  }

  function renderGastosFijosFinanzas(){
    const tbody = finEl('finGastosTbody');
    if(!tbody) return;

    if(!auroFinanzasGastos.length){
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Sin gastos fijos registrados.</td></tr>';
      return;
    }

    tbody.innerHTML = auroFinanzasGastos.map(function(g){
      return '<tr>' +
        '<td>' + finEscape(g.nombre_gasto) + '</td>' +
        '<td>' + finEscape(g.categoria) + '</td>' +
        '<td>' + finEscape(g.valor) + '</td>' +
        '<td>' + finEscape(g.periodicidad) + '</td>' +
        '<td>' + finEscape(g.valor_mensual_prorrateado) + '</td>' +
        '<td>' + finEscape(g.estado) + '</td>' +
        '<td class="text-end">' +
          '<button type="button" class="btn btn-sm btn-outline-primary" ' +
          'data-fin-editar-gasto="' + finEscape(g.id_gasto) + '">' +
          '<i class="bi bi-pencil"></i></button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  function limpiarFormularioGastoFinanzas(){
    [
      'finGastoNombre',
      'finGastoCategoria',
      'finGastoValor',
      'finGastoValorMensual',
      'finGastoFechaInicio',
      'finGastoFechaFin',
      'finGastoObservaciones'
    ].forEach(function(id){
      const el = finEl(id);
      if(el) el.value = '';
    });

    const periodicidad = finEl('finGastoPeriodicidad');
    if(periodicidad) periodicidad.value = 'Mensual';

    const id = finEl('finGastoId');
    if(id) id.value = '';
  }

  function cargarGastoEnFormularioFinanzas(idGasto){
    const id = finTexto(idGasto);
    const gasto = auroFinanzasGastos.find(function(g){
      return finTexto(g.id_gasto) === id;
    });

    if(!gasto) return;

    finAsignarValor('finGastoId', gasto.id_gasto);
    finAsignarValor('finGastoNombre', gasto.nombre_gasto);
    finAsignarValor('finGastoCategoria', gasto.categoria);
    finAsignarValor('finGastoValor', gasto.valor);
    finAsignarValor('finGastoPeriodicidad', gasto.periodicidad || 'Mensual');
    finAsignarValor('finGastoValorMensual', gasto.valor_mensual_prorrateado);
    finAsignarValor('finGastoFechaInicio', gasto.fecha_inicio);
    finAsignarValor('finGastoFechaFin', gasto.fecha_fin);
    finAsignarValor('finGastoObservaciones', gasto.observaciones);
  }

  async function guardarGastoFijoFinanzas(){
    finValidarApi();

    const idGasto = finTexto(finEl('finGastoId')?.value);
    const nombre = finTexto(finEl('finGastoNombre')?.value);
    const categoria = finTexto(finEl('finGastoCategoria')?.value);
    const valor = finNumero(finEl('finGastoValor')?.value);
    const periodicidad = finTexto(finEl('finGastoPeriodicidad')?.value || 'Mensual');
    const mensual = finPeriodicidadMensual(valor, periodicidad);

    if(!nombre){
      alert('Ingrese el nombre del gasto.');
      return;
    }
    if(!(valor > 0)){
      alert('El valor del gasto debe ser mayor que cero.');
      return;
    }

    const data = {
      nombre_gasto: nombre,
      categoria: categoria,
      valor: valor,
      periodicidad: periodicidad,
      valor_mensual_prorrateado: mensual,
      fecha_inicio: finTexto(finEl('finGastoFechaInicio')?.value),
      fecha_fin: finTexto(finEl('finGastoFechaFin')?.value),
      estado: 'Activo',
      observaciones: finTexto(finEl('finGastoObservaciones')?.value)
    };

    finSetBoton('btnGuardarGastoFinanzas', true, 'Guardando...');
    finSetMsg('finanzasGastosMsg', 'Guardando gasto fijo...', 'info');

    try{
      let respuesta;

      if(idGasto){
        respuesta = await window.apiPost('editarGastoFijoFinanciero', {
          id_gasto: idGasto,
          data: data
        });
      }else{
        respuesta = await window.apiPost('guardarGastoFijoFinanciero', data);
      }

      if(!respuesta || respuesta.success !== true){
        throw new Error((respuesta && respuesta.message) || 'No se pudo guardar el gasto fijo.');
      }

      limpiarFormularioGastoFinanzas();
      auroFinanzasGastosCargados = false;
      await cargarGastosFijosFinanzas(true);
      finSetMsg('finanzasGastosMsg', 'Gasto fijo guardado correctamente.', 'ok');
    }catch(e){
      console.error('AUROSANAX Finanzas - guardar gasto:', e);
      finSetMsg('finanzasGastosMsg',
        'Error guardando gasto fijo: ' + finTexto(e.message || e),
        'error');
      alert('Error al guardar gasto fijo: ' + finTexto(e.message || e));
    }finally{
      finSetBoton('btnGuardarGastoFinanzas', false);
    }
  }

  async function inicializarConfiguracionFinanzas(){
    /* Solo lectura. Nunca guarda por inicialización o navegación. */
    await Promise.allSettled([
      cargarConfiguracionFinanzas(false),
      cargarGastosFijosFinanzas(false)
    ]);
  }

  function enlazarEventosConfigFinanzas(){
    const btnConfig = finEl('btnGuardarConfigFinanzas');
    if(btnConfig && btnConfig.dataset.auroFinInit !== '1'){
      btnConfig.dataset.auroFinInit = '1';
      btnConfig.addEventListener('click', guardarConfiguracionFinanzas);
    }

    const btnGasto = finEl('btnGuardarGastoFinanzas');
    if(btnGasto && btnGasto.dataset.auroFinInit !== '1'){
      btnGasto.dataset.auroFinInit = '1';
      btnGasto.addEventListener('click', guardarGastoFijoFinanzas);
    }

    const btnLimpiar = finEl('btnLimpiarGastoFinanzas');
    if(btnLimpiar && btnLimpiar.dataset.auroFinInit !== '1'){
      btnLimpiar.dataset.auroFinInit = '1';
      btnLimpiar.addEventListener('click', limpiarFormularioGastoFinanzas);
    }

    ['finGastoValor', 'finGastoPeriodicidad'].forEach(function(id){
      const el = finEl(id);
      if(el && el.dataset.auroFinInit !== '1'){
        el.dataset.auroFinInit = '1';
        el.addEventListener('input', actualizarProrrateoGastoFinanzas);
        el.addEventListener('change', actualizarProrrateoGastoFinanzas);
      }
    });

    const tbody = finEl('finGastosTbody');
    if(tbody && tbody.dataset.auroFinInit !== '1'){
      tbody.dataset.auroFinInit = '1';
      tbody.addEventListener('click', function(ev){
        const btn = ev.target.closest('[data-fin-editar-gasto]');
        if(!btn) return;
        cargarGastoEnFormularioFinanzas(btn.getAttribute('data-fin-editar-gasto'));
      });
    }
  }

  function prepararConfigFinanzas(){
    enlazarEventosConfigFinanzas();
  }

  /* API pública mínima para configuracion.html.
     No redefine funciones globales existentes. */
  window.auroConfigFinanzas = Object.freeze({
    inicializar: inicializarConfiguracionFinanzas,
    cargarConfiguracion: function(){ return cargarConfiguracionFinanzas(true); },
    cargarGastos: function(){ return cargarGastosFijosFinanzas(true); },
    guardarConfiguracion: guardarConfiguracionFinanzas,
    guardarGasto: guardarGastoFijoFinanzas,
    limpiarGasto: limpiarFormularioGastoFinanzas,
    preparar: prepararConfigFinanzas
  });

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', prepararConfigFinanzas, {once:true});
  }else{
    prepararConfigFinanzas();
  }

})();
