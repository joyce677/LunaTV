'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import PageLayout from '@/components/PageLayout';
import YouTubeVideoCard from '@/components/YouTubeVideoCard';

// 接口定义保持不变
interface YouTubeVideo {
  id: { videoId: string };
  snippet: {
    title: string;
    description?: string;
    thumbnails: {
      medium: {
        url: string;
        width?: number;
        height?: number;
      };
    };
    channelTitle: string;
    publishedAt: string;
  };
  embedPlayer?: string;
}

interface Channel {
  id: string;
  name: string;
  channelId: string;
  addedAt: string;
  sortOrder: number;
  latestVideo?: YouTubeVideo;
}

const YouTubePage = () => {
  const searchParams = useSearchParams();

  // --- 状态管理 ---
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);

  // 搜索相关状态
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [hasMoreResults, setHasMoreResults] = useState(false);

  // 优化：使用对象按频道ID存储视频，避免渲染时反复过滤，提高性能
  const [videosByChannel, setVideosByChannel] = useState<{ [key: string]: YouTubeVideo[] }>({});

  // 移除了未使用的 `videos` 和 `expandedChannels` 状态

  // --- 数据加载 Effect ---
  useEffect(() => {
    const checkYouTubeAccess = async () => {
      try {
        // 设置8秒超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时

        await fetch('https://www.youtube.com/favicon.ico', {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        setIsOnline(true);
        // 网络检测通过后，检查配置并加载数据
        await checkConfigAndLoadData();
      } catch (error) {
        try {
          const proxyResponse = await fetch('/api/youtube-check');
          if (proxyResponse.ok) {
            setIsOnline(true);
            // 网络检测通过后，检查配置并加载数据
            await checkConfigAndLoadData();
          } else {
            // 网络检测失败，固定显示网络错误页面
            setIsOnline(false);
          }
        } catch (proxyError) {
          // 网络检测失败，固定显示网络错误页面
          setIsOnline(false);
        }
      } finally {
        setIsLoading(false);
      }
    };

    const checkConfigAndLoadData = async () => {
      try {
        // 检查是否配置了频道
        const channelsResponse = await fetch('/api/youtube-channels');
        if (!channelsResponse.ok) {
          // API调用失败，可能是未配置API key
          setLoadingVideos(false);
          setInitialLoadComplete(true);
          return;
        }

        const channelsData = await channelsResponse.json();
        const loadedChannels = channelsData.channels || [];
        
        if (loadedChannels.length === 0) {
          // 没有配置频道，显示配置提示页面
          setLoadingVideos(false);
          setInitialLoadComplete(true);
          return;
        }

        // 配置正常，加载视频数据
        await loadChannelsAndVideos(loadedChannels);
      } catch (error) {
        console.error('检查配置失败:', error);
        setLoadingVideos(false);
        setInitialLoadComplete(true);
      }
    };

    const loadChannelsAndVideos = async (loadedChannels: Channel[]) => {
      try {
        const newVideosByChannel: { [key: string]: YouTubeVideo[] } = {};

        // 确保频道按sortOrder排序
        const sortedChannels = loadedChannels.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));

        const updatedChannels = await Promise.all(
          sortedChannels.map(async (channel: Channel) => {
            try {
              const videosResponse = await fetch(
                `/api/youtube-videos?channelId=${channel.channelId}&maxResults=7`
              );
              if (videosResponse.ok) {
                const videosData = await videosResponse.json();
                const channelVideos = videosData.videos || [];
                // 优化：将获取到的视频直接存入以channelId为键的对象中
                newVideosByChannel[channel.channelId] = channelVideos;
                if (channelVideos.length > 0) {
                  return { ...channel, latestVideo: channelVideos[0] };
                }
              } else {
                newVideosByChannel[channel.channelId] = [];
              }
            } catch (error) {
              console.error(`获取频道 ${channel.name} 的视频失败:`, error);
              newVideosByChannel[channel.channelId] = [];
            }
            return channel;
          })
        );

        setChannels(updatedChannels);
        setVideosByChannel(newVideosByChannel); // 更新视频数据结构
      } catch (error) {
        console.error('加载频道和视频失败:', error);
      } finally {
        setLoadingVideos(false);
        setInitialLoadComplete(true);
      }
    };

    checkYouTubeAccess();
  }, []);

  // 处理URL参数中的play参数
  useEffect(() => {
    const playVideoId = searchParams.get('play');
    if (playVideoId) {
      setCurrentPlayingId(playVideoId);
      // 滚动到页面顶部以便用户看到播放的视频
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [searchParams]);

  // --- 滚动监听 Effect ---
  useEffect(() => {
    // 获取滚动位置的函数 - 专门针对 body 滚动
    const getScrollTop = () => {
      return document.body.scrollTop || 0;
    };

    // 监听 body 元素的滚动事件
    const handleScroll = () => {
      const scrollTop = getScrollTop();
      setShowScrollToTop(scrollTop > 300);
    };

    document.body.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      // 移除 body 滚动事件监听器
      document.body.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // --- 事件处理函数 ---
  const handleSearch = async (loadMore = false) => {
    const query = searchQuery.trim();
    if (!query) return;

    try {
      if (!loadMore) {
        setIsSearching(true);
        setSearchError(null);
        setSearchResults([]);
        setIsSearchMode(true);
        setSelectedChannelId(null); // 清除频道选择
      }

      const searchParams = new URLSearchParams({
        q: query,
        maxResults: '50'
      });

      if (loadMore && nextPageToken) {
        searchParams.set('pageToken', nextPageToken);
      }

      const response = await fetch(`/api/youtube-search?${searchParams}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '搜索失败');
      }

      if (loadMore) {
        setSearchResults(prev => [...prev, ...data.videos]);
      } else {
        setSearchResults(data.videos);
      }

      setNextPageToken(data.nextPageToken || null);
      setHasMoreResults(!!data.nextPageToken);

    } catch (error) {
      console.error('搜索失败:', error);
      setSearchError(error instanceof Error ? error.message : '搜索失败');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setIsSearchMode(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setNextPageToken(null);
    setHasMoreResults(false);
  };

  const loadMoreResults = () => {
    if (hasMoreResults && !isSearching) {
      handleSearch(true);
    }
  };

  const handleVideoPlay = (videoId: string) => {
    // 切换当前播放视频，确保之前的视频被销毁
    setCurrentPlayingId(videoId);
    // 取消自动滚动到顶部
    // scrollToTop();
  };

  const scrollToTop = () => {
    try {
      // 根据调试结果，真正的滚动容器是 document.body
      document.body.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } catch (error) {
      // 如果平滑滚动完全失败，使用立即滚动
      document.body.scrollTop = 0;
    }
  };

  const handleChannelSelect = (channelId: string | null) => {
    setSelectedChannelId(channelId);

    // 如果在搜索模式下，清除搜索状态
    if (isSearchMode) {
      clearSearch();
    }

    // 延迟执行滚动，确保DOM更新完毕
    setTimeout(() => {
      const elementId = channelId ? `channel-${channelId}` : 'recommended-videos';
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  // --- 渲染逻辑 ---

  // 加载状态：检测YouTube连通性
  if (isLoading) {
    return (
      <PageLayout>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">正在检测YouTube连通性...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  // 无法访问YouTube - 网络环境问题
  if (isOnline === false) {
    return (
      <PageLayout>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">网络环境无法访问YouTube</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              抱歉，您的网络暂不支持访问YouTube。请检查您的网络连接或代理设置。
            </p>
            <div className="space-y-2">
              <button onClick={() => window.location.reload()} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors block w-full">重新检测网络</button>
              <a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer" className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors block w-full text-center">尝试直接访问YouTube</a>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="h-full flex flex-col">
        {/* Header and Search Bar */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">YouTube</h1>
            </div>
          </div>
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="搜索YouTube视频..."
                className="w-full px-4 py-3 pl-12 pr-20 border border-gray-300 dark:border-gray-600 rounded-full bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                {isSearchMode && (
                  <button
                    onClick={clearSearch}
                    className="mr-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="清除搜索"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => handleSearch()}
                  disabled={isSearching || !searchQuery.trim()}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSearching ? (
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-red-500 rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            {isSearchMode && (
              <div className="mt-2 text-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  搜索结果: "{searchQuery}"
                  {searchResults.length > 0 && `(${searchResults.length} 个视频)`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {isSearchMode ? (
            /* 搜索结果展示区域 */
            <div>
              {searchError ? (
                <div className="text-center py-8">
                  <div className="text-red-500 mb-4">
                    <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">搜索失败</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">{searchError}</p>
                  <button
                    onClick={() => handleSearch()}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    重试
                  </button>
                </div>
              ) : searchResults.length > 0 ? (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {searchResults.map((video) => (
                      <YouTubeVideoCard
                        key={video.id.videoId}
                        video={video}
                        onPlay={handleVideoPlay}
                        showActions={false}
                        currentPlayingId={currentPlayingId}
                      />
                    ))}
                  </div>

                  {/* 加载更多按钮 */}
                  {hasMoreResults && (
                    <div className="text-center mt-8">
                      <button
                        onClick={loadMoreResults}
                        disabled={isSearching}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg transition-colors disabled:cursor-not-allowed"
                      >
                        {isSearching ? (
                          <div className="flex items-center">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            加载中...
                          </div>
                        ) : (
                          '加载更多'
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : isSearching ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">正在搜索...</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">未找到相关视频</h3>
                  <p className="text-gray-600 dark:text-gray-400">请尝试其他关键词</p>
                </div>
              )}
            </div>
          ) : loadingVideos && !initialLoadComplete ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">正在加载视频...</p>
              </div>
            </div>
          ) : channels.length > 0 ? (
            <div>
              {/* 频道播放列表区域 */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">频道播放列表</h2>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{channels.length} 个频道</div>
                </div>

                {/* 频道标签页 (唯一过滤控件) */}
                <div className="mb-6">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => handleChannelSelect(null)} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedChannelId === null ? 'bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
                      全部
                    </button>
                    {channels.map((channel) => (
                      <button key={channel.id} onClick={() => handleChannelSelect(channel.channelId)} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedChannelId === channel.channelId ? 'bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
                        {channel.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {channels.map((channel) => {
                    // 只显示最新的单个视频，而不是整个播放列表
                    const latestVideo = channel.latestVideo;
                    if (!latestVideo) {
                      // 如果没有最新视频，显示频道信息
                      const pseudoVideo = {
                        id: { videoId: `channel-${channel.channelId}` },
                        snippet: {
                          title: channel.name,
                          thumbnails: { medium: { url: `https://yt3.ggpht.com/ytc/default_user=s240-c-k-c0x00ffffff-no-rj` } },
                          channelTitle: channel.name,
                          publishedAt: channel.addedAt,
                        },
                        embedPlayer: `https://www.youtube.com/channel/${channel.channelId}`,
                      };
                      return <YouTubeVideoCard key={channel.id} video={pseudoVideo} showActions={false} onPlay={handleVideoPlay} currentPlayingId={currentPlayingId} />
                    }

                    // 显示最新的单个视频，添加playlist前缀以区分推荐视频中的同一视频
                    const singleVideo = {
                      id: { videoId: `playlist-${latestVideo.id.videoId}` },
                      snippet: {
                        title: latestVideo.snippet.title,
                        thumbnails: latestVideo.snippet.thumbnails,
                        channelTitle: channel.name,
                        publishedAt: latestVideo.snippet.publishedAt,
                      },
                      embedPlayer: `https://www.youtube.com/embed/${latestVideo.id.videoId}?autoplay=1`,
                    };
                    return <YouTubeVideoCard key={channel.id} video={singleVideo} showActions={false} onPlay={handleVideoPlay} currentPlayingId={currentPlayingId} />
                  })}
                </div>
              </div>

              {/* 推荐视频区域 */}
              <div id="recommended-videos" className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">推荐视频</h2>

                {/* 优化：移除了此处的第二组过滤按钮 */}

                {/* 视频展示区域 */}
                {selectedChannelId === null ? (
                  /* 显示所有频道，按频道分组 */
                  <div className="space-y-8">
                    {channels.map((channel) => {
                      // 获取频道视频，跳过第一个（最新的）视频，因为它已经在频道播放列表中展示了
                      const allChannelVideos = videosByChannel[channel.channelId] || [];
                      const channelVideos = allChannelVideos.slice(0, 6); // 显示最新开始的前 6 个视频
                      return (
                        <div key={channel.channelId} id={`channel-${channel.channelId}`} className="space-y-4">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {channel.name}
                            <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">({channelVideos.length} 个推荐视频)</span>
                          </h3>
                          {channelVideos.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {channelVideos.map((video) => (
                                <YouTubeVideoCard key={video.id.videoId} video={video} onPlay={handleVideoPlay} showActions={false} currentPlayingId={currentPlayingId} />
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400"><p>该频道暂无更多推荐视频</p></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* 显示选中频道的视频 */
                  (() => {
                    const selectedChannel = channels.find(c => c.channelId === selectedChannelId);
                    if (!selectedChannel) {
                      return <div className="text-center py-8 text-gray-500 dark:text-gray-400"><p>未找到选中的频道</p></div>;
                    }
                    // 获取选中频道的视频，跳过第一个（最新的）视频
                    const allChannelVideos = videosByChannel[selectedChannelId] || [];
                    const channelVideos = allChannelVideos.slice(0, 6); // 显示最新开始的前 6 个视频

                    // 修正：确保整个内容块都在一个父 `div` 中
                    return (
                      <div id={`channel-${selectedChannelId}`} className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {selectedChannel.name}
                          <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">({channelVideos.length} 个推荐视频)</span>
                        </h3>
                        {channelVideos.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {channelVideos.map((video) => (
                              <YouTubeVideoCard key={video.id.videoId} video={video} onPlay={handleVideoPlay} showActions={false} currentPlayingId={currentPlayingId} />
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500 dark:text-gray-400"><p>该频道暂无更多推荐视频</p></div>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          ) : (
            /* 能访问YouTube但未配置频道时的提示 */
            <div className="flex items-center justify-center min-h-96 py-8">
              <div className="text-center max-w-2xl mx-auto p-6">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">还未配置YouTube频道</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-12">
                  YouTube连接正常，但管理员还未配置任何频道。请联系管理员在后台添加YouTube频道和配置API密钥。
                </p>
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">管理员配置指南：</h4>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1 text-left">
                    <li>• 前往管理后台 → YouTube管理</li>
                    <li>• 添加YouTube频道（支持频道链接、@用户名或频道ID）</li>
                    <li>• 并在环境变量中配置 YOUTUBE_API_KEY</li>
                    <li>• 保存配置后即可显示频道视频内容</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                    访问YouTube官网
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 返回顶部悬浮按钮 */}
        <button
          onClick={scrollToTop}
          className={`fixed bottom-20 md:bottom-6 right-6 z-[500] w-12 h-12 bg-red-500/90 hover:bg-red-500 text-white rounded-full shadow-lg backdrop-blur-sm transition-all duration-300 ease-in-out flex items-center justify-center group ${showScrollToTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
          aria-label='返回顶部'
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
    </PageLayout>
  );
};

export default YouTubePage;