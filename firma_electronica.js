/* ============================================================
   AUROSANAX ERP - FIRMA ELECTRÓNICA
   Archivo destino: firma_electronica.js
   Versión: 2.1
   Alcance inicial: RECETA
   ------------------------------------------------------------
   CONTRATO ANTIRREGRESIVO:
   - Mantiene window.auroFirmaElectronica.firmarDocumento(data).
   - No contiene certificado .p12, clave privada ni contraseña.
   - No declara una firma válida sin confirmación positiva del backend.
   - Falla cerrado ante configuración incompleta, sesión inválida o error.
   - Conserva aislamiento por id_atencion + id_receta.
   - Evita doble POST/doble firma de la misma receta y mismo contenido.
   - NO descarga ni abre automáticamente el PDF al terminar la firma.
   - Conserva funciones explícitas para VER o DESCARGAR el PDF firmado.
============================================================ */
(function(){
  'use strict';

  const MODULO = 'AUROSANAX FIRMA ELECTRÓNICA';
  const VERSION = '2.1';
  const INTERVALO_CONSULTA_MS = 2500;
  const TIEMPO_MAXIMO_MS = 10 * 60 * 1000;

  /* Una sola operación activa por receta+contenido. */
  const firmasEnCurso = new Map();

  /* Resultado confirmado en esta sesión del navegador.
     La clave incluye la huella del HTML: si la receta cambia, puede firmarse
     nuevamente; si no cambia, no se genera una firma duplicada. */
  const firmasConfirmadas = new Map();
  let ultimoResultadoFirmado = null;

  function texto(valor){
    return String(valor === null || valor === undefined ? '' : valor).trim();
  }

  function apiUrl(){
    try{
      if(typeof API_URL !== 'undefined' && API_URL) return texto(API_URL);
    }catch(e){}
    if(window.API_URL) return texto(window.API_URL);
    const input = document.getElementById('appsScriptUrl');
    return input ? texto(input.value) : '';
  }

  function tokenSesion(){
    try{
      return texto(sessionStorage.getItem('aurosanax_seguridad_token'));
    }catch(e){
      return '';
    }
  }

  function mensajeProfesional(mensaje, tipo){
    const txt = texto(mensaje) || 'No fue posible completar la operación de firma electrónica.';
    const clase = tipo === 'ok' ? 'success' : (tipo === 'warn' ? 'warning' : 'danger');

    try{
      if(typeof window.mostrarToast === 'function'){
        window.mostrarToast(txt, clase);
        return;
      }
    }catch(e){}

    alert(txt);
  }

  async function post(accion, data){
    const url = apiUrl();
    if(!url) throw new Error('No se encontró la conexión segura con el servidor del ERP.');

    const payload = Object.assign({}, data || {}, {
      token: tokenSesion()
    });

    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({accion:accion, data:payload}),
      cache:'no-store'
    });

    if(!res.ok) throw new Error('El servidor de firma respondió HTTP ' + res.status + '.');

    const json = await res.json();
    if(!json || json.success !== true){
      throw new Error(texto(json && json.message) || 'El servidor no confirmó la firma electrónica.');
    }
    return json;
  }

  function esperar(ms){
    return new Promise(function(resolve){ setTimeout(resolve, ms); });
  }

  function base64ABlob(base64, mime){
    const limpio = texto(base64).replace(/^data:[^;]+;base64,/, '');
    const bin = atob(limpio);
    const bytes = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], {type:mime || 'application/pdf'});
  }

  function obtenerBase64Firmado(resultado){
    return texto(resultado && (resultado.pdf_firmado_base64 || resultado.archivo_base64));
  }

  /* Acción EXPLÍCITA: ver. Nunca se llama automáticamente al firmar. */
  function abrirPdfFirmado(resultado, nombrePreferido){
    const r = resultado || ultimoResultadoFirmado;
    const base64 = obtenerBase64Firmado(r);
    if(!base64) return false;

    const blob = base64ABlob(base64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const ventana = window.open(url, '_blank', 'noopener');
    if(!ventana){
      URL.revokeObjectURL(url);
      return false;
    }
    setTimeout(function(){ URL.revokeObjectURL(url); }, 5 * 60 * 1000);
    return true;
  }

  /* Acción EXPLÍCITA: descargar. Nunca se llama automáticamente al firmar. */
  function descargarPdfFirmado(resultado, nombrePreferido){
    const r = resultado || ultimoResultadoFirmado;
    const base64 = obtenerBase64Firmado(r);
    if(!base64) return false;

    const blob = base64ABlob(base64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const nombre = texto((r && r.nombre_archivo) || nombrePreferido || 'documento_firmado.pdf');

    const a = document.createElement('a');
    a.href = url;
    a.download = nombre.toLowerCase().endsWith('.pdf') ? nombre : nombre + '.pdf';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
    return true;
  }

  function validarSolicitud(data){
    const d = Object.assign({}, data || {});
    d.tipo_documento = texto(d.tipo_documento).toUpperCase();
    d.id_atencion = texto(d.id_atencion);
    d.id_receta = texto(d.id_receta || d.id_documento_clinico);
    d.html_documento = texto(d.html_documento);

    if(d.tipo_documento !== 'RECETA'){
      throw new Error('Esta integración de firma está habilitada únicamente para Recetas.');
    }
    if(!d.id_atencion) throw new Error('No existe una atención clínica activa para firmar.');
    if(!d.id_receta) throw new Error('Guarde la receta antes de firmarla electrónicamente.');
    if(!d.html_documento) throw new Error('No fue posible preparar el documento oficial de la receta.');
    return d;
  }

  async function sha256Texto(valor){
    const datos = new TextEncoder().encode(String(valor || ''));
    const hash = await crypto.subtle.digest('SHA-256', datos);
    return Array.from(new Uint8Array(hash))
      .map(function(b){ return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  async function claveFirma(solicitud){
    const huella = await sha256Texto(solicitud.html_documento);
    return solicitud.id_atencion + '|' + solicitud.id_receta + '|' + huella;
  }

  async function esperarFirma(idSolicitud, solicitud){
    const inicio = Date.now();

    while((Date.now() - inicio) < TIEMPO_MAXIMO_MS){
      const estado = await post('obtenerEstadoFirmaElectronica', {
        id_solicitud:idSolicitud,
        id_atencion:solicitud.id_atencion,
        id_receta:solicitud.id_receta
      });

      const valor = texto(estado.estado_firma).toUpperCase();

      if(valor === 'FIRMADO') return estado;
      if(valor === 'ERROR'){
        throw new Error(texto(estado.error) || 'El motor local informó un error al firmar el documento.');
      }
      if(valor === 'EXPIRADA'){
        throw new Error(texto(estado.error) || 'La solicitud de firma expiró. Vuelva a intentarlo.');
      }
      if(valor !== 'PENDIENTE' && valor !== 'TOMADA'){
        throw new Error('El servidor devolvió un estado de firma no reconocido.');
      }

      await esperar(INTERVALO_CONSULTA_MS);
    }

    throw new Error('La firma no se completó dentro del tiempo permitido. Verifique que el motor de firma esté iniciado.');
  }

  async function ejecutarFirma(solicitud, clave){
    const estadoMotor = await post('obtenerEstadoFirmaElectronica', {});
    if(estadoMotor.disponible !== true){
      throw new Error(
        estadoMotor.agente_online === false
          ? 'El motor de firma de Windows no está conectado. Inícielo y vuelva a intentar.'
          : 'La firma electrónica no está disponible en este momento.'
      );
    }

    const creada = await post('firmarDocumento', solicitud);
    const estadoInicial = texto(creada.estado_firma).toUpperCase();

    let resultado;
    if(estadoInicial === 'FIRMADO'){
      resultado = creada;
    }else{
      if(estadoInicial !== 'PENDIENTE' || !texto(creada.id_solicitud)){
        throw new Error('El servidor no creó correctamente la solicitud de firma.');
      }
      resultado = await esperarFirma(texto(creada.id_solicitud), solicitud);
    }

    if(texto(resultado.estado_firma).toUpperCase() !== 'FIRMADO'){
      throw new Error('El servidor no confirmó un estado de firma válido.');
    }

    if(!obtenerBase64Firmado(resultado)){
      throw new Error('La firma fue procesada, pero el servidor no devolvió el PDF firmado.');
    }

    /* Se conserva el PDF firmado en memoria para acciones explícitas posteriores.
       NO se abre y NO se descarga aquí. */
    ultimoResultadoFirmado = resultado;
    firmasConfirmadas.set(clave, resultado);

    window.dispatchEvent(new CustomEvent('aurosanax:firma-electronica-completada', {
      detail:{
        tipo_documento:solicitud.tipo_documento,
        id_atencion:solicitud.id_atencion,
        id_receta:solicitud.id_receta,
        id_solicitud:texto(resultado.id_solicitud),
        estado_firma:'FIRMADO',
        nombre_archivo:texto(resultado.nombre_archivo || solicitud.nombre_archivo),
        sha256_pdf_firmado:texto(resultado.sha256_pdf_firmado),
        firmado_en:texto(resultado.firmado_en),
        pdf_disponible:true
      }
    }));

    mensajeProfesional(
      'Documento firmado electrónicamente. El PDF firmado está listo para ver o descargar.',
      'ok'
    );

    return resultado;
  }

  async function firmarDocumento(data){
    let clave = '';
    try{
      const solicitud = validarSolicitud(data);
      clave = await claveFirma(solicitud);

      /* Si el mismo documento ya fue confirmado en esta sesión, no se vuelve
         a firmar ni se genera otro POST. */
      if(firmasConfirmadas.has(clave)){
        const existente = firmasConfirmadas.get(clave);
        ultimoResultadoFirmado = existente;
        mensajeProfesional(
          'Esta misma versión de la receta ya fue firmada. No se generó una firma duplicada.',
          'warn'
        );
        return existente;
      }

      /* Si hay una firma en curso, todos los clics posteriores reutilizan la
         misma promesa. Así se evita doble POST incluso con doble clic. */
      if(firmasEnCurso.has(clave)){
        mensajeProfesional('La receta ya se está firmando. Espere la confirmación.', 'warn');
        return firmasEnCurso.get(clave);
      }

      const operacion = ejecutarFirma(solicitud, clave);
      firmasEnCurso.set(clave, operacion);

      try{
        return await operacion;
      }finally{
        firmasEnCurso.delete(clave);
      }
    }catch(error){
      if(clave) firmasEnCurso.delete(clave);
      console.error(MODULO, error);
      mensajeProfesional(error && error.message ? error.message : String(error || ''), 'error');
      throw error;
    }
  }

  async function obtenerEstado(data){
    return post('obtenerEstadoFirmaElectronica', data || {});
  }

  function obtenerUltimoFirmado(){
    return ultimoResultadoFirmado;
  }

  window.auroFirmaElectronica = Object.freeze({
    version:VERSION,
    firmarDocumento:firmarDocumento,
    obtenerEstado:obtenerEstado,
    abrirPdfFirmado:abrirPdfFirmado,
    descargarPdfFirmado:descargarPdfFirmado,
    obtenerUltimoFirmado:obtenerUltimoFirmado
  });
})();

/* ============================================================
   AUROSANAX - OVERRIDE ANTIRREGRESIVO ESTRICTO APPEND-ONLY
   Fecha: 2026-09-14
   - Todo el baseline anterior permanece arriba, byte por byte.
   - El módulo que sigue se carga al final y reemplaza solo la API pública
     window.auroFirmaElectronica para quitar el timeout artificial.
   - No elimina funciones ni líneas del baseline.
============================================================ */

/* ============================================================
   AUROSANAX ERP - FIRMA ELECTRÓNICA
   Archivo destino: firma_electronica.js
   Versión: 2.1
   Alcance inicial: RECETA
   ------------------------------------------------------------
   CONTRATO ANTIRREGRESIVO:
   - Mantiene window.auroFirmaElectronica.firmarDocumento(data).
   - No contiene certificado .p12, clave privada ni contraseña.
   - No declara una firma válida sin confirmación positiva del backend.
   - Falla cerrado ante configuración incompleta, sesión inválida o error.
   - Conserva aislamiento por id_atencion + id_receta.
   - Evita doble POST/doble firma de la misma receta y mismo contenido.
   - NO descarga ni abre automáticamente el PDF al terminar la firma.
   - Conserva funciones explícitas para VER o DESCARGAR el PDF firmado.
============================================================ */
(function(){
  'use strict';

  const MODULO = 'AUROSANAX FIRMA ELECTRÓNICA';
  const VERSION = '2.2-sin-tiempo';
  const INTERVALO_CONSULTA_MS = 2500;

  /* Una sola operación activa por receta+contenido. */
  const firmasEnCurso = new Map();

  /* Resultado confirmado en esta sesión del navegador.
     La clave incluye la huella del HTML: si la receta cambia, puede firmarse
     nuevamente; si no cambia, no se genera una firma duplicada. */
  const firmasConfirmadas = new Map();
  let ultimoResultadoFirmado = null;

  function texto(valor){
    return String(valor === null || valor === undefined ? '' : valor).trim();
  }

  function apiUrl(){
    try{
      if(typeof API_URL !== 'undefined' && API_URL) return texto(API_URL);
    }catch(e){}
    if(window.API_URL) return texto(window.API_URL);
    const input = document.getElementById('appsScriptUrl');
    return input ? texto(input.value) : '';
  }

  function tokenSesion(){
    try{
      return texto(sessionStorage.getItem('aurosanax_seguridad_token'));
    }catch(e){
      return '';
    }
  }

  function mensajeProfesional(mensaje, tipo){
    const txt = texto(mensaje) || 'No fue posible completar la operación de firma electrónica.';
    const clase = tipo === 'ok' ? 'success' : (tipo === 'warn' ? 'warning' : 'danger');

    try{
      if(typeof window.mostrarToast === 'function'){
        window.mostrarToast(txt, clase);
        return;
      }
    }catch(e){}

    alert(txt);
  }

  async function post(accion, data){
    const url = apiUrl();
    if(!url) throw new Error('No se encontró la conexión segura con el servidor del ERP.');

    const payload = Object.assign({}, data || {}, {
      token: tokenSesion()
    });

    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({accion:accion, data:payload}),
      cache:'no-store'
    });

    if(!res.ok) throw new Error('El servidor de firma respondió HTTP ' + res.status + '.');

    const json = await res.json();
    if(!json || json.success !== true){
      throw new Error(texto(json && json.message) || 'El servidor no confirmó la firma electrónica.');
    }
    return json;
  }

  function esperar(ms){
    return new Promise(function(resolve){ setTimeout(resolve, ms); });
  }

  function base64ABlob(base64, mime){
    const limpio = texto(base64).replace(/^data:[^;]+;base64,/, '');
    const bin = atob(limpio);
    const bytes = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], {type:mime || 'application/pdf'});
  }

  function obtenerBase64Firmado(resultado){
    return texto(resultado && (resultado.pdf_firmado_base64 || resultado.archivo_base64));
  }

  /* Acción EXPLÍCITA: ver. Nunca se llama automáticamente al firmar. */
  function abrirPdfFirmado(resultado, nombrePreferido){
    const r = resultado || ultimoResultadoFirmado;
    const base64 = obtenerBase64Firmado(r);
    if(!base64) return false;

    const blob = base64ABlob(base64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const ventana = window.open(url, '_blank', 'noopener');
    if(!ventana){
      URL.revokeObjectURL(url);
      return false;
    }
    setTimeout(function(){ URL.revokeObjectURL(url); }, 5 * 60 * 1000);
    return true;
  }

  /* Acción EXPLÍCITA: descargar. Nunca se llama automáticamente al firmar. */
  function descargarPdfFirmado(resultado, nombrePreferido){
    const r = resultado || ultimoResultadoFirmado;
    const base64 = obtenerBase64Firmado(r);
    if(!base64) return false;

    const blob = base64ABlob(base64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const nombre = texto((r && r.nombre_archivo) || nombrePreferido || 'documento_firmado.pdf');

    const a = document.createElement('a');
    a.href = url;
    a.download = nombre.toLowerCase().endsWith('.pdf') ? nombre : nombre + '.pdf';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
    return true;
  }

  function validarSolicitud(data){
    const d = Object.assign({}, data || {});
    d.tipo_documento = texto(d.tipo_documento).toUpperCase();
    d.id_atencion = texto(d.id_atencion);
    d.id_receta = texto(d.id_receta || d.id_documento_clinico);
    d.html_documento = texto(d.html_documento);

    if(d.tipo_documento !== 'RECETA'){
      throw new Error('Esta integración de firma está habilitada únicamente para Recetas.');
    }
    if(!d.id_atencion) throw new Error('No existe una atención clínica activa para firmar.');
    if(!d.id_receta) throw new Error('Guarde la receta antes de firmarla electrónicamente.');
    if(!d.html_documento) throw new Error('No fue posible preparar el documento oficial de la receta.');
    return d;
  }

  async function sha256Texto(valor){
    const datos = new TextEncoder().encode(String(valor || ''));
    const hash = await crypto.subtle.digest('SHA-256', datos);
    return Array.from(new Uint8Array(hash))
      .map(function(b){ return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  async function claveFirma(solicitud){
    const huella = await sha256Texto(solicitud.html_documento);
    return solicitud.id_atencion + '|' + solicitud.id_receta + '|' + huella;
  }

  async function esperarFirma(idSolicitud, solicitud){
    /* Sin vencimiento artificial: la espera termina solo por FIRMADO, ERROR
       o por un estado terminal informado explícitamente por el backend. */
    while(true){
      const estado = await post('obtenerEstadoFirmaElectronica', {
        id_solicitud:idSolicitud,
        id_atencion:solicitud.id_atencion,
        id_receta:solicitud.id_receta
      });

      const valor = texto(estado.estado_firma).toUpperCase();

      if(valor === 'FIRMADO') return estado;
      if(valor === 'ERROR'){
        throw new Error(texto(estado.error) || 'El motor local informó un error al firmar el documento.');
      }
      if(valor === 'EXPIRADA'){
        throw new Error(texto(estado.error) || 'La solicitud de firma expiró. Vuelva a intentarlo.');
      }
      if(valor !== 'PENDIENTE' && valor !== 'TOMADA'){
        throw new Error('El servidor devolvió un estado de firma no reconocido.');
      }

      await esperar(INTERVALO_CONSULTA_MS);
    }
  }

  async function ejecutarFirma(solicitud, clave){
    const estadoMotor = await post('obtenerEstadoFirmaElectronica', {});
    if(estadoMotor.disponible !== true){
      throw new Error(
        estadoMotor.agente_online === false
          ? 'El motor de firma de Windows no está conectado. Inícielo y vuelva a intentar.'
          : 'La firma electrónica no está disponible en este momento.'
      );
    }

    const creada = await post('firmarDocumento', solicitud);
    const estadoInicial = texto(creada.estado_firma).toUpperCase();

    let resultado;
    if(estadoInicial === 'FIRMADO'){
      resultado = creada;
    }else{
      if(estadoInicial !== 'PENDIENTE' || !texto(creada.id_solicitud)){
        throw new Error('El servidor no creó correctamente la solicitud de firma.');
      }
      resultado = await esperarFirma(texto(creada.id_solicitud), solicitud);
    }

    if(texto(resultado.estado_firma).toUpperCase() !== 'FIRMADO'){
      throw new Error('El servidor no confirmó un estado de firma válido.');
    }

    if(!obtenerBase64Firmado(resultado)){
      throw new Error('La firma fue procesada, pero el servidor no devolvió el PDF firmado.');
    }

    /* Se conserva el PDF firmado en memoria para acciones explícitas posteriores.
       NO se abre y NO se descarga aquí. */
    ultimoResultadoFirmado = resultado;
    firmasConfirmadas.set(clave, resultado);

    window.dispatchEvent(new CustomEvent('aurosanax:firma-electronica-completada', {
      detail:{
        tipo_documento:solicitud.tipo_documento,
        id_atencion:solicitud.id_atencion,
        id_receta:solicitud.id_receta,
        id_solicitud:texto(resultado.id_solicitud),
        estado_firma:'FIRMADO',
        nombre_archivo:texto(resultado.nombre_archivo || solicitud.nombre_archivo),
        sha256_pdf_firmado:texto(resultado.sha256_pdf_firmado),
        firmado_en:texto(resultado.firmado_en),
        pdf_disponible:true
      }
    }));

    mensajeProfesional(
      'Documento firmado electrónicamente. El PDF firmado está listo para ver o descargar.',
      'ok'
    );

    return resultado;
  }

  async function firmarDocumento(data){
    let clave = '';
    try{
      const solicitud = validarSolicitud(data);
      clave = await claveFirma(solicitud);

      /* Si el mismo documento ya fue confirmado en esta sesión, no se vuelve
         a firmar ni se genera otro POST. */
      if(firmasConfirmadas.has(clave)){
        const existente = firmasConfirmadas.get(clave);
        ultimoResultadoFirmado = existente;
        mensajeProfesional(
          'Esta misma versión de la receta ya fue firmada. No se generó una firma duplicada.',
          'warn'
        );
        return existente;
      }

      /* Si hay una firma en curso, todos los clics posteriores reutilizan la
         misma promesa. Así se evita doble POST incluso con doble clic. */
      if(firmasEnCurso.has(clave)){
        mensajeProfesional('La receta ya se está firmando. Espere la confirmación.', 'warn');
        return firmasEnCurso.get(clave);
      }

      const operacion = ejecutarFirma(solicitud, clave);
      firmasEnCurso.set(clave, operacion);

      try{
        return await operacion;
      }finally{
        firmasEnCurso.delete(clave);
      }
    }catch(error){
      if(clave) firmasEnCurso.delete(clave);
      console.error(MODULO, error);
      mensajeProfesional(error && error.message ? error.message : String(error || ''), 'error');
      throw error;
    }
  }

  async function obtenerEstado(data){
    return post('obtenerEstadoFirmaElectronica', data || {});
  }

  function obtenerUltimoFirmado(){
    return ultimoResultadoFirmado;
  }

  window.auroFirmaElectronica = Object.freeze({
    version:VERSION,
    firmarDocumento:firmarDocumento,
    obtenerEstado:obtenerEstado,
    abrirPdfFirmado:abrirPdfFirmado,
    descargarPdfFirmado:descargarPdfFirmado,
    obtenerUltimoFirmado:obtenerUltimoFirmado
  });
})();

/* AUROSANAX V2.3 - OVERRIDE FINAL REABRIR PDF PENDIENTE */
/* ============================================================
   AUROSANAX ERP - FIRMA ELECTRÓNICA
   Archivo destino: firma_electronica.js
   Versión: 2.1
   Alcance inicial: RECETA
   ------------------------------------------------------------
   CONTRATO ANTIRREGRESIVO:
   - Mantiene window.auroFirmaElectronica.firmarDocumento(data).
   - No contiene certificado .p12, clave privada ni contraseña.
   - No declara una firma válida sin confirmación positiva del backend.
   - Falla cerrado ante configuración incompleta, sesión inválida o error.
   - Conserva aislamiento por id_atencion + id_receta.
   - Evita doble POST/doble firma de la misma receta y mismo contenido.
   - NO descarga ni abre automáticamente el PDF al terminar la firma.
   - Conserva funciones explícitas para VER o DESCARGAR el PDF firmado.
============================================================ */
(function(){
  'use strict';

  const MODULO = 'AUROSANAX FIRMA ELECTRÓNICA';
  const VERSION = '2.3-sin-tiempo-reabrir';
  const INTERVALO_CONSULTA_MS = 2500;

  /* Una sola operación activa por receta+contenido.
     V2.3: conserva también id_solicitud para REABRIR sin duplicar. */
  const firmasEnCurso = new Map();

  /* Resultado confirmado en esta sesión del navegador.
     La clave incluye la huella del HTML: si la receta cambia, puede firmarse
     nuevamente; si no cambia, no se genera una firma duplicada. */
  const firmasConfirmadas = new Map();
  let ultimoResultadoFirmado = null;

  function texto(valor){
    return String(valor === null || valor === undefined ? '' : valor).trim();
  }

  function apiUrl(){
    try{
      if(typeof API_URL !== 'undefined' && API_URL) return texto(API_URL);
    }catch(e){}
    if(window.API_URL) return texto(window.API_URL);
    const input = document.getElementById('appsScriptUrl');
    return input ? texto(input.value) : '';
  }

  function tokenSesion(){
    try{
      return texto(sessionStorage.getItem('aurosanax_seguridad_token'));
    }catch(e){
      return '';
    }
  }

  function mensajeProfesional(mensaje, tipo){
    const txt = texto(mensaje) || 'No fue posible completar la operación de firma electrónica.';
    const clase = tipo === 'ok' ? 'success' : (tipo === 'warn' ? 'warning' : 'danger');

    try{
      if(typeof window.mostrarToast === 'function'){
        window.mostrarToast(txt, clase);
        return;
      }
    }catch(e){}

    alert(txt);
  }

  async function post(accion, data){
    const url = apiUrl();
    if(!url) throw new Error('No se encontró la conexión segura con el servidor del ERP.');

    const payload = Object.assign({}, data || {}, {
      token: tokenSesion()
    });

    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({accion:accion, data:payload}),
      cache:'no-store'
    });

    if(!res.ok) throw new Error('El servidor de firma respondió HTTP ' + res.status + '.');

    const json = await res.json();
    if(!json || json.success !== true){
      throw new Error(texto(json && json.message) || 'El servidor no confirmó la firma electrónica.');
    }
    return json;
  }

  function esperar(ms){
    return new Promise(function(resolve){ setTimeout(resolve, ms); });
  }

  function base64ABlob(base64, mime){
    const limpio = texto(base64).replace(/^data:[^;]+;base64,/, '');
    const bin = atob(limpio);
    const bytes = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], {type:mime || 'application/pdf'});
  }

  function obtenerBase64Firmado(resultado){
    return texto(resultado && (resultado.pdf_firmado_base64 || resultado.archivo_base64));
  }

  /* Acción EXPLÍCITA: ver. Nunca se llama automáticamente al firmar. */
  function abrirPdfFirmado(resultado, nombrePreferido){
    const r = resultado || ultimoResultadoFirmado;
    const base64 = obtenerBase64Firmado(r);
    if(!base64) return false;

    const blob = base64ABlob(base64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const ventana = window.open(url, '_blank', 'noopener');
    if(!ventana){
      URL.revokeObjectURL(url);
      return false;
    }
    setTimeout(function(){ URL.revokeObjectURL(url); }, 5 * 60 * 1000);
    return true;
  }

  /* Acción EXPLÍCITA: descargar. Nunca se llama automáticamente al firmar. */
  function descargarPdfFirmado(resultado, nombrePreferido){
    const r = resultado || ultimoResultadoFirmado;
    const base64 = obtenerBase64Firmado(r);
    if(!base64) return false;

    const blob = base64ABlob(base64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const nombre = texto((r && r.nombre_archivo) || nombrePreferido || 'documento_firmado.pdf');

    const a = document.createElement('a');
    a.href = url;
    a.download = nombre.toLowerCase().endsWith('.pdf') ? nombre : nombre + '.pdf';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
    return true;
  }

  function validarSolicitud(data){
    const d = Object.assign({}, data || {});
    d.tipo_documento = texto(d.tipo_documento).toUpperCase();
    d.id_atencion = texto(d.id_atencion);
    d.id_receta = texto(d.id_receta || d.id_documento_clinico);
    d.html_documento = texto(d.html_documento);

    if(d.tipo_documento !== 'RECETA'){
      throw new Error('Esta integración de firma está habilitada únicamente para Recetas.');
    }
    if(!d.id_atencion) throw new Error('No existe una atención clínica activa para firmar.');
    if(!d.id_receta) throw new Error('Guarde la receta antes de firmarla electrónicamente.');
    if(!d.html_documento) throw new Error('No fue posible preparar el documento oficial de la receta.');
    return d;
  }

  async function sha256Texto(valor){
    const datos = new TextEncoder().encode(String(valor || ''));
    const hash = await crypto.subtle.digest('SHA-256', datos);
    return Array.from(new Uint8Array(hash))
      .map(function(b){ return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  async function claveFirma(solicitud){
    const huella = await sha256Texto(solicitud.html_documento);
    return solicitud.id_atencion + '|' + solicitud.id_receta + '|' + huella;
  }

  async function esperarFirma(idSolicitud, solicitud){
    /* Sin vencimiento artificial: la espera termina solo por FIRMADO, ERROR
       o por un estado terminal informado explícitamente por el backend. */
    while(true){
      const estado = await post('obtenerEstadoFirmaElectronica', {
        id_solicitud:idSolicitud,
        id_atencion:solicitud.id_atencion,
        id_receta:solicitud.id_receta
      });

      const valor = texto(estado.estado_firma).toUpperCase();

      if(valor === 'FIRMADO') return estado;
      if(valor === 'ERROR'){
        throw new Error(texto(estado.error) || 'El motor local informó un error al firmar el documento.');
      }
      if(valor === 'EXPIRADA'){
        throw new Error(texto(estado.error) || 'La solicitud de firma expiró. Vuelva a intentarlo.');
      }
      if(valor !== 'PENDIENTE' && valor !== 'TOMADA'){
        throw new Error('El servidor devolvió un estado de firma no reconocido.');
      }

      await esperar(INTERVALO_CONSULTA_MS);
    }
  }

  async function ejecutarFirma(solicitud, clave){
    const estadoMotor = await post('obtenerEstadoFirmaElectronica', {});
    if(estadoMotor.disponible !== true){
      throw new Error(
        estadoMotor.agente_online === false
          ? 'El motor de firma de Windows no está conectado. Inícielo y vuelva a intentar.'
          : 'La firma electrónica no está disponible en este momento.'
      );
    }

    const creada = await post('firmarDocumento', solicitud);
    const estadoInicial = texto(creada.estado_firma).toUpperCase();

    let resultado;
    if(estadoInicial === 'FIRMADO'){
      resultado = creada;
    }else{
      if(estadoInicial !== 'PENDIENTE' || !texto(creada.id_solicitud)){
        throw new Error('El servidor no creó correctamente la solicitud de firma.');
      }
      const activa = firmasEnCurso.get(clave);
      if(activa) activa.id_solicitud = texto(creada.id_solicitud);
      resultado = await esperarFirma(texto(creada.id_solicitud), solicitud);
    }

    if(texto(resultado.estado_firma).toUpperCase() !== 'FIRMADO'){
      throw new Error('El servidor no confirmó un estado de firma válido.');
    }

    if(!obtenerBase64Firmado(resultado)){
      throw new Error('La firma fue procesada, pero el servidor no devolvió el PDF firmado.');
    }

    /* Se conserva el PDF firmado en memoria para acciones explícitas posteriores.
       NO se abre y NO se descarga aquí. */
    ultimoResultadoFirmado = resultado;
    firmasConfirmadas.set(clave, resultado);

    window.dispatchEvent(new CustomEvent('aurosanax:firma-electronica-completada', {
      detail:{
        tipo_documento:solicitud.tipo_documento,
        id_atencion:solicitud.id_atencion,
        id_receta:solicitud.id_receta,
        id_solicitud:texto(resultado.id_solicitud),
        estado_firma:'FIRMADO',
        nombre_archivo:texto(resultado.nombre_archivo || solicitud.nombre_archivo),
        sha256_pdf_firmado:texto(resultado.sha256_pdf_firmado),
        firmado_en:texto(resultado.firmado_en),
        pdf_disponible:true
      }
    }));

    mensajeProfesional(
      'Documento firmado electrónicamente. El PDF firmado está listo para ver o descargar.',
      'ok'
    );

    return resultado;
  }

  async function firmarDocumento(data){
    let clave = '';
    try{
      const solicitud = validarSolicitud(data);
      clave = await claveFirma(solicitud);

      /* Si el mismo documento ya fue confirmado en esta sesión, no se vuelve
         a firmar ni se genera otro POST. */
      if(firmasConfirmadas.has(clave)){
        const existente = firmasConfirmadas.get(clave);
        ultimoResultadoFirmado = existente;
        mensajeProfesional(
          'Esta misma versión de la receta ya fue firmada. No se generó una firma duplicada.',
          'warn'
        );
        return existente;
      }

      /* Si hay una firma en curso, todos los clics posteriores reutilizan la
         misma promesa. Así se evita doble POST incluso con doble clic. */
      if(firmasEnCurso.has(clave)){
        const activa = firmasEnCurso.get(clave);
        if(activa && texto(activa.id_solicitud)){
          await post('firmarDocumento', {
            operacion_frontend:'REABRIR',
            id_solicitud:texto(activa.id_solicitud),
            id_atencion:solicitud.id_atencion,
            id_receta:solicitud.id_receta
          });
          mensajeProfesional('Se solicitó reabrir el mismo PDF pendiente en Acrobat.', 'warn');
        }else{
          mensajeProfesional('La solicitud todavía se está creando. Intente nuevamente en unos segundos.', 'warn');
        }
        return activa && activa.promesa ? activa.promesa : activa;
      }

      const activa = {promesa:null, id_solicitud:''};
      const operacion = ejecutarFirma(solicitud, clave);
      activa.promesa = operacion;
      firmasEnCurso.set(clave, activa);

      try{
        return await operacion;
      }finally{
        firmasEnCurso.delete(clave);
      }
    }catch(error){
      if(clave) firmasEnCurso.delete(clave);
      console.error(MODULO, error);
      mensajeProfesional(error && error.message ? error.message : String(error || ''), 'error');
      throw error;
    }
  }

  async function obtenerEstado(data){
    return post('obtenerEstadoFirmaElectronica', data || {});
  }

  function obtenerUltimoFirmado(){
    return ultimoResultadoFirmado;
  }

  window.auroFirmaElectronica = Object.freeze({
    version:VERSION,
    firmarDocumento:firmarDocumento,
    obtenerEstado:obtenerEstado,
    abrirPdfFirmado:abrirPdfFirmado,
    descargarPdfFirmado:descargarPdfFirmado,
    obtenerUltimoFirmado:obtenerUltimoFirmado
  });
})();

/* ============================================================
   AUROSANAX V2.4 - OVERRIDE FINAL: REABRIR + CANCELAR
   Adhesión append-only. Baseline anterior intacto arriba.
============================================================ */
/* ============================================================
   AUROSANAX ERP - FIRMA ELECTRÓNICA
   Archivo destino: firma_electronica.js
   Versión: 2.1
   Alcance inicial: RECETA
   ------------------------------------------------------------
   CONTRATO ANTIRREGRESIVO:
   - Mantiene window.auroFirmaElectronica.firmarDocumento(data).
   - No contiene certificado .p12, clave privada ni contraseña.
   - No declara una firma válida sin confirmación positiva del backend.
   - Falla cerrado ante configuración incompleta, sesión inválida o error.
   - Conserva aislamiento por id_atencion + id_receta.
   - Evita doble POST/doble firma de la misma receta y mismo contenido.
   - NO descarga ni abre automáticamente el PDF al terminar la firma.
   - Conserva funciones explícitas para VER o DESCARGAR el PDF firmado.
============================================================ */
(function(){
  'use strict';

  const MODULO = 'AUROSANAX FIRMA ELECTRÓNICA';
  const VERSION = '2.4-sin-tiempo-reabrir-cancelar';
  const INTERVALO_CONSULTA_MS = 2500;

  /* Una sola operación activa por receta+contenido.
     V2.3: conserva también id_solicitud para REABRIR sin duplicar. */
  const firmasEnCurso = new Map();

  /* Resultado confirmado en esta sesión del navegador.
     La clave incluye la huella del HTML: si la receta cambia, puede firmarse
     nuevamente; si no cambia, no se genera una firma duplicada. */
  const firmasConfirmadas = new Map();
  let ultimoResultadoFirmado = null;
  let claveActivaVisible = '';
  let solicitudActivaVisible = null;

  function texto(valor){
    return String(valor === null || valor === undefined ? '' : valor).trim();
  }

  function apiUrl(){
    try{
      if(typeof API_URL !== 'undefined' && API_URL) return texto(API_URL);
    }catch(e){}
    if(window.API_URL) return texto(window.API_URL);
    const input = document.getElementById('appsScriptUrl');
    return input ? texto(input.value) : '';
  }

  function tokenSesion(){
    try{
      return texto(sessionStorage.getItem('aurosanax_seguridad_token'));
    }catch(e){
      return '';
    }
  }

  function mensajeProfesional(mensaje, tipo){
    const txt = texto(mensaje) || 'No fue posible completar la operación de firma electrónica.';
    const clase = tipo === 'ok' ? 'success' : (tipo === 'warn' ? 'warning' : 'danger');

    try{
      if(typeof window.mostrarToast === 'function'){
        window.mostrarToast(txt, clase);
        return;
      }
    }catch(e){}

    alert(txt);
  }

  async function post(accion, data){
    const url = apiUrl();
    if(!url) throw new Error('No se encontró la conexión segura con el servidor del ERP.');

    const payload = Object.assign({}, data || {}, {
      token: tokenSesion()
    });

    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({accion:accion, data:payload}),
      cache:'no-store'
    });

    if(!res.ok) throw new Error('El servidor de firma respondió HTTP ' + res.status + '.');

    const json = await res.json();
    if(!json || json.success !== true){
      throw new Error(texto(json && json.message) || 'El servidor no confirmó la firma electrónica.');
    }
    return json;
  }

  function esperar(ms){
    return new Promise(function(resolve){ setTimeout(resolve, ms); });
  }

  function base64ABlob(base64, mime){
    const limpio = texto(base64).replace(/^data:[^;]+;base64,/, '');
    const bin = atob(limpio);
    const bytes = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], {type:mime || 'application/pdf'});
  }

  function obtenerBase64Firmado(resultado){
    return texto(resultado && (resultado.pdf_firmado_base64 || resultado.archivo_base64));
  }

  /* Acción EXPLÍCITA: ver. Nunca se llama automáticamente al firmar. */
  function abrirPdfFirmado(resultado, nombrePreferido){
    const r = resultado || ultimoResultadoFirmado;
    const base64 = obtenerBase64Firmado(r);
    if(!base64) return false;

    const blob = base64ABlob(base64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const ventana = window.open(url, '_blank', 'noopener');
    if(!ventana){
      URL.revokeObjectURL(url);
      return false;
    }
    setTimeout(function(){ URL.revokeObjectURL(url); }, 5 * 60 * 1000);
    return true;
  }

  /* Acción EXPLÍCITA: descargar. Nunca se llama automáticamente al firmar. */
  function descargarPdfFirmado(resultado, nombrePreferido){
    const r = resultado || ultimoResultadoFirmado;
    const base64 = obtenerBase64Firmado(r);
    if(!base64) return false;

    const blob = base64ABlob(base64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const nombre = texto((r && r.nombre_archivo) || nombrePreferido || 'documento_firmado.pdf');

    const a = document.createElement('a');
    a.href = url;
    a.download = nombre.toLowerCase().endsWith('.pdf') ? nombre : nombre + '.pdf';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
    return true;
  }


  function ocultarBotonCancelar(){
    const btn = document.getElementById('btnCancelarFirmaElectronicaReceta');
    if(btn) btn.style.display = 'none';
    claveActivaVisible = '';
    solicitudActivaVisible = null;
  }

  function mostrarBotonCancelar(solicitud, clave){
    claveActivaVisible = clave || '';
    solicitudActivaVisible = solicitud || null;

    const firmar = document.getElementById('btnFirmaElectronicaReceta');
    if(!firmar) return;

    let btn = document.getElementById('btnCancelarFirmaElectronicaReceta');
    if(!btn){
      btn = document.createElement('button');
      btn.id = 'btnCancelarFirmaElectronicaReceta';
      btn.type = 'button';
      btn.textContent = 'Cancelar firma';
      btn.title = 'Cancelar la solicitud de firma pendiente sin borrar la receta';
      btn.style.marginLeft = '8px';
      btn.style.cursor = 'pointer';
      firmar.insertAdjacentElement('afterend', btn);
    }

    btn.onclick = async function(){
      try{
        if(!solicitudActivaVisible) return;
        const confirmar = window.confirm(
          '¿Cancelar esta solicitud de firma?\n\nLa receta NO se elimina. Solo se cancela la firma pendiente.'
        );
        if(!confirmar) return;
        await cancelarFirmaDocumento(solicitudActivaVisible);
      }catch(_e){}
    };
    btn.style.display = '';
  }

  async function cancelarFirmaDocumento(data){
    let clave = '';
    try{
      const solicitud = validarSolicitud(data);
      clave = await claveFirma(solicitud);
      const activa = firmasEnCurso.get(clave);

      if(!activa || !texto(activa.id_solicitud)){
        mensajeProfesional('No existe una solicitud de firma pendiente para cancelar.', 'warn');
        return {success:true, estado_firma:'SIN_PENDIENTE'};
      }

      const respuesta = await post('firmarDocumento', {
        operacion_frontend:'CANCELAR',
        id_solicitud:texto(activa.id_solicitud),
        id_atencion:solicitud.id_atencion,
        id_receta:solicitud.id_receta
      });

      const estado = texto(respuesta.estado_firma).toUpperCase();
      if(estado !== 'CANCELADA'){
        throw new Error('El servidor no confirmó la cancelación de la firma.');
      }

      activa.cancelada = true;
      firmasEnCurso.delete(clave);
      ocultarBotonCancelar();

      window.dispatchEvent(new CustomEvent('aurosanax:firma-electronica-cancelada', {
        detail:{
          tipo_documento:solicitud.tipo_documento,
          id_atencion:solicitud.id_atencion,
          id_receta:solicitud.id_receta,
          id_solicitud:texto(respuesta.id_solicitud),
          estado_firma:'CANCELADA'
        }
      }));

      mensajeProfesional('Solicitud de firma cancelada. La receta se conserva sin cambios.', 'warn');
      return respuesta;
    }catch(error){
      console.error(MODULO, error);
      mensajeProfesional(error && error.message ? error.message : String(error || ''), 'error');
      throw error;
    }
  }

  function validarSolicitud(data){
    const d = Object.assign({}, data || {});
    d.tipo_documento = texto(d.tipo_documento).toUpperCase();
    d.id_atencion = texto(d.id_atencion);
    d.id_receta = texto(d.id_receta || d.id_documento_clinico);
    d.html_documento = texto(d.html_documento);

    if(d.tipo_documento !== 'RECETA'){
      throw new Error('Esta integración de firma está habilitada únicamente para Recetas.');
    }
    if(!d.id_atencion) throw new Error('No existe una atención clínica activa para firmar.');
    if(!d.id_receta) throw new Error('Guarde la receta antes de firmarla electrónicamente.');
    if(!d.html_documento) throw new Error('No fue posible preparar el documento oficial de la receta.');
    return d;
  }

  async function sha256Texto(valor){
    const datos = new TextEncoder().encode(String(valor || ''));
    const hash = await crypto.subtle.digest('SHA-256', datos);
    return Array.from(new Uint8Array(hash))
      .map(function(b){ return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  async function claveFirma(solicitud){
    const huella = await sha256Texto(solicitud.html_documento);
    return solicitud.id_atencion + '|' + solicitud.id_receta + '|' + huella;
  }

  async function esperarFirma(idSolicitud, solicitud){
    /* Sin vencimiento artificial: la espera termina solo por FIRMADO, ERROR
       o por un estado terminal informado explícitamente por el backend. */
    while(true){
      const estado = await post('obtenerEstadoFirmaElectronica', {
        id_solicitud:idSolicitud,
        id_atencion:solicitud.id_atencion,
        id_receta:solicitud.id_receta
      });

      const valor = texto(estado.estado_firma).toUpperCase();

      if(valor === 'FIRMADO') return estado;
      if(valor === 'ERROR'){
        throw new Error(texto(estado.error) || 'El motor local informó un error al firmar el documento.');
      }
      if(valor === 'EXPIRADA'){
        throw new Error(texto(estado.error) || 'La solicitud de firma expiró. Vuelva a intentarlo.');
      }
      if(valor === 'CANCELADA') return estado;
      if(valor !== 'PENDIENTE' && valor !== 'TOMADA'){
        throw new Error('El servidor devolvió un estado de firma no reconocido.');
      }

      await esperar(INTERVALO_CONSULTA_MS);
    }
  }

  async function ejecutarFirma(solicitud, clave){
    const estadoMotor = await post('obtenerEstadoFirmaElectronica', {});
    if(estadoMotor.disponible !== true){
      throw new Error(
        estadoMotor.agente_online === false
          ? 'El motor de firma de Windows no está conectado. Inícielo y vuelva a intentar.'
          : 'La firma electrónica no está disponible en este momento.'
      );
    }

    const creada = await post('firmarDocumento', solicitud);
    const estadoInicial = texto(creada.estado_firma).toUpperCase();

    let resultado;
    if(estadoInicial === 'FIRMADO'){
      resultado = creada;
    }else{
      if(estadoInicial !== 'PENDIENTE' || !texto(creada.id_solicitud)){
        throw new Error('El servidor no creó correctamente la solicitud de firma.');
      }
      const activa = firmasEnCurso.get(clave);
      if(activa){
        activa.id_solicitud = texto(creada.id_solicitud);
        activa.solicitud = solicitud;
      }
      mostrarBotonCancelar(solicitud, clave);
      resultado = await esperarFirma(texto(creada.id_solicitud), solicitud);
    }

    if(texto(resultado.estado_firma).toUpperCase() === 'CANCELADA'){
      ocultarBotonCancelar();
      return resultado;
    }

    if(texto(resultado.estado_firma).toUpperCase() !== 'FIRMADO'){
      throw new Error('El servidor no confirmó un estado de firma válido.');
    }

    if(!obtenerBase64Firmado(resultado)){
      throw new Error('La firma fue procesada, pero el servidor no devolvió el PDF firmado.');
    }

    /* Se conserva el PDF firmado en memoria para acciones explícitas posteriores.
       NO se abre y NO se descarga aquí. */
    ultimoResultadoFirmado = resultado;
    firmasConfirmadas.set(clave, resultado);
    ocultarBotonCancelar();

    window.dispatchEvent(new CustomEvent('aurosanax:firma-electronica-completada', {
      detail:{
        tipo_documento:solicitud.tipo_documento,
        id_atencion:solicitud.id_atencion,
        id_receta:solicitud.id_receta,
        id_solicitud:texto(resultado.id_solicitud),
        estado_firma:'FIRMADO',
        nombre_archivo:texto(resultado.nombre_archivo || solicitud.nombre_archivo),
        sha256_pdf_firmado:texto(resultado.sha256_pdf_firmado),
        firmado_en:texto(resultado.firmado_en),
        pdf_disponible:true
      }
    }));

    mensajeProfesional(
      'Documento firmado electrónicamente. El PDF firmado está listo para ver o descargar.',
      'ok'
    );

    return resultado;
  }

  async function firmarDocumento(data){
    let clave = '';
    try{
      const solicitud = validarSolicitud(data);
      clave = await claveFirma(solicitud);

      /* Si el mismo documento ya fue confirmado en esta sesión, no se vuelve
         a firmar ni se genera otro POST. */
      if(firmasConfirmadas.has(clave)){
        const existente = firmasConfirmadas.get(clave);
        ultimoResultadoFirmado = existente;
        mensajeProfesional(
          'Esta misma versión de la receta ya fue firmada. No se generó una firma duplicada.',
          'warn'
        );
        return existente;
      }

      /* Si hay una firma en curso, todos los clics posteriores reutilizan la
         misma promesa. Así se evita doble POST incluso con doble clic. */
      if(firmasEnCurso.has(clave)){
        const activa = firmasEnCurso.get(clave);
        if(activa && texto(activa.id_solicitud)){
          await post('firmarDocumento', {
            operacion_frontend:'REABRIR',
            id_solicitud:texto(activa.id_solicitud),
            id_atencion:solicitud.id_atencion,
            id_receta:solicitud.id_receta
          });
          mensajeProfesional('Se solicitó reabrir el mismo PDF pendiente en Acrobat.', 'warn');
        }else{
          mensajeProfesional('La solicitud todavía se está creando. Intente nuevamente en unos segundos.', 'warn');
        }
        return activa && activa.promesa ? activa.promesa : activa;
      }

      const activa = {promesa:null, id_solicitud:'', solicitud:solicitud, cancelada:false};
      const operacion = ejecutarFirma(solicitud, clave);
      activa.promesa = operacion;
      firmasEnCurso.set(clave, activa);

      try{
        return await operacion;
      }finally{
        firmasEnCurso.delete(clave);
      }
    }catch(error){
      if(clave) firmasEnCurso.delete(clave);
      ocultarBotonCancelar();
      console.error(MODULO, error);
      mensajeProfesional(error && error.message ? error.message : String(error || ''), 'error');
      throw error;
    }
  }

  async function obtenerEstado(data){
    return post('obtenerEstadoFirmaElectronica', data || {});
  }

  function obtenerUltimoFirmado(){
    return ultimoResultadoFirmado;
  }

  window.auroFirmaElectronica = Object.freeze({
    version:VERSION,
    firmarDocumento:firmarDocumento,
    cancelarFirmaDocumento:cancelarFirmaDocumento,
    obtenerEstado:obtenerEstado,
    abrirPdfFirmado:abrirPdfFirmado,
    descargarPdfFirmado:descargarPdfFirmado,
    obtenerUltimoFirmado:obtenerUltimoFirmado
  });
})();
