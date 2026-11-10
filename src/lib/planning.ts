/**
 * Rubrique « Planning intégré » (page public/planning-integre.html, données dans
 * public.planning_state). Qui peut modifier : les admins et ces comptes (anciens administrateurs
 * de l'outil « Planning intégré BDP »). Même liste que la fonction SQL `can_edit_planning`
 * (migration 0015) qui fait foi.
 */
export const PLANNING_SHEET = "PLANNING INTEGRE";
export const PLANNING_EDITOR_EMAILS = [
  "manon.babin@soregies.fr",
  "matthieu.roux@alterna-energie.fr",
  "sandrine.delval@soregies.fr",
];
