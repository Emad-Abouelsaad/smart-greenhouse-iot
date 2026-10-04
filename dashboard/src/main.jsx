import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { backendPromise } from './services/backend.js';
import './styles/app.css';

const root = createRoot(document.getElementById('root'));

backendPromise
  .then((backend) => {
    root.render(
      <StrictMode>
        <App backend={backend} />
      </StrictMode>,
    );
  })
  .catch((err) => {
    console.error(err);
    root.render(<div className="loading">⚠️ Could not start the application. Check the Firebase configuration.</div>);
  });
