export const landingDict = {
  fr: {
    heroBadge: "Gestion financière scolaire",
    heroTitle: "La comptabilité de votre école, sans les cahiers ni les fichiers Excel.",
    heroText:
      "Baraka Compta centralise les élèves, les paiements, les dépenses et les rapports de votre établissement — pour savoir, à tout moment, où en est votre trésorerie.",
    ctaSignup: "Commencer gratuitement",
    ctaLogin: "Se connecter",
    heroFootnote: "Sans engagement · Aucune carte bancaire requise",

    painPoints: [
      { title: "Suivi manuel, source d'erreurs", text: "Cahiers et fichiers Excel dispersés entre plusieurs responsables." },
      { title: "Retards difficiles à repérer", text: "Impossible de savoir rapidement quels élèves sont à jour." },
      { title: "Rapports longs à préparer", text: "Des heures perdues avant chaque réunion avec la direction." },
    ],

    featuresLabel: "Fonctionnalités",
    featuresTitle: "Tout ce qu'il faut pour gérer la caisse de l'école",
    features: [
      { title: "Élèves & inscriptions", text: "Un dossier par élève : classe, responsables, statut, historique complet — fini les cahiers et les fiches volantes." },
      { title: "Tarifs & échéanciers", text: "Définissez vos frais (inscription, mensualités, uniforme...) une fois, l'échéancier de chaque élève se génère automatiquement." },
      { title: "Paiements", text: "Enregistrez chaque paiement en quelques secondes, par espèces, Wave, Orange Money ou virement." },
      { title: "Recouvrement", text: "Voyez d'un coup d'œil qui est à jour et qui est en retard, élève par élève, classe par classe." },
      { title: "Rapports financiers", text: "Recettes, dépenses, solde par responsable, détail journalier — prêts à imprimer ou exporter en un clic." },
      { title: "Dépenses & transferts", text: "Suivez les sorties de caisse et les transferts entre responsables, avec une comptabilité consolidée pour l'école." },
    ],

    howItWorksTitle: "Comment ça marche",
    steps: [
      { n: "01", title: "Inscrivez votre école", text: "Créez votre espace en moins de deux minutes, sans engagement." },
      { n: "02", title: "Ajoutez élèves et tarifs", text: "Importez vos élèves et configurez vos frais scolaires." },
      { n: "03", title: "Suivez tout en temps réel", text: "Paiements, retards et rapports, accessibles à toute votre équipe." },
    ],

    communityLabel: "Communauté",
    communityTitle: "Échangez avec d'autres directeurs d'école",
    communityText:
      "Rejoignez la communauté WhatsApp Baraka Compta : conseils, questions entre utilisateurs et nouveautés du produit.",
    communityCta: "Rejoindre la communauté WhatsApp",

    pricingLabel: "Tarifs",
    pricingTitle: "Un tarif simple, qui grandit avec votre école",
    pricingSubtitle: "Facturation mensuelle, sans engagement.",
    free: "Gratuit",
    perMonth: "/ mois",
    days: "jours",
    unlimitedStudents: "Élèves illimités",
    upToStudents: (n: number) => `Jusqu'à ${n} élèves`,
    coreLine: "Élèves, tarifs, paiements, dépenses",
    collectionsLine: "Recouvrement",
    reportsLine: "Rapports financiers",
    recommended: "Recommandé",
    start: "Commencer",
    choose: "Choisir",
    planLabels: { trial: "Essai gratuit", basic: "Basic", pro: "Pro", premium: "Premium" } as Record<string, string>,

    finalCtaTitle: "Prêt à simplifier la gestion de votre école ?",
    finalCtaText: "Créez votre espace en moins de deux minutes.",
    finalCtaButton: "Commencer gratuitement",
  },
  ar: {
    heroBadge: "إدارة مالية للمدارس",
    heroTitle: "محاسبة مدرستك، بدون دفاتر ولا ملفات إكسل.",
    heroText:
      "بركة كومبتا يجمع في مكان واحد التلاميذ والمدفوعات والمصاريف وتقارير مؤسستكم — لتعرفوا في أي وقت وضعية خزينتكم.",
    ctaSignup: "ابدأ مجانًا",
    ctaLogin: "تسجيل الدخول",
    heroFootnote: "بدون التزام · لا حاجة لبطاقة بنكية",

    painPoints: [
      { title: "متابعة يدوية، مصدر للأخطاء", text: "دفاتر وملفات إكسل موزعة بين عدة مسؤولين." },
      { title: "صعوبة رصد التأخيرات", text: "من المستحيل معرفة بسرعة أي التلاميذ في وضعية سليمة." },
      { title: "تقارير طويلة الإعداد", text: "ساعات ضائعة قبل كل اجتماع مع الإدارة." },
    ],

    featuresLabel: "المميزات",
    featuresTitle: "كل ما تحتاجه لإدارة خزينة المدرسة",
    features: [
      { title: "التلاميذ والتسجيلات", text: "ملف لكل تلميذ: القسم، أولياء الأمور، الوضعية، السجل الكامل — نهاية الدفاتر والأوراق المتفرقة." },
      { title: "الرسوم والجداول الزمنية", text: "حدّد رسومك (تسجيل، شهرية، زي موحد...) مرة واحدة، ويُنشأ جدول كل تلميذ تلقائيًا." },
      { title: "المدفوعات", text: "سجّل كل دفعة في ثوانٍ، نقدًا أو عبر Wave أو Orange Money أو تحويل بنكي." },
      { title: "التحصيل", text: "اطّلع بنظرة واحدة على من هو منتظم ومن تأخر، تلميذًا تلميذًا وقسمًا قسمًا." },
      { title: "التقارير المالية", text: "الإيرادات، المصاريف، رصيد كل مسؤول، التفاصيل اليومية — جاهزة للطباعة أو التصدير بنقرة واحدة." },
      { title: "المصاريف والتحويلات", text: "تابع مصاريف الصندوق والتحويلات بين المسؤولين، بمحاسبة موحدة للمدرسة." },
    ],

    howItWorksTitle: "كيف يعمل",
    steps: [
      { n: "01", title: "سجّل مدرستك", text: "أنشئ مساحتك في أقل من دقيقتين، بدون التزام." },
      { n: "02", title: "أضف التلاميذ والرسوم", text: "استورد تلاميذك واضبط رسومك المدرسية." },
      { n: "03", title: "تابع كل شيء لحظة بلحظة", text: "المدفوعات والتأخيرات والتقارير، متاحة لكامل فريقك." },
    ],

    communityLabel: "المجتمع",
    communityTitle: "تواصل مع مديري مدارس آخرين",
    communityText: "انضم إلى مجتمع بركة كومبتا على واتساب: نصائح، أسئلة بين المستخدمين وجديد المنتج.",
    communityCta: "الانضمام إلى مجتمع واتساب",

    pricingLabel: "الأسعار",
    pricingTitle: "سعر بسيط، يكبر مع مدرستك",
    pricingSubtitle: "فوترة شهرية، بدون التزام.",
    free: "مجاني",
    perMonth: "/ شهريًا",
    days: "يومًا",
    unlimitedStudents: "عدد غير محدود من التلاميذ",
    upToStudents: (n: number) => `حتى ${n} تلميذًا`,
    coreLine: "التلاميذ، الرسوم، المدفوعات، المصاريف",
    collectionsLine: "التحصيل",
    reportsLine: "التقارير المالية",
    recommended: "موصى به",
    start: "ابدأ",
    choose: "اختر",
    planLabels: { trial: "تجربة مجانية", basic: "Basic", pro: "Pro", premium: "Premium" } as Record<string, string>,

    finalCtaTitle: "هل أنت مستعد لتبسيط إدارة مدرستك؟",
    finalCtaText: "أنشئ مساحتك في أقل من دقيقتين.",
    finalCtaButton: "ابدأ مجانًا",
  },
};
