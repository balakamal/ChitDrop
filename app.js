import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.119.0';

const cfg = window.CHITDROP_CONFIG || {};
const db = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
const $ = (s, root=document) => root.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const app = $('#app');
let user = null, token = new URLSearchParams(location.search).get('room'), room = null, ownerRoom = null;
let name = '', session = '', poll = null, busy = false, myPick = null;
let theme = localStorage.getItem('chitdrop:theme') || 'light';
function toast(s, error=false) { const n=document.createElement('div'); n.className='toast'+(error?' error':''); n.textContent=s; $('#toast-root').append(n); setTimeout(()=>n.remove(),3200); }
function setTheme(t) { theme=t; document.documentElement.dataset.theme=t; localStorage.setItem('chitdrop:theme',t); $('.theme-glyph').textContent=t==='dark'?'☾':'☼'; }
$('#theme-toggle').onclick=()=>setTheme(theme==='dark'?'light':'dark'); setTheme(theme);
$('#home-button').hidden=!token; $('#home-button').onclick=()=>{stopPoll();location.href=location.pathname;};
async function rpc(fn,args={}) { const {data,error}=await db.rpc(fn,args); if(error) throw error; return data; }
function stopPoll(){ if(poll)clearInterval(poll); poll=null; }
function sessionId(){ const k='chitdrop:session:'+token; let v=localStorage.getItem(k); if(!v){v=crypto.randomUUID();localStorage.setItem(k,v);} return v; }
function nameKey(){return 'chitdrop:name:'+token;}
function linkFor(t){const u=new URL(location.pathname,location.origin);u.searchParams.set('room',t);return u.href;}
function setStatus(s,cls=''){const e=$('#connection-indicator');e.className='connection-indicator '+cls;e.lastElementChild.textContent=s;}
function paperField(){return '<span class="paper-ball" aria-hidden="true"></span>';}
function welcome(){
 stopPoll();
 app.innerHTML=`<section class="hero"><div class="hero-copy"><div class="eyebrow">A little chance. A little paper.</div><h1 class="display-title">Make a moment<br>of <em>mystery.</em></h1><p class="lede">Gather your thoughts into tiny paper chits. Share one room. Let everyone pick a surprise, one by one.</p><div class="hero-actions"><a class="button primary" href="#creator">Create a drop ↗</a><a class="button secondary" href="#how">How it works</a></div></div><div class="hero-art"><div class="paper-orbit">${Array.from({length:12},(_,i)=>`<span class="paper-ball" style="--x:${50+Math.cos(i*2.4)*35}%;--y:${50+Math.sin(i*2.4)*35}%;--r:${i*31}deg;--d:${i*.17}s"></span>`).join('')}</div><span class="art-caption">No two picks are the same</span></div></section>
 <section class="feature-strip" id="how"><div><small>01</small><b>Write your chits</b><p>Turn prompts, rewards or surprises into paper slips.</p></div><div><small>02</small><b>Share one room</b><p>Everyone arrives at the same pool of unopened chits.</p></div><div><small>03</small><b>Pick your moment</b><p>Each chit can be opened once. The rest disappear in sync.</p></div></section>
 <section class="auth-layout" id="creator"><div><div class="eyebrow">For the one who sets it up</div><h2>Start with<br>the first fold.</h2><p>Sign in with an email link to create and manage rooms. Participants only need the shared link and a name.</p></div><form class="panel form-card" id="login"><h3>Creator sign in</h3><p class="muted">A secure sign-in link. No password to remember.</p><label>Email address<input id="email" type="email" autocomplete="email" required placeholder="you@example.com"></label><button class="button primary wide">Send sign-in link →</button><p class="form-message" id="login-msg">Your rooms stay connected to your account.</p></form></section>`;
 $('#login').onsubmit=async e=>{e.preventDefault();const b=$('button',e.currentTarget),m=$('#login-msg');b.disabled=true;m.textContent='Sending…';try{const {error}=await db.auth.signInWithOtp({email:$('#email').value.trim(),options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;m.textContent='Check your inbox for the sign-in link.';}catch(x){m.textContent=x.message;}finally{b.disabled=false;}};
}
function dashboard(){
 stopPoll();
 app.innerHTML=`<section class="dashboard"><div class="dashboard-head"><div><div class="eyebrow">Your paper trail</div><h1>Your drops.</h1></div><div class="actions"><button class="button secondary" id="logout">Sign out</button><button class="button primary" id="new">Create a room +</button></div></div><div id="rooms" class="room-list"><p class="muted">Gathering your rooms…</p></div></section>`;
 $('#logout').onclick=()=>db.auth.signOut(); $('#new').onclick=createScreen;
 rpc('owner_list_rooms').then(rows=>{const el=$('#rooms');if(!rows?.length){el.innerHTML='<div class="empty-state">No rooms yet. Create your first drop.</div>';return;}el.innerHTML=rows.map(r=>`<article class="room-row"><div><h3>${esc(r.title)}</h3><p class="muted">${new Date(r.created_at).toLocaleDateString()} · ${esc(r.theme)} theme</p></div><div class="room-progress"><b>${r.remaining_count}<small> / ${r.total_count}</small></b><span>Unopened</span></div><button class="button secondary small" data-room="${r.id}">Manage →</button></article>`).join('');el.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>manage(b.dataset.room));}).catch(e=>$('#rooms').textContent=e.message);
}
function createScreen(){
 app.innerHTML=`<section class="create-layout"><aside><div class="eyebrow">Build a new room</div><h1>What’s inside<br>the paper?</h1><p>Write one surprise per chit. Picked contents are sealed; unopened chits can be edited later.</p><button class="button quiet" id="back">← Your rooms</button></aside><form class="panel editor" id="create"><label>Room title<input id="title" maxlength="80" required placeholder="Friday night surprises"></label><label>A little note <span class="muted">(optional)</span><input id="description" maxlength="240" placeholder="A short message for everyone"></label><label>Room mood<select id="mood"><option value="paper">Warm paper</option><option value="dark">Dark room</option></select></label><div class="editor-top"><h3>The chits</h3><span id="count">3 chits</span></div><div id="chit-inputs">${[1,2,3].map((n)=>field(n)).join('')}</div><div class="editor-footer"><button type="button" class="button secondary small" id="add">＋ Add another chit</button><span>Up to 100 chits</span></div><p class="form-message" id="create-msg"></p><button class="button primary wide">Create room & get share link ↗</button></form></section>`;
 $('#back').onclick=dashboard;$('#add').onclick=()=>{const n=$$('#chit-inputs textarea').length;if(n>=100)return toast('Maximum 100 chits.',true);$('#chit-inputs').insertAdjacentHTML('beforeend',field(n+1));$('#count').textContent=(n+1)+' chits';};
 $('#chit-inputs').onclick=e=>{if(e.target.matches('[data-remove]')){if($$('#chit-inputs textarea').length<=1)return toast('A room needs at least one chit.',true);e.target.closest('.chit-field').remove();renumber();}};
 $('#create').onsubmit=async e=>{e.preventDefault();const b=e.submitter,m=$('#create-msg'),chits=$$('#chit-inputs textarea').map(x=>x.value.trim());if(chits.some(x=>!x))return m.textContent='Every chit needs content.';b.disabled=true;b.textContent='Folding your chits…';try{const r=await rpc('create_chit_room',{p_title:$('#title').value.trim(),p_description:$('#description').value.trim(),p_theme:$('#mood').value,p_chits:chits});await manage(r.id);toast('Your room is ready.');}catch(x){m.textContent=x.message;b.disabled=false;b.textContent='Create room & get share link ↗';}};
}
function field(n){return `<div class="chit-field"><span class="ordinal">${String(n).padStart(2,'0')}</span><textarea required maxlength="1200" placeholder="Write a surprise, prompt or reward…"></textarea><button type="button" data-remove aria-label="Remove chit">×</button></div>`;}
function $$(s,root=document){return [...root.querySelectorAll(s)];}
function renumber(){$$('#chit-inputs .chit-field').forEach((r,i)=>r.querySelector('.ordinal').textContent=String(i+1).padStart(2,'0'));$('#count').textContent=$$('#chit-inputs textarea').length+' chits';}
async function manage(id){
 ownerRoom=id;app.innerHTML='<div class="boot-state"><span class="loader"></span><p>Unfolding your room…</p></div>';
 try{const r=await rpc('owner_get_room',{p_room_id:id});renderManage(r);}catch(e){app.innerHTML=`<section class="panel setup-card"><h2>Could not open this room.</h2><p>${esc(e.message)}</p><button class="button secondary" id="back">Back</button></section>`;$('#back').onclick=dashboard;}
}
function renderManage(r){
 const ch=r.chits||[],open=ch.filter(x=>x.state==='open').length,url=linkFor(r.share_token);
 app.innerHTML=`<section class="manage-page"><div class="manage-top"><div><div class="eyebrow">Room management</div><h1>${esc(r.title)}</h1><p class="muted">Created ${new Date(r.created_at).toLocaleString()}</p></div><div class="actions"><button class="button secondary small" id="back">← All rooms</button><button class="button primary small" id="preview">Preview ↗</button></div></div><div class="manage-summary"><span><b>${ch.length}</b> total</span><span><b>${open}</b> unopened</span><span><b>${ch.length-open}</b> picked</span></div><div class="share-panel"><label>Share link<input readonly id="share" value="${esc(url)}"></label><button class="button secondary small" id="copy">Copy link</button></div><section class="panel editor"><div class="form-grid"><label>Room title<input id="edit-title" maxlength="80" value="${esc(r.title)}"></label><label>Theme<select id="edit-theme"><option value="paper" ${r.theme==='paper'?'selected':''}>Warm paper</option><option value="dark" ${r.theme==='dark'?'selected':''}>Dark room</option></select></label></div><label>Description<input id="edit-description" maxlength="240" value="${esc(r.description||'')}"></label><button class="button secondary small" id="save-room">Save details</button></section><section class="manage-section"><h2>Inside this room</h2><div id="managed-chits">${ch.map((c,i)=>`<article class="managed-chit"><span class="ordinal">${String(i+1).padStart(2,'0')}</span><div>${c.state==='open'?`<textarea data-body="${c.id}" maxlength="1200">${esc(c.body)}</textarea>`:`<span class="picked-label">Picked by ${esc(c.picked_by||'Participant')}</span><p class="muted">Content sealed after selection.</p>`}</div>${c.state==='open'?'<div class="actions"><button class="button secondary small" data-save="'+c.id+'">Save</button><button class="button danger small" data-delete="'+c.id+'">×</button></div>':'<span class="picked-label">Opened</span>'}</article>`).join('')}</div></section><section class="panel editor"><h2>Add more chits</h2><label>One chit per line<textarea id="more" placeholder="A surprise for the group&#10;Pick the next song"></textarea></label><button class="button primary small" id="add-more">Add chits</button></section><section class="manage-section"><h2>Room controls</h2><div class="actions"><button class="button secondary small" id="reset">Reset all chits</button><button class="button danger small" id="delete">Delete room</button></div></section></section>`;
 $('#back').onclick=dashboard;$('#preview').onclick=()=>window.open(url,'_blank','noopener');$('#copy').onclick=async()=>{await navigator.clipboard.writeText(url);toast('Share link copied.');};
 $('#save-room').onclick=async()=>{try{await rpc('owner_update_room',{p_room_id:ownerRoom,p_title:$('#edit-title').value.trim(),p_description:$('#edit-description').value.trim(),p_theme:$('#edit-theme').value});await manage(ownerRoom);toast('Room details saved.');}catch(e){toast(e.message,true);}};
 $('#managed-chits').onclick=async e=>{const s=e.target.closest('[data-save]'),d=e.target.closest('[data-delete]');try{if(s){const id=s.dataset.save,body=$('[data-body="'+id+'"]').value;const ok=await rpc('owner_update_chit',{p_chit_id:id,p_body:body.trim()});if(!ok)throw Error('This chit has already been picked.');toast('Chit updated.');}if(d){if(!confirm('Delete this unopened chit?'))return;const ok=await rpc('owner_delete_chit',{p_chit_id:d.dataset.delete});if(!ok)throw Error('This chit may already be picked.');await manage(ownerRoom);toast('Chit deleted.');}}catch(x){toast(x.message,true);}};
 $('#add-more').onclick=async()=>{const rows=$('#more').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);try{await rpc('owner_add_chits',{p_room_id:ownerRoom,p_chits:rows});await manage(ownerRoom);toast('Chits added.');}catch(e){toast(e.message,true);}};
 $('#reset').onclick=async()=>{if(!confirm('Make every chit available again?'))return;try{await rpc('owner_reset_room',{p_room_id:ownerRoom});await manage(ownerRoom);toast('Room reset.');}catch(e){toast(e.message,true);}};
 $('#delete').onclick=async()=>{if(!confirm('Permanently delete this room?'))return;try{await rpc('owner_delete_room',{p_room_id:ownerRoom});dashboard();toast('Room deleted.');}catch(e){toast(e.message,true);}};
}
async function loadRoom(){
 stopPoll();setStatus('Connecting');app.innerHTML='<div class="boot-state"><span class="loader"></span><p>Finding your room…</p></div>';
 try{room=await rpc('get_shared_room',{p_token:token});if(!room?.id)throw Error('This room link is invalid or the room was removed.');if(room.theme==='dark'&&!localStorage.getItem('chitdrop:theme'))setTheme('dark');name=localStorage.getItem(nameKey())||'';session=sessionId();setStatus('Room live','ready');if(!name)nameGate();else{await refresh();poll=setInterval(refresh,4200);}}
 catch(e){setStatus('Unavailable','offline');app.innerHTML=`<section class="panel name-gate"><div class="eyebrow">Room not found</div><h1>Can’t find this drop.</h1><p>${esc(e.message)}</p><a class="button secondary" href="${esc(location.pathname)}">Go to ChitDrop</a></section>`;}
}
function nameGate(){
 app.innerHTML=`<section class="panel name-gate"><div class="eyebrow">You’ve been invited</div><h1>${esc(room.title)}</h1><p>${esc(room.description||'A little surprise is waiting inside. Add your name, then choose one of the remaining paper chits.')}</p><form id="join"><label>Your name<input id="participant" maxlength="40" required autocomplete="name" placeholder="What should we call you?"></label><button class="button primary wide">Enter the room →</button></form><p class="muted">One pick per browser session. Unopened chits are shared with everyone.</p></section>`;
 $('#join').onsubmit=async e=>{e.preventDefault();name=$('#participant').value.trim();if(!name)return;localStorage.setItem(nameKey(),name);await refresh();poll=setInterval(refresh,4200);};
}
async function refresh(){
 if(busy||!name)return;busy=true;
 try{const [r,mine]=await Promise.all([rpc('get_shared_room',{p_token:token}),rpc('get_my_picks',{p_token:token,p_session_id:session})]);room=r;myPick=Array.isArray(mine)?mine[0]||null:null;renderRoom();setStatus('Room live','ready');}
 catch(e){setStatus('Reconnecting','offline');}finally{busy=false;}
}
function pos(i,n){const a=i*2.399963+.3,r=n===1?0:5+37*Math.sqrt((i+1)/n);return{x:50+Math.cos(a)*r,y:50+Math.sin(a)*r};}
function rot(s){let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))|0;return Math.abs(h)%57-28;}
function renderRoom(){
 const a=room.available_chits||[],remaining=room.remaining_count||0,total=room.total_count||0;
 const contents=myPick?`<div class="empty-room"><div class="empty-icon">✳</div><h2>Your chit is picked.</h2><p>Your surprise is saved to this browser session.</p><button class="button secondary small" id="view-pick">View your pick</button></div>`:remaining?`<div class="room-stage-wrap"><div class="room-stage" id="stage"><div class="stage-center"><span>Choose one</span></div>${a.map((c,i)=>{const p=pos(i,a.length);return `<button class="paper-ball" data-pick="${c.id}" aria-label="Pick a crumpled paper chit" style="left:${p.x}%;top:${p.y}%;--size:${a.length>35?42:a.length>18?48:58}px;--rot:${rot(c.id)}deg;--delay:${-i*.23}s"></button>`;}).join('')}</div><p class="stage-footnote">Tap a paper to make your pick</p></div>`:`<div class="empty-room"><div class="empty-icon">✳</div><h2>All picked.</h2><p>Every chit in this room has found a home.</p></div>`;
 app.innerHTML=`<section class="room-view"><div class="room-heading"><div><div class="eyebrow">A shared drop · ${room.theme==='dark'?'Dark room':'Warm paper'}</div><h1>${esc(room.title)}</h1><p>${esc(room.description||'Choose one crumpled chit. What’s inside is yours to discover.')}</p></div><div class="room-count"><b>${remaining}<small> / ${total}</small></b><span>Still unopened</span></div></div>${contents}<div class="participant-bar"><span class="name-chip">Picking as ${esc(name)}</span></div></section>`;
 $('#stage')?.addEventListener('click',pick);$('#view-pick')?.addEventListener('click',()=>reveal(myPick.body,myPick.picked_at,true));
}
async function pick(e){
 const b=e.target.closest('[data-pick]');if(!b||b.disabled)return;$$('[data-pick]',$('#stage')).forEach(x=>x.disabled=true);b.classList.add('is-picking');
 try{const r=await rpc('pick_chit',{p_token:token,p_chit_id:b.dataset.pick,p_participant_name:name,p_session_id:session});if(!r?.ok){toast('Someone got to that chit first. Pick another.',true);await refresh();return;}await refresh();reveal(r.body,r.picked_at,false);}
 catch(x){toast(x.message||'Could not save your pick.',true);await refresh();}
}
function reveal(body,at,revisit){
 const back=document.createElement('div');back.className='reveal-backdrop';back.innerHTML=`<article class="reveal-sheet" role="dialog" aria-modal="true" aria-label="Your picked chit"><button class="reveal-close" type="button" aria-label="Close">×</button><div class="reveal-body">${esc(body)}</div></article>`;document.body.append(back);const close=()=>back.remove();$('.reveal-close',back).onclick=close;back.onclick=e=>{if(e.target===back)close();};document.addEventListener('keydown',function onKey(e){if(e.key==='Escape'){close();document.removeEventListener('keydown',onKey);}},{once:true});
}
async function init(){
 if(!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY){app.textContent='Supabase configuration is missing.';return;}
 const {data}=await db.auth.getSession();user=data.session?.user||null;
 db.auth.onAuthStateChange((_event,s)=>{user=s?.user||null;if(!token)user?dashboard():welcome();});
 if(token)await loadRoom();else user?dashboard():welcome();
}
init().catch(e=>{app.innerHTML='<section class="panel setup-card"><h2>Could not start ChitDrop</h2><p>'+esc(e.message)+'</p></section>';});
