# Better Align for Visual Studio Code

[![The MIT License](https://badgen.net/github/license/cerner/terra-framework)](https://badgen.net/github/license/cerner/terra-framework)
[![GitHub](https://flat.badgen.net/github/release/chouzz/vscode-better-align)](https://github.com/chouzz/vscode-better-align/releases)
[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/i/chouzz.vscode-better-align
](https://marketplace.visualstudio.com/items?itemName=Chouzz.vscode-better-align)
[![Github Actions](https://github.com/chouzz/vscode-better-align/actions/workflows/CI.yaml/badge.svg)](https://github.com/chouzz/vscode-better-align/actions/workflows/CI.yaml)

Better vertical alignment with/without selection in any language for any characters or words.

## Features

- Allow align code in any language
- Smart align with or without selection
- Auto align after you type enter

## Usage

Place your cursor at where you want your code to be aligned, and use shortcut `alt + A` or invoke the `Align` command via Command Palette.

## Screenshots

![auto-align-characters.gif](https://github.com/chouzz/vscode-better-align/blob/main/images/auto-align-characters.gif)

## Extension Configuration

### `betterAlign.surroundSpace`

Default value:

```json
betterAlign.surroundSpace : {
  "colon"      : [0, 1], // The first number specify how much space to add to the left, can be negative.
                         // The second number is how much space to the right, can be negative.
  "assignment" : [1, 1], // The same as above.
  "arrow"      : [1, 1], // The same as above.
  "comment"    : 2       // Special how much space to add between the trailing comment and the code.
                         // If this value is negative, it means don't align the trailing comment.
}
```

```javascript
// Orignal code
var abc = {
  hello:      1
  ,my :2//comment
  ,friend:   3      // comment
}

// "colon": [0, 1]
// "comment": 2
var abc = {
    hello : 1
  , my    : 2  // comment
  , friend: 3  // comment
}

// "colon": [1, 2]
// "comment": 4
var abc = {
    hello  :  1
  , my     :  2    // comment
  , friend :  3    // comment
}

// "colon": [-1, 3]
// "comment": 2
var abc = {
    hello:    1
  , my:       2  // comment
  , friend:   3  // comment
}

// "colon": [-1, -1]
// "comment": 2
var abc = {
     hello:1
  ,     my:2  //comment
  , friend:3  // comment
}


// Orignal code
$data = array(
    'text' => 'something',
    'here is another' => 'sample'
);

// "arrow": [1, 3]
$data = array(
    'text'            =>   'something',
    'here is another' =>   'sample'
);

```

## Issues/Contribution

If you've found a bug, please file at <https://github.com/chouzz/vscode-better-align/issues>.

If you'd like to help out, fork the [repo](https://github.com/chouzz/vscode-better-align) and submit pull requests.

## License

This work is licensed under [Apache License 2.0](https://opensource.org/licenses/Apache-2.0)

## Credit

The codebase is based on [this repository](https://github.com/WarWithinMe/better-align). Thanks @WarWithinMe.
