AuthPanel — the "Connect to are.na" token form, and the signed-in chip that replaces it.

Pure presentation. It makes no requests and stores nothing: `shared/widgets/auth-step.js` (`createAuthStep`) owns the token, the checks and the storage, and calls `update()` as things change. Tools normally use `createAuthStep` and put its `.element` in a Modal or a page; reach for AuthPanel directly only to build a different flow.

## Options

- `tokenUrl` — where the "personal access token" link goes.
- `panel` — `false` (default, compact: used in Palimpsest's Modal) or `true` (Merge's layout: labelled field, "Remember on this computer" checkbox, account chip).
- `requireWrite`, `writeMessage` — the intro asks for write access; `writeMessage` is a bold line above it ("Editing needs a token with write access.").
- `remember` — checkbox state (panel only). `onRememberChange(bool)`.
- `onConnect(token)` — Connect pressed, or Enter in the field. `onDisconnect()`.

## `update(partial)`

Merges keys into the state and redraws: `user`, `detail` (the chip's second line), `status`, `requireWrite`, `writeMessage`, `remember`.

`status` is `null` or `{ tone: 'error' | 'info', label?, message }` and is drawn as a Notice when it is an error and as a StatusMessage line otherwise: below the form when signed out, above the chip when signed in (panel).

## Behaviour

- The form is rebuilt on every `update`, so a typed token is cleared after an error (as before).
- The token field is `type="password"`, `autocomplete="off"`, with id `arena-token` and a real `<label>` in panel mode.
- Signed in, non-panel: a success Badge "Connected as @slug" and a ghost Disconnect.
