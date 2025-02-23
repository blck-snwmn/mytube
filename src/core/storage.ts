import { Category, CategorySettings } from './types';

export class CategoryStorage {
  private static readonly STORAGE_KEY = 'category_settings';

  /**
   * カテゴリ設定を保存します
   */
  static async saveCategories(categories: Category[]): Promise<void> {
    const settings: CategorySettings = { categories };
    await chrome.storage.sync.set({ [this.STORAGE_KEY]: settings });
  }

  /**
   * カテゴリ設定を読み込みます
   */
  static async loadCategories(): Promise<Category[]> {
    const result = await chrome.storage.sync.get(this.STORAGE_KEY);
    const settings = result[this.STORAGE_KEY] as CategorySettings | undefined;
    return settings?.categories || [];
  }

  /**
   * カテゴリを追加します
   */
  static async addCategory(category: Category): Promise<void> {
    const categories = await this.loadCategories();
    if (categories.some(c => c.id === category.id)) {
      throw new Error(`Category with id ${category.id} already exists`);
    }
    categories.push(category);
    await this.saveCategories(categories);
  }

  /**
   * カテゴリを更新します
   */
  static async updateCategory(category: Category): Promise<void> {
    const categories = await this.loadCategories();
    const index = categories.findIndex(c => c.id === category.id);
    if (index === -1) {
      throw new Error(`Category with id ${category.id} not found`);
    }
    categories[index] = category;
    await this.saveCategories(categories);
  }

  /**
   * カテゴリを削除します
   */
  static async removeCategory(categoryId: string): Promise<void> {
    const categories = await this.loadCategories();
    const index = categories.findIndex(c => c.id === categoryId);
    if (index === -1) {
      throw new Error(`Category with id ${categoryId} not found`);
    }
    categories.splice(index, 1);
    await this.saveCategories(categories);
  }
}