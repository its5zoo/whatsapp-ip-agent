'use client';

import React, { useState, useEffect, useRef } from 'react';

interface DateTimePickerProps {
  value: string; // e.g. "2026-10-07T18:10" or "2026-10-07T18:10:00"
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DateTimePicker({
  value,
  onChange,
  placeholder = 'Select date & time',
  className = '',
  required = false
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial value or default to now
  const initialDate = value ? new Date(value) : new Date();
  const validInitial = !isNaN(initialDate.getTime()) ? initialDate : new Date();

  const [currentYear, setCurrentYear] = useState(validInitial.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(validInitial.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(value ? validInitial.getDate() : null);

  // Time state (12-hour format for intuitive UX)
  const initHours24 = validInitial.getHours();
  const initAmPm = initHours24 >= 12 ? 'PM' : 'AM';
  const initHours12 = initHours24 % 12 === 0 ? 12 : initHours24 % 12;
  const initMinutes = validInitial.getMinutes();

  const [hour12, setHour12] = useState(initHours12);
  const [minute, setMinute] = useState(Math.round(initMinutes / 5) * 5 % 60);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(initAmPm);

  // Sync state if external value changes
  useEffect(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        setCurrentYear(parsed.getFullYear());
        setCurrentMonth(parsed.getMonth());
        setSelectedDay(parsed.getDate());
        const h24 = parsed.getHours();
        setAmpm(h24 >= 12 ? 'PM' : 'AM');
        setHour12(h24 % 12 === 0 ? 12 : h24 % 12);
        setMinute(parsed.getMinutes());
      }
    }
  }, [value]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const emitDate = (year: number, month: number, day: number, h12: number, min: number, period: 'AM' | 'PM') => {
    let h24 = h12 % 12;
    if (period === 'PM') h24 += 12;

    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatted = `${year}-${pad(month + 1)}-${pad(day)}T${pad(h24)}:${pad(min)}`;
    onChange(formatted);
  };

  const handleSelectDay = (day: number) => {
    setSelectedDay(day);
    emitDate(currentYear, currentMonth, day, hour12, minute, ampm);
  };

  const handleHourChange = (newHour: number) => {
    setHour12(newHour);
    if (selectedDay) {
      emitDate(currentYear, currentMonth, selectedDay, newHour, minute, ampm);
    }
  };

  const handleMinuteChange = (newMin: number) => {
    setMinute(newMin);
    if (selectedDay) {
      emitDate(currentYear, currentMonth, selectedDay, hour12, newMin, ampm);
    }
  };

  const handleAmpmChange = (newAmpm: 'AM' | 'PM') => {
    setAmpm(newAmpm);
    if (selectedDay) {
      emitDate(currentYear, currentMonth, selectedDay, hour12, minute, newAmpm);
    }
  };

  // Quick Presets
  const applyPreset = (daysToAdd: number, defaultHour = 18, defaultMin = 0) => {
    const target = new Date();
    target.setDate(target.getDate() + daysToAdd);
    setCurrentYear(target.getFullYear());
    setCurrentMonth(target.getMonth());
    setSelectedDay(target.getDate());

    const period: 'AM' | 'PM' = defaultHour >= 12 ? 'PM' : 'AM';
    const h12 = defaultHour % 12 === 0 ? 12 : defaultHour % 12;
    setHour12(h12);
    setMinute(defaultMin);
    setAmpm(period);

    emitDate(target.getFullYear(), target.getMonth(), target.getDate(), h12, defaultMin, period);
  };

  // Month navigation
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

  // Calendar math
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

  // Formatting display text
  const formatDisplay = () => {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;

    const day = date.getDate().toString().padStart(2, '0');
    const month = MONTH_NAMES[date.getMonth()].slice(0, 3);
    const year = date.getFullYear();

    const hours = date.getHours();
    const mins = date.getMinutes().toString().padStart(2, '0');
    const ampmStr = hours >= 12 ? 'PM' : 'AM';
    const h12Str = (hours % 12 === 0 ? 12 : hours % 12).toString().padStart(2, '0');

    return `${day} ${month} ${year}, ${h12Str}:${mins} ${ampmStr}`;
  };

  const displayText = formatDisplay();

  return (
    <div className={`dt-picker-container ${className}`} ref={containerRef}>
      {/* Hidden input for form validation if required */}
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
        className={`dt-trigger-box ${isOpen ? 'active' : ''} ${!value ? 'is-empty' : ''}`}
        onClick={() => setIsOpen(open => !open)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <div className="dt-trigger-content">
          <svg className="dt-trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="dt-trigger-text">{displayText || placeholder}</span>
        </div>
        <div className="dt-trigger-btn-badge">
          <svg className={`dt-chevron ${isOpen ? 'open' : ''}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {/* Floating Modern Popover */}
      {isOpen && (
        <div className="dt-popover" role="dialog" aria-label="Date and time picker">
          {/* Quick Presets */}
          <div className="dt-presets-row">
            <button type="button" className="dt-preset-btn" onClick={() => applyPreset(0, 18, 0)}>
              Today 6 PM
            </button>
            <button type="button" className="dt-preset-btn" onClick={() => applyPreset(1, 11, 0)}>
              Tomorrow 11 AM
            </button>
            <button type="button" className="dt-preset-btn" onClick={() => applyPreset(3, 15, 0)}>
              In 3 Days
            </button>
            <button type="button" className="dt-preset-btn" onClick={() => applyPreset(7, 12, 0)}>
              Next Week
            </button>
          </div>

          {/* Month Header */}
          <div className="dt-month-header">
            <button type="button" className="dt-nav-btn" onClick={prevMonth} aria-label="Previous month">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <span className="dt-month-title">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
            <button type="button" className="dt-nav-btn" onClick={nextMonth} aria-label="Next month">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Days of week */}
          <div className="dt-weekdays-row">
            {DAYS_SHORT.map(d => (
              <span key={d} className="dt-weekday">{d}</span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="dt-days-grid">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="dt-day-cell empty" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = selectedDay === day &&
                (value ? new Date(value).getMonth() === currentMonth && new Date(value).getFullYear() === currentYear : false);
              const now = new Date();
              const isToday = now.getDate() === day && now.getMonth() === currentMonth && now.getFullYear() === currentYear;

              return (
                <button
                  key={day}
                  type="button"
                  className={`dt-day-btn ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => handleSelectDay(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Time Picker Section */}
          <div className="dt-time-section">
            <span className="dt-time-label">Time</span>
            <div className="dt-time-controls">
              {/* Hour Select */}
              <select
                className="dt-time-select"
                value={hour12}
                onChange={e => handleHourChange(Number(e.target.value))}
                aria-label="Hour"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                  <option key={h} value={h}>
                    {h.toString().padStart(2, '0')}
                  </option>
                ))}
              </select>

              <span className="dt-time-sep">:</span>

              {/* Minute Select */}
              <select
                className="dt-time-select"
                value={minute}
                onChange={e => handleMinuteChange(Number(e.target.value))}
                aria-label="Minute"
              >
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                  <option key={m} value={m}>
                    {m.toString().padStart(2, '0')}
                  </option>
                ))}
              </select>

              {/* AM / PM Toggle */}
              <div className="dt-ampm-switch">
                <button
                  type="button"
                  className={`dt-ampm-btn ${ampm === 'AM' ? 'active' : ''}`}
                  onClick={() => handleAmpmChange('AM')}
                >
                  AM
                </button>
                <button
                  type="button"
                  className={`dt-ampm-btn ${ampm === 'PM' ? 'active' : ''}`}
                  onClick={() => handleAmpmChange('PM')}
                >
                  PM
                </button>
              </div>
            </div>
          </div>

          {/* Quick Common Times */}
          <div className="dt-quick-times">
            <button
              type="button"
              className="dt-quick-time-chip"
              onClick={() => {
                setHour12(10);
                setMinute(0);
                setAmpm('AM');
                if (selectedDay) emitDate(currentYear, currentMonth, selectedDay, 10, 0, 'AM');
              }}
            >
              10:00 AM
            </button>
            <button
              type="button"
              className="dt-quick-time-chip"
              onClick={() => {
                setHour12(2);
                setMinute(30);
                setAmpm('PM');
                if (selectedDay) emitDate(currentYear, currentMonth, selectedDay, 2, 30, 'PM');
              }}
            >
              02:30 PM
            </button>
            <button
              type="button"
              className="dt-quick-time-chip"
              onClick={() => {
                setHour12(6);
                setMinute(0);
                setAmpm('PM');
                if (selectedDay) emitDate(currentYear, currentMonth, selectedDay, 6, 0, 'PM');
              }}
            >
              06:00 PM
            </button>
          </div>

          {/* Footer */}
          <div className="dt-footer">
            <button
              type="button"
              className="dt-btn-apply"
              onClick={() => {
                if (!selectedDay) {
                  handleSelectDay(new Date().getDate());
                }
                setIsOpen(false);
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
