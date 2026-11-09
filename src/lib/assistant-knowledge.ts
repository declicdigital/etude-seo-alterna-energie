/**
 * Connaissances de l'assistant Digicom : mode d'emploi de chaque rubrique et zones vers
 * lesquelles il peut renvoyer. Partagé par le serveur (contexte du modèle) et le navigateur
 * (réponses de secours sans IA). À tenir à jour quand une fonctionnalité change.
 */
import { visibleRubriqueEntries, type RubriqueKey } from "./rubriques";

export type AssistantZone = {
  id: string;
  label: string;
  /** Chemin interne, utilisé tel quel dans les liens de réponse. */
  path: string;
  /** Rubrique requise ; « all » pour tout compte validé, « admin » pour les administrateurs. */
  needs: RubriqueKey | "all" | "admin";
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
    label: "Stratégie PAC · Suivi éditorial",
    path: "/strategie-pac/suivi-editorial",
    needs: "pac",
    keywords: ["stratégie", "pac", "pompe à chaleur", "brief", "réécriture", "création", "suivi"],
  },
  {
    id: "pac-contenus",
    label: "Stratégie PAC · Contenus",
    path: "/strategie-pac/contenus",
    needs: "pac",
    keywords: ["stratégie", "pac", "contenus", "publiés", "liste"],
  },
  {
    id: "blog-suivi",
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
    label: "Blog · Particulier",
    path: "/blog/particulier",
    needs: "blog",
    keywords: ["blog", "particulier", "articles publiés", "liste"],
  },
  {
    id: "blog-pro",
    label: "Blog · Professionnel",
    path: "/blog/professionnel",
    needs: "blog",
    keywords: ["blog", "pro", "professionnel", "articles publiés", "expert"],
  },
  {
    id: "planete-suivi",
    label: "Parlons Planète · Suivi éditorial",
    path: "/parlons-planete/suivi-editorial",
    needs: "planete",
    keywords: ["parlons planète", "planète", "suivi", "aurorae", "rédaction", "intégration"],
  },
  {
    id: "planete-blog",
    label: "Parlons Planète · Blog",
    path: "/parlons-planete/blog",
    needs: "planete",
    keywords: ["parlons planète", "planète", "blog", "catégorie", "sous-catégorie", "publiés"],
  },
  {
    id: "faq-demandes",
    label: "FAQ · Demandes",
    path: "/faq/demandes",
    needs: "faq",
    keywords: ["faq", "question", "demande", "réponse"],
  },
  {
    id: "faq-part",
    label: "FAQ · Particulier",
    path: "/faq/particulier",
    needs: "faq",
    keywords: ["faq", "particulier", "questions validées"],
  },
  {
    id: "faq-pro",
    label: "FAQ · Professionnel",
    path: "/faq/professionnel",
    needs: "faq",
    keywords: ["faq", "pro", "professionnel", "questions validées"],
  },
  {
    id: "benchmark",
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
    label: "Newsletter Grands Comptes",
    path: "/calendriers-newsletters/grands-comptes",
    needs: "newsletters",
    keywords: ["newsletter", "grands comptes", "calendrier"],
  },
  {
    id: "nl-interne",
    label: "Newsletter Interne",
    path: "/calendriers-newsletters/interne",
    needs: "newsletters",
    keywords: ["newsletter", "interne", "calendrier"],
  },
  {
    id: "nl-b2c",
    label: "Newsletter B2C",
    path: "/calendriers-newsletters/b2c",
    needs: "newsletters",
    keywords: ["newsletter", "b2c", "calendrier"],
  },
  {
    id: "nl-sme",
    label: "Newsletter SME",
    path: "/calendriers-newsletters/sme",
    needs: "newsletters",
    keywords: ["newsletter", "sme", "calendrier"],
  },
  {
    id: "organisation",
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
];

/** Zones que la personne peut ouvrir. */
export function zonesFor(allowed: string[] | null | undefined, isAdmin: boolean): AssistantZone[] {
  const keys = new Set<string>(visibleRubriqueEntries(allowed).map((r) => r.key));
  return ASSISTANT_ZONES.filter(
    (z) => z.needs === "all" || (z.needs === "admin" ? isAdmin : keys.has(z.needs)),
  );
}

/** Fiches pratiques : servent de contexte au modèle et de réponses de secours. */
export type AssistantTopic = { zone: string; title: string; keywords: string[]; answer: string };

