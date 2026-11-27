
(function(){
 'use strict';
 var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
 var api=function(){return window.__epCommunityApi;};
 var rpc=function(name,args){var a=api();if(!a||!a.ready)return Promise.reject(new Error('Account service is not ready.'));return a.ready().then(function(x){return x.client.rpc(name,args||{});}).then(function(r){if(r.error)throw r.error;return r.data;});};
 var toast=function(m,t){try{showToast(m,t||'info');}catch(e){}};
 var role='student',lastLookup=[];
 function body(html,actions){setModal('Campus safety console','Server-verified permissions · sensitive actions are audited',html,actions||'<button type="button" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold" onclick="closeModal()">Close</button>');}
 function denied(){body('<div class="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4"><b>Access denied</b><p class="mt-2 text-sm text-slate-500">Your account does not have an owner, staff or moderator role. Ask the platform owner to grant access.</p></div>');}
 function open(){
  body('<div class="space-y-3"><div class="ep-skeleton h-16"></div><div class="ep-skeleton h-28"></div></div>');
  rpc('ep_admin_bootstrap').then(function(v){
   role=v&&v.role||'student';if(!['owner','staff','moderator'].includes(role)){denied();return;}
   window.epPhaseAdminData=v||{};renderHome(v||{});
  }).catch(function(e){body('<div class="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4"><b>Safety migration required</b><p class="mt-2 text-sm text-slate-500">'+esc(e.message||'Could not load admin permissions.')+'</p><p class="mt-2 text-xs text-slate-500">Run <b>edupulse-phase1-3.sql</b> in Supabase SQL Editor, then refresh Campus.</p></div>');});
 }
 function renderHome(v){
  var flags=v.flags||{},flagHtml=Object.keys(flags).map(function(k){return '<label class="ep-admin-row flex items-center justify-between gap-3"><span><b class="text-sm">'+esc(k.replace(/_/g,' '))+'</b><small class="block text-xs text-slate-500">Platform feature switch</small></span><input type="checkbox" '+(flags[k]?'checked':'')+' onchange="epPhaseSetFlag(\''+esc(k)+'\',this.checked)"></label>';}).join('');
  body('<div class="space-y-4"><div class="flex items-center justify-between"><div><b class="text-lg">Control centre</b><p class="text-xs text-slate-500">Signed in as '+esc(role)+'</p></div><span class="rounded-full bg-teal-500/10 px-3 py-1 text-xs font-black text-teal-600">Verified role</span></div><div class="ep-admin-grid"><button class="ep-admin-tile" onclick="epPhaseLookup()"><b><i class="fa-solid fa-magnifying-glass mr-1 text-teal-600"></i> User lookup</b><small>Find an account and apply moderation</small></button><button class="ep-admin-tile" onclick="epPhaseAudit()"><b><i class="fa-solid fa-clipboard-list mr-1 text-teal-600"></i> Audit log</b><small>Review sensitive staff actions</small></button><button class="ep-admin-tile" onclick="epPhaseStaff()"><b><i class="fa-solid fa-users-gear mr-1 text-teal-600"></i> Staff management</b><small>Grant or revoke moderator roles · owner only</small></button><button class="ep-admin-tile" onclick="epPhaseFlags()"><b><i class="fa-solid fa-toggle-on mr-1 text-teal-600"></i> Feature switches</b><small>Enable or pause platform features</small></button></div><div class="ep-admin-row"><b class="text-sm">Platform safety</b><p class="mt-1 text-xs text-slate-500">All moderation actions are recorded by the database. Client-side role checks are not used as the security boundary.</p></div></div>');
 }
 window.epPhaseConsoleOpen=open;
 window.epPhaseLookup=function(){
  body('<div class="space-y-3"><h3 class="font-black">Find a student</h3><input id="ep-ad-q" class="ep-admin-input" placeholder="Username, display name or email"><button class="cm-btn pri" onclick="epPhaseDoLookup()">Search users</button><div id="ep-ad-results"></div></div>');
  setTimeout(function(){var x=document.getElementById('ep-ad-q');if(x)x.focus();},30);
 };
 window.epPhaseDoLookup=function(){
  var q=(document.getElementById('ep-ad-q')||{}).value||'',out=document.getElementById('ep-ad-results');if(!out)return;
  out.innerHTML='<div class="ep-skeleton h-20"></div>';
  rpc('ep_admin_lookup_user',{p_query:q.trim()}).then(function(rows){
   lastLookup=rows||[];out.innerHTML=lastLookup.length?lastLookup.map(function(u){return '<div class="ep-admin-row"><b>'+esc(u.display_name||u.username||'Student')+'</b><p class="text-xs text-slate-500">@'+esc(u.username||'no-handle')+' · '+esc(u.email||'')+'</p><p class="text-[11px] text-slate-500">'+esc(u.id)+'</p><div class="ep-admin-actions"><button onclick="epPhaseSanction(\''+esc(u.id)+'\',\'warn\')">Warn</button><button onclick="epPhaseSanction(\''+esc(u.id)+'\',\'mute\')">Mute 1 day</button><button class="danger" onclick="epPhaseSanction(\''+esc(u.id)+'\',\'ban\')">Ban</button><button onclick="epPhaseSanction(\''+esc(u.id)+'\',\'shadow_mute\')">Shadow mute</button></div></div>';}).join(''):'<p class="text-sm text-slate-500">No matching users.</p>';
  }).catch(function(e){out.textContent=e.message||'Search failed';});
 };
 window.epPhaseSanction=function(id,action){
  var label=action.replace('_',' ');
  epAsk.prompt('A reason is required and is written to the audit log.',{title:'Reason for '+label,placeholder:'Reason',ok:'Continue'}).then(function(reason){if(reason===null)return;
  if(!reason.trim()){toast('A reason is required.','warning');return;}
  var mins=action==='mute'?1440:action==='ban'?0:0;
  var confirmText='Apply '+label+' to this account? This action will be written to the audit log.';
  epConfirm(confirmText,'Apply action',true).then(function(ok){if(!ok)return;
   rpc('ep_admin_apply_action',{p_target:id,p_action:action,p_reason:reason.trim(),p_duration_minutes:mins}).then(function(){toast(label+' applied','success');epPhaseDoLookup();},function(e){toast(e.message||'Action failed','error');});
  });
  });
 };
 window.epPhaseAudit=function(){
  body('<div class="space-y-3"><h3 class="font-black">Recent audit events</h3><div id="ep-ad-audit" class="text-sm text-slate-500">Loading…</div></div>');
  rpc('ep_admin_audit_list',{p_limit:50}).then(function(rows){var e=document.getElementById('ep-ad-audit');if(!e)return;e.innerHTML=(rows||[]).length?(rows||[]).map(function(x){return '<div class="ep-admin-row"><b class="text-xs">'+esc(x.action)+'</b><p class="text-xs text-slate-500">'+esc(x.actor_label||x.actor_id)+' → '+esc(x.target_label||x.target_id||'platform')+'</p><p class="text-xs">'+esc(x.reason||'')+'</p><small class="text-[11px] text-slate-500">'+esc(x.created_at)+'</small></div>';}).join(''):'No audit events yet.';}).catch(function(e){var x=document.getElementById('ep-ad-audit');if(x)x.textContent=e.message||'Could not load audit log.';});
 };
 window.epPhaseFlags=function(){
  body('<div class="space-y-3"><h3 class="font-black">Feature switches</h3><div id="ep-ad-flags">Loading…</div><p class="text-xs text-slate-500">Only the owner can change platform-wide switches.</p></div>');
  rpc('ep_admin_bootstrap').then(function(v){var e=document.getElementById('ep-ad-flags');if(!e)return;var f=v.flags||{};e.innerHTML=Object.keys(f).map(function(k){return '<label class="ep-admin-row flex items-center justify-between gap-3"><span class="text-sm font-bold">'+esc(k.replace(/_/g,' '))+'</span><input type="checkbox" '+(f[k]?'checked':'')+' '+(role!=='owner'?'disabled':'')+' onchange="epPhaseSetFlag(\''+esc(k)+'\',this.checked)"></label>';}).join('')||'No feature switches configured.';}).catch(function(e){var x=document.getElementById('ep-ad-flags');if(x)x.textContent=e.message;});
 };
 window.epPhaseSetFlag=function(key,value){rpc('ep_admin_set_feature_flag',{p_key:key,p_enabled:!!value}).then(function(){toast('Feature switch saved','success');},function(e){toast(e.message||'Could not change feature switch','error');});};
 window.epPhaseStaff=function(){
  if(role!=='owner'){toast('Only the owner can manage staff.','warning');return;}
  body('<div class="space-y-3"><h3 class="font-black">Staff management</h3><input id="ep-staff-id" class="ep-admin-input" placeholder="Student UUID"><select id="ep-staff-role" class="ep-admin-input"><option value="moderator">Moderator</option><option value="staff">Staff</option><option value="remove">Remove staff access</option></select><button class="cm-btn pri" onclick="epPhaseSaveStaff()">Save role</button><div id="ep-staff-list">Loading…</div></div>');
  rpc('ep_admin_staff_list').then(function(rows){var e=document.getElementById('ep-staff-list');if(e)e.innerHTML=(rows||[]).map(function(x){return '<div class="ep-admin-row text-xs"><b>'+esc(x.role)+'</b><p>'+esc(x.user_id)+'</p></div>';}).join('')||'No staff members.';}).catch(function(e){var x=document.getElementById('ep-staff-list');if(x)x.textContent=e.message;});
 };
 window.epPhaseSaveStaff=function(){var id=(document.getElementById('ep-staff-id')||{}).value||'',r=(document.getElementById('ep-staff-role')||{}).value;if(!/^[0-9a-f-]{36}$/i.test(id)){toast('Enter a valid user UUID.','warning');return;}rpc('ep_admin_set_staff',{p_user_id:id,p_role:r}).then(function(){toast('Staff role updated','success');epPhaseStaff();},function(e){toast(e.message||'Could not update staff','error');});};
})();

;

(function(){
  var root=document.documentElement, nav=document.getElementById('bottom-nav'), raf=0;
  function measure(){
    raf=0;
    var h=0;
    if(nav){
      var cs=getComputedStyle(nav);
      if(cs.display!=='none'&&cs.position==='fixed'){
        h=Math.max(0,Math.round(root.clientHeight-nav.getBoundingClientRect().top));
      }
    }
    root.style.setProperty('--bn-top',h+'px');
  }
  function queue(){ if(!raf) raf=requestAnimationFrame(measure); }
  measure();
  window.addEventListener('resize',queue,{passive:true});
  window.addEventListener('orientationchange',queue,{passive:true});
  window.addEventListener('load',queue);
  if(window.ResizeObserver&&nav){ new ResizeObserver(queue).observe(nav); }
  if(window.MutationObserver){ new MutationObserver(queue).observe(document.body,{attributes:true,attributeFilter:['class'],subtree:false}); }

  /* "Change" in the action bar opens Session options */
  })();

;

/* Runs after every other script: build the final dashboard, THEN fade the splash. The page is ~1.9 MB and streams in, so the legacy dashboard can exist for a while; the splash keeps it hidden. */
(function(){
  function go(){try{if(typeof currentTab!=='undefined'&&currentTab==='dashboard'&&typeof renderView==='function'&&!document.querySelector('#main-container [data-d5]'))renderView();}catch(e){console.warn('first paint',e)}}
  function reveal(){var sp=document.getElementById('ep-splash');if(!sp)return;setTimeout(function(){sp.classList.add('ep-out')},Math.max(0,600-performance.now()));}
  go();reveal();
})();

;

(function(){
  var Q=function(){return window.quizState||quizState};
  function sk(){var q=Q();return q.skippedQuestions||{}}
  function counts(){var q=Q(),w=0,s=0,t=0;for(var i=0;i<q.questions.length;i++){var a=q.userAnswers[i];if(a===undefined){t++;if(sk()[i])s++}else if(a!==q.questions[i].correct)w++}return{w:w,s:s,t:t}}
  window.epPalChips=function(){var q=Q(),c=counts(),f=q.palFilter||'all',rv=!!q.reviewMode;
    var chip=function(k,l,n){return '<button type="button" class="ep-pf'+(f===k?' on':'')+'" data-epf="'+k+'" onclick="epPalFilter(\''+k+'\')">'+l+(n!=null?' <b>'+n+'</b>':'')+'</button>'};
    return '<div class="ep-pf-row">'+chip('all','All')+chip('wrong','Wrong',c.w)+chip('skipped','Skipped',c.s)+chip('todo','Unattempted',c.t)+'<button type="button" class="ep-pf-next" onclick="epJumpNext()" '+((rv?c.w:c.t)?'':'disabled')+'>'+(rv?'Next wrong':'Next unattempted')+'</button></div>'};
  window.epPalFilter=function(k){var q=Q();q.palFilter=k;var p=document.querySelector('.palette-drawer-top');if(!p)return;p.dataset.epf=k;p.querySelectorAll('.ep-pf').forEach(function(b){b.classList.toggle('on',b.dataset.epf===k)})};
  window.epJumpNext=function(){var q=Q(),n=q.questions.length,rv=!!q.reviewMode;
    for(var d=1;d<=n;d++){var i=(q.currentIndex+d)%n,a=q.userAnswers[i],hit=rv?(a!==undefined&&a!==q.questions[i].correct):a===undefined;
      if(hit){jumpToPracticeQuestion(i);return}}
    showToast(rv?'No wrong answers left to review.':'Every question is attempted.','info')};
  window.epReviewAnswers=function(){var q=Q();if(!q.questions.length)return;q.reviewMode=true;q.mode='practice';q.paletteExpanded=false;q.palFilter='all';
    var i=q.questions.findIndex(function(x,k){return q.userAnswers[k]!==undefined&&q.userAnswers[k]!==x.correct});q.currentIndex=i<0?0:i;renderPracticeQuiz()};
  var _jump=window.jumpToPracticeQuestion;window.jumpToPracticeQuestion=function(i){Q().paletteExpanded=false;return _jump.apply(this,arguments)};
  var _sel=window.selectPracticeOption;window.selectPracticeOption=function(){if(Q().reviewMode)return;return _sel.apply(this,arguments)};
  var _fin=window.finishPracticeQuiz;window.finishPracticeQuiz=function(){var q=Q();
    if(q.reviewMode){q.reviewMode=false;var a=StorageModule.get(STORAGE_KEYS.attempts,[])[0];if(a)showResultScreen(a);else closeModal();return}
    return _fin.apply(this,arguments)};
  var _cm=window.closeModal;if(_cm)window.closeModal=function(){Q().reviewMode=false;return _cm.apply(this,arguments)};
  var _skip=window.skipCurrentQuestion;window.skipCurrentQuestion=function(){var q=Q(),i=q.currentIndex;
    if(!q.infinite&&i===q.questions.length-1){q.skippedQuestions=q.skippedQuestions||{};q.skippedQuestions[i]=true;
      var j=q.questions.findIndex(function(x,k){return k!==i&&q.userAnswers[k]===undefined});
      if(j>=0){persistQuizSession();showToast('Q'+(j+1)+' is still unattempted. Jumping back.','info');return jumpToPracticeQuestion(j)}}
    return _skip.apply(this,arguments)};
  var _rpq=window.renderPracticeQuiz;window.renderPracticeQuiz=function(){_rpq.apply(this,arguments);
    requestAnimationFrame(function(){var q=Q(),lay=document.querySelector('.quiz-session-layout');if(!lay)return;
      var b=lay.querySelector('.palette-drawer-top > div:nth-child(2) .palette-touch-btn.ring-2');
      if(b&&b.parentElement)b.parentElement.scrollLeft=b.offsetLeft-b.parentElement.clientWidth/2+b.offsetWidth/2;
      if(!q.reviewMode)return;
      lay.querySelectorAll('.pq-next[data-locked]').forEach(function(x){delete x.dataset.locked;x.removeAttribute('aria-disabled');x.removeAttribute('title')});
      var s=lay.querySelector('.pq-skip');if(s)s.remove();
      var p=lay.querySelector('h2 + p');if(p)p.textContent='Reviewing answers \u00b7 '+(q.currentIndex+1)+' of '+q.questions.length;
      Array.prototype.some.call(lay.querySelectorAll('button'),function(x){if(/^(Exit|End Session)$/.test(x.textContent.trim())){x.textContent='Done';return true}})})};
})();

