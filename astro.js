/* Astrology for the Sky category. Offline: positions come from astronomy-engine. */
(function(global){
  const T='︎'; /* text presentation, so glyphs never turn into emoji */
  const SUN_SIGN='taurus';

  const SIGNS=[
    {id:'aries',name:'Aries',glyph:'♈',dates:'Mar 21 – Apr 19',element:'Fire',modality:'Cardinal',ruler:'Mars',
      body:'Head and face',keywords:'Courage, beginnings, energy, impulse',
      style:'charging ahead boldly',
      text:'Aries opens the zodiac at the spring equinox, so it is the sign of first steps. It is traditionally brave, direct and quick to act, happiest when starting something new. Its gift is courage; its lesson is patience.'},
    {id:'taurus',name:'Taurus',glyph:'♉',dates:'Apr 20 – May 20',element:'Earth',modality:'Fixed',ruler:'Venus',
      body:'Throat and neck',keywords:'Steadiness, comfort, the senses, loyalty',
      style:'slowed down, steady and sensual',
      text:'Taurus is the calm, grounded sign of spring in full bloom. It loves good food, soft textures, music and the things that last, and it builds slowly and surely. Traditionally it is loyal and patient, and famously hard to rush.'},
    {id:'gemini',name:'Gemini',glyph:'♊',dates:'May 21 – Jun 20',element:'Air',modality:'Mutable',ruler:'Mercury',
      body:'Arms, hands, shoulders and lungs',keywords:'Curiosity, talk, variety, wit',
      style:'curious and quick, wanting variety',
      text:'Gemini, the Twins, is the sign of conversation and curiosity. It wants to know a little about everything and to share it, often all at once. Traditionally it is playful, clever and restless, with two sides to every story.'},
    {id:'cancer',name:'Cancer',glyph:'♋',dates:'Jun 21 – Jul 22',element:'Water',modality:'Cardinal',ruler:'Moon',
      body:'Chest, breasts and stomach',keywords:'Home, care, memory, feeling',
      style:'tender and protective',
      text:'Cancer, the Crab, carries its home with it. It is the sign of family, comfort and looking after others, with a soft heart under a careful shell. Its moods are said to rise and fall like the tides of its ruler, the Moon.'},
    {id:'leo',name:'Leo',glyph:'♌',dates:'Jul 23 – Aug 22',element:'Fire',modality:'Fixed',ruler:'Sun',
      body:'Heart, spine and upper back',keywords:'Warmth, pride, creativity, play',
      style:'warm, proud and on show',
      text:'Leo, the Lion, is the sign of high summer and big hearts. It loves to create, to perform and to be appreciated, and it is generous with its warmth. Traditionally it is loyal, dramatic and brave.'},
    {id:'virgo',name:'Virgo',glyph:'♍',dates:'Aug 23 – Sep 22',element:'Earth',modality:'Mutable',ruler:'Mercury',
      body:'Digestive system and intestines',keywords:'Care, craft, detail, usefulness',
      style:'careful, practical and helpful',
      text:'Virgo is the sign of the harvest, of sorting the good grain from the rest. It notices small things, likes to be useful and takes pride in work done well. Traditionally it is modest, thoughtful and quietly kind.'},
    {id:'libra',name:'Libra',glyph:'♎',dates:'Sep 23 – Oct 22',element:'Air',modality:'Cardinal',ruler:'Venus',
      body:'Kidneys, lower back and skin',keywords:'Balance, fairness, beauty, partnership',
      style:'seeking balance and harmony',
      text:'Libra, the Scales, begins at the autumn equinox, when day and night are equal. It is the sign of fairness, good manners and relationships, and it loves beauty in all its forms. It can weigh a choice for a long time before deciding.'},
    {id:'scorpio',name:'Scorpio',glyph:'♏',dates:'Oct 23 – Nov 21',element:'Water',modality:'Fixed',ruler:'Pluto (traditionally Mars)',
      body:'Reproductive organs',keywords:'Depth, intensity, loyalty, renewal',
      style:'intense, private and all-or-nothing',
      text:'Scorpio is the deep, still water of late autumn. It feels things strongly, keeps its secrets and is fiercely loyal once trust is earned. Traditionally it is the sign of endings that make way for new beginnings.'},
    {id:'sagittarius',name:'Sagittarius',glyph:'♐',dates:'Nov 22 – Dec 21',element:'Fire',modality:'Mutable',ruler:'Jupiter',
      body:'Hips, thighs and liver',keywords:'Adventure, hope, honesty, learning',
      style:'roaming far, hopeful and frank',
      text:'Sagittarius, the Archer, aims its arrow at the horizon. It loves travel, big ideas and a good laugh, and it tends to say exactly what it thinks. Traditionally it is optimistic, freedom-loving and always learning.'},
    {id:'capricorn',name:'Capricorn',glyph:'♑',dates:'Dec 22 – Jan 19',element:'Earth',modality:'Cardinal',ruler:'Saturn',
      body:'Knees, bones, teeth and skin',keywords:'Ambition, patience, responsibility, structure',
      style:'channelled through discipline and patience',
      text:'Capricorn, the Sea-Goat, begins at the winter solstice and climbs steadily upward. It is the sign of hard work, long plans and quiet ambition. Traditionally it is serious on the outside, with a dry sense of humour underneath.'},
    {id:'aquarius',name:'Aquarius',glyph:'♒',dates:'Jan 20 – Feb 18',element:'Air',modality:'Fixed',ruler:'Uranus (traditionally Saturn)',
      body:'Ankles, calves and circulation',keywords:'Originality, friendship, ideals, the future',
      style:'independent, inventive and a little detached',
      text:'Aquarius, the Water-Bearer, pours out new ideas for everyone to share. It is the sign of friends, groups and causes, and of doing things its own way. Traditionally it is inventive, independent and a little ahead of its time.'},
    {id:'pisces',name:'Pisces',glyph:'♓',dates:'Feb 19 – Mar 20',element:'Water',modality:'Mutable',ruler:'Neptune (traditionally Jupiter)',
      body:'Feet',keywords:'Imagination, compassion, dreams, sensitivity',
      style:'soft, imaginative and compassionate',
      text:'Pisces, two Fish swimming in opposite directions, closes the zodiac. It is the dreamy, gentle sign of art, music and empathy, feeling what others feel. Traditionally it is kind, intuitive and sometimes hard to pin down.'}
  ];

  const PLANETS=[
    {id:'Sun',glyph:'☉',rules:['Leo'],element:'Fire',body:'Heart, spine and eyes',theme:'core self',
      text:'The Sun is your core self: who you are when you shine. It stands for vitality, purpose and the light you bring to others. Your sun sign, Taurus for you, is the sign the Sun was in on the day you were born.'},
    {id:'Moon',glyph:'☽',rules:['Cancer'],element:'Water',body:'Stomach, breasts and the body’s fluids',theme:'feelings',
      text:'The Moon is your inner world: feelings, moods, memories and what makes you feel safe. It is the part of you that needs comfort and home. It moves fastest of all, changing sign every two or three days.'},
    {id:'Mercury',glyph:'☿',rules:['Gemini','Virgo'],element:'Air (changeable, takes on its neighbours)',body:'Nerves, lungs, hands and speech',theme:'thinking and talking',
      text:'Mercury is the messenger: how you think, learn, talk and write. It rules everyday travel, letters and quick decisions. When it turns retrograde, tradition says to double-check plans and messages.'},
    {id:'Venus',glyph:'♀',rules:['Taurus','Libra'],element:'Water (cool and moist)',body:'Throat, kidneys and skin',theme:'love and taste',
      text:'Venus is love, beauty and pleasure: what you find lovely and how you give affection. It rules art, friendship, comfort and money. It is the ruler of Taurus, so it is the planet most tied to your sun sign.'},
    {id:'Mars',glyph:'♂',rules:['Aries','Scorpio (traditional)'],element:'Fire',body:'Muscles, blood and head',theme:'drive',
      text:'Mars is drive and courage: how you go after what you want. It is energy, action, competition and a quick temper. Used well, it gives you the push to start and the nerve to stand your ground.'},
    {id:'Jupiter',glyph:'♃',rules:['Sagittarius','Pisces (traditional)'],element:'Air (warm and moist)',body:'Liver, hips and thighs',theme:'growth and luck',
      text:'Jupiter is the great benefic, the planet of growth, generosity and good fortune. It stands for faith, learning, travel and seeing the bigger picture. Wherever it sits, tradition says things tend to expand.'},
    {id:'Saturn',glyph:'♄',rules:['Capricorn','Aquarius (traditional)'],element:'Earth (cold and dry)',body:'Bones, teeth, skin and knees',theme:'duty and structure',
      text:'Saturn is the teacher: time, limits, responsibility and hard-won wisdom. It can feel strict, but it rewards patience and steady effort. It builds the walls that keep things standing.'},
    {id:'Uranus',glyph:'♅',rules:['Aquarius'],element:'Air (modern, from Aquarius)',body:'Nervous system, ankles and circulation',theme:'the urge for change',
      text:'Uranus is sudden change, rebellion and electricity, the lightning flash. It rules invention, freedom and anything unexpected. Found in 1781, it is a modern planet, so it has no ancient lore.'},
    {id:'Neptune',glyph:'♆',rules:['Pisces'],element:'Water (modern, from Pisces)',body:'Feet and the lymph system',theme:'dreams and intuition',
      text:'Neptune is the dreamer: intuition, imagination, music and spirituality. It is also illusion and fog, where things are not quite what they seem. Found in 1846, it is a modern planet named for the god of the sea.'},
    {id:'Pluto',glyph:'♇',rules:['Scorpio'],element:'Water (modern, from Scorpio)',body:'Reproductive organs and elimination',theme:'deep transformation',
      text:'Pluto is deep transformation: endings, rebirth, power and what lies hidden. It moves very slowly, so it colours whole generations. Astronomers now call it a dwarf planet, but astrologers still use it.'}
  ];

  let guidePlanet='Sun',guideSign=SUN_SIGN,lastWhen=null;

  function lib(){return global.Astronomy||null}
  function ready(){return !!lib()}
  function wrap(d){d%=360;return d<0?d+360:d}
  function signAt(lon){return SIGNS[Math.floor(wrap(lon)/30)%12]}
  function lonOf(A,body,date){
    return A.Ecliptic(A.GeoVector(A.Body[body],A.MakeTime(date),true)).elon;
  }
  function positions(date){
    const A=lib();
    if(!A||!date)return [];
    const time=A.MakeTime(date);
    return PLANETS.map(p=>{
      const vec=A.GeoVector(A.Body[p.id],time,true);
      const lon=wrap(A.Ecliptic(vec).elon);
      const eq=A.EquatorFromVector(vec);
      let con='';
      try{con=A.Constellation(eq.ra,eq.dec).name}catch(e){}
      let rx=false;
      if(p.id!=='Sun'&&p.id!=='Moon'){
        const a=lonOf(A,p.id,new Date(date.getTime()-6*3600000));
        const b=lonOf(A,p.id,new Date(date.getTime()+6*3600000));
        let d=wrap(b)-wrap(a);if(d>180)d-=360;if(d<-180)d+=360;
        rx=d<0;
      }
      const sign=signAt(lon);
      return {planet:p,lon,deg:Math.floor(lon%30),sign,rx,con};
    });
  }

  function el(tag,attrs,...kids){
    const e=document.createElement(tag);
    for(const k in attrs||{}){
      const v=attrs[k];
      if(k.startsWith('on')&&typeof v==='function')e.addEventListener(k.slice(2),v);
      else if(k==='class')e.className=v;
      else if(v===true)e.setAttribute(k,'');
      else if(v!==false&&v!=null)e.setAttribute(k,String(v));
    }
    kids.flat().forEach(c=>{if(c!=null&&c!==false)e.append(typeof c==='object'?c:String(c))});
    return e;
  }
  const NS='http://www.w3.org/2000/svg';
  function svg(tag,attrs,...kids){
    const e=document.createElementNS(NS,tag);
    for(const k in attrs||{}){
      const v=attrs[k];
      if(k.startsWith('on')&&typeof v==='function')e.addEventListener(k.slice(2),v);
      else if(v!=null&&v!==false)e.setAttribute(k,String(v));
    }
    kids.flat().forEach(c=>{if(c!=null&&c!==false)e.append(typeof c==='object'?c:String(c))});
    return e;
  }
  function glyph(g,cls){return el('span',{class:'astro-glyph'+(cls?' '+cls:''),'aria-hidden':'true'},g+T)}
  function placement(p){return p.planet.id+', '+p.deg+'° '+p.sign.name}
  function inSignLine(p){
    return p.planet.id+' in '+p.sign.name+': '+p.planet.theme+', '+p.sign.style+'.';
  }

  /* Planets today */
  function tableCard(list){
    const rows=list.map(p=>el('tr',{},
      el('th',{scope:'row'},
        el('button',{type:'button',class:'astro-link',onclick:()=>pick('planet',p.planet.id,true)},glyph(p.planet.glyph),p.planet.id),
        p.rx?el('span',{class:'astro-rx',title:'Retrograde'},'Rx'):null),
      el('td',{},
        el('button',{type:'button',class:'astro-link',onclick:()=>pick('sign',p.sign.id,true)},
          el('span',{class:'astro-deg'},p.deg+'°'),' ',glyph(p.sign.glyph,'sm'),p.sign.name),
        el('span',{class:'astro-con-inline'},p.con)),
      el('td',{class:'astro-con'},p.con)));
    return el('div',{class:'card astro-card',id:'astroTodayCard'},
      el('h3',{class:'astro-title'},'Planets today'),
      el('p',{class:'muted sm astro-when',id:'astroWhen'},whenText()),
      el('table',{class:'astro-table'},
        el('thead',{},el('tr',{},el('th',{scope:'col'},'Planet'),el('th',{scope:'col'},'Sign'),el('th',{scope:'col',class:'astro-con'},'Constellation'))),
        el('tbody',{},rows)),
      el('p',{class:'muted sm astro-note'},'Signs are counted from the spring equinox, but the real constellations behind them have slipped about 24° because of precession, so the two often differ.'),
      el('h4',{class:'astro-sub'},'Planet in sign'),
      el('ul',{class:'astro-lines'},list.map(p=>el('li',{},
        el('span',{class:'astro-lead'},p.planet.id+' in '+p.sign.name),
        el('span',{class:'astro-line-text'},': '+p.planet.theme+', '+p.sign.style+'.'),
        p.rx?el('span',{class:'muted sm'},' (retrograde, so turned inward and reviewing)'):null))));
  }
  function whenText(){
    if(!lastWhen)return '';
    return lastWhen.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'})+' · '+
      lastWhen.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})+' · tropical zodiac';
  }

  /* Zodiac wheel: Aries on the left, signs run counter-clockwise, like a chart. */
  function wheelCard(list){
    const S=360,c=S/2,R=170,r1=134,r0=58;
    const pt=(lon,rad)=>{const a=(180-lon)*Math.PI/180;return {x:c+Math.cos(a)*rad,y:c+Math.sin(a)*rad}};
    const kids=[
      svg('circle',{cx:c,cy:c,r:R,class:'wh-ring'}),
      svg('circle',{cx:c,cy:c,r:r1,class:'wh-inner'}),
      svg('circle',{cx:c,cy:c,r:r0,class:'wh-hub'})
    ];
    SIGNS.forEach((s,i)=>{
      const a=pt(i*30,R),b=pt(i*30,r0);
      kids.push(svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'wh-spoke'}));
      const g=pt(i*30+15,(R+r1)/2);
      const sun=s.id===SUN_SIGN;
      kids.push(svg('g',{class:'wh-sign'+(sun?' sun':'')+(guideSign===s.id?' on':''),role:'button',tabindex:'0','aria-label':s.name,
        onclick:()=>pick('sign',s.id,true),onkeydown:ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();pick('sign',s.id,true)}}},
        svg('path',{d:sector(i*30,i*30+30,R,r1,pt),class:'wh-hit'}),
        svg('text',{x:g.x,y:g.y,class:'wh-sign-glyph','text-anchor':'middle','dominant-baseline':'central'},s.glyph+T)));
    });
    for(let d=0;d<360;d+=10){
      const a=pt(d,r1),b=pt(d,r1-(d%30===0?0:5));
      if(d%30)kids.push(svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'wh-tick'}));
    }
    /* Spread planets so glyphs do not overlap. */
    const sorted=list.slice().sort((a,b)=>a.lon-b.lon);
    const placed=[];
    sorted.forEach(p=>{
      let lane=0;
      while(placed.some(q=>q.lane===lane&&Math.abs(((p.lon-q.lon+540)%360)-180)<15))lane++;
      placed.push({p,lane,lon:p.lon});
    });
    placed.forEach(({p,lane})=>{
      const rad=r1-20-lane*25;
      const tick=pt(p.lon,r1),tick2=pt(p.lon,r1-7),at=pt(p.lon,Math.max(r0+12,rad));
      kids.push(svg('line',{x1:tick.x,y1:tick.y,x2:tick2.x,y2:tick2.y,class:'wh-ptick'}));
      kids.push(svg('g',{class:'wh-planet'+(guidePlanet===p.planet.id?' on':''),role:'button',tabindex:'0','aria-label':placement(p)+(p.rx?', retrograde':''),
        onclick:ev=>{ev.stopPropagation();pick('planet',p.planet.id,true)},onkeydown:ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();pick('planet',p.planet.id,true)}}},
        svg('circle',{cx:at.x,cy:at.y,r:11,class:'wh-pdot'+(p.rx?' rx':'')}),
        svg('text',{x:at.x,y:at.y,class:'wh-pglyph','text-anchor':'middle','dominant-baseline':'central'},p.planet.glyph+T),
        null));
    });
    kids.push(svg('text',{x:c,y:c-6,class:'wh-hub-text','text-anchor':'middle'},'Tap a planet'));
    kids.push(svg('text',{x:c,y:c+10,class:'wh-hub-text','text-anchor':'middle'},'or a sign'));
    return el('div',{class:'card astro-card',id:'astroWheelCard'},
      el('h3',{class:'astro-title'},'Zodiac wheel'),
      el('div',{class:'astro-wheel'},svg('svg',{viewBox:'0 0 '+S+' '+S,role:'img','aria-label':'Zodiac wheel with today’s planets'},kids)),
      el('p',{class:'muted sm astro-note'},'Aries starts on the left and the signs run counter-clockwise, the way a birth chart is drawn. A dashed ring marks a planet in retrograde.'));
  }
  function sector(a0,a1,R,r,pt){
    const p1=pt(a0,R),p2=pt(a1,R),p3=pt(a1,r),p4=pt(a0,r);
    return 'M'+p1.x+' '+p1.y+' A'+R+' '+R+' 0 0 0 '+p2.x+' '+p2.y+' L'+p3.x+' '+p3.y+' A'+r+' '+r+' 0 0 1 '+p4.x+' '+p4.y+' Z';
  }

  /* Guides */
  function guideCard(list){
    return el('div',{class:'card astro-card',id:'astroGuideCard'},
      el('h3',{class:'astro-title'},'Guides'),
      el('p',{class:'muted sm'},'Traditional astrological meanings, for exploring and reflection.'),
      el('p',{class:'lbl astro-menu-lbl'},'Planets'),
      el('div',{class:'astro-menu',role:'tablist','aria-label':'Planets'},PLANETS.map(p=>
        el('button',{type:'button',class:'btn ghost astro-pick'+(guidePlanet===p.id?' on':''),role:'tab','aria-selected':guidePlanet===p.id?'true':'false','data-planet':p.id,onclick:()=>pick('planet',p.id)},glyph(p.glyph),p.id))),
      planetDetail(list),
      el('p',{class:'lbl astro-menu-lbl'},'Signs'),
      el('div',{class:'astro-menu',role:'tablist','aria-label':'Signs'},SIGNS.map(s=>
        el('button',{type:'button',class:'btn ghost astro-pick'+(guideSign===s.id?' on':''),role:'tab','aria-selected':guideSign===s.id?'true':'false','data-sign':s.id,onclick:()=>pick('sign',s.id)},glyph(s.glyph),s.name))),
      signDetail(list));
  }
  function fact(label,value){return el('div',{class:'astro-fact'},el('dt',{},label),el('dd',{},value))}
  function planetDetail(list){
    const p=PLANETS.find(x=>x.id===guidePlanet)||PLANETS[0];
    const now=list.find(x=>x.planet.id===p.id);
    return el('div',{class:'astro-detail',id:'astroPlanetDetail'},
      el('div',{class:'astro-detail-head'},el('span',{class:'astro-big','aria-hidden':'true'},p.glyph+T),
        el('div',{},el('p',{class:'astro-name'},p.id),now?el('p',{class:'muted sm'},'Today: '+now.deg+'° '+now.sign.name+(now.rx?', retrograde':'')):null)),
      el('p',{class:'astro-text'},p.text),
      now?el('p',{class:'astro-today'},inSignLine(now)):null,
      el('dl',{class:'astro-facts'},
        fact('Rules',p.rules.join(', ')),
        fact('Element',p.element),
        fact('Body',p.body+' (traditional)')));
  }
  function signDetail(list){
    const s=SIGNS.find(x=>x.id===guideSign)||SIGNS[1];
    const here=list.filter(x=>x.sign.id===s.id);
    return el('div',{class:'astro-detail',id:'astroSignDetail'},
      el('div',{class:'astro-detail-head'},el('span',{class:'astro-big','aria-hidden':'true'},s.glyph+T),
        el('div',{},el('p',{class:'astro-name'},s.name,s.id===SUN_SIGN?el('span',{class:'astro-badge'},'your sun sign'):null),
          el('p',{class:'muted sm'},s.dates))),
      el('p',{class:'astro-text'},s.text),
      el('dl',{class:'astro-facts'},
        fact('Element',s.element),
        fact('Modality',s.modality),
        fact('Ruler',s.ruler),
        fact('Body',s.body+' (traditional)'),
        fact('Keywords',s.keywords),
        fact('Here today',here.length?here.map(x=>x.planet.id+(x.rx?' Rx':'')).join(', '):'No planets right now')));
  }

  function pick(kind,id,jump){
    if(kind==='planet')guidePlanet=id;else guideSign=id;
    repaint();
    const chip=document.querySelector('#astroPanel .astro-pick.on[data-'+kind+'="'+id+'"]');
    const menu=chip&&chip.parentElement;
    if(menu){
      const left=chip.offsetLeft,right=left+chip.offsetWidth;
      if(left<menu.scrollLeft||right>menu.scrollLeft+menu.clientWidth)menu.scrollLeft=left-menu.clientWidth/2+chip.offsetWidth/2;
    }
    if(jump){
      const target=document.getElementById(kind==='planet'?'astroPlanetDetail':'astroSignDetail');
      if(target&&target.scrollIntoView)target.scrollIntoView({behavior:'smooth',block:'center'});
    }
  }
  function contents(){
    if(!ready())return [el('div',{class:'card astro-card'},el('p',{class:'muted'},'Astrology needs the star chart library, which has not loaded.'))];
    const list=positions(lastWhen);
    return [
      el('h2',{class:'block-heading astro-heading'},'Astrology'),
      tableCard(list),
      wheelCard(list),
      guideCard(list)
    ];
  }
  function repaint(){
    const root=document.getElementById('astroPanel');
    if(!root)return;
    const keep=['.astro-menu'].map(sel=>[...root.querySelectorAll(sel)].map(n=>n.scrollLeft));
    root.replaceChildren(...contents());
    const menus=[...root.querySelectorAll('.astro-menu')];
    menus.forEach((m,i)=>{if(keep[0][i]!=null)m.scrollLeft=keep[0][i]});
  }
  function panel(when){
    lastWhen=when||new Date();
    return el('section',{class:'astro-panel',id:'astroPanel','aria-label':'Astrology'},contents());
  }
  function update(when){
    if(!when)return;
    if(lastWhen&&Math.abs(when.getTime()-lastWhen.getTime())<30000)return;
    lastWhen=when;
    repaint();
  }

  global.Astro={panel,update,positions,signs:SIGNS,planets:PLANETS,inSignLine};
})(window);
