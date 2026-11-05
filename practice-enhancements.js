(() => {
  'use strict';

  const STREAK_MILESTONES = new Set([3, 5, 10, 20, 30, 50]);
  const FEATURES = [
    ['Quick 10', 'Start a compact mixed practice drill.', 'fa-bolt', 'quick-ten'],
    ['AI adaptive drill', 'Launch a dynamically adjusted question session.', 'fa-wand-magic-sparkles', 'adaptive'],
    ['AI question maker', 'Generate a fresh question set from any topic.', 'fa-robot', 'ai-generator'],
    ['Retry mistakes', 'Focus on questions missed in the current session.', 'fa-rotate', 'retry'],
    ['Mistake notebook', 'Review your saved error-notebook entries.', 'fa-book-open', 'notebook'],
    ['Focus timer', 'Open the Pomodoro focus timer.', 'fa-stopwatch', 'focus'],
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
        <div class="space-y-3">${questions.map((q, i) => `<article class="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><p class="text-[10px] font-black uppercase text-teal-600">Question ${i + 1}</p><p class="mt-1 text-xs font-bold">${escapeHtml(q.question)}</p><p class="mt-2 text-[10px] text-slate-500">${q.options.map((o, oi) => `${String.fromCharCode(65 + oi)}. ${escapeHtml(o)}`).join('<br>')}</p><p class="mt-2 text-[10px] font-bold text-emerald-600">Answer: ${String.fromCharCode(65 + q.correct)} · ${escapeHtml(q.explanation)}</p></article>`).join('')}</div>
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
      case 'focus': return switchTab('tools');
      case 'planner': return switchTab('tools');
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

  function renderDashboardFeatures() {
    const main = document.getElementById('main-container');
    const hero = main?.querySelector('.executive-hero');
    const existing = main?.querySelector('#edupulse-dashboard-features');
    if (existing) existing.remove();
    if (!main || !hero) return;
  }

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
  installTestStreakTracking();
  renderDashboardFeatures();
  const observer = new MutationObserver(() => {
    installTestStreakTracking();
    renderDashboardFeatures();
  });
  const main = document.getElementById('main-container');
  if (main) observer.observe(main, { childList: true, subtree: true });

  let attempts = 0;
  const retry = setInterval(() => {
    installTestStreakTracking();
    renderDashboardFeatures();
    if (++attempts >= 80 || window.selectTestOption?.__testStreakWrapped) clearInterval(retry);
  }, 100);

  document.addEventListener('click', (event) => {
    const moreButton = event.target.closest('#normal-practice-toolkit [data-action="more"]');
    if (!moreButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    questionGeneratorModal(currentQuestion());
  }, true);
})();
