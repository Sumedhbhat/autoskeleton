import { useEffect, useRef } from "react";
import { Skeleton, fake, useSkeleton } from "autoskeleton";
import { track, type Velocity } from "../api";

const VELOCITY_PLACEHOLDER: Velocity = {
  label: fake.sentence(4),
  series: [12, 18, 9, 22, 17, 25, 19, 28, 24, 30, 21, 27],
};

export function VelocityChart({ velocity }: { velocity: Velocity | undefined }) {
  return (
    <Skeleton data={velocity} placeholder={VELOCITY_PLACEHOLDER}>
      {(v) => <VelocityFigure velocity={v} />}
    </Skeleton>
  );
}

function VelocityFigure({ velocity }: { velocity: Velocity }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const isSkeleton = useSkeleton();

  useEffect(() => {
    if (isSkeleton) return;
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    const max = Math.max(...velocity.series);
    const w = c.width / velocity.series.length;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#6366f1";
    velocity.series.forEach((v, i) => {
      const h = (v / max) * (c.height - 10);
      ctx.fillRect(i * w + 4, c.height - h, w - 8, h);
    });
    track("chart_render", velocity.series.length);
  }, [velocity, isSkeleton]);

  return (
    <figure className="chart">
      <figcaption>{velocity.label}</figcaption>
      <canvas ref={ref} width={560} height={160} />
      <div className="chart-legend">
        <span>12 weeks</span>
        <span>avg {(velocity.series.reduce((a, b) => a + b, 0) / velocity.series.length).toFixed(1)} pts</span>
      </div>
    </figure>
  );
}
