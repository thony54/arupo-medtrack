import React from 'react';
import './ui.css';

export const Badge = ({ children, variant = 'success', className = '' }) => {
  return (
    <span className={`badge badge-${variant} ${className}`}>
      {children}
    </span>
  );
};
