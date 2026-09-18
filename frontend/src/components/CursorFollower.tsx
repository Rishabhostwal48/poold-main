import { useEffect, useRef } from "react";

export function CursorFollower() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const layer = layerRef.current;
      if (!layer) return;

      layer.style.setProperty("--pointer-x", `${event.clientX}px`);
      layer.style.setProperty("--pointer-y", `${event.clientY}px`);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  return (
    <div ref={layerRef} className="site-cursor-layer" aria-hidden="true">
      <span className="site-cursor-aura" />
      <span className="site-cursor-square" />
    </div>
  );
}
