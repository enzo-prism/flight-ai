#!/usr/bin/env python3
"""Check static documents, local link targets, and fragment identifiers."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


class Document(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.ids = set()
        self.duplicates = []
        self.links = []
        self.h1_count = 0
        self.feed(path.read_text())

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'h1': self.h1_count += 1
        if 'id' in attrs:
            if attrs['id'] in self.ids: self.duplicates.append(attrs['id'])
            self.ids.add(attrs['id'])
        if tag in ('a', 'script', 'link', 'img', 'source', 'track'):
            url = attrs.get('href') or attrs.get('src')
            if url: self.links.append(url)


def main():
    pages = [ROOT / name for name in ('index.html', 'sales.html', 'product.html', 'updates.html', 'app.html', 'sample.html', 'preview.html')]
    pages.extend(sorted((ROOT / 'updates').glob('*.html')))
    documents = {path: Document(path) for path in pages}
    errors = []
    count = 0
    for path, document in documents.copy().items():
        if document.h1_count != 1: errors.append(f'{path.name}: expected one h1')
        if document.duplicates: errors.append(f'{path.name}: duplicate IDs {document.duplicates}')
        for url in document.links:
            parts = urlsplit(url)
            if parts.scheme or parts.netloc: continue
            count += 1
            target = (path.parent / unquote(parts.path)).resolve() if parts.path else path
            if not target.is_relative_to(ROOT) or not target.is_file():
                errors.append(f'{path.relative_to(ROOT)}: missing local target {url}')
                continue
            # The guided preview renders these known steps in its client router.
            if target.name == 'preview.html' and parts.fragment in ('welcome', 'tools', 'focus', 'ready'):
                continue
            if parts.fragment and not parts.fragment.startswith('/'):
                if target not in documents: documents[target] = Document(target)
                if unquote(parts.fragment) not in documents[target].ids:
                    errors.append(f'{path.relative_to(ROOT)}: missing anchor {url}')
    if errors: raise SystemExit('\n'.join(errors))
    print(f'{len(pages)} pages, {count} local references: passed.')


if __name__ == '__main__': main()
