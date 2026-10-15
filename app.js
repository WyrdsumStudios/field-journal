(function(){
const KEY='field-record-v2';
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const key=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse=k=>{const[y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
const fmt=k=>parse(k).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
const uid=()=>`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.categories)return Object.assign({categories:[],entries:[],dayTitles:{}},s)}catch(e){}return{categories:[],entries:[],dayTitles:{}}}
let state=load();const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
let sel=key(new Date()),view=parse(sel),addingCat=false;
function h(tag,attrs,...kids){const e=document.createElement(tag);for(const k in attrs||{}){if(k.startsWith('on'))e.addEventListener(k.slice(2),attrs[k]);else if(k==='class')e.className=attrs[k];else e.setAttribute(k,attrs[k])}kids.flat().forEach(c=>c!=null&&e.append(c));return e}
function select(k){sel=k;view=parse(k);render()}
function shift(n){const d=parse(sel);d.setDate(d.getDate()+n);select(key(d))}
function catCard(c){
  const list=state.entries.filter(e=>e.categoryId===c.id&&e.date===sel);
  const title=h('input',{class:'field',placeholder:'Title'}),note=h('textarea',{class:'field',placeholder:'Note'});
  const form=h('form',{onsubmit:ev=>{ev.preventDefault();if(!title.value.trim()&&!note.value.trim())return;
    state.entries.push({id:uid(),categoryId:c.id,date:sel,title:title.value.trim(),note:note.value.trim(),tags:[],createdAt:Date.now()});save();render()}},
    title,note,h('button',{class:'btn',type:'submit'},'Save entry'));
  return h('article',{class:'card'},
    h('div',{class:'row'},h('h3',null,c.name),h('button',{class:'x',onclick:()=>{if(confirm(`Delete category "${c.name}" and its entries?`)){state.categories=state.categories.filter(x=>x!==c);state.entries=state.entries.filter(e=>e.categoryId!==c.id);save();render()}}},'Delete')),
    list.length?list.map(e=>h('div',{class:'entry'},h('div',{class:'row'},h('strong',null,e.title||'Untitled'),h('button',{class:'x',onclick:()=>{state.entries=state.entries.filter(x=>x!==e);save();render()}},'Remove')),e.note?h('p',{class:'muted'},e.note):null))
      :h('p',{class:'muted'},'Nothing written for this day.'),form)}
function renderCats(){
  const root=$('categories');root.replaceChildren(...state.categories.map(catCard));
  if(addingCat){const inp=h('input',{class:'field',placeholder:'Sleep, body, people, practice…','aria-label':'Name this category'});
    const f=h('form',{class:'card',onsubmit:ev=>{ev.preventDefault();const n=inp.value.trim();if(!n)return;state.categories.push({id:uid(),name:n,tags:[]});addingCat=false;save();render()}},
      h('h3',null,'New category'),inp,h('div',{class:'row'},h('button',{class:'btn',type:'submit'},'Add category'),h('button',{class:'btn ghost',type:'button',onclick:()=>{addingCat=false;render()}},'Cancel')));
    root.append(f);setTimeout(()=>inp.focus())}
  else root.append(h('button',{class:'new-cat',type:'button',id:'newCat',onclick:()=>{addingCat=true;render()}},h('span',{class:'plus'},'+'),'New category'))}
function renderCal(){
  $('calDay').textContent=fmt(sel);$('calMonth').textContent=view.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const g=$('calGrid'),y=view.getFullYear(),m=view.getMonth(),first=new Date(y,m,1).getDay(),n=new Date(y,m+1,0).getDate(),today=key(new Date());
  const has=new Set([...state.entries.map(e=>e.date),...Object.keys(state.dayTitles)]);
  const cells=['S','M','T','W','T','F','S'].map(d=>h('div',{class:'dow'},d));
  for(let i=0;i<first;i++)cells.push(h('div'));
  for(let d=1;d<=n;d++){const k=`${y}-${pad(m+1)}-${pad(d)}`;cells.push(h('button',{type:'button','data-day':k,class:[k===sel&&'sel',has.has(k)&&'has',k===today&&'today'].filter(Boolean).join(' '),onclick:()=>select(k)},String(d)))}
  g.replaceChildren(...cells)}
function renderDays(){
  const ks=[...new Set([...Object.keys(state.dayTitles),...state.entries.map(e=>e.date)])].sort().reverse();
  $('daysEmpty').hidden=ks.length>0;
  $('daysList').replaceChildren(...ks.map(k=>{const c=state.entries.filter(e=>e.date===k).length;
    return h('button',{class:'day-item'+(k===sel?' sel':''),type:'button',onclick:()=>select(k)},h('div',null,state.dayTitles[k]||'New Day'),h('div',{class:'muted sm'},`${fmt(k)} · ${c} entr${c===1?'y':'ies'}`))}))}
function render(){
  $('dateLabel').textContent=fmt(sel);
  const t=$('dayTitle');if(document.activeElement!==t)t.value=state.dayTitles[sel]||'';
  renderCats();renderCal();renderDays()}
$('dayTitle').addEventListener('input',e=>{const v=e.target.value.trim();if(v)state.dayTitles[sel]=e.target.value;else delete state.dayTitles[sel];save();renderCal();renderDays()});
$('prevMonth').onclick=()=>{view=new Date(view.getFullYear(),view.getMonth()-1,1);renderCal()};
$('nextMonth').onclick=()=>{view=new Date(view.getFullYear(),view.getMonth()+1,1);renderCal()};
$('calMonth').onclick=()=>{view=parse(sel);renderCal()};
$('earlier').onclick=()=>shift(-1);$('later').onclick=()=>shift(1);$('today').onclick=()=>select(key(new Date()));
$('lookBtn').onclick=()=>alert('Themes ("Look") are not rebuilt yet.');
render();
})();
