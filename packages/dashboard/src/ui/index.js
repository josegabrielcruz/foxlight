import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.js';
import './index.css';
const root = createRoot(document.getElementById('root'));
root.render(_jsx(StrictMode, { children: _jsx(App, {}) }));
//# sourceMappingURL=index.js.map