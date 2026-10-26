import unittest, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import serve_worlds as sw

GOOD_STATE = {'scene': 'swarm', 'sceneAge': 12.3, 'arc': {'name': 'tidal', 'waypoint': 2},
              'features': {'E_mean30': .5, 'E_trend': .1, 'C_mean30': .7, 'B_mean30': .4, 'A_mean30': .2, 'bpm': 108},
              'initiative': {'I': .3, 'locked': False, 'I0': .3}, 'locks': {'scene': False},
              'userText': '', 'recentDecisions': [], 'online': True}


class ServeWorlds(unittest.TestCase):
    def test_questions_cover_the_spec(self):
        q = sw.build_questions(GOOD_STATE)
        self.assertEqual(set(q), {'hold', 'scene', 'energy', 'entropy', 'symmetry', 'palette', 'initiative', 'mood'})
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
                   'mood': {'type': 'choice', 'choice': 'melt', 'probabilities': {'melt': .8}, 'confidence': .8}}
        d = sw.map_answers(answers, 4)
        self.assertEqual(d['version'], 4); self.assertAlmostEqual(d['hold'], .7)
        self.assertEqual(d['scene'], {'choice': 'boids', 'p': .62}); self.assertAlmostEqual(d['energy'], .75)
        self.assertEqual(d['symmetry'], 6); self.assertEqual(d['palette'], 'ember'); self.assertEqual(d['initiative'], 'lead')
        self.assertAlmostEqual(d['confidence']['entropy'], .3)
        self.assertEqual(d['mood'], 'melt'); self.assertAlmostEqual(d['confidence']['mood'], .8)
        for bad in [('palette', {'type': 'choice', 'choice': 'puce', 'probabilities': {}, 'confidence': .9}),
                    ('symmetry', {'type': 'score', 'score': 7, 'probabilities': {}, 'legend': {}, 'confidence': .9}),
                    ('hold', {'type': 'noul', 'noul': 2}),
                    ('mood', {'type': 'choice', 'choice': 'angry', 'probabilities': {}, 'confidence': .9})]:
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


if __name__ == '__main__':
    unittest.main()
