import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildBoards,
  earliestStart,
  GAME_AVATARS,
  GAME_MAPS,
  GAME_MODES,
  plausibleScore,
  type Boards,
  type ScoreRow,
} from "./game-leaderboard";

/**
 * Mini-jeu « Bug Buster » : enregistrement des parties et classements. Les droits sont portés
 * par la base (RLS : comptes validés uniquement ; nom du joueur fixé depuis son profil).
 */

export const submitGameScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        score: z.number().int().min(0).max(4_000_000),
        avatar: z.enum(GAME_AVATARS),
        map: z.enum(GAME_MAPS),
        duration: z.number().int().min(0).max(7200),
        mode: z.enum(GAME_MODES).default("solo"),
        partnerId: z.string().uuid().optional(),
        partnerAvatar: z.enum(GAME_AVATARS).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    if (data.score <= 0 || !plausibleScore(data.score, data.duration, data.mode))
      return { ok: false };
    if (data.mode === "duo" && (!data.partnerId || data.partnerId === context.userId))
      return { ok: false };
    // En duo, c'est l'hôte qui enregistre la partie ; le nom du ou de la partenaire est repris
    // de son profil par la base (déclencheur game_scores_fill).
    const { error } = await context.supabase.from("game_scores").insert({
      score: data.score,
      avatar: data.avatar,
      map: data.map,
      duration_s: data.duration,
      mode: data.mode,
      partner_id: data.mode === "duo" ? data.partnerId : null,
      partner_avatar: data.mode === "duo" ? (data.partnerAvatar ?? "digi") : null,
    });
    return { ok: !error };
  });

export type LeaderboardResult = { ok: true; boards: Boards } | { ok: false };

export const getGameLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LeaderboardResult> => {
    const now = new Date();
    const since = earliestStart(now).toISOString();
    const rows: ScoreRow[] = [];
    for (let from = 0; from < 20_000; from += 1000) {
      const { data, error } = await context.supabase
        .from("game_scores")
        .select(
          "user_id, player_name, avatar, map, score, created_at, mode, partner_id, partner_name, partner_avatar",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .range(from, from + 999);
      if (error) return { ok: false };
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return { ok: true, boards: buildBoards(rows, now, context.userId) };
  });
