
(function(){
'use strict';
var DATA=null,cur={b:'plant-kingdom',idx:0,hl:-1,q:'',matchIndex:0},lastFocus=null,STORE='edupulse_ncert_reader_v1';
function esc(s){return String(s==null?'':s).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];});}
function load(){if(DATA)return Promise.resolve(DATA);return fetch('/ncert/ncert-index.json',{cache:'force-cache'}).then(function(r){if(!r.ok)throw new Error('Chapter list unavailable');return r.json();}).then(function(index){return Promise.all((index.chapters||[]).map(function(item){return fetch('/ncert/'+encodeURIComponent(item.file),{cache:'force-cache'}).then(function(r){if(!r.ok)throw new Error('Chapter unavailable');return r.json();}).then(function(book){return [item.id,book];});})).then(function(entries){DATA=Object.fromEntries(entries);if(!Object.keys(DATA).length)throw new Error('No chapters are available');return DATA;});});}
function getBook(){return DATA&&DATA[cur.b];}
function getSentences(book){return (book.pages||[]).map(function(page){return (page.blocks||[]).flatMap(function(block){return block.sentences||[];});});}
function searchPages(){var book=getBook(),q=cur.q.trim().toLowerCase();if(!book||!q)return [];return getSentences(book).map(function(sentences,i){return sentences.some(function(s){return String(s.text||'').toLowerCase().includes(q);})?i:-1;}).filter(function(i){return i>=0;});}
function safeText(text){var html=esc(text),q=cur.q.trim();if(!q)return html;try{return html.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),'<mark class="ep-search">$&</mark>');}catch(e){return html;}}
function sentenceHtml(sentence,index){var html=safeText(sentence.text||'');return index===cur.hl?'<mark class="ep-hl">'+html+'</mark>':sentence.hl?'<mark class="ep-hl">'+html+'</mark>':html;}
function saveLocation(){try{localStorage.setItem(STORE,JSON.stringify({book:cur.b,page:cur.idx}));}catch(e){}}
function fillBooks(){var sel=document.getElementById('epn-book');sel.innerHTML=Object.keys(DATA).map(function(k){return '<option value="'+esc(k)+'">'+esc(DATA[k].title)+'</option>';}).join('');sel.value=cur.b;}
function render(){var book=getBook();if(!book)return;var page=book.pages[cur.idx],body=document.getElementById('epn-body'),sentenceIndex=0;
 document.getElementById('epn-title').textContent='NCERT Biology · '+book.title;
 document.getElementById('epn-pg').textContent='Page '+page.pg+' ('+(cur.idx+1)+'/'+book.pages.length+')';
 document.getElementById('epn-status').textContent='Selected text extract · '+(book.counts&&book.counts.pages||book.pages.length)+' pages indexed in this chapter';
 var pct=Math.round((cur.idx+1)/book.pages.length*100),bar=document.getElementById('epn-progress-bar'),progress=document.getElementById('epn-progress');bar.style.width=pct+'%';progress.setAttribute('aria-valuenow',String(pct));
 var content=(page.blocks||[]).map(function(block){if(block.type==='heading')return '<h3>'+safeText(block.text||'')+'</h3>';var sentences=block.sentences||[];if(!sentences.length)return '';return '<p>'+sentences.map(function(sentence){var html=sentenceHtml(sentence,sentenceIndex++);return html;}).join(' ')+'</p>';}).join('');
 body.innerHTML=content||'<p>This page has no readable text in the current extract.</p>';
 var matches=searchPages(),counter=document.getElementById('epn-match-count');counter.textContent=cur.q.trim()?(matches.length?((matches.indexOf(cur.idx)+1)+'/'+matches.length):'0 matches'):'';
 document.getElementById('epn-find-prev').disabled=!matches.length;document.getElementById('epn-find-next').disabled=!matches.length;
 document.getElementById('epn-prev').disabled=cur.idx===0;document.getElementById('epn-next').disabled=cur.idx===book.pages.length-1;
 document.getElementById('epn-practice').onclick=function(){if(typeof openPracticeSetup==='function')openPracticeSetup('Biology',book.title);};
 saveLocation();
}
function moveMatch(delta){var matches=searchPages();if(!matches.length)return;var current=matches.indexOf(cur.idx);cur.matchIndex=(current<0?0:(current+delta+matches.length)%matches.length);cur.idx=matches[cur.matchIndex];cur.hl=-1;render();}
window.epOpenNcert=function(b,pg,i){var box=document.getElementById('ep-ncert');lastFocus=document.activeElement;box.classList.add('on');if(typeof toggleMobileNav==='function'){try{toggleMobileNav(false);}catch(e){}}document.getElementById('epn-body').textContent='Loading chapter extracts…';document.getElementById('epn-close').focus();load().then(function(){var saved={};try{saved=JSON.parse(localStorage.getItem(STORE)||'{}')||{};}catch(e){}var requested=b==='PK'?'plant-kingdom':b;cur.b=DATA[requested]?requested:(DATA[saved.book]?saved.book:Object.keys(DATA)[0]);fillBooks();cur.q='';document.getElementById('epn-search').value='';var pages=DATA[cur.b].pages||[],target=pg!=null?pages.findIndex(function(p){return p.pg===Number(pg);}):-1;cur.idx=target>=0?target:(b&&DATA[requested]?0:Math.min(Number(saved.page)||0,pages.length-1));cur.hl=i==null?-1:Number(i);render();}).catch(function(){document.getElementById('epn-body').innerHTML='<p>NCERT chapter extracts could not be loaded. Check your connection and try again.</p>';});};
window.epCloseNcert=function(){document.getElementById('ep-ncert').classList.remove('on');if(lastFocus&&lastFocus.isConnected)lastFocus.focus();};
document.getElementById('epn-book').addEventListener('change',function(e){cur.b=e.target.value;cur.idx=0;cur.hl=-1;cur.q='';document.getElementById('epn-search').value='';render();});
document.getElementById('epn-search').addEventListener('input',function(e){cur.q=e.target.value;cur.matchIndex=0;var matches=searchPages();if(matches.length)cur.idx=matches[0];cur.hl=-1;render();});
document.getElementById('epn-find-prev').onclick=function(){moveMatch(-1);};document.getElementById('epn-find-next').onclick=function(){moveMatch(1);};
document.getElementById('epn-prev').onclick=function(){if(cur.idx>0){cur.idx--;cur.hl=-1;render();}};document.getElementById('epn-next').onclick=function(){var book=getBook();if(book&&cur.idx<book.pages.length-1){cur.idx++;cur.hl=-1;render();}};
document.getElementById('epn-close').onclick=window.epCloseNcert;
document.addEventListener('keydown',function(e){var box=document.getElementById('ep-ncert');if(!box.classList.contains('on'))return;if(e.key==='Escape'){e.stopPropagation();window.epCloseNcert();}if(e.key==='Tab'){var focusable=Array.from(box.querySelectorAll('button:not(:disabled),a[href],input,select')).filter(function(el){return el.offsetParent!==null;});if(!focusable.length)return;var first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}},true);
document.getElementById('ep-ncert').addEventListener('click',function(e){if(e.target.id==='ep-ncert')window.epCloseNcert();});
})();

;

(function(){'use strict';
var L=window.localStorage,H=document.documentElement;
function g(k,d){try{var v=L.getItem(k);return v==null?d:v}catch(e){return d}}
function st(k,v){try{L.setItem(k,v)}catch(e){}}
function toast(m){try{showToast(m,'info')}catch(e){}}
function curFs(){return Math.min(1.5,Math.max(.85,parseFloat(g('edupulse_fs','1'))||1))}
var fs=curFs();function applyFs(save){H.style.setProperty('--ep-fs',fs);if(save)st('edupulse_fs',fs)}applyFs();
function flag(k,on){H.classList.toggle(k,on);st(k,on?'1':'0')}
['ep50_cb','ep50_rm'].forEach(function(k){H.classList.toggle(k,g(k)==='1')});
function el(t,a,h){var e=document.createElement(t);for(var k in a)e.setAttribute(k,a[k]);if(h!=null)e.innerHTML=h;return e}
var strip=el('div',{id:'ep50-strip'},'<i></i>'),tm=el('div',{id:'ep50-tm'}),off=el('div',{id:'ep50-off'},'Offline - saved progress still works'),fab=el('button',{id:'ep50-fab','aria-label':'Tools'},'&#9881;'),menu=el('div',{id:'ep50-menu'});
var items=[['A- Smaller text',function(){fs=Math.max(.85,+(curFs()-.08).toFixed(2));applyFs(1)}],['A+ Larger text',function(){fs=Math.min(1.5,+(curFs()+.08).toFixed(2));applyFs(1)}],['Text size: back to Medium',function(){fs=1;applyFs(1)}],['Colour-blind safe colours',function(){flag('ep50_cb',!H.classList.contains('ep50_cb'))}],['Reduce motion',function(){flag('ep50_rm',!H.classList.contains('ep50_rm'))}],
['Focus mode',function(){window._ep50f=!window._ep50f;try{toggleFullScreenMode(window._ep50f)}catch(e){}}],
['Flag this question',function(){var q=quizState.questions&&quizState.questions[quizState.currentIndex];if(!q)return toast('Open a question first');var a=JSON.parse(g('ep50_flags','[]'));a.push({k:q.qKey,q:String(q.question).slice(0,120),t:Date.now()});st('ep50_flags',JSON.stringify(a));toast('Flagged for review')}],
['Export progress',function(){var o={};for(var i=0;i<L.length;i++){var k=L.key(i);o[k]=L.getItem(k)}var a=el('a',{href:URL.createObjectURL(new Blob([JSON.stringify(o)],{type:'application/json'})),download:'edupulse-backup.json'});a.click()}],
['Import progress',function(){var f=el('input',{type:'file',accept:'application/json'});f.onchange=function(){f.files[0].text().then(function(t){var o=JSON.parse(t);Object.keys(o).forEach(function(k){st(k,o[k])});location.reload()}).catch(function(){toast('Invalid backup file')})};f.click()}],
['Report a problem (copy info)',function(){var t=JSON.stringify({d:window.EP_DIAGNOSTICS,ua:navigator.userAgent,flags:g('ep50_flags','[]')},null,1);(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){toast('Diagnostics copied - paste it to the developer')}).catch(function(){toast('Could not copy')})}]];
items.forEach(function(i){var b=el('button',{type:'button'},i[0]);b.onclick=function(){i[1]();menu.style.display='none'};menu.appendChild(b)});
fab.onclick=function(){menu.style.display=menu.style.display==='flex'?'none':'flex'};
document.body.append(strip,tm,off,fab,menu);
function net(){off.style.display=navigator.onLine?'none':'block'}addEventListener('online',net);addEventListener('offline',net);net();
addEventListener('beforeunload',function(e){try{if(quizState.mode==='test'&&quizState.testEndTimestamp&&Date.now()<quizState.testEndTimestamp){e.preventDefault();e.returnValue=''}}catch(x){}});
document.addEventListener('click',function(e){var r=e.target.closest&&e.target.closest('[role=radio]');if(r){setTimeout(function(){if(!navigator.vibrate)return;navigator.vibrate(r.classList.contains('border-emerald-500')?20:[40,40,40])},80)}
var im=e.target.closest&&e.target.closest('.quiz-session-layout img');if(im){var z=el('div',{id:'ep50-zoom'},'<img src="'+im.src+'">');z.onclick=function(){z.remove()};document.body.appendChild(z)}});
var busy=false;function tick(){busy=false;try{
var Q=quizState.questions||[],lay=document.querySelector('.quiz-session-layout');
strip.style.display=tm.style.display='none';fab.style.display=lay?'none':'block';if(lay)menu.style.display='none';
if(lay&&Q.length){strip.firstChild.style.width=((quizState.currentIndex+1)/Q.length*100)+'%';
var c=lay.querySelector('.select-none'),q=Q[quizState.currentIndex];
if(c&&q&&!c.querySelector('.ep-why[data-k="'+q.qKey+'"]')){var o=c.querySelector('.ep-why');if(o)o.remove();var tags=[].concat(q.exam?[q.exam]:[],q.why||[]);if(tags.length)c.insertBefore(el('div',{'class':'ep-why','data-k':q.qKey},tags.map(function(t){return '<b>'+escapeHtml(t)+'</b>'}).join('')),c.firstChild)}
var w=document.createTreeWalker(lay,NodeFilter.SHOW_TEXT),n,hit=[];while(n=w.nextNode()){if(n.nodeValue.indexOf('**')>-1&&!/SCRIPT|STYLE|TEXTAREA/.test(n.parentNode.nodeName))hit.push(n)}
hit.forEach(function(n){var sp=el('span',{},escapeHtml(n.nodeValue).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>'));n.parentNode.replaceChild(sp,n)});
lay.querySelectorAll('button[aria-label]:not([title])').forEach(function(b){b.title=b.getAttribute('aria-label')})}
}catch(e){}}
new MutationObserver(function(){if(!busy){busy=true;requestAnimationFrame(tick)}}).observe(document.body,{childList:true,subtree:true});
setInterval(function(){try{if(quizState.questionStartTimer&&strip.style.display==='block')tm.textContent=Math.round((Date.now()-quizState.questionStartTimer)/1000)+'s'}catch(e){}},1000);
})();

;

(function(){'use strict';
var L=localStorage;function g(k){try{return L.getItem(k)}catch(e){return null}}
var _ap=window.epApplyScope;
window.epApplyScope=function(){var r=_ap.apply(this,arguments);if(g('ep51_pyq1')==='1'&&Array.isArray(r))r=r.map(function(q,i){return[q,i]}).sort(function(a,b){var x=(a[0].exam||a[0].year)?0:1,y=(b[0].exam||b[0].year)?0:1;return x-y||a[1]-b[1]}).map(function(z){return z[0]});return r};
function day(i){return new Date(Date.now()-i*864e5).toISOString().slice(0,10)}
function dash(){return;
try{var cnt=(StorageModule.get(STORAGE_KEYS.streak,{dailyCounts:{}}).dailyCounts)||{},qs=StorageModule.get(STORAGE_KEYS.qstats,{});
var wk=0,pw=0,i;for(i=0;i<7;i++){wk+=cnt[day(i)]||0;pw+=cnt[day(i+7)]||0}
var se=0,co=0;Object.keys(qs).forEach(function(k){se+=qs[k].seen||0;co+=qs[k].correct||0});var acc=se?Math.round(Math.min(co,se)/se*100):0;
var hm='';for(i=27;i>=0;i--){var n=cnt[day(i)]||0;hm+='<i title="'+day(i)+': '+n+'" style="'+(n?'background:rgba(13,148,136,'+Math.min(1,.25+n/40)+')':'')+'"></i>'}
var ex=g('ep51_exam'),dd=ex?Math.ceil((new Date(ex)-Date.now())/864e5):null;
var due=getDueRevisionKeys().length,wr=getSavedQuestionKeys('incorrect').length,left=Math.max(0,getDailyGoal()-questionsSolvedToday());
var c=document.createElement('section');c.id='ep51-dash';c.className='ep51-c';
c.innerHTML='<div><h4>NEET countdown</h4>'+(dd!=null&&dd>=0?'<b style="font-size:28px">'+dd+'</b> <small>days to go</small>':'<small>No exam date set</small>')+'<button type="button" onclick="epSetExamDate()">Set exam date</button></div>'+
'<div><h4>Today\'s plan</h4><button type="button" onclick="switchTab(\'learn\')">Solve '+left+' more to hit your goal</button><button type="button" onclick="switchTab(\'learn\')">Revise '+due+' due question'+(due===1?'':'s')+'</button><button type="button" onclick="switchTab(\'learn\')">Redo '+wr+' wrong question'+(wr===1?'':'s')+'</button></div>'+
'<div><h4>Weekly report</h4><b style="font-size:22px">'+wk+'</b> <small>questions this week ('+(wk>=pw?'+':'')+(wk-pw)+' vs last week)</small><br><small>Overall accuracy '+acc+'%</small></div>'+
'<div><h4>Last 28 days</h4><div class="ep51-hm">'+hm+'</div></div>';
h.parentNode.insertBefore(c,h.nextSibling)}catch(e){}}
function conf(){var c=document.querySelector('.quiz-session-layout .select-none'),q=quizState.questions&&quizState.questions[quizState.currentIndex];if(!c||!q||c.querySelector('.ep51-cf[data-k="'+q.qKey+'"]'))return;
var o=c.querySelector('.ep51-cf');if(o)o.remove();var m={};try{m=JSON.parse(g('ep51_conf')||'{}')}catch(e){}
var d=document.createElement('div');d.className='ep51-cf';d.dataset.k=q.qKey;
[['sure','Sure'],['guess','Guess'],['no','No idea']].forEach(function(x){var b=document.createElement('button');b.type='button';b.textContent=x[1];if(m[q.qKey]===x[0])b.className='on';b.onclick=function(e){e.stopPropagation();m[q.qKey]=x[0];try{L.setItem('ep51_conf',JSON.stringify(m))}catch(z){}d.querySelectorAll('button').forEach(function(y){y.className=''});b.className='on'};d.appendChild(b)});c.appendChild(d)}
var busy=false;new MutationObserver(function(){if(busy)return;busy=true;requestAnimationFrame(function(){busy=false;dash();try{conf()}catch(e){}})}).observe(document.body,{childList:true,subtree:true});
setTimeout(function(){try{var n=EP_DIAGNOSTICS.contentFileCount,p=+g('ep51_cnt')||0;if(p&&n>p)showToast('New question files added to the bank','info');if(n)L.setItem('ep51_cnt',n)}catch(e){}},8000);
})();

;

(function(){'use strict';
var L=localStorage,H=document.documentElement;
function G(k,d){try{var v=JSON.parse(L.getItem(k));return v==null?d:v}catch(e){return d}}function S(k,v){try{L.setItem(k,JSON.stringify(v))}catch(e){}}
function E(t,a,h){var e=document.createElement(t);for(var k in a)e.setAttribute(k,a[k]);if(h!=null)e.innerHTML=h;return e}
function T(m){try{showToast(m,'info')}catch(e){}}
function plain(x){return String(x||'').replace(/\*\*/g,'').replace(/<[^>]+>/g,'')}
function cur(){return (quizState.questions||[])[quizState.currentIndex]}
function ov(id,h){var o=document.getElementById(id);if(o)o.remove();o=E('div',{id:id,'class':'ep52-ov'},h);o.addEventListener('click',function(e){if(e.target===o)o.remove()});document.body.appendChild(o);return o}
H.classList.toggle('ep52_strip',!!G('ep52_strip',false));
window.epAddFlashcard=function(){addCard()};window.epSimilarQuestion=function(){return similar()};
function addCard(){var q=cur();if(!q)return;var c=G('ep52_cards',{});c[q.qKey]={id:q.qKey,front:plain(q.question),back:plain(q.options[q.correct])+(q.explanation?' - '+plain(q.explanation):'')};S('ep52_cards',c);T('Added to My flashcards ('+Object.keys(c).length+')')}
async function similar(){var q=cur();if(!q||quizState.mode!=='practice')return T('Similar questions work in practice mode');
var all=(await questionCache.get(quizState.subject+':'+quizState.chapter))||[],have={};quizState.questions.forEach(function(x){have[x.qKey]=1});
var st=StorageModule.get(STORAGE_KEYS.qstats,{}),pool=all.filter(function(x){return !have[x.qKey]&&x.topic===q.topic}),un=pool.filter(function(x){return !(st[x.qKey]&&st[x.qKey].seen)});pool=un.length?un:pool;
if(!pool.length)return T('No similar question left in this chapter');
quizState.questions.push(pool[Math.floor(Math.random()*pool.length)]);jumpToPracticeQuestion(quizState.questions.length-1)}
function cards(){var c=G('ep52_cards',{}),k=Object.keys(c);
var o=ov('ep52-cards','<div class="ep52-sh"><b>My flashcards ('+k.length+')</b> <small>tap a card to flip</small>'+(k.length?k.map(function(i){return '<div class="ep52-card" data-id="'+escapeHtml(i)+'"><span data-f="1">'+escapeHtml(c[i].front)+'</span><span data-b="1" style="display:none">'+escapeHtml(c[i].back)+'</span><br><button type="button" data-rm="'+escapeHtml(i)+'" style="font-size:11px;color:#f43f5e;background:none;border:0">Remove</button></div>'}).join('')+'<button type="button" id="ep52-ex" class="ep52-more">Export as flashcard deck (.json)</button>':'<p>No cards yet. Use "Add to flashcards" on a question.</p>')+'</div>');
o.addEventListener('click',function(e){var rm=e.target.closest('[data-rm]');if(rm){var m=G('ep52_cards',{});delete m[rm.dataset.rm];S('ep52_cards',m);return cards()}
if(e.target.id==='ep52-ex'){var d={title:'My flashcards',cards:Object.keys(c).map(function(i){return c[i]})};E('a',{href:URL.createObjectURL(new Blob([JSON.stringify(d)],{type:'application/json'})),download:'my-cards-flash.json'}).click();return}
var cd=e.target.closest('.ep52-card');if(cd){var f=cd.querySelector('[data-f]'),b=cd.querySelector('[data-b]'),sh=b.style.display!=='none';b.style.display=sh?'none':'';f.style.display=sh?'':'none'}})}
function sheet(){var Q=quizState.questions||[],p=quizState.mode==='practice';
var b=Q.map(function(x,i){var a=quizState.userAnswers[i],m=quizState.marked&&quizState.marked[i],c=p?(a===undefined?'':(a===x.correct?'ok':'no')):(m?'mk':(a!==undefined?'ok':''));return '<button type="button" class="'+c+(i===quizState.currentIndex?' cu':'')+'" data-i="'+i+'">'+(i+1)+'</button>'}).join('');
var o=ov('ep52-pal','<div class="ep52-sh"><b>Questions</b><div class="ep52-g">'+b+'</div><label><input type="checkbox" id="ep52-st"'+(H.classList.contains('ep52_strip')?' checked':'')+'> Also show the top palette strip</label></div>');
o.addEventListener('click',function(e){var x=e.target.closest('[data-i]');if(x){o.remove();(p?jumpToPracticeQuestion:jumpToTestQuestion)(+x.dataset.i)}});
o.addEventListener('change',function(e){if(e.target.id==='ep52-st'){H.classList.toggle('ep52_strip',e.target.checked);S('ep52_strip',e.target.checked)}})}
function day(i){return new Date(Date.now()-i*864e5).toISOString().slice(0,10)}
function report(){var cn=(StorageModule.get(STORAGE_KEYS.streak,{dailyCounts:{}}).dailyCounts)||{},a=[],w=0,pw=0,i,mx=1;
for(i=13;i>=0;i--){var n=cn[day(i)]||0;a.push([day(i),n]);mx=Math.max(mx,n);if(i<7)w+=n;else pw+=n}
var q=StorageModule.get(STORAGE_KEYS.qstats,{}),se=0,co=0;Object.keys(q).forEach(function(k){se+=q[k].seen||0;co+=q[k].correct||0});
var sk=StorageModule.get(STORAGE_KEYS.streak,{});var due=0,wr=0;try{due=getDueRevisionKeys().length;wr=getSavedQuestionKeys('incorrect').length}catch(e){}
ov('ep52-rep','<div class="ep52-sh"><b style="font-size:16px">Weekly report</b><p>'+w+' questions this week ('+(w>=pw?'+':'')+(w-pw)+' vs last week). Accuracy '+(se?Math.round(Math.min(co,se)/se*100):0)+'%. Best streak '+(sk.best||0)+' days.</p><div class="ep52-bar">'+a.map(function(x){return '<i title="'+x[0]+': '+x[1]+'" style="height:'+Math.max(2,x[1]/mx*100)+'%"></i>'}).join('')+'</div><small>Last 14 days</small><p>Due for revision: '+due+' · Wrong to redo: '+wr+'</p></div>')}
var mm=document.getElementById('ep50-menu');if(mm){var mb=E('button',{type:'button'},'My flashcards');mb.style.cssText='font:700 12px system-ui;text-align:left;padding:8px 10px;border-radius:10px;border:1px solid #e2e8f0;background:transparent;color:inherit';mb.onclick=function(){mm.style.display='none';cards()};mm.insertBefore(mb,mm.firstChild)}
var pf=E('button',{id:'ep52-pf',type:'button'});pf.onclick=sheet;document.body.appendChild(pf);
var busy=false;function tick(){busy=false;try{
var lay=document.querySelector('.quiz-session-layout'),Q=quizState.questions||[];if(pf.style.display!=='none')pf.style.display='none';var pft='Q '+((quizState.currentIndex||0)+1)+'/'+Q.length;if(pf.textContent!==pft)pf.textContent=pft;
if(lay){var cf=lay.querySelector('.ep51-cf');if(cf)cf.style.display=(quizState.mode==='practice'&&quizState.userAnswers[quizState.currentIndex]!==undefined)?'none':'inline-flex';
var c=lay.querySelector('.select-none'),q=cur();if(c&&q&&!c.querySelector('.ep52-act[data-k="'+q.qKey+'"]')){var o=c.querySelector('.ep52-act');if(o)o.remove();
var d=E('div',{'class':'ep52-act','data-k':q.qKey},'<button type="button" data-a="add">+ Add to flashcards</button><button type="button" data-a="sim">Similar question</button>');
d.onclick=function(e){e.stopPropagation();var a=e.target.dataset.a;if(a==='add')addCard();else if(a==='sim')similar();else if(a==='my')cards()};c.appendChild(d)}}
var wh=[].slice.call(document.querySelectorAll('.dv2-h h3')).filter(function(h){return h.textContent.trim()==='This week'})[0];if(wh&&!document.querySelector('.ep52-rep')){var rb=E('button',{type:'button','class':'ep52-rep'},'Full report →');rb.style.cssText='font-size:12px;font-weight:800;color:#0d9488;background:none;border:0';rb.onclick=report;wh.parentNode.appendChild(rb)}
}catch(e){}}
new MutationObserver(function(){if(!busy){busy=true;requestAnimationFrame(tick)}}).observe(document.body,{childList:true,subtree:true});
})();

;

(function(){'use strict';
var busy=false;
function tick(){busy=false;try{
  var lay=document.querySelector('.quiz-session-layout');if(!lay)return;
  var q=(typeof quizState!=='undefined'&&quizState.questions||[])[quizState.currentIndex];
  /* exam tag already shows as a chip: drop the duplicate banner */
  var why=lay.querySelector('.ep-why');
  if(why&&q&&q.exam){[].slice.call(why.querySelectorAll('b')).forEach(function(b){if(b.textContent.trim()===String(q.exam).trim())b.remove()});}
  if(why&&!why.children.length)why.remove();
  /* last question: Skip has nothing to skip to */
  var foot=lay.querySelector('.pq-foot'),nx=foot&&foot.querySelector('.pq-next');
  if(foot)foot.classList.toggle('ep53-last',!!(nx&&/finish/i.test(nx.textContent)));
  /* exit becomes a quiet icon button */
  var head=lay.firstElementChild,grp=head&&head.children[1],ex=grp&&grp.lastElementChild;
  if(ex&&ex.tagName==='BUTTON'&&!ex.classList.contains('ep53-exit')&&/^(exit|end session)$/i.test(ex.textContent.trim())){
    ex.classList.add('ep53-exit');ex.setAttribute('aria-label',ex.textContent.trim()+' quiz');ex.title=ex.textContent.trim();
    ex.innerHTML='<i class="fa-solid fa-right-from-bracket"></i>';
  }
  /* bookmark vs flag: say what each does */
  var bm=lay.querySelector('.ep-qa-bm');if(bm&&!bm.dataset.e53){bm.dataset.e53='1';bm.title='Save question for later';bm.setAttribute('aria-label','Save question for later');}
  var fl=lay.querySelector('.bz-flag');if(fl&&!fl.dataset.e53){fl.dataset.e53='1';fl.title='Flag to review at the end';fl.setAttribute('aria-label','Flag to review at the end');}
}catch(e){}}
new MutationObserver(function(){if(!busy){busy=true;requestAnimationFrame(tick)}}).observe(document.body,{childList:true,subtree:true});
})();

;

(function(){'use strict';
function toast(m,t){try{showToast(m,t||'info')}catch(e){console.log(m)}}
/* ---- in-app confirm / prompt (async) ---- */
function dlg(msg,opts){return new Promise(function(res){
  var prev=document.activeElement,o=document.createElement('div');o.className='ep53-dlg';
  var inp=opts.input?'<input id="ep53-in" type="'+(opts.type||'text')+'" value="'+String(opts.value||'').replace(/"/g,'&quot;')+'" autocomplete="off">':'';
  o.innerHTML='<div class="ep53-box" role="dialog" aria-modal="true" aria-label="'+String(msg).replace(/"/g,'&quot;')+'"><p></p>'+inp+'<div class="ep53-row"><button type="button" class="ep53-no">Cancel</button><button type="button" class="ep53-ok'+(opts.danger?' danger':'')+'"></button></div></div>';
  o.querySelector('p').textContent=msg;o.querySelector('.ep53-ok').textContent=opts.ok||'OK';
  function done(v){o.remove();document.removeEventListener('keydown',key,true);try{prev&&prev.focus()}catch(e){}res(v)}
  function val(){return opts.input?o.querySelector('#ep53-in').value.trim():true}
  function key(e){if(e.key==='Escape'){e.preventDefault();done(opts.input?null:false)}else if(e.key==='Enter'){e.preventDefault();done(val())}}
  o.addEventListener('click',function(e){if(e.target===o)done(opts.input?null:false)});
  o.querySelector('.ep53-no').onclick=function(){done(opts.input?null:false)};
  o.querySelector('.ep53-ok').onclick=function(){done(val())};
  document.addEventListener('keydown',key,true);document.body.appendChild(o);
  (o.querySelector('#ep53-in')||o.querySelector('.ep53-ok')).focus();
})}
window.epConfirm=function(msg,ok,danger){return dlg(msg,{ok:ok||'Confirm',danger:danger!==false})};
window.epPrompt=function(msg,value,type){return dlg(msg,{input:true,value:value,type:type,ok:'Save'})};
window.epSetExamDate=function(){epPrompt('NEET exam date',localStorage.getItem('ep51_exam')||'','date').then(function(d){
  if(d&&!isNaN(new Date(d))){try{localStorage.setItem('ep51_exam',d)}catch(e){}location.reload()}})};

/* ---- storage: schema version + visible failure instead of silent loss ---- */
try{if(!localStorage.getItem('ep_schema'))localStorage.setItem('ep_schema','1')}catch(e){}
var quotaShown=0,_set=Storage.prototype.setItem;
function epFreeSpace(){var n=0;['edupulse_ai_explanations_v2','edupulse_chat_v1','ep_data_idx_v2'].forEach(function(k){try{if(localStorage.getItem(k)!==null){localStorage.removeItem(k);n++}}catch(x){}});return n}
Storage.prototype.setItem=function(k,v){try{return _set.call(this,k,v)}catch(e){
  if(/quota/i.test(String(e&&(e.name||e.message)))&&this===localStorage&&epFreeSpace()){try{return _set.call(this,k,v)}catch(e2){e=e2}}
  if(/quota/i.test(String(e&&(e.name||e.message)))&&Date.now()-quotaShown>30000){quotaShown=Date.now();toast('Device storage is full, so recent progress may not be saved. Back up your data and clear space.','error')}
  console.warn('[EduPulse] storage write failed:',k,e)}};

/* ---- service worker: tell people when a new version is ready ---- */
function banner(reg){if(document.getElementById('ep53-update'))return;
  var b=document.createElement('div');b.id='ep53-update';b.setAttribute('role','status');
  b.innerHTML='<span>A new version is ready</span><button type="button">Update</button>';
  b.querySelector('button').onclick=function(){try{reg.waiting&&reg.waiting.postMessage({type:'SKIP_WAITING'})}catch(e){}setTimeout(function(){location.reload()},400)};
  document.body.appendChild(b)}
if('serviceWorker' in navigator&&location.protocol!=='file:'){
  navigator.serviceWorker.getRegistration().then(function(reg){if(!reg)return;
    function watch(r){if(r.waiting&&navigator.serviceWorker.controller)banner(r);
      r.addEventListener('updatefound',function(){var w=r.installing;if(w)w.addEventListener('statechange',function(){if(w.state==='installed'&&navigator.serviceWorker.controller)banner(r)})})}
    watch(reg);try{reg.update()}catch(e){}
    document.addEventListener('visibilitychange',function(){if(!document.hidden){try{reg.update()}catch(e){}}});
  }).catch(function(){});
}

/* ---- swipe navigation must not fire from scrollable/horizontal content ---- */
var _ts=window.handleTouchStart;
if(typeof _ts==='function'){window.handleTouchStart=function(e){
  _ts.apply(this,arguments);
  try{if(e.target&&e.target.closest&&e.target.closest('.palette-drawer-top,table,.ep-figs,.ep-fig,input,textarea,.katex-display')){quizState.touchStartX=0;quizState.touchStartY=0}}catch(x){}}}

/* ---- DOM pass: icon-only labels, palette skipped state, Exit confirm ---- */
var NAMES={xmark:'Close','right-from-bracket':'Exit','arrow-left':'Back','arrow-right':'Next','share-nodes':'Share',ellipsis:'More actions',bookmark:'Bookmark',flag:'Flag',gear:'Settings',trash:'Delete','trash-can':'Delete',copy:'Copy',plus:'Add',minus:'Remove',check:'Confirm',magnifying:'Search','magnifying-glass':'Search',microphone:'Voice input','paper-plane':'Send',play:'Play',pause:'Pause',stop:'Stop',rotate:'Refresh','rotate-right':'Refresh',download:'Download',upload:'Upload','chevron-down':'Expand','chevron-up':'Collapse','chevron-left':'Previous','chevron-right':'Next',bars:'Menu',eye:'Show','eye-slash':'Hide',pen:'Edit','pen-to-square':'Edit',star:'Favourite','volume-high':'Read aloud','forward-fast':'Auto-advance'};
function label(b){
  if(b.getAttribute('aria-label')||b.getAttribute('aria-labelledby'))return;
  if(b.textContent.replace(/\s+/g,'').length)return;
  var t=b.getAttribute('title');if(t){b.setAttribute('aria-label',t);return}
  var i=b.querySelector('i[class*="fa-"]');if(!i)return;
  var m=(i.className.match(/fa-(?!solid|regular|brands|light|lg|sm|xs|fw|spin)([a-z0-9-]+)/g)||[]).map(function(x){return x.slice(3)});
  for(var k=0;k<m.length;k++){if(NAMES[m[k]]){b.setAttribute('aria-label',NAMES[m[k]]);return}}
  if(m[0])b.setAttribute('aria-label',m[0].replace(/-/g,' '));
}
var busy=false;
function pass(){busy=false;try{
  [].forEach.call(document.querySelectorAll('button:not([data-e54]),[role=button]:not([data-e54])'),function(b){b.setAttribute('data-e54','1');label(b)});
  var lay=document.querySelector('.quiz-session-layout');if(!lay||typeof quizState==='undefined')return;
  var sk=quizState.skippedQuestions||{};
  [].forEach.call(lay.querySelectorAll('.palette-touch-btn[data-q]'),function(b){var i=+b.dataset.q;b.classList.toggle('pal-skipped',!!sk[i]&&quizState.userAnswers[i]===undefined)});
  var ex=lay.querySelector('.ep53-exit');
  if(ex&&!ex.dataset.e54x){ex.dataset.e54x='1';ex.onclick=function(ev){ev.preventDefault();ev.stopPropagation();
    var n=Object.keys(quizState.userAnswers||{}).length,tot=(quizState.questions||[]).length;
    epConfirm(n?'End this practice and see your results? You answered '+n+' of '+tot+'.':'End this practice? You have not answered any questions yet.','End practice',false).then(function(ok){if(ok)finishPracticeQuiz()})}}
}catch(e){}}
new MutationObserver(function(){if(!busy){busy=true;requestAnimationFrame(pass)}}).observe(document.body,{childList:true,subtree:true});
pass();

/* ---- self-test: open the app with ?selftest=1 and read the console ---- */
if(/[?&]selftest=1/.test(location.search)){window.addEventListener('load',function(){setTimeout(function(){
  var r=[],ok=function(n,c){r.push([c?'PASS':'FAIL',n])};
  ['renderPracticeQuiz','finishPracticeQuiz','goToNextPracticeQuestion','jumpToPracticeQuestion','skipCurrentQuestion','showToast','epConfirm','epPrompt'].forEach(function(n){ok('function '+n,typeof window[n]==='function')});
  var ids={},dup=[];[].forEach.call(document.querySelectorAll('[id]'),function(e){if(ids[e.id])dup.push(e.id);ids[e.id]=1});ok('no duplicate ids'+(dup.length?' ('+dup.slice(0,5).join(', ')+')':''),!dup.length);
  var un=[].filter.call(document.querySelectorAll('button'),function(b){return !b.textContent.trim()&&!b.getAttribute('aria-label')}).length;ok('icon-only buttons without a label: '+un,un===0);
  var lay=document.querySelector('.quiz-session-layout');if(lay){ok('one confidence row',lay.querySelectorAll('.bz-conf:not([style*="none"])').length<=1);ok('no exam banner duplicate',!lay.querySelector('.ep-why b'));ok('footer is last child of card',!!lay.querySelector('.select-none>.pq-foot'))}
  console.table(r.map(function(x){return {result:x[0],check:x[1]}}));toast(r.filter(function(x){return x[0]==='FAIL'}).length?'Self-test: some checks failed, see console':'Self-test: all checks passed',r.some(function(x){return x[0]==='FAIL'})?'error':'success');
},2500)})}
})();

;

(function(){'use strict';
/* loading progress + slow-connection hint */
var slow=null;
window.epLoadProgress=function(done,total){
  var el=document.getElementById('ep-load-progress');
  if(el)el.textContent=done>=total?'Almost ready…':'Loading question files '+done+' of '+total+'…';
  if(done===0){clearTimeout(slow);slow=setTimeout(function(){var e=document.getElementById('ep-load-progress');if(e&&!/Almost/.test(e.textContent))e.textContent+=' This is taking longer than usual. Check your connection.'},10000)}
  if(done>=total)clearTimeout(slow);
};
/* keyboard: arrows move, 1-4 / A-D answer */
document.addEventListener('keydown',function(e){
  if(e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey)return;
  var t=e.target,tag=t&&t.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||(t&&t.isContentEditable))return;
  if(document.querySelector('.ep53-dlg,#ep-qa-pop'))return;
  var lay=document.querySelector('.quiz-session-layout');if(!lay||typeof quizState==='undefined'||quizState.mode!=='practice')return;
  var k=e.key,b=null;
  if(k==='ArrowRight')b=lay.querySelector('.pq-next:not(:disabled)');
  else if(k==='ArrowLeft')b=lay.querySelector('.pq-prev:not(:disabled)');
  else{var i='1234'.indexOf(k);if(i<0)i='abcd'.indexOf(String(k).toLowerCase());
    if(i>=0){var o=lay.querySelectorAll('[role=radio]:not(:disabled)');b=o[i]||null}}
  if(b){e.preventDefault();b.click()}
});
/* bring the answer feedback into view once */
var busy=false;
function pass(){busy=false;try{var r=document.getElementById('quiz-result');
  if(r&&!r.dataset.e55){r.dataset.e55='1';var rm=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;r.scrollIntoView({behavior:rm?'auto':'smooth',block:'nearest'})}}catch(e){}}
new MutationObserver(function(){if(!busy){busy=true;requestAnimationFrame(pass)}}).observe(document.body,{childList:true,subtree:true});
})();

;

(function(){'use strict';
var busy=false;
function pass(){busy=false;try{
  var lay=document.querySelector('.quiz-session-layout');if(!lay)return;
  /* keep any extra "why" tags (not the exam name) as normal chips, then drop the banners */
  var meta=lay.querySelector('.quiz-meta');
  [].forEach.call(lay.querySelectorAll('.ep-why b:not([data-e56])'),function(b){
    b.setAttribute('data-e56','1');var t=b.textContent.trim();if(!meta||!t)return;
    var have=[].some.call(meta.children,function(s){return s.textContent.trim().toLowerCase()===t.toLowerCase()});
    if(!have){var s=document.createElement('span');s.textContent=t;meta.appendChild(s)}
  });
  /* exit button: inline !important beats every older stylesheet rule */
  var ex=lay.querySelector('.ep53-exit');
  if(ex&&!ex.dataset.e56){ex.dataset.e56='1';
    [['background','transparent'],['border','1px solid rgba(148,163,184,.45)'],['color','#64748b'],['box-shadow','none'],['min-width','36px'],['width','36px'],['height','34px'],['padding','0'],['gap','0']].forEach(function(p){ex.style.setProperty(p[0],p[1],'important')});
  }
}catch(e){}}
new MutationObserver(function(){if(!busy){busy=true;requestAnimationFrame(pass)}}).observe(document.body,{childList:true,subtree:true});
pass();
})();

;

(function(){'use strict';
var busy=false;
function pass(){busy=false;try{
  var lay=document.querySelector('.quiz-session-layout');if(!lay)return;
  /* difficulty chip gets a colour dot (colour is never the only cue: the word stays) */
  [].forEach.call(lay.querySelectorAll('.quiz-meta span:not([data-e57])'),function(s){
    s.setAttribute('data-e57','1');var t=s.textContent.trim().toLowerCase();
    if(t==='easy')s.classList.add('ep57-easy');else if(t==='medium')s.classList.add('ep57-med');else if(t==='hard')s.classList.add('ep57-hard');});
  var au=lay.querySelector('.pq-auto');
  if(au&&!au.dataset.e57){au.dataset.e57='1';au.title='Auto-advance after answering';au.setAttribute('aria-label','Auto-advance after answering');}
  var tm=lay.querySelector('#pq-timer');if(tm&&!tm.title)tm.title='Time on this practice';
}catch(e){}}
new MutationObserver(function(){if(!busy){busy=true;requestAnimationFrame(pass)}}).observe(document.body,{childList:true,subtree:true});
pass();
})();

;

(function(){'use strict';
var KEY='edupulse_question_reports_v1';
var REASONS=['Wrong answer key','Wrong explanation','Typo or unclear','Image missing or wrong','Duplicate question','Something else'];
function toast(m,t){try{showToast(m,t||'success')}catch(e){}}
function qNow(){return(typeof quizState!=='undefined'&&quizState.questions||[])[quizState.currentIndex]}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function uid(){try{return crypto.randomUUID()}catch(e){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)})}}
/* ---- local list (works offline, doubles as the retry queue) ---- */
function load(){try{var a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}}
function save(a){try{localStorage.setItem(KEY,JSON.stringify(a.slice(0,100)))}catch(e){}}
function mark(id,patch){var a=load();a.forEach(function(r){if(r.id===id)Object.keys(patch).forEach(function(k){r[k]=patch[k]})});save(a)}
/* ---- Supabase over its REST API, using the config route you already deployed ---- */
var cfgP=null;
function cfg(){if(cfgP)return cfgP;
  cfgP=fetch('/api/supabase-config',{cache:'no-store',headers:{Accept:'application/json'}}).then(function(r){if(!r.ok)throw new Error('config');return r.json()}).then(function(c){
    if(!c||!c.url||!c.anonKey)throw new Error('config');var u=new URL(c.url);if(u.protocol!=='https:')throw new Error('config');return{base:u.origin,key:c.anonKey}});
  cfgP.catch(function(){cfgP=null});return cfgP}
function token(){try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);
  if(/^sb-.+-auth-token$/.test(k)){var v=JSON.parse(localStorage.getItem(k)||'null');var t=v&&(v.access_token||(v.currentSession&&v.currentSession.access_token));if(t)return t}}}catch(e){}return''}
