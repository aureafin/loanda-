import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// base relativo + HashRouter: funciona no GitHub Pages em qualquer subpasta e ao actualizar páginas
export default defineConfig({ base: './', plugins: [react()] });
