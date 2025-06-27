'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function WritingAnalysisInput() {
  const [content, setContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [samples, setSamples] = useState<Array<{
    id?: string;
    content?: string;
    content_type?: string;
    created_at?: string;
  }>>([]);
  const [loading, setLoading] = useState(false);

  const characterCount = content.length;
  const isValid = content.trim().length >= 50 && characterCount <= 5000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValid) {
      setError('Please enter at least 50 characters and no more than 5000 characters');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError('You must be logged in to analyze writing samples');
        return;
      }

      const response = await fetch('/api/analyze-writing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          content: content.trim(),
          content_type: 'sample'
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to analyze writing sample');
      }

      if (result.success) {
        setSuccess('Writing sample analyzed successfully! This will help improve AI tweet generation.');
        setContent('');
        loadSamples(); // Refresh the samples list
      } else {
        setError(result.message || 'Writing analysis is currently disabled');
      }

    } catch (err) {
      console.error('Error analyzing writing:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze writing sample');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadSamples = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;

      const response = await fetch('/api/analyze-writing/samples', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setSamples(result.samples || []);
      }
    } catch (err) {
      console.error('Error loading samples:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load samples on component mount
  useEffect(() => {
    loadSamples();
  }, []);

  return (
    <div className="space-y-6">
      {/* Main Writing Analysis Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          ✍️ Writing Style Analysis
        </h3>
        <p className="text-gray-600 mb-6">
          Add samples of your writing to train the AI to match your unique style and personality. 
          The more samples you provide, the better the AI becomes at generating tweets that sound like you.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="writing-content" className="block text-sm font-medium text-gray-700 mb-2">
              Writing Sample
            </label>
            <textarea
              id="writing-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste a sample of your writing here (emails, articles, previous tweets, etc.). The more natural and representative of your style, the better!"
              className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={6}
              disabled={isAnalyzing}
            />
            
            <div className="flex justify-between items-center mt-2">
              <div className={`text-sm ${
                characterCount < 50 ? 'text-red-500' : 
                characterCount > 5000 ? 'text-red-500' :
                characterCount > 4500 ? 'text-yellow-500' : 
                'text-gray-500'
              }`}>
                {characterCount}/5000 characters
                {characterCount < 50 && (
                  <span className="block text-xs">Minimum 50 characters needed</span>
                )}
              </div>
              
              <button
                type="submit"
                disabled={!isValid || isAnalyzing}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  isValid && !isAnalyzing
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze Writing'}
              </button>
            </div>
          </div>
        </form>

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
      </div>

      {/* Current Samples */}
      <div className="bg-white rounded-lg shadow p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">
          📚 Your Writing Samples ({samples.length})
        </h4>
        
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-500 text-sm mt-2">Loading samples...</p>
          </div>
        ) : samples.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No writing samples yet.</p>
            <p className="text-gray-400 text-sm mt-1">Add your first sample above to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {samples.map((sample, index) => (
              <div key={sample.id || index} className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700 line-clamp-3">
                  {sample.content ? sample.content.substring(0, 150) + '...' : 'Sample content'}
                </p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-500">
                    {sample.created_at ? new Date(sample.created_at).toLocaleDateString() : 'Recently added'}
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    {sample.content_type || 'sample'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* How It Works */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-3">
          🧠 How Personality AI Works
        </h4>
        <div className="space-y-2 text-sm text-gray-700">
          <div className="flex items-start space-x-2">
            <span className="text-purple-500 mt-0.5">•</span>
            <span>Add samples of your natural writing (emails, articles, social posts)</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-purple-500 mt-0.5">•</span>
            <span>AI analyzes your tone, style, vocabulary, and personality traits</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-purple-500 mt-0.5">•</span>
            <span>When generating tweets, AI matches your unique writing style</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-purple-500 mt-0.5">•</span>
            <span>More samples = better personality matching and more authentic tweets</span>
          </div>
        </div>
      </div>
    </div>
  );
} 