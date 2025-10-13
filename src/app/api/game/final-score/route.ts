import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    const { question, answer, followUpQuestions, followUpAnswers, topicName } = await req.json();

    if (!question || !answer || !followUpQuestions || !followUpAnswers) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
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

    const followUpContext = followUpQuestions.map((fq: any, idx: number) => 
      `Follow-up ${idx + 1}: ${fq.question}\nCandidate's Answer: ${followUpAnswers[idx] || '(No answer)'}`
    ).join('\n\n');

    const prompt = `You are an expert evaluator in complexity science and emergence theory. Provide an objective, multi-dimensional assessment of the candidate's complete performance.

Topic: ${topicName}
Original Question: ${question}

Original Answer:
${answer}

${followUpContext}

Evaluate based on the following four dimensions (25 points each):

1. Conceptual Accuracy: Correctness and precision of concepts and terminology
2. Argument Structure: Logic, organization, and completeness of response
3. Examples & Applications: Ability to provide relevant examples or real-world applications
4. Follow-up Response Quality: Understanding and quality of responses to follow-up questions

Return in JSON format:
{
  "dimensions": [
    {
      "name": "Conceptual Accuracy",
      "score": 20,
      "maxScore": 25,
      "feedback": "Specific feedback"
    },
    // ... other dimensions
  ],
  "totalScore": 85,
  "totalMaxScore": 100,
  "overallFeedback": "Overall feedback and suggestions (3-4 sentences)",
  "highlights": "Performance highlights",
  "improvements": "Areas for improvement"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a fair and professional evaluator who can objectively assess a candidate\'s understanding and communication abilities in complexity science and emergence theory.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    return NextResponse.json(result);
  } catch (error) {
    console.error('Final score error:', error);
    return NextResponse.json(
      { error: 'Failed to generate final score', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

