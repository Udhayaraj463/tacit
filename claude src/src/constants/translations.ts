export interface AppUIText {
  clerkViewTag: string;
  waitingClerk: string;
  listeningActive: string;
  listeningInactive: string;
  heardClerkLabel: string;
  clerkViewFlipHint: string;
  myLanguageBtn: string;
  settingsTitle: string;
  userLangLabel: string;
  clerkLangLabel: string;
  closeBtn: string;
  amountLabel: string;
}

export const UI_TRANSLATIONS: Record<string, AppUIText> = {
  'en-US': {
    clerkViewTag: '[ CLERK VIEW / FACING OPPOSITE ]',
    waitingClerk: 'Waiting for staff to speak...',
    listeningActive: '🔴 Listening to staff...',
    listeningInactive: '🎙️ Tap to Start Listening',
    heardClerkLabel: 'Staff said:',
    clerkViewFlipHint: 'Facing staff (180°):',
    myLanguageBtn: '⚙️ Languages',
    settingsTitle: 'Language Preferences',
    userLangLabel: 'My Preferred Language (UI & Cards):',
    clerkLangLabel: 'Staff Listening Language (Input):',
    closeBtn: 'Save & Close',
    amountLabel: 'Total Due:'
  },
  'zh-TW': {
    clerkViewTag: '[ 店員視角 / 朝向對面 ]',
    waitingClerk: '等待店員詢問中...',
    listeningActive: '🔴 正在聆聽店員說話...',
    listeningInactive: '🎙️ 點擊開始即時收音',
    heardClerkLabel: '店員剛才說：',
    clerkViewFlipHint: '朝向店員 (翻轉180°):',
    myLanguageBtn: '⚙️ 語言設定',
    settingsTitle: '雙向語言偏好設定',
    userLangLabel: '我的介面與回答語言：',
    clerkLangLabel: '店員說話語言 (聽取音訊)：',
    closeBtn: '完成儲存',
    amountLabel: '應付金額：'
  },
  'ja-JP': {
    clerkViewTag: '[ 店員側画面 / 反対側向き ]',
    waitingClerk: '店員の声を待っています...',
    listeningActive: '🔴 音声を認識中...',
    listeningInactive: '🎙️ 音声聞き取りを開始',
    heardClerkLabel: '店員の発言：',
    clerkViewFlipHint: '店員向き (180度反転):',
    myLanguageBtn: '⚙️ 言語設定',
    settingsTitle: '言語ペア設定',
    userLangLabel: '自分の表示言語：',
    clerkLangLabel: '店員の言語 (聞き取り)：',
    closeBtn: '保存して閉じる',
    amountLabel: 'お会計：'
  },
  'ta-IN': {
    clerkViewTag: '[ ஊழியர் பார்வை / எதிரே ]',
    waitingClerk: 'ஊழியர் பேச காத்திருக்கிறது...',
    listeningActive: '🔴 கேட்கிறது...',
    listeningInactive: '🎙️ பேசத் தொடங்குங்கள்',
    heardClerkLabel: 'ஊழியர் கூறியது:',
    clerkViewFlipHint: 'ஊழியருக்கு காட்டப்படுவது (180°):',
    myLanguageBtn: '⚙️ மொழிகள்',
    settingsTitle: 'மொழி விருப்பங்கள்',
    userLangLabel: 'என் மொழி (UI மற்றும் அட்டைகள்):',
    clerkLangLabel: 'ஊழியர் பேசும் மொழி (உள்ளீடு):',
    closeBtn: 'சேமித்து மூடு',
    amountLabel: 'தொகை:'
  },
  'es-ES': {
    clerkViewTag: '[ VISTA DEL EMPLEADO / ENFRENTE ]',
    waitingClerk: 'Esperando al personal...',
    listeningActive: '🔴 Escuchando al personal...',
    listeningInactive: '🎙️ Iniciar Escucha',
    heardClerkLabel: 'El personal dijo:',
    clerkViewFlipHint: 'Hacia el empleado (180°):',
    myLanguageBtn: '⚙️ Idiomas',
    settingsTitle: 'Ajustes de Idioma',
    userLangLabel: 'Mi idioma preferido:',
    clerkLangLabel: 'Idioma del empleado:',
    closeBtn: 'Guardar y Cerrar',
    amountLabel: 'Total a pagar:'
  },
  'ko-KR': {
    clerkViewTag: '[ 점원 화면 / 반대 방향 ]',
    waitingClerk: '직원의 말을 기다리는 중...',
    listeningActive: '🔴 직원 음성 듣는 중...',
    listeningInactive: '🎙️ 실시간 청취 시작',
    heardClerkLabel: '직원이 말한 내용:',
    clerkViewFlipHint: '직원 방향 (180도 회전):',
    myLanguageBtn: '⚙️ 언어 설정',
    settingsTitle: '언어 환경설정',
    userLangLabel: '내 표시 및 응답 언어:',
    clerkLangLabel: '직원 음성 인식 언어:',
    closeBtn: '저장 후 닫기',
    amountLabel: '결제 금액:'
  }
};