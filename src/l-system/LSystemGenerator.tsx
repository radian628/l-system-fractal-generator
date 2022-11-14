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
    let arr = spec.axiom.concat();
    for (let i = 0; i < iterations; i++) {
        let arr2 = [];
        for (let j = 0; j < arr.length; j++) {
            const sub = spec.substitutions.get(arr[j]);
            if (!sub) {
                arr2.push(arr[j]);
                continue;
            }
            for (let k = 0; k < sub.length; k++) {
                arr2.push(sub[k]);
            }
        }
        arr = arr2;
    }
    return arr;
}

export function getIteratedLSystemLength<T>(spec: LSystemSpecification<T>, iterations: number) {
    const lengthCache = new Map<T, Map<number, number>>();
    function getLength(element: T, iterations: number): number {
        const cached = lengthCache.get(element)?.get(iterations);
        if (cached !== undefined) {
            return cached;
        }
        const sub = spec.substitutions.get(element);
        if (!sub || iterations == 0) return 1;
        const value = sub.reduce((prev, curr) => getLength(curr, iterations - 1) + prev, 0);
        let tLengthCache = lengthCache.get(element);
        if (!tLengthCache) {
            tLengthCache = new Map();
            lengthCache.set(element, tLengthCache);
        }
        tLengthCache.set(iterations, value);
        return value;
    }
    return spec.axiom.reduce((prev, curr) => getLength(curr, iterations) + prev, 0);
}

export function getIteratedLSystemDrawCount<T>(spec: LSystemSpecification<T>, app: LSystemApplication<T>, iterations: number) {
    const lengthCache = new Map<T, Map<number, number>>();
    function getDrawCount(element: T) {
        let drawCounter = 0;
        let draw = (m: mat4, v: vec3) => drawCounter++;
        let m = mat4.create();
        app.executions.get(element)?.(m, draw);
        return drawCounter;
    }
    function getLength(element: T, iterations: number): number {
        const cached = lengthCache.get(element)?.get(iterations);
        if (cached !== undefined) {
            return cached;
        }
        const sub = spec.substitutions.get(element);
        if (!sub || iterations == 0) return getDrawCount(element);
        const value = sub.reduce((prev, curr) => getLength(curr, iterations - 1) + prev, 0);
        let tLengthCache = lengthCache.get(element);
        if (!tLengthCache) {
            tLengthCache = new Map();
            lengthCache.set(element, tLengthCache);
        }
        tLengthCache.set(iterations, value);
        return value;
    }
    return spec.axiom.reduce((prev, curr) => getLength(curr, iterations) + prev, 0);
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