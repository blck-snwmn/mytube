import { CategoryMatcher } from '../core/category-matcher';
import { CategoryStorage } from '../core/storage';
import { Category, VideoInfo } from '../core/types';

class YouTubeContentScript {
  private categoryMatcher: CategoryMatcher | null = null;
  private readonly BADGE_STYLE = `
    .category-badge-container {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin: 4px 0;
      width: 100%;
      padding: 0 12px;
      box-sizing: border-box;
      position: relative;
      z-index: 1;
    }
    .category-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      background-color: #f0f0f0;
      font-size: 12px;
      color: #666;
      white-space: nowrap;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .members-only-container {
      border: 3px solid #2ba640 !important;
      border-radius: 8px;
      box-sizing: border-box;
    }
  `;

  constructor() {
    this.initialize();
    this.setupMessageListener();
    this.injectStyles();
  }

  private async initialize(): Promise<void> {
    const categories = await CategoryStorage.loadCategories();
    this.categoryMatcher = new CategoryMatcher(categories);
    this.setupMutationObserver();

    // 初期表示の動画を処理
    this.processCurrentVideos();
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = this.BADGE_STYLE;
    document.head.appendChild(style);
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'SETTINGS_UPDATED') {
        this.handleSettingsUpdate(message.settings);
      } else if (message.type === 'INITIALIZE') {
        this.handleInitialize(message.categories);
      }
      sendResponse({ success: true });
      return true; // 非同期レスポンスのために必要
    });
  }

  private async handleSettingsUpdate(settings: { categories: Category[] }): Promise<void> {
    this.categoryMatcher = new CategoryMatcher(settings.categories);
    this.processCurrentVideos(); // 全ての動画を再処理
  }

  private async handleInitialize(categories: Category[]): Promise<void> {
    this.categoryMatcher = new CategoryMatcher(categories);
    this.processCurrentVideos();
  }

  private setupMutationObserver(): void {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          this.processNewVideos(mutation.addedNodes);
        }
      }
    });

    // YouTube のメインコンテンツ領域を監視
    const targetNode = document.querySelector('#content');
    if (targetNode) {
      observer.observe(targetNode, {
        childList: true,
        subtree: true
      });
    }
  }

  private processCurrentVideos(): void {
    const videoElements = document.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer');
    videoElements.forEach(element => this.processVideoElement(element as HTMLElement));
  }

  private processNewVideos(nodes: NodeList): void {
    nodes.forEach(node => {
      if (node instanceof HTMLElement) {
        if (
          node.tagName.toLowerCase() === 'ytd-rich-item-renderer' ||
          node.tagName.toLowerCase() === 'ytd-video-renderer'
        ) {
          this.processVideoElement(node);
        }
      }
    });
  }

  private async processVideoElement(element: HTMLElement): Promise<void> {
    if (!this.categoryMatcher) return;

    const videoInfo = this.extractVideoInfo(element);
    if (!videoInfo) return;

    const result = this.categoryMatcher.matchCategories(videoInfo);
    this.applyStyles(element, result.matchedCategories, videoInfo.isMembersOnly || false);
  }

  private extractVideoInfo(element: HTMLElement): VideoInfo | null {
    const titleElement = element.querySelector('#video-title');
    const channelElement = element.querySelector('#channel-name a, .ytd-channel-name a');
    
    if (!titleElement || !channelElement) return null;

    // メンバーシップ限定バッジの検出
    const isMembersOnly = !!(
      element.querySelector('.badge-style-type-members-only') ||
      element.querySelector('[class*="member-only-badge"]') ||
      element.querySelector('[class*="member-only"]')
    );

    return {
      title: titleElement.textContent?.trim() || '',
      channelName: channelElement.textContent?.trim() || '',
      description: this.getVideoDescription(element),
      isMembersOnly
    };
  }

  private getVideoDescription(element: HTMLElement): string {
    const descriptionElement = element.querySelector('#description-text, #description');
    return descriptionElement?.textContent?.trim() || '';
  }

  private applyStyles(element: HTMLElement, matchedCategories: Category[], isMembersOnly: boolean): void {
    // 既存のバッジコンテナを削除
    element.querySelectorAll('.category-badge-container').forEach(container => container.remove());

    // グレーアウトが必要なカテゴリが1つでもあれば要素をグレーアウト
    const shouldGrayOut = matchedCategories.some(category => category.isGrayedOut);

    if (shouldGrayOut) {
      element.style.opacity = '0.5';
      element.style.filter = 'grayscale(100%)';
    } else {
      element.style.opacity = '';
      element.style.filter = '';
    }

    // メンバーシップ限定の場合、緑色の枠を追加
    const container = element.querySelector('#content, #dismissible') as HTMLElement;
    if (container) {
      if (isMembersOnly) {
        container.classList.add('members-only-container');
      } else {
        container.classList.remove('members-only-container');
      }
    }

    // カテゴリバッジを追加
    if (matchedCategories.length > 0) {
      // バッジの挿入位置を特定
      const metadataLine = element.querySelector('#metadata-line');
      if (!metadataLine) return;

      // バッジコンテナを作成
      const badgeContainer = document.createElement('div');
      badgeContainer.className = 'category-badge-container';

      // バッジを追加
      matchedCategories.forEach(category => {
        const badge = document.createElement('span');
        badge.className = 'category-badge';
        badge.textContent = category.name;
        badgeContainer.appendChild(badge);
      });

      // メタデータの後に挿入
      metadataLine.parentNode?.insertBefore(badgeContainer, metadataLine.nextSibling);
    }
  }
}

// content scriptの初期化
new YouTubeContentScript();