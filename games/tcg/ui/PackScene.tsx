"use client";

import { Canvas, type ThreeEvent, useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  type PointerEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OPENING_BG } from "./opening";

/*
 * Paquet de cartes en 3D (écran d'ouverture d'un booster), chargé à la demande : three.js et le
 * modèle ne sont téléchargés que pour cet écran. Le canevas a la taille et la place de la vidéo
 * de découpe (16:9) ; la caméra reprend celle de la vidéo (construire_ouverture.py, Blender) :
 * - au départ, la vue d'ensemble (camera-raccord.json) ;
 * - une fois le paquet découpé à la souris, la caméra s'approche du haut du paquet, jusqu'au plan
 *   de la vidéo juste avant la lame de lumière (VIDEO_HANDOFF) : la vidéo prend le relais sans saut.
 */

/** Champ vertical de la caméra de la vidéo (objectif 50 mm, capteur 36 mm, 16:9). */
const FOV = 22.8952;
/** Vue d'ensemble : la première image de la vidéo. */
const VIEW_START = { position: new THREE.Vector3(0, 0, 11), target: new THREE.Vector3(0, 0, 0) };
/** Plan serré sur la bande soudée, tenu dans la vidéo jusqu'à la lame (image 90 de la scène). */
const VIEW_CUT = {
  position: new THREE.Vector3(0, 1.58144, 3.2),
  target: new THREE.Vector3(0, 1.41144, 0),
};
/** Moment de la vidéo (s) qui correspond à VIEW_CUT : la vidéo démarre là. */
export const VIDEO_HANDOFF = 1.4;
/** Hauteur de la ligne pointillée « Déchirer ici » sur le paquet. */
const CUT_Y = 1.39238;
/** Zone (m) où commencer la découpe : un peu sous la ligne, jusqu'au haut de la bande soudée. */
const CUT_BELOW = 0.12;
const CUT_ABOVE = 0.3;
/** Longueur (m) à découper en glissant pour ouvrir : presque toute la largeur (2 m), avec une
 * petite marge aux bords ; la trace finit alors seule jusqu'aux deux bords. */
const CUT_LENGTH = 1.7;
/** Durées (s) : retour du paquet à la pose de départ de l'animation (s'il a été tourné, zoomé ou
 * déplacé), puis approche de la caméra jusqu'au plan de la vidéo. */
const RESET_TIME = 0.45;
const ZOOM_TIME = 0.5;
/** Distance de la caméra (m) : au départ, et bornes du zoom à la molette ou au pincement. */
const START_DIST = VIEW_START.position.z;
const MIN_DIST = 4.5;
const MAX_DIST = 17;
/** Vitesse (m/s) à laquelle la trace d'une découpe abandonnée recule. */
const RETRACT_SPEED = 3.5;
/** Demi-hauteur visible (m) par mètre de distance (champ vertical de la caméra). */
const HALF_VIEW = Math.tan(((FOV / 2) * Math.PI) / 180);
/** Rapport largeur/hauteur du canevas (celui de la vidéo). */
const ASPECT = 16 / 9;

/**
 * Éclairage : reflets colorés (magenta, cyan, or) pour que le film holographique brille quand le
 * paquet tourne ; pendant l'approche, le paquet repasse aux réglages de la vidéo (rendu Blender),
 * pour que le relais se fasse sans saut de couleur.
 */
const LOOK = {
  free: { env: 1.1, iridescence: 0.6, ambient: 0.35, key: 1.1 },
  video: { env: 1.35, iridescence: 0.25, ambient: 0.8, key: 1.8 },
};

type Motion = { rotX: number; rotY: number; velX: number; velY: number; dragging: boolean };
/**
 * Découpe en cours ; `retract` : abandonnée, la trace recule vers son point de départ. `side` :
 * face découpée (1 devant, -1 au dos), celle qu'on voyait au clic sur le ciseau.
 */
type Cut = {
  active: boolean;
  retract: boolean;
  side: 1 | -1;
  start: number;
  x: number;
  min: number;
  max: number;
  last: number;
};
/** Vue choisie par le joueur : distance de la caméra (visée et actuelle) et décalage du paquet. */
type View = { dist: number; distTo: number; panX: number; panY: number };
/** Point de l'écran → position (m) sur la ligne de découpe, le long du paquet. */
type Project = (clientX: number, clientY: number) => number | null;

