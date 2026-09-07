const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-5';
const RESEND_URL = 'https://api.resend.com/emails';

const els = {
  idle: document.getElementById('state-idle'),
  recording: document.getElementById('state-recording'),
  processing: document.getElementById('state-processing'),
  done: document.getElementById('state-done'),
  error: document.getElementById('state-error'),

  startBtn: document.getElementById('start-btn'),
  stopBtn: document.getElementById('stop-btn'),
  settingsLink: document.getElementById('settings-link'),
  keyWarning: document.getElementById('key-warning'),

  timer: document.getElementById('timer'),
  transcriptBox: document.getElementById('transcript-box'),
  transcriptPlaceholder: document.getElementById('transcript-placeholder'),

  processingLabel: document.getElementById('processing-label'),

  emailStatus: document.getElementById('email-status'),
  resultSummary: document.getElementById('result-summary'),
  resultTodos: document.getElementById('result-todos'),
  resultNotes: document.getElementById('result-notes'),
  resultTranscript: document.getElementById('result-transcript'),
  downloadRecordingBtn: document.getElementById('download-recording'),
  retryEmailBtn: document.getElementById('retry-email'),
  closeBtn: document.getElementById('close-btn'),

  errorText: document.getElementById('error-text'),
  errorRetryBtn: document.getElementById('error-retry'),
};

const STATES = ['idle', 'recording', 'processing', 'done', 'error'];
function showState(name) {
  for (const s of STATES) els[s].hidden = s !== name;
}

let settings = {};
let displayStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordingBlob = null;
let recognition = null;
let recognitionShouldRun = false;
let finalTranscriptParts = [];
let timerInterval = null;
let startedAt = 0;
let notesResult = null;

async function loadSettings() {
  settings = await chrome.storage.local.get([
    'anthropicApiKey', 'resendApiKey', 'fromEmail', 'fromName', 'toEmail',
  ]);
  const missing = !settings.anthropicApiKey || !settings.resendApiKey;
  els.keyWarning.hidden = !missing;
  if (missing) {
    els.keyWarning.innerHTML = 'Set up your <a href="#" id="key-warning-link">Anthropic and Resend API keys</a> to get AI summaries and email delivery. Recording and download still work without them.';
    document.getElementById('key-warning-link').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }
}

els.settingsLink.addEventListener('click', () => chrome.runtime.openOptionsPage());

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function appendTranscriptLine(text, interim) {
  if (els.transcriptPlaceholder) {
    els.transcriptPlaceholder.remove();
    els.transcriptPlaceholder = null;
  }
  const existingInterim = els.transcriptBox.querySelector('.transcript-line.interim');
  if (existingInterim) existingInterim.remove();

  if (!text) return;
  const line = document.createElement('p');
  line.className = 'transcript-line' + (interim ? ' interim' : '');
  line.textContent = text;
  els.transcriptBox.appendChild(line);
  els.transcriptBox.scrollTop = els.transcriptBox.scrollHeight;
}

function pickMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

function startSpeechRecognition() {
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) return;

  recognitionShouldRun = true;
  recognition = new SpeechRecognitionCtor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        const text = result[0].transcript.trim();
        if (text) finalTranscriptParts.push(text);
        appendTranscriptLine(text, false);
      } else {
        interim += result[0].transcript;
      }
    }
    if (interim.trim()) appendTranscriptLine(interim.trim(), true);
  };

  recognition.onerror = (event) => {
    // 'no-speech' and 'aborted' are routine during quiet stretches; onend
    // below restarts recognition unless we've been told to stop.
    console.warn('speech recognition error', event.error);
  };

  recognition.onend = () => {
    if (recognitionShouldRun) {
      try { recognition.start(); } catch { /* already starting */ }
    }
  };

  recognition.start();
}

function stopSpeechRecognition() {
  recognitionShouldRun = false;
  if (recognition) {
    try { recognition.stop(); } catch { /* already stopped */ }
  }
}

