import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { defineConfig } from 'vitest/config';

// Сборка в один HTML-файл: приложение открывается двойным щелчком и работает без интернета.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
