import * as T from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';

const V = (x, y, z) => new T.Vector3(x, y, z);
const CYAN = 0x18c9ff, AMBER = 0xffb639;
const rockColors = [0x52655b, 0x46566a, 0x695643, 0x354454, 0x867045, 0x333f4e, 0x40535d];

export function createCutaway(canvas, label) {
  const renderer = new T.WebGLRenderer({canvas, antialias: true, alpha: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new T.Scene(), rock = new T.Group(), routes = new T.Group();
  scene.add(rock, routes, new T.HemisphereLight(0xc4e7ff, 0x594433, 2.1));
  const sun = new T.DirectionalLight(0xffdfb6, 2.4);
  sun.position.set(-60, 90, 70);
  scene.add(sun);
  const camera = new T.OrthographicCamera(-90, 90, 60, -60, 0.1, 1500);
  camera.position.set(68, 20, 155);
  const orbit = new OrbitControls(camera, canvas);
  orbit.target.set(0, -23, 0);
  orbit.minZoom = 0.7;
  orbit.maxZoom = 3.5;
  orbit.enablePan = false;
  orbit.update();
  const grid = new T.GridHelper(340, 30, 0x28445a, 0x132c41);
  grid.position.y = -65;
  scene.add(grid);

  function clear(group) {
    for (const o of [...group.children]) {
      o.traverse(m => {
        m.geometry?.dispose();
        m.material?.dispose();
      });
      group.remove(o);
    }
  }

  function block(w, h, d, color, x, y, z) {
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshStandardMaterial({color, roughness: 0.94}));
    mesh.position.set(x, y, z);
    rock.add(mesh);
    return mesh;
  }

  function rig(x, z) {
    const leg = (a, b, r, color) => {
      const mesh = new T.Mesh(new T.CylinderGeometry(r, r, a.distanceTo(b), 6), new T.MeshStandardMaterial({color}));
      mesh.position.copy(a).lerp(b, 0.5);
      mesh.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
      rock.add(mesh);
    };
    block(17, 1.4, 12, 0x6f6654, x + 1, 0.7, z);
    block(7, 0.7, 7, 0x283641, x, 1.65, z);
    for (const [a, b] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
      const p = (i, flip = 1) => V(x + a * (2.8 - i * 0.43) * flip, 2 + i * 3, z + b * (2.8 - i * 0.43));
      leg(p(0), p(5), 0.16, 0xf5c166);
      for (let i = 0; i < 5; i++) {
        leg(p(i), p(i, -1), 0.1, 0xd09643);
        leg(p(i), p(i + 1, -1), 0.075, 0xe3b264);
        const q = p(i); q.z = 2 * z - q.z;
        leg(p(i), q, 0.09, 0xc5a772);
      }
    }
    block(1.8, 0.7, 1.8, 0xff7851, x, 17.4, z);
    block(4, 1.5, 2.8, 0x26708a, x + 6, 2.2, z + 3);
    block(4, 1.5, 2.8, 0x507281, x + 6, 2.2, z - 1);
    block(3.4, 1.8, 3, 0xa99880, x - 6, 2.3, z - 2);
  }

  function buildRock(x, z) {
    clear(rock);
    for (let i = 0; i < rockColors.length; i++) {
      const y = -4.5 - i * 9, d = 40 + i * 1.5;
      block(157, 8.8, d, rockColors[i], 0, y, -10);
      // Fine seams and exposed ledges add depth without implying surveyed strata.
      block(157.15, 0.4, d + 0.25, rockColors[(i + 2) % rockColors.length], 0, y - 1.4, -10);
    }
    rig(x, z);
  }

  const scale = points => {
    if (points.length < 2) return null;
    const first = points[0], last = points.at(-1);
    const theta = Math.atan2(last.n - first.n, last.e - first.e);
    const c = Math.cos(theta), s = Math.sin(theta);
    const horizontal = p => [(p.e-first.e)*c + (p.n-first.n)*s, (p.n-first.n)*c - (p.e-first.e)*s];
    const xs = points.map(p => horizontal(p)[0]);
    const x0 = Math.min(...xs), dx = Math.max(1, Math.max(...xs) - x0);
    const tvd = Math.max(1, ...points.map(p => p.tvd));
    return p => {
      const [x, z] = horizontal(p);
      return V(-58 + 118 * (x - x0) / Math.max(dx, tvd * 0.32), -55 * p.tvd / tvd,
        13 + T.MathUtils.clamp(z * 100 / Math.max(dx, tvd), -10, 9));
    };
  };

  function dashed(points, color) {
    if (points.length < 2) return;
    const line = new T.Line(new T.BufferGeometry().setFromPoints(points),
      new T.LineDashedMaterial({color, dashSize: 2.4, gapSize: 1.5, depthTest: false}));
    line.computeLineDistances();
    line.renderOrder = 3;
    routes.add(line);
  }

  function tube(points, color, r) {
    if (points.length < 2) return;
    const line = new T.CatmullRomCurve3(points);
    const mesh = new T.Mesh(new T.TubeGeometry(line, Math.min(280, points.length * 3), r, 8, false),
      new T.MeshBasicMaterial({color, depthTest: false}));
    mesh.renderOrder = 4;
    routes.add(mesh);
  }

  function colorAt(md, model, view) {
    if (view === 'plan') return CYAN;
    if (view === 'torque' || view === 'wob') {
      const value = model.heat.get(Math.floor(md));
      if (!Number.isFinite(value)) return 0x7294a8;
      return new T.Color().setHSL(0.59 * (1 - value), 0.93, 0.55);
    }
    const interval = model.intervals.find(i => md >= i.from && md <= i.to);
    return interval?.mode === 'slide' ? AMBER : interval?.mode === 'rotary' ? CYAN : 0x87adc2;
  }

  let tip = null, size = '', rockKey = '';
  function update(model, view) {
    clear(routes);
    tip = null;
    const extent = [...model.path, ...model.plan, ...model.estimate];
    const project = scale(model.plan.length > 1 ? [...model.plan, ...model.path] : extent);
    const actual = [];
    if (project) for (const [i, p] of model.path.entries()) {
      const a = model.path[i-1];
      if (a && p.md >= model.hd - 90 && view !== 'plan') {
        const from = project(a), to = project(p);
        for (let md = Math.ceil(a.md); md < p.md; md++) {
          if (md > a.md) actual.push({md,v:from.clone().lerp(to,(md-a.md)/(p.md-a.md))});
        }
      }
      actual.push({md:p.md,v:project(p)});
    }
    const first = actual[0]?.v;
    const key = first ? first.x.toFixed(0) + ':' + first.z.toFixed(0) : 'none';
    if (rockKey !== key) {
      buildRock(first?.x ?? -58, Math.min(5,first?.z ?? 5));
      rockKey = key;
    }
    if (!project) { draw(); return; }
    dashed(model.plan.map(project), 0xc6dae3);
    dashed(model.offset.map(project), 0xad82ef);
    dashed(model.estimate.map(project), AMBER);
    let points = [], lastColor;
    for (let i = 1; i < actual.length; i++) {
      const a = actual[i - 1], b = actual[i];
      const color = colorAt((a.md + b.md) / 2, model, view);
      const key = typeof color === 'number' ? color : color.getHex();
      if (lastColor !== key) {
        tube(points, lastColor, 0.52);
        points = [a.v];
        lastColor = key;
      }
      points.push(b.v);
    }
    tube(points, lastColor, 0.52);
    if (model.bit) {
      tip = project(model.bit);
      const bit = new T.Mesh(new T.SphereGeometry(0.95, 16, 12),
        new T.MeshBasicMaterial({color: AMBER, depthTest: false}));
      bit.position.copy(tip);
      bit.renderOrder = 5;
      routes.add(bit);
    }
    draw();
  }

  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (size !== w + ':' + h) {
      size = w + ':' + h;
      renderer.setSize(w, h, false);
      const v = Math.max(46, 82 * h / w);
      camera.left = -v * w / h; camera.right = v * w / h;
      camera.top = v; camera.bottom = -v;
      camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
    label.hidden = !tip;
    if (tip) {
      const p = tip.clone().project(camera);
      label.hidden = Math.abs(p.x) > 0.93 || Math.abs(p.y) > 0.9;
      label.style.left = ((p.x + 1) * 50) + '%';
      label.style.top = ((1 - p.y) * 50) + '%';
    }
  }
  orbit.addEventListener('change', draw);
  const observer = new ResizeObserver(draw);
  observer.observe(canvas);
  return {update, dispose() {
    observer.disconnect();
    orbit.dispose();
    clear(rock);
    clear(routes);
    grid.geometry.dispose();
    grid.material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }};
}
