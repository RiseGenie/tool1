importScripts('shared-tones.js');

const API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-5';

const SYSTEM_TEMPLATE = (styleInstruction, persona) => `You draft a single LinkedIn comment on someone else's post, written as if by a real person (the extension's user), not as an AI assistant.

Style for this comment: ${styleInstruction}
${persona ? `About the person commenting (write in their voice, don't restate this bio): ${persona}\n` : ''}
Rules:
- 1-3 sentences, well under 400 characters. Real LinkedIn comment length, not an essay.
- Reference something specific from the post so it doesn't read like a generic template.
- No hashtags. No emojis unless the requested style clearly calls for playfulness, and then at most one.
- Never invent facts, credentials, or experience for the commenter beyond what's given above.
- Never use an em dash or en dash (the "—" or "–" characters) anywhere. Use a comma, a period, or "and"/"but" instead. Prefer short, plain sentences over dash-joined clauses.
- Output ONLY the comment text itself. No quotation marks, no preamble, no explanation.`;

// Backstop in case the model still slips one in: em/en dashes read as an
// obvious AI tell, so strip them even if the prompt above is ignored.
function stripDashes(text) {
  return text
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*([.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function getSettings() {
  const { apiKey, model, persona } = await chrome.storage.local.get(['apiKey', 'model', 'persona']);
  return { apiKey: apiKey || '', model: model || DEFAULT_MODEL, persona: persona || '' };
}

async function generateComment({ postText, authorName, tone, customInstruction }) {
  const { apiKey, model, persona } = await getSettings();
  if (!apiKey) {
    return { error: 'no-api-key' };
  }

  const toneDef = ccpToneById(tone);
  const styleInstruction = toneDef.id === 'custom'
    ? (customInstruction || 'Natural and professional.')
    : toneDef.instruction;

  const userContent = `Post${authorName ? ` by ${authorName}` : ''}:\n"""\n${(postText || '').slice(0, 3000)}\n"""\n\nWrite the LinkedIn comment now.`;

  let response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        thinking: { type: 'disabled' },
        system: SYSTEM_TEMPLATE(styleInstruction, persona),
        messages: [{ role: 'user', content: userContent }],
      }),
    });
  } catch (err) {
    return { error: 'network', detail: String(err?.message || err) };
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      detail = body?.error?.message || detail;
    } catch {
      // Ignore JSON parse failures on the error path.
    }
    if (response.status === 401) return { error: 'invalid-key', detail };
    if (response.status === 429) return { error: 'rate-limited', detail };
    return { error: 'api-error', detail };
  }

  const data = await response.json();
  const rawText = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  if (!rawText) return { error: 'empty-response' };
  return { text: stripDashes(rawText) };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'ccp-generate') return false;
  generateComment(message.payload).then(sendResponse);
  return true; // keep the message channel open for the async response
});
