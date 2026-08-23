/**
 * ============================================================
 * ASISTENTE COMERCIAL
 * Archivo: asistente_comercial.js
 * Versión: 1.2.1
 * Tipo: Motor independiente / reutilizable
 * ============================================================
 *
 * DEPENDENCIA ÚNICA:
 * - asistente_comercial_config.js
 *
 * OBJETIVO:
 * - Detectar intención por palabras clave.
 * - Sugerir plantillas.
 * - Permitir búsqueda, selección, edición y copia.
 * - Resolver placeholders.
 * - Mantener favoritos y contador de uso de forma LOCAL.
 * - Cargar plantillas persistentes desde Apps Script cuando esté disponible.
 * - Mantener las plantillas locales como fallback seguro.
 * - No guardar mensajes pegados.
 *
 * SEGURIDAD / ANTIRREGRESIÓN:
 * - No depende de módulos clínicos del ERP.
 * - No modifica pacientes, historia, atenciones, agenda, caja o seguridad.
 * - Solo hace una carga GET inicial y escrituras explícitas de plantillas.
 * - No usa polling.
 * - No usa setInterval.
 * - No crea listeners globales duplicados.
 * - Puede ejecutarse como página independiente.
 *
 * ============================================================
 */

(function (global, document) {
  "use strict";

  const CONFIG = global.ASISTENTE_COMERCIAL_CONFIG;

  if (!CONFIG) {
    console.error(
      "[Asistente Comercial] Falta ASISTENTE_COMERCIAL_CONFIG. " +
      "Cargue asistente_comercial_config.js antes de asistente_comercial.js."
    );
    return;
  }

  const STORAGE_KEYS = Object.freeze({
    favorites: "AC_FAVORITOS_V1",
    usage: "AC_USOS_V1",
    ui: "AC_UI_V1"
  });

  const state = {
    initialized: false,
    templates: [],
    activeTemplates: [],
    filteredTemplates: [],
    suggestions: [],
    selectedTemplateId: null,
    selectedCategory: "",
    selectedScope: CONFIG.behavior?.defaultScope || "PROSPECTO",
    searchText: "",
    pastedMessage: "",
    renderedResponse: "",
    favorites: new Set(),
    usage: {},
    listenersBound: false,
    categoryMode: "AUTO",
    inputTimer: null,
    analysisSeq: 0,
    backendLoaded: false,
    backendAvailable: false,
    backendTemplateIds: new Set(),
    libraryMode: "ALL",
    editingTemplateId: null,
    mobileMode: "RESPONDER"
  };

  const els = {};

  /* ==========================================================
   * UTILIDADES BASE
   * ========================================================== */

  function asString(value) {
    return value == null ? "" : String(value);
  }

  function safeJsonParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeRegExp(value) {
    return asString(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function normalizeText(value) {
    let text = asString(value);

    if (CONFIG.behavior?.trimInput !== false) {
      text = text.trim();
    }

    if (CONFIG.behavior?.caseInsensitive !== false) {
      text = text.toLowerCase();
    }

    if (CONFIG.behavior?.normalizeAccents !== false) {
      text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    return text.replace(/\s+/g, " ");
  }

  function unique(items) {
    return [...new Set(items)];
  }

  function sortByOrder(items) {
    return [...items].sort((a, b) => {
      const ao = Number(a?.order ?? 9999);
      const bo = Number(b?.order ?? 9999);
      return ao - bo;
    });
  }

  function getCategory(categoryId) {
    return (CONFIG.categories || []).find(c => c.id === categoryId) || null;
  }

  function getScope(scopeId) {
    return (CONFIG.scopes || []).find(s => s.id === scopeId) || null;
  }

  function getTemplate(templateId) {
    return state.templates.find(t => t.id === templateId) || null;
  }

  function isActiveTemplate(template) {
    return template && template.status === "ACTIVO";
  }

  function getTemplatePriority(template) {
    return Number(template?.meta?.priority ?? 0);
  }

  function getTemplateKeywords(template) {
    const fromTemplate = Array.isArray(template?.meta?.keywords)
      ? template.meta.keywords
      : [];
    const fromCategory = getCategory(template?.category)?.keywords || [];
    return unique([...fromTemplate, ...fromCategory].filter(Boolean));
  }

  function getUsage(templateId) {
    return Number(state.usage?.[templateId] || 0);
  }

  function isFavorite(templateId) {
    return state.favorites.has(templateId);
  }

  function safeLocalStorageGet(key, fallback) {
    try {
      const raw = global.localStorage?.getItem(key);
      if (!raw) return fallback;
      return safeJsonParse(raw, fallback);
    } catch (_) {
      return fallback;
    }
  }

  function safeLocalStorageSet(key, value) {
    try {
      global.localStorage?.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadLocalState() {
    const favorites = safeLocalStorageGet(STORAGE_KEYS.favorites, []);
    const usage = safeLocalStorageGet(STORAGE_KEYS.usage, {});

    state.favorites = new Set(Array.isArray(favorites) ? favorites : []);
    state.usage = usage && typeof usage === "object" ? usage : {};
  }

  function saveFavorites() {
    safeLocalStorageSet(STORAGE_KEYS.favorites, [...state.favorites]);
  }

  function saveUsage() {
    safeLocalStorageSet(STORAGE_KEYS.usage, state.usage);
  }

  /* ==========================================================
   * BACKEND AISLADO / PERSISTENCIA DE PLANTILLAS
   * ========================================================== */

  function resolveApiUrl() {
    const direct = asString(global.AC_API_URL || global.API_URL || global.APP_SCRIPT_URL).trim();
    if (direct) return direct;

    try {
      return asString(global.localStorage?.getItem("AUROSANAX_API_URL")).trim();
    } catch (_) {
      return "";
    }
  }

  async function apiGet(action, params) {
    const base = resolveApiUrl();
    if (!base) throw new Error("API del Asistente Comercial no configurada");

    const query = new URLSearchParams({ accion: action, t: Date.now() });
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) query.append(key, value);
    });

    const response = await fetch(base + "?" + query.toString(), { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    return await response.json();
  }

  async function apiPost(action, data) {
    const base = resolveApiUrl();
    if (!base) throw new Error("API del Asistente Comercial no configurada");

    const response = await fetch(base, {
      method: "POST",
      body: JSON.stringify({ accion: action, data: data || {} })
    });

    if (!response.ok) throw new Error("HTTP " + response.status);
    return await response.json();
  }

  function backendRecordToTemplate(row) {
    if (!row) return null;

    const meta = row.META && typeof row.META === "object"
      ? row.META
      : safeJsonParse(row.META_JSON || "{}", {});

    return {
      id: asString(row.ID),
      scope: asString(row.AMBITO || "PROSPECTO"),
      category: asString(row.CATEGORIA || "GENERAL"),
      title: asString(row.TITULO),
      response: asString(row.RESPUESTA),
      meta: meta && typeof meta === "object" ? meta : {},
      status: asString(row.ESTADO || "ACTIVO").toUpperCase(),
      createdAt: asString(row.FECHA_CREACION),
      updatedAt: asString(row.FECHA_ACTUALIZACION),
      source: "DB"
    };
  }

  function mergeBackendTemplates(rows) {
    const dbTemplates = (Array.isArray(rows) ? rows : [])
      .map(backendRecordToTemplate)
      .filter(Boolean)
      .filter(t => t.id && t.status === "ACTIVO");

    state.backendTemplateIds = new Set(dbTemplates.map(t => t.id));

    const local = (CONFIG.templates || []).map(t => ({ ...clone(t), source: "LOCAL" }));
    const byId = new Map();

    local.forEach(t => byId.set(t.id, t));
    dbTemplates.forEach(t => byId.set(t.id, t));

    loadTemplates([...byId.values()]);
    state.backendLoaded = true;
    state.backendAvailable = true;
    renderTemplateList();

    if (state.pastedMessage.length >= 3) {
      scheduleAnalysis(true);
    }

    return dbTemplates.length;
  }

  async function loadBackendTemplates() {
    try {
      const rows = await apiGet("AC_listarPlantillasActivas");
      mergeBackendTemplates(rows);
      return true;
    } catch (error) {
      state.backendLoaded = true;
      state.backendAvailable = false;
      console.warn("[Asistente Comercial] Backend no disponible; se conserva fallback local:", error);
      return false;
    }
  }

  /* ==========================================================
   * PLACEHOLDERS
   * ========================================================== */

  function buildPlaceholderContext(extraContext) {
    const business = CONFIG.business || {};
    const runtime = CONFIG.runtimeDefaults || {};

    return {
      nombre: "",
      fecha: "",
      hora: "",
      medico: "",
      servicio: "",
      enlace: runtime.enlace || business.appointmentUrl || "",
      ubicacion: runtime.ubicacion || business.address || "",
      ...(extraContext || {})
    };
  }

  function renderPlaceholders(text, extraContext) {
    const context = buildPlaceholderContext(extraContext);
    let output = asString(text);

    Object.entries(context).forEach(([key, value]) => {
      const token = `{{${key}}}`;
      const regex = new RegExp(escapeRegExp(token), "g");
      output = output.replace(regex, asString(value));
    });

    if (CONFIG.placeholders?.unresolvedBehavior === "REMOVE") {
      output = output.replace(/\{\{[^{}]+\}\}/g, "");
    }

    return output.trim();
  }

  /* ==========================================================
   * DETECCIÓN Y PUNTUACIÓN
   * ========================================================== */

  function keywordScore(normalizedMessage, keyword) {
    const kw = normalizeText(keyword);

    if (!kw || kw.length < Number(CONFIG.behavior?.minKeywordLength || 2)) {
      return 0;
    }

    if (normalizedMessage === kw) return 100;

    if (normalizedMessage.includes(kw)) {
      const words = kw.split(" ").length;
      return 25 + Math.min(words * 8, 35);
    }

    const messageWords = normalizedMessage.split(" ");
    const keywordWords = kw.split(" ");
    const matched = keywordWords.filter(word => messageWords.includes(word)).length;

    if (!matched) return 0;

    const ratio = matched / keywordWords.length;
    return Math.round(ratio * 20);
  }

  function scoreTemplate(template, message) {
    const normalizedMessage = normalizeText(message);
    if (!normalizedMessage) return 0;

    let score = 0;

    const category = getCategory(template.category);
    const keywords = getTemplateKeywords(template);

    keywords.forEach(keyword => {
      score += keywordScore(normalizedMessage, keyword);
    });

    if (category?.label) {
      score += keywordScore(normalizedMessage, category.label) * 0.5;
    }

    if (template?.title) {
      score += keywordScore(normalizedMessage, template.title) * 0.5;
    }

    if (
      CONFIG.behavior?.preferExactCategory &&
      state.selectedCategory &&
      template.category === state.selectedCategory
    ) {
      score += 60;
    }

    score += getTemplatePriority(template) * 0.05;

    if (isFavorite(template.id)) {
      score += 2;
    }

    return Math.round(score * 100) / 100;
  }

  function detectCategory(message, scope) {
    const normalizedMessage = normalizeText(message);
    if (!normalizedMessage) {
      return { category: "", score: 0, matches: [] };
    }

    const enabledCategories = (CONFIG.categories || []).filter(c => c.enabled !== false);
    const results = enabledCategories.map(category => {
      let score = 0;

      (category.keywords || []).forEach(keyword => {
        score += keywordScore(normalizedMessage, keyword);
      });

      const matchingTemplates = state.activeTemplates.filter(template => {
        return (
          template.category === category.id &&
          (!scope || template.scope === scope)
        );
      });

      matchingTemplates.forEach(template => {
        score += scoreTemplate(template, normalizedMessage) * 0.35;
      });

      return {
        category: category.id,
        label: category.label,
        score: Math.round(score * 100) / 100
      };
    });

    results.sort((a, b) => b.score - a.score);

    const best = results[0] || { category: "", score: 0 };

    return {
      category: best.score > 0 ? best.category : "",
      score: best.score,
      matches: results.filter(r => r.score > 0)
    };
  }

  function suggestTemplates(message, options) {
    const opts = options || {};
    const scope = opts.scope || state.selectedScope;
    const category = opts.category ?? state.selectedCategory;
    const max = Number(opts.max || CONFIG.behavior?.maxSuggestions || 5);

    let candidates = state.activeTemplates.filter(template => {
      if (scope && template.scope !== scope) return false;
      if (category && template.category !== category) return false;
      return true;
    });

    const scored = candidates.map(template => ({
      template,
      score: scoreTemplate(template, message)
    }));

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      const priorityDiff =
        getTemplatePriority(b.template) - getTemplatePriority(a.template);
      if (priorityDiff !== 0) return priorityDiff;

      return getUsage(b.template.id) - getUsage(a.template.id);
    });

    const positive = scored.filter(item => item.score > 0);

    // Con mensaje recibido nunca se devuelve una plantilla arbitraria.
    // Esto evita que la primera plantilla (p. ej. Agendamiento) aparezca
    // cuando todavía no existe una coincidencia real.
    if (normalizeText(message)) {
      return positive.slice(0, max);
    }

    return scored.slice(0, max);
  }

  /* ==========================================================
   * FILTROS Y BÚSQUEDA
   * ========================================================== */

  function templateMatchesSearch(template, searchText) {
    const q = normalizeText(searchText);
    if (!q) return true;

    const haystack = normalizeText([
      template.id,
      template.scope,
      template.category,
      template.title,
      template.response,
      ...(template.meta?.tags || []),
      ...getTemplateKeywords(template)
    ].join(" "));

    return haystack.includes(q);
  }

  function filterTemplates(options) {
    const opts = options || {};

    const scope = opts.scope ?? state.selectedScope;
    const category = opts.category ?? state.selectedCategory;
    const search = opts.search ?? state.searchText;
    const onlyFavorites = Boolean(opts.onlyFavorites);
    const mostUsed = Boolean(opts.mostUsed);

    let result = state.activeTemplates.filter(template => {
      if (scope && template.scope !== scope) return false;
      if (category && template.category !== category) return false;
      if (onlyFavorites && !isFavorite(template.id)) return false;
      if (!templateMatchesSearch(template, search)) return false;
      return true;
    });

    if (mostUsed) {
      result.sort((a, b) => getUsage(b.id) - getUsage(a.id));
    } else {
      result.sort((a, b) => {
        const fav = Number(isFavorite(b.id)) - Number(isFavorite(a.id));
        if (fav !== 0) return fav;

        const priority =
          getTemplatePriority(b) - getTemplatePriority(a);
        if (priority !== 0) return priority;

        return asString(a.title).localeCompare(asString(b.title), "es");
      });
    }

    state.filteredTemplates = result;
    return result;
  }

  /* ==========================================================
   * SELECCIÓN / RESPUESTA
   * ========================================================== */

  function selectTemplate(templateId, extraContext) {
    const template = getTemplate(templateId);
    if (!template || !isActiveTemplate(template)) {
      return null;
    }

    state.selectedTemplateId = template.id;
    state.selectedCategory = template.category || state.selectedCategory;
    state.renderedResponse = renderPlaceholders(template.response, extraContext);

    syncSelectedTemplateUI();
    syncCategoryUI();
    setResponseValue(state.renderedResponse);
    renderTemplateList();
    updateQuickSheet(template);

    return clone(template);
  }

  function clearSelection() {
    state.selectedTemplateId = null;
    state.renderedResponse = "";
    setResponseValue("");
    syncSelectedTemplateUI();
    renderTemplateList();
    closeQuickSheet();
  }

  function setCategory(categoryId, options) {
    const opts = options || {};
    const valid =
      !categoryId ||
      (CONFIG.categories || []).some(c => c.id === categoryId && c.enabled !== false);

    if (!valid) return false;

    state.selectedCategory = categoryId || "";
    state.categoryMode = opts.autoDetected ? "AUTO" : (categoryId ? "MANUAL" : "AUTO");

    if (!opts.keepTemplate) {
      state.selectedTemplateId = null;
    }

    syncCategoryUI();

    if (!opts.skipRender) {
      renderTemplateList();
    }

    if (
      opts.autoSuggest !== false &&
      state.pastedMessage
    ) {
      runSuggestionFlow({ category: state.selectedCategory });
    }

    return true;
  }

  function setScope(scopeId) {
    const scope = getScope(scopeId);
    if (!scope || scope.enabled === false) return false;

    state.selectedScope = scopeId;
    state.selectedTemplateId = null;
    state.selectedCategory = "";
    state.categoryMode = "AUTO";

    renderScopeControls();
    renderCategoryControls();
    renderTemplateList();

    if (state.pastedMessage) {
      runSuggestionFlow();
    }

    return true;
  }

  /* ==========================================================
   * FAVORITOS Y USO
   * ========================================================== */

  function toggleFavorite(templateId) {
    const template = getTemplate(templateId);
    if (!template) return false;

    if (state.favorites.has(templateId)) {
      state.favorites.delete(templateId);
    } else {
      state.favorites.add(templateId);
    }

    saveFavorites();
    renderTemplateList();
    return state.favorites.has(templateId);
  }

  function registerUsage(templateId) {
    if (!templateId) return;

    state.usage[templateId] = getUsage(templateId) + 1;
    saveUsage();
  }

  /* ==========================================================
   * PORTAPAPELES
   * ========================================================== */

  async function copyResponse() {
    const text = getResponseValue().trim();

    if (!text) {
      showToast(
        CONFIG.ui?.emptyMessage || "No hay respuesta para copiar.",
        "warning"
      );
      return false;
    }

    try {
      if (global.navigator?.clipboard?.writeText) {
        await global.navigator.clipboard.writeText(text);
      } else {
        fallbackCopy(text);
      }

      if (state.selectedTemplateId) {
        registerUsage(state.selectedTemplateId);
      }

      showToast(CONFIG.ui?.copySuccessMessage || "Respuesta copiada.", "success");

      if (CONFIG.behavior?.clearInputAfterCopy) {
        clearAll();
      }

      return true;
    } catch (error) {
      console.warn("[Asistente Comercial] Error al copiar:", error);

      try {
        fallbackCopy(text);
        if (state.selectedTemplateId) {
          registerUsage(state.selectedTemplateId);
        }
        showToast(CONFIG.ui?.copySuccessMessage || "Respuesta copiada.", "success");
        return true;
      } catch (_) {
        showToast(
          CONFIG.ui?.copyErrorMessage ||
          "No se pudo copiar automáticamente.",
          "danger"
        );
        return false;
      }
    }
  }

  function fallbackCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.select();

    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);

    if (!ok) {
      throw new Error("document.execCommand('copy') devolvió false");
    }
  }

  /* ==========================================================
   * FLUJO PRINCIPAL
   * ========================================================== */

  function runSuggestionFlow(options) {
    const opts = options || {};
    const message = opts.message ?? getMessageValue();
    const normalized = normalizeText(message);

    state.pastedMessage = asString(message);

    if (!normalized) {
      state.suggestions = [];
      clearSelection();
      if (state.categoryMode === "AUTO") state.selectedCategory = "";
      syncCategoryUI();
      renderSuggestions();
      showStatus(CONFIG.ui?.emptyMessage || "", "neutral");
      return [];
    }

    if (normalized.length < 3) {
      state.suggestions = [];
      clearSelection();
      if (state.categoryMode === "AUTO") state.selectedCategory = "";
      syncCategoryUI();
      renderSuggestions();
      showStatus("Escribe al menos 3 caracteres para analizar.", "neutral");
      return [];
    }

    // En modo automático SIEMPRE se recalcula desde cero.
    // Nunca reutiliza la categoría de un mensaje anterior.
    if (state.categoryMode === "AUTO") {
      state.selectedCategory = "";
      const detected = detectCategory(state.pastedMessage, state.selectedScope);
      if (detected.category && detected.score > 0) {
        state.selectedCategory = detected.category;
      }
      syncCategoryUI();
    }

    const effectiveCategory = state.categoryMode === "MANUAL"
      ? state.selectedCategory
      : state.selectedCategory;

    const suggestions = suggestTemplates(state.pastedMessage, {
      scope: state.selectedScope,
      category: effectiveCategory,
      max: CONFIG.behavior?.maxSuggestions || 5
    });

    state.suggestions = suggestions;
    renderSuggestions();

    if (suggestions.length) {
      selectTemplate(suggestions[0].template.id, opts.context);
      showStatus(
        "Respuesta encontrada" +
        (state.selectedCategory ? " · " + (getCategory(state.selectedCategory)?.label || state.selectedCategory) : ""),
        "success"
      );
    } else {
      clearSelection();
      if (state.categoryMode === "AUTO") {
        state.selectedCategory = "";
        syncCategoryUI();
      }
      showStatus(
        CONFIG.ui?.noMatchMessage || "No encontré una coincidencia clara.",
        "warning"
      );
    }

    return suggestions.map(item => ({
      template: clone(item.template),
      score: item.score
    }));
  }

  function clearAll() {
    state.pastedMessage = "";
    state.searchText = "";
    state.suggestions = [];
    state.selectedTemplateId = null;
    state.selectedCategory = "";
    state.categoryMode = "AUTO";
    state.renderedResponse = "";
    if (state.inputTimer) {
      clearTimeout(state.inputTimer);
      state.inputTimer = null;
    }
    state.analysisSeq += 1;

    setMessageValue("");
    setSearchValue("");
    setResponseValue("");

    syncCategoryUI();
    renderSuggestions();
    renderTemplateList();
    showStatus(CONFIG.ui?.emptyMessage || "", "neutral");

    if (CONFIG.safety?.privacy?.persistPastedMessages === false) {
      // No se persiste contenido pegado.
    }
  }

  /* ==========================================================
   * CARGA DE PLANTILLAS
   * ========================================================== */

  function loadTemplates(source) {
    const templates = Array.isArray(source)
      ? source
      : Array.isArray(CONFIG.templates)
        ? CONFIG.templates
        : [];

    state.templates = clone(templates);
    state.activeTemplates = state.templates.filter(isActiveTemplate);
    state.filteredTemplates = [...state.activeTemplates];

    return state.activeTemplates.length;
  }

  function replaceTemplates(templates) {
    const count = loadTemplates(templates);
    renderTemplateList();

    if (state.pastedMessage) {
      runSuggestionFlow();
    }

    return count;
  }

  /* ==========================================================
   * DOM - CACHE
   * ========================================================== */

  function cacheElements() {
    const ids = {
      root: "acApp",
      message: "acMensaje",
      search: "acBuscarPlantilla",
      response: "acRespuesta",
      category: "acCategoria",
      scope: "acAmbito",
      templateList: "acPlantillas",
      suggestions: "acSugerencias",
      status: "acEstado",
      toast: "acToast",
      selectedTemplate: "acPlantillaSeleccionada",
      copyButton: "acCopiar",
      clearButton: "acLimpiar",
      favoritesButton: "acFavoritos",
      mostUsedButton: "acMasUsadas",
      categoriesContainer: "acCategorias",
      libraryCategoriesContainer: "acCategoriasBiblioteca",
      scopesContainer: "acAmbitos",
      analyzeButton: "acAnalizar",
      whatsappButton: "acWhatsApp",
      newTemplateButton: "acNuevaPlantilla",
      templateModal: "acTemplateModal",
      templateModalClose: "acTemplateModalClose",
      templateForm: "acTemplateForm",
      templateTitle: "acTplTitulo",
      templateCategory: "acTplCategoria",
      templateKeywords: "acTplKeywords",
      templateResponse: "acTplRespuesta",
      templateType: "acTplTipo",
      templateSave: "acTplGuardar",
      templateSaveText: "acTplGuardarTexto",
      templateCancel: "acTplCancelar",
      templateModalTitle: "acTplModalTitle",
      templateModalSubtitle: "acTplModalSubtitle",
      templatePreview: "acTplPreview",
      templatePreviewText: "acTplPreviewText",
      templatePreviewMeta: "acTplPreviewMeta",
      quickSheet: "acQuickSheet",
      quickTitle: "acQuickTitle",
      quickCategory: "acQuickCategory",
      quickResponse: "acQuickResponse",
      quickClose: "acQuickClose",
      quickCopy: "acQuickCopy",
      quickWhatsApp: "acQuickWhatsApp",
      modeResponder: "acModoResponder",
      modePlantillas: "acModoPlantillas",
      messageCard: "acMensajeCard",
      libraryCard: "acBibliotecaCard"
    };

    Object.entries(ids).forEach(([key, id]) => {
      els[key] = document.getElementById(id) || null;
    });
  }

  /* ==========================================================
   * DOM - GET/SET
   * ========================================================== */

  function getMessageValue() {
    return asString(els.message?.value);
  }

  function setMessageValue(value) {
    if (els.message) els.message.value = asString(value);
  }

  function getResponseValue() {
    return asString(els.response?.value);
  }

  function setResponseValue(value) {
    if (els.response) {
      els.response.value = asString(value);
      state.renderedResponse = asString(value);
    }
  }

  function setSearchValue(value) {
    if (els.search) els.search.value = asString(value);
  }

  function showStatus(message, type) {
    if (!els.status) return;

    els.status.textContent = asString(message);
    els.status.dataset.type = type || "neutral";
    els.status.hidden = !message;
  }

  function showToast(message, type) {
    if (!els.toast) {
      showStatus(message, type);
      return;
    }

    els.toast.textContent = asString(message);
    els.toast.dataset.type = type || "neutral";
    els.toast.classList.add("show");

    global.clearTimeout(showToast._timer);
    showToast._timer = global.setTimeout(() => {
      els.toast?.classList.remove("show");
    }, 2200);
  }

  /* ==========================================================
   * DOM - RENDER
   * ========================================================== */

  function renderScopeControls() {
    if (els.scope) {
      const current = state.selectedScope;
      els.scope.innerHTML = "";

      sortByOrder((CONFIG.scopes || []).filter(s => s.enabled !== false))
        .forEach(scope => {
          const option = document.createElement("option");
          option.value = scope.id;
          option.textContent = scope.label;
          option.selected = scope.id === current;
          els.scope.appendChild(option);
        });
    }

    if (els.scopesContainer) {
      els.scopesContainer.innerHTML = "";

      sortByOrder((CONFIG.scopes || []).filter(s => s.enabled !== false))
        .forEach(scope => {
          const button = document.createElement("button");
          button.type = "button";
          button.className =
            "ac-scope-chip" +
            (scope.id === state.selectedScope ? " active" : "");
          button.dataset.scope = scope.id;
          button.textContent = scope.label;
          els.scopesContainer.appendChild(button);
        });
    }
  }

  function renderCategoryControls() {
    const categories = sortByOrder(
      (CONFIG.categories || []).filter(c => c.enabled !== false)
    );

    if (els.category) {
      const current = state.selectedCategory;
      els.category.innerHTML = "";

      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "Todas las categorías";
      els.category.appendChild(defaultOption);

      categories.forEach(category => {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = category.label;
        option.selected = category.id === current;
        els.category.appendChild(option);
      });
    }

    function fillCategoryContainer(container, compact) {
      if (!container) return;
      container.innerHTML = "";

      const allButton = document.createElement("button");
      allButton.type = "button";
      allButton.className =
        (compact ? "ac-category-tile" : "ac-category-chip") +
        (!state.selectedCategory ? " active" : "");
      allButton.dataset.category = "";
      allButton.innerHTML =
        '<i class="bi bi-grid"></i><span>Todas</span>' +
        (compact ? '<small>Ver todo</small>' : '');
      container.appendChild(allButton);

      categories.forEach(category => {
        const button = document.createElement("button");
        button.type = "button";
        button.className =
          (compact ? "ac-category-tile" : "ac-category-chip") +
          (category.id === state.selectedCategory ? " active" : "");
        button.dataset.category = category.id;

        const icon = document.createElement("i");
        icon.className = `bi bi-${category.icon || "tag"}`;

        const label = document.createElement("span");
        label.textContent = category.label;

        button.append(icon, label);

        if (compact) {
          const count = document.createElement("small");
          count.textContent =
            state.activeTemplates.filter(t =>
              t.category === category.id &&
              (!state.selectedScope || t.scope === state.selectedScope)
            ).length + " plant.";
          button.appendChild(count);
        }

        container.appendChild(button);
      });
    }

    fillCategoryContainer(els.categoriesContainer, false);
    fillCategoryContainer(els.libraryCategoriesContainer, true);
  }

  function renderTemplateList(options) {
    if (!els.templateList) return;

    const opts = options || {};
    const templates = filterTemplates(opts);

    els.templateList.innerHTML = "";

    if (!templates.length) {
      const empty = document.createElement("div");
      empty.className = "ac-empty";
      empty.textContent = "No hay plantillas para este filtro.";
      els.templateList.appendChild(empty);
      return;
    }

    templates.forEach(template => {
      els.templateList.appendChild(buildTemplateCard(template));
    });
  }

  function buildTemplateCard(template, suggestionScore) {
    const card = document.createElement("article");
    card.className =
      "ac-template-card" +
      (template.id === state.selectedTemplateId ? " active" : "");
    card.dataset.templateId = template.id;

    const top = document.createElement("div");
    top.className = "ac-template-top";

    const titleWrap = document.createElement("div");
    titleWrap.className = "ac-template-title-wrap";

    const title = document.createElement("strong");
    title.textContent = template.title || template.id;

    const meta = document.createElement("small");
    const category = getCategory(template.category);
    meta.textContent = category?.label || template.category || "";

    titleWrap.append(title, meta);

    const topActions = document.createElement("div");
    topActions.className = "ac-template-top-actions";

    const favorite = document.createElement("button");
    favorite.type = "button";
    favorite.className =
      "ac-favorite-btn" + (isFavorite(template.id) ? " active" : "");
    favorite.dataset.action = "favorite";
    favorite.dataset.templateId = template.id;
    favorite.setAttribute(
      "aria-label",
      isFavorite(template.id) ? "Quitar de favoritos" : "Agregar a favoritos"
    );
    favorite.innerHTML = isFavorite(template.id)
      ? '<i class="bi bi-star-fill"></i>'
      : '<i class="bi bi-star"></i>';

    topActions.appendChild(favorite);

    if (template.source === "DB") {
      const menu = document.createElement("button");
      menu.type = "button";
      menu.className = "ac-template-menu-btn";
      menu.dataset.action = "menu";
      menu.dataset.templateId = template.id;
      menu.setAttribute("aria-label", "Opciones de plantilla");
      menu.innerHTML = '<i class="bi bi-three-dots-vertical"></i>';
      topActions.appendChild(menu);
    }

    top.append(titleWrap, topActions);

    const preview = document.createElement("p");
    preview.className = "ac-template-preview";
    preview.textContent = renderPlaceholders(template.response);

    const bottom = document.createElement("div");
    bottom.className = "ac-template-bottom";

    const usage = document.createElement("span");
    usage.className = "ac-template-usage";
    usage.textContent = `${getUsage(template.id)} usos`;

    if (typeof suggestionScore === "number") {
      const score = document.createElement("span");
      score.className = "ac-template-score";
      score.textContent = `Coincidencia ${Math.round(suggestionScore)}`;
      bottom.append(score);
    } else {
      bottom.append(usage);
    }

    const useButton = document.createElement("button");
    useButton.type = "button";
    useButton.className = "ac-use-template-btn";
    useButton.dataset.action = "select";
    useButton.dataset.templateId = template.id;
    useButton.innerHTML =
      template.id === state.selectedTemplateId
        ? '<i class="bi bi-check2"></i> Lista'
        : '<i class="bi bi-lightning-charge"></i> Usar';

    bottom.append(useButton);
    card.append(top, preview, bottom);
    return card;
  }

  function renderSuggestions() {
    if (!els.suggestions) return;

    els.suggestions.innerHTML = "";

    if (!state.suggestions.length) {
      els.suggestions.hidden = true;
      return;
    }

    els.suggestions.hidden = false;

    state.suggestions.forEach(item => {
      els.suggestions.appendChild(
        buildTemplateCard(item.template, item.score)
      );
    });
  }

  function syncCategoryUI() {
    if (els.category) {
      els.category.value = state.selectedCategory || "";
    }

    if (els.categoriesContainer) {
      els.categoriesContainer
        .querySelectorAll("[data-category]")
        .forEach(button => {
          button.classList.toggle(
            "active",
            button.dataset.category === state.selectedCategory
          );
        });
    }
  }

  function syncSelectedTemplateUI() {
    if (!els.selectedTemplate) return;

    const template = getTemplate(state.selectedTemplateId);

    if (!template) {
      els.selectedTemplate.textContent = "";
      els.selectedTemplate.hidden = true;
      return;
    }

    els.selectedTemplate.hidden = false;
    els.selectedTemplate.textContent =
      `Plantilla: ${template.title || template.id}`;
  }

  function updateQuickSheet(template) {
    if (!els.quickSheet) return;

    if (!template) {
      els.quickSheet.hidden = true;
      return;
    }

    const category = getCategory(template.category);
    if (els.quickTitle) els.quickTitle.textContent = template.title || "Plantilla";
    if (els.quickCategory) {
      els.quickCategory.textContent = category?.label || template.category || "Plantilla";
    }
    if (els.quickResponse) {
      els.quickResponse.textContent = renderPlaceholders(template.response);
    }

    if (global.matchMedia?.("(max-width: 760px)")?.matches) {
      els.quickSheet.hidden = false;
    }
  }

  function closeQuickSheet() {
    if (els.quickSheet) els.quickSheet.hidden = true;
  }

  function setMobileMode(mode) {
    const next = mode === "PLANTILLAS" ? "PLANTILLAS" : "RESPONDER";
    state.mobileMode = next;

    document.body.classList.toggle("ac-library-focus", next === "PLANTILLAS");
    els.modeResponder?.classList.toggle("active", next === "RESPONDER");
    els.modePlantillas?.classList.toggle("active", next === "PLANTILLAS");

    if (next === "PLANTILLAS") {
      renderCategoryControls();
      renderTemplateList();
      global.requestAnimationFrame(() => {
        els.search?.focus({ preventScroll: true });
      });
    } else {
      closeQuickSheet();
    }
  }

  /* ==========================================================
   * ACCIONES MÓVILES / ADMINISTRACIÓN DE PLANTILLAS
   * ========================================================== */

  function openWhatsApp() {
    const text = getResponseValue().trim();
    if (!text) {
      showToast("No hay respuesta para enviar.", "warning");
      return false;
    }

    const url = "https://wa.me/?text=" + encodeURIComponent(text);
    global.open(url, "_blank", "noopener,noreferrer");
    if (state.selectedTemplateId) registerUsage(state.selectedTemplateId);
    return true;
  }

  function populateTemplateCategorySelect() {
    if (!els.templateCategory) return;

    els.templateCategory.innerHTML = "";
    sortByOrder((CONFIG.categories || []).filter(c => c.enabled !== false))
      .forEach(category => {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = category.label;
        els.templateCategory.appendChild(option);
      });
  }

  function updateTemplatePreview() {
    if (!els.templatePreviewText || !els.templatePreviewMeta) return;

    const response = asString(els.templateResponse?.value).trim();
    const categoryId = asString(els.templateCategory?.value).trim();
    const category = getCategory(categoryId);
    const typeResponse = asString(els.templateType?.value || "CORTA").toUpperCase();

    els.templatePreviewText.textContent =
      response || "Tu respuesta aparecerá aquí mientras la escribes.";
    els.templatePreviewMeta.textContent =
      `${typeResponse.charAt(0) + typeResponse.slice(1).toLowerCase()} · ${category?.label || "Sin categoría"}`;
  }

  function openTemplateModal(templateId) {
    if (!els.templateModal) return;

    const template = templateId ? getTemplate(templateId) : null;
    state.editingTemplateId = template?.source === "DB" ? template.id : null;

    if (els.templateForm) els.templateForm.reset();
    populateTemplateCategorySelect();

    if (template && state.editingTemplateId) {
      if (els.templateModalTitle) els.templateModalTitle.textContent = "Editar plantilla";
      if (els.templateModalSubtitle) {
        els.templateModalSubtitle.textContent = "Actualiza la respuesta sin cambiar su identificador.";
      }
      if (els.templateSaveText) els.templateSaveText.textContent = "Guardar cambios";
      if (els.templateTitle) els.templateTitle.value = template.title || "";
      if (els.templateCategory) els.templateCategory.value = template.category || "";
      if (els.templateType) {
        els.templateType.value = asString(template.meta?.tipo_respuesta || "CORTA").toUpperCase();
      }
      if (els.templateKeywords) {
        els.templateKeywords.value = (template.meta?.keywords || []).join(", ");
      }
      if (els.templateResponse) els.templateResponse.value = template.response || "";
    } else {
      if (els.templateModalTitle) els.templateModalTitle.textContent = "Nueva plantilla";
      if (els.templateModalSubtitle) {
        els.templateModalSubtitle.textContent = "Crea una respuesta reutilizable en menos de un minuto.";
      }
      if (els.templateSaveText) els.templateSaveText.textContent = "Guardar plantilla";
      if (els.templateType) els.templateType.value = "CORTA";

      if (els.templateCategory) {
        els.templateCategory.value = state.selectedCategory || els.templateCategory.value;
      }

      if (els.templateResponse && getResponseValue().trim()) {
        els.templateResponse.value = getResponseValue().trim();
      }
    }

    updateTemplatePreview();
    els.templateModal.hidden = false;
    document.body.classList.add("ac-modal-open");

    global.requestAnimationFrame(() => {
      els.templateTitle?.focus({ preventScroll: true });
    });
  }

  function closeTemplateModal() {
    if (!els.templateModal) return;
    els.templateModal.hidden = true;
    state.editingTemplateId = null;
    document.body.classList.remove("ac-modal-open");
  }

  async function saveTemplate(event) {
    event?.preventDefault?.();

    const title = asString(els.templateTitle?.value).trim();
    const category = asString(els.templateCategory?.value).trim();
    const response = asString(els.templateResponse?.value).trim();
    const keywords = asString(els.templateKeywords?.value)
      .split(",")
      .map(v => v.trim())
      .filter(Boolean);
    const typeResponse = asString(els.templateType?.value || "CORTA").trim().toUpperCase();

    if (!title || !category || !response) {
      showToast("Completa nombre, categoría y respuesta.", "warning");
      return false;
    }

    if (els.templateSave) els.templateSave.disabled = true;

    try {
      const payload = {
        AMBITO: state.selectedScope || "PROSPECTO",
        CATEGORIA: category,
        TITULO: title,
        RESPUESTA: response,
        META_JSON: {
          keywords,
          tags: [],
          tipo_respuesta: typeResponse,
          priority: 50,
          channel: "GENERAL",
          schema_version: 1
        },
        CONTEXTO_JSON: {},
        ESTADO: "ACTIVO"
      };

      const editingId = state.editingTemplateId;
      const action = editingId ? "AC_actualizarPlantilla" : "AC_crearPlantilla";
      if (editingId) payload.ID = editingId;

      const result = await apiPost(action, payload);

      if (!result || result.success === false) {
        throw new Error(result?.message || "No se pudo guardar la plantilla");
      }

      await loadBackendTemplates();

      const savedId = editingId || result.id || result.ID || result.registro?.ID;
      if (savedId) {
        selectTemplate(savedId);
      }

      closeTemplateModal();
      showToast(
        editingId ? "Plantilla actualizada." : "Plantilla guardada y disponible.",
        "success"
      );
      return true;
    } catch (error) {
      console.error("[Asistente Comercial] Guardar plantilla:", error);
      showToast("No se pudo guardar la plantilla en la base.", "danger");
      return false;
    } finally {
      if (els.templateSave) els.templateSave.disabled = false;
    }
  }

  async function duplicateTemplate(templateId) {
    const template = getTemplate(templateId);
    if (!template || template.source !== "DB") return false;

    try {
      const result = await apiPost("AC_duplicarPlantilla", {
        ID: templateId,
        cambios: {
          TITULO: (template.title || "Plantilla") + " — copia"
        }
      });

      if (!result || result.success === false) {
        throw new Error(result?.message || "No se pudo duplicar");
      }

      await loadBackendTemplates();
      showToast("Plantilla duplicada.", "success");
      return true;
    } catch (error) {
      console.error("[Asistente Comercial] Duplicar plantilla:", error);
      showToast("No se pudo duplicar la plantilla.", "danger");
      return false;
    }
  }

  async function deactivateTemplate(templateId) {
    const template = getTemplate(templateId);
    if (!template || template.source !== "DB") return false;

    const accepted = global.confirm(
      '¿Desactivar "' + (template.title || "esta plantilla") + '"? No se eliminará de la base.'
    );
    if (!accepted) return false;

    try {
      const result = await apiPost("AC_cambiarEstadoPlantilla", {
        ID: templateId,
        ESTADO: "INACTIVO"
      });

      if (!result || result.success === false) {
        throw new Error(result?.message || "No se pudo desactivar");
      }

      if (state.selectedTemplateId === templateId) clearSelection();
      await loadBackendTemplates();
      showToast("Plantilla desactivada.", "success");
      return true;
    } catch (error) {
      console.error("[Asistente Comercial] Desactivar plantilla:", error);
      showToast("No se pudo desactivar la plantilla.", "danger");
      return false;
    }
  }

  function showTemplateMenu(templateId) {
    const template = getTemplate(templateId);
    if (!template || template.source !== "DB") return;

    const option = global.prompt(
      "Opciones de plantilla:\\n1 = Editar\\n2 = Duplicar\\n3 = Desactivar\\n\\nEscribe 1, 2 o 3:"
    );

    if (option === "1") openTemplateModal(templateId);
    if (option === "2") duplicateTemplate(templateId);
    if (option === "3") deactivateTemplate(templateId);
  }

  function scrollToElement(element) {
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ==========================================================
   * EVENTOS
   * ========================================================== */

  function bindEvents() {
    if (state.listenersBound) return;

    if (els.message) {
      els.message.addEventListener("input", handleMessageInput);
    }

    if (els.search) {
      els.search.addEventListener("input", handleSearchInput);
    }

    if (els.response) {
      els.response.addEventListener("input", () => {
        state.renderedResponse = getResponseValue();
      });
    }

    if (els.category) {
      els.category.addEventListener("change", event => {
        setCategory(event.target.value, { autoSuggest: true, autoDetected: false });
      });
    }

    if (els.scope) {
      els.scope.addEventListener("change", event => {
        setScope(event.target.value);
      });
    }

    if (els.copyButton) {
      els.copyButton.addEventListener("click", copyResponse);
    }

    if (els.analyzeButton) {
      els.analyzeButton.addEventListener("click", () => {
        state.pastedMessage = getMessageValue();
        scheduleAnalysis(true);
      });
    }

    if (els.whatsappButton) {
      els.whatsappButton.addEventListener("click", openWhatsApp);
    }

    if (els.newTemplateButton) {
      els.newTemplateButton.addEventListener("click", () => openTemplateModal());
    }

    if (els.templateModalClose) {
      els.templateModalClose.addEventListener("click", closeTemplateModal);
    }

    if (els.templateCancel) {
      els.templateCancel.addEventListener("click", closeTemplateModal);
    }

    [els.templateTitle, els.templateCategory, els.templateKeywords,
     els.templateResponse, els.templateType].filter(Boolean).forEach(control => {
      control.addEventListener("input", updateTemplatePreview);
      control.addEventListener("change", updateTemplatePreview);
    });

    if (els.quickClose) {
      els.quickClose.addEventListener("click", closeQuickSheet);
    }

    if (els.quickCopy) {
      els.quickCopy.addEventListener("click", copyResponse);
    }

    if (els.quickWhatsApp) {
      els.quickWhatsApp.addEventListener("click", openWhatsApp);
    }

    if (els.templateModal) {
      els.templateModal.addEventListener("click", event => {
        if (event.target === els.templateModal) closeTemplateModal();
      });
    }

    if (els.templateForm) {
      els.templateForm.addEventListener("submit", saveTemplate);
    }

    if (els.modeResponder) {
      els.modeResponder.addEventListener("click", () => {
        setMobileMode("RESPONDER");
        scrollToElement(els.messageCard);
      });
    }

    if (els.modePlantillas) {
      els.modePlantillas.addEventListener("click", () => {
        setMobileMode("PLANTILLAS");
        scrollToElement(els.libraryCard);
      });
    }

    if (els.clearButton) {
      els.clearButton.addEventListener("click", clearAll);
    }

    if (els.favoritesButton) {
      els.favoritesButton.addEventListener("click", () => {
        renderTemplateList({ onlyFavorites: true });
      });
    }

    if (els.mostUsedButton) {
      els.mostUsedButton.addEventListener("click", () => {
        renderTemplateList({ mostUsed: true });
      });
    }

    if (els.templateList) {
      els.templateList.addEventListener("click", handleTemplateAreaClick);
    }

    if (els.suggestions) {
      els.suggestions.addEventListener("click", handleTemplateAreaClick);
    }

    if (els.categoriesContainer) {
      els.categoriesContainer.addEventListener("click", event => {
        const button = event.target.closest("[data-category]");
        if (!button) return;
        setCategory(button.dataset.category, { autoSuggest: true, autoDetected: false });
      });
    }

    if (els.libraryCategoriesContainer) {
      els.libraryCategoriesContainer.addEventListener("click", event => {
        const button = event.target.closest("[data-category]");
        if (!button) return;
        setCategory(button.dataset.category, {
          autoSuggest: false,
          autoDetected: false
        });
        renderTemplateList();
      });
    }

    if (els.scopesContainer) {
      els.scopesContainer.addEventListener("click", event => {
        const button = event.target.closest("[data-scope]");
        if (!button) return;
        setScope(button.dataset.scope);
      });
    }

    state.listenersBound = true;
  }

  function scheduleAnalysis(immediate) {
    if (state.inputTimer) clearTimeout(state.inputTimer);

    const seq = ++state.analysisSeq;
    const normalized = normalizeText(state.pastedMessage);

    if (!normalized) {
      runSuggestionFlow({ message: "" });
      return;
    }

    if (normalized.length < 3) {
      runSuggestionFlow({ message: state.pastedMessage });
      return;
    }

    showStatus("Analizando…", "neutral");

    state.inputTimer = setTimeout(() => {
      if (seq !== state.analysisSeq) return;
      state.inputTimer = null;
      runSuggestionFlow({ message: state.pastedMessage });
    }, immediate ? 0 : 280);
  }

  function handleMessageInput(event) {
    state.pastedMessage = asString(event.target.value);

    // Cada mensaje nuevo invalida selección/sugerencia anterior.
    state.suggestions = [];
    state.selectedTemplateId = null;
    state.renderedResponse = "";
    setResponseValue("");
    syncSelectedTemplateUI();
    renderSuggestions();

    if (state.categoryMode === "AUTO") {
      state.selectedCategory = "";
      syncCategoryUI();
    }

    scheduleAnalysis(false);
  }

  function handleSearchInput(event) {
    state.searchText = asString(event.target.value);
    renderTemplateList();
  }

  function handleTemplateAreaClick(event) {
    const actionButton = event.target.closest("[data-action]");
    const card = event.target.closest("[data-template-id]");
    const templateId =
      actionButton?.dataset.templateId ||
      card?.dataset.templateId;

    if (!templateId) return;

    if (actionButton?.dataset.action === "favorite") {
      event.preventDefault();
      event.stopPropagation();
      toggleFavorite(templateId);
      return;
    }

    if (actionButton?.dataset.action === "menu") {
      event.preventDefault();
      event.stopPropagation();
      showTemplateMenu(templateId);
      return;
    }

    selectTemplate(templateId);
  }

  /* ==========================================================
   * INICIALIZACIÓN
   * ========================================================== */

  function init() {
    if (state.initialized) return true;

    loadLocalState();
    loadTemplates(CONFIG.templates);
    cacheElements();
    bindEvents();

    renderScopeControls();
    renderCategoryControls();
    renderTemplateList();
    renderSuggestions();
    syncSelectedTemplateUI();

    showStatus(CONFIG.ui?.emptyMessage || "", "neutral");

    state.initialized = true;

    document.dispatchEvent(
      new CustomEvent("asistentecomercial:ready", {
        detail: {
          version: CONFIG.appVersion,
          schemaVersion: CONFIG.schemaVersion,
          templates: state.activeTemplates.length
        }
      })
    );

    return true;
  }

  function autoInit() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  }

  /* ==========================================================
   * API PÚBLICA
   * ========================================================== */

  const API = Object.freeze({
    version: CONFIG.appVersion,
    schemaVersion: CONFIG.schemaVersion,

    init,

    getState() {
      return {
        initialized: state.initialized,
        selectedScope: state.selectedScope,
        selectedCategory: state.selectedCategory,
        selectedTemplateId: state.selectedTemplateId,
        searchText: state.searchText,
        activeTemplateCount: state.activeTemplates.length,
        suggestionCount: state.suggestions.length
      };
    },

    getConfig() {
      return CONFIG;
    },

    getTemplates(options) {
      return clone(filterTemplates(options || {}));
    },

    getTemplate(templateId) {
      const template = getTemplate(templateId);
      return template ? clone(template) : null;
    },

    replaceTemplates,

    detectCategory(message, scope) {
      return clone(detectCategory(message, scope || state.selectedScope));
    },

    suggest(message, options) {
      return suggestTemplates(message, options || {}).map(item => ({
        template: clone(item.template),
        score: item.score
      }));
    },

    selectTemplate,

    setCategory,

    setScope,

    renderPlaceholders,

    toggleFavorite,

    isFavorite,

    getUsage,

    registerUsage,

    copyResponse,
    openWhatsApp,
    loadBackendTemplates,
    openTemplateModal,

    clear: clearAll,

    /**
     * Preparado para contexto futuro sin acoplar el motor al ERP.
     * No realiza escrituras clínicas.
     */
    buildResponse(templateId, context) {
      const template = getTemplate(templateId);
      if (!template) return "";
      return renderPlaceholders(template.response, context || {});
    }
  });

  global.AsistenteComercial = API;

  autoInit();

})(window, document);
