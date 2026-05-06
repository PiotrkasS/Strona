import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import TestRunner from './pages/TestRunner.jsx';
import CreateTest from './pages/CreateTest.jsx';
import Results from './pages/Results.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="tests"     element={<TestRunner />} />
        <Route path="record"    element={<CreateTest />} />
        <Route path="results"   element={<Results />} />
        <Route path="*"         element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
