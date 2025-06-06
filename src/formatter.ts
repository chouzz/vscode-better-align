import * as vscode from 'vscode'

enum TokenType {
  Invalid = 'Invalid',
  Word = 'Word',
  Assignment = 'Assignment', // = += -= *= /= %= ~= |= ^= .= :=
  Arrow = 'Arrow', // =>
  Block = 'Block', // {} [] ()
  PartialBlock = 'PartialBlock', // { [ (
  EndOfBlock = 'EndOfBlock', // } ] )
  String = 'String',
  PartialString = 'PartialString',
  Comment = 'Comment',
  Whitespace = 'Whitespace',
  Colon = 'Colon',
  Comma = 'Comma',
  CommaAsWord = 'CommaAsWord',
  Insertion = 'Insertion',
}

interface Token {
  type: TokenType
  text: string
}

export interface LineInfo {
  line: vscode.TextLine
  sgfntTokenType: TokenType
  sgfntTokens: TokenType[]
  tokens: Token[]
}

export interface LineRange {
  anchor: number
  infos: LineInfo[]
}

const REG_WS = /\s/
const BRACKET_PAIR: any = {
  '{': '}',
  '[': ']',
  '(': ')',
}

function whitespace(count: number) {
  return new Array(count + 1).join(' ')
}

export class Formatter {
  /* Align:
   *   operators = += -= *= /= :
   *   trailling comment
   *   preceding comma
   * Ignore anything inside a quote, comment, or block
   */
  public process(editor: vscode.TextEditor): void {
    this.editor = editor

    // Get line ranges
    const ranges = this.getLineRanges(editor)

    // Format
    let formatted: string[][] = []
    for (let range of ranges) {
      formatted.push(this.format(range))
    }

    // Apply
    editor.edit((editBuilder) => {
      for (let i = 0; i < ranges.length; ++i) {
        var infos = ranges[i].infos
        var lastline = infos[infos.length - 1].line
        var location = new vscode.Range(
          infos[0].line.lineNumber,
          0,
          lastline.lineNumber,
          lastline.text.length
        )
        const eol = editor.document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n'
        const replaced = formatted[i].join(eol)
        if (editor.document.getText(location) === replaced) {
          continue
        }
        editBuilder.replace(location, replaced)
      }
    })
  }

  protected editor: vscode.TextEditor

  protected getLineRanges(editor: vscode.TextEditor): LineRange[] {
    var ranges: LineRange[] = []
    editor.selections.forEach((sel) => {
      const indentBase = this.getConfig().get(
        'indentBase',
        'firstline'
      ) as string
      const importantIndent: boolean = indentBase === 'dontchange'

      let res: LineRange
      if (sel.isSingleLine) {
        // If this selection is single line. Look up and down to search for the similar neighbour
        ranges.push(
          this.narrow(
            0,
            editor.document.lineCount - 1,
            sel.active.line,
            importantIndent
          )
        )
      } else {
        // Otherwise, narrow down the range where to align
        let start = sel.start.line
        let end = sel.end.line

        while (true) {
          res = this.narrow(start, end, start, importantIndent)
          let lastLine = res.infos[res.infos.length - 1]

          if (lastLine.line.lineNumber > end) {
            break
          }

          if (
            res.infos[0] &&
            res.infos[0].sgfntTokenType !== TokenType.Invalid
          ) {
            ranges.push(res)
          }

          if (lastLine.line.lineNumber === end) {
            break
          }

          start = lastLine.line.lineNumber + 1
        }
      }
    })
    return ranges
  }

  protected getConfig() {
    let defaultConfig = vscode.workspace.getConfiguration('betterAlign')
    let langConfig: any = null

    try {
      langConfig = vscode.workspace
        .getConfiguration()
        .get(`[${this.editor.document.languageId}]`) as any
    } catch (e) {}

    return {
      get: function (key: any, defaultValue?: any): any {
        if (langConfig) {
          var key1 = 'betterAlign.' + key
          if (langConfig.hasOwnProperty(key1)) {
            return langConfig[key1]
          }
        }

        return defaultConfig.get(key, defaultValue)
      },
    }
  }

