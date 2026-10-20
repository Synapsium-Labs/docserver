# A diagram over the edge limit

The host allows 3 edges; this diagram draws 4, after an init directive that asks for 1000. The limit is secure, so
the drawing fails, and the figure shows its note.

```mermaid
%%{init: {"maxEdges": 1000}}%%
flowchart LR
  A --> B
  B --> C
  C --> D
  D --> E
```

*Figure 1. One edge too many.*
