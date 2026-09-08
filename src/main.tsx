import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {PaperTradingPanel} from './components/PaperTradingPanel.tsx';
import {QuantitativeLabPanel} from './components/QuantitativeLabPanel.tsx';
import './index.css';

const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
if (apiBase) {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      return nativeFetch(`${apiBase}${input}`, init);
    }
    if (input instanceof URL && input.pathname.startsWith('/api/')) {
      return nativeFetch(`${apiBase}${input.pathname}${input.search}`, init);
    }
    if (input instanceof Request && new URL(input.url).pathname.startsWith('/api/')) {
      const url = new URL(input.url);
      url.protocol = new URL(apiBase).protocol;
      url.host = new URL(apiBase).host;
      return nativeFetch(new Request(url.toString(), input), init);
    }
    return nativeFetch(input, init);
  };
}

function RootApp() {
  return (
    <>
      <App />
      <PaperTradingPanel />
      <QuantitativeLabPanel />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
);
