// =========================================
// WritingSampleInput.tsx - Phase 1 V2.0
// Component for analyzing writing samples
// =========================================

'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

// Types
interface PersonalityAnalysis {
  tone: string;
  writing_style: string;
  key_characteristics: string[];
  confidence_score: number;
  word_count: number;
}

interface AnalysisResult {
  sample_id: string;
  personality_analysis?: PersonalityAnalysis;
  embedding_stats: {
    tokens_used: number;
    estimated_cost: number;
  };
}

interface WritingSample {
  id: string;
  content: string;
  content_type: string;
  created_at: string;
}

export default function WritingSampleInput() {
  const [content, setContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<WritingSample[]>([]);
  const [showSamples, setShowSamples] = useState(false);
  const [editingSample, setEditingSample] = useState<WritingSample | null>(null);
  const [editContent, setEditContent] = useState('');



  // Handle form submission
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError('Please enter some writing to analyze');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      // Include user auth token in headers
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/analyze-writing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session && { 'Authorization': `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          content: content.trim(),
          content_type: 'tweet',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAnalysisResult({
          sample_id: data.sample_id,
          personality_analysis: data.personality_analysis,
          embedding_stats: data.embedding_stats,
        });
        // Clear the input after successful analysis
        setContent('');
      } else {
        setError(data.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setError('Failed to analyze writing. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };



  // Load all writing samples
  const loadSamples = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/analyze-writing/samples', {
        headers: session ? { 'Authorization': `Bearer ${session.access_token}` } : undefined,
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSamples(data.samples);
        }
      }
    } catch (error) {
      console.error('Failed to load samples:', error);
    }
  };

  // Toggle samples display
  const toggleSamples = () => {
    if (!showSamples && samples.length === 0) {
      loadSamples();
    }
    setShowSamples(!showSamples);
  };

  // Start editing a sample
  const startEditingSample = (sample: WritingSample) => {
    setEditingSample(sample);
    setEditContent(sample.content);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingSample(null);
    setEditContent('');
  };

  // Save edited sample
  const saveEditedSample = async () => {
    if (!editingSample || !editContent.trim()) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/analyze-writing/samples', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(session && { 'Authorization': `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          id: editingSample.id,
          content: editContent.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSamples(samples.map(s => 
            s.id === editingSample.id ? { ...s, content: editContent.trim() } : s
          ));
          setEditingSample(null);
          setEditContent('');
        } else {
          setError(data.error || 'Failed to update sample');
        }
      }
    } catch (error) {
      console.error('Failed to update sample:', error);
      setError('Failed to update writing sample');
    }
  };

  // Delete a sample
  const deleteSample = async (sampleId: string) => {
    if (!confirm('Are you sure you want to delete this writing sample?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/analyze-writing/samples', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(session && { 'Authorization': `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({ id: sampleId }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSamples(samples.filter(s => s.id !== sampleId));
        } else {
          setError(data.error || 'Failed to delete sample');
        }
      }
    } catch (error) {
      console.error('Failed to delete sample:', error);
      setError('Failed to delete writing sample');
    }
  };

  // Calculate word count
  const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          ✨ Writing Sample Analysis
        </h2>
        <p className="text-gray-600">
          Upload your writing samples to train AI that matches your unique voice and personality for tweet generation.
        </p>
      </div>

      {/* Samples Toggle */}
      <div className="mb-4">
        <button
          onClick={toggleSamples}
          className="text-green-600 hover:text-green-800 text-sm font-medium"
        >
          {showSamples ? 'Hide' : 'Show'} My Writing Samples ({samples.length})
        </button>
      </div>



      {/* Writing Samples List */}
      {showSamples && (
        <div className="mb-6 p-4 bg-green-50 rounded-lg">
          <h3 className="text-lg font-semibold text-green-900 mb-3">Your Writing Samples</h3>
          {samples.length === 0 ? (
            <p className="text-green-700 text-sm">No writing samples yet. Add some above!</p>
          ) : (
            <div className="space-y-4">
              {samples.map((sample) => (
                <div key={sample.id} className="bg-white p-4 rounded-lg border border-green-200">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-green-600 font-medium">
                      {new Date(sample.created_at).toLocaleDateString()} • {sample.content_type}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditingSample(sample)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteSample(sample.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  
                  {editingSample?.id === sample.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical text-gray-900 bg-white"
                        rows={4}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={saveEditedSample}
                          disabled={!editContent.trim()}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-3 py-1 rounded text-sm font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-1 rounded text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {sample.content}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleAnalyze} className="space-y-4">
        {/* Writing Sample Input */}
        <div>
          <label htmlFor="writing-content" className="block text-sm font-medium text-gray-700 mb-2">
            Writing Sample
            <span className="text-gray-500 text-xs ml-2">
              ({wordCount} words, {content.length} characters)
            </span>
          </label>
          <textarea
            id="writing-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your writing here... (tweets, social media posts, casual messages, etc.)

Example:
&quot;Just finished debugging the most frustrating issue - turns out it was a missing semicolon. Sometimes the simplest things trip you up! 🤦‍♂️ Always double-check the basics before diving deep into complex solutions.&quot;"
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical text-gray-900 bg-white placeholder-gray-500"
            disabled={isAnalyzing}
          />
          
          {/* Character/Word Limits */}
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Minimum: ~50 characters for meaningful analysis</span>
            <span className={content.length > 45000 ? 'text-red-500' : ''}>
              Max: 50,000 characters
            </span>
          </div>
        </div>

        {/* Analyze Button */}
        <button
          type="submit"
          disabled={isAnalyzing || !content.trim() || content.length > 50000}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
        >
          {isAnalyzing ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyzing Writing...
            </span>
          ) : (
            '🧠 Analyze Writing Style'
          )}
        </button>
      </form>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <div className="text-red-400 mr-2">⚠️</div>
            <div className="text-red-700">{error}</div>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysisResult && (
        <div className="mt-6 p-6 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-lg font-semibold text-green-900 mb-4">
            ✅ Analysis Complete!
          </h3>
          
          {/* Personality Analysis */}
          {analysisResult.personality_analysis && (
            <div className="mb-4 space-y-3">
              <div>
                <span className="font-medium text-green-800">Tone:</span>
                <span className="ml-2 text-green-700">{analysisResult.personality_analysis.tone}</span>
              </div>
              
              <div>
                <span className="font-medium text-green-800">Writing Style:</span>
                <span className="ml-2 text-green-700">{analysisResult.personality_analysis.writing_style}</span>
              </div>
              
              <div>
                <span className="font-medium text-green-800">Key Characteristics:</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {analysisResult.personality_analysis.key_characteristics.map((trait, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm"
                    >
                      {trait}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center space-x-4 text-sm text-green-600">
                <span>
                  Confidence: {analysisResult.personality_analysis.confidence_score}/10
                </span>
                <span>
                  Words Analyzed: {analysisResult.personality_analysis.word_count}
                </span>
              </div>
            </div>
          )}

          {/* Technical Stats */}
          <div className="pt-3 border-t border-green-200 text-sm text-green-600">
            <div className="flex items-center justify-between">
              <span>Sample ID: {analysisResult.sample_id.slice(0, 8)}...</span>
              <span>
                Tokens: {analysisResult.embedding_stats.tokens_used} 
                (${analysisResult.embedding_stats.estimated_cost.toFixed(4)})
              </span>
            </div>
          </div>

          {/* Next Steps */}
          <div className="mt-4 p-3 bg-blue-50 rounded-md">
            <div className="text-sm text-blue-700">
              <strong>What&apos;s Next:</strong> Your writing sample has been analyzed and stored. 
              The AI will now use this to generate tweets that match your personality and writing style!
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-6 text-sm text-gray-500">
        <p className="mb-2">
          <strong>💡 Tips for better analysis:</strong>
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Include 3-5 different writing samples for best results</li>
          <li>Use your natural writing voice, not formal/corporate tone</li>
          <li>Include samples with different emotions/topics</li>
          <li>Both short tweets and longer posts work well</li>
          <li>Mix casual and professional content for versatility</li>
        </ul>
      </div>
    </div>
  );
} 