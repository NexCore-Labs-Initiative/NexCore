(function () {
  "use strict";
  window.StudyHubIntake = function (h) {
    const ar = document.documentElement.lang.startsWith("ar"),
      text = (en, arabic) => (ar ? arabic : en);
    const labels = {
      title: text("Title", "العنوان"),
      description: text("Description", "الوصف"),
      semester: text("Semester", "الفصل"),
      type: text("Resource type", "نوع المورد"),
      format: text("Format", "الصيغة"),
      languages: text("Languages", "اللغات"),
      topics: text("Topics", "الموضوعات"),
      drive_url: text("Drive link", "رابط Drive"),
      credit: text("Public credit", "الاسم العلني"),
      course: text("Course", "المقرر"),
      drive_key: text("Valid Drive link", "رابط Drive صالح"),
      terms: text("Terms acceptance", "الموافقة على الشروط"),
    };
    const el = (tag, value) => {
      const e = document.createElement(tag);
      if (value != null) e.textContent = value;
      return e;
    };
    const button = (en, arabic, fn) => {
      const b = el("button", text(en, arabic));
      b.type = "button";
      b.onclick = () => h.run(fn);
      return b;
    };
    const statuses = {
      pending: text("Pending submissions", "المساهمات المعلقة"),
      rejected: text("Rejected", "مرفوضة"),
      converted: text("Converted to draft", "حُولت إلى مسودة"),
    };
    const panel = el("section");
    panel.id = "submissionsPanel";
    panel.className = "panel intake";
    panel.hidden = true;
    const heading = el(
        "h2",
        text("Google Form submissions", "مساهمات نموذج Google"),
      ),
      count = el("span");
    heading.append(" · ", count);
    const toolbar = el("div");
    toolbar.className = "toolbar";
    const filter = el("select");
    filter.setAttribute(
      "aria-label",
      text("Submission status", "حالة المساهمة"),
    );
    Object.entries(statuses).forEach(([k, v]) => {
      const o = el("option", v);
      o.value = k;
      filter.append(o);
    });
    const queue = el("div");
    queue.className = "intake-queue";
    const notice = el("p");
    notice.setAttribute("role", "status");
    notice.className = "muted";
    const deliveryInfo = el("p");
    deliveryInfo.className = "muted";
    let offset = 0,
      next = null;
    const more = button("Next page", "الصفحة التالية", async () => {
      if (next) {
        offset = next;
        await load();
      }
    });
    const previous = button("Previous page", "الصفحة السابقة", async () => {
      offset = Math.max(0, offset - 25);
      await load();
    });
    const refresh = button("Refresh submissions", "تحديث المساهمات", () =>
      load(),
    );
    refresh.id = "refreshSubmissions";
    toolbar.append(filter, refresh);
    notice.textContent = text(
      "Responses arrive through Apps Script. Check the Sheet's NexCore Delivery Status column for failures; run retryPendingStudyHub in the Apps Script editor to recover pending deliveries.",
      "تصل المساهمات عبر Apps Script. راجع عمود NexCore Delivery Status في الجدول لمعرفة أخطاء التسليم، وشغّل retryPendingStudyHub من محرر Apps Script لاستعادة المساهمات المعلقة.",
    );
    panel.append(heading, toolbar, notice, deliveryInfo, queue, previous, more);
    document.getElementById("app").prepend(panel);
    const review = el("section");
    review.id = "submissionReview";
    review.hidden = true;
    const details = el("div"),
      notesLabel = el(
        "label",
        text("Private review notes", "ملاحظات المراجعة الخاصة"),
      ),
      notes = el("textarea");
    notes.id = "submissionNotes";
    notes.maxLength = 2000;
    notes.dir = "auto";
    notesLabel.append(notes);
    const acknowledgeLabel = el("label"),
      acknowledge = el("input");
    acknowledge.type = "checkbox";
    acknowledge.id = "acknowledgeSource";
    acknowledgeLabel.append(
      acknowledge,
      text(
        " I reviewed the latest source changes and kept or corrected the metadata below.",
        " راجعت تغييرات المصدر الأخيرة وأبقيت البيانات أدناه أو صححتها.",
      ),
    );
    review.append(details, acknowledgeLabel, notesLabel);
    document.getElementById("contentFields").before(review);
    function safeLink(url) {
      try {
        const u = new URL(url);
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
    async function load() {
      const data = await h.request(
        `?kind=submissions&status=${filter.value}&offset=${offset}`,
      );
      count.textContent = `${data.pending ?? 0}`;
      deliveryInfo.textContent = data.lastImportedAt
        ? text("Last imported submission: ", "آخر مساهمة مستوردة: ") +
          new Date(data.lastImportedAt).toLocaleString(ar ? "ar-OM" : "en-GB")
        : text("No submissions have arrived yet.", "لم تصل أي مساهمات بعد.");
      next = data.nextOffset;
      more.hidden = next === null;
      previous.hidden = offset === 0;
      queue.replaceChildren();
      data.items.forEach((item) => {
        const c = item.review_content,
          b = button(
            c.title || text("Untitled submission", "مساهمة بلا عنوان"),
            c.title || "مساهمة بلا عنوان",
            async () => {
              if (
                h.state.dirty &&
                !confirm(
                  text(
                    "Discard unsaved edits?",
                    "تجاهل التعديلات غير المحفوظة؟",
                  ),
                )
              )
                return;
              await show(item.id);
            },
          );
        b.className = "queue-item";
        b.append(
          el(
            "small",
            [
              c.course_proposal?.code || h.courseName(c.course_id),
              c.type,
              c.format,
              c.languages?.join(" / "),
              new Date(item.submitted_at).toLocaleString(
                ar ? "ar-OM" : "en-GB",
              ),
            ]
              .filter(Boolean)
              .join(" · "),
          ),
        );
        if (item.source_changed)
          b.append(el("strong", text("Source changed", "تغير المصدر")));
        queue.append(b);
      });
      if (!data.items.length)
        queue.append(
          el(
            "p",
            text(
              "No submissions in this queue.",
              "لا توجد مساهمات في هذه القائمة.",
            ),
          ),
        );
    }
    async function show(id) {
      const s = await h.request(
        "?kind=submission&id=" + encodeURIComponent(id),
      );
      h.newResource();
      h.state.submission = s;
      h.setContent(s.review_content);
      h.state.dirty = false;
      document.getElementById("editorHeading").textContent = text(
        "Review submission",
        "مراجعة المساهمة",
      );
      document.getElementById("workflowStatus").textContent =
        statuses[s.status];
      review.hidden = false;
      notes.value = s.review_notes;
      acknowledge.checked = false;
      acknowledgeLabel.hidden = !s.source_changed;
      details.replaceChildren();
      details.append(
        el("p", `${text("Submitted by", "أرسلها")}: ${s.submitter_name}`),
        el("p", s.submitter_note),
        el(
          "p",
          text("Public credit consent: ", "الموافقة على إظهار الاسم: ") +
            (s.credit_consent ? text("Yes", "نعم") : text("No", "لا")),
        ),
        el(
          "p",
          text("Terms accepted: ", "الموافقة على الشروط: ") +
            (s.terms_accepted ? text("Yes", "نعم") : text("No", "لا")),
        ),
      );
      if (s.validation_issues.length)
        details.append(
          el(
            "p",
            text("Source needs review: ", "المصدر يحتاج مراجعة: ") +
              s.validation_issues
                .map((k) => labels[k] || text("Metadata", "البيانات"))
                .join("، "),
          ),
        );
      const source = el("details"),
        summary = el(
          "summary",
          text("Latest source metadata", "أحدث بيانات المصدر"),
        );
      source.append(summary);
      for (const key of Object.keys(labels)) {
        const v =
          key === "course"
            ? s.source_content.course_proposal?.code ||
              h.courseName(s.source_content.course_id)
            : s.source_content[key];
        if (v)
          source.append(
            el("p", `${labels[key]}: ${Array.isArray(v) ? v.join("، ") : v}`),
          );
      }
      details.append(source);
      const url = safeLink(s.source_content.drive_url);
      if (url) {
        const a = el(
          "a",
          text("Open submitted Drive link", "فتح رابط Drive المرسل"),
        );
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        details.append(a);
      }
      notes.disabled = s.status !== "pending";
      acknowledge.disabled = s.status !== "pending";
      h.preview();
      actions();
      document
        .getElementById("editorPanel")
        .scrollIntoView({ block: "start", behavior: "smooth" });
    }
    function actions() {
      const s = h.state.submission;
      if (!s) return false;
      const target = document.getElementById("actions");
      target.replaceChildren();
      document.getElementById("contentFields").disabled =
        h.state.busy || s.status !== "pending";
      if (s.status === "pending") {
        target.append(
          button("Save review", "حفظ المراجعة", () => act("save")),
          button("Reject submission", "رفض المساهمة", () => act("reject")),
          button("Approve into draft", "اعتماد وإنشاء مسودة", () =>
            act("convert"),
          ),
        );
      } else if (s.status === "rejected")
        target.append(
          button("Reopen submission", "إعادة فتح المساهمة", () =>
            act("reopen"),
          ),
        );
      if (s.resource_id)
        target.append(
          button("Open resource draft", "فتح مسودة المورد", () =>
            h.open(s.resource_id),
          ),
        );
      target.querySelectorAll("button").forEach((b) => {
        b.disabled = h.state.busy;
      });
      return true;
    }
    async function act(action) {
      const s = h.state.submission;
      if (!s) return;
      if (
        ["reject", "convert"].includes(action) &&
        !confirm(text("Confirm this review action?", "تأكيد إجراء المراجعة؟"))
      )
        return;
      const payload = {
        content: h.content(),
        note: notes.value,
        acknowledge_source: acknowledge.checked,
      };
      const result = await h.request("", {
        action: "submission_" + action,
        id: s.id,
        version: s.version,
        payload,
      });
      h.state.dirty = false;
      await load();
      if (action === "convert") {
        await h.refresh();
        await h.open(result.resource_id);
        h.message(
          text(
            "Approved into a private draft. Submit it for review before publishing.",
            "تم الاعتماد وإنشاء مسودة خاصة. أرسلها للمراجعة قبل النشر.",
          ),
        );
      } else {
        await show(s.id);
        h.message(text("Review saved.", "حُفظت المراجعة."));
      }
    }
    function errorText(e) {
      const messages = {
        source_review_required: [
          "Review and acknowledge the changed source before approval.",
          "راجع تغيرات المصدر وأكد ذلك قبل الاعتماد.",
        ],
        terms_required: [
          "The source does not confirm acceptance of the contribution terms.",
          "المصدر لا يؤكد الموافقة على شروط المساهمة.",
        ],
        credit_not_consented: [
          "Remove public credit: this contributor did not consent.",
          "أزل الاسم العلني: المساهم لم يوافق على إظهاره.",
        ],
        duplicate_drive_resource: [
          "This Drive resource already exists. Open it from the resource queue.",
          "مورد Drive هذا موجود مسبقًا. افتحه من قائمة الموارد.",
        ],
        invalid_response_id: [
          "Missing or invalid permanent submission ID. Repair IDs in the Sheet.",
          "معرف المساهمة الدائم مفقود أو غير صالح. أصلح المعرفات في الجدول.",
        ],
        duplicate_response_id: [
          "Duplicated submission ID in the Sheet. Resolve it before retrying.",
          "معرف مساهمة مكرر في الجدول. عالجه قبل إعادة المحاولة.",
        ],
        invalid_timestamp: [
          "Timestamp must be a real Google Sheets date.",
          "يجب أن يكون الوقت تاريخًا فعليًا في Google Sheets.",
        ],
        invalid_cell: [
          "A source field is too long or has an invalid value.",
          "حقل بالمصدر طويل جدًا أو قيمته غير صالحة.",
        ],
        database_failure: [
          "Database write failed; retry the operation.",
          "فشلت الكتابة في قاعدة البيانات؛ أعد المحاولة.",
        ],
        sync_database_failure: [
          "The submission database is unavailable. Verify the migration and retry.",
          "قاعدة المساهمات غير متاحة. تحقق من الترحيل وحاول مجددًا.",
        ],
        submission_unavailable: [
          "Submissions are unavailable. Verify the intake migration and server setup.",
          "المساهمات غير متاحة. تحقق من ترحيل قاعدة البيانات وإعداد الخادم.",
        ],
      };
      return (
        messages[e.code]?.[ar ? 1 : 0] ||
        (e.status === 422
          ? text(
              "Complete the required metadata before approval.",
              "أكمل البيانات المطلوبة قبل الاعتماد.",
            )
          : text(
              "The operation failed. Retry after checking setup.",
              "فشلت العملية. تحقق من الإعداد ثم حاول مجددًا.",
            ))
      );
    }
    filter.onchange = () =>
      h.run(async () => {
        offset = 0;
        await load();
      });
    notes.oninput = acknowledge.onchange = () => {
      h.state.dirty = true;
    };
    return {
      init: async () => {
        panel.hidden = !h.state.isAdmin;
        if (h.state.isAdmin) {
          try {
            await load();
          } catch (e) {
            notice.textContent = errorText(e);
          }
        }
      },
      actions,
      act,
      errorText,
      clear: () => {
        h.state.submission = null;
        review.hidden = true;
      },
      lock: () => {
        if (h.state.submission) {
          const disabled =
            h.state.busy || h.state.submission.status !== "pending";
          document.getElementById("contentFields").disabled = disabled;
          notes.disabled = disabled;
          acknowledge.disabled = disabled;
        }
      },
    };
  };
})();
