
(function initEduPulseV2() {
  // =========================================================================
  // 1. STORAGE KEYS & DEFAULT PROFILE (Onboarding + Supabase + Social)
  // =========================================================================
  const V2_KEYS = {
    profile: 'edupulse_aspirant_profile_v1',
    subtopicStats: 'edupulse_subtopic_stats_v1',
    supabaseCfg: 'edupulse_supabase_cfg_v1',
    socialFriends: 'edupulse_social_friends_v1',
    challenges: 'edupulse_challenges_v1',
    focusLock: 'edupulse_focus_lock_v1'
  };

  const defaultProfile = {
    onboarded: false,
    name: 'Aspirant',
    examYear: '2027',
    targetScore: 680,
    dailyHours: 8,
    dailyGoalQuestions: 60
  };

  // =========================================================================
  // 2. FIRST-RUN ONBOARDING (Exam Year, Target Score, Daily Hours)
  // =========================================================================
  window.getAspirantProfile = () => StorageModule.get(V2_KEYS.profile, defaultProfile);

  window.openOnboardingModal = function(force = false) {
    const prof = getAspirantProfile();
    if (prof.onboarded && !force) return;

    setModal(
      'Welcome to EduPulse PRO',
      'Personalize your NEET roadmap, daily targets, and rank predictor.',
      `<div class="space-y-4 py-2 text-xs">
        <div>
          <label class="block font-bold mb-1">Your Name / Callsign</label>
          <input id="ob-name" type="text" value="${escapeHtml(prof.name)}" placeholder="e.g., Ansh" class="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold">
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block font-bold mb-1">Target NEET Year</label>
            <select id="ob-year" class="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold">
              ${['2026', '2027', '2028'].map(y => `<option value="${y}" ${prof.examYear === y ? 'selected' : ''}>NEET ${y}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block font-bold mb-1">Target Score (/720)</label>
            <input id="ob-score" type="number" min="400" max="720" step="5" value="${prof.targetScore}" class="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold">
          </div>
          <div>
            <label class="block font-bold mb-1">Daily Study Hours</label>
            <input id="ob-hours" type="number" min="1" max="16" step="0.5" value="${prof.dailyHours}" class="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold">
          </div>
        </div>
        <div class="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-300 font-semibold">
          <i class="fa-solid fa-wand-magic-sparkles mr-1.5"></i>
          Auto-calculates a daily target of <strong id="ob-q-preview">${Math.round(prof.dailyHours * 12)} MCQs/day</strong> to hit <strong>${prof.targetScore}+</strong>.
        </div>
      </div>`,
      `<button type="button" onclick="saveOnboardingProfile()" class="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs shadow-md">Launch My Today Plan</button>`
    );

    const hrsEl = document.getElementById('ob-hours');
    const scrEl = document.getElementById('ob-score');
    const updatePrev = () => {
      const h = Number(hrsEl?.value) || 6;
      const s = Number(scrEl?.value) || 650;
      const prev = document.getElementById('ob-q-preview');
      if (prev) prev.parentElement.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles mr-1.5"></i> Auto-calculates a daily target of <strong>${Math.round(h * 12)} MCQs/day</strong> to hit <strong>${s}+</strong>.`;
    };
    hrsEl?.addEventListener('input', updatePrev);
    scrEl?.addEventListener('input', updatePrev);
  };

  window.saveOnboardingProfile = function() {
    const name = (document.getElementById('ob-name')?.value || 'Aspirant').trim();
    const examYear = document.getElementById('ob-year')?.value || '2027';
    const targetScore = Math.min(720, Math.max(300, Number(document.getElementById('ob-score')?.value) || 680));
    const dailyHours = Math.min(18, Math.max(1, Number(document.getElementById('ob-hours')?.value) || 8));
    const dailyGoalQuestions = Math.round(dailyHours * 12);

    StorageModule.set(V2_KEYS.profile, {
      onboarded: true, name, examYear, targetScore, dailyHours, dailyGoalQuestions
    });
    localStorage.setItem(DAILY_GOAL_KEY, String(dailyGoalQuestions));

    const dateEl = document.getElementById('current-date');
    if (dateEl) dateEl.textContent = `Padhai ki dhadkan · NEET ${examYear} · Target ${targetScore}`;
    const h1El = document.querySelector('.topbar h1.hidden');
    if (h1El) h1El.innerHTML = `Welcome, ${escapeHtml(name)}<span style="color:#0d9488">.</span>`;

    closeModal();
    if (typeof renderView === 'function') renderView();
    showToast(`Profile calibrated for NEET ${examYear} (${targetScore}+)!`, 'success');
  };

  // =========================================================================
  // 3. SUBTOPIC-LEVEL WEAK TOPIC DETECTION (Concept, NCERT Line, Difficulty)
  // =========================================================================
  
  
  // =========================================================================
  // 4. "WHY I GOT IT WRONG" TAGGER -> FEEDS FOCUS & PLANNER AUTOMATICALLY
  // =========================================================================
  const MISTAKE_TYPES = [
    { id: 'concept', label: 'Concept Gap', icon: 'fa-brain', action: 'Revise NCERT theory & solve 10 foundation MCQs' },
    { id: 'calculation', label: 'Calculation Error', icon: 'fa-calculator', action: 'Drill 5 numericals with step-by-step unit checks' },
    { id: 'misread', label: 'Misread Question', icon: 'fa-eye-slash', action: 'Practice highlighting NOT / INCORRECT keywords' },
    { id: 'guess', label: 'Blind Guess', icon: 'fa-dice', action: 'Review elimination rules before attempting' }
  ];

  
  
  // =========================================================================
  // 5. NCERT LINE-LINKED EXPLANATIONS (Exact Page & Line Extractor)
  // =========================================================================
  
  // =========================================================================
  // 6. SHARED AI EXPLANATION CACHE IN SUPABASE (Pay Once, All Students Benefit)
  // =========================================================================
  
  
  async function fetchSharedAiExplanation(questionId) {
    const cfg = StorageModule.get(V2_KEYS.supabaseCfg, {});
    if (!cfg.enabled || !cfg.url || !cfg.anonKey || !questionId) return null;
    try {
      const res = await fetch(`${cfg.url}/rest/v1/ai_explanations?question_id=eq.${encodeURIComponent(questionId)}&select=explanation`, {
        headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` }
      });
      if (!res.ok) return null;
      const rows = await res.json();
      return rows?.[0]?.explanation || null;
    } catch (_) { return null; }
  }

  async function saveSharedAiExplanation(questionId, explanation, ncertRef = '') {
    const cfg = StorageModule.get(V2_KEYS.supabaseCfg, {});
    if (!cfg.enabled || !cfg.url || !cfg.anonKey || !questionId || !explanation) return;
    try {
      await fetch(`${cfg.url}/rest/v1/ai_explanations`, {
        method: 'POST',
        headers: {
          apikey: cfg.anonKey,
          Authorization: `Bearer ${cfg.anonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates'
        },
        body: JSON.stringify({ question_id: questionId, explanation, ncert_ref: ncertRef })
      });
    } catch (_) {}
  }

  // Wrap callGeminiApi transparently when caching question explanations
  const _origShowAiExplanation = window.showAiQuestionExplanation;
  window.showAiQuestionExplanation = async function(qIndex) {
    const q = quizState.questions[qIndex];
    if (!q) return;
    const qId = q.qKey || simpleHash(q.question || '');
    const localCache = StorageModule.get('edupulse_ai_explanations_v2', {});
    const localKey = `${qId}:shared`;

    if (!localCache[localKey]) {
      const remoteHit = await fetchSharedAiExplanation(qId);
      if (remoteHit) {
        localCache[localKey] = remoteHit;
        StorageModule.set('edupulse_ai_explanations_v2', localCache);
        showToast('Loaded from shared student AI cache ⚡', 'success');
      }
    }
    await _origShowAiExplanation(qIndex);

    // Sync newly generated explanation back to Supabase for other students
    const updatedCache = StorageModule.get('edupulse_ai_explanations_v2', {});
    const newestEntry = Object.entries(updatedCache).find(([k]) => k.startsWith(qId));
    if (newestEntry) {
      saveSharedAiExplanation(qId, newestEntry[1], q.ncertLine || '');
    }
  };

  // =========================================================================
  // 7. POST-TEST DEEP ANALYSIS (Time/Q, Guess vs Sure, Silly vs Concept, Rank %ile)
  // =========================================================================
  
  
  // =========================================================================
  // 8. DISTRACTION-FREE PRACTICE LOCK
  // =========================================================================
  
  // =========================================================================
  // 9. BETTER EMPTY, ERROR & LOADING STATES WITH SKELETONS + RETRY BUTTON
  // =========================================================================
  
  
  // =========================================================================
  // 10. SHAREABLE SOCIAL HUB: WEEKLY LEADERBOARD, STREAK CARD & CHALLENGES
  // =========================================================================
  
  
  
  // =========================================================================
  // 11. HOOK INTO PRACTICE RENDERER & CHECK INCOMING CHALLENGE URL
  // =========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    // Default distraction-free lock ON when practicing
    if (StorageModule.get(V2_KEYS.focusLock, true)) {
      document.body.classList.add('ep-focus-locked');
    }

    // Check incoming ?challenge= link from a friend
    const params = new URLSearchParams(location.search);
    const chParam = params.get('challenge');
    if (chParam) {
      try {
        const dataCh = JSON.parse(decodeURIComponent(escape(atob(chParam))));
        showToast(`${dataCh.from} challenged you in ${dataCh.c}!`, 'info');
        setTimeout(() => openPracticeSetup(dataCh.s, dataCh.c, { length: 15 }), 600);
      } catch (_) {}
    } else {
      // Trigger first-run onboarding if never completed
      setTimeout(() => openOnboardingModal(false), 450);
    }
  });
})();

