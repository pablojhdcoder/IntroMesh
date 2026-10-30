"use client";

import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Line,
  LineBasicMaterial,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import {
  compactSelection,
  easeOut,
  fieldWidth,
  MOBILE_BREAKPOINT,
  mixRgba,
  parseCssColor,
  placePeople,
  SELECTED_LIFT,
  worldX,
  worldY,
  type PlacedPoint,
  type Rgba,
} from "@/components/signal-field-layout";

export type FieldPerson = {
  id: string;
  slug: string;
  displayName: string;
  role: string;
  demo: boolean;
  x: number;
  y: number;
  presence: "active" | "seeking";
  recommendation: {
    score: number;
    confidence: "low" | "medium" | "high";
    shared: { goals: string[]; interests: string[]; skills: string[] };
    complement: string[];
  } | null;
};

/* ---------------------------------------------------------------------- */
/* Tokens                                                                  */
/* ---------------------------------------------------------------------- */

type Tokens = {
  foreground: Rgba;
  background: Rgba;
  nodeHot: Rgba;
  edge: Rgba;
  edgeActive: Rgba;
  signalStrong: Rgba;
};

const rgba = (value: string): Rgba => parseCssColor(value) ?? { r: 0, g: 0, b: 0, a: 1 };

/** Valores de DESIGN.md. Solo se usan si falta el token en CSS. */
const FALLBACK: Record<"light" | "dark", Tokens> = {
  light: {
    foreground: rgba("#16180f"),
    background: rgba("#f6f4ef"),
    nodeHot: rgba("#4c6610"),
    edge: rgba("rgb(22 24 15 / 0.22)"),
    edgeActive: rgba("#4c6610"),
    signalStrong: rgba("#4c6610"),
  },
  dark: {
    foreground: rgba("#f4f1ea"),
    background: rgba("#07080c"),
    nodeHot: rgba("#d6ff4a"),
    edge: rgba("rgb(214 255 74 / 0.35)"),
    edgeActive: rgba("#d6ff4a"),
    signalStrong: rgba("#d6ff4a"),
  },
};

function readTokens(): Tokens {
  const root = document.documentElement;
  const fallback = FALLBACK[root.classList.contains("dark") ? "dark" : "light"];
  const styles = getComputedStyle(root);
  const read = (name: string, backup: Rgba) => parseCssColor(styles.getPropertyValue(name)) ?? backup;
  return {
    foreground: read("--foreground", fallback.foreground),
    background: read("--background", fallback.background),
    nodeHot: read("--node-hot", fallback.nodeHot),
    edge: read("--field-edge", fallback.edge),
    edgeActive: read("--field-edge-active", fallback.edgeActive),
    signalStrong: read("--signal-strong", fallback.signalStrong),
  };
}

function toColor(value: Rgba, target = new Color()): Color {
  return target.setRGB(value.r, value.g, value.b, SRGBColorSpace);
}

/* ---------------------------------------------------------------------- */
/* Escena                                                                  */
/* ---------------------------------------------------------------------- */

const CAMERA_FOV = 35;
const CAMERA_POSITION = new Vector3(0, 1.6, 8);
const ORIGIN = new Vector3(0, 0, 0);
const RADIUS_COLD = 0.09;
const RADIUS_HOT = 0.115;
const RADIUS_ORIGIN = 0.15;
const DURATION = 280;
const ORIGIN_KEY = "__origin";

type NodeState = {
  z: number;
  color: Color;
  emissive: number;
  lineColor: Color;
  lineOpacity: number;
};

type Placement = (id: string, x: number, y: number, radiusPx: number) => void;

function sameState(a: NodeState, b: NodeState): boolean {
  return (
    a.z === b.z &&
    a.emissive === b.emissive &&
    a.lineOpacity === b.lineOpacity &&
    a.color.equals(b.color) &&
    a.lineColor.equals(b.lineColor)
  );
}

class FieldNode {
  readonly id: string;
  hot: boolean;
  xPercent: number;
  yPercent: number;
  baseZ: number;
  radius: number;
  selected = false;

  readonly position = new Vector3();
  readonly color = new Color();
  emissive = 0;
  readonly lineColor = new Color();
  lineOpacity = 0;

  from: NodeState;
  to: NodeState;

  mesh: Mesh | null = null;
  material: MeshStandardMaterial | null = null;
  line: Line | null = null;
  lineMaterial: LineBasicMaterial | null = null;
  linePositions: BufferAttribute | null = null;

  constructor(point: PlacedPoint) {
    this.id = point.id;
    this.hot = point.hot;
    this.xPercent = point.x;
    this.yPercent = point.y;
    this.baseZ = point.z;
    this.radius = point.hot ? RADIUS_HOT : RADIUS_COLD;
    this.from = this.snapshot();
    this.to = this.snapshot();
  }

