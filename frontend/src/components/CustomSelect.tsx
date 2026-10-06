'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  required = false,
  className = ''
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find(opt => opt.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      opt =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q))
    );
  }, [options, search]);

  // Click outside and escape key listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      // Auto focus search input when opened
      if (options.length > 5) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      setSearch('');
    }
  }, [isOpen, options.length]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`custom-select-container ${className}`} ref={containerRef}>
      {/* Hidden input for form validation */}
      {required && (
        <input
          tabIndex={-1}
          required={required}
          value={value}
          onChange={() => {}}
          style={{ opacity: 0, position: 'absolute', pointerEvents: 'none', width: 0, height: 0 }}
        />
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        className={`custom-select-trigger ${isOpen ? 'open' : ''} ${!value ? 'is-empty' : ''}`}
        onClick={() => !disabled && setIsOpen(open => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="custom-select-value-text">
          {selectedOption ? (
            <span className="selected-lead-item">
              <strong className="lead-name-text">{selectedOption.label}</strong>
              {selectedOption.sublabel && (
                <span className="lead-org-badge">{selectedOption.sublabel}</span>
              )}
            </span>
          ) : (
            <span className="select-placeholder-text">{placeholder}</span>
          )}
        </span>
        <svg
          className={`select-chevron ${isOpen ? 'rotated' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Floating Smooth Dropdown Menu */}
      {isOpen && (
        <div className="custom-select-dropdown" role="listbox">
          {options.length > 5 && (
            <div className="select-search-wrap">
              <svg className="search-icon" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search leads..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="select-search-input"
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}

          <div className="select-options-list">
            {filteredOptions.length === 0 ? (
              <div className="select-no-results">No leads found</div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(opt.value)}
                  >
                    <div className="option-info">
                      <span className="option-title">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="option-subtitle">{opt.sublabel}</span>
                      )}
                    </div>
                    {isSelected && (
                      <svg className="option-check-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
