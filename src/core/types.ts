export type CategoryTarget = 'title' | 'channel' | 'both';

export interface Category {
  id: string;
  name: string;
  keywords: string[];
  isGrayedOut: boolean;
  target: CategoryTarget;  // 追加: キーワードの適用対象
}

export interface CategorySettings {
  categories: Category[];
}

export interface VideoInfo {
  title: string;
  channelName: string;
  description?: string;
  isMembersOnly?: boolean;  // 追加: メンバーシップ配信かどうか
}

export interface CategoryMatchResult {
  videoInfo: VideoInfo;
  matchedCategories: Category[];
}