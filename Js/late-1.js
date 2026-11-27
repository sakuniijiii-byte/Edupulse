
(function(){
  var pill=document.getElementById('epc-selpill'), cur='';
  function inChat(n){ while(n&&n.nodeType){ if(n.nodeType===1&&(n.id==='ai-chatbot-window'||/^(INPUT|TEXTAREA)$/.test(n.tagName)||n.isContentEditable)) return true; n=n.parentNode; } return false; }
  function check(){
    try{
      var sel=window.getSelection(); var t=sel&&String(sel).replace(/\s+/g,' ').trim();
      if(!t||t.length<6||t.length>1500||inChat(sel.anchorNode)||typeof epc==='undefined'){ pill.style.display='none'; return; }
      cur=t; var r=sel.getRangeAt(0).getBoundingClientRect();
      var top=Math.min(window.innerHeight-56, r.bottom+46);
      var left=Math.max(8, Math.min(window.innerWidth-150, r.left+r.width/2-65));
      pill.style.top=top+'px'; pill.style.left=left+'px'; pill.style.display='flex';
    }catch(e){ pill.style.display='none'; }
  }
  var tm; document.addEventListener('selectionchange',function(){ clearTimeout(tm); tm=setTimeout(check,250); });
  pill.addEventListener('mousedown',function(e){ e.preventDefault(); });
  pill.addEventListener('click',function(){
    epc.sel=cur.slice(0,1500); pill.style.display='none';
    try{ window.getSelection().removeAllRanges(); }catch(e){}
    if(window.epMini&&(function(){try{return !!getGeminiApiKey()}catch(e){return true}})()){ window.epMini.open(); } else if(typeof toggleAiChatbotWindow==='function'){ var w=document.getElementById('ai-chatbot-window'); if(!w||w.classList.contains('hidden')) toggleAiChatbotWindow(true); }
    setTimeout(function(){ epcSelChip(); var i=document.querySelector('#ep-mini:not([hidden]) .mn-in')||document.getElementById('ai-chat-input'); if(i) i.focus(); },160);
  });
  window.epcSelChip=function(){
    var c=document.getElementById('epc-selchip');
    if(!epc.sel){ if(c) c.style.display='none'; return; }
    if(!c){ c=document.createElement('div'); c.id='epc-selchip'; var a=document.getElementById('epc-ctx'); if(!a||!a.parentNode) return; a.parentNode.insertBefore(c,a.nextSibling); }
    c.innerHTML='<b>Selected</b><span></span><button type="button" aria-label="Remove selection">×</button>';
    c.querySelector('span').textContent=epc.sel;
    c.querySelector('button').onclick=function(){ epc.sel=''; epcSelChip(); };
    c.style.display='flex';
  };
})();

;

