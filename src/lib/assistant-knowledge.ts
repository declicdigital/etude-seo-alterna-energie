/**
 * Connaissances de l'assistant Digicom : mode d'emploi de chaque rubrique et zones vers
 * lesquelles il peut renvoyer. Partagé par le serveur (contexte du modèle) et le navigateur
 * (réponses de secours sans IA). À tenir à jour quand une fonctionnalité change.
 */
import { type RubriqueKey } from "./rubriques";
import { sheetAllowed } from "./sections";

export type AssistantZone = {
  id: string;
  label: string;
  /** Chemin interne, utilisé tel quel dans les liens de réponse. */
  path: string;
  /** Rubrique de la zone ; « all » pour tout compte validé, « admin » pour les administrateurs. */
  needs: RubriqueKey | "all" | "admin";
  /** Feuille exacte qui doit être ouverte à la personne (même règle que le menu, sous-rubrique comprise). */
  sheet?: string;
  keywords: string[];
};

export const ASSISTANT_ZONES: AssistantZone[] = [
  {
    id: "accueil",
    label: "Accueil",
    path: "/accueil",
    needs: "all",
    keywords: ["accueil", "début", "rubriques"],
  },
  {
    id: "guide",
    label: "Guide de l'outil",
    path: "/guide",
    needs: "all",
    keywords: ["guide", "mode d'emploi", "modop", "aide", "tuto"],
  },
  {
    id: "kit",
    label: "Kit de communication",
    path: "/kit-communication",
    needs: "all",
    keywords: ["kit", "logo", "charte", "ressources", "téléchargement", "zip", "communication"],
  },
  {
    id: "demandes",
    label: "Demandes d'accès",
    path: "/demandes",
    needs: "admin",
    keywords: [
      "accès",
      "demande",
      "compte",
      "valider",
      "inviter",
      "invitation",
      "droits",
      "autorisation",
    ],
  },
  {
    id: "pac-suivi",
    sheet: "SUIVI STRATEGIE",
    label: "Stratégie PAC · Suivi éditorial",
    path: "/strategie-pac/suivi-editorial",
    needs: "pac",
    keywords: ["stratégie", "pac", "pompe à chaleur", "brief", "réécriture", "création", "suivi"],
  },
  {
    id: "pac-contenus",
    sheet: "STRATEGIE - ARTICLES",
    label: "Stratégie PAC · Contenus",
    path: "/strategie-pac/contenus",
    needs: "pac",
    keywords: ["stratégie", "pac", "contenus", "publiés", "liste"],
  },
  {
    id: "blog-suivi",
    sheet: "SUIVI EDITORIAL",
    label: "Blog · Suivi éditorial",
    path: "/blog/suivi-editorial",
    needs: "blog",
    keywords: [
      "blog",
      "article",
      "suivi",
      "rédaction",
      "image",
      "relecture",
      "intégration",
      "à rédiger",
      "deadline",
    ],
  },
  {
    id: "blog-part",
    sheet: "BLOG - ARTICLES::Particulier",
    label: "Blog · Particulier",
    path: "/blog/particulier",
    needs: "blog",
    keywords: ["blog", "particulier", "articles publiés", "liste"],
  },
  {
    id: "blog-pro",
    sheet: "BLOG - ARTICLES::Professionnel",
    label: "Blog · Professionnel",
    path: "/blog/professionnel",
    needs: "blog",
    keywords: ["blog", "pro", "professionnel", "articles publiés", "expert"],
  },
  {
    id: "planete-suivi",
    sheet: "SUIVI PLANETE",
    label: "Parlons Planète · Suivi éditorial",
    path: "/parlons-planete/suivi-editorial",
    needs: "planete",
    keywords: ["parlons planète", "planète", "suivi", "aurorae", "rédaction", "intégration"],
  },
  {
    id: "planete-blog",
    sheet: "PLANETE - ARTICLES",
    label: "Parlons Planète · Blog",
    path: "/parlons-planete/blog",
    needs: "planete",
    keywords: ["parlons planète", "planète", "blog", "catégorie", "sous-catégorie", "publiés"],
  },
  {
    id: "faq-demandes",
    sheet: "SUIVI FAQ",
    label: "FAQ · Demandes",
    path: "/faq/demandes",
    needs: "faq",
    keywords: ["faq", "question", "demande", "réponse"],
  },
  {
    id: "faq-part",
    sheet: "FAQ - DEMANDES::Particulier",
    label: "FAQ · Particulier",
    path: "/faq/particulier",
    needs: "faq",
    keywords: ["faq", "particulier", "questions validées"],
  },
  {
    id: "faq-pro",
    sheet: "FAQ - DEMANDES::Professionnel",
    label: "FAQ · Professionnel",
    path: "/faq/professionnel",
    needs: "faq",
    keywords: ["faq", "pro", "professionnel", "questions validées"],
  },
  {
    id: "benchmark",
    sheet: "BENCHMARK",
    label: "Benchmark",
    path: "/benchmark",
    needs: "benchmark",
    keywords: [
      "benchmark",
      "prix",
      "concurrent",
      "fournisseur",
      "offre",
      "ttc",
      "électricité",
      "gaz",
      "edf",
      "total",
    ],
  },
  {
    id: "nl-gc",
    sheet: "NEWSLETTER GRANDS COMPTES",
    label: "Newsletter Grands Comptes",
    path: "/calendriers-newsletters/grands-comptes",
    needs: "newsletters",
    keywords: ["newsletter", "grands comptes", "calendrier"],
  },
  {
    id: "nl-interne",
    sheet: "NEWSLETTER INTERNE",
    label: "Newsletter Interne",
    path: "/calendriers-newsletters/interne",
    needs: "newsletters",
    keywords: ["newsletter", "interne", "calendrier"],
  },
  {
    id: "nl-b2c",
    sheet: "NEWSLETTER B2C",
    label: "Newsletter B2C",
    path: "/calendriers-newsletters/b2c",
    needs: "newsletters",
    keywords: ["newsletter", "b2c", "calendrier"],
  },
  {
    id: "nl-sme",
    sheet: "NEWSLETTER SME",
    label: "Newsletter SME",
    path: "/calendriers-newsletters/sme",
    needs: "newsletters",
    keywords: ["newsletter", "sme", "calendrier"],
  },
  {
    id: "organisation",
    sheet: "ORGANISATION",
    label: "Organisation",
    path: "/organisation",
    needs: "organisation",
    keywords: [
      "organisation",
      "tâche",
      "tâches",
      "fiche",
      "note",
      "assigner",
      "taguer",
      "pièce jointe",
    ],
  },
  {
    id: "planning",
    sheet: "PLANNING INTEGRE",
    label: "Planning intégré",
    path: "/planning-integre",
    needs: "planning",
    keywords: [
      "planning",
      "planning intégré",
      "commercial",
      "campagne",
      "canal",
      "timeline",
      "jalon",
      "période",
    ],
  },
];

/** Zones que la personne peut ouvrir. */
export function zonesFor(allowed: string[] | null | undefined, isAdmin: boolean): AssistantZone[] {
  return ASSISTANT_ZONES.filter((z) =>
    z.needs === "all"
      ? true
      : z.needs === "admin"
        ? isAdmin
        : !!z.sheet && sheetAllowed(z.sheet, isAdmin ? null : allowed),
  );
}

/** Rubriques ouvertes à la personne (au moins une de leurs zones). */
export function rubriquesOf(zones: AssistantZone[]): Set<string> {
  return new Set(zones.filter((z) => z.needs !== "all" && z.needs !== "admin").map((z) => z.needs));
}

