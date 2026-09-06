(function () {
  "use strict";

  const form = document.getElementById("newsletter-form");
  if (!form) return;

  const emailInput = document.getElementById("newsletter-email");
  const honeypot = document.getElementById("newsletter-company");
  const submitButton = document.getElementById("newsletter-submit");
  const buttonLabel = submitButton.querySelector("span");
  const manageButton = document.getElementById("newsletter-manage");
  const confirmation = document.getElementById("newsletter-unsubscribe-confirmation");
  const confirmUnsubscribeButton = document.getElementById("newsletter-confirm-unsubscribe");
  const message = document.getElementById("newsletter-message");
  const isArabic = document.documentElement.lang.toLowerCase().startsWith("ar");
  let mode = "subscribe";
  let preparedEmail = "";

  const copy = isArabic ? {
    subscribe: "اشترك",
    subscribing: "جارٍ الاشتراك...",
    manage: "إدارة الاشتراك",
    backToSubscribe: "العودة إلى الاشتراك",
    check: "تحقق من البريد",
    checking: "جارٍ التحقق...",
    unsubscribing: "جارٍ إلغاء الاشتراك...",
    invalid: "أدخل بريدًا إلكترونيًا صالحًا.",
    ready: "يمكنك الآن تأكيد إلغاء الاشتراك.",
    success: "تم اشتراكك بنجاح.",
    duplicate: "أنت مشترك بالفعل.",
    unsubscribed: "تم تحديث تفضيلات اشتراكك.",
    failed: "تعذر إتمام الاشتراك. حاول مرة أخرى.",
    unsubscribeFailed: "تعذر تحديث تفضيلات اشتراكك. حاول مرة أخرى."
  } : {
    subscribe: "Subscribe",
    subscribing: "Subscribing...",
    manage: "Manage subscription",
    backToSubscribe: "Back to subscribe",
    check: "Check email",
    checking: "Checking...",
    unsubscribing: "Unsubscribing...",
    invalid: "Please enter a valid email address.",
    ready: "You can now confirm unsubscription.",
    success: "You're subscribed successfully.",
    duplicate: "You're already subscribed.",
    unsubscribed: "Your subscription preferences have been updated.",
    failed: "We couldn't complete your subscription. Please try again.",
    unsubscribeFailed: "We couldn't update your subscription preferences. Please try again."
  };

  function setMessage(text, isError) {
    message.textContent = text;
    message.classList.toggle("is-error", Boolean(isError));
  }

  function notify(messageText, type) {
    if (window.NexCoreNotify?.show) {
      window.NexCoreNotify.show({ message: messageText, type });
    } else if (window.showToast) {
      window.showToast(messageText, type);
    }
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
    buttonLabel.textContent = mode === "manage" ? copy.check : copy.subscribe;
    setConfirmationVisible(false);
    setMessage("");
  }

  function setLoading(isLoading, label) {
    submitButton.disabled = isLoading;
    manageButton.disabled = isLoading;
    confirmUnsubscribeButton.disabled = isLoading;
    emailInput.readOnly = isLoading;
    buttonLabel.textContent = isLoading ? label : mode === "manage" ? copy.check : copy.subscribe;
    form.setAttribute("aria-busy", String(isLoading));
  }

  function setEmailValidity() {
    const invalid = !emailInput.value.trim() || !emailInput.checkValidity();
    emailInput.classList.toggle("is-invalid", invalid);
    emailInput.setAttribute("aria-invalid", String(invalid));
    return invalid;
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
      setMessage(copy.invalid, true);
      emailInput.focus();
      return;
    }

    if (honeypot.value.trim()) {
      if (mode === "manage") {
        preparedEmail = email;
        setConfirmationVisible(true);
        setMessage(copy.ready);
      } else {
        resetToSubscribe();
        setMessage(copy.success);
      }
      return;
    }

    const isManaging = mode === "manage";
    setLoading(true, isManaging ? copy.checking : copy.subscribing);

    try {
      const result = await sendRequest(isManaging ? "prepare_unsubscribe" : "subscribe", email);

      if (isManaging) {
        if (result.status !== "ready") throw new Error("Unexpected preparation response");
        preparedEmail = email;
        setConfirmationVisible(true);
        setMessage(copy.ready);
        return;
      }

      if (result.status === "already_subscribed") {
        setMessage(copy.duplicate);
        return;
      }

      resetToSubscribe();
      setMessage(copy.success);
    } catch (error) {
      console.error("Unexpected newsletter request error:", error);
      setMessage(isManaging ? copy.unsubscribeFailed : copy.failed, true);
    } finally {
      setLoading(false);
    }
  });

  confirmUnsubscribeButton.addEventListener("click", async () => {
    const email = emailInput.value.trim().toLowerCase();
    emailInput.value = email;

    if (!preparedEmail || email !== preparedEmail || setEmailValidity()) {
      setConfirmationVisible(false);
      setMessage(copy.invalid, true);
      emailInput.focus();
      return;
    }

    setLoading(true, copy.unsubscribing);
    try {
      const result = await sendRequest("unsubscribe", email);
      if (result.status !== "unsubscribed") throw new Error("Unexpected unsubscribe response");
      resetToSubscribe();
      notify(copy.unsubscribed, "success");
    } catch (error) {
      console.error("Unexpected newsletter unsubscribe error:", error);
      setMessage(copy.unsubscribeFailed, true);
    } finally {
      setLoading(false);
    }
  });

  emailInput.addEventListener("input", () => {
    if (preparedEmail && emailInput.value.trim().toLowerCase() !== preparedEmail) {
      preparedEmail = "";
      setConfirmationVisible(false);
    }
    if (form.dataset.validationAttempted !== "true") return;
    if (!setEmailValidity()) setMessage("");
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
