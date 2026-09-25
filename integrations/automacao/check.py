"""Offline behavioral checks of the committed send method with browser doubles.
No Selenium imports, browser, network, contacts, or module-level execution.
"""
import ast
import json
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

scenario = sys.argv[1]
tree = ast.parse(Path('rdstation_whatsapp_automation.py').read_text())
cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'RDStationWhatsAppBot')
method = next(n for n in cls.body if isinstance(n, ast.FunctionDef) and n.name == 'enviar_mensagem_whatsapp')
namespace = dict(time=SimpleNamespace(sleep=lambda _: None), logger=Mock(),
    By=SimpleNamespace(XPATH='xpath', CSS_SELECTOR='css'),
    Keys=SimpleNamespace(SHIFT='SHIFT', ENTER='ENTER'),
    EC=SimpleNamespace(presence_of_element_located=lambda x: x))
exec(compile(ast.fix_missing_locations(ast.Module(body=[method], type_ignores=[])), '<committed-send-method>', 'exec'), namespace)
box = Mock()
driver = Mock()
driver.window_handles = ['crm', 'chat']
driver.current_url = 'https://web.whatsapp.com/'
driver.page_source = '<div>Offline: message not delivered</div>'
driver.find_element.side_effect = RuntimeError('No error dialog')
wait = Mock()
wait.until.return_value = box
if scenario == 'invalid-number':
    driver.page_source = 'Phone number shared via url is invalid'
    driver.find_element.side_effect = None
elif scenario == 'missing-textbox':
    wait.until.side_effect = RuntimeError('No composer')
elif scenario == 'wrong-destination':
    driver.current_url = 'https://crm.rdstation.com/app/deals/pipeline'
    driver.window_handles = ['crm']
    driver.page_source = '<div contenteditable="true" data-tab="10">CRM editor</div>'
elif scenario != 'unconfirmed-delivery':
    raise ValueError('Unknown scenario')
bot = SimpleNamespace(driver=driver, wait=wait, mensagem_padrao='SYNTHETIC QA MESSAGE')
result = namespace['enviar_mensagem_whatsapp'](bot)
sent = any(call.args == ('ENTER',) for call in box.send_keys.call_args_list)
expected = 'Return False and do not type into the composer' if scenario != 'unconfirmed-delivery' else 'Do not report confirmed success without a delivery observation'
passed = (result is False and not sent) if scenario != 'unconfirmed-delivery' else result is not True
print(json.dumps(dict(scenario=scenario, expected=expected, returned=result,
    enter_attempted=sent, browser='simulated', external_messages=0,
    outcome='PASS' if passed else 'FAIL'), ensure_ascii=False))
assert passed, f'{scenario}: expected {expected}; returned={result}, Enter attempted={sent}'