  protected tokenize(line: number): LineInfo {
    let textline = this.editor.document.lineAt(line)
    let text = textline.text
    let pos = 0
    let lt: LineInfo = {
      line: textline,
      sgfntTokenType: TokenType.Invalid,
      sgfntTokens: [],
      tokens: [],
    }

    let lastTokenType = TokenType.Invalid
    let tokenStartPos = -1

    while (pos < text.length) {
      let char = text.charAt(pos)
      let next = text.charAt(pos + 1)
      let third = text.charAt(pos + 2)

      let currTokenType: TokenType

      let nextSeek = 1

      // Tokens order are important
      if (char.match(REG_WS)) {
        currTokenType = TokenType.Whitespace
      } else if (char === '"' || char === "'" || char === '`') {
        currTokenType = TokenType.String
      } else if (char === '{' || char === '(' || char === '[') {
        currTokenType = TokenType.Block
      } else if (char === '}' || char === ')' || char === ']') {
        currTokenType = TokenType.EndOfBlock
      } else if (
        char === '/' &&
        ((next === '/' && (pos > 0 ? text.charAt(pos - 1) : '') !== ':') || // only `//` but not `://`
          next === '*')
      ) {
        currTokenType = TokenType.Comment
      } else if (char === ',') {
        if (
          lt.tokens.length === 0 ||
          (lt.tokens.length === 1 && lt.tokens[0].type === TokenType.Whitespace)
        ) {
          currTokenType = TokenType.CommaAsWord // Comma-first style
        } else {
          currTokenType = TokenType.Comma
        }
      } else if (char === '=' && next === '>') {
        currTokenType = TokenType.Arrow
        nextSeek = 2
      } else if (
        // Currently we support only known operators,
        // formatters will not work for unknown operators, we should find a way to support all operators.
        // Math operators
        (char === '+' ||
          char === '-' ||
          char === '*' ||
          char === '/' ||
          char === '%' || // FIXME: Find a way to work with the `**` operator
          // Bitwise operators
          char === '~' ||
          char === '|' ||
          char === '^' || // FIXME: Find a way to work with the `<<` and `>>` bitwise operators
          // Other operators
          char === '.' ||
          char === ':' ||
          char === '!' ||
          char === '&' ||
          char === '=') &&
        next === '='
      ) {
        currTokenType = TokenType.Assignment
        nextSeek = third === '=' ? 3 : 2
      } else if (char === '=' && next !== '=') {
        currTokenType = TokenType.Assignment
      } else if (char === ':' && next === ':') {
        currTokenType = TokenType.Word
        nextSeek = 2
      } else if (
        (char === ':' && next !== ':') ||
        (char === '?' && next === ':')
      ) {
        currTokenType = TokenType.Colon
      } else {
        currTokenType = TokenType.Word
      }

      if (currTokenType !== lastTokenType) {
        if (tokenStartPos !== -1) {
          lt.tokens.push({
            type: lastTokenType,
            text: textline.text.substr(tokenStartPos, pos - tokenStartPos),
          })
        }

        lastTokenType = currTokenType
        tokenStartPos = pos

        if (
          lastTokenType === TokenType.Assignment ||
          lastTokenType === TokenType.Colon ||
          lastTokenType === TokenType.Arrow ||
          lastTokenType === TokenType.Comment
        ) {
          if (lt.sgfntTokens.indexOf(lastTokenType) === -1) {
            lt.sgfntTokens.push(lastTokenType)
          }
        }
      }

      // Skip to end of string
      if (currTokenType === TokenType.String) {
        ++pos
        while (pos < text.length) {
          let quote = text.charAt(pos)
          if (quote === char && text.charAt(pos - 1) !== '\\') {
            break
          }
          ++pos
        }
        if (pos >= text.length) {
          lastTokenType = TokenType.PartialString
        }
      }

      // Skip to end of block
      if (currTokenType === TokenType.Block) {
        ++pos
        let bracketCount = 1
        while (pos < text.length) {
          let bracket = text.charAt(pos)
          if (bracket === char) {
            ++bracketCount
          } else if (
            bracket === BRACKET_PAIR[char] &&
            text.charAt(pos - 1) !== '\\'
          ) {
            if (bracketCount === 1) {
              break
            } else {
              --bracketCount
            }
          }
          ++pos
        }
        if (pos >= text.length) {
          lastTokenType = TokenType.PartialBlock
        }
        // -1 then + nextSeek so keep pos not change in next loop
        // or we will lost symbols like "] } )"
      }

      if (char === '/') {
        // Skip to end if we encounter single line comment
        if (next === '/') {
          pos = text.length
        } else if (next === '*') {
          ++pos
          while (pos < text.length) {
            if (text.charAt(pos) === '*' && text.charAt(pos + 1) === '/') {
              ++pos
              currTokenType = TokenType.Word
              break
            }
            ++pos
          }
        }
      }

      pos += nextSeek
    }

    if (tokenStartPos !== -1) {
      lt.tokens.push({
        type: lastTokenType,
        text: textline.text.substr(tokenStartPos, pos - tokenStartPos),
      })
    }

    return lt
  }

