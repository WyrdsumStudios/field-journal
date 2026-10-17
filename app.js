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
function entryStart(e){return (e&&(e.timerStart||e.sleepStart))||''}
function entryEnd(e){return (e&&(e.timerEnd||e.sleepEnd))||''}
function newSection(name,text,title){
  return {id:uid(),name:typeof name==='string'?name:'',title:typeof title==='string'?title:'',text:typeof text==='string'?text:'',tags:[]};
}
function tagList(list){
  return (Array.isArray(list)?list:[]).filter(t=>typeof t==='string');
}
function sectionsFromNames(names){
  const list=Array.isArray(names)?names:['Notes'];
  return list.map(n=>newSection(String(n),''));
}
function sectionsFromLegacy(e,includeEmptyDreams){
  const dreams=typeof e.dreams==='string'?e.dreams.trim():'';
  const note=typeof e.note==='string'?e.note.trim():'';
  const sections=[];
  if(dreams||includeEmptyDreams)sections.push(newSection('Dreams',dreams));
  sections.push(newSection('Notes',note));
  return sections;
}
function sectionText(sections,name){
  const s=(sections||[]).find(x=>String(x.name||'').trim().toLowerCase()===name);
  return s?String(s.text||'').trim():'';
}
function normalizeSections(list){
  return (Array.isArray(list)?list:[]).filter(s=>s&&typeof s==='object').map(s=>({
    id:typeof s.id==='string'&&s.id?s.id:uid(),
    name:typeof s.name==='string'?s.name:'',
    title:typeof s.title==='string'?s.title:'',
    text:typeof s.text==='string'?s.text:'',
    tags:tagList(s.tags)
  }));
}
function sectionBlocks(list){
  return (list||[]).filter(s=>(s.text||'').trim()||(s.title||'').trim()||tagList(s.tags).length).map(s=>{
    const name=(s.name||'').trim()||'Section';
    const title=(s.title||'').trim();
    const text=(s.text||'').trim();
    const tags=tagList(s.tags);
    return h('div',{class:'labeled'},
      h('p',{class:'kicker section-kicker','data-section-name':name},name),
      title?h('p',{class:'section-heading','data-section-title':title},title):null,
      tags.length?h('p',{class:'accent sm tags-line section-tags-line'},tags.join(' · ')):null,
      text?h('p',{class:'note-text'},text):null);
  });
}
function entryMinutes(e){
  if(!e)return null;
  const between=minutesBetween(entryStart(e),entryEnd(e));
  if(between!=null)return between;
  if(Number.isFinite(e.durationMinutes))return e.durationMinutes;
  return null;
}
function fmtDt(s){
  const d=parseDt(s);
  if(!d)return '';
  return d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
}

