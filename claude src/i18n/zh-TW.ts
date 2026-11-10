// 所有介面文字集中在這裡，之後可加其他語言。

export const TYPE_OPTION_LABEL = '我打字說明';

export const DEFAULT_INTRO = '我是聽障者，請對著手機說話';

/**
 * 「我的常點」預設的建議句：沒動過的櫃檯一打開就有，點一下就給店員看，不用自己打字。
 * 句子要短：協會裡有一半的人讀長句吃力（第二次訪談）。
 */
export const SUGGESTED_FAVORITES: Record<string, string[]> = {
  cvs: ['不用袋子，謝謝', '請幫我加熱'],
  drink: ['大杯，半糖少冰', '中杯，無糖去冰'],
  breakfast: ['內用，謝謝', '外帶，謝謝'],
  pharmacy: ['我要領處方箋', '請寫下怎麼吃'],
  market: ['我要一斤', '請寫價錢給我看'],
  buffet: ['白飯少一點，內用', '外帶，不要湯'],
  salon: ['修短一點就好', '不用吹整，謝謝', '剪髮時我聽不到，請用手比'],
  other: ['請寫給我', '我要這個'],
};

/** 「我的常點」刪光之後，各種櫃檯的例子 */
export const FAVORITE_EXAMPLE: Record<string, string> = {
  drink: '珍珠奶茶 大杯 半糖少冰',
  breakfast: '火腿蛋餅 加辣 內用',
  cvs: '不用袋子，我有手機條碼',
  pharmacy: '我要領慢性處方箋',
  market: '我要一斤，幫我切好',
  buffet: '白飯少一點，不要湯，內用',
  salon: '修短一點就好，不用吹整',
  other: '我要這個，謝謝',
};

/** 店員面（上半部，旋轉 180°）的文字 */
export const CLERK = {
  idleLabel: '您好',
  idleSub: '我會用螢幕回答您',
  questionLabel: '我正在看您的問題',
  questionSub: '請稍等，我選一下',
  answerLabel: '我的回答',
  againLabel: '不好意思',
  /** 聽不懂時請店員怎麼做。只說「再說一次」，店員常常照原樣再講一遍（第二次訪談） */
  again: {
    repeat: { main: '可以再說一次嗎？', sub: '請說慢一點，對著手機。謝謝您' },
    point: { main: '可以指給我看嗎？', sub: '指菜單、商品或螢幕都可以。謝謝您' },
    rephrase: { main: '可以換個說法嗎？', sub: '用簡單一點的話，或比個動作。謝謝您' },
    write: { main: '可以寫給我看嗎？', sub: '寫在紙上，或打在您的手機上。謝謝您' },
  },
  amountLabel: '金額是這樣嗎？',
  amountSub: '我確認一下',
  amountOkLabel: '金額確認',
  amountOkSub: '好的，我付款',
  amountNoLabel: '金額不對',
  amountNoMain: '可以再說一次金額嗎？',
  amountNoSub: '或請指給我看',
  typedLabel: '我想說',
  dosageLabel: '用法用量，我記下來了',
  dosageSub: '請看一下對不對',
  yuan: (n: number) => `${n} 元`,
  perJin: (n: number) => `每斤 ${n} 元`,
};