export const ASSISTANT_TOPICS: AssistantTopic[] = [
  {
    zone: "all",
    title: "Se repérer dans Digicom",
    keywords: ["menu", "naviguer", "où", "trouver", "rubrique", "barre", "gauche", "accueil"],
    answer:
      "Le menu de gauche regroupe les rubriques auxquelles tu as accès (chaque bloc de couleur s'ouvre avec +). L'Accueil liste tes rubriques, le Guide de l'outil donne le mode d'emploi de chacune et le Kit de communication rassemble logos et ressources. Sur téléphone, le menu s'ouvre avec le bouton ☰ en haut.",
  },
  {
    zone: "all",
    title: "Accès et comptes",
    keywords: [
      "accès",
      "voir",
      "rubrique manquante",
      "pas accès",
      "droits",
      "compte",
      "connexion",
      "mot de passe",
      "google",
    ],
    answer:
      "Chaque rubrique s'ouvre compte par compte. S'il t'en manque une, demande à Geoffrey de te l'ouvrir dans « Demandes d'accès ». Pour te connecter : email + mot de passe ou « Continuer avec Google ». Un nouveau compte se crée avec « Créer un compte » puis doit être validé par l'administrateur.",
  },
  {
    zone: "demandes",
    title: "Gérer les accès (administrateurs)",
    keywords: [
      "valider un compte",
      "inviter",
      "invitation",
      "donner accès",
      "retirer accès",
      "demandes",
    ],
    answer:
      "Dans « Demandes d'accès » (bouton en haut à droite) : valide ou refuse les nouveaux comptes, invite une personne par email, et pour chaque compte coche les rubriques et sous-rubriques ouvertes. Parlons Planète et Organisation sont fermées par défaut.",
  },
  {
    zone: "blog-suivi",
    title: "Créer un article de blog (À rédiger)",
    keywords: [
      "nouvel article",
      "créer",
      "ajouter une ligne",
      "à rédiger",
      "sujet",
      "enregistrer",
      "lien du doc",
    ],
    answer:
      "Dans le Suivi éditorial, bloc « À rédiger » : clique sur « + Ajouter une ligne », remplis ce que tu sais (sujet, édition, titre H1, cible, catégorie, énergie, deadline). Dès que le lien du doc est collé, « Enregistrer » s'active : l'article est créé dans le suivi (étape Rédaction validée, datée du jour si besoin) et Geoffrey reçoit un mail. Les cases vides se complètent ensuite dans la carte.",
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
    ],
    answer:
      "Particulier : Rédaction → Image (Geoffrey) → Relecture (Fannie & Coraline) → Intégration (Marick) → Publié. Professionnel : une Relecture métier par l'expert vient après la rédaction. À chaque validation, la personne de l'étape suivante reçoit un mail avec un lien qui ouvre la carte à la bonne étape. Une fois l'intégration validée (lien publié obligatoire), l'article s'ajoute en haut du Blog Particulier ou Professionnel, coché « Publié ».",
  },
  {
    zone: "blog-suivi",
    title: "Valider une étape",
    keywords: ["valider", "marquer validée", "date", "étape suivante", "passer"],
    answer:
      "Ouvre la carte, clique sur l'étape puis « Marquer validée ». Sans date saisie, la date du jour est mise automatiquement. Un double clic ne valide pas l'étape suivante. La personne de l'étape suivante est prévenue par mail (Geoffrey en copie).",
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
      "télécharger image",
      "remplacer",
    ],
    answer:
      "À l'étape Image, deux cases : « 1500 × 700 » et « 950 × 475 ». Glisse l'image dans la case ou clique pour la choisir ; un clic sur l'aperçu la télécharge, la croix la retire, un nouvel envoi la remplace.",
  },
  {
    zone: "blog-suivi",
    title: "Relire les images et demander une modification",
    keywords: ["relecture", "agrandir", "zoom", "commentaire", "modification", "corriger image"],
    answer:
      "À l'étape Relecture, les images s'affichent en grand ; un clic les agrandit en plein écran (sans télécharger). Sous chaque image, écris la modification à faire : le commentaire apparaît, avec ton nom, sur la case de l'image à l'étape Image pour Geoffrey.",
  },
  {
    zone: "blog-suivi",
    title: "Deadlines et rappels",
    keywords: ["deadline", "délai", "rappel", "retard", "échéance", "relance"],
    answer:
      "Deadlines automatiques : la Relecture doit être faite 3 jours ouvrés après la validation de l'Image, l'Intégration 5 jours ouvrés après la Relecture. Geoffrey peut aussi poser ou changer la deadline de chaque étape dans la carte. La deadline est écrite dans le mail d'étape, et le responsable reçoit un rappel le matin du jour J. Les badges sur les étapes passent en orange à 2 jours et en rouge en retard. Geoffrey peut aussi envoyer un rappel manuel depuis l'étape.",
  },
  {
    zone: "blog-suivi",
    title: "Messages et mentions",
    keywords: ["message", "commentaire", "taguer", "mentionner", "@", "discussion"],
    answer:
      "En bas de chaque carte, la zone Messages : tape @ pour taguer une personne, elle reçoit un mail (un seul mail même si plusieurs personnes sont taguées). Les messages se modifient sans renvoyer de mail.",
  },
  {
    zone: "blog-suivi",
    title: "Retrouver ou partager un article",
    keywords: [
      "lien",
      "partager",
      "copier",
      "retrouver",
      "rechercher",
      "carte",
      "tout déplier",
      "tout réduire",
    ],
    answer:
      "Le bouton « 🔗 Lien » d'une carte copie son adresse ; l'adresse de la page suit aussi la carte ouverte. « Tout déplier » / « Tout réduire » ouvrent ou ferment toutes les cartes. Les liens des mails ouvrent directement la carte à la bonne étape.",
  },
  {
    zone: "blog-part",
    title: "Les listes d'articles publiés",
    keywords: ["publié", "liste", "tableau", "articles en ligne", "filtrer", "trier", "colonne"],
    answer:
      "Blog › Particulier et Blog › Professionnel listent les articles publiés : un clic sur une ligne ouvre son détail, les colonnes se trient et se filtrent, et chaque article intégré depuis le suivi s'ajoute en haut automatiquement.",
  },
  {
    zone: "pac-suivi",
    title: "Stratégie PAC",
    keywords: ["stratégie", "pac", "brief", "réécriture", "création", "éditorial"],
    answer:
      "Suivi éditorial Stratégie PAC (contenus Particulier) : dans « À rédiger », renseigne le type (Création ou Réécriture), sujet, H1, édition, catégorie Blog/Éditorial, deadline, lien du brief et lien du doc → Enregistrer. Création : Brief + Rédaction → Image (Geoffrey) → Relecture (Fannie & Coraline) → Intégration (Marick). Réécriture : Brief + Rédaction → Intégration directe. Publié : en haut de « Contenus », et aussi du Blog Particulier si la catégorie est Blog.",
  },
  {
    zone: "planete-suivi",
    title: "Parlons Planète",
    keywords: [
      "parlons planète",
      "planète",
      "aurorae",
      "catégorie",
      "sous-catégorie",
      "parlonsplanete",
    ],
    answer:
      "Suivi Parlons Planète : Rédaction (Aurorae) puis Intégration (Geoffrey). Dans « À rédiger », le lien du doc suffit pour enregistrer ; la catégorie est obligatoire avant l'intégration, la sous-catégorie est facultative. Une fois l'intégration validée avec le lien publié, l'article s'ajoute en haut du Blog Parlons Planète avec catégorie, sous-catégorie et date de publication, coché « Publié ».",
  },
  {
    zone: "faq-demandes",
    title: "Demander une FAQ",
    keywords: ["faq", "question", "nouvelle faq", "demander", "réponse", "valider faq"],
    answer:
      "FAQ › Demandes : crée une demande (Création ou Réécriture, sujet, contenu à créer ou déjà fourni avec question + réponse, cible, catégorie, commentaire avec @ et pièce jointe) puis Sauvegarder : Geoffrey est prévenu. Les échanges se font sur la carte. Geoffrey valide avec le lien et la question finale ; la FAQ apparaît alors dans FAQ › Particulier ou Professionnel.",
  },
  {
    zone: "benchmark",
    title: "Benchmark",
    keywords: [
      "benchmark",
      "prix",
      "concurrent",
      "fournisseur",
      "ttc",
      "remise",
      "mois",
      "classement",
    ],
    answer:
      "Benchmark : choisis Électricité ou Gaz et le mois pour voir le classement des offres (prix TTC uniquement, notre référence Alterna incluse, export PDF). La saisie est réservée à Geoffrey : un fournisseur à la fois, remise en % dans sa case, tarifs extraits d'un PDF ou d'un texte collé, puis « Valider » le fournisseur et enregistrer le mois.",
  },
  {
    zone: "nl-gc",
    title: "Calendriers newsletters",
    keywords: ["newsletter", "calendrier", "envoi", "bat", "agenda", "ics", "cadence"],
    answer:
      "Calendriers newsletters (Grands Comptes, Interne, B2C, SME) : le prochain envoi s'affiche en haut, puis les échéances. Chaque étape (sujets, rédaction, relecture, BAT, envoi) indique qui envoie à qui, toujours en semaine, jusqu'à fin 2027. Filtre les newsletters, et ajoute les dates à ton agenda avec le fichier .ics (Outlook, Google Agenda).",
  },
  {
    zone: "organisation",
    title: "Organisation (tâches)",
    keywords: [
      "organisation",
      "tâche",
      "fiche",
      "note",
      "assigner",
      "responsable",
      "taguer",
      "échéance",
      "fichier",
      "lien",
      "pièce jointe",
    ],
    answer:
      "Organisation : ajoute une fiche dans une section (double-clic pour renommer une section). La fiche contient une note sans limite (les liens y sont cliquables), un responsable, des personnes taguées (elles reçoivent un mail), une échéance, et « Fichiers et liens » : ajoute un lien nommé ou joins un fichier (50 Mo max, glisser-déposer possible). Recherche et filtres en haut.",
  },
  {
    zone: "kit",
    title: "Kit de communication",
    keywords: ["kit", "logo", "charte", "typo", "couleurs", "ressources", "zip"],
    answer:
      "Le Kit de communication (menu de gauche) rassemble les ressources de la marque : logos, éléments de charte et fichiers à télécharger un par un ou en ZIP complet.",
  },
  {
    zone: "all",
    title: "Sauvegarde et notifications",
    keywords: ["sauvegarde", "export", "cloche", "notification", "déconnexion", "enregistré"],
    answer:
      "Tout est enregistré automatiquement en ligne. Le bouton « Sauvegarde » (en haut à droite) télécharge une copie des données ; la cloche du suivi liste les messages qui te concernent ; « Déconnexion » ferme ta session.",
  },
];

