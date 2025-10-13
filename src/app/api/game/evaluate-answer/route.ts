import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    const { question, answer, topicName } = await req.json();

    if (!question || !answer) {
      return NextResponse.json(
        { error: 'Missing required parameters: question and answer' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `You are a rigorous but supportive examiner in complexity science and emergence theory. The candidate just provided an oral response to the following question:

Topic: ${topicName}
Question: ${question}

Candidate's Answer:
${answer}

As the examiner, analyze this answer and:
1. Identify strengths and areas for improvement
2. Based on gaps, ambiguities, or underdeveloped points in the answer, formulate EXACTLY ONE sharp but fair follow-up question
3. Question should test genuine understanding, not trick the candidate
4. Question should be concise and suitable for oral response (within 30 seconds)

Return in JSON format:
{
  "analysis": "Brief analysis of the answer (2-3 sentences)",
  "followUpQuestions": [
    {
      "question": "Follow-up question content",
      "purpose": "What this question aims to test"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert examiner in complexity science and emergence theory, skilled at using follow-up questions to probe deeper understanding.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    return NextResponse.json(result);
  } catch (error) {
    console.error('Answer evaluation error:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate answer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