;

/* v10 speed layer: coalesce page-wide MutationObservers and ignore the practice screen's own DOM */
(function(){var N=window.MutationObserver;if(!N||N.__ep)return;
function inPQ(r){var t=r.target;t=t&&t.nodeType===1?t:t&&t.parentElement;return !!(t&&t.closest&&t.closest('#epq'));}
function W(cb){var q=[],tm=0,self;
 function flush(){tm=0;var r=q;q=[];if(r.length)try{cb.call(self,r,self)}catch(e){console.error(e)}}
 self=new N(function(recs){
  var live=document.body&&document.body.classList.contains('ep-practicing');
  if(live){recs=recs.filter(function(r){return !inPQ(r)});if(!recs.length)return;q=q.concat(recs);if(!tm)tm=setTimeout(flush,500);}
  else{if(q.length){recs=q.concat(recs);q=[];}try{cb.call(self,recs,self)}catch(e){console.error(e)}}
 });return self;}
W.prototype=N.prototype;W.__ep=1;window.MutationObserver=W;})();

;

/* Progress lives in Supabase (table ep_progress), not on the device. Signed in: progress keys are served from memory and written through, one row per changed key. Signed out: unchanged localStorage behaviour. */
(function(){
var P=Storage.prototype,gi=P.getItem,si=P.setItem,ri=P.removeItem,gk=P.key,nl=Object.getOwnPropertyDescriptor(P,'length').get,ls=window.localStorage,
SKIP=/^edupulse_(gemini_key_v1|gemini_model|supabase_cfg_v1|sync_meta_v1|theme|fs|autonext|minimal_mode|selftest_\w+|ai_explanations_v2|chat_v1|session_v1|dashboard_layout_v5|dashboard_appearance_v2|share_prefs_v1|ncert_reader_v1)$/,
M={},D={},on=false,uid='',base='',anon='',tmr=0,busy=null,clean=[];
function isP(k){return typeof k==='string'&&k.indexOf('edupulse_')===0&&!SKIP.test(k);}
function nkeys(){var a=[],n=nl.call(ls),i;for(i=0;i<n;i++)a.push(gk.call(ls,i));return a;}
function tok(){try{var ks=nkeys(),i,v;for(i=0;i<ks.length;i++)if(/^sb-.+-auth-token$/.test(ks[i])){v=JSON.parse(gi.call(ls,ks[i])||'null');v=v&&(v.currentSession||v);if(v&&v.access_token&&v.user)return{t:v.access_token,u:v.user.id,e:v.expires_at||0};}}catch(e){}return null;}
function enc(s){try{return JSON.parse(s);}catch(e){return{$s:s};}}
function dec(v){return v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===1&&typeof v.$s==='string'?v.$s:JSON.stringify(v);}
function empty(s){return s==='[]'||s==='{}'||s==='null'||s==='""';}
function xg(u,h){var x=new XMLHttpRequest();x.open('GET',u,false);for(var k in h)x.setRequestHeader(k,h[k]);x.send();return x;}
function chk(r){if(!r.ok)throw new Error('cloud '+r.status);}
function sched(ms){if(!tmr)tmr=setTimeout(function(){tmr=0;flush();},ms||1500);}
function boot(){
  var t=tok();if(!t||t.e*1000<Date.now()+15000)return;
  try{
    var c=xg('/api/supabase-config',{Accept:'application/json'});if(c.status!==200)return;
    c=JSON.parse(c.responseText);base=new URL(c.url).origin;anon=c.anonKey;
    var r=xg(base+'/rest/v1/ep_progress?select=k,v&user_id=eq.'+t.u,{apikey:anon,Authorization:'Bearer '+t.t});
    if(r.status!==200)return;
    JSON.parse(r.responseText).forEach(function(x){M[x.k]=dec(x.v);});
    uid=t.u;
    nkeys().forEach(function(k){if(!isP(k))return;var v=gi.call(ls,k);if(!(k in M)&&!empty(v)){M[k]=v;D[k]=1;}clean.push(k);});
    on=true;try{sessionStorage.removeItem('ep_cs_try');}catch(e){}
    if(Object.keys(D).length||clean.length)sched(300);
  }catch(e){console.warn('[EduPulse] cloud progress unavailable, using device storage',e);}
}
function flush(keep){
  clearTimeout(tmr);tmr=0;if(!on)return Promise.resolve();
  if(busy)return busy.then(function(){return flush(keep);});
  var t=tok(),ks=Object.keys(D),up=[],del=[];
  if(!ks.length){clean.forEach(function(k){ri.call(ls,k);});clean=[];return Promise.resolve();}
  if(!t)return Promise.resolve();
  D={};
  ks.forEach(function(k){if(k in M&&!empty(M[k]))up.push({user_id:uid,k:k,v:enc(M[k])});else del.push(k);});
  var h={apikey:anon,Authorization:'Bearer '+t.t,'Content-Type':'application/json'},body=JSON.stringify(up),ka=!!keep&&body.length<60000,p=Promise.resolve();
  if(up.length)p=p.then(function(){return fetch(base+'/rest/v1/ep_progress?on_conflict=user_id,k',{method:'POST',headers:Object.assign({Prefer:'resolution=merge-duplicates,return=minimal'},h),body:body,keepalive:ka});}).then(chk);
  if(del.length)p=p.then(function(){return fetch(base+'/rest/v1/ep_progress?user_id=eq.'+uid+'&k=in.('+del.map(function(k){return'"'+k+'"';}).join(',')+')',{method:'DELETE',headers:h,keepalive:!!keep});}).then(chk);
  busy=p.then(function(){clean.forEach(function(k){ri.call(ls,k);});clean=[];},function(e){ks.forEach(function(k){D[k]=1;});sched(8000);console.warn('[EduPulse] progress save failed, will retry',e);}).then(function(){busy=null;});
  return busy;
}
function vkeys(){var a=nkeys();return on?a.filter(function(k){return!isP(k);}).concat(Object.keys(M)):a;}
P.getItem=function(k){if(this===ls&&on&&isP(k))return k in M?M[k]:null;return gi.apply(this,arguments);};
P.setItem=function(k,v){if(this===ls&&on&&isP(k)){v=String(v);if(M[k]===v)return;M[k]=v;D[k]=1;sched();return;}return si.apply(this,arguments);};
P.removeItem=function(k){if(this===ls&&on&&isP(k)){if(k in M){delete M[k];D[k]=1;sched();}return;}return ri.apply(this,arguments);};
P.key=function(i){if(this===ls&&on){var a=vkeys();return i<a.length?a[i]:null;}return gk.apply(this,arguments);};
Object.defineProperty(P,'length',{configurable:true,get:function(){return this===ls&&on?vkeys().length:nl.call(this);}});
boot();
window.addEventListener('pagehide',function(){flush(true);});
document.addEventListener('visibilitychange',function(){if(document.hidden)flush(true);});
window.addEventListener('online',function(){flush();});
window.__epCloudStore={
  get on(){return on;},
  flush:function(){return flush();},
  /* called after login: a reload lets boot() hydrate from the cloud before any module reads storage (tried once per tab) */
  attach:function(){if(on)return false;try{if(sessionStorage.getItem('ep_cs_try'))return false;sessionStorage.setItem('ep_cs_try','1');}catch(e){return false;}location.reload();return true;},
  off:function(){on=false;M={};D={};clean=[];location.reload();}
};
})();