async function startRecording() {
  try {
    displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 15 },
      audio: true,
    });
  } catch (err) {
    showError('Screen share was cancelled or denied, so recording could not start.');
    return;
  }

  recordedChunks = [];
  const mimeType = pickMimeType();
  mediaRecorder = new MediaRecorder(displayStream, mimeType ? { mimeType } : undefined);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.start(1000);

  displayStream.getVideoTracks()[0].addEventListener('ended', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') stopRecording();
  });

  finalTranscriptParts = [];
  startSpeechRecognition();

  startedAt = Date.now();
  els.timer.textContent = '00:00';
  timerInterval = setInterval(() => {
    els.timer.textContent = formatTime(Date.now() - startedAt);
  }, 1000);

  showState('recording');
}

function stopRecording() {
  clearInterval(timerInterval);
  stopSpeechRecognition();

  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    finishRecording();
    return;
  }

  mediaRecorder.onstop = () => {
    recordingBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'video/webm' });
    if (displayStream) displayStream.getTracks().forEach((t) => t.stop());
    finishRecording();
  };
  mediaRecorder.stop();
}

async function finishRecording() {
  showState('processing');
  els.processingLabel.textContent = 'Generating your meeting notes…';

  const transcript = finalTranscriptParts.join(' ').trim();

  try {
    notesResult = settings.anthropicApiKey
      ? await generateNotes(transcript)
      : { summary: '(No Anthropic API key set, so no AI summary was generated.)', todos: [], notes: [] };
  } catch (err) {
    notesResult = { summary: `Could not generate an AI summary: ${err.message}`, todos: [], notes: [] };
  }

  renderResults(transcript, notesResult);

  els.processingLabel.textContent = 'Sending email…';
  if (settings.resendApiKey) {
    try {
      await sendEmail(transcript, notesResult);
      showEmailStatus(`Emailed to ${settings.toEmail || 'your inbox'}.`, false);
    } catch (err) {
      showEmailStatus(`Email failed to send: ${err.message}`, true);
      els.retryEmailBtn.hidden = false;
    }
  } else {
    showEmailStatus('No Resend API key set, so the notes were not emailed. Add one in Settings.', true);
  }

  showState('done');
}

function showEmailStatus(text, isError) {
  els.emailStatus.textContent = text;
  els.emailStatus.classList.toggle('error', !!isError);
}

function renderResults(transcript, result) {
  els.resultSummary.textContent = result.summary || '(No summary.)';

  els.resultTodos.innerHTML = '';
  if (!result.todos || result.todos.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No action items identified.';
    li.style.background = 'transparent';
    li.style.fontWeight = 'normal';
    els.resultTodos.appendChild(li);
  } else {
    for (const todo of result.todos) {
      const li = document.createElement('li');
      li.textContent = todo;
      els.resultTodos.appendChild(li);
    }
  }

  els.resultNotes.innerHTML = '';
  if (!result.notes || result.notes.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No notes generated.';
    els.resultNotes.appendChild(li);
  } else {
    for (const note of result.notes) {
      const li = document.createElement('li');
      li.textContent = note;
      els.resultNotes.appendChild(li);
    }
  }

  els.resultTranscript.textContent = transcript || '(No speech was detected during the recording.)';
}

