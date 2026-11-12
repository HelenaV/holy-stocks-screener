import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = os.environ.get("SITE_URL", "http://127.0.0.1:8765/").rstrip("/") + "/"
chrome = os.environ.get(
    "CHROME_PATH", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
)
artifacts = Path(os.environ.get("BROWSER_ARTIFACTS", "/tmp/holystocks-browser"))
artifacts.mkdir(parents=True, exist_ok=True)
errors = []
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=chrome, headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(base)
    query = page.get_by_role("combobox", name="Aktie suchen")
    expect(query).to_be_enabled()
    original = page.locator("#pBoard").inner_html()
    for value in ["Halma", "hlma", "HLMA.L", "LSE:HLMA", "halma plc"]:
        query.fill(value)
        expect(page.get_by_role("option")).to_have_count(
            1 if value == "LSE:HLMA" else 2
        )
        expect(page.get_by_role("option").first).to_contain_text("Halma")
    assert page.locator("#pBoard").inner_html() == original
    query.press("ArrowDown")
    expect(page.get_by_role("option").first).to_have_attribute("aria-selected", "true")
    query.press("Enter")
    expect(page.locator("#detail")).to_be_visible()
    expect(page.locator("#dName")).to_contain_text("Halma")
    expect(page.locator("#c0 canvas").first).to_be_visible()
    page.screenshot(path=str(artifacts / "halma.png"))
    page.get_by_role("button", name="← Zurück").click()
    query.fill("Halma")
    page.get_by_role("option").filter(has_not_text="Prüfstand").click()
    expect(page.locator("#dName")).to_contain_text("Halma")
    expect(page.locator("#dMeta")).not_to_contain_text("Prüfstand")
    page.get_by_role("button", name="← Zurück").click()
    query.fill("xyz-nothing-98765")
    expect(page.get_by_role("status")).to_contain_text("Keine Aktie gefunden")
    query.press("Enter")
    expect(page.locator("#detail")).to_be_hidden()
    page.get_by_role("button", name="Suche leeren").click()
    expect(query).to_have_value("")
    expect(page.locator("#stockResults")).to_be_hidden()
    query.fill("Halma")
    query.press("Escape")
    expect(page.locator("#stockResults")).to_be_hidden()
    query.press("ArrowUp")
    expect(page.get_by_role("option").last).to_have_attribute("aria-selected", "true")
    page.get_by_role("option").filter(has_text="Prüfstand").click()
    expect(page.locator("#dName")).to_contain_text("Halma")
    page.get_by_role("button", name="← Zurück").click()
    # Alle Bereiche sind durchsuchbar, einschließlich Charts außerhalb des Boards.
    board = page.request.get(base + "data/board.json").json()
    custom = page.request.get(base + "data/custom.json").json()["cards"]
    for label, cards in [
        ("Board", board["cards"]),
        ("Review", board.get("review", [])),
        ("Test-Stocks", board.get("tests", [])),
        ("Custom", custom),
    ]:
        card = next(card for card in cards if card.get("f"))
        query.fill(card["id"].removeprefix("t:").removeprefix("c:"))
        expect(page.get_by_role("option").filter(has_text=label).first).to_be_visible()
    page.set_viewport_size({"width": 390, "height": 844})
    query.fill("Halma")
    expect(page.get_by_role("option").first).to_be_visible()
    box = page.locator("#stockResults").bounding_box()
    assert box["x"] >= 0 and box["x"] + box["width"] <= 390, box
    page.screenshot(path=str(artifacts / "search-mobile.png"))
    page.get_by_role("option").filter(has_text="Prüfstand").click()
    expect(page.locator("#dName")).to_contain_text("Halma")
    expect(page.locator("#dMeta")).to_contain_text("Prüfstand 02.11.2026")
    expect(page.locator("#side")).to_contain_text("Gespeichertes Urteil")
    expect(page.locator("#side")).to_contain_text("Spring-Typ ungeklärt")
    assert not errors, errors
    print(
        json.dumps(
            {
                "result": "passed",
                "site": base,
                "checks": [
                    "name/ticker/aliases",
                    "deduplication",
                    "board unchanged",
                    "keyboard",
                    "click",
                    "clear",
                    "no result",
                    "all sections",
                    "mobile",
                    "Halma chart",
                ],
                "page_errors": errors,
            }
        )
    )
    browser.close()
