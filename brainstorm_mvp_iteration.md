## Problem Solved in MVP:
Automated tweet generation with good content that matches my substance and is structured with well-formed copywriting (both short and long form).

## Next MVP Iteration: Template-Enhanced Voice Projects

### Phased Development Approach

## Phase 1: Template Integration in Voice Projects
**Goal**: Add template management to existing Voice Project system
**Timeline**: 2-3 weeks

### What Gets Built:
**Voice Project Enhancement**
- Add "Tweet Templates" section to existing Voice Project interface
- Users can manually add, edit, and organize their proven tweet structures
- Template cleanup and validation before storage
- Templates stored alongside instructions and writing samples in existing `user_voice_projects` table

**Template Format**
- Simple text-based templates with placeholders (e.g., "[HOOK] → [MAIN_POINT] → [CTA]")
- User-friendly editing interface within Voice Project tabs
- Template preview showing structure before saving
- Automatic cleanup of formatting and validation

### Deliverable:
✅ **Enhanced Voice Project Setup** - Users can add and manage tweet templates alongside their voice instructions and writing samples

---

## Phase 2: Template Selection Logic
**Goal**: AI analyzes user topics and selects appropriate templates
**Timeline**: 2-3 weeks

### What Gets Built:
**Smart Template Matching**
- AI analyzes user's topic input to determine content type and style
- Matches topic characteristics with available user templates
- Selects best-fitting template from user's personal collection
- Integration with existing AI Provider Manager for template selection

**Enhanced Content Analysis**
- Extend existing content analysis to suggest template usage
- Topic complexity detection (simple vs substantial content)
- Template compatibility scoring and selection logic

### Deliverable:
✅ **Intelligent Template Selection** - System automatically chooses the best template from user's collection based on their topic

---

## Phase 3: Template-Guided Generation
**Goal**: AI generates content following selected template structure
**Timeline**: 2-3 weeks

### What Gets Built:
**Template-Aware AI Generation**
- Modify existing AI generation pipeline to use selected templates
- Combine template structure with Voice Project instructions
- Maintain user's voice while following template framework
- Template cycling to ensure variety across generations

**Enhanced Generation Modes**
- 📋 **Template Mode**: Strict adherence to selected template structure
- 🎨 **Enhanced Mode**: Template-inspired with flexibility
- ✍️ **Free Form**: Current system without templates

### Deliverable:
✅ **Template-Guided Tweet Generation** - AI creates structured content that follows user's templates while maintaining their voice

---

## Phase 4: User Experience & Optimization
**Goal**: Polish interface and add template management features
**Timeline**: 1-2 weeks

### What Gets Built:
**Enhanced User Interface**
- Template preview in AI Composer showing selected structure
- Template cycling status and variety tracking
- Template performance feedback and optimization suggestions
- Improved Voice Project template management

**Template Optimization**
- Template usage tracking and effectiveness scoring
- Suggestions for template improvements
- Template cycling logic to prevent repetition

### Deliverable:
✅ **Complete Template System** - Polished user experience with template management, selection, and optimization

---

## Technical Architecture

### Database Changes (Phase 1)
```sql
-- Extend existing user_voice_projects table
ALTER TABLE user_voice_projects 
ADD COLUMN tweet_templates TEXT[] DEFAULT '{}';

-- No separate template tables needed - everything in Voice Projects
```

### Voice Project Data Structure
```javascript
// Enhanced Voice Project includes templates
{
  instructions: "Write like me: direct, actionable...",
  writing_samples: ["Sample 1...", "Sample 2..."],
  tweet_templates: [
    "[PROBLEM_STATEMENT] → [SOLUTION] → [CALL_TO_ACTION]",
    "[QUESTION] → [ANSWER_POINTS] → [CHALLENGE]",
    "[BOLD_CLAIM] → [SUPPORTING_EVIDENCE] → [CONCLUSION]"
  ],
  is_active: true
}
```

### Processing Flow
1. **User adds templates** to Voice Project (manual curation)
2. **Template cleanup** validates and formats templates for AI use  
3. **Topic analysis** determines which template fits user's input
4. **Template selection** picks best match from user's personal collection
5. **Content generation** follows template while using Voice Project instructions

### Integration Benefits
- **Leverages existing Voice Project system** - no new infrastructure needed
- **User control** - manually curated templates ensure quality and relevance
- **Personalization** - each user's templates match their style and content needs
- **Simplicity** - templates live alongside other Voice Project customizations



Prompts to add for MVP. Ignore for now:

---
### Prompt Rules for Tweet Generation in This Chat:

**Substance vs. Structure:** Only use the provided writing samples as a way to understand the substance of your content and the words you use. My primary focus is to change the substance while strictly adhering to the chosen template's structure.
**No Template Analysis:** I will not attempt to identify, explain, or dissect the underlying copywriting templates, nor will I justify my choice of a template based on patterns or patterns from your copywriting. My task is replication of style, not analysis.

---
### Short-Form Tweet Generation:

When generating a standard (short) tweet, I will select one specific tweet from the provided list of tweet templates as the exact structural template.
**Template Source:** All structural and stylistic inspiration for tweet generation will come from the provided "list of tweet templates".
**Choose Best Available Template:** When selecting a template, I will choose the best available tweet from the "list of tweet templates" that most closely aligns with the topic's substance and tone, ensuring a natural fit.
I will then rewrite that specific tweet's content to fit your new topic, maintaining its original sentence count, approximate word count, and flow.
I will clearly list the original tweet used as the template, followed by my new tweet, and then briefly state why that specific original tweet was chosen (e.g., its conciseness, action-orientation, specific phrasing).

---
### Longform Tweet Generation:

The output will be a single, continuous tweet (not a numbered thread like "1/5, 2/5").
The total output should aim for approximately 300 words.
I will draw inspiration from the overall style, tone, and flow demonstrated across the entire list of tweet templates. This means embodying the directness, occasional contrarian views, and clear points within the longer format.
**Varying Rhetorical Structure and Flow (Anti-AI Rule):** Avoid overly symmetric or rigidly contrasting sentence structures. While antithesis and parallelisms can be effective, ensure their use feels natural and integrated into the overall flow, rather than standing out as formulaic. Mix up how ideas are presented – sometimes direct statements, sometimes questions, sometimes examples, to prevent a predictable rhythm. The goal is a more organic, human-like cadence.
I will vary sentence lengths and paragraph structures (e.g., sometimes a single sentence for a paragraph, sometimes 3-5 sentences) to enhance readability.
I will incorporate visual formatting elements like line breaks and bullet points (or similar "dots" for indentation) where helpful to make the tweet visually appealing and easy to read.
For longform tweets, I will not explicitly choose or explain a single "template tweet," as the goal is to embody the collective style across the entire output.

---
### General Rules for All Tweet Generation:

**Tweet Worthiness:** All generated output must be worthy of a tweet. I will avoid quotes or other characters that would not make sense for a direct tweet.
**Topic Word Count:** The word count of the topic provided by you is to be disregarded; only its substance is relevant for content generation.