# arena-merge — notes for agents

Single file, `arena-merge/index.html`, copied to `docs/arena-merge.html` (Pages). Not yet on the `src/` + `@include` pattern.

## Done 2026-10-22 (single-file tweaks, before the port)
Breadcrumb header; stepper to the design-system pattern with per-step descriptions; ThemeChooser (Light, Dusk, Dark, Dawn, System) with colour tokens aliased onto `shared/ui/tokens.css`; Checkbox and Radio copied from the duplicate finder (resting border raised to `--text-muted` for 3:1); Transfer step has **Dry Run** and **Run Full Merge** buttons (emphasis swaps after a dry run; confirm dialog before a full merge); Source thumbnails fixed (v3 uses `image.square.src`, not `.url`); `describeBlock` no longer crashes on untitled Text blocks.

## Open work
1. **Duplicate handling in the destination (parked, Kim 2026-10-22).** Today only identical block ID counts as "already there". Use logic like the duplicate finder's (`arena-duplicate-finder/src/clustering.js`, `shared/api/url-normalise.js`): same source URL, normalised URL, same image. Decide what the merge does with a near-duplicate (skip, flag, ask).
2. **Status detail block as a component.** The mono log with green (success) / grey (message) / red (fail), `.log-details` / `.log-line`. Keep it free of tool state so it lifts out.
3. **Four-panel count display under the progress bar as a component** (added / skipped / removed / failed).
4. **Port to the new architecture** (`src/`, `@include`, shared code). Candidates to extract into `shared/`: channel picker (`shared/widgets/channel-picker.js` already exists, so reuse it), the two components above, Checkbox and Radio (promote to `shared/ui` and the design-system artifact together; tell the artifact owner the border-contrast change), the inline Button/Modal/Menu/ThemeChooser CSS copied from `shared/ui/bundle.css` (use `@include` instead).
5. Not yet verified against live are.na data: the thumbnail fix and the Dry Run / Run Full Merge flow were checked with synthetic v3-shaped fixtures only.
