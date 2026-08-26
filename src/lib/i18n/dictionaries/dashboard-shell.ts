export const navLabelsDict: Record<string, { fr: string; ar: string }> = {
  "/dashboard": { fr: "Tableau de bord", ar: "لوحة التحكم" },
  "/dashboard/students": { fr: "Élèves", ar: "التلاميذ" },
  "/dashboard/fee-structures": { fr: "Tarifs", ar: "الرسوم" },
  "/dashboard/collections": { fr: "Recouvrement", ar: "التحصيل" },
  "/dashboard/reports": { fr: "Rapports", ar: "التقارير" },
  "/dashboard/payments": { fr: "Paiements", ar: "المدفوعات" },
  "/dashboard/expenses": { fr: "Dépenses", ar: "المصاريف" },
  "/dashboard/transfers": { fr: "Transferts", ar: "التحويلات" },
  "/dashboard/billing": { fr: "Abonnement", ar: "الاشتراك" },
  "/dashboard/settings": { fr: "Paramètres", ar: "الإعدادات" },
};

export const roleLabelsDict: Record<string, { fr: string; ar: string }> = {
  owner: { fr: "Propriétaire", ar: "المالك" },
  admin: { fr: "Administrateur", ar: "المدير" },
  accountant: { fr: "Comptable", ar: "المحاسب" },
  super_admin: { fr: "Staff Baraka", ar: "فريق بركة" },
};

export const sidebarDict = {
  fr: { openMenu: "Ouvrir le menu", signOut: "Déconnexion" },
  ar: { openMenu: "فتح القائمة", signOut: "تسجيل الخروج" },
};
