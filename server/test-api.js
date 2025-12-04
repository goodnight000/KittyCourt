require("dotenv").config();
const { createChatCompletion, isOpenRouterConfigured } = require("./src/lib/openrouter");

async function test() {
    console.log("OpenRouter configured:", isOpenRouterConfigured());
    console.log("API Key exists:", !!process.env.OPENROUTER_API_KEY);

    try {
        const response = await createChatCompletion({
            model: "x-ai/grok-4.1-fast:free",
            messages: [
                { role: "user", content: "Say hello in one word" }
            ],
            temperature: 0.7,
            maxTokens: 50
        });
        console.log("Response:", JSON.stringify(response, null, 2));
    } catch (error) {
        console.error("Error:", error.message);
    }
}

test();
