"""Regression checks for the supplied dual-company invoice CRM.

These checks use the server fixture and Chromium helper from test_invoice_app.py.
They intentionally use synthetic customer data only.
"""
from playwright.sync_api import sync_playwright
from test_invoice_app import base_url, chromium


def test_company_switch_and_twenty_designs(base_url):
    with sync_playwright() as playwright:
        browser = chromium(playwright)
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(base_url, wait_until="domcontentloaded")
        page.locator("#company").wait_for()

        assert page.locator("#company option").count() == 2
        assert page.locator("button.design-card").count() == 20

        for company in ("smiso", "amantusi", "smiso"):
            page.locator("#company").select_option(company)
            assert page.locator("#company").input_value() == company

        for code in ("d01", "d09", "d20"):
            page.locator(f'button.design-card[data-code="{code}"]').click()
            assert page.locator("#paper").get_attribute("data-design") == code
            assert page.locator(f'button.design-card[data-code="{code}"]').get_attribute("aria-pressed") == "true"

        assert not errors, f"Unexpected JS exceptions: {errors}"
        browser.close()


def test_distinct_company_invoice_records(base_url):
    with sync_playwright() as playwright:
        browser = chromium(playwright)
        context = browser.new_context()
        page = context.new_page()
        page.goto(base_url, wait_until="domcontentloaded")
        page.locator("#client").wait_for()

        for company, client in (
            ("smiso", "Regression Smiso Customer"),
            ("amantusi", "Regression Amantusi Customer"),
        ):
            page.locator("#company").select_option(company)
            page.locator("#client").fill(client)
            page.locator("#service").fill("Synthetic test service")
            page.locator("#save").click()
            page.wait_for_timeout(200)

        page.reload(wait_until="domcontentloaded")
        page.locator("#crmRows").wait_for()
        rows = page.locator("#crmRows").inner_text()
        assert "Regression Smiso Customer" in rows
        assert "Regression Amantusi Customer" in rows
        browser.close()
