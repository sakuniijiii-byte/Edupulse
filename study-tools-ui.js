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
    if (summary) {
      summary.innerHTML = '<i class="fa-solid fa-toolbox mr-2"></i><span>Study tools</span><span class="ml-auto rounded-full bg-teal-600/10 px-2 py-1 text-[9px] font-black text-teal-700 dark:text-teal-300">12 helpers</span>';
      summary.classList.add('flex', 'items-center', 'gap-1');
    }

    const actionGrid = panel.querySelector('details [data-action]')?.parentElement;
    if (actionGrid) {
      actionGrid.className = 'mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2';
      panel.querySelectorAll('[data-action]').forEach((button) => {
        const action = button.dataset.action;
        const config = ACTIONS[action];
        if (!config) return;
        const [iconName, label, color] = config;
        const isBookmarked = action === 'bookmark' && /unbookmark/i.test(button.textContent);
        button.type = 'button';
        button.title = label;
        button.setAttribute('aria-label', isBookmarked ? 'Remove bookmark' : label);
        button.className = 'group flex min-h-11 items-center justify-start gap-2 rounded-xl border border-white/10 px-3 py-2 text-left text-[10px] font-extrabold shadow-sm transition hover:-translate-y-0.5 hover:brightness-110 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500';
        button.style.cssText = `${COLOR_STYLES[color]};width:100%`;
        button.innerHTML = `<i class="fa-solid ${iconName} w-4 shrink-0 text-center ${action === 'bookmark' && isBookmarked ? 'text-amber-200' : ''}" aria-hidden="true"></i><span>${isBookmarked ? 'Bookmarked' : label}</span>`;
      });
    }

    const confidence = panel.querySelector('[data-confidence]');
    if (confidence) {
      const label = confidence.closest('label');
      if (label) label.className = 'rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] font-extrabold text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300';
      confidence.className = 'mt-2 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900';
    }
    const note = panel.querySelector('[data-note]');
    if (note) {
      const label = note.closest('label');
      if (label) label.className = 'rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] font-extrabold text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300';
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
    const observer = new MutationObserver(enhanceToolkit);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
