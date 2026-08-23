/**
 * ============================================================
 * ASISTENTE COMERCIAL
 * Archivo: asistente_comercial.js
 * Versión: 1.6.0 CREADOR ASISTIDO DESDE TEXTO
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
    selectedTemplateType: "",
    actionTemplateId: null,
    pendingDeactivateTemplateId: null,
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

  function humanizeCategoryLabel(categoryId) {
    const raw = asString(categoryId).trim();
    if (!raw) return "";

    const accentMap = {
      ESTETICA: "Estética",
      GINECOLOGIA: "Ginecología",
      UBICACION: "Ubicación",
      INFORMACION: "Información",
      PROMOCION: "Promoción"
    };

    return raw
      .split(/[_\-\s]+/)
      .filter(Boolean)
      .map((part, index) => {
        const upper = part.toUpperCase();
        if (accentMap[upper]) return accentMap[upper];
        const lower = part.toLowerCase();
        return index === 0
          ? lower.charAt(0).toUpperCase() + lower.slice(1)
          : lower;
      })
      .join(" ");
  }


  function getCategoryLabel(category) {
    if (!category) return "";
    if (category.id === "PRECIOS") return "Consulta de precio";
    return category.label || humanizeCategoryLabel(category.id);
  }

  function humanizeMetaLabel(value) {
    const raw = asString(value).trim();
    if (!raw) return "";
    return raw
      .split(/[_\-\s]+/)
      .filter(Boolean)
      .map((part, index) => {
        const lower = part.toLowerCase();
        return index === 0
          ? lower.charAt(0).toUpperCase() + lower.slice(1)
          : lower;
      })
      .join(" ");
  }

  function normalizeMetaId(value) {
    return normalizeText(value)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function normalizeCategoryId(value) {
    const typed = asString(value).trim();
    if (!typed) return "";

    const existing = getAvailableCategories().find(category => {
      return normalizeText(category.id) === normalizeText(typed) ||
        normalizeText(getCategoryLabel(category)) === normalizeText(typed);
    });
    if (existing) return existing.id;

    return normalizeMetaId(typed);
  }

  function getTemplateType(template) {
    return normalizeMetaId(template?.meta?.tipo_plantilla || "");
  }

  function getTemplateService(template) {
    return asString(template?.meta?.servicio || "").trim();
  }

  function getAvailableTemplateTypes(categoryId) {
    const category = categoryId ?? state.selectedCategory;
    if (!category) return [];

    const values = unique(
      (state.activeTemplates || [])
        .filter(template =>
          isActiveTemplate(template) &&
          template.category === category &&
          (!state.selectedScope || template.scope === state.selectedScope)
        )
        .map(getTemplateType)
        .filter(Boolean)
    );

    return values.sort((a, b) =>
      humanizeMetaLabel(a).localeCompare(humanizeMetaLabel(b), "es", { sensitivity: "base" })
    );
  }

  function getAvailableCategories() {
    const configured = (CONFIG.categories || [])
      .filter(c => c && c.id && c.enabled !== false)
      .map(c => ({ ...c, label: getCategoryLabel(c), source: "CONFIG" }));

    const byId = new Map(configured.map(c => [c.id, c]));
    const baseOrder = configured.reduce(
      (max, c) => Math.max(max, Number(c.order ?? 0)),
      0
    );

    const discoveredIds = unique(
      (state.activeTemplates || [])
        .filter(isActiveTemplate)
        .map(t => asString(t.category).trim())
        .filter(Boolean)
    ).sort((a, b) =>
      humanizeCategoryLabel(a).localeCompare(
        humanizeCategoryLabel(b),
        "es",
        { sensitivity: "base" }
      )
    );

    discoveredIds.forEach((categoryId, index) => {
      if (byId.has(categoryId)) return;

      const categoryTemplates = (state.activeTemplates || []).filter(
        t => t.category === categoryId && isActiveTemplate(t)
      );

      const dynamicKeywords = unique(
        categoryTemplates.flatMap(t =>
          Array.isArray(t?.meta?.keywords) ? t.meta.keywords : []
        )
      );

      byId.set(categoryId, {
        id: categoryId,
        label: getCategoryLabel({ id: categoryId, label: humanizeCategoryLabel(categoryId) }),
        icon: "tag",
        order: baseOrder + 100 + index,
        enabled: true,
        keywords: unique([
          categoryId,
          categoryId.replace(/_/g, " "),
          ...dynamicKeywords
        ]),
        source: "DB"
      });
    });

    return sortByOrder([...byId.values()]);
  }

  function getCategory(categoryId) {
    return getAvailableCategories().find(c => c.id === categoryId) || null;
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

    // Las categorías se reconstruyen desde las plantillas activas cargadas.
    // Así cualquier categoría nueva de la BD aparece sin editar config.js.
    renderCategoryControls();
    renderTemplateTypeControls();
    populateTemplateCategorySelect();
    populateTemplateTypeDatalist();
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

    const enabledCategories = getAvailableCategories();
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
      template.meta?.tipo_plantilla,
      template.meta?.servicio,
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
    const templateType = opts.templateType ?? state.selectedTemplateType;
    const onlyFavorites = Boolean(opts.onlyFavorites);
    const mostUsed = Boolean(opts.mostUsed);

    let result = state.activeTemplates.filter(template => {
      if (scope && template.scope !== scope) return false;
      if (category && template.category !== category) return false;
      if (templateType && getTemplateType(template) !== templateType) return false;
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


  function focusLibraryAfterCategorySelection() {
    if (!isMobileView()) return;
    if (state.mobileMode !== "PLANTILLAS") return;

    const target =
      (!els.templateTypePanel?.hidden && els.templateTypePanel) ||
      els.search ||
      els.templateList;

    if (!target || typeof target.scrollIntoView !== "function") return;

    global.requestAnimationFrame(() => {
      global.requestAnimationFrame(() => {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
          inline: "nearest"
        });
      });
    });
  }

  function setCategory(categoryId, options) {
    const opts = options || {};
    const valid =
      !categoryId ||
      getAvailableCategories().some(c => c.id === categoryId);

    if (!valid) return false;

    const categoryChanged = state.selectedCategory !== (categoryId || "");
    state.selectedCategory = categoryId || "";
    state.categoryMode = opts.autoDetected ? "AUTO" : (categoryId ? "MANUAL" : "AUTO");

    if (categoryChanged) {
      state.selectedTemplateType = "";
    }

    if (!opts.keepTemplate) {
      state.selectedTemplateId = null;
    }

    syncCategoryUI();
    renderTemplateTypeControls();

    if (!opts.skipRender) {
      renderTemplateList();
    }

    if (opts.focusResults) {
      focusLibraryAfterCategorySelection();
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
    state.selectedTemplateType = "";
    state.categoryMode = "AUTO";

    renderScopeControls();
    renderCategoryControls();
    renderTemplateTypeControls();
    populateTemplateCategorySelect();
    populateTemplateTypeDatalist();
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
    renderTemplateTypeControls();
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
      templateTypePanel: "acTipoPlantillaPanel",
      templateTypesContainer: "acTiposPlantilla",
      scopesContainer: "acAmbitos",
      analyzeButton: "acAnalizar",
      whatsappButton: "acWhatsApp",
      newTemplateButton: "acNuevaPlantilla",
      templateModal: "acTemplateModal",
      templateModalClose: "acTemplateModalClose",
      templateForm: "acTemplateForm",
      templateTitle: "acTplTitulo",
      templateCategory: "acTplCategoria",
      templateCategoryList: "acTplCategoriasList",
      templateKeywords: "acTplKeywords",
      templateResponse: "acTplRespuesta",
      templateType: "acTplTipo",
      templateBusinessType: "acTplTipoPlantilla",
      templateBusinessTypeList: "acTplTiposList",
      templateService: "acTplServicio",
      templateMessage: "acTplMensaje",
      templateSave: "acTplGuardar",
      templateSaveText: "acTplGuardarTexto",
      templateCancel: "acTplCancelar",
      templateModalTitle: "acTplModalTitle",
      templateModalSubtitle: "acTplModalSubtitle",
      templatePreview: "acTplPreview",
      templatePreviewText: "acTplPreviewText",
      templatePreviewMeta: "acTplPreviewMeta",
      textCreator: "acTextCreator",
      textCreatorToggle: "acTextCreatorToggle",
      textCreatorBody: "acTextCreatorBody",
      textCreatorInput: "acTextCreatorInput",
      textCreatorAnalyze: "acTextCreatorAnalyze",
      textCreatorClear: "acTextCreatorClear",
      textCreatorMessage: "acTextCreatorMessage",
      quickSheet: "acQuickSheet",
      quickTitle: "acQuickTitle",
      quickCategory: "acQuickCategory",
      quickResponse: "acQuickResponse",
      quickClose: "acQuickClose",
      quickCopy: "acQuickCopy",
      quickWhatsApp: "acQuickWhatsApp",
      actionModal: "acTemplateActionModal",
      actionModalClose: "acActionModalClose",
      actionModalTitle: "acActionModalTitle",
      actionModalSubtitle: "acActionModalSubtitle",
      actionEdit: "acActionEdit",
      actionDuplicate: "acActionDuplicate",
      actionDeactivate: "acActionDeactivate",
      actionCancel: "acActionCancel",
      confirmModal: "acConfirmModal",
      confirmTitle: "acConfirmTitle",
      confirmText: "acConfirmText",
      confirmCancel: "acConfirmCancel",
      confirmAccept: "acConfirmAccept",
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
    const categories = getAvailableCategories();

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


  function renderTemplateTypeControls() {
    if (!els.templateTypePanel || !els.templateTypesContainer) return;

    const types = getAvailableTemplateTypes(state.selectedCategory);

    if (!state.selectedCategory || !types.length) {
      state.selectedTemplateType = "";
      els.templateTypePanel.hidden = true;
      els.templateTypesContainer.innerHTML = "";
      return;
    }

    if (state.selectedTemplateType && !types.includes(state.selectedTemplateType)) {
      state.selectedTemplateType = "";
    }

    els.templateTypePanel.hidden = false;
    els.templateTypesContainer.innerHTML = "";

    const all = document.createElement("button");
    all.type = "button";
    all.className = "ac-type-chip" + (!state.selectedTemplateType ? " active" : "");
    all.dataset.templateType = "";
    all.innerHTML = '<i class="bi bi-grid"></i><span>Todos</span>';
    els.templateTypesContainer.appendChild(all);

    types.forEach(typeId => {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        "ac-type-chip" + (state.selectedTemplateType === typeId ? " active" : "");
      button.dataset.templateType = typeId;

      const count = state.activeTemplates.filter(template =>
        template.category === state.selectedCategory &&
        getTemplateType(template) === typeId &&
        (!state.selectedScope || template.scope === state.selectedScope)
      ).length;

      button.innerHTML =
        '<i class="bi bi-tag"></i><span>' +
        humanizeMetaLabel(typeId) +
        '</span><small>' + count + '</small>';
      els.templateTypesContainer.appendChild(button);
    });
  }

  function setTemplateType(typeId) {
    const normalized = normalizeMetaId(typeId || "");
    const valid = !normalized || getAvailableTemplateTypes().includes(normalized);
    if (!valid) return false;

    state.selectedTemplateType = normalized;
    renderTemplateTypeControls();
    renderTemplateList();
    return true;
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
    const metaParts = [category?.label || template.category || ""];
    const typeLabel = humanizeMetaLabel(getTemplateType(template));
    const serviceLabel = humanizeMetaLabel(getTemplateService(template));
    if (typeLabel) metaParts.push(typeLabel);
    if (serviceLabel && normalizeText(serviceLabel) !== normalizeText(template.title)) {
      metaParts.push(serviceLabel);
    }
    meta.textContent = metaParts.filter(Boolean).join(" · ");

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
        ? '<i class="bi bi-check2"></i> Seleccionada'
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

    [
      els.categoriesContainer,
      els.libraryCategoriesContainer
    ].filter(Boolean).forEach(container => {
      container
        .querySelectorAll("[data-category]")
        .forEach(button => {
          const isActive = button.dataset.category === state.selectedCategory;
          button.classList.toggle("active", isActive);
          button.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    });
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
      renderTemplateTypeControls();
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
    if (!els.templateCategoryList) return;

    els.templateCategoryList.innerHTML = "";
    getAvailableCategories().forEach(category => {
      const option = document.createElement("option");
      option.value = getCategoryLabel(category);
      option.dataset.categoryId = category.id;
      els.templateCategoryList.appendChild(option);
    });
  }

  function populateTemplateTypeDatalist() {
    if (!els.templateBusinessTypeList) return;

    const values = unique(
      (state.activeTemplates || [])
        .map(getTemplateType)
        .filter(Boolean)
    ).sort((a, b) =>
      humanizeMetaLabel(a).localeCompare(humanizeMetaLabel(b), "es", { sensitivity: "base" })
    );

    els.templateBusinessTypeList.innerHTML = "";
    values.forEach(typeId => {
      const option = document.createElement("option");
      option.value = humanizeMetaLabel(typeId);
      els.templateBusinessTypeList.appendChild(option);
    });
  }

  function showTemplateEditorMessage(message, type) {
    if (!els.templateMessage) return;
    if (!message) {
      els.templateMessage.hidden = true;
      els.templateMessage.textContent = "";
      els.templateMessage.dataset.type = "";
      return;
    }
    els.templateMessage.hidden = false;
    els.templateMessage.textContent = message;
    els.templateMessage.dataset.type = type || "neutral";
  }

  function updateTemplatePreview() {
    if (!els.templatePreviewText || !els.templatePreviewMeta) return;

    const response = asString(els.templateResponse?.value).trim();
    const categoryId = asString(els.templateCategory?.value).trim();
    const category = getCategory(categoryId);
    const typeResponse = asString(els.templateType?.value || "CORTA").toUpperCase();
    const businessType = normalizeMetaId(els.templateBusinessType?.value || "");
    const categoryLabel = category?.label ||
      humanizeCategoryLabel(normalizeCategoryId(categoryId)) ||
      "Sin categoría";

    els.templatePreviewText.textContent =
      response || "Tu respuesta aparecerá aquí mientras la escribes.";

    const previewParts = [
      typeResponse.charAt(0) + typeResponse.slice(1).toLowerCase(),
      categoryLabel
    ];
    if (businessType) previewParts.push(humanizeMetaLabel(businessType));
    els.templatePreviewMeta.textContent = previewParts.join(" · ");
  }


  /* ==========================================================
   * CREADOR ASISTIDO DESDE TEXTO — LOCAL / SIN PERSISTENCIA
   * ========================================================== */

  function setTextCreatorMessage(message, type) {
    if (!els.textCreatorMessage) return;
    els.textCreatorMessage.textContent = asString(message);
    els.textCreatorMessage.dataset.type = type || "neutral";
    els.textCreatorMessage.hidden = !message;
  }

  function toggleTextCreator(forceOpen) {
    if (!els.textCreatorBody || !els.textCreatorToggle) return false;

    const shouldOpen =
      typeof forceOpen === "boolean"
        ? forceOpen
        : Boolean(els.textCreatorBody.hidden);

    els.textCreatorBody.hidden = !shouldOpen;
    els.textCreatorToggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");

    const chevron = els.textCreatorToggle.querySelector(".bi-chevron-down, .bi-chevron-up");
    if (chevron) {
      chevron.className = shouldOpen ? "bi bi-chevron-up" : "bi bi-chevron-down";
    }

    if (shouldOpen) {
      global.requestAnimationFrame(() => {
        els.textCreatorInput?.focus({ preventScroll: true });
      });
    }

    return shouldOpen;
  }

  function resetTextCreator() {
    if (els.textCreatorInput) els.textCreatorInput.value = "";
    if (els.textCreatorBody) els.textCreatorBody.hidden = true;
    if (els.textCreatorToggle) {
      els.textCreatorToggle.setAttribute("aria-expanded", "false");
      const chevron = els.textCreatorToggle.querySelector(".bi-chevron-down, .bi-chevron-up");
      if (chevron) chevron.className = "bi bi-chevron-down";
    }
    setTextCreatorMessage("");
  }

  function getTextCreatorTypeRules() {
    return [
      { id: "PROMOCION", confidence: 0.98, words: ["promocion", "promoción", "oferta", "descuento", "paquete", "promo"] },
      { id: "PRECIO", confidence: 0.96, words: ["precio", "costo", "valor", "cuesta", "$", "dolar", "dólar"] },
      { id: "ESQUEMA", confidence: 0.97, words: ["esquema", "dosis", "intervalo", "primera dosis", "segunda dosis", "tercera dosis"] },
      { id: "REPROGRAMAR", confidence: 0.98, words: ["reprogramar", "cambiar cita", "cambio de cita", "mover cita"] },
      { id: "CONFIRMAR", confidence: 0.98, words: ["confirmar cita", "confirmacion de cita", "confirmación de cita"] },
      { id: "RECORDATORIO", confidence: 0.98, words: ["recordatorio", "recordar cita"] },
      { id: "AGENDAR", confidence: 0.92, words: ["agendar", "reservar cita", "separar cita", "coordinar cita"] },
      { id: "DIRECCION", confidence: 0.96, words: ["direccion", "dirección", "ubicacion", "ubicación", "como llegar", "cómo llegar"] },
      { id: "HORARIO_ATENCION", confidence: 0.96, words: ["horario", "horarios", "hora de atencion", "hora de atención"] },
      { id: "REVISION", confidence: 0.90, words: ["revision", "revisión", "revisar resultado", "revisar resultados"] },
      { id: "SEGUIMIENTO", confidence: 0.91, words: ["seguimiento", "control posterior", "control de seguimiento"] },
      { id: "INFORMACION", confidence: 0.78, words: ["informacion", "información", "que es", "qué es", "consiste", "sirve para", "beneficios"] }
    ];
  }

  function scoreTextCreatorCategory(rawText) {
    const text = normalizeText(rawText);
    const categories = getAvailableCategories();
    let best = null;

    categories.forEach(category => {
      let score = 0;
      const label = normalizeText(category.label || "");
      const idText = normalizeText(asString(category.id).replace(/_/g, " "));

      if (label && text.includes(label)) score += 8;
      if (idText && text.includes(idText)) score += 8;

      const keywords = unique([
        ...(Array.isArray(category.keywords) ? category.keywords : []),
        category.label,
        asString(category.id).replace(/_/g, " ")
      ]);

      keywords.forEach(keyword => {
        const normalizedKeyword = normalizeText(keyword);
        if (normalizedKeyword && normalizedKeyword.length >= 3 && text.includes(normalizedKeyword)) {
          score += normalizedKeyword.length >= 8 ? 3 : 2;
        }
      });

      // Señales médicas/comerciales muy concretas para categorías ya existentes.
      const id = asString(category.id).toUpperCase();
      if (id === "VPH" && /\b(vph|gardasil|papiloma)\b/.test(text)) score += 12;
      if (id === "ESTETICA_FACIAL" && /\b(hifu|bioestimul|toxina|botulin|peeling|hilos|labios|exosomas)\b/.test(text)) score += 12;
      if (id === "AGENDAMIENTO" && /\b(agendar|reservar|cita|reprogramar|confirmar cita)\b/.test(text)) score += 8;
      if (id === "UBICACION" && /\b(ubicacion|direccion|como llegar|agora|mall del sol)\b/.test(text)) score += 10;
      if (id === "HORARIOS" && /\b(horario|horarios|disponibilidad)\b/.test(text)) score += 10;
      if (id === "PAPANICOLAOU" && /\b(papanicolaou|pap smear|citologia|citología)\b/.test(text)) score += 12;
      if (id === "COLPOSCOPIA" && /\b(colposcopia|colposcopía)\b/.test(text)) score += 12;
      if (id === "MENOPAUSIA" && /\b(menopausia|climaterio)\b/.test(text)) score += 12;
      if (id === "RESULTADOS" && /\b(resultado|resultados|informe|revisión de examen)\b/.test(text)) score += 7;

      if (!best || score > best.score) {
        best = { id: category.id, label: category.label, score };
      }
    });

    if (!best || best.score < 5) {
      return { id: "", label: "", confidence: 0 };
    }

    return {
      id: best.id,
      label: best.label,
      confidence: best.score >= 12 ? 0.95 : best.score >= 8 ? 0.84 : 0.70
    };
  }

  function detectTextCreatorType(rawText) {
    const text = normalizeText(rawText);
    let best = null;

    getTextCreatorTypeRules().forEach(rule => {
      let hits = 0;
      rule.words.forEach(word => {
        if (text.includes(normalizeText(word))) hits += 1;
      });

      if (hits && (!best || hits > best.hits || (hits === best.hits && rule.confidence > best.confidence))) {
        best = { id: rule.id, hits, confidence: rule.confidence };
      }
    });

    return best || { id: "", hits: 0, confidence: 0 };
  }

  function detectTextCreatorService(rawText) {
    const text = normalizeText(rawText);
    const candidates = new Map();

    (state.activeTemplates || []).forEach(template => {
      const service = asString(template?.meta?.servicio).trim();
      if (!service) return;
      const key = normalizeMetaId(service);
      if (!candidates.has(key)) {
        candidates.set(key, {
          id: key,
          label: humanizeMetaLabel(key),
          variants: new Set()
        });
      }
      candidates.get(key).variants.add(service);
      candidates.get(key).variants.add(humanizeMetaLabel(key));
      candidates.get(key).variants.add(key.replace(/_/g, " "));
    });

    const knownServices = [
      ["GARDASIL", ["gardasil"]],
      ["HIFU_FACIAL", ["hifu", "hifu facial"]],
      ["BIOESTIMULADORES", ["bioestimulador", "bioestimuladores"]],
      ["TOXINA_BOTULINICA", ["toxina botulinica", "toxina botulínica", "botox"]],
      ["PEELING_FACIAL", ["peeling", "peeling facial"]],
      ["HILOS_TENSORES", ["hilos tensores", "hilos"]],
      ["ACIDO_HIALURONICO_LABIOS", ["acido hialuronico", "ácido hialurónico", "relleno labios", "labios"]],
      ["PAPANICOLAOU", ["papanicolaou", "citologia", "citología"]],
      ["COLPOSCOPIA", ["colposcopia", "colposcopía"]]
    ];

    knownServices.forEach(([id, variants]) => {
      if (!candidates.has(id)) {
        candidates.set(id, {
          id,
          label: humanizeMetaLabel(id),
          variants: new Set()
        });
      }
      variants.forEach(v => candidates.get(id).variants.add(v));
    });

    let best = null;
    candidates.forEach(candidate => {
      let longest = 0;
      candidate.variants.forEach(variant => {
        const normalized = normalizeText(variant);
        if (normalized && text.includes(normalized)) {
          longest = Math.max(longest, normalized.length);
        }
      });
      if (longest && (!best || longest > best.longest)) {
        best = { ...candidate, longest };
      }
    });

    return best
      ? { id: best.id, label: best.label, confidence: best.longest >= 8 ? 0.95 : 0.84 }
      : { id: "", label: "", confidence: 0 };
  }

  function extractTextCreatorKeywords(rawText, analysis) {
    const stopWords = new Set([
      "para","como","con","sin","por","una","uno","unos","unas","del","las","los","que",
      "esta","este","esto","desde","hasta","sobre","entre","más","mas","muy","puede","pueden",
      "tiene","tienen","cada","segun","según","donde","cuando","porque","tambien","también",
      "ayuda","quieres","quieras","deseas","podemos","puedo","te","tu","su","sus","al","el","la","de","y","o","en","es"
    ]);

    const words = normalizeText(rawText)
      .replace(/[^a-z0-9áéíóúñü$ ]/gi, " ")
      .split(/\s+/)
      .map(v => v.trim())
      .filter(v => v.length >= 4 && !stopWords.has(v));

    const frequencies = new Map();
    words.forEach(word => frequencies.set(word, (frequencies.get(word) || 0) + 1));

    const ranked = [...frequencies.entries()]
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
      .map(([word]) => word);

    const forced = [
      analysis?.category?.label,
      analysis?.type?.id ? humanizeMetaLabel(analysis.type.id) : "",
      analysis?.service?.label
    ]
      .filter(Boolean)
      .map(normalizeText);

    return unique([...forced, ...ranked]).filter(Boolean).slice(0, 10);
  }

  function suggestTextCreatorTitle(rawText, analysis) {
    const service = analysis?.service?.label || "";
    const typeLabel = analysis?.type?.id ? humanizeMetaLabel(analysis.type.id) : "";
    const categoryLabel = analysis?.category?.label || "";

    if (service && typeLabel) return `${service} — ${typeLabel}`;
    if (service) return service;
    if (categoryLabel && typeLabel) return `${categoryLabel} — ${typeLabel}`;

    const firstLine = asString(rawText)
      .split(/\n+/)
      .map(v => v.trim())
      .find(Boolean) || "";

    return firstLine
      .replace(/\s+/g, " ")
      .replace(/[.!?]+$/, "")
      .slice(0, 90);
  }

  function cleanTextCreatorResponse(rawText) {
    return asString(rawText)
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function analyzeRawTemplateText(rawText) {
    const raw = asString(rawText).trim();
    if (!raw) {
      return {
        category: { id: "", label: "", confidence: 0 },
        type: { id: "", confidence: 0 },
        service: { id: "", label: "", confidence: 0 },
        title: "",
        responseType: "CORTA",
        keywords: [],
        response: "",
        warnings: ["Pega un texto antes de analizar."]
      };
    }

    const category = scoreTextCreatorCategory(raw);
    const type = detectTextCreatorType(raw);
    const service = detectTextCreatorService(raw);
    const response = cleanTextCreatorResponse(raw);

    const responseType =
      response.length > 700 ? "LARGA" :
      response.length > 280 ? "MEDIA" :
      "CORTA";

    const analysis = {
      category,
      type,
      service,
      responseType,
      response,
      title: "",
      keywords: [],
      warnings: []
    };

    analysis.title = suggestTextCreatorTitle(raw, analysis);
    analysis.keywords = extractTextCreatorKeywords(raw, analysis);

    if (!category.id || category.confidence < 0.75) {
      analysis.warnings.push("No detecté una categoría con suficiente seguridad; revísala antes de guardar.");
    }
    if (!type.id || type.confidence < 0.80) {
      analysis.warnings.push("Tipo / subcategoría no detectado con suficiente seguridad; puedes completarlo manualmente.");
    }
    if (!service.id) {
      analysis.warnings.push("Servicio / tema no detectado; puede dejarse vacío si la respuesta es general.");
    }

    const normalized = normalizeText(raw);
    const hasPrice = /\$\s*\d|\b\d+(?:[.,]\d{1,2})?\s*(?:dolares|dólares|usd)\b/i.test(raw);
    if (hasPrice && type.id && !["PRECIO", "PROMOCION"].includes(type.id)) {
      analysis.warnings.push("Se detectó un precio; revisa si el tipo correcto debería ser Precio o Promoción.");
    }
    if (/\b(promocion|promoción|oferta|descuento)\b/.test(normalized) && type.id !== "PROMOCION") {
      analysis.warnings.push("Se detectó lenguaje promocional; revisa el tipo / subcategoría.");
    }

    return analysis;
  }

  function setFieldIfEmpty(element, value) {
    if (!element || value === undefined || value === null || value === "") return false;
    if (asString(element.value).trim()) return false;
    element.value = asString(value);
    return true;
  }

  function applyTextAnalysisToForm(analysis) {
    if (!analysis) return 0;

    let changed = 0;

    if (analysis.category?.id && analysis.category.confidence >= 0.75) {
      changed += setFieldIfEmpty(
        els.templateCategory,
        analysis.category.label || humanizeCategoryLabel(analysis.category.id)
      ) ? 1 : 0;
    }

    if (analysis.type?.id && analysis.type.confidence >= 0.80) {
      changed += setFieldIfEmpty(
        els.templateBusinessType,
        humanizeMetaLabel(analysis.type.id)
      ) ? 1 : 0;
    }

    if (analysis.service?.id) {
      changed += setFieldIfEmpty(
        els.templateService,
        analysis.service.label || humanizeMetaLabel(analysis.service.id)
      ) ? 1 : 0;
    }

    changed += setFieldIfEmpty(els.templateTitle, analysis.title) ? 1 : 0;
    changed += setFieldIfEmpty(els.templateType, analysis.responseType) ? 1 : 0;
    changed += setFieldIfEmpty(els.templateKeywords, analysis.keywords.join(", ")) ? 1 : 0;
    changed += setFieldIfEmpty(els.templateResponse, analysis.response) ? 1 : 0;

    populateTemplateCategorySelect();
    populateTemplateTypeDatalist();
    updateTemplatePreview();

    return changed;
  }

  function renderTextCreatorSuggestions(analysis, changedCount) {
    if (!analysis) return;

    const warnings = Array.isArray(analysis.warnings) ? analysis.warnings : [];
    const suggestions = [];

    if (analysis.category?.id) {
      suggestions.push(`Categoría sugerida: ${analysis.category.label || humanizeCategoryLabel(analysis.category.id)}.`);
    }
    if (analysis.type?.id) {
      suggestions.push(`Tipo sugerido: ${humanizeMetaLabel(analysis.type.id)}.`);
    }
    if (analysis.service?.id) {
      suggestions.push(`Servicio / tema sugerido: ${analysis.service.label || humanizeMetaLabel(analysis.service.id)}.`);
    }

    const prefix = changedCount
      ? `Se completaron ${changedCount} campo${changedCount === 1 ? "" : "s"} vacío${changedCount === 1 ? "" : "s"}.`
      : "No reemplacé campos que ya tenían contenido.";

    const message = [
      prefix,
      ...suggestions,
      ...warnings
    ].join(" ");

    setTextCreatorMessage(
      message,
      warnings.length ? "warning" : "success"
    );
  }

  function runTextCreatorAnalysis() {
    const raw = asString(els.textCreatorInput?.value).trim();
    if (!raw) {
      setTextCreatorMessage("Pega un texto antes de analizar.", "warning");
      els.textCreatorInput?.focus();
      return false;
    }

    const analysis = analyzeRawTemplateText(raw);
    const changedCount = applyTextAnalysisToForm(analysis);
    renderTextCreatorSuggestions(analysis, changedCount);
    return true;
  }

  function openTemplateModal(templateId) {
    if (!els.templateModal) return;

    const template = templateId ? getTemplate(templateId) : null;
    state.editingTemplateId = template?.source === "DB" ? template.id : null;

    if (els.templateForm) els.templateForm.reset();
    resetTextCreator();
    populateTemplateCategorySelect();
    populateTemplateTypeDatalist();
    showTemplateEditorMessage("");

    if (template && state.editingTemplateId) {
      if (els.templateModalTitle) els.templateModalTitle.textContent = "Editar plantilla";
      if (els.templateModalSubtitle) {
        els.templateModalSubtitle.textContent = "Actualiza la respuesta sin cambiar su identificador.";
      }
      if (els.templateSaveText) els.templateSaveText.textContent = "Guardar cambios";
      if (els.templateTitle) els.templateTitle.value = template.title || "";
      if (els.templateCategory) els.templateCategory.value = getCategory(template.category)?.label || humanizeCategoryLabel(template.category);
      if (els.templateType) {
        els.templateType.value = asString(template.meta?.tipo_respuesta || "CORTA").toUpperCase();
      }
      if (els.templateBusinessType) {
        els.templateBusinessType.value = humanizeMetaLabel(getTemplateType(template));
      }
      if (els.templateService) {
        els.templateService.value = getTemplateService(template);
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
        const selected = getCategory(state.selectedCategory);
        els.templateCategory.value = selected?.label || "";
      }
      if (els.templateBusinessType) {
        els.templateBusinessType.value = humanizeMetaLabel(state.selectedTemplateType);
      }
      if (els.templateService) els.templateService.value = "";

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
    resetTextCreator();
    els.templateModal.hidden = true;
    state.editingTemplateId = null;
    document.body.classList.remove("ac-modal-open");
  }

  async function saveTemplate(event) {
    event?.preventDefault?.();

    const title = asString(els.templateTitle?.value).trim();
    const category = normalizeCategoryId(els.templateCategory?.value);
    const response = asString(els.templateResponse?.value).trim();
    const keywords = asString(els.templateKeywords?.value)
      .split(",")
      .map(v => v.trim())
      .filter(Boolean);
    const typeResponse = asString(els.templateType?.value || "CORTA").trim().toUpperCase();
    const businessType = normalizeMetaId(els.templateBusinessType?.value || "");
    const service = asString(els.templateService?.value).trim();

    if (!title || !category || !response) {
      showTemplateEditorMessage("Completa nombre, categoría y respuesta antes de guardar.", "warning");
      return false;
    }

    showTemplateEditorMessage("");

    const editingId = state.editingTemplateId;
    const isEditing = Boolean(editingId);
    const wasSelectedBeforeEdit = Boolean(
      editingId && state.selectedTemplateId === editingId
    );

    if (els.templateSave) {
      els.templateSave.disabled = true;
      els.templateSave.classList.add("ac-is-saving");
    }
    if (els.templateSaveText) {
      els.templateSaveText.textContent = "Guardando...";
    }
    const saveIcon = els.templateSave?.querySelector("i");
    if (saveIcon) {
      saveIcon.className = "bi bi-arrow-repeat ac-spin";
    }

    try {
      const existingTemplate = editingId ? getTemplate(editingId) : null;
      const existingMeta = existingTemplate?.meta && typeof existingTemplate.meta === "object"
        ? clone(existingTemplate.meta)
        : {};

      const nextMeta = {
        ...existingMeta,
        keywords,
        tags: Array.isArray(existingMeta.tags) ? existingMeta.tags : [],
        tipo_respuesta: typeResponse,
        priority: Number(existingMeta.priority ?? 50),
        channel: existingMeta.channel || "GENERAL",
        schema_version: Number(existingMeta.schema_version ?? 1)
      };

      if (businessType) nextMeta.tipo_plantilla = businessType;
      else delete nextMeta.tipo_plantilla;

      if (service) nextMeta.servicio = service;
      else delete nextMeta.servicio;

      const payload = {
        AMBITO: existingTemplate?.scope || state.selectedScope || "PROSPECTO",
        CATEGORIA: category,
        TITULO: title,
        RESPUESTA: response,
        META_JSON: nextMeta,
        CONTEXTO_JSON: {},
        ESTADO: "ACTIVO"
      };

      const action = editingId ? "AC_actualizarPlantilla" : "AC_crearPlantilla";
      if (editingId) payload.ID = editingId;

      const result = await apiPost(action, payload);

      if (!result || result.success === false) {
        throw new Error(result?.message || "No se pudo guardar la plantilla");
      }

      await loadBackendTemplates();

      const savedId = editingId || result.id || result.ID || result.registro?.ID;

      // Editar no debe activar una plantilla que antes no estaba seleccionada.
      // Si ya estaba activa, se vuelve a seleccionar para refrescar la respuesta.
      // Una plantilla nueva sí queda seleccionada como antes.
      if (savedId && (!isEditing || wasSelectedBeforeEdit)) {
        selectTemplate(savedId);
      }

      if (els.templateSaveText) {
        els.templateSaveText.textContent = isEditing ? "Cambios guardados" : "Plantilla guardada";
      }
      if (saveIcon) {
        saveIcon.className = "bi bi-check2-circle";
      }
      if (els.templateSave) {
        els.templateSave.classList.remove("ac-is-saving");
        els.templateSave.classList.add("ac-is-saved");
      }

      showTemplateEditorMessage(
        isEditing ? "Cambios guardados correctamente." : "Plantilla guardada correctamente.",
        "success"
      );

      await new Promise(resolve => global.setTimeout(resolve, 520));

      closeTemplateModal();
      showToast(
        isEditing ? "Plantilla actualizada correctamente." : "Plantilla guardada y disponible.",
        "success"
      );
      return true;
    } catch (error) {
      console.error("[Asistente Comercial] Guardar plantilla:", error);
      showTemplateEditorMessage(
        "No se pudo guardar la plantilla en la base. Revisa los datos e inténtalo nuevamente.",
        "danger"
      );
      return false;
    } finally {
      if (els.templateSave) {
        els.templateSave.disabled = false;
        els.templateSave.classList.remove("ac-is-saving", "ac-is-saved");
      }
      if (saveIcon) {
        saveIcon.className = "bi bi-check2-circle";
      }
      if (els.templateSaveText) {
        els.templateSaveText.textContent = isEditing ? "Guardar cambios" : "Guardar plantilla";
      }
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

  function openTemplateActionModal(templateId) {
    const template = getTemplate(templateId);
    if (!template || template.source !== "DB" || !els.actionModal) return false;

    state.actionTemplateId = templateId;

    if (els.actionModalTitle) {
      els.actionModalTitle.textContent = template.title || "Administrar plantilla";
    }
    if (els.actionModalSubtitle) {
      const category = getCategory(template.category);
      els.actionModalSubtitle.textContent =
        (category?.label || template.category || "Plantilla") +
        (getTemplateType(template) ? " · " + humanizeMetaLabel(getTemplateType(template)) : "");
    }

    els.actionModal.hidden = false;
    document.body.classList.add("ac-modal-open");
    return true;
  }

  function closeTemplateActionModal() {
    if (!els.actionModal) return;
    els.actionModal.hidden = true;
    state.actionTemplateId = null;

    if (els.confirmModal?.hidden !== false && els.templateModal?.hidden !== false) {
      document.body.classList.remove("ac-modal-open");
    }
  }

  function openDeactivateConfirm(templateId) {
    const template = getTemplate(templateId);
    if (!template || template.source !== "DB" || !els.confirmModal) return false;

    state.pendingDeactivateTemplateId = templateId;
    if (els.confirmTitle) els.confirmTitle.textContent = "Desactivar plantilla";
    if (els.confirmText) {
      els.confirmText.textContent =
        '“' + (template.title || "Esta plantilla") +
        '” dejará de mostrarse en la biblioteca, pero se conservará en la base.';
    }

    closeTemplateActionModal();
    els.confirmModal.hidden = false;
    document.body.classList.add("ac-modal-open");
    return true;
  }

  function closeDeactivateConfirm() {
    if (!els.confirmModal) return;
    els.confirmModal.hidden = true;
    state.pendingDeactivateTemplateId = null;

    if (els.actionModal?.hidden !== false && els.templateModal?.hidden !== false) {
      document.body.classList.remove("ac-modal-open");
    }
  }

  async function confirmDeactivateTemplate() {
    const templateId = state.pendingDeactivateTemplateId;
    if (!templateId) return false;

    if (els.confirmAccept) els.confirmAccept.disabled = true;
    const ok = await deactivateTemplate(templateId);
    if (els.confirmAccept) els.confirmAccept.disabled = false;

    if (ok) closeDeactivateConfirm();
    return ok;
  }

  function showTemplateMenu(templateId) {
    return openTemplateActionModal(templateId);
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
        setCategory(event.target.value, { autoSuggest: true, autoDetected: false, focusResults: true });
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

    if (els.textCreatorToggle) {
      els.textCreatorToggle.addEventListener("click", () => toggleTextCreator());
    }

    if (els.textCreatorAnalyze) {
      els.textCreatorAnalyze.addEventListener("click", runTextCreatorAnalysis);
    }

    if (els.textCreatorClear) {
      els.textCreatorClear.addEventListener("click", () => {
        if (els.textCreatorInput) els.textCreatorInput.value = "";
        setTextCreatorMessage("");
        els.textCreatorInput?.focus();
      });
    }

    [els.templateTitle, els.templateCategory, els.templateKeywords,
     els.templateResponse, els.templateType, els.templateBusinessType,
     els.templateService].filter(Boolean).forEach(control => {
      control.addEventListener("input", updateTemplatePreview);
      control.addEventListener("change", updateTemplatePreview);
    });

    if (els.templateTypesContainer) {
      els.templateTypesContainer.addEventListener("click", event => {
        const button = event.target.closest("[data-template-type]");
        if (!button) return;
        setTemplateType(button.dataset.templateType || "");
      });
    }

    if (els.actionModalClose) {
      els.actionModalClose.addEventListener("click", closeTemplateActionModal);
    }
    if (els.actionCancel) {
      els.actionCancel.addEventListener("click", closeTemplateActionModal);
    }
    if (els.actionEdit) {
      els.actionEdit.addEventListener("click", () => {
        const templateId = state.actionTemplateId;
        closeTemplateActionModal();
        if (templateId) openTemplateModal(templateId);
      });
    }
    if (els.actionDuplicate) {
      els.actionDuplicate.addEventListener("click", async () => {
        const templateId = state.actionTemplateId;
        closeTemplateActionModal();
        if (templateId) await duplicateTemplate(templateId);
      });
    }
    if (els.actionDeactivate) {
      els.actionDeactivate.addEventListener("click", () => {
        const templateId = state.actionTemplateId;
        if (templateId) openDeactivateConfirm(templateId);
      });
    }

    if (els.confirmCancel) {
      els.confirmCancel.addEventListener("click", closeDeactivateConfirm);
    }
    if (els.confirmAccept) {
      els.confirmAccept.addEventListener("click", confirmDeactivateTemplate);
    }

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
    if (els.actionModal) {
      els.actionModal.addEventListener("click", event => {
        if (event.target === els.actionModal) closeTemplateActionModal();
      });
    }
    if (els.confirmModal) {
      els.confirmModal.addEventListener("click", event => {
        if (event.target === els.confirmModal) closeDeactivateConfirm();
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
        setCategory(button.dataset.category, { autoSuggest: true, autoDetected: false, focusResults: true });
      });
    }

    if (els.libraryCategoriesContainer) {
      els.libraryCategoriesContainer.addEventListener("click", event => {
        const button = event.target.closest("[data-category]");
        if (!button) return;
        setCategory(button.dataset.category, {
          autoSuggest: false,
          autoDetected: false,
          focusResults: true
        });
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

    // CARGA ÚNICA DE PLANTILLAS PERSISTENTES DESDE LA BASE.
    // No bloquea la interfaz y conserva las plantillas locales como fallback.
    loadBackendTemplates();

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
    renderTemplateTypeControls,
    setTemplateType,

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
