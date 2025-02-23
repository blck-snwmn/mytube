import { describe, it, expect } from 'vitest';
import { CategoryMatcher } from '../src/core/category-matcher';
import { Category, VideoInfo } from '../src/core/types';

describe('CategoryMatcher', () => {
  const sampleCategories: Category[] = [
    {
      id: '1',
      name: 'ゲーム',
      keywords: ['ゲーム実況', 'プレイ動画', 'gaming'],
      isGrayedOut: true,
      target: 'both'
    },
    {
      id: '2',
      name: '料理',
      keywords: ['レシピ', '料理', 'cooking'],
      isGrayedOut: false,
      target: 'title'
    },
    {
      id: '3',
      name: 'ゲームチャンネル',
      keywords: ['Gaming Channel'],
      isGrayedOut: true,
      target: 'channel'
    }
  ];

  describe('matchCategories', () => {
    it('タイトルに含まれるキーワードでカテゴリにマッチする（target: title）', () => {
      const matcher = new CategoryMatcher(sampleCategories);
      const video: VideoInfo = {
        title: '簡単レシピを紹介',
        channelName: 'テストチャンネル',
        description: '新作のレビューです'
      };

      const result = matcher.matchCategories(video);
      expect(result.matchedCategories).toHaveLength(1);
      expect(result.matchedCategories[0].id).toBe('2');
    });

    it('チャンネル名に含まれるキーワードでカテゴリにマッチする（target: channel）', () => {
      const matcher = new CategoryMatcher(sampleCategories);
      const video: VideoInfo = {
        title: '新作レビュー',
        channelName: 'Gaming Channel',
        description: '新作のレビューです'
      };

      const result = matcher.matchCategories(video);
      expect(result.matchedCategories).toHaveLength(1);
      expect(result.matchedCategories[0].id).toBe('3');
    });

    it('説明文に含まれるキーワードでカテゴリにマッチする（target: both）', () => {
      const matcher = new CategoryMatcher(sampleCategories);
      const video: VideoInfo = {
        title: '新作レビュー',
        channelName: 'テストチャンネル',
        description: 'ゲーム実況の様子です'
      };

      const result = matcher.matchCategories(video);
      expect(result.matchedCategories).toHaveLength(1);
      expect(result.matchedCategories[0].id).toBe('1');
    });

    it('メンバーシップ配信の判定が正しく行われる', () => {
      const matcher = new CategoryMatcher(sampleCategories);
      const video: VideoInfo = {
        title: '新作レビュー',
        channelName: 'テストチャンネル',
        description: 'メンバー限定配信',
        isMembersOnly: true
      };

      const result = matcher.matchCategories(video);
      expect(result.videoInfo.isMembersOnly).toBe(true);
    });
  });

  describe('カテゴリ管理機能', () => {
    it('新しいカテゴリを追加できる', () => {
      const matcher = new CategoryMatcher([]);
      const newCategory: Category = {
        id: '4',
        name: '音楽',
        keywords: ['music', '歌ってみた'],
        isGrayedOut: false,
        target: 'both'
      };

      matcher.addCategory(newCategory);
      expect(matcher.getAllCategories()).toHaveLength(1);
      expect(matcher.getAllCategories()[0]).toEqual(newCategory);
    });

    it('既存のカテゴリを更新できる', () => {
      const matcher = new CategoryMatcher([...sampleCategories]);
      const updatedCategory: Category = {
        ...sampleCategories[0],
        keywords: [...sampleCategories[0].keywords, '実況プレイ']
      };

      matcher.updateCategory(updatedCategory);
      expect(matcher.getAllCategories().find(c => c.id === '1')).toEqual(updatedCategory);
    });

    it('カテゴリを削除できる', () => {
      const matcher = new CategoryMatcher([...sampleCategories]);
      matcher.removeCategory('1');
      expect(matcher.getAllCategories()).toHaveLength(2);
      expect(matcher.getAllCategories().find(c => c.id === '1')).toBeUndefined();
    });

    it('存在しないカテゴリの更新でエラーが発生する', () => {
      const matcher = new CategoryMatcher([...sampleCategories]);
      const nonExistentCategory: Category = {
        id: 'non-existent',
        name: '存在しない',
        keywords: [],
        isGrayedOut: false,
        target: 'both'
      };

      expect(() => matcher.updateCategory(nonExistentCategory)).toThrow();
    });

    it('存在しないカテゴリの削除でエラーが発生する', () => {
      const matcher = new CategoryMatcher([...sampleCategories]);
      expect(() => matcher.removeCategory('non-existent')).toThrow();
    });
  });
});