import { mat4, vec3 } from "gl-matrix";
import { err, ok, Result } from "../webgl-helpers/Common";

export type LSystemApplication<T> = {
    executions: Map<T, (m: mat4, draw: (m: mat4, v: vec3) => void) => mat4>;
}

export type LSystemSpecification<T> = {
    alphabet: T[],
    substitutions: Map<T, T[]>,
    axiom: T[]
}

export type LSystemAppResult = {
    transformations: mat4[],
    composedTransformation: mat4
}

export function applyLSystem<T>(application: LSystemApplication<T>, code: T[]): LSystemAppResult {
    let matrix = mat4.create();
    const transformations = [] as mat4[];
    const draw = (m4: mat4, v3: vec3) => {
        transformations.push(
            mat4.translate(mat4.clone(m4), m4, 
            vec3.mul(vec3.clone(v3), v3, vec3.fromValues(0.5, 0.5, 0.5)))
        );
        mat4.translate(m4, m4, v3);
    }
    for (let instruction of code) {
        matrix = application.executions.get(instruction)?.(mat4.clone(matrix), draw) ?? matrix;
        //transformations.push(matrix);
    }
    console.log(transformations);
    return {
        transformations,
        composedTransformation: matrix
    };
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

export type OptAndApplyLSystemResult = {
    alphabetResults: Map<number, LSystemAppResult>
    totalResult: number[],
    alphabetTransformationLists: Map<number, mat4[]>
};

export function optimizeAndApplyLSystem(
    spec: LSystemSpecification<string>, 
    rules: LSystemApplication<string>,
    mainIterations: number,
    subtreeIterations: number
): Result<OptAndApplyLSystemResult, string> {
    const optLSystem = optimizeLSystemSpec(spec);
    if (!optLSystem.ok) return optLSystem;
    const optRules = mapLSystemApplication(rules, optLSystem.data.map);
    if (!optRules.ok) return optRules;

    const alphabetResults = new Map<number, LSystemAppResult>();
    const alphabetTransformationLists = new Map<number, mat4[]>();
    for (const num of optLSystem.data.spec.alphabet) {
        alphabetTransformationLists.set(num, []);
        alphabetResults.set(num, applyLSystem<number>(optRules.data, iterateLSystem(
            {
                ...optLSystem.data.spec,
                axiom: [num]
            },
            subtreeIterations
        )));
    }

    const totalResult = iterateLSystem(optLSystem.data.spec, mainIterations);

    const m = mat4.create();

    for (const result of totalResult) {
        const tlist = alphabetTransformationLists.get(result);
        tlist?.push(mat4.clone(m));
        mat4.mul(m, m, alphabetResults.get(result)?.composedTransformation ?? mat4.create());
    }

    return ok({
        alphabetResults,
        totalResult,
        alphabetTransformationLists
    });
}