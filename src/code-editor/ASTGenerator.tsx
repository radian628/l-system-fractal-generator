import { Tree } from "@lezer/common";
import { CompilerError } from "./Compiler";
import { LSystemApplication, LSystemSpecification } from "../l-system/LSystemGenerator";
import {parser } from "./parser/parser"
import { SyntaxNode } from "@lezer/common";
import { err, ok, okmap, Result, isok } from "../webgl-helpers/Common";
import { mat4, vec3 } from "gl-matrix";

export namespace ast {
    export enum Type {
        VAR,
        BINOP,
        NUMBER,
        ROOT
    }

    export type Var<T> = {
        type: Type.VAR,
        name: string
    } & T;

    export type Binop<T> = {
        type: Type.BINOP,
        left: ExprNode<T>,
        right: ExprNode<T>,
        op: "+" | "-" | "*" | "/"
    } & T;

    export type Number<T> = {
        type: Type.NUMBER,
        number: number,
    } & T;

    export type ExprNode<T> = 
        Var<T>
        | Binop<T>
        | Number<T>;

    export type Root<T> = {
        type: Type.ROOT,
        alphabet: Set<string>,
        executions: Map<string, {
            start: number,
            end: number,
            operation: string,
            operands: ExprNode<T>[]
        }[]>,
        constants: Map<string, ExprNode<T>>,
        replacements: Map<string, string[]>,
        axiom: string[]
    } & T;

    export type Range = {
        start: number,
        end: number
    };


    export function evaluateExpression(constants: Map<string, any>, src: string, root: SyntaxNode): 
    Result<ExprNode<Range>, CompilerError> {
        const str = (node: SyntaxNode): string => {
            return src.slice(node.from, node.to);
        }
        function makeErr(message: string): Result<ExprNode<Range>, CompilerError> {
            return err({
                start: root.from,
                end: root.to,
                message
            });
        }

        function makeOk(message: ExprNode<{}>) {
            return ok({
                ...message,
                start: root.from,
                end: root.to
            });
        }

        function rangeify<T>(t: T): T & Range {
            return {
                ...t,
                start: root.from,
                end: root.to
            }
        }

        function rok<T>(t: T): Result<T & Range, CompilerError> {
            return ok(rangeify(t));
        }

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

        switch (root.name) {
            case "Variable":
                const varValue = constants.get(strRoot);
                if (varValue === undefined) {
                    return makeErr(`Variable '${varValue}' is not defined.`);
                }
                return rok({ type: Type.VAR, name: strRoot });
            case "Number":
                return rok({ type: Type.NUMBER, number: Number(strRoot) });
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
                let opstr = str(op);
                switch (opstr) {
                    case "+":
                    case "-":
                    case "*":
                    case "/": 
                        break;
                    default:
                    return makeErr(`This type of operation is unsupported. Contact a developer if this error occurs.`);
                }
                return rok({
                    type: Type.BINOP,
                    op: opstr,
                    left: l,
                    right: r
                });
            case "Parenthesized":
                const operand = root.getChild("Operand");
                if (!operand) return makeErr("Err");
                return evaluateExpression(constants, src, operand);
            default:
                return makeErr(`This type of expression is unsupported. Contact a developer if this error occurs.`);
        }

    }

    export function lezerOutputToAST(src: string): 
        Result<Root<Range>, CompilerError[]>
    {
        
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

        const errors: CompilerError[] = []

        function makeErr(node: SyntaxNode, message: string) {
            errors.push({
                start: node.from,
                end: node.to,
                message
            });
        }

        const root: Root<Range> = {
            type: Type.ROOT,
            alphabet: new Set(),
            executions: new Map(),
            constants: new Map(),
            replacements: new Map(),
            axiom: [],
            start: 0,
            end: src.length - 1
        };

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
            const evalExpr = evaluateExpression(root.constants, src, rhs);
            if (!evalExpr.ok) {
                errors.push(evalExpr.data);
                continue;
            }
            //str(lhs), evalExpr.data
            root.constants.set(str(lhs), evalExpr.data);
        }

        // parse replacements
        for (let replacement of replacements) {
            const lSymbol = replacement.getChild("LSymbol");
            const lSymbolStr = str(lSymbol);
            if (lSymbol && lSymbolStr) {
                root.alphabet.add(lSymbolStr);
            } else {
                continue;
            }


            if (root.replacements.get(lSymbolStr) !== undefined) {
                makeErr(replacement, `A replacement for the symbol '${lSymbolStr}' already exists!`);
                continue;
            }

            root.replacements.set(lSymbolStr, []);

            const symbolResults = replacement.getChildren("Symbol");
            for (let symbolResult of symbolResults) {
                const symbolResultStr = str(symbolResult);
                if (symbolResultStr) {
                    root.alphabet.add(symbolResultStr);
                } else {
                    continue;
                }
                root.replacements.get(lSymbolStr)?.push(symbolResultStr);
            }

        }

        // parse commands
        for (let command of commands) {
            const instructionSymbol = command.getChild("Symbol");
            const instructionSymbolStr = str(instructionSymbol);
            if (!instructionSymbol || !instructionSymbolStr) continue;
            if (!root.alphabet.has(instructionSymbolStr)) {
                errors.push({
                    start: instructionSymbol.from,
                    end: instructionSymbol.to,
                    message: `Alphabet does not contain the symbol '${instructionSymbolStr}'. You may have spelled it wrong or forgot to add it to a production rule.`
                });
            }

            const commandInfo: {
                start: number,
                end: number,
                operation: string,
                operands: ExprNode<Range>[]
            }[] = [];

            const instructions = command.getChildren("Instruction");
            for (let instruction of instructions) {
                const instructionName = instruction.getChild("CommandName");
                if (!instructionName) {
                    makeErr(instruction, `Instruction does not have a name.`);
                    continue;
                }
                const expressionTrees = instruction.getChildren("InstructionArg");        
                const operands = expressionTrees.map(e => evaluateExpression(root.constants, src, e));
                const validOperands: ExprNode<Range>[] = [];
                operands.forEach((operand, i) => {
                    if (!operand.ok) {
                        errors.push(operand.data);
                    } else {
                        validOperands.push(operand.data);
                    }
                });

                commandInfo.push({
                    start: instruction.from,
                    end: instruction.to,
                    operation: str(instructionName),
                    operands: validOperands
                });
            }

            root.executions.set(instructionSymbolStr, commandInfo);
        }

        if (starts.length > 1) {
            makeErr(starts[1], "An L-system may not have more than one start sequence, or axiom.");
        }

        if (starts.length == 0) {
            makeErr(tree.topNode, "An L-system must have exactly one start sequence, or axiom.");
        } else {
            const axiomSymbols = starts[0].getChildren("Symbol");
            for (const symbol of axiomSymbols) {
                root.axiom.push(str(symbol));
            }
        }

                

        if (errors.length > 0) {
            return err(errors);
        } else {
            return ok(root);
        }
    }
}
