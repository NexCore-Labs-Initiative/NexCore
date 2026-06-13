(function () {
  "use strict";

  const form = document.getElementById("newsletter-form");
  if (!form) return;

  const emailInput = document.getElementById("newsletter-email");
  const honeypot = document.getElementById("newsletter-company");
  const submitButton = document.getElementById("newsletter-submit");
  const buttonLabel = submitButton.querySelector("span");
  const message = document.getElementById("newsletter-message");
  const isArabic = document.documentElement.lang.toLowerCase().startsWith("ar");

  const copy = isArabic ? {
    idle: "اشترك",
    loading: "جارٍ الاشتراك...",
    invalid: "أدخل بريدًا إلكترونيًا صالحًا.",
    success: "تم اشتراكك بنجاح.",
    duplicate: "أنت مشترك بالفعل.",
    unavailable: "خدمة الاشتراك غير متاحة حاليًا. حاول مرة أخرى لاحقًا.",
    failed: "تعذر إتمام الاشتراك. حاول مرة أخرى."
  } : {
    idle: "Subscribe",
    loading: "Subscribing...",
    invalid: "Please enter a valid email address.",
    success: "You're subscribed successfully.",
    duplicate: "You're already subscribed.",
    unavailable: "Subscription service is currently unavailable. Please try again later.",
    failed: "We couldn't complete your subscription. Please try again."
  };

  function setMessage(text, isError) {
    message.textContent = text;
    message.classList.toggle("is-error", Boolean(isError));
  }

  function setLoading(isLoading) {
    submitButton.disabled = isLoading;
    emailInput.readOnly = isLoading;
    buttonLabel.textContent = isLoading ? copy.loading : copy.idle;
    form.setAttribute("aria-busy", String(isLoading));
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim().toLowerCase();
    emailInput.value = email;
    emailInput.setAttribute("aria-invalid", "false");
    setMessage("");

    if (honeypot.value.trim()) {
      form.reset();
      setMessage(copy.success);
      return;
    }

    if (!email || !emailInput.checkValidity()) {
      emailInput.setAttribute("aria-invalid", "true");
      setMessage(copy.invalid, true);
      emailInput.focus();
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "subscribe",
          email,
          company: honeypot.value
        })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(result.error || "Subscription failed");

      if (result.status === "already_subscribed") {
        setMessage(copy.duplicate);
        return;
      }

      form.reset();
      setMessage(copy.success);
    } catch (error) {
      console.error("Unexpected newsletter subscription error:", error);
      setMessage(copy.failed, true);
    } finally {
      setLoading(false);
    }
  });

  emailInput.addEventListener("input", () => {
    emailInput.setAttribute("aria-invalid", "false");
    setMessage("");
  });
})();