(function(){
  var real=window.toggleAiChatbotWindow; if(typeof real!=='function'||typeof epc==='undefined') return;
  var on=false, snipping=false, goneN=0, shownTs=null, dismissed=false, chipKey='', rec=null, attSig='', lastVis='', lastBody='';
  var SNIP='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>';
  var MIC='<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></svg>';
  var el=document.createElement('div'); el.id='ep-mini'; el.hidden=true;
  el.innerHTML='<div class="mn-card" hidden><div class="mn-ch"><b>Pulse AI</b><span class="mn-sp"></span><button type="button" data-k="full" title="Open full chat" aria-label="Open full chat">⤢</button><button type="button" data-k="hide" title="Hide answer" aria-label="Hide answer">×</button></div><div class="mn-body"></div></div>'
   +'<div class="mn-att" hidden></div><div class="mn-chips"></div>'
   +'<div class="mn-bar"><button type="button" class="mn-i" data-k="snip" title="Snip the screen and ask" aria-label="Snip the screen and ask">'+SNIP+'</button>'
   +'<input class="mn-in" type="text" placeholder="Ask Pulse AI" enterkeyhint="send" autocomplete="off" aria-label="Ask Pulse AI">'
   +'<button type="button" class="mn-i" data-k="mic" title="Speak" aria-label="Speak">'+MIC+'</button>'
   +'<button type="button" class="mn-go" data-k="send" aria-label="Send">➤</button>'
   +'<button type="button" class="mn-i" data-k="close" title="Close" aria-label="Close">×</button></div>';
  document.body.appendChild(el);
  var card=el.querySelector('.mn-card'), body=el.querySelector('.mn-body'), att=el.querySelector('.mn-att'), chips=el.querySelector('.mn-chips'), inp=el.querySelector('.mn-in'), micB=el.querySelector('[data-k=mic]'), goB=el.querySelector('.mn-go');
  if(!(window.SpeechRecognition||window.webkitSpeechRecognition)) micB.style.display='none';
  function toast(m,t){try{showToast(m,t||'info')}catch(e){}}
  function lastModel(){for(var i=epc.history.length-1;i>=0;i--){if(epc.history[i].role==='model')return epc.history[i]}return null}
  function setOn(v){
    on=!!v; el.hidden=!on; document.body.classList.toggle('ep-mini-on',on);
    if(on){ real(false); var m=lastModel(); shownTs=m?m.ts:null; dismissed=false; card.hidden=true; chipKey=''; tick(); setTimeout(function(){inp.focus()},80); }
    else { try{ if(rec)rec.stop() }catch(e){} }
  }
  function expand(){ setOn(false); real(true); }
  function send(t){
    if(epc.busy) return;
    t=String(t!==undefined?t:inp.value).trim();
    if(!t&&!epc.pendingImage) return;
    inp.value=''; dismissed=false;
    sendAiChatMessage(t||undefined);
    tick();
  }
  function mic(){
    var SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR) return;
    if(rec){ try{rec.stop()}catch(e){} return; }
    try{
      rec=new SR(); rec.lang='en-IN'; rec.interimResults=true;
      rec.onresult=function(e){var s='';for(var i=0;i<e.results.length;i++)s+=e.results[i][0].transcript;inp.value=s};
      rec.onend=function(){rec=null;micB.classList.remove('rec')};
      rec.onerror=function(){rec=null;micB.classList.remove('rec')};
      micB.classList.add('rec'); rec.start();
    }catch(e){ rec=null; micB.classList.remove('rec'); }
  }
  el.addEventListener('click',function(e){
    var b=e.target.closest('button'); if(!b) return; var k=b.dataset.k;
    if(k==='send') send();
    else if(k==='snip'){ if(!window.epSnip){toast('Snip tool is not available.','warning');return} snipping=true; goneN=0; el.style.visibility='hidden'; window.epSnip.start(); }
    else if(k==='mic') mic();
    else if(k==='full') expand();
    else if(k==='hide'){ dismissed=true; card.hidden=true; }
    else if(k==='close') setOn(false);
    else if(k==='chip'){ if(b.dataset.q){ epc.attach=true; } send(b.dataset.t); }
    else if(k==='clr'){ if(epc.pendingImage&&typeof epcClearImage==='function') epcClearImage(); else if(epc.sel){ epc.sel=''; try{epcSelChip()}catch(x){} } tick(); }
  });
  inp.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); send(); } });
  function tick(){
    if(!on) return;
    var ov=!!document.getElementById('ep-snip');
    if(snipping){
      if(ov){ goneN=0; } else { goneN++; if(goneN>8||epc.pendingImage){ snipping=false; el.style.visibility=''; } }
    }
    var vis=(ov||snipping)?'hidden':''; if(vis!==lastVis){ lastVis=vis; el.style.visibility=vis; }
    // attachment chip (rebuild only when it changes)
    var sig=epc.pendingImage?('i'+(epc.pendingImage.data||'').length):(epc.sel?('s'+epc.sel):'');
    if(sig!==attSig){
      attSig=sig;
      if(epc.pendingImage&&epc.pendingImage.dataUrl){ att.hidden=false; att.innerHTML='<img alt="Snip"><span>Snip attached. Ask about it.</span><button type="button" data-k="clr" aria-label="Remove">×</button>'; att.querySelector('img').src=epc.pendingImage.dataUrl; }
      else if(epc.sel){ att.hidden=false; att.innerHTML='<span></span><button type="button" data-k="clr" aria-label="Remove">×</button>'; att.querySelector('span').textContent='Selected: '+epc.sel; }
      else { att.hidden=true; att.innerHTML=''; }
    }
    // quick chips
    var hasQ=false; try{ hasQ=!!epcCurrentQuestion(); }catch(e){}
    var key=hasQ?'q':'n';
    if(key!==chipKey){
      chipKey=key; chips.innerHTML='';
      function mk(label,t,q){ var b=document.createElement('button'); b.type='button'; b.dataset.k='chip'; b.dataset.t=t; if(q) b.dataset.q='1'; b.textContent=label; chips.appendChild(b); }
      var fb=document.createElement('button'); fb.type='button'; fb.dataset.k='full'; fb.textContent='⤢ Full chat'; chips.appendChild(fb);
      if(hasQ){ mk('Explain this','Explain this question in simple language, then show why the correct option is right.',1); mk('Hint only','Give me a hint for this question without revealing the answer.',1); }
    }
    // answer card
    goB.disabled=!!epc.busy;
    if(epc.busy){
      card.hidden=false; var s=Math.floor((Date.now()-(epc.t0||Date.now()))/1000);
      var tt='Thinking… '+s+'s'; if(tt!==lastBody){ lastBody=tt; body.innerHTML='<p class="mn-dim">'+tt+'</p>'; }
    } else if(epc.err&&!dismissed){
      card.hidden=false; if(lastBody!==epc.err){ lastBody=epc.err; body.textContent=epc.err; }
    } else {
      var m=lastModel();
      if(m&&m.ts!==shownTs&&!dismissed){
        shownTs=m.ts; lastBody=''; card.hidden=false;
        try{ body.innerHTML=renderFormattedMarkdown(epcParse(m.text).text||m.text); }catch(e){ body.textContent=m.text; }
        body.scrollTop=0;
      } else if(!m||m.ts===shownTs){ if(dismissed) card.hidden=true; }
    }
  }
  setInterval(function(){ if(on&&!document.hidden) tick(); },500);
  window.toggleAiChatbotWindow=function(force){
    if(force===undefined){
      /* tapping the Pulse AI button: open the mini bar by default */
      if(on){ setOn(false); return; }
      var w=document.getElementById('ai-chatbot-window');
      if(w&&!w.classList.contains('hidden')) return real.call(this,false);
      var hasKey=true; try{ hasKey=!!getGeminiApiKey(); }catch(e){}
      if(!hasKey) return real.call(this,true); /* full chat shows the Add key prompt */
      setOn(true); return;
    }
    if(on){
      if(force===true&&snipping) return;
      if(force!==false) setOn(false);
    }
    return real.apply(this,arguments);
  };
  window.epMini={open:function(){setOn(true)},close:function(){setOn(false)}};
  // minimize button in chat header
  var mx=document.getElementById('epc-max-btn');
  if(mx&&!document.getElementById('epc-min-btn')){
    var b=document.createElement('button'); b.type='button'; b.className='epc-ib'; b.id='epc-min-btn'; b.title='Minimize to a bar'; b.setAttribute('aria-label','Minimize to a bar');
    b.innerHTML='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    b.onclick=function(){ setOn(true); };
    mx.parentNode.insertBefore(b,mx);
  }
})();

