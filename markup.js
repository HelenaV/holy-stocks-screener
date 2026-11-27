(function () {
  const canvas = document.querySelector('#markupChart');
  const figure = document.querySelector('#markupFigure');
  const status = document.querySelector('#markupStatus');
  const stopInput = document.querySelector('#markupStop');
  const timeInput = document.querySelector('#markupTime');
  const percentileInput = document.querySelector('#markupPercentile');
  const results = ['Mean', 'Won', 'WithoutGain', 'Open', 'Invalid'].map(
    name => document.querySelector('#markup' + name));
  const number = new Intl.NumberFormat('de-DE');
  const rFormat = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero'
  });
  const date = new Intl.DateTimeFormat('de-DE', {dateStyle: 'medium', timeZone: 'UTC'});
  let data, request;
  let visibleSeries = [];

  function smoothCloses(bars, windowSize) {
    let sum = 0;
    return bars.map(([, , close], day) => {
      sum += close;
      if (day >= windowSize) sum -= bars[day - windowSize][2];
      // The price payload has Creek at 0. The chart uses the SC low at 0.
      return 1 + sum / Math.min(day + 1, windowSize);
    });
  }

  function exitPrice(bars, stop, time) {
    const last = bars.length - 1;
    for (let day = 1; day <= Math.min(time, last); day++) {
      const [open, low] = bars[day];
      if (low <= stop) return Math.min(open, stop);
    }
    return last >= time ? bars[time][2] : null;
  }

  function update() {
    if (!data) return;
    const stop = stopInput.valueAsNumber, time = timeInput.valueAsNumber;
    const percentile = percentileInput.valueAsNumber;
    const validStop = Number.isFinite(stop);
    const validTime = Number.isSafeInteger(time) && time >= 1;
    const validPercentile = Number.isFinite(percentile) && percentile >= 0 && percentile <= 100;
    stopInput.setAttribute('aria-invalid', !validStop);
    timeInput.setAttribute('aria-invalid', !validTime);
    percentileInput.setAttribute('aria-invalid', !validPercentile);
    visibleSeries = validPercentile
      ? data.series.filter(series => series.percentile >= percentile)
      : [];
    const shown = visibleSeries.length;
    const count = shown === data.series.length ? number.format(shown) :
      number.format(shown) + ' von ' + number.format(data.series.length);
    const symbols = new Set(visibleSeries.map(series => series.symbol)).size;
    const note = validPercentile ? count + ' Akkumulationen auf ' + number.format(symbols) +
      ' Aktien · Backtest ' + data.run + ' · Kurse bis ' + date.format(new Date(data.end)) :
      'Gib ein Perzentil von 0 bis 100 ein.';
    if (status.textContent !== note) status.textContent = note;
    let total = 0, won = 0, withoutGain = 0, open = 0, invalid = 0;
    const valid = validStop && validTime && validPercentile;
    if (valid) {
      for (const {bars} of visibleSeries) {
        const entry = bars[0][2];
        const risk = entry - stop;
        if (risk <= 0) {
          invalid++;
          continue;
        }
        const exit = exitPrice(bars, stop, time);
        if (exit === null) {
          open++;
          continue;
        }
        total += (exit - entry) / risk;
        if (exit > entry) won++;
        else withoutGain++;
      }
    }
    const closed = won + withoutGain;
    results[0].textContent = closed ? rFormat.format(total / closed) + ' R' : '—';
    [won, withoutGain, open, invalid].forEach((count, index) => {
      results[index + 1].textContent = valid ? number.format(count) : '—';
    });
    draw();
  }

  function draw() {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!data || !width || !height) return;
    const density = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    const ctx = canvas.getContext('2d');
    ctx.scale(density, density);

    let minimum = 0, maximum = 1, days = 1;
    for (const {values} of data.series) {
      minimum = Math.min(minimum, ...values);
      maximum = Math.max(maximum, ...values);
      days = Math.max(days, values.length - 1);
    }
    const stop = stopInput.valueAsNumber, time = timeInput.valueAsNumber;
    const validStop = Number.isFinite(stop);
    const validTime = Number.isSafeInteger(time) && time >= 1;
    if (validStop) {
      minimum = Math.min(minimum, stop + 1);
      maximum = Math.max(maximum, stop + 1);
    }
    if (validTime) days = Math.max(days, time);

    const left = width < 560 ? 78 : 148;
    const right = width - 20;
    const top = 36, bottom = height - 50;
    const x = day => left + day * (right - left) / days;
    // Soft compression keeps the original range visible along with extreme moves.
    const scale = value => Math.asinh((value - 0.5) / 1.5);
    const low = scale(minimum) - 0.12, high = scale(maximum) + 0.12;
    const y = value => bottom - (scale(value) - low) / (high - low) * (bottom - top);

    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Abstand zum Creek in Range-Höhen', 16, 17);
    const grid = (x1, y1, x2, y2, color) => {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    for (const tick of [-100, -50, -25, -10, -5, -2, -1, 0, 1, 2, 5, 10, 25, 50, 100]) {
      const level = tick + 1;
      if (level < minimum || level > maximum) continue;
      grid(left, y(level), right, y(level), tick === 0 ? '#7396aa' : '#2b2b2b');
      ctx.fillStyle = tick === 0 ? '#a9ccdf' : '#aaa';
      ctx.textAlign = 'right';
      const labelOffset = tick === 0 ? -9 : tick === -1 ? 9 : 0;
      ctx.fillText(tick === 0 ? 'Creek' : tick === -1 ? 'SC-Tief' :
        (tick > 0 ? '+' : '−') + number.format(Math.abs(tick)), left - 8, y(level) + labelOffset);
    }

    const boxLeft = 12;
    ctx.fillStyle = '#213039';
    ctx.fillRect(boxLeft, y(1), left - boxLeft, y(0) - y(1));
    ctx.strokeStyle = '#7396aa';
    ctx.strokeRect(boxLeft, y(1), left - boxLeft, y(0) - y(1));
    ctx.fillStyle = '#d4e4ec';
    ctx.textAlign = 'center';
    ctx.fillText(width < 560 ? 'Range' : 'Akkumulation', (boxLeft + left) / 2, y(0.5));

    // Repeat the range boundaries at the right edge of the origin box.
    grid(left, top, left, bottom, '#61727b');
    grid(left, bottom, right, bottom, '#4a4a4a');
    const tickCount = width < 560 ? 3 : 8;
    const tickUnit = width < 560 ? 50 : 100;
    const step = Math.ceil(days / (tickCount * tickUnit)) * tickUnit;
    for (let day = 0; day <= days; day += step) {
      grid(x(day), bottom, x(day), bottom + 5, '#777');
      ctx.fillStyle = '#aaa';
      ctx.fillText(number.format(day), x(day), bottom + 16);
    }
    ctx.fillText('Handelstage seit JAC-Erkennung', (left + right) / 2, bottom + 34);

    ctx.strokeStyle = 'rgba(221, 222, 225, 0.18)';
    for (const {values} of visibleSeries) {
      ctx.beginPath();
      ctx.moveTo(x(0), y(values[0]));
      for (let day = 1; day < values.length; day++) ctx.lineTo(x(day), y(values[day]));
      ctx.stroke();
    }

    const colors = getComputedStyle(canvas);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 4]);
    if (validStop) grid(left, y(stop + 1), right, y(stop + 1),
      colors.getPropertyValue('--stop-line').trim());
    if (validTime) grid(x(time), top, x(time), bottom,
      colors.getPropertyValue('--time-line').trim());
  }

  new ResizeObserver(draw).observe(canvas);
  stopInput.addEventListener('input', update);
  timeInput.addEventListener('input', update);
  percentileInput.addEventListener('input', update);
  async function show() {
    if (data) return draw();
    if (request) return request;
    status.textContent = 'Kursverläufe werden geladen …';
    request = fetch('data/markup.json?v=r2', {cache: 'no-cache'})
      .then(response => {
        if (!response.ok) throw new Error('Markup data unavailable');
        return response.json();
      })
      .then(result => {
        for (const series of result.series) {
          series.values = smoothCloses(series.bars, result.smoothingDays);
        }
        data = result;
        figure.hidden = false;
        update();
      })
      .catch(() => { status.textContent = 'Kursverläufe konnten nicht geladen werden.'; })
      .finally(() => { request = null; });
    return request;
  }

  window.HolyStocksMarkup = {show};
})();