const FLOW_IDS=['spotting','light','medium','heavy'];
const FLOW_LABEL={spotting:'Spotting',light:'Light',medium:'Medium',heavy:'Heavy'};
const PERIOD_SHADES={spotting:'#c9ddd2',light:'#8fb39a',medium:'#5d8a72',heavy:'#2f5d45'};
const FLOW_SHAPES=['dot','square','diamond','triangle','heart','star','ring','drop'];
const FLOW_PALETTE=['#c4a484','#e09a8a','#d98b6c','#e0c36a','#8fbf8a','#6aa8a0','#7ea0c4','#8d7eb8','#c48baf','#d07070'];
const TRACK_KINDS=[{id:'shifts',label:'Work shifts'},{id:'flow',label:'Flow'}];
const CONDITIONS=[
  {id:'sunny',label:'Sunny',icon:'☀️'},
  {id:'cloudy',label:'Cloudy',icon:'☁️'},
  {id:'rain',label:'Rain',icon:'🌧️'},
  {id:'snow',label:'Snow',icon:'❄️'},
  {id:'storm',label:'Storm',icon:'⛈️'},
  {id:'wind',label:'Wind',icon:'💨'},
  {id:'fog',label:'Fog',icon:'🌫️'}
];
const WX_KEY='field-record-weather';
const FORECAST_MS=30*60*1000;
const ARCHIVE_MS=12*60*60*1000;
const WX_RETRY_MS=60*1000;
let placeQuery='',placeResults=[],placeStatus='',placeEditing=false,placeSeq=0,tempTouched=false;
const wxBusy=new Set();
const wxFail=Object.create(null);
function conditionById(id){return CONDITIONS.find(c=>c.id===id)||null}
function wmoInfo(code){
  const c=Number(code);
  if(c===0)return {icon:'☀️',label:'Clear'};
  if(c===1)return {icon:'🌤️',label:'Mainly clear'};
  if(c===2)return {icon:'⛅',label:'Partly cloudy'};
  if(c===3)return {icon:'☁️',label:'Cloudy'};
  if(c===45||c===48)return {icon:'🌫️',label:'Fog'};
  if((c>=51&&c<=67)||(c>=80&&c<=82))return {icon:'🌧️',label:'Rain'};
  if((c>=71&&c<=77)||c===85||c===86)return {icon:'❄️',label:'Snow'};
  if(c>=95)return {icon:'⛈️',label:'Thunderstorm'};
  return {icon:'🌡️',label:'Weather'};
}
function normalizePlace(p){
  if(!p||typeof p!=='object')return null;
  const latitude=Number(p.latitude),longitude=Number(p.longitude);
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return null;
  if(latitude<-90||latitude>90||longitude<-180||longitude>180)return null;
  const name=String(p.name||'My location').trim().slice(0,80)||'My location';
  return {name,admin1:String(p.admin1||'').slice(0,80),country:String(p.country||'').slice(0,80),latitude,longitude};
}
function placeLabel(p){
  if(!p)return '';
  const bits=[p.name];
  if(p.admin1)bits.push(p.admin1);
  else if(p.country)bits.push(p.country);
  return bits.filter(Boolean).join(', ');
}
function placeKey(p){return `${Number(p.latitude).toFixed(2)},${Number(p.longitude).toFixed(2)}`}
function loadWx(){
  try{const s=JSON.parse(localStorage.getItem(WX_KEY));if(s&&typeof s==='object'&&!Array.isArray(s))return s}catch(e){}
  return {};
}
function saveWx(all){try{localStorage.setItem(WX_KEY,JSON.stringify(all))}catch(e){}}
function wxBag(p){return p?loadWx()[placeKey(p)]||null:null}
function dayShift(dateKey){
  const a=parse(dateKey),b=parse(key(new Date()));
  return Math.round((a.getTime()-b.getTime())/86400000);
}
function formatTemp(n){
  const v=Number(n);
  if(!Number.isFinite(v))return '';
  const r=Math.round(v*10)/10;
  return (Number.isInteger(r)?String(r):r.toFixed(1))+'°';
}
function formatPrecip(n){
  const v=Number(n);
  if(!Number.isFinite(v))return '';
  const r=Math.round(v*10)/10;
  return (Number.isInteger(r)?String(r):r.toFixed(1))+' mm';
}
function dailyRow(data,date){
  const d=data&&data.daily;
  if(!d||!Array.isArray(d.time))return null;
  const i=d.time.indexOf(date);
  if(i<0)return null;
  const num=list=>{const v=list&&list[i];return v==null||v===''||!Number.isFinite(Number(v))?null:Number(v)};
  const code=num(d.weather_code),max=num(d.temperature_2m_max),min=num(d.temperature_2m_min),precip=num(d.precipitation_sum);
  if(code==null&&max==null&&min==null)return null;
  return {code,max,min,precip};
}
function fetchJson(url){
  const ctrl=typeof AbortController==='function'?new AbortController():null;
  const timer=ctrl?setTimeout(()=>ctrl.abort(),12000):null;
  return fetch(url,ctrl?{signal:ctrl.signal}:undefined).then(r=>{
    if(!r.ok)throw new Error(String(r.status));
    return r.json();
  }).finally(()=>{if(timer)clearTimeout(timer)});
}
function storeForecast(place,data){
  const all=loadWx();
  const pk=placeKey(place);
  const prev=all[pk]||{};
  const forecast={};
  const times=data.daily&&data.daily.time||[];
  times.forEach(date=>{const row=dailyRow(data,date);if(row)forecast[date]=row});
  const cur=data.current||{};
  all[pk]=Object.assign({},prev,{
    forecastAt:Date.now(),
    current:{
      temp:cur.temperature_2m==null||!Number.isFinite(Number(cur.temperature_2m))?null:Number(cur.temperature_2m),
      code:cur.weather_code==null||!Number.isFinite(Number(cur.weather_code))?null:Number(cur.weather_code)
    },
    forecast,
    archive:prev.archive||{}
  });
  saveWx(all);
}
function storeArchive(place,date,row){
  const all=loadWx();
  const pk=placeKey(place);
  const prev=all[pk]||{};
  const archive=Object.assign({},prev.archive);
  archive[date]=Object.assign({at:Date.now()},row);
  const keys=Object.keys(archive).sort();
  while(keys.length>40)delete archive[keys.shift()];
  all[pk]=Object.assign({},prev,{archive});
  saveWx(all);
}
function wxCoords(place){
  return `latitude=${encodeURIComponent(place.latitude)}&longitude=${encodeURIComponent(place.longitude)}`;
}
const WX_DAILY='daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto';
function ensureForecast(place){
  if(!navigator.onLine){paintWeather();return}
  const pk=placeKey(place);
  const bag=wxBag(place);
  const now=Date.now();
  if(bag&&bag.forecastAt&&now-bag.forecastAt<FORECAST_MS)return;
  if(wxFail['f:'+pk]&&now-wxFail['f:'+pk]<WX_RETRY_MS)return;
  const token='f:'+pk;
  if(wxBusy.has(token))return;
  wxBusy.add(token);
  paintWeather();
  const url=`https://api.open-meteo.com/v1/forecast?${wxCoords(place)}&current=temperature_2m,weather_code&${WX_DAILY}&forecast_days=7`;
  fetchJson(url).then(data=>{storeForecast(place,data);delete wxFail['f:'+pk]}).catch(()=>{wxFail['f:'+pk]=Date.now()}).finally(()=>{wxBusy.delete(token);paintWeather()});
}
function ensureArchive(place,date){
  if(!navigator.onLine){paintWeather();return}
  const pk=placeKey(place);
  const bag=wxBag(place);
  const row=bag&&bag.archive&&bag.archive[date];
  const now=Date.now();
  if(row&&row.at&&now-row.at<ARCHIVE_MS&&(row.max!=null||row.code!=null))return;
  const token='a:'+pk+':'+date;
  if(wxFail[token]&&now-wxFail[token]<WX_RETRY_MS)return;
  if(wxBusy.has(token))return;
  wxBusy.add(token);
  paintWeather();
  const archive=`https://archive-api.open-meteo.com/v1/archive?${wxCoords(place)}&start_date=${date}&end_date=${date}&${WX_DAILY}`;
  fetchJson(archive).then(data=>{
    const hit=dailyRow(data,date);
    if(hit)return hit;
    throw new Error('empty');
  }).catch(()=>{
    const past=Math.min(92,Math.max(1,-dayShift(date)));
    if(dayShift(date)<-92)throw new Error('old');
    return fetchJson(`https://api.open-meteo.com/v1/forecast?${wxCoords(place)}&${WX_DAILY}&past_days=${past}&forecast_days=1`).then(data=>{
      const hit=dailyRow(data,date);
      if(!hit)throw new Error('empty');
      return hit;
    });
  }).then(hit=>{storeArchive(place,date,hit);delete wxFail[token]}).catch(()=>{wxFail[token]=Date.now()}).finally(()=>{wxBusy.delete(token);paintWeather()});
}
function ensureWeather(cat){
  if(!cat||!cat.place)return;
  ensureForecast(cat.place);
  if(dayShift(sel)<0)ensureArchive(cat.place,sel);
}
function ensureVisibleWeather(){
  const cats=(openGoal&&!openCat)?[]:state.categories.filter(c=>c&&c.type==='weather'&&c.place&&(!openCat||c.id===openCat));
  cats.forEach(ensureWeather);
}
function wxDay(bag,date){
  if(!bag)return null;
  if(dayShift(date)>=0)return bag.forecast&&bag.forecast[date]||null;
  return (bag.archive&&bag.archive[date])||(bag.forecast&&bag.forecast[date])||null;
}
function nowLine(cur){
  const info=wmoInfo(cur.code);
  const temp=formatTemp(cur.temp);
  return h('p',{class:'wx-now'},h('span',{class:'wx-icon','aria-hidden':'true'},info.icon),' ',[info.label,temp?temp+' now':''].filter(Boolean).join(' · '));
}
function dayLine(day){
  const info=wmoInfo(day.code);
  const bits=[info.label];
  if(day.max!=null)bits.push('High '+formatTemp(day.max));
  if(day.min!=null)bits.push('Low '+formatTemp(day.min));
  if(day.precip!=null)bits.push(formatPrecip(day.precip));
  return h('p',{class:'wx-day'},h('span',{class:'wx-icon','aria-hidden':'true'},info.icon),' ',bits.join(' · '));
}
function weatherReadout(cat){
  const place=cat&&cat.place;
  if(!place)return h('p',{class:'muted sm wx-status'},'Set a city to see the forecast.');
  const bag=wxBag(place)||{};
  const shift=dayShift(sel);
  const pk=placeKey(place);
  const day=wxDay(bag,sel);
  const haveCurrent=!!(bag.current&&(bag.current.temp!=null||bag.current.code!=null));
  const token=shift>=0?'f:'+pk:'a:'+pk+':'+sel;
  const waiting=wxBusy.has('f:'+pk)||(shift<0&&wxBusy.has('a:'+pk+':'+sel));
  const kids=[];
  if(haveCurrent)kids.push(nowLine(bag.current));
  if(shift>6)kids.push(h('p',{class:'muted sm wx-status'},'Forecast is available for the next 7 days.'));
  else if(day)kids.push(dayLine(day));
  else if(waiting)kids.push(h('p',{class:'muted sm wx-status'},'Loading weather…'));
  else kids.push(h('p',{class:'muted sm wx-status'},'Weather is unavailable right now.'));
  if((day||haveCurrent)&&!navigator.onLine)kids.push(h('p',{class:'muted sm wx-offline'},'offline'));
  else if((day||haveCurrent)&&!!wxFail[token])kids.push(h('p',{class:'muted sm wx-saved'},'Showing saved weather.'));
  return h('div',{class:'wx','data-wx':sel},...kids);
}
function paintWeather(){
  document.querySelectorAll('[data-wx-slot]').forEach(slot=>{
    const cat=catById(slot.getAttribute('data-wx-slot'));
    if(cat)slot.replaceChildren(weatherReadout(cat));
  });
  prefillTemp();
}
function prefillTemp(){
  if(editingId||tempTouched)return;
  const cat=currentCat();
  if(!cat||cat.type!=='weather'||!cat.place)return;
  const input=$('wxTemp');
  if(!input||input.value!=='')return;
  const bag=wxBag(cat.place);
  if(!bag)return;
  let n=null;
  if(dayShift(sel)===0&&bag.current&&bag.current.temp!=null)n=bag.current.temp;
  const day=wxDay(bag,sel);
  if(n==null&&day&&day.max!=null)n=day.max;
  if(n==null)return;
  const rounded=Math.round(n);
  draft.temperature=rounded;
  input.value=String(rounded);
}
function weatherHeading(e){
  const c=conditionById(e.condition);
  const parts=[];
  if(c)parts.push(c.icon+' '+c.label);
  if(e.temperature!=null&&Number.isFinite(Number(e.temperature)))parts.push(formatTemp(e.temperature));
  return parts.join(' · ')||'Weather log';
}
function weatherCustomTitle(e){
  const title=(e&&e.title||'').trim();
  if(!title)return '';
  const cond=conditionById(e.condition);
  if(cond&&title.toLowerCase()===cond.label.toLowerCase())return '';
  return title;
}
function onPlaceInput(ev){
  placeQuery=ev.target.value;
  const q=placeQuery.trim();
  clearTimeout(onPlaceInput.timer);
  if(q.length<2){placeResults=[];placeStatus='';return}
  placeStatus='searching';
  onPlaceInput.timer=setTimeout(()=>searchPlaces(q),300);
}
function searchPlaces(q){
  const seq=++placeSeq;
  fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`).then(data=>{
    if(seq!==placeSeq||placeQuery.trim()!==q)return;
    const list=(Array.isArray(data.results)?data.results:[]).map(r=>normalizePlace({name:r.name,admin1:r.admin1||'',country:r.country||'',latitude:r.latitude,longitude:r.longitude})).filter(Boolean);
    if($('entryForm'))readDraft();
    const el=$('placeQuery');
    const focused=!!(el&&document.activeElement===el);
    const start=focused?el.selectionStart:null;
    const end=focused?el.selectionEnd:null;
    placeResults=list;
    placeStatus=list.length?'ready':'none';
    render();
    if(focused){
      const next=$('placeQuery');
      if(next){next.focus();if(start!=null&&next.setSelectionRange)next.setSelectionRange(start,end)}
    }
  }).catch(()=>{
    if(seq!==placeSeq||placeQuery.trim()!==q)return;
    if($('entryForm'))readDraft();
    placeResults=[];
    placeStatus='error';
    render();
  });
}
function choosePlace(p){
  const cat=currentCat();
  if(!cat||cat.type!=='weather')return;
  if($('entryForm'))readDraft();
  const place=normalizePlace(p);
  if(!place)return;
  cat.place=Object.assign({},cat.place||{},place);
  placeEditing=false;
  placeQuery='';
  placeResults=[];
  placeStatus='';
  save();
  render();
}
function useMyLocation(){
  if(placeStatus==='locating')return;
  if(!navigator.geolocation){placeStatus='loc-denied';render();return}
  if($('entryForm'))readDraft();
  placeStatus='locating';
  render();
  navigator.geolocation.getCurrentPosition(pos=>{
    const latitude=pos.coords.latitude,longitude=pos.coords.longitude;
    fetchJson(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&localityLanguage=en`).then(data=>choosePlace({
      name:data.city||data.locality||'My location',
      admin1:data.principalSubdivision||'',
      country:data.countryName||'',
      latitude,longitude
    })).catch(()=>choosePlace({name:'My location',admin1:'',country:'',latitude,longitude}));
  },()=>{
    placeStatus='loc-denied';
    if($('entryForm'))readDraft();
    render();
  },{enableHighAccuracy:false,timeout:10000,maximumAge:600000});
}
function placeEditor(cat){
  if(cat.place&&!placeEditing){
    return h('div',{class:'row place-set'},
      h('p',{class:'place-name',id:'placeName'},placeLabel(cat.place)),
      h('button',{type:'button',class:'btn ghost',id:'changePlace',onclick:()=>{
        if($('entryForm'))readDraft();
        placeEditing=true;placeQuery='';placeResults=[];placeStatus='';
        render();
        const el=$('placeQuery');
        if(el)el.focus();
      }},'Change city'));
  }
  const status=placeStatus==='searching'?'Searching…':placeStatus==='none'?'No matching city.':placeStatus==='error'?'City search is unavailable right now.':placeStatus==='locating'?'Finding your location…':placeStatus==='loc-denied'?'Location is unavailable. Search for a city instead.':'';
  return h('div',{class:'place-find',id:'placeFind'},
    h('label',{class:'lbl'},'City',h('input',{id:'placeQuery',class:'field',value:placeQuery,placeholder:'Search for a city','aria-label':'Search for a city',autocomplete:'off',oninput:onPlaceInput,onkeydown:ev=>{if(ev.key==='Enter')ev.preventDefault()}})),
    h('div',{class:'actions'},
      h('button',{type:'button',class:'btn ghost',id:'useLocation',onclick:useMyLocation},'Use my location'),
      cat.place?h('button',{type:'button',class:'btn ghost',id:'cancelPlace',onclick:()=>{
        if($('entryForm'))readDraft();
        placeEditing=false;placeQuery='';placeResults=[];placeStatus='';
        render();
      }},'Cancel'):null),
    status?h('p',{class:'muted sm',id:'placeStatus'},status):null,
    placeResults.length?h('div',{class:'place-results',id:'placeResults'},...placeResults.map(p=>h('button',{type:'button',class:'place-hit',onclick:()=>choosePlace(p)},placeLabel(p)))):null);
}
function weatherPanel(cat){
  return h('div',{class:'card wx-block',id:'wxBlock'},
    placeEditor(cat),
    cat.place&&!placeEditing?h('div',{id:'wxReadout','data-wx-slot':cat.id},weatherReadout(cat)):null);
}
function weatherFields(d){
  return [
    h('div',{class:'wx-conds',id:'wxConds',role:'group','aria-label':'Condition'},...CONDITIONS.map(c=>h('button',{
      type:'button',class:'cond'+(d.condition===c.id?' on':''),'data-cond':c.id,'aria-pressed':d.condition===c.id?'true':'false',
      onclick:()=>{readDraft();draft.condition=draft.condition===c.id?'':c.id;render()}
    },h('span',{class:'wx-icon','aria-hidden':'true'},c.icon),c.label))),
    h('label',{class:'lbl',for:'wxTemp'},'Temperature (°C)',h('input',{id:'wxTemp',class:'field',type:'number',inputmode:'decimal',step:'0.1','aria-label':'Temperature in degrees Celsius',value:d.temperature==null?'':String(d.temperature),oninput:ev=>{
      tempTouched=true;
      const raw=ev.target.value.trim();
      draft.temperature=raw===''?null:Number(raw);
    }}))
  ];
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
  timer:{
    id:'timer',
    label:'Timer',
    tagLabel:'Tags you are watching',
    blank(cat){
      const sections=sectionsFromNames(cat&&cat.sectionNames);
      return {title:'',note:'',tags:[],images:[],dreams:'',timerStart:'',timerEnd:'',durationMinutes:null,sections};
    },
    fromEntry(e){
      const sections=Array.isArray(e.sections)?normalizeSections(e.sections):sectionsFromLegacy(e);
      return {
        title:e.title||'',
        note:sectionText(sections,'notes'),
        tags:[...(e.tags||[])],
        images:[...(e.images||[])],
        dreams:sectionText(sections,'dreams'),
        timerStart:entryStart(e),
        timerEnd:entryEnd(e),
        durationMinutes:Number.isFinite(e.durationMinutes)?e.durationMinutes:null,
        sections
      };
    },
    hasContent(d){
      const written=(d.sections||[]).some(s=>(s.text||'').trim()||(s.title||'').trim()||tagList(s.tags).length);
      return !!(d.title.trim()||written||(d.images||[]).length||(d.timerStart&&d.timerEnd)||(Number.isFinite(d.durationMinutes)&&d.durationMinutes>0));
    },
    write(entry,d){
      entry.title=d.title.trim();
      entry.tags=[];
      entry.images=[...(d.images||[])];
      entry.sections=normalizeSections(d.sections).map(s=>({id:s.id,name:s.name.trim(),title:(s.title||'').trim(),text:s.text.trim(),tags:tagList(s.tags).map(t=>t.trim()).filter(Boolean)}));
      entry.note=sectionText(entry.sections,'notes');
      entry.dreams=sectionText(entry.sections,'dreams');
      entry.timerStart=d.timerStart||'';
      entry.timerEnd=d.timerEnd||'';
      entry.sleepStart=entry.timerStart;
      entry.sleepEnd=entry.timerEnd;
      entry.durationMinutes=Number.isFinite(d.durationMinutes)?d.durationMinutes:null;
    },
    fields(d){return timerFields(d)},
    tail(){return sectionEditor()},
    cardBits(e){
      const dur=formatDuration(entryMinutes(e));
      const times=[fmtDt(entryStart(e)),fmtDt(entryEnd(e))].filter(Boolean).join(' – ');
      const blocks=sectionBlocks(Array.isArray(e.sections)?e.sections:sectionsFromLegacy(e));
      return [
        dur?h('p',{class:'sleep-line','data-duration':dur},dur):null,
        times?h('p',{class:'muted sm time-line'},times):null,
        ...blocks,
        imageGrid(e.images)
      ];
    }
  },
  weather:{
    id:'weather',
    label:'Weather',
    tagLabel:'How it felt',
    tagPlaceholder:'New word, kept for this weather',
    blank(){return {title:'',note:'',tags:[],images:[],condition:'',temperature:null}},
    fromEntry(e){
      const cond=conditionById(e.condition)?e.condition:'';
      const t=e.temperature;
      return {title:e.title||'',note:e.note||'',tags:[...(e.tags||[])],images:[...(e.images||[])],condition:cond,temperature:t==null||t===''||!Number.isFinite(Number(t))?null:Number(t)};
    },
    hasContent(d){
      return !!((d.title||'').trim()||d.condition||(d.temperature!=null&&Number.isFinite(Number(d.temperature)))||(d.note||'').trim()||(d.tags||[]).length||(d.images||[]).length);
    },
    write(entry,d){
      entry.condition=conditionById(d.condition)?d.condition:'';
      const t=d.temperature;
      entry.temperature=t==null||t===''||!Number.isFinite(Number(t))?null:Number(t);
      entry.title=(d.title||'').trim();
      entry.note=(d.note||'').trim();
      entry.tags=[...d.tags];
      entry.images=[...(d.images||[])];
    },
    fields(d){return weatherFields(d)},
    tail(d){return h('div',{class:'wx-notes'},
      h('label',{class:'lbl'},'Title',h('input',{id:'entryTitle',class:'field',value:d.title||'',autocomplete:'off'})),
      h('label',{class:'lbl'},'Notes',h('textarea',{id:'entryNote',class:'field note'})))},
    cardBits(e){
      const custom=weatherCustomTitle(e);
      return [custom?h('p',{class:'wx-log'},weatherHeading(e)):null,e.note?h('p',{class:'note-text'},e.note):null,tagLine(e.tags),imageGrid(e.images)];
    }
  },
  list:{
    id:'list',
    label:'List',
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
  tracker:{
    id:'tracker',
    label:'Tracker',
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
      const cat=catById(e.categoryId);
      const flow=cat&&cat.tracker==='flow'?flowDayLine(cat,e.date):null;
      return [
        flow,
        e.note?h('p',{class:'note-text'},e.note):null,
        tagLine(e.tags),
        imageGrid(e.images)
      ];
    }
  },
  relationships:{
    id:'relationships',
    label:'Relationships',
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
  record:{
    id:'record',
    label:'Record',
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
const BORDERS=['rounded','square','double','dashed','thick','wood','vine','earth','water'];
const FONTS=[
  {id:'',name:'Theme serif'},
  {id:'garamond',name:'EB Garamond'},
  {id:'inter',name:'Inter'},
  {id:'caveat',name:'Caveat'},
  {id:'elite',name:'Special Elite'},
  {id:'pixel',name:'Pixelify Sans'}
];
const SCENES=[
  {id:'none',name:'Plain colour'},
  {id:'wood',name:'Wood'},
  {id:'vine',name:'Vine'},
  {id:'retro',name:'90s Retro'},
  {id:'earth',name:'Earth'},
  {id:'water',name:'Water'},
  {id:'upload',name:'Uploaded image'}
];
const SCENE_URL={wood:'assets/bg-wood.webp',vine:'assets/bg-vine.webp',retro:'assets/bg-retro.webp',earth:'assets/bg-earth.webp',water:'assets/bg-water.webp'};
const WATCH_KEY='field-record-watch';
function hexParts(hex){
  const h=String(hex||'').replace('#','');
  if(!/^[0-9a-fA-F]{6}$/.test(h))return null;
  return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
}
function mixHex(a,b,t){
  const A=hexParts(a),B=hexParts(b);
  if(!A||!B)return a;
  return '#'+A.map((v,i)=>Math.round(v*(1-t)+B[i]*t).toString(16).padStart(2,'0')).join('');
}
function onAccent(hex){
  const p=hexParts(hex);
  if(!p)return '#fbf8f2';
  return (0.2126*p[0]+0.7152*p[1]+0.0722*p[2])/255>0.62?'#1c1914':'#fbf8f2';
}
function hexOf(v,fallback){
  const p=hexParts(v);
  return p?'#'+p.map(n=>n.toString(16).padStart(2,'0')).join(''):fallback;
}
function presetSkin(id){
  const map={
    paper:{scene:'none',border:'rounded',font:'',page:'#f3efe6',card:'#fbf8f2',ink:'#1c1914',accent:'#2f5d45',line:'#e2dacb'},
    wood:{scene:'wood',border:'wood',font:'garamond',page:'#5c3a22',card:'#f6efe2',ink:'#3a2718',accent:'#8a4b24',line:'#c4a07a'},
    vine:{scene:'vine',border:'vine',font:'garamond',page:'#245438',card:'#f4f8ec',ink:'#1a2e1c',accent:'#1f6b3a',line:'#7ea56a'},
    retro:{scene:'retro',border:'thick',font:'pixel',page:'#0c3a16',card:'#8ae04f',ink:'#14240f',accent:'#123d16',line:'#0e3012'},
    earth:{scene:'earth',border:'earth',font:'inter',page:'#050b16',card:'#071422',ink:'#e7f3ff',accent:'#7dffa6',line:'#3d7eb8'},
    water:{scene:'water',border:'water',font:'garamond',page:'#c9e0da',card:'#fffdf8',ink:'#16343a',accent:'#8a6a2f',line:'#c6a15a'}
  };
  return Object.assign({uploadId:''},map[id]||map.paper);
}
function normalizeSkin(raw){
  const base=presetSkin('paper');
  const s=Object.assign({},base,raw||{});
  s.scene=SCENES.some(x=>x.id===s.scene)?s.scene:'none';
  s.border=BORDERS.includes(s.border)?s.border:'rounded';
  s.font=FONTS.some(f=>f.id===s.font)?s.font:'';
  s.page=hexOf(s.page,base.page);
  s.card=hexOf(s.card,base.card);
  s.ink=hexOf(s.ink,base.ink);
  s.accent=hexOf(s.accent,base.accent);
  s.line=hexOf(s.line,base.line);
  s.uploadId=typeof s.uploadId==='string'?s.uploadId:'';
  return s;
}
function applyAppearance(){
  const root=document.documentElement;
  const meta=document.querySelector('meta[name="theme-color"]');
  if(!state.skin){
    const look=LOOK_IDS.has(state.look)?state.look:'paper';
    root.dataset.look=look;
    delete root.dataset.border;
    delete root.dataset.font;
    delete root.dataset.scheme;
    root.removeAttribute('style');
    if(meta)meta.setAttribute('content',THEME_COLOR[look]||THEME_COLOR.paper);
    return;
  }
  const s=normalizeSkin(state.skin);
  state.skin=s;
  root.dataset.look='custom';
  root.dataset.border=s.border;
  if(s.font)root.dataset.font=s.font;else delete root.dataset.font;
  const inkL=hexParts(s.ink);
  const luma=inkL?(0.2126*inkL[0]+0.7152*inkL[1]+0.0722*inkL[2])/255:0;
  root.dataset.scheme=luma>0.62?'light':'dark';
  root.style.setProperty('--page',s.page);
  root.style.setProperty('--bg',s.page);
  root.style.setProperty('--surface',s.card);
  root.style.setProperty('--ink',s.ink);
  root.style.setProperty('--accent',s.accent);
  root.style.setProperty('--line',s.line);
  root.style.setProperty('--on-accent',onAccent(s.accent));
  root.style.setProperty('--muted',mixHex(s.ink,s.page,0.35));
  if(s.scene==='upload'&&s.uploadId){
    root.style.setProperty('--scene','none');
    urlFor(s.uploadId).then(url=>{
      if(state.skin&&state.skin.uploadId===s.uploadId&&url)root.style.setProperty('--scene',`url("${url}")`);
    }).catch(()=>{});
  }else if(SCENE_URL[s.scene]){
    root.style.setProperty('--scene',`url("${SCENE_URL[s.scene]}")`);
  }else root.style.setProperty('--scene','none');
  if(meta)meta.setAttribute('content',s.accent);
}
const GOAL_TYPES={checks:{id:'checks',label:'Daily check-boxes'}};
function normalizeGoalEntry(e){
  const copy=Object.assign({},e);
  copy.id=typeof e.id==='string'&&e.id?e.id:uid();
  copy.date=/^\d{4}-\d{2}-\d{2}$/.test(e.date)?e.date:'';
  copy.title=typeof e.title==='string'?e.title:'';
  copy.note=typeof e.note==='string'?e.note:'';
  copy.tags=tagList(e.tags);
  copy.images=Array.isArray(e.images)?e.images.map(String):[];
  copy.createdAt=Number.isFinite(Number(e.createdAt))?Number(e.createdAt):Date.now();
  return copy;
}
function normalizeGoal(g){
  const copy=Object.assign({},g);
  copy.id=typeof g.id==='string'&&g.id?g.id:uid();
  copy.name=typeof g.name==='string'?g.name:'';
  copy.type=GOAL_TYPES[g.type]?g.type:'checks';
  const items=(Array.isArray(g.items)?g.items:[]).filter(it=>it&&typeof it==='object').map(it=>{
    const item=Object.assign({},it);
    item.id=typeof it.id==='string'&&it.id?it.id:uid();
    item.name=typeof it.name==='string'?it.name:'';
    return item;
  });
  copy.items=items;
  copy.tags=tagList(g.tags);
  const ids=new Set(items.map(it=>it.id));
  const entries=(Array.isArray(g.entries)?g.entries:[]).filter(e=>e&&typeof e==='object').map(normalizeGoalEntry).filter(e=>e.date);
  const days={};
  const raw=g.days&&typeof g.days==='object'&&!Array.isArray(g.days)?g.days:{};
  Object.keys(raw).forEach(k=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(k)||!raw[k]||typeof raw[k]!=='object'||Array.isArray(raw[k]))return;
    const d=Object.assign({},raw[k]);
    const note=typeof raw[k].note==='string'?raw[k].note.trim():'';
    const tags=tagList(raw[k].tags);
    d.note='';
    d.tags=[];
    d.checks=tagList(raw[k].checks).filter(id=>ids.has(id));
    if(note||tags.length){
      const dup=entries.some(e=>e.date===k&&e.note===note&&tags.length===e.tags.length&&tags.every(t=>e.tags.some(x=>same(x,t))));
      if(!dup)entries.push({id:uid(),date:k,title:'',note,tags,images:[],createdAt:Date.now()});
    }
    days[k]=d;
  });
  copy.days=days;
  copy.entries=entries;
  return copy;
}
function load(){
  try{
    const s=JSON.parse(localStorage.getItem(KEY));
    if(s&&Array.isArray(s.categories)){
      const state=Object.assign({categories:[],entries:[],dayTitles:{},goals:[],look:'paper',themes:[],skin:null,typing:{enabled:false,voice:'key',volume:0.35}},s);
      let migrated=false;
      state.categories.forEach(c=>{
        if(!Array.isArray(c.tags))c.tags=[];
        const wasSleep=c.type==='sleep';
        if(wasSleep){c.type='timer';migrated=true}
        if(!c.type||!TYPES[c.type])c.type='notes';
        if(c.type==='timer'){
          if(c.tags.length){c.tags=[];migrated=true}
          if(Array.isArray(c.sectionNames))c.sectionNames=c.sectionNames.map(n=>String(n));
          else if(wasSleep){c.sectionNames=['Dreams','Notes'];migrated=true}
          const raw=c.sectionTags;
          const next={};
          if(raw&&typeof raw==='object'&&!Array.isArray(raw))Object.keys(raw).forEach(k=>{next[String(k)]=tagList(raw[k])});
          if(JSON.stringify(raw)!==JSON.stringify(next))migrated=true;
          c.sectionTags=next;
        }
        if(c.type==='list'){
          if(!Array.isArray(c.lists)){c.lists=[];migrated=true}
          else{
            const nextLists=c.lists.filter(l=>l&&typeof l==='object').map(normalizeShopList);
            if(JSON.stringify(nextLists)!==JSON.stringify(c.lists))migrated=true;
            c.lists=nextLists;
          }
          const nextMeals=normalizeMeals(c.meals);
          if(JSON.stringify(nextMeals)!==JSON.stringify(c.meals||{}))migrated=true;
          c.meals=nextMeals;
        }
        if(c.type==='tracker'){
          const before=JSON.stringify({tracker:c.tracker,shifts:c.shifts,flow:c.flow,flowOptions:c.flowOptions,showCycle:c.showCycle});
          normalizeTracker(c);
          const after=JSON.stringify({tracker:c.tracker,shifts:c.shifts,flow:c.flow,flowOptions:c.flowOptions,showCycle:c.showCycle});
          if(before!==after)migrated=true;
        }
        if(c.type==='relationships'){
          const nextRel=normalizeRelationships(c);
          if(JSON.stringify(c.groups||[])!==JSON.stringify(nextRel.groups)||JSON.stringify(c.people||[])!==JSON.stringify(nextRel.people))migrated=true;
          c.groups=nextRel.groups;
          c.people=nextRel.people;
        }
        if(c.type==='record'){
          const nextRecords=normalizeRecords(c.records);
          if(JSON.stringify(c.records||[])!==JSON.stringify(nextRecords))migrated=true;
          c.records=nextRecords;
        }
        if(c.type==='weather'){
          if(c.place==null){
            if(!Object.prototype.hasOwnProperty.call(c,'place')){c.place=null;migrated=true}
          }else{
            const place=normalizePlace(c.place);
            if(!place){c.place=null;migrated=true}
            else{
              if(typeof c.place.name!=='string'||!c.place.name.trim()){c.place.name=place.name;migrated=true}
              if(typeof c.place.admin1!=='string'){c.place.admin1=place.admin1;migrated=true}
              if(typeof c.place.country!=='string'){c.place.country=place.country;migrated=true}
              if(!Number.isFinite(Number(c.place.latitude))){c.place.latitude=place.latitude;migrated=true}
              if(!Number.isFinite(Number(c.place.longitude))){c.place.longitude=place.longitude;migrated=true}
            }
          }
        }
      });
      state.entries.forEach(e=>{
        if(!Array.isArray(e.tags))e.tags=[];
        if(!Array.isArray(e.images))e.images=[];
        if(e.sleepStart&&!e.timerStart){e.timerStart=e.sleepStart;migrated=true}
        if(e.sleepEnd&&!e.timerEnd){e.timerEnd=e.sleepEnd;migrated=true}
        const cat=state.categories.find(c=>c.id===e.categoryId);
        if(!cat||cat.type!=='timer')return;
        if(e.tags.length){e.tags=[];migrated=true}
        if(Array.isArray(e.sections)){
          const next=normalizeSections(e.sections);
          if(JSON.stringify(next)!==JSON.stringify(e.sections))migrated=true;
          e.sections=next;
          return;
        }
        const includeDreams=Array.isArray(cat.sectionNames)&&cat.sectionNames.some(n=>n.trim().toLowerCase()==='dreams');
        e.sections=sectionsFromLegacy(e,includeDreams||(typeof e.dreams==='string'&&!!e.dreams.trim()));
        migrated=true;
      });
      state.categories.forEach(c=>{
        if(c.type!=='timer'||Array.isArray(c.sectionNames))return;
        const mine=state.entries.filter(e=>e.categoryId===c.id&&Array.isArray(e.sections));
        const hasDreams=mine.some(e=>e.sections.some(s=>String(s.name||'').trim().toLowerCase()==='dreams'));
        c.sectionNames=hasDreams?['Dreams','Notes']:['Notes'];
        migrated=true;
      });
      state.entries.forEach(e=>{
        const cat=state.categories.find(c=>c.id===e.categoryId);
        if(!cat||cat.type!=='weather')return;
        const cond=conditionById(e.condition)?e.condition:'';
        if(e.condition!==cond){e.condition=cond;migrated=true}
        const t=e.temperature;
        const next=t==null||t===''||!Number.isFinite(Number(t))?null:Number(t);
        if(e.temperature!==next){e.temperature=next;migrated=true}
      });
      if(!state.dayTitles||typeof state.dayTitles!=='object')state.dayTitles={};
      const hadGoals=Array.isArray(s.goals);
      const nextGoals=(Array.isArray(state.goals)?state.goals:[]).filter(g=>g&&typeof g==='object').map(normalizeGoal);
      if(!hadGoals||JSON.stringify(state.goals)!==JSON.stringify(nextGoals))migrated=true;
      state.goals=nextGoals;
      state.themes=(Array.isArray(state.themes)?state.themes:[]).filter(t=>t&&t.id&&t.name&&t.skin).map(t=>({id:String(t.id),name:String(t.name),skin:normalizeSkin(t.skin)}));
      state.skin=state.skin&&typeof state.skin==='object'?normalizeSkin(state.skin):null;
      const typing=state.typing&&typeof state.typing==='object'?state.typing:{};
      const vol=Number(typing.volume);
      state.typing={
        enabled:typing.enabled===true,
        voice:['key','type','pop'].includes(typing.voice)?typing.voice:'key',
        volume:Number.isFinite(vol)?Math.min(1,Math.max(0,vol)):0.35
      };
      let repair=false;
      if(typeof state.look==='string'&&state.look.startsWith('theme:')){
        if(!state.themes.some(t=>t.id===state.look.slice(6))){state.look='paper';state.skin=null;repair=true}
      }else if(state.look==='custom'){
        if(!state.skin){state.look='paper';repair=true}
      }else if(!LOOK_IDS.has(state.look)){state.look='paper';state.skin=null;repair=true}
      if(migrated||repair)state._migrated=true;
      const backed=Number(state.lastBackupAt);
      state.lastBackupAt=Number.isFinite(backed)&&backed>0?backed:0;
      const snooze=Number(state.backupSnoozeUntil);
      state.backupSnoozeUntil=Number.isFinite(snooze)&&snooze>0?snooze:0;
      if(stampMissing(state))state._migrated=true;
      return state;
    }
  }catch(e){}
  const blank={categories:[],entries:[],dayTitles:{},goals:[],look:'paper',themes:[],skin:null,typing:{enabled:false,voice:'key',volume:0.35}};
  stampMissing(blank);
  return blank;
}
const GONE_KINDS=['category','entry','goal','goalItem','goalEntry','goalCheck','list','listItem','meal','mealItem','shift','flowLog','flowOption','dayTitle','theme','image','group','person','relSection','relNote','record'];
let state=load();
applyAppearance();
let goalNotesFor=null;
let skipFormRead=false,skipShiftRead=false;
let syncSnap=null,syncQuiet=false,syncDirty=false,syncTimer=null,syncing=false,syncQueued=false;
let syncLink=null,syncKey=null,syncBusy=false,syncStatusText='',syncMode='idle';
const save=()=>{
  readGoalNotes();
  readRelSections();
  const changed=noteEdits();
  localStorage.setItem(KEY,JSON.stringify(state));
  syncSnap=JSON.parse(JSON.stringify(state));
  if(changed&&!syncQuiet)scheduleSync();
};
if(state._migrated){
  delete state._migrated;
  noteEdits();
  localStorage.setItem(KEY,JSON.stringify(state));
  syncSnap=JSON.parse(JSON.stringify(state));
}
if(!syncSnap)syncSnap=JSON.parse(JSON.stringify(state));
let sel=key(new Date()),view=parse(sel),addingCat=false,newType='notes',newTracker='shifts';
let openCat=null,openGoal=null,editingId=null,tagEdit=false,renamingTag=null,focusTitle=false;
let addingGoal=false,newGoalType='checks',goalEditingId=null,itemEdit=false,itemRenaming=null,goalNameEdit=false;
let listNameEdit=false,listItemEdit=null,listRenaming=null,listItemRenaming=null;
let mealEdit=false,mealRenaming=null,mealPicker=null;
let pendingListName='',pendingMealName='';
let shiftEditing=null;
let shiftDraft={start:'',end:'',breakMin:'',label:''};
let flowEdit=false,flowRenaming=null,pendingFlowName='';
let recordOpenId=null,recordQuery='';
let groupEdit=false,groupRenaming=null,pendingGroupName='',openPerson=null;
const pendingPersonName={};
let personTagEdit=false,personRenamingTag=null,pendingPersonTag='';
let relSectionEdit=false,relSectionRenaming=null,pendingSectionName='';
let relEditingId=null,relTagEdit=false,relRenamingTag=null,pendingRelTag='',relImageError='';
let relDraft={title:'',note:'',tags:[],images:[]};
const relSession=new Set();
let linkAsk=false,codeOpen=false;
const pendingListItems={};
const pickIds=new Set();
let pendingItem='';
let draft=TYPES.notes.blank(),pendingTag='',imageError='';
const sessionNew=new Set();
const expanded=new Set();
let picker=false,pickerYear=view.getFullYear(),lookOpen=false,backupOpen=false;
let pendingImport=null,backupBusy=false;
const urlCache=new Map();
let dbPromise=null;
let renamingTheme=null;
let bgError='';
function loadWatch(){
  try{
    const w=JSON.parse(localStorage.getItem(WATCH_KEY));
    if(w&&typeof w==='object')return {running:!!w.running,startedAt:Number(w.startedAt)||0,elapsed:Number(w.elapsed)||0,categoryId:w.categoryId||'',date:w.date||''};
  }catch(e){}
  return {running:false,startedAt:0,elapsed:0,categoryId:'',date:''};
}
let watch=loadWatch();
function saveWatch(){localStorage.setItem(WATCH_KEY,JSON.stringify(watch))}
function watchElapsed(){
  let ms=watch.elapsed||0;
  if(watch.running&&watch.startedAt)ms+=Date.now()-watch.startedAt;
  return Math.max(0,ms);
}
function formatClock(ms){
  const s=Math.floor(ms/1000);
  return `${pad(Math.floor(s/3600))}:${pad(Math.floor((s%3600)/60))}:${pad(s%60)}`;
}
function startWatch(){
  readDraft();
  if(!watch.running){
    watch.running=true;
    watch.startedAt=Date.now();
    if(!watch.elapsed)watch.elapsed=0;
    watch.categoryId=openCat||'';
    watch.date=sel;
    saveWatch();
    render();
  }
}
function pauseWatch(){
  if(!watch.running)return;
  watch.elapsed=watchElapsed();
  watch.running=false;
  watch.startedAt=0;
  saveWatch();
  render();
}
function resumeWatch(){
  if(watch.running)return;
  watch.running=true;
  watch.startedAt=Date.now();
  watch.categoryId=watch.categoryId||openCat||'';
  watch.date=watch.date||sel;
  saveWatch();
  render();
}
function stopAndSave(){
  readDraft();
  const ms=watchElapsed();
  const end=new Date();
  const start=new Date(end.getTime()-ms);
  const a=dtLocal(start),b=dtLocal(end);
  const hs=$('timerStart'),he=$('timerEnd');
  if(hs)hs.value=a;
  if(he)he.value=b;
  draft.timerStart=a;
  draft.timerEnd=b;
  draft.durationMinutes=Math.max(0,Math.round(ms/60000));
  watch={running:false,startedAt:0,elapsed:0,categoryId:'',date:''};
  saveWatch();
  saveEntry();
}
function timerFields(d){
  const mins=entryMinutes(d);
  const durLabel=formatDuration(mins)||'—';
  const showH=Number.isFinite(d.durationMinutes)&&!(d.timerStart&&d.timerEnd)?String(Math.floor(d.durationMinutes/60)):'';
  const showM=Number.isFinite(d.durationMinutes)&&!(d.timerStart&&d.timerEnd)?String(d.durationMinutes%60):'';
  const actions=[];
  if(!watch.running&&!(watch.elapsed>0))actions.push(h('button',{type:'button',class:'btn',id:'watchStart',onclick:startWatch},'Start'));
  if(watch.running)actions.push(h('button',{type:'button',class:'btn',id:'watchPause',onclick:pauseWatch},'Pause'));
  if(!watch.running&&watch.elapsed>0)actions.push(h('button',{type:'button',class:'btn',id:'watchResume',onclick:resumeWatch},'Resume'));
  if(watch.running||watch.elapsed>0)actions.push(h('button',{type:'button',class:'btn',id:'watchStop',onclick:stopAndSave},'Stop & save'));
  const other=watch.categoryId&&watch.categoryId!==openCat?catById(watch.categoryId):null;
  return [
    h('label',{class:'lbl'},'Title',h('input',{id:'entryTitle',class:'field',value:d.title,autocomplete:'off'})),
    h('div',{class:'watch-box'},
      h('p',{class:'watch'},'Stopwatch'),
      h('p',{class:'watch-time',id:'watchTime','data-running':watch.running?'true':'false'},formatClock(watchElapsed())),
      other?h('p',{class:'muted sm'},`Running in ${other.name}`):null,
      h('div',{class:'watch-actions'},...actions)),
    h('p',{class:'manual-or'},'Or enter a start and end'),
    h('div',{class:'sleep-times'},
      h('label',{class:'lbl'},'Start',h('input',{id:'timerStart',class:'field',type:'datetime-local',step:'60',value:d.timerStart||'',autocomplete:'off',oninput:updateTimerReadout})),
      h('label',{class:'lbl'},'End',h('input',{id:'timerEnd',class:'field',type:'datetime-local',step:'60',value:d.timerEnd||'',autocomplete:'off',oninput:updateTimerReadout}))),
    h('p',{class:'dur-hint'},'Or a duration, if you leave the times empty'),
    h('div',{class:'sleep-times'},
      h('label',{class:'lbl'},'Hours',h('input',{id:'durH',class:'field',type:'number',min:'0',inputmode:'numeric',value:showH,oninput:updateTimerReadout})),
      h('label',{class:'lbl'},'Minutes',h('input',{id:'durM',class:'field',type:'number',min:'0',max:'59',inputmode:'numeric',value:showM,oninput:updateTimerReadout}))),
    h('p',{class:'watch'},'Duration'),
    h('p',{class:'duration',id:'timerDuration','data-duration':durLabel==='—'?'':durLabel},durLabel)
  ];
}

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
function allImageRecords(){
  return openDb().then(db=>new Promise((resolve,reject)=>{
    const out=[];
    const req=db.transaction(IMG_STORE,'readonly').objectStore(IMG_STORE).openCursor();
    req.onsuccess=()=>{
      const cursor=req.result;
      if(!cursor){resolve(out);return}
      if(cursor.key!=null&&cursor.key!==''&&cursor.value instanceof Blob)out.push({id:String(cursor.key),blob:cursor.value});
      cursor.continue();
    };
    req.onerror=()=>reject(req.error);
  }));
}
function replaceImages(items){
  return openDb().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(IMG_STORE,'readwrite');
    const store=tx.objectStore(IMG_STORE);
    store.clear();
    items.forEach(item=>store.put(item.blob,item.id));
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||new Error('images'));
    tx.onabort=()=>reject(tx.error||new Error('images'));
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
  if(!id)return '';
  if(urlCache.has(id))return urlCache.get(id);
  let blob=await getImage(id);
  if(!blob)blob=await fetchSyncImage(id);
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
  draft=typeOf(cat).blank(cat);
  pendingTag='';
  imageError='';
  tempTouched=false;
}
let focusSectionId=null;
let sectionTagEdit=null,sectionRenaming=null;
const pendingSectionTags={};
function sectionTagBucket(cat,name,create){
  if(!cat.sectionTags||typeof cat.sectionTags!=='object'||Array.isArray(cat.sectionTags))cat.sectionTags={};
  const key=Object.keys(cat.sectionTags).find(k=>same(k,name));
  if(key!==undefined)return key;
  if(!create)return null;
  cat.sectionTags[name]=[];
  return name;
}
function moveSectionTags(oldName,newName){
  const cat=currentCat();
  if(!cat||oldName===newName)return;
  const oldKey=sectionTagBucket(cat,oldName,false);
  if(oldKey==null)return;
  const still=(draft.sections||[]).some(sec=>same(sec.name,oldName));
  if(still)return;
  const list=cat.sectionTags[oldKey];
  delete cat.sectionTags[oldKey];
  const clash=sectionTagBucket(cat,newName,false);
  if(clash!=null)list.forEach(t=>{if(!cat.sectionTags[clash].some(m=>same(m,t)))cat.sectionTags[clash].push(t)});
  else cat.sectionTags[newName]=list;
}
function rememberSections(){
  const cat=currentCat();
  if(!cat||typeOf(cat).id!=='timer')return;
  cat.sectionNames=(draft.sections||[]).map(s=>s.name);
  save();
}
function addNoteSection(){
  readDraft();
  const s=newSection('','');
  draft.sections=draft.sections||[];
  draft.sections.push(s);
  rememberSections();
  focusSectionId=s.id;
  render();
}
function moveSection(id,dir){
  readDraft();
  const i=(draft.sections||[]).findIndex(s=>s.id===id);
  const j=i+dir;
  if(i<0||j<0||j>=draft.sections.length)return;
  const [s]=draft.sections.splice(i,1);
  draft.sections.splice(j,0,s);
  rememberSections();
  render();
}
function removeSection(id){
  readDraft();
  draft.sections=(draft.sections||[]).filter(s=>s.id!==id);
  rememberSections();
  render();
}
function clearSectionTagUi(){
  sectionTagEdit=null;
  sectionRenaming=null;
  Object.keys(pendingSectionTags).forEach(k=>delete pendingSectionTags[k]);
}
function toggleSectionTag(sectionId,name){
  readDraft();
  const s=(draft.sections||[]).find(x=>x.id===sectionId);
  if(!s)return;
  s.tags=tagList(s.tags);
  const i=s.tags.findIndex(t=>same(t,name));
  if(i>=0)s.tags.splice(i,1);else s.tags.push(name);
  render();
}
function keepField(selector){
  const el=document.querySelector(selector);
  if(!el)return;
  el.focus();
  try{
    const n=el.value.length;
    if(el.setSelectionRange)el.setSelectionRange(n,n);
  }catch(e){}
}
function addSectionTag(sectionId){
  readDraft();
  const s=(draft.sections||[]).find(x=>x.id===sectionId);
  const cat=currentCat();
  const raw=String(pendingSectionTags[sectionId]||'').trim();
  pendingSectionTags[sectionId]='';
  const selector=`[data-section-tag="${sectionId}"]`;
  const field=document.querySelector(selector);
  if(field)field.value='';
  if(!s||!cat||!raw){keepField(selector);return}
  const key=sectionTagBucket(cat,s.name,true);
  if(!cat.sectionTags[key].some(t=>same(t,raw)))cat.sectionTags[key].push(raw);
  const canonical=cat.sectionTags[key].find(t=>same(t,raw));
  s.tags=tagList(s.tags);
  if(canonical&&!s.tags.some(t=>same(t,canonical)))s.tags.push(canonical);
  save();
  render();
  keepField(selector);
}
function deleteSectionTag(sectionName,name){
  readDraft();
  const cat=currentCat();
  if(!cat)return;
  const key=sectionTagBucket(cat,sectionName,false);
  if(key!=null)cat.sectionTags[key]=cat.sectionTags[key].filter(t=>!same(t,name));
  const strip=list=>tagList(list).filter(t=>!same(t,name));
  state.entries.forEach(e=>{
    if(e.categoryId!==cat.id||!Array.isArray(e.sections))return;
    e.sections.forEach(sec=>{if(same(sec.name,sectionName))sec.tags=strip(sec.tags)});
  });
  (draft.sections||[]).forEach(sec=>{if(same(sec.name,sectionName))sec.tags=strip(sec.tags)});
  if(sectionRenaming&&same(sectionRenaming.tag,name))sectionRenaming=null;
  save();
  render();
}
function commitSectionRename(sectionId,oldName,raw){
  if(!sectionRenaming||sectionRenaming.id!==sectionId||!same(sectionRenaming.tag,oldName))return;
  sectionRenaming=null;
  const name=String(raw||'').trim();
  const s=(draft.sections||[]).find(x=>x.id===sectionId);
  const cat=currentCat();
  if(!s||!cat||!name||name===oldName){render();return}
  const key=sectionTagBucket(cat,s.name,true);
  const list=cat.sectionTags[key];
  const clash=list.find(t=>same(t,name)&&!same(t,oldName));
  const next=clash||name;
  const idx=list.findIndex(t=>same(t,oldName));
  if(clash)cat.sectionTags[key]=list.filter(t=>!same(t,oldName));
  else if(idx>=0)list[idx]=next;
  else list.push(next);
  const rewrite=tags=>[...new Set(tagList(tags).map(t=>same(t,oldName)?next:t))];
  state.entries.forEach(e=>{
    if(e.categoryId!==cat.id||!Array.isArray(e.sections))return;
    e.sections.forEach(sec=>{if(same(sec.name,s.name))sec.tags=rewrite(sec.tags)});
  });
  (draft.sections||[]).forEach(sec=>{if(same(sec.name,s.name))sec.tags=rewrite(sec.tags)});
  save();
  render();
}
function sectionChip(section,tag){
  const on=tagList(section.tags).some(t=>same(t,tag));
  const editing=sectionTagEdit===section.id;
  if(editing&&sectionRenaming&&sectionRenaming.id===section.id&&same(sectionRenaming.tag,tag)){
    const inp=h('input',{class:'chip-input','aria-label':`Rename ${tag}`,value:tag,
      onkeydown:ev=>{
        if(ev.key==='Enter'){ev.preventDefault();commitSectionRename(section.id,tag,ev.target.value)}
        if(ev.key==='Escape'){sectionRenaming=null;render()}
      },
      onblur:ev=>commitSectionRename(section.id,tag,ev.target.value)});
    setTimeout(()=>{inp.focus();inp.select()},0);
    return h('span',{class:'chip editing','data-tag':tag},inp);
  }
  const text=h('button',{type:'button',class:'chip-text',onclick:()=>{
    if(editing){readDraft();sectionRenaming={id:section.id,tag};render()}
    else toggleSectionTag(section.id,tag);
  }},tag);
  const kids=[text];
  if(editing)kids.push(h('button',{type:'button',class:'chip-x','aria-label':`Delete tag ${tag}`,onclick:ev=>{ev.stopPropagation();deleteSectionTag(section.name,tag)}},'×'));
  return h('span',{class:'chip'+(on?' on':'')+(editing?' edit':''),'data-tag':tag,'data-on':on?'true':'false'},...kids);
}
function sectionTagBox(s){
  const cat=currentCat();
  const key=cat?sectionTagBucket(cat,s.name,false):null;
  const watched=key!=null?tagList(cat.sectionTags[key]):[];
  const names=[...watched];
  tagList(s.tags).forEach(t=>{if(!names.some(n=>same(n,t)))names.push(t)});
  const editing=sectionTagEdit===s.id;
  return h('div',{class:'section-tagbox','data-section-tags':s.id},
    h('p',{class:'watch'},'Tags you are watching'),
    names.length?h('div',{class:'chips'},...names.map(t=>sectionChip(s,t))):h('p',{class:'muted sm'},'No tags yet.'),
    h('div',{class:'tag-row'},
      h('input',{class:'field','data-section-tag':s.id,value:pendingSectionTags[s.id]||'',placeholder:'New word, kept for this section','aria-label':'New word, kept for this section',autocomplete:'off',
        onkeydown:ev=>{if(ev.key==='Enter'){ev.preventDefault();addSectionTag(s.id)}},
        oninput:ev=>{pendingSectionTags[s.id]=ev.target.value}}),
      h('button',{type:'button',class:'btn ghost',onclick:()=>addSectionTag(s.id)},'Add tag'),
      h('button',{type:'button',class:editing?'btn':'btn ghost','aria-pressed':editing?'true':'false',onclick:()=>{
        readDraft();
        if(sectionTagEdit===s.id){sectionTagEdit=null;sectionRenaming=null}else{sectionTagEdit=s.id;sectionRenaming=null}
        render();
      }},editing?'Done':'Edit')));
}
function sectionEditor(){
  const sections=draft.sections||[];
  const rows=sections.map((s,i)=>h('div',{class:'note-section','data-section':s.id},
    h('div',{class:'section-head'},
      h('input',{class:'field section-name','data-section-name':s.id,value:s.name,placeholder:'Section name','aria-label':'Section name',autocomplete:'off',
        onkeydown:ev=>{if(ev.key==='Enter')ev.preventDefault()},
        oninput:ev=>{
          const prev=s.name;
          const start=ev.target.selectionStart,end=ev.target.selectionEnd;
          readDraft();
          moveSectionTags(prev,s.name);
          rememberSections();
          render();
          const name=document.querySelector(`[data-section-name="${s.id}"]`);
          if(name){name.focus();if(start!=null&&name.setSelectionRange)name.setSelectionRange(start,end);}
        }}),
      h('div',{class:'section-tools'},
        h('button',{type:'button',class:'section-move','aria-label':'Move section up',disabled:i===0,onclick:()=>moveSection(s.id,-1)},'Up'),
        h('button',{type:'button',class:'section-move','aria-label':'Move section down',disabled:i===sections.length-1,onclick:()=>moveSection(s.id,1)},'Down'),
        h('button',{type:'button',class:'section-remove','aria-label':'Remove section',onclick:()=>removeSection(s.id)},'Remove'))),
    h('input',{class:'field section-title','data-section-title':s.id,value:s.title||'',placeholder:'Title','aria-label':'Section title',autocomplete:'off',
      onkeydown:ev=>{if(ev.key==='Enter')ev.preventDefault()},
      oninput:ev=>{s.title=ev.target.value}}),
    h('textarea',{class:'field note section-text','data-section-text':s.id,'aria-label':(s.name||'').trim()||'Section'}),
    sectionTagBox(s)));
  return h('div',{class:'note-sections',id:'noteSections'},
    ...rows,
    h('button',{type:'button',class:'btn ghost add-section',id:'addSection',onclick:addNoteSection},'+ Add note section'));
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
  (draft.sections||[]).forEach(s=>{
    const name=document.querySelector(`[data-section-name="${s.id}"]`);
    const title=document.querySelector(`[data-section-title="${s.id}"]`);
    const text=document.querySelector(`[data-section-text="${s.id}"]`);
    if(name)s.name=name.value;
    if(title)s.title=title.value;
    if(text)s.text=text.value;
  });
  document.querySelectorAll('[data-section-tag]').forEach(inp=>{pendingSectionTags[inp.getAttribute('data-section-tag')]=inp.value});
  const ss=$('timerStart');
  if(ss)draft.timerStart=ss.value;
  const se=$('timerEnd');
  if(se)draft.timerEnd=se.value;
  const hs=$('durH'),ms=$('durM');
  if(ss&&se&&draft.timerStart&&draft.timerEnd){
    const between=minutesBetween(draft.timerStart,draft.timerEnd);
    if(between!=null)draft.durationMinutes=between;
  }else if(hs&&ms&&(hs.value!==''||ms.value!=='')){
    draft.durationMinutes=(Number(hs.value)||0)*60+Math.min(59,Math.max(0,Number(ms.value)||0));
  }else if(hs&&ms)draft.durationMinutes=null;
  const n=$('newTag');
  if(n)pendingTag=n.value;
  const temp=$('wxTemp');
  if(temp){
    const raw=String(temp.value||'').trim();
    draft.temperature=raw===''?null:Number(raw);
  }
}
function fillAreas(){
  const note=$('entryNote');
  if(note)note.value=draft.note||'';
  const dreams=$('entryDreams');
  if(dreams)dreams.value=draft.dreams||'';
  (draft.sections||[]).forEach(s=>{
    const area=document.querySelector(`[data-section-text="${s.id}"]`);
    if(area)area.value=s.text||'';
  });
  if(focusSectionId){
    const name=document.querySelector(`[data-section-name="${focusSectionId}"]`);
    if(name)name.focus();
    focusSectionId=null;
  }
}
function updateTimerReadout(){
  readDraft();
  const out=$('timerDuration');
  if(!out)return;
  const label=formatDuration(entryMinutes(draft))||'—';
  out.textContent=label;
  if(label==='—')out.removeAttribute('data-duration');
  else out.setAttribute('data-duration',label);
}
function select(k){
  readGoalNotes();
  readRelSections();
  if(openPerson)save();
  if($('entryForm'))readDraft();
  const changing=k!==sel;
  if(changing&&!editingId&&!tempTouched)draft.temperature=null;
  if(changing&&openGoal){
    abandonNewImages();
    goalEditingId=null;
    tagEdit=false;
    renamingTag=null;
    freshDraft(null);
    pendingTag='';
  }
  if(changing&&openCat){
    mealPicker=null;
    mealRenaming=null;
    listRenaming=null;
    listItemRenaming=null;
    pickIds.clear();
    resetShiftUi();
  resetFlowUi();
  }
  sel=k;view=parse(k);picker=false;render();
}
function shift(n){const d=parse(sel);d.setDate(d.getDate()+n);select(key(d))}
function openCategory(id){
  readGoalNotes();
  abandonNewImages();
  openGoal=null;
  placeEditing=false;
  placeQuery='';
  placeResults=[];
  placeStatus='';
  openCat=id;
  editingId=null;
  tagEdit=false;
  renamingTag=null;
  clearSectionTagUi();
  resetListUi();
  resetShiftUi();
  resetFlowUi();
  resetRelUi();
  resetRecordUi();
  picker=false;
  focusTitle=true;
  freshDraft(catById(id));
  render();
}
function closeCategory(){
  abandonNewImages();
  placeEditing=false;
  placeQuery='';
  placeResults=[];
  placeStatus='';
  openCat=null;
  editingId=null;
  tagEdit=false;
  renamingTag=null;
  clearSectionTagUi();
  resetListUi();
  resetShiftUi();
  resetFlowUi();
  abandonRelImages();
  resetRelUi();
  resetRecordUi();
  picker=false;
  freshDraft(null);
  render();
}
function editEntry(e){
  abandonNewImages();
  openCat=e.categoryId;
  editingId=e.id;
  draft=typeOf(catById(e.categoryId)).fromEntry(e);
  tempTouched=true;
  pendingTag='';
  tagEdit=false;
  renamingTag=null;
  clearSectionTagUi();
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
    clearSectionTagUi();
    freshDraft(currentCat());
  }
  save();
  forgetImages(ids);
  render();
}
function deleteCategory(c){
  const noun=c.type==='relationships'?'people':c.type==='record'?'records':'entries';
  if(!confirm(`Delete category "${c.name}" and its ${noun}?`))return;
  const ids=state.entries.filter(e=>e.categoryId===c.id).flatMap(e=>e.images||[]);
  (c.people||[]).forEach(p=>{
    if(p.photoId)ids.push(p.photoId);
    (p.notes||[]).forEach(n=>(n.images||[]).forEach(id=>ids.push(id)));
  });
  (c.records||[]).forEach(r=>(r.images||[]).forEach(id=>ids.push(id)));
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
  const field=$('newTag');
  if(field)field.value='';
  const cat=currentCat();
  if(!cat||!name){keepField('#newTag');return}
  if(!cat.tags.some(t=>same(t,name)))cat.tags.push(name);
  const canonical=cat.tags.find(t=>same(t,name));
  if(canonical&&!draft.tags.some(t=>same(t,canonical)))draft.tags.push(canonical);
  save();
  render();
  keepField('#newTag');
}
function deleteTag(name){
  readDraft();
  const cat=currentCat();
  if(!cat)return;
  cat.tags=cat.tags.filter(t=>!same(t,name));
  state.entries.forEach(e=>{if(e.categoryId===cat.id)e.tags=(e.tags||[]).filter(t=>!same(t,name))});
  (cat.records||[]).forEach(r=>{r.tags=(r.tags||[]).filter(t=>!same(t,name))});
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
  (cat.records||[]).forEach(r=>{r.tags=rewrite(r.tags)});
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
  clearSectionTagUi();
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
  const heading=type.id==='weather'?(weatherCustomTitle(e)||weatherHeading(e)):(e.title||'Untitled');
  return h('article',{class:'entry-card'+(editing?' editing':''),'data-entry':e.id,onclick:ev=>{
    if(ev.target.closest('button'))return;
    editEntry(e);
  }},
    h('div',{class:'row top-row'},h('strong',null,heading),h('span',{class:'muted sm'},fmt(e.date))),
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
function readAmount(raw){
  const s=String(raw==null?'':raw).trim();
  if(!s)return null;
  const n=Number(s);
  return Number.isFinite(n)?n:null;
}
function formatAmount(n){
  const v=Number(n);
  if(!Number.isFinite(v))return '0';
  return v.toLocaleString('en-US',{maximumFractionDigits:2});
}
function amountSum(items){
  return (items||[]).reduce((n,it)=>n+(Number.isFinite(Number(it&&it.amount))?Number(it.amount):0),0);
}
function normalizeShopList(list){
  const copy=Object.assign({},list);
  copy.id=typeof list.id==='string'&&list.id?list.id:uid();
  copy.name=typeof list.name==='string'?list.name:'';
  copy.items=(Array.isArray(list.items)?list.items:[]).filter(it=>it&&typeof it==='object').map(it=>{
    const item=Object.assign({},it);
    item.id=typeof it.id==='string'&&it.id?it.id:uid();
    item.text=typeof it.text==='string'?it.text:(typeof it.name==='string'?it.name:'');
    item.amount=readAmount(it.amount);
    item.checked=it.checked===true;
    return item;
  });
  return copy;
}
function normalizeMeal(meal){
  const copy=Object.assign({},meal);
  copy.id=typeof meal.id==='string'&&meal.id?meal.id:uid();
  copy.name=typeof meal.name==='string'?meal.name:'';
  copy.items=(Array.isArray(meal.items)?meal.items:[]).filter(it=>it&&typeof it==='object').map(it=>{
    const item=Object.assign({},it);
    item.id=typeof it.id==='string'&&it.id?it.id:uid();
    item.sourceId=typeof it.sourceId==='string'?it.sourceId:'';
    item.text=typeof it.text==='string'?it.text:'';
    item.amount=readAmount(it.amount);
    return item;
  });
  return copy;
}
function normalizeMeals(raw){
  const out={};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
  Object.keys(raw).forEach(k=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(k)||!Array.isArray(raw[k]))return;
    out[k]=raw[k].filter(m=>m&&typeof m==='object').map(normalizeMeal);
  });
  return out;
}
function resetListUi(){
  listNameEdit=false;
  listItemEdit=null;
  listRenaming=null;
  listItemRenaming=null;
  mealEdit=false;
  mealRenaming=null;
  mealPicker=null;
  pendingListName='';
  pendingMealName='';
  Object.keys(pendingListItems).forEach(k=>delete pendingListItems[k]);
  pickIds.clear();
}
function ensureLists(cat){
  if(!Array.isArray(cat.lists))cat.lists=[];
  if(!cat.meals||typeof cat.meals!=='object'||Array.isArray(cat.meals))cat.meals={};
  return cat;
}
function mealsOn(cat,date){
  const raw=cat&&cat.meals&&cat.meals[date];
  return Array.isArray(raw)?raw:[];
}
function ensureMeals(cat,date){
  ensureLists(cat);
  if(!Array.isArray(cat.meals[date]))cat.meals[date]=[];
  return cat.meals[date];
}
function mealDateKeys(){
  const dates=[];
  (state.categories||[]).forEach(c=>{
    if(!c||!c.meals||typeof c.meals!=='object')return;
    Object.keys(c.meals).forEach(k=>{if(Array.isArray(c.meals[k])&&c.meals[k].length)dates.push(k)});
  });
  return dates;
}
function findListItem(cat,itemId){
  for(const list of cat.lists||[]){
    const item=(list.items||[]).find(it=>it.id===itemId);
    if(item)return {list,item};
  }
  return null;
}
function touchEntry(){if($('entryForm'))readDraft()}
function addShopList(){
  touchEntry();
  const cat=currentCat();
  if(!cat)return;
  ensureLists(cat);
  const field=$('newList');
  const name=(field?field.value:pendingListName).trim();
  pendingListName='';
  if(field)field.value='';
  if(!name){keepField('#newList');return}
  cat.lists.push({id:uid(),name,items:[]});
  save();
  render();
  keepField('#newList');
}
function commitListRename(list,raw){
  if(listRenaming!==list.id)return;
  const name=String(raw||'').trim();
  listRenaming=null;
  if(name)list.name=name;
  save();
  render();
}
function removeShopList(listId){
  touchEntry();
  const cat=currentCat();
  if(!cat)return;
  cat.lists=(cat.lists||[]).filter(l=>l.id!==listId);
  if(listItemEdit===listId)listItemEdit=null;
  save();
  render();
}
function addShopItem(listId){
  touchEntry();
  const cat=currentCat();
  const list=cat&&(cat.lists||[]).find(l=>l.id===listId);
  const selector=`[data-new-item="${listId}"]`;
  const field=document.querySelector(selector);
  const name=(field?field.value:(pendingListItems[listId]||'')).trim();
  pendingListItems[listId]='';
  if(field)field.value='';
  if(!list||!name){keepField(selector);return}
  list.items=list.items||[];
  list.items.push({id:uid(),text:name,amount:null,checked:false});
  save();
  render();
  keepField(selector);
}
function toggleShopItem(listId,itemId){
  touchEntry();
  const cat=currentCat();
  const list=cat&&(cat.lists||[]).find(l=>l.id===listId);
  const item=list&&(list.items||[]).find(it=>it.id===itemId);
  if(!item)return;
  item.checked=!item.checked;
  save();
  render();
}
function setShopAmount(listId,itemId,raw){
  const cat=currentCat();
  const list=cat&&(cat.lists||[]).find(l=>l.id===listId);
  const item=list&&(list.items||[]).find(it=>it.id===itemId);
  if(!item)return;
  item.amount=readAmount(raw);
  save();
}
function commitShopItemRename(list,item,raw){
  if(listItemRenaming!==item.id)return;
  const name=String(raw||'').trim();
  listItemRenaming=null;
  if(name)item.text=name;
  save();
  render();
}
function moveShopItem(listId,itemId,dir){
  touchEntry();
  const cat=currentCat();
  const list=cat&&(cat.lists||[]).find(l=>l.id===listId);
  if(!list)return;
  const items=list.items||[];
  const i=items.findIndex(it=>it.id===itemId);
  const j=i+dir;
  if(i<0||j<0||j>=items.length)return;
  const swap=items[i];
  items[i]=items[j];
  items[j]=swap;
  save();
  render();
}
function removeShopItem(listId,itemId){
  touchEntry();
  const cat=currentCat();
  const list=cat&&(cat.lists||[]).find(l=>l.id===listId);
  if(!list)return;
  list.items=(list.items||[]).filter(it=>it.id!==itemId);
  if(listItemRenaming===itemId)listItemRenaming=null;
  save();
  render();
}
function clearChecked(listId){
  touchEntry();
  const cat=currentCat();
  const list=cat&&(cat.lists||[]).find(l=>l.id===listId);
  if(!list)return;
  (list.items||[]).forEach(it=>{it.checked=false});
  save();
  render();
}
function addMeal(){
  touchEntry();
  const cat=currentCat();
  if(!cat)return;
  const field=$('newMeal');
  const name=(field?field.value:pendingMealName).trim();
  pendingMealName='';
  if(field)field.value='';
  if(!name){keepField('#newMeal');return}
  ensureMeals(cat,sel).push({id:uid(),name,items:[]});
  save();
  render();
  keepField('#newMeal');
}
function commitMealRename(meal,raw){
  if(mealRenaming!==meal.id)return;
  const name=String(raw||'').trim();
  mealRenaming=null;
  if(name)meal.name=name;
  save();
  render();
}
function removeMeal(mealId){
  touchEntry();
  const cat=currentCat();
  if(!cat)return;
  const meals=ensureMeals(cat,sel);
  const i=meals.findIndex(m=>m.id===mealId);
  if(i>=0)meals.splice(i,1);
  if(!meals.length)delete cat.meals[sel];
  if(mealPicker===mealId){mealPicker=null;pickIds.clear()}
  save();
  render();
}
function moveMeal(mealId,dir){
  touchEntry();
  const cat=currentCat();
  if(!cat)return;
  const meals=ensureMeals(cat,sel);
  const i=meals.findIndex(m=>m.id===mealId);
  const j=i+dir;
  if(i<0||j<0||j>=meals.length)return;
  const swap=meals[i];
  meals[i]=meals[j];
  meals[j]=swap;
  save();
  render();
}
function removeMealItem(mealId,itemId){
  touchEntry();
  const cat=currentCat();
  const meal=cat&&mealsOn(cat,sel).find(m=>m.id===mealId);
  if(!meal)return;
  meal.items=(meal.items||[]).filter(it=>it.id!==itemId);
  save();
  render();
}
function toggleMealPicker(mealId){
  touchEntry();
  if(mealPicker===mealId){mealPicker=null;pickIds.clear()}
  else{mealPicker=mealId;pickIds.clear()}
  render();
}
function togglePick(itemId){
  touchEntry();
  if(pickIds.has(itemId))pickIds.delete(itemId);else pickIds.add(itemId);
  render();
}
function addPicked(mealId){
  touchEntry();
  const cat=currentCat();
  const meal=cat&&mealsOn(cat,sel).find(m=>m.id===mealId);
  if(!meal)return;
  meal.items=meal.items||[];
  const have=new Set(meal.items.map(it=>it.sourceId).filter(Boolean));
  pickIds.forEach(id=>{
    if(have.has(id))return;
    const found=findListItem(cat,id);
    if(!found)return;
    meal.items.push({id:uid(),sourceId:found.item.id,text:found.item.text,amount:found.item.amount});
    have.add(id);
  });
  mealPicker=null;
  pickIds.clear();
  save();
  render();
}
function shopItemRow(list,item,index,count){
  const editing=listItemEdit===list.id;
  const label=(item.text||'').trim()||'Item';
  let name;
  if(editing&&listItemRenaming===item.id){
    name=h('input',{class:'item-input','aria-label':`Rename ${label}`,value:item.text,
      onkeydown:ev=>{
        if(ev.key==='Enter'){ev.preventDefault();commitShopItemRename(list,item,ev.target.value)}
        if(ev.key==='Escape'){listItemRenaming=null;render()}
      },
      onblur:ev=>commitShopItemRename(list,item,ev.target.value)});
    setTimeout(()=>{name.focus();name.select()},0);
  }else if(editing){
    name=h('button',{type:'button',class:'item-text list-item-name',onclick:()=>{touchEntry();listItemRenaming=item.id;render()}},label);
  }else name=h('span',{class:'list-item-name'},label);
  const tools=editing?[
    h('button',{type:'button',class:'item-move','data-move':'up','aria-label':`Move ${label} up`,disabled:index===0,onclick:()=>moveShopItem(list.id,item.id,-1)},'↑'),
    h('button',{type:'button',class:'item-move','data-move':'down','aria-label':`Move ${label} down`,disabled:index===count-1,onclick:()=>moveShopItem(list.id,item.id,1)},'↓'),
    h('button',{type:'button',class:'item-x','aria-label':`Delete ${label}`,onclick:()=>removeShopItem(list.id,item.id)},'×')
  ]:[];
  return h('div',{class:'list-row','data-item':item.id,'data-checked':item.checked?'true':'false'},
    h('button',{type:'button',class:'check'+(item.checked?' on':''),'aria-pressed':item.checked?'true':'false','aria-label':`Check ${label}`,onclick:()=>toggleShopItem(list.id,item.id)},item.checked?'✓':''),
    name,
    h('input',{class:'field list-amount',type:'number',inputmode:'decimal',step:'any','aria-label':`Number for ${label}`,value:item.amount==null?'':String(item.amount),oninput:ev=>setShopAmount(list.id,item.id,ev.target.value)}),
    ...tools);
}
function listCard(list){
  const items=list.items||[];
  let title;
  if(listNameEdit&&listRenaming===list.id){
    title=h('input',{class:'item-input list-name-input','aria-label':`Rename ${list.name||'list'}`,value:list.name,
      onkeydown:ev=>{
        if(ev.key==='Enter'){ev.preventDefault();commitListRename(list,ev.target.value)}
        if(ev.key==='Escape'){listRenaming=null;render()}
      },
      onblur:ev=>commitListRename(list,ev.target.value)});
    setTimeout(()=>{title.focus();title.select()},0);
  }else if(listNameEdit){
    title=h('button',{type:'button',class:'list-name',onclick:()=>{touchEntry();listRenaming=list.id;render()}},list.name||'List');
  }else title=h('h3',{class:'list-name'},list.name||'List');
  return h('article',{class:'card list-card','data-list':list.id},
    h('div',{class:'row list-head'},
      title,
      listNameEdit?h('button',{type:'button',class:'item-x','aria-label':`Delete list ${list.name||'List'}`,onclick:()=>removeShopList(list.id)},'×'):null),
    items.length?items.map((item,index)=>shopItemRow(list,item,index,items.length)):h('p',{class:'muted sm'},'No items yet.'),
    h('div',{class:'tag-row'},
      h('input',{class:'field','data-new-item':list.id,value:pendingListItems[list.id]||'',placeholder:'New item','aria-label':`New item for ${list.name||'list'}`,autocomplete:'off',
        oninput:ev=>{pendingListItems[list.id]=ev.target.value},
        onkeydown:ev=>{if(ev.key==='Enter'){ev.preventDefault();addShopItem(list.id)}}}),
      h('button',{type:'button',class:'btn ghost','data-add-item':list.id,onclick:()=>addShopItem(list.id)},'Add'),
      h('button',{type:'button',class:listItemEdit===list.id?'btn':'btn ghost','data-edit-items':list.id,'aria-pressed':listItemEdit===list.id?'true':'false',onclick:()=>{
        touchEntry();
        listItemEdit=listItemEdit===list.id?null:list.id;
        if(listItemEdit!==list.id)listItemRenaming=null;
        render();
      }},listItemEdit===list.id?'Done':'Edit')),
    h('button',{type:'button',class:'btn ghost clear-checked','data-clear':list.id,onclick:()=>clearChecked(list.id)},'Clear checked'));
}
function listBoard(cat){
  ensureLists(cat);
  const lists=cat.lists;
  return h('div',{class:'list-board',id:'listBoard'},
    h('h2',{class:'block-heading'},'Lists'),
    h('div',{class:'card list-add'},
      h('div',{class:'tag-row'},
        h('input',{id:'newList',class:'field',value:pendingListName,placeholder:'New list','aria-label':'New list',autocomplete:'off',
          oninput:ev=>{pendingListName=ev.target.value},
          onkeydown:ev=>{if(ev.key==='Enter'){ev.preventDefault();addShopList()}}}),
        h('button',{type:'button',class:'btn ghost',id:'addList',onclick:addShopList},'Add list'),
        h('button',{type:'button',class:listNameEdit?'btn':'btn ghost',id:'editLists','aria-pressed':listNameEdit?'true':'false',onclick:()=>{
          touchEntry();
          listNameEdit=!listNameEdit;
          if(!listNameEdit)listRenaming=null;
          render();
        }},listNameEdit?'Done':'Edit'))),
    h('div',{class:'list-grid',id:'listGrid'},
      lists.length?lists.map(listCard):h('p',{class:'muted',id:'noLists'},'No lists yet.')));
}
function mealPickerPanel(cat,meal){
  const lists=(cat.lists||[]).filter(l=>(l.items||[]).length);
  return h('div',{class:'pick-panel','data-meal-pick':meal.id},
    lists.length?lists.map(list=>h('div',{class:'pick-group','data-pick-list':list.id},
      h('p',{class:'muted sm'},list.name||'List'),
      ...(list.items||[]).map(item=>{
        const on=pickIds.has(item.id);
        const num=item.amount==null?'':` ${formatAmount(item.amount)}`;
        return h('button',{type:'button',class:'pick-item'+(on?' on':''),'data-pick':item.id,'aria-pressed':on?'true':'false',onclick:()=>togglePick(item.id)},
          h('span',{class:'pick-box','aria-hidden':'true'},on?'✓':''),(item.text||'Item')+num);
      }))):h('p',{class:'muted sm'},'No list items yet.'),
    h('div',{class:'actions'},
      h('button',{type:'button',class:'btn',id:'addPicked',onclick:()=>addPicked(meal.id)},'Add selected'),
      h('button',{type:'button',class:'btn ghost',onclick:()=>toggleMealPicker(meal.id)},'Cancel')));
}
function mealCard(cat,meal,index,count){
  const items=meal.items||[];
  let title;
  if(mealEdit&&mealRenaming===meal.id){
    title=h('input',{class:'item-input list-name-input','aria-label':`Rename ${meal.name||'meal'}`,value:meal.name,
      onkeydown:ev=>{
        if(ev.key==='Enter'){ev.preventDefault();commitMealRename(meal,ev.target.value)}
        if(ev.key==='Escape'){mealRenaming=null;render()}
      },
      onblur:ev=>commitMealRename(meal,ev.target.value)});
    setTimeout(()=>{title.focus();title.select()},0);
  }else if(mealEdit){
    title=h('button',{type:'button',class:'list-name',onclick:()=>{touchEntry();mealRenaming=meal.id;render()}},meal.name||'Meal');
  }else title=h('h3',{class:'list-name'},meal.name||'Meal');
  const tools=mealEdit?[
    h('button',{type:'button',class:'item-move','data-move':'up','aria-label':`Move ${meal.name||'meal'} up`,disabled:index===0,onclick:()=>moveMeal(meal.id,-1)},'↑'),
    h('button',{type:'button',class:'item-move','data-move':'down','aria-label':`Move ${meal.name||'meal'} down`,disabled:index===count-1,onclick:()=>moveMeal(meal.id,1)},'↓'),
    h('button',{type:'button',class:'item-x','aria-label':`Delete meal ${meal.name||'Meal'}`,onclick:()=>removeMeal(meal.id)},'×')
  ]:[];
  return h('article',{class:'card meal-card','data-meal':meal.id},
    h('div',{class:'row list-head'},title,...tools),
    items.length?items.map(it=>h('div',{class:'meal-line','data-meal-item':it.id},
      h('span',{class:'meal-line-text'},(it.text||'').trim()||'Item'),
      it.amount!=null?h('span',{class:'meal-line-num'},formatAmount(it.amount)):null,
      h('button',{type:'button',class:'item-x','aria-label':`Remove ${(it.text||'item')}`,onclick:()=>removeMealItem(meal.id,it.id)},'×'))):h('p',{class:'muted sm'},'Nothing added yet.'),
    h('p',{class:'meal-total'},`Total ${formatAmount(amountSum(items))}`),
    h('button',{type:'button',class:'btn ghost','data-add-from':meal.id,onclick:()=>toggleMealPicker(meal.id)},mealPicker===meal.id?'Close lists':'Add from lists'),
    mealPicker===meal.id?mealPickerPanel(cat,meal):null);
}
function mealBoard(cat){
  const meals=mealsOn(cat,sel);
  return h('div',{class:'meal-board',id:'mealBoard'},
    h('h2',{class:'block-heading'},'Meals'),
    h('div',{class:'card list-add'},
      h('div',{class:'tag-row'},
        h('input',{id:'newMeal',class:'field',value:pendingMealName,placeholder:'New meal','aria-label':'New meal',autocomplete:'off',
          oninput:ev=>{pendingMealName=ev.target.value},
          onkeydown:ev=>{if(ev.key==='Enter'){ev.preventDefault();addMeal()}}}),
        h('button',{type:'button',class:'btn ghost',id:'addMeal',onclick:addMeal},'Add meal'),
        h('button',{type:'button',class:mealEdit?'btn':'btn ghost',id:'editMeals','aria-pressed':mealEdit?'true':'false',onclick:()=>{
          touchEntry();
          mealEdit=!mealEdit;
          if(!mealEdit)mealRenaming=null;
          render();
        }},mealEdit?'Done':'Edit'))),
    meals.length?h('div',{class:'meal-grid',id:'mealGrid'},...meals.map((meal,index)=>mealCard(cat,meal,index,meals.length))):h('p',{class:'muted',id:'noMeals'},'No meals for this day.'),
    meals.length?h('p',{class:'card day-total',id:'dayTotal'},`Day total ${formatAmount(amountSum(meals.flatMap(m=>m.items||[])))}`):null);
}
function mealReview(cat,date){
  const meals=mealsOn(cat,date);
  if(!meals.length)return null;
  return h('div',{class:'day-meals','data-meals':date},
    ...meals.map(m=>h('div',{class:'day-meal','data-meal':m.id},
      h('p',{class:'day-meal-name'},m.name||'Meal'),
      ...(m.items||[]).map(it=>h('p',{class:'day-meal-item'},it.amount!=null?`${(it.text||'Item')} · ${formatAmount(it.amount)}`:(it.text||'Item'))),
      h('p',{class:'meal-total'},`Total ${formatAmount(amountSum(m.items))}`))),
    h('p',{class:'day-total'},`Day total ${formatAmount(amountSum(meals.flatMap(m=>m.items||[])))}`));
}
function listHomeBits(cat){
  const lists=(cat.lists||[]).map(list=>{
    const n=(list.items||[]).length;
    return h('p',{class:'home-list','data-list':list.id},`${list.name||'List'} · ${n} item${n===1?'':'s'}`);
  });
  const meals=mealsOn(cat,sel);
  const lines=meals.map(m=>h('p',{class:'home-meal','data-meal':m.id},`${m.name||'Meal'} · Total ${formatAmount(amountSum(m.items))}`));
  const day=meals.length?h('p',{class:'home-day-total',id:'homeDayTotal'},`Day total ${formatAmount(amountSum(meals.flatMap(m=>m.items||[])))}`):null;
  return [...lists,...lines,day];
}
function cleanTime(v){
  const m=/^(\d{2}):(\d{2})$/.exec(String(v||'').trim());
  if(!m)return '';
  const hh=Number(m[1]),mm=Number(m[2]);
  if(hh>23||mm>59)return '';
  return `${m[1]}:${m[2]}`;
}
function blankShift(){return {start:'',end:'',breakMin:'',label:''}}
function normalizeShift(sh){
  const copy=Object.assign({},sh);
  copy.id=typeof sh.id==='string'&&sh.id?sh.id:uid();
  copy.start=cleanTime(sh.start);
  copy.end=cleanTime(sh.end);
  const b=sh.breakMinutes;
  copy.breakMinutes=b==null||b===''||!Number.isFinite(Number(b))||Number(b)<0?null:Math.round(Number(b));
  copy.label=typeof sh.label==='string'?sh.label:'';
  return copy;
}
function normalizeShifts(raw){
  const out={};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
  Object.keys(raw).forEach(k=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(k)||!Array.isArray(raw[k]))return;
    const list=raw[k].filter(s=>s&&typeof s==='object').map(normalizeShift).filter(s=>s.start&&s.end);
    if(list.length)out[k]=list;
  });
  return out;
}
function normalizeFlowOption(raw){
  const copy=Object.assign({},raw||{});
  copy.id=typeof raw.id==='string'&&raw.id?raw.id:uid();
  copy.name=typeof raw.name==='string'?raw.name:'';
  copy.color=hexOf(raw.color,'#2f5d45');
  copy.shape=FLOW_SHAPES.includes(raw.shape)?raw.shape:'dot';
  return copy;
}
function normalizeFlowLogs(raw,ids){
  const out={};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
  Object.keys(raw).forEach(date=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
    const value=raw[date];
    let list=[];
    if(typeof value==='string'){
      if(ids.has(value))list=[{id:uid(),optionId:value,time:''}];
    }else if(Array.isArray(value)){
      list=value.filter(x=>x&&typeof x==='object').map(x=>{
        const item=Object.assign({},x);
        item.id=typeof x.id==='string'&&x.id?x.id:uid();
        item.optionId=typeof x.optionId==='string'?x.optionId:'';
        item.time=cleanTime(x.time||'');
        return item;
      }).filter(x=>ids.has(x.optionId));
    }
    if(list.length)out[date]=list;
  });
  return out;
}
function legacyPeriodOptions(){
  return FLOW_IDS.map(id=>({id,name:FLOW_LABEL[id],color:PERIOD_SHADES[id],shape:'dot'}));
}
function normalizeTracker(c){
  const wasPeriod=c.tracker==='period';
  if(wasPeriod)c.tracker='flow';
  else if(c.tracker!=='flow')c.tracker='shifts';
  c.shifts=normalizeShifts(c.shifts);
  if(c.tracker!=='flow')return;
  const legacy=c.flow&&typeof c.flow==='object'&&!Array.isArray(c.flow)&&Object.keys(c.flow).some(k=>typeof c.flow[k]==='string');
  let options=Array.isArray(c.flowOptions)?c.flowOptions.filter(o=>o&&typeof o==='object').map(normalizeFlowOption):[];
  if((wasPeriod||legacy)&&!options.length)options=legacyPeriodOptions();
  c.flowOptions=options;
  c.flow=normalizeFlowLogs(c.flow,new Set(options.map(o=>o.id)));
  if(wasPeriod)c.showCycle=true;
  else if(c.showCycle!==true)c.showCycle=false;
}
const FLOW_PATH={
  heart:'M6 10.4S1.6 7.7 1.6 4.9C1.6 3.2 2.9 2.1 4.3 2.1c.8 0 1.4.4 1.7.9.3-.5.9-.9 1.7-.9 1.4 0 2.7 1.1 2.7 2.8 0 2.8-4.4 5.5-4.4 5.5z',
  star:'M6 1.15l1.38 2.95 3.2.38-2.38 2.2.64 3.2L6 8.3 3.16 9.88l.64-3.2L1.42 4.48l3.2-.38L6 1.15z'
};
function flowMark(option){
  const shape=FLOW_SHAPES.includes(option&&option.shape)?option.shape:'dot';
  const color=hexOf(option&&option.color,'#2f5d45');
  const el=h('span',{class:'flow-icon','data-shape':shape,style:'--flow:'+color,'aria-hidden':'true'});
  if(shape==='heart'||shape==='star'){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 12 12');
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',FLOW_PATH[shape]);
    path.setAttribute('fill','currentColor');
    svg.append(path);
    el.append(svg);
  }
  return el;
}
function resetShiftUi(){
  shiftEditing=null;
  shiftDraft=blankShift();
  skipShiftRead=true;
}
function readShiftDraft(){
  const s=$('shiftStart');
  if(!s)return;
  shiftDraft.start=s.value;
  const e=$('shiftEnd');
  if(e)shiftDraft.end=e.value;
  const b=$('shiftBreak');
  if(b)shiftDraft.breakMin=b.value;
  const l=$('shiftLabel');
  if(l)shiftDraft.label=l.value;
}
function shiftsOn(cat,date){
  const raw=cat&&cat.shifts&&cat.shifts[date];
  return Array.isArray(raw)?raw:[];
}
function ensureShifts(cat,date){
  if(!cat.shifts||typeof cat.shifts!=='object'||Array.isArray(cat.shifts))cat.shifts={};
  if(!Array.isArray(cat.shifts[date]))cat.shifts[date]=[];
  return cat.shifts[date];
}
function flowLogsOn(cat,date){
  const raw=cat&&cat.flow&&cat.flow[date];
  return Array.isArray(raw)?raw:[];
}
function flowOptionById(cat,id){return (cat&&cat.flowOptions||[]).find(o=>o.id===id)||null}
function flowSummary(cat,date){
  const groups=[];
  flowLogsOn(cat,date).forEach(log=>{
    const option=flowOptionById(cat,log.optionId);
    if(!option)return;
    let group=groups.find(g=>g.option.id===option.id);
    if(!group){group={option,count:0,times:[]};groups.push(group)}
    group.count+=1;
    if(log.time)group.times.push(log.time);
  });
  return groups;
}
function flowDayLine(cat,date){
  const groups=flowSummary(cat,date);
  if(!groups.length)return null;
  const kids=[];
  groups.forEach((g,i)=>{
    if(i)kids.push(' · ');
    const label=(g.option.name||'Flow')+(g.count>1?` ×${g.count}`:'');
    const times=g.times.map(fmtClock).filter(Boolean);
    kids.push(h('span',{class:'flow-bit','data-option':g.option.id},flowMark(g.option),' ',times.length?`${label} · ${times.join(', ')}`:label));
  });
  return h('p',{class:'flow-line','data-flow':groups.map(g=>g.option.id).join(' ')},...kids);
}
function flowCalendarIcons(cat,date){
  const groups=flowSummary(cat,date);
  if(!groups.length)return null;
  const shown=groups.slice(0,3);
  const extra=groups.length-shown.length;
  return h('span',{class:'flow-icons','aria-hidden':'true'},...shown.map(g=>flowMark(g.option)),extra?h('span',{class:'flow-more'},'+'+extra):null);
}
function trackerDateKeys(){
  const dates=[];
  (state.categories||[]).forEach(c=>{
    if(!c||c.type!=='tracker')return;
    const shifts=c.shifts&&typeof c.shifts==='object'?c.shifts:{};
    Object.keys(shifts).forEach(k=>{if(Array.isArray(shifts[k])&&shifts[k].length)dates.push(k)});
    const flow=c.flow&&typeof c.flow==='object'?c.flow:{};
    Object.keys(flow).forEach(k=>{if(Array.isArray(flow[k])&&flow[k].length)dates.push(k)});
  });
  return dates;
}
function fmtClock(hhmm){
  const t=cleanTime(hhmm);
  if(!t)return '';
  const [hh,mm]=t.split(':').map(Number);
  return new Date(2000,0,1,hh,mm).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
}
function shiftMinutes(sh){
  const start=cleanTime(sh&&sh.start),end=cleanTime(sh&&sh.end);
  if(!start||!end)return 0;
  const [ah,am]=start.split(':').map(Number);
  const [bh,bm]=end.split(':').map(Number);
  let mins=(bh*60+bm)-(ah*60+am);
  if(end<start)mins+=24*60;
  const br=sh.breakMinutes==null?0:Math.max(0,Math.round(Number(sh.breakMinutes)||0));
  return Math.max(0,mins-br);
}
function formatHours(mins){
  const m=Math.max(0,Math.round(Number(mins)||0));
  const h=Math.round((m/60)*100)/100;
  const text=Number.isInteger(h)?String(h):String(h);
  return `${text}h`;
}
function dayShiftMinutes(cat,date){
  return shiftsOn(cat,date).reduce((n,s)=>n+shiftMinutes(s),0);
}
function shiftWhen(sh){
  const bits=[`${fmtClock(sh.start)} – ${fmtClock(sh.end)}`];
  if(sh.breakMinutes)bits.push(`${sh.breakMinutes}m break`);
  if((sh.label||'').trim())bits.push(sh.label.trim());
  return bits.join(' · ');
}
function shortDate(k){
  return parse(k).toLocaleDateString('en-US',{month:'short',day:'numeric'});
}
function shiftDate(dateKey,n){
  const d=parse(dateKey);
  d.setDate(d.getDate()+n);
  return key(d);
}
function daySpan(a,b){
  return Math.round((parse(b).getTime()-parse(a).getTime())/86400000);
}
function formatDayCount(n){
  const v=Math.round(Number(n)*10)/10;
  const text=Number.isInteger(v)?String(v):v.toFixed(1);
  return `${text} day${v===1?'':'s'}`;
}
function periodRuns(cat){
  const flow=cat&&cat.flow&&typeof cat.flow==='object'?cat.flow:{};
  const days=Object.keys(flow).filter(k=>Array.isArray(flow[k])&&flow[k].length&&/^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  const runs=[];
  days.forEach(k=>{
    if(runs.length&&shiftDate(runs[runs.length-1].end,1)===k){
      const run=runs[runs.length-1];
      run.end=k;
      run.length+=1;
    }else runs.push({start:k,end:k,length:1});
  });
  const today=key(new Date());
  runs.forEach(run=>{run.complete=run.end<today});
  return runs;
}
function cycleMedian(nums){
  const s=[...nums].sort((a,b)=>a-b);
  const mid=Math.floor(s.length/2);
  if(!s.length)return 0;
  return s.length%2?s[mid]:(s[mid-1]+s[mid])/2;
}
function keptCycleLengths(lengths){
  if(lengths.length<2)return {kept:lengths.slice(),ignored:0};
  const mid=cycleMedian(lengths);
  const kept=[];
  lengths.forEach(n=>{
    const short=n<15;
    const long=n>45||n>mid*1.6;
    if(!short&&!long)kept.push(n);
  });
  if(!kept.length)return {kept:lengths.slice(),ignored:0};
  return {kept,ignored:lengths.length-kept.length};
}
function cycleStats(cat,date){
  const runs=periodRuns(cat);
  const starts=runs.map(r=>r.start);
  const prior=starts.filter(s=>s<=date);
  const last=prior.length?prior[prior.length-1]:'';
  const lengths=[];
  for(let i=1;i<starts.length;i++)lengths.push(daySpan(starts[i-1],starts[i]));
  const filtered=keptCycleLengths(lengths);
  const avgCycle=filtered.kept.length?filtered.kept.reduce((a,b)=>a+b,0)/filtered.kept.length:null;
  const done=runs.filter(r=>r.complete);
  const avgPeriod=done.length?done.reduce((a,r)=>a+r.length,0)/done.length:null;
  const predict=filtered.kept.length>=2?shiftDate(starts[starts.length-1],Math.round(avgCycle)):'';
  return {cycleDay:last?daySpan(last,date)+1:null,last,avgCycle,avgPeriod,predict,ignored:filtered.ignored};
}
function weeksInView(viewDate){
  const y=viewDate.getFullYear(),m=viewDate.getMonth();
  const first=new Date(y,m,1);
  const cursor=new Date(y,m,1-first.getDay());
  const last=new Date(y,m+1,0);
  const weeks=[];
  while(cursor<=last){
    const days=[];
    for(let i=0;i<7;i++)days.push(key(new Date(cursor.getFullYear(),cursor.getMonth(),cursor.getDate()+i)));
    weeks.push(days);
    cursor.setDate(cursor.getDate()+7);
  }
  return weeks;
}
function monthShiftMinutes(cat,viewDate){
  const prefix=`${viewDate.getFullYear()}-${pad(viewDate.getMonth()+1)}`;
  return Object.keys(cat.shifts||{}).filter(k=>k.startsWith(prefix)).reduce((n,k)=>n+dayShiftMinutes(cat,k),0);
}
function commitShift(){
  readShiftDraft();
  touchEntry();
  const cat=currentCat();
  if(!cat)return;
  const start=cleanTime(shiftDraft.start),end=cleanTime(shiftDraft.end);
  if(!start||!end){keepField(start?'#shiftEnd':'#shiftStart');return}
  const raw=String(shiftDraft.breakMin||'').trim();
  let breakMinutes=null;
  if(raw!==''){
    const n=Number(raw);
    if(!Number.isFinite(n)||n<0){keepField('#shiftBreak');return}
    breakMinutes=Math.round(n);
  }
  const label=String(shiftDraft.label||'').trim();
  const list=ensureShifts(cat,sel);
  if(shiftEditing){
    const sh=list.find(s=>s.id===shiftEditing);
    if(sh){sh.start=start;sh.end=end;sh.breakMinutes=breakMinutes;sh.label=label}
    shiftEditing=null;
  }else list.push({id:uid(),start,end,breakMinutes,label});
  shiftDraft=blankShift();
  skipShiftRead=true;
  save();
  render();
  keepField('#shiftStart');
}
function beginShiftEdit(id){
  touchEntry();
  const sh=shiftsOn(currentCat(),sel).find(s=>s.id===id);
  if(!sh)return;
  shiftEditing=id;
  shiftDraft={start:sh.start,end:sh.end,breakMin:sh.breakMinutes==null?'':String(sh.breakMinutes),label:sh.label||''};
  skipShiftRead=true;
  render();
  keepField('#shiftStart');
}
function cancelShiftEdit(){
  touchEntry();
  shiftEditing=null;
  shiftDraft=blankShift();
  skipShiftRead=true;
  render();
}
function removeShift(id){
  touchEntry();
  const cat=currentCat();
  if(!cat||!cat.shifts)return;
  const list=shiftsOn(cat,sel).filter(s=>s.id!==id);
  if(list.length)cat.shifts[sel]=list;
  else delete cat.shifts[sel];
  if(shiftEditing===id){shiftEditing=null;shiftDraft=blankShift();skipShiftRead=true}
  save();
  render();
}
function resetFlowUi(){
  flowEdit=false;
  flowRenaming=null;
  pendingFlowName='';
}
function ensureFlow(cat){
  if(!Array.isArray(cat.flowOptions))cat.flowOptions=[];
  if(!cat.flow||typeof cat.flow!=='object'||Array.isArray(cat.flow))cat.flow={};
  return cat;
}
function logFlow(optionId){
  touchEntry();
  const cat=currentCat();
  if(!cat||!flowOptionById(cat,optionId))return;
  ensureFlow(cat);
  if(!Array.isArray(cat.flow[sel]))cat.flow[sel]=[];
  cat.flow[sel].push({id:uid(),optionId,time:''});
  save();
  render();
}
function setFlowTime(id,value){
  const cat=currentCat();
  const log=flowLogsOn(cat,sel).find(l=>l.id===id);
  if(!log)return;
  log.time=cleanTime(value);
  save();
}
function removeFlowLog(id){
  touchEntry();
  const cat=currentCat();
  if(!cat)return;
  const list=flowLogsOn(cat,sel).filter(l=>l.id!==id);
  if(list.length)cat.flow[sel]=list;
  else delete cat.flow[sel];
  save();
  render();
}
function addFlowOption(){
  touchEntry();
  const cat=currentCat();
  if(!cat)return;
  ensureFlow(cat);
  const field=$('newFlowOption');
  const name=(field?field.value:pendingFlowName).trim();
  pendingFlowName='';
  if(field)field.value='';
  if(!name){keepField('#newFlowOption');return}
  cat.flowOptions.push({id:uid(),name,color:FLOW_PALETTE[cat.flowOptions.length%FLOW_PALETTE.length],shape:'dot'});
  save();
  render();
  keepField('#newFlowOption');
}
function commitFlowRename(opt,raw){
  if(flowRenaming!==opt.id)return;
  const name=String(raw||'').trim();
  flowRenaming=null;
  if(name)opt.name=name;
  save();
  render();
}
function removeFlowOption(id){
  touchEntry();
  const cat=currentCat();
  if(!cat)return;
  cat.flowOptions=(cat.flowOptions||[]).filter(o=>o.id!==id);
  Object.keys(cat.flow||{}).forEach(date=>{
    const list=flowLogsOn(cat,date).filter(l=>l.optionId!==id);
    if(list.length)cat.flow[date]=list;
    else delete cat.flow[date];
  });
  if(flowRenaming===id)flowRenaming=null;
  save();
  render();
}
function moveFlowOption(id,dir){
  touchEntry();
  const cat=currentCat();
  if(!cat)return;
  const list=cat.flowOptions||[];
  const i=list.findIndex(o=>o.id===id);
  const j=i+dir;
  if(i<0||j<0||j>=list.length)return;
  const swap=list[i];
  list[i]=list[j];
  list[j]=swap;
  save();
  render();
}
function setFlowColor(id,color,quiet){
  const cat=currentCat();
  const opt=cat&&flowOptionById(cat,id);
  if(!opt)return;
  opt.color=hexOf(color,opt.color);
  save();
  if(quiet){
    document.querySelectorAll(`[data-option="${id}"] .flow-icon`).forEach(el=>el.style.setProperty('--flow',opt.color));
    return;
  }
  render();
}
function setFlowShape(id,shape){
  touchEntry();
  const cat=currentCat();
  const opt=cat&&flowOptionById(cat,id);
  if(!opt||!FLOW_SHAPES.includes(shape))return;
  opt.shape=shape;
  save();
  render();
}
function setShowCycle(on){
  touchEntry();
  const cat=currentCat();
  if(!cat)return;
  cat.showCycle=!!on;
  save();
  render();
}
function trackCalendar(cat){
  const flow=cat.tracker==='flow';
  const stats=flow&&cat.showCycle?cycleStats(cat,sel):null;
  const today=key(new Date());
  const y=view.getFullYear(),m=view.getMonth(),first=new Date(y,m,1).getDay(),n=new Date(y,m+1,0).getDate();
  const cells=['S','M','T','W','T','F','S'].map(d=>h('div',{class:'dow'},d));
  for(let i=0;i<first;i++)cells.push(h('div'));
  for(let d=1;d<=n;d++){
    const k=`${y}-${pad(m+1)}-${pad(d)}`;
    const mins=flow?0:dayShiftMinutes(cat,k);
    const hours=mins?formatHours(mins):'';
    const icons=flow?flowCalendarIcons(cat,k):null;
    const names=flow?flowSummary(cat,k).map(g=>(g.option.name||'Flow')+(g.count>1?` ×${g.count}`:'')).join(', '):'';
    const predict=!!(stats&&stats.predict===k);
    const bits=[hours,names,predict?'predicted':''].filter(Boolean);
    cells.push(h('button',{
      type:'button','data-day':k,
      'data-hours':hours,
      'data-flow':names,
      'data-predict':predict?'true':'false',
      class:['track-day',k===sel&&'sel',k===today&&'today',predict&&'predict'].filter(Boolean).join(' '),
      'aria-label':[fmt(k),...bits].join(', '),
      onclick:()=>select(k)
    },
      h('span',{class:'track-num'},String(d)),
      !flow&&hours?h('span',{class:'track-mark','aria-hidden':'true'}):null,
      !flow&&hours?h('span',{class:'track-hrs'},hours):null,
      icons));
  }
  const weeks=cat.tracker==='shifts'?h('div',{class:'track-weeks',id:'weekTotals'},
    ...weeksInView(view).map(days=>{
      const mins=days.reduce((n,day)=>n+dayShiftMinutes(cat,day),0);
      return h('p',{class:'track-week','data-week':days[0],'data-minutes':String(mins)},
        h('span',null,shortDate(days[0])),
        h('span',{class:mins?'hrs':'muted'},formatHours(mins)));
    }),
    h('p',{class:'month-total',id:'monthTotal','data-minutes':String(monthShiftMinutes(cat,view))},
      h('span',null,view.toLocaleDateString('en-US',{month:'long'})),
      h('span',{class:'hrs'},formatHours(monthShiftMinutes(cat,view))))):null;
  return h('div',{class:'card track-card',id:'trackCal'},
    h('div',{class:'cal-head'},
      h('button',{type:'button',class:'circle',id:'trackPrev','aria-label':'Previous month',onclick:()=>{view=new Date(view.getFullYear(),view.getMonth()-1,1);picker=false;render()}},'‹'),
      h('div',{class:'center'},
        h('p',{class:'lg',id:'trackDay'},fmt(sel)),
        h('button',{type:'button',class:'month-btn',id:'trackMonth','aria-expanded':picker?'true':'false',onclick:()=>{picker=!picker;if(picker)pickerYear=view.getFullYear();render()}},view.toLocaleDateString('en-US',{month:'long',year:'numeric'}))),
      h('button',{type:'button',class:'circle',id:'trackNext','aria-label':'Next month',onclick:()=>{view=new Date(view.getFullYear(),view.getMonth()+1,1);picker=false;render()}},'›')),
    h('div',{class:'cal-nav'},
      h('button',{type:'button',id:'trackEarlier',onclick:()=>shift(-1)},'Earlier'),
      h('button',{type:'button',id:'trackToday',onclick:()=>select(key(new Date()))},'Today'),
      h('button',{type:'button',id:'trackLater',onclick:()=>shift(1)},'Later')),
    picker?h('div',{class:'picker',id:'trackPicker'},
      h('div',{class:'picker-year'},
        h('button',{type:'button',class:'circle','aria-label':'Previous year',onclick:()=>{pickerYear=Math.max(1,pickerYear-1);render()}},'‹'),
        h('input',{class:'year-input',type:'number',inputmode:'numeric','aria-label':'Year',value:String(pickerYear),min:'1',max:'9999',
          onchange:ev=>{
            const ny=Number(ev.target.value);
            if(Number.isInteger(ny)&&ny>=1&&ny<=9999)pickerYear=ny;
            render();
          }}),
        h('button',{type:'button',class:'circle','aria-label':'Next year',onclick:()=>{pickerYear=Math.min(9999,pickerYear+1);render()}},'›')),
      h('div',{class:'month-grid',role:'listbox','aria-label':'Choose a month'},...MONTHS.map((name,i)=>
        h('button',{type:'button',class:view.getFullYear()===pickerYear&&view.getMonth()===i?'month sel':'month','data-month':String(i),onclick:()=>{
          view=new Date(pickerYear,i,1);picker=false;render();
        }},name)))):null,
    h('div',{class:'track-split'},
      h('div',{class:'track-grid',id:'trackGrid'},...cells),
      weeks),
    flow&&cat.showCycle?cycleInfo(cat,sel):null);
}
function cycleInfo(cat,date){
  const s=cycleStats(cat,date);
  if(s.cycleDay==null&&!s.avgCycle&&s.avgPeriod==null&&!s.predict&&!s.ignored)return null;
  const bits=[];
  if(s.last)bits.push(`Last start ${shortDate(s.last)}`);
  if(s.avgCycle!=null)bits.push(`Cycle ${formatDayCount(s.avgCycle)}`);
  if(s.avgPeriod!=null)bits.push(`Logged ${formatDayCount(s.avgPeriod)}`);
  return h('div',{class:'cycle-info',id:'cycleInfo'},
    s.cycleDay!=null?h('p',{class:'cycle-day','data-cycle-day':String(s.cycleDay)},`Cycle day ${s.cycleDay}`):null,
    bits.length?h('p',{class:'muted sm cycle-meta'},bits.join(' · ')):null,
    s.predict?h('p',{class:'muted sm cycle-next','data-predict':s.predict},`Next start ${shortDate(s.predict)}`):null,
    s.ignored?h('p',{class:'muted sm cycle-skip','data-skipped':String(s.ignored)},`(${s.ignored} skipped cycle${s.ignored===1?'':'s'} ignored)`):null);
}
function shiftPanel(cat){
  const list=shiftsOn(cat,sel);
  const onKey=ev=>{if(ev.key==='Enter'){ev.preventDefault();commitShift()}};
  return h('div',{id:'shiftBoard'},
    h('h2',{class:'block-heading'},'Shifts'),
    h('div',{class:'card'},
      list.length?h('div',{class:'shift-list',id:'shiftList'},...list.map(sh=>h('div',{class:'shift-row','data-shift':sh.id,'data-minutes':String(shiftMinutes(sh))},
        h('div',{class:'shift-copy'},
          h('p',{class:'shift-when'},shiftWhen(sh)),
          h('p',{class:'accent sm shift-hours'},formatHours(shiftMinutes(sh)))),
        h('div',{class:'shift-tools'},
          h('button',{type:'button',class:'btn ghost',onclick:()=>beginShiftEdit(sh.id)},'Edit'),
          h('button',{type:'button',class:'item-x','aria-label':`Delete shift ${shiftWhen(sh)}`,onclick:()=>removeShift(sh.id)},'×'))))):h('p',{class:'muted sm',id:'noShifts'},'No shifts for this day.'),
      h('div',{class:'shift-form',id:'shiftForm'},
        h('div',{class:'sleep-times'},
          h('label',{class:'lbl'},'Start',h('input',{id:'shiftStart',class:'field',type:'time',value:shiftDraft.start,oninput:readShiftDraft,onkeydown:onKey})),
          h('label',{class:'lbl'},'End',h('input',{id:'shiftEnd',class:'field',type:'time',value:shiftDraft.end,oninput:readShiftDraft,onkeydown:onKey}))),
        h('div',{class:'sleep-times'},
          h('label',{class:'lbl'},'Unpaid break (minutes)',h('input',{id:'shiftBreak',class:'field',type:'number',min:'0',step:'1',inputmode:'numeric',value:shiftDraft.breakMin,placeholder:'Optional',oninput:readShiftDraft,onkeydown:onKey})),
          h('label',{class:'lbl'},'Label',h('input',{id:'shiftLabel',class:'field',value:shiftDraft.label,placeholder:'Role or location',autocomplete:'off',oninput:readShiftDraft,onkeydown:onKey}))),
        h('div',{class:'actions'},
          h('button',{type:'button',class:'btn',id:shiftEditing?'saveShift':'addShift',onclick:commitShift},shiftEditing?'Save shift':'Add shift'),
          shiftEditing?h('button',{type:'button',class:'btn ghost',id:'cancelShift',onclick:cancelShiftEdit},'Cancel'):null))));
}
function flowOptionRow(cat,opt,index,count){
  const logged=flowLogsOn(cat,sel).filter(l=>l.optionId===opt.id).length;
  let name;
  if(flowEdit&&flowRenaming===opt.id){
    name=h('input',{class:'item-input','aria-label':`Rename ${opt.name||'option'}`,value:opt.name,
      onkeydown:ev=>{
        if(ev.key==='Enter'){ev.preventDefault();commitFlowRename(opt,ev.target.value)}
        if(ev.key==='Escape'){flowRenaming=null;render()}
      },
      onblur:ev=>commitFlowRename(opt,ev.target.value)});
    setTimeout(()=>{name.focus();name.select()},0);
  }else if(flowEdit){
    name=h('button',{type:'button',class:'flow-opt-name',onclick:()=>{touchEntry();flowRenaming=opt.id;render()}},opt.name||'Option');
  }else{
    name=h('button',{type:'button',class:'flow-opt','data-option':opt.id,onclick:()=>logFlow(opt.id)},flowMark(opt),h('span',null,opt.name||'Option'));
  }
  return h('div',{class:'flow-option','data-option':opt.id},
    name,
    !flowEdit&&logged>1?h('span',{class:'flow-count','data-count':String(logged)},`×${logged}`):null,
    flowEdit?h('div',{class:'flow-palette'},
      ...FLOW_PALETTE.map(color=>h('button',{type:'button',class:'flow-swatch'+(opt.color.toLowerCase()===color.toLowerCase()?' on':''),style:'--flow:'+color,'aria-label':color,onclick:()=>setFlowColor(opt.id,color)})),
      h('input',{class:'flow-custom',type:'color','aria-label':`Custom colour for ${opt.name||'option'}`,value:opt.color,
        oninput:ev=>setFlowColor(opt.id,ev.target.value,true),
        onchange:ev=>setFlowColor(opt.id,ev.target.value)})):null,
    flowEdit?h('div',{class:'flow-shapes'},...FLOW_SHAPES.map(shape=>h('button',{
      type:'button',class:'flow-shape'+(opt.shape===shape?' on':''),'data-shape':shape,'aria-label':shape,'aria-pressed':opt.shape===shape?'true':'false',onclick:()=>setFlowShape(opt.id,shape)
    },flowMark({shape,color:opt.color})))):null,
    flowEdit?h('button',{type:'button',class:'item-move','data-move':'up','aria-label':`Move ${opt.name||'option'} up`,disabled:index===0,onclick:()=>moveFlowOption(opt.id,-1)},'↑'):null,
    flowEdit?h('button',{type:'button',class:'item-move','data-move':'down','aria-label':`Move ${opt.name||'option'} down`,disabled:index===count-1,onclick:()=>moveFlowOption(opt.id,1)},'↓'):null,
    flowEdit?h('button',{type:'button',class:'item-x','aria-label':`Delete ${opt.name||'option'}`,onclick:()=>removeFlowOption(opt.id)},'×'):null);
}
function flowLogRow(cat,log){
  const opt=flowOptionById(cat,log.optionId);
  if(!opt)return null;
  return h('div',{class:'flow-log','data-log':log.id},
    flowMark(opt),
    h('span',{class:'flow-log-name'},opt.name||'Option'),
    h('input',{class:'field flow-time',type:'time','aria-label':`Time for ${opt.name||'option'}`,value:log.time||'',oninput:ev=>setFlowTime(log.id,ev.target.value)}),
    h('button',{type:'button',class:'item-x','aria-label':`Remove ${opt.name||'option'}`,onclick:()=>removeFlowLog(log.id)},'×'));
}
function flowPanel(cat){
  ensureFlow(cat);
  const options=cat.flowOptions;
  const logs=flowLogsOn(cat,sel);
  return h('div',{id:'flowBoard'},
    h('h2',{class:'block-heading'},'Flow'),
    h('div',{class:'card'},
      options.length?h('div',{class:'flow-options',id:'flowOptions'},...options.map((opt,index)=>flowOptionRow(cat,opt,index,options.length))):h('p',{class:'muted sm',id:'noFlowOptions'},'No options yet.'),
      h('div',{class:'tag-row'},
        h('input',{id:'newFlowOption',class:'field',value:pendingFlowName,placeholder:'New option','aria-label':'New option',autocomplete:'off',
          oninput:ev=>{pendingFlowName=ev.target.value},
          onkeydown:ev=>{if(ev.key==='Enter'){ev.preventDefault();addFlowOption()}}}),
        h('button',{type:'button',class:'btn ghost',id:'addFlowOption',onclick:addFlowOption},'Add option'),
        h('button',{type:'button',class:flowEdit?'btn':'btn ghost',id:'editFlow','aria-pressed':flowEdit?'true':'false',onclick:()=>{
          touchEntry();
          flowEdit=!flowEdit;
          if(!flowEdit)flowRenaming=null;
          render();
        }},flowEdit?'Done':'Edit')),
      logs.length?h('div',{class:'flow-logs',id:'flowLogs'},...logs.map(log=>flowLogRow(cat,log))):h('p',{class:'muted sm',id:'noFlow'},'Nothing logged for this day.'),
      h('label',{class:'cycle-toggle'},
        h('input',{type:'checkbox',id:'showCycle',checked:!!cat.showCycle,onchange:ev=>setShowCycle(ev.target.checked)}),
        'Show cycle stats')));
}
function trackBoard(cat){
  return [trackCalendar(cat),cat.tracker==='flow'?flowPanel(cat):shiftPanel(cat)];
}
function trackerHomeBits(cat){
  if(cat.tracker==='flow'){
    const line=flowDayLine(cat,sel);
    const stats=cat.showCycle?cycleStats(cat,sel):null;
    return [
      line,
      stats&&stats.cycleDay!=null?h('p',{class:'muted sm cycle-day','data-cycle-day':String(stats.cycleDay)},`Cycle day ${stats.cycleDay}`):null
    ].filter(Boolean);
  }
  const lines=shiftsOn(cat,sel).map(sh=>h('div',{class:'home-shift','data-shift':sh.id},
    h('p',{class:'shift-when'},shiftWhen(sh)),
    h('p',{class:'accent sm shift-hours'},formatHours(shiftMinutes(sh)))));
  const week=weekDates(sel).reduce((n,day)=>n+dayShiftMinutes(cat,day),0);
  if(week)lines.push(h('p',{class:'muted sm home-week','data-week-hours':String(week)},`This week ${formatHours(week)}`));
  return lines;
}
function trackerReview(cat,date){
  if(cat.tracker==='flow'){
    const line=flowDayLine(cat,date);
    const stats=cat.showCycle?cycleStats(cat,date):null;
    if(!line&&!(stats&&stats.cycleDay!=null))return null;
    return h('div',{class:'day-track','data-track':date},
      line,
      stats&&stats.cycleDay!=null?h('p',{class:'muted sm cycle-day','data-cycle-day':String(stats.cycleDay)},`Cycle day ${stats.cycleDay}`):null);
  }
  const shifts=shiftsOn(cat,date);
  const week=weekDates(date).reduce((n,day)=>n+dayShiftMinutes(cat,day),0);
  if(!shifts.length&&!week)return null;
  return h('div',{class:'day-track','data-track':date},
    ...shifts.map(sh=>h('div',{class:'day-shift','data-shift':sh.id},
      h('p',{class:'shift-when'},shiftWhen(sh)),
      h('p',{class:'accent sm shift-hours'},formatHours(shiftMinutes(sh))))),
    week?h('p',{class:'muted sm home-week','data-week-hours':String(week)},`This week ${formatHours(week)}`):null);
}
function normalizeRelNote(note){
  const copy=Object.assign({},note);
  copy.id=typeof note.id==='string'&&note.id?note.id:uid();
  copy.date=/^\d{4}-\d{2}-\d{2}$/.test(note.date)?note.date:'';
  copy.title=typeof note.title==='string'?note.title:'';
  copy.note=typeof note.note==='string'?note.note:'';
  copy.tags=tagList(note.tags);
  copy.images=Array.isArray(note.images)?note.images.map(String):[];
  copy.createdAt=Number.isFinite(Number(note.createdAt))?Number(note.createdAt):Date.now();
  return copy;
}
function normalizeRelSection(section){
  const copy=Object.assign({},section);
  copy.id=typeof section.id==='string'&&section.id?section.id:uid();
  copy.name=typeof section.name==='string'?section.name:'';
  copy.text=typeof section.text==='string'?section.text:'';
  return copy;
}
function normalizePerson(person,groupIds){
  const copy=Object.assign({},person);
  copy.id=typeof person.id==='string'&&person.id?person.id:uid();
  copy.name=typeof person.name==='string'?person.name:'';
  copy.groupId=typeof person.groupId==='string'?person.groupId:'';
  if(groupIds&&groupIds.length&&!groupIds.includes(copy.groupId))copy.groupId=groupIds[0];
  copy.photoId=typeof person.photoId==='string'?person.photoId:'';
  copy.tags=tagList(person.tags);
  copy.noteTags=tagList(person.noteTags);
  copy.sections=(Array.isArray(person.sections)?person.sections:[]).filter(s=>s&&typeof s==='object').map(normalizeRelSection);
  copy.notes=(Array.isArray(person.notes)?person.notes:[]).filter(n=>n&&typeof n==='object').map(normalizeRelNote).filter(n=>n.date);
  return copy;
}
function normalizeRelationships(cat){
  const groups=(Array.isArray(cat.groups)?cat.groups:[]).filter(g=>g&&typeof g==='object').map(g=>{
    const copy=Object.assign({},g);
    copy.id=typeof g.id==='string'&&g.id?g.id:uid();
    copy.name=typeof g.name==='string'?g.name:'';
    return copy;
  });
  if(!groups.length)groups.push({id:uid(),name:'People'});
  const ids=groups.map(g=>g.id);
  const people=(Array.isArray(cat.people)?cat.people:[]).filter(p=>p&&typeof p==='object').map(p=>normalizePerson(p,ids));
  return {groups,people};
}
function blankRel(){return {title:'',note:'',tags:[],images:[]}}
function currentPerson(){
  const cat=currentCat();
  if(!cat||!openPerson)return null;
  return (cat.people||[]).find(p=>p.id===openPerson)||null;
}
function peopleIn(cat,groupId){return (cat.people||[]).filter(p=>p.groupId===groupId)}
function groupById(cat,id){return (cat.groups||[]).find(g=>g.id===id)||null}
function personInitial(name){
  const s=String(name||'').trim();
  return s?s.slice(0,1).toUpperCase():'?';
}
function avatar(person){
  if(person.photoId)return h('span',{class:'avatar','aria-hidden':'true'},h('img',{alt:'','data-src-id':person.photoId}));
  return h('span',{class:'avatar','aria-hidden':'true'},personInitial(person.name));
}
const MONTH_NAMES=['january','february','march','april','may','june','july','august','september','october','november','december'];
function monthIndex(word){
  const w=String(word||'').toLowerCase();
  const i=MONTH_NAMES.findIndex(n=>n===w||n.slice(0,3)===w);
  return i>=0?i+1:0;
}
function validMonthDay(month,day){
  if(month<1||month>12||day<1||day>31)return false;
  const dt=new Date(2024,month-1,day);
  return dt.getMonth()===month-1&&dt.getDate()===day;
}
function parseBirthday(text){
  const s=String(text||'').trim();
  if(!s)return null;
  let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(m&&validMonthDay(+m[2],+m[3]))return {month:+m[2],day:+m[3],year:+m[1]};
  m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?$/);
  if(m&&validMonthDay(+m[1],+m[2])){
    let year=null;
    if(m[3]){year=+m[3];if(year<100)year+=year>30?1900:2000}
    return {month:+m[1],day:+m[2],year};
  }
  m=s.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/);
  if(m){
    const month=monthIndex(m[1]);
    if(month&&validMonthDay(month,+m[2]))return {month,day:+m[2],year:m[3]?+m[3]:null};
  }
  m=s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:\s+(\d{4}))?$/);
  if(m){
    const month=monthIndex(m[2]);
    if(month&&validMonthDay(month,+m[1]))return {month,day:+m[1],year:m[3]?+m[3]:null};
  }
  return null;
}
function birthdayOf(person){
  const section=(person.sections||[]).find(s=>String(s.name||'').trim().toLowerCase()==='birthday'&&parseBirthday(s.text));
  return section?parseBirthday(section.text):null;
}
function birthdayHint(person,within){
  const parsed=birthdayOf(person);
  if(!parsed)return '';
  const today=new Date();
  today.setHours(0,0,0,0);
  let year=today.getFullYear();
  const nextOn=y=>{
    const dim=new Date(y,parsed.month,0).getDate();
    const day=Math.min(parsed.day,dim);
    return new Date(y,parsed.month-1,day);
  };
  let next=nextOn(year);
  if(next<today)next=nextOn(year+1);
  const days=Math.round((next.getTime()-today.getTime())/86400000);
  if(days>(within==null?14:within))return '';
  if(days===0)return 'Birthday today';
  if(days===1)return 'Birthday tomorrow';
  return `Birthday in ${days} days`;
}
function relNotesOn(cat,date){
  const out=[];
  (cat.people||[]).forEach(person=>{
    const group=groupById(cat,person.groupId);
    (person.notes||[]).forEach(note=>{
      if(note.date===date)out.push({person,group,note});
    });
  });
  out.sort((a,b)=>(b.note.createdAt||0)-(a.note.createdAt||0));
  return out;
}
function relDateKeys(){
  const dates=[];
  (state.categories||[]).forEach(c=>(c.people||[]).forEach(p=>(p.notes||[]).forEach(n=>{if(n&&n.date)dates.push(n.date)})));
  return dates;
}
function relNoteLabel(row){
  const title=(row.note.title||'').trim()||row.person.name||'Note';
  const group=row.group&&(row.group.name||'').trim();
  return group?`${title} · ${group}`:title;
}
function relHomeBits(cat){
  const lines=(cat.groups||[]).map(g=>{
    const n=peopleIn(cat,g.id).length;
    return h('p',{class:'muted sm home-group','data-group':g.id},`${g.name||'Group'} · ${n} ${n===1?'person':'people'}`);
  });
  relNotesOn(cat,sel).forEach(row=>{
    lines.push(h('p',{class:'rel-note-line','data-rel-note':row.note.id},relNoteLabel(row)));
  });
  (cat.people||[]).forEach(person=>{
    const hint=birthdayHint(person);
    if(hint)lines.push(h('p',{class:'muted sm bday-hint','data-person':person.id},`${person.name||'Someone'} · ${hint}`));
  });
  return lines;
}
function relReview(cat,date){
  const notes=relNotesOn(cat,date);
  if(!notes.length)return null;
  return h('div',{class:'day-rel','data-rel':date},...notes.map(row=>h('p',{class:'rel-note-line','data-rel-note':row.note.id},relNoteLabel(row))));
}
function resetRelUi(){
  groupEdit=false;
  groupRenaming=null;
  pendingGroupName='';
  openPerson=null;
  personTagEdit=false;
  personRenamingTag=null;
  pendingPersonTag='';
  relSectionEdit=false;
  relSectionRenaming=null;
  pendingSectionName='';
  relEditingId=null;
  relTagEdit=false;
  relRenamingTag=null;
  pendingRelTag='';
  relImageError='';
  relDraft=blankRel();
  Object.keys(pendingPersonName).forEach(k=>delete pendingPersonName[k]);
}
function abandonRelImages(){
  const ids=[...relSession];
  relSession.clear();
  forgetImages(ids);
}
function readRelSections(){
  const person=currentPerson();
  if(!person)return;
  (person.sections||[]).forEach(s=>{
    const area=document.querySelector(`[data-rel-text="${s.id}"]`);
    if(area)s.text=area.value;
  });
  const title=$('relTitle');
  if(title)relDraft.title=title.value;
  const note=$('relNote');
  if(note)relDraft.note=note.value;
  const tag=$('newRelTag');
  if(tag)pendingRelTag=tag.value;
  const personTag=$('newPersonTag');
  if(personTag)pendingPersonTag=personTag.value;
  const sectionName=$('newRelSection');
  if(sectionName)pendingSectionName=sectionName.value;
}
function ensurePeople(cat){
  if(!Array.isArray(cat.groups)||!cat.groups.length){
    const next=normalizeRelationships(cat);
    cat.groups=next.groups;
    cat.people=next.people;
  }
  if(!Array.isArray(cat.people))cat.people=[];
  return cat;
}
function addGroup(){
  readRelSections();
  const cat=currentCat();
  if(!cat)return;
  ensurePeople(cat);
  const field=$('newGroup');
  const name=(field?field.value:pendingGroupName).trim();
  pendingGroupName='';
  if(field)field.value='';
  if(!name){keepField('#newGroup');return}
  cat.groups.push({id:uid(),name});
  save();
  render();
  keepField('#newGroup');
}
function commitGroupRename(group,raw){
  if(groupRenaming!==group.id)return;
  const name=String(raw||'').trim();
  groupRenaming=null;
  if(name)group.name=name;
  save();
  render();
}
function removeGroup(groupId){
  readRelSections();
  const cat=currentCat();
  if(!cat)return;
  const people=peopleIn(cat,groupId);
  const ids=[];
  people.forEach(p=>{
    if(p.photoId)ids.push(p.photoId);
    (p.notes||[]).forEach(n=>(n.images||[]).forEach(id=>ids.push(id)));
  });
  cat.groups=(cat.groups||[]).filter(g=>g.id!==groupId);
  cat.people=(cat.people||[]).filter(p=>p.groupId!==groupId);
  if(!cat.groups.length)cat.groups.push({id:uid(),name:'People'});
  if(openPerson&&!cat.people.some(p=>p.id===openPerson))openPerson=null;
  save();
  forgetImages(ids);
  render();
}
function moveGroup(groupId,dir){
  readRelSections();
  const cat=currentCat();
  if(!cat)return;
  const groups=cat.groups||[];
  const i=groups.findIndex(g=>g.id===groupId);
  const j=i+dir;
  if(i<0||j<0||j>=groups.length)return;
  const swap=groups[i];
  groups[i]=groups[j];
  groups[j]=swap;
  save();
  render();
}
function addPerson(groupId){
  readRelSections();
  const cat=currentCat();
  if(!cat)return;
  ensurePeople(cat);
  const selector=`[data-new-person="${groupId}"]`;
  const field=document.querySelector(selector);
  const name=(field?field.value:(pendingPersonName[groupId]||'')).trim();
  pendingPersonName[groupId]='';
  if(field)field.value='';
  if(!name){keepField(selector);return}
  cat.people.push({id:uid(),groupId,name,photoId:'',tags:[],noteTags:[],sections:[],notes:[]});
  save();
  render();
  keepField(selector);
}
function openPersonScreen(id){
  readRelSections();
  if(openPerson!==id){
    abandonRelImages();
    relEditingId=null;
    relDraft=blankRel();
    relTagEdit=false;
    relRenamingTag=null;
    pendingRelTag='';
    relImageError='';
  }
  openPerson=id;
  personTagEdit=false;
  personRenamingTag=null;
  relSectionEdit=false;
  relSectionRenaming=null;
  render();
}
function closePerson(){
  readRelSections();
  abandonRelImages();
  openPerson=null;
  relEditingId=null;
  relDraft=blankRel();
  relTagEdit=false;
  relRenamingTag=null;
  pendingRelTag='';
  personTagEdit=false;
  relSectionEdit=false;
  relImageError='';
  render();
}
function movePerson(personId,groupId){
  readRelSections();
  const cat=currentCat();
  const person=cat&&(cat.people||[]).find(p=>p.id===personId);
  if(!person||!groupById(cat,groupId))return;
  person.groupId=groupId;
  save();
  render();
}
function addPersonTag(){
  readRelSections();
  const person=currentPerson();
  const name=pendingPersonTag.trim();
  pendingPersonTag='';
  if(!person||!name){keepField('#newPersonTag');return}
  if(!person.tags.some(t=>same(t,name)))person.tags.push(name);
  save();
  render();
  keepField('#newPersonTag');
}
function togglePersonTag(name){
  readRelSections();
  const person=currentPerson();
  if(!person)return;
  if(personTagEdit){personRenamingTag=name;render();return}
  const i=person.tags.findIndex(t=>same(t,name));
  if(i>=0)person.tags.splice(i,1);else person.tags.push(name);
  save();
  render();
}
function deletePersonTag(name){
  readRelSections();
  const person=currentPerson();
  if(!person)return;
  person.tags=person.tags.filter(t=>!same(t,name));
  if(personRenamingTag&&same(personRenamingTag,name))personRenamingTag=null;
  save();
  render();
}
function commitPersonTagRename(oldName,raw){
  if(!personRenamingTag||!same(personRenamingTag,oldName))return;
  personRenamingTag=null;
  const person=currentPerson();
  const name=String(raw||'').trim();
  if(!person||!name||same(name,oldName)){render();return}
  person.tags=person.tags.map(t=>same(t,oldName)?name:t).filter((t,i,arr)=>arr.findIndex(x=>same(x,t))===i);
  save();
  render();
}
function personChip(tag){
  const person=currentPerson();
  if(personTagEdit&&personRenamingTag&&same(personRenamingTag,tag)){
    const inp=h('input',{class:'chip-input','aria-label':`Rename ${tag}`,value:tag,
      onkeydown:ev=>{
        if(ev.key==='Enter'){ev.preventDefault();commitPersonTagRename(tag,ev.target.value)}
        if(ev.key==='Escape'){personRenamingTag=null;render()}
      },
      onblur:ev=>commitPersonTagRename(tag,ev.target.value)});
    setTimeout(()=>{inp.focus();inp.select()},0);
    return h('span',{class:'chip editing','data-tag':tag},inp);
  }
  const kids=[h('button',{type:'button',class:'chip-text',onclick:()=>togglePersonTag(tag)},tag)];
  if(personTagEdit)kids.push(h('button',{type:'button',class:'chip-x','aria-label':`Delete tag ${tag}`,onclick:ev=>{ev.stopPropagation();deletePersonTag(tag)}},'×'));
  return h('span',{class:'chip on'+(personTagEdit?' edit':'')+(person&&person.tags.some(t=>same(t,tag))?'':'') ,'data-tag':tag},...kids);
}
function addRelSection(){
  readRelSections();
  const person=currentPerson();
  const field=$('newRelSection');
  const name=(field?field.value:pendingSectionName).trim();
  pendingSectionName='';
  if(field)field.value='';
  if(!person||!name){keepField('#newRelSection');return}
  person.sections=person.sections||[];
  person.sections.push({id:uid(),name,text:''});
  save();
  render();
  keepField('#newRelSection');
}
function commitSectionRename(section,raw){
  if(relSectionRenaming!==section.id)return;
  const name=String(raw||'').trim();
  relSectionRenaming=null;
  if(name)section.name=name;
  save();
  render();
}
function removeRelSection(sectionId){
  readRelSections();
  const person=currentPerson();
  if(!person)return;
  person.sections=(person.sections||[]).filter(s=>s.id!==sectionId);
  if(relSectionRenaming===sectionId)relSectionRenaming=null;
  save();
  render();
}
function moveRelSection(sectionId,dir){
  readRelSections();
  const person=currentPerson();
  if(!person)return;
  const sections=person.sections||[];
  const i=sections.findIndex(s=>s.id===sectionId);
  const j=i+dir;
  if(i<0||j<0||j>=sections.length)return;
  const swap=sections[i];
  sections[i]=sections[j];
  sections[j]=swap;
  save();
  render();
}
async function onPersonPhoto(ev){
  const input=ev.target;
  const file=input.files&&input.files[0];
  input.value='';
  if(!file)return;
  const person=currentPerson();
  const personId=person&&person.id;
  if(!person)return;
  try{
    const blob=await compressImage(file);
    const id=uid();
    await putImage(id,blob);
    const current=currentPerson();
    if(!current||current.id!==personId){deleteImage(id);return}
    const prev=current.photoId;
    current.photoId=id;
    relImageError='';
    save();
    if(prev)forgetImages([prev]);
    render();
  }catch(err){
    relImageError=IMAGE_ERROR;
    render();
  }
}
function removePersonPhoto(){
  const person=currentPerson();
  if(!person||!person.photoId)return;
  const id=person.photoId;
  person.photoId='';
  save();
  forgetImages([id]);
  render();
}
function relTagNames(person){
  const names=[...(person.noteTags||[])];
  (relDraft.tags||[]).forEach(t=>{if(!names.some(n=>same(n,t)))names.push(t)});
  return names;
}
function addRelTag(){
  readRelSections();
  const person=currentPerson();
  const name=pendingRelTag.trim();
  pendingRelTag='';
  if(!person||!name){keepField('#newRelTag');return}
  if(!person.noteTags.some(t=>same(t,name)))person.noteTags.push(name);
  const canonical=person.noteTags.find(t=>same(t,name));
  if(canonical&&!relDraft.tags.some(t=>same(t,canonical)))relDraft.tags.push(canonical);
  save();
  render();
  keepField('#newRelTag');
}
function toggleRelTag(name){
  readRelSections();
  if(relTagEdit){relRenamingTag=name;render();return}
  const i=relDraft.tags.findIndex(t=>same(t,name));
  if(i>=0)relDraft.tags.splice(i,1);else relDraft.tags.push(name);
  render();
}
function deleteRelTag(name){
  readRelSections();
  const person=currentPerson();
  if(!person)return;
  person.noteTags=person.noteTags.filter(t=>!same(t,name));
  (person.notes||[]).forEach(n=>{n.tags=(n.tags||[]).filter(t=>!same(t,name))});
  relDraft.tags=relDraft.tags.filter(t=>!same(t,name));
  if(relRenamingTag&&same(relRenamingTag,name))relRenamingTag=null;
  save();
  render();
}
function commitRelTagRename(oldName,raw){
  if(!relRenamingTag||!same(relRenamingTag,oldName))return;
  relRenamingTag=null;
  const person=currentPerson();
  const name=String(raw||'').trim();
  if(!person||!name||same(name,oldName)){render();return}
  const rewrite=list=>list.map(t=>same(t,oldName)?name:t).filter((t,i,arr)=>arr.findIndex(x=>same(x,t))===i);
  person.noteTags=rewrite(person.noteTags||[]);
  (person.notes||[]).forEach(n=>{n.tags=rewrite(n.tags||[])});
  relDraft.tags=rewrite(relDraft.tags||[]);
  save();
  render();
}
function relChip(tag){
  const on=relDraft.tags.some(t=>same(t,tag));
  if(relTagEdit&&relRenamingTag&&same(relRenamingTag,tag)){
    const inp=h('input',{class:'chip-input','aria-label':`Rename ${tag}`,value:tag,
      onkeydown:ev=>{
        if(ev.key==='Enter'){ev.preventDefault();commitRelTagRename(tag,ev.target.value)}
        if(ev.key==='Escape'){relRenamingTag=null;render()}
      },
      onblur:ev=>commitRelTagRename(tag,ev.target.value)});
    setTimeout(()=>{inp.focus();inp.select()},0);
    return h('span',{class:'chip editing','data-tag':tag},inp);
  }
  const kids=[h('button',{type:'button',class:'chip-text',onclick:()=>toggleRelTag(tag)},tag)];
  if(relTagEdit)kids.push(h('button',{type:'button',class:'chip-x','aria-label':`Delete tag ${tag}`,onclick:ev=>{ev.stopPropagation();deleteRelTag(tag)}},'×'));
  return h('span',{class:'chip'+(on?' on':'')+(relTagEdit?' edit':''),'data-tag':tag,'data-on':on?'true':'false'},...kids);
}
function relThumb(id,removable){
  const img=h('img',{alt:'Attached image','data-src-id':id});
  const open=h('button',{type:'button',class:'thumb-open','data-image':id,onclick:ev=>{ev.stopPropagation();openLightbox(id)}},img);
  const kids=[open];
  if(removable)kids.push(h('button',{type:'button',class:'thumb-x','aria-label':'Remove image',onclick:ev=>{
    ev.stopPropagation();
    readRelSections();
    relDraft.images=(relDraft.images||[]).filter(x=>x!==id);
    if(relSession.has(id)){relSession.delete(id);revoke(id);deleteImage(id)}
    render();
  }},'×'));
  return h('div',{class:'thumb'},...kids);
}
async function onRelFiles(ev){
  const input=ev.target;
  const files=[...input.files];
  input.value='';
  if(!files.length)return;
  readRelSections();
  const personId=openPerson;
  let failed=false;
  for(const file of files){
    if(openPerson!==personId)return;
    try{
      const blob=await compressImage(file);
      const id=uid();
      await putImage(id,blob);
      if(openPerson!==personId){deleteImage(id);return}
      relDraft.images=relDraft.images||[];
      relDraft.images.push(id);
      relSession.add(id);
    }catch(err){failed=true}
  }
  relImageError=failed?IMAGE_ERROR:'';
  if(openPerson===personId)render();
}
function saveRelNote(ev){
  if(ev)ev.preventDefault();
  readRelSections();
  const person=currentPerson();
  if(!person)return;
  const title=relDraft.title.trim();
  const note=relDraft.note.trim();
  if(!title&&!note&&!(relDraft.tags||[]).length&&!(relDraft.images||[]).length)return;
  person.notes=person.notes||[];
  let row;
  if(relEditingId)row=person.notes.find(n=>n.id===relEditingId);
  const prev=row?[...(row.images||[])]:[];
  if(!row){
    row={id:uid(),date:sel,createdAt:Date.now(),title:'',note:'',tags:[],images:[]};
    person.notes.push(row);
  }
  row.title=title;
  row.note=note;
  row.tags=[...relDraft.tags];
  row.images=[...relDraft.images];
  const keep=new Set(row.images);
  const dropped=prev.filter(id=>!keep.has(id));
  relSession.clear();
  relEditingId=null;
  relTagEdit=false;
  relRenamingTag=null;
  pendingRelTag='';
  relDraft=blankRel();
  save();
  forgetImages(dropped);
  render();
  const el=$('relTitle');
  if(el)el.focus();
}
function editRelNote(note){
  readRelSections();
  abandonRelImages();
  relEditingId=note.id;
  relDraft={title:note.title||'',note:note.note||'',tags:[...(note.tags||[])],images:[...(note.images||[])]};
  relTagEdit=false;
  relRenamingTag=null;
  pendingRelTag='';
  relImageError='';
  render();
  const el=$('relTitle');
  if(el){el.focus();try{el.setSelectionRange(el.value.length,el.value.length)}catch(e){}}
}
function removeRelNote(noteId){
  readRelSections();
  const person=currentPerson();
  if(!person)return;
  const note=(person.notes||[]).find(n=>n.id===noteId);
  const ids=[...(note&&note.images||[])];
  person.notes=(person.notes||[]).filter(n=>n.id!==noteId);
  if(relEditingId===noteId){
    ids.push(...relSession);
    relSession.clear();
    relEditingId=null;
    relDraft=blankRel();
  }
  save();
  forgetImages(ids);
  render();
}
function cancelRelNote(){
  const ids=[...relSession];
  relSession.clear();
  relEditingId=null;
  relDraft=blankRel();
  relTagEdit=false;
  relRenamingTag=null;
  pendingRelTag='';
  forgetImages(ids);
  render();
}
function personCard(cat,person){
  const hint=birthdayHint(person);
  return h('article',{class:'card person-card','data-person':person.id,tabindex:'0',onclick:ev=>{
    if(ev.target.closest('button,input,a'))return;
    openPersonScreen(person.id);
  },onkeydown:ev=>{
    if(ev.target!==ev.currentTarget)return;
    if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();openPersonScreen(person.id)}
  }},
    h('div',{class:'person-card-top'},
      avatar(person),
      h('div',null,
        h('p',{class:'person-name'},person.name||'Someone'),
        person.tags&&person.tags.length?h('p',{class:'accent sm person-tags'},person.tags.join(' · ')):null,
        hint?h('p',{class:'muted sm bday-hint'},hint):null)));
}
function groupSection(cat,group,index,count){
  const people=peopleIn(cat,group.id);
  let title;
  if(groupEdit&&groupRenaming===group.id){
    title=h('input',{class:'item-input list-name-input','aria-label':`Rename ${group.name||'group'}`,value:group.name,
      onkeydown:ev=>{
        if(ev.key==='Enter'){ev.preventDefault();commitGroupRename(group,ev.target.value)}
        if(ev.key==='Escape'){groupRenaming=null;render()}
      },
      onblur:ev=>commitGroupRename(group,ev.target.value)});
    setTimeout(()=>{title.focus();title.select()},0);
  }else if(groupEdit){
    title=h('button',{type:'button',class:'list-name',onclick:()=>{groupRenaming=group.id;render()}},group.name||'Group');
  }else title=h('h3',{class:'list-name'},group.name||'Group');
  return h('section',{class:'rel-group','data-group':group.id},
    h('div',{class:'row list-head'},
      title,
      groupEdit?h('div',{class:'section-tools'},
        h('button',{type:'button',class:'item-move','data-move':'up','aria-label':`Move ${group.name||'group'} up`,disabled:index===0,onclick:()=>moveGroup(group.id,-1)},'↑'),
        h('button',{type:'button',class:'item-move','data-move':'down','aria-label':`Move ${group.name||'group'} down`,disabled:index===count-1,onclick:()=>moveGroup(group.id,1)},'↓'),
        h('button',{type:'button',class:'item-x','aria-label':`Delete group ${group.name||'group'}`,onclick:()=>removeGroup(group.id)},'×')):null),
    h('div',{class:'people-grid'},
      people.length?people.map(person=>personCard(cat,person)):h('p',{class:'muted sm'},'No one in this group yet.')),
    h('div',{class:'tag-row'},
      h('input',{class:'field','data-new-person':group.id,value:pendingPersonName[group.id]||'',placeholder:'Name','aria-label':`Add a person to ${group.name||'group'}`,autocomplete:'off',
        oninput:ev=>{pendingPersonName[group.id]=ev.target.value},
        onkeydown:ev=>{if(ev.key==='Enter'){ev.preventDefault();addPerson(group.id)}}}),
      h('button',{type:'button',class:'btn ghost',onclick:()=>addPerson(group.id)},'Add person')));
}
function groupBoard(cat){
  ensurePeople(cat);
  const groups=cat.groups;
  return h('div',{id:'groupBoard'},
    h('div',{class:'card list-add'},
      h('div',{class:'tag-row'},
        h('input',{id:'newGroup',class:'field',value:pendingGroupName,placeholder:'Friends, family, coworkers…','aria-label':'New group',autocomplete:'off',
          oninput:ev=>{pendingGroupName=ev.target.value},
          onkeydown:ev=>{if(ev.key==='Enter'){ev.preventDefault();addGroup()}}}),
        h('button',{type:'button',class:'btn ghost',id:'addGroup',onclick:addGroup},'Add group'),
        h('button',{type:'button',class:groupEdit?'btn':'btn ghost',id:'editGroups','aria-pressed':groupEdit?'true':'false',onclick:()=>{
          readRelSections();
          groupEdit=!groupEdit;
          if(!groupEdit)groupRenaming=null;
          render();
        }},groupEdit?'Done':'Edit'))),
    groups.map((group,index)=>groupSection(cat,group,index,groups.length)));
}
function profileSection(section,index,count){
  let name;
  if(relSectionEdit&&relSectionRenaming===section.id){
    name=h('input',{class:'item-input','aria-label':`Rename ${section.name||'section'}`,value:section.name,
      onkeydown:ev=>{
        if(ev.key==='Enter'){ev.preventDefault();commitSectionRename(section,ev.target.value)}
        if(ev.key==='Escape'){relSectionRenaming=null;render()}
      },
      onblur:ev=>commitSectionRename(section,ev.target.value)});
    setTimeout(()=>{name.focus();name.select()},0);
  }else if(relSectionEdit){
    name=h('button',{type:'button',class:'rel-section-name',onclick:()=>{relSectionRenaming=section.id;render()}},section.name||'Section');
  }else name=h('p',{class:'kicker'},section.name||'Section');
  return h('div',{class:'rel-section','data-section':section.id},
    h('div',{class:'row'},
      name,
      relSectionEdit?h('div',{class:'section-tools'},
        h('button',{type:'button',class:'item-move','aria-label':`Move ${section.name||'section'} up`,disabled:index===0,onclick:()=>moveRelSection(section.id,-1)},'↑'),
        h('button',{type:'button',class:'item-move','aria-label':`Move ${section.name||'section'} down`,disabled:index===count-1,onclick:()=>moveRelSection(section.id,1)},'↓'),
        h('button',{type:'button',class:'item-x','aria-label':`Delete ${section.name||'section'}`,onclick:()=>removeRelSection(section.id)},'×')):null),
    h('textarea',{class:'field note','data-rel-text':section.id,'aria-label':section.name||'Section',value:section.text||'',oninput:ev=>{section.text=ev.target.value;save()}}));
}
function personProfile(cat,person){
  const groups=cat.groups||[];
  const tags=person.tags||[];
  const file=h('input',{id:'personPhoto',class:'file-input',type:'file',accept:'image/*','aria-label':'Add a photo'});
  file.addEventListener('change',onPersonPhoto);
  const noteFile=h('input',{id:'relImages',class:'file-input',type:'file',accept:'image/*','aria-label':'Add images'});
  noteFile.multiple=true;
  noteFile.addEventListener('change',onRelFiles);
  const hint=birthdayHint(person);
  const noteTags=relTagNames(person);
  const notes=(person.notes||[]).slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)||String(b.date).localeCompare(String(a.date)));
  const sections=person.sections||[];
  return [
    h('article',{class:'card person-profile','data-person':person.id},
      h('div',{class:'profile-head'},
        avatar(person),
        h('div',{class:'grow'},
          h('h3',{class:'profile-name'},person.name||'Someone'),
          hint?h('p',{class:'muted sm bday-hint'},hint):null)),
      h('div',{class:'actions'},
        h('button',{type:'button',class:'btn ghost',id:'addPhoto',onclick:()=>file.click()},person.photoId?'Change photo':'Add photo'),
        person.photoId?h('button',{type:'button',class:'btn ghost',id:'removePhoto',onclick:removePersonPhoto},'Remove photo'):null,
        file),
      relImageError&&!relDraft.images.length?h('p',{class:'warn',role:'alert'},relImageError):null,
      h('label',{class:'lbl'},'Group',h('select',{id:'personGroup',class:'field',onchange:ev=>movePerson(person.id,ev.target.value)},
        ...groups.map(g=>h('option',{value:g.id,selected:g.id===person.groupId},g.name||'Group')))),
      sections.map((section,index)=>profileSection(section,index,sections.length)),
      h('div',{class:'tag-row'},
        h('input',{id:'newRelSection',class:'field',value:pendingSectionName,placeholder:'Birthday, likes, how we met…','aria-label':'New info section',autocomplete:'off',
          oninput:ev=>{pendingSectionName=ev.target.value},
          onkeydown:ev=>{if(ev.key==='Enter'){ev.preventDefault();addRelSection()}}}),
        h('button',{type:'button',class:'btn ghost',id:'addRelSection',onclick:addRelSection},'Add section'),
        h('button',{type:'button',class:relSectionEdit?'btn':'btn ghost',id:'editSections','aria-pressed':relSectionEdit?'true':'false',onclick:()=>{
          readRelSections();
          relSectionEdit=!relSectionEdit;
          if(!relSectionEdit)relSectionRenaming=null;
          render();
        }},relSectionEdit?'Done':'Edit')),
      h('p',{class:'watch'},'Tags'),
      tags.length?h('div',{class:'chips',id:'personTags'},...tags.map(personChip)):h('p',{class:'muted sm',id:'noPersonTags'},'No tags yet.'),
      h('div',{class:'tag-row'},
        h('input',{id:'newPersonTag',class:'field',value:pendingPersonTag,placeholder:'New tag, kept on this person','aria-label':'New tag, kept on this person',autocomplete:'off',
          oninput:ev=>{pendingPersonTag=ev.target.value},
          onkeydown:ev=>{if(ev.key==='Enter'){ev.preventDefault();addPersonTag()}}}),
        h('button',{type:'button',class:'btn ghost',id:'addPersonTag',onclick:addPersonTag},'Add tag'),
        h('button',{type:'button',class:personTagEdit?'btn':'btn ghost',id:'editPersonTags','aria-pressed':personTagEdit?'true':'false',onclick:()=>{
          readRelSections();
          personTagEdit=!personTagEdit;
          if(!personTagEdit)personRenamingTag=null;
          render();
        }},personTagEdit?'Done':'Edit'))),
    h('h2',{class:'block-heading'},'Notes'),
    h('form',{class:'card',id:'relForm',onsubmit:saveRelNote},
      relEditingId?h('p',{class:'muted sm editing-flag'},'Editing note'):null,
      h('label',{class:'lbl'},'Title',h('input',{id:'relTitle',class:'field',value:relDraft.title,autocomplete:'off'})),
      h('label',{class:'lbl'},'Note',h('textarea',{id:'relNote',class:'field note',value:relDraft.note})),
      h('p',{class:'watch'},'Tags'),
      noteTags.length?h('div',{class:'chips',id:'relTags'},...noteTags.map(relChip)):h('p',{class:'muted sm'},'No tags yet.'),
      h('div',{class:'tag-row'},
        h('input',{id:'newRelTag',class:'field',value:pendingRelTag,placeholder:'New word, kept for these notes','aria-label':'New word, kept for these notes',autocomplete:'off',
          oninput:ev=>{pendingRelTag=ev.target.value},
          onkeydown:ev=>{if(ev.key==='Enter'){ev.preventDefault();addRelTag()}}}),
        h('button',{type:'button',class:'btn ghost',id:'addRelTag',onclick:addRelTag},'Add tag'),
        h('button',{type:'button',class:relTagEdit?'btn':'btn ghost',id:'editRelTags','aria-pressed':relTagEdit?'true':'false',onclick:()=>{
          readRelSections();
          relTagEdit=!relTagEdit;
          if(!relTagEdit)relRenamingTag=null;
          render();
        }},relTagEdit?'Done':'Edit')),
      h('div',{class:'images-block'},
        h('div',{class:'actions'},
          h('button',{type:'button',class:'btn ghost',id:'addRelImages',onclick:()=>noteFile.click()},'Add images'),
          noteFile),
        relImageError?h('p',{class:'warn',role:'alert'},relImageError):null,
        relDraft.images.length?h('div',{class:'thumbs'},...relDraft.images.map(id=>relThumb(id,true))):null),
      h('div',{class:'actions'},
        h('button',{class:'btn',type:'submit',id:'saveRelNote'},'Save note'),
        relEditingId?h('button',{type:'button',class:'btn ghost',id:'cancelRelNote',onclick:cancelRelNote},'Cancel'):null)),
    h('div',{class:'entry-list',id:'relNotes'},
      notes.length?notes.map(note=>h('article',{class:'entry-card'+(note.id===relEditingId?' editing':''),'data-rel-note':note.id,onclick:ev=>{
        if(ev.target.closest('button'))return;
        editRelNote(note);
      }},
        h('div',{class:'row top-row'},h('strong',null,note.title||'Untitled'),h('span',{class:'muted sm'},fmt(note.date))),
        note.note?h('p',{class:'note-text'},note.note):null,
        tagLine(note.tags),
        imageGrid(note.images),
        h('div',{class:'entry-actions'},
          h('button',{type:'button',onclick:ev=>{ev.stopPropagation();editRelNote(note)}},'Edit'),
          h('button',{type:'button',onclick:ev=>{ev.stopPropagation();removeRelNote(note.id)}},'Delete')))):h('p',{class:'muted',id:'relEmpty'},'Nothing written.'))
  ];
}
function renderRelationships(cat){
  ensurePeople(cat);
  if(openPerson&&!currentPerson())openPerson=null;
  const person=currentPerson();
  const root=$('catScreen');
  root.dataset.type='relationships';
  root.replaceChildren(
    h('div',{class:'cat-top'},
      h('button',{type:'button',class:'back',id:'backBtn',onclick:()=>{if(openPerson)closePerson();else closeCategory()}},'Back'),
      h('p',{class:'muted',id:'catDate'},fmt(sel))),
    h('h2',{class:'cat-heading',id:'catName'},person?person.name||cat.name:cat.name),
    ...(person?personProfile(cat,person):[groupBoard(cat)]));
  if(focusTitle&&!person){
    const el=$('newGroup');
    if(el)el.focus();
    focusTitle=false;
  }
}
function normalizeRecord(r){
  const copy=Object.assign({},r);
  copy.id=typeof r.id==='string'&&r.id?r.id:uid();
  copy.title=typeof r.title==='string'?r.title:'';
  copy.note=typeof r.note==='string'?r.note:'';
  copy.tags=tagList(r.tags);
  copy.images=Array.isArray(r.images)?r.images.map(String):[];
  copy.createdAt=Number.isFinite(Number(r.createdAt))?Number(r.createdAt):Date.now();
  return copy;
}
function normalizeRecords(list){
  return (Array.isArray(list)?list:[]).filter(r=>r&&typeof r==='object').map(normalizeRecord);
}
function resetRecordUi(){
  recordOpenId=null;
  recordQuery='';
}
function recordCreatedKey(r){
  const n=Number(r&&r.createdAt);
  if(!Number.isFinite(n))return '';
  return key(new Date(n));
}
function sortedRecords(cat){
  return (cat&&cat.records||[]).slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}
