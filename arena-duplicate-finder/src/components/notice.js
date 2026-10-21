// Notice: a short message in a stack at the bottom left. Tool-local until promoted into shared/ui.
//   Notice.show({ message, variant: 'default' | 'success' | 'alert' | 'notification', duration: 4000 (0 = stay), action: { label, onClick } })
//   Notice.dismissAll()
(function () {
  const h = window.ArenaToolkit._el;
  let stack = null;

  function getStack() {
    if (!stack || !stack.isConnected) {
      stack = h('div', { className: 'atk-notice-stack' });
      document.body.append(stack);
    }
    return stack;
  }

  function show({ message, variant = 'default', duration = 4000, action = null } = {}) {
    const alert = variant === 'alert';
    const notice = h('div', { className: `atk-notice atk-notice--${variant}`, role: alert ? 'alert' : 'status' });
    let timer = null;
    const dismiss = () => {
      clearTimeout(timer);
      if (!notice.isConnected) return;
      notice.classList.add('is-leaving');
      setTimeout(() => notice.remove(), 150);
    };
    notice.append(h('span', { className: 'atk-notice-message' }, message));
    if (action) {
      notice.append(window.ArenaToolkit.Button({ variant: 'ghost', size: 'sm', children: action.label, onClick: () => { action.onClick(); dismiss(); } }));
    }
    notice.append(h('button', { type: 'button', className: 'atk-notice-close', 'aria-label': 'Dismiss', onclick: dismiss }, '×'));
    notice.addEventListener('keydown', (e) => { if (e.key === 'Escape') dismiss(); });
    getStack().append(notice);
    if (duration > 0) timer = setTimeout(dismiss, duration);
    return { dismiss };
  }

  function dismissAll() {
    if (stack) stack.replaceChildren();
  }

  window.ArenaToolkit.Notice = { show, dismissAll };
})();