  setPoint(point: PlacedPoint): void {
    this.hot = point.hot;
    this.xPercent = point.x;
    this.yPercent = point.y;
    this.baseZ = point.z;
    this.radius = point.hot ? RADIUS_HOT : RADIUS_COLD;
  }

  snapshot(): NodeState {
    return {
      z: this.position.z,
      color: this.color.clone(),
      emissive: this.emissive,
      lineColor: this.lineColor.clone(),
      lineOpacity: this.lineOpacity,
    };
  }

  /** Estado de reposo o de selección a partir de los tokens actuales. */
  target(selected: boolean, tokens: Tokens): NodeState {
    this.selected = selected;
    const restColor = this.hot ? tokens.nodeHot : mixRgba(tokens.background, tokens.foreground, 0.5);
    return {
      z: this.baseZ + (selected ? SELECTED_LIFT : 0),
      color: toColor(selected ? tokens.edgeActive : restColor),
      emissive: selected ? 0.3 : 0,
      lineColor: toColor(selected ? tokens.edgeActive : tokens.edge),
      lineOpacity: selected ? 1 : tokens.edge.a,
    };
  }

  apply(progress: number, width: number): void {
    const { from, to } = this;
    this.position.set(worldX(this.xPercent, width), worldY(this.yPercent), from.z + (to.z - from.z) * progress);
    this.color.lerpColors(from.color, to.color, progress);
    this.emissive = from.emissive + (to.emissive - from.emissive) * progress;
    this.lineColor.lerpColors(from.lineColor, to.lineColor, progress);
    this.lineOpacity = from.lineOpacity + (to.lineOpacity - from.lineOpacity) * progress;

    if (this.mesh) {
      this.mesh.position.copy(this.position);
      this.mesh.scale.setScalar(this.radius);
    }
    if (this.material) {
      this.material.color.copy(this.color);
      this.material.emissive.copy(this.color);
      this.material.emissiveIntensity = this.emissive;
    }
    if (this.linePositions) {
      this.linePositions.setXYZ(1, this.position.x, this.position.y, this.position.z);
      this.linePositions.needsUpdate = true;
    }
    if (this.lineMaterial) {
      this.lineMaterial.color.copy(this.lineColor);
      this.lineMaterial.opacity = this.lineOpacity;
    }
    if (this.line) this.line.visible = this.hot;
  }

  dispose(scene: Scene): void {
    if (this.mesh) scene.remove(this.mesh);
    if (this.line) {
      scene.remove(this.line);
      this.line.geometry.dispose();
    }
    this.material?.dispose();
    this.lineMaterial?.dispose();
    this.mesh = null;
    this.material = null;
    this.line = null;
    this.lineMaterial = null;
    this.linePositions = null;
  }
}

