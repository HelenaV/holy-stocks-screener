"""Prüft den Feedbackablauf mit echten exportierten Charts und lokalen Entwürfen."""

import json
import os
from pathlib import Path
from urllib.parse import quote

from playwright.sync_api import expect, sync_playwright

base = os.environ.get('SITE_URL','http://127.0.0.1:8774/').rstrip('/')+'/'
artifacts = Path(os.environ.get('BROWSER_ARTIFACTS','/private/tmp/holystocks-feedback-browser'))
artifacts.mkdir(parents=True,exist_ok=True)
errors=[]
with sync_playwright() as playwright:
    browser=playwright.chromium.launch(executable_path=os.environ.get('CHROME_PATH','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),headless=True)
    context=browser.new_context(viewport={'width':1440,'height':1100},permissions=['clipboard-read','clipboard-write'])
    page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(base+'#tests')
    expect(page.locator('#feedbackHeading')).to_be_visible()
    board=page.request.get(base+'data/board.json').json()
    cases=board['feedback']['cases']
    expect(page.locator('#pTests [data-feedback-case]')).to_have_count(len(cases))
    assert len(cases)>=17
    page.screenshot(path=str(artifacts/'feedback-desktop.png'))
    first=cases[0];identity=first['id']
    field=page.locator('#pTests [data-feedback-answer]').first
    field.fill('Testentwurf: Range prüfen, Phase D ab 01.10. Kein fachliches Urteil.')
    field.locator('..').locator('..').get_by_role('button',name='Antwort kopieren',exact=True).click()
    copied=page.evaluate('navigator.clipboard.readText()')
    assert first['feedback']['name'] in copied and 'Prüfstand' in copied and 'Testentwurf:' in copied
    page.reload();expect(page.locator('#pTests [data-feedback-answer]').first).to_have_value('Testentwurf: Range prüfen, Phase D ab 01.10. Kein fachliches Urteil.')
    # Alle historischen Fälle öffnen, auch ohne aktuelle gültige Struktur.
    for case in cases:
        group=page.locator('#pTests .feedback-group').filter(has=page.locator(f'[data-feedback-chart="{case["id"]}"]'))
        if group.count():group.evaluate('(element)=>element.open=true')
        page.locator(f'#pTests [data-feedback-chart="{case["id"]}"]').click()
        expect(page.locator('#detail')).to_be_visible()
        expect(page.locator('#side [data-feedback-answer]')).to_have_count(0 if case['feedback'].get('status')=='resolved' else 1)
        expect(page.locator('#c0 canvas').first).to_be_visible()
        assert case['feedback']['title'] in page.locator('#side').inner_text()
        if case['feedback'].get('status')=='resolved':assert 'Dein gespeichertes Feedback' in page.locator('#side').inner_text()
        detail=page.request.get(base+'data/s/'+case['f']).json()
        assert detail['asof']<=case['feedback']['cutoff']
        assert detail['feedback']['originalVerdict']==case['feedback']['originalVerdict']
        if case['id'].startswith('f:euronext_rco:'):
            assert case['feedback']['status']=='resolved'
            expect(page.locator('#side .feedback-measurements tbody tr')).to_have_count(1)
            reference=detail['reviewOverlay']
            assert abs(reference['lo']-35.08)<0.001 and abs(reference['hi']-42.56)<0.001
            assert detail['t'][reference['i0']]=='2025-12-10'
            assert [(span['ph'],span['start'],span['end']) for span in reference['measurementSpans']]==[
                ('B','2026-01-20','2026-06-02'),('D','2026-06-03','2026-06-24')]
            expect(page.locator('#side .feedback-window-legend')).to_contain_text('B-Vergleich')
            expect(page.locator('#side .feedback-window-legend')).to_contain_text('D-Messung')
            expect(page.locator('#side .feedback-measurement-note')).to_have_attribute('open','')
            page.screenshot(path=str(artifacts/'remy-january-measurements.png'),full_page=True)
        if case['id'].startswith('f:nyse_ci:'):
            assert detail['box'] is None and detail['reviewOverlay']['hi']==281
            toggle=page.get_by_label('Referenz anzeigen (gestrichelt)')
            expect(toggle).to_be_checked()
            page.mouse.move(0,0);page.wait_for_timeout(150)
            before=page.locator('#c0').screenshot()
            toggle.uncheck();page.mouse.move(0,0);page.wait_for_timeout(150)
            after=page.locator('#c0').screenshot()
            assert before!=after,'Reference toggle must actually redraw the chart'
        page.get_by_role('button',name='← Zurück').click()
        expect(page.locator('#pTests')).to_be_visible()
    # Direkte Links gehören zum Test-Stocks-Tab und navigieren durch Feedbackfälle.
    page.goto(base+'#s='+quote(identity,safe=''))
    expect(page.locator('#side [data-feedback-answer]')).to_have_value('Testentwurf: Range prüfen, Phase D ab 01.10. Kein fachliches Urteil.')
    page.locator('#side [data-feedback-answer]').fill('Korrigierter Testentwurf')
    page.locator('#dNext').click();expect(page).to_have_url(base+'#s='+quote(cases[1]['id'],safe=''))
    page.get_by_role('button',name='← Zurück').click()
    expect(page.locator('#pTests [data-feedback-answer]').first).to_have_value('Korrigierter Testentwurf')
    page.get_by_role('button',name='Alle Antworten kopieren').click()
    assert 'Korrigierter Testentwurf' in page.evaluate('navigator.clipboard.readText()')
    # Mobiler Abschnitt: keine abgeschnittenen Eingabefelder oder seitliches Layout.
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(artifacts/'feedback-mobile.png'))
    assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1')
    first_case=page.locator('#pTests .feedback-case').first
    first_case.get_by_role('button',name='Chart öffnen').click()
    expect(page.locator('#side [data-feedback-answer]')).to_be_visible()
    assert not errors,errors
    print(json.dumps(dict(result='passed',charts=len(cases),drafts_survive_reload=True,clipboard=True,rejected_reference_visible=True,mobile=True,page_errors=errors)))
    browser.close()