const NEW_CUT: Cut = {
  active: false,
  retract: false,
  side: 1,
  start: 0,
  x: 0,
  min: 0,
  max: 0,
  last: 0,
};

const IDENTITY = new THREE.Quaternion();

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Garde le centre du paquet bien dans le champ, quelle que soit la distance. */
function clampPan(view: View) {
  const halfH = view.dist * HALF_VIEW * 0.6;
  view.panX = clamp(view.panX, -halfH * ASPECT, halfH * ASPECT);
  view.panY = clamp(view.panY, -halfH, halfH);
}

/** Précharge le modèle (appelé avant d'ouvrir l'écran, pour qu'il apparaisse aussitôt). */
export function preloadPack(url: string) {
  useLoader.preload(GLTFLoader, url);
}

/** Environnement de reflets : panneaux lumineux colorés autour du paquet. */
function Studio({ look }: { look: React.RefObject<number> }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const room = new THREE.Scene();
    room.background = new THREE.Color("#140b2e");
    const panel = (color: string, w: number, h: number, pos: [number, number, number]) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
      );
      mesh.position.set(...pos);
      mesh.lookAt(0, 0, 0);
      room.add(mesh);
    };
    panel("#ff3df2", 6, 10, [-8, 1, 3]);
    panel("#2fe6ff", 6, 10, [8, -1, 3]);
    panel("#fff1c9", 10, 3, [0, 9, 4]);
    panel("#7b5cff", 12, 4, [0, -9, 2]);
    panel("#ffffff", 3, 3, [2, 3, 9]);
    // Derrière le paquet aussi : le dos brille autant que la face quand on le tourne.
    panel("#2fe6ff", 6, 10, [-7, 1, -5]);
    panel("#ff3df2", 6, 10, [7, -1, -5]);
    panel("#ffffff", 3, 3, [-2, 3, -9]);
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(room, 0.03).texture;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
      room.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    };
  }, [gl, scene]);
  useFrame(({ scene: s }) => {
    s.environmentIntensity = mix(LOOK.video.env, LOOK.free.env, look.current);
  });
  return null;
}

