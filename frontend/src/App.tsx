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
          <Route path="chat" element={<EvidenceChat />} />
          <Route path="contradictions" element={<ContradictionCentre />} />
          <Route path="amendments" element={<AmendmentExplorer />} />
          <Route path="viewer" element={<PdfViewerPage />} />
          <Route path="eval" element={<EvaluationPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
