export const dashboardReceiptDict = {
  fr: {
    receiptTitle: "Reçu de paiement",
    student: "Élève",
    date: "Date",
    amount: "Montant",
    paymentMethod: "Moyen de paiement",
    reference: "Référence",
    coveredSchedules: "Échéances couvertes",
    dash: "—",
    receiptNumber: (id: string) => `Reçu #${id}`,
  },
  ar: {
    receiptTitle: "إيصال دفع",
    student: "التلميذ",
    date: "التاريخ",
    amount: "المبلغ",
    paymentMethod: "طريقة الدفع",
    reference: "المرجع",
    coveredSchedules: "الاستحقاقات المغطاة",
    dash: "—",
    receiptNumber: (id: string) => `إيصال رقم ${id}`,
  },
};