function Pack({
  url,
  motion,
  cut,
  view,
  project,
  look,
  zooming,
  onReady,
  onZoomed,
  onHoverLine,
}: {
  url: string;
  motion: React.RefObject<Motion>;
  cut: React.RefObject<Cut>;
  view: React.RefObject<View>;
  project: React.RefObject<Project | null>;
  look: React.RefObject<number>;
  zooming: boolean;
  onReady: () => void;
  onZoomed: () => void;
  onHoverLine: (onLine: boolean) => void;
}) {
  const gltf = useLoader(GLTFLoader, url);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const group = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh[]>([]);
  const streak = useRef<THREE.Mesh>(null);
  // Après la découpe : pose du paquet et de la caméra au départ du retour, durée du retour.
  const zoom = useRef({
    start: -1,
    done: false,
    reset: RESET_TIME,
    camera: new THREE.Vector3(),
    pack: new THREE.Vector3(),
    turn: new THREE.Quaternion(),
  });
  // Temps du flottement : il s'arrête quand le paquet est figé (pas de saut au déverrouillage).
  const floatTime = useRef(0);

  // Film holographique : le matériau exporté, avec des reflets irisés et un vernis.
  const materials = useMemo(() => {
    const list: THREE.MeshPhysicalMaterial[] = [];
    gltf.scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const old = o.material as THREE.MeshStandardMaterial;
      const m = new THREE.MeshPhysicalMaterial({
        map: old.map,
        // Peu métallique : le métal reflète le fond sombre et délavait les couleurs du paquet.
        metalness: 0.08,
        roughness: 0.24,
        iridescence: 1,
        iridescenceIOR: 1.5,
        iridescenceThicknessRange: [180, 520],
        clearcoat: 0.7,
        clearcoatRoughness: 0.12,
        side: THREE.DoubleSide,
      });
      o.material = m;
      list.push(m);
    });
    return list;
  }, [gltf]);

  // Profondeur de la surface à hauteur de la ligne, devant et derrière : la lueur s'y pose.
  const surface = useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const hit = (z: number, dir: number) => {
      ray.set(new THREE.Vector3(0, CUT_Y - 0.01, z), new THREE.Vector3(0, 0, dir));
      return ray.intersectObject(gltf.scene, true)[0]?.point.z;
    };
    return { front: hit(5, -1) ?? 0.01, back: hit(-5, 1) ?? -0.01 };
  }, [gltf]);

  useEffect(() => {
    camera.position.copy(VIEW_START.position);
    camera.lookAt(VIEW_START.target);
    onReady();
  }, [camera, onReady]);

  // Position sur la ligne de découpe sous le pointeur : rayon de la caméra jusqu'au plan de la
  // face découpée, le paquet étant figé tel quel (tourné, zoomé, déplacé).
  useEffect(() => {
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane();
    const hit = new THREE.Vector3();
    project.current = (clientX, clientY) => {
      const g = group.current;
      if (!g) return null;
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(ndc, camera);
      g.updateMatrixWorld();
      plane.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 0, 1).transformDirection(g.matrixWorld),
        g.localToWorld(
          new THREE.Vector3(0, CUT_Y, cut.current.side > 0 ? surface.front : surface.back),
        ),
      );
      if (!ray.ray.intersectPlane(plane, hit)) return null;
      return g.worldToLocal(hit).x;
    };
    return () => {
      project.current = null;
    };
  }, [camera, cut, gl, project, surface]);

  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, dt) => {
    const g = group.current;
    const m = motion.current;
    const c = cut.current;
    const v = view.current;
    if (!g) return;
    const t = state.clock.elapsedTime;

    if (zooming) {
      // Découpe finie : le paquet quitte en douceur la pose où le joueur l'a figé (rotation,
      // zoom, déplacement) pour la pose de départ de l'animation, puis la caméra s'approche
      // jusqu'au plan de la vidéo, qui prend le relais.
      const z = zoom.current;
      if (z.done) return;
      if (z.start < 0) {
        z.start = t;
        z.camera.copy(camera.position);
        z.pack.copy(g.position);
        z.turn.copy(g.quaternion);
        const moved =
          Math.abs(camera.position.z - START_DIST) > 0.05 ||
          g.position.lengthSq() > 0.0004 ||
          g.quaternion.angleTo(IDENTITY) > 0.05;
        z.reset = moved ? RESET_TIME : 0;
      }
      const elapsed = t - z.start;
      const r = z.reset > 0 ? ease(Math.min(1, elapsed / z.reset)) : 1;
      const k = ease(Math.min(1, Math.max(0, elapsed - z.reset) / ZOOM_TIME));
      g.quaternion.slerpQuaternions(z.turn, IDENTITY, r);
      g.position.lerpVectors(z.pack, VIEW_START.target, r);
      camera.position.lerpVectors(z.camera, VIEW_START.position, r);
      if (r >= 1) camera.position.lerpVectors(VIEW_START.position, VIEW_CUT.position, k);
      target.lerpVectors(VIEW_START.target, VIEW_CUT.target, k);
      camera.lookAt(target);
      look.current = 1 - k;
      // La trace finit la coupe jusqu'aux deux bords, puis s'efface avant le relais vidéo.
      const s = streak.current;
      if (s) {
        const f = ease(Math.min(1, elapsed / 0.25));
        const min = mix(c.min, -1.02, f);
        const max = mix(c.max, 1.02, f);
        s.scale.x = max - min;
        s.position.x = (min + max) / 2;
        (s.material as THREE.MeshBasicMaterial).opacity = k < 0.4 ? 1 : 1 - (k - 0.4) / 0.6;
      }
      if (k >= 1) {
        z.done = true;
        // Une image de plus au plan exact avant de passer la main à la vidéo.
        requestAnimationFrame(() => requestAnimationFrame(onZoomed));
      }
    } else if (!c.active) {
      // Vue du joueur : zoom (molette, pincement) adouci, déplacement suivi tel quel.
      v.dist = mix(v.dist, v.distTo, 1 - Math.pow(0.0005, dt));
      clampPan(v);
      camera.position.set(0, 0, v.dist);
      camera.lookAt(VIEW_START.target);
      g.position.x = v.panX;
    }

    if (zooming) {
      // Approche en cours (ci-dessus) : le paquet ne bouge plus.
    } else if (c.active) {
      // Ciseau : le paquet est figé tel quel (ni redressé, ni flottant) pendant la découpe.
      m.velX = m.velY = 0;
    } else {
      floatTime.current += dt;
      const ft = floatTime.current;
      // Inertie après le lâcher, indépendante de la fréquence d'affichage.
      if (!m.dragging) {
        const damp = Math.pow(0.9, dt * 60);
        m.rotY += m.velY * dt * 60;
        m.rotX += m.velX * dt * 60;
        m.velY *= damp;
        m.velX *= damp;
        m.rotX *= Math.pow(0.97, dt * 60);
      }
      m.rotX = Math.max(-0.6, Math.min(0.6, m.rotX));
      g.position.y = v.panY + Math.sin(ft * 1.3) * 0.05;
      g.rotation.set(m.rotX, m.rotY, Math.sin(ft * 0.9) * 0.02);
    }

    const holo = look.current;
    for (const mat of materials) {
      mat.iridescence = mix(LOOK.video.iridescence, LOOK.free.iridescence, holo);
      mat.clearcoat = 0.7 * holo;
    }

    // La ligne pointillée pulse ; pendant la découpe, la trace lumineuse suit la souris.
    const pulse = c.active || zooming ? 0 : 0.35 + 0.3 * Math.sin(t * 4);
    for (const mesh of glow.current) (mesh.material as THREE.MeshBasicMaterial).opacity = pulse;
    const s = streak.current;
    if (s && !zooming) {
      // Découpe abandonnée : la trace recule jusqu'à son point de départ, puis s'éteint.
      if (c.retract) {
        const step = RETRACT_SPEED * dt;
        c.min = Math.min(c.start, c.min + step);
        c.max = Math.max(c.start, c.max - step);
        if (c.max - c.min < 0.005) c.retract = false;
      }
      const width = Math.max(0.001, c.max - c.min);
      s.scale.x = width;
      s.position.x = (c.min + c.max) / 2;
      const mat = s.material as THREE.MeshBasicMaterial;
      mat.opacity = c.active || c.retract ? 1 : Math.max(0, mat.opacity - dt * 4);
    }
  });

  /** Le point touché est-il sur la ligne de découpe (ou la bande soudée juste au-dessus) ? */
  function onLine(e: ThreeEvent<PointerEvent>): boolean {
    const local = group.current?.worldToLocal(e.point.clone());
    return !!local && local.y > CUT_Y - CUT_BELOW && local.y < CUT_Y + CUT_ABOVE;
  }

  return (
    <group ref={group}>
      <primitive
        object={gltf.scene}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => onHoverLine(onLine(e))}
        onPointerOut={() => onHoverLine(false)}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          const g = group.current;
          // Clic gauche ou doigt seulement : le clic droit déplace le paquet.
          if (zooming || !g || e.nativeEvent.button !== 0 || !onLine(e)) return;
          const local = g.worldToLocal(e.point.clone());
          // Face découpée : celle tournée vers la caméra (le paquet reste tel quel).
          const side = g.worldToLocal(camera.position.clone()).z >= 0 ? 1 : -1;
          const s = streak.current;
          if (s) {
            s.position.z = side > 0 ? surface.front + 0.006 : surface.back - 0.006;
            s.rotation.y = side > 0 ? 0 : Math.PI;
          }
          // Lu par les gestes du canevas (qui reçoivent l'événement juste après) : pas de rotation.
          cut.current = {
            active: true,
            retract: false,
            side,
            start: local.x,
            x: local.x,
            min: local.x,
            max: local.x,
            last: local.x,
          };
        }}
      />
      {[
        { z: surface.front + 0.004, rot: 0 },
        { z: surface.back - 0.004, rot: Math.PI },
      ].map(({ z, rot }, i) => (
        <mesh
          key={rot}
          ref={(mesh) => {
            if (mesh) glow.current[i] = mesh;
          }}
          position={[0, CUT_Y, z]}
          rotation={[0, rot, 0]}
          raycast={() => null}
        >
          <planeGeometry args={[2.04, 0.04]} />
          <meshBasicMaterial
            color="#ff7af6"
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
      <mesh ref={streak} position={[0, CUT_Y, surface.front + 0.006]} raycast={() => null}>
        <planeGeometry args={[1, 0.03]} />
        <meshBasicMaterial
          color="#fff3c4"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/** Curseur « ciseaux » au survol de la ligne pointillée. */
const SCISSORS =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='6' cy='6' r='3'/%3E%3Cpath d='M8.12 8.12 12 12'/%3E%3Cpath d='M20 4 8.12 15.88'/%3E%3Ccircle cx='6' cy='18' r='3'/%3E%3Cpath d='M14.8 14.8 20 20'/%3E%3C/svg%3E\") 14 14, crosshair";

/**
 * Le paquet qu'on manipule : clic gauche (ou un doigt) le fait tourner, clic droit (ou deux
 * doigts) le déplace, la molette (ou le pincement) zoome. Glisser le long de la ligne pointillée
 * le découpe (`onCut`), puis la caméra s'approche du plan de la vidéo (`onZoomed`). Chaque paquet
 * repart de la vue d'origine (composant remonté).
 */
export default function PackScene({
  url,
  zooming,
  onReady,
  onCut,
  onZoomed,
  onGrab,
  onTear,
}: {
  url: string;
  /** Vrai une fois le paquet découpé : la caméra s'approche. */
  zooming: boolean;
  onReady: () => void;
  onCut: () => void;
  onZoomed: () => void;
  /** Le joueur saisit le paquet. */
  onGrab?: () => void;
  /** Un bout de découpe (vitesse en m/s, pour le son). */
  onTear?: (speed: number) => void;
}) {
  const motion = useRef<Motion>({ rotX: 0, rotY: 0, velX: 0, velY: 0, dragging: false });
  const cut = useRef<Cut>({ ...NEW_CUT });
  const view = useRef<View>({ dist: START_DIST, distTo: START_DIST, panX: 0, panY: 0 });
  const project = useRef<Project | null>(null);
  const look = useRef(1);
  const last = useRef<{ x: number; y: number; t: number } | null>(null);
  /** Doigts (ou souris) posés sur la scène, et geste en cours. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const mode = useRef<"rotate" | "pan" | "pinch" | null>(null);
  const pinch = useRef({ dist: 0, x: 0, y: 0 });
  const box = useRef<HTMLDivElement>(null);
  const zoomingRef = useRef(zooming);
  useEffect(() => {
    zoomingRef.current = zooming;
  }, [zooming]);
  const [hoverLine, setHoverLine] = useState(false);
  const [dragging, setDragging] = useState<"rotate" | "pan" | null>(null);
  // Survol de la ligne : le canevas peut l'annoncer pendant son propre rendu (React refuse alors
  // une mise à jour d'état) ; on la reporte, et seulement quand elle change.
  const hoverRef = useRef(false);
  const hover = useCallback((onLine: boolean) => {
    if (hoverRef.current === onLine) return;
    hoverRef.current = onLine;
    queueMicrotask(() => setHoverLine(onLine));
  }, []);

  // Libère le modèle en mémoire quand la vidéo prend le relais.
  useEffect(() => () => useLoader.clear(GLTFLoader, url), [url]);

  // Molette : zoom, sans faire défiler la page (écouteur non passif pour `preventDefault`).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      // Pendant la découpe, le paquet est figé : pas de zoom non plus.
      if (zoomingRef.current || cut.current.active) return;
      // Firefox compte parfois en lignes, pas en pixels.
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      const v = view.current;
      v.distTo = clamp(v.distTo * Math.exp(delta * 0.0012), MIN_DIST, MAX_DIST);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  /** Déplace le paquet de (dx, dy) pixels, à la vitesse du pointeur à sa distance. */
  function pan(dx: number, dy: number) {
    const el = box.current;
    if (!el) return;
    const v = view.current;
    const perPixel = (2 * v.dist * HALF_VIEW) / el.getBoundingClientRect().height;
    v.panX += dx * perPixel;
    v.panY -= dy * perPixel;
    clampPan(v);
  }

  /** Découpe lâchée avant la fin : rien ne s'ouvre, la trace recule. */
  function abandonCut() {
    const c = cut.current;
    if (!c.active) return;
    c.active = false;
    c.retract = true;
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    if (zooming) return;
    const mouse = e.pointerType === "mouse";
    if (mouse && e.button !== 0 && e.button !== 2) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    last.current = { x: e.clientX, y: e.clientY, t: performance.now() };

    // Deux doigts : pincer pour zoomer, glisser pour déplacer ; la rotation ou la découpe
    // commencée par le premier doigt s'arrête.
    if (!mouse && pointers.current.size === 2) {
      abandonCut();
      hover(false);
      motion.current.dragging = false;
      motion.current.velX = motion.current.velY = 0;
      const [a, b] = [...pointers.current.values()];
      if (a && b) pinch.current = pinchOf(a, b);
      mode.current = "pinch";
      setDragging(null);
      return;
    }
    if (pointers.current.size > 1) return;
    if (mouse && e.button === 2) {
      mode.current = "pan";
      setDragging("pan");
      return;
    }
    if (cut.current.active) return;
    mode.current = "rotate";
    motion.current.dragging = true;
    motion.current.velX = motion.current.velY = 0;
    setDragging("rotate");
    onGrab?.();
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    // Bouton relâché sans que le relâchement nous parvienne : le geste est fini.
    if (e.pointerType === "mouse" && e.buttons === 0) {
      up(e);
      return;
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const l = last.current;
    if (!l) return;
    const now = performance.now();

    if (mode.current === "pinch") {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const next = pinchOf(a, b);
      const p = pinch.current;
      const v = view.current;
      if (p.dist > 0 && next.dist > 0) {
        v.distTo = clamp(v.distTo * (p.dist / next.dist), MIN_DIST, MAX_DIST);
        v.dist = v.distTo;
      }
      pan(next.x - p.x, next.y - p.y);
      pinch.current = next;
      return;
    }
    if (mode.current === "pan") {
      pan(e.clientX - l.x, e.clientY - l.y);
      last.current = { x: e.clientX, y: e.clientY, t: now };
      return;
    }

    const c = cut.current;
    if (c.active) {
      // Position sur la ligne (m), sous le pointeur, quels que soient le zoom et le déplacement.
      const x = project.current?.(e.clientX, e.clientY);
      if (x == null) return;
      c.x = clamp(x, -1.02, 1.02);
      c.min = Math.min(c.min, c.x);
      c.max = Math.max(c.max, c.x);
      if (Math.abs(c.x - c.last) > 0.07) {
        onTear?.(Math.abs(c.x - c.last) / Math.max(0.016, (now - l.t) / 1000));
        c.last = c.x;
        last.current = { x: e.clientX, y: e.clientY, t: now };
      }
      if (c.max - c.min >= CUT_LENGTH) {
        c.active = false;
        last.current = null;
        mode.current = null;
        hover(false);
        onCut();
      }
      return;
    }
    if (mode.current !== "rotate" || !motion.current.dragging) return;
    const dx = e.clientX - l.x;
    const dy = e.clientY - l.y;
    const m = motion.current;
    m.rotY += dx * 0.01;
    m.rotX += dy * 0.006;
    const frames = Math.max(1, ((now - l.t) / 1000) * 60);
    m.velY = (dx * 0.01) / frames;
    m.velX = (dy * 0.006) / frames;
    last.current = { x: e.clientX, y: e.clientY, t: now };
  }

  function up(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    abandonCut();
    motion.current.dragging = false;
    // Un doigt reste posé après un pincement : il ne reprend pas la main (pas de saut).
    mode.current = null;
    last.current = null;
    setDragging(null);
  }

  return (
    <div
      ref={box}
      className="absolute inset-0"
      style={{
        cursor: zooming
          ? "default"
          : dragging === "pan"
            ? "move"
            : hoverLine || cut.current.active
              ? SCISSORS
              : dragging
                ? "grabbing"
                : "grab",
        touchAction: "none",
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      // Le clic droit déplace le paquet : pas de menu du navigateur.
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        camera={{ fov: FOV, near: 0.1, far: 200, position: [0, 0, START_DIST] }}
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
      >
        <color attach="background" args={[OPENING_BG]} />
        <Lights look={look} />
        <Studio look={look} />
        <Suspense fallback={null}>
          <Pack
            url={url}
            motion={motion}
            cut={cut}
            view={view}
            project={project}
            look={look}
            zooming={zooming}
            onReady={onReady}
            onZoomed={onZoomed}
            onHoverLine={hover}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

/** Écart et milieu de deux doigts (pixels). */
function pinchOf(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { dist: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Lumière d'ambiance et lumière principale, adoucies pendant l'approche (réglages vidéo). */
function Lights({ look }: { look: React.RefObject<number> }) {
  const ambient = useRef<THREE.AmbientLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const back = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    const k = look.current;
    if (ambient.current) ambient.current.intensity = mix(LOOK.video.ambient, LOOK.free.ambient, k);
    if (key.current) key.current.intensity = mix(LOOK.video.key, LOOK.free.key, k);
    if (back.current) back.current.intensity = LOOK.free.key * 0.9 * k;
  });
  return (
    <>
      <ambientLight ref={ambient} />
      <directionalLight ref={key} position={[3, 4, 6]} />
      <directionalLight ref={back} position={[-3, 3, -6]} />
    </>
  );
}
