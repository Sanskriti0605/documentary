import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { DocumentLibrary } from './pages/DocumentLibrary';
import { EvidenceChat } from './pages/EvidenceChat';
import { ContradictionCentre } from './pages/ContradictionCentre';
import { AmendmentExplorer } from './pages/AmendmentExplorer';
import { PdfViewerPage } from './pages/PdfViewerPage';
import { EvaluationPage } from './pages/EvaluationPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="documents" element={<DocumentLibrary />} />
          {/* Main required routes */}
          <Route path="ask" element={<EvidenceChat />} />
          <Route path="contradictions" element={<ContradictionCentre />} />
          <Route path="amendments" element={<AmendmentExplorer />} />
          <Route path="viewer" element={<PdfViewerPage />} />
          <Route path="eval" element={<EvaluationPage />} />
          {/* Aliases for backwards compatibility */}
          <Route path="chat" element={<Navigate to="/ask" replace />} />
          <Route path="conflicts" element={<Navigate to="/contradictions" replace />} />
          <Route path="evaluation" element={<Navigate to="/eval" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
