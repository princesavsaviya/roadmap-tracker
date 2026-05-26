import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// If you rename the repo, change this to `/your-new-name/`
export default defineConfig({
  plugins: [react()],
  base: '/roadmap-tracker/',
});
