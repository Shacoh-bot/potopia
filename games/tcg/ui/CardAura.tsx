"use client";

import { type CSSProperties, useEffect, useRef } from "react";

/*
 * Aura d'une carte (validée par l'utilisateur, prototype v3) : quelque chose brille derrière la
 * carte et on voit ce qui en est émis.
 * 1. une lueur serrée contre le bord, comme si la carte était éclairée par derrière ;
 * 2. des vrilles d'énergie (bruit simplex « ridged », WebGL) qui tournent en sens contraire,
 *    se tordent et filent vers l'extérieur en s'effaçant ;
 * 3. des étincelles indépendantes, nées sur le bord, qui tourbillonnent en s'éloignant et
 *    s'éteignent (canvas 2D, trajectoires calculées : rien n'est stocké d'une image à l'autre).
 * Gradation : rare = halo doux seul (CSS) ; épique discrète ; légendaire ; SR bien plus fournie ;
 * SSR débordante (arc-en-ciel). Lent et souple (3 fois moins vite que le premier prototype).
 *
 * Toutes les auras tournent en continu, sans survol. Fluidité : tampon allégé (RESOLUTION),
 * 30 im/s au plus, arrêt hors écran ; « réduire les animations » : une image fixe.
 * La lueur remplit aussi l'arrière de la carte (rien de vide quand elle s'incline) et s'éteint
 * tout à fait avant le bord du canevas (aucun bord droit visible).
 * Le dessin se fait dans le repère du prototype (carte de 360 × 504 au centre), mis à l'échelle.
 */

type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "sr" | "ssr";

type Palette = {
  core: [number, number, number];
  mid: [number, number, number];
  edge: [number, number, number];
  /** Portée, éclat des vrilles et de la lueur. */
  power: number;
  /** Nombre d'étincelles. */
  sparks: number;
  rainbow: boolean;
};

const PALETTES: Partial<Record<Rarity, Palette>> = {
  epic: {
    core: [0.95, 0.88, 1],
    mid: [0.66, 0.4, 1],
    edge: [0.32, 0.1, 0.7],
    power: 0.32,
    sparks: 22,
    rainbow: false,
  },
  legendary: {
    core: [1, 0.96, 0.8],
    mid: [1, 0.7, 0.2],
    edge: [0.8, 0.3, 0.05],
    power: 0.55,
    sparks: 60,
    rainbow: false,
  },
  sr: {
    core: [1, 1, 1],
    mid: [0.86, 0.82, 1],
    edge: [0.55, 0.75, 1],
    power: 0.95,
    sparks: 190,
    rainbow: false,
  },
  ssr: {
    core: [1, 1, 1],
    mid: [1, 0.5, 0.85],
    edge: [0.3, 0.6, 1],
    power: 1.4,
    sparks: 340,
    rainbow: true,
  },
};

/** Raretés qui ont une aura (la rare n'a qu'un halo doux). */
export function hasAura(rarity: string): boolean {
  return rarity === "rare" || rarity in PALETTES;
}

/** Repère du prototype : demi-largeur et demi-hauteur de la carte, rayon des coins. */
const HW = 180;
const HH = 252;
const RAD = 26;
/** Marge autour de la carte où l'aura se dessine (fraction de la largeur de la carte). */
export const AURA_MARGIN = 0.65;
/** La même marge, dans le repère du prototype (identique sur les 4 côtés). */
const MARGIN_UNITS = Math.round(2 * HW * AURA_MARGIN);
/**
 * Extinction de l'aura vers l'extérieur (fractions de la place disponible) : pleine jusqu'à
 * FADE_FROM, nulle à FADE_TO. Place : la marge du canevas, ou moins de chaque côté si le cadre
 * qui découpe l'aura (`data-aura-bounds`, l'écran d'ouverture) est plus près. Lueur et
 * étincelles suivent la même règle : aucun bord droit visible.
 */
