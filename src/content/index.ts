import { CategoryMatcher } from '../core/category-matcher';
import { CategoryStorage } from '../core/storage';
import { Category, VideoInfo } from '../core/types';

class YouTubeContentScript {
  private categoryMatcher: CategoryMatcher | null = null;
  private observer: MutationObserver | null = null;
  private mainContentObserver: MutationObserver | null = null;
  private bodyObserver: MutationObserver | null = null;
  private isInitialized = false;
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
    try {
      const categories = await CategoryStorage.loadCategories();
      this.categoryMatcher = new CategoryMatcher(categories);
      this.setupObservers();
      this.isInitialized = true;

      // 初期表示の動画を処理
      this.processCurrentVideos();
    } catch (error) {
      console.error('Failed to initialize YouTubeContentScript:', error);
    }
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

  private setupObservers(): void {
    this.disconnectAllObservers();

    // メインのコンテンツコンテナを監視
    this.setupMainContentObserver();
    // 動画リストコンテナを監視
    this.setupVideoListObserver();

    // DOMの変更を監視して新しいコンテナが追加されたら監視を設定
    this.bodyObserver = new MutationObserver(() => {
      if (this.isInitialized) {
        this.setupVideoListObserver();
      }
    });

    this.bodyObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private disconnectAllObservers(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.mainContentObserver) {
      this.mainContentObserver.disconnect();
      this.mainContentObserver = null;
    }
    if (this.bodyObserver) {
      this.bodyObserver.disconnect();
      this.bodyObserver = null;
    }
  }

  private setupMainContentObserver(): void {
    if (this.mainContentObserver) {
      this.mainContentObserver.disconnect();
      this.mainContentObserver = null;
    }

    const mainContent = document.querySelector('ytd-page-manager');
    if (!mainContent) return;

    this.mainContentObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // メインコンテンツの変更を検出したら、少し待ってから処理を実行
          setTimeout(() => {
            if (this.isInitialized) {
              this.cleanupAllBadges();
              this.processCurrentVideos();
              // 動画リストの監視を再設定
              this.setupVideoListObserver();
            }
          }, 100);
        }
      }
    });

    this.mainContentObserver.observe(mainContent, {
      childList: true,
      subtree: true
    });
  }

  private setupVideoListObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    this.observer = new MutationObserver((mutations) => {
      if (!this.isInitialized) return;

      let hasRelevantChanges = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // 新しい動画要素が追加された場合
          const addedVideos = Array.from(mutation.addedNodes)
            .filter(node => node instanceof HTMLElement &&
              (node.tagName.toLowerCase() === 'ytd-rich-item-renderer' ||
               node.tagName.toLowerCase() === 'ytd-video-renderer'));

          if (addedVideos.length > 0) {
            hasRelevantChanges = true;
            addedVideos.forEach(video => this.processVideoElement(video as HTMLElement));
          }
        } else if (mutation.type === 'attributes' && 
                  mutation.target instanceof HTMLElement &&
                  mutation.attributeName === 'hidden') {
          // hidden属性の変更を検出した場合
          hasRelevantChanges = true;
        }
      }

      // 関連する変更があった場合、全体を再処理
      if (hasRelevantChanges) {
        // 少し待ってから処理を実行（DOMの更新が完了するのを待つ）
        setTimeout(() => {
          this.cleanupAllBadges();
          this.processCurrentVideos();
        }, 50);
      }
    });

    // 動画リストコンテナを監視
    const videoContainers = document.querySelectorAll([
      'ytd-rich-grid-renderer',
      'ytd-rich-grid-row',
      'ytd-shelf-renderer',
      'ytd-watch-next-secondary-results-renderer',
      'ytd-two-column-browse-results-renderer'
    ].join(','));

    videoContainers.forEach(container => {
      if (container && this.observer) {
        this.observer.observe(container, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['hidden'] // hidden属性の変更も監視
        });
      }
    });
  }

  private cleanupAllBadges(): void {
    document.querySelectorAll('.category-badge-container').forEach(badge => badge.remove());
    document.querySelectorAll('.members-only-container').forEach(element => {
      element.classList.remove('members-only-container');
    });
    // スタイルもリセット
    document.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer').forEach(element => {
      if (element instanceof HTMLElement) {
        element.style.opacity = '';
        element.style.filter = '';
      }
    });
  }

  private processCurrentVideos(): void {
    if (!this.isInitialized) return;

    const videoElements = document.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer');
    videoElements.forEach(element => this.processVideoElement(element as HTMLElement));
  }

  private async processVideoElement(element: HTMLElement): Promise<void> {
    if (!this.categoryMatcher || !this.isInitialized) return;

    // 既存のバッジを削除
    element.querySelectorAll('.category-badge-container').forEach(badge => badge.remove());

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
    const container = element.querySelector('#content, #dismissible');
    if (container instanceof HTMLElement) {
      if (isMembersOnly) {
        container.classList.add('members-only-container');
      } else {
        container.classList.remove('members-only-container');
      }
    }

    // カテゴリバッジを追加
    if (matchedCategories.length > 0) {
      const metadataLine = element.querySelector('#metadata-line');
      if (metadataLine?.parentNode) {
        const badgeContainer = document.createElement('div');
        badgeContainer.className = 'category-badge-container';
        matchedCategories.forEach(category => {
          const badge = document.createElement('span');
          badge.className = 'category-badge';
          badge.textContent = category.name;
          badgeContainer.appendChild(badge);
        });
        metadataLine.parentNode.insertBefore(badgeContainer, metadataLine.nextSibling);
      }
    }
  }
}

// content scriptの初期化
new YouTubeContentScript();