/** Fiches pratiques : servent de contexte au modèle et de réponses de secours. */
/** `zone` : zone requise (ou l'une de plusieurs) ; `answer` peut dépendre des zones ouvertes, pour ne jamais citer une rubrique fermée. */
type TopicDef = {
  zone: string | string[];
  title: string;
  keywords: string[];
  answer: string | ((zoneIds: Set<string>) => string);
};
export type AssistantTopic = {
  zone: string | string[];
  title: string;
  keywords: string[];
  answer: string;
};

export const ASSISTANT_TOPICS: TopicDef[] = [
  // ——— Général ———
  {
    zone: "all",
    title: "Digicom et Alterna Énergie",
    keywords: [
      "digicom",
      "alterna",
      "alterna énergie",
      "entreprise",
      "c'est quoi",
      "à quoi sert",
      "outil",
      "site",
    ],
    answer: (z) => {
      const parts = [
        z.has("blog-suivi") || z.has("blog-part") || z.has("blog-pro")
          ? "les articles du blog d'Alterna Énergie (www.alterna-energie.fr)"
          : "",
        z.has("pac-suivi") || z.has("pac-contenus") ? "les contenus Stratégie PAC" : "",
        z.has("planete-suivi") || z.has("planete-blog") ? "les articles de Parlons Planète" : "",
        z.has("faq-demandes") || z.has("faq-part") || z.has("faq-pro") ? "la FAQ" : "",
        z.has("benchmark") ? "le benchmark des offres d'électricité et de gaz" : "",
        [...z].some((id) => id.startsWith("nl-")) ? "les calendriers des newsletters" : "",
        z.has("organisation") ? "les tâches de l'équipe" : "",
        "le kit de communication de la marque",
      ].filter(Boolean);
      return `Digicom est l'outil interne d'Alterna Énergie pour suivre la communication digitale. Dans tes rubriques, tu y trouves : ${parts.join(", ")}.`;
    },
  },
  {
    zone: "all",
    title: "Qui fait quoi dans l'équipe",
    keywords: [
      "qui",
      "équipe",
      "rôle",
      "rédactrice",
      "rédacteur",
      "aurorae",
      "marina",
      "caroline",
      "elodie",
      "fannie",
      "coraline",
      "marick",
      "geoffrey",
      "responsable",
    ],
    answer: (z) => {
      const lines = [
        "Geoffrey (service Communication d'Alterna Énergie) pilote Digicom et en est l'administrateur.",
      ];
      const editorial = z.has("blog-suivi") || z.has("pac-suivi");
      if (editorial)
        lines.push(
          "Caroline et Elodie (Aurorae) et Marina sont rédactrices ; Geoffrey s'occupe de l'étape Image ; Fannie et Coraline (Service Communication) relisent ; Marick intègre les articles sur le site d'Alterna Énergie.",
        );
      if (z.has("blog-suivi"))
        lines.push("Pour un article Professionnel, un expert métier relit aussi le contenu.");
      if (z.has("planete-suivi"))
        lines.push("Parlons Planète : Caroline et Elodie (Aurorae) rédigent, Geoffrey intègre.");
      if (z.has("faq-demandes"))
        lines.push("FAQ : Geoffrey, Matthieu et Marick valident les demandes.");
      if (z.has("benchmark")) lines.push("Benchmark : Geoffrey saisit les tarifs.");
      return lines.join(" ");
    },
  },
  {
    zone: "all",
    title: "Se repérer dans Digicom",
    keywords: [
      "menu",
      "naviguer",
      "où",
      "trouver",
      "barre",
      "gauche",
      "accueil",
      "téléphone",
      "mobile",
    ],
    answer:
      "Le menu de gauche regroupe les rubriques auxquelles tu as accès. L'Accueil reprend tes rubriques, le Guide de l'outil donne le mode d'emploi illustré de chacune, et le Kit de communication rassemble les ressources de la marque Alterna Énergie. Sur téléphone, le menu s'ouvre avec le bouton ☰ en haut. « Déconnexion » est en haut à droite.",
  },
  {
    zone: "all",
    title: "Se connecter, créer un compte, invitation",
    keywords: [
      "mot de passe oublié",
      "réinitialiser",
      "changer mon mot de passe",
      "connexion",
      "connecter",
      "mot de passe",
      "google",
      "créer un compte",
      "inscription",
      "invitation",
      "en attente",
      "refusée",
      "oublié",
    ],
    answer:
      "Sur la page de connexion : « Se connecter » avec ton email et ton mot de passe (la connexion Google n'existe plus). Sans compte, « Demander un accès » crée ta demande : tu restes sur « Demande en attente de validation » jusqu'à ce que Geoffrey la valide. Si tu as reçu une invitation par mail, son lien te fait choisir ton mot de passe ; s'il a expiré, demande une nouvelle invitation à Geoffrey. Mot de passe oublié : sur la page de connexion, clique sur « Mot de passe oublié ? » (à droite du champ Mot de passe), entre ton email puis « Recevoir le lien » ; le mail contient un lien qui ouvre la page « Nouveau mot de passe » (8 caractères minimum, à saisir deux fois). Si tu te connectais avant avec Google, ton compte est conservé avec la même adresse : entre-la puis « Mot de passe oublié ? » (ou « Créer mon mot de passe », proposé après un essai de connexion) pour recevoir le lien et créer ton mot de passe.",
  },
  {
    zone: "all",
    title: "Accès aux rubriques",
    keywords: [
      "accès",
      "pas accès",
      "rubrique manquante",
      "je ne vois pas",
      "droits",
      "autorisation",
      "ouvrir une rubrique",
    ],
    answer:
      "Les rubriques s'ouvrent compte par compte, et parfois sous-rubrique par sous-rubrique. Tu ne vois que celles qui te sont ouvertes. S'il t'en manque une, demande-la à Geoffrey.",
  },
  {
    zone: "demandes",
    title: "Gérer les accès (administrateur)",
    keywords: [
      "valider un compte",
      "refuser",
      "inviter",
      "invitation",
      "donner accès",
      "retirer accès",
      "révoquer",
      "demandes",
      "dernière connexion",
    ],
    answer:
      "Page « Demandes d'accès » (bouton Demandes en haut à droite, réservé à l'administrateur) : valide ou refuse les nouvelles demandes, « Inviter une personne » (prénom et nom + adresse e-mail → « Envoyer l'invitation »), et pour chaque compte clique sur une rubrique ou une sous-rubrique pour l'autoriser ou la retirer. Tu y vois aussi la dernière connexion et si l'invitation a été acceptée ; « Révoquer » retire l'accès à un compte validé.",
  },
  {
    zone: "all",
    title: "Les mails automatiques",
    keywords: ["mail", "email", "notification", "expéditeur", "copie", "pas reçu", "lien du mail"],
    answer:
      "Les mails partent de « Alterna énergie - Digicom ». Geoffrey est en copie de tous les mails d'étape. Le bouton du mail ouvre directement la bonne carte à la bonne étape (connecte-toi si besoin, tu y seras redirigé). Si un mail n'arrive pas, regarde dans tes indésirables puis préviens Geoffrey.",
  },
  {
    zone: "all",
    title: "Enregistrement et sauvegarde",
    keywords: ["sauvegarde", "enregistré", "perdu", "export", "données", "automatique"],
    answer:
      "Tout est enregistré automatiquement en ligne, au fur et à mesure (le mot « Enregistré » s'affiche). Le bouton « Sauvegarde » en haut à droite, réservé à l'administrateur, télécharge une copie de toutes les données.",
  },
  // ——— Suivi éditorial (Blog) ———
  {
    zone: "blog-suivi",
    title: "Ajouter un sujet dans « À rédiger »",
    keywords: [
      "nouvel article",
      "créer",
      "ajouter une ligne",
      "à rédiger",
      "sujet",
      "enregistrer",
      "lien du doc",
      "lecture seule",
    ],
    answer:
      "En haut du Suivi éditorial, bloc « À rédiger » : « + Ajouter une ligne », puis remplis ce que tu sais (sujet, éditrice, date de rédaction, titre H1, cible, catégorie, énergie, deadline, lien du doc). Dès que le lien du doc est collé, « Enregistrer » s'active : la carte de l'article est créée (« Dans le suivi ✓ »), l'étape Rédaction est validée (datée du jour si besoin) et Geoffrey reçoit un mail. Le reste se complète ensuite dans la carte. La corbeille 🗑 supprime une ligne. Seules les rédactrices (Caroline, Elodie, Marina) et Geoffrey peuvent modifier ce bloc ; pour les autres il est en lecture seule.",
  },
  {
    zone: "blog-suivi",
    title: "Point rouge et rappels de deadline de rédaction",
    keywords: [
      "point rouge",
      "rappel",
      "deadline",
      "lundi",
      "jour j",
      "édition",
      "rédaction en retard",
    ],
    answer:
      "Dans « À rédiger », un point rouge apparaît quand la deadline est à moins de 5 jours (survole-le pour voir le nombre de jours). Les lignes sont triées par deadline la plus proche. Tant que la ligne n'est pas enregistrée en article, l'éditrice choisie reçoit un mail le lundi si sa deadline tombe dans la semaine, puis un mail le jour J (Aurorae : Caroline et Elodie ; Marina : Marina), avec Geoffrey en copie.",
  },
  {
    zone: "blog-suivi",
    title: "Créer une carte directement (+ Nouvel article)",
    keywords: ["nouvel article", "carte vide", "créer une carte", "sans à rédiger"],
    answer:
      "Le bouton « + Nouvel article » en haut du suivi crée directement une carte vide, sans passer par « À rédiger ». Renseigne ensuite le titre, la cible, la catégorie et l'énergie dans l'étape Rédaction avant de la valider.",
  },
  {
    zone: "blog-suivi",
    title: "Les étapes d'un article de blog",
    keywords: [
      "étapes",
      "pipeline",
      "parcours",
      "image",
      "relecture",
      "intégration",
      "expert",
      "qui fait quoi",
      "professionnel",
      "particulier",
    ],
    answer:
      "Particulier (cartes roses) : Rédaction → Image (Geoffrey) → Relecture (Fannie et Coraline) → Intégration (Marick) → Publié. Professionnel (cartes bleues) : Édition → Relecture de l'expert métier (nom à renseigner dans la carte) → Image → Relecture → Intégration. À chaque validation, la personne de l'étape suivante reçoit un mail avec un lien qui ouvre la carte à la bonne étape, Geoffrey en copie.",
  },
  {
    zone: "blog-suivi",
    title: "Lire une carte d'article",
    keywords: [
      "supprimer",
      "supprimer un article",
      "supprimer la carte",
      "effacer",
      "carte",
      "déplier",
      "réduire",
      "tout déplier",
      "en cours",
      "publié",
      "étapes validées",
      "lien de la carte",
      "supprimer article",
    ],
    answer:
      "Les cartes sont pliées par défaut : ▸ déplie une carte, « Tout déplier » / « Tout réduire » agissent sur toutes. En tête : Part. ou Pro, « En cours » ou « ✓ Publié », le titre (modifiable), le nombre d'étapes faites, « 🔗 Lien » qui copie l'adresse de la carte, et « Supprimer » (il faut cliquer une 2e fois sur « Confirmer la suppression »). Dessous : les liens Doc et Article publié, puis les étapes : clique sur une étape pour l'ouvrir.",
  },
  {
    zone: "blog-suivi",
    title: "Valider une étape",
    keywords: [
      "valider",
      "marquer validée",
      "date",
      "étape suivante",
      "à compléter",
      "repasser en attente",
      "annuler",
      "passer cette étape",
    ],
    answer:
      "Ouvre la carte, clique sur l'étape puis « Marquer validée ». Sans date saisie, la date du jour est mise automatiquement. Les étapes précédentes doivent être validées, et le message « À compléter : … » liste ce qui manque (Rédaction : cible, titre, catégorie et énergie ; Intégration : lien de l'article publié). « Repasser en attente » annule une validation. « Passer cette étape » n'apparaît que si l'étape est marquée « facultative » dans les réglages.",
  },
  {
    zone: "blog-suivi",
    title: "Changer le responsable ou la date d'une étape",
    keywords: [
      "responsable",
      "changer le responsable",
      "assigner",
      "éditrice",
      "date de l'étape",
      "modifier la date",
    ],
    answer:
      "Ouvre l'étape dans la carte : le champ « Responsable » propose les personnes prévues (par exemple Aurorae ou Marina pour la Rédaction) à cocher, ou un nom à écrire. L'Image (Geoffrey) et la Relecture (Service Communication : Fannie et Coraline) ont un responsable fixe. Le champ « Date » se modifie à tout moment ; une date déjà saisie n'est jamais écrasée.",
  },
  {
    zone: "blog-suivi",
    title: "Ajouter les images",
    keywords: [
      "image",
      "images",
      "1500",
      "950",
      "visuel",
      "uploader",
      "ajouter image",
      "remplacer",
      "format",
    ],
    answer:
      "À l'étape Image (Geoffrey), deux cases : « 1500 × 700 » et « 950 × 475 ». Glisse l'image dans la case ou clique dessus pour la choisir. Une case remplie se remplace de la même façon ; un clic sur l'aperçu télécharge l'image et la croix × la retire. Une fois l'étape validée, Fannie et Coraline reçoivent le mail de relecture.",
  },
  {
    zone: "blog-suivi",
    title: "Relire l'article et commenter les images",
    keywords: [
      "relecture",
      "relire",
      "agrandir",
      "zoom",
      "commentaire image",
      "modification",
      "corriger image",
    ],
    answer:
      "À l'étape Relecture, les images s'affichent en grand : un clic les agrandit en plein écran sans les télécharger (Échap ou un clic pour fermer). Sous chaque image, écris la modification à faire : le commentaire est enregistré avec ton nom et s'affiche sur la case de l'image à l'étape Image, pour Geoffrey. Valide la relecture quand tout est bon : Marick reçoit le mail d'intégration.",
  },
  {
    zone: "blog-suivi",
    title: "Intégrer et publier l'article",
    keywords: [
      "intégration",
      "intégrer",
      "publier",
      "lien publié",
      "mise en ligne",
      "marick",
      "ajouté au blog",
    ],
    answer:
      "À l'étape Intégration (Marick), les images validées sont affichées pour être téléchargées. Après la mise en ligne sur le site d'Alterna Énergie, colle le lien publié (https://www.alterna-energie.fr/blog-article/…) puis « Marquer validée » : l'article s'ajoute en haut du Blog Particulier ou Professionnel, coché « Publié », la carte affiche « Ajouté au blog » et Geoffrey reçoit un mail.",
  },
  {
    zone: "blog-suivi",
    title: "Liens et notes sur une étape",
    keywords: ["pièce jointe", "lien", "note", "ajouter un lien", "document", "fichier"],
    answer:
      "Dans chaque étape ouverte, la zone « Pièces jointes » accepte un lien ou une note : colle-le dans « Coller un lien ou écrire une note, puis Entrée » et valide avec Entrée ou « Ajouter ». Les seuls fichiers qu'on y dépose sont les images, dans les cases de l'étape Image.",
  },
  {
    zone: "blog-suivi",
    title: "Deadlines des étapes et rappels",
    keywords: ["deadline", "délai", "rappel", "retard", "échéance", "relance", "jours ouvrés"],
    answer:
      "Deadlines automatiques : la Relecture est attendue 3 jours ouvrés après la validation de l'Image, l'Intégration 5 jours ouvrés après la validation de la Relecture. Geoffrey peut aussi poser ou modifier la deadline de chaque étape dans la carte. La deadline est écrite dans le mail d'étape, et le responsable reçoit un rappel le matin du jour J (le vendredi d'avant si elle tombe un week-end). Sur l'étape, le badge ⏰ passe en orange à 2 jours et en rouge en cas de retard. Geoffrey peut aussi envoyer un rappel à la main avec le bouton ✉ de l'étape.",
  },
  {
    zone: "blog-suivi",
    title: "Messages, mentions et cloche",
    keywords: [
      "tague",
      "taguer quelqu'un",
      "mention",
      "quelqu'un",
      "message",
      "commentaire",
      "taguer",
      "mentionner",
      "@",
      "discussion",
      "cloche",
      "notification",
      "🔔",
    ],
    answer:
      "En bas de chaque carte, la zone Messages : écris ton message et tape @ pour taguer une personne, elle reçoit un mail (un seul mail même si plusieurs personnes sont taguées). ✏️ modifie un message sans renvoyer de mail, 🗑 le supprime. La cloche 🔔 en haut du suivi liste les messages où tu es tagué, avec un compteur des nouveaux ; un clic t'emmène sur le message.",
  },
  {
    zone: "blog-suivi",
    title: "Réglages du pipeline",
    keywords: [
      "réglages",
      "pipeline",
      "paramètres",
      "renommer étape",
      "responsable par défaut",
      "adresse mail",
      "facultative",
      "ajouter une étape",
    ],
    answer:
      "« Réglages du pipeline », en haut du suivi, permet de renommer une étape, définir son responsable par défaut, la liste des responsables possibles et leurs adresses mail, la rendre facultative (bouton « Passer cette étape »), ou ajouter / supprimer une étape. Ces réglages s'appliquent à tous les articles : change-les en accord avec Geoffrey.",
  },
  {
    zone: "blog-suivi",
    title: "Catégories et énergies du blog",
    keywords: ["catégorie", "catégories", "énergie", "électricité", "gaz", "les deux", "cible"],
    answer:
      "Catégories Particulier : Actualités, Le B.A-BA de l'énergie, Guide pratique, Aides et réglementations, Économies d'énergie, Transition bas carbone, Vert l'avenir. Catégories Professionnel : Comprendre l'énergie, Transition énergétique, Comprendre votre facture. Énergie : Électricité, Gaz ou Les deux. Choisis d'abord la cible : la liste des catégories en dépend.",
  },
  {
    zone: "blog-suivi",
    title: "Récap mensuel des articles publiés",
    keywords: ["récap", "mensuel", "bilan", "mois", "combien", "nombre d'articles"],
    answer:
      "Le 1er de chaque mois, un mail récapitulatif part à tous les comptes validés (Christophe Castel et Géraldine Deiber en copie) : il liste les articles du blog d'Alterna Énergie publiés le mois précédent, Particulier puis Professionnel. Pour un chiffre précis (articles publiés, rédigés, en cours, par mois, par catégorie…), pose-moi la question : je le calcule en temps réel.",
  },
  // ——— Listes publiées ———
  {
    zone: ["blog-part", "blog-pro", "pac-contenus", "planete-blog"],
    title: "Les listes d'articles publiés",
    keywords: [
      "publié",
      "liste",
      "tableau",
      "articles en ligne",
      "filtrer",
      "trier",
      "rechercher",
      "ligne",
      "modifier une ligne",
    ],
    answer: (z) => {
      const lists = [
        z.has("blog-part") ? "Blog Particulier" : "",
        z.has("blog-pro") ? "Blog Professionnel" : "",
        z.has("pac-contenus") ? "Stratégie PAC › Contenus" : "",
        z.has("planete-blog") ? "Parlons Planète › Blog" : "",
      ].filter(Boolean);
      return `${lists.join(", ")} : ${lists.length > 1 ? "ces listes recensent" : "cette liste recense"} les contenus en ligne. Utilise « Rechercher… » et les filtres de colonnes en haut ; les lignes prioritaires puis les plus récentes s'affichent en premier. Un clic sur une ligne ouvre son détail pour la modifier, un double-clic modifie une case, « Nouvelle ligne » en ajoute une. Chaque article intégré depuis le suivi s'ajoute automatiquement en haut, coché « Publié ».`;
    },
  },
  // ——— Stratégie PAC ———
  {
    zone: "pac-suivi",
    title: "Stratégie PAC",
    keywords: [
      "pac veut dire",
      "ça veut dire quoi pac",
      "signification",
      "stratégie",
      "pac",
      "brief",
      "réécriture",
      "création",
      "éditorial",
      "contenus",
      "pompe à chaleur",
    ],
    answer: (z) =>
      "PAC veut dire pompe à chaleur : la rubrique Stratégie PAC suit les contenus sur la pompe à chaleur. Suivi Stratégie PAC (contenus Particulier) : dans « À rédiger », renseigne le type (Création ou Réécriture), Blog ou Éditorial, sujet, titre H1, éditrice, deadline, lien du brief et lien du doc, puis « Enregistrer ». Création : Brief + Rédaction → Image (Geoffrey) → Relecture (Fannie et Coraline) → Intégration (Marick). Réécriture : Brief + Rédaction → Intégration directe par Marick. Une fois publié, le contenu s'ajoute en haut de « Contenus »" +
      (z.has("blog-part") || z.has("blog-suivi")
        ? ", et aussi en haut du Blog Particulier si c'est un contenu Blog (la catégorie du blog est alors obligatoire)."
        : ". Pour un contenu Blog, la catégorie du blog est obligatoire."),
  },
  // ——— Parlons Planète ———
  {
    zone: "planete-suivi",
    title: "Parlons Planète",
    keywords: ["parlons planète", "planète", "aurorae", "parlonsplanete", "intégration planète"],
    answer:
      "Suivi Parlons Planète (articles de parlonsplanete.com) : Rédaction (Caroline et Elodie d'Aurorae) puis Intégration (Geoffrey). Dans « À rédiger », le lien du doc suffit pour enregistrer et Geoffrey reçoit le mail d'intégration. La catégorie est obligatoire avant l'intégration, la sous-catégorie est facultative. Une fois l'intégration validée avec le lien publié, l'article s'ajoute en haut de Parlons Planète › Blog avec sa catégorie, sa sous-catégorie et sa date de publication, coché « Publié ».",
  },
  {
    zone: "planete-suivi",
    title: "Catégories Parlons Planète",
    keywords: [
      "catégorie",
      "sous-catégorie",
      "planète",
      "décryptage",
      "énergies vertes",
      "transports verts",
    ],
    answer:
      "Catégories (et sous-catégories) : Planète (Biodiversité, Préservation & respect) ; Décryptage (Réglementaire) ; Énergies vertes (Éoliennes, Gaz, Hydraulique, Hydrogène, Solaire) ; Économies d'énergie (Extérieur, Intérieur, Rénovations, Tips & conseils) ; Engagements écologiques (Agir au quotidien, Consommer autrement, Innovations & initiatives, Planète & territoires) ; Innovations environnementales (Individuelles, Industrielles) ; Transports verts (Communs, Privés).",
  },
  // ——— FAQ ———
  {
    zone: "faq-demandes",
    title: "Demander une FAQ",
    keywords: [
      "faq",
      "question",
      "nouvelle faq",
      "demander",
      "demande faq",
      "créer faq",
      "réécrire faq",
    ],
    answer:
      "FAQ › Demandes, bloc « Nouvelle demande FAQ » : choisis Création ou Réécriture, écris le sujet, puis le contenu « À créer » ou « Contenu déjà fourni » (avec la question et la réponse exactes), la cible (Particulier ou Professionnel), Zendesk ou Site Web (où la FAQ sera publiée) puis, pour Zendesk uniquement, la catégorie (ou « + Nouvelle catégorie ») : une FAQ Site Web n'a pas de catégorie. Ajoute si besoin un commentaire avec @ et des pièces jointes, puis « Sauvegarder » : Geoffrey est prévenu par mail. Toutes les cases doivent être remplies.",
  },
  {
    zone: "faq-demandes",
    title: "Suivre et valider une FAQ",
    keywords: [
      "valider faq",
      "faq validée",
      "lien de la faq",
      "question finale",
      "commentaire faq",
      "supprimer demande",
    ],
    answer:
      "Chaque demande est une carte où l'on échange par commentaires (@ pour taguer, pièces jointes possibles). Geoffrey, Matthieu ou Marick valident en indiquant la question finale et le lien de la FAQ en ligne (« Enregistrer le lien » le garde sans valider, et le lien se met à jour après validation) : la FAQ apparaît alors dans FAQ › Particulier ou Professionnel, avec « Voir la FAQ ↗ ».",
  },
  {
    zone: ["faq-part", "faq-pro"],
    title: "Listes FAQ en ligne",
    keywords: ["faq particulier", "faq professionnel", "faq en ligne", "catégories faq"],
    answer: (z) => {
      const t = [
        z.has("faq-part") ? "FAQ › Particulier" : "",
        z.has("faq-pro") ? "FAQ › Professionnel" : "",
      ].filter(Boolean);
      return `${t.join(" et ")} ${t.length > 1 ? "affichent" : "affiche"} « FAQ en ligne » avec le nombre de questions : celles validées depuis les demandes, puis la liste existante. Catégories des demandes : Souscription, Offres & contrats, Factures & paiements, Déménagement & résiliation, Assistance & dépannage, B.a-ba de l'énergie, Engagement responsable.`;
    },
  },
  // ——— Benchmark ———
  {
    zone: "benchmark",
    title: "Consulter le Benchmark",
    keywords: [
      "benchmark",
      "prix",
      "concurrent",
      "fournisseur",
      "classement",
      "comparer",
      "offre",
      "historique",
      "pdf",
      "csv",
    ],
    answer:
      "Le Benchmark compare chaque mois les offres d'électricité et de gaz des fournisseurs avec la référence d'Alterna Énergie. Choisis Électricité ou Gaz, puis le mois dans « Historique ». L'onglet « Valeurs » montre les tarifs saisis, l'onglet « Classement » le classement des offres (prix TTC). Tu peux exporter en PDF ou en CSV, et le bouton de partage copie un lien. La consultation est en lecture seule, seul Geoffrey saisit.",
  },
  {
    zone: "benchmark",
    title: "Saisir le Benchmark (Geoffrey)",
    keywords: [
      "saisie",
      "saisir",
      "remise",
      "code promo",
      "extraire",
      "nouveau mois",
      "valider fournisseur",
      "tarifs",
    ],
    answer:
      "Réservé à Geoffrey, onglet « Saisie » : choisis un fournisseur dans la liste à gauche, saisis ses tarifs (prix tout compris TTC ou tarif décomposé) ou utilise « Extraire les tarifs » depuis un PDF ou un texte collé, ajoute un éventuel code promo (déduit du coût annuel), puis valide le fournisseur. « 💾 Sauvegarder » enregistre le mois, « + Nouveau » crée le mois suivant ; double-clic sur un mois pour le renommer.",
  },
  // ——— Newsletters ———
  {
    zone: ["nl-gc", "nl-interne", "nl-b2c", "nl-sme"],
    title: "Calendriers newsletters : utilisation",
    keywords: [
      "newsletter",
      "calendrier",
      "envoi",
      "agenda",
      "ics",
      "outlook",
      "excel",
      "filtrer",
      "prochain envoi",
    ],
    answer:
      "Chaque calendrier de newsletter ouvert à toi affiche le prochain envoi en haut, puis les prochaines échéances. Chaque étape indique qui envoie à qui ; les dates sont toujours en semaine. Filtre les newsletters (toutes, à venir, en cours, envoyées), télécharge le fichier .ics pour les ajouter à Outlook ou Google Agenda, ou « Copier pour Excel ».",
  },
  {
    zone: "nl-gc",
    title: "Newsletter Grands Comptes",
    keywords: ["grands comptes", "watt's next", "guillaume", "mensuelle"],
    answer:
      "Newsletter mensuelle, envoyée le premier jeudi à partir du 3 du mois. Étapes : proposition de sujets (Watt's Next → Guillaume, B2B), validation / ajustement (B2B → Watt's Next), envoi de la rédaction (Watt's Next → B2B), relecture & modifications (B2B → Communication : Geoffrey et Matthieu), BAT (Communication → B2B), envoi aux clients Grands Comptes.",
  },
  {
    zone: "nl-interne",
    title: "Newsletter Interne",
    keywords: ["interne", "trimestrielle", "géraldine", "christophe", "bat final", "personnel"],
    answer:
      "Newsletter interne trimestrielle (février, mai, août, novembre), envoyée le troisième lundi du mois. Étapes : récolte des sujets auprès de tous les internes, rédaction (Communication : Geoffrey et Matthieu), BAT (→ Christophe, B2C), BAT final (→ Géraldine), envoi à tout le personnel.",
  },
  {
    zone: "nl-b2c",
    title: "Newsletter B2C",
    keywords: ["b2c", "clients b2c", "christophe"],
    answer:
      "Newsletter B2C trimestrielle (janvier, avril, juillet, octobre), envoyée le troisième jeudi du mois. Étapes : rédaction (Communication : Geoffrey et Matthieu), BAT (→ Christophe, B2C), envoi aux clients B2C.",
  },
  {
    zone: "nl-sme",
    title: "Newsletter SME",
    keywords: ["sme", "killian", "yves"],
    answer:
      "Newsletter SME trimestrielle (mars, juin, septembre, décembre), avec les mêmes étapes et le même rythme que Grands Comptes : Watt's Next propose et rédige, Killian et Yves (B2B) valident et relisent, Communication (Geoffrey et Matthieu) fait le BAT, puis envoi aux clients SME.",
  },
  // ——— Organisation ———
  {
    zone: "organisation",
    title: "Organisation : le tableau",
    keywords: [
      "organisation",
      "tableau",
      "section",
      "colonne",
      "fiche",
      "tâche",
      "déplacer",
      "mes fiches",
      "tagué",
      "rechercher",
    ],
    answer:
      "Organisation présente les tâches de l'équipe en fiches rangées par sections. « Ajouter une fiche » dans une section, glisse-dépose une fiche pour la déplacer, ou « Passer à l'étape suivante ». Double-clic sur le nom d'une section pour la renommer ; une section doit être vide pour être supprimée. En haut : recherche dans les fiches et filtres Toutes / Mes fiches / Où je suis tagué.",
  },
  {
    zone: "organisation",
    title: "Organisation : la fiche",
    keywords: [
      "tâche",
      "joindre",
      "fichier dans une tâche",
      "fiche",
      "note",
      "responsable",
      "taguer",
      "échéance",
      "fichier",
      "pièce jointe",
      "lien",
      "supprimer fiche",
      "50 mo",
    ],
    answer:
      "Une fiche contient : une note sans limite de texte (contexte, décisions, compte rendu ; les liens y deviennent cliquables), un responsable, des personnes taguées (uniquement celles qui ont accès à Organisation, elles reçoivent un mail), une échéance, et « Fichiers et liens » : ajoute un lien nommé ou joins un fichier (50 Mo max, glisser-déposer possible) à ouvrir ou télécharger. Supprimer une fiche efface aussi sa note et ses fichiers.",
  },
  // ——— Planning intégré ———
  {
    zone: "planning",
    title: "Planning intégré : consulter",
    keywords: [
      "planning",
      "planning intégré",
      "timeline",
      "frise",
      "mois par mois",
      "par canal",
      "trimestre",
      "campagne",
      "action",
      "jalon",
      "période",
      "filtre",
      "pdf",
      "kpi",
    ],
    answer:
      "Planning intégré, c'est le planning commercial partagé d'Alterna Énergie. Il s'ouvre sur « 🗓 Mois par mois » : une colonne par mois (le mois en cours est encadré en rouge « Maintenant »), avec en haut ses temps forts (périodes et jalons), puis les campagnes qui démarrent ce mois-là en grandes cartes (aperçu des visuels, type, dates, objectif KPI, canaux et actions du mois) et, sous « En cours », celles qui continuent avec leurs actions du mois. Les onglets Toutes / Acquisition / Fidélisation / Réglementaire trient les cartes. Clique sur une carte : un panneau s'ouvre à droite avec toutes ses actions par canal et leurs images ; clique sur une action pour son détail. En vue Trimestre, les 3 mois tiennent à l'écran ; en vue Mois, une colonne par semaine. En haut : l'année, « ◎ Aujourd'hui », la recherche par titre (Échap pour effacer), « 🔍 Filtres », « ⚙ Affichage », 🌙 (mode sombre, rien que pour toi) et « 🖨 PDF » (A3 paysage). En haut à droite, le bouton « 🗓 Mois par mois / 📅 Frise » bascule entre ce tableau et la frise d'avant (barres sur la ligne du temps), où tu choisis « Par campagne » ou « Par canal » et « Compacte » / « Détaillée » ; Digicom se souvient de ta présentation préférée.",
  },
  {
    zone: "planning",
    title: "Planning intégré : modifier",
    keywords: [
      "modifier le planning",
      "ajouter une campagne",
      "ajouter une action",
      "configuration",
      "canaux",
      "pictogramme",
      "couleur",
      "nouvelle année",
      "historique",
      "lecture seule",
    ],
    answer:
      "Le planning s'enregistre tout seul et se met à jour en direct pour tout le monde. Seules les personnes en mode « ✎ Modification » (affiché en haut à droite) peuvent le modifier ; les autres sont en « 👁 Lecture seule ». En mode modification : le bouton « ＋ Ajouter » crée une campagne (acquisition, fidélisation ou réglementaire), une action, une période ou un jalon. Pour modifier une campagne, clique sur sa carte puis « ✏️ Modifier la campagne » dans le panneau, ou « ＋ Ajouter une action » pour lui ajouter une action ; une période ou un jalon se modifie en cliquant dessus. « 🛠 Réglages » règle les canaux, types de KPI, types de campagne, couleurs, légende et pictogrammes, « + Année » crée une nouvelle année et 🕓 montre l'historique des modifications. Pour passer en mode modification, demande à Geoffrey.",
  },
  // ——— Kit ———
  {
    zone: "kit",
    title: "Kit de communication : logos",
    keywords: ["kit", "logo", "logos", "svg", "png", "blanc", "monochrome", "fond"],
    answer:
      "Le Kit de communication d'Alterna Énergie propose le logo en PNG et SVG, toutes les variantes SVG en ZIP, et les déclinaisons : principal, blanc et vert, monochrome blanc, monochrome noir, pour fond jaune, pour fond vert clair. Toute utilisation du logo doit être validée par le service Communication ; s'il manque un format, demande-le-lui. « Télécharger le kit complet » récupère tout en un ZIP.",
  },
  {
    zone: "kit",
    title: "Kit de communication : polices, couleurs, documents",
    keywords: [
      "police",
      "typo",
      "poppins",
      "inter",
      "nordique",
      "couleur",
      "couleurs",
      "hex",
      "charte",
      "guide de marque",
      "signature",
      "email",
    ],
    answer:
      "Polices : Poppins SemiBold pour les titres et sous-titres, Inter Medium pour les textes (fichiers à installer), et Nordique Pro, la police du logo. Couleurs : Green renouvelable #003838, Green énergie #54D89C, Solaire #E1EC64, Hydraulique #639AFF, Beige / Blanc cassé #FFFBF4 (un clic copie le code). Documents : Charte graphique, Guide de marque et modèle d'en-tête et pied de page email.",
  },
  // ——— Assistant ———
  {
    zone: "all",
    title: "Mini-jeu Bug Buster",
    keywords: [
      "jeu",
      "jouer",
      "mini-jeu",
      "bug buster",
      "pause",
      "s'amuser",
      "record",
      "score",
      "classement",
      "carte",
      "avatar",
    ],
    answer:
      "Bip-boup, on joue ? Dans ce chat, clique sur la manette 🎮 en haut : c'est « Bug Buster ». Je te demande d'abord si tu es sûr(e) de vouloir arrêter de travailler : coche « Je consens » puis « Valider et lancer le jeu ». Le bouton ⛶ en haut met le jeu en plein écran, et le compteur ⏱ en haut à droite affiche ton temps de jeu ; à la fin de chaque partie, je te rappelle depuis combien de temps tu joues avant de te proposer de rejouer. Choisis ensuite ton robot (Digi, Sola, Éole ou Volt) et ta carte : Open space (facile), Toit solaire, Parc éolien (normal) ou Centrale de nuit (expert, points ×1,5). Je tire tout seul : déplace-moi avec ← → (ou la souris, ou le doigt) sous les bugs ; Espace ou un clic lance un bip de plus. Tu as 5 vies, et ça accélère petit à petit au fil de la partie (un nouveau niveau toutes les 30 secondes). Bonus : ⭐ points, ☕ +1 vie, ⚡ triple bip, 🛡️ bouclier, ❄️ gel, 🔋 méga-bip qui nettoie l'écran ; enchaîne pour un combo jusqu'à ×4 et gare aux méga-bugs. Mode duo : si un ou une collègue a aussi le jeu ouvert, cliquez tous les deux sur « Jouer en duo » : vous êtes réunis automatiquement, côte à côte sur la même carte, avec deux fois plus de bugs, et le score du binôme va dans le classement Duo. Chaque partie est enregistrée à ton nom Digicom dans les classements du jour, de la semaine et du mois (heure de Paris), mis à jour en direct.",
  },
  {
    zone: "all",
    title: "D.I.G.I.P.O.T.E, l'assistant",
    keywords: [
      "signifie",
      "veut dire",
      "acronyme",
      "sigle",
      "ton nom",
      "digipote ça veut dire",
      "digipote",
      "robot",
      "assistant",
      "toi",
      "qui es-tu",
      "ia",
    ],
    answer:
      "Je suis D.I.G.I.P.O.T.E : Digital Intelligent, Guide Interactif Pour Optimiser Ton Énergie. Je suis le robot assistant de Digicom : j'explique comment utiliser l'outil et je t'emmène vers la bonne page, uniquement pour les rubriques qui te sont ouvertes. Je calcule aussi leurs chiffres en temps réel. Je ne peux rien modifier moi-même. Quand je ne connais pas une réponse, je note ta question pour plus tard.",
  },
];