  protected hasPartialToken(info: LineInfo): boolean {
    for (let j = info.tokens.length - 1; j >= 0; --j) {
      let lastT = info.tokens[j]
      if (
        lastT.type === TokenType.PartialBlock ||
        lastT.type === TokenType.EndOfBlock ||
        lastT.type === TokenType.PartialString
      ) {
        return true
      }
    }
    return false
  }

  protected hasSameIndent(info1: LineInfo, info2: LineInfo): boolean {
    var t1 = info1.tokens[0]
    var t2 = info2.tokens[0]

    if (t1.type === TokenType.Whitespace) {
      if (t1.text === t2.text) {
        return true
      }
    } else if (t2.type !== TokenType.Whitespace) {
      return true
    }

    return false
  }

  protected arrayAnd(array1: TokenType[], array2: TokenType[]): TokenType[] {
    var res: TokenType[] = []
    var map: any = {}
    for (var i = 0; i < array1.length; ++i) {
      map[array1[i]] = true
    }
    for (var i = 0; i < array2.length; ++i) {
      if (map[array2[i]]) {
        res.push(array2[i])
      }
    }
    return res
  }

  /*
   * Determine which blocks of code needs to be align.
   * 1. Empty lines is the boundary of a block.
   * 2. If user selects something, blocks are always within selection,
   *    but not necessarily is the selection.
   * 3. Bracket / Brace usually means boundary.
   * 4. Unsimilar line is boundary.
   */
  protected narrow(
    start: number,
    end: number,
    anchor: number,
    importantIndent: boolean
  ): LineRange {
    let anchorToken = this.tokenize(anchor)
    let range = { anchor, infos: [anchorToken] }

    let tokenTypes = anchorToken.sgfntTokens

    if (anchorToken.sgfntTokens.length === 0) {
      return range
    }

    if (this.hasPartialToken(anchorToken)) {
      return range
    }

    let i = anchor - 1
    while (i >= start) {
      let token = this.tokenize(i)

      if (this.hasPartialToken(token)) {
        break
      }

      let tt = this.arrayAnd(tokenTypes, token.sgfntTokens)
      if (tt.length === 0) {
        break
      }
      tokenTypes = tt

      if (importantIndent && !this.hasSameIndent(anchorToken, token)) {
        break
      }

      range.infos.unshift(token)
      --i
    }

    i = anchor + 1
    while (i <= end) {
      let token = this.tokenize(i)

      let tt = this.arrayAnd(tokenTypes, token.sgfntTokens)
      if (tt.length === 0) {
        break
      }
      tokenTypes = tt

      if (importantIndent && !this.hasSameIndent(anchorToken, token)) {
        break
      }

      if (this.hasPartialToken(token)) {
        range.infos.push(token)
        break
      }

      range.infos.push(token)
      ++i
    }

    let sgt
    if (tokenTypes.indexOf(TokenType.Assignment) >= 0) {
      sgt = TokenType.Assignment
    } else {
      sgt = tokenTypes[0]
    }
    for (let info of range.infos) {
      info.sgfntTokenType = sgt
    }

    return range
  }

