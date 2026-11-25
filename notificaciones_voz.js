/* AUROSANAX NOTIFICACIONES V1 RC2 — candidato integrado para pruebas controladas.
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
  // Firma y otros módulos se reservan: el evento por sí solo no vincula inequívocamente
  // el origen al inicio de cada solicitud. No se habilitan mediante preferencias antiguas.
  const ready=new Set(['atenciones','anamnesis']);
  const messages={inicio:'Atención iniciada y confirmada.',cierre:'Atención finalizada y confirmada.',anamnesis:'Anamnesis guardada y confirmada.',pendiente:'Atención: confirmación de guardado pendiente.',prueba:'Prueba de notificaciones de AUROSANAX.'};
  const clean=x=>typeof x==='string'?x.trim():'';
  const now=()=>Date.now();
  const limit=(x,a,b,f)=>typeof x==='number'&&Number.isFinite(x)?Math.min(b,Math.max(a,x)):f;
  const defaults=()=>({mode:'silencio',visual:true,volume:65,rate:1,voice:'',modules:Object.fromEntries(Object.keys(modules).map(k=>[k,{visual:ready.has(k),audio:ready.has(k)}]))});
  function normalized(raw){
    const p=defaults(); if(!raw||typeof raw!=='object')return p;
    if(['silencio','timbre','voz','ambos'].includes(raw.mode))p.mode=raw.mode;
    if(typeof raw.visual==='boolean')p.visual=raw.visual;
    p.volume=limit(raw.volume,0,100,p.volume);p.rate=limit(raw.rate,.8,1.2,p.rate);
    p.voice=clean(raw.voice).slice(0,160);
    for(const k of ready)for(const c of ['visual','audio'])if(typeof raw.modules?.[k]?.[c]==='boolean')p.modules[k][c]=raw.modules[k][c];
    return p;
  }
  let role='',active=false,owner='',sessionToken='',prefs=defaults(),items=[],seen=new Set(),origins=new Map(),retired=new Set();
  let generation=0,context='',epoch=null,starting=null,closing=null,queue=[],playing=null,armed=false,ac=null,tones=new Set(),mic=new Set(),timer=null,ui=null;
  let unsafeOrigins=false, anChain=Promise.resolve(), anJobs=0, quietUntil=0;
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
    queue=[];const old=playing;playing=null;if(old||tones.size)quietUntil=now()+250;if(timer!==null){w.clearTimeout(timer);timer=null;}
    if(old?.utterance)try{w.speechSynthesis.cancel();}catch{}
    for(const node of tones){try{node.stop();}catch{}try{node.disconnect();}catch{}}tones.clear();
  }
  function retireOrigins(){for(const k of origins.keys()){if(retired.size>=256){unsafeOrigins=true;break;}retired.add(k);}origins.clear();}
  function reset(){stopAudio();armed=false;items=[];seen.clear();origins.clear();retired.clear();unsafeOrigins=false;starting=null;closing=null;generation++;context='';epoch=null;prefs=defaults();owner='';sessionToken='';paint();}
  function sync(){
    if(!active)return false;const i=identity();
    if(!i||i.id!==owner||i.token!==sessionToken){reset();active=false;return false;}
    const c=current();if(c.id!==context||c.epoch!==epoch){stopAudio();if(anJobs>0)unsafeOrigins=true;retireOrigins();context=c.id;epoch=c.epoch;generation++;}
    return true;
  }
  function ticket(){return {generation,context,epoch,at:now()};}
  function valid(t){return !!t&&sync()&&t.generation===generation&&t.context===context&&t.epoch===epoch&&now()-t.at>=0&&now()-t.at<=300000;}
  function arm(){if(!sync()||!focused())return false;armed=true;try{const C=w.AudioContext||w.webkitAudioContext;if(C){ac=ac||new C();if(ac.state==='suspended')ac.resume().catch(()=>{});}}catch{}return true;}
  function audible(q){return valid(q.ticket)&&armed&&focused()&&!mic.size&&prefs.mode!=='silencio'&&prefs.volume>0&&now()-q.at<=5000&&(q.mod==='prueba'||prefs.modules[q.mod]?.audio);}
  function chime(){
    if(!ac||ac.state!=='running')return false;
    try{const t=ac.currentTime;[660,880].forEach((f,i)=>{const o=ac.createOscillator(),g=ac.createGain(),a=t+i*.16;o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0,a);g.gain.linearRampToValueAtTime(.10*prefs.volume/100,a+.02);g.gain.exponentialRampToValueAtTime(.0001,a+.14);o.connect(g);g.connect(ac.destination);tones.add(o);o.onended=()=>{tones.delete(o);try{o.disconnect();g.disconnect();}catch{}};o.start(a);o.stop(a+.15);});return true;}catch{return false;}
  }
  function finish(q){if(playing!==q)return;if(q.utterance||tones.size)quietUntil=now()+250;if(timer!==null)w.clearTimeout(timer);timer=null;playing=null;w.setTimeout(pump,0);}
  function fallback(q){if(playing!==q)return;if(audible(q)&&chime()){if(timer!==null)w.clearTimeout(timer);timer=w.setTimeout(()=>finish(q),340);}else finish(q);}
  function speak(q,fallBack){
    if(playing!==q||!audible(q)){finish(q);return;}
    try{const v=localVoices(),voice=v.find(x=>x.voiceURI===prefs.voice)||v.find(x=>/^es[-_]EC$/i.test(x.lang))||v.find(x=>/^es[-_](MX|CO|US|PE|AR|CL)$/i.test(x.lang))||v[0];
      if(!voice||!w.SpeechSynthesisUtterance||w.speechSynthesis.speaking||w.speechSynthesis.pending){if(fallBack)fallback(q);else finish(q);return;}
      const u=new w.SpeechSynthesisUtterance(q.text);u.voice=voice;u.lang=voice.lang;u.volume=prefs.volume/100;u.rate=prefs.rate;q.utterance=u;
      u.onend=()=>finish(q);u.onerror=()=>{if(fallBack)fallback(q);else finish(q);};
      timer=w.setTimeout(()=>{if(playing!==q)return;try{w.speechSynthesis.cancel();}catch{}finish(q);},12000);
      w.speechSynthesis.speak(u);
    }catch{if(fallBack)fallback(q);else finish(q);}
  }
  function pump(){
    if(playing)return;const q=queue.shift();if(!q)return;if(!audible(q)){w.setTimeout(pump,0);return;}playing=q;
    if(prefs.mode==='timbre'){chime();timer=w.setTimeout(()=>finish(q),340);}
    else if(prefs.mode==='ambos'){chime();timer=w.setTimeout(()=>{timer=null;speak(q,false);},400);}
    else speak(q,true);
  }
  function publish(mod,msg,key){
    if(!sync()||!ready.has(mod)||!messages[msg]||!key||seen.has(key)||seen.size>=1024)return false;
    seen.add(key);const text=messages[msg];
    if(prefs.visual&&prefs.modules[mod].visual){items.unshift({text,mod,at:now(),read:false});items=items.slice(0,80);paint();}
    if(prefs.mode!=='silencio'&&prefs.modules[mod].audio&&armed&&focused()&&!mic.size&&queue.length<8){queue.push({text,mod,ticket:ticket(),at:now()});w.setTimeout(pump,0);}
    return true;
  }
  function anInput(x,kind){
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
    const busy=!!playing||tones.size>0||(active&&armed&&prefs.mode!=='silencio'&&(!!w.speechSynthesis?.speaking||!!w.speechSynthesis?.pending));
    stopAudio();if(busy||now()<quietUntil)return false;mic.add(r);return true;
  }
  function micEnd(r){mic.delete(r);}
  function configure(raw){if(!sync())return false;stopAudio();prefs=normalized(raw);const ok=save();paint();return ok;}
  function testAudio(){if(!arm()||mic.size||prefs.mode==='silencio'||!prefs.volume||queue.length>=8)return false;queue.push({mod:'prueba',text:messages.prueba,ticket:ticket(),at:now()});w.setTimeout(pump,0);return true;}
  function suspend(){stopAudio();armed=false;}
  function deactivate(){reset();active=false;}
  function paint(){if(!ui)return;const {buttons,list}=ui;for(const {bell,count} of buttons){count.textContent=String(items.filter(x=>!x.read).length);bell.setAttribute('aria-label','Notificaciones: '+items.filter(x=>!x.read).length+' sin leer');}if(list){list.replaceChildren();for(const i of items){const p=d.createElement('p');p.textContent=i.text+' · '+new Date(i.at).toLocaleTimeString('es-EC');list.append(p);}if(!items.length)list.textContent='Sin avisos de esta sesión.';}}
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
    const status=el('p');status.setAttribute('role','status');const get=()=>({mode:mode.value,volume:Number(vol.value),rate:Number(rate.value),voice:voice.value,visual:visual.checked,modules:Object.fromEntries(Object.entries(fields).map(([k,c])=>[k,{visual:c.visual.checked,audio:c.audio.checked}]))});
    panel.append(button('Guardar preferencias',()=>{status.textContent=configure(get())?'Preferencias guardadas en este navegador.':'No fue posible persistir las preferencias.';}),button('Guardar y probar sonido',()=>{const ok=configure(get()),played=testAudio();status.textContent=(ok?'Preferencias guardadas. ':'Preferencias no persistidas. ')+(played?'Prueba solicitada.':'Audio no disponible o silenciado.');}),status);
    if(!voices.length)panel.append(el('small','No se detectó una voz local en español. Si está disponible, se utilizará el timbre.'));
    host.replaceChildren(panel);
  }
  function mainUI(hosts){
    const dialog=el('dialog','','auro-nv-dialog'),list=el('div'),buttons=[];
    function updateSound(){for(const {sound} of buttons){sound.textContent=armed?'🔊':'🔇';sound.setAttribute('aria-label',armed?'Silenciar audio de esta pestaña':'Activar audio de esta pestaña');}}
    for(const host of hosts.filter(Boolean)){
      const bar=el('div','','auro-nv-controls'),count=el('span','0','auro-nv-count');
      const bell=button('🔔',()=>{if(!sync())return;paint();if(typeof dialog.showModal==='function'&&!dialog.open)dialog.showModal();});bell.append(count);
      const sound=button('🔇',()=>{if(!sync())return;if(armed)suspend();else arm();updateSound();});
      bar.append(bell,sound);host.replaceChildren(bar);buttons.push({bell,count,sound});
    }
    dialog.append(el('h4','Notificaciones'),list,button('Marcar como leídas',()=>{if(!sync())return;items.forEach(x=>x.read=true);paint();}),button('Cerrar',()=>dialog.close()));d.body.append(dialog);ui={buttons,list};paint();updateSound();
    w.addEventListener('blur',updateSound);d.addEventListener('visibilitychange',updateSound);
  }
  function activate(which,hosts){
    try{if(active)return true;role=which==='config'?'config':'main';const i=identity();if(!i)return false;owner=i.id;sessionToken=i.token;prefs=load();active=true;const c=current();context=c.id;epoch=c.epoch;styles();
      if(role==='config'&&hosts?.panel)configUI(hosts.panel);
      if(role==='main'&&hosts?.headers)mainUI(hosts.headers);
      return true;}catch{deactivate();return false;}
  }
  for(const [name,fn] of Object.entries(listeners))w.addEventListener(E+name,safe(fn));
  w.addEventListener('blur',suspend);w.addEventListener('pagehide',deactivate);
  d.addEventListener('visibilitychange',()=>{if(d.hidden)suspend();});
  w.addEventListener('storage',e=>{if(active&&e.key===PREFIX+owner){stopAudio();prefs=load();paint();}});
  // El cierre de sesión conserva su propio procedimiento. Solo apagamos nuestro audio.
  d.addEventListener('click',e=>{if(e.target?.closest?.('#auroBtnCerrarSesion,#auroBtnCerrarSesionMobile,#cfgCerrarSesion'))deactivate();},true);
  return Object.freeze({activate,deactivate,micBefore,micEnd,configure,testAudio,inspect:()=>({active,mode:prefs.mode,items:items.map(i=>({text:i.text,mod:i.mod,read:i.read})),queued:queue.length,mic:mic.size,armed})});
});
