import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// Las pantallas completas resuelven datos y rutas asíncronas. Un margen estable
// evita falsos negativos en CI lento sin ampliar el timeout de cada prueba.
configure({ asyncUtilTimeout: 5_000 });
