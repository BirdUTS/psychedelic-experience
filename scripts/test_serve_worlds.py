import contextlib, http.client, io, os, threading, unittest, sys, pathlib
from http.server import ThreadingHTTPServer
from unittest import mock
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import serve_worlds as sw

GOOD_STATE = {'scene': 'swarm', 'sceneAge': 12.3, 'arc': {'name': 'tidal', 'waypoint': 2},
              'features': {'E_mean30': .5, 'E_trend': .1, 'C_mean30': .7, 'B_mean30': .4, 'A_mean30': .2, 'bpm': 108},
              'initiative': {'I': .3, 'locked': False, 'I0': .3}, 'locks': {'scene': False},
              'userText': '', 'recentDecisions': [], 'online': True}


class ServeWorlds(unittest.TestCase):
    def test_questions_cover_the_spec(self):
        q = sw.build_questions(GOOD_STATE)
        self.assertEqual(set(q), {'hold', 'scene', 'energy', 'entropy', 'symmetry', 'palette', 'initiative', 'mood', 'view'})
        self.assertEqual(q['view']['type'], 'choice'); self.assertEqual(set(q['view']['criteria']), set(sw.VIEWS))
        self.assertEqual(q['mood']['type'], 'choice'); self.assertEqual(set(q['mood']['criteria']), set(sw.MOODS))
        self.assertEqual(sw.MOODS, ['clear', 'dream', 'melt', 'electric', 'holy'])
        self.assertEqual(q['hold']['type'], 'noul'); self.assertEqual(q['scene']['type'], 'choice')
        self.assertEqual(len(q['energy']['criteria']), 5); self.assertEqual(len(q['symmetry']['criteria']), 5)
        self.assertEqual(set(q['scene']['criteria']), set(sw.SCENES))
        q2 = sw.build_questions({**GOOD_STATE, 'userText': 'slower please'})
        self.assertIn('request', q2); self.assertEqual(set(q2['request']['criteria']), set(sw.REQUESTS))

    def test_state_validation(self):
        sw.validate_state(GOOD_STATE)
        for bad in [{'scene': 'lenia'}, {'userText': 'x' * 181},
                    {'features': {**GOOD_STATE['features'], 'E_mean30': 1.5}},
                    {'initiative': {'I': 2, 'locked': False, 'I0': .3}}]:
            with self.assertRaises(ValueError):
                sw.validate_state({**GOOD_STATE, **bad})

    def test_map_answers(self):
        answers = {'hold': {'type': 'noul', 'noul': .7},
                   'scene': {'type': 'choice', 'choice': 'boids', 'probabilities': {'physarum': .1, 'swarm': .2, 'boids': .62, 'life': .08}, 'confidence': .62},
                   'energy': {'type': 'score', 'score': 3.0, 'probabilities': {}, 'legend': {}, 'confidence': .8},
                   'entropy': {'type': 'score', 'score': 2.0, 'probabilities': {}, 'legend': {}, 'confidence': .3},
                   'symmetry': {'type': 'score', 'score': 3, 'probabilities': {}, 'legend': {}, 'confidence': .9},
                   'palette': {'type': 'choice', 'choice': 'ember', 'probabilities': {'ember': 1}, 'confidence': .7},
                   'initiative': {'type': 'choice', 'choice': 'lead', 'probabilities': {'lead': .5}, 'confidence': .5},
                   'mood': {'type': 'choice', 'choice': 'melt', 'probabilities': {'melt': .8}, 'confidence': .8},
                   'view': {'type': 'choice', 'choice': 'satellite', 'probabilities': {'satellite': .7}, 'confidence': .7}}
        d = sw.map_answers(answers, 4)
        self.assertEqual(d['version'], 4); self.assertAlmostEqual(d['hold'], .7)
        self.assertEqual(d['scene'], {'choice': 'boids', 'p': .62}); self.assertAlmostEqual(d['energy'], .75)
        self.assertEqual(d['symmetry'], 6); self.assertEqual(d['palette'], 'ember'); self.assertEqual(d['initiative'], 'lead')
        self.assertAlmostEqual(d['confidence']['entropy'], .3)
        self.assertEqual(d['mood'], 'melt'); self.assertAlmostEqual(d['confidence']['mood'], .8)
        self.assertEqual(d['view'], 'satellite')
        for bad in [('palette', {'type': 'choice', 'choice': 'puce', 'probabilities': {}, 'confidence': .9}),
                    ('symmetry', {'type': 'score', 'score': 7, 'probabilities': {}, 'legend': {}, 'confidence': .9}),
                    ('hold', {'type': 'noul', 'noul': 2}),
                    ('mood', {'type': 'choice', 'choice': 'angry', 'probabilities': {}, 'confidence': .9}),
                    ('view', {'type': 'choice', 'choice': 'helicopter', 'probabilities': {}, 'confidence': .9})]:
            with self.assertRaises(ValueError):
                sw.map_answers({**answers, bad[0]: bad[1]}, 4)

    def test_log_message_tolerates_non_string_args(self):
        # send_error logs ('code %d, message %s', HTTPStatus, str): the handler's filter must not assume a string.
        from http import HTTPStatus
        h = sw.Handler.__new__(sw.Handler); h.client_address = ('127.0.0.1', 1)
        import io, contextlib
        with contextlib.redirect_stderr(io.StringIO()) as err:
            h.log_message('code %d, message %s', HTTPStatus.NOT_FOUND, 'File not found')
            h.log_message('"%s" %s %s', 'GET /api/decide HTTP/1.1', '200', '-')
            h.log_message('"%s" %s %s', 'GET /immersive/ HTTP/1.1', '200', '-')
        logged = err.getvalue()
        self.assertIn('/api/decide', logged); self.assertNotIn('/immersive/', logged)


