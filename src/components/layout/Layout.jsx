import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import './layout.css';

export const Layout = () => {
  return (
    <div className="layout-container animate-fade-in">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};
