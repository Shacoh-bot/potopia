"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";

/*
 * Aura d'une carte (validée par l'utilisateur, prototype v3) : quelque chose brille derrière la
 * carte et on voit ce qui en est émis.
 * 1. une lueur serrée contre le bord, comme si la carte était éclairée par derrière ;
 * 2. des vrilles d'énergie (bruit simplex « ridged », WebGL) qui tournent en sens contraire,
 *    se tordent et filent vers l'extérieur en s'effaçant ;
 * 3. des étincelles indépendantes, nées sur le bord, qui tourbillonnent en s'éloignant et
 *    s'éteignent (trajectoires calculées : rien n'est stocké d'une image à l'autre).
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
export const MARGIN_UNITS = Math.round(2 * HW * AURA_MARGIN);
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
export type Room = [number, number, number, number];
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
export function makeSparks(count: number): Spark[] {
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

/** Données d'un point d'étincelle pour WebGL : centre (x, y, pixels du canevas), rayon, éclat. */
const POINT_FLOATS = 4;

/**
 * Points des étincelles à l'instant `t` (pixels du canevas, origine en haut à gauche), écrits dans
 * `out` ; renvoie leur nombre. Chaque étincelle laisse une traînée de 5 points.
 */
export function sparkPoints(
  sparks: Spark[],
  t: number,
  room: Room,
  width: number,
  height: number,
  out: Float32Array,
): number {
  const k = width / (2 * HW * (1 + 2 * AURA_MARGIN));
  const cx = width / 2;
  const cy = height / 2;
  let n = 0;
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
      const o = n * POINT_FLOATS;
      out[o] = cx + x * k;
      out[o + 1] = cy + y * k;
      out[o + 2] = r * k;
      out[o + 3] = Math.min(1, aj);
      n++;
    }
  }
  return n;
}

/*
 * Étincelles en WebGL (fluidité, 16/11) : avant, un dégradé radial du canevas 2D par point et par
 * image (des milliers) faisait tomber Firefox sous 20 im/s. Même dessin, calculé par pixel :
 * - chaque point est un disque de rayon r, rempli du même dégradé radial qu'un canevas 2D (arrêts
 *   0 : blanc chaud, 0,35 : couleur de la rareté à 0,7, 1 : transparent ; interpolation sans
 *   prémultiplier, comme le canevas), multiplié par l'éclat du point ;
 * - les points s'additionnent (« lighter » du canevas 2D) dans une texture à part ;
 * - cette texture est posée par-dessus les vrilles (« source-over »), comme l'était le canevas des
 *   étincelles au-dessus de celui des vrilles.
 */
const SPARK_VS = `
attribute vec4 pt; uniform vec2 res;
varying vec2 c; varying float r; varying float a;
void main(){
  c = pt.xy; r = pt.z; a = pt.w;
  gl_Position = vec4(pt.x/res.x*2.-1., 1.-pt.y/res.y*2., 0., 1.);
  gl_PointSize = ceil(2.*pt.z + 2.);
}`;
const SPARK_FS = `
precision highp float;
uniform vec2 res; uniform vec3 mid; uniform float grow;
varying vec2 c; varying float r; varying float a;
void main(){
  float dist = length(vec2(gl_FragCoord.x, res.y-gl_FragCoord.y) - c);
  // Bord du disque, adouci sur un pixel comme le canevas 2D.
  float cover = clamp(r + .5 - dist, 0., 1.);
  float d = dist / (r + grow);
  if (cover <= 0. || d >= 1.) discard;
  vec4 col = d < .35
    ? mix(vec4(1., 1., 235./255., 1.), vec4(mid, .7), d/.35)
    : mix(vec4(mid, .7), vec4(mid, 0.), (d-.35)/.65);
  float al = col.a * a * cover;
  gl_FragColor = vec4(col.rgb*al, al);
}`;

let gradientGrowth: number | null = null;
/**
 * Comment ce navigateur peint un dégradé radial du canevas 2D : Firefox l'évalue au rayon du
 * disque, Chrome comme si le rayon était plus grand d'environ un demi-pixel (ses petites étincelles
 * sont un peu plus vives). On le mesure une fois sur un dégradé témoin (blanc opaque au centre,
 * transparent au rayon 16) pour que les étincelles WebGL restent identiques aux anciennes dans
 * chaque navigateur. Renvoie l'agrandissement du rayon, en pixels.
 */
