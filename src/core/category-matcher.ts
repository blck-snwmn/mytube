import { Category, VideoInfo, CategoryMatchResult, CategoryTarget } from './types';

export class CategoryMatcher {
  constructor(private categories: Category[]) {}

  /**
   * 動画情報から該当するカテゴリを判定します
   */
  matchCategories(videoInfo: VideoInfo): CategoryMatchResult {
    const matchedCategories = this.categories.filter(category =>
      this.isVideoMatchCategory(videoInfo, category)
    );

    return {
      videoInfo,
      matchedCategories,
    };
  }

  /**
   * 動画が特定のカテゴリに該当するかを判定します
   */
  private isVideoMatchCategory(videoInfo: VideoInfo, category: Category): boolean {
    const searchTexts: string[] = [];

    // カテゴリの適用対象に応じてチェック対象のテキストを設定
    switch (category.target) {
      case 'title':
        searchTexts.push(videoInfo.title);
        if (videoInfo.description) {
          searchTexts.push(videoInfo.description);
        }
        break;
      case 'channel':
        searchTexts.push(videoInfo.channelName);
        break;
      case 'both':
        searchTexts.push(
          videoInfo.title,
          videoInfo.channelName,
          videoInfo.description || ''
        );
        break;
    }

    const searchText = searchTexts.join(' ').toLowerCase();
    return category.keywords.some(keyword =>
      searchText.includes(keyword.toLowerCase())
    );
  }

  /**
   * カテゴリを追加します
   */
  addCategory(category: Category): void {
    if (this.categories.some(c => c.id === category.id)) {
      throw new Error(`Category with id ${category.id} already exists`);
    }
    this.categories.push(category);
  }

  /**
   * カテゴリを更新します
   */
  updateCategory(category: Category): void {
    const index = this.categories.findIndex(c => c.id === category.id);
    if (index === -1) {
      throw new Error(`Category with id ${category.id} not found`);
    }
    this.categories[index] = category;
  }

  /**
   * カテゴリを削除します
   */
  removeCategory(categoryId: string): void {
    const index = this.categories.findIndex(c => c.id === categoryId);
    if (index === -1) {
      throw new Error(`Category with id ${categoryId} not found`);
    }
    this.categories.splice(index, 1);
  }

  /**
   * 全てのカテゴリを取得します
   */
  getAllCategories(): Category[] {
    return [...this.categories];
  }
}