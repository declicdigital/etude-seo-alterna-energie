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
- Editorial email destinations use the shared editorial-links module and article/todo hash targets; the embedded page collapses other cards and opens the selected step and area, and sign-in preserves the destination to keep mail links targeted.
- FAQ requests remain in the request tracker; audience lists derive only from validated records, sorted by validation time, and a database trigger protects validation fields using the authenticated admin role to prevent client-side bypasses.
- The communication kit has its own approved-user route and a static asset manifest; ship original resources and a prebuilt complete ZIP through same-origin Lovable Assets downloads, without changing editorial workflows.
- Invitations use an authenticated admin-only server function and Cloud Auth Invite emails; the public acceptance page sets the initial password, and invitation secrets must never be returned to administrators or copied in email.
