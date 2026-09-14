import { chatWithDeepSeek } from "./deepseek.js";
import { buildDazzjunChatMessages } from "./prompt.js";
const MAX_USER_ID_LENGTH = 128;
export const MAX_MESSAGE_LENGTH = 4_000;
const MAX_CONTEXT_LENGTH = 12_000;
function validationError(message) {
    return Object.assign(new Error(message), { status: 422 });
}
export function validateAIMessage(message) {
    if (typeof message !== "string" || !message.trim()) {
        throw validationError("请输入消息");
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
        throw validationError(`消息不能超过 ${MAX_MESSAGE_LENGTH} 个字符`);
    }
    return message.trim();
}
export async function generateAIResponse({ userId, message, context = "", apiKey, fetchImpl, endpoint, timeoutMs, retryDelayMs, }) {
    if (typeof userId !== "string" || !userId.trim() || userId.length > MAX_USER_ID_LENGTH) {
        throw validationError("用户身份无效");
    }
    const normalizedMessage = validateAIMessage(message);
    if (typeof context !== "string") {
        throw validationError("上下文格式无效");
    }
    if (context.length > MAX_CONTEXT_LENGTH) {
        throw validationError(`上下文不能超过 ${MAX_CONTEXT_LENGTH} 个字符`);
    }
    return chatWithDeepSeek({
        apiKey,
        messages: buildDazzjunChatMessages(normalizedMessage, context.trim()),
        fetchImpl,
        endpoint,
        timeoutMs,
        retryDelayMs,
    });
}
