import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const out=[]; const log=(...a)=>out.push(a.join(' '));
const srv = spawn('npx', ['vite','preview','--port','4210','--strictPort'], { cwd: process.cwd(), shell:true });
await new Promise(r=>setTimeout(r,5000));
try{
  const b=await chromium.launch();
  const p=await (await b.newContext()).newPage();
  p.on('console', m=>{ if(m.type()==='error') log('CONSOLE.ERR:', m.text()); });
  p.on('pageerror', e=>log('PAGEERROR:', e.message));
  p.on('requestfailed', r=>log('REQFAIL:', r.url(), r.failure()?.errorText));
  p.on('response', r=>{ if(r.status()>=400) log('HTTP'+r.status()+':', r.url()); });
  await p.goto('http://localhost:4210/crypto-lab-zk-arena/', { waitUntil:'networkidle' });
  await new Promise(r=>setTimeout(r,3000));
  log('DONE load');
  await b.close();
}catch(e){ log('FATAL:', e.message); }
srv.kill();
writeFileSync('_probe.out', out.join('\n')||'(no events)');
