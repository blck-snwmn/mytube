import { CategoryStorage } from '../core/storage';

// 設定が変更された際のイベントリスナー
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace !== 'sync') return;

  // カテゴリ設定の変更を検知
  if (changes.category_settings) {
    // 全てのYouTubeタブにメッセージを送信
    const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
    
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SETTINGS_UPDATED',
          settings: changes.category_settings.newValue
        });
      }
    });
  }
});

// 新しいYouTubeタブが開かれた時の初期化
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (
    changeInfo.status === 'complete' &&
    tab.url?.includes('youtube.com')
  ) {
    // 現在の設定を送信
    const categories = await CategoryStorage.loadCategories();
    chrome.tabs.sendMessage(tabId, {
      type: 'INITIALIZE',
      categories
    });
  }
});