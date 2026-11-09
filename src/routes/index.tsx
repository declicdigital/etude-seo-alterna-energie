import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { sheetPath } from "@/lib/slugs";
import { pendingEditorialDestination } from "@/lib/editorial-links";
import { digicomHead } from "@/lib/digicom-route";
export const Route = createFileRoute("/")({
  ssr: false,
  validateSearch: z.object({ sheet: z.string().optional() }),
  head: () => digicomHead("Accueil"),
  beforeLoad: ({ search, location }) => {
    if (!search.sheet) {
      const pending = pendingEditorialDestination();
      if (pending.to !== "/") throw redirect(pending);
    }
    throw redirect({ to: "/$", params: { _splat: sheetPath(search.sheet ?? "__home") }, hash: location.hash });
  },
});
