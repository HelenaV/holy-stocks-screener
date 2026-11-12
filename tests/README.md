# Browserprüfung der Aktiensuche

Benötigt Python 3.9+, Playwright und lokal installiertes Chrome. Installation in
separater Testumgebung: `python -m pip install -r tests/requirements-browser.txt`.
Website lokal mit `python -m http.server 8765 --bind 127.0.0.1` starten, danach
`python tests/browser_search.py` ausführen. `SITE_URL` kann stattdessen die
veröffentlichte Website angeben, `CHROME_PATH` einen anderen Chrome-Pfad.
`BROWSER_ARTIFACTS` bestimmt den Screenshot-Ordner (Standard `/tmp/holystocks-browser`).

Prüft Namen/Kürzel, zusammengefasste Mehrfacheinträge, alle vier Datenquellen,
Tastaturbedienung, leere Treffer, Löschen, unverändertes Board, mobile Suche und
Öffnen des Halma-Charts. Halma ist dafür ein bewusst gewählter Review-Fall.
Die Prüfung ist kein fachliches Urteil über die erkannte Akkumulation.
