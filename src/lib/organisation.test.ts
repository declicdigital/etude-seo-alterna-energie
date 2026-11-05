import { describe, expect, it } from "vitest";
import {
  attachmentsOf,
  cardIdFromHash,
  formatSize,
  linkify,
  normalizeLink,
  storageName,
  dueState,
  excerpt,
  initials,
  matchesFilter,
  memberName,
  newlyInvolved,
  positionBetween,
  positionForDrop,
  type OrgCard,
} from "@/lib/organisation";
import { sheetAllowed } from "@/lib/sections";

const card = (
  id: string,
  column_id: string,
  position: number,
  extra: Partial<OrgCard> = {},
): OrgCard => ({
  id,
  column_id,
  position,
  title: id,
  content: "",
  assignee_id: null,
  tagged_ids: [],
  due_date: null,
  attachments: [],
  created_by: null,
  created_at: "2026-11-05T10:00:00Z",
  updated_by: null,
  updated_at: "2026-11-05T10:00:00Z",
  ...extra,
});

describe("organisation board", () => {
  it("places items between neighbours", () => {
    expect(positionBetween(null, null)).toBe(1000);
    expect(positionBetween(1000, null)).toBe(2000);
    expect(positionBetween(null, 1000)).toBe(0);
    expect(positionBetween(1000, 2000)).toBe(1500);
  });

  it("computes the position of a dropped card, ignoring the card itself", () => {
    const cards = [
      card("a", "c1", 1000),
      card("b", "c1", 2000),
      card("c", "c1", 3000),
      card("x", "c2", 1000),
    ];
    expect(positionForDrop(cards, "x", "c1", 0)).toBe(0);
    expect(positionForDrop(cards, "x", "c1", 1)).toBe(1500);
    expect(positionForDrop(cards, "x", "c1", 3)).toBe(4000);
    // Moving "a" below "b" in the same column.
    expect(positionForDrop(cards, "a", "c1", 1)).toBe(2500);
    expect(positionForDrop(cards, "a", "c2", 0)).toBe(0);
    expect(positionForDrop(cards, "a", "empty", 0)).toBe(1000);
  });

  it("names people and builds initials", () => {
    expect(memberName({ id: "1", full_name: "Geoffrey Delabarre", email: "g@x.fr" })).toBe(
      "Geoffrey Delabarre",
    );
    expect(memberName({ id: "1", full_name: null, email: "olivia.bertin@x.fr" })).toBe(
      "olivia.bertin",
    );
    expect(memberName(undefined)).toBe("Ancien membre");
    expect(initials({ id: "1", full_name: "Geoffrey Delabarre", email: "g@x.fr" })).toBe("GD");
    expect(initials({ id: "1", full_name: null, email: "olivia.bertin@x.fr" })).toBe("OB");
  });

  it("tells overdue and upcoming due dates apart", () => {
    const today = new Date(2026, 10, 5, 18);
    expect(dueState("2026-11-04", today)).toBe("overdue");
    expect(dueState("2026-11-05", today)).toBe("today");
    expect(dueState("2026-11-08", today)).toBe("soon");
    expect(dueState("2026-11-20", today)).toBe("later");
  });

  it("filters by assignee, tag and text", () => {
    const c = card("a", "c1", 1, {
      title: "Refonte du site",
      content: "Brief Webflow",
      assignee_id: "me",
      tagged_ids: ["you"],
    });
    expect(matchesFilter(c, "mine", "me", "")).toBe(true);
    expect(matchesFilter(c, "mine", "you", "")).toBe(false);
    expect(matchesFilter(c, "tagged", "you", "")).toBe(true);
    expect(matchesFilter(c, "all", null, "webflow")).toBe(true);
    expect(matchesFilter(c, "all", null, "newsletter")).toBe(false);
  });

  it("only notifies people newly involved, never the author", () => {
    expect(newlyInvolved(null, { assignee_id: "a", tagged_ids: ["b", "me"] }, "me")).toEqual({
      assigned: ["a"],
      tagged: ["b"],
    });
    expect(
      newlyInvolved(
        { assignee_id: "a", tagged_ids: ["b"] },
        { assignee_id: "a", tagged_ids: ["b", "c"] },
        "me",
      ),
    ).toEqual({
      assigned: [],
      tagged: ["c"],
    });
    expect(
      newlyInvolved(
        { assignee_id: null, tagged_ids: ["a"] },
        { assignee_id: "a", tagged_ids: ["a"] },
        "me",
      ),
    ).toEqual({
      assigned: ["a"],
      tagged: [],
    });
    expect(newlyInvolved(null, { assignee_id: "me", tagged_ids: [] }, "me")).toEqual({
      assigned: [],
      tagged: [],
    });
  });

  it("keeps short previews and reads card links", () => {
    expect(excerpt("ligne 1\n\nligne 2")).toBe("ligne 1 ligne 2");
    expect(excerpt("x".repeat(200)).length).toBe(140);
    expect(cardIdFromHash("#card-0b5d8a3e-1c2f-4a6b-9d7e-112233445566")).toBe(
      "0b5d8a3e-1c2f-4a6b-9d7e-112233445566",
    );
    expect(cardIdFromHash("#article-1")).toBeNull();
  });

  it("is closed by default and opened per account", () => {
    expect(sheetAllowed("ORGANISATION", ["Blog"])).toBe(false);
    expect(sheetAllowed("ORGANISATION", ["Blog", "Organisation"])).toBe(true);
    expect(sheetAllowed("ORGANISATION", null)).toBe(true);
  });
});

describe("liens et pièces jointes", () => {
  it("rend un lien tapé utilisable et refuse le reste", () => {
    expect(normalizeLink("parlonsplanete.com/blog")).toBe("https://parlonsplanete.com/blog");
    expect(normalizeLink(" https://exemple.fr ")).toBe("https://exemple.fr/");
    expect(normalizeLink("javascript:alert(1)")).toBeNull();
    expect(normalizeLink("pas un lien")).toBeNull();
    expect(normalizeLink("bonjour")).toBeNull();
  });

  it("repère les liens dans une note sans avaler la ponctuation", () => {
    const parts = linkify("Voir https://exemple.fr/doc, et www.alterna-energie.fr.");
    expect(parts.filter((p) => p.href).map((p) => p.href)).toEqual([
      "https://exemple.fr/doc",
      "https://www.alterna-energie.fr/",
    ]);
    expect(parts.map((p) => p.text).join("")).toBe(
      "Voir https://exemple.fr/doc, et www.alterna-energie.fr.",
    );
    expect(linkify("Rien ici")).toEqual([{ text: "Rien ici" }]);
  });

  it("lit la liste des pièces jointes d'une fiche avec tolérance", () => {
    const ok = { id: "a", kind: "link", name: "Doc", url: "https://x.fr/", added_at: "" };
    expect(attachmentsOf({ attachments: [ok, { id: 1 }, null] })).toEqual([ok]);
    expect(attachmentsOf({})).toEqual([]);
  });

  it("nomme les fichiers stockés sans accents ni espaces", () => {
    expect(storageName("Compte rendu Réunion (v2).pdf")).toBe("Compte-rendu-Reunion-v2-.pdf");
    expect(storageName("???")).toBe("fichier");
    expect(formatSize(2048)).toBe("2 Ko");
    expect(formatSize(3 * 1024 * 1024 + 200000)).toBe("3,2 Mo");
  });
});
