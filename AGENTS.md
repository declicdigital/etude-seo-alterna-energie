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
- Editorial email destinations use the shared editorial-links module and article/todo hash targets; the embedded page opens the selected step and area, and sign-in preserves the destination.
