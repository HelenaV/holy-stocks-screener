'use strict';
/* Holy Stocks Screener · Testlauf · Graustufen-Visualisierung (keine Farbcodierung) */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const nf=(v,d=1)=>v==null?'–':v.toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d});
// Erreichte und mögliche Punkte kommen gemeinsam vom Scanner; q bleibt nur der interne Rangwert.
const scoreText=c=>c.points==null||c.maxPoints==null?'–':`${nf(c.points)} / ${nf(c.maxPoints)}`;
const phaseScoreText=(c,p)=>c.phaseMaxima?.[p]>0?`${nf(c.phasePoints[p])} / ${nf(c.phaseMaxima[p])}`:'–';
const pf=p=>p==null?'–':(Math.abs(p)>=1000?p.toLocaleString('de-DE',{maximumFractionDigits:0}):p.toLocaleString('de-DE',{maximumSignificantDigits:4}));
const dDE=s=>{const[y,m,d]=s.split('-');return `${d}.${m}.${y}`;};
const G={w:'#f2f2f2',l:'#d0d0d0',m:'#9a9a9a',d:'#6a6a6a',x:'#3a3a3a',bg:'#0a0a0a'};
const COLDESC=['Spanne steht, Tests an beiden Rändern, noch kein Spring.','Spring-Kandidat oder Test am unteren Rand; Bestätigung durch JAC steht aus.','Bestätigte Jump-Bewegung bis BUEC-Abschluss, bis zum relativen Zeitlimit nach JAC.','Nach BUEC-Abschluss, spätestens am relativen Zeitlimit nach JAC.'];
let B=null, order=[], tips=false, RULES={}, EXPL={};

