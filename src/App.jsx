import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import TestRunner from './pages/TestRunner.jsx';
import CreateTest from './pages/CreateTest.jsx';
import Results from './pages/Results.jsx';
import TestCases from './pages/TestCases.jsx';
import ImportTests from './pages/ImportTests.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="tests"     element={<TestRunner />} />
        <Route path="record"    element={<CreateTest />} />
        <Route path="results"    element={<Results />} />
        <Route path="testcases" element={<TestCases />} />
        <Route path="import"    element={<ImportTests />} />
        <Route path="settings"  element={<Settings />} />
        <Route path="*"         element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