;

(function(){
var KEY='ep_tour_v2',S=null,R=null,W=null,prevFocus=null,RM=false;
try{RM=matchMedia('(prefers-reduced-motion:reduce)').matches}catch(e){}
function seen(){try{return localStorage.getItem(KEY)==='1'}catch(e){return false}}
function mark(){try{localStorage.setItem(KEY,'1')}catch(e){}}
var G=['#main-container h1','#main-container h2','#main-container .card','#main-container > div > *','#main-container > *'];
function A(a){return a.concat(G)}
function NAV(t,id){return ['.bn-item[data-tab="'+t+'"]','#nav-'+(id||t)]}
var steps=[
 {m:'excited',tab:'dashboard',t:'Hi, I am Pulse!',b:'Your study buddy inside EduPulse. I will walk you through every page, and you get to tap a few things yourself. About a minute.'},
 {m:'happy',tab:'dashboard',sel:['.d5-hero'],t:'Today: your home base',b:'The ring tracks your daily question goal. Resume jumps back to where you stopped.',more:'Tap the ring on the real page to change your goal. A 25-minute focus block is one tap away too.'},
 {m:'curious',tab:'dashboard',sel:['.d5-gen'],try:1,t:'Your turn: tap this strip',b:'It builds a custom NEET paper. Tap it and I will meet you on the Tests page.'},
 {m:'proud',tab:'mock',sel:A(['.tp-head']),t:'Tests',b:'Full NEET papers, scheduled tests, papers you generate, and your past results live here.',more:'Every test follows the NTA pattern, and after submitting you can review each answer one by one.'},
 {m:'curious',tab:'mock',sel:NAV('learn'),try:1,t:'Now tap Practice',b:'This is where most of your time will go.'},
 {m:'excited',tab:'learn',sel:G,t:'Practice',b:'Pick a subject and chapter, then answer with instant explanations. The question palette lets you jump around and filter wrong or skipped questions.',more:'Keys 1 to 5 pick options, arrow keys move between questions, S skips and B bookmarks.'},
 {m:'curious',tab:'learn',sel:NAV('progress'),try:1,t:'Tap Progress',b:'Let us see where your numbers show up.'},
 {m:'proud',tab:'progress',sel:G,t:'Progress',b:'Accuracy, streaks, weak chapters and focus time build up here as you practise.',more:'Weak chapters feed your plan on Today, so EduPulse always tells you what to fix next.'},
 {m:'curious',tab:'progress',sel:NAV('campus'),try:1,t:'Tap Circles',b:'Studying alone gets lonely.'},
 {m:'love',tab:'campus',sel:G,t:'Circles',b:'Join study circles, chat, ask doubts and climb the leaderboard with other aspirants.'},
 {m:'happy',tab:'dashboard',sel:['#bn-focus','#nav-focus'],t:'Focus and planner',b:'A study timer and a daily plan live behind this button. Try a 25-minute block when you feel stuck.'},
 {m:'wow',tab:'directory',sel:A(['#vaultSearchInput']),t:'Resource Vault',b:'Search trusted study portals by name or tag. Open it from the side menu any time.'},
 {m:'wink',tab:'profile',sel:A(['#pf-hero']),t:'Profile and settings',b:'Change your name, avatar, exam date and theme here. Backup and export live in settings too.'},
 {m:'love',sel:['#ai-chat-toggle-btn'],t:'And that is me!',b:'Tap this button any time to ask a doubt, send a photo of a question, or get an explanation.'},
 {m:'cheer',tab:'dashboard',last:1,t:'You are all set',b:'Start with a short practice set today. Even 10 questions keep your streak alive.'}
];
var POKE=[['wink','Psst. Pick a chapter and I will cheer for you.'],['love','You are doing great. Seriously.'],['wow','Whoa, you tapped me!'],['curious','Stuck on a doubt? The Pulse AI button is always there.'],['proud','Every question you solve counts.']];
var MAS='<svg viewBox="-6 -8 76 76" style="overflow:visible" aria-hidden="true"><defs><linearGradient id="ept-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d9488"/><stop offset="1" stop-color="#6366f1"/></linearGradient></defs>'
+'<rect x="2" y="6" width="60" height="54" rx="20" fill="url(#ept-g)"/>'
+'<path class="br" d="M14 22 L26 18" stroke="#fff" stroke-width="3" stroke-linecap="round"/>'
+'<g class="eoL"><ellipse cx="23" cy="32" rx="6" ry="7.5" fill="#fff"/><circle class="pu" cx="23" cy="32.5" r="3.4" fill="#0f172a"/></g>'
+'<g class="eoR"><ellipse cx="41" cy="32" rx="6" ry="7.5" fill="#fff"/><circle class="pu" cx="41" cy="32.5" r="3.4" fill="#0f172a"/></g>'
+'<path class="eaL" d="M17.5 33 Q23 25.5 28.5 33" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>'
+'<path class="eaR" d="M35.5 33 Q41 25.5 46.5 33" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>'
+'<path class="ehL" d="M23 38 C14 31 17 24 23 28.5 C29 24 32 31 23 38Z" fill="#fda4af"/><path class="ehR" d="M41 38 C32 31 35 24 41 28.5 C47 24 50 31 41 38Z" fill="#fda4af"/>'
+'<ellipse class="bl" cx="13" cy="43" rx="4.5" ry="3" fill="#fda4af" opacity=".8"/><ellipse class="bl" cx="51" cy="43" rx="4.5" ry="3" fill="#fda4af" opacity=".8"/>'
+'<path class="ms" d="M24 45 Q32 53 40 45" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>'
+'<path class="mO" d="M24 44 Q32 58 40 44Z" fill="#0f172a"/><ellipse class="mo" cx="32" cy="48" rx="4.2" ry="5.2" fill="#0f172a"/>'
+'<path class="mf" d="M26 48 H38" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>'
+'<circle cx="57" cy="9" r="11" fill="url(#ept-g)" stroke="#fff" stroke-width="2.5"/><use href="#ep-ai" x="49" y="1" width="16" height="16" color="#fff"/>'
+'<text class="qm" x="-5" y="16" font-size="17" font-weight="900" fill="#f59e0b">?</text>'
+'<g class="dt" fill="#a5b4fc"><circle cx="8" cy="-1" r="2.4"/><circle cx="16" cy="-4" r="2.4"/><circle cx="24" cy="-1" r="2.4"/></g>'
+'<g class="sp" fill="#fde68a"><path d="M-2 14 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6z"/><path d="M68 42 l1.3 3.2 3.2 1.3 -3.2 1.3 -1.3 3.2 -1.3 -3.2 -3.2 -1.3 3.2 -1.3z"/></g>'
+'<g class="hr" fill="#fb7185"><path d="M-2 22 c-3 -3 -1 -6 1 -4 c2 -2 4 1 1 4z"/><path d="M68 28 c-3 -3 -1 -6 1 -4 c2 -2 4 1 1 4z"/></g></svg>';
function vis(el){if(!el)return false;var r=el.getBoundingClientRect(),c=getComputedStyle(el);return r.width>4&&r.height>4&&c.visibility!=='hidden'&&c.display!=='none'&&r.right>0&&r.left<innerWidth}
function find(st){if(!st.sel)return null;for(var i=0;i<st.sel.length;i++){var el=document.querySelector(st.sel[i]);if(vis(el)){var r=el.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight){try{el.scrollIntoView({block:'center'})}catch(e){}}return el}}return null}
function mood(m){S.mood=m;W.className='ept-mw m-'+m}
function look(r){var m=W.getBoundingClientRect(),a=Math.atan2(r.top+r.height/2-(m.top+m.height/2),r.left+r.width/2-(m.left+m.width/2)),lx=Math.cos(a)*2.4,ly=Math.sin(a)*2.4;
 if(S.mood==='thinking'){lx=2;ly=-2.4}W.style.setProperty('--lx',lx.toFixed(1)+'px');W.style.setProperty('--ly',ly.toFixed(1)+'px')}
function box(n,l,t,w,h){n.style.cssText='left:'+l+'px;top:'+t+'px;width:'+Math.max(0,w)+'px;height:'+Math.max(0,h)+'px;display:'+(w>0&&h>0?'block':'none')}
function place(){
 if(!S||!R)return;var st=steps[S.i],card=R.querySelector('.ept-card'),hole=R.querySelector('.ept-hole'),ct=R.querySelector('.ept-ct'),P=R.querySelectorAll('.ept-p'),vw=innerWidth,vh=innerHeight;
 if(S.el&&!document.contains(S.el))S.el=find(st);
 var cw=Math.min(350,vw-24);card.style.width=cw+'px';
 if(!S.el){R.classList.add('ept-center');box(P[0],0,0,vw,vh);P[1].style.display=P[2].style.display=P[3].style.display='none';hole.style.display=ct.style.display='none';card.style.left=card.style.top='';return}
 R.classList.remove('ept-center');
 var r=S.el.getBoundingClientRect(),p=6,hh=Math.min(r.height,vh*.3),x=Math.max(0,r.left-p),y=Math.max(0,r.top-p),w=Math.min(vw-x,r.width+2*p),h=hh+2*p;
 box(P[0],0,0,vw,y);box(P[1],0,y+h,vw,vh-y-h);box(P[2],0,y,x,h);box(P[3],x+w,y,vw-x-w,h);
 hole.style.cssText='display:block;left:'+x+'px;top:'+y+'px;width:'+w+'px;height:'+h+'px';
 if(st.try)ct.style.display='none';else box(ct,x,y,w,h);
 var ch=card.offsetHeight,below=vh-(y+h),top=(below>=ch+56||below>=y)?y+h+48:y-ch-12;
 top=Math.max(48,Math.min(vh-ch-12,top));card.style.top=top+'px';card.style.left=Math.max(12,Math.min(vw-cw-12,r.left+r.width/2-cw/2))+'px';
 look({left:x,top:y,width:w,height:h});
}
function say(txt){
 var b=R.querySelector('#ept-b');clearInterval(S.tw);b.textContent=txt;
 if(RM){W.classList.remove('talk');return}
 b.style.minHeight=b.offsetHeight+'px';b.textContent='';place();W.classList.add('talk');var i=0;
 function fin(){clearInterval(S.tw);b.textContent=txt;W.classList.remove('talk')}
 S.tw=setInterval(function(){i+=2;b.textContent=txt.slice(0,i);if(i>=txt.length)fin()},24);b.onclick=fin;
}
function confetti(){if(RM)return;var c=['#0d9488','#6366f1','#f59e0b','#fb7185','#34d399'];for(var i=0;i<30;i++){var e=document.createElement('i');e.style.cssText='left:'+Math.random()*100+'%;background:'+c[i%5]+';animation-delay:'+(Math.random()*.4).toFixed(2)+'s;animation-duration:'+(1.4+Math.random()).toFixed(2)+'s';R.appendChild(e);setTimeout(function(x){return function(){x.remove()}}(e),2600)}}
function arm(st){
 if(S.hEl){S.hEl.removeEventListener('click',S.h,true);S.hEl=null}
 if(!st.try||!S.el)return;var i=S.i;
 S.h=function(){if(!S||S.i!==i)return;mood('excited');say('Nice tap!');setTimeout(function(){if(S&&S.i===i)show(i+1,1)},650)};
 S.hEl=S.el;S.el.addEventListener('click',S.h,true);
}
function paint(st){
 var i=S.i;mood(st.m||'happy');
 R.querySelector('.ept-cnt').textContent=(i+1)+' / '+steps.length;
 R.querySelector('.ept-t').textContent=st.t;
 R.querySelector('.ept-back').style.visibility=i?'visible':'hidden';
 R.querySelector('.ept-skip').style.display=st.last?'none':'';
 R.querySelector('.ept-more').style.display=st.more?'':'none';
 R.querySelector('.ept-hint').style.display=st.try?'':'none';
 R.querySelector('.ept-next').textContent=st.last?'Start practising':st.try?'Show me':i===0?'Start tour':'Next';
 place();arm(st);say(st.b);if(st.last)confetti();
 try{R.querySelector('.ept-next').focus({preventScroll:true})}catch(e){}
}
function show(i,dir){
 if(i>=steps.length)return end(true);
 S.i=i;S.dir=dir||1;var st=steps[i],tries=0;
 if(S.hEl){S.hEl.removeEventListener('click',S.h,true);S.hEl=null}
 if(st.tab&&window.switchTab){var ct;try{ct=currentTab}catch(e){}if(ct!==st.tab)try{switchTab(st.tab)}catch(e){}}
 (function wait(){
  if(!S||S.i!==i)return;
  var el=find(st);
  if(!el&&st.sel&&tries++<25){setTimeout(wait,80);return}
  if(!el&&st.sel){var n=i+S.dir;if(n>=0&&n<steps.length)return show(n,S.dir);return end()}
  S.el=el;paint(st);
 })();
}
function next(){if(!S)return;var st=steps[S.i];if(st.last)return end(true);if(st.try&&S.el){S.el.click();return}show(S.i+1,1)}
function back(){if(S&&S.i>0)show(S.i-1,-1)}
function more(){var st=steps[S.i];if(!st.more)return;R.querySelector('.ept-more').style.display='none';mood('excited');say(st.b+' '+st.more)}
function poke(){var q=POKE[Math.floor(Math.random()*POKE.length)],keep=steps[S.i];mood(q[0]);say(q[1]);clearTimeout(S.pt);S.pt=setTimeout(function(){if(S&&steps[S.i]===keep){mood(keep.m||'happy');say(keep.b)}},3600)}
function end(go){
 if(!R)return;mark();clearInterval(S.tw);clearTimeout(S.pt);if(S.hEl)S.hEl.removeEventListener('click',S.h,true);
 R.remove();R=W=null;S=null;
 document.removeEventListener('keydown',key,true);removeEventListener('resize',place);removeEventListener('scroll',place,true);
 if(prevFocus&&prevFocus.focus)try{prevFocus.focus({preventScroll:true})}catch(e){}
 if(go&&window.switchTab)try{switchTab('learn')}catch(e){}
}
function key(e){
 if(!S)return;
 if(e.key==='Escape'){e.preventDefault();e.stopPropagation();end()}
 else if(e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();next()}
 else if(e.key==='ArrowLeft'){e.preventDefault();e.stopPropagation();back()}
 else if(e.key==='Tab'){var b=[].filter.call(R.querySelectorAll('button'),function(x){var c=getComputedStyle(x);return c.visibility!=='hidden'&&c.display!=='none'});if(!b.length)return;var f=b[0],l=b[b.length-1];
  if(e.shiftKey&&document.activeElement===f){e.preventDefault();l.focus()}else if(!e.shiftKey&&document.activeElement===l){e.preventDefault();f.focus()}}
}
function start(force){
 if(S||(!force&&seen()))return;
 prevFocus=document.activeElement;try{window.toggleMobileNav&&toggleMobileNav(false)}catch(e){}
 R=document.createElement('div');R.id='ept';
 R.innerHTML='<div class="ept-p"></div><div class="ept-p"></div><div class="ept-p"></div><div class="ept-p"></div><div class="ept-ct"></div><div class="ept-hole"></div>'
 +'<div class="ept-card" role="dialog" aria-modal="true" aria-labelledby="ept-t"><div class="ept-mw m-happy"><button type="button" class="ept-mb" aria-label="Poke Pulse">'+MAS+'</button></div><span class="ept-cnt" aria-hidden="true"></span>'
 +'<h3 id="ept-t" class="ept-t"></h3><p id="ept-b" aria-live="polite"></p><p class="ept-hint">Tap the highlighted area, or press Show me.</p>'
 +'<div class="ept-act"><button type="button" class="ept-skip">Skip tour</button><span class="ept-btns"><button type="button" class="ept-more">Tell me more</button><button type="button" class="ept-back">Back</button><button type="button" class="ept-next"></button></span></div></div>';
 document.body.appendChild(R);W=R.querySelector('.ept-mw');S={i:0,dir:1,el:null,mood:'happy'};
 R.querySelector('.ept-next').onclick=next;R.querySelector('.ept-back').onclick=back;R.querySelector('.ept-more').onclick=more;R.querySelector('.ept-skip').onclick=function(){end()};R.querySelector('.ept-mb').onclick=poke;
 document.addEventListener('keydown',key,true);addEventListener('resize',place);addEventListener('scroll',place,true);
 show(0,1);
}
window.epTour={start:start,end:end,seen:seen};
(function(){var ob=window.epOb;if(!ob||ob.__tour)return;var o=ob.next;
 ob.next=function(){var was=false,r;try{was=!!(getAspirantProfile()||{}).onboarded}catch(e){}
  r=o.apply(this,arguments);
  try{if(!was&&(getAspirantProfile()||{}).onboarded&&!seen())setTimeout(function(){start(false)},900)}catch(e){}
  return r};ob.__tour=1})();
(function(){var a=document.getElementById('nav-about');if(a&&!document.getElementById('nav-tour'))a.insertAdjacentHTML('afterend','<button type="button" id="nav-tour" onclick="epTour.start(true)"><i class="fa-solid fa-route w-5"></i> App tour with Pulse</button>')})();
})();

