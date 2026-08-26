export const dashboardBillingDict = {
  fr: {
    title: "Abonnement",
    upgradeNotice: (moduleLabel: string, planLabel: string) =>
      `Le module « ${moduleLabel} » n'est pas inclus dans votre plan actuel (${planLabel}).`,
    expiredTitle: "Abonnement expiré",
    expiredText: (date: string) =>
      `L'accès aux fonctionnalités de l'école est bloqué depuis le ${date}. Renouvelez votre abonnement ci-dessous pour rétablir l'accès.`,
    activePrefix: "Plan ",
    activeSuffix: (date: string, days: number) =>
      ` actif jusqu'au ${date} (${days} jour${days > 1 ? "s" : ""} restant${days > 1 ? "s" : ""}).`,
    notOwner: "Seul le propriétaire de l'école peut renouveler l'abonnement. Contactez-le si l'accès est bloqué.",
    free: "Gratuit",
    perMonth: "/mois",
    unlimitedStudents: "Élèves illimités",
    upToStudents: (n: number) => `Jusqu'à ${n} élèves`,
    coreLine: "Élèves, tarifs, paiements, dépenses",
    trialDaysLine: (n: number) => `${n} jours d'essai`,
    currentPlan: "Plan actuel",
    reservedNewTrial: "Réservé au nouvel essai",
    paymentMethodPlaceholder: "Moyen de paiement",
    wave: "Wave",
    orangeMoney: "Orange Money",
    card: "Carte bancaire",
    requestRenewal: "Demander le renouvellement",
    secureRedirectNote:
      "Vous serez redirigé vers une page de paiement sécurisée (Wave, Orange Money ou carte bancaire). Si le paiement en ligne n'est pas disponible, votre demande reste enregistrée et notre équipe vous contacte pour finaliser l'activation.",
    historyTitle: "Historique des demandes",
    colDate: "Date",
    colPlan: "Plan",
    colAmount: "Montant",
    colMethod: "Moyen",
    colStatus: "Statut",
    noHistory: "Aucune demande enregistrée.",
    moduleLabels: { collections: "Recouvrement", reports: "Rapports financiers" } as Record<string, string>,
    paymentMethodLabels: {
      wave: "Wave",
      orange_money: "Orange Money",
      card: "Carte bancaire",
      chariow: "Chariow",
      manual: "Manuel",
    } as Record<string, string>,
    paymentStatusLabels: {
      pending: "En attente",
      completed: "Confirmé",
      failed: "Échoué",
      cancelled: "Annulé",
    } as Record<string, string>,
    planLabels: { trial: "Essai gratuit", basic: "Basic", pro: "Pro", premium: "Premium" } as Record<string, string>,
  },
  ar: {
    title: "الاشتراك",
    upgradeNotice: (moduleLabel: string, planLabel: string) =>
      `الوحدة «${moduleLabel}» غير مشمولة في خطتك الحالية (${planLabel}).`,
    expiredTitle: "الاشتراك منتهي",
    expiredText: (date: string) =>
      `تم حظر الوصول إلى ميزات المدرسة منذ ${date}. جدّد اشتراكك أدناه لاستعادة الوصول.`,
    activePrefix: "الخطة ",
    activeSuffix: (date: string, days: number) => {
      let daysLabel: string;
      if (days === 1) daysLabel = "يوم واحد متبقٍ";
      else if (days === 2) daysLabel = "يومان متبقيان";
      else if (days <= 10) daysLabel = `${days} أيام متبقية`;
      else daysLabel = `${days} يومًا متبقيًا`;
      return ` نشطة حتى ${date} (${daysLabel}).`;
    },
    notOwner: "فقط مالك المدرسة يمكنه تجديد الاشتراك. تواصل معه إذا كان الوصول محظورًا.",
    free: "مجاني",
    perMonth: "/شهريًا",
    unlimitedStudents: "عدد غير محدود من التلاميذ",
    upToStudents: (n: number) => `حتى ${n} تلميذًا`,
    coreLine: "التلاميذ، الرسوم، المدفوعات، المصاريف",
    trialDaysLine: (n: number) => `${n} أيام تجربة مجانية`,
    currentPlan: "الخطة الحالية",
    reservedNewTrial: "مخصص للتجربة الجديدة فقط",
    paymentMethodPlaceholder: "وسيلة الدفع",
    wave: "Wave",
    orangeMoney: "Orange Money",
    card: "بطاقة بنكية",
    requestRenewal: "طلب التجديد",
    secureRedirectNote:
      "سيتم توجيهك إلى صفحة دفع آمنة (Wave أو Orange Money أو بطاقة بنكية). إذا لم يكن الدفع عبر الإنترنت متاحًا، يبقى طلبك مسجلاً وسيتواصل معك فريقنا لإتمام التفعيل.",
    historyTitle: "سجل الطلبات",
    colDate: "التاريخ",
    colPlan: "الخطة",
    colAmount: "المبلغ",
    colMethod: "الوسيلة",
    colStatus: "الحالة",
    noHistory: "لا يوجد أي طلب مسجّل.",
    moduleLabels: { collections: "التحصيل", reports: "التقارير المالية" } as Record<string, string>,
    paymentMethodLabels: {
      wave: "Wave",
      orange_money: "Orange Money",
      card: "بطاقة بنكية",
      chariow: "Chariow",
      manual: "يدوي",
    } as Record<string, string>,
    paymentStatusLabels: {
      pending: "قيد الانتظار",
      completed: "مؤكد",
      failed: "فشل",
      cancelled: "ملغى",
    } as Record<string, string>,
    planLabels: { trial: "تجربة مجانية", basic: "Basic", pro: "Pro", premium: "Premium" } as Record<string, string>,
  },
};
