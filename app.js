'use strict';
/* Holy Stocks Screener · Testlauf · Graustufen-Visualisierung (keine Farbcodierung) */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const nf=(v,d=1)=>v==null?'–':v.toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d});
const pf=p=>p==null?'–':(Math.abs(p)>=1000?p.toLocaleString('de-DE',{maximumFractionDigits:0}):p.toLocaleString('de-DE',{maximumSignificantDigits:4}));
const dDE=s=>{const[y,m,d]=s.split('-');return `${d}.${m}.${y}`;};
const G={w:'#f2f2f2',l:'#d0d0d0',m:'#9a9a9a',d:'#6a6a6a',x:'#3a3a3a',bg:'#0a0a0a'};
const COLDESC=['Spanne steht, Tests an beiden Rändern, noch kein Spring.','Spring oder Test am unteren Rand, Kurs noch unter der Mittellinie.','Nach dem Spring auf dem Weg zum Creek, bis JAC/Ausbruch.','Ab BUEC/Backup: Fortsetzung nach oben oder seitwärts über dem Creek.'];
let B=null, order=[], tips=false;

/* ---------- glyph: Nightingale-Rose, 4 Blätter A B C D, Ring = Board-Durchschnitt ---------- */
let SD={A:8,B:8,C:15,D:15};
function rose(ph,avg,size=56,opt={}){
  const c=size/2, R=size*0.25, max=size*0.49, P=['A','B','C','D'];
  let s=`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">`;
  P.forEach((p,k)=>{
    const v=ph[p], a0=-Math.PI/2+k*Math.PI/2+0.06, a1=a0+Math.PI/2-0.12;
    if(v==null){const am=(a0+a1)/2;s+=`<circle cx="${c+R*0.5*Math.cos(am)}" cy="${c+R*0.5*Math.sin(am)}" r="${size*0.022}" fill="${G.d}"/>`;return;}
    const z=(v-avg[p])/(SD[p]||10), r=Math.max(R*0.3,Math.min(max,R*(1+0.45*z)));
    s+=`<path d="M${c},${c} L${c+r*Math.cos(a0)},${c+r*Math.sin(a0)} A${r},${r} 0 0 1 ${c+r*Math.cos(a1)},${c+r*Math.sin(a1)} Z" fill="${G.w}" stroke="${G.bg}" stroke-width="${size>80?1.5:.8}"/>`;
    if(opt.labels){const am=(a0+a1)/2, rl=Math.max(r,R)+size*0.07;s+=`<text x="${c+rl*Math.cos(am)}" y="${c+rl*Math.sin(am)+4}" fill="${G.m}" font-size="11" text-anchor="middle">${p}</text>`;}
  });
  s+=`<circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="${G.m}" stroke-width="${size>80?1.2:.9}" stroke-dasharray="${size>80?'3 2':'none'}"/>`;
  return s+'</svg>';
}
const funnelIcon=(s=11)=>`<svg width="${s}" height="${s}" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 2 L11 2 L7 7 L7 11 L5 11 L5 7 Z" fill="${G.w}"/></svg>`;
const dots=(r,n=5)=>r==null?'':'●'.repeat(r)+'○'.repeat(n-r);

