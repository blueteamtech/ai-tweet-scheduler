import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Template Cycling Debug called');
    
    const { user, error: authError } = await getUserFromRequest(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Load user's voice project
    const { data: voiceProject } = await supabase
      .from('user_voice_projects')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();
    
    if (!voiceProject) {
      return NextResponse.json({
        error: 'No active voice project found',
        debug: { hasVoiceProject: false }
      })
    }

    // Load ALL templates (not just active ones) to see full cycling picture
    const { data: allTemplates } = await supabase
      .from('tweet_templates')
      .select('*')
      .eq('voice_project_id', voiceProject.id)
      .order('usage_count', { ascending: true }); // Same order as the real system

    if (!allTemplates || allTemplates.length === 0) {
      return NextResponse.json({
        error: 'No templates found',
        debug: { 
          hasVoiceProject: true,
          totalTemplates: 0,
          activeTemplates: 0
        }
      })
    }

    // Separate active and inactive templates
    const activeTemplates = allTemplates.filter(t => t.is_active);
    const inactiveTemplates = allTemplates.filter(t => !t.is_active);

    // Get cycling analysis
    const usageCounts = activeTemplates.map(t => t.usage_count);
    const minUsage = Math.min(...usageCounts);
    const maxUsage = Math.max(...usageCounts);
    const avgUsage = usageCounts.reduce((sum, count) => sum + count, 0) / usageCounts.length;

    // Find templates that would be in the next selection pool (top 15 least used active templates)
    const selectionPool = activeTemplates.slice(0, Math.min(15, activeTemplates.length));
    
    // Group templates by usage count for analysis
    const usageGroups = activeTemplates.reduce((groups, template) => {
      const count = template.usage_count;
      if (!groups[count]) {
        groups[count] = [];
      }
      groups[count].push(template);
      return groups;
    }, {} as Record<number, TweetTemplate[]>);

    // Find least and most used templates
    const leastUsedTemplates = activeTemplates.filter(t => t.usage_count === minUsage);
    const mostUsedTemplates = activeTemplates.filter(t => t.usage_count === maxUsage);

    // Calculate cycling health metrics
    const usageSpread = maxUsage - minUsage;
    const cyclingHealth = usageSpread <= 2 ? 'excellent' : 
                         usageSpread <= 5 ? 'good' : 
                         usageSpread <= 10 ? 'fair' : 'needs_attention';

    // Get recent usage pattern (last 10 uses)
    const recentUsage = activeTemplates
      .filter(t => t.last_used_at)
      .sort((a, b) => new Date(b.last_used_at!).getTime() - new Date(a.last_used_at!).getTime())
      .slice(0, 10);

    // Predict next templates likely to be selected (least used)
    const nextCandidates = activeTemplates
      .filter(t => t.usage_count === minUsage)
      .slice(0, 5);

    return NextResponse.json({
      debug: {
        voiceProject: {
          id: voiceProject.id,
          hasTemplates: true
        },
        templateStats: {
          totalTemplates: allTemplates.length,
          activeTemplates: activeTemplates.length,
          inactiveTemplates: inactiveTemplates.length,
          selectionPoolSize: selectionPool.length
        },
        usageAnalysis: {
          minUsage,
          maxUsage,
          avgUsage: Math.round(avgUsage * 10) / 10,
          usageSpread,
          cyclingHealth,
                     usageGroups: Object.entries(usageGroups).map(([count, templates]) => ({
             usageCount: parseInt(count),
             templateCount: (templates as TweetTemplate[]).length,
             templates: (templates as TweetTemplate[]).map(t => ({
              id: t.id,
              content: t.template_content.substring(0, 60) + (t.template_content.length > 60 ? '...' : ''),
              category: t.category,
              lastUsed: t.last_used_at
            }))
          })).sort((a, b) => a.usageCount - b.usageCount)
        },
        selectionPool: selectionPool.map(t => ({
          id: t.id,
          content: t.template_content.substring(0, 80) + (t.template_content.length > 80 ? '...' : ''),
          category: t.category,
          tone: t.tone,
          usageCount: t.usage_count,
          lastUsed: t.last_used_at,
          effectivenessScore: t.effectiveness_score
        })),
        cyclingInsights: {
          leastUsed: leastUsedTemplates.map(t => ({
            id: t.id,
            content: t.template_content.substring(0, 60) + (t.template_content.length > 60 ? '...' : ''),
            category: t.category,
            usageCount: t.usage_count,
            lastUsed: t.last_used_at
          })),
          mostUsed: mostUsedTemplates.map(t => ({
            id: t.id,
            content: t.template_content.substring(0, 60) + (t.template_content.length > 60 ? '...' : ''),
            category: t.category,
            usageCount: t.usage_count,
            lastUsed: t.last_used_at
          })),
          nextCandidates: nextCandidates.map(t => ({
            id: t.id,
            content: t.template_content.substring(0, 60) + (t.template_content.length > 60 ? '...' : ''),
            category: t.category,
            usageCount: t.usage_count,
            lastUsed: t.last_used_at
          })),
          recentUsage: recentUsage.map(t => ({
            id: t.id,
            content: t.template_content.substring(0, 50) + (t.template_content.length > 50 ? '...' : ''),
            category: t.category,
            usageCount: t.usage_count,
            lastUsed: t.last_used_at,
            daysAgo: Math.floor((Date.now() - new Date(t.last_used_at!).getTime()) / (1000 * 60 * 60 * 24))
          }))
        },
        cyclingExplanation: {
          howItWorks: [
            "1. Templates are loaded ordered by usage_count (ascending = least used first)",
            "2. Only the 15 least-used active templates are offered to AI for selection",
            "3. When a template is selected, its usage_count increments by 1",
            "4. Higher usage templates move to the back of the queue automatically",
            "5. This ensures variety and prevents template repetition"
          ],
          healthMetrics: {
            excellent: "Usage spread ≤ 2 (all templates used evenly)",
            good: "Usage spread ≤ 5 (most templates used fairly)",
            fair: "Usage spread ≤ 10 (some imbalance, but cycling working)",
            needs_attention: "Usage spread > 10 (significant imbalance detected)"
          },
          currentHealth: cyclingHealth,
          recommendations: cyclingHealth === 'needs_attention' ? [
            "Consider reviewing template effectiveness scores",
            "Some templates may be consistently preferred by AI",
            "Check if certain categories or tones are overrepresented in selection pool"
          ] : cyclingHealth === 'fair' ? [
            "Cycling is working but some templates are more popular",
            "This is normal as AI selects based on topic relevance",
            "Continue monitoring for patterns"
          ] : [
            "Template cycling is working excellently!",
            "All templates are being used fairly evenly",
            "The variety system is functioning as designed"
          ]
        }
      }
    })

  } catch (error) {
    console.error('Error in template cycling debug:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: null
    }, { status: 500 })
  }
} 