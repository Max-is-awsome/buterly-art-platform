import React,{useState,useRef,useEffect,useLayoutEffect} from 'react';
import{createRoot}from'react-dom/client';
import{Canvas}from'@react-three/fiber';
import{OrbitControls,Line,Html}from'@react-three/drei';
import './style.css';
const socialFields = [
  ['linkedin', 'LinkedIn', 'linkedin.com/in/your-name'],
  ['instagram', 'Instagram', 'instagram.com/your-name'],
  ['youtube', 'YouTube', 'youtube.com/@your-channel'],
  ['pinterest', 'Pinterest', 'pinterest.com/your-name'],
] as const;
type Artist = {displayName: string; bio: string; links?: Partial<Record<typeof socialFields[number][0], string>>};
const blankArtist: Artist = {displayName: '', bio: '', links: {}};
type Node={id:number,title:string,medium:string,statement:string,parents:number[],pos:[number,number,number],text?:string,url?:string,mime?:string,mine?:boolean,artist?:Artist|null,showArtist?:boolean};
const colors:Record<string,string>={Spark:'#EEEEEE','Visual art':'#DCA366',Photography:'#87AFD2',Music:'#96BD9A',Writing:'#B4A0D1',Film:'#D59191','3D art':'#7EBDB7','Mixed media':'#D5C38D'};
const questions=['What does silence sound like?','What makes somewhere home?','If time stopped, what would you miss?','Can imperfection be beautiful?','What does it mean to be free?','What would humanity look like from elsewhere?'];
const titles=['Somewhere Else','The quiet between','A place to return','Soft boundaries','After the rain','Things we carry','Still becoming','An open window','Unwritten','The shape of absence','In the distance','A small infinity','Where light rests','Almost home','Tender geometry','Between worlds','Slowly, slowly','The other side'];
const seed:Node[]=Array.from({length:64},(_,i)=>{const branch=i<6?i:(i-6)%6;const a=branch*Math.PI/3;const depth=i<6?0:1+Math.floor((i-6)/6);const r=i<6?3:4+depth*.85;return{id:i,title:i<6?questions[i]:titles[(i-6)%titles.length],medium:i<6?'Spark':Object.keys(colors)[1+(i%7)],statement:i<6?'An open question. An invitation to interpret it in your own way.':'A fictional study in belonging, distance, and the things that connect us.',parents:i<6?[]:[i<12?branch:i-6,...(i===38?[2]:[])],pos:[Math.cos(a+Math.sin(i*3)*.4)*r,Math.sin(a+Math.sin(i*3)*.4)*r,(Math.sin(i*2.4))*4]}});
function read(key:string,fallback:any){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function FlyingButterfly({logo, headline}: {
  logo: React.RefObject<HTMLSpanElement | null>;
  headline: React.RefObject<HTMLElement | null>;
}) {
  const butterfly = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const insect = butterfly.current;
    const brand = logo.current;
    const word = headline.current;
    if (!insect || !brand || !word) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let flight: Animation | undefined;
    let depth: Animation | undefined;

    const between = (min: number, max: number) => min + Math.random() * (max - min);
    const nextPass = () => {
      const reverse = Math.random() < .5;
      const x = (fraction: number) => reverse ? 1 - fraction : fraction;
      const turn = reverse ? -1 : 1;
      const hesitation = between(.49, .55);
      return {
        duration: between(3100, 4800),
        wingbeat: between(85, 160),
        frames: [
          {target: 'logo', x: 1, y: 0, angle: 18, offset: 0, easing: 'ease-in'},
          {target: 'logo', x: between(.66, .85), y: between(.35, .58), angle: -36, offset: .12},
          {target: 'logo', x: between(.08, .33), y: between(.47, .74), angle: -65, offset: .23},
          {target: 'logo', x: between(-.12, .15), y: between(.92, 1.22), angle: 12, offset: .30, easing: 'ease-in-out'},
          {target: 'word', x: x(between(-.12, .12)), y: between(.04, .51), angle: 42 * turn, offset: hesitation, easing: 'ease-out'},
          {target: 'word', x: x(between(.03, .3)), y: between(-.19, .24), angle: -25 * turn, offset: .58, easing: 'ease-in'},
          {target: 'word', x: x(between(.42, .7)), y: between(.33, .68), angle: 70 * turn, offset: .66},
          {target: 'word', x: x(between(.92, 1.11)), y: between(.29, .59), angle: 36 * turn, offset: .75, easing: 'ease-out'},
          {target: 'word', x: x(between(.38, .82)), y: between(-.38, -.12), angle: -45 * turn, offset: .84, easing: 'ease-in-out'},
          {target: 'logo', x: 1, y: 0, angle: 18, offset: 1},
        ],
      };
    };
    let pass = nextPass();

    function layout() {
      if (!insect || !brand || !word) return;
      const logoBox = brand.getBoundingClientRect();
      const wordBox = word.getBoundingClientRect();
      const point = (box: DOMRect, x: number, y: number, angle: number) => {
        const left = Math.min(window.innerWidth - 18, Math.max(0, box.left + box.width * x - 9));
        return `translate(${left}px, ${box.top + box.height * y - 7}px) rotate(${angle}deg)`;
      };
      insect.style.transform = point(logoBox, 1, 0, 18);
      if (reduceMotion.matches) {
        flight?.cancel();
        depth?.cancel();
        flight = depth = undefined;
        return;
      }

      const frames = pass.frames.map(({target, x, y, angle, offset, easing}) => ({
        transform: point(target === 'word' && wordBox.width ? wordBox : logoBox, x, y, angle),
        offset, easing: easing ?? 'linear',
      }));
      if (flight?.effect instanceof KeyframeEffect) {
        flight.effect.setKeyframes(frames);
        return;
      }

      insect.style.setProperty('--wingbeat', `${pass.wingbeat}ms`);
      flight = insect.animate(frames, {duration: pass.duration});
      depth = insect.animate([
        {zIndex: 6, offset: 0, easing: 'steps(1, end)'},
        {zIndex: 1, offset: .12, easing: 'steps(1, end)'},
        {zIndex: 6, offset: .30, easing: 'steps(1, end)'},
        {zIndex: 1, offset: .66, easing: 'steps(1, end)'},
        {zIndex: 6, offset: .75},
        {zIndex: 6, offset: 1},
      ], {duration: pass.duration});
      flight.onfinish = () => {
        flight = undefined;
        pass = nextPass();
        layout();
      };
    }

    const observer = new ResizeObserver(layout);
    observer.observe(brand);
    observer.observe(word);
    window.addEventListener('resize', layout);
    window.addEventListener('scroll', layout, {passive: true});
    reduceMotion.addEventListener('change', layout);
    layout();
    return () => {
      flight?.cancel();
      depth?.cancel();
      observer.disconnect();
      window.removeEventListener('resize', layout);
      window.removeEventListener('scroll', layout);
      reduceMotion.removeEventListener('change', layout);
    };
  }, [logo, headline]);

  return <i ref={butterfly} className="flutter-butterfly" aria-hidden="true"/>;
}

