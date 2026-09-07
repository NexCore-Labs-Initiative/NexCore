(function () {
  "use strict";
  const form = document.getElementById("career-form");
  if (!form) return;
  const ar = document.documentElement.lang.startsWith("ar");
  const text = (en, arabic) => ar ? arabic : en;
  const role = form.elements.role;
  const submit = form.querySelector('[type="submit"]');
  const status = document.getElementById("career-status");
  const fields = [...form.querySelectorAll("input, select, textarea")];
  form.noValidate = true;
  submit.disabled = false;
  let sending = false;
  function updateQuestion() {
    document.getElementById("role-question").textContent = role.value === "social-media"
      ? text("What is one post idea you would use to introduce NexCore to students?", "ما فكرة المنشور الذي ستستخدمه لتعريف الطلبة بـ NexCore؟")
      : text("How would you help more SQU students discover and try NexCore?", "كيف ستساعد المزيد من طلبة الجامعة على اكتشاف NexCore وتجربتها؟");
  }
  role.addEventListener("change", updateQuestion);
  document.querySelectorAll("[data-apply-role]").forEach(link => link.addEventListener("click", () => {
    if (sending) return;
    role.value = link.dataset.applyRole;
    updateQuestion();
    form.elements.full_name.focus({ preventScroll: true });
  }));
  function validate(field) {
    let message = "";
    const value = field.value.trim();
    if (field.required && (field.type === "checkbox" ? !field.checked : !value)) message = text("This field is required.", "هذا الحقل مطلوب.");
    else if (field.name === "email" && !/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*squ\.edu\.om$/i.test(value)) message = text("Use your SQU email address (squ.edu.om).", "استخدم بريدك الجامعي على نطاق squ.edu.om.");
    else if (field.name === "portfolio_url" && value) {
      try { const url = new URL(value); if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error(); }
      catch (_) { message = text("Enter a complete http or https link.", "أدخل رابطًا كاملًا يبدأ بـ http أو https."); }
    }
    if (!message && field.maxLength > 0 && value.length > field.maxLength) message = text("Please shorten your answer.", "يرجى اختصار الإجابة.");
    field.classList.toggle("is-invalid", !!message);
    field.setAttribute("aria-invalid", String(!!message));
    document.getElementById(`${field.id}-error`).textContent = message;
    return !message;
  }
  fields.forEach(field => field.addEventListener("input", () => {
    if (field.getAttribute("aria-invalid") === "true") validate(field);
  }));
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (sending) return;
    const invalid = fields.filter(field => !validate(field));
    if (invalid.length) {
      status.textContent = text("Please check the highlighted fields.", "يرجى مراجعة الحقول المحددة.");
      invalid[0].focus();
      return;
    }
    const payload = Object.fromEntries(new FormData(form));
    payload.consent = form.elements.consent.checked;
    sending = true;
    fields.forEach(field => { field.disabled = true; });
    submit.disabled = true;
    submit.setAttribute("aria-busy", "true");
    submit.textContent = text("Sending…", "جارٍ الإرسال…");
    status.textContent = "";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch("/api/career-applications", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal
      });
      if (!response.ok) {
        const error = new Error(); error.status = response.status; throw error;
      }
      const result = await response.json();
      if (result.ok !== true) throw new Error();
      form.reset(); updateQuestion();
      status.textContent = text("Application received. Thank you for your interest in building with NexCore!", "وصل طلبك. شكرًا لاهتمامك بالانضمام إلى فريق NexCore!");
      window.showToast?.(status.textContent, "success");
    } catch (error) {
      status.textContent = error.status === 429
        ? text("Too many attempts. Please wait 10 minutes before trying again. Your answers are still here.", "محاولات كثيرة. يرجى الانتظار 10 دقائق قبل المحاولة مجددًا. إجاباتك ما زالت هنا.")
        : error.name === "AbortError"
          ? text("We could not confirm receipt. Your application may have arrived; please wait before trying again. Your answers are still here.", "تعذر تأكيد الاستلام. ربما وصل طلبك؛ يرجى الانتظار قبل إعادة المحاولة. إجاباتك ما زالت هنا.")
          : text("We could not submit your application. Your answers are still here; please try again shortly.", "تعذر إرسال طلبك. إجاباتك ما زالت هنا؛ يرجى المحاولة بعد قليل.");
      window.showToast?.(status.textContent, "error");
    } finally {
      clearTimeout(timeout); sending = false;
      fields.forEach(field => { field.disabled = false; });
      submit.disabled = false; submit.removeAttribute("aria-busy");
      submit.textContent = text("Submit application", "إرسال الطلب");
    }
  });
  updateQuestion();
})();