const FADE_FROM = 0.5;
const FADE_TO = 0.95;
function fade(dist: number, room: number): number {
  const x = Math.min(1, Math.max(0, (dist / room - FADE_FROM) / (FADE_TO - FADE_FROM)));
  return 1 - x * x * (3 - 2 * x);
}
/** Place de chaque côté (gauche, droite, haut, bas), repère du prototype. */
type Room = [number, number, number, number];
/** Extinction d'un point (repère du prototype, carte au centre). */
function outerFade(x: number, y: number, room: Room): number {
  const ox = Math.max(0, Math.abs(x) - HW);
  const oy = Math.max(0, Math.abs(y) - HH);
  return (
    fade(Math.hypot(ox, oy), MARGIN_UNITS) *
    fade(ox, x < 0 ? room[0] : room[1]) *
    fade(oy, y < 0 ? room[2] : room[3])
  );
}
/** Taille du tampon par pixel CSS : la lueur est floue par nature, 5 auras tournent ensemble. */
const RESOLUTION = 0.75;
/** Au plus une image toutes les 33 ms (30 im/s) : le mouvement est lent. */
const FRAME_MS = 33;

const VS = "attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }";
const FS = `
precision highp float;
uniform vec2 res; uniform float t; uniform float k;
uniform vec3 cCore, cMid, cEdge; uniform float rainbow; uniform float power;
uniform vec4 room;
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
// Bruit simplex 3D (Ashima Arts, licence MIT).
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*snoise(p); p*=2.03; a*=.5; } return s; }
float fbm3(vec3 p){ float a=.55, s=0.; for(int i=0;i<3;i++){ s+=a*snoise(p); p*=1.9; a*=.45; } return s; }
float sdBox(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
float fade(float d, float m){ return 1. - smoothstep(m*${FADE_FROM}, m*${FADE_TO}, d); }
float outerFade(vec2 p, vec2 card, float dd){
  float ox = max(abs(p.x)-card.x, 0.); float oy = max(abs(p.y)-card.y, 0.);
  return fade(dd, ${MARGIN_UNITS}.) * fade(ox, p.x < 0. ? room.x : room.y) * fade(oy, p.y < 0. ? room.z : room.w);
}
void main(){
  // Repère du prototype : carte de 360 × 504 au centre, mis à l'échelle (k).
  vec2 p = (vec2(gl_FragCoord.x, res.y-gl_FragCoord.y) - res*0.5) / k;
  vec2 card = vec2(${HW}., ${HH}.);
  float d = sdBox(p, card, ${RAD}.);
  float dd = max(d, 0.);
  float t = t * 0.333;
  float ang = atan(p.y/card.y, p.x/card.x);
  float tw = 0.35*fbm(vec3(cos(ang)*1.5, sin(ang)*1.5, dd*0.012 - t*0.6));
  float a1 = ang + t*0.18 + tw + dd*0.0035;
  float a2 = ang - t*0.27 - tw*1.3 - dd*0.0045;
  vec3 P1 = vec3(cos(a1)*2.2, sin(a1)*2.2, dd*0.008 - t*1.0);
  vec3 P2 = vec3(cos(a2)*3.0, sin(a2)*3.0, dd*0.011 - t*1.35 + 9.);
  float r1 = 1.-abs(fbm3(P1));
  float r2 = 1.-abs(fbm3(P2));
  float ex = mix(11., 5.5, clamp(power/1.4, 0., 1.));
  float tendrils = pow(r1, ex)*1.1 + pow(r2, ex*1.3)*0.8;
  float halo = pow(r1, 2.5)*0.28 + pow(r2, 3.)*0.18;
  float body = smoothstep(.05, .75, fbm(vec3(cos(a1)*1.6, sin(a1)*1.6, dd*0.006 - t*0.7)));
  // Portée un peu réduite (× 0,82, 16/11), gradation entre raretés inchangée.
  float reach = (70. + 70.*(0.5+0.5*snoise(vec3(cos(ang)*1.2, sin(ang)*1.2, t*0.35)))) * (0.55 + 0.6*power) * 0.82;
  float fade = exp(-dd/reach*2.0) * smoothstep(-6., 6., d);
  // Derrière la carte, la lueur remplit tout (dd = 0) : inclinée, la carte ne laisse jamais voir
  // de vide derrière elle.
  float edgeGlow = (exp(-dd/12.)*0.9 + exp(-dd/45.)*0.3) * (0.6 + 0.5*power);
  float flames = (body*0.25 + halo + tendrils*1.2) * fade * (0.45 + 0.75*power);
  float I = edgeGlow + flames;
  vec3 col = mix(cEdge, cMid, smoothstep(0., .7, I));
  col = mix(col, cCore, smoothstep(.9, 1.8, I));
  if (rainbow > 0.5) {
    float h = fract(atan(p.y,p.x)/6.2832 + t*0.08 + dd*0.002);
    vec3 rb = 0.5+0.5*cos(6.2832*(h+vec3(0.,.33,.67)));
    col = mix(col, rb*1.2, .55*smoothstep(.2, 1.2, I));
  }
  // La lumière s'éteint tout à fait avant le bord du canevas (même marge sur les 4 côtés) : aucun
  // bord droit visible, même pour SR et SSR.
  float a = clamp(I, 0., 1.) * outerFade(p, card, dd);
  gl_FragColor = vec4(col*a, a);
}`;