function recordsOn(cat,date){
  return (cat&&cat.records||[]).filter(r=>recordCreatedKey(r)===date);
}
function recordDateKeys(){
  const dates=[];
  (state.categories||[]).forEach(c=>(c.records||[]).forEach(r=>{
    const d=recordCreatedKey(r);
    if(d)dates.push(d);
  }));
  return dates;
}
function recordMatches(r,q){
  if(!q)return true;
  if((r.title||'').toLowerCase().includes(q))return true;
  if((r.note||'').toLowerCase().includes(q))return true;
  return (r.tags||[]).some(t=>String(t).toLowerCase().includes(q));
}
function recordWhen(r){
  const n=Number(r.createdAt);
  if(!Number.isFinite(n))return '';
  return new Date(n).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
function recordHomeBits(cat){
  const list=sortedRecords(cat);
  const n=list.length;
  const lines=[h('p',{class:'muted sm home-records','data-record-count':String(n)},`${n} record${n===1?'':'s'}`)];
  list.slice(0,3).forEach(r=>{
    lines.push(h('p',{class:'record-title-line','data-record':r.id},(r.title||'').trim()||'Untitled'));
  });
  return lines;
}
function recordReview(cat,date){
  const rows=recordsOn(cat,date).slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  if(!rows.length)return null;
  return h('div',{class:'day-records'},...rows.map(r=>h('article',{class:'entry-card record-saved','data-record':r.id},
    h('div',{class:'row top-row'},
      h('strong',null,(r.title||'').trim()||'Untitled'),
      h('span',{class:'muted sm saved-label'},'saved')),
    r.note?h('p',{class:'note-text'},r.note):null,
    tagLine(r.tags),
    imageGrid(r.images))));
}
function saveRecord(ev){
  if(ev)ev.preventDefault();
  readDraft();
  const cat=currentCat();
  if(!cat||cat.type!=='record')return;
  if(!TYPES.record.hasContent(draft))return;
  if(!Array.isArray(cat.records))cat.records=[];
  const prev=editingId?[...((cat.records.find(x=>x.id===editingId)||{}).images||[])]:[];
  let rec;
  if(editingId){
    rec=cat.records.find(x=>x.id===editingId);
    if(!rec)return;
  }else{
    rec={id:uid(),createdAt:Date.now(),tags:[],images:[]};
    cat.records.push(rec);
  }
  TYPES.record.write(rec,draft);
  const keep=new Set(rec.images||[]);
  const dropped=prev.filter(id=>!keep.has(id));
  sessionNew.clear();
  editingId=null;
  tagEdit=false;
  renamingTag=null;
  recordOpenId=null;
  save();
  forgetImages(dropped);
  freshDraft(cat);
  focusTitle=true;
  render();
}
function editRecord(r){
  readDraft();
  abandonNewImages();
  editingId=r.id;
  recordOpenId=r.id;
  draft=TYPES.record.fromEntry(r);
  pendingTag='';
  tagEdit=false;
  renamingTag=null;
  focusTitle=true;
  imageError='';
  render();
}
function removeRecord(id){
  const cat=currentCat();
  if(!cat)return;
  const r=(cat.records||[]).find(x=>x.id===id);
  const ids=[...(r&&r.images||[])];
  cat.records=(cat.records||[]).filter(x=>x.id!==id);
  if(recordOpenId===id)recordOpenId=null;
  if(editingId===id){
    ids.push(...sessionNew);
    sessionNew.clear();
    editingId=null;
    tagEdit=false;
    renamingTag=null;
    freshDraft(cat);
  }
  save();
  forgetImages(ids);
  render();
}
function recordRow(r){
  const title=(r.title||'').trim()||'Untitled';
  const when=recordWhen(r);
  const open=recordOpenId===r.id;
  if(!open){
    return h('button',{type:'button',class:'record-row','data-record':r.id,'aria-expanded':'false',onclick:()=>{
      readDraft();
      recordOpenId=r.id;
      render();
    }},
      h('span',{class:'record-name'},title),
      (r.tags||[]).length?h('span',{class:'accent sm record-tags'},r.tags.join(' · ')):null,
      h('span',{class:'muted sm record-when'},when));
  }
  return h('article',{class:'entry-card record-open'+(r.id===editingId?' editing':''),'data-record':r.id,onclick:ev=>{
    if(ev.target.closest('button'))return;
    readDraft();
    recordOpenId=null;
    render();
  }},
    h('div',{class:'row top-row'},
      h('strong',null,title),
      h('span',{class:'muted sm record-when'},when)),
    tagLine(r.tags),
    r.note?h('p',{class:'note-text'},r.note):null,
    imageGrid(r.images),
    h('div',{class:'entry-actions'},
      h('button',{type:'button',onclick:ev=>{ev.stopPropagation();editRecord(r)}},'Edit'),
      h('button',{type:'button',onclick:ev=>{ev.stopPropagation();removeRecord(r.id)}},'Delete')));
}
function renderRecords(cat){
  if(!Array.isArray(cat.records))cat.records=[];
  const names=[...cat.tags];
  draft.tags.forEach(t=>{if(!names.some(n=>same(n,t)))names.push(t)});
  const all=sortedRecords(cat);
  const filtering=all.length>8;
  const q=filtering?recordQuery.trim().toLowerCase():'';
  const shown=q?all.filter(r=>recordMatches(r,q)):all;
  const form=h('form',{class:'card',id:'entryForm',onsubmit:saveRecord},
    editingId?h('p',{class:'muted sm editing-flag'},'Editing record'):null,
    ...TYPES.record.fields(draft),
    h('p',{class:'watch',id:'tagLabel'},TYPES.record.tagLabel),
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
    imageSection(),
    h('div',{class:'actions'},
      h('button',{class:'btn',type:'submit',id:'saveEntry'},'Save record'),
      editingId?h('button',{type:'button',class:'btn ghost',id:'cancelEdit',onclick:()=>{
        abandonNewImages();
        editingId=null;
        tagEdit=false;
        renamingTag=null;
        freshDraft(cat);
        render();
      }},'Cancel'):null));
  const filter=filtering?h('label',{class:'lbl record-filter'},'Filter',
    h('input',{id:'recordFilter',class:'field',value:recordQuery,placeholder:'Tag or search','aria-label':'Filter records by tag or search',autocomplete:'off',
      oninput:ev=>{
        readDraft();
        recordQuery=ev.target.value;
        render();
        keepField('#recordFilter');
      }})):null;
  const root=$('catScreen');
  root.dataset.type='record';
  root.replaceChildren(
    h('div',{class:'cat-top'},
      h('button',{type:'button',class:'back',id:'backBtn',onclick:closeCategory},'Back'),
      h('p',{class:'muted',id:'catDate'},fmt(sel))),
    h('h2',{class:'cat-heading',id:'catName'},cat.name),
    form,
    filter,
    h('div',{class:'record-list',id:'recordList'},
      shown.length?shown.map(recordRow):h('p',{class:'muted',id:'recordEmpty'},all.length?'Nothing matches.':'Nothing saved yet.')));
  fillAreas();
  if(focusTitle){
    const el=$('entryTitle');
    if(el){el.focus();const n=el.value.length;if(el.setSelectionRange)el.setSelectionRange(n,n)}
    focusTitle=false;
  }
}
function sortedCategories(){
  const trackers=[],lists=[],rest=[];
  state.categories.forEach(c=>{
    if(c.type==='tracker')trackers.push(c);
    else if(c.type==='list')lists.push(c);
    else rest.push(c);
  });
  return trackers.concat(lists,rest);
}
function renderCatScreen(){
  const cat=currentCat();
  const root=$('catScreen');
  if(!cat){root.replaceChildren();root.removeAttribute('data-type');return}
  const type=typeOf(cat);
  root.dataset.type=type.id;
  if(type.id==='relationships'){renderRelationships(cat);return}
  if(type.id==='record'){renderRecords(cat);return}
  const names=[...cat.tags];
  draft.tags.forEach(t=>{if(!names.some(n=>same(n,t)))names.push(t)});
  const list=dayEntries(sel,cat.id);
  const tagBlock=[
    h('p',{class:'watch',id:'tagLabel'},type.tagLabel),
    names.length?h('div',{class:'chips',id:'tagChips'},...names.map(chip)):h('p',{class:'muted sm',id:'noTags'},'No tags yet.'),
    h('div',{class:'tag-row'},
      h('input',{id:'newTag',class:'field',value:pendingTag,placeholder:type.tagPlaceholder||'New word, kept in this category','aria-label':type.tagPlaceholder||'New word, kept in this category',autocomplete:'off',
        onkeydown:ev=>{if(ev.key==='Enter'){ev.preventDefault();addTag()}}}),
      h('button',{type:'button',class:'btn ghost',id:'addTag',onclick:addTag},'Add tag'),
      h('button',{type:'button',class:tagEdit?'btn':'btn ghost',id:'editTags','aria-pressed':tagEdit?'true':'false',onclick:()=>{
        readDraft();
        if(tagEdit){tagEdit=false;renamingTag=null}else tagEdit=true;
        render();
      }},tagEdit?'Done':'Edit'))
  ];
  const writing=type.id==='timer'?[type.tail(draft)]:[...tagBlock,type.tail(draft)];
  const form=h('form',{class:'card',id:'entryForm',onsubmit:saveEntry},
    editingId?h('p',{class:'muted sm editing-flag'},'Editing entry'):null,
    ...type.fields(draft),
    ...writing,
    imageSection(),
    h('div',{class:'actions'},
      h('button',{class:'btn',type:'submit',id:'saveEntry'},'Save entry'),
      editingId?h('button',{type:'button',class:'btn ghost',id:'cancelEdit',onclick:()=>{
        abandonNewImages();
        editingId=null;
        tagEdit=false;
        renamingTag=null;
        clearSectionTagUi();
        freshDraft(cat);
        render();
      }},'Cancel'):null));
  root.replaceChildren(
    h('div',{class:'cat-top'},
      h('button',{type:'button',class:'back',id:'backBtn',onclick:closeCategory},'Back'),
      h('p',{class:'muted',id:'catDate'},fmt(sel))),
    h('h2',{class:'cat-heading',id:'catName'},cat.name),
    type.id==='weather'?weatherPanel(cat):null,
    type.id==='list'?listBoard(cat):null,
    type.id==='list'?mealBoard(cat):null,
    ...(type.id==='tracker'?trackBoard(cat):[]),
    form,
    h('div',{class:'entry-list',id:'catEntries'},
      list.length?list.map(entryCard):h('p',{class:'muted',id:'catEmpty'},'Nothing written.')));
  fillAreas();
  if(focusTitle){
    const el=(type.id==='tracker'&&!editingId)?null:($('entryTitle')||(!cat.place&&$('placeQuery')));
    if(el){el.focus();const n=el.value.length;if(el.setSelectionRange)el.setSelectionRange(n,n)}
    focusTitle=false;
  }
}
function entryPreview(e){
  const kind=typeOf(catById(e.categoryId)).id;
  if(kind==='weather'){
    const custom=weatherCustomTitle(e);
    return h('div',{class:'preview-block'},
      h('p',{class:'preview-title'+(custom?'':' wx-log')},custom||weatherHeading(e)),
      custom?h('p',{class:'wx-log sm'},weatherHeading(e)):null,
      e.tags&&e.tags.length?h('p',{class:'accent sm preview-tags'},e.tags.join(' · ')):null);
  }
  const timer=kind==='timer';
  const dur=formatDuration(entryMinutes(e));
  const title=timer?(e.title||'Untitled'):(e.title||dur||'Untitled');
  const lines=[];
  if(timer)(Array.isArray(e.sections)?e.sections:[]).forEach(s=>{
    const heading=(s.title||'').trim();
    const tags=tagList(s.tags);
    if(!heading&&!tags.length)return;
    const name=(s.name||'').trim()||'Section';
    lines.push(h('p',{class:'preview-section'},heading?`${name}: ${heading}`:name));
    if(tags.length)lines.push(h('p',{class:'accent sm preview-section-tags'},tags.join(' · ')));
  });
  return h('div',{class:'preview-block'},
    h('p',{class:'preview-title'},title),
    timer&&dur?h('p',{class:'accent sm preview-dur','data-duration':dur},dur):null,
    ...lines,
    !timer&&e.tags&&e.tags.length?h('p',{class:'accent sm preview-tags'},e.tags.join(' · ')):null);
}
const WEEKDAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function goalById(id){return (state.goals||[]).find(g=>g.id===id)}
function weekDates(dateKey){
  const d=parse(dateKey);
  const start=new Date(d.getFullYear(),d.getMonth(),d.getDate()-d.getDay());
  const out=[];
  for(let i=0;i<7;i++)out.push(key(new Date(start.getFullYear(),start.getMonth(),start.getDate()+i)));
  return out;
}
function dayOf(g,date){
  const d=g.days&&g.days[date];
  if(!d)return {note:'',tags:[],checks:[]};
  return {note:typeof d.note==='string'?d.note:'',tags:tagList(d.tags),checks:tagList(d.checks)};
}
function ensureDay(g,date){
  if(!g.days||typeof g.days!=='object'||Array.isArray(g.days))g.days={};
  if(!g.days[date]||typeof g.days[date]!=='object')g.days[date]={note:'',tags:[],checks:[]};
  const d=g.days[date];
  if(typeof d.note!=='string')d.note='';
  if(!Array.isArray(d.tags))d.tags=[];
  if(!Array.isArray(d.checks))d.checks=[];
  return d;
}
function readGoalNotes(){
  if(skipFormRead)return;
  if(!goalNotesFor||goalNotesFor!==sel)return;
  const form=$('entryForm');
  const screen=$('goalScreen');
  if(openGoal&&form&&screen&&screen.contains(form))readDraft();
  const item=$('newItem');
  if(item)pendingItem=item.value;
}
function goalEntries(g,date){
  return (g.entries||[]).filter(e=>e.date===date).slice().sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
}
function openGoalScreen(id){
  readGoalNotes();
  abandonNewImages();
  openGoal=id;
  openCat=null;
  addingGoal=false;
  goalEditingId=null;
  itemEdit=false;
  itemRenaming=null;
  goalNameEdit=false;
  pendingItem='';
  tagEdit=false;
  renamingTag=null;
  editingId=null;
  focusTitle=true;
  freshDraft(null);
  render();
}
function closeGoal(){
  abandonNewImages();
  openGoal=null;
  goalEditingId=null;
  itemEdit=false;
  itemRenaming=null;
  goalNameEdit=false;
  pendingItem='';
  tagEdit=false;
  renamingTag=null;
  freshDraft(null);
  render();
}
function deleteGoal(g){
  if(!confirm(`Delete goal "${g.name||'Untitled'}"?`))return;
  readGoalNotes();
  const ids=(g.entries||[]).flatMap(e=>e.images||[]);
  if(openGoal===g.id){ids.push(...sessionNew);sessionNew.clear();openGoal=null;goalEditingId=null}
  state.goals=state.goals.filter(x=>x.id!==g.id);
  save();
  forgetImages(ids);
  render();
}
function commitGoalName(g,raw){
  if(!goalNameEdit)return;
  goalNameEdit=false;
  const name=String(raw||'').trim();
  if(name)g.name=name;
  save();
  render();
}
function toggleCheck(goalId,itemId,date){
  readGoalNotes();
  const g=goalById(goalId);
  if(!g)return;
  const day=ensureDay(g,date);
  const i=day.checks.indexOf(itemId);
  if(i>=0)day.checks.splice(i,1);else day.checks.push(itemId);
  save();
  render();
}
function addGoalItem(goalId){
  readGoalNotes();
  const g=goalById(goalId);
  if(!g)return;
  const name=pendingItem.trim();
  pendingItem='';
  const field=$('newItem');
  if(field)field.value='';
  if(!name){keepField('#newItem');return}
  g.items=g.items||[];
  g.items.push({id:uid(),name});
  save();
  render();
  keepField('#newItem');
}
function removeGoalItem(goalId,itemId){
  readGoalNotes();
  const g=goalById(goalId);
  if(!g)return;
  g.items=(g.items||[]).filter(it=>it.id!==itemId);
  Object.values(g.days||{}).forEach(d=>{if(d&&Array.isArray(d.checks))d.checks=d.checks.filter(id=>id!==itemId)});
  if(itemRenaming===itemId)itemRenaming=null;
  save();
  render();
}
function commitItemRename(g,item,raw){
  if(itemRenaming!==item.id)return;
  itemRenaming=null;
  const name=String(raw||'').trim();
  if(name)item.name=name;
  save();
  render();
}
function addGoalTag(){
  readGoalNotes();
  const g=goalById(openGoal);
  if(!g)return;
  const name=pendingTag.trim();
  pendingTag='';
  const field=$('newTag');
  if(field)field.value='';
  if(!name){keepField('#newTag');return}
  g.tags=tagList(g.tags);
  if(!g.tags.some(t=>same(t,name)))g.tags.push(name);
  const canonical=g.tags.find(t=>same(t,name));
  if(canonical&&!draft.tags.some(t=>same(t,canonical)))draft.tags.push(canonical);
  save();
  render();
  keepField('#newTag');
}
function toggleGoalTag(name){
  readGoalNotes();
  const i=draft.tags.findIndex(t=>same(t,name));
  if(i>=0)draft.tags.splice(i,1);else draft.tags.push(name);
  render();
}
function deleteGoalTag(name){
  readGoalNotes();
  const g=goalById(openGoal);
  if(!g)return;
  g.tags=tagList(g.tags).filter(t=>!same(t,name));
  (g.entries||[]).forEach(e=>{e.tags=tagList(e.tags).filter(t=>!same(t,name))});
  draft.tags=draft.tags.filter(t=>!same(t,name));
  if(renamingTag&&same(renamingTag,name))renamingTag=null;
  save();
  render();
}
function commitGoalRename(oldName,raw){
  if(!renamingTag||!same(renamingTag,oldName))return;
  renamingTag=null;
  const name=String(raw||'').trim();
  const g=goalById(openGoal);
  if(!g||!name||name===oldName){render();return}
  g.tags=tagList(g.tags);
  const clash=g.tags.find(t=>same(t,name)&&!same(t,oldName));
  const next=clash||name;
  const idx=g.tags.findIndex(t=>same(t,oldName));
  if(clash)g.tags=g.tags.filter(t=>!same(t,oldName));
  else if(idx>=0)g.tags[idx]=next;
  else g.tags.push(next);
  const rewrite=list=>[...new Set(tagList(list).map(t=>same(t,oldName)?next:t))];
  (g.entries||[]).forEach(e=>{e.tags=rewrite(e.tags)});
  draft.tags=rewrite(draft.tags);
  save();
  render();
}
function goalChip(tag){
  const on=draft.tags.some(t=>same(t,tag));
  if(tagEdit&&renamingTag&&same(renamingTag,tag)){
    const inp=h('input',{class:'chip-input','aria-label':`Rename ${tag}`,value:tag,
      onkeydown:ev=>{
        if(ev.key==='Enter'){ev.preventDefault();commitGoalRename(tag,ev.target.value)}
        if(ev.key==='Escape'){renamingTag=null;render()}
      },
      onblur:ev=>commitGoalRename(tag,ev.target.value)});
    setTimeout(()=>{inp.focus();inp.select()},0);
    return h('span',{class:'chip editing','data-tag':tag},inp);
  }
  const text=h('button',{type:'button',class:'chip-text',onclick:()=>{
    if(tagEdit){readGoalNotes();renamingTag=tag;render()}
    else toggleGoalTag(tag);
  }},tag);
  const kids=[text];
  if(tagEdit)kids.push(h('button',{type:'button',class:'chip-x','aria-label':`Delete tag ${tag}`,onclick:ev=>{ev.stopPropagation();deleteGoalTag(tag)}},'×'));
  return h('span',{class:'chip'+(on?' on':'')+(tagEdit?' edit':''),'data-tag':tag,'data-on':on?'true':'false'},...kids);
}
function moveGoalItem(goalId,itemId,dir){
  readGoalNotes();
  const g=goalById(goalId);
  if(!g)return;
  const items=g.items||[];
  const i=items.findIndex(it=>it.id===itemId);
  const j=i+dir;
  if(i<0||j<0||j>=items.length)return;
  const swap=items[i];
  items[i]=items[j];
  items[j]=swap;
  save();
  render();
}
function itemCell(g,item,editable,index,count){
  const label=(item.name||'').trim()||'Item';
  if(!editable||!itemEdit)return h('th',{scope:'row',class:'item-name'},label);
  if(itemRenaming===item.id){
    const inp=h('input',{class:'item-input','aria-label':`Rename ${label}`,value:item.name,
      onkeydown:ev=>{
        if(ev.key==='Enter'){ev.preventDefault();commitItemRename(g,item,ev.target.value)}
        if(ev.key==='Escape'){itemRenaming=null;render()}
      },
      onblur:ev=>commitItemRename(g,item,ev.target.value)});
    setTimeout(()=>{inp.focus();inp.select()},0);
    return h('th',{scope:'row',class:'item-name'},inp);
  }
  return h('th',{scope:'row',class:'item-name'},
    h('span',{class:'item-cell'},
      h('button',{type:'button',class:'item-text',onclick:()=>{readGoalNotes();itemRenaming=item.id;render()}},label),
      h('button',{type:'button',class:'item-move','data-move':'up','aria-label':`Move ${label} up`,disabled:index===0,onclick:ev=>{ev.stopPropagation();moveGoalItem(g.id,item.id,-1)}},'↑'),
      h('button',{type:'button',class:'item-move','data-move':'down','aria-label':`Move ${label} down`,disabled:index===count-1,onclick:ev=>{ev.stopPropagation();moveGoalItem(g.id,item.id,1)}},'↓'),
      h('button',{type:'button',class:'item-x','aria-label':`Delete item ${label}`,onclick:ev=>{ev.stopPropagation();removeGoalItem(g.id,item.id)}},'×')));
}
function weekTable(g,editable){
  const today=key(new Date());
  const dates=weekDates(sel);
  const head=h('tr',null,
    h('th',{scope:'col',class:'item-name'}),
    ...dates.map((date,i)=>h('th',{scope:'col',class:[date===today&&'today',date===sel&&date!==today&&'col-sel'].filter(Boolean).join(' '),'data-col':date},
      WEEKDAYS[i],h('br'),String(parse(date).getDate()))));
  const items=g.items||[];
  const rows=items.map((item,index)=>h('tr',{'data-item':item.id},
    itemCell(g,item,editable,index,items.length),
    ...dates.map(date=>{
      const on=dayOf(g,date).checks.includes(item.id);
      return h('td',{class:date===today?'today':''},
        h('button',{type:'button',class:'check'+(on?' on':''),'aria-pressed':on?'true':'false','aria-label':`${(item.name||'').trim()||'Item'} on ${fmt(date)}`,'data-date':date,onclick:ev=>{
          ev.stopPropagation();
          toggleCheck(g.id,item.id,date);
        }},on?'✓':''));
    })));
  return h('div',{class:'week-wrap'},h('table',{class:'week'},h('thead',null,head),h('tbody',null,
    rows.length?rows:h('tr',null,h('td',{colspan:'8',class:'muted sm'},'No items yet.')))));
}
function goalPreviewTitle(e){
  const title=(e.title||'').trim();
  if(title)return title;
  const line=(e.note||'').trim().split('\n')[0];
  if(!line)return '';
  return line.length>80?line.slice(0,77)+'…':line;
}
function goalEntryHas(e){
  return !!((e.title||'').trim()||(e.note||'').trim()||(e.tags||[]).length||(e.images||[]).length);
}
function goalDateKeys(){
  const dates=[];
  (state.goals||[]).forEach(g=>{
    Object.entries(g.days||{}).forEach(([k,d])=>{if(d&&(d.checks||[]).length)dates.push(k)});
    (g.entries||[]).forEach(e=>{if(e&&e.date&&goalEntryHas(e))dates.push(e.date)});
  });
  return dates;
}
function goalDayBlocks(date){
  return (state.goals||[]).map(g=>{
    const checks=dayOf(g,date).checks;
    const items=(g.items||[]).filter(it=>checks.includes(it.id));
    const notes=goalEntries(g,date).filter(goalEntryHas);
    if(!items.length&&!notes.length)return null;
    const total=(g.items||[]).length;
    return h('div',{class:'day-goal','data-goal':g.id},
      h('h3',{class:'day-cat-name'},g.name||'Untitled'),
      items.length?h('article',{class:'entry-card goal-day-card'},
        h('div',{class:'row top-row'},h('span',{class:'muted sm goal-count'},`${items.length} of ${total}`)),
        ...items.map(it=>h('p',{class:'goal-check'},
          h('span',{class:'goal-mark','aria-hidden':'true'},'✓'),
          h('span',null,(it.name||'').trim()||'Item')))):null,
      ...notes.map(e=>h('article',{class:'entry-card goal-note-card','data-goal-entry':e.id},
        h('div',{class:'row top-row'},h('strong',null,(e.title||'').trim()||'Untitled')),
        e.note?h('p',{class:'note-text'},e.note):null,
        tagLine(e.tags),
        imageGrid(e.images))));
  }).filter(Boolean);
}
function renderSelGoals(){
  const root=$('selGoals');
  if(!root)return;
  const blocks=goalDayBlocks(sel);
  root.hidden=!blocks.length;
  root.replaceChildren(...blocks);
}
function goalEntryPreview(e){
  const title=goalPreviewTitle(e);
  return h('div',{class:'preview-block'},
    title?h('p',{class:'preview-title'},title):null,
    e.tags&&e.tags.length?h('p',{class:'accent sm preview-tags'},e.tags.join(' · ')):null);
}
function saveGoalEntry(ev){
  if(ev)ev.preventDefault();
  readDraft();
  const g=goalById(openGoal);
  if(!g)return;
  if(!TYPES.notes.hasContent(draft))return;
  g.entries=Array.isArray(g.entries)?g.entries:[];
  const prev=goalEditingId?[...((g.entries.find(x=>x.id===goalEditingId)||{}).images||[])]:[];
  let entry;
  if(goalEditingId){
    entry=g.entries.find(x=>x.id===goalEditingId);
    if(!entry)return;
  }else{
    entry={id:uid(),date:sel,createdAt:Date.now(),tags:[],images:[]};
    g.entries.push(entry);
  }
  TYPES.notes.write(entry,draft);
  const keep=new Set(entry.images||[]);
  const dropped=prev.filter(id=>!keep.has(id));
  sessionNew.clear();
  goalEditingId=null;
  tagEdit=false;
  renamingTag=null;
  save();
  forgetImages(dropped);
  freshDraft(null);
  skipFormRead=true;
  render();
}
function editGoalEntry(e){
  abandonNewImages();
  goalEditingId=e.id;
  draft=TYPES.notes.fromEntry(e);
  pendingTag='';
  tagEdit=false;
  renamingTag=null;
  focusTitle=true;
  imageError='';
  skipFormRead=true;
  render();
}
function removeGoalEntry(id){
  const g=goalById(openGoal);
  if(!g)return;
  const e=(g.entries||[]).find(x=>x.id===id);
  const ids=[...(e&&e.images||[])];
  g.entries=(g.entries||[]).filter(x=>x.id!==id);
  if(goalEditingId===id){
    ids.push(...sessionNew);
    sessionNew.clear();
    goalEditingId=null;
    tagEdit=false;
    renamingTag=null;
    freshDraft(null);
    skipFormRead=true;
  }
  save();
  forgetImages(ids);
  render();
}
function goalEntryCard(e){
  const editing=e.id===goalEditingId;
  return h('article',{class:'entry-card'+(editing?' editing':''),'data-entry':e.id,onclick:ev=>{
    if(ev.target.closest('button'))return;
    editGoalEntry(e);
  }},
    h('div',{class:'row top-row'},h('strong',null,e.title||'Untitled'),h('span',{class:'muted sm'},fmt(e.date))),
    e.note?h('p',{class:'note-text'},e.note):null,
    tagLine(e.tags),
    imageGrid(e.images),
    h('div',{class:'entry-actions'},
      h('button',{type:'button',onclick:ev=>{ev.stopPropagation();editGoalEntry(e)}},'Edit'),
      h('button',{type:'button',onclick:ev=>{ev.stopPropagation();removeGoalEntry(e.id)}},'Delete')));
}
function goalHeading(g){
  if(goalNameEdit){
    const inp=h('input',{id:'goalName',class:'goal-name-input',value:g.name,'aria-label':'Goal name',autocomplete:'off',
      onkeydown:ev=>{
        if(ev.key==='Enter'){ev.preventDefault();commitGoalName(g,ev.target.value)}
        if(ev.key==='Escape'){goalNameEdit=false;render()}
      },
      onblur:ev=>commitGoalName(g,ev.target.value)});
    setTimeout(()=>{inp.focus();inp.select()},0);
    return h('h2',{class:'cat-heading',id:'goalHeading'},inp);
  }
  return h('h2',{class:'cat-heading',id:'goalHeading'},
    h('button',{type:'button',class:'goal-name',onclick:()=>{readGoalNotes();goalNameEdit=true;render()}},g.name||'Untitled'));
}
function renderGoals(){
  const root=$('goals');
  if(!root)return;
  const cards=(state.goals||[]).map(g=>{
    const written=goalEntries(g,sel).filter(e=>goalPreviewTitle(e)||(e.tags||[]).length);
    return h('article',{class:'card goal-card','data-goal':g.id,'data-type':g.type||'checks',onclick:ev=>{
      if(ev.target.closest('button'))return;
      openGoalScreen(g.id);
    }},
      h('div',{class:'row'},
        h('h3',null,h('button',{type:'button',class:'goal-title',onclick:()=>openGoalScreen(g.id)},g.name||'Untitled')),
        h('button',{class:'x',type:'button','aria-label':`Delete ${g.name||'goal'}`,onclick:ev=>{ev.stopPropagation();deleteGoal(g)}},'Delete')),
      h('p',{class:'muted sm goal-type'},(GOAL_TYPES[g.type]||GOAL_TYPES.checks).label),
      weekTable(g,false),
      written.length?written.map(goalEntryPreview):null);
  });
  root.replaceChildren(...cards);
  if(addingGoal){
    const inp=h('input',{class:'field',placeholder:'Health, practice, home…','aria-label':'Name this goal'});
    const f=h('form',{class:'card',id:'newGoalForm',onsubmit:ev=>{
      ev.preventDefault();
      const n=inp.value.trim();
      if(!n)return;
      const type=GOAL_TYPES[newGoalType]?newGoalType:'checks';
      const goal={id:uid(),name:n,type,items:[],tags:[],days:{},entries:[]};
      state.goals.push(goal);
      addingGoal=false;
      newGoalType='checks';
      save();
      openGoalScreen(goal.id);
    }},
      h('h3',null,'New goal'),inp,
      h('p',{class:'watch'},'Type'),
      h('div',{class:'type-row',id:'goalTypePicker'},...Object.values(GOAL_TYPES).map(t=>
        h('button',{type:'button',class:'type-opt'+(newGoalType===t.id?' on':''),'data-type':t.id,'aria-pressed':newGoalType===t.id?'true':'false',onclick:()=>{
          newGoalType=t.id;
          document.querySelectorAll('#goalTypePicker .type-opt').forEach(b=>{
            const on=b.getAttribute('data-type')===t.id;
            b.classList.toggle('on',on);
            b.setAttribute('aria-pressed',on?'true':'false');
          });
        }},t.label))),
      h('div',{class:'row'},h('button',{class:'btn',type:'submit'},'Add goal'),h('button',{class:'btn ghost',type:'button',onclick:()=>{addingGoal=false;newGoalType='checks';render()}},'Cancel')));
    root.append(f);
    setTimeout(()=>inp.focus(),0);
  }else root.append(h('button',{class:'new-cat',type:'button',id:'newGoal',onclick:()=>{addingGoal=true;newGoalType='checks';render()}},h('span',{class:'plus'},'+'),'New goal'));
}
function renderGoalScreen(){
  const g=goalById(openGoal);
  const root=$('goalScreen');
  if(!g){root.replaceChildren();return}
  const names=[...tagList(g.tags)];
  draft.tags.forEach(t=>{if(!names.some(n=>same(n,t)))names.push(t)});
  const list=goalEntries(g,sel);
  const form=h('form',{class:'card',id:'entryForm',onsubmit:saveGoalEntry},
    goalEditingId?h('p',{class:'muted sm editing-flag'},'Editing entry'):null,
    weekTable(g,true),
    h('div',{class:'tag-row item-add'},
      h('input',{id:'newItem',class:'field',value:pendingItem,placeholder:'New item','aria-label':'New item',autocomplete:'off',
        onkeydown:ev=>{if(ev.key==='Enter'){ev.preventDefault();addGoalItem(g.id)}},
        oninput:ev=>{pendingItem=ev.target.value}}),
      h('button',{type:'button',class:'btn ghost',id:'addGoalItem',onclick:()=>addGoalItem(g.id)},'Add item'),
      h('button',{type:'button',class:itemEdit?'btn':'btn ghost',id:'editItems','aria-pressed':itemEdit?'true':'false',onclick:()=>{
        readGoalNotes();
        itemEdit=!itemEdit;
        if(!itemEdit)itemRenaming=null;
        render();
      }},itemEdit?'Done':'Edit')),
    h('label',{class:'lbl'},'Title',h('input',{id:'entryTitle',class:'field',value:draft.title,autocomplete:'off'})),
    h('label',{class:'lbl'},'Note',h('textarea',{id:'entryNote',class:'field note'})),
    h('p',{class:'watch',id:'tagLabel'},'Tags you are watching'),
    names.length?h('div',{class:'chips',id:'tagChips'},...names.map(goalChip)):h('p',{class:'muted sm',id:'noTags'},'No tags yet.'),
    h('div',{class:'tag-row'},
      h('input',{id:'newTag',class:'field',value:pendingTag,placeholder:'New word, kept for this goal','aria-label':'New word, kept for this goal',autocomplete:'off',
        onkeydown:ev=>{if(ev.key==='Enter'){ev.preventDefault();addGoalTag()}}}),
      h('button',{type:'button',class:'btn ghost',id:'addTag',onclick:addGoalTag},'Add tag'),
      h('button',{type:'button',class:tagEdit?'btn':'btn ghost',id:'editTags','aria-pressed':tagEdit?'true':'false',onclick:()=>{
        readGoalNotes();
        if(tagEdit){tagEdit=false;renamingTag=null}else tagEdit=true;
        render();
      }},tagEdit?'Done':'Edit')),
    imageSection(),
    h('div',{class:'actions'},
      h('button',{class:'btn',type:'submit',id:'saveEntry'},'Save entry'),
      goalEditingId?h('button',{type:'button',class:'btn ghost',id:'cancelEdit',onclick:()=>{
        abandonNewImages();
        goalEditingId=null;
        tagEdit=false;
        renamingTag=null;
        freshDraft(null);
        skipFormRead=true;
        render();
      }},'Cancel'):null),
    h('p',{class:'goal-delete-row'},h('button',{type:'button',class:'goal-delete',id:'deleteGoal',onclick:()=>deleteGoal(g)},'Delete goal')));
  root.replaceChildren(
    h('div',{class:'cat-top'},
      h('button',{type:'button',class:'back',id:'goalBack',onclick:closeGoal},'Back'),
      h('p',{class:'muted',id:'goalDate'},fmt(sel))),
    goalHeading(g),
    form,
    h('div',{class:'entry-list',id:'goalEntries'},
      list.length?list.map(goalEntryCard):h('p',{class:'muted',id:'goalEmpty'},'Nothing written.')));
  fillAreas();
  if(focusTitle&&!goalNameEdit){
    const el=$('entryTitle');
    if(el){el.focus();const n=el.value.length;if(el.setSelectionRange)el.setSelectionRange(n,n)}
    focusTitle=false;
  }
}
function catCard(c){
  const list=dayEntries(sel,c.id);
  const type=typeOf(c);
  const trackerKind=type.id==='tracker'?(c.tracker==='flow'?'flow':'shifts'):'';
  const extra=(type.id==='list'?listHomeBits(c):type.id==='tracker'?trackerHomeBits(c):type.id==='relationships'?relHomeBits(c):type.id==='record'?recordHomeBits(c):[]).filter(Boolean);
  return h('article',{class:'card cat-card','data-cat':c.id,'data-type':type.id,'data-tracker':trackerKind||false,tabindex:'0',onclick:ev=>{
    if(ev.target.closest('button'))return;
    openCategory(c.id);
  },onkeydown:ev=>{
    if(ev.target!==ev.currentTarget)return;
    if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();openCategory(c.id)}
  }},
    h('div',{class:'row'},h('h3',null,c.name),h('button',{class:'x',type:'button','aria-label':`Delete ${c.name}`,onclick:()=>deleteCategory(c)},'Delete')),
    type.id==='notes'?null:h('p',{class:'muted sm'},type.id==='tracker'?(trackerKind==='flow'?'Flow':'Work shifts'):type.label),
    type.id==='weather'?h('div',{class:'wx-slot','data-wx-slot':c.id},weatherReadout(c)):null,
    extra,
    list.length?list.map(entryPreview):(extra.length?null:h('p',{class:'muted'},'Nothing written for this day.')),
    h('p',{class:'accent sm open-hint'},'Open'));
}
function renderCats(){
  const root=$('categories');
  root.replaceChildren(...sortedCategories().map(catCard));
  if(addingCat){
    const inp=h('input',{class:'field',placeholder:'Reading, work, practice…','aria-label':'Name this category'});
    const f=h('form',{class:'card',id:'newCatForm',onsubmit:ev=>{
      ev.preventDefault();
      const n=inp.value.trim();
      if(!n)return;
      const type=TYPES[newType]?newType:'notes';
      const cat={id:uid(),name:n,tags:[],type};
      if(type==='timer'){cat.sectionNames=['Notes'];cat.sectionTags={};}
      if(type==='weather')cat.place=null;
      if(type==='list'){cat.lists=[];cat.meals={};}
      if(type==='tracker'){cat.tracker=newTracker==='flow'?'flow':'shifts';cat.shifts={};cat.flow={};cat.flowOptions=[];cat.showCycle=false;}
      if(type==='relationships'){cat.groups=[{id:uid(),name:'Friends'}];cat.people=[];}
      if(type==='record')cat.records=[];
      state.categories.push(cat);
      addingCat=false;
      newType='notes';
      newTracker='shifts';
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
          const kind=$('trackerKind');
          if(kind)kind.hidden=t.id!=='tracker';
        }},t.label))),
      h('div',{id:'trackerKind',hidden:newType!=='tracker'},
        h('p',{class:'watch'},'Tracker'),
        h('div',{class:'type-row',id:'trackerPicker'},...TRACK_KINDS.map(t=>
          h('button',{type:'button',class:'type-opt'+(newTracker===t.id?' on':''),'data-tracker':t.id,'aria-pressed':newTracker===t.id?'true':'false',onclick:()=>{
            newTracker=t.id;
            document.querySelectorAll('#trackerPicker .type-opt').forEach(b=>{
              const on=b.getAttribute('data-tracker')===t.id;
              b.classList.toggle('on',on);
              b.setAttribute('aria-pressed',on?'true':'false');
            });
          }},t.label)))),
      h('div',{class:'row'},h('button',{class:'btn',type:'submit'},'Add category'),h('button',{class:'btn ghost',type:'button',onclick:()=>{addingCat=false;newType='notes';newTracker='shifts';render()}},'Cancel')));
    root.append(f);
    setTimeout(()=>inp.focus(),0);
  }else{
    root.append(h('button',{class:'new-cat',type:'button',id:'newCat',onclick:()=>{addingCat=true;newType='notes';newTracker='shifts';render()}},h('span',{class:'plus'},'+'),'New category'));
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
  const has=new Set([...state.entries.map(e=>e.date),...Object.keys(state.dayTitles),...mealDateKeys(),...trackerDateKeys(),...relDateKeys(),...recordDateKeys()]);
  (state.goals||[]).forEach(g=>{
    Object.entries(g.days||{}).forEach(([k,d])=>{if(d&&(d.checks||[]).length)has.add(k)});
    (g.entries||[]).forEach(e=>{if(e&&e.date&&((e.title||'').trim()||(e.note||'').trim()||(e.tags||[]).length||(e.images||[]).length))has.add(e.date)});
  });
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
  const ks=[...new Set([...Object.keys(state.dayTitles),...state.entries.map(e=>e.date),...mealDateKeys(),...trackerDateKeys(),...relDateKeys(),...recordDateKeys(),...goalDateKeys()])].sort().reverse();
  $('daysEmpty').hidden=ks.length>0;
  $('daysList').replaceChildren(...ks.map(k=>{
    const goalNotes=(state.goals||[]).reduce((n,g)=>n+goalEntries(g,k).filter(goalEntryHas).length,0);
    const checkOnly=(state.goals||[]).filter(g=>dayOf(g,k).checks.length&&!goalEntries(g,k).some(goalEntryHas)).length;
    const count=state.entries.filter(e=>e.date===k).length+relDateKeys().filter(d=>d===k).length+recordDateKeys().filter(d=>d===k).length+goalNotes+checkOnly;
    const open=expanded.has(k);
    const known=new Set(state.categories.map(c=>c.id));
    const groups=state.categories.map(c=>({cat:c,name:c.name,entries:dayEntries(k,c.id)}));
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
      groups.length?groups.map(g=>{
        const review=g.cat&&g.cat.type==='list'?mealReview(g.cat,k):g.cat&&g.cat.type==='tracker'?trackerReview(g.cat,k):g.cat&&g.cat.type==='relationships'?relReview(g.cat,k):g.cat&&g.cat.type==='record'?recordReview(g.cat,k):null;
        if(g.cat&&g.cat.type==='record'&&!review)return null;
        const entries=g.entries.length?g.entries.map(entryCard):null;
        return h('div',{class:'day-cat','data-cat-name':g.name},
          h('h3',{class:'day-cat-name'},g.name),
          review,
          entries,
          !review&&!entries?h('p',{class:'muted nothing'},'Nothing written.'):null);
      }):h('p',{class:'muted'},'No categories yet.'),
      ...goalDayBlocks(k)):null;
    return h('div',{class:'day-block'+(k===sel?' sel':''),'data-day':k},head,body);
  }));
}
const BACKUP_WEEK=7*24*60*60*1000;
const BACKUP_SNOOZE=3*24*60*60*1000;
const BACKUP_BAD='That file is not a Field Record backup. Nothing was changed.';
function backupDue(){
  if(state.backupSnoozeUntil>Date.now())return false;
  if(!state.lastBackupAt)return true;
  return Date.now()-state.lastBackupAt>BACKUP_WEEK;
}
function lastBackupText(){
  if(!state.lastBackupAt)return 'Last backup: none yet';
  const d=new Date(state.lastBackupAt);
  return 'Last backup: '+d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
function backupDayCount(journal){
  const days=new Set();
  (journal.entries||[]).forEach(e=>{if(e&&e.date)days.add(e.date)});
  Object.keys(journal.dayTitles||{}).forEach(k=>{if(k)days.add(k)});
  (journal.categories||[]).forEach(c=>{
    if(!c||!c.meals||typeof c.meals!=='object')return;
    Object.keys(c.meals).forEach(k=>{if(Array.isArray(c.meals[k])&&c.meals[k].length)days.add(k)});
    if(c.shifts&&typeof c.shifts==='object')Object.keys(c.shifts).forEach(k=>{if(Array.isArray(c.shifts[k])&&c.shifts[k].length)days.add(k)});
    if(c.flow&&typeof c.flow==='object')Object.keys(c.flow).forEach(k=>{
      const v=c.flow[k];
      if(Array.isArray(v)?v.length:v)days.add(k);
    });
    (c.people||[]).forEach(p=>(p.notes||[]).forEach(n=>{if(n&&n.date)days.add(n.date)}));
    (c.records||[]).forEach(r=>{const d=recordCreatedKey(r);if(d)days.add(d)});
  });
  (journal.goals||[]).forEach(g=>{
    if(!g||typeof g!=='object')return;
    (g.entries||[]).forEach(e=>{if(e&&e.date)days.add(e.date)});
    const raw=g.days&&typeof g.days==='object'&&!Array.isArray(g.days)?g.days:{};
    Object.keys(raw).forEach(k=>{
      const day=raw[k];
      if(day&&Array.isArray(day.checks)&&day.checks.length)days.add(k);
    });
  });
  return days.size;
}
function backupEntryCount(journal){
  const goals=(journal.goals||[]).reduce((n,g)=>n+(g&&Array.isArray(g.entries)?g.entries.length:0),0);
  const people=(journal.categories||[]).reduce((n,c)=>n+(c&&Array.isArray(c.people)?c.people.reduce((m,p)=>m+(p&&Array.isArray(p.notes)?p.notes.length:0),0):0),0);
  const records=(journal.categories||[]).reduce((n,c)=>n+(c&&Array.isArray(c.records)?c.records.length:0),0);
  return (Array.isArray(journal.entries)?journal.entries.length:0)+goals+people+records;
}
function blobToBase64(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>{
      const text=String(reader.result||'');
      const i=text.indexOf(',');
      resolve(i>=0?text.slice(i+1):text);
    };
    reader.onerror=()=>reject(reader.error||new Error('read'));
    reader.readAsDataURL(blob);
  });
}
function decodeBase64(data){
  if(typeof data!=='string')throw new Error('data');
  const clean=data.replace(/\s/g,'');
  if(!clean||!/^[A-Za-z0-9+/]+={0,2}$/.test(clean)||clean.length%4===1)throw new Error('data');
  const bin=atob(clean);
  const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return bytes;
}
function parseBackup(text){
  let raw;
  try{raw=JSON.parse(text)}catch(e){throw new Error(BACKUP_BAD)}
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.format!==1)throw new Error(BACKUP_BAD);
  const exportedAt=Date.parse(raw.exportedAt);
  if(!Number.isFinite(exportedAt))throw new Error(BACKUP_BAD);
  const journal=raw.journal;
  if(!journal||typeof journal!=='object'||Array.isArray(journal)||!Array.isArray(journal.categories))throw new Error(BACKUP_BAD);
  if(journal.entries!=null&&!Array.isArray(journal.entries))throw new Error(BACKUP_BAD);
  if(journal.goals!=null&&!Array.isArray(journal.goals))throw new Error(BACKUP_BAD);
  if(journal.themes!=null&&!Array.isArray(journal.themes))throw new Error(BACKUP_BAD);
  if(journal.dayTitles!=null&&(typeof journal.dayTitles!=='object'||Array.isArray(journal.dayTitles)))throw new Error(BACKUP_BAD);
  if(!Array.isArray(raw.images))throw new Error(BACKUP_BAD);
  const seen=new Set();
  const images=raw.images.map(item=>{
    if(!item||typeof item!=='object'||Array.isArray(item))throw new Error(BACKUP_BAD);
    const id=typeof item.id==='string'?item.id:'';
    if(!id||id.length>200||seen.has(id))throw new Error(BACKUP_BAD);
    seen.add(id);
    const type=typeof item.type==='string'&&item.type.trim()?item.type.trim():'application/octet-stream';
    let bytes;
    try{bytes=decodeBase64(item.data)}catch(e){throw new Error(BACKUP_BAD)}
    if(!bytes.length)throw new Error(BACKUP_BAD);
    return {id,blob:new Blob([bytes],{type})};
  });
  const summary={
    days:backupDayCount(journal),
    entries:backupEntryCount(journal),
    images:images.length,
    exportedAt
  };
  return {journal,images,summary};
}
function summaryLine(summary){
  const days=`${summary.days} day${summary.days===1?'':'s'}`;
  const entries=`${summary.entries} entr${summary.entries===1?'y':'ies'}`;
  const images=`${summary.images} image${summary.images===1?'':'s'}`;
  const when=new Date(summary.exportedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  return `${days}, ${entries}, ${images}. Exported ${when}.`;
}
function setBackupError(message){
  const el=$('backupError');
  if(!el)return;
  el.hidden=!message;
  el.textContent=message||'';
}
function clearImportPrompt(){
  pendingImport=null;
  const summary=$('backupSummary');
  const note=$('backupReplaceNote');
  const row=$('backupConfirm');
  if(summary)summary.hidden=true;
  if(note)note.hidden=true;
  if(row)row.hidden=true;
}
function syncBackup(){
  const last=$('backupLast');
  if(last)last.textContent=lastBackupText();
  const banner=$('backupBanner');
  if(banner)banner.hidden=!backupDue();
  const btn=$('backupBtn');
  if(btn)btn.setAttribute('aria-expanded',backupOpen?'true':'false');
  const modal=$('backupModal');
  if(modal)modal.hidden=!backupOpen;
}
function downloadText(name,text){
  const blob=new Blob([text],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function exportBackup(){
  if(backupBusy)return;
  backupBusy=true;
  setBackupError('');
  clearImportPrompt();
  try{
    const records=await allImageRecords();
    const images=[];
    for(const record of records)images.push({id:record.id,type:record.blob.type||'application/octet-stream',data:await blobToBase64(record.blob)});
    const when=Date.now();
    const journal=JSON.parse(JSON.stringify(state));
    journal.lastBackupAt=when;
    journal.backupSnoozeUntil=0;
    const payload={format:1,exportedAt:new Date(when).toISOString(),journal,images};
    downloadText(`field-record-backup-${key(new Date(when))}.json`,JSON.stringify(payload));
    state.lastBackupAt=when;
    state.backupSnoozeUntil=0;
    save();
    syncBackup();
  }catch(e){
    setBackupError('Could not export a backup. Nothing was changed.');
  }finally{
    backupBusy=false;
  }
}
function resetJournalView(){
  openCat=null;
  openGoal=null;
  editingId=null;
  goalEditingId=null;
  tagEdit=false;
  renamingTag=null;
  itemEdit=false;
  itemRenaming=null;
  goalNameEdit=false;
  addingCat=false;
  newType='notes';
  newTracker='shifts';
  addingGoal=false;
  resetShiftUi();
  resetFlowUi();
  abandonRelImages();
  resetRelUi();
  resetRecordUi();
  pendingItem='';
  pendingTag='';
  focusTitle=false;
  imageError='';
  renamingTheme=null;
  bgError='';
  picker=false;
  sessionNew.clear();
  expanded.clear();
  freshDraft(null);
}
async function confirmImport(){
  const pending=pendingImport;
  if(!pending||backupBusy)return;
  backupBusy=true;
  setBackupError('');
  const previousJournal=localStorage.getItem(KEY);
  let previousImages=[];
  try{
    previousImages=await allImageRecords();
    await replaceImages(pending.images);
    localStorage.setItem(KEY,JSON.stringify(pending.journal));
  }catch(e){
    try{
      if(previousJournal==null)localStorage.removeItem(KEY);
      else localStorage.setItem(KEY,previousJournal);
      await replaceImages(previousImages);
    }catch(err){}
    backupBusy=false;
    setBackupError('Could not restore that backup. Nothing was changed.');
    return;
  }
  [...urlCache.values()].forEach(url=>URL.revokeObjectURL(url));
  urlCache.clear();
  state=load();
  const migrated=!!state._migrated;
  if(migrated)delete state._migrated;
  resetJournalView();
  syncSnap=JSON.parse(JSON.stringify(state));
  if(migrated)save();
  applyAppearance();
  scheduleSync();
  clearImportPrompt();
  backupBusy=false;
  render();
}
function chooseBackupFile(ev){
  const input=ev.target;
  const file=input.files&&input.files[0];
  input.value='';
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=parseBackup(String(reader.result||''));
      pendingImport=parsed;
      setBackupError('');
      const summary=$('backupSummary');
      const note=$('backupReplaceNote');
      const row=$('backupConfirm');
      if(summary){summary.hidden=false;summary.textContent=summaryLine(parsed.summary)}
      if(note)note.hidden=false;
      if(row)row.hidden=false;
    }catch(e){
      clearImportPrompt();
      setBackupError(BACKUP_BAD);
    }
  };
  reader.onerror=()=>{
    clearImportPrompt();
    setBackupError('That file could not be read. Nothing was changed.');
  };
  reader.readAsText(file);
}
function openBackup(){
  if(lookOpen)closeLook();
  closeCode();
  backupOpen=true;
  setBackupError('');
  syncBackup();
  const b=$('backupClose');
  if(b)b.focus();
}
function closeBackup(){
  backupOpen=false;
  clearImportPrompt();
  setBackupError('');
  syncBackup();
}
function snoozeBackup(){
  state.backupSnoozeUntil=Date.now()+BACKUP_SNOOZE;
  save();
  syncBackup();
}
function numAt(v){const n=Number(v);return Number.isFinite(n)?n:0}
function idOrder(list){return (list||[]).map(x=>x&&x.id).filter(Boolean).join('\n')}
function ensureGone(s){
  if(!s.gone||typeof s.gone!=='object'||Array.isArray(s.gone))s.gone={};
  GONE_KINDS.forEach(k=>{
    if(!s.gone[k]||typeof s.gone[k]!=='object'||Array.isArray(s.gone[k]))s.gone[k]={};
  });
  return s.gone;
}
function bury(kind,id,ts){
  if(!id)return;
  ensureGone(state);
  const t=ts||Date.now();
  if(t>=numAt(state.gone[kind][id])){state.gone[kind][id]=t;syncDirty=true}
}
function unbury(kind,id){
  if(!id||!state.gone||!state.gone[kind]||state.gone[kind][id]==null)return;
  delete state.gone[kind][id];
  syncDirty=true;
}
function stamp(obj,ts){
  if(!obj||typeof obj!=='object')return;
  obj.updatedAt=ts;
  syncDirty=true;
}
function atLeast(obj,fallback){
  if(!obj||typeof obj!=='object')return false;
  if(Number.isFinite(Number(obj.updatedAt)))return false;
  obj.updatedAt=fallback;
  return true;
}
function stampMissing(s){
  let changed=false;
  ensureGone(s);
  (s.categories||[]).forEach(c=>{
    if(atLeast(c,1))changed=true;
    if(!Number.isFinite(Number(c.listOrderAt))){c.listOrderAt=numAt(c.updatedAt)||1;changed=true}
    if(!Number.isFinite(Number(c.groupOrderAt))&&(c.type==='relationships'||(c.groups||[]).length)){c.groupOrderAt=numAt(c.updatedAt)||1;changed=true}
    if(!c.mealOrderAt||typeof c.mealOrderAt!=='object'||Array.isArray(c.mealOrderAt)){c.mealOrderAt={};changed=true}
    if(!c.shiftOrderAt||typeof c.shiftOrderAt!=='object'||Array.isArray(c.shiftOrderAt)){c.shiftOrderAt={};changed=true}
    if((c.tracker==='flow'||(c.flowOptions||[]).length)&&!Number.isFinite(Number(c.flowOptionOrderAt))){c.flowOptionOrderAt=numAt(c.updatedAt)||1;changed=true}
    if((c.tracker==='flow'||c.flow)&&(!c.flowOrderAt||typeof c.flowOrderAt!=='object'||Array.isArray(c.flowOrderAt))){c.flowOrderAt={};changed=true}
    if(c.tracker==='flow'&&!Number.isFinite(Number(c.showCycleAt))){c.showCycleAt=c.showCycle?1:0;changed=true}
    (c.lists||[]).forEach(list=>{
      if(atLeast(list,1))changed=true;
      if(!Number.isFinite(Number(list.itemOrderAt))){list.itemOrderAt=numAt(list.updatedAt)||1;changed=true}
      (list.items||[]).forEach(it=>{if(atLeast(it,1))changed=true});
    });
    Object.keys(c.meals||{}).forEach(date=>{
      if(!Number.isFinite(Number(c.mealOrderAt[date]))){c.mealOrderAt[date]=1;changed=true}
      (c.meals[date]||[]).forEach(meal=>{
        if(atLeast(meal,1))changed=true;
        if(!Number.isFinite(Number(meal.itemOrderAt))){meal.itemOrderAt=numAt(meal.updatedAt)||1;changed=true}
        (meal.items||[]).forEach(it=>{if(atLeast(it,1))changed=true});
      });
    });
    Object.keys(c.shifts||{}).forEach(date=>{
      if(!Number.isFinite(Number(c.shiftOrderAt[date]))){c.shiftOrderAt[date]=1;changed=true}
      (c.shifts[date]||[]).forEach(sh=>{if(atLeast(sh,1))changed=true});
    });
    (c.flowOptions||[]).forEach(opt=>{if(atLeast(opt,1))changed=true});
    Object.keys(c.flow||{}).forEach(date=>{
      const logs=c.flow[date];
      if(!Array.isArray(logs))return;
      if(c.flowOrderAt&&!Number.isFinite(Number(c.flowOrderAt[date]))){c.flowOrderAt[date]=1;changed=true}
      logs.forEach(log=>{if(atLeast(log,1))changed=true});
    });
    (c.groups||[]).forEach(g=>{if(atLeast(g,1))changed=true});
    (c.people||[]).forEach(p=>{
      if(atLeast(p,1))changed=true;
      if(!Number.isFinite(Number(p.sectionOrderAt))){p.sectionOrderAt=numAt(p.updatedAt)||1;changed=true}
      (p.sections||[]).forEach(sec=>{if(atLeast(sec,1))changed=true});
      (p.notes||[]).forEach(n=>{if(atLeast(n,1))changed=true});
    });
    (c.records||[]).forEach(r=>{if(atLeast(r,Number(r.createdAt)||1))changed=true});
  });
  (s.entries||[]).forEach(e=>{if(atLeast(e,Number(e.createdAt)||1))changed=true});
  (s.goals||[]).forEach(g=>{
    if(atLeast(g,1))changed=true;
    if(!Number.isFinite(Number(g.itemOrderAt))){g.itemOrderAt=numAt(g.updatedAt)||1;changed=true}
    (g.items||[]).forEach(it=>{if(atLeast(it,1))changed=true});
    (g.entries||[]).forEach(e=>{if(atLeast(e,Number(e.createdAt)||1))changed=true});
    Object.keys(g.days||{}).forEach(date=>{
      const day=g.days[date];
      if(!day.checkAt||typeof day.checkAt!=='object'||Array.isArray(day.checkAt)){day.checkAt={};changed=true}
      (day.checks||[]).forEach(id=>{if(!Number.isFinite(Number(day.checkAt[id]))){day.checkAt[id]=1;changed=true}});
    });
  });
  (s.themes||[]).forEach(t=>{if(atLeast(t,1))changed=true});
  if(!s.dayTitleAt||typeof s.dayTitleAt!=='object'||Array.isArray(s.dayTitleAt)){s.dayTitleAt={};changed=true}
  Object.keys(s.dayTitles||{}).forEach(d=>{if(!Number.isFinite(Number(s.dayTitleAt[d]))){s.dayTitleAt[d]=1;changed=true}});
  if(!Number.isFinite(Number(s.appearanceAt))){s.appearanceAt=1;changed=true}
  return changed;
}
function collectImageIds(s){
  const ids=new Set();
  const add=id=>{if(id)ids.add(String(id))};
  (s.entries||[]).forEach(e=>(e.images||[]).forEach(add));
  (s.goals||[]).forEach(g=>(g.entries||[]).forEach(e=>(e.images||[]).forEach(add)));
  (s.categories||[]).forEach(c=>{
    if(!c)return;
    (c.people||[]).forEach(p=>{
      add(p.photoId);
      (p.notes||[]).forEach(n=>(n.images||[]).forEach(add));
    });
    (c.records||[]).forEach(r=>(r.images||[]).forEach(add));
  });
  if(s.skin&&s.skin.uploadId)add(s.skin.uploadId);
  (s.themes||[]).forEach(t=>{if(t.skin&&t.skin.uploadId)add(t.skin.uploadId)});
  return ids;
}
function diffChildren(prevList,nextList,kind,prefix,ts,sig){
  const pm=new Map((prevList||[]).filter(x=>x&&x.id).map(x=>[x.id,x]));
  const seen=new Set();
  (nextList||[]).forEach(item=>{
    if(!item||!item.id)return;
    seen.add(item.id);
    const key=prefix+item.id;
    const old=pm.get(item.id);
    if(!old){stamp(item,ts);unbury(kind,key);return}
    if(sig(old)!==sig(item))stamp(item,ts);
    if(numAt(item.updatedAt)>numAt(state.gone[kind]&&state.gone[kind][key]))unbury(kind,key);
  });
  (prevList||[]).forEach(item=>{
    if(item&&item.id&&!seen.has(item.id))bury(kind,prefix+item.id,ts);
  });
}
function categoryShellSig(c){
  return JSON.stringify({name:c.name,type:c.type,tags:c.tags,sectionNames:c.sectionNames,sectionTags:c.sectionTags,place:c.place,tracker:c.tracker});
}
function buryCategory(c,ts){
  bury('category',c.id,ts);
  (c.lists||[]).forEach(list=>{
    bury('list',c.id+'/'+list.id,ts);
    (list.items||[]).forEach(it=>bury('listItem',c.id+'/'+list.id+'/'+it.id,ts));
  });
  Object.keys(c.meals||{}).forEach(date=>(c.meals[date]||[]).forEach(meal=>{
    bury('meal',c.id+'/'+date+'/'+meal.id,ts);
    (meal.items||[]).forEach(it=>bury('mealItem',c.id+'/'+date+'/'+meal.id+'/'+it.id,ts));
  }));
  Object.keys(c.shifts||{}).forEach(date=>(c.shifts[date]||[]).forEach(sh=>bury('shift',c.id+'/'+date+'/'+sh.id,ts)));
  (c.flowOptions||[]).forEach(opt=>bury('flowOption',c.id+'/'+opt.id,ts));
  Object.keys(c.flow||{}).forEach(date=>{
    const logs=c.flow[date];
    if(Array.isArray(logs))logs.forEach(log=>log&&log.id&&bury('flowLog',c.id+'/'+date+'/'+log.id,ts));
  });
  (c.groups||[]).forEach(g=>bury('group',c.id+'/'+g.id,ts));
  (c.people||[]).forEach(p=>{
    bury('person',c.id+'/'+p.id,ts);
    (p.sections||[]).forEach(sec=>bury('relSection',p.id+'/'+sec.id,ts));
    (p.notes||[]).forEach(n=>bury('relNote',n.id,ts));
  });
  (c.records||[]).forEach(r=>r&&r.id&&bury('record',c.id+'/'+r.id,ts));
}
function diffLists(prev,next,ts){
  const catId=next.id;
  if(idOrder(prev.lists)!==idOrder(next.lists)){next.listOrderAt=ts;syncDirty=true}
  const pm=new Map((prev.lists||[]).filter(l=>l&&l.id).map(l=>[l.id,l]));
  const seen=new Set();
  (next.lists||[]).forEach(list=>{
    if(!list||!list.id)return;
    seen.add(list.id);
    const old=pm.get(list.id);
    const key=catId+'/'+list.id;
    if(!old){
      stamp(list,ts);list.itemOrderAt=ts;
      (list.items||[]).forEach(it=>stamp(it,ts));
      unbury('list',key);
      return;
    }
    if((old.name||'')!==(list.name||''))stamp(list,ts);
    if(idOrder(old.items)!==idOrder(list.items)){list.itemOrderAt=ts;syncDirty=true}
    diffChildren(old.items,list.items,'listItem',key+'/',ts,it=>JSON.stringify({text:it.text,amount:it.amount,checked:!!it.checked}));
    if(numAt(list.updatedAt)>numAt(state.gone.list[key]))unbury('list',key);
  });
  (prev.lists||[]).forEach(list=>{
    if(!list||!list.id||seen.has(list.id))return;
    bury('list',catId+'/'+list.id,ts);
    (list.items||[]).forEach(it=>bury('listItem',catId+'/'+list.id+'/'+it.id,ts));
  });
}
function diffMeals(prev,next,ts){
  const catId=next.id;
  if(!next.mealOrderAt||typeof next.mealOrderAt!=='object')next.mealOrderAt={};
  const dates=new Set([...Object.keys(prev.meals||{}),...Object.keys(next.meals||{})]);
  dates.forEach(date=>{
    const a=(prev.meals&&prev.meals[date])||[];
    const b=(next.meals&&next.meals[date])||[];
    if(idOrder(a)!==idOrder(b)){next.mealOrderAt[date]=ts;syncDirty=true}
    const pm=new Map(a.filter(m=>m&&m.id).map(m=>[m.id,m]));
    const seen=new Set();
    b.forEach(meal=>{
      if(!meal||!meal.id)return;
      seen.add(meal.id);
      const old=pm.get(meal.id);
      const key=catId+'/'+date+'/'+meal.id;
      if(!old){
        stamp(meal,ts);meal.itemOrderAt=ts;
        (meal.items||[]).forEach(it=>stamp(it,ts));
        unbury('meal',key);
        return;
      }
      if((old.name||'')!==(meal.name||''))stamp(meal,ts);
      if(idOrder(old.items)!==idOrder(meal.items)){meal.itemOrderAt=ts;syncDirty=true}
      diffChildren(old.items,meal.items,'mealItem',key+'/',ts,it=>JSON.stringify({text:it.text,amount:it.amount,sourceId:it.sourceId}));
      if(numAt(meal.updatedAt)>numAt(state.gone.meal[key]))unbury('meal',key);
    });
    a.forEach(meal=>{
      if(!meal||!meal.id||seen.has(meal.id))return;
      bury('meal',catId+'/'+date+'/'+meal.id,ts);
      (meal.items||[]).forEach(it=>bury('mealItem',catId+'/'+date+'/'+meal.id+'/'+it.id,ts));
    });
  });
}
function diffShifts(prev,next,ts){
  const catId=next.id;
  if(!next.shiftOrderAt||typeof next.shiftOrderAt!=='object')next.shiftOrderAt={};
  const dates=new Set([...Object.keys(prev.shifts||{}),...Object.keys(next.shifts||{})]);
  dates.forEach(date=>{
    const a=(prev.shifts&&prev.shifts[date])||[];
    const b=(next.shifts&&next.shifts[date])||[];
    if(idOrder(a)!==idOrder(b)){next.shiftOrderAt[date]=ts;syncDirty=true}
    diffChildren(a,b,'shift',catId+'/'+date+'/',ts,sh=>JSON.stringify({start:sh.start,end:sh.end,breakMinutes:sh.breakMinutes,label:sh.label}));
  });
}
function diffFlow(prev,next,ts){
  const catId=next.id;
  if(!Array.isArray(next.flowOptions))next.flowOptions=[];
  if(idOrder(prev.flowOptions)!==idOrder(next.flowOptions)){next.flowOptionOrderAt=ts;syncDirty=true}
  diffChildren(prev.flowOptions,next.flowOptions,'flowOption',catId+'/',ts,opt=>JSON.stringify({name:opt.name,color:opt.color,shape:opt.shape}));
  if(!!prev.showCycle!==!!next.showCycle){next.showCycleAt=ts;syncDirty=true}
  if(!next.flowOrderAt||typeof next.flowOrderAt!=='object'||Array.isArray(next.flowOrderAt))next.flowOrderAt={};
  const dates=new Set([...Object.keys(prev.flow||{}),...Object.keys(next.flow||{})]);
  dates.forEach(date=>{
    const a=Array.isArray(prev.flow&&prev.flow[date])?prev.flow[date]:[];
    const b=Array.isArray(next.flow&&next.flow[date])?next.flow[date]:[];
    if(idOrder(a)!==idOrder(b)){next.flowOrderAt[date]=ts;syncDirty=true}
    diffChildren(a,b,'flowLog',catId+'/'+date+'/',ts,log=>JSON.stringify({optionId:log.optionId,time:log.time||''}));
  });
}
function diffRelationships(prev,next,ts){
  const catId=next.id;
  if(idOrder(prev.groups)!==idOrder(next.groups)){next.groupOrderAt=ts;syncDirty=true}
  diffChildren(prev.groups,next.groups,'group',catId+'/',ts,g=>g.name||'');
  const pm=new Map((prev.people||[]).filter(p=>p&&p.id).map(p=>[p.id,p]));
  const seen=new Set();
  (next.people||[]).forEach(p=>{
    if(!p||!p.id)return;
    seen.add(p.id);
    const old=pm.get(p.id);
    const key=catId+'/'+p.id;
    if(!old){
      stamp(p,ts);p.sectionOrderAt=ts;
      (p.sections||[]).forEach(sec=>stamp(sec,ts));
      (p.notes||[]).forEach(n=>stamp(n,ts));
      unbury('person',key);
      return;
    }
    const shell=o=>JSON.stringify({name:o.name,groupId:o.groupId,photoId:o.photoId||'',tags:o.tags||[],noteTags:o.noteTags||[]});
    if(shell(old)!==shell(p))stamp(p,ts);
    if(idOrder(old.sections)!==idOrder(p.sections)){p.sectionOrderAt=ts;syncDirty=true}
    diffChildren(old.sections,p.sections,'relSection',p.id+'/',ts,sec=>JSON.stringify({name:sec.name,text:sec.text}));
    diffChildren(old.notes,p.notes,'relNote','',ts,n=>JSON.stringify({date:n.date,title:n.title,note:n.note,tags:n.tags,images:n.images}));
    if(numAt(p.updatedAt)>numAt(state.gone.person[key]))unbury('person',key);
  });
  (prev.people||[]).forEach(p=>{
    if(!p||!p.id||seen.has(p.id))return;
    bury('person',catId+'/'+p.id,ts);
    (p.sections||[]).forEach(sec=>bury('relSection',p.id+'/'+sec.id,ts));
    (p.notes||[]).forEach(n=>bury('relNote',n.id,ts));
  });
}
function diffRecords(prev,next,ts){
  diffChildren(prev.records,next.records,'record',next.id+'/',ts,r=>JSON.stringify({title:r.title,note:r.note,tags:r.tags,images:r.images}));
}
function diffGoals(prev,next,ts){
  const pm=new Map((prev.goals||[]).filter(g=>g&&g.id).map(g=>[g.id,g]));
  const seen=new Set();
  (next.goals||[]).forEach(g=>{
    if(!g||!g.id)return;
    seen.add(g.id);
    const old=pm.get(g.id);
    if(!old){
      stamp(g,ts);g.itemOrderAt=ts;
      (g.items||[]).forEach(it=>stamp(it,ts));
      (g.entries||[]).forEach(e=>stamp(e,ts));
      unbury('goal',g.id);
      return;
    }
    if(JSON.stringify({name:old.name,type:old.type,tags:old.tags})!==JSON.stringify({name:g.name,type:g.type,tags:g.tags}))stamp(g,ts);
    if(idOrder(old.items)!==idOrder(g.items)){g.itemOrderAt=ts;syncDirty=true}
    diffChildren(old.items,g.items,'goalItem',g.id+'/',ts,it=>it.name||'');
    diffChildren(old.entries,g.entries,'goalEntry','',ts,e=>JSON.stringify({date:e.date,title:e.title,note:e.note,tags:e.tags,images:e.images}));
    const dates=new Set([...Object.keys(old.days||{}),...Object.keys(g.days||{})]);
    dates.forEach(date=>{
      const a=old.days&&old.days[date];
      const b=g.days&&g.days[date];
      const aSet=new Set((a&&a.checks)||[]);
      const bSet=new Set((b&&b.checks)||[]);
      if(b){
        if(!b.checkAt||typeof b.checkAt!=='object')b.checkAt={};
        bSet.forEach(id=>{
          if(!aSet.has(id)){b.checkAt[id]=ts;syncDirty=true;unbury('goalCheck',g.id+'/'+date+'/'+id)}
        });
      }
      aSet.forEach(id=>{if(!bSet.has(id))bury('goalCheck',g.id+'/'+date+'/'+id,ts)});
    });
    if(numAt(g.updatedAt)>numAt(state.gone.goal[g.id]))unbury('goal',g.id);
  });
  (prev.goals||[]).forEach(g=>{
    if(!g||!g.id||seen.has(g.id))return;
    bury('goal',g.id,ts);
    (g.items||[]).forEach(it=>bury('goalItem',g.id+'/'+it.id,ts));
    (g.entries||[]).forEach(e=>bury('goalEntry',e.id,ts));
    Object.keys(g.days||{}).forEach(date=>((g.days[date]&&g.days[date].checks)||[]).forEach(id=>bury('goalCheck',g.id+'/'+date+'/'+id,ts)));
  });
}
function noteEdits(){
  syncDirty=false;
  ensureGone(state);
  if(!syncSnap){stampMissing(state);return false}
  const prev=syncSnap;
  const ts=Date.now();
  const pm=new Map((prev.categories||[]).filter(c=>c&&c.id).map(c=>[c.id,c]));
  const seen=new Set();
  (state.categories||[]).forEach(c=>{
    if(!c||!c.id)return;
    seen.add(c.id);
    const old=pm.get(c.id);
    if(!old){
      stamp(c,ts);
      unbury('category',c.id);
      diffLists({lists:[]},c,ts);
      diffMeals({meals:{},id:c.id},c,ts);
      diffShifts({shifts:{},id:c.id},c,ts);
      diffFlow({flow:{},id:c.id},c,ts);
      diffRelationships({groups:[],people:[],id:c.id},c,ts);
      diffRecords({records:[],id:c.id},c,ts);
      return;
    }
    if(categoryShellSig(old)!==categoryShellSig(c))stamp(c,ts);
    diffLists(old,c,ts);
    diffMeals(old,c,ts);
    diffShifts(old,c,ts);
    diffFlow(old,c,ts);
    diffRelationships(old,c,ts);
    diffRecords(old,c,ts);
    if(numAt(c.updatedAt)>numAt(state.gone.category[c.id]))unbury('category',c.id);
  });
  (prev.categories||[]).forEach(c=>{if(c&&c.id&&!seen.has(c.id))buryCategory(c,ts)});
  diffChildren(prev.entries,state.entries,'entry','',ts,e=>JSON.stringify({categoryId:e.categoryId,date:e.date,title:e.title,note:e.note,tags:e.tags,images:e.images,sections:e.sections,timerStart:e.timerStart,timerEnd:e.timerEnd,durationMinutes:e.durationMinutes,condition:e.condition,temperature:e.temperature,dreams:e.dreams}));
  diffGoals(prev,state,ts);
  diffChildren(prev.themes,state.themes,'theme','',ts,t=>JSON.stringify({name:t.name,skin:t.skin}));
  if(!state.dayTitleAt||typeof state.dayTitleAt!=='object')state.dayTitleAt={};
  const prevTitles=prev.dayTitles||{}, nextTitles=state.dayTitles||{};
  Object.keys(prevTitles).forEach(d=>{if(!(d in nextTitles))bury('dayTitle',d,ts)});
  Object.keys(nextTitles).forEach(d=>{
    if(prevTitles[d]!==nextTitles[d]){state.dayTitleAt[d]=ts;syncDirty=true;unbury('dayTitle',d)}
  });
  const appearance=s=>JSON.stringify({look:s.look||'paper',skin:s.skin||null});
  if(appearance(prev)!==appearance(state)){state.appearanceAt=ts;syncDirty=true}
  const before=collectImageIds(prev), after=collectImageIds(state);
  after.forEach(id=>{if(!before.has(id))unbury('image',id)});
  before.forEach(id=>{if(!after.has(id))bury('image',id,ts)});
  return syncDirty;
}
function unionStrings(a,b){
  const out=[];
  [...(a||[]),...(b||[])].forEach(t=>{if(typeof t==='string'&&t&&!out.some(x=>x.toLowerCase()===t.toLowerCase()))out.push(t)});
  return out;
}
function mergeStampMap(a,b){
  const out={};
  Object.keys(a||{}).forEach(k=>{const n=numAt(a[k]);if(n)out[k]=n});
  Object.keys(b||{}).forEach(k=>{const n=numAt(b[k]);if(n>numAt(out[k]))out[k]=n});
  return out;
}
function applyOrder(items,primary,secondary){
  const map=new Map((items||[]).filter(it=>it&&it.id).map(it=>[it.id,it]));
  const out=[], seen=new Set();
  const take=list=>(list||[]).forEach(it=>{
    if(it&&map.has(it.id)&&!seen.has(it.id)){seen.add(it.id);out.push(map.get(it.id))}
  });
  take(primary);take(secondary);
  (items||[]).forEach(it=>{if(it&&it.id&&!seen.has(it.id))out.push(it)});
  return out;
}
function alive(gone,kind,id,ts){
  const bag=gone[kind]||(gone[kind]={});
  const tomb=numAt(bag[id]);
  if(!tomb)return true;
  if(numAt(ts)>tomb){delete bag[id];return true}
  return false;
}
function mergeItems(listA,listB,kind,prefix,gone){
  const map=new Map();
  const put=list=>(list||[]).forEach(item=>{
    if(!item||!item.id)return;
    const copy=JSON.parse(JSON.stringify(item));
    const cur=map.get(item.id);
    if(!cur||numAt(copy.updatedAt)>numAt(cur.updatedAt))map.set(item.id,copy);
  });
  put(listA);put(listB);
  return [...map.values()].filter(item=>alive(gone,kind,prefix+item.id,item.updatedAt));
}
function mergeLists(a,b,gone){
  const catId=a.id||b.id;
  const map=new Map();
  const put=src=>(src.lists||[]).forEach(list=>{
    if(!list||!list.id)return;
    const copy=JSON.parse(JSON.stringify(list));
    const cur=map.get(list.id);
    if(!cur){map.set(list.id,copy);return}
    const newer=numAt(copy.updatedAt)>=numAt(cur.updatedAt)?copy:cur;
    const merged=JSON.parse(JSON.stringify(newer));
    const items=mergeItems(cur.items,copy.items,'listItem',catId+'/'+list.id+'/',gone);
    const primary=numAt(copy.itemOrderAt)>numAt(cur.itemOrderAt)?copy.items:cur.items;
    const secondary=primary===copy.items?cur.items:copy.items;
    merged.items=applyOrder(items,primary,secondary);
    merged.itemOrderAt=Math.max(numAt(cur.itemOrderAt),numAt(copy.itemOrderAt));
    map.set(list.id,merged);
  });
  put(a);put(b);
  let lists=[...map.values()].filter(list=>alive(gone,'list',catId+'/'+list.id,list.updatedAt));
  const primary=numAt(b.listOrderAt)>numAt(a.listOrderAt)?b.lists:a.lists;
  const secondary=primary===a.lists?b.lists:a.lists;
  lists=applyOrder(lists,primary,secondary);
  return {lists,listOrderAt:Math.max(numAt(a.listOrderAt),numAt(b.listOrderAt))};
}
function mergeMeals(a,b,gone){
  const catId=a.id||b.id;
  const meals={};
  const mealOrderAt=mergeStampMap(a.mealOrderAt,b.mealOrderAt);
  const dates=new Set([...Object.keys(a.meals||{}),...Object.keys(b.meals||{})]);
  dates.forEach(date=>{
    const la=(a.meals&&a.meals[date])||[];
    const lb=(b.meals&&b.meals[date])||[];
    const map=new Map();
    [la,lb].forEach(list=>list.forEach(meal=>{
      if(!meal||!meal.id)return;
      const copy=JSON.parse(JSON.stringify(meal));
      const cur=map.get(meal.id);
      if(!cur){map.set(meal.id,copy);return}
      const newer=numAt(copy.updatedAt)>=numAt(cur.updatedAt)?copy:cur;
      const merged=JSON.parse(JSON.stringify(newer));
      const items=mergeItems(cur.items,copy.items,'mealItem',catId+'/'+date+'/'+meal.id+'/',gone);
      const primary=numAt(copy.itemOrderAt)>numAt(cur.itemOrderAt)?copy.items:cur.items;
      const secondary=primary===copy.items?cur.items:copy.items;
      merged.items=applyOrder(items,primary,secondary);
      merged.itemOrderAt=Math.max(numAt(cur.itemOrderAt),numAt(copy.itemOrderAt));
      map.set(meal.id,merged);
    }));
    let arr=[...map.values()].filter(meal=>alive(gone,'meal',catId+'/'+date+'/'+meal.id,meal.updatedAt));
    const primary=numAt(mealOrderAt[date])&&numAt(b.mealOrderAt&&b.mealOrderAt[date])>numAt(a.mealOrderAt&&a.mealOrderAt[date])?lb:la;
    const secondary=primary===la?lb:la;
    arr=applyOrder(arr,primary,secondary);
    if(arr.length)meals[date]=arr;
  });
  return {meals,mealOrderAt};
}
function mergeShifts(a,b,gone){
  const catId=a.id||b.id;
  const shifts={};
  const shiftOrderAt=mergeStampMap(a.shiftOrderAt,b.shiftOrderAt);
  const dates=new Set([...Object.keys(a.shifts||{}),...Object.keys(b.shifts||{})]);
  dates.forEach(date=>{
    const la=(a.shifts&&a.shifts[date])||[];
    const lb=(b.shifts&&b.shifts[date])||[];
    let arr=mergeItems(la,lb,'shift',catId+'/'+date+'/',gone);
    const primary=numAt(b.shiftOrderAt&&b.shiftOrderAt[date])>numAt(a.shiftOrderAt&&a.shiftOrderAt[date])?lb:la;
    const secondary=primary===la?lb:la;
    arr=applyOrder(arr,primary,secondary);
    if(arr.length)shifts[date]=arr;
  });
  return {shifts,shiftOrderAt};
}
function mergeFlow(a,b,gone){
  const catId=a.id||b.id;
  const options=mergeItems(a.flowOptions,b.flowOptions,'flowOption',catId+'/',gone);
  const optPrimary=numAt(b.flowOptionOrderAt)>numAt(a.flowOptionOrderAt)?b.flowOptions:a.flowOptions;
  const optSecondary=optPrimary===a.flowOptions?b.flowOptions:a.flowOptions;
  const flowOptions=applyOrder(options,optPrimary,optSecondary);
  const flow={};
  const flowOrderAt=mergeStampMap(a.flowOrderAt,b.flowOrderAt);
  const dates=new Set([...Object.keys(a.flow||{}),...Object.keys(b.flow||{})]);
  dates.forEach(date=>{
    const la=Array.isArray(a.flow&&a.flow[date])?a.flow[date]:[];
    const lb=Array.isArray(b.flow&&b.flow[date])?b.flow[date]:[];
    let arr=mergeItems(la,lb,'flowLog',catId+'/'+date+'/',gone);
    const primary=numAt(b.flowOrderAt&&b.flowOrderAt[date])>numAt(a.flowOrderAt&&a.flowOrderAt[date])?lb:la;
    const secondary=primary===la?lb:la;
    arr=applyOrder(arr,primary,secondary);
    if(arr.length)flow[date]=arr;
  });
  const showCycle=numAt(b.showCycleAt)>numAt(a.showCycleAt)?!!b.showCycle:!!a.showCycle;
  return {flow,flowOptions,flowOptionOrderAt:Math.max(numAt(a.flowOptionOrderAt),numAt(b.flowOptionOrderAt)),flowOrderAt,showCycle,showCycleAt:Math.max(numAt(a.showCycleAt),numAt(b.showCycleAt))};
}
function mergeRelationships(a,b,gone){
  const catId=a.id||b.id;
  const gmap=new Map();
  [a,b].forEach(src=>(src.groups||[]).forEach(g=>{
    if(!g||!g.id)return;
    const copy=JSON.parse(JSON.stringify(g));
    const cur=gmap.get(g.id);
    if(!cur||numAt(copy.updatedAt)>=numAt(cur.updatedAt))gmap.set(g.id,copy);
  }));
  let groups=[...gmap.values()].filter(g=>alive(gone,'group',catId+'/'+g.id,g.updatedAt));
  const gPrimary=numAt(b.groupOrderAt)>numAt(a.groupOrderAt)?b.groups:a.groups;
  const gSecondary=gPrimary===a.groups?b.groups:a.groups;
  groups=applyOrder(groups,gPrimary,gSecondary);
  const pmap=new Map();
  [a,b].forEach(src=>(src.people||[]).forEach(p=>{
    if(!p||!p.id)return;
    const copy=JSON.parse(JSON.stringify(p));
    const cur=pmap.get(p.id);
    if(!cur){pmap.set(p.id,copy);return}
    const newer=numAt(copy.updatedAt)>=numAt(cur.updatedAt)?copy:cur;
    const merged=JSON.parse(JSON.stringify(newer));
    merged.tags=unionStrings(cur.tags,copy.tags);
    merged.noteTags=unionStrings(cur.noteTags,copy.noteTags);
    const sections=mergeItems(cur.sections,copy.sections,'relSection',p.id+'/',gone);
    const secPrimary=numAt(copy.sectionOrderAt)>numAt(cur.sectionOrderAt)?copy.sections:cur.sections;
    const secSecondary=secPrimary===copy.sections?cur.sections:copy.sections;
    merged.sections=applyOrder(sections,secPrimary,secSecondary);
    merged.sectionOrderAt=Math.max(numAt(cur.sectionOrderAt),numAt(copy.sectionOrderAt));
    merged.notes=mergeItems(cur.notes,copy.notes,'relNote','',gone);
    pmap.set(p.id,merged);
  }));
  let people=[...pmap.values()].filter(p=>alive(gone,'person',catId+'/'+p.id,p.updatedAt));
  people.forEach(p=>{
    if(groups.some(g=>g.id===p.groupId))return;
    const src=(a.groups||[]).find(g=>g.id===p.groupId)||(b.groups||[]).find(g=>g.id===p.groupId);
    const tomb=numAt(gone.group&&gone.group[catId+'/'+p.groupId]);
    if(numAt(p.updatedAt)>tomb){
      if(gone.group)delete gone.group[catId+'/'+p.groupId];
      groups.push(src?JSON.parse(JSON.stringify(src)):{id:p.groupId,name:'Group',updatedAt:p.updatedAt});
    }
  });
  people=people.filter(p=>groups.some(g=>g.id===p.groupId));
  return {groups,people,groupOrderAt:Math.max(numAt(a.groupOrderAt),numAt(b.groupOrderAt))};
}
function mergeSectionTags(a,b){
  const out={};
  [a,b].forEach(src=>{
    if(!src||typeof src!=='object'||Array.isArray(src))return;
    Object.keys(src).forEach(k=>{
      const key=Object.keys(out).find(x=>x.toLowerCase()===k.toLowerCase())||k;
      out[key]=unionStrings(out[key],src[k]);
    });
  });
  return out;
}
function unionNames(primary,secondary){
  const out=[];
  [...(primary||[]),...(secondary||[])].forEach(n=>{if(typeof n==='string'&&!out.some(x=>x.toLowerCase()===n.toLowerCase()))out.push(n)});
  return out;
}
function mergeCategory(a,b,gone){
  const newer=numAt(b.updatedAt)>=numAt(a.updatedAt)?b:a;
  const older=newer===a?b:a;
  const out=JSON.parse(JSON.stringify(newer));
  out.tags=unionStrings(a.tags,b.tags);
  out.sectionNames=unionNames(newer.sectionNames,older.sectionNames);
  out.sectionTags=mergeSectionTags(a.sectionTags,b.sectionTags);
  const lists=mergeLists(a,b,gone);
  out.lists=lists.lists;out.listOrderAt=lists.listOrderAt;
  const meals=mergeMeals(a,b,gone);
  out.meals=meals.meals;out.mealOrderAt=meals.mealOrderAt;
  const shifts=mergeShifts(a,b,gone);
  out.shifts=shifts.shifts;out.shiftOrderAt=shifts.shiftOrderAt;
  const flow=mergeFlow(a,b,gone);
  out.flow=flow.flow;
  if(a.tracker==='flow'||b.tracker==='flow'||(flow.flowOptions||[]).length){
    out.flowOptions=flow.flowOptions;
    out.flowOptionOrderAt=flow.flowOptionOrderAt;
    out.flowOrderAt=flow.flowOrderAt;
    out.showCycle=flow.showCycle;
    out.showCycleAt=flow.showCycleAt;
  }
  if(a.type==='relationships'||b.type==='relationships'||(a.groups||[]).length||(b.groups||[]).length||(a.people||[]).length||(b.people||[]).length){
    const rel=mergeRelationships(a,b,gone);
    out.groups=rel.groups;out.people=rel.people;out.groupOrderAt=rel.groupOrderAt;
  }
  if(a.type==='record'||b.type==='record'||(a.records||[]).length||(b.records||[]).length){
    out.records=mergeRecords(a,b,gone);
  }
  out.updatedAt=Math.max(numAt(a.updatedAt),numAt(b.updatedAt));
  return out;
}
function mergeRecords(a,b,gone){
  const catId=a.id||b.id;
  const map=new Map();
  [a,b].forEach(src=>(src.records||[]).forEach(r=>{
    if(!r||!r.id)return;
    const copy=JSON.parse(JSON.stringify(r));
    const cur=map.get(r.id);
    if(!cur){map.set(r.id,copy);return}
    const newer=numAt(copy.updatedAt)>=numAt(cur.updatedAt)?copy:cur;
    const merged=JSON.parse(JSON.stringify(newer));
    merged.tags=unionStrings(cur.tags,copy.tags);
    map.set(r.id,merged);
  }));
  return [...map.values()].filter(r=>alive(gone,'record',catId+'/'+r.id,r.updatedAt));
}
function categoryHasLiveChild(c){
  if((c.lists||[]).length)return true;
  if((c.people||[]).length)return true;
  if((c.records||[]).length)return true;
  if(c.meals&&Object.keys(c.meals).some(d=>(c.meals[d]||[]).length))return true;
  if(c.shifts&&Object.keys(c.shifts).some(d=>(c.shifts[d]||[]).length))return true;
  if((c.flowOptions||[]).length)return true;
  if(c.flow&&Object.keys(c.flow).some(d=>Array.isArray(c.flow[d])?c.flow[d].length:c.flow[d]))return true;
  return false;
}
function mergeCategories(local,remote,gone){
  const map=new Map();
  (local||[]).forEach(c=>{if(c&&c.id)map.set(c.id,JSON.parse(JSON.stringify(c)))});
  (remote||[]).forEach(c=>{
    if(!c||!c.id)return;
    const cur=map.get(c.id);
    map.set(c.id,cur?mergeCategory(cur,c,gone):JSON.parse(JSON.stringify(c)));
  });
  return [...map.values()].filter(c=>{
    if(alive(gone,'category',c.id,c.updatedAt))return true;
    if(categoryHasLiveChild(c)){if(gone.category)delete gone.category[c.id];return true}
    return false;
  });
}
function mergeGoalDays(a,b,gone){
  const days={};
  const dates=new Set([...Object.keys(a.days||{}),...Object.keys(b.days||{})]);
  dates.forEach(date=>{
    const da=a.days&&a.days[date]||{};
    const db=b.days&&b.days[date]||{};
    const ids=new Set([...(da.checks||[]),...(db.checks||[])]);
    Object.keys(gone.goalCheck||{}).forEach(k=>{
      const prefix=a.id+'/'+date+'/';
      if(k.startsWith(prefix))ids.add(k.slice(prefix.length));
    });
    const checks=[], checkAt={};
    ids.forEach(id=>{
      const onA=(da.checks||[]).includes(id)?numAt(da.checkAt&&da.checkAt[id]):0;
      const onB=(db.checks||[]).includes(id)?numAt(db.checkAt&&db.checkAt[id]):0;
      const best=Math.max(onA,onB);
      const key=a.id+'/'+date+'/'+id;
      const tomb=numAt(gone.goalCheck[key]);
      if(best>tomb){
        checks.push(id);checkAt[id]=best;
        if(tomb)delete gone.goalCheck[key];
      }
    });
    if(checks.length)days[date]={note:'',tags:[],checks,checkAt};
  });
  return days;
}
function mergeGoals(listA,listB,gone){
  const map=new Map();
  [listA,listB].forEach(list=>(list||[]).forEach(g=>{
    if(!g||!g.id)return;
    const copy=JSON.parse(JSON.stringify(g));
    const cur=map.get(g.id);
    if(!cur){map.set(g.id,copy);return}
    const newer=numAt(copy.updatedAt)>=numAt(cur.updatedAt)?copy:cur;
    const merged=JSON.parse(JSON.stringify(newer));
    merged.tags=unionStrings(cur.tags,copy.tags);
    const items=mergeItems(cur.items,copy.items,'goalItem',g.id+'/',gone);
    const primary=numAt(copy.itemOrderAt)>numAt(cur.itemOrderAt)?copy.items:cur.items;
    const secondary=primary===copy.items?cur.items:copy.items;
    merged.items=applyOrder(items,primary,secondary);
    merged.itemOrderAt=Math.max(numAt(cur.itemOrderAt),numAt(copy.itemOrderAt));
    merged.entries=mergeItems(cur.entries,copy.entries,'goalEntry','',gone);
    merged.days=mergeGoalDays(cur,copy,gone);
    map.set(g.id,merged);
  }));
  return [...map.values()].filter(g=>{
    if(alive(gone,'goal',g.id,g.updatedAt))return true;
    const live=(g.items||[]).length||(g.entries||[]).length||Object.keys(g.days||{}).length;
    if(live){if(gone.goal)delete gone.goal[g.id];return true}
    return false;
  });
}
function mergeDayTitles(local,remote,gone){
  const titles={}, at={};
  [local,remote].forEach(src=>Object.keys(src.dayTitles||{}).forEach(d=>{
    const t=numAt(src.dayTitleAt&&src.dayTitleAt[d]);
    if(at[d]==null||t>at[d]){titles[d]=src.dayTitles[d];at[d]=t}
  }));
  Object.keys(titles).forEach(d=>{
    if(!alive(gone,'dayTitle',d,at[d])){delete titles[d];delete at[d]}
  });
  return {dayTitles:titles,dayTitleAt:at};
}
function mergeJournal(local,remote){
  if(!remote||typeof remote!=='object'||Array.isArray(remote))throw new Error('Could not read the synced journal. The journal on this device was kept.');
  const gone={};
  GONE_KINDS.forEach(k=>{gone[k]=mergeStampMap(local&&local.gone&&local.gone[k], remote.gone&&remote.gone[k])});
  const out={
    categories:mergeCategories(local.categories,remote.categories,gone),
    entries:mergeItems(local.entries,remote.entries,'entry','',gone),
    goals:mergeGoals(local.goals,remote.goals,gone),
    themes:mergeItems(local.themes,remote.themes,'theme','',gone),
    look:local.look,
    skin:local.skin?JSON.parse(JSON.stringify(local.skin)):null,
    appearanceAt:numAt(local.appearanceAt),
    gone
  };
  if(numAt(remote.appearanceAt)>out.appearanceAt){
    out.look=remote.look;
    out.skin=remote.skin?JSON.parse(JSON.stringify(remote.skin)):null;
    out.appearanceAt=numAt(remote.appearanceAt);
  }
  const titles=mergeDayTitles(local,remote,gone);
  out.dayTitles=titles.dayTitles;
  out.dayTitleAt=titles.dayTitleAt;
  return out;
}
function journalHasContent(s){
  if(!s)return false;
  if((s.categories||[]).length||(s.entries||[]).length||(s.goals||[]).length||(s.themes||[]).length)return true;
  if(s.skin)return true;
  return !!(s.dayTitles&&Object.keys(s.dayTitles).length);
}
function syncBody(){
  const copy=JSON.parse(JSON.stringify(state));
  delete copy.typing;
  delete copy.lastBackupAt;
  delete copy.backupSnoozeUntil;
  delete copy._migrated;
  return copy;
}
function applyMerged(merged){
  syncQuiet=true;
  const typing=state.typing;
  const lastBackupAt=state.lastBackupAt;
  const backupSnoozeUntil=state.backupSnoozeUntil;
  state=merged;
  state.typing=typing||{enabled:false,voice:'key',volume:0.35};
  state.lastBackupAt=lastBackupAt||0;
  state.backupSnoozeUntil=backupSnoozeUntil||0;
  if(openCat&&!catById(openCat))openCat=null;
  if(openPerson&&!currentPerson())openPerson=null;
  if(openGoal&&!goalById(openGoal))openGoal=null;
  applyAppearance();
  localStorage.setItem(KEY,JSON.stringify(state));
  syncSnap=JSON.parse(JSON.stringify(state));
  syncQuiet=false;
  render();
}
const SYNC_STORE='field-record-sync';
const SYNC_ALPHABET='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const SUPABASE_URL='https://nazegfvpkpypjvwmwwpf.supabase.co';
const SUPABASE_KEY='sb_publishable_hWwd_QfblIyOSUMjN1J3XQ_l1KsHoKF';
function bytesToBase64(bytes){
  let bin='';
  const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk)bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));
  return btoa(bin);
}
function base64ToBytes(b64){
  const bin=atob(String(b64||'').replace(/\s/g,''));
  const out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
  return out;
}
function normalizeSyncCode(raw){
  const cleaned=String(raw||'').toUpperCase().replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g,'');
  return cleaned.length>=20?cleaned.slice(0,20):'';
}
function formatSyncCode(code){
  const n=normalizeSyncCode(code);
  return n?n.replace(/(.{5})/g,'$1 ').trim():'';
}
function randomCode(){
  const chars=[];
  const buf=new Uint8Array(20);
  crypto.getRandomValues(buf);
  for(let i=0;i<20;i++)chars.push(SYNC_ALPHABET[buf[i]%32]);
  return chars.join('');
}
async function deriveSync(code){
  const normalized=normalizeSyncCode(code);
  const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(normalized),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode('field-record-sync-v1'),iterations:200000,hash:'SHA-256'},base,512);
  const bytes=new Uint8Array(bits);
  const id=[...bytes.slice(0,32)].map(b=>b.toString(16).padStart(2,'0')).join('');
  const keyBytes=bytes.slice(32);
  const key=await crypto.subtle.importKey('raw',keyBytes,{name:'AES-GCM'},false,['encrypt','decrypt']);
  return {id,key,keyRaw:bytesToBase64(keyBytes)};
}
async function encryptBytes(key,bytes){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,bytes));
  const out=new Uint8Array(iv.length+ct.length);
  out.set(iv,0);out.set(ct,iv.length);
  return bytesToBase64(out);
}
async function decryptBytes(key,b64){
  const raw=base64ToBytes(b64);
  if(raw.length<13)throw new Error('short');
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:raw.slice(0,12)},key,raw.slice(12));
  return new Uint8Array(plain);
}
async function encryptJournal(obj){
  return encryptBytes(syncKey,new TextEncoder().encode(JSON.stringify(obj)));
}
async function decryptJournal(data){
  const bytes=await decryptBytes(syncKey,data);
  const parsed=JSON.parse(new TextDecoder().decode(bytes));
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('shape');
  return parsed;
}
async function hashImageId(id){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(id)));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function sniffType(bytes){
  if(bytes.length>3&&bytes[0]===0xff&&bytes[1]===0xd8)return 'image/jpeg';
  if(bytes.length>8&&bytes[0]===0x89&&bytes[1]===0x50)return 'image/png';
  if(bytes.length>12&&bytes[0]===0x52&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[3]===0x46)return 'image/webp';
  return 'application/octet-stream';
}
async function rpc(fn,params){
  if(typeof navigator!=='undefined'&&navigator.onLine===false){const err=new Error('offline');err.offline=true;throw err}
  let res;
  try{
    res=await fetch(SUPABASE_URL+'/rest/v1/rpc/'+fn,{
      method:'POST',
      headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify(params||{})
    });
  }catch(e){const err=new Error('offline');err.offline=true;throw err}
  const text=await res.text();
  let data=null;
  if(text){try{data=JSON.parse(text)}catch(e){data=text}}
  if(!res.ok){const err=new Error('Could not sync. The journal on this device was kept.');err.status=res.status;throw err}
  return data;
}
function loadSyncLink(){
  try{
    const raw=JSON.parse(localStorage.getItem(SYNC_STORE)||'null');
    if(raw&&normalizeSyncCode(raw.code)&&typeof raw.vaultId==='string'&&raw.vaultId.length>=32)return raw;
  }catch(e){}
  return null;
}
function saveSyncLink(){
  if(!syncLink)return;
  localStorage.setItem(SYNC_STORE,JSON.stringify({code:syncLink.code,vaultId:syncLink.vaultId,keyRaw:syncLink.keyRaw,version:syncLink.version||0,syncedAt:syncLink.syncedAt||0}));
}
async function unlockSync(){
  if(!syncLink)return;
  if(syncLink.keyRaw){
    syncKey=await crypto.subtle.importKey('raw',base64ToBytes(syncLink.keyRaw),{name:'AES-GCM'},false,['encrypt','decrypt']);
    return;
  }
  const derived=await deriveSync(syncLink.code);
  syncKey=derived.key;
  syncLink.vaultId=derived.id;
  syncLink.keyRaw=derived.keyRaw;
  saveSyncLink();
}
function syncedLabel(ts){
  if(!ts)return 'Not synced yet';
  const mins=Math.round((Date.now()-ts)/60000);
  if(mins<=0)return 'Synced just now';
  if(mins<60)return `Synced ${mins} min ago`;
  const hrs=Math.round(mins/60);
  if(hrs<24)return `Synced ${hrs} hr ago`;
  const days=Math.round(hrs/24);
  return `Synced ${days} day${days===1?'':'s'} ago`;
}
function setSyncStatus(text,mode){
  syncStatusText=text||'';
  if(mode)syncMode=mode;
  document.querySelectorAll('[data-sync-status]').forEach(el=>{
    el.textContent=syncStatusText;
    el.dataset.mode=syncMode;
  });
}
function scheduleSync(){
  if(!syncLink||!syncKey||syncQuiet)return;
  clearTimeout(syncTimer);
  syncTimer=setTimeout(()=>syncNow(),3000);
}
async function pushMerged(){
  let mergedNotice=false;
  for(let attempt=0;attempt<5;attempt++){
    const rows=await rpc('fr_get_vault',{p_id:syncLink.vaultId});
    let base=0;
    if(Array.isArray(rows)&&rows.length){
      base=Number(rows[0].version)||0;
      let remote;
      try{remote=await decryptJournal(rows[0].data)}
      catch(e){throw new Error('Could not read the synced journal. The journal on this device was kept.')}
      const local=syncBody();
      const merged=mergeJournal(local,remote);
      if(JSON.stringify(merged)!==JSON.stringify(local)){applyMerged(merged);mergedNotice=true}
    }
    const data=await encryptJournal(syncBody());
    if(data.length>5*1024*1024)throw new Error('The journal is too large to sync. The copy on this device was kept.');
    const version=Number(await rpc('fr_put_vault',{p_id:syncLink.vaultId,p_data:data,p_base_version:base}));
    if(version!==-1&&Number.isFinite(version))return {version,mergedNotice};
  }
  throw new Error('Could not sync. The journal on this device was kept.');
}
async function syncImages(){
  const referenced=collectImageIds(state);
  const remote=await rpc('fr_list_images',{p_id:syncLink.vaultId});
  const remoteIds=new Set((Array.isArray(remote)?remote:[]).map(row=>row&&row.image_id).filter(Boolean));
  const local=await allImageRecords();
  for(const rec of local){
    if(!referenced.has(rec.id))continue;
    const hid=await hashImageId(rec.id);
    if(remoteIds.has(hid))continue;
    const bytes=new Uint8Array(await rec.blob.arrayBuffer());
    const data=await encryptBytes(syncKey,bytes);
    if(data.length>15*1024*1024)continue;
    await rpc('fr_put_image',{p_id:syncLink.vaultId,p_image_id:hid,p_data:data});
    remoteIds.add(hid);
  }
  const gone=(state.gone&&state.gone.image)||{};
  for(const id of Object.keys(gone)){
    if(referenced.has(id)){unbury('image',id);continue}
    const hid=await hashImageId(id);
    if(remoteIds.has(hid))await rpc('fr_delete_image',{p_id:syncLink.vaultId,p_image_id:hid});
    forgetImages([id]);
  }
  if(syncDirty){
    syncQuiet=true;
    localStorage.setItem(KEY,JSON.stringify(state));
    syncSnap=JSON.parse(JSON.stringify(state));
    syncDirty=false;
    syncQuiet=false;
  }
}
async function fetchSyncImage(id){
  if(!syncLink||!syncKey||!id||!navigator.onLine)return null;
  try{
    const hid=await hashImageId(id);
    const data=await rpc('fr_get_image',{p_id:syncLink.vaultId,p_image_id:hid});
    if(!data||typeof data!=='string')return null;
    const bytes=await decryptBytes(syncKey,data);
    const blob=new Blob([bytes],{type:sniffType(bytes)});
    await putImage(id,blob);
    return blob;
  }catch(e){return null}
}
async function syncNow(opts){
  opts=opts||{};
  if(!syncLink||!syncKey)return;
  if(syncing){syncQueued=true;return}
  syncing=true;
  const keep=!!opts.keepNotice;
  if(!keep)setSyncStatus('Syncing…','syncing');
  try{
    if(!navigator.onLine){setSyncStatus('Offline, will sync later','offline');return}
    const result=await pushMerged();
    syncLink.version=result.version;
    syncLink.syncedAt=Date.now();
    saveSyncLink();
    await syncImages();
    if(result.mergedNotice||keep)setSyncStatus('Merged this device with the synced journal.','merged');
    else setSyncStatus(syncedLabel(syncLink.syncedAt),'idle');
  }catch(e){
    if((e&&e.offline)||!navigator.onLine)setSyncStatus('Offline, will sync later','offline');
    else setSyncStatus((e&&e.message)||'Could not sync. The journal on this device was kept.','error');
  }finally{
    syncing=false;
    if(syncQueued){syncQueued=false;syncNow()}
  }
}
async function createSyncCode(){
  if(syncLink||syncBusy)return;
  syncBusy=true;
  setSyncStatus('Syncing…','syncing');
  try{
    const code=randomCode();
    const derived=await deriveSync(code);
    syncKey=derived.key;
    syncLink={code,vaultId:derived.id,keyRaw:derived.keyRaw,version:0,syncedAt:0};
    saveSyncLink();
    linkAsk=false;
    renderSync();
    await syncNow();
  }catch(e){
    syncLink=null;syncKey=null;
    localStorage.removeItem(SYNC_STORE);
    setSyncStatus('Could not sync. The journal on this device was kept.','error');
    renderSync();
  }finally{syncBusy=false}
}
async function linkWithCode(raw){
  const code=normalizeSyncCode(raw);
  if(!code){setSyncStatus('That code is not valid. Nothing was changed.','error');return}
  if(syncBusy)return;
  syncBusy=true;
  setSyncStatus('Syncing…','syncing');
  try{
    const derived=await deriveSync(code);
    let rows;
    try{rows=await rpc('fr_get_vault',{p_id:derived.id})}
    catch(e){
      if(e.offline)setSyncStatus('Offline, will sync later','offline');
      else setSyncStatus('Could not sync. The journal on this device was kept.','error');
      return;
    }
    const had=journalHasContent(state);
    syncKey=derived.key;
    syncLink={code,vaultId:derived.id,keyRaw:derived.keyRaw,version:0,syncedAt:0};
    if(Array.isArray(rows)&&rows.length&&rows[0]&&rows[0].data){
      let remote;
      try{remote=await decryptJournal(rows[0].data)}
      catch(err){
        syncLink=null;syncKey=null;
        setSyncStatus('That sync code did not open the journal. Nothing was changed.','error');
        renderSync();
        return;
      }
      syncLink.version=Number(rows[0].version)||0;
      saveSyncLink();
      applyMerged(mergeJournal(syncBody(),remote));
      linkAsk=false;
      renderSync();
      await syncNow({keepNotice:had});
      if(had)setSyncStatus('Merged this device with the synced journal.','merged');
      return;
    }
    saveSyncLink();
    linkAsk=false;
    renderSync();
    await syncNow();
  }finally{syncBusy=false}
}
function unlinkSync(){
  syncLink=null;
  syncKey=null;
  localStorage.removeItem(SYNC_STORE);
  syncMode='idle';
  syncStatusText='';
  linkAsk=false;
  renderSync();
}
async function copySyncCode(){
  if(!syncLink)return;
  const text=formatSyncCode(syncLink.code);
  try{await navigator.clipboard.writeText(text)}
  catch(e){
    const area=document.createElement('textarea');
    area.value=text;
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  document.querySelectorAll('[data-copy-code]').forEach(btn=>{btn.textContent='Copied'});
  setTimeout(()=>document.querySelectorAll('[data-copy-code]').forEach(btn=>{if(btn.isConnected)btn.textContent='Copy'}),1200);
}
function syncView(compact){
  const status=h('p',{class:'muted sm sync-status','data-sync-status':'true','data-mode':syncMode},syncStatusText||(syncLink?syncedLabel(syncLink.syncedAt):''));
  if(!syncLink){
    const inputId=compact?'syncCodeInput':'syncCodeInputFull';
    return [
      h('h3',null,'Sync'),
      h('p',{class:'muted sm'},compact?'Create a sync code, or link one from another device.':'A sync code keeps this journal on your other devices. The code is the key. Keep it safe.'),
      h('div',{class:'actions'},
        h('button',{type:'button',class:'btn',onclick:createSyncCode},'Create sync code'),
        h('button',{type:'button',class:'btn ghost',onclick:()=>{linkAsk=!linkAsk;renderSync()}},'Link with code')),
      linkAsk?h('div',{class:'tag-row'},
        h('input',{id:inputId,class:'field',placeholder:'Paste the sync code','aria-label':'Sync code',autocomplete:'off',onkeydown:ev=>{if(ev.key==='Enter'){ev.preventDefault();linkWithCode(ev.target.value)}}}),
        h('button',{type:'button',class:'btn',onclick:()=>{const el=$(inputId);linkWithCode(el?el.value:'')}},'Link')):null,
      status
    ];
  }
  return [
    compact?null:h('h3',null,'Sync'),
    h('p',{class:'sync-code','data-sync-code':'true'},formatSyncCode(syncLink.code)),
    h('div',{class:'actions'},h('button',{type:'button',class:'btn ghost','data-copy-code':'true',onclick:copySyncCode},'Copy')),
    status,
    compact?h('button',{type:'button',class:'btn ghost',onclick:()=>{closeCode();openBackup()}},'Sync settings'):h('p',{class:'muted sm'},'The code is the key. Keep it safe.'),
    compact?null:h('div',{class:'actions'},h('button',{type:'button',class:'btn ghost',id:'unlinkSync',onclick:unlinkSync},'Unlink this device'))
  ];
}
function renderSync(){
  const pop=$('codePop'), panel=$('syncPanel');
  if(!pop||!panel)return;
  const active=document.activeElement;
  if(active&&(active.id==='syncCodeInput'||active.id==='syncCodeInputFull'))return;
  pop.replaceChildren(...syncView(true).filter(Boolean));
  panel.replaceChildren(...syncView(false).filter(Boolean));
  pop.hidden=!codeOpen;
}
function openCode(){
  codeOpen=true;
  const pop=$('codePop');
  if(pop)pop.hidden=false;
  const btn=$('codeBtn');
  if(btn)btn.setAttribute('aria-expanded','true');
  renderSync();
}
function closeCode(){
  codeOpen=false;
  const pop=$('codePop');
  if(pop)pop.hidden=true;
  const btn=$('codeBtn');
  if(btn)btn.setAttribute('aria-expanded','false');
}
function showUpdate(reg){
  const banner=$('updateBanner');
  if(!banner)return;
  banner.hidden=false;
  banner.onclick=()=>{
    banner.hidden=true;
    if(reg.waiting)reg.waiting.postMessage({type:'skip-waiting'});
  };
}
function registerSW(){
  if(!('serviceWorker' in navigator))return;
  let reloading=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(reloading)return;
    reloading=true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').then(reg=>{
    const watch=worker=>{
      if(!worker)return;
      worker.addEventListener('statechange',()=>{
        if(worker.state==='installed'&&navigator.serviceWorker.controller)showUpdate(reg);
      });
    };
    if(reg.waiting&&navigator.serviceWorker.controller)showUpdate(reg);
    reg.addEventListener('updatefound',()=>watch(reg.installing));
  }).catch(()=>{});
}
async function bootSync(){
  syncLink=loadSyncLink();
  if(syncLink){
    try{await unlockSync()}catch(e){syncKey=null}
    if(!syncKey){syncLink=null;localStorage.removeItem(SYNC_STORE)}
    else if(syncLink.syncedAt)syncStatusText=syncedLabel(syncLink.syncedAt);
  }
  renderSync();
  registerSW();
  if(syncLink&&syncKey)syncNow();
  setInterval(()=>{
    if(syncMode==='idle'&&syncLink&&syncLink.syncedAt)setSyncStatus(syncedLabel(syncLink.syncedAt),'idle');
  },30000);
  setInterval(()=>{if(syncLink&&syncKey&&!document.hidden)syncNow()},60000);
}

