import { LSystemSpecification } from "../l-system/LSystemGenerator";
import {parser} from "./parser/parser"

export function compile(src: string): LSystemSpecification<string> {
    const tree = parser.parse(src);
    const replacements = tree.topNode.getChildren("Replacement");
    const commands = tree.topNode.getChildren("Command");
    const starts = tree.topNode.getChildren("Start");
    const constants = tree.topNode.getChildren("Constant");
}