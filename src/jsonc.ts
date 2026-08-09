export function parseJsonc(text: string): unknown {
  let out = ""
  let inString = false
  let i = 0
  while (i < text.length) {
    const c = text[i]
    const n = text[i + 1]
    if (inString) {
      out += c
      if (c === "\\" && n !== undefined) {
        out += n
        i += 2
        continue
      }
      if (c === '"') inString = false
      i += 1
      continue
    }
    if (c === '"') {
      inString = true
      out += c
      i += 1
      continue
    }
    if (c === "/" && n === "/") {
      while (i < text.length && text[i] !== "\n") i += 1
      continue
    }
    if (c === "/" && n === "*") {
      i += 2
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i += 1
      i += 2
      continue
    }
    out += c
    i += 1
  }
  return JSON.parse(out.replace(/,\s*([}\]])/g, "$1"))
}
