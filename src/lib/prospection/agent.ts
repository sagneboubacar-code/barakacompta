import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// Agent de prospection : il cherche sur le web des écoles privées sénégalaises
// susceptibles d'utiliser Baraka Compta, et rend des fiches vérifiables.
//
// La règle qui gouverne tout ce fichier : l'agent ne rapporte que ce qu'il a
// lu sur une page qu'il a réellement ouverte, et chaque fiche porte l'URL de
// cette page. Une liste de vingt écoles inventées avec vingt numéros
// plausibles serait pire qu'une liste vide — elle ferait perdre des heures en
// appels vers des numéros qui n'existent pas.

const ProspectSchema = z.object({
  nom: z.string().describe("Nom exact de l'établissement, tel qu'écrit sur la page source"),
  ville: z.string().describe("Ville ou commune. Chaîne vide si la page ne le dit pas."),
  quartier: z.string().describe("Quartier si la page le précise, sinon chaîne vide"),
  telephone: z.string().describe("Téléphone tel qu'affiché sur la page. Chaîne vide si absent — ne jamais en inventer un."),
  email: z.string().describe("E-mail affiché sur la page, chaîne vide si absent"),
  email_fiable: z
    .boolean()
    .describe(
      "false si l'adresse appartient au domaine de l'annuaire (ex. @academie-plus.com), donc une adresse relais et non celle de l'école"
    ),
  type_etablissement: z
    .string()
    .describe("Ce que dit la page : franco-arabe, privé général, coranique, préscolaire…"),
  source_url: z.string().describe("URL exacte de la page où ces informations ont été lues"),
  score: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe("5 = correspond parfaitement au client type, 1 = hors cible"),
  pourquoi: z.string().describe("Une phrase justifiant la note, fondée sur ce qui est écrit sur la page"),
  accroche: z
    .string()
    .describe("Message de premier contact WhatsApp, 2 à 3 phrases, en français, personnalisé pour cette école"),
});

const ResultatSchema = z.object({
  prospects: z.array(ProspectSchema),
  sources_consultees: z.array(z.string()).describe("URL des pages effectivement ouvertes"),
  commentaire: z.string().describe("Ce qui a été trouvé ou non, en une ou deux phrases"),
});

export type Prospect = z.infer<typeof ProspectSchema>;
export type ResultatProspection = z.infer<typeof ResultatSchema>;

// Ce que l'agent doit savoir du produit pour juger si une école est une cible.
// Écrit en clair plutôt qu'en mots-clés : c'est ce qui lui permet de rédiger
// une accroche qui parle à une directrice d'école, pas une publicité générique.
const CONTEXTE_PRODUIT = `
Baraka Compta est un logiciel de gestion financière pour écoles privées au Sénégal.
Ce qu'il fait concrètement :
- tarifs par classe et par régime (externat/internat), mensualités, inscription, uniforme,
  tenue de sport, fournitures, cantine, transport par zones, cours de renforcement ;
- échéancier automatique par élève : qui doit quoi, à quelle date ;
- recouvrement : la liste des familles en retard, avec le montant et le contact du parent ;
- rapport financier mensuel en PDF, signable, présentable à un bailleur ou à une assemblée ;
- interface français et arabe.
Tarifs : essai gratuit, puis Basic 15 000 F CFA/mois (jusqu'à 150 élèves) ou Pro 25 000 F CFA/mois.

Le client type :
- école PRIVÉE (les écoles publiques ne gèrent pas leurs frais ainsi) ;
- de préférence franco-arabe ou coranique moderne — c'est là que le bilingue arabe compte ;
- région de Dakar et banlieue en priorité (Guédiawaye, Pikine, Parcelles, Thiaroye, Malika),
  puis Thiès, Mbour, Touba ;
- assez d'élèves pour que le suivi papier devienne douloureux (à partir d'une centaine) ;
- joignable : un numéro de téléphone vérifiable vaut mieux qu'une belle page sans contact.
`.trim();

const CONSIGNES = `
Tu cherches des écoles privées sénégalaises à démarcher pour Baraka Compta.

RÈGLES ABSOLUES, dans cet ordre de priorité :

1. N'invente RIEN. Chaque école rapportée doit venir d'une page que tu as réellement
   ouverte avec web_fetch. Tu recopies ce qui y est écrit. Si tu n'as pas ouvert de page
   contenant cette école, tu ne la rapportes pas.
2. N'invente JAMAIS un numéro de téléphone ni une adresse e-mail. Si la page n'en donne
   pas, laisse le champ vide. Un champ vide est une information utile ; un faux numéro
   fait perdre un appel et décrédibilise.
3. source_url doit être l'URL exacte de la page lue, pas la page d'accueil du site ni un
   lien de recherche.
4. Mieux vaut rapporter 5 fiches solides que 20 approximatives. La quantité n'a aucune
   valeur ici.
5. Ne rapporte pas d'école publique, ni d'université, ni de centre de formation pour
   adultes : ce ne sont pas des clients.

Méthode : commence par une recherche web pour repérer les annuaires et pages pertinents,
puis OUVRE les pages les plus prometteuses avec web_fetch pour en extraire les fiches.
Les annuaires d'établissements scolaires sénégalais sont la meilleure source.

Pour chaque école, rédige une accroche WhatsApp de premier contact : polie, directe,
qui nomme un problème concret (familles en retard de paiement, reçus manuels, comptes de
fin de mois) plutôt que de vanter un "logiciel innovant". Vouvoiement. Pas d'emoji.
`.trim();

export interface OptionsProspection {
  /** Zone ou requête : "Guédiawaye", "écoles franco-arabes Thiès"… */
  zone: string;
  /** Plafond de fiches demandées — borne aussi le coût de l'appel. */
  maxProspects?: number;
  /** Noms déjà en base, pour ne pas re-proposer les mêmes écoles. */
  dejaConnus?: string[];
}

export async function chercherProspects(
  options: OptionsProspection
): Promise<ResultatProspection> {
  const { zone, maxProspects = 10, dejaConnus = [] } = options;

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY manquante : ajoutez-la dans les variables d'environnement pour activer la prospection."
    );
  }

  const client = new Anthropic();

  const exclusions =
    dejaConnus.length > 0
      ? `\n\nÉcoles DÉJÀ en base, à ne pas reproposer :\n${dejaConnus.map((n) => `- ${n}`).join("\n")}`
      : "";

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    system: `${CONTEXTE_PRODUIT}\n\n---\n\n${CONSIGNES}`,
    // `max_uses` borne le nombre d'appels aux outils, donc le coût d'une
    // recherche : sans plafond, une requête vague peut partir très loin.
    tools: [
      { type: "web_search_20260209", name: "web_search", max_uses: 8 },
      { type: "web_fetch_20260209", name: "web_fetch", max_uses: 8 },
    ],
    output_config: { format: zodOutputFormat(ResultatSchema) },
    messages: [
      {
        role: "user",
        content: `Trouve jusqu'à ${maxProspects} écoles privées à démarcher dans cette zone : ${zone}.${exclusions}`,
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("L'agent n'a pas renvoyé de résultat exploitable. Réessayez.");
  }

  // Dernier filet côté code : même si le modèle ignorait la consigne, une fiche
  // sans source vérifiable ne doit jamais atteindre la base.
  const retenus = parsed.prospects.filter(
    (p) => p.nom.trim() !== "" && /^https?:\/\/.+\..+/.test(p.source_url)
  );

  return { ...parsed, prospects: retenus.slice(0, maxProspects) };
}