  protected format(range: LineRange): string[] {
    // 0. Remove indentatioin, and trailing whitespace
    let indentation = ''
    let anchorLine = range.infos[0]
    const config = this.getConfig()

    if ((config.get('indentBase', 'firstline') as string) === 'activeline') {
      for (let info of range.infos) {
        if (info.line.lineNumber === range.anchor) {
          anchorLine = info
          break
        }
      }
    }
    if (!anchorLine.tokens.length) {
      return []
    }

    // Get indentation from multiple lines
    /*
            fasdf   !== 1231321;    => indentation = 0
        var abc   === 123;
        
            test := 1               => indentation = 4
            teastas := 2

        */
    let firstNonSpaceCharIndex = 0
    let min = Infinity
    let whiteSpaceType = ' '
    for (let info of range.infos) {
      firstNonSpaceCharIndex = info.line.text.search(/\S/)
      min = Math.min(min, firstNonSpaceCharIndex)
      if (info.tokens[0].type === TokenType.Whitespace) {
        whiteSpaceType = info.tokens[0].text[0] ?? ' '
        info.tokens.shift()
      }
      if (
        info.tokens.length > 1 &&
        info.tokens[info.tokens.length - 1].type === TokenType.Whitespace
      ) {
        info.tokens.pop()
      }
    }
    indentation = whiteSpaceType.repeat(min)
    /* 1. Special treatment for Word-Word-Operator ( e.g. var abc = )
        For example, without:

        var abc === 123;                var abc     === 123;
        var fsdafsf === 32423,  =>      var fsdafsf === 32423,
        fasdf !== 1231321;              fasdf       !== 1231321;

        with this :

        var abc === 123;                var abc     === 123;
        var fsdafsf === 32423,  =>      var fsdafsf === 32423,
        fasdf !== 1231321;                  fasdf   !== 1231321;
        */

    // Calculate first word's length
    let firstWordLength = 0
    for (let info of range.infos) {
      let count = 0
      for (let token of info.tokens) {
        if (token.type === info.sgfntTokenType) {
          count = -count
          break
        }
        // Skip calculate word length before block, See https://github.com/chouzz/vscode-better-align/issues/57
        if (token.type === TokenType.Block) {
          continue
        }
        if (token.type !== TokenType.Whitespace) {
          ++count
        }
      }

      if (count < -1) {
        firstWordLength = Math.max(firstWordLength, info.tokens[0].text.length)
      }
    }

    // Add white space after the first word
    if (firstWordLength > 0) {
      let wordSpace: Token = {
        type: TokenType.Insertion,
        text: whitespace(firstWordLength + 1),
      }
      let oneSpace: Token = { type: TokenType.Insertion, text: ' ' }

      for (let info of range.infos) {
        let count = 0
        for (let token of info.tokens) {
          if (token.type === info.sgfntTokenType) {
            count = -count
            break
          }
          if (token.type !== TokenType.Whitespace) {
            ++count
          }
        }

        if (count === -1) {
          info.tokens.unshift(wordSpace)
        } else if (count < -1) {
          if (info.tokens[1].type === TokenType.Whitespace) {
            info.tokens[1] = oneSpace
          } else if (info.tokens[0].type === TokenType.CommaAsWord) {
            info.tokens.splice(1, 0, oneSpace)
          }
          if (info.tokens[0].text.length !== firstWordLength) {
            let ws = {
              type: TokenType.Insertion,
              text: whitespace(firstWordLength - info.tokens[0].text.length),
            }
            if (info.tokens[0].type === TokenType.CommaAsWord) {
              info.tokens.unshift(ws)
            } else {
              info.tokens.splice(1, 0, ws)
            }
          }
        }
      }
    }

    // 2. Remove whitespace surrounding operator ( comma in the middle of the line is also consider an operator ).
    for (let info of range.infos) {
      let i = 1
      while (i < info.tokens.length) {
        if (
          info.tokens[i].type === info.sgfntTokenType ||
          info.tokens[i].type === TokenType.Comma
        ) {
          if (info.tokens[i - 1].type === TokenType.Whitespace) {
            info.tokens.splice(i - 1, 1)
            --i
          }
          if (
            info.tokens[i + 1] &&
            info.tokens[i + 1].type === TokenType.Whitespace
          ) {
            info.tokens.splice(i + 1, 1)
          }
        }
        ++i
      }
    }

    // 3. Align
    const configOP = config.get('operatorPadding') as string
    const configWS = config.get('surroundSpace')
    const stt = TokenType[range.infos[0].sgfntTokenType].toLowerCase()
    const configDef: any = {
      colon: [0, 1],
      assignment: [1, 1],
      comment: 2,
      arrow: [1, 1],
    }
    const configSTT = configWS[stt] || configDef[stt]
    const configComment = configWS['comment'] || configDef['comment']

    const rangeSize = range.infos.length

    let length = new Array<number>(rangeSize)
    length.fill(0)
    let column = new Array<number>(rangeSize)
    column.fill(0)
    let result = new Array<string>(rangeSize)
    result.fill(indentation)

    let exceed = 0 // Tracks how many line have reached to the end.
    let hasTrallingComment = false
    let resultSize = 0

    while (exceed < rangeSize) {
      let operatorSize = 0

      // First pass: for each line, scan until we reach to the next operator
      for (let l = 0; l < rangeSize; ++l) {
        let i = column[l]
        let info = range.infos[l]
        let tokenSize = info.tokens.length

        if (i === -1) {
          continue
        }

        let end = tokenSize
        let res = result[l]

        // Bail out if we reach to the trailing comment
        if (
          tokenSize > 1 &&
          info.tokens[tokenSize - 1].type === TokenType.Comment
        ) {
          hasTrallingComment = true
          if (
            tokenSize > 2 &&
            info.tokens[tokenSize - 2].type === TokenType.Whitespace
          ) {
            end = tokenSize - 2
          } else {
            end = tokenSize - 1
          }
        }

        for (; i < end; ++i) {
          let token = info.tokens[i]
          // Vertical align will occur at significant operator or subsequent comma
          if (
            token.type === info.sgfntTokenType ||
            (token.type === TokenType.Comma && i !== 0)
          ) {
            operatorSize = Math.max(operatorSize, token.text.length)
            break
          } else {
            res += token.text
          }
        }

        result[l] = res
        if (i < end) {
          resultSize = Math.max(resultSize, res.length)
        }

        if (i === end) {
          ++exceed
          column[l] = -1
          info.tokens.splice(0, end)
        } else {
          column[l] = i
        }
      }

      // Second pass: align
      for (let l = 0; l < rangeSize; ++l) {
        let i = column[l]
        if (i === -1) {
          continue
        }

        let info = range.infos[l]
        let res = result[l]

        let op = info.tokens[i].text
        if (op.length < operatorSize) {
          if (configOP === 'right') {
            op = whitespace(operatorSize - op.length) + op
          } else {
            op = op + whitespace(operatorSize - op.length)
          }
        }

        let padding = ''
        if (resultSize > res.length) {
          padding = whitespace(resultSize - res.length)
        }

        if (info.tokens[i].type === TokenType.Comma) {
          res += op
          if (i < info.tokens.length - 1) {
            res += padding + ' ' // Ensure there's one space after comma.
          }
          // Skip if there is only comment type without any operators.
        } else if (
          info.tokens.length === 1 &&
          info.tokens[0].type === TokenType.Comment
        ) {
          exceed++
          break
        } else {
          if (configSTT[0] < 0) {
            // operator will stick with the leftside word
            if (configSTT[1] < 0) {
              // operator will be aligned, and the sibling token will be connected with the operator
              let z = res.length - 1
              while (z >= 0) {
                let ch = res.charAt(z)
                if (ch.match(REG_WS)) {
                  break
                }
                --z
              }
              res =
                res.substring(0, z + 1) + padding + res.substring(z + 1) + op
            } else {
              res = res + op
              if (i < info.tokens.length - 1) {
                res += padding
              }
            }
          } else {
            res = res + padding + whitespace(configSTT[0]) + op
          }
          if (configSTT[1] > 0) {
            res += whitespace(configSTT[1])
          }
        }

        result[l] = res
        column[l] = i + 1
      }
    }

    // 4. Align trailing comment
    if (configComment < 0) {
      // It means user don't want to align trailing comment.
      for (let l = 0; l < rangeSize; ++l) {
        let info = range.infos[l]
        for (let token of info.tokens) {
          result[l] += token.text
        }
      }
    } else {
      resultSize = 0
      for (let res of result) {
        resultSize = Math.max(res.length, resultSize)
      }
      for (let l = 0; l < rangeSize; ++l) {
        let info = range.infos[l]
        if (info.tokens.length) {
          let res = result[l]
          result[l] =
            res +
            whitespace(resultSize - res.length + configComment) +
            info.tokens.pop()?.text
        }
      }
    }

    return result
  }
}