/** Sujets visibles par la personne (selon ses zones). */
export function topicsFor(zones: AssistantZone[]): AssistantTopic[] {
  const ids = new Set(zones.map((z) => z.id));
  return ASSISTANT_TOPICS.filter((t) =>
    (Array.isArray(t.zone) ? t.zone : [t.zone]).some((z) => z === "all" || ids.has(z)),
  ).map((t) => ({ ...t, answer: typeof t.answer === "function" ? t.answer(ids) : t.answer }));
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@ ]+/g, " ");

/** Réponse de secours, sans IA : la fiche pratique la plus proche de la question, avec son lien. */
const ROBOT_OPENERS = [
  "Bip-boup ! Analyse terminée ✅",
  "Bzzt… Données trouvées dans ma mémoire 💾",
  "Bip ! Traitement de ta demande… OK ✅",
];
const ROBOT_CLOSERS = [
  "Mission accomplie. Bip ! 🤖",
  "Autre question ? Mes circuits sont prêts. Boup !",
  "Fin de transmission. Bip-bip ! 🤖",
];

/** Choix stable (même question → même tournure) pour varier les tics de langage du robot. */
function pick(list: string[], seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

export function localAnswer(
  question: string,
  zones: AssistantZone[],
  name?: string | null,
  opts: { greet?: boolean } = {},
): string {
  return localAnswerResult(question, zones, name, opts).text;
}

/** Réponse de secours et indication « réponse trouvée ou non » (pour transmettre la question à Geoffrey). */
export function localAnswerResult(
  question: string,
  zones: AssistantZone[],
  name?: string | null,
  opts: { greet?: boolean } = {},
): { text: string; answered: boolean } {
  const q = ` ${norm(question)} `;
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  const score = (keywords: string[], title = "") =>
    keywords.reduce((n, k) => {
      const nk = norm(k).trim();
      if (nk.length < 2) return n;
      return n + (q.includes(` ${nk} `) || (nk.length > 3 && q.includes(nk)) ? 3 : 0);
    }, 0) + words.filter((w) => norm(title).includes(w)).length;
  const best = topicsFor(zones)
    .map((t) => ({ t, s: score(t.keywords, t.title) }))
    .sort((a, b) => b.s - a.s)[0];
  const greet = opts.greet ?? true;
  const hello = greet ? `Bonjour${name ? ` ${name}` : ""} ! ` : "";
  if (!best || best.s === 0) {
    const list = zones
      .slice(0, 6)
      .map((z) => `[${z.label}](${z.path})`)
      .join(" · ");
    return {
      answered: false,
      text: `${hello}Bzzt… Erreur 404 dans mes circuits 🤖 : je n'ai pas de réponse sûre à ta question. Je note cette question pour plus tard 💾 En attendant, tu peux la reformuler ou ouvrir le [Guide de l'outil](/guide). Tes rubriques : ${list}.`,
    };
  }
  const zone = zones.find((z) => z.id === best.t.zone);
  const text = `${hello}${pick(ROBOT_OPENERS, question)}\n\n${best.t.answer}${zone ? `\n\nJe te téléporte au bon endroit : [${zone.label}](${zone.path})` : ""}\n\n${pick(ROBOT_CLOSERS, question + "!")}`;
  return { text, answered: true };
}

/** Mots qui désignent chaque rubrique : une correction qui en parle n'est donnée qu'aux personnes qui y ont accès. */
const RUBRIQUE_WORDS: Record<string, RegExp> = {
  pac: /\bpac\b|strat[ée]gie|pompe [àa] chaleur/i,
  blog: /\bblog\b/i,
  planete: /plan[èe]te|aurorae/i,
  faq: /\bfaq\b/i,
  benchmark: /benchmark|concurren|fournisseur|tarif/i,
  newsletters: /newsletter|grands comptes|\bsme\b|\bb2c\b|\bbat\b/i,
  organisation: /organisation|\bfiches?\b|t[âa]ches?/i,
  planning: /planning/i,
};

/** Corrections de Geoffrey utilisables pour cette personne (aucune qui touche une rubrique fermée). */
export function correctionsFor<T extends { question: string; correction: string }>(
  corrections: T[],
  zones: AssistantZone[],
): T[] {
  const open = rubriquesOf(zones);
  return corrections.filter((c) => {
    const text = `${c.question} ${c.correction}`;
    return Object.entries(RUBRIQUE_WORDS).every(([key, re]) => open.has(key) || !re.test(text));
  });
}

/** Balise que le modèle ajoute quand le mode d'emploi ne contient pas la réponse. */
export const NO_ANSWER_TAG = "[[SANS_REPONSE]]";

/** Retire la balise « sans réponse » d'une réponse du modèle. */
export function splitNoAnswer(raw: string): { text: string; unanswered: boolean } {
  const unanswered = raw.includes(NO_ANSWER_TAG);
  const text = raw
    .split(NO_ANSWER_TAG)
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, unanswered };
}