;

(function(){
var btn=document.getElementById('ai-chat-toggle-btn'),wrap=document.getElementById('ai-chatbot-widget');
if(!btn||!wrap||btn.dataset.pulse)return;btn.dataset.pulse='1';
var RM=false,calm=false,cur='happy',base='happy',busy=false,sleeping=false,dart=null,lastAct=Date.now(),lastBub=0,streak=0,tm={},px=0,py=0,raf=0;
try{RM=matchMedia('(prefers-reduced-motion:reduce)').matches}catch(e){}
try{calm=localStorage.getItem('ep_pulse_calm')==='1'}catch(e){}
function pick(a){return a[Math.floor(Math.random()*a.length)]}
var SHABASHI=['Shabash! Ekdum sahi.','Waah! Doctor material.','Shabashi! Aise hi chalo.','Bilkul sahi, topper!','Boom! Sahi jawab.','Kya baat hai! Dimaag chal raha hai.'],
ROAST=['Arre! Yeh toh NCERT mein tha, bhai.','Confidence full, answer galat. Bold choice.','Wah, kya confidently galat kiya.','Option padhe the ya aankhein band thi?','Explanation free hai, padh lo.','Koi nahi, ab yaad rahega. Shayad.'],
TAUNT=['Phone chalane se NEET clear nahi hota.','Scroll kam, solve zyada.','Kal se padhunga bola tha na?','Syllabus tumhe dekh ke has raha hai.','Ek chapter bhi nahi? Hmm.','Main yahan hoon, tum kahan?'],
PRAISE=['Shabash! Aaj ka goal pura karo.','You are doing great.','Mehnat rang layegi.'],
SKIP=['Skip? Darr gaye kya?','Question se bhaag rahe ho?','Skip karne se marks nahi aate, bhai.'],
WAKE=['Main so nahi raha tha, bas aankhein band thi.','Arre, aa gaye? Bahut der laga di.'];
btn.insertAdjacentHTML('beforeend','<svg class="epf" viewBox="0 0 64 64" aria-hidden="true">'
+'<circle class="ear" cx="2.5" cy="37" r="4.6"/><circle class="ear" cx="61.5" cy="37" r="4.6"/>'
+'<rect class="scr" x="6" y="15" width="52" height="43" rx="16"/>'
+'<path class="antl" d="M32 15 V9"/>'
+'<circle class="ant" cx="32" cy="6.5" r="3.4"/>'
+'<path class="br" d="M14 22 L26 18" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/>'
+'<path class="bs" d="M14 25 L26 20 M50 25 L38 20" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/>'
+'<g class="eoL"><ellipse cx="23" cy="33" rx="6.8" ry="8.2" fill="#fff"/><g class="pu"><circle cx="23" cy="33.6" r="4.9" fill="#1e1b4b"/><circle cx="23" cy="33.6" r="3.1" fill="#4338ca" opacity=".55"/><circle cx="24.9" cy="31.2" r="1.9" fill="#fff"/><circle cx="21.3" cy="36" r="1" fill="#fff" opacity=".9"/></g></g>'
+'<g class="eoR"><ellipse cx="41" cy="33" rx="6.8" ry="8.2" fill="#fff"/><g class="pu"><circle cx="41" cy="33.6" r="4.9" fill="#1e1b4b"/><circle cx="41" cy="33.6" r="3.1" fill="#4338ca" opacity=".55"/><circle cx="42.9" cy="31.2" r="1.9" fill="#fff"/><circle cx="39.3" cy="36" r="1" fill="#fff" opacity=".9"/></g></g>'
+'<path class="eaL" d="M17.5 34 Q23 26.5 28.5 34" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path class="eaR" d="M35.5 34 Q41 26.5 46.5 34" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>'
+'<path class="ezL" d="M17 35 Q23 40 29 35" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><path class="ezR" d="M35 35 Q41 40 47 35" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>'
+'<path class="ehL" d="M23 39 C14 32 17 25 23 29.5 C29 25 32 32 23 39Z" fill="#fda4af"/><path class="ehR" d="M41 39 C32 32 35 25 41 29.5 C47 25 50 32 41 39Z" fill="#fda4af"/>'
+'<ellipse class="bl" cx="14.5" cy="44" rx="4.4" ry="2.7" fill="#fda4af" opacity=".8"/><ellipse class="bl" cx="49.5" cy="44" rx="4.4" ry="2.7" fill="#fda4af" opacity=".8"/>'
+'<path class="ms" d="M26.5 46.5 Q29.2 51.5 32 47 Q34.8 51.5 37.5 46.5" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path class="sm" d="M25 47 Q34 53 42 44" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>'
+'<path class="mfr" d="M25 51 Q32 44 39 51" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path class="mO" d="M24 45 Q32 59 40 45Z" fill="#0f172a"/><ellipse class="mo" cx="32" cy="49" rx="4.2" ry="5" fill="#0f172a"/><path class="mf" d="M26 49 H38" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>'
+'<path class="tr" d="M17 41 q-3.5 5 0 7.5 q3.5 -2.5 0 -7.5z" fill="#bae6fd"/>'
+'<g class="dt" fill="#a5b4fc"><circle cx="46" cy="9" r="2.2"/><circle cx="52" cy="6" r="2.2"/><circle cx="58" cy="9" r="2.2"/></g>'
+'<text class="zz" x="46" y="14" font-size="13" font-weight="900" fill="#fff">z</text>'
+'<g class="sp" fill="#fde68a"><path d="M6 12 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4z"/></g>'
+'<g class="hr" fill="#fb7185"><path d="M54 18 c-3 -3 -1 -6 1 -4 c2 -2 4 1 1 4z"/></g></svg>');
var bub=document.createElement('div');bub.className='epf-bub';bub.setAttribute('aria-hidden','true');wrap.appendChild(bub);
function shown(){var r=btn.getBoundingClientRect();return r.width>0&&btn.getAttribute('aria-expanded')!=='true'}
function mood(m){btn.classList.remove('fm-'+cur);cur=m;btn.classList.add('fm-'+m);look()}
function look(){raf=0;var r=btn.getBoundingClientRect();if(!r.width)return;var dx=px-(r.left+r.width/2),dy=py-(r.top+r.height/2),d=Math.hypot(dx,dy)||1,k=Math.min(1,d/90),lx=dx/d*1.8*k,ly=dy/d*1.8*k;
 if(cur==='thinking'){lx=1.4;ly=-1.6}else if(cur==='sad'){lx=0;ly=1.6}else if(dart!==null){lx=dart;ly=0}
 btn.style.setProperty('--lx',lx.toFixed(1)+'px');btn.style.setProperty('--ly',ly.toFixed(1)+'px')}
function aim(e){px=e.clientX;py=e.clientY;wake();if(!raf)raf=requestAnimationFrame(look)}
function fx(c,ms){if(RM)return;btn.classList.remove(c);void btn.offsetWidth;btn.classList.add(c);clearTimeout(tm[c]);tm[c]=setTimeout(function(){btn.classList.remove(c)},ms)}
function later(ms){clearTimeout(tm.r);tm.r=setTimeout(function(){if(!sleeping&&!busy)mood(base)},ms)}
function say(t,ms,force){if(calm||!shown())return;if(!force&&Date.now()-lastBub<30000)return;var r=btn.getBoundingClientRect();bub.classList.toggle('r',r.left+r.width/2<innerWidth/2);bub.textContent=t;bub.classList.add('on');clearTimeout(tm.b);tm.b=setTimeout(function(){bub.classList.remove('on')},ms||3200);lastBub=Date.now()}
function wake(){lastAct=Date.now();if(sleeping){sleeping=false;mood('wow');fx('fx-hop',1300);say(pick(WAKE),2800,true);later(1400)}}
var ACTS=[
 function(){mood('wink');fx('fx-wig',900);later(1100)},
 function(){mood('sly');dart=-1.8;look();setTimeout(function(){dart=1.8;look()},500);setTimeout(function(){dart=null;look()},1000);say(pick(TAUNT));later(1800)},
 function(){mood('excited');fx('fx-hop',1300);say(pick(TAUNT));later(1400)},
 function(){mood('wow');fx('fx-spin',800);later(1000)},
 function(){mood('love');say(pick(PRAISE));later(1600)},
 function(){var r=btn.getBoundingClientRect(),left=r.left+r.width/2<innerWidth/2;btn.style.setProperty('--pk',(left?-40:40)+'px');btn.style.setProperty('--pr',(left?-20:20)+'deg');mood('sly');fx('fx-peek',2800);setTimeout(function(){mood('excited');say('Boo!',1400,true)},1500);later(2900)}
];
function canPlay(){return !calm&&!RM&&!document.hidden&&!sleeping&&!busy&&shown()}
function tick(){clearTimeout(tm.s);tm.s=setTimeout(function(){if(canPlay())ACTS[Math.floor(Math.random()*ACTS.length)]();tick()},7000+Math.random()*9000)}
var wrong=0;
function react(ok){
 if(sleeping||busy)return;clearTimeout(tm.r);try{window.epPulse&&epPulse.burst&&epPulse.burst(ok)}catch(e){}
 if(ok){wrong=0;streak++;mood(streak>=3?'love':'excited');fx('fx-hop',1300);say(streak>=3?'Hat-trick! Shabashi, champion!':pick(SHABASHI),2400,true);if(streak>=3)streak=0;later(1700)}
 else{streak=0;wrong++;mood(wrong>=3?'sad':'sly');say(wrong>=3?'Teen galat lagataar. Chai pi lo, phir comeback.':pick(ROAST),3000,true);if(wrong>=3)wrong=0;later(2300)}
}
var _sel=window.selectPracticeOption;
if(typeof _sel==='function')window.selectPracticeOption=function(){var q=quizState,i=q.currentIndex,before=q.userAnswers[i],r=_sel.apply(this,arguments);
 try{var a=q.userAnswers[i];if(before===undefined&&a!==undefined&&!q.reviewMode)react(a===q.questions[i].correct)}catch(e){}return r};
var _skip=window.skipCurrentQuestion;
if(typeof _skip==='function')window.skipCurrentQuestion=function(){var r=_skip.apply(this,arguments);try{if(!sleeping&&!busy){clearTimeout(tm.r);mood('sly');say(pick(SKIP),2600,true);later(1600)}}catch(e){}return r};
var _res=window.showResultScreen;
if(typeof _res==='function')window.showResultScreen=function(a){var r=_res.apply(this,arguments);
 try{var c=Number(a&&a.accuracy);if(isFinite(c)&&!sleeping&&!busy){clearTimeout(tm.r);
  if(c>=80){mood('excited');fx('fx-hop',1300);say('Shabashi! Topper ban rahe ho.',3200,true)}
  else if(c>=60){mood('proud');say('Theek-thaak. Thoda aur zor lagao.',3200,true)}
  else if(c>=40){mood('sly');say('Aadha syllabus, aadha score. Fair deal.',3200,true)}
  else{mood('sad');say('Is score ko dekh ke OMR bhi sharma gaya. Retry karo!',3400,true)}
  later(2600)}}catch(e){}return r};
setInterval(function(){var b=false;try{b=!!epc.busy}catch(e){}
 if(b&&!busy){busy=true;clearTimeout(tm.r);mood('thinking')}
 else if(!b&&busy){busy=false;mood('proud');fx('fx-hop',1300);later(1800)}
 if(!calm&&!RM&&!document.hidden&&!sleeping&&!busy&&shown()&&Date.now()-lastAct>55000){sleeping=true;clearTimeout(tm.r);mood('sleepy')}
 if(btn.getAttribute('aria-expanded')==='true'&&cur!==base&&!busy)mood(base)},500);
addEventListener('pointermove',aim,{passive:true});addEventListener('pointerdown',aim,{passive:true});addEventListener('keydown',wake,true);addEventListener('scroll',wake,{passive:true,capture:true});
btn.addEventListener('pointerenter',function(e){if(e.pointerType==='mouse'&&!sleeping&&!busy&&!RM){clearTimeout(tm.r);mood('wow');later(900)}});
btn.addEventListener('pointerdown',function(){if(!sleeping&&!busy){clearTimeout(tm.r);mood('love');later(900)}});
function label(){var n=document.getElementById('nav-calm');if(n)n.lastChild.textContent=' Pulse: '+(calm?'calm':'playful')}
function setCalm(on){calm=on===undefined?!calm:!!on;try{localStorage.setItem('ep_pulse_calm',calm?'1':'0')}catch(e){}bub.classList.remove('on');if(calm&&!sleeping&&!busy)mood(base);label();if(window.showToast)showToast(calm?'Pulse will stay calm.':'Pulse is feeling playful!','info')}
window.epPulse={calm:setCalm,react:react,mood:mood,say:say,fx:fx,pick:pick,isCalm:function(){return calm},isBusy:function(){return busy||sleeping}};
var anchor=document.getElementById('nav-tour')||document.getElementById('nav-about');
if(anchor&&!document.getElementById('nav-calm')){anchor.insertAdjacentHTML('afterend','<button type="button" id="nav-calm" onclick="epPulse.calm()"><i class="fa-solid fa-face-smile-wink w-5"></i> Pulse: playful</button>');label()}
mood('happy');tick();
})();

;

