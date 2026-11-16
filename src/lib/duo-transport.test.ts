import { describe, expect, it, vi } from "vitest";

type Cb = (status: string) => void;
const channels: FakeChannel[] = [];
class FakeChannel {
  topic: string;
  removed = false;
  tracked: unknown[] = [];
  private cb: Cb | null = null;
  constructor(t: string) {
    this.topic = `realtime:${t}`;
  }
  on() {
    return this;
  }
  subscribe(cb: Cb) {
    this.cb = cb;
    setTimeout(() => !this.removed && this.cb?.("SUBSCRIBED"), 0);
    return this;
  }
  track(s: unknown) {
    this.tracked.push(s);
    return Promise.resolve("ok");
  }
  untrack() {
    return Promise.resolve("ok");
  }
  presenceState() {
    return {};
  }
  send() {
    return Promise.resolve("ok");
  }
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    // Comme realtime-js : un canal du même nom encore présent est renvoyé tel quel.
    channel: (t: string) => {
      const existing = channels.find((c) => c.topic === `realtime:${t}` && !c.removed);
      if (existing) return existing;
      const c = new FakeChannel(t);
      channels.push(c);
      return c;
    },
    getChannels: () => channels.filter((c) => !c.removed),
    removeChannel: (c: FakeChannel) =>
      new Promise((res) =>
        setTimeout(() => {
          c.removed = true;
          res("ok");
        }, 5),
      ),
    auth: { getSession: async () => ({ data: { session: null } }) },
  },
}));

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

describe("salle d'attente du duo", () => {
  it("après une reconnexion, l'annonce « je cherche » part sur un canal neuf et vivant", async () => {
    const { joinLobby } = await import("./duo-transport");
    const me = { userId: "u1", name: "A", avatar: "classic", map: "office", status: "idle", since: 1 } as never;
    const first = joinLobby(me, () => undefined);
    await tick();
    first.leave();
    const second = joinLobby(me, () => undefined);
    await tick(40);
    second.update({ status: "waiting" } as never);
    await tick();
    const live = channels.filter((c) => !c.removed);
    expect(live).toHaveLength(1);
    expect(live[0].tracked.at(-1)).toMatchObject({ status: "waiting" });
    second.leave();
  });
});
