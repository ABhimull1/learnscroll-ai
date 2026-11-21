const TOPICS=['AI News & Breakthroughs','AI Tools & Tutorials','AI Agents & Automation','AI Business Opportunities','Machine Learning','Robotics & Technology','AI Coding & App Development','AI Research & Education'];
const QUERIES=['artificial intelligence latest explained shorts','AI tools tutorial shorts','AI agents automation tutorial shorts','AI business ideas practical shorts','machine learning explained shorts','robotics AI technology shorts','AI coding app development shorts','AI research explained shorts'];
const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
let videos=get('ls_videos',[]),saved=get('ls_saved',[]),settings=get('ls_settings',{topics:TOPICS,level:'balanced',key:''}),tab='feed',lastScroll=0;
const el=document.getElementById('view'),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=v=>'https://www.youtube.com/watch?v='+encodeURIComponent(v.id);
function nav(t){tab=t;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));render()}
function render(){document.getElementById('count').textContent=videos.length+' videos';if(tab==='feed')feed();else if(tab==='saved')savedView();else if(tab==='discover')discover();else settingsView()}
let feedObserver=null,autoFetchBusy=false,lastAutoFetch=0;
let soundOn=get('ls_sound_on',true);
let persistentPlayer=null,playerReady=false,activeVideoId=null,playerLoadHandler=null;
function playerCommand(frame,func,args=[]){if(frame?.contentWindow)frame.contentWindow.postMessage(JSON.stringify({event:'command',func,args}),'https://www.youtube.com')}
function setSound(frame){if(!frame||!playerReady)return;playerCommand(frame,'setVolume',[100]);playerCommand(frame,soundOn?'unMute':'mute');}
function ensurePlayer(id){
 if(persistentPlayer)return persistentPlayer;
 const iframe=document.createElement('iframe');iframe.title='YouTube embedded video';
 iframe.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
 iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.allowFullscreen=true;
 iframe.src='https://www.youtube.com/embed/'+encodeURIComponent(id)+'?playsinline=1&autoplay=1&mute='+(soundOn?'0':'1')+'&rel=0&enablejsapi=1&origin='+encodeURIComponent(location.origin);
 iframe.addEventListener('load',()=>{playerReady=true;setSound(iframe);if(activeVideoId!==id)playerCommand(iframe,'loadVideoById',[activeVideoId]);});
 persistentPlayer=iframe;return iframe;
}
function activateVideo(id,host){
 if(!host)return;
 const oldId=activeVideoId;
 activeVideoId=id;
 const frame=ensurePlayer(id);
 // Moving the same iframe preserves its browsing context and player instance.
 if(frame.parentElement!==host)host.appendChild(frame);
 if(oldId!==id&&playerReady){playerCommand(frame,'loadVideoById',[id]);setSound(frame);}
}
function feed(){
 const arr=videos.filter(v=>settings.topics.includes(v.topic));
 if(!arr.length){el.innerHTML='<div class="empty"><h2>Your learning feed is ready</h2><p>Open Discover to fetch educational Shorts.</p><button class="action" id="go">Discover videos</button></div>';document.getElementById('go').onclick=()=>nav('discover');return}
 // Detach the iframe before replacing the feed DOM; retain the same player.
 if(persistentPlayer?.parentElement)persistentPlayer.remove();
 el.innerHTML='<section class="feed" id="feed">'+arr.map((v,i)=>`<article class="slide" data-index="${i}"><div class="player" data-id="${esc(v.id)}"><span class="hint">Loading video…</span></div><div class="load-hint">Swipe up for the next Short · Sound may require a tap</div><div class="overlay"><div class="title">${esc(v.title)}</div><div class="meta">${esc(v.channel)} · ${esc(v.topic)} · ${esc(v.duration||'Short')}</div></div><div class="actions"><button data-sound aria-label="Toggle sound">${soundOn?'🔊 Sound on':'🔇 Sound off'}</button><button data-save="${esc(v.id)}">${saved.some(x=>x.id===v.id)?'♥ Saved':'♡ Save'}</button><button data-share="${esc(v.id)}">↗ Share</button><button data-open="${esc(v.id)}">YouTube ↗</button></div></article>`).join('')+'</section>';
 const f=document.getElementById('feed');f.scrollTop=Math.min(lastScroll,Math.max(0,f.scrollHeight-f.clientHeight));
 if(feedObserver)feedObserver.disconnect();
 feedObserver=new IntersectionObserver(entries=>{
  const candidates=entries.filter(e=>e.isIntersecting&&e.intersectionRatio>=.65).sort((a,b)=>b.intersectionRatio-a.intersectionRatio);
  if(!candidates.length)return;
  const slide=candidates[0].target,p=slide.querySelector('.player'),id=p.dataset.id;
  if(activeVideoId!==id||persistentPlayer?.parentElement!==p){p.querySelector('.hint')?.remove();activateVideo(id,p)}
  if(Number(slide.dataset.index)>=arr.length-4)maybeFetchMore();
 },{root:f,threshold:[.65,.85]});f.querySelectorAll('.slide').forEach(sl=>feedObserver.observe(sl));
 f.addEventListener('scroll',()=>{lastScroll=f.scrollTop},{passive:true});
 el.querySelectorAll('[data-sound]').forEach(b=>b.onclick=()=>{soundOn=!soundOn;put('ls_sound_on',soundOn);el.querySelectorAll('[data-sound]').forEach(x=>x.textContent=soundOn?'🔊 Sound on':'🔇 Sound off');setSound(persistentPlayer);});
 el.querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>toggleSave(b.dataset.save));
 el.querySelectorAll('[data-share]').forEach(b=>b.onclick=()=>share(b.dataset.share));
 el.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>window.open(url(videos.find(v=>v.id===b.dataset.open)),'_blank','noopener'));
}
async function maybeFetchMore(){
 if(autoFetchBusy||!settings.key||Date.now()-lastAutoFetch<30*60*1000)return;
 autoFetchBusy=true;lastAutoFetch=Date.now();
 // Only one topic search per automatic refill, to conserve YouTube's search quota.
 try{const topic=settings.topics[Math.floor(Math.random()*settings.topics.length)];if(!topic)return;
 const ix=TOPICS.indexOf(topic),q=new URLSearchParams({part:'snippet',type:'video',videoDuration:'short',videoEmbeddable:'true',maxResults:'25',q:QUERIES[ix],key:settings.key});
 const r=await fetch('https://www.googleapis.com/youtube/v3/search?'+q),j=await r.json();if(!r.ok)throw Error(j.error?.message||'Search failed');
 const ids=(j.items||[]).map(x=>x.id.videoId).filter(Boolean);if(!ids.length)return;
 const r2=await fetch('https://www.googleapis.com/youtube/v3/videos?'+new URLSearchParams({part:'contentDetails,status,snippet',id:ids.join(','),key:settings.key})),d=await r2.json();if(!r2.ok)return;
 const seen=new Set(videos.map(v=>v.id));let added=0;
 for(const x of d.items||[]){const duration=seconds(x.contentDetails?.duration||''),title=x.snippet?.title||'',desc=x.snippet?.description||'';
 if(duration<8||duration>180||x.status?.embeddable===false||x.status?.privacyStatus!=='public'||!isRelevant(title,desc)||seen.has(x.id))continue;
 videos.push({id:x.id,title,channel:x.snippet.channelTitle,topic,duration:duration+' sec'});seen.add(x.id);added++;
 }if(added){put('ls_videos',videos);const f=document.getElementById('feed');if(f){const pos=f.scrollTop;feed();document.getElementById('feed').scrollTop=pos;}}
 }catch(e){console.warn('Background discovery:',e.message)}finally{autoFetchBusy=false}
}
function isRelevant(title,desc){const t=(title+' '+desc).toLowerCase();if(/essay writing|10 lines|school homework|assignment help|handwriting|boon or bane|exam answer|speech on artificial intelligence/.test(t))return false;return /\b(ai|artificial intelligence|machine learning|llm|agents?|robotics?|automation|neural|chatgpt|gemini|claude|coding|python)\b/i.test(t)}
function toggleSave(id){let v=videos.find(x=>x.id===id);if(!v)return;saved=saved.some(x=>x.id===id)?saved.filter(x=>x.id!==id):[v,...saved];put('ls_saved',saved);render()}
async function share(id){let v=videos.find(x=>x.id===id)||saved.find(x=>x.id===id);if(!v)return;try{if(navigator.share)await navigator.share({title:v.title,text:'LearnScroll AI: '+v.title,url:url(v)});else if(navigator.clipboard){await navigator.clipboard.writeText(url(v));alert('Link copied')}else prompt('Copy this link',url(v))}catch(e){if(e.name!=='AbortError')prompt('Copy this link',url(v))}}
function savedView(){el.innerHTML='<div class="panel"><h2>Learning Vault</h2><p class="hint">Your bookmarks are stored on this device.</p>'+(!saved.length?'<p>No saved videos yet.</p>':saved.map(v=>`<div class="saved"><b>${esc(v.title)}</b><div class="meta">${esc(v.topic)} · ${esc(v.channel)}</div><p><a href="${url(v)}" target="_blank" rel="noopener">Watch on YouTube</a> <button class="pill" data-share="${esc(v.id)}">Share</button> <button class="pill" data-remove="${esc(v.id)}">Remove</button></p></div>`).join(''))+'</div>';el.querySelectorAll('[data-share]').forEach(b=>b.onclick=()=>share(b.dataset.share));el.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{saved=saved.filter(v=>v.id!==b.dataset.remove);put('ls_saved',saved);render()})}
function discover(){el.innerHTML=`<div class="panel"><h2>Discover AI Shorts</h2><p class="note">Search uses the official YouTube Data API. Enter your own API key in Settings. Discovery is based on educational keywords, topic relevance, and duration. It is not a verified assessment of factual accuracy.</p><button class="action" id="fetch">Find videos in all selected topics</button><div id="status" class="status"></div><h2>Add a video link</h2><input class="field" id="manual" placeholder="Paste YouTube Shorts or watch URL"><select class="field" id="topic">${TOPICS.map(t=>`<option>${esc(t)}</option>`).join('')}</select><button class="action" id="add">Add to feed</button></div>`;document.getElementById('fetch').onclick=fetchVideos;document.getElementById('add').onclick=addManual}
function parseId(s){try{let u=new URL(s);if(!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname))return null;let id=u.hostname.endsWith('youtu.be')?u.pathname.slice(1):u.pathname.startsWith('/shorts/')?u.pathname.split('/')[2]:u.searchParams.get('v');return /^[\w-]{11}$/.test(id||'')?id:null}catch{return null}}
async function addManual(){let id=parseId(document.getElementById('manual').value),topic=document.getElementById('topic').value;if(!id)return alert('Enter a valid YouTube URL');let title='YouTube video '+id,channel='YouTube';if(settings.key){try{let r=await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id='+id+'&key='+encodeURIComponent(settings.key));let j=await r.json();if(j.items?.[0]){title=j.items[0].snippet.title;channel=j.items[0].snippet.channelTitle}}catch{}}videos=[{id,title,channel,topic,duration:'Unverified duration'},...videos.filter(v=>v.id!==id)];put('ls_videos',videos);lastScroll=0;nav('feed')}
const seconds=s=>{let m=s.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);return m?(+m[1]||0)*3600+(+m[2]||0)*60+(+m[3]||0):Infinity};
async function fetchVideos(){const st=document.getElementById('status');if(!settings.key){st.textContent='Add a YouTube Data API key in Settings first.';return}let all=[],errors=[];st.textContent='Searching YouTube…';for(const topic of settings.topics){try{let ix=TOPICS.indexOf(topic);let q=new URLSearchParams({part:'snippet',type:'video',videoDuration:'short',videoEmbeddable:'true',maxResults:'12',q:QUERIES[ix],key:settings.key});let r=await fetch('https://www.googleapis.com/youtube/v3/search?'+q);let j=await r.json();if(!r.ok)throw Error(j.error?.message||'Search failed');let ids=j.items.map(x=>x.id.videoId).filter(Boolean);if(!ids.length)continue;let r2=await fetch('https://www.googleapis.com/youtube/v3/videos?'+new URLSearchParams({part:'contentDetails,status,snippet',id:ids.join(','),key:settings.key}));let d=await r2.json();if(!r2.ok)throw Error(d.error?.message||'Metadata failed');for(const x of d.items||[]){let duration=seconds(x.contentDetails?.duration||'');if(duration>180||duration<8||x.status?.embeddable===false||x.status?.privacyStatus!=='public')continue;let title=x.snippet.title,desc=x.snippet.description||'';if(!isRelevant(title,desc))continue;all.push({id:x.id,title,channel:x.snippet.channelTitle,topic,duration:duration+' sec'})}}catch(e){errors.push(topic+': '+e.message)}st.textContent='Checked '+(ixSafe(topic)+1)+' of '+settings.topics.length+' topics…'}let seen=new Set(videos.map(x=>x.id));let added=0;for(const v of all){if(!seen.has(v.id)){videos.push(v);seen.add(v.id);added++}}put('ls_videos',videos);st.textContent=`Added ${added} videos. ${errors.length?'Errors: '+errors.join(' | '):''}`;document.getElementById('count').textContent=videos.length+' videos'}
function ixSafe(t){return settings.topics.indexOf(t)}
function settingsView(){el.innerHTML=`<div class="panel"><h2>Your learning preferences</h2><p class="hint">Balanced learning · Videos up to 3 minutes</p><div id="topics">${TOPICS.map(t=>`<label class="chip"><input type="checkbox" value="${esc(t)}" ${settings.topics.includes(t)?'checked':''}>${esc(t)}</label>`).join('')}</div><label>Learning style</label><select id="level" class="field"><option value="balanced">Balanced</option><option value="beginner">Beginner</option><option value="advanced">Advanced</option></select><label>YouTube Data API key</label><input class="field" id="key" type="password" placeholder="Paste your API key" value="${esc(settings.key)}"><p class="hint">For personal testing only: the key is stored in this browser. Do not publish a site with an unrestricted API key. Production requires a secured backend and quota controls.</p><button class="action" id="saveSettings">Save preferences</button><p class="hint">No video downloads or background playback. YouTube may decline playback for some videos.</p></div>`;document.getElementById('level').value=settings.level;document.getElementById('saveSettings').onclick=()=>{settings={topics:[...document.querySelectorAll('#topics input:checked')].map(x=>x.value),level:document.getElementById('level').value,key:document.getElementById('key').value.trim()};put('ls_settings',settings);lastScroll=0;render();alert('Preferences saved')}}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>nav(b.dataset.tab));if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});render();
