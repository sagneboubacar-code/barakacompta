// Source des tutoriels vidéo affichés sur /tutoriels. Pour ajouter une
// vidéo : récupère l'ID YouTube dans son URL (https://youtu.be/XXXXXXXXXXX
// ou https://www.youtube.com/watch?v=XXXXXXXXXXX — c'est la partie après
// "v=" ou après "youtu.be/"), puis ajoute une entrée ci-dessous.
export interface Tutorial {
  youtubeId: string;
  title: { fr: string; ar: string };
  category: "elèves" | "paiements" | "tarifs" | "rapports" | "general";
}

export const TUTORIALS: Tutorial[] = [
  // Exemple à dupliquer/adapter :
  // {
  //   youtubeId: "dQw4w9WgXcQ",
  //   title: { fr: "Ajouter un élève", ar: "إضافة تلميذ" },
  //   category: "elèves",
  // },
];
