import { describe, expect, test } from "bun:test";
import { editorialLink, notificationLink } from "./editorial-links";

describe("email destinations", () => {
  test("Fannie opens the image area of the review step", () => {
    expect(notificationLink("relecture", "a1")).toEndWith("#article-a1?step=validation&focus=images");
  });
  test("review supports the renamed relecture key", () => {
    expect(notificationLink("relecture", "a1", "relecture")).toEndWith("#article-a1?step=relecture&focus=images");
  });
  test("Marick opens integration", () => {
    expect(notificationLink("integration", "a1")).toEndWith("#article-a1?step=integration");
  });
  test("Geoffrey opens the completed integration", () => {
    expect(notificationLink("published", "a1")).toEndWith("#article-a1?step=integration");
  });
  test("mentions open the card messages", () => {
    expect(editorialLink("a1", undefined, "comments")).toEndWith("#article-a1?focus=comments");
  });
  test("reminders open the pending writing row", () => {
    expect(editorialLink("t2", undefined, undefined, true)).toEndWith("#todo-t2");
  });
});