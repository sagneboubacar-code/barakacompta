// Exercice comptable de l'année scolaire active : 12 mois, du mois de
// rentrée jusqu'à la veille de la rentrée suivante (septembre → août).
//
// Jusqu'au 21 octobre 2026, il s'arrêtait au mois de fin des cours (juin) :
// l'argent reçu en juillet et en août n'appartenait à aucune année. Avec
// l'internat payé les 12 mois (0043_internat_mensuel.sql), ces mois comptent
// dans la seule comptabilité de l'école.
//
// Partagée par le tableau de bord, la liste des encaissements d'un
// responsable et le bilan de l'internat : tous comptent les mêmes paiements.
export function schoolYearBounds(school: {
  school_year_label: string | null;
  school_year_start_month: number;
  school_year_end_month?: number;
}) {
  const now = new Date();
  const [startYearStr] = (school.school_year_label ?? "").split("-");
  const startYear = Number(startYearStr) || now.getFullYear();
  const pad = (n: number) => String(n).padStart(2, "0");
  const startMonth = school.school_year_start_month;
  // Veille de la rentrée suivante : le jour 0 du mois de rentrée, un an plus tard.
  const lastDay = new Date(Date.UTC(startYear + 1, startMonth - 1, 0));
  return {
    from: `${startYear}-${pad(startMonth)}-01`,
    to: lastDay.toISOString().slice(0, 10),
  };
}
