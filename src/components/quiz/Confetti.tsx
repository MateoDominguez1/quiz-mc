import type { CSSProperties } from "react";

const COLORS = ["#ffc72c", "#c8102e", "#ffffff", "#27ae60", "#ffe08a", "#ff8a65"];

// Valori pseudo-casuali deterministici (stesso output su server e client).
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const PIECES = Array.from({ length: 42 }, (_, i) => ({
  left: `${(rand(i + 1) * 100).toFixed(2)}%`,
  delay: `${(rand(i + 101) * 2.5).toFixed(2)}s`,
  duration: `${(2.6 + rand(i + 201) * 2.4).toFixed(2)}s`,
  drift: `${Math.round((rand(i + 301) - 0.5) * 160)}px`,
  spin: `${Math.round(360 + rand(i + 401) * 720)}deg`,
  color: COLORS[i % COLORS.length],
  round: i % 3 === 0,
  scale: (0.7 + rand(i + 501) * 0.6).toFixed(2),
}));

export function Confetti() {
  return (
    <div className="confetti" aria-hidden>
      {PIECES.map((p, i) => (
        <span
          key={i}
          style={
            {
              left: p.left,
              background: p.color,
              animationDelay: p.delay,
              animationDuration: p.duration,
              borderRadius: p.round ? "9999px" : undefined,
              width: p.round ? 10 : undefined,
              height: p.round ? 10 : undefined,
              scale: p.scale,
              "--drift": p.drift,
              "--spin": p.spin,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
