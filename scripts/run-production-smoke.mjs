import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
const port='3210';
const log=createWriteStream('.release/control-production-server.log');
const server=spawn(process.execPath,['--max-old-space-size=256','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',port],{env:{...process.env,NODE_ENV:'production',SCENESTACK_BUILD_QA:'true'},stdio:['ignore','pipe','pipe']});
server.stdout.pipe(log,{end:false});server.stderr.pipe(log,{end:false});
let child;
try{
  let ready=false;
  for(let attempt=0;attempt<40;attempt++){
    if(server.exitCode!==null)throw new Error('Isolated production server exited; see .release/control-production-server.log');
    try{if((await fetch(`http://127.0.0.1:${port}/icon.svg`,{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!ready)throw new Error('Isolated production server did not become ready.');
  child=spawn(process.execPath,['--max-old-space-size=128','tests/routes.smoke.mjs',`http://127.0.0.1:${port}`,'--auto'],{stdio:'inherit'});
  process.exitCode=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code??1));});
}finally{child?.kill('SIGTERM');server.kill('SIGTERM');log.end();}
