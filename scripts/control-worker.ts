import "server-only";
import {runCatalogCycle} from "../src/lib/control/catalog-worker";
async function main(){
  if(!process.argv.includes('--execute')){console.log('Preview only. Use --execute for one bounded, permission-gated catalog/scheduler cycle. This does not enable providers or apply migrations.');return;}
  console.log(JSON.stringify(await runCatalogCycle(),null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.message:'The bounded worker failed.');process.exitCode=1;});
