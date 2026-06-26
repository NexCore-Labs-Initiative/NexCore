(function () {
  "use strict";

  const MEMBERS = Object.freeze({
    "al-faris": Object.freeze({
      credentialId: "NCL-0001",
      contactUrl: "https://blinq.me/cmgiwe8wn01zhs60mfmiu60fj",
      qrImage: "team-id-ncl-0001.png",
      name: Object.freeze({ en: "Al-Faris Mujahid AlZakwani", ar: "الفارس بن مجاهد الزكواني" }),
      title: Object.freeze({ en: "Founder", ar: "المؤسس" }),
      role: Object.freeze({ en: "Project Manager & Lead Developer", ar: "مدير المشروع وكبير المطورين" }),
      joined: Object.freeze({ en: "September 2025", ar: "سبتمبر ٢٠٢٥" })
    }),
    talal: Object.freeze({
      credentialId: "NCL-0002",
      contactUrl: "https://blinq.me/cmgj7rwqz0hies60mmtf2i2f6",
      qrImage: "team-id-ncl-0002.png",
      name: Object.freeze({ en: "Talal AlKalbani", ar: "طلال الكلباني" }),
      title: Object.freeze({ en: "Technical Operations", ar: "العمليات التقنية" }),
      role: Object.freeze({ en: "Technical Architect", ar: "المهندس التقني" }),
      joined: Object.freeze({ en: "September 2025", ar: "سبتمبر ٢٠٢٥" })
    })
  });

  const COPY = Object.freeze({
    en: Object.freeze({
      modalEyebrow: "NexCore Labs team credential",
      idCard: "ID Card",
      close: "Close ID card preview",
      front: "Front",
      back: "Back",
      id: "ID:",
      joined: "Joined:",
      contact: "Scan or click the QR code to open this member’s contact profile."
    }),
    ar: Object.freeze({
      modalEyebrow: "بطاقة عضوية فريق NexCore Labs",
      idCard: "بطاقة العضوية",
      close: "إغلاق معاينة بطاقة العضوية",
      front: "الواجهة",
      back: "الخلفية",
      id: "الرقم:",
      joined: "انضم:",
      contact: "امسح رمز QR أو اضغط عليه لفتح ملف التواصل الخاص بالعضو."
    })
  });

  const isArabic = () => document.documentElement.lang.toLowerCase().startsWith("ar");
  const locale = () => (isArabic() ? "ar" : "en");
  const assetsPath = () => (isArabic() ? "../assets/images/" : "assets/images/");
  const localized = (value) => value[locale()];
  const byId = (id) => document.getElementById(id);
  let lastFocusedElement = null;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function createFrontBrand() {
    const brand = element("div", "team-id-card__brand");
    const wordmark = document.createElement("img");
    wordmark.className = "team-id-card__brand-word";
    wordmark.src = `${assetsPath()}nexcore-word.webp`;
    wordmark.alt = "NexCore Labs";
    brand.append(wordmark);
    return brand;
  }

  function createBackMark() {
    const icon = document.createElement("img");
    icon.className = "team-id-card__back-mark";
    icon.src = `${assetsPath()}nexcore-icon.png`;
    icon.alt = "NexCore Labs";
    return icon;
  }

  function fact(label, value) {
    const line = element("span", "team-id-card__fact");
    const labelElement = element("strong", "", label);
    line.append(labelElement, document.createTextNode(value));
    return line;
  }

  function createFront(member, copy) {
    const card = element("section", "team-id-card team-id-card--front");
    card.setAttribute("aria-label", `${copy.front}: ${localized(member.name)}`);
    const side = element("p", "team-id-card__side-label", copy.front);
    const rule = element("div", "team-id-card__rule");
    const name = element("h3", "team-id-card__name", localized(member.name));
    const title = element("p", "team-id-card__title", localized(member.title));
    const facts = element("div", "team-id-card__facts");
    facts.append(fact(copy.id, member.credentialId), fact(copy.joined, localized(member.joined)));
    card.append(side, createFrontBrand(), rule, name, title, facts);
    return card;
  }

  function createBack(member, copy) {
    const card = element("section", "team-id-card team-id-card--back");
    card.setAttribute("aria-label", `${copy.back}: ${localized(member.name)}`);
    const side = element("p", "team-id-card__side-label", copy.back);
    const qrLink = element("a", "team-id-card__qr-link");
    qrLink.href = member.contactUrl;
    qrLink.target = "_blank";
    qrLink.rel = "noopener noreferrer";
    qrLink.setAttribute("aria-label", `${copy.contact} ${localized(member.name)}`);
    const qr = document.createElement("img");
    qr.className = "team-id-card__qr";
    qr.src = `${assetsPath()}${member.qrImage}`;
    qr.alt = "";
    qr.setAttribute("aria-hidden", "true");
    qrLink.append(qr);
    const contactCopy = element("p", "team-id-card__contact-copy", copy.contact);
    card.append(side, createBackMark(), qrLink, contactCopy);
    return card;
  }

  function ensureModal() {
    let modal = byId("teamIdCardModal");
    if (modal) return modal;

    modal = element("div", "team-id-card-modal");
    modal.id = "teamIdCardModal";
    modal.hidden = true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-hidden", "true");
    modal.setAttribute("aria-labelledby", "teamIdCardModalTitle");

    const panel = element("div", "team-id-card-modal__panel");
    panel.setAttribute("role", "document");
    const header = element("header", "team-id-card-modal__header");
    const heading = element("div", "");
    const eyebrow = element("span", "team-id-card-modal__eyebrow");
    const title = element("h2", "team-id-card-modal__title");
    title.id = "teamIdCardModalTitle";
    const close = element("button", "team-id-card-modal__close");
    close.type = "button";
    close.id = "teamIdCardModalClose";
    close.dataset.teamIdCardClose = "";
    close.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
    heading.append(eyebrow, title);
    header.append(heading, close);
    panel.append(header, element("div", "team-id-card-modal__cards"));
    modal.append(panel);
    document.body.append(modal);
    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.closest("[data-team-id-card-close]")) closeModal();
    });
    return modal;
  }

  function render(member) {
    const modal = ensureModal();
    const copy = COPY[locale()];
    modal.querySelector(".team-id-card-modal__eyebrow").textContent = copy.modalEyebrow;
    modal.querySelector(".team-id-card-modal__title").textContent = `${copy.idCard}: ${localized(member.name)}`;
    modal.querySelector("#teamIdCardModalClose").setAttribute("aria-label", copy.close);
    modal.querySelector(".team-id-card-modal__cards").replaceChildren(createFront(member, copy), createBack(member, copy));
  }

  function getFocusableEls(modal) {
    return [...modal.querySelectorAll("a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])")]
      .filter((node) => node.offsetParent !== null);
  }

  function trapFocus(event) {
    const modal = byId("teamIdCardModal");
    if (!modal || !modal.classList.contains("is-open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== "Tab") return;
    const targets = getFocusableEls(modal);
    if (!targets.length) return;
    const first = targets[0];
    const last = targets[targets.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openModal(memberKey, trigger) {
    const member = MEMBERS[memberKey];
    if (!member) return;
    const modal = ensureModal();
    lastFocusedElement = trigger || document.activeElement;
    render(member);
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("team-id-card-modal-open");
    document.addEventListener("keydown", trapFocus);
    requestAnimationFrame(() => {
      modal.classList.add("is-open");
      const targets = getFocusableEls(modal);
      if (targets.length) targets[0].focus();
    });
  }

  function closeModal() {
    const modal = byId("teamIdCardModal");
    if (!modal || (!modal.classList.contains("is-open") && modal.hidden)) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("team-id-card-modal-open");
    document.removeEventListener("keydown", trapFocus);
    window.setTimeout(() => {
      if (modal.getAttribute("aria-hidden") === "true") modal.hidden = true;
    }, 200);
    if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
    lastFocusedElement = null;
  }

  function init() {
    document.querySelectorAll("[data-team-id-card]").forEach((trigger) => {
      trigger.addEventListener("click", () => openModal(trigger.dataset.teamIdCard, trigger));
    });
  }

  window.NexCoreTeamIdCards = Object.freeze({ MEMBERS, openModal, closeModal });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
