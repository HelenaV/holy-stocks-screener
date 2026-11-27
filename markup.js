(function () {
  const canvas = document.querySelector('#markupChart');
  const figure = document.querySelector('#markupFigure');
  const status = document.querySelector('#markupStatus');
  const number = new Intl.NumberFormat('de-DE');
  const date = new Intl.DateTimeFormat('de-DE', {dateStyle: 'medium', timeZone: 'UTC'});
  let data, request;

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
    const step = width < 560 ? 250 : 100;
    for (let day = 0; day <= days; day += step) {
      grid(x(day), bottom, x(day), bottom + 5, '#777');
      ctx.fillStyle = '#aaa';
      ctx.fillText(number.format(day), x(day), bottom + 16);
    }
    ctx.fillText('Handelstage seit JAC-Erkennung', (left + right) / 2, bottom + 34);

    ctx.strokeStyle = 'rgba(221, 222, 225, 0.18)';
    for (const {values} of data.series) {
      ctx.beginPath();
      ctx.moveTo(x(0), y(values[0]));
      for (let day = 1; day < values.length; day++) ctx.lineTo(x(day), y(values[day]));
      ctx.stroke();
    }
  }

  new ResizeObserver(draw).observe(canvas);
  async function show() {
    if (data) return draw();
    if (request) return request;
    status.textContent = 'Kursverläufe werden geladen …';
    request = fetch('data/markup.json', {cache: 'no-cache'})
      .then(response => {
        if (!response.ok) throw new Error('Markup data unavailable');
        return response.json();
      })
      .then(result => {
        data = result;
        status.textContent = number.format(data.series.length) + ' Akkumulationen auf ' +
          number.format(data.symbols) + ' Aktien · Backtest ' + data.run +
          ' · Kurse bis ' + date.format(new Date(data.end));
        figure.hidden = false;
        draw();
      })
      .catch(() => { status.textContent = 'Kursverläufe konnten nicht geladen werden.'; })
      .finally(() => { request = null; });
    return request;
  }

  window.HolyStocksMarkup = {show};
})();
