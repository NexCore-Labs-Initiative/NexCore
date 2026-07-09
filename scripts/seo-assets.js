"use strict";

const SITE_ORIGIN = "https://nexcorelabs.vercel.app";
const OG_IMAGE =
  "https://nexcorelabs.vercel.app/assets/images/nexcorelabs-og.png";

const ORGANIZATION = {
  "@type": "Organization",
  "@id": `${SITE_ORIGIN}/#organization`,
  name: "NexCore Labs",
  url: SITE_ORIGIN,
  logo: `${SITE_ORIGIN}/assets/images/nexcore-logo.webp`,
  foundingDate: "2025-09-23",
  description:
    "NexCore Labs is an independent, student-led platform helping the SQU community access useful tools, collaborate, share work, and move ideas forward.",
  sameAs: ["https://github.com/NexCoreLabs/NexCore"],
};

const WEBSITE = {
  "@type": "WebSite",
  "@id": `${SITE_ORIGIN}/#website`,
  url: SITE_ORIGIN,
  name: "NexCore Labs",
  description:
    "Empower our SQU Community to do more through independent, student-led tools, collaboration, project visibility, and practical digital support.",
  publisher: { "@id": `${SITE_ORIGIN}/#organization` },
  inLanguage: ["en", "ar"],
};

const FAQ_EN = [
  {
    question: "What is NexCore Labs?",
    answer:
      "NexCore Labs is an independent, student-led platform built to empower the SQU community through useful tools, shared knowledge, project visibility, collaboration, and practical digital support.",
  },
  {
    question: "Who can use NexCore Labs?",
    answer:
      "NexCore Labs is open to students at universities and colleges across Oman, including research teams, student startups, clubs, and creative projects. Eligible SQU accounts currently receive free platform access under NexCore's access rules.",
  },
  {
    question: "When was NexCore Labs founded?",
    answer:
      "NexCore Labs was founded on September 23, 2025 by SQU students who wanted to help their community access useful tools, share work, collaborate, and move ideas forward.",
  },
  {
    question: "How do I get started with NexCore Labs?",
    answer:
      "Sign in with your Google account. Eligible SQU accounts and pre-approved users can access NexCore under the current access rules, while paid orders remain temporarily paused.",
  },
  {
    question: "What makes NexCore Labs different?",
    answer:
      "NexCore Labs is more than a website development service; it is an independent student-led platform that helps the SQU community discover tools, showcase work, collaborate, and turn ideas into practical outcomes.",
  },
  {
    question: "What are NexCore Labs Initiatives?",
    answer:
      "Initiatives are the products, experiments, and community efforts NexCore Labs is building or supporting beyond individual project pages. The Initiatives page shows launched work, active builds, and ideas still taking shape, with categories, status labels, highlights, and quick-view details.",
  },
];

const FAQ_AR = [
  {
    question: "ما هي NexCore Labs؟",
    answer:
      "NexCore Labs منصة مستقلة يقودها طلاب لتمكين مجتمع جامعة السلطان قابوس عبر الأدوات المفيدة والمعرفة المشتركة وإبراز المشاريع والتعاون والدعم الرقمي العملي.",
  },
  {
    question: "من يمكنه استخدام NexCore Labs؟",
    answer:
      "NexCore Labs مفتوحة لطلاب جامعات وكليات عمان، بما في ذلك فرق البحث والمشاريع الطلابية الناشئة والأندية والمشاريع الإبداعية. تحصل حسابات جامعة السلطان قابوس المؤهلة حالياً على وصول مجاني وفق قواعد NexCore.",
  },
  {
    question: "متى تأسست NexCore Labs؟",
    answer:
      "تأسست NexCore Labs في 23 سبتمبر 2025 على يد طلاب من جامعة السلطان قابوس لمساعدة مجتمعهم على الوصول إلى الأدوات ومشاركة الأعمال والتعاون ودفع الأفكار إلى الأمام.",
  },
  {
    question: "كيف أبدأ مع NexCore Labs؟",
    answer:
      "سجل الدخول باستخدام حسابك على Google. تستطيع حسابات جامعة السلطان قابوس المؤهلة والمستخدمون المعتمدون مسبقاً الوصول وفق قواعد NexCore الحالية، بينما تبقى الطلبات المدفوعة متوقفة مؤقتاً.",
  },
  {
    question: "ما الذي يميز NexCore Labs؟",
    answer:
      "NexCore Labs أوسع من خدمة تطوير مواقع؛ فهي منصة طلابية مستقلة تساعد مجتمع جامعة السلطان قابوس على اكتشاف الأدوات وعرض الأعمال والتعاون وتحويل الأفكار إلى نتائج عملية.",
  },
  {
    question: "ما هي مبادرات NexCore Labs؟",
    answer:
      "المبادرات هي المنتجات والتجارب والجهود المجتمعية التي تبنيها NexCore Labs أو تدعمها خارج صفحات المشاريع الفردية. تعرض صفحة المبادرات الأعمال المنشورة، وما يتم بناؤه حالياً، والأفكار التي ما زالت تتشكل، مع تصنيفات وحالات ونقاط بارزة وتفاصيل عرض سريع.",
  },
];

