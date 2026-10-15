(function(){
const KEY='field-record-v2';
const IMG_DB='field-record-images';
const IMG_STORE='blobs';
const MAX_EDGE=1600;
const IMAGE_ERROR="Couldn't save that image. Try a smaller one, or free some space in this browser.";
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const key=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse=k=>{const[y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
const fmt=k=>parse(k).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
const uid=()=>`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const same=(a,b)=>String(a).toLowerCase()===String(b).toLowerCase();

function dtLocal(d){
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function parseDt(s){
  if(!s||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s))return null;
  const [date,time]=s.split('T');
  const [y,m,d]=date.split('-').map(Number);
  const [hh,mm]=time.split(':').map(Number);
  return new Date(y,m-1,d,hh||0,mm||0,0,0);
}
function priorNight(dayKey){
  const wake=parse(dayKey);
  wake.setHours(7,0,0,0);
  const sleep=new Date(wake.getTime());
  sleep.setDate(sleep.getDate()-1);
  sleep.setHours(23,0,0,0);
  return {sleepStart:dtLocal(sleep),sleepEnd:dtLocal(wake)};
}
function minutesBetween(start,end){
  const a=parseDt(start),b=parseDt(end);
  if(!a||!b)return null;
  let mins=Math.round((b.getTime()-a.getTime())/60000);
  if(mins<0)mins+=24*60;
  return mins;
}
function formatDuration(mins){
  if(mins==null||!Number.isFinite(mins)||mins<0)return '';
  const h=Math.floor(mins/60),m=mins%60;
  if(h&&m)return `${h}h ${m}m`;
  if(h)return `${h}h`;
  return `${m}m`;
}
function fmtDt(s){
  const d=parseDt(s);
  if(!d)return '';
  return d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
}

const TYPES={
  notes:{
    id:'notes',
    label:'Notes',
    tagLabel:'Tags you are watching',
    blank(){return {title:'',note:'',tags:[],images:[]}},
    fromEntry(e){return {title:e.title||'',note:e.note||'',tags:[...(e.tags||[])],images:[...(e.images||[])]}},
    hasContent(d){return !!(d.title.trim()||(d.note||'').trim()||(d.images||[]).length)},
    write(entry,d){
      entry.title=d.title.trim();
      entry.note=(d.note||'').trim();
      entry.tags=[...d.tags];
      entry.images=[...(d.images||[])];
    },
    fields(d){
      return [
        h('label',{class:'lbl'},'Title',h('input',{id:'entryTitle',class:'field',value:d.title,autocomplete:'off'})),
        h('label',{class:'lbl'},'Note',h('textarea',{id:'entryNote',class:'field note'}))
      ];
    },
    tail(){return null},
    cardBits(e){
      return [e.note?h('p',{class:'note-text'},e.note):null,tagLine(e.tags),imageGrid(e.images)];
    }
  },
  sleep:{
    id:'sleep',
    label:'Sleep',
    tagLabel:'Quality',
    blank(day){
      const times=priorNight(day||sel);
      return {title:'',note:'',tags:[],images:[],dreams:'',sleepStart:times.sleepStart,sleepEnd:times.sleepEnd};
    },
    fromEntry(e){
      const times=priorNight(e.date||sel);
      return {
        title:e.title||'',
        note:e.note||'',
        tags:[...(e.tags||[])],
        images:[...(e.images||[])],
        dreams:e.dreams||'',
        sleepStart:e.sleepStart||times.sleepStart,
        sleepEnd:e.sleepEnd||times.sleepEnd
      };
    },
    hasContent(d){return !!(d.title.trim()||(d.note||'').trim()||(d.dreams||'').trim()||(d.tags||[]).length||(d.images||[]).length||(d.sleepStart&&d.sleepEnd))},
    write(entry,d){
      entry.title=d.title.trim();
      entry.note=(d.note||'').trim();
      entry.tags=[...d.tags];
      entry.images=[...(d.images||[])];
      entry.dreams=(d.dreams||'').trim();
      entry.sleepStart=d.sleepStart||'';
      entry.sleepEnd=d.sleepEnd||'';
    },
    fields(d){
      const dur=formatDuration(minutesBetween(d.sleepStart,d.sleepEnd));
      return [
        h('label',{class:'lbl'},'Title',h('input',{id:'entryTitle',class:'field',value:d.title,autocomplete:'off'})),
        h('div',{class:'sleep-times'},
          h('label',{class:'lbl'},'Sleep time',h('input',{id:'sleepStart',class:'field',type:'datetime-local',step:'60',value:d.sleepStart,autocomplete:'off',oninput:updateDuration})),
          h('label',{class:'lbl'},'Awake time',h('input',{id:'sleepEnd',class:'field',type:'datetime-local',step:'60',value:d.sleepEnd,autocomplete:'off',oninput:updateDuration}))),
        h('p',{class:'watch'},'Duration'),
        h('p',{class:'duration',id:'sleepDuration'},dur||'—')
      ];
    },
    tail(){
      return h('div',null,
        h('label',{class:'lbl'},'Dreams',h('textarea',{id:'entryDreams',class:'field dream'})),
        h('label',{class:'lbl'},'Notes',h('textarea',{id:'entryNote',class:'field dream'})));
    },
    cardBits(e){
      const dur=formatDuration(minutesBetween(e.sleepStart,e.sleepEnd));
      const times=[fmtDt(e.sleepStart),fmtDt(e.sleepEnd)].filter(Boolean).join(' – ');
      const line=[times,dur].filter(Boolean).join(' · ');
      const block=(label,text)=>text?h('div',{class:'labeled'},h('p',{class:'kicker'},label),h('p',{class:'note-text'},text)):null;
      return [
        line?h('p',{class:'sleep-line','data-duration':dur},line):null,
        block('Dreams',e.dreams),
        block('Notes',e.note),
        tagLine(e.tags),
        imageGrid(e.images)
      ];
    }
  }
};
function typeOf(cat){
  const id=cat&&TYPES[cat.type]?cat.type:'notes';
  return TYPES[id];
}

const LOOKS=[
  {id:'paper',name:'Paper',note:'Warm paper and a plain edge'},
  {id:'wood',name:'Wood',note:'Grain, parchment, carved frame'},
  {id:'vine',name:'Vine',note:'Leaves and a vine frame'},
  {id:'retro',name:'90s Retro',note:'Pixel sky and lime bevels'},
  {id:'earth',name:'Earth',note:'Starfield and a circuit frame'},
  {id:'water',name:'Water',note:'Watercolor and a ripple frame'}
];
const LOOK_IDS=new Set(LOOKS.map(l=>l.id));
const THEME_COLOR={paper:'#2f5d45',wood:'#7a4e2a',vine:'#1e6b38',retro:'#123d16',earth:'#07182c',water:'#1f7c84'};
function applyLook(id){
  const look=LOOK_IDS.has(id)?id:'paper';
  document.documentElement.dataset.look=look;
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute('content',THEME_COLOR[look]);
}
function load(){
  try{
    const s=JSON.parse(localStorage.getItem(KEY));
    if(s&&Array.isArray(s.categories)){
      const state=Object.assign({categories:[],entries:[],dayTitles:{},look:'paper'},s);
      state.categories.forEach(c=>{
        if(!Array.isArray(c.tags))c.tags=[];
        if(!c.type||!TYPES[c.type])c.type='notes';
      });
      state.entries.forEach(e=>{
        if(!Array.isArray(e.tags))e.tags=[];
        if(!Array.isArray(e.images))e.images=[];
      });
      if(!state.dayTitles||typeof state.dayTitles!=='object')state.dayTitles={};
      if(!LOOK_IDS.has(state.look))state.look='paper';
      return state;
    }
  }catch(e){}
  return {categories:[],entries:[],dayTitles:{},look:'paper'};
}
let state=load();
applyLook(state.look);
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
let sel=key(new Date()),view=parse(sel),addingCat=false,newType='notes';
let openCat=null,editingId=null,tagEdit=false,renamingTag=null,focusTitle=false;
let draft=TYPES.notes.blank(),pendingTag='',imageError='';
const sessionNew=new Set();
const expanded=new Set();
let picker=false,pickerYear=view.getFullYear(),lookOpen=false;
const urlCache=new Map();
let dbPromise=null;

function openDb(){
  if(!dbPromise){
    dbPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open(IMG_DB,1);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(IMG_STORE))db.createObjectStore(IMG_STORE);
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>{dbPromise=null;reject(req.error)};
    });
  }
  return dbPromise;
}
function idbReq(mode,run){
  return openDb().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(IMG_STORE,mode);
    const req=run(tx.objectStore(IMG_STORE));
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  }));
}
function putImage(id,blob){return idbReq('readwrite',s=>s.put(blob,id))}
function getImage(id){return idbReq('readonly',s=>s.get(id))}
function deleteImage(id){return idbReq('readwrite',s=>s.delete(id)).catch(()=>{})}
function revoke(id){
  const url=urlCache.get(id);
  if(url){URL.revokeObjectURL(url);urlCache.delete(id)}
}
function forgetImages(ids){ids.forEach(id=>{revoke(id);deleteImage(id)})}
async function urlFor(id){
  if(urlCache.has(id))return urlCache.get(id);
  const blob=await getImage(id);
  if(!blob)return '';
  const url=URL.createObjectURL(blob);
  urlCache.set(id,url);
  return url;
}
function blobFromCanvas(canvas){
  return new Promise((resolve,reject)=>{
    const jpeg=()=>canvas.toBlob(blob=>{
      if(blob&&blob.size)resolve(blob);
      else reject(new Error('encode'));
    },'image/jpeg',0.82);
    canvas.toBlob(webp=>{
      if(webp&&webp.size&&webp.type==='image/webp')resolve(webp);
      else jpeg();
    },'image/webp',0.82);
  });
}
async function compressImage(file){
  const bitmap=await createImageBitmap(file);
  try{
    const scale=Math.min(1,MAX_EDGE/Math.max(bitmap.width,bitmap.height));
    const w=Math.max(1,Math.round(bitmap.width*scale));
    const h=Math.max(1,Math.round(bitmap.height*scale));
    const canvas=document.createElement('canvas');
    canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('canvas');
    ctx.drawImage(bitmap,0,0,w,h);
    return await blobFromCanvas(canvas);
  }finally{
    if(bitmap.close)bitmap.close();
  }
}
function hydrateImages(root){
  if(!root)return;
  root.querySelectorAll('[data-src-id]').forEach(img=>{
    const id=img.getAttribute('data-src-id');
    urlFor(id).then(url=>{if(url&&img.isConnected)img.src=url}).catch(()=>{});
  });
}
function openLightbox(id){
  urlFor(id).then(url=>{
    if(!url)return;
    $('lightboxImg').src=url;
    $('lightbox').hidden=false;
  }).catch(()=>{imageError=IMAGE_ERROR;render()});
}
function closeLightbox(){
  $('lightbox').hidden=true;
  $('lightboxImg').removeAttribute('src');
}

function h(tag,attrs,...kids){
  const e=document.createElement(tag);
  for(const k in attrs||{}){
    if(k.startsWith('on')&&typeof attrs[k]==='function')e.addEventListener(k.slice(2),attrs[k]);
    else if(k==='class')e.className=attrs[k];
    else if(k==='value')e.value=attrs[k];
    else if(k==='hidden')e.hidden=!!attrs[k];
    else if(attrs[k]===true)e.setAttribute(k,'');
    else if(attrs[k]!==false&&attrs[k]!=null)e.setAttribute(k,attrs[k]);
  }
  kids.flat().forEach(c=>{if(c!=null&&c!==false)e.append(c)});
  return e;
}
function catById(id){return state.categories.find(c=>c.id===id)}
function currentCat(){return catById(openCat)}
function dayEntries(date,categoryId){
  return state.entries.filter(e=>e.date===date&&e.categoryId===categoryId).slice().sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
}
function freshDraft(cat){
  draft=typeOf(cat).blank(sel);
  pendingTag='';
  imageError='';
}
function abandonNewImages(){
  const ids=[...sessionNew];
  sessionNew.clear();
  forgetImages(ids);
}
function readDraft(){
  const t=$('entryTitle');
  if(t)draft.title=t.value;
  const note=$('entryNote');
  if(note)draft.note=note.value;
  const dreams=$('entryDreams');
  if(dreams)draft.dreams=dreams.value;
  const ss=$('sleepStart');
  if(ss)draft.sleepStart=ss.value;
  const se=$('sleepEnd');
  if(se)draft.sleepEnd=se.value;
  const n=$('newTag');
  if(n)pendingTag=n.value;
}
function fillAreas(){
  const note=$('entryNote');
  if(note)note.value=draft.note||'';
  const dreams=$('entryDreams');
  if(dreams)dreams.value=draft.dreams||'';
}
function updateDuration(){
  const s=$('sleepStart'),e=$('sleepEnd'),out=$('sleepDuration');
  if(!s||!e||!out)return;
  draft.sleepStart=s.value;
  draft.sleepEnd=e.value;
  out.textContent=formatDuration(minutesBetween(s.value,e.value))||'—';
}
function select(k){sel=k;view=parse(k);picker=false;render()}
function shift(n){const d=parse(sel);d.setDate(d.getDate()+n);select(key(d))}
function openCategory(id){
  abandonNewImages();
  openCat=id;
  editingId=null;
  tagEdit=false;
  renamingTag=null;
  focusTitle=true;
  freshDraft(catById(id));
  render();
}
function closeCategory(){
  abandonNewImages();
  openCat=null;
  editingId=null;
  tagEdit=false;
  renamingTag=null;
  freshDraft(null);
  render();
}
function editEntry(e){
  abandonNewImages();
  openCat=e.categoryId;
  editingId=e.id;
  draft=typeOf(catById(e.categoryId)).fromEntry(e);
  pendingTag='';
  tagEdit=false;
  renamingTag=null;
  focusTitle=true;
  imageError='';
  render();
}
function removeEntry(id){
  const e=state.entries.find(x=>x.id===id);
  const ids=[...(e&&e.images||[])];
  state.entries=state.entries.filter(x=>x.id!==id);
  if(editingId===id){
    ids.push(...sessionNew);
    sessionNew.clear();
    editingId=null;
    tagEdit=false;
    renamingTag=null;
    freshDraft(currentCat());
  }
  save();
  forgetImages(ids);
  render();
}
function deleteCategory(c){
  if(!confirm(`Delete category "${c.name}" and its entries?`))return;
  const ids=state.entries.filter(e=>e.categoryId===c.id).flatMap(e=>e.images||[]);
  if(openCat===c.id){ids.push(...sessionNew);sessionNew.clear();openCat=null;editingId=null}
  state.categories=state.categories.filter(x=>x!==c);
  state.entries=state.entries.filter(e=>e.categoryId!==c.id);
  save();
  forgetImages(ids);
  render();
}
function toggleTag(name){
  readDraft();
  const i=draft.tags.findIndex(t=>same(t,name));
  if(i>=0)draft.tags.splice(i,1);else draft.tags.push(name);
  render();
}
function addTag(){
  readDraft();
  const name=pendingTag.trim();
  pendingTag='';
  const cat=currentCat();
  if(!cat||!name)return;
  if(!cat.tags.some(t=>same(t,name)))cat.tags.push(name);
  const canonical=cat.tags.find(t=>same(t,name));
  if(canonical&&!draft.tags.some(t=>same(t,canonical)))draft.tags.push(canonical);
  save();render();
}
function deleteTag(name){
  readDraft();
  const cat=currentCat();
  if(!cat)return;
  cat.tags=cat.tags.filter(t=>!same(t,name));
  state.entries.forEach(e=>{if(e.categoryId===cat.id)e.tags=(e.tags||[]).filter(t=>!same(t,name))});
  draft.tags=draft.tags.filter(t=>!same(t,name));
  if(renamingTag&&same(renamingTag,name))renamingTag=null;
  save();render();
}
function commitRename(oldName,raw){
  if(!renamingTag||!same(renamingTag,oldName))return;
  renamingTag=null;
  const name=String(raw||'').trim();
  const cat=currentCat();
  if(!cat||!name||name===oldName){render();return}
  const clash=cat.tags.find(t=>same(t,name)&&!same(t,oldName));
  const next=clash||name;
  const idx=cat.tags.findIndex(t=>same(t,oldName));
  if(clash)cat.tags=cat.tags.filter(t=>!same(t,oldName));
  else if(idx>=0)cat.tags[idx]=next;
  else cat.tags.push(next);
  const rewrite=list=>[...new Set((list||[]).map(t=>same(t,oldName)?next:t))];
  state.entries.forEach(e=>{if(e.categoryId===cat.id)e.tags=rewrite(e.tags)});
  draft.tags=rewrite(draft.tags);
  save();render();
}
function saveEntry(ev){
  if(ev)ev.preventDefault();
  readDraft();
  const cat=currentCat();
  if(!cat)return;
  const type=typeOf(cat);
  if(!type.hasContent(draft))return;
  const prev=editingId?[...((state.entries.find(x=>x.id===editingId)||{}).images||[])]:[];
  let entry;
  if(editingId){
    entry=state.entries.find(x=>x.id===editingId);
    if(!entry)return;
  }else{
    entry={id:uid(),categoryId:cat.id,date:sel,createdAt:Date.now(),tags:[],images:[]};
    state.entries.push(entry);
  }
  type.write(entry,draft);
  const keep=new Set(entry.images||[]);
  const dropped=prev.filter(id=>!keep.has(id));
  sessionNew.clear();
  editingId=null;
  tagEdit=false;
  renamingTag=null;
  save();
  forgetImages(dropped);
  freshDraft(cat);
  render();
}
function tagLine(tags){
  return tags&&tags.length?h('p',{class:'accent sm tags-line'},tags.join(' · ')):null;
}
function thumb(id,removable){
  const img=h('img',{alt:'Attached image','data-src-id':id});
  const open=h('button',{type:'button',class:'thumb-open','data-image':id,onclick:ev=>{
    ev.stopPropagation();
    openLightbox(id);
  }},img);
  const kids=[open];
  if(removable)kids.push(h('button',{type:'button',class:'thumb-x','aria-label':'Remove image',onclick:ev=>{
    ev.stopPropagation();
    removeDraftImage(id);
  }},'×'));
  return h('div',{class:'thumb'},...kids);
}
function imageGrid(ids){
  if(!ids||!ids.length)return null;
  return h('div',{class:'thumbs'},...ids.map(id=>thumb(id,false)));
}
function removeDraftImage(id){
  readDraft();
  draft.images=(draft.images||[]).filter(x=>x!==id);
  if(sessionNew.has(id)){sessionNew.delete(id);revoke(id);deleteImage(id)}
  render();
}
async function onFiles(ev){
  const input=ev.target;
  const files=[...input.files];
  input.value='';
  if(!files.length)return;
  readDraft();
  const catId=openCat;
  let failed=false;
  for(const file of files){
    if(openCat!==catId)return;
    try{
      const blob=await compressImage(file);
      const id=uid();
      await putImage(id,blob);
      if(openCat!==catId){deleteImage(id);return}
      draft.images=draft.images||[];
      draft.images.push(id);
      sessionNew.add(id);
    }catch(err){
      failed=true;
    }
  }
  imageError=failed?IMAGE_ERROR:'';
  if(openCat===catId)render();
}
function imageSection(){
  const file=h('input',{id:'imageInput',class:'file-input',type:'file',accept:'image/*','aria-label':'Add images'});
  file.multiple=true;
  file.addEventListener('change',onFiles);
  return h('div',{class:'images-block'},
    h('div',{class:'actions'},
      h('button',{type:'button',class:'btn ghost',id:'addImagesBtn',onclick:()=>file.click()},'Add images'),
      file),
    imageError?h('p',{class:'warn',id:'imageError',role:'alert'},imageError):null,
    draft.images&&draft.images.length?h('div',{class:'thumbs',id:'draftThumbs'},...draft.images.map(id=>thumb(id,true))):null);
}
function entryCard(e){
  const type=typeOf(catById(e.categoryId));
  const editing=e.id===editingId;
  return h('article',{class:'entry-card'+(editing?' editing':''),'data-entry':e.id,onclick:ev=>{
    if(ev.target.closest('button'))return;
    editEntry(e);
  }},
    h('div',{class:'row top-row'},h('strong',null,e.title||'Untitled'),h('span',{class:'muted sm'},fmt(e.date))),
    ...type.cardBits(e),
    h('div',{class:'entry-actions'},
      h('button',{type:'button',onclick:ev=>{ev.stopPropagation();editEntry(e)}},'Edit'),
      h('button',{type:'button',onclick:ev=>{ev.stopPropagation();removeEntry(e.id)}},'Delete')));
}
function chip(tag){
  const on=draft.tags.some(t=>same(t,tag));
  if(tagEdit&&renamingTag&&same(renamingTag,tag)){
    const inp=h('input',{class:'chip-input','aria-label':`Rename ${tag}`,value:tag,
      onkeydown:ev=>{
        if(ev.key==='Enter'){ev.preventDefault();commitRename(tag,ev.target.value)}
        if(ev.key==='Escape'){renamingTag=null;render()}
      },
      onblur:ev=>commitRename(tag,ev.target.value)});
    setTimeout(()=>{inp.focus();inp.select()},0);
    return h('span',{class:'chip editing','data-tag':tag},inp);
  }
  const text=h('button',{type:'button',class:'chip-text',onclick:()=>{
    if(tagEdit){readDraft();renamingTag=tag;render()}
    else toggleTag(tag);
  }},tag);
  const kids=[text];
  if(tagEdit)kids.push(h('button',{type:'button',class:'chip-x','aria-label':`Delete tag ${tag}`,onclick:ev=>{ev.stopPropagation();deleteTag(tag)}},'×'));
  return h('span',{class:'chip'+(on?' on':'')+(tagEdit?' edit':''),'data-tag':tag,'data-on':on?'true':'false'},...kids);
}
function renderCatScreen(){
  const cat=currentCat();
  const root=$('catScreen');
  if(!cat){root.replaceChildren();root.removeAttribute('data-type');return}
  const type=typeOf(cat);
  root.dataset.type=type.id;
  const names=[...cat.tags];
  draft.tags.forEach(t=>{if(!names.some(n=>same(n,t)))names.push(t)});
  const list=dayEntries(sel,cat.id);
  const form=h('form',{class:'card',id:'entryForm',onsubmit:saveEntry},
    editingId?h('p',{class:'muted sm editing-flag'},'Editing entry'):null,
    ...type.fields(draft),
    h('p',{class:'watch',id:'tagLabel'},type.tagLabel),
    names.length?h('div',{class:'chips',id:'tagChips'},...names.map(chip)):h('p',{class:'muted sm',id:'noTags'},'No tags yet.'),
    h('div',{class:'tag-row'},
      h('input',{id:'newTag',class:'field',value:pendingTag,placeholder:'New word, kept in this category','aria-label':'New word, kept in this category',autocomplete:'off',
        onkeydown:ev=>{if(ev.key==='Enter'){ev.preventDefault();addTag()}}}),
      h('button',{type:'button',class:'btn ghost',id:'addTag',onclick:addTag},'Add tag'),
      h('button',{type:'button',class:tagEdit?'btn':'btn ghost',id:'editTags','aria-pressed':tagEdit?'true':'false',onclick:()=>{
        readDraft();
        if(tagEdit){tagEdit=false;renamingTag=null}else tagEdit=true;
        render();
      }},tagEdit?'Done':'Edit')),
    type.tail(draft),
    imageSection(),
    h('div',{class:'actions'},
      h('button',{class:'btn',type:'submit',id:'saveEntry'},'Save entry'),
      editingId?h('button',{type:'button',class:'btn ghost',id:'cancelEdit',onclick:()=>{
        abandonNewImages();
        editingId=null;
        tagEdit=false;
        renamingTag=null;
        freshDraft(cat);
        render();
      }},'Cancel'):null));
  root.replaceChildren(
    h('div',{class:'cat-top'},
      h('button',{type:'button',class:'back',id:'backBtn',onclick:closeCategory},'Back'),
      h('div',{class:'cat-tools'},
        h('button',{type:'button',class:'pill',id:'catLook',onclick:openLook},'Look'),
        h('p',{class:'muted',id:'catDate'},fmt(sel)))),
    h('h2',{class:'cat-heading',id:'catName'},cat.name),
    form,
    h('div',{class:'entry-list',id:'catEntries'},
      list.length?list.map(entryCard):h('p',{class:'muted',id:'catEmpty'},'Nothing written.')));
  fillAreas();
  if(focusTitle){
    const el=$('entryTitle');
    if(el){el.focus();const n=el.value.length;if(el.setSelectionRange)el.setSelectionRange(n,n)}
    focusTitle=false;
  }
}
function catCard(c){
  const list=dayEntries(sel,c.id);
  const type=typeOf(c);
  return h('article',{class:'card cat-card','data-cat':c.id,'data-type':type.id,tabindex:'0',onclick:ev=>{
    if(ev.target.closest('button'))return;
    openCategory(c.id);
  },onkeydown:ev=>{
    if(ev.target!==ev.currentTarget)return;
    if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();openCategory(c.id)}
  }},
    h('div',{class:'row'},h('h3',null,c.name),h('button',{class:'x',type:'button','aria-label':`Delete ${c.name}`,onclick:()=>deleteCategory(c)},'Delete')),
    type.id==='notes'?null:h('p',{class:'muted sm'},type.label),
    list.length?list.map(e=>h('p',{class:'muted preview'},e.title||formatDuration(minutesBetween(e.sleepStart,e.sleepEnd))||'Untitled')):h('p',{class:'muted'},'Nothing written for this day.'),
    h('p',{class:'accent sm open-hint'},'Open'));
}
function renderCats(){
  const root=$('categories');
  root.replaceChildren(...state.categories.map(catCard));
  if(addingCat){
    const inp=h('input',{class:'field',placeholder:'Sleep, body, people, practice…','aria-label':'Name this category'});
    const f=h('form',{class:'card',id:'newCatForm',onsubmit:ev=>{
      ev.preventDefault();
      const n=inp.value.trim();
      if(!n)return;
      const type=TYPES[newType]?newType:'notes';
      state.categories.push({id:uid(),name:n,tags:[],type});
      addingCat=false;
      newType='notes';
      save();render();
    }},
      h('h3',null,'New category'),inp,
      h('p',{class:'watch'},'Type'),
      h('div',{class:'type-row',id:'typePicker'},...Object.values(TYPES).map(t=>
        h('button',{type:'button',class:'type-opt'+(newType===t.id?' on':''),'data-type':t.id,'aria-pressed':newType===t.id?'true':'false',onclick:()=>{
          newType=t.id;
          document.querySelectorAll('#typePicker .type-opt').forEach(b=>{
            const on=b.getAttribute('data-type')===t.id;
            b.classList.toggle('on',on);
            b.setAttribute('aria-pressed',on?'true':'false');
          });
        }},t.label))),
      h('div',{class:'row'},h('button',{class:'btn',type:'submit'},'Add category'),h('button',{class:'btn ghost',type:'button',onclick:()=>{addingCat=false;newType='notes';render()}},'Cancel')));
    root.append(f);
    setTimeout(()=>inp.focus(),0);
  }else{
    root.append(h('button',{class:'new-cat',type:'button',id:'newCat',onclick:()=>{addingCat=true;newType='notes';render()}},h('span',{class:'plus'},'+'),'New category'));
  }
}
function renderCal(){
  $('calDay').textContent=fmt(sel);
  const monthBtn=$('calMonth');
  monthBtn.textContent=view.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  monthBtn.setAttribute('aria-expanded',picker?'true':'false');
  const box=$('monthPicker');
  box.hidden=!picker;
  $('calGrid').hidden=picker;
  if(picker){
    const y=pickerYear;
    box.replaceChildren(
      h('div',{class:'picker-year'},
        h('button',{type:'button',class:'circle','aria-label':'Previous year',onclick:()=>{pickerYear=Math.max(1,pickerYear-1);renderCal()}},'‹'),
        h('input',{class:'year-input',type:'number',inputmode:'numeric','aria-label':'Year',value:String(y),min:'1',max:'9999',
          onchange:ev=>{
            const n=Number(ev.target.value);
            if(Number.isInteger(n)&&n>=1&&n<=9999)pickerYear=n;
            renderCal();
          }}),
        h('button',{type:'button',class:'circle','aria-label':'Next year',onclick:()=>{pickerYear=Math.min(9999,pickerYear+1);renderCal()}},'›')),
      h('div',{class:'month-grid',role:'listbox','aria-label':'Choose a month'},...MONTHS.map((name,i)=>
        h('button',{type:'button',class:view.getFullYear()===y&&view.getMonth()===i?'month sel':'month','data-month':String(i),onclick:()=>{
          view=new Date(y,i,1);picker=false;renderCal();
        }},name))));
  }else box.replaceChildren();
  const g=$('calGrid'),y=view.getFullYear(),m=view.getMonth(),first=new Date(y,m,1).getDay(),n=new Date(y,m+1,0).getDate(),today=key(new Date());
  const has=new Set([...state.entries.map(e=>e.date),...Object.keys(state.dayTitles)]);
  const cells=['S','M','T','W','T','F','S'].map(d=>h('div',{class:'dow'},d));
  for(let i=0;i<first;i++)cells.push(h('div'));
  for(let d=1;d<=n;d++){
    const k=`${y}-${pad(m+1)}-${pad(d)}`;
    cells.push(h('button',{type:'button','data-day':k,class:[k===sel&&'sel',has.has(k)&&'has',k===today&&'today'].filter(Boolean).join(' '),onclick:()=>select(k)},String(d)));
  }
  g.replaceChildren(...cells);
}
function toggleDay(k){if(expanded.has(k))expanded.delete(k);else expanded.add(k);render()}
function renderDays(){
  const ks=[...new Set([...Object.keys(state.dayTitles),...state.entries.map(e=>e.date)])].sort().reverse();
  $('daysEmpty').hidden=ks.length>0;
  $('daysList').replaceChildren(...ks.map(k=>{
    const count=state.entries.filter(e=>e.date===k).length;
    const open=expanded.has(k);
    const known=new Set(state.categories.map(c=>c.id));
    const groups=state.categories.map(c=>({name:c.name,entries:dayEntries(k,c.id)}));
    const orphans=state.entries.filter(e=>e.date===k&&!known.has(e.categoryId));
    if(orphans.length)groups.push({name:'Other',entries:orphans.slice().sort((a,b)=>(a.createdAt||0)-(b.createdAt||0))});
    const head=h('div',{class:'day-item',role:'button',tabindex:'0','aria-expanded':open?'true':'false',onclick:ev=>{
      if(ev.target.closest('button'))return;
      toggleDay(k);
    },onkeydown:ev=>{
      if(ev.target!==ev.currentTarget)return;
      if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();toggleDay(k)}
    }},
      h('div',{class:'row top-row'},
        h('div',null,state.dayTitles[k]||'New Day'),
        h('span',{class:'muted sm'},fmt(k))),
      h('div',{class:'row'},
        h('div',{class:'muted sm'},`${count} entr${count===1?'y':'ies'}`),
        h('button',{type:'button',class:'open-day',onclick:ev=>{ev.stopPropagation();select(k)}},'Open day')));
    const body=open?h('div',{class:'day-body'},
      groups.length?groups.map(g=>h('div',{class:'day-cat','data-cat-name':g.name},
        h('h3',{class:'day-cat-name'},g.name),
        g.entries.length?g.entries.map(entryCard):h('p',{class:'muted nothing'},'Nothing written.'))):h('p',{class:'muted'},'No categories yet.')):null;
    return h('div',{class:'day-block'+(k===sel?' sel':''),'data-day':k},head,body);
  }));
}
function render(){
  if(openCat&&!currentCat())openCat=null;
  const screen=!!openCat;
  $('top').hidden=screen;
  $('home').hidden=screen;
  $('catScreen').hidden=!screen;
  $('dateLabel').textContent=fmt(sel);
  const t=$('dayTitle');
  if(t&&document.activeElement!==t)t.value=state.dayTitles[sel]||'';
  renderCats();renderCal();renderDays();
  if(screen)renderCatScreen();else{$('catScreen').replaceChildren();$('catScreen').removeAttribute('data-type')}
  hydrateImages(document);
}
$('dayTitle').addEventListener('input',e=>{
  const v=e.target.value.trim();
  if(v)state.dayTitles[sel]=e.target.value;else delete state.dayTitles[sel];
  save();renderCal();renderDays();
});
$('prevMonth').onclick=()=>{view=new Date(view.getFullYear(),view.getMonth()-1,1);picker=false;renderCal()};
$('nextMonth').onclick=()=>{view=new Date(view.getFullYear(),view.getMonth()+1,1);picker=false;renderCal()};
$('calMonth').onclick=()=>{picker=!picker;if(picker)pickerYear=view.getFullYear();renderCal()};
$('earlier').onclick=()=>shift(-1);
$('later').onclick=()=>shift(1);
$('today').onclick=()=>select(key(new Date()));
function renderLook(){
  const modal=$('lookModal');
  if(!modal)return;
  modal.hidden=!lookOpen;
  $('lookBtn').setAttribute('aria-expanded',lookOpen?'true':'false');
  if(!lookOpen)return;
  $('lookList').replaceChildren(...LOOKS.map(l=>h('button',{
    type:'button',
    class:'look-opt'+(state.look===l.id?' on':''),
    'data-look':l.id,
    'aria-pressed':state.look===l.id?'true':'false',
    onclick:()=>chooseLook(l.id)
  },
    h('span',{class:'swatch '+l.id,role:'presentation'}),
    h('span',{class:'look-name'},l.name),
    h('span',{class:'muted sm look-note'},l.note))));
}
function openLook(){
  lookOpen=true;
  renderLook();
  const b=$('lookClose');
  if(b)b.focus();
}
function closeLook(){lookOpen=false;renderLook()}
function chooseLook(id){
  if(!LOOK_IDS.has(id))return;
  state.look=id;
  save();
  applyLook(id);
  renderLook();
}
$('lookBtn').onclick=openLook;
$('lookClose').onclick=closeLook;
$('lookModal').addEventListener('click',ev=>{if(ev.target.id==='lookModal')closeLook()});
$('lightbox').addEventListener('click',ev=>{
  if(ev.target.id==='lightbox'||ev.target.id==='lightboxClose')closeLightbox();
});
document.addEventListener('keydown',ev=>{
  if(ev.key!=='Escape')return;
  if(lookOpen){closeLook();return}
  if(!$('lightbox').hidden)closeLightbox();
});
render();
})();
