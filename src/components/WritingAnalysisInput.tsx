'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface WritingSample {
  id: string;
  content: string;
  content_type: string;
  created_at: string;
}

export default function WritingAnalysisInput() {
  const [content, setContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [samples, setSamples] = useState<WritingSample[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Edit/Delete states
  const [editingSample, setEditingSample] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editContentType, setEditContentType] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const trimmedContent = content.trim();
  const characterCount = content.length;
  const trimmedCharacterCount = trimmedContent.length;
  const isValid = trimmedCharacterCount >= 50;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValid) {
      setError(`Please enter at least 50 characters (currently ${trimmedCharacterCount} after removing extra whitespace)`);
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

  const startEditing = (sample: WritingSample) => {
    setEditingSample(sample.id);
    setEditContent(sample.content);
    setEditContentType(sample.content_type);
    setError(null);
    setSuccess(null);
  };

  const cancelEditing = () => {
    setEditingSample(null);
    setEditContent('');
    setEditContentType('');
    setError(null);
    setSuccess(null);
  };

  const saveEdit = async (sampleId: string) => {
    const trimmedEditContent = editContent.trim();
    if (!editContent || trimmedEditContent.length < 50) {
      setError(`Content must be at least 50 characters (currently ${trimmedEditContent.length} after removing extra whitespace)`);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError('You must be logged in to edit writing samples');
        return;
      }

      const response = await fetch('/api/analyze-writing/samples', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          id: sampleId,
          content: trimmedEditContent,
          content_type: editContentType
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update writing sample');
      }

      if (result.success) {
        setSuccess('Writing sample updated successfully!');
        setEditingSample(null);
        setEditContent('');
        setEditContentType('');
        loadSamples(); // Refresh the samples list
      } else {
        setError(result.error || 'Failed to update writing sample');
      }

    } catch (err) {
      console.error('Error updating writing sample:', err);
      setError(err instanceof Error ? err.message : 'Failed to update writing sample');
    } finally {
      setSaving(false);
    }
  };

  const deleteSample = async (sampleId: string) => {
    if (!confirm('Are you sure you want to delete this writing sample? This action cannot be undone.')) {
      return;
    }

    setDeleting(sampleId);
    setError(null);
    setSuccess(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError('You must be logged in to delete writing samples');
        return;
      }

      const response = await fetch('/api/analyze-writing/samples', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id: sampleId })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete writing sample');
      }

      if (result.success) {
        setSuccess('Writing sample deleted successfully!');
        loadSamples(); // Refresh the samples list
      } else {
        setError(result.error || 'Failed to delete writing sample');
      }

    } catch (err) {
      console.error('Error deleting writing sample:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete writing sample');
    } finally {
      setDeleting(null);
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
          Longer, more substantial samples (articles, blog posts, emails) provide better personality analysis. 
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
              placeholder="Paste a sample of your writing here (emails, articles, blog posts, previous tweets, etc.). Longer samples (up to 50k characters) provide better personality analysis - don't hesitate to paste full articles or substantial content!"
              className="w-full p-4 border-2 border-gray-400 rounded-lg focus:ring-3 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white text-gray-900 text-base font-medium leading-relaxed shadow-sm hover:border-gray-500 transition-colors"
              rows={8}
              disabled={isAnalyzing}
            />
            
            <div className="flex justify-between items-center mt-2">
              <div className={`text-sm ${
                trimmedCharacterCount < 50 ? 'text-red-500' : 'text-gray-500'
              }`}>
                {characterCount} characters
                {characterCount !== trimmedCharacterCount && (
                  <span className="block text-xs text-gray-400">
                    ({trimmedCharacterCount} after removing extra whitespace)
                  </span>
                )}
                {trimmedCharacterCount < 50 && (
                  <span className="block text-xs">Minimum 50 characters needed (after trimming)</span>
                )}
                {trimmedCharacterCount > 45000 && (
                  <span className="block text-xs text-orange-600">
                    Approaching 50k character limit ({(50000 - trimmedCharacterCount).toLocaleString()} remaining)
                  </span>
                )}
                {trimmedCharacterCount >= 1000 && trimmedCharacterCount <= 45000 && (
                  <span className="block text-xs text-green-600">
                    Great sample size for personality analysis!
                  </span>
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
          <div className="space-y-4">
            {samples.map((sample) => (
              <div key={sample.id} className="p-4 bg-gray-50 rounded-lg border">
                {editingSample === sample.id ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Content Type
                      </label>
                      <select
                        value={editContentType}
                        onChange={(e) => setEditContentType(e.target.value)}
                        className="w-full p-3 border-2 border-gray-400 rounded-lg focus:ring-3 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-base font-medium shadow-sm hover:border-gray-500 transition-colors"
                        disabled={saving}
                      >
                        <option value="sample">Sample</option>
                        <option value="email">Email</option>
                        <option value="article">Article</option>
                        <option value="blog">Blog Post</option>
                        <option value="social">Social Media</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Content
                      </label>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full p-4 border-2 border-gray-400 rounded-lg resize-none focus:ring-3 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-base font-medium leading-relaxed shadow-sm hover:border-gray-500 transition-colors"
                        rows={8}
                        placeholder="Edit your writing sample..."
                        disabled={saving}
                      />
                      <div className={`text-xs mt-1 ${
                        editContent.trim().length < 50 ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {editContent.length} characters
                        {editContent.length !== editContent.trim().length && (
                          <span className="text-gray-400"> ({editContent.trim().length} after trimming)</span>
                        )}
                        <span className="block">Minimum 50 characters needed (after trimming)</span>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={cancelEditing}
                        className="px-3 py-1 text-gray-600 hover:text-gray-800 text-sm font-medium rounded hover:bg-gray-100"
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(sample.id)}
                        disabled={saving || !editContent.trim() || editContent.trim().length < 50}
                        className="px-4 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        {sample.content_type || 'sample'}
                      </span>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => startEditing(sample)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium px-2 py-1 rounded hover:bg-blue-50"
                          disabled={editingSample !== null || deleting !== null}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => deleteSample(sample.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1 rounded hover:bg-red-50"
                          disabled={editingSample !== null || deleting === sample.id}
                        >
                          {deleting === sample.id ? '🗑️ Deleting...' : '🗑️ Delete'}
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mb-2 leading-relaxed">
                      {sample.content.length > 300 
                        ? sample.content.substring(0, 300) + '...' 
                        : sample.content
                      }
                    </p>
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>
                        Added: {new Date(sample.created_at).toLocaleDateString()}
                      </span>
                      <span>
                        {sample.content.length} characters
                      </span>
                    </div>
                  </>
                )}
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
            <span>Add samples of your natural writing (emails, articles, social posts, up to 50k characters each)</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-purple-500 mt-0.5">•</span>
            <span>AI analyzes your tone, style, vocabulary, and personality traits</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-purple-500 mt-0.5">•</span>
            <span>Longer samples (1k+ characters) provide richer personality analysis</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-purple-500 mt-0.5">•</span>
            <span>When generating tweets, AI matches your unique writing style</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-purple-500 mt-0.5">•</span>
            <span>More diverse samples = better personality matching and more authentic tweets</span>
          </div>
        </div>
      </div>
    </div>
  );
} 