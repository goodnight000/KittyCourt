import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import CourtroomPage from './pages/CourtroomPage';
import HistoryPage from './pages/HistoryPage';

// Placeholders for other pages
import DashboardPage from './pages/DashboardPage';
import DailyMeowPage from './pages/DailyMeowPage';
import EconomyPage from './pages/EconomyPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="courtroom" element={<CourtroomPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="daily-meow" element={<DailyMeowPage />} />
          <Route path="economy" element={<EconomyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
