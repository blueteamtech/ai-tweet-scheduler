'use client'

import { useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

interface TweetSchedulerProps {
  onSchedule: (scheduledDate: Date) => void
  onCancel: () => void
  isScheduling: boolean
}

export default function TweetScheduler({ onSchedule, onCancel, isScheduling }: TweetSchedulerProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  
  // Set minimum date to current time + 1 minute
  const minDate = new Date()
  minDate.setMinutes(minDate.getMinutes() + 1)

  const handleSchedule = () => {
    if (selectedDate && selectedDate > new Date()) {
      onSchedule(selectedDate)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Schedule Tweet
        </h3>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Date and Time
          </label>
          <DatePicker
            selected={selectedDate}
            onChange={(date: Date | null) => date && setSelectedDate(date)}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={15}
            dateFormat="MMMM d, yyyy h:mm aa"
            minDate={minDate}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholderText="Select date and time"
          />
          <p className="text-xs text-gray-500 mt-1">
            Tweet will be scheduled for your local timezone
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSchedule}
            disabled={isScheduling || selectedDate <= new Date()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-md font-medium"
          >
            {isScheduling ? 'Scheduling...' : 'Schedule Tweet'}
          </button>
          <button
            onClick={onCancel}
            disabled={isScheduling}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
} 