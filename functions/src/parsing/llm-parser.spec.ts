const mockCreate = jest.fn();

jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
delete process.env.OPENROUTER_MODEL;

const { parseDatesWithLLM } = require('./llm-parser');

describe('parseDatesWithLLM', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('uses GPT-5.6 Luna by default and preserves every returned date', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            title: 'Available Dates',
            available_dates: ['2026-09-12', '2026-09-14', '2026-09-16'],
          }),
        },
      }],
    });

    const result = await parseDatesWithLLM('September 12, 14, and 16', false, 'Europe/Zurich');

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'openai/gpt-5.6-luna',
    }));
    expect(result.dates.map((date: { originalText: string }) => date.originalText)).toEqual([
      '2026-09-12',
      '2026-09-14',
      '2026-09-16',
    ]);
  });
});
