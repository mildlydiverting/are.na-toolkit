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
    return el('div', { className: 'atk-card' }, kids);
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

  window.ArenaToolkit = {
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
