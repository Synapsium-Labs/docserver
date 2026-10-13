Probe: table.

| A | B | C |
|---|:-:|--:|
| 1 | `x\|y` | z\|w |
| **b** | <br> | • a<br>• b |

| only |
|---|

Probe: table_align_none.

a | b
--|--
1 | 2

Probe: table_cell_code_multi.

| a |
|---|
| `x` `y\|z` |

Probe: table_cell_pipes.

| a |
|---|
| `a\|b` and \| x |

`not in table a\|b`

Probe: table_in_bq.

> | a |
> |---|
> | b |

Probe: table_text_table.

Use `<table>` tags.

| a |
|---|
| b |

Probe: table_wrap_in_code.

```html
<table><tr></tr></table>
```

Probe: tbl_br_only.

| a | b |
|---|---|
| <br> | x |

Probe: tbl_comment_cell.

| a |
|---|
| x <!-- hid --> y |

Probe: html_in_code_table.

text `</table>` and `<table>` x

Probe: footnote_in_table.

| a |
|---|
| x[^1] |

[^1]: n

Probe: tbl_pipe_dbl.

| a |
|---|
| `a\\|b` |

Probe: tbl_pipe_in_code_html.

| a |
|---|
| `a\|b` <br> x |

Probe: table_ragged.

| a | b |
|---|---|
| 1 |
| 1 | 2 | 3 |