function render(){
  readGoalNotes();
  if(!skipShiftRead)readShiftDraft();
  skipShiftRead=false;
  skipFormRead=false;
  if(openCat&&!currentCat())openCat=null;
  if(openGoal&&!goalById(openGoal))openGoal=null;
  const screen=!!(openCat||openGoal);
  $('top').hidden=screen;
  $('home').hidden=screen;
  $('catScreen').hidden=!openCat;
  $('goalScreen').hidden=!openGoal;
  $('dateLabel').textContent=fmt(sel);
  const t=$('dayTitle');
  if(t&&document.activeElement!==t)t.value=state.dayTitles[sel]||'';
  renderGoals();renderCats();renderSelGoals();renderCal();renderDays();
  if(openCat)renderCatScreen();else{$('catScreen').replaceChildren();$('catScreen').removeAttribute('data-type')}
  if(openGoal)renderGoalScreen();else{$('goalScreen').replaceChildren()}
  goalNotesFor=sel;
  syncBackup();
  hydrateImages(document);
  ensureVisibleWeather();
  prefillTemp();
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
function currentSkin(){
  if(state.skin)return normalizeSkin(state.skin);
  return presetSkin(LOOK_IDS.has(state.look)?state.look:'paper');
}
function beginCustom(){
  if(!state.skin)state.skin=presetSkin(LOOK_IDS.has(state.look)?state.look:'paper');
  state.look='custom';
}
function paintSkin(){
  state.skin=normalizeSkin(state.skin);
  applyAppearance();
  save();
  document.querySelectorAll('#lookList .look-opt').forEach(b=>{
    const id=b.getAttribute('data-look');
    const on=id===state.look;
    b.classList.toggle('on',on);
    b.setAttribute('aria-pressed',on?'true':'false');
  });
}
function chooseLook(id){
  if(!LOOK_IDS.has(id))return;
  state.look=id;
  state.skin=null;
  applyAppearance();
  save();
  renderLook();
}
function chooseTheme(id){
  const t=state.themes.find(x=>x.id===id);
  if(!t)return;
  state.look='theme:'+id;
  state.skin=normalizeSkin(JSON.parse(JSON.stringify(t.skin)));
  applyAppearance();
  save();
  renderLook();
}
function uploadUsed(id){
  if(!id)return false;
  if(state.skin&&state.skin.uploadId===id)return true;
  return state.themes.some(t=>t.skin&&t.skin.uploadId===id);
}
function deleteTheme(id){
  const t=state.themes.find(x=>x.id===id);
  state.themes=state.themes.filter(x=>x.id!==id);
  if(state.look==='theme:'+id){state.look='paper';state.skin=null;applyAppearance()}
  if(t&&t.skin&&t.skin.uploadId&&!uploadUsed(t.skin.uploadId))deleteImage(t.skin.uploadId);
  if(renamingTheme===id)renamingTheme=null;
  save();
  renderLook();
}
function commitThemeRename(id,raw){
  if(renamingTheme!==id)return;
  renamingTheme=null;
  const name=String(raw||'').trim();
  const t=state.themes.find(x=>x.id===id);
  if(t&&name)t.name=name;
  save();
  renderLook();
}
function saveNamedTheme(){
  const input=$('themeName');
  const name=(input&&input.value||'').trim();
  if(!name){if(input)input.focus();return}
  const skin=normalizeSkin(state.skin||presetSkin(LOOK_IDS.has(state.look)?state.look:'paper'));
  let t=state.themes.find(x=>same(x.name,name));
  if(!t){t={id:uid(),name,skin};state.themes.push(t)}
  t.name=name;
  t.skin=JSON.parse(JSON.stringify(skin));
  state.look='theme:'+t.id;
  state.skin=normalizeSkin(JSON.parse(JSON.stringify(skin)));
  applyAppearance();
  save();
  renderLook();
}
async function onBgUpload(ev){
  const input=ev.target;
  const file=input.files&&input.files[0];
  input.value='';
  if(!file)return;
  try{
    const blob=await compressImage(file);
    const id='bg-'+uid();
    await putImage(id,blob);
    beginCustom();
    const prev=state.skin.uploadId;
    state.skin.uploadId=id;
    state.skin.scene='upload';
    bgError='';
    paintSkin();
    if(prev&&prev!==id&&!uploadUsed(prev))deleteImage(prev);
    renderLook();
  }catch(err){
    bgError="Couldn't use that image. Try a smaller one.";
    renderLook();
  }
}
function setSkin(key,value){
  beginCustom();
  state.skin[key]=value;
  paintSkin();
}
function setTyping(partial){
  state.typing=Object.assign({enabled:false,voice:'key',volume:0.35},state.typing,partial);
  save();
  if(partial.enabled&&partial.voice)playTyping(true);
}
let audioCtx=null,lastSound=0;
function audio(){
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC)return null;
  if(!audioCtx)audioCtx=new AC();
  if(audioCtx.state==='suspended')audioCtx.resume();
  return audioCtx;
}
function envGain(ctx,node,vol,hold){
  const g=ctx.createGain();
  const t=ctx.currentTime;
  g.gain.setValueAtTime(Math.max(0.0001,vol),t);
  g.gain.exponentialRampToValueAtTime(0.0001,t+hold);
  node.connect(g);g.connect(ctx.destination);
  return g;
}
function noiseBurst(ctx,seconds){
  const len=Math.max(1,Math.floor(ctx.sampleRate*seconds));
  const buf=ctx.createBuffer(1,len,ctx.sampleRate);
  const data=buf.getChannelData(0);
  for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/len,1.6);
  const src=ctx.createBufferSource();
  src.buffer=buf;
  return src;
}
function playTyping(force){
  if(!force&&(!state.typing||!state.typing.enabled))return;
  const now=performance.now();
  if(!force&&now-lastSound<40)return;
  lastSound=now;
  const ctx=audio();
  if(!ctx)return;
  const vol=(state.typing&&state.typing.volume!=null?state.typing.volume:0.35);
  if(vol<=0)return;
  const voice=(state.typing&&state.typing.voice)||'key';
  const t=ctx.currentTime;
  if(voice==='pop'){
    const o=ctx.createOscillator();
    o.type='sine';
    o.frequency.setValueAtTime(680,t);
    o.frequency.exponentialRampToValueAtTime(180,t+0.14);
    envGain(ctx,o,vol*0.28,0.16);
    o.start(t);o.stop(t+0.17);
    return;
  }
  if(voice==='type'){
    const src=noiseBurst(ctx,0.045);
    const f=ctx.createBiquadFilter();
    f.type='bandpass';f.frequency.value=900;f.Q.value=0.7;
    src.connect(f);
    envGain(ctx,f,vol*0.45,0.05);
    src.start(t);
    const o=ctx.createOscillator();
    o.type='sine';o.frequency.value=110;
    envGain(ctx,o,vol*0.2,0.06);
    o.start(t);o.stop(t+0.07);
    return;
  }
  const src=noiseBurst(ctx,0.02);
  const f=ctx.createBiquadFilter();
  f.type='highpass';f.frequency.value=1800;
  src.connect(f);
  envGain(ctx,f,vol*0.4,0.03);
  src.start(t);
  const o=ctx.createOscillator();
  o.type='square';o.frequency.value=2100;
  envGain(ctx,o,vol*0.06,0.012);
  o.start(t);o.stop(t+0.015);
}
function savedRow(t){
  const on=state.look==='theme:'+t.id;
  if(renamingTheme===t.id){
    const inp=h('input',{class:'field theme-rename',value:t.name,'aria-label':`Rename ${t.name}`,
      onkeydown:ev=>{
        if(ev.key==='Enter'){ev.preventDefault();commitThemeRename(t.id,ev.target.value)}
        if(ev.key==='Escape'){renamingTheme=null;renderLook()}
      },
      onblur:ev=>commitThemeRename(t.id,ev.target.value)});
    setTimeout(()=>{inp.focus();inp.select()},0);
    return h('div',{class:'saved-row','data-theme':t.id},inp);
  }
  const chip=t.skin&&t.skin.card?t.skin.card:'#fbf8f2';
  const edge=t.skin&&t.skin.accent?t.skin.accent:'#2f5d45';
  return h('div',{class:'saved-row','data-theme':t.id},
    h('button',{type:'button',class:'look-opt'+(on?' on':''),'data-look':'theme:'+t.id,'aria-pressed':on?'true':'false',onclick:()=>chooseTheme(t.id)},
      h('span',{class:'swatch saved',style:`background:${chip};border:1px solid ${edge}`}),
      h('span',{class:'look-name'},t.name),
      h('span',{class:'muted sm look-note'},'Saved theme')),
    h('button',{type:'button',class:'btn ghost',onclick:()=>{renamingTheme=t.id;renderLook()}},'Rename'),
    h('button',{type:'button',class:'btn ghost',onclick:()=>deleteTheme(t.id)},'Delete'));
}
function customizeForm(){
  const s=currentSkin();
  const select=(id,label,options,key)=>{
    const el=h('label',{class:'lbl'},label,h('select',{id,class:'field',onchange:ev=>setSkin(key,ev.target.value)},
      ...options.map(o=>h('option',{value:o.id,selected:s[key]===o.id},o.name))));
    return el;
  };
  const color=(id,label,key)=>h('label',{class:'color-lab'},label,h('input',{id,type:'color',value:s[key],oninput:ev=>setSkin(key,ev.target.value)}));
  const file=h('input',{id:'bgUpload',class:'file-input',type:'file',accept:'image/*','aria-label':'Upload background'});
  file.addEventListener('change',onBgUpload);
  const voices=[{id:'off',name:'Off'},{id:'key',name:'Keyboard'},{id:'type',name:'Typewriter'},{id:'pop',name:'Bubble'}];
  const voiceNow=state.typing.enabled?state.typing.voice:'off';
  return h('div',{class:'look-custom'},
    h('h3',null,'Customize'),
    h('p',{class:'muted sm'},'Change the background, frame, colours, or type. Paper can be recoloured too. Save theme keeps a named copy.'),
    select('scenePick','Background',SCENES,'scene'),
    h('div',{class:'actions'},
      h('button',{type:'button',class:'btn ghost',id:'uploadBg',onclick:()=>file.click()},'Upload background'),
      file),
    bgError?h('p',{class:'warn',id:'bgError',role:'alert'},bgError):null,
    select('borderPick','Border',BORDERS.map(id=>({id,name:{rounded:'Rounded',square:'Square',double:'Double line',dashed:'Dashed',thick:'Thick / shadowed',wood:'Wood frame',vine:'Vine frame',earth:'Earth frame',water:'Water frame'}[id]})),'border'),
    h('div',{class:'color-grid'},
      color('pageColor','Page', 'page'),
      color('cardColor','Card', 'card'),
      color('inkColor','Text', 'ink'),
      color('accentColor','Accent', 'accent'),
      color('lineColor','Border', 'line')),
    select('fontPick','Font',FONTS,'font'),
    h('p',{class:'watch'},'Typing sounds'),
    h('div',{class:'type-row',id:'soundPicks'},...voices.map(v=>h('button',{
      type:'button',class:'type-opt'+(voiceNow===v.id?' on':''),'data-sound':v.id,'aria-pressed':voiceNow===v.id?'true':'false',
      onclick:()=>{
        if(v.id==='off')setTyping({enabled:false});
        else setTyping({enabled:true,voice:v.id});
        renderLook();
      }
    },v.name))),
    h('label',{class:'lbl'},'Volume',h('input',{id:'soundVolume',class:'volume',type:'range',min:'0',max:'1',step:'0.05',value:String(state.typing.volume),oninput:ev=>setTyping({volume:Number(ev.target.value)})})),
    h('div',{class:'tag-row'},
      h('input',{id:'themeName',class:'field',placeholder:'Name this theme','aria-label':'Name this theme',autocomplete:'off'}),
      h('button',{type:'button',class:'btn',id:'saveTheme',onclick:saveNamedTheme},'Save theme')));
}
function renderLook(){
  const modal=$('lookModal');
  if(!modal)return;
  modal.hidden=!lookOpen;
  $('lookBtn').setAttribute('aria-expanded',lookOpen?'true':'false');
  if(!lookOpen)return;
  const presets=LOOKS.map(l=>h('button',{
    type:'button',
    class:'look-opt'+(!state.skin&&state.look===l.id?' on':''),
    'data-look':l.id,
    'aria-pressed':!state.skin&&state.look===l.id?'true':'false',
    onclick:()=>chooseLook(l.id)
  },
    h('span',{class:'swatch '+l.id,role:'presentation'}),
    h('span',{class:'look-name'},l.name),
    h('span',{class:'muted sm look-note'},l.note)));
  const saved=state.themes.map(savedRow);
  $('lookList').replaceChildren(...presets,saved.length?h('div',{class:'saved-list'},...saved):null);
  const host=$('lookCustom');
  if(host)host.replaceChildren(customizeForm());
}
function openLook(){
  if(backupOpen)closeBackup();
  closeCode();
  lookOpen=true;
  bgError='';
  renderLook();
  const b=$('lookClose');
  if(b)b.focus();
}
function closeLook(){lookOpen=false;renderLook()}
$('lookBtn').onclick=openLook;
$('lookClose').onclick=closeLook;
$('lookModal').addEventListener('click',ev=>{if(ev.target.id==='lookModal')closeLook()});
$('backupBtn').onclick=openBackup;
$('backupClose').onclick=closeBackup;
$('backupNow').onclick=()=>exportBackup();
$('backupLater').onclick=snoozeBackup;
$('exportBackup').onclick=()=>exportBackup();
$('importBackup').onclick=()=>$('importFile').click();
$('importFile').addEventListener('change',chooseBackupFile);
$('backupReplace').onclick=()=>confirmImport();
$('backupCancelImport').onclick=()=>{clearImportPrompt();setBackupError('')};
$('backupModal').addEventListener('click',ev=>{if(ev.target.id==='backupModal')closeBackup()});
$('lightbox').addEventListener('click',ev=>{
  if(ev.target.id==='lightbox'||ev.target.id==='lightboxClose')closeLightbox();
});
$('codeBtn').onclick=ev=>{ev.stopPropagation();if(codeOpen)closeCode();else openCode()};
document.addEventListener('click',ev=>{
  if(!codeOpen)return;
  const path=ev.composedPath();
  if(path.includes($('codePop'))||path.includes($('codeBtn')))return;
  closeCode();
});
document.addEventListener('keydown',ev=>{
  if(ev.key==='Escape'){
    if(codeOpen){closeCode();return}
    if(backupOpen){closeBackup();return}
    if(lookOpen){closeLook();return}
    if(!$('lightbox').hidden)closeLightbox();
    return;
  }
  if(!state.typing||!state.typing.enabled)return;
  if(ev.metaKey||ev.ctrlKey||ev.altKey)return;
  const el=ev.target;
  if(!el||!el.matches)return;
  const typing=el.matches('textarea')||(el.matches('input')&&['','text','search'].includes((el.getAttribute('type')||'text').toLowerCase()));
  if(!typing)return;
  playTyping(false);
});
setInterval(()=>{
  const el=$('watchTime');
  if(el)el.textContent=formatClock(watchElapsed());
},250);
document.addEventListener('visibilitychange',()=>{
  const el=$('watchTime');
  if(el)el.textContent=formatClock(watchElapsed());
  if(!document.hidden)syncNow();
});
window.addEventListener('focus',()=>{if(!document.hidden)syncNow()});
window.addEventListener('online',()=>{ensureVisibleWeather();syncNow()});
window.addEventListener('offline',()=>{
  if(syncLink)setSyncStatus('Offline, will sync later','offline');
  paintWeather();
});
render();
bootSync();
})();
