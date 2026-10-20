# An HTML label

A flowchart whose labels hold markup: a handler, a script, a style attribute, a class the reader styles and a style
element. Drawn with the strict security level, its labels keep their text and lose the rest.

```mermaid
flowchart LR
  A["<b onmouseover='window.__hit=1'>bold</b> text"] --> B["<script>window.__hit=2</script>after"]
  B --> C["<span class='fig-overlay open' style='position:fixed;top:0'>styled</span>"]
  C --> D["<style>p { position: fixed }</style>last"]
```

*Figure 1. Labels with markup.*
