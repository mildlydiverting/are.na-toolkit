AccountMenu — the header block for signing in: **[Connect →]** when signed out, **[avatar] name [Disconnect]** when signed in.

Sits in a page header beside the ThemeChooser. Both buttons are small ghost Buttons. It makes no requests and holds no token: the page (or `shared/widgets/auth-step.js`) decides what Connect and Disconnect do. The word "Connect" here is the sign-in step ("Connect to are.na"); are.na's *connection* object is a different thing.

## Options

- `user` — are.na's user object (`name`, `initials`, `slug`), or `null`/omitted when signed out.
- `onConnect()` — the Connect button was pressed (usually opens the AuthPanel in a Modal).
- `onDisconnect()` — the Disconnect button was pressed.
- `connectLabel` — default `Connect →`. `disconnectLabel` — default `Disconnect`.

The returned node has `setUser(user | null)` to switch state without rebuilding.

## Behaviour

- The avatar shows the API's own `initials`, else the first letters of the name (`Kim Plowright` → `KP`). It is `aria-hidden`; the name beside it is the accessible text.
- The name falls back from `name` to `full_name` to `slug`.
- Under 480px the name is hidden to save room; the avatar and button stay.
- Static helpers for tests: `AccountMenu.displayName(user)` and `AccountMenu.initials(user)`.

## Usage

```js
const account = ArenaToolkit.AccountMenu({ onConnect: openConnect, onDisconnect: () => auth.disconnect() });
header.append(account, ArenaToolkit.ThemeChooser());
// when the sign-in state changes:
account.setUser(user); // or null
```
