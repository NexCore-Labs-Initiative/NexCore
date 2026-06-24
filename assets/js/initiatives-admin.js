(function () {
  "use strict";

  const API_URL = "/api/admin/initiatives";
  const INITIAL_CATEGORIES = ["ai-dev-tools", "community-events", "hardware-exploration"];
  const state = { initiatives: [], editingId: null, loaded: false };
  const $ = (id) => document.getElementById(id);
  const arabic = () => (document.documentElement.lang || "").toLowerCase().startsWith("ar");
  const text = (en, ar) => (arabic() ? ar : en);
  const value = (id) => String($(id)?.value || "").trim();

  function notify(message, type = "info") {
    if (typeof window.showToast === "function") window.showToast(message, type);
    else window.alert(message);
  }

  async function request(method, body) {
    const { data: { session } = {} } = await window.supabaseClient.auth.getSession();
    if (!session?.access_token) throw new Error(text("Your session has expired.", "انتهت صلاحية جلستك."));
    const response = await fetch(API_URL, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.details?.join(" ") || payload.error || text("Request failed.", "فشل الطلب."));
    return payload;
  }

  function selectedCategories() {
    const selected = [...document.querySelectorAll("input[name='initiativeCategory']:checked")].map((input) => input.value);
    const extra = value("initiativeCategoriesExtra").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
    return [...new Set([...selected, ...extra])];
  }

  function pairedHighlights() {
    const en = value("initiativeHighlightsEn").split("\n").map((item) => item.trim()).filter(Boolean);
    const ar = value("initiativeHighlightsAr").split("\n").map((item) => item.trim()).filter(Boolean);
    if (en.length !== ar.length) throw new Error(text("Highlights need matching English and Arabic lines.", "يجب أن تتطابق أسطر الملامح بالإنجليزية والعربية."));
    return en.map((item, index) => ({ en: item, ar: ar[index] }));
  }

  function buildPayload(visibility) {
    const imageUrl = value("initiativeImageUrl");
    const linkUrl = value("initiativeLinkUrl");
    return {
      id: state.editingId,
      slug: value("initiativeSlug"),
      status: value("initiativeStatus"),
      visibility,
      categories: selectedCategories(),
      featured: $("initiativeFeatured").checked,
      sort_order: Number(value("initiativeSortOrder")),
      launched_at: value("initiativeLaunchedAt") || null,
      title: { en: value("initiativeTitleEn"), ar: value("initiativeTitleAr") },
      mission: { en: value("initiativeMissionEn"), ar: value("initiativeMissionAr") },
      summary: { en: value("initiativeSummaryEn"), ar: value("initiativeSummaryAr") },
      overview: { en: value("initiativeOverviewEn"), ar: value("initiativeOverviewAr") },
      highlights: pairedHighlights(),
      image: imageUrl ? { src: imageUrl, alt: { en: value("initiativeImageAltEn"), ar: value("initiativeImageAltAr") } } : null,
      primary_link: linkUrl ? { url: linkUrl, label: { en: value("initiativeLinkLabelEn"), ar: value("initiativeLinkLabelAr") } } : null
    };
  }

  function setForm(record) {
    state.editingId = record?.id || null;
    $("initiativeFormTitle").textContent = record ? text("Edit initiative", "تعديل المبادرة") : text("Create initiative", "إنشاء مبادرة");
    $("initiativeForm").reset();
    if (!record) { renderPreview(); return; }
    $("initiativeSlug").value = record.slug || "";
    $("initiativeStatus").value = record.status || "concept";
    $("initiativeFeatured").checked = record.featured === true;
    $("initiativeSortOrder").value = record.sort_order ?? 0;
    $("initiativeLaunchedAt").value = record.launched_at ? record.launched_at.slice(0, 10) : "";
    $("initiativeTitleEn").value = record.title?.en || ""; $("initiativeTitleAr").value = record.title?.ar || "";
    $("initiativeMissionEn").value = record.mission?.en || ""; $("initiativeMissionAr").value = record.mission?.ar || "";
    $("initiativeSummaryEn").value = record.summary?.en || ""; $("initiativeSummaryAr").value = record.summary?.ar || "";
    $("initiativeOverviewEn").value = record.overview?.en || ""; $("initiativeOverviewAr").value = record.overview?.ar || "";
    $("initiativeHighlightsEn").value = (record.highlights || []).map((item) => item.en).join("\n");
    $("initiativeHighlightsAr").value = (record.highlights || []).map((item) => item.ar).join("\n");
    $("initiativeImageUrl").value = record.image?.src || ""; $("initiativeImageAltEn").value = record.image?.alt?.en || ""; $("initiativeImageAltAr").value = record.image?.alt?.ar || "";
    $("initiativeLinkUrl").value = record.primary_link?.url || ""; $("initiativeLinkLabelEn").value = record.primary_link?.label?.en || ""; $("initiativeLinkLabelAr").value = record.primary_link?.label?.ar || "";
    const known = new Set(INITIAL_CATEGORIES);
    document.querySelectorAll("input[name='initiativeCategory']").forEach((input) => { input.checked = (record.categories || []).includes(input.value); });
    $("initiativeCategoriesExtra").value = (record.categories || []).filter((category) => !known.has(category)).join(", ");
    renderPreview();
  }

  function addPreviewElement(tag, className, content) {
    const element = document.createElement(tag); element.className = className; element.textContent = content; return element;
  }

  function renderPreview() {
    const target = $("initiativePreview");
    if (!target) return;
    let payload;
    try { payload = buildPayload(value("initiativeVisibility") || "draft"); } catch { payload = null; }
    target.replaceChildren();
    if (!payload?.title.en) {
      target.innerHTML = `<p class="initiative-admin-empty">${text("Fill the form to preview the initiative card.", "أكمل النموذج لمعاينة بطاقة المبادرة.")}</p>`;
      return;
    }
    const card = document.createElement("article"); card.className = "initiative-card";
    const visual = document.createElement("div"); visual.className = "initiative-card-visual";
    if (payload.image?.src) { const image = document.createElement("img"); image.src = payload.image.src; image.alt = payload.image.alt.en || ""; visual.append(image); }
    visual.append(addPreviewElement("span", `initiative-status initiative-status--${payload.status || "concept"}`, payload.status || "concept"));
    const content = document.createElement("div"); content.className = "initiative-card-content";
    const categories = document.createElement("div"); categories.className = "initiative-categories";
    payload.categories.forEach((category) => categories.append(addPreviewElement("span", "initiative-category", category)));
    content.append(categories, addPreviewElement("h3", "initiative-card-title", payload.title.en), addPreviewElement("p", "initiative-card-mission", payload.mission.en || payload.summary.en || ""));
    card.append(visual, content); target.append(card);
  }

  function formatDate(date) { return date ? new Intl.DateTimeFormat(arabic() ? "ar" : "en", { dateStyle: "medium" }).format(new Date(date)) : "—"; }
  function label(value) {
    const key = String(value || "");
    const english = { launched: "Launched", active: "Active", "in-development": "In development", incubation: "Incubation", concept: "Concept", public: "Public", draft: "Draft", private: "Private" };
    const arabicLabels = { launched: "تم الإطلاق", active: "نشطة", "in-development": "قيد التطوير", incubation: "قيد الاحتضان", concept: "فكرة", public: "عام", draft: "مسودة", private: "خاص" };
    return (arabic() ? arabicLabels : english)[key] || key.replace(/-/g, " ");
  }

  function renderList() {
    const body = $("initiativesTableBody"); const empty = $("initiativesEmpty"); const wrapper = $("initiativesTableWrapper");
    body.replaceChildren();
    if (!state.initiatives.length) { empty.classList.remove("hidden"); wrapper.classList.add("hidden"); return; }
    empty.classList.add("hidden"); wrapper.classList.remove("hidden");
    state.initiatives.forEach((initiative) => {
      const row = document.createElement("tr");
      const cells = [initiative.title?.[arabic() ? "ar" : "en"] || initiative.slug, initiative.categories?.join(", ") || "—", initiative.status, initiative.visibility, formatDate(initiative.updated_at)];
      cells.forEach((content, index) => {
        const cell = document.createElement("td");
        if (index === 2) cell.append(addPreviewElement("span", "initiative-admin-status", label(content)));
        else if (index === 3) cell.append(addPreviewElement("span", `initiative-admin-visibility initiative-admin-visibility--${content}`, label(content)));
        else cell.textContent = content;
        row.append(cell);
      });
      const actionCell = document.createElement("td"); const actions = document.createElement("div"); actions.className = "initiative-admin-list-actions";
      const edit = document.createElement("button"); edit.type = "button"; edit.title = text("Edit", "تعديل"); edit.innerHTML = '<i class="fa-solid fa-pen" aria-hidden="true"></i>'; edit.addEventListener("click", () => { setForm(initiative); $("initiativeForm").scrollIntoView({ behavior: "smooth", block: "start" }); });
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "initiative-admin-delete"; remove.title = text("Delete", "حذف"); remove.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>'; remove.addEventListener("click", () => deleteInitiative(initiative));
      actions.append(edit, remove); actionCell.append(actions); row.append(actionCell); body.append(row);
    });
  }

  async function loadInitiatives() {
    const loading = $("initiativesLoading"); if (!loading) return;
    loading.classList.remove("hidden");
    try { const { initiatives } = await request("GET"); state.initiatives = initiatives || []; state.loaded = true; renderList(); }
    catch (error) { notify(error.message, "error"); }
    finally { loading.classList.add("hidden"); }
  }

  async function saveInitiative(visibility) {
    try {
      const payload = buildPayload(visibility);
      const result = await request(state.editingId ? "PATCH" : "POST", payload);
      const initiative = result.initiative;
      state.initiatives = state.editingId ? state.initiatives.map((item) => item.id === initiative.id ? initiative : item) : [initiative, ...state.initiatives];
      notify(visibility === "public" ? text("Initiative published.", "تم نشر المبادرة.") : text("Draft saved.", "تم حفظ المسودة."), "success");
      setForm(initiative); renderList();
    } catch (error) { notify(error.message, "error"); }
  }

  async function deleteInitiative(initiative) {
    if (!window.confirm(text(`Delete ${initiative.title?.en || initiative.slug}?`, `حذف ${initiative.title?.ar || initiative.slug}؟`))) return;
    try { await request("DELETE", { id: initiative.id }); state.initiatives = state.initiatives.filter((item) => item.id !== initiative.id); if (state.editingId === initiative.id) setForm(null); renderList(); notify(text("Initiative deleted.", "تم حذف المبادرة."), "success"); }
    catch (error) { notify(error.message, "error"); }
  }

  function bind() {
    $("initiativeForm")?.addEventListener("input", renderPreview);
    $("initiativePreviewBtn")?.addEventListener("click", renderPreview);
    $("initiativeResetBtn")?.addEventListener("click", () => setForm(null));
    $("initiativesRefreshBtn")?.addEventListener("click", loadInitiatives);
    document.querySelectorAll("[data-initiative-save]").forEach((button) => button.addEventListener("click", () => saveInitiative(button.dataset.initiativeSave)));
    document.querySelector(".admin-tab[data-tab='initiatives']")?.addEventListener("click", () => { if (!state.loaded) loadInitiatives(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
})();
