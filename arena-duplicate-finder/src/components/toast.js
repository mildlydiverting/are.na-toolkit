// Toast: a short message in a stack at the bottom right. Tool-local until promoted into shared/ui.
//   Toast.show({ message, variant: 'default' | 'success' | 'alert' | 'notification', duration: 4000 (0 = stay), action: { label, onClick } })
//   Toast.dismissAll()
(function () {
  const h = window.ArenaToolkit._el;
  let stack = null;

  function getStack() {
    if (!stack || !stack.isConnected) {
      stack = h('div', { className: 'atk-toast-stack' });
      document.body.append(stack);
    }
    return stack;
  }

  function show({ message, variant = 'default', duration = 4000, action = null } = {}) {
    const alert = variant === 'alert';
    const toast = h('div', { className: `atk-toast atk-toast--${variant}`, role: alert ? 'alert' : 'status' });
    let timer = null;
    const dismiss = () => {
      clearTimeout(timer);
      if (!toast.isConnected) return;
      toast.classList.add('is-leaving');
      setTimeout(() => toast.remove(), 150);
    };
    toast.append(h('span', { className: 'atk-toast-message' }, message));
    if (action) {
      toast.append(window.ArenaToolkit.Button({ variant: 'ghost', size: 'sm', children: action.label, onClick: () => { action.onClick(); dismiss(); } }));
    }
    toast.append(h('button', { type: 'button', className: 'atk-toast-close', 'aria-label': 'Dismiss', onclick: dismiss }, '×'));
    toast.addEventListener('keydown', (e) => { if (e.key === 'Escape') dismiss(); });
    getStack().append(toast);
    if (duration > 0) timer = setTimeout(dismiss, duration);
    return { dismiss };
  }

  function dismissAll() {
    if (stack) stack.replaceChildren();
  }

  window.ArenaToolkit.Toast = { show, dismissAll };
})();
