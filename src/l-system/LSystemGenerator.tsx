import { mat4 } from "gl-matrix";
import { err, ok, Result } from "../webgl-helpers/Common";

export type LSystemApplication<T> = {
    executions: Map<T, (m: mat4) => mat4>;
}

export type LSystemSpecification<T> = {
    alphabet: T[],
    substitutions: Map<T, T[]>,
    axiom: T[]
}

export function applyLSystem<T>(application: LSystemApplication<T>, code: T[]) {
    let matrix = mat4.create();
    const transformations = [mat4.create()] as mat4[];
    for (let instruction of code) {
        matrix = application.executions.get(instruction)?.(mat4.clone(matrix)) ?? matrix;
        transformations.push(matrix);
    }
    return transformations;
}

export function mapLSystemApplication<T, U>(
    app: LSystemApplication<T>, map: Map<T, U>
): Result<LSystemApplication<U>, string> {
    const exec = {
        executions: new Map(Array.from(app.executions.entries()).map(([k, v]) => {
            return [map.get(k), v] as const;
        }))
    };

    for (let key of exec.executions.keys()) {
        if (key === undefined) return err("Some keys in map not found.");
    }

    return ok(exec as LSystemApplication<U>);
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
        arr = arr.map(e => spec.substitutions.get(e) ?? e).flat();
    }
    return arr;
}