class FieldScene {
  readonly webgl: boolean;
  private readonly camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.1, 40);
  private readonly scene = new Scene();
  private readonly renderer: WebGLRenderer | null;
  private readonly sphere = new SphereGeometry(1, 32, 24);
  private readonly originMaterial: MeshStandardMaterial | null = null;
  private readonly hemisphere: HemisphereLight;
  private readonly sun: DirectionalLight;
  private readonly nodes = new Map<string, FieldNode>();
  private readonly projection = new Vector3();
  private tokens: Tokens;
  private width = 1;
  private height = 1;
  private planeWidth = fieldWidth(1);
  private frame: number | null = null;
  private transitionStart: number | null = null;
  private progress = 1;
  private reduced = false;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly place: Placement,
  ) {
    this.camera.position.copy(CAMERA_POSITION);
    this.camera.lookAt(0, 0, 0);
    this.tokens = readTokens();

    let renderer: WebGLRenderer | null = null;
    try {
      renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    } catch {
      renderer = null;
    }
    this.renderer = renderer;
    this.webgl = renderer !== null;

    // Luz suave de cielo/suelo más una direccional: volumen mate, sin brillos.
    this.hemisphere = new HemisphereLight(0xffffff, 0x8c8c8c, 2.4);
    this.sun = new DirectionalLight(0xffffff, 1.2);
    this.sun.position.set(-2, 3, 4);
    this.scene.add(this.hemisphere, this.sun);

    if (this.webgl) {
      const material = new MeshStandardMaterial({ roughness: 1, metalness: 0 });
      const origin = new Mesh(this.sphere, material);
      origin.scale.setScalar(RADIUS_ORIGIN);
      this.scene.add(origin);
      this.originMaterial = material;
    }
    this.applyTokens();
  }

  setReducedMotion(reduced: boolean): void {
    this.reduced = reduced;
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.width = width;
    this.height = height;
    this.planeWidth = fieldWidth(width / height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer?.setSize(width, height, false);
    for (const node of this.nodes.values()) node.apply(this.progress, this.planeWidth);
    this.project();
    this.requestRender();
  }

  /** Vuelve a leer los tokens y repinta con los colores nuevos, sin tween. */
  refreshTokens(): void {
    this.tokens = readTokens();
    this.applyTokens();
    for (const node of this.nodes.values()) {
      node.to = node.target(node.selected, this.tokens);
      node.from = node.to;
      node.apply(1, this.planeWidth);
    }
    this.transitionStart = null;
    this.progress = 1;
    this.requestRender();
  }

  update(points: readonly PlacedPoint[], selectedId: string | null): void {
    const seen = new Set<string>();
    const pending: Array<[FieldNode, NodeState]> = [];

    for (const point of points) {
      seen.add(point.id);
      const selected = point.id === selectedId;
      const existing = this.nodes.get(point.id);
      if (existing) {
        existing.setPoint(point);
        const next = existing.target(selected, this.tokens);
        if (!sameState(existing.to, next)) pending.push([existing, next]);
        continue;
      }
      const node = new FieldNode(point);
      node.to = node.target(selected, this.tokens);
      node.from = node.to;
      this.attach(node);
      node.apply(1, this.planeWidth);
      this.nodes.set(node.id, node);
    }

    for (const [id, node] of this.nodes) {
      if (seen.has(id)) continue;
      node.dispose(this.scene);
      this.nodes.delete(id);
    }

    if (pending.length > 0) {
      // Todos parten de su estado actual, también los que estaban a medio camino.
      for (const node of this.nodes.values()) node.from = node.snapshot();
      for (const [node, next] of pending) node.to = next;
      if (this.reduced) {
        this.progress = 1;
        this.transitionStart = null;
      } else {
        this.progress = 0;
        this.transitionStart = -1;
      }
    }
    for (const node of this.nodes.values()) node.apply(this.progress, this.planeWidth);
    this.project();
    this.requestRender();
  }

  dispose(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    for (const node of this.nodes.values()) node.dispose(this.scene);
    this.nodes.clear();
    this.originMaterial?.dispose();
    this.sphere.dispose();
    this.hemisphere.dispose();
    this.sun.dispose();
    this.renderer?.dispose();
  }

  private attach(node: FieldNode): void {
    if (!this.renderer) return;
    const material = new MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
    const mesh = new Mesh(this.sphere, material);
    node.mesh = mesh;
    node.material = material;

    const positions = new BufferAttribute(new Float32Array(6), 3);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", positions);
    const lineMaterial = new LineBasicMaterial({ transparent: true, depthWrite: false });
    const line = new Line(geometry, lineMaterial);
    node.line = line;
    node.lineMaterial = lineMaterial;
    node.linePositions = positions;

    this.scene.add(line, mesh);
  }

  private applyTokens(): void {
    if (this.originMaterial) toColor(this.tokens.foreground, this.originMaterial.color);
  }

  /** Render bajo demanda: un solo frame salvo durante la transición. */
  private requestRender(): void {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number): void => {
    this.frame = null;
    if (this.transitionStart !== null) {
      if (this.transitionStart < 0) this.transitionStart = now;
      const elapsed = Math.min(1, (now - this.transitionStart) / DURATION);
      this.progress = easeOut(elapsed);
      for (const node of this.nodes.values()) node.apply(this.progress, this.planeWidth);
      if (elapsed >= 1) {
        this.transitionStart = null;
      } else {
        this.requestRender();
      }
      this.project();
    }
    this.renderer?.render(this.scene, this.camera);
  };

  /** Proyecta origen y nodos a píxeles y los entrega a la capa DOM. */
  private project(): void {
    const focal = this.height / 2 / Math.tan(MathUtils.degToRad(CAMERA_FOV) / 2);
    const emit = (id: string, world: Vector3, radius: number) => {
      this.projection.copy(world).project(this.camera);
      const x = ((this.projection.x + 1) / 2) * this.width;
      const y = ((1 - this.projection.y) / 2) * this.height;
      const distance = this.camera.position.distanceTo(world);
      this.place(id, x, y, (radius * focal) / distance);
    };
    emit(ORIGIN_KEY, ORIGIN, RADIUS_ORIGIN);
    for (const node of this.nodes.values()) emit(node.id, node.position, node.radius);
  }
}

/* ---------------------------------------------------------------------- */
/* Componente                                                              */
/* ---------------------------------------------------------------------- */

function subscribeMedia(query: string) {
  return (notify: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", notify);
    return () => media.removeEventListener("change", notify);
  };
}

