const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
process.chdir(path.resolve(__dirname,'..'));
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{
 let html=fs.readFileSync('index.html','utf8');
 const hook=`window.texturePreview=()=>{
   for(const child of document.body.children)child.style.display='none';
   const scene=new THREE.Scene();scene.background=new THREE.Color('#b8d8ee');
   scene.add(new THREE.HemisphereLight(0xffffff,0x586346,2));
   const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(8,14,6);scene.add(light);
   const camera=new THREE.OrthographicCamera(-10,10,7,-7,.1,100);camera.position.set(16,19,25);camera.lookAt(0,0,0);
   const preview=new THREE.WebGLRenderer({antialias:false});preview.setSize(1400,980);preview.setPixelRatio(1);document.body.appendChild(preview.domElement);
   const names=['grass','dirt','stone','cobble','mossy','sand','wood','planks','crafting','furnace','leaves','snow','ore_coal','ore_iron','ore_gold','ore_diamond','deepslate','ds_diamond','obsidian','netherrack','glowstone','lava','wool','clay'];
   const pixels={};
   names.forEach((kind,i)=>{
     const mesh=new THREE.Mesh(boxGeo, i%2 ? shadedMaterial(BLOCK_TEX[kind],0):blockMaterial(kind,0));
     if(i%2){const geo=boxGeo.clone();geo.setAttribute('color',new THREE.Float32BufferAttribute(new Array(geo.attributes.position.count*3).fill(1),3));mesh.geometry=geo;}
     mesh.position.set((i%6-2.5)*2.45,.65,(Math.floor(i/6)-1.5)*2.65);scene.add(mesh);
     const tex=BLOCK_TEX[kind],ctx=tex.image.getContext('2d'),data=ctx.getImageData(0,0,16,16).data;
     const colors=new Set();for(let p=0;p<data.length;p+=4)colors.add(data[p]+','+data[p+1]+','+data[p+2]);pixels[kind]={width:tex.image.width,height:tex.image.height,colors:colors.size};
     const point=mesh.position.clone().add(new THREE.Vector3(0,-.9,0)).project(camera);
     const label=document.createElement('div');label.textContent=kind;label.style.cssText='position:fixed;font:14px monospace;color:#172332;background:#ffffffc9;padding:3px 6px;border-radius:4px;transform:translate(-50%,0);left:'+((point.x+1)*700)+'px;top:'+((1-point.y)*490)+'px';document.body.appendChild(label);
   });
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshLambertMaterial({color:0x94b578}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;scene.add(floor);
   preview.render(scene,camera);
   const heading=document.createElement('div');heading.textContent='BASEPLATE · TEXTURES 16 × 16';heading.style.cssText='position:fixed;left:35px;top:25px;color:#203429;font:bold 24px monospace';document.body.appendChild(heading);
   return {pixels,calls:preview.info.render.calls,atlas:Object.keys(BLOCK_ATLAS),programs:preview.info.programs.map(p=>p.diagnostics?.runnable!==false)};
 };`;
 html=html.replace(/<\/script>\s*<\/body>/,hook+'</script></body>');
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.TEST_CHROME?{executablePath:process.env.TEST_CHROME}:{}),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1400,height:980}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|VALIDATE_STATUS/i.test(m.text()))errors.push(m.text())});
 await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle'});await page.waitForFunction(()=>typeof window.texturePreview==='function');
 const result=await page.evaluate(()=>window.texturePreview());
 for(const [kind,p] of Object.entries(result.pixels)){assert.equal(p.width,16,kind);assert.equal(p.height,16,kind);assert(p.colors>3,kind+' lacks detail')}
 assert.deepEqual(result.atlas.sort(),['crafting','furnace','grass','wood']);assert(result.programs.every(Boolean),'shader compile');assert.deepEqual(errors,[]);
 fs.mkdirSync('.test-results',{recursive:true});await page.screenshot({path:'.test-results/textures-preview.png'});console.log(JSON.stringify(result,null,2));
 await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1)});
