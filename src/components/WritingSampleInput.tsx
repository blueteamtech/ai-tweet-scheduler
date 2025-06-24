// =========================================
// WritingSampleInput.tsx - Phase 1 V2.0
// Component for analyzing writing samples
// =========================================

'use client';

import { useState } from 'react';

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

interface WritingSampleStats {
  total_samples: number;
  by_type: Record<string, number>;
  latest_samples: Array<{
    id: string;
    content_type: string;
    created_at: string;
  }>;
}

export default function WritingSampleInput() {
  const [content, setContent] = useState('');
  const [contentType, setContentType] = useState<'tweet' | 'text' | 'post' | 'message'>('tweet');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<WritingSampleStats | null>(null);
  const [showStats, setShowStats] = useState(false);

  // Load user stats
  const loadStats = async () => {
    try {
      const response = await fetch('/api/analyze-writing');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        }
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

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
      const response = await fetch('/api/analyze-writing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content.trim(),
          content_type: contentType,
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
        // Refresh stats
        loadStats();
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

  // Toggle stats display
  const toggleStats = () => {
    if (!showStats && !stats) {
      loadStats();
    }
    setShowStats(!showStats);
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
          Upload your writing samples to train AI that matches your unique voice and personality.
        </p>
      </div>

      {/* Stats Toggle */}
      <div className="mb-4">
        <button
          onClick={toggleStats}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          {showStats ? 'Hide' : 'Show'} My Writing Samples ({stats?.total_samples || 0})
        </button>
      </div>

      {/* Stats Display */}
      {showStats && stats && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Your Writing Portfolio</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-700">{stats.total_samples}</div>
              <div className="text-sm text-blue-600">Total Samples</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-700">
                {Object.keys(stats.by_type).length}
              </div>
              <div className="text-sm text-blue-600">Content Types</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-700">
                {stats.total_samples > 0 ? '✅' : '⏳'}
              </div>
              <div className="text-sm text-blue-600">
                {stats.total_samples > 0 ? 'AI Ready' : 'Getting Started'}
              </div>
            </div>
          </div>
          
          {Object.keys(stats.by_type).length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-medium text-blue-800 mb-2">By Type:</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.by_type).map(([type, count]) => (
                  <span
                    key={type}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    {type}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleAnalyze} className="space-y-4">
        {/* Content Type Selector */}
        <div>
          <label htmlFor="content-type" className="block text-sm font-medium text-gray-700 mb-2">
            Content Type
          </label>
          <select
            id="content-type"
            value={contentType}
            onChange={(e) => setContentType(e.target.value as typeof contentType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
          >
            <option value="tweet">Tweet</option>
            <option value="text">General Text</option>
            <option value="post">Social Media Post</option>
            <option value="message">Message/Email</option>
          </select>
        </div>

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
            placeholder="Paste your writing here... (tweets, emails, posts, messages, etc.)

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
          <li>Mix different content types (tweets, emails, posts)</li>
          <li>Use your natural writing voice, not formal/corporate tone</li>
          <li>Include samples with different emotions/topics</li>
          <li>Longer samples (100+ words) provide better personality insights</li>
        </ul>
      </div>
    </div>
  );
} 