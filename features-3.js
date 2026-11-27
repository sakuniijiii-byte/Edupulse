
(function(){'use strict';
var D=document,W=window,$=function(s,r){return(r||D).querySelector(s)},$$=function(s,r){return[].slice.call((r||D).querySelectorAll(s))};
var K='epx_v1',X;try{X=JSON.parse(localStorage.getItem(K))||{}}catch(e){X={}}
['views','vote','rep','roles','tags'].forEach(function(k){X[k]=X[k]||{}});X.following=X.following||[];X.rp=X.rp||0;
var save=function(){try{localStorage.setItem(K,JSON.stringify(X))}catch(e){}};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var toast=function(m,t){try{showToast(m,t||'info')}catch(e){}};
var P=function(){try{return W.__epProfileData&&W.__epProfileData()||{}}catch(e){return{}}};
var myName=function(){var p=P();return p.display_name||p.username||'You'},myHandle=function(){return P().username||''};
var cm=function(n,a){var b=D.createElement('button');b.dataset.cm=n;Object.assign(b.dataset,a||{});b.style.display='none';D.body.appendChild(b);b.click();b.remove()};
var client=function(){var a=W.__epCommunityApi;return a&&a.ready?a.ready().then(function(x){return x.client}):Promise.reject()};
var uid=function(){try{return W.__epCommunityApi.session().user.id}catch(e){return null}};
var modal=function(h){close();var o=D.createElement('div');o.className='x-ov';o.innerHTML='<div class="x-box" role="dialog" aria-modal="true">'+h+'</div>';o.onclick=function(e){if(e.target===o)close()};D.body.appendChild(o);return o};
function close(){var o=$('.x-ov');if(o)o.remove()}
var ago=function(t){var m=Math.round((Date.now()-t)/6e4);return m<1?'now':m<60?m+'m':m<1440?Math.round(m/60)+'h':Math.round(m/1440)+'d'};
var cp=function(t,m){(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){toast(m,'success')},function(){epAsk.prompt('Copy this text manually.',{title:'Copy',value:t,ok:'Done'})})};

/* ---- server layer (Supabase RPCs from edupulse-circles-phase2.sql) ---- */
var rpc=function(n,a){return client().then(function(c){return c.rpc(n,a||{})}).then(function(r){if(r.error)throw r.error;return r.data})};
var ROLES={Admin:['#e11d48','fa-shield-halved'],Moderator:['#2563eb','fa-gavel'],Mentor:['#7c3aed','fa-graduation-cap'],Topper:['#d97706','fa-crown'],Helper:['#059669','fa-hand-holding-heart']};
var RM={},isStaff=false,repV=0,RL=null,raf,booted=0;
var cap=function(k){return k.charAt(0).toUpperCase()+k.slice(1)};
var roleOf=function(n){return RM[String(n||'').trim().toLowerCase().replace(/^@/,'')]};
var badge=function(r){return r&&ROLES[r]?'<span class="x-role" style="--c:'+ROLES[r][0]+'"><i class="fa-solid '+ROLES[r][1]+'"></i>'+r+'</span>':''};
var amStaff=function(){var r=roleOf(myHandle())||roleOf(myName());return isStaff||r==='Admin'||r==='Moderator'};
function loadRoles(){client().then(function(c){return c.from('epx_user_roles').select('user_id,role_key').limit(1000).then(function(r){if(r.error||!r.data||!r.data.length)return;
 var ids=r.data.map(function(x){return x.user_id}).filter(function(v,i,a){return a.indexOf(v)===i});
 return c.from('profiles').select('id,username,display_name').in('id',ids).then(function(p){var rank=['admin','moderator','mentor','topper','helper'],best={};
  r.data.forEach(function(x){var b=best[x.user_id];if(!b||rank.indexOf(x.role_key)<rank.indexOf(b))best[x.user_id]=x.role_key});RM={};
  (p.data||[]).forEach(function(u){var l=cap(best[u.id]);[u.username,u.display_name].forEach(function(n){if(n)RM[String(n).toLowerCase()]=l})});
  $$('#cm-msgs .cm-who').forEach(function(w){var n=w.nextElementSibling;if(!(n&&n.classList.contains('x-role')))w.insertAdjacentHTML('afterend',badge(roleOf(w.textContent)))})})})}).catch(function(){})}
function refRep(){rpc('campus_reputation').then(function(v){repV=+v||0;var e=$('.x-rp');if(e)e.textContent='⭐ '+repV}).catch(function(){})}
function loadRules(){rpc('campus_rules_get',{p_chat:null}).then(function(r){RL=r;if(r&&r.accepted)$$('.x-rules').forEach(function(n){n.remove()})}).catch(function(){})}
var rulesOk=function(){return RL?RL.accepted:!!X.rulesOk};
function boot(){if(booted||!uid())return;booted=1;rpc('campus_is_staff').then(function(v){isStaff=!!v}).catch(function(){});loadRoles();refRep();loadRules()}
setInterval(boot,2500);setInterval(function(){if(booted&&!D.hidden)refRep()},9e4);

/* ---- 1 view counts ---- */
var vc={},pend={},vt,io;
function eyeSet(id){var n=Math.max(vc[id]||0,X.views[id]||0);$$('[data-eye="'+id+'"]').forEach(function(e){e.lastChild.textContent=' '+(n>=1e3?(n/1e3).toFixed(1)+'k':n)})}
function vq(id){pend[id]=1;clearTimeout(vt);vt=setTimeout(function(){var ids=Object.keys(pend);pend={};rpc('campus_view_counts',{p_ids:ids}).then(function(r){(r||[]).forEach(function(x){vc[x.message_id]=+x.views});ids.forEach(eyeSet)}).catch(function(){})},500)}
function seen(id){if(X.views[id])return;X.views[id]=1;save();eyeSet(id);rpc('campus_record_views',{p_ids:[id]}).then(function(){vq(id)}).catch(function(){})}

/* ---- 2 deep link ---- */
function openLink(){var m=location.hash.match(/^#\/campus\/m\/([0-9a-f-]{8,40})$/i);if(!m)return;var id=m[1];
 client().then(function(c){return c.from('campus_messages').select('chat_id').eq('id',id).single()}).then(function(r){if(!r.data)return toast('That message is not available.','warning');try{switchTab('campus')}catch(e){}
  setTimeout(function(){cm('openChat',{id:r.data.chat_id});var n=0,t=setInterval(function(){var el=$('#cm-msgs .cm-m[data-id="'+id+'"]');if(el){clearInterval(t);el.scrollIntoView({block:'center'});el.classList.add('flash')}else if(++n>25){clearInterval(t)}else if(n%4===0){var o=$('[data-cm=older]');if(o)o.click()}},300)},400)}).catch(function(){})}
W.addEventListener('hashchange',openLink);setTimeout(openLink,1500);

/* ---- 4 translate (Hindi <-> English) ---- */
function bubText(b){var c=b.cloneNode(true);$$('.cm-meta,.x-tr,.cm-thr,.cm-who,.x-role,.cm-fw,.cm-quote',c).forEach(function(e){e.remove()});return c.textContent.trim()}
function translate(id){var b=$('#cm-msgs .cm-m[data-id="'+id+'"] .cm-bub');if(!b)return;var o=$('.x-tr',b);if(o){o.remove();return}
 var t=bubText(b).slice(0,450);if(!t)return;var hi=/[\u0900-\u097F]/.test(t),box=D.createElement('div');box.className='x-tr';box.innerHTML='<small>Translating…</small>';var mt=$('.cm-meta',b);b.insertBefore(box,mt||null);
 fetch('https://api.mymemory.translated.net/get?q='+encodeURIComponent(t)+'&langpair='+(hi?'hi|en':'en|hi')).then(function(r){return r.json()}).then(function(j){box.innerHTML='<small>'+(hi?'English':'हिन्दी')+' translation</small>'+esc(j.responseData.translatedText)}).catch(function(){box.remove();toast('Translation needs an internet connection.','warning')})}

/* ---- 13 quote-forward ---- */
function quote(id){var m=$('#cm-msgs .cm-m[data-id="'+id+'"]');if(!m)return;var t=bubText($('.cm-bub',m)).slice(0,300),w=$('.cm-who',m),who=w?w.textContent:(m.classList.contains('me')?myName():'Classmate');
 modal('<h3>Quote and forward</h3><p class="x-sub">Add your comment above the message.</p><textarea id="x-qc" rows="3" maxlength="500" placeholder="Your comment"></textarea><div class="x-prev-q"><b>'+esc(who)+'</b><br>'+esc(t)+'</div><button class="x-btn" data-x="qgo" data-w="'+esc(who)+'" data-t="'+esc(t)+'">Add to message box</button>');setTimeout(function(){$('#x-qc').focus()},40)}

/* ---- 9 slash commands + 10 @everyone / @mods ---- */
var CMD=[['/poll','Create a poll','fa-chart-simple'],['/quiz','Share a quiz question','fa-bolt'],['/timer 25','Start a focus timer (minutes)','fa-hourglass-half'],['/doubt','Ask a doubt','fa-circle-question']];
function put(txt){var d=$('#cm-dr');if(!d)return;d.value=txt;d.dispatchEvent(new Event('input',{bubbles:true}))}
function timer(n){n=Math.max(1,Math.min(180,+n||25));var end=Date.now()+n*6e4,el=$('.x-timer');if(!el){el=D.createElement('div');el.className='x-timer';D.body.appendChild(el)}clearInterval(W.__xt);
 var tick=function(){var s=Math.max(0,Math.round((end-Date.now())/1e3));el.innerHTML='<i class="fa-solid fa-hourglass-half"></i>'+Math.floor(s/60)+':'+String(s%60).padStart(2,'0')+'<button data-x="tstop" aria-label="Stop timer">✕</button>';if(!s){clearInterval(W.__xt);toast('Timer done. Take a 5 minute break! ☕','success');setTimeout(function(){el.remove()},5e3)}};tick();W.__xt=setInterval(tick,1e3);
 put('⏱ Focus timer started: '+n+' min. Study with me!');var b=$('[data-cm=send]');if(b)b.click()}
function run(s){var a=s.trim().split(/\s+/),c=a[0];put('');var m=$('#x-slash');if(m)m.remove();
 if(c==='/poll')cm('pollSheet');else if(c==='/quiz')cm('qPicker');else if(c==='/timer')timer(a[1]);
 else if(c==='/doubt'){var t=$('#cm-tabs [data-v=ask]');if(t)t.click();setTimeout(function(){cm('askSheet')},250)}}
function slash(el){var m=$('#x-slash');if(m)m.remove();var v=el.value,items=[],h='';
 if(v[0]==='/'&&v.indexOf('\n')<0){var w=v.split(' ')[0];items=CMD.filter(function(c){return c[0].indexOf(w)===0}).map(function(c){return'<button data-x="cmd" data-v="'+c[0]+'"><i class="fa-solid '+c[2]+'"></i><b>'+c[0]+'</b><small>'+c[1]+'</small></button>'})}
 else{var a=v.slice(0,el.selectionStart).match(/@(\w*)$/);if(a&&amStaff())items=[['@everyone','Notify the whole Circle'],['@mods','Notify moderators only']].filter(function(c){return c[0].indexOf('@'+a[1].toLowerCase())===0}).map(function(c){return'<button data-x="at" data-v="'+c[0]+'"><i class="fa-solid fa-at"></i><b>'+c[0]+'</b><small>'+c[1]+'</small></button>'})}
 if(!items.length)return;var cp=el.closest('.cm-comp');if(!cp)return;var d=D.createElement('div');d.id='x-slash';d.innerHTML=items.join('');cp.parentNode.insertBefore(d,cp)}
D.addEventListener('input',function(e){if(e.target.id==='cm-dr')slash(e.target)});
D.addEventListener('keydown',function(e){if(e.target.id!=='cm-dr'||e.key!=='Enter'||e.shiftKey)return;if(/^\/(poll|quiz|timer|doubt)(\s|$)/.test(e.target.value)){e.preventDefault();e.stopImmediatePropagation();run(e.target.value)}},true);

/* ---- 8 rules gate (server: campus_rules_get / campus_accept_rules) ---- */
var RULES=['Be kind. No bullying, insults or hate.','Stay on topic: NEET preparation and study help.','No spam, ads or links to paid groups.','Share original work and credit your sources.','Never share leaked papers or answer keys.'];
var rl=function(){return RL&&RL.rules&&RL.rules.length?RL.rules:RULES};
function rulesModal(){modal('<h3>'+esc(RL&&RL.title||'Welcome to Circles 👋')+'</h3><p class="x-sub">'+esc(RL&&RL.welcome||'Please read the rules before you post.')+'</p><ol class="x-ol">'+rl().map(function(r){return'<li>'+esc(r)+'</li>'}).join('')+'</ol><label class="x-chk"><input type="checkbox" id="x-ok"> I have read these rules and agree to follow them</label><button class="x-btn" id="x-acc" data-x="accept" disabled>Accept and continue</button>')}
D.addEventListener('change',function(e){if(e.target.id==='x-ok')$('#x-acc').disabled=!e.target.checked});
D.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-cm="send"],[data-cm="postDoubt"],[data-cm="postAns"],[data-cm="makePoll"]');if(!t)return;if(!rulesOk()){e.preventDefault();e.stopImmediatePropagation();rulesModal()}},true);
D.addEventListener('keydown',function(e){if(e.target.id==='cm-dr'&&e.key==='Enter'&&!e.shiftKey&&!rulesOk()){e.preventDefault();e.stopImmediatePropagation();rulesModal()}},true);

/* ---- 5 votes, 12 forum meta, 7 nested replies (server) ---- */
var FM={},FT=0,TW=null,CM={};
function dn(btn,id){var b=D.createElement('button');b.className='x-dn';b.dataset.x='down';b.dataset.id=id;b.innerHTML='<i class="fa-solid fa-arrow-down"></i>';b.setAttribute('aria-label','Downvote');btn.insertAdjacentElement('afterend',b)}
function loadForum(cb){if(Date.now()-FT<15000){cb&&cb();return}FT=Date.now();rpc('campus_forum_list',{p_subject:'All',p_sort:'new',p_limit:100}).then(function(r){FM={};(r||[]).forEach(function(x){FM[x.id]=x});cb&&cb()}).catch(function(){FM=null;cb&&cb()})}
function applyForum(){$$('#cm-doubts .cm-post:not(.x-f)').forEach(function(p){var b=$('.bd',p),v=$('.cm-vote',p);if(!b||!v)return;var x=FM&&FM[b.dataset.id];if(!x)return;p.classList.add('x-f');
 v.lastChild.textContent=x.score;var d=$('.x-dn',p);if(d)d.classList.toggle('on',x.my_vote<0);
 var ti=$('.x-title',b);if(ti&&x.title)ti.textContent=x.title;
 if(x.tags&&x.tags.length&&!$('.x-tg',b)&&ti)ti.insertAdjacentHTML('afterend','<span class="x-tg">'+x.tags.map(function(t){return'<span class="x-flair" style="--c:#6366f1">#'+esc(t)+'</span> '}).join('')+'</span>')})}
function sortTop(){var box=$('#cm-doubts');if(!box)return;var L=$$('.cm-post',box);if(!X.tw){L.forEach(function(p){p.style.display=''});return}
 if(!TW){TW=[];rpc('campus_forum_list',{p_subject:'All',p_sort:'top_week',p_limit:100}).then(function(r){TW=(r||[]).map(function(x){return x.id});setTimeout(function(){TW=null},3e4);sortTop()}).catch(function(){TW=[];toast('Top this week needs the Phase 2 SQL.','warning')});return}
 var o={};TW.forEach(function(id,i){o[id]=i});L.forEach(function(p){var id=$('.bd',p).dataset.id;p.style.display=(id in o)?'':'none';p.dataset.o=(id in o)?o[id]:999});
 var S=L.slice().sort(function(a,b){return a.dataset.o-b.dataset.o});if(S.some(function(p,i){return p!==L[i]}))S.forEach(function(p){box.appendChild(p)})}
function tree(a,p){return(CM[a]||[]).filter(function(c){return(c.parent_id||'')===p}).map(function(c){var f=X.fold&&X.fold[c.id];return'<div class="x-c"><div class="x-ch"><button data-x="fold" data-a="'+a+'" data-c="'+c.id+'" aria-label="Collapse">'+(f?'+':'–')+'</button><b>'+esc(c.author)+'</b>'+badge(roleOf(c.author))+'<small>'+ago(+new Date(c.created_at))+'</small></div>'+(f?'':'<div class="x-ct">'+esc(c.body)+'</div><button class="x-lk" data-x="reply" data-a="'+a+'" data-c="'+c.id+'">Reply</button>'+(c.mine?' <button class="x-lk" data-x="cdel" data-a="'+a+'" data-c="'+c.id+'">Delete</button>':'')+tree(a,c.id))+'</div>'}).join('')}
function drawTh(a,again){var e=$('.x-cth[data-a="'+a+'"]');if(!e)return;var go=function(){var n=(CM[a]||[]).length;e.innerHTML='<button class="x-lk" data-x="reply" data-a="'+a+'" data-c="">Comment'+(n?' · '+n:'')+'</button>'+tree(a,'')};
 if(again||!CM[a])rpc('campus_comments_list',{p_answer:a}).then(function(r){CM[a]=r||[];go()}).catch(function(){CM[a]=CM[a]||[];go()});else go()}
function replyForm(btn){var o=$('.x-rf');if(o)o.remove();var f=D.createElement('div');f.className='x-rf';f.innerHTML='<textarea maxlength="600" rows="2" placeholder="Write a reply"></textarea><button class="x-btn" data-x="rpost" data-a="'+btn.dataset.a+'" data-c="'+(btn.dataset.c||'')+'">Reply</button>';btn.insertAdjacentElement('afterend',f);$('textarea',f).focus()}

/* ---- 14 trending, 16 profile (server) ---- */
var TR=null,TT=0;
function trending(){if(!TR)return'<h4>🔥 Trending this week</h4><p class="x-sub">Loading…</p>';var sug=['#NEET2027','#NCERT','#Genetics','#Mechanics','#OrganicChem'].filter(function(s){return!TR.some(function(x){return'#'+x.tag===s.toLowerCase()})});
 return'<h4>🔥 Trending this week</h4><div class="x-trend">'+TR.map(function(x){return'<button type="button" class="x-tagbtn" onclick="window.epCircleHub&&epCircleHub.feedFilter(\'#'+esc(x.tag)+'\')">#'+esc(x.tag)+'<em>'+x.people+' '+(x.people==1?'student':'students')+'</em></button>'}).join('')+(TR.length<5?sug.slice(0,5-TR.length).map(function(s){return'<button type="button" class="x-tagbtn" style="opacity:.65" onclick="window.epCircleHub&&epCircleHub.feedFilter(\''+s+'\')">'+s+'<em>suggested</em></button>'}).join(''):'')+'</div>'}
function paintTr(){var tr=$('.x-trendcard');if(!tr)return;var h=trending();if(tr.dataset.h!==h){tr.dataset.h=h;tr.innerHTML=h}}
function profile(){modal('<div class="x-cover"></div><p class="x-sub" style="margin-top:20px">Loading profile…</p>');
 rpc('campus_profile_get',{}).then(function(p){if(!p)throw 0;return rpc('campus_follow_list',{p_kind:'following'}).then(function(f){profView(p,f||[])})}).catch(function(){close();toast('Profile needs the Phase 2 SQL to be installed.','warning')})}
function profView(p,F){modal('<div class="x-cover"></div><div class="x-av">'+esc(myName().charAt(0).toUpperCase())+'</div><h3 style="margin-top:6px">'+esc(p.display_name||p.username||myName())+(p.roles||[]).map(function(r){return badge(r.label)}).join('')+'</h3><small class="x-sub">'+(p.username?'@'+esc(p.username):'No handle yet')+'</small>'+
 '<div class="x-stats"><div><b>'+p.followers+'</b><small>Followers</small></div><div><b>'+p.following+'</b><small>Following</small></div><div><b>⭐ '+p.reputation+'</b><small>Reputation</small></div></div>'+
 '<label class="x-sub">Bio</label><textarea id="x-bio" rows="2" maxlength="160" placeholder="NEET 2027 · Bio is my jam">'+esc(p.bio||'')+'</textarea>'+
 '<label class="x-sub" style="display:block;margin-top:8px">📌 Pinned achievement</label><input type="text" id="x-pin" list="x-pl" maxlength="70" placeholder="Pick or type" value="'+esc(p.pinned||'')+'"><datalist id="x-pl"><option value="🏆 Top 10 in Daily 10"><option value="🔥 30-day study streak"><option value="🧬 Genetics master"><option value="⭐ 1000 questions solved"></datalist>'+
 (p.pinned?'<div class="x-pinned">📌 '+esc(p.pinned)+'</div>':'')+'<button class="x-btn" data-x="psave">Save profile</button>'+
 '<h4 style="margin-top:14px;font-weight:900">Following</h4>'+(F.map(function(f){return'<div class="x-fl"><span>@'+esc(f.username)+badge(roleOf(f.username))+'</span><button class="x-lk" data-x="unfollow" data-v="'+esc(f.username)+'">Unfollow</button></div>'}).join('')||'<p class="x-sub">Not following anyone yet.</p>')+
 '<input type="text" id="x-fh" maxlength="20" placeholder="Follow by @handle" style="margin-top:8px"><button class="x-btn alt" data-x="follow">Follow</button>'+
 (amStaff()?'<h4 style="margin-top:14px;font-weight:900">Member roles</h4><input type="text" id="x-rh" placeholder="@handle"><select id="x-rr">'+Object.keys(ROLES).map(function(k){return'<option>'+k+'</option>'}).join('')+'</select><button class="x-btn alt" data-x="rset" data-on="1">Assign</button> <button class="x-btn alt" data-x="rset" data-on="0">Remove</button>':'')+
 '<button class="x-btn alt" style="float:right" data-x="close">Close</button>')}
function card(o){var c=D.createElement('canvas');c.width=1080;c.height=1350;var g=c.getContext('2d'),gr=g.createLinearGradient(0,0,1080,1350);gr.addColorStop(0,'#0f766e');gr.addColorStop(1,'#4f46e5');g.fillStyle=gr;g.fillRect(0,0,1080,1350);
 g.fillStyle='rgba(255,255,255,.08)';g.beginPath();g.arc(900,200,320,0,7);g.fill();g.beginPath();g.arc(120,1200,260,0,7);g.fill();g.fillStyle='#fff';
 g.font='800 46px system-ui,sans-serif';g.fillText('EduPulse Circles',80,130);g.font='600 44px system-ui,sans-serif';g.fillText(o.title,80,430);g.font='900 340px system-ui,sans-serif';g.fillText(o.big,80,780);
 g.font='700 56px system-ui,sans-serif';g.fillText(o.sub||'',80,890);g.font='700 44px system-ui,sans-serif';g.fillText(myName()+(myHandle()?'  @'+myHandle():''),80,1170);g.globalAlpha=.8;g.font='500 34px system-ui,sans-serif';g.fillText('Study together on EduPulse',80,1240);return c}
var lastC;function share(o){lastC=card(o);modal('<h3>Share card</h3><img alt="Share card preview" src="'+lastC.toDataURL('image/png')+'" style="width:100%;border-radius:16px;margin-top:10px"><button class="x-btn" data-x="cshare">Share</button> <button class="x-btn alt" data-x="cdl">Download PNG</button>')}

/* ---- click router ---- */
D.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-x]');if(!t)return;var a=t.dataset.x,id=t.dataset.id;
 if(a==='link'){cp(location.origin+location.pathname+'#/campus/m/'+id,'Message link copied')}
 else if(a==='tr')translate(id);else if(a==='quote')quote(id);
 else if(a==='qgo'){close();put((($('#x-qc')||{}).value||'')+'\n\n❝ '+t.dataset.t+' ❞\n— '+t.dataset.w);var d=$('#cm-dr');if(d)d.focus()}
 else if(a==='cmd')run(t.dataset.v);
 else if(a==='at'){var d2=$('#cm-dr');put(d2.value.slice(0,d2.selectionStart).replace(/@\w*$/,t.dataset.v+' ')+d2.value.slice(d2.selectionStart));d2.focus();var s=$('#x-slash');if(s)s.remove()}
 else if(a==='tstop'){clearInterval(W.__xt);t.parentNode.remove()}
 else if(a==='accept'){rpc('campus_accept_rules',{p_chat:null}).catch(function(){}).then(function(){X.rulesOk=Date.now();save();if(RL)RL.accepted=true;close();$$('.x-rules').forEach(function(r){r.remove()});toast('Welcome aboard! You can post now.','success')})}
 else if(a==='cdel'){client().then(function(c){return c.from('epx_answer_comments').delete().eq('id',t.dataset.c)}).then(function(){drawTh(t.dataset.a,1)}).catch(function(){toast('Could not delete','warning')})}
 else if(a==='meta'){var fx=FM&&FM[id]||{};modal('<h3>Title and tags</h3><input type="text" id="x-mt" maxlength="120" placeholder="Short title" value="'+esc(fx.title||'')+'"><input type="text" id="x-mg" placeholder="Tags, comma separated" value="'+esc((fx.tags||[]).join(', '))+'"><button class="x-btn" data-x="msave" data-id="'+id+'">Save</button>')}
 else if(a==='msave'){rpc('campus_forum_set_meta',{p_doubt:id,p_title:$('#x-mt').value,p_tags:$('#x-mg').value.split(',')}).then(function(){close();FT=0;$$('#cm-doubts .x-f').forEach(function(n){n.classList.remove('x-f')});toast('Saved','success')}).catch(function(e){toast(e.message||'Could not save','warning')})}
 else if(a==='rules')rulesModal();
 else if(a==='down'){var up=t.previousElementSibling,kind=t.closest('#cm-sheet')?'answer':'doubt',nv=t.classList.contains('on')?0:-1;rpc('campus_cast_vote',{p_kind:kind,p_id:id,p_value:nv}).then(function(r){up.lastChild.textContent=r.score;up.classList.remove('on');t.classList.toggle('on',nv<0);FT=0;refRep()}).catch(function(e){toast(e.message||'Vote failed','warning')})}
 else if(a==='topweek'){X.tw=!X.tw;TW=null;t.classList.toggle('on',X.tw);var u=$('[data-cm=sort][data-v=top]');if(u&&!u.classList.contains('on'))u.click();else sortTop()}
 else if(a==='reply')replyForm(t);
 else if(a==='rpost'){var tx=$('.x-rf textarea').value.trim();if(!tx)return;var A=t.dataset.a;rpc('campus_comment_add',{p_answer:A,p_parent:t.dataset.c||null,p_body:tx}).then(function(){drawTh(A,1);refRep()}).catch(function(e){toast(e.message||'Could not post','warning')})}
 else if(a==='fold'){X.fold=X.fold||{};X.fold[t.dataset.c]=!X.fold[t.dataset.c];save();drawTh(t.dataset.a)}
 else if(a==='unread'){var mk=$$('#cm-msgs .cm-day').filter(function(d){return/New messages/.test(d.textContent)})[0];if(mk)mk.scrollIntoView({block:'start',behavior:'smooth'})}
 else if(a==='mention'){var L=$$('#cm-msgs .cm-m:not(.me) .cm-mn.me');if(!L.length)return;W.__xmi=((W.__xmi==null?-1:W.__xmi)+1)%L.length;var m=L[W.__xmi];m.scrollIntoView({block:'center',behavior:'smooth'});var b=m.closest('.cm-m');if(b){b.classList.add('flash');setTimeout(function(){b.classList.remove('flash')},1400)}}
 else if(a==='profile'){close();if(window.switchTab)switchTab('profile')}else if(a==='close')close();
 else if(a==='psave'){rpc('campus_profile_save',{p_bio:$('#x-bio').value,p_pinned:$('#x-pin').value}).then(function(){toast('Profile saved','success');profile()}).catch(function(e){toast(e.message||'Could not save','warning')})}
 else if(a==='follow'){var h=$('#x-fh').value.trim().replace(/^@/,'');if(!/^[A-Za-z0-9_]{3,20}$/.test(h))return toast('Enter a valid handle.','warning');rpc('campus_follow',{p_handle:h,p_on:true}).then(profile).catch(function(e){toast(e.message||'Could not follow','warning')})}
 else if(a==='unfollow'){rpc('campus_follow',{p_handle:t.dataset.v,p_on:false}).then(profile).catch(function(e){toast(e.message||'Failed','warning')})}
 else if(a==='rset'){var k=$('#x-rh').value.trim();if(!k)return;rpc('campus_set_role',{p_handle:k,p_role:$('#x-rr').value.toLowerCase(),p_chat:null,p_on:t.dataset.on==='1'}).then(function(){toast('Role updated','success');loadRoles()}).catch(function(e){toast(e.message||'Not allowed','warning')})}
 else if(a==='share')share({title:t.dataset.t,big:t.dataset.b,sub:t.dataset.s});
 else if(a==='cdl'){lastC.toBlob(function(b){var l=D.createElement('a');l.href=URL.createObjectURL(b);l.download='edupulse-result.png';l.click()})}
 else if(a==='cshare'){lastC.toBlob(function(b){var f=new File([b],'edupulse-result.png',{type:'image/png'});if(navigator.canShare&&navigator.canShare({files:[f]}))navigator.share({files:[f],text:'My EduPulse result'}).catch(function(){});else{var l=D.createElement('a');l.href=URL.createObjectURL(b);l.download=f.name;l.click()}})}
});

/* ---- 5 "Top this week" ordering ---- */
function sortTop(){var box=$('#cm-doubts');if(!box||!X.tw)return;var L=$$('.cm-post',box);L.sort(function(a,b){return(parseInt($('.cm-vote',b).lastChild.textContent,10)||0)-(parseInt($('.cm-vote',a).lastChild.textContent,10)||0)}).forEach(function(p){box.appendChild(p)})}
D.addEventListener('click',function(e){var s=e.target.closest&&e.target.closest('[data-cm=sort]');if(s&&s.dataset.v!=='top'){X.tw=false}else if(s&&s.dataset.v==='top'&&!e.isTrusted===false){}},true);

/* ---- DOM decoration pass ---- */
var raf;
function pass(){raf=0;
 if(!io)io=new IntersectionObserver(function(es){es.forEach(function(n){if(n.isIntersecting){io.unobserve(n.target);seen(n.target.dataset.id)}})},{threshold:.6});
 $$('#cm-msgs .cm-m[data-id]:not(.x-d)').forEach(function(m){m.classList.add('x-d');var id=m.dataset.id,mt=$('.cm-meta',m);
  if(mt)mt.insertAdjacentHTML('afterbegin','<span class="x-eye" data-eye="'+id+'"><i class="fa-regular fa-eye"></i> 0</span>');eyeSet(id);
  var w=$('.cm-who',m);if(w)w.insertAdjacentHTML('afterend',badge(roleOf(w.textContent)));
  $$('.cm-mn',m).forEach(function(s){var q=s.textContent.toLowerCase();if(q==='@everyone'||q==='@mods'){s.classList.add('x-ping','me')}});io.observe(m);vq(id)});
 $$('#cm-msgs .cm-acts:not(.x-a)').forEach(function(a){a.classList.add('x-a');var f=$('[data-id]',a);if(!f)return;var i=f.dataset.id;a.insertAdjacentHTML('beforeend','<button data-x="link" data-id="'+i+'">Link</button><button data-x="tr" data-id="'+i+'">Translate</button><button data-x="quote" data-id="'+i+'">Quote</button>')});
 var th=$('#cm-thread'),ms=$('#cm-msgs');if(th&&ms){var f=$('.x-fabs',th);if(!f){f=D.createElement('div');f.className='x-fabs';th.appendChild(f)}
  var all=$$('#cm-msgs > *'),mk=-1;all.forEach(function(n,i){if(/New messages/.test(n.textContent)&&n.classList.contains('cm-day'))mk=i});var un=mk<0?0:all.slice(mk).filter(function(n){return n.classList.contains('cm-m')}).length,mn=$$('#cm-msgs .cm-m:not(.me) .cm-mn.me').length,k=un+'|'+mn;
  if(f.dataset.k!==k){f.dataset.k=k;f.innerHTML=(un?'<button class="x-fab" data-x="unread" aria-label="Jump to '+un+' unread"><i class="fa-solid fa-arrow-down"></i>'+un+'</button>':'')+(mn?'<button class="x-fab at" data-x="mention" aria-label="Jump to next mention">@'+mn+'</button>':'')}}
 $$('#cm-doubts .cm-post:not(.x-d)').forEach(function(p){p.classList.add('x-d');var v=$('.cm-vote',p),b=$('.bd',p);if(!b||!v)return;var id=b.dataset.id,tg=$('.cm-tag',b),tx=$('.tx',b),sm=$('small',b),sj=tg?tg.textContent.trim():'';
  var C={Biology:'#059669',Physics:'#2563eb',Chemistry:'#d97706'}[sj]||'#6366f1';if(tg){tg.className='x-flair';tg.style.setProperty('--c',C)}
  if(tx){var s=tx.textContent.trim(),line=s.split('\n')[0],ti=line.length>80?line.slice(0,77)+'…':line;tx.innerHTML='<span class="x-title">'+esc(ti)+'</span>'+(s.length>ti.length?'<span class="x-prev">'+esc(s.slice(line.length>80?77:line.length).trim())+'</span>':'')}
  if(sm){var sv=/Best answer chosen/.test(sm.textContent);sm.insertAdjacentHTML('beforeend',sv?'<span class="x-solved">✓ Solved</span>':'<span class="x-open">Open</span>')}dn(v,id)});
 if($('#cm-doubts .cm-post:not(.x-f)'))loadForum(applyForum);sortTop();
 if($('#cm-sheet [data-cm=delDoubt]')&&!$('#cm-sheet .x-et')){var dd=$('#cm-sheet [data-cm=delDoubt]');dd.insertAdjacentHTML('beforebegin','<button class="cm-btn x-et" data-x="meta" data-id="'+dd.dataset.id+'">Title and tags</button>')}
 $$('#cm-sheet .cm-post:not(.x-d)').forEach(function(p){var v=$('[data-cm=avote]',p);if(!v)return;p.classList.add('x-d');var a=v.dataset.id,body=v.nextElementSibling;dn(v,a);if(body){var d=D.createElement('div');d.className='x-cth';d.dataset.a=a;body.appendChild(d);drawTh(a)}});
 var sh=$('#cm-sheet h3');if(sh&&$('#cm-sheet [data-cm=postAns]')&&!$('.x-solved',$('#cm-sheet'))&&/Best answer/.test($('#cm-sheet').textContent)){sh.insertAdjacentHTML('beforebegin','<span class="x-solved" style="margin:0 0 4px">✓ Solved</span>')}
 var top=$('.cm-top:not(.x-h)');if(top){top.classList.add('x-h');var pb=D.createElement('button');pb.className='cm-pill';pb.dataset.x='profile';pb.innerHTML='<span>⭐</span><span class="t x-rp">Profile</span>';top.appendChild(pb)}
 var rp=$('.x-rp');if(rp)rp.textContent='⭐ '+repV;
 var tgt=$('#ep-circle-hub')||($('#cm-doubts')&&$('#cm-doubts').parentNode&&$('#cm-doubts'));
 if(tgt&&!rulesOk()&&!$('.x-rules')){tgt.insertAdjacentHTML('beforebegin','<section class="x-card x-rules"><div class="x-pin">📌 Pinned · Welcome</div><h3>'+esc(RL&&RL.title||'Welcome to EduPulse Circles')+'</h3><p>'+esc(RL&&RL.welcome||'Study together, ask doubts and help each other. Read and accept the community rules to start posting.')+'</p><details><summary>Community rules ('+rl().length+')</summary><ol class="x-ol">'+rl().map(function(r){return'<li>'+esc(r)+'</li>'}).join('')+'</ol></details><button class="x-btn" data-x="rules">Review and accept</button></section>')}
 var hub=$('#ep-circle-hub');if(hub){if(!$('.x-trendcard'))hub.insertAdjacentHTML('beforebegin','<section class="x-card x-trendcard"></section>');if(Date.now()-TT>3e5){TT=Date.now();rpc('campus_trending_topics',{p_days:7,p_limit:8}).then(function(r){TR=r||[];paintTr()}).catch(function(){TR=[];paintTr()})}paintTr()}
 var tc=$('#cm-sheet,#cm-doubts');var ch=$('[data-cm=sort][data-v=top]');if(ch&&!$('[data-x=topweek]')){ch.insertAdjacentHTML('afterend','<button class="cm-chip'+(X.tw?' on':'')+'" data-x="topweek">🔥 Top this week</button>')}
 $$('.cm-hero:not(.x-sh)').forEach(function(h){h.classList.add('x-sh');var m=h.textContent.match(/scored\s+(\d+)\D+rank\s*#(\d+)/i);if(m)h.insertAdjacentHTML('beforeend','<button class="cm-btn" style="margin-top:8px" data-x="share" data-t="Daily 10 result" data-b="'+m[1]+'" data-s="Rank #'+m[2]+' today">Share card</button>')});
}
new MutationObserver(function(){if(!raf)raf=requestAnimationFrame(pass)}).observe(D.body,{childList:true,subtree:true});
})();

;

(function(){function close(){document.querySelectorAll('.cm-hmenu-list:not([hidden])').forEach(function(m){m.hidden=true;});}
document.addEventListener('click',close);document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});})();

;

(function(){var D=document,last=null,raf=0;
var ro=window.ResizeObserver?new ResizeObserver(function(es){es.forEach(function(e){var th=D.getElementById('cm-thread');if(th)th.style.setProperty('--cm-comp-h',Math.ceil(e.target.getBoundingClientRect().height)+'px');});}):null;
function attach(){raf=0;var c=D.querySelector('#cm-thread .cm-comp');if(c!==last){if(last&&ro)ro.unobserve(last);last=c;if(c&&ro)ro.observe(c);}}
new MutationObserver(function(){if(!raf)raf=requestAnimationFrame(attach);}).observe(D.body,{childList:true,subtree:true});
var sx=999,sy=0;
D.addEventListener('touchstart',function(e){sx=999;var t=e.target.closest&&e.target.closest('#cm-thread');if(!t||innerWidth>=1024)return;var p=e.touches[0];sx=p.clientX;sy=p.clientY;},{passive:true});
D.addEventListener('touchend',function(e){if(sx>28)return;var p=e.changedTouches[0];if(p.clientX-sx>80&&Math.abs(p.clientY-sy)<50){var b=D.querySelector('#cm-thread .cm-thread-back');if(b)b.click();}sx=999;},{passive:true});
})();

;

(function(){var W=216,cur=null,sx=0,sy=0,base=0,lock=0,swiped=0,D=document;
function closeAll(except){D.querySelectorAll('.cm-swr.open').forEach(function(w){if(w!==except){w.classList.remove('open');}});}
D.addEventListener('touchstart',function(e){var w=e.target.closest&&e.target.closest('.cm-swr');if(!w){closeAll();cur=null;return;}closeAll(w);cur=w;var p=e.touches[0];sx=p.clientX;sy=p.clientY;base=w.classList.contains('open')?-W:0;lock=0;},{passive:true});
D.addEventListener('touchmove',function(e){if(!cur)return;var p=e.touches[0],dx=p.clientX-sx,dy=p.clientY-sy;if(!lock){if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.4)lock=1;else if(Math.abs(dy)>10)lock=-1;}if(lock!==1)return;cur.classList.add('drag');var x=Math.max(-W-24,Math.min(0,base+dx));cur.querySelector('.cm-row').style.transform='translateX('+x+'px)';},{passive:true});
function end(){if(!cur)return;var w=cur,r=w.querySelector('.cm-row');cur=null;if(lock!==1)return;w.classList.remove('drag');var m=(r.style.transform||'').match(/-?[\d.]+/),x=m?parseFloat(m[0]):0;swiped=Date.now();w.classList.toggle('open',x<-W/2);r.style.transform='';}
D.addEventListener('touchend',end);D.addEventListener('touchcancel',end);
D.addEventListener('click',function(e){var r=e.target.closest&&e.target.closest('.cm-swr .cm-row');if(!r)return;var w=r.parentNode;if(Date.now()-swiped<350||w.classList.contains('open')){e.stopPropagation();e.preventDefault();if(Date.now()-swiped>=350)w.classList.remove('open');}},true);
D.addEventListener('keydown',function(e){var r=e.target.closest&&e.target.closest('.cm-swr .cm-row');if(!r||e.target!==r)return;var w=r.parentNode;if(e.key==='ArrowLeft'){e.preventDefault();closeAll(w);w.classList.add('open');}else if(e.key==='ArrowRight'||e.key==='Escape'){w.classList.remove('open');}});
D.addEventListener('contextmenu',function(e){var r=e.target.closest&&e.target.closest('.cm-swr .cm-row');if(!r)return;e.preventDefault();var w=r.parentNode,o=w.classList.contains('open');closeAll(w);w.classList.toggle('open',!o);});
})();

;

(function(){
'use strict';
if(window.EP&&window.EP.__core)return;
var EP=window.EP=window.EP||{};EP.__core=1;
EP.build={phase:0,id:'p0-safety-20261120'};
var FKEY='edupulse_flags_v1',DEFS={},qs=(function(){try{return new URLSearchParams(location.search)}catch(e){return new URLSearchParams('')}})();
function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,v);return true}catch(e){return false}}
function parse(s,f){try{var v=JSON.parse(s);return v==null?f:v}catch(e){return f}}
EP.warn=function(){try{console.warn.apply(console,['[EP]'].concat([].slice.call(arguments)))}catch(e){}};

/* ---------- feature flags ---------- */
var urlOv={},safe=qs.has('safe');
(qs.get('ep_flags')||'').split(',').forEach(function(t){t=t.trim();if(!t)return;var on=t.charAt(0)!=='-';urlOv[t.replace(/^[+-]/,'')]=on});
EP.defineFlag=function(name,def,label){DEFS[name]={def:def!==false,label:label||name}};
EP.flag=function(name){
  if(safe)return false;
  if(Object.prototype.hasOwnProperty.call(urlOv,name))return urlOv[name];
  var st=parse(lsGet(FKEY),{});
  if(Object.prototype.hasOwnProperty.call(st,name))return !!st[name];
  return DEFS[name]?DEFS[name].def:false;
};
EP.setFlag=function(name,on){var st=parse(lsGet(FKEY),{});st[name]=!!on;lsSet(FKEY,JSON.stringify(st));try{EP.emit&&EP.emit('flag_changed',{name:name,on:!!on})}catch(e){}};
EP.flags=function(){var o={};Object.keys(DEFS).forEach(function(k){o[k]=EP.flag(k)});return o};
EP.defineFlag('selfTest',true,'Self-test panel (?selftest)');

/* ---------- snapshot / export ---------- */
var SENSITIVE=/gemini_key|supabase|sb-|token|password|secret|apikey|auth/i;
EP.newKeys=['edupulse_flags_v1'];           /* keys created by EP phases; removed on restore if absent from snapshot */
EP.ownKeys=function(){var out=[];try{for(var i=0;i<localStorage.length;i++){var n=localStorage.key(i);if(/^(edupulse|ep_)/i.test(n)&&!SENSITIVE.test(n))out.push(n)}}catch(e){}return out.sort()};
function collect(){var o={};EP.ownKeys().forEach(function(k){o[k]=lsGet(k)});return o}
var DB='edupulse_safety',ST='snapshots';
function idb(){return new Promise(function(res,rej){if(!window.indexedDB)return rej(new Error('IndexedDB unavailable'));var r=indexedDB.open(DB,1);r.onupgradeneeded=function(){r.result.createObjectStore(ST,{keyPath:'id'})};r.onsuccess=function(){res(r.result)};r.onerror=function(){rej(r.error)}})}
function tx(mode,fn){return idb().then(function(db){return new Promise(function(res,rej){var t=db.transaction(ST,mode),s=t.objectStore(ST),out=fn(s);t.oncomplete=function(){res(out&&out.result!==undefined?out.result:out)};t.onerror=function(){rej(t.error)}})})}
EP.snapshots=function(){return tx('readonly',function(s){return s.getAll()}).then(function(l){return (l||[]).sort(function(a,b){return b.at-a.at})}).catch(function(){return []})};
EP.snapshot=function(label,id){
  var snap={id:id||('s_'+Date.now()),label:label||'manual',at:Date.now(),build:EP.build.id,keys:collect()};
  return tx('readwrite',function(s){s.put(snap)}).then(function(){
    return EP.snapshots().then(function(all){var auto=all.filter(function(x){return x.id!=='baseline'}).slice(4);return Promise.all(auto.map(function(x){return tx('readwrite',function(s){s.delete(x.id)})}))});
  }).then(function(){return snap});
};
EP.baseline=function(){
  return EP.snapshots().then(function(all){
    if(all.some(function(x){return x.id==='baseline'}))return all.filter(function(x){return x.id==='baseline'})[0];
    return EP.snapshot('baseline (before first migration)','baseline').then(function(s){lsSet('edupulse_ep_baseline_v1',JSON.stringify({at:s.at,keys:Object.keys(s.keys).length}));return s});
  });
};
EP.restore=function(id,opts){
  opts=opts||{};
  return EP.snapshots().then(function(all){
    var s=all.filter(function(x){return x.id===id})[0];if(!s)throw new Error('Snapshot not found');
    Object.keys(s.keys).forEach(function(k){if(s.keys[k]!==null)lsSet(k,s.keys[k])});
    EP.ownKeys().forEach(function(k){if(!(k in s.keys)&&EP.newKeys.indexOf(k)>-1)try{localStorage.removeItem(k)}catch(e){}});
    if(opts.reload!==false)location.reload();
    return s;
  });
};
EP.exportData=function(){
  var payload={app:'EduPulse',exported:new Date().toISOString(),build:EP.build.id,note:'Sensitive keys (API keys, sign-in tokens) are excluded.',keys:collect()};
  var blob=new Blob([JSON.stringify(payload)],{type:'application/json'}),a=document.createElement('a'),d=new Date(),p=function(n){return String(n).padStart(2,'0')};
  a.href=URL.createObjectURL(blob);a.download='edupulse-backup-'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes())+'.json';
  document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500);
  return payload;
};
EP.clearCaches=function(){
  var jobs=[];
  if(window.caches)jobs.push(caches.keys().then(function(k){return Promise.all(k.map(function(n){return caches.delete(n)}))}));
  if(navigator.serviceWorker)jobs.push(navigator.serviceWorker.getRegistrations().then(function(r){return Promise.all(r.map(function(x){return x.unregister()}))}));
  return Promise.all(jobs).then(function(){location.reload()});
};
/* take the baseline once the page is idle, long before a student can trigger any new write */
function schedule(){var go=function(){EP.baseline().catch(function(e){EP.warn('baseline failed',e&&e.message)})};('requestIdleCallback' in window)?requestIdleCallback(go,{timeout:4000}):setTimeout(go,2000)}
if(document.readyState==='complete')schedule();else window.addEventListener('load',schedule);

/* ---------- self-test harness ---------- */
var tests=[];
EP.test={
  add:function(name,fn,phase){tests.push({name:name,fn:fn,phase:phase==null?0:phase})},
  list:function(){return tests.slice()},
  /* run fn with localStorage + in-memory flashcard state restored afterwards */
  sandbox:function(fn){
    var before=collect(),keysBefore=Object.keys(before);
    var restore=function(){
      EP.ownKeys().forEach(function(k){if(!(k in before))try{localStorage.removeItem(k)}catch(e){}});
      keysBefore.forEach(function(k){if(before[k]!==null&&lsGet(k)!==before[k])lsSet(k,before[k])});
      try{window.epFlashApi&&epFlashApi.reload&&epFlashApi.reload()}catch(e){}
      try{EP.mastery&&EP.mastery.invalidate&&EP.mastery.invalidate()}catch(e){}
    };
    var done=function(){restore()};
    var r;try{r=fn()}catch(e){done();throw e}
    return Promise.resolve(r).then(function(v){done();return v},function(e){done();throw e});
  },
  run:function(onRow){
    var results=[],chain=Promise.resolve();
    tests.forEach(function(t){chain=chain.then(function(){
      var t0=performance.now();
      return EP.test.sandbox(t.fn).then(function(){return{name:t.name,phase:t.phase,ok:true,ms:Math.round(performance.now()-t0)}},function(e){return{name:t.name,phase:t.phase,ok:false,err:String(e&&e.message||e),ms:Math.round(performance.now()-t0)}}).then(function(r){results.push(r);onRow&&onRow(r)});
    })});
    return chain.then(function(){return results});
  }
};
EP.assert=function(c,msg){if(!c)throw new Error(msg||'assertion failed')};

/* fake practice session helper used by tests */
EP.test.withQuestion=function(q,fn){
  var keys=['userAnswers','currentIndex','questions','questionTimes','questionStartTimer','chapter','subject','mode','infinite','wrongReasons','marked'],save={};
  keys.forEach(function(k){save[k]=quizState[k]});
  var origRender=window.renderPracticeQuiz,origPersist=window.persistQuizSession;
  window.renderPracticeQuiz=function(){};window.persistQuizSession=function(){};
  Object.assign(quizState,{userAnswers:{},currentIndex:0,questions:[q],questionTimes:{},questionStartTimer:Date.now(),chapter:q.sourceChapter||'Selftest chapter',subject:q.subject||'Biology',mode:'practice',infinite:null,wrongReasons:{},marked:{}});
  var fin=function(){Object.assign(quizState,save);window.renderPracticeQuiz=origRender;window.persistQuizSession=origPersist};
  var r;try{r=fn()}catch(e){fin();throw e}
  return Promise.resolve(r).then(function(v){fin();return v},function(e){fin();throw e});
};
EP.test.fakeQ=function(tag){return{qKey:'selftest-chapter#'+(tag||'q1'),id:tag||'q1',question:'Self-test question '+(tag||'q1')+'?',options:['A one','B two','C three','D four'],correct:0,explanation:'Because A.',subject:'Biology',sourceChapter:'Selftest chapter'}};

EP.test.add('Storage is writable',function(){var k='edupulse_selftest_probe';EP.assert(lsSet(k,'1')&&lsGet(k)==='1','write/read failed');localStorage.removeItem(k)},0);
EP.test.add('Feature flags: default, override, reset',function(){
  EP.defineFlag('_probe',true);EP.assert(EP.flag('_probe')===true,'default on');
  EP.setFlag('_probe',false);EP.assert(EP.flag('_probe')===false,'override off');
  var st=parse(lsGet(FKEY),{});delete st._probe;lsSet(FKEY,JSON.stringify(st));EP.assert(EP.flag('_probe')===true,'back to default');delete DEFS._probe},0);
EP.test.add('Snapshot restores changed and removes new EP keys',function(){
  var k='edupulse_selftest_probe';lsSet(k,'before');
  return EP.snapshot('selftest','st_tmp').then(function(){
    lsSet(k,'after');return EP.restore('st_tmp',{reload:false});
  }).then(function(){EP.assert(lsGet(k)==='before','value not restored');return tx('readwrite',function(s){s.delete('st_tmp')})});
},0);
EP.test.add('Export/snapshot exclude API keys and tokens',function(){
  lsSet('edupulse_selftest_token','secret');var k=collect();EP.assert(!('edupulse_selftest_token' in k),'token key leaked');
  EP.assert(!('edupulse_gemini_key_v1' in k),'gemini key leaked');localStorage.removeItem('edupulse_selftest_token')},0);
EP.test.add('Baseline snapshot exists',function(){return EP.baseline().then(function(s){EP.assert(s&&s.id==='baseline','no baseline')})},0);
EP.test.add('Wrong answer updates qstats (current behaviour)',function(){
  var q=EP.test.fakeQ('p0wrong');
  return EP.test.withQuestion(q,function(){
    selectPracticeOption(1);
    var st=StorageModule.get(STORAGE_KEYS.qstats,{})[q.qKey];
    EP.assert(st&&st.seen===1&&st.wrong===1&&st.streak===0,'qstats not updated: '+JSON.stringify(st));
  });
},0);
EP.test.add('Error notebook: one entry per qKey, attempts accumulate',function(){
  var q=EP.test.fakeQ('p0nb');saveErrorNotebookEntry(q,1,'Concept Gap');saveErrorNotebookEntry(q,2,'Concept Gap');
  var nb=StorageModule.get(STORAGE_KEYS.errorNotebook,{});EP.assert(nb[q.qKey]&&nb[q.qKey].attempts.length>=1,'no entry');
  EP.assert(Object.keys(nb).filter(function(k){return k===q.qKey}).length===1,'duplicate entry')},0);

/* ---------- self-test panel ---------- */
EP.selftest=function(){
  if(!EP.flag('selfTest'))return;
  var el=document.getElementById('ep-selftest');if(el)el.remove();
  el=document.createElement('div');el.id='ep-selftest';el.setAttribute('role','dialog');el.setAttribute('aria-label','EduPulse self-test');
  el.innerHTML='<div class="est-h"><b>EduPulse self-test</b><span class="est-v">'+EP.build.id+'</span><button type="button" data-x aria-label="Close">✕</button></div>'+
   '<div class="est-b"><div class="est-row"><button data-a="run">Run all tests</button><button data-a="export">Export data</button><button data-a="snap">Snapshot now</button><button data-a="restore">Restore baseline</button><button data-a="cache">Clear caches &amp; reload</button></div>'+
   '<div id="est-sum" class="est-sum">Not run yet.</div><div id="est-res"></div><h4>Feature flags</h4><div id="est-flags"></div><h4>Snapshots</h4><div id="est-snaps">Loading…</div><h4>Service worker</h4><div id="est-sw">Checking…</div></div>';
  document.body.appendChild(el);
  var $=function(s){return el.querySelector(s)},esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
  function flags(){var f=$('#est-flags'),names=Object.keys(DEFS);f.innerHTML=names.length?names.map(function(n){return '<label class="est-flag"><input type="checkbox" data-f="'+n+'" '+(EP.flag(n)?'checked':'')+'> <span>'+esc(DEFS[n].label)+' <code>'+n+'</code></span></label>'}).join(''):'None';}
  function snaps(){EP.snapshots().then(function(l){$('#est-snaps').innerHTML=l.length?l.map(function(s){return '<div class="est-snap"><span>'+esc(s.label)+' · '+new Date(s.at).toLocaleString()+' · '+Object.keys(s.keys).length+' keys</span></div>'}).join(''):'No snapshots yet (the baseline is taken shortly after the app loads).'})}
  function sw(){var t=$('#est-sw');if(!navigator.serviceWorker){t.textContent='Not supported in this browser.';return}navigator.serviceWorker.getRegistration().then(function(r){t.textContent=r?(r.active?'Active: ':'Registered: ')+((r.active||r.waiting||r.installing||{}).scriptURL||'').replace(location.origin,''):'No service worker registered (normal on file:// or first load).'})}
  function run(){var res=$('#est-res');res.innerHTML='';$('#est-sum').textContent='Running…';
    EP.test.run(function(r){var d=document.createElement('div');d.className='est-r '+(r.ok?'ok':'bad');d.innerHTML='<span>'+(r.ok?'✓':'✗')+'</span><div><b>'+esc(r.name)+'</b> <small>P'+r.phase+' · '+r.ms+'ms</small>'+(r.ok?'':'<p>'+esc(r.err)+'</p>')+'</div>';res.appendChild(d)}).then(function(all){var p=all.filter(function(x){return x.ok}).length;$('#est-sum').textContent=p+' of '+all.length+' passed';$('#est-sum').className='est-sum '+(p===all.length?'ok':'bad');window.__epSelfTest={passed:p,total:all.length,results:all};snaps()})}
  el.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-x'))return el.remove();var a=b.dataset.a;
    if(a==='run')run();else if(a==='export')EP.exportData();else if(a==='snap')EP.snapshot('manual').then(snaps);
    else if(a==='restore'){epAsk.confirm('Changes made since then will be lost.',{title:'Restore all EduPulse data to the saved baseline?',ok:'Restore',danger:true}).then(function(ok){if(ok)EP.restore('baseline').catch(function(x){window.toast&&toast(x.message,'error')})})}
    else if(a==='cache'){EP.clearCaches()}});
  el.addEventListener('change',function(e){var f=e.target.getAttribute&&e.target.getAttribute('data-f');if(f)EP.setFlag(f,e.target.checked)});
  flags();snaps();sw();if(qs.get('selftest')==='run')run();
};
if(qs.has('selftest')){var open=function(){setTimeout(EP.selftest,300)};document.readyState==='complete'?open():window.addEventListener('load',open)}
})();


;

(function(){
'use strict';
var EP=window.EP;if(!EP||EP.__p1)return;EP.__p1=1;
EP.build.phase=1;EP.build.id='p1-spine-20261120';
['ui','mastery','router','myCards','registry'].forEach(function(n){EP.defineFlag(n,true,{ui:'Shared design components on Dashboard & chapter list',mastery:'Chapter mastery number',router:'Hash router (EP.go)',myCards:'My Cards deck in Flashcards',registry:'Service registry adapters'}[n])});
EP.newKeys.push('edupulse_mycards_v1');
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function get(k,f){try{return StorageModule.get(k,f)}catch(e){return f}}
function toast(m,t){try{showToast(m,t||'success')}catch(e){}}
function norm(s){return s==='Botany'||s==='Zoology'?'Biology':s}

/* ===== service registry ===== */
var reg={};
EP.register=function(name,api){reg[name]=Object.assign(reg[name]||{},api);return reg[name]};
EP.has=function(name,method){var a=reg[name];return !!(a&&(!method||typeof a[method]==='function'))};
EP.call=function(name,method){
  var a=reg[name];if(!a||typeof a[method]!=='function'){EP.warn('missing service',name+'.'+method);return undefined}
  try{return a[method].apply(a,[].slice.call(arguments,2))}catch(e){EP.warn(name+'.'+method+' failed',e&&e.message);return undefined}
};
EP.services=function(){var o={};Object.keys(reg).forEach(function(k){o[k]=Object.keys(reg[k])});return o};

/* ===== event bus (notifications only: listeners never change core state) ===== */
var L={};
EP.on=function(ev,fn){(L[ev]=L[ev]||[]).push(fn);return function(){EP.off(ev,fn)}};
EP.off=function(ev,fn){L[ev]=(L[ev]||[]).filter(function(f){return f!==fn})};
EP.emit=function(ev,detail){
  var fns=(L[ev]||[]).concat(L['*']||[]);
  fns.forEach(function(fn){setTimeout(function(){try{fn(detail,ev)}catch(e){EP.warn('listener for '+ev+' failed',e&&e.message)}},0)});
};

/* ===== storage helper (all EP writes go through here) ===== */
EP.store={
  get:function(k,f){return get(k,f)},
  set:function(k,v){var ok=StorageModule.set(k,v);if(EP.mastery&&EP.mastery.invalidate)EP.mastery.invalidate();return ok}
};

/* ===== chapter mapping + derived mastery ===== */
var slugCh=null,chSet=null,cache=null,cacheAt=0,cacheSig='';
function chapIdx(){
  if(slugCh)return;slugCh={};chSet={};
  Object.keys(data).forEach(function(s){data[s].forEach(function(c){chSet[s+'|'+c]=1;var sl=slugify(c);(slugCh[sl]=slugCh[sl]||[]).push(s+'|'+c)})});
}
EP.chapterOf=function(qKey,st){
  chapIdx();var sj=norm((st&&st.sj)||''),ch=st&&st.ch?String(st.ch):'',k,subs=Object.keys(data);
  if(ch){
    if(sj&&chSet[sj+'|'+ch])return sj+'|'+ch;
    for(var i=0;i<subs.length;i++)if(chSet[subs[i]+'|'+ch])return subs[i]+'|'+ch;
    var stripped=ch.replace(/^[A-Za-z]+:\s*/,'');
    for(i=0;i<subs.length;i++)if(chSet[subs[i]+'|'+stripped])return subs[i]+'|'+stripped;
  }
  var pre=String(qKey||'').split('#')[0],m=slugCh[pre];
  return m&&m.length?m[0]:null;
};
function buildMastery(){
  chapIdx();var by={},stq=get(STORAGE_KEYS.qstats,{})||{};
  Object.keys(chSet).forEach(function(k){var p=k.split('|');by[k]={key:k,subject:p[0],chapter:p.slice(1).join('|'),seen:0,correct:0,wrong:0,w:0}});
  Object.keys(stq).forEach(function(qk){var s=stq[qk];if(!s||!(s.seen>0))return;var k=EP.chapterOf(qk,s);if(!k||!by[k])return;var r=by[k];r.seen++;r.correct+=s.correct||0;r.wrong+=s.wrong||0;r.w+=Math.min(1,(s.streak||0)/3)});
  var dueMap=(EP.review&&EP.review.dueByChapter)?EP.review.dueByChapter():{};
  Object.keys(by).forEach(function(k){
    var r=by[k],bank=(typeof qBank==='function'&&qBank(r.subject,r.chapter))||0,den=Math.max(bank,r.seen);
    r.total=bank;r.pct=den?Math.min(100,Math.round(100*r.w/den)):0;r.hasData=r.seen>0;
    r.acc=(r.correct+r.wrong)?Math.round(100*r.correct/(r.correct+r.wrong)):null;
    r.level=!r.hasData?'new':r.pct>=70?'strong':r.pct>=40?'building':'weak';
    r.due=dueMap[k]||0;
  });
  return by;
}
function sig(){try{return (localStorage.getItem(STORAGE_KEYS.qstats)||'').length+'|'+questionCounts.size+'|'+(EP.review?EP.review.version():0)}catch(e){return ''}}
function index(){var s=sig(),now=Date.now();if(!cache||s!==cacheSig||now-cacheAt>5000){cache=buildMastery();cacheSig=s;cacheAt=now}return cache}
EP.mastery=function(subject,chapter){
  var by=index(),s=norm(subject||''),k=s+'|'+chapter;
  if(by[k])return by[k];
  var hit=Object.keys(by).filter(function(x){return by[x].chapter===chapter})[0];
  return hit?by[hit]:{key:k,subject:s,chapter:chapter,seen:0,correct:0,wrong:0,pct:0,hasData:false,level:'new',due:0,total:0,acc:null};
};
EP.mastery.invalidate=function(){cache=null};
EP.mastery.pct=function(subject,chapter,fallback){if(!EP.flag('mastery'))return fallback;var r=EP.mastery(subject,chapter);return r.hasData?r.pct:fallback};
EP.mastery.list=function(opts){
  opts=opts||{};var by=index(),l=Object.keys(by).map(function(k){return by[k]});
  if(opts.withData!==false)l=l.filter(function(r){return r.hasData});
  if(opts.subject)l=l.filter(function(r){return r.subject===norm(opts.subject)});
  l.sort(function(a,b){return a.pct-b.pct||b.wrong-a.wrong});
  return opts.limit?l.slice(0,opts.limit):l;
};
EP.on('card_reviewed',function(){EP.mastery.invalidate()});

/* ===== context ===== */
EP.context=function(compact){
  var q=null;try{q=epcCurrentQuestion()}catch(e){}
  var ch=q?{subject:norm(quizState.subject||''),chapter:String(quizState.chapter||'').replace(/^[A-Za-z]+:\s*/,'')}:null;
  var m=ch?EP.mastery(ch.subject,ch.chapter):null,text='';
  try{text=epcAppContextText(!!compact)}catch(e){}
  var due=EP.review&&EP.review.dueCount?EP.review.dueCount():0;
  if(due)text+='\n[Revision queue: '+due+' item(s) due today]';
  return{text:text,subject:ch&&ch.subject,chapter:ch&&ch.chapter,question:q,mastery:m,due:due,tab:typeof currentTab!=='undefined'?currentTab:''};
};

/* ===== design system components ===== */
var ICONS={flashcard:'fa-clone',mistake:'fa-circle-xmark',note:'fa-note-sticky',doubt:'fa-circle-question',review:'fa-rotate',bookmark:'fa-bookmark',mastery:'fa-bullseye',ncert:'fa-book-open',ai:'fa-wand-magic-sparkles',planner:'fa-list-check',circle:'fa-circle-nodes'};
var SUBJ={Biology:'bio',Botany:'bio',Zoology:'bio',Chemistry:'chem',Physics:'phy'};
var UI=EP.ui={
  icon:function(n,extra){return '<i class="fa-solid '+(ICONS[n]||'fa-circle')+(extra?' '+extra:'')+'" aria-hidden="true"></i>'},
  tone:function(subject){return SUBJ[subject]||'teal'},
  card:function(o){o=o||{};var tag=o.tag||'div',a=(o.attrs||'');return '<'+tag+(tag==='button'?' type="button"':'')+' class="epu-card epu-t-'+(o.tone||'teal')+(o.cls?' '+o.cls:'')+'" '+a+'>'+(o.html||'')+'</'+tag+'>'},
  chip:function(o){o=o||{};return '<'+(o.tag||'button')+(o.tag==='span'?'':' type="button"')+' class="epu-chip epu-t-'+(o.tone||'slate')+(o.on?' on':'')+'"'+(o.attrs?' '+o.attrs:'')+'>'+(o.icon?UI.icon(o.icon):'')+'<span>'+esc(o.label)+'</span></'+(o.tag||'button')+'>'},
  ring:function(pct,o){
    o=o||{};var s=o.size||44,sw=o.stroke||5,r=(s-sw)/2,C=2*Math.PI*r,p=Math.max(0,Math.min(100,+pct||0));
    return '<span class="epu-ring epu-t-'+(o.tone||'teal')+'" role="img" aria-label="'+esc(o.label||('Mastery '+p+'%'))+'" style="width:'+s+'px;height:'+s+'px"><svg width="'+s+'" height="'+s+'" viewBox="0 0 '+s+' '+s+'" aria-hidden="true"><circle class="epu-ring-bg" cx="'+s/2+'" cy="'+s/2+'" r="'+r+'" fill="none" stroke-width="'+sw+'"/><circle class="epu-ring-fg" cx="'+s/2+'" cy="'+s/2+'" r="'+r+'" fill="none" stroke-width="'+sw+'" stroke-linecap="round" stroke-dasharray="'+(C*p/100).toFixed(1)+' '+C.toFixed(1)+'" transform="rotate(-90 '+s/2+' '+s/2+')"/></svg><b>'+(o.text!=null?esc(o.text):Math.round(p))+'</b></span>';
  },
  masteryChip:function(subject,chapter){
    if(!EP.flag('mastery'))return '';var r=EP.mastery(subject,chapter);
    if(!r.hasData)return '<span class="epu-mchip epu-lv-new" title="Not enough practice yet">Mastery —</span>';
    return '<span class="epu-mchip epu-lv-'+r.level+'" title="'+r.seen+' questions practised · answered right 3 times in a row counts as mastered">Mastery '+r.pct+'%</span>';
  },
  empty:function(o){o=o||{};return '<div class="epu-empty">'+(o.icon?'<span class="epu-empty-ic">'+UI.icon(o.icon)+'</span>':'')+'<b>'+esc(o.title||'Nothing here yet')+'</b>'+(o.text?'<p>'+esc(o.text)+'</p>':'')+(o.action?'<button type="button" class="epu-btn" data-act="'+esc(o.action.id||'')+'" '+(o.action.onclick?'onclick="'+o.action.onclick+'"':'')+'>'+esc(o.action.label)+'</button>':'')+'</div>'},
  skeleton:function(lines){var h='';for(var i=0;i<(lines||3);i++)h+='<i class="epu-skel" style="width:'+(i===0?'60':i%2?'100':'80')+'%"></i>';return '<div class="epu-skels" aria-hidden="true">'+h+'</div>'},
  tile:function(o){
    var dis=o.disabled||!o.count&&o.requireCount;
    return '<button type="button" class="epu-card epu-tile epu-t-'+o.tone+'"'+(dis?' disabled':' onclick="'+o.onclick+'"')+'><span class="epu-tile-ic">'+UI.icon(o.icon)+'</span><span class="epu-tile-t"><b>'+esc(o.label)+'</b><small>'+esc(o.hint||'')+'</small></span><span class="epu-tile-n">'+(o.countHtml?o.count:esc(o.count))+'</span></button>';
  },
  /* sheet: bottom sheet on phones, centred dialog on tablets. returns {el,close} */
  sheet:function(o){
    o=o||{};var prev=document.activeElement,wrap=document.createElement('div');wrap.className='epu-sheet-wrap';
    wrap.innerHTML='<div class="epu-sheet-bg" data-close></div><div class="epu-sheet" role="dialog" aria-modal="true" aria-label="'+esc(o.title||'Panel')+'"><div class="epu-sheet-grab" aria-hidden="true"></div><div class="epu-sheet-h"><b>'+esc(o.title||'')+'</b><button type="button" class="epu-x" data-close aria-label="Close">✕</button></div><div class="epu-sheet-b">'+(o.html||'')+'</div></div>';
    document.body.appendChild(wrap);document.documentElement.classList.add('epu-lock');
    var api={el:wrap,close:function(){if(!wrap.parentNode)return;wrap.classList.add('out');document.removeEventListener('keydown',key,true);document.documentElement.classList.remove('epu-lock');setTimeout(function(){wrap.remove()},180);try{prev&&prev.focus&&prev.focus()}catch(e){}o.onClose&&o.onClose()}};
    function key(e){
      if(e.key==='Escape'){e.stopPropagation();api.close();return}
      if(e.key==='Tab'){var f=wrap.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');if(!f.length)return;var a=f[0],z=f[f.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}}
    }
    document.addEventListener('keydown',key,true);
    wrap.addEventListener('click',function(e){if(e.target.closest('[data-close]'))api.close()});
    requestAnimationFrame(function(){wrap.classList.add('in');var f=wrap.querySelector('[autofocus],textarea,input,select,button:not(.epu-x)');f&&f.focus({preventScroll:true})});
    return api;
  }
};

/* ===== dashboard pieces (used by patches in the main script) ===== */
EP.tiles=[];
EP.dash={
  saved:function(c){
    var tiles=[
      UI.tile({tone:'rose',icon:'mistake',label:'Incorrect',hint:'Retry what you got wrong',count:c.nWrong,requireCount:1,onclick:"startSavedPractice('incorrect')"}),
      UI.tile({tone:'amber',icon:'bookmark',label:'Bookmarked',hint:'Questions you saved',count:c.nBook,requireCount:1,onclick:"startSavedPractice('bookmarked')"})
    ];
    EP.tiles.forEach(function(fn){try{var t=fn(c);if(t)tiles.push(t)}catch(e){EP.warn('tile failed',e&&e.message)}});
    if(tiles.length<3)tiles.push(UI.tile({tone:'violet',icon:'review',label:'Revision due',hint:'Spaced repetition',count:c.nDue,requireCount:1,onclick:"startSavedPractice('due')"}));
    return '<section class="dv2-card"><div class="dv2-h"><h3>Your question sets</h3><span>Tap to practise</span></div><div class="epu-tiles">'+tiles.join('')+'</div></section>';
  },
  weak:function(){
    var l=EP.mastery.list({limit:3});
    var body=l.length?l.map(function(r){
      return '<button type="button" class="epu-card epu-row epu-t-'+UI.tone(r.subject)+'" onclick="openPracticeSetup(\''+jsArg(r.subject)+'\',\''+jsArg(r.chapter)+'\')">'+UI.ring(r.pct,{size:46,tone:UI.tone(r.subject)})+'<span class="epu-row-t"><b>'+esc(r.chapter)+'</b><small>'+esc(r.subject)+' · '+r.seen+' question'+(r.seen===1?'':'s')+' practised'+(r.due?' · '+r.due+' due':'')+'</small></span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>';
    }).join(''):UI.empty({icon:'mastery',title:'No chapter data yet',text:'Practise a few questions and your weakest chapters will appear here.'});
    return '<section class="dv2-card"><div class="dv2-h"><h3>Needs work</h3><span>Lowest mastery first</span></div><div class="epu-list">'+body+'</div></section>';
  }
};

/* ===== My Cards (local deck for user-made and mistake cards) ===== */
var MC='edupulse_mycards_v1';
function mcAll(){var o=get(MC,null);return o&&o.cards?o:{v:1,cards:{}}}
var Cards=EP.cards={
  list:function(f){f=f||{};return Object.keys(mcAll().cards).map(function(k){return mcAll().cards[k]}).filter(function(c){return(!f.subject||norm(c.s)===norm(f.subject))&&(!f.chapter||c.c===f.chapter)}).sort(function(a,b){return(b.updated||0)-(a.updated||0)})},
  get:function(id){return mcAll().cards[id]||null},
  count:function(){return Object.keys(mcAll().cards).length},
  save:function(c){
    var db=mcAll(),now=Date.now(),id=c.id||('mc_'+now.toString(36)+Math.random().toString(36).slice(2,6)),old=db.cards[id]||{};
    db.cards[id]=Object.assign({},old,c,{id:id,created:old.created||now,updated:now});
    EP.store.set(MC,db);EP.emit('cards_changed',{id:id});return db.cards[id];
  },
  remove:function(id){var db=mcAll();if(!db.cards[id])return false;delete db.cards[id];EP.store.set(MC,db);try{window.epFlashApi&&epFlashApi.reset(id)}catch(e){}EP.emit('cards_changed',{id:id,removed:1});return true},
  /* deck objects in the shape the flashcard player expects */
  decks:function(scope){
    scope=scope||{};var l=Cards.list({subject:scope.s,chapter:scope.c});if(!l.length)return[];
    var mistakes=l.filter(function(c){return c.qKey}),own=l.filter(function(c){return !c.qKey}),out=[];
    function deck(title,cards,key){return{title:title,subject:scope.s||'',chapter:scope.c||'',source:'my cards',_key:key+(scope.c?':'+scope.c:''),_my:1,cards:cards.map(function(c){return{id:c.id,front:c.front,back:c.back}})}}
    if(own.length)out.push(deck('My Cards',own,'mycards:own'));
    if(mistakes.length)out.push(deck('My Mistakes',mistakes,'mycards:mistakes'));
    return out;
  },
  openEditor:function(o){
    o=o||{};var c=o.card||{},subs=Object.keys(data);
    var sel=function(){return '<option value="">Subject (optional)</option>'+subs.map(function(s){return '<option'+(norm(c.s)===s||o.subject===s?' selected':'')+'>'+esc(s)+'</option>'}).join('')};
    var sh=UI.sheet({title:c.id?'Edit card':'New card',html:
      '<div class="epu-form"><label>Front<textarea id="epu-cf" rows="3" maxlength="600" placeholder="Question or prompt">'+esc(c.front||o.front||'')+'</textarea></label>'+
      '<label>Back<textarea id="epu-cb" rows="4" maxlength="1200" placeholder="Answer or explanation">'+esc(c.back||o.back||'')+'</textarea></label>'+
      '<div class="epu-form-row"><label>Subject<select id="epu-cs">'+sel()+'</select></label><label>Chapter<select id="epu-cc"><option value="">Chapter (optional)</option></select></label></div>'+
      '<div class="epu-form-actions">'+(c.id?'<button type="button" class="epu-btn epu-btn-ghost" data-del>Delete</button>':'')+'<button type="button" class="epu-btn" data-save>Save card</button></div></div>'});
    var s=sh.el,cs=s.querySelector('#epu-cs'),cc=s.querySelector('#epu-cc');
    function fill(){var sub=cs.value;cc.innerHTML='<option value="">Chapter (optional)</option>'+((sub&&data[sub])||[]).map(function(x){return '<option'+((c.c||o.chapter)===x?' selected':'')+'>'+esc(x)+'</option>'}).join('')}
    cs.addEventListener('change',fill);fill();
    s.addEventListener('click',function(e){
      if(e.target.closest('[data-save]')){
        var f=s.querySelector('#epu-cf').value.trim(),b=s.querySelector('#epu-cb').value.trim();
        if(!f||!b){toast('Add both a front and a back.','warning');return}
        var saved=Cards.save({id:c.id,front:f,back:b,s:cs.value||'',c:cc.value||'',qKey:c.qKey});sh.close();toast('Card saved to My Cards');o.onSave&&o.onSave(saved);
      }else if(e.target.closest('[data-del]')){Cards.remove(c.id);sh.close();toast('Card deleted');o.onSave&&o.onSave(null)}
    });
    return sh;
  }
};

/* ===== router ===== */
var views={},cur=null,pushed=false;
function enc(s){return encodeURIComponent(s)}
function dec(s){try{return decodeURIComponent(s)}catch(e){return s}}
function hashFor(r){var h='#/ep/'+r.view;if(r.subject)h+='/'+enc(r.subject);if(r.chapter)h+='/'+enc(r.chapter);return h}
function parse(h){var m=/^#\/ep\/([a-z-]+)(?:\/([^/]+))?(?:\/([^/]+))?$/.exec(h||'');return m?{view:m[1],subject:m[2]?dec(m[2]):'',chapter:m[3]?dec(m[3]):''}:null}
function norm2(r){r=r||{};var ch=r.chapter;if(ch&&typeof ch==='object'){r=Object.assign({},r,{subject:ch.subject||ch.s||r.subject,chapter:ch.chapter||ch.c||ch.name})}return{view:r.view||'chapters',subject:norm(r.subject||''),chapter:r.chapter||''}}
function closeCur(){if(!cur)return;var v=views[cur.view],c=cur;cur=null;try{v&&v.close&&v.close(c)}catch(e){}}
function openRoute(r){var v=views[r.view];if(!v||!v.open){toast('That screen is not available yet.','warning');return false}closeCur();cur=r;try{v.open(r)}catch(e){EP.warn('route open failed',e&&e.message);cur=null;return false}return true}
EP.route={parse:parse,hash:hashFor,view:function(n,d){views[n]=d},current:function(){return cur},
  closed:function(name){if(!cur||cur.view!==name)return;cur=null;if(location.hash.indexOf('#/ep/')===0){if(pushed){pushed=false;try{history.back()}catch(e){}}else{try{history.replaceState(history.state,'',location.pathname+location.search)}catch(e){}}}}};
EP.go=function(r){
  r=norm2(r);
  if(!EP.flag('router')){var v=views[r.view];if(v&&v.open){closeCur();cur=r;v.open(r);return true}return false}
  if(!openRoute(r))return false;
  var h=hashFor(r);if(location.hash!==h){try{history.pushState({ep:1},'',h);pushed=true}catch(e){}}
  EP.emit('route',r);return true;
};
EP.back=function(){if(pushed){history.back()}else closeCur()};
function sync(){
  if(!EP.flag('router'))return;
  var r=parse(location.hash);
  if(r){if(!cur||hashFor(cur)!==location.hash){pushed=false;openRoute(r)}}
  else if(cur){closeCur();pushed=false}
}
window.addEventListener('popstate',sync);window.addEventListener('hashchange',sync);
window.addEventListener('load',function(){setTimeout(sync,1200)});

/* ===== built-in views and service adapters ===== */
EP.route.view('flashcards',{open:function(r){if(typeof epFlashOpen==='function')epFlashOpen(r.subject,r.chapter);else toast('Flashcards not loaded yet.','warning')},close:function(){try{epFlashApi.close()}catch(e){}}});
EP.route.view('practice',{open:function(r){if(r.subject&&r.chapter)openPracticeSetup(r.subject,r.chapter);else switchTab('learn')},close:function(){}});
EP.route.view('chapters',{open:function(r){if(r.subject&&typeof setSubject==='function')setSubject(r.subject);switchTab('learn');cur=null},close:function(){}});
EP.route.view('selftest',{open:function(){EP.selftest();cur=null},close:function(){}});
EP.register('practice',{open:function(s,c,o){return openPracticeSetup(s,c,o)},startSaved:function(k){return startSavedPractice(k)},resume:function(){return resumeSavedSession()}});
EP.register('flashcards',{open:function(s,c){return epFlashOpen(s,c)},has:function(s,c){return window.epFlashHas&&epFlashHas(s,c)}});
EP.register('circles',{open:function(){return switchTab('campus')}});
EP.register('planner',{open:function(){return epOpenFocus('td')}});
EP.register('ncert',{open:function(a,b){return window.epOpenNcert&&epOpenNcert(a,b)}});
EP.register('pulse',{toggle:function(){return typeof toggleAiChatbotWindow==='function'&&toggleAiChatbotWindow()}});

/* ===== emit core events without touching their logic ===== */
(function(){
  var oSel=window.selectPracticeOption;
  if(typeof oSel==='function'&&!oSel.__ep1){
    var w=function(i){
      var idx=quizState.currentIndex,q=quizState.questions&&quizState.questions[idx],was=quizState.userAnswers&&quizState.userAnswers[idx]!==undefined;
      var r=oSel.apply(this,arguments);
      try{if(!was&&q&&quizState.userAnswers[idx]!==undefined)EP.emit('answered',{q:q,selected:i,correct:i===q.correct,mode:'practice',subject:quizState.subject,chapter:quizState.chapter})}catch(e){}
      return r;
    };w.__ep1=1;window.selectPracticeOption=w;
  }
  var oTest=window.recordTestQuestionStats;
  if(typeof oTest==='function'&&!oTest.__ep1){
    var t=function(items){var r=oTest.apply(this,arguments);try{(items||[]).forEach(function(it){if(it.selected!==null&&it.question)EP.emit('answered',{q:it.question,selected:it.selected,correct:it.selected===it.question.correct,mode:'test'})})}catch(e){}EP.mastery.invalidate();return r};
    t.__ep1=1;window.recordTestQuestionStats=t;
  }
})();

/* ===== self-tests ===== */
var T=EP.test;
T.add('Registry: register, call, missing service is safe',function(){
  EP.register('_t',{x:function(a){return a+1}});EP.assert(EP.call('_t','x',1)===2,'call failed');EP.assert(EP.call('_nope','x')===undefined,'missing should be undefined')},1);
T.add('Event bus: delivers, isolates listener errors',function(){
  var got=0,off=EP.on('_ev',function(){got++}),off2=EP.on('_ev',function(){throw new Error('boom')});EP.emit('_ev',{});
  return new Promise(function(r){setTimeout(r,20)}).then(function(){off();off2();EP.assert(got===1,'listener not called')})},1);
T.add('Router: EP.go opens view, hash round-trips',function(){
  var opened=null;EP.route.view('_t',{open:function(r){opened=r},close:function(){}});
  EP.setFlag('router',false);EP.go({view:'_t',chapter:{subject:'Zoology',chapter:'Cell: The Unit of Life'}});
  EP.assert(opened&&opened.chapter==='Cell: The Unit of Life'&&opened.subject==='Biology','route params wrong: '+JSON.stringify(opened));
  var h=EP.route.hash({view:'practice',subject:'Biology',chapter:'Work, Energy and Power'}),p=EP.route.parse(h);
  EP.assert(p&&p.view==='practice'&&p.chapter==='Work, Energy and Power','hash did not round-trip: '+h);
  EP.assert(EP.route.parse('#/campus/join/abc123')===null,'must ignore other routers');EP.route.closed('_t')},1);
T.add('Mastery: same number from every accessor',function(){
  var ch=data.Biology[0],q='selftest-m#a';
  var st=StorageModule.get(STORAGE_KEYS.qstats,{});st[q]={seen:3,correct:3,wrong:0,streak:3,lastSeen:Date.now(),sj:'Biology',ch:ch};StorageModule.set(STORAGE_KEYS.qstats,st);
  EP.mastery.invalidate();var a=EP.mastery('Biology',ch),b=EP.mastery.pct('Biology',ch,-1),c=EP.mastery.list({subject:'Biology'}).filter(function(r){return r.chapter===ch})[0];
  EP.assert(a.hasData&&a.pct>0,'no mastery');EP.assert(a.pct===b&&b===c.pct,'accessors disagree '+a.pct+'/'+b+'/'+(c&&c.pct));
  EP.assert(String(EP.ui.masteryChip('Biology',ch)).indexOf(a.pct+'%')>-1,'chip shows different number')},1);
T.add('Mastery: Botany/Zoology map to Biology',function(){var ch=data.Biology[0];EP.assert(EP.mastery('Zoology',ch).subject==='Biology','not mapped')},1);
T.add('My Cards: save, dedupe by id, deck shape, remove',function(){
  var c=EP.cards.save({id:'mc_selftest',front:'F',back:'B',s:'Biology',c:data.Biology[0]});EP.cards.save({id:'mc_selftest',front:'F2',back:'B'});
  EP.assert(EP.cards.list().filter(function(x){return x.id==='mc_selftest'}).length===1,'duplicate card');
  var d=EP.cards.decks();EP.assert(d.length&&d[0].cards.every(function(x){return x.id&&x.front&&x.back}),'bad deck shape');
  EP.assert(EP.cards.remove('mc_selftest')&&!EP.cards.get('mc_selftest'),'remove failed')},1);
T.add('Context: includes snapshot text',function(){var c=EP.context(true);EP.assert(typeof c.text==='string'&&c.text.length>10,'empty context')},1);
T.add('Design components render',function(){
  EP.assert(UI.ring(50).indexOf('stroke-dasharray')>-1,'ring');EP.assert(UI.empty({title:'x'}).indexOf('epu-empty')>-1,'empty');
  var s=UI.sheet({title:'t',html:'<button>x</button>'});EP.assert(document.querySelector('.epu-sheet'),'sheet missing');s.close()},1);
})();


;

(function(){
'use strict';
var EP=window.EP;if(!EP||!EP.__p1||EP.__p2)return;EP.__p2=1;
EP.build.phase=2;EP.build.id='p2-mistake-loop-20261120';
[['mistakeLoop','Wrong answers create a card + review entry'],['guessReview','Guessed-but-correct answers enter review'],['reviewSession','Unified Due-today session'],['reviseTile','Dashboard Revise tile']].forEach(function(f){EP.defineFlag(f[0],true,f[1])});
var RK='edupulse_review_v1',CONF='edupulse_question_confidence_v1',DAY=864e5,MAXITEMS=1500,SESSION_CAP=25,ver=0;
EP.newKeys.push(RK);
var UI=EP.ui;
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function plain(s){return String(s==null?'':s).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()}
function toast(m,t){try{showToast(m,t||'success')}catch(e){}}
function eod(){var d=new Date();d.setHours(23,59,59,999);return d.getTime()}
function hash(s){var h=5381;s=String(s);for(var i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36)}
function keyOf(q){return q&&(q.qKey||((quizState.chapter||'practice')+':'+(quizState.currentIndex||0)))}
function db(){var o=StorageModule.get(RK,null);return o&&o.items?o:{v:1,items:{}}}
function put(o){
  var keys=Object.keys(o.items);
  if(keys.length>MAXITEMS){keys.sort(function(a,b){return(o.items[a].last||0)-(o.items[b].last||0)}).slice(0,keys.length-MAXITEMS).forEach(function(k){delete o.items[k]})}
  var ok=EP.store.set(RK,o);ver++;return ok;
}
function snap(q){return{question:String(q.question||'').slice(0,900),options:(q.options||[]).map(function(x){return String(x).slice(0,240)}),correct:q.correct,explanation:plain(q.explanation).slice(0,900),subject:q.subject||'',sourceChapter:q.sourceChapter||'',qKey:q.qKey}}
function chapKey(it){return EP.chapterOf(it.qKey,{sj:it.s,ch:it.c})}

/* ===== due map: q:<qKey> entries ===== */
var R=EP.review={
  version:function(){return ver},
  get:function(qKey){return db().items['q:'+qKey]||null},
  items:function(){var o=db().items;return Object.keys(o).map(function(k){return o[k]})},
  isDue:function(it,limit){return it.d<=(limit||eod())},
  dueItems:function(){var l=eod();return R.items().filter(function(it){return R.isDue(it,l)}).sort(function(a,b){return a.d-b.d})},
  dueByChapter:function(){var m={};R.dueItems().forEach(function(it){var k=chapKey(it);if(k)m[k]=(m[k]||0)+1});return m},
  /* cards that are due outside mistake pairs: user-made My Cards + deck cards already studied once */
  dueCardIds:function(){
    var api=window.epFlashApi;if(!api)return[];var l=eod(),out=[];
    EP.cards.list().forEach(function(c){if(!c.qKey&&api.isDue(c.id,l))out.push(c.id)});
    api.dueIds(l).forEach(function(id){if(!/^m[cq]_/.test(id))out.push(id)});
    return out;
  },
  dueCount:function(){return R.dueItems().length+R.dueCardIds().length},
  touch:function(){ver++;EP.mastery&&EP.mastery.invalidate();EP.emit('review_changed',{count:R.dueCount()});paint()},
  upsert:function(q,o){
    o=o||{};var qKey=keyOf(q),d=db(),k='q:'+qKey,it=d.items[k],now=Date.now(),ck=EP.chapterOf(qKey,{sj:q.subject,ch:q.sourceChapter}),parts=ck?ck.split('|'):[];
    var fresh=!it;
    if(!it)it=d.items[k]={k:k,qKey:qKey,created:now,miss:0,i:0,r:0,e:2.5,src:o.src||'wrong'};
    it.q=snap(q);it.s=parts[0]||it.s||'';it.c=parts.slice(1).join('|')||it.c||'';it.last=now;
    if(o.type)it.type=o.type;
    if(o.src==='wrong'){it.src='wrong';if(o.newAttempt){it.miss++;it.r=0;it.i=0;it.e=Math.max(1.3,(it.e||2.5)-.2);it.d=eod();it.card='mq_'+hash(qKey)}}
    else if(fresh){it.d=now+DAY;it.i=1;it.src='guess'}
    put(d);return{item:it,fresh:fresh};
  },
  remove:function(qKey){var d=db();if(d.items['q:'+qKey]){delete d.items['q:'+qKey];put(d)}},
  grade:function(k,kind,opts){
    opts=opts||{};var d=db(),it=d.items[k];if(!it)return null;var now=Date.now(),prev=Math.max(0,+it.i||0),e=+it.e||2.5,days;
    if(kind==='again'){it.r=0;it.i=0;it.e=Math.max(1.3,e-.2);it.d=eod();it.lapses=(it.lapses||0)+1}
    else{
      if(kind==='hard'){days=Math.max(1,Math.round(prev?prev*1.2:1));it.e=Math.max(1.3,e-.15)}
      else if(kind==='easy'){days=Math.max(4,Math.round((prev||1)*e*1.3));it.e=Math.min(3.2,e+.15)}
      else days=it.r===0?1:it.r===1?3:Math.max(1,Math.round(prev*e));
      it.r=(it.r||0)+1;it.i=days;it.d=now+days*DAY;
    }
    it.last=now;it.n=(it.n||0)+1;
    var graduated=kind!=='again'&&it.i>=30;
    if(graduated)delete d.items[k];
    put(d);
    try{if(it.card&&window.epFlashApi&&epFlashApi.has(it.card))epFlashApi.rate(it.card,kind)}catch(e){}
    EP.emit('review_graded',{key:k,kind:kind,graduated:graduated});
    if(!opts.silent)R.touch();else{ver++;EP.mastery.invalidate()}
    return it;
  },
  statusHtml:function(q){
    if(!EP.flag('mistakeLoop'))return '';var it=R.get(keyOf(q));if(!it||it.src!=='wrong')return '';
    return '<div class="ep-saved-strip" role="status"><i class="fa-solid fa-rotate" aria-hidden="true"></i><span>Saved to revision'+(it.miss>1?' · missed '+it.miss+' times':'')+' · first review today · card added to My Mistakes</span></div>';
  }
};
/* keep the dashboard tile live without re-rendering the whole page */
function paint(){
  var n=R.dueCount();
  document.querySelectorAll('[data-ep-due]').forEach(function(el){el.textContent=n});
}

/* ===== mistake funnel ===== */
var M=EP.mistake={
  cardFor:function(q,selected,item){
    var L=function(i){return String.fromCharCode(65+i)+'. '+plain((q.options||[])[i])};
    var back='Correct: '+L(q.correct);
    if(selected!==undefined&&selected!==null&&selected!==q.correct&&(q.options||[])[selected]!==undefined)back+='\nYou chose: '+L(selected);
    var why=plain(q.explanation);if(why&&why!=='NCERT Concept.')back+='\n\n'+why.slice(0,700);
    var ck=EP.chapterOf(keyOf(q),{sj:q.subject,ch:q.sourceChapter}),parts=ck?ck.split('|'):[];
    return{id:'mq_'+hash(keyOf(q)),front:plain(q.question).slice(0,600),back:back.slice(0,1100),s:parts[0]||'',c:parts.slice(1).join('|')||'',qKey:keyOf(q),type:'mistake',miss:item?item.miss:1,tag:item&&item.type||''};
  },
  /* the single place a wrong answer turns into revision; safe to call repeatedly */
  record:function(q,selected,reason,newAttempt){
    var type=reason&&reason!=='Not tagged'?reason:undefined;
    var r=R.upsert(q,{src:'wrong',type:type,newAttempt:newAttempt});
    var card=M.cardFor(q,selected,r.item);EP.cards.save(card);
    if(newAttempt&&!r.fresh){try{window.epFlashApi&&epFlashApi.reset(card.id)}catch(e){}}
    if(newAttempt)EP.emit('mistake_logged',{qKey:r.item.qKey,miss:r.item.miss,type:r.item.type||null,subject:r.item.s,chapter:r.item.c});
    R.touch();return r.item;
  }
};
var origSave=window.saveErrorNotebookEntry;
if(typeof origSave==='function'&&!origSave.__ep2){
  window.saveErrorNotebookEntry=function(q,selected,reason){
    reason=reason||'Not tagged';
    if(!EP.flag('mistakeLoop')||!q||!q.qKey)return origSave.apply(this,arguments);
    var nb=StorageModule.get(STORAGE_KEYS.errorNotebook,{})||{},e=nb[q.qKey],last=e&&e.attempts&&e.attempts[0],age=last?Date.now()-new Date(last.date).getTime():Infinity,fresh=true;
    if(last&&last.selected===selected&&last.reason==='Not tagged'&&reason!=='Not tagged'&&age<18e5){last.reason=reason;e.q=q;StorageModule.set(STORAGE_KEYS.errorNotebook,nb);fresh=false}   /* tagging the same miss: update in place */
    else if(last&&last.selected===selected&&last.reason===reason&&age<2000){fresh=false}                                                       /* double fire */
    else origSave.apply(this,arguments);
    try{M.record(q,selected,reason,fresh)}catch(err){EP.warn('mistake loop failed',err&&err.message)}
  };
  window.saveErrorNotebookEntry.__ep2=1;
}

/* log at answer time (before the original renders, so the saved-to-revision strip is visible at once) */
var oSel=window.selectPracticeOption;
if(typeof oSel==='function'&&!oSel.__ep2){
  var wSel=function(i){
    try{
      var idx=quizState.currentIndex,q=quizState.questions&&quizState.questions[idx];
      if(q&&quizState.userAnswers[idx]===undefined){
        var wrong=i!==q.correct;
        if(wrong){if(EP.flag('mistakeLoop'))window.saveErrorNotebookEntry(q,i,'Not tagged')}
        else{
          var conf=0;try{conf=(JSON.parse(localStorage.getItem(CONF)||'{}')||{})[keyOf(q)]||0}catch(e){}
          if(conf===1&&EP.flag('guessReview')){R.upsert(q,{src:'guess'});R.touch()}
          else if(EP.flag('mistakeLoop')){var it=R.get(keyOf(q));if(it&&R.isDue(it)){R.grade(it.k,'good',{silent:true});paint()}}
        }
      }
    }catch(e){EP.warn('answer hook failed',e&&e.message)}
    return oSel.apply(this,arguments);
  };wSel.__ep2=1;window.selectPracticeOption=wSel;
}
/* confidence set after answering: a correct answer rated "Guessing" still goes to review */
document.addEventListener('change',function(e){
  var el=e.target&&e.target.closest&&e.target.closest('[data-confidence]');if(!el||String(el.value)!=='1'||!EP.flag('guessReview'))return;
  try{var idx=quizState.currentIndex,q=quizState.questions[idx];if(q&&quizState.userAnswers[idx]===q.correct){R.upsert(q,{src:'guess'});R.touch();toast('Added to revision')}}catch(err){}
},true);
/* timed tests: log at submit time, never during the test */
var oTest=window.recordTestQuestionStats;
if(typeof oTest==='function'&&!oTest.__ep2){
  var wTest=function(items){
    var r=oTest.apply(this,arguments);
    try{if(EP.flag('mistakeLoop'))(items||[]).forEach(function(it){if(it.selected!==null&&it.question&&it.question.qKey&&it.selected!==it.question.correct)window.saveErrorNotebookEntry(it.question,it.selected,'Not tagged')})}catch(e){EP.warn('test mistake log failed',e&&e.message)}
    return r;
  };wTest.__ep2=1;window.recordTestQuestionStats=wTest;
}

/* ===== dashboard tile ===== */
EP.tiles.push(function(c){
  if(!EP.flag('reviseTile'))return '';
  var n=R.dueCount();
  return UI.tile({tone:'violet',icon:'review',label:'Revise',hint:n?('About '+Math.max(1,Math.round(n*.6))+' min · due today'):'Nothing due. Nice work',count:'<span data-ep-due>'+n+'</span>',countHtml:1,requireCount:0,disabled:!n,onclick:"EP.go({view:'revise'})"});
});

/* ===== unified Due-today session ===== */
var S=null,root=null;
function interleave(a,b){var out=[],i=0,j=0;while(i<a.length||j<b.length){if(i<a.length)out.push(a[i++]);if(j<b.length)out.push(b[j++])}return out}
function buildQueue(){
  var qs=R.dueItems().map(function(it){return{kind:'q',key:it.k,it:it}});
  var api=window.epFlashApi,ids=R.dueCardIds(),mine={};
  EP.cards.list().forEach(function(c){mine[c.id]=c});
  var own=[],deckIds=[];ids.forEach(function(id){if(mine[id])own.push({kind:'card',id:id,front:mine[id].front,back:mine[id].back,deck:'My Cards'});else deckIds.push(id)});
  var p=deckIds.length&&api&&api.resolve?api.resolve(deckIds).catch(function(){return{}}):Promise.resolve({});
  return p.then(function(by){
    var deck=[];deckIds.forEach(function(id){var c=by[id];if(c)deck.push({kind:'card',id:id,front:c.front,back:c.back,deck:c.deck})});
    var cards=own.concat(deck),all=interleave(qs,cards),total=all.length;
    return{items:all.slice(0,SESSION_CAP),total:total};
  });
}
function mount(){
  if(root)return;
  root=document.createElement('div');root.id='epr';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Revise');
  root.addEventListener('click',function(e){var b=e.target.closest('[data-a]');if(b)act(b.dataset.a,b.dataset.v)});
  document.body.appendChild(root);
}
function close(){
  if(!root)return;root.classList.remove('on');document.documentElement.style.overflow='';document.removeEventListener('keydown',onKey,true);
  var was=S;S=null;EP.route.closed('revise');R.touch();
  if(was&&typeof currentTab!=='undefined'&&currentTab==='dashboard'){try{renderView()}catch(e){}}
}
function letter(i){return String.fromCharCode(65+i)}
function head(title,sub){return '<div class="epr-h"><b>'+esc(title)+'</b><span>'+esc(sub||'')+'</span><button type="button" class="epr-x" data-a="close" aria-label="Close revise">✕</button></div>'}
function draw(){
  if(!root||!S)return;var h;
  if(S.loading){h=head('Revise','Getting today’s items')+'<div class="epr-m">'+UI.skeleton(4)+'</div>'}
  else if(!S.q.length){h=head('Revise','Due today')+'<div class="epr-m">'+UI.empty({icon:'review',title:'Nothing due today',text:'Wrong answers and guessed questions will show up here for spaced review.',action:{label:'Back to dashboard',onclick:"EP.route.closed&&document.getElementById('epr')&&document.querySelector('#epr [data-a=close]').click()"}})+'</div>'}
  else if(S.pos>=S.q.length){
    var extra=S.total-S.q.length;
    h=head('Revise','Session complete')+'<div class="epr-m epr-done">'+UI.ring(S.q.length?Math.round(100*S.right/Math.max(1,S.right+S.wrong)):100,{size:96,stroke:9,tone:'teal',label:'Session accuracy'})+'<h2>'+(S.right+S.wrong?S.right+' of '+(S.right+S.wrong)+' answered right':'Session complete')+'</h2><p>'+S.q.length+' item'+(S.q.length===1?'':'s')+' reviewed'+(S.again?' · '+S.again+' will come back today':'')+(extra>0?' · '+extra+' more still due':'')+'</p><div class="epr-acts">'+(extra>0?'<button type="button" class="epr-b pri" data-a="more">Keep going</button>':'')+'<button type="button" class="epr-b" data-a="close">Done</button></div></div>';
  }else{
    var c=S.q[S.pos],pct=Math.round(100*S.pos/S.q.length);
    h=head('Revise',(S.pos+1)+' of '+S.q.length)+'<div class="epr-bar"><i style="width:'+pct+'%"></i></div><div class="epr-m">';
    if(c.kind==='q'){
      var q=c.it.q,tone=UI.tone(c.it.s);
      h+='<div class="epr-tags"><span class="epr-tag epu-t-'+tone+'">'+esc(c.it.c||c.it.s||'Question')+'</span>'+(c.it.src==='guess'?'<span class="epr-tag">Guessed last time</span>':'<span class="epr-tag">Missed '+(c.it.miss||1)+'×</span>')+(c.it.type?'<span class="epr-tag">'+esc(c.it.type)+'</span>':'')+'</div><div class="epr-card"><p class="epr-q">'+esc(q.question)+'</p><div class="epr-opts" role="radiogroup" aria-label="Options">';
      q.options.forEach(function(o,i){
        var st='';if(S.sel!=null){st=i===q.correct?' ok':i===S.sel?' no':''}
        h+='<button type="button" role="radio" aria-checked="'+(S.sel===i)+'" class="epr-opt'+st+'" data-a="pick" data-v="'+i+'"'+(S.sel!=null?' disabled':'')+'><b>'+letter(i)+'</b><span>'+esc(o)+'</span></button>';
      });
      h+='</div>';
      if(S.sel!=null)h+='<div class="epr-why" role="status"><b>'+(S.sel===q.correct?'Correct':'Not quite')+'. Answer: '+letter(q.correct)+'.</b>'+(q.explanation?'<p>'+esc(q.explanation)+'</p>':'')+'</div>';
      h+='</div>';
      if(S.sel!=null)h+=S.sel===q.correct?'<div class="epr-rate"><button type="button" class="epr-b" data-a="rate" data-v="hard">Hard</button><button type="button" class="epr-b pri" data-a="rate" data-v="good">Good</button><button type="button" class="epr-b" data-a="rate" data-v="easy">Easy</button></div>':'<div class="epr-rate"><button type="button" class="epr-b pri" data-a="rate" data-v="again">Continue</button></div>';
    }else{
      h+='<div class="epr-tags"><span class="epr-tag">'+esc(c.deck||'Flashcard')+'</span></div><button type="button" class="epr-card epr-flip" data-a="flip" aria-label="'+(S.flip?'Showing answer':'Show answer')+'"><small>'+(S.flip?'Answer':'Question')+'</small><p class="epr-q">'+esc(S.flip?c.back:c.front).replace(/\n/g,'<br>')+'</p></button>';
      h+=S.flip?'<div class="epr-rate"><button type="button" class="epr-b" data-a="rate" data-v="again">Again</button><button type="button" class="epr-b" data-a="rate" data-v="hard">Hard</button><button type="button" class="epr-b pri" data-a="rate" data-v="good">Good</button><button type="button" class="epr-b" data-a="rate" data-v="easy">Easy</button></div>':'<div class="epr-rate"><button type="button" class="epr-b pri" data-a="flip">Show answer</button></div>';
    }
    h+='</div>';
  }
  root.innerHTML=h;var f=root.querySelector('.epr-b.pri,.epr-opt:not([disabled])');if(f)f.focus({preventScroll:true});
}
function recordAnswer(c,right,sel){
  var stq=StorageModule.get(STORAGE_KEYS.qstats,{})||{},k=c.it.qKey,s=stq[k]||{seen:0,correct:0,wrong:0,streak:0,lastSeen:0};
  s.seen++;s.lastSeen=Date.now();if(c.it.s&&!s.sj){s.sj=c.it.s;s.ch=c.it.c}
  if(right){s.correct++;s.streak++}else{s.wrong++;s.streak=0}
  stq[k]=s;StorageModule.set(STORAGE_KEYS.qstats,stq);
  try{var q=c.it.q;EP.emit('answered',{q:q,selected:sel,correct:right,mode:'review',subject:c.it.s,chapter:c.it.c})}catch(e){}
}
var sel=null;
function act(a,v){
  if(a==='close'){close();return}
  if(!S||S.loading)return;
  var c=S.q[S.pos];
  if(a==='more'){start(true);return}
  if(a==='flip'){S.flip=!S.flip;draw();return}
  if(a==='pick'&&c&&c.kind==='q'&&S.sel==null){
    S.sel=+v;sel=S.sel;var right=S.sel===c.it.q.correct;recordAnswer(c,right,S.sel);
    if(right)S.right++;else{S.wrong++;try{window.saveErrorNotebookEntry(Object.assign({},c.it.q,{qKey:c.it.qKey}),S.sel,'Not tagged')}catch(e){}}
    draw();return;
  }
  if(a==='rate'&&c){
    if(c.kind==='q'){R.grade(c.key,v,{silent:true});if(v==='again'&&!c._r){c._r=1;S.q.push(Object.assign({},c,{_r:1}));S.again++}}
    else{try{epFlashApi.rate(c.id,v)}catch(e){}EP.emit('card_reviewed',{id:c.id,kind:v});if(v==='again'&&!c._r){S.q.push(Object.assign({},c,{_r:1}));S.again++}}
    S.pos++;S.sel=null;S.flip=false;sel=null;draw();
  }
}
function onKey(e){
  if(!S||S.loading||!root||!root.classList.contains('on'))return;
  if(e.key==='Escape'){e.preventDefault();close();return}
  var c=S.q[S.pos];if(!c)return;
  if(c.kind==='q'&&S.sel==null&&/^[1-4]$/.test(e.key)){act('pick',+e.key-1);e.preventDefault()}
  else if(c.kind==='card'&&!S.flip&&(e.key===' '||e.key==='Enter')&&!(e.target.closest&&e.target.closest('button'))){act('flip');e.preventDefault()}
}
function start(more){
  mount();root.classList.add('on');document.documentElement.style.overflow='hidden';document.addEventListener('keydown',onKey,true);
  S={loading:true,q:[],pos:0,sel:null,flip:false,right:0,wrong:0,again:0,total:0};draw();
  return buildQueue().then(function(r){S=Object.assign(S,{loading:false,q:r.items,total:r.total});draw()});
}
EP.review.open=function(){if(!EP.flag('reviewSession')){toast('Revise is switched off.','warning');return Promise.resolve()}return start()};
EP.route.view('revise',{open:function(){EP.review.open()},close:function(){if(root&&root.classList.contains('on')){root.classList.remove('on');document.documentElement.style.overflow='';S=null}}});
EP.register('review',{open:function(){return EP.go({view:'revise'})},dueCount:function(){return R.dueCount()}});

/* ===== self-tests ===== */
var T=EP.test,Q=function(t){return EP.test.fakeQ(t)};
function answer(q,i,fn){return EP.test.withQuestion(q,function(){selectPracticeOption(i);return fn&&fn()})}
function counts(q){
  var nb=StorageModule.get(STORAGE_KEYS.errorNotebook,{})||{};
  return{nb:nb[q.qKey]?1:0,attempts:nb[q.qKey]?nb[q.qKey].attempts.length:0,cards:EP.cards.list().filter(function(c){return c.qKey===q.qKey}).length,items:R.items().filter(function(x){return x.qKey===q.qKey}).length};
}
T.add('Wrong answer → exactly one notebook entry, one card, one review entry',function(){
  var q=Q('p2a'),before=R.dueCount();
  return answer(q,1,function(){var c=counts(q);EP.assert(c.nb===1&&c.cards===1&&c.items===1,'got '+JSON.stringify(c));EP.assert(R.dueCount()===before+1,'due count did not rise immediately: '+before+' → '+R.dueCount());
    EP.assert(R.get(q.qKey).d<=eod(),'not due today');EP.assert(EP.cards.get('mq_'+hash(q.qKey)).front.indexOf('Self-test question')===0,'card front wrong')});
},2);
T.add('Repeated misses update one card and one entry',function(){
  var q=Q('p2b');return answer(q,1,function(){quizState.userAnswers={};selectPracticeOption(2);var c=counts(q),it=R.get(q.qKey);
    EP.assert(c.cards===1&&c.items===1,'duplicates '+JSON.stringify(c));EP.assert(it.miss===2,'miss count '+it.miss);EP.assert(c.attempts===2,'attempts '+c.attempts)});
},2);
T.add('Tagging a miss does not duplicate anything',function(){
  var q=Q('p2c');return answer(q,1,function(){saveErrorNotebookEntry(q,1,'Conceptual gap');var c=counts(q),it=R.get(q.qKey),nb=StorageModule.get(STORAGE_KEYS.errorNotebook,{})[q.qKey];
    EP.assert(c.attempts===1&&c.cards===1&&c.items===1,'duplicates '+JSON.stringify(c));EP.assert(nb.attempts[0].reason==='Conceptual gap','reason not updated');EP.assert(it.type==='Conceptual gap','type not on review entry');EP.assert(it.miss===1,'tag counted as a new miss')});
},2);
T.add('Guessed-but-correct enters review without a card',function(){
  var q=Q('p2d'),cf=StorageModule.get(CONF,{});cf[q.qKey]=1;localStorage.setItem(CONF,JSON.stringify(cf));
  return answer(q,0,function(){var c=counts(q),it=R.get(q.qKey);EP.assert(c.items===1&&it.src==='guess','no guess entry');EP.assert(c.cards===0&&c.nb===0,'guess must not create a card or notebook entry');EP.assert(it.d>Date.now(),'guess should be due tomorrow')});
},2);
T.add('Confident correct answer does not enter review',function(){
  var q=Q('p2e');return answer(q,0,function(){var c=counts(q);EP.assert(c.items===0&&c.cards===0&&c.nb===0,'unexpected '+JSON.stringify(c))});
},2);
T.add('Grading moves entries: good leaves today, again stays',function(){
  var q=Q('p2f');return answer(q,1,function(){var k='q:'+q.qKey;R.grade(k,'good',{silent:true});EP.assert(R.get(q.qKey).d>eod(),'good should leave today');
    R.grade(k,'again',{silent:true});EP.assert(R.get(q.qKey).d<=eod(),'again should stay due today')});
},2);
T.add('Test submit logs misses; no logging while answering',function(){
  var q=Q('p2g');EP.assert(counts(q).items===0,'precondition');
  recordTestQuestionStats([{selected:1,question:q,number:1}]);var c=counts(q);EP.assert(c.items===1&&c.cards===1&&c.nb===1,'test miss not logged '+JSON.stringify(c))},2);
T.add('Dashboard tile reflects the due count',function(){
  var q=Q('p2h'),before=R.dueCount();return answer(q,1,function(){var html=EP.dash.saved({nWrong:0,nBook:0,nDue:0});EP.assert(html.indexOf('data-ep-due>'+(before+1)+'<')>-1,'tile shows wrong number');EP.assert(html.indexOf('Revise')>-1,'no Revise tile')});
},2);
T.add('Session queue interleaves cards and questions',function(){
  var q=Q('p2i');EP.cards.save({id:'mc_p2i',front:'CF',back:'CB'});
  return answer(q,1,function(){return buildQueue().then(function(r){var kinds=r.items.map(function(x){return x.kind});EP.assert(kinds.indexOf('q')>-1&&kinds.indexOf('card')>-1,'missing a kind: '+kinds);
    EP.assert(r.items.filter(function(x){return x.kind==='q'&&x.it.qKey===q.qKey}).length===1,'question missing or duplicated');
    EP.assert(r.items.filter(function(x){return x.kind==='card'&&/^mq_/.test(x.id||'')}).length===0,'mistake card double-counted in session')})});
},2);
T.add('Flag off: mistake loop does nothing, legacy notebook still works',function(){
  EP.setFlag('mistakeLoop',false);var q=Q('p2j');
  return answer(q,1,function(){var c=counts(q);EP.assert(c.items===0&&c.cards===0,'loop ran while flag off '+JSON.stringify(c))});
},2);
})();


;

(function(){
var MAXV=8,ICE={iceServers:[{urls:'stun:stun.l.google.com:19302'}]},L={rows:[],err:'',role:null,ch:null,pcs:{},stream:null,t0:0,id:null,vid:null,tick:null};
function $(s){return document.querySelector(s)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function api(){return window.__epCommunityApi}
function cl(){var a=api();if(!a||!a.ready)return Promise.reject(new Error('Account service is not ready. Log in and reload the page.'));return a.ready().then(function(x){return x.client})}
function me(){var u=api().session&&api().session()&&api().session().user;return u||{}}
function myName(){var u=me(),m=u.user_metadata||{};return m.full_name||m.name||(u.email||'Student').split('@')[0]}
function dur(s){s=Math.max(0,s|0);var h=s/3600|0,m=(s%3600)/60|0;return (h?h+'h ':'')+m+'m '+(s%60)+'s'}
function root(){return $('#ep-live')}
function load(){return cl().then(function(c){return c.from('live_sessions').select('*').order('started_at',{ascending:false}).limit(30)}).then(function(r){if(r.error)throw r.error;L.rows=r.data||[];L.err=''}).catch(function(e){L.err=e.message||'Live classes are not set up yet (run live-classes.sql).'})}
function stale(r){return r.status==='live'&&Date.now()-Date.parse(r.started_at)>6*3600e3}
function list(){var r=root();if(!r)return;var live=L.rows.filter(function(x){return x.status==='live'&&!stale(x)}),old=L.rows.filter(function(x){return x.status!=='live'||stale(x)});
r.innerHTML='<div class="lv-row"><div><b>Live classes</b><br><small class="cm-muted">Nothing is stored on our servers. You can download a copy for 1 hour after class, then it is deleted.</small></div><button class="cm-btn pri" id="lv-go"><i class="fa-solid fa-tower-broadcast"></i> Go live</button></div>'+(L.err?'<div class="cm-card cm-empty">'+esc(L.err)+'</div>':'')
+'<div id="lv-rec"></div><div class="epc-label">Live now</div>'+(live.map(function(x){return '<div class="lv-row"><div><span class="lv-dot"></span><b>'+esc(x.topic)+'</b><br><small class="cm-muted">'+esc(x.host_name||'Host')+'</small></div><button class="cm-btn pri" data-w="'+x.id+'">Watch</button></div>'}).join('')||'<p class="cm-muted" style="font-size:.85rem;margin:.4rem 0 1rem">No one is live right now.</p>')
+'<div class="epc-label">Past classes</div>'+(old.map(function(x){return '<div class="lv-row"><div><b>'+esc(x.topic)+'</b><br><small class="cm-muted">'+esc(x.host_name||'Host')+' · '+new Date(x.started_at).toLocaleString()+'</small></div><span class="cm-muted">'+(x.duration_sec!=null?dur(x.duration_sec):'ended')+'</span></div>'}).join('')||'<p class="cm-muted" style="font-size:.85rem">Ended classes will appear here.</p>');
$('#lv-go').onclick=hostForm;window.epRec&&epRec.paint($('#lv-rec'));r.querySelectorAll('[data-w]').forEach(function(b){b.onclick=function(){watch(b.dataset.w)}})}
function hostForm(){root().innerHTML='<div class="cm-card" style="padding:1rem"><b>Start a live class</b><p class="cm-muted" style="font-size:.8rem;margin:.3rem 0 .7rem">Up to '+MAXV+' viewers (direct connections). Nothing is recorded.</p><input id="lv-topic" maxlength="120" placeholder="Topic, e.g. Human Physiology: Kidney"><div style="margin-top:.6rem"><small class="cm-muted">Class slides for the whiteboard (PDF. For PPT/PPTX use File → Export → PDF)</small><input type="file" id="lv-file" accept=".pdf,application/pdf,.ppt,.pptx"></div><div class="flex gap-2" style="display:flex;gap:.5rem;margin-top:.7rem"><button class="cm-btn pri" id="lv-cam">Camera</button><button class="cm-btn" id="lv-scr">Share screen</button><button class="cm-btn pri" id="lv-brd"><i class="fa-solid fa-chalkboard"></i> Whiteboard / slides</button><button class="cm-btn" id="lv-x">Cancel</button></div><div id="lv-err" style="color:#e11d48;font-size:.85rem;margin-top:.6rem;white-space:pre-line;word-break:break-word"></div></div>';
$('#lv-x').onclick=list;$('#lv-cam').onclick=function(){start('cam')};$('#lv-scr').onclick=function(){start('scr')};$('#lv-brd').onclick=function(){start('brd')}}
function diag(e){var o='['+location.protocol+' secure='+window.isSecureContext+' framed='+(window.top!==window)+' err='+(e&&e.name)+']';if(!navigator.permissions||!navigator.permissions.query)return Promise.resolve(o);return Promise.all(['camera','microphone'].map(function(n){return navigator.permissions.query({name:n}).then(function(r){return n+'='+r.state},function(){return n+'=?'})})).then(function(a){return o+' '+a.join(' ')})}
function fail(m){var e=$('#lv-err');if(e)e.textContent=m;else (window.toast?toast(m,'error'):console.warn(m))}
function friendly(e){var m=(e&&e.message)||String(e),n=e&&e.name;if(n==='NotAllowedError'||n==='SecurityError')return 'Allow camera and microphone access in your browser, then try again.';if(n==='NotFoundError')return 'No camera or microphone was found on this device.';if(n==='NotReadableError')return 'Your camera or mic is being used by another app. Close it and try again.';if(/permission denied for table/i.test(m))return 'Database permission missing. Run live-classes.sql in the Supabase SQL editor.';if(/does not exist|schema cache/i.test(m))return 'The live_sessions table was not found. Run live-classes.sql in Supabase.';if(/host_id|jwt|not authenticated/i.test(m))return 'Please log in first, then try again.';return m}
function media(k){if(k==='brd'){var fi=$('#lv-file');return window.epBoard.open(fi&&fi.files&&fi.files[0])}var md=navigator.mediaDevices;if(!md||!md.getUserMedia)return Promise.reject(new Error('Camera needs a secure page. Open the app over https (or localhost).'));
if(k==='scr'){if(!md.getDisplayMedia)return Promise.reject(new Error('Screen sharing is not supported on this device. Use Camera instead.'));return md.getDisplayMedia({video:true,audio:true}).then(function(s){return md.getUserMedia({audio:true}).then(function(a){a.getAudioTracks().forEach(function(t){s.addTrack(t)});return s},function(){return s})})}
return md.getUserMedia({video:true,audio:true}).catch(function(e){if(e&&(e.name==='NotAllowedError'||e.name==='SecurityError'))throw e;return md.getUserMedia({audio:true})})}
function start(k){var t=($('#lv-topic').value||'').trim();if(!t){fail('Enter a topic first.');$('#lv-topic').focus();return}
fail('');['#lv-cam','#lv-scr'].forEach(function(x){var b=$(x);if(b)b.disabled=true});
var ok;try{ok=media(k)}catch(e){ok=Promise.reject(e)}
ok.then(function(s){L.stream=s;return cl().then(function(c){return c.from('live_sessions').insert({topic:t,host_name:myName()}).select().single().then(function(r){if(r.error)throw r.error;L.id=r.data.id;L.role='host';L.t0=Date.now();chan(c,L.id);room(t,true)})})}).catch(function(e){stopMedia();L.role=null;['#lv-cam','#lv-scr'].forEach(function(x){var b=$(x);if(b)b.disabled=false});diag(e).then(function(d){fail(friendly(e)+'\n'+d)})})}
function chan(c,id){L.ch=c.channel('live-'+id,{config:{broadcast:{self:false},presence:{key:me().id||String(Math.random())}}});
L.ch.on('broadcast',{event:'chat'},function(p){addMsg(p.payload)}).on('presence',{event:'sync'},function(){var n=Object.keys(L.ch.presenceState()).length,e=$('#lv-n');L.peak=Math.max(L.peak||0,n-1);if(e)e.textContent=Math.max(0,n-(L.role==='host'?1:1))+' watching'})
.on('broadcast',{event:'rx'},function(p){fly(p.payload.e)}).on('broadcast',{event:'hand'},function(p){hand(p.payload)}).on('broadcast',{event:'poll'},function(p){L.poll=p.payload;poll()}).on('broadcast',{event:'vote'},function(p){vote(p.payload)}).on('broadcast',{event:'pin'},function(p){L.pin=p.payload.t;pin()}).on('broadcast',{event:'lock'},function(p){L.lock=p.payload.on;lockUi()}).on('broadcast',{event:'state'},function(p){if(L.role==='viewer'){L.pin=p.payload.pin;L.poll=p.payload.poll;L.lock=p.payload.lock;pin();poll();lockUi()}}).on('broadcast',{event:'join'},function(p){if(L.role==='host'){offer(p.payload.v);setTimeout(function(){send('state',{pin:L.pin,poll:L.poll,lock:L.lock})},800)}}).on('broadcast',{event:'sig'},sig).on('broadcast',{event:'end'},function(){if(L.role==='viewer'){leave();window.toast&&toast('The class has ended.','info');L.role=null;load().then(list)}});}
function send(ev,p){L.ch&&L.ch.send({type:'broadcast',event:ev,payload:p})}
function pc(peer){var p=new RTCPeerConnection(ICE);L.pcs[peer]=p;p.onicecandidate=function(e){e.candidate&&send('sig',{to:peer,from:L.vid,ice:e.candidate})};return p}
function offer(v){if(Object.keys(L.pcs).length>=MAXV){send('sig',{to:v,full:1});return}var p=pc(v);L.stream.getTracks().forEach(function(t){p.addTrack(t,L.stream)});p.createOffer().then(function(o){return p.setLocalDescription(o).then(function(){send('sig',{to:v,from:L.vid,sdp:p.localDescription})})})}
function sig(m){var d=m.payload;if(d.to!==L.vid)return;if(d.full){window.toast&&toast('This class is full.','warning');leave();list();return}var p=L.pcs[d.from];
if(d.sdp&&L.role==='viewer'){p=p||pc(d.from);p.ontrack=function(e){var v=$('#lv-v');if(v&&v.srcObject!==e.streams[0])v.srcObject=e.streams[0];window.epRec&&epRec.start(e.streams[0],L.topic||'Class',1500)};p.setRemoteDescription(d.sdp).then(function(){return p.createAnswer()}).then(function(a){return p.setLocalDescription(a).then(function(){send('sig',{to:d.from,from:L.vid,sdp:p.localDescription})})})}
else if(d.sdp&&p){p.setRemoteDescription(d.sdp)}else if(d.ice&&p){p.addIceCandidate(d.ice).catch(function(){})}}
function watch(id){cl().then(function(c){L.id=id;L.role='viewer';L.vid=me().id||'v'+Math.random().toString(36).slice(2);var row=L.rows.filter(function(x){return x.id===id})[0]||{};chan(c,id);room(row.topic,false);L.ch.subscribe(function(s){if(s==='SUBSCRIBED'){L.ch.track({n:myName()});send('join',{v:L.vid})}})})}
function room(topic,host){L.vid=L.vid||me().id||'h';var r=root();L.topic=topic;L.pin='';L.poll=null;L.lock=false;L.hands=[];L.votes={};L.my=-1;
r.innerHTML='<div class="lv-row"><div><span class="lv-dot"></span><b>'+esc(topic)+'</b> <small class="cm-muted" id="lv-n"></small><br><small class="cm-muted" id="lv-t">0m 0s</small></div><div style="display:flex;gap:.4rem">'+(host?'<button class="cm-btn" id="lv-mic" title="Mute mic" aria-label="Mute mic"><i class="fa-solid fa-microphone"></i></button><button class="cm-btn" id="lv-cm" title="Camera on/off" aria-label="Camera on/off"><i class="fa-solid fa-video"></i></button><button class="cm-btn" id="lv-fl" title="Flip camera" aria-label="Flip camera"><i class="fa-solid fa-camera-rotate"></i></button>':'<button class="cm-btn" id="lv-fs" title="Fullscreen" aria-label="Fullscreen"><i class="fa-solid fa-expand"></i></button>')+'<button class="cm-btn" id="lv-end">'+(host?'End class':'Leave')+'</button></div></div><div class="lv-grid"><div class="lv-main"><div class="lv-stage"><video id="lv-v" autoplay playsinline '+(host?'muted':'controls')+'></video><div id="lv-fly"></div><div class="lv-wait" id="lv-wait">'+(host?'You are live':'Connecting to the class…')+'</div></div><div class="lv-rx">'+['👍','🔥','👏','❓'].map(function(e){return '<button class="cm-btn" data-e="'+e+'">'+e+'</button>'}).join('')+(host?'':'<button class="cm-btn" id="lv-hand"><i class="fa-regular fa-hand"></i> Raise hand</button>')+'</div></div><div class="lv-side"><div id="lv-pin"></div><div id="lv-poll"></div>'+(host?'<div id="lv-hands"></div><div class="lv-tools"><button class="cm-btn" id="lv-np">New poll</button><button class="cm-btn" id="lv-lk">Lock chat</button></div>':'')+'<div class="lv-chat" id="lv-c"></div><input id="lv-in" maxlength="300" placeholder="Say something">'+(host?'<small class="cm-muted">Tap a message to pin it</small>':'')+'</div></div>';
$('#lv-v').onplaying=function(){$('#lv-wait').style.display='none'};r.querySelectorAll('[data-e]').forEach(function(x){x.onclick=function(){fly(x.dataset.e);send('rx',{e:x.dataset.e})}});
if(host){$('#lv-mic').onclick=function(){tog(L.stream.getAudioTracks(),this,'fa-microphone','fa-microphone-slash')};$('#lv-cm').onclick=function(){tog(L.stream.getVideoTracks(),this,'fa-video','fa-video-slash')};$('#lv-np').onclick=pollForm;$('#lv-fl').onclick=flip;$('#lv-lk').onclick=function(){L.lock=!L.lock;this.textContent=L.lock?'Unlock chat':'Lock chat';send('lock',{on:L.lock})}}
else{$('#lv-hand').onclick=function(){send('hand',{u:L.vid,n:myName()});this.disabled=true;this.textContent='Hand raised ✋'};$('#lv-fs').onclick=function(){var v=$('#lv-v');v.requestFullscreen&&v.requestFullscreen()}}
if(host){$('#lv-v').srcObject=L.stream;if(window.epBoard&&epBoard.on)epBoard.mount($('.lv-stage'),$('#lv-v'));window.epRec&&epRec.start(L.stream,topic);L.ch.subscribe(function(s){if(s==='SUBSCRIBED')L.ch.track({n:'host'})})}
var t0=Date.now();clearInterval(L.tick);L.tick=setInterval(function(){var e=$('#lv-t');if(e)e.textContent=dur((Date.now()-t0)/1000)},1000);
$('#lv-end').onclick=host?end:function(){leave();load().then(list)};$('#lv-in').onkeydown=function(e){if(e.key==='Enter'&&this.value.trim()){if(L.lock&&L.role!=='host'){return}var m={n:myName(),t:this.value.trim()};addMsg(m);send('chat',m);this.value=''}}}
function addMsg(m){var c=$('#lv-c');if(!c)return;c.insertAdjacentHTML('beforeend','<div class="lv-m" data-t="'+esc(m.t)+'"><b>'+esc(m.n)+':</b> '+esc(m.t)+'</div>');c.scrollTop=c.scrollHeight}

function tog(ts,b,on,off){var x=ts.length&&!ts[0].enabled;ts.forEach(function(t){t.enabled=x});b.firstChild.className='fa-solid '+(x?on:off)}
function fly(e){var f=$('#lv-fly');if(!f)return;var d=document.createElement('span');d.textContent=e;d.style.left=(10+Math.random()*70)+'%';f.appendChild(d);setTimeout(function(){d.remove()},2200)}
function hand(h){if(L.role!=='host')return;if(!L.hands.some(function(x){return x.u===h.u}))L.hands.push(h);hands()}
function hands(){var e=$('#lv-hands');if(!e)return;e.innerHTML=L.hands.length?'<div class="lv-box"><b>✋ Hands up</b>'+L.hands.map(function(h,i){return '<button class="cm-chip" data-h="'+i+'">'+esc(h.n)+' ✕</button>'}).join('')+'</div>':'';e.querySelectorAll('[data-h]').forEach(function(b){b.onclick=function(){L.hands.splice(+b.dataset.h,1);hands()}})}
function pin(){var e=$('#lv-pin');if(e)e.innerHTML=L.pin?'<div class="lv-box">📌 '+esc(L.pin)+'</div>':''}
function lockUi(){var i=$('#lv-in');if(!i||L.role==='host')return;i.disabled=!!L.lock;i.placeholder=L.lock?'Host has locked the chat':'Say something'}
function pollForm(){epAsk.prompt('Ask the class a quick question.',{title:'New poll',placeholder:'Poll question',ok:'Next'}).then(function(q){if(!q||!q.trim())return;return epAsk.prompt('Separate options with commas (2 to 4).',{title:'Poll options',placeholder:'A, B, C',ok:'Start poll'}).then(function(raw){if(raw===null)return;var o=(raw||'').split(',').map(function(x){return x.trim()}).filter(Boolean).slice(0,4);if(o.length<2){window.toast&&toast('Add at least 2 options','warning');return}L.votes={};L.poll={q:q.trim().slice(0,120),o:o,c:o.map(function(){return 0}),open:1};poll();send('poll',L.poll)})})}
function vote(v){if(L.role!=='host'||!L.poll||!L.poll.open)return;L.votes[v.u]=v.i;L.poll.c=L.poll.o.map(function(_,i){return Object.keys(L.votes).filter(function(k){return L.votes[k]===i}).length});poll();send('poll',L.poll)}
function poll(){var e=$('#lv-poll');if(!e)return;var p=L.poll;if(!p){e.innerHTML='';return}var t=p.c.reduce(function(a,b){return a+b},0)||1;
e.innerHTML='<div class="lv-box"><b>'+esc(p.q)+'</b>'+p.o.map(function(o,i){var pc=Math.round(p.c[i]*100/t);return '<button class="lv-opt'+(L.my===i?' on':'')+'" data-o="'+i+'"><i style="width:'+pc+'%"></i><span>'+esc(o)+'</span><em>'+pc+'%</em></button>'}).join('')+(L.role==='host'?'<button class="cm-btn" id="lv-cp">Close poll</button>':'')+'</div>';
e.querySelectorAll('[data-o]').forEach(function(b){b.onclick=function(){if(L.role==='host'||L.my>=0||!p.open)return;L.my=+b.dataset.o;send('vote',{u:L.vid,i:L.my});poll()}});var cp=$('#lv-cp');if(cp)cp.onclick=function(){L.poll.open=0;L.poll=null;poll();send('poll',null)}}
document.addEventListener('click',function(e){var m=e.target.closest&&e.target.closest('.lv-m');if(m&&L.role==='host'){L.pin=m.dataset.t;pin();send('pin',{t:L.pin})}});
function flip(){L.face=L.face==='environment'?'user':'environment';navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:L.face}}}).then(function(ns){var nt=ns.getVideoTracks()[0],old=L.stream.getVideoTracks()[0];if(old){L.stream.removeTrack(old);old.stop()}L.stream.addTrack(nt);Object.keys(L.pcs).forEach(function(k){var sd=L.pcs[k].getSenders().filter(function(x){return x.track&&x.track.kind==='video'})[0];if(sd)sd.replaceTrack(nt)});$('#lv-v').srcObject=L.stream}).catch(function(e){alert(friendly(e))})}
function stopMedia(){if(L.stream){L.stream.getTracks().forEach(function(t){t.stop()});L.stream=null}}
function leave(){window.epRec&&epRec.stop();window.epBoard&&epBoard.close();clearInterval(L.tick);Object.keys(L.pcs).forEach(function(k){try{L.pcs[k].close()}catch(e){}});L.pcs={};if(L.ch){try{L.ch.unsubscribe()}catch(e){}L.ch=null}stopMedia();L.role=null}
function end(){var s=Math.round((Date.now()-L.t0)/1000),id=L.id;send('end',{});cl().then(function(c){return c.from('live_sessions').update({status:'ended',ended_at:new Date().toISOString(),duration_sec:s}).eq('id',id)}).then(function(){var pk=L.peak||0;leave();L.peak=0;return load().then(function(){list();toast('Class ended · '+dur(s)+' · peak '+pk+' watching','success')})})}
window.addEventListener('beforeunload',function(){if(L.role==='host'&&L.id)try{send('end',{})}catch(e){}});
window.epLiveBusy=function(){return !!L.role};window.epLiveLeave=function(){if(L.role==='host')end();else{leave()}};window.epLiveRender=function(){if(L.role){return}load().then(list)};
})();

;

(function(){var t;function f(){var d=document.getElementById('cm-doubts'),q=document.getElementById('lv-dq');
if(d&&!q){d.insertAdjacentHTML('beforebegin','<input id="lv-dq" type="search" placeholder="Search doubts" aria-label="Search doubts">');q=document.getElementById('lv-dq');q.oninput=flt}if(!d&&q)q.remove();if(d&&q&&q.value)flt();
var m=document.getElementById('cm-msgs'),j=document.getElementById('lv-jmp');
if(m&&!j){j=document.createElement('button');j.id='lv-jmp';j.hidden=true;j.setAttribute('aria-label','Jump to latest');j.innerHTML='<i class="fa-solid fa-arrow-down"></i>';j.onclick=function(){var x=document.getElementById('cm-msgs');x&&x.scrollTo({top:x.scrollHeight,behavior:'smooth'})};document.body.appendChild(j)}
if(!m&&j)j.remove();if(m&&!m.__lv){m.__lv=1;m.addEventListener('scroll',function(){var b=document.getElementById('lv-jmp');if(b)b.hidden=m.scrollHeight-m.scrollTop-m.clientHeight<300},{passive:true})}}
function flt(){var q=(document.getElementById('lv-dq').value||'').toLowerCase().trim(),d=document.getElementById('cm-doubts');if(!d)return;Array.prototype.forEach.call(d.children,function(c){c.style.display=!q||c.textContent.toLowerCase().indexOf(q)>=0?'':'none'})}
new MutationObserver(function(){clearTimeout(t);t=setTimeout(f,150)}).observe(document.body,{childList:true,subtree:true});
})();

;

(function(){
function at(){try{return StorageModule.get(STORAGE_KEYS.attempts,[])||[]}catch(e){return[]}}
function xpOf(a){return Math.round((a.correct||0)*4+(a.wrong||0)+((a.attempted||0)>=10?10:0)+((a.attempted||0)>=10&&(a.accuracy||0)>=80?25:0))}
function need(l){return 50*l*(l-1)}
function lvl(x){return Math.max(1,Math.floor((1+Math.sqrt(1+x/12.5))/2))}
var T=[[1,'Aspirant'],[3,'Learner'],[5,'Scholar'],[8,'Achiever'],[12,'Expert'],[17,'Topper'],[25,'Legend']];
function title(l){var t=T[0][1];T.forEach(function(x){if(l>=x[0])t=x[1]});return t}
function day(t){return new Date(t).toDateString()}
function stats(){var A=at(),xp=0,cor=0,days={},best=0;A.forEach(function(a){xp+=xpOf(a);cor+=a.correct||0;days[day(a.finishedAt)]=1;if((a.attempted||0)>=10)best=Math.max(best,a.accuracy||0)});
var fm=0;try{var F=window.epFocus.stats();fm=F.tot;Object.keys(F.o).forEach(function(k){if(F.o[k]>=10)days[new Date(k+'T00:00:00').toDateString()]=1})}catch(e){}xp+=Math.floor(fm/2);var st=0,d=new Date();if(!days[day(d)])d.setDate(d.getDate()-1);while(days[day(d)]){st++;d.setDate(d.getDate()-1)}
var l=lvl(xp);return{fm:fm,xp:xp,l:l,cor:cor,n:A.length,st:st,best:best,lo:need(l),hi:need(l+1)}}
function badges(S){return[['🎯','First session',S.n>=1],['📚','10 sessions',S.n>=10],['✅','100 correct',S.cor>=100],['🏅','500 correct',S.cor>=500],['🔥','3-day streak',S.st>=3],['⚡','7-day streak',S.st>=7],['🧠','90%+ session',S.best>=90],['🚀','Level 5',S.l>=5]].concat((function(){try{return epFocus.badges().map(function(b){return[b[1],b[0],b[2]]})}catch(e){return[]}})())}
function wk(){var A=at(),o=[],i,d,x;for(i=6;i>=0;i--){d=new Date();d.setDate(d.getDate()-i);x=0;A.forEach(function(a){if(day(a.finishedAt)===d.toDateString())x+=xpOf(a)});o.push([d.toLocaleDateString(undefined,{weekday:'narrow'}),x])}return o}
function goal(){return +(localStorage.getItem('ep_goal')||30)}
function today(){var n=0;at().forEach(function(a){if(day(a.finishedAt)===day(Date.now()))n+=a.attempted||0});return n}
function goalHtml(){var w=wk(),m=Math.max.apply(null,w.map(function(x){return x[1]}).concat([1])),g=goal(),t=today(),pc=Math.min(100,Math.round(t*100/g));
return '<div style="margin:.7rem 0"><div style="display:flex;justify-content:space-between;font-size:.8rem"><b>Daily goal '+(pc>=100?'✅':'')+'</b><span class="cm-muted">'+t+' / '+g+' questions · <a href="#" onclick="epGoal();return false">edit</a></span></div><div class="xp-bar"><i style="width:'+pc+'%"></i></div></div><div style="display:flex;gap:.35rem;align-items:flex-end;height:70px;margin:.4rem 0 .8rem">'+w.map(function(x){return '<div style="flex:1;text-align:center;font-size:.6875rem"><div title="'+x[1]+' XP" style="height:'+Math.max(3,Math.round(x[1]*50/m))+'px;border-radius:6px;background:linear-gradient(#6366f1,#14b8a6);opacity:'+(x[1]?1:.25)+'"></div>'+x[0]+'</div>'}).join('')+'</div>'}
window.epGoal=function(){var body='<label for="ep-goal-in" class="block text-xs font-bold mb-1">Questions per day (5 to 300)</label><input id="ep-goal-in" type="number" inputmode="numeric" min="5" max="300" step="5" value="'+goal()+'" class="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800" onkeydown="if(event.key===\'Enter\')epGoalSave()">',foot='<button type="button" onclick="closeModal()" class="mr-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold dark:bg-slate-800">Cancel</button><button type="button" onclick="epGoalSave()" class="rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-black text-white">Save goal</button>';setModal('Daily question goal','Your target for the day. You can change it any time.',body,foot);setTimeout(function(){var i=document.getElementById('ep-goal-in');if(i){i.focus();i.select();}},60)};
window.epGoalSave=function(){var i=document.getElementById('ep-goal-in'),v=parseInt(i&&i.value,10);if(!(v>=5&&v<=300)){toast('Enter a goal between 5 and 300','warning');return}try{localStorage.setItem('ep_goal',v)}catch(e){}closeModal();var c=document.getElementById('xp-card');if(c){c.outerHTML=card();more()}toast('Goal set to '+v,'success')};
function card(){var S=stats(),pc=Math.min(100,Math.round((S.xp-S.lo)*100/(S.hi-S.lo)));
return '<section class="xp-card" id="xp-card"><div class="xp-top"><div class="xp-lv">'+S.l+'</div><div style="flex:1"><b style="font-size:1.1rem">'+title(S.l)+'</b><div class="xp-bar"><i style="width:'+pc+'%"></i></div><small class="cm-muted">'+S.xp+' XP · '+(S.hi-S.xp)+' to Level '+(S.l+1)+'</small></div></div><div class="xp-stats"><div><b>'+S.xp+'</b>Total XP</div><div><b>'+S.st+'🔥</b>Day streak</div><div><b>'+S.cor+'</b>Correct</div><div><b>'+Math.round(S.fm/6)/10+'h</b>Focused</div></div>'+goalHtml()+'<div class="xp-badges" id="xp-more" style="margin-bottom:.6rem"></div><div class="xp-badges">'+badges(S).map(function(b){return '<span class="xp-b'+(b[2]?'':' off')+'">'+b[0]+' '+b[1]+'</span>'}).join('')+'</div><div class="xp-acts"><button class="cm-btn" onclick="epXpShare()"><i class="fa-solid fa-share-nodes"></i> Share card</button><button class="cm-btn" onclick="epXpSend()"><i class="fa-solid fa-paper-plane"></i> Send to chat</button><button class="cm-btn" onclick="epXpCopy()"><i class="fa-solid fa-at"></i> Copy @handle</button></div><small class="cm-muted" style="display:block;margin-top:.5rem">XP: 4 per correct answer, 1 per attempt, +10 per 10+ question session, +25 at 80%+ accuracy, and +1 per 2 minutes of Focus.</small></section>'}
function handle(){var I=window.epIdentity&&epIdentity();if(I&&I.handle)return I.handle;var e=document.querySelector('.cm-pill .t');var t=e&&e.textContent||'';return /^@/.test(t)?t:''}
window.epXpShare=function(){var S=stats(),t='I am Level '+S.l+' ('+title(S.l)+') on EduPulse with '+S.xp+' XP and a '+S.st+'-day streak. '+handle();navigator.share?navigator.share({text:t}).catch(function(){}):(navigator.clipboard&&navigator.clipboard.writeText(t),toast('Card text copied','success'))};
window.epXpCopy=function(){var h=handle();if(!h){toast('Choose a handle in Circles first','warning');return}navigator.clipboard&&navigator.clipboard.writeText(h);toast('Handle copied','success')};
window.epXpMini=function(){var S=stats(),pc=Math.min(100,Math.round((S.xp-S.lo)*100/(S.hi-S.lo)));return '<div class="cm-row tg-me" role="button" tabindex="0" onclick="switchTab(\'profile\')"><span class="tg-av xp-lv" style="width:48px;height:48px;font-size:1.1rem;border-radius:50%">'+S.l+'</span><div class="mid"><b>'+title(S.l)+' · Level '+S.l+'</b><small>'+S.xp+' XP · '+S.st+'🔥 streak · tap for profile</small><div class="xp-bar" style="margin:.3rem 0 0;height:6px"><i style="width:'+pc+'%"></i></div></div><div class="end"><i class="fa-solid fa-chevron-right"></i></div></div>'};
window.epXpLine=function(){var S=stats();return 'Lv '+S.l+' · '+S.st+'🔥 streak · '+S.xp+' XP'};
window.epXpSend=function(){var L=window.epCircleLink,cs=L?L.chats():[];if(!cs.length){toast('Open Circles once so your chats can load','warning');return}
var m=document.getElementById('xp-m');if(m)m.remove();m=document.createElement('div');m.id='xp-m';m.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:grid;place-items:center;padding:1rem';
m.innerHTML='<div style="background:var(--card-bg,#fff);color:inherit;border-radius:18px;padding:1rem;width:100%;max-width:420px;max-height:80vh;overflow:auto"><b>Send to a chat</b><select id="xp-k" class="cm-btn" style="width:100%;margin:.6rem 0"><option value="card">My level card</option><option value="last">My last practice result</option></select>'+cs.map(function(c){return '<button class="cm-btn" style="display:block;width:100%;text-align:left;margin-bottom:.35rem" data-id="'+c.id+'">'+c.name.replace(/[<>&]/g,'')+'</button>'}).join('')+'<button class="cm-btn" id="xp-x" style="width:100%;margin-top:.3rem">Cancel</button></div>';
document.body.appendChild(m);m.onclick=function(e){if(e.target===m)m.remove()};document.getElementById('xp-x').onclick=function(){m.remove()};
m.querySelectorAll('[data-id]').forEach(function(b){b.onclick=function(){var S=stats(),A=at()[0],k=document.getElementById('xp-k').value,t;
if(k==='last'){if(!A){toast('No practice result yet','warning');return}t='I scored '+A.correct+'/'+A.total+' ('+(A.accuracy||0)+'%) in '+A.chapter+'. Can you beat it?'}else t='Level '+S.l+' ('+title(S.l)+') on EduPulse · '+S.xp+' XP · '+S.st+'-day streak 🔥';
m.remove();L.say(b.dataset.id,t)}})};
function more(){var e=document.getElementById('xp-more');if(!e)return;var fl={};try{fl=JSON.parse(localStorage.getItem('ep_focus_log')||'{}')}catch(x){}var wkm=0,i,d;for(i=0;i<7;i++){d=new Date();d.setDate(d.getDate()-i);wkm+=fl[d.toDateString()]||0}
var A=at(),att=0,cor=0;A.forEach(function(a){att+=a.attempted||0;cor+=a.correct||0});var P=['<span class="xp-b">⏱ Focus '+(fl[new Date().toDateString()]||0)+'m today · '+wkm+'m week · '+(window.epFocus?Math.round(epFocus.stats().tot/6)/10:0)+'h total</span>','<span class="xp-b">🎯 Accuracy '+(att?Math.round(cor*100/att):0)+'% over '+att+' answered</span>'];e.innerHTML=P.join('');
var a=window.__epCommunityApi;if(!a||!a.ready)return;a.ready().then(function(x){var u=a.session&&a.session()&&a.session().user;if(!u)return;var c=x.client;
c.from('live_sessions').select('duration_sec').eq('host_id',u.id).eq('status','ended').then(function(r){if(r.error||!r.data||!r.data.length)return;var m=0;r.data.forEach(function(z){m+=z.duration_sec||0});e.insertAdjacentHTML('beforeend','<span class="xp-b">🎙 '+r.data.length+' classes taught · '+Math.round(m/60)+' min</span>')});
c.from('threads').select('score').eq('author_id',u.id).then(function(r){if(r.error||!r.data||!r.data.length)return;var k=0;r.data.forEach(function(z){k+=z.score||0});e.insertAdjacentHTML('beforeend','<span class="xp-b">💬 '+r.data.length+' posts · '+k+' karma</span>')})}).catch(function(){})}
window.epXpStats=function(){var S=stats();S.title=title(S.l);S.earned=badges(S).filter(function(b){return b[2]}).map(function(b){return[b[0],b[1]]});var A=at(),att=0,cor=0;A.forEach(function(a){att+=a.attempted||0;cor+=a.correct||0});S.acc=att?Math.round(cor*100/att):0;return S};
(window.__epProfileExtras=window.__epProfileExtras||{}).xp=function(){setTimeout(more,400);return card()};
var sq=window.submitTestQuiz;if(typeof sq==='function'&&!sq.__xp){var w2=function(){var b=stats();var r=sq.apply(this,arguments);setTimeout(function(){var a=stats(),g=a.xp-b.xp;if(g>0)toast('+'+g+' XP'+(a.l>b.l?' · Level up! You are now Level '+a.l+' '+title(a.l):''),'success')},600);return r};w2.__xp=1;window.submitTestQuiz=w2}
})();

;

(function(){
var SU=['All','General','Biology','Physics','Chemistry'];
var SJ={General:['#0ea5e9','fa-comments'],Biology:['#059669','fa-dna'],Physics:['#2563eb','fa-atom'],Chemistry:['#d97706','fa-flask'],All:['#ff4500','fa-fire']};
var T={rows:[],mine:{},sort:'hot',sub:'All',open:null,cm:[],err:'',q:'',f:'all',limit:60,loading:true,reply:null,fold:{},csort:'old',view:'list',y:0,ns:'General',cp:{c:[],rc:[]}};
function $(x){return document.querySelector(x)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function api(){return window.__epCommunityApi}
function cl(){var a=api();if(!a||!a.ready)return Promise.reject(new Error('Account service is not ready. Log in and reload.'));return a.ready().then(function(x){return x.client})}
function me(){var u=api()&&api().session&&api().session()&&api().session().user;return u||{}}
function nm(){var u=me(),m=u.user_metadata||{};return m.full_name||m.name||(u.email||'Student').split('@')[0]}
function tt(m,k){if(typeof window.toast==='function')window.toast(m,k)}
function ago(t){var m=(Date.now()-Date.parse(t))/6e4;return m<1?'just now':m<60?(m|0)+'m ago':m<1440?(m/60|0)+'h ago':m<43200?(m/1440|0)+'d ago':m<525600?(m/43200|0)+'mo ago':(m/525600|0)+'y ago'}
function hot(r){return r.score/Math.pow((Date.now()-Date.parse(r.created_at))/36e5+2,1.5)}
function num(n){n=n||0;var a=Math.abs(n);return a>=1000?(n/1000).toFixed(a>=10000?0:1).replace(/\.0$/,'')+'k':String(n)}
function hue(s){var h=0;s=String(s||'S');for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))%360;return h}
function av(n,small){n=n||'Student';return '<span class="rt-av'+(small?' s':'')+'" style="background:hsl('+hue(n)+' 52% 46%)" aria-hidden="true">'+esc(n.trim().charAt(0).toUpperCase()||'S')+'</span>'}
function sv(){try{return JSON.parse(localStorage.getItem('ep_th_saved')||'[]')}catch(e){return[]}}

var IMG=/!\[img\]\((https?:\/\/[^\s)]+)\)/g;
function imgs(b){var o=[],m;IMG.lastIndex=0;while((m=IMG.exec(b||'')))o.push(m[1]);return o}
function thumb(b){var a=imgs(b);return a.length?'<div class="rt-th"><img class="rt-img" src="'+esc(a[0])+'" loading="lazy" alt="Post image">'+(a.length>1?'<span>+'+(a.length-1)+'</span>':'')+'</div>':''}
function shrink(f){return new Promise(function(ok,no){var u=URL.createObjectURL(f),i=new Image();i.onload=function(){var s=Math.min(1,1280/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=Math.round(i.width*s);c.height=Math.round(i.height*s);var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(i,0,0,c.width,c.height);URL.revokeObjectURL(u);c.toBlob(function(b){b?ok(b):no(new Error('Could not read that image.'))},'image/jpeg',.82)};i.onerror=function(){no(new Error('That file is not a supported image.'))};i.src=u})}
function upl(a){if(!a.length)return Promise.resolve('');return cl().then(function(c){var uid=me().id||'anon',out=[];return a.reduce(function(p,f,i){return p.then(function(){return shrink(f)}).then(function(b){var path=uid+'/'+Date.now()+'-'+i+'.jpg';return c.storage.from('thread-images').upload(path,b,{contentType:'image/jpeg'}).then(function(r){if(r.error)throw r.error;out.push('![img]('+c.storage.from('thread-images').getPublicUrl(path).data.publicUrl+')')})})},Promise.resolve()).then(function(){return out.join('\n')})}).catch(function(e){var m=(e&&e.message)||'';throw new Error(/not found/i.test(m)?'Image storage is not set up yet. Run threads-images.sql in Supabase.':/row-level|policy|permission/i.test(m)?'Not allowed to upload images. Log in and run threads-images.sql.':m)})}
function attach(btn,box,arr){if(!btn||!box)return;var inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.multiple=true;inp.hidden=true;btn.after(inp);
function paint(){box.innerHTML=arr.map(function(f,i){return '<span><img src="'+URL.createObjectURL(f)+'" alt="Selected image"><button type="button" data-x="'+i+'" aria-label="Remove image">×</button></span>'}).join('');box.querySelectorAll('[data-x]').forEach(function(b){b.onclick=function(){arr.splice(+b.dataset.x,1);paint()}})}
btn.onclick=function(){inp.click()};inp.onchange=function(){Array.prototype.forEach.call(inp.files,function(f){if(arr.length<4&&/^image\//.test(f.type))arr.push(f)});inp.value='';paint()};paint()}
function fmt(t){var im=[];t=String(t==null?'':t).replace(IMG,function(_,u){im.push(u);return '\u0001'+(im.length-1)+'\u0001'});return esc(t).replace(/`([^`\n]+)`/g,'<code>$1</code>').replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>').replace(/\n/g,'<br>').replace(/\u0001(\d+)\u0001/g,function(_,k){return '<img class="rt-img" src="'+esc(im[k])+'" loading="lazy" alt="Attached image" onclick="window.openImageZoom&&openImageZoom(this.src)">'})}
function plain(t){return String(t||'').replace(IMG,'').replace(/`([^`\n]+)`/g,'$1').replace(/\*\*(.+?)\*\*/g,'$1')}
function err(e){var m=(e&&e.message)||String(e);return /permission denied|does not exist|schema cache/i.test(m)?'Threads is not set up yet. Run threads.sql in the Supabase SQL editor.':m}
function sj(s){return SJ[s]||SJ.General}
function load(){return cl().then(function(c){return c.from('threads').select('*').order('created_at',{ascending:false}).limit(T.limit).then(function(r){if(r.error)throw r.error;T.rows=r.data||[];T.err='';var ids=T.rows.map(function(x){return x.id});if(!ids.length)return;return c.from('thread_votes').select('thread_id,v').in('thread_id',ids).then(function(v){T.mine={};(v.data||[]).forEach(function(x){T.mine[x.thread_id]=x.v})})})}).catch(function(e){T.err=err(e)}).then(function(){T.loading=false})}
function sorted(){var q=T.q.toLowerCase(),S=sv();var rows=T.rows.filter(function(x){return(T.sub==='All'||x.subject===T.sub)&&(T.f!=='unsolved'||!x.solved)&&(T.f!=='saved'||S.indexOf(x.id)>=0)&&(!q||((x.title||'')+' '+(x.body||'')).toLowerCase().indexOf(q)>=0)});return rows.slice().sort(T.sort==='new'?function(a,b){return Date.parse(b.created_at)-Date.parse(a.created_at)}:T.sort==='top'?function(a,b){return b.score-a.score}:function(a,b){return hot(b)-hot(a)})}
function btn(k,a,cur){return a.map(function(x){return '<button type="button" class="'+(cur===x[0]?'on':'')+'" data-'+k+'="'+x[0]+'" aria-pressed="'+(cur===x[0])+'"><i class="fa-solid '+x[2]+'"></i><span>'+x[1]+'</span></button>'}).join('')}
function list(){T.view='list';var r=$('#ep-threads');if(!r)return;var rows=sorted(),me0=nm();
r.innerHTML='<div class="rt-bar"><div class="rt-row"><label class="rt-search"><i class="fa-solid fa-magnifying-glass"></i><input id="th-q" type="search" placeholder="Search posts" value="'+esc(T.q)+'" aria-label="Search posts"></label></div>'
+'<div class="rt-row" style="margin-top:.4rem"><div class="rt-seg" role="group" aria-label="Sort">'+btn('s',[['hot','Hot','fa-fire'],['new','New','fa-clock'],['top','Top','fa-arrow-trend-up']],T.sort)+'</div><div class="rt-flt" role="group" aria-label="Filter">'+btn('f',[['unsolved','Unsolved','fa-circle-question'],['saved','Saved','fa-bookmark']],T.f)+'</div></div>'
+'<div class="rt-rail">'+SU.map(function(x){var j=sj(x);return '<button type="button" class="rt-sc'+(T.sub===x?' on':'')+'" data-u="'+x+'" style="--c:'+j[0]+'"><span class="rt-ic"><i class="fa-solid '+j[1]+'"></i></span>'+(x==='All'?'Home':'r/'+x)+'</button>'}).join('')+'</div></div>'
+'<button type="button" class="rt-compose" id="th-new" aria-label="Create post">'+av(me0)+'<span class="in">Create a post</span><i class="fa-solid fa-plus" style="color:var(--text-muted)"></i></button>'
+(T.err?'<div class="rt-empty"><i class="fa-solid fa-triangle-exclamation"></i>'+esc(T.err)+'</div>':'')
+(T.loading&&!T.rows.length?'<div class="rt-sk"></div><div class="rt-sk"></div><div class="rt-sk"></div>':rows.map(function(x){return card(x)}).join('')||(T.err?'':'<div class="rt-empty"><i class="fa-regular fa-comments"></i><b>'+(T.q||T.f!=='all'||T.sub!=='All'?'No matching posts':'No posts yet')+'</b>'+(T.q||T.f!=='all'||T.sub!=='All'?'Try a different search or filter.':'Be the first to start a discussion.')+'</div>'))
+(T.rows.length>=T.limit?'<button type="button" class="rt-btn rt-more" id="th-more">Load more</button>':'');
r.querySelectorAll('[data-s]').forEach(function(b){b.onclick=function(){T.sort=b.dataset.s;list()}});
r.querySelectorAll('[data-f]').forEach(function(b){b.onclick=function(){T.f=T.f===b.dataset.f?'all':b.dataset.f;list()}});
r.querySelectorAll('[data-u]').forEach(function(b){b.onclick=function(){T.sub=b.dataset.u;list()}});
$('#th-new').onclick=form;
var qi=$('#th-q');qi.oninput=function(){T.q=this.value;var p=this.selectionStart;list();var n=$('#th-q');n.focus();try{n.setSelectionRange(p,p)}catch(e){}};
var m=$('#th-more');if(m)m.onclick=function(){T.limit+=60;load().then(function(){if(T.view==='list')list()})};
wire(r)}
function card(x,full){var v=T.mine[x.id]||0,sd=sv().indexOf(x.id)>=0,j=sj(x.subject),own=me().id&&x.author_id===me().id,a=x.author_name||'Student';
return '<article class="rt-card'+(full?' rt-full':'')+'"'+(full?'':' data-o="'+esc(x.id)+'"')+'><div class="rt-hd"><span class="rt-ic" style="--c:'+j[0]+'"><i class="fa-solid '+j[1]+'"></i></span><b>r/'+esc(x.subject||'General')+'</b><span class="d">•</span><span class="pf-link" role="button" tabindex="0" data-pf="'+esc(x.author_id||'')+'" data-pn="'+esc(a)+'">u/'+esc(a)+'</span><span class="d">•</span><span>'+ago(x.created_at)+'</span>'+(x.solved?'<span class="rt-flair"><i class="fa-solid fa-circle-check"></i> Solved</span>':'')+'</div>'
+'<h3 class="rt-t">'+esc(x.title)+'</h3>'+(full?'':thumb(x.body))
+(x.body?(full?'<div class="rt-body">'+fmt(x.body)+'</div>':'<p class="rt-p">'+esc(plain(x.body))+'</p>'):'')
+'<div class="rt-ft"><span class="rt-vp'+(v>0?' up':v<0?' dn':'')+'"><button type="button" class="vu'+(v>0?' on':'')+'" data-v="1" data-id="'+esc(x.id)+'" aria-label="Upvote" aria-pressed="'+(v>0)+'"><i class="fa-solid fa-arrow-up"></i></button><b>'+num(x.score)+'</b><button type="button" class="vd'+(v<0?' on':'')+'" data-v="-1" data-id="'+esc(x.id)+'" aria-label="Downvote" aria-pressed="'+(v<0)+'"><i class="fa-solid fa-arrow-down"></i></button></span>'
+(full?'<span class="rt-pl"><i class="fa-regular fa-comment"></i>'+num(x.comments)+'</span>':'<button type="button" class="rt-pl" data-o="'+esc(x.id)+'" aria-label="Open comments"><i class="fa-regular fa-comment"></i>'+num(x.comments)+'</button>')
+'<button type="button" class="rt-pl'+(sd?' on':'')+'" data-bm="'+esc(x.id)+'" aria-pressed="'+sd+'"><i class="fa-'+(sd?'solid':'regular')+' fa-bookmark"></i><span>'+(sd?'Saved':'Save')+'</span></button>'
+'<button type="button" class="rt-pl" data-sh="'+esc(x.id)+'"><i class="fa-solid fa-share-nodes"></i><span>Share</span></button>'
+(full&&own?'<button type="button" class="rt-pl ok" id="th-sol"><i class="fa-solid fa-circle-check"></i><span>'+(x.solved?'Unsolve':'Mark solved')+'</span></button><button type="button" class="rt-pl bad" id="th-del"><i class="fa-regular fa-trash-can"></i><span>Delete</span></button>':'')
+'</div></article>'}
function wire(r){
r.querySelectorAll('[data-v]').forEach(function(b){b.onclick=function(e){e.stopPropagation();vote(b.dataset.id,+b.dataset.v)}});
r.querySelectorAll('[data-o]').forEach(function(b){b.onclick=function(e){if(e.target.closest&&e.target.closest('button:not([data-o]),a'))return;openT(b.dataset.o)}});
r.querySelectorAll('[data-bm]').forEach(function(b){b.onclick=function(e){e.stopPropagation();var S=sv(),i=S.indexOf(b.dataset.bm);i<0?S.push(b.dataset.bm):S.splice(i,1);try{localStorage.setItem('ep_th_saved',JSON.stringify(S))}catch(x){}T.view==='detail'?detail():list()}});
r.querySelectorAll('[data-sh]').forEach(function(b){b.onclick=function(e){e.stopPropagation();var x=T.rows.filter(function(z){return z.id===b.dataset.sh})[0];if(!x)return;var t='EduPulse Thread: '+x.title;if(navigator.share)navigator.share({text:t}).catch(function(){});else{try{navigator.clipboard&&navigator.clipboard.writeText(t)}catch(z){}tt('Copied to share','success')}}})}
function redraw(){T.view==='detail'?detail():list()}
function vote(id,v){try{navigator.vibrate&&navigator.vibrate(8)}catch(x){}var cur=T.mine[id]||0,row=T.rows.filter(function(x){return x.id===id})[0];if(!row)return;var nv=cur===v?0:v;row.score+=nv-cur;if(nv)T.mine[id]=nv;else delete T.mine[id];redraw();
cl().then(function(c){return nv?c.from('thread_votes').upsert({thread_id:id,v:nv},{onConflict:'thread_id,user_id'}):c.from('thread_votes').delete().eq('thread_id',id).eq('user_id',me().id)}).then(function(r){if(r&&r.error)throw r.error}).catch(function(e){tt(err(e),'error');load().then(redraw)})}
function form(){T.view='form';var r=$('#ep-threads');if(!r)return;var dr={};try{dr=JSON.parse(localStorage.getItem('ep_th_draft')||'{}')}catch(x){}var ns=SU.indexOf(dr.s)>0?dr.s:(T.sub!=='All'?T.sub:'General');
r.innerHTML='<div class="rt-form"><div class="rt-fh">Create post<button type="button" class="rt-ib" id="th-x" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div><div class="rt-pick" id="th-pick">'+SU.slice(1).map(function(x){var j=sj(x);return '<button type="button" class="rt-sc'+(ns===x?' on':'')+'" data-p="'+x+'" style="--c:'+j[0]+'"><span class="rt-ic"><i class="fa-solid '+j[1]+'"></i></span>r/'+x+'</button>'}).join('')+'</div><div class="rt-fw"><input id="th-t" maxlength="200" placeholder="Title" aria-label="Title"><span id="th-n">0/200</span></div><textarea id="th-b" rows="6" maxlength="5000" placeholder="Body text (optional). Supports **bold**, `code` and links." aria-label="Body"></textarea><div class="rt-att" id="th-att"></div><div class="rt-fa"><span class="er" id="th-e"></span><button type="button" class="rt-btn" id="th-img"><i class="fa-regular fa-image"></i> Image</button><button type="button" class="rt-btn" id="th-x2">Cancel</button><button type="button" class="rt-btn pri" id="th-ok" disabled>Post</button></div></div>';
var t=$('#th-t'),b=$('#th-b'),ok=$('#th-ok');t.value=dr.t||'';b.value=dr.b||'';
var st=function(){$('#th-n').textContent=t.value.length+'/200';ok.disabled=t.value.trim().length<3};
var sav=function(){st();try{localStorage.setItem('ep_th_draft',JSON.stringify({t:t.value,b:b.value,s:ns}))}catch(x){}};st();t.oninput=sav;b.oninput=sav;
r.querySelectorAll('[data-p]').forEach(function(p){p.onclick=function(){ns=p.dataset.p;r.querySelectorAll('[data-p]').forEach(function(q){q.classList.toggle('on',q===p)});sav()}});
var back=function(){list()};$('#th-x').onclick=back;$('#th-x2').onclick=back;t.focus();
var pics=[];attach($('#th-img'),$('#th-att'),pics);var go=function(){var ti=t.value.trim();if(ti.length<3||ok.disabled)return;ok.disabled=true;ok.textContent='Posting…';upl(pics).then(function(mk){return cl().then(function(c){return c.from('threads').insert({title:ti,body:(b.value.trim()+(mk?'\n'+mk:'')).trim()||null,subject:ns,author_name:nm()})})}).then(function(r){if(r.error)throw r.error;try{localStorage.removeItem('ep_th_draft')}catch(x){}T.sort='new';T.sub='All';return load()}).then(function(){list();try{window.scrollTo(0,0)}catch(e){}}).catch(function(e){$('#th-e').textContent=err(e);ok.disabled=false;ok.textContent='Post'})};
ok.onclick=go;r.onkeydown=function(e){if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();go()}}}
function openT(id){T.y=window.pageYOffset||0;T.open=id;T.cm=[];T.reply=null;T.cp.c.length=0;T.cp.rc.length=0;T.fold={};T.view='detail';detail();try{window.scrollTo(0,0)}catch(e){}
cl().then(function(c){return c.from('thread_comments').select('*').eq('thread_id',id).order('created_at')}).then(function(r){if(T.open!==id)return;T.cm=(r&&r.data)||[];if(T.view==='detail')detail()}).catch(function(e){tt(err(e),'error')})}
function kids(id){return T.cm.filter(function(c){return c.parent_id===id}).sort(function(a,b){return T.csort==='new'?Date.parse(b.created_at)-Date.parse(a.created_at):Date.parse(a.created_at)-Date.parse(b.created_at)})}
function cnt(id){var n=0;kids(id).forEach(function(c){n+=1+cnt(c.id)});return n}
function rbox(){return '<div class="rt-cbox rt-rb"><textarea id="th-rc" rows="2" maxlength="2000" placeholder="Write a reply" aria-label="Reply"></textarea><div class="rt-att" id="th-ratt"></div><div class="rt-ca2"><button type="button" class="rt-btn" id="th-ri" aria-label="Add image"><i class="fa-regular fa-image"></i></button><button type="button" class="rt-btn" data-r="">Cancel</button><button type="button" class="rt-btn pri" id="th-rs">Reply</button></div></div>'}
function node(c,d,x){var n=c.author_name||'Student',op=x.author_id&&c.author_id===x.author_id,k=kids(c.id),fold=T.fold[c.id];
var head='<div class="rt-cm">'+(fold?'<button type="button" class="rt-ex" data-fold="'+esc(c.id)+'" aria-label="Expand comment"><i class="fa-solid fa-plus"></i></button>':'')+'<b class="pf-link" role="button" tabindex="0" data-pf="'+esc(c.author_id||'')+'" data-pn="'+esc(n)+'">'+esc(n)+'</b>'+(op?'<span class="rt-op">OP</span>':'')+'<span>•</span><span>'+ago(c.created_at)+'</span>'+(fold&&k.length?'<span>• '+cnt(c.id)+' hidden</span>':'')+'</div>';
var body=fold?'':'<div class="rt-ctx">'+fmt(c.body)+'</div><div class="rt-cac"><button type="button" data-r="'+esc(c.id)+'"><i class="fa-regular fa-comment"></i> Reply</button></div>'+(T.reply===c.id?rbox():'');
var inner=fold?'':(d<4?k.map(function(z){return node(z,d+1,x)}).join(''):'');
var flat=(!fold&&d>=4)?k.map(function(z){return node(z,d+1,x)}).join(''):'';
return '<div class="rt-c"><div class="rt-cl">'+av(n,true)+(fold?'':'<button type="button" class="rt-line" data-fold="'+esc(c.id)+'" aria-label="Collapse thread"></button>')+'</div><div class="rt-cb">'+head+body+inner+'</div></div>'+flat}
function detail(){var r=$('#ep-threads'),x=T.rows.filter(function(z){return z.id===T.open})[0];if(!r||!x)return;T.view='detail';
var keep={c:($('#th-c')||{}).value,rc:($('#th-rc')||{}).value},foc=document.activeElement&&document.activeElement.id;
var top=T.cm.filter(function(c){return !c.parent_id}).sort(function(a,b){return T.csort==='new'?Date.parse(b.created_at)-Date.parse(a.created_at):Date.parse(a.created_at)-Date.parse(b.created_at)});
var total=T.cm.length;
r.innerHTML='<button type="button" class="rt-back" id="th-b0"><i class="fa-solid fa-arrow-left"></i> Back</button>'+card(x,true)
+'<div class="rt-cbox"><textarea id="th-c" rows="2" maxlength="2000" placeholder="Add a comment" aria-label="Add a comment"></textarea><div class="rt-att" id="th-catt"></div><div class="rt-ca2"><small>Commenting as '+esc(nm())+'</small><button type="button" class="rt-btn" id="th-ci" aria-label="Add image"><i class="fa-regular fa-image"></i></button><button type="button" class="rt-btn pri" id="th-cs1">Comment</button></div></div>'
+'<div class="rt-ch"><span>'+num(Math.max(total,x.comments||0))+' comment'+(Math.max(total,x.comments||0)===1?'':'s')+'</span><select id="th-cso" aria-label="Sort comments"><option value="old"'+(T.csort==='old'?' selected':'')+'>Oldest first</option><option value="new"'+(T.csort==='new'?' selected':'')+'>Newest first</option></select></div>'
+'<div id="th-cs">'+(top.map(function(c){return node(c,0,x)}).join('')||'<div class="rt-empty"><i class="fa-regular fa-comment-dots"></i><b>No comments yet</b>Be the first to share your thoughts.</div>')+'</div>';
wire(r);attach($('#th-ci'),$('#th-catt'),T.cp.c);attach($('#th-ri'),$('#th-ratt'),T.cp.rc);
if(keep.c)$('#th-c').value=keep.c;var rc=$('#th-rc');if(rc){if(keep.rc)rc.value=keep.rc}
if(foc==='th-c'||foc==='th-rc'){var fe=$('#'+foc);if(fe){fe.focus();try{fe.setSelectionRange(fe.value.length,fe.value.length)}catch(e){}}}
r.querySelectorAll('[data-r]').forEach(function(b){b.onclick=function(){T.reply=b.dataset.r||null;T.cp.rc.length=0;detail();var f=$('#th-rc');if(f)f.focus()}});
r.querySelectorAll('[data-fold]').forEach(function(b){b.onclick=function(){var k=b.dataset.fold;T.fold[k]=!T.fold[k];detail()}});
$('#th-b0').onclick=function(){T.open=null;T.reply=null;list();try{window.scrollTo(0,T.y||0)}catch(e){}};
$('#th-cso').onchange=function(){T.csort=this.value;detail()};
var send=function(el,pid,btn){var arr=pid?T.cp.rc:T.cp.c,t=el.value.trim();if(!t&&!arr.length)return;btn.disabled=true;
upl(arr).then(function(mk){var o={thread_id:x.id,body:(t+(mk?'\n'+mk:'')).trim(),author_name:nm()};if(pid)o.parent_id=pid;return cl().then(function(c){return c.from('thread_comments').insert(o).select().single()})}).then(function(r){if(r.error)throw r.error;arr.length=0;T.cm.push(r.data);x.comments=(x.comments||0)+1;T.reply=null;detail()}).catch(function(e){tt(err(e),'error');btn.disabled=false})};
$('#th-cs1').onclick=function(){send($('#th-c'),null,this)};
var rs=$('#th-rs');if(rs)rs.onclick=function(){send($('#th-rc'),T.reply,this)};
r.querySelectorAll('textarea').forEach(function(t){t.onkeydown=function(e){if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();(t.id==='th-rc'?rs:$('#th-cs1')).click()}}});
var sl=$('#th-sol');if(sl)sl.onclick=function(){x.solved=!x.solved;detail();cl().then(function(c){return c.from('threads').update({solved:x.solved}).eq('id',x.id)}).then(function(r){if(r&&r.error)throw r.error}).catch(function(e){x.solved=!x.solved;tt(err(e),'error');detail()})};
var d=$('#th-del');if(d)d.onclick=function(){epAsk.confirm('This cannot be undone.',{title:'Delete this post?',ok:'Delete',danger:true}).then(function(ok){if(!ok)return;return cl().then(function(c){return c.from('threads').delete().eq('id',x.id)}).then(function(){T.open=null;return load()}).then(function(){list();try{window.scrollTo(0,T.y||0)}catch(e){}})})}}
window.epThreadsRender=function(){T.open=null;T.reply=null;T.loading=!T.rows.length;list();load().then(function(){if(T.view==='list')list()})};
})();

;

(function(){['epLiveRender','epThreadsRender','epFocusRender'].forEach(function(n){var f=window[n];if(typeof f==='function')window[n]=function(){try{window.scrollTo(0,0)}catch(e){}return f.apply(this,arguments)}});
function poll(){var a=window.__epCommunityApi;if(!a||!a.ready)return;a.ready().then(function(x){return x.client.from('live_sessions').select('id').eq('status','live').gte('started_at',new Date(Date.now()-6*3600e3).toISOString())}).then(function(r){if(!r||r.error)return;var n=(r.data||[]).length;window.__lvN=n;var row=document.querySelector('.tg-pin [data-v="live"]');if(!row)return;var sm=row.querySelector('small');if(sm)sm.textContent=n?n+' live now':'Join or host a live class';var en=row.querySelector('.end');if(en)en.innerHTML=n?'<span class="cm-badge" style="background:#ef4444">LIVE '+n+'</span>':'<i class="fa-solid fa-thumbtack"></i>'}).catch(function(){})}
setInterval(poll,30000);setTimeout(poll,2500);var t;new MutationObserver(function(){clearTimeout(t);t=setTimeout(function(){var r=document.querySelector('.tg-pin [data-v="live"]');if(r&&!r.__p){r.__p=1;poll()}},200)}).observe(document.body,{childList:true,subtree:true});})();

;

(function(){
var W=1280,H=720,B=null,P='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf';
function $(s){return document.querySelector(s)}
function mk(w,h){var c=document.createElement('canvas');c.width=w;c.height=h;return c}
function lib(){return new Promise(function(ok,no){if(window.pdfjsLib)return ok();var s=document.createElement('script');s.src=P+'.min.js';s.onload=ok;s.onerror=function(){no(new Error('Could not load the PDF viewer. Check your connection.'))};document.head.appendChild(s)}).then(function(){if(pdfjsLib.GlobalWorkerOptions.workerSrc)return;return fetch(P+'.worker.min.js').then(function(r){return r.blob()}).then(function(b){pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(b)}).catch(function(){pdfjsLib.GlobalWorkerOptions.workerSrc=P+'.worker.min.js'})})}
function rd(c,o){c.save();c.lineCap=c.lineJoin='round';c.strokeStyle=c.fillStyle=o.c;c.lineWidth=o.w;
if(o.t==='er')c.globalCompositeOperation='destination-out',c.lineWidth=o.w*5;
if(o.t==='hl')c.globalAlpha=.35,c.lineWidth=o.w*4,c.lineCap='butt';
if(o.p){var q=o.p;c.beginPath();c.moveTo(q[0][0],q[0][1]);if(q.length===1)c.lineTo(q[0][0]+.1,q[0][1]);for(var i=1;i<q.length;i++)c.quadraticCurveTo(q[i-1][0],q[i-1][1],(q[i-1][0]+q[i][0])/2,(q[i-1][1]+q[i][1])/2);c.lineTo(q[q.length-1][0],q[q.length-1][1]);c.stroke()}
else if(o.t==='tx'){c.font='600 '+(o.w*5+14)+'px system-ui,sans-serif';c.textBaseline='top';o.s.split('\n').forEach(function(l,i){c.fillText(l,o.a[0],o.a[1]+i*(o.w*6+16))})}
else{var a=o.a,b=o.b;c.beginPath();if(o.t==='ln'){c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1])}else if(o.t==='rc')c.rect(a[0],a[1],b[0]-a[0],b[1]-a[1]);else c.ellipse((a[0]+b[0])/2,(a[1]+b[1])/2,Math.abs(b[0]-a[0])/2,Math.abs(b[1]-a[1])/2,0,0,7);c.stroke()}
c.restore()}
function draw(){if(!B)return;var p=B.pg[B.i],x=B.cx;x.fillStyle='#fff';x.fillRect(0,0,W,H);if(p.bg)x.drawImage(p.bg,0,0);B.ix.clearRect(0,0,W,H);p.ops.forEach(function(o){rd(B.ix,o)});if(B.cur)rd(B.ix,B.cur);x.drawImage(B.ic,0,0);B.f=!B.f;x.fillStyle=B.f?'rgba(0,0,0,.02)':'rgba(255,255,255,.02)';x.fillRect(0,0,2,2)}
function page(i){B.i=i;var p=B.pg[i];if(!p.n||p.bg){ui();draw();return Promise.resolve()}
return B.pdf.getPage(p.n).then(function(pg){var v=pg.getViewport({scale:1}),s=Math.min(W/v.width,H/v.height),vp=pg.getViewport({scale:s}),c=mk(W,H),x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,H);return pg.render({canvasContext:x,viewport:vp,transform:[1,0,0,1,(W-vp.width)/2,(H-vp.height)/2]}).promise.then(function(){p.bg=c})}).then(function(){ui();draw()})}
function pt(e){var r=B.cv.getBoundingClientRect();return[(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height]}
function wire(cv){cv.onpointerdown=function(e){if(!B||e.button>0)return;e.preventDefault();var a=pt(e),t=B.tool,p=B.pg[B.i];
if(t==='tx'){epAsk.prompt('',{title:'Add text',placeholder:'Type here',ok:'Add'}).then(function(s){if(s&&s.trim()&&B&&B.pg[B.i]===p){p.ops.push({t:'tx',c:B.col,w:B.sz,a:a,s:s});p.re=[];draw()}});return}
cv.setPointerCapture(e.pointerId);B.cur=(t==='pen'||t==='hl'||t==='er')?{t:t,c:B.col,w:B.sz,p:[a]}:{t:t,c:B.col,w:B.sz,a:a,b:a};draw()};
cv.onpointermove=function(e){if(!B||!B.cur)return;var a=pt(e);if(B.cur.p)B.cur.p.push(a);else B.cur.b=a;draw()};
cv.onpointerup=cv.onpointercancel=function(){if(!B||!B.cur)return;var p=B.pg[B.i];p.ops.push(B.cur);p.re=[];B.cur=null;draw()}}
var TL=[['pen','pencil','Pen'],['hl','highlighter','Highlighter'],['er','eraser','Eraser'],['ln','minus','Line'],['rc','square','Rectangle'],['el','circle','Circle'],['tx','font','Text']],CL=['#111827','#dc2626','#2563eb','#16a34a','#f59e0b','#7c3aed'];
function barHtml(){return TL.map(function(t){return '<button type="button" data-t="'+t[0]+'" title="'+t[2]+'" aria-label="'+t[2]+'"><i class="fa-solid fa-'+t[1]+'"></i></button>'}).join('')+CL.map(function(c){return '<button type="button" class="bd-c" data-c="'+c+'" style="background:'+c+'" aria-label="Colour '+c+'"></button>'}).join('')
+'<select id="bd-sz" aria-label="Size"><option value="2">Thin</option><option value="4" selected>Medium</option><option value="8">Thick</option></select><button type="button" data-a="undo" title="Undo" aria-label="Undo"><i class="fa-solid fa-rotate-left"></i></button><button type="button" data-a="redo" title="Redo" aria-label="Redo"><i class="fa-solid fa-rotate-right"></i></button><button type="button" data-a="clear" title="Clear page" aria-label="Clear page"><i class="fa-regular fa-trash-can"></i></button>'
+'<button type="button" data-a="prev" title="Previous page" aria-label="Previous page"><i class="fa-solid fa-chevron-left"></i></button><b id="bd-pg"></b><button type="button" data-a="next" title="Next page" aria-label="Next page"><i class="fa-solid fa-chevron-right"></i></button><button type="button" data-a="add" title="New blank page" aria-label="New blank page"><i class="fa-solid fa-plus"></i></button>'}
function ui(){if(!B||!B.bar)return;B.bar.querySelectorAll('[data-t]').forEach(function(b){b.classList.toggle('on',b.dataset.t===B.tool)});B.bar.querySelectorAll('[data-c]').forEach(function(b){b.classList.toggle('on',b.dataset.c===B.col)});var l=B.bar.querySelector('#bd-pg');if(l)l.textContent=(B.i+1)+' / '+B.pg.length}
var ACT={undo:function(p){if(p.ops.length)p.re.push(p.ops.pop())},redo:function(p){if(p.re.length)p.ops.push(p.re.pop())},clear:function(p){if(!p.ops.length)return;return epAsk.confirm('This removes everything drawn on this page.',{title:'Clear drawing?',ok:'Clear',danger:true}).then(function(ok){if(ok){p.ops=[];draw()}})},
prev:function(){if(B.i>0)return page(B.i-1)},next:function(){if(B.i<B.pg.length-1)return page(B.i+1)},add:function(){B.pg.splice(B.i+1,0,{ops:[],re:[]});return page(B.i+1)}};
var api={on:false,
open:function(f){if(f&&/\.pptx?$/i.test(f.name))return Promise.reject(new Error('PowerPoint files cannot be opened in the browser. In PowerPoint use File → Export → PDF, pick that PDF here, or use Share screen.'));
var cv=mk(W,H);B={cv:cv,cx:cv.getContext('2d'),ic:mk(W,H),pg:[{ops:[],re:[]}],i:0,tool:'pen',col:CL[0],sz:4,cur:null};B.ix=B.ic.getContext('2d');
var pr=f?lib().then(function(){return f.arrayBuffer()}).then(function(b){return pdfjsLib.getDocument({data:b}).promise}).then(function(d){B.pdf=d;B.pg=[];for(var n=1;n<=Math.min(d.numPages,100);n++)B.pg.push({n:n,ops:[],re:[]})}):Promise.resolve();
return pr.then(function(){return page(0)}).then(function(){var s=cv.captureStream(15);B.tick=setInterval(draw,400);return navigator.mediaDevices.getUserMedia({audio:true}).then(function(a){a.getAudioTracks().forEach(function(t){s.addTrack(t)});return s},function(){return s})}).then(function(s){api.on=true;return s}).catch(function(e){api.close();throw e})},
mount:function(stage,video){if(!B||!stage)return;video.style.display='none';B.cv.className='bd-cv';stage.appendChild(B.cv);wire(B.cv);var bar=document.createElement('div');bar.className='bd-bar';bar.innerHTML=barHtml();stage.parentNode.insertBefore(bar,stage);B.bar=bar;
bar.onclick=function(e){var b=e.target.closest('button');if(!b||!B)return;if(b.dataset.t)B.tool=b.dataset.t;if(b.dataset.c)B.col=b.dataset.c;if(b.dataset.a){var f=ACT[b.dataset.a],r=f(B.pg[B.i]);if(r&&r.then){r.catch(function(){})}}ui();draw()};
bar.querySelector('#bd-sz').onchange=function(){B.sz=+this.value};ui();draw()},
close:function(){if(!B)return;clearInterval(B.tick);if(B.bar)B.bar.remove();B=null;api.on=false}};
window.epBoard=api;
/* ---- 1-hour local copy of the class ---- */
var R={mr:null,ch:[],rec:null,t:null,pend:0},TTL=3600e3;
function idb(fn){return new Promise(function(ok,no){try{var q=indexedDB.open('ep_rec',1);q.onupgradeneeded=function(){q.result.createObjectStore('r')};q.onerror=function(){no(q.error)};q.onsuccess=function(){var s=q.result.transaction('r','readwrite').objectStore('r'),r=fn(s);r.onsuccess=function(){ok(r.result)};r.onerror=function(){no(r.error)}}}catch(e){no(e)}})}
function mime(){var l=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'];for(var i=0;i<l.length;i++)if(window.MediaRecorder&&MediaRecorder.isTypeSupported(l[i]))return l[i];return''}
function purge(){R.rec=null;clearTimeout(R.t);idb(function(s){return s.delete('last')}).catch(function(){});paint()}
function arm(){clearTimeout(R.t);if(R.rec)R.t=setTimeout(function(){purge();window.toast&&toast('Class copy deleted after 1 hour','info')},Math.max(0,R.rec.exp-Date.now()))}
function fin(){var b=new Blob(R.ch,{type:R.mt||'video/webm'});R.ch=[];R.mr=null;clearTimeout(R.cap);if(b.size<1e4)return;R.rec={topic:R.topic||'Class',exp:Date.now()+TTL,blob:b,mt:R.mt};idb(function(s){return s.put(R.rec,'last')}).catch(function(){});arm();paint();window.toast&&toast('Class copy ready to download for 1 hour','success')}
function paint(el){el=el||$('#lv-rec');if(!el)return;var r=R.rec;if(!r||r.exp<=Date.now()){el.innerHTML='';return}
el.innerHTML='<div class="cm-card" style="padding:.8rem;margin-bottom:.8rem;display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;justify-content:space-between"><div><b><i class="fa-solid fa-download"></i> '+String(r.topic).replace(/</g,'&lt;')+'</b><br><small class="cm-muted">'+(r.blob.size/1048576).toFixed(0)+' MB · saved on this device only · deleted in '+Math.max(1,Math.round((r.exp-Date.now())/6e4))+' min</small></div><div style="display:flex;gap:.4rem"><button class="cm-btn pri" id="rc-dl">Download</button><button class="cm-btn" id="rc-rm">Delete now</button></div></div>';
$('#rc-dl').onclick=function(){var u=URL.createObjectURL(r.blob),a=document.createElement('a');a.href=u;a.download=String(r.topic).replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-')+(/mp4/.test(r.mt||'')?'.mp4':'.webm');document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},6e4)};
$('#rc-rm').onclick=function(){epAsk.confirm('',{title:'Delete this copy now?',ok:'Delete',danger:true}).then(function(ok){if(ok)purge()})}}
window.epRec={paint:paint,
start:function(s,topic,delay){if(!window.MediaRecorder||R.mr||R.pend)return;R.pend=1;setTimeout(function(){R.pend=0;if(R.mr)return;var m=mime();try{R.mr=new MediaRecorder(s,m?{mimeType:m,videoBitsPerSecond:600000}:undefined)}catch(e){R.mr=null;return}
R.ch=[];R.topic=topic;R.mt=R.mr.mimeType||m;R.mr.ondataavailable=function(e){if(e.data&&e.data.size)R.ch.push(e.data)};R.mr.onstop=fin;R.mr.start(5000);R.cap=setTimeout(function(){api2.stop()},90*6e4)},delay||0)},
stop:function(){R.pend=0;if(R.mr&&R.mr.state!=='inactive')try{R.mr.stop()}catch(e){R.mr=null}else R.mr=null}};
var api2=window.epRec;
idb(function(s){return s.get('last')}).then(function(r){if(r&&r.exp>Date.now()){R.rec=r;arm()}else if(r)purge()}).catch(function(){});
setInterval(function(){if(R.rec)paint()},30000);
})();

;

(function(){
var K='ep_focus2',OLD='ep_focus_log',AK='edupulse_aspirant_profile_v1',PAL=['#0ea5e9','#f59e0b','#10b981','#ec4899','#8b5cf6','#ef4444','#14b8a6','#f97316'];
function def(){return{subs:[{id:'p',n:'Physics',c:'#2563eb'},{id:'c',n:'Chemistry',c:'#d97706'},{id:'b',n:'Biology',c:'#059669'}],ss:[],goal:360,dd:null,todo:[],opt:{wake:1,strict:0,snd:'off',vol:.5},sel:'p',run:null,pm:{f:25,b:5,l:15},mode:'sw',view:'t',home:'t',brk:{len:5,log:{}}}}
function load(){var d=def(),raw=null;try{raw=JSON.parse(localStorage.getItem(K)||'null')}catch(e){}if(raw)for(var k in raw)d[k]=raw[k];else{try{var p=window.getAspirantProfile&&getAspirantProfile();if(p&&p.onboarded)d.goal=Math.round(p.dailyHours*60)}catch(e){}}return d}
var D=load(),AC,SN,WL,SD=null,SCR=-1;D.brk=D.brk||{len:5,log:{}};D.brk.log=D.brk.log||{};D.bk=D.bk||[];D.nt=D.nt||{on:0,lang:'mix',ev:3,nx:0};D.tt=D.tt||[];D.ch=D.ch||null;D.brk.len=D.brk.len||5;if(!D.home||D.home==='p')D.home='t';D.view=D.home;
function save(){try{localStorage.setItem(K,JSON.stringify(D))}catch(e){}}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function p2(n){return String(n).padStart(2,'0')}
function iso(t){var d=new Date(t);return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())}
function hm(m){m=Math.max(0,m);return m>=60?Math.floor(m/60)+'h '+p2(Math.round(m%60))+'m':Math.round(m)+'m'}
function clk(s,h){s=Math.max(0,Math.floor(s));var x=p2(Math.floor(s%3600/60))+':'+p2(s%60);return h?p2(Math.floor(s/3600))+':'+x:p2(Math.floor(s/60))+':'+p2(s%60)}
function root(){return document.getElementById('ep-focus')}
function live(){var r=D.run;return r&&r.ph==='f'?(Date.now()-r.t0)/6e4:0}
function days(){var o={};D.ss.forEach(function(s){o[s.d]=(o[s.d]||0)+s.m});if(D.run&&D.run.ph==='f'){var k=iso(D.run.t0);o[k]=(o[k]||0)+live()}return o}
function ago(n){var d=new Date();d.setDate(d.getDate()-n);return iso(d)}
function st(){var o=days(),t=o[iso(Date.now())]||0,wk=0,pw=0,i,tot=0,best=0,k;for(i=0;i<7;i++){wk+=o[ago(i)]||0;pw+=o[ago(i+7)]||0}for(k in o){tot+=o[k];best=Math.max(best,o[k])}
var s=0,j=(o[ago(0)]||0)>=10?0:1;while((o[ago(j)]||0)>=10){s++;j++}return{o:o,today:t,wk:wk,pw:pw,tot:tot,best:best,streak:s}}
var LV=[[0,'Starter','🌱'],[5,'Learner','📖'],[15,'Regular','✏️'],[30,'Dedicated','🔥'],[60,'Scholar','🎓'],[100,'Achiever','🏅'],[160,'Expert','🧠'],[240,'Master','⚡'],[350,'Grandmaster','👑'],[500,'Legend','🌟'],[1000,'Topper','🏆']];
function lvl(min){var h=min/60,i=0;while(i<LV.length-1&&h>=LV[i+1][0])i++;var n=LV[i+1],pct=n?Math.round((h-LV[i][0])*100/(n[0]-LV[i][0])):100;return{n:LV[i][1],e:LV[i][2],i:i+1,next:n?n[0]:0,pct:pct,left:n?Math.max(0,Math.ceil(n[0]-h)):0}}
function badges(){var s=st(),night=D.ss.some(function(x){var h=new Date(x.t).getHours();return h>=23||h<4}),early=D.ss.some(function(x){var h=new Date(x.t).getHours();return h>=4&&h<6}),pm=D.ss.filter(function(x){return x.k==='pm'}).length;
return[['First hour','⏱️',s.tot>=60],['3-day streak','🔥',s.streak>=3],['7-day streak','🌋',s.streak>=7],['30-day streak','💎',s.streak>=30],['4h in a day','💪',s.best>=240],['10h in a day','🦾',s.best>=600],['50 hours','🏅',s.tot>=3000],['100 hours','🏆',s.tot>=6000],['Night owl','🦉',night],['Early bird','🌅',early],['10 Pomodoros','🍅',pm>=10]]}
function heat(w,cls){var o=days(),d=new Date(),n=w*7,h='',i;d.setDate(d.getDate()-n+1+(6-d.getDay()));for(i=0;i<n;i++){var k=iso(d),m=o[k]||0,f=d>new Date();h+='<i class="'+(f?'':m>=180?'h4':m>=90?'h3':m>=30?'h2':m>0?'h1':'')+'" title="'+k+': '+hm(m)+'"'+(f?' style="visibility:hidden"':'')+'></i>';d.setDate(d.getDate()+1)}return'<div class="'+cls+'">'+h+'</div>'}
function sub(id){return D.subs.filter(function(s){return s.id===id})[0]||{n:'General',c:'#64748b'}}
function p10(td){var cov={},lo=24,hi=0,now=new Date(),isT=td===iso(Date.now());
var list=D.ss.filter(function(q){return q.d===td}).map(function(q){return{t:q.t,m:q.m,s:q.s}});
if(D.run&&D.run.ph==='f'&&iso(D.run.t0)===td)list.push({t:D.run.t0,m:live(),s:D.run.sid});
list.forEach(function(q){var ds=new Date(q.t);ds.setHours(0,0,0,0);var so=(q.t-ds.getTime())/6e4,eo=Math.min(1440,so+q.m),b;lo=Math.min(lo,Math.floor(so/60));hi=Math.max(hi,Math.ceil(eo/60));
for(b=Math.floor(so/10);b<Math.ceil(eo/10);b++){var ov=Math.min(eo,(b+1)*10)-Math.max(so,b*10);if(ov<=0)continue;(cov[b]=cov[b]||{})[q.s]=((cov[b]||{})[q.s]||0)+ov}});
var h0=Math.min(6,lo),h1=Math.min(24,Math.max(hi,isT?now.getHours()+1:12,h0+10)),h,c,o='';
for(h=h0;h<h1;h++){o+='<div class="r"><span>'+p2(h)+'</span><div>';for(c=0;c<6;c++){var bk=h*6+c,v=cov[bk],bs=null,bm=0,k;if(v)for(k in v)if(v[k]>bm){bm=v[k];bs=k}
o+=bs?'<i style="background:'+sub(bs).c+';opacity:'+(.35+.65*Math.min(1,bm/10)).toFixed(2)+'" title="'+p2(h)+':'+p2(c*10)+' · '+esc(sub(bs).n)+' '+Math.round(bm)+'m"></i>':'<i class="e'+(isT&&bk===now.getHours()*6+Math.floor(now.getMinutes()/10)?' now':'')+'"></i>'}o+='</div></div>'}
return'<div class="ypt-p10" aria-label="10-minute study planner">'+o+'</div>'}
/* ----- old-log compatibility, recording ----- */
function oldAdd(m){try{var l=JSON.parse(localStorage.getItem(OLD)||'{}'),k=new Date().toDateString();l[k]=(l[k]||0)+m;localStorage.setItem(OLD,JSON.stringify(l))}catch(e){}}
function rec(end){var r=D.run,m=Math.min(960,(end-r.t0)/6e4);if(m>=1){D.ss.push({d:iso(r.t0),s:r.sid,m:+m.toFixed(1),t:r.t0,k:r.mode,x:r.dist||0,b:D.bsel||''});if(D.ss.length>900)D.ss=D.ss.slice(-900);oldAdd(Math.round(m))}}
/* ----- sound, wake, chime ----- */
function noise(t){AC=AC||new(window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();var b=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate),d=b.getChannelData(0),l=0,i,w;for(i=0;i<d.length;i++){w=Math.random()*2-1;if(t==='brown'){l=(l+.02*w)/1.02;d[i]=l*3.5}else d[i]=w*.5}
var s=AC.createBufferSource(),g=AC.createGain(),f=AC.createBiquadFilter();s.buffer=b;s.loop=true;g.gain.value=D.opt.vol;f.type=t==='rain'?'bandpass':t==='fan'?'lowpass':'allpass';f.frequency.value=t==='rain'?1800:500;f.Q.value=.5;s.connect(f);f.connect(g);g.connect(AC.destination);s.start();return{s:s,g:g}}
function stopSnd(){try{SN&&SN.s.stop()}catch(e){}SN=null}
function snd(){stopSnd();if(D.run&&D.opt.snd!=='off'){try{SN=noise(D.opt.snd)}catch(e){}}}
function wake(){try{if(D.run&&D.opt.wake&&navigator.wakeLock&&document.visibilityState==='visible'&&!WL)navigator.wakeLock.request('screen').then(function(l){WL=l;l.onrelease=function(){WL=null}}).catch(function(){})}catch(e){}}
function unwake(){try{WL&&WL.release()}catch(e){}WL=null}
function chime(m){try{navigator.vibrate&&navigator.vibrate([250,120,250])}catch(e){}try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();var o=AC.createOscillator(),g=AC.createGain();o.frequency.value=880;g.gain.value=.15;o.connect(g);g.connect(AC.destination);o.start();o.stop(AC.currentTime+.35)}catch(e){}window.toast&&toast(m,'success');try{if(window.Notification&&Notification.permission==='granted'&&document.hidden)new Notification('EduPulse Focus',{body:m})}catch(e){}}
/* ----- timer control ----- */
function start(){if(D.run)return;setTimeout(function(){window.epPub&&epPub.soon();ping()},350);if(!sub(D.sel).id&&D.subs[0])D.sel=D.subs[0].id;var n=Date.now();D.run={sid:D.sel,t0:n,mode:D.mode,ph:'f',end:D.mode==='pm'?n+D.pm.f*6e4:0,cyc:1,dist:0};save();wake();snd();try{if(window.Notification&&Notification.permission==='default')Notification.requestPermission()}catch(e){}draw()}
function stop(){if(D.run){if(D.run.ph==='p')addBreak((Date.now()-D.run.p0)/6e4);if(D.run.ph==='f')rec(Date.now());var m=(D.run.ph==='f'?(Date.now()-D.run.t0)/6e4:0)+(D.run.mode==='sw'?(D.run.acc||0):0);D.run=null;D.full=0;save();unwake();stopSnd();if(m>=1&&window.toast)toast('Saved '+hm(m)+' of focus · +'+Math.floor(m/2)+' XP','success');window.epPub&&epPub.soon();try{document.fullscreenElement&&document.exitFullscreen()}catch(e){}}draw()}
function tick(){var r=D.run;if(!r)return;var now=Date.now(),g=0;if(r.ph==='p'&&!r.bn&&r.p0&&(now-r.p0)/6e4>=D.brk.len){r.bn=1;save();chime('Break over. Ready to study again?')}
if(r.mode==='pm'){while(D.run&&r.end&&now>=r.end&&g++<20){if(r.ph==='f'){rec(r.end);var lg=r.cyc%4===0,bm=lg?D.pm.l:D.pm.b;r.ph='b';r.t0=r.end;r.end=r.t0+bm*6e4;chime('Focus done. Take a '+bm+' min break.')}else{r.ph='f';r.cyc++;r.t0=r.end;r.end=r.t0+D.pm.f*6e4;chime('Break over. Back to focus!')}save();snd();draw()}}
var pe=document.getElementById('fc-pt');if(pe)pe.textContent=clk(r.ph==='p'?(now-r.p0)/1e3:curSec(r,now),1);var be=document.getElementById('fc-bt');if(be&&r.ph==='p')be.textContent=clk((now-r.p0)/1e3,1);var lb=document.querySelector('#ep-focus .ypt-blk.live');if(lb)lb.style.height=Math.max(6,live()/60*HR)+'px';var t=document.getElementById('fc-t');if(!t)return;t.textContent=clk(curSec(r,now),r.mode!=='pm');var ar=document.getElementById('fc-arc');if(ar)ar.style.strokeDashoffset=C*(1-prog());var td=document.getElementById('fc-td');if(td)td.textContent=clk(st().today*60,1)}
setInterval(tick,1000);
document.addEventListener('visibilitychange',function(){var r=D.run;if(document.hidden){if(r&&D.opt.strict&&r.ph==='f'){r.hid=Date.now();save()}}else{if(r&&r.hid){var a=(Date.now()-r.hid)/1e3;delete r.hid;if(a>5){r.dist=(r.dist||0)+1;window.toast&&toast('You left for '+Math.round(a)+'s. Stay focused!','warning')}save();draw()}wake()}});
window.addEventListener('beforeunload',function(e){if(D.run&&D.run.ph==='f'&&D.opt.strict){e.preventDefault();e.returnValue=''}});
/* ----- views ----- */
function daysTo(d){return Math.ceil((new Date(d+'T00:00:00')-new Date(iso(Date.now())+'T00:00:00'))/864e5)}
function hdr(){var s=st(),pct=Math.min(100,Math.round(s.today*100/D.goal)),dd=D.dd&&D.dd.d?(daysTo(D.dd.d)>=0?'D-'+daysTo(D.dd.d)+' · '+esc(D.dd.n):esc(D.dd.n)+' · passed'):'+ Set D-Day';
return'<div class="fc-tabs" role="tablist">'+[['t','Timer'],['td','To-Do'],['d','Day'],['s','Stats']].map(function(x){return'<button data-a="view" data-v="'+x[0]+'" role="tab" aria-selected="'+(D.view===x[0])+'" class="'+(D.view===x[0]?'on':'')+'">'+x[1]+'</button>'}).join('')+'<button class="fc-menu" data-a="menu" aria-label="More features"><i class="fa-solid fa-grip"></i></button></div>'
+'<div class="ypt-top"><div class="ypt-time"><small>Study time today'+(s.streak?' · 🔥 '+s.streak+' day streak':'')+'</small><b id="fc-td">'+clk(s.today*60,1)+'</b></div><button class="ypt-dd" data-a="dday"><i class="fa-regular fa-calendar-check"></i> '+dd+'</button><div class="ypt-goal"><div class="fc-bar" role="progressbar" aria-valuenow="'+pct+'" aria-valuemin="0" aria-valuemax="100"><i style="width:'+pct+'%"></i></div><span>'+pct+'% of '+hm(D.goal)+' goal</span><button class="fc-dd" data-a="goal">Edit goal</button></div></div>'}
var C=678.58;
function prog(){var r=D.run;if(!r)return 0;var n=Date.now();return r.mode==='pm'?Math.min(1,Math.max(0,1-(r.end-n)/(r.end-r.t0))):((n-r.t0)/1e3%60)/60}
function ring(rem,pm,lab,sc){return'<div class="fc-rw'+(D.run?' live':'')+(pm?' pm':'')+'" style="--sc:'+sc+'"><svg viewBox="0 0 240 240" class="fc-svg" aria-hidden="true"><circle cx="120" cy="120" r="108" class="fc-trk"/><circle cx="120" cy="120" r="108" class="fc-arc" id="fc-arc" style="stroke-dashoffset:'+(C*(1-prog()))+'"/></svg><div class="fc-in"><div class="fc-ring" id="fc-t">'+clk(rem,!pm)+'</div><div class="fc-ph">'+lab+'</div></div></div>'}
function myStats(){var s=st(),L=lvl(s.tot),days7=[],i,mx=1;for(i=6;i>=0;i--){var k=ago(i),d=new Date(k+'T00:00:00');days7.push([['S','M','T','W','T','F','S'][d.getDay()],s.o[k]||0]);mx=Math.max(mx,s.o[k]||0)}
var bars=days7.map(function(x,j){var h=Math.round(x[1]*86/mx);return'<g><rect x="'+(j*40+8)+'" y="'+(96-h)+'" width="26" height="'+Math.max(2,h)+'" rx="6" fill="'+(j===6?'#0d9488':'#94a3b8')+'"/><text x="'+(j*40+21)+'" y="112" text-anchor="middle" font-size="10" fill="currentColor">'+x[0]+'</text><text x="'+(j*40+21)+'" y="'+(90-h)+'" text-anchor="middle" font-size="9" fill="currentColor">'+(x[1]?Math.round(x[1]/6)/10:'')+'</text></g>'}).join('');
var sh={};D.ss.forEach(function(q){if(q.d>=ago(6))sh[q.s]=(sh[q.s]||0)+q.m});var stot=Object.keys(sh).reduce(function(a,k){return a+sh[k]},0)||1;
var dl=s.pw?Math.round((s.wk-s.pw)*100/s.pw):null;
return'<div class="cm-card" style="padding:1rem"><div style="display:flex;align-items:center;gap:.7rem"><span style="font-size:2rem">'+L.e+'</span><div style="flex:1"><b>Level '+L.i+' · '+L.n+'</b><div class="fc-bar" style="margin:.3rem 0"><i style="width:'+L.pct+'%"></i></div><small class="cm-muted">'+(L.left?L.left+' h to the next level':'Max level reached')+'</small></div></div></div>'
+'<div class="fc-grid"><div><small>This week</small><b>'+hm(s.wk)+'</b>'+(dl===null?'':'<small style="color:'+(dl>=0?'#059669':'#e11d48')+'">'+(dl>=0?'+':'')+dl+'% vs last week</small>')+'</div><div><small>Daily average</small><b>'+hm(s.wk/7)+'</b></div><div><small>Streak</small><b>'+s.streak+' day'+(s.streak===1?'':'s')+'</b></div><div><small>Best day</small><b>'+hm(s.best)+'</b></div><div><small>Total</small><b>'+Math.round(s.tot/6)/10+' h</b></div></div>'
+'<div class="cm-card" style="padding:1rem"><b>Last 7 days (hours)</b><svg viewBox="0 0 288 118" style="width:100%;max-height:180px" role="img" aria-label="Study hours over the last 7 days">'+bars+'</svg></div>'
+'<div class="cm-card" style="padding:1rem;margin-top:.7rem"><b>By subject · 7 days</b>'+(Object.keys(sh).map(function(k){return'<div style="margin:.5rem 0"><div style="display:flex;justify-content:space-between;font-size:.82rem"><span><span class="fc-dot" style="background:'+sub(k).c+'"></span>'+esc(sub(k).n)+'</span><b>'+hm(sh[k])+' · '+Math.round(sh[k]*100/stot)+'%</b></div><div class="fc-bar"><i style="width:'+Math.round(sh[k]*100/stot)+'%;background:'+sub(k).c+'"></i></div></div>'}).join('')||'<p class="cm-muted" style="font-size:.85rem">Start a session to see your split.</p>')+'</div>'
+'<div class="cm-card" style="padding:1rem;margin-top:.7rem"><b>Consistency · 16 weeks</b>'+heat(16,'fc-heat')+'</div>'
+'<div class="cm-card" style="padding:1rem;margin-top:.7rem"><b>Badges</b><div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.5rem">'+badges().map(function(b){return'<div class="sp-b'+(b[2]?'':' off')+'"><span>'+b[1]+'</span>'+b[0]+'</div>'}).join('')+'</div></div>'}
function full(){var r=D.run,pm=r.mode==='pm',rem=curSec(r,Date.now());return'<div class="fc-ph" style="color:#94a3b8">'+(r.ph==='b'?'☕ Break':r.ph==='p'?'⏸ On break':esc(sub(r.sid).n))+'</div>'+ring(rem,pm,'',sub(r.sid).c)+'<div class="fc-ph" style="color:#94a3b8">Today '+hm(st().today)+'</div>'+(r.ph==='p'?'<button class="fc-go" data-a="resume" aria-label="Resume studying" style="margin-bottom:.7rem"><i class="fa-solid fa-play"></i> Resume studying</button>':'')+'<button class="fc-go stop" data-a="unfull">Exit clock mode</button>'}
function draw(){var r=root();if(!r)return;var sc=document.getElementById('fc-dayscroll');if(sc)SCR=sc.scrollTop;var v=D.view==='p'?'td':D.view;r.className=D.full&&D.run?'fc-full':'';r.innerHTML=D.full&&D.run?full():hdr()+(v==='s'?stats():v==='td'?todoV():v==='d'?dayV():timer())+pill();sc=document.getElementById('fc-dayscroll');if(sc){if(SCR<0)SCR=Math.max(0,(curD()===iso(Date.now())?new Date().getHours()-2:6)*HR);sc.scrollTop=SCR}}
/* ===== Sprint A ===== */
var HR=56;
function ping(){try{window.dispatchEvent(new CustomEvent('ep:store',{detail:{key:'ep_focus2'}}))}catch(e){}}
function tt(msg,type){try{window.toast&&toast(msg,type)}catch(e){}}
function curSec(r,n){return r.mode==='pm'?(r.end-n)/1e3:((r.acc||0)*60+(r.ph==='f'?(n-r.t0)/1e3:0))}
function curD(){return SD||iso(Date.now())}
function addBreak(m){if(!(m>0))return;var k=iso(Date.now());D.brk.log[k]=+((D.brk.log[k]||0)+m).toFixed(2);var ks=Object.keys(D.brk.log).sort();while(ks.length>60)delete D.brk.log[ks.shift()]}
function pause(){var r=D.run;if(!r||r.mode!=='sw'||r.ph!=='f')return;var n=Date.now();rec(n);r.acc=(r.acc||0)+(n-r.t0)/6e4;r.ph='p';r.p0=n;r.bn=0;save();stopSnd();window.epPub&&epPub.soon();draw()}
function resume(){var r=D.run;if(!r||r.ph!=='p')return;var n=Date.now();addBreak((n-r.p0)/6e4);r.ph='f';r.t0=n;delete r.p0;delete r.bn;save();wake();snd();window.epPub&&epPub.soon();ping();draw()}
function oldAddT(t,m){try{var l=JSON.parse(localStorage.getItem(OLD)||'{}'),k=new Date(t).toDateString();l[k]=Math.max(0,Math.round((l[k]||0)+m));localStorage.setItem(OLD,JSON.stringify(l))}catch(e){}}
function shiftD(d,n){var x=new Date(d+'T00:00:00');x.setDate(x.getDate()+n);return iso(x)}
function dlab(d){return['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(d+'T00:00:00').getDay()]}
function longd(d){var x=new Date(d+'T00:00:00');return dlab(d)+', '+p2(x.getMonth()+1)+'/'+p2(x.getDate())}
function wkOf(d){var x=new Date(d+'T00:00:00'),o=[],i;x.setDate(x.getDate()-(x.getDay()+6)%7);for(i=0;i<7;i++){o.push(iso(x));x.setDate(x.getDate()+1)}return o}
function strip(){var sd=curD(),td=iso(Date.now()),o=days();return'<div class="ypt-week"><button data-a="wk" data-n="-7" aria-label="Previous week"><i class="fa-solid fa-chevron-left"></i></button>'+wkOf(sd).map(function(d){var mm=o[d]||0;return'<button data-a="selday" data-d="'+d+'" class="'+(d===sd?'on':'')+(d===td?' td':'')+'"><small>'+Number(d.slice(8))+'.'+dlab(d)+'</small><span>'+(mm>=1?hm(mm):'–')+'</span></button>'}).join('')+'<button data-a="wk" data-n="7" aria-label="Next week"><i class="fa-solid fa-chevron-right"></i></button></div>'}

/* ----- To-Do tab: tasks grouped by subject, by day ----- */
/* ----- Planner (goals with subject, priority, minutes, due date) lives in the To-Do tab ----- */
function plannerCard(){var L={high:'High',medium:'Normal',low:'Low'},rk={high:0,medium:1,low:2},ls=(typeof todos!=='undefined'&&Array.isArray(todos)?todos:[]).slice().sort(function(a,b){return(a.completed?1:0)-(b.completed?1:0)||(rk[a.priority]!=null?rk[a.priority]:1)-(rk[b.priority]!=null?rk[b.priority]:1)||String(a.dueDate||'9999-12-31').localeCompare(String(b.dueDate||'9999-12-31'))});
var done=ls.filter(function(t){return t.completed}).length,fld='background:transparent;color:inherit;border:1px solid var(--border-color);border-radius:10px;padding:.45rem .6rem;min-width:0';
return'<div class="cm-card" id="fc-planner" style="padding:.9rem;margin-top:.9rem"><div class="ypt-dayh" style="margin:0 0 .4rem"><b>Study planner</b><small class="cm-muted">'+done+' of '+ls.length+' done</small></div>'
+'<small class="cm-muted" style="display:block;margin-bottom:.5rem">Goals with subject, priority, time estimate and due date.</small>'
+'<input type="text" id="new-todo-title" maxlength="100" placeholder="e.g. Solve 30 Optics MCQs" aria-label="Study goal" onkeydown="if(event.key===\'Enter\'&&!event.isComposing&&event.keyCode!==229)addTodoItem()" style="width:100%;'+fld+'">'
+'<div class="fc-row" style="justify-content:flex-start;margin:.5rem 0"><select id="new-todo-subject" aria-label="Task subject" style="flex:1 1 90px;'+fld+'"><option value="Biology">Biology</option><option value="Chemistry">Chemistry</option><option value="Physics">Physics</option></select>'
+'<select id="new-todo-priority" aria-label="Task priority" style="flex:1 1 100px;'+fld+'"><option value="high">High priority</option><option value="medium" selected>Normal priority</option><option value="low">Low priority</option></select>'
+'<input id="new-todo-estimate" type="number" min="5" max="240" step="5" value="30" aria-label="Estimated minutes" style="width:72px;'+fld+'">'
+'<input id="new-todo-due" type="date" aria-label="Due date (optional)" style="flex:1 1 130px;'+fld+'">'
+'<button type="button" class="cm-btn pri" onclick="addTodoItem()">Add</button></div>'
+(ls.length?ls.map(function(t){var due=typeof formatTodoDueDate==='function'?formatTodoDueDate(t.dueDate):'';return'<div class="fc-todo'+(t.completed?' x':'')+'"><input type="checkbox" '+(t.completed?'checked':'')+' onchange="toggleTodoItem(\''+esc(t.id)+'\')" aria-label="Done"><span style="flex:1;min-width:0">'+esc(t.title)+'<small class="cm-muted" style="display:block">'+esc(t.subject||'Biology')+' · '+(L[t.priority]||'Normal')+' · '+(t.estimatedMinutes||30)+' min · '+esc(due)+'</small></span><button class="cm-btn" aria-label="Delete task" onclick="epConfirm(\'Delete this study task?\',\'Delete task\').then(function(ok){if(ok)deleteTodoItem(\''+esc(t.id)+'\')})"><i class="fa-regular fa-trash-can"></i></button></div>'}).join(''):'<p class="cm-muted" style="font-size:.85rem">No planner goals yet. Add one small, specific study goal.</p>')+'</div>'}
function todoV(){var sd=curD(),td=iso(Date.now()),list=D.todo.filter(function(t){return t.d===sd||(sd===td&&!t.x&&t.d<td)}),n=list.filter(function(t){return t.x}).length,groups=D.subs.concat([{id:'g',n:'General',c:'#64748b'}]);
return strip()+'<div class="ypt-dayh"><b>'+longd(sd)+'</b><small class="cm-muted">'+n+' of '+list.length+' done</small></div>'
+groups.map(function(g){var ts=list.filter(function(t){return(t.sid||'g')===g.id});if(g.id==='g'&&!ts.length)return'';
return'<section class="ypt-tg" style="--sc:'+g.c+'"><div class="ypt-tgh"><span class="bar"></span><b>'+esc(g.n)+'</b><button data-a="addtask" data-id="'+g.id+'" aria-label="Add task to '+esc(g.n)+'"><i class="fa-regular fa-square-plus"></i></button></div>'
+ts.map(function(t){return'<div class="fc-todo'+(t.x?' x':'')+'"><input type="checkbox" data-a="tdo" data-id="'+t.id+'" '+(t.x?'checked':'')+' aria-label="Done"><span style="flex:1">'+esc(t.t)+(t.d<td?' <small class="cm-muted">· from '+longd(t.d)+'</small>':'')+'</span><button class="cm-btn" data-a="rmt" data-id="'+t.id+'" aria-label="Delete task"><i class="fa-regular fa-trash-can"></i></button></div>'}).join('')+'</section>'}).join('')+plannerCard()}

/* ----- Day tab: hourly timeline with now-line ----- */
function dayV(){var sd=curD(),td=iso(Date.now()),isT=sd===td,H=HR,list=D.ss.filter(function(q){return q.d===sd}).map(function(q){return{t:q.t,m:q.m,s:q.s,live:0}});
if(D.run&&D.run.ph==='f'&&iso(D.run.t0)===sd)list.push({t:D.run.t0,m:live(),s:D.run.sid,live:1});
var blocks=list.map(function(q){var a=new Date(q.t),so=a.getHours()*60+a.getMinutes()+a.getSeconds()/60,top=so/60*H,ht=Math.max(6,Math.min(q.m/60*H,24*H-top));
return'<button class="ypt-blk'+(q.live?' live':'')+'" style="top:'+top.toFixed(1)+'px;height:'+ht.toFixed(1)+'px;--sc:'+sub(q.s).c+'"'+(q.live?'':' data-a="elog" data-t="'+q.t+'"')+' aria-label="'+esc(sub(q.s).n)+' '+hm(q.m)+'"><b>'+esc(sub(q.s).n)+'</b>'+(ht>34?'<small>'+hm(q.m)+'</small>':'')+'</button>'}).join('');
var hrs='',h;for(h=0;h<24;h++)hrs+='<div class="ypt-hr" style="top:'+h*H+'px"><span>'+(h===0?'12 AM':h<12?h+' AM':h===12?'12 PM':(h-12)+' PM')+'</span></div>';
var d=new Date(),nl=isT?'<div class="ypt-now" id="fc-now" style="top:'+((d.getHours()*60+d.getMinutes())/60*H)+'px"><span>'+p2(d.getHours())+':'+p2(d.getMinutes())+'</span></div>':'';
return strip()+'<div class="ypt-dayh"><b>'+longd(sd)+'</b><button class="fc-dd" data-a="elog" data-t="">+ Add session</button></div>'
+'<div class="ypt-tlw" id="fc-dayscroll"><div class="ypt-tl" style="height:'+24*H+'px">'+hrs+blocks+nl+'</div></div>'
+'<small class="cm-muted" style="display:block;margin:.4rem 0">Tap a session to edit or delete it. Breaks are not counted as study time.</small>'
+'<div class="cm-card" style="padding:.9rem;margin-top:.7rem"><b>10-minute map</b><small class="cm-muted" style="display:block;margin:.1rem 0 .5rem">Each block is 10 minutes. Colour deepens the more you study.</small>'+p10(sd)+'</div>'}

/* ----- Timer tab ----- */
function timer(){var r=D.run,pm=D.mode==='pm',run=!!r,pz=run&&r.ph==='p',td=iso(Date.now()),sc=sub(r?r.sid:D.sel).c,cur=r?curSec(r,Date.now()):(pm?D.pm.f*60:0),bk=D.brk.log[td]||0;
var chips='<div class="fc-row"><button class="cm-chip'+(!pm?' on':'')+'" data-a="mode" data-v="sw"'+(run?' disabled':'')+'><i class="fa-solid fa-stopwatch"></i> Stopwatch</button><button class="cm-chip'+(pm?' on':'')+'" data-a="mode" data-v="pm"'+(run?' disabled':'')+'><i class="fa-solid fa-hourglass-half"></i> Pomodoro</button>'
+(pm&&!run?[[25,5,15],[50,10,20],[90,15,30]].map(function(x){return'<button class="cm-chip'+(D.pm.f===x[0]?' on':'')+'" data-a="pmset" data-f="'+x[0]+'" data-b="'+x[1]+'" data-l="'+x[2]+'">'+x[0]+'/'+x[1]+'</button>'}).join(''):'')+'</div>';
var subs='<div class="ypt-subs">'+D.subs.map(function(x){var m=D.ss.filter(function(q){return q.d===td&&q.s===x.id}).reduce(function(a,q){return a+q.m},0)+(r&&r.sid===x.id?live():0);var on=r&&r.sid===x.id;return'<div class="ypt-sub'+(D.sel===x.id?' on':'')+(on?' live':'')+'" style="--sc:'+x.c+'"><button class="ypt-sub-main" data-a="sub" data-id="'+x.id+'"'+(run?' disabled':'')+'><span class="fc-dot"></span><b>'+esc(x.n)+'</b><small>'+(m?hm(m):'0m')+' today</small></button>'+(run?(on?'<span class="ypt-rec" aria-label="Recording"></span>':''):'<button class="ypt-play" data-a="substart" data-id="'+x.id+'" aria-label="Start '+esc(x.n)+'"><i class="fa-solid fa-play"></i></button>')+'</div>'}).join('')+(run?'':'<button class="ypt-add" data-a="addsub" aria-label="Add subject"><i class="fa-solid fa-plus"></i> Add subject</button>')+'</div>';
var lab=run?(r.ph==='b'?'☕ Break':pz?'⏸ On break · <span id="fc-bt">'+clk((Date.now()-r.p0)/1e3,1)+'</span>':'🎯 '+esc(sub(r.sid).n)+(pm?' · cycle '+r.cyc:'')):esc(sub(D.sel).n);
if(r&&r.dist)lab+=' · '+r.dist+' distraction'+(r.dist>1?'s':'');
var btn=!run?'<button class="ypt-big" data-a="start" aria-label="Start"><i class="fa-solid fa-play"></i></button>':pz?'<button class="ypt-big" data-a="resume" aria-label="Resume studying"><i class="fa-solid fa-play"></i></button>':r.mode==='sw'?'<button class="ypt-big" data-a="pause" aria-label="Pause and take a break"><i class="fa-solid fa-pause"></i></button>':'';
var ctl=run?'<button class="ypt-sq" data-a="stop" aria-label="Stop and save"><i class="fa-solid fa-stop"></i></button><button class="ypt-sq" data-a="full" aria-label="Clock mode"><i class="fa-solid fa-expand"></i></button>':'';
var card='<div class="cm-card fc-hero ypt-cur'+(run&&!pz?' live':'')+'" style="--sc:'+sc+'"><div class="ypt-cur-row"><div class="ypt-cur-l"><small>Current focus time</small><b id="fc-t">'+clk(cur,!pm)+'</b><span class="fc-ph">'+lab+'</span></div><div class="ypt-cur-r">'+btn+ctl+'</div></div>'+chips+subs
+(bk>=1?'<small class="cm-muted" style="display:block;text-align:center;margin-top:.4rem">Breaks today: '+hm(bk)+' · reminder after '+D.brk.len+' min</small>':'')+'</div>';
var opts='<div class="cm-card" style="padding:.9rem;margin-top:.7rem"><div class="fc-row" style="justify-content:flex-start"><button class="cm-chip'+(D.opt.wake?' on':'')+'" data-a="opt" data-k="wake"><i class="fa-solid fa-sun"></i> Keep screen on</button><button class="cm-chip'+(D.opt.strict?' on':'')+'" data-a="opt" data-k="strict"><i class="fa-solid fa-lock"></i> Strict mode</button><select data-a="snd" aria-label="Ambient sound">'+[['off','No sound'],['rain','Rain'],['brown','Brown noise'],['white','White noise'],['fan','Fan']].map(function(x){return'<option value="'+x[0]+'"'+(D.opt.snd===x[0]?' selected':'')+'>'+x[1]+'</option>'}).join('')+'</select><input type="range" min="0" max="1" step=".05" value="'+D.opt.vol+'" data-a="vol" aria-label="Volume" style="width:90px"></div><small class="cm-muted">Strict mode counts every time you leave this tab and asks before closing.</small></div>';
var ts=D.ss.filter(function(q){return q.d===td}).sort(function(x,y){return y.t-x.t});
var sess='<div class="cm-card" style="padding:.9rem;margin-top:.7rem"><div class="ypt-sess-h"><b>Today\'s sessions</b><button class="fc-dd" data-a="elog" data-t="">+ Add</button></div>'
+(ts.length?ts.map(function(q){var a=new Date(q.t);return'<button class="fc-todo ypt-srow" data-a="elog" data-t="'+q.t+'"><span class="fc-dot" style="background:'+sub(q.s).c+'"></span><span style="flex:1;text-align:left">'+esc(sub(q.s).n)+' <small class="cm-muted">'+p2(a.getHours())+':'+p2(a.getMinutes())+(q.k==='pm'?' · Pomodoro':'')+(q.man?' · added':'')+(q.x?' · '+q.x+' distraction'+(q.x>1?'s':''):'')+'</small></span><b>'+hm(q.m)+'</b></button>'}).join(''):'<p class="cm-muted" style="font-size:.85rem;margin-top:.5rem">No sessions yet today. Press play to start.</p>')+'</div>';
gLoad();return card+groupCard()+opts+sess}

/* ----- bottom pill (start / pause / break) ----- */
function pill(){var r=D.run;if(D.full&&r)return'';var p=r&&r.ph==='p';if(!p&&D.view==='t')return'';
if(!r)return'<div class="ypt-pill"><button class="ypt-pb" data-a="start" aria-label="Start"><i class="fa-solid fa-play"></i></button><span class="ypt-pt" id="fc-pt">00:00:00</span><small>'+esc(sub(D.sel).n)+'</small></div>';
if(p)return'<div class="ypt-pillw"><button class="ypt-skip" data-a="resume" aria-label="End break and resume"><i class="fa-solid fa-forward-step"></i></button><div class="ypt-pill brk"><button class="ypt-pb" data-a="resume" aria-label="Resume"><i class="fa-solid fa-play"></i></button><span class="ypt-pt" id="fc-pt">'+clk((Date.now()-r.p0)/1e3,1)+'</span><small>Break · '+D.brk.len+' min</small></div></div>';
return'<div class="ypt-pill live"><button class="ypt-pb" data-a="'+(r.mode==='sw'?'pause':'stop')+'" aria-label="'+(r.mode==='sw'?'Pause':'Stop')+'"><i class="fa-solid fa-'+(r.mode==='sw'?'pause':'stop')+'"></i></button><span class="ypt-pt" id="fc-pt">'+clk(curSec(r,Date.now()),1)+'</span><small>'+esc(sub(r.sid).n)+'</small><button class="ypt-pb sq" data-a="stop" aria-label="Stop and save"><i class="fa-solid fa-stop"></i></button></div>'}

/* ----- sheets (menu, edit log) ----- */
function closeSheet(){var o=document.getElementById('fc-sheet');if(o)o.remove()}
function sheet(html){closeSheet();var o=document.createElement('div');o.id='fc-sheet';o.className='ypt-ov';o.innerHTML='<div class="ypt-sh" role="dialog" aria-modal="true">'+html+'</div>';
o.addEventListener('click',function(ev){if(ev.target===o){closeSheet();return}var e=ev.target.closest('[data-a]');if(!e||!A[e.dataset.a])return;if(e.classList.contains('ypt-mi')&&!e.classList.contains('soon'))closeSheet();A[e.dataset.a](e)});
document.body.appendChild(o);return o}
function menu(){var HN={t:'Timer',td:'To-Do',d:'Day',s:'Stats'};
function it(a,ic,n,soon,x){return'<button class="ypt-mi'+(soon?' soon':'')+'" data-a="'+a+'"'+(x||'')+'><i class="fa-solid '+ic+'"></i><span>'+n+'</span>'+(soon?'<em>Soon</em>':'')+'</button>'}
sheet('<div class="ypt-menu"><div><small>Main</small>'+it('mgo','fa-chart-simple','Statistics',0,' data-v="s"')+it('mgo','fa-hourglass-half','Pomodoro',0,' data-v="pm"')+it('elogm','fa-pen','Edit log')+it('brkset','fa-mug-hot','Break settings')+it('mrank','fa-star','Rankings')+it('moff','fa-wifi','Offline mode')+'</div>'
+'<div><small>Extra</small>'+it('mgo','fa-music','Sounds',0,' data-v="snd"')+it('bkm','fa-book','Books'+ms(bkName()||(D.bk.length?D.bk.length+' saved':'')))+it('chm','fa-trophy','Challenge'+ms(D.ch?(chStat().fin?'Finished':'Day '+chStat().el+' of '+D.ch.n):'Not started'))+it('ttm','fa-table-cells','Timetable'+ms(D.tt.length?D.tt.length+' blocks':'Empty'))+it('soon','fa-film','Timelapse',1)+'</div>'
+'<div class="wide"><small>More</small>'+it('goal','fa-bullseye','Daily goal')+it('dday','fa-calendar-check','D-Day')+it('share','fa-share-nodes','Share today')+it('homeset','fa-house','Home tab: '+HN[D.home])+it('ntm','fa-bell','Motivation'+ms(D.nt.on?'On':'Off'))+'</div></div>')}

/* ----- Sprint B: study group desk grid + rankings (Circle members + opt-in user_stats) ----- */
var G={st:'idle',groups:[],gAt:0,mem:{},rows:[],at:0,rk:'today'};
function gme(){try{var a=window.__epCommunityApi,x=a&&a.session&&a.session();return x&&x.user?x.user:null}catch(e){return null}}
function gcl(){var a=window.__epCommunityApi;if(!a||!a.ready)return Promise.reject(new Error('nolog'));return a.ready().then(function(x){return x.client})}
function gSel(){if(D.gid&&G.groups.some(function(g){return g.id===D.gid}))return D.gid;return G.groups[0]?G.groups[0].id:null}
function gName(){var g=G.groups.filter(function(x){return x.id===gSel()})[0];return g?g.name:'Study group'}
function gBuild(l,by){var td=iso(Date.now()),u=gme(),now=Date.now();
var rows=l.map(function(p){var s=by[p.id],me=!!(u&&p.id===u.id),o={id:p.id,name:me?'You':(p.display_name||p.username||'Student'),me:me,shared:!!s,live:0,today:0,week:0,t0:now,subj:''};
if(s){o.today=s.as_of===td?(s.focus_today||0):0;o.week=s.focus_week||0;var up=Date.parse(s.updated_at)||0;o.t0=up;if(s.live_since&&now-up<4*6e4){o.live=1;o.subj=s.live_subject||''}}
if(me){var q=st();o.shared=true;o.today=q.today;o.week=q.wk;o.live=D.run&&D.run.ph==='f'?1:0;o.subj=D.run?sub(D.run.sid).n:'';o.t0=now}
return o});
return rows.sort(function(a,b){return(b.live-a.live)||(b.today-a.today)||a.name.localeCompare(b.name)})}
function gLoad(force){if(G.st==='loading')return;if(!force&&G.st==='ready'&&Date.now()-G.at<45000)return;if(!gme()){G.st='nolog';gPaint();return}
var had=G.st==='ready';if(!had)G.st='loading';
gcl().then(function(c){var needG=!G.groups.length||Date.now()-G.gAt>3e5,p=needG?c.rpc('campus_inbox').then(function(r){if(r.error)throw r.error;G.gAt=Date.now();return(r.data||[]).filter(function(x){return x.kind==='group'&&!x.archived})}):Promise.resolve(G.groups);
return p.then(function(gs){G.groups=gs;var gid=gSel();if(!gid){G.rows=[];return}
var m=G.mem[gid],pm=m&&Date.now()-m.t<3e5?Promise.resolve(m.l):c.rpc('campus_members_list',{p_chat:gid}).then(function(r){if(r.error)throw r.error;G.mem[gid]={t:Date.now(),l:r.data||[]};return r.data||[]});
return pm.then(function(l){var ids=l.map(function(x){return x.id}).slice(0,200);
return c.from('user_stats').select('user_id,display_name,focus_today,focus_week,live_subject,live_since,updated_at,as_of').in('user_id',ids).then(function(r){var by={};(r&&r.data||[]).forEach(function(x){by[x.user_id]=x});G.rows=gBuild(l,by)})})})})
.then(function(){G.st='ready';G.at=Date.now();gPaint()}).catch(function(e){G.st=(e&&e.message==='nolog')?'nolog':(had?'ready':'error');gPaint()})}
function desk(live){var c=live?'#f97316':'#8b8f98';return'<svg viewBox="0 0 48 40" width="46" height="38" fill="none" stroke="'+c+'" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 26h36M9 26v10M39 26v10"/><path d="M33 26v-7M30 19h7l-1.6-6h-3.8z"/>'+(live?'<circle cx="19" cy="10" r="4.5"/><path d="M10 26c0-6 4-9 9-9s9 3 9 9"/>':'<rect x="12" y="19" width="10" height="7" rx="1"/>')+'</svg>'}
function gFixMe(){G.rows.forEach(function(o){if(o.me){var q=st();o.today=q.today;o.week=q.wk;o.shared=true;o.live=D.run&&D.run.ph==='f'?1:0;o.subj=D.run?sub(D.run.sid).n:'';o.t0=Date.now()}});G.rows.sort(function(a,b){return(b.live-a.live)||(b.today-a.today)||a.name.localeCompare(b.name)})}
function gInner(){gFixMe();var gs=G.groups,gid=gSel();
if(G.st==='nolog')return'<div class="ypt-gh"><b>Study groups</b></div><p class="cm-muted" style="font-size:.85rem;margin:.4rem 0">Log in to Campus to see friends studying live.</p><button class="cm-btn" data-a="gopen">Open Campus</button>';
if(G.st==='idle'||(G.st==='loading'&&!gs.length))return'<div class="ypt-gh"><b>Study groups</b></div><p class="cm-muted" style="font-size:.85rem;margin:.4rem 0">Loading your Circles…</p>';
if(G.st==='error'&&!gs.length)return'<div class="ypt-gh"><b>Study groups</b></div><p class="cm-muted" style="font-size:.85rem;margin:.4rem 0">Could not load your Circles.</p><button class="cm-btn" data-a="gretry">Retry</button>';
if(!gs.length)return'<div class="ypt-gh"><b>Study groups</b></div><p class="cm-muted" style="font-size:.85rem;margin:.4rem 0">Join a Circle to see friends studying live and compare study time.</p><button class="cm-btn" data-a="gopen">Open Circles</button>';
var rows=G.rows,n=rows.filter(function(o){return o.live}).length,nm=gs.length>1?'<select data-a="gsel" aria-label="Choose group" class="ypt-gsel">'+gs.map(function(g){return'<option value="'+esc(g.id)+'"'+(g.id===gid?' selected':'')+'>'+esc(g.name)+'</option>'}).join('')+'</select>':'<b>'+esc(gName())+'</b>';
return'<div class="ypt-gh">'+nm+'<button class="fc-dd" data-a="rank">Rankings</button></div><p class="ypt-gs"><em>'+n+' member'+(n===1?'':'s')+'</em> studying</p>'
+'<div class="ypt-gg">'+rows.slice(0,24).map(function(o){return'<div class="ypt-gc'+(o.live?' live':'')+(o.me?' me':'')+'">'+desk(o.live)+'<b>'+esc(o.name)+'</b><small class="ypt-gt"'+(o.live?' data-live="1" data-base="'+o.today*60+'" data-t0="'+o.t0+'"'+(o.me?' data-me="1"':''):'')+'>'+(o.shared?clk(o.today*60,1):'—')+'</small></div>'}).join('')+'</div>'
+(rows.length>24?'<small class="cm-muted">+'+(rows.length-24)+' more</small>':'')
+(window.epPub&&!epPub.vis()?'<div class="ypt-gn"><span>Only you can see your study time. Share it so friends see you studying.</span><button class="fc-dd" data-a="gshare">Share</button></div>':'')}
function groupCard(){return'<div class="cm-card ypt-grp" id="fc-grp">'+gInner()+'</div>'}
function gPaint(){var e=document.getElementById('fc-grp');if(e)e.innerHTML=gInner();if(document.getElementById('fc-rank'))rankSheet()}
function rankSheet(){gFixMe();var k=G.rk,all=G.rows,rows=all.filter(function(o){return o.shared}).sort(function(a,b){return(k==='week'?b.week-a.week:b.today-a.today)||a.name.localeCompare(b.name)}),hid=all.length-rows.length,medal=['🥇','🥈','🥉'];
sheet('<div id="fc-rank"><h3>Rankings</h3><p class="cm-muted" style="margin:2px 0 10px">'+esc(gName())+'</p><div class="ypt-rkt"><button data-a="rkr" data-v="today" class="'+(k==='today'?'on':'')+'">Today</button><button data-a="rkr" data-v="week" class="'+(k==='week'?'on':'')+'">This week</button></div>'
+(rows.length?rows.map(function(o,i){var v=k==='week'?o.week:o.today;return'<div class="ypt-rk'+(o.me?' me':'')+'"><span class="n">'+(medal[i]||i+1)+'</span><span class="nm">'+esc(o.name)+(o.live?' <i class="ypt-ld" title="Studying now"></i>':'')+'</span><b>'+hm(v)+'</b></div>'}).join(''):'<p class="cm-muted">'+(G.st==='ready'?'No one here is sharing study time yet.':'Loading…')+'</p>')
+(hid>0?'<small class="cm-muted" style="display:block;margin-top:8px">'+hid+' member'+(hid===1?' isn\'t':'s aren\'t')+' sharing study time.</small>':'')
+(window.epPub&&!epPub.vis()?'<div class="ypt-gn" style="margin-top:10px"><span>Share your study time to appear in rankings.</span><button class="fc-dd" data-a="gshare">Share</button></div>':'')
+'<div class="ypt-sh-row"><button class="cm-btn" data-a="sclose">Close</button></div></div>')}
setInterval(function(){var els=document.querySelectorAll('#fc-grp .ypt-gt[data-live]');if(!els.length)return;var n=Date.now(),mine=null;els.forEach(function(e){var v;if(e.dataset.me){if(mine===null)mine=st().today*60;v=mine}else v=(+e.dataset.base)+(n-(+e.dataset.t0))/1e3;e.textContent=clk(v,1)})},1000);
setInterval(function(){if(!document.hidden&&document.getElementById('fc-grp'))gLoad(1)},60000);

/* ----- Sprint C: compare statistics (anonymous percentiles from students who share study time) ----- */
var SV='m',CS={st:'idle',d:null,m:0,key:'',at:0,rg:'today',sc:'all'},CMIN=30;
function cYear(){try{var p=getAspirantProfile();return p&&p.examYear?String(p.examYear):''}catch(e){return ''}}
function cMine(){var q=st();return Math.round(CS.rg==='week'?q.wk:q.today)}
function cVals(m){return[m,1,m+(CS.rg==='week'?600:60),m+10,m+30,m+60]}
function cTop(d,i){var N=d.pool,b=d.below[i];return Math.max(1,Math.min(100,Math.round(100*(N-b+1)/(N+1))))}
function cNum(n){n=Math.max(0,n);return n>=10?String(Math.round(n)):String(Math.round(n*10)/10)}
function cLoad(force){var m=cMine(),yr=CS.sc==='year'?cYear():'',key=CS.rg+'|'+CS.sc+'|'+m;if(CS.st==='loading')return;if(!force&&CS.st==='ready'&&CS.key===key&&Date.now()-CS.at<6e4)return;
if(!gme()){CS.st='nolog';cPaint();return}
if(!(window.epPub&&epPub.vis())){CS.st='noshare';cPaint();return}
CS.st='loading';
gcl().then(function(c){return c.rpc('ep_focus_compare',{p_day:iso(Date.now()),p_range:CS.rg,p_values:cVals(m),p_year:yr||null})}).then(function(r){if(r.error)throw r.error;var d=r.data;if(!d||d.shared===false){CS.st='noshare'}else{CS.d=d;CS.m=m;CS.key=key;CS.st='ready';CS.at=Date.now()}cPaint()})
.catch(function(e){var t=(e&&e.message)||'';CS.st=/does not exist|schema cache|Could not find/i.test(t)?'nosetup':(t==='nolog'?'nolog':'error');cPaint()})}
function cChart(d,mine){var n=d.hist.length,W=320,H=110,mx=Math.max.apply(null,d.hist.slice(1).concat([1]))*1.15,pts=d.hist.map(function(c,i){return[i*W/(n-1),H-4-(Math.min(c,mx)/mx)*(H-22)]}),line='M'+pts.map(function(p){return p[0].toFixed(1)+' '+p[1].toFixed(1)}).join(' L'),area=line+' L'+W+' '+H+' L0 '+H+' Z',mi=Math.min(n-1,Math.floor(mine/d.bin)),mx0=mi*W/(n-1),labs='',i;
for(i=0;i<n;i+=6){var h=Math.round(i*d.bin/60);labs+='<text x="'+Math.min(W-8,Math.max(8,i*W/(n-1)))+'" y="'+(H+14)+'" text-anchor="middle" font-size="10" fill="currentColor" opacity=".6">'+(i===0?'0':h+'h'+(i===n-1?'+':''))+'</text>'}
return'<svg viewBox="0 0 '+W+' '+(H+20)+'" class="ypt-dist" role="img" aria-label="How your study time compares with other students"><path d="'+area+'" fill="#f97316" opacity=".18"/><path d="'+line+'" fill="none" stroke="#f97316" stroke-width="2"/><line x1="'+mx0+'" x2="'+mx0+'" y1="14" y2="'+H+'" stroke="#f97316" stroke-width="1.5" stroke-dasharray="3 3"/><circle cx="'+mx0+'" cy="'+(pts[mi][1])+'" r="4" fill="#f97316"/><text x="'+Math.min(W-14,Math.max(14,mx0))+'" y="10" text-anchor="middle" font-size="11" font-weight="800" fill="#f97316">Me</text>'+labs+'</svg>'}
function cInner(){var yr=cYear(),wk=CS.rg==='week',chips='<div class="ypt-cch">'+[['today','Today'],['week','This week']].map(function(x){return'<button data-a="crange" data-v="'+x[0]+'" class="'+(CS.rg===x[0]?'on':'')+'">'+x[1]+'</button>'}).join('')+(yr?'<span class="sp"></span>'+[['all','All students'],['year','NEET '+esc(yr)]].map(function(x){return'<button data-a="cscope" data-v="'+x[0]+'" class="'+(CS.sc===x[0]?'on':'')+'">'+x[1]+'</button>'}).join(''):'')+'</div>';
var msg=function(t,b){return chips+'<div class="cm-card" style="padding:1rem"><p class="cm-muted" style="font-size:.9rem;margin:0 0 .6rem">'+t+'</p>'+(b||'')+'</div>'};
if(CS.st==='nolog')return msg('Log in to Campus to compare your study time with other students.','<button class="cm-btn" data-a="gopen">Open Campus</button>');
if(CS.st==='noshare')return msg('Compare is for students who share their study time. Your numbers are only counted, never shown by name.','<button class="cm-btn pri" data-a="cshare">Share my study time</button>');
if(CS.st==='nosetup')return msg('Compare is not available yet. It needs a one-time setup on the server.');
if(CS.st==='error')return msg('Could not load the comparison.','<button class="cm-btn" data-a="cretry">Retry</button>');
if(CS.st!=='ready'||!CS.d)return chips+'<div class="cm-skel" style="height:120px"></div><div class="cm-skel" style="height:120px;margin-top:.6rem"></div>';
var d=CS.d,mine=CS.m,q=st();
if(d.pool<CMIN)return msg('Not enough students yet: '+d.pool+' of '+CMIN+' needed'+(CS.sc==='year'?' for your exam year':'')+'. Invite friends to a Circle and ask them to share their study time.','')
+'<div class="fc-grid"><div><small>Today</small><b>'+hm(q.today)+'</b></div><div><small>Daily average</small><b>'+hm(q.wk/7)+'</b></div><div><small>Best day</small><b>'+hm(q.best)+'</b></div></div>';
var t0=cTop(d,0),t1=cTop(d,1),t2=cTop(d,2),per=(d.below[3]-d.below[0])/10,lab=wk?'this week':'today',more=wk?'10 more hours this week':'1 more hour today';
var ins=[(mine===0?'Just starting now <b>puts you in the Top '+t1+'%</b>':'You are in the <b>Top '+t0+'%</b> '+lab),more+' <b>Top '+t0+'% → '+t2+'%</b>'];
return chips+'<p class="cm-muted" style="font-size:.8rem;margin:.2rem 2px .6rem">Based on '+d.pool+' student'+(d.pool===1?'':'s')+' who share their study time</p>'
+'<div class="cm-card" style="padding:.9rem"><b>Overview</b>'+ins.map(function(t){return'<div class="ypt-ins">'+t+'</div>'}).join('')+'</div>'
+'<div class="cm-card" style="padding:.9rem;margin-top:.7rem"><b>Study time distribution</b><small class="cm-muted" style="display:block;margin:.1rem 0 .4rem">'+(wk?'This week':'Today')+' · updates when you open this tab</small>'+cChart(d,mine)+'<div class="ypt-ins">'+(mine===0?'Just 1 minute puts you <b>ahead of '+Math.round(100*d.below[1]/Math.max(1,d.pool))+'% of students</b>':'You are <b>ahead of '+Math.round(100*d.below[0]/Math.max(1,d.pool))+'% of students</b>')+'</div></div>'
+'<div class="cm-card" style="padding:.9rem;margin-top:.7rem"><b>What 1 minute is worth</b><div class="ypt-worth1">'+cNum(per)+' <small>student'+(per===1?'':'s')+' passed per extra minute</small></div><div class="ypt-worth">'+[[10,3],[30,4],[60,5]].map(function(x){return'<div><small>+'+x[0]+' min</small><b>'+cNum(d.below[x[1]]-d.below[0])+'</b></div>'}).join('')+'</div></div>'}
function compareV(){cLoad();return'<div id="fc-cmp">'+cInner()+'</div>'}
function cPaint(){var e=document.getElementById('fc-cmp');if(e)e.innerHTML=cInner()}
function stats(){return'<div class="ypt-stt"><button data-a="sv" data-v="m" class="'+(SV==='c'?'':'on')+'">My stats</button><button data-a="sv" data-v="c" class="'+(SV==='c'?'on':'')+'">Compare</button></div>'+(SV==='c'?compareV():myStats())}
setInterval(function(){if(!document.hidden&&document.getElementById('fc-cmp'))cLoad(1)},6e4);

/* ----- Sprint D: Books, Challenge, Timetable (local, no backend) ----- */
function dBetween(a,b){return Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/864e5)}
function bkMin(id){var t=0;D.ss.forEach(function(q){if(q.b===id)t+=q.m});if(D.run&&D.run.ph==='f'&&D.bsel===id)t+=live();return t}
function bkSheet(){var l=D.bk.map(function(b){var on=D.bsel===b.id;return'<div class="dd-row"><span>'+esc(b.n)+'<br><small class="cm-muted">'+hm(bkMin(b.id))+' logged</small></span><span><button class="cm-btn'+(on?' pri':'')+'" data-a="bkpick" data-id="'+b.id+'">'+(on?'Using':'Use')+'</button> <button class="cm-btn" data-a="bkdel" data-id="'+b.id+'" aria-label="Remove book"><i class="fa-solid fa-trash"></i></button></span></div>'}).join('');
sheet('<h3>Books and materials</h3><p class="cm-muted">Pick the book you are studying. Time from your next sessions is logged to it.</p>'+(l||'<p class="cm-muted">No books yet.</p>')+'<div class="ypt-sh-row"><button class="cm-btn" data-a="menu">← Menu</button><button class="cm-btn pri" data-a="bkadd">Add book</button></div>')}
function chStat(){var c=D.ch,o=days(),td=iso(Date.now()),el=Math.max(0,Math.min(c.n,dBetween(c.s,td)+1)),done=0,ok=[],i,k,y,sk=0;for(i=0;i<el;i++){k=shiftD(c.s,i);y=(o[k]||0)>=c.h*60;ok.push(y);if(y)done++}i=el-1;if(i>=0&&!ok[i])i--;while(i>=0&&ok[i]){sk++;i--}return{el:el,done:done,streak:sk,today:o[td]||0,fin:dBetween(c.s,td)+1>c.n}}
function chSheet(){var c=D.ch;if(!c){sheet('<h3>Focus challenge</h3><p class="cm-muted">Study a set number of hours every day for a set number of days.</p><label>Hours per day<input type="number" id="dc-h" min="1" max="16" step="0.5" value="4" inputmode="decimal"></label><label>Days<input type="number" id="dc-n" min="3" max="365" value="30" inputmode="numeric"></label><div class="ypt-sh-row"><button class="cm-btn" data-a="sclose">Cancel</button><button class="cm-btn pri" data-a="chgo">Start challenge</button></div>');return}
var s=chStat(),C=263.9,p=c.n?s.done/c.n:0,left=Math.max(0,c.h*60-s.today);
sheet('<h3>'+c.h+' h × '+c.n+' days</h3><div class="dd-ring"><svg viewBox="0 0 100 100" role="img" aria-label="'+s.done+' of '+c.n+' days completed"><circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" opacity=".15" stroke-width="9"/><circle cx="50" cy="50" r="42" fill="none" stroke="#f97316" stroke-width="9" stroke-linecap="round" stroke-dasharray="'+(p*C).toFixed(1)+' '+C+'" transform="rotate(-90 50 50)"/></svg><div><b>'+s.done+'/'+c.n+'</b><small>days done</small></div></div>'
+'<p class="cm-muted" style="text-align:center">'+(s.fin?'Challenge finished.':'Day '+s.el+' of '+c.n+' · streak '+s.streak+' day'+(s.streak===1?'':'s')+(s.streak>=7?' 🔥':''))+'</p>'
+(s.fin?'':'<p style="text-align:center;margin:.3rem 0">'+(left>0?hm(left)+' to go today':'Today is done ✓')+'</p>')
+'<div class="ypt-sh-row"><button class="cm-btn" data-a="menu">← Menu</button><button class="cm-btn" data-a="chstop">Stop</button><button class="cm-btn pri" data-a="dgo" data-v="t">Start studying</button></div>')}
function ttNow(){var n=new Date(),w=n.getDay(),t=p2(n.getHours())+':'+p2(n.getMinutes());return D.tt.filter(function(b){return b.w===w&&b.s<=t&&t<b.e})[0]||null}
function ttSheet(){var td=new Date().getDay(),nm=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var body=[1,2,3,4,5,6,0].map(function(w){var l=D.tt.filter(function(b){return b.w===w}).sort(function(a,b){return a.s<b.s?-1:1});if(!l.length)return'';return'<small class="cm-muted">'+nm[w]+(w===td?' · today':'')+'</small>'+l.map(function(b){return'<div class="dd-row"><span>'+b.s+'–'+b.e+' · <b style="color:'+sub(b.sid).c+'">'+esc(sub(b.sid).n)+'</b></span><span>'+(w===td?'<button class="cm-btn pri" data-a="ttgo" data-sid="'+b.sid+'">Start</button> ':'')+'<button class="cm-btn" data-a="ttdel" data-id="'+b.id+'" aria-label="Delete block"><i class="fa-solid fa-trash"></i></button></span></div>'}).join('')}).join('');
sheet('<h3>Weekly timetable</h3>'+(body||'<p class="cm-muted">No blocks yet. Add your plan for the week.</p>')+'<div class="ypt-sh-row"><button class="cm-btn" data-a="menu">← Menu</button><button class="cm-btn pri" data-a="ttnew">Add block</button></div>')}

/* ----- Motivation reminders (Hindi / English, random, local notifications) ----- */
var NM={g:[['आज का एक घंटा कल की सफलता की नींव है। 💪','Every hour you study today builds your NEET rank tomorrow.'],['छोटे-छोटे कदम ही मंज़िल तक पहुँचाते हैं।','Small daily steps beat occasional big efforts.'],['डॉक्टर बनने का सपना है, तो आज का टारगेट पूरा करो!','Dreaming of the white coat? Finish today’s target first.'],['थक गए? थोड़ा ब्रेक लो, फिर वापस आओ। तुम कर सकते हो!','Tired? Take a short break, then come back. You can do this.'],['मेहनत का कोई शॉर्टकट नहीं होता।','There is no shortcut to hard work. Keep going.'],['आज के 10 MCQ कल के मार्क्स बनेंगे।','Ten MCQs today are marks on exam day.'],['Consistency ही असली टॉपर है। 🔥','Consistency is what toppers have in common.'],['जो आज मेहनत करता है, वही कल मुस्कुराता है।','Work hard today, smile on result day.']],
n:[['आज अभी तक पढ़ाई शुरू नहीं की? बस 25 मिनट से शुरू करो! ⏱️','No study logged yet today. Start with just 25 minutes.'],['टाइमर चालू करो, बाकी सब खुद आसान हो जाएगा।','Start the timer. The rest gets easier.']],
d:[['शाबाश! आज का गोल पूरा हुआ। 🎉','Goal done for today. Great work! 🎉'],['आज तुमने कमाल किया। अब आराम करो और कल फिर चमको।','You crushed it today. Rest well and shine again tomorrow.']]};
function ntPick(){var q=st(),h=new Date().getHours(),b='g';if(q.today>=D.goal)b='d';else if(q.today<1&&h>=16)b='n';var l=NM[b],m=l[Math.floor(Math.random()*l.length)],lg=D.nt.lang;if(lg==='mix')lg=Math.random()<.5?'hi':'en';return{t:'EduPulse',b:lg==='hi'?m[0]:m[1]}}
function ntSend(m){var o={body:m.b,tag:'ep-motivation'};try{if(navigator.serviceWorker&&navigator.serviceWorker.getRegistration){navigator.serviceWorker.getRegistration().then(function(r){if(r&&r.showNotification)r.showNotification(m.t,o);else new Notification(m.t,o)}).catch(function(){try{new Notification(m.t,o)}catch(e){}});return}new Notification(m.t,o)}catch(e){}}
function ntTick(){var n=D.nt;if(!n.on||!('Notification' in window)||Notification.permission!=='granted')return;var h=new Date().getHours();if(h>=22||h<7||Date.now()<(n.nx||0))return;ntSend(ntPick());n.nx=Date.now()+n.ev*36e5*(.75+Math.random()*.5);save()}
setInterval(ntTick,6e4);setTimeout(ntTick,2e4);
function ntSheet(){var n=D.nt,pm='Notification' in window?Notification.permission:'none',LN={mix:'Hindi + English',hi:'हिंदी',en:'English'};
sheet('<h3>Motivation reminders</h3><p class="cm-muted">'+(pm==='none'?'This browser does not support notifications.':pm==='denied'?'Notifications are blocked. Allow them in your browser or phone settings.':'A random Hindi or English message while EduPulse is open or installed. Quiet from 10 pm to 7 am.')+'</p>'
+'<div class="dd-row"><span>Reminders</span><button class="cm-btn'+(n.on?' pri':'')+'" data-a="nton">'+(n.on?'On':'Off')+'</button></div>'
+'<div class="dd-row"><span>Language</span><button class="cm-btn" data-a="ntlang">'+LN[n.lang]+'</button></div>'
+'<div class="dd-row"><span>About every</span><button class="cm-btn" data-a="ntev">'+n.ev+' h</button></div>'
+'<div class="ypt-sh-row"><button class="cm-btn" data-a="menu">← Menu</button><button class="cm-btn" data-a="nttest">Test</button><button class="cm-btn pri" data-a="sclose">Done</button></div>')}

/* ----- Polish: shortcut chips on every page, live menu subtitles ----- */
function ms(t){return t?'<small class="dd-ms">'+esc(t)+'</small>':''}
function ttNext(){var n=new Date(),t=p2(n.getHours())+':'+p2(n.getMinutes());return D.tt.filter(function(b){return b.w===n.getDay()&&b.s>t}).sort(function(a,b){return a.s<b.s?-1:1})[0]||null}
function bkName(){var b=D.bk.filter(function(x){return x.id===D.bsel})[0];return b?b.n:''}
function dLinks(){var ch='Challenge',nb=ttNow()||ttNext(),tl=nb?nb.s+' '+sub(nb.sid).n:'Timetable',bn=bkName();
if(D.ch){var q=chStat();ch=q.fin?'Challenge done':'Day '+q.el+'/'+D.ch.n+(q.streak?' · 🔥'+q.streak:'')}
function c(a,i,l){return'<button class="dd-chip" data-a="'+a+'"><i class="fa-solid '+i+'"></i>'+esc(l)+'</button>'}
return'<div class="dd-links" role="navigation" aria-label="Shortcuts">'+c('chm','fa-trophy',ch)+c('ttm','fa-table-cells',tl)+c('bkm','fa-book',bn?(bn.length>16?bn.slice(0,15)+'…':bn):'Books')+c('mrank','fa-star','Rankings')+'</div>'}
var hdr0=hdr;hdr=function(){return hdr0()+dLinks()};

/* ----- Today page bridge ----- */
window.epFocusSummary=function(){var q=st(),run=!!(D.run&&D.run.ph==='f'),nb=ttNow()||ttNext(),ch='';if(D.ch){var z=chStat();ch=z.fin?'Challenge finished':'Challenge day '+z.el+'/'+D.ch.n}
return{run:run,title:run?'Studying '+sub(D.run.sid||D.sel).n:'Focus timer',line:hm(q.today)+' of '+hm(D.goal)+' today'+(q.streak?' · 🔥 '+q.streak:'')+(nb?' · '+(ttNow()?'Now ':'Next ')+nb.s+' '+sub(nb.sid).n:ch?' · '+ch:'')}};
window.epFocusShow=function(v){if(v==='home')v=D.home||'t';if(['t','td','d','s'].indexOf(v)<0)return;D.view=v;D.full=0;if(root())draw()};
window.epFocusPomodoro=function(f,b,l){epOpenFocus();setTimeout(function(){if(D.run){draw();return}D.mode='pm';D.pm={f:f||25,b:b||5,l:l||15};D.view='t';save();start()},220)};
window.epFocusGo=function(n){epOpenFocus();setTimeout(function(){if(A[n])A[n]({dataset:{}})},180)};
setTimeout(function(){try{var c=document.querySelector('.tc-card');if(c&&!/Focus timer|Studying /.test(c.textContent)&&typeof renderView==='function'&&typeof currentTab!=='undefined'&&currentTab==='dashboard')renderView()}catch(e){}},0);

/* ----- Dashboard polish: live timer banner + Focus shortcuts in Quick start ----- */
(function(){var o=window.buildDashboardV2;if(typeof o!=='function')return;
window.buildDashboardV2=function(){var h=o.apply(this,arguments);
try{var fs=window.epFocusSummary&&window.epFocusSummary();
if(fs&&fs.run){var i=h.indexOf('</section>');if(i>-1)h=h.slice(0,i+10)+'<button type="button" class="dd-live" onclick="epOpenFocus()"><i aria-hidden="true"></i><span><b>'+esc(fs.title)+'</b><small>'+esc(fs.line)+'</small></span><em>Open timer</em></button>'+h.slice(i+10)}
var x='<button type="button" onclick="epFocusGo(\'ttm\')" class="dv2-act dv2-teal"><span><i class="fa-solid fa-table-cells"></i></span>Timetable</button><button type="button" onclick="epFocusGo(\'chm\')" class="dv2-act dv2-amber"><span><i class="fa-solid fa-trophy"></i></span>Challenge</button>';
h=h.replace(/<button type="button" onclick="startDashboardFocusBlock\(\)"[^>]*>[\s\S]*?<\/button>/,function(m){return m+x})}catch(e){}
return h}})();

/* ----- events ----- */
var A={pause:pause,resume:resume,menu:menu,sclose:closeSheet,
selday:function(e){SD=e.dataset.d;draw()},
wk:function(e){SD=shiftD(curD(),+e.dataset.n);draw()},
addtask:function(e){var sid=e.dataset.id;epAsk.prompt('',{title:'New task · '+sub(sid).n,placeholder:'e.g. Revise Kinematics',ok:'Add'}).then(function(v){var t=(v||'').trim();if(!t)return;D.todo.push({id:'t'+Date.now().toString(36),t:t.slice(0,100),x:0,d:curD(),sid:sid==='g'?'':sid});if(D.todo.length>300)D.todo=D.todo.slice(-300);save();draw()})},
mgo:function(e){var v=e.dataset.v;if(v==='pm'){if(!D.run)D.mode='pm';D.view='t'}else if(v==='snd'){D.view='t'}else D.view=v;save();draw()},
elogm:function(){D.view='d';save();draw();tt('Tap a session to edit it, or use + Add session.')},
mrank:function(){if(!gme()){tt('Log in to Campus to see rankings.');return}gLoad();rankSheet()},
rank:function(){gLoad();rankSheet()},rkr:function(e){G.rk=e.dataset.v;rankSheet()},gretry:function(){G.st='idle';gLoad(1);gPaint()},gshare:function(){window.epPub&&epPub.setVis(true);setTimeout(function(){gLoad(1)},2500);gPaint()},gopen:function(){closeSheet();try{switchTab('campus')}catch(e){}},
moff:function(){tt('Your timer works offline and is saved on this device.')},
soon:function(){tt('Coming in the next update.')},
bkm:bkSheet,
ntm:ntSheet,
dgo:function(e){closeSheet();D.view=e.dataset.v;save();draw()},
nton:function(){var n=D.nt;if(n.on){n.on=0;save();ntSheet();return}if(!('Notification' in window)){tt('Notifications are not supported here','warning');return}Promise.resolve(Notification.requestPermission()).then(function(p){if(p==='granted'){n.on=1;n.nx=Date.now()+n.ev*36e5;save();tt('Motivation reminders on','success')}else tt('Permission was not given','warning');ntSheet()})},
ntlang:function(){var o=['mix','hi','en'];D.nt.lang=o[(o.indexOf(D.nt.lang)+1)%3];save();ntSheet()},
ntev:function(){var o=[2,3,4,6];D.nt.ev=o[(o.indexOf(D.nt.ev)+1)%4];D.nt.nx=Date.now()+D.nt.ev*36e5;save();ntSheet()},
nttest:function(){if(!('Notification' in window)||Notification.permission!=='granted'){tt('Turn reminders on first','warning');return}ntSend(ntPick())},
bkadd:function(){epAsk.prompt('',{title:'Add a book or module',placeholder:'e.g. NCERT Biology XI',ok:'Add'}).then(function(v){var t=(v||'').trim();if(!t)return;var id='k'+Date.now().toString(36);D.bk.push({id:id,n:t.slice(0,60)});if(D.bk.length>40)D.bk=D.bk.slice(-40);D.bsel=id;save();bkSheet()})},
bkpick:function(e){D.bsel=D.bsel===e.dataset.id?'':e.dataset.id;save();bkSheet()},
bkdel:function(e){D.bk=D.bk.filter(function(b){return b.id!==e.dataset.id});if(D.bsel===e.dataset.id)D.bsel='';save();bkSheet()},
chm:chSheet,
chgo:function(){var o=document.getElementById('fc-sheet');if(!o)return;var h=+o.querySelector('#dc-h').value,n=Math.round(+o.querySelector('#dc-n').value);if(!(h>=1&&h<=16&&n>=3&&n<=365)){tt('Use 1 to 16 hours and 3 to 365 days','warning');return}D.ch={h:h,n:n,s:iso(Date.now())};save();chSheet();tt('Challenge started. Day 1 is today.','success')},
chstop:function(){epConfirm('Stop this challenge? Your study sessions are kept.','Stop').then(function(ok){if(ok){D.ch=null;save();closeSheet();tt('Challenge stopped')}})},
ttm:ttSheet,
ttnew:function(){var nm=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];sheet('<h3>Add timetable block</h3><label>Day<select id="dt-w">'+[1,2,3,4,5,6,0].map(function(w){return'<option value="'+w+'"'+(w===new Date().getDay()?' selected':'')+'>'+nm[w]+'</option>'}).join('')+'</select></label><label>Subject<select id="dt-s">'+D.subs.map(function(x){return'<option value="'+x.id+'"'+(x.id===D.sel?' selected':'')+'>'+esc(x.n)+'</option>'}).join('')+'</select></label><label>Start<input type="time" id="dt-a" value="18:00"></label><label>End<input type="time" id="dt-b" value="20:00"></label><div class="ypt-sh-row"><button class="cm-btn" data-a="ttm">Back</button><button class="cm-btn pri" data-a="ttsave">Save</button></div>')},
ttsave:function(){var o=document.getElementById('fc-sheet');if(!o)return;var a=o.querySelector('#dt-a').value,b=o.querySelector('#dt-b').value;if(!/^\d{2}:\d{2}$/.test(a)||!/^\d{2}:\d{2}$/.test(b)||b<=a){tt('End time must be after start time','warning');return}D.tt.push({id:'w'+Date.now().toString(36),w:+o.querySelector('#dt-w').value,s:a,e:b,sid:o.querySelector('#dt-s').value});if(D.tt.length>80)D.tt=D.tt.slice(-80);save();ttSheet()},
ttdel:function(e){D.tt=D.tt.filter(function(b){return b.id!==e.dataset.id});save();ttSheet()},
ttgo:function(e){closeSheet();D.sel=e.dataset.sid;D.mode='sw';D.view='t';if(!D.run)start();else save();draw()},
brkset:function(){epAsk.prompt('You get a reminder when a break passes this length (1 to 60 minutes).',{title:'Break length (minutes)',value:D.brk.len,type:'number',ok:'Save'}).then(function(v){if(v==null)return;var n=Math.round(+v);if(!(n>=1&&n<=60)){tt('Enter 1 to 60 minutes','warning');return}D.brk.len=n;save();draw();tt('Break length set to '+n+' min','success')})},
homeset:function(){var o=['t','td','d','s'],n={t:'Timer',td:'To-Do',d:'Day',s:'Stats'};D.home=o[(o.indexOf(D.home)+1)%4];save();tt('Opens on '+n[D.home]+' next time')},
elog:function(e){var t=e.dataset.t?+e.dataset.t:0,q=t?D.ss.filter(function(x){return x.t===t})[0]:null,sd=curD();if(t&&!q)return;
var st0=q?new Date(q.t):new Date();if(!q){if(sd===iso(Date.now()))st0=new Date(Date.now()-30*6e4);else st0=new Date(sd+'T09:00:00');if(iso(st0)!==sd)st0=new Date(sd+'T00:00:00')}
var tv=p2(st0.getHours())+':'+p2(st0.getMinutes()),mv=q?Math.max(1,Math.round(q.m)):30,cs=q?q.s:D.sel;
sheet('<h3>'+(q?'Edit session':'Add session')+'</h3><p class="cm-muted">'+longd(q?q.d:sd)+'</p>'
+'<label>Subject<select id="fl-s">'+D.subs.map(function(x){return'<option value="'+x.id+'"'+(x.id===cs?' selected':'')+'>'+esc(x.n)+'</option>'}).join('')+'</select></label>'
+'<label>Start time<input type="time" id="fl-t" value="'+tv+'"></label>'
+'<label>Minutes<input type="number" id="fl-m" min="1" max="960" value="'+mv+'" inputmode="numeric"></label>'
+'<div class="ypt-sh-row">'+(q?'<button class="cm-btn" data-a="elogdel" data-t="'+q.t+'">Delete</button>':'')+'<button class="cm-btn" data-a="sclose">Cancel</button><button class="cm-btn pri" data-a="elogsave" data-t="'+(q?q.t:'')+'" data-d="'+(q?q.d:sd)+'">Save</button></div>')},
elogsave:function(e){var o=document.getElementById('fc-sheet');if(!o)return;var tv=o.querySelector('#fl-t').value,m=Math.round(+o.querySelector('#fl-m').value),sid=o.querySelector('#fl-s').value,d=e.dataset.d,t0=e.dataset.t?+e.dataset.t:0;
if(!/^\d{2}:\d{2}$/.test(tv)){tt('Pick a start time','warning');return}
if(!(m>=1&&m<=960)){tt('Minutes must be between 1 and 960','warning');return}
var ts=new Date(d+'T'+tv+':00').getTime(),te=ts+m*6e4;
if(!(ts>0)){tt('Pick a valid start time','warning');return}
if(te>Date.now()+6e4){tt('That session would end in the future','warning');return}
if(D.ss.some(function(x){return x.t!==t0&&x.t<te&&x.t+x.m*6e4>ts})){tt('That overlaps another session','warning');return}
var old=t0?D.ss.filter(function(x){return x.t===t0})[0]:null;
if(old){oldAddT(old.t,-old.m);D.ss=D.ss.filter(function(x){return x!==old})}
D.ss.push({d:iso(ts),s:sid,m:m,t:ts,k:old?old.k:'sw',x:old?old.x:0,man:old?old.man:1});
oldAddT(ts,m);D.ss.sort(function(x,y){return x.t-y.t});if(D.ss.length>900)D.ss=D.ss.slice(-900);save();closeSheet();draw();tt('Session saved','success');window.epPub&&epPub.soon()},
elogdel:function(e){var t=+e.dataset.t,q=D.ss.filter(function(x){return x.t===t})[0];if(!q)return;closeSheet();
epAsk.confirm('This removes '+hm(q.m)+' of '+sub(q.s).n+' from your totals.',{title:'Delete session?',ok:'Delete'}).then(function(ok){if(!ok)return;oldAddT(q.t,-q.m);D.ss=D.ss.filter(function(x){return x!==q});save();draw();tt('Session deleted');window.epPub&&epPub.soon()})},
sv:function(e){SV=e.dataset.v;draw()},
crange:function(e){CS.rg=e.dataset.v;CS.st='idle';draw()},
cscope:function(e){CS.sc=e.dataset.v;CS.st='idle';draw()},
cretry:function(){CS.st='idle';draw()},
cshare:function(){window.epPub&&epPub.setVis(true);setTimeout(function(){CS.st='idle';draw()},2500)},
substart:function(e){D.sel=e.dataset.id;save();start()},view:function(e){D.view=e.dataset.v;save();draw()},start:start,stop:stop,mode:function(e){D.mode=e.dataset.v;save();draw()},sub:function(e){D.sel=e.dataset.id;save();draw()},
pmset:function(e){D.pm={f:+e.dataset.f,b:+e.dataset.b,l:+e.dataset.l};save();draw()},
addsub:function(){epAsk.prompt('',{title:'Subject name',placeholder:'e.g. Botany, Mock test',ok:'Add'}).then(function(v){var n=(v||'').trim().slice(0,24);if(!n||D.subs.length>=10)return;D.subs.push({id:'s'+Date.now().toString(36),n:n,c:PAL[D.subs.length%PAL.length]});D.sel=D.subs[D.subs.length-1].id;save();draw()})},
opt:function(e){var k=e.dataset.k;D.opt[k]=D.opt[k]?0:1;save();if(k==='wake')D.opt.wake?wake():unwake();draw()},
full:function(){D.full=1;draw();try{document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen()}catch(x){}},unfull:function(){D.full=0;try{document.fullscreenElement&&document.exitFullscreen()}catch(x){}draw()},
goal:function(){epAsk.prompt('Between 0.5 and 18 hours.',{title:'Daily study goal (hours)',value:D.goal/60,type:'number',ok:'Set goal'}).then(function(v){if(v===null)return;var h=parseFloat(v);if(h>0&&h<=18){D.goal=Math.round(h*60);save();draw()}else window.toast&&toast('Enter a goal between 0.5 and 18 hours','warning')})},
dday:function(){epAsk.prompt('',{title:'D-Day name',value:D.dd?D.dd.n:'NEET 2027',placeholder:'e.g. NEET 2027',ok:'Next'}).then(function(n){if(n===null)return;return epAsk.prompt('Leave empty to remove the D-Day.',{title:'Exam date',value:D.dd?D.dd.d:'',type:'date',ok:'Save'}).then(function(d){if(d===null)return;if(!d.trim()){D.dd=null}else if(/^\d{4}-\d{2}-\d{2}$/.test(d.trim()))D.dd={n:n.trim().slice(0,24)||'Exam',d:d.trim()};else{window.toast&&toast('Pick a valid date','warning');return}save();draw()})})},
addt:function(){var i=document.getElementById('fc-ti'),t=i&&i.value.trim();if(!t)return;D.todo.push({id:'t'+Date.now().toString(36),t:t.slice(0,100),x:0,d:iso(Date.now())});save();draw();var n=document.getElementById('fc-ti');n&&n.focus()},
tdo:function(e){D.todo.forEach(function(t){if(t.id===e.dataset.id)t.x=e.checked?1:0});save();draw()},rmt:function(e){D.todo=D.todo.filter(function(t){return t.id!==e.dataset.id});save();draw()},
share:function(){var s=st(),t='I studied '+hm(s.today)+' today on EduPulse Focus · '+s.streak+' day streak'+(D.dd&&D.dd.d&&daysTo(D.dd.d)>=0?' · D-'+daysTo(D.dd.d)+' to '+D.dd.n:'')+'. Padhai ki dhadkan!';if(navigator.share)navigator.share({text:t}).catch(function(){});else{try{navigator.clipboard.writeText(t)}catch(x){}window.toast&&toast('Copied to share','success')}}};
document.addEventListener('click',function(ev){var r=root();if(!r||!r.contains(ev.target))return;var e=ev.target.closest('[data-a]');if(!e||e.tagName==='SELECT'||e.type==='range')return;var f=A[e.dataset.a];if(f)f(e)});
document.addEventListener('change',function(ev){var e=ev.target;if(!root()||!root().contains(e))return;if(e.dataset.a==='gsel'){D.gid=e.value;save();G.rows=[];G.st='idle';gLoad(1);gPaint()}else if(e.dataset.a==='snd'){D.opt.snd=e.value;save();snd()}else if(e.dataset.a==='tdo')A.tdo(e)});
document.addEventListener('input',function(ev){var e=ev.target;if(e.dataset&&e.dataset.a==='vol'){D.opt.vol=+e.value;if(SN)SN.g.gain.value=D.opt.vol;save()}});
document.addEventListener('keydown',function(ev){if(ev.key==='Enter'&&ev.target.id==='fc-ti')A.addt();if(ev.key==='Escape')closeSheet()});
setInterval(function(){var nl=document.getElementById('fc-now');if(nl){var d=new Date();nl.style.top=((d.getHours()*60+d.getMinutes())/60*HR)+'px';nl.firstChild.textContent=p2(d.getHours())+':'+p2(d.getMinutes())}},30000);
/* ----- public API ----- */
window.epFocusRender=function(){if(!D.run){var nb=ttNow();if(nb&&D.tp!==nb.id+iso(Date.now())){D.tp=nb.id+iso(Date.now());D.sel=nb.sid;save()}}draw();wake()};
function data(){var o=days(),d7=[],i,k,sp={};for(i=6;i>=0;i--){k=ago(i);d7.push([['S','M','T','W','T','F','S'][new Date(k+'T00:00:00').getDay()],o[k]||0])}
D.ss.forEach(function(q){if(q.d>=ago(6))sp[q.s]=(sp[q.s]||0)+q.m});
var hh=[],dd=new Date(),n=84;dd.setDate(dd.getDate()-n+1+(6-dd.getDay()));for(i=0;i<n;i++){hh.push(dd>new Date()?-1:Math.round(o[iso(dd)]||0));dd.setDate(dd.getDate()+1)}
return{goal:D.goal,days7:d7,split:Object.keys(sp).map(function(k){var x=sub(k);return[x.n,x.c,sp[k]]}),heat:hh}}
window.epFocus={live:function(){return D.run&&D.run.ph==='f'?{n:sub(D.run.sid).n,t:D.run.t0}:null},begin:function(n){var x=D.subs.filter(function(q){return q.n===n})[0];if(!x){x={id:'s'+Date.now().toString(36),n:n,c:PAL[D.subs.length%PAL.length]};D.subs.push(x)}D.sel=x.id;D.mode='sw';if(!D.run)start();else save();draw()},data:data,stats:st,level:lvl,badges:badges,heat:heat,hm:hm,daysTo:daysTo,set:function(o){if(o.goal)D.goal=o.goal;if(o.dd!==undefined)D.dd=o.dd;save()}};
if(D.run)setTimeout(function(){wake();snd()},0);
})();

;

(function(){
var AK='edupulse_aspirant_profile_v1',EM=['🧑‍🎓','👩‍⚕️','👨‍⚕️','🦉','🚀','🔥','🧠','🐯','🦁','🌟','🎯','📚'],GR=[['#14b8a6','#4f46e5'],['#f97316','#e11d48'],['#0ea5e9','#7c3aed'],['#10b981','#0d9488'],['#f59e0b','#ef4444'],['#ec4899','#8b5cf6']],SUBJ=['Physics','Chemistry','Biology'],OB={};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function P(){try{return window.getAspirantProfile?getAspirantProfile():{}}catch(e){return{}}}
function may(y){var d=new Date(+y,4,1);while(d.getDay())d.setDate(d.getDate()+1);return y+'-05-'+String(d.getDate()).padStart(2,'0')}
function av(p,sz,r){p=p||{};var a=p.avatar||{e:'🧑‍🎓',g:0},g=GR[a.g||0];return'<span style="display:inline-grid;place-items:center;width:'+sz+'px;height:'+sz+'px;border-radius:'+(r||16)+'px;background:linear-gradient(135deg,'+g[0]+','+g[1]+');font-size:'+Math.round(sz*.5)+'px;flex:none">'+a.e+'</span>'}
function tier(s){return s>=700?'Elite · top-rank territory':s>=650?'Top medical colleges':s>=600?'Strong and competitive':'Solid foundation to build on'}
function split(w){var v=SUBJ.map(function(s){return w.indexOf(s)>=0?1.4:1}),t=v.reduce(function(a,b){return a+b},0);return SUBJ.map(function(s,i){return s+' '+Math.round(v[i]*100/t)+'%'}).join(' · ')}
function chips(arr,cur,fn,multi){return arr.map(function(x){var on=multi?cur.indexOf(x[0])>=0:cur===x[0];return'<button type="button" onclick="epOb.'+fn+'(\''+x[0]+'\')" class="px-3.5 py-2 rounded-xl border text-xs font-bold '+(on?'bg-teal-600 text-white border-teal-600':'border-slate-200 dark:border-slate-700')+'" aria-pressed="'+on+'">'+x[1]+'</button>'}).join('')}
function dots(){return'<div class="flex gap-1.5 mb-3" aria-label="Step '+(OB.s+1)+' of 2">'+[0,1].map(function(i){return'<span class="h-1.5 flex-1 rounded-full '+(i<=OB.s?'bg-teal-500':'bg-slate-200 dark:bg-slate-700')+'"></span>'}).join('')+'</div>'}
function cap(){var n=document.getElementById('ob-name');if(n)OB.name=n.value.trim().slice(0,30);var sc=document.getElementById('ob-score');if(sc)OB.score=+sc.value;var dt=document.getElementById('ob-date');if(dt&&dt.value)OB.date=dt.value;var h=document.getElementById('ob-hrs');if(h)OB.hours=+h.value}
function render(){var s=OB.s,b='',t=['Welcome to EduPulse','Set your daily goal'][s],sub=['Tell us what to call you. Takes 30 seconds.','Pick your exam year and study hours. We handle the rest.'][s];
if(s===0)b=dots()+'<div class="flex items-center gap-4 mb-4">'+av({avatar:{e:OB.e,g:OB.g}},64)+'<div class="flex-1"><label for="ob-name" class="block font-bold mb-1 text-xs">Your name</label><input id="ob-name" maxlength="30" value="'+esc(OB.name)+'" placeholder="e.g. Ansh" autocomplete="given-name" class="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-sm"></div></div><p class="font-bold text-xs mb-2">Pick an avatar</p><div class="flex flex-wrap gap-2">'+EM.slice(0,8).map(function(e){return'<button type="button" onclick="epOb.em(\''+e+'\')" class="w-11 h-11 rounded-xl text-xl border '+(OB.e===e?'border-teal-500 bg-teal-500/10':'border-slate-200 dark:border-slate-700')+'" aria-label="Avatar '+e+'">'+e+'</button>'}).join('')+'</div>';
if(s===1)b=dots()+'<p class="font-bold text-xs mb-2">Target NEET year</p><div class="flex gap-2 mb-4">'+chips([['2027','NEET 2027'],['2028','NEET 2028'],['2029','NEET 2029']],OB.year,'yr')+'</div><p class="font-bold text-xs mb-2">Study hours per day</p><div class="flex flex-wrap gap-2 mb-4">'+chips([[4,'4h'],[6,'6h'],[8,'8h'],[10,'10h'],[12,'12h']],OB.hours,'hr')+'</div><div class="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-xs font-semibold text-teal-800 dark:text-teal-300"><i class="fa-solid fa-wand-magic-sparkles mr-1.5"></i>Your plan: <b>'+Math.round(OB.hours*12)+' MCQs/day</b> \u00b7 <b>'+OB.hours+'h focus goal</b><br><span class="font-normal">You can change the target score, exam date and subjects anytime in Profile.</span></div>';
var f=(s>0?'<button type="button" onclick="epOb.back()" class="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold mr-2">Back</button>':'<button type="button" onclick="epOb.skip()" class="px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 mr-2">Skip</button>')+'<button type="button" onclick="epOb.next()" class="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs shadow-md">'+(s<1?'Continue':'Start studying')+'</button>';
setModal(t,sub,b,f)}
window.openOnboardingModal=function(force){var p=P();if(p.onboarded&&!force)return;var yr=['2027','2028','2029'].indexOf(p.examYear)>=0?p.examYear:'2027';OB={s:0,name:p.onboarded?p.name:'',e:(p.avatar||{}).e||EM[0],g:(p.avatar||{}).g||0,year:yr,score:p.targetScore||650,date:p.examDate||may(yr),hours:p.dailyHours||8,weak:p.weak||[],pref:p.pref||'Morning'};render()};
window.saveOnboardingProfile=function(){window.epOb.next()};
window.epOb={em:function(e){cap();OB.e=e;render()},gr:function(i){cap();OB.g=i;render()},yr:function(y){cap();if(OB.date===may(OB.year))OB.date=may(y);OB.year=y;render()},hr:function(h){cap();OB.hours=+h;render()},
wk:function(s){cap();var i=OB.weak.indexOf(s);i<0?OB.weak.push(s):OB.weak.splice(i,1);render()},pf:function(v){cap();OB.pref=v;render()},
sc:function(v){OB.score=+v;var a=document.getElementById('ob-sv'),b=document.getElementById('ob-tier');if(a)a.textContent=v;if(b)b.textContent=tier(+v)},
back:function(){cap();OB.s=Math.max(0,OB.s-1);render()},skip:function(){cap();OB.name=OB.name||'Aspirant';OB.s=1;window.epOb.next()},
next:function(){cap();if(OB.s===0&&!OB.name){window.toast&&toast('Enter a name to continue','warning');return}if(OB.s<1){OB.s++;render();return}if(OB.busy)return;OB.busy=1;
var o={onboarded:true,name:OB.name||'Aspirant',examYear:OB.year,targetScore:OB.score,dailyHours:OB.hours,dailyGoalQuestions:Math.round(OB.hours*12),avatar:{e:OB.e,g:OB.g},examDate:OB.date,weak:OB.weak,pref:OB.pref};
StorageModule.set(AK,o);try{sc().then(function(c){var u=window.__epCommunityApi.session().user;if(u&&OB.name)return c.from('profiles').update({display_name:OB.name}).eq('id',u.id)}).then(function(){window.loadCommunityProfile&&loadCommunityProfile(true)}).catch(function(){})}catch(e){}try{localStorage.setItem(DAILY_GOAL_KEY,String(o.dailyGoalQuestions))}catch(e){}
try{window.epFocus&&epFocus.set({goal:OB.hours*60,dd:{n:'NEET '+OB.year,d:OB.date}})}catch(e){}try{if(window.__bz&&OB.date)__bz.set('examDate',OB.date)}catch(e){}
var de=document.getElementById('current-date');if(de)de.textContent='Padhai ki dhadkan · NEET '+o.examYear+' · Target '+o.targetScore;var h1=document.querySelector('.topbar h1.hidden');if(h1)h1.innerHTML='Welcome, '+esc(o.name)+'<span style="color:#0d9488">.</span>';
closeModal();if(typeof renderView==='function')renderView();showToast('Profile ready. '+o.dailyGoalQuestions+' MCQs/day and a '+o.dailyHours+'h focus goal are set.','success')}};
var SOC=null,SOCT=0;
function cd(){try{return(window.__epProfileData&&__epProfileData())||{}}catch(e){return{}}}
function sc(){var a=window.__epCommunityApi;return a&&a.ready?a.ready().then(function(x){return x.client}):Promise.reject()}
function socHtml(){if(!SOC)return'';var p=SOC.p,f=SOC.f,t=function(l,v){return'<div class="rounded-2xl bg-slate-500/5 p-2.5 text-center"><b class="block text-base">'+v+'</b><small class="text-[11px] font-bold uppercase text-slate-500">'+l+'</small></div>'};
return'<div class="mt-4 grid grid-cols-3 gap-2">'+t('Followers',p.followers||0)+t('Following',p.following||0)+t('Reputation','⭐ '+(p.reputation||0))+'</div>'
+'<div class="mt-3"><label class="text-xs font-bold" for="pf-pin">📌 Pinned achievement</label><div class="mt-1 flex gap-2"><input id="pf-pin" list="pf-pl" maxlength="70" value="'+esc(p.pinned||'')+'" placeholder="Pick or type" class="min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent p-2.5 text-sm"><button type="button" data-pfa="pin" class="rounded-xl bg-teal-600 px-3 text-xs font-black text-white">Save</button></div><datalist id="pf-pl"><option value="🏆 Top 10 in Daily 10"><option value="🔥 30-day study streak"><option value="🧬 Genetics master"><option value="⭐ 1000 questions solved"></datalist></div>'
+'<div class="mt-3"><p class="text-xs font-bold">Following</p>'+(f.length?'<div class="mt-1 flex flex-wrap gap-1.5">'+f.map(function(x){return'<span class="inline-flex items-center gap-1 rounded-full bg-slate-500/10 py-1 pl-2.5 pr-1 text-xs font-bold">@'+esc(x.username)+'<button type="button" data-pfa="unfollow" data-v="'+esc(x.username)+'" aria-label="Unfollow '+esc(x.username)+'" class="grid h-5 w-5 place-items-center rounded-full bg-slate-500/15">×</button></span>'}).join('')+'</div>':'<p class="mt-1 text-xs text-slate-500">Not following anyone yet.</p>')+'<div class="mt-2 flex gap-2"><input id="pf-fh" maxlength="20" placeholder="Follow by @handle" class="min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent p-2.5 text-sm"><button type="button" data-pfa="follow" class="rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-black">Follow</button></div></div>'}
function fill(){var e=document.getElementById('pf-social');if(e)e.innerHTML=socHtml()}
function loadSoc(force){if(SOC&&!force&&Date.now()-SOCT<6e4){fill();return}sc().then(function(c){return c.rpc('campus_profile_get',{}).then(function(r){if(r.error||!r.data)throw 0;return c.rpc('campus_follow_list',{p_kind:'following'}).then(function(f){SOC={p:r.data,f:f.data||[]};SOCT=Date.now();fill()})})}).catch(function(){})}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-pfa]');if(!b)return;var a=b.dataset.pfa;
if(a==='edit'){var f=document.getElementById('community-profile-form');if(f){f.scrollIntoView({behavior:'smooth',block:'center'});var i=f.querySelector('input');i&&i.focus()}else window.toast&&toast('Log in to edit your profile details','info');return}
if(a==='goals'){openOnboardingModal(true);return}
sc().then(function(c){var ok=function(m){return function(r){if(r&&r.error)throw r.error;window.toast&&toast(m,'success');loadSoc(true)}};
if(a==='pin')return c.rpc('campus_profile_save',{p_bio:(SOC&&SOC.p.bio)||cd().bio||'',p_pinned:document.getElementById('pf-pin').value}).then(ok('Pinned achievement saved'));
if(a==='follow'){var h=(document.getElementById('pf-fh').value||'').replace(/^@/,'').trim();if(!h)return;return c.rpc('campus_follow',{p_handle:h,p_on:true}).then(ok('Following @'+h))}
if(a==='unfollow')return c.rpc('campus_follow',{p_handle:b.dataset.v,p_on:false}).then(ok('Unfollowed'))}).catch(function(x){window.toast&&toast((x&&x.message)||'Could not update. Log in and try again.','warning')})});
function hero(){var p=P(),c=cd(),F=window.epFocus;if(!F)return'';var s=F.stats(),L=F.level(s.tot),dd='';var XL={l:L.i,title:L.n,pct:L.pct};try{var xs=window.epXpStats();XL={l:xs.l,title:xs.title,pct:Math.min(100,Math.round((xs.xp-xs.lo)*100/(xs.hi-xs.lo)))};}catch(e){}try{var d=JSON.parse(localStorage.getItem('ep_focus2')||'{}').dd;if(d&&d.d&&F.daysTo(d.d)>=0)dd='<span class="rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-300 px-2.5 py-1 text-[11px] font-black">D-'+F.daysTo(d.d)+' · '+esc(d.n)+'</span>'}catch(e){}
var on=p.onboarded,nm=c.display_name||(on?p.name:'')||'Aspirant',bio=(SOC&&SOC.p.bio)||c.bio||'',chip=function(t){return'<span class="rounded-full bg-slate-500/10 px-2.5 py-1 text-[11px] font-bold">'+t+'</span>'};
return'<div class="w-full"><section class="card p-5 sm:p-6" id="pf-hero"><div class="flex items-center gap-4"><div class="min-w-0 flex-1"><p class="text-[11px] font-black uppercase tracking-widest text-slate-500">Study profile</p><p class="mt-0.5 truncate text-sm font-bold"><span class="text-teal-600 dark:text-teal-300">'+'Level '+XL.l+' · '+XL.title+'</span></p><div class="mt-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"><i class="block h-full bg-teal-500" style="width:'+XL.pct+'%"></i></div></div><div class="flex shrink-0 flex-col gap-1.5"><button type="button" data-pfa="edit" class="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold"><i class="fa-solid fa-pen mr-1"></i>Edit</button><button type="button" data-pfa="goals" class="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold"><i class="fa-solid fa-bullseye mr-1"></i>Goals</button></div></div>'
+(bio?'<p class="mt-3 text-sm text-slate-600 dark:text-slate-300">'+esc(bio)+'</p>':'')
+(on?'<div class="mt-3 flex flex-wrap gap-1.5">'+dd+chip('🎯 '+p.targetScore+'/720')+chip('⏱️ '+p.dailyHours+'h/day')+chip('NEET '+p.examYear)+(p.pref?chip(p.pref):'')+(p.weak||[]).map(function(w){return chip('💡 '+w)}).join('')+'</div>':'<p class="mt-3 text-sm text-slate-500">Tap Goals to set your target and get a daily plan, D-Day countdown and study stats.</p>')

+'<div id="pf-social">'+socHtml()+'</div><div class="mt-4">'+F.heat(12,'sp-heat')+'</div><label class="mt-3 flex items-center gap-2 text-xs font-semibold"><input type="checkbox" '+(window.epPub&&epPub.vis()?'checked':'')+' onchange="epPub.setVis(this.checked)" style="accent-color:#0d9488"> Share my study stats with other students <span class="font-normal text-slate-500">(off by default)</span></label></section></div>'}
(window.__epProfileExtras=window.__epProfileExtras||{}).hero=function(){setTimeout(loadSoc,300);return hero()};
})();

;

(function(){
var GR=[['#14b8a6','#4f46e5'],['#f97316','#e11d48'],['#0ea5e9','#7c3aed'],['#10b981','#0d9488'],['#f59e0b','#ef4444'],['#ec4899','#8b5cf6']],VK='ep_pub_visible',last='',dead=0,tmr;
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function api(){return window.__epCommunityApi}
function cl(){var a=api();if(!a||!a.ready)return Promise.reject(new Error('Log in to see student profiles.'));return a.ready().then(function(x){return x.client})}
function me(){try{var u=api().session().user;return u||null}catch(e){return null}}
function today(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function vis(){try{return localStorage.getItem(VK)==='1'}catch(e){return false}}
function hm(m){m=Math.max(0,m);return m>=60?Math.floor(m/60)+'h '+String(Math.round(m%60)).padStart(2,'0')+'m':Math.round(m)+'m'}
function ago(t){var m=(Date.now()-Date.parse(t))/6e4;return m<2?'just now':m<60?(m|0)+'m ago':m<1440?(m/60|0)+'h ago':(m/1440|0)+'d ago'}
function av(a,sz){a=a||{};var g=GR[a.g||0]||GR[0];return'<span style="display:inline-grid;place-items:center;width:'+sz+'px;height:'+sz+'px;border-radius:20px;background:linear-gradient(135deg,'+g[0]+','+g[1]+');font-size:'+Math.round(sz*.5)+'px;flex:none">'+(a.e||'🧑‍🎓')+'</span>'}
function heatH(a){return'<div class="sp-heat">'+(a||[]).map(function(m){return'<i class="'+(m<0?'':m>=180?'h4':m>=90?'h3':m>=30?'h2':m>0?'h1':'')+'"'+(m<0?' style="visibility:hidden"':' title="'+m+' min"')+'></i>'}).join('')+'</div>'}
/* ---- publish my stats ---- */
function row(){var F=window.epFocus;if(!F)return null;var s=F.stats(),L=F.level(s.tot),d=F.data(),X=window.epXpStats?epXpStats():{},p={};try{p=getAspirantProfile()}catch(e){}var u=me();if(!u)return null;var nm=p.name||(u.user_metadata&&(u.user_metadata.full_name||u.user_metadata.name))||(u.email||'Student').split('@')[0];
return{user_id:u.id,display_name:String(nm).slice(0,40),avatar:p.avatar||null,title:X.title||L.n,level:X.l||1,xp:X.xp||0,streak:Math.max(X.st||0,s.streak),correct:X.cor||0,sessions:X.n||0,best_acc:X.acc||0,focus_today:Math.round(s.today),focus_week:Math.round(s.wk),focus_total:Math.round(s.tot),focus_level:L.n,week:d.days7.map(function(x){return Math.round(x[1])}),heat:d.heat,badges:(X.earned||[]).slice(0,24),exam_year:p.examYear||null,visible:vis(),handle:((window.__epProfileData&&__epProfileData())||{}).username||null,live_subject:(F.live()||{}).n||null,live_since:F.live()?new Date(F.live().t).toISOString():null,strong:(window.epLinkChap?epLinkChap().strong:[]).map(function(x){return x.ch}),weak:(window.epLinkChap?epLinkChap().weak:[]).map(function(x){return x.ch}),as_of:today(),updated_at:new Date().toISOString()}}
function unpublish(){var CK='ep_pub_cleaned_'+((me()||{}).id||'');return cl().then(function(c){return c.from('user_stats').delete().eq('user_id',me().id)}).then(function(x){if(x&&x.error)throw x.error;try{localStorage.setItem(CK,'1')}catch(e){}}).catch(function(){})}
function push(force){if(dead)return;var u=me();if(!u)return;
/* opt-in: nothing is published unless the student switched sharing on. Remove any row an older build published, once per account on this device. */
if(!vis()){var CK='ep_pub_cleaned_'+u.id,done=false;try{done=localStorage.getItem(CK)==='1'}catch(e){}if(!done||force){last='';unpublish()}return}
var r=row();if(!r)return;var key=JSON.stringify(Object.assign({},r,{updated_at:0}));if(!force&&key===last)return;last=key;cl().then(function(c){return c.from('user_stats').upsert(r,{onConflict:'user_id'})}).then(function(x){if(x&&x.error)throw x.error}).catch(function(e){last='';if(/does not exist|schema cache|permission denied/i.test((e&&e.message)||''))dead=1})}
window.epPub={row:row,soon:function(){clearTimeout(tmr);tmr=setTimeout(function(){push()},1500)},vis:vis,setVis:function(v){try{localStorage.setItem(VK,v?'1':'0')}catch(e){}push(true);window.toast&&toast(v?'Sharing is on: other students can see your study stats':'Sharing is off: your study stats were removed from other students','info')}};
setTimeout(push,5000);
/* push on change (study data written to storage) and when the tab is hidden or closed; no fixed 90 s timer */
window.addEventListener('ep:store',function(e){var k=(e.detail&&e.detail.key)||'';if(/attempts|focus|streak|qstats|progress/.test(k))window.epPub.soon()});
document.addEventListener('visibilitychange',function(){if(document.hidden)push()});window.addEventListener('pagehide',function(){push()});
/* heartbeat only while a focus session is live, so 'studying now' stays fresh (viewers treat it as live for 4 minutes) */
var beat=0;function heartbeat(){var live=window.epFocus&&epFocus.live();if(live&&!beat){beat=setInterval(function(){if(!(window.epFocus&&epFocus.live())){clearInterval(beat);beat=0;return}last='';push()},120000)}}
document.addEventListener('visibilitychange',heartbeat);window.addEventListener('ep:store',heartbeat);
/* ---- view anyone's profile ---- */
function stat(l,v){return'<div class="rounded-2xl bg-slate-500/5 p-2.5 text-center"><b class="block text-base">'+v+'</b><small class="text-[11px] font-bold uppercase text-slate-500">'+l+'</small></div>'}
function render(r,mine){var fresh=r.as_of===today(),w=r.week||[],mx=Math.max.apply(null,w.concat([1])),days=['S','M','T','W','T','F','S'],i,bars='';
for(i=0;i<w.length;i++){var d=new Date();d.setDate(d.getDate()-(w.length-1-i));bars+='<div><i style="height:'+Math.max(3,Math.round(w[i]*52/mx))+'px;opacity:'+(w[i]?1:.25)+'" title="'+w[i]+' min"></i>'+days[d.getDay()]+'</div>'}
var b=(r.badges||[]).map(function(x){return'<span class="text-xl" title="'+esc(x[1])+'" aria-label="'+esc(x[1])+'">'+esc(x[0])+'</span>'}).join('');
return'<div class="space-y-4 py-1"><div class="flex items-center gap-4">'+av(r.avatar,68)+'<div class="min-w-0"><h3 class="truncate text-lg font-black">'+esc(r.display_name||'Student')+(mine?' <span class="text-xs font-bold text-teal-600">(you)</span>':'')+'</h3><p class="text-xs font-bold text-teal-600 dark:text-teal-300">Level '+r.level+' · '+esc(r.title||'')+'</p><p class="text-[11px] text-slate-500">'+(r.exam_year?'NEET '+esc(r.exam_year)+' · ':'')+'Updated '+ago(r.updated_at)+'</p></div></div>'
+'<div class="grid grid-cols-3 gap-2">'+stat('Today',fresh?hm(r.focus_today):'0m')+stat('This week',hm(r.focus_week))+stat('Total',Math.round(r.focus_total/6)/10+'h')+stat('XP',r.xp)+stat('Streak',r.streak+'d')+stat('Accuracy',(r.best_acc||0)+'%')+'</div>'
+'<div><p class="mb-1 text-xs font-bold">Focus · last 7 days</p><div class="pv-bars">'+bars+'</div></div><div><p class="mb-1 text-xs font-bold">Consistency · 12 weeks</p>'+heatH(r.heat)+'</div>'+(b?'<div><p class="mb-1 text-xs font-bold">Badges</p><div class="flex flex-wrap gap-1.5">'+b+'</div></div>':'')
+(mine&&!r.visible?'<p class="rounded-xl bg-amber-500/10 p-3 text-xs font-semibold text-amber-700 dark:text-amber-300">Your stats are hidden from others. Turn them on in your Profile.</p>':'')+'</div>'}
function msg(t,m){setModal(t,'',m,'<button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">Close</button>')}
function pick(rows){setModal('Which student?','Several students share this name.','<div class="space-y-2">'+rows.map(function(r){return'<button type="button" data-pk="'+esc(r.user_id)+'" class="flex w-full items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 text-left">'+av(r.avatar,40)+'<span><b class="block text-sm">'+esc(r.display_name)+'</b><small class="text-slate-500">Level '+r.level+' · '+r.xp+' XP</small></span></button>'}).join('')+'</div>','');setTimeout(function(){document.querySelectorAll('[data-pk]').forEach(function(b){b.onclick=function(){open(b.dataset.pk,'')}})},0)}
function open(uid,name){msg('Student profile','<div class="h-40 animate-pulse rounded-2xl bg-slate-500/10"></div>');var u=me(),q;
cl().then(function(c){q=c.from('user_stats').select('*');return uid?q.eq('user_id',uid).maybeSingle():q.ilike('display_name',String(name).replace(/[%_\\]/g,'\\$&')).limit(5)}).then(function(x){if(x.error)throw x.error;var d=x.data;if(Array.isArray(d)){if(d.length>1)return pick(d);d=d[0]}
if(!d)return msg(name||'Student profile','<p class="py-6 text-center text-sm text-slate-500">This student has not shared study stats yet.</p>');setModal(d.display_name||'Student profile','',render(d,u&&d.user_id===u.id),'<button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">Close</button>')}).catch(function(e){var m=(e&&e.message)||'';msg('Student profile','<p class="py-6 text-center text-sm text-slate-500">'+esc(/does not exist|schema cache/i.test(m)?'Public stats are not set up yet. Run public-stats.sql in Supabase.':m||'Could not load this profile.')+'</p>')})}
window.epProfileView=open;
document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('[data-pf]');if(!t)return;e.preventDefault();e.stopPropagation();open(t.dataset.pf,t.dataset.pn)},true);
document.addEventListener('keydown',function(e){if(e.key!=='Enter'&&e.key!==' ')return;var t=e.target.closest&&e.target.closest('[data-pf]');if(!t)return;e.preventDefault();e.stopPropagation();open(t.dataset.pf,t.dataset.pn)},true);
/* ---- Focus section in the Stats tab ---- */
function focusCard(){var F=window.epFocus;if(!F)return'';var s=F.stats(),L=F.level(s.tot),d=F.data(),pct=Math.min(100,Math.round(s.today*100/d.goal)),mx=Math.max.apply(null,d.days7.map(function(x){return x[1]}).concat([1])),tot=d.split.reduce(function(a,x){return a+x[2]},0)||1,C=2*Math.PI*34;var lvlTxt=L.e+' '+L.n;try{var xs=window.epXpStats();lvlTxt='Level '+xs.l+' · '+xs.title}catch(e){}
return'<div class="mx-auto mb-5 max-w-6xl"><section class="card p-5 sm:p-6"><div class="flex items-center gap-4"><svg viewBox="0 0 80 80" width="84" height="84" style="transform:rotate(-90deg);flex:none" aria-hidden="true"><circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width="7"/><circle cx="40" cy="40" r="34" fill="none" stroke="#0d9488" stroke-width="7" stroke-linecap="round" stroke-dasharray="'+C+'" stroke-dashoffset="'+C*(1-pct/100)+'"/></svg><div class="min-w-0 flex-1"><p class="text-[11px] font-black uppercase tracking-widest text-teal-600 dark:text-teal-300">Focus time</p><h3 class="text-2xl font-black">'+F.hm(s.today)+' <span class="text-sm font-bold text-slate-500">today · '+pct+'% of goal</span></h3><p class="text-xs font-bold text-slate-500">'+lvlTxt+' · '+s.streak+'-day streak · '+F.hm(s.wk)+' this week</p></div></div>'
+'<div class="mt-4 flex items-end gap-2" style="height:78px">'+d.days7.map(function(x){return'<div class="flex-1 text-center text-[11px]"><i class="block rounded-md" style="height:'+Math.max(3,Math.round(x[1]*54/mx))+'px;background:linear-gradient(#6366f1,#14b8a6);opacity:'+(x[1]?1:.25)+'" title="'+Math.round(x[1])+' min"></i>'+x[0]+'</div>'}).join('')+'</div>'
+(d.split.length?'<div class="mt-4 space-y-1.5">'+d.split.map(function(x){return'<div class="flex items-center gap-2 text-xs"><span class="w-20 truncate font-bold">'+esc(x[0])+'</span><div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-500/15"><i class="block h-full" style="width:'+Math.round(x[2]*100/tot)+'%;background:'+x[1]+'"></i></div><b>'+F.hm(x[2])+'</b></div>'}).join('')+'</div>':'')+'<div class="mt-4">'+heatH(d.heat)+'</div></section></div>'}
var o=window.buildStatsPageV2;if(typeof o==='function'&&!o.__f){var w=function(){return focusCard()+o.apply(this,arguments)};w.__f=1;window.buildStatsPageV2=w}
})();

;

(function(){
var AUTO='ep_link_auto';
function api(){return window.__epCommunityApi}
function gid(i){return document.getElementById(i)}
function cl(){var a=api();return a&&a.ready?a.ready().then(function(x){return x.client}):Promise.reject(new Error('Log in to use Circles features.'))}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function T(m,k){(window.showToast||window.toast||function(){})(m,k||'info')}
function plain(t){return String(t||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim()}
function att(){try{return StorageModule.get(STORAGE_KEYS.attempts,[])||[]}catch(e){return[]}}
function xp(){return window.epXpStats?epXpStats():{l:1,st:0,title:''}}
/* weak / strong chapters from practice history */
function chap(){var m={};att().forEach(function(a){var c=String(a.chapter||'').replace(/^Daily 10: /,'');if(!c||!a.attempted)return;var o=m[c]||(m[c]={a:0,c:0});o.a+=a.attempted;o.c+=a.correct||0});
var L=Object.keys(m).filter(function(k){return m[k].a>=10}).map(function(k){return{ch:k,acc:Math.round(m[k].c*100/m[k].a),n:m[k].a}});
return{weak:L.slice().sort(function(a,b){return a.acc-b.acc}).filter(function(x){return x.acc<65}).slice(0,5),strong:L.filter(function(x){return x.acc>=75}).sort(function(a,b){return b.acc-a.acc}).slice(0,5)}}
window.epLinkChap=chap;
/* chat sending + picker */
function say(id,kind,body,payload){return cl().then(function(c){return c.rpc('campus_send',{p_chat:id,p_kind:kind,p_body:body||'',p_payload:payload||{},p_reply_to:null,p_media_path:null})}).then(function(r){if(r&&r.error)throw r.error})}
function chats(){return window.epCircleLink?epCircleLink.chats():[]}
function pickChat(title,cb,offerAuto){var cs=chats();if(!cs.length){T('Open Circles once so your chats can load.','warning');return}var m=gid('lk-m');m&&m.remove();m=document.createElement('div');m.id='lk-m';m.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.5);display:grid;place-items:center;padding:1rem';
m.innerHTML='<div role="dialog" aria-label="'+esc(title)+'" style="background:var(--card-bg,#fff);color:inherit;border-radius:20px;padding:1rem;width:100%;max-width:420px;max-height:80vh;overflow:auto"><b>'+esc(title)+'</b><div style="margin:.6rem 0">'+cs.map(function(c){return'<button type="button" data-id="'+esc(c.id)+'" data-n="'+esc(c.name)+'" style="display:block;width:100%;text-align:left;padding:.65rem .8rem;margin-bottom:.35rem;border:1px solid var(--border-color,#e2e8f0);border-radius:12px;font-weight:700">'+esc(c.name)+' <small style="opacity:.6">'+esc(c.kind)+'</small></button>'}).join('')+'</div>'+(offerAuto?'<label style="display:flex;gap:.5rem;align-items:center;font-size:.78rem;font-weight:600"><input type="checkbox" id="lk-auto" style="accent-color:#0d9488"> Always share my finished sessions here</label>':'')+'<button type="button" id="lk-x" style="margin-top:.7rem;width:100%;padding:.55rem;border-radius:12px;background:rgba(100,116,139,.12);font-weight:700">Cancel</button></div>';
document.body.appendChild(m);m.onclick=function(e){if(e.target===m||e.target.id==='lk-x')m.remove()};
m.querySelectorAll('[data-id]').forEach(function(b){b.onclick=function(){var a=gid('lk-auto');if(a&&a.checked)try{localStorage.setItem(AUTO,JSON.stringify({id:b.dataset.id,n:b.dataset.n}))}catch(e){}m.remove();cb(b.dataset.id,b.dataset.n)}})}
function snack(msg,btns){var o=gid('lk-sn');o&&o.remove();o=document.createElement('div');o.id='lk-sn';o.setAttribute('role','status');o.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:84px;z-index:9998;width:min(94vw,460px);background:var(--card-bg,#fff);color:inherit;border:1px solid var(--border-color,#e2e8f0);border-radius:18px;padding:.8rem .9rem;box-shadow:0 20px 50px -20px rgba(0,0,0,.45)';
o.innerHTML='<div style="font-weight:800;font-size:.85rem;margin-bottom:.5rem">'+msg+'</div><div style="display:flex;gap:.4rem;flex-wrap:wrap">'+btns.map(function(b){return'<button type="button" data-k="'+b[0]+'" style="padding:.45rem .8rem;border-radius:999px;font-size:.75rem;font-weight:800;'+(b[2]?'background:#0d9488;color:#fff':'border:1px solid var(--border-color,#cbd5e1)')+'">'+b[1]+'</button>'}).join('')+'<button type="button" data-k="x" style="margin-left:auto;font-size:.75rem;opacity:.6">Dismiss</button></div>';document.body.appendChild(o);setTimeout(function(){o.remove()},16000);return o}
function auto(){try{return JSON.parse(localStorage.getItem(AUTO)||'null')}catch(e){return null}}
/* 1-3: question actions inside Practice */
function cur(){var q=quizState.questions[quizState.currentIndex];if(!q)return null;var a=quizState.userAnswers[quizState.currentIndex];return{q:q,sub:quizState.subject||q.subject||'General',ch:q.sourceChapter||quizState.chapter||'General',txt:plain(q.question),opts:(q.options||[]).map(plain),pick:a}}
function qBody(c){return c.txt+'\n'+c.opts.map(function(o,i){return String.fromCharCode(65+i)+'. '+o}).join('\n')+(c.pick!=null&&c.pick>=0?'\n\nI chose '+String.fromCharCode(65+c.pick)+' and I am not sure why.':'')}
function ask(){var c=cur();if(!c)return;cl().then(function(k){return k.rpc('campus_doubt_post',{p_subject:c.sub,p_chapter:c.ch,p_body:qBody(c).slice(0,1500)})}).then(function(r){if(r&&r.error)throw r.error;T('Posted to Doubts. Students in your circle can answer it.','success')}).catch(function(e){T((e&&e.message)||'Could not post. Log in and try again.','warning')})}
function thread(){var c=cur();if(!c)return;cl().then(function(k){var p={};try{p=getAspirantProfile()}catch(e){}return k.from('threads').insert({title:c.txt.slice(0,90),body:qBody(c).slice(0,4000),subject:c.sub,author_name:p.name||'Student'})}).then(function(r){if(r&&r.error)throw r.error;T('Thread started under '+c.sub+'. Find it in Circles → Threads.','success')}).catch(function(e){T((e&&e.message)||'Could not start the thread.','warning')})}
function chatQ(){var c=cur();if(!c)return;pickChat('Send this question to…',function(id,n){say(id,'question','',{subject:c.sub,chapter:c.ch,text:c.txt.slice(0,600),qkey:c.q.qKey,options:c.opts.slice(0,6)}).then(function(){T('Sent to '+n,'success')}).catch(function(e){T((e&&e.message)||'Could not send','warning')})})}
var oq=window.epQa;window.epQa=function(a,b){var f={cl_ask:ask,cl_chat:chatQ,cl_thr:thread}[a];if(f){try{epQaClose()}catch(e){}return f()}return oq.apply(this,arguments)};
/* 4-6: after a session — share, challenge, auto-share, milestones */
function after(b){var A=att();if(A.length<=b.n)return;var r=A[0];if(!r||!r.attempted)return;var X=xp(),ch=String(r.chapter||'Practice').replace(/^Daily 10: /,''),txt='🎯 I scored '+r.correct+'/'+r.attempted+' ('+(r.accuracy||0)+'%) in '+ch+' on EduPulse Practice.',ms=[];
if(X.l>b.x.l)ms.push('🚀 Level '+X.l+' · '+X.title+' on EduPulse!');
if(X.st>b.x.st&&[7,14,30,50,100].indexOf(X.st)>=0)ms.push('🔥 '+X.st+'-day study streak on EduPulse!');
var au=auto();
if(au&&r.attempted>=10){say(au.id,'text',txt+' Beat my score!').then(function(){ms.forEach(function(m){say(au.id,'text',m)});T('Shared to '+au.n,'success')}).catch(function(){});return}
if(r.attempted<5&&!ms.length)return;
var o=snack((ms[0]?ms[0]+'<br>':'')+'Share this '+(r.accuracy||0)+'% session with your circle?',[['share','Share result',1],['chal','Challenge a friend'],['auto','Auto-share']]);
o.onclick=function(e){var k=e.target.dataset&&e.target.dataset.k;if(!k)return;if(k==='x')return o.remove();o.remove();
if(k==='share')pickChat('Share to…',function(id,n){say(id,'text',txt+(ms.length?'\n'+ms.join('\n'):'')).then(function(){T('Shared to '+n,'success')}).catch(function(){T('Could not send','warning')})});
if(k==='chal')pickChat('Challenge who?',function(id,n){say(id,'text','⚔️ Challenge: I got '+(r.accuracy||0)+'% in '+ch+' ('+r.subject+'). Practice the same chapter and send me your score!').then(function(){T('Challenge sent to '+n,'success')}).catch(function(){T('Could not send','warning')})});
if(k==='auto')pickChat('Auto-share sessions to…',function(id,n){try{localStorage.setItem(AUTO,JSON.stringify({id:id,n:n}))}catch(x){}T('Sessions of 10+ questions now post to '+n,'success')})}}
['submitTestQuiz','finishInfiniteSession'].forEach(function(n){var f=window[n];if(typeof f!=='function'||f.__lk)return;var w=function(){var b={n:att().length,x:xp()},r=f.apply(this,arguments);setTimeout(function(){try{after(b)}catch(e){}},900);return r};w.__lk=1;window[n]=w});
})();

;

(function(){
/* some modules call a global toast() that did not exist (threw after every finished session) */
if(typeof window.toast!=='function')window.toast=function(m,k){try{(window.showToast||function(){})(m,k)}catch(e){}};
/* after answering, bring the result card and its buttons into view */
var last=null;new MutationObserver(function(){var r=document.getElementById('quiz-result');if(r&&r!==last){last=r;setTimeout(function(){try{r.scrollIntoView({block:'nearest',behavior:'smooth'})}catch(e){}},120)}else if(!r)last=null}).observe(document.body,{childList:true,subtree:true});
})();

;

/* Re-render the dashboard once every module above has registered, so late-added sections (Campus, account strip) appear on first load. */
(function(){function go(){try{if(typeof currentTab!=='undefined'&&currentTab==='dashboard'&&typeof renderView==='function'&&!document.querySelector('#main-container [data-d5]'))renderView();}catch(e){console.warn('first paint',e)}}
if(document.readyState==='complete')setTimeout(go,0);else window.addEventListener('load',function(){setTimeout(go,0)},{once:true});})();

;

/* Next is locked until answered; locked taps / swipes nudge the options instead of showing a toast */
window.epNudgeAnswer=function(){
  try{
    var l=document.querySelector('.quiz-session-layout'); if(!l)return;
    var o=l.querySelector('.mt-5.space-y-3'); var f=l.querySelector('.pq-foot');
    if(o){o.classList.remove('ep-nudge');void o.offsetWidth;o.classList.add('ep-nudge');}
    if(f){f.classList.remove('ep-hint');void f.offsetWidth;f.classList.add('ep-hint');setTimeout(function(){f.classList.remove('ep-hint');},1600);}
    if(navigator.vibrate)navigator.vibrate(18);
  }catch(e){}
};

;

(function(){
  var orig=window.buildDashboardV2;
  if(typeof orig!=='function')return;
  window.buildDashboardV2=function(a){
    var html=orig.apply(this,arguments);
    try{
      var t=document.createElement('template');t.innerHTML=html;var r=t.content;
      var rm=function(sel){r.querySelectorAll(sel).forEach(function(n){n.remove();});};
      // 1. Duplicates of the Today card: study plan, personalised next step, resume sentence in hero
      rm('.study-plan-heading,.study-plan-progress,.study-plan-card,.study-recommendation');
      var sub=r.querySelector('.dv2-sub');
      if(sub)sub.innerHTML=sub.innerHTML.replace(/\s*Pick up <b>[\s\S]*?<\/b> where you left off\./,'');
      // 2. No real practice data yet: collapse empty stats / subjects / week chart into one prompt
      var has=a&&((a.totalSolved||0)>0||(a.attemptsArr&&a.attemptsArr.length>0));
      if(!has){
        var stats=r.querySelector('.dv2-stats');
        var card=document.createElement('section');
        card.className='dv2-card ep-start';
        card.innerHTML='<span class="ep-start-ic"><i class="fa-solid fa-chart-line"></i></span><div style="flex:1;min-width:0"><b>Your stats start here</b><small>Finish one practice set to see accuracy, streak and subject progress.</small></div><button type="button" class="dv2-btn dv2-btn-main" onclick="switchTab(\'learn\')"><i class="fa-solid fa-bolt"></i> Start practice</button>';
        if(stats)stats.replaceWith(card);else{var tc=r.querySelector('.tc-card');if(tc)tc.after(card);}
        rm('.study-section-head,.study-subject-grid');
        r.querySelectorAll('.dv2-bars').forEach(function(b){var s=b.closest('section');if(s)s.remove();});
      }
      html=t.innerHTML;
    }catch(e){console.warn('today cleanup',e);}
    return html;
  };
})();

;

(function(){
  var SVG='<svg class="ep-ti" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="3.5" width="15" height="17" rx="3.5"/><path d="M8 9h4"/><path d="M7.5 16l2.4-2.8 2 1.7 4.1-4.9"/></svg>';
  function swap(){
    document.querySelectorAll('.bn-item[data-tab="mock"] > i, #nav-mock > i').forEach(function(i){
      var t=document.createElement('span');t.innerHTML=SVG;i.replaceWith(t.firstChild);
    });
  }
  swap();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',swap);
  var nav=document.getElementById('bottom-nav');
  if(window.MutationObserver&&nav)new MutationObserver(swap).observe(nav,{childList:true,subtree:true});
})();

;

(function(){
  var KEY='ep_ai_fab_pos',M=8,TH=6;
  function init(){
    var w=document.getElementById('ai-chatbot-widget'),b=document.getElementById('ai-chat-toggle-btn');
    if(!w||!b||w.dataset.drag)return;w.dataset.drag='1';
    function clamp(x,y){var W=w.offsetWidth||60,H=w.offsetHeight||60;return[Math.max(M,Math.min(innerWidth-W-M,x)),Math.max(M,Math.min(innerHeight-H-M,y))];}
    function place(x,y,save){
      var c=clamp(x,y);w.style.setProperty('right','auto','important');w.style.setProperty('bottom','auto','important');w.style.left=c[0]+'px';w.style.top=c[1]+'px';
      w.classList.toggle('ep-fab-left',c[0]+30<innerWidth/2);w.classList.toggle('ep-fab-top',c[1]+30<innerHeight/2);
      if(save){try{localStorage.setItem(KEY,JSON.stringify({sx:c[0]+30<innerWidth/2?'l':'r',y:c[1]/innerHeight}));}catch(e){}}
    }
    function restore(){
      try{var p=JSON.parse(localStorage.getItem(KEY)||'null');if(!p)return;
        var W=w.offsetWidth||60;place(p.sx==='l'?M:innerWidth-W-M,p.y*innerHeight,false);}catch(e){}
    }
    var sx,sy,ox,oy,moved=false,id=null;
    b.addEventListener('pointerdown',function(e){
      if(e.button>0)return;var r=w.getBoundingClientRect();sx=e.clientX;sy=e.clientY;ox=r.left;oy=r.top;moved=false;id=e.pointerId;
      try{b.setPointerCapture(id);}catch(_){}
    });
    b.addEventListener('pointermove',function(e){
      if(id!==e.pointerId)return;var dx=e.clientX-sx,dy=e.clientY-sy;
      if(!moved&&Math.hypot(dx,dy)<TH)return;
      if(!moved){moved=true;w.classList.add('ep-dragging');}
      place(ox+dx,oy+dy,false);
    });
    function end(e){
      if(id!==e.pointerId)return;id=null;w.classList.remove('ep-dragging');
      if(moved){var r=w.getBoundingClientRect(),W=w.offsetWidth||60;place(r.left+W/2<innerWidth/2?M:innerWidth-W-M,r.top,true);}
    }
    b.addEventListener('pointerup',end);b.addEventListener('pointercancel',end);
    b.addEventListener('click',function(e){if(moved){e.stopImmediatePropagation();e.preventDefault();moved=false;}},true);
    window.addEventListener('resize',function(){if(w.style.left){var r=w.getBoundingClientRect();place(r.left,r.top,false);}});
    restore();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

;

(function(){
  function sync(){
    var on=!!document.getElementById('ep-focus'),b=document.getElementById('bn-focus');if(!b)return;
    b.classList.toggle('active',on);
    if(on){var c=document.querySelector('.bn-item[data-tab="campus"]');if(c)c.classList.remove('active');}
  }
  window.epOpenFocus=function(v){
    try{
      if(window.epFocusShow){if(typeof v==='string')window.epFocusShow(v);else if(!document.getElementById('ep-focus'))window.epFocusShow('home')}
      if(document.getElementById('ep-focus')){sync();return;}
      switchTab('focus');
      setTimeout(sync,100);
    }catch(e){console.warn('epOpenFocus',e);}
  };
  /* Focus is its own page: renderView draws it when the current tab is 'focus' */
  (function(){
    var rv=window.renderView;
    if(typeof rv!=='function')return;
    window.renderView=function(){
      var main=document.getElementById('main-container');
      if(main&&typeof currentTab!=='undefined'&&currentTab==='tools'){currentTab='focus';if(window.epFocusShow)window.epFocusShow('td')}
      if(main&&typeof currentTab!=='undefined'&&currentTab==='focus'){
        try{updateGlobalProgress()}catch(e){}
        main.innerHTML='<div id="ep-focus"></div>';
        if(window.epFocusRender)window.epFocusRender();
        return;
      }
      return rv.apply(this,arguments);
    };
  })();
  /* the old Planner page is part of Focus now */
  (function(){var sw=window.switchTab;if(typeof sw!=='function')return;window.switchTab=function(t){if(t==='tools')return window.epOpenFocus('td');return sw.apply(this,arguments)}})();
  setInterval(sync,500);
})();

;

(function(){
'use strict';
var prev=window.buildDashboardV2;
if(typeof prev!=='function')return;

function E(s){s=s==null?'':String(s);return s.replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function J(s){return typeof jsArg==='function'?jsArg(s):String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/</g,'&lt;')}
function S(fn,d){try{var v=fn();return v==null?d:v}catch(e){return d}}
function tr(s,n){s=String(s||'');return s.length>n?s.slice(0,n-1)+'…':s}
var TONE={prac:'#0d9488',test:'#4f46e5',plan:'#0284c7',circ:'#db2777',vault:'#d97706',ncert:'#059669',ai:'#7c3aed',rev:'#8b5cf6',warn:'#e11d48',bio:'#059669',chem:'#7c3aed',phy:'#0284c7',amber:'#f59e0b'};
function ti(k){return '--tone:'+(TONE[k]||k)}

function snapshot(){
  var goal=S(getDailyGoal,30),today=S(questionsSolvedToday,0);
  var days=S(function(){return getActivityDays(14)},[]);
  return{
    goal:goal,today:today,
    streak:S(getDayStreak,0),
    resume:S(getSavedResume,null),
    nDue:S(function(){return getDueRevisionKeys().length},0),
    nWrong:S(function(){return getSavedQuestionKeys('incorrect').length},0),
    nBook:S(function(){return getSavedQuestionKeys('bookmarked').length},0),
    weak:S(function(){return getWeakChapters(4)},[]),
    days:days,
    open:S(function(){return(typeof todos!=='undefined'&&Array.isArray(todos))?todos.filter(function(t){return t&&!t.completed}):[]},[]),
    focus:S(function(){return window.epFocusSummary&&window.epFocusSummary()},null),
    attempts:S(function(){return StorageModule.get(STORAGE_KEYS.attempts,[])},[])
  };
}
function tests(arr){return arr.filter(function(a){return a&&a.mode&&!/practice|infinite|adaptive|drill/i.test(String(a.mode))})}

/* ---------- module builders ---------- */
function mod(id,html,extra){return html?'<section class="ep-dashboard-module d5-m '+(extra||'')+'" data-ep-module="'+id+'">'+html+'</section>':''}
function head(over,title,link){return '<div class="d5-h"><div><small>'+E(over)+'</small><h3>'+E(title)+'</h3></div>'+(link?'<button type="button" class="d5-lnk" onclick="'+link[1]+'">'+E(link[0])+' <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>':'')+'</div>'}

function primaryAction(s){
  var r=s.resume,w=s.weak[0];
  if(r&&r.questions&&r.questions.length){var at=Math.min((r.currentIndex||0)+1,r.questions.length);return{icon:'fa-play',label:'Resume · Q'+at+'/'+r.questions.length,on:'resumeSavedSession()'}}
  if(s.nDue>0)return{icon:'fa-rotate',label:'Revise '+s.nDue+' due',on:"startSavedPractice('due')"};
  if(w)return{icon:'fa-crosshairs',label:'Practise '+tr(w.chapter,22),on:"openPracticeSetup('"+J(w.subject)+"','"+J(w.chapter)+"')"};
  return{icon:'fa-bolt',label:'Start practice',on:"switchTab('learn')"};
}

function heroHtml(s,x,name){
  var R=44,C=2*Math.PI*R,gp=Math.min(100,Math.round(s.today/Math.max(1,s.goal)*100)),done=s.today>=s.goal;
  var hr=new Date().getHours(),greet=hr<5?'Burning the midnight oil':hr<12?'Good morning':hr<17?'Good afternoon':'Good evening';
  var dateStr=new Date().toLocaleDateString([],{weekday:'long',day:'numeric',month:'long'});
  var left=Math.max(0,s.goal-s.today);
  var sub=done?'Daily goal done. Anything extra is a bonus.':left+' question'+(left===1?'':'s')+' to hit today\u2019s goal.';
  var p=primaryAction(s);
  return '<section class="d5-hero" aria-label="Welcome">'
   +(s.streak>0?'<div class="d5-hero-top"><button type="button" class="d5-chip" onclick="switchTab(\'progress\')" aria-label="'+s.streak+' day streak. Open progress"><i class="fa-solid fa-fire" style="color:#fcd34d" aria-hidden="true"></i> '+s.streak+'-day streak</button></div>':'')
   +'<div class="d5-hero-main"><div class="d5-hero-text"><h2>'+greet+(name?', '+E(name):', future doctor')+'.</h2><p class="d5-sub">'+sub+'</p>'
   +'<div class="d5-cta"><button type="button" class="d5-btn d5-btn-main" onclick="'+p.on+'"><i class="fa-solid '+p.icon+'" aria-hidden="true"></i><span>'+E(p.label)+'</span></button>'
   +'<button type="button" class="d5-btn d5-btn-ghost" onclick="startDashboardFocusBlock()"><i class="fa-solid fa-stopwatch" aria-hidden="true"></i><span>25-min focus</span></button></div></div>'
   +'<button type="button" class="d5-ring'+(done?' is-done':'')+'" onclick="cycleDailyGoal()" aria-label="Daily goal '+s.today+' of '+s.goal+'. Tap to change goal">'
   +'<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="'+R+'" class="bg"/><circle cx="50" cy="50" r="'+R+'" class="fg" stroke-dasharray="'+(C*gp/100).toFixed(1)+' '+C.toFixed(1)+'"/></svg>'
   +'<span class="d5-ring-l"><b>'+s.today+'</b><small>of '+s.goal+'</small></span></button></div>'
   +'<button type="button" class="d5-gen" onclick="openCustomTestBuilder()" aria-label="Create a custom test"><span class="d5-gen-ic" aria-hidden="true"><i class="fa-solid fa-wand-magic-sparkles"></i></span><span class="d5-gen-tx"><b>Create a test</b><small>Build your own NEET paper in seconds</small></span><span class="d5-gen-go">Create <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></button>'
   +x.live+'</section>';
}

function row(tone,icon,title,sub,tag,on,first,done){
  return '<button type="button" class="d5-row'+(first?' first':'')+(done?' is-done':'')+'" style="'+ti(tone)+'" onclick="'+on+'">'
   +'<span class="d5-ri"><i class="fa-solid '+(done?'fa-check':icon)+'" aria-hidden="true"></i></span>'
   +'<span class="d5-rt"><b>'+title+'</b><small>'+sub+'</small></span>'
   +'<span class="d5-tag">'+E(tag)+'</span><i class="fa-solid fa-chevron-right d5-go" aria-hidden="true"></i></button>';
}
function planHtml(s){
  var rows=[],r=s.resume,w=s.weak[0],left=Math.max(0,s.goal-s.today);
  if(r&&r.questions&&r.questions.length)rows.push(row('prac','fa-play','Resume '+E(tr(r.title||r.chapter||'your practice',34)),'Question '+Math.min(r.questions.length,(r.currentIndex||0)+1)+' of '+r.questions.length,'Practice','resumeSavedSession()'));
  if(s.nDue>0)rows.push(row('rev','fa-rotate','Revise '+s.nDue+' due question'+(s.nDue===1?'':'s'),'About '+Math.max(2,Math.ceil(s.nDue/3))+' min \u00b7 spaced repetition','Revise',"startSavedPractice('due')"));
  if(w)rows.push(row('warn','fa-crosshairs','Fix '+E(tr(w.chapter,30)),E(w.subject)+' \u00b7 '+w.avg+'% accuracy','Practice',"openPracticeSetup('"+J(w.subject)+"','"+J(w.chapter)+"')"));
  else if(s.nWrong>0)rows.push(row('warn','fa-lightbulb','Learn from your mistakes',s.nWrong+' question'+(s.nWrong===1?'':'s')+' in your incorrect set','Mistakes',"startSavedPractice('incorrect')"));
  rows.push(row('prac','fa-bullseye',s.today>=s.goal?'Daily goal reached':'Solve '+left+' more question'+(left===1?'':'s'),s.today+' of '+s.goal+' done today','Practice',"switchTab('learn')",false,s.today>=s.goal));
  if(s.focus&&s.focus.title)rows.push(row('plan','fa-stopwatch',E(tr(s.focus.title,34)),E(tr(s.focus.line||'',44)),'Focus','epOpenFocus()'));
  else if(s.open.length)rows.push(row('plan','fa-list-check',s.open.length+' planner task'+(s.open.length===1?'':'s'),E(tr(s.open[0].title||'',44)),'Planner',"epOpenFocus('td')"));
  rows=rows.slice(0,3);
  rows[0]=rows[0].replace('class="d5-row','class="d5-row first');
  var gp=Math.min(100,Math.round(s.today/Math.max(1,s.goal)*100));
  return head('Do this next','Today\u2019s plan',['Planner',"epOpenFocus('td')"])
   +'<div class="d5-meter" role="progressbar" aria-label="Daily goal progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+gp+'"><i style="width:'+gp+'%"></i></div>'
   +'<div class="d5-rows">'+rows.join('')+'</div>';
}

function statsHtml(a,s){
  var att=a.attemptsArr||[];
  var prevAcc=att.length>1?Math.round(att.slice(0,-1).reduce(function(n,x){return n+(x.accuracy||0)},0)/(att.length-1)):a.avgAccuracy;
  var d=(a.avgAccuracy||0)-prevAcc;
  function st(tone,icon,label,val,hint,on,cls){return '<button type="button" class="d5-stat" style="'+ti(tone)+'" onclick="'+on+'"><span class="d5-ri"><i class="fa-solid '+icon+'" aria-hidden="true"></i></span><b>'+val+'</b><small>'+label+'</small><em class="'+(cls||'')+'">'+hint+'</em><i class="fa-solid fa-arrow-up-right-from-square d5-arr" aria-hidden="true"></i></button>'}
  return '<div class="d5-stats" role="group" aria-label="Study snapshot">'
   +st('bio','fa-bullseye','Accuracy',(a.avgAccuracy||0)+'%',(d>=0?'+':'')+d+' pts vs earlier',"switchTab('progress')",d>0?'up':d<0?'down':'')
   +st('prac','fa-circle-check','Attempted',a.totalSolved||0,'Practice and tests',"switchTab('progress')")
   +st('amber','fa-fire','Streak',s.streak+' day'+(s.streak===1?'':'s'),'Best '+((a.streak&&a.streak.best)||s.streak),"switchTab('progress')")
   +st('rev','fa-rotate','Revision due',s.nDue,s.nWrong+' missed overall',s.nDue?"startSavedPractice('due')":"switchTab('learn')")
   +'</div>';
}
function startHtml(){
  function stp(tone,n,t,sm,on){return '<button type="button" class="d5-step" style="'+ti(tone)+'" onclick="'+on+'"><span class="n">'+n+'</span><span class="t"><b>'+t+'</b><br><small>'+sm+'</small></span></button>'}
  return '<div class="d5-card d5-start"><h3>Your stats start here</h3><p>Finish one practice set and this page fills with accuracy, streak and weak chapters. Three ways in:</p><div class="d5-steps">'
   +stp('prac',1,'Practise a chapter','Short sets, instant feedback',"switchTab('learn')")
   +stp('test',2,'Take a timed test','NTA-pattern papers',"switchTab('mock')")
   +stp('plan',3,'Plan your week','Tasks, timetable, focus',"epOpenFocus('td')")
   +'</div></div>';
}

function nextBest(a,s,hasData){
  var t=tests(s.attempts);
  if(hasData&&(a.totalSolved||0)>=30&&!t.length)return{tone:'test',icon:'fa-file-pen',over:'Next best step',title:'Try your first timed test',sub:'You have solved '+a.totalSolved+' questions. A paper shows how you handle exam pressure.',on:"switchTab('mock')"};
  if(s.nBook>0&&!s.nDue)return{tone:'vault',icon:'fa-bookmark',over:'Next best step',title:'Revisit '+s.nBook+' bookmarked question'+(s.nBook===1?'':'s'),sub:'Questions you saved for later.',on:"startSavedPractice('bookmarked')"};
  if(!s.open.length&&hasData)return{tone:'plan',icon:'fa-calendar-check',over:'Next best step',title:'Plan tomorrow in two minutes',sub:'Add tasks or a timetable so the next session starts without thinking.',on:"epOpenFocus('td')"};
  return null;
}
function nextHtml(n){return n?'<button type="button" class="d5-next" style="'+ti(n.tone)+'" onclick="'+n.on+'"><span class="d5-ri"><i class="fa-solid '+n.icon+'" aria-hidden="true"></i></span><span><small>'+n.over+'</small><b>'+E(n.title)+'</b><span class="s">'+E(n.sub)+'</span></span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>':''}

function subjectsHtml(a,hasData){
  var meta={Biology:['bio','fa-dna'],Chemistry:['chem','fa-flask'],Physics:['phy','fa-atom']};
  var att=a.attemptsArr||[];
  var cards=Object.keys(data).map(function(n){
    var total=data[n].length,done=data[n].filter(function(c){return userProgress[c]&&userProgress[c].completed}).length,sp=total?Math.round(done/total*100):0;
    var rows=att.filter(function(x){return x.subject===n}),acc=rows.length?Math.round(rows.reduce(function(m,x){return m+(x.accuracy||0)},0)/rows.length):null;
    var m=meta[n]||['prac','fa-book'],n2=rows.reduce(function(q,x){return q+(x.attempted||0)},0);
    return '<button type="button" class="d5-sub-c" style="'+ti(m[0])+'" onclick="setSubject(\''+J(n)+'\');switchTab(\'learn\')">'
     +'<span class="d5-ri"><i class="fa-solid '+m[1]+'" aria-hidden="true"></i></span><span class="t"><b>'+E(n)+'</b><small>'+done+'/'+total+' chapters</small></span>'
     +'<span class="sc"><b>'+(acc==null?'\u2014':acc+'%')+'</b><small>accuracy</small></span>'
     +'<span class="bar"><i style="width:'+sp+'%"></i></span>'
     +'<span class="ft"><span>'+(hasData?n2+' attempted':'Not started')+'</span><b>Practise <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></b></span></button>';
  }).join('');
  return head('Your preparation','Subjects',['All chapters',"switchTab('learn')"])+'<div class="d5-subs">'+cards+'</div>';
}

function activityHtml(s){
  var days=s.days.slice(-7),prevW=s.days.slice(0,7).reduce(function(n,d){return n+d.count},0),week=days.reduce(function(n,d){return n+d.count},0);
  var max=Math.max(s.goal,Math.max.apply(null,days.map(function(d){return d.count}).concat([1])));
  var diff=week-prevW,cls=diff>0?'up':diff<0?'down':'';
  var bars=days.map(function(d){return '<div class="d5-bar'+(d.today?' on':'')+'" title="'+d.count+' solved"><span>'+(d.count||'')+'</span><div><i style="height:'+(d.count?Math.max(8,Math.round(d.count/max*100)):0)+'%"></i></div><em>'+E(d.label)+'</em></div>'}).join('');
  return head('Consistency','This week',['Full report',"switchTab('progress')"])
   +'<div class="d5-card"><div class="d5-wk-sum"><b>'+week+'</b><small>solved</small>'+(prevW||week?'<small class="'+cls+'">'+(diff>=0?'+':'')+diff+' vs last week</small>':'')+'</div><div class="d5-bars">'+bars+'</div></div>';
}

function weakHtml(s){
  var list=s.weak.map(function(w){var c=w.avg<50?'#e11d48':w.avg<70?'#f59e0b':'#059669';
    return '<button type="button" class="d5-weak" style="--c:'+c+'" onclick="openPracticeSetup(\''+J(w.subject)+'\',\''+J(w.chapter)+'\')"><span class="d5-wp">'+w.avg+'%</span><span class="d5-rt"><b>'+E(w.chapter)+'</b><small>'+E(w.subject)+' \u00b7 '+w.acc.length+' attempt'+(w.acc.length===1?'':'s')+'</small></span><i class="fa-solid fa-chevron-right d5-go" aria-hidden="true"></i></button>'}).join('');
  return head('Lowest accuracy first','Needs work',['Analysis',"switchTab('progress')"])
   +'<div class="d5-card">'+(list||'<p class="d5-empty">Finish a few sessions and your weakest chapters will appear here, ready to practise in one tap.</p>')
   +'<div class="d5-foot">'+(s.nWrong?'<button type="button" class="d5-pillbtn" onclick="startSavedPractice(\'incorrect\')"><i class="fa-solid fa-circle-xmark" aria-hidden="true"></i> Mistakes ('+s.nWrong+')</button>':'')
   +'<button type="button" class="d5-pillbtn" onclick="switchTab(\'mock\')"><i class="fa-solid fa-file-pen" aria-hidden="true"></i> Test yourself</button></div></div>';
}

function hubHtml(s){
  function c(tone,icon,t,sm,on,badge){return '<button type="button" class="d5-go-c" style="'+ti(tone)+'" onclick="'+on+'">'+(badge?'<span class="bd">'+badge+'</span>':'')+'<span class="d5-ri"><i class="fa-solid '+icon+'" aria-hidden="true"></i></span><span><b>'+t+'</b><small>'+sm+'</small></span></button>'}
  return head('Jump to','Everything in EduPulse')
   +'<div class="d5-hub">'
   +c('prac','fa-bolt','Practice','Chapters, PYQs, drills',"switchTab('learn')",s.nDue||'')
   +c('test','fa-desktop','Tests','Series, scheduled, 180Q builder',"switchTab('mock')",'')
   +c('plan','fa-list-check','Planner','Daily study tasks',"epOpenFocus('td')",s.open.length||'')
   +c('circ','fa-circle-nodes','Circles','Daily 10, doubts, study squad',"switchTab('campus')",'')
   +c('ncert','fa-book-open','NCERT Reader','Read key extracts',"epOpenNcert()",'')
   +c('vault','fa-book-bookmark','Resource Vault','Notes, links, PYQs',"switchTab('directory')",'')
   +c('rev','fa-clone','Flashcards','Quick recall decks',"window.epFlashOpen?epFlashOpen('',''):switchTab('learn')",'')
   +c('ai','fa-robot','Ask Pulse AI','Doubts, MCQs, mnemonics',"toggleAiChatbotWindow()",'')
   +'</div>';
}

function setsHtml(s){
  function t(tone,icon,l,n,kind){return '<button type="button" class="d5-set" style="'+ti(tone)+'" '+(n?'onclick="startSavedPractice(\''+kind+'\')"':'disabled')+'><span class="d5-ri" style="width:30px;height:30px"><i class="fa-solid '+icon+'" aria-hidden="true"></i></span><b>'+n+'</b><small>'+l+'</small></button>'}
  return head('Saved','Question sets')+'<div class="d5-card"><div class="d5-sets">'+t('warn','fa-circle-xmark','Incorrect',s.nWrong,'incorrect')+t('vault','fa-bookmark','Bookmarked',s.nBook,'bookmarked')+t('rev','fa-brain','Due',s.nDue,'due')+'</div></div>';
}
function chapHtml(){
  var meta={Biology:'bio',Chemistry:'chem',Physics:'phy'};
  var rows=Object.keys(data).map(function(n){var t=data[n].length,d=data[n].filter(function(c){return userProgress[c]&&userProgress[c].completed}).length,p=t?Math.round(d/t*100):0;
    return '<button type="button" style="'+ti(meta[n]||'prac')+'" onclick="setSubject(\''+J(n)+'\');switchTab(\'learn\')"><span>'+E(n)+'</span><span class="bar"><i style="width:'+p+'%"></i></span><span>'+d+'/'+t+'</span></button>'}).join('');
  return head('NCERT','Chapter completion',['Open Practice',"switchTab('learn')"])+'<div class="d5-card"><div class="d5-chap">'+rows+'</div></div>';
}

/* ---------- builder ---------- */
window.buildDashboardV2=function(a){
  a=a||{};
  var tpl=document.createElement('template');
  try{tpl.innerHTML=prev.apply(this,arguments)}catch(e){console.warn('dash v5: legacy build',e)}
  var q=function(sel){var n=tpl.content.querySelector(sel);return n?n.outerHTML:''};
  var x={pill:q('.bz-pill'),live:q('.dd-live'),strip:q('.bz-strip'),campus:q('.ep-cm-dash')};
  var s=snapshot();
  var name=S(function(){var p=getAspirantProfile();var n=(p&&p.onboarded)?String(p.name||'').trim().split(/\s+/)[0]:'';return n.toLowerCase()==='aspirant'?'':n},'');
  var hasData=((a.totalSolved||0)>0)||((a.attemptsArr||[]).length>0);
  var all=false;try{all=localStorage.getItem('ep_d5_all')==='1'}catch(e){}
  var html=
    mod('hero',heroHtml(s,x,name))
   +mod('studyPlan',planHtml(s))
   +mod('stats',hasData?statsHtml(a,s):'')
   +mod('recommendation',nextHtml(nextBest(a,s,hasData)))
   +mod('subjectPerformance',subjectsHtml(a,hasData))
   +'<button type="button" class="d5-more-btn" aria-expanded="'+all+'" onclick="var r=this.closest(\'.d5\'),on=r.classList.toggle(\'d5-all\');this.setAttribute(\'aria-expanded\',on);this.firstChild.textContent=on?\'Show less\':\'More tools and insights\';try{localStorage.setItem(\'ep_d5_all\',on?\'1\':\'0\')}catch(e){}"><span>'+(all?'Show less':'More tools and insights')+'</span> <i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button>'
   +mod('activity',hasData?activityHtml(s):'','d5-extra')
   +mod('weak',hasData?weakHtml(s):'','d5-extra')
   +mod('quickStart',hubHtml(s),'d5-extra')
   +mod('campus',x.campus,'d5-extra')
   +mod('saved',setsHtml(s),'d5-extra')
   +mod('subjects',chapHtml(),'d5-extra')
   +mod('account',x.strip,'d5-extra');
  return '<div class="dv2 d5 animate-fadeIn'+(all?' d5-all':'')+'" data-d5="1">'+html+'</div>';
};

/* ---------- "Today" strip on the pages Today links to ---------- */
var STRIP_TABS={learn:1,mock:1,progress:1,tools:1,directory:1};
function ctx(tab,s){
  var w=s.weak[0];
  if(tab==='learn')return['fa-file-pen','Take a test',"switchTab('mock')"];
  if(tab==='mock'){
    if(s.nWrong>0)return['fa-circle-xmark','Review '+s.nWrong+' mistakes',"startSavedPractice('incorrect')"];
    return['fa-bolt','Warm up with practice',"switchTab('learn')"];
  }
  if(tab==='progress'){
    if(w)return['fa-crosshairs','Fix '+tr(w.chapter,18),"openPracticeSetup('"+J(w.subject)+"','"+J(w.chapter)+"')"];
    return['fa-bolt','Practise now',"switchTab('learn')"];
  }
  if(s.resume&&s.resume.questions&&s.resume.questions.length)return['fa-play','Resume practice','resumeSavedSession()'];
  return['fa-bolt','Start practice',"switchTab('learn')"];
}
function stripHtml(tab){
  var s={goal:S(getDailyGoal,30),today:S(questionsSolvedToday,0),streak:S(getDayStreak,0),
    nDue:S(function(){return getDueRevisionKeys().length},0),nWrong:S(function(){return getSavedQuestionKeys('incorrect').length},0),
    weak:S(function(){return getWeakChapters(1)},[]),resume:S(getSavedResume,null)};
  var gp=Math.min(100,Math.round(s.today/Math.max(1,s.goal)*100)),R=11,C=2*Math.PI*R,c=ctx(tab,s);
  return '<nav class="d5-strip" aria-label="Today summary">'
   +'<button type="button" class="home" onclick="switchTab(\'dashboard\')" aria-label="Back to Today"><i class="fa-solid fa-house" aria-hidden="true"></i><span class="l">Today</span></button>'
   +'<button type="button" class="goal" onclick="switchTab(\'dashboard\')" aria-label="Daily goal '+s.today+' of '+s.goal+'. Open Today"><span class="mini"><svg viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="'+R+'" class="bg"/><circle cx="13" cy="13" r="'+R+'" class="fg" stroke-dasharray="'+(C*gp/100).toFixed(1)+' '+C.toFixed(1)+'"/></svg><i class="fa-solid fa-bullseye" aria-hidden="true"></i></span><span>'+s.today+'/'+s.goal+'</span></button>'
   +(s.streak>0?'<button type="button" class="streak fire" onclick="switchTab(\'progress\')" aria-label="'+s.streak+' day streak"><i class="fa-solid fa-fire" aria-hidden="true"></i><span>'+s.streak+'d</span></button>':'')
   +'<button type="button" class="ctx" onclick="'+c[2]+'"><i class="fa-solid '+c[0]+'" aria-hidden="true"></i><span>'+E(c[1])+'</span></button></nav>';
}
function paintStrip(){
  var main=document.getElementById('main-container');
  if(!main)return;
  var old=main.querySelector(':scope > .d5-strip');if(old)old.remove();
  if(typeof currentTab==='undefined'||!STRIP_TABS[currentTab])return;
  var h=document.createElement('div');h.innerHTML=stripHtml(currentTab);
  if(h.firstElementChild)main.insertBefore(h.firstElementChild,main.firstChild);
}
var rv=window.renderView;
if(typeof rv==='function'){
  window.renderView=function(){var r=rv.apply(this,arguments);try{paintStrip()}catch(e){console.warn('dash v5: strip',e)}return r};
}
})();

