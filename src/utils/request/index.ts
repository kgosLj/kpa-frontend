// axios配置  可自行根据项目进行更改，只需更改该文件即可，其他文件可以不动
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import isString from 'lodash/isString';
import merge from 'lodash/merge';

import { ContentTypeEnum } from '@/constants';
import { useUserStore } from '@/store';
import { refreshToken as refreshTokenApi } from '@/api/auth';

import { VAxios } from './Axios';
import type { AxiosTransform, CreateAxiosOptions } from './AxiosTransform';
import { formatRequestDate, joinTimestamp, setObjToUrlParams } from './utils';

const env = import.meta.env.MODE || 'development';

// 如果是mock模式 或 没启用直连代理 就不配置host 会走本地Mock拦截 或 Vite 代理
const host = env === 'mock' || import.meta.env.VITE_IS_REQUEST_PROXY !== 'true' ? '' : import.meta.env.VITE_API_URL;

// ======== Token 刷新相关状态 ========
let isRefreshing = false; // 是否正在刷新 token
let refreshSubscribers: Array<(token: string) => void> = []; // 等待刷新完成的请求队列

// 添加请求到等待队列
function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

// 刷新完成后，通知所有等待的请求
function onTokenRefreshed(newToken: string) {
  refreshSubscribers.forEach((callback) => callback(newToken));
  refreshSubscribers = [];
}

// 刷新失败，清空队列
function onRefreshFailed() {
  refreshSubscribers = [];
}
// ======================================

// 数据处理，方便区分多种处理方式
const transform: AxiosTransform = {
  // 处理请求数据。如果数据不是预期格式，可直接抛出错误
  transformRequestHook: (res, options) => {
    const { isTransformResponse, isReturnNativeResponse } = options;

    // 如果204无内容直接返回
    const method = res.config.method?.toLowerCase();
    if (res.status === 204 && ['put', 'patch', 'delete'].includes(method)) {
      return res;
    }

    // 是否返回原生响应头 比如：需要获取响应头时使用该属性
    if (isReturnNativeResponse) {
      return res;
    }
    // 不进行任何处理，直接返回
    // 用于页面代码可能需要直接获取code，data，message这些信息时开启
    if (!isTransformResponse) {
      return res.data;
    }

    // 错误的时候返回
    const { data } = res;
    if (!data) {
      throw new Error('请求接口错误');
    }

    // 这里 code为 后台统一的字段，需要在 types.ts内修改为项目自己的接口返回格式
    // 兼容后端可能返回的不同字段名：code, status, error_code 等
    const responseData = data as any;
    const code = responseData.code ?? responseData.error_code;
    const message = responseData.message ?? responseData.msg ?? responseData.error ?? '请求失败';
    const status = responseData.status;

    // 这里逻辑可以根据项目进行修改
    // 成功的情况：
    // 1. code === 0
    // 2. status === 'ok' (后端某些接口返回这种格式)
    // 3. 没有 code 字段（直接返回数据）
    const hasSuccess = data && (
      code === 0 ||
      status === 'ok' ||
      status === 'success' ||
      (code === undefined && status !== 'error' && status !== 'fail')
    );

    if (hasSuccess) {
      // 如果有 data 字段则返回 data，否则返回整个响应
      return responseData.data !== undefined ? responseData.data : data;
    }

    // 抛出错误，包含错误码和错误信息
    throw new Error(`${message} (错误码: ${code ?? status ?? 'unknown'})`);

  },

  // 请求前处理配置
  beforeRequestHook: (config, options) => {
    const { apiUrl, isJoinPrefix, urlPrefix, joinParamsToUrl, formatDate, joinTime = true } = options;

    // 添加接口前缀
    if (isJoinPrefix && urlPrefix && isString(urlPrefix)) {
      config.url = `${urlPrefix}${config.url}`;
    }

    // 将baseUrl拼接
    if (apiUrl && isString(apiUrl)) {
      config.url = `${apiUrl}${config.url}`;
    }
    const params = config.params || {};
    const data = config.data || false;

    if (formatDate && data && !isString(data)) {
      formatRequestDate(data);
    }
    if (config.method?.toUpperCase() === 'GET') {
      if (!isString(params)) {
        // 给 get 请求加上时间戳参数，避免从缓存中拿数据。
        config.params = Object.assign(params || {}, joinTimestamp(joinTime, false));
      } else {
        // 兼容restful风格
        config.url = `${config.url + params}${joinTimestamp(joinTime, true)}`;
        config.params = undefined;
      }
    } else if (!isString(params)) {
      if (formatDate) {
        formatRequestDate(params);
      }
      if (
        Reflect.has(config, 'data') &&
        config.data &&
        (Object.keys(config.data).length > 0 || data instanceof FormData)
      ) {
        config.data = data;
        config.params = params;
      } else {
        // 非GET请求如果没有提供data，则将params视为data
        config.data = params;
        config.params = undefined;
      }
      if (joinParamsToUrl) {
        config.url = setObjToUrlParams(config.url as string, { ...config.params, ...config.data });
      }
    } else {
      // 兼容restful风格
      config.url += params;
      config.params = undefined;
    }
    return config;
  },

  // 请求拦截器处理
  requestInterceptors: (config, options) => {
    // 请求之前处理config
    const userStore = useUserStore();
    const { token } = userStore;

    if (token && (config as Recordable)?.requestOptions?.withToken !== false) {
      // jwt token
      (config as Recordable).headers.Authorization = options.authenticationScheme
        ? `${options.authenticationScheme} ${token}`
        : token;
    }
    return config;
  },

  // 响应拦截器处理
  responseInterceptors: (res) => {
    return res;
  },

  // 响应错误处理 - 包含 401 自动刷新逻辑
  responseInterceptorsCatch: (error: any, instance: AxiosInstance) => {
    const { config, response } = error;
    const userStore = useUserStore();

    // 检查是否为 401 错误（未授权/Token过期）
    if (response?.status === 401) {
      // 排除登录接口和刷新接口本身
      const url = config?.url || '';
      if (url.includes('/auth/login') || url.includes('/auth/refresh')) {
        // 登录或刷新接口 401，直接跳转登录页
        userStore.logout();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      // 检查是否有 refresh token
      const { refreshToken } = userStore;
      if (!refreshToken) {
        // 没有 refresh token，跳转登录页
        console.warn('[Auth] No refresh token available, redirecting to login');
        userStore.logout();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      // 如果正在刷新，将请求加入队列等待
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((newToken: string) => {
            // 使用新 token 重试请求
            config.headers.Authorization = `Bearer ${newToken}`;
            resolve(instance.request(config));
          });
        });
      }

      // 开始刷新 token
      isRefreshing = true;
      console.log('[Auth] Access token expired, refreshing...');

      return refreshTokenApi(refreshToken)
        .then((res: any) => {
          const newToken = res.access_token || res;
          if (newToken) {
            console.log('[Auth] Token refreshed successfully');
            // 更新 store 中的 token
            userStore.setAccessToken(newToken);
            // 通知所有等待的请求
            onTokenRefreshed(newToken);
            // 重试原请求
            config.headers.Authorization = `Bearer ${newToken}`;
            return instance.request(config);
          }
          throw new Error('Refresh token response invalid');
        })
        .catch((refreshError) => {
          console.error('[Auth] Token refresh failed:', refreshError);
          // 刷新失败，清空队列并跳转登录页
          onRefreshFailed();
          userStore.logout();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        })
        .finally(() => {
          isRefreshing = false;
        });
    }

    // 处理其他 HTTP 错误状态码
    if (response?.status) {
      const status = response.status;
      const responseData = response.data as any;
      // 优先使用后端返回的错误信息
      const backendMsg = responseData?.message ?? responseData?.msg ?? responseData?.error;

      let msg = '';
      switch (status) {
        case 403:
          msg = backendMsg ?? '无权限访问';
          break;
        case 404:
          msg = backendMsg ?? '请求资源不存在';
          break;
        case 500:
          msg = backendMsg ?? '服务器内部错误';
          break;
        case 502:
          msg = '网关错误';
          break;
        case 503:
          msg = '服务不可用';
          break;
        case 504:
          msg = '网关超时';
          break;
        default:
          msg = backendMsg ?? error.message;
      }
      error.message = msg;
    }

    // 非 401 错误的重试逻辑
    if (!config || !config.requestOptions?.retry) return Promise.reject(error);
    // 不对 4xx 错误进行重试
    if (response && response.status >= 400 && response.status < 500) {
      return Promise.reject(error);
    }

    config.retryCount = config.retryCount || 0;

    if (config.retryCount >= config.requestOptions.retry.count) return Promise.reject(error);

    config.retryCount += 1;

    const backoff = new Promise((resolve) => {
      setTimeout(() => {
        resolve(config);
      }, config.requestOptions.retry.delay || 1);
    });
    config.headers = { ...config.headers, 'Content-Type': ContentTypeEnum.Json };
    return backoff.then((config) => instance.request(config as InternalAxiosRequestConfig));
  },
};