TOKEN = 'test-invite-token-0123456789'
HOSTED_KEYS = ('FLOW_PASSCODE', 'ALLOWED_HOSTS', 'COOKIE_SECURE', 'RENDER_EXTERNAL_HOSTNAME')


@contextlib.contextmanager
def serving(**env):
    """Run the real handler on an ephemeral loopback port under the given environment; yield the port."""
    with mock.patch.dict(os.environ, env), contextlib.redirect_stderr(io.StringIO()):
        for key in HOSTED_KEYS:
            if key not in env:
                os.environ.pop(key, None)
        server = ThreadingHTTPServer(('127.0.0.1', 0), sw.Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            yield server.server_address[1]
        finally:
            server.shutdown(); server.server_close()


def call(port, method, path, headers=None, body=None):
    conn = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
    conn.request(method, path, body=body, headers=headers or {})
    r = conn.getresponse(); data = r.read(); conn.close()
    return r.status, {k.lower(): v for k, v in r.getheaders()}, data


def get(port, path, headers=None):
    return call(port, 'GET', path, headers)


def post(port, path, headers=None, body=b'{}'):
    return call(port, 'POST', path, headers, body)


class HostedMode(unittest.TestCase):
    """The same server behind Render: an invite link gates the whole site, Host is checked, cookies are Secure."""

    def test_root_redirects_to_the_app(self):
        with serving() as port:
            status, h, _ = get(port, '/')
        self.assertEqual(status, 302); self.assertEqual(h['location'], '/immersive/')

    def test_gate_off_without_invite_serves_the_app(self):
        with serving() as port:
            status, _, _ = get(port, '/immersive/')
        self.assertEqual(status, 200)

    def test_gate_shows_a_visitor_without_the_invite_the_passcode_door(self):
        with serving(FLOW_PASSCODE=TOKEN) as port:
            status, h, body = get(port, '/immersive/')
            api, _, _ = post(port, '/api/decide')
        self.assertEqual(status, 403); self.assertNotIn('set-cookie', h)
        self.assertIn(b'action="/enter"', body); self.assertIn(b'name="code"', body); self.assertIn('密碼'.encode(), body)
        self.assertEqual(api, 403)

    def test_invite_link_sets_a_cookie_and_drops_the_token_from_the_url(self):
        with serving(FLOW_PASSCODE=TOKEN) as port:
            status, h, _ = get(port, '/immersive/?k=' + TOKEN)
        self.assertEqual(status, 302); self.assertEqual(h['location'], '/immersive/')
        cookie = h['set-cookie']
        self.assertTrue(cookie.startswith('flow_invite='), cookie)
        for attr in ('HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age='):
            self.assertIn(attr, cookie)
        self.assertNotIn(TOKEN, cookie)      # the cookie never carries the shareable token itself
        self.assertNotIn('Secure', cookie)   # plain http on loopback

    def test_invite_link_on_the_root_lands_in_the_app(self):
        with serving(FLOW_PASSCODE=TOKEN) as port:
            status, h, _ = get(port, '/?k=' + TOKEN)
        self.assertEqual(status, 302); self.assertEqual(h['location'], '/immersive/'); self.assertIn('set-cookie', h)

    def test_cookie_from_the_invite_opens_the_app_and_the_api(self):
        with serving(FLOW_PASSCODE=TOKEN) as port:
            _, h, _ = get(port, '/immersive/?k=' + TOKEN)
            cookie = h['set-cookie'].split(';')[0]
            status, _, _ = get(port, '/immersive/', {'Cookie': cookie})
            api, _, _ = post(port, '/api/decide', {'Cookie': cookie})
        self.assertEqual(status, 200)
        self.assertEqual(api, 400)   # past the gate, the usual request validation answers

    def test_wrong_or_stale_invite_is_refused(self):
        with serving(FLOW_PASSCODE=TOKEN) as port:
            wrong, h, _ = get(port, '/immersive/?k=' + TOKEN[:-1])
            stale, _, _ = get(port, '/immersive/', {'Cookie': 'flow_invite=deadbeef'})
        self.assertEqual(wrong, 403); self.assertNotIn('set-cookie', h); self.assertEqual(stale, 403)

    def test_cookie_is_secure_behind_the_tls_proxy(self):
        with serving(FLOW_PASSCODE=TOKEN) as port:
            _, h, _ = get(port, '/immersive/?k=' + TOKEN, {'X-Forwarded-Proto': 'https'})
        self.assertIn('Secure', h['set-cookie'])
        self.assertIn('strict-transport-security', h)

    def test_allowed_hosts_rejects_other_hosts(self):
        with serving(ALLOWED_HOSTS='flow.birdview.hk') as port:
            other, _, _ = get(port, '/immersive/', {'Host': 'evil.example'})
            loop, _, _ = get(port, '/immersive/')   # once hosts are configured, the bare address is no longer one of them
            ok, _, _ = get(port, '/immersive/', {'Host': 'Flow.Birdview.hk'})
        self.assertEqual(other, 403); self.assertEqual(loop, 403); self.assertEqual(ok, 200)

    def test_render_external_hostname_is_allowed(self):
        with serving(ALLOWED_HOSTS='flow.birdview.hk', RENDER_EXTERNAL_HOSTNAME='flow-with-mind.onrender.com') as port:
            status, _, _ = get(port, '/immersive/', {'Host': 'flow-with-mind.onrender.com'})
        self.assertEqual(status, 200)

    def test_local_default_hosts_are_loopback_on_the_bound_port(self):
        with serving() as port:
            ok, _, _ = get(port, '/immersive/', {'Host': f'localhost:{port}'})
            other, _, _ = get(port, '/immersive/', {'Host': 'evil.example'})
        self.assertEqual(ok, 200); self.assertEqual(other, 403)

    def test_static_responses_carry_nosniff_and_no_referrer(self):
        with serving() as port:
            _, h, _ = get(port, '/immersive/')
        self.assertEqual(h.get('x-content-type-options'), 'nosniff'); self.assertEqual(h.get('referrer-policy'), 'no-referrer')

    def test_public_bind_needs_hosts_but_opens_without_a_passcode(self):
        with mock.patch.dict(os.environ, {'ALLOWED_HOSTS': '', 'FLOW_PASSCODE': ''}):
            sw.check_public_config('127.0.0.1')   # loopback never needs them
            with self.assertRaises(SystemExit):
                sw.check_public_config('0.0.0.0')
        with mock.patch.dict(os.environ, {'ALLOWED_HOSTS': 'flow.birdview.hk', 'FLOW_PASSCODE': ''}):
            sw.check_public_config('0.0.0.0')     # Bird's choice (2026-11-02): no passcode, the address is enough
            self.assertFalse(sw.gate_enabled())
        with mock.patch.dict(os.environ, {'ALLOWED_HOSTS': 'flow.birdview.hk', 'FLOW_PASSCODE': TOKEN}):
            sw.check_public_config('0.0.0.0')
            self.assertTrue(sw.gate_enabled())

    def test_the_old_invite_variable_no_longer_gates_anything(self):
        with mock.patch.dict(os.environ, {'FLOW_INVITE': TOKEN, 'FLOW_PASSCODE': ''}):
            self.assertFalse(sw.gate_enabled())


if __name__ == '__main__':
    unittest.main()


STATUS_ANSWERS = {'hold': {'type': 'noul', 'noul': .4},
                  'scene': {'type': 'choice', 'choice': 'physarum', 'probabilities': {'physarum': .9}, 'confidence': .9},
                  'energy': {'type': 'score', 'score': 1.7, 'probabilities': {}, 'legend': {}, 'confidence': .6},
                  'entropy': {'type': 'score', 'score': 1.6, 'probabilities': {}, 'legend': {}, 'confidence': .4},
                  'symmetry': {'type': 'score', 'score': 1, 'probabilities': {}, 'legend': {}, 'confidence': .2},
                  'palette': {'type': 'choice', 'choice': 'silk', 'probabilities': {'silk': .8}, 'confidence': .8},
                  'initiative': {'type': 'choice', 'choice': 'lead', 'probabilities': {'lead': .1}, 'confidence': .1},
                  'request': {'type': 'choice', 'choice': 'slower', 'probabilities': {'slower': .97}, 'confidence': .97},
                  'mood': {'type': 'choice', 'choice': 'dream', 'probabilities': {'dream': .6}, 'confidence': .6},
                  'view': {'type': 'choice', 'choice': 'distant', 'probabilities': {'distant': .3}, 'confidence': .3}}


class StatusPage(unittest.TestCase):
    """GET /api/decide (a browser's address bar) is a status page: one real question to JEV, answered in plain words."""

    def test_get_decide_asks_jev_once_and_shows_the_answer(self):
        with mock.patch.object(sw, 'load_key', return_value='k'), \
             mock.patch.object(sw, 'ask_jev', return_value={'answers': STATUS_ANSWERS}) as asked, serving() as port:
            status, h, body = get(port, '/api/decide')
        self.assertEqual(status, 200)
        self.assertTrue(h['content-type'].startswith('text/html'))
        self.assertEqual(h['cache-control'], 'no-store')
        text = body.decode()
        self.assertIn('slower', text); self.assertIn('97%', text); self.assertIn('秒', text)
        asked.assert_called_once()
        self.assertEqual(asked.call_args.args[1]['userText'], sw.STATUS_SAMPLE['userText'])
        self.assertTrue(sw.STATUS_SAMPLE['userText'])   # a request question only exists when the sample says something

    def test_get_decide_without_a_key_says_so_and_asks_nothing(self):
        with mock.patch.object(sw, 'load_key', return_value=None), \
             mock.patch.object(sw, 'ask_jev') as asked, serving() as port:
            status, _, body = get(port, '/api/decide')
        self.assertEqual(status, 503)
        self.assertIn('沒有', body.decode())
        asked.assert_not_called()

    def test_get_decide_reports_a_jev_failure(self):
        from urllib import error as urlerror
        boom = urlerror.HTTPError('https://api.typesafe.ai/v1/systemone', 502, 'bad gateway', {}, None)
        with mock.patch.object(sw, 'load_key', return_value='k'), \
             mock.patch.object(sw, 'ask_jev', side_effect=boom), serving() as port:
            status, _, body = get(port, '/api/decide')
        self.assertEqual(status, 503)
        self.assertIn('502', body.decode())

    def test_status_page_stays_behind_the_invite_gate(self):
        with mock.patch.object(sw, 'ask_jev') as asked, serving(FLOW_PASSCODE=TOKEN) as port:
            status, _, _ = get(port, '/api/decide')
        self.assertEqual(status, 403)
        asked.assert_not_called()


FORM = {'Content-Type': 'application/x-www-form-urlencoded'}


def knock(port, code, ip=None):
    headers = dict(FORM)
    if ip:
        headers['X-Forwarded-For'] = ip
    return post(port, '/enter', headers, f'code={code}'.encode())


class Door(unittest.TestCase):
    """The passcode door: the same cookie as the invite link, typed at the page instead of carried in the URL."""

    def setUp(self):
        sw.door_reset()

    def test_the_right_passcode_plants_the_invite_cookie_and_enters(self):
        with serving(FLOW_PASSCODE='1111') as port:
            status, h, _ = knock(port, '1111')
            _, link_h, _ = get(port, '/?k=1111')
            opened, _, _ = get(port, '/immersive/', {'Cookie': h['set-cookie'].split(';')[0]})
        self.assertEqual(status, 302); self.assertEqual(h['location'], '/immersive/')
        self.assertEqual(h['set-cookie'], link_h['set-cookie'])   # one cookie, two doors
        self.assertEqual(opened, 200)

    def test_a_wrong_passcode_says_so_and_plants_nothing(self):
        with serving(FLOW_PASSCODE='1111') as port:
            status, h, body = knock(port, '1112')
        self.assertEqual(status, 403); self.assertNotIn('set-cookie', h)
        self.assertIn('不對'.encode(), body); self.assertIn(b'name="code"', body)

    def test_five_wrong_passcodes_lock_that_visitor_out_for_a_minute(self):
        clock = mock.Mock(return_value=1000.0)
        with mock.patch.object(sw, 'DOOR_CLOCK', clock), serving(FLOW_PASSCODE='1111') as port:
            for _ in range(5):
                knock(port, '0000')
            locked, h, body = knock(port, '1111')
            clock.return_value = 1000.0 + sw.DOOR_LOCK + 1
            later, _, _ = knock(port, '1111')
        self.assertEqual(locked, 403); self.assertNotIn('set-cookie', h); self.assertIn('稍後'.encode(), body)
        self.assertEqual(later, 302)

    def test_visitors_are_told_apart_by_x_forwarded_for_behind_the_proxy(self):
        with serving(FLOW_PASSCODE='1111') as port:
            for _ in range(5):
                knock(port, '0000', ip='203.0.113.9')
            other, _, _ = knock(port, '1111', ip='203.0.113.10')
            same, _, _ = knock(port, '1111', ip='203.0.113.9')
        self.assertEqual(other, 302); self.assertEqual(same, 403)

    def test_many_wrong_passcodes_from_everywhere_lock_the_door_for_everyone(self):
        with serving(FLOW_PASSCODE='1111') as port:
            for i in range(sw.DOOR_TRIES_ALL):
                knock(port, '0000', ip=f'198.51.100.{i}')
            fresh, _, _ = knock(port, '1111', ip='192.0.2.1')
        self.assertEqual(fresh, 403)

    def test_a_remembered_enter_address_goes_to_the_glass_instead_of_404(self):
        # A browser that once typed a wrong code sits at /enter and autocompletes that address next time (Bird's Quest, 2026-11-03).
        with serving() as port:
            status, h, _ = get(port, '/enter')
            head, hh, _ = call(port, 'HEAD', '/enter')
        with serving(FLOW_PASSCODE='1111') as port:
            gated, _, body = get(port, '/enter')
        self.assertEqual(status, 302); self.assertEqual(h['location'], '/immersive/')
        self.assertEqual(head, 302); self.assertEqual(hh['location'], '/immersive/')
        self.assertEqual(gated, 403); self.assertIn(b'name="code"', body)   # with a door up, /enter is the door

    def test_the_door_with_the_gate_off_just_enters(self):
        with serving() as port:
            status, h, _ = knock(port, '1111')
        self.assertEqual(status, 302); self.assertEqual(h['location'], '/immersive/'); self.assertNotIn('set-cookie', h)
