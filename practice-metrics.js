(() => {
  'use strict';

  const STREAK_MILESTONES = new Set([3, 5, 10, 20, 30, 50]);
  let metrics = { answerOrder: [], correctStreak: 0, correct: 0, answered: 0 };

  function calculateFromAnswers(answers, questions, answerOrder = []) {
    const validOrder = answerOrder.filter((index, position) =>
      Number.isInteger(index) && answers[index] !== undefined && answerOrder.indexOf(index) === position
    );
    Object.keys(answers || {}).forEach((key) => {
      const index = Number(key);
      if (Number.isInteger(index) && answers[index] !== undefined && !validOrder.includes(index)) validOrder.push(index);
    });

    let correct = 0;
    let correctStreak = 0;
    validOrder.forEach((index) => {
      const question = questions[index];
      const isCorrect = !!question && answers[index] === question.correct;
      if (isCorrect) {
        correct++;
        correctStreak++;
      } else {
        correctStreak = 0;
      }
    });
    return { answerOrder: validOrder, correctStreak, correct, answered: validOrder.length };
  }

  function readSessionMetrics() {
    try {
      return JSON.parse(localStorage.getItem('edupulse_session_v1') || 'null')?.practiceMetrics || null;
    } catch (_) {
      return null;
    }
  }

  function saveMetrics() {
    try {
      const raw = localStorage.getItem('edupulse_session_v1');
      if (!raw) return;
      const session = JSON.parse(raw);
      session.practiceMetrics = { ...metrics };
      localStorage.setItem('edupulse_session_v1', JSON.stringify(session));
    } catch (error) {
      console.warn('[EduPulse] Could not save practice streak metrics:', error);
    }
  }

  function renderMetrics() {
    if (!window.quizState || quizState.mode !== 'practice' || quizState.infinite) return;
    const palette = document.querySelector('.palette-drawer-top');
    if (!palette) return;

    let panel = document.getElementById('normal-practice-metrics');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'normal-practice-metrics';
      panel.className = 'w-full grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-2xl border border-teal-200/70 dark:border-teal-900 bg-white dark:bg-slate-900 px-3 py-2 text-xs shadow-sm';
      palette.insertAdjacentElement('afterend', panel);
    }
    const accuracy = metrics.answered ? Math.round((metrics.correct / metrics.answered) * 100) : 0;
    panel.innerHTML = `
      <div class="flex items-center justify-center gap-1.5 font-extrabold text-emerald-700 dark:text-emerald-300" aria-live="polite">
        <i class="fa-solid fa-fire text-amber-500"></i><span>${metrics.correctStreak} correct streak</span>
      </div>
      <div class="flex items-center justify-center gap-1.5 font-extrabold text-teal-700 dark:text-teal-300" aria-live="polite">
        <i class="fa-solid fa-bullseye"></i><span>${accuracy}% accuracy</span>
      </div>
      <div class="hidden sm:flex items-center justify-center gap-1.5 font-bold text-slate-500 dark:text-slate-400">
        <i class="fa-solid fa-circle-check"></i><span>${metrics.correct}/${metrics.answered} correct</span>
      </div>`;
  }

  function restoreMetrics() {
    const saved = readSessionMetrics();
    metrics = saved && Array.isArray(saved.answerOrder)
      ? calculateFromAnswers(quizState.userAnswers || {}, quizState.questions || [], saved.answerOrder)
      : calculateFromAnswers(quizState.userAnswers || {}, quizState.questions || []);
  }

  function installWrapper(name, wrap) {
    const original = window[name];
    if (typeof original !== 'function' || original.__practiceMetricsWrapped) return;
    const replacement = wrap(original);
    replacement.__practiceMetricsWrapped = true;
    window[name] = replacement;
  }

  function install() {
    if (!window.quizState || typeof window.renderPracticeQuiz !== 'function') return false;

    installWrapper('launchPracticeSession', (original) => function (...args) {
      metrics = { answerOrder: [], correctStreak: 0, correct: 0, answered: 0 };
      const result = original.apply(this, args);
      saveMetrics();
      return result;
    });

    installWrapper('selectPracticeOption', (original) => function (optionIndex, ...args) {
      const index = quizState.currentIndex;
      const wasAnswered = quizState.userAnswers[index] !== undefined;
      const wasCorrect = wasAnswered && quizState.userAnswers[index] === quizState.questions[index]?.correct;
      const result = original.call(this, optionIndex, ...args);

      if (!wasAnswered && quizState.mode === 'practice' && !quizState.infinite) {
        const isCorrect = optionIndex === quizState.questions[index]?.correct;
        metrics.answerOrder.push(index);
        metrics.answered++;
        if (isCorrect) {
          metrics.correct++;
          metrics.correctStreak = wasCorrect ? metrics.correctStreak + 1 : metrics.correctStreak + 1;
          if (STREAK_MILESTONES.has(metrics.correctStreak)) {
            showToast(`🔥 ${metrics.correctStreak} correct answers in a row! Keep it up!`, 'success');
          }
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
      else document.getElementById('normal-practice-metrics')?.remove();
      return result;
    });

    ['resumeQuizSession', 'resumeSavedSession'].forEach((name) => {
      installWrapper(name, (original) => function (...args) {
        const result = original.apply(this, args);
        restoreMetrics();
        saveMetrics();
        renderMetrics();
        return result;
      });
    });

    installWrapper('persistQuizSession', (original) => function (...args) {
      const result = original.apply(this, args);
      if (quizState.mode === 'practice' && !quizState.infinite) saveMetrics();
      return result;
    });

    restoreMetrics();
    return true;
  }

  if (!install()) {
    let tries = 0;
    const retry = setInterval(() => {
      if (install() || ++tries >= 40) clearInterval(retry);
    }, 100);
  }
})();
