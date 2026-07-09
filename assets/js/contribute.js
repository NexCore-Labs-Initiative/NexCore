(function () {
  "use strict";

  const isArabic = document.documentElement.lang.toLowerCase().startsWith("ar");
  const locale = isArabic ? "ar" : "en";
  const prefix = isArabic ? "../" : "";
  const cleanPrefix = isArabic ? "/ar" : "";
  const text = (en, ar) => (isArabic ? ar : en);
  const byId = (id) => document.getElementById(id);

  const paths = Object.freeze([
    {
      id: "share-project",
      category: "share",
      icon: "fa-solid fa-diagram-project",
      kind: { en: "Share", ar: "شارك" },
      title: { en: "Publish your project", ar: "انشر مشروعك" },
      description: {
        en: "Create a project profile, explain what you built, and make useful student work easier for the SQU community to discover.",
        ar: "أنشئ ملفًا لمشروعك، واشرح ما بنيته، واجعل أعمال الطلبة المفيدة أسهل اكتشافًا لمجتمع جامعة السلطان قابوس."
      },
      meta: [{ en: "Project owners", ar: "أصحاب المشاريع" }, { en: "15–25 min", ar: "15–25 دقيقة" }],
      href: `${cleanPrefix}/dashboard`,
      cta: { en: "Create a project", ar: "أنشئ مشروعًا" }
    },
    {
      id: "shape-roadmap",
      category: "shape",
      icon: "fa-solid fa-lightbulb",
      kind: { en: "Shape", ar: "ساهم برأيك" },
      title: { en: "Suggest an improvement", ar: "اقترح تحسينًا" },
      description: {
        en: "Share a focused feature idea, vote on community requests, and follow what moves from planned to shipped.",
        ar: "شارك فكرة ميزة محددة، وصوّت على طلبات المجتمع، وتابع ما ينتقل من التخطيط إلى الإطلاق."
      },
      meta: [{ en: "Everyone", ar: "للجميع" }, { en: "5 min", ar: "5 دقائق" }],
      href: `${cleanPrefix}/roadmap?action=suggest`,
      cta: { en: "Suggest an idea", ar: "اقترح فكرة" }
    },
    {
      id: "explore-initiatives",
      category: "build",
      icon: "fa-solid fa-wand-magic-sparkles",
      kind: { en: "Build", ar: "ابنِ" },
      title: { en: "Find an initiative to support", ar: "اعثر على مبادرة لدعمها" },
      description: {
        en: "Understand what NexCore Labs is launching, building, and exploring before offering the skill or perspective that fits.",
        ar: "تعرّف على ما تطلقه NexCore Labs وما تبنيه وتستكشفه قبل تقديم المهارة أو المنظور المناسب."
      },
      meta: [{ en: "Collaborators", ar: "المتعاونون" }, { en: "Explore first", ar: "ابدأ بالاستكشاف" }],
      href: `${cleanPrefix}/initiatives`,
      cta: { en: "Explore initiatives", ar: "استكشف المبادرات" }
    },
    {
      id: "improve-code",
      category: "build",
      icon: "fa-brands fa-github",
      kind: { en: "Build", ar: "ابنِ" },
      title: { en: "Improve the NexCore codebase", ar: "حسّن قاعدة شيفرة NexCore" },
      description: {
        en: "Review the open-source repository, report a reproducible issue, or propose a focused code improvement through GitHub.",
        ar: "راجع المستودع مفتوح المصدر، أو أبلغ عن مشكلة قابلة للتكرار، أو اقترح تحسينًا محددًا للشيفرة عبر GitHub."
      },
      meta: [{ en: "Developers", ar: "المطورون" }, { en: "Open source", ar: "مفتوح المصدر" }],
      href: "https://github.com/NexCoreLabs/NexCore",
      external: true,
      cta: { en: "Open GitHub", ar: "افتح GitHub" }
    },
    {
      id: "test-experience",
      category: "test",
      icon: "fa-solid fa-universal-access",
      kind: { en: "Test", ar: "اختبر" },
      title: { en: "Test the community experience", ar: "اختبر تجربة المجتمع" },
      description: {
        en: "Use NexCore in English or Arabic, then turn accessibility, clarity, or mobile issues into a focused roadmap suggestion.",
        ar: "استخدم NexCore بالعربية أو الإنجليزية، ثم حوّل مشكلات الوصول أو الوضوح أو الهاتف إلى اقتراح محدد في خارطة الطريق."
      },
      meta: [{ en: "Testers", ar: "المختبرون" }, { en: "EN + AR", ar: "عربي + إنجليزي" }],
      href: `${cleanPrefix}/roadmap?action=suggest`,
      cta: { en: "Report an improvement", ar: "أبلغ عن تحسين" }
    },
    {
      id: "support-community",
      category: "share",
      icon: "fa-solid fa-people-group",
      kind: { en: "Share", ar: "شارك" },
      title: { en: "Help useful work get noticed", ar: "ساعد الأعمال المفيدة على الظهور" },
      description: {
        en: "Browse published projects, share the ones that solve real problems, and help more students find practical work from their peers.",
        ar: "تصفّح المشاريع المنشورة، وشارك ما يحل مشكلات حقيقية، وساعد مزيدًا من الطلبة على اكتشاف أعمال عملية من زملائهم."
      },
      meta: [{ en: "Community", ar: "المجتمع" }, { en: "Any time", ar: "في أي وقت" }],
      href: `${cleanPrefix}/hub#projects`,
      cta: { en: "Browse projects", ar: "تصفّح المشاريع" }
    }
  ]);

  const copy = {
    filters: {
      all: text("All paths", "كل المسارات"),
      build: text("Build", "البناء"),
      test: text("Test", "الاختبار"),
      share: text("Share", "المشاركة"),
      shape: text("Shape", "إبداء الرأي")
    },
    signInTitle: text("Your contribution story starts here", "تبدأ قصة مساهمتك من هنا"),
    signInBody: text("Sign in to see your submitted projects and roadmap ideas together in one place.", "سجّل الدخول لترى مشاريعك وأفكار خارطة الطريق التي أرسلتها معًا في مكان واحد."),
    signIn: text("Sign in", "تسجيل الدخول"),
    activityTitle: text("Your contribution activity", "نشاط مساهماتك"),
    activityBody: text("A live view of the work and ideas you have shared with NexCore.", "عرض مباشر للأعمال والأفكار التي شاركتها مع NexCore."),
    projects: text("Projects", "المشاريع"),
    ideas: text("Ideas", "الأفكار"),
    shipped: text("Shipped", "المُطلقة"),
    recent: text("Recent submissions", "أحدث المشاركات"),
    viewAll: text("Open dashboard", "افتح لوحة التحكم"),
    emptyTitle: text("No submissions yet", "لا توجد مشاركات بعد"),
    emptyBody: text("Choose one contribution path above and your activity will appear here.", "اختر أحد مسارات المساهمة أعلاه وسيظهر نشاطك هنا."),
    loading: text("Loading your activity…", "جارٍ تحميل نشاطك…"),
    unavailable: text("Your activity could not be loaded right now.", "تعذر تحميل نشاطك الآن."),
    project: text("Project", "مشروع"),
    idea: text("Roadmap idea", "فكرة خارطة طريق"),
    filtersLabel: text("Filter contribution paths", "تصفية مسارات المساهمة")
  };

  const state = { activeFilter: "all" };

  function renderFilters() {
    const container = byId("contributeFilters");
    if (!container) return;
    container.setAttribute("aria-label", copy.filtersLabel);
    container.replaceChildren(...Object.entries(copy.filters).map(([value, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "contribute-filter";
      button.dataset.filter = value;
      button.setAttribute("aria-pressed", String(value === state.activeFilter));
      button.textContent = label;
      return button;
    }));
  }

  function createPathCard(path) {
    const article = document.createElement("article");
    article.className = "contribute-card";
    article.dataset.category = path.category;
    article.dataset.pathId = path.id;

    const top = document.createElement("div");
    top.className = "contribute-card-top";
    const icon = document.createElement("span");
    icon.className = "contribute-card-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = `<i class="${path.icon}"></i>`;
    const kind = document.createElement("span");
    kind.className = "contribute-card-kind";
    kind.textContent = path.kind[locale];
    top.append(icon, kind);

    const title = document.createElement("h3");
    title.textContent = path.title[locale];
    const description = document.createElement("p");
    description.textContent = path.description[locale];
    const meta = document.createElement("div");
    meta.className = "contribute-card-meta";
    path.meta.forEach((item) => {
      const tag = document.createElement("span");
      tag.textContent = item[locale];
      meta.append(tag);
    });
    const link = document.createElement("a");
    link.className = "btn ghost";
    link.href = path.href;
    if (path.external) {
      link.target = "_blank";
      link.rel = "noopener";
    }
    link.innerHTML = `<i class="${path.external ? "fa-solid fa-arrow-up-right-from-square" : "fa-solid fa-arrow-right"}" aria-hidden="true"></i> ${path.cta[locale]}`;
    article.append(top, title, description, meta, link);
    return article;
  }

  function renderPaths() {
    const grid = byId("contributeGrid");
    if (!grid) return;
    const visible = paths.filter((path) => state.activeFilter === "all" || path.category === state.activeFilter);
    grid.replaceChildren(...visible.map(createPathCard));
  }

  function bindFilters() {
    byId("contributeFilters")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter]");
      if (!button || button.dataset.filter === state.activeFilter) return;
      state.activeFilter = button.dataset.filter;
      renderFilters();
      renderPaths();
    });
  }

  function safeStatus(value, fallback) {
    const status = String(value || fallback || "").trim().toLowerCase().replace(/[^a-z_\-]/g, "");
    return status || "draft";
  }

  function statusLabel(status) {
    const labels = {
      draft: text("Draft", "مسودة"),
      pending: text("Pending", "قيد المراجعة"),
      approved: text("Approved", "معتمد"),
      published: text("Published", "منشور"),
      planned: text("Planned", "مخطط"),
      in_progress: text("In progress", "قيد التنفيذ"),
      completed: text("Shipped", "تم الإطلاق")
    };
    return labels[status] || status.replace(/[_-]/g, " ");
  }

  function renderSignedOut() {
    const panel = byId("activityPanel");
    if (!panel) return;
    panel.innerHTML = `
      <div class="activity-overview">
        <span class="activity-kicker"><i class="fa-solid fa-handshake-angle" aria-hidden="true"></i> ${text("Member view", "عرض العضو")}</span>
        <h3>${copy.signInTitle}</h3>
        <p>${copy.signInBody}</p>
        <a class="btn primary" href="${prefix}auth.html"><i class="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i> ${copy.signIn}</a>
      </div>
      <div class="activity-feed"><div class="activity-message"><i class="fa-solid fa-chart-line" aria-hidden="true"></i><p>${copy.signInBody}</p></div></div>`;
  }

  function renderLoading() {
    const panel = byId("activityPanel");
    if (!panel) return;
    panel.innerHTML = `<div class="activity-message" style="grid-column:1/-1"><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i><p>${copy.loading}</p></div>`;
  }

  function createActivityItem(item) {
    const row = document.createElement("div");
    row.className = "activity-item";
    const icon = document.createElement("span");
    icon.className = "activity-item-icon";
    icon.innerHTML = `<i class="${item.type === "project" ? "fa-solid fa-diagram-project" : "fa-solid fa-lightbulb"}" aria-hidden="true"></i>`;
    const body = document.createElement("div");
    const title = document.createElement("div");
    title.className = "activity-item-title";
    title.textContent = item.title;
    const meta = document.createElement("div");
    meta.className = "activity-item-meta";
    meta.textContent = `${item.type === "project" ? copy.project : copy.idea} · ${new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(item.date))}`;
    body.append(title, meta);
    const status = document.createElement("span");
    status.className = `activity-status activity-status--${item.status}`;
    status.textContent = statusLabel(item.status);
    row.append(icon, body, status);
    return row;
  }

  function renderActivity(user, projects, ideas) {
    const panel = byId("activityPanel");
    if (!panel) return;
    const shipped = ideas.filter((idea) => idea.status === "completed").length;
    const name = String(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || text("Member", "عضو"));
    const items = [
      ...projects.map((project) => ({
        type: "project",
        title: project.name || text("Untitled project", "مشروع بلا عنوان"),
        status: safeStatus(project.published ? "published" : project.moderation_status, "draft"),
        date: project.updated_at || project.created_at || new Date().toISOString()
      })),
      ...ideas.map((idea) => ({
        type: "idea",
        title: idea.title || text("Untitled idea", "فكرة بلا عنوان"),
        status: safeStatus(idea.status, "planned"),
        date: idea.created_at || new Date().toISOString()
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

    panel.innerHTML = `
      <div class="activity-overview">
        <span class="activity-kicker"><i class="fa-solid fa-chart-line" aria-hidden="true"></i> ${text("Member view", "عرض العضو")}</span>
        <h3>${copy.activityTitle}</h3>
        <p>${name}, ${copy.activityBody.charAt(0).toLocaleLowerCase(locale)}${copy.activityBody.slice(1)}</p>
        <div class="activity-stats">
          <div class="activity-stat"><strong>${projects.length}</strong><span>${copy.projects}</span></div>
          <div class="activity-stat"><strong>${ideas.length}</strong><span>${copy.ideas}</span></div>
          <div class="activity-stat"><strong>${shipped}</strong><span>${copy.shipped}</span></div>
        </div>
      </div>
      <div class="activity-feed">
        <div class="activity-feed-head"><h3>${copy.recent}</h3><a class="activity-link" href="${prefix}dashboard.html">${copy.viewAll}</a></div>
        <div id="activityList" class="activity-list"></div>
      </div>`;

    const list = byId("activityList");
    if (!items.length) {
      list.innerHTML = `<div class="activity-message"><i class="fa-regular fa-folder-open" aria-hidden="true"></i><strong>${copy.emptyTitle}</strong><p>${copy.emptyBody}</p></div>`;
      return;
    }
    list.replaceChildren(...items.map(createActivityItem));
  }

  async function loadActivity() {
    const db = window.supabaseClient;
    if (!db) {
      renderSignedOut();
      return;
    }
    renderLoading();
    try {
      const { data: { session } } = await db.auth.getSession();
      if (!session?.user) {
        renderSignedOut();
        return;
      }
      const [projectsResult, ideasResult] = await Promise.all([
        db.from("projects").select("id,name,slug,published,moderation_status,created_at,updated_at").eq("owner_user_id", session.user.id),
        db.from("features").select("id,title,status,votes_count,created_at").eq("created_by", session.user.id)
      ]);
      if (projectsResult.error || ideasResult.error) throw projectsResult.error || ideasResult.error;
      renderActivity(session.user, projectsResult.data || [], ideasResult.data || []);
    } catch (error) {
      console.warn("Contributor activity unavailable:", error?.message || error);
      const panel = byId("activityPanel");
      if (panel) panel.innerHTML = `<div class="activity-message" style="grid-column:1/-1"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><p>${copy.unavailable}</p></div>`;
    }
  }

  function init() {
    const year = byId("year");
    if (year) year.textContent = new Date().getFullYear();
    renderFilters();
    renderPaths();
    bindFilters();
    loadActivity();
  }

  window.ContributorCenter = Object.freeze({ paths, safeStatus, statusLabel });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
}());
