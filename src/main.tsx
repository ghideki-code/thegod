import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {PaperTradingPanel} from './components/PaperTradingPanel.tsx';
import {QuantitativeLabPanel} from './components/QuantitativeLabPanel.tsx';
import './index.css';

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
