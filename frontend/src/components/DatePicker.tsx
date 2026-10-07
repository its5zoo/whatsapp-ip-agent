'use client';

import React, { useState, useEffect, useRef } from 'react';

interface DatePickerProps {
  value: string; // e.g. "2026-10-07"
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  align?: 'left' | 'right' | 'auto';
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  className = '',
  align = 'auto'
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverAlign, setPopoverAlign] = useState<'left' | 'right'>(align === 'right' ? 'right' : 'left');
  const containerRef = useRef<HTMLDivElement>(null);

  const initialDate = value ? new Date(value) : new Date();
  const validInitial = !isNaN(initialDate.getTime()) ? initialDate : new Date();

  const [currentYear, setCurrentYear] = useState(validInitial.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(validInitial.getMonth());

  // Sync state if external value changes
  useEffect(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        setCurrentYear(parsed.getFullYear());
        setCurrentMonth(parsed.getMonth());
      }
    }
  }, [value]);

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

      // Auto-detect if popover will overflow right side of window
      if (align === 'right') {
        setPopoverAlign('right');
      } else if (align === 'left') {
        setPopoverAlign('left');
      } else if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.left + 285 > window.innerWidth || rect.right > window.innerWidth - 40) {
          setPopoverAlign('right');
        } else {
          setPopoverAlign('left');
        }
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, align]);

  const emitDate = (year: number, month: number, day: number) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatted = `${year}-${pad(month + 1)}-${pad(day)}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const setToday = () => {
    const today = new Date();
    emitDate(today.getFullYear(), today.getMonth(), today.getDate());
  };

  const clearDate = () => {
    onChange('');
    setIsOpen(false);
  };

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

  // Format display text (e.g. "07 Oct 2026")
  const formatDisplay = () => {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;

    const day = date.getDate().toString().padStart(2, '0');
    const month = MONTH_NAMES[date.getMonth()].slice(0, 3);
    const year = date.getFullYear();

    return `${day} ${month} ${year}`;
  };

  const displayText = formatDisplay();

  // Check if a cell is selected
  const isSelectedDate = (day: number) => {
    if (!value) return false;
    const date = new Date(value);
    return (
      date.getDate() === day &&
      date.getMonth() === currentMonth &&
      date.getFullYear() === currentYear
    );
  };

  const isTodayDate = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === currentMonth &&
      today.getFullYear() === currentYear
    );
  };

  return (
    <div className={`custom-datepicker-container ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        className={`custom-datepicker-trigger ${isOpen ? 'open' : ''} ${!value ? 'is-empty' : ''}`}
        onClick={() => setIsOpen(open => !open)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <div className="datepicker-trigger-left">
          <svg
            className="datepicker-cal-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="datepicker-value-text">{displayText || placeholder}</span>
        </div>
        {value ? (
          <span
            role="button"
            className="datepicker-clear-btn"
            onClick={e => {
              e.stopPropagation();
              onChange('');
            }}
            title="Clear date"
            aria-label="Clear date"
          >
            ✕
          </span>
        ) : (
          <svg className="datepicker-chevron" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {/* Modern Popover */}
      {isOpen && (
        <div className={`custom-datepicker-popover align-${popoverAlign}`} role="dialog" aria-label="Choose date">
          {/* Header with Navigation */}
          <div className="datepicker-header">
            <button
              type="button"
              className="datepicker-nav-btn"
              onClick={prevMonth}
              aria-label="Previous month"
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <span className="datepicker-month-title">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
            <button
              type="button"
              className="datepicker-nav-btn"
              onClick={nextMonth}
              aria-label="Next month"
            >
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {/* Weekdays */}
          <div className="datepicker-weekdays">
            {DAYS_SHORT.map(d => (
              <span key={d} className="datepicker-weekday">
                {d}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="datepicker-grid">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="datepicker-day-cell empty" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = isSelectedDate(day);
              const isToday = isTodayDate(day);

              return (
                <button
                  key={day}
                  type="button"
                  className={`datepicker-day-btn ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => emitDate(currentYear, currentMonth, day)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Bottom Actions */}
          <div className="datepicker-footer">
            <button type="button" className="datepicker-action-link" onClick={setToday}>
              Today
            </button>
            {value && (
              <button type="button" className="datepicker-action-link danger" onClick={clearDate}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
