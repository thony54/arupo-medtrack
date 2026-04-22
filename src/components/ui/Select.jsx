import React from 'react';
import './ui.css';

export const Select = React.forwardRef(({
  label,
  error,
  id,
  options = [],
  className = '',
  placeholder,
  ...props
}, ref) => {
  return (
    <div className={`input-group ${className}`}>
      {label && (
        <label htmlFor={id} className="input-label">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        className="input-field"
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span id={`${id}-error`} className="input-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
});

Select.displayName = 'Select';
