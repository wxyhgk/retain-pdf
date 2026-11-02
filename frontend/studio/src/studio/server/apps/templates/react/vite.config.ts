import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Run by the Studio (app.json's dev): on a port and under a base it gives (/studio-apps/<名字>/).
export default defineConfig({ plugins: [react()] });
