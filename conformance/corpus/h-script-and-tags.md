Inline: <script>alert(1)</script> <SCRIPT>x</SCRIPT> <scr<script>ipt>y</script> <style>p{}</style> <iframe src="x"></iframe> <div>d</div> <table><tr><td>t</td></tr></table> <svg onload=alert(1)>s</svg>

<script>
alert(2)
</script>

<SCRIPT src="x"></SCRIPT>

<style>
body { display: none }
</style>

<iframe src="https://example.com/"></iframe>

<svg onload="alert(3)"><circle r="1"/></svg>

- <script>alert(4)</script>
- <iframe></iframe>

> <style>x</style>
> <div onclick="y">z</div>

Probe: html_block_raw.

<div class="x">
block
</div>

<script>
alert(1)
</script>

<table><tr><td>x</td></tr></table>
