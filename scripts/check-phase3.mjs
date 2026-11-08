import fs from 'node:fs';
const check = (path, markers) => {
  if (!fs.existsSync(path)) throw new Error(`Missing Phase 3 file: ${path}`);
  const s = fs.readFileSync(path,'utf8');
  for (const text of markers) if(!s.includes(text)) throw new Error(`${path} must contain ${text}`);
};
check('apps/web/src/phase3/MediaStudio.tsx',['Learning media studio','YouTube learning video','Choose PDF file','Audio lesson player','Start narration','Bookmark title','storage','localStorage']);
check('apps/web/src/phase3/media-core.ts',['parseYouTubeEmbed','normalizedProgress','addBookmark','MEDIA_STORAGE_KEY']);
check('apps/web/src/App.tsx',["case 'studio'","id:'studio'","studio:'Media Studio'"]);
check('tests/e2e/multimedia.spec.ts',['#studio','YouTube video or playlist URL','Bookmark title','Choose PDF file']);
console.log('Phase 3 source/route integration checks PASS');
