"""Regression checks for content validation and release discovery."""
from copy import deepcopy
from importlib.util import spec_from_file_location, module_from_spec
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = spec_from_file_location('product_pages', ROOT / 'scripts/build-product-pages.py')
module = module_from_spec(spec)
spec.loader.exec_module(module)


class ReleaseContentTests(unittest.TestCase):
    def test_source_records_valid_and_sorted(self):
        records = module.validate_releases(list(reversed(module.RELEASES)))
        self.assertEqual(records, module.RELEASES)

    def test_rejects_unsafe_and_duplicate_slugs(self):
        for slug in ['../index', 'UPPER CASE', 'bad"attribute']:
            with self.subTest(slug=slug):
                record = deepcopy(module.RELEASES[0])
                record['slug'] = slug
                with self.assertRaises(ValueError): module.validate_releases([record])
        with self.assertRaises(ValueError): module.validate_releases([module.RELEASES[0]] * 2)

    def test_rejects_invalid_content_before_generation(self):
        for key, value in [('category', 'Unknown'), ('startDate', '2026-99-01'),
                           ('endDate', '2000-01-01'), ('startDate', '20260905'), ('title', ''),
                           ('highlights', []), ('fixes', [42]), ('sourcePages', [0])]:
            with self.subTest(key=key):
                record = deepcopy(module.RELEASES[0])
                record[key] = value
                with self.assertRaises(ValueError): module.validate_releases([record])

    def test_search_includes_fixes_and_foundation(self):
        record = deepcopy(module.RELEASES[0])
        record['fixes'] = ['Unique email lookup fix']
        record['foundation'] = ['Unique infrastructure change']
        text = module.search_text(record)
        self.assertIn('Unique email lookup fix', text)
        self.assertIn('Unique infrastructure change', text)
        self.assertIn(record['benefit'], text)

    def test_coverage_follows_release_data(self):
        record = deepcopy(module.RELEASES[0])
        record.update(startDate='2027-01-02', endDate='2027-01-08')
        self.assertEqual(module.coverage_label([record]), 'January 2027')
        self.assertEqual(module.coverage_label(module.RELEASES + [record]), 'July 2026–January 2027')
        self.assertEqual(module.coverage_label(module.RELEASES), 'July–September 2026')

    def test_customer_content_is_escaped(self):
        html = module.shell('<script>test</script>', '"quoted"', '<p>Safe template</p>')
        self.assertIn('&lt;script&gt;test&lt;/script&gt;', html)
        self.assertIn('&quot;quoted&quot;', html)
        self.assertNotIn('<script>test</script>', html)


if __name__ == '__main__':
    unittest.main()
