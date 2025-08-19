import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { authenticateUser } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Project from '@/models/Project';

export async function POST(request) {
  try {
    // Authenticate user
    const authResult = await authenticateUser(request);
    
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ 
        error: 'Authentication required' 
      }, { status: 401 });
    }
    
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not found in environment variables');
      return NextResponse.json({ 
        error: 'OpenAI API key not configured. Please check your environment variables.' 
      }, { status: 500 });
    }

    const { rawText, language = 'english' } = await request.json();
    
    if (!rawText) {
      return NextResponse.json({ error: 'Raw text is required' }, { status: 400 });
    }

    console.log('Enhancing transcription text...');
    console.log('Text length:', rawText.length, 'characters');
    console.log('Language:', language);

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Craft the prompt for preserving nuance
    const enhancementPrompt = `Rewrite this transcript preserving slang, cultural nuance, humor, tone, and meaning. Do not make it formal unless needed.

Raw Transcript:
${rawText}

Instructions:
- Keep the original meaning and context
- Preserve slang, informal language, and cultural references
- Maintain humor and tone
- Keep it natural and conversational
- Only make it formal if the original content requires it
- Ensure readability while maintaining authenticity

Enhanced Transcript:`;

    console.log('Sending to ChatGPT for enhancement...');

    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        console.log('ChatGPT API request timeout reached');
        reject(new Error('ChatGPT API request timeout after 1 minute'));
      }, 60000); // 1 minute timeout
    });

    // Get enhanced text from ChatGPT with timeout
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini", // Using GPT-4o-mini for cost efficiency
        messages: [
          {
            role: "system",
            content: "You are a transcription enhancement expert. Your job is to rewrite transcripts while preserving all nuance, slang, cultural references, humor, and tone. Make the text more readable and natural while keeping the creator's authentic voice."
          },
          {
            role: "user",
            content: enhancementPrompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.3 // Lower temperature for more consistent results
      }),
      timeoutPromise
    ]);

    const enhancedText = completion.choices[0].message.content.trim();

    console.log('Text enhancement completed');
    console.log('Enhanced text length:', enhancedText.length, 'characters');

    // Update project in database with enhanced text
    let updatedProject = null;
    if (request.headers.get('x-project-id')) {
      try {
        await connectDB();
        
        const projectId = request.headers.get('x-project-id');
        
        // Update project and ensure user owns it
        updatedProject = await Project.findOneAndUpdate(
          {
            _id: projectId,
            userId: authResult.userId // Ensure user owns the project
          },
          {
            'transcription.enhancedText': enhancedText,
            updatedAt: new Date()
          },
          { new: true }
        );
        
        if (updatedProject) {
          console.log('Project updated with enhanced text:', projectId);
        } else {
          console.log('Project not found or access denied for user:', authResult.userId);
        }
        
      } catch (dbError) {
        console.error('Failed to update project with enhanced text:', dbError);
        // Don't fail the enhancement if database update fails
      }
    }

    return NextResponse.json({
      success: true,
      rawText: rawText,
      enhancedText: enhancedText,
      metadata: {
        originalLength: rawText.length,
        enhancedLength: enhancedText.length,
        language: language,
        model: "gpt-4o-mini"
      },
      projectId: updatedProject?._id || null
    });

  } catch (error) {
    console.error('Error in text enhancement API:', error);
    
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
      error: 'Failed to enhance text: ' + error.message 
    }, { status: 500 });
  }
} 