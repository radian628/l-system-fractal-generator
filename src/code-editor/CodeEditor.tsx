// general codemirror stuff
import {EditorState} from "@codemirror/state"
import {EditorView, keymap, lineNumbers} from "@codemirror/view"
import {lintGutter, linter} from "@codemirror/lint";
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
import { compile, LSystemDSLCompilerOutput } from "./Compiler";
import { useEffect, useRef, useState } from "react";
export const sampleCode = 
`angle1 = 123;
angle2 = 30;
scale1 = 0.8;
scale2 = 0.95;

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
  s scale1;

left :
  rz angle2;

right :
  s scale2,
  rz -1*angle2*1.4;

pop :
  rz angle2*0.4,
  s 1/scale1,
  ry -1*angle1,
  s 1/scale2,
  dy -1;

^ branch;`;
export function initCodeEditor(parent: HTMLElement,
  onSuccessfulRecompile: (output: LSystemDSLCompilerOutput) => void  
) {
  const initCompile = compile(sampleCode);
  if (initCompile.ok) onSuccessfulRecompile(initCompile.data);

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
      })
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
      linter((view) => {
        const errors = compile(view.state.sliceDoc());
        if (errors.ok) {
          onSuccessfulRecompile(errors.data);
          return [];
        }
        return errors.data.map(e => {
          return {
            from: e.start,
            to: e.end,
            severity: "error",
            message: e.message
          }
        })
      }),
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
      parent
  });
  
  return { view };
}

export function LSystemCodeEditor(props: {
  onSuccessfulRecompile: (o: LSystemDSLCompilerOutput) => void
}) {
  const [elem, setElem] = useState<HTMLElement>();

  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!elem) return;

    const { view } = initCodeEditor(elem, props.onSuccessfulRecompile);

    return () => view.destroy();
  }, [elem]);

  const elemSizeRef = useRef(0);

  return <div
    onMouseOver={e => setIsHovered(true)}
    onMouseOut={e => setIsHovered(false)}
    style={{ left: isHovered ? 0 : (-elemSizeRef.current  +1) + "px" }}
    id="code-editor-root" 
    ref={e => { 
      if (!e) return; 
      elemSizeRef.current = e.getBoundingClientRect().width;
      setElem(e);
    }}><div className="hover-expander">▶</div></div>
}