import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function GET() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        error: 'OpenAI API key not found',
        hasKey: false 
      }, { status: 500 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Simple test call
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Say 'Hello World'" }],
      max_tokens: 10,
    });

    return NextResponse.json({ 
      success: true,
      hasKey: true,
      testResponse: completion.choices[0].message.content,
      model: completion.model
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error.message,
      hasKey: !!process.env.OPENAI_API_KEY,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
} 