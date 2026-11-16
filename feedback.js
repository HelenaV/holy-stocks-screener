/* Rückfragen mit lokalen Antwortentwürfen; keine Änderung von Scanner-Urteilen. */
(() => {
  // Freitext darf beim Rendern keine HTML-Elemente erzeugen.
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const date = value => value ? value.split('-').reverse().join('.') : '–';
  // Stabile Fallkennung und Fragenrevision trennen ältere Antwortentwürfe.
  const key = item => `holystocks-feedback:v1:${item.id}:${item.revision || 1}`;
  let items = new Map();
  const memory = new Map();
  // Liest den lokalen Entwurf; gesperrter Browserspeicher bleibt bedienbar.
  function draft(item) {
    if (memory.has(key(item))) return memory.get(key(item));
    try { return localStorage.getItem(key(item)) || ''; } catch { return ''; }
  }
  // Speichert ausschließlich in diesem Browser, ohne Netzwerkübertragung.
  function save(item, value) {
    memory.set(key(item), value);
    try { localStorage.setItem(key(item), value); return true; } catch { return false; }
  }
  // Dasselbe Antwortfeld wird in der Übersicht und im Prüfchart verwendet.
  function form(item) {
    const id = escape(item.id), value = draft(item);
    return `<div class="feedback-answer"><label>Dein Feedback<textarea data-feedback-answer="${id}" rows="3" placeholder="Kurzes Urteil, Daten oder Grenzen und ein Satz zum Grund …">${escape(value)}</textarea></label><div class="feedback-actions"><button type="button" class="ghost" data-feedback-copy="${id}"${value.trim()?'':' disabled'}>Antwort kopieren</button><span class="note" data-feedback-status="${id}" role="status">${value.trim()?'Entwurf in diesem Browser gespeichert':''}</span></div></div>`;
  }
  // Konkrete fachliche Fragen gehören direkt zum jeweiligen Chart.
  function questions(item) {
    return `<h4>Dein Blick darauf</h4><ol>${item.questions.map(question => `<li>${escape(question)}</li>`).join('')}</ol>`;
  }
  // Frühere Erwartungen und Scanner-Vergleich bleiben als solche gekennzeichnet.
  function context(item) {
    const reference=item.reference || {}, comparison=item.comparison;
    const price=value=>value==null?'offen':Number(value).toLocaleString('de-DE',{maximumFractionDigits:3});
    return `${item.originalVerdict?`<details><summary>Früheres Urteil und Referenz</summary><p>${escape(item.originalVerdict)}</p>${reference.bottom==null&&reference.creek==null?'<p class="note">Die damalige Geometrie ist nicht vollständig gespeichert. Bitte die heutige weiße Scannerzeichnung beurteilen oder die gemeinte andere Range nennen.</p>':''}<p>Referenz: Unterkante ${price(reference.bottom)}, Oberkante ${price(reference.creek)}; Beginn ${reference.start?date(reference.start):'nicht eindeutig gespeichert'}.</p>${comparison?`<p class="note">Früherer Scanner-Vergleich: ${date(comparison.start)}, Unterkante ${price(comparison.bottom)}, Oberkante ${price(comparison.creek)}. Das ist eine Vergleichszeichnung, kein bestätigtes Urteil.</p>`:''}</details>`:''}`;
  }
  // Eine Karte bündelt Anlass, Fragen, datierten Chart und Antwortentwurf.
  function card(card) {
    const item = {...card.feedback, chartId:card.id, symbol:card.sym, name:card.feedback.name};
    items.set(item.id,item);
    return `<article class="feedback-case" data-feedback-case="${escape(item.id)}"><div class="feedback-heading"><div><h3>${escape(item.name)} <small>${escape(item.symbol)}</small></h3><p class="note">Prüfstand ${date(item.cutoff)} · ${escape(item.rules.join(', '))}</p></div><button type="button" class="ghost" data-feedback-chart="${escape(card.id)}">Chart öffnen</button></div><h4>${escape(item.title)}</h4><p>${escape(item.problem)}</p><p class="feedback-current">${escape(card.scannerStatus)}</p>${questions(item)}${context(item)}${form(item)}</article>`;
  }
  // Aktuelle Widersprüche zuerst; ältere Fälle und Kalibrierungen sind aufklappbar.
  function section(payload) {
    items = new Map();
    if (!payload || !payload.cases?.length) return '';
    const groups = [...new Set(payload.cases.map(card=>card.feedback.group))];
    return `<section class="feedback-section" aria-labelledby="feedbackHeading"><h2 id="feedbackHeading">Dein Feedback wird gebraucht <small>${payload.cases.length} Charts</small></h2><p>Beginne mit den aktuellen Widersprüchen. Jeder Chart verwendet den angegebenen historischen Prüfstand und die heutigen Regeln. Die hellgrauen gestrichelten Linien und „Ref.“-Marker zeigen die gespeicherte frühere Erwartung bzw. eine ausdrücklich vorläufige Kalibrierungsmarkierung; sie bleiben auch bei verworfenen Strukturen sichtbar, soweit die Geometrie gespeichert ist. Weiße Linien gehören zur heutigen Scannerzeichnung.</p><p class="note">Deine Antwort wird nur in diesem Browser zwischengespeichert. Kopiere sie anschließend in unseren Chat, damit ich sie übernehmen kann. Ein Entwurf ändert noch kein gespeichertes Urteil.</p><div class="feedback-actions"><button type="button" class="ghost" data-feedback-copy-all>Alle Antworten kopieren</button><span class="note" data-feedback-total role="status"></span></div>${groups.map((group,index)=>`<details class="feedback-group"${index===0?' open':''}><summary>${escape(group)} <small>${payload.cases.filter(card=>card.feedback.group===group).length} Charts</small></summary><div class="feedback-grid">${payload.cases.filter(card=>card.feedback.group===group).map(card).join('')}</div></details>`).join('')}${payload.decisions?.length?`<h3 class="feedback-group">Übergreifende Entscheidungen</h3><div class="feedback-grid">${payload.decisions.map(decision=>{const item={...decision,id:'decision:'+decision.id};items.set(item.id,item);return `<article class="feedback-case"><h3>${escape(item.title)}</h3><p>${escape(item.problem)}</p>${questions(item)}${form(item)}</article>`;}).join('')}</div>`:''}<details class="feedback-owned"><summary>Bei Codex – dafür brauche ich kein neues Urteil</summary><ul>${(payload.handledByCodex||[]).map(task=>`<li><b>${escape(task.title)}:</b> ${escape(task.reason)}</li>`).join('')}</ul></details></section>`;
  }
  // Zeigt dieselben Fragen im Chart, auch wenn keine gültige Struktur vorliegt.
  function detail(packet) {
    if (!packet) return '';
    const item = items.get(packet.id) || {...packet,symbol:'',name:packet.name};
    items.set(item.id,item);
    return `<section class="feedback-case feedback-detail"><h3>Dein Feedback wird gebraucht</h3><p class="note">Historischer Prüfstand ${date(item.cutoff)} · ${item.currentAccepted?'gültiger Treffer nach heutigen Regeln':'keine gültige Struktur; eine weiße Zeichnung ist gegebenenfalls nur diagnostisch'}</p><h4>${escape(item.title)}</h4><p>${escape(item.problem)}</p>${questions(item)}${context(item)}${form(item)}</section>`;
  }
  // Zählt Entwürfe, ohne sie als fachlich geklärt oder übermittelt zu markieren.
  function refresh() {
    const count = [...items.values()].filter(item=>draft(item).trim()).length;
    document.querySelectorAll('[data-feedback-total]').forEach(element=>{element.textContent=`${count} Antwortentwürfe vorhanden`;});
  }
  // Das Kopierformat bewahrt Aktie, Prüfdatum, Fragen und die eigene Antwort.
  function text(item) {
    return `${item.name||item.title}${item.symbol?' ('+item.symbol+')':''}${item.cutoff?' · Prüfstand '+date(item.cutoff):''}\n${item.title}\n${item.questions.map((q,i)=>`${i+1}. ${q}`).join('\n')}\nMein Feedback: ${draft(item).trim()}`;
  }
  // Falls die Zwischenablage gesperrt ist, bleibt der Text manuell kopierbar.
  async function copy(value, owner, status) {
    try {
      await navigator.clipboard.writeText(value);
      status.textContent='Kopiert – bitte im Chat einfügen.';
    } catch {
      let fallback=owner.querySelector('[data-feedback-export]');
      if(!fallback){fallback=document.createElement('textarea');fallback.dataset.feedbackExport='';fallback.className='feedback-export';fallback.setAttribute('aria-label','Antworten zum Kopieren');owner.appendChild(fallback);}
      fallback.value=value;fallback.hidden=false;fallback.focus();fallback.select();
      status.textContent='Bitte den markierten Text mit ⌘C / Strg+C kopieren.';
    }
  }
  // Verbindet Felder und Navigation nach jedem Neuaufbau der Ansicht.
  function bind(container, openChart) {
    container.querySelectorAll('[data-feedback-chart]').forEach(button=>{button.onclick=()=>openChart(button.dataset.feedbackChart);});
    container.querySelectorAll('[data-feedback-answer]').forEach(field=>{field.oninput=()=>{
      const item=items.get(field.dataset.feedbackAnswer), stored=save(item,field.value);
      document.querySelectorAll('[data-feedback-answer]').forEach(other=>{if(other.dataset.feedbackAnswer===item.id && other!==field)other.value=field.value;});
      document.querySelectorAll('[data-feedback-copy]').forEach(button=>{if(button.dataset.feedbackCopy===item.id)button.disabled=!field.value.trim();});
      document.querySelectorAll('[data-feedback-status]').forEach(status=>{if(status.dataset.feedbackStatus===item.id)status.textContent=stored?'Entwurf in diesem Browser gespeichert':'Zwischenspeicherung blockiert – Antwort bitte kopieren.';});
      refresh();
    };});
    container.querySelectorAll('[data-feedback-copy]').forEach(button=>{button.onclick=()=>{
      const item=items.get(button.dataset.feedbackCopy), owner=button.closest('.feedback-case'),status=owner.querySelector('[data-feedback-status]');
      return copy(text(item),owner,status);
    };});
    container.querySelectorAll('[data-feedback-copy-all]').forEach(button=>{button.onclick=()=>{
      const answered=[...items.values()].filter(item=>draft(item).trim());
      const status=container.querySelector('[data-feedback-total]');
      if(!answered.length){status.textContent='Noch keine Antwort eingegeben.';return;}
      return copy(answered.map(text).join('\n\n'),button.parentElement,status);
    };});
    refresh();
  }
  window.HolyStocksFeedback = {section,detail,bind};
})();
