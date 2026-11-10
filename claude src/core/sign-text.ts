/** 告示牌斷行：在逗號處換行、拿掉逗號。「我是聽障者，請對著手機說話」→「我是聽障者」「請對著手機說話」 */
export const signLines = (text: string) => text.replace(/\s*[，,]\s*/g, '\n').trim();
