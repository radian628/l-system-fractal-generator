import { LSystemApplication, LSystemSpecification } from "../l-system/LSystemGenerator";
import {parser } from "./parser/parser"
import { SyntaxNode } from "@lezer/common";
import { err, ok, okmap, Result } from "../webgl-helpers/Common";
import { mat4, vec3 } from "gl-matrix";

type CompilerError = { start: number, end: number, message: string };
type MaybeEvalExpr = Result<number, CompilerError> ;

/*
Defined compiler functions:
move functions:   m mx my mz
draw functions:   d dx dy dz
scale functions:  x sx sy sz
rotate functions: r rx ry rz

rotate uses angle-axis notation:
    e.g. "r 2 0 0 1" would rotate 2 degrees about the positive z axis

the scale function will have two options: one param and three params

each function will also have aliases

*/

export const lSystemFunctionTable: {
    [key: string]: {
        fn: (m: mat4, d: (m: mat4, v: vec3) => void, ...args: number[]) => void,
        argc: number,
        aliases: string[]
    }[]
} = {
    // move commands
    m: [{
        fn: (m, d, x, y, z) => mat4.translate(m, m, vec3.fromValues(x, y, z)),
        argc: 3,
        aliases: ["move"]
    }],
    mx: [{ 
        fn: (m, d, s) => mat4.translate(m, m, vec3.fromValues(s, 0, 0)), argc: 1,
        aliases: ["movex"]
    }],
    my: [{ 
        fn: (m, d, s) => mat4.translate(m, m, vec3.fromValues(0, s, 0)), argc: 1,
        aliases: ["movey"]
    }],
    mz: [{ 
        fn: (m, d, s) => mat4.translate(m, m, vec3.fromValues(0, 0, s)), argc: 1,
        aliases: ["movez"]
    }],

    // draw commands
    d: [{
        fn: (m, d, x, y, z) => d(m, vec3.fromValues(x, y, z)),
        argc: 3,
        aliases: ["move"]
    }],
    dx: [{ 
        fn: (m, d, s) => d(m, vec3.fromValues(s, 0, 0)), argc: 1,
        aliases: ["movex"]
    }],
    dy: [{ 
        fn: (m, d, s) => d(m, vec3.fromValues(0, s, 0)), argc: 1,
        aliases: ["movey"]
    }],
    dz: [{ 
        fn: (m, d, s) => d(m, vec3.fromValues(0, 0, s)), argc: 1,
        aliases: ["movez"]
    }],

    // rotate commands
    r: [{
        fn: (m, d, angle, ax, ay, az) => 
            mat4.rotate(m, m, angle * Math.PI / 180, vec3.fromValues(ax, ay, az)),
        argc: 4,
        aliases: ["rotate"]
    }],
    rx: [{ fn: (m, d, a) => mat4.rotateX(m, m, a), argc: 1, aliases: ["rotatex"] }],
    ry: [{ fn: (m, d, a) => mat4.rotateY(m, m, a), argc: 1, aliases: ["rotatey"] }],
    rz: [{ fn: (m, d, a) => mat4.rotateZ(m, m, a), argc: 1, aliases: ["rotatez"] }],

    // scale commands
    s: [
        {
            fn: (m, d, f) =>
                mat4.scale(m, m, vec3.fromValues(f, f, f)),
            argc: 1, aliases: ["scale"]
        },
        {
            fn: (m, d, x, y, z) =>
                mat4.scale(m, m, vec3.fromValues(x, y, z)),
            argc: 3, aliases: ["scale"]
        }
    ],
    sx: [{ fn: (m, d, f) => mat4.scale(m, m, vec3.fromValues(f, 0, 0)),
        argc: 1, aliases: ["scalex"]
    }],
    sy: [{ fn: (m, d, f) => mat4.scale(m, m, vec3.fromValues(0, f, 0)),
        argc: 1, aliases: ["scaley"]
    }],
    sz: [{ fn: (m, d, f) => mat4.scale(m, m, vec3.fromValues(0, 0, f)),
        argc: 1, aliases: ["scalez"]
    }],
}

