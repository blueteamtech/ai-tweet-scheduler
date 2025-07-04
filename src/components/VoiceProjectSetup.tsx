'use client';

import { useState, useEffect } from 'react';
import { VoiceProject, VoiceProjectRequest } from '@/types/index';
import { supabase } from '@/lib/supabase';

interface VoiceProjectSetupProps {
  className?: string;
}

export default function VoiceProjectSetup({ className }: VoiceProjectSetupProps) {
  const [voiceProject, setVoiceProject] = useState<VoiceProject | null>(null);
  const [instructions, setInstructions] = useState('');
  const [writingSamples, setWritingSamples] = useState<string[]>(['']);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showBestPractices, setShowBestPractices] = useState(true);
  const [bestPractices, setBestPractices] = useState(`📝 VOICE PROJECT BEST PRACTICES

🎯 INSTRUCTIONS SECTION:
• Be specific about your writing style (formal, casual, humorous, technical)
• Include tone preferences (direct, friendly, professional, witty)
• Mention topics you focus on (tech, business, personal growth)
• Specify what to avoid (hashtags, emojis, corporate speak)
• Keep it under 2000 characters for best results

✍️ WRITING SAMPLES SECTION:
• Include 3-5 diverse examples of your actual writing
• Use different content types (tweets, emails, blog posts, messages)
• Show various moods/topics to give AI range
• Keep samples 100-500 characters each
• Update samples regularly to reflect your evolving voice

🔧 ACTIVATION TIPS:
• Always check "Use this voice project" when ready
• Test with simple prompts first
• Use "Show Generation Process" to see how AI interprets your voice
• Refine instructions based on results
• Remember: AI will use ONLY your instructions when active (no built-in prompts)

💡 EXAMPLE GOOD INSTRUCTIONS:
"Write tweets like me: direct and conversational, focus on practical tech insights, avoid buzzwords, keep it human and authentic, no hashtags or emojis, share genuine experiences and lessons learned"`);
  const [editingBestPractices, setEditingBestPractices] = useState(false);

  // Load existing voice project
  useEffect(() => {
    loadVoiceProject();
  }, []);

  const loadVoiceProject = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/voice-project', {
        headers: {
          ...(session && { 'Authorization': `Bearer ${session.access_token}` }),
        },
      });
      const result = await response.json();
      
      if (result.success && result.data) {
        const vp = result.data;
        setVoiceProject(vp);
        setInstructions(vp.instructions || '');
        setWritingSamples(vp.writing_samples.length ? vp.writing_samples : ['']);
        setIsActive(vp.is_active || false);
      }
    } catch (error) {
      console.error('Failed to load voice project:', error);
      setMessage({ type: 'error', text: 'Failed to load voice project' });
    } finally {
      setLoading(false);
    }
  };

  const saveVoiceProject = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('You must be logged in to save voice projects');
      }
      
      const payload: VoiceProjectRequest = {
        instructions: instructions.trim(),
        writing_samples: writingSamples.filter(sample => sample.trim()),
        is_active: isActive
      };

      console.log('Saving voice project:', payload);

      const response = await fetch('/api/voice-project', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      console.log('Save result:', result);
      
      if (result.success) {
        setVoiceProject(result.data);
        setMessage({ type: 'success', text: 'Voice project saved successfully!' });
      } else {
        const errorMessage = result.error || 'Failed to save voice project';
        const details = result.details ? ` Details: ${result.details.join(', ')}` : '';
        throw new Error(errorMessage + details);
      }
    } catch (error) {
      console.error('Failed to save voice project:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to save voice project. Please try again.' 
      });
    } finally {
      setSaving(false);
    }
  };

  const addWritingSample = () => {
    if (writingSamples.length < 10) {
      setWritingSamples([...writingSamples, '']);
    }
  };

  const removeWritingSample = (index: number) => {
    if (writingSamples.length > 1) {
      const newSamples = writingSamples.filter((_, i) => i !== index);
      setWritingSamples(newSamples);
    }
  };

  const updateWritingSample = (index: number, value: string) => {
    const newSamples = [...writingSamples];
    newSamples[index] = value;
    setWritingSamples(newSamples);
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">🎭 Voice Project System</h3>
        <p className="text-blue-700 text-sm mb-3">
          Configure your personal voice once, and AI will automatically reference your instructions and writing samples for every tweet generation - just like ChatGPT Projects!
        </p>
        <div className="text-blue-700 text-xs">
          <p><strong>Quick Setup:</strong></p>
          <ol className="list-decimal list-inside ml-2 space-y-1">
            <li>Add instructions on how AI should write like you</li>
            <li>Paste 2-3 examples of your writing style</li>
            <li>Check the &quot;Use this voice project&quot; box</li>
            <li>Click &quot;Save Voice Project&quot;</li>
          </ol>
        </div>
      </div>

      {/* Best Practices Section */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-lg p-4 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-green-900 text-lg">💡 Best Practices & Tips</h3>
          <button
            onClick={() => setShowBestPractices(!showBestPractices)}
            className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 text-sm font-medium"
          >
            {showBestPractices ? 'Hide' : 'Show'} Best Practices
          </button>
        </div>
        
        {showBestPractices && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-gray-800 font-medium">You can edit these best practices:</span>
              <button
                onClick={() => setEditingBestPractices(!editingBestPractices)}
                className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium hover:bg-blue-700"
              >
                {editingBestPractices ? '💾 Save' : '✏️ Edit'}
              </button>
            </div>
            
            {editingBestPractices ? (
              <textarea
                value={bestPractices}
                onChange={(e) => setBestPractices(e.target.value)}
                className="w-full p-4 border-2 border-gray-400 rounded-lg h-64 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 font-mono text-sm leading-relaxed"
              />
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-gray-900 bg-gray-50 p-4 rounded border-2 border-gray-300 font-mono leading-relaxed">
                {bestPractices}
              </pre>
            )}
          </div>
        )}
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Instructions Editor */}
      <div>
        <label className="block text-base font-semibold text-gray-900 mb-2">
          Voice Instructions
          <span className="text-gray-700 font-normal ml-1">(How should AI write like you?)</span>
        </label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Write tweets like me: direct, humorous, tech-focused, use casual language, include personal anecdotes..."
          className="w-full p-4 border-2 border-gray-400 rounded-lg h-32 resize-none focus:ring-3 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600 text-base font-medium leading-relaxed shadow-sm hover:border-gray-500 transition-colors"
          maxLength={2000}
        />
        <p className="text-sm text-gray-700 mt-1 font-medium">
          {instructions.length}/2000 characters
        </p>
      </div>

      {/* Writing Samples Manager */}
      <div>
        <label className="block text-base font-semibold text-gray-900 mb-2">
          Writing Samples
          <span className="text-gray-700 font-normal ml-1">(Examples of your writing style)</span>
        </label>
        
        {writingSamples.map((sample, index) => (
          <div key={index} className="mb-3 relative">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <textarea
                  value={sample}
                  onChange={(e) => updateWritingSample(index, e.target.value)}
                  placeholder={`Writing sample ${index + 1} - paste an example of your writing (tweet, email, blog post, etc.)`}
                  className="w-full p-4 border-2 border-gray-400 rounded-lg h-24 resize-none focus:ring-3 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 placeholder-gray-600 text-base font-medium leading-relaxed shadow-sm hover:border-gray-500 transition-colors"
                />
              </div>
              {writingSamples.length > 1 && (
                <button
                  onClick={() => removeWritingSample(index)}
                  className="mt-2 text-red-600 hover:text-red-800 text-sm px-2 py-1 rounded"
                  title="Remove this sample"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
        
        {writingSamples.length < 10 && (
          <button
            onClick={addWritingSample}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            + Add Writing Sample ({writingSamples.length}/10)
          </button>
        )}
      </div>

      {/* Activation Toggle */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="voice-active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="voice-active" className="text-sm font-medium text-gray-700">
            Use this voice project for all tweet generation
          </label>
        </div>
        <p className="text-xs text-gray-500 mt-2 ml-6">
          When active, AI will automatically reference your instructions and writing samples for every tweet.
        </p>
      </div>

      {/* Save Button */}
      <div className="flex gap-3">
        <button
          onClick={saveVoiceProject}
          disabled={saving || (!instructions.trim() && writingSamples.every(s => !s.trim()))}
          className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {saving ? 'Saving Voice Project...' : 'Save Voice Project'}
        </button>
        
        {voiceProject && (
          <button
            onClick={loadVoiceProject}
            disabled={saving}
            className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-gray-700 font-medium"
          >
            Reset
          </button>
        )}
      </div>
      
      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
          <p>Debug: Check browser console for detailed error messages</p>
        </div>
      )}

      {/* Status Info */}
      {voiceProject && (
        <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-900 mb-2">📊 Voice Project Status</h4>
          <div className="space-y-1">
            <p><strong className="text-gray-900">Status:</strong> {isActive ? '🟢 Active - AI will use this voice project' : '🔴 Inactive - Click the checkbox above to activate'}</p>
            <p><strong className="text-gray-900">Instructions:</strong> {instructions.length > 0 ? `${instructions.length} characters` : 'None'}</p>
            <p><strong className="text-gray-900">Writing Samples:</strong> {writingSamples.filter(s => s.trim()).length} samples</p>
            <p><strong className="text-gray-900">Last Updated:</strong> {new Date(voiceProject.updated_at).toLocaleDateString()}</p>
          </div>
          
          {!isActive && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800 text-sm">
                <strong>⚠️ Voice Project is Inactive:</strong> Check the box above to activate it, then click &quot;Save Voice Project&quot; to use it for tweet generation.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 