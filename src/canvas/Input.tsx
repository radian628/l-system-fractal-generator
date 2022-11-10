import { useEffect, useRef, useState } from "react";

export function useInput(pointerLockRef: React.RefObject<HTMLElement | undefined>) {
    
    const inputRef = useRef({
        keysDown: {} as { [key: string]: boolean },
        mouseDeltas: {
            x: 0, y: 0
        }
    });
    
    useEffect(() => {
        if (!pointerLockRef.current) return;

        const click = (e: MouseEvent) => {
            if (e.target === pointerLockRef.current) {
                pointerLockRef.current?.requestPointerLock();
            }
        }
        document.addEventListener("click", click);


        const keydown = (e: KeyboardEvent) => {
            if (document.pointerLockElement !== pointerLockRef.current) return;
            inputRef.current.keysDown[e.key.toUpperCase()] = true;
        }
        document.addEventListener("keydown", keydown);
        

        const keyup = (e: KeyboardEvent) => {
            if (document.pointerLockElement !== pointerLockRef.current) return;
            inputRef.current.keysDown[e.key.toUpperCase()] = false;
        };
        document.addEventListener("keyup", keyup);


        const mousemove = (e: MouseEvent) => {
            if (document.pointerLockElement !== pointerLockRef.current) return;
            inputRef.current.mouseDeltas.x += e.movementX;
            inputRef.current.mouseDeltas.y += e.movementY;
        }
        window.addEventListener("mousemove", mousemove);
        return () => {
            window.removeEventListener("mousemove", mousemove);
            window.removeEventListener("keydown", keydown);
            window.removeEventListener("keyup", keyup);
            document.removeEventListener("click", click);
        }
    }, []);

    return inputRef;
}