(function(){
var P=window.epPulse,btn=document.getElementById('ai-chat-toggle-btn'),wrap=document.getElementById('ai-chatbot-widget');
if(!P||!btn||!wrap||wrap.dataset.plus)return;wrap.dataset.plus='1';
var RM=false;try{RM=matchMedia('(prefers-reduced-motion:reduce)').matches}catch(e){}
function inPractice(){var m=document.getElementById('appModal');return !!(m&&m.classList.contains('open')&&m.classList.contains('fullscreen-modal'))}
function nameOf(){try{var p=getAspirantProfile();return p&&p.onboarded&&p.name&&String(p.name).toLowerCase()!=='aspirant'?String(p.name).trim().split(/\s+/)[0]:''}catch(e){return ''}}
P.burst=function(ok){if(!ok||RM||P.isCalm())return;var set=['⭐','✨','🎉','💚','🌟'];for(var i=0;i<6;i++){(function(i){var e=document.createElement('span');e.className='epf-pt';e.textContent=set[i%set.length];var a=(-80+i*32)*Math.PI/180,r=34+Math.random()*22;e.style.setProperty('--dx',(Math.sin(a)*r).toFixed(0)+'px');e.style.setProperty('--dy',(-Math.cos(a)*r-8).toFixed(0)+'px');e.style.setProperty('--rot',(Math.random()*60-30).toFixed(0)+'deg');btn.appendChild(e);setTimeout(function(){e.remove()},1000)})(i)}};
var tmEl=document.createElement('span');tmEl.className='epf-tm';tmEl.setAttribute('aria-hidden','true');btn.appendChild(tmEl);var lastRem=0;
var NUDGE=['Paani pi lo, bas 2 minute.','Back seedhi, gardan neeche mat jhukao.','Aankhein rest do: 20 second door dekho.','Thoda stretch karo, phir wapas.'];
function focusTick(){var L=null;try{L=window.epFocus&&epFocus.live()}catch(e){}
 if(!L){tmEl.classList.remove('on');lastRem=0;return}
 var m=Math.floor((Date.now()-L.t)/6e4);tmEl.textContent=m+'m';tmEl.classList.add('on');
 if(m>0&&m%30===0&&lastRem!==m){lastRem=m;if(!P.isBusy()&&!P.isCalm()){P.mood('proud');P.fx('fx-hop',1300);P.say(m+' min focus! '+P.pick(NUDGE),4200,true)}}}
setInterval(focusTick,15000);focusTick();
setInterval(function(){try{var g=getDailyGoal(),t=questionsSolvedToday(),k='ep_pulse_goal_'+new Date().toDateString();if(g>0&&t>=g&&!localStorage.getItem(k)){localStorage.setItem(k,'1');if(!P.isBusy()){P.mood('excited');P.fx('fx-spin',800);P.burst(true);P.say('Daily goal complete! Shabash, '+(nameOf()||'topper')+'!',4200,true)}}}catch(e){}},5000);
setTimeout(function(){try{if(sessionStorage.getItem('ep_pulse_hi'))return;sessionStorage.setItem('ep_pulse_hi','1')}catch(e){}
 if(P.isCalm()||P.isBusy())return;var h=new Date().getHours(),g=h<5?'Raat ko bhi padhai':h<12?'Good morning':h<17?'Good afternoon':'Good evening',n=nameOf(),dd='';
 try{var d=JSON.parse(localStorage.getItem('ep_focus2')||'{}').dd;if(d&&d.d){var x=epFocus.daysTo(d.d);if(x>=0)dd=' '+d.n+' mein '+x+' din baaki.'}}catch(e){}
 P.mood('excited');P.fx('fx-hop',1300);P.say(g+(n?', '+n:'')+'!'+dd,4500,true)},2600);
var menu=document.createElement('div');menu.className='epf-menu';menu.setAttribute('role','menu');wrap.appendChild(menu);
function ask(t,att){toggleAiChatbotWindow(true);setTimeout(function(){try{if(att&&epcCurrentQuestion()){epc.attach=true;epcRefreshContext()}sendAiChatMessage(t)}catch(e){}},250)}
function item(ic,l,fn){return{ic:ic,l:l,fn:fn}}
function items(){var a=[item('💬','Ask Pulse AI',function(){toggleAiChatbotWindow(true)})];
 if(inPractice()){a.push(item('💡','Hint, no spoilers',function(){ask('Give me a short hint for the question on my screen without revealing the answer.',1)}));a.push(item('🧠','Explain the concept',function(){ask('Explain the concept behind the question on my screen in simple steps.',1)}));a.push(item('🔤','Make a mnemonic',function(){ask('Give me a quick mnemonic to remember the key idea in the question on my screen.',1)}))}
 else{a.push(item('🎯','Quiz me (3 MCQs)',function(){ask('Ask me 3 quick NEET MCQs on my weakest chapter, one at a time.')}));a.push(item('🗓️','Plan my day',function(){ask('Make a realistic study plan for the rest of today based on my goal.')}))}
 a.push(item('🎉','Cheer me up',function(){P.mood('love');P.fx('fx-hop',1300);P.burst(true);P.say(P.pick(['Tum kar loge. Bas ek question aur.','Mehnat rang layegi, bhai.','Aaj ka din tumhara hai!']),3400,true)}));
 a.push(item(P.isCalm()?'🙂':'🤫',P.isCalm()?'Make Pulse playful':'Calm mode',function(){P.calm()}));return a}
function closeMenu(){menu.classList.remove('on')}
function openMenu(){menu.innerHTML='';var list=items();list.forEach(function(it,i){if(i===list.length-1)menu.appendChild(document.createElement('hr'));var b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.innerHTML='<span aria-hidden="true">'+it.ic+'</span>'+it.l;b.onclick=function(e){e.stopPropagation();closeMenu();it.fn()};menu.appendChild(b)});menu.classList.add('on');var f=menu.querySelector('button');f&&f.focus()}
var lp=null,lpOn=false,sx=0,sy=0;
btn.addEventListener('pointerdown',function(e){lpOn=false;sx=e.clientX;sy=e.clientY;clearTimeout(lp);lp=setTimeout(function(){lpOn=true;if(navigator.vibrate)try{navigator.vibrate(12)}catch(x){}P.mood('wow');openMenu()},520)});
btn.addEventListener('pointermove',function(e){if(lp&&Math.hypot(e.clientX-sx,e.clientY-sy)>8){clearTimeout(lp);lp=null}});
['pointerup','pointercancel','pointerleave'].forEach(function(t){btn.addEventListener(t,function(){clearTimeout(lp);lp=null})});
btn.addEventListener('click',function(e){if(lpOn){e.stopImmediatePropagation();e.preventDefault();lpOn=false}},true);
btn.addEventListener('contextmenu',function(e){e.preventDefault();openMenu()});
document.addEventListener('pointerdown',function(e){if(menu.classList.contains('on')&&!menu.contains(e.target)&&!btn.contains(e.target))closeMenu()},true);
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeMenu()});
})();

;

(function(){
var H2C='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',loading=null,ov=null,box=null,r=null,mode=null,sx=0,sy=0,r0=null,chatWas=false;
function toast(m,t){try{showToast(m,t||'info')}catch(e){}}
function load(){if(window.html2canvas)return Promise.resolve();if(loading)return loading;loading=new Promise(function(ok,no){var s=document.createElement('script');s.src=H2C;s.onload=ok;s.onerror=function(){loading=null;no(new Error('load'))};document.head.appendChild(s)});return loading}
function inPractice(){var m=document.getElementById('appModal');return !!(m&&m.classList.contains('open'))}
function paint(){box.style.left=r.x+'px';box.style.top=r.y+'px';box.style.width=r.w+'px';box.style.height=r.h+'px'}
function clamp(){var W=innerWidth,H=innerHeight,M=70;r.w=Math.max(M,Math.min(W,r.w));r.h=Math.max(M,Math.min(H,r.h));r.x=Math.max(0,Math.min(W-r.w,r.x));r.y=Math.max(0,Math.min(H-r.h,r.y))}
function close(reopen){if(ov){ov.remove();ov=null}document.removeEventListener('keydown',key,true);if(reopen&&chatWas){try{toggleAiChatbotWindow(true)}catch(e){}}}
function key(e){if(e.key==='Escape'){e.stopPropagation();close(true)}}
function start(){if(ov)return;var w=document.getElementById('ai-chatbot-window');chatWas=!!(w&&!w.classList.contains('hidden'));try{toggleAiChatbotWindow(false)}catch(e){}
 
 var W=innerWidth,H=innerHeight;r={x:Math.round(W*.06),y:Math.round(H*.2),w:Math.round(W*.88),h:Math.round(H*.38)};
 ov=document.createElement('div');ov.id='ep-snip';ov.setAttribute('role','dialog');ov.setAttribute('aria-label','Select an area to ask Pulse AI about');
 ov.innerHTML='<div class="sn-top"><b>Drag the box over what you need help with</b><small>A question, a diagram, or any part of the screen</small></div><div class="sn-box"><i data-h="tl"></i><i data-h="tr"></i><i data-h="bl"></i><i data-h="br"></i></div><div class="sn-bar"><button type="button" data-k="x">Cancel</button><button type="button" data-k="all">Whole screen</button><button type="button" class="sn-go" data-k="go">Ask Pulse AI</button></div>';
 document.body.appendChild(ov);box=ov.querySelector('.sn-box');paint();
 ov.addEventListener('pointerdown',function(e){if(e.target.closest('.sn-bar'))return;var h=e.target.closest('i[data-h]');if(h)mode=h.dataset.h;else if(e.target.closest('.sn-box'))mode='move';else{mode=null;return}
  sx=e.clientX;sy=e.clientY;r0={x:r.x,y:r.y,w:r.w,h:r.h};try{ov.setPointerCapture(e.pointerId)}catch(x){}e.preventDefault()});
 ov.addEventListener('pointermove',function(e){if(!mode)return;var dx=e.clientX-sx,dy=e.clientY-sy,M=70;
  if(mode==='move'){r.x=r0.x+dx;r.y=r0.y+dy;r.w=r0.w;r.h=r0.h}
  else{var x1=r0.x,y1=r0.y,x2=r0.x+r0.w,y2=r0.y+r0.h;if(mode.indexOf('l')>=0)x1=Math.min(x2-M,r0.x+dx);if(mode.indexOf('r')>=0)x2=Math.max(x1+M,x2+dx);if(mode.indexOf('t')>=0)y1=Math.min(y2-M,r0.y+dy);if(mode.indexOf('b')>=0)y2=Math.max(y1+M,y2+dy);
   x1=Math.max(0,x1);y1=Math.max(0,y1);x2=Math.min(innerWidth,x2);y2=Math.min(innerHeight,y2);r={x:x1,y:y1,w:x2-x1,h:y2-y1}}
  clamp();paint()});
 ['pointerup','pointercancel'].forEach(function(t){ov.addEventListener(t,function(){mode=null})});
 ov.querySelector('.sn-bar').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;if(b.dataset.k==='x')close(true);else if(b.dataset.k==='all'){r={x:0,y:0,w:innerWidth,h:innerHeight};paint();go()}else go()});
 document.addEventListener('keydown',key,true)}
