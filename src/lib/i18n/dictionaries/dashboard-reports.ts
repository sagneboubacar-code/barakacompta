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
    tileStudents: "Élèves",
    tileStudentsHint: "Élèves actifs aujourd'hui",
    tileInscription: "Inscription encaissée",
    tileUniform: "Uniforme encaissé",
    tileReceivable: "Montant à recouvrir",
    tileReceivableHint: "Reste à payer sur les échéances de la période",
    tileOverdueStudents: "Élèves impayés",
    tileOverdueStudentsHint: "En retard sur une échéance de la période",

    sectionRevenue: "Recettes par type",
    colType: "Type",
    colCollected: "Encaissé",
    total: "Total",
    noRevenue: "Aucun paiement reçu sur la période.",

    sectionExpenses: "Dépenses par catégorie",
    colCategory: "Catégorie",
    colAmount: "Montant",
    noExpenses: "Aucune dépense sur la période.",

    sectionExpenseDetails: "Détail des dépenses",
    expenseDetailsHint: "Chaque dépense de la période, avec sa description, regroupée par catégorie.",
    colDescription: "Description",

    sectionByManager: "Par responsable",
    byManagerHint: "Cliquez sur un responsable pour voir le détail de ses recettes, dépenses et transferts, à pointer avec sa caisse.",
    colManager: "Responsable",
    colRevenue: "Recette",
    colExpense: "Dépense",
    colTransfers: "Transferts",
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

    collectionsNote:
      "Recettes, dépenses et solde : l'argent réellement reçu et dépensé pendant la période. Le détail des impayés, élève par élève, est dans",
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
    tileStudents: "التلاميذ",
    tileStudentsHint: "التلاميذ النشطون اليوم",
    tileInscription: "التسجيل المحصّل",
    tileUniform: "الزي المحصّل",
    tileReceivable: "المبلغ المتبقي تحصيله",
    tileReceivableHint: "المتبقي على استحقاقات الفترة",
    tileOverdueStudents: "التلاميذ المتأخرون",
    tileOverdueStudentsHint: "متأخرون في استحقاق من الفترة",

    sectionRevenue: "الإيرادات حسب النوع",
    colType: "النوع",
    colCollected: "المحصّل",
    total: "المجموع",
    noRevenue: "لم تُستلم أي دفعة خلال الفترة.",

    sectionExpenses: "المصاريف حسب الفئة",
    colCategory: "الفئة",
    colAmount: "المبلغ",
    noExpenses: "لا توجد مصاريف خلال الفترة.",

    sectionExpenseDetails: "تفاصيل المصاريف",
    expenseDetailsHint: "كل مصروف خلال الفترة مع وصفه، مجمّعة حسب الفئة.",
    colDescription: "الوصف",

    sectionByManager: "حسب المسؤول",
    byManagerHint: "انقروا على مسؤول لعرض تفاصيل إيراداته ومصاريفه وتحويلاته، لمطابقتها مع صندوقه.",
    colManager: "المسؤول",
    colRevenue: "الإيراد",
    colExpense: "المصروف",
    colTransfers: "التحويلات",
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

    collectionsNote:
      "الإيرادات والمصاريف والرصيد: الأموال المستلمة والمصروفة فعلاً خلال الفترة. تفاصيل المتأخرات، تلميذاً تلميذاً، موجودة في",
    collectionsLink: "التحصيل",

    discountCount: (n: number) => `${n} تخفيض نشط خلال الفترة المحددة.`,

    signedBy: "أُعِدّ من طرف — التاريخ",
    verifiedBy: "تم التحقق من طرف — التاريخ",
  },
};