async function generateNotes(transcript) {
  if (!transcript) {
    return {
      summary: 'No speech was detected during the recording, so no summary could be generated.',
      todos: [],
      notes: [],
    };
  }

  const systemPrompt = `You turn a raw meeting transcript into structured notes. Output ONLY a single JSON object, no markdown code fences, no commentary, matching exactly this shape:
{"notes": ["...", "..."], "summary": "...", "todos": ["...", "..."]}

Rules:
- "notes": 4-10 bullet-point strings covering the key points and topics discussed, organized in the order they came up.
- "summary": a short 2-4 sentence executive summary of the meeting.
- "todos": bullet-point strings for concrete action items, each starting with the owner if the transcript names one (e.g. "Priya: send the revised proposal by Friday"). Omit vague or non-actionable items. Use an empty array if none were mentioned.
- Base everything strictly on the transcript. Never invent names, decisions, or action items that weren't said.
- The transcript comes from live speech recognition and may contain minor errors or missing punctuation; do your best to infer intent.`;

  const response = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Meeting transcript:\n\n${transcript}` }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await response.json();
  const rawText = (data.content || []).map((block) => block.text || '').join('').trim();
  const cleaned = rawText.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      todos: Array.isArray(parsed.todos) ? parsed.todos.filter((t) => typeof t === 'string') : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes.filter((n) => typeof n === 'string') : [],
    };
  } catch {
    return { summary: rawText || '(Could not parse the AI response.)', todos: [], notes: [] };
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailHtml(transcript, result) {
  const notesHtml = (result.notes || []).map((n) => `<li>${escapeHtml(n)}</li>`).join('') || '<li>No notes generated.</li>';
  const todosHtml = (result.todos || []).map((t) => `<li style="background:#fef08a;color:#713f12;border-radius:6px;padding:8px 12px;margin-bottom:6px;font-weight:600;list-style:none;">${escapeHtml(t)}</li>`).join('') || '<li style="list-style:none;">No action items identified.</li>';
  const transcriptHtml = escapeHtml(transcript || '(No speech was detected during the recording.)');
  const when = new Date().toLocaleString();

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;max-width:640px;">
    <h2 style="margin:0 0 4px;">Meeting Notes</h2>
    <p style="color:#888;margin:0 0 20px;font-size:13px;">${escapeHtml(when)}</p>

    <h3 style="margin:0 0 8px;">Summary</h3>
    <p style="margin:0 0 20px;">${escapeHtml(result.summary || '(No summary.)')}</p>

    <h3 style="margin:0 0 8px;">To-dos</h3>
    <ul style="margin:0 0 20px;padding-left:0;">${todosHtml}</ul>

    <h3 style="margin:0 0 8px;">Meeting notes</h3>
    <ul style="margin:0 0 20px;">${notesHtml}</ul>

    <h3 style="margin:0 0 8px;">Full transcript</h3>
    <pre style="white-space:pre-wrap;font-family:inherit;font-size:12.5px;background:#f5f5f5;border-radius:8px;padding:12px;">${transcriptHtml}</pre>
  </div>`;
}

async function sendEmail(transcript, result) {
  const fromEmail = settings.fromEmail || 'info@risegenie.com';
  const fromName = settings.fromName || 'RiseGenie Meeting Recorder';
  const toEmail = settings.toEmail || 'risegenie@gmail.com';

  const response = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.resendApiKey}`,
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [toEmail],
      subject: `Meeting Notes – ${new Date().toLocaleDateString()}`,
      html: buildEmailHtml(transcript, result),
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Resend API error ${response.status}: ${errBody.slice(0, 200)}`);
  }
}

function showError(message) {
  clearInterval(timerInterval);
  els.errorText.textContent = message;
  showState('error');
}

els.startBtn.addEventListener('click', startRecording);
els.stopBtn.addEventListener('click', stopRecording);
els.errorRetryBtn.addEventListener('click', () => showState('idle'));
els.closeBtn.addEventListener('click', () => window.close());

els.downloadRecordingBtn.addEventListener('click', () => {
  if (!recordingBlob) return;
  const url = URL.createObjectURL(recordingBlob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `meeting-recording-${stamp}.webm`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

els.retryEmailBtn.addEventListener('click', async () => {
  els.retryEmailBtn.hidden = true;
  showEmailStatus('Retrying…', false);
  try {
    const transcript = els.resultTranscript.textContent;
    await sendEmail(transcript === '(No speech was detected during the recording.)' ? '' : transcript, notesResult);
    showEmailStatus(`Emailed to ${settings.toEmail || 'your inbox'}.`, false);
  } catch (err) {
    showEmailStatus(`Email failed to send: ${err.message}`, true);
    els.retryEmailBtn.hidden = false;
  }
});

window.addEventListener('beforeunload', () => {
  if (displayStream) displayStream.getTracks().forEach((t) => t.stop());
  stopSpeechRecognition();
});

loadSettings();
