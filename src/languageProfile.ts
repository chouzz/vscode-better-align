export interface LanguageProfile {
    // Regular expression for matching single-line comments
    lineCommentRegex: RegExp;

    // Regular expression for matching block comments (start and end)
    blockCommentStartRegex: RegExp;
    blockCommentEndRegex: RegExp;

    // Set of characters that can start a string literal
    stringDelimiters: Set<string>;

    // Set of assignment operators
    assignmentOperators: Set<string>;

    // Set of other operators that should be aligned
    otherOperators: Set<string>;

    // TODO: Add more language-specific properties as needed, for example:
    // - Keywords that should affect alignment
    // - Rules for handling different types of brackets/braces
    // - Indentation rules
}
