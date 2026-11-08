import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins:[react()],
  // GitHub Pages hosts project sites under /Learning-Os/; local dev remains rooted at /.
  base:process.env.GITHUB_PAGES==='true'?'/Learning-Os/':'/',
  server:{port:5173,strictPort:true}
});