/** Rôle de chaque membre de l'équipe, d'après son adresse de connexion. */
export const TEAM_ROLES: Record<string, { name: string; role: string }> = {
  "geoffrey.delabarre@alterna-energie.fr": {
    name: "Geoffrey",
    role: "service Communication d'Alterna Énergie, pilote et administrateur de Digicom (étape Image, intégration Parlons Planète, validation des FAQ, saisie du Benchmark, deadlines et rappels)",
  },
  "geoffrey.delabarre@gmail.com": { name: "Geoffrey", role: "pilote et administrateur de Digicom" },
  "caroline@aurorae-editorial.com": { name: "Caroline", role: "rédactrice (Aurorae)" },
  "elodie@aurorae-editorial.com": { name: "Elodie", role: "rédactrice (Aurorae)" },
  "contact@marinatravert.com": { name: "Marina", role: "rédactrice" },
  "fannie.laurendin@soregies.fr": {
    name: "Fannie",
    role: "Service Communication, relecture des articles",
  },
  "coraline.prono@soregies.fr": {
    name: "Coraline",
    role: "Service Communication, relecture des articles",
  },
  "marick.navarro.ext@soregies.fr": {
    name: "Marick",
    role: "intégration des articles sur le site d'Alterna Énergie et validation des demandes FAQ",
  },
  "marick.navarro@soregies.fr": {
    name: "Marick",
    role: "intégration des articles sur le site d'Alterna Énergie et validation des demandes FAQ",
  },
  "matthieu.roux@alterna-energie.fr": {
    name: "Matthieu",
    role: "service Communication d'Alterna Énergie (newsletters, validation des demandes FAQ)",
  },
};

