"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D, { type ForceGraphMethods } from "react-force-graph-3d";
import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  type PerspectiveCamera,
  PMREMGenerator,
  SphereGeometry,
  SRGBColorSpace,
  type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import SpriteText from "three-spritetext";
import { FIELD_SELF_ID, type FieldPerson } from "@/components/signal/signal-field";
import {
  GALAXY_COLD_RADIUS,
  GALAXY_HOT_RADIUS,
  GALAXY_LINK_DISTANCE,
  GALAXY_ROOT_RADIUS,
  galaxyFrameInset,
  galaxyLayout,
  galaxyOverviewDistance,
} from "@/components/signal/signal-field-layout";

const ORIGIN = FIELD_SELF_ID;

type Kind = "root" | "hot" | "cold";

type GraphNode = {
  id: string;
  name: string;
  kind: Kind;
  val: number;
  demo?: boolean;
  fx?: number;
  fy?: number;
  fz?: number;
  // Runtime fields written by the force simulation; kept so a reused node
  // object resumes from its last position instead of restarting the layout.
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
};

type GraphLink = {
  source: string;
  target: string;
  hot: boolean;
};

type CameraPose = { x: number; y: number; z: number };

/** Los tipos de la librería no declaran la lectura sin argumentos. El runtime la devuelve. */
function readCamera(graph: { cameraPosition: (...args: never[]) => unknown }): CameraPose {
  return (graph.cameraPosition as unknown as () => CameraPose)();
}

type Palette = {
  root: number;
  hot: number;
  cold: number;
  label: string;
  linkHot: string;
  linkCold: string;
  particle: string;
};

const PALETTE: Record<"light" | "dark", Palette> = {
  light: {
    root: 0x16a34a,
    hot: 0x22c55e,
    cold: 0x8a877c,
    label: "#16180f",
    linkHot: "rgba(22, 163, 74, 0.85)",
    linkCold: "rgba(96, 90, 72, 0.26)",
    particle: "#16a34a",
  },
  dark: {
    root: 0xd6ff4a,
    hot: 0x9ede2a,
    cold: 0x8f8c94,
    label: "rgba(244, 241, 234, 0.95)",
    linkHot: "rgba(158, 222, 42, 0.62)",
    linkCold: "rgba(244, 241, 234, 0.18)",
    particle: "#f4f1ea",
  },
};

const spheres = new Map<number, SphereGeometry>();

function sphere(radius: number): SphereGeometry {
  const cached = spheres.get(radius);
  if (cached) return cached;
  const geometry = new SphereGeometry(radius, 48, 48);
  spheres.set(radius, geometry);
  return geometry;
}

function glass(color: number, selected: boolean, kind: Kind): MeshPhysicalMaterial {
  const hot = kind === "root" || kind === "hot" || selected;
  return new MeshPhysicalMaterial({
    color: new Color(color),
    emissive: new Color(color),
    emissiveIntensity: selected ? 1.5 : kind === "root" ? 0.9 : hot ? 0.45 : 0.12,
    transparent: true,
    opacity: kind === "cold" && !selected ? 0.55 : 0.86,
    roughness: selected ? 0.05 : 0.12,
    metalness: 0.08,
    transmission: kind === "root" ? 0.72 : 0.82,
    thickness: kind === "root" ? 2.4 : 1.1,
    clearcoat: 1,
    clearcoatRoughness: 0.18,
  });
}

