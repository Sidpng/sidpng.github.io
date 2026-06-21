import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

const canvas = document.getElementById("bgCanvas");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

function webglOK() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (e) { return false; }
}

if (canvas && webglOK() && !reduce) {
  try { init(); } catch (e) { console.warn("3D scene failed, falling back to gradient:", e); }
}

function init() {
  const CY = 0x2dd4bf, VI = 0x7c8cff, GR = 0x38e07b;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 1.7, 7.4);

  const world = new THREE.Group();
  world.position.y = 0.3;
  scene.add(world);

  /* ---------- starfield ---------- */
  const starGeo = new THREE.BufferGeometry();
  const starN = 600, starPos = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) {
    const r = 18 + Math.random() * 22;
    const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    starPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    starPos[i * 3 + 2] = r * Math.cos(ph);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9fb6ff, size: 0.06, transparent: true, opacity: 0.7 })));

  /* ---------- globe ---------- */
  const R = 1.85;
  const globe = new THREE.Group();
  world.add(globe);
  globe.add(new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.99, 48, 48),
    new THREE.MeshBasicMaterial({ color: 0x051c26, transparent: true, opacity: 0.65 })
  ));
  globe.add(new THREE.Mesh(
    new THREE.IcosahedronGeometry(R, 4),
    new THREE.MeshBasicMaterial({ color: CY, wireframe: true, transparent: true, opacity: 0.22 })
  ));
  globe.add(new THREE.Points(
    new THREE.IcosahedronGeometry(R, 4),
    new THREE.PointsMaterial({ color: VI, size: 0.035, transparent: true, opacity: 0.85 })
  ));
  // halo
  globe.add(new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.06, 48, 48),
    new THREE.MeshBasicMaterial({ color: CY, transparent: true, opacity: 0.05, side: THREE.BackSide })
  ));
  // latitude rings
  for (let i = 1; i <= 4; i++) {
    const lat = (i / 5) * Math.PI - Math.PI / 2;
    const rr = Math.cos(lat) * R, yy = Math.sin(lat) * R;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(rr, 0.004, 6, 80),
      new THREE.MeshBasicMaterial({ color: CY, transparent: true, opacity: 0.18 })
    );
    ring.rotation.x = Math.PI / 2; ring.position.y = yy; globe.add(ring);
  }

  /* ---------- holographic figure (always upright to surface) ---------- */
  const figMat = new THREE.MeshBasicMaterial({ color: CY, transparent: true, opacity: 0.92 });
  const figure = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.2, 4, 10), figMat); torso.position.y = 0.42; figure.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.082, 16, 16), figMat); head.position.y = 0.6; figure.add(head);
  function pivotLimb(x, y, len, rad) {
    const g = new THREE.Group(); g.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(rad, len, 4, 8), figMat); m.position.y = -(len / 2 + rad); g.add(m);
    figure.add(g); return g;
  }
  const armL = pivotLimb(-0.1, 0.52, 0.16, 0.028);
  const armR = pivotLimb(0.1, 0.52, 0.16, 0.028);
  const legL = pivotLimb(-0.045, 0.3, 0.2, 0.032);
  const legR = pivotLimb(0.045, 0.3, 0.2, 0.032);

  // walker orbits about X axis; figure sits at the "north pole" of that orbit → stays radial
  const walker = new THREE.Group();
  world.add(walker);
  figure.position.set(0, R + 0.02, 0);
  walker.add(figure);

  /* ---------- doors ---------- */
  function makeLabel(text, hex) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 64;
    const x = c.getContext("2d");
    x.fillStyle = "#" + hex.toString(16).padStart(6, "0");
    x.font = "600 30px Sora, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.shadowColor = x.fillStyle; x.shadowBlur = 16;
    x.fillText(text, 128, 34);
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    spr.scale.set(0.95, 0.24, 1);
    return spr;
  }
  function makeDoor(s) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0.95 });
    const h = 0.66, w = 0.4, t = 0.035;
    const post = (xx) => { const m = new THREE.Mesh(new THREE.BoxGeometry(t, h, t), mat); m.position.set(xx, h / 2, 0); return m; };
    g.add(post(-w / 2), post(w / 2));
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(w + t, t, t), mat); lintel.position.set(0, h, 0); g.add(lintel);
    const portal = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false })
    );
    portal.position.set(0, h / 2, 0); g.add(portal);
    const label = makeLabel(s.label, s.color); label.position.set(0, h + 0.22, 0); g.add(label);
    g.userData = { ...s, portal, mat, base: 0.1 };
    return g;
  }
  const defs = [
    { label: "Skills", target: "#skills", color: CY, angle: 0.62 },
    { label: "Experience", target: "#experience", color: VI, angle: 0.0 },
    { label: "Contact", target: "#contact", color: GR, angle: -0.62 },
  ];
  const doors = [];
  defs.forEach((s) => {
    const orbit = new THREE.Group(); orbit.rotation.x = s.angle; world.add(orbit);
    const d = makeDoor(s); d.position.set(0, R + 0.02, 0); orbit.add(d);
    doors.push(d);
  });

  /* ---------- bloom ---------- */
  let composer = null;
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.5, 0.0);
    composer.addPass(bloom);
  } catch (e) { composer = null; }

  /* ---------- interaction (click doors → scroll to section) ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null;
  function pick(ev) {
    ndc.x = (ev.clientX / innerWidth) * 2 - 1;
    ndc.y = -(ev.clientY / innerHeight) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(doors, true)[0];
    if (!hit) return null;
    let o = hit.object; while (o && !o.userData.target) o = o.parent;
    return o;
  }
  addEventListener("pointermove", (ev) => {
    const d = pick(ev);
    hovered = d || null;
    document.body.style.cursor = d ? "pointer" : "";
  }, { passive: true });
  addEventListener("pointerdown", (ev) => {
    const tgt = ev.target;
    if (tgt && tgt.closest && tgt.closest("a,button,.nav")) return; // don't hijack real UI
    const d = pick(ev);
    if (d) { const el = document.querySelector(d.userData.target); if (el) el.scrollIntoView({ behavior: "smooth" }); }
  });

  /* ---------- animate ---------- */
  const clock = new THREE.Clock();
  let running = true;
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const t = clock.getElapsedTime();

    world.rotation.y = Math.sin(t * 0.08) * 0.5;        // gentle turntable sway
    globe.rotation.y = t * 0.05;                         // globe spins slowly
    walker.rotation.x = t * 0.32;                        // figure walks around the meridian

    // walk cycle
    const sw = Math.sin(t * 7);
    legL.rotation.x = sw * 0.6; legR.rotation.x = -sw * 0.6;
    armL.rotation.x = -sw * 0.45; armR.rotation.x = sw * 0.45;
    figure.position.y = R + 0.02 + Math.abs(Math.cos(t * 7)) * 0.015;

    // doors react when the walker is near (same X-orbit axis)
    const wAng = walker.rotation.x % (Math.PI * 2);
    doors.forEach((d) => {
      let diff = Math.abs(((d.parent.rotation.x - wAng + Math.PI) % (Math.PI * 2)) - Math.PI);
      const near = Math.max(0, 1 - diff / 0.5);
      const active = hovered === d ? 1 : near;
      d.userData.portal.material.opacity = d.userData.base + active * 0.5;
      d.scale.setScalar(1 + active * 0.08);
    });

    // subtle camera drift
    camera.position.x = Math.sin(t * 0.15) * 0.5;
    camera.lookAt(0, 0.7, 0);

    if (composer) composer.render(); else renderer.render(scene, camera);
  }
  frame();

  /* ---------- resize / visibility ---------- */
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    if (composer) composer.setSize(innerWidth, innerHeight);
  });
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) { clock.start(); frame(); }
  });
}
