Probe: code_py.

```python
print('hi')
x = 1 # c
```

Probe: code_ts.

```ts
const x: number = 1
```

```typescript
interface A {}
```

```yaml
a: 1
```

```diff
- a
+ b
```

```promise-delta
item: X
```

```sh
ls
```

```html
<div>
```

```tsx
const a=<A/>
```

Probe: code_unknown.

```nonsense-lang
x
```

Probe: code_none.

```
plain <b>
```

Probe: code_info.

```js title="x"
const a = 1;
```

```json
{"a": [1, true, null]}
```

~~~bash
echo $HOME | grep x
~~~

Probe: fence_info_upper.

```Python
x=1
```

```PY
x=1
```

Probe: fence_lang_alias.

```javascript
let a
```

```jsx
<A/>
```

```shell
ls
```

```console
$ ls
```

```text
hi
```

```md
# h
```

```sql
select 1
```

```rust
fn x(){}
```

```go
func x(){}
```

```toml
a=1
```

```dockerfile
FROM a
```

```mermaidx
x
```

Probe: fence_nl_trail.

```py
x=1


```

Probe: fence_in_list.

- a

  ```python
  x=1
  ```

Probe: html_entity_in_code_fence_info.

```a&amp;b
x
```

Probe: fence_info_firstword_tab.

```python	title
x
```
