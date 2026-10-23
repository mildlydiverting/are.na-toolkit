/* ArenaToolkit — component bundle. Classic script, assigns window.ArenaToolkit. */
(function () {
  'use strict';

  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'className') node.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.indexOf('on') === 0 && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (v === true) {
          node.setAttribute(k, '');
        } else {
          node.setAttribute(k, String(v));
        }
      }
    }
    if (kids == null) return node;
    if (!Array.isArray(kids)) kids = [kids];
    for (var i = 0; i < kids.length; i++) {
      var c = kids[i];
      if (c == null) continue;
      if (typeof c === 'string' || typeof c === 'number') {
        node.appendChild(document.createTextNode(String(c)));
      } else {
        node.appendChild(c);
      }
    }
    return node;
  }

  function Button(opts) {
    opts = opts || {};
    var cls = ['atk-btn', 'atk-btn--' + (opts.variant || 'primary')];
    if (opts.size === 'sm') cls.push('atk-btn--sm');
    return el('button', {
      className: cls.join(' '),
      type: opts.type || 'button',
      disabled: opts.disabled || null,
      onclick: opts.onClick
    }, opts.children);
  }

  function Input(opts) {
    opts = opts || {};
    var node = el('input', {
      className: 'atk-input',
      type: opts.type || 'text',
      placeholder: opts.placeholder || null,
      name: opts.name || null,
      disabled: opts.disabled || null,
      oninput: opts.onInput
    });
    if (opts.value != null) node.value = opts.value;
    return node;
  }

  function Link(opts) {
    opts = opts || {};
    var cls = ['atk-link'];
    if (opts.variant === 'muted') cls.push('atk-link--muted');
    return el('a', {
      className: cls.join(' '),
      href: opts.href || '#'
    }, opts.children);
  }

  function Card(opts) {
    opts = opts || {};
    var kids = [];
    if (opts.title) kids.push(el('div', { className: 'atk-card__title' }, opts.title));
    kids.push(el('div', { className: 'atk-card__body' }, opts.children));
    return el('div', { className: opts.variant === 'filled' ? 'atk-card atk-card--filled' : 'atk-card' }, kids);
  }

  function Badge(opts) {
    opts = opts || {};
    var cls = ['atk-badge'];
    if (opts.variant && opts.variant !== 'default') cls.push('atk-badge--' + opts.variant);
    return el('span', { className: cls.join(' ') }, opts.children);
  }

  function Block(opts) {
    opts = opts || {};
    var variant = opts.variant || 'text';
    var cls = ['atk-block', 'atk-block--' + variant];
    var kids = [];

    // Image (image / attachment variants)
    if (opts.src) {
      kids.push(el('img', { src: opts.src, alt: opts.alt || '' }));
    }

    // Text variant: content IS the block body — children or html, with inline markup allowed.
    // Channel variant: structured title / byline / meta, centred.
    if (variant === 'text') {
      var textWrap;
      if (opts.html != null) {
        textWrap = el('div', { className: 'atk-block__text-fade' });
        textWrap.innerHTML = opts.html;
      } else {
        textWrap = el('div', { className: 'atk-block__text-fade' }, opts.children);
      }
      kids.push(textWrap);
    } else if (variant === 'channel' || variant.indexOf('channel-') === 0) {
      var body = [];
      if (opts.title) body.push(el('div', { className: 'atk-block__title' }, opts.title));
      if (opts.byline) body.push(el('div', { className: 'atk-block__byline' }, opts.byline));
      if (opts.meta) body.push(el('div', { className: 'atk-block__meta' }, opts.meta));
      if (body.length) kids.push(el('div', { className: 'atk-block__content' }, body));
    }

    // Label (bottom-right chip, e.g. "PDF")
    if (opts.label) {
      kids.push(el('span', { className: 'atk-block__label' }, opts.label));
    }

    // Hover-revealed actions row
    if (opts.actions && opts.actions.length) {
      var actionNodes = opts.actions.map(function (a) {
        var tag = a.href ? 'a' : 'button';
        var attrs = {
          className: 'atk-block__action',
          href: a.disabled ? null : (a.href || null),
          type: a.href ? null : 'button',
          disabled: (!a.href && a.disabled) ? '' : null,
          'aria-disabled': a.disabled ? 'true' : null,
          onclick: a.disabled ? null : a.onClick
        };
        return el(tag, attrs, a.label);
      });
      kids.push(el('div', { className: 'atk-block__actions' }, actionNodes));
    }

    return el('div', { className: cls.join(' ') }, kids);
  }

  function KeyChip(opts) {
    opts = opts || {};
    return el('kbd', { className: 'atk-key' }, opts.children);
  }

  function Menu(opts) {
    opts = opts || {};
    var menu = el('div', { className: 'atk-menu', role: 'menu' });
    (opts.items || []).forEach(function (item) {
      if (item.separator) {
        menu.appendChild(el('div', { className: 'atk-menu__separator' }));
        return;
      }
      var tag = item.href ? 'a' : 'button';
      var kids = [];
      if (item.icon) kids.push(el('span', { className: 'atk-menu__icon' }, item.icon));
      kids.push(el('span', { className: 'atk-menu__label' }, item.label));
      if (item.shortcut) {
        kids.push(el('span', { className: 'atk-menu__shortcut' },
          KeyChip({ children: item.shortcut })));
      }
      menu.appendChild(el(tag, {
        className: 'atk-menu__item',
        href: item.href || null,
        type: item.href ? null : 'button',
        role: 'menuitem',
        onclick: item.onClick
      }, kids));
    });
    return menu;
  }

  function Modal(opts) {
    opts = opts || {};
    var backdrop = el('div', { className: 'atk-modal__backdrop', role: 'dialog', 'aria-modal': 'true' });
    var panel = el('div', { className: 'atk-modal' });

    function close(e) {
      if (opts.onClose) opts.onClose(e);
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }

    if (opts.title) {
      var closeBtn = el('button', {
        className: 'atk-modal__close',
        type: 'button',
        onclick: close,
        'aria-label': 'Close'
      }, '×');
      panel.appendChild(el('div', { className: 'atk-modal__header' }, [
        el('span', null, opts.title),
        closeBtn
      ]));
    }
    if (opts.children != null) {
      panel.appendChild(el('div', { className: 'atk-modal__body' }, opts.children));
    }
    if (opts.footer != null) {
      panel.appendChild(el('div', { className: 'atk-modal__footer' }, opts.footer));
    }

    backdrop.appendChild(panel);
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) close(e);
    });
    return backdrop;
  }

  function Select(opts) {
    opts = opts || {};
    var attrs = {
      className: 'atk-select',
      name: opts.name || null,
      disabled: opts.disabled || null,
      onchange: opts.onChange
    };
    var options = (opts.options || []).map(function (o) {
      if (typeof o === 'string') o = { value: o, label: o };
      var optAttrs = { value: o.value };
      if (o.value === opts.value) optAttrs.selected = '';
      return el('option', optAttrs, o.label);
    });
    return el('select', attrs, options);
  }

  function Textarea(opts) {
    opts = opts || {};
    var node = el('textarea', {
      className: 'atk-textarea',
      placeholder: opts.placeholder || null,
      name: opts.name || null,
      rows: opts.rows || null,
      disabled: opts.disabled || null,
      oninput: opts.onInput
    });
    if (opts.value != null) node.value = opts.value;
    return node;
  }

  function Tabs(opts) {
    opts = opts || {};
    var tabs = el('div', { className: 'atk-tabs', role: 'tablist' });
    var items = opts.items || [];
    items.forEach(function (t, idx) {
      var isActive = (opts.value != null)
        ? (t.value === opts.value)
        : (idx === 0);
      var kids = [t.label];
      if (t.count != null) {
        kids.push(el('span', { className: 'atk-tabs__count' }, String(t.count)));
      }
      tabs.appendChild(el('button', {
        className: 'atk-tabs__tab',
        type: 'button',
        role: 'tab',
        'aria-selected': isActive ? 'true' : 'false',
        onclick: function (e) {
          if (opts.onChange) opts.onChange(t.value, e);
        }
      }, kids));
    });
    return tabs;
  }

  function Stepper(opts) {
    opts = opts || {};
    var root = el('div', { className: 'atk-stepper' });
    (opts.items || []).forEach(function (step) {
      var state = step.state || 'upcoming';
      var item = el('div', { className: 'atk-stepper__item is-' + state });
      item.appendChild(el('div', { className: 'atk-stepper__track' },
        el('span', { className: 'atk-stepper__dot' })));
      var body = el('div', { className: 'atk-stepper__body' },
        el('div', { className: 'atk-stepper__label' }, step.label));
      if (step.description && state === 'current') {
        body.appendChild(el('div', { className: 'atk-stepper__description' }, step.description));
      }
      item.appendChild(body);
      root.appendChild(item);
    });
    return root;
  }

  /* ── ThemeChooser ──────────────────────────────────────────────
     Palette button + Menu of themes. Sets data-theme on <html> and
     remembers the choice in localStorage, shared by every tool on the
     same origin. Order of precedence: ?theme= (not saved) > saved > system. */

  var THEME_KEY = 'arena_toolkit_theme';
  var THEME_OPTIONS = [
    { id: 'light', label: 'Light' },
    { id: 'dusk', label: 'Dusk' },
    { id: 'dark', label: 'Dark' },
    { id: 'dawn', label: 'Dawn' }
  ];

  // Palette: the system's own Icons/Theme.svg (Phosphor), inlined so it takes the text colour.
  var PALETTE_SVG =
    '<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M200.77,53.89A103.27,103.27,0,0,0,128,24h-1.07A104,104,0,0,0,24,128c0,43,26.58,79.06,69.36,94.17A32,32,0,0,0,136,192a16,16,0,0,1,16-16h46.21a31.81,31.81,0,0,0,31.2-24.88,104.43,104.43,0,0,0,2.59-24A103.28,103.28,0,0,0,200.77,53.89Zm13,93.71A15.89,15.89,0,0,1,198.21,160H152a32,32,0,0,0-32,32,16,16,0,0,1-21.31,15.07C62.49,194.3,40,164,40,128a88,88,0,0,1,87.09-88h.9a88.35,88.35,0,0,1,88,87.25A88.86,88.86,0,0,1,213.81,147.6ZM140,76a12,12,0,1,1-12-12A12,12,0,0,1,140,76ZM96,100A12,12,0,1,1,84,88,12,12,0,0,1,96,100Zm0,56a12,12,0,1,1-12-12A12,12,0,0,1,96,156Zm88-56a12,12,0,1,1-12-12A12,12,0,0,1,184,100Z"/></svg>';
  var CHECK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function svgSpan(markup) {
    var span = el('span');
    span.innerHTML = markup; // static strings above, never user input
    return span;
  }

  var SYSTEM_OPTION = { id: 'system', label: 'System' };

  function themeIds(themes) {
    return (themes || THEME_OPTIONS).map(function (t) { return t.id || t; });
  }

  // Pure: which theme applies. asked = ?theme=, saved = localStorage value.
  // 'system' (or anything unknown) falls through to the system light/dark setting.
  function resolveTheme(opts) {
    opts = opts || {};
    var ids = themeIds(opts.themes);
    if (ids.indexOf(opts.asked) !== -1) return opts.asked;
    if (ids.indexOf(opts.saved) !== -1) return opts.saved;
    var wanted = opts.prefersDark ? 'dark' : 'light';
    return ids.indexOf(wanted) !== -1 ? wanted : ids[0];
  }

  // Pure: which menu entry is selected: ?theme=, else the saved theme, else 'system'.
  function themeChoice(opts) {
    opts = opts || {};
    var ids = themeIds(opts.themes);
    if (ids.indexOf(opts.asked) !== -1) return opts.asked;
    if (ids.indexOf(opts.saved) !== -1) return opts.saved;
    return 'system';
  }

  function ThemeChooser(opts) {
    opts = opts || {};
    var themes = opts.themes || THEME_OPTIONS;
    var entries = opts.system === false ? themes : themes.concat([SYSTEM_OPTION]);
    var key = opts.storageKey || THEME_KEY;
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    function read() { try { return localStorage.getItem(key); } catch (e) { return null; } }
    function write(value) { try { localStorage.setItem(key, value); } catch (e) { /* private mode */ } }

    var choice = themeChoice({
      themes: themes,
      asked: new URLSearchParams(location.search).get('theme'),
      saved: read()
    });
    function apply() {
      document.documentElement.setAttribute('data-theme', resolveTheme({
        themes: themes,
        asked: choice === 'system' ? null : choice,
        prefersDark: !!(mq && mq.matches)
      }));
    }
    apply();
    // While on System, follow the operating system as it changes.
    if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (choice === 'system') apply(); });

    var root = el('div', { className: 'atk-theme-chooser' });
    var button = el('button', {
      className: 'atk-theme-chooser__button',
      type: 'button',
      title: 'Theme',
      'aria-label': 'Choose theme',
      'aria-haspopup': 'menu',
      'aria-expanded': 'false'
    }, svgSpan(PALETTE_SVG));
    var popover = null;

    function close(returnFocus) {
      if (!popover) return;
      popover.remove();
      popover = null;
      button.setAttribute('aria-expanded', 'false');
      if (returnFocus) button.focus();
    }

    function choose(id) {
      choice = id;
      apply();
      write(id);
      close(true);
      if (typeof opts.onChange === 'function') opts.onChange(id);
    }

    function open() {
      var menuItems = [];
      entries.forEach(function (t) {
        // System sits apart from the named themes.
        if (t === SYSTEM_OPTION && themes.length) menuItems.push({ separator: true });
        menuItems.push({
          label: t.label,
          icon: t.id === choice ? svgSpan(CHECK_SVG) : el('span'),
          onClick: function () { choose(t.id); }
        });
      });
      var menu = Menu({ items: menuItems });
      var items = Array.prototype.slice.call(menu.querySelectorAll('.atk-menu__item'));
      items.forEach(function (item, i) {
        item.setAttribute('role', 'menuitemradio');
        item.setAttribute('aria-checked', String(entries[i].id === choice));
      });
      menu.addEventListener('keydown', function (e) {
        var i = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      });
      popover = el('div', { className: 'atk-theme-chooser__popover' }, menu);
      root.appendChild(popover);
      button.setAttribute('aria-expanded', 'true');
      var selected = items[entries.map(function (t) { return t.id; }).indexOf(choice)];
      (selected || items[0]).focus();
    }

    button.addEventListener('click', function () { if (popover) close(); else open(); });
    document.addEventListener('click', function (e) { if (popover && !root.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && popover) close(true); });

    root.appendChild(button);
    return root;
  }
  ThemeChooser.resolve = resolveTheme;
  ThemeChooser.choice = themeChoice;

  /* ── ChannelRow / ChannelList ──────────────────────────────────
     A channel as a coloured bar: badge, name, block count, metadata count,
     owner, caret. Opens (a <details>) to show whatever you pass as children.
     ChannelList stacks rows and adds an optional sort menu; sorting itself
     is yours: re-order with list.setRows(). */

  var CHEVRON_SVG =
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>';

  function ChannelRow(opts) {
    opts = opts || {};
    var visibility = opts.visibility || 'closed';
    var badgeVariant = { public: 'success', private: 'private' }[visibility] || 'default';
    var caret = svgSpan(CHEVRON_SVG);
    caret.className = 'atk-channel-row__caret';
    var summary = el('summary', null, [
      Badge({ variant: badgeVariant, children: visibility }),
      el('span', { className: 'atk-channel-row__title' }, opts.title),
      opts.count != null
        ? el('span', { className: 'atk-channel-row__count', title: 'Blocks in this channel' }, String(opts.count))
        : null,
      opts.metadataCount != null
        ? el('span', { title: 'Metadata entries' }, Badge({ children: String(opts.metadataCount) }))
        : null,
      opts.owner ? el('span', { className: 'atk-channel-row__owner' }, opts.owner) : null,
      caret
    ]);
    return el('details', {
      className: 'atk-channel-row',
      'data-visibility': visibility,
      open: opts.open ? true : null
    }, [summary, el('div', { className: 'atk-channel-row__body' }, opts.children)]);
  }

  var channelListCount = 0;

  function ChannelList(opts) {
    opts = opts || {};
    var root = el('div', { className: 'atk-channel-list' });
    var rowsEl = el('div', { className: 'atk-channel-list__rows' });
    var toolbar = null;
    if (opts.sorts && opts.sorts.length) {
      var select = Select({
        options: opts.sorts,
        value: opts.sortValue || opts.sorts[0].value,
        onChange: function (e) { if (opts.onSort) opts.onSort(e.target.value); }
      });
      select.id = 'atk-channel-sort-' + (++channelListCount);
      toolbar = el('div', { className: 'atk-channel-list__toolbar', hidden: true }, [
        el('label', { for: select.id }, opts.sortLabel || 'Sort'),
        select
      ]);
      root.appendChild(toolbar);
    }
    root.appendChild(rowsEl);

    // Replace the list's contents. Rows you pass again are moved, not rebuilt, so open rows stay open.
    // The sort menu shows once there are two or more. A single node (a message) works too.
    root.setRows = function (nodes) {
      rowsEl.replaceChildren.apply(rowsEl, nodes);
      if (toolbar) toolbar.hidden = nodes.length < 2;
    };
    root.setRows(opts.rows || []);
    return root;
  }

  /* ── StatusMessage: one inline line for progress, success and errors ── */
  function StatusMessage(opts) {
    opts = opts || {};
    var tone = opts.tone || 'info';
    var kids = [];
    if (tone === 'error' || tone === 'success') {
      kids.push(el('span', { className: 'atk-status__icon', 'aria-hidden': 'true' }, tone === 'error' ? '\u26A0' : '\u2713'));
    }
    if (opts.label) kids.push(el('strong', null, opts.label + '.'));
    kids = kids.concat(opts.children == null ? [] : opts.children);
    return el('p', {
      className: 'atk-status atk-status--' + tone,
      role: tone === 'error' ? 'alert' : 'status'
    }, kids);
  }

  /* ── Accounts: names and initials come from are.na's user object ── */
  function accountName(user) {
    return (user && (user.name || user.full_name || user.slug)) || '';
  }

  // The API's own `initials` when present, else the first letters of the name ("Kim Plowright" -> "KP").
  function accountInitials(user) {
    if (user && user.initials) return String(user.initials).slice(0, 2).toUpperCase();
    var name = (accountName(user) || '?').trim();
    return name.split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase() || '?';
  }

  function Avatar(user) {
    return el('span', { className: 'atk-avatar', 'aria-hidden': 'true' }, accountInitials(user));
  }

  /* ── AccountMenu: the header block. [Connect →] or [avatar] name [Disconnect] ── */
  function AccountMenu(opts) {
    opts = opts || {};
    var root = el('div', { className: 'atk-account' });
    root.setUser = function (user) {
      if (!user) {
        root.replaceChildren(Button({
          variant: 'ghost', size: 'sm',
          children: opts.connectLabel || 'Connect \u2192',
          onClick: opts.onConnect
        }));
        return;
      }
      root.replaceChildren(
        Avatar(user),
        el('span', { className: 'atk-account__name' }, accountName(user)),
        Button({ variant: 'ghost', size: 'sm', children: opts.disconnectLabel || 'Disconnect', onClick: opts.onDisconnect })
      );
    };
    root.setUser(opts.user || null);
    return root;
  }
  AccountMenu.displayName = accountName;
  AccountMenu.initials = accountInitials;

  /* ── AuthPanel: the token form and the signed-in chip. No requests, no storage:
        the caller (shared/widgets/auth-step.js) owns those and calls update(). ── */
  function AuthPanel(opts) {
    opts = opts || {};
    var state = {
      user: null, detail: null, status: null,
      requireWrite: !!opts.requireWrite, writeMessage: opts.writeMessage || null,
      remember: opts.remember !== false
    };
    var panel = !!opts.panel;
    var root = el('div', { className: 'atk-auth' });

    function status(s) {
      return s ? StatusMessage({ tone: s.tone, label: s.label, children: s.message }) : null;
    }

    function rememberCheck() {
      var box = el('input', { type: 'checkbox' });
      box.checked = state.remember;
      box.addEventListener('change', function () {
        state.remember = box.checked;
        if (opts.onRememberChange) opts.onRememberChange(box.checked);
      });
      return el('label', { className: 'atk-auth__remember' }, [
        box,
        el('span', null, [
          'Remember on this computer',
          el('br'),
          el('span', { className: 'atk-auth__hint' }, 'Unticked, it is forgotten when you close the tab.')
        ])
      ]);
    }

    function chip() {
      var u = state.user;
      var who = el('div', { className: 'atk-auth__who' }, ['Signed in as ', el('strong', null, accountName(u))]);
      if (state.detail) {
        who.appendChild(el('br'));
        who.appendChild(el('span', { className: 'atk-auth__hint' }, state.detail));
      }
      return el('div', { className: 'atk-auth__chip' }, [
        Avatar(u), who,
        Button({ variant: 'ghost', size: 'sm', children: 'Disconnect', onClick: opts.onDisconnect })
      ]);
    }

    function form() {
      var link = Link({ href: opts.tokenUrl, children: 'personal access token' });
      link.target = '_blank';
      link.rel = 'noopener';
      var intro = el('p', { className: 'atk-auth__intro' }, [panel ? 'Create a ' : 'Paste a ', link]);
      if (state.requireWrite) {
        intro.appendChild(document.createTextNode(panel
          ? ' with read and write ticked, then paste it below. The token stays in your browser only.'
          : ' with the write scope ticked. This tool changes your account: it adds and removes connections and edits blocks, so a read-only token will not work.'));
      } else {
        intro.appendChild(document.createTextNode(' with read access. That is all this tool needs. Some content, including private channels, only shows up once you are connected.'));
      }

      var input = Input({ type: 'password', placeholder: panel ? 'paste it here' : 'Paste your token here' });
      input.id = 'arena-token';
      input.autocomplete = 'off';
      input.spellcheck = false;
      var submit = function () { if (opts.onConnect) opts.onConnect(input.value); };
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
      var row = el('div', { className: 'atk-auth__row' }, [
        input,
        Button({ variant: panel ? 'secondary' : 'primary', children: 'Connect', onClick: submit })
      ]);

      var kids = [];
      if (state.writeMessage) kids.push(Notice({ variant: 'warning', children: state.writeMessage }));
      kids.push(intro);
      if (panel) {
        var label = el('label', { className: 'atk-auth__label', 'for': 'arena-token' }, 'Personal access token');
        kids.push(label, row, rememberCheck());
      } else {
        kids.push(row, el('p', { className: 'atk-auth__note' }, 'Your token stays in this browser and is only ever sent to are.na.'));
      }
      kids.push(status(state.status));
      return kids;
    }

    function render() {
      var kids;
      if (state.user && panel) {
        kids = [status(state.status), chip()];
      } else if (state.user) {
        kids = [el('div', { className: 'atk-auth__row atk-auth__row--center' }, [
          Badge({ variant: 'success', children: 'Connected as @' + state.user.slug }),
          Button({ variant: 'ghost', size: 'sm', children: 'Disconnect', onClick: opts.onDisconnect })
        ])];
      } else {
        kids = form();
      }
      root.replaceChildren.apply(root, kids.filter(Boolean));
    }

    // Merges these keys into the state and redraws: user, detail, status {tone,label,message}, requireWrite, writeMessage, remember.
    root.update = function (next) {
      for (var k in next) { if (Object.prototype.hasOwnProperty.call(next, k)) state[k] = next[k]; }
      render();
    };
    render();
    return root;
  }

  /* ── Checkbox, Radio, Progress, StatGrid, StatusLog, Footer ── */

  // (which means publishing it to the design-system artifact, so it needs Kim's go-ahead).
  // A native input sits inside the label, so keyboard, focus and screen readers behave as usual.
  function Checkbox({ label, description, checked = false, disabled = false, indeterminate = false, name, id, onChange } = {}) {
    const h = el;
    const input = h('input', { type: 'checkbox', className: 'atk-checkbox-input', checked, disabled });
    if (name) input.name = name;
    if (id) input.id = id;
    input.indeterminate = indeterminate;
    if (onChange) input.addEventListener('change', () => onChange(input.checked));

    const box = h('span', { className: 'atk-checkbox-box', 'aria-hidden': 'true' });
    box.innerHTML = '<svg class="atk-checkbox-tick" viewBox="0 0 12 12" width="12" height="12"><path d="M2.5 6.5l2.5 2.5 4.5-5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="atk-checkbox-bar"></span>';

    const text = h('span', { className: 'atk-checkbox-text' }, [
      h('span', { className: 'atk-checkbox-label' }, label),
      description ? h('span', { className: 'atk-checkbox-desc' }, description) : null,
    ].filter(Boolean));

    return h('label', { className: 'atk-checkbox' }, [input, box, text]);
  }

  // A native radio input sits inside the label, so arrow keys, focus and screen readers behave as usual.
  function Radio({ label, description, value, name, checked = false, disabled = false, onChange } = {}) {
    const h = el;
    const input = h('input', { type: 'radio', className: 'atk-radio-input', checked, disabled, name, value });
    if (onChange) input.addEventListener('change', () => { if (input.checked) onChange(value); });

    const ring = h('span', { className: 'atk-radio-ring', 'aria-hidden': 'true' }, h('span', { className: 'atk-radio-dot' }));
    const text = h('span', { className: 'atk-radio-text' }, [
      h('span', { className: 'atk-radio-label' }, label),
      description ? h('span', { className: 'atk-radio-desc' }, description) : null,
    ].filter(Boolean));
    return h('label', { className: 'atk-radio' }, [input, ring, text]);
  }

  //   StatGrid({ items: [{ key, label, value = 0 }] })
  //   grid.update({ added: 3, failed: 0 })   changes the named counts in place
  function StatGrid({ items = [] } = {}) {
    const h = el;
    const values = {};
    const root = h('div', { className: 'atk-stats' });
    items.forEach(({ key, label, value = 0 }) => {
      values[key] = h('span', { className: 'atk-stat__value' }, String(value));
      root.appendChild(h('div', { className: 'atk-stat' }, [values[key], h('span', { className: 'atk-stat__label' }, label)]));
    });
    root.update = (next = {}) => {
      Object.keys(next).forEach(k => { if (values[k]) values[k].textContent = String(next[k]); });
    };
    return root;
  }

  //   StatusLog({ label = 'Details', open = false })
  //   log.add('success' | 'message' | 'warning' | 'error', text)     log.clear()
  // Colour is never the only signal: success, warning and error lines carry a spoken prefix for screen readers.
  function StatusLog({ label = 'Details', open = false } = {}) {
    const h = el;
    const SPOKEN = { success: 'Success: ', warning: 'Warning: ', error: 'Error: ' };   // 'message' has none
    const body = h('div', { className: 'atk-log__body', role: 'log' });
    const root = h('details', { className: 'atk-log', open }, [h('summary', { className: 'atk-log__summary' }, label), body]);
    root.add = (tone, text) => {
      const line = h('div', { className: 'atk-log__line is-' + tone });
      if (SPOKEN[tone]) line.appendChild(h('span', { className: 'atk-sr' }, SPOKEN[tone]));
      line.appendChild(document.createTextNode(text));
      body.appendChild(line);
      body.scrollTop = body.scrollHeight;
    };
    root.clear = () => body.replaceChildren();
    return root;
  }

  //   Footer({ toolNote, homeHref })   toolNote: optional string or node, shown first under the heading. homeHref: the collection's index page.
  // Put <footer id="footer"></footer> in the page and call document.getElementById('footer').replaceWith(ArenaToolkit.Footer({...})).
  function Footer({ toolNote = null, homeHref = '../index.html' } = {}) {
    const h = el;
    const a = (href, text) => h('a', { href, target: '_blank', rel: 'noopener' }, text);
    const REPO = 'https://github.com/mildlydiverting/are.na-toolkit';
    return h('footer', { className: 'atk-footer' }, [
      h('h2', { className: 'atk-footer__title' }, 'About'),
      toolNote ? h('p', null, toolNote) : null,
      h('p', null, ['Runs locally in your browser. Your data is only sent to ', a('https://www.are.na/developers', h('code', null, 'api.are.na')), '.']),
      h('p', null, [
        'Part of a collection of ', h('a', { href: homeHref }, 'Are.na Tools and Toys'),
        ' built on the ', a('https://www.are.na/developers', 'are.na API'), ' by ', a('https://www.mildlydiverting.com', 'Kim Plowright'),
        '. Not affiliated with or endorsed by ', a('https://www.are.na', 'are.na'), '.',
      ]),
      h('p', null, [
        h('em', null, 'Vibe-coded.'),
        " This tool was built with an AI assistant (and a slight sheepish sense of guilt). It works for me and is tested, but no guarantees the robot and I haven't fucked it up somehow: try it on something unimportant first, and use the dry run options to check it does what you expect. Source on ",
        a(REPO, 'GitHub'), ' under the ', a(`${REPO}/blob/main/LICENSE`, 'MIT license'), '. Found a bug? Let me know in ',
        a(`${REPO}/issues`, 'GitHub issues'), '. Be kind, I am a gentle soul.',
      ]),
      h('p', null, [
        'Want to know more? Find me on ', a('https://www.are.na/kim-plowright', 'Are.na'), ', ',
        a('https://www.instagram.com/mildlydiverting/', 'Instagram'), ', ',
        a('https://bsky.app/profile/mildlydiverting.bsky.social', 'Bluesky'), ', get my ',
        a('https://www.mildlydiverting.com/newsletter', 'newsletter'), ' or ',
        a('https://www.mildlydiverting.com/classes-workshops-teaching', 'come to my drawing classes in Canterbury or Ramsgate, UK'), '.',
      ]),
    ].filter(Boolean));
  }

  // Progress: a thin bar with a label row.
  // Finite (value and max > 0) or indeterminate (no value, or no usable max): update() can switch between them at any time.
  //   Progress({ value, max, label, detail, variant })   variant: 'default' | 'success' | 'alert'
  //   bar.update({ value, max, label, detail, variant })  changes only the keys you pass
  // detail is text or a node. aria-valuetext is built from label + detail, so a screen reader says
  // "Dry run: merging, 16 of 20" rather than just "80%".

  // Pure: what the bar should show for a value and a max.
  function progressModel({ value = null, max = 100 } = {}) {
    const finite = value != null && Number.isFinite(value) && Number.isFinite(max) && max > 0;
    if (!finite) return { indeterminate: true, pct: null, now: null, max: null };
    const now = Math.min(max, Math.max(0, value));
    return { indeterminate: false, pct: (now / max) * 100, now, max };
  }

  // Pure: the text a node or string contributes to a spoken description.
  function plainText(x) {
    if (x == null) return '';
    return typeof x === 'string' ? x : String(x.textContent ?? '');
  }

  // Pure: "label, detail" for aria-valuetext.
  function spokenProgress({ label = '', detail = '' } = {}) {
    return [plainText(label), plainText(detail)].filter(Boolean).join(', ');
  }

  function Progress(initial = {}) {
    const h = el;
    const state = { value: null, max: 100, label: '', detail: '', variant: 'default', ...initial };
    const labelEl = h('span', { className: 'atk-progress-label' });
    const detailEl = h('span', { className: 'atk-progress-detail' });
    const fill = h('div', { className: 'atk-progress-fill' });
    const track = h('div', { className: 'atk-progress-track', role: 'progressbar', 'aria-valuemin': '0' }, fill);
    const root = h('div', { className: 'atk-progress' }, [
      h('div', { className: 'atk-progress-row' }, [labelEl, detailEl]),
      track,
    ]);

    function render() {
      const m = progressModel(state);
      root.className = `atk-progress atk-progress--${state.variant}${m.indeterminate ? ' is-indeterminate' : ''}`;
      labelEl.textContent = state.label;
      if (typeof state.detail === 'string' || state.detail == null) detailEl.textContent = state.detail ?? '';
      else detailEl.replaceChildren(state.detail);
      if (m.indeterminate) {
        track.removeAttribute('aria-valuenow');
        track.removeAttribute('aria-valuemax');
        fill.style.width = '';
      } else {
        track.setAttribute('aria-valuemax', String(m.max));
        track.setAttribute('aria-valuenow', String(m.now));
        fill.style.width = `${m.pct}%`;
      }
      track.setAttribute('aria-label', plainText(state.label) || 'Progress');
      const spoken = spokenProgress(state);
      if (spoken) track.setAttribute('aria-valuetext', spoken); else track.removeAttribute('aria-valuetext');
    }

    root.update = function update(next = {}) {
      for (const k of ['value', 'max', 'label', 'detail', 'variant']) if (k in next) state[k] = next[k];
      render();
    };
    render();
    return root;
  }
  Progress.model = progressModel;
  Progress.spoken = spokenProgress;

  /* ── Notice (in the flow) and Toast (in the corner): the same navy box as are.na's own message ── */
  var NOTICE_VARIANTS = { info: 'info', success: 'success', warning: 'warning', error: 'error',
                          'default': 'info', notification: 'info', alert: 'error' };
  var NOTICE_ICONS = { success: '✓', warning: '⚠', error: '⚠' };

  function Notice(opts) {
    opts = opts || {};
    var variant = NOTICE_VARIANTS[opts.variant] || 'info';
    var kids = [];
    if (NOTICE_ICONS[variant]) kids.push(el('span', { className: 'atk-notice__icon', 'aria-hidden': 'true' }, NOTICE_ICONS[variant]));
    var body = [];
    if (opts.title) body.push(el('strong', null, opts.title + '.'), ' ');
    body = body.concat(opts.children == null ? [] : opts.children);
    kids.push(el('div', { className: 'atk-notice__body' }, body));
    if (opts.onDismiss) {
      kids.push(el('button', { type: 'button', className: 'atk-notice__close', 'aria-label': 'Dismiss', onClick: opts.onDismiss }, '×'));
    }
    return el('div', {
      className: 'atk-notice atk-notice--' + variant,
      role: variant === 'error' ? 'alert' : 'status'
    }, kids);
  }

  var toastStack = null;
  var toastSide = 'left';
  function toastParent() {
    if (!toastStack || !toastStack.isConnected) {
      toastStack = el('div', { className: 'atk-toast-stack' });
      document.body.appendChild(toastStack);
    }
    toastStack.setAttribute('data-side', toastSide);
    return toastStack;
  }

  var Toast = {
    // Toast.show({ message, title?, variant: 'info'|'success'|'warning'|'error', duration: 4000 (0 = stay) })
    show: function (o) {
      o = o || {};
      var duration = o.duration == null ? 4000 : o.duration;
      var timer = null;
      var node = null;
      function dismiss() {
        clearTimeout(timer);
        if (!node.isConnected) return;
        node.classList.add('is-leaving');
        setTimeout(function () { node.remove(); }, 150);
      }
      function arm() { clearTimeout(timer); if (duration > 0) timer = setTimeout(dismiss, duration); }
      node = Notice({ variant: o.variant, title: o.title, children: o.message, onDismiss: dismiss });
      node.classList.add('atk-toast');
      node.addEventListener('keydown', function (e) { if (e.key === 'Escape') dismiss(); });
      node.addEventListener('mouseenter', function () { clearTimeout(timer); });
      node.addEventListener('mouseleave', arm);
      node.addEventListener('focusin', function () { clearTimeout(timer); });
      node.addEventListener('focusout', arm);
      toastParent().appendChild(node);
      arm();
      return { dismiss: dismiss };
    },
    dismissAll: function () { if (toastStack) toastStack.replaceChildren(); },
    setPosition: function (side) {
      toastSide = side === 'right' ? 'right' : 'left';
      if (toastStack) toastStack.setAttribute('data-side', toastSide);
    }
  };

  window.ArenaToolkit = {
    Checkbox: Checkbox,
    Radio: Radio,
    Progress: Progress,
    StatGrid: StatGrid,
    StatusLog: StatusLog,
    Footer: Footer,
    ChannelRow: ChannelRow,
    ChannelList: ChannelList,
    ThemeChooser: ThemeChooser,
    StatusMessage: StatusMessage,
    Notice: Notice,
    Toast: Toast,
    AccountMenu: AccountMenu,
    AuthPanel: AuthPanel,
    Button: Button,
    Input: Input,
    Link: Link,
    Card: Card,
    Badge: Badge,
    Block: Block,
    Modal: Modal,
    Menu: Menu,
    KeyChip: KeyChip,
    Select: Select,
    Textarea: Textarea,
    Tabs: Tabs,
    Stepper: Stepper,
    _el: el
  };
}());
