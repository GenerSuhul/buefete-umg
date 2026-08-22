import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/manrope';
import '@daypicker/react/style.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './styles/global.css';
import './styles/dashboard.css';
import './styles/directory.css';
import './styles/profile.css';
import './styles/case-detail.css';
import './styles/operations.css';
import './styles/admin.css';
import './styles/login.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
