import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source=readFileSync('services/api/src/server.ts','utf8');
const out=ts.transpileModule(source,{fileName:'server.ts',reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
if(!out.outputText || (out.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error)){
  console.error((out.diagnostics||[]).map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
  process.exit(1);
}
console.log('Bun API TypeScript syntax check PASS (runtime test requires Bun)');
