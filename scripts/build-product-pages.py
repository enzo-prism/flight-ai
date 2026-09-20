#!/usr/bin/env python3
"""Generate static product and release pages. Python standard library only."""
from pathlib import Path
from html import escape as e
import json
import argparse
from datetime import date
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from site_chrome import header, footer
CATEGORIES = ('Capabilities', 'Experience', 'Reliability')


def validate_releases(records):
    """Reject malformed content before touching generated pages."""
    if not isinstance(records, list) or not records:
        raise ValueError('Expected a non-empty release list')
    slugs = set()
    for record in records:
        if not isinstance(record, dict):
            raise ValueError('Each release must be an object')
        for key in ('slug', 'title', 'period', 'startDate', 'endDate', 'category', 'summary', 'benefit'):
            if not isinstance(record.get(key), str) or not record[key].strip():
                raise ValueError(f'Release requires non-empty {key}')
        slug = record['slug']
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug) or slug in slugs:
            raise ValueError(f'Invalid or duplicate release slug: {slug}')
        slugs.add(slug)
        if any(not re.fullmatch(r'\d{4}-\d{2}-\d{2}', record[key]) for key in ('startDate', 'endDate')):
            raise ValueError(f'Dates must use YYYY-MM-DD: {slug}')
        start, end = (date.fromisoformat(record[key]) for key in ('startDate', 'endDate'))
        if start > end:
            raise ValueError(f'Reversed release period: {slug}')
        if record['category'] not in CATEGORIES:
            raise ValueError(f'Unknown release category: {slug}')
        if not isinstance(record.get('highlights'), list) or not record['highlights']:
            raise ValueError(f'Release requires highlights: {slug}')
        for highlight in record['highlights']:
            if not isinstance(highlight, dict) or any(not isinstance(highlight.get(key), str) or not highlight[key].strip() for key in ('title', 'description', 'benefit')):
                raise ValueError(f'Invalid highlight: {slug}')
        for key in ('fixes', 'foundation'):
            if not isinstance(record.get(key), list) or any(not isinstance(item, str) or not item.strip() for item in record[key]):
                raise ValueError(f'{key} must be a list of non-empty strings: {slug}')
        pages = record.get('sourcePages')
        if not isinstance(pages, list) or not pages or any(type(page) is not int or page < 1 for page in pages):
            raise ValueError(f'Release requires positive source page numbers: {slug}')
    return sorted(records, key=lambda item: item['endDate'], reverse=True)


def search_text(record):
    values = [record[key] for key in ('title', 'summary', 'period', 'benefit')]
    values.extend(highlight[key] for highlight in record['highlights'] for key in ('title', 'description', 'benefit'))
    values.extend(record['fixes'] + record['foundation'])
    return ' '.join(values)


def coverage_label(records):
    start = min(date.fromisoformat(record['startDate']) for record in records)
    end = max(date.fromisoformat(record['endDate']) for record in records)
    if (start.year, start.month) == (end.year, end.month):
        return start.strftime('%B %Y')
    if start.year == end.year:
        return f"{start:%B}–{end:%B %Y}"
    return f"{start:%B %Y}–{end:%B %Y}"


RELEASES = validate_releases(json.loads((ROOT / 'content/releases.json').read_text()))
OUTPUTS = {}


def emit(path, content):
    OUTPUTS[path] = content


def shell(title, description, body, active='product', prefix=''):
    return f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} — Mach 1</title><meta name="description" content="{e(description,quote=True)}">
