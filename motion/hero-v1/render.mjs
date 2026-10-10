import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const root=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(path.resolve(root,'../../package.json'));
const {chromium}=require('playwright');
const vendor=path.resolve(root,'../../apps/web/node_modules/three');
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.hdr':'application/octet-stream'};
const server=http.createServer((req,res)=>{
  const url=decodeURIComponent(req.url.split('?')[0]);
  const base=url.startsWith('/vendor/three/')?vendor:root;
  const relative=url.startsWith('/vendor/three/')?url.slice('/vendor/three/'.length):url.slice(1)||'scene.html';
  const target=path.resolve(base,relative);
  if(target!==base&&!target.startsWith(base+path.sep)){res.writeHead(403).end();return;}
  try{const data=fs.readFileSync(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(4387,'127.0.0.1',r));
if(process.argv.includes('--serve')){
  console.log('Preview: http://127.0.0.1:4387/scene.html?width=1600&height=900');
}else{
  let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--enable-webgl','--ignore-gpu-blocklist','--disable-web-security','--allow-file-access-from-files']});
    const preview=process.argv.includes('--preview');
    const width=preview?1280:1920,height=preview?720:1080;
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
    page.on('console',m=>{if(m.type()==='error')console.error(m.text());});
    page.on('pageerror',e=>console.error(e));
    await page.goto(`http://127.0.0.1:4387/scene.html?render&width=${width}&height=${height}`);
    await page.waitForFunction(()=>window.__ready,{timeout:60000});
    console.log(await page.evaluate(()=>({vendor:document.querySelector('canvas').getContext('webgl2').getParameter(7937),...window.favplaceMotion.metadata.stats})));
    if(preview){
      for(const t of [0,2.6,4.25,5,6.3,8.5,9.3]){
        const data=await page.evaluate(t=>window.favplaceMotion.capture(t),t);
        const name=path.resolve(root,`preview-${t}.png`);fs.writeFileSync(name,Buffer.from(data.split(',')[1],'base64'));console.log(name);
      }
      for(const pass of ['beauty','depth','scan']){
        const data=await page.evaluate(pass=>window.favplaceMotion.capture(0,pass),pass);
        fs.writeFileSync(path.resolve(root,`debug-${pass}.png`),Buffer.from(data.split(',')[1],'base64'));
      }
    }else{
      const passes=process.argv.includes('--passes')?['beauty','depth','scan','warp']:['final'];
      for(const pass of passes){
        const out=path.resolve(root,'frames',pass);fs.mkdirSync(out,{recursive:true});
        for(let frame=0;frame<300;frame++){
          const file=path.resolve(out,`frame_${String(frame).padStart(5,'0')}.png`);
          if(fs.existsSync(file))continue;
          const data=await page.evaluate(({time,pass})=>window.favplaceMotion.capture(time,pass),{time:frame/30,pass});
          fs.writeFileSync(file,Buffer.from(data.split(',')[1],'base64'));
          if(frame%30===0)console.log(`${pass}: ${frame}/300`);
        }
      }
    }
  }finally{if(browser)await browser.close();server.close();}
}
