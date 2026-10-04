/*
======================================================================
AUROSANAX — guia.js
MOTOR DE GUÍA CONTEXTUAL / ASISTENTE AUROSANAX
Versión inicial: Fase 1 · motor visual aislado
======================================================================

CONTRATO ANTIRREGRESIVO
- Presentación y capacitación únicamente.
- NO guarda datos clínicos.
- NO crea pacientes, historias, citas ni atenciones.
- NO modifica id_paciente, id_historia, id_cita ni id_atencion.
- NO realiza fetch, POST, consultas a Sheets ni llamadas de persistencia.
- NO firma, NO finaliza atenciones, NO dispara botones propietarios.
- NO reemplaza la lógica de Agenda, Pacientes, Historia, Atenciones o módulos clínicos.
- Si este archivo falla o no carga, el ERP debe continuar funcionando.
- Las ayudas ocupan espacio propio: no usan position:fixed ni superposición.
- Diseñado para ser liviano, responsive y utilizable por toque, mouse y teclado.
======================================================================
*/
(function auroGuiaBootstrap(window, document){
  'use strict';

  if(!window || !document) return;
  if(window.AurosanaxGuia && window.AurosanaxGuia.__auroGuiaMotor === true) return;

  const VERSION = '1.0.0-fase1';
  const ROOT_CLASS = 'auro-guia';
  const STYLE_ID = 'auroGuiaStyles';
  const mounts = new Map();

  function auroGuiaTexto(valor, fallback){
    const texto = String(valor == null ? '' : valor).trim();
    return texto || String(fallback || '').trim();
  }

  function auroGuiaTipo(valor){
    const tipo = String(valor || 'info').trim().toLowerCase();
    return ['info','ok','warning','neutral'].includes(tipo) ? tipo : 'info';
  }

  function auroGuiaNormalizar(config){
    const c = config && typeof config === 'object' ? config : {};
    return {
      tipo: auroGuiaTipo(c.tipo),
      titulo: auroGuiaTexto(c.titulo, 'Asistente AUROSANAX'),
      resumen: auroGuiaTexto(c.resumen, ''),
      detalle: auroGuiaTexto(c.detalle, ''),
      siguiente: auroGuiaTexto(c.siguiente, ''),
      expandible: c.expandible !== false,
      expandida: c.expandida === true,
      ocultable: c.ocultable !== false,
      etiquetaAbrir: auroGuiaTexto(c.etiquetaAbrir, 'Ver guía'),
      etiquetaCerrar: auroGuiaTexto(c.etiquetaCerrar, 'Ocultar guía')
    };
  }

  function auroGuiaInyectarEstilos(){
    if(document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${ROOT_CLASS}{
        --auro-guia-bg:#fff;
        --auro-guia-border:rgba(15,23,42,.12);
        --auro-guia-text:#172033;
        --auro-guia-muted:#5f6b7a;
        --auro-guia-accent:#a21caf;
        --auro-guia-accent-soft:rgba(162,28,175,.08);
        --auro-guia-ok:#16794b;
        --auro-guia-warning:#9a6700;
        box-sizing:border-box;
        width:100%;
        min-width:0;
        margin:.65rem 0;
        padding:.78rem .85rem;
        border:1px solid var(--auro-guia-border);
        border-radius:14px;
        background:var(--auro-guia-bg);
        color:var(--auro-guia-text);
        font:inherit;
        line-height:1.35;
        position:relative;
        overflow-wrap:anywhere;
        word-break:normal;
        contain:layout style;
      }
      .${ROOT_CLASS}, .${ROOT_CLASS} *{box-sizing:border-box}
      .${ROOT_CLASS}[hidden]{display:none!important}
      .${ROOT_CLASS}__head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:.65rem;
        min-width:0;
      }
      .${ROOT_CLASS}__copy{min-width:0;flex:1 1 auto}
      .${ROOT_CLASS}__eyebrow{
        display:flex;
        align-items:center;
        gap:.4rem;
        margin:0 0 .18rem;
        font-size:.78rem;
        font-weight:700;
        color:var(--auro-guia-muted);
      }
      .${ROOT_CLASS}__dot{
        width:.5rem;height:.5rem;border-radius:999px;
        flex:0 0 auto;background:var(--auro-guia-accent);
      }
      .${ROOT_CLASS}[data-tipo="ok"] .${ROOT_CLASS}__dot{background:var(--auro-guia-ok)}
      .${ROOT_CLASS}[data-tipo="warning"] .${ROOT_CLASS}__dot{background:var(--auro-guia-warning)}
      .${ROOT_CLASS}[data-tipo="neutral"] .${ROOT_CLASS}__dot{background:var(--auro-guia-muted)}
      .${ROOT_CLASS}__title{
        margin:0;
        font-size:.96rem;
        font-weight:750;
        line-height:1.25;
      }
      .${ROOT_CLASS}__summary{
        margin:.22rem 0 0;
        color:var(--auro-guia-muted);
        font-size:.9rem;
      }
      .${ROOT_CLASS}__next{
        margin:.55rem 0 0;
        padding:.5rem .62rem;
        border-radius:10px;
        background:var(--auro-guia-accent-soft);
        font-size:.88rem;
        font-weight:650;
      }
      .${ROOT_CLASS}__detail{
        margin:.6rem 0 0;
        padding-top:.6rem;
        border-top:1px solid var(--auro-guia-border);
        color:var(--auro-guia-muted);
        font-size:.88rem;
      }
      .${ROOT_CLASS}__actions{
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        gap:.4rem;
        margin-top:.58rem;
      }
      .${ROOT_CLASS}__button{
        appearance:none;
        border:1px solid var(--auro-guia-border);
        background:#fff;
        color:var(--auro-guia-text);
        min-height:38px;
        padding:.42rem .68rem;
        border-radius:9px;
        font:inherit;
        font-size:.84rem;
        font-weight:650;
        cursor:pointer;
        touch-action:manipulation;
      }
      .${ROOT_CLASS}__button:focus-visible{
        outline:3px solid rgba(162,28,175,.2);
        outline-offset:2px;
      }
      .${ROOT_CLASS}__button--quiet{color:var(--auro-guia-muted)}
      @media (max-width:480px){
        .${ROOT_CLASS}{
          margin:.55rem 0;
          padding:.72rem;
          border-radius:12px;
        }
        .${ROOT_CLASS}__head{gap:.45rem}
        .${ROOT_CLASS}__title{font-size:.94rem}
        .${ROOT_CLASS}__summary,
        .${ROOT_CLASS}__detail,
        .${ROOT_CLASS}__next{font-size:.87rem}
        .${ROOT_CLASS}__actions{
          display:grid;
          grid-template-columns:minmax(0,1fr);
        }
        .${ROOT_CLASS}__button{
          width:100%;
          min-height:44px;
          text-align:center;
        }
      }
      @media (prefers-reduced-motion:reduce){
        .${ROOT_CLASS}, .${ROOT_CLASS} *{
          scroll-behavior:auto!important;
          transition:none!important;
          animation:none!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function auroGuiaCrearNodo(id){
    const root = document.createElement('section');
    root.className = ROOT_CLASS;
    root.dataset.auroGuiaId = id;
    root.setAttribute('aria-label','Asistente AUROSANAX');

    const head = document.createElement('div');
    head.className = `${ROOT_CLASS}__head`;

    const copy = document.createElement('div');
    copy.className = `${ROOT_CLASS}__copy`;

    const eyebrow = document.createElement('div');
    eyebrow.className = `${ROOT_CLASS}__eyebrow`;

    const dot = document.createElement('span');
    dot.className = `${ROOT_CLASS}__dot`;
    dot.setAttribute('aria-hidden','true');

    const brand = document.createElement('span');
    brand.textContent = 'Asistente AUROSANAX';

    eyebrow.append(dot, brand);

    const title = document.createElement('h3');
    title.className = `${ROOT_CLASS}__title`;

    const summary = document.createElement('p');
    summary.className = `${ROOT_CLASS}__summary`;

    const next = document.createElement('div');
    next.className = `${ROOT_CLASS}__next`;

    const detail = document.createElement('div');
    detail.className = `${ROOT_CLASS}__detail`;

    const actions = document.createElement('div');
    actions.className = `${ROOT_CLASS}__actions`;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = `${ROOT_CLASS}__button`;
    toggle.setAttribute('aria-expanded','false');

    const hide = document.createElement('button');
    hide.type = 'button';
    hide.className = `${ROOT_CLASS}__button ${ROOT_CLASS}__button--quiet`;
    hide.textContent = 'Ocultar';

    actions.append(toggle, hide);
    copy.append(eyebrow, title, summary, next, detail, actions);
    head.append(copy);
    root.append(head);

    return {root,title,summary,next,detail,actions,toggle,hide};
  }

  function auroGuiaResolverContenedor(contenedor){
    if(typeof contenedor === 'string'){
      try{return document.querySelector(contenedor);}catch(_e){return null;}
    }
    return contenedor && contenedor.nodeType === 1 ? contenedor : null;
  }

  function auroGuiaPintar(registro){
    const c = registro.config;
    const n = registro.nodes;

    n.root.dataset.tipo = c.tipo;
    n.title.textContent = c.titulo;

    n.summary.textContent = c.resumen;
    n.summary.hidden = !c.resumen;

    n.next.textContent = c.siguiente ? `Siguiente paso: ${c.siguiente}` : '';
    n.next.hidden = !c.siguiente;

    n.detail.textContent = c.detalle;
    n.detail.hidden = !c.detalle || !registro.expandida;

    n.toggle.textContent = registro.expandida ? c.etiquetaCerrar : c.etiquetaAbrir;
    n.toggle.setAttribute('aria-expanded', registro.expandida ? 'true' : 'false');
    n.toggle.hidden = !c.expandible || !c.detalle;

    n.hide.hidden = !c.ocultable;

    const tieneAcciones = !n.toggle.hidden || !n.hide.hidden;
    n.actions.hidden = !tieneAcciones;
    n.root.hidden = registro.oculta === true;
  }

  function montar(id, contenedor, config){
    const clave = auroGuiaTexto(id, '');
    const destino = auroGuiaResolverContenedor(contenedor);
    if(!clave || !destino) return null;

    auroGuiaInyectarEstilos();

    let registro = mounts.get(clave);
    if(registro && registro.nodes.root && registro.nodes.root.isConnected){
      if(registro.nodes.root.parentElement !== destino){
        destino.appendChild(registro.nodes.root);
      }
      registro.config = auroGuiaNormalizar(config);
      registro.expandida = registro.config.expandida;
      registro.oculta = false;
      auroGuiaPintar(registro);
      return registro.nodes.root;
    }

    const nodes = auroGuiaCrearNodo(clave);
    registro = {
      id: clave,
      nodes,
      config: auroGuiaNormalizar(config),
      expandida: false,
      oculta: false
    };
    registro.expandida = registro.config.expandida;

    nodes.toggle.addEventListener('click', function(){
      registro.expandida = !registro.expandida;
      auroGuiaPintar(registro);
    });

    nodes.hide.addEventListener('click', function(){
      registro.oculta = true;
      auroGuiaPintar(registro);
    });

    destino.appendChild(nodes.root);
    mounts.set(clave, registro);
    auroGuiaPintar(registro);
    return nodes.root;
  }

  function actualizar(id, config){
    const registro = mounts.get(auroGuiaTexto(id, ''));
    if(!registro) return false;
    registro.config = auroGuiaNormalizar(Object.assign({}, registro.config, config || {}));
    registro.oculta = false;
    auroGuiaPintar(registro);
    return true;
  }

  function mostrar(id){
    const registro = mounts.get(auroGuiaTexto(id, ''));
    if(!registro) return false;
    registro.oculta = false;
    auroGuiaPintar(registro);
    return true;
  }

  function ocultar(id){
    const registro = mounts.get(auroGuiaTexto(id, ''));
    if(!registro) return false;
    registro.oculta = true;
    auroGuiaPintar(registro);
    return true;
  }

  function desmontar(id){
    const clave = auroGuiaTexto(id, '');
    const registro = mounts.get(clave);
    if(!registro) return false;
    if(registro.nodes.root && registro.nodes.root.parentNode){
      registro.nodes.root.parentNode.removeChild(registro.nodes.root);
    }
    mounts.delete(clave);
    return true;
  }

  window.AurosanaxGuia = Object.freeze({
    __auroGuiaMotor: true,
    version: VERSION,
    montar,
    actualizar,
    mostrar,
    ocultar,
    desmontar
  });

})(window, document);
