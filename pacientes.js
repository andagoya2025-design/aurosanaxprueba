/* ==========================================================
   AUROSANAX PACIENTES 06 - TELÉFONO INTERNACIONAL ANTIRREGRESIVO
   APLICAR EN pacientes.js

   ALCANCE EXCLUSIVO:
   - teléfonos de paciente / WhatsApp
   - compatibilidad Ecuador + internacional

   NO TOCA:
   - Agenda médica
   - Historia clínica
   - Atenciones
   - estados del paciente
   - IDs
   - guardados de otros módulos
   - datos históricos
   ========================================================== */

/*
 * 1. El valor clínico/administrativo del teléfono SE CONSERVA COMO TEXTO.
 *    No convertir a Number(), parseInt(), unary +, etc.
 * 2. Esta función se usa SOLO cuando se construye un enlace WhatsApp.
 * 3. Mantiene compatibilidad con registros ecuatorianos antiguos de 9 dígitos.
 */
function normalizarTelefonoWhatsAppInternacional(numero){
  let raw = String(numero === null || numero === undefined ? '' : numero).trim();
  if(!raw) return '';

  // Permite +, espacios, paréntesis y guiones en la ficha.
  let n = raw.replace(/[^\d+]/g, '');

  // wa.me requiere solo dígitos.
  if(n.startsWith('+')) n = n.slice(1);
  if(n.startsWith('00')) n = n.slice(2);

  if(!n) return '';

  /*
   * Ecuador:
   * 0986535080 -> 593986535080
   * 986535080  -> 593986535080 (compatibilidad histórica)
   * 593986535080 -> se conserva.
   */
  if(/^0\d{9}$/.test(n)){
    return '593' + n.slice(1);
  }

  if(/^9\d{8}$/.test(n)){
    return '593' + n;
  }

  /*
   * Internacional:
   * 13055551234, 34612345678, 573001234567, 593...
   * se conservan; NO se fuerza prefijo 593.
   */
  return n;
}

/*
 * Alias de compatibilidad:
 * las llamadas antiguas siguen funcionando sin tocar Agenda ni otros módulos.
 */
function normalizarTelefonoEcuador(numero){
  return normalizarTelefonoWhatsAppInternacional(numero);
}

/*
 * Si abrirWhatsApp ya existe, sustituir ÚNICAMENTE su llamada al
 * normalizador anterior por normalizarTelefonoWhatsAppInternacional().
 *
 * Versión completa compatible:
 */
function abrirWhatsApp(numero, mensaje){
  const tel = normalizarTelefonoWhatsAppInternacional(numero);
  if(!tel){
    alert('No hay número de WhatsApp registrado.');
    return;
  }

  const url = 'https://wa.me/' + tel + '?text=' + encodeURIComponent(mensaje || '');
  window.open(url, '_blank');
}

/*
 * IMPORTANTE EN savePatient():
 * NO cambiar estas líneas; ya son correctas porque leen String desde input:
 *
 * telefono: document.getElementById('pTelefono').value.trim(),
 * whatsapp: document.getElementById('pTelefono').value.trim(),
 * telefono_emergencia: document.getElementById('pTelefonoEmergencia')?.value.trim() || '',
 *
 * Tampoco normalizar a 593 antes de guardar.
 * El formato internacional es solo para abrir WhatsApp.
 */
