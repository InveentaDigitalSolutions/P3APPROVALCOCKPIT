import { useCallback, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoadingScreen } from './components/LoadingScreen';
import { Sidebar } from './components/Sidebar';
import { FreigabeTimelinePage } from './pages/FreigabeTimelinePage';
import { CockpitPage } from './pages/CockpitPage';
import { DataverseAdminPage } from './pages/DataverseAdminPage';
import { VerschraenkungenPage } from './pages/VerschraenkungenPage';
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
                <Route path="/freigabe-timeline" element={<FreigabeTimelinePage />} />
                <Route path="/cockpit" element={<CockpitPage />} />
                <Route path="/verschraenkungen" element={<VerschraenkungenPage />} />
                <Route path="/dataverse" element={<DataverseAdminPage />} />
                <Route path="*" element={<Navigate to="/freigabe-timeline" replace />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      )}
    </>
  );
}

export default App;
