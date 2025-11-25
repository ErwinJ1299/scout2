'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ModernTimePickerProps {
  value: string; // Format: "HH:MM" (24-hour)
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function ModernTimePicker({ value, onChange, className, disabled = false }: ModernTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const [hour24, setHour24] = useState(0);
  const [minute, setMinute] = useState(0);
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');
  const clockRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Parse initial value
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':').map(Number);
      setHour24(h);
      setMinute(m);
      setPeriod(h >= 12 ? 'PM' : 'AM');
    }
  }, [value]);

  const hour12 = hour24 % 12 || 12;

  const formatTime = (h24: number, m: number): string => {
    const h = h24 % 12 || 12;
    const period = h24 >= 12 ? 'PM' : 'AM';
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${period}`;
  };

  const handleTimeChange = (newHour24: number, newMinute: number) => {
    setHour24(newHour24);
    setMinute(newMinute);
    onChange(`${newHour24.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')}`);
  };

  const handleClockClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!clockRef.current) return;

    const rect = clockRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const x = e.clientX - rect.left - centerX;
    const y = e.clientY - rect.top - centerY;

    let angle = Math.atan2(y, x) * (180 / Math.PI);
    angle = (angle + 90 + 360) % 360;

    if (mode === 'hour') {
      const hour12Value = Math.round(angle / 30) % 12 || 12;
      const newHour24 = period === 'PM' 
        ? (hour12Value === 12 ? 12 : hour12Value + 12)
        : (hour12Value === 12 ? 0 : hour12Value);
      handleTimeChange(newHour24, minute);
      setTimeout(() => setMode('minute'), 300);
    } else {
      const newMinute = Math.round(angle / 6) % 60;
      handleTimeChange(hour24, newMinute);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      handleClockClick(e);
    }
  };

  const handlePeriodToggle = () => {
    const newPeriod = period === 'AM' ? 'PM' : 'AM';
    setPeriod(newPeriod);
    const newHour24 = newPeriod === 'PM'
      ? (hour12 === 12 ? 12 : hour12 + 12)
      : (hour12 === 12 ? 0 : hour12);
    handleTimeChange(newHour24, minute);
  };

  const incrementHour = () => {
    const newHour24 = (hour24 + 1) % 24;
    handleTimeChange(newHour24, minute);
    setPeriod(newHour24 >= 12 ? 'PM' : 'AM');
  };

  const decrementHour = () => {
    const newHour24 = (hour24 - 1 + 24) % 24;
    handleTimeChange(newHour24, minute);
    setPeriod(newHour24 >= 12 ? 'PM' : 'AM');
  };

  const incrementMinute = () => {
    const newMinute = (minute + 1) % 60;
    handleTimeChange(hour24, newMinute);
  };

  const decrementMinute = () => {
    const newMinute = (minute - 1 + 60) % 60;
    handleTimeChange(hour24, newMinute);
  };

  const renderClockNumbers = () => {
    const numbers = mode === 'hour' ? 12 : 60;
    const step = mode === 'hour' ? 1 : 5;
    const items = [];

    for (let i = 0; i < numbers; i += step) {
      let value;
      let displayValue;
      
      if (mode === 'hour') {
        value = i === 0 ? 12 : i;
        displayValue = value;
      } else {
        value = i;
        displayValue = i;
      }
      
      // Calculate angle starting from 12 o'clock (top)
      const angle = (i * (360 / numbers) - 90) * (Math.PI / 180);
      const radius = 70;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      const isSelected = mode === 'hour' 
        ? value === hour12
        : value === minute;

      items.push(
        <div
          key={`${mode}-${i}`}
          className={cn(
            'absolute flex items-center justify-center text-xs font-semibold transition-all duration-200',
            isSelected
              ? 'bg-teal-600 text-white w-8 h-8 rounded-full shadow-lg z-10'
              : 'text-gray-700 hover:bg-gray-100 w-7 h-7 rounded-full cursor-pointer'
          )}
          style={{
            left: `calc(50% + ${x}px)`,
            top: `calc(50% + ${y}px)`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {displayValue}
        </div>
      );
    }

    return items;
  };

  const renderClockHand = () => {
    const value = mode === 'hour' ? hour12 : minute;
    
    // Calculate angle: 12 o'clock is at top (0 degrees)
    // Each hour is 30 degrees, each minute is 6 degrees
    let angleInDegrees;
    if (mode === 'hour') {
      // For hours: 12 is at 0°, 1 is at 30°, 2 is at 60°, etc.
      angleInDegrees = (hour12 % 12) * 30 + 180;
    } else {
      // For minutes: 0 is at 0°, 5 is at 30°, 10 is at 60°, etc.
      angleInDegrees = (minute % 60) * 6 + 180;
    }
    
    const angleInRadians = ((angleInDegrees - 180) * Math.PI) / 180;
    const length = 55;
    const x = Math.cos(angleInRadians - Math.PI / 2) * length;
    const y = Math.sin(angleInRadians - Math.PI / 2) * length;

    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="absolute left-1/2 top-1/2"
        style={{ transformOrigin: '0 0' }}
      >
        <motion.div
          animate={{
            rotate: angleInDegrees,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-0.5 h-[55px] bg-teal-600 origin-top"
          style={{ transformOrigin: 'center top' }}
        />
        <div className="absolute left-0 top-0 w-3 h-3 bg-white border-2 border-teal-600 rounded-full transform -translate-x-1/2 -translate-y-1/2" />
      </motion.div>
    );
  };

  return (
    <div className={cn('relative w-full', className)}>
      {/* Input Display */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full h-12 px-4 flex items-center justify-between',
          'border border-gray-200 rounded-lg bg-white',
          'hover:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent',
          'transition-all duration-200',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        aria-label="Select time"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-teal-600" />
          <span className="text-lg font-semibold text-gray-900">
            {value ? formatTime(hour24, minute) : 'Select time'}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-5 w-5 text-gray-400" />
        </motion.div>
      </button>

      {/* Time Picker Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center"
            />

            {/* Picker Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-sm"
            >
              <Card className="p-4 shadow-2xl border-2 border-teal-100 bg-gradient-to-br from-white via-teal-50/30 to-cyan-50/30">
                {/* Digital Display */}
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="flex items-center gap-1 bg-white rounded-lg p-2 shadow-inner border border-gray-200">
                    <div className="flex flex-col items-center">
                      <button
                        type="button"
                        onClick={incrementHour}
                        className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                        aria-label="Increment hour"
                      >
                        <ChevronUp className="h-3 w-3 text-gray-600" />
                      </button>
                      <motion.button
                        type="button"
                        onClick={() => setMode('hour')}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          'text-2xl font-bold px-2 py-0.5 rounded-lg transition-all',
                          mode === 'hour'
                            ? 'text-teal-600 bg-teal-50'
                            : 'text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        {hour12.toString().padStart(2, '0')}
                      </motion.button>
                      <button
                        type="button"
                        onClick={decrementHour}
                        className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                        aria-label="Decrement hour"
                      >
                        <ChevronDown className="h-3 w-3 text-gray-600" />
                      </button>
                    </div>

                    <span className="text-2xl font-bold text-gray-400 px-1">:</span>

                    <div className="flex flex-col items-center">
                      <button
                        type="button"
                        onClick={incrementMinute}
                        className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                        aria-label="Increment minute"
                      >
                        <ChevronUp className="h-3 w-3 text-gray-600" />
                      </button>
                      <motion.button
                        type="button"
                        onClick={() => setMode('minute')}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          'text-2xl font-bold px-2 py-0.5 rounded-lg transition-all',
                          mode === 'minute'
                            ? 'text-teal-600 bg-teal-50'
                            : 'text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        {minute.toString().padStart(2, '0')}
                      </motion.button>
                      <button
                        type="button"
                        onClick={decrementMinute}
                        className="p-0.5 hover:bg-gray-100 rounded transition-colors"
                        aria-label="Decrement minute"
                      >
                        <ChevronDown className="h-3 w-3 text-gray-600" />
                      </button>
                    </div>

                    <div className="flex flex-col gap-0.5 ml-1">
                      <motion.button
                        type="button"
                        onClick={handlePeriodToggle}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          'px-1.5 py-0.5 rounded-md text-xs font-semibold transition-all',
                          period === 'AM'
                            ? 'bg-teal-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                      >
                        AM
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={handlePeriodToggle}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          'px-1.5 py-0.5 rounded-md text-xs font-semibold transition-all',
                          period === 'PM'
                            ? 'bg-teal-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                      >
                        PM
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* Mode Toggle */}
                <div className="flex gap-2 mb-3">
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === 'hour' ? 'default' : 'outline'}
                    onClick={() => setMode('hour')}
                    className={cn(
                      'flex-1',
                      mode === 'hour' && 'bg-teal-600 hover:bg-teal-700'
                    )}
                  >
                    Hour
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === 'minute' ? 'default' : 'outline'}
                    onClick={() => setMode('minute')}
                    className={cn(
                      'flex-1',
                      mode === 'minute' && 'bg-teal-600 hover:bg-teal-700'
                    )}
                  >
                    Minute
                  </Button>
                </div>

                {/* Circular Clock */}
                <motion.div
                  ref={clockRef}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="relative w-full aspect-square max-w-[220px] mx-auto cursor-pointer select-none"
                  onClick={handleClockClick}
                  onMouseDown={() => setIsDragging(true)}
                  onMouseUp={() => setIsDragging(false)}
                  onMouseLeave={() => setIsDragging(false)}
                  onMouseMove={handleMouseMove}
                  role="slider"
                  aria-label={`Select ${mode}`}
                  aria-valuemin={0}
                  aria-valuemax={mode === 'hour' ? 12 : 60}
                  aria-valuenow={mode === 'hour' ? hour12 : minute}
                >
                  {/* Clock Face */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white to-gray-50 rounded-full shadow-inner border-4 border-teal-100" />

                  {/* Center Dot */}
                  <div className="absolute left-1/2 top-1/2 w-2 h-2 bg-teal-600 rounded-full transform -translate-x-1/2 -translate-y-1/2 z-10" />

                  {/* Clock Hand */}
                  {renderClockHand()}

                  {/* Clock Numbers */}
                  <div className="absolute inset-0">
                    {renderClockNumbers()}
                  </div>
                </motion.div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="flex-1 bg-teal-600 hover:bg-teal-700"
                  >
                    Done
                  </Button>
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