/** Sujets visibles par la personne (selon ses zones). */
export function topicsFor(zones: AssistantZone[]): AssistantTopic[] {
  const ids = new Set(zones.map((z) => z.id));
  return ASSISTANT_TOPICS.filter((t) => t.zone === "all" || ids.has(t.zone));
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@ ]+/g, " ");

/** Réponse de secours, sans IA : la fiche pratique la plus proche de la question, avec son lien. */
export function localAnswer(
  question: string,
  zones: AssistantZone[],
  name?: string | null,
): string {
  const q = ` ${norm(question)} `;
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  const score = (keywords: string[], title = "") =>
    keywords.reduce((n, k) => n + (q.includes(` ${norm(k)} `) || q.includes(norm(k)) ? 3 : 0), 0) +
    words.filter((w) => norm(title).includes(w)).length;
  const best = topicsFor(zones)
    .map((t) => ({ t, s: score(t.keywords, t.title) }))
    .sort((a, b) => b.s - a.s)[0];
  const hello = `Bonjour${name ? ` ${name}` : ""} !`;
  if (!best || best.s === 0) {
    const list = zones
      .slice(0, 6)
      .map((z) => `[${z.label}](${z.path})`)
      .join(" · ");
    return `${hello} Je n'ai pas trouvé de réponse précise à ta question. Tu peux la reformuler, ou ouvrir le [Guide de l'outil](/guide). Tes rubriques : ${list}.`;
  }
  const zone = zones.find((z) => z.id === best.t.zone);
  return `${hello} ${best.t.answer}${zone ? `\n\n→ [${zone.label}](${zone.path})` : ""}`;
}

