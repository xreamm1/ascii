const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const handlers={},deleted=[],hit=new Response('cached game'),cache={match:async()=>hit,put:async()=>{},add:async()=>{}};
 const scope={self:{addEventListener:(n,f)=>handlers[n]=f,clients:{claim:async()=>{}},skipWaiting:async()=>{}},location:{origin:'https://example.test'},caches:{keys:async()=>['baseplate-v6','ascii-v5','baseplate-v3','unrelated-app'],delete:async k=>deleted.push(k),open:async()=>cache},URL,Response,setTimeout,clearTimeout,fetch:async()=>new Response('temporary error',{status:500})};
 vm.createContext(scope);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8'),scope);
 let pending;handlers.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(deleted.sort(),['ascii-v5','baseplate-v3']);
 let response;handlers.fetch({request:{url:'https://example.test/index.html',method:'GET',mode:'navigate'},respondWith:p=>response=p,waitUntil:()=>{}});assert.equal(await (await response).text(),'cached game');
 let intercepted=false;handlers.fetch({request:{url:'https://private.firebaseio.com/world.json',method:'GET'},respondWith:()=>intercepted=true,waitUntil:()=>{}});assert.equal(intercepted,false);
 console.log('Service worker: preserves other apps, serves cache on HTTP 500, bypasses game database.');
})().catch(e=>{console.error(e);process.exitCode=1});
