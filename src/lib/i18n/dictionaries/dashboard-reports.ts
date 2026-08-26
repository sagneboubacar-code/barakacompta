export const dashboardReportsDict = {
  fr: {
    pageTitle: "Rapport financier",
    period: (from: string, to: string) => `Du ${from} au ${to}`,
    generatedAt: (date: string) => ` · généré le ${date}`,
    exportExcel: "Export Excel",
    filterFrom: "Du",
    filterTo: "Au",
    apply: "Appliquer",

    tileExpected: "Attendu",
    tileCollected: "Encaissé",
    tileRemaining: "À recouvrer",
    tileBalance: "Solde (recettes − dépenses)",

    sectionRevenue: "Recettes détaillées",
    colType: "Type",
    colExpected: "Attendu",
    colCollected: "Encaissé",
    colRemaining: "Reste",
    total: "Total",

    sectionExpenses: "Dépenses par catégorie",
    colCategory: "Catégorie",
    colAmount: "Montant",

    sectionByManager: "Par responsable",
    colManager: "Responsable",
    colRevenue: "Recette",
    colExpense: "Dépense",
    colBalance: "Solde",
    finalAccounting: "Compta finale — école",
    unassigned: "Non attribué",

    sectionDaily: "Détail journalier",
    colDate: "Date",
    colRevenues: "Recettes",
    colExpenses: "Dépenses",

    revenueLabels: {
      inscription: "Inscriptions",
      uniforme: "Uniforme",
      mensualite: "Mensualités",
      autres: "Autres frais",
    } as Record<string, string>,

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
    filterFrom: "من",
    filterTo: "إلى",
    apply: "تطبيق",

    tileExpected: "المتوقع",
    tileCollected: "المحصّل",
    tileRemaining: "المتبقي تحصيله",
    tileBalance: "الرصيد (الإيرادات − المصاريف)",

    sectionRevenue: "الإيرادات التفصيلية",
    colType: "النوع",
    colExpected: "المتوقع",
    colCollected: "المحصّل",
    colRemaining: "المتبقي",
    total: "المجموع",

    sectionExpenses: "المصاريف حسب الفئة",
    colCategory: "الفئة",
    colAmount: "المبلغ",

    sectionByManager: "حسب المسؤول",
    colManager: "المسؤول",
    colRevenue: "الإيراد",
    colExpense: "المصروف",
    colBalance: "الرصيد",
    finalAccounting: "المحاسبة النهائية — المدرسة",
    unassigned: "غير مسند",

    sectionDaily: "التفصيل اليومي",
    colDate: "التاريخ",
    colRevenues: "الإيرادات",
    colExpenses: "المصاريف",

    revenueLabels: {
      inscription: "التسجيل",
      uniforme: "الزي الموحد",
      mensualite: "الشهريات",
      autres: "رسوم أخرى",
    } as Record<string, string>,

    discountCount: (n: number) => `${n} تخفيض نشط خلال الفترة المحددة.`,

    signedBy: "أُعِدّ من طرف — التاريخ",
    verifiedBy: "تم التحقق من طرف — التاريخ",
  },
};
