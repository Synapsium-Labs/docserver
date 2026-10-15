Probe: links.

[a](http://x 'title') [b](javascript:alert(1)) [c](data:text/html,x) ![img](a.png "t") ![d](data:image/png;base64,AAAA) [r][ref] [e](<a b>)

[ref]: http://r

Probe: link_file.

[f](file:///etc/passwd) [v](vbscript:x) [d](data:image/svg+xml,x) [g](data:image/gif;base64,AA) [h](JAVASCRIPT:x) [m](mailto:a@b.c) [tel](tel:1)

Probe: link_rel.

[a](./b.md#x) [c](../d.md?ref=x) [e](#frag)

Probe: link_title_esc.

[a](http://x "t \"q\" &amp;")

Probe: link_ref_html.

[a]

[a]: <http://x> "t"

Probe: ref_def_only.

[x]: http://x

Probe: autolink.

bare http://example.com/a?b=1&c=2 and <http://example.com> and <me@example.invalid> and www.x.com

Probe: autolink_odd.

<ftp://a.b> <a:b> <javascript:x>

Probe: img_alt.

![a *b* `c`](x.png)
