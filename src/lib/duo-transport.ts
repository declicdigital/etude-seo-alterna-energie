import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { LobbyPeer } from "./game-leaderboard";

/**
 * Bug Buster en duo : liaison en direct entre deux navigateurs (Supabase Realtime).
 * - « bug-buster:lobby » : salle d'attente (présence : qui a le jeu ouvert, qui cherche un
 *   partenaire) ;
 * - « bug-buster:room:<id> » : une partie, messages diffusés entre l'hôte et l'invité.
 * Les canaux sont privés (politiques sur realtime.messages, comptes validés uniquement,
 * migration 0014) ; si le canal privé est refusé, on retombe sur un canal public du même nom
 * pour que le jeu reste jouable.
 */

export type DuoMessage = { type: string } & Record<string, unknown>;

export type LobbyHandle = {
  update: (patch: Partial<LobbyPeer>) => void;
  leave: () => void;
};

export type RoomHandle = {
  send: (msg: DuoMessage) => void;
  leave: () => void;
};

/** Identifiant de la personne connectée (pour la présence et les rôles hôte / invité). */
export async function duoIdentity(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * supabase-js renvoie le canal déjà ouvert s'il en existe un avec le même nom, même s'il est en
 * train de se fermer : on attend donc la fermeture de l'ancien avant d'en ouvrir un neuf (sinon,
 * après une reconnexion, on parlait dans un canal mort et l'autre joueur ne voyait rien).
 */
async function dropExisting(topic: string) {
  const old = supabase.getChannels().filter((c) => c.topic === `realtime:${topic}`);
  await Promise.all(old.map((c) => supabase.removeChannel(c).catch(() => undefined)));
}

function openChannel(
  topic: string,
  presenceKey: string | undefined,
  setup: (ch: RealtimeChannel) => void,
  onReady: (ch: RealtimeChannel) => void,
): { current: () => RealtimeChannel | null; close: () => void } {
  let ch: RealtimeChannel | null = null;
  let closed = false;
  const make = async (isPrivate: boolean) => {
    await dropExisting(topic);
    if (closed) return;
    const c = supabase.channel(topic, {
      config: {
        private: isPrivate,
        broadcast: { self: false, ack: false },
        ...(presenceKey ? { presence: { key: presenceKey } } : {}),
      },
    });
    ch = c;
    setup(c);
    c.subscribe((status) => {
      if (closed || ch !== c) return;
      if (status === "SUBSCRIBED") onReady(c);
      else if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && isPrivate) {
        ch = null;
        void make(false);
      }
    });
  };
  void make(true);
  return {
    current: () => ch,
    close: () => {
      closed = true;
      const c = ch;
      ch = null;
      if (c) void supabase.removeChannel(c);
    },
  };
}

export function joinLobby(me: LobbyPeer, onPeers: (peers: LobbyPeer[]) => void): LobbyHandle {
  let state = { ...me };
  let ready = false;
  const handle = openChannel(
    "bug-buster:lobby",
    me.userId,
    (c) => {
      c.on("presence", { event: "sync" }, () => {
        const all = c.presenceState<LobbyPeer>();
        const peers: LobbyPeer[] = [];
        for (const metas of Object.values(all)) {
          const last = metas[metas.length - 1];
          if (last?.userId) peers.push(last);
        }
        onPeers(peers);
      });
    },
    (c) => {
      ready = true;
      void c.track(state);
    },
  );
  return {
    update: (patch) => {
      state = { ...state, ...patch };
      const c = handle.current();
      if (c && ready) void c.track(state);
    },
    leave: () => {
      const c = handle.current();
      if (c && ready) void c.untrack();
      handle.close();
    },
  };
}

export function joinRoom(
  room: string,
  onMessage: (msg: DuoMessage) => void,
  onReady?: () => void,
): RoomHandle {
  let ready = false;
  const queue: DuoMessage[] = [];
  const handle = openChannel(
    `bug-buster:room:${room}`,
    undefined,
    (c) => {
      c.on("broadcast", { event: "m" }, ({ payload }) => onMessage(payload as DuoMessage));
    },
    (c) => {
      ready = true;
      for (const m of queue.splice(0)) void c.send({ type: "broadcast", event: "m", payload: m });
      onReady?.();
    },
  );
  return {
    send: (msg) => {
      const c = handle.current();
      if (!c || !ready) {
        if (queue.length < 20) queue.push(msg);
        return;
      }
      void c.send({ type: "broadcast", event: "m", payload: msg });
    },
    leave: () => handle.close(),
  };
}
