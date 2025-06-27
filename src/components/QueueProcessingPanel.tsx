'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface ProcessingStatus {
  queued: number;
  scheduled: number;
  posted: number;
  nextProcessingRecommended: boolean;
}

interface QueueProcessingPanelProps {
  onProcessingComplete?: () => void;
}

export default function QueueProcessingPanel({ onProcessingComplete }: QueueProcessingPanelProps) {
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProcessingStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadProcessingStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadProcessingStatus = async () => {
    try {
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError('You must be logged in to view processing status');
        return;
      }

      const response = await fetch('/api/process-queue', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load processing status');
      }

      const data = await response.json();
      setStatus(data.statusCounts);
    } catch (error) {
      console.error('Error loading processing status:', error);
      setError('Failed to load processing status');
    } finally {
      setLoading(false);
    }
  };

  const processQueue = async () => {
    if (!status || status.queued === 0) {
      setError('No queued tweets to process');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError('You must be logged in to process the queue');
        return;
      }

      const response = await fetch('/api/process-queue', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to process queue');
      }

      if (result.errors && result.errors.length > 0) {
        setError(`Processed ${result.processed}/${result.total} tweets. Errors: ${result.errors.join(', ')}`);
      } else {
        setSuccess(`Successfully processed ${result.processed} tweets! They are now scheduled with QStash.`);
      }

      // Refresh status and notify parent
      await loadProcessingStatus();
      onProcessingComplete?.();

    } catch (error) {
      console.error('Error processing queue:', error);
      setError(error instanceof Error ? error.message : 'Failed to process queue');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Queue Processing</h3>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Queue Processing</h3>
        <button
          onClick={loadProcessingStatus}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Status Display */}
      {status && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{status.queued}</div>
            <div className="text-sm text-yellow-800">Queued</div>
            <div className="text-xs text-yellow-600">Ready to schedule</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{status.scheduled}</div>
            <div className="text-sm text-blue-800">Scheduled</div>
            <div className="text-xs text-blue-600">Waiting to post</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{status.posted}</div>
            <div className="text-sm text-green-800">Posted</div>
            <div className="text-xs text-green-600">Live on Twitter</div>
          </div>
        </div>
      )}

      {/* Processing Controls */}
      <div className="space-y-3">
        {status && status.queued > 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  {status.queued} tweets ready to schedule
                </p>
                <p className="text-xs text-yellow-600">
                  Click "Process Queue" to schedule them with QStash
                </p>
              </div>
              <button
                onClick={processQueue}
                disabled={isProcessing}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isProcessing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                }`}
              >
                {isProcessing ? 'Processing...' : 'Process Queue'}
              </button>
            </div>
          </div>
        )}

        {status && status.queued === 0 && status.scheduled === 0 && status.posted === 0 && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
            <p className="text-sm text-gray-600">No tweets in queue</p>
            <p className="text-xs text-gray-500">Add some tweets to get started!</p>
          </div>
        )}

        {status && status.scheduled > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-800">
              {status.scheduled} tweets scheduled and ready to post
            </p>
            <p className="text-xs text-blue-600">
              QStash will automatically post them at the scheduled times
            </p>
          </div>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 text-sm">{success}</p>
        </div>
      )}

      {/* Process Flow Explanation */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-2">How It Works:</h4>
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
            <span>1. Add tweets to queue (they get scheduled times)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            <span>2. Process queue (schedules with QStash)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span>3. QStash automatically posts to Twitter at scheduled times</span>
          </div>
        </div>
      </div>
    </div>
  );
} 