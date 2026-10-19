import { test } from "node:test";
import { strict as assert } from "node:assert";
import { canValidateFaq, validatedFaqForTarget, type FaqRequest } from "./faq";

const request = (id: string, target: string, validatedAt?: string) => ({ id, target, validatedAt } as FaqRequest);
test("validation requires both a question and a valid article link", () => {
  assert.equal(canValidateFaq("", "https://example.com/faq"), false);
  assert.equal(canValidateFaq("Ma question ?", ""), false);
  assert.equal(canValidateFaq("Ma question ?", "javascript:alert(1)"), false);
  assert.equal(canValidateFaq("Ma question ?", "https://example.com/faq"), true);
});
test("saving a request alone does not add it to the Particulier table", () => {
  assert.deepEqual(validatedFaqForTarget([request("pending", "Particulier")], "Particulier"), []);
});
test("validated questions are added only to their selected target", () => {
  const rows = [request("p", "Particulier", "2026-10-19T15:00:00Z"), request("pro", "Professionnel", "2026-10-19T15:01:00Z")];
  assert.deepEqual(validatedFaqForTarget(rows, "Particulier").map((r) => r.id), ["p"]);
  assert.deepEqual(validatedFaqForTarget(rows, "Professionnel").map((r) => r.id), ["pro"]);
});
test("newly validated questions come first", () => {
  const rows = [request("old", "Particulier", "2026-10-18T15:00:00Z"), request("new", "Particulier", "2026-10-19T15:00:00Z")];
  assert.deepEqual(validatedFaqForTarget(rows, "Particulier").map((r) => r.id), ["new", "old"]);
});