type Spark = {
  u: number;
  life: number;
  offset: number;
  speed: number;
  swirl: number;
  amp: number;
  freq: number;
  size: number;
  drift: number;
};

/** Étincelles tirées une fois (graine fixe) : même aura à chaque affichage. */
function makeSparks(count: number): Spark[] {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: count }, () => ({
    u: rnd(),
    life: 4 + rnd() * 3.5,
    offset: rnd() * 8,
    // Un peu moins loin qu'avant (× 0,82, 16/11).
    speed: (17 + rnd() * 30) * 0.82,
    swirl: (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 1.2),
    amp: 10 + rnd() * 22,
    freq: 0.6 + rnd() * 1.1,
    size: 0.7 + rnd() * 1.4,
    drift: rnd() * 6.283,
  }));
}

const PERIM = 4 * HW + 4 * HH;
/** Point du bord de la carte (u ∈ [0,1[) et sa normale, repère du prototype. */
function edgePoint(u: number): [number, number, number, number] {
  let s = u * PERIM;
  const w = 2 * HW;
  const h = 2 * HH;
  if (s < w) return [-HW + s, -HH, 0, -1];
  s -= w;
  if (s < h) return [HW, -HH + s, 1, 0];
  s -= h;
  if (s < w) return [HW - s, HH, 0, 1];
  s -= w;
  return [-HW, HH - s, -1, 0];
}

