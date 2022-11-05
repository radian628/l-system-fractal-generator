import { useEffect, useRef, useState } from "react";

export function useInput(pointerLockRef: React.RefObject<HTMLElement>) {
    
    const inputRef = useRef({
        keysDown: {} as { [key: string]: boolean },
        mouseDeltas: {
            x: 0, y: 0
        }
    });
    
    useEffect(() => {
        const click = (e: MouseEvent) => {
            if (e.target === pointerLockRef.current) {
                pointerLockRef.current?.requestPointerLock();
            }
        }
        document.addEventListener("click", click);


        const keydown = (e: KeyboardEvent) => {
            inputRef.current.keysDown[e.key.toUpperCase()] = true;
        }
        document.addEventListener("keydown", keydown);
        

        const keyup = (e: KeyboardEvent) => {
            inputRef.current.keysDown[e.key.toUpperCase()] = false;
        };
        document.addEventListener("keyup", keyup);


        const mousemove = (e: MouseEvent) => {
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