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
  generationMode?: string;
  error?: string;
}

export default function AdvancedTweetComposer({ user, onTweetAdded, onError, onSuccess }: AdvancedTweetComposerProps) {
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [templateInfo, setTemplateInfo] = useState<TweetTemplate | null>(null)
  const [templateFeedback, setTemplateFeedback] = useState<{ rating: number; templateId: string } | null>(null)

  const generateTweet = async () => {
    const isAutonomousGeneration = !prompt.trim()
    
    setIsGenerating(true)
    onError('')
    onSuccess('')
    setTemplateInfo(null)
    setTemplateFeedback(null)

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
          aiProvider: 'auto',
          contentType: 'auto',
          generationMode: 'template',  // Force Template Mode
          showDebug: false,
          autonomousGeneration: isAutonomousGeneration
        }),
      })

      const data: GenerationResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate tweet')
      }

      setPrompt(data.content)
      
      // Set template information if a template was used
      if (data.template && 'used' in data.template && data.template.used) {
        const template = data.template as TweetTemplate;
        setTemplateInfo(template)
        setTemplateFeedback({ rating: 0, templateId: template.id })
      } else {
        setTemplateInfo(null)
        setTemplateFeedback(null)
      }

      const successMessage = isAutonomousGeneration 
        ? 'Random tweet generated successfully! ✨' 
        : 'Tweet generated successfully! ✨'
      onSuccess(successMessage)
      setTimeout(() => onSuccess(''), 3000)

    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to generate tweet. Please try again.')
      console.error('Error generating tweet:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const submitTemplateFeedback = async (rating: number) => {
    if (!templateFeedback || !templateInfo) return;

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      await fetch('/api/template-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          templateId: templateInfo.id,
          rating,
          prompt: prompt.trim(),
          generatedContent: prompt.trim()
        }),
      })

      setTemplateFeedback({ ...templateFeedback, rating })
      onSuccess(`Thank you for rating the template! (${rating}/5 stars)`)
      setTimeout(() => onSuccess(''), 3000)

    } catch (error) {
      console.error('Error submitting template feedback:', error)
    }
  }

  const saveDraft = async () => {
    const contentToSave = prompt.trim()
    
    if (!contentToSave) {
      onError('No content to save as draft')
      return
    }

    setIsSaving(true)
    onError('')
    onSuccess('')

    try {
      const { error } = await supabase
        .from('tweets')
        .insert({
          user_id: user.id,
          tweet_content: contentToSave,
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
    const contentToQueue = prompt.trim()
    
    if (!contentToQueue) {
      onError('No content to add to queue')
      return
    }

    if (contentToQueue.length > 4000) {
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
          content: contentToQueue
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
          📝 Tweet Composer
        </h2>
        <p className="text-gray-600 text-sm">
          Write tweets manually, generate AI content from topics, or generate random tweets using templates that match your style
        </p>
      </div>

      <div className="space-y-4">
        {/* Content Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            💡 Tweet Content or Topic (Optional)
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your tweet content directly, or describe what you'd like to tweet about for AI generation. Leave blank for autonomous generation based on your writing style..."
            className="w-full p-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none bg-white text-gray-900 placeholder-gray-500 h-32"
            disabled={isGenerating || isSaving}
          />
          <div className="text-xs text-gray-500 mt-1">
            {prompt.length}/4000 characters
            {prompt.length > 280 && (
              <span className="ml-2 text-blue-600">
                (Long-form tweet)
              </span>
            )}
            {prompt.length > 4000 && (
              <span className="ml-2 text-red-600 font-medium">Too long!</span>
            )}
          </div>
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
              
              {/* Template Feedback */}
              {templateFeedback && templateFeedback.rating === 0 && (
                <div className="mt-3 p-2 bg-green-100 rounded">
                  <p className="text-xs text-green-800 mb-2">How well did this template work for your content?</p>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => submitTemplateFeedback(star)}
                        className="text-lg hover:text-yellow-500 transition-colors"
                      >
                        ⭐
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {templateFeedback && templateFeedback.rating > 0 && (
                <div className="mt-2 p-2 bg-green-100 rounded">
                  <p className="text-xs text-green-800">
                    You rated this template: {'⭐'.repeat(templateFeedback.rating)} ({templateFeedback.rating}/5)
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={generateTweet}
            disabled={isGenerating || isSaving}
            className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              prompt.trim() ? '🤖 Generating...' : '🤖 Generating Random Tweet...'
            ) : (
              prompt.trim() ? '🤖 Generate AI Tweet' : '🤖 Generate Random Tweet'
            )}
          </button>
          
          <button
            onClick={saveDraft}
            disabled={isSaving || isGenerating || !prompt.trim()}
            className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? '💾 Saving...' : '💾 Save Draft'}
          </button>
          
          <button
            onClick={addToQueue}
            disabled={isSaving || isGenerating || !prompt.trim() || prompt.length > 4000}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? '📅 Adding...' : '📅 Add to Queue'}
          </button>
        </div>
      </div>
    </div>
  )
} 