;

/* In-app sheet dialogs: replaces window.confirm / window.prompt. Promise based, keyboard and screen-reader friendly.
   epAsk.confirm(message, {title, ok, cancel, danger}) -> Promise<boolean>
   epAsk.prompt(message, {value, placeholder, ok, type, title}) -> Promise<string|null>
   epAsk.choose(message, [{value,label}], {title}) -> Promise<value|null> */
(function(){
  var css='#ep-ask{position:fixed;inset:0;z-index:2147483200;display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .18s}'+
  '#ep-ask.open{opacity:1}#ep-ask .bd{position:absolute;inset:0;background:rgba(3,7,18,.6);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}'+
  '#ep-ask .sh{position:relative;width:min(460px,100%);background:var(--card-bg,#fff);color:var(--text-primary,#0f172a);border-radius:24px 24px 0 0;padding:20px 20px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -16px 60px rgba(0,0,0,.4);transform:translateY(20px);transition:transform .22s cubic-bezier(.2,.8,.2,1);font-family:inherit}'+
  '#ep-ask.open .sh{transform:none}#ep-ask h3{margin:0 0 6px;font-size:1.05rem;font-weight:800}#ep-ask p{margin:0 0 14px;font-size:.9rem;line-height:1.5;color:var(--text-muted,#475569)}'+
  '#ep-ask input{width:100%;box-sizing:border-box;min-height:46px;padding:10px 14px;margin-bottom:14px;border-radius:14px;border:2px solid var(--border-color,#cbd5e1);background:transparent;color:inherit;font:inherit;font-size:1rem}'+
  '#ep-ask input:focus{outline:none;border-color:#14b8a6}#ep-ask .row{display:flex;gap:10px}#ep-ask .opts{display:grid;gap:8px;margin-bottom:12px}'+
  '#ep-ask button{flex:1;min-height:48px;padding:10px 14px;border-radius:14px;border:2px solid var(--border-color,#cbd5e1);background:transparent;color:inherit;font:inherit;font-size:.95rem;font-weight:800;cursor:pointer}'+
  '#ep-ask button.pri{border-color:transparent;background:linear-gradient(135deg,#0d9488,#4f46e5);color:#fff}#ep-ask button.danger{border-color:transparent;background:#dc2626;color:#fff}'+
  '#ep-ask button:focus-visible{outline:3px solid #14b8a6;outline-offset:2px}@media (min-width:640px){#ep-ask{align-items:center}#ep-ask .sh{border-radius:24px}}@media (prefers-reduced-motion:reduce){#ep-ask,#ep-ask .sh{transition:none}}';
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function open(build){
    return new Promise(function(resolve){
      if(!document.getElementById('ep-ask-css')){var st=document.createElement('style');st.id='ep-ask-css';st.textContent=css;document.head.appendChild(st)}
      var old=document.getElementById('ep-ask');if(old)old.remove();
      var prev=document.activeElement,o=document.createElement('div');o.id='ep-ask';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');
      var done=false;function close(v){if(done)return;done=true;document.removeEventListener('keydown',key,true);o.classList.remove('open');setTimeout(function(){o.remove()},180);try{prev&&prev.focus&&prev.focus()}catch(e){}resolve(v)}
      var api=build(o,close);o.innerHTML='<div class="bd" data-k="x"></div><div class="sh">'+api.html+'</div>';
      function key(e){if(e.key==='Escape'){e.stopPropagation();close(api.cancel)}else if(e.key==='Enter'&&api.enter&&e.target.tagName!=='BUTTON'){e.preventDefault();api.enter()}}
      o.addEventListener('click',function(e){var k=e.target.getAttribute&&e.target.getAttribute('data-k');if(!k)return;if(k==='x')close(api.cancel);else api.act(k,e.target)});
      document.addEventListener('keydown',key,true);document.body.appendChild(o);
      requestAnimationFrame(function(){o.classList.add('open');var f=o.querySelector('input')||o.querySelector('.pri,.danger,button');if(f){f.focus();if(f.select&&f.tagName==='INPUT')f.select()}});
    });
  }
  function head(t,m){return (t?'<h3>'+esc(t)+'</h3>':'')+(m?'<p>'+esc(m)+'</p>':'')}
  window.epAsk={
    confirm:function(msg,op){op=op||{};return open(function(o,close){return{cancel:false,enter:function(){close(true)},act:function(k){close(k==='ok')},
      html:head(op.title,msg)+'<div class="row"><button type="button" data-k="no">'+esc(op.cancel||'Cancel')+'</button><button type="button" class="'+(op.danger?'danger':'pri')+'" data-k="ok">'+esc(op.ok||'OK')+'</button></div>'}})},
    prompt:function(msg,op){op=op||{};return open(function(o,close){var val=function(){var i=o.querySelector('input');return i?i.value:''};return{cancel:null,enter:function(){close(val())},act:function(k){close(k==='ok'?val():null)},
      html:head(op.title,msg)+'<input type="'+esc(op.type||'text')+'" value="'+esc(op.value==null?'':op.value)+'" placeholder="'+esc(op.placeholder||'')+'" aria-label="'+esc(msg)+'" autocomplete="off"><div class="row"><button type="button" data-k="no">Cancel</button><button type="button" class="pri" data-k="ok">'+esc(op.ok||'Save')+'</button></div>'}})},
    choose:function(msg,items,op){op=op||{};return open(function(o,close){return{cancel:null,act:function(k,el){if(k==='pick')close(el.getAttribute('data-v'));else close(null)},
      html:head(op.title,msg)+'<div class="opts">'+items.map(function(it){return'<button type="button" data-k="pick" data-v="'+esc(it.value)+'">'+esc(it.label)+'</button>'}).join('')+'</div><div class="row"><button type="button" data-k="no">Cancel</button></div>'}})}
  };
})();