function createAxios(opt?: Partial<CreateAxiosOptions>) {
  return new VAxios(
    merge(
      <CreateAxiosOptions>{
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication#authentication_schemes
        // 例如: authenticationScheme: 'Bearer'
        authenticationScheme: 'Bearer',
        // 超时
        timeout: 10 * 1000,
        // 携带Cookie
        withCredentials: true,
        // 头信息
        headers: { 'Content-Type': ContentTypeEnum.Json },
        // 数据处理方式
        transform,
        // 配置项，下面的选项都可以在独立的接口请求中覆盖
        requestOptions: {
          // 接口地址
          apiUrl: host,
          // 是否自动添加接口前缀
          isJoinPrefix: true,
          // 接口前缀
          // 例如: https://www.baidu.com/api
          // urlPrefix: '/api'
          urlPrefix: import.meta.env.VITE_API_URL_PREFIX,
          // 是否返回原生响应头 比如：需要获取响应头时使用该属性
          isReturnNativeResponse: false,
          // 需要对返回数据进行处理
          isTransformResponse: true,
          // post请求的时候添加参数到url
          joinParamsToUrl: false,
          // 格式化提交参数时间
          formatDate: true,
          // 是否加入时间戳
          joinTime: true,
          // 是否忽略请求取消令牌
          // 如果启用，则重复请求时不进行处理
          // 如果禁用，则重复请求时会取消当前请求
          ignoreCancelToken: true,
          // 是否携带token
          withToken: true,
          // 重试
          retry: {
            count: 3,
            delay: 1000,
          },
        },
      },
      opt || {},
    ),
  );
}
export const request = createAxios();
