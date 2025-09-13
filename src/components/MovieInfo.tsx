/* eslint-disable @next/next/no-img-element */

import React from 'react';
import { SearchResult } from '@/lib/types';
import { processImageUrl } from '@/lib/utils';
import { FavoriteIcon } from '@/components/VideoCard';

interface MovieDetails {
  rate?: string;
  directors?: string[];
  screenwriters?: string[];
  cast?: string[];
  first_aired?: string;
  countries?: string[];
  languages?: string[];
  episodes?: number;
  episode_length?: string;
  movie_duration?: string;
}

interface MovieInfoProps {
  videoTitle?: string;
  videoYear?: string;
  videoDoubanId?: number;
  videoCover?: string;
  detail?: SearchResult;
  movieDetails?: MovieDetails;
  loadingMovieDetails?: boolean;
  favorited?: boolean;
  onToggleFavorite?: () => void;
}

const MovieInfo: React.FC<MovieInfoProps> = ({
  videoTitle,
  videoYear,
  videoDoubanId,
  videoCover,
  detail,
  movieDetails,
  loadingMovieDetails,
  favorited,
  onToggleFavorite,
}) => {
  return (
    <div className='grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm'>
      {/* 封面展示 */}
      <div className='md:col-span-1'>
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
                  href={`https://movie.douban.com/subject/${videoDoubanId?.toString()}`}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='absolute top-3 left-3'
                >
                  <div className='bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors'>
                    豆瓣
                  </div>
                </a>
              )}
            </>
          ) : (
            <div className='text-gray-500 dark:text-gray-400 text-center'>
              <div className='text-4xl mb-2'>🎬</div>
              <div className='text-sm'>暂无封面</div>
            </div>
          )}
        </div>
      </div>

      {/* 文字区 */}
      <div className='md:col-span-3'>
        <div className='flex flex-col h-full'>
          {/* 标题 */}
          <h1 className='text-2xl md:text-3xl font-bold mb-2 tracking-wide flex items-center flex-shrink-0'>
            {videoTitle || '影片标题'}
            {onToggleFavorite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite();
                }}
                className='ml-3 flex-shrink-0 hover:opacity-80 transition-opacity'
              >
                <FavoriteIcon filled={favorited} />
              </button>
            )}
          </h1>

          {/* 关键信息行 */}
          <div className='flex flex-wrap items-center gap-3 text-sm md:text-base mb-4 opacity-80 flex-shrink-0'>
            {detail?.class && (
              <span className='text-green-600 font-semibold'>
                {detail.class}
              </span>
            )}
            {(detail?.year || videoYear) && (
              <span>{detail?.year || videoYear}</span>
            )}
            {detail?.source_name && (
              <span className='border border-gray-500/60 px-2 py-[1px] rounded'>
                {detail.source_name}
              </span>
            )}
            {detail?.type_name && <span>{detail.type_name}</span>}
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
                              className={`w-3 h-3 ${
                                i < Math.floor(parseFloat(movieDetails.rate) / 2)
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
              className='text-sm md:text-base leading-relaxed opacity-90 overflow-y-auto flex-1 min-h-0 scrollbar-hide'
              style={{ whiteSpace: 'pre-line' }}
            >
              {detail.desc}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MovieInfo;