const PAGE_PAIRS = [
  {
    key: "home",
    priority: "1.00",
    en: {
      file: "index.html",
      path: "/",
      title: "NexCore Labs | Empower our SQU Community to do more",
      description:
        "Empower our SQU Community to do more through independent, student-led tools, collaboration, project visibility, and practical digital support.",
      breadcrumb: "Home",
    },
    ar: {
      file: "ar/index.html",
      path: "/ar",
      title: "NexCore Labs | نمكّن مجتمع جامعة السلطان قابوس من إنجاز المزيد",
      description:
        "نمكّن مجتمع جامعة السلطان قابوس من إنجاز المزيد عبر أدوات وتعاون وإبراز للمشاريع ودعم رقمي تقوده مبادرة طلابية مستقلة.",
      breadcrumb: "الرئيسية",
    },
  },
  {
    key: "hub",
    priority: "0.85",
    en: {
      file: "hub.html",
      path: "/hub",
      title: "NexCore Labs | Project Hub",
      description:
        "Explore published student work, shared resources, and community projects from the NexCore Labs project hub.",
      breadcrumb: "Hub",
    },
    ar: {
      file: "ar/hub.html",
      path: "/ar/hub",
      title: "NexCore Labs | مركز المشاريع",
      description:
        "استكشف أعمال الطلاب والموارد المشتركة ومشاريع المجتمع من مركز المشاريع في NexCore Labs.",
      breadcrumb: "المركز",
    },
  },
  {
    key: "initiatives",
    priority: "0.82",
    en: {
      file: "initiatives.html",
      path: "/initiatives",
      title: "NexCore Labs | Initiatives",
      description:
        "Explore launched and emerging NexCore Labs initiatives across AI tools, community experiences, and practical exploration.",
      breadcrumb: "Initiatives",
    },
    ar: {
      file: "ar/initiatives.html",
      path: "/ar/initiatives",
      title: "NexCore Labs | مبادرات NexCore Labs",
      description:
        "استكشف مبادرات NexCore Labs المُطلقة والناشئة عبر أدوات الذكاء الاصطناعي وتجارب المجتمع والاستكشاف العملي.",
      breadcrumb: "المبادرات",
    },
  },
  {
    key: "contribute",
    priority: "0.82",
    en: {
      file: "contribute.html",
      path: "/contribute",
      title: "NexCore Labs | Contributor Center",
      description:
        "Find practical ways to contribute to NexCore Labs, share projects, suggest improvements, and follow your community activity.",
      breadcrumb: "Contributor Center",
    },
    ar: {
      file: "ar/contribute.html",
      path: "/ar/contribute",
      title: "NexCore Labs | مركز المساهمين",
      description:
        "اكتشف طرقًا عملية للمساهمة في NexCore Labs، وشارك المشاريع، واقترح التحسينات، وتابع نشاطك المجتمعي.",
      breadcrumb: "مركز المساهمين",
    },
  },
  {
    key: "how-to-use",
    priority: "0.80",
    en: {
      file: "how-to-use.html",
      path: "/how-to-use",
      title: "How to Use NexCore Labs | Platform Guide",
      description:
        "Learn how to use NexCore Labs to access tools, discover projects, sign in, and get practical support.",
      breadcrumb: "How to Use",
    },
    ar: {
      file: "ar/how-to-use.html",
      path: "/ar/how-to-use",
      title: "كيفية استخدام NexCore Labs | دليل المنصة",
      description:
        "تعرّف على كيفية استخدام NexCore Labs للوصول إلى الأدوات واكتشاف المشاريع وتسجيل الدخول والحصول على دعم عملي.",
      breadcrumb: "كيفية الاستخدام",
    },
  },
  {
    key: "pricing",
    priority: "0.80",
    en: {
      file: "pricing.html",
      path: "/pricing",
      title: "NexCore Labs | Access & Pricing",
      description:
        "Review NexCore Labs access options, paused paid-order status, and transparent pricing context for students and project teams.",
      breadcrumb: "Pricing",
    },
    ar: {
      file: "ar/pricing.html",
      path: "/ar/pricing",
      title: "NexCore Labs | الوصول والأسعار",
      description:
        "راجع خيارات الوصول في NexCore Labs وحالة إيقاف الطلبات المدفوعة مؤقتاً وسياق التسعير الشفاف للطلاب وفرق المشاريع.",
      breadcrumb: "الأسعار",
    },
  },
  {
    key: "pricing-policy",
    priority: "0.75",
    en: {
      file: "pricing-policy.html",
      path: "/pricing-policy",
      title: "NexCore Labs | Pricing & Billing Policy",
      description:
        "Read NexCore Labs' plain-language pricing and billing policy, including current paused payment status, support terms, and refund rules.",
      breadcrumb: "Pricing Policy",
    },
    ar: {
      file: "ar/pricing-policy.html",
      path: "/ar/pricing-policy",
      title: "NexCore Labs | سياسة التسعير والفوترة",
      description:
        "اقرأ سياسة التسعير والفوترة الواضحة في NexCore Labs، بما في ذلك حالة إيقاف الدفع الحالية وشروط الدعم وقواعد الاسترجاع.",
      breadcrumb: "سياسة التسعير",
    },
  },
  {
    key: "faq",
    priority: "0.80",
    faq: { en: FAQ_EN, ar: FAQ_AR },
    en: {
      file: "faq.html",
      path: "/faq",
      title: "NexCore Labs | Frequently Asked Questions",
      description:
        "Find clear answers about NexCore Labs, platform access, project visibility, pricing status, security, and support.",
      breadcrumb: "FAQ",
    },
    ar: {
      file: "ar/faq.html",
      path: "/ar/faq",
      title: "NexCore Labs | الأسئلة الشائعة",
      description:
        "اعثر على إجابات واضحة حول NexCore Labs والوصول إلى المنصة وإبراز المشاريع وحالة التسعير والأمان والدعم.",
      breadcrumb: "الأسئلة الشائعة",
    },
  },
  {
    key: "roadmap",
    priority: "0.70",
    en: {
      file: "roadmap.html",
      path: "/roadmap",
      title: "NexCore Labs | Feature Requests & Roadmap",
      description:
        "Vote on feature ideas, suggest improvements, and follow the NexCore Labs roadmap for platform updates.",
      breadcrumb: "Roadmap",
    },
    ar: {
      file: "ar/roadmap.html",
      path: "/ar/roadmap",
      title: "NexCore Labs | طلبات الميزات وخارطة الطريق",
      description:
        "صوّت على أفكار الميزات واقترح التحسينات وتابع خارطة طريق NexCore Labs لتحديثات المنصة.",
      breadcrumb: "خارطة الطريق",
    },
  },
  {
    key: "releases",
    priority: "0.70",
    en: {
      file: "releases.html",
      path: "/releases",
      title: "NexCore Labs | Releases & Platform Updates",
      description:
        "Follow NexCore Labs releases with bilingual notes on new features, fixes, and platform improvements.",
      breadcrumb: "Releases",
    },
    ar: {
      file: "ar/releases.html",
      path: "/ar/releases",
      title: "NexCore Labs | الإصدارات وتحديثات المنصة",
      description:
        "تابع إصدارات NexCore Labs من خلال ملاحظات ثنائية اللغة عن الميزات الجديدة والإصلاحات وتحسينات المنصة.",
      breadcrumb: "الإصدارات",
    },
  },
  {
    key: "terms",
    priority: "0.60",
    en: {
      file: "terms.html",
      path: "/terms",
      title: "NexCore Labs | Terms of Service",
      description:
        "Review the NexCore Labs terms covering platform access, acceptable use, project submissions, and service responsibilities.",
      breadcrumb: "Terms",
    },
    ar: {
      file: "ar/terms.html",
      path: "/ar/terms",
      title: "NexCore Labs | شروط الخدمة",
      description:
        "راجع شروط NexCore Labs التي تغطي الوصول إلى المنصة والاستخدام المقبول وإرسال المشاريع ومسؤوليات الخدمة.",
      breadcrumb: "الشروط",
    },
  },
  {
    key: "privacy-policy",
    priority: "0.60",
    en: {
      file: "privacy-policy.html",
      path: "/privacy-policy",
      title: "NexCore Labs | Privacy Policy",
      description:
        "Learn how NexCore Labs handles account data, cookies, analytics, project information, and privacy choices.",
      breadcrumb: "Privacy Policy",
    },
    ar: {
      file: "ar/privacy-policy.html",
      path: "/ar/privacy-policy",
      title: "NexCore Labs | سياسة الخصوصية",
      description:
        "تعرّف على كيفية تعامل NexCore Labs مع بيانات الحساب والكوكيز والتحليلات ومعلومات المشاريع وخيارات الخصوصية.",
      breadcrumb: "سياسة الخصوصية",
    },
  },
  {
    key: "intelligence",
    priority: "0.55",
    en: {
      file: "intelligence.html",
      path: "/intelligence",
      title: "NexCore Intelligence | NexCore Labs",
      description:
        "Preview NexCore Intelligence, a developing assistant experience for exploring NexCore Labs resources.",
      breadcrumb: "NexCore Intelligence",
    },
    ar: {
      file: "ar/intelligence.html",
      path: "/ar/intelligence",
      title: "ذكاء NexCore | NexCore Labs",
      description:
        "استعرض ذكاء NexCore، تجربة مساعد قيد التطوير لاستكشاف NexCore Labs ومواردها.",
      breadcrumb: "ذكاء NexCore",
    },
  },
];

