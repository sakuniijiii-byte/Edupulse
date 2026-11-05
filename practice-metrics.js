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
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs" aria-live="polite">
        <div class="flex items-center gap-1.5 font-extrabold text-emerald-700 dark:text-emerald-300"><i class="fa-solid fa-fire text-amber-500"></i>${metrics.correctStreak} correct streak ${streakMessage}</div>
        <div class="flex items-center gap-1.5 font-extrabold text-teal-700 dark:text-teal-300"><i class="fa-solid fa-bullseye"></i>${accuracy}% accuracy</div>
        <div class="font-bold text-slate-500 dark:text-slate-400">${metrics.correct}/${metrics.answered} correct</div>
      </div>
      <details class="mt-3 border-t border-slate-100 dark:border-slate-800 pt-2">
        <summary class="cursor-pointer select-none text-[11px] font-extrabold text-teal-700 dark:text-teal-300"><i class="fa-solid fa-toolbox mr-1"></i> Study toolkit · 20 practice helpers</summary>
        <div class="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button type="button" data-action="more" class="rounded-xl bg-teal-600 px-2 py-2 text-[10px] font-bold text-white">More like this</button>
          <button type="button" data-action="easier" class="rounded-xl bg-sky-600 px-2 py-2 text-[10px] font-bold text-white">Make easier</button>
          <button type="button" data-action="harder" class="rounded-xl bg-indigo-600 px-2 py-2 text-[10px] font-bold text-white">Make harder</button>
          <button type="button" data-action="mnemonic" class="rounded-xl bg-purple-600 px-2 py-2 text-[10px] font-bold text-white">Memory trick</button>
          <button type="button" data-action="explain" class="rounded-xl bg-violet-600 px-2 py-2 text-[10px] font-bold text-white">Explain simply</button>
          <button type="button" data-action="copy" class="rounded-xl bg-slate-700 px-2 py-2 text-[10px] font-bold text-white">Copy question</button>
          <button type="button" data-action="share" class="rounded-xl bg-slate-700 px-2 py-2 text-[10px] font-bold text-white">Share question</button>
          <button type="button" data-action="bookmark" class="rounded-xl bg-amber-500 px-2 py-2 text-[10px] font-bold text-white">${quizState.bookmarked?.[quizState.currentIndex] ? 'Unbookmark' : 'Bookmark'}</button>
          <button type="button" data-action="report" class="rounded-xl bg-rose-600 px-2 py-2 text-[10px] font-bold text-white">Report question</button>
          <button type="button" data-action="focus" class="rounded-xl bg-emerald-700 px-2 py-2 text-[10px] font-bold text-white">25-min focus</button>
          <button type="button" data-action="reveal" class="rounded-xl bg-slate-600 px-2 py-2 text-[10px] font-bold text-white">Show answer</button>
          <button type="button" data-action="retry" class="rounded-xl bg-rose-700 px-2 py-2 text-[10px] font-bold text-white">Retry mistakes</button>
        </div>
        <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="text-[10px] font-bold text-slate-500">Confidence before answer
            <select data-confidence class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-800">
              <option value="0">Not rated</option><option value="1" ${confidenceValue === 1 ? 'selected' : ''}>1 · Guessing</option><option value="2" ${confidenceValue === 2 ? 'selected' : ''}>2 · Unsure</option><option value="3" ${confidenceValue === 3 ? 'selected' : ''}>3 · Fairly sure</option><option value="4" ${confidenceValue === 4 ? 'selected' : ''}>4 · Confident</option><option value="5" ${confidenceValue === 5 ? 'selected' : ''}>5 · Certain</option>
            </select>
          </label>
          <label class="text-[10px] font-bold text-slate-500">Private revision note
            <textarea data-note rows="2" placeholder="Add a reminder for next time..." class="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-800">${escapeHtml(note)}</textarea>
          </label>
        </div>
        <p class="mt-2 text-[9px] leading-relaxed text-slate-400">Also available in practice: question palette, answer reveal/explanation, option elimination, skip/review flags, bookmarks, session resume, mistake notebook, retry missed questions, practice again, AI deep-dive, video search, answer timing, shuffled questions/options, unseen/wrong/bookmarked filters, session accuracy, daily goal, keyboard shortcuts, and adaptive drills.</p>
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
    setModal(title, body, `<div class="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-4 text-sm leading-relaxed">${multiline(text)}</div>`, `<button onclick="closeModal()" class="rounded-xl bg-slate-100 px-5 py-2 text-xs font-bold dark:bg-slate-800">Close</button>`);
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
      const answer = await callGeminiApi(prompt, 'Be concise, accurate, encouraging, and grounded in NCERT.');
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
    if (action === 'copy') return copyText(text, 'Question');
    if (action === 'share') {
      if (navigator.share) navigator.share({ title: quizState.title || 'EduPulse question', text }).catch(() => {});
      else copyText(text, 'Question');
      return;
    }
    if (action === 'bookmark') {
      const index = quizState.currentIndex;
      quizState.bookmarked[index] = !quizState.bookmarked[index];
      const stats = StorageModule.get(STORAGE_KEYS.qstats, {});
      const key = q.qKey || `${quizState.chapter}:${index}`;
      stats[key] = { ...(stats[key] || {}), bookmarked: quizState.bookmarked[index] };
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
