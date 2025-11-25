# Modern Time Picker Component

## Overview
A beautiful, interactive circular clock time picker built with React, Shadcn UI, and Framer Motion for the Health Monitoring Platform.

## Location
`components/time-picker/ModernTimePicker.tsx`

## Features

### ✨ Interactive Clock Face
- **Circular dial design** with hour and minute modes
- **Clickable numbers** arranged in a circle
- **Draggable clock hand** for intuitive time selection
- **Smooth animations** for mode switching and hand rotation

### 🎨 Visual Design
- **Medical theme** with teal, cyan, and soft purple accents
- **Glassmorphism effect** with gradient backgrounds
- **Animated elements** using Framer Motion
- **Responsive design** that works on desktop and mobile

### 🕐 Functionality
- **12-hour format display** with AM/PM toggle
- **24-hour format output** (HH:MM)
- **Increment/decrement buttons** for precise control
- **Digital display** with large, readable numbers
- **Mode switching** between hour and minute selection

### ♿ Accessibility
- **ARIA labels** for screen readers
- **Keyboard support** for increment/decrement buttons
- **Focus indicators** on interactive elements
- **Role attributes** for proper semantic structure

### 📱 User Experience
- **Smooth entry/exit animations** (scale + fade)
- **Click or drag** to set time
- **Auto-advance** from hour to minute mode
- **Backdrop click** to close
- **Cancel/Done buttons** for explicit control

## Usage

```tsx
import { ModernTimePicker } from '@/components/time-picker/ModernTimePicker';

function MyComponent() {
  const [time, setTime] = useState('');

  return (
    <ModernTimePicker
      value={time}
      onChange={setTime}
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | - | Current time in "HH:MM" format (24-hour) |
| `onChange` | `(value: string) => void` | - | Callback when time changes |
| `className` | `string` | `undefined` | Additional CSS classes |
| `disabled` | `boolean` | `false` | Disable the picker |

## Integration

### In Add Reminder Page
The component replaces the default HTML time input in the patient reminder creation page:

**Location:** `app/(dashboard)/patient/add-reminder/page.tsx`

```tsx
<ModernTimePicker
  value={formData.time}
  onChange={(newTime) => setFormData((prev) => ({ ...prev, time: newTime }))}
/>
```

### Output Format
The component outputs time in 24-hour format (`"HH:MM"`), which is stored directly in the database:
- `"09:30"` for 9:30 AM
- `"14:45"` for 2:45 PM
- `"00:00"` for midnight
- `"23:59"` for 11:59 PM

### Display Format
The picker shows time in 12-hour format with AM/PM for user-friendliness:
- `09:30 AM`
- `02:45 PM`
- `12:00 AM` (midnight)
- `11:59 PM`

## Design Details

### Color Scheme
- **Primary:** Teal (`#0d9488` - teal-600)
- **Secondary:** Cyan (`#06b6d4` - cyan-500)
- **Accent:** Purple (`#9333ea` - purple-600)
- **Background:** White with soft gradients
- **Selected:** Teal with shadow and scale effect

### Animations
- **Entry/Exit:** Scale + fade (spring animation)
- **Clock hand:** Smooth rotation with spring physics
- **Number highlights:** Scale up when selected
- **Pulse effect:** On clock hand endpoint
- **Backdrop:** Fade in/out

### Components Used
- **Framer Motion:** All animations and transitions
- **Shadcn UI:** Button, Card components
- **Lucide React:** Clock, ChevronUp, ChevronDown icons
- **Tailwind CSS:** Styling and responsive design

## Technical Implementation

### State Management
- `isOpen`: Controls picker visibility
- `mode`: Switches between 'hour' and 'minute'
- `hour24`: Internal 24-hour format
- `minute`: Minute value (0-59)
- `period`: AM/PM indicator
- `isDragging`: Enables drag-to-select

### Clock Mathematics
```typescript
// Convert click position to time value
const angle = Math.atan2(y, x) * (180 / Math.PI);
const normalizedAngle = (angle + 90 + 360) % 360;
const value = Math.round(normalizedAngle / (360 / totalValues)) % totalValues;
```

### Position Calculation
```typescript
// Position numbers in a circle
const angle = (i * (360 / numbers) - 90) * (Math.PI / 180);
const radius = 85;
const x = Math.cos(angle) * radius;
const y = Math.sin(angle) * radius;
```

## Browser Compatibility
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Performance
- **Optimized renders** with React.memo potential
- **Smooth 60fps animations** via Framer Motion
- **Efficient event handlers** with proper cleanup
- **No layout thrashing** from animation calculations

## Future Enhancements
- [ ] 24-hour display option (no AM/PM)
- [ ] Custom color themes
- [ ] Step intervals (e.g., 15-minute increments)
- [ ] Time range restrictions (min/max time)
- [ ] Multiple time selection
- [ ] Time duration picker mode

## Dependencies
```json
{
  "framer-motion": "^12.23.24",
  "lucide-react": "^0.553.0",
  "@radix-ui/react-slot": "^1.2.4"
}
```

## Notes
- The component is fully controlled (requires `value` and `onChange` props)
- Validation logic remains in the parent form component
- Works seamlessly with existing reminder system
- No breaking changes to database schema
- Maintains backward compatibility with stored time formats