function post(c,row,bearer){return fetch(c.base+'/rest/v1/question_reports',{method:'POST',headers:{'Content-Type':'application/json',apikey:c.key,Authorization:'Bearer '+(bearer||c.key),Prefer:'return=minimal'},body:JSON.stringify(row)})}
function send(r){return cfg().then(function(c){
  var row={id:r.id,q_key:String(r.qKey||''),chapter:r.chapter||'',reason:r.reason,note:r.note||'',question:r.question,options:r.options||[],correct_label:r.correctLabel||'',reported_at:new Date(r.reportedAt).toISOString(),user_agent:navigator.userAgent.slice(0,200)};
  var t=token();
  return post(c,row,t).then(function(res){return(res.status===401&&t)?post(c,row,''):res}).then(function(res){
    if(res.ok||res.status===409){notifyIdk(r);return true}throw new Error('HTTP '+res.status)})})}
/* ---- also deliver the report to @idk in Circles (best effort; needs a logged-in reporter) ---- */
var REPORT_TO='idk';
function notifyIdk(r){
  if(!r||r.dm)return Promise.resolve();
  var a=window.__epCommunityApi;if(!a||!a.ready)return Promise.resolve();
  return a.ready().then(function(x){
    var c=x.client,ss=a.session&&a.session(),uid=ss&&ss.user&&ss.user.id;
    if(!c||!uid)return;
    function rp(n,args){return c.rpc(n,args).then(function(o){if(o.error)throw o.error;return o.data})}
    return rp('campus_search_people',{p_q:REPORT_TO}).then(function(l){
      var p=(l||[]).filter(function(u){return String(u.username||'').toLowerCase()===REPORT_TO})[0];
      if(!p||p.id===uid)return;
      return rp('campus_dm_start',{p_other:p.id}).then(function(chat){
        if(!chat)return;
        return rp('campus_send',{p_chat:chat,p_kind:'text',p_body:('Question report\n'+textOf(r)).slice(0,3500),p_payload:{kind:'question_report',report_id:r.id,q_key:String(r.qKey||'')},p_reply_to:null,p_media_path:null})
          .then(function(){r.dm=true;mark(r.id,{dm:true})});
      });
    });
  }).catch(function(){});
}
var flushing=false;
function flush(){if(flushing||navigator.onLine===false)return Promise.resolve();
  var q=load().filter(function(r){return r.id&&r.sent===false});if(!q.length)return Promise.resolve();
  flushing=true;
  return q.reduce(function(p,r){return p.then(function(){return send(r).then(function(){mark(r.id,{sent:true})},function(){})})},Promise.resolve()).then(function(){flushing=false},function(){flushing=false})}
window.addEventListener('online',function(){setTimeout(flush,800)});
setTimeout(flush,4000);
/* ---- UI ---- */
function textOf(r){return['EduPulse question report','Reason: '+r.reason,r.note?'Note: '+r.note:null,'Chapter: '+(r.chapter||'-'),'Question ID: '+(r.qKey||'-'),'','Q: '+r.question,(r.options||[]).map(function(o,i){return String.fromCharCode(65+i)+'. '+o}).join('\n'),'Marked correct: '+(r.correctLabel||'-')].filter(function(x){return x!==null}).join('\n')}
function close(){var o=document.getElementById('ep58-dlg');if(o)o.remove();document.removeEventListener('keydown',key,true)}
function key(e){if(e.key==='Escape'){e.preventDefault();close()}}
function shareFallback(t){if(navigator.share){navigator.share({title:'EduPulse question report',text:t}).then(close,function(){})}
  else{try{navigator.clipboard.writeText(t).then(function(){toast('Report copied. Paste it to send.');close()},function(){toast('Could not copy','error')})}catch(e){toast('Could not copy','error')}}}
function open(){
  var q=qNow();if(!q){toast('Open a question first','warning');return}
  close();var reason='',o=document.createElement('div');o.id='ep58-dlg';o.className='ep58-dlg';
  o.innerHTML='<div class="ep58-box" role="dialog" aria-modal="true" aria-label="Report this question"><h3>Report this question</h3><p class="sub">What is wrong with it? Your report goes to @idk.</p><div class="ep58-q">'+esc(q.question)+'</div><div class="ep58-reasons">'+REASONS.map(function(r){return'<button type="button" aria-pressed="false">'+r+'</button>'}).join('')+'</div><textarea placeholder="Add details (optional)" maxlength="500" aria-label="Details"></textarea><div class="ep58-row"><button type="button" class="no">Cancel</button><button type="button" class="go" disabled>Submit report</button></div></div>';
  var go=o.querySelector('.go'),ta=o.querySelector('textarea'),box=o.querySelector('.ep58-box');
  [].forEach.call(o.querySelectorAll('.ep58-reasons button'),function(b){b.onclick=function(){reason=b.textContent;[].forEach.call(o.querySelectorAll('.ep58-reasons button'),function(x){x.setAttribute('aria-pressed',String(x===b))});go.disabled=false}});
  o.querySelector('.no').onclick=close;o.addEventListener('click',function(e){if(e.target===o)close()});
  go.onclick=function(){
    var r={id:uid(),question:q.question,qKey:(typeof questionId==='function'?questionId(q):q.qKey||q.id),chapter:quizState.chapter,reason:reason,note:ta.value.trim(),options:q.options,correctLabel:String.fromCharCode(65+q.correct),reportedAt:Date.now(),sent:false};
    var a=load();a.unshift(r);save(a);
    box.innerHTML='<div class="ep58-done"><i class="fa-solid fa-spinner fa-spin"></i><b>Sending…</b></div>';
    send(r).then(function(){mark(r.id,{sent:true});
      box.innerHTML='<div class="ep58-done"><i class="fa-solid fa-circle-check"></i><b>Report sent</b><small>Sent to @idk. Thank you, it will be reviewed and fixed.</small></div><div class="ep58-row"><button type="button" class="go">Done</button></div>';
      box.querySelector('.go').onclick=close;
    },function(){
      box.innerHTML='<div class="ep58-done"><i class="fa-solid fa-cloud-arrow-up" style="color:#f59e0b"></i><b>Saved on this device</b><small>Could not reach the server. It will send automatically when you are online.</small></div><div class="ep58-row"><button type="button" class="no">Done</button><button type="button" class="go">Share instead</button></div>';
      box.querySelector('.no').onclick=close;box.querySelector('.go').onclick=function(){shareFallback(textOf(r))};
    });
  };
  document.addEventListener('keydown',key,true);document.body.appendChild(o);o.querySelector('.ep58-reasons button').focus();
}
window.epReportOpen=open;
var _qa=window.epQa;
window.epQa=function(action,btn){if(action==='report'){try{epQaClose()}catch(e){}open();return}return _qa.apply(this,arguments)};
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-action="report"]');if(b&&b.closest('#normal-practice-toolkit')){e.preventDefault();e.stopImmediatePropagation();open()}},true);
})();

;

(function(){'use strict';
var W=window,D=document;
var $=function(s,r){return (r||D).querySelector(s);},$$=function(s,r){return Array.prototype.slice.call((r||D).querySelectorAll(s));};
var esc=function(v){return escapeHtml(v==null?'':v);};
var DAY=864e5,H=36e5;
var API=function(){return W.__epCommunityApi;};
var sess=function(){var a=API();return a&&a.session&&a.session();};
var me=function(){var s=sess();return s&&s.user;};
var uid=function(){var u=me();return u&&u.id;};
var toast=function(m,t){try{showToast(m,t||'info');}catch(e){}};
var _cl=null;
function client(){return _cl?Promise.resolve(_cl):API().ready().then(function(c){_cl=c.client;return _cl;});}
function errMsg(e){var c=e&&e.code,m=(e&&e.message)||'';
  if(!navigator.onLine)return 'You are offline. Reconnect to use Campus.';
  if(c==='42P01'||c==='PGRST205'||c==='PGRST202'||/could not find the function|schema cache|does not exist/i.test(m))return 'Campus is not set up yet. Run edupulse-campus.sql in the Supabase SQL Editor.';
  return m||'Something went wrong. Please try again.';}
function rpc(n,a){return client().then(function(c){return c.rpc(n,a||{});}).then(function(r){if(r.error)throw r.error;return r.data;});}
function fail(e){toast(errMsg(e),'error');}
var prof=function(){try{return W.__epProfileData&&W.__epProfileData()||null;}catch(e){return null;}};
var myHandle=function(){var p=prof();return (p&&p.username)||'';};
var myName=function(){var p=prof(),u=me();return (p&&(p.display_name||p.username))||(u&&(u.name||u.email))||'You';};
var hue=function(s){s=String(s||'');var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))%360;return h;};
var nm=function(p){return p?(p.name||p.display_name||p.username||'Student'):'Student';};
function av(p,s,online){s=s||44;var n=nm(p);
  var inner=p.saved?'<i class="fa-solid fa-bookmark"></i>':p.avatar_url?'<img src="'+esc(p.avatar_url)+'" alt="" referrerpolicy="no-referrer">':esc(String(n).trim().charAt(0).toUpperCase()||'S');
  return '<span class="cm-av'+(p.kind&&p.kind!=='dm'&&!p.saved?' sq':'')+'" style="--h:'+hue(n)+';width:'+s+'px;height:'+s+'px;font-size:'+Math.round(s*.4)+'px">'+inner+(online&&p.online?'<i class="cm-on"></i>':'')+'</span>';}
var dayLabel=function(t){var d=new Date(t),n=new Date(),y=new Date(Date.now()-DAY);return d.toDateString()===n.toDateString()?'Today':d.toDateString()===y.toDateString()?'Yesterday':d.toLocaleDateString([],{day:'numeric',month:'short'});};
var hm=function(t){return new Date(t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});};
var fmtD=function(s){return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');};
var istDay=function(){return new Date(Date.now()+5.5*H).toISOString().slice(0,10);};
var debounce=function(f,ms){var t;return function(){var a=arguments,c=this;clearTimeout(t);t=setTimeout(function(){f.apply(c,a);},ms);};};

var S={sub:'circle',status:'idle',error:'',inbox:[],fold:'All',q:'',people:[],rooms:[],suggest:[],cid:null,msgs:[],more:false,loadingMsgs:false,sel:null,replyTo:null,editing:0,drafts:(function(){try{return JSON.parse(localStorage.getItem('ep_campus_drafts_v1')||'{}')||{};}catch(e){return {};}})(),sq:null,topic:'',thread:null,roles:{},typing:{},nuId:0,members:{},
  subject:'All',sort:'new',doubts:[],dStatus:'idle',doubt:null,range:'week',lb:[],lbStatus:'idle',daily:null,summary:null,forYou:[],sched:[],staff:false,rec:null,pl:null,urls:{}};
var P=null; /* player */
try{if(localStorage.getItem('ep_campus_compact_v1')==='1')D.body.classList.add('ep-cm-compact');}catch(e){}

/* ---------- boot, realtime ---------- */
var booted=false,bootP=null;
function boot(){
  if(!me()){S.status='idle';return Promise.resolve();}
  if(booted)return Promise.resolve();
  if(bootP)return bootP;
  S.status='loading';
  bootP=rpc('campus_bootstrap').then(function(){booted=true;return Promise.all([refreshInbox(true),loadSummary(),rpc('campus_is_staff').then(function(v){S.staff=!!v;},function(){}),rpc('ep_admin_bootstrap').then(function(v){S.owner=!!(v&&v.role==='owner');S.adminRole=v&&v.role||'student';},function(){S.owner=false;S.adminRole='student';})]);})
  .then(function(){bootP=null;S.status='ready';subscribe();cleanupMedia();syncStudy();repaintAll();},function(e){bootP=null;booted=false;S.status='error';S.error=errMsg(e);repaintAll();});
  return bootP;
}
function repaintAll(){updateNav();if(typeof currentTab!=='undefined'&&currentTab==='campus')paint();dashPaint();}
function warm(){if(!me())return;var p=prof();if(!p&&typeof W.loadCommunityProfile==='function'){try{Promise.resolve(W.loadCommunityProfile()).then(function(){if(isCampus())paint();});}catch(e){}}boot();}
var isCampus=function(){return typeof currentTab!=='undefined'&&currentTab==='campus';};
var refreshInboxD=debounce(function(){rpc('campus_inbox').then(function(d){S.inbox=d||[];S.inboxAt=Date.now();updateNav();if(isCampus()){paintList();updateTabsBadge();if(S.cid)paintHead();}},function(){});},350);
function refreshInbox(first){return first===true?rpc('campus_inbox').then(function(d){S.inbox=d||[];S.inboxAt=Date.now();}):refreshInboxD();}
function loadSummary(){return rpc('campus_summary').then(function(d){S.summary=d;S.daily=d&&d.daily;S.sumAt=Date.now();},function(){});}
function unreadTotal(){return S.inbox.reduce(function(a,c){return a+(c.muted||c.archived?0:Number(c.unread)||0);},0);}
function updateNav(){var n=unreadTotal();$$('#nav-campus .cm-nav-dot,.bn-item[data-tab="campus"] .cm-nav-dot').forEach(function(e){e.remove();});
  if(n>0)$$('#nav-campus,.bn-item[data-tab="campus"]').forEach(function(b){var s=D.createElement('span');s.className='cm-nav-dot';s.textContent=n>99?'99+':n;b.appendChild(s);});}
function subscribe(){if(S.ch)return;
  client().then(function(c){
    var ev=function(t){return {event:'*',schema:'public',table:t};};
    S.ch=c.channel('campus-live-'+uid()).on('postgres_changes',ev('campus_messages'),onMsg).on('postgres_changes',ev('campus_reactions'),onSide).on('postgres_changes',ev('campus_poll_votes'),onSide).on('postgres_changes',ev('campus_duel_results'),onSide).subscribe();
  }).catch(function(){});}
function fetchMsg(id){return rpc('campus_get_message',{p_id:id});}
function onMsg(p){var n=p.new||{},o=p.old||{};
  if(p.eventType==='DELETE'){S.msgs=S.msgs.filter(function(m){return m.id!==o.id;});if(isCampus()&&S.cid)paintMsgs(true);refreshInbox();return;}
  if(p.eventType==='INSERT'){
    if(n.chat_id===S.cid&&isCampus()){fetchMsg(n.id).then(function(m){if(!m||S.msgs.some(function(x){return x.id===m.id;}))return;S.msgs.push(m);var mine=m.sender_id===uid();
      if(!mine&&!D.hidden)rpc('campus_mark_read',{p_chat:S.cid}).then(refreshInbox,function(){});paintMsgs(mine,true);hydrate();},function(){});}
    else{var c=S.inbox.filter(function(x){return x.id===n.chat_id;})[0];if(n.sender_id!==uid()&&c&&!c.muted)toastNew(c);}
    refreshInbox();return;}
  if(p.eventType==='UPDATE'&&n.chat_id===S.cid){fetchMsg(n.id).then(function(m){if(m)replaceMsg(m);},function(){});}
  refreshInbox();}
function toastNew(c){if(isCampus()&&S.sub==='circle')return;toast('New message in '+nm(cinfo(c)),'info');}
function onSide(p){var r=p.new&&p.new.message_id?p.new.message_id:p.old&&p.old.message_id;if(!r)return;if(!S.msgs.some(function(m){return m.id===r;}))return;fetchMsg(r).then(function(m){if(m)replaceMsg(m);},function(){});}
function replaceMsg(m){var i=S.msgs.findIndex(function(x){return x.id===m.id;});if(i<0)return;S.msgs[i]=m;if(isCampus()&&S.cid===m.chat_id)paintMsgs(true);}

/* study log + presence + scheduled delivery */
function syncStudy(){if(!me()||!booted)return;try{var n=questionsSolvedToday();if(n>=0)rpc('campus_log_study',{p_questions:n}).catch(function(){});}catch(e){}rpc('campus_ping').catch(function(){});}
setInterval(function(){if(!D.hidden){syncStudy();}},60000);
setInterval(function(){if(me()&&booted&&!D.hidden)refreshInbox();},60000);
function goOffline(){if(me()&&booted)rpc('campus_go_offline').catch(function(){});}
W.addEventListener('pagehide',goOffline);
setInterval(function(){if(me()&&booted&&!D.hidden){rpc('campus_deliver_due').then(function(n){if(n>0)refreshInbox();},function(){});rpc('campus_purge_expired').catch(function(){});}},30000);
D.addEventListener('visibilitychange',function(){if(D.hidden){goOffline();return;}if(booted){rpc('campus_ping').catch(function(){});refreshInbox();if(S.cid)rpc('campus_mark_read',{p_chat:S.cid}).catch(function(){});}});
function cleanupMedia(){rpc('campus_expired_media').then(function(p){if(!p||!p.length)return;return client().then(function(c){return c.storage.from('campus-media').remove(p);}).then(function(){return rpc('campus_media_removed',{p_paths:p});});}).catch(function(){});}

/* ---------- chat helpers ---------- */
function fresh(){return !!S.inboxAt&&Date.now()-S.inboxAt<150000;}
function cinfo(c){if(c.kind==='dm'){var o=c.other||{};return {name:o.display_name||o.username||'Student',display_name:o.display_name,username:o.username,handle:o.username||'',avatar_url:o.avatar_url,online:!!o.online&&fresh(),kind:'dm',uid:o.id,blocked:o.blocked,blocked_me:o.blocked_me};}
  if(c.kind==='saved')return {name:'Saved messages',handle:'',saved:1,kind:'saved'};return {name:c.name,handle:c.handle||'',kind:c.kind};}
var curChat=function(){return S.inbox.filter(function(c){return c.id===S.cid;})[0];};
var canAdmin=function(c){return c&&(c.role==='owner'||c.role==='admin');};
function preview(m){if(!m)return '';var k=m.kind,p=m.payload||{};return k==='question'?'Question: '+(p.text||''):k==='image'?(p.gone?'Photo expired':'Photo'):k==='voice'?'Voice message '+fmtD(p.duration||0):k==='poll'?'Poll: '+(p.question||''):k==='duel'?'Duel challenge':(m.body||'');}
function lastPrev(c){var l=c.last;if(!l)return c.kind==='dm'?'No messages yet':'';var who=l.mine?'You: ':(c.kind==='group'&&l.sender?l.sender+': ':'');return who+preview(l);}
function mtx(t){var h=myHandle();return esc(t).split(/(https?:\/\/[^\s<]+)/g).map(function(p,i){
  if(i%2){var tm=p.match(/[.,;:!?)\]]+$/),tail=tm?tm[0]:'',u=tail?p.slice(0,-tail.length):p;return '<a class="cm-lnk" data-cm="link" href="'+u+'" target="_blank" rel="noopener noreferrer">'+u+'</a>'+tail;}
  return p.replace(/@([a-z0-9_]{3,20})/g,function(a,x){return '<span class="cm-mn'+(x===h?' me':'')+'">@'+x+'</span>';});}).join('');}
function needHandle(){if(myHandle())return false;if(!prof()){toast('Loading your profile. Try again in a moment.','info');return true;}handleSheet(true);return true;}

/* ---------- shell ---------- */
W.campusMarkup=function(){setTimeout(function(){warm();paint();applyHash();},0);return '<div class="cm animate-fadeIn" id="cm-root"></div>';};
W.communitiesMarkup=W.campusMarkup;
function gate(){return '<div class="mx-auto max-w-2xl"><section class="cm-card" style="padding:1.6rem"><span class="cm-av" style="--h:170;width:52px;height:52px;border-radius:16px;font-size:20px"><i class="fa-solid fa-comments"></i></span><h2 class="mt-4 text-2xl font-black">Study together on Campus</h2><p class="mt-2 text-sm cm-muted" style="line-height:1.6">Ask doubts, play the Daily 10, chat with friends and join a study squad. Your practice, tests and notes keep working offline without an account.</p><ul class="mt-3 text-sm cm-muted" style="line-height:1.9;list-style:disc;padding-left:1.2rem"><li>Chats, groups and channels with polls and voice notes</li><li>Daily 10 leaderboard and friend duels</li><li>Doubts with best answers from other aspirants</li></ul><div class="mt-5 flex flex-wrap gap-2"><button class="cm-btn pri" onclick="__bzAcc.open(\'signup\')">Create account</button><button class="cm-btn" onclick="__bzAcc.open(\'login\')">Log in</button></div></section></div>';}
function header(){if(S.sub!=='circle')return '';var h=myHandle();return '<div class="cm-top"><h2>Circles<small>Study communities, doubts, quizzes and chats</small></h2><button class="cm-pill" data-cm="handle" aria-label="Your handle"><span class="cm-av" style="--h:'+hue(myName())+';width:28px;height:28px;font-size:12px">'+esc(String(myName()).charAt(0).toUpperCase())+'</span><span class="t">'+(h?'@'+esc(h):'Choose handle')+'</span></button>'+((S.staff||S.owner)?'<div class="cm-hmenu"><button type="button" class="cm-btn epc-iconbtn" aria-label="More actions" aria-haspopup="true" onclick="var m=this.nextElementSibling;m.hidden=!m.hidden;event.stopPropagation()"><i class="fa-solid fa-ellipsis"></i></button><div class="cm-hmenu-list" hidden>'+'<button type="button" onclick="epPhaseConsoleOpen()"><i class="fa-solid fa-shield-halved"></i> Safety console</button>'+(S.staff?'<button type="button" data-cm="mod"><i class="fa-solid fa-flag"></i> Reports</button>':'')+'</div></div>':'')+'</div>'+(h?'':'<div class="epc-handle-banner" role="status"><span><i class="fa-solid fa-at"></i> Pick a username so friends can find and message you.</span><button type="button" class="cm-btn ghost" data-cm="handle">Choose handle</button></div>');}
function tabsHtml(){var STUDY=['today','ask','arena'],study=STUDY.indexOf(S.sub)>=0,n=unreadTotal();if(study)S.lastStudy=S.sub;
  var P=[['circles','Circles','fa-circle-nodes',S.sub==='circles'],['circle','Chats','fa-comments',S.sub==='circle'],[S.lastStudy||'today','Study','fa-graduation-cap',study]];
  var prim=P.map(function(t){return '<button role="tab" aria-selected="'+t[3]+'" class="'+(t[3]?'on':'')+'" data-cm="sub" data-v="'+t[0]+'"><i class="fa-solid '+t[2]+'"></i>'+t[1]+(t[0]==='circle'&&n?'<span class="cm-badge">'+n+'</span>':'')+'</button>';}).join('');
  var sub=study?'<nav class="cm-seg cm-seg2" role="tablist" aria-label="Study sections">'+[['today','Today','fa-house'],['ask','Doubts','fa-circle-question'],['arena','Arena','fa-trophy']].map(function(t){return '<button role="tab" aria-selected="'+(S.sub===t[0])+'" class="'+(S.sub===t[0]?'on':'')+'" data-cm="sub" data-v="'+t[0]+'"><i class="fa-solid '+t[2]+'"></i>'+t[1]+'</button>';}).join('')+'</nav>':'';
  var TG={threads:['Threads','fa-comment-dots','#ff4500','Posts, votes and discussion'],focus:['Focus timer','fa-hourglass-half','#ec4899','Deep study sessions'],live:['Live classes','fa-tower-broadcast','#ef4444','Never recorded'],circles:['Circles','fa-circle-nodes','#8b5cf6','Study communities'],today:['Daily 10','fa-house','#14b8a6','Your daily practice'],ask:['Doubts','fa-circle-question','#f59e0b','Ask and answer'],arena:['Arena','fa-trophy','#3b82f6','Leaderboards and duels']},g=TG[S.sub];
  return '<div id="cm-tabs">'+(g?'<div class="tg-bar"><button class="tg-back" aria-label="Back to chats" data-cm="sub" data-v="circle" onclick="if(window.epLiveBusy&&epLiveBusy()){event.stopPropagation();epAsk.confirm(\'You will leave the live class.\',{title:\'Leave live class?\',ok:\'Leave\',danger:true}).then(function(ok){if(ok){epLiveLeave();var b=document.querySelector(\'.tg-back\');if(b){b.setAttribute(\'data-leave-ok\',\'1\');b.click();b.removeAttribute(\'data-leave-ok\')}}});return}"><i class="fa-solid fa-arrow-left"></i></button><span class="tg-av" style="background:'+g[2]+'"><i class="fa-solid '+g[1]+'"></i></span><div><b>'+g[0]+'</b><small>'+g[3]+'</small></div></div>':'')+'</div>';}
function updateTabsBadge(){var e=$('#cm-tabs');if(e)e.outerHTML=tabsHtml();}
function paint(){var r=$('#cm-root');if(!r)return;
  if(!me()){r.innerHTML=gate();return;}
  if(S.status==='error'){r.innerHTML=header()+'<div class="cm-card cm-empty"><b>Circles unavailable</b>'+esc(S.error)+'<br><button class="cm-btn pri" style="margin-top:.8rem" data-cm="retry">Try again</button></div>';return;}
  r.innerHTML=header()+tabsHtml()+'<div id="cm-body"></div>';paintBody();}
function paintBody(){var b=$('#cm-body');if(!b)return;
  if(S.status!=='ready'){b.innerHTML='<div class="cm-skel"></div><div class="cm-skel"></div><div class="cm-skel"></div>';return;}
  if(S.sub==='circles'){b.innerHTML='<div id="ep-circle-hub"></div>';setTimeout(function(){if(W.epCircleHubRender)W.epCircleHubRender();},0);}
  else if(S.sub==='threads'){b.innerHTML='<div id="ep-threads"></div>';setTimeout(function(){if(W.epThreadsRender)W.epThreadsRender();},0);}
  else if(S.sub==='focus'){b.innerHTML='<div id="ep-focus"></div>';setTimeout(function(){if(W.epFocusRender)W.epFocusRender();},0);}
  else if(S.sub==='live'){b.innerHTML='<div id="ep-live"></div>';setTimeout(function(){if(W.epLiveRender)W.epLiveRender();},0);}
  else if(S.sub==='today'){b.innerHTML=todayView();loadForYou();loadDailyPreview();}
  else if(S.sub==='ask'){b.innerHTML=askView();if(S.dStatus==='idle')loadDoubts();}
  else if(S.sub==='arena'){b.innerHTML=arenaView();if(S.lbStatus==='idle')loadLb();}
  else{b.innerHTML=circleView();paintList();if(S.cid)paintThread();else paintThreadEmpty();}
  document.body.classList.toggle('cm-lock',S.sub==='circle'&&!!S.cid&&innerWidth<1024);}

/* ---------- Today ---------- */
var dailyInfo=null;
function dailyPick(){var rnd=seeded(hashStr('daily:'+istDay())),subs=Object.keys(data),sj=subs[Math.floor(rnd()*subs.length)],chs=shuf(data[sj].slice(),rnd);return {subject:sj,chapter:chs[0]};}
function loadDailyPreview(){if(dailyInfo&&dailyInfo.day===istDay())return;dailyInfo={day:istDay(),loading:1,subject:dailyPick().subject,chapter:dailyPick().chapter};
  buildSet('daily:'+istDay(),null).then(function(s){dailyInfo={day:istDay(),subject:s.subject,chapter:s.chapter,set:s};if(isCampus()&&(S.sub==='today'||S.sub==='arena'))paintBody();},function(){});}
function todayView(){var d=S.daily||{},sm=S.summary||{},sq=sm.squad,goal=getDailyGoal(),done=questionsSolvedToday(),pc=Math.min(100,Math.round(done/goal*100));
  var di=dailyInfo||dailyPick();
  var hero='<div class="cm-hero"><h3>Daily 10</h3><p>'+esc(di.subject)+' · '+esc(di.chapter)+' · about 6 minutes'+(d.streak?' · '+d.streak+'-day streak':'')+'</p>'+(d.played?'<button class="cm-btn" data-cm="sub" data-v="arena">You scored '+d.score+' · rank #'+d.rank+'</button>':'<button class="cm-btn" data-cm="playDaily">Start challenge</button>')+'</div>';
  var you='<div class="cm-card"><b>Your day</b><div class="cm-bar"><span style="width:'+pc+'%"></span></div><small class="cm-muted">'+done+' of '+goal+' practice questions today</small></div>';
  var sqH=sq?'<div class="cm-card"><b>'+esc(sq.name)+'</b><p class="cm-muted" style="font-size:.85rem;margin-top:.2rem">'+sq.studied_today+' of '+sq.members+' studied today. Weekly goal: '+sq.week_questions+' of '+sq.weekly_goal+' questions.</p><div class="cm-bar"><span style="width:'+Math.min(100,Math.round(sq.week_questions/sq.weekly_goal*100))+'%"></span></div><button class="cm-btn ghost" style="margin-top:.4rem" data-cm="openChat" data-id="'+esc(sq.id)+'">Open squad chat</button></div>'
    :'<div class="cm-card"><b>Study squad</b><p class="cm-muted" style="font-size:.85rem;margin:.2rem 0 .6rem">Create a group with a weekly question goal and see who studied today.</p><button class="cm-btn ghost" data-cm="newGroupGoal">Start a squad</button></div>';
  var online=S.inbox.filter(function(c){return c.kind==='dm'&&c.other&&c.other.online&&fresh();}).slice(0,4).map(function(c){return av(cinfo(c),34,true);}).join('');
  var now='<div class="cm-card"><b>Studying now</b><div style="display:flex;align-items:center;gap:.6rem;margin-top:.5rem">'+online+'<span class="cm-muted" style="font-size:.85rem">'+(sm.active||1)+' student'+((sm.active||1)==1?' is':'s are')+' active right now</span></div></div>';
  var fy='<div class="cm-sec">Doubts you can answer</div><div id="cm-foryou">'+forYouHtml()+'</div>';
  return hero+'<div class="cm-grid2">'+you+now+'</div><div style="height:1rem"></div>'+sqH+fy;}
function forYouHtml(){if(!S.forYou.length)return '<div class="cm-card cm-muted" style="font-size:.85rem">No open doubts right now. Check the Ask tab.</div>';var weak=[];try{weak=getWeakChapters(8).map(function(w){return w.chapter;});}catch(e){}
  return '<div class="cm-list">'+S.forYou.map(function(p){return '<div class="cm-row" role="button" tabindex="0" data-cm="doubt" data-id="'+esc(p.id)+'"><div class="mid"><b style="white-space:normal">'+esc(p.body)+'</b><small>'+esc(p.subject)+' · '+esc(p.chapter||'General')+(weak.indexOf(p.chapter)>=0?', a weak chapter for you':'')+'</small></div></div>';}).join('')+'</div>';}
function loadForYou(){var weak=[];try{weak=getWeakChapters(8).map(function(w){return w.chapter;});}catch(e){}
  rpc('campus_doubts_for',{p_chapters:weak.length?weak:null}).then(function(r){if(!r.length&&weak.length)return rpc('campus_doubts_for',{p_chapters:null});return r;}).then(function(r){S.forYou=r||[];var e=$('#cm-foryou');if(e)e.innerHTML=forYouHtml();},function(){});}

/* ---------- Ask ---------- */
function askView(){var subs=['All','Biology','Physics','Chemistry'],sorts=[['new','New'],['top','Top'],['open','Unanswered']];
  return '<div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.4rem"><div class="cm-chips" style="flex:1;padding:0">'+subs.map(function(s){return '<button class="cm-chip '+(S.subject===s?'on':'')+'" data-cm="subject" data-v="'+s+'">'+s+'</button>';}).join('')+'</div><button class="cm-btn pri" data-cm="askSheet"><i class="fa-solid fa-plus"></i> Ask</button></div><div class="cm-chips">'+sorts.map(function(s){return '<button class="cm-chip '+(S.sort===s[0]?'on':'')+'" data-cm="sort" data-v="'+s[0]+'">'+s[1]+'</button>';}).join('')+'</div><div id="cm-doubts">'+doubtsHtml()+'</div>';}
function doubtsHtml(){if(S.dStatus==='loading'||S.dStatus==='idle')return '<div class="cm-skel"></div><div class="cm-skel"></div>';if(S.dStatus==='error')return '<div class="cm-empty"><b>Could not load doubts</b><button class="cm-btn pri" data-cm="reloadDoubts">Try again</button></div>';
  if(!S.doubts.length)return '<div class="cm-empty"><b>No doubts here yet</b>Be the first to ask one.</div>';
  return S.doubts.map(function(p){return '<div class="cm-post"><button class="cm-vote '+(p.up?'on':'')+'" data-cm="dvote" data-id="'+esc(p.id)+'" aria-label="Upvote"><i class="fa-solid fa-arrow-up"></i>'+p.votes+'</button><div class="bd" data-cm="doubt" data-id="'+esc(p.id)+'"><span class="cm-tag">'+esc(p.subject)+'</span> <span class="cm-muted" style="font-size:.78rem">'+esc(p.chapter||'General')+'</span><div class="tx">'+esc(p.body)+'</div><small style="color:'+(p.best?'var(--teal)':'var(--text-muted)')+'">'+(p.best?'Best answer chosen · ':'')+p.answers+' answer'+(p.answers==1?'':'s')+' · <span class="pf-link" role="button" tabindex="0" data-pf="'+esc(p.author_id||p.user_id||'')+'" data-pn="'+esc(p.author)+'">'+esc(p.author)+'</span></small></div></div>';}).join('');}
