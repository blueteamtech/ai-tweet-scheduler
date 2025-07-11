'use client';

import { useState, useEffect, useCallback } from 'react';
import { VoiceProject, VoiceProjectRequest } from '@/types/index';
import { supabase } from '@/lib/supabase';

interface VoiceProjectSetupProps {
  className?: string;
}

interface TweetTemplate {
  id: string;
  template_content: string;
  category: string;
  tone: string;
  structure_type: string;
  is_active: boolean;
  usage_count: number;
  last_used_at: string | null;
  effectiveness_score: number;
  feedback_count: number;
  average_rating: number;
}

interface TemplateAnalytics {
  totalTemplates: number;
  activeTemplates: number;
  averageEffectiveness: number;
  topPerformingCategories: { category: string; score: number; count: number }[];
  recentlyUsed: TweetTemplate[];
  underperforming: TweetTemplate[];
  mostEffective: TweetTemplate[];
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
  
  // Template management state
  const [templates, setTemplates] = useState<TweetTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateFilter, setTemplateFilter] = useState('all');
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTone, setSelectedTone] = useState('all');
  const [templateCategories, setTemplateCategories] = useState<string[]>([]);
  const [templateTones, setTemplateTones] = useState<string[]>([]);
  
  // Phase 4: Analytics and optimization
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analytics, setAnalytics] = useState<TemplateAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [sortBy, setSortBy] = useState<'effectiveness' | 'usage' | 'recent' | 'rating'>('effectiveness');
  
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

