(function () {
  "use strict";

  const form = document.getElementById("newsletter-form");
  if (!form) return;

  const emailInput = document.getElementById("newsletter-email");
  const honeypot = document.getElementById("newsletter-company");
  const submitButton = document.getElementById("newsletter-submit");
  const manageButton = document.getElementById("newsletter-manage");
  const confirmation = document.getElementById("newsletter-unsubscribe-confirmation");
  const confirmUnsubscribeButton = document.getElementById("newsletter-confirm-unsubscribe");
  const message = document.getElementById("newsletter-message");
  const isArabic = document.documentElement.lang.toLowerCase().startsWith("ar");
  const statusTimers = new Map();
  let mode = "subscribe";
  let preparedEmail = "";

  const copy = isArabic ? {
    subscribe: "اشترك",
    subscribing: "جارٍ الاشتراك...",
    subscribed: "تم الاشتراك",
    alreadySubscribed: "أنت مشترك بالفعل",
    manage: "إدارة الاشتراك",
    backToSubscribe: "العودة إلى الاشتراك",
    check: "تحقق من البريد",
    checking: "جارٍ التحقق...",
    ready: "جاهز لتأكيد الإلغاء",
    unsubscribe: "إلغاء الاشتراك",
    unsubscribing: "جارٍ إلغاء الاشتراك...",
    updated: "تم تحديث التفضيلات",
    invalid: "أدخل بريدًا إلكترونيًا صالحًا",
    success: "تم اشتراكك بنجاح.",
    duplicate: "أنت مشترك بالفعل.",
    unsubscribed: "تم تحديث تفضيلات اشتراكك.",
    failed: "تعذر إتمام الاشتراك",
    unsubscribeFailed: "تعذر تحديث التفضيلات"
  } : {
    subscribe: "Subscribe",
    subscribing: "Subscribing...",
    subscribed: "Subscribed",
    alreadySubscribed: "Already subscribed",
    manage: "Manage subscription",
    backToSubscribe: "Back to subscribe",
    check: "Check email",
    checking: "Checking...",
    ready: "Ready to unsubscribe",
    unsubscribe: "Unsubscribe",
    unsubscribing: "Unsubscribing...",
    updated: "Preferences updated",
    invalid: "Enter a valid email",
    success: "You're subscribed successfully.",
    duplicate: "You're already subscribed.",
    unsubscribed: "Your subscription preferences have been updated.",
    failed: "Failed to subscribe",
    unsubscribeFailed: "Failed to update"
  };

  function setMessage(text) {
    message.textContent = text;
  }

  function notify(messageText, type) {
    if (window.NexCoreNotify?.show) {
      window.NexCoreNotify.show({ message: messageText, type });
    } else if (window.showToast) {
      window.showToast(messageText, type);
    }
  }

  function clearStatusTimer(button) {
    const timer = statusTimers.get(button);
    if (timer) window.clearTimeout(timer);
    statusTimers.delete(button);
  }

  function setButtonStatus(button, label, state) {
    const labelElement = button.querySelector(".newsletter-status-label");
    clearStatusTimer(button);
    button.dataset.newsletterState = state || "";
    button.setAttribute("aria-busy", String(state === "loading"));
    labelElement.textContent = label;
    labelElement.classList.remove("is-changing");
    void labelElement.offsetWidth;
    labelElement.classList.add("is-changing");
  }

  function defaultSubmitLabel() {
    return mode === "manage" ? copy.check : copy.subscribe;
  }

  function restoreButton(button, label) {
    setButtonStatus(button, label, "");
  }

  function restoreButtonAfter(button, label, duration) {
    clearStatusTimer(button);
    statusTimers.set(button, window.setTimeout(() => {
      restoreButton(button, label());
      statusTimers.delete(button);
      setMessage("");
    }, duration));
  }

  function setConfirmationVisible(visible) {
    confirmation.hidden = !visible;
    confirmation.setAttribute("aria-hidden", String(!visible));
  }

  function setMode(nextMode) {
    mode = nextMode;
    preparedEmail = "";
    form.dataset.newsletterMode = mode;
    manageButton.setAttribute("aria-expanded", String(mode === "manage"));
    manageButton.textContent = mode === "manage" ? copy.backToSubscribe : copy.manage;
    submitButton.disabled = false;
    confirmUnsubscribeButton.disabled = false;
    restoreButton(submitButton, defaultSubmitLabel());
    restoreButton(confirmUnsubscribeButton, copy.unsubscribe);
    setConfirmationVisible(false);
    setMessage("");
  }

  function setLoading(isLoading, button, label) {
    submitButton.disabled = isLoading;
    manageButton.disabled = isLoading;
    confirmUnsubscribeButton.disabled = isLoading;
    emailInput.readOnly = isLoading;
    form.setAttribute("aria-busy", String(isLoading));
    if (isLoading) setButtonStatus(button, label, "loading");
  }

  function setEmailValidity() {
    const invalid = !emailInput.value.trim() || !emailInput.checkValidity();
    emailInput.classList.toggle("is-invalid", invalid);
    emailInput.setAttribute("aria-invalid", String(invalid));
    return invalid;
  }

  function showInvalidEmail() {
    setButtonStatus(submitButton, copy.invalid, "invalid");
    setMessage(copy.invalid);
  }

  async function sendRequest(action, email) {
    const response = await fetch("/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, email, company: honeypot.value })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Newsletter request failed");
    return result;
  }

  function resetToSubscribe() {
    form.reset();
    setMode("subscribe");
  }

  function showPreparedConfirmation(email) {
    preparedEmail = email;
    setConfirmationVisible(true);
    setButtonStatus(submitButton, copy.ready, "success");
    submitButton.disabled = true;
    setMessage(copy.ready);
  }

  manageButton.addEventListener("click", () => {
    setMode(mode === "manage" ? "subscribe" : "manage");
    emailInput.focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim().toLowerCase();
    emailInput.value = email;
    setMessage("");
    form.dataset.validationAttempted = "true";

    if (setEmailValidity()) {
      showInvalidEmail();
      emailInput.focus();
      return;
    }

    if (honeypot.value.trim()) {
      if (mode === "manage") {
        showPreparedConfirmation(email);
      } else {
        setButtonStatus(submitButton, copy.subscribed, "success");
        restoreButtonAfter(submitButton, defaultSubmitLabel, 1800);
      }
      return;
    }

    const isManaging = mode === "manage";
    setLoading(true, submitButton, isManaging ? copy.checking : copy.subscribing);

    try {
      const result = await sendRequest(isManaging ? "prepare_unsubscribe" : "subscribe", email);

      if (isManaging) {
        if (result.status !== "ready") throw new Error("Unexpected preparation response");
        showPreparedConfirmation(email);
        return;
      }

      if (result.status === "already_subscribed") {
        setButtonStatus(submitButton, copy.alreadySubscribed, "success");
        setMessage(copy.duplicate);
        restoreButtonAfter(submitButton, defaultSubmitLabel, 2600);
        return;
      }

      setButtonStatus(submitButton, copy.subscribed, "success");
      setMessage(copy.success);
      notify(copy.success, "success");
      form.reset();
      restoreButtonAfter(submitButton, defaultSubmitLabel, 1800);
    } catch (error) {
      console.error("Unexpected newsletter request error:", error);
      setButtonStatus(submitButton, isManaging ? copy.unsubscribeFailed : copy.failed, "error");
      setMessage(isManaging ? copy.unsubscribeFailed : copy.failed);
      restoreButtonAfter(submitButton, defaultSubmitLabel, 2600);
    } finally {
      setLoading(false);
      if (isManaging && preparedEmail) submitButton.disabled = true;
    }
  });

  confirmUnsubscribeButton.addEventListener("click", async () => {
    const email = emailInput.value.trim().toLowerCase();
    emailInput.value = email;

    if (!preparedEmail || email !== preparedEmail || setEmailValidity()) {
      setConfirmationVisible(false);
      preparedEmail = "";
      submitButton.disabled = false;
      showInvalidEmail();
      emailInput.focus();
      return;
    }

    let completed = false;
    setLoading(true, confirmUnsubscribeButton, copy.unsubscribing);
    try {
      const result = await sendRequest("unsubscribe", email);
      if (result.status !== "unsubscribed") throw new Error("Unexpected unsubscribe response");
      setButtonStatus(confirmUnsubscribeButton, copy.updated, "success");
      setMessage(copy.unsubscribed);
      notify(copy.unsubscribed, "success");
      completed = true;
      window.setTimeout(resetToSubscribe, 1200);
    } catch (error) {
      console.error("Unexpected newsletter unsubscribe error:", error);
      setButtonStatus(confirmUnsubscribeButton, copy.unsubscribeFailed, "error");
      setMessage(copy.unsubscribeFailed);
      restoreButtonAfter(confirmUnsubscribeButton, () => copy.unsubscribe, 2600);
    } finally {
      setLoading(false);
      if (completed) confirmUnsubscribeButton.disabled = true;
    }
  });

  emailInput.addEventListener("input", () => {
    if (preparedEmail && emailInput.value.trim().toLowerCase() !== preparedEmail) {
      preparedEmail = "";
      setConfirmationVisible(false);
      submitButton.disabled = false;
      restoreButton(submitButton, defaultSubmitLabel());
    }
    if (form.dataset.validationAttempted !== "true") return;
    if (setEmailValidity()) {
      showInvalidEmail();
      return;
    }
    if (!preparedEmail) {
      restoreButton(submitButton, defaultSubmitLabel());
      setMessage("");
    }
  });

  form.addEventListener("reset", () => {
    delete form.dataset.validationAttempted;
    emailInput.classList.remove("is-invalid");
    emailInput.setAttribute("aria-invalid", "false");
    preparedEmail = "";
    setConfirmationVisible(false);
  });

  setMode("subscribe");
})();
