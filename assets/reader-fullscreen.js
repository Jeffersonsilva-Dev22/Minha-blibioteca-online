export function bindReaderFullscreen(dialog) {
  const button = dialog.querySelector('#reader-fullscreen');
  const message = dialog.querySelector('#reader-fullscreen-status');
  let pending = false;

  function update() {
    const expanded = document.fullscreenElement === dialog || dialog.classList.contains('reader-expanded');
    button.textContent = expanded ? 'Sair da tela cheia' : 'Tela cheia';
    button.setAttribute('aria-pressed', String(expanded));
  }

  async function exit() {
    dialog.classList.remove('reader-expanded');
    if (document.fullscreenElement === dialog) await document.exitFullscreen();
    update();
  }

  button.addEventListener('click', async () => {
    if (pending) return;
    pending = true;
    button.disabled = true;
    message.textContent = '';
    try {
      if (document.fullscreenElement === dialog || dialog.classList.contains('reader-expanded')) {
        await exit();
      } else if (document.fullscreenEnabled && dialog.requestFullscreen) {
        try {
          await dialog.requestFullscreen();
        } catch {
          if (dialog.open) {
            dialog.classList.add('reader-expanded');
            message.textContent = 'Leitor ampliado para ocupar a janela.';
          }
        }
      } else {
        dialog.classList.add('reader-expanded');
        message.textContent = 'Leitor ampliado para ocupar a janela.';
      }
    } catch {
      message.textContent = 'Não foi possível alterar a tela cheia. Use Esc para sair.';
    } finally {
      pending = false;
      button.disabled = false;
      update();
    }
  });

  document.addEventListener('fullscreenchange', update);
  dialog.addEventListener('cancel', event => {
    if (document.fullscreenElement === dialog || dialog.classList.contains('reader-expanded')) {
      event.preventDefault();
      void exit().catch(() => {});
    }
  });
  dialog.addEventListener('close', () => {
    message.textContent = '';
    void exit().catch(() => {});
  });
  update();
}