/** Contexte donné au modèle : uniquement ce que la personne peut voir. */
export function assistantSystemPrompt(opts: {
  zones: AssistantZone[];
  name?: string | null;
  page?: string | null;
}): string {
  const zones = opts.zones.map((z) => `- ${z.label} → ${z.path}`).join("\n");
  const topics = topicsFor(opts.zones)
    .map((t) => `## ${t.title}\n${t.answer}`)
    .join("\n\n");
  return `Tu es l'assistant de Digicom, l'outil interne de suivi de la communication digitale d'Alterna Énergie.
Tu aides les personnes à se servir de Digicom. Réponds en français, avec chaleur et clarté, en tutoyant la personne (ton simple et amical, comme un collègue).

Règles :
- Ta toute première réponse de la conversation commence par « Bonjour${opts.name ? ` ${opts.name}` : ""} ».
- Réponses courtes et concrètes : 2 à 6 phrases, ou une liste d'étapes numérotées si c'est une procédure.
- Quand une zone de Digicom aide, ajoute un lien Markdown vers elle avec EXACTEMENT un chemin de la liste ci-dessous, par exemple [Blog · Suivi éditorial](/blog/suivi-editorial). N'invente jamais d'autre chemin ni d'adresse externe.
- Ne parle que des zones de la liste : ce sont les seules rubriques auxquelles la personne a accès. Si elle demande une rubrique absente, dis-lui de demander l'accès à Geoffrey.
- Si la réponse n'est pas dans le mode d'emploi ci-dessous, dis-le honnêtement, propose la piste la plus proche et suggère de contacter Geoffrey (geoffrey.delabarre@alterna-energie.fr). N'invente pas de fonctionnalité.
- Tu ne peux rien modifier toi-même dans Digicom : tu expliques et tu orientes.
${opts.name ? `\nLa personne s'appelle ${opts.name}.` : ""}${opts.page ? `\nElle est actuellement sur la page ${opts.page}.` : ""}

Zones accessibles :
${zones}

Mode d'emploi :
${topics}`;
}
