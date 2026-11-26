/* AUROSANAX NOTIFICACIONES V1 RC7 — candidato de estabilización; requiere paquete coordinado.
 * Base RC4: blob 013187a939dc758d5ab34f68d6235867be24ff83. No desplegado.
 * RC7: recuperación de voz, operación única de Anamnesis y eventos de Diagnósticos/Examen físico. Sin red nueva.
 * Observador de eventos: no ejecuta operaciones clínicas, no consulta el servidor,
 * no modifica PDF/QR, firma, formularios ni persistencia clínica.
 * Activar exclusivamente tras la validación de acceso del documento anfitrión.
 */
(function(root, factory){
  'use strict';
  if(typeof module==='object' && module.exports) module.exports=factory;
  else if(root && !root.AURO_NOTIFICACIONES) root.AURO_NOTIFICACIONES=factory(root);
})(typeof window==='object'?window:null, function(w){
  'use strict';
  const d=w.document, PREFIX='aurosanax.notificaciones.v1.', E='aurosanax:';
  const modules={atenciones:'Atenciones',anamnesis:'Anamnesis',firma:'Firma electrónica',diagnosticos:'Diagnósticos',agenda:'Agenda',pacientes:'Pacientes',examen:'Examen físico',plan:'Plan clínico',recetas:'Recetas',documentos:'Documentos',resultados:'Resultados',obstetricia:'Obstetricia',estetica:'Estética',recomendaciones:'Recomendaciones'};
  const ready=new Set(['atenciones','anamnesis','diagnosticos','examen','recetas','firma']);
  const extraModules=new Set(['diagnosticos','examen']);
  const recetaMessages=Object.freeze({alta:'Receta médica guardada correctamente.',edicion:'Receta médica actualizada correctamente.',plan_pendiente:'Receta guardada. Sincronización con el Plan no confirmada.',no_confirmada:'No se pudo confirmar el guardado de la receta.'});
  const legacyReady=new Set(['atenciones','anamnesis']);
  const messages={firma:'Documento firmado correctamente.',inicio:'Atención iniciada y confirmada.',cierre:'Atención finalizada y confirmada.',anamnesis:'Anamnesis guardada y confirmada.',pendiente:'Atención: confirmación de guardado pendiente.',prueba:'Prueba de notificaciones de AUROSANAX.'};
  const clean=x=>typeof x==='string'?x.trim():'';
  const now=()=>Date.now();
  const limit=(x,a,b,f)=>typeof x==='number'&&Number.isFinite(x)?Math.min(b,Math.max(a,x)):f;
  const defaultModule=k=>k!=='firma'&&ready.has(k);
  const defaults=()=>({mode:'silencio',visual:true,volume:65,rate:1,voice:'',modules:Object.fromEntries(Object.keys(modules).map(k=>[k,{visual:defaultModule(k),audio:defaultModule(k)}]))});
  function normalized(raw){
    const p=defaults(); if(!raw||typeof raw!=='object')return p;
    if(['silencio','timbre','voz','ambos'].includes(raw.mode))p.mode=raw.mode;
    if(typeof raw.visual==='boolean')p.visual=raw.visual;
    p.volume=limit(raw.volume,0,100,p.volume);p.rate=limit(raw.rate,.8,1.2,p.rate);
    p.voice=clean(raw.voice).slice(0,160);
    for(const k of legacyReady)for(const c of ['visual','audio'])if(typeof raw.modules?.[k]?.[c]==='boolean')p.modules[k][c]=raw.modules[k][c];
    // No rescatar casillas antiguas de RC5. Solo aceptación expresa en RC6.
    // RC7: nuevos módulos habilitados por defecto, conservar elecciones explícitas de RC6/RC7.
    for(const k of extraModules)if(raw.rc7Modulos===true||(k==='diagnosticos'&&raw.rc6Diagnosticos===true))for(const c of ['visual','audio'])if(typeof raw.modules?.[k]?.[c]==='boolean')p.modules[k][c]=raw.modules[k][c];
    p.rc7Modulos=true;
    if(raw.rc8Recetas===true)for(const c of ['visual','audio'])if(typeof raw.modules?.recetas?.[c]==='boolean')p.modules.recetas[c]=raw.modules.recetas[c];
    p.rc8Recetas=true;
    if(raw.firmaRecetaV1===true)for(const c of ['visual','audio'])if(typeof raw.modules?.firma?.[c]==='boolean')p.modules.firma[c]=raw.modules.firma[c];
    p.firmaRecetaV1=true;
    return p;
  }
  let role='',active=false,owner='',sessionToken='',prefs=defaults(),items=[],seen=new Set(),origins=new Map(),retired=new Set();
  let generation=0,context='',epoch=null,starting=null,closing=null,queue=[],playing=null,armed=false,ac=null,tones=new Set(),mic=new Set(),timer=null,ui=null;
  let unsafeOrigins=false, anChain=Promise.resolve(), anJobs=0, quietUntil=0;
  const anOps=new Map();let anHigh=0,blockedVoice=null,voiceBlocked=false,voicePrepared=false,prime=null;
  // Intención del usuario separada del desbloqueo temporal del navegador.
  let manualMute=false, unlocked=false, audioUI=null;
  // Recursos separados del registro seen/origins de RC4. Una sola tarea pendiente.
  let dxPending=new Map(),dxTimer=null,dxEvents=new WeakSet();
  let dxReleaseUntil=0,dxRetryTimer=null;
  function identity(){
    try{const sec=w.AUROSANAX_SEGURIDAD,u=sec?.obtenerUsuario?.(),s=sec?.obtenerSesion?.(),t=sec?.obtenerToken?.();
      const id=clean(u?.id_usuario);if(!id||!s||!clean(t)||!sec.tienePermiso(role==='config'?'configuracion':'dashboard',u))return null;
      return {id,token:t};}catch{return null;}
  }
  function current(){try{return {id:clean(w.getIdAtencionActiva?.()),epoch:w.getContextoAtencionEpoch?.()??null};}catch{return {id:'',epoch:null};}}
  function load(){try{return normalized(JSON.parse(w.localStorage.getItem(PREFIX+owner)||'null'));}catch{return defaults();}}
  function save(){try{w.localStorage.setItem(PREFIX+owner,JSON.stringify(prefs));return true;}catch{return false;}}
  function localVoices(){try{return (w.speechSynthesis?.getVoices?.()||[]).filter(v=>v.localService===true&&/^es(?:[-_]|$)/i.test(v.lang));}catch{return [];}}
  function focused(){return !d.hidden&&(!d.hasFocus||d.hasFocus());}
  function stopAudio(){
    cancelDxRetry();blockedVoice=null;stopPrime();
    queue=[];const old=playing;playing=null;if(old||tones.size)quietUntil=now()+250;if(timer!==null){w.clearTimeout(timer);timer=null;}
    if(old?.utterance)try{w.speechSynthesis.cancel();}catch{}
    for(const node of tones){try{node.stop();}catch{}try{node.disconnect();}catch{}}tones.clear();
  }
  function retireOrigins(){for(const k of origins.keys()){if(retired.size>=256){unsafeOrigins=true;break;}retired.add(k);}origins.clear();}
  function reset(){recetaFirma=null;avisoFirmaPendiente=null;anOps.clear();anHigh=0;voiceBlocked=false;voicePrepared=false;clearDxPending();dxEvents=new WeakSet();dxReleaseUntil=0;stopAudio();armed=false;manualMute=false;unlocked=false;items=[];seen.clear();origins.clear();retired.clear();unsafeOrigins=false;starting=null;closing=null;generation++;context='';epoch=null;prefs=defaults();owner='';sessionToken='';paint();}
  function sync(){
    if(!active)return false;const i=identity();
    if(!i||i.id!==owner||i.token!==sessionToken){reset();active=false;return false;}
    const c=current();if(c.id!==context||c.epoch!==epoch){recetaFirma=null;avisoFirmaPendiente=null;anOps.clear();stopAudio();if(anJobs>0)unsafeOrigins=true;retireOrigins();context=c.id;epoch=c.epoch;generation++;}
    return true;
  }
  function ticket(){return {generation,context,epoch,at:now()};}
  function valid(t){return !!t&&sync()&&t.generation===generation&&t.context===context&&t.epoch===epoch&&now()-t.at>=0&&now()-t.at<=300000;}
  function enabled(){return active&&!manualMute&&prefs.mode!=='silencio'&&prefs.volume>0;}
  function refreshAudioUI(){try{audioUI?.();}catch{}}
  function arm(){if(!sync()||!focused()||!enabled())return false;armed=true;unlocked=true;try{const C=w.AudioContext||w.webkitAudioContext;if(C){ac=ac||new C();if(ac.state==='suspended')ac.resume().catch(()=>{});}}catch{}refreshAudioUI();return true;}
  function resumeAudio(){if(role!=='main'||!unlocked||!enabled()||!focused()||!sync())return;armed=true;refreshAudioUI();}
  function chooseVoice(){const v=localVoices();return v.find(x=>x.voiceURI===prefs.voice)||v.find(x=>/^es[-_]EC$/i.test(x.lang))||v.find(x=>/^es[-_](MX|CO|US|PE|AR|CL)$/i.test(x.lang))||v[0];}
  function stopPrime(){if(!prime)return;const p=prime;prime=null;w.clearTimeout(p.timer);try{w.speechSynthesis.cancel();}catch{}}
  function prepareVoice(){
    if(voicePrepared||prime||playing||queue.length||mic.size||!focused()||!enabled()||!['voz','ambos'].includes(prefs.mode))return;
    try{const v=chooseVoice();if(!v||!w.SpeechSynthesisUtterance||w.speechSynthesis.speaking||w.speechSynthesis.pending)return;
      const u=new w.SpeechSynthesisUtterance('a'),p={timer:null};prime=p;u.voice=v;u.lang=v.lang;u.volume=0;u.rate=prefs.rate;
      const end=ok=>{if(prime!==p)return;prime=null;w.clearTimeout(p.timer);voicePrepared=ok;if(ok)voiceBlocked=false;else if(!playing)voiceBlocked=true;w.setTimeout(pump,0);};
      u.onend=()=>end(true);u.onerror=()=>end(false);p.timer=w.setTimeout(()=>{if(prime!==p)return;stopPrime();voicePrepared=false;w.setTimeout(pump,0);},800);w.speechSynthesis.speak(u);
    }catch{stopPrime();}
  }
  function gestureAudio(e){
    if(role!=='main'||!e.isTrusted||!enabled()||mic.size||e.target?.closest?.('[data-auro-nv-sound],#auroBtnCerrarSesion,#auroBtnCerrarSesionMobile,.auro-dictado-btn'))return;
    if(!armed||voiceBlocked){if(!arm())return;}
    if(blockedVoice&&!playing&&!prime&&!queue.length&&now()>=quietUntil){const q=blockedVoice;blockedVoice=null;if(audible(q)&&(!q.rc6Extra||dxAllowed(q.mod))){q.retried=true;playing=q;speak(q,prefs.mode==='voz');return;}}
    // Click/tecla real (no pointerdown táctil): la síntesis debe recibir el gesto directo.
    if(e.type==='click'||e.type==='keydown')prepareVoice();
    entregarAvisoFirma();
  }
  function audible(q){return valid(q.ticket)&&armed&&focused()&&!mic.size&&prefs.mode!=='silencio'&&prefs.volume>0&&now()-q.at<=5000&&(q.mod==='prueba'||prefs.modules[q.mod]?.audio);}
  function chime(){
    if(!ac||ac.state!=='running')return false;
    try{const t=ac.currentTime;[660,880].forEach((f,i)=>{const o=ac.createOscillator(),g=ac.createGain(),a=t+i*.16;o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0,a);g.gain.linearRampToValueAtTime(.10*prefs.volume/100,a+.02);g.gain.exponentialRampToValueAtTime(.0001,a+.14);o.connect(g);g.connect(ac.destination);tones.add(o);o.onended=()=>{tones.delete(o);try{o.disconnect();g.disconnect();}catch{}};o.start(a);o.stop(a+.15);});return true;}catch{return false;}
  }
  function finish(q){if(playing!==q)return;if(q.utterance||tones.size)quietUntil=now()+250;if(timer!==null)w.clearTimeout(timer);timer=null;playing=null;w.setTimeout(pump,0);}
  function fallback(q){if(playing!==q)return;if(audible(q)&&chime()){if(timer!==null)w.clearTimeout(timer);timer=w.setTimeout(()=>finish(q),340);}else finish(q);}
  function speak(q,fallBack){
    if(playing!==q||!audible(q)){finish(q);return;}
    try{const voice=chooseVoice();
      if(!voice||!w.SpeechSynthesisUtterance||w.speechSynthesis.speaking||w.speechSynthesis.pending){if(fallBack)fallback(q);else finish(q);return;}
      const u=new w.SpeechSynthesisUtterance(q.text);u.voice=voice;u.lang=voice.lang;u.volume=prefs.volume/100;u.rate=prefs.rate;q.utterance=u;
      u.onend=()=>{if(playing===q){voicePrepared=true;voiceBlocked=false;}finish(q);};u.onerror=e=>{if(playing!==q)return;
        if(e?.error==='not-allowed'||e?.error==='NotAllowedError'){
          finish(q);voicePrepared=false;voiceBlocked=true;armed=false;unlocked=false;
          if(!q.retried&&q.mod!=='prueba')blockedVoice=q;
          refreshAudioUI();return;
        }if(fallBack)fallback(q);else finish(q);
      };
      timer=w.setTimeout(()=>{if(playing!==q)return;try{w.speechSynthesis.cancel();}catch{}finish(q);},12000);
      w.speechSynthesis.speak(u);
    }catch{if(fallBack)fallback(q);else finish(q);}
  }
  function pump(){
    if(playing||prime)return;
    if(dxReleaseUntil>now()&&queue.length){w.setTimeout(pump,Math.max(0,dxReleaseUntil-now()));return;}
    const q=queue.shift();if(!q)return;if((q.rc6Extra&&!dxAllowed(q.mod))||!audible(q)){w.setTimeout(pump,0);return;}playing=q;
    if(prefs.mode==='timbre'){chime();timer=w.setTimeout(()=>finish(q),340);}
    else if(prefs.mode==='ambos'){chime();timer=w.setTimeout(()=>{timer=null;speak(q,false);},400);}
    else speak(q,true);
  }
  function publish(mod,msg,key,operationValidated=false){
    if(!sync()||!ready.has(mod)||!messages[msg]||!key||(!operationValidated&&(seen.has(key)||seen.size>=1024)))return false;
    if(!operationValidated)seen.add(key);const text=messages[msg];
    if(prefs.visual&&prefs.modules[mod].visual){items.unshift({text,mod,at:now(),read:false});if(items.length>80){const rx=items.map(i=>i.mod==='recetas').lastIndexOf(true);const dx=rx>=0?rx:items.map(i=>extraModules.has(i.mod)).lastIndexOf(true);if(dx>=0)items.splice(dx,1);else items=items.slice(0,80);}paint();}
    if(prefs.mode!=='silencio'&&prefs.modules[mod].audio&&armed&&focused()&&!mic.size&&queue.length<8){blockedVoice=null;preemptDxAudio();queue.push({text,mod,ticket:ticket(),at:now()});w.setTimeout(pump,0);}
    return true;
  }
  function anOperation(x,kind){
    if(role!=='main'||!sync()||!context||x.id_atencion!==context)return;
    const k=x.id_operacion_nv,pac=clean(x.id_paciente),hist=clean(x.id_historia);
    if(!Number.isSafeInteger(k)||k<=0||!pac||!hist)return;
    if(kind==='begin'){if(k<=anHigh)return;anHigh=k;for(const [id,t] of anOps){if(now()-t.at>300000)anOps.delete(id);}if(anOps.size<32)anOps.set(k,{...ticket(),pac,hist});return;}
    const t=anOps.get(k);if(!valid(t)||t.pac!==pac||t.hist!==hist)return;
    if(kind==='confirmed'&&!clean(x.actualizado_en))return;
    anOps.delete(k);publish('anamnesis',kind==='confirmed'?'anamnesis':'pendiente','ana-op:'+generation+':'+k,true);
  }
  function anInput(x,kind){
    if(Object.prototype.hasOwnProperty.call(x,'id_operacion_nv')){anOperation(x,kind);return;}
    if(role!=='main'||!sync()||!context||x.id_atencion!==context||unsafeOrigins)return;
    if(anJobs>=16){unsafeOrigins=true;retireOrigins();return;}
    const sig=clean(x.firma),att=clean(x.id_atencion);if(!sig||sig.length>100000||!w.crypto?.subtle||typeof w.TextEncoder!=='function')return;
    const t=ticket(), data={id_atencion:att,id_paciente:clean(x.id_paciente),id_historia:clean(x.id_historia),actualizado_en:clean(x.actualizado_en)};
    // La firma interna de Anamnesis incluye contenido clínico. Solo se conserva
    // su SHA-256 en memoria; nunca se vuelca ese contenido al historial ni al almacenamiento.
    let digest;try{digest=w.crypto.subtle.digest('SHA-256',new w.TextEncoder().encode(sig));}catch{return;}
    digest=digest.catch(()=>null);anJobs++;anChain=anChain.then(async()=>{try{const b=await digest;if(!b){if(valid(t)){unsafeOrigins=true;retireOrigins();}return;}if(!valid(t)||unsafeOrigins)return;const k=att+'|'+Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');if(kind==='begin')anBegin(data,k,t);else anEnd(data,k,kind==='confirmed');}catch{}finally{anJobs--;}}).catch(()=>{});
  }
  function anBegin(x,k,t){if(!valid(t)||!context||x.id_atencion!==context||unsafeOrigins||retired.has(k))return;if(origins.has(k)){origins.delete(k);if(retired.size<256)retired.add(k);else unsafeOrigins=true;return;}if(origins.size>=32){retireOrigins();unsafeOrigins=true;return;}origins.set(k,{...t,pac:clean(x.id_paciente),hist:clean(x.id_historia)});}
  function anEnd(x,k,confirmed){if(!sync()||unsafeOrigins)return;const t=origins.get(k);if(!valid(t)||!t.pac||!t.hist||t.pac!==clean(x.id_paciente)||t.hist!==clean(x.id_historia))return;
    if(confirmed&&!clean(x.actualizado_en))return;origins.delete(k);if(retired.size<256)retired.add(k);else unsafeOrigins=true;
    // No guardar firma clínica ni contenido en historial, almacenamiento o voz.
    publish('anamnesis',confirmed?'anamnesis':'pendiente','ana:'+t.at+':'+t.generation+':'+(++serial));
  }
  let serial=0;
  function startBegin(x){if(role!=='main'||!sync())return;starting={...ticket(),patient:clean(x.id_paciente),transition:null};}
  function closeBegin(x){if(role!=='main'||!sync()||!context||x.id_atencion!==context)return;closing={...ticket(),patient:clean(x.id_paciente),transition:null};}
  function transition(x){
    if(!active)return;const oldStart=starting,oldClose=closing,oldGeneration=generation;
    const oldId=context,oldEpoch=epoch;if(!sync())return;
    starting=null;closing=null;
    if(oldStart&&oldStart.generation===oldGeneration&&oldStart.context===oldId&&oldStart.epoch===oldEpoch&&now()-oldStart.at<=300000&&x.motivo==='atencion_creada'&&clean(x.id_atencion_anterior)===oldId&&clean(x.id_atencion_nueva)&&x.id_paciente===oldStart.patient&&x.contexto_epoch===epoch){starting={...oldStart,transition:{id:x.id_atencion_nueva,epoch,generation}};}
    if(oldClose&&oldClose.generation===oldGeneration&&oldClose.context===oldId&&oldClose.epoch===oldEpoch&&now()-oldClose.at<=300000&&x.motivo==='atencion_finalizada'&&x.id_atencion_anterior===oldId&&!clean(x.id_atencion_nueva)&&x.id_paciente===oldClose.patient&&x.contexto_epoch===epoch){closing={...oldClose,transition:{id:oldId,epoch,generation}};}
  }
  function startEnd(x){const t=starting;starting=null;if(!sync()||!t?.transition)return;const z=t.transition;if(x.id_atencion===context&&z.id===context&&x.id_paciente===t.patient&&x.contexto_epoch===epoch&&z.epoch===epoch&&generation===z.generation+1&&clean(x.estado_atencion).toLowerCase()==='abierta'&&now()-t.at<=300000)publish('atenciones','inicio','inicio:'+context);}
  function closeEnd(x){const t=closing;closing=null;if(!sync()||!t?.transition)return;const z=t.transition;if(!context&&x.confirmado===true&&x.estado==='Finalizada'&&x.id_atencion===z.id&&x.id_paciente===t.patient&&z.epoch===epoch&&z.generation===generation&&now()-t.at<=300000)publish('atenciones','cierre','cierre:'+z.id);}
  function safe(fn){return function(e){try{fn(e?.detail||{});}catch{/* Un observador jamás interrumpe el módulo propietario. */}};}
  const listeners={'atencion-iniciando':startBegin,'atencion-limpiada':transition,'atencion-iniciada':startEnd,'atencion-finalizando':closeBegin,'atencion-finalizada':closeEnd,'atencion-inicio-fin':()=>{starting=null;},'atencion-finalizacion-fin':()=>{closing=null;},'anamnesis-sincronizando':x=>anInput(x,'begin'),'anamnesis-confirmada':x=>anInput(x,'confirmed'),'anamnesis-sincronizacion-pendiente':x=>anInput(x,'pending')};
  function micBefore(r){
    // Nunca liberar por el temporizador visual de dictado. El mismo objeto r termina el bloqueo.
    stopPrime();
    const busy=!!playing||tones.size>0||(active&&armed&&prefs.mode!=='silencio'&&(!!w.speechSynthesis?.speaking||!!w.speechSynthesis?.pending));
    stopAudio();if(busy||now()<quietUntil)return false;mic.add(r);return true;
  }
  function micEnd(r){mic.delete(r);entregarAvisoFirma();}
  function configure(raw){if(!sync())return false;stopAudio();prefs=normalized(raw);if(!enabled())armed=false;else resumeAudio();const ok=save();paint();refreshAudioUI();return ok;}
  function testAudio(){if(!arm()||mic.size||queue.length>=8)return false;stopPrime();queue.push({mod:'prueba',text:messages.prueba,ticket:ticket(),at:now()});pump();return true;}
  function suspend(){stopAudio();armed=false;refreshAudioUI();}
  function deactivate(){reset();active=false;refreshAudioUI();}
  function paint(){
    if(!ui)return;
    try{
      const {buttons,list,summary,readAll,clearAll,confirm}=ui,unread=items.filter(x=>!x.read).length;
      for(const {bell,count} of buttons){count.textContent=String(unread);count.hidden=!unread;bell.setAttribute('aria-label','Notificaciones: '+unread+' sin leer');}
      summary.textContent=unread+' sin leer · '+items.length+' avisos';readAll.disabled=!unread;clearAll.disabled=!items.length;
      if(!items.length)confirm.hidden=true;
      const previous=d.activeElement,focusedRow=previous?.closest?.('.auro-nv-row'),idx=focusedRow?Array.from(list.children).indexOf(focusedRow):-1;
      list.replaceChildren();
      for(const item of items){
        const row=el('div','','auro-nv-row'+(item.read?'':' auro-nv-unread')),mark=el('span','','auro-nv-mark'),body=el('div','','auro-nv-copy');
        mark.append(nvIcon(item.mod==='anamnesis'?'clipboard':'check'));
        body.append(el('strong',modules[item.mod]||'Aviso'),el('span',item.text),el('small',new Date(item.at).toLocaleTimeString('es-EC')));
        const del=button('',()=>{if(!sync())return;items=items.filter(x=>x!==item);paint();});del.classList.add('auro-nv-icon','auro-nv-trash');del.setAttribute('aria-label','Eliminar aviso de '+(modules[item.mod]||'notificación')+' a las '+new Date(item.at).toLocaleTimeString('es-EC'));del.title='Eliminar aviso';del.append(nvIcon('trash'));
        row.append(mark,body,del);list.append(row);
      }
      if(!items.length)list.append(el('div','No hay avisos en esta sesión.','auro-nv-empty'));
      if(idx>=0&&ui.dialog.open)(list.children[Math.min(idx,items.length-1)]?.querySelector('button')||ui.close).focus({preventScroll:true});
    }catch{/* El centro visual no puede interrumpir el motor. */}
  }
  function el(tag,text,cls){const x=d.createElement(tag);if(text)x.textContent=text;if(cls)x.className=cls;return x;}
  function button(text,fn){const b=el('button',text,'auro-nv-btn');b.type='button';b.addEventListener('click',e=>{e.preventDefault();try{fn();}catch{}});return b;}
  function styles(){if(d.getElementById('auro-nv-css'))return;const s=el('style');s.id='auro-nv-css';s.textContent='.auro-nv-btn{border:1px solid #ead5e0;background:#fff;color:#78194e;border-radius:10px;padding:8px 12px;font:inherit;cursor:pointer}.auro-nv-panel{padding:16px;color:inherit;max-width:760px}.auro-nv-panel label{display:block;margin:8px 0}.auro-nv-panel select,.auro-nv-panel input[type=range]{max-width:100%;width:100%}.auro-nv-panel fieldset{margin:12px 0;padding:10px;border:1px solid #ead5e0;border-radius:8px}.auro-nv-panel small{display:block;margin:6px 0;color:#666}.auro-nv-dialog{max-width:min(94vw,520px);max-height:80vh;overflow:auto;border:1px solid #ead5e0;border-radius:12px;padding:16px}.auro-nv-dialog p{border-bottom:1px solid #eee;padding:8px}.auro-nv-count{font-size:.8em;margin-left:4px}.auro-nv-controls{display:flex;gap:4px;flex-wrap:wrap;align-items:center}.auro-nv-controls .auro-nv-btn{font-size:13px;line-height:1.2;padding:6px;white-space:nowrap}';d.head.append(s);}
  function configUI(host){
    const panel=el('div','','auro-nv-panel'),head=el('h4','Notificaciones y voz');panel.append(head,el('small','Preferencias de este usuario y navegador. Los avisos clínicos no contienen nombres ni datos médicos.'));
    function select(label,options,value){const l=el('label',label),s=el('select');for(const [v,t] of options){const o=el('option',t);o.value=v;s.append(o);}s.value=value;l.append(s);panel.append(l);return s;}
    function range(label,min,max,step,value){const l=el('label',label+' · '+value),r=el('input');r.type='range';r.min=min;r.max=max;r.step=step;r.value=value;r.addEventListener('input',()=>{l.firstChild.nodeValue=label+' · '+r.value;});l.append(r);panel.append(l);return r;}
    function check(label,on,parent,disabled=false){const l=el('label'),c=el('input');c.type='checkbox';c.checked=on;c.disabled=disabled;l.append(c,d.createTextNode(' '+label));parent.append(l);return c;}
    const mode=select('Modo de audio',[['silencio','Silencio'],['timbre','Solo timbre'],['voz','Solo voz'],['ambos','Timbre + voz']],prefs.mode);
    const vol=range('Volumen',0,100,1,prefs.volume),rate=range('Velocidad',.8,1.2,.05,prefs.rate);
    const voices=localVoices(),voice=select('Voz local en español',[['','Automática'],...voices.map(v=>[v.voiceURI,v.name+' ('+v.lang+')'])],prefs.voice);if(!voice.value)voice.value='';
    const visual=check('Mostrar centro de avisos visuales',prefs.visual,panel),fields={};
    for(const [k,title] of Object.entries(modules)){const f=el('fieldset'),legend=el('legend',title);f.append(legend);fields[k]={visual:check('Aviso visual',prefs.modules[k].visual,f,!ready.has(k)),audio:check('Audio',prefs.modules[k].audio,f,!ready.has(k))};if(!ready.has(k))f.append(el('small','Pendiente de validar el origen de la operación. No activo.'));panel.append(f);}
    const status=el('p');status.setAttribute('role','status');const get=()=>({rc6Diagnosticos:true,rc7Modulos:true,rc8Recetas:true,firmaRecetaV1:true,mode:mode.value,volume:Number(vol.value),rate:Number(rate.value),voice:voice.value,visual:visual.checked,modules:Object.fromEntries(Object.entries(fields).map(([k,c])=>[k,{visual:c.visual.checked,audio:c.audio.checked}]))});
    panel.append(button('Guardar preferencias',()=>{status.textContent=configure(get())?'Preferencias guardadas en este navegador.':'No fue posible persistir las preferencias.';}),button('Guardar y probar sonido',()=>{const ok=configure(get()),played=testAudio();status.textContent=(ok?'Preferencias guardadas. ':'Preferencias no persistidas. ')+(played?'Prueba solicitada.':'Audio no disponible o silenciado.');}),status);
    if(!voices.length)panel.append(el('small','No se detectó una voz local en español. Si está disponible, se utilizará el timbre.'));
    host.replaceChildren(panel);
  }
  function nvIcon(name){
    const paths={bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',sound:'M11 5 6 9H3v6h3l5 4V5M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12',mute:'M11 5 6 9H3v6h3l5 4V5M16 9l5 6M21 9l-5 6',trash:'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5',close:'M6 6l12 12M18 6 6 18',check:'m5 12 4 4L19 6',clipboard:'M9 4H6v17h12V4h-3M9 3h6v4H9zM9 14l2 2 4-5'};
    const ns='http://www.w3.org/2000/svg',svg=d.createElementNS(ns,'svg'),p=d.createElementNS(ns,'path');
    for(const [k,v] of Object.entries({viewBox:'0 0 24 24',width:'20',height:'20',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(k,v);
    p.setAttribute('d',paths[name]);svg.append(p);return svg;
  }
  function nvMainStyles(){
    if(d.getElementById('auro-nv-main-css'))return;const s=el('style');s.id='auro-nv-main-css';s.textContent=`
    .auro-nv-controls{gap:6px;flex-wrap:nowrap}.auro-nv-controls .auro-nv-icon,.auro-nv-dialog .auro-nv-icon{display:inline-flex;align-items:center;justify-content:center;position:relative;width:36px;height:36px;padding:0;flex:none;border:1px solid #eadde5;border-radius:9px;background:#fff;color:#87365f;cursor:pointer}.auro-nv-controls .auro-nv-icon:hover,.auro-nv-dialog .auro-nv-icon:hover{background:#f7edf3}.auro-nv-controls .auro-nv-count{position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;padding:0 3px;margin:0;display:grid;place-items:center;box-sizing:border-box;border:1px solid white;border-radius:10px;background:#87365f;color:#fff;font-size:10px;font-weight:700}.auro-nv-controls .auro-nv-count[hidden],.auro-nv-dialog [hidden]{display:none!important}.auro-nv-controls [aria-pressed=false]{color:#77717a}
    .auro-nv-dialog{box-sizing:border-box;width:min(460px,calc(100% - 24px));max-width:none;max-height:calc(100dvh - 24px);padding:0;margin:auto;border:1px solid #eadde5;border-radius:16px;background:#fff;color:#312632;box-shadow:0 14px 48px #33203126;overflow:auto}.auro-nv-dialog::backdrop{background:#30243055}.auro-nv-dialog .auro-nv-head{display:flex;gap:12px;align-items:center;padding:18px 18px 14px;border-bottom:1px solid #f0e6ec}.auro-nv-dialog .auro-nv-head h4{margin:0;color:#87365f;font-size:18px;font-weight:700;line-height:1.3}.auro-nv-dialog .auro-nv-head small,.auro-nv-dialog .auro-nv-note{font-size:12px;color:#746875}.auro-nv-dialog .auro-nv-head .auro-nv-copy{flex:1}.auro-nv-dialog .auro-nv-summary{margin:12px 18px 6px;font-size:12px;font-weight:600;color:#746875}.auro-nv-dialog .auro-nv-list{padding:0 14px;max-height: min(42vh,340px);overflow:auto}.auro-nv-dialog .auro-nv-row{display:flex;align-items:center;gap:10px;padding:11px 9px;margin:6px 0;border:1px solid #eee6eb;border-radius:10px;background:#fff}.auro-nv-dialog .auro-nv-unread{background:#faf5f8;border-left:3px solid #87365f}.auro-nv-dialog .auro-nv-mark{display:grid;place-items:center;width:34px;height:34px;flex:none;border-radius:9px;background:#f3e8ef;color:#87365f}.auro-nv-dialog .auro-nv-copy{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;overflow-wrap:anywhere}.auro-nv-dialog .auro-nv-copy strong{font-size:13px}.auro-nv-dialog .auro-nv-copy span{font-size:13px;line-height:1.4}.auro-nv-dialog .auro-nv-copy small{font-size:11px;color:#746875}.auro-nv-dialog .auro-nv-trash{color:#796572;border-color:transparent;background:transparent}.auro-nv-dialog .auro-nv-trash:hover{color:#a22e43;background:#fdf0f1}.auro-nv-dialog .auro-nv-empty{padding:24px 8px;text-align:center;color:#746875;font-size:13px}.auro-nv-dialog .auro-nv-actions{display:flex;gap:8px;flex-wrap:wrap;padding:14px 18px 8px}.auro-nv-dialog .auro-nv-actions button,.auro-nv-dialog .auro-nv-confirm button{display:inline-flex;align-items:center;justify-content:center;gap:5px;font-size:12px;min-height:36px}.auro-nv-dialog .auro-nv-actions button:disabled{opacity:.45;cursor:default}.auro-nv-dialog .auro-nv-danger{color:#a22e43}.auro-nv-dialog .auro-nv-close{flex:1 0 100%;background:#87365f;color:white;border-color:#87365f}.auro-nv-dialog .auro-nv-note{display:block;text-align:center;padding:0 12px 14px}.auro-nv-dialog .auro-nv-confirm{margin:8px 18px;padding:12px;background:#fff7f7;border:1px solid #f0d5db;border-radius:9px;font-size:13px}.auro-nv-dialog .auro-nv-confirm .auro-nv-actions{padding:8px 0 0}.auro-nv-dialog button:focus-visible,.auro-nv-controls button:focus-visible{outline:2px solid #87365f;outline-offset:2px}
    `;d.head.append(s);
  }
  function mainUI(hosts){
    nvMainStyles();const dialog=el('dialog','','auro-nv-dialog'),list=el('div','','auro-nv-list'),buttons=[],summary=el('div','','auro-nv-summary');let snapshot=null;
    dialog.setAttribute('aria-labelledby','auro-nv-title');
    function updateSound(){for(const {sound} of buttons){const on=enabled();sound.replaceChildren(nvIcon(on?'sound':'mute'));sound.setAttribute('aria-label',on&&armed?'Silenciar audio de esta pestaña':'Activar audio de esta pestaña');sound.setAttribute('aria-pressed',String(on));sound.title=on?(armed?'Audio activo · pulsar para silenciar':'Audio habilitado · se activa al interactuar'):(prefs.mode==='silencio'||!prefs.volume?'Audio desactivado en preferencias':'Activar audio');}}
    audioUI=updateSound;
    for(const host of hosts.filter(Boolean)){
      const bar=el('div','','auro-nv-controls'),count=el('span','0','auro-nv-count');
      const bell=button('',()=>{if(!sync())return;paint();if(typeof dialog.showModal==='function'&&!dialog.open)dialog.showModal();});bell.classList.add('auro-nv-icon');bell.title='Notificaciones';bell.append(nvIcon('bell'),count);
      const sound=button('',()=>{if(!sync())return;if(prefs.mode==='silencio'||!prefs.volume){updateSound();return;}if(enabled()&&armed){manualMute=true;suspend();}else{manualMute=false;if(arm())prepareVoice();}updateSound();});sound.classList.add('auro-nv-icon');sound.setAttribute('data-auro-nv-sound','1');
      bar.append(bell,sound);host.replaceChildren(bar);buttons.push({bell,count,sound});
    }
    const head=el('div','','auro-nv-head'),mark=el('span','','auro-nv-mark'),title=el('div','','auro-nv-copy'),h=el('h4','Notificaciones');h.id='auro-nv-title';mark.append(nvIcon('bell'));title.append(h,el('small','Centro de avisos · AUROSANAX'));
    const x=button('',()=>dialog.close());x.classList.add('auro-nv-icon');x.setAttribute('aria-label','Cerrar ventana');x.append(nvIcon('close'));head.append(mark,title,x);
    const confirm=el('div','','auro-nv-confirm');confirm.hidden=true;const question=el('div','¿Eliminar todos los avisos actuales? No se eliminan registros médicos ni se modifica el audio.');const confirmActions=el('div','','auro-nv-actions');
    function dismiss(){snapshot=null;confirm.hidden=true;}
    const yes=button('Sí, eliminar',()=>{if(!sync()){dismiss();return;}const selected=snapshot;dismiss();if(selected)items=items.filter(i=>!selected.has(i));paint();close.focus({preventScroll:true});});yes.classList.add('auro-nv-danger');
    const no=button('Cancelar',()=>{dismiss();clearAll.focus({preventScroll:true});});confirmActions.append(yes,no);confirm.append(question,confirmActions);
    const readAll=button('Marcar como leídas',()=>{if(!sync())return;items.forEach(x=>x.read=true);paint();});
    const clearAll=button('Eliminar todas',()=>{if(!sync()||!items.length)return;snapshot=new Set(items);confirm.hidden=false;no.focus({preventScroll:true});});clearAll.classList.add('auro-nv-danger');
    const close=button('Cerrar',()=>dialog.close());close.classList.add('auro-nv-close');const actions=el('div','','auro-nv-actions');actions.append(readAll,clearAll,close);
    dialog.addEventListener('close',dismiss);dialog.append(head,summary,list,confirm,actions,el('small','Avisos temporales de esta sesión.','auro-nv-note'));d.body.append(dialog);ui={buttons,list,summary,readAll,clearAll,confirm,dialog,close};paint();updateSound();
    w.addEventListener('blur',updateSound);d.addEventListener('visibilitychange',updateSound);
  }
  function activate(which,hosts){
    try{if(active)return true;role=which==='config'?'config':'main';const i=identity();if(!i)return false;owner=i.id;sessionToken=i.token;prefs=load();active=true;const c=current();context=c.id;epoch=c.epoch;styles();
      if(role==='config'&&hosts?.panel)configUI(hosts.panel);
      if(role==='main'&&hosts?.headers)mainUI(hosts.headers);
      return true;}catch{deactivate();return false;}
  }
  for(const [name,fn] of Object.entries(listeners))w.addEventListener(E+name,safe(fn));
  // La identidad opaca pertenece a una sola operación efectiva.
  let recetaFirma=null, avisoFirmaPendiente=null;
  function contextoFirmaVigente(origen){
    return !!origen&&sync()&&origen.generation===generation&&origen.context===context&&origen.epoch===epoch;
  }
  function entregarAvisoFirma(){
    const aviso=avisoFirmaPendiente;
    if(!aviso)return;
    if(!contextoFirmaVigente(aviso.origen)||now()-aviso.at>120000){
      avisoFirmaPendiente=null;
      return;
    }
    if(!focused())return;
    if(enabled()&&prefs.modules.firma.audio&&(!armed||mic.size))return;
    avisoFirmaPendiente=null;
    publish('firma','firma','firma-receta:'+aviso.id);
  }
  w.addEventListener(E+'firma-receta-aviso',safe(x=>{
    if(role!=='main'||!x||typeof x.operacion!=='object'||!x.operacion||!sync())return;
    if(!context||x.id_atencion!==context)return;
    if(x.fase==='inicio'){
      recetaFirma={...ticket(),operacion:x.operacion};
      return;
    }
    const origen=recetaFirma,id=clean(x.id_solicitud);
    if(x.fase!=='confirmada'||!id||x.operacion!==origen?.operacion||!contextoFirmaVigente(origen))return;
    recetaFirma=null;
    if(seen.has('firma-receta:'+id))return;
    avisoFirmaPendiente={origen,id,at:now()};
    w.setTimeout(entregarAvisoFirma,0);
  }));
  // RC6 — Diagnósticos: evento propietario tras POST y lectura comparada.
  // No se escucha el clic ni el estado del botón. No se consulta ni modifica la base.
  function clearDxPending(){
    if(dxTimer!==null){w.clearTimeout(dxTimer);dxTimer=null;}
    dxPending.clear();
  }
  function preemptDxAudio(){
    if(playing?.rc6Extra){
      // Por contrato RC6 solo entra con cola vacía. No borrar avisos de RC4.
      const legacyQueue=queue.filter(q=>!q.rc6Extra);
      stopAudio();queue=legacyQueue;
      // Breve margen para que el navegador libere la síntesis cancelada.
      dxReleaseUntil=now()+250;
    }else if(queue[0]?.rc6Extra){queue=queue.filter(q=>!q.rc6Extra);}
  }
  function dxAllowed(mod){
    const opt=prefs.modules[mod];
    if(role!=='main'||!active||(!extraModules.has(mod)&&mod!=='recetas')||!opt||(!opt.audio&&(!prefs.visual||!opt.visual)))return false;
    const i=identity();if(!i||i.id!==owner||i.token!==sessionToken)return false;
    const sec=w.AUROSANAX_SEGURIDAD,u=sec?.obtenerUsuario?.();
    return !!u&&sec.tienePermiso('historia_clinica',u)===true;
  }
  function dxVisual(mod,text){
    if(!prefs.visual||!prefs.modules[mod].visual)return;
    // El límite de 80 sigue intacto; los nuevos avisos no expulsan avisos de RC4.
    const extra=items.filter(i=>extraModules.has(i.mod)).length;
    if(extra<20&&items.length>=80){const rx=items.map(i=>i.mod==='recetas').lastIndexOf(true);if(rx>=0)items.splice(rx,1);}
    if(extra>=20||items.length>=80){
      const index=items.map(i=>extraModules.has(i.mod)).lastIndexOf(true);
      if(index<0)return;
      items.splice(index,1);
    }
    items.unshift({text,mod,at:now(),read:false});paint();
  }
  function cancelDxRetry(){if(dxRetryTimer!==null){w.clearTimeout(dxRetryTimer);dxRetryTimer=null;}}
  function retryDxAudio(q){
    if(!valid(q.ticket)||!dxAllowed('diagnosticos')||!enabled()||!armed||!focused()||mic.size||starting||closing||!prefs.modules.diagnosticos.audio||now()-q.at>=5000)return;
    if(playing||prime||queue.length||anJobs||anOps.size||tones.size||now()<quietUntil){
      dxRetryTimer=w.setTimeout(()=>{dxRetryTimer=null;retryDxAudio(q);},100);return;
    }
    queue.push(q);w.setTimeout(pump,0);
  }
  function flushDx(){
    const pending=[...dxPending.values()].sort((a,b)=>Number(a.mod==='recetas')-Number(b.mod==='recetas'));dxPending.clear();dxTimer=null;
    for(const x of pending)try{
      if(!dxAllowed(x.mod)||x.owner!==owner||x.token!==sessionToken||starting||closing)continue;
      const c=current();if(c.id!==x.id||c.epoch!==x.epoch||now()-x.at>5000)continue;
      const text=x.mod==='recetas'?recetaMessages[x.estado]:x.mod==='examen'?'Examen físico guardado correctamente.':'Diagnóstico guardado y confirmado.';
      if(!text)continue;
      if(x.mod==='recetas'){
        // La ampliación no expulsa avisos anteriores de otros módulos.
        if(prefs.visual&&prefs.modules.recetas.visual&&items.length<80&&items.filter(i=>i.mod==='recetas').length<10){
          items.unshift({text,mod:x.mod,at:now(),read:false});paint();
        }
      }else dxVisual(x.mod,text);
      // Los avisos de nueva cobertura son subordinados a Atenciones y Anamnesis.
      // Los avisos existentes de RC7 tienen prioridad sobre Recetas.
      const priorizarRC7=x.mod!=='recetas'&&(playing?.mod==='recetas'||(!playing&&queue[0]?.mod==='recetas'))&&prefs.modules[x.mod].audio&&enabled()&&armed&&focused()&&!mic.size&&!anJobs&&!anOps.size;
      if(priorizarRC7)preemptDxAudio();
      if(x.mod==='diagnosticos'&&prefs.modules[x.mod].audio&&enabled()&&armed&&focused()&&!mic.size&&(playing||queue.length||anJobs||anOps.size||tones.size||(!priorizarRC7&&now()<quietUntil))){
        if(c.id!==context||c.epoch!==epoch)continue;
        cancelDxRetry();retryDxAudio({text,mod:x.mod,ticket:ticket(),at:x.at,rc6Extra:true});continue;
      }
      if(!prefs.modules[x.mod].audio||!enabled()||!armed||!focused()||mic.size||playing||queue.length||anJobs||anOps.size||tones.size||(!priorizarRC7&&now()<quietUntil))continue;
      if(c.id!==context||c.epoch!==epoch){if(!sync()||context!==c.id||epoch!==c.epoch)continue;}
      if(!dxAllowed(x.mod))continue;
      queue.push({text,mod:x.mod,ticket:ticket(),at:now(),rc6Extra:true});w.setTimeout(pump,0);
    }catch{}
  }
  function onExtraConfirmed(e,mod){
    try{
      if(e.target!==d||dxEvents.has(e)||!dxAllowed(mod)||starting||closing)return;
      const x=e.detail,c=current();
      if(!x||x.sin_cambios!==false||!clean(x.id_atencion)||c.id!==x.id_atencion||c.epoch===null)return;
      if(mod==='examen'&&(x.confirmado!==true||x.contexto_epoch!==c.epoch))return;
      if(mod==='diagnosticos')cancelDxRetry();
      dxEvents.add(e);dxPending.set(mod,{mod,id:c.id,epoch:c.epoch,owner,token:sessionToken,at:now()});
      if(dxTimer===null)dxTimer=w.setTimeout(flushDx,0);
    }catch{}
  }
  d.addEventListener(E+'receta-resultado-guardado',e=>{
    try{
      if(e.target!==d||dxEvents.has(e)||!dxAllowed('recetas')||starting||closing)return;
      const x=e.detail,c=current();
      if(!x||!Object.prototype.hasOwnProperty.call(recetaMessages,x.estado)||!clean(x.id_atencion)||c.id!==x.id_atencion||c.epoch==null||x.contexto_epoch!==c.epoch)return;
      dxEvents.add(e);dxPending.set('recetas',{mod:'recetas',id:c.id,epoch:c.epoch,owner,token:sessionToken,estado:x.estado,at:now()});
      if(dxTimer===null)dxTimer=w.setTimeout(flushDx,0);
    }catch{}
  });
  d.addEventListener(E+'diagnostico-abierto-guardado',e=>onExtraConfirmed(e,'diagnosticos'));
  d.addEventListener(E+'examen-fisico-guardado',e=>onExtraConfirmed(e,'examen'));
  let cachedIdentity=null;
  w.addEventListener('blur',suspend);
  w.addEventListener('pagehide',e=>{
    cachedIdentity=e.persisted&&active?{role,owner,token:sessionToken}:null;
    deactivate();
  });
  w.addEventListener('pageshow',e=>{
    const saved=cachedIdentity;cachedIdentity=null;
    if(!e.persisted||!saved||active||role!==saved.role)return;
    const i=identity();
    if(i?.id!==saved.owner||i?.token!==saved.token)return;
    if(activate(saved.role)){paint();refreshAudioUI();}
  });
  w.addEventListener('focus',()=>{resumeAudio();entregarAvisoFirma();});
  d.addEventListener('visibilitychange',()=>{if(d.hidden)suspend();else{resumeAudio();entregarAvisoFirma();}});
  d.addEventListener('pointerdown',gestureAudio,true);d.addEventListener('keydown',gestureAudio,true);
  d.addEventListener('click',gestureAudio,true);
  w.addEventListener('storage',e=>{if(active&&e.key===PREFIX+owner){stopAudio();prefs=load();if(!enabled())armed=false;else resumeAudio();paint();refreshAudioUI();}});
  // El cierre de sesión conserva su propio procedimiento. Solo apagamos nuestro audio.
  d.addEventListener('click',e=>{if(e.target?.closest?.('#auroBtnCerrarSesion,#auroBtnCerrarSesionMobile,#cfgCerrarSesion'))deactivate();},true);
  return Object.freeze({activate,deactivate,micBefore,micEnd,configure,testAudio,inspect:()=>({active,mode:prefs.mode,items:items.map(i=>({text:i.text,mod:i.mod,read:i.read})),queued:queue.length,mic:mic.size,armed,enabled:enabled(),unlocked,manualMute,focused:focused(),version:'RC8-R1 + Voz firma de receta V2',voicePrepared,voiceBlocked})});
});

