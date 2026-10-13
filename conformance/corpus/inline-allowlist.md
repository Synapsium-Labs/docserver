Probe: paras_inline.

Line one  
line two\
line three

*em* **strong** ~~del~~ `code` <sup>1</sup> <sub>2</sub> <kbd>Ctrl</kbd> <KBD>X</KBD> <sup class="x">no</sup> <script>alert(1)</script> <div>d</div> <img src=x onerror=1> a<br>b<br/>c<br />d <!-- c --> e &amp; &lt; &copy; "quotes" 'a' -- ... (c)

Probe: br_forms.

a <BR> b <br  /> c <br	> d <Br/>

Probe: orphan_close_inline.

x </sup> y </kbd> <sup>a

Probe: kbd_in_code.

`<kbd>x</kbd>` and <kbd>y</kbd>

Probe: entity_br.

a&lt;br&gt;b

Probe: mdx_angle.

List<T> and a<b>c and <https://x.y/z>

Probe: inline_comment_multi.

a <!-- x
y --> b

Probe: comment_inline_id.

x <!-- id:Q --> y

Probe: comment_in_para.

para
<!-- id:X -->
more
