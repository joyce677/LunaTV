import { NextRequest, NextResponse } from 'next/server';
import { getCacheManager } from '@/lib/cache-manager';

// YouTube Data API v3 的基础URL
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'demo_key';

// 获取频道详细信息的函数
async function getChannelInfo(channelId: string) {
  if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'demo_key') {
    console.warn('YouTube API Key未配置，无法获取频道详细信息');
    return null;
  }

  try {
    const response = await fetch(
      `${YOUTUBE_API_BASE}/channels?` +
      `key=${YOUTUBE_API_KEY}&` +
      `id=${channelId}&` +
      `part=snippet,statistics`
    );

    if (!response.ok) {
      console.error(`YouTube API请求失败: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.items && data.items.length > 0) {
      const channel = data.items[0];
      return {
        title: channel.snippet.title,
        description: channel.snippet.description,
        thumbnail: channel.snippet.thumbnails?.medium?.url || channel.snippet.thumbnails?.default?.url,
        subscriberCount: channel.statistics?.subscriberCount,
        videoCount: channel.statistics?.videoCount
      };
    }
    return null;
  } catch (error) {
    console.error('获取频道信息失败:', error);
    return null;
  }
}

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

// 获取频道最新视频的函数（使用省配额的playlistItems.list方法）
async function getChannelLatestVideos(channelId: string, maxResults = 3) {
  if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'demo_key') {
    console.warn('YouTube API Key未配置，无法获取频道视频');
    return [];
  }

  try {
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
      console.error(`YouTube API请求失败: ${response.status}`);
      
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
        return [];
      }
      
      const fallbackData = await fallbackResponse.json();
      return fallbackData.items || [];
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
    
    return videos;
  } catch (error) {
    console.error('获取频道视频失败:', error);
    return [];
  }
}

// 从YouTube页面HTML中解析频道ID的函数
async function parseChannelIdFromHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // 方法1: 查找 meta 标签中的 channelId
    const metaChannelIdMatch = html.match(/<meta\s+itemprop="channelId"\s+content="([^"]+)"/i);
    if (metaChannelIdMatch) {
      return metaChannelIdMatch[1];
    }

    // 方法2: 查找 data-channel-external-id
    const dataChannelIdMatch = html.match(/data-channel-external-id="([^"]+)"/i);
    if (dataChannelIdMatch) {
      return dataChannelIdMatch[1];
    }

    // 方法3: 查找 "externalId" JSON 属性
    const externalIdMatch = html.match(/"externalId"\s*:\s*"([^"]+)"/i);
    if (externalIdMatch) {
      return externalIdMatch[1];
    }

    // 方法4: 查找 canonical link 中的频道ID
    const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/channel\/([^"]+)"/i);
    if (canonicalMatch) {
      return canonicalMatch[1];
    }

    // 方法5: 查找 ytInitialData 中的频道ID
    const ytInitialDataMatch = html.match(/"channelId"\s*:\s*"(UC[^"]+)"/i);
    if (ytInitialDataMatch) {
      return ytInitialDataMatch[1];
    }

    return null;
  } catch (error) {
    console.error('解析频道ID失败:', error);
    return null;
  }
}

// 将频道ID转换为播放列表ID（UC -> UU）- 保持向后兼容
function convertChannelIdToPlaylistId(channelId: string): string {
  if (channelId.startsWith('UC')) {
    return 'UU' + channelId.substring(2);
  }
  return channelId;
}

export async function POST(request: NextRequest) {
  try {
    const { input } = await request.json();

    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的输入参数' },
        { status: 400 }
      );
    }

    const trimmedInput = input.trim();
    let channelId: string | null = null;
    let inputType = '';

    // 如果输入已经是频道ID格式（UC开头）
    if (trimmedInput.startsWith('UC') && trimmedInput.length === 24) {
      channelId = trimmedInput;
      inputType = 'channelId';
    }
    // 如果输入是完整的YouTube频道URL
    else if (trimmedInput.includes('youtube.com/')) {
      inputType = 'url';
      channelId = await parseChannelIdFromHtml(trimmedInput);
    }
    // 如果输入是@username格式
    else if (trimmedInput.startsWith('@')) {
      const username = trimmedInput.substring(1);
      const url = `https://www.youtube.com/@${username}`;
      inputType = 'username';
      channelId = await parseChannelIdFromHtml(url);
    }
    // 如果输入是纯用户名
    else {
      // 尝试@username格式
      const url = `https://www.youtube.com/@${trimmedInput}`;
      inputType = 'username';
      channelId = await parseChannelIdFromHtml(url);
      
      // 如果@username格式失败，尝试传统的/user/格式
      if (!channelId) {
        const userUrl = `https://www.youtube.com/user/${trimmedInput}`;
        channelId = await parseChannelIdFromHtml(userUrl);
      }
      
      // 如果还是失败，尝试/c/格式
      if (!channelId) {
        const customUrl = `https://www.youtube.com/c/${trimmedInput}`;
        channelId = await parseChannelIdFromHtml(customUrl);
      }
    }

    if (!channelId) {
      return NextResponse.json(
        { error: '无法解析频道ID，请检查输入是否正确' },
        { status: 404 }
      );
    }

    // 生成播放列表ID
    const playlistId = convertChannelIdToPlaylistId(channelId);

    // 获取频道详细信息和最新视频
    const [channelInfo, latestVideos] = await Promise.all([
      getChannelInfo(channelId),
      getChannelLatestVideos(channelId, 3)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        channelId,
        playlistId,
        inputType,
        originalInput: trimmedInput,
        channelInfo,
        latestVideos
      }
    });
  } catch (error) {
    console.error('YouTube频道解析API错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get('input');

  if (!input) {
    return NextResponse.json(
      { error: '请提供input参数' },
      { status: 400 }
    );
  }

  // 重用POST方法的逻辑
  const mockRequest = {
    json: async () => ({ input })
  } as NextRequest;

  return POST(mockRequest);
}