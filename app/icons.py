# Renders the launcher icons (legacy, adaptive foreground, themed monochrome) from one SVG drawing.
import os
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(HERE, 'res')

# Drawing in the 108-unit adaptive-icon grid; everything sits inside the 66-unit safe circle.
def art(mono=False):
    ink = '#ffffff' if mono else None
    link = ink or '#a9bab8'
    la = '0.85' if mono else '0.78'
    c = (lambda col: ink or col)
    cut = 'none' if mono else '#0b1315'
    parts = [
        f'<g fill="none" stroke="{link}" stroke-opacity="{la}" stroke-width="3.1" stroke-linecap="round">',
        '<path d="M36 38 Q40 52 50 57"/>',          # government -> hub
        '<path d="M50 57 Q58 42 74 39"/>',          # hub -> state firm
        '<path d="M50 57 Q58 70 73 73"/>',          # hub -> holding
        '<path d="M34 73 Q38 62 50 57"/>',          # fund -> hub
        '</g>',
        f'<path d="M36 38 Q55 30 74 39" fill="none" stroke="{link}" stroke-opacity="{"0.45" if mono else "0.28"}" stroke-width="1.6" stroke-linecap="round"/>',
        f'<circle cx="50" cy="57" r="13.2" fill="none" stroke="{c("#9fd8c9")}" stroke-width="1.7"/>',
        f'<rect x="31" y="33" width="10" height="10" rx="1.4" fill="{c("#199e70")}" stroke="{cut}" stroke-width="1.4"/>',
        f'<circle cx="74" cy="39" r="6.4" fill="{c("#d95926")}" stroke="{cut}" stroke-width="1.4"/>',
        f'<circle cx="73" cy="73" r="5" fill="{c("#3987e5")}" stroke="{cut}" stroke-width="1.4"/>',
        f'<path d="M34 68 L39 73 L34 78 L29 73 Z" fill="{c("#e7efed")}" stroke="{cut}" stroke-width="1.2"/>',
        f'<circle cx="50" cy="57" r="9.4" fill="{c("#3987e5")}" stroke="{cut}" stroke-width="1.6"/>',
    ]
    if not mono:
        parts += ['<g fill="#9fd8c9">', '<circle cx="42.6" cy="50.6" r="1.9"/>', '<circle cx="62.8" cy="44.2" r="1.9"/>', '<circle cx="62.4" cy="69.4" r="1.7"/>', '</g>']
    return ''.join(parts)

def svg(kind, px):
    if kind == 'legacy':  # rounded square, art scaled so the safe zone fills ~80% of the icon
        vb = '11.75 11.75 82.5 82.5'
        body = '<rect x="11.75" y="11.75" width="82.5" height="82.5" rx="17" fill="#0b1315"/>' + art()
    elif kind == 'fg':
        vb, body = '0 0 108 108', art()
    else:
        vb, body = '0 0 108 108', art(mono=True)
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{px}" height="{px}" viewBox="{vb}">{body}</svg>'

DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    for d, m in DENS.items():
        out = os.path.join(RES, f'mipmap-{d}'); os.makedirs(out, exist_ok=True)
        for kind, name, base in (('legacy', 'ic_launcher', 48), ('fg', 'ic_launcher_fg', 108), ('mono', 'ic_launcher_mono', 108)):
            px = round(base * m)
            pg.set_viewport_size({'width': px, 'height': px})
            pg.set_content(f'<html><body style="margin:0;background:transparent">{svg(kind, px)}</body></html>')
            pg.locator('svg').screenshot(path=os.path.join(out, name + '.png'), omit_background=True)
    # preview sheet for checking by eye
    pg.set_viewport_size({'width': 900, 'height': 240})
    prev = ''.join(f'<div style="display:inline-block;margin:10px;text-align:center">{svg(k, 192)}<br>{k}</div>' for k in ('legacy', 'fg', 'mono'))
    pg.set_content(f'<html><body style="margin:0;background:#888;font:12px sans-serif">{prev}<div style="display:inline-block;margin:10px;width:192px;height:192px;border-radius:50%;overflow:hidden;background:#0b1315">{svg("fg", 192).replace("<svg ", "<svg style=\'margin:-0px\' ")}</div></body></html>')
    pg.screenshot(path=os.path.join(HERE, 'icon-preview.png'))
    b.close()
print('icons written')
