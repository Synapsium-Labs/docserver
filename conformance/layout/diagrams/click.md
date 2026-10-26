# A directive that binds clicks

A flowchart that binds a call and a script link to its nodes, after an init directive that asks for the loose security
level. The security level is secure: nothing is bound, and no link runs script.

```mermaid
%%{init: {"securityLevel": "loose"}}%%
flowchart LR
  A[Call] --> B[Link]
  click A call hit()
  click B href "javascript:window.__hit=2"
```

*Figure 1. Clicks that do nothing.*
