# Next Iteration Features

## 1. Custom Prompt Mode
- **New Mode**: Generate tweets using only the user's custom prompt (no template matching)
- **AI Provider**: Use Grok for generation
- **Output Options**: 
  - Short form: Under 280 characters
  - Long form: 500-900 characters
- **Requirements**: Must include anti-AI rules to sound natural and human

## 2. Drag & Drop Queue Management
- **Feature**: Rearrange scheduled tweet slots by dragging and dropping tweet cards
- **Benefit**: Users can easily reorder their queue timing

## 3. Topic-Based Tweet Generation
- **New Mode**: Generate tweets from pre-defined topics (no user prompt needed)
- **Topic Database**: 
  - Generate 300 universal topic ideas
  - Store in Supabase for reference
  - Cycle through topics in order, then repeat
- **Content Style**: Draw inspiration from user's writing samples to maintain voice consistency
- **Output Options**: Same short/long form choices as custom prompt mode
- **Benefit**: Prevents repetitive content while maintaining user's unique voice

## 4. Quality Assurance & Validation
- **Character Count Validation**: 
  - Short form: Strict 280 character limit with real-time counter
  - Long form: 500-900 character range with visual indicators
- **Content Quality Checks**:
  - Remove AI-sounding phrases and patterns
  - Ensure natural, human-like language
  - Check for proper grammar and readability
- **Preview System**:
  - Show exactly how tweet will appear on Twitter
  - Include character count, line breaks, and formatting
  - Preview both desktop and mobile layouts
- **Style Consistency**:
  - Validate against user's writing samples
  - Flag tweets that don't match established voice
  - Suggest improvements to maintain consistency
- **Error Handling**:
  - Graceful fallbacks if generation fails
  - Clear error messages with actionable next steps
  - Retry mechanism with different parameters
- **Final Review**:
  - Mandatory preview before adding to queue
  - Option to regenerate if not satisfied
  - Quick edit functionality for minor tweaks

## 5. Cycling Visibility & Tracking
- **Template Usage Tracking**:
  - Visual display in Voice Project tab showing used tweet templates
  - Timeline view of template cycling order
  - Indicators for which templates are next in rotation
  - Reset option to start cycling from beginning
- **Universal Topics Tracking**:
  - Complete list of 300 universal topics in Voice Project tab
  - Visual indicators showing which topics have been used
  - Progress bar showing completion percentage of topic cycle
  - Topic queue preview showing upcoming topics
- **Cycling Analytics**:
  - Statistics on template and topic usage patterns
  - Ensure proper cycling is happening as expected
  - Identify any skipped or repeated items
  - Export/import functionality for topic lists
- **Visual Indicators**:
  - Color coding for used vs. unused templates/topics
  - Timestamps for when each was last used
  - Clear visual progress through the cycling system

## Implementation Notes
- Both new modes should share the same short/long form UI components
- Topic generation should prevent tweets from sounding repetitive
- All modes should maintain the user's writing style and voice
- Quality assurance should be built into every step of the generation process
- Cycling visibility should be integrated into the existing Voice Project tab interface 