<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Editorial attachment selection and drag-and-drop use the same upload handler in the embedded editorial page, so validation and persistence remain consistent.
- Canonical rubrique and fiche paths use the shared slugs module and a TanStack splat route; editorial-links translates mail paths into internal iframe targets, preserving legacy destinations and sign-in return paths so links stay targeted.
- Article notifications apply recipient-specific field filtering before rendering either HTML or plain text, so both formats respect the same disclosure rules.
- Embedded editorial workflows use the shared browser-safe public pipeline module to normalize split steps and audience/type transitions; archive legacy combined steps, preserve actual dates and publication history, and restore removed steps on reversible type changes.
- Step completion uses the shared pipeline helper and explicitly supplied per-step dates, including separate todo brief/writing dates; never overwrite an entered date; only when a step (or a todo saved with just its doc link) has no date does validation stamp today's date, as requested by the user.
- FAQ requests remain in the request tracker; audience lists derive only from validated records, sorted by validation time, and a database trigger protects validation fields using the authenticated admin role to prevent client-side bypasses.
- The communication kit has its own approved-user route and a static asset manifest; ship original resources and a prebuilt complete ZIP through same-origin Lovable Assets downloads, without changing editorial workflows.
- Invitations use an authenticated admin-only server function and Cloud Auth Invite emails; the public acceptance page sets the initial password, and invitation secrets must never be returned to administrators or copied in email.
- Access activity uses an admin-gated SQL RPC projecting only Auth sign-in time, invitation time and password-presence completion; never return hashes or tokens, and do not infer invitation completion from link clicks or profile approval.
- Brand logos stay scoped to the surface the user points at: the Digicom wordmark replaces the Alterna logo only in the « Demandes d'accès » page header, while every other surface keeps the Alterna logo — never swap a logo site-wide from one screenshot request.
- Review-step recipients are enforced by `notificationRecipients` using the Service Communication list in `src/lib/article-notification.ts`, even when legacy settings specify a partial group; embedded defaults are normalized for visible consistency.
- Manual step reminders bridge the same-origin embedded page to an authenticated server function; verify both Geoffrey’s identity and admin role server-side, and derive content and recipients from persisted article/configuration rather than client payloads.
- The Benchmark tool lives in `public/benchmark.html` with data in `public.benchmark_months` behind `src/routes/api/public/benchmark-months.ts`; reads require an approved session, writes require Geoffrey's admin identity checked server-side via `canEditBenchmark`, and the embedded page sends the session token from same-origin localStorage (no password login).
- The « Organisation » board (`src/components/organisation-board.tsx`) stores columns and cards in `public.org_columns` / `public.org_cards`; RLS and the `org_cards_guard` trigger rely on `can_use_organisation` (admin, or approved with « Organisation » granted in `allowed_sections`, closed by default), authorship is set from the session, and assignee/tag emails go through `/api/public/notify-organisation`, which re-reads the saved card before sending.
- Organisation cards keep links and files in `org_cards.attachments` (jsonb); files live in the private Storage bucket `org-files` under `<card id>/…`, gated by `can_use_organisation` storage policies, opened through short-lived signed URLs, and removed from storage when the attachment or card is deleted.
- Per-step deadlines (`step.deadline`): set automatically by `EditorialPipeline.applyAutoDeadline` (Relecture = Image validation date + 3 business days, Intégration = Relecture validation date + 5 business days, never overwriting an existing deadline) or by Geoffrey in the card (gated client-side by `canRemind`). The next step's deadline is sent as `stepDeadline` and shown in the step mail; the daily `/api/public/jobs/deadline-reminders` job mails the step's assignee on the deadline day (previous Friday for weekend deadlines) via `src/lib/step-deadlines.ts`, once per `reminderStepJ:<space>:<article>:<step>:<deadline>` marker.
