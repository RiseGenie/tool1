const captureFullBtn = document.getElementById('capture-full');
const captureVisibleBtn = document.getElementById('capture-visible');
const hint = document.getElementById('hint');

async function runCapture(type, button) {
  captureFullBtn.disabled = true;
  captureVisibleBtn.disabled = true;
  hint.textContent = 'Capturing…';
  hint.classList.remove('error');

  try {
    const response = await chrome.runtime.sendMessage({ type });
    if (response?.error) {
      hint.textContent = response.error;
    } else {
      // The result opens in a new tab; the popup can close on its own.
      window.close();
    }
  } catch (err) {
    hint.textContent = 'Could not start the capture on this page.';
  } finally {
    captureFullBtn.disabled = false;
    captureVisibleBtn.disabled = false;
  }
}

captureFullBtn.addEventListener('click', () => runCapture('capture-full-page', captureFullBtn));
captureVisibleBtn.addEventListener('click', () => runCapture('capture-visible', captureVisibleBtn));

(async function init() {
  const commands = await chrome.commands.getAll();
  const shortcut = commands.find((c) => c.name === 'capture-full-page')?.shortcut;
  if (shortcut) document.getElementById('shortcut').textContent = shortcut;
})();
