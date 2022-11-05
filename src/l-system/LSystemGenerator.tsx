import { err, ok, Result } from "../webgl-helpers/Common";

export type LSystemSpecification<T> = {
    alphabet: T[],
    substitutions: Map<T, T[]>,
    axiom: T[]
}

export function optimizeLSystemSpec(spec: LSystemSpecification<string>): 
    Result<{
        spec: LSystemSpecification<number>,
        map: Map<string, number>
    }, string>{
    const alphabetMap = new Map<string, number>();
    let index = 0;
    for (const k of spec.alphabet) {
        alphabetMap.set(k, index++);
    }
    const axiom = spec.axiom.map(c => alphabetMap.get(c));
    for (const axiomElem of axiom) {
        if (typeof axiomElem == "undefined") {
            return err("Axiom must consist of members from alphabet.");
        }
    }

    const substitutions = new Map<number, number[]>();
    for (const [k, v] of spec.substitutions) {
        const sub: number[] = [];
        for (const subElem of v) {
            const index = alphabetMap.get(subElem);
            if (index === undefined) return err("Substitutions must consist of members from alphabet.");
            sub.push(index);
        }
        const keyindex = alphabetMap.get(k);
        if (keyindex === undefined) return err("Substitutions must consist of members from alphabet.");
        substitutions.set(keyindex, sub);
    }

    return ok({
        spec: {
            alphabet: new Array(spec.alphabet.length).fill(0).map((e, i) => i),
            substitutions,
            axiom: axiom as number[]
        },
        map: alphabetMap
    });
}

export function iterateLSystem(spec: LSystemSpecification<number>, iterations: number) {
    console.log(spec);
    let arr = spec.axiom.concat();
    for (let i = 0; i < iterations; i++) {
        arr = arr.map(e => spec.substitutions.get(e) as number[]).flat();
    }
    return arr;
}