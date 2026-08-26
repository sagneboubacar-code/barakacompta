export const adminDict = {
  fr: {
    brand: "Baraka Compta — Admin",
    signOut: "Déconnexion",

    kpiTotalSchools: "Écoles au total",
    kpiActiveSubs: "Abonnements actifs",
    kpiTrial: "En essai gratuit",
    kpiExpired: "Expirés",
    kpiTotalRevenue: "Chiffre d'affaires total",
    kpiMonthRevenue: "Chiffre d'affaires ce mois-ci",

    revenueByPlan: "Chiffre d'affaires par plan",
    colPlan: "Plan",
    colSchools: "Écoles",
    colTotalRevenue: "Revenu total",

    schoolsSection: (count: number) => `Écoles (${count})`,
    colSchool: "École",
    colStatus: "Statut",
    colExpiresOn: "Expire le",
    colRegisteredOn: "Inscrite le",
    statusActive: "Actif",
    statusExpired: "Expiré",
    noSchools: "Aucune école pour l'instant.",

    recentPayments: "Derniers paiements confirmés",
    colDate: "Date",
    colAmount: "Montant",
    colMethod: "Moyen",
    noPayments: "Aucun paiement confirmé pour l'instant.",

    planLabels: {
      trial: "Essai",
      basic: "Basic",
      pro: "Pro",
      premium: "Premium",
    } as Record<string, string>,
  },
  ar: {
    brand: "Baraka Compta — الإدارة",
    signOut: "تسجيل الخروج",

    kpiTotalSchools: "إجمالي المدارس",
    kpiActiveSubs: "الاشتراكات النشطة",
    kpiTrial: "في التجربة المجانية",
    kpiExpired: "منتهية",
    kpiTotalRevenue: "إجمالي الإيرادات",
    kpiMonthRevenue: "إيرادات هذا الشهر",

    revenueByPlan: "الإيرادات حسب الخطة",
    colPlan: "الخطة",
    colSchools: "المدارس",
    colTotalRevenue: "إجمالي الإيراد",

    schoolsSection: (count: number) => `المدارس (${count})`,
    colSchool: "المدرسة",
    colStatus: "الحالة",
    colExpiresOn: "تنتهي في",
    colRegisteredOn: "تاريخ التسجيل",
    statusActive: "نشط",
    statusExpired: "منتهي",
    noSchools: "لا توجد مدرسة حاليًا.",

    recentPayments: "آخر المدفوعات المؤكدة",
    colDate: "التاريخ",
    colAmount: "المبلغ",
    colMethod: "الوسيلة",
    noPayments: "لا توجد مدفوعات مؤكدة حاليًا.",

    planLabels: {
      trial: "تجريبي",
      basic: "أساسي",
      pro: "احترافي",
      premium: "متميز",
    } as Record<string, string>,
  },
};
