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
  PMREMGenerator,
  SphereGeometry,
  SRGBColorSpace,
  type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import SpriteText from "three-spritetext";
import { FIELD_SELF_ID, type FieldPerson } from "@/components/signal-field";

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
    root: 0x4c6610,
    hot: 0x6d8c1c,
    cold: 0x8a8478,
    label: "#16180f",
    linkHot: "rgba(76, 102, 16, 0.72)",
    linkCold: "rgba(22, 24, 15, 0.22)",
    particle: "#4c6610",
  },
  dark: {
    root: 0xd6ff4a,
    hot: 0xd6ff4a,
    cold: 0x9a958c,
    label: "rgba(244, 241, 234, 0.95)",
    linkHot: "rgba(214, 255, 74, 0.55)",
    linkCold: "rgba(244, 241, 234, 0.2)",
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
    emissiveIntensity: selected ? 1.35 : kind === "root" ? 0.9 : hot ? 0.45 : 0.12,
    transparent: true,
    opacity: kind === "cold" && !selected ? 0.62 : 0.86,
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
  onSelect,
  reducedMotion,
}: {
  people: FieldPerson[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  reducedMotion: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const dressed = useRef(false);
  const focusedId = useRef<string | null>(null);
  const focusTimer = useRef<number | null>(null);
  const overviewFrame = useRef<number | null>(null);
  const overviewPose = useRef<{ x: number; y: number; z: number } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
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

  const graphData = useMemo(() => {
    const nodes: GraphNode[] = [{ id: ORIGIN, name: "You", kind: "root", val: 18 }];
    const links: GraphLink[] = [];
    for (const person of people) {
      const hot = person.recommendation !== null;
      nodes.push({
        id: person.id,
        name: person.demo ? `${person.displayName} · demo` : person.displayName,
        kind: hot ? "hot" : "cold",
        val: hot ? 10 : 6,
        demo: person.demo,
      });
      links.push({ source: ORIGIN, target: person.id, hot });
    }
    nodes[0] = { ...nodes[0], fx: 0, fy: 0, fz: 0 };
    return { nodes, links };
    // La selección crea un array nuevo con la misma gente. Rehacer los nodos reinicia la cámara.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterKey]);

  const nodeObject = useCallback(
    (node: GraphNode) => {
      const group = new Group();
      const selected = node.id === selectedId;
      const color = node.kind === "root" ? palette.root : node.kind === "hot" ? palette.hot : palette.cold;
      const mesh = new Mesh(sphere(node.val), glass(color, selected, node.kind));
      group.add(mesh);

      if (node.name && (node.kind !== "cold" || selected)) {
        const label = new SpriteText(node.name);
        label.color = palette.label;
        label.fontWeight = "600";
        label.fontFace = "Instrument Serif, Georgia, serif";
        label.textHeight = Math.max(3.6, node.val * 0.48);
        label.position.y = node.kind === "root" ? node.val + label.textHeight : -(node.val + label.textHeight * 0.85 + 1.5);
        label.material.depthTest = false;
        group.add(label);
      }
      return group;
    },
    [palette, selectedId],
  );

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || size.width === 0) return;
    const charge = graph.d3Force("charge") as { strength?: (value: number) => void } | undefined;
    charge?.strength?.(-420);
    const link = graph.d3Force("link") as { distance?: (value: number) => void } | undefined;
    link?.distance?.(110);
    if (!dressed.current) {
      dressed.current = true;
      const renderer = graph.renderer() as WebGLRenderer;
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = theme === "dark" ? 1.15 : 1;
      const pmrem = new PMREMGenerator(renderer);
      graph.scene().environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
      const key = new DirectionalLight(0xfff6e8, theme === "dark" ? 2.2 : 1.6);
      key.position.set(40, 60, 80);
      graph.scene().add(key);
    }
    const controls = graph.controls() as OrbitControls;
    controls.autoRotate = !reducedMotion;
    controls.autoRotateSpeed = 0.55;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    const frame = window.setTimeout(() => {
      if (focusedId.current) return;
      graph.zoomToFit(0, 8);
      const fitted = readCamera(graph);
      const pose = { x: fitted.x * 0.2 + 36, y: fitted.y * 0.25 + 28, z: fitted.z };
      overviewPose.current = pose;
      graph.cameraPosition(pose, { x: 0, y: 0, z: 0 }, reducedMotion ? 0 : 800);
    }, 700);
    return () => window.clearTimeout(frame);
  }, [graphData, reducedMotion, size.height, size.width, theme]);

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
    (node: { id?: string; x?: number; y?: number; z?: number }) => {
      const graph = graphRef.current;
      if (!graph || !node.id || node.x === undefined) return;
      focusedId.current = node.id;
      if (focusTimer.current !== null) window.clearTimeout(focusTimer.current);
      stopOverview();
      const look = { x: node.x, y: node.y ?? 0, z: node.z ?? 0 };
      const controls = graph.controls() as OrbitControls;
      controls.autoRotate = false;
      controls.target.set(look.x, look.y, look.z);
      const distance = 72;
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

  return (
    <div ref={wrapRef} className="absolute inset-0">
      {size.width > 0 && size.height > 0 ? (
        <ForceGraph3D
          ref={graphRef}
          width={size.width}
          height={size.height}
          graphData={graphData}
          backgroundColor="rgba(0,0,0,0)"
          showNavInfo={false}
          nodeRelSize={1}
          nodeVal={(node) => node.val}
          nodeThreeObject={nodeObject}
          nodeThreeObjectExtend={false}
          nodeLabel={() => ""}
          onNodeClick={(node) => {
            if (!node.id) return;
            if (node.id === selectedId) {
              showOverview();
              onSelect(null);
              return;
            }
            focusNode(node);
            onSelect(node.id);
          }}
          linkColor={(link) => (link.hot ? palette.linkHot : palette.linkCold)}
          linkWidth={(link) => (link.hot ? 1.4 : 0.45)}
          linkOpacity={0.9}
          linkResolution={8}
          linkDirectionalParticles={reducedMotion ? 0 : 3}
          linkDirectionalParticleWidth={1.8}
          linkDirectionalParticleSpeed={0.006}
          linkDirectionalParticleColor={() => palette.particle}
          warmupTicks={reducedMotion ? 90 : 40}
          cooldownTime={reducedMotion ? 0 : 6000}
        />
      ) : null}
    </div>
  );
}
