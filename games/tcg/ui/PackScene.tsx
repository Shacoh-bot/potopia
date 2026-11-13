"use client";

import { Canvas, type ThreeEvent, useFrame, useLoader, useThree } from "@react-three/fiber";
import { type PointerEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
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
  position: new THREE.Vector3(0, 1.5, 3.2),
  target: new THREE.Vector3(0, 1.33, 0),
};
/** Moment de la vidéo (s) qui correspond à VIEW_CUT : la vidéo démarre là. */
export const VIDEO_HANDOFF = 1.4;
/** Hauteur de la ligne pointillée « Déchirer ici » sur le paquet. */
const CUT_Y = 1.31094;
/** Zone (m) où commencer la découpe : un peu sous la ligne, jusqu'au haut de la bande soudée. */
const CUT_BELOW = 0.12;
const CUT_ABOVE = 0.3;
/** Longueur (m) à découper en glissant pour ouvrir : presque toute la largeur (2 m), avec une
 * petite marge aux bords ; la trace finit alors seule jusqu'aux deux bords. */
const CUT_LENGTH = 1.7;
/** Durées (s) : remise de face pour découper, approche de la caméra. */
const ALIGN_TIME = 0.18;
const ZOOM_TIME = 0.5;

/**
 * Éclairage : reflets colorés (magenta, cyan, or) pour que le film holographique brille quand le
 * paquet tourne ; pendant l'approche, le paquet repasse aux réglages de la vidéo (rendu Blender),
 * pour que le relais se fasse sans saut de couleur.
 */
const LOOK = {
  free: { env: 1.1, iridescence: 1, ambient: 0.35, key: 1.1 },
  video: { env: 1.35, iridescence: 0.25, ambient: 0.8, key: 1.8 },
};

type Motion = { rotX: number; rotY: number; velX: number; velY: number; dragging: boolean };
type Cut = { active: boolean; start: number; x: number; min: number; max: number; last: number };

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

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
  look,
  zooming,
  onReady,
  onZoomed,
  onHoverLine,
}: {
  url: string;
  motion: React.RefObject<Motion>;
  cut: React.RefObject<Cut>;
  look: React.RefObject<number>;
  zooming: boolean;
  onReady: () => void;
  onZoomed: () => void;
  onHoverLine: (onLine: boolean) => void;
}) {
  const gltf = useLoader(GLTFLoader, url);
  const camera = useThree((s) => s.camera);
  const group = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh[]>([]);
  const streak = useRef<THREE.Mesh>(null);
  const zoom = useRef({ start: -1, done: false });

  // Film holographique : le matériau exporté, avec des reflets irisés et un vernis.
  const materials = useMemo(() => {
    const list: THREE.MeshPhysicalMaterial[] = [];
    gltf.scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const old = o.material as THREE.MeshStandardMaterial;
      const m = new THREE.MeshPhysicalMaterial({
        map: old.map,
        metalness: 0.35,
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

  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, dt) => {
    const g = group.current;
    const m = motion.current;
    const c = cut.current;
    if (!g) return;
    const t = state.clock.elapsedTime;

    if (zooming) {
      // Approche de la caméra jusqu'au plan de la vidéo, paquet immobile de face.
      const z = zoom.current;
      if (z.done) return;
      if (z.start < 0) z.start = t;
      const k = ease(Math.min(1, (t - z.start) / ZOOM_TIME));
      g.rotation.set(0, 0, 0);
      g.position.set(0, 0, 0);
      camera.position.lerpVectors(VIEW_START.position, VIEW_CUT.position, k);
      target.lerpVectors(VIEW_START.target, VIEW_CUT.target, k);
      camera.lookAt(target);
      look.current = 1 - k;
      // La trace finit la coupe jusqu'aux deux bords, puis s'efface avant le relais vidéo.
      const s = streak.current;
      if (s) {
        const f = ease(Math.min(1, (t - z.start) / (ZOOM_TIME * 0.35)));
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
    } else if (c.active) {
      // Découpe : le paquet se remet de face et ne bouge plus.
      const k = Math.min(1, dt / ALIGN_TIME);
      const turns = Math.round(g.rotation.y / (Math.PI * 2)) * Math.PI * 2;
      g.rotation.set(mix(g.rotation.x, 0, k), mix(g.rotation.y, turns, k), mix(g.rotation.z, 0, k));
      g.position.y = mix(g.position.y, 0, k);
      m.rotX = g.rotation.x;
      m.rotY = g.rotation.y;
      m.velX = m.velY = 0;
    } else {
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
      g.position.y = Math.sin(t * 1.3) * 0.05;
      g.rotation.set(m.rotX, m.rotY, Math.sin(t * 0.9) * 0.02);
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
      const width = Math.max(0.001, c.max - c.min);
      s.scale.x = width;
      s.position.x = (c.min + c.max) / 2;
      const mat = s.material as THREE.MeshBasicMaterial;
      mat.opacity = c.active ? 1 : Math.max(0, mat.opacity - dt * 4);
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
          if (zooming || !g || !onLine(e)) return;
          const local = g.worldToLocal(e.point.clone());
          // Lu par les gestes du canevas (qui reçoivent l'événement juste après) : pas de rotation.
          cut.current = {
            active: true,
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
 * Le paquet qu'on fait tourner en glissant ; glisser le long de la ligne pointillée le découpe
 * (`onCut`), puis la caméra s'approche du plan de la vidéo (`onZoomed`).
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
  const cut = useRef<Cut>({ active: false, start: 0, x: 0, min: 0, max: 0, last: 0 });
  const look = useRef(1);
  const last = useRef<{ x: number; y: number; t: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [hoverLine, setHoverLine] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Libère le modèle en mémoire quand la vidéo prend le relais.
  useEffect(() => () => useLoader.clear(GLTFLoader, url), [url]);

  function down(e: PointerEvent<HTMLDivElement>) {
    if (zooming || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    last.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (cut.current.active) return;
    motion.current.dragging = true;
    motion.current.velX = motion.current.velY = 0;
    setDragging(true);
    onGrab?.();
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    const l = last.current;
    if (!l) return;
    const now = performance.now();
    const c = cut.current;
    if (c.active) {
      // Position sur la ligne (m), le paquet étant de face : écran → largeur du paquet.
      const el = box.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const perMeter = rect.height / (2 * 11 * Math.tan(((FOV / 2) * Math.PI) / 180));
      c.x = Math.max(-1.02, Math.min(1.02, (e.clientX - rect.left - rect.width / 2) / perMeter));
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
        setHoverLine(false);
        onCut();
      }
      return;
    }
    if (!motion.current.dragging) return;
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

  function up() {
    last.current = null;
    cut.current.active = false;
    motion.current.dragging = false;
    setDragging(false);
  }

  return (
    <div
      ref={box}
      className="absolute inset-0"
      style={{
        cursor: zooming
          ? "default"
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
    >
      <Canvas
        camera={{ fov: FOV, near: 0.1, far: 200, position: [0, 0, 11] }}
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
            look={look}
            zooming={zooming}
            onReady={onReady}
            onZoomed={onZoomed}
            onHoverLine={setHoverLine}
          />
        </Suspense>
      </Canvas>
    </div>
  );
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
