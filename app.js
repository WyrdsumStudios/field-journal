(function(){
const KEY='field-record-v2';
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const key=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse=k=>{const[y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
const fmt=k=>parse(k).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
const uid=()=>`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const same= (a,b)=>String(a).toLowerCase()===String(b).toLowerCase();

function load(){
  try{
    const s=JSON.parse(localStorage.getItem(KEY));
    if(s&&Array.isArray(s.categories)){
      const state=Object.assign({categories:[],entries:[],dayTitles:{}},s);
      state.categories.forEach(c=>{if(!Array.isArray(c.tags))c.tags=[]});
      state.entries.forEach(e=>{if(!Array.isArray(e.tags))e.tags=[]});
      if(!state.dayTitles||typeof state.dayTitles!=='object')state.dayTitles={};
      return state;
    }
  }catch(e){}
  return{categories:[],entries:[],dayTitles:{}};
}
let state=load();
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
let sel=key(new Date()),view=parse(sel),addingCat=false;
let openCat=null,editingId=null,tagEdit=false,renamingTag=null,focusTitle=false;
let draft={title:'',note:'',tags:[]},pendingTag='';
let picker=false,pickerYear=view.getFullYear();
const expanded=new Set();

function h(tag,attrs,...kids){
  const e=document.createElement(tag);
  for(const k in attrs||{}){
    if(k.startsWith('on'))e.addEventListener(k.slice(2),attrs[k]);
    else if(k==='class')e.className=attrs[k];
    else if(k==='value')e.value=attrs[k];
    else if(k==='hidden')e.hidden=!!attrs[k];
    else e.setAttribute(k,attrs[k]);
  }
  kids.flat().forEach(c=>{if(c!=null&&c!==false)e.append(c)});
  return e;
}
function catById(id){return state.categories.find(c=>c.id===id)}
function currentCat(){return catById(openCat)}
function dayEntries(date,categoryId){
  return state.entries.filter(e=>e.date===date&&e.categoryId===categoryId).slice().sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
}
function readDraft(){
  const t=$('entryTitle');
  if(t){draft.title=t.value;draft.note=$('entryNote').value}
  const n=$('newTag');
  if(n)pendingTag=n.value;
}
function blankDraft(){draft={title:'',note:'',tags:[]};pendingTag='';editingId=null;tagEdit=false;renamingTag=null}
function select(k){sel=k;view=parse(k);picker=false;render()}
function shift(n){const d=parse(sel);d.setDate(d.getDate()+n);select(key(d))}
function openCategory(id){openCat=id;blankDraft();focusTitle=true;render()}
function closeCategory(){openCat=null;blankDraft();render()}
function editEntry(e){
  openCat=e.categoryId;
  editingId=e.id;
  draft={title:e.title||'',note:e.note||'',tags:[...(e.tags||[])]};
  pendingTag='';tagEdit=false;renamingTag=null;focusTitle=true;
  render();
}
function removeEntry(id){
  state.entries=state.entries.filter(e=>e.id!==id);
  if(editingId===id)blankDraft();
  save();render();
}
function deleteCategory(c){
  if(!confirm(`Delete category "${c.name}" and its entries?`))return;
  state.categories=state.categories.filter(x=>x!==c);
  state.entries=state.entries.filter(e=>e.categoryId!==c.id);
  if(openCat===c.id)openCat=null;
  save();render();
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
  if(!cat)return;
  if(name&&!cat.tags.some(t=>same(t,name)))cat.tags.push(name);
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
  const title=draft.title.trim(),note=draft.note.trim();
  if(!title&&!note)return;
  const tags=[...draft.tags];
  if(editingId){
    const e=state.entries.find(x=>x.id===editingId);
    if(e){e.title=title;e.note=note;e.tags=tags}
  }else{
    state.entries.push({id:uid(),categoryId:cat.id,date:sel,title,note,tags,createdAt:Date.now()});
  }
  blankDraft();save();render();
}
function tagLine(tags){
  return tags&&tags.length?h('p',{class:'accent sm tags-line'},tags.join(' · ')):null;
}
function entryCard(e){
  const editing=e.id===editingId;
  return h('article',{class:'entry-card'+(editing?' editing':''),'data-entry':e.id,onclick:ev=>{
    if(ev.target.closest('button'))return;
    editEntry(e);
  }},
    h('div',{class:'row top-row'},h('strong',null,e.title||'Untitled'),h('span',{class:'muted sm'},fmt(e.date))),
    e.note?h('p',{class:'note-text'},e.note):null,
    tagLine(e.tags),
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
  return h('span',{class:'chip'+(on&&!tagEdit?' on':'')+(tagEdit?' edit':''),'data-tag':tag,'data-on':on?'true':'false'},...kids);
}
function renderCatScreen(){
  const cat=currentCat();
  const root=$('catScreen');
  if(!cat){root.replaceChildren();return}
  const names=[...cat.tags];
  draft.tags.forEach(t=>{if(!names.some(n=>same(n,t)))names.push(t)});
  const list=dayEntries(sel,cat.id);
  const form=h('form',{class:'card',id:'entryForm',onsubmit:saveEntry},
    editingId?h('p',{class:'muted sm editing-flag'},'Editing entry'):null,
    h('label',{class:'lbl'},'Title',h('input',{id:'entryTitle',class:'field',value:draft.title,autocomplete:'off'})),
    h('label',{class:'lbl'},'Note',h('textarea',{id:'entryNote',class:'field note'},draft.note)),
    h('p',{class:'watch'},'Tags you are watching'),
    names.length?h('div',{class:'chips',id:'tagChips'},...names.map(chip)):h('p',{class:'muted sm'},'No tags yet.'),
    h('div',{class:'tag-row'},
      h('input',{id:'newTag',class:'field',value:pendingTag,placeholder:'New word, kept in this category','aria-label':'New word, kept in this category',autocomplete:'off',
        onkeydown:ev=>{if(ev.key==='Enter'){ev.preventDefault();addTag()}}}),
      h('button',{type:'button',class:'btn ghost',id:'addTag',onclick:addTag},'Add tag'),
      h('button',{type:'button',class:tagEdit?'btn':'btn ghost',id:'editTags','aria-pressed':tagEdit?'true':'false',onclick:()=>{
        readDraft();
        if(tagEdit){tagEdit=false;renamingTag=null}else tagEdit=true;
        render();
      }},tagEdit?'Done':'Edit')),
    h('div',{class:'actions'},
      h('button',{class:'btn',type:'submit',id:'saveEntry'},'Save entry'),
      editingId?h('button',{type:'button',class:'btn ghost',id:'cancelEdit',onclick:()=>{blankDraft();render()}},'Cancel'):null));
  // textarea value is a child text node; also set .value so it is the control's value
  root.replaceChildren(
    h('div',{class:'cat-top'},
      h('button',{type:'button',class:'back',id:'backBtn',onclick:closeCategory},'Back'),
      h('p',{class:'muted',id:'catDate'},fmt(sel))),
    h('h2',{class:'cat-heading',id:'catName'},cat.name),
    form,
    h('div',{class:'entry-list',id:'catEntries'},
      list.length?list.map(entryCard):h('p',{class:'muted',id:'catEmpty'},'Nothing written.')));
  const note=$('entryNote');
  if(note)note.value=draft.note;
  if(focusTitle){
    const el=$('entryTitle');
    if(el){el.focus();const n=el.value.length;if(el.setSelectionRange)el.setSelectionRange(n,n)}
    focusTitle=false;
  }
}
function catCard(c){
  const list=dayEntries(sel,c.id);
  return h('article',{class:'card cat-card','data-cat':c.id,tabindex:'0',onclick:ev=>{
    if(ev.target.closest('button'))return;
    openCategory(c.id);
  },onkeydown:ev=>{
    if(ev.target!==ev.currentTarget)return;
    if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();openCategory(c.id)}
  }},
    h('div',{class:'row'},h('h3',null,c.name),h('button',{class:'x',type:'button','aria-label':`Delete ${c.name}`,onclick:()=>deleteCategory(c)},'Delete')),
    list.length?list.map(e=>h('p',{class:'muted preview'},e.title||'Untitled')):h('p',{class:'muted'},'Nothing written for this day.'),
    h('p',{class:'accent sm open-hint'},'Open'));
}
function renderCats(){
  const root=$('categories');
  root.replaceChildren(...state.categories.map(catCard));
  if(addingCat){
    const inp=h('input',{class:'field',placeholder:'Sleep, body, people, practice…','aria-label':'Name this category'});
    const f=h('form',{class:'card',onsubmit:ev=>{
      ev.preventDefault();
      const n=inp.value.trim();
      if(!n)return;
      state.categories.push({id:uid(),name:n,tags:[]});
      addingCat=false;save();render();
    }},
      h('h3',null,'New category'),inp,
      h('div',{class:'row'},h('button',{class:'btn',type:'submit'},'Add category'),h('button',{class:'btn ghost',type:'button',onclick:()=>{addingCat=false;render()}},'Cancel')));
    root.append(f);
    setTimeout(()=>inp.focus(),0);
  }else{
    root.append(h('button',{class:'new-cat',type:'button',id:'newCat',onclick:()=>{addingCat=true;render()}},h('span',{class:'plus'},'+'),'New category'));
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
  if(screen)renderCatScreen();else $('catScreen').replaceChildren();
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
$('lookBtn').onclick=()=>alert('Themes ("Look") are not rebuilt yet.');
render();
})();
