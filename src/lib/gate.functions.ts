import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

type GateSession = { unlocked?: boolean };

function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const isUnlocked = createServerFn({ method: "GET" }).handler(async () => {
  const sessionConfig = {
    password: process.env.SESSION_SECRET!,
    name: "site-gate",
    maxAge: 60 * 60 * 24 * 30,
    cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" },
  };
  const session = await useSession<GateSession>(sessionConfig);
  return { unlocked: session.data.unlocked === true };
});

export const unlockSite = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const expected = process.env.SITE_PASSWORD;
    const sessionSecret = process.env.SESSION_SECRET;
    if (!expected || !sessionSecret) throw new Error("La protection du site n'est pas configurée");
    if (!passwordMatches(data.password, expected)) {
      return { ok: false as const };
    }
    const sessionConfig = {
      password: sessionSecret,
      name: "site-gate",
      maxAge: 60 * 60 * 24 * 30,
      cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" },
    };
    const session = await useSession<GateSession>(sessionConfig);
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const lockSite = createServerFn({ method: "POST" }).handler(async () => {
  const sessionConfig = {
    password: process.env.SESSION_SECRET!,
    name: "site-gate",
    maxAge: 60 * 60 * 24 * 30,
    cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" },
  };
  const session = await useSession<GateSession>(sessionConfig);
  await session.clear();
  return { ok: true as const };
});