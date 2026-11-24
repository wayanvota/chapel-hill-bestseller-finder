import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import {api} from './server/api.ts';
export default defineConfig(({mode})=>{Object.assign(process.env,loadEnv(mode,process.cwd(),''));return {base:process.env.APP_BASE_PATH||'/',build:{outDir:'dist/client'},server:{host:'127.0.0.1',port:4173,strictPort:true},plugins:[react(),{name:'local-catalog-api',configureServer(server){server.middlewares.use(api);},configurePreviewServer(server){server.middlewares.use(api);}}]};});
