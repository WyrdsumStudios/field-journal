const CACHE='field-record-v31';
const SHELL=[
  './',
  './index.html',
  './styles.css?v=31',
  './app.js?v=31',
  './vendor/leaflet/leaflet.css?v=22',
  './vendor/leaflet/leaflet.js?v=22',
  './vendor/leaflet/images/marker-icon.png',
  './vendor/leaflet/images/marker-icon-2x.png',
  './vendor/leaflet/images/marker-shadow.png',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './assets/bg-wood.webp',
  './assets/bg-vine.webp',
  './assets/bg-retro.webp',
  './assets/border-wood.webp',
  './assets/border-vine.svg'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('message',event=>{
  if(event.data&&event.data.type==='skip-waiting')self.skipWaiting();
});
async function fromCache(request){
  const cache=await caches.open(CACHE);
  return cache.match(request)||cache.match(request,{ignoreSearch:true});
}
async function cacheFirst(request){
  const hit=await fromCache(request);
  if(hit)return hit;
  const res=await fetch(request);
  if(res&&(res.ok||res.type==='opaque')){
    const cache=await caches.open(CACHE);
    cache.put(request,res.clone());
  }
  return res;
}
async function networkFirst(request){
  try{
    const res=await fetch(request);
    if(res&&res.ok){
      const cache=await caches.open(CACHE);
      cache.put(request,res.clone());
    }
    return res;
  }catch(e){
    const hit=await fromCache(request);
    return hit||new Response('',{status:504});
  }
}
async function page(){
  const cache=await caches.open(CACHE);
  return cache.match('./index.html')||cache.match('./')||cache.match('index.html');
}
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(req.mode==='navigate'){
    event.respondWith(page().then(hit=>hit||fetch(req)).catch(()=>page()));
    return;
  }
  if(url.origin!==self.location.origin){
    if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com')event.respondWith(cacheFirst(req));
    else if(url.hostname==='tile.openstreetmap.org'||url.hostname.endsWith('.tile.openstreetmap.org'))event.respondWith(cacheFirst(req).catch(()=>new Response('',{status:504})));
    else if(url.hostname==='nominatim.openstreetmap.org')event.respondWith(networkFirst(req));
    return;
  }
  event.respondWith(cacheFirst(req));
});
