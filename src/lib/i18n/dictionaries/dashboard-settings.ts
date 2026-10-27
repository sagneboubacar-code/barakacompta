export const dashboardSettingsDict = {
  fr: {
    pageTitle: "Paramètres",
    pageSubtitle: "Réservé au propriétaire de l'école.",

    generalInfo: "Informations générales",
    logoAlt: "Logo de l'école",
    logoPlaceholder: "Logo",
    send: "Envoyer",
    schoolName: "Nom de l'école",
    currency: "Devise",
    country: "Pays",
    phone: "Téléphone",
    email: "Email",
    address: "Adresse",
    save: "Enregistrer",

    activeSchoolYear: "Année scolaire active",
    yearLabel: "Année (ex. 2025-2026)",
    startMonth: "Mois de début",
    endMonth: "Mois de fin",

    classesByCycle: "Classes par cycle",
    classesByCycleDesc: (year: string) =>
      `Pré-remplies à la création de l'école (${year}), modifiables ci-dessous.`,
    noClassInCycle: "Aucune classe dans ce cycle.",
    classNamePlaceholder: "Nom de la classe",
    orderPlaceholder: "Ordre",
    add: "Ajouter",

    cashManagers: "Responsables (caisse)",
    cashManagersDesc:
      "Pour les écoles où un seul comptable saisit tout mais où l'argent est réparti entre plusieurs personnes (ex. Directeur, Adjoint). Rattachez un responsable à chaque paiement/dépense pour suivre qui a quoi en main.",
    noManager: "Aucun responsable configuré.",
    managerNamePlaceholder: "Nom (ex. Directeur)",

    team: "Équipe",
    teamDesc: "Seul le propriétaire peut ajouter un administrateur ou un comptable à l'école.",
    colName: "Nom",
    colEmail: "Email",
    colRole: "Rôle",

    delete: "Supprimer",

    // InviteTeamMemberForm
    inviteFullName: "Nom complet",
    inviteEmail: "Email",
    inviteRole: "Rôle",
    inviteSubmit: "Ajouter",
    inviteSubmitting: "Création…",
    inviteAccountCreatedPrefix: "Compte créé pour",
    inviteTempPassword: "Mot de passe temporaire :",
    invitePasswordNotice:
      "Communiquez-le en privé à la personne concernée — il ne sera plus affiché après avoir quitté cette page.",
  },
  ar: {
    pageTitle: "الإعدادات",
    pageSubtitle: "مخصص لمالك المدرسة.",

    generalInfo: "المعلومات العامة",
    logoAlt: "شعار المدرسة",
    logoPlaceholder: "الشعار",
    send: "إرسال",
    schoolName: "اسم المدرسة",
    currency: "العملة",
    country: "البلد",
    phone: "الهاتف",
    email: "البريد الإلكتروني",
    address: "العنوان",
    save: "حفظ",

    activeSchoolYear: "السنة الدراسية الجارية",
    yearLabel: "السنة (مثال 2025-2026)",
    startMonth: "شهر البداية",
    endMonth: "شهر النهاية",

    classesByCycle: "الأقسام حسب الطور",
    classesByCycleDesc: (year: string) => `مُعبّأة مسبقًا عند إنشاء المدرسة (${year})، قابلة للتعديل أدناه.`,
    noClassInCycle: "لا يوجد قسم في هذا الطور.",
    classNamePlaceholder: "اسم القسم",
    orderPlaceholder: "الترتيب",
    add: "إضافة",

    cashManagers: "المسؤولون (الصندوق)",
    cashManagersDesc:
      "للمدارس التي يسجّل فيها محاسب واحد كل شيء لكن الأموال موزّعة بين عدة أشخاص (مثل المدير، النائب). اربط مسؤولًا بكل دفعة/مصروف لمعرفة من لديه ماذا.",
    noManager: "لا يوجد مسؤول مُهيَّأ.",
    managerNamePlaceholder: "الاسم (مثال: المدير)",

    team: "الفريق",
    teamDesc: "المالك وحده يمكنه إضافة مدير أو محاسب إلى المدرسة.",
    colName: "الاسم",
    colEmail: "البريد الإلكتروني",
    colRole: "الدور",

    delete: "حذف",

    // InviteTeamMemberForm
    inviteFullName: "الاسم الكامل",
    inviteEmail: "البريد الإلكتروني",
    inviteRole: "الدور",
    inviteSubmit: "إضافة",
    inviteSubmitting: "جارٍ الإنشاء…",
    inviteAccountCreatedPrefix: "تم إنشاء الحساب لـ",
    inviteTempPassword: "كلمة المرور المؤقتة:",
    invitePasswordNotice:
      "شاركها بشكل خاص مع الشخص المعني — لن تُعرض مجددًا بعد مغادرة هذه الصفحة.",
  },
};