const flattenPages = () =>
  PAGE_PAIRS.flatMap((pair) =>
    ["en", "ar"].map((locale) => ({
      ...pair[locale],
      key: pair.key,
      locale,
      alternate: pair[locale === "en" ? "ar" : "en"],
      pair,
    }))
  );

const absoluteUrl = (path) => `${SITE_ORIGIN}${path === "/" ? "/" : path}`;

const homePath = (locale) => (locale === "ar" ? "/ar" : "/");

const schemaForPage = (page) => {
  const pageUrl = absoluteUrl(page.path);
  const breadcrumbItems = [
    {
      "@type": "ListItem",
      position: 1,
      name: page.locale === "ar" ? "الرئيسية" : "Home",
      item: absoluteUrl(homePath(page.locale)),
    },
  ];

  if (page.key !== "home") {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: 2,
      name: page.breadcrumb,
      item: pageUrl,
    });
  }

  const pageNode = {
    "@type": page.key === "faq" ? "FAQPage" : "WebPage",
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: page.title,
    description: page.description,
    isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
    publisher: { "@id": `${SITE_ORIGIN}/#organization` },
    inLanguage: page.locale,
  };

  if (page.key === "faq") {
    pageNode.mainEntity = page.pair.faq[page.locale].map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    }));
  }

  const graph = [
    { ...ORGANIZATION, sameAs: [...ORGANIZATION.sameAs] },
    { ...WEBSITE, inLanguage: [...WEBSITE.inLanguage] },
    pageNode,
    {
      "@type": "BreadcrumbList",
      "@id": `${pageUrl}#breadcrumb`,
      itemListElement: breadcrumbItems,
    },
  ];

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
};

module.exports = {
  SITE_ORIGIN,
  OG_IMAGE,
  PAGE_PAIRS,
  flattenPages,
  absoluteUrl,
  schemaForPage,
};