<meta property="og:title" content="{e(title,quote=True)} — Mach 1"><meta property="og:description" content="{e(description,quote=True)}"><meta property="og:type" content="{'article' if prefix else 'website'}">
<meta name="theme-color" content="#0B1B33"><link rel="icon" type="image/png" href="{prefix}assets/brand/mach1-mark.png">
<link rel="stylesheet" href="{prefix}styles.css"><link rel="stylesheet" href="{prefix}pages.css"><link rel="stylesheet" href="{prefix}navigation.css"><script src="{prefix}navigation.js" defer></script><script src="{prefix}pages.js" defer></script></head>
<body class="editorial"><a class="skip" href="#main">Skip to content</a>
{header(active, prefix)}
<main id="main" tabindex="-1">{body}</main>
{footer(prefix)}</body></html>'''

def release_link(r,prefix=''):
    return prefix+'updates/'+r['slug']+'.html'

def card(r):
    return f'''<article class="update-card"><p class="eyebrow">{e(r['category'])}</p><p class="period">{e(r['period'])}</p><h3><a href="{release_link(r)}">{e(r['title'])}</a></h3><p>{e(r['summary'])}</p><a class="textlink" href="{release_link(r)}">Explore the update <span aria-hidden="true">→</span></a></article>'''

features = [
 ('01','Tower','Keep your assistant in the flow.', 'A persistent, resizable sidebar keeps Tower with you as you move through Mach 1. Your session stays in place across pages, panel changes, and refreshes.', 'Less restarting. More moving forward.', 'tower'),
 ('02','Shared knowledge','Give every team the right context.', 'Share context across your organization or within a department. Move information between scopes as your teams and responsibilities evolve.', 'Relevant knowledge, without rebuilding it for every team.', 'context'),
 ('03','Workflow control','Set the boundaries. Keep the controls.', 'Enforce agent timeouts and evaluation rules. Stop active workflows immediately and clear stuck runs when plans change.', 'Automation that follows your operating rules.', 'workflows'),
 ('04','Website chat','Bring your workflows to your website.', 'Create, edit, enable, disable, and install workflow-powered chat widgets from a dedicated settings page. Drag and drop images while setting up agents.', 'A shorter path from a workflow to a customer conversation.', 'chat'),
 ('05','Connected tools','Know what is connected. Know what needs attention.', 'Run on-demand checks for external tools and get useful feedback when a connection fails. When an integration returns no actions, see an explanation with sensitive credentials redacted.', 'Less guessing when an integration needs attention.', 'connections'),
 ('06','Usage visibility','Understand where your AI spend goes.', 'Administrators can review estimated AI costs by model and in aggregate, then export those estimates in CSV reports for budget tracking.', 'Clearer planning, with estimates you can take into your own reports.', 'usage')]
feature_html = ''.join(f'''<article class="capability" id="{key}"><div class="cap-meta"><span>{num}</span><p class="eyebrow">{e(label)}</p></div><h3>{e(title)}</h3><p>{e(desc)}</p><p class="feature-benefit">{e(benefit)}</p></article>''' for num,label,title,desc,benefit,key in features)
product = f'''
<section class="product-hero"><div class="wrap"><p class="eyebrow">The Mach 1 product</p><div class="hero-heading"><h1>More capable agents.<br><span>A more focused team.</span></h1><div><p class="lede">Put your knowledge, tools, and workflows to work. Mach 1 helps your team handle customer conversations with the context and control to move forward.</p><div class="cta-row"><a class="btn solid lg" href="app.html">Explore the demo ↗</a><a class="textlink" href="#capabilities">See what’s inside ↓</a></div></div></div>
<div class="product-stage"><div class="stage-top"><span class="stage-brand">MACH 1 / WORKSPACE</span><span class="stage-label">Product illustration</span></div><div class="stage-grid"><div class="stage-rail"><span class="rail-active">Overview</span><span>Context</span><span>Workflows</span><span>Connections</span><span>Usage</span></div><div class="stage-work"><p class="eyebrow">From context to conversation</p><h2>Your team’s knowledge.<br>Ready to work.</h2><div class="workflow-path"><div><span>01</span><strong>Connect context</strong><small>Knowledge + tools</small></div><span class="path-arrow" aria-hidden="true">→</span><div><span>02</span><strong>Set the workflow</strong><small>Rules + evaluation</small></div><span class="path-arrow" aria-hidden="true">→</span><div><span>03</span><strong>Help customers</strong><small>Agents + chat</small></div></div><div class="stage-note"><span class="status-dot"></span>Built around your team’s way of working</div></div><aside class="tower-panel"><div class="tower-heading"><span class="tower-monogram">T</span><strong>Tower</strong><span aria-hidden="true">↗</span></div><p>Your knowledge and workflow assistant, alongside your work.</p><div class="tower-context"><span class="eyebrow">Context</span><strong>Organization knowledge</strong><strong>Department guidance</strong><strong>Connected workflows</strong></div><div class="tower-input">Keep your place. Keep your context.</div></aside></div></div></div></section>
<div class="product-subnav"><div class="wrap"><a href="#capabilities">Capabilities</a><a href="#customer-value">Customer value</a><a href="#platform">Platform</a><a href="#latest">What’s new</a></div></div>
<section id="capabilities"><div class="wrap"><div class="section-heading"><p class="eyebrow">Built for the work around the conversation</p><h2>Everything your agents need.<br>Control where your team needs it.</h2><p>Connect knowledge, guide execution, and make the next step easier for the people running your operation.</p></div><div class="capability-grid">{feature_html}</div></div></section>
<section id="customer-value" class="value-section"><div class="wrap value-grid"><div><p class="eyebrow">Why teams use Mach 1</p><h2>Give people more room<br>to do their best work.</h2><p>Keep the routine moving so your team can focus on the conversations and decisions that need them.</p><a class="textlink" href="index.html#customers">Hear from Mach 1 customers →</a></div><div class="value-list"><article><span>01</span><div><h3>Less time rebuilding context</h3><p>Persistent sessions and shared knowledge help teams pick up where they left off.</p></div></article><article><span>02</span><div><h3>More confidence in automation</h3><p>Timeouts, evaluation rules, and cancellation controls keep people in charge of how work runs.</p></div></article><article><span>03</span><div><h3>A clearer view of the operation</h3><p>Connection diagnostics and estimated usage costs make issues and tradeoffs easier to understand.</p></div></article></div></div></section>
<section class="customer-voice"><div class="wrap"><p class="eyebrow">The customer perspective</p><blockquote>“Mach 1 is essentially our sales team for every inbound customer.”</blockquote><p><strong>Craig McGowan</strong> · AI &amp; Automation, Trace</p><a class="textlink" href="index.html#customers">Watch the customer stories →</a></div></section>
<section id="platform" class="platform-section"><div class="wrap"><div class="section-heading"><p class="eyebrow">A stronger foundation</p><h2>Ready for the way your work grows.</h2></div><div class="platform-grid"><article><h3>More model choice</h3><p>OpenRouter selection expands the models available to teams, alongside upgraded defaults for workflow chats and automated tools.</p></article><article><h3>Scoped access</h3><p>Organization and department-level secret management gives teams granular grants and safety warnings around sensitive credentials.</p></article><article><h3>Room for history</h3><p>Long-term cloud archiving stores historical account data efficiently while supporting responsive day-to-day operations.</p></article></div></div></section>
<section id="latest"><div class="wrap"><div class="section-heading heading-row"><div><p class="eyebrow">Always moving forward</p><h2>Small improvements.<br>Meaningful differences.</h2></div><a class="textlink" href="updates.html">All product updates →</a></div><div class="update-grid">{''.join(card(r) for r in RELEASES[:3])}</div></div></section>
<section class="page-cta"><div class="wrap"><p class="eyebrow">See it in context</p><h2>Meet your team’s next advantage.</h2><p>Explore a fictional conversation workspace. No account needed.</p><p><a href="app.html#/support/priorities">Support preview</a> · <a href="app.html#/sales/priorities">Sales preview</a> · <a href="app.html#/support/overview">Team overview</a></p><div class="cta-row"><a class="btn light lg" href="app.html">Try the demo ↗</a><a class="btn outline lg" href="sales.html">Contact Sales</a></div></div></section>'''
emit(ROOT/'product.html', shell('AI agents with context and control', 'Explore Tower, shared knowledge, workflow controls, website chat, integration diagnostics, and AI usage visibility in Mach 1.', product))

rows = ''.join(f'''<article class="release-row" data-category="{e(r['category'])}" data-search="{e(search_text(r),quote=True)}"><div class="release-date"><span class="eyebrow">Release period</span><p>{e(r['period'])}</p><span class="release-tag">{e(r['category'])}</span></div><div><h2><a href="{release_link(r)}">{e(r['title'])}</a></h2><p>{e(r['summary'])}</p><p class="release-benefit">{e(r['benefit'])}</p><a class="textlink" href="{release_link(r)}">Read the release notes →</a></div></article>''' for r in RELEASES)
updates=f'''<section class="updates-hero"><div class="wrap"><nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="product.html">Product</a></li><li><span aria-current="page">Updates</span></li></ol></nav><h1>Better with<br>every release.</h1><p class="lede">New capabilities, thoughtful refinements, and the fixes that make everyday work feel easier.</p><p class="coverage">{coverage_label(RELEASES)} · {len(RELEASES)} release summaries</p></div></section><section class="release-index"><div class="wrap"><div class="release-tools" hidden><div class="release-filters" role="group" aria-label="Filter releases">{''.join(f'<button type="button" data-filter="{v}" aria-pressed="{str(v=="All").lower()}">{v}</button>' for v in ['All','Capabilities','Experience','Reliability'])}</div><label class="release-search">Search updates<input type="search" id="releaseSearch" placeholder="Tower, chat, costs…"></label></div><p class="result-count" role="status" hidden></p><div id="releaseList">{rows}</div><p id="noResults" hidden>No updates match your search. Try another term or choose All.</p></div></section><section class="page-cta"><div class="wrap"><h2>See how it all comes together.</h2><p>Explore the capabilities behind the updates.</p><a class="btn light lg" href="product.html">Explore the product →</a></div></section>'''
emit(ROOT/'updates.html', shell('Product updates', 'Explore Mach 1 release notes and learn how each update improves customer conversations, workflow control, and everyday operations.',updates,'updates'))
for i,r in enumerate(RELEASES):
    highlights=''.join(f'''<section class="release-detail-section"><p class="eyebrow">Improvement {n+1:02}</p><h2>{e(h['title'])}</h2><p>{e(h['description'])}</p><div class="outcome"><strong>What this means for your team</strong><p>{e(h['benefit'])}</p></div></section>''' for n,h in enumerate(r['highlights']))
    def itemtext(v):
        if isinstance(v,str): return e(v)
        return '<strong>'+e(v.get('title',''))+'</strong> '+e(v.get('description',''))
    extras=''.join(f'<section class="release-detail-section"><h2>{label}</h2><ul class="release-bullets">'+''.join('<li>'+itemtext(v)+'</li>' for v in r.get(key,[]))+'</ul></section>' for key,label in [('fixes','Fixes that remove friction'),('foundation','Behind the experience')] if r.get(key))
    adjacent=''
    if i+1<len(RELEASES): adjacent+=f'<a href="{RELEASES[i+1]["slug"]}.html"><span>← Previous release period</span><strong>{e(RELEASES[i+1]["title"])}</strong></a>'
    if i>0: adjacent+=f'<a href="{RELEASES[i-1]["slug"]}.html"><span>Next release period →</span><strong>{e(RELEASES[i-1]["title"])}</strong></a>'
    article=f'''<article><header class="release-hero"><div class="wrap"><nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="../product.html">Product</a></li><li><a href="../updates.html" data-updates-return>Updates</a></li><li><span aria-current="page">Release notes</span></li></ol></nav><p class="eyebrow">{e(r['category'])} / Release notes</p><h1>{e(r['title'])}</h1><p class="lede">{e(r['summary'])}</p><p class="period">Release period: {e(r['period'])}</p></div></header><div class="wrap release-layout"><aside class="release-aside"><p class="eyebrow">The customer benefit</p><p>{e(r['benefit'])}</p><a class="textlink" href="../product.html">Explore Mach 1 →</a></aside><div class="release-body">{highlights}{extras}<div class="release-end"><h2>Put the improvements in context.</h2><p>See how Mach 1 brings knowledge, tools, and workflows together for your team.</p><a class="btn solid" href="../product.html">Explore the product →</a></div><nav class="adjacent-releases" aria-label="Adjacent releases">{adjacent}</nav></div></div></article>'''
    emit(ROOT/'updates'/f'{r["slug"]}.html', shell(r['title'],r['summary'],article,'release','../'))
# Keep hand-authored page content while generating the same navigation everywhere.
for filename, current in [('index.html', 'home'), ('sales.html', 'sales')]:
    path = ROOT / filename
    page = path.read_text()
    page, header_count = re.subn(r'<header class="(?:nav|site-header)"[^>]*>.*?</header>', lambda _: header(current), page, count=1, flags=re.S)
    page, footer_count = re.subn(r'<footer(?: class="[^"]*")?>.*?</footer>', lambda _: footer(), page, count=1, flags=re.S)
    if header_count != 1 or footer_count != 1:
        raise ValueError(f'Expected one shared header and footer in {filename}')
    emit(path, page)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Check committed pages without writing')
    args = parser.parse_args()
    unexpected = set((ROOT / 'updates').glob('*.html')) - set(OUTPUTS)
    if unexpected:
        parser.error('Unlisted release pages need explicit review: ' + ', '.join(str(path.relative_to(ROOT)) for path in sorted(unexpected)))
    if args.check:
        stale = [str(path.relative_to(ROOT)) for path, content in OUTPUTS.items() if not path.exists() or path.read_text() != content]
        if stale:
            parser.error('Regenerate stale pages: ' + ', '.join(stale))
        print(f'{len(OUTPUTS)} generated pages are current.')
    else:
        for path, content in OUTPUTS.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
        print(f'Generated product page, updates index, and {len(RELEASES)} release pages.')
