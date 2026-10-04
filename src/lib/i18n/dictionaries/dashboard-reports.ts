export const dashboardReportsDict = {
  fr: {
    pageTitle: "Rapport financier",
    period: (from: string, to: string) => `Du ${from} au ${to}`,
    generatedAt: (date: string) => ` · généré le ${date}`,
    exportExcel: "Export Excel",
    exportPdf: "Rapport PDF",
    filterFrom: "Du",
    filterTo: "Au",
    apply: "Appliquer",

    tileCollected: "Recettes encaissées",
    tileCollectedHint: (n: number) => `${n} paiement${n > 1 ? "s" : ""} reçu${n > 1 ? "s" : ""} sur la période`,
    tileExpenses: "Dépenses",
    tileBalance: "Solde de caisse",
    tileBalanceHint: "Recettes − dépenses de la période",

    sectionRevenue: "Recettes par type",
    colType: "Type",
    colCollected: "Encaissé",
    total: "Total",
    noRevenue: "Aucun paiement reçu sur la période.",

    sectionExpenses: "Dépenses par catégorie",
    colCategory: "Catégorie",
    colAmount: "Montant",
    noExpenses: "Aucune dépense sur la période.",

    sectionByManager: "Par responsable",
    colManager: "Responsable",
    colRevenue: "Recette",
    colExpense: "Dépense",
    colBalance: "Solde",
    finalAccounting: "Compta finale — école",
    unassigned: "Non attribué",

    sectionDaily: "Détail journalier",
    dailyHint: "Seuls les jours où de l'argent est entré ou sorti sont listés.",
    colDate: "Date",
    colRevenues: "Recettes",
    colExpenses: "Dépenses",
    colDayBalance: "Solde du jour",
    colCumul: "Cumul",
    noMovement: "Aucun mouvement de caisse sur la période.",

    // Libellés des types de recettes (« Inscriptions »...) : le français est
    // fourni par le calcul du rapport, seul l'arabe passe par ici.
    revenueLabels: {} as Record<string, string>,

    collectionsNote: "Ce rapport suit l'argent réellement reçu et dépensé. Les montants attendus et les impayés sont dans",
    collectionsLink: "Recouvrement",

    discountCount: (n: number) =>
      `${n} réduction${n > 1 ? "s" : ""} active${n > 1 ? "s" : ""} sur la période sélectionnée.`,

    signedBy: "Établi par — date",
    verifiedBy: "Vérifié par — date",
  },
  ar: {
    pageTitle: "التقرير المالي",
    period: (from: string, to: string) => `من ${from} إلى ${to}`,
    generatedAt: (date: string) => ` · تاريخ الإصدار ${date}`,
    exportExcel: "تصدير Excel",
    exportPdf: "تقرير PDF",
    filterFrom: "من",
    filterTo: "إلى",
    apply: "تطبيق",

    tileCollected: "الإيرادات المحصلة",
    tileCollectedHint: (n: number) => `${n} دفعة مستلمة خلال الفترة`,
    tileExpenses: "المصاريف",
    tileBalance: "رصيد الصندوق",
    tileBalanceHint: "إيرادات − مصاريف الفترة",

    sectionRevenue: "الإيرادات حسب النوع",
    colType: "النوع",
    colCollected: "المحصّل",
    total: "المجموع",
    noRevenue: "لم تُستلم أي دفعة خلال الفترة.",

    sectionExpenses: "المصاريف حسب الفئة",
    colCategory: "الفئة",
    colAmount: "المبلغ",
    noExpenses: "لا توجد مصاريف خلال الفترة.",

    sectionByManager: "حسب المسؤول",
    colManager: "المسؤول",
    colRevenue: "الإيراد",
    colExpense: "المصروف",
    colBalance: "الرصيد",
    finalAccounting: "المحاسبة النهائية — المدرسة",
    unassigned: "غير مسند",

    sectionDaily: "التفصيل اليومي",
    dailyHint: "تُعرض فقط الأيام التي دخلت أو خرجت فيها أموال.",
    colDate: "التاريخ",
    colRevenues: "الإيرادات",
    colExpenses: "المصاريف",
    colDayBalance: "رصيد اليوم",
    colCumul: "المجموع التراكمي",
    noMovement: "لا توجد حركة في الصندوق خلال الفترة.",

    revenueLabels: {
      inscription: "التسجيل",
      mensualite: "الشهريات",
      uniforme: "الزي الموحد",
      transport: "النقل",
      non_affecte: "دفعات مسبقة غير مخصصة بعد",
    } as Record<string, string>,

    collectionsNote: "يتتبع هذا التقرير الأموال المستلمة والمصروفة فعلاً. المبالغ المتوقعة والمتأخرات موجودة في",
    collectionsLink: "التحصيل",

    discountCount: (n: number) => `${n} تخفيض نشط خلال الفترة المحددة.`,

    signedBy: "أُعِدّ من طرف — التاريخ",
    verifiedBy: "تم التحقق من طرف — التاريخ",
  },
};
