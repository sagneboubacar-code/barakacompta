export const dashboardCollectionsDict = {
  fr: {
    title: "Recouvrement",
    summary: (overdueCount: number, monthLabel: string) =>
      overdueCount === 0
        ? `Aucun élève en retard sur ${monthLabel}.`
        : `${overdueCount} élève${overdueCount > 1 ? "s" : ""} en retard sur ${monthLabel}.`,
    tileTotal: (monthLabel: string) => `Recette totale — ${monthLabel}`,
    tileTotalHint: "Tout ce qui doit rentrer ce mois-ci, si tous les élèves paient",
    rowOverduePart: (amount: string) => `dont ${amount} en retard`,
    tileCollected: "Déjà encaissé :",
    tileRemaining: "Reste :",
    tileOverdue: "Déjà en retard",
    tileOverdueHint: "Échéance passée, pas encore payée",
    tileUpcoming: "À encaisser",
    tileUpcomingHint: (date: string) => `Échéance le ${date}`,
    tileUpcomingNone: "Rien qui ne soit pas encore échu",
    exportExcel: "Export Excel",
    cycle: "Cycle",
    all: "Tous",
    class: "Classe",
    allFem: "Toutes",
    month: "Mois",
    filter: "Filtrer",
    colStudent: "Élève",
    colClass: "Classe",
    colParent: "Parent",
    colParentPhone: "Téléphone parent",
    colRemaining: (monthLabel: string) => `Reste à payer (${monthLabel})`,
    colStatus: "Statut",
    statusOk: "À jour",
    statusPartial: "Partiel, en retard",
    statusOverdue: "Impayé",
    statusUpcoming: "À encaisser",
    noStudents: "Aucun élève ne correspond à ces critères.",
  },
  ar: {
    title: "التحصيل",
    summary: (overdueCount: number, monthLabel: string) => {
      let label: string;
      if (overdueCount === 0) label = "لا يوجد تلاميذ متأخرون في السداد";
      else if (overdueCount === 1) label = "تلميذ واحد متأخر في السداد";
      else if (overdueCount === 2) label = "تلميذان متأخران في السداد";
      else if (overdueCount <= 10) label = `${overdueCount} تلاميذ متأخرون في السداد`;
      else label = `${overdueCount} تلميذًا متأخرًا في السداد`;
      return `${label} في ${monthLabel}.`;
    },
    tileTotal: (monthLabel: string) => `مجموع المداخيل — ${monthLabel}`,
    tileTotalHint: "كل ما يجب تحصيله هذا الشهر إذا دفع جميع التلاميذ",
    rowOverduePart: (amount: string) => `منها ${amount} متأخرة`,
    tileCollected: "تم تحصيله:",
    tileRemaining: "المتبقي:",
    tileOverdue: "متأخر",
    tileOverdueHint: "تجاوز تاريخ الاستحقاق ولم يُدفع بعد",
    tileUpcoming: "للتحصيل قريباً",
    tileUpcomingHint: (date: string) => `تاريخ الاستحقاق ${date}`,
    tileUpcomingNone: "لا يوجد مبلغ لم يحن أجله",
    exportExcel: "تصدير Excel",
    cycle: "الطور",
    all: "الكل",
    class: "القسم",
    allFem: "الكل",
    month: "الشهر",
    filter: "تصفية",
    colStudent: "التلميذ",
    colClass: "القسم",
    colParent: "ولي الأمر",
    colParentPhone: "هاتف ولي الأمر",
    colRemaining: (monthLabel: string) => `المتبقي للدفع (${monthLabel})`,
    colStatus: "الحالة",
    statusOk: "منتظم",
    statusPartial: "جزئي، متأخر",
    statusOverdue: "غير مسدد",
    statusUpcoming: "للتحصيل",
    noStudents: "لا يوجد أي تلميذ مطابق لهذه المعايير.",
  },
};
