import { NextRequest, NextResponse } from 'next/server';
import { getCacheManager } from '@/lib/cache-manager';

// YouTube Data API v3 的基础URL
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// 模拟的YouTube API Key（实际使用时需要配置真实的API Key）
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'demo_key';

// 将频道ID转换为上传播放列表ID（UC -> UU）
function convertChannelIdToUploadsPlaylistId(channelId: string): string {
  if (channelId.startsWith('UC')) {
    return 'UU' + channelId.substring(2);
  }
  return channelId;
}

// 获取频道的上传播放列表ID（更可靠的方法）
async function getChannelUploadsPlaylistId(channelId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/channels?` +
      `key=${YOUTUBE_API_KEY}&` +
      `id=${channelId}&` +
      `part=contentDetails`
    );

    if (!response.ok) {
      console.error(`获取频道信息失败: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.items && data.items.length > 0) {
      return data.items[0].contentDetails?.relatedPlaylists?.uploads || null;
    }
    return null;
  } catch (error) {
    console.error('获取频道上传播放列表ID失败:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');
    const maxResults = searchParams.get('maxResults') || '6';

    if (!channelId) {
      return NextResponse.json(
        { error: '频道ID不能为空' },
        { status: 400 }
      );
    }

    // 如果没有配置真实的API Key，则返回空数据
    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'demo_key') {
      console.warn('YouTube API Key未配置，返回空视频列表。');
      return NextResponse.json({ videos: [] });
    }

    const cacheKey = `youtube-videos:${channelId}:${maxResults}`;

    try {
      const cachedVideos = await getCacheManager().get(cacheKey);

      if (cachedVideos) {
        console.log('从缓存中获取YouTube视频数据');
        return NextResponse.json({ videos: cachedVideos });
      }
    } catch (e) {
      console.error('获取缓存失败，将直接从API获取', e);
    }


    // 方法1：使用playlistItems.list（省配额方案）
    // 首先获取频道的上传播放列表ID
    let uploadsPlaylistId = await getChannelUploadsPlaylistId(channelId);
    
    // 如果API调用失败，使用转换方法作为备选
    if (!uploadsPlaylistId) {
      console.log('使用转换方法获取播放列表ID');
      uploadsPlaylistId = convertChannelIdToUploadsPlaylistId(channelId);
    }

    // 使用playlistItems.list获取视频（每次请求消耗1点配额）
    const response = await fetch(
      `${YOUTUBE_API_BASE}/playlistItems?` +
      `key=${YOUTUBE_API_KEY}&` +
      `playlistId=${uploadsPlaylistId}&` +
      `part=snippet&` +
      `maxResults=${maxResults}&` +
      `order=date`
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`YouTube API请求失败: ${response.status}`, errorBody);
      
      // 如果playlistItems.list失败，回退到search.list方法
      console.log('playlistItems.list失败，回退到search.list方法');
      const fallbackResponse = await fetch(
        `${YOUTUBE_API_BASE}/search?` +
        `key=${YOUTUBE_API_KEY}&` +
        `channelId=${channelId}&` +
        `part=snippet&` +
        `order=date&` +
        `maxResults=${maxResults}&` +
        `type=video`
      );
      
      if (!fallbackResponse.ok) {
        throw new Error(`YouTube API请求失败: ${fallbackResponse.status}`);
      }
      
      const fallbackData = await fallbackResponse.json();
      const videos = fallbackData.items || [];
      
      try {
        // 缓存1小时
        await getCacheManager().set(cacheKey, videos, 3600);
      } catch (e) {
        console.error('YouTube视频数据写入缓存失败', e);
      }
      
      return NextResponse.json({ videos });
    }

    const data = await response.json();
    
    // 转换playlistItems格式为search格式，保持兼容性
    const videos = (data.items || []).map((item: any) => ({
      id: { videoId: item.snippet?.resourceId?.videoId },
      snippet: {
        title: item.snippet?.title,
        description: item.snippet?.description,
        thumbnails: item.snippet?.thumbnails,
        channelTitle: item.snippet?.channelTitle,
        publishedAt: item.snippet?.publishedAt
      }
    })).filter((video: any) => video.id?.videoId); // 过滤掉无效的视频

    try {
      // 缓存1小时
      await getCacheManager().set(cacheKey, videos, 3600);
    } catch (e) {
      console.error('YouTube视频数据写入缓存失败', e);
    }

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('获取YouTube视频失败:', error);

    // 如果API调用失败，返回空数组
    return NextResponse.json({ videos: [] });
  }
}