;

(function(){try{
  if(localStorage.getItem('ep_full_motion')==='1') document.documentElement.classList.add('ep-full-motion');
  try{var d=document.querySelector('#ai-chat-toggle-btn .epc-fab-dot');if(d&&!d.firstChild)d.innerHTML='<svg viewBox="0 0 56 56" aria-hidden="true" fill="none" stroke="currentColor"><use href="#ep-ai"/></svg>'}catch(e){}
  window.epFullMotion=function(on){try{localStorage.setItem('ep_full_motion',on?'1':'0')}catch(e){}document.documentElement.classList.toggle('ep-full-motion',!!on)};
}catch(e){}})();

;

(function(){
'use strict';
var KEY='edupulse_minimal_mode',root=document.documentElement;
function S(fn,d){try{var v=fn();return v==null?d:v}catch(e){return d}}
function E(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
var el=document.createElement('div');el.id='ep-min';el.setAttribute('role','dialog');el.setAttribute('aria-label','Minimal mode');
var home=document.createElement('button');home.type='button';home.id='ep-min-home';home.innerHTML='&#9776; Minimal home';home.onclick=function(){show()};
document.body.appendChild(el);document.body.appendChild(home);
var A={
  resume:function(){resumeSavedSession()},focus25:function(){startDashboardFocusBlock()},start:function(){switchTab('learn')},
  prac:function(a){openPracticeSetup(a[0],a[1])},saved:function(a){startSavedPractice(a[0])},
  create:function(){openCustomTestBuilder()},tests:function(){switchTab('mock')},focus:function(){epOpenFocus()},
  progress:function(){switchTab('progress')},ncert:function(){epOpenNcert()}
};
function at(act,args){return ' data-a="'+act+'"'+(args?' data-p="'+E(JSON.stringify(args))+'"':'')}
function row(act,args,l,r,ix){return '<button type="button" class="m-row"'+at(act,args)+'><span>'+(ix?'<span class="m-ix">'+ix+'</span>':'')+E(l)+'</span><span>'+E(r||'\u2192')+'</span></button>'}
function tile(act,args,n,l){return '<button type="button" class="m-tile"'+at(act,args)+'><b>'+n+'</b><em>'+l+'</em></button>'}
function build(){
  var goal=S(function(){return getDailyGoal()},30),today=S(questionsSolvedToday,0),streak=S(getDayStreak,0);
  var resume=S(getSavedResume,null),due=S(function(){return getDueRevisionKeys().length},0);
  var wrong=S(function(){return getSavedQuestionKeys('incorrect').length},0),book=S(function(){return getSavedQuestionKeys('bookmarked').length},0);
  var weak=S(function(){return getWeakChapters(80)},[]),wk={};weak.forEach(function(w){wk[w.subject+'|'+w.chapter]=w.avg});
  var att=S(function(){return StorageModule.get(STORAGE_KEYS.attempts,[])},[]);
  var acc=att.length?Math.round(att.reduce(function(n,a){return n+(a.accuracy||0)},0)/att.length):null;
  var days=S(function(){return getActivityDays(7)},[]);
  var vals=days.map(function(d){return typeof d==='number'?d:(d&&d.count)||0}),mx=Math.max.apply(null,vals.concat([1]));
  var tasks=S(function(){return(typeof todos!=='undefined'&&Array.isArray(todos))?todos.filter(function(t){return t&&!t.completed}):[]},[]);
  var pct=Math.min(100,Math.round(today/Math.max(1,goal)*100)),R=40,C=2*Math.PI*R;
  var hasR=resume&&resume.questions&&resume.questions.length;
  var h='<div class="m-wrap"><div class="m-bar"><div><span class="m-brand">EduPulse</span><span class="m-date">'+E(new Date().toLocaleDateString([],{weekday:'long',day:'numeric',month:'long'}))+'</span></div><button type="button" class="m-exit" data-a="exit">Exit</button></div>';
  h+='<section class="m-hero"><div><span class="m-k">Today'+(streak?' \u00b7 '+streak+'-day streak':'')+'</span><div class="m-num">'+today+'<small>/ '+goal+' questions</small></div></div>'
   +'<svg class="m-ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="bg" cx="50" cy="50" r="'+R+'"/><circle class="fg" cx="50" cy="50" r="'+R+'" stroke-dasharray="'+(C*pct/100).toFixed(1)+' '+C.toFixed(1)+'"/></svg>'
   +'<div class="m-acts">'+(hasR?'<button type="button" class="m-btn main" data-a="resume">Resume Q'+Math.min((resume.currentIndex||0)+1,resume.questions.length)+'/'+resume.questions.length+'</button>':'<button type="button" class="m-btn main" data-a="start">Start practice</button>')+'<button type="button" class="m-btn" data-a="focus25">25-min focus</button></div></section>';
  h+='<h2>Revise</h2><div class="m-tiles">'+tile('saved',['due'],due,'Due')+tile('saved',['incorrect'],wrong,'Mistakes')+tile('saved',['bookmarked'],book,'Saved')+'</div>';
  h+='<h2>Tests</h2>'+row('create',0,'Create a test','custom paper')+row('tests',0,'Full tests and series');
  h+='<h2>Practice</h2>';
  Object.keys(data).forEach(function(s){
    h+='<details><summary>'+E(s)+'<i>'+data[s].length+' chapters</i></summary>'+data[s].map(function(c,i){var a=wk[s+'|'+c];return row('prac',[s,c],c,a!=null?a+'%':'',String(i+1).padStart(2,'0'))}).join('')+'</details>';
  });
  h+='<h2>Planner</h2>'+(tasks.length?tasks.slice(0,5).map(function(t){return row('focus',0,t.title||'Task')}).join(''):'<div class="m-empty">No open tasks.</div>')+row('focus',0,'Open focus and planner');
  var tot=vals.reduce(function(a,b){return a+b},0),dn=['S','M','T','W','T','F','S'],lab=vals.map(function(_,i){var d=new Date();d.setDate(d.getDate()-(vals.length-1-i));return dn[d.getDay()]});
  h+='<h2>Stats</h2><div class="m-tiles">'+tile('progress',0,acc==null?'\u2014':acc+'%','Accuracy')+tile('progress',0,tot,'Solved 7d')+tile('progress',0,att.length,'Sessions')+'</div>'
   +'<div class="m-week" aria-hidden="true">'+vals.map(function(v){return '<div><i style="height:'+Math.max(3,Math.round(v/mx*100))+'%"></i></div>'}).join('')+'</div><div class="m-days" aria-hidden="true">'+lab.map(function(l){return '<span>'+l+'</span>'}).join('')+'</div>';
  h+='<h2>More</h2>'+row('progress',0,'Full progress')+row('ncert',0,'NCERT reader')+'</div>';
  el.innerHTML=h;
}
el.addEventListener('click',function(e){
  var b=e.target.closest('[data-a]');if(!b)return;
  var k=b.getAttribute('data-a'),p=b.getAttribute('data-p');
  if(k==='exit'){set(false);return}
  hide();
  try{A[k]&&A[k](p?JSON.parse(p):null)}catch(err){console.warn('minimal action',k,err)}
});
function show(){try{build()}catch(err){console.warn('minimal build',err);el.innerHTML='<div class="m-wrap"><div class="m-bar"><span class="m-brand">EduPulse</span><button type="button" class="m-exit" data-a="exit">Exit</button></div><p class="m-empty">Could not load the page.</p></div>'}root.classList.add('ep-min-open');el.scrollTop=0}
function hide(){root.classList.remove('ep-min-open')}
function set(on){
  root.classList.toggle('ep-min',on);
  if(on)show();else hide();
  try{localStorage.setItem(KEY,on?'1':'0')}catch(e){}
  var b=document.getElementById('ep-min-toggle');if(b)b.setAttribute('aria-pressed',on)
}
window.epMinimal={on:function(){set(true)},off:function(){set(false)},toggle:function(){set(!root.classList.contains('ep-min'))}};
var tb=document.createElement('button');tb.type='button';tb.id='ep-min-toggle';tb.title='Minimal mode (Alt+M)';tb.setAttribute('aria-label','Minimal mode');tb.setAttribute('aria-pressed','false');
tb.className='p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
tb.innerHTML='<i class="fa-solid fa-circle-half-stroke text-sm sm:text-base" aria-hidden="true"></i>';tb.onclick=function(){set(true)};
var bar=document.querySelector('.topbar > div:last-child');if(bar)bar.appendChild(tb);
document.addEventListener('keydown',function(e){if(e.altKey&&(e.key==='m'||e.key==='M')){e.preventDefault();window.epMinimal.toggle()}});
try{if(localStorage.getItem(KEY)==='1')set(true)}catch(e){}
})();