📋 TEMPLATE LIBRARY:
• 300 proven tweet templates automatically available
• Categorized by tone, structure, and purpose
• Enable/disable templates based on your preferences
• Templates enhance your voice without replacing it
• AI automatically selects best template for each topic
• Rate templates to improve future selections

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

  // Load templates when voice project is loaded
  useEffect(() => {
    if (voiceProject) {
      loadTemplates();
    }
  }, [voiceProject]);

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

  const loadTemplates = useCallback(async () => {
    if (!voiceProject) return;
    
    setLoadingTemplates(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;

      const { data: templatesData, error } = await supabase
        .from('tweet_templates')
        .select('*')
        .eq('voice_project_id', voiceProject.id)
        .order('effectiveness_score', { ascending: false });

      if (error) throw error;

      setTemplates(templatesData || []);
      
      // Extract unique categories and tones
      const categories = [...new Set(templatesData?.map(t => t.category) || [])].sort();
      const tones = [...new Set(templatesData?.map(t => t.tone) || [])].sort();
      
      setTemplateCategories(categories);
      setTemplateTones(tones);
      
    } catch (error) {
      console.error('Failed to load templates:', error);
      setMessage({ type: 'error', text: 'Failed to load templates' });
    } finally {
      setLoadingTemplates(false);
    }
  }, [voiceProject]);

  const loadAnalytics = async () => {
    if (!voiceProject || !templates.length) return;
    
    setLoadingAnalytics(true);
    try {
      const totalTemplates = templates.length;
      const activeTemplates = templates.filter(t => t.is_active).length;
      const templatesWithFeedback = templates.filter(t => t.feedback_count > 0);
      
      const averageEffectiveness = templatesWithFeedback.length > 0 
        ? templatesWithFeedback.reduce((sum, t) => sum + t.effectiveness_score, 0) / templatesWithFeedback.length
        : 0;

      // Calculate category performance
      const categoryStats = templates.reduce((acc, template) => {
        const category = template.category;
        if (!acc[category]) {
          acc[category] = { totalScore: 0, count: 0, templates: [] };
        }
        if (template.effectiveness_score > 0) {
          acc[category].totalScore += template.effectiveness_score;
          acc[category].count++;
        }
        acc[category].templates.push(template);
        return acc;
      }, {} as Record<string, { totalScore: number; count: number; templates: TweetTemplate[] }>);

      const topPerformingCategories = Object.entries(categoryStats)
        .map(([category, stats]) => ({
          category,
          score: stats.count > 0 ? stats.totalScore / stats.count : 0,
          count: stats.count
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      // Get template insights
      const recentlyUsed = templates
        .filter(t => t.last_used_at)
        .sort((a, b) => new Date(b.last_used_at!).getTime() - new Date(a.last_used_at!).getTime())
        .slice(0, 5);

      const underperforming = templates
        .filter(t => t.feedback_count >= 2 && t.effectiveness_score < 3)
        .sort((a, b) => a.effectiveness_score - b.effectiveness_score)
        .slice(0, 5);

      const mostEffective = templates
        .filter(t => t.effectiveness_score > 0)
        .sort((a, b) => b.effectiveness_score - a.effectiveness_score)
        .slice(0, 5);

      setAnalytics({
        totalTemplates,
        activeTemplates,
        averageEffectiveness: Math.round(averageEffectiveness * 10) / 10,
        topPerformingCategories,
        recentlyUsed,
        underperforming,
        mostEffective
      });

    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const toggleTemplate = async (templateId: string, currentActive: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setMessage({ type: 'error', text: 'You must be logged in to manage templates' });
        return;
      }

      const { error } = await supabase
        .from('tweet_templates')
        .update({ is_active: !currentActive })
        .eq('id', templateId);

      if (error) throw error;

      // Update local state
      setTemplates(templates.map(t => 
        t.id === templateId ? { ...t, is_active: !currentActive } : t
      ));

      setMessage({ 
        type: 'success', 
        text: `Template ${!currentActive ? 'enabled' : 'disabled'} successfully` 
      });
      setTimeout(() => setMessage(null), 3000);

    } catch (error) {
      console.error('Failed to toggle template:', error);
      setMessage({ type: 'error', text: 'Failed to update template' });
    }
  };

  const optimizeTemplates = async () => {
    if (!analytics) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setMessage({ type: 'error', text: 'You must be logged in to optimize templates' });
        return;
      }

      // Auto-disable underperforming templates (score < 2 with 3+ feedback)
      const toDisable = templates.filter(t => 
        t.feedback_count >= 3 && t.effectiveness_score < 2 && t.is_active
      );
      
      for (const template of toDisable) {
        await supabase
          .from('tweet_templates')
          .update({ is_active: false })
          .eq('id', template.id);
      }

      // Auto-enable high-performing templates in top categories
      const topCategories = analytics.topPerformingCategories.slice(0, 3).map(c => c.category);
      const toEnable = templates.filter(t => 
        topCategories.includes(t.category) && 
        t.effectiveness_score >= 4 && 
        !t.is_active
      ).slice(0, 10); // Limit to 10 new activations
      
      for (const template of toEnable) {
        await supabase
          .from('tweet_templates')
          .update({ is_active: true })
          .eq('id', template.id);
      }

      await loadTemplates();
      setMessage({ 
        type: 'success', 
        text: `Optimization complete! Disabled ${toDisable.length} underperforming templates, enabled ${toEnable.length} high-performing templates.` 
      });
      setTimeout(() => setMessage(null), 5000);

    } catch (error) {
      console.error('Failed to optimize templates:', error);
      setMessage({ type: 'error', text: 'Failed to optimize templates' });
    }
  };

  // Sort templates based on selected criteria
  const getSortedTemplates = () => {
    const filtered = filteredTemplates;
    
    switch (sortBy) {
      case 'effectiveness':
        return filtered.sort((a, b) => b.effectiveness_score - a.effectiveness_score);
      case 'usage':
        return filtered.sort((a, b) => b.usage_count - a.usage_count);
      case 'recent':
        return filtered.sort((a, b) => {
          if (!a.last_used_at && !b.last_used_at) return 0;
          if (!a.last_used_at) return 1;
          if (!b.last_used_at) return -1;
          return new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime();
        });
      case 'rating':
        return filtered.sort((a, b) => b.average_rating - a.average_rating);
      default:
        return filtered;
    }
  };

  // Filter templates based on current filters
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = templateSearch === '' || 
      template.template_content.toLowerCase().includes(templateSearch.toLowerCase()) ||
      template.category.toLowerCase().includes(templateSearch.toLowerCase()) ||
      template.tone.toLowerCase().includes(templateSearch.toLowerCase());
      
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesTone = selectedTone === 'all' || template.tone === selectedTone;
    const matchesFilter = templateFilter === 'all' || 
      (templateFilter === 'active' && template.is_active) ||
      (templateFilter === 'inactive' && !template.is_active) ||
      (templateFilter === 'high-performing' && template.effectiveness_score >= 4) ||
      (templateFilter === 'needs-improvement' && template.effectiveness_score < 3 && template.feedback_count > 0);
      
    return matchesSearch && matchesCategory && matchesTone && matchesFilter;
  });

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

  const activeTemplateCount = templates.filter(t => t.is_active).length;
  const totalTemplateCount = templates.length;

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
            <li>Manage your template library (300 proven structures)</li>
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

      {/* Template Library Management */}
      {voiceProject && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-purple-900 text-lg">📋 Template Library ({activeTemplateCount}/{totalTemplateCount} active)</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setShowAnalytics(!showAnalytics);
                  if (!showAnalytics && !analytics) {
                    loadAnalytics();
                  }
                }}
                className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 text-sm font-medium"
              >
                {showAnalytics ? 'Hide' : 'Show'} Analytics
              </button>
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="bg-purple-600 text-white px-3 py-1 rounded-md hover:bg-purple-700 text-sm font-medium"
              >
                {showTemplates ? 'Hide' : 'Manage'} Templates
              </button>
            </div>
          </div>
          
          <p className="text-purple-700 text-sm mb-3">
            300 proven tweet templates categorized by tone, structure, and purpose. Enable/disable templates to customize your AI&apos;s selection.
          </p>

          {/* Phase 4: Template Analytics Dashboard */}
          {showAnalytics && (
            <div className="mb-4 space-y-4 bg-white rounded-lg p-4 border border-purple-300">
              {loadingAnalytics ? (
                <div className="flex items-center justify-center p-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                  <span className="ml-2 text-purple-700">Loading analytics...</span>
                </div>
              ) : analytics ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-purple-900">📊 Template Performance Analytics</h4>
                    <button
                      onClick={optimizeTemplates}
                      className="bg-orange-600 text-white px-3 py-1 rounded-md hover:bg-orange-700 text-sm font-medium"
                    >
                      🚀 Auto-Optimize
                    </button>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-blue-50 p-3 rounded">
                      <div className="text-2xl font-bold text-blue-700">{analytics.totalTemplates}</div>
                      <div className="text-xs text-blue-600">Total Templates</div>
                    </div>
                    <div className="bg-green-50 p-3 rounded">
                      <div className="text-2xl font-bold text-green-700">{analytics.activeTemplates}</div>
                      <div className="text-xs text-green-600">Active Templates</div>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded">
                      <div className="text-2xl font-bold text-yellow-700">{analytics.averageEffectiveness.toFixed(1)}</div>
                      <div className="text-xs text-yellow-600">Avg Effectiveness</div>
                    </div>
                    <div className="bg-purple-50 p-3 rounded">
                      <div className="text-2xl font-bold text-purple-700">{analytics.topPerformingCategories.length}</div>
                      <div className="text-xs text-purple-600">Top Categories</div>
                    </div>
                  </div>

                  {/* Top Performing Categories */}
                  {analytics.topPerformingCategories.length > 0 && (
                    <div className="mb-4">
                      <h5 className="font-semibold text-gray-800 mb-2">🏆 Top Performing Categories</h5>
                      <div className="space-y-2">
                        {analytics.topPerformingCategories.map((cat) => (
                          <div key={cat.category} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                            <span className="text-sm font-medium">{cat.category.replace('_', ' ')}</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-600">{cat.count} rated</span>
                              <span className="text-sm font-bold text-green-600">{cat.score.toFixed(1)}/5</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Template Insights */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {analytics.mostEffective.length > 0 && (
                      <div>
                        <h5 className="font-semibold text-green-800 mb-2">⭐ Most Effective</h5>
                        <div className="space-y-1">
                          {analytics.mostEffective.slice(0, 3).map((template) => (
                            <div key={template.id} className="text-xs bg-green-50 p-2 rounded">
                              <div className="font-medium">{template.category}</div>
                              <div className="text-green-600">Score: {template.effectiveness_score}/5</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {analytics.recentlyUsed.length > 0 && (
                      <div>
                        <h5 className="font-semibold text-blue-800 mb-2">🕒 Recently Used</h5>
                        <div className="space-y-1">
                          {analytics.recentlyUsed.slice(0, 3).map((template) => (
                            <div key={template.id} className="text-xs bg-blue-50 p-2 rounded">
                              <div className="font-medium">{template.category}</div>
                              <div className="text-blue-600">Used: {template.usage_count} times</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {analytics.underperforming.length > 0 && (
                      <div>
                        <h5 className="font-semibold text-red-800 mb-2">⚠️ Needs Improvement</h5>
                        <div className="space-y-1">
                          {analytics.underperforming.slice(0, 3).map((template) => (
                            <div key={template.id} className="text-xs bg-red-50 p-2 rounded">
                              <div className="font-medium">{template.category}</div>
                              <div className="text-red-600">Score: {template.effectiveness_score}/5</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-500 py-4">
                  <button
                    onClick={loadAnalytics}
                    className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
                  >
                    Load Analytics
                  </button>
                </div>
              )}
            </div>
          )}
          
          {showTemplates && (
            <div className="space-y-4 bg-white rounded-lg p-4 border border-purple-300">
              {loadingTemplates ? (
                <div className="flex items-center justify-center p-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                  <span className="ml-2 text-purple-700">Loading templates...</span>
                </div>
              ) : (
                <>
                  {/* Template Filters */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
                      <input
                        type="text"
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        placeholder="Search templates..."
                        className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="all">All Categories</option>
                        {templateCategories.map(cat => (
                          <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={templateFilter}
                        onChange={(e) => setTemplateFilter(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="all">All Templates</option>
                        <option value="active">Active Only</option>
                        <option value="inactive">Inactive Only</option>
                        <option value="high-performing">High Performing</option>
                        <option value="needs-improvement">Needs Improvement</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Tone</label>
                      <select
                        value={selectedTone}
                        onChange={(e) => setSelectedTone(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="all">All Tones</option>
                        {templateTones.map(tone => (
                          <option key={tone} value={tone}>{tone}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Sort By</label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'effectiveness' | 'usage' | 'recent' | 'rating')}
                        className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="effectiveness">Effectiveness</option>
                        <option value="usage">Usage Count</option>
                        <option value="recent">Recently Used</option>
                        <option value="rating">User Rating</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Template List */}
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    <p className="text-sm text-gray-600 mb-2">
                      Showing {getSortedTemplates().length} templates
                    </p>
                    
                    {getSortedTemplates().map((template) => (
                      <div key={template.id} className="border border-gray-200 rounded p-3 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0 pr-3">
                            <p className="text-sm text-gray-900 mb-1">{template.template_content}</p>
                            <div className="flex items-center space-x-2 text-xs text-gray-500">
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                {template.category.replace('_', ' ')}
                              </span>
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                                {template.tone}
                              </span>
                              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                {template.structure_type}
                              </span>
                              {template.usage_count > 0 && (
                                <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded">
                                  Used {template.usage_count} times
                                </span>
                              )}
                              {template.effectiveness_score > 0 && (
                                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded">
                                  Score: {template.effectiveness_score}/5
                                </span>
                              )}
                              {template.average_rating > 0 && (
                                <span className="bg-pink-100 text-pink-800 px-2 py-1 rounded">
                                  Rating: {template.average_rating}/5
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => toggleTemplate(template.id, template.is_active)}
                            className={`px-3 py-1 rounded text-xs font-medium ${
                              template.is_active 
                                ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            {template.is_active ? '✓ Active' : '○ Inactive'}
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {getSortedTemplates().length === 0 && (
                      <p className="text-center text-gray-500 py-4">
                        No templates match your current filters.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

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
          When active, AI will automatically reference your instructions, writing samples, and enabled templates for every tweet.
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
            <p><strong className="text-gray-900">Template Library:</strong> {activeTemplateCount} of {totalTemplateCount} templates active</p>
            {analytics && (
              <p><strong className="text-gray-900">Template Performance:</strong> {analytics.averageEffectiveness.toFixed(1)}/5 average effectiveness</p>
            )}
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