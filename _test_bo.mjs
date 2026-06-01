import { computeBuildOrder, stepsVisibleAt, STAGES } from './src/timeline/BuildOrder.js';

// Mock asset index
const idx = {
  grass:{id:'grass',kind:'terrain',category:'terrain'},
  water:{id:'water',kind:'terrain',category:'terrain'},
  path:{id:'path',kind:'terrain',category:'terrain'},
  low_wall:{id:'low_wall',kind:'object',category:'props'},
  olive:{id:'olive',kind:'object',category:'nature'},
  house:{id:'house',kind:'object',category:'buildings'},
  main_chapel:{id:'main_chapel',kind:'object',category:'buildings'},
  windmill:{id:'windmill',kind:'object',category:'buildings'},
};

// Mock tilemap: 4x4 grass + a water row + path + objects
const W=4,H=4;
const terrain = new Array(W*H).fill('grass');
terrain[12]='water'; terrain[13]='water';
terrain[5]='path';
const objects = [
  {id:1,assetId:'low_wall',gx:0,gy:0},
  {id:2,assetId:'olive',gx:1,gy:1},
  {id:3,assetId:'house',gx:2,gy:0},
  {id:4,assetId:'main_chapel',gx:0,gy:2},
  {id:5,assetId:'windmill',gx:3,gy:3},
];
const tm = {
  width:W,height:H,
  getTerrain:(gx,gy)=>terrain[gy*W+gx],
  objects,
};

const order = computeBuildOrder(tm, idx);
console.log('STAGES summary:');
for (const s of order.stages) console.log(`  ${s.id.padEnd(10)} ${s.start}-${s.end}%  (${s.count})`);
console.log('\nfirst step progress:', order.steps[0].progress, order.steps[0].stage);
console.log('last step progress: ', order.steps.at(-1).progress, order.steps.at(-1).stage);
console.log('\nvisible at 0%:  ', stepsVisibleAt(order,0).length, '/', order.steps.length);
console.log('visible at 50%: ', stepsVisibleAt(order,50).length, '/', order.steps.length);
console.log('visible at 100%:', stepsVisibleAt(order,100).length, '/', order.steps.length);

// landmarks should be last
const landmarkSteps = order.steps.filter(s=>s.stage==='landmarks');
console.log('\nlandmark steps:', landmarkSteps.map(s=>`${s.assetId}@${s.progress}`));
console.log('all landmark progress >= 80?', landmarkSteps.every(s=>s.progress>=80));