/* ---------- glyph: Nightingale-Rose, 5 Blätter A B C D E, Ring = Board-Durchschnitt ---------- */
let SD={A:8,B:8,C:15,D:15,E:15};
function rose(ph,avg,size=56,opt={}){
  const c=size/2, R=size*0.25, max=size*0.49, P=['A','B','C','D','E'];
  let s=`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">`;
  P.forEach((p,k)=>{
    const v=ph[p], a0=-Math.PI/2+k*2*Math.PI/P.length+0.06, a1=a0+2*Math.PI/P.length-0.12;
    if(v==null){const am=(a0+a1)/2;s+=`<circle cx="${c+R*0.5*Math.cos(am)}" cy="${c+R*0.5*Math.sin(am)}" r="${size*0.022}" fill="${G.d}"/>`;return;}
    const z=(v-(avg[p]??v))/(SD[p]||10), r=Math.max(R*0.3,Math.min(max,R*(1+0.45*z)));
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
    const cards=B.cards.filter(c=>c.col===ci); // Scanner-Reihenfolge nach vollständigem Score übernehmen.
    const col=document.createElement('section'); col.className='col';
    col.innerHTML=`<div class="colh"><div class="n">0${ci+1}</div><h2>${name}<small>${cards.length}</small></h2><p>${COLDESC[ci]}</p><div class="prog"><i style="left:${ci*25}%;width:25%"></i></div></div>`;
    cards.forEach((c,k)=>col.appendChild(structureCard(c,k)));
    el.appendChild(col);
  });
  requestAnimationFrame(()=>$$('#pBoard .card').forEach(b=>mini(b.querySelector('canvas'),B.cards.find(c=>c.id===b.dataset.id).m)));
}
function structureCard(c,k){
  const b=document.createElement('button'); b.className='card'; b.dataset.id=c.id;
  const fx=[];
  if(c.trade) fx.push(`<span>${dDE(c.last)} · ${formatR(c.trade.r)}</span>`);
  if(c.ft) fx.push(`<span>${funnelIcon()} Trichter</span>`);
  if(c.sk) fx.push(`<span>${esc(c.sk)}</span>`);
  b.innerHTML=`<div class="hd"><span class="tk"><span class="rank">${k+1}</span>${esc(c.sym.split(':')[1]||c.sym)}</span><span class="nm">${esc(c.name)}</span></div>
    <div class="gl">${rose(c.ph,B.avg,58)}<div class="sc">${scoreText(c)}</div></div><canvas></canvas><div class="fx">${fx.join('')}</div>`;
  b.onclick=()=>openDetail(c.id);
  b.onmousemove=e=>tip(e,`<b>${esc(c.sym)}</b> · ${esc(c.name)}<br>Punkte ${scoreText(c)} · A ${phaseScoreText(c,'A')} · B ${phaseScoreText(c,'B')} · C ${phaseScoreText(c,'C')} · D ${phaseScoreText(c,'D')} · E ${phaseScoreText(c,'E')}`);
  b.onmouseleave=()=>tip();
  return b;
}
/* ---------- Rejected (Evelyn 2026-11-17, R-S-17): verworfene Strukturen, Board-Aufbau, nach Punkten ---------- */
const REJINFO='Strukturen, die eine harte Regel verworfen hat. Je Aktie zeigt die Karte die verworfene Struktur mit den meisten Punkten; die Detailansicht listet die übrigen. Punkte / Max nach dem phasenabhängigen Budget (späte B 130, C 150, D 175, E 185; nicht anwendbare Teile fallen aus dem Maximum). Die Punkte sind nur zur Prüfung und ändern nichts am Board.';
const rejShort=r=>String(r||'').split(': ')[0];
function renderRejected(){
  const R=B.rejected||[], tot=B.rejectedTotals||[], el=$('#pRejected'); el.innerHTML='';
  B.cols.forEach((name,ci)=>{
    const cards=R.filter(c=>c.col===ci), n=tot[ci]??cards.length;
    const more=n>cards.length?` Gezeigt werden die ${cards.length} punktstärksten von ${n}.`:'';
    const early=ci===0&&B.rejectedEarlyOnly?` ${B.rejectedEarlyOnly} weitere Aktien haben nur verworfene Strukturen in früher Phase B (nicht im Board).`:'';
    const col=document.createElement('section'); col.className='col';
    col.innerHTML=`<div class="colh"><div class="n">0${ci+1}</div><h2><span>${name} <button class="info rinfo-btn" aria-label="Erklärung" title="Erklärung">ⓘ</button></span><small>${n}</small></h2><p>${COLDESC[ci]}</p><p class="rjinfo" hidden>${esc(REJINFO+more+early)}</p><div class="prog"><i style="left:${ci*25}%;width:25%"></i></div></div>`;
    col.querySelector('.rinfo-btn').onclick=e=>{e.stopPropagation(); const p=col.querySelector('.rjinfo'); p.hidden=!p.hidden;};
    cards.forEach((c,k)=>{
      const b=document.createElement('button'); b.className='card rj'; b.dataset.id=c.id;
      const fx=[`<span class="why">${esc(rejShort(c.rej))}</span>`]; if(c.nOther) fx.push(`<span>+${c.nOther} weitere</span>`); if(c.valid) fx.push('<span>gültige Struktur im Board</span>');
      b.innerHTML=`<div class="hd"><span class="tk"><span class="rank">${k+1}</span>${c.sym.split(':')[1]||c.sym}</span><span class="nm">${esc(c.name)}</span></div>
        <div class="gl">${rose(c.ph,B.avg,58)}<div class="sc">${scoreText(c)}</div></div><canvas></canvas><div class="fx">${fx.join('')}</div>`;
      b.onclick=()=>openDetail(c.id);
      b.onmousemove=e=>tip(e,`<b>${esc(c.sym)}</b> · ${esc(c.name)}<br>Punkte ${scoreText(c)}<br>${esc(c.rej)}`);
      b.onmouseleave=()=>tip();
      col.appendChild(b);
    });
    el.appendChild(col);
  });
  requestAnimationFrame(()=>$$('#pRejected .card').forEach(b=>{const c=R.find(z=>z.id===b.dataset.id); if(c&&c.m) mini(b.querySelector('canvas'),c.m);}));
}
function rejectedH(X){if(!X)return'';
  const rows=(X.others||[]).map(o=>`<tr><td>${o.start?dDE(o.start):'–'} – ${o.end?dDE(o.end):'–'}</td><td>${esc(o.colName)}</td><td>${nf(o.points)} / ${nf(o.maxPoints)}</td><td>${esc(o.reason)}</td></tr>`).join('');
  return `<h3>Verworfen <button class="info rj-i" aria-label="Erklärung" title="Erklärung">ⓘ</button></h3><p class="note rj-x" hidden>${esc(REJINFO)}${X.unscored?` Dazu ${X.unscored} früh verworfene Kandidaten ohne fertige Spanne (ohne Punkte, nicht gelistet).`:''}</p>
    <dl class="kv"><dt>Grund</dt><dd>${esc(X.reason)}</dd><dt>Punkte / Max</dt><dd>${nf(X.points)} / ${nf(X.maxPoints)}</dd><dt>Spalte</dt><dd>${esc(X.colName)}</dd><dt>Spanne</dt><dd>${X.start?dDE(X.start):'–'} – ${X.end?dDE(X.end):'–'}</dd>${X.valid?'<dt>Board</dt><dd>Die Aktie hat zusätzlich eine gültige Struktur.</dd>':''}</dl>
    ${rows?`<h3>Weitere verworfene Strukturen</h3><table class="rjt"><thead><tr><th>Spanne</th><th>Spalte</th><th>Punkte / Max</th><th>Grund</th></tr></thead><tbody>${rows}</tbody></table>`:''}`;
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
    const ref=D.hideReviewOverlay?null:D.reviewOverlay;
    if(bg){
      if(xa!=null&&xb!=null){const yh=Y(bx.hi), yl=Y(bx.lo); ctx.fillStyle='rgba(255,255,255,.035)'; ctx.fillRect(xa-bs,yh,xb-xa+2*bs,yl-yh);}
      if(ref?.i0!=null&&ref.lo!=null&&ref.hi!=null){const a=X(ref.i0),b=X(ref.i1);if(a!=null&&b!=null){ctx.fillStyle='rgba(190,190,190,.06)';ctx.fillRect(a-bs,Y(ref.hi),b-a+2*bs,Y(ref.lo)-Y(ref.hi));}}
      // (2026-11-02 11:11, Evelyn) no phase lines/letters in the price panel - only the phase bar at the bottom
      return;
    }
    if(ref){
      const colour='#bdbdbd', x0=ref.i0==null?0:X(ref.i0), x1=X(ref.i1);
      if(x0!=null&&x1!=null){
        if(ref.lo!=null)line(x0,W,Y(ref.lo),colour,[6,5],1.2);
        if(ref.hi!=null)line(x0,W,Y(ref.hi),colour,[6,5],1.2);
        if(ref.i0!=null && ref.lo!=null && ref.hi!=null){ctx.strokeStyle=colour;ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(x0,Y(ref.lo));ctx.lineTo(x0,Y(ref.hi));ctx.moveTo(x1,Y(ref.lo));ctx.lineTo(x1,Y(ref.hi));ctx.stroke();ctx.setLineDash([]);}
      }
      // Eigene Messleiste: Review-Fenster ändern weder erkannte Phasen noch Scores.
      for(const [index,span] of (ref.measurementSpans||[]).entries()){const a=X(span.i0),b=X(span.i1);if(a==null||b==null)continue;ctx.fillStyle=index%2?'#bdbdbd':'#707070';ctx.fillRect(a-bs,H-68,Math.max(2,b-a+2*bs),5);ctx.font='600 10px Inter,Helvetica Neue,system-ui,sans-serif';const wide=b-a>90;const labelX=wide?(a+b)/2:Math.max(0,Math.min(W-ctx.measureText(span.label).width-4,b+5));txt(span.label,labelX,H-73,colour,wide?'center':'left',600,10);}
      const slots=[[-Infinity,-Infinity,-Infinity],[-Infinity,-Infinity,-Infinity]];
      ctx.font='500 10px Inter,Helvetica Neue,system-ui,sans-serif';
      for(const event of ref.events){const x=X(event.i), y=Y(event.p);if(x==null||y==null||x<0||x>W)continue;
        const lane=event.lo?1:0, text='Ref. '+(event.approximate?'≈ ':'')+event.k;
        const labelWidth=ctx.measureText(text).width;
        const lx=Math.max(0,Math.min(x-labelWidth/2,W-labelWidth-4));
        let tier=slots[lane].findIndex(end=>end+6<=lx);if(tier<0)tier=2;
        const ly=event.lo?H-128-tier*12:20+tier*12;
        txt(text,lx,ly,colour,'left',500,10);ctx.strokeStyle=colour;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(lx+labelWidth/2,ly+(event.lo?-12:4));ctx.stroke();ctx.setLineDash([]);slots[lane][tier]=lx+labelWidth;
      }
    }
    // Phasenleiste unten
    const yb=H-14; let lastLx=null, lastLy=0;
    // R-S-15 (Evelyn 2026-11-02 11:11): adjacent phases alternate dark / light gray, small gap between segments
    D.spans.forEach((sp,k)=>{const x0=X(sp.i0), x1=X(sp.i1); if(x0==null||x1==null)return;
      ctx.fillStyle=k%2?'#c8c8c8':'#5a5a5a'; ctx.fillRect(x0-bs+2,yb-1,Math.max(2,x1-x0+2*bs-4),5);
      const lab={A:'A',B:'B',C:'C',D:'D',E:'E'}[sp.ph]; if(x1-x0>14) txt(lab,(x0+x1)/2,yb-4,G.l,'center',600,10.5);
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
      // Review-Hinweise markieren dieselbe Kerze auch direkt im Volumenpanel.
      if(!D.hideReviewOverlay){for(const marker of D.reviewOverlay?.events||[]){
        if(!marker.volume)continue;
        const x=ts.logicalToCoordinate(marker.i), vy=this.series.priceToCoordinate(Math.min(D.v[marker.i],cap));
        if(x==null||vy==null)continue;
        ctx.strokeStyle='#bdbdbd';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,vy,4,0,2*Math.PI);ctx.stroke();
        ctx.fillStyle='#bdbdbd';ctx.fillText('Ref. '+D.t[marker.i].slice(5).split('-').reverse().join('.'),x,Math.max(24,vy-8));
      }}
      ctx.restore();
    });}
}