function App(){const[nodes,setNodes]=useState<Node[]>([]);const[user,setUser]=useState<{id:number}|null>(null);const[ready,setReady]=useState(false);const[googleReady,setGoogleReady]=useState(false);const[loadError,setLoadError]=useState('');const[publishing,setPublishing]=useState(false);const[privateReady,setPrivateReady]=useState(false);const[page,setPage]=useState('The Effect');const[selected,select]=useState<Node|null>(null);const[openedDetail,setDetail]=useState<Node|null>(null);const[filter,setFilter]=useState('All mediums');const[search,setSearch]=useState('');const[saved,setSaved]=useState<number[]>([]);const[parents,setParents]=useState<number[]>([1]);const[draft,setDraft]=useState({title:'',text:'',medium:'Writing',statement:''});const[media,setMedia]=useState<{url:string,mime:string}|null>(null);const[notice,setNotice]=useState('');const[review,setReview]=useState(false);const[ancestry,setAncestry]=useState(false);const controls=useRef<any>(null);
const logoText = useRef<HTMLSpanElement>(null);
const flutterWord = useRef<HTMLElement>(null);
const [artist, setArtist] = useState<Artist>(blankArtist);
const [profileEdit, setProfileEdit] = useState<Artist>(blankArtist);
const [profileStatus, setProfileStatus] = useState('');
const [profileSaving, setProfileSaving] = useState(false);
const [showArtist, setShowArtist] = useState(false);
const [creditSaving, setCreditSaving] = useState(false);
const detail = openedDetail && (nodes.find(node => node.id === openedDetail.id) ?? openedDetail);
const draftSynced = useRef('');
const draftWrite = useRef(Promise.resolve());

const message=(s:string)=>{setNotice(s);setTimeout(()=>setNotice(''),4000)};
async function api(path:string,method='GET',body?:unknown){const r=await fetch('/api'+path,{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});const data=await r.json().catch(()=>null);if(!r.ok||data===null)throw Error(data?.error||(r.status===413?'Upload is too large. Try a smaller file.':'Request failed. Please try again.'));return data}
useEffect(()=>{let active=true;async function load(){try{const me=await api('/me');const graph=await api('/nodes');if(!active)return;setUser(me.user);setGoogleReady(me.googleConfigured);setNodes(graph);setReady(true);if(me.user){const [privateData, profile] = await Promise.all([api('/private'), api('/profile')]);if(!active)return;setSaved(privateData.saved);if(privateData.draft){setDraft(privateData.draft);draftSynced.current=JSON.stringify(privateData.draft)}setArtist(profile);setProfileEdit(profile);setPrivateReady(true)}}catch{if(active)setLoadError('Unable to reach the network. Please reload to try again.')}}load();return()=>{active=false}},[]);
useEffect(()=>{if(!user||!privateReady||publishing)return;const snapshot=JSON.stringify(draft);if(snapshot===draftSynced.current||(!draftSynced.current&&!draft.title&&!draft.text&&!draft.statement))return;const timer=setTimeout(()=>{draftWrite.current = draftWrite.current.then(async () => {
  await api('/draft', 'PUT', draft);
  draftSynced.current = snapshot;
}).catch(() => message('Draft could not sync. Your changes are still on this page.'))},900);return()=>clearTimeout(timer)},[draft,user,privateReady,publishing]);
useEffect(()=>{if(!ready)return;const timer=setInterval(()=>{api('/nodes').then(setNodes).catch(()=>{})},30000);return()=>clearInterval(timer)},[ready]);
const update=(key:string,value:string)=>setDraft(d=>({...d,[key]:value}));
const begin=(n?:Node)=>{if(n)setParents([n.id]);setDetail(null);setPage('Release');setReview(false)};
const lineage=new Set<number>();function trace(id:number){if(lineage.has(id))return;lineage.add(id);nodes.find(n=>n.id===id)?.parents.forEach(trace)}if(selected&&ancestry)trace(selected.id);
const connected=new Set<number>();const pending=selected?[selected.id]:[];
while(pending.length){const id=pending.pop()!;if(connected.has(id))continue;connected.add(id);for(const n of nodes){if(n.parents.includes(id))pending.push(n.id)}}
if(selected){const ancestors=[...selected.parents];while(ancestors.length){const id=ancestors.pop()!;if(connected.has(id))continue;connected.add(id);ancestors.push(...(nodes.find(n=>n.id===id)?.parents||[]))}}
const visible=nodes.filter(n=>(filter==='All mediums'||n.medium===filter||n.medium==='Spark')&&(!search||n.title.toLowerCase().includes(search.toLowerCase())||n.medium.toLowerCase().includes(search.toLowerCase())));
const pageLabels:Record<string,string>={'The Effect':'Explore','Sparks':'Questions','Release':'Create','My Effect':'My work'};
const mediumLabel=(medium:string)=>medium==='Spark'?'Starting question':medium;

async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setProfileSaving(true);
  setProfileStatus('');
  try {
    const profile: Artist = await api('/profile', 'PUT', profileEdit);
    setArtist(profile);
    setProfileEdit(profile);
    setNodes(current => current.map(node => node.mine && node.showArtist
      ? {...node, showArtist: !!profile.displayName, artist: profile.displayName ? profile : null}
      : node));
    if (!profile.displayName) setShowArtist(false);
    setProfileStatus(profile.displayName ? 'Artist profile saved.' : 'Artist profile cleared.');
  } catch (error) {
    setProfileStatus((error as Error).message);
  } finally {
    setProfileSaving(false);
  }
}