function measureGradientGrowth(): number {
  if (gradientGrowth !== null) return gradientGrowth;
  gradientGrowth = 0;
  // Gardé par navigateur : la mesure ne se refait pas à chaque visite.
  const key = `potopia:aura-gradient:${navigator.userAgent}`;
  try {
    const saved = Number.parseFloat(localStorage.getItem(key) ?? "");
    if (Number.isFinite(saved)) return (gradientGrowth = saved);
  } catch {
    // stockage indisponible (navigation privée stricte) : on mesure
  }
  const c = document.createElement("canvas");
  c.width = c.height = 300;
  // Canevas comme celui des anciennes étincelles (accéléré si le navigateur le fait) : Chrome ne
  // peint pas pareil en mémoire. Sa lecture attend la carte graphique (≈ 0,25 s dans Chrome) :
  // faite une fois, au chargement de la page des boosters (`warmUpAuras`), pas au retournement.
  const ctx = c.getContext("2d");
  if (!ctx) return gradientGrowth;
  const R = 16;
  const x = 150.5;
  const g = ctx.createRadialGradient(x, x, 0, x, x, R);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, x, R, 0, 6.283);
  ctx.fill();
  // Valeur affichée (couleur × opacité) à 6, 8 et 10 pixels du centre : 1 − d / (R + agrandissement).
  const row = ctx.getImageData(150, 150, 12, 1).data;
  const found = [6, 8, 10].map((d) => {
    const v = ((row[d * 4] ?? 0) * (row[d * 4 + 3] ?? 0)) / 255 / 255;
    return v < 1 ? d / (1 - v) - R : 0;
  });
  const mean = found.reduce((s, v) => s + v, 0) / found.length;
  gradientGrowth = Number.isFinite(mean) ? Math.min(1, Math.max(-1, mean)) : 0;
  try {
    localStorage.setItem(key, String(gradientGrowth));
  } catch {
    // stockage indisponible : la mesure se refera à la prochaine visite
  }
  return gradientGrowth;
}
const COPY_FS = `
precision highp float;
uniform sampler2D tex; uniform vec2 res;
void main(){ gl_FragColor = texture2D(tex, gl_FragCoord.xy/res); }`;

/** Plus grande étincelle à l'écran (pixels du tampon) que les points WebGL doivent pouvoir couvrir. */
const MIN_POINT_SIZE = 64;

/**
 * Repli : les étincelles au canevas 2D, comme avant (un dégradé radial par point), quand WebGL ne
 * peut pas les dessiner (programme refusé, points trop petits). Même rendu, plus lent.
 */
