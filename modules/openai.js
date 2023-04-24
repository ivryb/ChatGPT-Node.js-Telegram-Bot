import { Configuration, OpenAIApi } from 'openai';

const { openAiKey } = process.env;

const configuration = new Configuration({
  apiKey: openAiKey,
});

export const openai = new OpenAIApi(configuration);

export const getChatGPTResponse = async ({ userMessage, personaPrompt, savedMessages }) => {
  const messages = [
    personaPrompt ? { role: 'system', content: personaPrompt } : null,
    ...(savedMessages ?? []),
    userMessage ? { role: 'user', content: userMessage } : null
  ].filter(Boolean);

  let requestTime = Date.now();
  
  const { data } = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages 
  });
  
  return {
    responseText: data.choices[0].message.content,
    usage: data.usage,
    requestTime: Number(((Date.now() - requestTime) / 1000).toFixed(2))
  };
}