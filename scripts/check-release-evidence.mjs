import {readFileSync} from 'node:fs';
const filename=process.env.RELEASE_EVIDENCE||'docs/release-evidence.example.json';
const data=JSON.parse(readFileSync(filename,'utf8'));
const names=Object.keys(data.gates||{});
if(!names.length)throw Error('Release gates absent');
const failing=names.filter(k=>data.gates[k]?.status!=='verified'||typeof data.gates[k]?.evidence!=='string'||data.gates[k].evidence.trim().length<20);
const ready=failing.length===0&&data.ownerApproval===true&&data.environment==='production';
if(process.argv.includes('--expect-blocked')){
  if(ready)throw Error('Sample release evidence must not claim certified production');
  console.log('Production release correctly BLOCKED: '+failing.join(', '));process.exit(0);
}
if(!ready){
  console.error('PUBLIC RELEASE BLOCKED. Missing independently verified evidence for: '+failing.join(', '));
  console.error('Evidence file: '+filename);
  process.exit(1);
}
console.log('Evidence manifest meets the structural gate; independently validate all references before approval.');
