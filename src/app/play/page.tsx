import { Heart } from 'react-icons/fa';
import { Suspense } from 'react';
import { PageLayout } from '../components/PageLayout';
import { EpisodeSelector } from '../components/EpisodeSelector';

// PlayPageClient 组件
const PlayPageClient = () => {
  const [Hls, videoUrl, loading, blockAdEnabled] = useHlsVideoUrl();
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [isEpisodeSelectorCollapsed, setIsEpisodeSelectorCollapsed] = useState(false);
  const [isDraggingProgressRef, setIsDraggingProgressRef] = useState(false);
  const [resizeResetTimeoutRef, setResizeResetTimeoutRef] = useState(null);
  const [seekResetTimeoutRef, setSeekResetTimeoutRef] = useState(null);
  const [saveIntervalRef, setSaveIntervalRef] = useState(null);
  const [saveConfigTimeoutRef, setSaveConfigTimeoutRef] = useState(null);
  const [configUpdateTimeoutRef, setConfigUpdateTimeoutRef] = useState(null);
  const [lastSkipCheckRef, setLastSkipCheckRef] = useState(performance.now());
  const [lastSaveTimeRef, setLastSaveTimeRef] = useState(Date.now());
  const [skipConfigRef, setSkipConfigRef] = useState(defaultSkipConfig);
  const [danmakuConfigLoaded, setDanmakuConfigLoaded] = useState(false);
  const [externalDanmuEnabledRef, setExternalDanmuEnabled] = useState(true);
  const [isExternalDanmuEnabled, setIsExternalDanmuEnabled] = useState(true);
  const [updateButtonStateRef, setUpdateButtonStateRef] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  const artRef = useRef(null);
  const configButton = useRef(null);
  const configPanel = useRef(null);

  const handleEpisodeChange = (currentEpisodeIndex: number) => {
    setCurrentEpisodeIndex(currentEpisodeIndex);
    setIsVideoLoading(true);
    console.log('切换集:', currentEpisodeIndex);
  };

  const handleSourceChange = (currentSource: string) => {
    setCurrentSource(currentSource);
    setIsVideoLoading(true);
    console.log('切换源:', currentSource);
  };

  const handleToggleFavorite = (filled: boolean) => {
    setFavorited(filled);
    console.log('切换收藏:', filled);
  };

  const cleanupPlayer = () => {
    artPlayerRef.current?.destroy();
    artPlayerRef.current = null;
  };

  const requestWakeLock = () => {
    if (!isWakeLocked) {
      setIsWakeLocked(true);
      console.log('请求Wake Lock');
      navigator.wakeLock?.request();
    }
  };

  const releaseWakeLock = () => {
    if (isWakeLocked) {
      setIsWakeLocked(false);
      console.log('释放Wake Lock');
      navigator.wakeLock?.release();
    }
  };

  const saveCurrentPlayProgress = () => {
    const authInfo = getAuthInfoFromBrowserCookie();
    if (authInfo?.username) {
      await savePlayProgress({ currentEpisodeIndex, currentSource, progress: artPlayerRef.current.currentTime });
    }
    console.log('保存进度:', artPlayerRef.current.currentTime);
  };

  const handleNextEpisode = () => {
    const d = detailRef.current;
    const idx = currentEpisodeIndexRef.current;
    if (d && d.episodes && idx < d.episodes.length - 1) {
      setTimeout(() => {
        setCurrentEpisodeIndex(idx + 1);
      }, 1000);
    }
  };

  const formatTime = (time: number) => {
    return formatTime(time);
  };

  const initPlayer = async () => {
    try {
      const [{ default: Artplayer }, { default: artplayerPluginDanmuku }] = await Promise.all([
        import('artplayer'),
        import('artplayer-plugin-danmuku')
      ]);

      // 将导入的模块设置为全局变量供 initPlayer 使用
      (window as any).DynamicArtplayer = Artplayer;
      (window as any).DynamicArtplayerPluginDanmuku = artplayerPluginDanmuku;

      await initPlayer();
    } catch (error) {
      console.error('动态导入 ArtPlayer 失败:', error);
      setError('播放器加载失败');
    }
  };

  const loadAndInit = async () => {
    try {
      const [{ default: Artplayer }, { default: artplayerPluginDanmuku }] = await Promise.all([
        import('artplayer'),
        import('artplayer-plugin-danmuku')
      ]);

      // 将导入的模块设置为全局变量供 initPlayer 使用
      (window as any).DynamicArtplayer = Artplayer;
      (window as any).DynamicArtplayerPluginDanmuku = artplayerPluginDanmuku;

      await initPlayer();
    } catch (error) {
      console.error('动态导入 ArtPlayer 失败:', error);
      setError('播放器加载失败');
    }
  };

  loadAndInit();

  return (
    <PageLayout>
      <div className='flex flex-col gap-3 py-4 px-5 lg:px-[3rem] 2xl:px-20'>
        {/* 第一行：影片标题 */}
        <div className='py-1'>
          <h1 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
            {videoTitle || '影片标题'}
            {totalEpisodes > 1 && (
              <span className='text-gray-500 dark:text-gray-400'>
                {` > ${detail?.episodes_titles?.[currentEpisodeIndex] || `第 ${currentEpisodeIndex + 1} 集`}`}
              </span>
            )}
          </h1>
        </div>
        {/* 第二行：播放器和选集 */}
        <div className='space-y-2'>
          {/* 折叠控制 - 仅在 lg 及以上屏幕显示 */}
          <div className='hidden lg:flex justify-end'>
            <button
              onClick={() =>
                setIsEpisodeSelectorCollapsed(!isEpisodeSelectorCollapsed)
              }
              className='group relative flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-800 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-200'
              title={
                isEpisodeSelectorCollapsed ? '显示选集面板' : '隐藏选集面板'
              }
            >
              <svg
                className={`w-3.5 h-3.5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${isEpisodeSelectorCollapsed ? 'rotate-180' : 'rotate-0'
                  }`}
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M9 5l7 7-7 7'
                />
              </svg>
              <span className='text-xs font-medium text-gray-600 dark:text-gray-300'>
                {isEpisodeSelectorCollapsed ? '显示' : '隐藏'}
              </span>

              {/* 精致的状态指示点 */}
              <div
                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full transition-all duration-200 ${isEpisodeSelectorCollapsed
                  ? 'bg-orange-400 animate-pulse'
                  : 'bg-green-400'
                  }`}
              ></div>
            </button>
          </div>

          <div
            className={`grid gap-4 lg:h-[500px] xl:h-[650px] 2xl:h-[750px] transition-all duration-300 ease-in-out ${isEpisodeSelectorCollapsed
              ? 'grid-cols-1'
              : 'grid-cols-1 md:grid-cols-4'
              }`}
          >
            {/* 播放器 */}
            <div
              className={`h-full transition-all duration-300 ease-in-out rounded-xl border border-white/0 dark:border-white/30 ${isEpisodeSelectorCollapsed ? 'col-span-1' : 'md:col-span-3'
                }`}
            >
              <div className='relative w-full h-[300px] lg:h-full'>
                <div
                  ref={artRef}
                  className='bg-black w-full h-full rounded-xl overflow-hidden shadow-lg'
                ></div>

                {/* 换源加载蒙层 */}
                {isVideoLoading && (
                  <div className='absolute inset-0 bg-black/85 backdrop-blur-sm rounded-xl flex items-center justify-center z-[500] transition-all duration-300'>
                    <div className='text-center max-w-md mx-auto px-6'>
                      {/* 动画影院图标 */}
                      <div className='relative mb-8'>
                        <div className='relative mx-auto w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-300'>
                          <div className='text-white text-4xl'>🎬</div>
                          {/* 旋转光环 */}
                          <div className='absolute -inset-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl opacity-20 animate-spin'></div>
                        </div>

                        {/* 浮动粒子效果 */}
                        <div className='absolute top-0 left-0 w-full h-full pointer-events-none'>
                          <div className='absolute top-2 left-2 w-2 h-2 bg-green-400 rounded-full animate-bounce'></div>
                          <div
                            className='absolute top-4 right-4 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce'
                            style={{ animationDelay: '0.5s' }}
                          ></div>
                          <div
                            className='absolute bottom-3 left-6 w-1 h-1 bg-lime-400 rounded-full animate-bounce'
                            style={{ animationDelay: '1s' }}
                          ></div>
                        </div>
                      </div>

                      {/* 换源消息 */}
                      <div className='space-y-2'>
                        <p className='text-xl font-semibold text-white animate-pulse'>
                          {videoLoadingStage === 'sourceChanging'
                            ? '🔄 切换播放源...'
                            : '🔄 视频加载中...'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 选集和换源 - 在移动端始终显示，在 lg 及以上可折叠 */}
            <div
              className={`h-[300px] lg:h-full md:overflow-hidden transition-all duration-300 ease-in-out ${isEpisodeSelectorCollapsed
                ? 'md:col-span-1 lg:hidden lg:opacity-0 lg:scale-95'
                : 'md:col-span-1 lg:opacity-100 lg:scale-100'
                }`}
            >
              <EpisodeSelector
                totalEpisodes={totalEpisodes}
                episodes_titles={detail?.episodes_titles || []}
                value={currentEpisodeIndex + 1}
                onChange={handleEpisodeChange}
                onSourceChange={handleSourceChange}
                currentSource={currentSource}
                currentId={currentId}
                videoTitle={searchTitle || videoTitle}
                availableSources={availableSources}
                sourceSearchLoading={sourceSearchLoading}
                sourceSearchError={sourceSearchError}
                precomputedVideoInfo={precomputedVideoInfo}
                videoDoubanId={videoDoubanId}
                videoCover={videoCover}
                detail={detail}
                movieDetails={movieDetails}
                loadingMovieDetails={loadingMovieDetails}
                favorited={favorited}
                onToggleFavorite={handleToggleFavorite}
              />
            </div>
          </div>
        </div>




              {/* 豆瓣详细信息 */}
              {videoDoubanId && videoDoubanId !== 0 && (
                <div className='mb-4 flex-shrink-0'>
                  {loadingMovieDetails && !movieDetails && (
                    <div className='animate-pulse'>
                      <div className='h-4 bg-gray-300 rounded w-64 mb-2'></div>
                      <div className='h-4 bg-gray-300 rounded w-48'></div>
                    </div>
                  )}

                  {movieDetails && (
                    <div className='space-y-2 text-sm'>
                      {/* 豆瓣评分 */}
                      {movieDetails.rate && (
                        <div className='flex items-center gap-2'>
                          <span className='font-semibold text-gray-700 dark:text-gray-300'>豆瓣评分: </span>
                          <div className='flex items-center'>
                            <span className='text-yellow-600 dark:text-yellow-400 font-bold text-base'>
                              {movieDetails.rate}
                            </span>
                            <div className='flex ml-1'>
                              {[...Array(5)].map((_, i) => (
                                <svg
                                  key={i}
                                  className={`w-3 h-3 ${i < Math.floor(parseFloat(movieDetails.rate) / 2)
                                    ? 'text-yellow-500'
                                    : 'text-gray-300 dark:text-gray-600'
                                    }`}
                                  fill='currentColor'
                                  viewBox='0 0 20 20'
                                >
                                  <path d='M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z' />
                                </svg>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 导演 */}
                      {movieDetails.directors && movieDetails.directors.length > 0 && (
                        <div>
                          <span className='font-semibold text-gray-700 dark:text-gray-300'>导演: </span>
                          <span className='text-gray-600 dark:text-gray-400'>
                            {movieDetails.directors.join('、')}
                          </span>
                        </div>
                      )}

                      {/* 编剧 */}
                      {movieDetails.screenwriters && movieDetails.screenwriters.length > 0 && (
                        <div>
                          <span className='font-semibold text-gray-700 dark:text-gray-300'>编剧: </span>
                          <span className='text-gray-600 dark:text-gray-400'>
                            {movieDetails.screenwriters.join('、')}
                          </span>
                        </div>
                      )}

                      {/* 主演 */}
                      {movieDetails.cast && movieDetails.cast.length > 0 && (
                        <div>
                          <span className='font-semibold text-gray-700 dark:text-gray-300'>主演: </span>
                          <span className='text-gray-600 dark:text-gray-400'>
                            {movieDetails.cast.join('、')}
                          </span>
                        </div>
                      )}

                      {/* 首播日期 */}
                      {movieDetails.first_aired && (
                        <div>
                          <span className='font-semibold text-gray-700 dark:text-gray-300'>
                            {movieDetails.episodes ? '首播' : '上映'}:
                          </span>
                          <span className='text-gray-600 dark:text-gray-400'>
                            {movieDetails.first_aired}
                          </span>
                        </div>
                      )}

                      {/* 标签信息 */}
                      <div className='flex flex-wrap gap-2 mt-3'>
                        {movieDetails.countries && movieDetails.countries.slice(0, 2).map((country: string, index: number) => (
                          <span key={index} className='bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-xs'>
                            {country}
                          </span>
                        ))}
                        {movieDetails.languages && movieDetails.languages.slice(0, 2).map((language: string, index: number) => (
                          <span key={index} className='bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 px-2 py-1 rounded-full text-xs'>
                            {language}
                          </span>
                        ))}
                        {movieDetails.episodes && (
                          <span className='bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded-full text-xs'>
                            共{movieDetails.episodes}集
                          </span>
                        )}
                        {movieDetails.episode_length && (
                          <span className='bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 px-2 py-1 rounded-full text-xs'>
                            单集{movieDetails.episode_length}分钟
                          </span>
                        )}
                        {movieDetails.movie_duration && (
                          <span className='bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-1 rounded-full text-xs'>
                            {movieDetails.movie_duration}分钟
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* 剧情简介 */}
              {detail?.desc && (
                <div
                  className='mt-0 text-base leading-relaxed opacity-90 overflow-y-auto pr-2 flex-1 min-h-0 scrollbar-hide'
                  style={{ whiteSpace: 'pre-line' }}
                >
                  {detail.desc}
                </div>
              )}
            </div>
          </div>

          {/* 封面展示 */}
          <div className='hidden md:block md:col-span-1 md:order-first'>
            <div className='pl-0 py-4 pr-6'>
              <div className='relative bg-gray-300 dark:bg-gray-700 aspect-[2/3] flex items-center justify-center rounded-xl overflow-hidden'>
                {videoCover ? (
                  <>
                    <img
                      src={processImageUrl(videoCover)}
                      alt={videoTitle}
                      className='w-full h-full object-cover'
                    />

                    {/* 豆瓣链接按钮 */}
                    {videoDoubanId !== 0 && (
                      <a
                        href={`https://movie.douban.com/subject/${videoDoubanId.toString()}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='absolute top-3 left-3'
                      >
                        <div className='bg-green-500 text-white text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center shadow-md hover:bg-green-600 hover:scale-[1.1] transition-all duration-300 ease-out'>
                          <svg
                            width='16'
                            height='16'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='2'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                          >
                            <path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'></path>
                            <path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'></path>
                          </svg>
                        </div>
                      </a>
                    )}
                  </>
                ) : (
                  <span className='text-gray-600 dark:text-gray-400'>
                    封面图片
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

// FavoriteIcon 组件
const FavoriteIcon = ({ filled }: { filled: boolean }) => {
  if (filled) {
    return (
      <svg
        className='h-7 w-7'
        viewBox='0 0 24 24'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path
          d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
          fill='#ef4444' /* Tailwind red-500 */
          stroke='#ef4444'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    );
  }
  return (
    <Heart className='h-7 w-7 stroke-[1] text-gray-600 dark:text-gray-300' />
  );
};

export default function PlayPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PlayPageClient />
    </Suspense>
  );
}