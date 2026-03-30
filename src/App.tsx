import { useCallback, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoadingScreen } from './components/LoadingScreen';
import { Sidebar } from './components/Sidebar';
import { OverviewPage } from './pages/OverviewPage';
import { StammdatenPage } from './pages/StammdatenPage';
import { IStufePage } from './pages/IStufePage';
import { BenachrichtigungenPage } from './pages/BenachrichtigungenPage';
import './App.css';

function App() {
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const handleLoaded = useCallback(() => setLoading(false), []);

  return (
    <>
      {loading && <LoadingScreen onFinished={handleLoaded} />}
      {!loading && (
        <BrowserRouter>
          <div className={`app-layout${sidebarCollapsed ? ' app-layout--collapsed' : ''}`}>
            <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
            <main className="app-content">
              <Routes>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/speichertyp" element={<StammdatenPage />} />
                <Route path="/istufe" element={<IStufePage />} />
                <Route path="/benachrichtigungen" element={<BenachrichtigungenPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      )}
    </>
  );
}

export default App;