function baseOpts(dateLabel){return{autoSize:true,layout:{attributionLogo:false,background:{type:'solid',color:G.bg},textColor:G.m,fontSize:11,fontFamily:'Inter,Helvetica Neue,system-ui,sans-serif'},
  grid:{vertLines:{visible:false},horzLines:{color:'#151515'}},rightPriceScale:{borderColor:'#222',minimumWidth:78},
  timeScale:{visible:true,borderColor:'#222',rightOffset:8,timeVisible:false},crosshair:{mode:0,vertLine:{color:'#555',style:2,labelVisible:!!dateLabel,labelBackgroundColor:'#333'},horzLine:{color:'#555',style:2,labelBackgroundColor:'#333'}},
  localization:{locale:'de-DE',dateFormat:'dd.MM.yyyy'},handleScale:{axisPressedMouseMove:{time:true,price:true}}};}

// R-S-12: judged charts (tests/cases) that are not on the board: detail page only (#s=<id>, linked in the legend)
function cardOf(id){return backtestCards().find(c=>c.id===id)||B.cards.find(z=>z.id===id)||(B.rejected||[]).find(z=>z.id===id)||(B.review||[]).find(z=>z.id===id)||(B.tests||[]).find(z=>z.id===id&&z.f)||(B.custom||[]).find(z=>z.id===id&&z.f)||(B.feedback?.cases||[]).find(z=>z.id===id);}
const isTest=id=>/^[tcf]:/.test(String(id)), isCustom=id=>String(id).startsWith('c:'), isRej=id=>String(id).startsWith('r:');
async function openDetail(id){
  if(isBacktest(id)){
    const run=String(id).split(':')[1];
    if(cur!=='backtest'||String(backtestRun)!==run) show('backtest',run);
    try{await loadBacktests();}catch(e){return;}
  }
  const c=cardOf(id);
  if(!c) return;
  if(String(id).startsWith('f:')&&cur!=='tests')show('tests');
  if(isRej(id)&&cur!=='rejected')show('rejected');
  $('#detail').classList.toggle('feedback-mode',String(id).startsWith('f:'));
  $('#dFeedback').hidden=!String(id).startsWith('f:');
  curId=id; location.hash='s='+encodeURIComponent(id); $('#detail').hidden=false; document.body.style.overflow='hidden';
  const D=await (await fetch('data/s/'+c.f,isBacktest(id)?{cache:'no-cache'}:undefined)).json(); if(curId!==id)return;
  D.backtestTrade=c.trade;
  charts.forEach(ch=>ch.remove()); charts=[];
  $('#dSym').textContent=D.sym; $('#dName').textContent=D.name;
  $('#dMeta').innerHTML=`${D.reference?'<span>Prüfstand '+dDE(D.reference.date)+'</span>':''}<span>${isBacktest(id)?'Backtest · '+formatR(c.trade.r):isRej(id)?'Rejected · '+esc(D.colName)+' · verworfen':isTest(id)?(isCustom(id)?'Custom · '+esc(CGRP[(D.cst||{}).gruppe]||deTxt((D.cst||{}).gruppe)||'')+' · ':'Test-Stock · ')+esc(D.colName)+(c.rej?' · '+esc(deTxt(c.rej)):''):D.colName+(B.cards.some(z=>z.id===id)?'':(c.rej?' · nicht auf dem Board – '+esc(deTxt(c.rej)):' · nicht auf dem Board (beurteilter Fall)'))}</span><span>${isBacktest(id)?(c.trade.buecSignal?'JAC am ':'Signal am ')+dDE(D.asof)+' · Chart bis '+dDE(D.t[D.t.length-1]):'Daten bis '+dDE(D.asof)}</span><span class="big">${scoreText(D)}</span>`;
  const LW=window.LightweightCharts, T=D.t, n=T.length;
  const mk=(k,dateLabel=false,extra={})=>{const ch=LW.createChart($('#c'+k),Object.assign(baseOpts(dateLabel),extra)); charts.push(ch); return ch;};
  // Kurs
  const c0=mk(0,true,{rightPriceScale:{borderColor:'#222',minimumWidth:78,scaleMargins:{top:.16,bottom:.22}}});
  const cs=c0.addCandlestickSeries({upColor:G.bg,borderUpColor:G.w,wickUpColor:G.w,downColor:'#8a8a8a',borderDownColor:'#8a8a8a',wickDownColor:'#8a8a8a',priceLineVisible:false,lastValueVisible:true,
    priceFormat:{type:'custom',formatter:pf,minMove:0.0001}});
  cs.setData(T.map((t,i)=>({time:t,open:D.o[i],high:D.h[i],low:D.l[i],close:D.c[i]})));
  cs.attachPrimitive(new WyOverlay(D));
  drawBacktestTrade(c0,cs,T,D.backtestTrade);
  // Custom trade lines (Evelyn 2026-11-02): entry solid, stop dashed, target dotted; gray, no labels, like the range lines; nothing when empty
  {const P=D.cst||{}; [[P.entry_price,0],[P.stop,2],[P.target,1]].forEach(([p,ls])=>{if(p!=null&&isFinite(p)) cs.createPriceLine({price:+p,color:G.m,lineWidth:1,lineStyle:ls,axisLabelVisible:false,title:''});});}
  {const md=D.verdict?D.verdict.date:(D.cst&&D.cst.added?D.cst.added:null); if(md){const k=T.findIndex(t=>t>md); const tt=k<0?T[n-1]:T[k];
    cs.setMarkers([{time:tt,position:'aboveBar',color:G.w,shape:'arrowDown',text:(D.verdict?'Urteil ':'hinzugefügt ')+dDE(md).slice(0,6)}]);}}
  $('#pl0').innerHTML=`Kurs <b id="hov" class="hov"></b><small>hohl = steigend · grau gefüllt = fallend · Ereignisse mit Bewertung ●○ (0–5), weiß hinterlegt = Top, ✦ = außergewöhnlich${D.backtestTrade?' · gestrichelt = aktiver Backtest-Stopp':''}</small>`;
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
function bindReviewOverlay(D){
  const header=$('#pl0');
  const old=header.querySelector('.reference-toggle');if(old)old.remove();
  if(!D.reviewOverlay)return;
  const label=document.createElement('label');label.className='reference-toggle';
  const input=document.createElement('input');input.type='checkbox';input.checked=true;
  label.append(input,document.createTextNode(' Referenz anzeigen (gestrichelt)'));
  input.onchange=()=>{D.hideReviewOverlay=!input.checked;charts.slice(0,2).forEach(chart=>chart.applyOptions({}));};
  header.appendChild(label);
}
function edgeTestsH(tests){
  if(!tests)return '';
  const rows=['lower','upper'].flatMap(edge=>(tests[edge]||[]).map(test=>`<tr><td>${edge==='lower'?'unten':'oben'}</td><td>${esc(test.event)}</td><td>${esc(dDE(test.date))}</td><td>${nf(test.volume,2)}×</td><td>${nf(test.bars,0)}</td></tr>`)).join('');
  if(!rows)return '';
  return `<details class="edge-test-details"><summary>Verwendete Kantentests</summary><p class="note">Initiale Referenzen eingeschlossen. Volumen relativ zum Referenzvolumen der Range.</p><table><thead><tr><th>Kante</th><th>Event</th><th>Datum</th><th>Vol.</th><th>Kerzen</th></tr></thead><tbody>${rows}</tbody></table><p class="note">Volumen letzter/erster Test: unten ${nf(tests.lowerLastFirst,2)}×, oben ${nf(tests.upperLastFirst,2)}×.<br>Mittlere Dauer (Median): unten ${nf(tests.lowerDuration,1)}, oben ${nf(tests.upperDuration,1)} Kerzen.</p></details>`;
}
function renderSide(D){
  if(!D.box){$('#side').innerHTML=window.HolyStocksFeedback.detail(D.feedback)+referenceH(D.reference)+overview(D.ov)+verdictH(D.verdict)+customH(D.cst)+`<p class="note" style="margin:10px 0">${D.feedback?'Keine gültige Scannerzeichnung':'Keine Zeichnung'}: ${esc(deTxt(D.status))}</p>`;window.HolyStocksFeedback.bind($('#side'),openDetail);bindReviewOverlay(D);return;}
  const P={A:'Phase A · Stopp des Abwärtstrends',B:'Phase B · Aufbau der Ursache',C:'Phase C · Spring / Test',D:'Phase D · Jump-Bewegung',E:'Phase E · Nach BUEC oder relativem Zeitlimit'};
  let h=backtestTradeH(D.backtestTrade)+window.HolyStocksFeedback.detail(D.feedback)+referenceH(D.reference)+rejectedH(D.rejected)+overview(D.ov)+verdictH(D.verdict)+customH(D.cst)+(D.box?'':`<p class="note" style="margin:10px 0">${D.feedback?'Keine gültige Scannerzeichnung':'Keine Zeichnung'}: ${esc(deTxt(D.status))}</p>`)+`<h3>Punkte · erreicht / möglich</h3><div style="display:flex;align-items:center;gap:14px">${rose(D.phases,D.avg,130,{labels:true})}<div><div style="font-size:34px;font-weight:300;line-height:1">${scoreText(D)}</div>
    <div style="margin-top:8px">Konfidenz <span style="letter-spacing:1px">${dots(D.conf)}</span></div></div></div>
    <div class="note" style="margin-top:6px">Blatt größer als der gestrichelte Ring = Phase besser als der Board-Durchschnitt.</div>
    <div class="flagline">${D.funnel.true?`<span class="chip on">${funnelIcon(10).replace(G.w,'#000')} echter Trichter</span>`:''}${D.spring?`<span class="chip">${esc(D.spring.status==='shakeout'?'Shakeout':D.spring.longVariant?'Spring / Shakeout':D.spring.kind)}${D.spring.ok&&!D.spring.conf?'?':''}${D.spring.status==='shakeout'?' · Pflicht-Test fehlt oder ungültig':''}</span>`:(D.box?'<span class="chip">kein Spring</span>':'')}</div>`;
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
  const sec=(p,title,sub)=>{const rows=D.bd[p]||[]; let x=`<div class="ph"><div class="phh"><b>${title}</b><span>${phaseScoreText(D,p)}</span></div>`;
    if(sub) x+=`<div class="note" style="margin-bottom:4px">${sub}</div>`;
    if(!rows.length) x+='<div class="note">nicht anwendbar</div>'; rows.forEach((r,i)=>{x+=rowH(r,p+'-'+i);}); return x+'</div>';};
  h+='<h3>Gesamt-Akkumulation</h3>'+sec('G','Phasenübergreifend','gilt für die ganze Akkumulation, nicht Teil der Rose');
  h+='<h3>Bewertung je Phase</h3>';
  for(const p of 'ABCDE') h+=sec(p,P[p]);
  if(D.eventTime&&D.eventTime.accumulation){
    const tm=D.eventTime.accumulation, limits=D.eventTime;
    h+=`<h3>Zeitmaßstab</h3><dl class="kv"><dt>Akkumulationslänge</dt><dd>${tm.accumulation_bars} Kerzen · SC bis ${D.t[D.box.i1]||'Range-Ende'}</dd><dt>Umrechnung</dt><dd>${nf(tm.factor,2)} × Referenzfenster (${tm.reference_range_bars} Kerzen)</dd>${limits.buecMinimum!=null?`<dt>BUEC ab JAC-Peak</dt><dd>${limits.buecMinimum}–${limits.buecMaximum} Kerzen</dd><dt>Phase E spätestens</dt><dd>${limits.phaseEAfter} Kerzen nach JAC</dd>`:''}</dl><p class="note">Nach JAC bleibt die Akkumulationslänge fest. BUEC und Warren-Konsolidierung zählen nicht dazu.</p>`;
  }
  if(D.spring){
    const s=D.spring;
    const description=s.explanation||s.kind;
    h+=`<h3>Spring / Shakeout</h3><p>${esc(description)}</p><dl class="kv">
      <dt>Deutung</dt><dd>${esc(s.status==='shakeout'?'Shakeout (Typ-1-Kandidat ohne gültigen Test)':s.longVariant?'Spring / Shakeout':s.kind)}${s.ok&&!s.conf?' (möglich, noch kein JAC)':''}</dd>
      <dt>Spring-Punkte</dt><dd>${scoreText(s)}</dd>
      <dt>Volumen der Event-Kerzen</dt><dd>${nf(s.vr,2)} × ${s.status?'vorheriger Durchschnitt':'Median (gespeicherter Stand)'}</dd>
      <dt>Stich unter die Spanne</dt><dd>${nf(s.da,2)} ATR · ${nf(100*s.pen,1)} % der Range-Höhe</dd>
      <dt>Test</dt><dd>${s.nt?(s.ht?'Pflicht-Test gültig':'Pflicht-Test fehlt oder ungültig'):s.ok?'kein Pflicht-Test':'Typ noch ungeklärt'}</dd>
      <dt>Test-/Spring-Volumen</dt><dd>${s.testVolumeRatio==null?'–':nf(100*s.testVolumeRatio,0)+' %'}</dd>
      <dt>Dauer des Ausflugs</dt><dd>${s.dur} ${s.dur===1?'Kerze':'Kerzen'}</dd>
      ${s.shortLimit!=null?`<dt>Zeitgrenzen dieses Prüfstands</dt><dd>kurz bis ${s.shortLimit}, Typ 1 bis ${s.typeOneLimit}, Testsuche ${s.testSearchLimit} Kerzen</dd>`:''}</dl>`;
    if(s.provisional) h+='<p class="note">Messgrenzen und Punktegewichte sind vorläufige Arbeitswerte.</p>';
  }
  if(D.funnel.score!=null) h+=`<h3>Trichter</h3><dl class="kv"><dt>Trichter-Wert</dt><dd>${nf(D.funnel.score,2)}</dd><dt>Amplituden-Trend (Spearman)</dt><dd>${nf(D.funnel.rho,2)}</dd><dt>letzte/erste Welle</dt><dd>${nf(D.funnel.lf,2)}</dd><dt>echter Trichter</dt><dd>${D.funnel.true?'ja':'nein'}</dd></dl>`;
  const pl=D.plan;
  if(pl) h+=`<h3>Handelsplan</h3><div class="plan"><p>${esc(pl.entry)}</p><dl class="kv"><dt>Letzter Kurs</dt><dd>${pf(pl.last)}</dd><dt>Stopp eng (Mittellinie)</dt><dd>${pf(pl.mid)} <span class="note">${pl.risk_mid>0?'−'+nf(pl.risk_mid,1)+' %':'Kurs darunter'}</span></dd>
    <dt>Stopp klassisch (unter Spring/Tief)</dt><dd>${pf(pl.classic)} <span class="note">−${nf(pl.risk_classic,1)} %</span></dd><dt>Ziel (Creek + Spannenhöhe)</dt><dd>${pf(pl.target)}</dd></dl></div>
    <p class="note" style="margin-top:22px">Testlauf, keine Anlageberatung. Scanner v5 = v4 + Spring-, Trichter- und Stopp-Regeln; Schwellen teils vorläufig.</p>`;
  $('#side').innerHTML=h+edgeTestsH(D.edgeTests);
  window.HolyStocksFeedback.bind($('#side'),openDetail);bindReviewOverlay(D);
  const rji=$('#side .rj-i'); if(rji) rji.onclick=e=>{e.stopPropagation(); const x=$('#side .rj-x'); if(x) x.hidden=!x.hidden;};
  $$('#side .row .info').forEach(b=>b.onclick=e=>{e.stopPropagation(); const d=b.closest('.row').parentNode.querySelector(`.rinfo[data-for="${CSS.escape(b.dataset.r)}"]`); if(d) d.hidden=!d.hidden;});
}
function closeDetail(updateHash=true){ $('#detail').hidden=true; document.body.style.overflow=''; curId=null; charts.forEach(c=>c.remove()); charts=[]; if(updateHash) history.replaceState(null,'',location.pathname+panelHash(cur)); }
function step(d){const o=isBacktest(curId)?backtestCards().map(c=>c.id):String(curId).startsWith('f:')?(B.feedback?.cases||[]).map(c=>c.id):isCustom(curId)?(B.custom||[]).filter(c=>c.f).map(c=>c.id):isTest(curId)?(B.tests||[]).filter(c=>c.f).map(c=>c.id):isRej(curId)?(B.rejected||[]).map(c=>c.id):order; const k=o.indexOf(curId); const j=o[k+d]; if(j) openDetail(j);}

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
        <div class="gl">${c.ph?rose(c.ph,B.avg,58):''}<div class="sc">${scoreText(c)}</div></div><canvas></canvas>
        <div class="fx"><span>${esc(st)}</span><span>${V.pct==null?'–':(V.pct>0?'+':'')+nf(V.pct,1)+' %'}${r}</span></div>`;
      b.onclick=()=>openDetail(c.id);
      b.onmousemove=e=>tip(e,`<b>${esc(c.sym)}</b> · ${esc(c.name)}${V.notiz?' · '+esc(V.notiz):''}<br>${esc(deTxt(V.scanner_now||c.miss||''))}`); b.onmouseleave=()=>tip();
      col.appendChild(b);});
    el.appendChild(col);});
  requestAnimationFrame(()=>$$('#pCustom .card').forEach(b=>{const c=C.find(z=>z.id===b.dataset.c); if(c&&c.m) mini(b.querySelector('canvas'),c.m);}));
}
function renderTests(){
  const T=B.tests||[];
  $('#pTests').innerHTML=window.HolyStocksFeedback.section(B.feedback)+`<h2>Bisherige Test-Stocks <small>${T.length} von Evelyn beurteilte Aktien</small></h2><p class="note">Scanner v5 (heutige Regeln) auf Kursen bis ${(()=>{const l=T.map(c=>c.last).filter(Boolean).sort().pop();return l?dDE(l):'–';})()}; alle Ereignisse, Spanne, Creek und Phasen eingezeichnet. Ohne erkannte Struktur: nur Chart mit Grund. Pfeil im Chart = Urteilsdatum. Kursänderung vom Schluss am Urteilstag bis zum letzten Bar.</p>
  <div class="tlist">${T.map(c=>{const V=c.v||{};return `<button class="trow" data-t="${esc(c.id)}"${c.f?'':' disabled'}><b>${esc(c.sym)}</b><span class="nm">${esc(c.name)}</span>
   <span><small>Evelyn ${V.date?dDE(V.date):''}</small>${esc(V.evelyn||'–')}</span><span><small>Scanner heute</small>${esc(c.miss?'keine Struktur':(c.rej?'verworfen':'Struktur, Punkte '+scoreText(c)))}</span>
   <span class="pc">${V.pct==null?'–':(V.pct>0?'+':'')+nf(V.pct,1)+' %'}</span></button>`;}).join('')}</div>`;
  window.HolyStocksFeedback.bind($('#pTests'),openDetail);
  $$('#pTests [data-t]').forEach(b=>b.onclick=()=>openDetail(b.dataset.t));
}
function renderLegend(){
  const ex={A:95,B:60,C:null,D:85};
  $('#pLegend').innerHTML=`<h2>Board</h2><p>Vier Spalten, von links nach rechts reift die Struktur. Je Spalte höchstens zehn Aktien, höchster Erfüllungsgrad des aktiven Punktebudgets oben. Phase A und frühe Phase B erscheinen nicht (noch Geister).</p>
  <h2>Glyphe</h2><div class="lg"><div>${rose(ex,{A:88,B:72,C:60,D:80},110,{labels:true})}</div><div>Nightingale-Rose mit fünf Blättern für A, B, C, D und E. Phase D umfasst die bestätigte Jump-Bewegung und den BUEC. Phase E beginnt am BUEC-Abschluss, spätestens am relativen Zeitlimit nach dem JAC; ein BUEC ist optional. Referenz sind elf Kerzen bei 84 Akkumulationskerzen. Die Umrechnung nutzt vor JAC SC bis Prüfdatum, danach fest SC bis JAC. BUEC und Warren-Konsolidierung verlängern diese Basis nicht. Der graue Ring ist der Durchschnitt aller Board-Aktien in der jeweiligen Phase. Ein Blatt reicht über den Ring hinaus, wenn die Phase besser als der Durchschnitt ist, und bleibt innen, wenn sie schwächer ist. Radius = Ring × (1 + 0,45 × Abstand zum Durchschnitt in Standardabweichungen des Boards), damit kleine Unterschiede sichtbar werden. Ein Punkt statt eines Blatts heißt: Phase nicht anwendbar (z. B. kein Spring oder weder JAC noch Konsolidierung). Die Zahlen darunter zeigen erreichte / mögliche Punkte. Das verfügbare Budget wächst mit der Reife; technische Datenlücken werden davon ausgenommen. Die Summe enthält auch die phasenübergreifenden Punkte der Gesamt-Akkumulation (Spannenhöhe, -breite, relative Ruhe, Abwärtstrend davor …); diese stehen im Detail in einem eigenen Abschnitt und sind kein Blatt der Rose. Das ⓘ neben jedem Punkt erklärt zuerst, was er bedeutet und wie er berechnet wird; darunter folgen die Details der Regel und zuletzt, wann und von wem sie festgelegt wurde.</div>
  <div>${funnelIcon(16)}</div><div>Echter Trichter: Die Wellen in der Spanne werden von Welle zu Welle kleiner, obere Kante fällt, untere steigt (nach Francis Hunt).</div>
  <div style="font-size:15px;color:#f2f2f2">SC ●●●○○</div><div>Ereignis im Chart mit Bewertung 0–5 Punkten.</div>
  <div><span style="background:#f2f2f2;color:#000;padding:1px 6px;border-radius:3px;font-weight:600">AR ●●●●●</span></div><div>Top-Ereignis (volle Punktzahl): weiß hinterlegt.</div>
  <div style="color:#f2f2f2;font-weight:600">✦ SC</div><div>Außergewöhnlich (SC, Spring oder JAC nahe am Ideal). Spring heißt erst nach einem JAC so (rückblickend); vorher steht „Spring?“ (möglicher Spring, unbestätigt).</div></div>
  <h2>Kerzen und Linien</h2><div class="lg"><div>Kerzen</div><div>Hohl mit weißem Rand = steigend, grau gefüllt = fallend.</div>
  <div>Creek / Spannentief</div><div>Zwei gleiche durchgezogene graue Linien bis zum rechten Rand: oben die Oberkante der Spanne (AR-Hoch), unten das Spannentief (SC). Ohne Beschriftung.</div>
  <div>Mittellinie</div><div>Dunkel gestrichelt: Achse der Spanne, alternativer enger Stopp. Der klassische Stopp steht nur im Handelsplan.</div>
  <div>Phasenleiste</div><div>Unten im Kurschart: A, B, C, D (Jump-Bewegung) und E (nach BUEC oder relativem Zeitlimit).</div></div>
  <h2>Unterfenster</h2><p>Volumen, Weis-Wellen (dieselben Wellen wie in der Bewertung: Volumen je Welle kumuliert, Richtungswechsel nach 1,5 × Median-ATR der Spanne Gegenbewegung, die Welle endet an ihrem Wendepunkt), Harmonie (log(Kerzenkörper/mittlerer Körper ÷ Volumen/Median), nur Körper ohne Dochte, ±3 begrenzt; positiv = Rutschen, negativ = Schieben; im Trend werden Gegenkerzen ausgeblendet), Wikipedia-Aufrufe (Wikimedia-API, Artikel in der Sprache des Emittenten, falls gefunden) und Markttrend (Heimatindex mit SMA 50/200). Alle teilen die Zeitachse; jedes Fenster hat eine Datumsachse, das Datum der Kerze unter dem Mauszeiger steht oben im Kurschart.</p>
  <h2>Prüfcharts</h2><p><a class="legend-link" href="#tests" id="reviewLink">Test-Stocks und fachliche Rückmeldungen</a></p>
  <h2>Daten</h2><p>Kurse bis ${dDE(B.asof)} (gemeinsamer Kursdaten-Ordner, Tagesbars). ${B.n_scanned} Strukturen bewertet, ${B.cards.length} auf dem Board. Erstellt ${dDE(B.built)}. Testlauf, keine Anlageberatung.</p>${(B.review||[]).length?`<p>Beurteilte Fälle, die gerade nicht auf dem Board stehen (nur Detailansicht): ${B.review.map(c=>`<a href="#s=${encodeURIComponent(c.id)}" data-rev="${c.id}" style="color:#bdbdbd">${c.sym} (${c.rej?'verworfen':scoreText(c)})</a>`).join(', ')}</p>`:''}<p>Charts: <a href="https://www.tradingview.com/lightweight-charts/" style="color:#bdbdbd">TradingView Lightweight Charts</a> (Apache 2.0).</p>`;
  $('#reviewLink').onclick=e=>{e.preventDefault();show('tests');};
  $$('#pLegend [data-rev]').forEach(a=>a.onclick=e=>{e.preventDefault();openDetail(a.dataset.rev);});
}

/* ---------- Backtest ---------- */
let backtestData=null, backtestRequest=null, backtestRun=null;
const isBacktest=id=>String(id).startsWith('bt:');
const formatR=r=>r==null?'–':(r>0?'+':'')+nf(r,2)+' R';
const tradeStatuses={
  erfolgreich:'Mit Gewinn geschlossen', gescheitert:'Mit Verlust oder ohne Gewinn geschlossen',
  offen:'Offen', einstieg_entfallen:'Einstieg entfallen', einstieg_ausstehend:'Einstieg ausstehend'
};
function loadBacktests(){
  if(backtestData) return Promise.resolve(backtestData);
  if(!backtestRequest) backtestRequest=fetch('data/backtests.json',{cache:'no-cache'}).then(response=>{
    if(!response.ok) throw new Error('Backtests konnten nicht geladen werden.');
    return response.json();
  }).then(data=>backtestData=data.runs).finally(()=>{backtestRequest=null;});
  return backtestRequest;
}
function backtestCards(){
  const run=(backtestData||[]).find(item=>String(item.id)===String(backtestRun));
  return run?[...new Map(run.examples.flatMap(group=>group.cards).map(card=>[card.id,card])).values()]:[];
}
function drawBacktestCards(){
  const cards=new Map(backtestCards().map(card=>[card.id,card]));
  $$('#pBacktest .card').forEach(button=>{
    const card=cards.get(button.dataset.id);
    if(card?.m) mini(button.querySelector('canvas'),card.m);
  });
}
function drawBacktestTrade(chart,candles,dates,trade){
  if(!trade) return;
  const start=dates.indexOf(trade.entryDate);
  const end=trade.exitDate?dates.indexOf(trade.exitDate):dates.length-1;
  const markers=[];
  const buec=trade.buecSignal;
  if(buec){
    if(dates.includes(buec.buec_low)) markers.push({time:buec.buec_low,position:'belowBar',color:G.l,shape:'circle',text:'BUEC-Tief'});
    if(dates.includes(buec.trigger_date)) markers.push({time:buec.trigger_date,position:'aboveBar',color:G.l,shape:'circle',text:'BUEC-Signal'});
  }
  if(start>=0&&end>=start){
    markers.push({time:dates[start],position:'belowBar',color:G.w,shape:'arrowUp',text:'Einstieg '+pf(trade.entry)});
    if(trade.exitDate) markers.push({time:dates[end],position:'aboveBar',color:G.w,shape:'arrowDown',text:'Ausstieg '+formatR(trade.r)});
  }
  if(markers.length) candles.setMarkers(markers.sort((a,b)=>a.time.localeCompare(b.time)));
  if(start<0||end<start) return;
  const changes=new Map();
  for(const {confirmed,stop} of trade.stopUpdates||[]){
    const i=dates.indexOf(confirmed);
    if(i>=start) changes.set(i+1,stop);
  }
  let stop=trade.initialStop;
  const values=dates.slice(start,end+1).map((time,i)=>{
    stop=changes.get(start+i)??stop;
    return {time,value:stop};
  });
  chart.addLineSeries({lineType:1,lineStyle:2,color:G.m,lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false}).setData(values);
}
function backtestTradeH(trade){
  if(!trade) return '';
  const buec=trade.buecSignal;
  const price=(value,date)=>value==null?'–':pf(value)+' · '+dDE(date);
  return `<h3>Simulierter Trade</h3><dl class="kv">
    <dt>Status</dt><dd>${esc(tradeStatuses[trade.status])}</dd>
    ${buec?`<dt>BUEC-Abschluss</dt><dd>${dDE(buec.buec_end)}</dd><dt>Auslösekerze</dt><dd>${dDE(buec.trigger_date)}${buec.previous_atr>0?' · '+nf(buec.green_body/buec.previous_atr,2)+' ATR':''}</dd>`:''}
    <dt>Einstieg</dt><dd>${price(trade.entry,trade.entryDate)}</dd>
    <dt>Anfangsstopp</dt><dd>${pf(trade.initialStop)}</dd>
    <dt>Anfangsrisiko (1 R)</dt><dd>${pf(trade.initialRisk)}</dd>
    <dt>Ausstieg</dt><dd>${price(trade.exit,trade.exitDate)}</dd>
    <dt>Ergebnis vor Kosten</dt><dd>${formatR(trade.r)}</dd></dl>`;
}
function backtestSummary(run){
  const rows=[
    ['Signale oder Vergleichseinstiege','total',r=>nf(r,0)],
    ['Geschlossene Trades','closed',r=>nf(r,0)],
    ...Object.entries(tradeStatuses).map(([key,label])=>[label,key,r=>nf(r,0)]),
    ['Trefferquote (geschlossene Trades)','winRate',r=>r==null?'–':nf(r)+' %'],
    ['Durchschnitt brutto','meanR',formatR],
    ['Median brutto','medianR',formatR],
    ['Mediane Haltedauer (Handelskerzen)','medianBars',r=>nf(r)],
  ];
  return `<table class="bt-table"><thead><tr><th scope="col">Kennzahl</th>${run.results.map(r=>`<th scope="col">${esc(r.label)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(([label,key,format])=>`<tr><th scope="row">${esc(label)}</th>${run.results.map(r=>`<td>${format(r[key])}</td>`).join('')}</tr>`).join('')}</tbody></table>
    ${run.resultNote?`<p>${esc(run.resultNote)}</p>`:''}
    ${run.pairedCount?`<p>Im direkten Vergleich lag der JAC im Mittel ${formatR(run.pairedMeanR)} gegenüber seinen zugeordneten Zufallseinstiegen. ${nf(run.pairedWins,0)} von ${nf(run.pairedCount,0)} JAC-Trades lagen über ihrer Vergleichsgruppe.</p>`:''}`;
}
async function renderBacktest(){
  const panel=$('#pBacktest');
  if(!backtestData) panel.textContent='Backtests werden geladen …';
  let runs;
  try{runs=await loadBacktests();}catch(e){if(cur==='backtest') panel.textContent='Backtests konnten nicht geladen werden.';return;}
  if(cur!=='backtest') return;
  const run=runs.find(item=>String(item.id)===String(backtestRun));
  if(!run){
    panel.innerHTML=`<h1>Backtests</h1>${runs.length?`<ul class="bt-runs">${runs.map(item=>`<li><a href="#backtest=${item.id}" data-run="${item.id}"><strong>${esc(item.title)}</strong><span>${esc(item.question)}</span><small>${dDE(item.start)} bis ${dDE(item.end)} · ${nf(item.symbols,0)} Aktien</small></a></li>`).join('')}</ul>`:'<p>Es sind noch keine Backtests veröffentlicht.</p>'}`;
    panel.querySelectorAll('[data-run]').forEach(link=>link.onclick=e=>{e.preventDefault();show('backtest',link.dataset.run);});
    return;
  }
  panel.innerHTML=`<a class="legend-link" id="allBacktests" href="#backtest">← Alle Backtests</a>
    <h1>${esc(run.title)}</h1>
    <p class="note">${dDE(run.start)} bis ${dDE(run.end)} · ${nf(run.symbols,0)} Aktien</p>
    <h2>Fragestellung</h2><p>${esc(run.question)}</p><p class="note">${esc(run.method)}</p>
    <h2>Ergebnis</h2>${backtestSummary(run)}
    ${run.examples.map((group,i)=>`<section class="bt-examples"><h2>${esc(group.title)}</h2><div class="bt-grid" data-group="${i}"></div></section>`).join('')}`;
  $('#allBacktests').onclick=e=>{e.preventDefault();show('backtest');};
  run.examples.forEach((group,i)=>{
    const grid=panel.querySelector(`[data-group="${i}"]`);
    group.cards.forEach((card,k)=>grid.appendChild(structureCard(card,k)));
  });
  requestAnimationFrame(drawBacktestCards);
}

/* ---------- Navigation ---------- */
let cur='board';
function panelHash(p){
  if(p==='backtest') return backtestRun==null?'#backtest':'#backtest='+encodeURIComponent(backtestRun);
  return {legend:'#legende',tests:'#tests',custom:'#custom',rejected:'#rejected'}[p]||'';
}
function show(p,run=null){
  cur=p;
  if(p==='backtest') backtestRun=run;
  ['Board','Rejected','Backtest','Custom','Legend','Tests'].forEach(k=>{
    $('#p'+k).hidden=k.toLowerCase()!==p;
    const t=$('#tab'+k);
    if(t){const on=k.toLowerCase()===p||(k==='Legend'&&p==='tests');t.classList.toggle('on',on);t.setAttribute('aria-selected',on);}
  });
  if(p==='backtest') renderBacktest();
  if(p==='board') renderBoard();
  if(p==='legend') renderLegend();
  if(p==='tests') renderTests();
  if(p==='custom') renderCustom();
  if(p==='rejected') renderRejected();
  if(!curId) history.replaceState(null,'',location.pathname+panelHash(p));
}
async function init(){
  B=await (await fetch('data/board.json',{cache:'no-cache'})).json();
  try{B.custom=(await (await fetch('data/custom.json',{cache:'no-cache'})).json()).cards||[];}catch(e){B.custom=[];}
  try{RULES=await (await fetch('data/rules.json')).json();}catch(e){RULES={};}
  try{EXPL=await (await fetch('data/expl.json')).json();}catch(e){EXPL={};}
  setupStockSearch(B, openDetail);
  for(const p of 'ABCDE'){const v=B.cards.map(c=>c.ph[p]).filter(x=>x!=null), m=v.reduce((a,b)=>a+b,0)/v.length; SD[p]=v.length?Math.max(3,Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length)):8;}
  order=B.cards.map(c=>c.id);
  $('#sub').textContent=`Wyckoff-Akkumulationen · Scanner v5 · Testlauf · Daten bis ${dDE(B.asof)}`;
  $('#tabBoard').onclick=()=>show('board'); $('#tabBacktest').onclick=()=>show('backtest'); $('#tabLegend').onclick=()=>show('legend'); $('#tabCustom').onclick=()=>show('custom'); $('#tabRejected').onclick=()=>show('rejected');
  $('#tipToggle').onchange=e=>{tips=e.target.checked; tip();};
  $('#dFeedback').onclick=()=>$('#side').scrollIntoView({behavior:'smooth',block:'start'});
  $('#dBack').onclick=()=>closeDetail(); $('#dPrev').onclick=()=>step(-1); $('#dNext').onclick=()=>step(1);
  addEventListener('keydown',e=>{if($('#detail').hidden)return; if(e.key==='Escape')closeDetail(); if(e.key==='ArrowRight')step(1); if(e.key==='ArrowLeft')step(-1);});
  let rt; addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{if(cur==='board')$$('#pBoard .card').forEach(b=>mini(b.querySelector('canvas'),B.cards.find(c=>c.id===b.dataset.id).m)); if(cur==='rejected')renderRejected(); if(cur==='backtest')drawBacktestCards();},150);});
  addEventListener('hashchange',()=>{
    const target=decodeURIComponent(location.hash.slice(1));
    if(target.startsWith('s=')&&target.slice(2)!==curId)openDetail(target.slice(2));
    else if(target==='backtest'||target.startsWith('backtest=')){
      if(curId)closeDetail(false);
      show('backtest',target.split('=')[1]??null);
    }
  });
  const h=decodeURIComponent(location.hash.slice(1));
  if(h==='backtest'||h.startsWith('backtest=')||h.startsWith('s=bt:')){
    show('backtest',h.startsWith('s=bt:')?h.split(':')[1]:h.split('=')[1]??null);
  }else{
    show(h==='legende'?'legend':h==='tests'||h.startsWith('s=t:')||h.startsWith('s=f:')?'tests':h==='custom'||h.startsWith('s=c:')?'custom':h==='rejected'||h.startsWith('s=r:')?'rejected':'board');
  }
  if(h.startsWith('s=')) openDetail(h.slice(2));
}
init();