var SKIPSEL='#ep-snip,#ep-mini,#ai-chatbot-widget,#toast-container,#epc-selpill';
var PROPS=['display','position','top','right','bottom','left','float','clear','z-index','box-sizing','width','height','min-width','min-height','max-width','max-height','margin-top','margin-right','margin-bottom','margin-left','padding-top','padding-right','padding-bottom','padding-left','border-top-width','border-right-width','border-bottom-width','border-left-width','border-top-style','border-right-style','border-bottom-style','border-left-style','border-top-color','border-right-color','border-bottom-color','border-left-color','border-top-left-radius','border-top-right-radius','border-bottom-right-radius','border-bottom-left-radius','background-color','background-image','background-size','background-position','background-repeat','background-clip','color','opacity','overflow-x','overflow-y','box-shadow','text-shadow','transform','transform-origin','translate','rotate','scale','filter','font-family','font-size','font-weight','font-style','line-height','letter-spacing','word-spacing','text-align','text-decoration-line','text-decoration-color','text-decoration-style','text-transform','text-overflow','white-space','word-break','overflow-wrap','vertical-align','list-style-type','flex-direction','flex-wrap','flex-grow','flex-shrink','flex-basis','justify-content','align-items','align-self','align-content','order','row-gap','column-gap','grid-template-columns','grid-template-rows','grid-column-start','grid-column-end','grid-row-start','grid-row-end','grid-auto-flow','grid-auto-columns','grid-auto-rows','object-fit','object-position','fill','stroke','stroke-width','-webkit-text-fill-color','-webkit-line-clamp','-webkit-box-orient','clip-path'];
function sty(cs){var t='';for(var i=0;i<PROPS.length;i++){var v=cs.getPropertyValue(PROPS[i]);if(!v)continue;if(/url\(/.test(v)&&!/url\(\s*["']?data:/.test(v))continue;t+=PROPS[i]+':'+v+';'}return t+'transition:none!important;animation:none!important;'}
function inter(r,R){return r.right>R.x&&r.left<R.x+R.w&&r.bottom>R.y&&r.top<R.y+R.h}
function blobToUrl(b){return new Promise(function(ok,no){var fr=new FileReader();fr.onload=function(){ok(String(fr.result))};fr.onerror=no;fr.readAsDataURL(b)})}
function render(R){
  var tasks=[],budget=3500;
  function leafImg(el,out,tag){
    if(tag==='img'){var src=el.currentSrc||el.src;if(!src){return}
      if(/^data:/.test(src)){out.setAttribute('src',src);return}
      try{var c=document.createElement('canvas');c.width=el.naturalWidth||1;c.height=el.naturalHeight||1;c.getContext('2d').drawImage(el,0,0);out.setAttribute('src',c.toDataURL('image/png'));return}catch(e){}
      tasks.push(fetch(src,{mode:'cors'}).then(function(r){return r.blob()}).then(blobToUrl).then(function(u){out.setAttribute('src',u)}).catch(function(){out.removeAttribute('src')}));
    }else if(tag==='canvas'){try{out.setAttribute('src',el.toDataURL('image/png'))}catch(e){}}
  }
  function cl(el,off){
    var tag=el.tagName.toLowerCase();
    if(/^(script|style|noscript|link|meta|template|iframe|video|audio|object|embed|head|title)$/.test(tag)) return null;
    if(el.matches&&el.matches(SKIPSEL)) return null;
    var cs=getComputedStyle(el); if(cs.display==='none') return null;
    var r=el.getBoundingClientRect();
    var isImg=tag==='img'||tag==='canvas';
    var out=document.createElement(tag==='body'||tag==='html'?'div':(tag==='canvas'?'img':tag));
    var st=sty(cs); if(off) st+='translate:'+(-off.x)+'px '+(-off.y)+'px;';
    var inl=/^inline$/.test(cs.display);
    if(!inl&&(!inter(r,R)||budget--<=0)){ out.setAttribute('style',st+'visibility:hidden;overflow:hidden;box-sizing:border-box;width:'+r.width+'px;height:'+r.height+'px;'); return out; }
    out.setAttribute('style',st);
    if(isImg){ leafImg(el,out,tag); return out; }
    if(el instanceof SVGElement && tag==='svg'){ var s=el.cloneNode(true); s.setAttribute('style',st+'color:'+cs.color+';'); s.setAttribute('width',r.width); s.setAttribute('height',r.height); return s; }
    if(tag==='input'||tag==='textarea'||tag==='select'){ try{ if(tag==='textarea') out.textContent=el.value; else out.setAttribute('value',el.value) }catch(e){} return out; }
    ['::before','::after'].forEach(function(ps){
      if(ps==='::after') return;
      pseudo(el,ps,out,true);
    });
    var childOff=(el.scrollTop||el.scrollLeft)?{x:el.scrollLeft,y:el.scrollTop}:null;
    for(var n=el.firstChild;n;n=n.nextSibling){
      if(n.nodeType===3){ out.appendChild(document.createTextNode(n.nodeValue)); }
      else if(n.nodeType===1){ var c=cl(n,childOff); if(c) out.appendChild(c); }
    }
    pseudo(el,'::after',out,false);
    return out;
  }
  function pseudo(el,ps,out,before){
    try{
      var pc=getComputedStyle(el,ps),c=pc.content;
      if(!c||c==='none'||c==='normal'||pc.display==='none') return;
      if(/awesome|fontawesome/i.test(pc.fontFamily)) return;
      var sp=document.createElement('span'); sp.setAttribute('style',sty(pc));
      var txt=/^(url|attr|counter|open-quote|close-quote)/.test(c)?'':c.replace(/^["']|["']$/g,'');
      sp.textContent=txt;
      if(before) out.insertBefore(sp,out.firstChild); else out.appendChild(sp);
    }catch(e){}
  }
  var bg=getComputedStyle(document.documentElement).backgroundColor,bb=getComputedStyle(document.body).backgroundColor;
  function solid(c){return c&&!/rgba\(0, 0, 0, 0\)|transparent/.test(c)}
  bg=solid(bb)?bb:(solid(bg)?bg:'#ffffff');
  var VW=innerWidth,VH=innerHeight;
  var root=cl(document.body,null); if(!root) return Promise.reject(new Error('empty'));
  var br=document.body.getBoundingClientRect();
  root.setAttribute('style',root.getAttribute('style')+'position:absolute;left:'+br.left+'px;top:'+br.top+'px;margin:0;width:'+br.width+'px;height:'+br.height+'px;');
  var wrap=document.createElement('div');
  wrap.setAttribute('style','position:relative;overflow:hidden;width:'+VW+'px;height:'+VH+'px;background:'+bg+';');
  wrap.appendChild(root);
  var done=Promise.race([Promise.all(tasks),new Promise(function(ok){setTimeout(ok,5000)})]);
  return done.then(function(){
    var xml=new XMLSerializer().serializeToString(wrap).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
    var sc=Math.min(1.5,window.devicePixelRatio||1);
    var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+R.w+'" height="'+R.h+'" viewBox="'+R.x+' '+R.y+' '+R.w+' '+R.h+'"><foreignObject x="0" y="0" width="'+VW+'" height="'+VH+'">'+xml+'</foreignObject></svg>';
    return new Promise(function(ok,no){
      var im=new Image(); im.onload=function(){
        try{var c=document.createElement('canvas');c.width=Math.round(R.w*sc);c.height=Math.round(R.h*sc);var x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);
          c.toBlob(function(b){b?ok(b):no(new Error('blob'))},'image/png')}catch(e){no(e)}};
      im.onerror=function(){no(new Error('svg'))};
      im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    });
  });
}
function textIn(R){
  var out=[],w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null),n,cnt=0,rg=document.createRange();
  while((n=w.nextNode())&&cnt++<25000){
    var v=n.nodeValue; if(!v||!v.trim()) continue; var p=n.parentElement; if(!p||/^(SCRIPT|STYLE|NOSCRIPT)$/.test(p.tagName)) continue;
    if(p.closest&&p.closest(SKIPSEL+',#ai-chatbot-window')) continue;
    rg.selectNodeContents(n); var rs=rg.getClientRects();
    for(var i=0;i<rs.length;i++){ var r=rs[i]; if(r.width>0&&r.height>0&&inter(r,R)){ out.push(v.replace(/\s+/g,' ').trim()); break; } }
  }
  return out.join(' ').slice(0,1500);
}
function fallback(R,err){
  var q=null;try{q=epcCurrentQuestion()}catch(e){}
  var t='';try{t=textIn(R)}catch(e){}
  close(false);
  try{
    if(t){ epc.sel=t; if(window.epcSelChip) epcSelChip(); }
    else if(q){ epc.attach=true; epcRefreshContext(); }
    toggleAiChatbotWindow(true);
  }catch(e){}
  try{console.warn('snip render failed',err)}catch(e){}
  toast("Couldn't take a picture here, so I attached the text inside your box"+(t||q?'.':'. Nothing readable was found.'),t||q?'warning':'error');
}
function go(){if(!ov)return;ov.classList.add('sn-busy');var R={x:r.x,y:r.y,w:r.w,h:r.h};ov.style.visibility='hidden';
 new Promise(function(res){requestAnimationFrame(function(){requestAnimationFrame(res)})}).then(function(){return render(R)}).then(function(b){
  close(false);toggleAiChatbotWindow(true);epcSetImage(new File([b],'screen-snip.png',{type:'image/png'}));
  toast('Snip attached. Type your doubt, or just tap send.','success');setTimeout(function(){var i=document.getElementById('ai-chat-input');i&&i.focus()},350)
 }).catch(function(err){fallback(R,err)})}
window.__epRender=render;
window.epSnip={start:start};
/* snip button in the chat composer */
function addBtn(){var b=document.getElementById('epc-image-btn');if(!b||document.getElementById('epc-snip-btn'))return;var n=document.createElement('button');n.type='button';n.id='epc-snip-btn';n.className='epc-round epc-image-btn epc-snip-btn';n.setAttribute('aria-label','Snip the screen and ask');n.title='Snip the screen and ask';n.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>';n.onclick=start;b.after(n)}
addBtn();
/* welcome back line + thumbs rating */
window.epcWelcomeLine=function(){try{var p=getAspirantProfile(),nm=p&&p.onboarded&&p.name&&String(p.name).toLowerCase()!=='aspirant'?String(p.name).trim().split(/\s+/)[0]:'';if(!nm)return '';
 var em=(p.avatar&&p.avatar.e)||'🧑‍🎓',g=getDailyGoal(),t=questionsSolvedToday(),st=0;try{st=getDayStreak()}catch(e){}
 var tx=document.createElement('div');tx.textContent=nm;return '<div class="epc-wb"><span class="av">'+em+'</span><span>Welcome back, '+tx.innerHTML+'!<small>'+t+'/'+g+' today'+(st>0?' · '+st+'-day streak':'')+'</small></span></div>'}catch(e){return ''}};
window.epcRate=function(i,v){var m=epc.history[i];if(!m)return;m.rate=m.rate===v?0:v;try{epcSave()}catch(e){}epcRender();if(m.rate)toast(v>0?'Glad that helped!':'Thanks. I will try to do better.','success')};
})();

;

/* write-behind for the question-stats store: every answer used to parse and rewrite the whole history (1 MB+ for heavy users).
   Reads come from memory, the write lands 0.7 s after the last answer, on tab hide, or on page close. */
(function(){
 if(typeof StorageModule==='undefined'||typeof STORAGE_KEYS==='undefined'||StorageModule.__wb)return;
 var K=STORAGE_KEYS.qstats,g=StorageModule.get,st=StorageModule.set,val=null,raw=null,dirty=false,tm=0;
 function flush(){clearTimeout(tm);tm=0;if(!dirty)return;dirty=false;
  try{var cur=localStorage.getItem(K);if(cur===null&&raw!==null){val=null;raw=null;return}
   var t=JSON.stringify(val);localStorage.setItem(K,t);raw=t}catch(e){val=null;raw=null}
  try{window.dispatchEvent(new CustomEvent('ep:store',{detail:{key:K}}))}catch(e){}}
 StorageModule.get=function(key,fb){
  if(key!==K)return g.apply(this,arguments);
  if(dirty)return val;
  try{var cur=localStorage.getItem(K);if(cur===null)return fb;if(val!==null&&cur===raw)return val;val=JSON.parse(cur);raw=cur;return val}catch(e){return g.apply(this,arguments)}};
 StorageModule.set=function(key,v){
  if(key!==K)return st.apply(this,arguments);
  val=v;dirty=true;if(!tm)tm=setTimeout(flush,700);return true};
 addEventListener('pagehide',flush);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')flush()});
 StorageModule.flushQstats=flush;StorageModule.__wb=1;
})();
(function(){
var E=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var F=function(s){try{return typeof formatQuizText==='function'?formatQuizText(s):E(s)}catch(e){return E(s)}};
var $=function(i){return document.getElementById(i)};
var tmr=0,shown=-1,STEP=44,W0=0,W1=-1,lastCur=-1,pop=-1,sOpen=false,sf='all',spg=0,PG=100,cache={};
var R=['Conceptual gap','Factual recall','Calculation error','Careless mistake','Time pressure'];
function s(p,w){w=w||18;return'<svg width="'+w+'" height="'+w+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>'}
var I={back:s('<path d="M19 12H5M11 6l-6 6 6 6"/>'),arr:s('<path d="M5 12h14M13 6l6 6-6 6"/>'),
 grid:s('<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>'),
 check:s('<path d="M5 12.5l4.5 4.5L19 7.5"/>',16),x:s('<path d="M6 6l12 12M18 6L6 18"/>',16),
 lock:s('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',16),flag:s('<path d="M5 21V4m0 0h12l-2 4 2 4H5"/>',16),
 clock:s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',14),bolt:s('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),mr:s('<circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/>'),
 bm:s('<path d="M6 3h12v18l-6-4-6 4z"/>'),sh:s('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'),spark:s('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',15),
 play:s('<path d="M8 5l11 7-11 7z"/>',15),book:s('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/>',15),
 help:s('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>',15),
 flame:s('<path d="M12 3c1 3.5 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/>',12),
 target:s('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',12),
 prev:s('<path d="M15 6l-6 6 6 6"/>',16),nextp:s('<path d="M9 6l6 6-6 6"/>',16)};
function fmt(x){x=Math.max(0,Math.round(x));return Math.floor(x/60)+':'+String(x%60).padStart(2,'0')}
function counts(){var a=quizState.userAnswers,Q=quizState.questions,r=0,n=0;for(var k in a){n++;var q=Q[k];if(q&&a[k]===q.correct)r++}return{n:n,r:r,w:n-r}}
function streak(){var a=quizState.userAnswers,Q=quizState.questions,i=quizState.currentIndex,run=0;if(a[i]===undefined)i--;while(i>=0&&a[i]!==undefined&&Q[i]&&a[i]===Q[i].correct){run++;i--}return run}
function tcls(i){var a=quizState.userAnswers[i],q=quizState.questions[i],c='t';
 if(a!==undefined)c+=a===q.correct?' ok':' no';else if(quizState.skippedQuestions&&quizState.skippedQuestions[i])c+=' sk';
 if(quizState.bookmarked&&quizState.bookmarked[i])c+=' bm';if(i===quizState.currentIndex)c+=' cur';return c}
function tile(i){return'<button type="button" class="'+tcls(i)+'" data-j="'+i+'" aria-label="Question '+(i+1)+'"'+(i===quizState.currentIndex?' aria-current="true"':'')+'>'+(i+1)+'</button>'}
/* windowed square palette: ~120 tiles exist at once, so 10k questions cost the same as 20. Updates touch only the tiles that changed. */
function palette(){var p=$('epq-pal');if(!p||quizState.infinite)return;var t=quizState.questions.length,c=quizState.currentIndex;
 if(!p.dataset.b||c<W0||c>W1||(W0>0&&c<W0+8)||(W1<t-1&&c>W1-8)){W0=Math.max(0,c-40);W1=Math.min(t-1,c+80);var h='';for(var i=W0;i<=W1;i++)h+=tile(i);p.innerHTML=h;p.dataset.b=1;
  var a=p.children[0],b=p.children[1];if(a&&b&&b.offsetLeft>a.offsetLeft)STEP=b.offsetLeft-a.offsetLeft;lastCur=-1}
 else{var ids=[c];if(lastCur>-1&&lastCur!==c)ids.push(lastCur);for(var k=0;k<ids.length;k++){var j=ids[k];if(j>=W0&&j<=W1){var el=p.children[j-W0];if(el){el.className=tcls(j);if(j===c)el.setAttribute('aria-current','true');else el.removeAttribute('aria-current')}}}}
 if(pop>-1&&pop>=W0&&pop<=W1){var pe=p.children[pop-W0];if(pe){pe.classList.add('pop');setTimeout(function(){pe.classList.remove('pop')},320)}pop=-1}
 var first=lastCur===-1,x=Math.max(0,(c-W0)*STEP-p.clientWidth/2+STEP/2);lastCur=c;
 requestAnimationFrame(function(){try{p.scrollTo({left:x,behavior:first?'auto':'smooth'})}catch(e){p.scrollLeft=x}})}
function infRow(){var st=quizState.infinite,el=$('epq-inf');if(!el||!st)return;
 try{var h=st.history||[],n=h.length,c=h.filter(function(x){return x.correct}).length,run=0;for(var i=n-1;i>=0&&h[i].correct;i--)run++;
  var lv=INF_LEVELS[st.level],bars='';for(var k=1;k<=5;k++)bars+='<i class="'+(k<=st.level?'on':'')+'"></i>';
  el.innerHTML='<span class="lv" aria-hidden="true">'+bars+'</span><span class="'+(lv.color||'')+'">'+E(lv.name)+'</span><span class="sok">\u2713 '+c+'/'+n+'</span><span>'+(n?Math.round(c/n*100):0)+'% accuracy</span><span style="color:var(--amb)">'+run+' streak</span>'+(st.fetching?'<span style="color:var(--acc)">Preparing next batch\u2026</span>':'')}catch(e){}}
function head(){var c=counts(),t=quizState.questions.length,inf=quizState.infinite,r=$('epq');if(!r)return;
 r.classList.toggle('inf',!!inf);
 var n=$('epq-cnt');if(n)n.textContent=inf?'Q'+(quizState.currentIndex+1):(quizState.currentIndex+1)+' / '+t;
 var st=$('epq-st');if(st)st.innerHTML='<span class="sok">\u2713 '+c.r+'</span><span class="sno">\u2717 '+c.w+'</span>';
 var b=$('epq-bar');if(b)b.style.transform='scaleX('+(t?c.n/t:0)+')';
 var ac=$('epq-ac');if(ac){var pc=c.n?Math.round(c.r/c.n*100):-1;ac.className='ac'+(pc<0?'':pc>=75?' hi':pc>=50?' mid':' lo');ac.innerHTML=I.target+(pc<0?'\u2013':pc+'%');ac.title=c.n?('Accuracy: '+c.r+' of '+c.n+' correct'):'Accuracy (answer a question to start)'}
 var sx=$('epq-sx'),run=streak();if(sx){sx.classList.toggle('on',run>=1);sx.innerHTML=I.flame+run;sx.title=run+' correct in a row'}
 if(inf)infRow();palette()}
function resultHtml(i,fx){var q=quizState.questions[i],a=quizState.userAnswers[i],right=a===q.correct,ex=q.explanation&&q.explanation!=='NCERT Concept.',rs=quizState.wrongReasons&&quizState.wrongReasons[i],rv='';
 if(!right){try{rv=window.EP&&EP.review?EP.review.statusHtml(q):''}catch(e){}}
 return'<div class="res '+(right?'ok':'no')+(fx?' fx':'')+'" id="quiz-result" tabindex="-1"><div class="rh"><span class="ri">'+(right?I.check:I.x)+'</span><div><h4>'+(right?'Correct':'Incorrect')+'</h4><small>Answer '+String.fromCharCode(65+q.correct)+' \u00b7 '+F(q.options[q.correct])+'</small></div></div>'+
 (ex?'<div class="ex">'+F(q.explanation)+'</div>':'')+(q.note?'<div class="nt">'+F(q.note)+'</div>':'')+
 (right?'':'<div class="why">'+rv+'<p>Why did you miss it?</p><div class="rs" role="group" aria-label="Why did you miss it?">'+R.map(function(x,k){return'<button type="button" data-r="'+k+'" aria-pressed="'+(rs===x)+'">'+x+'</button>'}).join('')+'</div></div>')+
 '<div class="act"><button class="ai" data-a="ai">'+I.spark+(ex?'Ask AI':'Explain with AI')+'</button><button data-a="yt">'+I.play+'Video</button>'+(q.ncert?'<button data-a="nc">'+I.book+'NCERT p. '+q.ncert.pg+'</button>':'')+'<button data-a="db">'+I.help+'Ask a doubt</button></div></div>'}
function footer(i){var t=quizState.questions.length,done=quizState.userAnswers[i]!==undefined,n=$('epq-nx'),last=i===t-1&&!quizState.infinite;
 n.querySelector('.lb').textContent=last?'Finish':'Next';n.dataset.s=done?(last?'flag':'arr'):'lock';n.dataset.l=done?'':'1';
 $('epq-sk').style.display=done?'none':'';$('epq-pv').disabled=i===0}
function startTimer(i){clearInterval(tmr);var tt=$('epq-tm');if(!tt)return;
 if(quizState.userAnswers[i]!==undefined){tt.textContent=fmt(quizState.questionTimes&&quizState.questionTimes[i]||0);return}
 tt.textContent=fmt((Date.now()-quizState.questionStartTimer)/1000);
 tmr=setInterval(function(){var e=$('epq-tm');if(!e){clearInterval(tmr);return}if(!document.hidden)e.textContent=fmt((Date.now()-quizState.questionStartTimer)/1000)},1000)}
function body(dir){var i=quizState.currentIndex,q=quizState.questions[i],a=quizState.userAnswers[i],done=a!==undefined,inf=quizState.infinite;
 var el=quizState.eliminatedOptions&&quizState.eliminatedOptions[i]||{},same=shown===i;
 if(!same&&!done)quizState.questionStartTimer=Date.now();
 var ops=q.options.map(function(o,k){var c='op';if(done){if(k===q.correct)c+=' ok';else if(k===a)c+=' no'}else if(el[k])c+=' x';
  var lt=done&&k===q.correct?I.check:done&&k===a?I.x:String.fromCharCode(65+k);
  return'<button type="button" class="'+c+'" data-o="'+k+'" role="radio" aria-checked="'+(a===k)+'" '+(done?'disabled':'')+'><b>'+lt+'</b><span>'+F(o)+'</span></button>'}).join('');
 var bm=quizState.bookmarked&&quizState.bookmarked[i],ex='';try{ex=typeof epExtras==='function'?epExtras(q):''}catch(e){}
 var dif=q.difficulty?String(q.difficulty):'',dc='d-'+dif.toLowerCase().replace(/[^a-z]/g,''),lvl='';
 if(inf){try{var L=INF_LEVELS[q.level||inf.level];lvl=' \u00b7 <span class="'+(L.color||'')+'">'+E(L.name)+'</span>'}catch(e){}}
 var ch=q.sourceChapter||quizState.chapter||'',yr=q.exam?q.exam:q.year?'NEET '+q.year:'';
 var bd=$('epq-body'),keep=same?bd.scrollTop:0;
 bd.innerHTML='<div class="wrap'+(dir&&!same?(dir>0?' a-r':' a-l'):'')+'"><div class="mh"><span class="eb">Question '+(i+1)+lvl+'</span><span class="sp"></span><button class="ib" data-a="sh" aria-label="Share question">'+I.sh+'</button><button class="ib" data-a="bm" aria-pressed="'+!!bm+'" aria-label="Bookmark question">'+I.bm+'</button><button class="ib" data-a="mr" aria-haspopup="menu" aria-expanded="false" aria-label="More study tools" title="More study tools">'+I.mr+'</button></div>'+
  '<div class="chips">'+(ch?'<span class="cp">'+E(ch)+'</span>':'')+(dif?'<span class="cp d '+dc+'">'+E(dif)+'</span>':'')+(yr?'<span class="cp">'+E(yr)+'</span>':'')+'</div>'+
  '<p class="q">'+F(q.question)+'</p>'+ex+'<div role="radiogroup" id="epq-ops" aria-label="Answer options">'+ops+'</div>'+(done?resultHtml(i,false):'')+'</div>';
 bd.scrollTop=keep;shown=i;footer(i);startTimer(i)}
function answered(){ /* in-place update: no re-render, no layout thrash */
 var i=quizState.currentIndex,q=quizState.questions[i],a=quizState.userAnswers[i],o=$('epq-ops');if(!o)return body();
 var b=o.children;for(var k=0;k<b.length;k++){var e=b[k];e.disabled=true;e.classList.remove('x');e.setAttribute('aria-checked',k===a);
  if(k===q.correct){e.classList.add('ok','fx');e.firstChild.innerHTML=I.check}else if(k===a){e.classList.add('no','fx');e.firstChild.innerHTML=I.x}}
 startTimer(i);o.insertAdjacentHTML('afterend',resultHtml(i,true));pop=i;footer(i);
 var lv=$('epq-live');if(lv)lv.textContent=(a===q.correct?'Correct.':'Incorrect.')+' Answer '+String.fromCharCode(65+q.correct);
 var bd=$('epq-body');requestAnimationFrame(function(){var r=$('quiz-result');if(r&&bd&&r.offsetTop+r.offsetHeight>bd.scrollTop+bd.clientHeight)bd.scrollTo({top:r.offsetTop+r.offsetHeight-bd.clientHeight+16,behavior:'smooth'})})}
/* palette sheet: full square grid, filters, go-to; built only when opened */
function sIdx(){var Q=quizState.questions,A=quizState.userAnswers,B=quizState.bookmarked||{},o=[],f=sf;
 for(var i=0;i<Q.length;i++){var a=A[i];if(f==='all'||(f==='left'&&a===undefined)||(f==='wrong'&&a!==undefined&&a!==Q[i].correct)||(f==='saved'&&B[i]))o.push(i)}return o}
function sheet(){var sp=$('epq-sp');if(!sp)return;var ix=sIdx(),pages=Math.max(1,Math.ceil(ix.length/PG));spg=Math.min(spg,pages-1);var lo=spg*PG,hi=Math.min(ix.length,lo+PG),c=counts(),t=quizState.questions.length;
 var h='<div class="sh-h"><div><h3>Question palette</h3><p>'+c.r+' correct \u00b7 '+c.w+' wrong \u00b7 '+(t-c.n)+' left</p></div><button type="button" class="ib" data-a="sx" aria-label="Close palette">'+I.x+'</button></div>'+
 '<div class="lg"><span><i class="sw ok"></i>Correct</span><span><i class="sw no"></i>Wrong</span><span><i class="sw"></i>Not attempted</span><span><i class="sw sk"></i>Skipped</span><span><i class="sw cur"></i>Current</span></div>'+
 '<div class="tools"><div class="fl" role="group" aria-label="Filter">'+[['all','All'],['left','Left'],['wrong','Wrong'],['saved','Saved']].map(function(f){return'<button type="button" data-f="'+f[0]+'" aria-pressed="'+(sf===f[0])+'">'+f[1]+'</button>'}).join('')+'</div>'+
 '<input class="go" id="epq-go" type="number" inputmode="numeric" min="1" max="'+t+'" placeholder="Go to" aria-label="Go to question number"></div>'+
 (pages>1?'<div class="pg"><button type="button" data-d="-1" aria-label="Previous page"'+(spg===0?' disabled':'')+'>'+I.prev+'</button><span>'+(ix.length?(ix[lo]+1)+'\u2013'+(ix[hi-1]+1):'0')+' of '+ix.length.toLocaleString('en-IN')+'</span><button type="button" data-d="1" aria-label="Next page"'+(spg>=pages-1?' disabled':'')+'>'+I.nextp+'</button></div>':'');
 if(!ix.length)h+='<div class="em">Nothing here yet.</div>';else{h+='<div class="gr">';for(var k=lo;k<hi;k++)h+=tile(ix[k]);h+='</div>'}
 sp.innerHTML=h}
function openSheet(){var sh=$('epq-sheet');if(!sh)return;sf='all';spg=Math.floor(quizState.currentIndex/PG);sheet();sOpen=true;sh.classList.add('open');sh.removeAttribute('aria-hidden');
 setTimeout(function(){var b=sh.querySelector('[data-a=sx]');b&&b.focus()},30)}
function closeSheet(){var sh=$('epq-sheet');if(!sh||!sOpen)return;sOpen=false;sh.classList.remove('open');sh.setAttribute('aria-hidden','true');var g=document.querySelector('#epq [data-a=grid]');g&&g.focus({preventScroll:true})}
function toggleBm(){var i=quizState.currentIndex,q=quizState.questions[i];if(!q)return;
 quizState.bookmarked=quizState.bookmarked||{};var on=!quizState.bookmarked[i];quizState.bookmarked[i]=on;
 try{var stats=StorageModule.get(STORAGE_KEYS.qstats,{}),key=q.qKey||(quizState.chapter+':'+i);stats[key]=Object.assign({},stats[key]||{},{bookmarked:on});
  if(quizState.subject&&quizState.subject!=='Mixed'&&!stats[key].ch){stats[key].sj=quizState.subject;stats[key].ch=q.sourceChapter||quizState.chapter}
  StorageModule.set(STORAGE_KEYS.qstats,stats)}catch(e){}
 try{persistQuizSession()}catch(e){}
 var b=document.querySelector('#epq [data-a=bm]');if(b)b.setAttribute('aria-pressed',String(on));
 var pl=$('epq-pal');if(pl&&i>=W0&&i<=W1){var te=pl.children[i-W0];if(te)te.className=tcls(i)}
 if(window.showToast)showToast(on?'Question bookmarked.':'Bookmark removed.','success')}
function shareQ(i){var q=quizState.questions[i];if(!q)return;
 try{if(typeof epShareQuestionImage==='function'){epShareQuestionImage(q,{subject:quizState.subject,chapter:q.sourceChapter||quizState.chapter});return}}catch(e){console.warn('image share failed, falling back to text',e)}
 var plain=function(v){return String(v==null?'':v).replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim()};
 var L='ABCDEFGH',txt='EduPulse question'+(quizState.chapter?' · '+plain(quizState.chapter):'')+'\n\n'+plain(q.question);
 (q.options||[]).forEach(function(o,k){txt+='\n('+L[k]+') '+plain(o)});
 var url='';try{url=/^https?:/.test(location.protocol)?location.origin+location.pathname:''}catch(e){}
 var done=function(m){if(window.showToast)showToast(m,'success')};
 var copy=function(){var full=txt+(url?'\n\n'+url:'');
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(full).then(function(){done('Question copied. Paste it anywhere to share.')},function(){if(window.showToast)showToast('Could not copy the question.','warning')})}
  else{try{var t=document.createElement('textarea');t.value=full;t.style.cssText='position:fixed;opacity:0';document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();done('Question copied. Paste it anywhere to share.')}catch(e){if(window.showToast)showToast('Could not copy the question.','warning')}}};
 if(navigator.share){var d={title:'EduPulse question',text:txt};if(url)d.url=url;navigator.share(d).catch(function(e){if(e&&e.name!=='AbortError')copy()})}else copy()}
function autoOn(){try{return localStorage.getItem('edupulse_autonext')==='1'}catch(e){return false}}
function key(e){var r=$('epq');if(!r){document.removeEventListener('keydown',key);return}
 if(e.key==='Escape'&&sOpen){e.preventDefault();closeSheet();return}
 if(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){if(e.key==='Enter'&&e.target.id==='epq-go'){e.preventDefault();var v=parseInt(e.target.value,10);if(v>=1&&v<=quizState.questions.length){closeSheet();jumpToPracticeQuestion(v-1)}e.target.blur()}return}
 if(sOpen||e.ctrlKey||e.metaKey||e.altKey)return;var k=e.key.toLowerCase(),map={a:0,b:1,c:2,d:3,'1':0,'2':1,'3':2,'4':3};
 if(e.target&&e.target.tagName==='BUTTON'&&(k==='enter'||k===' '))return;
 if(k==='m'){var bb=document.querySelector('#epq [data-a=bm]');if(bb)bb.click();return}
 if(k in map){var b=document.querySelector('#epq-ops .op[data-o="'+map[k]+'"]');if(b&&!b.disabled)b.click()}
 else if(k==='enter'||k==='arrowright'){$('epq-nx').click()}else if(k==='arrowleft'){var p=$('epq-pv');if(!p.disabled)p.click()}else if(k==='s'){var sk=$('epq-sk');if(sk.style.display!=='none')sk.click()}else if(k==='p'){openSheet()}}
function mount(){
 setModal('','','<div id="epq" data-m="practice" role="dialog" aria-label="Practice session"><div class="hd"><button class="ib" data-a="back" aria-label="Exit session">'+I.back+'</button><div class="tt"><h2>'+E(quizState.title)+'</h2><div class="sb"><span id="epq-cnt"></span><span id="epq-st"></span><span class="ac" id="epq-ac" title="Accuracy"></span><span class="sx" id="epq-sx" title="Correct in a row"></span></div></div>'+
 '<button class="ib auto" data-a="auto" aria-pressed="'+autoOn()+'" aria-label="Auto-advance after a correct answer" title="Auto-advance after a correct answer">'+I.bolt+'</button><span class="tm" title="Time on this question">'+I.clock+'<b id="epq-tm">0:00</b></span><button class="pill" data-a="end" aria-label="End session">End</button></div>'+
 '<div class="bar"><i id="epq-bar"></i></div><div class="infr" id="epq-inf"></div>'+
 '<div class="palw"><button type="button" class="gb" data-a="grid" aria-label="Open question palette" title="Question palette (P)">'+I.grid+'</button><div class="palx"><div class="pal" id="epq-pal" role="group" aria-label="Questions"></div></div></div>'+
 '<div class="bd" id="epq-body"></div><div class="sr" id="epq-live" aria-live="polite"></div>'+
 '<div class="ft"><button id="epq-pv" class="sq" data-a="pv" aria-label="Previous question">'+I.back+'</button><button id="epq-sk" class="gh" data-a="sk">Skip</button><button class="nx" id="epq-nx" data-a="nx" data-s="lock"><span class="lb">Next</span><i class="i-lock">'+I.lock+'</i><i class="i-arr">'+I.arr+'</i><i class="i-flag">'+I.flag+'</i></button><span class="kh">1\u20134 answer \u00b7 \u2190 \u2192 move \u00b7 M save \u00b7 S skip \u00b7 P palette</span></div>'+
 '<div class="sheet" id="epq-sheet" aria-hidden="true"><div class="sbk" data-a="sx"></div><div class="spn" id="epq-sp" role="dialog" aria-modal="true" aria-label="Question palette"></div></div></div>');
 var root=$('epq');shown=-1;W0=0;W1=-1;lastCur=-1;pop=-1;sOpen=false;
 root.addEventListener('click',function(e){var t=e.target.closest('button,.sbk');if(!t||!root.contains(t))return;
  if(t.dataset.o!==undefined){selectPracticeOption(+t.dataset.o);return}
  if(t.dataset.j!==undefined){if(sOpen)closeSheet();jumpToPracticeQuestion(+t.dataset.j);return}
  if(t.dataset.f){sf=t.dataset.f;spg=0;sheet();return}
  if(t.dataset.d){spg=Math.max(0,spg+(+t.dataset.d));sheet();return}
  if(t.dataset.r!==undefined){tagWrongReason(R[+t.dataset.r]);return}
  var a=t.dataset.a,i=quizState.currentIndex,last=i===quizState.questions.length-1&&!quizState.infinite;
  if(a==='back')confirmExitQuiz();else if(a==='end')finishPracticeQuiz();
  else if(a==='grid')openSheet();else if(a==='sx')closeSheet();
  else if(a==='pv')jumpToPracticeQuestion(Math.max(0,i-1));else if(a==='sk')skipCurrentQuestion();
  else if(a==='nx'){if(t.dataset.l){var b=$('epq-body');b.classList.remove('shake');void b.offsetWidth;b.classList.add('shake');return}last?finishPracticeQuiz():goToNextPracticeQuestion()}
  else if(a==='auto'){try{var on=autoOn();localStorage.setItem('edupulse_autonext',on?'0':'1');t.setAttribute('aria-pressed',String(!on));if(window.showToast)showToast(on?'Auto-advance off':'Auto-advance on: moves on after a correct answer')}catch(x){}}
  else if(a==='ai')showAiQuestionExplanation(i);else if(a==='yt')searchQuestionOnYouTube();else if(a==='db')openPracticeDoubt(i);
  else if(a==='nc'){var n=quizState.questions[i].ncert;epOpenNcert(n.b,n.pg,n.i)}
  else if(a==='bm')toggleBm();else if(a==='sh')shareQ(i);else if(a==='mr')epQaMenu(t,'more')});
 root.addEventListener('contextmenu',function(e){var o=e.target.closest('.op');if(o&&!o.disabled){e.preventDefault();toggleEliminatedOption(+o.dataset.o)}});
 var bd=$('epq-body');
 bd.addEventListener('touchstart',function(e){quizState.touchEndX=0;handleTouchStart(e)},{passive:true});bd.addEventListener('touchmove',handleTouchMove,{passive:true});bd.addEventListener('touchend',function(){handleTouchEnd()},{passive:true});
 document.removeEventListener('keydown',key);document.addEventListener('keydown',key)}
/* :has() rules make Chrome re-check the whole document after every DOM change; park them during practice, restore in original order after */
var parked=[];
function park(){if(parked.length)return;
 function scan(c){var L;try{L=c.cssRules}catch(e){return}for(var i=L.length-1;i>=0;i--){var r=L[i];
  if(r.selectorText){if(r.selectorText.indexOf(':has(')>-1){parked.push({c:c,i:i,t:r.cssText});c.deleteRule(i)}}
  else if(r.cssRules&&r.cssRules.length)scan(r)}}
 for(var s=0;s<document.styleSheets.length;s++)scan(document.styleSheets[s])}
function unpark(){if(!parked.length)return;var by=new Map();parked.forEach(function(x){if(!by.has(x.c))by.set(x.c,[]);by.get(x.c).push(x)});
 by.forEach(function(a,c){a.sort(function(x,y){return x.i-y.i});a.forEach(function(x){try{c.insertRule(x.t,x.i)}catch(e){}})});parked=[]}
window.__epqPark=park;window.__epqUnpark=unpark;
window.renderPracticeQuiz=function(){
 var q=quizState.questions[quizState.currentIndex];if(!q)return;
 toggleFullScreenMode(true);document.body.classList.add('ep-practicing');
 var _r=$('epq'),_m=document.getElementById('appModal');if(!_r||_r.dataset.m!=='practice'||!(_m&&_m.classList.contains('open'))){if(_r)_r.remove();park();mount()}
 var cur=quizState.currentIndex,dir=shown>-1&&shown!==cur?(cur>shown?1:-1):0;
 if(shown===cur&&quizState.userAnswers[shown]!==undefined&&document.querySelector('#epq-ops .op:not([disabled])'))answered();
 else body(dir);
 head()};
setInterval(function(){if(document.body.classList.contains('ep-practicing')&&!$('epq')){document.body.classList.remove('ep-practicing');clearInterval(tmr);sOpen=false;unpark()}},400);
})();

;

(function(){
if(window.__epTestV11)return;window.__epTestV11=1;
var E=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var F=function(s){try{return typeof formatQuizText==='function'?formatQuizText(s):E(s)}catch(e){return E(s)}};
var $=function(i){return document.getElementById(i)};
var shown=-1,sOpen=false,sf='all',spg=0,PG=100,STEP=44,W0=0,W1=-1,lastCur=-1;
function s(p,w){w=w||18;return'<svg width="'+w+'" height="'+w+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>'}
var I={back:s('<path d="M19 12H5M11 6l-6 6 6 6"/>'),arr:s('<path d="M5 12h14M13 6l6 6-6 6"/>'),
 grid:s('<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>'),
 x:s('<path d="M6 6l12 12M18 6L6 18"/>',16),flag:s('<path d="M5 21V4m0 0h12l-2 4 2 4H5"/>',16),clock:s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',14),
 flame:s('<path d="M12 3c1 3.5 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/>',12),
 target:s('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',12),
 prev:s('<path d="M15 6l-6 6 6 6"/>',16),nextp:s('<path d="M9 6l6 6-6 6"/>',16)};
function Qs(){return quizState.questions||[]}
function clock(sec){sec=Math.max(0,sec);var h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),x=sec%60;return(h?h+':'+String(m).padStart(2,'0'):String(m).padStart(2,'0'))+':'+String(x).padStart(2,'0')}
function counts(){var a=quizState.userAnswers,Q=Qs(),r=0,n=0;for(var k in a){n++;var q=Q[k];if(q&&a[k]===q.correct)r++}return{n:n,r:r,w:n-r}}
function markedN(){var m=quizState.marked||{},n=0;for(var k in m)if(m[k])n++;return n}
function streak(){var a=quizState.userAnswers,Q=Qs(),i=quizState.currentIndex,run=0;if(a[i]===undefined)i--;while(i>=0&&a[i]!==undefined&&Q[i]&&a[i]===Q[i].correct){run++;i--}return run}
function tcls(i){var c='t';if(quizState.userAnswers[i]!==undefined)c+=' an';if(quizState.marked&&quizState.marked[i])c+=' mk';if(i===quizState.currentIndex)c+=' cur';return c}
function tile(i){var a=quizState.userAnswers[i]!==undefined,m=quizState.marked&&quizState.marked[i];
 return'<button type="button" class="'+tcls(i)+'" data-j="'+i+'" aria-label="Question '+(i+1)+(a?', answered':'')+(m?', marked for review':'')+'"'+(i===quizState.currentIndex?' aria-current="true"':'')+'>'+(i+1)+'</button>'}

/* countdown: same interval the old test screen used, now drawn in the practice-style header */
function tick(){var el=$('test-timer-display'),left=Math.max(0,Math.floor((quizState.testEndTimestamp-Date.now())/1000));
 if(el){el.textContent=clock(left);if(el.parentNode)el.parentNode.classList.toggle('low',left<=300)}
 if(left<=0){clearInterval(quizState.timerInterval);quizState.timerInterval=null;submitTestQuiz(true)}}
function ensureTimer(){if(!quizState.timerInterval)quizState.timerInterval=setInterval(tick,1000);tick()}

function head(){var r=$('epq');if(!r)return;var t=Qs().length,c=counts();
 var n=$('epq-cnt');if(n)n.textContent=(quizState.currentIndex+1)+' / '+t;
 var st=$('epq-st');if(st)st.innerHTML='<span class="ans">'+c.n+' answered</span>';
 var b=$('epq-bar');if(b)b.style.transform='scaleX('+(t?c.n/t:0)+')';
 var ac=$('epq-ac');if(ac){var pc=c.n?Math.round(c.r/c.n*100):-1;ac.className='ac'+(pc<0?'':pc>=75?' hi':pc>=50?' mid':' lo');ac.innerHTML=I.target+(pc<0?'\u2013':pc+'%');ac.title=c.n?('Accuracy: '+c.r+' of '+c.n+' correct'):'Accuracy (answer a question to start)'}
 var sx=$('epq-sx'),run=streak();if(sx){sx.classList.toggle('on',run>=1);sx.innerHTML=I.flame+run;sx.title=run+' correct in a row'}}
function footer(i){var t=Qs().length,last=i===t-1,n=$('epq-nx');if(!n)return;
 n.querySelector('.lb').textContent=last?'Review & submit':'Next';n.dataset.s=last?'flag':'arr';
 var c=$('epq-sk');if(c)c.disabled=quizState.userAnswers[i]===undefined;var p=$('epq-pv');if(p)p.disabled=i===0}
function body(dir){var i=quizState.currentIndex,q=Qs()[i],a=quizState.userAnswers[i],mk=!!(quizState.marked&&quizState.marked[i]),same=shown===i;
 var ops=q.options.map(function(o,k){var img='';try{img=typeof epOptImg==='function'?epOptImg(q,k):''}catch(e){}
  return'<button type="button" class="op'+(a===k?' sel':'')+'" data-o="'+k+'" role="radio" aria-checked="'+(a===k)+'"><b>'+String.fromCharCode(65+k)+'</b><span>'+F(o)+img+'</span></button>'}).join('');
 var ex='';try{ex=typeof epExtras==='function'?epExtras(q):''}catch(e){}
 var dif=q.difficulty?String(q.difficulty):'',dc='d-'+dif.toLowerCase().replace(/[^a-z]/g,''),ch=q.sourceChapter||quizState.chapter||'',yr=q.exam?q.exam:q.year?'NEET '+q.year:'';
 var bd=$('epq-body'),keep=same?bd.scrollTop:0;
 bd.innerHTML='<div class="wrap'+(dir&&!same?(dir>0?' a-r':' a-l'):'')+'"><div class="mh"><span class="eb">Question '+(i+1)+'</span><span class="sp"></span><button type="button" class="mkb" data-a="mk" aria-pressed="'+mk+'">'+I.flag+'<span>'+(mk?'Marked':'Mark for review')+'</span></button></div>'+
  '<div class="chips">'+(ch?'<span class="cp">'+E(ch)+'</span>':'')+(dif?'<span class="cp d '+dc+'">'+E(dif)+'</span>':'')+(yr?'<span class="cp">'+E(yr)+'</span>':'')+'</div>'+
  '<p class="q">'+F(q.question)+'</p>'+ex+'<div role="radiogroup" id="epq-ops" aria-label="Answer options">'+ops+'</div></div>';
 bd.scrollTop=keep;shown=i;footer(i)}
function sync(){var i=quizState.currentIndex,a=quizState.userAnswers[i],o=$('epq-ops');if(!o)return body(0);
 var b=o.children;for(var k=0;k<b.length;k++){var on=a===k;b[k].classList.toggle('sel',on);b[k].setAttribute('aria-checked',on)}
 var mb=document.querySelector('#epq [data-a=mk]');if(mb){var mk=!!(quizState.marked&&quizState.marked[i]);mb.setAttribute('aria-pressed',String(mk));var sp=mb.querySelector('span');if(sp)sp.textContent=mk?'Marked':'Mark for review'}
 footer(i)}
function palette(){var p=$('epq-pal');if(!p)return;var t=Qs().length,c=quizState.currentIndex;
 if(!p.dataset.b||c<W0||c>W1||(W0>0&&c<W0+8)||(W1<t-1&&c>W1-8)){W0=Math.max(0,c-40);W1=Math.min(t-1,c+80);var h='';for(var i=W0;i<=W1;i++)h+=tile(i);p.innerHTML=h;p.dataset.b=1;
  var a=p.children[0],b=p.children[1];if(a&&b&&b.offsetLeft>a.offsetLeft)STEP=b.offsetLeft-a.offsetLeft;lastCur=-1}
 else{var ids=[c];if(lastCur>-1&&lastCur!==c)ids.push(lastCur);for(var k=0;k<ids.length;k++){var j=ids[k];if(j>=W0&&j<=W1){var el=p.children[j-W0];if(el){el.className=tcls(j);if(j===c)el.setAttribute('aria-current','true');else el.removeAttribute('aria-current')}}}}
 var first=lastCur===-1,x=Math.max(0,(c-W0)*STEP-p.clientWidth/2+STEP/2);lastCur=c;
 requestAnimationFrame(function(){try{p.scrollTo({left:x,behavior:first?'auto':'smooth'})}catch(e){p.scrollLeft=x}})}

/* palette sheet + submit confirmation share one bottom sheet */
function sIdx(){var Q=Qs(),A=quizState.userAnswers,M=quizState.marked||{},o=[];
 for(var i=0;i<Q.length;i++){var a=A[i];if(sf==='all'||(sf==='left'&&a===undefined)||(sf==='marked'&&M[i])||(sf==='done'&&a!==undefined))o.push(i)}return o}
function sheet(){var sp=$('epq-sp');if(!sp)return;var ix=sIdx(),pages=Math.max(1,Math.ceil(ix.length/PG));spg=Math.min(spg,pages-1);var lo=spg*PG,hi=Math.min(ix.length,lo+PG),c=counts(),t=Qs().length;
 var h='<div class="sh-h"><div><h3>Question palette</h3><p>'+c.n+' answered \u00b7 '+markedN()+' marked \u00b7 '+(t-c.n)+' left</p></div><button type="button" class="ib" data-a="sx" aria-label="Close palette">'+I.x+'</button></div>'+
 '<div class="lg"><span><i class="sw an"></i>Answered</span><span><i class="sw mk"></i>Marked</span><span><i class="sw"></i>Not answered</span><span><i class="sw cur"></i>Current</span></div>'+
 '<div class="tools"><div class="fl" role="group" aria-label="Filter">'+[['all','All'],['left','Left'],['marked','Marked'],['done','Answered']].map(function(f){return'<button type="button" data-f="'+f[0]+'" aria-pressed="'+(sf===f[0])+'">'+f[1]+'</button>'}).join('')+'</div>'+
 '<input class="go" id="epq-go" type="number" inputmode="numeric" min="1" max="'+t+'" placeholder="Go to" aria-label="Go to question number"></div>'+
 (pages>1?'<div class="pg"><button type="button" data-d="-1" aria-label="Previous page"'+(spg===0?' disabled':'')+'>'+I.prev+'</button><span>'+(ix.length?(ix[lo]+1)+'\u2013'+(ix[hi-1]+1):'0')+' of '+ix.length.toLocaleString('en-IN')+'</span><button type="button" data-d="1" aria-label="Next page"'+(spg>=pages-1?' disabled':'')+'>'+I.nextp+'</button></div>':'');
 if(!ix.length)h+='<div class="em">Nothing here yet.</div>';else{h+='<div class="gr">';for(var k=lo;k<hi;k++)h+=tile(ix[k]);h+='</div>'}
 sp.innerHTML=h}
function openSheet(){var sh=$('epq-sheet');if(!sh)return;sf='all';spg=Math.floor(quizState.currentIndex/PG);sheet();sOpen=true;sh.classList.add('open');sh.removeAttribute('aria-hidden')}
function closeSheet(){var sh=$('epq-sheet');if(!sh||!sOpen)return;sOpen=false;sh.classList.remove('open');sh.setAttribute('aria-hidden','true')}
function confirmSheet(){var sh=$('epq-sheet'),sp=$('epq-sp');if(!sh||!sp)return;var t=Qs().length,c=counts();
 sp.innerHTML='<div class="sh-h"><div><h3>Submit test?</h3><p>Answers can\u2019t be changed after you submit.</p></div><button type="button" class="ib" data-a="sx" aria-label="Close">'+I.x+'</button></div>'+
 '<div class="cfs"><div><b>'+c.n+'</b><small>Answered</small></div><div><b>'+(t-c.n)+'</b><small>Not answered</small></div><div><b>'+markedN()+'</b><small>Marked</small></div></div>'+
 '<div class="cfa"><button type="button" data-a="sx">Keep going</button><button type="button" class="pr" data-a="sub">Submit test</button></div>';
 sOpen=true;sh.classList.add('open');sh.removeAttribute('aria-hidden')}
function clearAns(){var i=quizState.currentIndex;if(quizState.userAnswers[i]===undefined)return;recordCurrentTestQuestionTime();delete quizState.userAnswers[i];renderTestQuiz()}

function onClick(e){var root=$('epq');var t=e.target.closest('button,.sbk');if(!t||!root||!root.contains(t))return;
 if(t.dataset.o!==undefined){selectTestOption(+t.dataset.o);return}
 if(t.dataset.j!==undefined){closeSheet();jumpToTestQuestion(+t.dataset.j);return}
 if(t.dataset.f){sf=t.dataset.f;spg=0;sheet();return}
 if(t.dataset.d){spg=Math.max(0,spg+(+t.dataset.d));sheet();return}
 var a=t.dataset.a,i=quizState.currentIndex,last=i===Qs().length-1;
 if(a==='back')confirmExitQuiz();
 else if(a==='end')confirmSheet();
 else if(a==='sub'){closeSheet();submitTestQuiz(false)}
 else if(a==='grid')openSheet();else if(a==='sx')closeSheet();
 else if(a==='pv')jumpToTestQuestion(Math.max(0,i-1));
 else if(a==='nx'){if(last)confirmSheet();else jumpToTestQuestion(i+1)}
 else if(a==='clr')clearAns();
 else if(a==='mk')toggleMarkTestCurrent()}
function key(e){var r=$('epq');if(!r||r.dataset.m!=='test'){document.removeEventListener('keydown',key);return}
 if(e.key==='Escape'&&sOpen){e.preventDefault();closeSheet();return}
 if(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){if(e.key==='Enter'&&e.target.id==='epq-go'){e.preventDefault();var v=parseInt(e.target.value,10);if(v>=1&&v<=Qs().length){closeSheet();jumpToTestQuestion(v-1)}e.target.blur()}return}
 if(sOpen||e.ctrlKey||e.metaKey||e.altKey)return;var k=e.key.toLowerCase(),map={a:0,b:1,c:2,d:3,'1':0,'2':1,'3':2,'4':3};
 if(e.target&&e.target.tagName==='BUTTON'&&(k==='enter'||k===' '))return;
 if(k==='m')toggleMarkTestCurrent();
 else if(k in map){var q=Qs()[quizState.currentIndex];if(q&&map[k]<q.options.length)selectTestOption(map[k])}
 else if(k==='enter'||k==='arrowright'){var nx=$('epq-nx');if(nx)nx.click()}
 else if(k==='arrowleft'){var p=$('epq-pv');if(p&&!p.disabled)p.click()}
 else if(k==='p')openSheet()}

function mount(){
 setModal('','','<div id="epq" data-m="test" role="dialog" aria-label="Test session"><div class="hd"><button class="ib" data-a="back" aria-label="Exit test">'+I.back+'</button><div class="tt"><h2>'+E(quizState.title)+'</h2><div class="sb"><span id="epq-cnt"></span><span id="epq-st"></span><span class="ac" id="epq-ac"></span><span class="sx" id="epq-sx"></span></div></div>'+
 '<span class="tm cd" title="Time left">'+I.clock+'<b id="test-timer-display">--:--</b></span><button class="pill sub" data-a="end" aria-label="Submit test">Submit</button></div>'+
 '<div class="bar"><i id="epq-bar"></i></div>'+
 '<div class="palw"><button type="button" class="gb" data-a="grid" aria-label="Open question palette" title="Question palette (P)">'+I.grid+'</button><div class="palx"><div class="pal" id="epq-pal" role="group" aria-label="Questions"></div></div></div>'+
 '<div class="bd" id="epq-body"></div><div class="sr" id="epq-live" aria-live="polite"></div>'+
 '<div class="ft"><button id="epq-pv" class="sq" data-a="pv" aria-label="Previous question">'+I.back+'</button><button id="epq-sk" class="gh" data-a="clr" aria-label="Clear answer">Clear</button><button class="nx" id="epq-nx" data-a="nx" data-s="arr"><span class="lb">Next</span><i class="i-arr">'+I.arr+'</i><i class="i-flag">'+I.flag+'</i></button><span class="kh">1\u20134 answer \u00b7 \u2190 \u2192 move \u00b7 M mark \u00b7 P palette</span></div>'+
 '<div class="sheet" id="epq-sheet" aria-hidden="true"><div class="sbk" data-a="sx"></div><div class="spn" id="epq-sp" role="dialog" aria-modal="true" aria-label="Question palette"></div></div></div>');
 var root=$('epq');shown=-1;W0=0;W1=-1;lastCur=-1;sOpen=false;
 root.addEventListener('click',onClick);
 var bd=$('epq-body');
 bd.addEventListener('touchstart',function(e){quizState.touchEndX=0;handleTouchStart(e)},{passive:true});bd.addEventListener('touchmove',handleTouchMove,{passive:true});bd.addEventListener('touchend',function(){handleTouchEnd()},{passive:true});
 document.removeEventListener('keydown',key);document.addEventListener('keydown',key)}

window.renderTestQuiz=function(){
 var q=Qs()[quizState.currentIndex];if(!q)return;
 quizState.marked=quizState.marked||{};
 toggleFullScreenMode(true);document.body.classList.add('ep-practicing');
 var r=$('epq'),m=$('appModal');
 if(!r||r.dataset.m!=='test'||!(m&&m.classList.contains('open'))){if(r)r.remove();if(window.__epqPark)window.__epqPark();mount()}
 ensureTimer();
 var cur=quizState.currentIndex,dir=shown>-1&&shown!==cur?(cur>shown?1:-1):0;
 if(shown===cur)sync();else body(dir);
 head();palette()};
})();

;

(function(){
  if(window.__epPcxMoreFix)return;window.__epPcxMoreFix=1;
  function closeAll(except){
    document.querySelectorAll('details.pcx-more[open]').forEach(function(d){if(d!==except)d.removeAttribute('open');});
  }
  /* opening one menu closes the others; flip upward if it would run off-screen */
  document.addEventListener('toggle',function(e){
    var d=e.target;
    if(!d||!d.classList||!d.classList.contains('pcx-more'))return;
    d.classList.remove('up');
    if(!d.open)return;
    closeAll(d);
    var t=d.querySelector('.pc-tools');if(!t)return;
    var r=t.getBoundingClientRect(),s=d.getBoundingClientRect();
    if(r.bottom>window.innerHeight-8&&s.top-r.height-12>8)d.classList.add('up');
  },true);
  /* tap outside closes; choosing an action closes after it runs */
  document.addEventListener('click',function(e){
    var inside=e.target.closest&&e.target.closest('details.pcx-more');
    if(!inside){closeAll();return;}
    if(e.target.closest('.pc-tools .pc-ibtn')){setTimeout(function(){closeAll();},0);}
  });
  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape')return;
    var d=document.querySelector('details.pcx-more[open]');
    if(d){d.removeAttribute('open');var sm=d.querySelector('summary');if(sm)sm.focus();}
  });
  /* re-rendering the chapter list or scrolling the page shouldn't leave a stray menu open */
  window.addEventListener('scroll',function(){closeAll();},{passive:true});
})();

;

(function(){
  if(window.__epMoreMenuV2)return;window.__epMoreMenuV2=1;

  var TK={explain:1,mnemonic:1,reveal:1,more:1,easier:1,harder:1,retry:1,focus:1,copy:1,share:1,image:1,bookmark:1};

  function Q(){try{return quizState.questions[quizState.currentIndex]||null}catch(e){return null}}
  function IDX(){try{return quizState.currentIndex||0}catch(e){return 0}}
  function toast(m,t){try{showToast(m,t||'info')}catch(e){}}
  function api(){return window.epToolkitAPI||null}
  function clickIf(sel){var el=document.querySelector(sel);if(el){el.click();return true}return false}
  function toolkitBtn(a){return document.querySelector('#normal-practice-toolkit [data-action="'+a+'"]')}
  function unavailable(){toast('That tool is not available on this screen','warning')}

  /* run a toolkit action: via its panel button when mounted, otherwise straight through the handler */
  function viaToolkit(a){
    var b=toolkitBtn(a);if(b){b.click();return}
    if(a==='more'&&typeof questionGeneratorModal==='function'){questionGeneratorModal(Q());return}
    if(api())api().action(a);else unavailable();
  }

  /* tools that never lived in the toolkit */
  var EXTRA={
    aiexplain:function(){typeof showAiQuestionExplanation==='function'?showAiQuestionExplanation(IDX()):unavailable()},
    video:function(){typeof searchQuestionOnYouTube==='function'?searchQuestionOnYouTube():unavailable()},
    doubt:function(){typeof openPracticeDoubt==='function'?openPracticeDoubt(IDX()):unavailable()},
    ncert:function(){var n=Q()&&Q().ncert;if(n&&typeof epOpenNcert==='function')epOpenNcert(n.b,n.pg,n.i);else toast('No NCERT reference for this question','info')},
    flag:function(){if(!clickIf('.quiz-session-layout .bz-flag'))unavailable()},
    flash:function(){if(window.epAddFlashcard)epAddFlashcard();else if(!clickIf('.ep52-act [data-a="add"]'))toast('Flashcards are not available on this screen','warning')},
    similar:function(){if(window.epSimilarQuestion)epSimilarQuestion();else if(!clickIf('.ep52-act [data-a="sim"]'))toast('Similar questions are not available on this screen','warning')},
    autonext:function(){if(!clickIf('#epq [data-a="auto"]')){typeof togglePqAutoNext==='function'?togglePqAutoNext():unavailable()}}
  };

  var prevQa=window.epQa;
  window.epQa=function(a,btn){
    if(EXTRA[a]){try{epQaClose()}catch(e){}return EXTRA[a]()}
    if(a==='notes'){try{epQaClose()}catch(e){}return window.epQaNotes()}
    if(TK[a]&&!toolkitBtn(a)){try{epQaClose()}catch(e){}return viaToolkit(a)}
    return prevQa.apply(this,arguments);
  };

  /* Notes & confidence: reads/writes the same storage as the toolkit, so it works with or without the panel */
  window.epQaNotes=function(){
    var A=api(),q=Q();
    if(!A||!q){toast('Notes are not available on this screen','warning');return}
    var id=A.questionId(q),conf=A.readStore(A.CONFIDENCE_KEY,{}),notes=A.readStore(A.NOTES_KEY,{});
    var old=document.getElementById('ep-notes-sheet');if(old)old.remove();
    var wrap=document.createElement('div');wrap.id='ep-notes-sheet';
    wrap.innerHTML='<div class="ep-ns-card" role="dialog" aria-label="Notes and confidence"><div class="ep-ns-h"><b>Notes &amp; confidence</b><button type="button" class="ep-ns-x" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div><label>Confidence before answer<select><option value="0">Not rated</option><option value="1">1 · Guessing</option><option value="2">2 · Unsure</option><option value="3">3 · Fairly sure</option><option value="4">4 · Confident</option><option value="5">5 · Certain</option></select></label><label>Private revision note<textarea rows="4" placeholder="Add a reminder for next time..."></textarea></label></div>';
    var sel=wrap.querySelector('select'),ta=wrap.querySelector('textarea');
    sel.value=String(conf[id]||0);ta.value=notes[id]||'';
    function mirror(){
      var p=document.getElementById('normal-practice-toolkit');if(!p)return;
      var c=p.querySelector('[data-confidence]'),n=p.querySelector('[data-note]');
      if(c)c.value=sel.value;if(n)n.value=ta.value;
    }
    sel.addEventListener('change',function(){var c=A.readStore(A.CONFIDENCE_KEY,{});c[id]=Number(sel.value)||0;A.writeStore(A.CONFIDENCE_KEY,c);mirror();if(sel.value!=='0')toast('Confidence rating saved.','success')});
    ta.addEventListener('change',function(){var n=A.readStore(A.NOTES_KEY,{});n[id]=ta.value.trim();A.writeStore(A.NOTES_KEY,n);mirror();toast('Revision note saved on this device.','success')});
    function close(){var ae=document.activeElement;if(ae===ta||ae===sel)ae.blur();wrap.remove()}
    wrap.addEventListener('click',function(e){if(e.target===wrap||e.target.closest('.ep-ns-x'))close()});
    document.body.appendChild(wrap);
  };

  /* menus */
  var SHARE=[['image','fa-image','Share as image'],['share','fa-share-nodes','Share as text'],['copy','fa-copy','Copy question'],['cl_chat','fa-user-group','Send to a chat'],['cl_ask','fa-circle-question','Ask in Doubts'],['cl_thr','fa-comment-dots','Start a thread']];

  function moreGroups(){
    var q=Q(),inf=false,marked=false,auto=false;
    try{inf=!!quizState.infinite;marked=!!(quizState.marked&&quizState.marked[IDX()])}catch(e){}
    var epq=!!document.getElementById('epq');
    var ab=document.querySelector('#epq [data-a="auto"],.pq-auto');if(ab)auto=ab.getAttribute('aria-pressed')==='true'||ab.classList.contains('on');
    var practice=[];
    if(!epq)practice.push(['flag','fa-thumbtack',marked?'Remove review flag':'Mark for review']);
    practice.push(['flash','fa-layer-group','Add to flashcards'],['similar','fa-shuffle','Similar question'],['retry','fa-rotate','Retry mistakes'],['focus','fa-stopwatch','25-min focus']);
    if(epq||(!inf&&typeof togglePqAutoNext==='function'))practice.push(['autonext','fa-forward','Auto-advance '+(auto?'(on)':'(off)')]);
    return [
      ['Understand',[['explain','fa-lightbulb','Explain simply'],['mnemonic','fa-brain','Memory trick'],['aiexplain','fa-wand-magic-sparkles','AI explanation'],['video','fa-brands fa-youtube','Video explanation'],['doubt','fa-comments','Ask a doubt'],q&&q.ncert?['ncert','fa-book-open','View in NCERT']:null,['reveal','fa-eye','Reveal answer'],['notes','fa-note-sticky','Notes & confidence']]],
      ['Adjust with AI',[['more','fa-clone','More like this'],['easier','fa-feather-pointed','Make it easier'],['harder','fa-mountain','Make it harder']]],
      ['Practice',practice],
      ['Save & share',SHARE],
      ['',[['report','fa-flag','Report question']]]
    ];
  }

  function item(e){
    var cls=e[1].indexOf(' ')>0?e[1]:'fa-solid '+e[1];
    return '<button type="button" role="menuitem" class="ep-pop-item" data-a="'+e[0]+'"><i class="'+cls+'" aria-hidden="true"></i><span>'+e[2]+'</span></button>';
  }

  window.epQaMenu=function(btn,kind){
    var was=btn.getAttribute('aria-expanded')==='true';
    epQaClose();
    if(was)return;
    var html='';
    if(kind==='share'){html=SHARE.map(item).join('')}
    else{
      moreGroups().forEach(function(g,i){
        var rows=g[1].filter(Boolean);if(!rows.length)return;
        html+=g[0]?'<div class="ep-pop-h" role="presentation">'+g[0]+'</div>':'<div class="ep-pop-sep" role="separator"></div>';
        html+=rows.map(item).join('');
      });
    }
    var pop=document.createElement('div');
    pop.id='ep-qa-pop';pop.className='ep-pop';pop.setAttribute('role','menu');pop.innerHTML=html;
    document.body.appendChild(pop);
    btn.setAttribute('aria-expanded','true');
    var r=btn.getBoundingClientRect(),w=pop.offsetWidth,h=pop.offsetHeight;
    var left=Math.max(8,Math.min(r.right-w,innerWidth-w-8));
    var top=(r.bottom+6+h>innerHeight-8)?Math.max(8,r.top-h-6):r.bottom+6;
    pop.style.left=left+'px';pop.style.top=top+'px';
    pop.addEventListener('click',function(e){var it=e.target.closest('[data-a]');if(it)epQa(it.dataset.a)});
  };
})();