function drawSparks(
  ctx: CanvasRenderingContext2D,
  sparks: Spark[],
  pal: Palette,
  t: number,
  room: Room,
) {
  const { width, height } = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const k = width / (2 * HW * (1 + 2 * AURA_MARGIN));
  ctx.setTransform(k, 0, 0, k, width / 2, height / 2);
  ctx.globalCompositeOperation = "lighter";
  const [cr, cg, cb] = pal.mid.map((v) => Math.round(v * 255));
  for (const s of sparks) {
    const age = (t + s.offset) % s.life;
    const k1 = age / s.life;
    const cycle = Math.floor((t + s.offset) / s.life);
    const [x0, y0, nx, ny] = edgePoint((s.u + cycle * 0.618) % 1);
    const tx = -ny;
    const ty = nx;
    const a = Math.sin(Math.PI * Math.min(1, k1 * 1.15)) * (1 - k1 * 0.4);
    // Traînée : quelques points en arrière sur la trajectoire, de plus en plus faibles.
    for (let j = 4; j >= 0; j--) {
      const ag = Math.max(0, age - j * 0.08);
      const kk = ag / s.life;
      const dist = s.speed * ag * (1 - 0.3 * kk);
      const wob = Math.sin(ag * s.freq + s.drift) * s.amp * kk + s.swirl * 40 * kk * kk;
      const x = x0 + nx * dist + tx * wob;
      const y = y0 + ny * dist + ty * wob - 25 * kk * kk;
      // L'étincelle s'éteint avant le bord du canevas et du cadre.
      const aj = a * (1 - j / 5) * outerFade(x, y, room);
      if (aj <= 0.003) continue;
      const r = s.size * (j === 0 ? 1 : 0.7) * 3;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,235,${aj})`);
      g.addColorStop(0.35, `rgba(${cr},${cg},${cb},${aj * 0.7})`);
      g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.283);
      ctx.fill();
    }
  }
}

/**
 * Aura derrière une carte. À poser dans un parent `position: relative` de la taille de la carte,
 * avant elle : elle déborde de `AURA_MARGIN` × la largeur de la carte tout autour, sans capter le
 * pointeur.
 */
export function CardAura({ rarity, className }: { rarity: string; className?: string }) {
  const pal = PALETTES[rarity as Rarity];
  if (rarity === "rare") return <div aria-hidden className={`tcg-aura-rare ${className ?? ""}`} />;
  if (!pal) return null;
  return <AuraCanvas pal={pal} className={className} />;
}

function AuraCanvas({ pal, className }: { pal: Palette; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const glCanvas = useRef<HTMLCanvasElement>(null);
  const fxCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = box.current;
    const c1 = glCanvas.current;
    const c2 = fxCanvas.current;
    if (!el || !c1 || !c2) return;
    const gl = c1.getContext("webgl", { premultipliedAlpha: true, preserveDrawingBuffer: true });
    const ctx = c2.getContext("2d");
    if (!gl || !ctx) return;
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) throw new Error("shader");
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(prog, n);
    gl.uniform3fv(U("cCore"), pal.core);
    gl.uniform3fv(U("cMid"), pal.mid);
    gl.uniform3fv(U("cEdge"), pal.edge);
    gl.uniform1f(U("rainbow"), pal.rainbow ? 1 : 0);
    gl.uniform1f(U("power"), pal.power);
    const sparks = makeSparks(pal.sparks);
    // Cadre qui découpe l'aura (écran d'ouverture) : elle s'éteint avant lui.
    const bounds = el.closest<HTMLElement>("[data-aura-bounds]");
    const room: Room = [MARGIN_UNITS, MARGIN_UNITS, MARGIN_UNITS, MARGIN_UNITS];

    // Taille du tampon : celle affichée (zoom et agrandissement compris), allégée (RESOLUTION).
    const resize = () => {
      const r = el.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * RESOLUTION));
      const h = Math.max(1, Math.round(r.height * RESOLUTION));
      for (const c of [c1, c2]) {
        if (c.width !== w || c.height !== h) {
          c.width = w;
          c.height = h;
        }
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(U("res"), w, h);
      gl.uniform1f(U("k"), w / (2 * HW * (1 + 2 * AURA_MARGIN)));
      const card = el.parentElement?.getBoundingClientRect();
      if (bounds && card && card.width > 0) {
        const b = bounds.getBoundingClientRect();
        const unit = card.width / (2 * HW);
        const sides = [
          card.left - b.left,
          b.right - card.right,
          card.top - b.top,
          b.bottom - card.bottom,
        ];
        sides.forEach((v, i) => (room[i] = Math.min(MARGIN_UNITS, Math.max(1, v / unit))));
      }
      gl.uniform4f(U("room"), ...room);
    };

    const draw = (t: number) => {
      gl.uniform1f(U("t"), t);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      drawSparks(ctx, sparks, pal, t, room);
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now() - 3000;
    let frame = 0;
    let last = 0;
    let visible = true;
    const loop = (now: number) => {
      if (now - last >= FRAME_MS) {
        last = now;
        draw((now - start) / 1000);
      }
      frame = requestAnimationFrame(loop);
    };
    // Toutes les auras tournent en continu, sans survol (16/11) ; arrêt hors écran et avec
    // « réduire les animations ».
    const update = () => {
      const run = !reduced && visible;
      if (run && !frame) frame = requestAnimationFrame(loop);
      if (!run && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    resize();
    draw(3);
    update();

    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      update();
    });
    io.observe(el);
    const ro = new ResizeObserver(() => {
      resize();
      if (!frame) draw((performance.now() - start) / 1000);
    });
    ro.observe(el);
    if (bounds) ro.observe(bounds);

    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      ro.disconnect();
      // Pas de `loseContext()` : le canevas peut être réutilisé (effet rejoué en développement) ;
      // le navigateur libère le contexte quand le canevas quitte la page.
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
  }, [pal]);

  // Boîte = carte + marge (fraction de la largeur) de chaque côté : largeur en % de la carte,
  // hauteur par le rapport d'aspect, centrée verticalement.
  const style: CSSProperties = {
    left: `${-AURA_MARGIN * 100}%`,
    width: `${(1 + 2 * AURA_MARGIN) * 100}%`,
    top: "50%",
    transform: "translateY(-50%)",
    aspectRatio: `${2 * HW * (1 + 2 * AURA_MARGIN)} / ${2 * HH + 4 * HW * AURA_MARGIN}`,
  };
  return (
    <div ref={box} aria-hidden className={`tcg-aura ${className ?? ""}`} style={style}>
      <canvas ref={glCanvas} />
      <canvas ref={fxCanvas} />
    </div>
  );
}
