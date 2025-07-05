'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { 
  analyzeContent, 
  getAccurateCharacterCount,
  type ContentAnalysis,
  type ContentFormatOptions
} from '@/lib/content-management'
import type { DebugInfo } from '@/types/index'

interface AdvancedTweetComposerProps {
  user: User
  onTweetAdded: () => void
  onError: (error: string) => void
  onSuccess: (message: string) => void
}

export default function AdvancedTweetComposer({ user, onTweetAdded, onError, onSuccess }: AdvancedTweetComposerProps) {
  const [tweetContent, setTweetContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [contentAnalysis, setContentAnalysis] = useState<ContentAnalysis | null>(null)
  const [formatOptions] = useState<ContentFormatOptions>({
    maxCharactersPerTweet: 280,
    longFormEnabled: true
  })
  const [showGenerationProcess, setShowGenerationProcess] = useState(false)
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'claude' | 'grok' | 'auto'>('auto')

  // Analyze content whenever it changes
  useEffect(() => {
    if (tweetContent.trim()) {
      try {
        const analysis = analyzeContent(tweetContent, formatOptions)
        setContentAnalysis(analysis)
      } catch {
        // Content too long for both single and long-form
        setContentAnalysis(null)
      }
    } else {
      setContentAnalysis(null)
    }
  }, [tweetContent, formatOptions])

  const characterCount = getAccurateCharacterCount(tweetContent)
  const isOverLimit = characterCount.displayCount > 4000 // Content too long

  const generateTweet = async () => {
    if (!user) return
    
    setIsGenerating(true)
    onError('')
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch('/api/generate-tweet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session && { 'Authorization': `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          prompt: tweetContent || 'Write a motivational tweet about entrepreneurship and building startups',
          contentType: 'auto',
          maxLength: 4000,
          showDebug: showGenerationProcess,
          aiProvider: selectedProvider
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate tweet')
      }

      const data = await response.json()
      setTweetContent(data.tweet)
      setDebugInfo(data.debug)
    } catch (error) {
      onError('Failed to generate tweet. Please try again.')
      console.error('Error generating tweet:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const saveDraft = async () => {
    if (!user || !tweetContent.trim()) {
      onError('Please enter some content before saving')
      return
    }

    setIsSaving(true)
    onError('')

    try {
      const { error } = await supabase
        .from('tweets')
        .insert([
          {
            user_id: user.id,
            tweet_content: tweetContent.trim(),
            status: 'draft'
          }
        ])

      if (error) throw error

      onSuccess('Draft saved successfully!')
      setTweetContent('')
      onTweetAdded()
      
      setTimeout(() => onSuccess(''), 3000)
    } catch (error) {
      onError('Failed to save draft. Please try again.')
      console.error('Error saving draft:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const addToQueue = async () => {
    if (!user || !tweetContent.trim()) {
      onError('Please enter some content before adding to queue')
      return
    }

    if (isOverLimit) {
      onError('Content is too long (max 4000 characters)')
      return
    }

    setIsSaving(true)
    onError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        onError('You must be logged in to add tweets to the queue')
        return
      }

      // Use the automatic content type from analysis
      const finalContentType = contentAnalysis?.contentType || 'single'

      const response = await fetch('/api/queue-tweet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          content: tweetContent.trim(),
          contentType: finalContentType
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add tweet to queue')
      }

      if (result.autoScheduled) {
        onSuccess(`✅ ${result.message}`)
      } else if (result.warning) {
        onSuccess(`⚠️ ${result.warning}`)
      } else {
        const queueDate = new Date(result.queueSlot.date + 'T00:00:00').toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })
        onSuccess(`${finalContentType === 'long-form' ? 'Long-form tweet' : 'Tweet'} added to queue for ${queueDate}`)
      }
      
      setTweetContent('')
      onTweetAdded()
      
      setTimeout(() => onSuccess(''), 3000)
    } catch (error) {
      onError('Failed to add tweet to queue. Please try again.')
      console.error('Error adding tweet to queue:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const renderContentAnalysis = () => {
    if (!contentAnalysis) return null

    const getIcon = () => {
      switch (contentAnalysis.contentType) {
        case 'long-form':
          return '📄'
        default:
          return '💬'
      }
    }

    const getDescription = () => {
      switch (contentAnalysis.contentType) {
        case 'long-form':
          return 'Long-form tweet'
        default:
          return 'Single tweet'
      }
    }

    return (
      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <span className="text-lg mr-2">{getIcon()}</span>
            <span className="font-medium text-gray-700">
              {getDescription()}
            </span>
          </div>
          <span className="text-sm text-gray-500">
            {contentAnalysis.characterCount} chars
          </span>
        </div>
        
        {contentAnalysis.contentType === 'long-form' && (
          <div className="text-sm text-gray-600">
            <p>Read time: ~{contentAnalysis.estimatedReadTime} min</p>
          </div>
        )}
      </div>
    )
  }

  const renderTemplatePreview = () => {
    if (!showGenerationProcess || !debugInfo?.template?.used) return null

    return (
      <div className="mt-3 p-3 bg-orange-50 border border-orange-300 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <span className="text-lg mr-2">📝</span>
            <span className="font-medium text-orange-700">
              Template Selected
            </span>
          </div>
          <span className="text-sm text-orange-600">
            {debugInfo.template.wordCountTarget}
          </span>
        </div>
        
        <div className="text-sm text-orange-700 mb-2">
          <p><strong>Reason:</strong> {debugInfo.template.selectionReason}</p>
        </div>
        
        <div className="bg-white p-2 rounded border border-orange-200">
          <p className="text-xs text-orange-600 font-medium mb-1">Template Structure:</p>
          <p className="text-sm text-orange-800 font-mono">
            {debugInfo.template.structure}
          </p>
        </div>
      </div>
    )
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
        <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <input
            type="checkbox"
            id="show-generation"
            checked={showGenerationProcess}
            onChange={(e) => setShowGenerationProcess(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="show-generation" className="text-sm font-medium text-blue-700">
            🔍 Show Generation Process (Full Transparency)
          </label>
        </div>

        {/* Content Input */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="content" className="block text-sm font-medium text-gray-700">
              Content
            </label>
            <div className="flex items-center space-x-2 text-xs">
              <span className={`${isOverLimit ? 'text-red-500' : 'text-gray-500'}`}>
                {characterCount.displayCount} / 4000
              </span>
              {isOverLimit && (
                <span className="text-red-500 font-medium">Too long!</span>
              )}
            </div>
          </div>
          <textarea
            id="content"
            rows={6}
            className="w-full p-4 border-2 border-gray-400 rounded-lg focus:ring-3 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white text-gray-900 text-base font-medium leading-relaxed shadow-sm hover:border-gray-500 transition-colors"
            placeholder="Write your tweet content here... It will automatically be formatted based on length."
            value={tweetContent}
            onChange={(e) => setTweetContent(e.target.value)}
          />
          {renderContentAnalysis()}
          {renderTemplatePreview()}
        </div>

        {/* Debug Information Display */}
        {showGenerationProcess && debugInfo && (
          <div className="bg-white border-2 border-gray-400 p-4 rounded-lg mt-4 shadow-md">
            <h3 className="font-semibold mb-3 text-black">🔍 Generation Process Transparency</h3>
            
            {debugInfo.aiProvider && (
              <div className="mb-3 p-3 bg-purple-100 rounded border-2 border-purple-400">
                <h4 className="font-medium text-purple-900 mb-2">🤖 AI Provider Used</h4>
                <p className="text-sm text-purple-900 font-semibold">
                  <strong>Provider:</strong> {debugInfo.aiProvider.provider}
                </p>
                <p className="text-sm text-purple-900 font-semibold">
                  <strong>Model:</strong> {debugInfo.aiProvider.model}
                </p>
                <p className="text-sm text-purple-900 font-semibold">
                  <strong>Response Time:</strong> {debugInfo.aiProvider.responseTime}ms
                </p>
              </div>
            )}
            
            {debugInfo.voiceProject && (
              <div className="mb-3 p-3 bg-blue-100 rounded border-2 border-blue-400">
                <h4 className="font-medium text-blue-900 mb-2">🎭 Voice Project Used</h4>
                <p className="text-sm text-blue-900 font-semibold">
                  <strong>Instructions:</strong> {debugInfo.voiceProject.hasInstructions ? 'Yes' : 'No'}
                </p>
                <p className="text-sm text-blue-900 font-semibold">
                  <strong>Writing Samples:</strong> {debugInfo.voiceProject.sampleCount}
                </p>
                <p className="text-sm text-blue-900 font-semibold">
                  <strong>Status:</strong> {debugInfo.voiceProject.isActive ? 'Active' : 'Inactive'}
                </p>
              </div>
            )}
            
            {debugInfo.legacyPersonality && (
              <div className="mb-3 p-3 bg-yellow-100 rounded border-2 border-yellow-400">
                <h4 className="font-medium text-yellow-900 mb-2">🧠 Legacy Personality System</h4>
                <p className="text-sm text-yellow-900 font-semibold">
                  <strong>Writing Samples Used:</strong> {debugInfo.legacyPersonality.samplesUsed}
                </p>
                <p className="text-sm text-yellow-900 font-semibold">
                  <strong>Has Samples:</strong> {debugInfo.legacyPersonality.hasWritingSamples ? 'Yes' : 'No'}
                </p>
              </div>
            )}
            
            {/* Template Information */}
            <div className="mb-3 p-3 bg-orange-100 rounded border-2 border-orange-400">
              <h4 className="font-medium text-orange-900 mb-2">📝 Template Usage</h4>
              <p className="text-sm text-orange-900 font-semibold">
                <strong>Template Used:</strong> {debugInfo.template?.used ? 'Yes' : 'No'}
              </p>
              {debugInfo.template?.used && (
                <>
                  <p className="text-sm text-orange-900 font-semibold">
                    <strong>Selection Reason:</strong> {debugInfo.template.selectionReason}
                  </p>
                  <p className="text-sm text-orange-900 font-semibold">
                    <strong>Template Type:</strong> {debugInfo.template.wordCountTarget}
                  </p>
                  <div className="mt-2 p-2 bg-orange-50 rounded border">
                    <p className="text-xs text-orange-800 font-medium">Selected Template:</p>
                    <p className="text-sm text-orange-900 font-mono bg-white p-2 rounded mt-1">
                      {debugInfo.template.structure}
                    </p>
                  </div>
                </>
              )}
            </div>
            
            <details className="mt-3">
              <summary className="cursor-pointer font-medium text-gray-900 hover:text-gray-700 bg-gray-100 p-2 rounded">
                📋 Full AI Prompt (Click to expand)
              </summary>
              <pre className="mt-2 p-4 bg-gray-50 rounded text-base overflow-auto max-h-64 border-2 border-gray-400 text-black font-mono leading-relaxed shadow-inner">
                {debugInfo.fullPrompt}
              </pre>
            </details>
          </div>
        )}

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