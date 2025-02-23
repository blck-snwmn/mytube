import { Category, CategoryTarget } from '../core/types';
import { CategoryStorage } from '../core/storage';

class OptionsPage {
  private categories: Category[] = [];

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.loadCategories();
    this.setupEventListeners();
  }

  private async loadCategories(): Promise<void> {
    this.categories = await CategoryStorage.loadCategories();
    this.renderCategories();
  }

  private setupEventListeners(): void {
    const form = document.getElementById('addCategoryForm') as HTMLFormElement;
    form.addEventListener('submit', (e) => this.handleAddCategory(e));
  }

  private async handleAddCategory(e: Event): Promise<void> {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    
    const nameInput = document.getElementById('categoryName') as HTMLInputElement;
    const keywordsInput = document.getElementById('keywords') as HTMLInputElement;
    const grayedOutInput = document.getElementById('isGrayedOut') as HTMLInputElement;
    const targetInput = form.querySelector('input[name="target"]:checked') as HTMLInputElement;

    const newCategory: Category = {
      id: Date.now().toString(), // 単純なユニークID生成
      name: nameInput.value,
      keywords: keywordsInput.value.split(',').map(k => k.trim()).filter(k => k),
      isGrayedOut: grayedOutInput.checked,
      target: targetInput.value as CategoryTarget
    };

    try {
      await CategoryStorage.addCategory(newCategory);
      await this.loadCategories(); // リストを更新
      form.reset();
      // デフォルトのラジオボタンを選択
      const defaultTarget = form.querySelector('input[value="title"]') as HTMLInputElement;
      if (defaultTarget) defaultTarget.checked = true;
    } catch (error) {
      alert('カテゴリの追加に失敗しました: ' + error);
    }
  }

  private renderCategories(): void {
    const container = document.getElementById('categoryList');
    if (!container) return;

    container.innerHTML = this.categories.map(category => this.createCategoryElement(category)).join('');
    
    // イベントリスナーを設定
    this.categories.forEach(category => {
      const element = document.getElementById(`category-${category.id}`);
      if (!element) return;

      // 削除ボタン
      const deleteBtn = element.querySelector('.delete-btn');
      deleteBtn?.addEventListener('click', () => this.handleDeleteCategory(category.id));

      // グレーアウトトグル
      const grayoutToggle = element.querySelector('.grayout-toggle') as HTMLInputElement;
      grayoutToggle?.addEventListener('change', (e) => this.handleToggleGrayout(category.id, (e.target as HTMLInputElement).checked));

      // 編集モード
      const editBtn = element.querySelector('.edit-btn');
      editBtn?.addEventListener('click', () => this.enableEditMode(category.id));
    });
  }

  private createCategoryElement(category: Category): string {
    const targetText = {
      'title': 'タイトル（説明文含む）',
      'channel': 'チャンネル名',
      'both': '両方'
    }[category.target];

    return `
      <div id="category-${category.id}" class="category-item">
        <div class="category-header">
          <h3>${this.escapeHtml(category.name)}</h3>
          <div>
            <button class="edit-btn">編集</button>
            <button class="delete-btn delete">削除</button>
          </div>
        </div>
        <div>適用対象: ${targetText}</div>
        <div class="keyword-list">
          ${category.keywords.map(keyword => `
            <span class="keyword-tag">${this.escapeHtml(keyword)}</span>
          `).join('')}
        </div>
        <div>
          <label>
            <input type="checkbox" class="grayout-toggle" ${category.isGrayedOut ? 'checked' : ''}>
            グレーアウトする
          </label>
        </div>
      </div>
    `;
  }

  private async handleDeleteCategory(categoryId: string): Promise<void> {
    if (!confirm('このカテゴリを削除してもよろしいですか？')) return;

    try {
      await CategoryStorage.removeCategory(categoryId);
      await this.loadCategories();
    } catch (error) {
      alert('カテゴリの削除に失敗しました: ' + error);
    }
  }

  private async handleToggleGrayout(categoryId: string, isGrayedOut: boolean): Promise<void> {
    const category = this.categories.find(c => c.id === categoryId);
    if (!category) return;

    try {
      const updatedCategory: Category = {
        ...category,
        isGrayedOut
      };
      await CategoryStorage.updateCategory(updatedCategory);
      await this.loadCategories();
    } catch (error) {
      alert('設定の更新に失敗しました: ' + error);
    }
  }

  private enableEditMode(categoryId: string): void {
    const category = this.categories.find(c => c.id === categoryId);
    if (!category) return;

    const element = document.getElementById(`category-${categoryId}`);
    if (!element) return;

    const currentHtml = element.innerHTML;
    element.innerHTML = `
      <form class="edit-form">
        <div class="form-group">
          <label>カテゴリ名</label>
          <input type="text" class="edit-name" value="${this.escapeHtml(category.name)}" required>
        </div>
        <div class="form-group">
          <label>キーワード（カンマ区切り）</label>
          <input type="text" class="edit-keywords" value="${this.escapeHtml(category.keywords.join(', '))}" required>
        </div>
        <div class="form-group">
          <label>キーワードの適用対象</label>
          <div class="radio-group">
            <label>
              <input type="radio" name="edit-target" value="title" ${category.target === 'title' ? 'checked' : ''}>
              タイトル（説明文含む）
            </label>
            <label>
              <input type="radio" name="edit-target" value="channel" ${category.target === 'channel' ? 'checked' : ''}>
              チャンネル名
            </label>
            <label>
              <input type="radio" name="edit-target" value="both" ${category.target === 'both' ? 'checked' : ''}>
              両方
            </label>
          </div>
        </div>
        <button type="submit">保存</button>
        <button type="button" class="cancel-btn">キャンセル</button>
      </form>
    `;

    const form = element.querySelector('form');
    const cancelBtn = element.querySelector('.cancel-btn');

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = element.querySelector('.edit-name') as HTMLInputElement;
      const keywordsInput = element.querySelector('.edit-keywords') as HTMLInputElement;
      const targetInput = element.querySelector('input[name="edit-target"]:checked') as HTMLInputElement;

      try {
        const updatedCategory: Category = {
          ...category,
          name: nameInput.value,
          keywords: keywordsInput.value.split(',').map(k => k.trim()).filter(k => k),
          target: targetInput.value as CategoryTarget
        };
        await CategoryStorage.updateCategory(updatedCategory);
        await this.loadCategories();
      } catch (error) {
        alert('カテゴリの更新に失敗しました: ' + error);
        element.innerHTML = currentHtml;
      }
    });

    cancelBtn?.addEventListener('click', () => {
      element.innerHTML = currentHtml;
      this.renderCategories(); // イベントリスナーを再設定
    });
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// 設定ページの初期化
new OptionsPage();