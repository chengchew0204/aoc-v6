import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import questionsDb from '@/data/questions-database.json';

export async function POST(req: NextRequest) {
  try {
    const { difficulty = 'medium' } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Randomly select a topic
    const topic = questionsDb.topics[Math.floor(Math.random() * questionsDb.topics.length)];

    const prompt = `You are an expert educator and interviewer specializing in complexity science and emergence theory. Generate a concise, open-ended discussion question based on the following topic from the Glossary of Emergence.

Topic: ${topic.name}
Description: ${topic.description}
Keywords: ${topic.keywords.join(', ')}
Difficulty: ${difficulty}

Requirements:
1. Keep the question SHORT (maximum 2-3 sentences) and GENERAL
2. Ask about relationships between concepts or real-world applications
3. Should be answerable in 90 seconds without requiring extensive background
4. Use clear, accessible language - avoid overly technical jargon
5. Focus on ONE main concept or comparison, not multiple ideas
6. Make it thought-provoking but not overwhelming

Return in JSON format:
{
  "question": "The question content (SHORT and GENERAL)",
  "context": ""
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert interviewer specializing in complexity science, emergence theory, and systems thinking. You excel at designing thought-provoking scenario-based questions.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    return NextResponse.json({
      id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      topic: topic.id,
      topicName: topic.name,
      content: result.question,
      context: result.context,
      difficulty,
    });
  } catch (error) {
    console.error('Question generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate question', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

