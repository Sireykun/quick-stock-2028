import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import { ThemeProvider } from './components/ThemeProvider';
import { Layout } from './components/Layout';
import { BrandLoader } from './components/BrandLoader';

const Home = React.lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const OnInventory = React.lazy(() => import('./pages/OnInventory').then(m => ({ default: m.OnInventory })));
const Settings = React.lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const ClassesList = React.lazy(() => import('./pages/ClassesList').then(m => ({ default: m.ClassesList })));
const StockRoomList = React.lazy(() => import('./pages/StockRoomList').then(m => ({ default: m.StockRoomList })));
const StockLocationDetail = React.lazy(() => import('./pages/StockLocationDetail').then(m => ({ default: m.StockLocationDetail })));
const ClassDetail = React.lazy(() => import('./pages/ClassDetail').then(m => ({ default: m.ClassDetail })));
const ModelsList = React.lazy(() => import('./pages/ModelsList').then(m => ({ default: m.ModelsList })));
const DefaultItems = React.lazy(() => import('./pages/DefaultItems').then(m => ({ default: m.DefaultItems })));
const LabDefaultItems = React.lazy(() => import('./pages/LabDefaultItems').then(m => ({ default: m.LabDefaultItems })));
const ItemsList = React.lazy(() => import('./pages/ItemsList').then(m => ({ default: m.ItemsList })));
const About = React.lazy(() => import('./pages/About').then(m => ({ default: m.About })));
const ActivityLogs = React.lazy(() => import('./pages/ActivityLogs').then(m => ({ default: m.ActivityLogs })));
const SecuritySettings = React.lazy(() => import('./pages/SecuritySettings').then(m => ({ default: m.SecuritySettings })));
const DataRestore = React.lazy(() => import('./pages/DataRestore').then(m => ({ default: m.DataRestore })));
const Investigate = React.lazy(() => import('./pages/Investigate').then(m => ({ default: m.Investigate })));

const LoadingScreen = () => (
  <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
    <BrandLoader compact label="Loading page" />
  </div>
);

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="on-inventory" element={<OnInventory />} />
                <Route path="settings" element={<Settings />} />
                <Route path="stock-room" element={<StockRoomList />} />
                <Route path="stock-room/:locationName" element={<StockLocationDetail />} />
                <Route path="classes" element={<ClassesList />} />
                <Route path="classes/:className" element={<ClassDetail />} />
                <Route path="types" element={<ModelsList />} />
                <Route path="items" element={<ItemsList />} />
                <Route path="defaults" element={<DefaultItems />} />
                <Route path="lab-defaults" element={<LabDefaultItems />} />
                <Route path="logs" element={<ActivityLogs />} />
                <Route path="security" element={<SecuritySettings />} />
                <Route path="restore" element={<DataRestore />} />
                <Route path="investigate" element={<Investigate />} />
                <Route path="about" element={<About />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