const compactQuery = `(max-width: ${MOBILE_BREAKPOINT - 0.02}px)`;
const subscribeCompact = subscribeMedia(compactQuery);
const readCompact = () => window.matchMedia(compactQuery).matches;
const readServer = () => false;

const LABEL_RIGHT = "[left:calc(var(--node-r,8px)+0.75rem)]";
const LABEL_LEFT = "[right:calc(var(--node-r,8px)+0.75rem)]";

function bindAnchor(ref: { current: Map<string, HTMLElement> }, id: string) {
  return (element: HTMLElement | null) => {
    if (element) ref.current.set(id, element);
    else ref.current.delete(id);
  };
}

export function SignalField({
  people,
  selectedId,
  onSelect,
}: {
  people: FieldPerson[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<FieldScene | null>(null);
  const anchors = useRef(new Map<string, HTMLElement>());
  const compact = useSyncExternalStore(subscribeCompact, readCompact, readServer);

  const shown = useMemo(() => {
    const entries = people.map((person) => ({ person, id: person.id, score: person.recommendation?.score ?? null }));
    const subset = compact ? compactSelection(entries, selectedId) : entries;
    return subset.map((entry) => entry.person);
  }, [people, compact, selectedId]);

  const placed = useMemo(
    () =>
      placePeople(
        shown.map((person) => ({ id: person.id, x: person.x, y: person.y, score: person.recommendation?.score ?? null })),
      ),
    [shown],
  );

  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const scene = new FieldScene(canvas, (id, x, y, radiusPx) => {
      const element = anchors.current.get(id);
      if (!element) return;
      element.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      element.style.setProperty("--node-r", `${radiusPx.toFixed(2)}px`);
      element.style.opacity = "1";
    });
    sceneRef.current = scene;
    container.dataset.webgl = scene.webgl ? "true" : "false";

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => scene.setReducedMotion(motion.matches);
    syncMotion();
    motion.addEventListener("change", syncMotion);

    scene.resize(container.clientWidth, container.clientHeight);
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) scene.resize(entry.contentRect.width, entry.contentRect.height);
    });
    resizeObserver.observe(container);

    const themeObserver = new MutationObserver(() => scene.refreshTokens());
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      motion.removeEventListener("change", syncMotion);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    sceneRef.current?.update(placed, selectedId);
  }, [placed, selectedId]);

  const empty = people.length === 0;

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label="Campo de asistentes"
      className="group/field relative h-72 w-full touch-manipulation min-[720px]:h-[28rem]"
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />

      <div ref={bindAnchor(anchors, ORIGIN_KEY)} className="pointer-events-none absolute top-0 left-0 opacity-0 will-change-transform">
        <span
          aria-hidden="true"
          className="absolute top-0 left-0 hidden size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground group-data-[webgl=false]/field:block"
        />
        <span
          className={`absolute top-0 -translate-y-1/2 font-heading text-[1.0625rem] leading-none whitespace-nowrap text-foreground ${LABEL_RIGHT}`}
        >
          Tú
        </span>
        {empty ? (
          <p
            role="status"
            className={`absolute top-0 -translate-y-1/2 font-mono text-xs leading-none tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase ${LABEL_LEFT}`}
          >
            Nadie visible
          </p>
        ) : null}
      </div>

      {placed.map((point) => {
        const person = byId.get(point.id);
        if (!person) return null;
        const selected = point.id === selectedId;
        const dotColor = selected
          ? "var(--field-edge-active)"
          : point.hot
            ? "var(--node-hot)"
            : "color-mix(in srgb, var(--foreground) 50%, var(--background))";
        return (
          <div key={point.id} ref={bindAnchor(anchors, point.id)} className="absolute top-0 left-0 opacity-0 will-change-transform">
            <button
              type="button"
              aria-pressed={selected}
              aria-label={person.demo ? `${person.displayName}, demostración` : person.displayName}
              onClick={() => onSelect(person.id)}
              className="absolute top-0 left-0 flex size-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span
                aria-hidden="true"
                className="hidden size-2 rounded-full group-data-[webgl=false]/field:block"
                style={{ background: dotColor }}
              />
            </button>
            {point.hot || selected ? (
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute top-0 flex max-w-[11rem] -translate-y-1/2 items-baseline gap-1.5 whitespace-nowrap ${
                  point.side === "right" ? LABEL_RIGHT : LABEL_LEFT
                }`}
              >
                <span className="truncate font-heading text-[1.0625rem] leading-none text-foreground">{person.displayName}</span>
                {person.demo ? <span className="font-sans text-xs leading-none text-muted-foreground">· demo</span> : null}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