/* ---------- Board ---------- */
function renderBoard(){
  const el=$('#pBoard'); el.innerHTML='';
  B.cols.forEach((name,ci)=>{
    const cards=B.cards.filter(c=>c.col===ci).sort((a,b)=>b.q-a.q);
    const col=document.createElement('section'); col.className='col';
    col.innerHTML=`<div class="colh"><div class="n">0${ci+1}</div><h2>${name}<small>${cards.length}</small></h2><p>${COLDESC[ci]}</p><div class="prog"><i style="left:${ci*25}%;width:25%"></i></div></div>`;
    cards.forEach((c,k)=>{
      const b=document.createElement('button'); b.className='card'; b.dataset.id=c.id;
      const fx=[]; if(c.ft) fx.push(`<span>${funnelIcon()} Trichter</span>`); if(c.ns&&ci>=2) fx.push('<span>○ ohne Spring</span>'); if(c.t1) fx.push('<span>Spring Typ 1</span>');
      b.innerHTML=`<div class="hd"><span class="tk"><span class="rank">${k+1}</span>${c.sym.split(':')[1]||c.sym}</span><span class="nm">${esc(c.name)}</span></div>
        <div class="gl">${rose(c.ph,B.avg,58)}<div class="sc">${nf(c.q)}</div></div><canvas></canvas><div class="fx">${fx.join('')}</div>`;
      b.onclick=()=>openDetail(c.id);
      b.onmousemove=e=>tip(e,`<b>${esc(c.sym)}</b> · ${esc(c.name)}<br>Score ${nf(c.q)} · A ${nf(c.ph.A,0)} · B ${nf(c.ph.B,0)} · C ${nf(c.ph.C,0)} · D ${nf(c.ph.D,0)}`);
      b.onmouseleave=()=>tip();
      col.appendChild(b);
    });
    el.appendChild(col);
  });
  requestAnimationFrame(()=>$$('.card').forEach(b=>mini(b.querySelector('canvas'),B.cards.find(c=>c.id===b.dataset.id).m)));
}
function esc(s){return String(s??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));}
function mini(cv,m){
  const dpr=window.devicePixelRatio||1, W=cv.clientWidth, H=cv.clientHeight; cv.width=W*dpr; cv.height=H*dpr;
  const ctx=cv.getContext('2d'); ctx.scale(dpr,dpr);
  const c=m.c.filter(v=>v!=null), lo=Math.min(...c,m.lo), hi=Math.max(...c,m.hi), n=m.c.length;
  const X=i=>i/(n-1)*(W-2)+1, Y=v=>H-3-(v-lo)/(hi-lo||1)*(H-6);
  ctx.fillStyle='rgba(255,255,255,.07)'; ctx.fillRect(X(m.b0),Y(m.hi),X(m.b1)-X(m.b0),Y(m.lo)-Y(m.hi));
  ctx.strokeStyle=G.d; ctx.lineWidth=1; ctx.setLineDash([2,2]); ctx.beginPath(); ctx.moveTo(X(m.b0),Y(m.hi)+.5); ctx.lineTo(W,Y(m.hi)+.5); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle=G.w; ctx.lineWidth=1.2; ctx.beginPath(); m.c.forEach((v,i)=>{if(v==null)return; i?ctx.lineTo(X(i),Y(v)):ctx.moveTo(X(i),Y(v));}); ctx.stroke();
  for(const e of m.ev){const x=X(e.i), v=m.c[e.i]; if(v==null)continue; ctx.fillStyle=G.bg; ctx.strokeStyle=G.w; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(x,Y(v),2.6,0,7); ctx.fill(); ctx.stroke();}
}

