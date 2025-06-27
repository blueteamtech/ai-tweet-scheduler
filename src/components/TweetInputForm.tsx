'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface TweetInputFormProps {
  onTweetAdded?: (tweet: { 
    id: string; 
    content: string; 
    queueSlot: { date: string; slot: number } 
  }) => void;
}

export default function TweetInputForm({ onTweetAdded }: TweetInputFormProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const characterCount = content.length;
  const isValid = content.trim().length > 0 && characterCount <= 280;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValid) {
      setError('Please enter valid tweet content (1-280 characters)');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError('You must be logged in to add tweets to the queue');
        return;
      }

      // Call the queue-tweet API
      const response = await fetch('/api/queue-tweet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ content: content.trim() })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add tweet to queue');
      }

      // Clear form
      setContent('');
      
      // Show success message
      const queueDate = new Date(result.queueSlot.date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      
      setSuccess(`Tweet queued for ${queueDate} (slot ${result.queueSlot.slot})`);

      // Call callback if provided
      if (onTweetAdded) {
        onTweetAdded({
          id: result.tweet.id,
          content: result.tweet.tweet_content,
          queueSlot: result.queueSlot
        });
      }

    } catch (err) {
      console.error('Error adding tweet to queue:', err);
      setError(err instanceof Error ? err.message : 'Failed to add tweet to queue');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="tweet-content" className="block text-sm font-medium text-gray-700 mb-2">
            Add Tweet to Queue
          </label>
          <textarea
            id="tweet-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={4}
            disabled={isSubmitting}
          />
          
          <div className="flex justify-between items-center mt-2">
            <div className={`text-sm ${
              characterCount > 280 ? 'text-red-500' : 
              characterCount > 260 ? 'text-yellow-500' : 
              'text-gray-500'
            }`}>
              {characterCount}/280 characters
            </div>
            
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                isValid && !isSubmitting
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? 'Adding to Queue...' : 'Add to Queue'}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        )}
      </form>
    </div>
  );
} 