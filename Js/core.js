
// ===== Storage Module & Versioned Models =====
const STORAGE_KEYS = {
attempts: 'edupulse_attempts_v1',
qstats: 'edupulse_qstats_v1',
session: 'edupulse_session_v1',
settings: 'edupulse_settings_v1',
streak: 'edupulse_streak_v1',
progress: 'edupulse_progress',
todos: 'edupulse_todos',
theme: 'edupulse_theme',
focus: 'edupulse_focus_sessions',
timerPreset: 'edupulse_timer_preset',
savedMockPresets: 'edupulse_mock_presets_v1',
geminiKey: 'edupulse_gemini_key_v1',
errorNotebook: 'edupulse_error_notebook_v1',
deviceReminders: 'ep_device_reminders_v1'
};

const defaultSettings = {
marksCorrect: 4,
marksWrong: -1,
minutesPerQuestion: 1,
shuffleQuestions: false,
shuffleOptions: false,
showTimer: true,
confirmSubmit: true,
haptics: true,
sound: false,
instantAnswer: true,
autoAdvance: false,
swipeNavigation: true,
fontScale: 1,
dailyGoalQuestions: 30
};

const ATTEMPT_HISTORY_CAP = 100;
const ATTEMPT_ARCHIVE_KEY = 'edupulse_attempt_totals_v1';
const StorageModule = {
archivedTotals() {
  try { const a = JSON.parse(localStorage.getItem(ATTEMPT_ARCHIVE_KEY) || 'null'); if (a && typeof a.n === 'number') return a; } catch (_) {}
  return { n: 0, attempted: 0, accSum: 0 };
},
/* Totals over all attempts ever stored (archived + current list). Recomputed only when the stored data changes. */
attemptTotals() {
  let raw = null;
  try { raw = localStorage.getItem(STORAGE_KEYS.attempts) + '|' + localStorage.getItem(ATTEMPT_ARCHIVE_KEY); } catch (_) {}
  if (this._totRaw === raw && this._tot) return this._tot;
  const arr = this.get(STORAGE_KEYS.attempts, []) || [];
  const arch = this.archivedTotals();
  let attempted = arch.attempted, accSum = arch.accSum;
  for (let i = 0; i < arr.length; i++) { attempted += arr[i].attempted || 0; accSum += arr[i].accuracy || 0; }
  const n = arch.n + arr.length;
  this._tot = { n, attempted, avgAccuracy: n ? Math.round(accSum / n) : 0 };
  this._totRaw = raw;
  return this._tot;
},
get(key, fallback) {
if (__pqPending && key === STORAGE_KEYS.session) flushQuizSession();
try {
const raw = localStorage.getItem(key);
if (raw === null) return fallback;
return JSON.parse(raw);
} catch (e) {
console.warn(`Storage read error for ${key}:`, e);
return fallback;
}
},
set(key, value) {
try {
if (key === 'edupulse_ai_explanations_v2' && value && typeof value === 'object') { const ks = Object.keys(value); if (ks.length > 60) { value = Object.fromEntries(ks.slice(-60).map(k => [k, value[k]])); } }
if (key === STORAGE_KEYS.attempts && Array.isArray(value) && value.length > ATTEMPT_HISTORY_CAP) {
  // Newest attempts are first. Fold the oldest into running totals so the dashboard numbers stay correct.
  const old = value.slice(ATTEMPT_HISTORY_CAP);
  const arch = this.archivedTotals();
  old.forEach(a => { arch.n += 1; arch.attempted += (a && a.attempted) || 0; arch.accSum += (a && a.accuracy) || 0; });
  try { localStorage.setItem(ATTEMPT_ARCHIVE_KEY, JSON.stringify(arch)); } catch (_) {}
  value = value.slice(0, ATTEMPT_HISTORY_CAP);
}
localStorage.setItem(key, JSON.stringify(value));
try { window.dispatchEvent(new CustomEvent('ep:store', { detail: { key } })); } catch (_) {}
return true;
} catch (e) {
console.warn(`Storage write error for ${key}, trimming attempts...`, e);
if (key === STORAGE_KEYS.attempts) {
try {
const trimmed = (Array.isArray(value) ? value : []).slice(0, 100);
localStorage.setItem(key, JSON.stringify(trimmed));
return true;
} catch (err) {
console.error('Critical quota exceeded:', err);
}
}
showToast('Storage quota reached! Oldest history trimmed.', 'error');
return false;
}
},
remove(key) {
if (__pqPending && key === STORAGE_KEYS.session) flushQuizSession();
try { localStorage.removeItem(key); } catch (e) { console.warn('Storage remove error:', e); }
},
init() {
if (!localStorage.getItem(STORAGE_KEYS.settings)) {
this.set(STORAGE_KEYS.settings, defaultSettings);
}
if (!localStorage.getItem(STORAGE_KEYS.attempts)) {
this.set(STORAGE_KEYS.attempts, []);
}
if (!localStorage.getItem(STORAGE_KEYS.qstats)) {
this.set(STORAGE_KEYS.qstats, {});
}
if (!localStorage.getItem(STORAGE_KEYS.streak)) {
const today = new Date().toISOString().split('T')[0];
this.set(STORAGE_KEYS.streak, { current: 0, best: 0, lastActiveDate: today, dailyCounts: {} });
}
this.updateStreak();
},
updateStreak() {
const streak = this.get(STORAGE_KEYS.streak, { current: 0, best: 0, lastActiveDate: '', dailyCounts: {} });
const today = new Date().toISOString().split('T')[0];
if (streak.lastActiveDate === today) return;
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
if (streak.lastActiveDate === yesterday) {
streak.current += 1;
} else if (streak.lastActiveDate !== today) {
streak.current = streak.dailyCounts[today] ? streak.current : 0;
}
if (streak.current > streak.best) streak.best = streak.current;
this.set(STORAGE_KEYS.streak, streak);
},
recordActivity(questionsAnsweredCount) {
const streak = this.get(STORAGE_KEYS.streak, { current: 0, best: 0, lastActiveDate: '', dailyCounts: {} });
const today = new Date().toISOString().split('T')[0];
streak.dailyCounts[today] = (streak.dailyCounts[today] || 0) + questionsAnsweredCount;
streak.lastActiveDate = today;
if (streak.current === 0) streak.current = 1;
if (streak.current > streak.best) streak.best = streak.current;

const keys = Object.keys(streak.dailyCounts).sort();
if (keys.length > 120) {
for (let i = 0; i < keys.length - 120; i++) delete streak.dailyCounts[keys[i]];
}
this.set(STORAGE_KEYS.streak, streak);

const settings = this.get(STORAGE_KEYS.settings, defaultSettings);
const todayTotal = streak.dailyCounts[today];
if (todayTotal >= settings.dailyGoalQuestions && todayTotal - questionsAnsweredCount < settings.dailyGoalQuestions) {
showToast(`🎯 Daily goal of ${settings.dailyGoalQuestions} questions reached!`, 'success');
}
}
};

StorageModule.init();

// ===== Gemini AI Integration Core =====
// Change this (or set localStorage 'edupulse_gemini_model') if the model is retired.
const GEMINI_DEFAULT_MODEL = 'gemini-3.5-flash';
// One-time migration: move users still on the previous default over to the new one
try { if (localStorage.getItem(GEMINI_MODEL_STORAGE_KEY) === 'gemini-3.8-flash') localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, GEMINI_DEFAULT_MODEL); } catch (e) {}
const GEMINI_MODEL_STORAGE_KEY = 'edupulse_gemini_model';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function getGeminiApiKey() {
  return localStorage.getItem(STORAGE_KEYS.geminiKey) || '';
}

function epAiOffSync() {
  const el = document.getElementById('ep-ai-off');
  if (el) el.hidden = !!getGeminiApiKey();
}

function setGeminiApiKey(key) {
  localStorage.setItem(STORAGE_KEYS.geminiKey, key.trim());
  setTimeout(epAiOffSync, 0);
  showToast(key.trim() ? 'Gemini API Key saved successfully!' : 'API Key removed.', key.trim() ? 'success' : 'warning');
}

function openApiKeyModal() {
  const currentKey = getGeminiApiKey();
  const currentModel = localStorage.getItem(GEMINI_MODEL_STORAGE_KEY) || GEMINI_DEFAULT_MODEL;
  setModal('Gemini AI Engine Settings', 'Provide your Gemini API key to activate AI chatbot, explanations, tutoring, and adaptive generators.', `
    <div class="space-y-4 py-2 text-xs">
      <div class="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-300">
        <i class="fa-solid fa-circle-info mr-1.5"></i> EduPulse uses a Gemini model that supports generateContent. Available models can be refreshed below. Your key remains stored locally in your browser.
      </div>

      <!-- YouTube API Key Tutorial Embed Integration -->
      <div class="space-y-2">
        <label class="block font-bold text-slate-700 dark:text-slate-300">Video Guide: How to Get a Free Gemini API Key</label>
        <div class="relative w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-black aspect-video flex items-center justify-center">
          <iframe 
            src="https://www.youtube.com/embed/7_HFmLrfZHg" 
            title="Gemini API Key Tutorial" 
            class="w-full h-full border-0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            allowfullscreen>
          </iframe>
        </div>
        <p class="text-[11px] text-slate-400 flex items-center justify-between">
          <span>Need help generating a key? Watch the quick tutorial above.</span>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" class="text-teal-600 dark:text-teal-400 font-extrabold hover:underline">Get Key on Google AI Studio ↗</a>
        </p>
      </div>

      <div>
        <label class="block font-bold text-slate-700 dark:text-slate-300 mt-2">Gemini API Key</label>
        <input type="password" id="geminiKeyInput" value="${escapeHtml(currentKey)}" placeholder="AIzaSy..." autocomplete="off" class="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono">
      </div>
      <div>
        <label for="geminiModelSelect" class="block font-bold text-slate-700 dark:text-slate-300">AI model</label>
        <div class="flex gap-2 mt-1.5">
          <select id="geminiModelSelect" class="min-w-0 flex-1 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold">
            <option value="${escapeHtml(currentModel)}">${escapeHtml(currentModel)} (selected)</option>
          </select>
          <button type="button" onclick="loadGeminiModels()" class="px-3 rounded-xl border border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300 text-xs font-bold">Refresh models</button>
        </div>
        <p id="geminiModelStatus" class="mt-1 text-[11px] text-slate-500">Choose a model supported by your API key. Models are loaded from Google.</p>
      </div>
    </div>
  `, `
    <button onclick="closeModal()" class="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">Cancel</button>
    <button onclick="saveApiKeyFromModal()" class="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md">Save API Key</button>
  `);
  if (currentKey) loadGeminiModels();
}

async function loadGeminiModels() {
  const key = document.getElementById('geminiKeyInput')?.value.trim() || getGeminiApiKey();
  const select = document.getElementById('geminiModelSelect');
  const status = document.getElementById('geminiModelStatus');
  if (!key) { if (status) status.textContent = 'Enter and save your API key first, then refresh models.'; return; }
  if (status) status.textContent = 'Loading models available to this API key…';
  try {
    const response = await fetch(`${GEMINI_API_BASE}/models?pageSize=1000`, { headers: { 'x-goog-api-key': key } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || `Model list failed (HTTP ${response.status})`);
    const models = (data.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => (m.name || '').replace(/^models\//, '')).filter(Boolean).sort();
    if (!models.length) throw new Error('Google returned no models supporting generateContent for this key.');
    const selected = localStorage.getItem(GEMINI_MODEL_STORAGE_KEY) || GEMINI_DEFAULT_MODEL;
    select.innerHTML = '';
    models.forEach(name => { const option = document.createElement('option'); option.value = name; option.textContent = name; select.appendChild(option); });
    select.value = models.includes(selected) ? selected : (models.includes(GEMINI_DEFAULT_MODEL) ? GEMINI_DEFAULT_MODEL : models[0]);
    if (status) status.textContent = `${models.length} compatible model(s) found. Selected: ${select.value}`;
  } catch (error) {
    if (status) status.textContent = error.message;
    showToast(`Could not load Gemini models: ${error.message}`, 'error');
  }
}

function saveApiKeyFromModal() {
  const val = document.getElementById('geminiKeyInput')?.value || '';
  const model = document.getElementById('geminiModelSelect')?.value || GEMINI_DEFAULT_MODEL;
  setGeminiApiKey(val);
  localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, model);
  closeModal();
}

async function fetchGeminiModelList(apiKey) {
  const response = await fetch(`${GEMINI_API_BASE}/models?pageSize=1000`, { headers: { 'x-goog-api-key': apiKey } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Unable to list Gemini models (HTTP ${response.status})`);
  return (data.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => (m.name || '').replace(/^models\//, '')).filter(Boolean);
}

async function callGeminiApi(prompt, systemInstruction = '', enableGrounding = false, opts = {}) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    openApiKeyModal();
    throw new Error('Please configure your Gemini API Key first.');
  }

  const payload = {
    contents: Array.isArray(prompt) ? prompt : [{ parts: [{ text: prompt }] }],
    ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
    ...(enableGrounding ? { tools: [{ google_search: {} }] } : {})
  };

  // Token-saving ladder: capped output (+ low thinking) first, then cap only, then no config at all.
  // Falls back automatically if a model rejects a field or spends the whole cap on thinking.
  const configLevels = model => {
    const out = [];
    if (opts.maxTokens) {
      const gc = { maxOutputTokens: opts.maxTokens };
      if (opts.lean && localStorage.getItem('ep_think_cfg_bad') !== '1') {
        const th = /2\.5/.test(model) ? { thinkingBudget: opts.quick ? 0 : 512 } : { thinkingLevel: 'low' };
        out.push({ generationConfig: { ...gc, thinkingConfig: th }, think: true });
      }
      out.push({ generationConfig: gc });
    }
    out.push({});
    return out;
  };

  const requestModel = async model => {
    const apiUrl = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`;
    let lastError;
    for (const level of configLevels(model)) {
      const { think, ...extra } = level;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ ...payload, ...extra }),
        ...(opts.signal ? { signal: opts.signal } : {})
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(result.error?.message || `Gemini API request failed (HTTP ${response.status})`);
        error.status = response.status;
        if (think && response.status === 400 && /think/i.test(error.message)) { try { localStorage.setItem('ep_think_cfg_bad', '1'); } catch (e) {} lastError = error; continue; }
        if (extra.generationConfig && response.status === 400 && /generation|maxoutput|max_output/i.test(error.message)) { lastError = error; continue; }
        throw error;
      }
      try { if (window.epTok) epTok.record(result.usageMetadata, opts.label); } catch (e) {}
      const candidate = result?.candidates?.[0];
      const generated = candidate?.content?.parts?.map(part => part.text || '').join('').trim();
      if (!generated) {
        if (candidate?.finishReason === 'MAX_TOKENS') { lastError = new Error('Gemini used its whole token budget before answering.'); continue; }
        throw new Error(result?.promptFeedback?.blockReason ? `Gemini blocked this prompt: ${result.promptFeedback.blockReason}` : 'Gemini returned no text. Try a different prompt or model.');
      }
      return candidate?.finishReason === 'MAX_TOKENS' ? generated + '\n\n*…cut short to save tokens. Say “continue” for the rest.*' : generated;
    }
    throw lastError || new Error('Gemini returned no text. Try a different prompt or model.');
  };

  let model = localStorage.getItem(GEMINI_MODEL_STORAGE_KEY) || GEMINI_DEFAULT_MODEL;
  try {
    return await requestModel(model);
  } catch (error) {
    const modelUnavailable = error.status === 404 || /model .* not found|not supported for generatecontent|unknown model/i.test(error.message);
    if (!modelUnavailable) throw error;
    const available = await fetchGeminiModelList(apiKey);
    const preference = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3-flash-preview', 'gemini-2.5-flash'];
    const fallback = preference.find(name => available.includes(name)) || available.find(name => /flash/i.test(name)) || available[0];
    if (!fallback || fallback === model) throw new Error(`The selected Gemini model "${model}" is unavailable. Open AI Key settings and refresh the model list. ${error.message}`);
    localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, fallback);
    showToast(`Gemini model updated to ${fallback}`, 'success');
    return await requestModel(fallback);
  }
}

// ===== Markdown Beauty Formatter =====
function renderFormattedMarkdown(text = '') {
  if (!text) return '';
  const TEX = {rightarrow:'→',to:'→',longrightarrow:'⟶',leftarrow:'←',leftrightarrow:'↔',rightleftharpoons:'⇌',Rightarrow:'⇒',Leftarrow:'⇐',implies:'⇒',uparrow:'↑',downarrow:'↓',times:'×',cdot:'·',div:'÷',pm:'±',mp:'∓',approx:'≈',neq:'≠',ne:'≠',leq:'≤',le:'≤',geq:'≥',ge:'≥',infty:'∞',degree:'°',circ:'°',propto:'∝',therefore:'∴',because:'∵',Delta:'Δ',delta:'δ',alpha:'α',beta:'β',gamma:'γ',lambda:'λ',mu:'μ',pi:'π',theta:'θ',omega:'ω',Omega:'Ω',sigma:'σ',rho:'ρ',epsilon:'ε',phi:'φ',eta:'η',nu:'ν',tau:'τ',psi:'ψ',Sigma:'Σ',sqrt:'√',ldots:'…',quad:' ',qquad:'  '};
  // Plain-text LaTeX: turns stray commands such as \rightarrow or \times into real symbols (used outside $...$ and as the KaTeX fallback).
  const texLite = s => String(s)
    .replace(/\\(?:text|textbf|textit|mathrm|mathbf|mathit|operatorname)(?=\{)/g, '')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
    .replace(/\\(?:left|right)(?![a-zA-Z])/g, '')
    .replace(/\\[,;:! ]/g, ' ')
    .replace(/\\([A-Za-z]+)/g, (m, k) => TEX[k] != null ? TEX[k] : m);
  const subsup = t => t.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>').replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');
  const MATH_RE = /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)/g;
  const mathHtml = (tex, display) => {
    try { if (window.katex) return katex.renderToString(tex, { throwOnError: false, displayMode: !!display, output: 'html' }); } catch (e) {}
    return `<span class="ai-math">${subsup(escapeHtml(texLite(tex))).replace(/[{}]/g, '')}</span>`;
  };
  const fmt = raw => {
    let t = escapeHtml(texLite(raw));
    t = t.replace(/`([^`]+)`/g, '<code class="ai-code">$1</code>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong class="ai-strong">$1</strong>');
    t = t.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em class="ai-em">$2</em>');
    return subsup(t);
  };
  const inline = raw => {
    const maths = [];
    const s = String(raw).replace(MATH_RE, m => {
      const d = m.startsWith('$$'), tex = (d || m.startsWith('\\(')) ? m.slice(2, -2) : m.slice(1, -1);
      maths.push(mathHtml(tex.trim(), d)); return '\u0001' + (maths.length - 1) + '\u0002';
    });
    return fmt(s).replace(/\u0001(\d+)\u0002/g, (_, i) => maths[+i]);
  };
  const iconFor = h => {
    h = h.toLowerCase();
    if (/ncert|concept|core/.test(h)) return 'fa-book-bookmark';
    if (/step|logic|derivation|solution|approach/.test(h)) return 'fa-list-check';
    if (/incorrect|wrong|other option|why/.test(h)) return 'fa-circle-xmark';
    if (/trick|formula|remember|mnemonic|tip|shortcut/.test(h)) return 'fa-wand-magic-sparkles';
    if (/summary|takeaway|conclusion/.test(h)) return 'fa-flag-checkered';
    return 'fa-lightbulb';
  };
  const tone = h => {
    h = h.toLowerCase();
    if (/incorrect|wrong|other option/.test(h)) return 'rose';
    if (/trick|formula|remember|mnemonic|tip|shortcut/.test(h)) return 'amber';
    if (/step|logic|derivation|solution/.test(h)) return 'indigo';
    return 'teal';
  };

  const lines = String(text).replace(/\r/g, '').split('\n');
  let out = '', cardOpen = false, list = null, table = [], code = null, secNo = 0;
  const closeList = () => { if (list) { out += `</${list}>`; list = null; } };
  const flushTable = () => {
    if (!table.length) return;
    const rows = table.filter(r => !/^\s*\|?\s*:?-{2,}/.test(r)).map(r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
    if (rows.length) {
      out += '<div class="ai-table-wrap"><table class="ai-table"><thead><tr>' + rows[0].map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
        rows.slice(1).map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
    }
    table = [];
  };
  const openCard = (title) => {
    closeList(); flushTable();
    if (cardOpen) out += '</section>';
    cardOpen = true; secNo++;
    const clean = title.replace(/^\d+[.)]\s*/, '').replace(/[*_`]/g, '');
    out += `<section class="ai-section-card ai-tone-${tone(clean)}"><div class="ai-section-header"><span class="ai-sec-ico"><i class="fa-solid ${iconFor(clean)}"></i></span><span class="ai-sec-title">${inline(clean)}</span><span class="ai-sec-no">${String(secNo).padStart(2, '0')}</span></div>`;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const t = line.trim();

    if (/^```/.test(t)) {
      if (code === null) { closeList(); flushTable(); code = []; }
      else { out += `<pre class="ai-pre"><code>${escapeHtml(code.join('\n'))}</code></pre>`; code = null; }
      continue;
    }
    if (code !== null) { code.push(line); continue; }

    if (/^\|.*\|$/.test(t)) { closeList(); table.push(t); continue; }
    else flushTable();

    if (!t) { closeList(); continue; }

    let m;
    if ((m = t.match(/^#{1,4}\s+(.*)$/))) { openCard(m[1]); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { closeList(); if (!cardOpen) out += '<hr class="ai-hr">'; continue; }
    // standalone bold line like "**Why other options are wrong**" -> sub heading
    if ((m = t.match(/^\*\*([^*]+?)\*\*:?$/))) { closeList(); out += `<h5 class="ai-sub">${inline(m[1])}</h5>`; continue; }
    if ((m = t.match(/^>\s?(.*)$/))) { closeList(); out += `<div class="ai-callout"><i class="fa-solid fa-circle-info"></i><span>${inline(m[1])}</span></div>`; continue; }
    if ((m = t.match(/^(\d+)[.)]\s+(.*)$/))) {
      if (list !== 'ol') { closeList(); out += '<ol class="ai-steps">'; list = 'ol'; }
      out += `<li><span class="ai-step-no">${m[1]}</span><span class="ai-li-body">${inline(m[2])}</span></li>`;
      continue;
    }
    if ((m = t.match(/^[*\-•]\s+(.*)$/))) {
      const indent = (line.match(/^\s*/)[0] || '').length >= 2;
      if (list !== 'ul') { closeList(); out += '<ul class="ai-bullets">'; list = 'ul'; }
      out += `<li class="${indent ? 'ai-nested' : ''}"><i class="fa-solid fa-angle-right"></i><span class="ai-li-body">${inline(m[1])}</span></li>`;
      continue;
    }
    // callouts for labelled lines
    if ((m = t.match(/^(Correct answer|Answer|Key point|Trick|Tip|Note|Remember|Mnemonic|Exam tip)\s*[:\-]\s*(.*)$/i))) {
      closeList();
      const k = m[1].toLowerCase();
      const cls = /correct|answer/.test(k) ? 'ok' : /trick|tip|mnemonic|remember/.test(k) ? 'tip' : 'note';
      out += `<div class="ai-callout ai-callout-${cls}"><b>${escapeHtml(m[1])}</b><span>${inline(m[2])}</span></div>`;
      continue;
    }
    closeList();
    out += `<p class="ai-p">${inline(t)}</p>`;
  }
  if (code !== null) out += `<pre class="ai-pre"><code>${escapeHtml(code.join('\n'))}</code></pre>`;
  closeList(); flushTable();
  if (cardOpen) out += '</section>';
  return `<div class="ai-md">${out}</div>`;
}

// ===== YouTube Search & Embed Helper =====
function generateYouTubeEmbedHtml(query, titleText = "Video Lecture & Solution") {
  const cleanQuery = encodeURIComponent(query);
  const searchUrl = `https://www.youtube.com/results?search_query=${cleanQuery}`;
  
  return `
    <div class="p-4 rounded-2xl bg-gradient-to-br from-rose-500/10 via-red-500/5 to-transparent border border-rose-500/20 space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <i class="fa-brands fa-youtube text-red-600 text-xl"></i>
          <span class="text-xs font-extrabold text-slate-800 dark:text-slate-100">${escapeHtml(titleText)}</span>
        </div>
        <a href="${searchUrl}" target="_blank" rel="noopener noreferrer" class="px-3 py-1 rounded-full bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold transition flex items-center gap-1.5 shadow-sm">
          <i class="fa-solid fa-arrow-up-right-from-square text-[11px]"></i> Search on YouTube
        </a>
      </div>

      <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
        Recommended topic query: <strong class="text-slate-700 dark:text-slate-200">"${escapeHtml(query)}"</strong>
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' NEET detailed explanation solution')}" target="_blank" rel="noopener noreferrer" class="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-rose-500 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-between transition group">
          <span><i class="fa-solid fa-play-circle text-red-500 mr-2 group-hover:scale-110 transition-transform"></i> Question Video Solution</span>
          <i class="fa-solid fa-chevron-right text-[11px] text-slate-400"></i>
        </a>
        <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' NEET full theory lecture One Shot')}" target="_blank" rel="noopener noreferrer" class="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-500 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-between transition group">
          <span><i class="fa-solid fa-book-open-reader text-purple-500 mr-2 group-hover:scale-110 transition-transform"></i> Topic Theory Lecture</span>
          <i class="fa-solid fa-chevron-right text-[11px] text-slate-400"></i>
        </a>
      </div>
    </div>
  `;
}

// ===== AI Adaptive Session Configurator Modal =====
function openAdaptiveAiConfigModal(preselectedSubject = 'Biology') {
  const chapters = data[preselectedSubject] || data['Biology'];
  
  setModal('✦ Infinite AI Adaptive Practice', 'Configure infinite dynamic AI question stream scaled easy to hard based on performance.', `
    <div class="space-y-4 py-2 text-xs">
      <div class="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-300 font-semibold space-y-1">
        <div class="flex items-center gap-1.5 font-extrabold text-sm text-teal-600 dark:text-teal-400">
          <i class="fa-solid fa-infinity"></i> Continuous Batch Adaptive Engine
        </div>
        <p class="text-[11px] opacity-90 leading-relaxed">Generates questions in batches of 5–10 MCQs per API call and automatically prefetches the next batch seamlessly in the background while you solve current questions!</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Target Subject</label>
          <select id="adaptiveSubjSelect" onchange="updateAdaptiveChapterDropdown(this.value)" class="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-xs">
            ${Object.keys(data).map(s => `<option value="${s}" ${s === preselectedSubject ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>

        <div>
          <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Target Chapter Focus</label>
          <select id="adaptiveChapterSelect" class="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-xs">
            <option value="All Chapters">Entire Subject Syllabus</option>
            ${chapters.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Initial Starting Level</label>
          <select id="adaptiveDifficulty" class="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-xs">
            <option value="Easy Foundation">Easy Foundation (Basic NCERT lines)</option>
            <option value="Standard NEET Level" selected>Standard NEET (Balanced)</option>
            <option value="Challenging Multi-Concept">Hard / Multi-Concept High Yield</option>
          </select>
        </div>

        <div>
          <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Generation Mode</label>
          <div class="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <i class="fa-solid fa-infinity text-teal-500"></i> Batch Streaming (5-10 MCQs + Prefetch)
          </div>
        </div>
      </div>
    </div>
  `, `
    <button onclick="closeModal()" class="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">Cancel</button>
    <button onclick="launchAiAdaptiveSessionFromModal()" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-purple-600 hover:from-teal-700 hover:to-purple-700 text-white font-extrabold text-xs shadow-md flex items-center gap-1.5">
      <i class="fa-solid fa-infinity"></i> Start Infinite Practice
    </button>
  `);
}

function updateAdaptiveChapterDropdown(selectedSubj) {
  const select = document.getElementById('adaptiveChapterSelect');
  if (!select) return;
  const chapters = data[selectedSubj] || [];
  select.innerHTML = `<option value="All Chapters">Entire Subject Syllabus</option>` + chapters.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
}

// ===== PATCH A: Infinite Adaptive Core State & Fetching Engine (5-10 MCQs / Batch & Prefetching) =====

const INF_LEVELS = [
  null,
  { name: 'Foundation', color: 'text-sky-500',     desc: 'very easy, single-step, direct NCERT line recall; obvious distractors' },
  { name: 'Easy',       color: 'text-emerald-500', desc: 'easy NCERT-based questions, one concept, simple reasoning' },
  { name: 'Standard',   color: 'text-amber-500',   desc: 'standard NEET level, NCERT line-by-line with plausible distractors' },
  { name: 'Hard',       color: 'text-orange-500',  desc: 'hard NEET level, multi-concept, statement-based, close distractors, numericals where relevant' },
  { name: 'Elite',      color: 'text-rose-500',    desc: 'toughest NEET level: assertion-reason, multi-step reasoning, exception-based and application questions' }
];

async function fetchInfiniteBatch(count = 7) {
  const st = quizState.infinite;
  const level = st.level;
  const lv = INF_LEVELS[level];
  const h = st.history;
  const recent = h.slice(-8);
  const correctRecent = recent.filter(x => x.correct).length;
  const missed = h.filter(x => !x.correct).slice(-5).map(x => x.stem);
  const asked = quizState.questions.slice(-30).map(q => (q.question || '').slice(0, 90));

  const prompt = `Generate exactly ${count} distinct NEET multiple choice questions as a single JSON array.
Subject: ${st.subject}
Chapter scope: ${st.chapter === 'All Chapters' ? 'any chapter of the subject (vary the chapters across the array)' : st.chapter}
Target difficulty: Level ${level} of 5 (${lv.name}) - ${lv.desc}.
Student performance: ${h.length} answered so far, ${correctRecent}/${recent.length} correct in the last ${recent.length}.
${missed.length ? `The student recently got these wrong, so probe related concepts from a different angle (do not repeat them):\n- ${missed.join('\n- ')}` : ''}
${asked.length ? `Do NOT repeat or closely paraphrase any of these earlier questions:\n- ${asked.join('\n- ')}` : ''}

Return ONLY a raw JSON array of length ${count}, no markdown:
[{"q":"question text","o":["A","B","C","D"],"a":1,"s":"short NCERT-based explanation"}]
"a" is the 1-based index of the correct option. Exactly 4 options per question.`;

  const sys = 'You are an expert NEET question setter. Output ONLY a valid JSON array of MCQs. Questions must be factually accurate and based on NCERT.';
  const text = await callGeminiApi(prompt, sys);
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('AI returned no question batch data.');
  const parsed = JSON.parse(m[0]);

  const out = parsed
    .filter(q => q && q.q && Array.isArray(q.o) && q.o.length === 4 && Number.isInteger(q.a) && q.a >= 1 && q.a <= 4)
    .map((q, i) => ({
      qKey: 'ai_inf_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substring(2,7),
      question: String(q.q),
      options: q.o.map(String),
      correct: q.a - 1,
      explanation: q.s || 'NCERT concept.',
      sourceChapter: `${st.subject}: ${st.chapter}`,
      level
    }));
  if (!out.length) throw new Error('AI produced invalid question format.');
  return out;
}

function requestInfiniteBatch(count = 7) {
  const st = quizState.infinite;
  if (!st) return Promise.resolve();
  if (st.fetching) return st.fetchPromise;
  const gen = st.gen;
  st.fetching = true;
  st.error = null;
  st.fetchPromise = fetchInfiniteBatch(count)
    .then(batch => {
      // discard if session changed or difficulty shifted while generating
      if (quizState.infinite === st && st.gen === gen) {
        quizState.questions.push(...batch);
      }
    })
    .catch(e => {
      console.warn('Infinite batch prefetch error:', e);
      if (st.gen === gen) st.error = e.message;
    })
    .finally(() => {
      if (st.gen === gen) st.fetching = false;
    });
  return st.fetchPromise;
}

// Check and trigger prefetch when remaining un-answered queue falls below threshold
function checkAndTriggerPrefetch() {
  const st = quizState.infinite;
  if (!st || st.fetching) return;
  const remainingInQueue = quizState.questions.length - 1 - quizState.currentIndex;
  if (remainingInQueue <= 4) {
    requestInfiniteBatch(7);
  }
}

// Called after every answer: moves difficulty up/down and maintains prefetched batches
function adaptInfinite(isCorrect, q) {
  const st = quizState.infinite;
  if (!st) return;
  st.history.push({ correct: isCorrect, level: q.level || st.level, stem: (q.question || '').slice(0, 90) });
  const before = st.level;

  if (isCorrect) {
    st.streakC++; st.streakW = 0;
    if (st.streakC >= 2 && st.level < 5) { st.level++; st.streakC = 0; }
  } else {
    st.streakW++; st.streakC = 0;
    if (st.streakW >= 2 && st.level > 1) { st.level--; st.streakW = 0; }
  }
  st.peak = Math.max(st.peak, st.level);
  st.shift = st.level > before ? 'up' : st.level < before ? 'down' : null;

  if (st.level !== before) {
    // difficulty changed: prune upcoming unvisited queue and prefetch fresh batch at new level
    quizState.questions.length = quizState.currentIndex + 1;
    st.gen++;
    st.fetching = false;
    requestInfiniteBatch(7);
  } else {
    checkAndTriggerPrefetch();
  }
}

async function launchAiAdaptiveSessionFromModal(chapterSubject = null, chapterName = null) {
  const subj = chapterSubject || document.getElementById('adaptiveSubjSelect')?.value || 'Biology';
  const chapter = chapterName || document.getElementById('adaptiveChapterSelect')?.value || 'All Chapters';
  const initialDiff = document.getElementById('adaptiveDifficulty')?.value || 'Standard NEET Level';
  const startLevel = initialDiff.startsWith('Easy') ? 1 : initialDiff.startsWith('Challenging') ? 4 : 3;

  setModal('Initializing Infinite Adaptive Batch Engine', `${subj} — ${chapter}`, `
    <div class="flex flex-col items-center justify-center py-10 space-y-4">
      <i class="fa-solid fa-infinity fa-spin text-4xl text-teal-600 mb-2"></i>
      <p class="text-sm font-black text-slate-800 dark:text-slate-100">Generating initial 5–10 MCQ batch...</p>
      <span class="text-xs text-slate-500 font-bold">Starting level: ${INF_LEVELS[startLevel].name} (${subj})</span>
    </div>
  `);

  const st = {
    subject: subj, chapter, level: startLevel, startLevel, peak: startLevel,
    history: [], streakC: 0, streakW: 0, gen: 0,
    fetching: false, fetchPromise: null, error: null, shift: null, waiting: false
  };

  try {
    quizState.infinite = st;
    quizState.questions = [];
    const firstBatch = await fetchInfiniteBatch(7);
    launchPracticeSession(subj, `Infinite Practice: ${chapter}`, firstBatch, st);
    // Prefetch next batch immediately so student experiences zero lag
    checkAndTriggerPrefetch();
  } catch (err) {
    quizState.infinite = null;
    showToast('Infinite Adaptive Generator Error: ' + err.message, 'error');
    closeModal();
  }
}

// ===== Contextual practice doubt =====
function openPracticeDoubt(qIndex) {
  const q = quizState.questions[qIndex]; if (!q) return;
  const selected = quizState.userAnswers[qIndex];
  const selectedText = selected === undefined ? 'Not answered' : `${String.fromCharCode(65 + selected)}. ${q.options[selected]}`;
  setModal('Ask a doubt', `${quizState.subject || 'NEET'} · ${q.sourceChapter || quizState.chapter || 'Current concept'}`, `<div class="space-y-4 py-2"><div class="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4 text-sm"><p class="font-bold">${escapeHtml(q.question)}</p><p class="mt-2 text-xs text-slate-500">Your answer: ${escapeHtml(selectedText)}</p></div><label for="practice-doubt-input" class="block text-xs font-bold">What would you like clarified?</label><textarea id="practice-doubt-input" rows="3" class="w-full rounded-xl border border-slate-200 bg-transparent p-3 text-sm dark:border-slate-700" placeholder="Ask about a step, option, formula, or related concept"></textarea><div id="practice-doubt-answer" class="text-sm leading-relaxed"></div></div>`, `<button type="button" onclick="closeModal()" class="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold dark:bg-slate-800">Back to practice</button><button type="button" onclick="answerPracticeDoubt(${qIndex})" class="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white">Ask Pulse AI</button>`);
}
async function answerPracticeDoubt(qIndex) {
  const q = quizState.questions[qIndex], input = document.getElementById('practice-doubt-input'), output = document.getElementById('practice-doubt-answer');
  if (!q || !input || !output || !input.value.trim()) { showToast('Write a doubt first.','warning'); return; }
  const selected = quizState.userAnswers[qIndex], selectedText = selected === undefined ? 'Not answered' : `${String.fromCharCode(65 + selected)}. ${q.options[selected]}`;
  output.innerHTML = '<div class="flex items-center gap-2 text-teal-700"><i class="fa-solid fa-spinner fa-spin"></i><span>Thinking through your question…</span></div>';
  try {
    const answer = await callGeminiApi(`Current NEET question: ${q.question}\
Options: ${q.options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join(' | ')}\
Correct answer: ${q.options[q.correct]}\
Student selected: ${selectedText}\
Chapter: ${q.sourceChapter || quizState.chapter}\
Student doubt: ${input.value.trim()}\
\
Answer the student's specific doubt clearly, step by step, at a NEET-appropriate level. Refer to their selected answer if helpful.`, ''+ 'You are Pulse AI, a patient NEET tutor. ' + EPC_FORMAT_RULES + '', false, window.epTok ? epTok.opts('doubt') : {});
    output.innerHTML = renderFormattedMarkdown(answer);
  } catch (error) { output.textContent = error?.message || 'The explanation could not be generated. Please try again.'; }
}

// ===== AI Question Explanation Modal =====
async function showAiQuestionExplanation(qIndex) {
  const q = quizState.questions[qIndex];
  if (!q) return;
  const selectedIndex = quizState.userAnswers[qIndex];
  const selectedAnswer = selectedIndex === undefined ? 'Not answered yet' : `${String.fromCharCode(65 + selectedIndex)}. ${q.options[selectedIndex]}`;
  const mistakeCategory = quizState.wrongReasons[qIndex] || 'Not categorized';

  const modalSlotId = 'ai-explanation-content-container';
  setModal('✦ AI Question Deep-Dive & Lecture Embed', `${quizState.subject || 'NEET'} — ${q.sourceChapter || quizState.chapter || 'Concept Solution'}`, `
    <div id="${modalSlotId}" class="space-y-4 py-2 text-xs">
      <div class="flex items-center gap-3 p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-300">
        <i class="fa-solid fa-wand-magic-sparkles fa-spin text-lg"></i>
        <div>
          <span class="font-black text-xs">Analyzing Question with Gemini AI...</span>
          <p class="text-[11px] opacity-80">Fetching line-by-line NCERT breakdown & searching video explanations.</p>
        </div>
      </div>
    </div>
  `, `<button onclick="closeModal()" class="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">Close</button>`);

  try {
    const prompt = `Explain this NEET MCQ to a student.
Question: ${q.question}
Options:
${q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n')}
Official key: ${String.fromCharCode(65 + q.correct)}. ${q.options[q.correct]}
Student selected: ${selectedAnswer}
Mistake category: ${mistakeCategory}

Use exactly these four markdown sections and nothing else:
### Core NCERT Concept
(2-3 lines)
### Why the Correct Option is Right
(short numbered steps; only reasoning that matters)
### Why the Other Options are Wrong
(one line per wrong option, naming its exact error; if the student chose a wrong option, address that misconception here)
### Remember This
(one mnemonic, formula or exam trick)

Treat the official key as correct unless it clearly contradicts NCERT; if so, say that in one line. Keep the whole answer under 250 words.`;

    const sysInstruction = "You are a master NEET Physics, Chemistry & Biology tutor. " + EPC_FORMAT_RULES;
    
    const aiCacheKey = `${q.qKey || quizState.chapter + ':' + qIndex}:en:${selectedIndex ?? 'na'}:${mistakeCategory}`;
    const aiCache = StorageModule.get('edupulse_ai_explanations_v2', {});
    const explanationText = aiCache[aiCacheKey] || await callGeminiApi(prompt, sysInstruction, false, window.epTok ? epTok.opts('explain') : {});
    if (!aiCache[aiCacheKey]) { aiCache[aiCacheKey] = explanationText; StorageModule.set('edupulse_ai_explanations_v2', aiCache); }

    const chapterTopic = q.sourceChapter || quizState.chapter || quizState.subject;
    const videoQuery = `${chapterTopic} ${q.question.substring(0, 45)}`;
    const theoryQuery = `${chapterTopic} NEET One Shot full chapter lecture`;

    const videoSectionHtml = generateYouTubeEmbedHtml(videoQuery, `Video Solution: ${chapterTopic}`);
    const theorySectionHtml = generateYouTubeEmbedHtml(theoryQuery, `Full Theory Lecture: ${chapterTopic}`);

    const slot = document.getElementById(modalSlotId);
    if (slot) {
      slot.innerHTML = `
        <div class="space-y-4">
          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span class="text-[11px] font-black uppercase text-teal-600">Question ${qIndex + 1} Review</span>
            <p class="font-bold text-sm text-slate-900 dark:text-slate-100 mt-1">${multiline(q.question)}</p>
            <div class="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <i class="fa-solid fa-circle-check mr-1"></i> Correct Answer: ${String.fromCharCode(65 + q.correct)}. ${escapeHtml(q.options[q.correct])}
            </div>
          </div>

          <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 leading-relaxed text-slate-800 dark:text-slate-200 text-xs">
            <div class="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800 font-extrabold text-teal-600 dark:text-teal-400">
              <i class="fa-solid fa-brain text-sm"></i>
              <span>Gemini Step-by-Step Breakdown</span>
            </div>
            ${renderFormattedMarkdown(explanationText)}
          </div>

          <div class="space-y-3">
            <h4 class="text-xs font-black uppercase tracking-wider text-slate-400">Video & Theory Resources</h4>
            ${videoSectionHtml}
            ${theorySectionHtml}
          </div>
        </div>
      `;
    }
  } catch (err) {
    const slot = document.getElementById(modalSlotId);
    if (slot) {
      slot.innerHTML = `
        <div class="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
          <i class="fa-solid fa-triangle-exclamation mr-1.5"></i> Could not generate AI explanation: ${escapeHtml(err.message)}
        </div>
        ${generateYouTubeEmbedHtml(`${quizState.chapter || quizState.subject} NEET lecture`, 'Manual YouTube Video Search')}
      `;
    }
  }
}

// ===== AI Test Performance Feedback =====
async function generateAiTestPerformanceFeedback(attempt) {
  const modalSlotId = 'ai-performance-feedback-slot';
  setModal('✦ AI Diagnostic & Performance Feedback', attempt.chapter || 'NEET Test Analysis', `
    <div id="${modalSlotId}" class="space-y-4 py-2 text-xs">
      <div class="flex items-center gap-3 p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-300">
        <i class="fa-solid fa-wand-magic-sparkles fa-spin text-lg"></i>
        <div>
          <span class="font-black text-xs">Analyzing Your Test Attempt...</span>
          <p class="text-[11px] opacity-80">Evaluating score, accuracy, negative marks, and generating target recommendations.</p>
        </div>
      </div>
    </div>
  `, `<button onclick="closeModal()" class="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">Close</button>`);

  try {
    const prompt = `Analyze this NEET test result attempt and provide actionable performance feedback:
- Chapter/Subject: ${attempt.chapter || attempt.subject}
- Total Questions: ${attempt.total}
- Attempted: ${attempt.attempted}
- Correct: ${attempt.correct}
- Incorrect/Negative: ${attempt.wrong}
- Skipped: ${attempt.skipped}
- Score: ${attempt.score} / ${attempt.maxScore}
- Accuracy: ${attempt.accuracy}%

Provide a high-yield diagnostic evaluation in markdown:
1. ### Performance Overview & Grade
2. ### Speed & Negative Marking Risk Analysis
3. ### Key Weak Areas & Revision Priorities
4. ### Action Plan for Next 7 Days`;

    const sysInstruction = "You are a senior NEET exam strategist and performance mentor. Give constructive, highly strategic analysis for competitive exam aspirants.";

    const feedbackText = await callGeminiApi(prompt, sysInstruction);

    const slot = document.getElementById(modalSlotId);
    if (slot) {
      slot.innerHTML = `
        <div class="space-y-4">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div class="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20"><span class="block text-xl font-black text-teal-600">${attempt.score}/${attempt.maxScore}</span><span class="text-[11px] font-bold text-slate-500 uppercase">Score</span></div>
            <div class="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"><span class="block text-xl font-black text-emerald-600">${attempt.accuracy}%</span><span class="text-[11px] font-bold text-slate-500 uppercase">Accuracy</span></div>
            <div class="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20"><span class="block text-xl font-black text-rose-600">-${attempt.wrong}</span><span class="text-[11px] font-bold text-slate-500 uppercase">Negative</span></div>
            <div class="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20"><span class="block text-xl font-black text-purple-600">${attempt.attempted}/${attempt.total}</span><span class="text-[11px] font-bold text-slate-500 uppercase">Attempted</span></div>
          </div>

          <div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 leading-relaxed text-slate-800 dark:text-slate-200 text-xs space-y-2">
            <div class="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800 font-extrabold text-teal-600 dark:text-teal-400">
              <i class="fa-solid fa-chart-line text-sm"></i>
              <span>AI Performance Coach Breakdown</span>
            </div>
            ${renderFormattedMarkdown(feedbackText)}
          </div>

          ${generateYouTubeEmbedHtml(`${attempt.chapter || attempt.subject} NEET revision strategy guidance`, 'Recommended Strategy & Revision Lectures')}
        </div>
      `;
    }
  } catch (err) {
    const slot = document.getElementById(modalSlotId);
    if (slot) {
      slot.innerHTML = `
        <div class="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
          <i class="fa-solid fa-triangle-exclamation mr-1.5"></i> Could not generate AI feedback: ${escapeHtml(err.message)}
        </div>
      `;
    }
  }
}

// ===== Brand: site link + shareable question card =====
window.EP_BRAND = { site: 'https://edupulse.cc.cd', label: 'edupulse.cc.cd', motto: 'Padhai ki dhadkan' };
EP_BRAND.qr = EP_BRAND.site + '/?ref=share';   // scanned from a shared image
const epBrandFooter = (withUrl = true) => `\n\n— EduPulse · ${EP_BRAND.motto}\n${withUrl ? 'Practice more NEET MCQs free: ' + EP_BRAND.site : 'Practice more NEET MCQs free'}`;

function epWrapText(ctx, text, maxW) {
  const lines = [];
  String(text).split('\n').forEach(par => {
    let cur = '';
    par.split(/\s+/).filter(Boolean).forEach(w => {
      // a single word wider than the line (long formulae, URLs): break it by characters
      while (ctx.measureText(w).width > maxW && w.length > 1) {
        let k = w.length - 1; while (k > 1 && ctx.measureText(w.slice(0, k)).width > maxW) k--;
        if (cur) { lines.push(cur); cur = ''; }
        lines.push(w.slice(0, k)); w = w.slice(k);
      }
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    });
    lines.push(cur);
  });
  return lines;
}
function epRoundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function epDrawMark(ctx, x, y, size) {
  const k = size / 512;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  const g = ctx.createLinearGradient(0, 0, 512, 512); g.addColorStop(0, '#0d9488'); g.addColorStop(1, '#6366f1');
  epRoundRect(ctx, 0, 0, 512, 512, 112); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 36; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke(new Path2D('M76 300H150L190 232L232 356L274 276L306 306L402 164'));
  ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.arc(402, 164, 48, 0, 7); ctx.fill();
  ctx.fillStyle = '#a3e635'; ctx.beginPath(); ctx.arc(402, 164, 32, 0, 7); ctx.fill();
  ctx.restore();
}

/* ---------- Question text → clean on-canvas text (canvas can't render HTML / KaTeX) ---------- */
const EP_SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ' };
const EP_SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', '−': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', o: 'ₒ', x: 'ₓ', h: 'ₕ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', p: 'ₚ', s: 'ₛ', t: 'ₜ' };
const epSupStr = s => { s = String(s).replace(/\s+/g, ''); return [...s].every(c => EP_SUP[c]) ? [...s].map(c => EP_SUP[c]).join('') : '^(' + s + ')'; };
const epSubStr = s => { s = String(s).replace(/\s+/g, ''); return [...s].every(c => EP_SUB[c]) ? [...s].map(c => EP_SUB[c]).join('') : '_(' + s + ')'; };
const epParen = s => /^[\w.°]+$/.test(s.trim()) ? s.trim() : '(' + s.trim() + ')';
const EP_TEX = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε', eta: 'η', theta: 'θ', lambda: 'λ', mu: 'μ', nu: 'ν', pi: 'π', rho: 'ρ', sigma: 'σ', Sigma: 'Σ', tau: 'τ', phi: 'φ', Phi: 'Φ', omega: 'ω', Omega: 'Ω', times: '×', cdot: '·', pm: '±', div: '÷', to: '→', rightarrow: '→', leftarrow: '←', leftrightarrow: '↔', Rightarrow: '⇒', rightleftharpoons: '⇌', ge: '≥', geq: '≥', le: '≤', leq: '≤', ne: '≠', neq: '≠', approx: '≈', sim: '∼', equiv: '≡', infty: '∞', propto: '∝', circ: '°', degree: '°', deg: '°', AA: 'Å', angstrom: 'Å', ldots: '…', log: 'log ', ln: 'ln ', sin: 'sin ', cos: 'cos ', tan: 'tan ', cot: 'cot ', sec: 'sec ', exp: 'exp ', lim: 'lim ', min: 'min ', max: 'max ', dots: '…', cdots: '⋯', uparrow: '↑', downarrow: '↓', therefore: '∴', partial: '∂', nabla: '∇', hbar: 'ħ', ell: 'ℓ', quad: ' ', qquad: '  ', '%': '%', ',': ' ', ';': ' ', '!': '', ' ': ' ', '\\': '\n', '{': '{', '}': '}', '_': '_', '&': '&', '#': '#' };
function epTexToText(t) {
  let s = String(t);
  for (let k = 0; k < 6; k++) {
    const b = s;
    s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (m, a, c) => { const k = a.trim() + '/' + c.trim(); return ({ '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾', '1/5': '⅕', '1/8': '⅛' })[k] || (epParen(a) + '/' + epParen(c)); })
      .replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, (m, n, x) => epSupStr(n) + '√' + epParen(x))
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, (m, x) => '√' + epParen(x))
      .replace(/\\sqrt\s*([A-Za-z0-9])/g, '√$1')
      .replace(/\\(?:text|mathrm|mathbf|mathit|textbf|textit|operatorname|boldsymbol|mathbb|bar|vec|overline|hat|underline)\s*\{([^{}]*)\}/g, '$1');
    if (s === b) break;
  }
  s = s.replace(/\\(?:left|right|displaystyle|limits|big|Big)\b/g, '')
    .replace(/\\([A-Za-z]+|.)/g, (m, c) => (c in EP_TEX ? EP_TEX[c] : /^[A-Za-z]+$/.test(c) ? c : c))
    .replace(/\^\{([^{}]*)\}/g, (m, a) => epSupStr(a))
    .replace(/\^([A-Za-z0-9+\-−])/g, (m, a) => epSupStr(a))
    .replace(/_\{([^{}]*)\}/g, (m, a) => epSubStr(a))
    .replace(/_([A-Za-z0-9])/g, (m, a) => epSubStr(a))
    .replace(/[{}]/g, '');
  return s.replace(/[ \t]{2,}/g, ' ');
}
function epPlain(v) {
  const re = (typeof EP_MATH_RE !== 'undefined') ? EP_MATH_RE : /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/;
  return String(v ?? '').split(re).map(p => {
    if (p.length > 4 && p.startsWith('$$') && p.endsWith('$$')) return epTexToText(p.slice(2, -2));
    if (p.length > 2 && p[0] === '$' && p.endsWith('$')) return epTexToText(p.slice(1, -1));
    return p.replace(/\^([0-9+−-]+)/g, (m, a) => epSupStr(a)).replace(/_([0-9]+)/g, (m, a) => epSubStr(a));
  }).join('').replace(/[ \t]+\n/g, '\n').trim();
}

/* ---------- Tiny QR encoder (byte mode, ECC level M, versions 1–6 → up to 106 chars) ---------- */
function epQR(text) {
  const data = Array.from(new TextEncoder().encode(String(text)));
  const ECC = [0, 10, 16, 26, 18, 24, 16], BLK = [0, 1, 1, 1, 2, 2, 4];
  const raw = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = ((v / 7) | 0) + 2; r -= (25 * n - 10) * n - 55; } return r >> 3; };
  let ver = 0;
  for (let v = 1; v <= 6; v++) if (12 + data.length * 8 <= (raw(v) - ECC[v] * BLK[v]) * 8) { ver = v; break; }
  if (!ver) return null;
  const nData = raw(ver) - ECC[ver] * BLK[ver];
  const bits = [], put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(data.length, 8); data.forEach(b => put(b, 8)); put(0, Math.min(4, nData * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const cw = []; for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xEC; cw.length < nData; pad ^= 0xEC ^ 0x11) cw.push(pad);
  // Reed–Solomon over GF(256)
  const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; };
  const rsDiv = deg => { const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1; for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { r[j] = mul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = mul(root, 2); } return r; };
  const rsRem = (d, div) => { const r = div.map(() => 0); d.forEach(b => { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= mul(c, f); }); }); return r; };
  const nb = BLK[ver], el = ECC[ver], rc = raw(ver), ns = nb - (rc % nb), sl = (rc / nb) | 0, div = rsDiv(el), blocks = [];
  for (let i = 0, k = 0; i < nb; i++) { const dat = cw.slice(k, k + sl - el + (i < ns ? 0 : 1)); k += dat.length; const ecc = rsRem(dat, div); if (i < ns) dat.push(0); blocks.push(dat.concat(ecc)); }
  const all = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== sl - el || j >= ns) all.push(b[i]); });
  // matrix
  const n = ver * 4 + 17, M = Array.from({ length: n }, () => new Array(n).fill(false)), Fm = Array.from({ length: n }, () => new Array(n).fill(false));
  const set = (x, y, d) => { M[y][x] = d; Fm[y][x] = true; };
  for (let i = 0; i < n; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy; if (x >= 0 && x < n && y >= 0 && y < n) set(x, y, d !== 2 && d !== 4); } };
  finder(3, 3); finder(n - 4, 3); finder(3, n - 4);
  const AP = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]][ver];
  AP.forEach((cy, i) => AP.forEach((cx, j) => { if ((i === 0 && j === 0) || (i === 0 && j === AP.length - 1) || (i === AP.length - 1 && j === 0)) return; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }));
  const fmt = mask => {
    let rem = mask; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const b = ((mask << 10) | rem) ^ 0x5412, bit = i => ((b >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i)); set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, n - 15 + i, bit(i));
    set(8, n - 8, true);
  };
  fmt(0);
  let bi = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? n - 1 - vert : vert;
      if (!Fm[y][x] && bi < all.length * 8) { M[y][x] = ((all[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0; bi++; }
    }
  }
  const MF = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (((x / 3) | 0) + ((y / 2) | 0)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0, (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
  const mask = m => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!Fm[y][x] && MF[m](x, y)) M[y][x] = !M[y][x]; };
  const penalty = () => {
    let p = 0;
    for (let i = 0; i < n; i++) [M[i].map(Number), M.map(r => +r[i])].forEach(L => {
      let run = 1;
      for (let k = 1; k < n; k++) { if (L[k] === L[k - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
      for (let k = 0; k + 11 <= n; k++) { const s = L.slice(k, k + 11).join(''); if (s === '10111010000' || s === '00001011101') p += 40; }
    });
    for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) { const c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
    let dark = 0; M.forEach(r => r.forEach(v => { if (v) dark++; }));
    return p + (Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1) * 10;
  };
  let best = 0, bestP = 1e9;
  for (let m = 0; m < 8; m++) { mask(m); fmt(m); const p = penalty(); if (p < bestP) { bestP = p; best = m; } mask(m); }
  mask(best); fmt(best);
  return { n, ver, get: (x, y) => M[y][x] };
}
function epDrawQR(ctx, qr, x, y, size, ink) {
  // square modules on purpose: it is the most reliable thing to scan from a screenshot / compressed share
  const c = size / qr.n; ctx.fillStyle = ink;
  for (let j = 0; j < qr.n; j++) for (let i = 0; i < qr.n; i++) if (qr.get(i, j)) ctx.fillRect(x + i * c - 0.2, y + j * c - 0.2, c + 0.4, c + 0.4);
}

/* ---------- Card design system ---------- */
const EP_FONT = '"Plus Jakarta Sans","Poppins","Inter",system-ui,-apple-system,"Segoe UI",sans-serif';
const EP_THEMES = {
  /* Palettes mirror the practice session (#epq): warm-grey / deep-green surfaces, teal gradient accent, square-rounded tiles */
  midnight: { label: 'Dark', swatch: ['#0c1211', '#2dd4bf'], bg: ['#040807', '#0c1614'], glow: [['#2dd4bf', .30], ['#6366f1', .20], ['#a3e635', .08]], dots: 'rgba(255,255,255,.04)', ink: '#e9f1ee', sub: '#92a29d', card: '#152120', cardLine: '#24312e', shadow: true, qInk: '#e9f1ee', oInk: '#e9f1ee', opt: '#101b1a', optLine: '#24312e', letter: '#0c1211', letterInk: '#92a29d', tileLine: '#34443f', chip: '#152120', chipLine: '#24312e', chipInk: '#c4d1cd', good: '#4ade80', goodFill: '#10301e', strip: '#152120', stripLine: '#24312e', stripInk: '#e9f1ee', stripSub: '#92a29d', cta: ['#06201e', '#0f766e'], subjOn: 0, acc: '#2dd4bf', acc2: '#5eead4' },
  aurora: { label: 'Aurora', swatch: ['#0d9488', '#4f46e5'], bg: ['#0d9488', '#312e81'], glow: [['#a3e635', .26], ['#6366f1', .45], ['#2dd4bf', .30]], dots: 'rgba(255,255,255,.07)', ink: '#ffffff', sub: 'rgba(255,255,255,.78)', card: '#ffffff', cardLine: 'rgba(255,255,255,.0)', shadow: true, qInk: '#101a18', oInk: '#101a18', opt: '#f6f8f6', optLine: '#e2e8e3', letter: '#ffffff', letterInk: '#5f6d69', tileLine: '#ccd5d0', chip: 'rgba(255,255,255,.16)', chipLine: 'rgba(255,255,255,.3)', chipInk: '#ffffff', good: '#15803d', goodFill: '#e6f5eb', strip: 'rgba(255,255,255,.14)', stripLine: 'rgba(255,255,255,.34)', stripInk: '#ffffff', stripSub: 'rgba(255,255,255,.86)', cta: ['#0b1226', '#111c3a'], subjOn: 1, acc: '#0f766e', acc2: '#14b8a6' },
  light: { label: 'Light', swatch: ['#f4f6f3', '#0f766e'], bg: ['#f7f9f6', '#e4ece8'], glow: [['#2dd4bf', .26], ['#818cf8', .18], ['#bef264', .26]], dots: 'rgba(16,26,24,.05)', ink: '#101a18', sub: '#5f6d69', card: '#ffffff', cardLine: '#e2e8e3', shadow: true, qInk: '#101a18', oInk: '#101a18', opt: '#fff', optLine: '#e2e8e3', letter: '#f4f6f3', letterInk: '#5f6d69', tileLine: '#ccd5d0', chip: '#ffffff', chipLine: '#e2e8e3', chipInk: '#5f6d69', good: '#15803d', goodFill: '#e6f5eb', strip: '#ffffff', stripLine: '#e2e8e3', stripInk: '#101a18', stripSub: '#5f6d69', cta: ['#0b3b37', '#0f766e'], subjOn: 2, acc: '#0f766e', acc2: '#14b8a6' }
};
const EP_SUBJ = { Physics: ['#38bdf8', '#0369a1'], Chemistry: ['#a78bfa', '#6d28d9'], Biology: ['#34d399', '#047857'], NEET: ['#2dd4bf', '#0f766e'] };
const EP_FORMATS = { post: { label: 'Post', ratio: '4:5', h: 1350 }, story: { label: 'Story', ratio: '9:16', h: 1920 }, auto: { label: 'Fit', ratio: 'auto', h: 0 } };
const EP_HOOKS = [['Can you crack', 'this one?'], ['Think you know', 'your NCERT?'], ['30 seconds.', 'Go!'], ['Test your', 'NEET instinct'], ['Easy or tricky?', 'You decide.']];
const epHexA = (hex, a) => { const h = hex.replace('#', ''); return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`; };

/* ---------- small vector icons (so the image never depends on emoji fonts) ---------- */
const EP_ICO = {
  check: (c, x, y, r, col) => { c.save(); c.strokeStyle = col; c.lineWidth = r * 0.3; c.lineCap = c.lineJoin = 'round'; c.beginPath(); c.moveTo(x - r * .5, y + r * .02); c.lineTo(x - r * .12, y + r * .4); c.lineTo(x + r * .52, y - r * .36); c.stroke(); c.restore(); },
  lock: (c, x, y, r, col) => { c.save(); c.fillStyle = col; c.strokeStyle = col; c.lineWidth = r * .24; c.lineCap = 'round'; epRoundRect(c, x - r * .55, y - r * .08, r * 1.1, r * .86, r * .18); c.fill(); c.beginPath(); c.arc(x, y - r * .1, r * .38, Math.PI, 0); c.stroke(); c.restore(); },
  flame: (c, x, y, r, col) => { c.save(); c.translate(x, y); c.scale(r, r); c.fillStyle = col; c.beginPath(); c.moveTo(0.05, -1); c.bezierCurveTo(.2, -.55, .78, -.2, .78, .3); c.bezierCurveTo(.78, .8, .42, 1, 0, 1); c.bezierCurveTo(-.42, 1, -.78, .8, -.78, .3); c.bezierCurveTo(-.78, 0, -.55, -.25, -.38, -.42); c.bezierCurveTo(-.36, -.12, -.2, 0, -.08, -.04); c.bezierCurveTo(-.3, -.5, -.1, -.8, .05, -1); c.closePath(); c.fill(); c.restore(); },
  spark: (c, x, y, r, col) => { c.save(); c.fillStyle = col; const k = .22; c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x + r * k, y - r * k, x + r, y); c.quadraticCurveTo(x + r * k, y + r * k, x, y + r); c.quadraticCurveTo(x - r * k, y + r * k, x - r, y); c.quadraticCurveTo(x - r * k, y - r * k, x, y - r); c.fill(); c.beginPath(); c.arc(x + r * .85, y - r * .85, r * .16, 0, 7); c.fill(); c.restore(); },
  doc: (c, x, y, r, col) => { c.save(); c.strokeStyle = col; c.lineWidth = r * .16; c.lineCap = 'round'; epRoundRect(c, x - r * .62, y - r * .8, r * 1.24, r * 1.6, r * .2); c.stroke(); [-.28, .04, .36].forEach((d, i) => { c.beginPath(); c.moveTo(x - r * .3, y + r * d); c.lineTo(x + r * (i === 2 ? .05 : .3), y + r * d); c.stroke(); }); c.restore(); },
  retry: (c, x, y, r, col) => { c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = r * .2; c.lineCap = 'round'; c.beginPath(); c.arc(x, y, r * .62, -Math.PI * .15, Math.PI * 1.45); c.stroke(); const a = -Math.PI * .15, px = x + Math.cos(a) * r * .62, py = y + Math.sin(a) * r * .62; c.beginPath(); c.moveTo(px + r * .34, py - r * .02); c.lineTo(px - r * .12, py - r * .3); c.lineTo(px - r * .1, py + r * .3); c.closePath(); c.fill(); c.restore(); },
  arrow: (c, x, y, r, col) => { c.save(); c.strokeStyle = col; c.lineWidth = r * .26; c.lineCap = c.lineJoin = 'round'; c.beginPath(); c.moveTo(x - r * .55, y); c.lineTo(x + r * .5, y); c.moveTo(x + r * .1, y - r * .42); c.lineTo(x + r * .54, y); c.lineTo(x + r * .1, y + r * .42); c.stroke(); c.restore(); },
  book: (c, x, y, r, col) => { c.save(); c.strokeStyle = col; c.lineWidth = r * .2; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x, y - r * .5); c.quadraticCurveTo(x - r * .5, y - r * .8, x - r * .95, y - r * .5); c.lineTo(x - r * .95, y + r * .6); c.quadraticCurveTo(x - r * .5, y + r * .3, x, y + r * .6); c.quadraticCurveTo(x + r * .5, y + r * .3, x + r * .95, y + r * .6); c.lineTo(x + r * .95, y - r * .5); c.quadraticCurveTo(x + r * .5, y - r * .8, x, y - r * .5); c.moveTo(x, y - r * .5); c.lineTo(x, y + r * .6); c.stroke(); c.restore(); }
};
// heartbeat motif (same shape as the app logo); y-offsets are fractions of `amp`
const EP_BEAT = [[0, 0], [90, 0], [112, -.18], [136, 0], [168, 0], [186, .25], [214, -1], [244, .8], [262, 0], [300, 0], [314, -.12], [328, 0], [360, 0]];
function epBeatPath(c, x0, x1, y, amp, period = 360) {
  c.beginPath(); let first = true;
  for (let b = x0; b < x1 + period; b += period) EP_BEAT.forEach(([dx, dy]) => { const px = b + dx * period / 360, py = y + dy * amp; if (first) { c.moveTo(px, py); first = false; } else c.lineTo(px, py); });
}

/* ---------- Pull out what the card needs from the question + caller meta ---------- */
function epCardInfo(q, meta) {
  const m = meta && typeof meta === 'object' ? meta : {};
  let subject = m.subject || '', chapter = m.chapter || '';
  if (typeof meta === 'string' && meta) { const parts = meta.split(' · '); subject = parts.length > 1 ? parts[0] : ''; chapter = parts.length > 1 ? parts.slice(1).join(' · ') : meta; }
  if (!chapter) chapter = q.sourceChapter || '';
  const blob = `${subject} ${chapter}`;
  const subj = /phys/i.test(blob) ? 'Physics' : /chem/i.test(blob) ? 'Chemistry' : /bio|botan|zoolog/i.test(blob) ? 'Biology' : (subject && !/^mixed$/i.test(subject) ? subject : '');
  chapter = String(chapter).replace(/^(physics|chemistry|biology|botany|zoology)\s*:\s*/i, '').trim();
  return { subject: subj, chapter, difficulty: String(q.difficulty || m.difficulty || '').trim(), year: q.year || m.year || '', exam: String(q.exam || m.exam || '').trim() };
}
const epDiffColor = d => /easy/i.test(d) ? '#34d399' : /hard|diff|tough/i.test(d) ? '#fb7185' : '#fbbf24';

/* ---------- Load the extras a question may need (figures, option images). Cached by the studio. ---------- */
async function epLoadAssets(q, noImages) {
  const A = { figs: [], opt: [], needFig: false, qr: epQR(EP_BRAND.qr || EP_BRAND.site) || epQR(EP_BRAND.site) };
  if (noImages) return A;
  const cap = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
  const toImg = url => url ? new Promise(res => { const im = new Image(); im.onload = () => res(im.naturalWidth ? im : null); im.onerror = () => res(null); im.src = url; }) : Promise.resolve(null);
  try {
    if (typeof epStemSlots === 'function' && typeof epTryLoad === 'function') {
      const slots = epStemSlots(q) || [];
      A.needFig = slots.length > 0 || !!q.needsImage;
      A.figs = await Promise.all(slots.map(async s => { for (const st of s.stems) { const u = await cap(epTryLoad(st), 3500); if (u) return toImg(u); } return null; }));
      const oi = q.optionImages || [];
      if (oi.some(Boolean)) {
        const base = typeof epCanonBase === 'function' ? epCanonBase(q) : '';
        A.opt = await Promise.all((q.options || []).map(async (_, i) => {
          if (!oi[i]) return null; const L = 'abcd'[i];
          for (const st of [base && `${base}-${L}`, oi[i], base && `${base}-opt-${L}`].filter(Boolean)) { const u = await cap(epTryLoad(st), 3000); if (u) return toImg(u); }
          return null;
        }));
      }
    } else A.needFig = !!q.needsImage;
  } catch (e) { /* cards still render without figures */ }
  return A;
}

/* ---------- The card ---------- */
function epRenderCard(q, info, o, A, px) {
  const W = 1080, P = 56, F = EP_FONT, th = EP_THEMES[o.theme] || EP_THEMES.midnight, ans = o.mode === 'answer';
  const mc = epRenderCard.mc || (epRenderCard.mc = document.createElement('canvas').getContext('2d'));
  const wrap = (font, text, w) => { mc.font = font; return epWrapText(mc, text, w); };
  const meas = (font, text) => { mc.font = font; return mc.measureText(text).width; };
  const fit = (font, text, w) => { mc.font = font; if (mc.measureText(text).width <= w) return text; let t = text; while (t.length > 1 && mc.measureText(t + '…').width > w) t = t.slice(0, -1); return t.trim() + '…'; };
  const stem = epPlain(q.question), opts = (q.options || []).map(epPlain);
  const correct = Number.isInteger(q.correct) ? q.correct : -1;
  const hasExpl = !!(q.explanation && !/^NCERT Concept\.?$/i.test(String(q.explanation).trim()));
  const fmt = EP_FORMATS[o.format] ? o.format : 'post', fixedH = EP_FORMATS[fmt].h;
  const subjKey = EP_SUBJ[info.subject] ? info.subject : 'NEET', subjCol = EP_SUBJ[subjKey];
  const hook = EP_HOOKS[[...stem].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % EP_HOOKS.length];
  const figs = (A.figs || []).filter(Boolean), tblSrc = q.table && Array.isArray(q.table.rows) && q.table.rows.length ? q.table : null;

  /* ---- 1. measure everything for a given text scale + footer style ---- */
  const plan = (sc, cta, maxL) => {
    const u = v => Math.round(v * sc);
    const pad = u(40), inW = W - 2 * P - 2 * pad, gapI = u(24), rowMin = u(76), rowGap = u(12);
    const qF = u(42), qLH = Math.round(qF * 1.38), oF = u(33), oLH = Math.round(oF * 1.34);
    const qLines = wrap(`700 ${qF}px ${F}`, stem, inW);
    // figures sit side by side on white panels (diagrams are drawn for white paper)
    let fig = null;
    if (figs.length) {
      const fp = 14, gap = 16, ars = figs.map(im => im.naturalWidth / im.naturalHeight), sum = ars.reduce((a, b) => a + b, 0);
      const h = Math.min(u(fmt === 'story' ? 460 : fmt === 'auto' ? 360 : 300), (inW - 2 * fp * figs.length - gap * (figs.length - 1)) / sum);
      fig = { fp, gap, h, ars, total: h + 2 * fp };
    }
    const needNote = A.needFig && (!figs.length || (A.figs || []).some(f => !f));
    const note = needNote ? { h: u(64) } : null;
    // optional table
    let tb = null;
    if (tblSrc) {
      const f = u(27), lh = Math.round(f * 1.3), cp = u(12), hasH = (tblSrc.headers || []).length > 0;
      const rows = [hasH ? tblSrc.headers : null, ...tblSrc.rows].filter(Boolean).map(r => r.map(epPlain));
      const nc = Math.max(...rows.map(r => r.length));
      let cw = Array.from({ length: nc }, (_, c) => Math.max(70, ...rows.map(r => Math.min(inW * .6, meas(`700 ${f}px ${F}`, r[c] || '') + 2 * cp))));
      const tot = cw.reduce((a, b) => a + b, 0); cw = cw.map(w => w * inW / tot);
      const cells = rows.map((r, ri) => { const font = `${hasH && ri === 0 ? 800 : 600} ${f}px ${F}`; const ls = cw.map((w, c) => wrap(font, r[c] || '', w - 2 * cp)); return { ls, font, h: Math.max(...ls.map(l => l.length)) * lh + 2 * cp }; });
      tb = { f, lh, cp, cw, cells, hasH, h: cells.reduce((a, c) => a + c.h, 0) };
    }
    // options
    const rowPad = u(14), letterR = u(30), optW = inW - 2 * rowPad - 2 * letterR - u(22);
    const rows = opts.map((t, i) => {
      const lines = t ? wrap(`600 ${oF}px ${F}`, t, optW) : [];
      const im = A.opt && A.opt[i]; let iw = 0, ih = 0;
      if (im) { const s = Math.min(optW * .8 / im.naturalWidth, u(150) / im.naturalHeight, 1.6); iw = im.naturalWidth * s; ih = im.naturalHeight * s; }
      const textH = lines.length * oLH;
      return { lines, im, iw, ih, h: Math.max(rowMin, textH + u(34)) + (ih ? ih + u(26) : 0), textH };
    });
    const optsH = rows.reduce((a, r) => a + r.h, 0) + rowGap * Math.max(0, rows.length - 1);
    const eyH = u(58), cardH = pad + eyH + qLines.length * qLH + (fig ? gapI + fig.total : 0) + (note ? u(14) + note.h : 0) + (tb ? gapI + tb.h : 0) + gapI + optsH + pad;
    // what sits under the card: teaser (challenge) or the explanation (answer)
    let ex = null;
    if (ans) {
      const f = u(29), lh = Math.round(f * 1.42), ip = u(34);
      if (hasExpl) { let ls = wrap(`500 ${f}px ${F}`, epPlain(q.explanation), W - 2 * P - 2 * ip); if (ls.length > maxL) { ls = ls.slice(0, maxL); ls[maxL - 1] = ls[maxL - 1].replace(/[\s.,;:!?\-–]+$/, '') + '…'; } ex = { f, lh, ls, ip, h: u(26) + u(58) + ls.length * lh + u(26) }; }
    }
    const stripH = ans && ex ? ex.h : u(98);
    const ctaH = cta === 'rich' ? 664 : 266, gap = 26, blipRoom = 32;
    const it = fmt === 'story' ? 88 : 0, ib = fmt === 'story' ? 130 : 0;   // Story UI covers the top and bottom of the frame: keep the logo and QR clear of it
    const head = 136, hookH = fmt === 'story' ? 196 : 170;
    const total = it + head + hookH + cardH + gap + stripH + gap + blipRoom + ctaH + ib;
    return { sc, u, it, ib, cta, rowMin, rowGap, maxL, pad, inW, gapI, qF, qLH, oF, oLH, qLines, fig, note, tb, rows, rowPad, letterR, cardH, eyH, ex, stripH, ctaH, gap, blipRoom, head, hookH, total };
  };

  /* ---- 2. pick the biggest text size that fits the chosen format (or grow the card if it can't) ---- */
  let pl;
  const caps = fmt === 'story' ? [14, 10, 6] : [6, 4, 3], top0 = fmt === 'story' ? 1.12 : 1.0;
  if (fixedH) {
    const cands = [];
    if (fmt === 'story') [1.04, .96, .9, .86].forEach(s => cands.push([s, 'rich', caps[s > .9 ? 0 : 1]]));
    for (let s = top0; s >= .78; s -= .04) caps.forEach((c, ci) => { if (s >= .88 ? ci < 2 : true) cands.push([+s.toFixed(2), 'compact', c]); });
    for (const [s, c, m] of cands) { const p = plan(s, c, m); if (p.total <= fixedH) { pl = p; break; } }
    if (!pl) pl = plan(.8, 'compact', fmt === 'story' ? 8 : 5);   // too long for the frame: let the card grow instead of shrinking the text
  } else pl = plan(1, 'compact', 6);
  const H = Math.max(fixedH, pl.total), extra = H - pl.total;
  const pxs = typeof px === 'function' ? px(H) : px;
  const cv = document.createElement('canvas'); cv.width = Math.round(W * pxs); cv.height = Math.round(H * pxs);
  const ctx = cv.getContext('2d'); ctx.scale(pxs, pxs); ctx.textBaseline = 'alphabetic';
  const T = (s, x, y, font, fill, al = 'left') => { ctx.font = font; ctx.fillStyle = fill; ctx.textAlign = al; ctx.fillText(s, x, y); ctx.textAlign = 'left'; };

  /* ---- 3. background: gradient + aurora glows + dot grid + faint heartbeat watermark ---- */
  let g = ctx.createLinearGradient(0, 0, W * .4, H); g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  [[W * .08, 150, 640], [W * 1.0, H * .48, 720], [W * .15, H * .9, 520]].forEach(([x, y, r], i) => { const rg = ctx.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, epHexA(th.glow[i][0], th.glow[i][1])); rg.addColorStop(1, epHexA(th.glow[i][0], 0)); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H); });
  ctx.fillStyle = th.dots; for (let y = 22; y < H; y += 40) for (let x = 22; x < W; x += 40) { ctx.beginPath(); ctx.arc(x, y, 1.7, 0, 7); ctx.fill(); }
  ctx.save(); ctx.strokeStyle = o.theme === 'light' ? 'rgba(13,148,136,.07)' : 'rgba(255,255,255,.04)'; ctx.lineWidth = 12; ctx.lineJoin = ctx.lineCap = 'round'; epBeatPath(ctx, -140, W, H * .5, 280, 720); ctx.stroke(); ctx.restore();

  /* ---- 4. header: logo, wordmark, subject pill ---- */
  ctx.save(); ctx.translate(0, pl.it - 6);
  epDrawMark(ctx, P, 44, 78);
  const wmX = P + 98; ctx.font = `800 46px ${F}`; ctx.fillStyle = o.theme === 'light' ? '#0f172a' : '#f8fafc';
  ctx.fillText('Edu', wmX, 92); const eW = ctx.measureText('Edu').width; ctx.fillStyle = o.theme === 'light' ? '#0d9488' : '#2dd4bf'; ctx.fillText('Pulse', wmX + eW, 92);
  const pW = ctx.measureText('Pulse').width; epRoundRect(ctx, wmX + eW + pW + 14, 58, 62, 32, 16); ctx.fillStyle = '#a3e635'; ctx.fill();
  T('PRO', wmX + eW + pW + 14 + 31, 81, `800 18px ${F}`, '#1a2e05', 'center');
  T(EP_BRAND.motto, wmX, 122, `600 22px ${F}`, th.sub);
  { const label = (info.subject || 'NEET').toUpperCase(), font = `800 24px ${F}`, w = meas(font, label) + 64, x = W - P - w, on = th.subjOn;
    epRoundRect(ctx, x, 62, w, 54, 27); ctx.fillStyle = on === 1 ? 'rgba(255,255,255,.95)' : on === 2 ? epHexA(subjCol[0], .16) : epHexA(subjCol[0], .16); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = on === 1 ? 'rgba(255,255,255,0)' : epHexA(subjCol[0], .55); ctx.stroke();
    ctx.fillStyle = on === 1 ? subjCol[1] : on === 2 ? subjCol[1] : subjCol[0]; ctx.beginPath(); ctx.arc(x + 28, 89, 7, 0, 7); ctx.fill();
    T(label, x + 46, 98, font, on === 0 ? subjCol[0] : subjCol[1]); }

  /* ---- 5. hook: the headline + a timer ring (challenge) or answer badge, then meta chips ---- */
  { const hs = fmt === 'story' ? 72 : 60, hy = pl.head + hs, maxW = W - 2 * P - 150;
    const lead = ans ? 'The answer is' : hook[0], acc = ans ? (correct >= 0 ? `Option ${String.fromCharCode(65 + correct)}` : 'revealed') : hook[1];
    let f = hs; const lw = () => meas(`800 ${f}px ${F}`, lead + ' ') + meas(`800 ${f}px ${F}`, acc); while (lw() > maxW && f > 38) f -= 2;
    ctx.font = `800 ${f}px ${F}`; const leadW = ctx.measureText(lead + ' ').width, accW = ctx.measureText(acc).width;
    ctx.fillStyle = th.ink; ctx.fillText(lead + ' ', P, hy);
    const ag = ctx.createLinearGradient(P + leadW, 0, P + leadW + accW, 0); if (ans) { ag.addColorStop(0, th.good === '#059669' && o.theme !== 'light' ? '#a7f3d0' : th.good); ag.addColorStop(1, o.theme === 'light' ? '#059669' : '#a3e635'); } else { ag.addColorStop(0, o.theme === 'light' ? '#0d9488' : '#5eead4'); ag.addColorStop(1, o.theme === 'light' ? '#4f46e5' : '#bef264'); }
    ctx.fillStyle = ag; ctx.fillText(acc, P + leadW, hy);
    // ring
    const rx = W - P - 58, ry = pl.head + hs * .5 + 8;
    if (ans) { ctx.fillStyle = epHexA('#10b981', .2); ctx.beginPath(); ctx.arc(rx, ry, 58, 0, 7); ctx.fill(); ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.arc(rx, ry, 44, 0, 7); ctx.fill(); EP_ICO.check(ctx, rx, ry, 30, '#fff'); }
    else { ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.strokeStyle = o.theme === 'light' ? 'rgba(15,23,42,.1)' : 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.arc(rx, ry, 48, 0, 7); ctx.stroke();
      const rg = ctx.createLinearGradient(rx - 48, ry - 48, rx + 48, ry + 48); rg.addColorStop(0, '#2dd4bf'); rg.addColorStop(1, '#a3e635'); ctx.strokeStyle = rg; ctx.beginPath(); ctx.arc(rx, ry, 48, -Math.PI / 2, Math.PI * 1.0); ctx.stroke();
      T('30', rx, ry + 12, `800 38px ${F}`, th.ink, 'center'); T('SEC', rx, ry + 34, `700 15px ${F}`, th.sub, 'center'); }
    // chips
    let cx = P; const cy = hy + 28, chH = 46, limit = W - P;
    const chip = (label, { dot, icon, tint } = {}) => {
      const font = `700 22px ${F}`, lead = (dot || icon) ? 22 : 0, maxLab = Math.min(430, limit - cx - 36 - lead - 6); if (maxLab < 60) return;
      label = fit(font, label, maxLab); const w = meas(font, label) + 36 + lead;
      epRoundRect(ctx, cx, cy, w, chH, chH / 2); ctx.fillStyle = tint ? epHexA(tint, o.theme === 'light' ? .14 : .16) : th.chip; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = tint ? epHexA(tint, .5) : th.chipLine; ctx.stroke();
      let tx = cx + 18;
      if (dot) { ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(tx + 7, cy + chH / 2, 7, 0, 7); ctx.fill(); tx += lead; }
      if (icon) { icon(ctx, tx + 8, cy + chH / 2, 11); tx += lead; }
      T(label, tx, cy + 31, font, th.chipInk); cx += w + 12;
    };
    if (o.streak > 0) chip(`${o.streak}-day streak`, { icon: (c, x, y, r) => EP_ICO.flame(c, x, y, r, '#f59e0b'), tint: '#f59e0b' });
    if (info.year) chip(`${info.exam || 'NEET'} ${info.year}`, { tint: o.theme === 'light' ? '#4f46e5' : '#a5b4fc' });
    if (info.difficulty && info.difficulty !== '?') chip(info.difficulty, { dot: epDiffColor(info.difficulty) });
    if (info.chapter) chip(info.chapter, { icon: (c, x, y, r) => EP_ICO.book(c, x, y, r * .8, o.theme === 'light' ? '#475569' : '#94a3b8') });
  }

  ctx.restore();

  /* ---- 6. question card ---- */
  const top = pl.it + pl.head + pl.hookH + extra / 2, cX = P, cW = W - 2 * P, u = pl.u;
  ctx.save(); if (th.shadow) { ctx.shadowColor = o.theme === 'light' ? 'rgba(15,23,42,.14)' : 'rgba(2,6,23,.4)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18; }
  epRoundRect(ctx, cX, top, cW, pl.cardH, 44); ctx.fillStyle = th.card; ctx.fill(); ctx.restore();
  if (th.cardLine && th.cardLine !== 'rgba(255,255,255,.0)') { epRoundRect(ctx, cX, top, cW, pl.cardH, 44); ctx.lineWidth = 2; ctx.strokeStyle = th.cardLine; ctx.stroke(); }
  { // practice-session header: gradient progress bar, eyebrow, palette tiles
    ctx.save(); epRoundRect(ctx, cX, top, cW, pl.cardH, 44); ctx.clip();
    ctx.fillStyle = o.theme === 'midnight' ? 'rgba(255,255,255,.08)' : 'rgba(16,26,24,.07)'; ctx.fillRect(cX, top, cW, 9);
    const pg = ctx.createLinearGradient(cX, 0, cX + cW * .62, 0); pg.addColorStop(0, th.acc); pg.addColorStop(1, th.acc2); ctx.fillStyle = pg; ctx.fillRect(cX, top, cW * .62, 9); ctx.restore();
    const hcy = top + u(54), ex0 = cX + pl.pad, eb = `${ans ? 'ANSWER' : 'QUESTION'} · ${(info.subject || 'NEET').toUpperCase()}`;
    epRoundRect(ctx, ex0, hcy - 5, 10, 10, 2.5); ctx.fillStyle = th.acc; ctx.fill();
    T(eb, ex0 + 24, hcy + 8, `800 ${u(23)}px ${F}`, th.acc);
    const ps = u(32), pgp = u(8), pn = 5, px0 = cX + cW - pl.pad - (pn * ps + (pn - 1) * pgp);
    for (let i = 0; i < pn; i++) { const x = px0 + i * (ps + pgp), yy = hcy - ps / 2; epRoundRect(ctx, x, yy, ps, ps, u(9));
      if (i === 2) { const cg2 = ctx.createLinearGradient(x, yy, x + ps, yy + ps); cg2.addColorStop(0, ans ? th.good : th.acc); cg2.addColorStop(1, ans ? th.good : th.acc2); ctx.fillStyle = cg2; ctx.fill(); }
      else if (i < 2) { ctx.fillStyle = th.goodFill; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = th.good; ctx.stroke(); }
      else { ctx.fillStyle = th.letter; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = th.tileLine; ctx.stroke(); } }
  }
  let y = top + pl.pad + pl.eyH; const ix = cX + pl.pad;
  pl.qLines.forEach((l, i) => T(l, ix, y + pl.qF + i * pl.qLH - 4, `700 ${pl.qF}px ${F}`, th.qInk)); y += pl.qLines.length * pl.qLH;
  if (pl.fig) { y += pl.gapI; const fw = figs.reduce((a, im, i) => a + pl.fig.ars[i] * pl.fig.h + 2 * pl.fig.fp, 0) + pl.fig.gap * (figs.length - 1); let fx = ix + Math.max(0, (pl.inW - fw) / 2); figs.forEach((im, i) => { const w = pl.fig.ars[i] * pl.fig.h; epRoundRect(ctx, fx, y, w + 2 * pl.fig.fp, pl.fig.total, 18); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = o.theme === 'midnight' ? 'rgba(255,255,255,.25)' : '#e2e8f0'; ctx.stroke(); ctx.drawImage(im, fx + pl.fig.fp, y + pl.fig.fp, w, pl.fig.h); fx += w + 2 * pl.fig.fp + pl.fig.gap; }); y += pl.fig.total; }
  if (pl.note) { y += u(14); epRoundRect(ctx, ix, y, pl.inW, pl.note.h, 18); ctx.fillStyle = 'rgba(245,158,11,.14)'; ctx.fill(); ctx.setLineDash([8, 6]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(245,158,11,.6)'; ctx.stroke(); ctx.setLineDash([]); T(fit(`700 ${u(25)}px ${F}`, 'This question has a diagram. Open it in EduPulse to see it.', pl.inW - 40), ix + 24, y + pl.note.h / 2 + u(9), `700 ${u(25)}px ${F}`, o.theme === 'light' ? '#b45309' : '#fbbf24'); y += pl.note.h; }
  if (pl.tb) { y += pl.gapI; const t = pl.tb; epRoundRect(ctx, ix, y, pl.inW, t.h, 16); ctx.save(); ctx.clip(); ctx.fillStyle = o.theme === 'midnight' ? 'rgba(255,255,255,.04)' : '#fff'; ctx.fillRect(ix, y, pl.inW, t.h);
    let ty = y; t.cells.forEach((row, ri) => { if (t.hasH && ri === 0) { ctx.fillStyle = o.theme === 'midnight' ? 'rgba(45,212,191,.18)' : '#ccfbf1'; ctx.fillRect(ix, ty, pl.inW, row.h); } else if (ri % 2 === 0) { ctx.fillStyle = o.theme === 'midnight' ? 'rgba(255,255,255,.04)' : '#f8fafc'; ctx.fillRect(ix, ty, pl.inW, row.h); }
      let tx = ix; row.ls.forEach((ls, c) => { ls.forEach((l, k) => T(l, tx + t.cp, ty + t.cp + t.f + k * t.lh - 4, row.font, th.oInk)); tx += t.cw[c]; });
      ctx.strokeStyle = th.optLine; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ix, ty + row.h); ctx.lineTo(ix + pl.inW, ty + row.h); ctx.stroke(); ty += row.h; });
    let vx = ix; t.cw.slice(0, -1).forEach(w => { vx += w; ctx.beginPath(); ctx.moveTo(vx, y); ctx.lineTo(vx, y + t.h); ctx.stroke(); }); ctx.restore(); epRoundRect(ctx, ix, y, pl.inW, t.h, 16); ctx.lineWidth = 2; ctx.strokeStyle = th.optLine; ctx.stroke(); y += t.h; }
  y += pl.gapI;
  pl.rows.forEach((r, i) => {
    const isC = ans && i === correct, dim = ans && correct >= 0 && !isC;
    ctx.save(); if (dim) ctx.globalAlpha = .62;
    epRoundRect(ctx, ix, y, pl.inW, r.h, 22); ctx.fillStyle = isC ? th.goodFill : th.opt; ctx.fill(); ctx.lineWidth = isC ? 3.5 : 2; ctx.strokeStyle = isC ? th.good : th.optLine; ctx.stroke();
    const lx = ix + pl.rowPad + pl.letterR, ly = y + Math.max(pl.rowMin, r.textH + u(34)) / 2;
    epRoundRect(ctx, lx - pl.letterR, ly - pl.letterR, pl.letterR * 2, pl.letterR * 2, u(16)); ctx.fillStyle = isC ? th.good : th.letter; ctx.fill(); if (!isC) { ctx.lineWidth = 2; ctx.strokeStyle = th.tileLine; ctx.stroke(); }
    if (isC) EP_ICO.check(ctx, lx, ly, pl.letterR * .78, o.theme === 'midnight' ? '#04100a' : '#fff'); else T(String.fromCharCode(65 + i), lx, ly + u(11), `800 ${u(30)}px ${F}`, th.letterInk, 'center');
    const tx = lx + pl.letterR + u(22), th0 = ly - r.lines.length * pl.oLH / 2 + pl.oF * .86;
    r.lines.forEach((l, k) => T(l, tx, th0 + k * pl.oLH, `${isC ? 700 : 600} ${pl.oF}px ${F}`, th.oInk));
    if (r.im) { const iy = y + Math.max(pl.rowMin, r.textH + u(34)) + u(2); epRoundRect(ctx, tx - 6, iy - 6, r.iw + 12, r.ih + 12, 12); ctx.fillStyle = '#fff'; ctx.fill(); ctx.drawImage(r.im, tx, iy, r.iw, r.ih); }
    ctx.restore(); y += r.h + pl.rowGap;
  });

  /* ---- 7. under the card: teaser (challenge) / explanation (answer) ---- */
  let sy = top + pl.cardH + pl.gap;
  const sx = P, sw = W - 2 * P;
  if (ans && pl.ex) {
    const e = pl.ex, cu = pl.u; epRoundRect(ctx, sx, sy, sw, e.h, 32); ctx.fillStyle = th.card; ctx.fill();
    if (th.cardLine && th.cardLine !== 'rgba(255,255,255,.0)') { ctx.lineWidth = 2; ctx.strokeStyle = th.cardLine; ctx.stroke(); }
    ctx.save(); epRoundRect(ctx, sx, sy, sw, e.h, 32); ctx.clip(); ctx.fillStyle = th.good; ctx.fillRect(sx, sy, 10, e.h); ctx.restore();
    const isz = cu(42), ix0 = sx + e.ip, iy0 = sy + cu(22); epRoundRect(ctx, ix0, iy0, isz, isz, 12); ctx.fillStyle = th.good; ctx.fill(); EP_ICO.spark(ctx, ix0 + isz / 2, iy0 + isz / 2, isz * .3, o.theme === 'midnight' ? '#04100a' : '#fff');
    T('Why it’s right', ix0 + isz + 16, iy0 + isz / 2 + cu(10), `800 ${cu(29)}px ${F}`, th.good);
    e.ls.forEach((l, i) => T(l, sx + e.ip, sy + cu(26) + cu(58) + e.f + i * e.lh - 4, `500 ${e.f}px ${F}`, th.oInk));
  } else {
    const h = pl.stripH; epRoundRect(ctx, sx, sy, sw, h, 32); ctx.fillStyle = th.strip; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = th.stripLine; ctx.stroke();
    ctx.save(); epRoundRect(ctx, sx, sy, sw, h, 32); ctx.clip(); ctx.fillStyle = ans ? th.good : '#a3e635'; ctx.fillRect(sx, sy, 10, h); ctx.restore();
    const ir = Math.round(h * .31), icx = sx + 40 + ir, icy = sy + h / 2; epRoundRect(ctx, icx - ir, icy - ir, ir * 2, ir * 2, ir * .5);
    const ig = ctx.createLinearGradient(icx - ir, icy - ir, icx + ir, icy + ir); ig.addColorStop(0, ans ? th.good : '#d9f99d'); ig.addColorStop(1, ans ? th.good : '#a3e635'); ctx.fillStyle = ig; ctx.fill();
    if (ans) EP_ICO.spark(ctx, icx, icy, ir * .62, '#fff'); else EP_ICO.lock(ctx, icx, icy + 2, ir * .62, '#1a2e05');
    const tx = icx + ir + 24, tw = sw - (tx - sx) - 30, a1 = ans ? 'Want the full explanation?' : 'Think you’ve got it?', a2 = ans ? 'Pulse AI explains any question instantly. Free.' : 'Scan to check your answer + get an instant AI explanation';
    T(a1, tx, icy - 5, `800 ${pl.u(30)}px ${F}`, th.stripInk); T(fit(`600 ${pl.u(24)}px ${F}`, a2, tw), tx, icy + pl.u(28), `600 ${pl.u(24)}px ${F}`, th.stripSub);
  }

  /* ---- 8. the ad: footer panel with a heartbeat blip, headline, value props, URL pill and QR ---- */
  const ctaTop = H - pl.ctaH - pl.ib, rich = pl.cta === 'rich';
  { const R = 58; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, ctaTop + R); ctx.arcTo(0, ctaTop, R, ctaTop, R); ctx.lineTo(W - R, ctaTop); ctx.arcTo(W, ctaTop, W, ctaTop + R, R); ctx.lineTo(W, H); ctx.closePath();
    const cg = ctx.createLinearGradient(0, ctaTop, W, H); cg.addColorStop(0, th.cta[0]); cg.addColorStop(1, th.cta[1]); ctx.save(); ctx.shadowColor = 'rgba(2,6,23,.35)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = -10; ctx.fillStyle = cg; ctx.fill(); ctx.restore();
    ctx.save(); ctx.clip(); const rg = ctx.createRadialGradient(W * .9, ctaTop, 0, W * .9, ctaTop, 520); rg.addColorStop(0, 'rgba(255,255,255,.18)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = rg; ctx.fillRect(0, ctaTop, W, H - ctaTop);
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 8; ctx.lineJoin = ctx.lineCap = 'round'; epBeatPath(ctx, -80, W, H - 30, 150, 600); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.lineWidth = 2.5; const hg = ctx.createLinearGradient(0, 0, W, 0); hg.addColorStop(0, 'rgba(190,242,100,0)'); hg.addColorStop(.5, 'rgba(190,242,100,.95)'); hg.addColorStop(1, 'rgba(190,242,100,0)'); ctx.strokeStyle = hg; ctx.beginPath(); ctx.moveTo(R, ctaTop + 1.5); ctx.lineTo(W - R, ctaTop + 1.5); ctx.stroke(); ctx.restore(); }
  // the blip that "pops" out of the panel edge
  ctx.save(); ctx.lineWidth = 7; ctx.lineJoin = ctx.lineCap = 'round'; ctx.strokeStyle = '#a3e635'; ctx.shadowColor = 'rgba(163,230,53,.7)'; ctx.shadowBlur = 16;
  ctx.beginPath(); const bx = W * .5 - 20; ctx.moveTo(bx - 130, ctaTop + 1); ctx.lineTo(bx - 70, ctaTop + 1); ctx.lineTo(bx - 48, ctaTop - 10); ctx.lineTo(bx - 24, ctaTop + 1); ctx.lineTo(bx + 6, ctaTop + 1); ctx.lineTo(bx + 26, ctaTop + 14); ctx.lineTo(bx + 56, ctaTop - 36); ctx.lineTo(bx + 84, ctaTop + 28); ctx.lineTo(bx + 104, ctaTop + 1); ctx.lineTo(bx + 170, ctaTop + 1); ctx.stroke(); ctx.restore();
  const qrTile = (x, yy, s) => { ctx.save(); ctx.shadowColor = 'rgba(2,6,23,.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8; epRoundRect(ctx, x, yy, s, s, 26); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore(); epRoundRect(ctx, x - 6, yy - 6, s + 12, s + 12, 31); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(190,242,100,.85)'; ctx.stroke();
    if (A.qr) { const qp = Math.round(s * .09), cell = Math.floor((s - 2 * qp) / A.qr.n), qs = cell * A.qr.n, off = (s - qs) / 2; epDrawQR(ctx, A.qr, x + off, yy + off, qs, '#0f172a'); } };
  const urlPill = (x, yy, h) => { const font = `800 ${Math.round(h * .46)}px ${F}`, tw = meas(font, EP_BRAND.label), w = tw + h * .5 + h * .95;
    epRoundRect(ctx, x, yy, w, h, h / 2); const pgd = ctx.createLinearGradient(x, yy, x + w, yy); pgd.addColorStop(0, '#d9f99d'); pgd.addColorStop(1, '#a3e635'); ctx.save(); ctx.shadowColor = 'rgba(163,230,53,.45)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6; ctx.fillStyle = pgd; ctx.fill(); ctx.restore(); T(EP_BRAND.label, x + h * .5, yy + h / 2 + h * .16, font, '#0b2f2b'); const ar = h * .34, ax = x + w - h * .5 + 2; ctx.beginPath(); ctx.arc(ax, yy + h / 2, ar, 0, 7); ctx.fillStyle = '#0b2f2b'; ctx.fill(); EP_ICO.arrow(ctx, ax, yy + h / 2, ar * .62, '#bef264'); return w; };
  const hl = (x, yy, size) => { ctx.font = `800 ${size}px ${F}`; const t1 = 'Practice more ', w1 = ctx.measureText(t1).width, t2 = 'NEET MCQs', w2 = ctx.measureText(t2).width; ctx.fillStyle = '#fff'; ctx.fillText(t1, x, yy); const gg = ctx.createLinearGradient(x + w1, 0, x + w1 + w2, 0); gg.addColorStop(0, '#d9f99d'); gg.addColorStop(1, '#a3e635'); ctx.fillStyle = gg; ctx.fillText(t2, x + w1, yy); };
  if (!rich) {
    const qs = 178, qx = W - P - qs, qy = ctaTop + 34;
    hl(P, ctaTop + 84, 48);
    T('Free · Instant AI explanations · Mock tests', P, ctaTop + 130, `600 27px ${F}`, 'rgba(255,255,255,.88)');
    urlPill(P, ctaTop + 164, 70);
    qrTile(qx, qy, qs); T('SCAN TO START', qx + qs / 2, qy + qs + 30, `800 17px ${F}`, 'rgba(255,255,255,.92)', 'center');
  } else {
    hl(P, ctaTop + 92, 58);
    T('Free · Instant AI explanations · Mock tests', P, ctaTop + 140, `600 29px ${F}`, 'rgba(255,255,255,.88)');
    const tiles = [['Pulse AI tutor', 'Explains any question instantly', EP_ICO.spark], ['Mock tests', 'Full NEET-style papers', EP_ICO.doc], ['Mistake notebook', 'Retry what you got wrong', EP_ICO.retry], ['Streaks & goals', 'Build a daily habit', EP_ICO.flame]];
    const tw = (W - 2 * P - 18) / 2, th2 = 120;
    tiles.forEach(([t, s, ico], i) => { const x = P + (i % 2) * (tw + 18), yy = ctaTop + 184 + Math.floor(i / 2) * (th2 + 18);
      epRoundRect(ctx, x, yy, tw, th2, 28); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.24)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 20 + 34, yy + th2 / 2, 34, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill(); ico(ctx, x + 54, yy + th2 / 2, 19, i === 3 ? '#fbbf24' : '#fff');
      T(t, x + 110, yy + th2 / 2 - 4, `800 30px ${F}`, '#fff'); T(fit(`500 22px ${F}`, s, tw - 126), x + 110, yy + th2 / 2 + 28, `500 22px ${F}`, 'rgba(255,255,255,.85)'); });
    const by = ctaTop + 184 + 2 * (th2 + 18) + 8, qs = 150;
    urlPill(P, by + 14, 84); T('Works on any phone or laptop', P + 6, by + 140, `600 24px ${F}`, 'rgba(255,255,255,.82)');
    qrTile(W - P - qs, by - 6, qs); T('SCAN TO START', W - P - qs / 2, by + qs + 22, `800 15px ${F}`, 'rgba(255,255,255,.92)', 'center');
  }
  cv._plan = { H, W, scale: pl.sc, cta: pl.cta, grew: !!fixedH && pl.total > fixedH };
  return cv;
}

/* ---------- Caption that travels with the image (WhatsApp / Telegram use it as the message) ---------- */
function epShareCaption(q, info, o) {
  const subj = info.subject || 'NEET', L = Number.isInteger(q.correct) && q.correct >= 0 ? String.fromCharCode(65 + q.correct) : '';
  const tags = ['#NEET', '#NEETPrep', '#NEETUG', info.subject ? '#' + info.subject : '', '#EduPulse'].filter(Boolean).join(' ');
  const ch = info.chapter ? `\n${info.chapter}` : '';
  return o.mode === 'answer'
    ? `✅ ${subj === 'NEET' ? 'NEET' : 'NEET ' + subj} question${L ? ` · Answer: (${L})` : ''}${ch}\n\nGet instant AI explanations and free mock tests on EduPulse — ${EP_BRAND.motto}\n${EP_BRAND.site}\n\n${tags}`
    : `🧠 Can you crack this ${subj === 'NEET' ? 'NEET' : 'NEET ' + subj} question?${ch}\n\nDrop your answer 👇 then check it (with an instant AI explanation) on EduPulse — free:\n${EP_BRAND.site}\n\n${tags}`;
}

/* ---------- Export ---------- */
async function epCardBlob(q, info, o, A) {
  const px = H => (H > 1500 ? 1.5 : 2);
  const toBlob = c => new Promise((res, rej) => { try { c.toBlob(b => (b ? res(b) : rej(new Error('Could not create the image.'))), 'image/png'); } catch (e) { rej(e); } });
  try { return { blob: await toBlob(epRenderCard(q, info, o, A, px)), tainted: false }; }
  catch (e) { // a cross-origin figure taints the canvas — fall back to a card without images rather than failing
    if (e && e.name === 'SecurityError') { const A2 = await epLoadAssets(q, true); return { blob: await toBlob(epRenderCard(q, info, o, A2, px)), tainted: true }; }
    throw e;
  }
}

/* ---------- Share Studio ---------- */
const EP_SS_PREFS = 'edupulse_share_prefs_v1';
function epStreakDays() {
  try {
    const s = StorageModule.get(STORAGE_KEYS.streak, null); if (!s || !s.current) return 0;
    const iso = d => new Date(d).toISOString().split('T')[0];
    return (s.lastActiveDate === iso(Date.now()) || s.lastActiveDate === iso(Date.now() - 86400000)) ? s.current : 0;
  } catch (e) { return 0; }
}
function epShareStudio(q, info) {
  document.getElementById('epss')?.remove();
  let prefs = {}; try { prefs = JSON.parse(localStorage.getItem(EP_SS_PREFS) || '{}'); } catch (e) {}
  const streakN = epStreakDays();
  const st = { mode: 'challenge', format: EP_FORMATS[prefs.format] ? prefs.format : 'post', theme: EP_THEMES[prefs.theme] ? prefs.theme : 'midnight', streak: streakN >= 2 && prefs.streak !== false, A: null, token: 0, blob: null, blobKey: '', blobP: null, tainted: false };
  const prevFocus = document.activeElement, htmlOv = document.documentElement.style.overflow;
  const I = {
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    share: '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
    dl: '<svg viewBox="0 0 24 24"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14"/></svg>',
    img: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
    txt: '<svg viewBox="0 0 24 24"><path d="M5 6h14M5 12h14M5 18h9"/></svg>',
    q: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/></svg>',
    ok: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/></svg>',
    fl: '<svg viewBox="0 0 24 24"><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4.2.2 1.4 1 2 1.8 2C10.5 8 11 5.5 12 3z"/></svg>'
  };
  const root = document.createElement('div'); root.id = 'epss'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Share as image');
  const seg = (k, items) => `<div class="epss-seg" role="radiogroup" data-k="${k}">${items.map(([v, label, ico]) => `<button type="button" role="radio" data-v="${v}" aria-checked="false">${ico || ''}<span>${label}</span></button>`).join('')}</div>`;
  root.innerHTML = `<div class="epss-bd" data-close></div>
  <div class="epss-sheet">
    <div class="epss-head"><div><div class="epss-title">Share as image</div><div class="epss-sub">A card your friends can’t scroll past.</div></div><button type="button" class="epss-x" data-close aria-label="Close">${I.x}</button></div>
    <div class="epss-body">
      <div class="epss-stage"><div class="epss-frame" id="epss-frame"><div class="epss-skel"><i></i><span>Designing your card…</span></div></div><div class="epss-dim" id="epss-dim">&nbsp;</div></div>
      <div class="epss-side">
        <div class="epss-lbl">Card type</div>${seg('mode', [['challenge', 'Challenge', I.q], ['answer', 'With answer', I.ok]])}
        <div class="epss-lbl">Format</div>${seg('format', Object.entries(EP_FORMATS).map(([v, f]) => [v, `${f.label}<small>${f.ratio}</small>`]))}
        <div class="epss-lbl">Theme</div>
        <div class="epss-themes" role="radiogroup" data-k="theme">${Object.entries(EP_THEMES).map(([v, t]) => `<button type="button" role="radio" data-v="${v}" aria-checked="false"><span class="epss-sw" style="background:linear-gradient(135deg,${t.swatch[0]},${t.swatch[1]})"></span><span>${t.label}</span></button>`).join('')}</div>
        ${streakN >= 2 ? `<button type="button" class="epss-tog" id="epss-streak" role="switch" aria-checked="false"><span class="epss-tg"></span><span class="epss-tl">${I.fl}<b>Show my ${streakN}-day streak</b><small>Social proof that you actually practise</small></span></button>` : ''}
        <div class="epss-tip" id="epss-tip"></div>
        <div class="epss-actions">
          <button type="button" class="epss-primary" id="epss-share">${I.share}<span>Share</span></button>
          <div class="epss-row"><button type="button" id="epss-dl">${I.dl}<span>Save</span></button><button type="button" id="epss-copyimg">${I.img}<span>Copy image</span></button><button type="button" id="epss-cap">${I.txt}<span>Copy caption</span></button></div>
        </div>
      </div>
    </div>
    <div class="epss-toast" id="epss-toast" role="status" aria-live="polite"></div>
  </div>`;
  document.body.appendChild(root); document.documentElement.style.overflow = 'hidden';
  requestAnimationFrame(() => root.classList.add('open'));
  const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
  let toastT; const say = m => { const t = $('#epss-toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2400); };

  const opts = () => ({ mode: st.mode, format: st.format, theme: st.theme, streak: st.streak ? streakN : 0 });
  const key = () => JSON.stringify(opts());
  const syncControls = () => {
    $$('[data-k]').forEach(g => g.querySelectorAll('button').forEach(b => { const on = b.dataset.v === st[g.dataset.k]; b.setAttribute('aria-checked', on); b.classList.toggle('on', on); }));
    const sw = $('#epss-streak'); if (sw) { sw.setAttribute('aria-checked', st.streak); sw.classList.toggle('on', st.streak); }
    $('#epss-tip').innerHTML = st.mode === 'challenge' ? '<b>Tip:</b> Challenge cards get replies. The answer stays hidden, and the QR code takes friends to the explanation.' : '<b>Tip:</b> Great for revision groups. The correct option is highlighted with the reason why.';
  };
  const render = () => {
    const tk = ++st.token; if (!st.A) return;
    st.blob = null; st.blobP = null; clearTimeout(render.t);
    let cv; try { cv = epRenderCard(q, info, opts(), st.A, .75); } catch (e) { console.error(e); say('Could not draw the card.'); return; }
    if (tk !== st.token) return;
    cv.className = 'epss-cv'; cv.setAttribute('aria-label', 'Preview of the card you are sharing'); cv.setAttribute('role', 'img');
    const fr = $('#epss-frame'); fr.replaceChildren(cv); fr.style.aspectRatio = `${cv._plan.W} / ${cv._plan.H}`; fr.classList.add('ready');
    const f = EP_FORMATS[st.format]; $('#epss-dim').textContent = `${cv._plan.W} × ${cv._plan.H} px · PNG` + (cv._plan.grew && cv._plan.H > EP_FORMATS[st.format].h * 1.1 ? ' · extended to fit the full question' : '');
    render.t = setTimeout(() => { prepare().catch(() => {}); }, 450);   // pre-build the PNG so Share fires inside the tap
  };
  // build the PNG ahead of time: mobile browsers only allow navigator.share right after a tap
  const prepare = () => {
    const k = key(); if (st.blob && st.blobKey === k) return Promise.resolve(st.blob);
    if (st.blobP && st.blobKey === k) return st.blobP;
    st.blobKey = k;
    st.blobP = epCardBlob(q, info, opts(), st.A).then(r => { if (st.blobKey === k) { st.blob = r.blob; st.tainted = r.tainted; } return r.blob; });
    return st.blobP;
  };
  const fname = () => `edupulse-${(info.subject || 'neet').toLowerCase()}-${st.mode}-${st.format}.png`;
  const save = blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname(); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
  const withBusy = async (btn, fn) => { if (btn.disabled) return; btn.disabled = true; btn.classList.add('busy'); try { await fn(); } catch (e) { if (!(e && e.name === 'AbortError')) say((e && e.message) || 'Something went wrong. Try again.'); } finally { btn.disabled = false; btn.classList.remove('busy'); } };

  $('#epss-share').onclick = e => withBusy(e.currentTarget, async () => {
    const blob = st.blob && st.blobKey === key() ? st.blob : await prepare();
    const file = new File([blob], fname(), { type: 'image/png' }), text = epShareCaption(q, info, opts());
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'EduPulse question', text }); say('Shared. Thanks for spreading the pulse!'); return; } catch (err) { if (err && err.name === 'AbortError') return; } }
    save(blob); say('Saved to your device. Send it anywhere!');
  });
  $('#epss-dl').onclick = e => withBusy(e.currentTarget, async () => { save(await prepare()); say('Image saved.'); });
  $('#epss-copyimg').onclick = e => withBusy(e.currentTarget, async () => {
    if (!(navigator.clipboard && window.ClipboardItem)) { save(await prepare()); say('Your browser can’t copy images, so it was saved instead.'); return; }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': prepare() })]); say('Image copied. Paste it into any chat.');
  });
  $('#epss-cap').onclick = e => withBusy(e.currentTarget, async () => { await navigator.clipboard.writeText(epShareCaption(q, info, opts())); say('Caption copied.'); });
  root.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) return close();
    const b = e.target.closest('.epss-seg button, .epss-themes button'); if (b) { const g = b.closest('[data-k]'); st[g.dataset.k] = b.dataset.v; if (g.dataset.k !== 'mode') { try { localStorage.setItem(EP_SS_PREFS, JSON.stringify({ format: st.format, theme: st.theme, streak: st.streak })); } catch (x) {} } syncControls(); render(); return; }
    if (e.target.closest('#epss-streak')) { st.streak = !st.streak; try { localStorage.setItem(EP_SS_PREFS, JSON.stringify({ format: st.format, theme: st.theme, streak: st.streak })); } catch (x) {} syncControls(); render(); }
  });
  // keep the quiz's own shortcuts (1-4, arrows, B, S…) from firing underneath the sheet
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
    if (e.key === 'Tab') { const f = $$('button:not([disabled])'); if (!f.length) return; const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); } return; }
    e.stopImmediatePropagation();
  };
  window.addEventListener('keydown', onKey, true);
  function close() { window.removeEventListener('keydown', onKey, true); clearTimeout(render.t); st.token++; root.classList.remove('open'); document.documentElement.style.overflow = htmlOv; setTimeout(() => root.remove(), 220); try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch (e) {} }
  syncControls(); $('#epss-share').focus({ preventScroll: true });

  (async () => {
    try { await Promise.all(['500', '600', '700', '800'].map(w => document.fonts.load(`${w} 30px "Plus Jakarta Sans"`))); } catch (e) {}
    st.A = await epLoadAssets(q, false); render();
  })();
}

/* Entry point used by the quiz toolbar, the ⋯ menu and the “I” shortcut */
async function epShareQuestionImage(q, meta = '') {
  try { epShareStudio(q, epCardInfo(q, meta)); }
  catch (e) { console.error(e); showToast((e && e.message) || 'Could not create the image.', 'error'); }
}

/* Studio styles (scoped to #epss, follows the app's light / dark theme) */
(function () {
  if (document.getElementById('epss-css')) return;
  const s = document.createElement('style'); s.id = 'epss-css';
  s.textContent = `
#epss{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif;opacity:0;transition:opacity .2s}
#epss.open{opacity:1}
#epss .epss-bd{position:absolute;inset:0;background:rgba(3,7,18,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
#epss .epss-sheet{position:relative;width:min(1040px,100%);max-height:96dvh;display:flex;flex-direction:column;background:var(--card-bg,#fff);color:var(--text-primary,#0f172a);border-radius:28px 28px 0 0;box-shadow:0 -20px 80px rgba(0,0,0,.45);transform:translateY(24px);transition:transform .28s cubic-bezier(.2,.8,.2,1);overflow:hidden}
#epss.open .epss-sheet{transform:none}
#epss svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
#epss button{font:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
#epss button:focus-visible{outline:3px solid #14b8a6;outline-offset:2px}
#epss .epss-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px 10px}
#epss .epss-title{font-weight:800;font-size:18px;letter-spacing:-.01em}
#epss .epss-sub{font-size:12px;color:var(--text-muted,#64748b);margin-top:2px}
#epss .epss-x{width:40px;height:40px;border-radius:14px;border:1px solid var(--border-color,#e2e8f0);background:transparent;display:grid;place-items:center}
#epss .epss-body{display:flex;flex-direction:column;gap:14px;padding:6px 20px 20px;overflow:auto;overscroll-behavior:contain}
#epss .epss-stage{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0}
#epss .epss-frame{position:relative;height:min(52dvh,560px);max-width:100%;aspect-ratio:1080/1350;border-radius:18px;overflow:hidden;background:rgba(100,116,139,.14);box-shadow:0 10px 40px rgba(2,6,23,.28);display:grid;place-items:center}
#epss .epss-cv{width:100%;height:100%;display:block}
#epss .epss-skel{display:grid;gap:10px;justify-items:center;color:var(--text-muted,#64748b);font-size:12px;font-weight:700}
#epss .epss-skel i{width:34px;height:34px;border-radius:50%;border:3px solid rgba(20,184,166,.25);border-top-color:#14b8a6;animation:epssSpin .8s linear infinite}
@keyframes epssSpin{to{transform:rotate(360deg)}}
#epss .epss-dim{font-size:11px;color:var(--text-muted,#64748b);font-weight:600;text-align:center}
#epss .epss-side{display:flex;flex-direction:column;gap:8px;min-width:0}
#epss .epss-lbl{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted,#64748b);margin-top:6px}
#epss .epss-seg{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px;padding:4px;border-radius:16px;background:rgba(100,116,139,.12)}
#epss .epss-seg button{display:flex;align-items:center;justify-content:center;gap:7px;padding:10px 6px;border:0;border-radius:12px;background:transparent;font-weight:700;font-size:13px;line-height:1.15;flex-wrap:wrap;text-align:center;min-height:44px}
#epss .epss-seg button small{display:block;width:100%;font-size:11px;font-weight:600;opacity:.6}
#epss .epss-seg button.on{background:var(--card-bg,#fff);box-shadow:0 2px 10px rgba(2,6,23,.16);color:#0f766e}
body.dark #epss .epss-seg button.on{background:#0f172a;color:#5eead4}
#epss .epss-themes{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
#epss .epss-themes button{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:14px;border:2px solid var(--border-color,#e2e8f0);background:transparent;font-weight:700;font-size:13px;min-height:44px}
#epss .epss-themes button.on{border-color:#14b8a6;background:rgba(20,184,166,.1)}
#epss .epss-sw{width:22px;height:22px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(100,116,139,.35);flex:none}
#epss .epss-tog{display:flex;align-items:center;gap:12px;text-align:left;padding:10px 12px;border-radius:16px;border:2px solid var(--border-color,#e2e8f0);background:transparent;min-height:56px}
#epss .epss-tog.on{border-color:#f59e0b;background:rgba(245,158,11,.1)}
#epss .epss-tg{width:42px;height:24px;border-radius:99px;background:rgba(100,116,139,.35);position:relative;flex:none;transition:background .2s}
#epss .epss-tg::after{content:'';position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 4px rgba(0,0,0,.3)}
#epss .epss-tog.on .epss-tg{background:#f59e0b}#epss .epss-tog.on .epss-tg::after{transform:translateX(18px)}
#epss .epss-tl{display:grid;grid-template-columns:auto 1fr;column-gap:8px;align-items:center;font-size:13px}
#epss .epss-tl svg{color:#f59e0b}#epss .epss-tl small{grid-column:2;font-size:11px;color:var(--text-muted,#64748b)}
#epss .epss-tip{font-size:12px;line-height:1.5;color:var(--text-muted,#64748b);padding:10px 12px;border-radius:14px;background:rgba(20,184,166,.08);margin-top:4px}
#epss .epss-tip b{color:#0f766e}body.dark #epss .epss-tip b{color:#5eead4}
#epss .epss-actions{display:grid;gap:8px;margin-top:6px}
#epss .epss-primary{display:flex;align-items:center;justify-content:center;gap:10px;min-height:54px;border:0;border-radius:18px;background:linear-gradient(135deg,#0d9488,#4f46e5);color:#fff;font-weight:800;font-size:16px;box-shadow:0 10px 28px rgba(79,70,229,.35)}
#epss .epss-primary:active{transform:scale(.985)}
#epss .epss-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
#epss .epss-row button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:56px;padding:8px 4px;border-radius:16px;border:1px solid var(--border-color,#e2e8f0);background:transparent;font-weight:700;font-size:12px}
#epss .busy{opacity:.6;pointer-events:none}
#epss .epss-toast{position:absolute;left:50%;bottom:16px;transform:translate(-50%,20px);background:#0f172a;color:#fff;padding:11px 16px;border-radius:14px;font-size:12.5px;font-weight:700;opacity:0;pointer-events:none;transition:.25s;max-width:calc(100% - 32px);text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.4)}
#epss .epss-toast.on{opacity:1;transform:translate(-50%,0)}
@media (min-width:820px){
  #epss{align-items:center;padding:24px}
  #epss .epss-sheet{border-radius:28px;max-height:92dvh}
  #epss .epss-body{flex-direction:row;gap:28px;padding:8px 28px 28px;align-items:flex-start}
  #epss .epss-stage{flex:1 1 52%;position:sticky;top:0}
  #epss .epss-frame{height:min(68dvh,720px)}
  #epss .epss-side{flex:1 1 42%;max-width:400px}
}
@media (max-width:819px){
  #epss .epss-frame{height:min(40dvh,430px)}
  #epss .epss-actions{position:sticky;bottom:0;z-index:2;background:var(--card-bg,#fff);margin:6px -20px -20px;padding:10px 20px calc(12px + env(safe-area-inset-bottom));box-shadow:0 -12px 24px -12px rgba(2,6,23,.25)}
}
@media (max-height:640px) and (max-width:819px){#epss .epss-frame{height:40dvh}}
@media (prefers-reduced-motion:reduce){#epss,#epss .epss-sheet,#epss .epss-toast{transition:none}#epss .epss-skel i{animation:none}}
`;
  document.head.appendChild(s);
})();


// ===== AI Chatbot Engine — Pulse AI =====
const EPC_KEY = 'edupulse_chat_v1';
const epc = { history: [], mode: 'tutor', web: false, appContext: true, attach: false, busy: false, err: '', rec: null, speaking: -1 };
const EPC_ICON = {
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  speak: '<path d="M11 5L6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  redo: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  play: '<path d="M7 4l13 8-13 8V4z"/>'
};
const epcIcon = (n, sz = 15) => `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${EPC_ICON[n]}</svg>`;
const epcEl = id => document.getElementById(id);
// Image bytes stay in memory only; chat history stores text/metadata, never image payloads.
epc.pendingImage = null;
function epcSave() { try { StorageModule.set(EPC_KEY, epc.history.slice(-40).map(m => { const copy = { ...m }; delete copy.image; return copy; })); } catch (e) {} }

function epcChooseImage() { epcEl('epc-image-input')?.click(); }
function epcClearImage() { epc.pendingImage = null; const input = epcEl('epc-image-input'); if (input) input.value = ''; const preview = epcEl('epc-image-preview'); if (preview) { preview.hidden = true; preview.innerHTML = ''; } }
// Large photos cost many image tokens; downscale to 1024px JPEG before sending.
function epcShrinkImage(dataUrl, file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const kb = (file.size / 1024).toFixed(0), s = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
      if (s === 1 && file.size < 300 * 1024) return resolve({ mime: file.type, url: dataUrl, note: kb + ' KB' });
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/jpeg', 0.82);
      if (url.length >= dataUrl.length) return resolve({ mime: file.type, url: dataUrl, note: kb + ' KB' });
      resolve({ mime: 'image/jpeg', url, note: kb + ' → ' + Math.round(url.length * 0.75 / 1024) + ' KB' });
    };
    img.onerror = reject; img.src = dataUrl;
  });
}
function epcSetImage(file) {
  if (!file) return;
  const allowed = ['image/jpeg','image/png','image/webp'];
  if (!allowed.includes(file.type)) { showToast('Choose a JPG, PNG or WebP image.', 'warning'); return; }
  if (file.size > 8 * 1024 * 1024) { showToast('Image is too large. Choose one under 8 MB.', 'warning'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result || '');
    const comma = dataUrl.indexOf(',');
    if (comma < 0) { showToast('Could not read that image.', 'error'); return; }
    const apply = (mime, url, note) => {
      epc.pendingImage = { name: file.name || 'Attached image', mimeType: mime, data: url.slice(url.indexOf(',') + 1), dataUrl: url };
      const preview = epcEl('epc-image-preview');
      if (preview) { preview.hidden = false; preview.innerHTML = `<img src="${url}" alt="Image selected for Pulse AI"><div class="epc-image-meta"><b>${escapeHtml(file.name || 'Attached image')}</b><span>${note} · sent to Gemini for analysis</span></div><button type="button" onclick="epcClearImage()" aria-label="Remove attached image">Remove</button>`; }
    };
    epcShrinkImage(dataUrl, file).then(r => apply(r.mime, r.url, r.note)).catch(() => apply(file.type, dataUrl, (file.size / 1024).toFixed(0) + ' KB'));
  };
  reader.onerror = () => showToast('Could not read that image.', 'error');
  reader.readAsDataURL(file);
}

// Read-only bridge: expose a compact, relevant snapshot of app data to Pulse AI.
// It deliberately excludes API keys, account credentials, auth tokens and unrelated storage.
function epcAppContextText(compact = false) {
  try {
    const stats = StorageModule.get(STORAGE_KEYS.qstats, {}) || {};
    const attempts = StorageModule.get(STORAGE_KEYS.attempts, []) || [];
    const notebook = StorageModule.get(STORAGE_KEYS.errorNotebook, {}) || {};
    const progress = (typeof userProgress !== 'undefined' && userProgress) || StorageModule.get(STORAGE_KEYS.progress, {}) || {};
    const streak = StorageModule.get(STORAGE_KEYS.streak, {}) || {};
    const tasks = (typeof todos !== 'undefined' && Array.isArray(todos)) ? todos : StorageModule.get(STORAGE_KEYS.todos, []);
    const seen = Object.values(stats);
    const totalSeen = seen.reduce((n, x) => n + (Number(x?.seen) || 0), 0);
    const totalCorrect = seen.reduce((n, x) => n + (Number(x?.correct) || 0), 0);
    const totalWrong = seen.reduce((n, x) => n + (Number(x?.wrong) || 0), 0);
    const weak = seen.filter(x => x && (Number(x.wrong) || 0) > 0).sort((a,b) => (Number(b.wrong)||0) - (Number(a.wrong)||0)).slice(0, compact ? 4 : 6).map(x => ({ subject:x.sj||'', chapter:x.ch||'', seen:x.seen||0, correct:x.correct||0, wrong:x.wrong||0, streak:x.streak||0 }));
    const mistakes = Object.values(notebook).filter(x => x && x.q).slice(compact ? -3 : -8).map(x => ({ question:String(x.q.question||'').slice(0, compact ? 160 : 500), subject:x.q.subject||'', chapter:x.q.sourceChapter||'', answer:x.q.options?.[x.q.correct]||'', reason:x.attempts?.[0]?.reason||'Not tagged', attempts:x.attempts?.length||1 }));
    const recent = (Array.isArray(attempts) ? attempts : []).slice(0, compact ? 3 : 5).map(a => ({ subject:a.subject||'', chapter:a.chapter||'', mode:a.mode||'', accuracy:Number(a.accuracy)||0, attempted:Number(a.attempted)||0, correct:Number(a.correct)||0, wrong:Number(a.wrong)||0, date:a.date||a.finishedAt||a.timestamp||null }));
    const current = epcCurrentQuestion();
    const currentSession = current ? { subject:quizState.subject, chapter:quizState.chapter, mode:quizState.mode, index:(quizState.currentIndex||0)+1, total:quizState.questions?.length||0, question:String(current.question||'').slice(0, compact ? 420 : 900), options:(current.options||[]).slice(0,4), selected:quizState.userAnswers?.[quizState.currentIndex] ?? null, correctIndex:current.correct, explanation:String(current.explanation||'').slice(0, compact ? 200 : 900) } : null;
    const chapterProgress = Object.entries(progress).filter(([,v]) => v && typeof v === 'object' && (!compact || (Number(v.progress)||0) > 0 || v.completed)).slice(0, compact ? 12 : 40).map(([chapter,v]) => ({ chapter, completed:!!v.completed, progress:Number(v.progress)||0 }));
    const taskSummary = Array.isArray(tasks) ? { total:tasks.length, pending:tasks.filter(t=>!t.completed).length, titles:tasks.filter(t=>!t.completed).slice(0, compact ? 3 : 5).map(t=>String(t.title||'').slice(0, compact ? 60 : 100)) } : null;
    return '\n\n[EduPulse app data snapshot — read-only, current device data]\n' + JSON.stringify({ currentSession, performance:{ questionsSeen:totalSeen, correct:totalCorrect, wrong:totalWrong, accuracy:totalSeen?Math.round(totalCorrect/totalSeen*100):null }, weakAreas:weak, recentAttempts:recent, savedMistakes:mistakes, chapterProgress, streak:{ current:Number(streak.current)||0, best:Number(streak.best)||0 }, tasks:taskSummary }) + '\nRead-only evidence about this learner: if a field is missing, say so and do not infer it. Never claim to have changed app data or to hold credentials.\n[End app data snapshot]';
  } catch (e) { return '\n[EduPulse app data is temporarily unavailable. Do not claim to have inspected learner progress.]'; }
}

function epcCurrentQuestion() {
  try {
    if (!document.querySelector('.quiz-session-layout')) return null;
    const q = quizState.questions?.[quizState.currentIndex];
    return q && q.question ? q : null;
  } catch (e) { return null; }
}
function epcContextText(q) {
  return `[Question the learner is viewing in the app]\n${q.question}\n` +
    (q.options || []).map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n') +
    (q.options?.[q.correct] != null ? `\nCorrect answer: ${String.fromCharCode(65 + q.correct)}. ${q.options[q.correct]}` : '') +
    (q.explanation ? `\nExisting explanation: ${q.explanation}` : '') + '\n[End of question]';
}

// Shared answer-quality rules for every Pulse AI surface (chat, question explanation, doubts).
const EPC_FORMAT_RULES = [
  'Accuracy comes first: if unsure, say so; never invent NCERT page numbers, table numbers or statistics. Use NCERT terminology exactly (animals have a Phylum, plants a Division; humans are Homo sapiens: genus Homo, family Hominidae, order Primata, class Mammalia).',
  'Reply in the language the learner writes in (English, Hindi or Hinglish).',
  'Go straight to the answer. Never restate the question or its options back to the learner and never add sections such as "Image Analysis", "Question Reading" or "Uncertainties". Silently correct obvious typos or OCR slips; mention one doubtful point in a single short line only when it changes the answer.',
  'Keep it tight (normally under 220 words): short paragraphs, **bold** key terms, numbered steps for solutions. Use ### headings only when there are 3+ genuinely distinct parts, then at most 4 short headings and no horizontal rules.',
  'Tables only for true comparisons where every row is a different item and every cell is correct; never mix a correct and a wrong value in one cell.',
  'Write maths and chemistry in LaTeX inside $...$, for example $x^{2}$, $\\mathrm{H_{2}O}$, $A \\rightarrow B$. Never leave a bare backslash command outside $...$. Italicise scientific names (*Homo sapiens*).',
  'For an MCQ, check every option against the facts before answering and state the correct option and the reason in the first line.',
  'Label anything beyond the NCERT syllabus as "Beyond NCERT:".',
  'Adapt depth to the learner: simpler, with an analogy, when their accuracy on the topic is low or they say they are confused; skip basics when it is high.'
].join(' ');
const EPC_HEAD = 'You are Pulse AI, the study copilot inside EduPulse for NEET aspirants (Physics, Chemistry, Biology; NCERT-first). ';
const EPC_QUIZ_RULE = ' For a test or quiz give the MCQs AND one raw JSON array ```json [...] ``` of objects {q, o (array of 4 options), a (1-based correct index), s (short explanation)}.';
const EPC_CTX_RULE = ' Treat a [Question the learner is viewing] block as the question meant by "this question", and a [Text the learner selected on screen] block as the exact text meant by "this" or "this part". If such a block is present, never ask the learner to paste or provide the question. If none is present and they refer to "this question", tell them to tap "Attach the question I\'m viewing".';
const EPC_FU_RULE = ' End the reply with one line: FOLLOWUPS: <question 1> | <question 2> | <question 3> (three follow-up questions, under 8 words each).';
const EPC_MEM_RULE = ' Only if the learner states a lasting preference (for example "explain in Hinglish") or clearly shows a recurring difficulty, add a final line: MEMORY: <one factual note under 15 words>. Otherwise omit it; never invent notes.';
// Only the rules a given message needs are sent (saves tokens on every call).
function epcContract(mode, text) {
  const eco = !!(window.epTok && epTok.eco());
  const wantsQuiz = mode === 'quiz' || /quiz|mcq|test me|practice (set|questions)|generate .*questions/i.test(text || '');
  const wantsMem = !eco || /\b(prefer|always|never|remember|from now|struggl|difficult|confus|weak|hinglish|hindi|simpler|slower|faster)/i.test(text || '');
  return EPC_HEAD + EPC_FORMAT_RULES + (wantsQuiz ? EPC_QUIZ_RULE : '') + EPC_CTX_RULE + ((eco && mode === 'quick') ? '' : EPC_FU_RULE) + (wantsMem ? EPC_MEM_RULE : '');
}

function epcSystem() {
  const T = window.epTok;
  const lastUser = [...epc.history].reverse().find(m => m.role === 'user');
  const lastText = (lastUser && lastUser.text) || '';
  const modes = {
    tutor: ' Teach step by step: the underlying concept first, then the logic, then one exam tip.',
    quick: ' Answer in at most 5 short lines with no headings.',
    quiz: ' The learner wants practice: always generate high-yield MCQs with the JSON block and keep the surrounding prose to two lines.'
  };
  const mnt = (window.epMentor && epMentor.prompt()) || { text: '', tutor: '' };
  const modeTxt = (epc.mode === 'tutor' && mnt.tutor) ? mnt.tutor : (modes[epc.mode] || '');
  let snap;
  if (!epc.appContext) snap = '\n[EduPulse app-data access is OFF. Do not claim to know learner progress.]';
  else if (!T || T.wantsSnapshot(lastText)) snap = epcAppContextText(!!(T && T.eco()));
  else {
    snap = '\n[Study-data snapshot not attached to this message to save tokens. If the answer depends on the learner\'s progress or mistakes, ask them to say "use my data".]';
    try { T.noteSaved(Math.round(epcAppContextText(true).length / 4)); } catch (e) {}
  }
  return epcContract(epc.mode, lastText) + mnt.text + modeTxt + (window.epMentor ? epMentor.memoryText() : '') + snap;
}

function epcContents(webBlock) {
  const T = window.epTok;
  const lim = (T && T.eco()) ? { n: 6, last: 1400, old: 260 } : { n: 14, last: 6000, old: 6000 };
  const trim = (s, n) => { s = String(s); if (s.length <= n) return s; const cut = s.slice(0, n); const p = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n')); return (p > n * 0.5 ? cut.slice(0, p + 1) : cut).trim() + ' …'; };
  const hist = epc.history.slice(-lim.n);
  const lastUser = hist.map(m => m.role).lastIndexOf('user');
  let lastCtx = -1; hist.forEach((m, i) => { if (m.role === 'user' && m.ctx) lastCtx = i; });
  let dropped = 0;
  const out = [];
  hist.forEach((m, idx) => {
    const role = m.role === 'user' ? 'user' : 'model';
    let t;
    if (role === 'user') {
      t = m.text;
      if (m.ctx) { if (idx === lastCtx) t = m.ctx + '\n\n' + m.text; else { t = '[A question was attached earlier]\n' + m.text; dropped += m.ctx.length; } }
    } else {
      const p = epcParse(m.text);
      t = trim(p.text, idx >= hist.length - 2 ? lim.last : lim.old) + (p.questions ? '\n(Quiz JSON was delivered to the learner.)' : '');
      dropped += Math.max(0, p.text.length - t.length);
    }
    if (m.handoff && window.epMentor) t = epMentor.handoffNote(m.handoff) + t;
    if (webBlock && role === 'user' && idx === lastUser) t = webBlock + '\n\n' + t;
    const parts = [{ text: t }];
    // Image bytes go out once, with the newest user message only.
    if (role === 'user' && idx === lastUser && m.image?.data && m.image?.mimeType) parts.push({ inline_data: { mime_type: m.image.mimeType, data: m.image.data } });
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].parts.push(...parts);
    else out.push({ role, parts });
  });
  while (out.length && out[0].role !== 'user') out.shift();
  if (T && dropped) T.noteSaved(Math.round(dropped / 4));
  return out;
}

function epcParse(raw = '') {
  let text = String(raw), questions = null, followups = [];
  const fu = text.match(/^\s*FOLLOW-?UPS?\s*:\s*(.+)$/im);
  if (fu) { followups = fu[1].split('|').map(x => x.replace(/[<>*`]/g, '').replace(/^_+|_+$/g, '').trim()).filter(Boolean).slice(0, 3); text = text.replace(fu[0], ''); }
  let memory = null;
  const mm = text.match(/^\s*MEMORY\s*:\s*(.+)$/im);
  if (mm) { memory = mm[1].replace(/[<>*`\n]/g, ' ').trim().slice(0, 160); text = text.replace(mm[0], ''); }
  const j = text.match(/```json\s*([\s\S]*?)```/i);
  if (j) {
    try { const arr = JSON.parse(j[1]); if (Array.isArray(arr) && arr.length && arr.every(q => q && q.q && Array.isArray(q.o) && q.o.length >= 2)) questions = arr; } catch (e) {}
    text = text.replace(/```json[\s\S]*?```/i, '');
  }
  return { text: text.trim(), questions, followups, memory };
}

const epcPlain = t => String(t).replace(/```[\s\S]*?```/g, ' ').replace(/[#*_`>|]/g, '').replace(/\s+/g, ' ').trim();

function epcWelcome() {
  if (window.epMentor) return epMentor.welcome();
  const h = new Date().getHours();
  const hi = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const cq = epcCurrentQuestion();
  const cards = [
    cq ? ['explain', 'Explain this question', 'The one on your screen, simply'] : ['doubt', 'Clear a doubt', 'Ask anything from NCERT'],
    ['quiz', '5 quick MCQs', 'Pick a topic, I\'ll test you'],
    ['strategy', '7-day revision plan', 'Built around your weak areas'],
    ['mnemonic', 'Memory trick', 'A mnemonic plus an exam tip']
  ];
  return `<div class="epc-hero">
    <div class="epc-hero-ico"><svg viewBox="0 0 56 56" aria-hidden="true"><use href="#ep-ai"/></svg></div>
    <h3>${hi}. Aaj kya padhna hai?</h3>
    <p>Doubt ho ya revision, poochho ya image attach karo. Main relevant study progress aur current question ka context use karke help kar sakta hoon.</p>
    <div class="epc-starters">${cards.map(c => `<button type="button" onclick="epcPreset('${c[0]}')"><b>${c[1]}</b><span>${c[2]}</span></button>`).join('')}</div>
  </div>`;
}

const epcTime = ts => ts ? new Date(ts).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '';
function epcUserHtml(m) {
  return `${m.handoff && window.epMentor ? epMentor.divider(m.handoff) : ''}<div class="epc-m user">${m.ctx ? '<div class="epc-tag">' + (m.ctx.indexOf('[Text the learner selected') === 0 ? 'Selection attached' : 'Question attached') + '</div>' : ''}${m.image?.dataUrl ? `<img class="epc-user-image" src="${m.image.dataUrl}" alt="Image attached to doubt">` : ''}${multiline(m.text)}<time class="epc-time">${epcTime(m.ts)}</time></div>`;
}
function epcAiHtml(m, i, isLast) {
  const p = epcParse(m.text);
  const act = (cls, fn, label, icon) => `<button type="button" class="epc-act ${cls || ''}" onclick="${fn}" aria-label="${label}" title="${label}">${icon}<span>${label}</span></button>`;
  return `<div class="epc-m ai">
    ${window.epMentor ? epMentor.badge(m) : ''}
    ${renderFormattedMarkdown(p.text || 'Here are your generated questions.')}
    ${p.questions ? `<button type="button" class="epc-cta" onclick="epcLaunch(${i})">${epcIcon('play', 13)} Start this ${p.questions.length}-question quiz</button>` : ''}
    ${window.epWeb ? epWeb.sources(m) : ''}
    <div class="epc-actions">
      ${act('', `epcCopy(${i})`, 'Copy', epcIcon('copy'))}
      ${act(epc.speaking === i ? 'on' : '', `epcSpeak(${i})`, epc.speaking === i ? 'Stop' : 'Listen', epcIcon(epc.speaking === i ? 'stop' : 'speak'))}
      ${isLast ? act('', 'epcRegenerate()', 'Redo', epcIcon('redo')) : ''}
      ${act('rate'+(m.rate===1?' on':''), `epcRate(${i},1)`, 'Helpful', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v11H3V10z"/><path d="M7 10l4-8a2 2 0 0 1 2 2v4h6a2 2 0 0 1 2 2l-1 7a2 2 0 0 1-2 2H7"/></svg>')}
      ${act('rate bad'+(m.rate===-1?' on':''), `epcRate(${i},-1)`, 'Not helpful', '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 14V3h4v11z"/><path d="M17 14l-4 8a2 2 0 0 1-2-2v-4H5a2 2 0 0 1-2-2l1-7a2 2 0 0 1 2-2h13"/></svg>')}
      ${window.epTok ? epTok.chip(m) : ''}
      <time class="epc-time">${epcTime(m.ts)}</time>
    </div>
    ${isLast && window.epMentor ? epMentor.handoffs(m) : ''}
    ${isLast && p.followups.length ? `<div class="epc-fu">${p.followups.map(f => `<button type="button" onclick="epcFollow(this)">${escapeHtml(f).replace(/_\{([^}]+)\}/g, '<sub>$1</sub>').replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>')}</button>`).join('')}</div>` : ''}
  </div>`;
}

function epcRender() {
  const box = epcEl('ai-chat-messages'); if (!box) return;
  if (!epc.history.length && !epc.busy) { box.innerHTML = epcWelcome(); return; }
  const lastAi = epc.history.map(m => m.role).lastIndexOf('model');
  box.innerHTML = epc.history.map((m, i) => m.role === 'user' ? epcUserHtml(m) : epcAiHtml(m, i, i === lastAi && !epc.busy)).join('') +
    (epc.busy ? '<div class="epc-m ai epc-typing" aria-label="Pulse AI is thinking"><i></i><i></i><i></i><span class="epc-think">' + (window.epMentor ? epMentor.thinking() : 'Thinking…') + ' <b id="epc-elapsed">0s</b></span></div>' : '') +
    (epc.err ? `<div class="epc-m ai epc-err"><b>${epc.err.startsWith('Stopped') ? 'Stopped' : "Couldn't get an answer"}</b><p>${escapeHtml(epc.err)}</p><button type="button" onclick="epcAsk()">Try again</button></div>` : '');
  box.scrollTop = box.scrollHeight;
  if (window.epUI) epUI.sync();
}

function epcRenderChips(has) {
  const box = epcEl('epc-chips'); if (!box) return;
  const sets = {
    question: [['explain', 'Explain this'], ['wrong', 'Why not the others?'], ['similar', 'Similar question'], ['mnemonic', 'Memory trick']],
    today: [['strategy', 'Make my plan'], ['quiz', '5 quick MCQs'], ['adaptive', 'Adaptive session']],
    base: [['quiz', '5 quick MCQs'], ['mnemonic', 'Memory trick'], ['strategy', 'Revision plan'], ['formula', 'Key formulas'], ['adaptive', 'Adaptive session']]
  };
  const key = has ? 'question' : (typeof currentTab !== 'undefined' && currentTab === 'dashboard') ? 'today' : 'base';
  if (box.dataset.set === key) return;
  box.dataset.set = key;
  box.innerHTML = sets[key].map(([t, l]) => `<button type="button" onclick="epcPreset('${t}')">${l}</button>`).join('');
}
function epcRefreshContext() {
  const bar = epcEl('epc-ctx'), btn = epcEl('epc-ctx-btn');
  const has = !!epcCurrentQuestion();
  epcRenderChips(has);
  if (bar) bar.hidden = !has;
  if (!has) epc.attach = false;
  if (btn) btn.setAttribute('aria-pressed', String(epc.attach));
  if (bar) bar.classList.toggle('on', epc.attach);
}
function epcToggleAttach() { epc.attach = !epc.attach; epcRefreshContext(); epcEl('ai-chat-input')?.focus(); }
function epcSetMode(m) {
  epc.mode = m;
  document.querySelectorAll('.epc-seg button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
}
function epcToggleWeb() {
  epc.web = !epc.web;
  const b = epcEl('epc-web-btn'); b?.classList.toggle('on', epc.web); b?.setAttribute('aria-pressed', String(epc.web));
  showToast(epc.web ? 'Pulse AI will check Google Search' : 'Web search off', 'info');
}
function epcToggleData() {
  epc.appContext = !epc.appContext;
  const b = epcEl('epc-data-btn'); b?.classList.toggle('on', epc.appContext); b?.setAttribute('aria-pressed', String(epc.appContext));
  showToast(epc.appContext ? 'Read-only EduPulse study context enabled' : 'EduPulse study context disabled', 'info');
}
function epcToggleMax() {
  const w = epcEl('ai-chatbot-window'); const on = w.classList.toggle('epc-max');
  epcEl('epc-max-btn')?.setAttribute('aria-label', on ? 'Shrink chat' : 'Expand chat');
  const box = epcEl('ai-chat-messages'); if (box) box.scrollTop = box.scrollHeight;
}

function toggleAiChatbotWindow(force) {
  const win = epcEl('ai-chatbot-window'), fab = epcEl('ai-chat-toggle-btn');
  if (!win) return;
  const open = typeof force === 'boolean' ? force : win.classList.contains('hidden');
  win.classList.toggle('hidden', !open);
  fab?.setAttribute('aria-expanded', String(open));
  if (open) { epAiOffSync(); try { epcRefreshContext(); } catch (e) {}
    fab?.classList.remove('unread');
    const model = localStorage.getItem(GEMINI_MODEL_STORAGE_KEY) || GEMINI_DEFAULT_MODEL;
    const m = epcEl('epc-model'); if (m) m.textContent = 'Gemini · ' + model.replace(/^gemini-/, '');
    epcRefreshContext();
    if (!epc.history.length) epcRender();
    const box = epcEl('ai-chat-messages'); if (box) box.scrollTop = box.scrollHeight;
    setTimeout(() => epcEl('ai-chat-input')?.focus(), 60);
  } else { try { speechSynthesis.cancel(); epc.speaking = -1; } catch (e) {} }
}

function epcGrow() { const t = epcEl('ai-chat-input'); if (!t) return; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }


async function sendAiChatMessage(textOverride) {
  const input = epcEl('ai-chat-input');
  const typed = (typeof textOverride === 'string' ? textOverride : input?.value || '').trim();
  const image = epc.pendingImage;
  const text = typed || (image ? 'Look at this image. If it is a question, solve it and explain the answer concisely; if it is a diagram or figure, explain it for NEET. Do not copy the options back to me.' : '');
  if ((!text && !image) || epc.busy) return;
  if (input) { input.value = ''; epcGrow(); try { sessionStorage.removeItem('epc_draft'); } catch (e) {} }
  const msg = { role: 'user', text, ts: Date.now() };
  if (image) msg.image = image;
  const q0 = epcCurrentQuestion();
  if (!epc.attach && q0 && !image && !epc.sel && /\b(this|hint|explain|why|option|options|answer|solve|similar|trick|mnemonic|isko|iska|yeh|ye|samjha)\b/i.test(text)) epc.attach = true;
  if (epc.sel) {
    msg.ctx = '[Text the learner selected on screen]\n' + epc.sel + '\n[End of selection]' + ((epc.attach && q0) ? '\n\n' + epcContextText(q0) : '');
    epc.sel = ''; epc.attach = false; epcRefreshContext(); try { epcSelChip(); } catch (e) {}
  } else if (epc.attach) { if (q0) msg.ctx = epcContextText(q0); epc.attach = false; epcRefreshContext(); }
  epc.history.push(msg); epcClearImage(); epcSave();
  return epcAsk();
}

async function epcAsk() {
  if (epc.busy) return;
  epc.busy = true; epc.err = ''; epc.t0 = Date.now(); clearInterval(epc.tick);
  epc.tick = setInterval(() => { const e = epcEl('epc-elapsed'); if (e) e.textContent = Math.floor((Date.now() - epc.t0) / 1000) + 's'; }, 500);
  epcRender();
  try {
    if (!navigator.onLine) throw new Error('You are offline. Reconnect to chat with Pulse AI.');
    const T = window.epTok;
    const ck = T ? T.cacheKey() : null;
    let reply = ck && !epc.noCache ? T.cacheGet(ck) : null;
    const cached = !!reply;
    let wr = null;
    epc.noCache = false;
    if (cached) T.noteSaved(T.avgCall());
    else {
      epc.ctrl = new AbortController();
      const lu = [...epc.history].reverse().find(m => m.role === 'user');
      if (epc.web && window.epWeb) wr = await epWeb.search((lu && lu.text) || '', epc.ctrl.signal);
      reply = await callGeminiApi(epcContents(wr && wr.block), epcSystem(), !!epc.web && !wr, Object.assign({}, T ? T.opts('chat') : {}, { signal: epc.ctrl.signal }));
      if (ck) T.cachePut(ck, reply);
    }
    epc.history.push({ role: 'model', text: reply, ts: Date.now(), mentor: window.epMentor ? epMentor.id : undefined, tok: (!cached && T) ? T.take() : undefined, cached: cached || undefined, sources: (wr && wr.sources.length) ? wr.sources : undefined, webVia: wr ? wr.via : undefined }); epcSave();
    try { const pm = epcParse(reply); if (pm.memory && window.epMentor) epMentor.remember(pm.memory); } catch (e) {}
    if (epcEl('ai-chatbot-window')?.classList.contains('hidden')) epcEl('ai-chat-toggle-btn')?.classList.add('unread');
  } catch (e) { epc.err = e && e.name === 'AbortError' ? 'Stopped before an answer arrived. Your message is still here.' : (e.message || String(e)); }
  finally { clearInterval(epc.tick); epc.busy = false; epc.ctrl = null; epcRender(); }
}

function epcRegenerate() {
  if (epc.busy) return;
  while (epc.history.length && epc.history[epc.history.length - 1].role === 'model') epc.history.pop();
  epc.noCache = true; epcSave(); epcAsk();
}
function epcStop() { try { if (epc.ctrl) epc.ctrl.abort(); } catch (e) {} }
function epcSendOrStop() { if (epc.busy) epcStop(); else sendAiChatMessage(); }
function epcFollow(btn) { sendAiChatMessage(btn.textContent); }
function epcClear() {
  if (!epc.history.length) return;
  epConfirm('Clear this conversation with Pulse AI?', 'Clear').then(function (ok) {
    if (!ok) return;
    epc.history = []; epc.err = ''; epcSave(); try { speechSynthesis.cancel(); } catch (e) {} epc.speaking = -1; epcRender();
  });
}

function epcPreset(type) {
  if (type === 'adaptive') { openAdaptiveAiConfigModal(); return; }
  if (type === 'doubt') { epcEl('ai-chat-input')?.focus(); return; }
  const cq = epcCurrentQuestion();
  if (type === 'wrong' && cq) { epc.attach = true; epcRefreshContext(); return sendAiChatMessage('Explain briefly why each of the other options is wrong.'); }
  if (type === 'similar' && cq) { epc.attach = true; epcRefreshContext(); return sendAiChatMessage('Give me one similar NEET-style MCQ on the same concept, with the answer and a short explanation.'); }
  const subj = (typeof quizState !== 'undefined' && quizState.subject) || (typeof subject !== 'undefined' && subject) || 'Biology';
  const chap = (typeof quizState !== 'undefined' && quizState.chapter) ? ` on ${quizState.chapter}` : ` on ${subj}`;
  if (type === 'explain' && cq) { epc.attach = true; epcRefreshContext(); return sendAiChatMessage('Explain this question in simple language, then show why the correct option is right.'); }
  const map = {
    quiz: () => { epcSetMode('quiz'); return `Generate a 5-question high-yield NEET practice quiz${chap} with answers and explanations.`; },
    strategy: () => 'Create a 7-day NEET study and revision schedule focusing on my weakest areas (use my study data if you have it, otherwise ask me which chapters). Keep it as a table.',
    formula: () => `List the top 10 high-yield ${subj} formulas or facts for NEET with key variable definitions.`,
    mnemonic: () => { if (cq) { epc.attach = true; epcRefreshContext(); return 'Give me a memorable mnemonic and one exam tip for the concept in this question.'; } return `Give me 3 memorable mnemonics for high-yield ${subj} topics in NEET.`; }
  };
  if (map[type]) return sendAiChatMessage(map[type]());
}

async function epcCopy(i) {
  const t = epcParse(epc.history[i]?.text).text; if (!t) return;
  try { await navigator.clipboard.writeText(t); }
  catch (e) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (_) {} ta.remove(); }
  showToast('Copied to clipboard', 'success');
}
function epcSpeak(i) {
  if (!('speechSynthesis' in window)) return showToast('Listening is not supported in this browser', 'error');
  if (epc.speaking === i) { speechSynthesis.cancel(); epc.speaking = -1; return epcRender(); }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(epcPlain(epcParse(epc.history[i]?.text).text)); u.lang = 'en-IN'; u.rate = 1;
  u.onend = u.onerror = () => { if (epc.speaking === i) { epc.speaking = -1; epcRender(); } };
  epc.speaking = i; speechSynthesis.speak(u); epcRender();
}
const epcImageInput = epcEl('epc-image-input');
if (epcImageInput) epcImageInput.addEventListener('change', e => { epcSetImage(e.target.files?.[0]); });

function epcMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
  const btn = epcEl('epc-mic-btn'), input = epcEl('ai-chat-input');
  if (epc.rec) { epc.rec.stop(); return; }
  const r = new SR(); r.lang = 'en-IN'; r.interimResults = true; r.continuous = false; epc.rec = r;
  const base = input.value ? input.value + ' ' : '';
  btn.classList.add('rec'); btn.setAttribute('aria-label', 'Stop listening');
  r.onresult = e => { input.value = base + Array.from(e.results).map(x => x[0].transcript).join(''); epcGrow(); };
  r.onerror = () => showToast('Could not hear you. Check microphone permission.', 'error');
  r.onend = () => { btn.classList.remove('rec'); btn.setAttribute('aria-label', 'Speak your question'); epc.rec = null; input.focus(); };
  try { r.start(); } catch (e) { epc.rec = null; btn.classList.remove('rec'); }
}

function epcLaunch(i) {
  const p = epcParse(epc.history[i]?.text); if (!p.questions) return;
  const prev = epc.history.slice(0, i).reverse().find(m => m.role === 'user')?.text || '';
  const subj = /physic/i.test(prev) ? 'Physics' : /chem/i.test(prev) ? 'Chemistry' : /(bio|botan|zoolog|plant|cell|genet|human)/i.test(prev) ? 'Biology' : (quizState.subject || 'Biology');
  launchQuizFromAiChat(p.questions, subj);
}

function launchQuizFromAiChat(rawQuestions, subj = 'Biology') {
  if (!Array.isArray(rawQuestions) || !rawQuestions.length) return showToast('Invalid question payload.', 'error');
  const formatted = rawQuestions.map((q, i) => ({
    qKey: 'ai_chat_' + Date.now() + '_' + i,
    question: q.q,
    options: q.o,
    correct: (q.a || 1) - 1,
    explanation: q.s || 'AI generated explanation',
    sourceChapter: 'AI Custom Drill'
  }));
  toggleAiChatbotWindow(false);
  setupQuizMode('practice', subj, 'AI Custom Practice Drill', formatted);
}

function epcInit() {
  try { const saved = StorageModule.get(EPC_KEY, []); if (Array.isArray(saved)) epc.history = saved.filter(m => m && m.text && (m.role === 'user' || m.role === 'model')); } catch (e) {}
  const ta = epcEl('ai-chat-input');
  if (ta) {
    try { const d = sessionStorage.getItem('epc_draft'); if (d) { ta.value = d; epcGrow(); } } catch (e) {}
    ta.addEventListener('input', () => { epcGrow(); try { sessionStorage.setItem('epc_draft', ta.value); } catch (e) {} });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendAiChatMessage(); } });
  }
  if (window.SpeechRecognition || window.webkitSpeechRecognition) { const m = epcEl('epc-mic-btn'); if (m) m.hidden = false; }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !epcEl('ai-chatbot-window')?.classList.contains('hidden') && !document.getElementById('appModal')?.classList.contains('open')) toggleAiChatbotWindow(false); });
  epcRender();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', epcInit); else epcInit();

// ===== Quiz Data & Chapter Structure =====
// Question bank is served from the dedicated /data mount so content can evolve independently from the app shell.
const FILE_OVERRIDES = {}; // optional single-file override per chapter. Default: one file PER EXERCISE -> <subject>-<chapter>-<exN>.json (e.g. biology-evolution-ex1.json)
const LEGACY_FILES = { 'biology-diversity-in-the-living-world.json': 'living_world_mcqs.json' }; // used only if the new name is missing
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const DATA_BASE = "/data/";                 // original (site-root) location
const DATA_BASES = ["/data/", "./data/", "data/"]; // tried in order if the first one 404s

// ===== Per-exercise question files =====
// Each chapter is split into exercise files: <subject>-<chapter>-ex1.json (Conceptual), -ex2 (PYQ), -ex3 (Analytical), optional -ex1a (NCERT) / -ex1b.
// Missing exercise files are skipped silently. If NONE exist, the old single file <subject>-<chapter>.json is used as a fallback.
const EX_IDS = ['ex1', 'ex2', 'ex3', 'ex1a', 'ex1b'];
let DATA_BASE_OK = null; // remembers which base path worked so missing exercises are not probed on every base
async function fetchExerciseFile(name, attempt = 0) {
  const req = async (base) => {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 12000);
    try {
      const r = await fetch(base + name, { cache: 'no-cache', signal: c.signal });
      if (r.status === 404) return { missing: true };
      if (!r.ok) return null;
      if (/text\/html/i.test(r.headers.get('content-type') || '')) return { missing: true }; // SPA fallback page, not JSON
      return { r, base };
    } catch (e) { return null; } finally { clearTimeout(t); }
  };
  const epBases = []; { const seenU = new Set(); (DATA_BASE_OK ? [DATA_BASE_OK] : DATA_BASES).forEach((b) => { let u = b; try { u = new URL(b + name, location.href).href; } catch (e) {} if (!seenU.has(u)) { seenU.add(u); epBases.push(b); } }); }
  const hits = await Promise.all(epBases.map(req));
  const hit = hits.find(h => h && h.r);
  if (hit) { DATA_BASE_OK = hit.base; return hit.r; }
  if (attempt < 1 && hits.every(h => h === null)) return fetchExerciseFile(name, attempt + 1); // network hiccup: retry once
  return null;
}
// ===== Automatic multi-source question-bank discovery =====
// No chapters.json is required. The app lists /data in the configured public GitHub
// repository, then discovers files named:
// <subject>-<chapter>-<source>-<exN>.json (exercise suffix optional)
// Legacy files <subject>-<chapter>-<exN>.json are still loaded as ALLEN.
const LEGACY_SOURCE = 'allen';
const EP_SOURCE_LABELS = { allen: 'ALLEN', ncert: 'NCERT', pw: 'PW', aakash: 'Aakash', mtg: 'MTG', pyq: 'PYQ', seep: 'Seep Pahuja' };
const EP_EXERCISE_LABELS = Object.create(null); // only labels explicitly supplied by source JSON
const epSrcLabel = id => EP_SOURCE_LABELS[id] || String(id || '').replace(/(^|-)([a-z0-9])/g, (m, a, b) => (a ? ' ' : '') + b.toUpperCase());
// Public repository shown in the EduPulse GitHub project. Change these only if the
// repository is moved or renamed. GitHub Pages itself cannot list a directory.
const EP_GITHUB_REPO = 'sakuniijiii-byte/Edupulse';
const EP_GITHUB_BRANCH = 'main';
let EP_DATA_INDEX_P = null;
const EP_DIAGNOSTICS = window.EP_DIAGNOSTICS = { contentIndex: 'not checked', contentFileCount: 0, failedQuestionFiles: [], loadedChapters: 0, loadedQuestions: 0, cachedQuestionFiles: 0, aiTest: null, serviceWorker: 'unknown' };
function epRecordQuestionIssue(file, reason) {
  const key = String(file || 'Unknown question data');
  EP_DIAGNOSTICS.failedQuestionFiles = EP_DIAGNOSTICS.failedQuestionFiles.filter(item => item.file !== key);
  EP_DIAGNOSTICS.failedQuestionFiles.unshift({ file: key, reason: String(reason || 'Could not load'), at: Date.now() });
  EP_DIAGNOSTICS.failedQuestionFiles = EP_DIAGNOSTICS.failedQuestionFiles.slice(0, 12);
}
function epClearQuestionIssue(file) {
  const key = String(file || 'Unknown question data');
  EP_DIAGNOSTICS.failedQuestionFiles = EP_DIAGNOSTICS.failedQuestionFiles.filter(item => item.file !== key);
}
function epDataIndex() {
  if (EP_DATA_INDEX_P) return EP_DATA_INDEX_P;
  const p = (async () => {
    try {
      const CK = 'ep_data_idx_v2';
      // Always ask GitHub first so newly pushed files show up immediately; the cached copy is only a fallback if this fails.
      const url = `https://api.github.com/repos/${EP_GITHUB_REPO}/contents/data?ref=${encodeURIComponent(EP_GITHUB_BRANCH)}`;
      const r = await fetch(url, { cache: 'no-cache', headers: { Accept: 'application/vnd.github+json' } });
      if (!r.ok) throw new Error(`GitHub directory API returned ${r.status}`);
      const rows = await r.json();
      if (!Array.isArray(rows)) throw new Error('Unexpected GitHub directory response');
      const names = rows.filter(x => x && x.type === 'file' && /\.json$/i.test(x.name)).map(x => x.name);
      try { localStorage.setItem(CK, JSON.stringify({ t: Date.now(), n: names })); } catch (_) {}
      EP_DIAGNOSTICS.contentIndex = 'online'; EP_DIAGNOSTICS.contentFileCount = names.length; EP_DIAGNOSTICS.contentIndexCheckedAt = Date.now();
      return new Set(names);
    } catch (e) {
      try { const c = JSON.parse(localStorage.getItem('ep_data_idx_v2') || 'null'); if (c && Array.isArray(c.n)) { console.warn('[EduPulse] Using cached /data listing.', e); EP_DIAGNOSTICS.contentIndex = 'cached'; EP_DIAGNOSTICS.contentFileCount = c.n.length; EP_DIAGNOSTICS.contentIndexCheckedAt = Date.now(); return new Set(c.n); } } catch (_) {}
      console.warn('[EduPulse] Automatic /data discovery failed; using legacy filename probes.', e);
      EP_DIAGNOSTICS.contentIndex = 'legacy fallback'; EP_DIAGNOSTICS.contentIndexCheckedAt = Date.now();
      if (EP_DATA_INDEX_P === p) EP_DATA_INDEX_P = null;
      return null;
    }
  })();
  EP_DATA_INDEX_P = p;
  return p;
}
function epDiscoverChapterFiles(base, names) {
  if (!names) return [];
  const prefix = base + '-';
  const found = [];
  for (const file of names) {
    if (!file.startsWith(prefix)) continue;
    const rest = file.slice(prefix.length).replace(/\.json$/i, '');
    const m = /^(.*?)(?:-(ex\d+[a-z]?))?$/i.exec(rest);
    if (!m) continue;
    const tail = m[1] || '';
    const ex = (m[2] || '').toLowerCase();
    // A bare exercise filename is the legacy/ALLEN bank, not a separate source.
    if (!tail && ex) continue;
    const source = tail ? slugify(tail) : LEGACY_SOURCE;
    if (!source) continue;
    found.push({ file, source, ex });
  }
  return found.sort((a, b) => a.file.localeCompare(b.file));
}
async function loadSourceFile(file, source, ex, tagKeys) {
  const res = await fetchExerciseFile(file);
  if (!res) return [];
  try {
    const raw = await res.json();
    const list = Array.isArray(raw) ? raw : (raw?.qs || raw?.questions || []);
    if (!Array.isArray(list)) { epRecordQuestionIssue(file, 'Unexpected JSON shape (expected an array or an object with a questions list).'); return []; }
    const meta = raw?.meta || {};
    const src = slugify(raw?.sourceId || raw?.sourceKey || source || '');
    const exId = String(raw?.exercise || raw?.meta?.exercise || ex || '').toLowerCase();
    const exerciseLabel = raw?.exerciseLabel || raw?.exerciseName || meta?.exerciseLabel || meta?.exerciseName || '';
    if (src && exId && String(exerciseLabel).trim()) EP_EXERCISE_LABELS[`${src}~${exId}`] = String(exerciseLabel).trim();
    const label = raw?.sourceLabel || raw?.sourceName || meta?.sourceLabel || meta?.sourceName || (typeof meta?.source === 'string' ? meta.source : '');
    if (src && label) {
      const lk = String(label).trim().toLowerCase();
      const clash = Object.keys(EP_SOURCE_LABELS).some(id => id !== src && String(EP_SOURCE_LABELS[id]).trim().toLowerCase() === lk);
      if (!clash) EP_SOURCE_LABELS[src] = String(label);
    }
    return list.map(q => {
      if (!q || typeof q !== 'object') return q;
      const o = { ...q, source: q.source ? slugify(q.source) : src, section: q.section || exId };
      if (tagKeys && !o.qKey && o.id != null && o.id !== '') o.qKey = `${tagKeys}#${o.source || 'x'}-${o.section || 'x'}-${String(o.id).toLowerCase()}`;
      return o;
    });
  } catch (e) { epRecordQuestionIssue(file, 'Invalid JSON response'); console.warn('[EduPulse] Bad JSON in', file, e); return []; }
}
// Same question in two sources -> keep the first, remember where else it appears (q.alsoIn).
function epDedupeAcrossSources(list) {
  const norm = x => String(x ?? '').toLowerCase().replace(/<[^>]*>/g, '').replace(/[^a-z0-9]+/g, '');
  const seen = new Map(), out = [];
  const EP_CURATED = new Set(['recommended', 'miniqbank']); // curated picks re-use questions on purpose: never dedupe them
  list.forEach(q => {
    if (!q || typeof q !== 'object' || q.needsImage || q.img || q.image || EP_CURATED.has(q.source)) { out.push(q); return; }
    const stem = norm(q.q ?? q.question), opts = (q.o || q.options || q.opts || []).map(norm).sort().join('|');
    if (stem.length < 10 || !opts) { out.push(q); return; }
    const k = stem + '#' + opts, first = seen.get(k);
    if (first && first.source !== q.source) { if (q.source) { first.alsoIn = first.alsoIn || []; if (!first.alsoIn.includes(q.source)) first.alsoIn.push(q.source); } return; }
    if (!first) seen.set(k, q);
    out.push(q);
  });
  return out;
}
async function loadRawBySlug(base, singleFileName) {
  const tagKeys = base.replace(/^(biology|chemistry|physics)-/, '');
  const names = await epDataIndex();
  let discovered = epDiscoverChapterFiles(base, names);
  // If GitHub's listing API is unavailable, keep old deployments working by probing
  // the standard legacy exercise names. No manifest is fetched or required.
  if (!names) {
    discovered = EX_IDS.map(ex => ({ file: `${base}-${ex}.json`, source: LEGACY_SOURCE, ex }));
    Object.keys(EP_SOURCE_LABELS).filter(id => id !== LEGACY_SOURCE).forEach(id =>
      EX_IDS.forEach(ex => discovered.push({ file: `${base}-${id}-${ex}.json`, source: id, ex })));
  }
  // Curated sets are always probed directly, so a stale/capped GitHub listing can never hide them.
  ['recommended', 'miniqbank'].forEach(id => { const f = `${base}-${id}.json`; if (!discovered.some(d => d.file === f)) discovered.push({ file: f, source: id, ex: '' }); });
  const epTotal = discovered.length; let epDone = 0; if (window.epLoadProgress) window.epLoadProgress(0, epTotal);
  const loaded = await Promise.all(discovered.map(e => Promise.resolve(loadSourceFile(e.file, e.source, e.ex, e.source === LEGACY_SOURCE ? '' : tagKeys)).finally(() => { epDone++; if (window.epLoadProgress) window.epLoadProgress(epDone, epTotal); })));
  let merged = loaded.flat();
  if (!merged.length) { // fallback: old single-file format
    try {
      const res = await fetchDataFile(singleFileName || `${base}.json`, { cache: 'no-cache' });
      if (res) { const raw = await res.json(); const list = Array.isArray(raw) ? raw : (raw?.qs || raw?.questions || []); if (Array.isArray(list)) merged = list; }
    } catch (e) { console.warn('[EduPulse] Single-file fallback failed:', base, e); }
  }
  merged = epDedupeAcrossSources(merged);
  // Repeated IDs across exercises/sources get stable, section-prefixed keys.
  const seen = new Set();
  merged.forEach(q => {
    if (!q || typeof q !== 'object' || q.id == null || q.id === '') return;
    const k = String(q.id).toLowerCase();
    if (seen.has(k) && !q.qKey) q.qKey = `${tagKeys}#${q.source || 'x'}-${q.section || 'x'}-${k}`;
    else seen.add(k);
  });
  return merged;
}
const loadChapterRaw = (subj, chapter) => loadRawBySlug(slugify(subj + ' ' + chapter), FILE_OVERRIDES[chapter]);
async function fetchDataFile(fileName, opts = {}) {
  const timeoutMs = 12000;
  const request = async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...opts, signal: controller.signal });
      return response.ok ? response : null;
    } catch (error) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const tryFile = async (name) => {
    // "/data/", "./data/" and "data/" usually resolve to the same URL: ask once per distinct URL, in order.
    const urls = [];
    DATA_BASES.forEach((base) => { try { const u = new URL(base + name, location.href).href; if (!urls.includes(u)) urls.push(u); } catch (e) { urls.push(base + name); } });
    for (const url of urls) { const r = await request(url); if (r) return r; }
    return null;
  };

  const response = await tryFile(fileName);
  if (response) return response;

  const legacy = LEGACY_FILES[fileName];
  if (legacy) {
    const legacyResponse = await tryFile(legacy);
    if (legacyResponse) return legacyResponse;
  }

  epRecordQuestionIssue(fileName, 'File could not be loaded from /data.');
  console.warn('[EduPulse] Could not load data file:', fileName);
  return null;
}

const data = {
Biology: ['Diversity in the Living World','Animal Kingdom','Morphology and Anatomy of Flowering Plants','Structural Organisation in Animals','Cell: The Unit of Life','Biomolecules','Cell Cycle and Cell Division','Photosynthesis in Plants','Respiration in Plants','Plant Growth and Development','Breathing and Exchange of Gases','Body Fluids and Circulation','Excretory Products and their Elimination','Locomotion and Movement','Neural Control and Coordination','Chemical Coordination and Integration','Sexual Reproduction in Flowering Plants','Human Reproduction','Reproductive Health','Principles of Inheritance and Variation','Molecular Basis of Inheritance','Evolution','Human Health and Disease','Microbes in Human Welfare','Biotechnology: Principles and Processes','Biotechnology and its Applications','Organisms and Populations','Ecosystem','Biodiversity and Conservation'],
Chemistry: ['Some Basic Concepts of Chemistry','Structure of Atom','Chemical Thermodynamics','Chemical and Ionic Equilibrium','Solutions','Electrochemistry and Redox Reactions','Chemical Kinetics','Classification of Elements and Periodicity','Chemical Bonding','p-Block Elements','d- and f-Block Elements','Coordination Compounds','Purification and Characterisation','General Organic Chemistry','Hydrocarbons','Haloalkanes and Haloarenes','Oxygen-Containing Compounds','Nitrogen-Containing Compounds','Biomolecules','Principles Related to Practical Chemistry'],
Physics: ['Units and Measurements','Motion in a Straight Line','Motion in a Plane','Laws of Motion','Work, Energy and Power','Rotational Motion','Gravitation','Mechanical Properties of Solids','Mechanical Properties of Fluids','Thermal Properties of Matter','Thermodynamics','Kinetic Theory of Gases','Oscillations','Waves','Electric Charges and Fields','Electrostatic Potential and Capacitance','Current Electricity','Moving Charges and Magnetism','Magnetism and Matter','Electromagnetic Induction','Alternating Current','Electromagnetic Waves','Ray Optics and Optical Instruments','Wave Optics','Dual Nature of Radiation and Matter','Atoms','Nuclei','Semiconductor Electronics']
};
const TOTAL_CHAPTERS = Object.values(data).reduce((n, l) => n + l.length, 0);

// Structured Vault Resources Array
const RESOURCE_VAULT_ITEMS = [
  { id: "sp999", title: "Allen NEET Portal", category: "JEE & NEET", subtag: "Batches", badge: "StudyPanda", url: "http://Amity18.carrd.co" },
  { id: "sp99", title: "Allen JEE Hub", category: "JEE", subtag: "Batches", badge: "JEE", url: "https://dusra-aur.github.io/alien-jaddu//" },
  { id: "sp0", title: "Unacademy Portal", category: "JEE & NEET", subtag: "Batches", badge: "Unacademy", url: "http://studyuk.online" },
  { id: "sp1", title: "StudyPanda Live", category: "JEE & NEET", subtag: "Batches", badge: "StudyPanda", url: "https://studypanda.live/" },
  { id: "jn1", title: "Allen Test Series", category: "JEE & NEET", subtag: "Tests", badge: "Allen Tests", url: "http://test.neetxnoah1.workers.dev" },
  { id: "jn2", title: "Pikachu PW Books", category: "JEE & NEET", subtag: "Books", badge: "PW Books", url: "https://pikachu-books.vercel.app/" },
  { id: "jn3", title: "PW Thor Engine", category: "JEE & NEET", subtag: "Batches", badge: "PW Batches", url: "https://pwthor.live" },
  { id: "jn5", title: "Pikachu CBT Tests", category: "JEE & NEET", subtag: "Tests", badge: "CBT Portal", url: "https://pikachuxcbt.vercel.app/" },
  { id: "jn6", title: "PDF to CBT Converter", category: "JEE & NEET", subtag: "Tests", badge: "CBT Converter", url: "http://newtcbt.vercel.app" },
  { id: "jn7", title: "Pikachu JEE CBT (PYQs)", category: "JEE & NEET", subtag: "PYQs", badge: "JEE PYQs", url: "https://pikachu-jee-cbt.vercel.app/" },
  { id: "jn8", title: "Marks App (MathonGo)", category: "JEE & NEET", subtag: "PYQs", badge: "PYQ App", url: "https://web.getmarks.app/" },
  { id: "jn10", title: "Delta Study Portal", category: "JEE & NEET", subtag: "Batches", badge: "Reddit Pick", url: "https://deltastudy.site" },
  { id: "jn11", title: "Ved Study Hub", category: "JEE & NEET", subtag: "Batches", badge: "Free Batches", url: "https://vedstudy.site" },
  { id: "jn13", title: "PW4Free Portal", category: "JEE & NEET", subtag: "Batches", badge: "Keyless Player", url: "https://pw4free.com" },
  { id: "pwe1", title: "PW Eduvibe CC Portal", category: "JEE & NEET", subtag: "Batches", badge: "Eduvibe", url: "https://pw.eduvibe.cc.cd/" },
  { id: "ev1", title: "Eduvibe Hub", category: "JEE & NEET", subtag: "Batches", badge: "Eduvibe", url: "https://eduvibe.cc.cd/" },
  { id: "rd1", title: "Anna's Archive Library", category: "Free Books", subtag: "Books", badge: "Shadow Library", url: "https://annas-archive.org/" },
  { id: "rd2", title: "FMHY Educational Megathread", category: "Productivity", subtag: "Books", badge: "Megathread", url: "https://fmhy.net/edupiracy" },
  { id: "26", title: "Perplexity AI Copilot", category: "AI & Study", subtag: "AI", badge: "Free Tier", url: "https://www.perplexity.ai" },
  { id: "cd3", title: "GitHub Developer Ecosystem", category: "Coding & Tech", subtag: "Books", badge: "Version Control", url: "https://github.com/" },
  { id: "fun1", title: "Wotaku Wiki Hub", category: "Fun & Media", subtag: "Fun", badge: "Wotaku", url: "https://wotaku.wiki/" }
];
let currentTab = 'dashboard', previousTab = 'dashboard', subject = 'Biology';
let userProgress = StorageModule.get(STORAGE_KEYS.progress, {});
let todos = StorageModule.get(STORAGE_KEYS.todos, []);
/* one-time cleanup: the app used to ship two sample tasks; drop them (only the untouched originals) from saved data */
if (Array.isArray(todos)) {
  const SAMPLE_TASKS = { td1: 'Revise Diversity in the Living World MCQs', td2: 'Solve Chemical Bonding PYQs' };
  const kept = todos.filter(t => !(t && SAMPLE_TASKS[t.id] === t.title));
  if (kept.length !== todos.length) { todos = kept; try { StorageModule.set(STORAGE_KEYS.todos, todos); } catch (e) {} }
}

// Batch Test Hub State
const TEST_REVIEW_KEY = 'edupulse_test_review_details_v1';
let mockSubTab = 'batch';
let batchCategoryFilter = 'All';
let selectedBatchSeries = null;
let selectedBatchSubject = 'Physics';
let batchTestsDatabase = [];

async function loadBatchTestsDatabase() {
  try {
    const res = await fetch('test/index.json', { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        batchTestsDatabase = data;
        return;
      }
    }
  } catch (e) {
    console.warn("Using default embedded batch test series:", e);
  }
  batchTestsDatabase = [];
}
loadBatchTestsDatabase();

/* Custom test generator promo, shared by the dashboard and the Tests screen */
function openCustomTestBuilder() {
  mockSubTab = 'generate';
  selectedBatchSeries = null;
  switchTab('mock');
}
function customTestCtaHtml() {
  return `<section class="ep-gen-cta" aria-label="Custom test generator">
    <span class="ep-gen-ic" aria-hidden="true"><i class="fa-solid fa-wand-magic-sparkles"></i></span>
    <div class="ep-gen-tx"><small>Custom test generator</small><b>Build your own NEET paper</b><span>Pick the subjects and chapters you want. We set the timer and marking.</span></div>
    <div class="ep-gen-chips" aria-hidden="true"><span>Full NEET · 180Q</span><span>Subject test</span><span>Chapter drill</span><span>AI special</span></div>
    <button type="button" class="ep-gen-go" onclick="openCustomTestBuilder()">Create a test <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
  </section>`;
}

function setMockSubTab(sub) {
  mockSubTab = ['batch', 'scheduled', 'generate', 'completed'].includes(sub) ? sub : 'batch';
  renderView();
}

function getTestAvailability(test) {
  const schedule = String(test?.schedule || '').split('|')[0].trim();
  const match = schedule.match(/\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/);
  const scheduledAt = match ? Date.parse(match[0]) : NaN;
  if (Number.isFinite(scheduledAt)) {
    const scheduledDay = new Date(scheduledAt);
    scheduledDay.setHours(23, 59, 59, 999);
    if (scheduledDay.getTime() < Date.now()) return 'past';
  }
  return test?.status === 'available' ? 'available' : 'scheduled';
}

function scheduledTestItems() {
  return (batchTestsDatabase || []).flatMap(series => (series.tests || [])
    .filter(test => getTestAvailability(test) === 'scheduled')
    .map(test => ({ series, test })));
}

function completedTestAttempts() {
  const attempts = StorageModule.get(STORAGE_KEYS.attempts, []);
  return (Array.isArray(attempts) ? attempts : [])
    .filter(attempt => attempt && (attempt.mode === 'test' || attempt.mode === 'mock'))
    .sort((a, b) => Number(b.finishedAt || 0) - Number(a.finishedAt || 0));
}

function buildScheduledTestsView() {
  const items = scheduledTestItems();
  if (!items.length) return '<div class="card p-8 text-center"><h3 class="text-base font-black">No upcoming scheduled tests</h3><p class="mt-2 text-sm text-slate-500">New future papers appear here when they are announced. Past papers remain available to practise from the series directory.</p><button type="button" class="mt-4 rounded-xl bg-teal-600 px-4 py-2 text-xs font-black text-white" onclick="setMockSubTab(\'batch\')">Browse practice papers</button></div>';
  return `<div class="space-y-4"><div class="card p-5"><h3 class="text-base font-black">Scheduled tests</h3><p class="mt-1 text-xs text-slate-500">Upcoming papers stay separate from tests you can start now.</p></div><div class="grid grid-cols-1 md:grid-cols-2 gap-4">${items.map(({ series, test }) => `<article class="card p-5 space-y-4"><div class="flex items-start justify-between gap-3"><div><p class="text-[11px] font-black uppercase tracking-wider text-teal-600">${escapeHtml(series.category || 'Batch series')}</p><h4 class="mt-1 font-black">${escapeHtml(test.title)}</h4><p class="mt-1 text-xs text-slate-500">${escapeHtml(series.title)}</p></div><span class="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-black text-amber-700 dark:text-amber-300">Scheduled</span></div><div class="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60"><div><b class="block">${Number(test.questions) || '—'}</b><small class="text-[11px] uppercase text-slate-400">Questions</small></div><div><b class="block">${Number(test.marks) || '—'}</b><small class="text-[11px] uppercase text-slate-400">Marks</small></div><div><b class="block">${Number(test.timeMins) || '—'}m</b><small class="text-[11px] uppercase text-slate-400">Duration</small></div></div><div class="flex items-center justify-between gap-3"><span class="text-xs text-slate-500"><i class="fa-regular fa-calendar mr-1 text-teal-600"></i>${escapeHtml(test.schedule || 'Date to be announced')}</span><button type="button" class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-slate-700" onclick="openBatchSyllabusModal('${jsArg(test.title)}', ${JSON.stringify(test.syllabus || []).replace(/"/g, '&quot;')})">View syllabus</button></div></article>`).join('')}</div></div>`;
}

function buildCompletedTestsView() {
  const attempts = completedTestAttempts();
  if (!attempts.length) return `<section class="ct-empty"><span class="ct-empty-ic"><i class="fa-solid fa-clipboard-check" aria-hidden="true"></i></span><h3>No completed tests yet</h3><p>Finish a test and your score, accuracy and question-by-question analysis will collect here.</p><div class="ct-empty-acts"><button type="button" class="ct-btn main" onclick="setMockSubTab('batch')"><i class="fa-solid fa-layer-group" aria-hidden="true"></i> Browse series</button><button type="button" class="ct-btn" onclick="setMockSubTab('generate')"><i class="fa-solid fa-sliders" aria-hidden="true"></i> Custom test</button></div></section>`;
  const reviews = StorageModule.get(TEST_REVIEW_KEY, {}) || {};
  const acc = item => Math.max(0, Math.min(100, Number(item.accuracy) || 0));
  const tone = v => v >= 70 ? 'good' : v >= 40 ? 'mid' : 'low';
  const average = Math.round(attempts.reduce((sum, item) => sum + acc(item), 0) / attempts.length);
  const best = Math.max(...attempts.map(acc));
  const latest = attempts[0], previous = attempts[1];
  const delta = previous ? acc(latest) - acc(previous) : null;
  const recent = attempts.slice(0, 8).reverse();
  const bars = recent.map((item, i) => {
    const v = acc(item);
    return `<div class="ct-bar ${tone(v)}${i === recent.length - 1 ? ' last' : ''}" title="${escapeHtml(item.chapter || 'Test')} · ${v}%"><span>${v}%</span><i style="height:${Math.max(6, v)}%"></i><small>${i + 1}</small></div>`;
  }).join('');
  const mins = a => Math.round((Number(a.timeSpentSeconds) || 0) / 60);
  const history = attempts.map(attempt => {
    const v = acc(attempt);
    const c = Number(attempt.correct) || 0, w = Number(attempt.wrong) || 0, k = Number(attempt.skipped) || 0, tot = Math.max(1, c + w + k);
    const date = attempt.finishedAt ? new Date(attempt.finishedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Date unavailable';
    const reviewable = Array.isArray(reviews[attempt.id]?.questions) && reviews[attempt.id].questions.length > 0;
    const id = jsArg(attempt.id);
    return `<article class="ct-item">
      <div class="ct-top">
        <span class="ct-score ${tone(v)}" style="--p:${v}"><b>${v}%</b></span>
        <div class="ct-meta"><h4>${escapeHtml(attempt.chapter || 'Completed test')}</h4><p>${escapeHtml(attempt.subject || 'Mixed subjects')} · ${escapeHtml(date)}</p></div>
      </div>
      <div class="ct-split" role="img" aria-label="${c} correct, ${w} incorrect, ${k} skipped"><i class="g" style="width:${c / tot * 100}%"></i><i class="r" style="width:${w / tot * 100}%"></i><i class="s" style="width:${k / tot * 100}%"></i></div>
      <div class="ct-legend"><span><u class="g"></u>${c} correct</span><span><u class="r"></u>${w} wrong</span><span><u class="s"></u>${k} skipped</span></div>
      <div class="ct-facts"><span><i class="fa-solid fa-star" aria-hidden="true"></i> ${Number(attempt.score) || 0}/${Number(attempt.maxScore) || 0} marks</span>${attempt.timeSpentSeconds ? `<span><i class="fa-regular fa-clock" aria-hidden="true"></i> ${mins(attempt)} min</span>` : ''}</div>
      <div class="ct-acts">
        <button type="button" class="ct-btn main" onclick="openTestAnalysis('${id}')"><i class="fa-solid fa-chart-pie" aria-hidden="true"></i> Analyze</button>
        <button type="button" class="ct-btn" ${reviewable ? '' : 'disabled'} onclick="practiceFromTest('${id}','missed')">Revise missed</button>
        <button type="button" class="ct-btn" ${reviewable ? '' : 'disabled'} onclick="practiceFromTest('${id}','marked')">Flagged</button>
      </div>
    </article>`;
  }).join('');
  return `<div class="ct">
    <section class="ct-stats">
      <div><small>Tests done</small><b>${attempts.length}</b></div>
      <div><small>Average</small><b>${average}%</b></div>
      <div><small>Best</small><b>${best}%</b></div>
    </section>
    <section class="ct-card">
      <div class="ct-card-h"><div><h3>Accuracy trend</h3><p>Last ${recent.length} test${recent.length === 1 ? '' : 's'}</p></div>${delta === null ? '' : `<span class="ct-chip ${delta >= 0 ? 'up' : 'down'}"><i class="fa-solid ${delta >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}" aria-hidden="true"></i> ${delta >= 0 ? '+' : ''}${delta} pts</span>`}</div>
      <div class="ct-bars" role="img" aria-label="Accuracy trend from ${recent.length} recent tests">${bars}</div>
    </section>
    ${previous ? `<section class="ct-vs"><div class="now"><small>Latest</small><b>${acc(latest)}%</b><span>${Number(latest.score) || 0}/${Number(latest.maxScore) || 0} marks · ${mins(latest)} min</span></div><div><small>Previous</small><b>${acc(previous)}%</b><span>${Number(previous.score) || 0}/${Number(previous.maxScore) || 0} marks · ${mins(previous)} min</span></div></section>` : ''}
    <h3 class="ct-h">Attempt history</h3>
    <section class="ct-list">${history}</section>
  </div>`;
}

function openBatchSeriesDetail(seriesId) {
  selectedBatchSeries = batchTestsDatabase.find(s => s.id === seriesId) || batchTestsDatabase[0];
  selectedBatchSubject = 'Physics';
  renderView();
}

function closeBatchSeriesDetail() {
  selectedBatchSeries = null;
  renderView();
}

function openBatchSyllabusModal(testTitle, syllabusList = []) {
  setModal(`Syllabus — ${testTitle}`, 'Target topics covered in this CBT test:', `
    <div class="space-y-3 py-2 text-xs">
      <div class="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-300 font-bold flex items-center gap-2">
        <i class="fa-solid fa-list-check"></i>
        <span>Target Syllabus Breakdown</span>
      </div>
      <ul class="space-y-2">
        ${(syllabusList.length ? syllabusList : ['Complete Chapter Concepts', 'NCERT Exemplar Numericals', 'PYQ Statement Variations']).map(s => `
          <li class="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200">
            <i class="fa-solid fa-circle-check text-emerald-500 text-xs"></i>
            <span>${escapeHtml(s)}</span>
          </li>
        `).join('')}
      </ul>
    </div>
  `, `<button onclick="closeModal()" class="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-xs">Close</button>`);
}

async function startBatchTestAttempt(testObj, seriesTitle) {
  setModal('Preparing CBT Test Paper', testObj.title, `
    <div class="flex flex-col items-center justify-center py-10 space-y-4">
      <i class="fa-solid fa-spinner fa-spin text-4xl text-teal-600 mb-2"></i>
      <p class="text-sm font-black text-slate-800 dark:text-slate-100">Loading ${testObj.questions} Questions for ${escapeHtml(testObj.title)}...</p>
      <span class="text-xs text-slate-500 font-bold">${seriesTitle}</span>
    </div>
  `);

  try {
    let rawQuestions = null;
    const fetchPath = testObj.dataFile || `test/${testObj.id}.json`;

    try {
      let res = await fetch(fetchPath, { cache: 'no-cache' }).catch(() => null);
      if (!res || !res.ok) res = await fetchDataFile(fetchPath.split('/').pop(), { cache: 'no-cache' });
      if (res && res.ok) {
        const raw = await res.json();
        const list = Array.isArray(raw) ? raw : (raw.qs || raw.questions || []);
        if (list.length > 0) {
          rawQuestions = list.map((q, i) => { const nq = normalizeQuestion(q, i, testObj.title); return nq && { ...nq, qKey: nq.qKey || `batch_${testObj.id}_${i}`, subject: testObj.subject, sourceChapter: testObj.title }; }).filter(Boolean);
        }
      }
    } catch (e) {
      console.warn("Could not fetch test path, using fallback generator:", e);
    }

    // The chapter file is now split per exercise (<name>-ex1.json ...): load and merge them.
    if (!rawQuestions && /(^|\/)data\//.test(fetchPath)) {
      const list = await loadRawBySlug(fetchPath.split('/').pop().replace(/\.json$/i, ''));
      if (list.length) {
        rawQuestions = list.map((q, i) => { const nq = normalizeQuestion(q, i, testObj.title); return nq && { ...nq, qKey: nq.qKey || `batch_${testObj.id}_${i}`, subject: testObj.subject, sourceChapter: testObj.title }; }).filter(Boolean);
      }
    }

    if (!rawQuestions || !rawQuestions.length) {
      rawQuestions = generateFallbackQuestions(testObj.subject || 'Physics', testObj.title);
    }

    wizardState.durationMins = testObj.timeMins || 180;
    launchTestSession(testObj.subject || 'NEET CBT', `${seriesTitle} — ${testObj.title}`, rawQuestions);
  } catch (err) {
    showToast('Failed to start test: ' + err.message, 'error');
    closeModal();
  }
}

// ===== Multi-Step Generator State =====
let pendingWizardQuestions = null;
let wizardState = {
  step: 1, 
  format: 'full_180',
  qCount: 180,
  durationMins: 180,
  difficulty: 'mixed',
  source: 'All',
  selectedSubjects: ['Biology', 'Chemistry', 'Physics'],
  selectedChapters: { Biology: [], Chemistry: [], Physics: [] }
};

function wizardSetStep(s) {
  wizardState.step = s;
  renderView();
}

function launchGeneratedWizardTest() {
  const questions = pendingWizardQuestions;
  if (!Array.isArray(questions) || !questions.length) return showToast('Generate a test paper before starting.', 'warning');
  pendingWizardQuestions = null;
  closeModal();
  launchTestSession(wizardState.selectedSubjects.join(' & '), `NEET Mock Simulation (${questions.length}Q)`, questions);
}

function wizardSelectFormat(fmt, count, mins) {
  wizardState.format = fmt;
  wizardState.qCount = count;
  wizardState.durationMins = mins;

  if (fmt === 'full_180') {
    wizardState.selectedSubjects = ['Biology', 'Chemistry', 'Physics'];
  } else if (fmt === 'subject_major') {
    wizardState.selectedSubjects = ['Biology'];
  }
  wizardSetStep(2);
}

function wizardSetQuestionCount(value) {
  const parsed = Number(value);
  wizardState.qCount = Number.isFinite(parsed) ? Math.max(1, Math.min(180, Math.round(parsed))) : 180;
  wizardState.durationMins = wizardState.qCount;
  renderView();
}

function wizardSetDifficulty(value) {
  wizardState.difficulty = value;
  renderView();
}

function wizardSetSource(value) {
  wizardState.source = value;
  renderView();
}

function wizardToggleSubject(subj) {
  const idx = wizardState.selectedSubjects.indexOf(subj);
  if (idx > -1) {
    if (wizardState.selectedSubjects.length === 1) {
      showToast('At least one subject must be selected.', 'warning');
      return;
    }
    wizardState.selectedSubjects.splice(idx, 1);
  } else {
    wizardState.selectedSubjects.push(subj);
  }
  renderView();
}

function wizardToggleChapter(subj, ch) {
  if (!wizardState.selectedChapters[subj]) wizardState.selectedChapters[subj] = [];
  const idx = wizardState.selectedChapters[subj].indexOf(ch);
  if (idx > -1) {
    wizardState.selectedChapters[subj].splice(idx, 1);
  } else {
    wizardState.selectedChapters[subj].push(ch);
  }
  renderView();
}

function wizardSelectAllChapters(subj) {
  wizardState.selectedChapters[subj] = [...data[subj]];
  renderView();
}

function wizardClearChapters(subj) {
  wizardState.selectedChapters[subj] = [];
  renderView();
}

async function buildFull180qMock() {
  const subjects = wizardState.selectedSubjects;
  const count = Math.max(1, Math.min(180, Number(wizardState.qCount) || 180));
  const ntaWeights = subjects.length === 3 ? { Biology: 2, Chemistry: 1, Physics: 1 } : {};
  const weightTotal = subjects.reduce((sum, item) => sum + (ntaWeights[item] || 1), 0);
  const allocations = subjects.map((item, index) => {
    const exact = count * (ntaWeights[item] || 1) / weightTotal;
    return { item, index, exact, count: Math.floor(exact) };
  });
  let remainder = count - allocations.reduce((sum, item) => sum + item.count, 0);
  allocations.slice().sort((a, b) => (b.exact - b.count) - (a.exact - a.count) || a.index - b.index).slice(0, remainder).forEach(item => {
    allocations.find(entry => entry.item === item.item).count++;
  });
  const quotaBySubject = Object.fromEntries(allocations.map(item => [item.item, item.count]));
  const stats = StorageModule.get(STORAGE_KEYS.qstats, {}) || {};
  const assembledQuestions = [];

  for (const subjectName of subjects) {
    const required = quotaBySubject[subjectName] || 0;
    if (!required) continue;
    const chapters = wizardState.selectedChapters[subjectName]?.length ? wizardState.selectedChapters[subjectName] : data[subjectName];
    const subjectQuestions = [];

    for (const chapterName of chapters) {
      if (subjectQuestions.length >= required * 2) break;
      try {
        const questions = await loadChapterRaw(subjectName, chapterName);
        questions.forEach((rawQuestion, index) => {
          const question = normalizeQuestion(rawQuestion, index, chapterName);
          if (!question) return;
          const stat = stats[question.qKey] || {};
          const rawDifficulty = String(question.difficulty || question.level || '').toLowerCase();
          const matchesDifficulty = wizardState.difficulty === 'mixed' || !rawDifficulty ||
            (wizardState.difficulty === 'easy' && /easy|basic|beginner/.test(rawDifficulty)) ||
            (wizardState.difficulty === 'moderate' && /moderate|medium|intermediate/.test(rawDifficulty)) ||
            (wizardState.difficulty === 'difficult' && /difficult|hard|advanced/.test(rawDifficulty));
          const sourceText = [question.source, question.sourceName, question.sourceTitle, question.book, question.exam, question.year].filter(Boolean).join(' ');
          let matchesSource = true;
          if (wizardState.source === 'PYQ only') matchesSource = !!(question.exam || question.year || /pyq/i.test(sourceText));
          else if (wizardState.source === 'NCERT only') matchesSource = /ncert/i.test(sourceText);
          else if (wizardState.source === 'Previously wrong') matchesSource = (stat.wrong || 0) > 0 || (stat.seen || 0) > (stat.correct || 0);
          else if (wizardState.source === 'Unseen') matchesSource = !stat.seen;
          if (!matchesDifficulty || !matchesSource) return;
          subjectQuestions.push({ ...question, subject: subjectName, qKey: question.qKey || `test_${slugify(chapterName)}_${question.id || index}`, sourceChapter: `${subjectName}: ${chapterName}` });
        });
      } catch (error) {
        console.warn(`Local mock load error for ${chapterName}:`, error);
      }
    }

    subjectQuestions.sort(() => Math.random() - 0.5);
    assembledQuestions.push(...subjectQuestions.slice(0, required));
  }

  assembledQuestions.sort(() => Math.random() - 0.5);
  return assembledQuestions;
}

async function executeWizardTestGeneration() {
  const qCount = wizardState.qCount;
  const selectedSubs = wizardState.selectedSubjects;

  setModal('NEETprep Exam Engine', 'Assembling paper structure...', `
    <div class="flex flex-col items-center justify-center py-10 space-y-4">
      <i class="fa-solid fa-wand-magic-sparkles fa-spin text-4xl text-teal-600 mb-2"></i>
      <p class="text-sm font-black text-slate-800 dark:text-slate-100">Generating ${qCount} Questions Test Paper...</p>
      <span class="text-xs text-slate-500 font-bold">Subjects: ${selectedSubs.join(', ')}</span>
    </div>
  `);

  try {
    let rawQuestions = [];
    const apiKey = getGeminiApiKey();

    if (wizardState.format === 'ai_drill' && apiKey) {
      let promptChapters = [];
      selectedSubs.forEach(s => {
        const chs = wizardState.selectedChapters[s]?.length ? wizardState.selectedChapters[s] : [data[s][0]];
        promptChapters.push(...chs.map(c => `${s}: ${c}`));
      });

      const prompt = `Generate ${qCount} high-yield NEET MCQs covering: ${promptChapters.join(', ')}. Difficulty: ${wizardState.difficulty}. Match this source style when possible: ${wizardState.source}. Return strictly valid JSON array: [{"q":"...","o":["A","B","C","D"],"a":1,"s":"..."}]`;
      const sys = "Output only valid JSON arrays for NEET question banks.";
      const rawJson = await callGeminiApi(prompt, sys);
      const cleanJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      rawQuestions = parsed.map((q, i) => ({
        qKey: 'ai_wizard_' + Date.now() + '_' + i,
        question: q.q,
        options: q.o,
        correct: (q.a || 1) - 1,
        explanation: q.s || 'NCERT Line-by-Line concept.',
        subject: selectedSubs.find(subjectName => promptChapters[i % promptChapters.length].startsWith(subjectName)) || selectedSubs[0],
        sourceChapter: promptChapters[i % promptChapters.length] || selectedSubs[0]
      }));
    } else {
      rawQuestions = await buildFull180qMock();
      if (rawQuestions.length > qCount) rawQuestions = rawQuestions.slice(0, qCount);
    }

    if (rawQuestions.length > qCount) rawQuestions = rawQuestions.slice(0, qCount);
    if (!rawQuestions.length) throw new Error('No practice questions available for the selected choices.');

    pendingWizardQuestions = rawQuestions;
    const bySubject = rawQuestions.reduce((counts, question) => { const name = question.subject || 'Mixed'; counts[name] = (counts[name] || 0) + 1; return counts; }, {});
    const allocation = Object.entries(bySubject).map(([name, count]) => `${escapeHtml(name)}: ${count}`).join(' · ');
    const selectedTopics = selectedSubs.flatMap(name => wizardState.selectedChapters[name]?.length ? wizardState.selectedChapters[name].map(chapter => `${name}: ${chapter}`) : []).join(' · ');
    setModal('Review custom test', 'Confirm the paper before the timed attempt begins.', `<div class="space-y-3"><div class="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-4"><b class="block text-2xl font-black text-teal-700 dark:text-teal-300">${rawQuestions.length} questions ready</b><span class="text-xs text-slate-500">${qCount} requested · the paper is capped to the matching questions actually available.</span></div><p class="text-xs"><b>Subjects:</b> ${escapeHtml(selectedSubs.join(', '))}</p><p class="text-xs"><b>Question mix:</b> ${allocation}</p>${selectedTopics ? `<p class="text-xs"><b>Selected chapters:</b> ${escapeHtml(selectedTopics)}</p>` : ''}<p class="text-xs"><b>Duration:</b> ${wizardState.durationMins} minutes · <b>Scoring:</b> +${Number((StorageModule.get(STORAGE_KEYS.settings, defaultSettings)||{}).marksCorrect)||4} / ${Number((StorageModule.get(STORAGE_KEYS.settings, defaultSettings)||{}).marksWrong??-1)} marks</p><p class="text-[11px] text-slate-500">You can still adjust the filters, or start this timed test now.</p></div>`, `<button type="button" onclick="pendingWizardQuestions=null;closeModal();wizardSetStep(2)" class="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold dark:border-slate-700">Adjust filters</button><button type="button" onclick="launchGeneratedWizardTest()" class="rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-black text-white">Start ${rawQuestions.length}-question test</button>`);
  } catch (err) {
    showToast('Generation failed: ' + err.message, 'error');
    closeModal();
  }
}

const quizState = {
mode: 'practice',
chapter: '',
subject: '',
title: '',
questions: [],
currentIndex: 0,
userAnswers: {},
marked: {},
bookmarked: {},
skippedQuestions: {},
questionTimes: {},
questionStartTimer: Date.now(),
testEndTimestamp: null,
practiceDeadlineTimestamp: null,
practiceTimeExpired: false,
tabSwitches: 0,
paletteExpanded: false,
timerInterval: null,
touchStartX: 0,
touchStartY: 0,
touchEndX: 0,
touchEndY: 0,
infinite: null
};

function togglePaletteDrawer(forceState) {
  const palette = document.querySelector('.palette-drawer-top');
  if (!palette) return;

  // Explicit state prevents a tap on the chevron/header from double-toggling.
  quizState.paletteExpanded = typeof forceState === 'boolean'
    ? forceState
    : !palette.classList.contains('is-expanded');

  const expanded = quizState.paletteExpanded;
  palette.classList.toggle('is-expanded', expanded);
  palette.dataset.expanded = String(expanded);
  palette.setAttribute('aria-expanded', String(expanded));

  const trigger = palette.querySelector('.palette-expand-trigger');
  if (trigger) {
    trigger.setAttribute('aria-expanded', String(expanded));
    trigger.setAttribute('aria-label', expanded ? 'Collapse question palette' : 'Expand question palette');
    trigger.title = expanded ? 'Collapse question palette' : 'Expand question palette';
    const icon = trigger.querySelector('i');
    if (icon) icon.className = `fa-solid ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-xs`;
  }

  const compactRow = palette.children[1];
  const expandedPanel = palette.querySelector('.palette-expanded-content');
  if (expandedPanel) {
    expandedPanel.style.setProperty('display', expanded ? 'block' : 'none', 'important');
    expandedPanel.setAttribute('aria-hidden', String(!expanded));
  }
  palette.style.setProperty('max-height',
    expanded ? 'min(54dvh, 430px)' : 'none', 'important');
  palette.style.setProperty('overflow-y', expanded ? 'auto' : 'hidden', 'important');
  palette.style.setProperty('overflow-x', 'hidden', 'important');
  if (compactRow) compactRow.style.setProperty('display', expanded ? 'none' : 'flex', 'important');

  // When opening, show the current question in the expanded grid.
  if (expanded && expandedPanel) {
    const currentButton = expandedPanel.querySelector('.palette-touch-btn.ring-2, .palette-touch-btn.active');
    if (currentButton) currentButton.scrollIntoView({block:'nearest', inline:'nearest'});
  } else {
    palette.scrollTop = 0;
  }
}

function openImageZoom(src) { setModal('Question diagram', '', `<img src="${escapeHtml(src)}" alt="Expanded question diagram" class="w-full max-h-[75vh] object-contain rounded-2xl">`, `<button onclick="closeModal()" class="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold">Close</button>`); }
function handleTouchStart(e) {
  if (e.touches && e.touches.length > 0) { quizState.touchStartX = e.touches[0].clientX; quizState.touchStartY = e.touches[0].clientY; }
}

function handleTouchMove(e) {
  if (e.touches && e.touches.length > 0) {
    quizState.touchEndX = e.touches[0].clientX;
    quizState.touchEndY = e.touches[0].clientY;
  }
}

function handleTouchEnd() {
  if (!quizState.touchStartX || !quizState.touchEndX) return;
  const diffX = quizState.touchStartX - quizState.touchEndX;
  const diffY = quizState.touchStartY - (quizState.touchEndY || quizState.touchStartY);
  const minSwipeDistance = 50;
  const settings = StorageModule.get(STORAGE_KEYS.settings, defaultSettings);
  if (!settings.swipeNavigation || Math.abs(diffX) <= Math.abs(diffY) * 2) {
    quizState.touchStartX = 0; quizState.touchEndX = 0; return;
  }

  if (diffX > minSwipeDistance) {
    if (quizState.currentIndex < quizState.questions.length - 1) {
      if (quizState.mode === 'practice') goToNextPracticeQuestion();
      else jumpToTestQuestion(quizState.currentIndex + 1);
    }
  } else if (diffX < -minSwipeDistance) {
    if (quizState.currentIndex > 0) {
      if (quizState.mode === 'practice') jumpToPracticeQuestion(quizState.currentIndex - 1);
      else jumpToTestQuestion(quizState.currentIndex - 1);
    }
  }

  quizState.touchStartX = 0;
  quizState.touchEndX = 0;
}

function saveErrorNotebookEntry(q, selected, reason = 'Not tagged') {
  if (!q?.qKey) return;
  const notebook = StorageModule.get(STORAGE_KEYS.errorNotebook, {});
  const existing = notebook[q.qKey] || { q, attempts: [] };
  existing.q = q;
  existing.attempts.unshift({ selected, correct: q.correct, reason, date: new Date().toISOString() });
  existing.attempts = existing.attempts.slice(0, 10);
  notebook[q.qKey] = existing;
  StorageModule.set(STORAGE_KEYS.errorNotebook, notebook);
}
function tagWrongReason(reason) {
  const index = quizState.currentIndex;
  const q = quizState.questions[index];
  if (!q || quizState.userAnswers[index] === q.correct) return;
  quizState.wrongReasons[index] = reason;
  saveErrorNotebookEntry(q, quizState.userAnswers[index], reason);
  persistQuizSession();
  renderPracticeQuiz();
}
function toggleEliminatedOption(i) {
  const index = quizState.currentIndex;
  quizState.eliminatedOptions[index] = quizState.eliminatedOptions[index] || {};
  quizState.eliminatedOptions[index][i] = !quizState.eliminatedOptions[index][i];
  persistQuizSession();
  renderPracticeQuiz();
}
function skipCurrentQuestion() {
  quizState.skippedQuestions[quizState.currentIndex] = true;
  persistQuizSession();
  if (quizState.currentIndex < quizState.questions.length - 1) goToNextPracticeQuestion();
  else finishPracticeQuiz();
}
function saveToLocalStorage() {
StorageModule.set(STORAGE_KEYS.todos, todos);
StorageModule.set(STORAGE_KEYS.progress, userProgress);
}

function showToast(msg, type = 'success') {
const container = document.getElementById('toast-container');
if (!container) return;
const toast = document.createElement('div');
const bg = type === 'error' ? 'bg-rose-600 text-white' : type === 'warning' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-teal-600 text-white';
toast.className = `px-4 py-3 rounded-2xl shadow-xl text-xs font-bold ${bg} transition-all duration-300 translate-y-2 opacity-0 pointer-events-auto flex items-center gap-2`;
toast.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i> ${escapeHtml(msg)}`;
container.appendChild(toast);
setTimeout(() => { toast.classList.remove('translate-y-2', 'opacity-0'); }, 20);
setTimeout(() => {
toast.classList.add('translate-y-2', 'opacity-0');
setTimeout(() => toast.remove(), 300);
}, 3000);
}

function escapeHtml(v = '') {
return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
const EP_MATH_RE = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/;
function epMath(tex, display) {
  try { if (window.katex) return katex.renderToString(tex, { throwOnError: false, displayMode: !!display, output: 'html' }); } catch (e) {}
  return `<span class="ep-math-raw">${escapeHtml(tex)}</span>`;
}
function epRichText(v, plain) {
  return String(v ?? '').split(EP_MATH_RE).map(p => {
    if (p.length > 4 && p.startsWith('$$') && p.endsWith('$$')) return epMath(p.slice(2, -2), true);
    if (p.length > 2 && p[0] === '$' && p.endsWith('$')) return epMath(p.slice(1, -1), false);
    return plain(p);
  }).join('');
}
const multiline = v => epRichText(v, t => escapeHtml(t).replace(/\n/g, '<br>'));
const formatQuizText = v => epRichText(v, t => escapeHtml(t).replace(/\^([0-9+−-]+)/g, '<sup>$1</sup>').replace(/_([0-9]+)/g, '<sub>$1</sub>').replace(/\n/g, '<br>'));
const jsArg = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '\\n');

function simpleHash(str) {
let hash = 0;
for (let i = 0; i < str.length; i++) {
hash = ((hash << 5) - hash) + str.charCodeAt(i);
hash |= 0;
}
return Math.abs(hash).toString(36);
}

function toggleMobileNav(open) {
const sidebar = document.getElementById('sidebarDrawer');
const overlay = document.getElementById('navOverlay');
if (!sidebar || !overlay) return;
if (open === undefined) open = !sidebar.classList.contains('mobile-open');
if (open) {
sidebar.classList.add('mobile-open');
overlay.classList.add('open');
} else {
sidebar.classList.remove('mobile-open');
overlay.classList.remove('open');
}
}

const EP_APP_THEMES = ['light', 'dark', 'amoled', 'forest', 'aurora', 'ocean', 'sunset', 'sepia'];
const EP_OPTIONAL_ENTITLEMENTS = Object.freeze({ advancedAnalytics: 'premium', visualAiExplanations: 'premium', extendedMockHistory: 'premium' });
function epFeatureAvailable(feature) {
  if (!EP_OPTIONAL_ENTITLEMENTS[feature]) return true;
  const provider = window.EduPulseEntitlementsProvider;
  if (!provider || typeof provider.isFeatureAvailable !== 'function') return true;
  try { return provider.isFeatureAvailable(feature) !== false; } catch (error) { return true; }
}
// No provider means every current feature stays free; any future paid API must verify entitlements server-side.
window.EP_ENTITLEMENTS = Object.freeze({ plan: function(){const provider=window.EduPulseEntitlementsProvider;return provider&&typeof provider.getPlan==='function'?provider.getPlan():'free';}, isFeatureAvailable: epFeatureAvailable, optionalFeatures: EP_OPTIONAL_ENTITLEMENTS });
function applyTheme(theme, persist = false) {
  const next = EP_APP_THEMES.includes(theme) ? theme : 'light';
  const isDark = !['light', 'sepia'].includes(next);
  document.documentElement.classList.toggle('dark', isDark);
  document.body.classList.toggle('dark', isDark);
  document.body.classList.remove('theme-amoled', 'theme-forest', 'theme-aurora', 'theme-ocean', 'theme-sunset', 'theme-sepia');
  if (['amoled', 'forest', 'aurora', 'ocean', 'sunset', 'sepia'].includes(next)) document.body.classList.add('theme-' + next);
  document.documentElement.dataset.theme = next;
  document.body.dataset.theme = next;
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  const accessibilitySettings = StorageModule.get(STORAGE_KEYS.settings, defaultSettings) || {};
  document.documentElement.classList.toggle('ep-high-contrast', !!accessibilitySettings.highContrast);
  document.body.classList.toggle('ep-high-contrast', !!accessibilitySettings.highContrast);
  const meta = document.querySelector('meta[name="theme-color"]');
  const themeColors = { light: '#0d9488', dark: '#070a12', amoled: '#000000', forest: '#0b1c15', aurora: '#15152d', ocean: '#0a1b2e', sunset: '#241419', sepia: '#fbf5e6' };
  if (meta) meta.setAttribute('content', themeColors[next]);
  if (persist) {
    try { localStorage.setItem(STORAGE_KEYS.theme, next); } catch (err) { console.warn('Theme preference could not be saved:', err); }
  }
  const picker = document.getElementById('ep-theme-select');
  if (picker) picker.value = next;
  const toggle = document.querySelector('[onclick="toggleTheme()"]');
  if (toggle) {
    toggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    toggle.setAttribute('aria-pressed', String(isDark));
  }
}
function initTheme() {
  let saved = 'light';
  try { saved = localStorage.getItem(STORAGE_KEYS.theme) || 'light'; } catch (err) {}
  applyTheme(saved);
}
function toggleTheme() {
  applyTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark', true);
}
initTheme();

document.addEventListener('keydown', e => {
  const modal = document.getElementById('appModal');
  if (!modal?.classList.contains('open')) return;
  // Escape closes normal dialogs (never an in-progress full-screen quiz/test)
  if (e.key === 'Escape' && !modal.classList.contains('fullscreen-modal')) { closeModal(); return; }
  const el = document.activeElement;
  if (el?.matches('input,textarea,select,[contenteditable="true"]')) return;
  // Shortcuts below are for practice mode only (not timed tests)
  if (quizState.mode !== 'practice' || !quizState.questions.length) return;
  const onControl = !!el?.matches('button,a,[role="button"]');
  if (/^[1-5]$/.test(e.key) && Number(e.key) <= (quizState.questions[quizState.currentIndex]?.options?.length || 4) && quizState.userAnswers[quizState.currentIndex] === undefined) { e.preventDefault(); selectPracticeOption(Number(e.key)-1); }
  else if ((e.key === 'Enter' || e.key === ' ') && onControl) { return; } // let focused buttons behave normally
  else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (quizState.userAnswers[quizState.currentIndex] !== undefined) goToNextPracticeQuestion(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); jumpToPracticeQuestion(quizState.currentIndex - 1); }
  else if (e.key.toLowerCase() === 'b') { quizState.bookmarked[quizState.currentIndex] = !quizState.bookmarked[quizState.currentIndex]; persistQuizSession(); renderPracticeQuiz(); }
  else if (e.key.toLowerCase() === 's' && quizState.userAnswers[quizState.currentIndex] === undefined && !quizState.reviewMode) { quizState.skippedQuestions[quizState.currentIndex] = true; persistQuizSession(); goToNextPracticeQuestion(); }
});
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
function countOfflineQuestionFiles() {
  if (!('caches' in window)) return Promise.resolve(0);
  return caches.keys().then(names => Promise.all(names.map(name => caches.open(name).then(cache => cache.keys()).catch(() => []))))
    .then(groups => { const urls = new Set(); groups.flat().forEach(request => { try { const url = new URL(request.url); if (url.pathname.includes('/data/') && /\\.json$/i.test(url.pathname)) urls.add(url.href); } catch (error) {} }); return urls.size; })
    .catch(() => 0);
}
function refreshOfflineAvailability(online) {
  const badge = document.getElementById('offline-badge');
  const label = document.getElementById('offline-label');
  if (!badge) return Promise.resolve(0);
  if (online) { if (label) label.textContent = 'Offline'; badge.setAttribute('aria-label', 'Online. Cloud backup can sync.'); return Promise.resolve(0); }
  return countOfflineQuestionFiles().then(count => {
    if (window.EP_DIAGNOSTICS) window.EP_DIAGNOSTICS.cachedQuestionFiles = count;
    if (label) label.textContent = count ? 'Offline · ' + count + ' cached files' : 'Offline · app only';
    badge.setAttribute('aria-label', count ? 'Offline. ' + count + ' cached question files are available.' : 'Offline. No question files are cached yet; the app shell is available.');
    return count;
  });
}
function updateOnlineStatus() {
const online = navigator.onLine;
const badge = document.getElementById('offline-badge');
if (badge) badge.classList.toggle('hidden', online);
refreshOfflineAvailability(online);
if (window.__bzAcc && typeof window.__bzAcc.connectionChanged === 'function') window.__bzAcc.connectionChanged();
}
setTimeout(updateOnlineStatus, 500);

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
e.preventDefault();
deferredPrompt = e;
const b = document.getElementById('pwa-install-btn');
if (b) { b.classList.remove('hidden'); b.classList.add('inline-flex'); }
});
window.addEventListener('appinstalled', () => {
const b = document.getElementById('pwa-install-btn');
if (b) { b.classList.add('hidden'); b.classList.remove('inline-flex'); }
deferredPrompt = null;
});
function triggerPwaInstall() {
if (!deferredPrompt) return;
deferredPrompt.prompt();
deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
}

function updateGlobalProgress() {
const done = Object.values(userProgress).filter(p => p && p.completed).length;
const pct = Math.round((done / TOTAL_CHAPTERS) * 100);
const bar = document.getElementById('sidebar-progress-bar'), txt = document.getElementById('sidebar-progress-text');
if (bar) bar.style.width = `${pct}%`;
if (txt) txt.textContent = `${pct}% syllabus covered`;
}

function setSubject(s) { subject = s; renderView(); }

let _modalReturnFocus = null;
function openModal() {
  const m = document.getElementById('appModal');
  if (!m.classList.contains('open')) _modalReturnFocus = document.activeElement;
  m.classList.add('open');
  const box = m.querySelector('.modal-box');
  if (box) { box.setAttribute('tabindex', '-1'); box.focus({ preventScroll: true }); }
}
function toggleFullScreenMode(on) { document.getElementById('appModal')?.classList.toggle('fullscreen-modal', !!on); }
// A tool dialog opened on top of a running quiz (image zoom, AI helper, shortcuts...) must hand
// control back to the quiz when it is closed instead of ending the session.
const EP_OVERLAY_TITLES = new Set(['Question diagram', 'Keyboard Shortcuts & Navigation', '\u2726 AI Question Deep-Dive & Lecture Embed', 'Memory trick & exam tip', 'Simple explanation', 'AI helper unavailable', 'Revision sheet', 'Gemini AI Engine Settings', 'AI question generator', 'Generating related questions\u2026', 'Could not generate questions', 'Your AI practice set is ready']);
let _quizUnderlay = null;
function epResumeQuizUnderlay() {
  const u = _quizUnderlay; _quizUnderlay = null; if (!u) return false;
  try { if (u.mode === 'test') renderTestQuiz(); else renderPracticeQuiz(); return true; } catch (e) { console.warn('[EduPulse] could not resume quiz', e); return false; }
}
function closeModal() {
if (_quizUnderlay && epResumeQuizUnderlay()) return;
toggleFullScreenMode(false);
document.getElementById('appModal').classList.remove('open');
try { document.getElementById('epq')?.remove(); } catch (e) {}   // a closed session must not leave its old DOM behind: it blocked the next Resume
try { _modalReturnFocus?.focus?.({ preventScroll: true }); } catch (e) {}
_modalReturnFocus = null;
if (quizState.timerInterval) { clearInterval(quizState.timerInterval); quizState.timerInterval = null; }
}

function setModal(title, body, html, actions = '') {
{
  const m = document.getElementById('appModal');
  const quizOnScreen = m?.classList.contains('open') && m.classList.contains('fullscreen-modal') && quizState.questions?.length && (quizState.mode === 'practice' || quizState.mode === 'test');
  if (quizOnScreen && EP_OVERLAY_TITLES.has(title)) { _quizUnderlay = { mode: quizState.mode }; toggleFullScreenMode(false); }
  else if (title === '') _quizUnderlay = null; // a fresh quiz screen is being drawn
}
document.getElementById('modalTitle').textContent = title;
document.getElementById('modalBody').textContent = body;
document.getElementById('modalContentSlot').innerHTML = html;
document.getElementById('modalActions').innerHTML = actions;
openModal();
}

function openHelpModal() {
setModal('Keyboard Shortcuts & Navigation', 'Accelerate your practice with key shortcuts:',  `<div class="space-y-3 py-2 text-xs"> <div class="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800"><span class="font-bold">Option A, B, C, D</span> <kbd class="px-2 py-1 bg-white dark:bg-slate-700 rounded border shadow-sm font-mono">1, 2, 3, 4</kbd></div> <div class="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800"><span class="font-bold">Next Question</span> <kbd class="px-2 py-1 bg-white dark:bg-slate-700 rounded border shadow-sm font-mono">ArrowRight / Space</kbd></div> <div class="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800"><span class="font-bold">Previous Question</span> <kbd class="px-2 py-1 bg-white dark:bg-slate-700 rounded border shadow-sm font-mono">ArrowLeft</kbd></div> </div>`, `<button onclick="closeModal()" class="px-4 py-2 bg-teal-600 text-white rounded-xl font-bold text-xs">Got it</button>`);
}

function generateFallbackQuestions(subj, chapterName) {
  return [];
}

const questionCache = new Map();
// Question counts are derived from the real exercise files. No manually maintained
// index.json is required. null means that chapter has not been scanned yet.
const questionCounts = new Map();
const questionCountScans = new Map();
const scannedSubjects = new Set();
const qBank = (subj, ch) => questionCounts.has(`${subj}|${ch}`) ? questionCounts.get(`${subj}|${ch}`) : null;

async function refreshQuestionCounts(subj, force = false) {
  if (!force && scannedSubjects.has(subj)) return;
  if (questionCountScans.has(subj)) return questionCountScans.get(subj);
  const task = (async () => {
    const chapters = data[subj] || [];
    let cursor = 0;
    const worker = async () => {
      while (cursor < chapters.length) {
        const chapter = chapters[cursor++];
        try {
          const qs = await preloadChapter(subj, chapter);
          questionCounts.set(`${subj}|${chapter}`, Array.isArray(qs) ? qs.length : 0);
        } catch (error) {
          console.warn('[EduPulse] Question count scan failed:', subj, chapter, error);
          questionCounts.set(`${subj}|${chapter}`, 0);
        }
      }
    };
    // Keep traffic gentle on static hosts and mobile connections.
    await Promise.all(Array.from({ length: Math.min(3, chapters.length) }, worker));
    scannedSubjects.add(subj);
    if (currentTab === 'learn' && subject === subj) renderView();
  })().finally(() => questionCountScans.delete(subj));
  questionCountScans.set(subj, task);
  return task;
}

function getSavedResume() { return StorageModule.get(STORAGE_KEYS.session, null); }
function getStudySignals() {
  const attempts = StorageModule.get(STORAGE_KEYS.attempts, []);
  const stats = StorageModule.get(STORAGE_KEYS.qstats, {});
  const byChapter = {};
  attempts.forEach(a => { if (!a.chapter) return; byChapter[a.chapter] = byChapter[a.chapter] || { accuracy: [], last: 0 }; byChapter[a.chapter].accuracy.push(a.accuracy || 0); byChapter[a.chapter].last = Math.max(byChapter[a.chapter].last, a.date || a.timestamp || 0); });
  const entries = Object.entries(byChapter).map(([chapter, v]) => ({ chapter, accuracy: Math.round(v.accuracy.reduce((a,b)=>a+b,0)/v.accuracy.length), last: v.last })).sort((a,b)=>a.accuracy-b.accuracy);
  return { weakest: entries[0], untouched: [...questionCounts.keys()].map(k => k.split('|')[1]).find(k => !Object.keys(stats).some(q => q.toLowerCase().includes(k.toLowerCase()))) };
}
function startQuickTen() {
  const available = Object.keys(data).flatMap(subject => (data[subject] || []).map(chapter => ({ subject, chapter })));
  const ranked = available.sort((a,b) => ((getStudySignals().weakest?.chapter === a.chapter ? -1 : 0) - (getStudySignals().weakest?.chapter === b.chapter ? -1 : 0)));
  const pick = ranked.find(x => (qBank(x.subject, x.chapter) || 0) > 0);
  if (pick) return openPracticeSetup(pick.subject, pick.chapter, { length: 10, source: 'all' });
  showToast('Finding available question banks…', 'info');
  (async () => {
    for (const item of available) {
      const qs = await preloadChapter(item.subject, item.chapter);
      questionCounts.set(`${item.subject}|${item.chapter}`, qs.length);
      if (qs.length) { openPracticeSetup(item.subject, item.chapter, { length: 10, source: 'all' }); return; }
    }
    showToast('No uploaded question banks were found. Check the /data/ filenames.', 'warning');
  })();
}
function resumeSavedSession() { const s = getSavedResume(); if (!s?.questions?.length) return; Object.assign(quizState, { mode:'practice', chapter:s.chapter, subject:s.subject, title:s.title, questions:s.questions, currentIndex:s.currentIndex || 0, userAnswers:s.userAnswers || {}, marked:s.marked || {}, bookmarked:s.bookmarked || {}, skippedQuestions:s.skippedQuestions || {}, questionTimes:s.questionTimes || {}, eliminatedOptions:s.eliminatedOptions || {}, wrongReasons:s.wrongReasons || {}, practiceDeadlineTimestamp:null, practiceTimeExpired:false, questionStartTimer:Date.now(), paletteExpanded:false, infinite:null }); closeModal(); renderPracticeQuiz(); }

// ===== Dashboard quick access: Resume / Bookmarked / Incorrect =====
function getSavedQuestionKeys(kind) {
  const stats = StorageModule.get(STORAGE_KEYS.qstats, {});
  if (kind === 'due') return getDueRevisionKeys();
  return Object.keys(stats).filter(k => kind === 'bookmarked'
    ? !!stats[k].bookmarked
    : (stats[k].wrong || 0) > 0 && !stats[k].streak); // last attempt was wrong
}
// ===== Dashboard insights, chapter filters, backup =====
const __q = {};            // remembered search text (inputs are recreated on every render)
let chapterFilter = 'all';
function onSearchInput(el) {
  __q[el.id] = el.value;
  renderView();
  const n = document.getElementById(el.id);
  if (n) { n.focus(); const l = n.value.length; try { n.setSelectionRange(l, l); } catch (e) {} }
}
function setChapterFilter(f) { chapterFilter = f; renderView(); }
const DAILY_GOAL_KEY = 'edupulse_daily_goal_v1';
const getDailyGoal = () => Number(localStorage.getItem(DAILY_GOAL_KEY)) || 30;
function cycleDailyGoal() {
  const presets = [10, 20, 30, 50, 100];
  const next = presets[(presets.indexOf(getDailyGoal()) + 1) % presets.length] || 30;
  try { localStorage.setItem(DAILY_GOAL_KEY, String(next)); } catch (e) {}
  renderView();
  showToast(`Daily goal set to ${next} questions`);
}
function questionsSolvedToday() {
  const start = new Date().setHours(0, 0, 0, 0);
  return Object.values(StorageModule.get(STORAGE_KEYS.qstats, {})).filter(m => (m.lastSeen || 0) >= start).length;
}
function getWeakChapters(limit = 3) {
  const by = {};
  StorageModule.get(STORAGE_KEYS.attempts, []).forEach(a => {
    if (!a.subject || !data[a.subject]?.includes(a.chapter)) return;
    const k = a.subject + '|' + a.chapter;
    (by[k] = by[k] || { subject: a.subject, chapter: a.chapter, acc: [] }).acc.push(a.accuracy || 0);
  });
  return Object.values(by).map(x => ({ ...x, avg: Math.round(x.acc.reduce((n, v) => n + v, 0) / x.acc.length) }))
    .filter(x => x.avg < 85).sort((a, b) => a.avg - b.avg).slice(0, limit);
}
function exportBackup() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('edupulse') && k !== STORAGE_KEYS.geminiKey) data[k] = localStorage.getItem(k); }
  const blob = new Blob([JSON.stringify({ app: 'edupulse', version: 1, exportedAt: new Date().toISOString(), data })], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `edupulse-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  showToast('Backup downloaded.');
}
function importBackupFile(file) {
  if (!file) return;
  if (file.size > 25e6) { showToast('That file is too large to be an EduPulse backup.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || parsed.app !== 'edupulse' || !parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) throw new Error('Not an EduPulse backup file.');
      const good = {}; let skipped = 0;
      Object.keys(parsed.data).forEach(k => {
        const v = parsed.data[k];
        if (!k.startsWith('edupulse') || k === STORAGE_KEYS.geminiKey || typeof v !== 'string' || v.length > 5e6) { skipped++; return; }
        if (/^\s*[\[{]/.test(v)) { try { JSON.parse(v); } catch (e) { skipped++; return; } }
        good[k] = v;
      });
      if (!Object.keys(good).length) throw new Error('This backup has no usable EduPulse data.');
      parsed.data = good;
      if (skipped) setTimeout(() => showToast(`${skipped} unreadable entr${skipped === 1 ? 'y was' : 'ies were'} ignored.`, 'warning'), 300);
      window.__pendingBackup = parsed;
      const n = Object.keys(parsed.data).length;
      setModal('Restore backup?', file.name, `<div class="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs font-medium text-amber-800 dark:text-amber-200 leading-relaxed">This replaces your current progress with the backup (${n} saved items${parsed.exportedAt ? ', made ' + escapeHtml(new Date(parsed.exportedAt).toLocaleString()) : ''}). The app will reload afterwards.</div>`,
        `<button onclick="closeModal()" class="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">Cancel</button><button onclick="applyBackup()" class="px-5 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-black">Restore</button>`);
    } catch (e) { showToast(e.message || 'That file could not be read.', 'error'); }
  };
  reader.readAsText(file);
}
function applyBackup() {
  const b = window.__pendingBackup; if (!b) return;
  try {
    Object.keys(b.data).forEach(k => { if (k.startsWith('edupulse') && typeof b.data[k] === 'string') localStorage.setItem(k, b.data[k]); });
    location.reload();
  } catch (e) { showToast('Restore failed: storage is full.', 'error'); }
}

// ===== Spaced revision + weekly activity =====
function getDueRevisionKeys() {
  // Previously-missed questions come back after 1, 3, 7, then 14 days of being answered correctly in a row; 4 in a row graduates them.
  const stats = StorageModule.get(STORAGE_KEYS.qstats, {});
  const now = Date.now(), day = 864e5, gaps = [1, 3, 7, 14];
  return Object.keys(stats).filter(k => {
    const m = stats[k];
    if (!m || !m.seen || !m.lastSeen || !(m.wrong > 0) || (m.streak || 0) >= 4) return false;
    return now - m.lastSeen >= gaps[Math.min(m.streak || 0, 3)] * day;
  });
}
function getActivityDays(n = 7) {
  const counts = StorageModule.get(STORAGE_KEYS.streak, { dailyCounts: {} }).dailyCounts || {};
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, count: counts[key] || 0, label: d.toLocaleDateString([], { weekday: 'narrow' }), today: i === 0 });
  }
  return days;
}
function getDayStreak() {
  const counts = StorageModule.get(STORAGE_KEYS.streak, { dailyCounts: {} }).dailyCounts || {};
  let streak = 0, i = counts[new Date().toISOString().slice(0, 10)] ? 0 : 1; // today may still be empty
  for (; i < 400; i++) {
    if (counts[new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)]) streak++; else break;
  }
  return streak;
}

async function startSavedPractice(kind) {
  const keys = new Set(getSavedQuestionKeys(kind));
  const label = kind === 'bookmarked' ? 'Bookmarked questions' : kind === 'due' ? 'Revision due' : 'Incorrect questions';
  if (!keys.size) return showToast(`No ${label.toLowerCase()} yet.`, 'info');
  setModal('Preparing practice', label, `<div class="space-y-4 animate-pulse"><div class="h-4 rounded bg-slate-200 dark:bg-slate-800 w-2/3"></div><div class="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800"></div></div><p id="ep-load-progress" role="status" aria-live="polite">Loading questions…</p>`);
  try {
    const stats = StorageModule.get(STORAGE_KEYS.qstats, {});
    const all = [];
    Object.keys(data).forEach(subj => data[subj].forEach(ch => all.push([subj, ch])));
    const slugs = new Set([...keys].map(k => k.split('#')[0]));
    const picked = new Map();
    const add = (subj, ch) => picked.set(subj + '|' + ch, [subj, ch]);
    keys.forEach(k => { const m = stats[k] || {}; if (m.sj && m.ch && data[m.sj]?.includes(m.ch)) add(m.sj, m.ch); });
    all.forEach(([subj, ch]) => { if (slugs.has(slugify(ch))) add(subj, ch); });
    const found = new Map();
    const collect = banks => banks.flat().forEach(q => { if (keys.has(q.qKey) && !found.has(q.qKey)) found.set(q.qKey, q); });
    collect(await Promise.all([...picked.values()].map(([subj, ch]) => preloadChapter(subj, ch))));
    if (found.size < keys.size) {
      // Fallback for older saved items: scan every chapter that has a question bank.
      const rest = all.filter(([subj, ch]) => !picked.has(subj + '|' + ch) && qBank(subj, ch) > 0);
      collect(await Promise.all(rest.map(([subj, ch]) => preloadChapter(subj, ch))));
    }
    const questions = [...found.values()];
    if (!questions.length) {
      closeModal();
      return showToast('Those questions could not be loaded right now.', 'warning');
    }
    // Launch with "all questions, no source filter" regardless of saved practice settings, then restore them.
    const original = StorageModule.get(STORAGE_KEYS.settings, defaultSettings);
    StorageModule.set(STORAGE_KEYS.settings, { ...original, practiceSource: 'All', practiceLength: 'all', shuffleQuestions: false });
    try { launchPracticeSession('Mixed', label, questions); }
    finally { StorageModule.set(STORAGE_KEYS.settings, original); }
  } catch (err) {
    console.error('Saved practice error:', err);
    closeModal();
    showToast('Could not start practice. Please try again.', 'warning');
  }
}


function fisherYates(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const EP_BANK_ISSUES = [];
const EP_REF_OPTION = /\b(both|neither|all of the above|none of (these|the above))\b|^\s*(all|any|none)\s*\.?\s*$|\b[1-4]\s*(&|and)\s*[1-4]\b|\boptions?\s*[1-4]/i;
function hasLockedOption(options, q) { return !!(q && q.lockOrder) || options.some(o => EP_REF_OPTION.test(String(o))); }
function normalizeQuestion(q, i, chapterName, subj) {
  if (!q || typeof q !== 'object') { EP_BANK_ISSUES.push(`${chapterName} #${i + 1}: not an object`); return null; }
  const stem = String(q.q ?? q.question ?? '').trim();
  const options = (q.o || q.options || q.opts || []).map(o => String(o ?? '').trim());
  const a = q.a ?? q.answer ?? q.ans;
  let correct = typeof a === 'number' ? a - 1 : options.findIndex(o => o === String(a).trim());
  if (correct < 0 && /^\d+$/.test(String(a).trim())) correct = Number(a) - 1;
  const fatal = [];
  if (!stem) fatal.push('empty question');
  if (options.length < 2 || options.some(o => !o)) fatal.push('missing/empty options');
  if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) fatal.push('answer out of range');
  if (options.length > 8) fatal.push('too many options');
  if (stem.length > 4000) fatal.push('question text too long');
  if (fatal.length) { EP_BANK_ISSUES.push(`${chapterName} #${q.id || q.no || i + 1}: ${fatal.join(', ')}`); return null; }
  if (new Set(options.map(o => o.toLowerCase())).size !== options.length) console.warn(`[EduPulse] duplicate options in ${chapterName} #${q.id || q.no || i + 1}`);
  const t = q.table && Array.isArray(q.table.rows) && q.table.rows.length ? { headers: Array.isArray(q.table.headers) ? q.table.headers.map(String) : [], rows: q.table.rows.map(r => (Array.isArray(r) ? r : [r]).map(String)) } : null;
  return { qKey: q.qKey || slugify(chapterName) + '#' + (q.id ? String(q.id).toLowerCase() : simpleHash(stem)), id: q.id || '', type: q.type || 'mcq', question: stem, options, correct, explanation: String(q.s ?? q.explanation ?? '').trim(), note: String(q.note || '').trim(), topic: q.topic || q.t || 'NCERT Concepts', difficulty: q.difficulty || q.level || 'Medium', year: q.year || q.pyqYear || '', exam: q.exam || '', sourceChapter: q.c || q.chapter || chapterName, section: q.section || '', source: q.source || '', alsoIn: Array.isArray(q.alsoIn) ? q.alsoIn : [], no: q.no ?? '', img: q.img || q.image || '', imgAuto: '', needsImage: !!q.needsImage, table: t, lockOrder: !!q.lockOrder, hint: q.h, why: Array.isArray(q.why) ? q.why.map(String) : [], ncert: (q.ncert && typeof q.ncert === 'object') ? q.ncert : null, optionImages: q.optionImages || [] };
}
function normalizeQuestions(raw, subj, chapterName) {
  const before = EP_BANK_ISSUES.length;
  const out = raw.map((q, i) => normalizeQuestion(q, i, chapterName, subj)).filter(Boolean);
  const seen = new Set(); out.forEach(q => { if (seen.has(q.qKey)) q.qKey += '~' + seen.size; seen.add(q.qKey); });
  const bad = EP_BANK_ISSUES.length - before;
  if (bad) { console.warn('[EduPulse] Skipped invalid questions:\n' + EP_BANK_ISSUES.slice(before).join('\n')); try { showToast(`${bad} question(s) in ${chapterName} skipped: invalid format (see console)`, 'warning'); } catch (e) {} }
  return out;
}
// ---- Figure images -------------------------------------------------------
// Canonical file name:  <chapter-slug>-<exercise-id>-q<question-number>[-<figure-label>].png
//   e.g. diversity-in-the-living-world-ex1-q152.png          (one figure)
//        diversity-in-the-living-world-ex1-q152-a.png / -b.png (figures (a) and (b))
//        chemical-kinetics-ex1-q97-a.png ... -d.png            (graph OPTIONS A-D)
// The app builds this name itself from chapter + section + question number, so a wrong or
// missing "img" value in the JSON can no longer break a figure. If q<no>.png does not exist
// it automatically looks for q<no>-a, -b, -c ... (or -1, -2 ... / -fig1, -fig2 ...) and shows all.
// Works with any of these layouts: PNGs straight in /images, the zip extracted as-is
// (/images/output/images/...), or the zip itself left unextracted in /images (read in-browser).
const EP_IMG_BASES = ['/images/', '/images/output/images/', '/images/images/', './images/', './images/output/images/', './images/images/'];
const EP_IMG_EXT = ['png', 'jpg', 'jpeg', 'webp'];
const EP_IMG_OK = {};
const EP_IMG_PROBED = {};
let EP_BASE_OK = '';
let EP_EXT_OK = '';
const EP_IMG_MISS = {};
const epCanonBase = q => (q.section && q.no !== '' && q.no != null)
  ? [slugify(String(q.sourceChapter || '')), (q.source && q.source !== LEGACY_SOURCE ? q.source : ''), String(q.section).toLowerCase(), 'q' + q.no].filter(Boolean).join('-') : '';
function epImgCands(stems) {
  stems = (Array.isArray(stems) ? stems : [stems]).map(s => String(s || '').trim()).filter(Boolean);
  const out = [];
  stems.forEach(s => {
    if (/^(https?:|data:|blob:)/i.test(s)) { out.push(s); return; }
    const name = s.replace(/^\.?\/?(images|img)\//i, '').replace(/^\/+/, '');
    const m = name.match(/^(.*)\.(png|jpe?g|webp|gif|svg)$/i);
    const stem = m ? m[1] : name;
    const exts0 = m ? [m[2].toLowerCase(), ...EP_IMG_EXT.filter(e => e !== m[2].toLowerCase())] : EP_IMG_EXT;
    const exts = EP_EXT_OK && !m ? [EP_EXT_OK, ...exts0.filter(e => e !== EP_EXT_OK)] : exts0;
    const bases = EP_BASE_OK ? [EP_BASE_OK, ...EP_IMG_BASES.filter(b => b !== EP_BASE_OK)] : EP_IMG_BASES;
    [...new Set([stem, stem.toLowerCase()])].forEach(st => exts.forEach(e => bases.forEach((b, bi) => { if (EP_BASE_OK && bi > 0 && e !== exts[0]) return; out.push(b + st + '.' + e); })));
  });
  const uniq = [...new Set(out)], ok = EP_IMG_OK[stems[0]];
  return ok ? [ok, ...uniq] : uniq;
}
const epImgAttrs = (ref, c) => `src="${escapeHtml(c[0])}" data-ref="${escapeHtml(ref)}" data-i="0" data-c="${escapeHtml(JSON.stringify(c))}"`;
function epLearnBase(src) { const b = EP_IMG_BASES.filter(b => String(src).startsWith(b)).sort((x, y) => y.length - x.length)[0]; if (b) EP_BASE_OK = b; const xm = String(src).match(/\.(png|jpe?g|webp)(?:$|\?)/i); if (xm && b) EP_EXT_OK = xm[1].toLowerCase(); }

// ---- Zip fallback: read figures straight out of a .zip left in /images -------------------
// Looks for /images/<chapter-slug>-figures.zip (plus figures.zip / images.zip / output.zip),
// parses it in the browser (no library, uses DecompressionStream) and serves blob: URLs.
const EP_ZIP = { loads: {}, idx: {}, urls: {} };
const epZipSlug = name => { const m = String(name).match(/^(.*?)-ex\d+-q\d+/i); return m ? m[1].toLowerCase() : ''; };
async function epZipOpen(url) {
  if (EP_ZIP.loads[url]) return EP_ZIP.loads[url];
  return (EP_ZIP.loads[url] = (async () => {
    try {
      const r = await fetch(url); if (!r.ok) return null;
      const buf = await r.arrayBuffer(), dv = new DataView(buf), u8 = new Uint8Array(buf);
      if (u8.length < 22 || u8[0] !== 0x50 || u8[1] !== 0x4b) return null;           // not a zip (e.g. SPA fallback html)
      let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
      if (e < 0) return null;
      const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
      const dec = new TextDecoder(), files = {};
      for (let i = 0; i < n && dv.getUint32(p, true) === 0x02014b50; i++) {
        const method = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true),
              el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true),
              name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
        p += 46 + nl + el + cl;
        const m = name.match(/([^\/]+)\.(png|jpe?g|webp|gif|svg)$/i);
        if (!m || /(^|\/)(originals?|__macosx)\//i.test(name)) continue;           // never use the untouched originals
        const key = m[1].toLowerCase(), prefer = /(^|\/)images\//i.test(name);
        if (!files[key] || prefer) files[key] = { method, csz, off, ext: m[2].toLowerCase() };
      }
      return { u8, dv, files };
    } catch (_) { return null; }
  })());
}
async function epZipBlob(z, key) {
  const f = z.files[key]; if (!f) return null;
  if (EP_ZIP.urls[key]) return EP_ZIP.urls[key];
  const dv = z.dv, o = f.off, start = o + 30 + dv.getUint16(o + 26, true) + dv.getUint16(o + 28, true);
  let bytes = z.u8.subarray(start, start + f.csz);
  if (f.method === 8) bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  else if (f.method !== 0) return null;
  const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' }[f.ext] || 'image/png';
  return (EP_ZIP.urls[key] = URL.createObjectURL(new Blob([bytes], { type: mime })));
}
// c = candidate url list for one figure; resolves a blob: url or null
async function epZipFind(c) {
  if (typeof DecompressionStream === 'undefined') return null;
  const names = [...new Set((c || []).filter(u => !/^(https?:|data:|blob:)/i.test(u)).map(u => u.replace(/^.*\//, '').replace(/\.[a-z]+$/i, '').toLowerCase()))];
  if (!names.length) return null;
  const slugs = [...new Set(names.map(epZipSlug).filter(Boolean))];
  const zips = [...new Set([...slugs.map(s => s + '-figures.zip'), ...slugs.map(s => s + '.zip'), 'figures.zip', 'images.zip', 'output.zip'])];
  for (const zn of zips) for (const base of ['/images/', './images/']) {
    const z = await epZipOpen(base + zn); if (!z) continue;
    for (const nm of names) { const u = await epZipBlob(z, nm); if (u) return u; }
  }
  return null;
}
// slots = one entry per figure shown in the stem
function epStemSlots(q) {
  const refs = (Array.isArray(q.img) ? q.img : q.img ? [q.img] : []).map(String).filter(Boolean);
  const base = epCanonBase(q);
  const wants = refs.length || q.needsImage || q.type === 'diagram' || q.type === 'graph';
  if (!wants) return [];
  if (refs.length > 1) return refs.map((r, i) => ({ stems: [r, base && `${base}-${'abcdef'[i]}`, base && `${base}-${i + 1}`].filter(Boolean), want: r, probe: '' }));
  if (!base && !refs.length) return [];
  return [{ stems: [base, refs[0]].filter(Boolean), want: base || refs[0], probe: base }];
}
function epFigHtml(s) {
  if (EP_IMG_MISS[String(s.want || '')]) return `<figure class="ep-fig ep-miss">${epMissInner(s.want)}</figure>`; // already known to be missing: no more requests
  const c = epImgCands(s.stems);
  return `<figure class="ep-fig ep-load" onclick="epFigZoom(this)"><img ${epImgAttrs(s.stems[0], c)} data-base="${escapeHtml(s.probe)}" data-want="${escapeHtml(s.want)}" alt="Question diagram" decoding="async" onload="epImgOk(this)" onerror="epImgFail(this)"><figcaption><i class="fa-solid fa-magnifying-glass-plus"></i> Tap to enlarge</figcaption></figure>`;
}
function epFigures(q) {
  const slots = epStemSlots(q);
  if (!slots.length) return q.needsImage ? `<p class="mt-3 rounded-xl border border-dashed border-amber-400/60 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700 dark:bg-amber-950/20 dark:text-amber-300"><i class="fa-solid fa-image mr-1"></i>This question refers to a diagram that is not available yet.</p>` : '';
  return `<div class="ep-figs">${slots.map(epFigHtml).join('')}</div>`;
}
function epOptImg(q, i) {
  const r = (q.optionImages || [])[i]; if (!r) return '';
  const base = epCanonBase(q), L = 'abcd'[i];
  const stems = [base && `${base}-${L}`, r, base && `${base}-opt-${L}`].filter(Boolean);
  return `<img ${epImgAttrs(stems[0], epImgCands(stems))} alt="Option ${String.fromCharCode(65 + i)} diagram" class="ep-opt-img" onerror="epImgFail(this)">`;
}
function epImgOk(el) { const f = el.parentElement; if (f) f.classList.remove('ep-load'); EP_IMG_OK[el.dataset.ref] = el.currentSrc || el.src; epLearnBase(el.getAttribute('src')); }
const epTryLoad = stem => new Promise(res => {
  const c = epImgCands([stem]); let i = 0; const im = new Image();
  im.onload = () => { epLearnBase(c[i]); res(im.src); };
  im.onerror = () => { if (++i < c.length) im.src = c[i]; else epZipFind(c).then(u => { if (u) { im.onerror = null; im.onload = () => res(u); im.src = u; } else res(null); }); };
  im.src = c[0];
});
// q<no>.png is missing: look for the labelled set  -a,-b,-c...  or  -1,-2,-3...  or  -fig1,-fig2...
function epProbeLabels(base) {
  if (EP_IMG_PROBED[base]) return EP_IMG_PROBED[base];
  return (EP_IMG_PROBED[base] = (async () => {
    for (const seq of [['a', 'b', 'c', 'd', 'e', 'f'], ['1', '2', '3', '4', '5'], ['fig1', 'fig2', 'fig3', 'fig4']]) {
      const found = [];
      for (const l of seq) { const u = await epTryLoad(`${base}-${l}`); if (!u) break; found.push(u); }
      if (found.length) return found;
    }
    return [];
  })());
}
function epMissInner(want) {
  return `<div class="ep-miss-in"><i class="fa-regular fa-image"></i><span>Figure image not uploaded yet</span><code>images/${escapeHtml(String(want || '').replace(/^\.?\/?(images|img)\//i, '').replace(/\.(png|jpe?g|webp)$/i, ''))}.png</code></div>`;
}
function epFigMissing(f, want) {
  EP_IMG_MISS[String(want || '')] = 1;
  f.classList.remove('ep-load'); f.classList.add('ep-miss'); f.onclick = null;
  f.innerHTML = epMissInner(want);
}
function epImgFail(el) {
  const c = JSON.parse(el.dataset.c || '[]'), i = (+el.dataset.i || 0) + 1;
  if (i < c.length) { el.dataset.i = i; el.src = c[i]; return; }
  if (!el.dataset.zip) {
    el.dataset.zip = '1';
    epZipFind(c).then(u => { if (u) { el.dataset.c = JSON.stringify([u]); el.dataset.i = 0; el.src = u; } else epImgFail(el); });
    return;
  }
  const f = el.parentElement;
  if (!f || !f.classList.contains('ep-fig')) { el.remove(); return; }
  const base = el.dataset.base;
  if (base && !el.dataset.probed) {
    el.dataset.probed = '1';
    epProbeLabels(base).then(urls => {
      if (!f.isConnected) return;
      if (!urls.length) { epFigMissing(f, el.dataset.want); return; }
      f.insertAdjacentHTML('beforebegin', urls.map(u => `<figure class="ep-fig" onclick="epFigZoom(this)"><img src="${escapeHtml(u)}" alt="Question diagram" decoding="async"><figcaption><i class="fa-solid fa-magnifying-glass-plus"></i> Tap to enlarge</figcaption></figure>`).join(''));
      f.remove();
    });
    return;
  }
  epFigMissing(f, el.dataset.want);
}
function epFigZoom(f) { const im = f.querySelector('img'); if (im) openImageZoom(im.currentSrc || im.src); }
function epPreloadImages(qs) {
  qs.filter(q => epStemSlots(q).length).slice(0, 8).forEach(q => epStemSlots(q).forEach(async s => {
    const key = s.stems[0]; if (EP_IMG_OK[key]) return;
    for (const st of s.stems) { const u = await epTryLoad(st); if (u) { EP_IMG_OK[key] = u; return; } }
  }));
}
function epExtras(q) {
  let h = '';
  if (q.table && q.table.rows) h += `<div class="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700"><table class="w-full text-xs sm:text-sm">${q.table.headers.length ? `<thead class="bg-slate-100 dark:bg-slate-800"><tr>${q.table.headers.map(c => `<th class="px-3 py-2 text-left font-black">${formatQuizText(c)}</th>`).join('')}</tr></thead>` : ''}<tbody>${q.table.rows.map(r => `<tr class="border-t border-slate-200 dark:border-slate-700">${r.map(c => `<td class="px-3 py-2 align-top">${formatQuizText(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  h += epFigures(q);
  return h;
}
async function preloadChapter(subj, chapterName) {
  const key = `${subj}:${chapterName}`;
  if (questionCache.has(key)) return questionCache.get(key);

  // Keep one in-flight request per chapter, but never cache a failed/empty
  // response forever. A brief network or hosting hiccup can then recover on
  // the next click instead of making the chapter appear permanently dead.
  const promise = (async () => {
    try {
      const list = await loadChapterRaw(subj, chapterName);
      if (!list.length) { epRecordQuestionIssue(`${subj} — ${chapterName}`, 'No questions were returned for this chapter.'); return []; }
      const qs = normalizeQuestions(list, subj, chapterName); epClearQuestionIssue(`${subj} — ${chapterName}`); EP_DIAGNOSTICS.loadedChapters++; EP_DIAGNOSTICS.loadedQuestions += qs.length; epPreloadImages(qs); return qs;
    } catch (error) {
      epRecordQuestionIssue(`${subj} — ${chapterName}`, error && error.message || 'Chapter data request failed.');
      console.warn('[EduPulse] Chapter load failed:', subj, chapterName, error);
      return [];
    }
  })();

  questionCache.set(key, promise);
  const questions = await promise;
  if (!questions.length && questionCache.get(key) === promise) {
    questionCache.delete(key);
  }
  return questions;
}
// ===== Practice scope: exercises and topics =====
const EP_SCOPE = { ex: new Set(), srcs: new Set(), topics: new Set(), key: '', qs: [] };
const epExKey = q => (q.source || '') + '~' + (q.section || 'other');
const epKeySrc = k => String(k).split('~')[0];
const epKeyEx = k => String(k).split('~')[1] || 'other';
const epQSrcs = q => [q.source, ...(q.alsoIn || [])].filter(Boolean);
function epExLabel(id, source = '') {
  const key = String(id || 'other').toLowerCase();
  // Prefer the exact human-readable label supplied by the source JSON.
  if (source && EP_EXERCISE_LABELS[`${String(source).toLowerCase()}~${key}`]) {
    return EP_EXERCISE_LABELS[`${String(source).toLowerCase()}~${key}`];
  }
  if (!source) {
    const matches = Object.keys(EP_EXERCISE_LABELS).filter(k => k.endsWith(`~${key}`));
    const labels = [...new Set(matches.map(k => EP_EXERCISE_LABELS[k]))];
    if (labels.length === 1) return labels[0];
  }
  // If the bank has no explicit display label, show its original exercise id unchanged.
  return key === 'other' ? 'Other' : String(id || 'Other');
}
function epRenderScope(qs) {
  const box = document.getElementById('practice-scope');
  if (!box || !qs || !qs.length) return;
  if (!qs.some(q => q.section) && !qs.some(q => q.topic && q.topic !== 'NCERT Concepts')) return;
  EP_SCOPE.ex.clear(); EP_SCOPE.srcs.clear(); EP_SCOPE.topics.clear(); EP_SCOPE.qs = qs; EP_SCOPE.key = box.dataset.key;
  box.classList.remove('hidden'); epPaintScope();
}
function epPaintScope() {
  const qs = EP_SCOPE.qs, box = document.getElementById('practice-scope'); if (!box) return;
  const sec = q => q.section || 'other', top = q => (q.topic && q.topic !== 'NCERT Concepts') ? q.topic : '';
  const chip = (k, v, label, n, on) => `<button type="button" data-k="${k}" data-v="${escapeHtml(v)}" onclick="epScopeToggle(this)" class="ep-chip ${on ? 'on' : ''}">${escapeHtml(label)}<b>${n}</b></button>`;
  const secs = [...new Set(qs.map(sec))];
  const base = qs.filter(q => !EP_SCOPE.ex.size || EP_SCOPE.ex.has(sec(q)));
  const tops = [...new Set(base.map(top).filter(Boolean))];
  EP_SCOPE.topics.forEach(t => { if (!tops.includes(t)) EP_SCOPE.topics.delete(t); });
  const picked = base.filter(q => !EP_SCOPE.topics.size || EP_SCOPE.topics.has(top(q)));
  box.innerHTML =
    (secs.length > 1 || (secs[0] && secs[0] !== 'other') ? `<div><div class="text-xs font-black mb-2">Exercise</div><div class="flex flex-wrap gap-2">${chip('ex', '', 'All', qs.length, !EP_SCOPE.ex.size)}${secs.map(x => chip('ex', x, epExLabel(x), qs.filter(q => sec(q) === x).length, EP_SCOPE.ex.has(x))).join('')}</div></div>` : '') +
    (tops.length ? `<div><div class="text-xs font-black mb-2">Topic</div><div class="flex flex-wrap gap-2" style="max-height:34vh;overflow-y:auto">${chip('topic', '', 'All topics', base.length, !EP_SCOPE.topics.size)}${tops.map(t => chip('topic', t, t, base.filter(q => top(q) === t).length, EP_SCOPE.topics.has(t))).join('')}</div></div>` : '') +
    `<p class="text-[11px] font-bold text-teal-600">${picked.length} question${picked.length === 1 ? '' : 's'} selected</p>`;
}
function epScopeToggle(btn) {
  const set = btn.dataset.k === 'ex' ? EP_SCOPE.ex : EP_SCOPE.topics, v = btn.dataset.v;
  if (!v) set.clear(); else if (set.has(v)) set.delete(v); else set.add(v);
  epPaintScope();
}
function epApplyScope(qs, subj, chapterName) {
  if (EP_SCOPE.key !== `${subj}|${chapterName}` || (!EP_SCOPE.ex.size && !EP_SCOPE.topics.size && !EP_SCOPE.srcs.size)) return qs;
  const sec = q => q.section || 'other', top = q => (q.topic && q.topic !== 'NCERT Concepts') ? q.topic : '';
  const out = qs.filter(q => (!EP_SCOPE.srcs.size || epQSrcs(q).some(x => EP_SCOPE.srcs.has(x))) && (!EP_SCOPE.ex.size || EP_SCOPE.ex.has(epExKey(q)) || EP_SCOPE.ex.has(sec(q))) && (!EP_SCOPE.topics.size || EP_SCOPE.topics.has(top(q))));
  return out.length ? out : qs;
}
function applyPracticePreset(value) {
  const source = { ncert: 'NCERT only', pyq: 'PYQ only', incorrect: 'Previously wrong', unattempted: 'Unseen', full: 'All' }[value] || 'All';
  const sourceSelect = document.getElementById('practice-source');
  if (sourceSelect) sourceSelect.value = source;
  const lengthButton = document.querySelector('#modalContentSlot [data-value="all"]');
  if (value === 'full' && lengthButton) {
    document.querySelectorAll('#modalContentSlot [data-value]').forEach(button => button.classList.remove('ring-2', 'ring-teal-500'));
    lengthButton.classList.add('ring-2', 'ring-teal-500');
  }
}
function openPracticeSetup(subj, chapterName, preset = null, skipResume = false) {
  EP_SCOPE.ex.clear(); EP_SCOPE.srcs.clear(); EP_SCOPE.topics.clear(); EP_SCOPE.key = '';
  if (!preset && !skipResume) {
    const m = readChapterMeta()[chapterKey(subj, chapterName)];
    if (m && m.total && m.answered > 0) return showChapterResumePrompt(subj, chapterName, m);
  }
  const saved = StorageModule.get(STORAGE_KEYS.settings, defaultSettings);
  if (preset) { saved.practiceLength = preset.length; saved.practiceSource = preset.source || 'all'; StorageModule.set(STORAGE_KEYS.settings, saved); }
  setModal('Set up your practice', `${subj} · ${chapterName}`, `<div class="space-y-5 py-2"><div class="grid grid-cols-4 gap-2">${[10,20,30,'all'].map(v => `<button onclick="this.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('ring-2','ring-teal-500'));this.classList.add('ring-2','ring-teal-500');this.dataset.value='${v}'" class="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 text-xs font-black ${saved.practiceLength == v ? 'ring-2 ring-teal-500' : ''}" data-value="${v}">${v === 'all' ? 'All' : v}</button>`).join('')}</div><div id="practice-scope" data-key="${escapeHtml(subj)}|${escapeHtml(chapterName)}" class="hidden space-y-4 rounded-2xl border border-slate-200 p-3 dark:border-slate-700"></div><div class="space-y-2"><label class="text-xs font-black">Question source</label><select id="practice-source" class="w-full rounded-xl border p-3 text-sm bg-transparent"><option>All</option><option>Unseen</option><option>Previously wrong</option><option>Bookmarked</option><option>PYQ only</option><option>NCERT only</option></select></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-3"><label class="text-xs font-black">Practice preset<select id="practice-preset" onchange="applyPracticePreset(this.value)" class="mt-2 w-full rounded-xl border p-3 text-sm font-semibold bg-transparent"><option value="" ${saved.practicePreset ? '' : 'selected'}>Choose preset</option><option value="ncert" ${saved.practicePreset === 'ncert' ? 'selected' : ''}>NCERT</option><option value="pyq">PYQ</option><option value="incorrect">Incorrect</option><option value="unattempted">Unattempted</option><option value="full">Full Chapter</option></select></label><label class="text-xs font-black">Difficulty<select id="practice-difficulty" class="mt-2 w-full rounded-xl border p-3 text-sm font-semibold bg-transparent"><option value="mixed" ${!saved.practiceDifficulty || saved.practiceDifficulty === 'mixed' ? 'selected' : ''}>Mixed</option><option value="easy" ${saved.practiceDifficulty === 'easy' ? 'selected' : ''}>Easy</option><option value="moderate" ${saved.practiceDifficulty === 'moderate' ? 'selected' : ''}>Moderate</option><option value="difficult" ${saved.practiceDifficulty === 'difficult' ? 'selected' : ''}>Difficult</option></select></label></div><label class="flex items-center justify-between rounded-xl border p-3 text-sm font-bold">Shuffle questions <input id="practice-shuffle" type="checkbox" ${saved.shuffleQuestions ? 'checked' : ''}></label><label class="flex items-center justify-between rounded-xl border p-3 text-sm font-bold">Shuffle options <input id="practice-shuffle-options" type="checkbox" ${saved.shuffleOptions ? 'checked' : ''}></label><p class="text-[11px] text-slate-500">Your last choices are remembered on this device.</p><button type="button" onclick="startInfiniteFromChapter('${jsArg(subj)}','${jsArg(chapterName)}')" class="w-full rounded-2xl border border-violet-300/60 bg-gradient-to-r from-violet-500/10 to-teal-500/10 p-4 text-left transition hover:border-violet-400 hover:shadow-sm"><span class="flex items-center justify-between"><span><span class="block text-sm font-black text-slate-900 dark:text-slate-100">Infinite adaptive practice</span><span class="mt-1 block text-[11px] font-medium text-slate-500">Keep going while the engine adapts difficulty to you.</span></span><i class="fa-solid fa-infinity text-violet-500"></i></span></button></div>`, `<button onclick="closeModal()" class="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">Cancel</button><button onclick="startConfiguredPractice('${jsArg(subj)}','${jsArg(chapterName)}')" class="px-5 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-black">Start practice</button>`);
  preloadChapter(subj, chapterName).then(epRenderScope).catch(() => {});
  }
function startInfiniteFromChapter(subj, chapterName) {
  launchAiAdaptiveSessionFromModal(subj, chapterName);
}
async function startConfiguredPractice(subj, chapterName) {
  const sheet = document.querySelector('#modalContentSlot');
  const lengthBtn = sheet?.querySelector('[data-value].ring-2');
  const length = lengthBtn?.dataset.value || '10';
  const settings = StorageModule.get(STORAGE_KEYS.settings, defaultSettings);
  settings.practiceLength = length; settings.practiceSource = document.getElementById('practice-source')?.value || settings.practiceSource || 'All'; settings.practicePreset = document.getElementById('practice-preset')?.value || ''; settings.practiceDifficulty = document.getElementById('practice-difficulty')?.value || 'mixed'; settings.shuffleQuestions = !!document.getElementById('practice-shuffle')?.checked; settings.shuffleOptions = !!document.getElementById('practice-shuffle-options')?.checked;
  StorageModule.set(STORAGE_KEYS.settings, settings);
  await setupQuizMode('practice', subj, chapterName, null, true);
}

async function setupQuizMode(mode, subj, chapterName, customQuestions = null, configured = false) {
subject = subj;
if (mode === 'practice' && !configured && !customQuestions) return openPracticeSetup(subj, chapterName);
toggleFullScreenMode(false);
setModal('Preparing practice', chapterName, `<div class="space-y-4 animate-pulse"><div class="h-4 rounded bg-slate-200 dark:bg-slate-800 w-2/3"></div><div class="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800"></div><div class="h-12 rounded-2xl bg-slate-200 dark:bg-slate-800"></div></div><p id="ep-load-progress" role="status" aria-live="polite">Loading questions…</p>`);

try {
let rawQuestions = customQuestions;

if (!rawQuestions) rawQuestions = await preloadChapter(subj, chapterName);
if (mode === 'practice' && configured && !customQuestions) rawQuestions = epApplyScope(rawQuestions, subj, chapterName);

if (!rawQuestions || !rawQuestions.length) {
  setModal('Coming Soon 🚀', chapterName, `
    <div class="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-3 my-4">
      <div class="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto text-xl">
        <i class="fa-solid fa-person-digging"></i>
      </div>
      <h4 class="font-black text-base text-slate-900 dark:text-slate-100">Chapter Question Bank Coming Soon!</h4>
      <p class="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
        The curated question bank for <strong>${escapeHtml(chapterName)}</strong> is currently being compiled. You can still launch an <strong>AI Adaptive Session</strong> or watch the <strong>One-Shot Lecture</strong>!
      </p>
    </div>
  `, `
    <button onclick="closeModal(); openAdaptiveAiConfigModal('${subj}');" class="px-5 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-extrabold shadow-md">Launch AI Adaptive Drill</button>
<button onclick="renderPracticeQuiz()" class="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">Back to question</button>
  `);
  return;
}

if (mode === 'practice') {
  launchPracticeSession(subj, chapterName, rawQuestions);
} else {
  launchTestSession(subj, chapterName, rawQuestions);
}
} catch (err) {
  console.error("Quiz setup error:", err);
  setModal('Error', '', `<p class="text-xs text-rose-500">${escapeHtml(err.message)}</p>`, `<button onclick="closeModal()" class="px-4 py-2 bg-slate-200 rounded-xl text-xs">Close</button>`);
}
}

// ===== launchPracticeSession =====
// ===== Per-chapter saved progress =====
const CHAPTER_SESSIONS_KEY = 'edupulse_chapter_sessions_v1';      // full snapshots (questions + answers)
const CHAPTER_META_KEY = 'edupulse_chapter_sessions_meta_v1';     // tiny summary used by the chapter list
const chapterKey = (subj, ch) => `${subj}|${ch}`;
function readJsonKey(key, fallback) { if (__pqPending && (key === CHAPTER_SESSIONS_KEY || key === CHAPTER_META_KEY)) flushQuizSession(); try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (e) { return fallback; } }
const readChapterSessions = () => readJsonKey(CHAPTER_SESSIONS_KEY, {});
const readChapterMeta = () => readJsonKey(CHAPTER_META_KEY, {});
function writeChapterSessions(map) {
  // If storage is full, drop the least recently used chapter snapshots until it fits.
  for (let i = 0; i < 80; i++) {
    try { localStorage.setItem(CHAPTER_SESSIONS_KEY, JSON.stringify(map)); return true; }
    catch (e) {
      const keys = Object.keys(map).sort((x, y) => (map[x].savedAt || 0) - (map[y].savedAt || 0));
      if (keys.length <= 1) return false;
      delete map[keys[0]];
    }
  }
  return false;
}
function writeChapterMeta(meta) { try { localStorage.setItem(CHAPTER_META_KEY, JSON.stringify(meta)); } catch (e) {} }
function saveChapterSession(snap) {
  const k = chapterKey(snap.subject, snap.chapter);
  const map = readChapterSessions();
  map[k] = snap;
  const ok = writeChapterSessions(map);
  const meta = readChapterMeta();
  const answered = Object.keys(snap.userAnswers || {}).length;
  const correct = snap.questions.reduce((n, q, i) => n + (snap.userAnswers?.[i] === q.correct ? 1 : 0), 0);
  meta[k] = { answered, correct, total: snap.questions.length, bookmarked: Object.values(snap.bookmarked || {}).filter(Boolean).length, savedAt: snap.savedAt };
  // Keep the summary only for snapshots that actually still exist.
  Object.keys(meta).forEach(m => { if (m !== k && !map[m]) delete meta[m]; });
  if (!ok) delete meta[k];
  writeChapterMeta(meta);
}
/* PERF: a snapshot embeds every question (thousands for big chapters) and was written twice, synchronously, on every
   answer / skip / bookmark. Sessions over 150 questions now coalesce bursts into one write ~0.7s after the last change.
   Small sessions still save instantly. Pending data is ALWAYS flushed before anything reads, removes or clears the saved
   session, and when the page is hidden/closed, so behaviour and ordering are unchanged. */
var __pqPending = null, __pqTimer = null;
function __pqWrite(p) {
  StorageModule.set(STORAGE_KEYS.session, p.snap);
  // Normal chapter practice (not infinite / mixed / retry sessions) is also kept per chapter.
  if (p.chap) saveChapterSession(p.snap);
}
function flushQuizSession() {
  if (__pqTimer) { clearTimeout(__pqTimer); __pqTimer = null; }
  if (__pqPending) { const p = __pqPending; __pqPending = null; __pqWrite(p); }
}
function persistQuizSession() {
  if (quizState.mode !== 'practice' || !quizState.questions.length) return;
  const snap = { chapter: quizState.chapter, subject: quizState.subject, title: quizState.title, questions: quizState.questions, currentIndex: quizState.currentIndex, userAnswers: quizState.userAnswers, marked: quizState.marked || {}, bookmarked: quizState.bookmarked, skippedQuestions: quizState.skippedQuestions, questionTimes: quizState.questionTimes, eliminatedOptions: quizState.eliminatedOptions, wrongReasons: quizState.wrongReasons, practiceDeadlineTimestamp: quizState.practiceDeadlineTimestamp || null, savedAt: Date.now() };
  const p = { snap, chap: !quizState.infinite && !!data[quizState.subject]?.includes(quizState.chapter) };
  if (__pqPending && (__pqPending.snap.chapter !== snap.chapter || __pqPending.snap.subject !== snap.subject)) flushQuizSession();
  if (snap.questions.length <= 150) { flushQuizSession(); __pqWrite(p); return; }
  __pqPending = p;
  if (!__pqTimer) __pqTimer = setTimeout(flushQuizSession, 700);
}
addEventListener('pagehide', flushQuizSession);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushQuizSession(); });
function chapterHistoryInfo(subj, ch) {
  const session = readChapterMeta()[chapterKey(subj, ch)] || null;
  const attempts = StorageModule.get(STORAGE_KEYS.attempts, []).filter(a => a.chapter === ch && (!a.subject || a.subject === subj));
  return { session, attempts: attempts.length, has: !!session || attempts.length > 0 };
}
function resumeChapterSession(subj, ch) {
  const snap = readChapterSessions()[chapterKey(subj, ch)];
  if (!snap) return showToast('Saved progress for this chapter was not found.', 'warning');
  StorageModule.set(STORAGE_KEYS.session, snap);
  resumeSavedSession();
}
function startFreshChapter(subj, ch) {
  const map = readChapterSessions(); delete map[chapterKey(subj, ch)]; writeChapterSessions(map);
  const meta = readChapterMeta(); delete meta[chapterKey(subj, ch)]; writeChapterMeta(meta);
  const g = StorageModule.get(STORAGE_KEYS.session, null);
  if (g && g.subject === subj && g.chapter === ch) StorageModule.remove(STORAGE_KEYS.session);
  openPracticeSetup(subj, ch, null, true);
}
function showChapterResumePrompt(subj, ch, m) {
  const pct = m.total ? Math.round((m.answered / m.total) * 100) : 0;
  const acc = m.answered ? Math.round((m.correct / m.answered) * 100) : 0;
  const done = m.answered >= m.total;
  const when = m.savedAt ? new Date(m.savedAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const stat = (v, l) => `<div class="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 text-center"><div class="text-lg font-black text-slate-900 dark:text-slate-100">${v}</div><div class="text-[11px] font-bold uppercase tracking-wider text-slate-500">${l}</div></div>`;
  setModal(done ? 'Review your practice' : 'Welcome back', `${subj} · ${ch}`, `
    <div class="space-y-4 py-2">
      <div class="rounded-2xl border border-teal-500/30 bg-teal-500/10 p-4">
        <div class="flex items-center justify-between text-xs font-black text-teal-700 dark:text-teal-300"><span>${done ? 'All questions answered' : 'Saved progress'}</span><span>${m.answered}/${m.total}</span></div>
        <div class="progress mt-2"><i style="width:${pct}%"></i></div>
        ${when ? `<p class="mt-2 text-[11px] text-slate-500">Last saved ${escapeHtml(when)}</p>` : ''}
      </div>
      <div class="grid grid-cols-3 gap-2">${stat(acc + '%', 'Accuracy')}${stat(m.correct, 'Correct')}${stat(m.bookmarked || 0, 'Bookmarked')}</div>
      <p class="text-[11px] text-slate-500">Resuming keeps your answers, bookmarks, eliminated options and timings. Starting new replaces this saved progress (your past results stay in Stats).</p>
    </div>`,
    `<button onclick="closeModal()" class="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">Cancel</button>
     <button onclick="startFreshChapter('${jsArg(subj)}','${jsArg(ch)}')" class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">Start new</button>
     <button onclick="resumeChapterSession('${jsArg(subj)}','${jsArg(ch)}')" class="px-5 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-black shadow-lg shadow-teal-600/20"><i class="fa-solid fa-play mr-1.5 text-[11px]"></i>${done ? 'Review' : 'Resume'}</button>`);
}
function confirmEraseChapter(subj, ch) {
  const info = chapterHistoryInfo(subj, ch);
  const stats = StorageModule.get(STORAGE_KEYS.qstats, {});
  const slug = slugify(ch) + '#';
  const nQ = Object.keys(stats).filter(k => (stats[k].ch === ch && stats[k].sj === subj) || (!stats[k].ch && k.startsWith(slug))).length;
  if (!info.has && !nQ) return showToast('No saved history for this chapter yet.', 'info');
  setModal('Erase chapter history?', `${subj} · ${ch}`, `
    <div class="space-y-3 py-2 text-sm">
      <div class="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-medium text-rose-800 dark:text-rose-200 leading-relaxed">
        This permanently deletes for <strong>${escapeHtml(ch)}</strong>: saved progress${info.session ? ` (${info.session.answered}/${info.session.total} answered)` : ''}, ${info.attempts} past attempt${info.attempts === 1 ? '' : 's'}, ${nQ} question record${nQ === 1 ? '' : 's'} (bookmarks, mistakes, streaks), and related notes. This can't be undone.
      </div>
    </div>`,
    `<button onclick="closeModal()" class="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">Keep it</button>
     <button onclick="eraseChapterHistory('${jsArg(subj)}','${jsArg(ch)}')" class="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-lg shadow-rose-600/20"><i class="fa-solid fa-trash-can mr-1.5 text-[11px]"></i>Erase history</button>`);
}
function eraseChapterHistory(subj, ch) {
  const k = chapterKey(subj, ch);
  const removedKeys = new Set();
  const map = readChapterSessions();
  (map[k]?.questions || []).forEach(q => q?.qKey && removedKeys.add(q.qKey));
  delete map[k]; writeChapterSessions(map);
  const meta = readChapterMeta(); delete meta[k]; writeChapterMeta(meta);
  const g = StorageModule.get(STORAGE_KEYS.session, null);
  if (g && g.subject === subj && g.chapter === ch) StorageModule.remove(STORAGE_KEYS.session);
  StorageModule.set(STORAGE_KEYS.attempts, StorageModule.get(STORAGE_KEYS.attempts, []).filter(a => !(a.chapter === ch && (!a.subject || a.subject === subj))));
  const stats = StorageModule.get(STORAGE_KEYS.qstats, {});
  const slug = slugify(ch) + '#';
  Object.keys(stats).forEach(key => {
    const m = stats[key] || {};
    const mine = m.ch ? (m.ch === ch && m.sj === subj) : key.startsWith(slug);
    if (mine) { removedKeys.add(key); delete stats[key]; }
  });
  StorageModule.set(STORAGE_KEYS.qstats, stats);
  ['edupulse_question_notes_v1', 'edupulse_question_confidence_v1', STORAGE_KEYS.errorNotebook].forEach(storeKey => {
    const obj = readJsonKey(storeKey, null);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    let changed = false;
    removedKeys.forEach(id => { if (id in obj) { delete obj[id]; changed = true; } });
    if (changed) { try { localStorage.setItem(storeKey, JSON.stringify(obj)); } catch (e) {} }
  });
  closeModal();
  showToast(`History erased for ${ch}.`, 'success');
  renderView();
}
function resumeQuizSession() {
  const s = StorageModule.get(STORAGE_KEYS.session, null); if (!s?.questions?.length) return;
  Object.assign(quizState, { mode:'practice', chapter:s.chapter, subject:s.subject, title:s.title, questions:s.questions, currentIndex:s.currentIndex || 0, userAnswers:s.userAnswers || {}, marked:s.marked || {}, bookmarked:s.bookmarked || {}, skippedQuestions:s.skippedQuestions || {}, questionTimes:s.questionTimes || {}, eliminatedOptions:s.eliminatedOptions || {}, wrongReasons:s.wrongReasons || {}, practiceDeadlineTimestamp:s.practiceDeadlineTimestamp || null, practiceTimeExpired:false, questionStartTimer:Date.now(), paletteExpanded:false, infinite:null });
  closeModal(); renderPracticeQuiz();
}
function launchPracticeSession(subj, chapterName, rawQuestions, infiniteState = null) {
  const settings = StorageModule.get(STORAGE_KEYS.settings, defaultSettings);
  const stats = StorageModule.get(STORAGE_KEYS.qstats, {});
  const source = settings.practiceSource || 'All';
  const requestedDifficulty = String(settings.practiceDifficulty || 'mixed').toLowerCase();
  let questions = [...rawQuestions].filter(q => {
    const stat = stats[q.qKey] || {};
    let matchesSource = true;
    if (/pyq/i.test(source)) matchesSource = !!(q.exam || q.year);
    else if (/ncert/i.test(source)) matchesSource = /ncert/i.test([q.source, q.sourceName, q.book, q.sourceTitle].filter(Boolean).join(' '));
    else if (source.toLowerCase() === 'unseen') matchesSource = !stat.seen;
    else if (source.toLowerCase().includes('wrong')) matchesSource = (stat.wrong || 0) > 0;
    else if (source.toLowerCase().includes('bookmark')) matchesSource = !!stat.bookmarked;
    const rawDifficulty = String(q.difficulty || q.level || '').toLowerCase();
    const matchesDifficulty = requestedDifficulty === 'mixed' || !rawDifficulty ||
      (requestedDifficulty === 'easy' && /easy|basic|beginner/.test(rawDifficulty)) ||
      (requestedDifficulty === 'moderate' && /moderate|medium|intermediate/.test(rawDifficulty)) ||
      (requestedDifficulty === 'difficult' && /difficult|hard|advanced/.test(rawDifficulty));
    return matchesSource && matchesDifficulty;
  });
  if (!questions.length) {
    showToast('No questions match this preset and difficulty. Try Mixed or another source.', 'warning');
    return;
  }
  questions = settings.shuffleQuestions ? fisherYates(questions) : questions;
  if (settings.shuffleOptions) questions = questions.map(q => {
    if (hasLockedOption(q.options, q)) return q;
    const indexed = q.options.map((option, index) => ({ option, index }));
    const shuffled = fisherYates(indexed);
    return { ...q, options: shuffled.map(x => x.option), correct: shuffled.findIndex(x => x.index === q.correct) };
  });
  const length = Number(settings.practiceLength || 'all');
  if (Number.isFinite(length) && length > 0) questions = questions.slice(0, length);
  Object.assign(quizState, {
    mode: 'practice',
    chapter: chapterName,
    subject: subj,
    title: `${subj} — ${chapterName}`,
    questions,
    currentIndex: 0,
    userAnswers: {},
    marked: {},
    bookmarked: {},
skippedQuestions: {},
eliminatedOptions: {},
wrongReasons: {},
questionTimes: {},
    questionStartTimer: Date.now(),
    testEndTimestamp: null,
    practiceDeadlineTimestamp: null,
    practiceTimeExpired: false,
    paletteExpanded: false,
    infinite: infiniteState   // null for normal chapter practice
  });
  closeModal();
  setTimeout(() => { renderPracticeQuiz(); }, 50);
}

function launchTestSession(subj, chapterName, rawQuestions) {
const durationMins = wizardState.durationMins || 180;
const endTimestamp = Date.now() + durationMins * 60 * 1000;

Object.assign(quizState, {
mode: 'test',
chapter: chapterName,
subject: subj,
title: `${subj} — ${chapterName} (${rawQuestions.length} Questions)`,
questions: rawQuestions,
currentIndex: 0,
userAnswers: {},
marked: {},
bookmarked: {},
skippedQuestions: {},
questionTimes: {},
wrongReasons: {},
questionStartTimer: Date.now(),
testEndTimestamp: endTimestamp,
paletteExpanded: false,
infinite: null
});
closeModal();
setTimeout(() => { renderTestQuiz(); }, 50);
}

function palettePage(d) {
  const total = quizState.questions.length, PG = 100, pages = Math.ceil(total / PG);
  const cur = (quizState.palPage != null && quizState.palPageAt === quizState.currentIndex) ? quizState.palPage : Math.floor(quizState.currentIndex / PG);
  quizState.palPage = Math.min(pages - 1, Math.max(0, cur + d)); quizState.palPageAt = quizState.currentIndex;
  const el = document.querySelector('.palette-drawer-top'); if (!el) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = buildTopInteractiveQuestionPalette(!!quizState.palIsPractice).trim();
  const nu = tmp.firstElementChild; if (!nu) return;
  el.replaceWith(nu);
  if (quizState.paletteExpanded) togglePaletteDrawer(true);
}
function buildTopInteractiveQuestionPalette(isPractice = false) {
  const total = quizState.questions.length;
  const current = quizState.currentIndex;

  let answeredCount = 0, markedCount = 0, unvisitedCount = 0;

  // PERF: never render N buttons. Counts come from a cheap numeric loop; HTML is built only for
  // a small window (strip) and one page (expanded grid), so cost no longer grows with question count.
  quizState.palIsPractice = !!isPractice;
  const BIG = total > 120, STRIP_R = 30, PAL_PAGE = 100;
  const stateOf = (i) => {
    const ans = quizState.userAnswers[i], m = quizState.marked[i];
    if (isPractice) return ans === undefined ? ((quizState.skippedQuestions||{})[i] ? 'pal-unseen pal-skipped' : 'pal-unseen') : (ans === quizState.questions[i].correct ? 'pal-correct' : 'pal-wrong');
    if (ans !== undefined && m) return 'pal-both';
    return ans !== undefined ? 'pal-answered' : (m ? 'pal-marked' : 'pal-unseen');
  };
  for (let i = 0; i < total; i++) {
    const ans = quizState.userAnswers[i], m = quizState.marked[i];
    if (isPractice) { if (ans !== undefined) answeredCount++; else unvisitedCount++; }
    else if (ans !== undefined && m) { answeredCount++; markedCount++; }
    else if (ans !== undefined) answeredCount++;
    else if (m) markedCount++;
    else unvisitedCount++;
  }
  const palBtn = (i) => {
    const cur = i === current ? 'pal-current ring-2' : '';
    return `<button type="button" data-q="${i}" aria-label="Question ${i + 1}" ${i === current ? 'aria-current="true"' : ''} onclick="${isPractice ? `jumpToPracticeQuestion(${i})` : `jumpToTestQuestion(${i})`}" class="palette-touch-btn ${stateOf(i)} ${cur}">${i + 1}</button>`;
  };
  const palRange = (a, b) => { let h = ''; for (let i = a; i <= b; i++) h += palBtn(i); return h; };
  const gapBtn = (label) => `<button type="button" class="palette-touch-btn pal-unseen" aria-label="${label}" onclick="togglePaletteDrawer(true)">\u2026</button>`;
  const sLo = BIG ? Math.max(0, current - STRIP_R) : 0, sHi = BIG ? Math.min(total - 1, current + STRIP_R) : total - 1;
  const stripHtml = (sLo > 0 ? gapBtn('Earlier questions') : '') + palRange(sLo, sHi) + (sHi < total - 1 ? gapBtn('Later questions') : '');
  const palPages = Math.ceil(total / PAL_PAGE);
  let palPage = Math.floor(current / PAL_PAGE);
  if (BIG && quizState.palPage != null && quizState.palPageAt === current) palPage = Math.min(palPages - 1, Math.max(0, quizState.palPage));
  const gLo = BIG ? palPage * PAL_PAGE : 0, gHi = BIG ? Math.min(total - 1, gLo + PAL_PAGE - 1) : total - 1;
  const pagerHtml = BIG ? `<div class="pal-pager"><button type="button" class="pal-pg" onclick="palettePage(-1)" aria-label="Previous 100 questions" ${palPage === 0 ? 'disabled' : ''}>\u2039</button><span>${gLo + 1}\u2013${gHi + 1} of ${total.toLocaleString('en-IN')}</span><button type="button" class="pal-pg" onclick="palettePage(1)" aria-label="Next 100 questions" ${palPage >= palPages - 1 ? 'disabled' : ''}>\u203a</button></div>` : '';
  const gridHtml = pagerHtml + `<div class="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 ${BIG ? '' : 'max-h-52 overflow-y-auto pr-1'}">` + palRange(gLo, gHi) + `</div>`;

  const isExpanded = quizState.paletteExpanded;

  return `
    <div data-expanded="${isExpanded}" data-epf="${quizState.palFilter||'all'}" class="palette-drawer-top w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 rounded-b-2xl shadow-md overflow-hidden mb-3 transition-all duration-300 ${isExpanded ? 'is-expanded' : ''}">
      <div onclick="togglePaletteDrawer()" class="px-3 py-2 cursor-pointer flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
        <div class="flex items-center gap-2">
          <span class="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <i class="fa-solid fa-grid-2 text-teal-600"></i> Palette
            <span class="px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 text-[11px]">${current + 1}/${total}</span>
          </span>
          <span class="text-[11px] text-slate-400 font-semibold hidden sm:inline">(Swipe Left/Right to Navigate)</span>
        </div>

        <div class="flex items-center gap-2.5 text-[11px] font-bold">
          <span class="text-emerald-600 flex items-center gap-1"><i class="fa-solid fa-circle text-[7px]"></i> ${answeredCount} Done</span>
          ${!isPractice ? `<span class="text-indigo-600 flex items-center gap-1"><i class="fa-solid fa-circle text-[7px]"></i> ${markedCount} Marked</span>` : ''}
          <button type="button" aria-label="${isExpanded ? 'Collapse' : 'Expand'} question palette" aria-expanded="${isExpanded}" title="${isExpanded ? 'Collapse question palette' : 'Expand question palette'}" onclick="event.stopPropagation();togglePaletteDrawer()" class="palette-expand-trigger w-8 h-8 inline-flex items-center justify-center rounded-full border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 active:scale-95 transition-all shadow-sm">
            <i class="fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-xs"></i>
          </button>
        </div>
      </div>

      <div class="p-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
        ${stripHtml}
      </div>

      <div class="palette-expanded-content p-3 space-y-2 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800" aria-hidden="${!isExpanded}">
        <div class="pal-legend">
          ${isPractice
            ? `<span><i class="pal-dot pal-correct"></i>Correct</span><span><i class="pal-dot pal-wrong"></i>Wrong</span>`
            : `<span><i class="pal-dot pal-answered"></i>Answered</span><span><i class="pal-dot pal-marked"></i>Review flag</span><span><i class="pal-dot pal-both"></i>Answered &amp; marked</span>`}
          <span><i class="pal-dot pal-unseen"></i>Not attempted</span>
          <span><i class="pal-dot pal-current"></i>Current</span>
        </div>
        ${isPractice && window.epPalChips ? window.epPalChips() : ''}
        ${gridHtml}
      </div>
    </div>
  `;
}

// ===== Practice Quiz UI & Handlers =====

function buildInfiniteStatsStrip() {
  const st = quizState.infinite;
  const h = st.history, n = h.length;
  const c = h.filter(x => x.correct).length;
  const acc = n ? Math.round((c / n) * 100) : 0;
  let run = 0;
  for (let i = n - 1; i >= 0 && h[i].correct; i--) run++;
  const lv = INF_LEVELS[st.level];

  const bars = [1, 2, 3, 4, 5].map(i =>
    `<span class="h-2 w-5 rounded-full ${i <= st.level ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'}"></span>`
  ).join('');

  const shift = st.shift === 'up'
    ? `<span class="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[11px] font-black"><i class="fa-solid fa-arrow-trend-up mr-1"></i>Level up!</span>`
    : st.shift === 'down'
    ? `<span class="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-600 text-[11px] font-black"><i class="fa-solid fa-arrow-trend-down mr-1"></i>Easing off</span>`
    : '';

  const prefetchIndicator = st.fetching
    ? `<span class="text-[11px] text-teal-600 dark:text-teal-400 font-bold animate-pulse flex items-center gap-1"><i class="fa-solid fa-cloud-arrow-down"></i> Prefetching Batch...</span>`
    : '';

  return `
  <div class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm px-4 py-3 mb-3 flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-3">
      <div class="flex gap-1">${bars}</div>
      <span class="text-xs font-black ${lv.color}">${lv.name}</span>
      ${shift}
    </div>
    <div class="flex items-center gap-4 text-[11px] font-bold text-slate-500 dark:text-slate-400">
      ${prefetchIndicator}
      <span><i class="fa-solid fa-circle-check text-emerald-500 mr-1"></i>${c}/${n}</span>
      <span><i class="fa-solid fa-bullseye text-teal-500 mr-1"></i>${acc}%</span>
      <span><i class="fa-solid fa-fire text-amber-500 mr-1"></i>${run} streak</span>
    </div>
  </div>`;
}

function renderPracticeQuiz() {
  toggleFullScreenMode(true);
  const q = quizState.questions[quizState.currentIndex];
  if (!q) return;
  const inf = quizState.infinite;
  const idx = quizState.currentIndex, total = quizState.questions.length;
  const selected = quizState.userAnswers[idx], answered = selected !== undefined;
  const isRight = selected === q.correct;
  const last = idx === total - 1;
  const pqAns = Object.keys(quizState.userAnswers).length;
  const pqRight = Object.keys(quizState.userAnswers).filter(k => quizState.questions[k] && quizState.userAnswers[k] === quizState.questions[k].correct).length;
  const pqWrong = pqAns - pqRight;
  const pqAuto = (() => { try { return localStorage.getItem('edupulse_autonext') === '1'; } catch (e) { return false; } })();
  const pqPct = total ? Math.round(pqAns / total * 100) : 0;

  const topStrip = inf ? buildInfiniteStatsStrip() : buildTopInteractiveQuestionPalette(true);

  const eliminated = quizState.eliminatedOptions[idx] || {};
  const options = q.options.map((opt, i) => {
    let c = 'flex items-center gap-3 w-full rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition cursor-pointer active:scale-98 touch-manipulation ';
    if (eliminated[i] && !answered) c += 'opacity-45 line-through border-amber-300 bg-amber-50 dark:bg-amber-950/20 ';
    if (answered) {
      if (i === q.correct) c += 'border-emerald-500 bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200 font-bold';
      else if (i === selected) c += 'border-rose-500 bg-rose-100 text-rose-900 dark:bg-rose-950/30 dark:text-rose-200 font-bold';
      else c += 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 opacity-60';
    } else {
      c += 'border-slate-200 bg-slate-50 text-slate-700 hover:border-teal-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
    }
    return `<button type="button" role="radio" aria-checked="${selected === i}" aria-label="Option ${String.fromCharCode(65 + i)}${eliminated[i] ? ', eliminated' : ''}" class="${c}" ${answered ? 'disabled' : `onclick="selectPracticeOption(${i})" oncontextmenu="event.preventDefault(); toggleEliminatedOption(${i})"`}> ${answered && i === q.correct ? '<span class="opt-badge opt-ok"><i class="fa-solid fa-check"></i></span>' : answered && i === selected ? '<span class="opt-badge opt-bad"><i class="fa-solid fa-xmark"></i></span>' : `<span class="opt-badge">${String.fromCharCode(65 + i)}</span>`} <span class="flex-1">${formatQuizText(opt)}${epOptImg(q, i)}</span>${eliminated[i] ? '<i class="fa-solid fa-xmark text-amber-600"></i>' : ''}</button>`;
  }).join('');

  const qStats = StorageModule.get(STORAGE_KEYS.qstats, {})[q.qKey] || {};
  const historyBadge = qStats.seen ? (qStats.streak >= 3 ? '3 correct in a row' : `Missed ${qStats.wrong || 0}×`) : 'First time';
  const result = answered ? `<div id="quiz-result" tabindex="-1" class="mt-4 rounded-2xl border ${isRight ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300'} p-4 text-sm font-semibold space-y-3">
<div class="flex items-center justify-between">
<span>${isRight ? '<i class="fa-solid fa-circle-check text-emerald-500 mr-2"></i>Correct!' : '<i class="fa-solid fa-circle-xmark text-rose-500 mr-2"></i>Incorrect.'} Correct option: <span class="font-black">${String.fromCharCode(65 + q.correct)}. ${escapeHtml(q.options[q.correct])}</span></span>
</div>
${q.explanation && q.explanation !== 'NCERT Concept.' ? `<div class="text-xs font-medium opacity-80 leading-relaxed">${formatQuizText(q.explanation)}</div>` : `<button onclick="showAiQuestionExplanation(${idx})" class="text-xs font-black text-purple-600 hover:underline">Generate explanation</button>`}
${q.ncert ? `<button type="button" onclick="epOpenNcert('${q.ncert.b}',${q.ncert.pg},${q.ncert.i})" class="ep-ncert-btn"><i class="fa-solid fa-book-open"></i> View in NCERT <small>p. ${q.ncert.pg}</small></button>` : ''}
${q.note ? `<div class="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] font-semibold leading-relaxed">${multiline(q.note)}</div>` : ''}
${!isRight ? `<div class="pt-2 ep-why-miss">${window.EP && EP.review ? EP.review.statusHtml(q) : ''}<p class="mt-3 mb-2">Why did you miss it?</p><div class="flex flex-wrap gap-2" role="group" aria-label="Why did you miss it?">${['Conceptual gap','Factual recall','Calculation error','Careless mistake','Time pressure'].map(reason => `<button type="button" aria-pressed="${quizState.wrongReasons[idx] === reason}" onclick="tagWrongReason('${jsArg(reason)}')" class="ep-reason-chip px-3 py-2 rounded-xl border text-xs font-bold ${quizState.wrongReasons[idx] === reason ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 dark:border-slate-700'}">${reason}</button>`).join('')}</div></div>` : ''}
<div class="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex flex-wrap justify-end gap-2">
  <button type="button" onclick="searchQuestionOnYouTube()" class="ep-yt-explain px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5" aria-label="Watch video explanation of this question on YouTube" title="Search this question on YouTube">
    <i class="fa-brands fa-youtube text-sm"></i> Video Explanation
  </button>
  <button onclick="showAiQuestionExplanation(${idx})" class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5">\n    <i class="fa-solid fa-wand-magic-sparkles text-xs"></i> AI Explain\n  </button>\n  <button onclick="openPracticeDoubt(${idx})" class="px-4 py-2 rounded-xl border border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-200 font-bold text-xs transition flex items-center gap-1.5">\n    <i class="fa-regular fa-circle-question text-xs"></i> Ask a doubt\n  </button>
</div>
</div>` : '';

  const qLabel = inf
    ? `Question ${idx + 1} · <span class="${INF_LEVELS[q.level || inf.level].color}">${INF_LEVELS[q.level || inf.level].name}</span>`
    : `Question ${idx + 1} of ${total}`;

  const nextBtn = inf
    ? `<button type="button" id="infinite-next-btn" ${answered ? '' : 'data-locked="1" aria-disabled="true" title="Pick an answer to unlock"'} onclick="if(this.dataset.locked){epNudgeAnswer();return}goToNextPracticeQuestion()" class="pq-next flex items-center gap-1.5 disabled:opacity-60"><span>Next Question</span> <i class="fa-solid fa-arrow-right text-[11px]"></i></button>`
    : `<button type="button" ${answered ? '' : 'data-locked="1" aria-disabled="true" title="Pick an answer to unlock"'} onclick="if(this.dataset.locked){epNudgeAnswer();return}${last ? 'finishPracticeQuiz()' : 'goToNextPracticeQuestion()'}" class="pq-next"><span>${last ? 'Finish Quiz' : 'Next'}</span><i class="fa-solid ${answered ? (last ? 'fa-flag-checkered' : 'fa-arrow-right') : 'fa-lock'}"></i></button>`;

  const html = `<div class="quiz-session-layout w-full h-full min-h-0 flex flex-col justify-between max-w-5xl mx-auto p-2 sm:p-4 relative overflow-hidden">
<div class="mb-1 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
<div class="flex items-center gap-3">
<button type="button" onclick="confirmExitQuiz()" class="p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"><i class="fa-solid fa-arrow-left text-lg"></i></button>
<div>
<h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">${escapeHtml(quizState.title)}</h2>
<p class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">${inf ? '<i class="fa-solid fa-infinity text-teal-500"></i> Infinite Batch Practice — 5-10 MCQs Prefetched' : 'Practice · ' + (idx + 1) + ' of ' + total}</p>
</div>
</div>
<div class="flex items-center gap-2">
<span class="pq-chip pq-time" id="pq-timer" title="Time on this question"><i class="fa-regular fa-clock"></i><b>0:00</b></span><span class="pq-chip pq-ok" title="Correct"><i class="fa-solid fa-check"></i>${pqRight}</span><span class="pq-chip pq-no" title="Wrong"><i class="fa-solid fa-xmark"></i>${pqWrong}</span>
${inf ? '' : `<button type="button" class="pq-auto ${pqAuto ? 'on' : ''}" onclick="togglePqAutoNext()" aria-pressed="${pqAuto}" title="Auto-advance after a correct answer"><i class="fa-solid fa-forward-fast"></i><span>Auto</span></button>`}
<button onclick="finishPracticeQuiz()" class="px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs hover:bg-rose-500 hover:text-white transition">${inf ? 'End Session' : 'Exit'}</button>
</div>
${inf ? '' : `<div class="pq-progress" aria-hidden="true"><i style="width:${pqPct}%"></i></div>`}
</div>

${inf ? '' : `<div class="quiz-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Object.keys(quizState.userAnswers).length / total * 100)}"><span style="width:${Math.round(Object.keys(quizState.userAnswers).length / total * 100)}%"></span></div>`}
${topStrip}

<div ontouchstart="handleTouchStart(event)" ontouchmove="handleTouchMove(event)" ontouchend="handleTouchEnd()" class="flex-1 overflow-y-auto my-1 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 flex flex-col justify-between select-none">
<div>
<div class="flex items-center justify-between text-xs font-bold text-slate-400 uppercase">
  <span class="text-teal-600 dark:text-teal-400">${qLabel}</span>
  <div class="ep-qa" role="toolbar" aria-label="Question actions">
    <button type="button" class="ep-qa-btn ep-qa-bm" data-qa="bookmark" aria-pressed="${quizState.bookmarked?.[idx] ? 'true' : 'false'}" title="${quizState.bookmarked?.[idx] ? 'Remove bookmark' : 'Bookmark'}" aria-label="Bookmark" onclick="epQa('bookmark',this)"><i class="${quizState.bookmarked?.[idx] ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i></button>
    <button type="button" class="ep-qa-btn" title="Share" aria-label="Share" aria-haspopup="menu" onclick="epQaMenu(this,'share')"><i class="fa-solid fa-share-nodes"></i></button>
    <button type="button" class="ep-qa-btn" title="More actions" aria-label="More actions" aria-haspopup="menu" onclick="epQaMenu(this,'more')"><i class="fa-solid fa-ellipsis"></i></button>
  </div>
</div>
<div class="quiz-meta"><span class="qm-ch">${escapeHtml(q.sourceChapter || quizState.chapter)}</span>${q.topic && q.topic !== 'NCERT Concepts' ? `<span class="qm-topic">${escapeHtml(q.topic)}</span>` : ''}<span>${escapeHtml(q.difficulty || 'Medium')}</span>${q.exam ? `<span>${escapeHtml(q.exam)}</span>` : q.year ? `<span>NEET ${escapeHtml(q.year)}</span>` : ''}<span>${escapeHtml(historyBadge)}</span></div>
<p class="quiz-stem mt-4 text-base sm:text-lg text-slate-900 dark:text-slate-100">${formatQuizText(q.question)}</p>
${epExtras(q)}
<div class="mt-5 space-y-3">${options}</div>
${result}
</div>

<div class="pq-foot">
<button type="button" class="pq-prev" aria-label="Previous question" onclick="jumpToPracticeQuestion(${Math.max(0, idx - 1)})" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-left"></i></button>
${!answered ? '<button type="button" class="pq-skip" onclick="skipCurrentQuestion()" title="Skip this question"><span>Skip</span><i class="fa-solid fa-forward-step"></i></button>' : ''}
${nextBtn}
</div>
</div>

</div>`;
  setModal('', '', html);
}

function selectPracticeOption(i) {
  if (quizState.userAnswers[quizState.currentIndex] !== undefined) return;
  quizState.userAnswers[quizState.currentIndex] = i;
  const q = quizState.questions[quizState.currentIndex];
  quizState.questionTimes[quizState.currentIndex] = Math.max(0, Math.round((Date.now() - quizState.questionStartTimer) / 1000));
  quizState.questionStartTimer = Date.now();
  const correct = !!q && i === q.correct;
  const stats = StorageModule.get(STORAGE_KEYS.qstats, {});
  const key = q?.qKey || `${quizState.chapter}:${quizState.currentIndex}`;
  stats[key] = stats[key] || { seen: 0, correct: 0, wrong: 0, streak: 0, lastSeen: 0 };
  if (quizState.subject && quizState.subject !== 'Mixed' && !q?.sourceChapter?.includes(':')) { stats[key].sj = stats[key].sj || quizState.subject; stats[key].ch = stats[key].ch || (q?.sourceChapter || quizState.chapter); }
  stats[key].seen++; stats[key].lastSeen = Date.now();
  if (correct) { stats[key].correct++; stats[key].streak++; } else { stats[key].wrong++; stats[key].streak = 0; }
  StorageModule.set(STORAGE_KEYS.qstats, stats);
  if (navigator.vibrate && StorageModule.get(STORAGE_KEYS.settings, defaultSettings).haptics) navigator.vibrate(correct ? 10 : [10, 40, 10]);
  persistQuizSession();
  if (quizState.infinite && q) adaptInfinite(correct, q);
  renderPracticeQuiz();
  setTimeout(() => document.getElementById('quiz-result')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 40);
}

function jumpToPracticeQuestion(i) {
  if (i < 0 || i >= quizState.questions.length) return;
  quizState.currentIndex = i;
  persistQuizSession();
  renderPracticeQuiz();
}

async function goToNextPracticeQuestion() {
  const st = quizState.infinite;

  // normal chapter practice
  if (!st) {
    if (quizState.currentIndex < quizState.questions.length - 1) {
      quizState.currentIndex++;
      persistQuizSession();
      renderPracticeQuiz();
    } else {
      finishPracticeQuiz();
    }
    return;
  }

  // infinite mode: check if we need more questions
  if (st.waiting) return;
  if (quizState.currentIndex + 1 >= quizState.questions.length) {
    st.waiting = true;
    const btn = document.getElementById('infinite-next-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-xs"></i> <span>Prefetching batch...</span>`; }
    if (!st.fetching) requestInfiniteBatch(7);
    await st.fetchPromise;
    st.waiting = false;
    if (quizState.infinite !== st) return;

    if (quizState.currentIndex + 1 >= quizState.questions.length) {
      const b = document.getElementById('infinite-next-btn');
      if (b) { b.disabled = false; b.innerHTML = `<i class="fa-solid fa-rotate-right text-xs"></i> <span>Retry — ${escapeHtml(st.error || 'could not generate')}</span>`; }
      return;
    }
  }

  st.shift = null;
  quizState.currentIndex++;
  renderPracticeQuiz();

  // Trigger continuous prefetch as queue moves forward
  checkAndTriggerPrefetch();
}

function finishInfiniteSession() {
  const st = quizState.infinite;
  const settings = StorageModule.get(STORAGE_KEYS.settings, defaultSettings);
  let correct = 0, wrong = 0;
  Object.keys(quizState.userAnswers).forEach(k => {
    const q = quizState.questions[k];
    if (!q) return;
    if (quizState.userAnswers[k] === q.correct) correct++; else wrong++;
  });
  const attempted = correct + wrong;

  st.gen++;
  quizState.infinite = null;

  if (!attempted) {
    closeModal();
    renderView();
    showToast('Session ended — no questions answered.', 'warning');
    return;
  }

  const attempt = {
    id: 'att_' + Date.now(),
    chapter: `Infinite Adaptive: ${st.chapter} (peak: ${INF_LEVELS[st.peak].name})`,
    subject: st.subject,
    mode: 'infinite',
    finishedAt: Date.now(),
    total: attempted, attempted, correct, wrong, skipped: 0,
    score: correct * settings.marksCorrect + wrong * settings.marksWrong,
    maxScore: attempted * settings.marksCorrect,
    accuracy: Math.round((correct / attempted) * 100)
  };

  const attempts = StorageModule.get(STORAGE_KEYS.attempts, []);
  attempts.unshift(attempt);
  StorageModule.set(STORAGE_KEYS.attempts, attempts);
  StorageModule.recordActivity(attempted);
  showResultScreen(attempt);
}

function finishPracticeQuiz() {
  if (quizState.infinite) return finishInfiniteSession();
  submitTestQuiz(false);
}

function renderTestQuiz() {
toggleFullScreenMode(true);
if (!quizState.timerInterval) {
quizState.timerInterval = setInterval(() => {
const left = Math.max(0, Math.floor((quizState.testEndTimestamp - Date.now()) / 1000));
const timerEl = document.getElementById('test-timer-display');
if (timerEl) {
const mm = String(Math.floor(left / 60)).padStart(2, '0');
const ss = String(left % 60).padStart(2, '0');
timerEl.textContent = `${mm}:${ss}`;
}
if (left <= 0) { clearInterval(quizState.timerInterval); submitTestQuiz(true); }
}, 1000);
}

const q = quizState.questions[quizState.currentIndex];
if (!q) return;
const idx = quizState.currentIndex, total = quizState.questions.length;
const selected = quizState.userAnswers[idx];
const isMarked = !!quizState.marked[idx];

const paletteHtml = buildTopInteractiveQuestionPalette(false);

const options = q.options.map((opt, i) => {
const isSel = selected === i;
let c = 'flex items-center gap-3 w-full rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition cursor-pointer active:scale-98 ';
if (isSel) c += 'border-teal-500 bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-bold';
else c += 'border-slate-200 bg-slate-50 text-slate-700 hover:border-teal-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
return `<button type="button" class="${c}" onclick="selectTestOption(${i})"> <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-bold text-slate-700 shadow-sm dark:bg-slate-700 dark:text-slate-100">${String.fromCharCode(65 + i)}</span> <span class="flex-1">${formatQuizText(opt)}${epOptImg(q, i)}</span></button>`;
}).join('');

const html = `<div class="quiz-session-layout w-full h-full min-h-0 flex flex-col justify-between max-w-5xl mx-auto p-2 sm:p-4 relative overflow-hidden"> 
<div class="mb-1 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2"> 
<div class="flex items-center gap-3"> 
<button type="button" onclick="confirmExitQuiz()" class="p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"><i class="fa-solid fa-arrow-left text-lg"></i></button> 
<div> 
<h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">${escapeHtml(quizState.title)}</h2> 
<p class="text-xs text-slate-500 dark:text-slate-400">Test Simulation Mode</p> 
</div> 
</div> 
<div class="flex items-center gap-3"> 
<div id="test-timer-display" class="text-xs font-black px-3 py-1.5 rounded-xl bg-teal-600 text-white">--:--</div> 
<button onclick="confirmSubmitTest()" class="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition">Submit Test</button> 
</div> 
</div> 

${paletteHtml}

<div ontouchstart="handleTouchStart(event)" ontouchmove="handleTouchMove(event)" ontouchend="handleTouchEnd()" class="flex-1 overflow-y-auto my-1 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 flex flex-col justify-between select-none"> 
<div> 
<div class="flex items-center justify-between"> 
<span class="text-xs font-bold uppercase text-teal-600 dark:text-teal-400">Question ${idx + 1} of ${total}</span> 
<div class="flex gap-2">
<button type="button" onclick="toggleMarkTestCurrent()" class="px-3 py-1 rounded-lg border ${isMarked ? 'border-amber-500 bg-amber-500/10 text-amber-600' : 'border-slate-200 dark:border-slate-700 text-slate-500'} text-xs font-bold transition"><i class="fa-solid fa-flag mr-1"></i> ${isMarked ? 'Marked' : 'Mark'}</button> 
</div>
</div> 
<p class="mt-3 text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">${multiline(q.question)}</p>${epExtras(q)}
<div class="mt-5 space-y-3" role="radiogroup" aria-label="Answer options">${options}</div>
</div> 

<div class="quiz-sticky-actions mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
<button type="button" onclick="jumpToTestQuestion(${Math.max(0, idx - 1)})" ${idx === 0 ? 'disabled' : ''} class="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-xs font-bold hover:bg-slate-200 disabled:opacity-40">← Previous</button> 
<button type="button" onclick="jumpToTestQuestion(${Math.min(total - 1, idx + 1)})" class="rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-700 transition">Next →</button> 
</div> 
</div> 

</div>`;
setModal('', '', html);
}

function recordCurrentTestQuestionTime() {
  if (quizState.mode !== 'test' || !quizState.questions.length) return;
  const startedAt = Number(quizState.questionStartTimer) || Date.now();
  const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  quizState.questionTimes[quizState.currentIndex] = (Number(quizState.questionTimes[quizState.currentIndex]) || 0) + elapsed;
  quizState.questionStartTimer = Date.now();
}

function selectTestOption(i) {
  recordCurrentTestQuestionTime();
  quizState.userAnswers[quizState.currentIndex] = i;
  renderTestQuiz();
}
function toggleMarkTestCurrent() { quizState.marked[quizState.currentIndex] = !quizState.marked[quizState.currentIndex]; renderTestQuiz(); }
function jumpToTestQuestion(i) {
  if (i >= 0 && i < quizState.questions.length) {
    recordCurrentTestQuestionTime();
    quizState.currentIndex = i;
    quizState.questionStartTimer = Date.now();
    renderTestQuiz();
  }
}
function confirmSubmitTest() { submitTestQuiz(false); }

function confirmExitQuiz() {
  const isTestMode = quizState.mode === 'test';
  const answeredCount = Object.keys(quizState.userAnswers).length;
  
  setModal('Leave Practice Session?', 'Are you sure you want to quit this active attempt?', `
    <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-2">
      <div class="flex items-center gap-2 font-black text-sm">
        <i class="fa-solid fa-triangle-exclamation text-amber-600"></i>
        <span>Unsaved Attempt Warning</span>
      </div>
      <p class="leading-relaxed opacity-90">
        ${isTestMode ? `You have answered <strong>${answeredCount} of ${quizState.questions.length}</strong> questions in this test simulation. Leaving now will cancel this timed attempt.` : `Leaving now will return you to the main dashboard.`}
      </p>
    </div>
  `, `
    <button onclick="${isTestMode ? 'renderTestQuiz()' : 'renderPracticeQuiz()'}" class="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 text-xs">Continue Attempt</button>
    <button onclick="closeModal(); renderView();" class="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md">Yes, Leave Session</button>
  `);
}

function testSubjectForQuestion(question) {
  const text = `${question.subject || ''} ${question.sourceChapter || ''} ${question.source || ''}`;
  if (/biology|botany|zoology/i.test(text)) return 'Biology';
  if (/chemistry/i.test(text)) return 'Chemistry';
  if (/physics/i.test(text)) return 'Physics';
  return ['Biology', 'Chemistry', 'Physics'].includes(quizState.subject) ? quizState.subject : 'Other';
}

function buildTestReviewItems() {
  return quizState.questions.map((question, index) => {
    const options = Array.isArray(question.options) ? question.options.slice(0, 4).map(option => String(option || '').slice(0, 80)) : [];
    return {
      number: index + 1,
      selected: quizState.userAnswers[index] === undefined ? null : Number(quizState.userAnswers[index]),
      seconds: Number(quizState.questionTimes[index]) || 0,
      marked: !!quizState.marked[index],
      question: {
        qKey: String(question.qKey || '').slice(0, 120),
        question: String(question.question || '').slice(0, 200),
        options,
        correct: Number.isInteger(Number(question.correct)) ? Number(question.correct) : 0,
        explanation: String(question.explanation || '').slice(0, 160),
        subject: testSubjectForQuestion(question),
        sourceChapter: String(question.sourceChapter || quizState.chapter || '').slice(0, 120),
        topic: String(question.topic || question.section || '').slice(0, 90),
        difficulty: String(question.difficulty || question.level || '').slice(0, 40)
      }
    };
  });
}

function saveTestReviewDetails(attemptId, questions) {
  try {
    const stored = StorageModule.get(TEST_REVIEW_KEY, {});
    const reviews = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    reviews[attemptId] = { savedAt: Date.now(), questions };
    const retained = Object.entries(reviews)
      .sort((a, b) => Number(a[1]?.savedAt || 0) - Number(b[1]?.savedAt || 0))
      .slice(-2);
    StorageModule.set(TEST_REVIEW_KEY, Object.fromEntries(retained));
  } catch (error) {
    console.warn('[EduPulse] Detailed test review could not be saved:', error);
  }
}

function recordTestQuestionStats(items) {
  const stats = StorageModule.get(STORAGE_KEYS.qstats, {}) || {};
  const lastSeen = Date.now();
  items.forEach(item => {
    if (item.selected === null) return;
    const question = item.question;
    const key = question.qKey || `${quizState.chapter}:${item.number - 1}`;
    const stat = stats[key] || { seen: 0, correct: 0, wrong: 0, streak: 0, lastSeen: 0 };
    stat.seen = (Number(stat.seen) || 0) + 1;
    stat.lastSeen = lastSeen;
    stat.sj = stat.sj || question.subject;
    stat.ch = stat.ch || question.sourceChapter || quizState.chapter;
    if (item.selected === question.correct) {
      stat.correct = (Number(stat.correct) || 0) + 1;
      stat.streak = (Number(stat.streak) || 0) + 1;
    } else {
      stat.wrong = (Number(stat.wrong) || 0) + 1;
      stat.streak = 0;
    }
    stats[key] = stat;
  });
  StorageModule.set(STORAGE_KEYS.qstats, stats);
}

function testSubjectBreakdown(items) {
  const groups = {};
  items.forEach(item => {
    const name = item.question.subject || 'Other';
    const group = groups[name] || (groups[name] = { subject: name, total: 0, correct: 0, wrong: 0, skipped: 0 });
    group.total++;
    if (item.selected === null) group.skipped++;
    else if (item.selected === item.question.correct) group.correct++;
    else group.wrong++;
  });
  return Object.values(groups).map(group => ({ ...group, accuracy: group.correct + group.wrong ? Math.round(group.correct / (group.correct + group.wrong) * 100) : 0 }));
}

function openTestAnalysis(attemptId) {
  const attempt = completedTestAttempts().find(item => item.id === attemptId);
  if (!attempt) return showToast('This test attempt could not be found.', 'warning');
  const reviews = StorageModule.get(TEST_REVIEW_KEY, {}) || {};
  const questions = Array.isArray(reviews[attemptId]?.questions) ? reviews[attemptId].questions : [];
  if (!questions.length) {
    setModal('Test analysis', attempt.chapter || 'Completed test', `<div class="space-y-3"><p class="text-sm font-bold">${Number(attempt.accuracy) || 0}% accuracy · ${Number(attempt.correct) || 0} correct · ${Number(attempt.wrong) || 0} incorrect.</p><p class="text-xs text-slate-500">This older attempt has a saved summary only. Detailed question review is available for the two most recent tests.</p></div>`, '<button type="button" onclick="closeModal()" class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white">Close</button>');
    return;
  }

  const subjectRows = testSubjectBreakdown(questions).map(group => `<article class="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div class="flex items-center justify-between gap-2"><b class="text-xs">${escapeHtml(group.subject)}</b><strong class="text-sm">${group.accuracy}%</strong></div><div class="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800"><i class="block h-full rounded-full bg-teal-500" style="width:${group.accuracy}%"></i></div><p class="mt-2 text-[11px] text-slate-500">${group.correct} correct · ${group.wrong} incorrect · ${group.skipped} skipped</p></article>`).join('');
  const topics = {};
  questions.forEach(item => {
    const key = item.question.topic || item.question.sourceChapter || 'General';
    const group = topics[key] || (topics[key] = { total: 0, correct: 0 });
    group.total++;
    if (item.selected === item.question.correct) group.correct++;
  });
  const heatmap = Object.entries(topics).map(([topic, group]) => {
    const accuracy = Math.round(group.correct / Math.max(1, group.total) * 100);
    const tone = accuracy >= 70 ? 'border-emerald-200 bg-emerald-500/5 dark:border-emerald-900' : accuracy >= 45 ? 'border-amber-200 bg-amber-500/5 dark:border-amber-900' : 'border-rose-200 bg-rose-500/5 dark:border-rose-900';
    return `<div class="rounded-xl border p-3 ${tone}"><div class="flex items-center justify-between gap-2"><span class="truncate text-[11px] font-bold">${escapeHtml(topic)}</span><b class="text-xs">${accuracy}%</b></div><small class="text-[11px] text-slate-500">${group.correct}/${group.total} correct</small></div>`;
  }).join('');
  const timed = questions.filter(item => item.seconds > 0).sort((a, b) => b.seconds - a.seconds);
  const averageSeconds = timed.length ? Math.round(timed.reduce((sum, item) => sum + item.seconds, 0) / timed.length) : 0;
  const slowest = timed.slice(0, 5).map(item => `<li class="flex items-center justify-between gap-3 text-[11px]"><span>Question ${item.number} · ${escapeHtml(item.question.topic || item.question.sourceChapter || 'General')}</span><b>${Math.floor(item.seconds / 60)}:${String(item.seconds % 60).padStart(2, '0')}</b></li>`).join('');
  const questionRows = questions.map(item => {
    const question = item.question;
    const status = item.selected === null ? 'Skipped' : item.selected === question.correct ? 'Correct' : 'Incorrect';
    const statusClass = status === 'Correct' ? 'text-emerald-700' : status === 'Incorrect' ? 'text-rose-700' : 'text-amber-700';
    const options = question.options.map((option, index) => `<li class="rounded-lg px-3 py-2 text-[11px] ${index === question.correct ? 'bg-emerald-500/10 font-bold text-emerald-800' : index === item.selected ? 'bg-rose-500/10 text-rose-800' : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}"><span class="mr-2 font-black">${String.fromCharCode(65 + index)}.</span>${escapeHtml(option)}</li>`).join('');
    const selected = item.selected === null ? 'Not answered' : `${String.fromCharCode(65 + item.selected)}. ${escapeHtml(question.options[item.selected] || '')}`;
    const correct = `${String.fromCharCode(65 + question.correct)}. ${escapeHtml(question.options[question.correct] || '')}`;
    return `<details class="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><summary class="cursor-pointer text-[11px] font-bold"><span class="${statusClass}">${status}</span> · Q${item.number}${item.marked ? ' · Flagged' : ''} · ${escapeHtml(question.question.slice(0, 100))}${question.question.length > 100 ? '…' : ''}</summary><div class="mt-3 space-y-3"><p class="text-sm font-semibold leading-relaxed">${formatQuizText(question.question)}</p><ul class="grid gap-2">${options}</ul><div class="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2"><p><b>Your answer:</b> ${selected}</p><p><b>Correct answer:</b> ${correct}</p></div>${question.explanation ? `<p class="rounded-lg bg-teal-500/5 p-3 text-xs leading-relaxed">${formatQuizText(question.explanation)}</p>` : ''}<p class="text-[11px] text-slate-400">${item.seconds}s on this question · ${escapeHtml(question.difficulty || 'Difficulty not tagged')}</p></div></details>`;
  }).join('');
  const flagged = questions.some(item => item.marked);
  const missed = questions.some(item => item.selected !== item.question.correct);
  const totalSeconds = Number(attempt.timeSpentSeconds) || questions.reduce((sum, item) => sum + item.seconds, 0);
  const content = `<div class="max-h-[65vh] space-y-4 overflow-y-auto pr-1"><section class="grid grid-cols-1 gap-3 sm:grid-cols-3"><article class="rounded-xl bg-teal-500/10 p-3"><small class="text-[11px] font-black uppercase text-teal-700">Accuracy</small><b class="mt-1 block text-xl">${Number(attempt.accuracy) || 0}%</b></article><article class="rounded-xl bg-slate-100 p-3 dark:bg-slate-800"><small class="text-[11px] font-black uppercase text-slate-500">Total time</small><b class="mt-1 block text-xl">${Math.floor(totalSeconds / 60)}m</b></article><article class="rounded-xl bg-amber-500/10 p-3"><small class="text-[11px] font-black uppercase text-amber-700">Average / question</small><b class="mt-1 block text-xl">${averageSeconds}s</b></article></section><section class="space-y-2"><h3 class="text-xs font-black uppercase tracking-wide">Subject analysis</h3><div class="grid grid-cols-1 gap-2 sm:grid-cols-3">${subjectRows}</div></section><section class="space-y-2"><h3 class="text-xs font-black uppercase tracking-wide">Accuracy heatmap</h3><div class="grid grid-cols-1 gap-2 sm:grid-cols-2">${heatmap}</div></section><section class="space-y-2"><h3 class="text-xs font-black uppercase tracking-wide">Time analysis</h3>${slowest ? `<p class="text-[11px] text-slate-500">Longest question times</p><ol class="space-y-2">${slowest}</ol>` : '<p class="text-[11px] text-slate-500">Question timing was not recorded for this attempt.</p>'}</section><section class="space-y-2"><h3 class="text-xs font-black uppercase tracking-wide">Question-level review <span class="text-slate-400">(${questions.length})</span></h3>${questionRows}</section></div>`;
  const footer = `<div class="flex flex-wrap justify-end gap-2"><button type="button" onclick="practiceFromTest('${jsArg(attemptId)}','missed')" ${missed ? '' : 'disabled'} class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-40 dark:border-slate-700">Revise missed</button><button type="button" onclick="practiceFromTest('${jsArg(attemptId)}','marked')" ${flagged ? '' : 'disabled'} class="rounded-xl bg-teal-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Revise flagged</button><button type="button" onclick="closeModal()" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold dark:bg-slate-800">Close</button></div>`;
  setModal('Test analysis', attempt.chapter || 'Completed test', content, footer);
}

function practiceFromTest(attemptId, filter) {
  const reviews = StorageModule.get(TEST_REVIEW_KEY, {}) || {};
  const items = Array.isArray(reviews[attemptId]?.questions) ? reviews[attemptId].questions : [];
  const selected = items.filter(item => filter === 'marked' ? item.marked : item.selected !== item.question.correct);
  if (!selected.length) return showToast(filter === 'marked' ? 'No questions were flagged in this test.' : 'No missed questions to revise.', 'info');
  const attempt = completedTestAttempts().find(item => item.id === attemptId);
  const questions = selected.map(item => ({ ...item.question, options: [...item.question.options] }));
  closeModal();
  launchPracticeSession(attempt?.subject || 'Mixed', `${attempt?.chapter || 'Test'} · ${filter === 'marked' ? 'Flagged' : 'Missed'}`, questions, null);
}

function submitTestQuiz(isAuto = false) {
if (quizState.timerInterval) { clearInterval(quizState.timerInterval); quizState.timerInterval = null; }
recordCurrentTestQuestionTime();
const settings = StorageModule.get(STORAGE_KEYS.settings, defaultSettings);
const total = quizState.questions.length;
let correct = 0, wrong = 0, skipped = 0;

quizState.questions.forEach((q, i) => {
const ans = quizState.userAnswers[i];
if (ans === undefined) skipped++;
else if (ans === q.correct) correct++;
else wrong++;
});

const attempted = correct + wrong;
const score = (correct * settings.marksCorrect) + (wrong * settings.marksWrong);
const maxScore = total * settings.marksCorrect;
const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
const reviewItems = buildTestReviewItems();
const timeSpentSeconds = reviewItems.reduce((sum, item) => sum + item.seconds, 0);

const attemptRecord = {
id: 'att_' + Date.now(),
chapter: quizState.chapter || 'Full NTA Test',
subject: quizState.subject,
mode: quizState.mode === 'practice' ? 'practice' : 'test',
finishedAt: Date.now(),
total, attempted, correct, wrong, skipped,
score, maxScore, accuracy, timeSpentSeconds,
subjectBreakdown: testSubjectBreakdown(reviewItems)
};

const attempts = StorageModule.get(STORAGE_KEYS.attempts, []);
attempts.unshift(attemptRecord);
StorageModule.set(STORAGE_KEYS.attempts, attempts);
if (attemptRecord.mode === 'test') {
  recordTestQuestionStats(reviewItems);
  saveTestReviewDetails(attemptRecord.id, reviewItems);
}
StorageModule.recordActivity(attempted);
showResultScreen(attemptRecord);
}

function retryMistakesFromResult() {
  const missed = quizState.questions.filter((q, i) => quizState.userAnswers[i] !== undefined && quizState.userAnswers[i] !== q.correct);
  if (!missed.length) { showToast('No mistakes to retry.', 'info'); return; }
  closeModal();
  launchPracticeSession(quizState.subject, quizState.title || quizState.chapter, missed.map(q => ({ ...q })), null);
}

function practiseAgainFromResult() {
  const questions = quizState.questions.map(q => ({ ...q, options: [...q.options] }));
  closeModal();
  launchPracticeSession(quizState.subject, quizState.title || quizState.chapter, questions, null);
}

function openErrorNotebook() {
  const entries = Object.values(StorageModule.get(STORAGE_KEYS.errorNotebook, {}));
  const content = entries.length ? `<div class="space-y-3">${entries.map((entry, i) => `<article class="rounded-2xl border border-slate-200 dark:border-slate-700 p-4"><div class="flex items-center justify-between gap-3"><span class="text-[11px] font-black uppercase tracking-widest text-rose-600">Mistake ${i + 1}</span><span class="text-[11px] text-slate-400">${entry.attempts?.length || 1} miss${(entry.attempts?.length || 1) === 1 ? '' : 'es'}</span></div><p class="mt-2 text-sm font-bold text-slate-900 dark:text-slate-100">${formatQuizText(entry.q?.question || '')}</p><p class="mt-2 text-xs text-slate-500">Correct: ${escapeHtml(entry.q?.options?.[entry.q?.correct] || '—')}</p><p class="mt-1 text-xs font-bold text-rose-600">${escapeHtml(entry.attempts?.at(-1)?.reason || 'Review this concept')}</p></article>`).join('')}</div>` : `<div class="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500">Your notebook is empty. Missed questions will appear here after you tag them.</div>`;
  setModal('Error Notebook', 'A private revision queue for the questions you miss.', content, `<button onclick="closeModal(); renderView();" class="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs">Done</button>`);
}

function practiceErrorNotebook() {
  const questions = Object.values(StorageModule.get(STORAGE_KEYS.errorNotebook, {})).map(entry => entry.q).filter(Boolean);
  if (!questions.length) return showToast('Your error notebook is empty.', 'info');
  closeModal();
  launchPracticeSession(quizState.subject || 'Biology', 'Error Notebook', questions.map(q => ({ ...q, options: [...q.options] })), null);
}

function showResultScreen(attempt) {
toggleFullScreenMode(false);
const { total, attempted, correct, wrong, skipped, score, maxScore, accuracy } = attempt;

setModal('Quiz Performance Summary', attempt.chapter || 'Full Test Simulation', `<div class="space-y-6 py-2"> 
${(() => { const C = 2 * Math.PI * 44; const msg = accuracy >= 85 ? ['Outstanding!', '🏆'] : accuracy >= 70 ? ['Great work!', '🎯'] : accuracy >= 50 ? ['Good progress', '📈'] : ['Keep going — you’ve got this', '💪']; return `<div class="flex flex-col items-center gap-3 pt-1"><div class="relative h-32 w-32"><svg viewBox="0 0 100 100" class="h-32 w-32 -rotate-90" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="8" class="text-slate-200 dark:text-slate-700"/><circle cx="50" cy="50" r="44" fill="none" stroke="url(#resGrad)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(C * accuracy / 100).toFixed(1)} ${C.toFixed(1)}" class="result-ring"/><defs><linearGradient id="resGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14b8a6"/><stop offset="1" stop-color="#6366f1"/></linearGradient></defs></svg><div class="absolute inset-0 flex flex-col items-center justify-center"><span class="text-3xl font-black text-slate-900 dark:text-slate-100">${accuracy}%</span><span class="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">accuracy</span></div></div><p class="text-base font-black text-slate-900 dark:text-slate-100">${msg[1]} ${msg[0]}</p></div>`; })()}
<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800"> 
<div class="space-y-2"> 
<div class="flex items-baseline justify-between"><span class="text-xs text-slate-500 font-bold uppercase">Final Score</span><span class="text-3xl font-black text-teal-600">${score} / ${maxScore}</span></div> 
<div class="flex items-baseline justify-between"><span class="text-xs text-slate-500 font-bold uppercase">Accuracy Ratio</span><span class="text-lg font-black text-emerald-600">${accuracy}%</span></div> 
</div> 
</div> 

<div class="grid grid-cols-4 gap-3 text-center"> 
<div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20"><span class="block text-xl font-black text-emerald-600">${correct}</span><span class="text-[11px] font-bold text-slate-500 uppercase">Correct</span></div> 
<div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20"><span class="block text-xl font-black text-rose-600">${wrong}</span><span class="text-[11px] font-bold text-slate-500 uppercase">Wrong</span></div> 
<div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20"><span class="block text-xl font-black text-amber-600">${skipped}</span><span class="text-[11px] font-bold text-slate-500 uppercase">Skipped</span></div> 
<div class="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20"><span class="block text-xl font-black text-teal-600">${attempted}</span><span class="text-[11px] font-bold text-slate-500 uppercase">Total Attempted</span></div> 
</div> 

<div class="pt-2">
  <button onclick="generateAiTestPerformanceFeedback(${JSON.stringify(attempt).replace(/"/g, '&quot;')})" class="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs shadow-lg transition flex items-center justify-center gap-2">
    <i class="fa-solid fa-wand-magic-sparkles"></i> Get AI Diagnostic Performance Feedback & Plan
  </button>
</div>

${accuracy >= 80 ? `<div class="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-700 dark:text-emerald-300">Great work. You can mark this chapter complete and keep your momentum.</div>` : ''}
</div>`, `<div class="flex flex-wrap items-center justify-end gap-2"><button onclick="epReviewAnswers()" class="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200 font-bold text-xs">Review answers</button><button onclick="retryMistakesFromResult()" class="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300 font-bold text-xs">Retry mistakes</button><button onclick="practiseAgainFromResult()" class="px-4 py-2.5 rounded-xl border border-teal-200 text-teal-700 dark:border-teal-900 dark:text-teal-300 font-bold text-xs">Practise again</button><button onclick="closeModal(); renderView();" class="px-5 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold text-xs">Back to Dashboard</button></div>`
);
}

function switchTab(tab) {
if (tab === 'settings') { tab = 'profile'; if (window.epAcct) window.epAcct.open('study'); }
previousTab = currentTab;
currentTab = tab;
document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
document.querySelectorAll('.bn-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
const btn = document.getElementById(`nav-${tab}`);
if (btn) btn.classList.add('active');

const backBtn = document.getElementById('back-btn');
if (backBtn) {
if (tab !== 'dashboard') backBtn.classList.remove('hidden'), backBtn.classList.add('flex');
else backBtn.classList.add('hidden'), backBtn.classList.remove('flex');
}

toggleMobileNav(false);
const __main = document.getElementById('main-container');
if (__main) { __main.classList.add('route-enter'); setTimeout(() => __main.classList.remove('route-enter'), 800); window.scrollTo({ top: 0 }); }
renderView();
}

function goBack() { switchTab(previousTab); }

function toggleChapterProgress(subjName, chName) {
  if (!userProgress[chName]) userProgress[chName] = { completed: false, score: 0 };
  userProgress[chName].completed = !userProgress[chName].completed;
  saveToLocalStorage();
  renderView();
  showToast(userProgress[chName].completed ? `Marked "${chName}" as Completed!` : `Reset progress for "${chName}"`, 'info');
}

function toggleTodoItem(id) {
  const item = todos.find(t => t.id === id);
  if (item) {
    item.completed = !item.completed;
    saveToLocalStorage();
    renderView();
  }
}

function addTodoItem() {
  const titleInput = document.getElementById('new-todo-title');
  const subjSelect = document.getElementById('new-todo-subject');
  const prioritySelect = document.getElementById('new-todo-priority');
  const estimateInput = document.getElementById('new-todo-estimate');
  const dueInput = document.getElementById('new-todo-due');
  if (!titleInput || !titleInput.value.trim()) return showToast('Please enter a task title.', 'warning');

  const estimate = estimateInput?.value.trim() ? Number(estimateInput.value) : 30;
  todos.unshift({
    id: 'td_' + Date.now(),
    title: titleInput.value.trim(),
    subject: subjSelect ? subjSelect.value : 'Biology',
    priority: prioritySelect ? prioritySelect.value : 'medium',
    estimatedMinutes: Number.isInteger(estimate) ? Math.max(5, Math.min(240, Math.round(estimate / 5) * 5)) : 30,
    dueDate: dueInput?.value || '',
    completed: false,
    createdAt: Date.now()
  });
  saveToLocalStorage();
  renderView();
  showToast('Task added to Planner!');
}

function formatTodoDueDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'No due date';
  if (value === getLocalStudyDateKey()) return 'Due today';
  const date = new Date(value + 'T00:00:00');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return 'No due date';
  const label = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return value < getLocalStudyDateKey() ? `Overdue · ${label}` : `Due ${label}`;
}

function deleteTodoItem(id) {
  todos = todos.filter(t => t.id !== id);
  saveToLocalStorage();
  renderView();
}

function updateSettingsFromForm() {
  const marksCorrect = Number(document.getElementById('set-marks-correct')?.value);
  const marksWrong = Number(document.getElementById('set-marks-wrong')?.value);
  const dailyGoal = Number(document.getElementById('set-daily-goal')?.value);
  if (!Number.isInteger(marksCorrect) || marksCorrect < 1 || marksCorrect > 10) return showToast('Correct-answer marks must be a whole number from 1 to 10.', 'warning');
  if (!Number.isInteger(marksWrong) || marksWrong > 0 || marksWrong < -10) return showToast('Wrong-answer marks must be a whole number from −10 to 0.', 'warning');
  if (!Number.isInteger(dailyGoal) || dailyGoal < 1 || dailyGoal > 200) return showToast('Daily question goal must be a whole number from 1 to 200.', 'warning');
  const settings = StorageModule.get(STORAGE_KEYS.settings, defaultSettings);
  settings.marksCorrect = marksCorrect;
  settings.marksWrong = marksWrong;
  settings.dailyGoalQuestions = dailyGoal;
  StorageModule.set(STORAGE_KEYS.settings, settings);
  showToast('Settings saved successfully.');
}


// ===== Dashboard v2 =====
function getLocalStudyDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startDashboardFocusBlock() {
  if (window.epFocusPomodoro) return window.epFocusPomodoro(25, 5, 15);
  if (window.epOpenFocus) window.epOpenFocus();
}

function toggleStudyPlanTask(taskId) {
  const key = 'edupulse_study_plan_v1';
  const todayKey = getLocalStudyDateKey();
  let state = {};
  try { state = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) {}
  if (state.date !== todayKey) state = { date: todayKey, done: [] };
  const done = new Set(state.done || []);
  done.has(taskId) ? done.delete(taskId) : done.add(taskId);
  state.done = [...done];
  try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) { showToast('Could not save your plan on this device.', 'error'); }
  renderView();
}

function buildDashboardV2({ streak, done, pct, attemptsArr, totalSolved, avgAccuracy }) {
  const goal = getDailyGoal(), today = questionsSolvedToday();
  const gp = Math.min(100, Math.round((today / goal) * 100));
  const R = 44, C = 2 * Math.PI * R;
  const dayStreak = getDayStreak();
  const resume = getSavedResume();
  const hasResume = !!resume?.questions?.length;
  const rTotal = hasResume ? resume.questions.length : 0;
  const rAt = hasResume ? Math.min((resume.currentIndex || 0) + 1, rTotal) : 0;
  const nBook = getSavedQuestionKeys('bookmarked').length;
  const nWrong = getSavedQuestionKeys('incorrect').length;
  const nDue = getDueRevisionKeys().length;
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

  const primary = hasResume
    ? `<button type="button" onclick="resumeSavedSession()" class="dv2-btn dv2-btn-main"><i class="fa-solid fa-play"></i> Resume · Q${rAt}/${rTotal}</button>`
    : `<button type="button" onclick="switchTab('learn')" class="dv2-btn dv2-btn-main"><i class="fa-solid fa-bolt"></i> Start practice</button>`;

  const hero = `
  <section class="dv2-hero">
    <div class="dv2-hero-text">
      <p class="dv2-kicker">${escapeHtml(dateStr)}</p>
      <h2>${greet}, future doctor.</h2>
      <p class="dv2-sub">${today >= goal ? 'Daily goal smashed. Anything extra is a bonus.' : `${goal - today} question${goal - today === 1 ? '' : 's'} to hit today's goal.`}${hasResume ? ` Pick up <b>${escapeHtml(resume.title || resume.chapter || 'your session')}</b> where you left off.` : ''}</p>
      <div class="dv2-hero-actions">
        ${primary}
        <button type="button" onclick="openAdaptiveAiConfigModal()" class="dv2-btn dv2-btn-ghost"><i class="fa-solid fa-wand-magic-sparkles"></i> AI adaptive drill</button>
      </div>
    </div>
    <button type="button" class="dv2-ring" onclick="cycleDailyGoal()" aria-label="Daily goal ${today} of ${goal}. Tap to change goal">
      <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${R}" class="dv2-ring-bg"/><circle cx="50" cy="50" r="${R}" class="dv2-ring-fg" stroke-dasharray="${(C * gp / 100).toFixed(1)} ${C.toFixed(1)}"/></svg>
      <span class="dv2-ring-label"><b>${today}</b><small>of ${goal} today</small></span>
    </button>
  </section>`;

  const stat = (icon, tone, label, val, hint) => `
    <div class="dv2-stat dv2-${tone}"><span class="dv2-stat-ic"><i class="fa-solid ${icon}"></i></span>
      <div><small>${label}</small><b>${val}</b><em>${hint}</em></div></div>`;
  const previousAccuracy = attemptsArr.length > 1 ? Math.round(attemptsArr.slice(0, -1).reduce((sum, a) => sum + (a.accuracy || 0), 0) / (attemptsArr.length - 1)) : avgAccuracy;
  const accuracyDelta = avgAccuracy - previousAccuracy;
  const stats = `
  <section class="dv2-stats" aria-label="Study insights">
    ${stat('fa-bullseye', 'green', 'Accuracy', avgAccuracy + '%', `${accuracyDelta >= 0 ? '+' : ''}${accuracyDelta} pts vs earlier sessions`)}
    ${stat('fa-circle-check', 'teal', 'Attempted', totalSolved, 'Across practice and tests')}
    ${stat('fa-fire', 'amber', 'Streak', dayStreak + ' days', `Personal best ${streak.best || 0} days`)}
    ${stat('fa-rotate', 'violet', 'Revision due', nDue, `${nWrong} questions missed`)}
  </section>`;

  const act = (onclick, icon, tone, label) => `<button type="button" onclick="${onclick}" class="dv2-act dv2-${tone}"><span><i class="fa-solid ${icon}"></i></span>${label}</button>`;
  const actions = `
  <section>
    <div class="dv2-h"><h3>Quick start</h3></div>
    <div class="dv2-acts no-scrollbar">
      ${act("switchTab('learn')", 'fa-bolt', 'green', 'Practice')}
      ${act("switchTab('mock'); setMockSubTab('batch');", 'fa-desktop', 'teal', 'Batch mocks')}
      ${act("switchTab('mock'); setMockSubTab('generate');", 'fa-wand-magic-sparkles', 'violet', '180Q mock')}
      ${act("switchTab('directory')", 'fa-book-bookmark', 'amber', 'Vault')}
      ${act("startDashboardFocusBlock()", 'fa-stopwatch', 'sky', '25-min focus')}
      ${act("window.epFlashOpen ? epFlashOpen('','') : switchTab('learn')", 'fa-clone', 'green', 'Flashcards')}
      ${act("toggleAiChatbotWindow()", 'fa-robot', 'rose', 'Ask AI')}
    </div>
  </section>`;

  const tile = (kind, icon, tone, label, n) => `
    <button type="button" ${n ? `onclick="startSavedPractice('${kind}')"` : 'disabled'} class="dv2-saved dv2-${tone}">
      <span class="dv2-saved-ic"><i class="fa-solid ${icon}"></i></span>
      <span class="dv2-saved-t">${label}</span><b>${n}</b>
    </button>`;
  const savedLegacy = `
  <section class="dv2-card">
    <div class="dv2-h"><h3>Your question sets</h3><span>Tap to practise</span></div>
    <div class="dv2-saved-grid">
      ${tile('incorrect', 'fa-circle-xmark', 'rose', 'Incorrect', nWrong)}
      ${tile('bookmarked', 'fa-bookmark', 'amber', 'Bookmarked', nBook)}
      ${tile('due', 'fa-brain', 'violet', 'Revision due', nDue)}
    </div>
  </section>`;

  const saved = (window.EP && EP.flag && EP.flag('ui') && EP.dash) ? EP.dash.saved({ nWrong, nBook, nDue }) : savedLegacy;
  const days = getActivityDays(7);
  const max = Math.max(goal, ...days.map(d => d.count), 1);
  const week = days.reduce((n, d) => n + d.count, 0);
  const bars = days.map(d => `
    <div class="dv2-bar${d.today ? ' on' : ''}" title="${d.count} solved">
      <span>${d.count || ''}</span>
      <div><i style="height:${d.count ? Math.max(8, Math.round(d.count / max * 100)) : 0}%"></i></div>
      <em>${d.label}</em>
    </div>`).join('');
  const activity = `
  <section class="dv2-card">
    <div class="dv2-h"><h3>This week</h3><span>${week} solved</span></div>
    <div class="dv2-bars">${bars}</div>
  </section>`;

  const weak = getWeakChapters(3);
  const weakHtml = weak.length ? weak.map(w => `
    <button type="button" onclick="openPracticeSetup('${jsArg(w.subject)}','${jsArg(w.chapter)}')" class="dv2-weak">
      <span class="dv2-weak-pct">${w.avg}%</span>
      <span class="dv2-weak-t"><b>${escapeHtml(w.chapter)}</b><small>${escapeHtml(w.subject)} · ${w.acc.length} attempt${w.acc.length === 1 ? '' : 's'}</small></span>
      <i class="fa-solid fa-chevron-right"></i>
    </button>`).join('') : `<p class="dv2-empty">Finish a few sessions and your weakest chapters will appear here.</p>`;
  const weakCardLegacy = `
  <section class="dv2-card">
    <div class="dv2-h"><h3>Needs work</h3><span>Lowest accuracy first</span></div>
    <div class="dv2-weak-list">${weakHtml}</div>
  </section>`;

  const weakCard = (window.EP && EP.flag && EP.flag('mastery') && EP.flag('ui') && EP.dash) ? EP.dash.weak() : weakCardLegacy;
  const subjMeta = { Biology: ['bio', 'fa-dna'], Chemistry: ['chem', 'fa-flask'], Physics: ['phy', 'fa-atom'] };
  const subjects = `
  <section>
    <div class="dv2-h"><h3>NCERT subjects</h3><button type="button" onclick="switchTab('learn')">All chapters →</button></div>
    <div class="dv2-subjects">
      ${Object.keys(data).map(s => {
        const total = data[s].length;
        const sd = data[s].filter(c => userProgress[c]?.completed).length;
        const sp = total ? Math.round(sd / total * 100) : 0;
        const [cls, ic] = subjMeta[s] || ['phy', 'fa-book'];
        return `
        <button type="button" onclick="setSubject('${s}'); switchTab('learn');" class="dv2-subj dv2-s-${cls}">
          <span class="dv2-subj-ic"><i class="fa-solid ${ic}"></i></span>
          <span class="dv2-subj-t"><b>${s}</b><small>${sd}/${total} chapters done</small></span>
          <span class="dv2-subj-p">${sp}%</span>
          <span class="dv2-subj-bar"><i style="width:${sp}%"></i></span>
        </button>`;
      }).join('')}
    </div>
  </section>`;

  const subjectCards = ['Biology', 'Chemistry', 'Physics'].map((name) => {
    const rows = attemptsArr.filter(a => a.subject === name);
    const accuracy = rows.length ? Math.round(rows.reduce((sum, a) => sum + (a.accuracy || 0), 0) / rows.length) : 0;
    const attempts = rows.reduce((sum, a) => sum + (a.attempted || 0), 0);
    const tone = name === 'Biology' ? 'bio' : name === 'Chemistry' ? 'chem' : 'phy';
    const icon = name === 'Biology' ? 'fa-dna' : name === 'Chemistry' ? 'fa-flask' : 'fa-atom';
    const chapter = getWeakChapters(10).find(item => item.subject === name);
    return `<article class="study-subject ${tone}"><div class="study-subject-head"><span class="study-subject-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span><span><b>${name}</b><small>${attempts} questions attempted</small></span></div><div class="study-subject-score"><strong>${accuracy}%</strong><span>accuracy</span></div><div class="study-meter" role="progressbar" aria-label="${name} accuracy" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${accuracy}"><i style="width:${accuracy}%"></i></div>${chapter ? `<button type="button" class="study-subject-tip" onclick="openPracticeSetup('${jsArg(chapter.subject)}','${jsArg(chapter.chapter)}')">Focus next: ${escapeHtml(chapter.chapter)} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>` : `<p class="study-subject-tip">Complete a practice set to unlock a chapter focus.</p>`}</article>`;
  }).join('');
  const todayKey = getLocalStudyDateKey();
  const planKey = 'edupulse_study_plan_v1';
  let planState = {};
  try { planState = JSON.parse(localStorage.getItem(planKey) || '{}'); } catch (e) {}
  if (planState.date !== todayKey) planState = { date: todayKey, done: [] };
  const planCandidates = [
    { id: 'goal', title: `Complete ${Math.max(0, goal - today)} questions`, detail: `${today} of ${goal} completed`, time: 'Today', icon: 'fa-bullseye' },
    ...(nDue ? [{ id: 'revision', title: `Review ${Math.min(nDue, 10)} questions due`, detail: 'Spaced repetition · from your saved answers', time: 'Before 6:00 PM', icon: 'fa-rotate' }] : [{ id: 'weak', title: weak.length ? `Revisit ${weak[0].chapter}` : 'Choose a chapter to practise', detail: weak.length ? `${weak[0].subject} · ${weak[0].avg}% accuracy` : 'Build your first study signal', time: 'Next study block', icon: 'fa-book-open' }]),
    { id: 'mistakes', title: 'Learn from recent mistakes', detail: `${nWrong} questions in your incorrect set`, time: '10 min', icon: 'fa-lightbulb' }
  ];
  const plan = planCandidates.map(item => {
    const checked = planState.done.includes(item.id);
    const action = item.id === 'goal' ? "switchTab('learn')" : item.id === 'revision' ? "startSavedPractice('due')" : item.id === 'mistakes' ? "startSavedPractice('incorrect')" : `openPracticeSetup('${jsArg(weak[0]?.subject || 'Biology')}','${jsArg(weak[0]?.chapter || (data.Biology || [])[0] || '')}')`;
    return `<div class="study-plan-row${checked ? ' is-done' : ''}"><button type="button" class="study-check" aria-label="Mark ${escapeHtml(item.title)} ${checked ? 'incomplete' : 'complete'}" aria-pressed="${checked}" onclick="toggleStudyPlanTask('${item.id}')"><i class="fa-solid ${checked ? 'fa-check' : item.icon}" aria-hidden="true"></i></button><button type="button" class="study-plan-task" onclick="${action}"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.detail)}</small></button><span class="study-plan-time">${escapeHtml(item.time)}</span></div>`;
  }).join('');
  const recommendation = weak[0];
  const recommendations = recommendation ? `<section class="study-recommendation"><div class="study-rec-icon"><i class="fa-solid fa-sparkles" aria-hidden="true"></i></div><div><span class="study-rec-label">PERSONALIZED NEXT STEP</span><h3>Rebuild confidence in ${escapeHtml(recommendation.chapter)}</h3><p>${escapeHtml(recommendation.subject)} · ${recommendation.avg}% accuracy across ${recommendation.acc.length} practice sessions. Start with missed questions, then retry the chapter.</p><button type="button" onclick="openPracticeSetup('${jsArg(recommendation.subject)}','${jsArg(recommendation.chapter)}','incorrect')">Practise this chapter <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button></div></section>` : `<section class="study-recommendation"><div class="study-rec-icon"><i class="fa-solid fa-compass" aria-hidden="true"></i></div><div><span class="study-rec-label">YOUR NEXT STEP</span><h3>Start a focused practice session</h3><p>Recommendations become personal after you answer questions. Your incorrect answers and chapter accuracy guide what appears here.</p><button type="button" onclick="switchTab('learn')">Explore chapters <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button></div></section>`;

  return `
  <div class="dv2 dx animate-fadeIn">
    ${hero}
    ${stats}
    ${recommendations}
    <div class="study-section-head"><div><span class="study-overline">YOUR PREPARATION</span><h3>Subject performance</h3></div><span>Based on practice history</span></div>
    <section class="study-subject-grid" aria-label="Subject performance">${subjectCards}</section>
    <div class="study-section-head study-plan-heading"><div><span class="study-overline">A LITTLE EVERY DAY</span><h3>Today&apos;s study plan</h3></div><span>${planState.done.length}/${planCandidates.length} complete</span></div>
    <div class="study-plan-progress" role="progressbar" aria-label="Daily study plan progress" aria-valuemin="0" aria-valuemax="${planCandidates.length}" aria-valuenow="${planState.done.length}"><i style="width:${Math.round(planState.done.length / planCandidates.length * 100)}%"></i></div>
    <section class="study-plan-card" aria-label="Today's study plan">${plan}</section>
    ${actions}
    ${window.epCampusDashHtml ? window.epCampusDashHtml() : ''}
    <div class="dv2-grid">
      <div class="dv2-col">${saved}${activity}</div>
      <div class="dv2-col">${weakCard}</div>
    </div>
    ${subjects}
  </div>`;
}

// ===== Practice home =====
function pcChapterModel(subj) {
  const attempts = StorageModule.get(STORAGE_KEYS.attempts, []);
  const meta = readChapterMeta();
  const byCh = {};
  attempts.forEach(a => {
    if (!a || !a.chapter) return;
    const e = byCh[a.chapter] || (byCh[a.chapter] = { accs: [], hist: 0 });
    e.accs.push(a.accuracy || 0);
    if (!a.subject || a.subject === subj) e.hist++;
  });
  return (data[subj] || []).map((ch, i) => {
    const session = meta[chapterKey(subj, ch)] || null;
    const e = byCh[ch] || { accs: [], hist: 0 };
    const acc = e.accs.length ? Math.round(e.accs.reduce((s, v) => s + v, 0) / e.accs.length) : null;
    const answered = session ? (session.answered || 0) : 0;
    const total = session ? (session.total || 0) : 0;
    return {
      ch, num: i + 1, acc, answered, total,
      done: !!userProgress[ch]?.completed,
      bank: qBank(subj, ch),
      inProgress: !!session && answered > 0 && answered < total,
      finished: !!session && total > 0 && answered >= total,
      hasHistory: !!session || e.hist > 0,
      todo: !session && !e.accs.length,
      weak: acc !== null && acc < 60
    };
  });
}

function clearChapterFilters() { __q.chapterSearch = ''; chapterFilter = 'all'; renderView(); }

function openChapterLecture(subj, ch) {
  // One-shot button: opens ONLY the one-shot lecture search on YouTube (no modal, no extra options)
  const query = `${ch} ${subj} NEET One Shot full chapter lecture`;
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  document.body.appendChild(a); a.click(); a.remove();
}

// Header button: search the CURRENT question's text on YouTube
function epPlainQuestionText(v) {
  return String(v ?? '')
    .replace(/\$\$?([^$]+?)\$\$?/g, (m, t) => t
      .replace(/\\text\{([^}]*)\}/g, '$1')
      .replace(/\\(?:d|t)?frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2')
      .replace(/\\(?:hat|vec|bar|mathrm|mathbf)\{([^{}]*)\}/g, '$1')
      .replace(/\\rightleftharpoons/g, '<=>').replace(/\\rightarrow/g, '->')
      .replace(/\\times/g, 'x').replace(/\\(?:cdot|,|;| \s*)/g, ' ')
      .replace(/\\([a-zA-Z]+)/g, '$1').replace(/[{}]/g, '').replace(/\^/g, '^'))
    .replace(/\s+/g, ' ').trim();
}
function searchQuestionOnYouTube() {
  const q = quizState.questions && quizState.questions[quizState.currentIndex];
  if (!q) return;
  let text = epPlainQuestionText(q.question);
  if (text.length > 200) text = text.slice(0, 200).replace(/\s+\S*$/, ''); // YouTube search works best with a shorter query
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(text)}`;
  // window.open() returns null when 'noopener' is set, so the old fallback also navigated this tab away from the quiz.
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  document.body.appendChild(a); a.click(); a.remove();
}

function buildPracticeHome() {
  const subjMeta = { Biology: ['bio', 'fa-dna'], Chemistry: ['chem', 'fa-flask'], Physics: ['phy', 'fa-atom'] };
  const [subjCls] = subjMeta[subject] || ['phy'];
  const sArg = jsArg(subject);

  // ---- Next step: one primary action that adapts to where the student is ----
  const resume = getSavedResume();
  const hasResume = !!resume?.questions?.length;
  const weakest = getStudySignals().weakest;
  const aiBtn = `<button type="button" onclick="openAdaptiveAiConfigModal('${sArg}')" class="dv2-btn dv2-btn-ghost"><i class="fa-solid fa-wand-magic-sparkles"></i> AI adaptive drill</button>`;
  let heading, sub, bar = '', actions, discard = '';
  if (hasResume) {
    const total = resume.questions.length;
    const at = Math.min((resume.currentIndex || 0) + 1, total);
    const answered = Math.min(Object.keys(resume.userAnswers || {}).length, total);
    heading = 'Pick up where you left off';
    sub = `${escapeHtml(resume.title || resume.chapter || 'Practice session')}, question ${at.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')}.`;
    bar = `<div class="pc-next-bar" role="progressbar" aria-label="Session progress" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${answered}"><i style="width:${Math.round(answered / total * 100)}%"></i></div>`;
    actions = `<button type="button" onclick="resumeSavedSession()" class="dv2-btn dv2-btn-main"><i class="fa-solid fa-play"></i> Resume</button>
      <button type="button" onclick="startQuickTen()" class="dv2-btn dv2-btn-ghost"><i class="fa-solid fa-bolt"></i> Quick 10</button>${aiBtn}`;
    discard = `<button type="button" class="pc-next-x" aria-label="Discard saved session" title="Discard saved session" onclick="epConfirm('Discard this saved session? Your progress in it will be lost.','Discard').then(function(ok){if(ok){StorageModule.remove(STORAGE_KEYS.session);renderView();}})"><i class="fa-solid fa-xmark"></i></button>`;
  } else {
    if (weakest) {
      heading = `Strengthen ${escapeHtml(weakest.chapter)}`;
      sub = `${weakest.accuracy}% average accuracy. A focused 10-question drill is ready.`;
    } else {
      heading = 'Start with a Quick 10';
      sub = 'Ten mixed questions to find your starting point.';
    }
    actions = `<button type="button" onclick="startQuickTen()" class="dv2-btn dv2-btn-main"><i class="fa-solid fa-bolt"></i> Start Quick 10</button>${aiBtn}`;
  }
  const next = `
  <section class="pc-next${hasResume ? ' has-resume' : ''}" aria-label="Next step">
    <div class="pc-next-text"><span class="pc-kicker">${hasResume ? 'Continue' : 'Suggested for you'}</span><h2>${heading}</h2><p>${sub}</p>${bar}</div>
    <div class="pc-next-actions">${actions}</div>
    ${discard}
  </section>`;

  const savedSets = {
    incorrect: getSavedQuestionKeys('incorrect').length,
    bookmarked: getSavedQuestionKeys('bookmarked').length,
    due: getDueRevisionKeys().length
  };
  const smart = [['fa-circle-xmark', 'Missed', savedSets.incorrect, "startSavedPractice('incorrect')", 'rose'], ['fa-bookmark', 'Bookmarked', savedSets.bookmarked, "startSavedPractice('bookmarked')", 'amber'], ['fa-rotate', 'Revision due', savedSets.due, "startSavedPractice('due')", 'violet']].filter(x => x[2] > 0);
  const presets = smart.length ? `<section class="pc-smart" aria-label="Focused practice sets"><span class="pc-smart-l">Practise your</span>${smart.map(x => `<button type="button" class="pc-smart-c is-${x[4]}" onclick="${x[3]}"><i class="fa-solid ${x[0]}" aria-hidden="true"></i>${x[1]}<b>${x[2]}</b></button>`).join('')}</section>` : '';

  // ---- Error notebook: only when there is something to revisit ----
  const nCount = Object.values(StorageModule.get(STORAGE_KEYS.errorNotebook, {})).length;
  const notes = nCount ? `
  <section class="pc-notes" aria-label="Error notebook">
    <div class="pc-notes-t"><b>${nCount} concept${nCount === 1 ? '' : 's'} to revisit</b><span>Missed questions come back as spaced revision.</span></div>
    <div class="pc-notes-a">
      <button type="button" class="pc-btn pc-btn-soft" onclick="openErrorNotebook()">Review notebook</button>
      <button type="button" class="pc-btn pc-btn-rose" onclick="practiceErrorNotebook()">Practise mistakes</button>
    </div>
  </section>` : '';

  // ---- Quick-access rail: one scrollable row instead of three stacked panels ----
  const hasFlash = !!(window.epFlashStrip && window.epFlashStrip(subject));
  const railItems = [];
  if (savedSets.incorrect) railItems.push(['fa-circle-xmark', 'Missed', savedSets.incorrect, "startSavedPractice('incorrect')", 'rose']);
  if (savedSets.due) railItems.push(['fa-rotate', 'Revision due', savedSets.due, "startSavedPractice('due')", 'violet']);
  if (savedSets.bookmarked) railItems.push(['fa-bookmark', 'Bookmarked', savedSets.bookmarked, "startSavedPractice('bookmarked')", 'amber']);
  if (nCount) railItems.push(['fa-book-open', 'Mistake notebook', nCount, 'openErrorNotebook()', 'rose']);
  if (hasFlash) railItems.push(['fa-clone', 'Flashcards', '', `epFlashOpen('${sArg}')`, 'teal']);
  const rail = railItems.length ? `<nav class="pcx-rail" aria-label="Quick access">${railItems.map(x => `<button type="button" class="pcx-chip is-${x[4]}" onclick="${x[3]}"><i class="fa-solid ${x[0]}" aria-hidden="true"></i><span>${x[1]}</span>${x[2] !== '' ? `<b>${x[2]}</b>` : ''}</button>`).join('')}</nav>` : '';

  // ---- Subject tabs ----
  const tabs = Object.keys(data).map(s => {
    const total = data[s].length;
    const sd = data[s].filter(c => userProgress[c]?.completed).length;
    const pct = total ? Math.round(sd / total * 100) : 0;
    const [cls, ic] = subjMeta[s] || ['phy', 'fa-book'];
    return `<button type="button" role="tab" aria-selected="${s === subject}" onclick="setSubject('${jsArg(s)}')" class="pc-subj pc-s-${cls}">
      <span class="pc-subj-ic"><i class="fa-solid ${ic}" aria-hidden="true"></i></span>
      <span class="pc-subj-t"><b>${s}</b><small>${sd}/${total} done</small></span>
      <span class="pc-subj-bar"><i style="width:${pct}%"></i></span>
    </button>`;
  }).join('');

  // ---- Chapters: compute once, then filter / count from the same model ----
  const model = pcChapterModel(subject);
  const dueByCh = {};
  try {
    const qs = StorageModule.get(STORAGE_KEYS.qstats, {});
    getDueRevisionKeys().forEach(k => { const e = qs[k]; if (e && e.ch && (!e.sj || e.sj === subject)) dueByCh[e.ch] = (dueByCh[e.ch] || 0) + 1; });
  } catch (e) { /* due badges are optional */ }
  model.forEach(m => { m.due = dueByCh[m.ch] || 0; });
  const q = (__q.chapterSearch || '').trim().toLowerCase();
  const passesFilter = m => chapterFilter === 'all'
    || (chapterFilter === 'progress' && m.inProgress)
    || (chapterFilter === 'todo' && m.todo)
    || (chapterFilter === 'done' && m.done)
    || (chapterFilter === 'weak' && m.weak)
    || (chapterFilter === 'due' && m.due > 0);
  const shown = model.filter(m => (!q || m.ch.toLowerCase().includes(q)) && passesFilter(m));
  const counts = {
    all: model.length,
    progress: model.filter(m => m.inProgress).length,
    todo: model.filter(m => m.todo).length,
    weak: model.filter(m => m.weak).length,
    due: model.filter(m => m.due > 0).length,
    done: model.filter(m => m.done).length
  };
  const chips = [['all', 'All'], ['progress', 'In progress'], ['todo', 'Not started'], ['weak', 'Needs work'], ['due', 'Due revision'], ['done', 'Completed']]
    .filter(([k]) => k === 'all' || counts[k] > 0 || chapterFilter === k)
    .map(([k, l]) => `<button type="button" role="tab" aria-selected="${chapterFilter === k}" onclick="setChapterFilter('${k}')" class="chip-filter${chapterFilter === k ? ' on' : ''}">${l}<span class="pc-chip-n">${counts[k]}</span></button>`).join('');
  const countText = shown.length === model.length ? `${model.length} chapters · ${model.filter(m => m.bank === null || (m.bank || 0) > 0).length} ready to practise` : `Showing ${shown.length} of ${model.length} chapters`;

  const isReady = m => m.bank === null || (m.bank || 0) > 0;
  const cards = shown.filter(isReady).map(m => {
    // Always route a chapter click through its own setup flow. The question
    // index loads asynchronously; using m.bank here caused early clicks to
    // open a generic AI screen (or the wrong flow) before the index arrived.
    const open = `openPracticeSetup('${sArg}','${jsArg(m.ch)}')`;
    const checking = m.bank === null;
    const hasBank = (m.bank || 0) > 0;
    const verb = !hasBank ? 'Open practice options for' : m.inProgress ? 'Resume' : 'Practise';
    const cta = checking ? 'Checking question bank…' : !hasBank ? 'Generate with AI' : m.inProgress ? `Resume · ${m.answered}/${m.total}` : (m.finished || m.done) ? 'Practise again' : 'Start practice';
    const ctaIcon = checking ? 'fa-rotate fa-spin' : !hasBank ? 'fa-wand-magic-sparkles' : 'fa-play';
    const badge = m.done
      ? '<span class="pc-badge pc-badge-done"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Completed</span>'
      : m.inProgress ? '<span class="pc-badge pc-badge-prog">In progress</span>' : '';
    const dueBadge = m.due ? `<span class="pc-badge pc-badge-due"><i class="fa-solid fa-rotate" aria-hidden="true"></i> ${m.due} due</span>` : '';
    const accChip = m.acc !== null ? `<span class="pc-acc ${m.acc >= 75 ? 'good' : m.acc >= 60 ? 'mid' : 'weak'}">${m.acc}% accuracy</span>` : '';
    const progress = m.total && m.answered
      ? `<div class="pc-bar" title="${m.answered}/${m.total} answered"><i style="width:${Math.min(100, Math.round(m.answered / m.total * 100))}%"></i></div>` : '';
    const name = escapeHtml(m.ch);
    return `
    <article class="pc-card pcx-card${m.done ? ' is-done' : ''}${m.weak ? ' is-weak' : ''}${m.inProgress ? ' is-prog' : ''}${hasBank || checking ? '' : ' is-nobank'}" style="--p:${m.total ? Math.min(100, Math.round(m.answered / m.total * 100)) : (m.done ? 100 : 0)}" onpointerenter="preloadChapter('${sArg}','${jsArg(m.ch)}')" ontouchstart="preloadChapter('${sArg}','${jsArg(m.ch)}')">
      <div class="pcx-ring" aria-hidden="true"><span>${m.done ? '<i class="fa-solid fa-check"></i>' : m.num}</span></div>
      <div class="pcx-body">
        <h4 class="pc-title"><button type="button" class="pc-main" aria-label="${verb} ${name}" onclick="${open}">${name}</button></h4>
        <div class="pc-meta">${checking ? '<span>Checking…</span>' : hasBank ? `<span class="pc-q"><i class="fa-regular fa-circle-question" aria-hidden="true"></i>${m.bank.toLocaleString('en-IN')} Qs</span>` : '<span>No bank yet</span>'}${accChip}${dueBadge}${m.inProgress ? `<span class="pc-badge pc-badge-prog">${m.answered}/${m.total}</span>` : ''}</div>
        ${progress}
      </div>
      <div class="pcx-side">
        <button type="button" class="pcx-go${hasBank ? '' : ' ai'}${m.done || m.finished ? ' again' : ''}" aria-label="${verb} ${name}" title="${cta}" onclick="${open}"><i class="fa-solid ${ctaIcon}" aria-hidden="true"></i><em>${checking ? '…' : !hasBank ? 'AI' : m.inProgress ? 'Resume' : (m.finished || m.done) ? 'Again' : 'Start'}</em></button>
        <details class="pcx-more"><summary aria-label="More actions for ${name}"><i class="fa-solid fa-ellipsis" aria-hidden="true"></i></summary>
          <div class="pc-tools">
          <button type="button" class="pc-ibtn${m.done ? ' on' : ''}" aria-pressed="${m.done}" aria-label="Mark ${name} as ${m.done ? 'not completed' : 'completed'}" title="${m.done ? 'Completed. Tap to undo' : 'Mark as completed'}" onclick="toggleChapterProgress('${sArg}','${jsArg(m.ch)}')"><i class="fa-${m.done ? 'solid' : 'regular'} fa-circle-check"></i></button>
          <button type="button" class="pc-ibtn pc-yt" aria-label="Watch one-shot lecture for ${name}" title="One-shot lecture" onclick="openChapterLecture('${sArg}','${jsArg(m.ch)}')"><i class="fa-brands fa-youtube"></i></button>
          ${window.epFlashHas && window.epFlashHas(subject, m.ch) ? `<button type="button" class="pc-ibtn" aria-label="Flashcards for ${name}" title="Flashcards" onclick="epFlashOpen('${sArg}','${jsArg(m.ch)}')"><i class="fa-solid fa-clone"></i></button>` : ''}
          ${m.hasHistory ? `<button type="button" class="pc-ibtn pc-erase" aria-label="Erase history for ${name}" title="Erase chapter history" onclick="confirmEraseChapter('${sArg}','${jsArg(m.ch)}')"><i class="fa-solid fa-eraser"></i></button>` : ''}
        </div>
        </details>
      </div>
    </article>`;
  }).join('');

  const pend = shown.filter(m => !isReady(m));
  const laterOpen = (window.__pcLater !== undefined ? window.__pcLater : false) || !!q || !cards;
  const rowFn = m => { const nm = escapeHtml(m.ch); return `<div class="pc-row"><span class="pc-num">Ch ${m.num}</span><span class="pc-row-t">${nm}</span><button type="button" class="pc-row-ai" aria-label="Open ${nm} and generate questions with AI" onclick="openPracticeSetup('${sArg}','${jsArg(m.ch)}')"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>AI</button><button type="button" class="pc-ibtn pc-yt" aria-label="Watch one-shot lecture for ${nm}" title="One-shot lecture" onclick="openChapterLecture('${sArg}','${jsArg(m.ch)}')"><i class="fa-brands fa-youtube"></i></button></div>`; };
  const later = pend.length ? `<details class="pc-later pc-s-${subjCls}" ${laterOpen ? 'open' : ''} ontoggle="if(!document.getElementById('chapterSearch')?.value)window.__pcLater=this.open"><summary><span><b>Waiting for questions</b><small>${pend.length} chapter${pend.length === 1 ? '' : 's'} · lectures and AI practice are still available</small></span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary><div class="pc-later-b">${pend.map(rowFn).join('')}</div></details>` : '';
  const empty = `
    <div class="pc-empty">
      <b>${q ? `No ${escapeHtml(subject)} chapters match “${escapeHtml(__q.chapterSearch.trim())}”` : 'No chapters in this filter yet'}</b>
      <span>${q ? 'Check the spelling, or try a shorter search.' : 'Practise a few chapters and they will show up here.'}</span>
      <button type="button" class="pc-btn pc-btn-soft" onclick="clearChapterFilters()">Show all chapters</button>
    </div>`;

  return `
  <div class="pc pcx">
    ${next}
    ${rail}
    <div class="pc-subjects" role="tablist" aria-label="Subject">${tabs}</div>
    <div class="pc-toolbar">
      <div class="pc-search">
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <label for="chapterSearch" class="pc-sr">Search ${escapeHtml(subject)} chapters</label>
        <input type="search" id="chapterSearch" oninput="onSearchInput(this)" value="${escapeHtml(__q.chapterSearch || '')}" placeholder="Search ${escapeHtml(subject)} chapters" autocomplete="off" enterkeyhint="search">
      </div>
      <div class="pc-chips" role="tablist" aria-label="Filter chapters">${chips}</div>
      <p class="pc-count" role="status">${countText}</p>
    </div>
    ${shown.length ? `${cards ? `<div class="pc-grid pc-s-${subjCls}">${cards}</div>` : ''}${later}` : empty}
  </div>`;
}

function renderView() {
const main = document.getElementById('main-container');
if (!main) return;
updateGlobalProgress();

if (currentTab === 'dashboard') {
const streak = StorageModule.get(STORAGE_KEYS.streak, { current: 0, best: 0, dailyCounts: {} });
const done = Object.values(userProgress).filter(p => p && p.completed).length;
const pct = Math.round((done / TOTAL_CHAPTERS) * 100);
const attemptsArr = StorageModule.get(STORAGE_KEYS.attempts, []);
const _tot = StorageModule.attemptTotals();
const totalSolved = _tot.attempted;
const avgAccuracy = _tot.avgAccuracy;

main.innerHTML = buildDashboardV2({ streak, done, pct, attemptsArr, totalSolved, avgAccuracy });
} else if (currentTab === 'campus') {
main.innerHTML = window.campusMarkup ? window.campusMarkup() : '';
} else if (currentTab === 'profile') {
main.innerHTML = window.renderCommunityProfile();
} else if (currentTab === 'about') {
main.innerHTML = `
<div class="space-y-6 animate-fadeIn max-w-4xl mx-auto">
  <div class="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-900 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white shadow-2xl border border-teal-700/40 space-y-4">
    <span class="inline-flex px-3 py-1 rounded-full bg-teal-400/20 text-teal-200 border border-teal-400/30 font-black text-[11px] uppercase tracking-widest">NEET preparation workspace</span>
    <h2 class="text-2xl sm:text-4xl font-black text-white">About EduPulse</h2>
    <p class="text-slate-400 text-xs font-bold" id="ep-build">Build ${window.EP_BUILD || 'dev'}</p>
    <p class="text-slate-300 text-xs sm:text-sm font-medium leading-relaxed max-w-2xl">Study, practise, take CBT-style tests, and review your progress in one place. EduPulse combines chapter practice, selected NCERT reading extracts, revision tools, and links to external study resources.</p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
    <div class="card p-6 space-y-3 border-l-4 border-l-teal-500">
      <div class="flex items-center gap-2 text-teal-600 font-extrabold text-sm"><i class="fa-solid fa-book-open" aria-hidden="true"></i><span>Study tools</span></div>
      <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">Use chapter filters, saved questions, mistake review, test history, and the focus planner to shape your own study routine. Question-bank and reader coverage varies by chapter; check availability before starting.</p>
    </div>
    <div class="card p-6 space-y-3 border-l-4 border-l-indigo-500">
      <div class="flex items-center gap-2 text-indigo-600 font-extrabold text-sm"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i><span>Optional AI assistance</span></div>
      <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">AI explanations and generated practice use the Gemini model configured in your browser. Prompts and attached images are sent to Google Gemini; verify study answers against trusted course materials.</p>
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
    <section class="card p-6 space-y-3">
      <h3 class="text-base font-black text-slate-900 dark:text-slate-100">Your data</h3>
      <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">Without an account, progress stays in this browser. When you sign in, EduPulse can sync supported study data to your account. Use Settings to export a backup before changing devices or clearing browser data. Your Gemini API key is not included in backups.</p>
    </section>
    <section class="card p-6 space-y-3">
      <h3 class="text-base font-black text-slate-900 dark:text-slate-100">External resources</h3>
      <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">Resource Vault links lead to third-party sites. Some may require an account, use their own privacy policies, or block in-app viewing. EduPulse does not imply endorsement or guarantee that external schedules and content remain current.</p>
    </section>
  </div>

  <div class="text-center py-4 text-xs font-bold text-slate-400 space-y-1">
    <p>EduPulse — a study companion for NEET aspirants.</p>
    <p><a href="https://edupulse.cc.cd" target="_blank" rel="noopener noreferrer" class="font-black text-teal-600 hover:underline">Visit EduPulse</a></p>
  </div>
</div>`;
} else if (currentTab === 'mock') {
main.innerHTML = `
<div class="space-y-6 animate-fadeIn max-w-6xl mx-auto">
  <!-- Tests header -->
  <header class="tp-head">
    <div class="tp-title"><span class="tp-kicker">NTA pattern · CBT simulation</span><h2>Tests</h2></div>
    <div class="tp-tabs" role="tablist" aria-label="Test hub sections">
      <button type="button" role="tab" aria-selected="${mockSubTab === 'batch'}" onclick="setMockSubTab('batch')" class="tp-tab${mockSubTab === 'batch' ? ' on' : ''}"><i class="fa-solid fa-layer-group" aria-hidden="true"></i><span>Series</span><b>${batchTestsDatabase.length}</b></button>
      <button type="button" role="tab" aria-selected="${mockSubTab === 'scheduled'}" onclick="setMockSubTab('scheduled')" class="tp-tab${mockSubTab === 'scheduled' ? ' on' : ''}"><i class="fa-solid fa-calendar" aria-hidden="true"></i><span>Scheduled</span><b>${scheduledTestItems().length}</b></button>
      <button type="button" role="tab" aria-selected="${mockSubTab === 'generate'}" onclick="setMockSubTab('generate')" class="tp-tab${mockSubTab === 'generate' ? ' on' : ''}"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i><span>Custom</span></button>
      <button type="button" role="tab" aria-selected="${mockSubTab === 'completed'}" onclick="setMockSubTab('completed')" class="tp-tab${mockSubTab === 'completed' ? ' on' : ''}"><i class="fa-solid fa-chart-column" aria-hidden="true"></i><span>Completed</span><b>${completedTestAttempts().length}</b></button>
    </div>
  </header>

  ${mockSubTab !== 'generate' && !selectedBatchSeries ? customTestCtaHtml() : ''}

  ${mockSubTab === 'scheduled' ? buildScheduledTestsView() : mockSubTab === 'completed' ? buildCompletedTestsView() : mockSubTab === 'batch' ? `
    ${selectedBatchSeries ? `
      <section class="tp-detail">
        <button type="button" class="tp-back" onclick="closeBatchSeriesDetail()"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> All series</button>
        <div class="tp-series-hd">
          <span class="tp-tag">${escapeHtml(selectedBatchSeries.category)}</span>
          <h3>${escapeHtml(selectedBatchSeries.title)}</h3>
          <p>${escapeHtml(selectedBatchSeries.description)}</p>
          <small><i class="fa-solid fa-calendar-check" aria-hidden="true"></i> ${selectedBatchSeries.startDate} — ${selectedBatchSeries.endDate}</small>
        </div>
        ${selectedBatchSeries.category === 'Chapterwise' ? `
          <div class="tp-chips" role="tablist" aria-label="Subject">
            ${['Physics', 'Chemistry', 'Botany', 'Zoology'].map(sub => `<button type="button" role="tab" aria-selected="${selectedBatchSubject === sub}" onclick="selectedBatchSubject='${sub}'; renderView();" class="tp-chip${selectedBatchSubject === sub ? ' on' : ''}">${sub}</button>`).join('')}
          </div>` : ''}
        <div class="tp-papers">
          ${selectedBatchSeries.tests
            .filter(t => selectedBatchSeries.category !== 'Chapterwise' || t.subject === selectedBatchSubject || t.subject === 'All')
            .map(t => {
              const av = getTestAvailability(t);
              const status = av === 'scheduled' ? '<span class="tp-st is-lock"><i class="fa-solid fa-lock" aria-hidden="true"></i> Scheduled</span>' : av === 'past' ? '<span class="tp-st is-past">Past · practise anytime</span>' : '<span class="tp-st is-live"><i class="fa-solid fa-circle" aria-hidden="true"></i> Available</span>';
              const act = av !== 'scheduled'
                ? `<button type="button" class="tp-go" onclick="startBatchTestAttempt(${JSON.stringify(t).replace(/"/g, '&quot;')}, '${jsArg(selectedBatchSeries.title)}')">${av === 'past' ? 'Practise paper' : 'Attempt'} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>`
                : `<span class="tp-opens"><i class="fa-solid fa-lock" aria-hidden="true"></i> Opens ${escapeHtml(t.schedule || 'when announced')}</span>`;
              return `
            <article class="tp-paper${av === 'scheduled' ? ' is-lock' : ''}">
              <div class="tp-paper-top"><h4>${escapeHtml(t.title)}</h4>${status}</div>
              <p class="tp-focus">Focus: <b>${t.subject}</b></p>
              <dl class="tp-facts"><div><dt>Questions</dt><dd>${t.questions}</dd></div><div><dt>Marks</dt><dd>${t.marks}</dd></div><div><dt>Time</dt><dd>${t.timeMins}m</dd></div></dl>
              <div class="tp-paper-ft">
                <span class="tp-when"><i class="fa-regular fa-clock" aria-hidden="true"></i> ${t.schedule}</span>
                <div class="tp-acts"><button type="button" class="tp-ghost" onclick="openBatchSyllabusModal('${jsArg(t.title)}', ${JSON.stringify(t.syllabus || []).replace(/"/g, '&quot;')})">Syllabus</button>${act}</div>
              </div>
            </article>`; }).join('')}
        </div>
      </section>
    ` : `
      <section class="tp-dir">
        <div class="tp-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" id="batchSeriesSearch" oninput="onSearchInput(this)" value="${escapeHtml(__q.batchSeriesSearch || '')}" placeholder="Search test series" autocomplete="off" enterkeyhint="search" aria-label="Search test series"></div>
        <div class="tp-chips" role="tablist" aria-label="Series type">
          ${['All', 'Chapterwise', 'Part Syllabus', 'Full Syllabus'].map(cat => `<button type="button" role="tab" aria-selected="${batchCategoryFilter === cat}" onclick="batchCategoryFilter='${cat}'; renderView();" class="tp-chip${batchCategoryFilter === cat ? ' on' : ''}">${cat}</button>`).join('')}
        </div>
        <div class="tp-series">
          ${batchTestsDatabase
            .filter(s => {
              const q = (__q.batchSeriesSearch || '').toLowerCase();
              const matchQ = s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
              const matchCat = batchCategoryFilter === 'All' || s.category === batchCategoryFilter;
              return matchQ && matchCat;
            })
            .map(s => `
            <article class="tp-card">
              <button type="button" class="tp-card-main" onclick="openBatchSeriesDetail('${jsArg(s.id)}')" aria-label="Open ${escapeHtml(s.title)}">
                <span class="tp-banner" style="background:${s.bannerBg};"><span class="tp-tag on-dark">${escapeHtml(s.category)}</span><span class="tp-count">${s.totalTests} papers</span></span>
                <span class="tp-card-body"><b>${escapeHtml(s.title)}</b><small>${s.startDate} — ${s.endDate}</small><em>${escapeHtml(s.description)}</em></span>
              </button>
            </article>`).join('')}
          ${!batchTestsDatabase.length ? '<div class="card p-8 text-center" style="grid-column:1/-1"><h3 class="text-base font-black">No test series yet</h3><p class="mt-2 text-sm text-slate-500">Published test series will appear here. You can still build your own paper from the custom test builder.</p></div>' : ''}
        </div>
      </section>
    `}
  ` : `
    <!-- CUSTOM 180Q NTA GENERATOR INTERFACE -->
    <div class="cg animate-fadeIn">
      <section class="cg-hero">
        <div><span class="cg-kicker">Custom test builder</span><h3>Build your own paper</h3><p>Pick a pattern, subjects and chapters. We'll set the timer.</p></div>
        <span class="cg-hero-ic"><i class="fa-solid fa-sliders" aria-hidden="true"></i></span>
      </section>

      <nav class="cg-steps" aria-label="Builder steps">
        ${[['Format',1],['Subjects',2],['Chapters',3],['Launch',4]].map(([label, n]) => `
        <button type="button" onclick="${n === 1 ? 'wizardSetStep(1)' : `if(wizardState.step>=${n}) wizardSetStep(${n})`}" class="cg-step${wizardState.step === n ? ' on' : wizardState.step > n ? ' done' : ''}" ${wizardState.step === n ? 'aria-current="step"' : ''}>
          <span class="cg-dot">${wizardState.step > n ? '<i class="fa-solid fa-check" aria-hidden="true"></i>' : n}</span><small>${label}</small>
        </button>`).join('')}
      </nav>

      ${wizardState.step === 1 ? `
        <section class="cg-sec">
          <h4 class="cg-h">Choose a test pattern</h4>
          <div class="cg-formats">
            ${[
              ['full_180', 180, 'Full NEET Simulation', '90 Bio · 45 Chem · 45 Phy, exam timing.', 'fa-trophy', 'amber', 'Most realistic'],
              ['subject_major', 90, 'Subject Major Test', 'Intensive test on major syllabus blocks.', 'fa-layer-group', 'teal', ''],
              ['chapter_sprint', 45, 'Chapter Speed Drill', 'Rapid-fire questions for target chapters.', 'fa-bolt', 'violet', ''],
              ['ai_drill', 30, 'Gemini AI Special', 'Fresh statement and assertion questions.', 'fa-wand-magic-sparkles', 'rose', 'AI']
            ].map(([id, n, title, desc, icon, tone, tag]) => `
            <button type="button" onclick="wizardSelectFormat('${id}', ${n}, ${n})" class="cg-fmt cg-${tone}${wizardState.format === id ? ' on' : ''}" aria-pressed="${wizardState.format === id}">
              <span class="cg-fmt-ic"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>
              <span class="cg-fmt-t"><b>${title}</b><small>${desc}</small><em><i class="fa-regular fa-circle-question" aria-hidden="true"></i> ${n} questions · ${n} min${tag ? ` <u>${tag}</u>` : ''}</em></span>
              <span class="cg-tick"><i class="fa-solid fa-circle-check" aria-hidden="true"></i></span>
            </button>`).join('')}
          </div>
        </section>
      ` : ''}

      ${wizardState.step === 2 ? `
        <section class="cg-sec">
          <h4 class="cg-h">Which subjects?</h4>
          <div class="cg-subjects">
            ${['Biology', 'Chemistry', 'Physics'].map(s => {
              const isChecked = wizardState.selectedSubjects.includes(s);
              const ic = s === 'Biology' ? 'fa-dna' : s === 'Chemistry' ? 'fa-flask' : 'fa-atom';
              const tone = s === 'Biology' ? 'teal' : s === 'Chemistry' ? 'violet' : 'amber';
              return `
              <button type="button" onclick="wizardToggleSubject('${s}')" class="cg-subj cg-${tone}${isChecked ? ' on' : ''}" aria-pressed="${isChecked}">
                <span class="cg-fmt-ic"><i class="fa-solid ${ic}" aria-hidden="true"></i></span>
                <span class="cg-fmt-t"><b>${s}</b><small>${data[s].length} NCERT chapters</small></span>
                <span class="cg-tick"><i class="fa-solid fa-circle-check" aria-hidden="true"></i></span>
              </button>`;
            }).join('')}
          </div>
          <div class="cg-bar"><span>${wizardState.selectedSubjects.length} of 3 selected</span><button type="button" class="cg-next" onclick="wizardSetStep(3)">Next: Chapters <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button></div>
        </section>
      ` : ''}

      ${wizardState.step === 3 ? `
        <section class="cg-sec">
          <h4 class="cg-h">Pick chapters</h4>
          ${wizardState.selectedSubjects.map(sub => {
            const sel = (wizardState.selectedChapters[sub] || []).length;
            return `
          <div class="cg-chcard">
            <div class="cg-chhead">
              <div><b>${sub}</b><small>${sel} of ${data[sub].length} chapters</small></div>
              <div class="cg-chact"><button type="button" onclick="wizardSelectAllChapters('${sub}')">Select all</button><button type="button" class="clr" onclick="wizardClearChapters('${sub}')">Clear</button></div>
            </div>
            <div class="cg-chips">
              ${data[sub].map(ch => {
                const isSel = (wizardState.selectedChapters[sub] || []).includes(ch);
                return `<button type="button" onclick="wizardToggleChapter('${sub}', '${jsArg(ch)}')" class="cg-ch${isSel ? ' on' : ''}" aria-pressed="${isSel}"><i class="fa-solid ${isSel ? 'fa-circle-check' : 'fa-circle'}" aria-hidden="true"></i><span>${escapeHtml(ch)}</span></button>`;
              }).join('')}
            </div>
          </div>`;
          }).join('')}
          <div class="cg-bar"><button type="button" class="cg-back" onclick="wizardSetStep(2)">Back</button><button type="button" class="cg-next" onclick="wizardSetStep(4)">Next: Review <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button></div>
        </section>
      ` : ''}

      ${wizardState.step === 4 ? `
        <section class="cg-sec">
          <h4 class="cg-h">Review and launch</h4>
          <div class="cg-sum">
            <div><i class="fa-solid fa-list-check" aria-hidden="true"></i><b>${wizardState.qCount}</b><small>${wizardState.qCount === 1 ? 'Question' : 'Questions'}</small></div>
            <div><i class="fa-regular fa-clock" aria-hidden="true"></i><b>${wizardState.durationMins}</b><small>${wizardState.durationMins === 1 ? 'Minute' : 'Minutes'}</small></div>
            <div><i class="fa-solid fa-book-open" aria-hidden="true"></i><b>${wizardState.selectedSubjects.length}</b><small>${wizardState.selectedSubjects.join(' · ')}</small></div>
          </div>
          <div class="cg-form">
            <label>Question count <input type="number" min="1" max="180" step="1" value="${wizardState.qCount}" onchange="wizardSetQuestionCount(this.value)"></label>
            <label>Difficulty <select onchange="wizardSetDifficulty(this.value)"><option value="mixed" ${wizardState.difficulty === 'mixed' ? 'selected' : ''}>Mixed</option><option value="easy" ${wizardState.difficulty === 'easy' ? 'selected' : ''}>Easy</option><option value="moderate" ${wizardState.difficulty === 'moderate' ? 'selected' : ''}>Moderate</option><option value="difficult" ${wizardState.difficulty === 'difficult' ? 'selected' : ''}>Difficult</option></select></label>
            <label>Question source <select onchange="wizardSetSource(this.value)"><option ${wizardState.source === 'All' ? 'selected' : ''}>All</option><option ${wizardState.source === 'PYQ only' ? 'selected' : ''}>PYQ only</option><option ${wizardState.source === 'NCERT only' ? 'selected' : ''}>NCERT only</option><option ${wizardState.source === 'Previously wrong' ? 'selected' : ''}>Previously wrong</option><option ${wizardState.source === 'Unseen' ? 'selected' : ''}>Unseen</option></select></label>
          </div>
          <p class="cg-note">Source and difficulty use your available question bank. AI mode treats them as guidance.</p>
          <div class="cg-bar"><button type="button" class="cg-back" onclick="wizardSetStep(3)">Back</button><button type="button" class="cg-next go" onclick="executeWizardTestGeneration()"><i class="fa-solid fa-play" aria-hidden="true"></i> Launch test</button></div>
        </section>
      ` : ''}
    </div>
  `}
</div>`;
} else if (currentTab === 'learn') {
main.innerHTML = buildPracticeHome();
refreshQuestionCounts(subject).catch(error => console.warn('[EduPulse] Automatic question-bank scan failed:', error));
} else if (currentTab === 'progress') {
main.innerHTML = buildStatsPageV2();
} else if (currentTab === 'directory') {
if (window.epVault) { window.epVault.render(main); } else { main.innerHTML = '<div class="card p-6 text-sm">Vault is loading…</div>'; }
} else if (currentTab === 'settings') {
const settings = StorageModule.get(STORAGE_KEYS.settings, defaultSettings);
main.innerHTML = `
<div class="space-y-6 animate-fadeIn max-w-3xl mx-auto">
  <div class="card p-6 border-l-4 border-l-indigo-500 space-y-4">
    <div><h2 class="text-xl font-black text-slate-900 dark:text-slate-100">Backup &amp; restore</h2><p class="text-xs text-slate-500 mt-1">Without an account, progress stays in this browser. Signed-in accounts sync supported study data. Export a backup before switching devices; API keys are never included.</p></div>
    <div class="flex flex-wrap gap-3">
      <button type="button" onclick="exportBackup()" class="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-indigo-600/20"><i class="fa-solid fa-download mr-1.5"></i>Download backup</button>
      <button type="button" onclick="document.getElementById('backup-file').click()" class="rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-xs font-black"><i class="fa-solid fa-upload mr-1.5"></i>Restore from file</button>
      <input id="backup-file" type="file" accept="application/json,.json" class="hidden" onchange="importBackupFile(this.files[0]); this.value=''">
    </div>
  </div>
  <div class="card p-6 border-l-4 border-l-teal-500 space-y-6">
    <div>
      <h2 class="text-xl font-black text-slate-900 dark:text-slate-100">App & Marking Settings</h2>
      <p class="text-xs text-slate-500 mt-1">Customize scoring and daily targets. Use a non-positive value for negative marks.</p>
    </div>

    <div class="space-y-4 text-xs font-semibold">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="set-marks-correct" class="block text-slate-700 dark:text-slate-300 font-bold mb-1">Marks per Correct Answer</label>
          <input type="number" id="set-marks-correct" min="1" max="10" step="1" required value="${settings.marksCorrect}" class="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
        </div>
        <div>
          <label for="set-marks-wrong" class="block text-slate-700 dark:text-slate-300 font-bold mb-1">Negative Marks per Wrong Answer</label>
          <input type="number" id="set-marks-wrong" min="-10" max="0" step="1" required value="${settings.marksWrong}" class="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
        </div>
      </div>

      <div>
        <label for="set-daily-goal" class="block text-slate-700 dark:text-slate-300 font-bold mb-1">Daily Question Goal</label>
        <input type="number" id="set-daily-goal" min="1" max="200" step="1" required value="${settings.dailyGoalQuestions}" class="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
      </div>

      <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
        <button onclick="updateSettingsFromForm()" class="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs shadow-md">
          Save Settings
        </button>
      </div>
    </div>
  </div>
</div>`;
}
}


<!-- EduPulse merged enhancement scripts -->
(() => {
  'use strict';

  const STREAK_MILESTONES = new Set([3, 5, 10, 20, 30, 50]);
  const METRICS_KEY = 'edupulse_normal_practice_metrics_v1';
  const NOTES_KEY = 'edupulse_question_notes_v1';
  const CONFIDENCE_KEY = 'edupulse_question_confidence_v1';
  const REPORTS_KEY = 'edupulse_question_reports_v1';
  let metrics = { signature: '', answerOrder: [], correctStreak: 0, correct: 0, answered: 0 };
  let focusTimer = null;

  const currentQuestion = () => quizState?.questions?.[quizState.currentIndex] || null;
  const questionId = (q = currentQuestion()) => q?.qKey || `${quizState?.chapter || 'practice'}:${quizState?.currentIndex ?? 0}`;
  const sessionSignature = () => `${quizState?.title || quizState?.chapter || ''}|${(quizState?.questions || []).map(q => q.qKey || q.question).join('|')}`;
  const readStore = (key, fallback = {}) => {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch (_) { return fallback; }
  };
  const writeStore = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { console.warn('[EduPulse] Local save failed:', e); return false; }
  };

  function calculateFromAnswers(answers, questions, answerOrder = []) {
    const validOrder = [];
    (Array.isArray(answerOrder) ? answerOrder : []).forEach((index) => {
      if (Number.isInteger(index) && answers[index] !== undefined && !validOrder.includes(index)) validOrder.push(index);
    });
    Object.keys(answers || {}).forEach((key) => {
      const index = Number(key);
      if (Number.isInteger(index) && answers[index] !== undefined && !validOrder.includes(index)) validOrder.push(index);
    });

    let correct = 0;
    let correctStreak = 0;
    validOrder.forEach((index) => {
      if (questions[index] && answers[index] === questions[index].correct) {
        correct++;
        correctStreak++;
      } else {
        correctStreak = 0;
      }
    });
    return { signature: sessionSignature(), answerOrder: validOrder, correctStreak, correct, answered: validOrder.length };
  }

  function saveMetrics() {
    if (quizState?.mode !== 'practice' || quizState.infinite) return;
    metrics.signature = sessionSignature();
    writeStore(METRICS_KEY, metrics);
  }

  function restoreMetrics() {
    const saved = readStore(METRICS_KEY, null);
    metrics = saved?.signature === sessionSignature()
      ? calculateFromAnswers(quizState.userAnswers || {}, quizState.questions || [], saved.answerOrder)
      : calculateFromAnswers(quizState.userAnswers || {}, quizState.questions || []);
    saveMetrics();
  }

  function renderMetrics() {
    if (quizState?.mode !== 'practice' || quizState.infinite) {
      document.getElementById('normal-practice-toolkit')?.remove();
      return;
    }
    const palette = document.querySelector('.palette-drawer-top');
    if (!palette) return;

    let panel = document.getElementById('normal-practice-toolkit');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'normal-practice-toolkit';
      panel.className = 'w-full rounded-2xl border border-teal-200/70 dark:border-teal-900 bg-white dark:bg-slate-900 p-3 mb-3 shadow-sm';
      palette.insertAdjacentElement('afterend', panel);
    }
    const accuracy = metrics.answered ? Math.round((metrics.correct / metrics.answered) * 100) : 0;
    const q = currentQuestion();
    const notes = readStore(NOTES_KEY, {});
    const confidence = readStore(CONFIDENCE_KEY, {});
    const note = notes[questionId(q)] || '';
    const confidenceValue = confidence[questionId(q)] || 0;
    const streakMessage = metrics.correctStreak >= 3
      ? `<span class="text-amber-600 dark:text-amber-300"><i class="fa-solid fa-fire mr-1"></i>On fire!</span>`
      : '';

    panel.innerHTML = `
      <div class="tk-stats" aria-live="polite">
        <span class="tk-chip"><i class="fa-solid fa-fire" style="color:#f59e0b"></i><b>${metrics.correctStreak}</b> streak ${streakMessage}</span>
        <span class="tk-chip"><i class="fa-solid fa-bullseye" style="color:#14b8a6"></i><b>${accuracy}%</b> accuracy</span>
        <span class="tk-chip"><b>${metrics.correct}/${metrics.answered}</b> correct</span>
      </div>
      <div class="tk-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${accuracy}"><span style="width:${accuracy}%"></span></div>
      <div class="tk-quick"><button type="button" data-action="explain"></button><button type="button" data-action="mnemonic"></button><button type="button" data-action="bookmark" data-state="${quizState.bookmarked?.[quizState.currentIndex] ? 'on' : 'off'}"></button><button type="button" data-action="reveal"></button></div>
      <details class="mt-3 border-t border-slate-100 dark:border-slate-800 pt-2">
        <summary class="cursor-pointer select-none text-[11px] font-extrabold text-teal-700 dark:text-teal-300"><i class="fa-solid fa-toolbox mr-1"></i> More tools</summary>
        <div class="tk-group"><p class="tk-label">Adjust with AI</p><div class="tk-grid"><button type="button" data-action="more"></button><button type="button" data-action="easier"></button><button type="button" data-action="harder"></button></div></div>
        <div class="tk-group"><p class="tk-label">Save &amp; share</p><div class="tk-grid"><button type="button" data-action="copy"></button><button type="button" data-action="share"></button><button type="button" data-action="image"></button><button type="button" data-action="report"></button></div></div>
        <div class="tk-group"><p class="tk-label">Practice</p><div class="tk-grid"><button type="button" data-action="retry"></button><button type="button" data-action="focus"></button></div></div>
        <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="text-[11px] font-bold text-slate-500">Confidence before answer
            <select data-confidence class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-800">
              <option value="0">Not rated</option><option value="1" ${confidenceValue === 1 ? 'selected' : ''}>1 · Guessing</option><option value="2" ${confidenceValue === 2 ? 'selected' : ''}>2 · Unsure</option><option value="3" ${confidenceValue === 3 ? 'selected' : ''}>3 · Fairly sure</option><option value="4" ${confidenceValue === 4 ? 'selected' : ''}>4 · Confident</option><option value="5" ${confidenceValue === 5 ? 'selected' : ''}>5 · Certain</option>
            </select>
          </label>
          <label class="text-[11px] font-bold text-slate-500">Private revision note
            <textarea data-note rows="2" placeholder="Add a reminder for next time..." class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-800">${escapeHtml(note)}</textarea>
          </label>
        </div>
        <p class="mt-2 text-[11px] leading-relaxed text-slate-400">Also available in practice: question palette, answer reveal/explanation, option elimination, skip/review flags, bookmarks, session resume, mistake notebook, retry missed questions, practice again, AI deep-dive, video search, answer timing, shuffled questions/options, unseen/wrong/bookmarked filters, session accuracy, daily goal, keyboard shortcuts, and adaptive drills.</p>
      </details>`;

    panel.querySelector('[data-confidence]')?.addEventListener('change', (event) => {
      const values = readStore(CONFIDENCE_KEY, {});
      values[questionId(q)] = Number(event.target.value) || 0;
      writeStore(CONFIDENCE_KEY, values);
      if (event.target.value) showToast('Confidence rating saved.', 'success');
    });
    panel.querySelector('[data-note]')?.addEventListener('change', (event) => {
      const values = readStore(NOTES_KEY, {});
      values[questionId(q)] = event.target.value.trim();
      writeStore(NOTES_KEY, values);
      showToast('Revision note saved on this device.', 'success');
    });
    panel.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => handleAction(button.dataset.action));
    });
  }

  function celebrate(streak) {
    showToast(`🔥 ${streak} correct answers in a row! Keep it up!`, 'success');
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const layer = document.createElement('div');
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:110;overflow:hidden';
    const colors = ['#14b8a6', '#f59e0b', '#a78bfa', '#34d399', '#fb7185'];
    for (let i = 0; i < 36; i++) {
      const bit = document.createElement('i');
      bit.style.cssText = `position:absolute;left:${Math.random() * 100}%;top:-12px;width:7px;height:12px;border-radius:2px;background:${colors[i % colors.length]};animation:edupulse-confetti ${1.2 + Math.random() * 1.4}s ease-out forwards;transform:rotate(${Math.random() * 360}deg)`;
      layer.appendChild(bit);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 2800);
  }

  function addConfettiStyle() {
    if (document.getElementById('edupulse-confetti-style')) return;
    const style = document.createElement('style');
    style.id = 'edupulse-confetti-style';
    style.textContent = '@keyframes edupulse-confetti{to{transform:translateY(105vh) rotate(760deg);opacity:0}}';
    document.head.appendChild(style);
  }

  function openTextModal(title, body, text) {
    setModal(title, body, `<div class="ai-plain-wrap">${renderFormattedMarkdown(text)}</div>`, `<button onclick="closeModal()" class="rounded-xl bg-slate-100 px-5 py-2 text-xs font-bold dark:bg-slate-800">Close</button>`);
  }

  async function generateAiQuestions(mode) {
    const q = currentQuestion();
    if (!q) return;
    const label = mode === 'more' ? 'similar' : mode;
    const prompt = `Create 5 new NEET MCQs based on this question's concept. Difficulty instruction: ${label}. Do not repeat the original question. Subject/chapter: ${quizState.subject} / ${quizState.chapter}. Original question: ${q.question}. Correct concept/explanation: ${q.explanation || ''}. Return only valid JSON array: [{"q":"...","o":["A","B","C","D"],"a":1,"s":"..."}], where a is 1-based.`;
    showToast('Generating a fresh practice set with AI…', 'info');
    try {
      const text = await callGeminiApi(prompt, 'You are an accurate NEET question setter. Return only valid JSON.');
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('AI did not return a question set.');
      const parsed = JSON.parse(match[0]).filter(item => item?.q && Array.isArray(item.o) && item.o.length === 4 && Number.isInteger(item.a) && item.a >= 1 && item.a <= 4);
      if (!parsed.length) throw new Error('AI returned no valid questions.');
      const questions = parsed.map((item, index) => ({
        qKey: `ai_related_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
        question: String(item.q), options: item.o.map(String), correct: item.a - 1,
        explanation: item.s || 'Review the related NCERT concept.', sourceChapter: `${quizState.subject}: ${quizState.chapter}`
      }));
      const settings = StorageModule.get(STORAGE_KEYS.settings, defaultSettings);
      const oldLength = settings.practiceLength, oldSource = settings.practiceSource;
      settings.practiceLength = 'all'; settings.practiceSource = 'All';
      StorageModule.set(STORAGE_KEYS.settings, settings);
      launchPracticeSession(quizState.subject, `${label === 'similar' ? 'More like' : label} — ${quizState.chapter}`, questions, null);
      settings.practiceLength = oldLength; settings.practiceSource = oldSource;
      StorageModule.set(STORAGE_KEYS.settings, settings);
    } catch (error) {
      showToast(`Could not generate questions: ${error.message}`, 'error');
    }
  }

  async function explainWithAi(mode) {
    const q = currentQuestion();
    if (!q) return;
    const prompt = mode === 'mnemonic'
      ? `Give a short memorable mnemonic and one exam tip for this NEET question/concept: ${q.question}\nExplanation: ${q.explanation || 'Not provided'}`
      : `Explain this NEET question in plain, simple language for a beginner. Then briefly explain why the correct option is right.\nQuestion: ${q.question}\nOptions: ${q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join('\n')}\nCorrect option: ${q.options[q.correct]}\nExisting explanation: ${q.explanation || 'Not provided'}`;
    setModal(mode === 'mnemonic' ? 'Memory trick & exam tip' : 'Simple explanation', 'AI-generated study help', '<div class="animate-pulse p-4 text-sm">Preparing your explanation…</div>', `<button onclick="closeModal()" class="rounded-xl bg-slate-100 px-5 py-2 text-xs font-bold dark:bg-slate-800">Close</button>`);
    try {
      const answer = await callGeminiApi(prompt, 'Be concise, accurate, encouraging, and grounded in NCERT.', false, window.epTok ? epTok.opts('doubt') : {});
      if (document.getElementById('modalTitle')) openTextModal(mode === 'mnemonic' ? 'Memory trick & exam tip' : 'Simple explanation', 'Generated for the current practice question.', answer);
    } catch (error) {
      if (document.getElementById('modalTitle')) setModal('AI helper unavailable', '', `<p class="text-sm text-rose-600">${escapeHtml(error.message)}</p>`, `<button onclick="closeModal()" class="rounded-xl bg-slate-100 px-5 py-2 text-xs font-bold">Close</button>`);
    }
  }

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied.`, 'success');
    } catch (_) {
      showToast('Clipboard access is unavailable in this browser.', 'warning');
    }
  }

  function handleAction(action) {
    const q = currentQuestion();
    if (!q) return;
    const text = `${q.question}\n\n${q.options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join('\n')}`;
    if (action === 'more' || action === 'easier' || action === 'harder') return generateAiQuestions(action);
    if (action === 'mnemonic' || action === 'explain') return explainWithAi(action);
    if (action === 'copy') return copyText(text + epBrandFooter(true), 'Question');
    if (action === 'share') {
      if (typeof epShareQuestionImage === 'function') epShareQuestionImage(q, { subject: quizState.subject, chapter: q.sourceChapter || quizState.chapter });
      else if (navigator.share) navigator.share({ title: quizState.title || 'EduPulse question', text: text + epBrandFooter(false), url: EP_BRAND.site }).catch(() => {});
      else copyText(text + epBrandFooter(true), 'Question');
      return;
    }
    if (action === 'image') return epShareQuestionImage(q, { subject: quizState.subject, chapter: q.sourceChapter || quizState.chapter });
    if (action === 'bookmark') {
      const index = quizState.currentIndex;
      quizState.bookmarked[index] = !quizState.bookmarked[index];
      const stats = StorageModule.get(STORAGE_KEYS.qstats, {});
      const key = q.qKey || `${quizState.chapter}:${index}`;
      stats[key] = { ...(stats[key] || {}), bookmarked: quizState.bookmarked[index] };
      if (quizState.subject && quizState.subject !== 'Mixed' && !stats[key].ch) { stats[key].sj = quizState.subject; stats[key].ch = q.sourceChapter || quizState.chapter; }
      StorageModule.set(STORAGE_KEYS.qstats, stats);
      persistQuizSession();
      renderPracticeQuiz();
      showToast(quizState.bookmarked[index] ? 'Question bookmarked.' : 'Bookmark removed.', 'success');
      return;
    }
    if (action === 'report') {
      const reports = readStore(REPORTS_KEY, []);
      reports.unshift({ question: q.question, qKey: questionId(q), chapter: quizState.chapter, reportedAt: Date.now() });
      writeStore(REPORTS_KEY, reports.slice(0, 100));
      showToast('Question saved to your local review/report list.', 'success');
      return;
    }
    if (action === 'focus') {
      if (focusTimer) {
        clearTimeout(focusTimer);
        focusTimer = null;
        showToast('Focus timer stopped.', 'info');
      } else {
        showToast('Focus session started — 25 minutes. You’ve got this!', 'success');
        focusTimer = setTimeout(() => { focusTimer = null; showToast('🎯 Focus session complete. Take a short break!', 'success'); }, 25 * 60 * 1000);
      }
      return;
    }
    if (action === 'reveal') {
      if (quizState.userAnswers[quizState.currentIndex] === undefined) {
        showToast(`Correct answer: ${String.fromCharCode(65 + q.correct)}. ${q.options[q.correct]}`, 'info');
      } else {
        document.getElementById('quiz-result')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      return;
    }
    if (action === 'retry') {
      const missed = quizState.questions.filter((question, index) => quizState.userAnswers[index] !== undefined && quizState.userAnswers[index] !== question.correct);
      if (!missed.length) return showToast('No answered mistakes to retry yet.', 'info');
      launchPracticeSession(quizState.subject, `${quizState.chapter} — Mistakes`, missed.map(question => ({ ...question, options: [...question.options] })), null);
    }
  }

  window.epToolkitAPI = { action: handleAction, readStore, writeStore, questionId, NOTES_KEY, CONFIDENCE_KEY };

  function installWrapper(name, wrap) {
    const original = window[name];
    if (typeof original !== 'function' || original.__practiceToolkitWrapped) return;
    const replacement = wrap(original);
    replacement.__practiceToolkitWrapped = true;
    window[name] = replacement;
  }

  function install() {
    if (typeof quizState === 'undefined' || typeof window.renderPracticeQuiz !== 'function') return false;

    installWrapper('launchPracticeSession', (original) => function (...args) {
      metrics = { signature: '', answerOrder: [], correctStreak: 0, correct: 0, answered: 0 };
      const result = original.apply(this, args);
      saveMetrics();
      return result;
    });

    installWrapper('selectPracticeOption', (original) => function (optionIndex, ...args) {
      const index = quizState.currentIndex;
      const wasAnswered = quizState.userAnswers[index] !== undefined;
      const result = original.call(this, optionIndex, ...args);
      if (!wasAnswered && quizState.mode === 'practice' && !quizState.infinite) {
        metrics.answerOrder.push(index);
        metrics.answered++;
        if (optionIndex === quizState.questions[index]?.correct) {
          metrics.correct++;
          metrics.correctStreak++;
          if (STREAK_MILESTONES.has(metrics.correctStreak)) celebrate(metrics.correctStreak);
        } else {
          metrics.correctStreak = 0;
        }
        saveMetrics();
        renderMetrics();
      }
      return result;
    });

    installWrapper('renderPracticeQuiz', (original) => function (...args) {
      const result = original.apply(this, args);
      if (quizState.mode === 'practice' && !quizState.infinite) renderMetrics();
      else document.getElementById('normal-practice-toolkit')?.remove();
      return result;
    });

    ['resumeQuizSession', 'resumeSavedSession'].forEach((name) => {
      installWrapper(name, (original) => function (...args) {
        const result = original.apply(this, args);
        restoreMetrics();
        renderMetrics();
        return result;
      });
    });

    installWrapper('persistQuizSession', (original) => function (...args) {
      const result = original.apply(this, args);
      saveMetrics();
      return result;
    });

    restoreMetrics();
    addConfettiStyle();
    return true;
  }

  if (!install()) {
    let tries = 0;
    const retry = setInterval(() => {
      if (install() || ++tries >= 40) clearInterval(retry);
    }, 100);
  }
})();
(() => {
  'use strict';

  const STREAK_MILESTONES = new Set([3, 5, 10, 20, 30, 50]);
  const FEATURES = [
    ['Quick 10', 'Start a compact mixed practice drill.', 'fa-bolt', 'quick-ten'],
    ['AI adaptive drill', 'Launch a dynamically adjusted question session.', 'fa-wand-magic-sparkles', 'adaptive'],
    ['AI question maker', 'Generate a fresh question set from any topic.', 'fa-robot', 'ai-generator'],
    ['Retry mistakes', 'Focus on questions missed in the current session.', 'fa-rotate', 'retry'],
    ['Mistake notebook', 'Review your saved error-notebook entries.', 'fa-book-open', 'notebook'],
    ['Focus timer', 'Open the Focus page: stopwatch, Pomodoro, stats.', 'fa-stopwatch', 'focus'],
    ['Study planner', 'Open your daily study plan and tasks.', 'fa-list-check', 'planner'],
    ['Performance stats', 'Review accuracy and past attempts.', 'fa-chart-line', 'stats'],
    ['Resource vault', 'Browse saved study resources.', 'fa-box-archive', 'vault'],
    ['Biology practice', 'Browse Biology chapters and start practice.', 'fa-leaf', 'biology'],
    ['Chemistry practice', 'Browse Chemistry chapters and start practice.', 'fa-flask', 'chemistry'],
    ['Physics practice', 'Browse Physics chapters and start practice.', 'fa-atom', 'physics'],
    ['Practice settings', 'Adjust length, question source, and shuffling.', 'fa-sliders', 'practice-settings'],
    ['Question bookmarks', 'Review bookmarked questions in your practice history.', 'fa-bookmark', 'bookmarks'],
    ['Session resume', 'Continue the last saved practice session.', 'fa-play', 'resume'],
    ['AI explain a question', 'Get a simple explanation for the current question.', 'fa-lightbulb', 'explain'],
    ['More like this', 'Create related questions with AI from the current question.', 'fa-clone', 'more'],
    ['Keyboard shortcuts', 'See the shortcuts available during practice.', 'fa-keyboard', 'help'],
    ['API key settings', 'Configure your Gemini key for AI study tools.', 'fa-key', 'api-key'],
    ['Study dashboard', 'Return to your overview and progress snapshot.', 'fa-house', 'dashboard']
  ];

  let testAnswerOrder = [];
  let testStreak = 0;
  let testSignature = '';

  function celebrate(streak, mode = 'practice') {
    const message = mode === 'test'
      ? `🏆 ${streak} correct answers in a row in your test!`
      : `🔥 ${streak} correct answers in a row! Keep it up!`;
    if (typeof showToast === 'function') showToast(message, 'success');
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const layer = document.createElement('div');
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:110;overflow:hidden';
    const colors = ['#14b8a6', '#f59e0b', '#a78bfa', '#34d399', '#fb7185'];
    for (let i = 0; i < 42; i++) {
      const bit = document.createElement('i');
      bit.style.cssText = `position:absolute;left:${Math.random() * 100}%;top:-12px;width:7px;height:12px;border-radius:2px;background:${colors[i % colors.length]};animation:edupulse-confetti ${1.2 + Math.random() * 1.4}s ease-out forwards;transform:rotate(${Math.random() * 360}deg)`;
      layer.appendChild(bit);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 2800);
  }

  function installConfettiStyle() {
    if (document.getElementById('edupulse-confetti-style')) return;
    const style = document.createElement('style');
    style.id = 'edupulse-confetti-style';
    style.textContent = `
      @keyframes edupulse-confetti{to{transform:translateY(105vh) rotate(760deg);opacity:0}}
      #normal-practice-toolkit{position:relative;overflow:hidden;border-radius:1.35rem!important;padding:1rem!important;background:radial-gradient(circle at 100% 0,rgba(20,184,166,.14),transparent 36%),linear-gradient(145deg,#fff,#f8fafc)!important;box-shadow:0 12px 30px -20px rgba(15,118,110,.55)!important}
      .dark #normal-practice-toolkit{background:radial-gradient(circle at 100% 0,rgba(20,184,166,.16),transparent 36%),linear-gradient(145deg,#0f172a,#111c2f)!important}
      #normal-practice-toolkit details>summary{padding:.65rem .75rem;border-radius:.9rem;background:rgba(20,184,166,.08);font-size:.75rem!important}
      #normal-practice-toolkit [data-action]{min-height:42px;border:1px solid rgba(148,163,184,.16);box-shadow:0 2px 6px rgba(15,23,42,.08);transition:transform .16s ease,filter .16s ease,box-shadow .16s ease}
      #normal-practice-toolkit [data-action]:hover{filter:brightness(1.08);transform:translateY(-2px);box-shadow:0 8px 14px rgba(15,23,42,.14)}
      #normal-practice-toolkit [data-confidence],#normal-practice-toolkit [data-note]{font-size:.75rem!important;border-radius:.8rem!important}
      .edupulse-feature-card{min-height:142px;display:flex;flex-direction:column;justify-content:space-between;text-align:left;border:1px solid var(--border-color);border-radius:1.2rem;background:linear-gradient(145deg,var(--card-bg),rgba(20,184,166,.035));padding:1rem;box-shadow:0 5px 16px rgba(15,23,42,.045);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
      .edupulse-feature-card:hover{transform:translateY(-4px);border-color:rgba(20,184,166,.55);box-shadow:0 14px 26px rgba(13,148,136,.12)}
      .edupulse-feature-icon{display:grid;place-items:center;width:2.4rem;height:2.4rem;border-radius:.85rem;background:rgba(20,184,166,.12);color:#0f9488;font-size:1rem}
      .dark .edupulse-feature-icon{color:#5eead4}
    `;
    document.head.appendChild(style);
  }

  function currentQuestion() {
    return typeof quizState !== 'undefined' ? quizState.questions?.[quizState.currentIndex] : null;
  }

  function parseAiQuestions(text) {
    const match = String(text || '').match(/\[[\s\S]*\]/);
    if (!match) throw new Error('AI did not return a JSON question set. Please try again.');
    const items = JSON.parse(match[0]);
    if (!Array.isArray(items)) throw new Error('AI response was not a question list.');
    const valid = items.filter(item => item && (item.q || item.question) && Array.isArray(item.o || item.options) && (item.o || item.options).length === 4 && Number.isInteger(item.a ?? item.answer) && (item.a ?? item.answer) >= 1 && (item.a ?? item.answer) <= 4);
    if (!valid.length) throw new Error('AI returned no valid four-option questions.');
    return valid.map((item, index) => ({
      qKey: `ai_related_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
      question: String(item.q || item.question),
      options: (item.o || item.options).map(String),
      correct: (item.a ?? item.answer) - 1,
      explanation: String(item.s || item.explanation || 'Review the related concept.'),
      sourceChapter: item.chapter || `${quizState?.subject || 'NEET'}: ${quizState?.chapter || 'AI practice'}`
    }));
  }

  function questionGeneratorModal(seedQuestion = null) {
    const defaultTopic = seedQuestion
      ? `${quizState.subject || 'NEET'} — ${quizState.chapter || 'current chapter'}: ${seedQuestion.question}`
      : `${quizState?.subject || 'Biology'} — ${quizState?.chapter || 'NEET concepts'}`;
    setModal('AI question generator', 'Create a fresh, answer-checked practice set from a topic or the current question.', `
      <div class="space-y-4 py-2 text-sm">
        <label class="block text-xs font-bold text-slate-600 dark:text-slate-300">Topic or source question
          <textarea id="ai-related-topic" rows="4" class="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-800">${escapeHtml(defaultTopic)}</textarea>
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="text-xs font-bold text-slate-600 dark:text-slate-300">Difficulty
            <select id="ai-related-difficulty" class="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-800"><option>Similar NEET level</option><option>Easy foundation</option><option>Challenging</option></select>
          </label>
          <label class="text-xs font-bold text-slate-600 dark:text-slate-300">Questions
            <select id="ai-related-count" class="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-800"><option value="5">5 questions</option><option value="10">10 questions</option></select>
          </label>
        </div>
        <p class="rounded-xl bg-teal-500/10 p-3 text-[11px] leading-relaxed text-teal-800 dark:text-teal-200">AI will return four-option MCQs with an answer and short explanation. Review the generated set before starting the new practice session.</p>
      </div>
    `, `
      <button onclick="closeModal()" class="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold dark:bg-slate-800">Cancel</button>
      <button onclick="runAiRelatedGenerator()" class="rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-teal-700"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i> Generate questions</button>
    `);
  }

  async function runAiRelatedGenerator() {
    const topic = document.getElementById('ai-related-topic')?.value?.trim();
    if (!topic) return showToast('Enter a topic or source question first.', 'warning');
    const difficulty = document.getElementById('ai-related-difficulty')?.value || 'Similar NEET level';
    const count = Number(document.getElementById('ai-related-count')?.value) || 5;
    const title = `AI practice — ${String(topic).slice(0, 48)}`;
    setModal('Generating related questions…', `${count} questions · ${difficulty}`, '<div class="animate-pulse p-5 text-sm">Creating and validating your practice set…</div>', '<button onclick="closeModal()" class="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold dark:bg-slate-800">Cancel</button>');
    try {
      const prompt = `Create exactly ${count} original NEET-level multiple-choice questions based on the topic/source below. Difficulty: ${difficulty}. Avoid repeating or closely paraphrasing the source. Return ONLY a raw JSON array, no markdown, with objects shaped as {"q":"question","o":["A","B","C","D"],"a":1,"s":"short explanation"}; a is the 1-based correct option. Topic/source: ${topic}`;
      const text = await callGeminiApi(prompt, 'You are an accurate NEET question setter. Make every answer factually sound and aligned with NCERT. Output only valid JSON.');
      const questions = parseAiQuestions(text);
      if (!document.getElementById('modalTitle')) return;
      setModal('Your AI practice set is ready', `${questions.length} validated questions · ${difficulty}`, `
        <div class="space-y-3">${questions.map((q, i) => `<article class="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><p class="text-[11px] font-black uppercase text-teal-600">Question ${i + 1}</p><p class="mt-1 text-xs font-bold">${escapeHtml(q.question)}</p><p class="mt-2 text-[11px] text-slate-500">${q.options.map((o, oi) => `${String.fromCharCode(65 + oi)}. ${escapeHtml(o)}`).join('<br>')}</p><p class="mt-2 text-[11px] font-bold text-emerald-600">Answer: ${String.fromCharCode(65 + q.correct)} · ${escapeHtml(q.explanation)}</p></article>`).join('')}</div>
      `, `<button onclick="closeModal()" class="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold dark:bg-slate-800">Keep studying</button><button onclick="startGeneratedAiPractice()" class="rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-extrabold text-white">Start this practice set</button>`);
      window.__edupulseGeneratedQuestions = questions;
      window.__edupulseGeneratedTitle = title;
    } catch (error) {
      if (document.getElementById('modalTitle')) setModal('Could not generate questions', '', `<p class="text-sm text-rose-600">${escapeHtml(error.message)}</p>`, '<button onclick="closeModal()" class="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold dark:bg-slate-800">Close</button>');
    }
  }

  function startGeneratedAiPractice() {
    const questions = window.__edupulseGeneratedQuestions;
    if (!Array.isArray(questions) || !questions.length) return showToast('Generate a question set first.', 'warning');
    const subject = quizState?.subject || 'NEET';
    const title = window.__edupulseGeneratedTitle || 'AI generated practice';
    closeModal();
    launchPracticeSession(subject, title, questions, null);
  }

  window.runAiRelatedGenerator = runAiRelatedGenerator;
  window.startGeneratedAiPractice = startGeneratedAiPractice;

  function runFeature(action) {
    switch (action) {
      case 'quick-ten': return typeof startQuickTen === 'function' ? startQuickTen() : switchTab('learn');
      case 'adaptive': return openAdaptiveAiConfigModal();
      case 'ai-generator': return questionGeneratorModal();
      case 'retry': return currentQuestion() ? (document.querySelector('#normal-practice-toolkit [data-action="retry"]')?.click() || showToast('Open a practice session to retry its mistakes.', 'info')) : showToast('Start a practice session to retry its mistakes.', 'info');
      case 'notebook': return openErrorNotebook();
      case 'focus': return window.epOpenFocus ? epOpenFocus() : switchTab('focus');
      case 'planner': return epOpenFocus('td');
      case 'stats': return switchTab('progress');
      case 'vault': return switchTab('directory');
      case 'biology': return switchTab('learn');
      case 'chemistry': return switchTab('learn');
      case 'physics': return switchTab('learn');
      case 'practice-settings': return switchTab('settings');
      case 'bookmarks': return switchTab('learn');
      case 'resume': return resumeSavedSession();
      case 'explain': return currentQuestion() ? questionGeneratorModal(currentQuestion()) : questionGeneratorModal();
      case 'more': return currentQuestion() ? questionGeneratorModal(currentQuestion()) : questionGeneratorModal();
      case 'help': return openHelpModal();
      case 'api-key': return openApiKeyModal();
      default: return switchTab('dashboard');
    }
  }

  window.runDashboardFeature = runFeature;

  function installTestStreakTracking() {
    const original = window.selectTestOption;
    if (typeof original !== 'function' || original.__testStreakWrapped) return false;
    const wrapped = function (optionIndex, ...args) {
      if (typeof quizState === 'undefined' || quizState.mode !== 'test') return original.call(this, optionIndex, ...args);
      const signature = `${quizState.title || quizState.chapter}|${(quizState.questions || []).length}`;
      if (signature !== testSignature) {
        testSignature = signature;
        testAnswerOrder = [];
        testStreak = 0;
      }
      const index = quizState.currentIndex;
      const firstAnswer = quizState.userAnswers?.[index] === undefined;
      const result = original.call(this, optionIndex, ...args);
      if (firstAnswer && quizState.mode === 'test') {
        testAnswerOrder.push(index);
        if (optionIndex === quizState.questions[index]?.correct) {
          testStreak++;
          if (STREAK_MILESTONES.has(testStreak)) celebrate(testStreak, 'test');
        } else {
          testStreak = 0;
        }
      }
      return result;
    };
    wrapped.__testStreakWrapped = true;
    window.selectTestOption = wrapped;
    return true;
  }

  installConfettiStyle();
  // selectTestOption is a plain function declaration from the main script, so one install is enough.
  // A single re-check after load covers any later script that replaces it.
  installTestStreakTracking();
  window.addEventListener('load', installTestStreakTracking, { once: true });

  document.addEventListener('click', (event) => {
    const moreButton = event.target.closest('#normal-practice-toolkit [data-action="more"]');
    if (!moreButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    questionGeneratorModal(currentQuestion());
  }, true);
})();
(() => {
  'use strict';

  const ACTIONS = {
    more: ['fa-clone', 'More like this', 'teal'],
    easier: ['fa-feather-pointed', 'Make easier', 'sky'],
    harder: ['fa-mountain', 'Make harder', 'indigo'],
    mnemonic: ['fa-brain', 'Memory trick', 'purple'],
    explain: ['fa-lightbulb', 'Explain simply', 'violet'],
    copy: ['fa-copy', 'Copy question', 'slate'],
    share: ['fa-share-nodes', 'Share question', 'slate'],
    image: ['fa-image', 'Share as image', 'indigo'],
    bookmark: ['fa-bookmark', 'Bookmark', 'amber'],
    report: ['fa-flag', 'Report question', 'rose'],
    focus: ['fa-stopwatch', '25-min focus', 'emerald'],
    reveal: ['fa-eye', 'Reveal answer', 'slate'],
    retry: ['fa-rotate', 'Retry mistakes', 'rose']
  };

  const COLOR_STYLES = {
    teal: 'background:#0f766e;color:#fff', sky: 'background:#0369a1;color:#fff',
    indigo: 'background:#4338ca;color:#fff', purple: 'background:#7e22ce;color:#fff',
    violet: 'background:#6d28d9;color:#fff', slate: 'background:#334155;color:#fff',
    amber: 'background:#d97706;color:#fff', rose: 'background:#be123c;color:#fff',
    emerald: 'background:#047857;color:#fff'
  };

  function enhanceToolkit() {
    const panel = document.getElementById('normal-practice-toolkit');
    if (!panel) return;

    const summary = panel.querySelector('details > summary');
    if (summary && !summary.dataset.enh) {
      summary.dataset.enh = '1';
      summary.innerHTML = '<i class="fa-solid fa-note-sticky tk-sum-icon" aria-hidden="true"></i><span>Notes &amp; confidence</span><i class="fa-solid fa-chevron-down tk-chev" aria-hidden="true"></i>';
      summary.title = 'Notes & confidence';
    }
    panel.querySelectorAll('[data-action]').forEach((button) => {
      const action = button.dataset.action;
      const config = ACTIONS[action];
      if (!config) return;
      const [iconName, label, color] = config;
      const on = action === 'bookmark' && button.dataset.state === 'on';
      const sig = action + (on ? ':on' : '');
      if (button.dataset.sig === sig) return;
      button.dataset.sig = sig;
      button.type = 'button';
      button.title = on ? 'Remove bookmark' : label;
      button.setAttribute('aria-label', on ? 'Remove bookmark' : label);
      if (action === 'bookmark') button.setAttribute('aria-pressed', String(on));
      button.className = `tk-btn tk-${color}${button.closest('.tk-quick') ? ' tk-big' : ''}`;
      button.removeAttribute('style');
      button.innerHTML = `<i class="fa-solid ${iconName}" aria-hidden="true"></i><span>${on ? 'Bookmarked' : label}</span>`;
    });

    const confidence = panel.querySelector('[data-confidence]');
    if (confidence) {
      const label = confidence.closest('label');
      if (label) label.className = 'rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] font-extrabold text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300';
      confidence.className = 'mt-2 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900';
    }
    const note = panel.querySelector('[data-note]');
    if (note) {
      const label = note.closest('label');
      if (label) label.className = 'rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] font-extrabold text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300';
      note.className = 'mt-2 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900';
    }
  }

  function addStyles() {
    if (document.getElementById('edupulse-study-tools-style')) return;
    const style = document.createElement('style');
    style.id = 'edupulse-study-tools-style';
    style.textContent = `
      #normal-practice-toolkit{border-radius:1.35rem!important;padding:1rem!important;background:radial-gradient(circle at 100% 0,rgba(20,184,166,.14),transparent 36%),linear-gradient(145deg,#fff,#f8fafc)!important;box-shadow:0 12px 30px -20px rgba(15,118,110,.55)!important}
      .dark #normal-practice-toolkit{background:radial-gradient(circle at 100% 0,rgba(20,184,166,.16),transparent 36%),linear-gradient(145deg,#0f172a,#111c2f)!important}
      #normal-practice-toolkit details>summary{display:flex;align-items:center;gap:.45rem;padding:.7rem .8rem;border-radius:.9rem;background:rgba(20,184,166,.08);font-size:.75rem!important;list-style:none}
      #normal-practice-toolkit details>summary::-webkit-details-marker{display:none}
      #normal-practice-toolkit [data-action]{min-height:44px;line-height:1.25}
      #normal-practice-toolkit [data-action]:hover{filter:brightness(1.08);transform:translateY(-2px);box-shadow:0 8px 14px rgba(15,23,42,.14)}
      #normal-practice-toolkit [data-action="bookmark"]{outline:1px solid rgba(245,158,11,.3)}
      #normal-practice-toolkit [data-confidence],#normal-practice-toolkit [data-note]{font-size:.75rem!important;border-radius:.8rem!important}
    `;
    document.head.appendChild(style);
  }

  function start() {
    addStyles();
    enhanceToolkit();
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        observer.disconnect();
        try { enhanceToolkit(); }
        finally { observer.observe(document.body, { childList: true, subtree: true }); }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();


// ===== Quiz action bar: bookmark / share / more now live beside the question =====
(() => {
  const MENUS = {
    share: [['image', 'fa-image', 'Share as image'], ['share', 'fa-share-nodes', 'Share as text'], ['copy', 'fa-copy', 'Copy question'], ['cl_chat', 'fa-user-group', 'Send to a chat'], ['cl_ask', 'fa-circle-question', 'Ask in Doubts'], ['cl_thr', 'fa-comment-dots', 'Start a thread']],
    more: [['explain', 'fa-lightbulb', 'Explain simply'], ['mnemonic', 'fa-brain', 'Memory trick'], ['reveal', 'fa-eye', 'Reveal answer'], ['notes', 'fa-note-sticky', 'Notes & confidence'], ['more', 'fa-clone', 'More like this'], ['easier', 'fa-feather-pointed', 'Make it easier'], ['harder', 'fa-mountain', 'Make it harder'], ['retry', 'fa-rotate', 'Retry mistakes'], ['focus', 'fa-stopwatch', '25-min focus'], ['report', 'fa-flag', 'Report question'], ['image', 'fa-image', 'Share as image'], ['share', 'fa-share-nodes', 'Share as text'], ['copy', 'fa-copy', 'Copy question']]
  };
  window.epQaClose = () => { const m = document.getElementById('ep-qa-pop'); if (m) m.remove(); document.querySelectorAll('.ep-qa-btn[aria-expanded="true"],[data-a="mr"][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false')); };
  window.epQa = (action, btn) => {
    epQaClose();
    if (action === 'notes') return epQaNotes();
    const t = document.querySelector(`#normal-practice-toolkit [data-action="${action}"]`);
    if (!t) { try { showToast('That tool is not available on this screen', 'warning'); } catch (e) {} return; }
    t.click();
    if (action === 'bookmark') setTimeout(() => {
      const on = t.dataset.state === 'on' || t.getAttribute('aria-pressed') === 'true';
      document.querySelectorAll('.ep-qa-bm').forEach(b => { b.setAttribute('aria-pressed', String(on)); b.title = on ? 'Remove bookmark' : 'Bookmark'; const i = b.querySelector('i'); if (i) i.className = (on ? 'fa-solid' : 'fa-regular') + ' fa-bookmark'; });
    }, 80);
  };
  window.epQaNotes = () => {
    const panel = document.getElementById('normal-practice-toolkit');
    const sel = panel && panel.querySelector('[data-confidence]'), note = panel && panel.querySelector('[data-note]');
    if (!sel || !note) { try { showToast('Notes are not available on this screen', 'warning'); } catch (e) {} return; }
    const old = document.getElementById('ep-notes-sheet'); if (old) old.remove();
    const wrap = document.createElement('div');
    wrap.id = 'ep-notes-sheet';
    wrap.innerHTML = '<div class="ep-ns-card" role="dialog" aria-label="Notes and confidence"><div class="ep-ns-h"><b>Notes &amp; confidence</b><button type="button" class="ep-ns-x" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div><label>Confidence before answer<select></select></label><label>Private revision note<textarea rows="4" placeholder="Add a reminder for next time..."></textarea></label></div>';
    const s = wrap.querySelector('select'), t = wrap.querySelector('textarea');
    s.innerHTML = sel.innerHTML; s.value = sel.value; t.value = note.value;
    const sync = (from, to) => { to.value = from.value; to.dispatchEvent(new Event('change', { bubbles: true })); };
    s.addEventListener('change', () => sync(s, sel));
    t.addEventListener('change', () => sync(t, note));
    const close = () => { if (document.activeElement === t || document.activeElement === s) document.activeElement.blur(); wrap.remove(); };
    wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('.ep-ns-x')) close(); });
    document.body.appendChild(wrap);
  };
  window.epQaMenu = (btn, kind) => {
    const was = btn.getAttribute('aria-expanded') === 'true';
    epQaClose();
    if (was) return;
    const pop = document.createElement('div');
    pop.id = 'ep-qa-pop'; pop.className = 'ep-pop'; pop.setAttribute('role', 'menu');
    pop.innerHTML = MENUS[kind].map(([a, ic, label]) => `<button type="button" role="menuitem" class="ep-pop-item" data-a="${a}"><i class="fa-solid ${ic}" aria-hidden="true"></i><span>${label}</span></button>`).join('');
    document.body.appendChild(pop);
    btn.setAttribute('aria-expanded', 'true');
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    const left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8));
    const top = (r.bottom + 6 + h > innerHeight - 8) ? Math.max(8, r.top - h - 6) : r.bottom + 6;
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    pop.addEventListener('click', e => { const it = e.target.closest('[data-a]'); if (it) epQa(it.dataset.a); });
  };
  document.addEventListener('click', e => { if (!e.target.closest('#ep-qa-pop,.ep-qa-btn,[data-a="mr"]')) epQaClose(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') epQaClose(); });
  window.addEventListener('resize', epQaClose);
})();

// Register service worker (offline + installable PWA).
// The build id is part of the URL, so every new build gets a fresh worker; the worker should version its cache with the same id (see sw-update-notes.md).
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  let updateRequested = false;
  const showUpdatePrompt = (reg) => {
    if (document.getElementById('ep-update-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'ep-update-bar'; bar.setAttribute('role', 'status');
    bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:84px;z-index:2147482000;width:min(94vw,440px);display:flex;gap:.6rem;align-items:center;padding:.7rem .9rem;border-radius:16px;background:#0f172a;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.35);font-size:.85rem;font-weight:700';
    bar.innerHTML = '<span style="flex:1">A new version of EduPulse is ready.</span><button type="button" data-u="go" style="padding:.45rem .9rem;border-radius:999px;background:#14b8a6;color:#04201c;font-weight:800">Update</button><button type="button" data-u="later" aria-label="Dismiss" style="padding:.45rem .6rem;opacity:.7">Later</button>';
    bar.addEventListener('click', (e) => {
      const k = e.target.dataset && e.target.dataset.u;
      if (k === 'later') return bar.remove();
      if (k === 'go') { updateRequested = true; if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' }); else location.reload(); }
    });
    document.body.appendChild(bar);
  };
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js?v=' + encodeURIComponent(window.EP_BUILD || 'dev')).then((reg) => {
      // A worker was already waiting from an earlier visit, or a new one finishes installing now.
      if (reg.waiting && navigator.serviceWorker.controller) showUpdatePrompt(reg);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdatePrompt(reg); });
      });
      // Check for a new build when the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(e => console.warn('SW registration failed:', e));
    let reloaded = false;
    const hadController = !!navigator.serviceWorker.controller;
    /* first install (claim) and background updates must not reload the page mid-use; only the Update button does */
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloaded || !hadController || !updateRequested) return; reloaded = true; location.reload(); });
  });
}

// ===== Back button / gesture handling (Android & browser history) =====
// Keeps one buffer entry above the app's first page so Back is handled in-app instead of closing the site.
(() => {
  let armed = false, exitArmedUntil = 0;
  const modalEl = () => document.getElementById('appModal');
  const modalOpen = () => modalEl()?.classList.contains('open');
  function arm() {
    if (armed) return;
    armed = true;
    try { history.pushState({ edu: 'app' }, ''); } catch (e) { armed = false; }
  }
  try { history.replaceState({ edu: 'home' }, ''); } catch (e) {}
  // Browsers ignore history entries added without a user gesture, so add the buffer entry on first interaction.
  ['pointerdown', 'touchstart', 'keydown', 'click'].forEach(ev => window.addEventListener(ev, arm, { once: true, passive: true, capture: true }));

  function handleBack() {
    // 1. Quiz screen (fullscreen modal)
    if (modalOpen() && modalEl().classList.contains('fullscreen-modal')) {
      const title = document.getElementById('modalTitle')?.textContent || '';
      if (title === 'Leave Practice Session?') {
        // Back pressed on the confirmation = "Continue Attempt"
        if (quizState.mode === 'test') renderTestQuiz(); else renderPracticeQuiz();
      } else {
        confirmExitQuiz();
      }
      return;
    }
    // 2. Any other open dialog
    if (modalOpen()) { closeModal(); return; }
    // 3. Mobile menu
    if (document.getElementById('sidebarDrawer')?.classList.contains('mobile-open')) { toggleMobileNav(false); return; }
    // 4. Other tabs go back to the dashboard
    if (currentTab !== 'dashboard') { switchTab('dashboard'); return; }
    // 5. Dashboard: press back twice to leave
    if (Date.now() < exitArmedUntil) { exitArmedUntil = 0; return 'exit'; }
    exitArmedUntil = Date.now() + 2000;
    showToast('Press back again to exit', 'info');
  }

  window.addEventListener('popstate', (event) => {
    if (!armed || event.state?.edu !== 'home') return;
    const result = handleBack();
    if (result === 'exit') { history.back(); return; } // leaves the site
    try { history.pushState({ edu: 'app' }, ''); } catch (e) {}
  });
})();

// Initial mount
renderView();

;

(function(){
  function centerPaletteCurrent(){
    document.querySelectorAll('.palette-drawer-top').forEach(function(p){
      var row=p.children[1], b=row&&row.querySelector('.pal-current');
      if(!row||!b) return;
      var rr=row.getBoundingClientRect(), br=b.getBoundingClientRect();
      row.scrollLeft += (br.left-rr.left) - (row.clientWidth-br.width)/2;
    });
  }
  ['renderPracticeQuiz','renderTestQuiz'].forEach(function(n){
    var orig=window[n]; if(typeof orig!=='function') return;
    window[n]=function(){var r=orig.apply(this,arguments); requestAnimationFrame(centerPaletteCurrent); setTimeout(centerPaletteCurrent,60); return r;};
  });
})();

;

(function(){
  window.togglePqAutoNext=function(){
    var on=false; try{on=localStorage.getItem('edupulse_autonext')==='1';localStorage.setItem('edupulse_autonext',on?'0':'1');}catch(e){}
    if(window.showToast) showToast(on?'Auto-advance off':'Auto-advance on: moves on after a correct answer');
    renderPracticeQuiz();
  };
  var orig=window.selectPracticeOption;
  if(typeof orig==='function'){
    window.selectPracticeOption=function(i){
      var idx=quizState.currentIndex, fresh=quizState.userAnswers[idx]===undefined;
      var r=orig.apply(this,arguments);
      var auto=false; try{auto=localStorage.getItem('edupulse_autonext')==='1';}catch(e){}
      var q=quizState.questions[idx];
      if(fresh&&auto&&!quizState.infinite&&q&&i===q.correct&&idx<quizState.questions.length-1){
        setTimeout(function(){ if(quizState.currentIndex===idx&&document.getElementById('appModal')?.classList.contains('open')) goToNextPracticeQuestion(); },1200);
      }
      return r;
    };
  }
})();

;

(function(){
  function fmt(t){t=Math.max(0,Math.min(5999,Math.round(t)));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');}
  setInterval(function(){
    if(typeof quizState==='undefined'||quizState.mode!=='practice') return;
    /* Practice has no session countdown or automatic timeout. Keep the per-question timer. */
    var el=document.querySelector('#pq-timer b'); if(!el) return;
    var i=quizState.currentIndex, done=quizState.userAnswers[i]!==undefined;
    el.textContent=fmt(done?(quizState.questionTimes[i]||0):(Date.now()-quizState.questionStartTimer)/1000);
  },1000);
  var lastIdx=-1, lastLen=-1, pqSession=null, pqSpent={}, pqHiddenAt=0;
  var orig=window.renderPracticeQuiz;
  if(typeof orig==='function'){
    window.renderPracticeQuiz=function(){
      var r=orig.apply(this,arguments);
      var i=quizState.currentIndex, now=Date.now();
      /* new session -> forget per-question carry-over */
      if(quizState.questionTimes!==pqSession){pqSession=quizState.questionTimes;pqSpent={};lastIdx=-1;}
      if(i!==lastIdx){
        /* leaving an unanswered question: remember its time so revisits continue, not restart */
        if(lastIdx!==-1 && quizState.userAnswers[lastIdx]===undefined){pqSpent[lastIdx]=Math.max(0,(now-quizState.questionStartTimer)/1000);}
        /* entering an unanswered question: start its own clock */
        if(quizState.userAnswers[i]===undefined){
          quizState.questionStartTimer=now-(pqSpent[i]||0)*1000;
          var tEl=document.querySelector('#pq-timer b'); if(tEl){tEl.textContent=fmt((now-quizState.questionStartTimer)/1000);}
        }
        if(lastIdx!==-1){
          var card=document.querySelector('.quiz-session-layout > [ontouchstart]');
          if(card){card.classList.add('pq-enter');card.addEventListener('animationend',function(){card.classList.remove('pq-enter')},{once:true});}
        }
        lastIdx=i;
      }
      return r;
    };
  }
  /* pause the question clock while the tab/app is in the background */
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){pqHiddenAt=Date.now();return;}
    if(pqHiddenAt && typeof quizState!=='undefined' && quizState.mode==='practice' && quizState.userAnswers[quizState.currentIndex]===undefined){
      quizState.questionStartTimer+=Date.now()-pqHiddenAt;
    }
    pqHiddenAt=0;
  });
})();

;

/* Performance Stats v2 — marks-first analytics (NEET +4 / -1 marking). Read-only over existing storage. */
function buildStatsPageV2(){
  const S=StorageModule,K=STORAGE_KEYS,set=S.get(K.settings,defaultSettings)||{};
  const mc=Number(set.marksCorrect??4),mw=Math.abs(Number(set.marksWrong??-1));
  const range=window.__statsRange||'all',days=range==='all'?0:Number(range);
  const cutoff=days?Date.now()-days*864e5:0;
  const every=S.get(K.attempts,[])||[],at=every.filter(a=>(a.mode==='test'||a.mode==='mock')&&(a.finishedAt||0)>=cutoff);
  const sum=(arr,f)=>arr.reduce((s,a)=>s+(Number(f(a))||0),0);
  const att=sum(at,a=>a.attempted),cor=sum(at,a=>a.correct),wr=sum(at,a=>a.wrong),sk=sum(at,a=>a.skipped);
  const acc=cor+wr?Math.round(cor/(cor+wr)*100):0;
  const pcts=at.map(a=>a.maxScore>0?Math.max(0,Math.min(100,a.score/a.maxScore*100)):0);
  const avgPct=pcts.length?Math.round(sum(pcts,x=>x)/pcts.length):0;
  const bestIdx=pcts.length?pcts.indexOf(Math.max(...pcts)):-1,best=bestIdx>=0?at[bestIdx]:null;
  const gained=cor*mc,lost=wr*mw,net=gained-lost,projected=Math.round(avgPct/100*720);
  const band=!at.length?'Complete a test to see an early estimate':at.length<3?'Early signal · build a larger sample':projected>=600?'Strong current test average':projected>=450?'Developing test average':projected>=300?'Early test average':'Early test average · keep practising';
  const streak=S.get(K.streak,{current:0,best:0,dailyCounts:{}})||{};const counts=streak.dailyCounts||{};
  const ring=(p,c,s=64)=>{const r=s/2-6,C=2*Math.PI*r;return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="flex:none"><circle cx="${s/2}" cy="${s/2}" r="${r}" fill="none" stroke="rgba(148,163,184,.25)" stroke-width="6"/><circle cx="${s/2}" cy="${s/2}" r="${r}" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(C*p/100).toFixed(1)} ${C}" transform="rotate(-90 ${s/2} ${s/2})"/></svg>`;};
  /* trend */
  const last=pcts.slice(0,12).reverse();let trend;
  if(last.length<2)trend='<div class="st-empty">Complete 2+ tests to see your score trend.</div>';
  else{const W=600,H=150,P=14,x=i=>P+i*(W-2*P)/(last.length-1),y=v=>H-P-v/100*(H-2*P);
    const pts=last.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    trend=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;margin-top:10px"><defs><linearGradient id="stg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14b8a6" stop-opacity=".35"/><stop offset="1" stop-color="#14b8a6" stop-opacity="0"/></linearGradient></defs>${[25,50,75].map(g=>`<line x1="${P}" x2="${W-P}" y1="${y(g)}" y2="${y(g)}" stroke="rgba(148,163,184,.25)" stroke-dasharray="3 5"/>`).join('')}<polygon points="${P},${H-P} ${pts} ${W-P},${H-P}" fill="url(#stg)"/><polyline points="${pts}" fill="none" stroke="#14b8a6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${last.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="#0d9488"><title>${Math.round(v)}%</title></circle>`).join('')}</svg>`;}
  /* subjects & chapters (all-time question stats) */
  const qs=S.get(K.qstats,{})||{},subj={},chap={};
  Object.values(qs).forEach(q=>{if(!q)return;const c=q.correct||0,w=q.wrong||0;if(!(c+w))return;
    if(q.sj){const s=subj[q.sj]=subj[q.sj]||{c:0,w:0};s.c+=c;s.w+=w;}
    if(q.ch){const k=(q.sj||'')+'|'+q.ch,h=chap[k]=chap[k]||{n:q.ch,s:q.sj||'',c:0,w:0};h.c+=c;h.w+=w;}});
  const sc={Physics:'#f59e0b',Chemistry:'#0ea5e9',Biology:'#10b981',Botany:'#22c55e',Zoology:'#ec4899'};
  const subRows=Object.entries(subj).map(([n,v])=>({n,p:Math.round(v.c/(v.c+v.w)*100),t:v.c+v.w})).sort((a,b)=>b.t-a.t);
  const subHtml=subRows.length?subRows.map(r=>`<div class="st-row"><span>${escapeHtml(r.n)}</span><div class="st-bar"><i style="width:${r.p}%;background:${sc[r.n]||'#14b8a6'}"></i></div><b>${r.p}%</b></div>`).join(''):'<div class="st-empty">Practice a few chapters to unlock subject analysis.</div>';
  const chs=Object.values(chap).filter(h=>h.c+h.w>=3).map(h=>({...h,p:(window.EP&&EP.mastery?EP.mastery.pct(h.s,h.n,Math.round(h.c/(h.c+h.w)*100)):Math.round(h.c/(h.c+h.w)*100))}));
  const row=h=>`<button type="button" class="st-row st-chapter-link" title="Practise ${escapeHtml(h.n)}" onclick="openPracticeSetup('${jsArg(['Botany','Zoology'].includes(h.s)?'Biology':(h.s||'Biology'))}','${jsArg(h.n)}')"><span>${escapeHtml(h.n)}</span><div class="st-bar"><i style="width:${h.p}%;background:${h.p>=70?'#10b981':h.p>=45?'#f59e0b':'#ef4444'}"></i></div><b>${h.p}%</b><small>Practise</small></button>`;
  const weak=[...chs].sort((a,b)=>a.p-b.p).slice(0,4),strong=[...chs].sort((a,b)=>b.p-a.p).slice(0,3).filter(h=>h.p>=60);
  const chHtml=chs.length?`<p class="st-lbl" style="margin-top:10px;color:#ef4444">Needs work · by chapter mastery</p>${weak.map(row).join('')}${strong.length?`<p class="st-lbl" style="margin-top:16px;color:#10b981">Strongest</p>${strong.map(row).join('')}`:''}`:'<div class="st-empty">Answer 3+ questions in a chapter to see strengths &amp; weak spots.</div>';
  /* heatmap: 14 weeks */
  const WK=14,end=new Date(),start=new Date(end.getTime()-(WK*7-1)*864e5),pad=start.getDay();let cells='<i style="visibility:hidden"></i>'.repeat(pad),active=0;
  for(let d=0;d<WK*7-pad+pad&&d<WK*7;d++){const dt=new Date(start.getTime()+d*864e5),k=dt.toISOString().slice(0,10),n=counts[k]||0;if(n)active++;
    cells+=`<i class="${n>=50?'l4':n>=25?'l3':n>=10?'l2':n>0?'l1':''}" title="${k}: ${n} questions"></i>`;}
  /* insights */
  const ins=[];
  if(wr>0)ins.push(['fa-triangle-exclamation','#f59e0b',`Wrong answers cost you <b>${lost} marks</b>. Skipping unsure questions would have saved them.`]);
  if(subRows.length>1){const w=[...subRows].sort((a,b)=>a.p-b.p)[0];ins.push(['fa-bullseye','#ef4444',`<b>${escapeHtml(w.n)}</b> is your weakest subject at ${w.p}% accuracy — prioritise it this week.`]);}
  if(pcts.length>=4){const a=sum(pcts.slice(0,3),x=>x)/3,b=sum(pcts.slice(3,6),x=>x)/Math.max(1,pcts.slice(3,6).length),d=Math.round(a-b);ins.push([d>=0?'fa-arrow-trend-up':'fa-arrow-trend-down',d>=0?'#10b981':'#ef4444',`Your last 3 tests are <b>${Math.abs(d)}% ${d>=0?'higher':'lower'}</b> than the 3 before.`]);}
  if(sk>att*0.25&&att>0)ins.push(['fa-forward','#0ea5e9',`You skipped ${sk} questions — attempt more where you can eliminate 2 options.`]);
  if(!ins.length)ins.push(['fa-lightbulb','#14b8a6','Complete a few tests and your personalised insights will appear here.']);
  const insHtml=ins.map(i=>`<p><i class="fa-solid ${i[0]}" style="color:${i[1]}"></i><span>${i[2]}</span></p>`).join('');
  /* history (AI feedback button unchanged) */
  const hist=at.length?`<div style="display:flex;flex-direction:column;gap:10px;max-height:460px;overflow-y:auto;padding-right:4px;margin-top:14px">${at.map(a=>{const p=a.maxScore>0?Math.max(0,Math.round(a.score/a.maxScore*100)):0,col=p>=70?'#10b981':p>=40?'#f59e0b':'#ef4444';
    return `<div class="st-att"><div style="min-width:0"><h4 style="font-weight:800;font-size:13.5px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis">${escapeHtml(a.chapter)}</h4><p style="font-size:11px;color:var(--text-muted);margin-top:3px"><span class="st-badge">${escapeHtml(a.mode||'test')}</span>${escapeHtml(a.subject||'')} • ${new Date(a.finishedAt).toLocaleDateString()} ${new Date(a.finishedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</p><div class="st-bar" style="margin-top:9px;max-width:260px"><i style="width:${a.total?(a.correct/a.total*100):0}%;background:#10b981"></i><i style="width:${a.total?(a.wrong/a.total*100):0}%;background:#ef4444"></i><i style="width:${a.total?(a.skipped/a.total*100):0}%;background:#94a3b8"></i></div></div><div style="display:flex;align-items:center;gap:12px;text-align:right;flex:none"><div><b style="display:block;font-size:16px;font-weight:900;color:${col};font-variant-numeric:tabular-nums">${a.score}<span style="font-size:11px;color:var(--text-muted)">/${a.maxScore}</span></b><span style="font-size:11px;font-weight:800;color:var(--text-muted)">${a.accuracy||0}% acc · ${a.correct||0}✓ ${a.wrong||0}✗</span></div><button onclick="generateAiTestPerformanceFeedback(${JSON.stringify(a).replace(/"/g,'&quot;')})" class="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 transition text-xs font-bold" title="AI Feedback"><i class="fa-solid fa-wand-magic-sparkles"></i></button></div></div>`;}).join('')}</div>`:'<div class="st-empty">No attempts in this period. Take a test from the Test Hub!</div>';
  const pill=(v,l)=>`<button class="${range===v?'on':''}" onclick="window.__statsRange='${v}';renderView()">${l}</button>`;
  return `<div class="st">
  <div class="st-head"><div><h2>Performance Analytics</h2><p>Completed tests in this date range · +${mc} / −${mw} marking. Practice-question insights are shown separately.</p></div><div class="st-pills">${pill('7','7 days')}${pill('30','30 days')}${pill('all','All time')}</div></div>
  <div class="st-grid st-k4">
    <div class="st-c st-hero"><span class="st-lbl">Test-score estimate</span><div class="st-big" style="margin-top:10px">${at.length?projected:'—'}<sub>/ 720</sub></div><span class="st-band">${band}</span><small class="st-sub" style="display:block;margin-top:8px">Simple average of ${at.length} completed test${at.length===1?'':'s'} in this date range; not a prediction. Practice-only sessions are excluded.</small></div>
    <div class="st-c st-kpi"><div><span class="st-lbl">Avg test score</span><div class="st-big" style="margin-top:10px">${avgPct}<sub>%</sub></div><div class="st-sub">${best?`Best ${best.score}/${best.maxScore}`:'No tests yet'}</div></div>${ring(avgPct,'#14b8a6')}</div>
    <div class="st-c st-kpi"><div><span class="st-lbl">Accuracy</span><div class="st-big" style="margin-top:10px">${acc}<sub>%</sub></div><div class="st-sub">${cor} right · ${wr} wrong</div></div>${ring(acc,'#10b981')}</div>
    <div class="st-c st-kpi"><div><span class="st-lbl">Day streak</span><div class="st-big" style="margin-top:10px">${streak.current||0}<sub>days</sub></div><div class="st-sub">Best ${streak.best||0} · ${att} solved</div></div><span style="font-size:34px">🔥</span></div>
  </div>
  <div class="st-grid st-g2">
    <div class="st-c"><h3>Marks breakdown <small>${at.length} test${at.length===1?'':'s'}</small></h3>
      <div class="st-marks"><div><b style="color:#10b981">+${gained}</b><span>Gained</span></div><div><b style="color:#ef4444">−${lost}</b><span>Lost</span></div><div><b>${net}</b><span>Net marks</span></div></div>
      <div class="st-bar" style="margin-top:16px"><i style="width:${att+sk?cor/(att+sk)*100:0}%;background:#10b981"></i><i style="width:${att+sk?wr/(att+sk)*100:0}%;background:#ef4444"></i><i style="width:${att+sk?sk/(att+sk)*100:0}%;background:#94a3b8"></i></div>
      <div class="st-legend"><span><i style="background:#10b981"></i>Correct ${cor}</span><span><i style="background:#ef4444"></i>Wrong ${wr}</span><span><i style="background:#94a3b8"></i>Skipped ${sk}</span></div></div>
    <div class="st-c"><h3>Score trend <small>last ${last.length||0} tests · % of max marks</small></h3>${trend}</div>
  </div>
  <div class="st-grid st-g2">
    <div class="st-c"><h3>Subject-wise accuracy <small>all-time</small></h3>${subHtml}</div>
    <div class="st-c"><h3>Chapter strengths &amp; weak spots <small>all-time</small></h3>${chHtml}</div>
  </div>
  <div class="st-grid st-g2">
    <div class="st-c"><h3>Study consistency <small>${active} active day${active===1?'':'s'} · 14 weeks</small></h3><div class="st-heat">${cells}</div></div>
    <div class="st-c"><h3>Smart insights</h3><div class="st-ins">${insHtml}</div></div>
  </div>
  <div class="st-c"><h3>Test attempt history <small>${at.length} in range</small></h3>${hist}</div>
  </div>`;
}

;

/* tooltips + aria-labels for the icon-only tool buttons */
(function(){
  function label(){
    document.querySelectorAll('#normal-practice-toolkit .tk-quick button').forEach(function(b){
      var t=(b.textContent||'').replace(/\s+/g,' ').trim();
      if(t&&!b.title) b.title=t; if(t&&!b.getAttribute('aria-label')) b.setAttribute('aria-label',t);
    });
    var s=document.querySelector('#normal-practice-toolkit details > summary'); if(s&&!s.title) s.title='More tools';
  }
  var timer; new MutationObserver(function(){clearTimeout(timer);timer=setTimeout(label,80);}).observe(document.body,{childList:true,subtree:true});
})();

