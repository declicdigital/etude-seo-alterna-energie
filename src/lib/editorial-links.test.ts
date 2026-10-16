import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { editorialLink, notificationLink } from "./editorial-links";

describe("email destinations", () => {
  test("Fannie opens the image area of the review step", () => {
    assert.equal(notificationLink("relecture", "a1").split("#")[1], "#article-a1?step=validation&focus=images".slice(1));
  });
  test("review supports the renamed relecture key", () => {
    assert.equal(notificationLink("relecture", "a1", "relecture").split("#")[1], "#article-a1?step=relecture&focus=images".slice(1));
  });
  test("Marick opens integration", () => {
    assert.equal(notificationLink("integration", "a1").split("#")[1], "#article-a1?step=integration".slice(1));
  });
  test("Geoffrey opens the completed integration", () => {
    assert.equal(notificationLink("published", "a1").split("#")[1], "#article-a1?step=integration".slice(1));
  });
  test("mentions open the card messages", () => {
    assert.equal(editorialLink("a1", undefined, "comments").split("#")[1], "#article-a1?focus=comments".slice(1));
  });
  test("reminders open the pending writing row", () => {
    assert.equal(editorialLink("t2", undefined, undefined, true).split("#")[1], "#todo-t2".slice(1));
  });
});