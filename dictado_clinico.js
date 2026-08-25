/*
AUROSANAX Clinical ERP
Archivo: dictado_clinico.js
PRUEBA CONTROLADA - ANAMNESIS
No guarda datos, no usa Apps Script ni Google Sheets.
*/
(function(){
  'use strict';

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const state = { recognition:null, target:null, button:null, listening:false };

  const normalizar = v => String(v || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/\s+/g,' ').trim();

  function esVisible(el){
    if(!el || !el.isConnected) return false;
    const st = getComputedStyle(el);
    if(st.display === 'none' || st.visibility === 'hidden') return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function textoEtiqueta(campo){
    if(campo.id){
      const label = document.querySelector(`label[for="${CSS.escape(campo.id)}"]`);
      if(label) return normalizar(label.textContent);
    }
    const bloque = campo.closest('.col-md-12,.col-12,.form-group,.mb-3,.mb-2,.clinical-panel,.card,.row') || campo.parentElement;
    return normalizar(bloque?.querySelector('label')?.textContent || '');
  }

  function campoPermitido(campo){
    if(!campo || campo.tagName !== 'TEXTAREA' || !campo.closest('#hc_anamnesis')) return false;
    const et = textoEtiqueta(campo);
    const id = normalizar(campo.id).replace(/\s+/g,'_');
    const claves = ['enfermedad actual','descripcion evolucion','evolucion y caracteristicas','caracteristicas'];
    return claves.some(k => et.includes(normalizar(k)) || id.includes(normalizar(k).replace(/\s+/g,'_')));
  }

  function estilos(){
    if(document.getElementById('auro-dictado-clinico-style')) return;
    const st = document.createElement('style');
    st.id = 'auro-dictado-clinico-style';
    st.textContent = `
      .auro-dictado-wrap{display:flex;align-items:center;gap:8px;margin:6px 0 8px;flex-wrap:wrap}
      .auro-dictado-btn{border:1px solid #d1d5db;background:#fff;color:#374151;border-radius:10px;padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
      .auro-dictado-btn.auro-escuchando{border-color:#dc2626;color:#b91c1c;background:#fef2f2}
      .auro-dictado-status{font-size:12px;color:#6b7280}
      .auro-dictado-status.activo{color:#b91c1c;font-weight:700}
    `;
    document.head.appendChild(st);
  }

  function limpiarEstado(){
    if(state.button){
      state.button.classList.remove('auro-escuchando');
      state.button.innerHTML = '<i class="bi bi-mic"></i> Dictar';
      const status = state.button.parentElement?.querySelector('.auro-dictado-status');
      if(status){ status.textContent=''; status.classList.remove('activo'); }
    }
    state.recognition = null;
    state.target = null;
    state.button = null;
    state.listening = false;
  }

  function detener(mensaje){
    const btn = state.button;
    try{ state.recognition?.stop(); }catch(_e){}
    if(btn){
      const status = btn.parentElement?.querySelector('.auro-dictado-status');
      if(status) status.textContent = mensaje || '';
    }
    setTimeout(limpiarEstado, 0);
  }

  function insertarTexto(campo, texto){
    if(!campo || !texto) return;
    const ini = typeof campo.selectionStart === 'number' ? campo.selectionStart : campo.value.length;
    const fin = typeof campo.selectionEnd === 'number' ? campo.selectionEnd : campo.value.length;
    const antes = campo.value.slice(0,ini);
    const despues = campo.value.slice(fin);
    const frag = String(texto).trim();
    const espacio = antes && !/\s$/.test(antes) ? ' ' : '';
    campo.value = antes + espacio + frag + despues;
    const pos = (antes + espacio + frag).length;
    try{ campo.selectionStart = pos; campo.selectionEnd = pos; }catch(_e){}
    campo.dispatchEvent(new Event('input',{bubbles:true}));
    campo.dispatchEvent(new Event('change',{bubbles:true}));
    campo.focus();
  }

  function iniciar(campo, boton){
    if(!SpeechRecognition){
      alert('El dictado por voz no está disponible en este navegador. Puede seguir escribiendo normalmente.');
      return;
    }

    if(state.listening){
      if(state.target === campo){ detener('Dictado detenido.'); return; }
      detener('Dictado detenido al cambiar de campo.');
    }

    const r = new SpeechRecognition();
    r.lang = 'es-EC';
    r.continuous = true;
    r.interimResults = false;
    r.maxAlternatives = 1;

    state.recognition = r;
    state.target = campo;
    state.button = boton;
    state.listening = true;

    r.onstart = () => {
      boton.classList.add('auro-escuchando');
      boton.innerHTML = '<i class="bi bi-stop-circle"></i> Detener';
      const status = boton.parentElement?.querySelector('.auro-dictado-status');
      if(status){ status.textContent='Escuchando…'; status.classList.add('activo'); }
    };

    r.onresult = event => {
      if(!state.target || !esVisible(state.target)){ detener('Dictado detenido por seguridad.'); return; }
      let txt = '';
      for(let i=event.resultIndex;i<event.results.length;i++){
        if(event.results[i].isFinal) txt += ' ' + (event.results[i][0]?.transcript || '');
      }
      insertarTexto(state.target, txt);
    };

    r.onerror = event => {
      const status = boton.parentElement?.querySelector('.auro-dictado-status');
      if(status) status.textContent = /not-allowed|service-not-allowed/.test(String(event?.error||'')) ? 'Permiso de micrófono bloqueado.' : 'Dictado detenido.';
    };

    r.onend = limpiarEstado;

    try{ r.start(); }catch(e){ console.warn('AUROSANAX Dictado Clínico:', e); limpiarEstado(); }
  }

  function instalar(campo){
    if(!campoPermitido(campo) || campo.dataset.auroDictadoClinico === '1') return;
    campo.dataset.auroDictadoClinico = '1';
    campo.setAttribute('lang','es-EC');

    const wrap = document.createElement('div');
    wrap.className = 'auro-dictado-wrap';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'auro-dictado-btn';
    btn.innerHTML = '<i class="bi bi-mic"></i> Dictar';
    const status = document.createElement('span');
    status.className = 'auro-dictado-status';

    btn.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      iniciar(campo, btn);
    });

    wrap.append(btn,status);
    campo.insertAdjacentElement('beforebegin',wrap);
  }

  function escanear(){
    document.querySelectorAll('#hc_anamnesis textarea').forEach(instalar);
  }

  function init(){
    estilos();
    escanear();

    const obs = new MutationObserver(() => {
      escanear();
      if(state.listening && state.target && !esVisible(state.target)) detener('Dictado detenido al salir del módulo.');
    });
    obs.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden']});

    document.addEventListener('change', ev => {
      if(!state.listening) return;
      const id = String(ev.target?.id || '');
      if(id === 'hcPacienteSelect' || /atencion/i.test(id) || (/paciente/i.test(id) && ev.target?.tagName === 'SELECT')){
        detener('Dictado detenido al cambiar de paciente/atención.');
      }
    },true);

    document.addEventListener('click', ev => {
      if(!state.listening) return;
      if(state.button && (ev.target === state.button || state.button.contains(ev.target))) return;
      if(ev.target === state.target) return;
      const nav = ev.target.closest?.('[data-screen],[data-bs-toggle="tab"],.nav-link,.sidebar button,.sidebar a');
      if(nav) detener('Dictado detenido al cambiar de módulo.');
    },true);

    document.addEventListener('visibilitychange', () => {
      if(document.hidden && state.listening) detener('Dictado detenido al salir de la pestaña.');
    });

    window.addEventListener('blur', () => {
      if(state.listening) detener('Dictado detenido por seguridad.');
    });

    window.auroDetenerDictadoClinico = () => detener('Dictado detenido.');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
