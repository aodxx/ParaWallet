import { useEffect, useRef } from "react";

type AnimationInstance = { destroy: () => void; goToAndStop?: (frame: number, isFrame: boolean) => void };
type LottiePlayer = {
  loadAnimation: (options: {
    container: HTMLElement;
    renderer: "svg";
    loop: boolean;
    autoplay: boolean;
    path: string;
    rendererSettings: { preserveAspectRatio: string; progressiveLoad: boolean };
  }) => AnimationInstance;
};

let playerPromise: Promise<LottiePlayer> | null = null;

function playerFromWindow() {
  return (window as typeof window & { lottie?: LottiePlayer }).lottie;
}

function loadPlayer() {
  const ready = playerFromWindow();
  if (ready) return Promise.resolve(ready);
  if (playerPromise) return playerPromise;
  playerPromise = new Promise<LottiePlayer>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${import.meta.env.BASE_URL}vendor/lottie_light.min.js`;
    script.async = true;
    script.dataset.parawalletLottie = "true";
    script.onload = () => {
      const player = playerFromWindow();
      if (player) resolve(player);
      else reject(new Error("LOTTIE_PLAYER_UNAVAILABLE"));
    };
    script.onerror = () => reject(new Error("LOTTIE_PLAYER_LOAD_FAILED"));
    document.head.appendChild(script);
  });
  return playerPromise;
}

export default function LoadingAnimation({ label, detail, compact = false }: { label: string; detail?: string; compact?: boolean }) {
  const animationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let instance: AnimationInstance | undefined;
    let active = true;
    void loadPlayer().then((player) => {
      if (!active || !animationRef.current) return;
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
      instance = player.loadAnimation({
        container: animationRef.current,
        renderer: "svg",
        loop: !reduceMotion,
        autoplay: !reduceMotion,
        path: `${import.meta.env.BASE_URL}loading/animation.json`,
        rendererSettings: { preserveAspectRatio: "xMidYMid meet", progressiveLoad: true },
      });
      if (reduceMotion) instance.goToAndStop?.(0, true);
    }).catch(() => undefined);
    return () => {
      active = false;
      instance?.destroy();
    };
  }, []);

  return <div className={`loading-state ${compact ? "compact" : ""}`} role="status" aria-live="polite">
    <div ref={animationRef} className="loading-animation" aria-hidden="true" />
    <div className="loading-copy"><strong>{label}</strong>{detail && <span>{detail}</span>}</div>
  </div>;
}
