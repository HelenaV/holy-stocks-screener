'use strict';
/* Holy Stocks Screener · Testlauf · Graustufen-Visualisierung (keine Farbcodierung) */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const nf=(v,d=1)=>v==null?'–':v.toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d});
const pf=p=>p==null?'–':(Math.abs(p)>=1000?p.toLocaleString('de-DE',{maximumFractionDigits:0}):p.toLocaleString('de-DE',{maximumSignificantDigits:4}));
const dDE=s=>{const[y,m,d]=s.split('-');return `${d}.${m}.${y}`;};
const G={w:'#f2f2f2',l:'#d0d0d0',m:'#9a9a9a',d:'#6a6a6a',x:'#3a3a3a',bg:'#0a0a0a'};
const COLDESC=['Spanne steht, Tests an beiden Rändern, noch kein Spring.','Spring oder Test am unteren Rand, Kurs noch unter der Mittellinie.','Nach dem Spring auf dem Weg zum Creek, bis JAC/Ausbruch.','Ab BUEC/Backup: Fortsetzung nach oben oder seitwärts über dem Creek.'];
let B=null, order=[], tips=false, RULES={}, EXPL={};

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
    const cards=B.cards.filter(c=>c.col===ci).sort((a,b)=>(a.ns-b.ns)||b.q-a.q); // R-C-12
    const col=document.createElement('section'); col.className='col';
    col.innerHTML=`<div class="colh"><div class="n">0${ci+1}</div><h2>${name}<small>${cards.length}</small></h2><p>${COLDESC[ci]}</p><div class="prog"><i style="left:${ci*25}%;width:25%"></i></div></div>`;
    cards.forEach((c,k)=>{
      const b=document.createElement('button'); b.className='card'; b.dataset.id=c.id;
      const fx=[]; if(c.ft) fx.push(`<span>${funnelIcon()} Trichter</span>`); if(c.sk) fx.push(`<span>${esc(c.sk)}</span>`);
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
const CFGDE={breakout_without_ut_or_spring:'Ausbruch ohne UT oder Spring',erratic_range:'erratische Spanne',jac_too_high:'JAC zu hoch',new_climax:'neuer Climax',no_prior_decline:'kein Abwärtstrend davor',phase_b_too_short:'Phase B zu kurz',phase_e_too_late:'zu spät (Phase E)',range_not_respected:'Spanne nicht eingehalten',sc_above_older_low:'SC über älterem Tief',sc_stepping_base:'gestufte Tiefs vor dem SC',top_near_prior_high:'Oberkante nah am Vorhoch',ut_too_high:'UT zu hoch'};
function deTxt(s){return String(s??'').replace(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g,w=>CFGDE[w]||w);}
function mini(cv,m){
  const dpr=window.devicePixelRatio||1, W=cv.clientWidth, H=cv.clientHeight; cv.width=W*dpr; cv.height=H*dpr;
  const ctx=cv.getContext('2d'); ctx.scale(dpr,dpr);
  const c=m.c.filter(v=>v!=null), lo=Math.min(...c,m.lo), hi=Math.max(...c,m.hi), n=m.c.length;
  const X=i=>i/(n-1)*(W-2)+1, Y=v=>H-3-(v-lo)/(hi-lo||1)*(H-6);
  if(!m.nobox){ctx.fillStyle='rgba(255,255,255,.07)'; ctx.fillRect(X(m.b0),Y(m.hi),X(m.b1)-X(m.b0),Y(m.lo)-Y(m.hi));
  ctx.strokeStyle=G.d; ctx.lineWidth=1; ctx.setLineDash([2,2]); ctx.beginPath(); ctx.moveTo(X(m.b0),Y(m.hi)+.5); ctx.lineTo(W,Y(m.hi)+.5); ctx.stroke(); ctx.setLineDash([]);}
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
    G2.push(`<g class="pt" data-id="${c.id}"><circle cx="${x}" cy="${y}" r="9" fill="transparent"/>${c.ft?`<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="${G.m}" stroke-width="1"/>`:''}<circle class="dot" cx="${x}" cy="${y}" r="4.6" fill="${G.w}" stroke="${G.w}" stroke-width="1.4"/></g>`);
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
    const bx=D.box, xa=bx?X(bx.i0):null, xb=bx?X(bx.i1):null;
    if(bg){
      if(xa!=null&&xb!=null){const yh=Y(bx.hi), yl=Y(bx.lo); ctx.fillStyle='rgba(255,255,255,.035)'; ctx.fillRect(xa-bs,yh,xb-xa+2*bs,yl-yh);}
      // (2026-11-02 11:11, Evelyn) no phase lines/letters in the price panel - only the phase bar at the bottom
      return;
    }
    // Phasenleiste unten
    const yb=H-14; let lastLx=null, lastLy=0;
    // R-S-15 (Evelyn 2026-11-02 11:11): adjacent phases alternate dark / light gray, small gap between segments
    D.spans.forEach((sp,k)=>{const x0=X(sp.i0), x1=X(sp.i1); if(x0==null||x1==null)return;
      ctx.fillStyle=k%2?'#c8c8c8':'#5a5a5a'; ctx.fillRect(x0-bs+2,yb-1,Math.max(2,x1-x0+2*bs-4),5);
      const lab={A:'A',B:'B',C:'C',D:'D früh','D+':'D spät'}[sp.ph]; if(x1-x0>14) txt(lab,(x0+x1)/2,yb-4,G.l,'center',600,10.5);
    });
    if(xa!=null){
      // R-S-15 (Evelyn 2026-11-02 11:14): creek and range low = identical calm solid lines to the right edge; midline darker,
      // dashed; no classic-stop line; no text labels on range lines
      line(xa-bs,W,Y(D.creek),G.m,[],1); line(xa-bs,W,Y(bx.lo),G.m,[],1);
      line(xa-bs,W,Y(D.mid),'#4a4a4a',[5,4],1);
    }
    if(D.fl&&D.fl.true){const a=X(D.fl.i0), b=X(D.fl.i1); if(a!=null&&b!=null){ctx.strokeStyle=G.w;ctx.lineWidth=1.3;
      ctx.beginPath();ctx.moveTo(a,Y(D.fl.hi[0]));ctx.lineTo(b,Y(D.fl.hi[1]));ctx.moveTo(a,Y(D.fl.lo[0]));ctx.lineTo(b,Y(D.fl.lo[1]));ctx.stroke();
      txt('Trichter',b+4,Y((D.fl.hi[1]+D.fl.lo[1])/2)+4,G.w,'left',600,10.5);}}
    // Ereignisse mit Bewertung - R-S-15: labels in a lane at the top (highs) / bottom (lows) of the panel, thin leader line
    const placed=[]; const hit=(a)=>placed.some(b=>a.x0<b.x1+4&&a.x1>b.x0-4&&a.y0<b.y1+2&&a.y1>b.y0-2);
    const evs=[...D.ev].sort((a,b)=>a.i-b.i);
    for(const e of evs){const x=X(e.i); if(x==null)continue; const y=Y(e.p); if(y==null)continue;
      ctx.font='600 11px Inter,Helvetica Neue,system-ui,sans-serif';
      const name=(e.fire?'✦ ':'')+e.k, dt=dots(e.r); const wN=ctx.measureText(name).width; ctx.font='8.5px system-ui,sans-serif'; const wD=dt?ctx.measureText(dt).width+5:0;
      const w=wN+wD+10; let lv=0, box, yl;
      for(;lv<4;lv++){yl=e.lo?H-46-lv*20:44+lv*20; box={x0:x-w/2,x1:x+w/2,y0:yl-8,y1:yl+8}; if(!hit(box))break;}
      placed.push(box);
      ctx.strokeStyle=G.d; ctx.lineWidth=1; ctx.setLineDash([1,2]); ctx.beginPath(); ctx.moveTo(Math.round(x)+.5,e.lo?y+3:y-3); ctx.lineTo(Math.round(x)+.5,e.lo?yl+8:yl-8+16); ctx.stroke(); ctx.setLineDash([]);
      const bx0=x-w/2, by0=yl-8;
      if(e.top){ctx.fillStyle=G.w; rr(ctx,bx0,by0,w,16,3); ctx.fill();}
      else{ctx.fillStyle='rgba(10,10,10,.92)'; rr(ctx,bx0,by0,w,16,3); ctx.fill(); ctx.strokeStyle=e.r==null?G.x:G.d; ctx.stroke();}
      txt(name,bx0+5,yl+4,e.top?'#000':(e.r==null?G.m:G.w),'left',600,11);
      if(dt) txt(dt,bx0+5+wN+5,yl+3.5,e.top?'#000':G.l,'left',400,8.5);
    }
  });}
}
function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function vMedian(v,a,b){const s=[]; for(let i=a;i<=b;i++) if(v[i]!=null&&isFinite(v[i])) s.push(v[i]); if(!s.length) return 0; s.sort((x,y)=>x-y); const m=s.length>>1; return s.length%2?s[m]:(s[m-1]+s[m])/2;}
// OLS of volume on bar index, inputs clipped at 4× median so one spike does not tilt the fit
function vTrend(D){const A=(D.spans||[]).find(s=>s.ph==='A'), B=(D.spans||[]).find(s=>s.ph==='B'); if(!A||!B||!(B.i1>A.i0)||A.i0<0||B.i1>=D.v.length) return null;
  const md=vMedian(D.v,A.i0,B.i1); if(!(md>0)) return null; const clip=4*md; let n=0,sx=0,sy=0,sxx=0,sxy=0;
  for(let i=A.i0;i<=B.i1;i++){const y=Math.min(D.v[i],clip); n++; sx+=i; sy+=y; sxx+=i*i; sxy+=i*y;}
  const den=n*sxx-sx*sx; if(!den) return null; const sl=(n*sxy-sx*sy)/den, ic=(sy-sl*sx)/n; return {i0:A.i0,i1:B.i1,y0:ic+sl*A.i0,y1:ic+sl*B.i1};}
