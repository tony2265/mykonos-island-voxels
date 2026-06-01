import { readFileSync } from 'fs';
globalThis.localStorage=(()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};})();
globalThis.fetch=async(u)=>{ const path=u.replace(/^.*?\/?assets\//,'assets/');
  try{const t=readFileSync(path,'utf8');return{ok:true,status:200,json:async()=>JSON.parse(t)};}catch{return{ok:false,status:404,json:async()=>({})};}};
const reg=await import('./src/assets/styleRegistry.js');
await reg.loadStyleList();
const flower=await reg.loadStyleManifest('flower');
const dflt=await reg.loadStyleManifest('default');
console.log('flower baseDir:', flower.assetBaseDir, '| sample file path:', flower.assetBaseDir+flower.assets.find(a=>a.id==='grass').filename);
console.log('flower garden_bed path:', flower.assetBaseDir+flower.assets.find(a=>a.id==='garden_bed').filename);
console.log('default baseDir:', dflt.assetBaseDir, '| sample:', dflt.assetBaseDir+dflt.assets.find(a=>a.id==='grass').filename);
console.log('default wood_pile path:', dflt.assetBaseDir+dflt.assets.find(a=>a.id==='wood_pile').filename);
// confirm those files actually exist on disk now
import { existsSync } from 'fs';
const checks = [
  flower.assetBaseDir+'grass.png',
  flower.assetBaseDir+'newAsset/Garden Bed.png',
  dflt.assetBaseDir+'grass.png',
  dflt.assetBaseDir+'raw/wood_pile.png',
];
for (const c of checks) console.log((existsSync(c)?'EXISTS ':'MISSING'), c);
