(function () {
  "use strict";
  const ar = document.documentElement.lang.startsWith("ar");
  const $ = (id) => document.getElementById(id);
  const words = {
    dashboard: ["Dashboard", "لوحة التحكم"],
    labsAdmin: ["Labs administration", "إدارة Labs"],
    heading: ["Resource workspace", "مساحة إدارة الموارد"],
    intro: [
      "Prepare resources from reviewed contributions. Drafts stay private until a Labs administrator publishes them.",
      "جهّز الموارد من المساهمات التي راجعها الفريق. تبقى المسودات خاصة حتى يعتمدها وينشرها مسؤول Labs.",
    ],
    loading: ["Checking access…", "جارٍ التحقق من الصلاحية…"],
    signIn: ["Sign in to NexCore Labs", "تسجيل الدخول إلى NexCore Labs"],
    search: ["Search title or course", "ابحث بالعنوان أو المقرر"],
    all: ["All resources", "جميع الموارد"],
    draft: ["Draft", "مسودة"],
    submitted: ["Awaiting review", "بانتظار المراجعة"],
    published: ["Published", "منشور"],
    archived: ["Archived", "مؤرشف"],
    discarded: ["Discarded", "مستبعد"],
    refresh: ["Refresh queue", "تحديث القائمة"],
    new: ["New resource", "مورد جديد"],
    choose: [
      "Choose a resource or create a draft",
      "اختر موردًا أو أنشئ مسودة",
    ],
    metadata: ["Resource details", "بيانات المورد"],
    title: ["Title", "العنوان"],
    course: ["Course", "المقرر"],
    courseCode: ["Course code", "رمز المقرر"],
    college: ["College", "الكلية"],
    courseTitle: ["Course title", "اسم المقرر"],
    courseTitleAr: [
      "Arabic course title (optional)",
      "اسم المقرر بالعربية (اختياري)",
    ],
    semester: ["Semester", "الفصل الدراسي"],
    type: ["Resource type", "نوع المورد"],
    description: ["Description", "الوصف"],
    topics: ["Topics (separate with commas)", "الموضوعات (افصل بينها بفواصل)"],
    format: ["Format", "الصيغة"],
    language: ["Language", "لغة المورد"],
    arabic: ["Arabic", "العربية"],
    english: ["English", "الإنجليزية"],
    url: ["Google Drive file or folder URL", "رابط ملف أو مجلد Google Drive"],
    credit: [
      "Contributor / source credit (optional)",
      "اسم المساهم أو المصدر (اختياري)",
    ],
    permission: [
      "We have permission to display this credit publicly.",
      "لدينا موافقة على عرض اسم المساهم أو المصدر علنًا.",
    ],
    translations: [
      "Reviewed translations (optional)",
      "ترجمات مراجعة (اختيارية)",
    ],
    arabicTitle: ["Arabic title", "العنوان بالعربية"],
    englishTitle: ["English title", "العنوان بالإنجليزية"],
    arabicDescription: ["Arabic description", "الوصف بالعربية"],
    englishDescription: ["English description", "الوصف بالإنجليزية"],
    arabicTopics: ["Arabic topics", "الموضوعات بالعربية"],
    englishTopics: ["English topics", "الموضوعات بالإنجليزية"],
    compare: [
      "Compare approved content and proposal",
      "مقارنة المحتوى المعتمد بالتعديل المقترح",
    ],
    reviewNote: [
      "Note to the editor (required when returning)",
      "ملاحظة للمحرر (مطلوبة عند الإرجاع)",
    ],
    reviewConfirm: [
      "I checked the Drive link as a viewer, the metadata, sharing rights, and any new course proposal.",
      "تحققت من فتح رابط Drive بصفة مشاهد، وراجعت البيانات وحقوق المشاركة وأي مقرر جديد مقترح.",
    ],
    history: ["Review history", "سجل المراجعة"],
    adminTools: ["Administrator tools", "أدوات المسؤول"],
    editors: ["Study Hub Editors", "محررو Study Hub"],
    userEmail: ["Existing Labs user's email", "بريد مستخدم لديه حساب في Labs"],
    grant: ["Grant Editor access", "منح صلاحية محرر"],
    semesters: ["Semester settings", "إعدادات الفصول الدراسية"],
    semesterHelp: [
      "One semester per line, in display order. Existing values must be retained.",
      "فصل دراسي واحد في كل سطر حسب ترتيب العرض. يجب الاحتفاظ بالقيم الحالية.",
    ],
    saveSemesters: ["Save semester list", "حفظ قائمة الفصول"],
    footer: [
      "Contributions are gathered through Google Forms and reviewed manually. Files remain on Google Drive.",
      "تُجمع المساهمات عبر نماذج Google وتُراجع يدويًا. تبقى الملفات على Google Drive.",
    ],
    save: ["Save draft", "حفظ المسودة"],
    submit: ["Submit for review", "إرسال للمراجعة"],
    withdraw: ["Withdraw to edit", "سحب للتعديل"],
    return: ["Return to editor", "إرجاع للمحرر"],
    publish: ["Approve and publish", "اعتماد ونشر"],
    discard: ["Discard draft", "استبعاد المسودة"],
    revise: ["Prepare revision", "إعداد تعديل"],
    archive: ["Archive resource", "أرشفة المورد"],
    restore: ["Restore resource", "استعادة المورد"],
    revoke: ["Revoke access", "إلغاء الصلاحية"],
    empty: [
      "No resources match this queue.",
      "لا توجد موارد مطابقة لهذه القائمة.",
    ],
    ready: ["Workspace ready.", "مساحة العمل جاهزة."],
    saved: ["Changes saved.", "تم حفظ التغييرات."],
    propose: ["Propose a new course", "اقتراح مقرر جديد"],
    select: ["Select…", "اختر…"],
    unsaved: [
      "You have unsaved changes. Leave this draft?",
      "لديك تغييرات غير محفوظة. هل تريد مغادرة المسودة؟",
    ],
    confirm: ["Confirm this action?", "هل تريد تأكيد هذا الإجراء؟"],
    preview: ["Card preview", "معاينة البطاقة"],
    open: ["Open Drive link", "فتح رابط Drive"],
    approved: ["Approved content", "المحتوى المعتمد"],
    proposed: ["Proposed content", "المحتوى المقترح"],
    field: ["Field", "الحقل"],
    newCourse: ["New course proposal", "مقرر جديد مقترح"],
    languageRequired: [
      "Select Arabic, English, or both.",
      "اختر العربية أو الإنجليزية أو كليهما.",
    ],
    topicsRequired: [
      "Enter at least one topic.",
      "أدخل موضوعًا واحدًا على الأقل.",
    ],
    creditRequired: [
      "Confirm permission for the public credit.",
      "أكد الموافقة على عرض الاسم علنًا.",
    ],
    reviewRequired: [
      "Confirm the review checks before publishing.",
      "أكد إتمام المراجعة قبل النشر.",
    ],
    noteRequired: [
      "Write a note before returning this draft.",
      "اكتب ملاحظة قبل إرجاع المسودة.",
    ],
    denied: [
      "This account needs Study Hub Editor or Labs administrator access.",
      "يحتاج هذا الحساب إلى صلاحية محرر Study Hub أو مسؤول Labs.",
    ],
    unavailable: [
      "The workspace is unavailable. Refresh to retry.",
      "يتعذر تحميل مساحة العمل. حدّث الصفحة للمحاولة مجددًا.",
    ],
    conflict: [
      "Someone else changed this record. Your edits are still in the form. Copy anything you need, then refresh and reopen the record.",
      "عدّل شخص آخر هذا السجل. تبقى تعديلاتك في النموذج. انسخ ما تحتاجه ثم حدّث القائمة وافتح السجل مجددًا.",
    ],
    duplicate: [
      "This Drive resource or course already exists. Select the existing course, or revise the existing resource.",
      "هذا المورد أو المقرر موجود مسبقًا. اختر المقرر الموجود أو عدّل المورد الحالي.",
    ],
    invalid: [
      "Check the required metadata and Google Drive URL.",
      "تحقق من البيانات المطلوبة ورابط Google Drive.",
    ],
    existingUser: [
      "The user must already have a Labs account.",
      "يجب أن يكون لدى المستخدم حساب Labs موجود.",
    ],
    similar: [
      "A resource with a similar title, course and semester already exists. Check the queue before submitting.",
      "يوجد مورد بعنوان ومقرر وفصل مشابه. راجع القائمة قبل الإرسال.",
    ],
    working: [
      "Resolve the working draft before archiving or restoring.",
      "أكمل معالجة المسودة الحالية قبل الأرشفة أو الاستعادة.",
    ],
    retained: [
      "Existing semester values must be retained.",
      "يجب الاحتفاظ بقيم الفصول الدراسية الحالية.",
    ],
    reviewLive: [
      "The approved version remains public while this revision is prepared.",
      "تبقى النسخة المعتمدة منشورة أثناء إعداد هذا التعديل.",
    ],
    noCredit: ["No public credit", "دون اسم مساهم"],
    courseMatch: [
      "Approve proposed course, or match an existing course",
      "اعتمد المقرر المقترح أو اختر مقررًا موجودًا",
    ],
    approveCourse: [
      "Approve the proposed new course",
      "اعتماد المقرر الجديد المقترح",
    ],
  };
  const t = (key) => words[key]?.[ar ? 1 : 0] || key;
  const typeAr = {
    "Study plan": "خطة دراسية",
    Books: "كتب",
    Slides: "عروض تقديمية",
    Notes: "مذكرات",
    "Practice papers": "أوراق تدريبية",
    Exams: "اختبارات",
    Quizzes: "اختبارات قصيرة",
    "Worked examples": "أمثلة محلولة",
    "Study guide": "دليل دراسي",
  };
  const formatLabel = (value) =>
    ({
      pdf: "PDF",
      word: "Word",
      powerpoint: "PowerPoint",
      excel: "Excel",
      img: ar ? "صورة" : "Image",
      other: ar ? "أخرى" : "Other",
    })[value] || value;
  const state = {
    resources: [],
    revisions: [],
    courses: [],
    selected: null,
    revision: null,
    dirty: false,
    busy: false,
    isAdmin: false,
  };
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.placeholder);
    el.setAttribute("aria-label", el.placeholder);
  });
  $("queueFilter").setAttribute("aria-label", t("all"));
  $("queue").setAttribute("aria-label", t("all"));
  function message(text, error = false) {
    $("message").textContent = text;
    $("message").classList.toggle("error", error);
  }
  function element(tag, text, className) {
    const el = document.createElement(tag);
    if (tag === "button") el.disabled = state.busy;
    if (text != null) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function showError(e) {
    if (e.resourceId) {
      message(intake.errorText(e), true);
      const link = element("button", ar ? "فتح المورد الموجود" : "Open existing resource");
      link.type = "button";
      link.onclick = () => run(() => open(e.resourceId));
      $("message").append(link);
      return;
    }
    if (
      e.code &&
      ![401, 403, 409].includes(e.status) &&
      (state.submission ||
        /^(google_|sync_|submission_|missing_columns|ambiguous_columns)/.test(
          e.code,
        ))
    ) {
      message(intake.errorText(e), true);
      return;
    }
    const key =
      e.status === 409
        ? e.code === "version_conflict"
          ? "conflict"
          : "duplicate"
        : e.status === 401
          ? "signIn"
          : e.status === 403
            ? "denied"
            : e.code === "existing_labs_user_required"
              ? "existingUser"
              : e.code === "resolve_working_revision_first"
                ? "working"
                : e.code === "existing_semesters_cannot_be_removed"
                  ? "retained"
                  : e.status === 422
                    ? "invalid"
                    : "unavailable";
    message(t(key), true);
    if (e.status === 401 || e.status === 403) {
      $("app").hidden = true;
      $("signIn").hidden = e.status !== 401;
    }
  }
  async function request(query = "", body, endpoint = "/api/admin/study-hub") {
    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error || !data?.session)
      throw Object.assign(new Error(), { status: 401 });
    const response = await fetch(endpoint + query, {
      method: body ? "POST" : "GET",
      cache: "no-store",
      headers: {
        Authorization: "Bearer " + data.session.access_token,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok)
      throw Object.assign(new Error(), {
        status: response.status,
        code: result.error,
        resourceId: result.resourceId,
      });
    return result;
  }
  async function run(fn) {
    if (state.busy) return;
    state.busy = true;
    document.querySelectorAll("button").forEach((b) => {
      b.disabled = true;
    });
    try {
      const pending = fn();
      $("contentFields").disabled = true;
      intake.lock();
      await pending;
    } catch (e) {
      showError(e);
    } finally {
      state.busy = false;
      $("contentFields").disabled =
        !!state.selected && state.revision?.state !== "draft";
      document.querySelectorAll("button").forEach((b) => {
        b.disabled = false;
      });
      intake.lock();
    }
  }
  async function all(kind) {
    const items = [];
    for (let offset = 0; ; offset += 100) {
      const page = await request("?kind=" + kind + "&offset=" + offset);
      items.push(...page.items);
      if (page.items.length < 100) return items;
    }
  }
  function options(id, items, first = t("select")) {
    const select = $(id);
    select.replaceChildren();
    if (first !== null) {
      const o = element("option", first);
      o.value = "";
      select.append(o);
    }
    items.forEach(([value, label]) => {
      const o = element("option", label);
      o.value = value;
      select.append(o);
    });
  }
  function courseName(id) {
    const c = state.courses.find((x) => x.id === id);
    return c ? c.code + " · " + ((ar && c.title_ar) || c.title) : "";
  }
  function populateOptions() {
    options("course_id", [
      ...state.courses.map((c) => [c.id, courseName(c.id)]),
      ["new", t("propose")],
    ]);
    options(
      "college_id",
      state.colleges.map((c) => [c.id, ar ? c.name_ar : c.name]),
    );
    options(
      "semester",
      state.settings.semesters.map((s) => [s, s]),
    );
    options(
      "type",
      state.settings.resource_types.map((s) => [s, ar ? typeAr[s] || s : s]),
    );
    options(
      "format",
      state.settings.formats.map((s) => [s, formatLabel(s)]),
    );
  }
  function pending(id) {
    return state.revisions.find(
      (r) => r.resource_id === id && ["draft", "submitted"].includes(r.state),
    );
  }
  function renderQueue() {
    const q = $("queueSearch").value.trim().toLowerCase(),
      filter = $("queueFilter").value;
    $("queue").replaceChildren();
    state.resources
      .slice()
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .forEach((resource) => {
        const revision = pending(resource.id),
          content = revision?.content || resource.content || {},
          status = revision?.state || resource.status;
        if (resource.status === "draft" && !revision && !resource.content)
          return;
        if (filter !== "all" && filter !== status) return;
        const title = content.title || t("new"),
          course =
            courseName(content.course_id || resource.course_id) ||
            content.course_proposal?.code ||
            "";
        if (q && !(title + " " + course).toLowerCase().includes(q)) return;
        const button = element("button", null, "queue-item");
        button.type = "button";
        button.setAttribute(
          "aria-pressed",
          String(state.selected?.id === resource.id),
        );
        button.append(
          element("strong", title),
          element("small", course),
          element("span", t(status), "badge"),
        );
        button.addEventListener("click", () => {
          if (!state.dirty || confirm(t("unsaved")))
            run(() => open(resource.id));
        });
        $("queue").append(button);
      });
    if (!$("queue").children.length)
      $("queue").append(element("p", t("empty"), "muted"));
  }
  async function refresh() {
    const [resources, revisions, courses] = await Promise.all([
      all("resources"),
      all("revisions"),
      all("courses"),
    ]);
    Object.assign(state, { resources, revisions, courses });
    renderQueue();
  }
  function topics(value) {
    return value
      .split(/[,،\n]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  function content() {
    const data = {};
    [
      "title",
      "description",
      "semester",
      "type",
      "format",
      "drive_url",
      "credit",
    ].forEach((k) => {
      data[k] = $(k).value.trim();
    });
    data.topics = topics($("topics").value);
    data.languages = ["ar", "en"].filter((l) => $("lang_" + l).checked);
    data.credit_permission = $("credit_permission").checked;
    data.course_id = $("course_id").value === "new" ? "" : $("course_id").value;
    if (!data.course_id)
      data.course_proposal = {
        code: $("course_code").value.trim().toUpperCase(),
        title: $("course_title").value.trim(),
        title_ar: $("course_title_ar").value.trim(),
        college_id: $("college_id").value,
      };
    data.translations = {};
    for (const locale of ["ar", "en"])
      data.translations[locale] = {
        title: $(locale + "_title").value.trim(),
        description: $(locale + "_description").value.trim(),
        topics: topics($(locale + "_topics").value),
      };
    return data;
  }
  function setContent(data) {
    $("resourceForm").reset();
    populateOptions();
    [
      "title",
      "description",
      "semester",
      "type",
      "format",
      "drive_url",
      "credit",
    ].forEach((k) => {
      $(k).value = data[k] || "";
    });
    $("topics").value = (data.topics || []).join(", ");
    ["ar", "en"].forEach((l) => {
      $("lang_" + l).checked = (data.languages || []).includes(l);
    });
    $("credit_permission").checked = data.credit_permission === true;
    $("course_id").value =
      data.course_id || (data.course_proposal ? "new" : "");
    const p = data.course_proposal || {};
    ["code", "title", "title_ar"].forEach((k) => {
      $("course_" + k).value = p[k] || "";
    });
    $("college_id").value = p.college_id || "";
    $("courseProposal").hidden = $("course_id").value !== "new";
    for (const id of ["course_code", "college_id", "course_title"])
      $(id).required = $("course_id").value === "new";
    for (const locale of ["ar", "en"]) {
      const tr = data.translations?.[locale] || {};
      $(locale + "_title").value = tr.title || "";
      $(locale + "_description").value = tr.description || "";
      $(locale + "_topics").value = (tr.topics || []).join(", ");
    }
  }
  function safeDrive(value) {
    try {
      const u = new URL(value);
      return u.protocol === "https:" &&
        u.hostname === "drive.google.com" &&
        !u.username &&
        !u.password &&
        !u.port
        ? u.href
        : null;
    } catch {
      return null;
    }
  }
  function preview() {
    const data = content(),
      tr = data.translations?.[ar ? "ar" : "en"] || {};
    const box = $("preview");
    box.hidden = false;
    box.replaceChildren(
      element("span", t("preview"), "eyebrow"),
      element("h3", tr.title || data.title || t("new")),
      element(
        "p",
        [
          courseName(data.course_id) || data.course_proposal?.code,
          data.semester,
          formatLabel(data.format),
          data.languages
            .map((l) => t(l === "ar" ? "arabic" : "english"))
            .join(" / "),
        ]
          .filter(Boolean)
          .join(" · "),
        "muted",
      ),
      element("p", tr.description || data.description),
      element("p", (tr.topics?.length ? tr.topics : data.topics).join(" · ")),
      element("small", data.credit || t("noCredit")),
    );
    const url = safeDrive(data.drive_url);
    if (url) {
      const link = element("a", t("open"));
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      box.append(element("br"), link);
    }
    const code = (c, resource) =>
      state.courses.find((x) => x.id === (c.course_id || resource?.course_id))
        ?.code ||
      c.course_proposal?.code ||
      "";
    const similar = state.resources.some((r) => {
      const c = pending(r.id)?.content || r.content;
      return (
        r.id !== state.selected?.id &&
        c &&
        data.title &&
        code(data) &&
        c.title?.toLowerCase() === data.title.toLowerCase() &&
        code(c, r).toUpperCase() === code(data).toUpperCase() &&
        c.semester === data.semester
      );
    });
    $("warnings").hidden = !similar;
    $("warnings").textContent = similar ? t("similar") : "";
  }
  function comparison() {
    const old = state.selected?.content,
      newData = state.revision?.content;
    $("comparisonPanel").hidden = !old || !newData;
    if (!old || !newData) return;
    const table = $("comparison");
    table.replaceChildren();
    const header = element("tr");
    [t("field"), t("approved"), t("proposed")].forEach((v) =>
      header.append(element("th", v)),
    );
    table.append(header);
    const keys = [
      "title",
      "course_id",
      "semester",
      "description",
      "topics",
      "type",
      "format",
      "languages",
      "drive_url",
      "credit",
      "translations",
    ];
    keys.forEach((key) => {
      const value = (data, isOld) =>
        key === "course_id"
          ? courseName(
              data.course_id || (isOld ? state.selected.course_id : ""),
            ) || JSON.stringify(data.course_proposal || {})
          : typeof data[key] === "object"
            ? JSON.stringify(data[key], null, 2)
            : data[key] || "";
      const before = value(old, true),
        after = value(newData, false),
        row = element("tr", null, before !== after ? "changed" : "");
      row.append(
        element(
          "th",
          t(
            { course_id: "course", drive_url: "url", languages: "language" }[
              key
            ] || key,
          ),
        ),
        element("td", before),
        element("td", after),
      );
      table.append(row);
    });
  }
  function button(action, primary = false) {
    const b = element(
      "button",
      t(action),
      primary
        ? "primary"
        : ["archive", "discard"].includes(action)
          ? "danger"
          : "",
    );
    b.type = "button";
    b.addEventListener("click", () => run(() => act(action)));
    $("actions").append(b);
  }
  function renderActions() {
    if (intake.actions()) return;
    const revision = state.revision,
      resource = state.selected;
    $("actions").replaceChildren();
    if (!resource) {
      button("save", true);
      return;
    }
    if (revision?.state === "draft") {
      button("save");
      button("submit", true);
      button("discard");
    } else if (revision?.state === "submitted") {
      button("withdraw");
      if (state.isAdmin) {
        button("publish", true);
        button("return");
      }
    } else if (resource.status === "published") {
      button("revise", true);
      if (state.isAdmin) button("archive");
    } else if (resource.status === "archived" && state.isAdmin)
      button("restore", true);
  }
  async function open(id) {
    intake.clear();
    const data = await request("?kind=detail&id=" + encodeURIComponent(id));
    state.selected = data.resource;
    state.revision =
      data.revisions.find((r) => ["draft", "submitted"].includes(r.state)) ||
      null;
    state.dirty = false;
    $("resourceForm").hidden = false;
    $("editorHeading").textContent =
      state.revision?.content.title || data.resource.content?.title || t("new");
    $("workflowStatus").textContent =
      t(state.revision?.state || data.resource.status) +
      (state.revision && data.resource.status === "published"
        ? " · " + t("reviewLive")
        : "");
    setContent(
      state.revision?.content || {
        ...data.resource.content,
        course_id: data.resource.course_id,
      },
    );
    $("contentFields").disabled =
      state.busy || state.revision?.state !== "draft";
    $("reviewPanel").hidden = !(
      state.isAdmin && state.revision?.state === "submitted"
    );
    $("reviewNote").value = "";
    $("reviewConfirmed").checked = false;
    $("courseMatchPanel").hidden = !state.revision?.content.course_proposal;
    options(
      "courseMatch",
      state.courses.map((c) => [c.id, courseName(c.id)]),
      t("approveCourse"),
    );
    $("history").replaceChildren();
    data.revisions.forEach((r) =>
      (r.history || []).forEach((h) => {
        $("history").append(
          element(
            "li",
            new Date(h.at).toLocaleString(ar ? "ar-OM" : "en") +
              " · " +
              t(h.action) +
              (h.note ? " — " + h.note : ""),
          ),
        );
      }),
    );
    $("historyPanel").hidden = !$("history").children.length;
    renderActions();
    preview();
    comparison();
    renderQueue();
  }
  function newResource() {
    intake.clear();
    state.selected = null;
    state.revision = null;
    state.dirty = false;
    $("editorHeading").textContent = t("new");
    $("workflowStatus").textContent = t("draft");
    $("resourceForm").hidden = false;
    $("contentFields").disabled = false;
    setContent({});
    ["comparisonPanel", "reviewPanel", "historyPanel"].forEach((id) => {
      $(id).hidden = true;
    });
    renderActions();
    preview();
    renderQueue();
  }
  async function save() {
    const result = await request("", {
      action: state.revision ? "save" : "create",
      id: state.revision?.id,
      version: state.revision?.version,
      payload: content(),
    });
    state.dirty = false;
    await refresh();
    await open(result.resource_id || state.selected.id);
    return result;
  }
  async function act(action) {
    if (state.submission) {
      await intake.act("save");
      return;
    }
    if (action === "save") {
      await save();
      message(t("saved"));
      return;
    }
    if (action === "submit") {
      if (!$("resourceForm").reportValidity()) return;
      const data = content();
      if (!data.languages.length) {
        message(t("languageRequired"), true);
        return;
      }
      if (!data.topics.length) {
        message(t("topicsRequired"), true);
        return;
      }
      if (data.credit && !data.credit_permission) {
        message(t("creditRequired"), true);
        return;
      }
      await save();
    }
    if (action === "publish" && !$("reviewConfirmed").checked) {
      message(t("reviewRequired"), true);
      return;
    }
    if (action === "return" && !$("reviewNote").value.trim()) {
      message(t("noteRequired"), true);
      return;
    }
    if (
      ["discard", "archive", "restore", "publish"].includes(action) &&
      !confirm(t("confirm"))
    )
      return;
    const resourceAction = ["revise", "archive", "restore"].includes(action),
      record = resourceAction ? state.selected : state.revision;
    const payload = { note: $("reviewNote").value.trim() };
    if (action === "publish" && $("courseMatch").value)
      payload.course_id = $("courseMatch").value;
    await request("", {
      action,
      id: record.id,
      version: record.version,
      payload,
    });
    const id = state.selected.id;
    state.dirty = false;
    await refresh();
    await open(id);
    message(t("saved"));
  }
  async function editors() {
    const data = await request("?kind=editors");
    $("editors").replaceChildren();
    data.items.forEach((item) => {
      const row = element("div", null, "editor-entry");
      const revoke = element("button", t("revoke"));
      revoke.type = "button";
      revoke.onclick = () =>
        run(async () => {
          if (!confirm(t("confirm"))) return;
          await request("", { action: "revoke_editor", id: item.user_id });
          await editors();
          message(t("saved"));
        });
      row.append(element("span", item.email || t("editors")), revoke);
      $("editors").append(row);
    });
  }
  const intake = window.StudyHubIntake({
    state,
    request,
    run,
    newResource,
    setContent,
    content,
    preview,
    refresh,
    open,
    courseName,
    message,
  });
  $("resourceForm").addEventListener("submit", (e) => {
    e.preventDefault();
    run(() => act("save"));
  });
  $("resourceForm").addEventListener("input", (e) => {
    if (e.target.closest("#contentFields")) {
      state.dirty = true;
      preview();
    }
  });
  $("course_id").addEventListener("change", () => {
    $("courseProposal").hidden = $("course_id").value !== "new";
    for (const id of ["course_code", "college_id", "course_title"])
      $(id).required = $("course_id").value === "new";
  });
  $("queueSearch").addEventListener("input", renderQueue);
  $("queueFilter").addEventListener("change", renderQueue);
  $("newResource").onclick = () => {
    if (!state.dirty || confirm(t("unsaved"))) newResource();
  };
  $("refresh").onclick = () =>
    run(async () => {
      if (state.dirty && !confirm(t("unsaved"))) return;
      await refresh();
      if (state.selected) await open(state.selected.id);
      message(t("ready"));
    });
  $("grantForm").onsubmit = (e) => {
    e.preventDefault();
    run(async () => {
      await request("", {
        action: "grant_editor",
        payload: { email: $("editorEmail").value },
      });
      $("editorEmail").value = "";
      await editors();
      message(t("saved"));
    });
  };
  $("semestersForm").onsubmit = (e) => {
    e.preventDefault();
    run(async () => {
      await request("", {
        action: "semesters",
        version: state.settings.version,
        payload: {
          semesters: $("semesterValues")
            .value.split(/\n/)
            .map((v) => v.trim())
            .filter(Boolean),
        },
      });
      const boot = await request();
      state.settings = boot.settings;
      const selectedSemester = $("semester").value;
      options(
        "semester",
        state.settings.semesters.map((value) => [value, value]),
      );
      $("semester").value = selectedSemester;
      if (state.selected && !state.dirty) await open(state.selected.id);
      message(t("saved"));
    });
  };
  window.addEventListener("beforeunload", (e) => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  // No role decisions use editable profile metadata or the legacy admin-status RPC.
  run(async () => {
    if (!window.supabaseClient) throw new Error("sdk_unavailable");
    const boot = await request();
    Object.assign(state, boot);
    await refresh();
    populateOptions();
    $("app").hidden = false;
    $("labsAdminLink").hidden = !state.isAdmin;
    $("adminTools").hidden = !state.isAdmin;
    if (state.isAdmin) {
      $("semesterValues").value = state.settings.semesters.join("\n");
      await editors();
    }
    await intake.init();
    window.supabaseClient.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        $("app").hidden = true;
        $("signIn").hidden = false;
        message(t("signIn"));
      }
    });
    message(t("ready"));
  });
})();
