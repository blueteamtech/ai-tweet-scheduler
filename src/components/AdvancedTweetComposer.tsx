'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AdvancedTweetComposerProps {
  user: User
  onTweetAdded: () => void
  onError: (error: string) => void
  onSuccess: (message: string) => void
}

interface TweetTemplate {
  id: string;
  content: string;
  category: string;
  tone: string;
  structure_type: string;
  reasoning: string;
  used: boolean;
}

interface GenerationResponse {
  content: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  template: TweetTemplate | { used: false; reason: string };
  error?: string;
}

export default function AdvancedTweetComposer({ user, onTweetAdded, onError, onSuccess }: AdvancedTweetComposerProps) {
  const [prompt, setPrompt] = useState('')
  const [tweetContent, setTweetContent] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'claude' | 'grok' | 'auto'>('auto')
  const [contentType, setContentType] = useState<'single' | 'long-form' | 'auto'>('auto')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [lastGenerationInfo, setLastGenerationInfo] = useState<GenerationResponse | null>(null)
  const [templateInfo, setTemplateInfo] = useState<TweetTemplate | null>(null)

  const characterCount = {
    displayCount: tweetContent.length,
    isThread: tweetContent.length > 280,
    threadParts: tweetContent.length > 280 ? Math.ceil(tweetContent.length / 280) : 1
  }

  const isOverLimit = tweetContent.length > 4000

  const generateTweet = async () => {
    if (!prompt.trim()) {
      onError('Please enter a topic or prompt')
      return
    }

    setIsGenerating(true)
    onError('')
    onSuccess('')
    setTemplateInfo(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch('/api/generate-tweet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          aiProvider: selectedProvider,
          contentType,
          showDebug
        }),
      })

      const data: GenerationResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate tweet')
      }

      setTweetContent(data.content)
      setLastGenerationInfo(data)
      
      // Set template information if a template was used
      if (data.template && 'used' in data.template && data.template.used) {
        setTemplateInfo(data.template as TweetTemplate)
      } else {
        setTemplateInfo(null)
      }

      onSuccess('Tweet generated successfully! ✨')
      setTimeout(() => onSuccess(''), 3000)

    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to generate tweet. Please try again.')
      console.error('Error generating tweet:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const saveDraft = async () => {
    if (!tweetContent.trim()) {
      onError('No content to save as draft')
      return
    }

    setIsSaving(true)
    onError('')
    onSuccess('')

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const { error } = await supabase
        .from('tweets')
        .insert({
          user_id: user.id,
          tweet_content: tweetContent.trim(),
          status: 'draft'
        })

      if (error) throw error

      onTweetAdded()
      onSuccess('Draft saved successfully! 💾')
      setTimeout(() => onSuccess(''), 3000)

    } catch (error) {
      onError('Failed to save draft')
      console.error('Error saving draft:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const addToQueue = async () => {
    if (!tweetContent.trim()) {
      onError('No content to add to queue')
      return
    }

    if (isOverLimit) {
      onError('Tweet is too long for the queue (max 4000 characters)')
      return
    }

    setIsSaving(true)
    onError('')
    onSuccess('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch('/api/queue-tweet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          content: tweetContent.trim()
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add tweet to queue')
      }

      onTweetAdded()
      onSuccess(`Tweet added to queue! Will post on ${data.queueSlot.date} 📅`)
      setTimeout(() => onSuccess(''), 5000)

    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to add tweet to queue')
      console.error('Error adding to queue:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          ✨ AI Tweet Composer
        </h2>
        {characterCount.displayCount > 280 && (
          <p className="text-gray-600 text-sm">
            Automatically formats as long-form tweet (281-4000 chars)
          </p>
        )}
      </div>

      <div className="space-y-4">
        {/* AI Provider Selection */}
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <label className="block text-sm font-medium text-purple-700 mb-2">
            🤖 AI Provider
          </label>
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value as 'openai' | 'claude' | 'grok' | 'auto')}
            className="w-full p-2 border border-purple-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
          >
            <option value="auto">🎯 Auto (Best Available)</option>
            <option value="claude">🎭 Claude (Authentic Voice)</option>
            <option value="grok">🔥 Grok (Wit & Edge)</option>
            <option value="openai">💼 OpenAI (Professional)</option>
          </select>
          <p className="text-xs text-purple-600 mt-1">
            {selectedProvider === 'auto' && 'System automatically selects the best performing provider'}
            {selectedProvider === 'claude' && 'Best for authentic voice replication and natural conversation'}
            {selectedProvider === 'grok' && 'Rebellious AI with wit, humor, and contrarian takes'}
            {selectedProvider === 'openai' && 'Professional, reliable content generation'}
          </p>
        </div>

        {/* Generation Transparency Toggle */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="show-debug"
            checked={showDebug}
            onChange={(e) => setShowDebug(e.target.checked)}
            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <label htmlFor="show-debug" className="text-sm text-gray-700">
            Show generation process details
          </label>
        </div>

        {/* Content Type Selection */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <label className="block text-sm font-medium text-blue-700 mb-2">
            📝 Content Format
          </label>
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value as 'single' | 'long-form' | 'auto')}
            className="w-full p-2 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="auto">🎯 Auto (AI Decides)</option>
            <option value="single">🐦 Single Tweet (≤280 chars)</option>
            <option value="long-form">📄 Long-form Tweet (281-4000 chars)</option>
          </select>
        </div>

        {/* Template Information Display */}
        {templateInfo && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-sm font-medium text-green-800 mb-2">📋 Template Used</h3>
            <div className="space-y-2">
              <p className="text-sm text-green-700">
                <strong>Structure:</strong> {templateInfo.structure_type}
              </p>
              <p className="text-sm text-green-700">
                <strong>Category:</strong> {templateInfo.category.replace('_', ' ')}
              </p>
              <p className="text-sm text-green-700">
                <strong>Tone:</strong> {templateInfo.tone}
              </p>
              <p className="text-sm text-green-700">
                <strong>Why selected:</strong> {templateInfo.reasoning}
              </p>
              <details className="mt-2">
                <summary className="text-xs text-green-600 cursor-pointer hover:text-green-800">
                  View original template structure
                </summary>
                <p className="text-xs text-green-600 mt-1 italic bg-green-100 p-2 rounded">
                  &quot;{templateInfo.content}&quot;
                </p>
              </details>
            </div>
          </div>
        )}

        {/* No Template Information */}
        {lastGenerationInfo && lastGenerationInfo.template && !('used' in lastGenerationInfo.template && lastGenerationInfo.template.used) && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="text-sm font-medium text-yellow-800 mb-1">📋 Template Status</h3>
            <p className="text-sm text-yellow-700">
              No template used: {(lastGenerationInfo.template as { reason: string }).reason}
            </p>
          </div>
        )}

        {/* Topic Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            💡 Tweet Topic or Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What would you like to tweet about? (e.g., 'Share a tip about remote work productivity')"
            className="w-full p-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none bg-white text-gray-900 placeholder-gray-500 h-20"
            disabled={isGenerating || isSaving}
          />
        </div>

        {/* Generated Content Area */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Generated Tweet Content
            </label>
            <div className="text-sm text-gray-500">
              {characterCount.displayCount > 0 && (
                <>
                  {characterCount.displayCount}/4000
                  {characterCount.isThread && (
                    <span className="ml-2 text-blue-600">
                      ({characterCount.threadParts} parts)
                    </span>
                  )}
                  {isOverLimit && (
                    <span className="ml-2 text-red-600 font-medium">Too long!</span>
                  )}
                </>
              )}
            </div>
          </div>
          <textarea
            value={tweetContent}
            onChange={(e) => setTweetContent(e.target.value)}
            placeholder="Generated tweet will appear here..."
            className={`w-full p-4 border-2 rounded-lg focus:ring-2 focus:ring-purple-500 resize-none bg-white text-gray-900 placeholder-gray-500 h-32 ${
              isOverLimit 
                ? 'border-red-300 focus:border-red-500' 
                : 'border-gray-300 focus:border-purple-500'
            }`}
            disabled={isGenerating || isSaving}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={generateTweet}
            disabled={isGenerating || isSaving}
            className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? '🤖 Generating...' : selectedProvider === 'auto' ? '🤖 Generate AI' : selectedProvider === 'claude' ? '🎭 Generate with Claude' : selectedProvider === 'grok' ? '🔥 Generate with Grok' : '💼 Generate with OpenAI'}
          </button>
          
          <button
            onClick={saveDraft}
            disabled={isSaving || isGenerating || !tweetContent.trim()}
            className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? '💾 Saving...' : '💾 Save Draft'}
          </button>
          
          <button
            onClick={addToQueue}
            disabled={isSaving || isGenerating || !tweetContent.trim() || isOverLimit}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? '📅 Adding...' : '📅 Add to Queue'}
          </button>
        </div>
      </div>
    </div>
  )
} 