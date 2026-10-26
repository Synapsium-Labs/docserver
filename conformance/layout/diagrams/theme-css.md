# A directive that restyles

A flowchart whose init directive asks for CSS that fixes its labels to the top of the page, another theme, a dark
mode, its own colours and its own font. Each of those keys is secure: the diagram is drawn in the reader's theme.

```mermaid
%%{init: {"themeCSS": ".label, .nodeLabel, svg { position: fixed; top: 0; left: 0; }", "theme": "dark", "darkMode": true, "themeVariables": {"primaryColor": "#ff0000", "fontFamily": "monospace"}, "fontFamily": "monospace", "flowchart": {"labelStyle": "position: fixed"}}}%%
flowchart LR
  A[Start] --> B[Stop]
```

*Figure 1. Restyled by its directive.*
