import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/app/',
  plugins: [
    react(),
    {
      name: 'furilog-web-privacy-policy',
      transformIndexHtml(html) {
        return html.replace(
          '<meta name="viewport"',
          '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\'; img-src \'self\' blob: data:; media-src \'self\' blob:; connect-src \'none\'; worker-src \'self\'; manifest-src \'self\'; object-src \'none\'; base-uri \'self\'; form-action \'none\'" />\n    <meta name="viewport"'
        );
      },
    },
  ],
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
  },
});
