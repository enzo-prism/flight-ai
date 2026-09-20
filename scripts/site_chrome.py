"""Shared static header/footer. No client-side rendering or navigation dependency."""
from html import escape

CHEVRON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'


def header(current='home', prefix=''):
    def current_attr(key):
        return ' aria-current="page"' if current == key else (' aria-current="location"' if key == 'updates' and current == 'release' else '')
    features = [('tower', 'Tower', 'Your assistant, always alongside you'),
                ('context', 'Shared knowledge', 'The right context for every team'),
                ('workflows', 'Workflow control', 'Automation with clear boundaries'),
                ('chat', 'Website chat', 'Bring workflows to your customers')]
    shortcuts = ''.join(f'<a class="site-shortcut" href="{prefix}product.html#{key}"><span>{label}</span><small>{desc}</small></a>' for key,label,desc in features)
    links = ''.join(f'<a class="site-link" data-site-section="{key}" href="{prefix}{url}"{current_attr(key)}><span>{label}</span><small>{desc}</small></a>' for key,url,label,desc in [('integrations','index.html#integrations','Integrations','Connect the tools you already use'),('customers','index.html#customers','Customers','Hear from the teams using Mach 1'),('updates','updates.html','Updates','See what’s new in the product')])
    return f'''<header class="site-header" id="top" data-site-page="{escape(current)}">
  <div class="wrap site-inner">
    <a class="site-brand" href="{prefix}index.html" aria-label="Mach 1 home"><img src="{prefix}assets/brand/mach1-logo.png" alt="Mach 1" width="112" height="32"></a>
    <button class="site-toggle" type="button" aria-expanded="false" aria-controls="site-navigation" hidden><span class="site-toggle-label">Menu</span><span class="site-toggle-icon" aria-hidden="true"><i></i><i></i></span></button>
    <div class="site-navigation" id="site-navigation">
      <nav class="site-links" aria-label="Primary">
        <details class="site-product"{' data-current="true"' if current == 'product' else ''}>
          <summary class="site-link"><span>Product</span>{CHEVRON}</summary>
          <div class="site-dropdown">
            <a class="site-product-intro" href="{prefix}product.html"{current_attr('product')}><span class="site-eyebrow">Meet Mach 1</span><strong>Your knowledge. <br>Your tools. <br>Working together.</strong><span class="site-intro-link">Explore the product <span aria-hidden="true">↗</span></span></a>
            <div class="site-shortcuts"><p class="site-eyebrow">Built for your team</p><div>{shortcuts}</div><a class="site-all-features" href="{prefix}product.html#capabilities">All product capabilities <span aria-hidden="true">→</span></a></div>
          </div>
        </details>
        {links}
      </nav>
      <div class="site-actions"><a class="site-sales" href="{prefix}sales.html"{current_attr('sales')}>Contact sales</a><a class="site-demo" href="{prefix}app.html">Get Started <span aria-hidden="true">↗</span></a></div>
    </div>
  </div>
</header>'''


def footer(prefix=''):
    return f'''<footer class="site-footer"><div class="wrap"><div class="foot-grid"><div class="foot-brand"><a href="{prefix}index.html" aria-label="Mach 1 home"><img class="brand-logo" src="{prefix}assets/brand/mach1-logo-white.png" alt="Mach 1" height="28"></a><p>AI agents for support and sales.<br>Your team stays in control.</p></div><nav aria-label="Product"><h2 class="foot-h">Product</h2><a href="{prefix}product.html">Product overview</a><a href="{prefix}product.html#capabilities">Capabilities</a><a href="{prefix}index.html#integrations">Integrations</a><a href="{prefix}app.html">Get Started</a></nav><nav aria-label="Discover"><h2 class="foot-h">Discover</h2><a href="{prefix}index.html#customers">Customer stories</a><a href="{prefix}updates.html">Product updates</a><a href="{prefix}index.html#faq">Frequently asked questions</a></nav><nav aria-label="Connect"><h2 class="foot-h">Connect</h2><a href="{prefix}sales.html">Contact sales</a><a href="mailto:hello@mach1ai.com">Get in touch</a></nav></div><div class="bottom-bar"><p>© 2026 Mach 1 AI, Inc.</p><a href="#top">Back to top <span aria-hidden="true">↑</span></a></div></div></footer>'''
