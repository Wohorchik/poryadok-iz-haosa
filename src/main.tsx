import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadSprites } from './course/sprites';
import './styles.css';
import './atlas.css';
import './school.css';
import './course/course.css';
import './course/lesson.css';

// Детали из Blender нужны и урокам, и экспериментам — грузим сразу (в собранном файле они встроены).
loadSprites().catch(() => undefined);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