async function changeCredit(node: Node) {
  const next = !node.showArtist;
  setCreditSaving(true);
  try {
    await api('/nodes/' + node.id + '/credit', 'PUT', {showArtist: next});
    setNodes(current => current.map(item => item.id === node.id
      ? {...item, showArtist: next, artist: next ? artist : null}
      : item));
    message(next ? 'Artist profile attached.' : 'Artist profile hidden on this artwork.');
  } catch (error) {
    message((error as Error).message);
  } finally {
    setCreditSaving(false);
  }
}

async function save(n:Node){if(!user){message('Sign in with Google to save artwork.');return}const next=!saved.includes(n.id);try{await api('/bookmarks/'+n.id,'PUT',{saved:next});setSaved(next?[...saved,n.id]:saved.filter(id=>id!==n.id))}catch(e){message((e as Error).message)}}
async function release(){if(publishing)return;if(!user){message('Sign in with Google to publish.');return}setPublishing(true);try{await draftWrite.current;const n:Node=await api('/nodes','POST',{...draft,text:draft.medium==='Writing'?draft.text:'',parents,...(draft.medium==='Writing'?null:media),showArtist:showArtist&&!!artist.displayName});n.artist=n.showArtist?artist:null;setNodes(current=>[...current.filter(x=>x.id!==n.id),n]);const emptyDraft={title:'',text:'',medium:'Writing',statement:''};draftSynced.current=JSON.stringify(emptyDraft);setDraft(emptyDraft);setShowArtist(false);setMedia(null);setPage('The Effect');select(n);setSearch('');setFilter('All mediums');message('Your artwork is published and saved to the shared network.')}catch(e){message((e as Error).message)}finally{setPublishing(false)}}
function artwork(n:Node){return n.url?(n.mime?.startsWith('audio')?<audio controls src={n.url}/>:n.mime?.startsWith('video')?<video controls src={n.url}/>:<img src={n.url} alt={n.statement||n.title}/>):n.text?<div className="poem">{n.text}</div>:<div className={'art art'+n.id%5} style={{'--art':colors[n.medium]} as React.CSSProperties}>{n.medium==='Spark'?<span>“</span>:<><i/><i/><i/></>}<small>{n.medium==='Spark'?'A question, infinitely interpreted':'Illustrative demo artwork'}</small></div>}
return <><header className={page==='The Effect'?'flight-header':undefined}><button className="brand" onClick={()=>setPage('The Effect')}><span ref={logoText} className="brand-text">butterfly<span>.</span></span></button><nav>{['The Effect','Sparks','Release','My Effect'].map(p=><button className={page===p?'active':''} onClick={()=>{setPage(p);setDetail(null)}} key={p}>{p==='Release'?'+ ':''}{pageLabels[p]}</button>)}</nav>{user?<button className="auth-button" onClick={async()=>{try{await api('/logout','POST',{});window.location.reload()}catch{message('Could not sign out. Try again.')}}}>Sign out</button>:<a className="auth-button" href={googleReady?"/api/auth/google":undefined} aria-disabled={!googleReady}>{googleReady?"Sign in with Google":ready?"Sign-in unavailable":"Checking sign-in…"}</a>}</header>
{loadError&&<div className="network-status" role="alert">{loadError}</div>}{!ready&&!loadError&&<div className="network-status">Loading the shared network…</div>}{page==='The Effect'&&<main className="effect"><div className="intro"><div className="eyebrow">A NETWORK OF HUMAN CREATIVITY</div><h1>Everything begins<br/>with a <em ref={flutterWord}>flutter.</em></h1><p>One thought. Endless interpretations.<br/>Discover what happens next.</p></div><div className="search"><span>⌕</span><input aria-label="Search artwork" placeholder="Search artwork or questions…" value={search} onChange={e=>setSearch(e.target.value)}/><kbd>↵</kbd></div><div className="graph"><Canvas camera={{position:[0,0,27],fov:48}} onPointerMissed={()=>select(null)}><ambientLight intensity={1.8}/><directionalLight position={[5,8,10]} intensity={2}/>{visible.flatMap(n=>n.parents.map(id=>{const p=visible.find(x=>x.id===id);return p?<Line key={n.id+'-'+id} points={[p.pos,n.pos]} color={selected&&connected.has(n.id)&&connected.has(id)?'#ffe0ac':'#91949b'} transparent opacity={selected?(connected.has(n.id)&&connected.has(id)?1:.1):.48} lineWidth={selected&&connected.has(n.id)&&connected.has(id)?2.6:1}/>:null}))}{visible.map(n=><mesh key={n.id} position={n.pos} onClick={e=>{e.stopPropagation();select(n)}} onDoubleClick={e=>{e.stopPropagation();controls.current?.target.set(...n.pos)}}><sphereGeometry args={[n.medium==='Spark'?.16:.105,20,16]}/><meshStandardMaterial transparent opacity={selected&&!connected.has(n.id)?.18:1} color={colors[n.medium]} roughness={.45} emissive={colors[n.medium]} emissiveIntensity={selected?.id===n.id?.7:.12}/>{(n.medium==='Spark'||selected?.id===n.id)&&<Html distanceFactor={24} position={[0,-.42,0]} center style={{pointerEvents:'none'}}><div className={'node-label '+(selected?.id===n.id?'chosen':'')}>{n.title}</div></Html>}</mesh>)}<OrbitControls ref={controls} enableDamping dampingFactor={.045} minDistance={6} maxDistance={50}/></Canvas></div>{selected&&<div className="branch-status"><b>{connected.size} connected creations highlighted</b><span>Follow the bright connections through the 3D map.</span><button onClick={()=>select(null)}>Clear highlight ×</button></div>}<div className="legend">{Object.entries(colors).map(([k,c])=><button key={k} className={filter===k?'on':''} onClick={()=>setFilter(filter===k?'All mediums':k)}><b style={{background:c}}/>{mediumLabel(k)}</button>)}</div><div className="bottom"><span><b className="live"/> THE EFFECT <small> / {nodes.length} connected creations</small></span><span className="hint">Drag to rotate <i>·</i> Scroll to explore <i>·</i> Click to discover</span><button onClick={()=>{controls.current?.reset();setAncestry(false);setFilter('All mediums');setSearch('')}}>↺ Reset view</button></div>{selected&&<aside><button className="close" onClick={()=>select(null)}>×</button>{artwork(selected)}<div className="preview-body"><div className="eyebrow" style={{color:colors[selected.medium]}}>{mediumLabel(selected.medium)}</div><h2>{selected.title}</h2><p>{selected.statement}</p><button className="primary" onClick={()=>setDetail(selected)}>View {selected.medium==='Spark'?'question':'artwork'} ↗</button><p className="muted">Its inspirations and everything it inspired are highlighted on the map.</p></div></aside>}</main>}
{page==='Sparks'&&<section className="page"><div className="eyebrow">EVERY CONNECTION STARTS SOMEWHERE</div><h1>A question.<br/><em>A world of possibilities.</em></h1><p>You don’t need an answer. Just your own way of seeing.</p><div className="cards">{nodes.filter(n=>n.medium==='Spark').map((n,i)=><button className="spark-card" key={n.id} onClick={()=>setDetail(n)}><span className="eyebrow">QUESTION 0{i+1} <b>↗</b></span><h2>{n.title}</h2><span>Explore interpretations →</span></button>)}</div></section>}
{page==='My Effect'&&!user&&<section className="page"><h1>My <em>work.</em></h1><p>Sign in to see your creations, drafts, and privately saved artwork.</p><a className="primary sign-in" href={googleReady?"/api/auth/google":undefined} aria-disabled={!googleReady}>{googleReady?"Continue with Google →":"Google sign-in is being configured"}</a></section>}{page==='My Effect'&&user&&<section className="page"><div className="eyebrow">YOUR PRIVATE CREATIVE SPACE</div><h1>My <em>work.</em></h1><p>See where your creativity travels. Saved securely to your account.</p><div className="stats"><div><strong>{nodes.filter(n=>n.mine).length}</strong>Your artworks</div><div><strong>{saved.length}</strong>Privately saved</div><div><strong>{draft.title||draft.text?1:0}</strong>Drafts</div></div><button className="primary" onClick={()=>begin()}>Continue creating ↗</button><form className="artist-editor" onSubmit={saveProfile}>
  <h2>Artist profile</h2>
  <p>Use a pen name and tell people what you like to make. Your profile appears publicly only on artwork you choose to credit.</p>
  <fieldset disabled={!privateReady || profileSaving}>
    <label htmlFor="artist-name">Artist name</label>
    <input id="artist-name" maxLength={48} value={profileEdit.displayName} onChange={event => setProfileEdit({...profileEdit, displayName: event.target.value})}/>
    <label htmlFor="artist-bio">About your art <small>optional</small></label>
    <textarea id="artist-bio" maxLength={280} value={profileEdit.bio} onChange={event => setProfileEdit({...profileEdit, bio: event.target.value})}/>
    <p className="muted">Leave out your school, location, contact details, and other private information. To clear your profile, empty all fields and save.</p>
    <h3>Social links <small>optional</small></h3>
    <p className="muted">Add as many or as few as you like. Visitors can see these links on artwork where you show your profile. Only share accounts you want visitors to find.</p>
    {socialFields.map(([key, label, placeholder]) => <React.Fragment key={key}>
      <label htmlFor={'artist-' + key}>{label}</label>
      <input id={'artist-' + key} inputMode="url" placeholder={placeholder} maxLength={500}
        value={profileEdit.links?.[key] ?? ''}
        onChange={event => setProfileEdit({...profileEdit, links: {...profileEdit.links, [key]: event.target.value}})}/>
    </React.Fragment>)}
    <button className="primary" type="submit">Save profile</button>
  </fieldset>
  <p role="status">{profileStatus}</p>
</form><h2>Your creations & saved artwork</h2><div className="cards">{nodes.filter(n=>n.mine||saved.includes(n.id)).map(n=><button className="work-card" onClick={()=>setDetail(n)} key={n.id}>{artwork(n)}<h2>{n.title}</h2><span>{n.medium}</span></button>)}</div>{!nodes.some(n=>n.mine||saved.includes(n.id))&&<p>Choose a starting question and create your first artwork.</p>}</section>}
{page==='Release'&&!user&&<section className="page"><div className="eyebrow">EVERYONE CAN EXPLORE</div><h1>Your art belongs <em>here.</em></h1><p>Sign in with Google to publish and save your work across devices. Butterfly stores your verified email for your account and keeps it off the map. <a href="/privacy.html">Privacy details</a></p><a className="primary sign-in" href={googleReady?"/api/auth/google":undefined} aria-disabled={!googleReady}>{googleReady?"Continue with Google →":"Google sign-in is being configured"}</a></section>}{page==='Release'&&user&&<section className="page release"><div className="eyebrow">ADD YOUR PERSPECTIVE</div><h1>Share your <em>artwork.</em></h1><p>Make something only you could make.</p><div className="form-grid"><div><label>01 / What inspired you?</label><p className="muted">Choose more than one to connect different creative branches.</p><div className="inspirations">{nodes.map(n=><button key={n.id} className={parents.includes(n.id)?'picked':''} onClick={()=>setParents(parents.includes(n.id)?parents.filter(p=>p!==n.id):[...parents,n.id])}>{parents.includes(n.id)?'✓':'+'} {n.title}</button>)}</div><label>02 / Choose your medium</label><select value={draft.medium} onChange={e=>{update('medium',e.target.value);setMedia(null);setReview(false)}}>{Object.keys(colors).filter(k=>k!=='Spark').map(k=><option key={k}>{k}</option>)}</select><label>03 / Your original creation</label>{draft.medium==='Writing'?<textarea aria-label="Your writing" maxLength={50000} className="writing" placeholder="There is no wrong place to begin…" value={draft.text} onChange={e=>update('text',e.target.value)}/>:<div className="upload"><input aria-label="Upload artwork" type="file" accept="image/png,image/jpeg,image/webp,audio/mpeg,audio/wav,video/mp4,video/webm" onChange={e=>{const file=e.target.files?.[0];setMedia(null);setReview(false);if(!file)return;if(file.size>10*1024*1024){message('Choose a file under 10 MB.');return}const r=new FileReader();r.onload=()=>setMedia({url:String(r.result),mime:file.type});r.readAsDataURL(file)}}/><p>{media?'Artwork ready to preview':'Upload original images, music, or film (up to 10 MB).'}</p></div>}</div><div><label>04 / Give it a name</label><input aria-label="Artwork title" maxLength={160} placeholder="Untitled, for now" value={draft.title} onChange={e=>update('title',e.target.value)}/><label>Artist’s statement <small>optional</small></label><textarea aria-label="Artist’s statement" maxLength={3000} placeholder="A little context, if you’d like." value={draft.statement} onChange={e=>update('statement',e.target.value)}/>{artist.displayName
  ? <label className="credit-option"><input type="checkbox" checked={showArtist} onChange={event => setShowArtist(event.target.checked)}/> Show my artist profile on this artwork</label>
  : <p className="muted">Artwork is anonymous by default. Set an artist profile in My work to add credit.</p>}
<p className="muted">Text drafts sync to your account. Uploads are saved when you publish.</p><button className="primary" disabled={!privateReady} onClick={()=>{if(!draft.title.trim()||!(draft.medium==='Writing'?draft.text.trim():media)||!parents.length||parents.length>8){message('Add a title, artwork, and one to eight inspirations first.');return}setReview(true)}}>Preview your artwork ↗</button>{review&&<div className="review"><h2>{draft.title}</h2><p className="poem">{draft.medium==='Writing'?draft.text:'Your uploaded artwork is ready.'}</p><p>{draft.statement}</p><p>{parents.length} inspiration{parents.length!==1?'s':''} · {draft.medium}</p><button className="primary" disabled={publishing} onClick={release}>{publishing?'Publishing…':'Publish artwork →'}</button></div>}</div></div></section>}
{detail&&<div className="modal" role="dialog" aria-modal="true" aria-label={detail.title} onKeyDown={e=>{if(e.key==='Escape')setDetail(null)}}><div className="detail-top"><button autoFocus className="back" onClick={()=>setDetail(null)}>← Back to {pageLabels[page]}</button><button aria-label="Close artwork" onClick={()=>setDetail(null)}>Close ×</button></div><div className="exhibition"><div className="artwork-stage">{artwork(detail)}</div><div className="artwork-info"><div className="eyebrow">{mediumLabel(detail.medium)}</div><h1>{detail.title}</h1><p>{detail.statement}</p>
{detail.artist ? <div className="artist-credit">
  <strong>By {detail.artist.displayName}</strong>
  {detail.artist.bio && <p>{detail.artist.bio}</p>}
  {socialFields.some(([key]) => detail.artist?.links?.[key]) && (
    <ul className="artist-links" aria-label="Artist social links">
      {socialFields.map(([key, label]) => {
        const href = detail.artist?.links?.[key];
        return href ? <li key={key}><a href={href} target="_blank" rel="noopener noreferrer">{label} ↗</a></li> : null;
      })}
    </ul>
  )}
</div> : detail.medium !== 'Spark' && <p className="muted">Anonymous artist</p>}
{detail.mine && <button className="credit-toggle" disabled={creditSaving || (!detail.showArtist && !artist.displayName)} onClick={() => changeCredit(detail)}>
  {detail.showArtist ? 'Hide artist profile' : artist.displayName ? 'Attach my artist profile' : 'Set an artist profile in My work'}
</button>}
<button className="primary" onClick={()=>begin(detail)}>Create something inspired by this →</button><div className="actions"><button onClick={()=>{select(detail);setDetail(null);setPage('The Effect');setAncestry(false);setFilter('All mediums');setSearch('')}}>Show on map</button><button onClick={()=>save(detail)}>{saved.includes(detail.id)?'✓ Saved':'Save privately'}</button></div></div></div><div className="detail-connections"><section><h2>What inspired this</h2><p>The starting points for this creation.</p>{detail.parents.length?detail.parents.map(id=>{const n=nodes.find(n=>n.id===id)!;return <button className="related" key={id} onClick={()=>setDetail(n)}><span>{n.title}<small>{mediumLabel(n.medium)}</small></span><span>↗</span></button>}):<p className="empty-state">This is a starting question. Its story begins here.</p>}</section><section><h2>What came next</h2><p>Artworks created in response to this one.</p>{nodes.filter(n=>n.parents.includes(detail.id)).map(n=><button className="related" key={n.id} onClick={()=>setDetail(n)}><span>{n.title}<small>{mediumLabel(n.medium)}</small></span><span>↗</span></button>)}{!nodes.some(n=>n.parents.includes(detail.id))&&<p className="empty-state">Nothing yet. Your interpretation could be next.</p>}</section></div></div>}{page==='The Effect'&&<FlyingButterfly logo={logoText} headline={flutterWord}/>}{notice&&<div className="toast" role="status">{notice}</div>}</>}
createRoot(document.getElementById('root')!).render(<App/>);
