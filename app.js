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
  if((day||haveCurrent)&&!!wxFail[token])kids.push(h('p',{class:'muted sm wx-saved'},'Showing saved weather.'));
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
      return !!(d.condition||(d.temperature!=null&&Number.isFinite(Number(d.temperature)))||(d.note||'').trim()||(d.tags||[]).length||(d.images||[]).length);
    },
    write(entry,d){
      entry.condition=conditionById(d.condition)?d.condition:'';
      const t=d.temperature;
      entry.temperature=t==null||t===''||!Number.isFinite(Number(t))?null:Number(t);
      entry.note=(d.note||'').trim();
      entry.tags=[...d.tags];
      entry.images=[...(d.images||[])];
      entry.title=entry.condition?conditionById(entry.condition).label:'';
    },
    fields(d){return weatherFields(d)},
    tail(){return h('label',{class:'lbl'},'Notes',h('textarea',{id:'entryNote',class:'field note'}))},
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
      return state;
    }
  }catch(e){}
  return {categories:[],entries:[],dayTitles:{},goals:[],look:'paper',themes:[],skin:null,typing:{enabled:false,voice:'key',volume:0.35}};
}
let state=load();
applyAppearance();
let goalNotesFor=null;
let skipFormRead=false;
const save=()=>{readGoalNotes();localStorage.setItem(KEY,JSON.stringify(state));};
if(state._migrated){delete state._migrated;save()}
let sel=key(new Date()),view=parse(sel),addingCat=false,newType='notes';
let openCat=null,openGoal=null,editingId=null,tagEdit=false,renamingTag=null,focusTitle=false;
let addingGoal=false,newGoalType='checks',goalEditingId=null,itemEdit=false,itemRenaming=null,goalNameEdit=false;
let pendingItem='';
let draft=TYPES.notes.blank(),pendingTag='',imageError='';
const sessionNew=new Set();
const expanded=new Set();
let picker=false,pickerYear=view.getFullYear(),lookOpen=false;
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
  const n=el.value.length;
  if(el.setSelectionRange)el.setSelectionRange(n,n);
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
  const heading=type.id==='weather'?weatherHeading(e):(e.title||'Untitled');
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
function renderCatScreen(){
  const cat=currentCat();
  const root=$('catScreen');
  if(!cat){root.replaceChildren();root.removeAttribute('data-type');return}
  const type=typeOf(cat);
  root.dataset.type=type.id;
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
    form,
    h('div',{class:'entry-list',id:'catEntries'},
      list.length?list.map(entryCard):h('p',{class:'muted',id:'catEmpty'},'Nothing written.')));
  fillAreas();
  if(focusTitle){
    const el=$('entryTitle')||(!cat.place&&$('placeQuery'));
    if(el){el.focus();const n=el.value.length;if(el.setSelectionRange)el.setSelectionRange(n,n)}
    focusTitle=false;
  }
}
function entryPreview(e){
  const kind=typeOf(catById(e.categoryId)).id;
  if(kind==='weather'){
    return h('div',{class:'preview-block'},
      h('p',{class:'preview-title wx-log'},weatherHeading(e)),
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
  return h('article',{class:'card cat-card','data-cat':c.id,'data-type':type.id,tabindex:'0',onclick:ev=>{
    if(ev.target.closest('button'))return;
    openCategory(c.id);
  },onkeydown:ev=>{
    if(ev.target!==ev.currentTarget)return;
    if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();openCategory(c.id)}
  }},
    h('div',{class:'row'},h('h3',null,c.name),h('button',{class:'x',type:'button','aria-label':`Delete ${c.name}`,onclick:()=>deleteCategory(c)},'Delete')),
    type.id==='notes'?null:h('p',{class:'muted sm'},type.label),
    type.id==='weather'?h('div',{class:'wx-slot','data-wx-slot':c.id},weatherReadout(c)):null,
    list.length?list.map(entryPreview):h('p',{class:'muted'},'Nothing written for this day.'),
    h('p',{class:'accent sm open-hint'},'Open'));
}
function renderCats(){
  const root=$('categories');
  root.replaceChildren(...state.categories.map(catCard));
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
      state.categories.push(cat);
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
  readGoalNotes();
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
  renderGoals();renderCats();renderCal();renderDays();
  if(openCat)renderCatScreen();else{$('catScreen').replaceChildren();$('catScreen').removeAttribute('data-type')}
  if(openGoal)renderGoalScreen();else{$('goalScreen').replaceChildren()}
  goalNotesFor=sel;
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
$('lightbox').addEventListener('click',ev=>{
  if(ev.target.id==='lightbox'||ev.target.id==='lightboxClose')closeLightbox();
});
document.addEventListener('keydown',ev=>{
  if(ev.key==='Escape'){
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
});
render();
})();
