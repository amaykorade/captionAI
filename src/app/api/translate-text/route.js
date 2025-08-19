import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request) {
  try {
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not found in environment variables');
      return NextResponse.json({ 
        error: 'OpenAI API key not configured. Please check your environment variables.' 
      }, { status: 500 });
    }

    const { text, targetLanguage, sourceLanguage = 'english' } = await request.json();
    
    if (!text) {
      return NextResponse.json({ error: 'Text to translate is required' }, { status: 400 });
    }

    if (!targetLanguage) {
      return NextResponse.json({ error: 'Target language is required' }, { status: 400 });
    }

    console.log('Translating text...');
    console.log('Source language:', sourceLanguage);
    console.log('Target language:', targetLanguage);
    console.log('Text length:', text.length, 'characters');

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Craft the translation prompt for preserving nuance
    const translationPrompt = `Translate this transcript into ${targetLanguage}, keeping slang, humor, tone, and cultural nuance intact.

Original Text (${sourceLanguage}):
${text}

Instructions:
- Translate to ${targetLanguage}
- Preserve all slang, informal language, and cultural references
- Maintain the original humor and tone
- Keep it natural and conversational in ${targetLanguage}
- Adapt cultural references appropriately for ${targetLanguage} speakers
- Ensure the translation sounds natural to native ${targetLanguage} speakers
- Preserve any jokes, puns, or wordplay if possible

Translated Text (${targetLanguage}):`;

    console.log('Sending to ChatGPT for translation...');

    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        console.log('ChatGPT translation request timeout reached');
        reject(new Error('ChatGPT translation request timeout after 2 minutes'));
      }, 120000); // 2 minutes timeout for translation
    });

    // Get translated text from ChatGPT with timeout
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini", // Using GPT-4o-mini for cost efficiency
        messages: [
          {
            role: "system",
            content: `You are a professional translator specializing in preserving nuance, humor, and cultural context. Your job is to translate content while maintaining the creator's authentic voice and style in the target language. Always consider cultural differences and adapt appropriately.`
          },
          {
            role: "user",
            content: translationPrompt
          }
        ],
        max_tokens: 3000, // Higher limit for translations
        temperature: 0.2 // Lower temperature for more consistent translations
      }),
      timeoutPromise
    ]);

    const translatedText = completion.choices[0].message.content.trim();

    console.log('Translation completed');
    console.log('Translated text length:', translatedText.length, 'characters');

    return NextResponse.json({
      success: true,
      originalText: text,
      translatedText: translatedText,
      sourceLanguage: sourceLanguage,
      targetLanguage: targetLanguage,
      metadata: {
        originalLength: text.length,
        translatedLength: translatedText.length,
        model: "gpt-4o-mini"
      }
    });

  } catch (error) {
    console.error('Error in translation API:', error);
    
    if (error.status === 401) {
      return NextResponse.json({ 
        error: 'Invalid API key. Please check your OpenAI API key.' 
      }, { status: 401 });
    }
    
    if (error.status === 429) {
      return NextResponse.json({ 
        error: 'Rate limit exceeded. Please try again later.' 
      }, { status: 429 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to translate text: ' + error.message 
    }, { status: 500 });
  }
} 