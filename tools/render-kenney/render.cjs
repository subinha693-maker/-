// Offline tool: renders Kenney GLB models to isometric transparent PNG sprites.
// Usage: node render.cjs <models-list.json> <outDir>
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const KENNEY = '/home/user/assets/_extracted/kenney';
const [listFile, outDir] = process.argv.slice(2);
const list = JSON.parse(fs.readFileSync(listFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
const html = `<!doctype html><html><body style="margin:0;background:transparent">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const S=512;
const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
r.setSize(S,S); r.setClearColor(0x000000,0); r.outputColorSpace=THREE.SRGBColorSpace;
document.body.appendChild(r.domElement);
window.renderModel=async(url)=>{
  const g=await new GLTFLoader().loadAsync(url);
  const scene=new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdde6f0,0x303840,1.6));
  const d=new THREE.DirectionalLight(0xffffff,2.2); d.position.set(-3,6,4); scene.add(d);
  scene.add(g.scene);
  const box=new THREE.Box3().setFromObject(g.scene); const c=box.getCenter(new THREE.Vector3()); const sz=box.getSize(new THREE.Vector3());
  const rad=sz.length()/2;
  const cam=new THREE.OrthographicCamera(-rad,rad,rad,-rad,0.01,rad*10);
  const dir=new THREE.Vector3(1,0.82,1).normalize();
  cam.position.copy(c).addScaledVector(dir,rad*4); cam.lookAt(c);
  r.render(scene,cam);
  return r.domElement.toDataURL('image/png');
};
window.ready=true;
</script></body></html>`;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  await p.route('http://render.local/**', (route) => {
    const u = new URL(route.request().url()).pathname;
    let f;
    if (u === '/') return route.fulfill({ body: html, contentType: 'text/html' });
    if (u.startsWith('/three/')) f = path.join(ROOT, 'node_modules', u);
    else if (u.startsWith('/kenney/')) f = path.join(KENNEY, decodeURIComponent(u.slice(8)));
    if (!f || !fs.existsSync(f)) return route.fulfill({ status: 404 });
    const ct = f.endsWith('.js') ? 'text/javascript' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream';
    route.fulfill({ body: fs.readFileSync(f), contentType: ct });
  });
  p.on('pageerror', (e) => console.error('pageerror', e.message));
  await p.goto('http://render.local/');
  await p.waitForFunction('window.ready');
  for (const m of list) {
    const url = `/kenney/${m.kit}/Models/GLB format/${m.model}.glb`;
    const data = await p.evaluate((u) => window.renderModel(u), url);
    fs.writeFileSync(path.join(outDir, `${m.id}.png`), Buffer.from(data.split(',')[1], 'base64'));
    console.log('rendered', m.id);
  }
  await b.close();
})();
