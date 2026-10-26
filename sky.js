/* Offline star charts. Positions come from astronomy-engine and sky-data.js. */
(function(global){
  const PLANETS=[
    {id:'Mercury',label:'Mercury',color:'#d9d3c7'},
    {id:'Venus',label:'Venus',color:'#f4efe2'},
    {id:'Mars',label:'Mars',color:'#d08a6a'},
    {id:'Jupiter',label:'Jupiter',color:'#ecd7b0'},
    {id:'Saturn',label:'Saturn',color:'#e4d2a8'}
  ];
  const ZODIAC=new Set(['Ari','Tau','Gem','Cnc','Leo','Vir','Lib','Sco','Sgr','Cap','Aqr','Psc']);
  const cache=new Map();

  function lib(){return global.Astronomy||null}
  function data(){return global.SKY_DATA||null}
  function ready(){return !!(lib()&&data())}

  function pad(n){return String(n).padStart(2,'0')}
  function localWhen(dateKey,hhmm){
    const parts=String(dateKey||'').split('-').map(Number);
    const clock=String(hhmm||'22:00').split(':').map(Number);
    const y=parts[0],m=parts[1],d=parts[2],hh=clock[0],mm=clock[1];
    if(!y||!m||!d)return new Date();
    return new Date(y,m-1,d,Number.isFinite(hh)?hh:22,Number.isFinite(mm)?mm:0,0,0);
  }
  function minutes(hhmm){
    const p=String(hhmm||'0:0').split(':').map(Number);
    return (Number.isFinite(p[0])?p[0]:0)*60+(Number.isFinite(p[1])?p[1]:0);
  }
  function fromMinutes(n){
    n=Math.max(0,Math.min(1439,Math.round(Number(n)||0)));
    return pad(Math.floor(n/60))+':'+pad(n%60);
  }
  function wrap(deg){
    let x=deg%360;
    if(x<0)x+=360;
    return x;
  }
  function angDiff(from,to){
    let d=wrap(to)-wrap(from);
    if(d>180)d-=360;
    if(d<-180)d+=360;
    return d;
  }
  function addDays(date,n){return new Date(date.getTime()+n*86400000)}
  function dayKey(date){
    return date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate());
  }
  function shortDate(date){
    return date.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  }

  function apparent(body,date){
    const A=lib();
    const time=A.MakeTime(date);
    const vec=A.GeoVector(A.Body[body],time,true);
    const ecl=A.Ecliptic(vec);
    return {lon:ecl.elon,lat:ecl.elat,time};
  }
  function motionAt(body,date){
    const half=6*3600000;
    const a=apparent(body,new Date(date.getTime()-half)).lon;
    const b=apparent(body,new Date(date.getTime()+half)).lon;
    return angDiff(a,b)*2;
  }
  function stations(body,center,spanDays){
    const key=body+'|'+dayKey(center)+'|'+spanDays;
    if(cache.has(key))return cache.get(key);
    const start=addDays(center,-spanDays);
    const n=spanDays*2;
    const rows=[];
    for(let i=0;i<=n;i++){
      const date=addDays(start,i);
      rows.push({date,m:motionAt(body,date)});
    }
    const found=[];
    for(let i=0;i<rows.length-1;i++){
      const a=rows[i],b=rows[i+1];
      if(a.m===0||(a.m<0)===(b.m<0))continue;
      let lo=a.date.getTime(),hi=b.date.getTime(),mlo=a.m;
      for(let k=0;k<18;k++){
        const mid=(lo+hi)/2;
        const mm=motionAt(body,new Date(mid));
        if((mlo<0)===(mm<0)){lo=mid;mlo=mm}
        else hi=mid;
      }
      found.push({
        date:new Date((lo+hi)/2),
        kind:a.m>0?'retrograde':'direct'
      });
    }
    cache.set(key,found);
    return found;
  }
  function planetMeta(id){
    return PLANETS.find(p=>p.id===id)||PLANETS[1];
  }
  function status(planetId,date){
    if(!ready()||!date)return '';
    const id=planetMeta(planetId).id;
    const label=planetMeta(planetId).label;
    const motion=motionAt(id,date);
    const list=stations(id,date,420).filter(s=>s.date.getTime()>=date.getTime()-3600000);
    const next=list.find(s=>s.date.getTime()>=date.getTime());
    const days=next?Math.max(0,Math.round((next.date.getTime()-date.getTime())/86400000)):null;
    if(Math.abs(motion)<0.03||days===0)return label+': stationary';
    if(motion<0)return days!=null?label+': retrograde, stationary in '+days+' days':label+': retrograde';
    return days!=null?label+': direct, stationary in '+days+' days':label+': direct';
  }
  function horizonOf(body,date,observer){
    const A=lib();
    const time=A.MakeTime(date);
    const eq=A.Equator(A.Body[body],time,observer,true,true);
    const hor=A.Horizon(time,observer,eq.ra,eq.dec,'normal');
    return {alt:hor.altitude,az:hor.azimuth,ra:eq.ra,dec:eq.dec};
  }
  const glareCache=new Map();
  /* Hidden when within 15° of the Sun, or up only in daylight or civil twilight. */
  function tooCloseMap(date,observer){
    const key=dayKey(date)+'|'+observer.latitude.toFixed(2)+'|'+observer.longitude.toFixed(2);
    if(glareCache.has(key))return glareCache.get(key);
    const A=lib();
    const noon=A.MakeTime(new Date(date.getFullYear(),date.getMonth(),date.getDate(),12,0,0,0));
    const flags={};
    PLANETS.forEach(p=>{
      flags[p.id]={elong:A.AngleFromSun(A.Body[p.id],noon)<15,up:false,dark:false};
    });
    const start=new Date(date.getFullYear(),date.getMonth(),date.getDate(),0,0,0,0);
    for(let m=0;m<24*60;m+=15){
      const when=new Date(start.getTime()+m*60000);
      const sun=horizonOf('Sun',when,observer).alt;
      PLANETS.forEach(p=>{
        if(horizonOf(p.id,when,observer).alt<=0)return;
        flags[p.id].up=true;
        if(sun<-6)flags[p.id].dark=true;
      });
    }
    const out={};
    PLANETS.forEach(p=>{
      const f=flags[p.id];
      out[p.id]=!!(f.elong||(f.up&&!f.dark));
    });
    glareCache.set(key,out);
    return out;
  }
  function whatsUp(lat,lng,date){
    if(!ready()||!Number.isFinite(lat)||!Number.isFinite(lng)||!date)return '';
    const A=lib();
    const observer=new A.Observer(lat,lng,0);
    const glare=tooCloseMap(date,observer);
    const up=[];
    const hidden=[];
    PLANETS.forEach(p=>{
      if(glare[p.id])hidden.push(p.label);
      else if(horizonOf(p.id,date,observer).alt>0)up.push(p.label);
    });
    if(horizonOf('Moon',date,observer).alt>0)up.push('the Moon');
    let line;
    if(!up.length)line="What's up tonight: none of the bright planets";
    else if(up.length===1)line="What's up tonight: "+up[0];
    else line="What's up tonight: "+up.slice(0,-1).join(', ')+' and '+up[up.length-1];
    hidden.forEach(name=>{line+='. '+name+': too close to the Sun to see'});
    return line;
  }

  function starVectors(){
    const D=data();
    if(D._vec)return D._vec;
    const A=lib();
    const time=A.MakeTime(new Date(Date.UTC(2000,0,1)));
    D._vec=D.stars.map(s=>{
      const sph=new A.Spherical(s[1],s[0],1);
      return A.VectorFromSphere(sph,time);
    });
    return D._vec;
  }
  function horizontal(date,lat,lng){
    const A=lib();
    const time=A.MakeTime(date);
    const observer=new A.Observer(lat,lng,0);
    return {A,time,observer,rot:A.Rotation_EQJ_HOR(time,observer)};
  }
  function facingOf(value){
    const n=Number(value);
    return Number.isFinite(n)?wrap(n):180;
  }
  const FACE_NAMES=[[0,'north'],[45,'northeast'],[90,'east'],[135,'southeast'],[180,'south'],[225,'southwest'],[270,'west'],[315,'northwest']];
  function facingName(deg){
    const d=facingOf(deg);
    let name='south',best=999;
    FACE_NAMES.forEach(([n,label])=>{
      const diff=Math.abs(angDiff(n,d));
      if(diff<best){best=diff;name=label}
    });
    if(best<=22.5)return 'Facing '+name;
    return 'Facing '+Math.round(d)+'°';
  }
  /* The faced azimuth sits at the bottom. Labels stay upright; only positions move. */
  function project(az,alt,cx,cy,R,facing){
    if(alt<-1.2)return null;
    const zd=Math.max(0,Math.min(1,(90-alt)/90));
    const a=wrap(az-facingOf(facing)+180)*Math.PI/180;
    return {x:cx-Math.sin(a)*zd*R,y:cy-Math.cos(a)*zd*R};
  }
  function starSize(mag){
    const t=Math.max(0,Math.min(1,(5.1-mag)/6.4));
    return 0.45+t*t*3.1;
  }
  function prepare(canvas,w,h){
    const dpr=Math.min(2,global.devicePixelRatio||1);
    canvas.width=Math.round(w*dpr);
    canvas.height=Math.round(h*dpr);
    canvas.style.width='100%';
    canvas.style.height='auto';
    const ctx=canvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return ctx;
  }
  function labelBox(ctx,text,x,y,size,color,align,boxes){
    ctx.font=size+'px Georgia, "Iowan Old Style", serif';
    const w=ctx.measureText(text).width;
    const left=(align==='left'?x:align==='right'?x-w:x-w/2);
    const box={l:left-2,t:y-size*0.7,r:left+w+2,b:y+size*0.7};
    if(boxes&&hitsBox(box,boxes))return null;
    ctx.fillStyle=color;
    ctx.textAlign=align||'center';
    ctx.textBaseline='middle';
    ctx.fillText(text,x,y);
    if(boxes)boxes.push(box);
    return box;
  }
  function hitsBox(box,boxes){
    return boxes.some(o=>!(box.r<o.l||box.l>o.r||box.b<o.t||box.t>o.b));
  }

  function drawAllSky(canvas,opts){
    if(!canvas)return;
    const w=640,h=640,cx=320,cy=320,R=286;
    const facing=facingOf(opts&&opts.facing);
    const plot=(az,alt)=>project(az,alt,cx,cy,R,facing);
    const ctx=prepare(canvas,w,h);
    const hits=[];
    ctx.clearRect(0,0,w,h);
    const sky=ctx.createRadialGradient(cx,cy-20,40,cx,cy,R);
    sky.addColorStop(0,'#1b2944');
    sky.addColorStop(0.72,'#10192c');
    sky.addColorStop(1,'#070b14');
    ctx.beginPath();
    ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.fillStyle=sky;
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.clip();
    if(!ready()||!Number.isFinite(opts.lat)||!Number.isFinite(opts.lng)||!opts.date){
      ctx.restore();
      ctx.fillStyle='#d7deea';
      ctx.font='18px Georgia, serif';
      ctx.textAlign='center';
      ctx.fillText('Add a place to see the sky',cx,cy);
      canvas._skyHits=[];
      return;
    }
    const frame=horizontal(opts.date,opts.lat,opts.lng);
    const A=frame.A;
    const vecs=starVectors();
    const D=data();
    const placed=[];
    const starPx=vecs.map((vec,i)=>{
      const hv=A.RotateVector(frame.rot,vec);
      const sph=A.HorizonFromVector(hv,'normal');
      const p=plot(sph.lon,sph.lat);
      if(!p)return null;
      return {i,x:p.x,y:p.y,mag:D.stars[i][2],name:D.stars[i][3]>=0?D.names[D.stars[i][3]]:''};
    });
    const highlight=opts.highlight||'Tau';
    D.cons.forEach(con=>{
      const on=con.id===highlight;
      ctx.strokeStyle=on?'rgba(243,226,196,.92)':'rgba(176,190,210,.28)';
      ctx.lineWidth=on?1.7:1;
      con.lines.forEach(flat=>{
        let prev=null;
        for(let i=0;i<flat.length;i+=2){
          const sph=new A.Spherical(flat[i+1],flat[i],1);
          const eq=A.VectorFromSphere(sph,frame.time);
          const hv=A.RotateVector(frame.rot,eq);
          const hor=A.HorizonFromVector(hv,'normal');
          const p=plot(hor.lon,hor.lat);
          if(prev&&p){
            ctx.beginPath();
            ctx.moveTo(prev.x,prev.y);
            ctx.lineTo(p.x,p.y);
            ctx.stroke();
            hits.push({kind:'con',name:con.name,x:(prev.x+p.x)/2,y:(prev.y+p.y)/2,x1:prev.x,y1:prev.y,x2:p.x,y2:p.y,r:12});
          }
          prev=p;
        }
      });
    });
    starPx.forEach(s=>{
      if(!s)return;
      ctx.beginPath();
      ctx.arc(s.x,s.y,starSize(s.mag),0,Math.PI*2);
      ctx.fillStyle=s.mag<1.5?'#f7f4ee':'rgba(214,224,236,.88)';
      ctx.fill();
      if(s.name)hits.push({kind:'star',name:s.name,x:s.x,y:s.y,r:Math.max(10,starSize(s.mag)+8)});
      if(s.name&&s.mag<=1.5&&!(highlight==='Tau'&&s.name==='Aldebaran')){
        labelBox(ctx,s.name,s.x,s.y-starSize(s.mag)-8,11,'rgba(236,228,210,.82)','center',placed);
      }
    });
    const bodies=[...PLANETS.map(p=>({id:p.id,label:p.label,color:p.color,r:4.4})),{id:'Moon',label:'Moon',color:'#f6f1e6',r:11}];
    const sun=horizonOf('Sun',opts.date,frame.observer);
    bodies.forEach(body=>{
      let hor;
      try{hor=horizonOf(body.id,opts.date,frame.observer)}catch(e){return}
      const p=plot(hor.az,hor.alt);
      if(!p)return;
      if(body.id==='Moon')drawMoon(ctx,p.x,p.y,body.r,opts.date,sun,hor,facing,'chart');
      else{
        ctx.beginPath();
        ctx.arc(p.x,p.y,body.r,0,Math.PI*2);
        ctx.fillStyle=body.color;
        ctx.fill();
      }
      labelBox(ctx,body.label,p.x,p.y-body.r-9,12,'rgba(244,239,226,.92)','center',placed);
      hits.push({kind:'planet',name:body.label,x:p.x,y:p.y,r:16});
    });
    D.cons.forEach(con=>{
      const sph=new A.Spherical(con.dec,con.ra,1);
      const hv=A.RotateVector(frame.rot,A.VectorFromSphere(sph,frame.time));
      const hor=A.HorizonFromVector(hv,'normal');
      const p=plot(hor.lon,hor.lat);
      if(!p)return;
      const zodiac=ZODIAC.has(con.id);
      const on=con.id===highlight;
      if(!on&&!zodiac&&!opts.names)return;
      const size=on?15:zodiac?12:11;
      const color=on?'rgba(246,232,206,.96)':zodiac?'rgba(226,214,186,.84)':'rgba(190,202,216,.62)';
      if(!on&&!labelBox(ctx,con.name,p.x,p.y,size,color,'center',placed))return;
      if(on)labelBox(ctx,con.name,p.x,p.y,size,color,'center',placed);
      hits.push({kind:'con',name:con.name,x:p.x,y:p.y,r:14});
    });
    if(highlight==='Tau'){
      const alde=starPx.find(s=>s&&s.name==='Aldebaran');
      if(alde){
        labelBox(ctx,'Aldebaran',alde.x+16,alde.y-12,12,'rgba(246,232,206,.95)','left');
        hits.push({kind:'star',name:'Aldebaran',x:alde.x,y:alde.y,r:14});
      }
      const sph=new A.Spherical(D.pleiades[1],D.pleiades[0],1);
      const hv=A.RotateVector(frame.rot,A.VectorFromSphere(sph,frame.time));
      const hor=A.HorizonFromVector(hv,'normal');
      const ple=plot(hor.lon,hor.lat);
      if(ple){
        labelBox(ctx,'Pleiades',ple.x,ple.y-12,12,'rgba(246,232,206,.95)','center');
        hits.push({kind:'star',name:'Pleiades',x:ple.x,y:ple.y,r:14});
      }
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.strokeStyle='rgba(232,220,196,.45)';
    ctx.lineWidth=1.25;
    ctx.stroke();
    ctx.fillStyle='rgba(232,220,196,.8)';
    ctx.font='13px Georgia, serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    [['N',0],['E',90],['S',180],['W',270]].forEach(([t,az])=>{
      const p=project(az,0,cx,cy,R-18,facing);
      if(p)ctx.fillText(t,p.x,p.y);
    });
    canvas._skyHits=hits;
    canvas._skyBox={w,h};
  }

  function drawMoon(ctx,x,y,r,date,sun,moon,facing,mode){
    const A=lib();
    const phase=A.MoonPhase(date);
    const limb=Math.cos(phase*Math.PI/180);
    let angle;
    if(mode==='horizon'){
      const dx=angDiff(moon.az,sun.az);
      const dy=-(sun.alt-moon.alt);
      angle=Math.atan2(dy,dx);
    }else{
      const aim=az=>{
        const rel=wrap(az-facingOf(facing)+180)*Math.PI/180;
        return {x:-Math.sin(rel),y:-Math.cos(rel)};
      };
      const ms=aim(moon.az),ss=aim(sun.az);
      angle=Math.atan2(ss.y-ms.y,ss.x-ms.x);
    }
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.arc(0,0,r,0,Math.PI*2);
    ctx.fillStyle='#242b3b';
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(0,0,r-0.4,0,Math.PI*2);
    ctx.clip();
    if(limb<0.985){
      const rx=Math.max(0.01,Math.abs(limb))*r;
      ctx.beginPath();
      ctx.arc(0,0,r,-Math.PI/2,Math.PI/2,false);
      ctx.ellipse(0,0,rx,r,0,Math.PI/2,-Math.PI/2,limb>=0);
      ctx.fillStyle='#f4efe4';
      ctx.fill();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0,0,r,0,Math.PI*2);
    ctx.strokeStyle='rgba(246,241,230,.75)';
    ctx.lineWidth=1;
    ctx.stroke();
    ctx.restore();
  }

  function horizonGeom(){
    const w=720,h=340,span=120,half=60,altMax=75;
    const padX=32,padTop=28,padBot=42;
    return {w,h,span,half,altMax,padX,padTop,padBot,innerW:w-padX*2,innerH:h-padTop-padBot,horizonY:h-padBot};
  }
  function projectStrip(az,alt,facing,g,loose){
    const dAz=angDiff(facing,az);
    const limit=loose?g.half+36:g.half+0.6;
    if(Math.abs(dAz)>limit)return null;
    if(alt<-1.2)return null;
    if(!loose&&alt>g.altMax+1.5)return null;
    const x=g.padX+((dAz+g.half)/g.span)*g.innerW;
    const y=g.horizonY-(Math.max(0,Math.min(g.altMax,alt))/g.altMax)*g.innerH;
    return {x,y,dAz};
  }
  function drawHorizon(canvas,opts){
    if(!canvas)return;
    const g=horizonGeom();
    const facing=facingOf(opts&&opts.facing);
    const ctx=prepare(canvas,g.w,g.h);
    const hits=[];
    ctx.clearRect(0,0,g.w,g.h);
    const sky=ctx.createLinearGradient(0,0,0,g.horizonY);
    sky.addColorStop(0,'#10192c');
    sky.addColorStop(1,'#24344f');
    roundRect(ctx,0,0,g.w,g.h,12);
    ctx.fillStyle=sky;
    ctx.fill();
    ctx.fillStyle='#1c1610';
    ctx.fillRect(0,g.horizonY,g.w,g.h-g.horizonY);
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.padX,g.padTop-6,g.innerW,g.horizonY-(g.padTop-6));
    ctx.clip();
    if(!ready()||!opts||!Number.isFinite(opts.lat)||!Number.isFinite(opts.lng)||!opts.date){
      ctx.restore();
      ctx.fillStyle='#d7deea';
      ctx.font='18px Georgia, serif';
      ctx.textAlign='center';
      ctx.fillText('Add a place to see the sky',g.w/2,g.h/2);
      canvas._skyHits=[];
      canvas._skyBox={w:g.w,h:g.h};
      return;
    }
    const frame=horizontal(opts.date,opts.lat,opts.lng);
    const A=frame.A;
    const vecs=starVectors();
    const D=data();
    const placed=[];
    const highlight=opts.highlight||'Tau';
    ctx.strokeStyle='rgba(214,206,186,.16)';
    ctx.lineWidth=1;
    [30,60].forEach(alt=>{
      const y=g.horizonY-(alt/g.altMax)*g.innerH;
      ctx.beginPath();
      ctx.moveTo(g.padX,y);
      ctx.lineTo(g.w-g.padX,y);
      ctx.stroke();
    });
    D.cons.forEach(con=>{
      const on=con.id===highlight;
      ctx.strokeStyle=on?'rgba(243,226,196,.92)':'rgba(176,190,210,.28)';
      ctx.lineWidth=on?1.7:1;
      con.lines.forEach(flat=>{
        let prev=null;
        for(let i=0;i<flat.length;i+=2){
          const sph=new A.Spherical(flat[i+1],flat[i],1);
          const eq=A.VectorFromSphere(sph,frame.time);
          const hv=A.RotateVector(frame.rot,eq);
          const hor=A.HorizonFromVector(hv,'normal');
          const p=projectStrip(hor.lon,hor.lat,facing,g,true);
          if(prev&&p){
            ctx.beginPath();
            ctx.moveTo(prev.x,prev.y);
            ctx.lineTo(p.x,p.y);
            ctx.stroke();
            if(Math.abs(prev.dAz)<=g.half||Math.abs(p.dAz)<=g.half){
              hits.push({kind:'con',name:con.name,x:(prev.x+p.x)/2,y:(prev.y+p.y)/2,x1:prev.x,y1:prev.y,x2:p.x,y2:p.y,r:12});
            }
          }
          prev=p;
        }
      });
    });
    const starPx=vecs.map((vec,i)=>{
      const hv=A.RotateVector(frame.rot,vec);
      const sph=A.HorizonFromVector(hv,'normal');
      const p=projectStrip(sph.lon,sph.lat,facing,g,false);
      if(!p)return null;
      return {i,x:p.x,y:p.y,mag:D.stars[i][2],name:D.stars[i][3]>=0?D.names[D.stars[i][3]]:''};
    });
    starPx.forEach(s=>{
      if(!s)return;
      ctx.beginPath();
      ctx.arc(s.x,s.y,starSize(s.mag),0,Math.PI*2);
      ctx.fillStyle=s.mag<1.5?'#f7f4ee':'rgba(214,224,236,.88)';
      ctx.fill();
      if(s.name)hits.push({kind:'star',name:s.name,x:s.x,y:s.y,r:Math.max(10,starSize(s.mag)+8)});
      if(s.name&&s.mag<=1.5&&!(highlight==='Tau'&&s.name==='Aldebaran')){
        labelBox(ctx,s.name,s.x,s.y-starSize(s.mag)-8,11,'rgba(236,228,210,.82)','center',placed);
      }
    });
    const bodies=[...PLANETS.map(p=>({id:p.id,label:p.label,color:p.color,r:4.4})),{id:'Moon',label:'Moon',color:'#f6f1e6',r:10}];
    const sun=horizonOf('Sun',opts.date,frame.observer);
    bodies.forEach(body=>{
      let hor;
      try{hor=horizonOf(body.id,opts.date,frame.observer)}catch(e){return}
      const p=projectStrip(hor.az,hor.alt,facing,g,false);
      if(!p)return;
      if(body.id==='Moon')drawMoon(ctx,p.x,p.y,body.r,opts.date,sun,hor,facing,'horizon');
      else{
        ctx.beginPath();
        ctx.arc(p.x,p.y,body.r,0,Math.PI*2);
        ctx.fillStyle=body.color;
        ctx.fill();
      }
      labelBox(ctx,body.label,p.x,p.y-body.r-9,12,'rgba(244,239,226,.92)','center',placed);
      hits.push({kind:'planet',name:body.label,x:p.x,y:p.y,r:16});
    });
    D.cons.forEach(con=>{
      const sph=new A.Spherical(con.dec,con.ra,1);
      const hv=A.RotateVector(frame.rot,A.VectorFromSphere(sph,frame.time));
      const hor=A.HorizonFromVector(hv,'normal');
      const p=projectStrip(hor.lon,hor.lat,facing,g,false);
      if(!p)return;
      const zodiac=ZODIAC.has(con.id);
      const on=con.id===highlight;
      if(!on&&!zodiac&&!opts.names)return;
      const size=on?15:zodiac?12:11;
      const color=on?'rgba(246,232,206,.96)':zodiac?'rgba(226,214,186,.84)':'rgba(190,202,216,.62)';
      labelBox(ctx,con.name,p.x,p.y,size,color,'center',placed);
      hits.push({kind:'con',name:con.name,x:p.x,y:p.y,r:14});
    });
    if(highlight==='Tau'){
      const alde=starPx.find(s=>s&&s.name==='Aldebaran');
      if(alde){
        labelBox(ctx,'Aldebaran',alde.x+16,alde.y-12,12,'rgba(246,232,206,.95)','left');
        hits.push({kind:'star',name:'Aldebaran',x:alde.x,y:alde.y,r:14});
      }
      const sph=new A.Spherical(D.pleiades[1],D.pleiades[0],1);
      const hv=A.RotateVector(frame.rot,A.VectorFromSphere(sph,frame.time));
      const hor=A.HorizonFromVector(hv,'normal');
      const ple=projectStrip(hor.lon,hor.lat,facing,g,false);
      if(ple){
        labelBox(ctx,'Pleiades',ple.x,ple.y-12,12,'rgba(246,232,206,.95)','center');
        hits.push({kind:'star',name:'Pleiades',x:ple.x,y:ple.y,r:14});
      }
    }
    ctx.restore();
    ctx.strokeStyle='rgba(232,220,196,.7)';
    ctx.lineWidth=1.4;
    ctx.beginPath();
    ctx.moveTo(g.padX,g.horizonY);
    ctx.lineTo(g.w-g.padX,g.horizonY);
    ctx.stroke();
    ctx.fillStyle='rgba(232,220,196,.88)';
    ctx.font='13px Georgia, serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    [['N',0],['NE',45],['E',90],['SE',135],['S',180],['SW',225],['W',270],['NW',315]].forEach(([t,az])=>{
      const dAz=angDiff(facing,az);
      if(Math.abs(dAz)>g.half-8)return;
      const x=g.padX+((dAz+g.half)/g.span)*g.innerW;
      ctx.fillText(t,x,g.horizonY+16);
    });
    [30,60].forEach(alt=>{
      const y=g.horizonY-(alt/g.altMax)*g.innerH;
      ctx.fillStyle='rgba(214,206,186,.55)';
      ctx.font='11px Georgia, serif';
      ctx.textAlign='left';
      ctx.fillText(alt+'°',8,y);
    });
    ctx.fillStyle='rgba(236,228,210,.9)';
    ctx.font='13px Georgia, serif';
    ctx.textAlign='left';
    ctx.textBaseline='middle';
    ctx.fillText(facingName(facing),14,16);
    canvas._skyHits=hits;
    canvas._skyBox={w:g.w,h:g.h};
  }

  function drawPath(canvas,opts){
    if(!canvas)return;
    const w=720,h=280;
    const ctx=prepare(canvas,w,h);
    const hits=[];
    ctx.clearRect(0,0,w,h);
    const g=ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,'#141c2e');
    g.addColorStop(1,'#0b101b');
    ctx.fillStyle=g;
    roundRect(ctx,0,0,w,h,12);
    ctx.fill();
    const planet=planetMeta(opts.planet||'Venus');
    if(!ready()||!opts.date){
      canvas._skyHits=[];
      return;
    }
    const span=Math.max(20,Math.min(180,Number(opts.windowDays)||60));
    const step=span>100?7:5;
    const samples=[];
    for(let d=-span;d<=span;d+=step){
      const date=addDays(opts.date,d);
      const pos=apparent(planet.id,date);
      const motion=motionAt(planet.id,date);
      samples.push({date,lon:pos.lon,lat:pos.lat,retro:motion<0,now:Math.abs(d)<step/2});
    }
    if(!samples.length){canvas._skyHits=[];return}
    let origin=samples[0].lon;
    samples.forEach(s=>{s.rel=angDiff(origin,s.lon)});
    let min=Math.min(...samples.map(s=>s.rel))-14;
    let max=Math.max(...samples.map(s=>s.rel))+14;
    if(max-min<36){const mid=(min+max)/2;min=mid-18;max=mid+18}
    const padX=36,padY=28;
    const xOf=rel=>padX+(1-(rel-min)/(max-min))*(w-padX*2);
    const yOf=lat=>h/2-(lat/16)*(h/2-padY);
    ctx.strokeStyle='rgba(214,206,186,.28)';
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(padX,yOf(0));
    ctx.lineTo(w-padX,yOf(0));
    ctx.stroke();
    const A=lib();
    const time=A.MakeTime(opts.date);
    const eclRot=A.Rotation_EQJ_ECT(time);
    const D=data();
    const vecs=starVectors();
    D.stars.forEach((s,i)=>{
      if(s[2]>5)return;
      const hv=A.RotateVector(eclRot,vecs[i]);
      const sph=A.SphereFromVector(hv);
      const rel=angDiff(origin,sph.lon);
      if(rel<min||rel>max||Math.abs(sph.lat)>13)return;
      const x=xOf(rel),y=yOf(sph.lat);
      ctx.beginPath();
      ctx.arc(x,y,starSize(s[2])*0.85,0,Math.PI*2);
      ctx.fillStyle='rgba(210,220,232,.8)';
      ctx.fill();
      if(s[3]>=0&&s[2]<=1.6){
        labelBox(ctx,D.names[s[3]],x,y-8,11,'rgba(220,214,196,.75)','center');
        hits.push({kind:'star',name:D.names[s[3]],x,y,r:10});
      }
    });
    D.cons.forEach(con=>{
      if(!ZODIAC.has(con.id))return;
      const sph0=new A.Spherical(con.dec,con.ra,1);
      const hv=A.RotateVector(eclRot,A.VectorFromSphere(sph0,time));
      const sph=A.SphereFromVector(hv);
      const rel=angDiff(origin,sph.lon);
      if(rel<min+4||rel>max-4)return;
      const on=con.id===(opts.highlight||'Tau');
      labelBox(ctx,con.name,xOf(rel),yOf(0)+(on?-34:30),on?14:12,on?'rgba(246,232,206,.95)':'rgba(214,204,180,.72)','center');
      hits.push({kind:'con',name:con.name,x:xOf(rel),y:yOf(0),r:16});
    });
    ctx.lineCap='round';
    ctx.lineJoin='round';
    for(let i=1;i<samples.length;i++){
      const a=samples[i-1],b=samples[i];
      ctx.beginPath();
      ctx.moveTo(xOf(a.rel),yOf(a.lat));
      ctx.lineTo(xOf(b.rel),yOf(b.lat));
      ctx.strokeStyle=(a.retro||b.retro)?'#c4846a':'#d5dbe6';
      ctx.lineWidth=(a.retro||b.retro)?2.4:1.6;
      ctx.stroke();
    }
    samples.forEach(s=>{
      const x=xOf(s.rel),y=yOf(s.lat);
      ctx.beginPath();
      ctx.arc(x,y,s.now?6.5:3.1,0,Math.PI*2);
      ctx.fillStyle=s.retro?'#e0a08a':'#f4efe4';
      ctx.fill();
      if(s.now){
        ctx.lineWidth=1.5;
        ctx.strokeStyle='#f7f1e4';
        ctx.stroke();
      }
      hits.push({kind:'planet',name:planet.label,x,y,r:12});
    });
    const runs=[];
    let run=null;
    samples.forEach(s=>{
      if(s.retro){
        if(!run)run={a:s,b:s};
        run.b=s;
      }else if(run){runs.push(run);run=null}
    });
    if(run)runs.push(run);
    runs.forEach(seg=>{
      const x=(xOf(seg.a.rel)+xOf(seg.b.rel))/2;
      const y=Math.min(yOf(seg.a.lat),yOf(seg.b.lat))-16;
      labelBox(ctx,'retrograde',x,Math.max(18,y),13,'#f0c2b0','center');
    });
    stations(planet.id,opts.date,span).forEach(st=>{
      const rel=angDiff(origin,apparent(planet.id,st.date).lon);
      if(rel<min||rel>max)return;
      const pos=apparent(planet.id,st.date);
      const x=xOf(angDiff(origin,pos.lon)),y=yOf(pos.lat);
      ctx.fillStyle='#f6efe2';
      ctx.fillRect(x-0.6,y-14,1.2,10);
      labelBox(ctx,shortDate(st.date),x,y+16,11,'rgba(246,236,220,.9)','center');
    });
    labelBox(ctx,planet.label+' along the ecliptic',16,16,13,'rgba(232,224,206,.9)','left');
    canvas._skyHits=hits;
    canvas._skyBox={w,h};
  }
  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }
  function distToSeg(px,py,x1,y1,x2,y2){
    const dx=x2-x1,dy=y2-y1;
    const len=dx*dx+dy*dy||1;
    let t=((px-x1)*dx+(py-y1)*dy)/len;
    t=Math.max(0,Math.min(1,t));
    const x=x1+t*dx,y=y1+t*dy;
    return Math.hypot(px-x,py-y);
  }
  function pick(canvas,ev){
    const hits=canvas._skyHits||[];
    const box=canvas._skyBox||{w:canvas.width,h:canvas.height};
    const rect=canvas.getBoundingClientRect();
    const x=(ev.clientX-rect.left)/rect.width*box.w;
    const y=(ev.clientY-rect.top)/rect.height*box.h;
    const near=[];
    hits.forEach(h=>{
      const d=h.x1==null?Math.hypot(x-h.x,y-h.y):distToSeg(x,y,h.x1,h.y1,h.x2,h.y2);
      if(d<=(h.r||12))near.push({h,d});
    });
    const bodies=near.filter(c=>c.h.x1==null&&(c.h.kind==='star'||c.h.kind==='planet'));
    const pool=bodies.length?bodies:near;
    pool.sort((a,b)=>a.d-b.d);
    return pool.length?pool[0].h:null;
  }
  const ZODIAC_ORDER=['Ari','Tau','Gem','Cnc','Leo','Vir','Lib','Sco','Sgr','Cap','Aqr','Psc'];
  /* common name, brightest star, then extra search words */
  const ABOUT={
    And:['the Princess','Alpheratz'],
    Ant:['the Air Pump',''],
    Aps:['the Bird of Paradise',''],
    Aqr:['the Water Bearer','', 'water'],
    Aql:['the Eagle','Altair','eagle'],
    Ara:['the Altar',''],
    Ari:['the Ram','Hamal','ram'],
    Aur:['the Charioteer','Capella'],
    Boo:['the Herdsman','Arcturus','bootes','herdsman'],
    Cae:['the Chisel',''],
    Cam:['the Giraffe','','giraffe'],
    Cnc:['the Crab','','crab'],
    CVn:['the Hunting Dogs','','hunting dogs'],
    CMa:['the Great Dog','Sirius','big dog','dog star'],
    CMi:['the Little Dog','Procyon','little dog'],
    Cap:['the Sea Goat','','goat','sea goat'],
    Car:['the Keel','Canopus','keel'],
    Cas:['the Queen','','queen','cass'],
    Cen:['the Centaur','','centaur'],
    Cep:['the King','','king'],
    Cet:['the Whale','','whale','sea monster'],
    Cha:['the Chameleon','','chameleon'],
    Cir:['the Compass',''],
    Col:['the Dove','','dove'],
    Com:['Berenice\'s Hair','','hair','berenice'],
    CrA:['the Southern Crown','','southern crown'],
    CrB:['the Northern Crown','','northern crown'],
    Crv:['the Crow','','crow','raven'],
    Crt:['the Cup','','cup'],
    Cru:['the Southern Cross','Acrux','southern cross','cross'],
    Cyg:['the Swan','Deneb','swan','northern cross'],
    Del:['the Dolphin','','dolphin'],
    Dor:['the Dolphinfish','','swordfish'],
    Dra:['the Dragon','','dragon'],
    Equ:['the Foal','','little horse','foal'],
    Eri:['the River','','river'],
    For:['the Furnace','','furnace'],
    Gem:['the Twins','Pollux','twins','castor'],
    Gru:['the Crane','','crane'],
    Her:['the Hero','','heracles'],
    Hor:['the Clock','','clock'],
    Hya:['the Water Snake',''],
    Hyi:['the Male Hydra',''],
    Ind:['the Indian',''],
    Lac:['the Lizard','','lizard'],
    Leo:['the Lion','Regulus','lion'],
    LMi:['the Little Lion','','little lion'],
    Lep:['the Hare','','hare'],
    Lib:['the Scales','','scales','balance'],
    Lup:['the Wolf','','wolf'],
    Lyn:['the Lynx',''],
    Lyr:['the Lyre','Vega','lyre','harp'],
    Men:['the Table Mountain','','table'],
    Mic:['the Microscope','','microscope'],
    Mon:['the Unicorn','','unicorn'],
    Mus:['the Fly','','fly'],
    Nor:['the Level',''],
    Oct:['the Octant','','octant'],
    Oph:['the Serpent Bearer','','serpent bearer','snake holder'],
    Ori:['the Hunter','Rigel','hunter','betelgeuse'],
    Pav:['the Peacock','','peacock'],
    Peg:['the Winged Horse','','winged horse'],
    Per:['the Hero','Mirfak'],
    Phe:['the Phoenix',''],
    Pic:['the Painter','','easel'],
    Psc:['the Fishes','','fish','fishes'],
    PsA:['the Southern Fish','Fomalhaut','southern fish'],
    Pup:['the Stern','','stern'],
    Pyx:['the Compass','','mariner'],
    Ret:['the Net','','net'],
    Sge:['the Arrow','','arrow'],
    Sgr:['the Archer','','archer','teapot'],
    Sco:['the Scorpion','Antares','scorpion'],
    Scl:['the Sculptor',''],
    Sct:['the Shield','','shield'],
    Ser:['the Serpent','','snake','serpent'],
    Sex:['the Sextant','','sextant'],
    Tau:['the Bull','Aldebaran','bull','pleiades','seven sisters','hyades'],
    Tel:['the Telescope','','telescope'],
    Tri:['the Triangle','','triangle'],
    TrA:['the Southern Triangle','','southern triangle'],
    Tuc:['the Toucan','','toucan'],
    UMa:['the Great Bear','Dubhe','big dipper','great bear','plough','plow','dipper','big bear'],
    UMi:['the Little Bear','Polaris','little dipper','little bear','north star','polaris','dipper'],
    Vel:['the Sails','','sails'],
    Vir:['the Maiden','Spica','virgin','maiden'],
    Vol:['the Flying Fish','','flying fish'],
    Vul:['the Fox','','fox']
  };
  function foldName(s){
    return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  }
  function blurbFor(con){
    const a=ABOUT[con.id];
    if(!a||!a[0])return con.name;
    let text=con.name+' – '+a[0];
    if(ZODIAC.has(con.id))text+=', zodiac';
    if(a[1])text+='; brightest star '+a[1];
    return text;
  }
  function catalog(){
    const D=data();
    if(!D)return [];
    if(D._catalog)return D._catalog;
    const seen=new Set();
    D._catalog=[];
    D.cons.forEach(con=>{
      if(!con||seen.has(con.id))return;
      seen.add(con.id);
      const extra=ABOUT[con.id]||[];
      const hay=foldName([con.name,con.id,ZODIAC.has(con.id)?'zodiac':'',extra.join(' ')].join(' '));
      D._catalog.push({id:con.id,name:con.name,zodiac:ZODIAC.has(con.id),blurb:blurbFor(con),hay});
    });
    return D._catalog;
  }
  function constellationInfo(id){
    return catalog().find(c=>c.id===id)||null;
  }
  function searchConstellations(query){
    const q=foldName(query).trim();
    const rows=catalog().filter(c=>!q||c.hay.indexOf(q)>=0);
    const zodiac=ZODIAC_ORDER.map(id=>rows.find(c=>c.id===id)).filter(Boolean);
    const rest=rows.filter(c=>!c.zodiac).sort((a,b)=>a.name.localeCompare(b.name));
    return {zodiac,rest};
  }
  function constellations(){
    return catalog().map(c=>({id:c.id,name:c.name})).sort((a,b)=>a.name.localeCompare(b.name));
  }

  global.Sky={
    planets:PLANETS,
    ready,
    localWhen,
    minutes,
    fromMinutes,
    wrap,
    angDiff,
    facingName,
    status,
    whatsUp,
    stations,
    apparent,
    constellations,
    constellationInfo,
    searchConstellations,
    drawAllSky,
    drawHorizon,
    drawPath,
    pick
  };
})(window);
