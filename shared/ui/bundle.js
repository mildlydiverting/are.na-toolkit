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
          href: a.href || null,
          type: a.href ? null : 'button',
          onclick: a.onClick
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

  // Pure: which theme applies. asked = ?theme=, saved = localStorage value.
  function resolveTheme(opts) {
    opts = opts || {};
    var ids = (opts.themes || THEME_OPTIONS).map(function (t) { return t.id || t; });
    if (ids.indexOf(opts.asked) !== -1) return opts.asked;
    if (ids.indexOf(opts.saved) !== -1) return opts.saved;
    var wanted = opts.prefersDark ? 'dark' : 'light';
    return ids.indexOf(wanted) !== -1 ? wanted : ids[0];
  }

  function ThemeChooser(opts) {
    opts = opts || {};
    var themes = opts.themes || THEME_OPTIONS;
    var key = opts.storageKey || THEME_KEY;

    function read() { try { return localStorage.getItem(key); } catch (e) { return null; } }
    function write(value) { try { localStorage.setItem(key, value); } catch (e) { /* private mode */ } }
    function apply(id) { document.documentElement.setAttribute('data-theme', id); }

    var current = resolveTheme({
      themes: themes,
      asked: new URLSearchParams(location.search).get('theme'),
      saved: read(),
      prefersDark: !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
    });
    apply(current);

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
      current = id;
      apply(id);
      write(id);
      close(true);
      if (typeof opts.onChange === 'function') opts.onChange(id);
    }

    function open() {
      var menu = Menu({
        items: themes.map(function (t) {
          return {
            label: t.label,
            icon: t.id === current ? svgSpan(CHECK_SVG) : el('span'),
            onClick: function () { choose(t.id); }
          };
        })
      });
      var items = Array.prototype.slice.call(menu.querySelectorAll('.atk-menu__item'));
      items.forEach(function (item, i) {
        item.setAttribute('role', 'menuitemradio');
        item.setAttribute('aria-checked', String(themes[i].id === current));
      });
      menu.addEventListener('keydown', function (e) {
        var i = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      });
      popover = el('div', { className: 'atk-theme-chooser__popover' }, menu);
      root.appendChild(popover);
      button.setAttribute('aria-expanded', 'true');
      var selected = items[themes.map(function (t) { return t.id; }).indexOf(current)];
      (selected || items[0]).focus();
    }

    button.addEventListener('click', function () { if (popover) close(); else open(); });
    document.addEventListener('click', function (e) { if (popover && !root.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && popover) close(true); });

    root.appendChild(button);
    return root;
  }
  ThemeChooser.resolve = resolveTheme;

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

  window.ArenaToolkit = {
    ChannelRow: ChannelRow,
    ChannelList: ChannelList,
    ThemeChooser: ThemeChooser,
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