function loadDoubts(){S.dStatus='loading';var e=$('#cm-doubts');if(e)e.innerHTML=doubtsHtml();
  rpc('campus_doubts_list',{p_subject:S.subject,p_sort:S.sort,p_limit:40}).then(function(r){S.doubts=r||[];S.dStatus='ready';var e=$('#cm-doubts');if(e)e.innerHTML=doubtsHtml();},function(x){S.dStatus='error';toast(errMsg(x),'error');var e=$('#cm-doubts');if(e)e.innerHTML=doubtsHtml();});}
function askSheet(){if(needHandle())return;sheet('<h3>Ask a doubt</h3><select id="as-s" onchange="epCampus._chs(this.value)">'+['Biology','Physics','Chemistry'].map(function(s){return '<option>'+s+'</option>';}).join('')+'</select><select id="as-c">'+chOpts('Biology')+'</select><textarea id="as-t" rows="4" maxlength="1000" placeholder="What are you stuck on? Mention what you tried."></textarea><button class="cm-btn pri" style="width:100%" data-cm="postDoubt">Post doubt</button>');}
function chOpts(s){return '<option value="">General</option>'+(data[s]||[]).map(function(c){return '<option>'+esc(c)+'</option>';}).join('');}
function postDoubt(){var t=($('#as-t').value||'').trim();if(t.length<5){toast('Write your doubt first.','warning');return;}
  rpc('campus_doubt_post',{p_subject:$('#as-s').value,p_chapter:$('#as-c').value,p_body:t}).then(function(){closeSheet();S.subject='All';S.sort='new';toast('Doubt posted','success');S.dStatus='idle';if(isCampus())paintBody();},fail);}
function openDoubt(id){sheet('<div class="cm-skel"></div><div class="cm-skel"></div>');loadDoubt(id);}
function loadDoubt(id){rpc('campus_doubt_get',{p_id:id}).then(function(d){if(!d){closeSheet();toast('That doubt was removed.','info');return;}S.doubt=d;sheet(doubtSheet(d),true);},function(e){closeSheet();fail(e);});}
function doubtSheet(d){return '<span class="cm-tag">'+esc(d.subject)+'</span> <span class="cm-muted" style="font-size:.78rem">'+esc(d.chapter||'General')+'</span><h3 style="margin-top:.4rem;white-space:pre-line;overflow-wrap:anywhere">'+esc(d.body)+'</h3><small class="cm-muted">Asked by '+esc(d.author)+' · '+dayLabel(d.created_at)+'</small><div class="cm-sec" style="margin-top:1rem">'+d.thread.length+' answer'+(d.thread.length==1?'':'s')+'</div>'+
  (d.thread.length?d.thread.map(function(a){return '<div class="cm-post" style="padding:.7rem 0"><button class="cm-vote '+(a.up?'on':'')+'" data-cm="avote" data-id="'+esc(a.id)+'" data-d="'+esc(d.id)+'" aria-label="Upvote answer"><i class="fa-solid fa-arrow-up"></i>'+a.votes+'</button><div style="min-width:0;flex:1">'+(a.best?'<span class="cm-tag" style="margin-bottom:.2rem">Best answer</span>':'')+'<div style="white-space:pre-line;overflow-wrap:anywhere">'+esc(a.body)+'</div><small class="cm-muted"><span class="pf-link" role="button" tabindex="0" data-pf="'+esc(a.author_id||a.user_id||'')+'" data-pn="'+esc(a.author)+'">'+esc(a.author)+'</span></small><div style="margin-top:.3rem;display:flex;gap:.4rem;flex-wrap:wrap">'+(d.mine?'<button class="cm-chip" data-cm="bestAns" data-id="'+esc(a.id)+'" data-d="'+esc(d.id)+'">'+(a.best?'Remove best':'Mark as best')+'</button>':'')+(a.mine?'<button class="cm-chip" data-cm="delAns" data-id="'+esc(a.id)+'" data-d="'+esc(d.id)+'">Delete</button>':'')+'</div></div></div>';}).join(''):'<p class="cm-muted" style="font-size:.85rem">No answers yet. Be the first to help.</p>')+
  '<textarea id="an-t" rows="3" maxlength="2000" placeholder="Write your answer" style="margin-top:.8rem"></textarea><div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="cm-btn pri" data-cm="postAns" data-id="'+esc(d.id)+'">Post answer</button>'+(d.mine?'<button class="cm-btn danger" data-cm="delDoubt" data-id="'+esc(d.id)+'">Delete doubt</button>':'<button class="cm-btn" data-cm="reportDoubt" data-id="'+esc(d.id)+'" data-u="'+esc(d.author_id)+'">Report</button>')+'</div>';}

/* ---------- Arena ---------- */
function arenaView(){var d=S.daily||{},di=dailyInfo||dailyPick();
  var hero='<div class="cm-hero"><h3>Daily 10</h3><p>Same 10 questions for everyone ('+esc(di.subject)+' · '+esc(di.chapter)+'). Ranked by score, then time.</p>'+(d.streak>1?'<div class="cm-streak">🔥 '+d.streak+'-day streak</div> ':'')+'<div style="opacity:.85;font-size:.8rem;margin-bottom:.7rem">'+(d.participants||0)+' played today</div>'+(d.played?'<div style="font-weight:800;margin-bottom:.7rem">Your score '+d.score+'/40 · rank #'+d.rank+' of '+d.participants+' · '+fmtD(d.seconds)+'</div><button class="cm-btn" data-cm="practiceDaily">Practise again (unranked)</button>':'<button class="cm-btn" data-cm="playDaily">Play now</button>')+'</div>';
  var rs=[['today','Today'],['week','This week'],['all','All time']];
  return hero+'<button class="cm-btn ghost" style="width:100%;padding:.8rem" data-cm="sub" data-v="circle">Duel a friend from Circle</button><div class="cm-sec">Leaderboard</div><div class="cm-chips">'+rs.map(function(r){return '<button class="cm-chip '+(S.range===r[0]?'on':'')+'" data-cm="range" data-v="'+r[0]+'">'+r[1]+'</button>';}).join('')+'</div><div id="cm-lb">'+lbHtml()+'</div>';}