function drawSparks2d(
  ctx: CanvasRenderingContext2D,
  points: Float32Array,
  n: number,
  mid: Palette["mid"],
) {
  const { width, height } = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  // Repère du prototype, mis à l'échelle (comme avant).
  const k = width / (2 * HW * (1 + 2 * AURA_MARGIN));
  const cx = width / 2;
  const cy = height / 2;
  ctx.setTransform(k, 0, 0, k, cx, cy);
  ctx.globalCompositeOperation = "lighter";
  const [cr, cg, cb] = mid.map((v) => Math.round(v * 255));
  for (let i = 0; i < n; i++) {
    const o = i * POINT_FLOATS;
    const x = ((points[o] ?? 0) - cx) / k;
    const y = ((points[o + 1] ?? 0) - cy) / k;
    const r = (points[o + 2] ?? 0) / k;
    const aj = points[o + 3] ?? 0;
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

/*
 * Un seul contexte WebGL pour toutes les auras (fluidité, 17/11). Compiler le dessin des vrilles
 * prend 0,5 à 1,5 s (Chrome, Firefox) et Firefox ne le garde pas d'un contexte à l'autre : avec un
 * contexte par aura, chaque carte épique ou mieux figeait la page à son retournement. Le contexte
 * partagé, hors de la page (OffscreenCanvas), compile une fois, sans attendre (extension
 * KHR_parallel_shader_compile), dès l'arrivée sur la page des boosters (`warmUpAuras`). Chaque
 * aura y est dessinée à sa taille, puis l'image passe sans copie dans son propre canevas
 * (`transferToImageBitmap`) : les calques de la page restent les mêmes qu'avant.
 */
type Renderer = {
  canvas: OffscreenCanvas;
  gl: WebGLRenderingContext;
  prog: WebGLProgram;
  sparkProg: WebGLProgram | null;
  copyProg: WebGLProgram | null;
  quad: WebGLBuffer | null;
  pointBuf: WebGLBuffer | null;
  tex: WebGLTexture | null;
  fbo: WebGLFramebuffer | null;
  parallel: { COMPLETION_STATUS_KHR: number } | null;
  /** Programmes vérifiés (compilés et liés). */
  checked: boolean;
  /** Étincelles en WebGL (sinon repli au canevas 2D). */
  webglSparks: boolean;
  texW: number;
  texH: number;
  lost: boolean;
};

let shared: Renderer | null | undefined;
/** Auras à remonter quand le contexte partagé revient après une perte. */
const onRestore = new Set<() => void>();

function createRenderer(): Renderer | null {
  if (typeof OffscreenCanvas === "undefined") return null;
  const canvas = new OffscreenCanvas(1, 1);
  const gl = canvas.getContext("webgl", {
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
  }) as WebGLRenderingContext | null;
  if (!gl) return null;
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  // Lien lancé sans attendre son résultat : la compilation se fait à côté (`rendererReady`).
  const program = (vs: string, fs: string) => {
    const p = gl.createProgram();
    const v = shader(gl.VERTEX_SHADER, vs);
    const f = shader(gl.FRAGMENT_SHADER, fs);
    if (!p || !v || !f) return null;
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    return p;
  };
  const parallel = gl.getExtension("KHR_parallel_shader_compile") as {
    COMPLETION_STATUS_KHR: number;
  } | null;
  const prog = program(VS, FS);
  if (!prog) return null;
  // Points WebGL assez grands pour la plus grosse étincelle, sinon repli au canevas 2D.
  const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | null;
  const pointsOk = (range?.[1] ?? 0) >= MIN_POINT_SIZE;
  const sparkProg = pointsOk ? program(SPARK_VS, SPARK_FS) : null;
  const copyProg = pointsOk ? program(VS, COPY_FS) : null;
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const r: Renderer = {
    canvas,
    gl,
    prog,
    sparkProg,
    copyProg,
    quad,
    pointBuf: gl.createBuffer(),
    tex: gl.createTexture(),
    fbo: gl.createFramebuffer(),
    parallel,
    checked: false,
    webglSparks: false,
    texW: 0,
    texH: 0,
    lost: false,
  };
  gl.bindTexture(gl.TEXTURE_2D, r.tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // Contexte perdu (pilote, mémoire) : on le rend au navigateur ; revenu, tout est recréé.
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    r.lost = true;
  });
  canvas.addEventListener("webglcontextrestored", () => {
    if (shared === r) shared = undefined;
    for (const fn of onRestore) fn();
  });
  return r;
}

function getRenderer(): Renderer | null {
  if (shared === undefined) shared = createRenderer();
  return shared && !shared.lost ? shared : null;
}

/**
 * Programmes prêts ? Sans attendre tant que la compilation tourne (si le navigateur sait le dire),
 * puis une fois pour toutes : lien réussi, étincelles en WebGL ou en repli.
 */
function rendererReady(r: Renderer): boolean {
  if (r.checked) return true;
  const { gl } = r;
  const programs = [r.prog, r.sparkProg, r.copyProg].filter((p): p is WebGLProgram => !!p);
  if (r.parallel) {
    const status = r.parallel.COMPLETION_STATUS_KHR;
    if (!programs.every((p) => gl.getProgramParameter(p, status))) return false;
  }
  if (!gl.getProgramParameter(r.prog, gl.LINK_STATUS)) {
    r.lost = true; // aucune aura animée possible (comme sans WebGL)
    return false;
  }
  r.webglSparks =
    !!r.sparkProg &&
    !!r.copyProg &&
    !!gl.getProgramParameter(r.sparkProg, gl.LINK_STATUS) &&
    !!gl.getProgramParameter(r.copyProg, gl.LINK_STATUS);
  r.checked = true;
  return true;
}

/**
 * À l'arrivée sur la page des boosters, pendant son chargement : contexte partagé créé, dessins
 * compilés et dégradé mesuré, pour que la première aura s'affiche sans attente. Avec l'extension
 * KHR_parallel_shader_compile (Chrome), la compilation se fait à côté, sans bloquer ; sans elle
 * (Firefox), elle ne se fait qu'à la première question : on la pose ici, une fois (≈ 0,5 à 1 s),
 * plutôt qu'au retournement d'une carte.
 */
export function warmUpAuras() {
  if (typeof window === "undefined") return;
  measureGradientGrowth();
  const r = getRenderer();
  if (!r) return;
  const poll = () => {
    if (!r.lost && !rendererReady(r)) setTimeout(poll, 100);
  };
  poll();
}

type AuraFrame = {
  pal: Palette;
  sparks: Spark[];
  points: Float32Array;
  room: Room;
  w: number;
  h: number;
  t: number;
};

/** Dessine une aura dans le contexte partagé ; renvoie le nombre de points d'étincelles. */
function renderAura(r: Renderer, f: AuraFrame): number {
  const { gl, canvas } = r;
  const U = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n);
  if (canvas.width !== f.w || canvas.height !== f.h) {
    canvas.width = f.w;
    canvas.height = f.h;
  }
  gl.viewport(0, 0, f.w, f.h);
  const n = sparkPoints(f.sparks, f.t, f.room, f.w, f.h, f.points);
  // 1. Étincelles, additionnées dans leur texture (« lighter »).
  const sparkProg = r.webglSparks ? r.sparkProg : null;
  if (sparkProg && n > 0) {
    if (r.texW !== f.w || r.texH !== f.h) {
      gl.bindTexture(gl.TEXTURE_2D, r.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, f.w, f.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, r.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.tex, 0);
      r.texW = f.w;
      r.texH = f.h;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, r.fbo);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(sparkProg);
    gl.uniform2f(U(sparkProg, "res"), f.w, f.h);
    // Couleur des étincelles : celle de la rareté, arrondie comme une couleur CSS (0 à 255).
    gl.uniform3fv(
      U(sparkProg, "mid"),
      f.pal.mid.map((v) => Math.round(v * 255) / 255),
    );
    gl.uniform1f(U(sparkProg, "grow"), measureGradientGrowth());
    gl.bindBuffer(gl.ARRAY_BUFFER, r.pointBuf);
    gl.bufferData(gl.ARRAY_BUFFER, f.points.subarray(0, n * POINT_FLOATS), gl.DYNAMIC_DRAW);
    const loc = gl.getAttribLocation(sparkProg, "pt");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.disableVertexAttribArray(loc);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  // 2. Lueur et vrilles : tout le canevas.
  gl.disable(gl.BLEND);
  const { prog } = r;
  gl.useProgram(prog);
  gl.uniform3fv(U(prog, "cCore"), f.pal.core);
  gl.uniform3fv(U(prog, "cMid"), f.pal.mid);
  gl.uniform3fv(U(prog, "cEdge"), f.pal.edge);
  gl.uniform1f(U(prog, "rainbow"), f.pal.rainbow ? 1 : 0);
  gl.uniform1f(U(prog, "power"), f.pal.power);
  gl.uniform2f(U(prog, "res"), f.w, f.h);
  gl.uniform1f(U(prog, "k"), f.w / (2 * HW * (1 + 2 * AURA_MARGIN)));
  gl.uniform4f(U(prog, "room"), ...f.room);
  gl.uniform1f(U(prog, "t"), f.t);
  gl.bindBuffer(gl.ARRAY_BUFFER, r.quad);
  const locQuad = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(locQuad);
  gl.vertexAttribPointer(locQuad, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.disableVertexAttribArray(locQuad);
  // 3. Étincelles par-dessus (« source-over », couleurs prémultipliées).
  const copyProg = r.webglSparks ? r.copyProg : null;
  if (copyProg && n > 0) {
    gl.useProgram(copyProg);
    gl.uniform2f(U(copyProg, "res"), f.w, f.h);
    gl.bindTexture(gl.TEXTURE_2D, r.tex);
    const loc = gl.getAttribLocation(copyProg, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
    gl.disableVertexAttribArray(loc);
  }
  return n;
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
  // Contexte partagé revenu après une perte : on remonte l'aura.
  const [restored, setRestored] = useState(0);

  useEffect(() => {
    const el = box.current;
    const c1 = glCanvas.current;
    const c2 = fxCanvas.current;
    if (!el || !c1 || !c2) return;
    const onRestored = () => setRestored((n) => n + 1);
    onRestore.add(onRestored);
    // Sans WebGL (ni OffscreenCanvas) : pas d'aura animée, comme avant.
    const out = getRenderer() ? c1.getContext("bitmaprenderer") : null;
    const sparks = makeSparks(pal.sparks);
    const points = new Float32Array(sparks.length * 5 * POINT_FLOATS);
    let ctx2d: CanvasRenderingContext2D | null = null;
    // Cadre qui découpe l'aura (écran d'ouverture) : elle s'éteint avant lui.
    const bounds = el.closest<HTMLElement>("[data-aura-bounds]");
    const room: Room = [MARGIN_UNITS, MARGIN_UNITS, MARGIN_UNITS, MARGIN_UNITS];
    let w = 1;
    let h = 1;

    // Taille du tampon : celle affichée (zoom et agrandissement compris), allégée (RESOLUTION).
    const resize = () => {
      const r = el.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width * RESOLUTION));
      h = Math.max(1, Math.round(r.height * RESOLUTION));
      for (const c of [c1, c2]) {
        if (c.width !== w || c.height !== h) {
          c.width = w;
          c.height = h;
        }
      }
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
    };

    /** Dessine l'instant `t` ; faux si le contexte partagé n'est pas encore prêt. */
    const draw = (t: number): boolean => {
      const r = getRenderer();
      if (!r || !out || !rendererReady(r)) return false;
      const n = renderAura(r, { pal, sparks, points, room, w, h, t });
      out.transferFromImageBitmap(r.canvas.transferToImageBitmap());
      // Repli : étincelles au canevas 2D, par-dessus (comme avant).
      if (!r.webglSparks) {
        ctx2d ??= c2.getContext("2d");
        if (ctx2d) drawSparks2d(ctx2d, points, n, pal.mid);
      }
      return true;
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now() - 3000;
    let frame = 0;
    let last = 0;
    let visible = true;
    let waiting = 0;
    const loop = (now: number) => {
      // Tant que le contexte partagé compile, on réessaie à l'image suivante.
      if (now - last >= FRAME_MS && draw((now - start) / 1000)) last = now;
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
    // Image fixe (animations réduites, ou carte arrêtée puis redimensionnée) : dessinée dès que le
    // contexte partagé est prêt.
    const drawStill = (t: number) => {
      window.clearTimeout(waiting);
      if (!draw(t) && getRenderer()) waiting = window.setTimeout(() => drawStill(t), 50);
    };

    resize();
    drawStill(3);
    update();

    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      update();
    });
    io.observe(el);
    const ro = new ResizeObserver(() => {
      resize();
      if (!frame) drawStill((performance.now() - start) / 1000);
    });
    ro.observe(el);
    if (bounds) ro.observe(bounds);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(waiting);
      io.disconnect();
      ro.disconnect();
      onRestore.delete(onRestored);
    };
  }, [pal, restored]);

  // Boîte = carte + marge (fraction de la largeur) de chaque côté : largeur en % de la carte,
  // hauteur par le rapport d'aspect, centrée verticalement.
  const style: CSSProperties = {
    left: `${-AURA_MARGIN * 100}%`,
    width: `${(1 + 2 * AURA_MARGIN) * 100}%`,
    top: "50%",
    transform: "translateY(-50%)",
    aspectRatio: `${2 * HW * (1 + 2 * AURA_MARGIN)} / ${2 * HH + 4 * HW * AURA_MARGIN}`,
  };
  // Second canevas : étincelles au canevas 2D, seulement en repli (sinon vide, sans contexte).
  return (
    <div ref={box} aria-hidden className={`tcg-aura ${className ?? ""}`} style={style}>
      <canvas ref={glCanvas} />
      <canvas ref={fxCanvas} />
    </div>
  );
}
