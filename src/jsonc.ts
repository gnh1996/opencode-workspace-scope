function stripComments(text: string): string {
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
  return out
}

function stripTrailingCommas(text: string): string {
  let out = ""
  let inString = false
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (inString) {
      out += c
      if (c === "\\") {
        const n = text[i + 1]
        if (n !== undefined) {
          out += n
          i += 1
        }
      } else if (c === '"') {
        inString = false
      }
      i += 1
      continue
    }
    if (c === '"') {
      inString = true
      out += c
      i += 1
      continue
    }
    if (c === ",") {
      let j = i + 1
      while (j < text.length && (text[j] === " " || text[j] === "\t" || text[j] === "\n" || text[j] === "\r")) {
        j += 1
      }
      if (text[j] === "}" || text[j] === "]") {
        i += 1
        continue
      }
    }
    out += c
    i += 1
  }
  return out
}

export function parseJsonc(text: string): unknown {
  return JSON.parse(stripTrailingCommas(stripComments(text)))
}
