"""Regression checks for safe static landmark additions."""
import unittest
from add_landmarks import with_landmarks, validate


class LandmarkTests(unittest.TestCase):
    def page(self, content, skip=''):
        return ('<!doctype html><html><head><title>Test</title></head><body>' + skip
                + '<nav class="topnav"><a href="/">Home</a></nav>' + content
                + '<footer class="foot"><a href="/contact">Contact</a></footer></body></html>')

    def test_wraps_main_and_is_idempotent(self):
        source = self.page('<section><h1>Heading</h1><p>Unchanged &amp; copy.</p></section>')
        result = with_landmarks(source)
        validate(result)
        self.assertIn('<p>Unchanged &amp; copy.</p>', result)
        self.assertEqual(with_landmarks(result), result)

    def test_preserves_biography_and_homepage_ids_and_links(self):
        for classname in ['skip-link', 'home-skip']:
            source = self.page('<main id="main" class="existing"><h1>Heading</h1></main>',
                               f'<a class="{classname}" href="#main">Skip to content</a>')
            result = with_landmarks(source)
            self.assertEqual(result.count('Skip to content'), 1)
            self.assertIn('<main id="main" class="existing" tabindex="-1">', result)
            self.assertNotIn('main-content', result)
            self.assertEqual(with_landmarks(result), result)

    def test_existing_main_without_id_gets_target(self):
        result = with_landmarks(self.page('<main class="nf"><h1>Not found</h1></main>'))
        self.assertIn('<main class="nf" id="main-content" tabindex="-1">', result)

    def test_refuses_id_collision_and_wrong_skip(self):
        for content, skip in [('<section id="main-content"><h1>Heading</h1></section>', ''),
                              ('<main id="main"><h1>Heading</h1></main>', '<a class="skip-link" href="#wrong">Skip</a>')]:
            with self.assertRaises(ValueError):
                with_landmarks(self.page(content, skip))

    def test_refuses_main_that_excludes_heading(self):
        with self.assertRaisesRegex(ValueError, 'page heading'):
            with_landmarks(self.page('<h1>Heading</h1><main><p>Body</p></main>'))

    def test_duplicate_ids_refused_without_writing(self):
        with self.assertRaisesRegex(ValueError, 'Duplicate IDs'):
            with_landmarks(self.page('<h1 id="x">Heading</h1><p id="x">Copy</p>'))


if __name__ == '__main__':
    unittest.main()