function vMult(x){const r=Math.round(x*10)/10; return (r>=10||Math.abs(r-Math.round(r))<1e-6?String(Math.round(r)):r.toFixed(1).replace('.',','))+'×';}
// tips + true multiple above volume bars cut at the visible cap (Evelyn 2026-11-03)
class VolCap{
  constructor(D){this.D=D; this.cap=Infinity; this.med=0;}
  attached(p){this.chart=p.chart; this.series=p.series;}
  detached(){} updateAllViews(){}
  paneViews(){const s=this; return [{zOrder:()=>'top',renderer:()=>({draw:t=>s.draw(t)})}];}
  draw(target){const cap=this.cap, med=this.med; if(!(med>0)||!isFinite(cap)) return;
    target.useMediaCoordinateSpace(({context:ctx})=>{
      const y=this.series.priceToCoordinate(cap); if(y==null) return;
      const ts=this.chart.timeScale(), D=this.D, bs=ts.options().barSpacing||6;
      const bw=Math.max(1,Math.round(bs)-(Math.ceil(bs)<=1?0:1)), yT=y-5;
      ctx.save(); ctx.textAlign='center'; ctx.textBaseline='bottom'; ctx.font='9px Inter,Helvetica Neue,system-ui,sans-serif';
      for(let i=0;i<D.t.length;i++){const v=D.v[i]; if(!(v>cap)) continue; const x=ts.timeToCoordinate(D.t[i]); if(x==null) continue;
        ctx.fillStyle=D.c[i]>=D.o[i]?'#cfcfcf':'#555'; ctx.beginPath(); ctx.moveTo(x-bw/2,y+1); ctx.lineTo(x+bw/2,y+1); ctx.lineTo(x,yT); ctx.closePath(); ctx.fill();
        ctx.fillStyle='#8a8a8a'; ctx.fillText(vMult(v/med),x,yT-1);}
      ctx.restore();
    });}
}

