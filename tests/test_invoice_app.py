"""Browser smoke tests for the dual-company invoice app."""
import functools
import os
import pathlib
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

import pytest
from playwright.sync_api import sync_playwright


@pytest.fixture(scope='module')
def base_url():
    if os.getenv('INVOICE_TEST_URL'):
        yield os.environ['INVOICE_TEST_URL']
        return
    root = pathlib.Path(__file__).resolve().parents[1]

    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(root)))
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        yield f'http://127.0.0.1:{server.server_address[1]}/'
    finally:
        server.shutdown()
        server.server_close()


def chromium(playwright):
    return playwright.chromium.launch(
        headless=True,
        executable_path=os.getenv('CHROMIUM_PATH') or None,
        args=['--no-sandbox'],
    )


def test_editor_crm_designs_and_persistence(base_url):
    errors = []
    with sync_playwright() as playwright:
        browser = chromium(playwright)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base_url, wait_until='domcontentloaded')
        page.locator('#client').wait_for()
        assert page.title() == 'Dual Company Invoice Engine — 20 Premium Designs'
        assert page.locator('button.design-card').count() == 20
        assert page.locator('#company option').count() == 2
        assert page.locator('#tabCRM').is_visible()
        assert page.locator('#ref').input_value()
        page.locator('#client').fill('Sample Customer - Test')
        page.locator('#service').fill('Test rental service')
        page.locator('#itemEditors textarea').first.fill('Equipment hire for testing')
        page.locator('#save').click()
        page.wait_for_timeout(300)
        assert 'Sample Customer - Test' in (page.locator('#records').text_content() or '')
        page.reload(wait_until='domcontentloaded')
        page.wait_for_timeout(400)
        assert 'Sample Customer - Test' in (page.locator('#records').text_content() or '')
        assert not errors, f'JavaScript runtime errors: {errors}'
        browser.close()


def test_mobile_controls_and_print_styles(base_url):
    with sync_playwright() as playwright:
        browser = chromium(playwright)
        page = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        page.goto(base_url, wait_until='domcontentloaded')
        assert page.locator('#company').count() == 1
        assert page.locator('#mobilePDF').count() == 1
        assert page.locator('#mobileSave').count() == 1
        assert page.locator('#paper').count() == 1
        browser.close()
