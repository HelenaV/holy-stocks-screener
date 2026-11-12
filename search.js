/* Aktien aus allen verfügbaren Ansichten finden; die Board-Reihenfolge bleibt unverändert. */
function setupStockSearch(board, openChart) {
  const container = document.querySelector('#stockSearch');
  const input = document.querySelector('#stockQuery');
  const clearButton = document.querySelector('#stockClear');
  const results = document.querySelector('#stockResults');
  const status = document.querySelector('#stockSearchStatus');
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('de').trim();
  const entries = new Map();

  // Mehrfach vorhandene Aktien gemeinsam aufführen; der reguläre Chart hat Vorrang.
  for (const [key, label] of [['cards', 'Board'], ['review', 'Review'], ['tests', 'Test-Stocks'], ['custom', 'Custom']]) {
    for (const card of board[key] || []) {
      if (!card.f) continue; // Ohne Detaildatei kann die Suche keinen Chart öffnen.
      const ticker = String(card.id).replace(/^[tc]:/, '');
      let entry = entries.get(ticker);
      if (!entry) {
        entry = {id: card.id, ticker, name: card.name || card.sym || ticker, symbol: card.sym || ticker, referenceDate: card.reference_date, labels: [], aliases: new Set()};
        entries.set(ticker, entry);
      }
      if (!entry.labels.includes(label)) entry.labels.push(label);
      for (const value of [ticker, card.sym, card.name]) entry.aliases.add(normalize(value));
    }
  }
  let matches = [];
  let activeIndex = -1;

  function hideResults() {
    results.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    activeIndex = -1;
  }

  function highlight(index) {
    activeIndex = index;
    [...results.children].forEach((option, optionIndex) => option.setAttribute('aria-selected', String(optionIndex === index)));
    const option = results.children[index];
    if (option) {
      input.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({block: 'nearest'});
    }
  }

  function choose(entry) {
    hideResults();
    openChart(entry.id);
  }

  function renderResults() {
    const query = normalize(input.value);
    clearButton.hidden = !input.value;
    results.replaceChildren();
    hideResults();
    if (!query) { status.textContent = ''; matches = []; return; }
    const words = query.split(/\s+/);
    // Exakte Kürzel zuerst, danach Namen alphabetisch; keine fachliche Neubewertung.
    const found = [...entries.values()].filter(entry => words.every(word => [...entry.aliases].some(alias => alias.includes(word))));
    found.sort((left, right) => Number(right.aliases.has(query)) - Number(left.aliases.has(query)) || left.name.localeCompare(right.name, 'de'));
    matches = found.slice(0, 30);
    status.textContent = found.length ? `${found.length} Treffer${found.length > 30 ? ' · erste 30 angezeigt, bitte Suche verfeinern' : ''}` : 'Keine Aktie gefunden. Gesucht wird in den verfügbaren Charts.';
    for (const [index, entry] of matches.entries()) {
      const option = document.createElement('li');
      option.id = `stock-result-${index}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      const name = document.createElement('strong');
      name.textContent = entry.name + (entry.referenceDate ? ' · Prüfstand ' + entry.referenceDate.split('-').reverse().join('.') : '');
      const detail = document.createElement('span');
      detail.textContent = `${entry.symbol} · ${entry.ticker} · ${entry.labels.join(', ')}`;
      option.append(name, detail);
      // Fokus bleibt im Suchfeld, sodass Pfeiltasten und Enter weiter funktionieren.
      option.addEventListener('mousedown', event => event.preventDefault());
      option.addEventListener('click', () => choose(entry));
      results.append(option);
    }
    results.hidden = !matches.length;
    input.setAttribute('aria-expanded', String(matches.length > 0));
  }

  input.addEventListener('input', renderResults);
  input.addEventListener('focus', renderResults);
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { hideResults(); return; }
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      if (results.hidden) renderResults();
      if (matches.length) highlight((activeIndex + (event.key === 'ArrowDown' ? 1 : activeIndex < 0 ? 0 : -1) + matches.length) % matches.length);
    }
    if (event.key === 'Enter' && !results.hidden && matches.length) {
      event.preventDefault();
      choose(matches[Math.max(0, activeIndex)]);
    }
  });
  clearButton.addEventListener('click', () => { input.value = ''; input.focus(); renderResults(); });
  container.addEventListener('focusout', event => { if (!container.contains(event.relatedTarget)) hideResults(); });
  document.addEventListener('click', event => { if (!container.contains(event.target)) hideResults(); });
  input.disabled = false;
  input.placeholder = 'Name oder Kürzel, z. B. Halma';
}
