/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { AdminConfig, AdminConfigResult } from '@/lib/admin.types';
import { getAuthInfoFromCookie } from '@/lib/auth';
import { clearConfigCache, getConfig } from '@/lib/config';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行管理员配置',
      },
      { status: 400 }
    );
  }

  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const username = authInfo.username;

  try {
    const config = await getConfig();
    const result: AdminConfigResult = {
      Role: 'owner',
      Config: config,
    };
    if (username === process.env.USERNAME) {
      result.Role = 'owner';
    } else {
      const user = config.UserConfig.Users.find((u) => u.username === username);
      if (user && user.role === 'admin' && !user.banned) {
        result.Role = 'admin';
      } else {
        return NextResponse.json(
          { error: '你是管理员吗你就访问？' },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store', // 管理员配置不缓存
      },
    });
  } catch (error) {
    console.error('获取管理员配置失败:', error);
    return NextResponse.json(
      {
        error: '获取管理员配置失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行管理员配置',
      },
      { status: 400 }
    );
  }

  const authInfo = getAuthInfoFromCookie(request);
  if (!authInfo || !authInfo.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const username = authInfo.username;

  try {
    const currentConfig = await getConfig();

    // 只有站长或管理员可以修改配置
    const isOwner = username === process.env.USERNAME;
    const user = currentConfig.UserConfig.Users.find((u) => u.username === username);
    const isAdmin = user && user.role === 'admin' && !user.banned;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: '只有站长或管理员可以修改配置' },
        { status: 403 }
      );
    }

    const partialConfig = await request.json();

    // Safely deep merge AIConfig
    const newConfig: AdminConfig = {
      ...currentConfig,
      AIConfig: {
        ...(currentConfig.AIConfig || {}),
        ...(partialConfig.AIConfig || {}),
      },
    };

    // 保存新配置
    await db.saveAdminConfig(newConfig);

    // 清除缓存，强制下次重新从数据库读取
    clearConfigCache();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('保存管理员配置失败:', error);
    return NextResponse.json(
      {
        error: '保存配置失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
