import { useRef, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

export function StudioMark({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  function move(event: PointerEvent<HTMLSpanElement>) {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    ref.current?.style.setProperty("--tx", `${x * 16}deg`);
    ref.current?.style.setProperty("--ty", `${y * -16}deg`);
  }

  function leave() {
    ref.current?.style.setProperty("--tx", "0deg");
    ref.current?.style.setProperty("--ty", "0deg");
  }

  return (
    <span ref={ref} className={cn("studio-mark", className)} onPointerMove={move} onPointerLeave={leave} aria-hidden>
      <svg viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="30" className="fill-brass" />
        <circle cx="32" cy="32" r="24" stroke="white" strokeOpacity="0.45" strokeWidth="1.25" />
        <g className="mark-spin">
          <circle cx="32" cy="8" r="2.2" fill="white" />
        </g>
        <path d="M24 44V20h11.2c3.7 0 6 2 6 5.1 0 2.2-1.3 4-3.5 4.6 2.5.5 4.1 2.4 4.1 5 0 3.4-2.5 5.3-6.6 5.3H24Zm4.2-11.6h6.2c1.6 0 2.6-.8 2.6-2.1s-1-2.1-2.6-2.1h-6.2v4.2Zm0 8.8h6.9c1.9 0 3-.8 3-2.2s-1.1-2.2-3-2.2h-6.9V41.2Z" fill="white" />
      </svg>
    </span>
  );
}