for (let [k, v] of Object.entries(lSystemFunctionTable)) {
    for (let overload of v) {
        for (let alias of overload.aliases) {
            lSystemFunctionTable[alias] = v;
        }
        overload.aliases = Array.from(new Set(...overload.aliases, k));
    }
}

export function evaluateExpression(constants: Map<string, number>, src: string, root: SyntaxNode): 
    MaybeEvalExpr {
    const str = (node: SyntaxNode): string => {
        return src.slice(node.from, node.to);
    }
    function makeErr(message: string): MaybeEvalExpr {
        return err({
            start: root.from,
            end: root.to,
            message
        });
    }

    // const cursor = root.cursor();
    // do {
    //     console.log("name", cursor.node.name, "str", str(cursor.node));
    // } while (cursor.next()); 

    while (
        (
            root.name != "Variable"
            && root.name != "Number"
            && root.name != "Operation"
            && root.name != "Parenthesized"
        )
        && root.firstChild) {
        root = root.firstChild;
    }

    const strRoot = str(root);

    console.log("rootname", root.name, "rootstr", str(root));

    switch (root.name) {
        case "Variable":
            const varValue = constants.get(strRoot);
            if (varValue === undefined) {
                return makeErr(`Variable '${varValue}' is not defined.`);
            }
            return ok(varValue);
        case "Number":
            return ok(Number(strRoot));
        case "Operation":
            const [lhs, rhs] = root.getChildren("Expression");
            const op = root.getChild("Op");
            if (!lhs || !rhs || !op) return makeErr("Err");
            const elhs = evaluateExpression(constants, src, lhs);
            const erhs = evaluateExpression(constants, src, rhs);
            if (!elhs.ok) return elhs;
            if (!erhs.ok) return erhs;
            const l = elhs.data;
            const r = erhs.data;
            console.log("str op", str(op));
            switch (str(op)) {
                case "+": return ok (l + r);
                case "-": return ok (l - r);
                case "*": return ok (l * r);
                case "/": return ok (l / r);
                default:
                return makeErr(`This type of operation is unsupported. Contact a developer if this error occurs.`);
            }
        case "Parenthesized":
            const operand = root.getChild("Operand");
            if (!operand) return makeErr("Err");
            return evaluateExpression(constants, src, operand);
        default:
            return makeErr(`This type of expression is unsupported. Contact a developer if this error occurs.`);
    }

}

export function compile(src: string): Result<
    { spec: LSystemSpecification<string>, app: LSystemApplication<string> },
    CompilerError[]
