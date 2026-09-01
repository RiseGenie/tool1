(function () {
  const processed = new WeakSet();
  let scanTimer = null;

  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scanForCommentBoxes();
    }, 300);
  }

  function isCommentEditor(el) {
    // Exclude the top-of-feed "start a post" composer, which reuses the same
    // rich-text editor component as comment boxes.
    if (el.closest('[class*="share-box" i], [class*="share-creation" i], [class*="post-creation" i]')) return false;
    if (el.closest('[class*="comment" i]')) return true;
    const label = (el.getAttribute('aria-label') || el.getAttribute('aria-placeholder') || '').toLowerCase();
    return label.includes('comment');
  }

  function scanForCommentBoxes() {
    const editors = document.querySelectorAll('div[contenteditable="true"][role="textbox"]');
    for (const editor of editors) {
      if (processed.has(editor)) continue;
      if (!isCommentEditor(editor)) continue;
      processed.add(editor);
      injectToolbar(editor);
    }
  }

  function isVisible(el) {
    if (!(el instanceof Element)) return true;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function extractPostText(container, excludeRoot) {
    const skipTags = new Set(['SCRIPT', 'STYLE', 'BUTTON', 'SVG', 'NOSCRIPT']);
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent || skipTags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        // Exclude the comment box / comments thread itself (existing comments,
        // our own toolbar, "add a comment" placeholder chrome, etc).
        if (excludeRoot && excludeRoot.contains(parent)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('[class*="comment" i]')) return NodeFilter.FILTER_REJECT;
        if (!isVisible(parent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const parts = [];
    let total = 0;
    let node;
    while ((node = walker.nextNode()) && total < 3000) {
      const t = node.nodeValue.trim();
      parts.push(t);
      total += t.length;
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 3000);
  }

  // Finds the best post container for `editor` and returns its extracted
  // text. Comment editors live inside the comments thread's own subtree
  // (which can carry its own data-urn for the comment/reply itself), so we
  // can't just take the nearest ancestor matching a "looks like a post"
  // selector — that often matches a nested comment wrapper instead of the
  // actual post. Instead: first climb out of anything "comment"-classed
  // entirely, then walk upward scoring each ancestor by how much real
  // (non-comment, visible) text it yields, and keep the best one.
  function extractPostContext(editor) {
    let commentRoot = editor.closest('[class*="comment" i]') || editor.parentElement;
    while (commentRoot?.parentElement?.closest('[class*="comment" i]')) {
      commentRoot = commentRoot.parentElement.closest('[class*="comment" i]');
    }

    let node = commentRoot?.parentElement || editor.parentElement;
    let best = { container: node, text: '' };

    for (let i = 0; i < 15 && node && node !== document.body; i++) {
      const text = extractPostText(node, commentRoot);
      // Prefer the shallowest container once text stops growing meaningfully
      // (climbing further usually just adds unrelated feed/sidebar chrome).
      if (text.length > best.text.length && text.length < 8000) {
        best = { container: node, text };
      } else if (text.length > 0 && best.text.length > 200) {
        break;
      }
      node = node.parentElement;
    }

    return { container: best.container, postText: best.text };
  }

  function extractAuthorName(container) {
    const links = container.querySelectorAll('a[href*="/in/"]');
    for (const link of links) {
      if (link.closest('[class*="comment" i]')) continue;
      const text = (link.textContent || '').trim();
      if (text) return text.split('\n')[0].trim();
    }
    return '';
  }

  function insertTextIntoEditor(editor, text) {
    editor.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);
    const inserted = document.execCommand('insertText', false, text);
    if (!inserted) {
      editor.textContent = text;
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }
  }

  function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  async function injectToolbar(editor) {
    const { lastTone = 'supportive', lastCustom = '' } = await chrome.storage.local.get(['lastTone', 'lastCustom']);

    const bar = el('div', 'ccp-toolbar');

    const select = el('select', 'ccp-select');
    for (const tone of CCP_TONES) {
      const opt = document.createElement('option');
      opt.value = tone.id;
      opt.textContent = tone.label;
      select.appendChild(opt);
    }
    select.value = lastTone;

    const customInput = el('input', 'ccp-custom');
    customInput.type = 'text';
    customInput.placeholder = 'Describe the tone…';
    customInput.value = lastCustom;
    customInput.hidden = select.value !== 'custom';

    const button = el('button', 'ccp-button');
    button.type = 'button';
    button.textContent = '✨ Draft comment';

    const status = el('span', 'ccp-status');

    select.addEventListener('change', () => {
      customInput.hidden = select.value !== 'custom';
      chrome.storage.local.set({ lastTone: select.value });
    });
    customInput.addEventListener('change', () => {
      chrome.storage.local.set({ lastCustom: customInput.value });
    });

    button.addEventListener('click', async () => {
      button.disabled = true;
      status.textContent = 'Reading post…';
      status.className = 'ccp-status';

      const { container, postText } = extractPostContext(editor);
      const authorName = extractAuthorName(container);

      if (!postText || postText.length < 40) {
        status.textContent = "Couldn't find the post text — try scrolling the full post into view first.";
        status.classList.add('ccp-status-error');
        button.disabled = false;
        return;
      }

      console.debug('[Comment Copilot] extracted post text:', postText);
      status.textContent = 'Drafting…';
      const response = await chrome.runtime.sendMessage({
        type: 'ccp-generate',
        payload: {
          postText,
          authorName,
          tone: select.value,
          customInstruction: customInput.value,
        },
      });

      button.disabled = false;

      if (response?.text) {
        insertTextIntoEditor(editor, response.text);
        status.textContent = 'Draft inserted — review before posting.';
        button.textContent = '↻ Regenerate';
        return;
      }

      status.classList.add('ccp-status-error');
      switch (response?.error) {
        case 'no-api-key':
          status.textContent = '';
          status.appendChild(document.createTextNode('Add your Claude API key — '));
          const link = el('a', 'ccp-link');
          link.href = '#';
          link.textContent = 'open options';
          link.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.runtime.openOptionsPage();
          });
          status.appendChild(link);
          break;
        case 'invalid-key':
          status.textContent = 'Your API key looks invalid — check it in the extension options.';
          break;
        case 'rate-limited':
          status.textContent = 'Rate-limited by the API — try again in a moment.';
          break;
        default:
          status.textContent = `Something went wrong${response?.detail ? `: ${response.detail}` : ''}.`;
      }
    });

    bar.appendChild(select);
    bar.appendChild(customInput);
    bar.appendChild(button);
    bar.appendChild(status);

    editor.parentElement?.insertBefore(bar, editor);
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleScan();
})();