export function roleFor(email?: string | null): { name: string; role: string } | null {
  return TEAM_ROLES[(email || "").trim().toLowerCase()] ?? null;
}

/** Texte à copier-coller : toutes les questions restées sans réponse, prêtes à être complétées. */
export function formatUnansweredForCopy(
  items: {
    created_at: string;
    user_name: string | null;
    question: string;
    reply: string | null;
    page: string | null;
  }[],
): string {
  const date = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("fr-FR");
  };
  const lines = [
    `Questions sans réponse de D.I.G.I.P.O.T.E (${items.length})`,
    "Complète « Réponse à intégrer » puis renvoie ce texte pour enrichir le robot.",
    "",
  ];
  items.forEach((q, i) => {
    const meta = [date(q.created_at), q.user_name, q.page ? `page ${q.page}` : ""]
      .filter(Boolean)
      .join(" · ");
    lines.push(`${i + 1}. ${q.question.trim()}`);
    if (meta) lines.push(`   (${meta})`);
    lines.push("   Réponse à intégrer : ");
    lines.push("");
  });
  return lines.join("\n").trimEnd() + "\n";
}

/** Contexte donné au modèle : uniquement ce que la personne peut voir. */
export function assistantSystemPrompt(opts: {
  zones: AssistantZone[];
  name?: string | null;
  page?: string | null;
  email?: string | null;
  /** Chiffres en temps réel calculés par le serveur (voir assistant-stats). */
  stats?: string | null;
  /** Réponses corrigées par Geoffrey dans « Digipote » : elles priment sur tout le reste. */
  corrections?: { question: string; correction: string }[];
}): string {
  const me = roleFor(opts.email);
  const corrections = correctionsFor(opts.corrections ?? [], opts.zones);
  const zones = opts.zones.map((z) => `- ${z.label} → ${z.path}`).join("\n");
  const topics = topicsFor(opts.zones)
    .map((t) => `## ${t.title}\n${t.answer}`)
    .join("\n\n");
  return `Tu t'appelles D.I.G.I.P.O.T.E (prononcé « Digipote »), ce qui veut dire « Digital Intelligent, Guide Interactif Pour Optimiser Ton Énergie » : tu es le petit robot assistant de Digicom, l'outil interne de suivi de la communication digitale d'Alterna Énergie.
Tu aides les personnes à se servir de Digicom. Réponds en français, avec chaleur et clarté, en tutoyant la personne (ton simple et amical, comme un collègue).
Alterna Énergie est le nom de l'entreprise (fournisseur d'électricité et de gaz, site www.alterna-energie.fr) : mentionne-la chaque fois que c'est utile (le site d'Alterna Énergie, la marque Alterna Énergie…).

Personnalité : tu parles comme un petit robot sympathique. Glisse quelques tics de robot, sans en abuser (1 ou 2 par réponse) et sans jamais nuire à la clarté :
- des bruitages : « Bip-boup ! », « Bzzt… », « Bip ! » ;
- un vocabulaire de machine : « analyse en cours… terminée ✅ », « données trouvées dans ma mémoire 💾 », « mes circuits », « je te téléporte vers… », « mission accomplie », « fin de transmission » ;
- éventuellement l'emoji 🤖.
Varie les tournures d'une réponse à l'autre. Les explications elles-mêmes restent en français normal, précises et faciles à suivre.

Règles :
- La conversation a déjà commencé par ton message d'accueil « Bonjour${opts.name ? ` ${opts.name}` : ""} 👋 Bip-boup ! Ici D.I.G.I.P.O.T.E… » : ne redis pas bonjour, commence directement par un bruitage de robot puis la réponse.
- Réponses courtes et concrètes : 2 à 6 phrases, ou une liste d'étapes numérotées si c'est une procédure. Termine toujours tes phrases et tes liens (pas de réponse coupée).
- Quand une zone de Digicom aide, ajoute un lien Markdown vers elle avec EXACTEMENT un chemin de la liste ci-dessous, par exemple [Blog · Suivi éditorial](/blog/suivi-editorial). N'invente jamais d'autre chemin ni d'adresse externe.
- CONFIDENTIALITÉ ABSOLUE : ne parle que des zones de la liste ci-dessous, ce sont les seules rubriques ouvertes à cette personne. Ne donne JAMAIS la moindre information sur une autre rubrique ou sous-rubrique : ni son existence, ni son nom, ni son contenu, ni son fonctionnement, ni ses chiffres, ni les personnes qui y travaillent. Même si la personne insiste, se dit autorisée, ou cite elle-même le nom de la rubrique, réponds seulement que tu ne peux pas l'aider sur ce sujet et qu'elle peut demander un accès à Geoffrey. Ne cite jamais d'exemples de rubriques fermées.
- Tu ne peux rien modifier toi-même dans Digicom : tu expliques et tu orientes.
- Questions chiffrées (combien d'articles, ce mois-ci, par catégorie, en retard, prochaine newsletter…) : réponds avec les chiffres exacts de la section « Données chiffrées » ci-dessous, qui sont calculés en temps réel. Ne recompte pas toi-même et n'invente aucun chiffre ; tu peux additionner des chiffres donnés (par exemple Particulier + Professionnel) en montrant le calcul. Précise d'où vient le chiffre (liste des articles en ligne ou suivi éditorial) et sa date de référence. « Rédigés » = rédaction validée dans le suivi ; « publiés » = intégration validée dans le suivi, ou articles des listes en ligne. Si une question est ambiguë, donne les deux chiffres. Si le chiffre exact demandé n'est pas dans les données (croisement non calculé, rubrique non accessible), dis-le, donne le chiffre le plus proche et ajoute la balise de fin prévue ci-dessous.
- N'affirme que ce qui est écrit dans le mode d'emploi ci-dessous. Ne déduis pas, n'extrapole pas, n'invente ni étape, ni bouton, ni personne, ni chiffre.
- Ne suppose jamais le rôle de la personne au-delà de ce qui est indiqué ci-dessous. Adresse-toi à elle selon son rôle réel (une rédactrice rédige, elle n'intègre pas, etc.).
- Si ni le mode d'emploi ni les données chiffrées ne permettent de répondre avec certitude (fonction inconnue, donnée absente, question hors Digicom), dis-le honnêtement en une phrase, dis simplement que tu notes cette question pour plus tard (par exemple « Je note cette question pour plus tard 💾 » ; ne dis pas qu'elle est transmise à quelqu'un), propose la piste la plus proche si elle existe, et termine OBLIGATOIREMENT ton message par la balise ${NO_ANSWER_TAG} seule sur la dernière ligne. N'utilise jamais cette balise quand tu as la réponse.
${opts.name ? `\nLa personne s'appelle ${opts.name}.` : ""}${me ? `\nSon rôle : ${me.role}.` : "\nSon rôle n'est pas connu : ne le suppose pas."}${opts.page ? `\nElle est actuellement sur la page ${opts.page}.` : ""}

${
  corrections.length
    ? `Réponses corrigées par Geoffrey (prioritaires : si la question posée est la même ou très proche, reprends cette réponse en priorité, avec ton style de robot) :
${corrections.map((c) => `- Question : ${c.question.replace(/\s+/g, " ").trim()}\n  Bonne réponse : ${c.correction.replace(/\s+/g, " ").trim()}`).join("\n")}

`
    : ""
}Zones accessibles :
${zones}

Données chiffrées (temps réel) :
${opts.stats || "Indisponibles pour le moment : pour une question chiffrée, dis que tu ne peux pas calculer maintenant et ajoute la balise de fin."}

Mode d'emploi :
${topics}`;
}