> {
    const str = <T extends SyntaxNode | null>(node: T): (T extends SyntaxNode ? string : undefined) => {
        if (node) {
            return src.slice(node.from, node.to) as (T extends SyntaxNode ? string : undefined);
        } else {
            return undefined as (T extends SyntaxNode ? string : undefined);
        }
    }
    const tree = parser.parse(src);
    const replacements = tree.topNode.getChildren("Replacement");
    const commands = tree.topNode.getChildren("Command");
    const starts = tree.topNode.getChildren("Start");
    const constants = tree.topNode.getChildren("Constant");

    const errors: {
        start: number,
        end: number,
        message: string
    }[] = []

    const alphabetSet: Set<string> = new Set();

    const constantMap = new Map<string, number>();

    function makeErr(node: SyntaxNode, message: string) {
        errors.push({
            start: node.from,
            end: node.to,
            message
        });
    }

    for (let constant of constants) {
        const lhs = constant.getChild("Variable");
        if (!lhs) {
            makeErr(constant, "Assignment statement must assign to a variable.");
            continue;
        }
        const rhs = constant.getChild("Expression");
        if (!rhs) {
            makeErr(constant, "Assignment statement must have a right-hand side. Consider putting an arithmetic expression here.");
            continue;
        }
        const evalExpr = evaluateExpression(constantMap, src, rhs);
        if (!evalExpr.ok) {
            errors.push(evalExpr.data);
            continue;
        }

        constantMap.set(str(lhs), evalExpr.data);
    }

    console.log("constant map", constantMap);

    const codeMap = new Map<string, 
        {
            commands: {
                name: string,
                operands: number[]
            }[]
        }
    >();

    const replacementMap = new Map<string, 
        string[]
    >();

    // parse replacements
    for (let replacement of replacements) {
        const lSymbol = replacement.getChild("LSymbol");
        const lSymbolStr = str(lSymbol);
        if (lSymbolStr) {
            alphabetSet.add(lSymbolStr);
        } else {
            continue;
        }

        replacementMap.set(lSymbolStr, []);

        const symbolResults = replacement.getChildren("Symbol");
        for (let symbolResult of symbolResults) {
            const symbolResultStr = str(symbolResult);
            if (symbolResultStr) {
                alphabetSet.add(symbolResultStr);
            } else {
                continue;
            }
            replacementMap.get(lSymbolStr)?.push(symbolResultStr);
        }

    }

    // parse commands
    for (let command of commands) {
        const instructionSymbol = command.getChild("Symbol");
        const instructionSymbolStr = str(instructionSymbol);
        if (!instructionSymbol || !instructionSymbolStr) continue;
        if (!alphabetSet.has(instructionSymbolStr)) {
            errors.push({
                start: instructionSymbol.from,
                end: instructionSymbol.to,
                message: `Alphabet does not contain the symbol '${instructionSymbolStr}'. You may have spelled it wrong or forgot to add it to a production rule.`
            });
        }

        const commandInfo: {
            name: string,
            operands: number[]
        }[] = [];

        const instructions = command.getChildren("Instruction");
        for (let instruction of instructions) {
            const instructionName = instruction.getChild("CommandName");
            if (!instructionName) {
                makeErr(instruction, `Instruction does not have a name.`);
                continue;
            }
            const expressionTrees = instruction.getChildren("InstructionArg");        
            const operands = expressionTrees.map(e => evaluateExpression(constantMap, src, e));
            operands.forEach((operand, i) => {
                if (!operand.ok) {
                    makeErr(expressionTrees[i], "Operand is not defined.");
                }
            });
            commandInfo.push({
                name: str(instructionName),
                operands: operands.filter(t => t.ok).map(t => t.data) as number[]
            });
        }

        codeMap.set(instructionSymbolStr, {
            commands: commandInfo
        });
    }

    const alphabet = Array.from(alphabetSet);

    console.log(alphabetSet, codeMap, replacementMap);

    // const spec: LSystemSpecification<string> = {

    // }

    if (starts.length > 1) {
        makeErr(starts[1], "An L-system may not have more than one start sequence.");
    }

    if (errors.length > 0) {
        console.log(errors);
        return err(errors);
    } else {
        return ok({
            spec: {
                alphabet,
                substitutions: replacementMap,
                axiom: starts[0].getChildren("Symbol").map(s => str(s as SyntaxNode))
            },
            app: {
                executions: new Map(
                    Array.from(codeMap.entries()).map(([k, v]) => {
                        const drawInstructions: {
                            mat: mat4,
                            inv: mat4,
                            v: vec3
                        }[] = [];
                        const matrix = mat4.create();
                        for (let instr of v.commands) {
                            lSystemFunctionTable[instr.name][0]?.fn
                                (matrix, (m, v) => drawInstructions.push({ v, mat: mat4.clone(m), inv: mat4.invert(mat4.create(), m)}), ...instr.operands);
                        }
                        return [k, (m: mat4, draw: (m: mat4, v: vec3) => void) => {
                            for (const instr of drawInstructions) {
                                mat4.multiply(m, m, instr.mat);
                                draw(m, instr.v);
                                mat4.multiply(m, m, instr.inv);
                            }
                            mat4.multiply(m, m, matrix);
                            return m;
                        }];
                    }))
            }
        })
    }
}