# Better Align for Visual Studio Code

[![The MIT License](https://badgen.net/github/license/cerner/terra-framework)](https://badgen.net/github/license/cerner/terra-framework)
[![GitHub Release](https://flat.badgen.net/github/release/chouzz/vscode-better-align)](https://github.com/chouzz/vscode-better-align/releases)
[![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/chouzz.vscode-better-align)](https://marketplace.visualstudio.com/items?itemName=Chouzz.vscode-better-align)
[![GitHub Actions Workflow](https://github.com/chouzz/vscode-better-align/actions/workflows/CI.yaml/badge.svg)](https://github.com/chouzz/vscode-better-align/actions/workflows/CI.yaml)

> **Better vertical alignment with or without selection in any language, for any characters or words.**

---

## ✨ Features

- 🌐 **Multi-language Support** - Align code in any programming language
- 🎯 **Smart Alignment** - Align with or without text selection
- ⚡ **Auto Align** - Automatically align after typing `Enter`

---

## 🚀 Usage

Place your cursor at the position where you want alignment, then:

- Press **`Alt + A`** (Windows/Linux) or **`Option + A`** (Mac)
- Or invoke the **`Align`** command via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)

---

## 📸 Demo

![Auto-align Characters](https://github.com/chouzz/vscode-better-align/blob/main/images/auto-align-characters.gif)

---

## ⚙️ Configuration

### `betterAlign.surroundSpace`

Control the spacing around alignment characters.

**Default Configuration:**

```jsonc
"betterAlign.surroundSpace": {
  "colon":      [0, 1],  // [left space, right space]
  "assignment": [1, 1],  // [left space, right space]
  "arrow":      [1, 1],  // [left space, right space]
  "comment":    2        // Space between code and trailing comment
}
```

**Configuration Options:**

| Key | Type | Description |
|-----|------|-------------|
| `colon` | `[number, number]` | Spacing around `:` (e.g., in objects/maps) |
| `assignment` | `[number, number]` | Spacing around `=` |
| `arrow` | `[number, number]` | Spacing around `=>` or `->` |
| `comment` | `number` | Space before trailing comments (negative = no alignment) |

---

### Examples

#### Object Properties Alignment

**Original Code:**
```javascript
var abc = {
  hello:      1
  ,my :2//comment
  ,friend:   3      // comment
}
```

**With `"colon": [0, 1]` and `"comment": 2`:**
```javascript
var abc = {
    hello : 1
  , my    : 2  // comment
  , friend: 3  // comment
}
```

**With `"colon": [1, 2]` and `"comment": 4`:**
```javascript
var abc = {
    hello  :  1
  , my     :  2    // comment
  , friend :  3    // comment
}
```

**With `"colon": [-1, 3]` and `"comment": 2`:**
```javascript
var abc = {
    hello:    1
  , my:       2  // comment
  , friend:   3  // comment
}
```

#### Arrow Function Alignment

**Original Code:**
```php
$data = array(
    'text' => 'something',
    'here is another' => 'sample'
);
```

**With `"arrow": [1, 3]`:**
```php
$data = array(
    'text'            =>   'something',
    'here is another' =>   'sample'
);
```

---

## 🐛 Issues & Contribution

- **Found a bug?** [Open an issue](https://github.com/chouzz/vscode-better-align/issues)
- **Want to contribute?** [Fork the repo](https://github.com/chouzz/vscode-better-align) and submit a pull request

---

## 📄 License

This work is licensed under the [Apache License 2.0](https://opensource.org/licenses/Apache-2.0).

---

## 🙏 Credits

The codebase is based on [better-align](https://github.com/WarWithinMe/better-align).
Special thanks to [@WarWithinMe](https://github.com/WarWithinMe).