/* ---------- Scatter ---------- */
function renderScatter(){
  const el=$('#scatter'), W=1200, H=640, ml=56, mr=24, mt=40, mb=46, tails=$('#tailToggle').checked;
  const all=B.cards.flatMap(c=>[c.q,...(tails?c.hist.filter(h=>h.x!=null).map(h=>h.q):[])]);
  const y0=Math.floor(Math.min(...all)/5)*5, y1=Math.ceil(Math.max(...all)/5)*5;
  const X=x=>ml+x/4*(W-ml-mr), Y=q=>mt+(y1-q)/(y1-y0)*(H-mt-mb);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Streudiagramm Fortschritt gegen Score">`;
  B.cols.forEach((n,i)=>{ if(i%2) s+=`<rect x="${X(i)}" y="${mt}" width="${X(1)-X(0)}" height="${H-mt-mb}" fill="#101010"/>`;
    s+=`<text x="${X(i+.5)}" y="${mt-14}" fill="${G.m}" font-size="12" text-anchor="middle" letter-spacing=".08em">${n.toUpperCase()}</text>`;});
  for(let q=y0;q<=y1;q+=5){s+=`<line x1="${ml}" x2="${W-mr}" y1="${Y(q)}" y2="${Y(q)}" stroke="#1c1c1c"/><text x="${ml-10}" y="${Y(q)+4}" fill="${G.d}" font-size="11" text-anchor="end">${q}</text>`;}
  const qm=B.cards.reduce((a,c)=>a+c.q,0)/B.cards.length;
  s+=`<line x1="${X(2)}" x2="${X(2)}" y1="${mt}" y2="${H-mb}" stroke="${G.x}" stroke-dasharray="3 4"/><line x1="${ml}" x2="${W-mr}" y1="${Y(qm)}" y2="${Y(qm)}" stroke="${G.x}" stroke-dasharray="3 4"/>`;
  s+=`<text x="${W-mr-8}" y="${mt+18}" fill="${G.d}" font-size="12" text-anchor="end" letter-spacing=".22em">HEISS</text><text x="${W-mr-8}" y="${mt+33}" fill="${G.x}" font-size="10.5" text-anchor="end">reif und sauber</text>`;
  s+=`<text x="${ml}" y="${H-12}" fill="${G.m}" font-size="11">Fortschritt durch die Phasen →</text><text x="${W-mr}" y="${H-12}" fill="${G.d}" font-size="11" text-anchor="end">gestrichelt: Mitte der Phasen · Ø Score ${nf(qm)}</text>`;
  s+=`<text transform="translate(16 ${mt+(H-mt-mb)/2}) rotate(-90)" fill="${G.m}" font-size="11" text-anchor="middle">Score v5</text>`;
  const G1=[],G2=[],G3=[];
  B.cards.forEach(c=>{
    if(tails){const pts=[...c.hist.map(h=>h.x==null?null:[X(h.x),Y(h.q),h.d]),[X(c.x),Y(c.q),'heute']];
      let segs=[],cur=[]; pts.forEach(p=>{if(p==null){if(cur.length)segs.push(cur);cur=[];}else cur.push(p);}); if(cur.length)segs.push(cur);
      G1.push(`<g class="tail" data-id="${c.id}">`+segs.map(sg=>`<polyline points="${sg.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" fill="none" stroke="#2b2b2b" stroke-width="1" stroke-linejoin="round"/>`).join('')
        +pts.filter(p=>p&&p[2]!=='heute').map(p=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="1.6" fill="#333"/>`).join('')+'</g>');}
    const x=X(c.x), y=Y(c.q);
    G2.push(`<g class="pt" data-id="${c.id}"><circle cx="${x}" cy="${y}" r="9" fill="transparent"/>${c.ft?`<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="${G.m}" stroke-width="1"/>`:''}<circle class="dot" cx="${x}" cy="${y}" r="4.6" fill="${c.ns&&c.col>=2?G.bg:G.w}" stroke="${G.w}" stroke-width="1.4"/></g>`);
    G3.push(`<text class="lab" data-id="${c.id}" x="${x+8}" y="${y-7}" fill="${G.d}" font-size="10.5">${esc(c.sym.split(':')[1]||c.sym)}</text>`);
  });
  s+=G1.join('')+G3.join('')+G2.join('')+'</svg>';
  el.innerHTML=s;
  const hl=(id,on)=>{const t=el.querySelector(`.tail[data-id="${CSS.escape(id)}"]`); if(t){t.querySelectorAll('polyline').forEach(p=>{p.setAttribute('stroke',on?G.w:'#2b2b2b');p.setAttribute('stroke-width',on?1.8:1);});t.querySelectorAll('circle').forEach(p=>p.setAttribute('fill',on?G.w:"#333"));if(on)t.parentNode.appendChild(t);}
    const l=el.querySelector(`.lab[data-id="${CSS.escape(id)}"]`); if(l){l.setAttribute('fill',on?G.w:G.d);l.setAttribute('font-weight',on?700:400);if(on){l.textContent=(B.cards.find(c=>c.id===id).sym.split(':')[1])+' · '+B.cards.find(c=>c.id===id).name;l.parentNode.appendChild(l);}else l.textContent=B.cards.find(c=>c.id===id).sym.split(':')[1];}
    el.querySelectorAll('.tail').forEach(t=>t.style.opacity=on&&t.dataset.id!==id?.25:1);};
  el.querySelectorAll('.pt').forEach(p=>{const id=p.dataset.id, c=B.cards.find(z=>z.id===id);
    p.onmouseenter=()=>hl(id,true); p.onmouseleave=()=>{hl(id,false);tip();};
    p.onmousemove=e=>tip(e,`<b>${esc(c.sym)}</b> · ${esc(c.name)}<br>${B.cols[c.col]} · Score ${nf(c.q)}<br>Verlauf: ${c.hist.filter(h=>h.q!=null).map(h=>nf(h.q,0)).join(' → ')}`);
    p.onclick=()=>openDetail(id);});
  $('#scNote').textContent=tails?`Schwänze: Scanner v5 mit Daten bis zu den Freitagen ${dDE(B.fridays[0])} … ${dDE(B.fridays[B.fridays.length-1])}, Lücke = damals nicht auf dem Board (Phase A/früh B oder keine Struktur).`:'';
}

/* ---------- Tooltip (Standard: aus) ---------- */
function tip(e,html){const t=$('#tip'); if(!tips||!e){t.hidden=true;return;} t.innerHTML=html; t.hidden=false;
  t.style.left=Math.min(innerWidth-270,e.clientX+14)+'px'; t.style.top=(e.clientY+14)+'px';}

/* ---------- Detail ---------- */
let charts=[], curId=null;
class WyOverlay{
  constructor(D){this.D=D;}
  attached({chart,series}){this.chart=chart;this.series=series;} detached(){} updateAllViews(){}
  paneViews(){const s=this;return[{zOrder:()=>'top',renderer:()=>({draw:t=>s.draw(t,false),drawBackground:t=>s.draw(t,true)})}];}
  draw(target,bg){target.useMediaCoordinateSpace(({context:ctx,mediaSize})=>{
    const D=this.D, ts=this.chart.timeScale(), W=mediaSize.width, H=mediaSize.height;
    const X=i=>ts.logicalToCoordinate(i), Y=p=>this.series.priceToCoordinate(p), bs=(ts.options().barSpacing||6)/2;
    const line=(x0,x1,y,col,dash=[],lw=1)=>{if(y==null||x0==null)return;ctx.strokeStyle=col;ctx.lineWidth=lw;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(x0,Math.round(y)+.5);ctx.lineTo(x1,Math.round(y)+.5);ctx.stroke();ctx.setLineDash([]);};
    const txt=(s,x,y,col,al='left',w=400,sz=11)=>{ctx.font=`${w} ${sz}px Inter,Helvetica Neue,system-ui,sans-serif`;ctx.textAlign=al;ctx.fillStyle=col;ctx.fillText(s,x,y);ctx.textAlign='left';};
    const bx=D.box, xa=X(bx.i0), xb=X(bx.i1);
    if(bg){
      if(xa!=null&&xb!=null){const yh=Y(bx.hi), yl=Y(bx.lo); ctx.fillStyle='rgba(255,255,255,.035)'; ctx.fillRect(xa-bs,yh,xb-xa+2*bs,yl-yh);}
      // Phasen: feine senkrechte Trenner
      ctx.strokeStyle='#1f1f1f'; ctx.setLineDash([2,3]);
      for(const sp of D.spans){const x=X(sp.i0); if(x==null)continue; ctx.beginPath(); ctx.moveTo(Math.round(x-bs)+.5,0); ctx.lineTo(Math.round(x-bs)+.5,H-22); ctx.stroke();}
      ctx.setLineDash([]); return;
    }
    // Phasenleiste unten
    const yb=H-14;
    for(const sp of D.spans){const x0=X(sp.i0), x1=X(sp.i1); if(x0==null||x1==null)continue;
      ctx.fillStyle=sp.ph==='C'?G.w:sp.ph.startsWith('D')?G.m:G.x; ctx.fillRect(x0-bs+1,yb,Math.max(2,x1-x0+2*bs-2),3);
      const lab={A:'A',B:'B',C:'C',D:'D früh','D+':'D spät'}[sp.ph]; if(x1-x0>14) txt(lab,(x0+x1)/2,yb-4,G.l,'center',600,10.5);}
    if(xa!=null){
      line(xa-bs,W,Y(D.creek),G.m,[],1); line(xa-bs,xb==null?W:xb+bs,Y(bx.lo),G.d,[],1);
      line(xa-bs,W,Y(D.mid),G.l,[5,4],1); line(xa-bs,W,Y(D.stops.classic),G.m,[10,3,2,3],1);
      const r=W-8; txt('Creek',r,Y(D.creek)-4,G.m,'right',500,10.5); txt('Mittellinie · enger Stopp',r,Y(D.mid)-4,G.l,'right',500,10.5);
      txt('Stopp klassisch',r,Y(D.stops.classic)+12,G.m,'right',500,10.5); txt('Spannentief',xa+2,Y(bx.lo)+12,G.d,'left',400,10);
    }
    if(D.fl&&D.fl.true){const a=X(D.fl.i0), b=X(D.fl.i1); if(a!=null&&b!=null){ctx.strokeStyle=G.w;ctx.lineWidth=1.3;
      ctx.beginPath();ctx.moveTo(a,Y(D.fl.hi[0]));ctx.lineTo(b,Y(D.fl.hi[1]));ctx.moveTo(a,Y(D.fl.lo[0]));ctx.lineTo(b,Y(D.fl.lo[1]));ctx.stroke();
      txt('Trichter',b+4,Y((D.fl.hi[1]+D.fl.lo[1])/2)+4,G.w,'left',600,10.5);}}
    // Ereignisse mit Bewertung
    const placed=[]; const hit=(a)=>placed.some(b=>a.x0<b.x1+3&&a.x1>b.x0-3&&a.y0<b.y1+2&&a.y1>b.y0-2);
    const evs=[...D.ev].sort((a,b)=>a.i-b.i);
    for(const e of evs){const x=X(e.i); if(x==null)continue; const y=Y(e.p); if(y==null)continue;
      ctx.font='600 11px Inter,Helvetica Neue,system-ui,sans-serif';
      const name=(e.fire?'✦ ':'')+e.k, dt=dots(e.r); const wN=ctx.measureText(name).width; ctx.font='8.5px system-ui,sans-serif'; const wD=dt?ctx.measureText(dt).width+5:0;
      const w=wN+wD+10; let lv=0, box;
      for(;lv<8;lv++){const o=16+lv*19, yy=e.lo?y+o:y-o; box={x0:x-w/2,x1:x+w/2,y0:yy-8,y1:yy+8}; if(!hit(box))break;}
      placed.push(box);
      const off=16+lv*19, yl=e.lo?y+off:y-off;
      ctx.strokeStyle=e.top?G.w:G.d; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(Math.round(x)+.5,e.lo?y+3:y-3); ctx.lineTo(Math.round(x)+.5,e.lo?yl-7:yl+7); ctx.stroke();
      const bx0=x-w/2, by0=yl-8;
      if(e.top){ctx.fillStyle=G.w; rr(ctx,bx0,by0,w,16,3); ctx.fill();}
      else{ctx.fillStyle='rgba(10,10,10,.85)'; rr(ctx,bx0,by0,w,16,3); ctx.fill(); ctx.strokeStyle=e.r==null?G.x:G.d; ctx.stroke();}
      txt(name,bx0+5,yl+4,e.top?'#000':(e.r==null?G.m:G.w),'left',600,11);
      if(dt) txt(dt,bx0+5+wN+5,yl+3.5,e.top?'#000':G.l,'left',400,8.5);
    }
  });}
}
function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

function baseOpts(last){return{autoSize:true,layout:{attributionLogo:false,background:{type:'solid',color:G.bg},textColor:G.m,fontSize:11,fontFamily:'Inter,Helvetica Neue,system-ui,sans-serif'},
  grid:{vertLines:{visible:false},horzLines:{color:'#151515'}},rightPriceScale:{borderColor:'#222',minimumWidth:78},
  timeScale:{visible:last,borderColor:'#222',rightOffset:8},crosshair:{mode:0,vertLine:{color:'#555',style:2,labelBackgroundColor:'#333'},horzLine:{color:'#555',style:2,labelBackgroundColor:'#333'}},
  localization:{locale:'de-DE',dateFormat:'dd.MM.yyyy'},handleScale:{axisPressedMouseMove:{time:true,price:true}}};}

async function openDetail(id){
  curId=id; location.hash='s='+encodeURIComponent(id); $('#detail').hidden=false; document.body.style.overflow='hidden';
  const c=B.cards.find(z=>z.id===id);
  const D=await (await fetch('data/s/'+c.f)).json(); if(curId!==id)return;
  charts.forEach(ch=>ch.remove()); charts=[];
  $('#dSym').textContent=D.sym; $('#dName').textContent=D.name;
  $('#dMeta').innerHTML=`<span>${D.colName}</span><span>Daten bis ${dDE(D.asof)}</span><span class="big">${nf(D.q)}</span>`;
  const LW=window.LightweightCharts, T=D.t, n=T.length;
  const mk=(k,last=false,extra={})=>{const ch=LW.createChart($('#c'+k),Object.assign(baseOpts(last),extra)); charts.push(ch); return ch;};
  // Kurs
  const c0=mk(0,false,{rightPriceScale:{borderColor:'#222',minimumWidth:78,scaleMargins:{top:.1,bottom:.13}}});
  const cs=c0.addCandlestickSeries({upColor:G.bg,borderUpColor:G.w,wickUpColor:G.w,downColor:'#8a8a8a',borderDownColor:'#8a8a8a',wickDownColor:'#8a8a8a',priceLineVisible:false,lastValueVisible:true,
    priceFormat:{type:'custom',formatter:pf,minMove:0.0001}});
  cs.setData(T.map((t,i)=>({time:t,open:D.o[i],high:D.h[i],low:D.l[i],close:D.c[i]})));
  cs.attachPrimitive(new WyOverlay(D));
  $('#pl0').innerHTML=`Kurs <small>hohl = steigend · grau gefüllt = fallend · Ereignisse mit Bewertung ●○ (0–5), weiß hinterlegt = Top, ✦ = außergewöhnlich</small>`;
  // Volumen
  const c1=mk(1); const vs=c1.addHistogramSeries({priceFormat:{type:'volume'},priceLineVisible:false,lastValueVisible:false});
  vs.setData(T.map((t,i)=>({time:t,value:D.v[i],color:D.c[i]>=D.o[i]?'#cfcfcf':'#555'})));
  // Weis
  const c2=mk(2); const ws=c2.addHistogramSeries({priceFormat:{type:'volume'},priceLineVisible:false,lastValueVisible:false});
  ws.setData(T.map((t,i)=>({time:t,value:D.weis[i],color:D.wdir[i]>0?'#cfcfcf':'#555'})));
  // Harmonie
  const c3=mk(3); const hs=c3.addHistogramSeries({priceLineVisible:false,lastValueVisible:false,priceFormat:{type:'price',precision:2,minMove:.01},color:'#cfcfcf'});
  hs.setData(T.map((t,i)=>D.harm[i]==null?{time:t}:{time:t,value:D.harm[i],color:D.harm[i]>=0?'#d6d6d6':'#7a7a7a'}));
  hs.createPriceLine({price:0,color:'#666',lineWidth:1,lineStyle:0,axisLabelVisible:false});
  [Math.LN2,-Math.LN2].forEach(p=>hs.createPriceLine({price:p,color:'#777',lineWidth:1,lineStyle:1,axisLabelVisible:false}));
  // Wikipedia
  const c4=mk(4); let s4=null;
  if(D.wiki){const wv=s4=c4.addHistogramSeries({priceLineVisible:false,lastValueVisible:false,color:'#4a4a4a',priceFormat:{type:'volume'}});
    wv.setData(T.map((t,i)=>D.wiki.v[i]==null?{time:t}:{time:t,value:D.wiki.v[i]}));
    const ma=c4.addLineSeries({color:G.w,lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
    ma.setData(T.map((t,i)=>{const z=D.wiki.v.slice(Math.max(0,i-6),i+1).filter(v=>v!=null);return z.length<4?{time:t}:{time:t,value:z.reduce((a,b)=>a+b,0)/z.length};}));
    $('#pl4').innerHTML=`Wikipedia-Aufrufe <small>${esc(D.wiki.lang)}: ${esc(D.wiki.title)} · Balken täglich, Linie 7-Tage-Mittel</small>`;}
  else{const e=s4=c4.addLineSeries({visible:false}); e.setData(T.map(t=>({time:t}))); $('#pl4').innerHTML='Wikipedia-Aufrufe <small>kein passender Artikel gefunden</small>';}
  // Markt
  const c5=mk(5,true); let s5=null;
  if(D.mkt){const l=(col,st,w,arr)=>{const s=c5.addLineSeries({color:col,lineWidth:w,lineStyle:st,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});s.setData(T.map((t,i)=>arr[i]==null?{time:t}:{time:t,value:arr[i]}));return s;};
    s5=l(G.w,0,1.4,D.mkt.c); l('#8a8a8a',0,1,D.mkt.s50); l('#8a8a8a',2,1,D.mkt.s200);
    $('#pl5').innerHTML=`Markttrend <small>${esc(D.mkt.idx)} ${esc(D.mkt.state)} · weiß Index, grau SMA 50, grau gestrichelt SMA 200</small>`;}
  // Zeitachsen koppeln
  let lock=false;
  charts.forEach(ch=>ch.timeScale().subscribeVisibleLogicalRangeChange(r=>{if(lock||!r)return;lock=true;charts.forEach(o=>o!==ch&&o.timeScale().setVisibleLogicalRange(r));lock=false;}));
  const ser=[cs,vs,ws,hs,s4,s5];
  charts.forEach((ch,k)=>ch.subscribeCrosshairMove(p=>{charts.forEach((o,j)=>{if(o===ch)return; if(!p.time){o.clearCrosshairPosition();return;} const s=ser[j]; if(s) o.setCrosshairPosition(NaN,p.time,s);});}));
  const from=Math.max(0,(D.box.i0??0)-20); c0.timeScale().setVisibleLogicalRange({from,to:n+8});
  renderSide(D);
}
function renderSide(D){
  const P={A:'Phase A · Stopp des Abwärtstrends',B:'Phase B · Aufbau der Ursache',C:'Phase C · Spring / Test',D:'Phase D · Markup bis Konsolidierung'};
  let h=`<h3>Score</h3><div style="display:flex;align-items:center;gap:14px">${rose(D.phases,D.avg,130,{labels:true})}<div><div style="font-size:34px;font-weight:300;line-height:1">${nf(D.q)}</div>
    <div class="note">v4: ${nf(D.q4)}</div><div style="margin-top:8px">Konfidenz <span style="letter-spacing:1px">${dots(D.conf)}</span></div>${D.noSpring&&D.col>=2?'<div class="note">ohne Spring: −1 Konfidenz</div>':''}</div></div>
    <div class="note" style="margin-top:6px">Blatt größer als der gestrichelte Ring = Phase besser als der Board-Durchschnitt.</div>
    <div class="flagline">${D.funnel.true?`<span class="chip on">${funnelIcon(10).replace(G.w,'#000')} echter Trichter</span>`:''}${D.spring?`<span class="chip${D.spring.type1?'':' on'}">${D.spring.type1?'Spring Typ 1 · Retest nötig':D.spring.minor?'kleiner Spring':'Spring'}</span>`:'<span class="chip">ohne Spring</span>'}</div>`;
  h+='<h3>Bewertung je Phase</h3>';
  for(const p of 'ABCD'){const rows=D.bd[p]||[]; h+=`<div class="ph"><div class="phh"><b>${P[p]}</b><span>${D.phases[p]==null?'–':nf(D.phases[p],0)} <small class="note">Ø ${nf(D.avg[p],0)}</small></span></div>`;
    if(!rows.length) h+='<div class="note">nicht anwendbar</div>';
    rows.forEach(r=>{h+=`<div class="row"><span>${esc(r.k)}</span><span class="bar"><i style="width:${100*r.p/r.m}%"></i></span><em>${nf(r.p,1)}/${r.m}</em></div>`;}); h+='</div>';}
  if(D.spring){const s=D.spring; h+=`<h3>Spring (v5)</h3><dl class="kv"><dt>Dauer unter dem Tief</dt><dd>${s.dur} ${s.dur===1?'Kerze':'Kerzen'}</dd><dt>Weiteste Kerze</dt><dd>${nf(s.wide,2)} ATR</dd>
    <dt>Volumen/Kerzenweg (rot)</dt><dd>${nf(s.vc,2)}</dd><dt>Eindringtiefe</dt><dd>${nf(s.pen,2)} Spannenhöhen</dd><dt>Teilnoten kurz · lang · leise · flach</dt><dd>${[s.parts.kurz,s.parts.lang,s.parts.leise,s.parts.flach].map(v=>nf(v,1)).join(' · ')}</dd></dl>`;}
  if(D.funnel.score!=null) h+=`<h3>Trichter</h3><dl class="kv"><dt>Trichter-Wert</dt><dd>${nf(D.funnel.score,2)}</dd><dt>Amplituden-Trend (Spearman)</dt><dd>${nf(D.funnel.rho,2)}</dd><dt>letzte/erste Welle</dt><dd>${nf(D.funnel.lf,2)}</dd><dt>echter Trichter</dt><dd>${D.funnel.true?'ja':'nein'}</dd></dl>`;
  const pl=D.plan;
  h+=`<h3>Handelsplan</h3><div class="plan"><p>${esc(pl.entry)}</p><dl class="kv"><dt>Letzter Kurs</dt><dd>${pf(pl.last)}</dd><dt>Stopp eng (Mittellinie)</dt><dd>${pf(pl.mid)} <span class="note">${pl.risk_mid>0?'−'+nf(pl.risk_mid,1)+' %':'Kurs darunter'}</span></dd>
    <dt>Stopp klassisch (unter Spring/Tief)</dt><dd>${pf(pl.classic)} <span class="note">−${nf(pl.risk_classic,1)} %</span></dd><dt>Ziel (Creek + Spannenhöhe)</dt><dd>${pf(pl.target)}</dd></dl></div>
    <p class="note" style="margin-top:22px">Testlauf, keine Anlageberatung. Scanner v5 = v4 + Spring-, Trichter- und Stopp-Regeln; Schwellen teils vorläufig.</p>`;
  $('#side').innerHTML=h;
}
function closeDetail(){ $('#detail').hidden=true; document.body.style.overflow=''; curId=null; charts.forEach(c=>c.remove()); charts=[]; history.replaceState(null,'',location.pathname+(cur==='scatter'?'#streu':'')); }
function step(d){const k=order.indexOf(curId); const j=order[k+d]; if(j) openDetail(j);}

/* ---------- Legende ---------- */
function renderLegend(){
  const ex={A:95,B:60,C:null,D:85};
  $('#pLegend').innerHTML=`<h2>Board</h2><p>Vier Spalten, von links nach rechts reift die Struktur. Je Spalte höchstens zehn Aktien, höchster Score oben. Phase A und frühe Phase B erscheinen nicht (noch Geister).</p>
  <h2>Glyphe</h2><div class="lg"><div>${rose(ex,{A:88,B:72,C:60,D:80},110,{labels:true})}</div><div>Nightingale-Rose mit vier Blättern: A oben rechts, dann im Uhrzeigersinn B, C, D (D schließt die Konsolidierung ein). Der graue Ring ist der Durchschnitt aller Board-Aktien in der jeweiligen Phase. Ein Blatt reicht über den Ring hinaus, wenn die Phase besser als der Durchschnitt ist, und bleibt innen, wenn sie schwächer ist. Radius = Ring × (1 + 0,45 × Abstand zum Durchschnitt in Standardabweichungen des Boards), damit kleine Unterschiede sichtbar werden. Ein Punkt statt eines Blatts heißt: Phase nicht anwendbar (z. B. kein Spring, noch kein JAC). Die Zahl darunter ist der Gesamtscore (0–100).</div>
  <div>${funnelIcon(16)}</div><div>Echter Trichter: Die Wellen in der Spanne werden von Welle zu Welle kleiner, obere Kante fällt, untere steigt (nach Francis Hunt).</div>
  <div style="font-size:15px;color:#f2f2f2">SC ●●●○○</div><div>Ereignis im Chart mit Bewertung 0–5 Punkten.</div>
  <div><span style="background:#f2f2f2;color:#000;padding:1px 6px;border-radius:3px;font-weight:600">AR ●●●●●</span></div><div>Top-Ereignis (volle Punktzahl): weiß hinterlegt.</div>
  <div style="color:#f2f2f2;font-weight:600">✦ SC</div><div>Außergewöhnlich (SC, Spring oder JAC nahe am Ideal).</div></div>
  <h2>Kerzen und Linien</h2><div class="lg"><div>Kerzen</div><div>Hohl mit weißem Rand = steigend, grau gefüllt = fallend.</div>
  <div>Creek</div><div>Durchgezogen grau: Oberkante der Spanne (AR-Hoch). Dünner darunter: Spannentief (SC).</div>
  <div>Mittellinie</div><div>Gestrichelt hell: Achse der Spanne, alternativer enger Stopp.</div>
  <div>Stopp klassisch</div><div>Strich-Punkt: unter Spring bzw. Spannentief, mit 0,5 ATR Puffer.</div>
  <div>Phasenleiste</div><div>Unten im Kurschart: A, B, C (hell), D früh, D spät (mittelgrau).</div></div>
  <h2>Unterfenster</h2><p>Volumen, Weis-Wellen (Volumen je Welle kumuliert, Richtungswechsel nach 1,5 ATR Gegenbewegung), Harmonie (log(Kerzenweg/ATR ÷ Volumen/Median), ±3 begrenzt; positiv = Rutschen, negativ = Schieben; im Trend werden Gegenkerzen ausgeblendet), Wikipedia-Aufrufe (Wikimedia-API, Artikel in der Sprache des Emittenten, falls gefunden) und Markttrend (Heimatindex mit SMA 50/200). Alle teilen die Zeitachse.</p>
  <h2>Streudiagramm</h2><p>x = Fortschritt durch die Phasen (innerhalb einer Phase stetig geschätzt), y = Score v5. Rechts oben ist es am heißesten. Die Schwänze zeigen, wo die Aktie an den letzten zehn Freitagen stand (Scanner mit damals verfügbaren Daten neu gerechnet). Hohler Punkt = ohne Spring in Phase D, Ring = echter Trichter.</p>
  <h2>Daten</h2><p>Kurse bis ${dDE(B.asof)} (gemeinsamer Kursdaten-Ordner, Tagesbars). ${B.n_scanned} Strukturen bewertet, ${B.cards.length} auf dem Board. Erstellt ${dDE(B.built)}. Testlauf, keine Anlageberatung.</p><p>Charts: <a href="https://www.tradingview.com/lightweight-charts/" style="color:#bdbdbd">TradingView Lightweight Charts</a> (Apache 2.0).</p>`;
}

/* ---------- Navigation ---------- */
let cur='board';
function show(p){cur=p; ['Board','Scatter','Legend'].forEach(k=>{$('#p'+k).hidden=k.toLowerCase()!==p; const t=$('#tab'+k); t.classList.toggle('on',k.toLowerCase()===p); t.setAttribute('aria-selected',k.toLowerCase()===p);});
  if(p==='scatter') renderScatter(); if(p==='board') renderBoard(); if(p==='legend') renderLegend();
  if(!curId) history.replaceState(null,'',location.pathname+(p==='scatter'?'#streu':p==='legend'?'#legende':''));}
async function init(){
  B=await (await fetch('data/board.json')).json();
  for(const p of 'ABCD'){const v=B.cards.map(c=>c.ph[p]).filter(x=>x!=null), m=v.reduce((a,b)=>a+b,0)/v.length; SD[p]=Math.max(3,Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length));}
  order=[...B.cards].sort((a,b)=>a.col-b.col||b.q-a.q).map(c=>c.id);
  $('#sub').textContent=`Wyckoff-Akkumulationen · Scanner v5 · Testlauf · Daten bis ${dDE(B.asof)}`;
  $('#tabBoard').onclick=()=>show('board'); $('#tabScatter').onclick=()=>show('scatter'); $('#tabLegend').onclick=()=>show('legend');
  $('#tailToggle').onchange=renderScatter; $('#tipToggle').onchange=e=>{tips=e.target.checked; tip();};
  $('#dBack').onclick=closeDetail; $('#dPrev').onclick=()=>step(-1); $('#dNext').onclick=()=>step(1);
  addEventListener('keydown',e=>{if($('#detail').hidden)return; if(e.key==='Escape')closeDetail(); if(e.key==='ArrowRight')step(1); if(e.key==='ArrowLeft')step(-1);});
  let rt; addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{if(cur==='board')$$('.card').forEach(b=>mini(b.querySelector('canvas'),B.cards.find(c=>c.id===b.dataset.id).m));},150);});
  const h=decodeURIComponent(location.hash.slice(1));
  show(h==='streu'?'scatter':h==='legende'?'legend':'board');
  if(h.startsWith('s=')&&B.cards.some(c=>c.id===h.slice(2))) openDetail(h.slice(2));
}
init();
