const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),http=require('node:http');
process.chdir(path.resolve(__dirname,'..'));
const source=fs.readFileSync('index.html','utf8');
const control=source.slice(source.indexOf('const perfState='),source.indexOf('const frame = now =>'));
const state={settings:{quiet:true,fpsLimit:60},document:{hidden:false},quality:0,worstQuality:()=>4,bestQuality:()=>0,setQuality(){state.resizes++},resizes:0};
vm.createContext(state);vm.runInContext(control+';globalThis.ps=perfState;',state);
for(const hz of [60,90,120,144])for(const cap of [30,45,60]){
 state.settings.fpsLimit=cap;state.ps.nextFrame=0;let count=0;
 for(let i=0;i<hz*10;i++)if(state.admitFrame(i*1000/hz))count++;
 assert(Math.abs(count-cap*10)<=1,`${hz}Hz / ${cap}FPS: ${count}`);
}
state.document.hidden=true;assert.equal(state.admitFrame(20000),false);state.document.hidden=false;
state.ps.nextFrame=0;assert.equal(state.admitFrame(20000),true);assert.equal(state.admitFrame(20001),false,'no catch-up burst');
state.settings.fpsLimit=30;Object.assign(state.ps,{cost:6,cadence:1000/30,changedAt:0,badSince:0,goodSince:0,pressure:0});
for(let n=1;n<1200;n++)state.adaptPerformance(n*1000/30,5,1000/30);
assert.equal(state.ps.pressure,0,'30FPS cap is not overload');assert.equal(state.quality,0);
state.adaptPerformance(41000,150,150);assert.equal(state.quality,0,'one stall does not blur image');
for(let n=1;n<600;n++)state.adaptPerformance(41000+n*33.34,36,40);
assert(state.ps.pressure===2&&state.quality>0,'sustained load reduces range before resolution');
const peak=state.quality;
for(let n=1;n<400;n++)state.adaptPerformance(62000+n*33.34,4,33.34);
assert.equal(state.quality,peak,'quality recovery has hysteresis');
console.log('Performance controller: frame caps, no catch-up, hidden tab, overload and recovery passed.');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{
 const hook=`window.performanceCheck=()=>{
  renderer.setAnimationLoop(null);uncapOn=false;localStorage.setItem('seenHelp','1');startGame();
  const check=(v,n)=>{if(!v)throw Error(n)},out={};
  check(sanitizeSettings({fpsLimit:NaN}).fpsLimit===SETTINGS_DEF.fpsLimit,'invalid cap');
  check(!sanitizeSettings({uncap:true,quiet:true}).quiet,'old unlimited preference preserved');
  const savedQuality=quality;quality=0;perfState.pressure=0;
  setInfinite(true,null,12345,true);px=pz=320;feet=0;
  updateGen(.016,-Infinity);check(!gen.job&&!gen.loaded.size,'expired budget starts no work');
  updateGen(.016,performance.now()+100);check(gen.job?.key==='20,20','nearest chunk first');
  check(gen.job&&gen.loaded.has('20,20'),'partial chunk tracked before completion');
  let iterations=0,maxSlice=0;const allStart=performance.now();
  while(gen.job&&iterations++<5000){const t=performance.now();updateGen(.016,t+.5);maxSlice=Math.max(maxSlice,performance.now()-t);}
  check(!gen.job,'chunk completes incrementally');out.chunkSlices=iterations;out.maxSliceMs=+maxSlice.toFixed(2);out.totalMs=+(performance.now()-allStart).toFixed(2);
  const before=gen.loaded.size;gen.cq.push([320,-4,320]);const qi=gen.cqi;stepCaves(100,-Infinity);check(gen.cqi===qi,'caves obey expired deadline');
  updateGen(.016,performance.now()+.2);const partial=gen.job;check(!!partial,'partial generation started');genTimer=0;px=pz=800;updateGen(.016,-Infinity);check(!gen.job&&gen.pending.get(partial.key)===partial.steps,'teleport preserves partial generator');px=pz=320;updateGen(.016,performance.now()+100);check(gen.job?.steps===partial.steps,'returning resumes same generator');
  check(gen.loaded.size>=before,'partial chunk remains tracked for cleanup');
  setInfinite(false);quality=savedQuality;perfState.pressure=0;
  settings.quiet=false;settings.uncap=false;applySetting('setquiet');check(settings.quiet&&!uncapOn,'quiet mode disables busy loop');
  applySetting('setuncap');check(!settings.quiet&&uncapOn,'explicit unlimited still works');
  applySetting('setquiet');renderer.setAnimationLoop(null);uncapOn=false;
  return out;
 };`;
 let html=source.replace(/<\/script>\s*<\/body>/,hook+'</script></body>');
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.TEST_CHROME?{executablePath:process.env.TEST_CHROME}:{}),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const mobile=process.env.AUDIT_MOBILE==='1';const page=await browser.newPage(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1000,height:700}}),errors=[];if(mobile)await page.addInitScript(()=>{Object.defineProperty(navigator,'hardwareConcurrency',{value:2});Object.defineProperty(navigator,'deviceMemory',{value:2});});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.performanceCheck==='function');
  const result=await page.evaluate(()=>window.performanceCheck());assert.deepEqual(errors,[]);console.log('Budgeted generation and settings:',JSON.stringify(result));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
