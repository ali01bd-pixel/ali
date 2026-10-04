(() => {
  const send = () => {
    const height = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0, document.documentElement.offsetHeight);
    window.parent?.postMessage({ type: 'ali-hub-resize', height }, '*');
  };
  window.addEventListener('load', send);
  window.addEventListener('resize', send);
  if ('ResizeObserver' in window) new ResizeObserver(send).observe(document.documentElement);
  setTimeout(send, 100);
  setTimeout(send, 700);
  setTimeout(send, 1800);
})();