export function SignalGalaxy({
  people,
  selectedId,
  hoveredId = null,
  onSelect,
  onHover,
  railCollapsed = false,
  sheetExpanded = false,
  reducedMotion,
  ready,
}: {
  people: FieldPerson[];
  selectedId: string | null;
  hoveredId?: string | null;
  onSelect: (id: string | null) => void;
  onHover?: (id: string | null) => void;
  railCollapsed?: boolean;
  sheetExpanded?: boolean;
  reducedMotion: boolean;
  /** False while the roster is still initial/loading: mount nothing until data is final. */
  ready: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const dressed = useRef(false);
  const fittedSig = useRef<string | null>(null);
  const keyLight = useRef<DirectionalLight | null>(null);
  const focusedId = useRef<string | null>(null);
  const focusTimer = useRef<number | null>(null);
  const overviewFrame = useRef<number | null>(null);
  const overviewPose = useRef<{ x: number; y: number; z: number } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const measure = () => {
      const width = Math.round(element.clientWidth);
      const height = Math.round(element.clientHeight);
      if (width === 0 || height === 0) return;
      setSize((previous) => (previous.width === width && previous.height === height ? previous : { width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sync = () => setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const palette = PALETTE[theme];

  const rosterKey = people.map((person) => `${person.id}:${person.recommendation ? 1 : 0}`).join("|");

  // Reuse node objects across roster changes (invisible <-> active) so the
  // simulation resumes from stored positions instead of restarting cold.
  // Lazy-initialized stable cache; entries are mutated, never re-set.
  const [nodeCache] = useState(() => new Map<string, GraphNode>());
  // Reuse Three objects across selection/theme rebuilds so a selection does
  // not recreate every physical material and label texture in the field.
  const objectCache = useRef(new Map<string, Group>());

  useEffect(() => {
    const cache = objectCache.current;
    return () => {
      for (const group of cache.values()) {
        group.traverse((child) => {
          const mesh = child as Mesh;
          if (!mesh.isMesh) return;
          const material = mesh.material as MeshPhysicalMaterial & { map?: { dispose: () => void } };
          material.map?.dispose();
          material.dispose();
        });
      }
      cache.clear();
    };
  }, []);

  const graphData = useMemo(() => {
    const reuse = (id: string, init: GraphNode): GraphNode => {
      const cached = nodeCache.get(id);
      if (cached) {
        cached.name = init.name;
        cached.kind = init.kind;
        cached.val = init.val;
        cached.demo = init.demo;
        cached.fx = init.fx;
        cached.fy = init.fy;
        cached.fz = init.fz;
        return cached;
      }
      nodeCache.set(id, init);
      return init;
    };
    const nodes: GraphNode[] = [
      reuse(ORIGIN, { id: ORIGIN, name: "You", kind: "root", val: GALAXY_ROOT_RADIUS, fx: 0, fy: 0, fz: 0 }),
    ];
    const links: GraphLink[] = [];
    // Deterministic seeds, live physics: galaxyLayout guarantees every sphere
    // starts clear of the root and each other for any roster size, then the
    // charge/link simulation takes over and puts them in orbit — nodes move
    // and push each other apart, but never start collapsed into "You".
    const layout = galaxyLayout(
      people.map((person) => ({
        id: person.id,
        x: person.x,
        y: person.y,
        score: person.recommendation?.score ?? null,
      })),
    );
    for (const [index, person] of people.entries()) {
      const hot = person.recommendation !== null;
      const seed = layout[index];
      nodes.push(
        reuse(person.id, {
          id: person.id,
          name: person.demo ? `${person.displayName} · demo` : person.displayName,
          kind: hot ? "hot" : "cold",
          val: hot ? GALAXY_HOT_RADIUS : GALAXY_COLD_RADIUS,
          demo: person.demo,
          x: seed.x,
          y: seed.y,
          z: seed.z,
        }),
      );
      links.push({ source: ORIGIN, target: person.id, hot });
    }
    return { nodes, links };
    // La selección crea un array nuevo con la misma gente. Rehacer los nodos reinicia la cámara.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterKey]);

  // Sorted node identity: the camera fits once per genuine roster, never on
  // theme/size/selection churn, and never for the origin-only placeholder.
  const rosterSig = useMemo(() => graphData.nodes.map((node) => node.id).sort().join("|"), [graphData]);

  const nodeObject = useCallback(
    (node: GraphNode) => {
      const selected = node.id === selectedId;
      const hovered = node.id === hoveredId;
      const highlighted = selected || hovered;
      const cacheKey = `${theme}|${node.id}|${node.kind}|${node.val}|${highlighted ? 1 : 0}`;
      const cached = objectCache.current.get(cacheKey);
      if (cached) return cached;
      const group = new Group();
      if (hovered && !selected) group.scale.setScalar(1.12);
      const color = node.kind === "root" ? palette.root : node.kind === "hot" ? palette.hot : palette.cold;
      const mesh = new Mesh(sphere(node.val), glass(color, highlighted, node.kind));
      group.add(mesh);

      if (node.name && (node.kind !== "cold" || highlighted)) {
        const label = new SpriteText(node.name);
        label.color = palette.label;
        label.fontWeight = "600";
        label.fontFace = "Instrument Serif, Georgia, serif";
        label.textHeight = Math.max(3.6, node.val * 0.48);
        label.position.y = node.kind === "root" ? node.val + label.textHeight : -(node.val + label.textHeight * 0.85 + 1.5);
        label.material.depthTest = false;
        group.add(label);
      }
      if (objectCache.current.size > 120) objectCache.current.clear();
      objectCache.current.set(cacheKey, group);
      return group;
    },
    [hoveredId, palette, selectedId, theme],
  );

  // The overlay (rail on desktop, sheet on mobile) steals one edge of the
  // fullscreen field: render through a view offset so the scene centers in
  // the free rectangle and no node hides under the panel.
  const inset = galaxyFrameInset(size, { railCollapsed, sheetExpanded });
  const frameWidth = Math.max(1, size.width - inset.right);
  const frameHeight = Math.max(1, size.height - inset.bottom);
  const frameKey = `${size.width >= 720 ? "d" : "m"}:${railCollapsed ? 1 : 0}:${sheetExpanded ? 1 : 0}`;
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !ready || size.width === 0 || size.height === 0) return;
    const camera = graph.camera() as PerspectiveCamera;
    if (inset.right > 0 || inset.bottom > 0) {
      camera.setViewOffset(size.width, size.height, 0, 0, frameWidth, frameHeight);
    } else {
      camera.clearViewOffset();
    }
  }, [frameHeight, frameWidth, inset.bottom, inset.right, ready, size.height, size.width]);

  // Styling + forces only: re-applies on theme/motion/data change but never
  // moves the camera, so theme toggles and roster refreshes don't jump.
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !ready || size.width === 0 || size.height === 0) return;
    // Reference physics: strong charge repulsion so nodes that drift together
    // push apart, and a long link so everyone orbits the root at a distance.
    const charge = graph.d3Force("charge") as { strength?: (value: number) => void } | undefined;
    charge?.strength?.(-400);
    const link = graph.d3Force("link") as { distance?: (value: number) => void } | undefined;
    link?.distance?.(GALAXY_LINK_DISTANCE);
    const renderer = graph.renderer() as WebGLRenderer;
    renderer.toneMappingExposure = theme === "dark" ? 1.2 : 1.05;
    if (keyLight.current) keyLight.current.intensity = theme === "dark" ? 2.35 : 1.6;
    if (!dressed.current) {
      dressed.current = true;
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = ACESFilmicToneMapping;
      // Cap the drawing buffer: the transmission pass scales with physical
      // pixels, so uncapped hidpi ratios make the first frames (and battery)
      // much slower for no visible gain on small spheres.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      const pmrem = new PMREMGenerator(renderer);
      graph.scene().environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
      const key = new DirectionalLight(0xfff6e8, theme === "dark" ? 2.35 : 1.6);
      key.position.set(40, 60, 80);
      keyLight.current = key;
      graph.scene().add(key);
    }
    const controls = graph.controls() as OrbitControls;
    controls.autoRotate = !reducedMotion;
    controls.autoRotateSpeed = 0.55;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
  }, [graphData, ready, reducedMotion, size.height, size.width, theme]);

  // One-shot overview fit per genuine roster. Guarded by rosterSig (not by
  // graphData identity, size jitter, or theme) and skipped when the roster
  // matches the last fitted one — so invisible → visible with a cached
  // roster never re-runs layout/camera. Seeds are deterministic and the
  // settled orbit is known, so the fit holds from the first frame,
  // root-only roster included.
  useEffect(() => {
    if (!ready || size.width === 0 || size.height === 0) return;
    if (graphData.nodes.length === 0) return;
    const fitSig = `${rosterSig}|${frameKey}`;
    if (fittedSig.current === fitSig) return;
    fittedSig.current = fitSig;
    const graph = graphRef.current;
    if (!graph) return;
    const frame = window.setTimeout(() => {
      if (focusedId.current) return;
      // Analytic framing, never zoomToFit on live simulation positions: the
      // physics settles everyone on the link orbit, so the extent is the
      // larger of the seed spread and that orbit — known before the first
      // frame, so root-only and two-node rosters frame exactly like any
      // other even while nodes are still moving.
      // Aspect is the free rectangle left by the overlay, not the canvas.
      const seedExtent =
        Math.max(
          ...graphData.nodes.map(
            (node) => Math.hypot(node.x ?? 0, node.y ?? 0, node.z ?? 0) + node.val,
          ),
        ) + 16;
      const extent =
        graphData.nodes.length > 1
          ? Math.max(seedExtent, GALAXY_LINK_DISTANCE + GALAXY_HOT_RADIUS + 16)
          : seedExtent;
      const distance = galaxyOverviewDistance(extent, frameWidth / frameHeight);
      const direction = Math.hypot(0.3, 0.22, 1);
      const pose = {
        x: (0.3 / direction) * distance,
        y: (0.22 / direction) * distance,
        z: (1 / direction) * distance,
      };
      overviewPose.current = pose;
      graph.cameraPosition(pose, { x: 0, y: 0, z: 0 }, reducedMotion ? 0 : 800);
    }, 150);
    return () => window.clearTimeout(frame);
  }, [frameHeight, frameKey, frameWidth, graphData, ready, reducedMotion, rosterSig, size.height, size.width]);

  const stopOverview = useCallback(() => {
    if (overviewFrame.current === null) return;
    window.cancelAnimationFrame(overviewFrame.current);
    overviewFrame.current = null;
  }, []);

  const showOverview = useCallback(() => {
    const graph = graphRef.current;
    focusedId.current = null;
    if (focusTimer.current !== null) window.clearTimeout(focusTimer.current);
    stopOverview();
    if (!graph) return;
    const controls = graph.controls() as OrbitControls;
    controls.autoRotate = false;
    const pose = overviewPose.current;
    if (!pose || reducedMotion) {
      const duration = reducedMotion ? 0 : 700;
      if (pose) graph.cameraPosition(pose, { x: 0, y: 0, z: 0 }, duration);
      else graph.zoomToFit(duration, 8);
      focusTimer.current = window.setTimeout(() => {
        controls.target.set(0, 0, 0);
        controls.autoRotate = !reducedMotion;
      }, duration + 40);
      return;
    }
    const from = readCamera(graph);
    const fromLook = controls.target.clone();
    const duration = 700;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) * (1 - t);
      graph.cameraPosition(
        {
          x: from.x + (pose.x - from.x) * eased,
          y: from.y + (pose.y - from.y) * eased,
          z: from.z + (pose.z - from.z) * eased,
        },
        {
          x: fromLook.x * (1 - eased),
          y: fromLook.y * (1 - eased),
          z: fromLook.z * (1 - eased),
        },
        0,
      );
      if (t < 1) {
        overviewFrame.current = window.requestAnimationFrame(step);
        return;
      }
      overviewFrame.current = null;
      controls.target.set(0, 0, 0);
      controls.autoRotate = !reducedMotion;
    };
    overviewFrame.current = window.requestAnimationFrame(step);
  }, [reducedMotion, stopOverview]);

  const focusNode = useCallback(
    (node: { id?: string; x?: number; y?: number; z?: number; val?: number }) => {
      const graph = graphRef.current;
      if (!graph || !node.id || node.x === undefined) return;
      focusedId.current = node.id;
      if (focusTimer.current !== null) window.clearTimeout(focusTimer.current);
      stopOverview();
      const look = { x: node.x, y: node.y ?? 0, z: node.z ?? 0 };
      const controls = graph.controls() as OrbitControls;
      controls.autoRotate = false;
      controls.target.set(look.x, look.y, look.z);
      // Far enough that the sphere and its label fit: the root (r=18) at the
      // old fixed 72 filled the frame exactly like the collapsed overview.
      const distance = Math.max(64, (node.val ?? GALAXY_HOT_RADIUS) * 6.5);
      graph.cameraPosition(
        { x: look.x + distance * 0.35, y: look.y + distance * 0.22, z: look.z + distance },
        look,
        reducedMotion ? 0 : 700,
      );
      focusTimer.current = window.setTimeout(() => {
        controls.target.set(look.x, look.y, look.z);
        controls.autoRotate = !reducedMotion;
      }, reducedMotion ? 0 : 720);
    },
    [reducedMotion, stopOverview],
  );

  // Selection from the rail drives the camera too: focus the chosen node,
  // and return to the overview when the selection clears. Graph clicks set
  // focusedId first, so this never double-animates.
  useEffect(() => {
    if (!ready) return;
    if (!selectedId) {
      if (focusedId.current) showOverview();
      return;
    }
    if (focusedId.current === selectedId) return;
    const node = graphData.nodes.find((item) => item.id === selectedId);
    if (node) focusNode(node);
  }, [focusNode, graphData, ready, selectedId, showOverview]);

  const nodeVal = useCallback((node: GraphNode) => node.val, []);
  const nodeLabel = useCallback(() => "", []);
  const linkColor = useCallback((link: GraphLink) => (link.hot ? palette.linkHot : palette.linkCold), [palette]);
  const linkWidth = useCallback((link: GraphLink) => (link.hot ? 1.6 : 0.45), []);
  const particleColor = useCallback(() => palette.particle, [palette]);
  const onNodeClick = useCallback(
    (node: GraphNode) => {
      if (!node.id) return;
      if (node.id === selectedId) {
        showOverview();
        onSelect(null);
        return;
      }
      focusNode(node);
      onSelect(node.id);
    },
    [focusNode, onSelect, selectedId, showOverview],
  );

  const onNodeHover = useCallback(
    (node: GraphNode | null) => {
      onHover?.(node?.id ?? null);
      if (wrapRef.current) wrapRef.current.style.cursor = node ? "pointer" : "";
    },
    [onHover],
  );

  const mounted = ready && size.width > 0 && size.height > 0;

  return (
    <div ref={wrapRef} className="absolute inset-0">
      {mounted ? (
        <ForceGraph3D
          ref={graphRef}
          width={size.width}
          height={size.height}
          graphData={graphData}
          backgroundColor="rgba(0,0,0,0)"
          showNavInfo={false}
          nodeRelSize={1}
          nodeVal={nodeVal}
          nodeThreeObject={nodeObject}
          nodeThreeObjectExtend={false}
          nodeLabel={nodeLabel}
          onNodeClick={onNodeClick}
          onNodeHover={onNodeHover}
          linkColor={linkColor}
          linkWidth={linkWidth}
          linkOpacity={0.9}
          linkResolution={8}
          linkDirectionalParticles={reducedMotion ? 0 : 3}
          linkDirectionalParticleWidth={1.8}
          linkDirectionalParticleSpeed={0.006}
          linkDirectionalParticleColor={particleColor}
          warmupTicks={reducedMotion ? 90 : 40}
          cooldownTime={reducedMotion ? 0 : 3000}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 grid place-items-center">
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/60" />
            <span
              className="size-1.5 animate-pulse rounded-full bg-muted-foreground/60"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="size-1.5 animate-pulse rounded-full bg-muted-foreground/60"
              style={{ animationDelay: "300ms" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
