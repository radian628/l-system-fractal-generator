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
import { compile, compileAST, CompilerError, LSystemDSLCompilerOutput } from "./Compiler";
import { useEffect, useRef, useState } from "react";
import { ast } from "./ASTGenerator";
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
  s scale1
  ;

left :
  rz angle2
  ;

right :
  s scale2,
  rz -1*angle2*1.4
  ;

pop :
  rz angle2*0.4,
  s 1/scale1,
  ry -1*angle1,
  s 1/scale2,
  dy -1
  ;

^ branch;`;
export function initCodeEditor(parent: HTMLElement,
  onSuccessfulRecompile: (output: ast.Root<ast.Range>) => void,
  additionalErrors: CompilerError[]
) {
  const initCompile = ast.lezerOutputToAST(sampleCode);
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
        const parseError = (e: CompilerError) => {
          return {
            from: e.start,
            to: e.end,
            severity: "error" as const,
            message: e.message
          }
        };

        //console.log("LEZER OUTPUT TO AST:", ast.lezerOutputToAST(view.state.sliceDoc()));
        const errors = compile(view.state.sliceDoc());
        const tree = ast.lezerOutputToAST(view.state.sliceDoc());
        if (tree.ok) {
          onSuccessfulRecompile(tree.data);
        }
        if (errors.ok) {
          return additionalErrors.map(parseError);
        }
        return errors.data.concat(additionalErrors).map(parseError);
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

export function noUndefined<T>(obj: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  //@ts-ignore
  return Object.fromEntries(Object.entries(obj).filter(([k, v]) => v !== undefined));
}

export function removeAttribs<T, K extends (keyof T)[]>(obj: T, ...props: K): Omit<T, K[number]> {
  let objCopy = { ...obj };
  for (let key of props) {
      delete objCopy[key];
  }
  return objCopy;
}

export function NumberInput(props: {
  val: number,
  min: number,
  max: number,
  step?: number,
  setVal: (s: number) => void,
  sensitivity: number,
  momentum?: number
} & React.HTMLAttributes<HTMLInputElement>) {
  const momentum = props.momentum ?? 0;
  const setValue = (x: string | number) => {
    const truncatedNum = props.step
        ? Math.floor(Number(x) / props.step) * props.step
        : Number(x);
    props.setVal(Math.max(props.min, Math.min(props.max, truncatedNum)));
  }

  const [vel, setVel] = useState(0);

  useEffect(() => {
    if (momentum == 0) return;
    const loop = () => {
      setVel(vel * momentum);
      setValue(props.val + vel * props.sensitivity);
    }

    if (vel > 0.01) {
      requestAnimationFrame(loop);
    }
  }, [vel]);

  return <input
      type="number"
      {...removeAttribs(props, "val", "setVal")}
      onInput={e => {
        setValue(e.currentTarget.value);
      }}
      value={props.val.toString()}
      onMouseDown={e => {
        e.currentTarget.requestPointerLock();
      }}
      onMouseMove={e => {
        if (document.pointerLockElement !== e.currentTarget) return;
        const velocity = e.movementX;
        setValue(props.val + velocity * props.sensitivity);
        setVel(velocity);
      }}
      onMouseUp={e => {
        document.exitPointerLock();
      }}
  ></input>
}

export function ConstantInput(props: {
  val: number,
  initVal: number,
  setVal: (n: number) => void,
  name: string
}) {
  const [localValue, setLocalValue] = useState(props.val);

  return <div>
    <label>{props.name}</label>
    <NumberInput
    sensitivity={props.initVal / 300}
    min={-Infinity}
    max={Infinity}
    val={localValue}
    setVal={e => {
      props.setVal(e);
      setLocalValue(e);
    }}
  ></NumberInput>
  </div>
}

export function LSystemCodeEditor(props: {
  onSuccessfulRecompile: (o: ast.Root<ast.Range>) => void,
  lastSuccessfulLSystem: ast.Root<ast.Range> | undefined,
  additionalErrors: CompilerError[],
  setAdditionalErrors: (err: CompilerError[]) => void,
  setLSystem: (lsystem: LSystemDSLCompilerOutput) => void,
  modifiedConstants: Map<string, number>,
  setModifiedConstants: (c: Map<string, number>) => void
}) {
  const [elem, setElem] = useState<HTMLElement>();

  const [isHovered, setIsHovered] = useState(false);

  const viewRef = useRef<EditorView>();

  useEffect(() => {
    if (!elem) return;

    const { view } = initCodeEditor(elem, props.onSuccessfulRecompile, props.additionalErrors);

    viewRef.current = view;

    const resizeListener = new ResizeObserver(() => {
      setElemSize(elem.getBoundingClientRect().width);
    });
    resizeListener.observe(elem);

    return () => view.destroy();
  }, [elem]);

  const [elemSize, setElemSize] = useState(0)

  return <div
    onMouseOver={e => setIsHovered(true)}
    onMouseOut={e => setIsHovered(false)}
    style={{ left: isHovered ? 0 : (-elemSize + 1) + "px" }}
    id="code-editor-root" >
      <div id="code-editor-content-root"
        ref={e => { 
          if (!e) return; 
          setElem(e);
        }}
      >
        {props.lastSuccessfulLSystem
        && Array.from(props.lastSuccessfulLSystem.constants.entries())
        .filter(([constName, constValue]) => constValue.type == ast.Type.NUMBER)
        .map(([constName, constValue]) => {
          const constValueNum = constValue as ast.Number<ast.Range>
          return <ConstantInput
            key={constName}
            name={constName}
            initVal={constValueNum.number}
            val={props.modifiedConstants.get(constName) ?? constValueNum.number}
            setVal={val => {
              props.setModifiedConstants(
                props.modifiedConstants.set(constName, val)
              );



              // viewRef.current?.dispatch({
              //   changes: {
              //     from: constValue.start,
              //     to: constValue.end,
              //     insert: val.toString()
              //   }
              // });
              // const state = viewRef.current?.state.sliceDoc();
              // if (!state) return;
              
              if (!props.lastSuccessfulLSystem) return;
              const compilerOutput = compileAST(props.lastSuccessfulLSystem, props.modifiedConstants);
              if (compilerOutput.ok) {
                props.setLSystem(compilerOutput.data);
              } else {
                props.setAdditionalErrors(compilerOutput.data);
              }

              

            }}
          ></ConstantInput>
        })}
      </div>
      <div className="hover-expander">▶</div>
    </div>
}