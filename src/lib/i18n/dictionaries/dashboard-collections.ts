export const dashboardCollectionsDict = {
  fr: {
    title: "Recouvrement",
    summary: (overdueCount: number, monthLabel: string, totalDue: number | string) =>
      `${overdueCount} élève${overdueCount > 1 ? "s" : ""} impayé${overdueCount > 1 ? "s" : ""} sur ${monthLabel} · ${totalDue} restant dû pour ce mois.`,
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
    colRemaining: "Montant restant (mois)",
    colStatus: "Statut",
    statusOk: "À jour",
    statusPartial: "Partiel ce mois",
    statusOverdue: "Impayé",
    noStudents: "Aucun élève ne correspond à ces critères.",
  },
  ar: {
    title: "التحصيل",
    summary: (overdueCount: number, monthLabel: string, totalDue: number | string) => {
      let label: string;
      if (overdueCount === 0) label = "لا يوجد تلاميذ متأخرون في السداد";
      else if (overdueCount === 1) label = "تلميذ واحد متأخر في السداد";
      else if (overdueCount === 2) label = "تلميذان متأخران في السداد";
      else if (overdueCount <= 10) label = `${overdueCount} تلاميذ متأخرون في السداد`;
      else label = `${overdueCount} تلميذًا متأخرًا في السداد`;
      return `${label} في ${monthLabel} · ${totalDue} متبقٍ لهذا الشهر.`;
    },
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
    colRemaining: "المبلغ المتبقي (الشهر)",
    colStatus: "الحالة",
    statusOk: "منتظم",
    statusPartial: "جزئي هذا الشهر",
    statusOverdue: "غير مسدد",
    noStudents: "لا يوجد أي تلميذ مطابق لهذه المعايير.",
  },
};