function baseOpts(dateLabel){return{autoSize:true,layout:{attributionLogo:false,background:{type:'solid',color:G.bg},textColor:G.m,fontSize:11,fontFamily:'Inter,Helvetica Neue,system-ui,sans-serif'},
  grid:{vertLines:{visible:false},horzLines:{color:'#151515'}},rightPriceScale:{borderColor:'#222',minimumWidth:78},
  timeScale:{visible:true,borderColor:'#222',rightOffset:8,timeVisible:false},crosshair:{mode:0,vertLine:{color:'#555',style:2,labelVisible:!!dateLabel,labelBackgroundColor:'#333'},horzLine:{color:'#555',style:2,labelBackgroundColor:'#333'}},
  localization:{locale:'de-DE',dateFormat:'dd.MM.yyyy'},handleScale:{axisPressedMouseMove:{time:true,price:true}}};}

// R-S-12: judged charts (tests/cases) that are not on the board: detail page only (#s=<id>, linked in the legend)
function cardOf(id){return B.cards.find(z=>z.id===id)||(B.review||[]).find(z=>z.id===id)||(B.tests||[]).find(z=>z.id===id&&z.f)||(B.custom||[]).find(z=>z.id===id&&z.f);}
const isTest=id=>/^[tc]:/.test(String(id)), isCustom=id=>String(id).startsWith('c:');
async function openDetail(id){
  curId=id; location.hash='s='+encodeURIComponent(id); $('#detail').hidden=false; document.body.style.overflow='hidden';
  const c=cardOf(id);
  const D=await (await fetch('data/s/'+c.f)).json(); if(curId!==id)return;
  charts.forEach(ch=>ch.remove()); charts=[];
  $('#dSym').textContent=D.sym; $('#dName').textContent=D.name;
  $('#dMeta').innerHTML=`${D.reference?'<span>Prüfstand '+dDE(D.reference.date)+'</span>':''}<span>${isTest(id)?(isCustom(id)?'Custom · '+esc(CGRP[(D.cst||{}).gruppe]||deTxt((D.cst||{}).gruppe)||'')+' · ':'Test-Stock · ')+esc(D.colName)+(c.rej?' · '+esc(deTxt(c.rej)):''):D.colName+(B.cards.some(z=>z.id===id)?'':(c.rej?' · nicht auf dem Board – '+esc(deTxt(c.rej)):' · nicht auf dem Board (beurteilter Fall)'))}</span><span>Daten bis ${dDE(D.asof)}</span><span class="big">${nf(D.q)}</span>`;
  const LW=window.LightweightCharts, T=D.t, n=T.length;
  const mk=(k,dateLabel=false,extra={})=>{const ch=LW.createChart($('#c'+k),Object.assign(baseOpts(dateLabel),extra)); charts.push(ch); return ch;};
  // Kurs
  const c0=mk(0,true,{rightPriceScale:{borderColor:'#222',minimumWidth:78,scaleMargins:{top:.16,bottom:.22}}});
  const cs=c0.addCandlestickSeries({upColor:G.bg,borderUpColor:G.w,wickUpColor:G.w,downColor:'#8a8a8a',borderDownColor:'#8a8a8a',wickDownColor:'#8a8a8a',priceLineVisible:false,lastValueVisible:true,
    priceFormat:{type:'custom',formatter:pf,minMove:0.0001}});
  cs.setData(T.map((t,i)=>({time:t,open:D.o[i],high:D.h[i],low:D.l[i],close:D.c[i]})));
  cs.attachPrimitive(new WyOverlay(D));
  // Custom trade lines (Evelyn 2026-11-02): entry solid, stop dashed, target dotted; gray, no labels, like the range lines; nothing when empty
  {const P=D.cst||{}; [[P.entry_price,0],[P.stop,2],[P.target,1]].forEach(([p,ls])=>{if(p!=null&&isFinite(p)) cs.createPriceLine({price:+p,color:G.m,lineWidth:1,lineStyle:ls,axisLabelVisible:false,title:''});});}
  {const md=D.verdict?D.verdict.date:(D.cst&&D.cst.added?D.cst.added:null); if(md){const k=T.findIndex(t=>t>md); const tt=k<0?T[n-1]:T[k];
    cs.setMarkers([{time:tt,position:'aboveBar',color:G.w,shape:'arrowDown',text:(D.verdict?'Urteil ':'hinzugefügt ')+dDE(md).slice(0,6)}]);}}
  $('#pl0').innerHTML=`Kurs <b id="hov" class="hov"></b><small>hohl = steigend · grau gefüllt = fallend · Ereignisse mit Bewertung ●○ (0–5), weiß hinterlegt = Top, ✦ = außergewöhnlich</small>`;
  // Volumen (Evelyn 2026-11-03): axis capped at 4× median of the visible bars; cut bars get a tip and the true multiple. Trend is the OLS line from the start of phase A to the end of phase B.
  const c1=mk(1,false,{rightPriceScale:{borderColor:'#222',minimumWidth:78,scaleMargins:{top:.18,bottom:.1}}});
  const vs=c1.addHistogramSeries({priceFormat:{type:'volume'},priceLineVisible:false,lastValueVisible:false});
  const vOv=new VolCap(D); vs.attachPrimitive(vOv);
  const vFit=vTrend(D);
  const vt=vFit&&c1.addLineSeries({color:'#e6e6e6',lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
  // seed the time scale (capped on all bars); vApply recaps to the visible window before paint
  {const md=vMedian(D.v,0,n-1), cap=md>0?4*md:Infinity; vOv.med=md; vOv.cap=cap;
    vs.setData(T.map((t,i)=>({time:t,value:Math.min(D.v[i],cap),color:D.c[i]>=D.o[i]?'#cfcfcf':'#555'})));
    if(vt) vt.setData([{time:T[vFit.i0],value:Math.max(0,Math.min(vFit.y0,cap))},{time:T[vFit.i1],value:Math.max(0,Math.min(vFit.y1,cap))}]);}
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
  else{const e=s4=c4.addLineSeries({visible:false,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false}); e.setData(T.map(t=>({time:t,value:0}))); $('#pl4').innerHTML='Wikipedia-Aufrufe <small>kein passender Artikel gefunden</small>';}
  // Markt
  const c5=mk(5); let s5=null;
  if(D.mkt){const l=(col,st,w,arr)=>{const s=c5.addLineSeries({color:col,lineWidth:w,lineStyle:st,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});s.setData(T.map((t,i)=>arr[i]==null?{time:t}:{time:t,value:arr[i]}));return s;};
    s5=l(G.w,0,1.4,D.mkt.c); l('#8a8a8a',0,1,D.mkt.s50); l('#8a8a8a',2,1,D.mkt.s200);
    $('#pl5').innerHTML=`Markttrend <small>${esc(D.mkt.idx)} ${esc(D.mkt.state)} · weiß Index, grau SMA 50, grau gestrichelt SMA 200</small>`;}
  else{const e=s5=c5.addLineSeries({visible:false,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false}); e.setData(T.map(t=>({time:t,value:0}))); $('#pl5').innerHTML='Markttrend <small>nicht geladen</small>';}
  // Zeitachsen koppeln
  let lock=false, vKey='', vRaf=0;
  const vApply=()=>{
    if(curId!==id||!charts.includes(c1)) return;
    const r=c1.timeScale().getVisibleLogicalRange();
    if(!r){ if(!vRaf) vRaf=requestAnimationFrame(()=>{vRaf=0; vApply();}); return; }
    if(vRaf){ cancelAnimationFrame(vRaf); vRaf=0; }
    const a=Math.max(0,Math.ceil(r.from-.5)), b=Math.min(n-1,Math.floor(r.to+.5)); if(b<a) return;
    const key=a+':'+b; if(key===vKey) return;
    const md=vMedian(D.v,a,b), cap=md>0?4*md:Infinity; vOv.med=md; vOv.cap=cap;
    const keep={from:r.from,to:r.to};
    lock=true;
    vs.setData(T.map((t,i)=>({time:t,value:Math.min(D.v[i],cap),color:D.c[i]>=D.o[i]?'#cfcfcf':'#555'})));
    if(vt) vt.setData([{time:T[vFit.i0],value:Math.max(0,Math.min(vFit.y0,cap))},{time:T[vFit.i1],value:Math.max(0,Math.min(vFit.y1,cap))}]);
    const now=c1.timeScale().getVisibleLogicalRange();
    if(now&&(Math.abs(now.from-keep.from)>1e-4||Math.abs(now.to-keep.to)>1e-4)) c1.timeScale().setVisibleLogicalRange(keep);
    lock=false; vKey=key;};
  charts.forEach(ch=>ch.timeScale().subscribeVisibleLogicalRangeChange(r=>{if(lock||!r)return;lock=true;charts.forEach(o=>o!==ch&&o.timeScale().setVisibleLogicalRange(r));lock=false;}));
  c1.timeScale().subscribeVisibleLogicalRangeChange(()=>{if(vRaf) return; vRaf=requestAnimationFrame(()=>{vRaf=0; vApply();});});
  const ser=[cs,vs,ws,hs,s4,s5];
  // R-S-06: date of the hovered candle in the price header (always, also with tooltips off)
  const ix=new Map(T.map((t,i)=>[t,i])), hov=$('#hov');
  const showHov=t=>{const i=t==null?n-1:ix.get(typeof t==='string'?t:`${t.year}-${String(t.month).padStart(2,'0')}-${String(t.day).padStart(2,'0')}`);
    if(i==null){hov.textContent='';return;} hov.textContent=`${dDE(T[i])} · E ${pf(D.o[i])} H ${pf(D.h[i])} T ${pf(D.l[i])} S ${pf(D.c[i])} · Vol ${D.v[i].toLocaleString('de-DE')}`;};
  showHov(null);
  charts.forEach((ch,k)=>ch.subscribeCrosshairMove(p=>{showHov(p.time??null); charts.forEach((o,j)=>{if(o===ch)return; if(!p.time){o.clearCrosshairPosition();return;} const s=ser[j]; if(s) o.setCrosshairPosition(NaN,p.time,s);});}));
  // R-S-05: start the view at the prior high or ~120 bars before the PS (whichever is shorter)
  const from=Math.max(0,D.view0??((D.box.i0??0)-20)); lock=true; charts.forEach(ch=>ch.timeScale().setVisibleLogicalRange({from,to:n+8})); lock=false;
  vApply();
  renderSide(D); infoize();
}
function customH(C){if(!C)return'';
  return `<h3>Custom</h3><dl class="kv"><dt>Gruppe</dt><dd>${esc(CGRP[C.gruppe]||deTxt(C.gruppe))}</dd>${['entry_date','entry_price','stop','target','exit_date','exit_price','result_r'].filter(k=>C[k]!=null).map(k=>`<dt>${({entry_date:'Einstieg am',entry_price:'Einstieg',stop:'Stopp',target:'Ziel',exit_date:'Ausstieg am',exit_price:'Ausstieg',result_r:'Ergebnis (R)'})[k]}</dt><dd>${/date/.test(k)?dDE(C[k]):k==='result_r'?nf(C[k],2):pf(C[k])}</dd>`).join('')}<dt>Hinzugefügt</dt><dd>${C.added?dDE(C.added):'–'}</dd>
    <dt>Scanner heute (v5)</dt><dd>${esc(deTxt(C.scanner_now)||'–')}</dd><dt>Kurs seit hinzugefügt</dt><dd>${C.pct==null?'–':(C.pct>0?'+':'')+nf(C.pct,1)+' %'} <span class="note">${pf(C.base)} (${C.base_date?dDE(C.base_date):''}) → ${pf(C.last)}</span></dd>
    <dt>Hoch / Tief seither</dt><dd>${pf(C.hi)} / ${pf(C.lo)}</dd></dl>${C.notiz?`<p class="note">${esc(C.notiz)}</p>`:''}`;}
function verdictH(V){if(!V)return'';
  return `<h3>Urteil</h3><dl class="kv"><dt>Evelyn</dt><dd>${esc(V.evelyn)}</dd><dt>Datum</dt><dd>${dDE(V.date)}${V.last_date&&V.last_date!==V.date?' (zuletzt '+dDE(V.last_date)+')':''}</dd>
    <dt>Scanner damals</dt><dd>${esc(deTxt(V.scanner_then))}</dd><dt>Scanner heute (v5)</dt><dd>${esc(deTxt(V.scanner_now)||'–')}</dd>
    <dt>Kurs seit Urteil</dt><dd>${V.pct==null?'–':(V.pct>0?'+':'')+nf(V.pct,1)+' %'} <span class="note">${pf(V.base)} (${dDE(V.base_date)}) → ${pf(V.last)}</span></dd>
    <dt>Hoch / Tief seither</dt><dd>${pf(V.hi)} / ${pf(V.lo)}</dd></dl><p class="note">${esc(V.reason)}</p>`;}
// Ein Prüfstand erklärt ausdrücklich, welche historischen Kurse angezeigt werden.
function referenceH(reference){
  if(!reference)return '';
  return `<h3>Prüfstand ${dDE(reference.date)}</h3><p>${esc(reference.note)}</p><p><b>Gespeichertes Urteil:</b> ${esc(reference.verdict)}</p>${(reference.history||[]).map(judgment=>`<details><summary>Früheres Urteil ${dDE(judgment.date)} (revidiert)</summary><p>${esc(judgment.verdict)}</p></details>`).join('')}`;
}
function overview(o){if(!o||!o.c||o.c.length<2)return'';
  const W=300,H=74,n=o.c.length,v=o.c.filter(x=>x!=null),lo=Math.min(...v),hi=Math.max(...v),X=i=>2+i/(n-1)*(W-4),Y=p=>H-4-(p-lo)/(hi-lo||1)*(H-8);
  let p='';o.c.forEach((c,i)=>{if(c!=null)p+=(p?'L':'M')+X(i).toFixed(1)+','+Y(c).toFixed(1);});
  const r=o.b0!=null?`<rect x="${X(o.b0).toFixed(1)}" y="${Y(o.hi).toFixed(1)}" width="${Math.max(2,X(o.b1)-X(o.b0)).toFixed(1)}" height="${Math.max(2,Y(o.lo)-Y(o.hi)).toFixed(1)}" fill="rgba(255,255,255,.12)" stroke="${G.w}" stroke-width="1"/>`:'';
  return `<h3>Überblick 3 Jahre</h3><svg class="ov" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="none" aria-hidden="true"><path d="${p}" fill="none" stroke="${G.m}" stroke-width="1.1"/>${r}</svg>
    <div class="note" style="display:flex;justify-content:space-between"><span>${dDE(o.t0)}</span><span>${o.b0!=null?'Kasten = Akkumulation':''}</span><span>${dDE(o.t1)}</span></div>`;}
// panel subtitles behind a small info icon (click/tap toggles, hover on desktop)
function infoize(){$$('.plab').forEach(pl=>{const sm=pl.querySelector(':scope > small'); if(!sm)return;
  const b=document.createElement('button'); b.className='pi'; b.type='button'; b.setAttribute('aria-label','Erklärung'); b.textContent='ⓘ';
  sm.classList.add('pt'); sm.remove(); b.appendChild(sm); pl.appendChild(b);
  b.onclick=e=>{e.stopPropagation(); const o=b.classList.toggle('open'); $$('.plab .pi.open').forEach(x=>{if(x!==b)x.classList.remove('open');});};});}
document.addEventListener('click',()=>$$('.plab .pi.open').forEach(x=>x.classList.remove('open')));
function renderSide(D){
  if(!D.box){$('#side').innerHTML=referenceH(D.reference)+overview(D.ov)+verdictH(D.verdict)+customH(D.cst)+`<p class="note" style="margin:10px 0">Keine Zeichnung: ${esc(deTxt(D.status))}</p>`;return;}
  const P={A:'Phase A · Stopp des Abwärtstrends',B:'Phase B · Aufbau der Ursache',C:'Phase C · Spring / Test',D:'Phase D · Markup bis Konsolidierung'};
  let h=referenceH(D.reference)+overview(D.ov)+verdictH(D.verdict)+customH(D.cst)+(D.box?'':`<p class="note" style="margin:10px 0">Keine Zeichnung: ${esc(deTxt(D.status))}</p>`)+`<h3>Score</h3><div style="display:flex;align-items:center;gap:14px">${rose(D.phases,D.avg,130,{labels:true})}<div><div style="font-size:34px;font-weight:300;line-height:1">${nf(D.q)}</div>
    <div style="margin-top:8px">Konfidenz <span style="letter-spacing:1px">${dots(D.conf)}</span></div></div></div>
    <div class="note" style="margin-top:6px">Blatt größer als der gestrichelte Ring = Phase besser als der Board-Durchschnitt.</div>
    <div class="flagline">${D.funnel.true?`<span class="chip on">${funnelIcon(10).replace(G.w,'#000')} echter Trichter</span>`:''}${D.spring?`<span class="chip">${esc(D.spring.status==='shakeout'?'Shakeout':D.spring.kind)}${D.spring.ok&&!D.spring.conf?'?':''}${D.spring.status==='shakeout'?' · Pflicht-Test fehlt oder ungültig':''}</span>`:(D.box?'<span class="chip">kein Spring · Abzug</span>':'')}</div>`;
  const rowH=(r,key)=>{
    const ex=Array.isArray(EXPL[r.k])?EXPL[r.k]:null;
    const ru=(r.id&&RULES[r.id])||(ex&&ex[2]&&RULES[ex[2]])||null;
    const s1=ex&&ex[0]!=null?String(ex[0]):'', s2=ex&&ex[1]!=null?String(ex[1]):'';
    const show=!!(ex||ru), title=s1&&s2?s1+' '+s2:(s1||s2);
    const btn=show?` <button class="info" data-r="${esc(key)}"${title?` title="${esc(title)}"`:''} aria-label="Erklärung">ⓘ</button>`:'';
    let info='';
    if(show){
      let b='';
      if(s1) b+=`<p class="ri1">${esc(s1)}</p>`;
      if(s2) b+=`<p class="ri2">${esc(s2)}</p>`;
      if(ru) b+=`<p class="rid">Genauer: ${esc(ru.d).replace(/\n/g,'<br>')}</p><div class="rmeta">${esc(ru.m)}</div>`;
      info=`<div class="rinfo" data-for="${esc(key)}" hidden>${b}</div>`;
    }
    return `<div class="row"><span>${esc(r.k)}${btn}</span><span class="bar"><i style="width:${100*r.p/r.m}%"></i></span><em>${nf(r.p,1)}/${r.m}</em></div>`
      +(r.n?`<div class="rnote">${esc(r.n)}</div>`:'')+info;
  };
  const sec=(p,title,sub)=>{const rows=D.bd[p]||[]; let x=`<div class="ph"><div class="phh"><b>${title}</b><span>${D.phases[p]==null?'–':nf(D.phases[p],0)} <small class="note">Ø ${nf(D.avg[p],0)}</small></span></div>`;
    if(sub) x+=`<div class="note" style="margin-bottom:4px">${sub}</div>`;
    if(!rows.length) x+='<div class="note">nicht anwendbar</div>'; rows.forEach((r,i)=>{x+=rowH(r,p+'-'+i);}); return x+'</div>';};
  h+='<h3>Gesamt-Akkumulation</h3>'+sec('G','Phasenübergreifend','gilt für die ganze Akkumulation, nicht Teil der Rose');
  h+='<h3>Bewertung je Phase</h3>';
  for(const p of 'ABCD') h+=sec(p,P[p]);
  if(D.spring){
    const s=D.spring;
    const description=s.explanation||s.kind;
    h+=`<h3>Spring / Shakeout</h3><p>${esc(description)}</p><dl class="kv">
      <dt>Deutung</dt><dd>${esc(s.status==='shakeout'?'Shakeout (Typ-1-Kandidat ohne gültigen Test)':s.kind)}${s.ok&&!s.conf?' (möglich, noch kein JAC)':''}</dd>
      <dt>Spring-Punkteanteil</dt><dd>${nf(100*s.q,0)} %</dd>
      <dt>Volumen der Event-Kerzen</dt><dd>${nf(s.vr,2)} × ${s.status?'vorheriger Durchschnitt':'Median (gespeicherter Stand)'}</dd>
      <dt>Stich unter die Spanne</dt><dd>${nf(s.da,2)} ATR · ${nf(100*s.pen,1)} % der Range-Höhe</dd>
      <dt>Test</dt><dd>${s.nt?(s.ht?'Pflicht-Test gültig':'Pflicht-Test fehlt oder ungültig'):s.ok?'kein Pflicht-Test':'Typ noch ungeklärt'}</dd>
      <dt>Test-/Spring-Volumen</dt><dd>${s.testVolumeRatio==null?'–':nf(100*s.testVolumeRatio,0)+' %'}</dd>
      <dt>Dauer des Ausflugs</dt><dd>${s.dur} ${s.dur===1?'Kerze':'Kerzen'}</dd></dl>`;
    if(s.provisional) h+='<p class="note">Messgrenzen und Punktegewichte sind vorläufige Arbeitswerte.</p>';
  }
  if(D.funnel.score!=null) h+=`<h3>Trichter</h3><dl class="kv"><dt>Trichter-Wert</dt><dd>${nf(D.funnel.score,2)}</dd><dt>Amplituden-Trend (Spearman)</dt><dd>${nf(D.funnel.rho,2)}</dd><dt>letzte/erste Welle</dt><dd>${nf(D.funnel.lf,2)}</dd><dt>echter Trichter</dt><dd>${D.funnel.true?'ja':'nein'}</dd></dl>`;
  const pl=D.plan;
  if(pl) h+=`<h3>Handelsplan</h3><div class="plan"><p>${esc(pl.entry)}</p><dl class="kv"><dt>Letzter Kurs</dt><dd>${pf(pl.last)}</dd><dt>Stopp eng (Mittellinie)</dt><dd>${pf(pl.mid)} <span class="note">${pl.risk_mid>0?'−'+nf(pl.risk_mid,1)+' %':'Kurs darunter'}</span></dd>
    <dt>Stopp klassisch (unter Spring/Tief)</dt><dd>${pf(pl.classic)} <span class="note">−${nf(pl.risk_classic,1)} %</span></dd><dt>Ziel (Creek + Spannenhöhe)</dt><dd>${pf(pl.target)}</dd></dl></div>
    <p class="note" style="margin-top:22px">Testlauf, keine Anlageberatung. Scanner v5 = v4 + Spring-, Trichter- und Stopp-Regeln; Schwellen teils vorläufig.</p>`;
  $('#side').innerHTML=h;
  $$('#side .info').forEach(b=>b.onclick=e=>{e.stopPropagation(); const d=b.closest('.row').parentNode.querySelector(`.rinfo[data-for="${CSS.escape(b.dataset.r)}"]`); if(d) d.hidden=!d.hidden;});
}
function closeDetail(){ $('#detail').hidden=true; document.body.style.overflow=''; curId=null; charts.forEach(c=>c.remove()); charts=[]; history.replaceState(null,'',location.pathname+(cur==='scatter'?'#streu':cur==='tests'?'#tests':cur==='custom'?'#custom':'')); }
function step(d){const o=isCustom(curId)?(B.custom||[]).filter(c=>c.f).map(c=>c.id):isTest(curId)?(B.tests||[]).filter(c=>c.f).map(c=>c.id):order; const k=o.indexOf(curId); const j=o[k+d]; if(j) openDetail(j);}

/* ---------- Legende ---------- */
const CCOLS=['Watch','Positionen','Postmortem Fail','Postmortem Success'], CGRP={watch:'Watch',position:'Position',pm_fail:'Postmortem',pm_success:'Postmortem'};
const CDESC=['Aktien, die du beobachtest.','Offene Positionen: Einstieg, Stopp, Ziel als graue Linien im Chart.','Verkauft mit Ergebnis ≤ 0 R (Breakeven zählt als Fail).','Verkauft mit Ergebnis > 0 R.'];
// Custom board (Evelyn 2026-11-02): 4 columns like the main board, same scanner (v5), same detail view
function renderCustom(){
  const C=B.custom||[], el=$('#pCustom'); el.innerHTML='';
  if(!C.length){el.innerHTML=`<p style="margin:18px 6px">Noch leer. Sag Holy Stocks im Chat, welche Ticker hier rein sollen.</p>`;return;}
  CCOLS.forEach((name,ci)=>{
    const L=C.filter(c=>(c.cc??0)===ci).sort((a,b)=>(a.q==null)-(b.q==null)||!!a.rej-!!b.rej||(b.q??0)-(a.q??0));
    const col=document.createElement('section'); col.className='col';
    col.innerHTML=`<div class="colh"><div class="n">0${ci+1}</div><h2>${name}<small>${L.length}</small></h2><p>${CDESC[ci]}</p><div class="prog"><i style="left:${ci*25}%;width:25%"></i></div></div>`;
    L.forEach((c,k)=>{const V=c.v||{};
      const b=document.createElement('button'); b.className='card'; b.dataset.c=c.id; if(!c.f) b.disabled=true;
      const st=c.miss?(c.f?'keine Struktur':esc(deTxt(c.miss))):(c.rej?'verworfen':'Struktur');
      const r=V.result_r!=null?` · ${V.result_r>0?'+':''}${nf(V.result_r,1)} R`:'';
      b.innerHTML=`<div class="hd"><span class="tk"><span class="rank">${k+1}</span>${esc(c.sym)}</span><span class="nm">${esc(c.name&&c.name!==c.sym?c.name:'')}</span>${V.notiz?`<span class="nm nt">${esc(V.notiz)}</span>`:''}</div>
        <div class="gl">${c.ph?rose(c.ph,B.avg,58):''}<div class="sc">${c.q==null?'–':nf(c.q)}</div></div><canvas></canvas>
        <div class="fx"><span>${esc(st)}</span><span>${V.pct==null?'–':(V.pct>0?'+':'')+nf(V.pct,1)+' %'}${r}</span></div>`;
      b.onclick=()=>openDetail(c.id);
      b.onmousemove=e=>tip(e,`<b>${esc(c.sym)}</b> · ${esc(c.name)}${V.notiz?' · '+esc(V.notiz):''}<br>${esc(deTxt(V.scanner_now||c.miss||''))}`); b.onmouseleave=()=>tip();
      col.appendChild(b);});
    el.appendChild(col);});
  requestAnimationFrame(()=>$$('#pCustom .card').forEach(b=>{const c=C.find(z=>z.id===b.dataset.c); if(c&&c.m) mini(b.querySelector('canvas'),c.m);}));
}
function renderTests(){
  const T=B.tests||[];
  $('#pTests').innerHTML=`<h2>Test-Stocks <small>${T.length} von Evelyn beurteilte Aktien</small></h2><p class="note">Scanner v5 (heutige Regeln) auf Kursen bis ${(()=>{const l=T.map(c=>c.last).filter(Boolean).sort().pop();return l?dDE(l):'–';})()}; alle Ereignisse, Spanne, Creek und Phasen eingezeichnet. Ohne erkannte Struktur: nur Chart mit Grund. Pfeil im Chart = Urteilsdatum. Kursänderung vom Schluss am Urteilstag bis zum letzten Bar.</p>
  <div class="tlist">${T.map(c=>{const V=c.v||{};return `<button class="trow" data-t="${esc(c.id)}"${c.f?'':' disabled'}><b>${esc(c.sym)}</b><span class="nm">${esc(c.name)}</span>
   <span><small>Evelyn ${V.date?dDE(V.date):''}</small>${esc(V.evelyn||'–')}</span><span><small>Scanner heute</small>${esc(c.miss?'keine Struktur':(c.rej?'verworfen':'Struktur, Score '+nf(c.q)))}</span>
   <span class="pc">${V.pct==null?'–':(V.pct>0?'+':'')+nf(V.pct,1)+' %'}</span></button>`;}).join('')}</div>`;
  $$('#pTests [data-t]').forEach(b=>b.onclick=()=>openDetail(b.dataset.t));
}
function renderLegend(){
  const ex={A:95,B:60,C:null,D:85};
  $('#pLegend').innerHTML=`<h2>Board</h2><p>Vier Spalten, von links nach rechts reift die Struktur. Je Spalte höchstens zehn Aktien, höchster Score oben; Karten ohne gültigen Spring stehen immer unter allen mit Spring. Phase A und frühe Phase B erscheinen nicht (noch Geister).</p>
  <h2>Glyphe</h2><div class="lg"><div>${rose(ex,{A:88,B:72,C:60,D:80},110,{labels:true})}</div><div>Nightingale-Rose mit vier Blättern: A oben rechts, dann im Uhrzeigersinn B, C, D (D schließt die Konsolidierung ein). Der graue Ring ist der Durchschnitt aller Board-Aktien in der jeweiligen Phase. Ein Blatt reicht über den Ring hinaus, wenn die Phase besser als der Durchschnitt ist, und bleibt innen, wenn sie schwächer ist. Radius = Ring × (1 + 0,45 × Abstand zum Durchschnitt in Standardabweichungen des Boards), damit kleine Unterschiede sichtbar werden. Ein Punkt statt eines Blatts heißt: Phase nicht anwendbar (z. B. kein Spring oder weder JAC noch Konsolidierung). Die Zahl darunter ist der Gesamtscore (0–100). Er enthält auch die phasenübergreifenden Punkte der Gesamt-Akkumulation (Spannenhöhe, -breite, relative Ruhe, Abwärtstrend davor …); diese stehen im Detail in einem eigenen Abschnitt und sind kein Blatt der Rose. Das ⓘ neben jedem Punkt erklärt zuerst, was er bedeutet und wie er berechnet wird; darunter folgen die Details der Regel und zuletzt, wann und von wem sie festgelegt wurde.</div>
  <div>${funnelIcon(16)}</div><div>Echter Trichter: Die Wellen in der Spanne werden von Welle zu Welle kleiner, obere Kante fällt, untere steigt (nach Francis Hunt).</div>
  <div style="font-size:15px;color:#f2f2f2">SC ●●●○○</div><div>Ereignis im Chart mit Bewertung 0–5 Punkten.</div>
  <div><span style="background:#f2f2f2;color:#000;padding:1px 6px;border-radius:3px;font-weight:600">AR ●●●●●</span></div><div>Top-Ereignis (volle Punktzahl): weiß hinterlegt.</div>
  <div style="color:#f2f2f2;font-weight:600">✦ SC</div><div>Außergewöhnlich (SC, Spring oder JAC nahe am Ideal). Spring heißt erst nach einem JAC so (rückblickend); vorher steht „Spring?“ (möglicher Spring, unbestätigt).</div></div>
  <h2>Kerzen und Linien</h2><div class="lg"><div>Kerzen</div><div>Hohl mit weißem Rand = steigend, grau gefüllt = fallend.</div>
  <div>Creek / Spannentief</div><div>Zwei gleiche durchgezogene graue Linien bis zum rechten Rand: oben die Oberkante der Spanne (AR-Hoch), unten das Spannentief (SC). Ohne Beschriftung.</div>
  <div>Mittellinie</div><div>Dunkel gestrichelt: Achse der Spanne, alternativer enger Stopp. Der klassische Stopp steht nur im Handelsplan.</div>
  <div>Phasenleiste</div><div>Unten im Kurschart: A, B, C (hell), D früh, D spät (mittelgrau).</div></div>
  <h2>Unterfenster</h2><p>Volumen, Weis-Wellen (dieselben Wellen wie in der Bewertung: Volumen je Welle kumuliert, Richtungswechsel nach 1,5 × Median-ATR der Spanne Gegenbewegung, die Welle endet an ihrem Wendepunkt), Harmonie (log(Kerzenkörper/mittlerer Körper ÷ Volumen/Median), nur Körper ohne Dochte, ±3 begrenzt; positiv = Rutschen, negativ = Schieben; im Trend werden Gegenkerzen ausgeblendet), Wikipedia-Aufrufe (Wikimedia-API, Artikel in der Sprache des Emittenten, falls gefunden) und Markttrend (Heimatindex mit SMA 50/200). Alle teilen die Zeitachse; jedes Fenster hat eine Datumsachse, das Datum der Kerze unter dem Mauszeiger steht oben im Kurschart.</p>
  <h2>Streudiagramm</h2><p>x = Fortschritt durch die Phasen (innerhalb einer Phase stetig geschätzt), y = Score v5. Rechts oben ist es am heißesten. Die Schwänze zeigen, wo die Aktie an den letzten zehn Freitagen stand (Scanner mit damals verfügbaren Daten neu gerechnet). Ring = echter Trichter. (Seit 02.11.2026: ein Spring ist nicht Pflicht, aber ohne gültigen Spring gibt es einen Abzug, und solche Karten stehen in ihrer Spalte immer unter allen Karten mit Spring.)</p>
  <h2>Daten</h2><p>Kurse bis ${dDE(B.asof)} (gemeinsamer Kursdaten-Ordner, Tagesbars). ${B.n_scanned} Strukturen bewertet, ${B.cards.length} auf dem Board. Erstellt ${dDE(B.built)}. Testlauf, keine Anlageberatung.</p>${(B.review||[]).length?`<p>Beurteilte Fälle, die gerade nicht auf dem Board stehen (nur Detailansicht): ${B.review.map(c=>`<a href="#s=${encodeURIComponent(c.id)}" data-rev="${c.id}" style="color:#bdbdbd">${c.sym} (${c.rej?'verworfen':nf(c.q)})</a>`).join(', ')}</p>`:''}<p>Charts: <a href="https://www.tradingview.com/lightweight-charts/" style="color:#bdbdbd">TradingView Lightweight Charts</a> (Apache 2.0).</p>`;
  $$('#pLegend [data-rev]').forEach(a=>a.onclick=e=>{e.preventDefault();openDetail(a.dataset.rev);});
}

/* ---------- Navigation ---------- */
let cur='board';
function show(p){cur=p; ['Board','Scatter','Tests','Custom','Legend'].forEach(k=>{$('#p'+k).hidden=k.toLowerCase()!==p; const t=$('#tab'+k); t.classList.toggle('on',k.toLowerCase()===p); t.setAttribute('aria-selected',k.toLowerCase()===p);});
  if(p==='scatter') renderScatter(); if(p==='board') renderBoard(); if(p==='legend') renderLegend(); if(p==='tests') renderTests(); if(p==='custom') renderCustom();
  if(!curId) history.replaceState(null,'',location.pathname+(p==='scatter'?'#streu':p==='legend'?'#legende':p==='tests'?'#tests':p==='custom'?'#custom':''));}
async function init(){
  B=await (await fetch('data/board.json')).json();
  try{B.custom=(await (await fetch('data/custom.json',{cache:'no-cache'})).json()).cards||[];}catch(e){B.custom=[];}
  try{RULES=await (await fetch('data/rules.json')).json();}catch(e){RULES={};}
  try{EXPL=await (await fetch('data/expl.json')).json();}catch(e){EXPL={};}
  setupStockSearch(B, openDetail);
  for(const p of 'ABCD'){const v=B.cards.map(c=>c.ph[p]).filter(x=>x!=null), m=v.reduce((a,b)=>a+b,0)/v.length; SD[p]=Math.max(3,Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length));}
  order=[...B.cards].sort((a,b)=>a.col-b.col||(a.ns-b.ns)||b.q-a.q).map(c=>c.id);
  $('#sub').textContent=`Wyckoff-Akkumulationen · Scanner v5 · Testlauf · Daten bis ${dDE(B.asof)}`;
  $('#tabBoard').onclick=()=>show('board'); $('#tabScatter').onclick=()=>show('scatter'); $('#tabLegend').onclick=()=>show('legend'); $('#tabTests').onclick=()=>show('tests'); $('#tabCustom').onclick=()=>show('custom');
  $('#tailToggle').onchange=renderScatter; $('#tipToggle').onchange=e=>{tips=e.target.checked; tip();};
  $('#dBack').onclick=closeDetail; $('#dPrev').onclick=()=>step(-1); $('#dNext').onclick=()=>step(1);
  addEventListener('keydown',e=>{if($('#detail').hidden)return; if(e.key==='Escape')closeDetail(); if(e.key==='ArrowRight')step(1); if(e.key==='ArrowLeft')step(-1);});
  let rt; addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{if(cur==='board')$$('.card').forEach(b=>mini(b.querySelector('canvas'),B.cards.find(c=>c.id===b.dataset.id).m));},150);});
  const h=decodeURIComponent(location.hash.slice(1));
  show(h==='streu'?'scatter':h==='legende'?'legend':h==='tests'||h.startsWith('s=t:')?'tests':h==='custom'||h.startsWith('s=c:')?'custom':'board');
  if(h.startsWith('s=')&&cardOf(h.slice(2))) openDetail(h.slice(2));
}
init();
