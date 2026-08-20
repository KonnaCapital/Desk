export const SNAP_THRESHOLD_LOGICAL_PX = 120;
export const MOVE_SETTLE_MS = 150;

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Point = {
  x: number;
  y: number;
};

export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type MonitorWorkArea = Rect & {
  scaleFactor: number;
};

export type SnapOrigin = {
  x: number;
  y: number;
  corner: Corner;
};

export function snapThresholdPx(scaleFactor: number): number {
  return SNAP_THRESHOLD_LOGICAL_PX * scaleFactor;
}

export function workAreaForWindowCenter(
  monitors: MonitorWorkArea[],
  center: Point,
): MonitorWorkArea | null {
  if (monitors.length === 0) return null;
  const containing = monitors.find((monitor) => containsPoint(monitor, center));
  if (containing) return containing;
  let nearest = monitors[0]!;
  let best = distanceToRect(center, nearest);
  for (const monitor of monitors.slice(1)) {
    const next = distanceToRect(center, monitor);
    if (next < best) {
      best = next;
      nearest = monitor;
    }
  }
  return nearest;
}

export function snapWindowOrigin(
  windowRect: Rect,
  workArea: Rect,
  thresholdPx: number,
): SnapOrigin | null {
  const candidates: { corner: Corner; distance: number; origin: Point }[] = [
    {
      corner: "top-left",
      distance: hypot(
        windowRect.x - workArea.x,
        windowRect.y - workArea.y,
      ),
      origin: { x: workArea.x, y: workArea.y },
    },
    {
      corner: "top-right",
      distance: hypot(
        windowRect.x + windowRect.width - (workArea.x + workArea.width),
        windowRect.y - workArea.y,
      ),
      origin: {
        x: workArea.x + workArea.width - windowRect.width,
        y: workArea.y,
      },
    },
    {
      corner: "bottom-left",
      distance: hypot(
        windowRect.x - workArea.x,
        windowRect.y + windowRect.height - (workArea.y + workArea.height),
      ),
      origin: {
        x: workArea.x,
        y: workArea.y + workArea.height - windowRect.height,
      },
    },
    {
      corner: "bottom-right",
      distance: hypot(
        windowRect.x + windowRect.width - (workArea.x + workArea.width),
        windowRect.y + windowRect.height - (workArea.y + workArea.height),
      ),
      origin: {
        x: workArea.x + workArea.width - windowRect.width,
        y: workArea.y + workArea.height - windowRect.height,
      },
    },
  ];

  let best = candidates[0]!;
  for (const candidate of candidates.slice(1)) {
    if (candidate.distance < best.distance) best = candidate;
  }
  if (best.distance >= thresholdPx) return null;

  const origin = clampOrigin(best.origin.x, best.origin.y, windowRect, workArea);
  if (origin.x === windowRect.x && origin.y === windowRect.y) return null;
  return { ...origin, corner: best.corner };
}

export function resolveCornerSnap(
  windowRect: Rect,
  monitors: MonitorWorkArea[],
): SnapOrigin | null {
  const center = {
    x: windowRect.x + windowRect.width / 2,
    y: windowRect.y + windowRect.height / 2,
  };
  const workArea = workAreaForWindowCenter(monitors, center);
  if (!workArea) return null;
  return snapWindowOrigin(windowRect, workArea, snapThresholdPx(workArea.scaleFactor));
}

export type CornerSnapHost = {
  outerPosition(): Promise<Point>;
  outerSize(): Promise<{ width: number; height: number }>;
  availableMonitors(): Promise<MonitorWorkArea[]>;
  setPosition(x: number, y: number): Promise<void>;
};

export async function applyCornerSnapIfNeeded(
  host: CornerSnapHost,
): Promise<SnapOrigin | null> {
  const [position, size, monitors] = await Promise.all([
    host.outerPosition(),
    host.outerSize(),
    host.availableMonitors(),
  ]);
  const snap = resolveCornerSnap(
    { x: position.x, y: position.y, width: size.width, height: size.height },
    monitors,
  );
  if (!snap) return null;
  await host.setPosition(snap.x, snap.y);
  return snap;
}

function containsPoint(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  );
}

function distanceToRect(point: Point, rect: Rect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));
  return hypot(dx, dy);
}

function clampOrigin(x: number, y: number, windowRect: Rect, workArea: Rect): Point {
  const maxX = workArea.x + workArea.width - windowRect.width;
  const maxY = workArea.y + workArea.height - windowRect.height;
  return {
    x: windowRect.width >= workArea.width ? workArea.x : Math.min(Math.max(x, workArea.x), maxX),
    y: windowRect.height >= workArea.height ? workArea.y : Math.min(Math.max(y, workArea.y), maxY),
  };
}

function hypot(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}