function lbHtml(){if(S.lbStatus!=='ready')return S.lbStatus==='error'?'<div class="cm-empty"><b>Leaderboard unavailable</b></div>':'<div class="cm-skel"></div><div class="cm-skel"></div>';
  if(!S.lb.length)return '<div class="cm-empty"><b>No scores yet</b>Play the Daily 10 to start the board.</div>';
  return S.lb.map(function(r){return '<div class="cm-lb '+(r.me?'me':'')+'"><span class="n">'+(r.rank<=3?['🥇','🥈','🥉'][r.rank-1]:r.rank)+'</span>'+av({name:r.name},34)+'<b style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(r.me?'You':r.name)+'<small class="cm-muted" style="display:block;font-weight:500">'+r.days+' day'+(r.days==1?'':'s')+' · '+fmtD(r.seconds)+'</small></b><b>'+r.score+'<small class="cm-muted" style="font-weight:500"> pts</small></b></div>';}).join('');}
function loadLb(){S.lbStatus='loading';var e=$('#cm-lb');if(e)e.innerHTML=lbHtml();rpc('campus_leaderboard',{p_range:S.range,p_limit:20}).then(function(r){S.lb=r||[];S.lbStatus='ready';var e=$('#cm-lb');if(e)e.innerHTML=lbHtml();},function(){S.lbStatus='error';var e=$('#cm-lb');if(e)e.innerHTML=lbHtml();});}

/* ---------- question sets and player ---------- */
function hashStr(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function seeded(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function shuf(arr,rnd){for(var i=arr.length-1;i>0;i--){var j=Math.floor(rnd()*(i+1)),t=arr[i];arr[i]=arr[j];arr[j]=t;}return arr;}
var usable=function(q){return q&&q.question&&!q.img&&!q.needsImage&&!q.table&&!(q.optionImages&&q.optionImages.length)&&q.options.length>=2&&q.options.length<=5;};
function buildSet(seedStr,subject){var rnd=seeded(hashStr(seedStr)),subs=subject&&data[subject]?[subject]:Object.keys(data),sj=subs[Math.floor(rnd()*subs.length)],chs=shuf(data[sj].slice(),rnd);
  var tryAt=function(i){if(i>=chs.length||i>8)return Promise.reject(new Error('No questions available.'));
    return preloadChapter(sj,chs[i]).then(function(qs){var ok=(qs||[]).filter(usable).sort(function(a,b){return a.qKey<b.qKey?-1:1;});if(ok.length>=10)return {subject:sj,chapter:chs[i],questions:shuf(ok,rnd).slice(0,10)};return tryAt(i+1);});};
  return tryAt(0);}
function overlay(html){var o=$('#cm-play');if(!o){o=D.createElement('div');o.id='cm-play';D.body.appendChild(o);}o.innerHTML='<div class="cm-play">'+html+'</div>';o.className='open';o.scrollTop=0;}
function closePlay(){var o=$('#cm-play');if(o)o.className='';P=null;}
function startPlay(kind,seedStr,subject,extra){if(!me())return;overlay('<div class="cm-skel"></div><div class="cm-skel"></div><p class="cm-muted" style="text-align:center">Loading your 10 questions…</p>');
  buildSet(seedStr,subject).then(function(set){P=Object.assign({kind:kind,set:set,i:0,ans:[],picked:-1,t0:Date.now(),locked:false},extra||{});renderQ();},function(){closePlay();toast('Could not load questions. Check your connection and try again.','warning');});}
function renderQ(){var q=P.set.questions[P.i],L='ABCDE';
  overlay('<div style="display:flex;align-items:center;gap:.6rem"><button class="cm-ib" data-cm="quitPlay" aria-label="Quit">'+'<i class="fa-solid fa-xmark"></i></button><div style="flex:1"><b>'+(P.kind==='duel'?'Duel':P.kind==='daily'?'Daily 10':'Practice')+' · '+esc(P.set.subject)+'</b><small class="cm-muted" style="display:block">'+esc(P.set.chapter)+'</small></div><b id="cm-clock">'+fmtD((Date.now()-P.t0)/1000)+'</b></div><div class="cm-bar" style="margin:.8rem 0"><span style="width:'+(P.i/10*100)+'%"></span></div><small class="cm-muted">Question '+(P.i+1)+' of 10 · +4 / −1</small><div class="cm-pq">'+formatQuizText(q.question)+'</div>'+
    q.options.map(function(o,i){var cls='';if(P.locked){if(i===q.correct)cls=' ok';else if(i===P.picked)cls=' no';}return '<button class="cm-po'+cls+'" data-cm="pick" data-v="'+i+'" '+(P.locked?'disabled':'')+'><b>'+L[i]+'</b><span>'+formatQuizText(o)+'</span></button>';}).join('')+
    (P.locked?(q.explanation?'<div class="cm-exp">'+formatQuizText(q.explanation)+'</div>':'')+'<button class="cm-btn pri" style="width:100%" data-cm="nextQ">'+(P.i===9?'Finish':'Next question')+'</button>':'<button class="cm-btn" style="width:100%;margin-top:.3rem" data-cm="skipQ">Skip</button>'));
  clearInterval(P.iv);P.iv=setInterval(function(){var e=$('#cm-clock');if(e&&P)e.textContent=fmtD((Date.now()-P.t0)/1000);},1000);}
function pick(i){if(!P||P.locked)return;var q=P.set.questions[P.i];P.picked=i;P.locked=true;P.ans[P.i]=i;renderQ();}
function skipQ(){if(!P||P.locked)return;P.ans[P.i]=-1;nextQ(true);}
function nextQ(force){if(!P)return;if(!P.locked&&!force)return;if(P.i>=9){finishPlay();return;}P.i++;P.picked=-1;P.locked=false;renderQ();}
function finishPlay(){clearInterval(P.iv);var qs=P.set.questions,c=0,w=0;qs.forEach(function(q,i){var a=P.ans[i];if(a==null||a<0)return;if(a===q.correct)c++;else w++;});
  var secs=Math.max(c+w,Math.round((Date.now()-P.t0)/1000)),score=c*4-w;P.res={c:c,w:w,score:score,secs:secs};
  try{var at={chapter:'Daily 10: '+P.set.chapter,subject:P.set.subject,mode:'campus',finishedAt:Date.now(),total:10,attempted:c+w,correct:c,wrong:w,skipped:10-c-w,score:score,maxScore:40,accuracy:c+w?Math.round(c/(c+w)*100):0};
    if(P.kind!=='practice'&&c+w>0){var arr=StorageModule.get(STORAGE_KEYS.attempts,[]);arr.unshift(at);StorageModule.set(STORAGE_KEYS.attempts,arr);StorageModule.recordActivity(c+w);syncStudy();}}catch(e){}
  renderResult('');
  var p=P;
  if(p.kind==='daily'&&!(S.daily&&S.daily.played))rpc('campus_daily_submit',{p_subject:p.set.subject,p_chapter:p.set.chapter,p_correct:c,p_wrong:w,p_seconds:secs}).then(function(){return loadSummary();}).then(function(){S.lbStatus='idle';renderResult('Saved to the leaderboard. Rank #'+(S.daily&&S.daily.rank)+' of '+(S.daily&&S.daily.participants)+' so far.');},function(e){renderResult('Could not save your score: '+errMsg(e));});
  else if(p.kind==='duel')rpc('campus_duel_submit',{p_id:p.msgId,p_correct:c,p_wrong:w,p_seconds:secs}).then(function(){return fetchMsg(p.msgId);}).then(function(m){if(m)replaceMsg(m);renderResult('Result sent to the chat.');},function(e){renderResult('Could not save your result: '+errMsg(e));});
  else renderResult('Unranked practice run.');}
function renderResult(note){if(!P||!P.res)return;var r=P.res,qs=P.set.questions,L='ABCDE';
  overlay('<div style="text-align:center;padding:1rem 0"><span class="cm-tag">'+(P.kind==='daily'?'Daily 10':P.kind==='duel'?'Duel':'Practice')+' complete</span><div class="cm-big" style="margin-top:.6rem">'+r.score+'<small class="cm-muted" style="font-size:1rem"> / 40</small></div></div><div class="cm-stats"><div><b>'+r.c+'</b>Correct</div><div><b>'+r.w+'</b>Wrong</div><div><b>'+fmtD(r.secs)+'</b>Time</div></div><p class="cm-muted" style="text-align:center;font-size:.85rem;min-height:1.2rem">'+esc(note)+'</p><div class="cm-sec">Review</div>'+
   qs.map(function(q,i){var a=P.ans[i];return '<div class="cm-card" style="margin-bottom:.6rem"><b style="font-size:.78rem" class="cm-muted">Question '+(i+1)+' · '+(a==null||a<0?'Skipped':a===q.correct?'Correct':'Wrong')+'</b><div style="margin:.3rem 0;line-height:1.6">'+formatQuizText(q.question)+'</div><small>Answer: <b>'+L[q.correct]+'</b>. '+formatQuizText(q.options[q.correct])+(a>=0&&a!==q.correct?'<br>You chose '+L[a]+'.':'')+'</small>'+(q.explanation?'<div class="cm-exp" style="margin-bottom:0">'+formatQuizText(q.explanation)+'</div>':'')+'</div>';}).join('')+'<button class="cm-btn pri" style="width:100%;margin:1rem 0" data-cm="closePlay">Done</button>');}
function quitPlay(){epAsk.confirm('Your answers will not be saved.',{title:'Quit this run?',ok:'Quit',danger:true}).then(function(ok){if(ok)closePlay()})}

/* ---------- Circle ---------- */
var FOLDS=['All','Unread','Mentions','Personal','Groups','Channels','Saved','Archived'];
function inFold(c){if(S.fold==='Archived')return !!c.archived;if(c.archived)return false;return S.fold==='All'||(S.fold==='Unread'&&c.unread>0)||(S.fold==='Mentions'&&!!c.mention)||(S.fold==='Personal'&&c.kind==='dm')||(S.fold==='Groups'&&c.kind==='group')||(S.fold==='Channels'&&c.kind==='channel')||(S.fold==='Saved'&&c.kind==='saved');}
function circleView(){return '<div class="cm-circle'+(S.cid?' chat-open':'')+'" id="cm-circle"><div class="cm-pane-list"><div style="display:flex;gap:.5rem;align-items:center"><label class="cm-search" style="flex:1"><i class="fa-solid fa-magnifying-glass cm-muted"></i><input id="cm-q" type="search" placeholder="Search chats, @handles, rooms" value="'+esc(S.q)+'" data-in="search" aria-label="Search"></label><button class="cm-ib" data-cm="newSheet" aria-label="New group or channel" style="border:1px solid var(--border-color);margin-bottom:.6rem"><i class="fa-solid fa-plus"></i></button></div><div class="cm-chips">'+FOLDS.map(function(f){return '<button class="cm-chip '+(S.fold===f?'on':'')+'" data-cm="fold" data-v="'+f+'">'+f+(f==='Unread'&&unreadTotal()?' '+unreadTotal():'')+'</button>';}).join('')+'</div><div id="cm-list"></div></div><section class="cm-thread'+(S.cid?' open':'')+'" id="cm-thread"></section></div>';}
function swa(c){var b=function(flag,on,ic,onL,offL){return '<button type="button" class="'+flag+'" data-cm="swipeFlag" data-id="'+esc(c.id)+'" data-flag="'+flag+'"><i class="fa-solid '+ic+'"></i><span>'+(on?onL:offL)+'</span></button>';};return '<div class="cm-swa">'+b('pinned',c.pinned,'fa-thumbtack','Unpin','Pin')+b('muted',c.muted,'fa-bell-slash','Unmute','Mute')+b('archived',c.archived,'fa-box-archive','Restore','Archive')+'</div>';}
function SPECIAL(){var R=[['live','Live classes','fa-tower-broadcast','#ef4444',(window.__lvN?window.__lvN+' live now':'Join or host a live class')],['circles','Circles','fa-circle-nodes','#8b5cf6','Study communities for your subject'],['threads','Threads','fa-comment-dots','#ff4500','Posts, votes and discussion'],['ask','Doubts','fa-circle-question','#f59e0b','Ask and answer doubts'],['today','Daily 10','fa-house','#14b8a6',(W.epXpLine?W.epXpLine():'Today\'s practice set')],['arena','Arena','fa-trophy','#3b82f6','Leaderboards and duels']];
  return '<div class="cm-list tg-pin">'+(W.epXpMini?W.epXpMini():'')+R.map(function(r){return '<div class="cm-row" role="button" tabindex="0" data-cm="sub" data-v="'+r[0]+'"><span class="tg-av" style="background:'+r[3]+';width:48px;height:48px;font-size:1.1rem"><i class="fa-solid '+r[2]+'"></i></span><div class="mid"><b>'+r[1]+'</b><small>'+r[4]+'</small></div><div class="end"><i class="fa-solid fa-thumbtack"></i></div></div>';}).join('')+'</div>';}
function paintList(){var el=$('#cm-list');if(!el)return;var s=S.q.trim().toLowerCase().replace(/^@/,'');
  var match=function(c){var i=cinfo(c);return !s||(i.name+' '+i.handle).toLowerCase().indexOf(s)>=0;};
  var L=S.inbox.filter(function(c){return match(c)&&inFold(c);}).sort(function(a,b){return (b.pinned?1:0)-(a.pinned?1:0)||String(b.last_at).localeCompare(String(a.last_at));});
  var h=L.length?'<div class="cm-list">'+L.map(function(c){var i=cinfo(c),at=c.last_at;
    return '<div class="cm-swr">'+swa(c)+'<div class="cm-row'+(c.unread>0&&!c.muted?' unread':'')+'" role="button" tabindex="0" data-cm="openChat" data-id="'+esc(c.id)+'">'+av(i,48,true)+'<div class="mid"><b>'+esc(i.name)+(c.kind==='group'||c.kind==='channel'?' <span class="cm-tag">'+(c.kind==='channel'?'Channel':'Group')+'</span>':'')+(c.muted?' <i class="fa-solid fa-bell-slash cm-mute" aria-label="Muted"></i>':'')+'</b><small>'+(S.drafts[c.id]?'<span style="color:#e11d48">Draft:</span> '+esc(S.drafts[c.id]):esc(lastPrev(c)))+'</small></div><div class="end"><span>'+(Date.now()-new Date(at)<DAY?hm(at):dayLabel(at))+'</span>'+(c.unread>0?'<span class="cm-badge" style="'+(c.muted?'background:var(--text-muted)':'')+'">'+(c.mention?'@ ':'')+c.unread+'</span>':c.pinned?'<i class="fa-solid fa-thumbtack"></i>':'')+'</div></div></div>';}).join('')+'</div>':'';
  if(!h&&!s)h='<div class="cm-empty"><b>No chats here</b>'+(S.fold==='All'?'Search a @handle to message a student, or join a study room below.':'Nothing in this folder.')+'</div>';
  if(s&&!L.length)h='';if(!s&&S.fold==='All')h=SPECIAL()+h;
  if(s.length>=2){h+='<div id="cm-found"></div>';}
  else if(S.fold==='All'||S.fold==='Groups'||S.fold==='Channels'){h+='<div id="cm-rooms">'+roomsBlock()+'</div>';if(!S.suggestLoaded)loadRooms('');}
  el.innerHTML=h;if(s.length>=2)searchRemote(s);}

var DISC=['All','Biology','Physics','Chemistry','Class 12','Droppers','PYQ'];
function roomsBlock(){var q=S.dq||'';return '<div class="cm-chips" style="margin-top:.6rem;overflow-x:auto;flex-wrap:nowrap">'+DISC.map(function(d){var v=d==='All'?'':d;return '<button class="cm-chip '+(q===v?'on':'')+'" style="white-space:nowrap" data-cm="disc" data-v="'+esc(v)+'">'+d+'</button>';}).join('')+'</div>'+(S.suggest&&S.suggest.length?roomsHtml(S.suggest,q?q+' rooms':'Study rooms to join'):(S.suggestLoaded&&q?'<p class="cm-muted" style="font-size:.85rem;padding:.4rem 0">No public rooms match "'+esc(q)+'" yet. Create one with the + button.</p>':''));}
function roomsHtml(list,title){if(!list||!list.length)return '';return '<div class="cm-sec">'+title+'</div><div class="cm-list">'+list.map(function(r){return '<div class="cm-row" role="button" tabindex="0" data-cm="joinRoom" data-id="'+esc(r.id)+'">'+av({name:r.name,kind:r.kind},44)+'<div class="mid"><b>'+esc(r.name)+' <span class="cm-tag">'+(r.kind==='channel'?'Channel':'Group')+'</span></b><small>'+(r.member_count?r.member_count+' member'+(r.member_count==1?'':'s'):'New room')+(r.description?' · '+esc(r.description):'')+'</small></div><span class="cm-btn ghost">Join</span></div>';}).join('')+'</div>';}
function loadRooms(q){S.suggestLoaded=true;rpc('campus_discover',{p_q:q}).then(function(r){S.suggest=r||[];var e=$('#cm-rooms');if(e)e.innerHTML=roomsBlock();},function(){});}
var searchRemote=debounce(function(s){rpc('campus_search_people',{p_q:s}).then(function(ppl){return rpc('campus_discover',{p_q:s}).then(function(rms){if(S.q.trim().toLowerCase().replace(/^@/,'')!==s)return;var e=$('#cm-found');if(!e)return;
  var known=S.inbox.filter(function(c){return c.kind==='dm';}).map(function(c){return c.other&&c.other.id;});
  var pp=(ppl||[]).filter(function(p){return known.indexOf(p.id)<0;});
  e.innerHTML=(pp.length?'<div class="cm-sec">People on Campus</div><div class="cm-list">'+pp.map(function(p){return '<div class="cm-row" role="button" tabindex="0" data-cm="startDm" data-id="'+esc(p.id)+'">'+av(p,44,true)+'<div class="mid"><b>'+esc(p.display_name||p.username)+'</b><small>@'+esc(p.username)+'</small></div><span class="cm-btn ghost">Message</span></div>';}).join('')+'</div>':'')+roomsHtml(rms,'Public rooms')+(!pp.length&&!(rms||[]).length&&!S.inbox.some(function(c){return nm(cinfo(c)).toLowerCase().indexOf(s)>=0;})?'<div class="cm-empty"><b>No one matches</b>Check the handle and try again.</div>':'');});},function(){});},250);

function paintThreadEmpty(){var t=$('#cm-thread');if(t)t.innerHTML='<div class="cm-thread-empty"><i class="fa-solid fa-comments" style="font-size:2rem;opacity:.4"></i><p style="margin-top:.6rem">Select a chat to start talking.</p></div>';}
function paintThread(){var t=$('#cm-thread'),c=curChat();if(!t)return;if(!c){S.cid=null;paintThreadEmpty();return;}
  t.className='cm-thread open';var ci=$('#cm-circle');if(ci)ci.classList.add('chat-open');
  t.innerHTML='<header class="cm-thead" id="cm-hd"></header><div id="cm-sb"></div><div id="cm-tp"></div><div id="cm-pb"></div><div class="cm-msgs" id="cm-msgs"></div><div id="cm-mb"></div><div id="cm-sd"></div><div id="cm-rp"></div><div id="cm-cb"></div>';
  paintHead();paintMsgs();paintComp();document.body.classList.toggle('cm-lock',innerWidth<1024);}
function paintHead(){var c=curChat(),e=$('#cm-hd');if(!c||!e)return;if(S.pick){e.innerHTML=pickBar();return;}var i=cinfo(c),ty=Object.keys(S.typing).filter(function(k){return Date.now()-S.typing[k]<4000;}).length;
  var st=ty?'typing…':c.kind==='saved'?'Notes to yourself':c.kind==='group'?c.member_count+' member'+(c.member_count==1?'':'s'):c.kind==='channel'?c.member_count+' subscribers'+(c.handle?' · @'+c.handle:''):'@'+i.handle+(i.online?' · online':' · last seen recently');
  e.innerHTML='<button class="cm-ib cm-thread-back" data-cm="closeChat" aria-label="Back"><i class="fa-solid fa-arrow-left"></i></button>'+av(i,40,true)+'<div class="mid"><b>'+esc(i.name)+'</b><small class="'+(ty?'t':'')+'">'+esc(st)+'</small></div><button class="cm-ib" data-cm="chatMenu" aria-label="Chat options"><i class="fa-solid fa-ellipsis-vertical"></i></button>';}
function hit(m){if(S.topic&&tagsOf(m).indexOf(S.topic)<0)return false;return !S.sq||(preview(m)+' '+(m.payload&&m.payload.subject||'')).toLowerCase().indexOf(S.sq.toLowerCase())>=0;}
function pollHtml(m){var p=m.payload||{},o=p.options||[],v=m.votes||[],t=v.reduce(function(a,b){return a+b;},0),voted=m.my_vote!=null,closed=!!p.closes&&Date.now()>p.closes,quiz=p.correct!=null,show=voted||closed;
  return '<div class="cm-inner" style="cursor:default"><b>'+esc(p.question)+'</b>'+(quiz?'<small style="display:block;margin:.15rem 0 .3rem;color:var(--teal);font-weight:800">Quiz</small>':'')+o.map(function(x,i){var pc=t&&show?Math.round((v[i]||0)/t*100):0,mark=m.my_vote===i?'✓ ':'',ol='';
    if(quiz&&show){if(i===p.correct){mark='✓ ';ol='outline:2px solid #16a34a;';}else if(m.my_vote===i){mark='✗ ';ol='outline:2px solid #e11d48;';}}
    return '<span class="cm-opt"'+(closed?'':' data-cm="vote" data-id="'+esc(m.id)+'" data-v="'+i+'"')+' style="'+ol+(closed?'cursor:default':'')+'"><span class="fill" style="width:'+pc+'%"></span><span class="ot">'+mark+esc(x)+'</span><span class="ot">'+(show?pc+'%':'')+'</span></span>';}).join('')
    +(quiz&&show&&p.explain?'<div class="cm-quote" style="margin-top:.4rem">'+esc(p.explain)+'</div>':'')
    +'<small>'+t+' vote'+(t==1?'':'s')+(closed?' · closed':(p.closes?' · closes '+new Date(p.closes).toLocaleString([],{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''))+(show?'':' · tap an option to see results')+'</small></div>';}
function duelHtml(m){var p=m.payload||{},r=m.duel||[],mine=r.some(function(x){return x.user_id===uid();}),w=r.length>1?r[0]:null;
  return '<div class="cm-inner" style="cursor:default"><b>'+esc(p.subject||'Mixed')+' duel · 10 questions</b>'+(r.length?r.map(function(x,i){return '<small>'+(i+1)+'. '+esc(x.user_id===uid()?'You':x.name)+': '+x.score+' pts · '+fmtD(x.seconds)+'</small>';}).join(''):'<small>Nobody has played yet</small>')+(w?'<small style="color:var(--teal);font-weight:800">Leading: '+esc(w.user_id===uid()?'You':w.name)+'</small>':'')+(mine?'':'<button class="cm-btn pri" style="margin-top:.4rem" data-cm="playDuel" data-id="'+esc(m.id)+'">Play this duel</button>')+'</div>';}
function voiceHtml(m){var w=(m.payload.wave&&m.payload.wave.length?m.payload.wave:new Array(24).fill(50)),d=m.payload.duration||0;return '<div class="cm-vm"><span class="cm-vp" role="button" tabindex="0" id="vb'+esc(m.id)+'" data-cm="playVoice" data-id="'+esc(m.id)+'" aria-label="Play voice message"><i class="fa-solid fa-play"></i></span><span class="cm-wv" id="vw'+esc(m.id)+'">'+w.map(function(h){return '<span style="height:'+Math.max(12,h)+'%"></span>';}).join('')+'</span><span>'+fmtD(d)+'</span></div>';}
function left(e){var m=Math.max(1,Math.ceil((new Date(e)-Date.now())/6e4));return m>=60?Math.floor(m/60)+'h':m+' min';}
function isGone(m){return m.kind==='image'&&(m.payload&&m.payload.gone||!m.media_path||(!m.media_pinned&&new Date(m.expires_at)<=Date.now()));}
function msgHtml(m,first,c){var mine=m.sender_id===uid(),g=c.kind==='group',sender=m.sender||{},sn=sender.display_name||sender.username||'EduPulse',k=m.kind,body='';
  if(g&&!mine&&first)body+='<b class="cm-who pf-link" role="button" tabindex="0" data-pf="'+esc(m.sender_id||'')+'" data-pn="'+esc(sn)+'" style="color:hsl('+hue(sn)+' 60% 45%)">'+esc(sn)+'</b>';
  if(m.forwarded_from)body+='<div class="cm-fw">Forwarded from '+esc(m.forwarded_from)+'</div>';
  if(m.reply_preview)body+='<div class="cm-quote"'+(m.reply_to?' data-cm="jump" data-id="'+esc(m.reply_to)+'"':'')+'>'+esc(m.reply_preview)+'</div>';
  if(k==='image')body+=isGone(m)?'<i style="opacity:.7">Photo expired</i>':'<img class="cm-pic" data-cm="viewImg" data-media="'+esc(m.media_path)+'" alt="Shared photo">'+(m.body?'<div class="cm-cap">'+mtx(m.body)+'</div>':'')+'<div class="cm-life">'+(m.media_pinned?'Pinned, kept':'Disappears in '+left(m.expires_at))+'</div>';
  else if(k==='voice')body+=voiceHtml(m);else if(k==='poll')body+=pollHtml(m);else if(k==='duel')body+=duelHtml(m);
  else if(k==='question'){var p=m.payload||{};body+='<div class="cm-inner" data-cm="openQ" data-id="'+esc(m.id)+'"><b>'+esc((p.subject||'')+(p.chapter?' · '+p.chapter:''))+'</b><br>'+esc(p.text||'')+'<small>Tap to open in the question bank</small></div>';}
  else body+=mtxT(m.body);
  var acts='';if(S.sel===m.id){var canPin=c.kind==='dm'||c.kind==='saved'||canAdmin(c);
    acts='<div class="cm-acts" style="align-self:'+(mine?'flex-end':'flex-start')+'"><button data-cm="reply" data-id="'+esc(m.id)+'">Reply</button><button data-cm="thread" data-id="'+esc(m.id)+'">Thread</button><button data-cm="pickStart" data-id="'+esc(m.id)+'">Select</button>'+rxQuick().map(function(e){return '<button data-cm="react" data-id="'+esc(m.id)+'" data-v="'+e+'">'+e+'</button>';}).join('')+'<button data-cm="rxMore" data-id="'+esc(m.id)+'" aria-label="More reactions">＋</button>'+(k==='image'&&mine&&!isGone(m)?'<button data-cm="pinMedia" data-id="'+esc(m.id)+'">'+(m.media_pinned?'Unpin':'Pin')+'</button>':'')+(canPin&&k!=='image'?'<button data-cm="pinMsg" data-id="'+esc(m.id)+'">'+(c.pinned_message_id===m.id?'Unpin from top':'Pin to top')+'</button>':'')+((k==='text'||k==='question')?'<button data-cm="copy" data-id="'+esc(m.id)+'">Copy</button><button data-cm="fwd" data-id="'+esc(m.id)+'">Forward</button>':(k==='image'&&m.body?'<button data-cm="copy" data-id="'+esc(m.id)+'">Copy</button>':''))+(c.kind!=='saved'?'<button data-cm="saveNote" data-id="'+esc(m.id)+'">Save</button>':'')+(mine&&k==='text'?'<button data-cm="edit" data-id="'+esc(m.id)+'">Edit</button>':'')+(mine||canAdmin(c)?'<button data-cm="delMsg" data-id="'+esc(m.id)+'">Delete</button>':(canMod(c)&&m.sender_id?'<button data-cm="modDel" data-id="'+esc(m.id)+'">Delete (mod)</button>':''))+(!mine&&m.sender_id?'<button data-cm="reportMsg" data-id="'+esc(m.id)+'">Report</button>':'')+'</div>';}
  var rx=Object.keys(m.reactions||{}).map(function(e){return '<button type="button" class="cm-rp'+(m.my_reaction===e?' on':'')+'" data-cm="react" data-id="'+esc(m.id)+'" data-v="'+esc(e)+'">'+esc(e)+(m.reactions[e]>1?'<i>'+m.reactions[e]+'</i>':'')+'</button>';}).join('');
  return '<div role="button" tabindex="0" class="cm-m '+(mine?'me':'')+(first?' first':'')+(S.pick?' picking'+(S.pick[m.id]?' picked':''):'')+'" data-cm="sel" data-id="'+esc(m.id)+'"><div class="cm-bub">'+body+thrBtn(m)+'<span class="cm-meta">'+(m.edited_at?'edited ':'')+hm(m.created_at)+'</span></div></div>'+(rx?'<div class="cm-rps" style="align-self:'+(mine?'flex-end':'flex-start')+'">'+rx+'</div>':'')+acts;}
function paintMsgs(keep,smooth){var c=curChat(),e=$('#cm-msgs');if(!c||!e)return;S.kc={};S.msgs.forEach(function(x){if(x.reply_to)S.kc[x.reply_to]=(S.kc[x.reply_to]||0)+1;});paintTopics();var prevTop=e.scrollTop,atBottom=e.scrollHeight-e.scrollTop-e.clientHeight<120,h='',d='',pm=null;
  if(S.loadingMsgs&&!S.msgs.length)h='<div class="cm-skel"></div><div class="cm-skel"></div>';
  else{if(S.more)h+='<button class="cm-btn ghost" style="align-self:center;margin:.4rem" data-cm="older">Load earlier messages</button>';
    S.msgs.forEach(function(m){if(!hit(m))return;if(m.id===S.nuId){h+='<div class="cm-day" style="color:var(--teal);border-color:var(--teal)">New messages</div>';pm=null;}
      var dd=dayLabel(m.created_at);if(dd!==d){h+='<div class="cm-day">'+dd+'</div>';d=dd;pm=null;}
      if(m.kind==='system'){h+='<div class="cm-sys">'+esc(m.body)+'</div>';pm=null;return;}
      var first=!pm||pm.sender_id!==m.sender_id||new Date(m.created_at)-new Date(pm.created_at)>3e5;pm=m;h+=msgHtml(m,first,c);});
    if(S.topic&&S.msgs.length&&!S.msgs.some(hit))h='<p style="margin:auto;color:var(--text-muted)">No messages in #'+esc(S.topic)+' yet. Send one to start this topic.</p>';
    if(!S.msgs.length)h='<p style="margin:auto;color:var(--text-muted)">No messages yet. '+(c.kind==='dm'?'Say hello to @'+esc(cinfo(c).handle)+'.':'Start the conversation.')+'</p>';}
  if(Object.keys(S.typing).some(function(k){return Date.now()-S.typing[k]<4000;}))h+='<div class="cm-typing">typing…</div>';
  h+='<div class="cm-downw"><button type="button" id="cm-down" class="cm-down" data-cm="toBottom" aria-label="Jump to latest message"><i class="fa-solid fa-chevron-down"></i></button></div>';
  var sc=$('#cm-sc');if(sc)sc.textContent=S.msgs.filter(hit).length+' found';
  var pn=S.msgs.filter(function(m){return m.id===c.pinned_message_id;})[0],pb=$('#cm-pb');if(pb)pb.innerHTML=pn?'<div class="cm-pinbar"><span>Pinned message</span><b>'+esc(preview(pn))+'</b>'+(c.kind==='dm'||c.kind==='saved'||canAdmin(c)?'<button class="cm-ib" style="width:1.8rem;height:1.8rem" data-cm="pinMsg" data-id="'+esc(pn.id)+'" aria-label="Unpin"><i class="fa-solid fa-xmark"></i></button>':'')+'</div>':'';
  e.innerHTML=h;if(keep&&!atBottom)e.scrollTop=prevTop;else e.scrollTop=e.scrollHeight;hydrate();if(S.thread)refreshThr();paintCtx();}
function buzz(){try{navigator.vibrate&&navigator.vibrate(10);}catch(e){}}
function copyText(tx){if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(tx);
  return new Promise(function(ok,no){try{var ta=D.createElement('textarea');ta.value=tx;ta.style.cssText='position:fixed;opacity:0';D.body.appendChild(ta);ta.select();var r=D.execCommand('copy');ta.remove();r?ok():no();}catch(e){no(e);}});}
var sw=null;
D.addEventListener('touchstart',function(e){var m=e.target.closest&&e.target.closest('#cm-msgs .cm-m');if(!m||e.touches.length!==1){sw=null;return;}sw={el:m,x:e.touches[0].clientX,y:e.touches[0].clientY,dx:0,on:false};},{passive:true});
D.addEventListener('touchmove',function(e){if(!sw)return;var t=e.touches[0],dx=t.clientX-sw.x,dy=t.clientY-sw.y;
  if(!sw.on&&Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){sw=null;return;}
  if(dx<-8&&Math.abs(dx)>Math.abs(dy)){sw.on=true;sw.dx=Math.max(dx,-90);sw.el.style.transition='none';sw.el.style.transform='translateX('+sw.dx+'px)';}},{passive:true});
function swEnd(ok){if(!sw)return;var s2=sw;sw=null;s2.el.style.transition='transform .18s';s2.el.style.transform='';if(ok&&s2.on&&s2.dx<=-60){buzz();A.reply({dataset:{id:s2.el.dataset.id}});}}
D.addEventListener('touchend',function(){swEnd(true);},{passive:true});D.addEventListener('touchcancel',function(){swEnd(false);},{passive:true});
D.addEventListener('scroll',function(e){var t=e.target;if(t&&t.id==='cm-msgs'){var b=$('#cm-down');if(b)b.classList.toggle('show',t.scrollHeight-t.scrollTop-t.clientHeight>350);}},true);
function closeLb(){var o=D.getElementById('cm-pv');if(o)o.remove();D.removeEventListener('keydown',lbKey);}
function lbKey(e){if(e.key==='Escape')closeLb();}
function hydrate(){var els=$$('#cm-msgs img[data-media]:not([src])');if(!els.length)return;var paths=els.map(function(x){return x.dataset.media;});
  signed(paths).then(function(map){els.forEach(function(x){if(map[x.dataset.media])x.src=map[x.dataset.media];});});}
function signed(paths){var need=paths.filter(function(p){return !S.urls[p]||S.urls[p].exp<Date.now();});
  var done=function(){var o={};paths.forEach(function(p){if(S.urls[p])o[p]=S.urls[p].url;});return o;};if(!need.length)return Promise.resolve(done());
  return client().then(function(c){return c.storage.from('campus-media').createSignedUrls(need,3600);}).then(function(r){(r.data||[]).forEach(function(x){if(x.signedUrl)S.urls[x.path]={url:x.signedUrl,exp:Date.now()+50*6e4};});return done();},function(){return done();});}

function paintComp(){var c=curChat();if(!c)return;var i=cinfo(c);
  var sd=$('#cm-sd');if(sd){var n=S.sched.length;sd.innerHTML=n?'<button class="cm-rbar" style="width:100%;text-align:left" data-cm="schedList"><b style="color:var(--teal)">Scheduled</b><span style="border:0">'+n+' message'+(n>1?'s':'')+' waiting</span></button>':'';}
  var mb=$('#cm-mb');if(mb)mb.innerHTML='';
  var rp=$('#cm-rp');if(rp)rp.innerHTML=S.editing?'<div class="cm-rbar"><span>Editing message</span><button class="cm-ib" data-cm="cancelEdit" aria-label="Cancel edit"><i class="fa-solid fa-xmark"></i></button></div>':S.replyTo?'<div class="cm-rbar"><span>'+esc(preview(S.replyTo))+'</span><button class="cm-ib" data-cm="cancelReply" aria-label="Cancel reply"><i class="fa-solid fa-xmark"></i></button></div>':'';
  var cb=$('#cm-cb');if(!cb)return;
  if(S.rec){cb.innerHTML='<div class="cm-comp"><button class="cm-ib" data-cm="recCancel" aria-label="Cancel recording"><i class="fa-solid fa-xmark"></i></button><span class="cm-recdot"></span><b id="cm-rt">0:00</b><span style="flex:1" class="cm-muted">Recording…</span><button class="cm-send" data-cm="recSend" aria-label="Send voice message"><i class="fa-solid fa-paper-plane"></i></button></div>';return;}
  if(c.kind==='channel'&&!canAdmin(c)&&!(c.official&&S.staff)){cb.innerHTML='<div class="cm-blocked">Only admins can post in this channel. <button style="color:var(--teal);font-weight:800" data-cm="toggleMute">'+(c.muted?'Unmute':'Mute')+'</button></div>';return;}
  if(i.blocked){cb.innerHTML='<div class="cm-blocked">You blocked @'+esc(i.handle)+'. <button style="color:var(--teal);font-weight:800" data-cm="unblock">Unblock</button></div>';return;}
  if(i.blocked_me){cb.innerHTML='<div class="cm-blocked">You can no longer message this student.</div>';return;}
  cb.innerHTML='<div class="cm-comp"><button class="cm-ib" data-cm="attach" aria-label="Share a question, photo, poll or duel"><i class="fa-solid fa-paperclip"></i></button><textarea id="cm-dr" rows="1" maxlength="4000" placeholder="Message'+(S.topic?' · #'+esc(S.topic):'')+'" data-in="draft">'+esc(S.drafts[c.id]||'')+'</textarea><button class="cm-ib" data-cm="recStart" aria-label="Record voice message"><i class="fa-solid fa-microphone"></i></button><button class="cm-send" data-cm="send" oncontextmenu="event.preventDefault();epCampus.sched()" aria-label="Send (right click or long press to schedule)"><i class="fa-solid fa-paper-plane"></i></button></div>';}

function openChat(id){var c=S.inbox.filter(function(x){return x.id===id;})[0];if(!c)return;S.sub='circle';S.cid=id;S.msgs=[];S.sel=null;S.replyTo=null;S.editing=0;S.sq=null;S.topic='';S.thread=null;S.pick=null;S.fmMany=null;S.typing={};S.sched=[];S.loadingMsgs=true;S.nuId=0;
  if(!$('#cm-circle')){paint();}else{var ci=$('#cm-circle');ci.classList.add('chat-open');}
  paintThread();joinTyping(id);
  rpc('campus_load_messages',{p_chat:id,p_limit:60}).then(function(rows){if(S.cid!==id)return;S.msgs=rows||[];S.more=S.msgs.length>=60;S.loadingMsgs=false;
    if(c.unread>0){var n=0,idx=-1;for(var i=S.msgs.length-1;i>=0;i--){if(S.msgs[i].sender_id!==uid()){n++;if(n===c.unread){idx=i;break;}}}if(idx>=0)S.nuId=S.msgs[idx].id;}
    c.unread=0;c.mention=false;paintMsgs();paintList();updateTabsBadge();updateNav();
    rpc('campus_mark_read',{p_chat:id}).catch(function(){});
    rpc('campus_scheduled_list',{p_chat:id}).then(function(l){S.sched=l||[];if(S.cid===id)paintComp();},function(){});
    if(c.kind==='group'||c.kind==='channel'){loadMembers(id);loadRoles(id);}},function(e){S.loadingMsgs=false;fail(e);});}
function closeChat(){leaveTyping();S.cid=null;S.sel=null;S.rec&&recCancel();document.body.classList.remove('cm-lock');var t=$('#cm-thread');if(t){t.className='cm-thread';paintThreadEmpty();}var ci=$('#cm-circle');if(ci)ci.classList.remove('chat-open');paintList();}
function loadMembers(id){rpc('campus_members_list',{p_chat:id}).then(function(l){S.members[id]=l||[];},function(){});}
function older(){var first=S.msgs[0];if(!first)return;rpc('campus_load_messages',{p_chat:S.cid,p_before:first.created_at,p_limit:60}).then(function(r){S.msgs=(r||[]).concat(S.msgs);S.more=(r||[]).length>=60;var e=$('#cm-msgs'),h=e.scrollHeight;paintMsgs(true);e.scrollTop=e.scrollHeight-h;},fail);}
/* typing via broadcast */
function joinTyping(id){leaveTyping();client().then(function(c){if(S.cid!==id)return;S.tch=c.channel('campus-typing-'+id,{config:{broadcast:{self:false}}}).on('broadcast',{event:'typing'},function(p){var u=p.payload&&p.payload.u;if(!u)return;S.typing[u]=Date.now();paintHead();setTimeout(paintHead,4200);}).subscribe();}).catch(function(){});}
function leaveTyping(){if(S.tch){try{S.tch.unsubscribe();}catch(e){}S.tch=null;}}
var lastTy=0;function sendTyping(){if(!S.tch||Date.now()-lastTy<2500)return;lastTy=Date.now();try{S.tch.send({type:'broadcast',event:'typing',payload:{u:uid()}});}catch(e){}}

/* sending */
function afterSend(m){if(!m)return;if(!S.msgs.some(function(x){return x.id===m.id;}))S.msgs.push(m);S.replyTo=null;paintComp();paintMsgs(false);hydrate();refreshInbox();}
function send(kind,body,payload,media){var c=curChat();if(!c||needHandle())return Promise.resolve();
  return rpc('campus_send',{p_chat:c.id,p_kind:kind||'text',p_body:body||'',p_payload:payload||{},p_reply_to:S.replyTo?S.replyTo.id:null,p_media_path:media||null}).then(afterSend,fail);}
function doSend(){var c=curChat(),el=$('#cm-dr');if(!c||!el)return;var t=el.value.trim();if(!t)return;
  if(S.editing){var id=S.editing;rpc('campus_edit',{p_id:id,p_body:t}).then(function(m){S.editing=0;S.drafts[c.id]='';replaceMsg(m);paintComp();},fail);return;}
  S.drafts[c.id]='';try{localStorage.setItem('ep_campus_drafts_v1',JSON.stringify(S.drafts));}catch(x){}el.value='';el.style.height='auto';send('text',withTopic(t));}
/* mentions */
function mnCheck(el){var b=$('#cm-mb'),c=curChat();if(!b||!c||c.kind!=='group')return;var m=el.value.slice(0,el.selectionStart).match(/@([a-z0-9_]*)$/i);if(!m){b.innerHTML='';return;}var k=m[1].toLowerCase();
  var L=(S.members[c.id]||[]).filter(function(p){return p.id!==uid()&&p.username&&(p.username.indexOf(k)>=0||(p.display_name||'').toLowerCase().indexOf(k)>=0);}).slice(0,4);
  b.innerHTML=L.length?'<div class="cm-mnl">'+L.map(function(p){return '<div class="cm-row" style="padding:.5rem .9rem" role="button" data-cm="mnPick" data-v="'+esc(p.username)+'">'+av(p,30)+'<div class="mid"><b>'+esc(p.display_name||p.username)+'</b><small>@'+esc(p.username)+'</small></div></div>';}).join('')+'</div>':'';}
function mnPick(h){var el=$('#cm-dr');if(!el)return;var pos=el.selectionStart,v=el.value,a=v.slice(0,pos).replace(/@[a-z0-9_]*$/i,'@'+h+' ');el.value=a+v.slice(pos);S.drafts[S.cid]=el.value;$('#cm-mb').innerHTML='';el.focus();el.setSelectionRange(a.length,a.length);}

/* ---------- voice and photos ---------- */
function recStart(){if(S.rec)return;if(needHandle())return;if(!navigator.mediaDevices||!window.MediaRecorder){toast('Voice messages are not supported in this browser.','warning');return;}
  navigator.mediaDevices.getUserMedia({audio:true}).then(function(st){var mime=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg'].filter(function(t){return MediaRecorder.isTypeSupported(t);})[0]||'';
    var mr=new MediaRecorder(st,mime?{mimeType:mime}:undefined),r={t0:Date.now(),chunks:[],st:st,mr:mr,levels:[],mime:mr.mimeType||mime||'audio/webm'};
    try{var ac=new (W.AudioContext||W.webkitAudioContext)(),an=ac.createAnalyser(),src=ac.createMediaStreamSource(st);an.fftSize=256;src.connect(an);var buf=new Uint8Array(an.frequencyBinCount);r.ac=ac;r.sample=setInterval(function(){an.getByteTimeDomainData(buf);var mx=0;for(var i=0;i<buf.length;i++)mx=Math.max(mx,Math.abs(buf[i]-128));r.levels.push(mx);},200);}catch(e){}
    mr.ondataavailable=function(e){if(e.data&&e.data.size)r.chunks.push(e.data);};mr.start();
    r.iv=setInterval(function(){var e=$('#cm-rt');if(e)e.textContent=fmtD((Date.now()-r.t0)/1000);if(Date.now()-r.t0>18e4)recSend();},250);S.rec=r;paintComp();},function(){toast('Microphone access was blocked.','warning');});}
function recStop(r){clearInterval(r.iv);clearInterval(r.sample);try{r.mr.state!=='inactive'&&r.mr.stop();}catch(e){}try{r.st.getTracks().forEach(function(t){t.stop();});}catch(e){}try{r.ac&&r.ac.close();}catch(e){}}
function recCancel(){if(!S.rec)return;recStop(S.rec);S.rec=null;if($('#cm-cb'))paintComp();}
function recSend(){var r=S.rec;if(!r)return;var dur=Math.max(1,Math.round((Date.now()-r.t0)/1000));S.rec=null;var cid=S.cid;
  r.mr.onstop=function(){var blob=new Blob(r.chunks,{type:r.mime.split(';')[0]});if(blob.size>4.5e6){toast('That voice message is too large.','warning');return;}
    var lv=r.levels,wave=[];for(var i=0;i<24;i++){var sl=lv.slice(Math.floor(i*lv.length/24),Math.max(Math.floor((i+1)*lv.length/24),Math.floor(i*lv.length/24)+1)),m=sl.length?Math.max.apply(null,sl):0;wave.push(Math.min(95,Math.max(18,Math.round(m*1.6))));}
    var ext=/mp4/.test(r.mime)?'m4a':/ogg/.test(r.mime)?'ogg':'webm';upload(cid,blob,ext).then(function(path){S.cid===cid&&send('voice','',{duration:dur,wave:wave},path);},function(e){fail(e);});};
  recStop(r);paintComp();}
function upload(cid,blob,ext){var path=cid+'/'+(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(36).slice(2))+'.'+ext;
  return client().then(function(c){return c.storage.from('campus-media').upload(path,blob,{contentType:blob.type,upsert:false});}).then(function(r){if(r.error)throw r.error;return path;});}
function pickImg(f){if(!f)return;closeSheet();var cid=S.cid,rd=new FileReader();rd.onload=function(){var im=new Image();im.onload=function(){var k=Math.min(1,800/Math.max(im.width,im.height)),cv=D.createElement('canvas');cv.width=Math.round(im.width*k);cv.height=Math.round(im.height*k);cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);
  cv.toBlob(function(b){if(!b)return;toast('Sending photo…','info');var cap=(($('#cm-dr')||{}).value||'').trim().slice(0,1000);upload(cid,b,'jpg').then(function(p){return send('image',cap,{},p).then(function(r){if(cap&&S.cid===cid){S.drafts[cid]='';var de=$('#cm-dr');if(de){de.value='';de.style.height='auto';}}return r;});}).then(function(){toast('Photo sent. It disappears in 24 hours unless pinned.','success');},fail);},'image/jpeg',.8);};im.onerror=function(){toast('That file is not an image we can read.','warning');};im.src=rd.result;};rd.readAsDataURL(f);}
var audioEl=null,audioId=null;
function playVoice(id){var m=S.msgs.filter(function(x){return x.id===id;})[0];if(!m||!m.media_path)return;if(audioEl&&audioId===id){stopVoice();return;}stopVoice();audioId=id;
  signed([m.media_path]).then(function(map){var u=map[m.media_path];if(!u){toast('Could not load this voice message.','warning');audioId=null;return;}audioEl=new Audio(u);var b=$('#vb'+id);if(b)b.innerHTML='<i class="fa-solid fa-pause"></i>';
    audioEl.ontimeupdate=function(){var w=$('#vw'+id);if(w&&audioEl&&audioEl.duration){var n=Math.floor(audioEl.currentTime/audioEl.duration*w.children.length);Array.prototype.forEach.call(w.children,function(x,i){x.style.opacity=i<n?1:'';});}};audioEl.onended=stopVoice;audioEl.play().catch(stopVoice);});}
function stopVoice(){if(audioEl){audioEl.pause();audioEl=null;}if(audioId){var b=$('#vb'+audioId),w=$('#vw'+audioId);if(b)b.innerHTML='<i class="fa-solid fa-play"></i>';if(w)Array.prototype.forEach.call(w.children,function(x){x.style.opacity='';});}audioId=null;}

/* ---------- questions in chat ---------- */
function qPicker(){sheet('<h3>Share a question</h3><select id="qp-s" onchange="epCampus._qch(this.value)">'+Object.keys(data).map(function(s){return '<option>'+s+'</option>';}).join('')+'</select><select id="qp-c" onchange="epCampus._qload()">'+(data[Object.keys(data)[0]]||[]).map(function(c){return '<option>'+esc(c)+'</option>';}).join('')+'</select><input id="qp-f" placeholder="Filter questions" data-in="qfilter"><div id="qp-l" class="cm-muted" style="font-size:.85rem">Choose a chapter to load its questions.</div>');qLoad();}
var QP=[];
function qLoad(){var s=$('#qp-s').value,c=$('#qp-c').value,l=$('#qp-l');l.innerHTML='<div class="cm-skel"></div>';preloadChapter(s,c).then(function(qs){QP=(qs||[]).filter(function(q){return q.question;});qList();},function(){l.textContent='Could not load this chapter.';});}
function qList(){var f=(($('#qp-f')||{}).value||'').toLowerCase(),l=$('#qp-l');if(!l)return;var L=QP.filter(function(q){return !f||q.question.toLowerCase().indexOf(f)>=0;}).slice(0,30);
  l.innerHTML=L.length?L.map(function(q){return '<div class="cm-item" role="button" data-cm="shareQ" data-v="'+esc(q.qKey)+'" style="align-items:flex-start"><span style="font-size:.85rem;overflow-wrap:anywhere">'+esc(q.question.slice(0,160))+'</span></div>';}).join(''):'No matching questions.';}
function shareQ(key){var q=QP.filter(function(x){return x.qKey===key;})[0];if(!q)return;var s=$('#qp-s').value,c=$('#qp-c').value;closeSheet();send('question','',{subject:s,chapter:c,text:q.question.slice(0,600),qkey:q.qKey,options:q.options.slice(0,6)});}
function openQ(id){var m=S.msgs.filter(function(x){return x.id===id;})[0];if(!m)return;var p=m.payload||{};
  var show=function(){sheet('<h3>'+esc((p.subject||'')+(p.chapter?' · '+p.chapter:''))+'</h3><p style="white-space:pre-line;line-height:1.6">'+esc(p.text||'')+'</p>'+(p.options||[]).map(function(o,i){return '<div class="cm-opt" style="cursor:default"><span class="ot">'+'ABCDEF'[i]+'. '+esc(o)+'</span></div>';}).join('')+'<p class="cm-muted" style="font-size:.8rem">This question is not in your local bank, so it is shown read-only.</p>');};
  if(!p.subject||!data[p.subject]||data[p.subject].indexOf(p.chapter)<0)return show();
  preloadChapter(p.subject,p.chapter).then(function(qs){var q=(qs||[]).filter(function(x){return x.qKey===p.qkey;})[0];if(!q)return show();
    var orig=StorageModule.get(STORAGE_KEYS.settings,defaultSettings);StorageModule.set(STORAGE_KEYS.settings,Object.assign({},orig,{practiceSource:'All',practiceLength:'all',practiceDifficulty:'mixed',shuffleQuestions:false}));
    try{document.body.classList.remove('cm-lock');launchPracticeSession(p.subject,p.chapter,[q]);}finally{StorageModule.set(STORAGE_KEYS.settings,orig);}},show);}

/* ---------- sheets ---------- */
function sheet(h,keep){clearRt();var s=$('#cm-sheet');if(!s){s=D.createElement('div');s.id='cm-sheet';s.onclick=function(e){if(e.target.id==='cm-sheet')closeSheet();};D.body.appendChild(s);}
  var p=s.firstChild;if(keep&&p&&s.className==='open'){p.innerHTML=h;return;}s.innerHTML='<div class="cm-sheet-p" role="dialog" aria-modal="true">'+h+'</div>';s.className='open';}
function closeSheet(){S.thread=null;clearRt();var s=$('#cm-sheet');if(s)s.className='';}
function item(a,t,sub,extra){return '<button class="cm-item'+(extra||'')+'" data-cm="'+a+'"><div><b>'+t+'</b>'+(sub?'<br><small class="cm-muted">'+sub+'</small>':'')+'</div></button>';}
function newSheet(){sheet('<h3>Create new</h3>'+item('createSheet" data-v="group','New group','Everyone can talk. Good for study circles.')+item('createSheet" data-v="channel','New channel','Only admins post. Anyone can subscribe.')+item('newGroupGoal','New study squad','A group with a weekly question goal.')+item('joinCode','Join with invite link or code',''));}
function createSheet(k,goal){if(needHandle())return;sheet('<h3>New '+(goal?'study squad':k)+'</h3><input id="cn" maxlength="40" placeholder="'+(k==='channel'?'Channel':'Group')+' name"><input id="cd" maxlength="280" placeholder="Description (optional)">'+(k==='channel'?'<input id="ch" maxlength="20" autocapitalize="off" placeholder="Public handle, like bio_tips">':'')+(goal?'<input id="cg" type="number" min="10" max="5000" value="500" placeholder="Weekly goal (questions)"><label style="display:flex;gap:.5rem;align-items:center;font-size:.85rem;margin-bottom:.6rem"><input type="checkbox" id="cp" style="width:auto;margin:0"> Anyone can find and join</label>':'')+'<div class="cm-st bad" id="ce"></div><button class="cm-btn pri" style="width:100%" data-cm="makeChat" data-v="'+k+'" data-g="'+(goal?1:'')+'">Create</button>');}
function makeChat(k,goal){var n=$('#cn').value.trim();if(n.length<3){$('#ce').textContent='Give it a name with at least 3 letters.';return;}
  rpc('campus_create_chat',{p_kind:k,p_name:n,p_handle:k==='channel'?$('#ch').value:null,p_description:$('#cd').value,p_public:goal?!!$('#cp').checked:false,p_weekly_goal:goal?Number($('#cg').value)||500:null}).then(function(id){closeSheet();return refreshInbox(true).then(function(){return loadSummary();}).then(function(){openChat(id);toast(k==='group'?'Group created':'Channel created','success');});},function(e){var x=$('#ce');if(x)x.textContent=errMsg(e);});}
function attach(){var q=typeof quizState!=='undefined'&&quizState&&quizState.questions&&quizState.questions.length;
  sheet('<h3>Share in chat</h3>'+item('qPicker','Question from your bank','Pick any chapter question')+'<label class="cm-item" style="cursor:pointer"><div><b>Photo from your device</b></div><input type="file" accept="image/*" hidden id="cm-file"></label>'+item('schedSheet','Schedule a message','Type it first, then choose a time')+item('pollSheet','Poll','')+item('duelSheet','Challenge to a duel','Same 10 questions, best score wins'));
  var f=$('#cm-file');if(f)f.onchange=function(){pickImg(f.files[0]);};}
function pollSheet(){sheet('<h3>New poll</h3><input id="pq" maxlength="140" placeholder="Question">'+[0,1,2,3,4,5].map(function(i){return '<input id="po'+i+'" maxlength="80" placeholder="Option '+(i+1)+(i>1?' (optional)':'')+'">';}).join('')+'<div class="cm-sec">Quiz mode (optional)</div><select id="pc"><option value="">Regular poll, no right answer</option>'+[0,1,2,3,4,5].map(function(i){return '<option value="'+i+'">Correct answer: Option '+(i+1)+'</option>';}).join('')+'</select><input id="pxp" maxlength="300" placeholder="Explanation shown after voting (optional)"><select id="pcl"><option value="0">Stays open</option><option value="1">Closes in 1 hour</option><option value="24">Closes in 24 hours</option><option value="168">Closes in 7 days</option></select><div class="cm-st bad" id="pe"></div><button class="cm-btn pri" style="width:100%" data-cm="makePoll">Send poll</button>');}
function makePoll(){var q=$('#pq').value.trim(),o=[],map={};for(var i=0;i<6;i++){var v=$('#po'+i).value.trim();if(v){map[i]=o.length;o.push(v);}}
  if(!q||o.length<2){$('#pe').textContent='Add a question and at least 2 options.';return;}
  var ck=$('#pc').value,pl={question:q,options:o};
  if(ck!==''){if(map[ck]==null){$('#pe').textContent='The correct answer must be one of the options you filled in.';return;}pl.correct=map[ck];var ex=$('#pxp').value.trim();if(ex)pl.explain=ex;}
  var hrs=Number($('#pcl').value);if(hrs)pl.closes=Date.now()+hrs*36e5;
  closeSheet();send('poll','',pl);}
function duelSheet(){sheet('<h3>Challenge to a duel</h3><p class="cm-muted" style="font-size:.85rem">Everyone in this chat plays the same 10 questions. Highest score wins, time breaks ties.</p>'+['Biology','Physics','Chemistry','Mixed'].map(function(s){return item('sendDuel" data-v="'+s,s,'');}).join(''));}
function sendDuel(s){closeSheet();send('duel','',{subject:s==='Mixed'?'Mixed':s,seed:Math.floor(Date.now()/1000)});}
function playDuel(id){var m=S.msgs.filter(function(x){return x.id===id;})[0];if(!m)return;var p=m.payload;startPlay('duel','duel:'+p.seed,p.subject==='Mixed'?null:p.subject,{msgId:id});}
function schedSheet(){var el=$('#cm-dr'),t=((el&&el.value)||'').trim();if(!t){closeSheet();toast('Type your message first, then schedule it.','info');return;}S.stx=t;
  var nx=function(h){var d=new Date();d.setHours(h,0,0,0);if(d<=Date.now())d.setDate(d.getDate()+1);return d.getTime();};
  sheet('<h3>Schedule message</h3><p class="cm-muted" style="overflow-wrap:anywhere;font-size:.85rem">“'+esc(t.slice(0,90))+'”</p>'+[['In 1 minute (demo)',Date.now()+6e4],['In 1 hour',Date.now()+H],['Tonight at 8 pm',nx(20)],['Tomorrow at 7 am',nx(7)]].map(function(a){return item('doSched" data-v="'+a[1],a[0],'');}).join('')+'<div style="display:flex;gap:.5rem;margin-top:.6rem"><input type="datetime-local" id="sdt" aria-label="Pick a date and time" style="margin:0"><button class="cm-btn ghost" data-cm="doSchedPick">Set</button></div>');}
function doSched(at){if(!at||at<Date.now()+5e3){toast('Pick a time in the future.','warning');return;}var c=curChat();rpc('campus_schedule',{p_chat:c.id,p_body:S.stx,p_send_at:new Date(at).toISOString()}).then(function(s){S.sched.push(s);S.drafts[c.id]='';closeSheet();paintComp();toast('Scheduled for '+new Date(at).toLocaleString([],{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}),'success');},fail);}
function schedList(){var L=S.sched.slice().sort(function(a,b){return new Date(a.send_at)-new Date(b.send_at);});sheet('<h3>Scheduled messages</h3>'+(L.length?L.map(function(x){return '<div class="cm-item" style="display:block"><b style="overflow-wrap:anywhere">'+esc(x.body)+'</b><small class="cm-muted" style="display:block;margin:.1rem 0 .4rem">'+new Date(x.send_at).toLocaleString()+'</small><button class="cm-chip" data-cm="schedNow" data-id="'+esc(x.id)+'">Send now</button> <button class="cm-chip" data-cm="schedDel" data-id="'+esc(x.id)+'">Delete</button></div>';}).join(''):'<p class="cm-muted">Nothing scheduled.</p>'));}
function chatMenu(){var c=curChat(),i=cinfo(c);sheet('<h3>'+esc(i.name)+'</h3>'+item('searchOn','Search in chat','')+item('exportChat','Export loaded messages','Downloads the messages currently loaded on this device as a text file.')+(c.kind==='group'||c.kind==='channel'?item('toolsSheet','Study tools','Daily challenge, study room, leaderboard, events, notes'):'')+item('infoSheet','Info, members and shared photos','')+item('toggleCompact',D.body.classList.contains('ep-cm-compact')?'Comfortable chat spacing':'Compact chat spacing','Changes message density on this device only.')+item('archive',c.archived?'Unarchive chat':'Archive chat','')+item('toggleMute',c.muted?'Unmute notifications':'Mute notifications','')+item('togglePin',c.pinned?'Unpin chat':'Pin chat','')+(c.kind==='dm'?item('reportUser','Report @'+esc(i.handle),'',' d')+item('blockUser','Block @'+esc(i.handle),'',' d'):(c.kind==='saved'?'':item('leave','Leave '+c.kind,'',' d'))));}
function saveToNotes(id){var source=S.msgs.filter(function(m){return m.id===id;})[0],notes=S.inbox.filter(function(c){return c.kind==='saved';})[0];if(!source){toast('That message is no longer loaded.','warning');return;}if(!notes){toast('Saved Messages is not available in this inbox yet.','warning');return;}rpc('campus_forward',{p_msg:id,p_chat:notes.id}).then(function(){S.sel=null;paintMsgs(true);toast('Saved to your Notes','success');},fail);}
function exportChat(){var c=curChat();if(!c)return;var lines=['EduPulse Campus export',c.name||c.kind,'Exported: '+new Date().toLocaleString(),'Only messages currently loaded in this chat are included.',''];S.msgs.slice().sort(function(a,b){return new Date(a.created_at)-new Date(b.created_at);}).forEach(function(m){var who=m.sender&&(m.sender.display_name||m.sender.username)|| (m.sender_id===uid()?'You':'Student'),body=m.kind==='image'?'[Photo]':m.kind==='voice'?'[Voice message]':m.kind==='poll'?'[Poll] '+((m.payload||{}).question||''):m.kind==='duel'?'[Quiz duel]':m.kind==='question'?'[Shared question] '+((m.payload||{}).text||''):(m.body||'');lines.push('['+new Date(m.created_at).toLocaleString()+'] '+who+': '+String(body).replace(/\s+/g,' ').trim());});var blob=new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=D.createElement('a');a.href=url;a.download='edupulse-chat-'+String(c.name||c.kind).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'.txt';D.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);closeSheet();toast('Chat export downloaded','success');}
function infoSheet(){var c=curChat(),i=cinfo(c),im=S.msgs.filter(function(m){return m.kind==='image'&&!isGone(m);});
  sheet('<div style="display:flex;gap:.8rem;align-items:center;margin-bottom:.6rem">'+av(i,56)+'<div><h3 style="margin:0">'+esc(i.name)+'</h3><small class="cm-muted">'+(c.kind==='group'?c.member_count+' members':c.kind==='channel'?c.member_count+' subscribers':c.kind==='saved'?'Only you can see this':'@'+esc(i.handle))+'</small></div></div>'+(c.description?'<p class="cm-muted" style="font-size:.85rem">'+esc(c.description)+'</p>':'')+
   (canAdmin(c)&&c.invite_code?'<button class="cm-btn ghost" data-cm="copyInvite" data-v="'+esc(c.invite_code)+'" style="margin-bottom:.6rem"><i class="fa-solid fa-link"></i> Copy invite link</button>':'')+
   (canAdmin(c)&&(c.kind==='group'||c.kind==='channel')?'<div style="display:flex;gap:.5rem"><input id="am" placeholder="Add by @handle" autocapitalize="off" style="margin:0"><button class="cm-btn pri" data-cm="addMember">Add</button></div><div class="cm-st bad" id="ame"></div>':'')+
   (canAdmin(c)&&(c.kind==='group'||c.kind==='channel')?'<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin:.6rem 0"><button class="cm-chip" data-cm="rulesSheet">Rules &amp; auto-mod</button><button class="cm-chip" data-cm="invSheet">Invite links</button><button class="cm-chip" data-cm="reqSheet">Join requests</button></div>':'')+'<div class="cm-sec">Shared photos</div>'+(im.length?'<div class="cm-photos">'+im.map(function(m){return '<img data-cm="viewImg" data-media="'+esc(m.media_path)+'" alt="Shared photo">';}).join('')+'</div>':'<p class="cm-muted" style="font-size:.85rem">No photos yet. Photos disappear after a day unless pinned.</p>')+
   (c.kind==='group'||c.kind==='channel'?'<div class="cm-sec">Members</div><div id="cm-mem"><div class="cm-skel"></div></div>':''));
  var ims=$$('#cm-sheet img[data-media]');if(ims.length)signed(ims.map(function(x){return x.dataset.media;})).then(function(map){ims.forEach(function(x){x.src=map[x.dataset.media]||'';});});
  if(c.kind==='group'||c.kind==='channel')rpc('campus_members_list',{p_chat:c.id}).then(function(l){S.members[c.id]=l;var e=$('#cm-mem');if(e)e.innerHTML=l.map(function(p){return '<div class="cm-row" style="padding:.5rem 0;cursor:default">'+av(p,36,true)+'<div class="mid"><b>'+esc(p.display_name||p.username)+'</b><small>@'+esc(p.username)+(p.role!=='member'?' · '+p.role:((S.roles[c.id]||{})[p.id]?' · '+(S.roles[c.id]||{})[p.id]:''))+'</small></div>'+(canAdmin(c)&&p.role==='member'&&p.id!==uid()?'<button class="cm-chip" data-cm="setRole" data-id="'+esc(p.id)+'" data-v="'+((S.roles[c.id]||{})[p.id]?'member':'moderator')+'">'+((S.roles[c.id]||{})[p.id]?'Remove mod':'Make mod')+'</button> ':'')+(canMod(c)&&p.role!=='owner'&&p.role!=='admin'&&p.id!==uid()?'<button class="cm-chip" data-cm="'+(canAdmin(c)?'rmMember':'modRemove')+'" data-id="'+esc(p.id)+'">Remove</button>':'')+'</div>';}).join('');},function(){});}
function handleSheet(req){var h=myHandle();sheet('<h3>'+(req?'Choose your handle to continue':'Your handle')+'</h3><input id="hi" value="'+esc(h)+'" maxlength="20" autocapitalize="off" placeholder="your_handle" data-in="handle" aria-label="Username"><div class="cm-st" id="hs"></div><div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="cm-btn pri" id="hsv" data-cm="saveHandle">Save handle</button>'+(h?'<button class="cm-btn ghost" data-cm="copyProfile">Copy profile link</button>':'')+'</div><p class="cm-muted" style="font-size:.8rem;margin-top:.7rem">Students find you by @handle or name. You can change it once every 30 days.</p>');if(h)chkHandle(h);}
var chkHandle=debounce(function(v){v=(v||'').toLowerCase();var s=$('#hs'),b=$('#hsv');if(!s)return;
  if(!/^[a-z0-9_]{3,20}$/.test(v)){s.className='cm-st bad';s.textContent='Use 3 to 20 lowercase letters, numbers or underscores.';b.disabled=true;return;}
  if(v===myHandle()){s.className='cm-st ok';s.textContent='This is your current handle.';b.disabled=true;return;}
  s.className='cm-st';s.textContent='Checking…';rpc('campus_handle_available',{p_handle:v}).then(function(ok){if(!$('#hs'))return;s.className='cm-st '+(ok?'ok':'bad');s.textContent=ok?'@'+v+' is available.':'@'+v+' is taken.';b.disabled=!ok;},function(){s.textContent='';});},300);
function saveHandle(){var v=($('#hi').value||'').toLowerCase();rpc('campus_set_handle',{p_handle:v}).then(function(){closeSheet();toast('Handle saved','success');var p=W.loadCommunityProfile&&W.loadCommunityProfile(true);return Promise.resolve(p).catch(function(){});},function(e){var s=$('#hs');if(s){s.className='cm-st bad';s.textContent=errMsg(e);}}).then(function(){repaintAll();});}
function confirmSheet(msg,act,label){sheet('<h3>'+esc(msg)+'</h3><div style="display:flex;gap:.5rem"><button class="cm-btn danger" data-cm="'+act+'">'+label+'</button><button class="cm-btn" data-cm="closeSheet">Cancel</button></div>');}
function fwdSheet(id){S.fm=id;sheet('<h3>Forward to</h3>'+S.inbox.filter(function(c){return c.kind!=='channel'||canAdmin(c);}).map(function(c){return '<button class="cm-item" data-cm="doFwd" data-id="'+esc(c.id)+'">'+av(cinfo(c),36)+'<b>'+esc(nm(cinfo(c)))+'</b></button>';}).join(''));}
function modSheet(){rpc('campus_reports_open').then(function(l){sheet('<h3>Reports</h3>'+(l.length?l.map(function(r){return '<div class="cm-card" style="margin-bottom:.5rem"><small class="cm-muted">'+esc(r.reporter)+' reported '+esc(r.target||'content')+'</small><p style="margin:.2rem 0;overflow-wrap:anywhere">'+esc(r.snippet||r.reason||'')+'</p><button class="cm-chip" data-cm="resolve" data-id="'+esc(r.id)+'" data-v="remove">Remove content</button> <button class="cm-chip" data-cm="resolve" data-id="'+esc(r.id)+'" data-v="dismiss">Dismiss</button></div>';}).join(''):'<p class="cm-muted">No open reports.</p>'));},fail);}
function reportSheet(kind,id,u){S.rep={kind:kind,id:id,u:u};sheet('<h3>Report</h3><label class="cm-muted" for="rr-cat" style="display:block;margin:.4rem 0">Reason</label><select id="rr-cat" class="cm-report-select"><option value="spam">Spam or scams</option><option value="harassment">Harassment or bullying</option><option value="hate">Hateful or abusive content</option><option value="sexual">Sexual or inappropriate content</option><option value="misinformation">Dangerous misinformation</option><option value="impersonation">Impersonation</option><option value="other">Other</option></select><textarea id="rr" rows="3" maxlength="300" placeholder="Add context for moderators (optional)"></textarea><button class="cm-btn danger" style="width:100%" data-cm="sendReport">Send report</button>');}


/* ---------- Phase 1: topics, threads, reactions ---------- */
var RX_DEF=['👍','❤️','🔥','😂','😮','🙏'];
var RX_PACKS=[['NEET',['🧬','🔬','⚛️','🧠','💯','📚','✅','❌','🎯','💡','🤯','🏆']],['Study',['📝','⏰','☕','🌙','💪','🙌','😴','😅','🥲','🤝','🚀','⭐']],['Mood',['😍','🥳','😎','🤔','😭','😡','🫡','👀','🤌','🙈','💀','🫶']]];
function rxRecent(){try{return JSON.parse(localStorage.getItem('ep_campus_rx_v1')||'[]')||[];}catch(e){return [];}}
function rxPush(e){try{var r=rxRecent().filter(function(x){return x!==e;});r.unshift(e);localStorage.setItem('ep_campus_rx_v1',JSON.stringify(r.slice(0,6)));}catch(x){}}
function rxQuick(){var r=rxRecent().slice();RX_DEF.forEach(function(e){if(r.indexOf(e)<0)r.push(e);});return r.slice(0,6);}
function tagsOf(m){if(!m||(m.kind!=='text'&&m.kind!=='image')||!m.body)return [];var o=[],r=m.body.match(/(^|\s)#[\p{L}\p{M}\p{N}_]{2,30}/gu)||[];r.forEach(function(x){var t=x.trim().slice(1).toLowerCase();if(o.indexOf(t)<0)o.push(t);});return o;}
function topicList(){var c={};S.msgs.forEach(function(m){tagsOf(m).forEach(function(t){c[t]=(c[t]||0)+1;});});return Object.keys(c).sort(function(a,b){return c[b]-c[a];}).map(function(t){return [t,c[t]];});}
function withTopic(t){if(!S.topic)return t;return t.toLowerCase().indexOf('#'+S.topic)>=0?t:t+' #'+S.topic;}
function mtxT(b){return mtx(b).replace(/(^|[\s>])#([\p{L}\p{M}\p{N}_]{2,30})(?![^<]*>)/gu,function(a,p,x){return p+'<button type="button" class="cm-ht" data-cm="topic" data-v="'+x.toLowerCase()+'">#'+x+'</button>';});}
function paintTopics(){var e=$('#cm-tp'),c=curChat();if(!e)return;if(!c||(c.kind!=='group'&&c.kind!=='channel')){e.innerHTML='';return;}
  var l=topicList(),has=S.topic&&l.some(function(x){return x[0]===S.topic;});
  e.innerHTML='<div class="cm-chips" style="padding:.3rem .8rem;overflow-x:auto;flex-wrap:nowrap;flex-shrink:0"><button class="cm-chip '+(S.topic?'':'on')+'" data-cm="topic" data-v="">All</button>'+(S.topic&&!has?'<button class="cm-chip on" data-cm="topic" data-v="'+esc(S.topic)+'">#'+esc(S.topic)+'</button>':'')+l.map(function(x){return '<button class="cm-chip '+(S.topic===x[0]?'on':'')+'" data-cm="topic" data-v="'+esc(x[0])+'">#'+esc(x[0])+' '+x[1]+'</button>';}).join('')+'<button class="cm-chip" data-cm="topicNew">＋ Topic</button></div>';}
function nmOf(m){var s=m.sender||{};return s.display_name||s.username||'EduPulse';}
function thrBtn(m){var n=S.kc&&S.kc[m.id];return n?'<button type="button" class="cm-thr" data-cm="thread" data-id="'+esc(m.id)+'"><i class="fa-regular fa-comments"></i> '+n+(n===1?' reply':' replies')+'</button>':'';}
function threadRoot(id){var m=S.msgs.filter(function(x){return x.id===id;})[0],g=0;while(m&&m.reply_to&&g++<30){var p=S.msgs.filter(function(x){return x.id===m.reply_to;})[0];if(!p)break;m=p;}return m;}
function threadAll(id){var out=[],q=[id],seen={};while(q.length){var k=q.shift();S.msgs.forEach(function(x){if(x.reply_to===k&&!seen[x.id]){seen[x.id]=1;out.push(x);q.push(x.id);}});}out.sort(function(a,b){return new Date(a.created_at)-new Date(b.created_at);});return out;}
function thrHtml(id){var root=S.msgs.filter(function(x){return x.id===id;})[0];if(!root)return '<p class="cm-muted">That message is no longer loaded.</p>';var l=threadAll(id);
  return '<div class="cm-quote" style="margin-bottom:.6rem"><b>'+esc(nmOf(root))+'</b><br>'+esc(preview(root))+'</div>'+(l.length?l.map(function(x){return '<div style="margin:.55rem 0"><b style="font-size:.78rem;color:hsl('+hue(nmOf(x))+' 60% 45%)">'+esc(nmOf(x))+'</b> <small class="cm-muted">'+hm(x.created_at)+'</small><div>'+(x.kind==='text'?mtx(x.body):esc(preview(x)))+'</div></div>';}).join(''):'<p class="cm-muted">No replies yet. Start the thread.</p>');}
function refreshThr(){var l=$('#cm-thl');if(!l||!S.thread)return;var atEnd=l.scrollHeight-l.scrollTop-l.clientHeight<60;l.innerHTML=thrHtml(S.thread);if(atEnd)l.scrollTop=l.scrollHeight;}
function threadSheet(id){var c=curChat();var can=c&&!(c.kind==='channel'&&!canAdmin(c)&&!(c.official&&S.staff));
  sheet('<h3>Thread</h3><div id="cm-thl" style="max-height:48vh;overflow:auto">'+thrHtml(id)+'</div>'+(can?'<div style="display:flex;gap:.5rem;margin-top:.6rem;align-items:center"><input id="cm-tin" maxlength="4000" placeholder="Reply in thread" style="flex:1;margin:0"><button class="cm-send" data-cm="threadSend" aria-label="Send reply"><i class="fa-solid fa-paper-plane"></i></button></div>':''));
  S.thread=id;var l=$('#cm-thl');if(l)l.scrollTop=l.scrollHeight;}

/* ---------- Phase 2: roles, invites, auto-moderation ---------- */
function canMod(c){return !!c&&(canAdmin(c)||(S.roles[c.id]||{})[uid()]==='moderator');}
function loadRoles(id){rpc('campus_roles_list',{p_chat:id}).then(function(l){var m={};(l||[]).forEach(function(x){m[x.user_id]=x.role;});S.roles[id]=m;if(S.cid===id)paintMsgs(true);},function(){});}
function joinAny(code){return rpc('campus_join_by_invite',{p_code:code}).then(function(r){var s=r&&r.status;
    if(s==='joined')return r.chat_id;
    if(s==='pending'){toast('Request sent. An admin needs to approve it.','info');return null;}
    if(s==='expired'||s==='revoked'||s==='full'){toast(s==='full'?'This invite link has reached its limit.':'This invite link is '+s+'.','warning');return null;}
    return rpc('campus_join_by_code',{p_code:code});},function(e){if(/could not find the function|schema cache/i.test((e&&e.message)||''))return rpc('campus_join_by_code',{p_code:code});throw e;});}
function invUrl(code){return location.origin+location.pathname+'#/campus/join/'+code;}
function sel(id,opts,cur){return '<select id="'+id+'">'+opts.map(function(o){return '<option value="'+o[0]+'"'+(String(cur==null?'':cur)===String(o[0])?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>';}
function rulesSheet(){var c=curChat();if(!c)return;rpc('campus_automod_get',{p_chat:c.id}).then(function(a){a=a||{};
  sheet('<h3>Group rules</h3><p class="cm-muted" style="font-size:.8rem;margin:0 0 .6rem">Admins and moderators are never blocked by these rules.</p><small class="cm-muted">Slow mode</small>'+sel('ru-s',[[0,'Off'],[10,'10 seconds'],[30,'30 seconds'],[60,'1 minute'],[300,'5 minutes']],a.slow_seconds||0)+'<small class="cm-muted">Flood limit</small>'+sel('ru-f',[[0,'Off'],[3,'3 messages per 10 sec'],[5,'5 messages per 10 sec'],[8,'8 messages per 10 sec']],a.flood_max||0)+'<label style="display:flex;gap:.5rem;align-items:center;font-size:.85rem;margin:.6rem 0"><input type="checkbox" id="ru-l" style="width:auto;margin:0"'+(a.block_links?' checked':'')+'> Block links</label><textarea id="ru-w" rows="3" placeholder="Blocked words, separated by commas" style="width:100%">'+esc((a.banned_words||[]).join(', '))+'</textarea><div class="cm-st bad" id="ru-e"></div><button class="cm-btn pri" style="width:100%" data-cm="rulesSave">Save rules</button>');},fail);}
function invSheet(){var c=curChat();if(!c)return;rpc('campus_invite_list',{p_chat:c.id}).then(function(l){l=l||[];
  sheet('<h3>Invite links</h3><small class="cm-muted">New link</small>'+sel('iv-h',[['','Never expires'],[1,'Expires in 1 hour'],[24,'Expires in 24 hours'],[168,'Expires in 7 days'],[720,'Expires in 30 days']],'')+sel('iv-m',[['','Unlimited uses'],[1,'1 use'],[10,'10 uses'],[50,'50 uses'],[100,'100 uses']],'')+'<label style="display:flex;gap:.5rem;align-items:center;font-size:.85rem;margin:.6rem 0"><input type="checkbox" id="iv-a" style="width:auto;margin:0"> Admin approval required</label><button class="cm-btn pri" style="width:100%" data-cm="invMake">Create link</button><div class="cm-sec">Your links</div>'+(l.length?l.map(function(i){var dead=i.revoked||(i.expires_at&&new Date(i.expires_at)<new Date())||(i.max_uses&&i.uses>=i.max_uses);
    return '<div class="cm-card" style="margin-bottom:.5rem"><b style="font-family:monospace">'+esc(i.code)+'</b> <small class="cm-muted">'+(i.revoked?'revoked':dead?'inactive':'active')+'</small><br><small class="cm-muted">'+i.uses+(i.max_uses?'/'+i.max_uses:'')+' joined'+(i.expires_at?' · expires '+new Date(i.expires_at).toLocaleString([],{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'')+(i.needs_approval?' · approval needed':'')+'</small><div style="display:flex;gap:.4rem;margin-top:.4rem">'+(dead?'':'<button class="cm-chip" data-cm="invCopy" data-v="'+esc(i.code)+'">Copy link</button><button class="cm-chip" data-cm="invRevoke" data-v="'+esc(i.code)+'">Revoke</button>')+'</div></div>';}).join(''):'<p class="cm-muted" style="font-size:.85rem">No custom links yet.</p>'));},fail);}
function reqSheet(){var c=curChat();if(!c)return;rpc('campus_requests_list',{p_chat:c.id}).then(function(l){l=l||[];
  sheet('<h3>Join requests</h3>'+(l.length?l.map(function(r){return '<div class="cm-row" style="padding:.5rem 0;cursor:default"><div class="mid"><b>'+esc(r.display_name||r.username||'Student')+'</b><small>'+(r.username?'@'+esc(r.username):'')+'</small></div><button class="cm-chip" data-cm="reqDo" data-id="'+esc(r.user_id)+'" data-v="1">Approve</button> <button class="cm-chip" data-cm="reqDo" data-id="'+esc(r.user_id)+'" data-v="0">Decline</button></div>';}).join(''):'<p class="cm-muted">No pending requests. Links created with "Admin approval required" send requests here.</p>'));},fail);}

/* ---------- Phase 4: study tools ---------- */
function clearRt(){if(S.rt){clearInterval(S.rt);S.rt=null;}}
function back(){return '<button class="cm-chip" data-cm="toolsSheet" style="margin-bottom:.5rem">← Study tools</button>';}
function when(iso){return new Date(iso).toLocaleString([],{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}
function toolsSheet(){var c=curChat();if(!c)return;sheet('<h3>Study tools</h3>'+item('chSheet','Daily doubt challenge','One question a day, with streaks')+item('roomSheet','Study room','A shared focus and break timer')+item('lbSheet','Leaderboard','Weekly and all-time for this Circle')+item('evSheet','Study events','Mock tests and revision sessions')+item('noteSheet','Shared notes','Notes everyone in the Circle can edit'));}
/* daily challenge */
function chSheet(){var c=curChat();if(!c)return;rpc('campus_challenge_today',{p_chat:c.id}).then(function(d){d=d||{};var h=back()+'<h3>Daily doubt challenge</h3>';
  if(!d.exists){h+='<p class="cm-muted">No challenge posted today.</p>'+(canMod(c)?'<input id="ch-q" maxlength="400" placeholder="Today\'s question">'+[0,1,2,3].map(function(i){return '<input id="ch-o'+i+'" maxlength="120" placeholder="Option '+(i+1)+(i>1?' (optional)':'')+'">';}).join('')+sel('ch-c',[[0,'Correct: Option 1'],[1,'Correct: Option 2'],[2,'Correct: Option 3'],[3,'Correct: Option 4']],0)+'<input id="ch-x" maxlength="400" placeholder="Explanation shown after answering (optional)"><div class="cm-st bad" id="ch-e"></div><button class="cm-btn pri" style="width:100%" data-cm="chPost">Post challenge</button>':'<p class="cm-muted" style="font-size:.8rem">Admins and moderators can post one.</p>');}
  else{var ans=!!d.answered,tot=ans&&d.counts?d.counts.reduce(function(a,b){return a+b;},0):0;
    h+='<div class="cm-inner" style="cursor:default"><b>'+esc(d.question)+'</b>'+d.options.map(function(o,i){var ok=ans&&i===d.correct,bad=ans&&d.choice===i&&i!==d.correct,pc=ans&&tot?Math.round((d.counts[i]||0)/tot*100):0;
      return '<span class="cm-opt"'+(ans?'':' data-cm="chAns" data-v="'+i+'"')+' style="'+(ok?'outline:2px solid #16a34a;':bad?'outline:2px solid #e11d48;':'')+(ans?'cursor:default':'')+'"><span class="fill" style="width:'+pc+'%"></span><span class="ot">'+(ok?'✓ ':bad?'✗ ':'')+esc(o)+'</span><span class="ot">'+(ans&&tot?pc+'%':'')+'</span></span>';}).join('')
      +(ans&&d.explain?'<div class="cm-quote" style="margin-top:.4rem">'+esc(d.explain)+'</div>':'')
      +'<small>'+(ans?(d.choice===d.correct?'Correct, +10 points · ':'Not this time · ')+'Streak: '+d.streak+' day'+(d.streak==1?'':'s'):'Pick one. You can answer once.'+(d.streak?' · Streak: '+d.streak:''))+'</small></div>';}
  sheet(h);},fail);}
/* study room */
function roomTick(){var R=S.room;if(!R||!$('#rm-ck')){clearRt();return;}var cyc=(R.f+R.b)*60,el=Math.max(0,(Date.now()+R.skew-R.start)/1000),pos=el%cyc,foc=pos<R.f*60,rem=Math.ceil(foc?R.f*60-pos:cyc-pos),m=Math.floor(rem/60),s=rem%60;
  $('#rm-ck').textContent=(m<10?'0':'')+m+':'+(s<10?'0':'')+s;$('#rm-ph').textContent=(foc?'Focus time':'Break time')+' · round '+(Math.floor(el/cyc)+1);
  S.rtn=(S.rtn||0)+1;if(S.rtn%15===0)roomPeople();}
function peopleHtml(l){return l&&l.length?l.map(function(p){return '<span class="cm-chip on" style="margin:0 .3rem .3rem 0">'+esc(p.name)+'</span>';}).join(''):'<small class="cm-muted">Nobody here right now.</small>';}
function roomPeople(){var R=S.room;if(!R)return;rpc('campus_room_join',{p_room:R.id}).then(function(){return rpc('campus_room_get',{p_chat:R.chat});}).then(function(d){if(!d||!d.room){if($('#rm-ck'))roomSheet();return;}var e=$('#rm-pp');if(e)e.innerHTML=peopleHtml(d.people);},function(){});}
function roomSheet(){var c=curChat();if(!c)return;rpc('campus_room_get',{p_chat:c.id}).then(function(d){d=d||{};var r=d.room;
  if(!r){S.room=null;sheet(back()+'<h3>Study room</h3><p class="cm-muted">No room is running. Start one and everyone in this Circle can join the same timer.</p><input id="rm-t" maxlength="60" placeholder="Room name (optional)">'+sel('rm-f',[[25,'25 min focus'],[50,'50 min focus'],[90,'90 min focus']],25)+sel('rm-b',[[5,'5 min break'],[10,'10 min break'],[15,'15 min break']],5)+'<button class="cm-btn pri" style="width:100%" data-cm="roomStart">Start room</button>');return;}
  S.room={id:r.id,chat:c.id,start:Date.parse(r.started_at),skew:Date.parse(d.now)-Date.now(),f:r.focus_min,b:r.break_min};
  sheet(back()+'<h3>'+esc(r.title||'Study room')+'</h3><div class="cm-card" style="text-align:center;margin-bottom:.6rem"><small id="rm-ph" class="cm-muted"></small><div id="rm-ck" style="font-size:2.6rem;font-weight:800;font-variant-numeric:tabular-nums">--:--</div><small class="cm-muted">'+r.focus_min+' min focus, '+r.break_min+' min break</small></div><div class="cm-sec">In the room</div><div id="rm-pp">'+peopleHtml(d.people)+'</div><div style="display:flex;gap:.5rem;margin-top:.8rem"><button class="cm-btn ghost" style="flex:1" data-cm="roomLeave">Leave</button>'+(d.can_end?'<button class="cm-btn ghost" style="flex:1" data-cm="roomEnd">End for everyone</button>':'')+'</div>');
  rpc('campus_room_join',{p_room:r.id}).then(function(){roomPeople();},function(){});
  roomTick();S.rtn=0;S.rt=setInterval(roomTick,1000);},fail);}
/* leaderboard */
function lbSheet(range){var c=curChat();if(!c)return;range=range==='all'?'all':'week';rpc('campus_chat_leaderboard',{p_chat:c.id,p_range:range}).then(function(l){l=l||[];var medal=['🥇','🥈','🥉'];
  sheet(back()+'<h3>Leaderboard</h3><div class="cm-chips" style="margin-bottom:.5rem"><button class="cm-chip '+(range==='week'?'on':'')+'" data-cm="lbRange" data-v="week">This week</button><button class="cm-chip '+(range==='all'?'on':'')+'" data-cm="lbRange" data-v="all">All time</button></div>'+(l.length?l.map(function(p,i){return '<div class="cm-row" style="padding:.5rem 0;cursor:default'+(p.id===uid()?';font-weight:800':'')+'"><span style="width:2rem;text-align:center">'+(medal[i]||(i+1))+'</span><div class="mid"><b>'+esc(p.name)+(p.id===uid()?' (you)':'')+'</b><small>'+p.questions+' questions'+(p.challenge?' · '+p.challenge+' challenge win'+(p.challenge==1?'':'s'):'')+'</small></div><b>'+p.total+'</b></div>';}).join(''):'<p class="cm-muted">No activity yet. Solve questions and answer the daily challenge to appear here.</p>')+'<p class="cm-muted" style="font-size:.75rem;margin-top:.6rem">Points = questions solved + 10 for each correct daily challenge.</p>');},fail);}
/* events */
function evSheet(){var c=curChat();if(!c)return;rpc('campus_events_list',{p_chat:c.id}).then(function(l){l=l||[];var KD={mock:'Mock test',revision:'Revision',doubt:'Doubt session',other:'Event'};
  sheet(back()+'<h3>Study events</h3>'+(l.length?l.map(function(e){var soon=new Date(e.starts_at)-Date.now()<36e5&&new Date(e.starts_at)-Date.now()>-72e5;return '<div class="cm-card" style="margin-bottom:.5rem"><b>'+esc(e.title)+'</b> <span class="cm-tag">'+esc(KD[e.kind]||'Event')+'</span>'+(soon?' <span class="cm-tag" style="background:rgba(225,29,72,.12);color:#e11d48">Starting soon</span>':'')+'<br><small class="cm-muted">'+when(e.starts_at)+' · '+e.going+' going</small>'+(e.details?'<p style="margin:.3rem 0;font-size:.85rem">'+esc(e.details)+'</p>':'')+'<div style="display:flex;gap:.4rem;margin-top:.4rem"><button class="cm-chip '+(e.mine?'on':'')+'" data-cm="evGo" data-id="'+esc(e.id)+'" data-v="'+(e.mine?'0':'1')+'">'+(e.mine?'Going ✓':'I\'m going')+'</button>'+(canMod(c)?'<button class="cm-chip" data-cm="evCancel" data-id="'+esc(e.id)+'">Cancel event</button>':'')+'</div></div>';}).join(''):'<p class="cm-muted">No upcoming events.</p>')
   +(canMod(c)?'<div class="cm-sec">Schedule an event</div><input id="ev-t" maxlength="80" placeholder="Title, like NEET mock test 3"><input id="ev-d" type="datetime-local">'+sel('ev-k',[['mock','Mock test'],['revision','Revision session'],['doubt','Doubt session'],['other','Other']],'mock')+'<input id="ev-x" maxlength="400" placeholder="Details (optional)"><div class="cm-st bad" id="ev-e"></div><button class="cm-btn pri" style="width:100%" data-cm="evMake">Schedule</button>':''));},fail);}
/* shared notes */
function noteSheet(){var c=curChat();if(!c)return;S.note=null;rpc('campus_notes_list',{p_chat:c.id}).then(function(l){l=l||[];
  sheet(back()+'<h3>Shared notes</h3><button class="cm-btn pri" style="width:100%;margin-bottom:.6rem" data-cm="noteNew">New note</button>'+(l.length?l.map(function(n){return '<div class="cm-row" role="button" tabindex="0" style="padding:.55rem 0" data-cm="noteOpen" data-id="'+esc(n.id)+'"><div class="mid"><b>'+esc(n.title)+'</b><small>v'+n.version+' · edited by '+esc(n.by)+' · '+when(n.updated_at)+'</small></div></div>';}).join(''):'<p class="cm-muted">No notes yet. Anyone in the Circle can create and edit them.</p>'));},fail);}
function noteEdit(id,pre){var c=curChat();if(!c)return;var go=function(n){n=n||{};S.note={id:n.id||null,ver:n.version||0};
  sheet('<button class="cm-chip" data-cm="noteSheet" style="margin-bottom:.5rem">← All notes</button><div id="nt-ban"></div><input id="nt-t" maxlength="80" placeholder="Title" value="'+esc((pre&&pre.title)||n.title||'')+'"><textarea id="nt-b" rows="11" maxlength="20000" placeholder="Write notes here" style="width:100%">'+esc((pre&&pre.body!=null)?pre.body:(n.body||''))+'</textarea>'+(n.id?'<small class="cm-muted">Version '+n.version+' · last edited by '+esc(n.by||'')+'</small>':'')+'<div style="display:flex;gap:.5rem;margin-top:.6rem;flex-wrap:wrap"><button class="cm-btn pri" style="flex:1" data-cm="noteSave">Save</button>'+(n.id?'<button class="cm-btn ghost" data-cm="noteHist">History</button>':'')+(n.id&&canMod(c)?'<button class="cm-btn ghost" data-cm="noteDel">Delete</button>':'')+'</div>');};
  if(!id){go(null);return;}rpc('campus_note_get',{p_id:id}).then(go,fail);}

/* ---------- Telegram-style message menu and multi-select ---------- */
var CTX_ICON={reply:'fa-reply',thread:'fa-comments',copy:'fa-copy',fwd:'fa-share',saveNote:'fa-bookmark',pinMsg:'fa-thumbtack',pinMedia:'fa-thumbtack',edit:'fa-pen',pickStart:'fa-circle-check',delMsg:'fa-trash',modDel:'fa-trash',reportMsg:'fa-flag'};
var CTX_ORDER=['reply','thread','copy','fwd','saveNote','pinMsg','pinMedia','edit','pickStart','delMsg','modDel','reportMsg'];
function ctxRemove(){var o=$('#cm-ctx');if(o)o.remove();}
function paintCtx(){ctxRemove();var src=$('#cm-msgs .cm-acts');if(!src)return;
  if(!S.sel||S.pick){src.remove();return;}
  var row=$('#cm-msgs .cm-m[data-id="'+String(S.sel).replace(/[^a-z0-9-]/gi,'')+'"]');
  var bs=[].slice.call(src.querySelectorAll('button')),rx=bs.filter(function(b){return b.dataset.cm==='react'||b.dataset.cm==='rxMore';}),
      rest=bs.filter(function(b){return rx.indexOf(b)<0;}).sort(function(a,b){return CTX_ORDER.indexOf(a.dataset.cm)-CTX_ORDER.indexOf(b.dataset.cm);});
  src.remove();if(!row)return;
  var o=D.createElement('div');o.id='cm-ctx';o.innerHTML='<div class="cm-ctx-bd" data-cm="ctxClose"></div><div class="cm-ctx-msg"></div><div class="cm-ctx-rx"></div><div class="cm-ctx-menu"></div>';
  var rxE=o.querySelector('.cm-ctx-rx'),mn=o.querySelector('.cm-ctx-menu'),mg=o.querySelector('.cm-ctx-msg');
  rx.forEach(function(b){rxE.appendChild(b.cloneNode(true));});
  rest.forEach(function(b){var n=b.cloneNode(false);n.innerHTML='<i class="fa-solid '+(CTX_ICON[b.dataset.cm]||'fa-circle')+'"></i><span>'+esc(b.textContent)+'</span>';if(/delMsg|modDel|reportMsg/.test(b.dataset.cm))n.className='d';mn.appendChild(n);});
  var r=row.getBoundingClientRect(),cl=row.cloneNode(true);cl.removeAttribute('data-cm');cl.removeAttribute('role');cl.removeAttribute('tabindex');cl.style.cssText='margin:0;max-width:none;width:100%;pointer-events:none';mg.appendChild(cl);
  D.body.appendChild(o);
  var vw=innerWidth,vh=innerHeight,pw=rxE.offsetWidth,ph=rxE.offsetHeight,mw=mn.offsetWidth,mh=mn.offsetHeight,mine=row.classList.contains('me');
  var hh=Math.max(40,Math.min(r.height,vh-mh-ph-48)),top=Math.max(ph+16,Math.min(r.top,vh-mh-hh-16));
  var x=function(w){return Math.max(12,Math.min(mine?r.right-w:r.left,vw-w-12));};
  mg.style.cssText='left:'+r.left+'px;top:'+top+'px;width:'+r.width+'px;max-height:'+hh+'px';
  rxE.style.cssText='left:'+x(pw)+'px;top:'+(top-ph-8)+'px';
  mn.style.cssText='left:'+x(mw)+'px;top:'+(top+Math.min(hh,r.height)+8)+'px';
  o.addEventListener('click',function(e){if(e.target.closest('.cm-ctx-menu button,.cm-ctx-rx button'))setTimeout(function(){if($('#cm-ctx')&&S.sel){S.sel=null;paintMsgs(true);}},0);});}
function pickIds(){return S.msgs.filter(function(m){return S.pick&&S.pick[m.id];}).map(function(m){return m.id;});}
function pickBar(){var n=pickIds().length;return '<button class="cm-ib" data-cm="pickX" aria-label="Cancel selection"><i class="fa-solid fa-xmark"></i></button><div class="mid"><b>'+n+' Selected</b></div><button class="cm-ib" data-cm="pickCopy" aria-label="Copy"><i class="fa-regular fa-copy"></i></button><button class="cm-ib" data-cm="pickFwd" aria-label="Forward"><i class="fa-solid fa-share"></i></button><button class="cm-ib" data-cm="pickDel" aria-label="Delete"><i class="fa-regular fa-trash-can"></i></button>';}

/* ---------- actions ---------- */
var A={
 ctxClose:function(){S.sel=null;paintMsgs(true);},
 pickStart:function(t){S.pick={};S.pick[t.dataset.id]=1;S.sel=null;paintHead();paintMsgs(true);},
 pickX:function(){S.pick=null;paintHead();paintMsgs(true);},
 pickCopy:function(){var tx=S.msgs.filter(function(m){return S.pick&&S.pick[m.id];}).map(function(m){return m.kind==='question'?((m.payload||{}).text||''):preview(m);}).join('\n\n');copyText(tx).then(function(){toast('Copied','success');},function(){toast('Could not copy','warning');});A.pickX();},
 pickFwd:function(){var ids=pickIds();if(!ids.length)return;S.fmMany=ids;fwdSheet(ids[0]);},
 pickDel:function(){var c=curChat(),ms=S.msgs.filter(function(m){return S.pick&&S.pick[m.id]&&(m.sender_id===uid()||canAdmin(c));});if(!ms.length){toast('You can only delete your own messages.','info');return;}if(!W.confirm('Delete '+ms.length+' message'+(ms.length>1?'s':'')+' for everyone?'))return;
  ms.reduce(function(p,m){return p.then(function(){return rpc('campus_delete',{p_id:m.id});});},Promise.resolve()).then(function(){var gone={};ms.forEach(function(m){gone[m.id]=1;});S.msgs=S.msgs.filter(function(m){return !gone[m.id];});S.pick=null;paintHead();paintMsgs(true);toast('Deleted','success');refreshInbox();},fail);},

 toolsSheet:toolsSheet,chSheet:chSheet,roomSheet:roomSheet,lbSheet:function(t){lbSheet(t&&t.dataset&&t.dataset.v);},lbRange:function(t){lbSheet(t.dataset.v);},evSheet:evSheet,noteSheet:noteSheet,
 chPost:function(){var c=curChat(),o=[],map={};for(var i=0;i<4;i++){var v=($('#ch-o'+i).value||'').trim();if(v){map[i]=o.length;o.push(v);}}var q=($('#ch-q').value||'').trim(),ck=Number($('#ch-c').value),e=$('#ch-e');
  if(q.length<3||o.length<2){e.textContent='Add a question and at least 2 options.';return;}if(map[ck]==null){e.textContent='The correct answer must be one of your filled options.';return;}
  rpc('campus_challenge_post',{p_chat:c.id,p_question:q,p_options:o,p_correct:map[ck],p_explain:($('#ch-x').value||'').trim()}).then(function(){toast('Challenge posted','success');chSheet();},function(x){e.textContent=errMsg(x);});},
 chAns:function(t){var c=curChat();rpc('campus_challenge_answer',{p_chat:c.id,p_choice:Number(t.dataset.v)}).then(function(){chSheet();},fail);},
 roomStart:function(){var c=curChat();rpc('campus_room_start',{p_chat:c.id,p_title:($('#rm-t').value||'').trim(),p_focus:Number($('#rm-f').value)||25,p_break:Number($('#rm-b').value)||5}).then(function(){roomSheet();},fail);},
 roomLeave:function(){var R=S.room;S.room=null;if(R)rpc('campus_room_leave',{p_room:R.id}).catch(function(){});toolsSheet();},
 roomEnd:function(){var R=S.room;if(!R)return;rpc('campus_room_end',{p_room:R.id}).then(function(){toast('Room ended','success');roomSheet();},fail);},
 evMake:function(){var c=curChat(),e=$('#ev-e'),t=($('#ev-t').value||'').trim(),d=$('#ev-d').value;if(t.length<3||!d){e.textContent='Add a title and a date and time.';return;}var dt=new Date(d);if(isNaN(dt)){e.textContent='That date is not valid.';return;}
  rpc('campus_event_create',{p_chat:c.id,p_title:t,p_kind:$('#ev-k').value,p_starts:dt.toISOString(),p_details:($('#ev-x').value||'').trim()}).then(function(){toast('Event scheduled','success');evSheet();},function(x){e.textContent=errMsg(x);});},
 evGo:function(t){rpc('campus_event_rsvp',{p_event:t.dataset.id,p_going:t.dataset.v==='1'}).then(function(){evSheet();},fail);},
 evCancel:function(t){rpc('campus_event_cancel',{p_event:t.dataset.id}).then(function(){toast('Event cancelled','success');evSheet();},fail);},
 noteNew:function(){noteEdit(null);},noteOpen:function(t){noteEdit(t.dataset.id);},
 noteSave:function(){var c=curChat(),N=S.note||{};rpc('campus_note_save',{p_chat:c.id,p_id:N.id||null,p_title:($('#nt-t').value||'').trim(),p_body:$('#nt-b').value||'',p_base:N.ver||0}).then(function(r){
    if(r&&r.status==='conflict'){S.noteLatest=r;var b=$('#nt-ban');if(b)b.innerHTML='<div class="cm-quote" style="margin-bottom:.6rem">'+esc(r.by||'Someone')+' saved a newer version (v'+r.version+') while you were editing. <button class="cm-chip" data-cm="noteLatest">Load latest</button> <button class="cm-chip" data-cm="noteOver">Overwrite with mine</button></div>';return;}
    S.note={id:r.id,ver:r.version};toast('Note saved','success');var b2=$('#nt-ban');if(b2)b2.innerHTML='';},fail);},
 noteLatest:function(){var r=S.noteLatest;if(!r)return;S.note={id:r.id,ver:r.version};$('#nt-t').value=r.title;$('#nt-b').value=r.body;$('#nt-ban').innerHTML='';toast('Loaded the latest version','info');},
 noteOver:function(){var r=S.noteLatest;if(!r)return;S.note={id:r.id,ver:r.version};A.noteSave();},
 noteHist:function(){var N=S.note;if(!N||!N.id)return;rpc('campus_note_history',{p_id:N.id}).then(function(l){S.hist=l||[];sheet('<button class="cm-chip" data-cm="noteOpen" data-id="'+esc(N.id)+'" style="margin-bottom:.5rem">← Back to note</button><h3>Version history</h3>'+S.hist.map(function(v,i){return '<div class="cm-row" style="padding:.5rem 0;cursor:default"><div class="mid"><b>v'+v.version+' · '+esc(v.title)+'</b><small>'+esc(v.by||'')+' · '+when(v.at)+'</small></div><button class="cm-chip" data-cm="noteRestore" data-v="'+i+'">Restore</button></div>';}).join(''));},fail);},
 noteRestore:function(t){var v=(S.hist||[])[Number(t.dataset.v)],N=S.note;if(!v||!N)return;noteEdit(N.id,{title:v.title,body:v.body});toast('Old version loaded. Press Save to keep it.','info');},
 noteDel:function(){var N=S.note;if(!N||!N.id)return;rpc('campus_note_delete',{p_id:N.id}).then(function(){toast('Note deleted','success');noteSheet();},fail);},

 rulesSheet:rulesSheet,invSheet:invSheet,reqSheet:reqSheet,
 rulesSave:function(){var c=curChat(),w=($('#ru-w').value||'').split(',').map(function(x){return x.trim().toLowerCase();}).filter(function(x){return x.length>=2;}).slice(0,50);
  rpc('campus_automod_set',{p_chat:c.id,p_slow:Number($('#ru-s').value)||0,p_flood:Number($('#ru-f').value)||0,p_links:!!$('#ru-l').checked,p_words:w}).then(function(){closeSheet();toast('Group rules saved','success');},function(e){var x=$('#ru-e');if(x)x.textContent=errMsg(e);});},
 invMake:function(){var c=curChat();rpc('campus_invite_create',{p_chat:c.id,p_hours:Number($('#iv-h').value)||null,p_max_uses:Number($('#iv-m').value)||null,p_approval:!!$('#iv-a').checked}).then(function(code){try{navigator.clipboard.writeText(invUrl(code));}catch(e){}toast('Link created and copied','success');invSheet();},fail);},
 invCopy:function(t){try{navigator.clipboard.writeText(invUrl(t.dataset.v));}catch(e){}toast('Invite link copied','success');},
 invRevoke:function(t){rpc('campus_invite_revoke',{p_code:t.dataset.v}).then(function(){toast('Link revoked','success');invSheet();},fail);},
 reqDo:function(t){var c=curChat();rpc('campus_request_resolve',{p_chat:c.id,p_user:t.dataset.id,p_approve:t.dataset.v==='1'}).then(function(){refreshInbox();loadMembers(c.id);reqSheet();},fail);},
 setRole:function(t){var c=curChat();rpc('campus_set_role',{p_chat:c.id,p_user:t.dataset.id,p_role:t.dataset.v}).then(function(){return rpc('campus_roles_list',{p_chat:c.id});}).then(function(l){var m={};(l||[]).forEach(function(x){m[x.user_id]=x.role;});S.roles[c.id]=m;toast(t.dataset.v==='moderator'?'Moderator added':'Moderator removed','success');infoSheet();},fail);},
 modDel:function(t){S.sel=null;rpc('campus_mod_delete',{p_id:t.dataset.id}).then(function(){S.msgs=S.msgs.filter(function(m){return m.id!==t.dataset.id;});paintMsgs(true);toast('Message removed','success');refreshInbox();},fail);},
 modRemove:function(t){rpc('campus_mod_remove',{p_chat:S.cid,p_user:t.dataset.id}).then(function(){infoSheet();refreshInbox();},fail);},

 disc:function(t){S.dq=t.dataset.v||'';loadRooms(S.dq);},
 topic:function(t){S.topic=t.dataset.v||'';S.sel=null;paintTopics();paintMsgs();paintComp();},
 topicNew:function(){sheet('<h3>New topic</h3><input id="cm-tn" maxlength="30" autocapitalize="off" placeholder="Topic name, like genetics"><p class="cm-muted" style="font-size:.8rem;margin:.2rem 0 .8rem">Messages you send while a topic is open get its #tag, so everyone can filter by it.</p><button class="cm-btn pri" style="width:100%" data-cm="topicMake">Open topic</button>');var i=$('#cm-tn');i&&i.focus();},
 topicMake:function(){var i=$('#cm-tn'),n=i?i.value.trim().toLowerCase().replace(/\s+/g,'_').replace(/[^\p{L}\p{M}\p{N}_]/gu,''):'';if(n.length<2){toast('Use at least 2 letters or numbers for a topic.','warning');return;}closeSheet();S.topic=n;paintTopics();paintMsgs();paintComp();toast('Topic #'+n+' is open','success');},
 thread:function(t){var r=threadRoot(t.dataset.id);if(!r)return;S.sel=null;paintMsgs(true);threadSheet(r.id);},
 threadSend:function(){var c=curChat(),el=$('#cm-tin');if(!c||!el||!S.thread||needHandle())return;var t=el.value.trim();if(!t)return;var rid=S.thread;el.value='';rpc('campus_send',{p_chat:c.id,p_kind:'text',p_body:t,p_payload:{},p_reply_to:rid,p_media_path:null}).then(function(m){if(!m)return;if(!S.msgs.some(function(x){return x.id===m.id;}))S.msgs.push(m);paintMsgs(true);refreshThr();refreshInbox();},fail);},
 rxMore:function(t){var id=t.dataset.id;sheet('<h3>React</h3>'+RX_PACKS.map(function(p){return '<b class="cm-muted" style="font-size:.75rem">'+p[0]+'</b><div class="cm-rxg">'+p[1].map(function(e){return '<button data-cm="react" data-id="'+esc(id)+'" data-v="'+e+'">'+e+'</button>';}).join('')+'</div>';}).join(''));},
 swipeFlag:function(t){var id=t.dataset.id,flag=t.dataset.flag,c=S.inbox.filter(function(x){return x.id===id;})[0];if(!c)return;var v=!c[flag];rpc('campus_set_flag',{p_chat:id,p_flag:flag,p_value:v}).then(function(){c[flag]=v;paintList();updateNav();toast(flag==='pinned'?(v?'Pinned to top':'Unpinned'):flag==='muted'?(v?'Muted':'Unmuted'):(v?'Archived. Find it under Archived.':'Moved back to your chats'),'success');},fail);},
 sub:function(t){S.sub=t.dataset.v;if(S.sub==='today')loadSummary().then(function(){isCampus()&&S.sub==='today'&&paintBody();});if(S.sub==='arena'){S.lbStatus='idle';}if(S.sub==='ask')S.dStatus='idle';paint();},
 retry:function(){booted=false;S.status='loading';paint();boot();},
 handle:function(){handleSheet(false);},saveHandle:saveHandle,copyProfile:function(){var u=location.origin+location.pathname+'#/u/'+myHandle();try{navigator.clipboard.writeText(u);}catch(e){}toast('Profile link copied','success');},
 playDaily:function(){startPlay('daily','daily:'+istDay(),null);},practiceDaily:function(){startPlay('practice','daily:'+istDay(),null);},
 pick:function(t){pick(Number(t.dataset.v));},nextQ:function(){nextQ();},skipQ:skipQ,quitPlay:quitPlay,closePlay:function(){closePlay();paintBody();},
 subject:function(t){S.subject=t.dataset.v;loadDoubts();var e=$('#cm-body');if(e)e.innerHTML=askView();},sort:function(t){S.sort=t.dataset.v;var e=$('#cm-body');S.dStatus='loading';if(e)e.innerHTML=askView();loadDoubts();},
 reloadDoubts:loadDoubts,askSheet:askSheet,postDoubt:postDoubt,doubt:function(t){openDoubt(t.dataset.id);},
 dvote:function(t){rpc('campus_doubt_vote',{p_id:t.dataset.id}).then(function(){loadDoubts();},fail);},
 avote:function(t){rpc('campus_answer_vote',{p_id:t.dataset.id}).then(function(){loadDoubt(t.dataset.d);},fail);},
 bestAns:function(t){rpc('campus_best_answer',{p_doubt:t.dataset.d,p_answer:t.dataset.id}).then(function(){loadDoubt(t.dataset.d);S.dStatus='idle';},fail);},
 delAns:function(t){rpc('campus_answer_delete',{p_id:t.dataset.id}).then(function(){loadDoubt(t.dataset.d);},fail);},
 postAns:function(t){if(needHandle())return;var v=($('#an-t').value||'').trim();if(v.length<2){toast('Write your answer first.','warning');return;}rpc('campus_answer_post',{p_doubt:t.dataset.id,p_body:v}).then(function(){loadDoubt(t.dataset.id);S.dStatus='idle';},fail);},
 delDoubt:function(t){rpc('campus_doubt_delete',{p_id:t.dataset.id}).then(function(){closeSheet();S.dStatus='idle';if(isCampus())paintBody();toast('Doubt deleted','success');},fail);},
 reportDoubt:function(t){reportSheet('doubt',t.dataset.id,t.dataset.u);},
 range:function(t){S.range=t.dataset.v;S.lbStatus='idle';var e=$('#cm-body');if(e)e.innerHTML=arenaView();loadLb();},
 fold:function(t){S.fold=t.dataset.v;paint();},newSheet:newSheet,createSheet:function(t){createSheet(t.dataset.v,false);},newGroupGoal:function(){createSheet('group',true);},makeChat:function(t){makeChat(t.dataset.v,!!t.dataset.g);},
 joinCode:function(){sheet('<h3>Join with invite</h3><input id="jc" placeholder="Paste invite link or code" autocapitalize="off"><button class="cm-btn pri" style="width:100%" data-cm="doJoinCode">Join</button>');},
 doJoinCode:function(){var v=($('#jc').value||'').trim().replace(/^.*join\//,'');joinAny(v).then(function(id){closeSheet();if(!id)return;return refreshInbox(true).then(function(){openChat(id);});},fail);},
 joinRoom:function(t){var id=t.dataset.id;rpc('campus_join',{p_chat:id}).then(function(){S.suggestLoaded=false;return refreshInbox(true);}).then(function(){S.sub='circle';openChat(id);},fail);},
 startDm:function(t){rpc('campus_dm_start',{p_other:t.dataset.id}).then(function(id){S.q='';return refreshInbox(true).then(function(){S.sub='circle';if(!$('#cm-circle'))paint();openChat(id);});},fail);},
 openChat:function(t){if(S.sub!=='circle'){S.sub='circle';paint();}openChat(t.dataset.id);},closeChat:closeChat,
 chatMenu:chatMenu,toggleCompact:function(){var on=!D.body.classList.contains('ep-cm-compact');D.body.classList.toggle('ep-cm-compact',on);try{localStorage.setItem('ep_campus_compact_v1',on?'1':'0');}catch(e){}closeSheet();toast(on?'Compact chat spacing enabled':'Comfortable chat spacing enabled','success');},searchOn:function(){closeSheet();S.sq='';var b=$('#cm-sb');b.innerHTML='<div class="cm-pinbar"><input id="cm-sqi" placeholder="Search this chat" data-in="chatsearch" aria-label="Search this chat"><span id="cm-sc" class="cm-muted"></span><button class="cm-ib" style="width:1.8rem;height:1.8rem" data-cm="searchOff" aria-label="Close search"><i class="fa-solid fa-xmark"></i></button></div>';$('#cm-sqi').focus();paintMsgs();},
 searchOff:function(){S.sq=null;$('#cm-sb').innerHTML='';paintMsgs();},
 exportChat:function(){exportChat();},saveNote:function(t){saveToNotes(t.dataset.id);},
 infoSheet:infoSheet,
 archive:function(){var c=curChat();rpc('campus_set_flag',{p_chat:c.id,p_flag:'archived',p_value:!c.archived}).then(function(){closeSheet();var a=!c.archived;c.archived=a;closeChat();toast(a?'Archived. Find it under Archived.':'Moved back to your chats','success');},fail);},
 toggleMute:function(){var c=curChat();rpc('campus_set_flag',{p_chat:c.id,p_flag:'muted',p_value:!c.muted}).then(function(){c.muted=!c.muted;closeSheet();paintComp();updateNav();toast(c.muted?'Muted':'Unmuted','success');},fail);},
 togglePin:function(){var c=curChat();rpc('campus_set_flag',{p_chat:c.id,p_flag:'pinned',p_value:!c.pinned}).then(function(){c.pinned=!c.pinned;closeSheet();paintList();toast(c.pinned?'Pinned to top':'Unpinned','success');},fail);},
 leave:function(){confirmSheet('Leave this '+curChat().kind+'?','doLeave','Leave');},doLeave:function(){var id=S.cid;rpc('campus_leave',{p_chat:id}).then(function(){closeSheet();S.inbox=S.inbox.filter(function(c){return c.id!==id;});closeChat();toast('You left','success');refreshInbox();},fail);},
 reportUser:function(){var i=cinfo(curChat());reportSheet('user',null,i.uid);},
 blockUser:function(){var i=cinfo(curChat());rpc('campus_block',{p_user:i.uid,p_on:true}).then(function(){closeSheet();curChat().other.blocked=true;paintComp();paintHead();},fail);},
 unblock:function(){var i=cinfo(curChat());rpc('campus_block',{p_user:i.uid,p_on:false}).then(function(){curChat().other.blocked=false;paintComp();},fail);},
 sendReport:function(){var r=S.rep,c=curChat(),cat=$('#rr-cat')?$('#rr-cat').value:'other',detail=($('#rr')&&$('#rr').value||'').trim(),reason='['+cat+']'+(detail?' '+detail:'');rpc('campus_report',{p_user:r.u||null,p_chat:c?c.id:null,p_message:r.kind==='msg'?r.id:null,p_doubt:r.kind==='doubt'?r.id:null,p_reason:reason}).then(function(){closeSheet();toast('Report sent to moderators','success');},fail);},
 reportMsg:function(t){var m=S.msgs.filter(function(x){return x.id===t.dataset.id;})[0];reportSheet('msg',t.dataset.id,m&&m.sender_id);},
 resolve:function(t){rpc('campus_report_resolve',{p_id:t.dataset.id,p_action:t.dataset.v}).then(modSheet,fail);},
 sel:function(t){if(S.pick){var pid=t.dataset.id;if(S.pick[pid])delete S.pick[pid];else S.pick[pid]=1;if(!pickIds().length)S.pick=null;paintHead();paintMsgs(true);return;}var id=t.dataset.id,now=Date.now();
  if(S.tapId===id&&now-S.tapT<320){S.tapId=null;S.sel=null;buzz();A.react({dataset:{id:id,v:'❤️'}});paintMsgs(true);return;}
  S.tapId=id;S.tapT=now;S.sel=S.sel===id?null:id;paintMsgs(true);},
 copy:function(t){var m=S.msgs.filter(function(x){return x.id===t.dataset.id;})[0];if(!m)return;S.sel=null;paintMsgs(true);
  var tx=m.kind==='question'?((m.payload||{}).text||''):(m.body||'');copyText(tx).then(function(){toast('Copied','success');},function(){toast('Could not copy','warning');});},
 jump:function(t){S.sel=null;var e=$('#cm-msgs .cm-m[data-id="'+String(t.dataset.id).replace(/[^a-z0-9-]/gi,'')+'"]');
  if(!e){toast('That message is further up. Load earlier messages first.','info');return;}
  e.scrollIntoView({block:'center',behavior:'smooth'});e.classList.add('flash');setTimeout(function(){e.classList.remove('flash');},1400);},
 link:function(t){W.open(t.getAttribute('href'),'_blank','noopener');},
 toBottom:function(){var e=$('#cm-msgs');if(e)e.scrollTo({top:e.scrollHeight,behavior:'smooth'});},
 reply:function(t){S.replyTo=S.msgs.filter(function(m){return m.id===t.dataset.id;})[0];S.sel=null;paintMsgs(true);paintComp();var e=$('#cm-dr');e&&e.focus();},cancelReply:function(){S.replyTo=null;paintComp();},
 react:function(t){S.sel=null;rxPush(t.dataset.v);closeSheet();rpc('campus_react',{p_id:t.dataset.id,p_emoji:t.dataset.v}).then(function(){return fetchMsg(t.dataset.id);}).then(function(m){m&&replaceMsg(m);},fail);},
 vote:function(t){rpc('campus_poll_vote',{p_id:t.dataset.id,p_idx:Number(t.dataset.v)}).then(function(){return fetchMsg(t.dataset.id);}).then(function(m){m&&replaceMsg(m);},fail);},
 viewImg:function(t){var u=t.currentSrc||t.getAttribute('src');if(!u)return;closeLb();var o=D.createElement('div');o.id='cm-pv';o.setAttribute('data-cm','closeLb');o.setAttribute('role','dialog');o.setAttribute('aria-label','Photo viewer');
  o.innerHTML='<button type="button" class="cm-pv-x" aria-label="Close">&times;</button><img alt="Shared photo">';o.querySelector('img').src=u;D.body.appendChild(o);D.addEventListener('keydown',lbKey);},
 closeLb:function(){closeLb();},
 pinMsg:function(t){S.sel=null;rpc('campus_pin_message',{p_chat:S.cid,p_msg:t.dataset.id}).then(function(){return refreshInbox(true);}).then(function(){paintMsgs(true);},fail);},
 pinMedia:function(t){S.sel=null;rpc('campus_pin_media',{p_id:t.dataset.id}).then(function(m){replaceMsg(m);toast(m.media_pinned?'Pinned. This photo will be kept.':'Unpinned. It disappears in 24 hours.','success');},fail);},
 edit:function(t){var m=S.msgs.filter(function(x){return x.id===t.dataset.id;})[0];S.editing=m.id;S.drafts[S.cid]=m.body;S.sel=null;S.replyTo=null;paintMsgs(true);paintComp();var e=$('#cm-dr');e&&e.focus();},cancelEdit:function(){S.editing=0;S.drafts[S.cid]='';paintComp();},
 delMsg:function(t){S.sel=null;rpc('campus_delete',{p_id:t.dataset.id}).then(function(){S.msgs=S.msgs.filter(function(m){return m.id!==t.dataset.id;});paintMsgs(true);toast('Deleted for everyone','success');refreshInbox();},fail);},
 fwd:function(t){S.fmMany=null;S.sel=null;paintMsgs(true);fwdSheet(t.dataset.id);},
 doFwd:function(t){var to=t.dataset.id,ids=S.fmMany&&S.fmMany.length?S.fmMany:[S.fm],many=!!S.fmMany;ids.reduce(function(p,id){return p.then(function(){return rpc('campus_forward',{p_msg:id,p_chat:to}).then(function(m){if(m&&to===S.cid)afterSend(m);});});},Promise.resolve()).then(function(){closeSheet();toast(ids.length>1?ids.length+' messages forwarded':'Forwarded','success');if(many){S.pick=null;S.fmMany=null;paintHead();paintMsgs(true);}refreshInbox();},fail);},
 older:older,send:doSend,attach:attach,qPicker:qPicker,shareQ:function(t){shareQ(t.dataset.v);},openQ:function(t){openQ(t.dataset.id);},
 pollSheet:pollSheet,makePoll:makePoll,duelSheet:duelSheet,sendDuel:function(t){sendDuel(t.dataset.v);},playDuel:function(t){playDuel(t.dataset.id);},
 schedSheet:schedSheet,doSched:function(t){doSched(Number(t.dataset.v));},doSchedPick:function(){doSched(new Date($('#sdt').value).getTime());},schedList:schedList,
 schedDel:function(t){rpc('campus_scheduled_cancel',{p_id:t.dataset.id}).then(function(){S.sched=S.sched.filter(function(x){return x.id!==t.dataset.id;});schedList();paintComp();},fail);},
 schedNow:function(t){var x=S.sched.filter(function(y){return y.id===t.dataset.id;})[0];rpc('campus_scheduled_cancel',{p_id:x.id}).then(function(){S.sched=S.sched.filter(function(y){return y!==x;});closeSheet();paintComp();return send('text',x.body);},fail);},
 recStart:recStart,recCancel:recCancel,recSend:recSend,playVoice:function(t){playVoice(t.dataset.id);},
 mnPick:function(t){mnPick(t.dataset.v);},copyInvite:function(t){var u=location.origin+location.pathname+'#/campus/join/'+t.dataset.v;try{navigator.clipboard.writeText(u);}catch(e){}toast('Invite link copied','success');},
 addMember:function(){var c=curChat();rpc('campus_add_member',{p_chat:c.id,p_username:$('#am').value}).then(function(){toast('Added','success');infoSheet();refreshInbox();},function(e){var x=$('#ame');if(x)x.textContent=errMsg(e);});},
 rmMember:function(t){rpc('campus_remove_member',{p_chat:S.cid,p_user:t.dataset.id}).then(function(){infoSheet();refreshInbox();},fail);},
 closeSheet:closeSheet,mod:modSheet,openCampus:function(){switchTab('campus');},playDailyFromDash:function(){switchTab('campus');S.sub='arena';setTimeout(function(){paint();},0);}
};
D.addEventListener('click',function(e){var t=e.target.closest('[data-cm]');if(!t)return;var f=A[t.dataset.cm];if(f){e.preventDefault();f(t,e);}});
D.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey&&e.target.id==='cm-tin'){e.preventDefault();A.threadSend();return;}if(e.key==='Enter'&&e.target.id==='cm-tn'){e.preventDefault();A.topicMake();return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&isCampus()){e.preventDefault();var q=$('#cm-q');if(q)q.focus();return;}
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&e.target.id==='cm-dr'){e.preventDefault();doSend();return;}
  if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('[role=button][data-cm]')){e.preventDefault();e.target.click();}
  if(e.key==='Enter'&&!e.shiftKey&&e.target.id==='cm-dr'){e.preventDefault();doSend();}
  if(P&&!P.locked&&P.set&&/^[1-5]$/.test(e.key)&&Number(e.key)<=P.set.questions[P.i].options.length)pick(Number(e.key)-1);
  if(e.key==='Escape')closeSheet();});
D.addEventListener('input',function(e){var el=e.target,k=el.dataset&&el.dataset.in;if(!k)return;
  if(k==='search'){S.q=el.value;paintList();}
  else if(k==='draft'){S.drafts[S.cid]=el.value;try{localStorage.setItem('ep_campus_drafts_v1',JSON.stringify(S.drafts));}catch(x){}el.style.height='auto';el.style.height=Math.min(el.scrollHeight,112)+'px';mnCheck(el);sendTyping();}
  else if(k==='chatsearch'){S.sq=el.value;paintMsgs();}
  else if(k==='handle')chkHandle(el.value);
  else if(k==='qfilter')qList();});
D.addEventListener('contextmenu',function(e){if(e.target.closest&&e.target.closest('[data-cm="send"]'))e.preventDefault();});
(function(){var tm;D.addEventListener('pointerdown',function(e){var b=e.target.closest&&e.target.closest('[data-cm="send"]');if(!b)return;tm=setTimeout(function(){tm=0;schedSheet();},650);});['pointerup','pointercancel','pointerleave'].forEach(function(n){D.addEventListener(n,function(){if(tm){clearTimeout(tm);tm=0;}},true);});})();

/* ---------- routing ---------- */
function applyHash(){var h=location.hash,j=h.match(/^#\/campus\/join\/([a-f0-9]{6,20})$/i),c=h.match(/^#\/campus\/c\/([a-z0-9_]{3,20})$/),u=h.match(/^#\/u\/([a-z0-9_]{3,20})$/);if(!j&&!c&&!u)return;
  if(!me()){return;}
  boot().then(function(){
    if(j)return joinAny(j[1]).then(go);
    if(c)return rpc('campus_join_by_handle',{p_handle:c[1]}).then(go);
    return rpc('campus_search_people',{p_q:u[1]}).then(function(l){var p=(l||[]).filter(function(x){return x.username===u[1];})[0];if(!p){toast('No student with that handle.','info');return;}return rpc('campus_dm_start',{p_other:p.id}).then(go);});
  }).catch(fail).then(function(){try{history.replaceState(null,'',location.pathname+location.search);}catch(e){}});
  function go(id){if(!id)return;return refreshInbox(true).then(function(){S.sub='circle';if(!$('#cm-circle'))paint();openChat(id);});}}
W.addEventListener('hashchange',function(){if(/^#\/(campus|u)\//.test(location.hash)){if(!isCampus())switchTab('campus');else applyHash();}});
W.addEventListener('load',function(){setTimeout(function(){if(/^#\/(campus|u)\//.test(location.hash)){if(!isCampus())switchTab('campus');}else warm();},900);});
W.addEventListener('resize',debounce(function(){if(isCampus()&&S.sub==='circle')document.body.classList.toggle('cm-lock',!!S.cid&&innerWidth<1024);},150));
var _sw=W.switchTab;if(typeof _sw==='function'){W.switchTab=function(t){if(t==='communities')t='campus';if(t!=='campus')document.body.classList.remove('cm-lock');return _sw.call(this,t);};}
setTimeout(function(){var api=API();if(!api)return;api.ready().then(function(c){c.client.auth.onAuthStateChange(function(ev,s){if(ev==='SIGNED_OUT'){booted=false;S.status='idle';S.inbox=[];S.summary=null;S.daily=null;S.cid=null;if(S.ch){try{S.ch.unsubscribe();}catch(e){}S.ch=null;}document.body.classList.remove('cm-lock');updateNav();if(isCampus())paint();dashPaint();}else if(ev==='SIGNED_IN'||ev==='INITIAL_SESSION'){setTimeout(function(){warm();if(isCampus())paint();},300);}});}).catch(function(){});},1200);

/* ---------- dashboard card ---------- */
function dashHtml(){var s=S.summary,tile=function(ic,l,v,sub,act){return '<button type="button" class="cmd-t" data-cm="'+act+'"><i class="fa-solid '+ic+'"></i><small>'+l+'</small><b>'+v+'</b><em>'+sub+'</em></button>';};
  if(!me())return '<div class="cmd-h"><h3>Campus</h3></div><p class="cm-muted" style="font-size:.85rem;margin-bottom:.7rem">Play the Daily 10, ask doubts and study with friends. Sign in to join.</p><button type="button" class="cm-btn pri" data-cm="openCampus">Explore Campus</button>';
  if(S.status==='error')return '<div class="cmd-h"><h3>Campus</h3><button type="button" data-cm="openCampus">Open Campus →</button></div><p class="cm-muted" style="font-size:.85rem">'+esc(S.error)+'</p>';
  if(!s&&(S.status==='loading'||S.status==='idle'))return '<div class="cmd-h"><h3>Campus</h3><button type="button" data-cm="openCampus">Open Campus →</button></div><div class="cm-skel" style="height:5rem;margin:0"></div>';
  if(!s)return '<div class="cmd-h"><h3>Campus</h3></div><p class="cm-muted" style="font-size:.85rem;margin-bottom:.7rem">Daily 10, doubts and study circles.</p><button type="button" class="cm-btn pri" data-cm="openCampus">Open Campus</button>';
  var d=s.daily||{},sq=s.squad;
  return '<div class="cmd-h"><h3>Campus</h3><button type="button" data-cm="openCampus">Open Campus →</button></div><div class="cmd-grid">'+
   tile('fa-bolt','Daily 10',d.played?d.score+'/40':'Play now',d.played?'Rank #'+d.rank+' of '+d.participants:(d.streak?d.streak+'-day streak':'10 questions, 6 min'),'playDailyFromDash')+
   tile('fa-comments','Messages',s.unread>0?s.unread+' unread':'All caught up','Chats and study rooms','openCampus')+
   tile('fa-circle-question','Doubts',s.open_doubts+' open','Help someone this week','openCampus')+
   (sq?tile('fa-user-group','Squad',sq.week_questions+'/'+sq.weekly_goal,sq.studied_today+' of '+sq.members+' studied today','openCampus'):tile('fa-user-group','Study now',(s.active||1)+' active','Start a study squad','openCampus'))+'</div>';}
W.epCampusDashHtml=function(){setTimeout(function(){if(me()&&!booted)warm();else if(me()&&booted&&Date.now()-(S.sumAt||0)>60000)loadSummary().then(dashPaint);dashPaint();},0);return '<section class="ep-cm-dash" data-ep-cm-dash><div class="cmd" data-cm-dash-in>'+dashHtml()+'</div></section>';};
function dashPaint(){$$('[data-cm-dash-in]').forEach(function(e){e.innerHTML=dashHtml();});}
W.epCircleLink={chats:function(){return S.inbox.filter(function(c){return !c.archived;}).slice(0,40).map(function(c){return {id:c.id,name:cinfo(c).name,kind:c.kind};});},say:function(id,t){S.drafts[id]=t;try{localStorage.setItem('ep_campus_drafts_v1',JSON.stringify(S.drafts));}catch(x){}switchTab('campus');setTimeout(function(){S.sub='circle';if(!$('#cm-circle'))paint();openChat(id);},150);}};
W.epCampus={_chs:function(v){var e=$('#as-c');if(e)e.innerHTML=chOpts(v);},_qch:function(v){var e=$('#qp-c');if(e){e.innerHTML=(data[v]||[]).map(function(c){return '<option>'+esc(c)+'</option>';}).join('');qLoad();}},_qload:qLoad,sched:schedSheet,open:function(){switchTab('campus');},refresh:function(){return boot().then(function(){return loadSummary();}).then(dashPaint);},syncStudy:syncStudy};
})();


;

/* Profile & Settings — one Telegram-style settings screen (Profile · Study · Backup · Account). Works signed out. */
(function(){'use strict';
var origProfile=window.renderCommunityProfile,SEC='profile',_ph='';
window.__epProfileExtras=window.__epProfileExtras||{};
function esc(v){return escapeHtml(v==null?'':v);}
function sess(){var a=window.__epCommunityApi;return a&&a.session&&a.session();}
function study(){
  var settings=StorageModule.get(STORAGE_KEYS.settings,defaultSettings);
  return `  <div class="card p-6 border-l-4 border-l-teal-500 space-y-6">
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
  </div>`;
}
function backup(){return `  <div class="card p-6 border-l-4 border-l-indigo-500 space-y-4">
    <div><h2 class="text-xl font-black text-slate-900 dark:text-slate-100">Backup &amp; restore</h2><p class="text-xs text-slate-500 mt-1">Without an account, progress stays in this browser. Signed-in accounts sync supported study data. Export a backup before switching devices; API keys are never included.</p></div>
    <div class="flex flex-wrap gap-3">
      <button type="button" onclick="exportBackup()" class="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-indigo-600/20"><i class="fa-solid fa-download mr-1.5"></i>Download backup</button>
      <button type="button" onclick="document.getElementById('backup-file').click()" class="rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-xs font-black"><i class="fa-solid fa-upload mr-1.5"></i>Restore from file</button>
      <input id="backup-file" type="file" accept="application/json,.json" class="hidden" onchange="importBackupFile(this.files[0]); this.value=''">
    </div>
  </div>
`;}
function acct(){
  var s=sess(),u=s&&s.user,st=StorageModule.get(STORAGE_KEYS.settings,defaultSettings)||{};
  var row=function(ic,t,sub,fn){return '<button type="button" class="ah-item" onclick="'+fn+'"><span class="ic"><i class="fa-solid '+ic+'"></i></span><span style="flex:1;min-width:0">'+t+'<small>'+sub+'</small></span><i class="fa-solid fa-chevron-right" style="color:var(--text-muted);font-size:.7rem"></i></button>';};
  var list='';
  if(u){list+=row('fa-cloud-arrow-up','Sync now','Back up your study data to your account','__bzAcc.now&&__bzAcc.now()');}
  list+=row('fa-key','Pulse AI key','Add or change your AI connection','__bzAcc.configureAi()')+
        row('fa-stethoscope','Help & diagnostics','Check app health, question data and AI connection','__bzAcc.openDiagnostics()')+
        '<label class="ah-item" style="cursor:pointer"><span class="ic"><i class="fa-solid fa-circle-half-stroke"></i></span><span style="flex:1">High contrast<small>Stronger boundaries and keyboard focus outlines</small></span><input type="checkbox" '+(st.highContrast?'checked ':'')+'onchange="__bzAcc.setHighContrast(this.checked)"></label>';
  var head=u?'<div class="cp-card" style="padding:0;overflow:hidden"><div class="ah-item" style="cursor:default"><span class="ic"><i class="fa-solid fa-envelope"></i></span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">'+esc(u.email||'')+'<small>Signed in</small></span></div></div>':'';
  return '<div class="grid gap-4">'+head+'<div class="cp-card" style="padding:0;overflow:hidden">'+list+'</div>'+(u?'<button type="button" class="cp-btn" style="color:#e11d48;border-color:rgba(225,29,72,.4)" onclick="__bzAcc.logout()"><i class="fa-solid fa-right-from-bracket mr-1"></i> Log out</button>':'')+'</div>';
}
function profileSec(){
  var html=_ph;
  var s=sess();
  if(s&&s.user){html=html.replace(/<section class="card flex items-center gap-4[\s\S]*?<\/section>/,'');}
  else{html='';} /* signed out: the header above already has Create account / Log in */
  var X=window.__epProfileExtras||{},ex='';
  ['hero','xp'].forEach(function(k){if(typeof X[k]==='function'){try{ex+=X[k]();}catch(e){console.warn('profile extra',k,e);}}});
  return ex+html;
}
window.epIdentity=function(){
  var s=sess(),u=s&&s.user,d={},ap={},xs=null;
  try{d=(window.__epProfileData&&window.__epProfileData())||{};}catch(e){}
  try{ap=(window.getAspirantProfile&&getAspirantProfile())||{};}catch(e){}
  try{xs=window.epXpStats&&window.epXpStats();}catch(e){}
  return{signedIn:!!u,
    name:d.display_name||(ap.onboarded&&ap.name)||(u&&(u.name||u.email))||'Aspirant',
    handle:d.username?'@'+d.username:'',
    img:d.avatar_url||'',
    emoji:(ap.onboarded&&ap.avatar&&ap.avatar.e)||'',
    level:xs?{l:xs.l,title:xs.title}:null};
};
function head(){
  var s=sess(),u=s&&s.user,I=window.epIdentity(),nm=I.name,img=I.img,un=I.handle,emo=I.emoji;
  var h=0;String(nm).split('').forEach(function(c){h=(h*31+c.charCodeAt(0))%360;});
  var avatar=img?'<span class="cp-av xl" style="--h:'+h+'"><img src="'+esc(img)+'" alt="" referrerpolicy="no-referrer"></span>':'<span class="cp-av xl" style="--h:'+h+'">'+esc(emo||String(nm).trim().charAt(0).toUpperCase()||'S')+'</span>';
  var share=(u&&un)?'<button type="button" class="cp-btn" onclick="epAcct.copyLink()"><i class="fa-solid fa-link mr-1"></i> Share profile link</button>':'';
  return '<section class="ah-head">'+avatar+'<div style="min-width:0;flex:1"><h2 class="truncate text-xl font-black">'+esc(nm)+'</h2><p class="text-sm" style="color:var(--text-muted)">'+(un||(u?'Choose a username below':'Study offline, or sign in to join Campus'))+'</p><div class="mt-3 flex flex-wrap gap-2">'+(u?share:'<button type="button" class="cp-btn pri" onclick="__bzAcc.open(\'signup\')">Create account</button><button type="button" class="cp-btn" onclick="__bzAcc.open(\'login\')">Log in</button>')+'</div></div></section>';
}
window.renderAccountHub=function(sec){
  if(sec)SEC=sec;
  _ph=origProfile?origProfile():'';
  var tabs=[['profile','Profile','fa-user'],['study','Study','fa-sliders'],['backup','Backup','fa-cloud'],['account','Account','fa-gear']];
  var body=SEC==='study'?study():SEC==='backup'?backup():SEC==='account'?acct():profileSec();
  return '<div class="mx-auto grid max-w-3xl gap-4 animate-fadeIn">'+head()+'<nav class="ah-seg" role="tablist" aria-label="Profile and settings">'+tabs.map(function(t){return '<button type="button" role="tab" aria-selected="'+(SEC===t[0])+'" class="'+(SEC===t[0]?'on':'')+'" onclick="epAcct.go(\''+t[0]+'\')"><i class="fa-solid '+t[2]+' mr-1"></i>'+t[1]+'</button>';}).join('')+'</nav>'+body+'</div>';
};
window.renderCommunityProfile=function(){return window.renderAccountHub();};
window.epAcct={
  go:function(s){SEC=s;if(typeof renderView==='function')renderView();},
  open:function(s){SEC=s||'profile';},
  copyLink:function(){var d=window.__epProfileData&&window.__epProfileData();if(!d||!d.username)return;var url=location.origin+location.pathname+'#/u/'+d.username;
    if(navigator.share)navigator.share({title:'EduPulse profile',url:url}).catch(function(){});else if(navigator.clipboard)navigator.clipboard.writeText(url).then(function(){showToast('Profile link copied.','success');});}
};
})();

;

(function(){
'use strict';
var state={client:null,user:null,loadedUser:null,circles:[],members:[],stats:{},community:null,pins:[],posts:[],tab:'feed',quizzes:[],voteMap:{},library:null,expandedPermanent:null,leaderboard:[],profile:null,me:null,draft:[],issues:[],meta:{},quiz:null,questions:[],answers:{},index:0,started:0,left:0,timer:null,result:null,busy:false,attempts:[],preview:false,pending:{},boardKind:'creators',loading:false,error:'',fileName:'',dq:'',dsub:'All',discOpen:null,compose:{type:'talk',subj:'General',text:''},ff:{type:'all',tag:''},qf:{subj:'All',sort:'new'},marked:{},rf:'all',af:{q:'',subj:'All',sort:'top'},over:{},myHidden:false,featFeed:null,featOver:null,imgUrls:{},cmts:{},attach:[],posting:false};
var $=function(id){return document.getElementById(id);};
var esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
var api=function(){return window.__epCommunityApi;};
function note(m,t){try{showToast(m,t||'info');}catch(e){}}
function call(name,args){return state.client.rpc(name,args||{}).then(function(r){if(r.error)throw r.error;return r.data;});}
function userId(){return state.user&&state.user.id;}
function refresh(){var root=$('ep-circle-hub');if(root)root.innerHTML=markup();}
function fail(e){state.loading=false;state.error=e&&e.message||'Something went wrong. Please try again.';refresh();}
function ready(){var a=api();if(!a||!a.ready)return Promise.reject(new Error('Account service is not ready.'));return a.ready().then(function(x){state.client=x.client;state.user=a.session&&a.session()&&a.session().user||null;var id=state.user&&state.user.id||null;if(state.loadedUser!==id){state.loadedUser=id;state.circles=[];state.members=[];state.community=null;state.pins=[];state.posts=[];state.quizzes=[];state.me=null;state.profile=null;state.tab='feed';}return x.client;});}
function load(){if(state.loading)return;state.loading=true;state.error='';loadOverview();ready().then(function(c){if(!state.user){state.loading=false;refresh();return;}return Promise.all([
 c.from('communities').select('id,slug,name,description,icon,created_at').order('name'),
 c.from('community_members').select('community_id,role').eq('user_id',userId()),
 c.rpc('ep_community_stats')
]).then(function(r){r.forEach(function(x){if(x.error)throw x.error;});state.circles=r[0].data||[];state.members=r[1].data||[];state.stats={};(r[2].data||[]).forEach(function(x){state.stats[x.community_id]=x.member_count;});state.loading=false;if(!state.community&&state.circles.length){var deep=location.hash.match(/^#\/community\/([a-z0-9-]+)$/i),target=deep&&state.circles.find(function(x){return x.slug===decodeURIComponent(deep[1]);}),joined=state.circles.find(function(x){return isMember(x.id);});selectCircle((target||joined||state.circles[0]).id,true);}else refresh();});}).catch(fail);}
function isMember(id){return state.members.some(function(x){return x.community_id===id;});}
function role(id){var m=state.members.find(function(x){return x.community_id===id;});return m&&m.role||'guest';}
function selectCircle(id,loadNow){state.error='';stopTimer();state.preview=false;state.quiz=null;state.result=null;state.community=state.circles.find(function(x){return x.id===id;})||null;state.tab='feed';state.posts=[];state.quizzes=[];state.pins=[];state.library=null;state.profile=null;refresh();if(loadNow!==false&&state.community&&isMember(id))loadCircle();}
function join(id){if(!userId()){note('Log in to join a Circle.','warning');return;}state.busy=true;refresh();state.client.from('community_members').insert({community_id:id,user_id:userId()}).then(function(r){if(r.error&&r.error.code!=='23505')throw r.error;return state.client.from('community_members').select('community_id,role').eq('user_id',userId());}).then(function(r){if(r.error)throw r.error;state.members=r.data||[];state.busy=false;note('You joined the Circle.','success');selectCircle(id,true);scrollWS();}).catch(function(e){state.busy=false;fail(e);});}
function loadCircle(){if(!state.community||!isMember(state.community.id))return;var id=state.community.id;state.loading=true;refresh();Promise.all([
 state.client.from('community_pins').select('id,community_id,slot,title,body,url').eq('community_id',id).order('slot'),
 state.client.from('community_posts').select('id,community_id,author_id,body,created_at').eq('community_id',id).order('created_at',{ascending:false}).limit(30),
 state.client.from('quiz_submissions').select('id,community_id,creator_id,title,description,subject,chapter,difficulty,question_count,duration_minutes,attempts_count,created_at').eq('community_id',id).order('created_at',{ascending:false}).limit(50),
 state.client.rpc('ep_quiz_vote_summary',{p_community_id:id}),
 state.client.rpc('ep_student_hub_summary',{p_community_id:id})
]).then(function(r){r.forEach(function(x){if(x.error)throw x.error;});state.pins=r[0].data||[];state.posts=r[1].data||[];var metrics={};(r[3].data||[]).forEach(function(x){metrics[x.quiz_id]=x;});state.quizzes=(r[2].data||[]).map(function(q){return Object.assign({},q,metrics[q.id]||{});}).sort(function(a,b){return Number(b.quality_score||0)-Number(a.quality_score||0)||new Date(b.created_at)-new Date(a.created_at);});state.me=(r[4].data||{}).me||{};state.loading=false;refresh();}).catch(fail);}
function setTab(t){stopTimer();state.tab=t;state.error='';state.result=null;refresh();if(!state.community||!isMember(state.community.id))return;if(t==='feed')loadPosts();if(t==='quizzes')loadQuizzes();if(t==='archive')loadLibrary();if(t==='leaderboards')loadMe();if(t==='pins')loadPins();if(t==='attempts')loadAttempts();}
function isMissingFn(e){var m=String(e&&e.message||'')+' '+String(e&&e.code||'');return /PGRST202|Could not find the function|does not exist|schema cache|Bucket not found/i.test(m);}
function uid32(){return (window.crypto&&crypto.randomUUID)?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2,10);}
function canMod(){return ['admin','moderator'].includes(role(state.community.id));}
function loadPostsLegacy(){return state.client.from('community_posts').select('id,community_id,author_id,body,created_at').eq('community_id',state.community.id).order('created_at',{ascending:false}).limit(30).then(function(r){if(r.error)throw r.error;state.posts=r.data||[];return hydrateAuthors(state.posts);});}
function normPost(r){return {id:r.id,community_id:r.community_id,author_id:r.author_id,body:r.body,created_at:r.created_at,likes:Number(r.like_count||0),ncom:Number(r.comment_count||0),liked:!!r.liked,imgs:r.images||[],author:{username:r.author_username,display_name:r.author_name,avatar_url:r.author_avatar}};}
function signImages(posts){var now=Date.now(),need=[];posts.forEach(function(p){(p.imgs||[]).forEach(function(i){var c=state.imgUrls[i.path];if(!c||c.exp<now+60000)need.push(i.path);});});if(!need.length||!state.client.storage)return Promise.resolve();return state.client.storage.from('circle-posts').createSignedUrls(need,3600).then(function(r){(r.data||[]).forEach(function(x){if(x.signedUrl)state.imgUrls[x.path]={url:x.signedUrl,exp:now+3500000};});}).catch(function(){});}
function loadPosts(){if(!state.community)return;var cid=state.community.id,p;if(state.featFeed===false)p=loadPostsLegacy();else p=call('ep_circle_feed',{p_community:cid,p_limit:30,p_before:null}).then(function(rows){state.featFeed=true;state.posts=(rows||[]).map(normPost);return signImages(state.posts);}).catch(function(e){if(!isMissingFn(e))throw e;state.featFeed=false;return loadPostsLegacy();});p.then(refresh).catch(fail);}
/* ---- online counts + avatars ---- */
function typingNow(){var a=document.activeElement,h=document.getElementById('ep-circle-hub');return !!(a&&/INPUT|TEXTAREA/.test(a.tagName)&&h&&h.contains(a));}
function loadOverview(){ready().then(function(){if(!state.user||state.featOver===false)return null;return call('ep_circle_overview');}).then(function(rows){if(!rows)return;var m={};rows.forEach(function(x){m[x.community_id]=x;});state.over=m;state.featOver=true;state.myHidden=!!(rows[0]&&rows[0].me_hidden);if(!typingNow())refresh();}).catch(function(e){if(isMissingFn(e))state.featOver=false;});}
var presTimer=null;
function startPresence(){if(presTimer)return;var tick=function(){if(document.visibilityState!=='visible'||!document.getElementById('ep-circle-hub')||!state.user||state.featOver===false)return;call('ep_presence_touch',{p_hidden:null}).catch(function(e){if(isMissingFn(e))state.featOver=false;});};tick();presTimer=setInterval(function(){tick();if(state.featOver!==false&&document.getElementById('ep-circle-hub'))loadOverview();},120000);}
function memCount(c){var o=state.over[c.id];return o?Number(o.member_count):Number(state.stats[c.id]||0);}
function onlineN(c){var o=state.over[c.id];return o?Number(o.online_count||0):0;}
function statLine(c){var n=memCount(c),on=onlineN(c);return '<p class="epc-statline"><span>'+n+' student'+(n===1?'':'s')+'</span>'+(on>0?'<span class="epc-online"><i aria-hidden="true"></i>'+on+' online</span>':'')+'</p>';}
function avStack(c){var o=state.over[c.id],a=(o&&o.avatars)||[];if(!a.length)return '';var n=memCount(c);return '<div class="epc-avs" aria-hidden="true">'+a.slice(0,4).map(function(x){var nm=x.n||'?';return '<span class="epc-pav sm" style="--h:'+hueOf(nm)+'">'+esc(String(nm).charAt(0).toUpperCase())+(x.u?'<img src="'+esc(x.u)+'" alt="" onerror="this.remove()">':'')+'</span>';}).join('')+(n>a.length?'<span class="epc-avm">+'+(n-a.length)+'</span>':'')+'</div>';}
function presenceHtml(){if(state.featOver!==true)return '';return '<label class="epc-pres"><input type="checkbox" '+(state.myHidden?'':'checked')+' onchange="epCircleHub.presence(this.checked)"> Show when I\'m online</label>';}
/* ---- photos ---- */
function compressImage(file){return new Promise(function(res,rej){if(!/^image\//.test(file.type))return rej(new Error('Only images can be attached.'));if(file.size>15*1024*1024)return rej(new Error('Each photo must be under 15 MB.'));var url=URL.createObjectURL(file),img=new Image();img.onload=function(){var s=Math.min(1,1280/Math.max(img.width,img.height)),w=Math.round(img.width*s),h=Math.round(img.height*s),cv=document.createElement('canvas');cv.width=w;cv.height=h;var g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,w,h);g.drawImage(img,0,0,w,h);URL.revokeObjectURL(url);cv.toBlob(function(b){if(!b)return rej(new Error('Could not process that photo.'));if(b.size>3*1024*1024)return rej(new Error('Photo is still too large after compression.'));res({blob:b,w:w,h:h,preview:URL.createObjectURL(b),id:Math.random().toString(36).slice(2)});},'image/jpeg',0.8);};img.onerror=function(){URL.revokeObjectURL(url);rej(new Error('That file is not a readable image.'));};img.src=url;});}
function pickImgs(input){var files=[].slice.call(input.files||[]);input.value='';var room=4-state.attach.length;if(room<=0){note('You can attach up to 4 photos.','warning');return;}Promise.all(files.slice(0,room).map(function(f){return compressImage(f).catch(function(e){note(e.message,'warning');return null;});})).then(function(a){a.filter(Boolean).forEach(function(x){state.attach.push(x);});if(files.length>room)note('Only 4 photos per post.','warning');refresh();});}
function rmImg(id){state.attach=state.attach.filter(function(x){if(x.id===id)URL.revokeObjectURL(x.preview);return x.id!==id;});refresh();}
function lightbox(path){var c=state.imgUrls[path];if(!c)return;var o=document.createElement('div');o.className='epc-lbov';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');o.innerHTML='<button type="button" class="epc-lbx" aria-label="Close photo"><i class="fa-solid fa-xmark"></i></button><img alt="Photo attached to a post" src="'+esc(c.url)+'">';var k=function(e){if(e.key==='Escape')cl();};var cl=function(){o.remove();document.removeEventListener('keydown',k);};o.addEventListener('click',cl);document.addEventListener('keydown',k);document.body.appendChild(o);}
function imgGrid(p){var im=p.imgs||[];if(!im.length)return '';return '<div class="epc-imgs n'+Math.min(im.length,4)+'">'+im.map(function(i){var c=state.imgUrls[i.path];return c?'<button type="button" class="epc-img" aria-label="Open photo" onclick="epCircleHub.lightbox(\''+esc(i.path)+'\')"><img src="'+esc(c.url)+'" alt="Photo attached to post" loading="lazy"></button>':'<span class="epc-img ph"><i class="fa-regular fa-image"></i></span>';}).join('')+'</div>';}
/* ---- publish ---- */
function post(){var cp=state.compose,txt=(cp.text||'').trim(),hasImg=state.attach.length>0;if(state.posting)return;if(!txt&&!hasImg){note('Write something or attach a photo.','warning');return;}if(txt.length>2000){note('Posts are limited to 2,000 characters.','warning');return;}var label=(cp.type==='doubt'||cp.subj!=='General')?'['+cp.type+':'+cp.subj+']':'';var body=txt?(label?label+' ':'')+txt:label;if(body.length>2000){note('Post is too long once the label is added.','warning');return;}
state.posting=true;refresh();var cid=state.community.id,imgs=state.attach.slice();
var done=function(){state.posting=false;cp.text='';state.attach.forEach(function(x){URL.revokeObjectURL(x.preview);});state.attach=[];note(cp.type==='doubt'?'Doubt posted.':'Posted to your Circle.','success');loadPosts();};
var legacy=function(){if(!txt)throw new Error('Photo posts need the latest database update. Add some text, or ask your admin to apply it.');return state.client.from('community_posts').insert({community_id:cid,author_id:userId(),body:body}).then(function(r){if(r.error)throw r.error;});};
var viaRpc=function(){return Promise.all(imgs.map(function(x){var path=cid+'/'+userId()+'/'+uid32()+'.jpg';return state.client.storage.from('circle-posts').upload(path,x.blob,{contentType:'image/jpeg',upsert:false}).then(function(r){if(r.error)throw r.error;return {path:path,w:x.w,h:x.h};});})).then(function(list){return call('ep_post_create',{p_community:cid,p_body:body,p_images:list});});};
var run=state.featFeed===false?Promise.resolve().then(legacy):viaRpc().then(function(){state.featFeed=true;},function(e){if(!isMissingFn(e))throw e;state.featFeed=false;return legacy();});
run.then(done).catch(function(e){state.posting=false;fail(e);});}
/* ---- likes, comments, delete ---- */
function cm_(id){return state.cmts[id]||(state.cmts[id]={open:false,list:[],loading:false,text:'',reply:null,busy:false});}
function findPost(id){return state.posts.find(function(x){return x.id===id;});}
function toggleLike(id){var p=findPost(id);if(!p)return;p.liked=!p.liked;p.likes+=p.liked?1:-1;refresh();call('ep_post_toggle_like',{p_post:id}).then(function(r){if(r){p.liked=!!r.liked;p.likes=Number(r.count);refresh();}}).catch(function(e){p.liked=!p.liked;p.likes+=p.liked?1:-1;refresh();fail(e);});}
function loadComments(id){var c=cm_(id);c.loading=true;refresh();call('ep_comment_list',{p_post:id}).then(function(rows){c.list=rows||[];c.loading=false;refresh();}).catch(function(e){c.loading=false;fail(e);});}
function toggleComments(id){var c=cm_(id);c.open=!c.open;refresh();if(c.open)loadComments(id);}
function replyTo(pid,cid){var c=cm_(pid);if(!cid)c.reply=null;else{var t=c.list.find(function(x){return x.id===cid;});c.reply=t?{id:cid,name:t.author_name||t.author_username||'Student'}:null;}refresh();var el=$('epc-ci-'+pid);if(el)el.focus();}
function sendComment(pid){var c=cm_(pid),txt=(c.text||'').trim();if(!txt||c.busy)return;c.busy=true;call('ep_comment_add',{p_post:pid,p_body:txt,p_parent:c.reply?c.reply.id:null}).then(function(){c.text='';c.reply=null;c.busy=false;var p=findPost(pid);if(p)p.ncom++;loadComments(pid);}).catch(function(e){c.busy=false;fail(e);});}
function delComment(pid,cid){call('ep_comment_delete',{p_comment:cid}).then(function(){var p=findPost(pid);if(p&&p.ncom>0)p.ncom--;loadComments(pid);}).catch(fail);}
function delPost(id){openModal('<h3 id="epc-mt">Delete this post?</h3><p class="x-sub">Its photos, likes and comments will be removed too. This can\'t be undone.</p><div class="epc-mact"><button type="button" class="epc-btn" onclick="epCircleHub.closeModal()">Cancel</button><button type="button" class="epc-btn epc-danger" onclick="epCircleHub.delPostGo(\''+id+'\')">Delete</button></div>');}
function delPostGo(id){closeModal();call('ep_post_delete',{p_post:id}).then(function(paths){state.posts=state.posts.filter(function(x){return x.id!==id;});refresh();if(paths&&paths.length&&state.client.storage)state.client.storage.from('circle-posts').remove(paths).catch(function(){});note('Post deleted.','success');}).catch(fail);}
function commentsHtml(p,cm){var list=cm.list||[],top=list.filter(function(c){return !c.parent_id;}),kids=function(id){return list.filter(function(c){return c.parent_id===id;});};
var one=function(c,isReply){var nm=c.author_name||c.author_username||'Student';return '<div class="epc-c'+(isReply?' re':'')+'"><span class="epc-pav sm" style="--h:'+hueOf(nm)+'" aria-hidden="true">'+esc(String(nm).charAt(0).toUpperCase())+'</span><div class="min-w-0 flex-1"><div class="epc-phead"><b>'+esc(nm)+'</b><time class="epc-muted" title="'+esc(new Date(c.created_at).toLocaleString())+'">· '+relT(c.created_at)+'</time></div>'+(c.deleted?'<p class="epc-muted"><i>Comment removed</i></p>':'<p>'+esc(c.body)+'</p><div class="epc-cact">'+(isReply?'':'<button type="button" onclick="epCircleHub.reply(\''+p.id+'\',\''+c.id+'\')">Reply</button>')+((c.author_id===userId()||canMod())?'<button type="button" onclick="epCircleHub.delComment(\''+p.id+'\',\''+c.id+'\')">Delete</button>':'')+'</div>')+'</div></div>';};
var rows=(cm.loading&&!list.length)?'<div class="epc-muted text-xs">Loading comments…</div>':(top.length?top.map(function(c){return one(c,false)+kids(c.id).map(function(k){return one(k,true);}).join('');}).join(''):'<div class="epc-muted text-xs">No comments yet. Start the conversation.</div>');
var rp=cm.reply?'<div class="epc-replying">Replying to <b>'+esc(cm.reply.name)+'</b><button type="button" aria-label="Cancel reply" onclick="epCircleHub.reply(\''+p.id+'\',null)"><i class="fa-solid fa-xmark"></i></button></div>':'';
return '<div class="epc-cmts">'+rows+rp+'<div class="epc-cform"><input id="epc-ci-'+p.id+'" class="epc-field" maxlength="1000" placeholder="Write a comment…" aria-label="Write a comment" value="'+esc(cm.text||'')+'" oninput="epCircleHub.cText(\''+p.id+'\',this.value)" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();epCircleHub.cSend(\''+p.id+'\');}"><button type="button" class="epc-btn accent" onclick="epCircleHub.cSend(\''+p.id+'\')">Send</button></div></div>';}
function postActions(p){if(state.featFeed!==true)return '';var cm=state.cmts[p.id]||{},own=p.author_id===userId();return '<div class="epc-pact"><button type="button" class="epc-act'+(p.liked?' on':'')+'" aria-pressed="'+!!p.liked+'" aria-label="Like" onclick="epCircleHub.like(\''+p.id+'\')"><i class="fa-'+(p.liked?'solid':'regular')+' fa-heart"></i><span>'+p.likes+'</span></button><button type="button" class="epc-act'+(cm.open?' on':'')+'" aria-expanded="'+!!cm.open+'" aria-label="Comments" onclick="epCircleHub.comments(\''+p.id+'\')"><i class="fa-regular fa-comment"></i><span>'+p.ncom+'</span></button>'+((own||canMod())?'<button type="button" class="epc-act ml-auto" aria-label="Delete post" onclick="epCircleHub.delPost(\''+p.id+'\')"><i class="fa-regular fa-trash-can"></i></button>':'')+'</div>'+(cm.open?commentsHtml(p,cm):'');}
function hydrateAuthors(rows){var ids=[...new Set(rows.map(function(x){return x.author_id;}))];if(!ids.length)return Promise.resolve();return state.client.from('profiles').select('id,username,display_name,avatar_url').in('id',ids).then(function(r){if(r.error)throw r.error;var map={};(r.data||[]).forEach(function(x){map[x.id]=x;});rows.forEach(function(x){x.author=map[x.author_id]||{};});});}
var SUBJ_COLOR={General:'#0d9488',Biology:'#059669',Physics:'#2563eb',Chemistry:'#d97706'};
function hueOf(s){s=String(s||'?');var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))%360;return h;}
function relT(t){var m=Math.round((Date.now()-new Date(t).getTime())/6e4);if(m<1)return 'now';if(m<60)return m+'m';if(m<1440)return Math.round(m/60)+'h';if(m<10080)return Math.round(m/1440)+'d';return new Date(t).toLocaleDateString(undefined,{day:'numeric',month:'short'});}
function parsePost(b){b=String(b||'');var m=b.match(/^\[(doubt|talk):(General|Biology|Physics|Chemistry)\]\s?/);return m?{type:m[1],subj:m[2],text:b.slice(m[0].length)}:{type:'talk',subj:'General',text:b};}
function bodyHtml(t){return esc(t).replace(/(^|\s)#([A-Za-z0-9_]{2,30})/g,function(_,s,tag){return s+'<button type="button" class="epc-hash" onclick="epCircleHub.feedFilter(\'#'+tag+'\')">#'+tag+'</button>';});}
function loadPins(){state.client.from('community_pins').select('id,slot,title,body,url,updated_at').eq('community_id',state.community.id).order('slot').then(function(r){if(r.error)throw r.error;state.pins=r.data||[];refresh();}).catch(fail);}
function closeModal(){var o=document.getElementById('epc-modal');if(o)o.remove();document.removeEventListener('keydown',modalKey);}
function modalKey(e){if(e.key==='Escape')closeModal();}
function openModal(html){closeModal();var o=document.createElement('div');o.id='epc-modal';o.className='x-ov';o.innerHTML='<div class="x-box" role="dialog" aria-modal="true" aria-labelledby="epc-mt">'+html+'</div>';o.addEventListener('click',function(e){if(e.target===o)closeModal();});document.body.appendChild(o);document.addEventListener('keydown',modalKey);var f=o.querySelector('input,textarea');if(f)f.focus();return o;}
function isPinned(p){return !!(p&&(p.title||p.body));}
function editPin(slot){if(!['admin','moderator'].includes(role(state.community.id))){note('Only Circle admins and moderators can edit permanent pins.','warning');return;}var p=state.pins.find(function(x){return x.slot===slot;})||{};openModal('<h3 id="epc-mt">'+(isPinned(p)?'Edit pin':'New pin')+'</h3><p class="x-sub">Pins stay at the top of this Circle for everyone. You can have up to 5.</p><label class="epc-flabel" for="epc-pt">Title</label><input id="epc-pt" type="text" maxlength="80" value="'+esc(p.title||'')+'" placeholder="e.g. NCERT Biology chapter list"><label class="epc-flabel" for="epc-pb">Note <span class="epc-muted" id="epc-pbc">'+String((p.body||'').length)+'/500</span></label><textarea id="epc-pb" rows="4" maxlength="500" oninput="document.getElementById(\'epc-pbc\').textContent=this.value.length+\'/500\'" placeholder="What should students know?">'+esc(p.body||'')+'</textarea><label class="epc-flabel" for="epc-pu">Link (optional, https only)</label><input id="epc-pu" type="text" inputmode="url" value="'+esc(p.url||'')+'" placeholder="https://"><div class="epc-mact"><button type="button" class="epc-btn" onclick="epCircleHub.closeModal()">Cancel</button><button type="button" class="epc-btn primary" onclick="epCircleHub.pinSave('+slot+')">Save pin</button></div>');}
function pinSave(slot){var title=(document.getElementById('epc-pt').value||'').trim().slice(0,80),body=(document.getElementById('epc-pb').value||'').trim().slice(0,500),url=(document.getElementById('epc-pu').value||'').trim();if(!title){note('Give the pin a title.','warning');return;}if(url&&!/^https:\/\//i.test(url)){note('Links must start with https://','warning');return;}var p=state.pins.find(function(x){return x.slot===slot;});var vals={title:title,body:body,url:url||null};var q=p&&p.id?state.client.from('community_pins').update(vals).eq('id',p.id):state.client.from('community_pins').insert({community_id:state.community.id,slot:slot,title:title,body:body,url:url||null});q.then(function(r){if(r.error)throw r.error;closeModal();loadPins();note('Pin saved.','success');}).catch(function(e){closeModal();fail(e);});}
function loadQuizzes(){if(!state.community)return;Promise.all([state.client.from('quiz_submissions').select('id,community_id,creator_id,title,description,subject,chapter,difficulty,question_count,duration_minutes,attempts_count,created_at').eq('community_id',state.community.id).order('created_at',{ascending:false}).limit(50),call('ep_quiz_vote_summary',{p_community_id:state.community.id})]).then(function(r){if(r[0].error)throw r[0].error;var m={};(r[1]||[]).forEach(function(x){m[x.quiz_id]=x;});state.quizzes=(r[0].data||[]).map(function(q){return Object.assign({},q,m[q.id]||{});}).sort(function(a,b){return Number(b.quality_score||0)-Number(a.quality_score||0);});refresh();}).catch(fail);}
function norm(v){return String(v==null?'':v).replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim().toLowerCase();}
function answerIndex(q,opts){var a=q.a;if(a!==undefined){if(typeof a==='string'&&/^[A-F]$/i.test(a.trim()))return a.trim().toUpperCase().charCodeAt(0)-65;if(Number.isInteger(Number(a)))return Number(a)-1;}var c=q.correct;if(c!==undefined){if(typeof c==='string'&&/^[A-F]$/i.test(c.trim()))return c.trim().toUpperCase().charCodeAt(0)-65;if(Number.isInteger(Number(c)))return Number(c);}var x=q.answer;if(x!==undefined){if(typeof x==='string'){var m=x.trim().match(/^([A-F])(?:[\).:]|$)/i);if(m)return m[1].toUpperCase().charCodeAt(0)-65;var by=opts.findIndex(function(o){return norm(o)===norm(x);});if(by>=0)return by;}if(Number.isInteger(Number(x)))return Number(x)-1;}if(q.answerIndex!==undefined&&Number.isInteger(Number(q.answerIndex)))return Number(q.answerIndex);return -1;}
function validate(raw){var list=Array.isArray(raw)?raw:(raw&&Array.isArray(raw.questions)?raw.questions:(raw&&Array.isArray(raw.qs)?raw.qs:null)),issues=[],out=[],seen={};if(!list)return {questions:[],issues:[{index:0,message:'JSON must be an array or contain a questions or qs array.'}]};if(list.length<5||list.length>100)issues.push({index:0,message:'Quiz must contain 5–100 questions; found '+list.length+'.'});list.forEach(function(q,i){var local=[],stem=q&&(q.question??q.q??q.text??''),opts=q&&(q.options??q.o??q.opts),ex=q&&(q.explanation??q.solution??q.e??'');if(!q||typeof q!=='object'||Array.isArray(q))local.push('Question must be an object.');if(typeof stem!=='string'||!stem.trim())local.push('Question text is missing.');if(typeof stem==='string'&&stem.length>5000)local.push('Question exceeds 5,000 characters.');if(!Array.isArray(opts)||opts.length<2||opts.length>6)local.push('Options must contain 2–6 choices.');if(Array.isArray(opts)&&opts.some(function(x){return typeof x!=='string'||!x.trim()||x.length>1000;}))local.push('Options must be non-empty text under 1,000 characters.');var ai=q&&Array.isArray(opts)?answerIndex(q,opts):-1;if(ai<0||!Array.isArray(opts)||ai>=opts.length)local.push('Valid answer key missing (a is 1-based; correct/answerIndex are 0-based).');if(typeof ex!=='string'||ex.length>5000)local.push('Explanation must be text under 5,000 characters.');var key=norm(stem)+'::'+(Array.isArray(opts)?opts.map(norm).sort().join('|'):'');if(stem&&opts&&seen[key]!==undefined)local.push('Duplicate of question '+(seen[key]+1)+'.');else if(stem&&opts)seen[key]=i;local.forEach(function(m){issues.push({index:i+1,message:m});});out.push({prompt:String(stem||'').trim(),options:Array.isArray(opts)?opts.map(function(x){return String(x||'').trim();}):[],correct_index:ai,explanation:String(ex||'').trim()});});return {questions:out,issues:issues};}
function readQuizFile(input){var f=input.files&&input.files[0];if(!f)return;if(f.size>2*1024*1024){note('JSON file must be 2 MB or smaller.','warning');return;}var reader=new FileReader();reader.onload=function(){try{var raw=JSON.parse(reader.result),v=validate(raw);state.draft=v.questions;state.issues=v.issues;state.meta=raw.meta||{};state.fileName=f.name;state.preview=false;refresh();}catch(e){state.issues=[{index:0,message:'Invalid JSON: '+e.message}];state.draft=[];refresh();}};reader.readAsText(f);}
function previewQuiz(){if(state.issues.length||state.draft.length<5||state.draft.length>100){note('Fix every validation issue before previewing.','warning');return;}var title=($('epc-quiz-title')||{}).value||state.meta.title||state.fileName.replace(/\.json$/i,'');var subject=$('epc-quiz-subject')&&$('epc-quiz-subject').value||state.meta.subject||'Biology';var chapter=($('epc-quiz-chapter')||{}).value||state.meta.chapter||'General';var diff=($('epc-quiz-diff')||{}).value||'mixed';var duration=Math.max(1,Math.min(180,Number(($('epc-quiz-duration')||{}).value)||20));if(!title.trim()||!chapter.trim()){note('Add a title and chapter.','warning');return;}state.pending={title:title.trim(),subject:subject,chapter:chapter.trim(),difficulty:diff,duration:duration,description:(($('epc-quiz-desc')||{}).value||'').slice(0,300)};state.preview=true;refresh();}
function publishQuiz(){if(!state.preview){previewQuiz();return;}if(state.busy)return;state.busy=true;refresh();call('ep_publish_quiz',{p_payload:{community_id:state.community.id,title:state.pending.title,description:state.pending.description,subject:state.pending.subject,chapter:state.pending.chapter,difficulty:state.pending.difficulty,duration_minutes:state.pending.duration,questions:state.draft}}).then(function(){state.busy=false;state.draft=[];state.issues=[];state.preview=false;state.fileName='';state.tab='quizzes';note('Quiz published. Voting is open for 24 hours.','success');loadQuizzes();}).catch(function(e){state.busy=false;fail(e);});}
function vote(id,v){var q=state.quizzes.find(function(x){return x.id===id;});if(!q)return;if(q.creator_id===userId()){note('You cannot vote on your own quiz.','warning');return;}call('ep_quiz_vote',{p_quiz_id:id,p_vote:v}).then(function(){note('Vote saved. You can change it while voting is open.','success');loadQuizzes();}).catch(fail);}
function reportQuiz(id){epAsk.choose('What is wrong with this quiz?',[{value:'wrong_answers',label:'Wrong answers'},{value:'duplicate',label:'Duplicate'},{value:'spam',label:'Spam'},{value:'misleading',label:'Misleading'},{value:'inappropriate',label:'Inappropriate'},{value:'other',label:'Something else'}],{title:'Report this quiz'}).then(function(reason){if(!reason)return;return call('ep_quiz_report',{p_quiz_id:id,p_reason:reason,p_details:''}).then(function(){note('Report submitted.','success');loadQuizzes();})}).catch(fail);}
function shuffle(a){var x=a.slice();for(var i=x.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=x[i];x[i]=x[j];x[j]=t;}return x;}
function startQuiz(id){state.busy=true;refresh();call('ep_quiz_get_questions',{p_quiz_id:id}).then(function(rows){var q=state.quizzes.find(function(x){return x.id===id;});state.quiz=q;state.questions=shuffle(rows||[]).map(function(x){var opts=shuffle((x.options||[]).map(function(t,i){return {text:t,original:i};}));return Object.assign({},x,{shuffled_options:opts});});state.answers={};state.marked={};state.rf='all';state.index=0;state.started=Date.now();state.left=Math.max(60,Number(q.duration_minutes||20)*60);state.busy=false;state.result=null;state.tab='attempt';refresh();startTimer();}).catch(function(e){state.busy=false;fail(e);});}
function stopTimer(){if(state.timer){clearInterval(state.timer);state.timer=null;}}
function startTimer(){stopTimer();state.timer=setInterval(function(){state.left=Math.max(0,state.left-1);var el=$('epc-clock');if(el){el.textContent=clock(state.left);var bx=el.parentNode;if(bx&&bx.classList)bx.classList.toggle('low',state.left<=60);}if(state.left<=0)submitQuiz(true);},1000);}
function clock(n){return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
function submitQuiz(auto){if(state.busy||!state.quiz)return;if(!auto&&!state.confirmed){var left=(state.questions||[]).length-Object.keys(state.answers||{}).length;epAsk.confirm(left>0?left+' question'+(left===1?' is':'s are')+' still unanswered.':'You answered every question.',{title:'Submit this attempt?',ok:'Submit'}).then(function(ok){if(ok){state.confirmed=true;try{submitQuiz(false)}finally{state.confirmed=false}}});return}state.busy=true;stopTimer();refresh();call('ep_quiz_submit',{p_quiz_id:state.quiz.id,p_answers:state.answers,p_elapsed_seconds:Math.round((Date.now()-state.started)/1000)}).then(function(r){state.result=r;state.tab='result';state.busy=false;refresh();note(auto?'Time is up. Attempt submitted.':'Attempt submitted.','success');}).catch(function(e){state.busy=false;state.tab='attempt';refresh();note(e.message||'Submission failed. Your answers are retained.','error');startTimer();});}
function loadLibrary(){call('ep_quiz_permanent_library',{p_community_id:state.community.id}).then(function(x){state.library=x||{};refresh();}).catch(fail);}
function loadMe(){Promise.all([call('ep_student_hub_summary',{p_community_id:state.community.id}),call('ep_student_leaderboard',{p_community_id:state.community.id,p_board:state.boardKind,p_limit:25})]).then(function(r){state.me=(r[0]||{}).me||{};state.leaderboard=r[1]||[];refresh();}).catch(fail);}
function board(k){state.boardKind=k;loadMe();}
function profileSearch(){var name=(($('epc-profile-search')||{}).value||'').trim().toLowerCase();if(!/^[a-z0-9_]{3,20}$/.test(name)){note('Enter an exact username (3–20 characters).','warning');return;}state.client.from('profiles').select('id').eq('username',name).maybeSingle().then(function(r){if(r.error)throw r.error;if(!r.data)throw new Error('Student not found.');return call('ep_public_student_profile',{p_user_id:r.data.id});}).then(function(p){state.profile=p;refresh();}).catch(fail);}
function follow(id){call('ep_toggle_follow',{p_target_user:id}).then(function(x){note(x&&x.following?'Following student.':'Unfollowed student.','success');if(state.profile&&state.profile.id===id)call('ep_public_student_profile',{p_user_id:id}).then(function(p){state.profile=p;refresh();});}).catch(fail);}
function pinHtml(){var admin=['admin','moderator'].includes(role(state.community.id));var filled=state.pins.filter(isPinned).sort(function(a,b){return a.slot-b.slot;});var free=[1,2,3,4,5].filter(function(n){return !isPinned(state.pins.find(function(x){return x.slot===n;}));});
var head='<div class="epc-pinhead"><div><h3>Pinned resources</h3><p class="text-xs epc-muted">'+filled.length+' of 5 slots used</p></div>'+(admin&&free.length?'<button type="button" class="epc-btn primary" onclick="epCircleHub.editPin('+free[0]+')"><i class="fa-solid fa-plus"></i> Add pin</button>':'')+'</div>';
if(!filled.length)return head+'<div class="epc-empty">'+(admin?'No pins yet. Add the chapter list, formula sheet or rules you want everyone to see first.':'No pins yet. Admins can pin important resources here.')+'</div>';
return head+'<div class="epc-grid">'+filled.map(function(p){return '<article class="epc-pin"><div class="flex items-center justify-between gap-2"><span class="epc-tag"><i class="fa-solid fa-thumbtack"></i> Pin '+p.slot+'</span>'+(admin?'<button type="button" class="epc-btn" onclick="epCircleHub.editPin('+p.slot+')"><i class="fa-solid fa-pen"></i> Edit</button>':'')+'</div><h4 class="mt-2">'+esc(p.title)+'</h4>'+(p.body?'<p class="mt-1 text-xs epc-muted">'+esc(p.body)+'</p>':'')+(p.url?'<a class="mt-2 inline-block text-xs font-bold text-teal-600" href="'+esc(p.url)+'" target="_blank" rel="noopener noreferrer">Open resource ↗</a>':'')+'</article>';}).join('')+'</div>';}
function subjOf(c){var s=((c.name||'')+' '+(c.slug||'')+' '+(c.description||'')).toLowerCase();return /bio|zoo|botan/.test(s)?['#059669','fa-dna','Biology']:/phys/.test(s)?['#2563eb','fa-atom','Physics']:/chem/.test(s)?['#d97706','fa-flask','Chemistry']:['#0d9488','fa-people-group','Other'];}
function scrollWS(){setTimeout(function(){var e=document.getElementById('epc-workspace');if(e&&e.scrollIntoView)e.scrollIntoView({behavior:(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches)?'auto':'smooth',block:'start'});},30);}
function visibleCircles(){var q=(state.dq||'').trim().toLowerCase();return state.circles.filter(function(c){var s=subjOf(c);if(state.dsub!=='All'&&s[2]!==state.dsub)return false;if(q&&((c.name||'')+' '+(c.description||'')).toLowerCase().indexOf(q)<0)return false;return true;});}
function communityCards(){var list=visibleCircles();if(!list.length)return '<div class="epc-empty">No Circles match your search. Try another subject or clear the filter.</div>';return '<div class="epc-grid">'+list.map(function(c){var joined=isMember(c.id),active=state.community&&state.community.id===c.id,s=subjOf(c);return '<article class="epc-card epc-community'+(active?' active':'')+'" style="--cc:'+s[0]+'"><div class="flex items-center gap-3"><span class="epc-ico"><i class="fa-solid '+esc(c.icon||s[1])+'"></i></span><div class="min-w-0 flex-1"><h3>'+esc(c.name)+'</h3>'+statLine(c)+'</div>'+(joined?'<span class="epc-joined"><i class="fa-solid fa-check"></i> Joined</span>':'')+'</div><p class="text-xs epc-muted">'+esc(c.description||'A place to study together.')+'</p>'+avStack(c)+'<div class="flex gap-2"><button class="epc-btn accent flex-1" onclick="epCircleHub.'+(joined?'open':'join')+'(\''+esc(c.id)+'\')">'+(joined?'Open Circle':'Join Circle')+'</button></div></article>';}).join('')+'</div>';}
function myStrip(){var mine=state.circles.filter(function(x){return isMember(x.id);});if(!mine.length)return '';return '<section aria-label="Your Circles"><div class="epc-label">Your Circles</div><div class="epc-strip">'+mine.map(function(c){var s=subjOf(c),a=state.community&&state.community.id===c.id;return '<button type="button" class="epc-chipc'+(a?' on':'')+'" style="--cc:'+s[0]+'" aria-pressed="'+a+'" onclick="epCircleHub.open(\''+esc(c.id)+'\')"><i class="fa-solid '+esc(c.icon||s[1])+'"></i><span>'+esc(c.name)+'</span>'+(onlineN(c)?'<i class="epc-dot" title="'+onlineN(c)+' online"></i>':'')+'</button>';}).join('')+'</div></section>';}
function discoverHtml(mine,hasC){var open=state.discOpen===null?(!mine||!hasC):state.discOpen;var chips=['All','Biology','Physics','Chemistry'].map(function(x){return '<button type="button" class="epc-fchip'+(state.dsub===x?' on':'')+'" aria-pressed="'+(state.dsub===x)+'" onclick="epCircleHub.dsub(\''+x+'\')">'+x+'</button>';}).join('');return '<details class="epc-disc"'+(open?' open':'')+'><summary onclick="epCircleHub.disc(this.parentNode.open)"><span>Discover Circles</span><small>'+state.circles.length+'</small><i class="fa-solid fa-chevron-down"></i></summary><div class="epc-disc-bar"><label class="epc-dsearch"><i class="fa-solid fa-magnifying-glass"></i><input id="epc-dq" type="search" placeholder="Search Circles" aria-label="Search Circles" value="'+esc(state.dq)+'" oninput="epCircleHub.dq(this.value)"></label><button type="button" class="epc-btn" onclick="epCircleHub.reload()"><i class="fa-solid fa-rotate"></i> Refresh</button></div><div class="epc-fchips">'+chips+'</div><div id="epc-dgrid">'+communityCards()+'</div></details>';}
function feedHtml(){var cp=state.compose,ff=state.ff,hasContent=!!(cp.text.trim()||state.attach.length);
var types=[['talk','Discussion','fa-comments'],['doubt','Doubt','fa-circle-question']].map(function(x){return '<button type="button" class="epc-ctype'+(cp.type===x[0]?' on':'')+'" aria-pressed="'+(cp.type===x[0])+'" onclick="epCircleHub.cType(\''+x[0]+'\')"><i class="fa-solid '+x[2]+'"></i> '+x[1]+'</button>';}).join('');
var subs=['General','Biology','Physics','Chemistry'].map(function(s){return '<button type="button" class="epc-fchip'+(cp.subj===s?' on':'')+'" aria-pressed="'+(cp.subj===s)+'" onclick="epCircleHub.cSubj(\''+s+'\')">'+s+'</button>';}).join('');
var prev=state.attach.length?'<div class="epc-prev">'+state.attach.map(function(x){return '<span class="epc-thumb"><img src="'+x.preview+'" alt="Selected photo"><button type="button" aria-label="Remove photo" onclick="epCircleHub.rmImg(\''+x.id+'\')"><i class="fa-solid fa-xmark"></i></button></span>';}).join('')+'</div>':'';
var photoBtn=state.featFeed===false?'':'<label class="epc-btn epc-photo" title="Add photos (up to 4)"><input type="file" accept="image/*" multiple class="epc-file" aria-label="Add photos" onchange="epCircleHub.pickImgs(this)"><i class="fa-regular fa-image"></i><span>Photo'+(state.attach.length?' ('+state.attach.length+'/4)':'')+'</span></label>';
var composer='<section class="epc-card epc-compose"><div class="epc-ctypes">'+types+'</div><textarea id="epc-post-text" class="epc-field" rows="3" maxlength="2000" aria-label="Write a post" placeholder="'+(cp.type==='doubt'?'Describe your doubt: chapter, what you tried, where you are stuck…':'Share an NCERT insight or study tip…')+'" oninput="epCircleHub.cInput(this)">'+esc(cp.text)+'</textarea>'+prev+'<div class="epc-cfoot"><div class="epc-fchips">'+subs+'</div>'+photoBtn+'<span class="epc-count" id="epc-count">'+cp.text.length+'/2000</span><button type="button" id="epc-postbtn" class="epc-btn primary" onclick="epCircleHub.post()"'+(hasContent&&!state.posting?'':' disabled')+'>'+(state.posting?'Posting…':'Post')+'</button></div></section>';
var fbar=[['all','All'],['doubt','Doubts'],['talk','Discussions']].map(function(x){return '<button type="button" class="epc-fchip'+(ff.type===x[0]?' on':'')+'" aria-pressed="'+(ff.type===x[0])+'" onclick="epCircleHub.fType(\''+x[0]+'\')">'+x[1]+'</button>';}).join('')+(ff.tag?'<button type="button" class="epc-fchip on" onclick="epCircleHub.feedFilter(\'\')" aria-label="Clear tag filter">'+esc(ff.tag)+' <i class="fa-solid fa-xmark"></i></button>':'');
var rows=state.posts.map(function(p){return {p:p,q:parsePost(p.body)};}).filter(function(x){if(ff.type!=='all'&&x.q.type!==ff.type)return false;if(ff.tag&&x.q.text.toLowerCase().indexOf(ff.tag.toLowerCase())<0)return false;return true;});
var list=rows.length?rows.map(function(x){var p=x.p,q=x.q,a=p.author||{},nm=a.display_name||a.username||'Student',txt=q.text.replace(/\u200b/g,'').trim();return '<article class="epc-post epc-pcard"><span class="epc-pav" style="--h:'+hueOf(nm)+'" aria-hidden="true">'+esc(String(nm).charAt(0).toUpperCase())+'</span><div class="min-w-0 flex-1"><div class="epc-phead"><b>'+esc(nm)+'</b>'+(a.username?'<span class="epc-muted">@'+esc(a.username)+'</span>':'')+'<time class="epc-muted" datetime="'+esc(p.created_at)+'" title="'+esc(new Date(p.created_at).toLocaleString())+'">· '+relT(p.created_at)+'</time></div>'+((q.type==='doubt'||q.subj!=='General')?'<div class="epc-pchips">'+(q.type==='doubt'?'<span class="epc-chip-d"><i class="fa-solid fa-circle-question"></i> Doubt</span>':'')+(q.subj!=='General'?'<span class="epc-chip-s" style="--cc:'+SUBJ_COLOR[q.subj]+'">'+q.subj+'</span>':'')+'</div>':'')+(txt?'<p>'+bodyHtml(txt)+'</p>':'')+imgGrid(p)+postActions(p)+'</div></article>';}).join(''):'<div class="epc-empty mt-3">'+(state.posts.length?'Nothing matches this filter.':'No discussions yet. Ask the first doubt or share a tip.')+'</div>';
return composer+'<section class="epc-card"><div class="flex items-center justify-between gap-2"><h3>Recent posts</h3><button type="button" class="epc-btn" onclick="epCircleHub.loadPosts()"><i class="fa-solid fa-rotate"></i> Refresh</button></div><div class="epc-fchips mt-2">'+fbar+'</div>'+list+'</section>';}
function votesLeft(q){var ms=new Date(q.created_at).getTime()+864e5-Date.now();if(ms<=0)return '';return Math.floor(ms/36e5)+'h '+Math.floor(ms%36e5/6e4)+'m';}
function onboardHtml(mine){try{if(localStorage.getItem('epc_onb_off'))return '';}catch(e){}var pd={};try{pd=(window.__epProfileData&&__epProfileData())||{};}catch(e){}var steps=[[!!pd.username,'Pick a handle','So friends can find you','fa-at'],[!!mine,'Join a Circle','Choose your subject','fa-circle-nodes'],[state.posts.some(function(p){return p.author_id===userId();}),'Post your first doubt','Ask or share in a Circle','fa-circle-question']];var done=steps.filter(function(s){return s[0];}).length;if(done===3)return '';return '<section class="epc-onb" aria-label="Get started"><div class="epc-onbhead"><div><h3>Get started</h3><p class="text-xs epc-muted">'+done+' of 3 done</p></div><button type="button" class="epc-btn epc-iconbtn" aria-label="Dismiss" onclick="epCircleHub.onbOff()"><i class="fa-solid fa-xmark"></i></button></div><ol class="epc-onbl">'+steps.map(function(s){return '<li class="'+(s[0]?'done':'')+'"><span class="epc-onbi"><i class="fa-solid '+(s[0]?'fa-check':s[3])+'"></i></span><div><b>'+s[1]+'</b><small>'+s[2]+'</small></div></li>';}).join('')+'</ol></section>';}
function quizCard(q,i){var own=q.creator_id===userId(),open=q.voting_open!==false&&new Date(q.created_at).getTime()>Date.now()-864e5,c=SUBJ_COLOR[q.subject]||'#0d9488';return '<article class="epc-card epc-qcard" style="--cc:'+c+'"><div class="epc-qtop"><span class="epc-tag">'+esc(q.subject)+' · '+esc(q.difficulty)+'</span><span class="text-[11px] epc-muted">'+Number(q.question_count)+' Q · '+Number(q.duration_minutes)+' min</span></div><div><h3>'+esc(q.title)+'</h3><p class="mt-1 text-xs epc-muted">'+esc(q.chapter)+' · '+esc(q.description||'Community quiz')+'</p></div><div class="epc-qmeta"><span><b>'+Number(q.attempts_count||0)+'</b> attempts</span><span><b>'+Number(q.positive_rating||0)+'%</b> positive</span><span><b>'+Number(q.quality_score||0).toFixed(0)+'</b>/100</span></div><div class="epc-qvote"><div class="epc-vote" role="group" aria-label="Vote"><button type="button" aria-label="Upvote" onclick="epCircleHub.vote(\''+q.id+'\',1)" '+(own||!open?'disabled':'')+'><i class="fa-solid fa-chevron-up"></i></button><b>'+Number(q.net_votes||0)+'</b><button type="button" aria-label="Downvote" onclick="epCircleHub.vote(\''+q.id+'\',-1)" '+(own||!open?'disabled':'')+'><i class="fa-solid fa-chevron-down"></i></button></div><span class="epc-vwin">'+(own?'Your quiz':open?'<i class="fa-regular fa-clock"></i> Voting closes in '+votesLeft(q):'Voting closed')+'</span></div><div class="epc-qact"><button type="button" class="epc-btn '+(i===0?'primary':'accent')+' flex-1" onclick="epCircleHub.start(\''+q.id+'\')"><i class="fa-solid fa-play"></i> Attempt</button><button type="button" class="epc-btn" onclick="epCircleHub.quizRanks(\''+q.id+'\')"><i class="fa-solid fa-ranking-star"></i> Ranks</button><button type="button" class="epc-btn epc-iconbtn" aria-label="Report quiz" title="Report" onclick="epCircleHub.reportQuiz(\''+q.id+'\')" '+(own?'disabled':'')+'><i class="fa-regular fa-flag"></i></button></div></article>';}
function quizCards(){if(!state.quizzes.length)return '<div class="epc-empty">No quizzes yet. Upload the first question bank for this Circle.</div>';var f=state.qf,list=state.quizzes.filter(function(q){return f.subj==='All'||q.subject===f.subj;}).sort(function(a,b){return f.sort==='top'?(Number(b.net_votes||0)-Number(a.net_votes||0)):(new Date(b.created_at)-new Date(a.created_at));});var bar='<div class="epc-qbar"><div class="epc-fchips">'+['All','Biology','Physics','Chemistry','Mixed'].map(function(s){return '<button type="button" class="epc-fchip'+(f.subj===s?' on':'')+'" aria-pressed="'+(f.subj===s)+'" onclick="epCircleHub.qsubj(\''+s+'\')">'+s+'</button>';}).join('')+'</div><div class="epc-mini" role="group" aria-label="Sort">'+[['new','New'],['top','Top']].map(function(s){return '<button type="button" class="'+(f.sort===s[0]?'on':'')+'" aria-pressed="'+(f.sort===s[0])+'" onclick="epCircleHub.qsort(\''+s[0]+'\')">'+s[1]+'</button>';}).join('')+'</div></div>';return bar+(list.length?'<div class="epc-grid">'+list.map(quizCard).join('')+'</div>':'<div class="epc-empty">No quizzes in this subject yet.</div>');}
function stepper(n){return '<ol class="epc-steps" aria-label="Upload progress">'+['Upload','Review','Preview'].map(function(s,i){return '<li class="'+(i+1<n?'done':i+1===n?'cur':'')+'"><span>'+(i+1<n?'<i class="fa-solid fa-check"></i>':(i+1))+'</span>'+s+'</li>';}).join('')+'</ol>';}
function uploadHtml(){if(state.preview)return stepper(3)+previewMarkup();var valid=state.draft.length>=5&&state.draft.length<=100&&!state.issues.length,has=state.draft.length>0,n=state.issues.length;
var line=function(x){return '<p class="mt-1">'+(x.index?'Q'+x.index+': ':'File: ')+esc(x.message)+'</p>';};
var drop='<label class="epc-drop" ondragover="event.preventDefault();this.classList.add(\'over\')" ondragleave="this.classList.remove(\'over\')" ondrop="this.classList.remove(\'over\');epCircleHub.drop(event)"><input type="file" accept=".json,application/json" class="epc-file" onchange="epCircleHub.readFile(this)"><i class="fa-solid fa-file-arrow-up"></i><b>'+(state.fileName?esc(state.fileName):'Drop your question-bank JSON here')+'</b><span>'+(state.fileName?'Tap to choose a different file':'or tap to browse · 5–100 questions · max 2 MB')+'</span></label>';
var iss=n?'<div class="epc-issues" role="alert"><b>'+n+' validation issue'+(n==1?'':'s')+'</b>'+state.issues.slice(0,5).map(line).join('')+(n>5?'<details class="mt-1"><summary>Show '+(n-5)+' more</summary>'+state.issues.slice(5).map(line).join('')+'</details>':'')+'</div>':'';
var rev=has?'<div class="text-xs font-bold">'+state.draft.length+' questions parsed'+(n?'':' and validated')+'</div><div class="max-h-56 overflow-y-auto space-y-2">'+state.draft.slice(0,8).map(function(q,i){return '<div class="epc-question text-xs"><b>Q'+(i+1)+'.</b> '+esc(q.prompt)+'<p class="epc-muted">'+q.options.length+' options · answer '+String.fromCharCode(65+q.correct_index)+'</p></div>';}).join('')+'</div><div class="grid gap-2 sm:grid-cols-2"><input id="epc-quiz-title" class="epc-field" maxlength="90" placeholder="Quiz title" aria-label="Quiz title" value="'+esc(state.meta.title||'')+'"><select id="epc-quiz-subject" class="epc-field" aria-label="Subject"><option>Biology</option><option>Physics</option><option>Chemistry</option><option>Mixed</option></select><input id="epc-quiz-chapter" class="epc-field" maxlength="90" placeholder="Chapter" aria-label="Chapter" value="'+esc(state.meta.chapter||'')+'"><select id="epc-quiz-diff" class="epc-field" aria-label="Difficulty"><option value="mixed">Mixed difficulty</option><option value="easy">Easy</option><option value="moderate">Moderate</option><option value="difficult">Difficult</option></select><input id="epc-quiz-duration" type="number" min="1" max="180" value="20" class="epc-field" aria-label="Duration in minutes"><input id="epc-quiz-desc" class="epc-field" maxlength="300" placeholder="Description (optional)" aria-label="Description"></div><button type="button" class="epc-btn primary w-full" onclick="epCircleHub.previewQuiz()" '+(!valid||state.busy?'disabled':'')+'>Review quiz preview</button>':'<p class="text-xs epc-muted">Accepts the EduPulse <code>meta</code> + <code>qs</code> format, or <code>questions</code>.</p>';
return stepper(has?2:1)+'<section class="epc-card space-y-3"><div><h3>Upload a question bank</h3><p class="text-xs epc-muted mt-1">Correct answers are never shown to quiz takers before they submit.</p></div>'+drop+iss+rev+'</section>';}
function previewMarkup(){var p=state.pending||{};return '<section class="epc-card space-y-3"><div class="flex justify-between gap-2"><div><span class="epc-tag">FINAL PREVIEW</span><h3 class="mt-2">'+esc(p.title||'Quiz')+'</h3><p class="text-xs epc-muted">'+esc(p.subject)+' · '+esc(p.chapter)+' · '+esc(p.difficulty)+' · '+Number(state.draft.length)+' questions · '+Number(p.duration)+' min</p></div><span class="epc-tag">Not published</span></div><p class="text-xs epc-muted">Correct answers are shown only in this private creator preview. Students will receive answer explanations only after submitting their attempts.</p><div class="max-h-[55vh] overflow-y-auto space-y-3">'+state.draft.map(function(q,i){return '<article class="epc-question"><b class="text-xs text-teal-600">QUESTION '+(i+1)+'</b><p class="mt-2 text-sm font-bold">'+esc(q.prompt)+'</p><div class="mt-2 space-y-1">'+q.options.map(function(o,j){return '<p class="rounded-lg p-2 text-xs '+(j===q.correct_index?'bg-emerald-500/10 font-bold':'bg-slate-500/5')+'">'+String.fromCharCode(65+j)+'. '+esc(o)+(j===q.correct_index?' ✓':'')+'</p>';}).join('')+'</div>'+(q.explanation?'<p class="mt-2 text-xs epc-muted">'+esc(q.explanation)+'</p>':'')+'</article>';}).join('')+'</div><div class="flex gap-2"><button class="epc-btn flex-1" onclick="epCircleHub.backEdit()">Back to edit</button><button class="epc-btn primary flex-1" onclick="epCircleHub.publishQuiz()" '+(state.busy?'disabled':'')+'>Publish quiz</button></div></section>'; }
function loadAttempts(){if(!state.community)return;state.client.from('quiz_attempts').select('id,quiz_id,score,correct_count,wrong_count,unanswered_count,accuracy,elapsed_seconds,submitted_at').eq('user_id',userId()).order('submitted_at',{ascending:false}).limit(30).then(function(r){if(r.error)throw r.error;state.attempts=r.data||[];refresh();}).catch(fail);}
function attemptsHtml(){return '<section class="epc-card"><h3>My quiz attempts</h3>'+(state.attempts.length?state.attempts.map(function(a){var q=state.quizzes.find(function(x){return x.id===a.quiz_id;})||{};return '<div class="epc-post flex items-center justify-between gap-2"><div><b class="text-sm">'+esc(q.title||'Community quiz')+'</b><p class="text-xs epc-muted">'+Number(a.accuracy||0)+'% accuracy · '+Number(a.correct_count||0)+' correct · '+Number(a.wrong_count||0)+' wrong</p></div><b>'+Number(a.score||0)+' pts</b></div>';}).join(''):'<div class="epc-empty mt-2">No attempts yet. Complete a Circle quiz to see your personal report here.</div>')+'</section>'; }
function attemptHtml(){var q=state.questions[state.index];if(!q)return '<div class="epc-empty">No questions were returned.</div>';var total=state.questions.length,ans=Object.keys(state.answers).length,mk=!!state.marked[q.id],allDone=ans===total;
return '<section class="epc-card space-y-3 epc-attempt"><div class="epc-abar"><div class="min-w-0"><span class="epc-tag">QUIZ ARENA</span><h3 class="mt-1 truncate">'+esc(state.quiz.title)+'</h3></div><div class="epc-clockbox'+(state.left<=60?' low':'')+'" role="timer" aria-label="Time left"><i class="fa-regular fa-clock"></i><b id="epc-clock">'+clock(state.left)+'</b></div></div><div><div class="flex justify-between text-xs epc-muted"><span>Question '+(state.index+1)+' / '+total+'</span><span>'+ans+' answered · +4 / −1</span></div><div class="epc-progress mt-1"><i style="width:'+(ans/total*100)+'%"></i></div></div><article class="epc-question"><p class="font-bold text-sm">'+esc(q.prompt)+'</p><div class="mt-3 space-y-2">'+q.shuffled_options.map(function(o,i){return '<button type="button" class="epc-option '+(state.answers[q.id]===o.original?'selected':'')+'" onclick="epCircleHub.choose(\''+q.id+'\','+o.original+')"><b>'+String.fromCharCode(65+i)+'.</b><span>'+esc(o.text)+'</span></button>';}).join('')+'</div></article><div class="flex flex-wrap gap-2"><button type="button" class="epc-btn" onclick="epCircleHub.move(-1)" '+(state.index===0?'disabled':'')+'><i class="fa-solid fa-arrow-left"></i> Prev</button><button type="button" class="epc-btn'+(mk?' epc-on':'')+'" aria-pressed="'+mk+'" onclick="epCircleHub.mark(\''+q.id+'\')"><i class="fa-'+(mk?'solid':'regular')+' fa-bookmark"></i> '+(mk?'Marked':'Mark for review')+'</button><button type="button" class="epc-btn '+(allDone?'accent':'primary')+' ml-auto" onclick="epCircleHub.move(1)" '+(state.index===total-1?'disabled':'')+'>Next <i class="fa-solid fa-arrow-right"></i></button></div><div><div class="epc-pals" role="group" aria-label="Question palette">'+state.questions.map(function(x,i){var a=state.answers[x.id]!==undefined,m=!!state.marked[x.id];return '<button type="button" class="epc-pal'+(a?' ans':'')+(m?' mk':'')+(i===state.index?' cur':'')+'" aria-label="Question '+(i+1)+(a?', answered':', not answered')+(m?', marked':'')+'" '+(i===state.index?'aria-current="true"':'')+' onclick="epCircleHub.goto('+i+')">'+(i+1)+'</button>';}).join('')+'</div><div class="epc-legend"><span><i class="ans"></i>Answered</span><span><i class="mk"></i>Marked</span><span><i></i>Not answered</span></div></div><button type="button" class="epc-btn '+(allDone?'primary':'accent')+' w-full" onclick="epCircleHub.submit(false)"><i class="fa-solid fa-flag-checkered"></i> Submit quiz</button></section>';}
function ringSvg(p,s){var C=2*Math.PI*44;return '<svg viewBox="0 0 100 100" class="epc-ring" width="'+s+'" height="'+s+'" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-opacity=".15" stroke-width="8"/><circle cx="50" cy="50" r="44" fill="none" stroke="url(#epcg)" stroke-width="8" stroke-linecap="round" transform="rotate(-90 50 50)" stroke-dasharray="'+(C*Math.max(0,Math.min(100,p))/100).toFixed(1)+' '+C.toFixed(1)+'"/><defs><linearGradient id="epcg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14b8a6"/><stop offset="1" stop-color="#6366f1"/></linearGradient></defs></svg>';}
function resultHtml(){var r=state.result||{},items=r.results||[],acc=Number(r.accuracy||0),f=state.rf;var shown=items.map(function(x,i){return {x:x,i:i};}).filter(function(o){var x=o.x;return f==='all'||(f==='wrong'&&!x.is_correct&&x.selected_index!=null)||(f==='skipped'&&x.selected_index==null);});
var chips=[['all','All '+items.length],['wrong','Wrong '+Number(r.wrong_count||0)],['skipped','Skipped '+Number(r.unanswered_count||0)]].map(function(c){return '<button type="button" class="epc-fchip'+(f===c[0]?' on':'')+'" aria-pressed="'+(f===c[0])+'" onclick="epCircleHub.rfilter(\''+c[0]+'\')">'+c[1]+'</button>';}).join('');
return '<section class="epc-card space-y-3"><div class="epc-resh"><div class="epc-ringbox">'+ringSvg(acc,112)+'<div><b>'+acc+'%</b><small>accuracy</small></div></div><div class="epc-resm"><span class="epc-tag">ATTEMPT REPORT</span><h3 class="epc-score">'+Number(r.score||0)+' <small>/ '+(state.questions.length*4)+'</small></h3><div class="epc-reschips"><span class="ok"><i class="fa-solid fa-circle-check"></i> '+Number(r.correct_count||0)+' correct</span><span class="bad"><i class="fa-solid fa-circle-xmark"></i> '+Number(r.wrong_count||0)+' wrong</span><span><i class="fa-solid fa-forward"></i> '+Number(r.unanswered_count||0)+' skipped</span></div></div></div><div class="epc-fchips">'+chips+'</div>'+(shown.length?shown.map(function(o){var x=o.x,i=o.i,q=state.questions.find(function(y){return y.id===x.question_id;})||{},st=x.is_correct?'ok':x.selected_index==null?'skip':'bad';return '<article class="epc-question epc-r-'+st+'"><div class="flex justify-between text-xs"><b>Question '+(i+1)+'</b><b style="color:'+(x.is_correct?'#0d9488':x.selected_index==null?'inherit':'#e11d48')+'">'+(x.is_correct?'Correct':x.selected_index==null?'Skipped':'Incorrect')+'</b></div><p class="mt-2 text-sm">'+esc(q.prompt||'')+'</p><p class="mt-2 text-xs"><b>Answer:</b> '+String.fromCharCode(65+x.correct_index)+'. '+esc((q.options||[])[x.correct_index]||'')+'</p>'+(x.selected_index!=null?'<p class="text-xs epc-muted">Your answer: '+String.fromCharCode(65+x.selected_index)+'. '+esc((q.options||[])[x.selected_index]||'')+'</p>':'')+(x.explanation?'<p class="mt-2 text-xs rounded-lg bg-teal-500/5 p-3">'+esc(x.explanation)+'</p>':'')+'</article>';}).join(''):'<div class="epc-empty">Nothing in this filter. Nice work!</div>')+'<div class="flex gap-2"><button type="button" class="epc-btn" onclick="epCircleHub.backQuizzes()">Back to quizzes</button><button type="button" class="epc-btn primary" onclick="epCircleHub.retake()"><i class="fa-solid fa-rotate-right"></i> Retake</button></div></section>';}
function podium(list,val){var top=list.slice(0,3);if(!top.length)return '';return '<div class="epc-podium">'+[1,0,2].filter(function(i){return top[i];}).map(function(i){var x=top[i],nm=x.display_name||x.username||'Student';return '<div class="epc-pod p'+(i+1)+'"><span class="epc-pav" style="--h:'+hueOf(nm)+'" aria-hidden="true">'+esc(String(nm).charAt(0).toUpperCase())+'</span><b>'+esc(nm)+'</b><small>'+val(x)+'</small><span class="epc-step" aria-label="Rank '+(i+1)+'">'+(i+1)+'</span></div>';}).join('')+'</div>';}
function rankRows(list,val){return list.slice(3).map(function(x){var nm=x.display_name||x.username||'Student';return '<div class="epc-rrow"><span class="epc-rn">#'+x.rank+'</span><span class="epc-pav sm" style="--h:'+hueOf(nm)+'" aria-hidden="true">'+esc(String(nm).charAt(0).toUpperCase())+'</span><span class="min-w-0 flex-1 truncate"><b>'+esc(nm)+'</b>'+(x.username?'<small class="epc-muted"> @'+esc(x.username)+'</small>':'')+'</span><b>'+val(x)+'</b></div>';}).join('');}
function quizRankHtml(){var val=function(x){return x.score+' pts · '+x.accuracy+'%';};return '<section class="epc-card"><div class="flex items-center justify-between gap-2"><h3>Quiz leaderboard</h3><button type="button" class="epc-btn" onclick="epCircleHub.backQuizzes()"><i class="fa-solid fa-arrow-left"></i> Back</button></div>'+(state.leaderboard.length?podium(state.leaderboard,val)+rankRows(state.leaderboard,val):'<div class="epc-empty mt-3">No attempts yet. Be the first on the board.</div>')+'</section>';}
function archiveListHtml(){var d=state.library||{},f=state.af,qq=(f.q||'').trim().toLowerCase();var q=(d.quizzes||[]).filter(function(x){return (f.subj==='All'||x.subject===f.subj)&&(!qq||((x.title||'')+' '+(x.chapter||'')).toLowerCase().indexOf(qq)>=0);}).sort(function(a,b){return f.sort==='az'?String(a.title||'').localeCompare(String(b.title||'')):f.sort==='size'?Number(b.question_count||0)-Number(a.question_count||0):Number(b.quality_score||0)-Number(a.quality_score||0);});
if(!q.length)return '<div class="epc-empty mt-2">'+((d.quizzes||[]).length?'No quizzes match your filters.':'No permanent quizzes saved yet.')+'</div>';
return q.map(function(x){var open=state.expandedPermanent===x.id,qs=x.questions||[];return '<div class="epc-post"><span class="epc-tag">'+esc(x.subject||'Mixed')+'</span><h4 class="mt-2">'+esc(x.title)+'</h4><p class="text-xs epc-muted">'+esc(x.chapter||'')+' · '+Number(x.question_count||0)+' questions · '+Number(x.quality_score||0).toFixed(1)+'/100</p><button type="button" class="epc-btn mt-2" aria-expanded="'+open+'" onclick="epCircleHub.expandPermanent(\''+esc(x.id)+'\')">'+(open?'Hide answer key':'View questions and explanations')+'</button>'+(open?'<div class="mt-3 space-y-2">'+qs.map(function(z,i){return '<article class="epc-question"><b class="text-xs text-teal-600">Q'+(i+1)+'</b><p class="mt-1 text-sm">'+esc(z.prompt)+'</p><div class="mt-2 space-y-1">'+(z.options||[]).map(function(o,j){return '<p class="rounded-lg p-2 text-xs '+(j===Number(z.correct_index)?'bg-emerald-500/10 font-bold':'bg-slate-500/5')+'">'+String.fromCharCode(65+j)+'. '+esc(o)+(j===Number(z.correct_index)?' ✓':'')+'</p>';}).join('')+'</div>'+(z.explanation?'<p class="mt-2 text-xs epc-muted">'+esc(z.explanation)+'</p>':'')+'</article>';}).join('')+'</div>':'')+'</div>';}).join('');}
function archiveHtml(){var d=state.library||{},w=d.winners||[],f=state.af;
var chips=['All','Biology','Physics','Chemistry','Mixed'].map(function(s){return '<button type="button" class="epc-fchip'+(f.subj===s?' on':'')+'" aria-pressed="'+(f.subj===s)+'" onclick="epCircleHub.asubj(\''+s+'\')">'+s+'</button>';}).join('');
var sorts=[['top','Top quality'],['az','A–Z'],['size','Most questions']].map(function(s){return '<option value="'+s[0]+'"'+(f.sort===s[0]?' selected':'')+'>'+s[1]+'</option>';}).join('');
return '<section class="epc-card"><h3>Daily winner announcements</h3>'+(w.length?w.map(function(x){return '<div class="epc-post"><span class="epc-tag">'+esc(x.cycle_date||'Daily cycle')+'</span><h4 class="mt-2">'+esc(x.title||'Daily quiz champion')+'</h4><p class="text-xs">'+esc(x.announcement||'')+'</p></div>';}).join(''):'<div class="epc-empty mt-2">No daily winner yet. The first appears after the scheduled cycle.</div>')+'</section><section class="epc-card"><h3>Permanent Quiz Library</h3><p class="text-xs epc-muted mt-1">Winning quizzes are stored with answer keys and explanations after the daily vote closes.</p><div class="epc-disc-bar mt-2"><label class="epc-dsearch"><i class="fa-solid fa-magnifying-glass"></i><input type="search" placeholder="Search title or chapter" aria-label="Search library" value="'+esc(f.q)+'" oninput="epCircleHub.aq(this.value)"></label><select class="epc-field epc-sel" aria-label="Sort library" onchange="epCircleHub.asort(this.value)">'+sorts+'</select></div><div class="epc-fchips">'+chips+'</div><div id="epc-alist">'+archiveListHtml()+'</div></section>';}
function leaderHtml(){var val=function(x){return Number(x.reputation||0)+' XP';},bk=state.boardKind;var tabs=[['creators','Top creators'],['helpful','Most helpful'],['champions','Champions']].map(function(b){return '<button type="button" role="tab" aria-selected="'+(bk===b[0])+'" class="'+(bk===b[0]?'on':'')+'" onclick="epCircleHub.board(\''+b[0]+'\')">'+b[1]+'</button>';}).join('');
return '<section class="epc-card space-y-3"><div class="grid gap-2 sm:grid-cols-3"><div class="epc-stat"><b>'+Number(state.me.points||0)+'</b><small>Reputation XP</small></div><div class="epc-stat"><b>#'+(state.me.rank||'—')+'</b><small>Circle rank</small></div><div class="epc-stat"><b>'+esc(state.me.badge||'New Learner')+'</b><small>Current badge</small></div></div><div class="epc-mini epc-minifull" role="tablist" aria-label="Leaderboards">'+tabs+'</div>'+(state.leaderboard.length?podium(state.leaderboard,val)+rankRows(state.leaderboard,val):'<div class="epc-empty">Choose a leaderboard to see students.</div>')+'</section><section class="epc-card"><h3>Find a student profile</h3><div class="mt-2 flex gap-2"><input id="epc-profile-search" class="epc-field" placeholder="Exact username" aria-label="Exact username"><button type="button" class="epc-btn primary" onclick="epCircleHub.profileSearch()">Search</button></div>'+(state.profile?'<div class="mt-3 border-t pt-3" style="border-color:var(--border-color)"><h4>'+esc(state.profile.display_name||state.profile.username)+'</h4><p class="text-xs epc-muted">@'+esc(state.profile.username)+' · '+Number(state.profile.reputation||0)+' XP</p><p class="text-sm mt-2">'+esc(state.profile.bio||'No bio yet.')+'</p><div class="flex flex-wrap gap-2 mt-2">'+(state.profile.badges||[]).map(function(x){return '<span class="epc-tag">'+esc(x)+'</span>';}).join('')+'</div><p class="text-xs epc-muted mt-2">'+Number(state.profile.followers||0)+' followers · '+Number(state.profile.following||0)+' following</p><button type="button" class="epc-btn mt-2" onclick="epCircleHub.follow(\''+state.profile.id+'\')">Follow / unfollow</button></div>':'')+'</section>';}
function markup(){if(!state.user)return '<div class="epc-shell"><section class="epc-hero"><span class="epc-tag">EDUPULSE COMMUNITY</span><h2 class="mt-2">EduPulse Circles</h2><p>Join subject-focused study spaces, exchange doubts, publish NEET quizzes and learn with other aspirants.</p><div class="epc-actions"><button class="epc-btn ghost" onclick="__bzAcc.open(\'signup\')">Create account</button><button class="epc-btn ghost" onclick="__bzAcc.open(\'login\')">Log in</button></div></section><div class="epc-empty">Sign in to discover and join Circles.</div></div>';
var c=state.community,member=c&&isMember(c.id),mine=state.circles.some(function(x){return isMember(x.id);});
var head='<section class="epc-banner"><div><h2>EduPulse Circles</h2><p>Study with aspirants in your subject: doubts, quizzes and rankings in one place.</p></div><span class="epc-tag">'+state.circles.length+' Circles</span></section>';
var err=state.error?'<div class="epc-err" role="alert"><span><i class="fa-solid fa-triangle-exclamation"></i> '+esc(state.error)+'</span><button type="button" class="epc-btn" onclick="epCircleHub.reload()">Retry</button></div>':'';
var cards=discoverHtml(mine,!!c);var onb=onboardHtml(mine);
if(!c)return '<div class="epc-shell">'+head+err+onb+myStrip()+cards+presenceHtml()+'</div>';
var s=subjOf(c);
var joinedLabel=member?'<span class="epc-tag">Joined · '+esc(role(c.id))+'</span>':'<span class="epc-tag">Preview</span>';
var tabs=[['feed','Discussions'],['quizzes','Quiz Arena'],['upload','Upload quiz'],['archive','Library'],['leaderboards','Reputation'],['attempts','My attempts'],['pins','Pins']];
var body='';if(!member)body='<section class="epc-card"><h3>Join '+esc(c.name)+'</h3><p class="text-xs epc-muted mt-1">Join to read discussions, vote on quizzes, attempt question banks and view the Circle leaderboard.</p><button class="epc-btn primary mt-3" onclick="epCircleHub.join(\''+c.id+'\')">Join Circle</button></section>';
else if(state.tab==='feed')body=feedHtml();else if(state.tab==='quizzes')body=(state.quiz?state.tab==='attempt'?attemptHtml():state.tab==='result'?resultHtml():state.tab==='quiz-ranks'?quizRankHtml():quizCards():quizCards());else if(state.tab==='upload')body=uploadHtml();else if(state.tab==='archive')body=archiveHtml();else if(state.tab==='leaderboards')body=leaderHtml();else if(state.tab==='attempts')body=attemptsHtml();else if(state.tab==='pins')body=pinHtml();
if(state.tab==='attempt')body=attemptHtml();if(state.tab==='result')body=resultHtml();if(state.tab==='quiz-ranks')body=quizRankHtml();
var wsHead='<div class="epc-wshead" style="--cc:'+s[0]+'"><span class="epc-ico"><i class="fa-solid '+esc(c.icon||s[1])+'"></i></span><div class="min-w-0 flex-1"><h3>'+esc(c.name)+'</h3><p class="epc-muted">'+memCount(c)+' students'+(onlineN(c)?' · <span class="epc-online"><i aria-hidden="true"></i>'+onlineN(c)+' online</span>':'')+' · '+esc(c.description||'Circle workspace')+'</p></div><div class="epc-wsact">'+joinedLabel+(c.slug?'<button type="button" class="epc-btn epc-iconbtn" aria-label="Copy Circle invite link" title="Copy invite link" onclick="epCircleHub.copyLink(\''+esc(c.slug)+'\')"><i class="fa-solid fa-link"></i></button>':'')+'</div></div>';
return '<div class="epc-shell">'+head+err+onb+myStrip()+cards+'<section class="epc-card epc-ws" id="epc-workspace" style="--cc:'+s[0]+'">'+wsHead+'<nav class="epc-tabs mt-3" role="tablist" aria-label="Circle sections">'+tabs.map(function(x){return '<button type="button" role="tab" aria-selected="'+(state.tab===x[0])+'" class="'+(state.tab===x[0]?'active':'')+'" onclick="epCircleHub.tab(\''+x[0]+'\')">'+x[1]+'</button>';}).join('')+'</nav>'+body+'</section>'+presenceHtml()+'</div>';}
function reload(){state.error='';state.circles=[];state.community=null;state.loading=false;load();}
window.epCircleHubRender=function(){startPresence();ready().then(function(){if(!state.user){refresh();return;}if(!state.circles.length&&!state.loading)load();else refresh();}).catch(fail);};
window.epCircleHub={reload:reload,open:function(id){selectCircle(id,true);scrollWS();},disc:function(o){state.discOpen=!o;},cType:function(v){state.compose.type=v;refresh();},cSubj:function(v){state.compose.subj=v;refresh();},cInput:function(el){state.compose.text=el.value;var c=document.getElementById('epc-count'),b=document.getElementById('epc-postbtn');if(c)c.textContent=el.value.length+'/2000';if(b)b.disabled=!(el.value.trim()||state.attach.length)||state.posting;},fType:function(v){state.ff.type=v;refresh();},feedFilter:function(tag){state.ff.tag=tag||'';state.tab='feed';refresh();if(tag)scrollWS();},pinSave:pinSave,closeModal:closeModal,qsubj:function(v){state.qf.subj=v;refresh();},qsort:function(v){state.qf.sort=v;refresh();},mark:function(id){state.marked[id]=!state.marked[id];refresh();},drop:function(e){readQuizFile({files:e.dataTransfer&&e.dataTransfer.files});},rfilter:function(v){state.rf=v;refresh();},aq:function(v){state.af.q=v;var e=$('epc-alist');if(e)e.innerHTML=archiveListHtml();},asubj:function(v){state.af.subj=v;refresh();},asort:function(v){state.af.sort=v;refresh();},onbOff:function(){try{localStorage.setItem('epc_onb_off','1');}catch(e){}refresh();},like:toggleLike,comments:toggleComments,reply:replyTo,cText:function(id,v){cm_(id).text=v;},cSend:sendComment,delComment:delComment,delPost:delPost,delPostGo:delPostGo,lightbox:lightbox,pickImgs:pickImgs,rmImg:rmImg,presence:function(on){call('ep_presence_touch',{p_hidden:!on}).then(function(){state.myHidden=!on;note(on?'You now appear online.':'You now appear offline.','success');loadOverview();}).catch(fail);},dsub:function(v){state.dsub=v;refresh();},dq:function(v){state.dq=v;var g=document.getElementById('epc-dgrid');if(g)g.innerHTML=communityCards();},join:join,copyLink:function(slug){var url=location.origin+location.pathname+'#/community/'+encodeURIComponent(slug);if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(url).then(function(){note('Circle link copied.','success');});else note(url);},tab:setTab,loadPosts:loadPosts,post:post,editPin:editPin,readFile:readQuizFile,publishQuiz:publishQuiz,previewQuiz:previewQuiz,backEdit:function(){state.preview=false;refresh();},vote:vote,reportQuiz:reportQuiz,start:startQuiz,choose:function(id,n){state.answers[id]=n;refresh();},move:function(d){state.index=Math.max(0,Math.min(state.questions.length-1,state.index+d));refresh();},goto:function(i){state.index=Math.max(0,Math.min(state.questions.length-1,i));refresh();},submit:submitQuiz,backQuizzes:function(){stopTimer();state.quiz=null;state.tab='quizzes';refresh();},retake:function(){var id=state.quiz&&state.quiz.id;if(id)startQuiz(id);},quizRanks:function(id){call('ep_quiz_leaderboard',{p_quiz_id:id}).then(function(r){state.leaderboard=r||[];state.tab='quiz-ranks';refresh();}).catch(fail);},loadLibrary:loadLibrary,expandPermanent:function(id){state.expandedPermanent=state.expandedPermanent===id?null:id;refresh();},board:board,profileSearch:profileSearch,follow:follow};
// Wrap the existing dashboard renderer so Circles is visible immediately after the hero.
window.addEventListener('hashchange',function(){var m=location.hash.match(/^#\/community\/([a-z0-9-]+)$/i);if(!m)return;var slug=decodeURIComponent(m[1]);var c=state.circles.find(function(x){return x.slug===slug;});if(c){if(typeof switchTab==='function')switchTab('campus');selectCircle(c.id,true);}});
window.addEventListener('beforeunload',stopTimer);
})();

