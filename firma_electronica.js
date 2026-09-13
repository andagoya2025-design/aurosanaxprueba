/* ============================================================
   AUROSANAX ERP - FIRMA ELECTRÓNICA
   Archivo: firma_electronica.js
   Versión: 2.0
   Alcance inicial: RECETA
   ------------------------------------------------------------
   CONTRATO ANTIRREGRESIVO:
   - Mantiene window.auroFirmaElectronica.firmarDocumento(data).
   - No contiene certificado .p12, clave privada ni contraseña.
   - No declara una firma válida sin confirmación positiva del backend.
   - Falla cerrado ante configuración incompleta, sesión inválida o error.
   - Conserva aislamiento por id_atencion + id_receta.
   - El backend crea una solicitud; este módulo espera el resultado firmado.
============================================================ */
(function(){
  'use strict';

  const MODULO = 'AUROSANAX FIRMA ELECTRÓNICA';
  const VERSION = '2.0';
  const INTERVALO_CONSULTA_MS = 2500;
  const TIEMPO_MAXIMO_MS = 10 * 60 * 1000;

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

  function abrirPdfFirmado(resultado, nombrePreferido){
    const base64 = texto(resultado && (resultado.pdf_firmado_base64 || resultado.archivo_base64));
    if(!base64) return false;

    const blob = base64ABlob(base64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const nombre = texto(resultado.nombre_archivo || nombrePreferido || 'documento_firmado.pdf');

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
      throw new Error('Esta primera integración de firma está habilitada únicamente para Recetas.');
    }
    if(!d.id_atencion) throw new Error('No existe una atención clínica activa para firmar.');
    if(!d.id_receta) throw new Error('Guarde la receta antes de firmarla electrónicamente.');
    if(!d.html_documento) throw new Error('No fue posible preparar el documento oficial de la receta.');
    return d;
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

  async function firmarDocumento(data){
    try{
      const solicitud = validarSolicitud(data);

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

      if(!abrirPdfFirmado(resultado, solicitud.nombre_archivo)){
        throw new Error('La firma fue procesada, pero el servidor no devolvió el PDF firmado.');
      }

      mensajeProfesional('Documento firmado electrónicamente.', 'ok');
      window.dispatchEvent(new CustomEvent('aurosanax:firma-electronica-completada', {
        detail:{
          tipo_documento:solicitud.tipo_documento,
          id_atencion:solicitud.id_atencion,
          id_receta:solicitud.id_receta,
          id_solicitud:texto(resultado.id_solicitud),
          estado_firma:'FIRMADO'
        }
      }));
      return resultado;
    }catch(error){
      console.error(MODULO, error);
      mensajeProfesional(error && error.message ? error.message : String(error || ''), 'error');
      throw error;
    }
  }

  async function obtenerEstado(){
    return post('obtenerEstadoFirmaElectronica', {});
  }

  window.auroFirmaElectronica = Object.freeze({
    version:VERSION,
    firmarDocumento:firmarDocumento,
    obtenerEstado:obtenerEstado,
    abrirPdfFirmado:abrirPdfFirmado
  });
})();
