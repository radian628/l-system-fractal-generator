// general codemirror stuff
import {EditorState} from "@codemirror/state"
import {EditorView, keymap, lineNumbers} from "@codemirror/view"
import {defaultKeymap} from "@codemirror/commands"
import {basicSetup} from "codemirror";
import {oneDark} from "@codemirror/theme-one-dark"
import {indentWithTab} from "@codemirror/commands"

// parsing/lang server
import {parser} from "./parser/parser"
import {foldNodeProp, foldInside, indentNodeProp} from "@codemirror/language"
import {styleTags, tags as t} from "@lezer/highlight"
import {LRLanguage, LanguageSupport} from "@codemirror/language"

import "./CodeEditor.css";
import { compile } from "./Compiler";
export const sampleCode = `
angle1 = 30+15;
angle2 = 30;

branch -> 
  push
  left
  branch
  right
  branch
  pop;

push :
  my 1,
  ry angle1,
  s 0.8;

left :
  rz angle2;

right :
  rz -1*angle2;

pop :
  rz angle2,
  s 1.25,
  ry -1*angle1,
  dy -1;

^ branch;`;
export function initCodeEditor() {

    console.log(compile(sampleCode));
    // console.log(tree);
    // console.log(tree.topNode);
    // console.log(tree.type);
    // console.log(tree.topNode.getChildren("Replacement"));
    // console.log(tree.topNode.getChildren("Command"));
    // console.log(tree.topNode.getChildren("Start"));
    // console.log(tree.topNode.getChildren("Constant"));

    let parserWithMetadata = parser.configure({
        props: [
            styleTags({
                Symbol: t.string,
                LSymbol: t.string,
                Variable: t.variableName,
                CommandName: t.keyword,
                Number: t.number,
                LineComment: t.lineComment,
                "( )": t.paren,
                '-> | "*" | "/" | + | - | =': t.operator
            }),
            // indentNodeProp.add({
            //     Instruction: context => context.column(context.node.from) + context.unit
            // }),
            // foldNodeProp.add({
            //     Instruction: foldInside
            // })
        ]
    });

    const lang = LRLanguage.define({
        parser: parserWithMetadata,
        languageData: {
            commentTokens: { line: "//" }
        }
    })

    let startState = EditorState.create({
    doc: sampleCode,
    extensions: [
        keymap.of(defaultKeymap), 
        basicSetup, 
        lineNumbers(), 
        oneDark, 
        keymap.of([indentWithTab]),
        new LanguageSupport(lang, [])
    ]
    })

    const codeEditorRoot = document.getElementById("code-editor-root");
    if (!codeEditorRoot) {
        throw new Error("failed to get code editor root");
    }

    let view = new EditorView({
        state: startState,
        parent: codeEditorRoot
    });
}