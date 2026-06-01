function el(){const e={style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains:()=>false},appendChild:c=>c,querySelector:()=>el(),querySelectorAll:()=>[],addEventListener(){},getContext:()=>new Proxy({},{get:()=>()=>{}}),setAttribute(){},remove(){},width:64,height:64,value:'100',set innerHTML(_){}, get innerHTML(){return''}};return e;}
globalThis.document={getElementById:()=>el(),createElement:()=>el(),querySelector:()=>el(),querySelectorAll:()=>[],addEventListener(){},body:el()};
globalThis.window={innerWidth:1200,innerHeight:800,devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),requestAnimationFrame:()=>0};
globalThis.requestAnimationFrame=()=>0; globalThis.performance={now:()=>0};
globalThis.localStorage=(()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};})();
globalThis.Image=class{set src(_){setTimeout(()=>this.onerror&&this.onerror(),0);}}; globalThis.fetch=async()=>({ok:false,status:404,json:async()=>[]});
globalThis.AudioContext=class{createGain(){return{connect(){},gain:{}};}createBufferSource(){return{connect(){},start(){}};}get destination(){return{};}decodeAudioData(){return Promise.resolve({});}};
globalThis.Blob=class{};globalThis.URL={createObjectURL:()=>'',revokeObjectURL(){}};globalThis.FileReader=class{readAsText(){}};
try{
 for(const m of ['./src/assets/assetLoader.js','./src/assets/styleRegistry.js','./src/core/Game.js','./src/ui/DreamPanel.js','./src/ui/UIManager.js','./src/main.js']) await import(m);
 console.log('ALL MODULES IMPORT CLEANLY');
}catch(e){console.error('BOOT ERR:',e.message);process.exit(2);}
