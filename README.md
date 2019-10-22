# spell-wa

Spell Checker for VS Code based on

* Hunspell
* Tree Sitter
* Web Assembly

Tree Sitter is used to analyze the source code and provide ranges of Comments and Strings and Hunspell is the engine for spell checking. Both libraries are compiled to Web Assembly to avoid native module mismatch in VS Code extension host.

Still in its early stage.