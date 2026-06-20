(function () {
  "use strict";

  const form = document.getElementById("unsubscribe-form");
  if (!form) return;

  const emailInput = document.getElementById("unsubscribe-email");
  const status = document.getElementById("status");
  const button = document.getElementById("confirm");
  const isArabic = document.documentElement.lang.toLowerCase().startsWith("ar");
  const searchParams = new URLSearchParams(window.location.search);

  if (!isArabic && searchParams.get("lang") === "ar") {
    searchParams.delete("lang");
    const query = searchParams.toString();
    window.location.replace(`ar/unsubscribe.html${query ? `?${query}` : ""}`);
    return;
  }

  const copy = isArabic ? {
    button: "إلغاء الاشتراك",
    processing: "جارٍ إلغاء الاشتراك...",
    invalid: "أدخل بريدًا إلكترونيًا صالحًا.",
    success: "تم إلغاء اشتراكك بنجاح.",
    notFound: "هذا البريد غير مشترك أو تم إلغاء اشتراكه مسبقًا.",
    failed: "تعذر إلغاء الاشتراك. حاول مرة أخرى."
  } : {
    button: "Unsubscribe",
    processing: "Unsubscribing...",
    invalid: "Please enter a valid email address.",
    success: "You have been unsubscribed successfully.",
    notFound: "This email is not subscribed or is already inactive.",
    failed: "We could not unsubscribe you. Please try again."
  };

  const initialEmail = searchParams.get("email");
  if (initialEmail) {
    emailInput.value = initialEmail.trim().toLowerCase();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim().toLowerCase();
    emailInput.value = email;

    if (!email || !emailInput.checkValidity()) {
      status.textContent = copy.invalid;
      emailInput.focus();
      return;
    }

    button.disabled = true;
    emailInput.readOnly = true;
    button.textContent = copy.processing;
    status.textContent = copy.processing;

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unsubscribe",
          email
        })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Unsubscribe failed");
      }

      if (result.status === "unsubscribed") {
        status.textContent = copy.success;
        emailInput.value = "";
      } else {
        status.textContent = copy.notFound;
      }
    } catch (error) {
      console.error("Unexpected error while unsubscribing:", error);
      status.textContent = copy.failed;
    } finally {
      button.disabled = false;
      emailInput.readOnly = false;
      button.textContent = copy.button;
    }
  });
})();
